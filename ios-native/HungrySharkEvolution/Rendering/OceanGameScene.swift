import SpriteKit
import SwiftUI
import UIKit
import AudioToolbox
import simd

public enum OnboardingStep: String, Sendable {
    case EAT_SMALL_FISH
    case HOLD_BOOST
    case HANDS_ON_UPGRADE
    case CELEBRATE
    case DONE
}

public enum SimRewardedAdKind: String, Sendable {
    case REVIVE
    case DOUBLE_SETTLEMENT
    case SUPPLY_DROP
    case TRIAL_SHARK
}

public struct SimRewardedAdState: Sendable {
    public var kind: SimRewardedAdKind
    public var title: String
    public var rewardDesc: String
    public var secondsLeft: Int
}

@MainActor
public final class GameViewModel: ObservableObject {
    @Published public var save: SharkMetaSaveData
    @Published public var gameState: String = "title" // "title", "playing", "paused", "gameover"
    @Published public var score: Int = 0
    @Published public var inRunLevel: Int = 1
    @Published public var xp: Int = 0
    @Published public var xpRequired: Int = 140
    @Published public var hp: Double = 100
    @Published public var maxHp: Double = 100
    @Published public var ghostHpPct: Double = 100
    @Published public var energy: Double = 100
    @Published public var maxEnergy: Double = 100
    @Published public var biteTier: Int = 1
    @Published public var depthMeters: Int = 22
    @Published public var comboCount: Int = 0
    @Published public var comboTimer: Double = 0
    @Published public var frenzyActive: Bool = false
    @Published public var frenzyTimer: Double = 0
    @Published public var showEvolutionAtlas: Bool = false
    @Published public var goldOverdriveUseCount: Int = 0
    @Published public var geneSurgeUseCount: Int = 0

    // Target Bounty & Golden Mutant Charge
    @Published public var targetBountyPreyId: String = "clownfish"
    @Published public var targetBountyCaptured: Int = 0
    @Published public var goldenMutantCharge: Int = 0
    public let goldenMutantNeed: Int = 5

    // 3-Step Interactive Onboarding Tutorial
    @Published public var onboardingStep: OnboardingStep = .EAT_SMALL_FISH
    @Published public var onboardingEatCount: Int = 0
    @Published public var onboardingBoostSeconds: Double = 0
    @Published public var onboardingHandsOnUpgraded: Bool = false
    @Published public var onboardingCelebrationTimer: Double = 0

    // GameOver Revive & Settlement
    @Published public var reviveOffered: Bool = false
    @Published public var runSurvivalSec: Int = 0
    @Published public var runCoinsEarned: Int = 0
    @Published public var runGenesEarned: Int = 0
    @Published public var runPeakCombo: Int = 0
    @Published public var runMaxDepth: Int = 22
    @Published public var settlementDoubled: Bool = false
    @Published public var lastMasterySettlement: MasterySettlementResult? = nil
    @Published public var trialSharkIdForRun: String? = nil

    // 3s Simulated Rewarded Video Ad
    @Published public var simAd: SimRewardedAdState? = nil
    private var simAdTimer: Timer? = nil

    // Non-Published real-time input state (Zero SwiftUI re-render during 60/120Hz joystick drag!)
    public var joyDx: CGFloat = 0
    public var joyDy: CGFloat = 0
    public var joyActive: Bool = false
    public var isBoostingHeld: Bool = false
    public var lastRenderedSpriteKey: String = ""

    private let saveKey = "hungry_shark_48_meta_save_v2"
    private let onboardingDoneKey = "hungry_shark_onboarding_v2_done"

    public init() {
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode(SharkMetaSaveData.self, from: data) {
            self.save = decoded
        } else {
            self.save = SharkMetaSaveData.createDefault()
        }
        if UserDefaults.standard.bool(forKey: onboardingDoneKey) {
            self.onboardingStep = .DONE
        }
        recomputeCurrentSharkStats()
        pickNewBountyPrey()
    }

    public func persistSave() {
        if let data = try? JSONEncoder().encode(save) {
            UserDefaults.standard.set(data, forKey: saveKey)
        }
    }

    // MARK: - Bilingual I18N (zh / en)
    public var lang: String {
        save.language == "en" ? "en" : "zh"
    }

    public func t(_ key: String, _ params: [String: String] = [:]) -> String {
        let dict = lang == "en" ? GameConfigGenerated.i18nEn : GameConfigGenerated.i18nZh
        var text = dict[key] ?? GameConfigGenerated.i18nEn[key] ?? key
        for (k, v) in params {
            text = text.replacingOccurrences(of: "{\(k)}", with: v)
        }
        return text
    }

    public func toggleLanguage() {
        save.language = (save.language == "zh") ? "en" : "zh"
        persistSave()
        playUiTick()
    }

    public func toggleMute() {
        save.soundEnabled.toggle()
        persistSave()
        playUiTick()
    }

    public func playUiTick() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if save.soundEnabled {
            AudioServicesPlaySystemSound(1104)
        }
    }

    public func playSuccessSound() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if save.soundEnabled {
            AudioServicesPlaySystemSound(1025)
        }
    }

    // MARK: - Active Shark & Computed Stats
    public var activeSharkId: String {
        trialSharkIdForRun ?? save.selectedSharkId
    }

    public var activeSharkForm: SharkFormConfig {
        GameConfigGenerated.sharkForms.first(where: { $0.id == activeSharkId })
            ?? GameConfigGenerated.sharkForms[0]
    }

    public var activeUpgradeLevel: Int {
        if trialSharkIdForRun != nil {
            return max(5, save.sharkUpgradeLevels[activeSharkId] ?? 5)
        }
        return save.sharkUpgradeLevels[activeSharkId] ?? 1
    }

    public var currentStats: ComputedSharkStats {
        GameRules.computeEvolvedSharkStats(
            inRunLevel: inRunLevel,
            sharkFormId: activeSharkId,
            upgradeLevel: activeUpgradeLevel,
            frenzyActive: frenzyActive,
            globalDifficultyMultiplier: 1.0,
            unlockedCount: save.unlockedSharkIds.count
        )
    }

    public var huntingHeatBuff: HuntingHeatBuff {
        GameRules.computeHuntingHeatBuff(comboCount: comboCount)
    }

    public var targetBountyPrey: PreyTierConfig {
        GameConfigGenerated.preyTiers.first(where: { $0.id == targetBountyPreyId })
            ?? GameConfigGenerated.preyTiers[0]
    }

    public func pickNewBountyPrey() {
        let maxBite = max(1, currentStats.normalBiteTier)
        let candidates = GameConfigGenerated.preyTiers.filter { !$0.isHazard && !$0.isBoss && $0.tier <= maxBite }
        if let picked = candidates.randomElement() {
            targetBountyPreyId = picked.id
        } else {
            targetBountyPreyId = "clownfish"
        }
        targetBountyCaptured = 0
    }

    public func recomputeCurrentSharkStats() {
        let st = currentStats
        maxHp = st.maxHp
        maxEnergy = st.maxEnergy
        biteTier = st.biteTier
        xpRequired = GameRules.getXpRequiredForLevel(inRunLevel)
        if hp > maxHp { hp = maxHp }
        if energy > maxEnergy { energy = maxEnergy }
    }

    // MARK: - Run Lifecycle
    public var nextShowcaseSharkForm: SharkFormConfig {
        if let nextTarget = GameRules.getNextEvolutionTarget(save: save) {
            return nextTarget.form
        }
        return GameConfigGenerated.sharkForms.last ?? GameConfigGenerated.sharkForms[0]
    }

    public func startNewRun(trialSharkId: String? = nil) {
        trialSharkIdForRun = trialSharkId
        inRunLevel = trialSharkId != nil ? 5 : 1
        xp = 0
        score = 0
        comboCount = 0
        comboTimer = 0
        frenzyActive = false
        frenzyTimer = 0
        goldOverdriveUseCount = 0
        geneSurgeUseCount = 0
        runSurvivalSec = 0
        runCoinsEarned = 0
        runGenesEarned = 0
        runPeakCombo = 0
        runMaxDepth = 22
        reviveOffered = false
        settlementDoubled = false
        lastMasterySettlement = nil

        let st = currentStats
        maxHp = st.maxHp
        hp = st.maxHp
        ghostHpPct = 100
        maxEnergy = st.maxEnergy
        energy = st.maxEnergy
        biteTier = st.biteTier
        xpRequired = GameRules.getXpRequiredForLevel(inRunLevel)
        pickNewBountyPrey()

        save.totalRuns += 1
        persistSave()
        gameState = "playing"
        playUiTick()
    }

    public func pauseGame() {
        guard gameState == "playing" else { return }
        gameState = "paused"
        playUiTick()
    }

    public func resumeGame() {
        guard gameState == "paused" else { return }
        gameState = "playing"
        playUiTick()
    }

    public func returnToTitle() {
        trialSharkIdForRun = nil
        gameState = "title"
        recomputeCurrentSharkStats()
        playUiTick()
    }

    public func triggerGameOver() {
        guard gameState != "gameover" else { return }
        gameState = "gameover"
        if !reviveOffered {
            reviveOffered = true
        } else {
            finalizeRunSettlement()
        }
        persistSave()
    }

    public func declineRevive() {
        reviveOffered = false
        finalizeRunSettlement()
        playUiTick()
    }

    public func finalizeRunSettlement() {
        let activeId = activeSharkId
        let settlement = GameRules.settleSharkScoreMastery(
            sharkId: activeId,
            runScore: score,
            save: save
        )
        save.sharkBestScores[activeId] = settlement.newBestScore
        save.sharkMasteryTiers[activeId] = settlement.newMasteryTier
        if settlement.totalBonusCoins > 0 {
            save.bankedCoins += settlement.totalBonusCoins
        }
        if settlement.totalBonusGenes > 0 {
            save.bankedGenes += settlement.totalBonusGenes
        }
        lastMasterySettlement = settlement
        persistSave()
    }

    // MARK: - In-Run Skills & Upgrades
    public func triggerGoldFrenzy() {
        let form = activeSharkForm
        let cost = GameRules.getGoldOverdriveCost(useCount: goldOverdriveUseCount, generationRow: form.row)
        guard save.bankedCoins >= cost && !frenzyActive else { return }
        save.bankedCoins -= cost
        goldOverdriveUseCount += 1
        frenzyActive = true
        frenzyTimer = GameConfigGenerated.frenzyDuration + currentStats.frenzyDurationBonus
        hp = maxHp
        ghostHpPct = 100
        energy = maxEnergy
        recomputeCurrentSharkStats()
        persistSave()
        playSuccessSound()
    }

    public func triggerGeneSurge() {
        let form = activeSharkForm
        let cost = GameRules.getGeneSurgeCost(level: inRunLevel, useCount: geneSurgeUseCount, generationRow: form.row)
        guard save.bankedGenes >= cost else { return }
        save.bankedGenes -= cost
        geneSurgeUseCount += 1
        let bonusXp = Int((Double(xpRequired) * 0.55).rounded())
        addXp(bonusXp)
        hp = min(maxHp, hp + 35)
        energy = maxEnergy
        persistSave()
        playSuccessSound()
    }

    public func upgradeActiveSharkBody() {
        _ = upgradeSharkForm(activeSharkForm)
        if onboardingStep == .HANDS_ON_UPGRADE {
            onboardingHandsOnUpgraded = true
            onboardingStep = .CELEBRATE
            onboardingCelebrationTimer = 3.2
            UserDefaults.standard.set(true, forKey: onboardingDoneKey)
        }
    }

    @discardableResult
    public func upgradeSharkForm(_ form: SharkFormConfig) -> Bool {
        let curLv = save.sharkUpgradeLevels[form.id] ?? 1
        guard curLv < 10 else { return false }
        let coinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: curLv)
        let geneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: curLv)
        guard save.bankedCoins >= coinCost && save.bankedGenes >= geneCost else { return false }
        save.bankedCoins -= coinCost
        save.bankedGenes -= geneCost
        save.sharkUpgradeLevels[form.id] = curLv + 1
        recomputeCurrentSharkStats()
        hp = min(maxHp, hp + maxHp * 0.25)
        persistSave()
        playSuccessSound()
        return true
    }

    @discardableResult
    public func unlockSharkForm(_ form: SharkFormConfig) -> Bool {
        let check = GameRules.evaluateSharkUnlock(form: form, save: save)
        guard check.canUnlockNow else { return false }
        save.bankedCoins -= form.unlockCoins
        save.bankedGenes -= form.unlockGenes
        if !save.unlockedSharkIds.contains(form.id) {
            save.unlockedSharkIds.append(form.id)
        }
        if save.sharkUpgradeLevels[form.id] == nil {
            save.sharkUpgradeLevels[form.id] = 1
        }
        save.selectedSharkId = form.id
        trialSharkIdForRun = nil
        recomputeCurrentSharkStats()
        hp = maxHp
        energy = maxEnergy
        persistSave()
        playSuccessSound()
        return true
    }

    public func selectSharkForm(_ form: SharkFormConfig) {
        guard save.unlockedSharkIds.contains(form.id) else { return }
        save.selectedSharkId = form.id
        trialSharkIdForRun = nil
        recomputeCurrentSharkStats()
        persistSave()
        playUiTick()
    }

    public func evolveToNextReadySharkInRun() {
        guard let nextTarget = GameRules.getNextEvolutionTarget(save: save),
              nextTarget.check.canUnlockNow else { return }
        _ = unlockSharkForm(nextTarget.form)
    }

    public func addXp(_ amount: Int) {
        xp += amount
        while xp >= xpRequired {
            xp -= xpRequired
            inRunLevel += 1
            if inRunLevel > save.bestInRunLevel {
                save.bestInRunLevel = inRunLevel
            }
            recomputeCurrentSharkStats()
            hp = min(maxHp, hp + maxHp * 0.38)
            energy = min(maxEnergy, energy + maxEnergy * 0.50)
            playSuccessSound()
        }
    }

    // MARK: - Onboarding Controls
    public func restartOnboardingTutorial() {
        UserDefaults.standard.set(false, forKey: onboardingDoneKey)
        onboardingStep = .EAT_SMALL_FISH
        onboardingEatCount = 0
        onboardingBoostSeconds = 0
        onboardingHandsOnUpgraded = false
        onboardingCelebrationTimer = 0
        if gameState == "paused" {
            gameState = "playing"
        }
        playUiTick()
    }

    public func skipOnboardingTutorial() {
        UserDefaults.standard.set(true, forKey: onboardingDoneKey)
        onboardingStep = .DONE
        playUiTick()
    }

    // MARK: - 3s Simulated Rewarded Video Ad
    public func openSimulatedRewardedAd(kind: SimRewardedAdKind) {
        simAdTimer?.invalidate()
        let title: String
        let desc: String
        switch kind {
        case .REVIVE:
            title = lang == "zh" ? "深海紧急救援信号" : "ABYSS EMERGENCY REVIVE"
            desc = lang == "zh" ? "满血满能量复活 + 3秒无敌护盾 + 狂暴冲刺" : "Full HP & Energy Revive + 3s Shield + Frenzy"
        case .DOUBLE_SETTLEMENT:
            title = lang == "zh" ? "深海狩猎战利品翻倍" : "DOUBLE HUNTING BOUNTY"
            desc = lang == "zh" ? "本局获得的金币与基因奖励立即 ×2 倍入库" : "Instantly 2x all Coins & Genes earned this run"
        case .SUPPLY_DROP:
            title = lang == "zh" ? "深海空投补给箱" : "ABYSS SUPPLY AIRDROP"
            desc = lang == "zh" ? "立即获得 +300 金币 & +25 远古基因" : "Instantly claim +300 Coins & +25 Genes"
        case .TRIAL_SHARK:
            let showcase = nextShowcaseSharkForm
            let sName = lang == "zh" ? showcase.nameZh : showcase.nameEn
            title = lang == "zh" ? "高阶巨兽本局免费试驾" : "APEX BEHEMOTH FREE TRIAL"
            desc = lang == "zh" ? "直接驾驶【\(sName)】(Lv.5) 潜入深海狩猎！" : "Deploy [\(sName)] (Lv.5) for this run!"
        }
        simAd = SimRewardedAdState(kind: kind, title: title, rewardDesc: desc, secondsLeft: 3)
        simAdTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, var current = self.simAd else { return }
                if current.secondsLeft > 0 {
                    current.secondsLeft -= 1
                    self.simAd = current
                } else {
                    self.simAdTimer?.invalidate()
                }
            }
        }
        playUiTick()
    }

    public func cancelSimulatedAd() {
        simAdTimer?.invalidate()
        simAd = nil
        playUiTick()
    }

    public func claimSimulatedAdReward() {
        guard let ad = simAd, ad.secondsLeft <= 0 else { return }
        simAdTimer?.invalidate()
        simAd = nil

        switch ad.kind {
        case .REVIVE:
            reviveOffered = false
            hp = maxHp
            ghostHpPct = 100
            energy = maxEnergy
            frenzyActive = true
            frenzyTimer = 4.5
            gameState = "playing"
        case .DOUBLE_SETTLEMENT:
            if !settlementDoubled {
                settlementDoubled = true
                save.bankedCoins += max(30, runCoinsEarned)
                save.bankedGenes += max(5, runGenesEarned)
                persistSave()
            }
        case .SUPPLY_DROP:
            save.bankedCoins += 300
            save.bankedGenes += 25
            persistSave()
        case .TRIAL_SHARK:
            let showcase = nextShowcaseSharkForm
            startNewRun(trialSharkId: showcase.id)
        }
        playSuccessSound()
    }
}

/// Native SpriteKit (Metal-Accelerated) Ocean Simulation & 5-Layer Parallax Scene
@MainActor
public final class OceanGameScene: SKScene {
    public weak var viewModel: GameViewModel?

    private var sharkX: Double = 0
    private var sharkY: Double = 220
    private var sharkVx: Double = 160
    private var sharkVy: Double = 0
    private var sharkAngle: Double = 0
    private var sharkTargetAngle: Double = 0
    private var swimPhase: Double = 0
    private var facingDir: Double = 1
    private var facingScaleX: Double = 1
    private var turnRate: Double = 0
    private var invulnTimer: Double = 0
    private var cameraX: Double = 0
    private var cameraY: Double = 220
    private var smoothedRelativePreyScale: Double = 1.0
    private var lastUpdateTime: TimeInterval = 0
    private var survivalAccumulator: Double = 0

    private let waterBgNode = SKSpriteNode()
    private let parallaxContainer = SKNode()
    private let worldContainer = SKNode()
    private let sharkNode = SKSpriteNode()

    private final class ActivePrey {
        let config: PreyTierConfig
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var phase: Double
        var armorHp: Int
        var mutation: PreyMutationVariant

        init(config: PreyTierConfig, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double, mutation: PreyMutationVariant) {
            self.config = config
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.phase = Double.random(in: 0...(Double.pi * 2))
            self.armorHp = 2
            self.mutation = mutation
        }
    }

    private var activePreys: [ActivePrey] = []
    private let maxActivePreys = 20

    public override func didMove(to view: SKView) {
        backgroundColor = UIColor(red: 6/255, green: 148/255, blue: 194/255, alpha: 1)
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0, y: 0)

        SpriteAtlasManager.shared.preloadAllIfNeeded()

        removeAllChildren()
        addChild(waterBgNode)
        addChild(parallaxContainer)
        addChild(worldContainer)

        sharkNode.zPosition = 20
        worldContainer.addChild(sharkNode)
        refreshSharkTexture()
        syncPreyPopulation()
    }

    public func refreshSharkTexture() {
        guard let vm = viewModel else { return }
        let spKey = vm.activeSharkForm.spriteKey
        if let tex = SpriteAtlasManager.shared.sharkTexture(for: spKey) {
            sharkNode.texture = tex
            vm.lastRenderedSpriteKey = spKey
        }
    }

    public override func update(_ currentTime: TimeInterval) {
        let dt = lastUpdateTime == 0 ? (1.0 / 60.0) : min(0.05, max(0.001, currentTime - lastUpdateTime))
        lastUpdateTime = currentTime
        guard let vm = viewModel else { return }

        let viewW = Double(max(320, size.width))
        let viewH = Double(max(240, size.height))
        let stats = vm.currentStats

        if sharkNode.texture == nil || vm.lastRenderedSpriteKey != vm.activeSharkForm.spriteKey {
            refreshSharkTexture()
        }

        // Smooth ghost HP bar decay
        let curHpPct = max(0, min(100, (vm.hp / max(1, vm.maxHp)) * 100.0))
        if vm.ghostHpPct > curHpPct {
            vm.ghostHpPct = max(curHpPct, vm.ghostHpPct - dt * 28.0)
        } else {
            vm.ghostHpPct = curHpPct
        }

        // 1. Update Shark Physics (Title screen patrol vs In-game hunting)
        if vm.gameState == "title" {
            let patrolDir: Double = cos(currentTime * 0.95) >= 0 ? 1.0 : -1.0
            let inputY = sin(currentTime * 2.2) * 0.12 + max(-0.18, min(0.18, (240.0 - sharkY) * 0.008))
            stepSharkKinematics(inputX: patrolDir, inputY: inputY, isBoosting: false, stats: stats, dt: dt)
        } else if vm.gameState == "playing" && vm.simAd == nil {
            survivalAccumulator += dt
            if survivalAccumulator >= 1.0 {
                survivalAccumulator -= 1.0
                vm.runSurvivalSec += 1
            }

            let ix = Double(vm.joyDx)
            let iy = Double(vm.joyDy)
            let mag = hypot(ix, iy)
            let normX = mag > 0.08 ? ix / mag : facingDir * 0.35
            let normY = mag > 0.08 ? iy / mag : 0.0
            let canBoost = vm.isBoostingHeld && vm.energy > 2.0
            stepSharkKinematics(inputX: normX, inputY: normY, isBoosting: canBoost, stats: stats, dt: dt)

            if canBoost {
                vm.energy = max(0, vm.energy - stats.boostDrainPerSec * dt)
                if vm.onboardingStep == .HOLD_BOOST {
                    vm.onboardingBoostSeconds = min(1.2, vm.onboardingBoostSeconds + dt)
                    if vm.onboardingBoostSeconds >= 1.2 {
                        let firstCost = GameRules.getSharkUpgradeCoinCost(form: vm.activeSharkForm, currentLevel: vm.activeUpgradeLevel)
                        if vm.save.bankedCoins < firstCost {
                            vm.save.bankedCoins = firstCost
                        }
                        vm.onboardingStep = .HANDS_ON_UPGRADE
                        vm.playSuccessSound()
                    }
                }
            } else {
                vm.energy = min(vm.maxEnergy, vm.energy + GameConfigGenerated.baseBoostRegenPerSec * dt)
            }

            if vm.onboardingStep == .CELEBRATE {
                vm.onboardingCelebrationTimer -= dt
                if vm.onboardingCelebrationTimer <= 0 {
                    vm.onboardingStep = .DONE
                }
            }

            if vm.comboCount > 0 {
                vm.comboTimer -= dt
                if vm.comboTimer <= 0 {
                    vm.comboCount = 0
                }
            }

            if vm.frenzyActive {
                vm.frenzyTimer -= dt
                if vm.frenzyTimer <= 0 {
                    vm.frenzyActive = false
                    vm.recomputeCurrentSharkStats()
                }
            } else {
                vm.hp -= stats.hpDrainPerSec * dt
                if vm.hp <= 0 {
                    vm.hp = 0
                    vm.triggerGameOver()
                }
            }

            invulnTimer = max(0, invulnTimer - dt)
            let curDepth = Int((max(0, sharkY) * 0.1).rounded())
            if curDepth != vm.depthMeters {
                vm.depthMeters = curDepth
                if curDepth > vm.runMaxDepth {
                    vm.runMaxDepth = curDepth
                }
                if Double(curDepth) > vm.save.maxDepthReached {
                    vm.save.maxDepthReached = Double(curDepth)
                }
            }
        }

        // 2. Sea-Surface Locked Camera Tracking (prevents sky gap & reef lift at surface)
        let effZoom = stats.cameraZoom
        let minSurfaceCameraY = max(72.0, (viewH * 0.5 - 76.0) / effZoom)
        let targetCamX = sharkX + cos(sharkAngle) * 58.0
        let targetCamY = max(minSurfaceCameraY, sharkY + sin(sharkAngle) * 32.0)
        cameraX += (targetCamX - cameraX) * min(1.0, dt * 6.5)
        cameraY += (targetCamY - cameraY) * min(1.0, dt * 6.5)

        // 3. Smooth Optical Growth Shrinking of Far / Mid / Near Background Layers
        let targetRelScale = stats.relativePreyScale
        if abs(targetRelScale - smoothedRelativePreyScale) > 0.35 {
            smoothedRelativePreyScale = targetRelScale
        } else {
            smoothedRelativePreyScale += (targetRelScale - smoothedRelativePreyScale) * min(1.0, dt * 4.5)
        }
        let bgScales = GameRules.getParallaxLayerGrowthScales(relativePreyScale: smoothedRelativePreyScale)

        renderParallaxBackground(viewW: viewW, viewH: viewH, bgScales: bgScales)
        stepAndRenderPreys(viewW: viewW, viewH: viewH, stats: stats, dt: dt, currentTime: currentTime)
        renderPlayerShark(viewW: viewW, viewH: viewH, stats: stats)
    }

    private func stepSharkKinematics(inputX: Double, inputY: Double, isBoosting: Bool, stats: ComputedSharkStats, dt: Double) {
        sharkTargetAngle = atan2(inputY, inputX)
        var diff = sharkTargetAngle - sharkAngle
        while diff > .pi { diff -= .pi * 2 }
        while diff < -.pi { diff += .pi * 2 }

        // Hydrodynamic Horizontal Whip-Turn: pivot horizontally without pitching 90 degrees vertically
        if abs(diff) > 1.85 && cos(sharkAngle) * cos(sharkTargetAngle) < -0.15 {
            facingDir = cos(sharkTargetAngle) >= 0 ? 1.0 : -1.0
            sharkAngle = atan2(sin(sharkAngle), -cos(sharkAngle))
            diff = sharkTargetAngle - sharkAngle
            while diff > .pi { diff -= .pi * 2 }
            while diff < -.pi { diff += .pi * 2 }
            turnRate = (diff >= 0 ? 1.0 : -1.0) * 0.92
        }

        let turnSpeed = 6.2
        let angleStep = diff * min(1.0, dt * turnSpeed)
        sharkAngle += angleStep
        turnRate = turnRate * 0.84 + (angleStep / max(0.001, dt)) * 0.045

        if abs(cos(sharkAngle)) > 0.18 {
            facingDir = cos(sharkAngle) >= 0 ? 1.0 : -1.0
        }
        facingScaleX += (facingDir - facingScaleX) * min(1.0, dt * 11.0)

        let heatMult = viewModel?.huntingHeatBuff.speedMultiplier ?? 1.0
        let speed = (isBoosting ? stats.boostSpeed : stats.moveSpeed) * heatMult
        sharkVx = cos(sharkAngle) * speed
        sharkVy = sin(sharkAngle) * speed
        sharkX += sharkVx * dt
        sharkY = max(28.0, min(2200.0, sharkY + sharkVy * dt))
        swimPhase += dt * (isBoosting ? 12.5 : 7.8)
    }

    private func renderPlayerShark(viewW: Double, viewH: Double, stats: ComputedSharkStats) {
        let zoom = stats.cameraZoom
        let screenX = viewW * 0.5 + (sharkX - cameraX) * zoom
        let screenY = viewH * 0.5 - (sharkY - cameraY) * zoom

        let drawW = GameRules.sharkBaseDrawSize * stats.scale * zoom
        let texAspect: Double
        if let tex = sharkNode.texture, tex.size().height > 0 {
            texAspect = Double(tex.size().width / tex.size().height)
        } else {
            texAspect = 1.65
        }
        let drawH = drawW / max(1.1, min(2.2, texAspect))

        sharkNode.size = CGSize(width: drawW, height: drawH)
        sharkNode.position = CGPoint(x: screenX, y: screenY)

        let absFacing = max(0.15, abs(facingScaleX))
        let perspectiveScaleX = (0.42 + 0.58 * pow(absFacing, 0.8)) * (facingScaleX >= 0 ? 1.0 : -1.0)
        let horizonPitch = atan2(-sin(sharkAngle), abs(cos(sharkAngle)))
        sharkNode.xScale = CGFloat(perspectiveScaleX)
        sharkNode.yScale = 1.0
        sharkNode.zRotation = CGFloat(horizonPitch * (facingScaleX >= 0 ? 1.0 : -1.0))
        sharkNode.alpha = invulnTimer > 0 && Int(invulnTimer * 20) % 2 == 0 ? 0.45 : 1.0

        applySpineWaveWarp(to: sharkNode, phase: swimPhase, turnBend: turnRate)
    }

    private func applySpineWaveWarp(to node: SKSpriteNode, phase: Double, turnBend: Double) {
        let cols = 10
        var src: [SIMD2<Float>] = []
        var dst: [SIMD2<Float>] = []
        src.reserveCapacity((cols + 1) * 2)
        dst.reserveCapacity((cols + 1) * 2)

        for row in 0...1 {
            let v = Float(row)
            for col in 0...cols {
                let u = Float(col) / Float(cols)
                src.append(SIMD2<Float>(u, v))
                let tailProgress = Double(1.0 - u)
                let env = 0.015 * tailProgress + 0.985 * pow(tailProgress, 2.25)
                let waveDy = sin(phase - tailProgress * 2.15 * .pi) * 0.09 * env
                let cBendDy = -max(-0.8, min(0.8, turnBend)) * 0.14 * pow(tailProgress, 1.72)
                dst.append(SIMD2<Float>(u, v + Float(waveDy + cBendDy)))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: src, destinationPositions: dst)
    }

    private func renderParallaxBackground(viewW: Double, viewH: Double, bgScales: ParallaxLayerGrowthScales) {
        let rgb = GameRules.sampleBathymetricWaterRGB(depthMeters: cameraY)
        waterBgNode.color = UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z), alpha: 1.0)
        waterBgNode.size = CGSize(width: viewW, height: viewH)
        waterBgNode.position = CGPoint(x: viewW * 0.5, y: viewH * 0.5)

        parallaxContainer.removeAllChildren()

        let zonePrefix: String
        let biomeFloorY: Double
        if sharkY < 520 {
            zonePrefix = "bg_shallow"
            biomeFloorY = 680
        } else if sharkY < 1150 {
            zonePrefix = "bg_twilight"
            biomeFloorY = 1340
        } else {
            zonePrefix = "bg_abyss"
            biomeFloorY = 2100
        }

        let assetMap: [String: (water: String, far: String, mid: String, near: String)] = [
            "bg_shallow": ("bg_shallow_0_water_0e65cb68", "bg_shallow_1_far_8898229a", "bg_shallow_2_mid_b4e0d30a", "bg_shallow_3_near_96e92ee1"),
            "bg_twilight": ("bg_twilight_0_17bcb84c", "bg_twilight_1_04f5d35f", "bg_twilight_2_fd5a1b33", "bg_twilight_3_6e0dd7c1"),
            "bg_abyss": ("bg_abyss_0_1bbf506a", "bg_abyss_1_75e4a628", "bg_abyss_2_6ce66695", "bg_abyss_3_a4986280")
        ]
        guard let names = assetMap[zonePrefix] else { return }

        let u = tanh(max(0.0, biomeFloorY - sharkY) / 480.0)
        let panoRefH = min(viewH, max(360.0, viewW * 0.65))
        let baseNearH = max(88.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.25 : zonePrefix == "bg_twilight" ? 0.30 : 0.48))
        let baseMidH = max(78.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.22 : zonePrefix == "bg_twilight" ? 0.37 : 0.54))
        let baseFarH = max(82.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.232 : 0.42))

        if let waterTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.water, isWaterCanopy: true) {
            let baseCanopyH = zonePrefix == "bg_shallow" ? panoRefH * 0.36 : viewH
            let canopyH = baseCanopyH * bgScales.waterScale
            addTiledStrip(
                texture: waterTex,
                baseTargetH: baseCanopyH,
                scaledTargetH: canopyH,
                bottomYFromBottom: viewH - canopyH,
                parallaxXFactor: 0.012,
                viewW: viewW,
                alpha: 0.92,
                zPos: 1
            )
        }

        if let farTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.far) {
            let farH = baseFarH * bgScales.farScale
            let farBottomY = (baseNearH * 0.38 - (-20.0 + 2.5 * u)) * bgScales.nearScale
            addTiledStrip(
                texture: farTex,
                baseTargetH: baseFarH,
                scaledTargetH: farH,
                bottomYFromBottom: farBottomY,
                parallaxXFactor: 0.025,
                viewW: viewW,
                alpha: 0.94,
                zPos: 2
            )
        }

        if let midTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.mid) {
            let midH = baseMidH * bgScales.midScale
            let midBottomY = (baseNearH * 0.20 - (-10.0 + 14.0 * u)) * bgScales.nearScale
            addTiledStrip(
                texture: midTex,
                baseTargetH: baseMidH,
                scaledTargetH: midH,
                bottomYFromBottom: midBottomY,
                parallaxXFactor: 0.18,
                viewW: viewW,
                alpha: 1.0,
                zPos: 3
            )
        }

        if let nearTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.near) {
            let nearH = baseNearH * bgScales.nearScale
            let nearBottomY = -28.0 * u * bgScales.nearScale
            addTiledStrip(
                texture: nearTex,
                baseTargetH: baseNearH,
                scaledTargetH: nearH,
                bottomYFromBottom: nearBottomY,
                parallaxXFactor: 0.38,
                viewW: viewW,
                alpha: 1.0,
                zPos: 4
            )
        }
    }

    private func addTiledStrip(
        texture: SKTexture,
        baseTargetH: Double,
        scaledTargetH: Double,
        bottomYFromBottom: Double,
        parallaxXFactor: Double,
        viewW: Double,
        alpha: Double,
        zPos: CGFloat
    ) {
        let texSize = texture.size()
        guard texSize.height > 0 else { return }
        let aspect = Double(texSize.width / texSize.height)
        let baseTileW = max(256.0, baseTargetH * aspect)
        let tileW = max(148.0, scaledTargetH * aspect)

        let rawPhase = (cameraX * parallaxXFactor) / baseTileW
        let normPhase = (rawPhase.truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0)
        let centerAnchorX = viewW * 0.5 - normPhase * tileW
        var startX = ((centerAnchorX.truncatingRemainder(dividingBy: tileW) + tileW).truncatingRemainder(dividingBy: tileW)) - tileW

        while startX < viewW {
            let node = SKSpriteNode(texture: texture)
            node.anchorPoint = CGPoint(x: 0, y: 0)
            node.size = CGSize(width: tileW + 1.5, height: scaledTargetH)
            node.position = CGPoint(x: startX, y: bottomYFromBottom)
            node.alpha = CGFloat(alpha)
            node.zPosition = zPos
            parallaxContainer.addChild(node)
            startX += tileW
        }
    }

    private func syncPreyPopulation() {
        while activePreys.count < maxActivePreys {
            spawnOnePrey(nearShark: activePreys.count < 6)
        }
    }

    private func spawnOnePrey(nearShark: Bool) {
        let targetDepth = max(60.0, sharkY + Double.random(in: -260...260))
        let candidates = GameConfigGenerated.preyTiers.filter { p in
            if targetDepth <= 520 && (p.behavior == .EEL_CHARGER || p.isHazard || p.isBoss) {
                return false
            }
            return targetDepth >= p.minDepth && targetDepth <= p.maxDepth
        }
        let chosen = candidates.randomElement() ?? GameConfigGenerated.preyTiers[0]
        let dist = nearShark ? Double.random(in: 240...520) : Double.random(in: 640...1450)
        let ang = Double.random(in: 0...(Double.pi * 2))
        let px = sharkX + cos(ang) * dist
        let py = max(chosen.minDepth, min(chosen.maxDepth, sharkY + sin(ang) * dist * 0.6))
        let dir: Double = Bool.random() ? 1.0 : -1.0

        let node = SKSpriteNode()
        if let tex = SpriteAtlasManager.shared.preyTexture(for: chosen.spriteKey) {
            node.texture = tex
        }
        node.zPosition = 12
        worldContainer.addChild(node)
        activePreys.append(
            ActivePrey(
                config: chosen,
                node: node,
                x: px,
                y: py,
                vx: dir * chosen.baseSpeed,
                vy: 0,
                mutation: Double.random(in: 0...1) < 0.08 ? .GOLDEN_SWARM : .NONE
            )
        )
    }

    private func stepAndRenderPreys(viewW: Double, viewH: Double, stats: ComputedSharkStats, dt: Double, currentTime: TimeInterval) {
        guard let vm = viewModel else { return }
        syncPreyPopulation()
        let zoom = stats.cameraZoom

        var idx = activePreys.count - 1
        while idx >= 0 {
            let p = activePreys[idx]
            p.phase += dt * 5.2
            p.x += p.vx * dt
            p.y = max(p.config.minDepth, min(p.config.maxDepth, p.y + sin(p.phase) * 14.0 * dt))

            let dx = p.x - sharkX
            let dy = p.y - sharkY
            let dist = hypot(dx, dy)

            if dist > 1950 {
                p.node.removeFromParent()
                activePreys.remove(at: idx)
                idx -= 1
                continue
            }

            let visualScale = GameRules.getPreyRelativeVisualScale(
                prey: p.config,
                sharkStats: stats,
                mutationVariant: p.mutation
            )
            let hitRadius = p.config.radius * visualScale + 26.0 * stats.scale

            if vm.gameState == "playing" && vm.simAd == nil && dist < hitRadius {
                let outcome = GameRules.resolvePreyEncounter(
                    prey: p.config,
                    sharkStats: stats,
                    isBoosting: vm.isBoostingHeld && vm.energy > 2.0,
                    frenzyActive: vm.frenzyActive,
                    mutationVariant: p.mutation
                )
                if outcome == .DEVOUR {
                    let mult = p.mutation == .GOLDEN_SWARM ? 3 : 1
                    let heatScoreMult = vm.huntingHeatBuff.scoreMultiplier
                    vm.score += Int((Double(p.config.scoreValue * mult) * heatScoreMult).rounded())
                    let coinGain = max(1, Int((Double(p.config.coinValue * mult) * stats.coinYieldMultiplier).rounded()))
                    vm.save.bankedCoins += coinGain
                    vm.runCoinsEarned += coinGain

                    if p.config.geneValue > 0 && (p.mutation == .GOLDEN_SWARM || Double.random(in: 0...1) < 0.35) {
                        let geneGain = max(1, Int((Double(p.config.geneValue) * stats.geneYieldMultiplier).rounded()))
                        vm.save.bankedGenes += geneGain
                        vm.runGenesEarned += geneGain
                    }

                    // Target Bounty check
                    if p.config.id == vm.targetBountyPreyId {
                        vm.targetBountyCaptured += 1
                        if vm.targetBountyCaptured >= 3 {
                            vm.save.bankedCoins += 45
                            vm.save.bankedGenes += 3
                            vm.runCoinsEarned += 45
                            vm.runGenesEarned += 3
                            vm.pickNewBountyPrey()
                            vm.playSuccessSound()
                        }
                    }

                    // Golden mutant charge check
                    if p.mutation == .GOLDEN_SWARM {
                        vm.goldenMutantCharge += 1
                        if vm.goldenMutantCharge >= vm.goldenMutantNeed {
                            vm.goldenMutantCharge = 0
                            vm.frenzyActive = true
                            vm.frenzyTimer = GameConfigGenerated.frenzyDuration + stats.frenzyDurationBonus
                            vm.recomputeCurrentSharkStats()
                        }
                    }

                    // Onboarding Step 1 check
                    if vm.onboardingStep == .EAT_SMALL_FISH {
                        vm.onboardingEatCount += 1
                        if vm.onboardingEatCount >= 3 {
                            vm.onboardingStep = .HOLD_BOOST
                            vm.playSuccessSound()
                        }
                    }

                    vm.hp = min(vm.maxHp, vm.hp + p.config.hpRestore * stats.devourHealMultiplier)
                    vm.addXp(p.config.xpValue * mult)
                    vm.comboCount += 1
                    vm.comboTimer = 4.2
                    if vm.comboCount > vm.runPeakCombo {
                        vm.runPeakCombo = vm.comboCount
                    }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    p.node.removeFromParent()
                    activePreys.remove(at: idx)
                    idx -= 1
                    continue
                } else if outcome == .ARMOR_CRUSH {
                    p.armorHp -= 1
                    invulnTimer = 0.45
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    if p.armorHp <= 0 {
                        vm.score += p.config.scoreValue * 2
                        let gGain = p.config.geneValue * 2
                        vm.save.bankedGenes += gGain
                        vm.runGenesEarned += gGain
                        vm.addXp(Int(Double(p.config.xpValue) * 1.5))
                        p.node.removeFromParent()
                        activePreys.remove(at: idx)
                        idx -= 1
                        continue
                    } else {
                        p.x += (dx / max(1.0, dist)) * 65.0
                    }
                } else if invulnTimer <= 0 {
                    vm.hp = max(0, vm.hp - p.config.damageOnFail * stats.damageTakenMultiplier)
                    invulnTimer = 0.85
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
            }

            let screenX = viewW * 0.5 + (p.x - cameraX) * zoom
            let screenY = viewH * 0.5 - (p.y - cameraY) * zoom
            let drawW = p.config.radius * GameRules.preyRadiusToDrawSize * visualScale * zoom
            let texAspect: Double
            if let tex = p.node.texture, tex.size().height > 0 {
                texAspect = Double(tex.size().width / tex.size().height)
            } else {
                texAspect = 1.45
            }
            let drawH = drawW / max(0.85, min(2.2, texAspect))
            p.node.size = CGSize(width: drawW, height: drawH)
            p.node.position = CGPoint(x: screenX, y: screenY)
            p.node.xScale = p.vx >= 0 ? -1.0 : 1.0
            idx -= 1
        }
    }
}
