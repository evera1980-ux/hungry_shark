import Foundation
import SwiftUI
import UIKit
import QuartzCore

public enum OnboardingStep: String, Sendable {
    case EAT_SMALL_FISH
    case HOLD_BOOST
    case HANDS_ON_UPGRADE
    case CELEBRATE
    case DONE
}

@MainActor
public final class GameViewModel: ObservableObject {
    @Published public var save: SharkMetaSaveData
    @Published public var gameState: String = "title" // "title", "playing", "paused", "gameover"
    @Published public var score: Int = 0
    @Published public var inRunLevel: Int = 1
    @Published public var xp: Int = 0
    @Published public var xpRequired: Int = 140
    @Published public var biteTier: Int = 1
    @Published public var frenzyActive: Bool = false
    @Published public var showEvolutionAtlas: Bool = false
    @Published public var goldOverdriveUseCount: Int = 0
    @Published public var geneSurgeUseCount: Int = 0

    // Isolated high-frequency HUD telemetry store (throttled ~18Hz, observed only by leaf HUD views — iOS-P1-1)
    public let telemetry = HudTelemetryStore()

    // Simulation-rate backing fields (NON-@Published so 60Hz OceanGameScene ticks do ZERO root ContentView diffs!)
    public var hp: Double = 100
    public var maxHp: Double = 100
    public var ghostHpPct: Double = 100
    public var energy: Double = 100
    public var maxEnergy: Double = 100
    public var depthMeters: Int = 22
    public var deepDivePromptMeters: Int? = nil
    public var comboCount: Int = 0
    public var comboTimer: Double = 0
    public var frenzyTimer: Double = 0

    // Target Bounty & Golden Mutant Charge
    @Published public var targetBountyPreyId: String = "PREY-001"
    @Published public var targetBountyCaptured: Int = 0
    @Published public var goldenMutantCharge: Int = 0
    public let goldenMutantNeed: Int = 5

    // 3-Step Interactive Onboarding Tutorial
    @Published public var onboardingStep: OnboardingStep = .EAT_SMALL_FISH
    @Published public var onboardingEatCount: Int = 0
    public var onboardingBoostSeconds: Double = 0
    @Published public var onboardingHandsOnUpgraded: Bool = false
    public var onboardingCelebrationTimer: Double = 0

    // GameOver Revive & Settlement
    @Published public var reviveOffered: Bool = false
    private var reviveUsedInCurrentRun: Bool = false
    @Published public var runSurvivalSec: Int = 0
    @Published public var runCoinsEarned: Int = 0
    @Published public var runGenesEarned: Int = 0
    @Published public var runPeakCombo: Int = 0
    @Published public var runMaxDepth: Int = 22
    @Published public var settlementDoubled: Bool = false
    @Published public var lastMasterySettlement: MasterySettlementResult? = nil
    @Published public var trialSharkIdForRun: String? = nil

    // Ad Unavailable / Cooldown Alert Notice (Zero simulated 3s ad on iOS!)
    @Published public var adUnavailableMessage: String? = nil

    // Non-Published real-time input state (Zero SwiftUI re-render during joystick drag!)
    public var joyDx: CGFloat = 0
    public var joyDy: CGFloat = 0
    public var joyActive: Bool = false
    public var isBoostingHeld: Bool = false
    public var lastRenderedSpriteKey: String = ""
    @Published public var runSequenceId: Int = 0

    public func resetInputState() {
        joyDx = 0
        joyDy = 0
        joyActive = false
        isBoostingHeld = false
    }

    /// Immediately flushes all simulation telemetry into the isolated `telemetry` store.
    public func flushTelemetryImmediate(timestamp: TimeInterval = CACurrentMediaTime()) {
        telemetry.pushImmediate(
            hp: hp,
            maxHp: maxHp,
            ghostHpPct: ghostHpPct,
            energy: energy,
            maxEnergy: maxEnergy,
            depthMeters: depthMeters,
            deepDivePromptMeters: deepDivePromptMeters,
            comboCount: comboCount,
            frenzyActive: frenzyActive,
            frenzyTimer: frenzyTimer,
            onboardingBoostSeconds: onboardingBoostSeconds,
            timestamp: timestamp
        )
    }

    /// Throttled telemetry sync (~18Hz) called by `OceanGameScene.update(_:)`.
    public func syncTelemetryThrottled(timestamp: TimeInterval) {
        telemetry.syncThrottled(
            hp: hp,
            maxHp: maxHp,
            ghostHpPct: ghostHpPct,
            energy: energy,
            maxEnergy: maxEnergy,
            depthMeters: depthMeters,
            deepDivePromptMeters: deepDivePromptMeters,
            comboCount: comboCount,
            frenzyActive: frenzyActive,
            frenzyTimer: frenzyTimer,
            onboardingBoostSeconds: onboardingBoostSeconds,
            timestamp: timestamp
        )
    }

    private let saveKey = "hungry_shark_48_meta_save_v2"
    private let onboardingDoneKey = "hungry_shark_onboarding_v2_done"

    public init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode(SharkMetaSaveData.self, from: data) {
            self.save = decoded
        } else {
            self.save = SharkMetaSaveData.createDefault()
        }
        if UserDefaults.standard.bool(forKey: onboardingDoneKey) {
            self.onboardingStep = .DONE
        }
        OceanAudioEngine.shared.setMuted(!self.save.soundEnabled)
        recomputeCurrentSharkStats()
        pickNewBountyPrey()
        GoogleAdMobManager.shared.startSDKAndPreload()
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
        // Guarantee no uninterpolated {var} placeholder ever leaks into the UI
        if text.contains("{"), let regex = try? NSRegularExpression(pattern: "\\{[a-zA-Z0-9_]+\\}") {
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            text = regex.stringByReplacingMatches(in: text, options: [], range: range, withTemplate: "").trimmingCharacters(in: .whitespaces)
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
        OceanAudioEngine.shared.setMuted(!save.soundEnabled)
        persistSave()
        playUiTick()
    }

    public func playUiTick() {
        HapticFeedbackManager.shared.playLight(minInterval: 0.03)
        if save.soundEnabled {
            OceanAudioEngine.shared.playUiTick()
        }
    }

    public func playSuccessSound() {
        HapticFeedbackManager.shared.playNotification(.success, minInterval: 0.06)
        if save.soundEnabled {
            OceanAudioEngine.shared.playCoin(isGene: true)
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

    /// Picks a bounty prey species strictly obeying `minSpawnablePreyLengthM` (P1-2 parity with Web `rollTargetBountySpecies`).
    /// For giant sharks lingering in depleted shallows, prefers the shallowest viable deep-sea prey so the bounty is always huntable.
    public func pickNewBountyPrey(currentWorldY: Double? = nil) {
        let st = currentStats
        let maxBite = max(1, st.normalBiteTier)
        let minLenCm = st.minSpawnablePreyLengthM * 100.0
        let allEligible = GameConfigGenerated.preyTiers.filter { p in
            guard !p.isHazard && !p.isBoss && p.tier <= maxBite else { return false }
            let lenCm = p.bodyLengthCm > 0 ? p.bodyLengthCm : p.radius * 2.5
            return lenCm >= minLenCm
        }

        let pool: [PreyTierConfig]
        if let wy = currentWorldY, !allEligible.isEmpty {
            let nearBand = allEligible.filter { wy >= $0.minDepth - 600.0 && wy <= $0.maxDepth + 600.0 }
            if !nearBand.isEmpty {
                pool = nearBand
            } else {
                // Giant shark in depleted shallows: pick among the shallowest viable deep-sea species.
                let minViableDepth = allEligible.map { $0.minDepth }.min() ?? 0.0
                let deepBand = allEligible.filter { $0.minDepth <= minViableDepth + 2400.0 }
                pool = deepBand.isEmpty ? allEligible : deepBand
            }
        } else if !allEligible.isEmpty {
            let minViableDepth = allEligible.map { $0.minDepth }.min() ?? 0.0
            let reachable = allEligible.filter { $0.minDepth <= minViableDepth + 2600.0 }
            pool = reachable.isEmpty ? allEligible : reachable
        } else {
            // Fallback to largest devourable non-hazard species if shark exceeds every species' threshold
            pool = GameConfigGenerated.preyTiers
                .filter { !$0.isHazard && !$0.isBoss && $0.tier <= maxBite }
                .sorted { ($0.bodyLengthCm > 0 ? $0.bodyLengthCm : $0.radius * 2.5) > ($1.bodyLengthCm > 0 ? $1.bodyLengthCm : $1.radius * 2.5) }
                .prefix(6)
                .map { $0 }
        }

        if let picked = pool.randomElement() {
            targetBountyPreyId = picked.id
        } else {
            targetBountyPreyId = "PREY-001"
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
        flushTelemetryImmediate()
    }

    // MARK: - Run Lifecycle
    public var nextShowcaseSharkForm: SharkFormConfig {
        if let nextTarget = GameRules.getNextEvolutionTarget(save: save) {
            return nextTarget.form
        }
        return GameConfigGenerated.sharkForms.last ?? GameConfigGenerated.sharkForms[0]
    }

    public func startNewRun(trialSharkId: String? = nil) {
        resetInputState()
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
        reviveOffered = false
        reviveUsedInCurrentRun = false
        settlementDoubled = false
        lastMasterySettlement = nil
        deepDivePromptMeters = nil

        let st = currentStats
        let initSpawnY = max(220.0, (22.0 * st.worldScale + 95.0).rounded())
        let initDepthM = Int(GameRules.worldYToMeterDepth(initSpawnY).rounded())
        depthMeters = initDepthM
        runMaxDepth = initDepthM
        maxHp = st.maxHp
        hp = st.maxHp
        ghostHpPct = 100
        maxEnergy = st.maxEnergy
        energy = st.maxEnergy
        biteTier = st.biteTier
        xpRequired = GameRules.getXpRequiredForLevel(inRunLevel)
        pickNewBountyPrey(currentWorldY: initSpawnY)

        save.totalRuns += 1
        persistSave()
        flushTelemetryImmediate()
        SpriteAtlasManager.shared.prewarmSharkWindow(selectedSharkId: activeSharkId)
        runSequenceId += 1
        gameState = "playing"
        playUiTick()
    }

    public func pauseGame(silent: Bool = false) {
        guard gameState == "playing" else { return }
        resetInputState()
        gameState = "paused"
        if !silent {
            playUiTick()
        }
    }

    public func resumeGame() {
        guard gameState == "paused" else { return }
        resetInputState()
        gameState = "playing"
        playUiTick()
    }

    public func returnToTitle() {
        resetInputState()
        trialSharkIdForRun = nil
        deepDivePromptMeters = nil
        gameState = "title"
        recomputeCurrentSharkStats()
        flushTelemetryImmediate()
        playUiTick()
    }

    public func triggerGameOver() {
        guard gameState != "gameover" else { return }
        resetInputState()
        deepDivePromptMeters = nil
        flushTelemetryImmediate()
        gameState = "gameover"
        if !reviveUsedInCurrentRun {
            reviveOffered = true
        } else {
            reviveOffered = false
            finalizeRunSettlement()
        }
        persistSave()
        if save.soundEnabled {
            OceanAudioEngine.shared.playHit()
        }
    }

    public func declineRevive() {
        resetInputState()
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
        HapticFeedbackManager.shared.playHeavy(minInterval: 0.08)
        if save.soundEnabled {
            OceanAudioEngine.shared.playFrenzy()
        }
    }

    public func triggerGeneSurge() {
        let form = activeSharkForm
        let cost = GameRules.getGeneSurgeCost(level: inRunLevel, useCount: geneSurgeUseCount, generationRow: form.row)
        guard save.bankedGenes >= cost else { return }
        save.bankedGenes -= cost
        geneSurgeUseCount += 1
        let bonusXp = Int((Double(xpRequired) * 0.55).rounded())
        _ = addXp(bonusXp)
        hp = min(maxHp, hp + 35)
        energy = maxEnergy
        flushTelemetryImmediate()
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
        flushTelemetryImmediate()
        persistSave()
        HapticFeedbackManager.shared.playNotification(.success, minInterval: 0.06)
        if save.soundEnabled {
            OceanAudioEngine.shared.playEvolution()
        }
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
        flushTelemetryImmediate()
        SpriteAtlasManager.shared.prewarmSharkWindow(selectedSharkId: form.id)
        persistSave()
        HapticFeedbackManager.shared.playNotification(.success, minInterval: 0.08)
        if save.soundEnabled {
            OceanAudioEngine.shared.playEvolution()
        }
        return true
    }

    public func selectSharkForm(_ form: SharkFormConfig) {
        guard save.unlockedSharkIds.contains(form.id) else { return }
        save.selectedSharkId = form.id
        trialSharkIdForRun = nil
        recomputeCurrentSharkStats()
        SpriteAtlasManager.shared.prewarmSharkWindow(selectedSharkId: form.id)
        persistSave()
        playUiTick()
    }

    public func evolveToNextReadySharkInRun() {
        guard let nextTarget = GameRules.getNextEvolutionTarget(save: save),
              nextTarget.check.canUnlockNow else { return }
        _ = unlockSharkForm(nextTarget.form)
    }

    @discardableResult
    public func addXp(_ amount: Int) -> Bool {
        xp += amount
        var leveledUp = false
        while xp >= xpRequired {
            xp -= xpRequired
            inRunLevel += 1
            leveledUp = true
            if inRunLevel > save.bestInRunLevel {
                save.bestInRunLevel = inRunLevel
            }
            recomputeCurrentSharkStats()
            hp = min(maxHp, hp + maxHp * 0.38)
            energy = min(maxEnergy, energy + maxEnergy * 0.50)
            flushTelemetryImmediate()
            HapticFeedbackManager.shared.playNotification(.success, minInterval: 0.08)
            if save.soundEnabled {
                OceanAudioEngine.shared.playEvolution()
            }
        }
        return leveledUp
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

    // MARK: - Google AdMob Rewarded Video (iOS Native Zero-Simulation)
    public func showRewardedAd(kind: SimRewardedAdKind) {
        GoogleAdMobManager.shared.showRewardedAd(
            kind: kind,
            onReward: { [weak self] in
                self?.grantAdReward(for: kind)
            },
            onUnavailable: { [weak self] in
                guard let self = self else { return }
                self.adUnavailableMessage = self.lang == "zh"
                    ? "暂时没有可用的广告，请稍后再试"
                    : "No ads currently available. Please try again later."
                self.playUiTick()
            },
            onCooldown: { [weak self] seconds in
                guard let self = self else { return }
                self.adUnavailableMessage = self.lang == "zh"
                    ? "补给冷却中，请 \(seconds) 秒后再试"
                    : "Reward cooling down. Please try again in \(seconds)s."
                self.playUiTick()
            }
        )
    }

    public func dismissAdUnavailableAlert() {
        adUnavailableMessage = nil
        playUiTick()
    }

    public func grantAdReward(for kind: SimRewardedAdKind) {
        switch kind {
        case .REVIVE:
            resetInputState()
            reviveUsedInCurrentRun = true
            reviveOffered = false
            frenzyActive = true
            recomputeCurrentSharkStats()
            frenzyTimer = GameConfigGenerated.frenzyDuration + currentStats.frenzyDurationBonus
            hp = maxHp
            ghostHpPct = 100
            energy = maxEnergy
            flushTelemetryImmediate()
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
