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

    // Target Bounty, Golden Mutant Charge & Economy Runtime State
    @Published public var targetBountyPreyId: String = "PREY-001"
    @Published public var targetBountyCaptured: Int = 0
    @Published public var goldenMutantCharge: Int = 0
    @Published public var announcedCrownTier: Int = 0
    @Published public var crownHudToastText: String? = nil

    public var runSurvivalElapsedSec: Double = 0.0
    public var globalDifficultyMultiplier: Double = 1.0
    public var frenzyCooldownRemaining: Double = 0.0
    public var genePityMissStreak: Int = 0
    public var pendingSkillInvulnSec: Double = 0.0
    public var pendingInterstitialCheck: Bool = false

    public var targetBountyRequired: Int {
        DomainConfigs.economyPredation.bounty.requiredKills
    }

    public var trialConfig: TrialSharkAdConfig {
        DomainConfigs.adsAndMonetization.placements.TRIAL_SHARK
    }

    public var currentSupplyDropReward: SupplyDropRowRewardConfig {
        let maxRow = DomainConfigs.maxUnlockedRow(unlockedSharkIds: save.unlockedSharkIds)
        return DomainConfigs.supplyDropReward(forMaxUnlockedRow: maxRow)
    }

    public var goldenMutantNeed: Int {
        let cfg = DomainConfigs.economyPredation.frenzy
        let reduction = currentStats.goldenMutantReduction
        return max(cfg.minChargeFloor, cfg.goldenChargeRequired - reduction)
    }

    // 3-Step Interactive Onboarding Tutorial
    @Published public var onboardingStep: OnboardingStep = .EAT_SMALL_FISH
    @Published public var onboardingEatCount: Int = 0
    public var onboardingBoostSeconds: Double = 0
    @Published public var onboardingHandsOnUpgraded: Bool = false
    public var onboardingCelebrationTimer: Double = 0

    // GameOver Revive & Settlement
    @Published public var reviveOffered: Bool = false
    private var reviveUsedInCurrentRun: Bool = false
    private var hasSettledCurrentRun: Bool = false
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

    private let userDefaults: UserDefaults
    private let saveKey: String
    private let onboardingDoneKey: String

    public init(
        userDefaults: UserDefaults = .standard,
        saveKey: String = "hungry_shark_48_meta_save_v2",
        onboardingDoneKey: String = "hungry_shark_onboarding_v2_done",
        preloadAds: Bool = true
    ) {
        self.userDefaults = userDefaults
        self.saveKey = saveKey
        self.onboardingDoneKey = onboardingDoneKey
        GADInfoPlistRuntimePatch.installIfNeeded()
        if let data = userDefaults.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode(SharkMetaSaveData.self, from: data) {
            self.save = decoded
        } else {
            self.save = SharkMetaSaveData.createDefault()
        }
        if userDefaults.bool(forKey: onboardingDoneKey) {
            self.onboardingStep = .DONE
        }
        OceanAudioEngine.shared.setMuted(!self.save.soundEnabled)
        recomputeCurrentSharkStats()
        pickNewBountyPrey()
        if preloadAds {
            GoogleAdMobManager.shared.startSDKAndPreload()
        }
    }

    public func persistSave() {
        if let data = try? JSONEncoder().encode(save) {
            userDefaults.set(data, forKey: saveKey)
        }
    }

    // MARK: - Bilingual I18N (en / zh, default: en)
    public var lang: String {
        save.language == "zh" ? "zh" : "en"
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
        save.language = (lang == "en") ? "zh" : "en"
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

    // MARK: - Unified Permanent-Progress Eligibility Gate (D1 + D2)
    public var isActiveTrialInRun: Bool {
        (gameState == "playing" || gameState == "paused") && trialSharkIdForRun != nil
    }

    public var permanentProgressContext: PermanentProgressRunContext {
        PermanentProgressRunContext(
            isTrial: trialSharkIdForRun != nil,
            activeInRun: gameState == "playing" || gameState == "paused"
        )
    }

    public var permanentProgressEligibility: PermanentProgressEligibility {
        GameRules.getPermanentProgressEligibility(permanentProgressContext)
    }

    public var isEligibleForPermanentProgress: Bool {
        GameRules.isEligibleForPermanentProgress(permanentProgressContext)
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
            let trialLv = DomainConfigs.adsAndMonetization.placements.TRIAL_SHARK.trialUpgradeLevel
            return max(trialLv, save.sharkUpgradeLevels[activeSharkId] ?? trialLv)
        }
        return save.sharkUpgradeLevels[activeSharkId] ?? 1
    }

    public var globalAtlasBonuses: GlobalAtlasBonuses {
        GameRules.getGlobalAtlasBonuses(save: save)
    }

    public var currentStats: ComputedSharkStats {
        GameRules.computeEvolvedSharkStats(
            inRunLevel: inRunLevel,
            sharkFormId: activeSharkId,
            upgradeLevel: activeUpgradeLevel,
            frenzyActive: frenzyActive,
            globalDifficultyMultiplier: globalDifficultyMultiplier,
            unlockedCount: save.unlockedSharkIds.count,
            totalCrownCount: globalAtlasBonuses.totalMasteryCrowns
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
        DomainConfigs.trialTargetSharkForm(unlockedSharkIds: save.unlockedSharkIds)
    }

    public func startNewRun(trialSharkId: String? = nil) {
        resetInputState()
        trialSharkIdForRun = trialSharkId
        hasSettledCurrentRun = false
        let tCfg = DomainConfigs.adsAndMonetization.placements.TRIAL_SHARK
        inRunLevel = trialSharkId != nil ? tCfg.trialInRunLevel : 1
        xp = 0
        score = 0
        comboCount = 0
        comboTimer = 0
        runSurvivalElapsedSec = 0.0
        globalDifficultyMultiplier = 1.0
        frenzyCooldownRemaining = 0.0
        genePityMissStreak = 0
        pendingSkillInvulnSec = 0.0
        announcedCrownTier = 0
        crownHudToastText = nil
        goldenMutantCharge = 0
        let trialStartFrenzy = (trialSharkId != nil && tCfg.initialFrenzyDurationSec > 0) ? tCfg.initialFrenzyDurationSec : 0.0
        frenzyActive = trialStartFrenzy > 0.0
        frenzyTimer = trialStartFrenzy
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

        let runCtx = PermanentProgressRunContext(isTrial: trialSharkId != nil, activeInRun: true)
        GameRules.recordFormalRunStarted(runContext: runCtx, save: &save)
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
        persistSave()
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
        guard !hasSettledCurrentRun else { return }
        hasSettledCurrentRun = true

        let activeId = activeSharkId
        let eligibility = permanentProgressEligibility
        let settlement = GameRules.settleSharkScoreMastery(
            sharkId: activeId,
            runScore: score,
            save: save,
            runContext: permanentProgressContext
        )

        if eligibility.allowSharkMasteryAndCrown {
            save.sharkBestScores[activeId] = settlement.newBestScore
            save.sharkMasteryTiers[activeId] = settlement.newMasteryTier
            if settlement.totalBonusCoins > 0 {
                save.bankedCoins += settlement.totalBonusCoins
            }
            if settlement.totalBonusGenes > 0 {
                save.bankedGenes += settlement.totalBonusGenes
            }
        }
        lastMasterySettlement = settlement
        persistSave()
        if eligibility.allowRunRecords && GoogleAdMobManager.shared.canShowInterstitial(totalRunsCompleted: save.totalRuns) {
            pendingInterstitialCheck = true
        }
    }

    public func checkCrownMilestoneHudNotice() {
        guard DomainConfigs.crownMastery.hudUnlockNotificationOnly,
              permanentProgressEligibility.allowSharkMasteryAndCrown else { return }
        let activeId = activeSharkId
        let prevTier = save.sharkMasteryTiers[activeId] ?? 0
        let seenTier = max(prevTier, announcedCrownTier)
        let config = GameRules.getSharkMasteryConfig(form: activeSharkForm)
        for t in config.tiers where t.tier > seenTier && score >= t.targetScore {
            announcedCrownTier = t.tier
            let title = lang == "zh" ? t.labelZh : t.labelEn
            crownHudToastText = lang == "zh"
                ? "👑 达成 \(title)（结算时发放奖励）"
                : "👑 \(title) UNLOCKED (Paid on Settlement)"
        }
    }

    public func updateTimeDifficulty(elapsedSec: Double) {
        let diffCfg = DomainConfigs.worldAndProgression.timeDifficulty
        guard elapsedSec > 0, diffCfg.intervalSec > 0 else {
            globalDifficultyMultiplier = 1.0
            return
        }
        let steps = floor(elapsedSec / diffCfg.intervalSec)
        let nextMult = min(diffCfg.maxDifficultyMultiplier, 1.0 + steps * diffCfg.ratePerInterval)
        if abs(nextMult - globalDifficultyMultiplier) > 0.0001 {
            globalDifficultyMultiplier = nextMult
        }
    }

    // MARK: - In-Run Skills & Upgrades
    public func triggerGoldFrenzy() {
        let form = activeSharkForm
        let skillCfg = DomainConfigs.economyPredation.activeSkills.goldOverdrive
        let cost = GameRules.getGoldOverdriveCost(useCount: goldOverdriveUseCount, generationRow: form.row)
        guard save.bankedCoins >= cost, (!frenzyActive || !skillCfg.blockWhileFrenzy) else { return }
        save.bankedCoins -= cost
        goldOverdriveUseCount += 1
        frenzyActive = true
        frenzyCooldownRemaining = 0.0
        recomputeCurrentSharkStats()
        frenzyTimer = skillCfg.durationSec + currentStats.frenzyDurationBonus
        let healAmt = (maxHp * skillCfg.healMaxHpPct).rounded()
        hp = min(maxHp, hp + healAmt)
        ghostHpPct = max(0, min(100, (hp / max(1, maxHp)) * 100.0))
        energy = max(energy, min(maxEnergy, maxEnergy * skillCfg.energyRestorePct))
        pendingSkillInvulnSec = max(pendingSkillInvulnSec, skillCfg.invulnDurationSec)
        flushTelemetryImmediate()
        persistSave()
        HapticFeedbackManager.shared.playHeavy(minInterval: 0.08)
        if save.soundEnabled {
            OceanAudioEngine.shared.playFrenzy()
        }
    }

    public func triggerGeneSurge() {
        let form = activeSharkForm
        let skillCfg = DomainConfigs.economyPredation.activeSkills.geneSurge
        let cost = GameRules.getGeneSurgeCost(level: inRunLevel, useCount: geneSurgeUseCount, generationRow: form.row)
        guard save.bankedGenes >= cost else { return }
        save.bankedGenes -= cost
        geneSurgeUseCount += 1
        let bonusXp = Int((Double(xpRequired) * skillCfg.xpGrantRatio).rounded())
        _ = addXp(bonusXp)
        let healAmt = max(Double(skillCfg.healMinFlat), (maxHp * skillCfg.healMaxHpPct).rounded())
        hp = min(maxHp, hp + healAmt)
        energy = max(energy, min(maxEnergy, maxEnergy * skillCfg.energyRestorePct))
        flushTelemetryImmediate()
        persistSave()
        playSuccessSound()
    }

    public func upgradeActiveSharkBody() {
        guard permanentProgressEligibility.allowSharkUnlockAndUpgrade else { return }
        _ = upgradeSharkForm(activeSharkForm)
        if onboardingStep == .HANDS_ON_UPGRADE {
            onboardingHandsOnUpgraded = true
            onboardingStep = .CELEBRATE
            onboardingCelebrationTimer = 3.2
            userDefaults.set(true, forKey: onboardingDoneKey)
        }
    }

    @discardableResult
    public func upgradeSharkForm(_ form: SharkFormConfig) -> Bool {
        guard permanentProgressEligibility.allowSharkUnlockAndUpgrade else { return false }
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
        guard permanentProgressEligibility.allowSharkUnlockAndUpgrade else { return false }
        let check = GameRules.evaluateSharkUnlockForRun(
            form: form,
            save: save,
            runContext: permanentProgressContext
        )
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
        guard permanentProgressEligibility.allowSharkUnlockAndUpgrade else { return }
        guard save.unlockedSharkIds.contains(form.id) else { return }
        save.selectedSharkId = form.id
        trialSharkIdForRun = nil
        recomputeCurrentSharkStats()
        SpriteAtlasManager.shared.prewarmSharkWindow(selectedSharkId: form.id)
        persistSave()
        playUiTick()
    }

    public func evolveToNextReadySharkInRun() {
        guard permanentProgressEligibility.allowSharkUnlockAndUpgrade else { return }
        guard let nextTarget = GameRules.getNextEvolutionTarget(save: save),
              nextTarget.check.canUnlockNow else { return }
        _ = unlockSharkForm(nextTarget.form)
    }

    @discardableResult
    public func addXp(_ amount: Int) -> Bool {
        let lvlCfg = DomainConfigs.worldAndProgression.inRunLevelProgression
        xp += amount
        var leveledUp = false
        while xp >= xpRequired {
            xp -= xpRequired
            inRunLevel += 1
            leveledUp = true
            if GameRules.recordPermanentRunProgress(
                save: &save,
                runContext: permanentProgressContext,
                inRunLevel: inRunLevel,
                maxDepthMeters: Double(runMaxDepth)
            ) {
                persistSave()
            }
            recomputeCurrentSharkStats()
            hp = min(maxHp, hp + maxHp * lvlCfg.levelUpHealMaxHpPct)
            energy = min(maxEnergy, energy + maxEnergy * lvlCfg.levelUpEnergyRestorePct)
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
        userDefaults.set(false, forKey: onboardingDoneKey)
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
        userDefaults.set(true, forKey: onboardingDoneKey)
        onboardingStep = .DONE
        playUiTick()
    }

    // MARK: - Google AdMob Rewarded Video (iOS Native Zero-Simulation)
    public func showRewardedAd(kind: SimRewardedAdKind) {
        if kind == .DOUBLE_SETTLEMENT {
            guard permanentProgressEligibility.allowDoubleSettlementAd,
                  !settlementDoubled,
                  (runCoinsEarned > 0 || runGenesEarned > 0) else {
                return
            }
        } else if kind == .REVIVE {
            guard reviveOffered && !reviveUsedInCurrentRun else {
                return
            }
        }
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
        let placements = DomainConfigs.adsAndMonetization.placements
        switch kind {
        case .REVIVE:
            let cfg = placements.REVIVE
            guard !reviveUsedInCurrentRun else { return }
            resetInputState()
            reviveUsedInCurrentRun = true
            reviveOffered = false
            frenzyActive = true
            frenzyCooldownRemaining = 0.0
            recomputeCurrentSharkStats()
            frenzyTimer = cfg.frenzyDurationSec + currentStats.frenzyDurationBonus
            hp = min(maxHp, max(hp, maxHp * cfg.hpRestorePct))
            ghostHpPct = 100
            energy = min(maxEnergy, max(energy, maxEnergy * cfg.energyRestorePct))
            pendingSkillInvulnSec = max(pendingSkillInvulnSec, cfg.invulnDurationSec)
            flushTelemetryImmediate()
            gameState = "playing"
        case .DOUBLE_SETTLEMENT:
            let cfg = placements.DOUBLE_SETTLEMENT
            guard permanentProgressEligibility.allowDoubleSettlementAd,
                  !settlementDoubled,
                  (runCoinsEarned > 0 || runGenesEarned > 0) else {
                return
            }
            settlementDoubled = true
            let extraFactor = max(0.0, cfg.multiplier - 1.0)
            let bonusCoins = Int((Double(runCoinsEarned) * extraFactor).rounded())
            let bonusGenes = Int((Double(runGenesEarned) * extraFactor).rounded())
            if bonusCoins > 0 {
                save.bankedCoins += bonusCoins
            }
            if bonusGenes > 0 {
                save.bankedGenes += bonusGenes
            }
            persistSave()
        case .SUPPLY_DROP:
            let drop = currentSupplyDropReward
            save.bankedCoins += drop.coins
            save.bankedGenes += drop.genes
            persistSave()
        case .TRIAL_SHARK:
            let showcase = nextShowcaseSharkForm
            startNewRun(trialSharkId: showcase.id)
        }
        playSuccessSound()
    }
}
