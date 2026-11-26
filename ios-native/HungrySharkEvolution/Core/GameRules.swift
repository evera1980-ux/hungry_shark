import Foundation
import CoreGraphics
import simd

public enum PreyMutationVariant: String, Codable, Sendable {
    case NONE
    case GOLDEN_SWARM
    case ABYSS_BEHEMOTH
}

public enum EncounterOutcome: String, Sendable {
    case DEVOUR
    case ARMOR_CRUSH
    case NEED_BOOST
    case DAMAGE
}

public struct ParallaxLayerGrowthScales: Sendable {
    public let growthProgress: Double
    public let waterScale: Double
    public let farScale: Double
    public let midScale: Double
    public let ambientScale: Double
    public let nearScale: Double
    public let particleScale: Double
}

public struct ComputedSharkStats: Sendable {
    public let level: Int
    public let scale: Double
    public let worldScale: Double
    public let relativePreyScale: Double
    public let cameraZoom: Double
    public let maxHp: Double
    public let maxEnergy: Double
    public let moveSpeed: Double
    public let boostSpeed: Double
    public let biteTier: Int
    public let normalBiteTier: Int
    public let hpDrainPerSec: Double
    public let boostDrainPerSec: Double
    public let magnetRadius: Double
    public let devourHealMultiplier: Double
    public let frenzyDurationBonus: Double
    public let jawSuctionMultiplier: Double
    public let scoreMultiplier: Double
    public let coinYieldMultiplier: Double
    public let geneYieldMultiplier: Double
    public let bossRewardMultiplier: Double
    public let specialPreyScoreMultiplier: Double
    public let damageTakenMultiplier: Double
    public let mineDamageTakenMultiplier: Double
    public let knockbackMultiplier: Double
    public let boostRegenMultiplier: Double
    public let killEnergyBonus: Int
    public let maxComboBonus: Double
    public let goldenMutantReduction: Int
    public let canEatMines: Bool
    public let realBodyLengthM: Double
    public let cruiseSpeedMps: Double
    public let boostSpeedMps: Double
    public let viewportScale: Double
    public let minSpawnablePreyLengthM: Double
    public let parallaxScales: ParallaxLayerGrowthScales
}

public struct UnlockCheckResult: Sendable {
    public let isUnlocked: Bool
    public let canUnlockNow: Bool
    public let parentForm: SharkFormConfig?
    public let parentUnlocked: Bool
    public let parentUpgradeLevel: Int
    public let reqParentUpgradeLevel: Int
    public let parentLevelMet: Bool
    public let currentBestInRunLevel: Int
    public let reqMaxInRunLevel: Int
    public let inRunLevelMet: Bool
    public let currentMaxDepth: Double
    public let reqMaxDepth: Double
    public let depthMet: Bool
    public let coinsMet: Bool
    public let genesMet: Bool
}

public struct MasteryRewardTierConfig: Sendable {
    public let tier: Int
    public let labelZh: String
    public let labelEn: String
    public let targetScore: Int
    public let rewardCoins: Int
    public let rewardGenes: Int
}

public struct SharkMasteryConfig: Sendable {
    public let sharkId: String
    public let tiers: [MasteryRewardTierConfig]
}

public struct MasterySettlementResult: Sendable {
    public let sharkId: String
    public let previousBestScore: Int
    public let newBestScore: Int
    public let isNewRecord: Bool
    public let previousMasteryTier: Int
    public let newMasteryTier: Int
    public let newlyClaimedTiers: [MasteryRewardTierConfig]
    public let totalBonusCoins: Int
    public let totalBonusGenes: Int
}

public struct GlobalAtlasBonuses: Sendable {
    public let unlockedCount: Int
    public let totalMasteryCrowns: Int
    public let hpMultiplier: Double
    public let speedBonus: Double
    public let rewardMultiplier: Double
    public let scoreMultiplierBonus: Double
}

public struct HuntingHeatBuff: Sendable {
    public let heatLevel: Int
    public let speedMultiplier: Double
    public let scoreMultiplier: Double
    public let magnetRadiusBonus: Double
    public let energyRegenBonus: Double
    public let labelKey: String
}

public struct PredationSettlementMetrics: Sendable {
    public let hpDelta: Double
    public let xpGain: Int
    public let scoreGain: Int
    public let coinGain: Int
    public let geneGain: Int
    public let failDamage: Double
    public let knockbackForce: Double
    public let floatTextKey: String
    public let isCrit: Bool
}

public struct SharkMetaSaveData: Codable, Sendable {
    public var selectedSharkId: String
    public var unlockedSharkIds: [String]
    public var sharkUpgradeLevels: [String: Int]
    public var sharkBestScores: [String: Int]
    public var sharkMasteryTiers: [String: Int]
    public var bankedCoins: Int
    public var bankedGenes: Int
    public var bestInRunLevel: Int
    public var maxDepthReached: Double
    public var totalRuns: Int
    public var onboardingGiftClaimed: Bool
    public var language: String
    public var soundEnabled: Bool

    public init(
        selectedSharkId: String,
        unlockedSharkIds: [String],
        sharkUpgradeLevels: [String: Int],
        sharkBestScores: [String: Int] = [:],
        sharkMasteryTiers: [String: Int] = [:],
        bankedCoins: Int,
        bankedGenes: Int,
        bestInRunLevel: Int,
        maxDepthReached: Double,
        totalRuns: Int,
        onboardingGiftClaimed: Bool = false,
        language: String,
        soundEnabled: Bool
    ) {
        self.selectedSharkId = selectedSharkId
        self.unlockedSharkIds = unlockedSharkIds
        self.sharkUpgradeLevels = sharkUpgradeLevels
        self.sharkBestScores = sharkBestScores
        self.sharkMasteryTiers = sharkMasteryTiers
        self.bankedCoins = bankedCoins
        self.bankedGenes = bankedGenes
        self.bestInRunLevel = bestInRunLevel
        self.maxDepthReached = maxDepthReached
        self.totalRuns = totalRuns
        self.onboardingGiftClaimed = onboardingGiftClaimed
        self.language = language
        self.soundEnabled = soundEnabled
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let defaults = DomainConfigs.worldAndProgression.starterSaveDefaults
        let decodedSelected = (try? c.decode(String.self, forKey: .selectedSharkId)) ?? defaults.selectedSharkId
        let decodedUnlocked = (try? c.decode([String].self, forKey: .unlockedSharkIds)) ?? defaults.unlockedSharkIds
        let decodedUpgrades = (try? c.decode([String: Int].self, forKey: .sharkUpgradeLevels)) ?? defaults.sharkUpgradeLevels
        let decodedTotalRuns = (try? c.decode(Int.self, forKey: .totalRuns)) ?? defaults.totalRunsPlayed
        self.selectedSharkId = decodedSelected
        self.unlockedSharkIds = decodedUnlocked
        self.sharkUpgradeLevels = decodedUpgrades
        self.sharkBestScores = (try? c.decode([String: Int].self, forKey: .sharkBestScores)) ?? [:]
        self.sharkMasteryTiers = (try? c.decode([String: Int].self, forKey: .sharkMasteryTiers)) ?? [:]
        self.bankedCoins = (try? c.decode(Int.self, forKey: .bankedCoins)) ?? defaults.bankedCoins
        self.bankedGenes = (try? c.decode(Int.self, forKey: .bankedGenes)) ?? defaults.bankedGenes
        self.bestInRunLevel = (try? c.decode(Int.self, forKey: .bestInRunLevel)) ?? defaults.bestInRunLevel
        self.maxDepthReached = (try? c.decode(Double.self, forKey: .maxDepthReached)) ?? Double(defaults.bestDepthReached)
        self.totalRuns = decodedTotalRuns
        if let decodedClaimed = try? c.decode(Bool.self, forKey: .onboardingGiftClaimed) {
            self.onboardingGiftClaimed = decodedClaimed
        } else {
            let legacyOnboardingDone = UserDefaults.standard.bool(forKey: "hungry_shark_onboarding_v2_done")
            self.onboardingGiftClaimed = legacyOnboardingDone
                || decodedTotalRuns > 0
                || decodedUnlocked.count > 1
                || (decodedUpgrades[defaults.selectedSharkId] ?? 1) > 1
        }
        self.language = (try? c.decode(String.self, forKey: .language)) ?? "zh"
        self.soundEnabled = (try? c.decode(Bool.self, forKey: .soundEnabled)) ?? true
    }

    public static func createDefault() -> SharkMetaSaveData {
        let defaults = DomainConfigs.worldAndProgression.starterSaveDefaults
        return SharkMetaSaveData(
            selectedSharkId: defaults.selectedSharkId,
            unlockedSharkIds: defaults.unlockedSharkIds,
            sharkUpgradeLevels: defaults.sharkUpgradeLevels,
            sharkBestScores: [:],
            sharkMasteryTiers: [:],
            bankedCoins: defaults.bankedCoins,
            bankedGenes: defaults.bankedGenes,
            bestInRunLevel: defaults.bestInRunLevel,
            maxDepthReached: Double(defaults.bestDepthReached),
            totalRuns: defaults.totalRunsPlayed,
            onboardingGiftClaimed: defaults.onboardingGiftClaimed,
            language: "zh",
            soundEnabled: true
        )
    }
}

public struct PermanentProgressRunContext: Sendable, Equatable {
    public let isTrial: Bool
    public let activeInRun: Bool
    public let sandboxOrCheatMode: Bool

    public init(isTrial: Bool, activeInRun: Bool = true, sandboxOrCheatMode: Bool = false) {
        self.isTrial = isTrial
        self.activeInRun = activeInRun
        self.sandboxOrCheatMode = sandboxOrCheatMode
    }
}

public struct PermanentProgressEligibility: Sendable, Equatable {
    public let eligible: Bool
    public let allowRunRecords: Bool
    public let allowSharkMasteryAndCrown: Bool
    public let allowSharkUnlockAndUpgrade: Bool
    public let allowAchievements: Bool
    public let allowMissions: Bool
    public let allowEncyclopediaDiscovery: Bool
    public let allowRunCountIncrement: Bool
    public let allowTrialCurrencyCarryOver: Bool
    public let allowDoubleSettlementAd: Bool
}

public enum GameRules {
    /// Unified permanent-progress eligibility gate matching Web `isEligibleForPermanentProgress`.
    /// Approved policy (D1 + D2):
    /// - Trial currency from pickups/bounty is kept (allowTrialCurrencyCarryOver = true).
    /// - Trial double-settlement ad and ALL permanent progression mutations/records are strictly blocked.
    public static func isEligibleForPermanentProgress(_ runContext: PermanentProgressRunContext) -> Bool {
        return !runContext.isTrial && !runContext.sandboxOrCheatMode
    }

    public static func getPermanentProgressEligibility(_ runContext: PermanentProgressRunContext) -> PermanentProgressEligibility {
        let eligible = isEligibleForPermanentProgress(runContext)
        return PermanentProgressEligibility(
            eligible: eligible,
            allowRunRecords: eligible,
            allowSharkMasteryAndCrown: eligible,
            allowSharkUnlockAndUpgrade: eligible || !runContext.activeInRun,
            allowAchievements: eligible,
            allowMissions: eligible,
            allowEncyclopediaDiscovery: eligible,
            allowRunCountIncrement: eligible,
            allowTrialCurrencyCarryOver: !runContext.sandboxOrCheatMode,
            allowDoubleSettlementAd: eligible
        )
    }

    @discardableResult
    public static func recordFormalRunStarted(runContext: PermanentProgressRunContext, save: inout SharkMetaSaveData) -> Bool {
        let eligibility = getPermanentProgressEligibility(runContext)
        guard eligibility.allowRunCountIncrement else { return false }
        save.totalRuns += 1
        return true
    }

    @discardableResult
    public static func recordPermanentRunProgress(
        save: inout SharkMetaSaveData,
        runContext: PermanentProgressRunContext,
        inRunLevel: Int,
        maxDepthMeters: Double
    ) -> Bool {
        let eligibility = getPermanentProgressEligibility(runContext)
        guard eligibility.allowRunRecords else { return false }
        var changed = false
        if inRunLevel > save.bestInRunLevel {
            save.bestInRunLevel = inRunLevel
            changed = true
        }
        if maxDepthMeters > save.maxDepthReached {
            save.maxDepthReached = maxDepthMeters
            changed = true
        }
        return changed
    }

    @discardableResult
    public static func claimOnboardingStarterTopUp(save: inout SharkMetaSaveData) -> Bool {
        guard !save.onboardingGiftClaimed else { return false }
        save.onboardingGiftClaimed = true
        // Anchor starter top-up strictly to Lv.1 starter shark cost (22C), never high-tier active shark cost
        if let starterForm = GameConfigGenerated.sharkForms.first {
            let firstCost = getSharkUpgradeCoinCost(form: starterForm, currentLevel: 1)
            if save.bankedCoins < firstCost {
                save.bankedCoins = firstCost
            }
        }
        return true
    }

    public static var sharkBaseDrawSize: Double {
        DomainConfigs.worldAndProgression.world.sharkBaseDrawSizeIos
    }
    public static var preyRadiusToDrawSize: Double {
        DomainConfigs.worldAndProgression.world.preyRadiusToDrawSize
    }
    public static var sharkEquivalentRadius: Double {
        sharkBaseDrawSize / max(1.0, preyRadiusToDrawSize)
    }
    public static var defaultPreySizeMultiplier: Double {
        DomainConfigs.worldAndProgression.world.defaultPreySizeMultiplier
    }
    /// True 2D camera zoom lower bound at 45m+ Leviathan tier (1:1 parity with Web CAMERA_ZOOM_MIN)
    public static var cameraZoomMin: Double {
        DomainConfigs.worldAndProgression.world.cameraZoomMin
    }
    /// Hard safety floor for render zoom projection
    public static var minRenderZoomFloor: Double {
        DomainConfigs.worldAndProgression.world.minRenderZoomFloor
    }

    /// Computes true 2D camera zoom from shark's real body length (0.8m -> 1.00, 45m+ -> 0.22)
    public static func computeTrueCameraZoom(realBodyLengthM: Double) -> Double {
        let safeLen = realBodyLengthM.isFinite ? max(0.8, realBodyLengthM) : 0.8
        let t = max(0.0, min(1.0, log(safeLen / 0.8) / log(45.0 / 0.8)))
        let zoom = cameraZoomMin + (1.0 - cameraZoomMin) * pow(1.0 - t, 1.35)
        return (zoom * 1000.0).rounded() / 1000.0
    }

    /// XP required to advance from `level` to `level + 1` (matches shared/configs/world_and_progression_config.json)
    public static func getXpRequiredForLevel(_ level: Int) -> Int {
        let xpCfg = DomainConfigs.worldAndProgression.inRunLevelProgression.xpCurve
        if level <= 1 { return Int(xpCfg.base.rounded()) }
        let l = Double(level - 1)
        return Int((xpCfg.base + l * xpCfg.linearStep + pow(l, xpCfg.exponent) * xpCfg.powerStep).rounded())
    }

    /// Dynamic Gold Frenzy cost (loaded from shared/configs/economy_predation_config.json)
    public static func getGoldOverdriveCost(useCount: Int, generationRow: Int) -> Int {
        let cfg = DomainConfigs.economyPredation.activeSkills.goldOverdrive
        let n = Double(max(0, useCount))
        let rowMult = 1.0 + Double(max(0, generationRow)) * cfg.rowScale
        return Int(((cfg.baseCost + n * cfg.useLinear + n * n * cfg.useQuad) * rowMult).rounded())
    }

    /// Dynamic Gene Surge cost (loaded from shared/configs/economy_predation_config.json)
    public static func getGeneSurgeCost(level: Int, useCount: Int, generationRow: Int) -> Int {
        let cfg = DomainConfigs.economyPredation.activeSkills.geneSurge
        let lv = Double(max(1, level))
        let n = Double(max(0, useCount))
        let rowMult = 1.0 + Double(max(0, generationRow)) * cfg.rowScale
        return Int(((cfg.baseCost + (lv - 1.0) * cfg.levelLinear + n * cfg.useLinear + n * n * cfg.useQuad) * rowMult).rounded())
    }

    /// Body upgrade coin cost (Lv.1 -> Lv.10)
    public static func getSharkUpgradeCoinCost(form: SharkFormConfig, currentLevel: Int) -> Int {
        let cfg = DomainConfigs.worldAndProgression.upgradeProgression
        let lv = max(1, min(cfg.maxUpgradeLevel - 1, currentLevel))
        return Int((Double(form.baseUpgradeCoinCost) * pow(cfg.coinCostExponent, Double(lv - 1))).rounded())
    }

    /// Body upgrade gene cost (only at Bite Tier breakthrough gates Lv.4->5 and Lv.9->10)
    public static func getSharkUpgradeGeneCost(form: SharkFormConfig, currentLevel: Int) -> Int {
        let cfg = DomainConfigs.worldAndProgression.upgradeProgression
        let refGenes = Double(max(cfg.geneUnlockMinRef, form.unlockGenes))
        if currentLevel == 4 {
            return Int((refGenes * cfg.geneCostGateLv4.refMult + cfg.geneCostGateLv4.flatBonus).rounded())
        }
        if currentLevel == 9 {
            return Int((refGenes * cfg.geneCostGateLv9.refMult + cfg.geneCostGateLv9.flatBonus).rounded())
        }
        return 0
    }

    /// Returns linear (`index - 1`) and vertical (`(row - 1) * 8 + col`) parent shark candidates
    public static func getParentCandidatesForForm(_ form: SharkFormConfig) -> [SharkFormConfig] {
        guard form.index > 0 else { return [] }
        let upgCfg = DomainConfigs.worldAndProgression.upgradeProgression
        var candidates: [SharkFormConfig] = [GameConfigGenerated.sharkForms[form.index - 1]]
        if upgCfg.allowVerticalParentUnlock && form.row > 0 {
            let verticalIdx = (form.row - 1) * 8 + form.col
            if verticalIdx >= 0 && verticalIdx < GameConfigGenerated.sharkForms.count && verticalIdx != form.index - 1 {
                candidates.append(GameConfigGenerated.sharkForms[verticalIdx])
            }
        }
        return candidates
    }

    /// Evaluates whether a shark form can be unlocked right now
    public static func evaluateSharkUnlock(form: SharkFormConfig, save: SharkMetaSaveData) -> UnlockCheckResult {
        let isUnlocked = save.unlockedSharkIds.contains(form.id)
        let parents = getParentCandidatesForForm(form)
        var parentForm: SharkFormConfig? = parents.first
        var parentUnlocked = form.index == 0
        var parentUpgradeLevel = form.index == 0 ? DomainConfigs.worldAndProgression.upgradeProgression.maxUpgradeLevel : 0
        var parentLevelMet = form.index == 0

        if !parents.isEmpty {
            var bestRank = -1
            for p in parents {
                let pUnlocked = save.unlockedSharkIds.contains(p.id)
                let pLv = pUnlocked ? (save.sharkUpgradeLevels[p.id] ?? 1) : 0
                let rank = pUnlocked ? (100 + pLv) : pLv
                if rank > bestRank {
                    bestRank = rank
                    parentForm = p
                    parentUnlocked = pUnlocked
                    parentUpgradeLevel = pLv
                }
                if pUnlocked && pLv >= form.reqParentUpgradeLevel {
                    parentLevelMet = true
                }
            }
            if parentLevelMet, let qualifiedParent = parents.first(where: {
                save.unlockedSharkIds.contains($0.id) && (save.sharkUpgradeLevels[$0.id] ?? 1) >= form.reqParentUpgradeLevel
            }) {
                parentForm = qualifiedParent
                parentUnlocked = true
                parentUpgradeLevel = save.sharkUpgradeLevels[qualifiedParent.id] ?? 1
            }
        }

        let inRunLevelMet = save.bestInRunLevel >= form.reqMaxInRunLevel
        let depthMet = save.maxDepthReached >= form.reqMaxDepth
        let coinsMet = save.bankedCoins >= form.unlockCoins
        let genesMet = save.bankedGenes >= form.unlockGenes

        let canUnlockNow = !isUnlocked && parentUnlocked && parentLevelMet && inRunLevelMet && depthMet && coinsMet && genesMet

        return UnlockCheckResult(
            isUnlocked: isUnlocked,
            canUnlockNow: canUnlockNow,
            parentForm: parentForm,
            parentUnlocked: parentUnlocked,
            parentUpgradeLevel: parentUpgradeLevel,
            reqParentUpgradeLevel: form.reqParentUpgradeLevel,
            parentLevelMet: parentLevelMet,
            currentBestInRunLevel: save.bestInRunLevel,
            reqMaxInRunLevel: form.reqMaxInRunLevel,
            inRunLevelMet: inRunLevelMet,
            currentMaxDepth: save.maxDepthReached,
            reqMaxDepth: form.reqMaxDepth,
            depthMet: depthMet,
            coinsMet: coinsMet,
            genesMet: genesMet
        )
    }

    public static func evaluateSharkUnlockForRun(
        form: SharkFormConfig,
        save: SharkMetaSaveData,
        runContext: PermanentProgressRunContext
    ) -> UnlockCheckResult {
        let base = evaluateSharkUnlock(form: form, save: save)
        let eligibility = getPermanentProgressEligibility(runContext)
        guard eligibility.allowSharkUnlockAndUpgrade else {
            return UnlockCheckResult(
                isUnlocked: base.isUnlocked,
                canUnlockNow: false,
                parentForm: base.parentForm,
                parentUnlocked: base.parentUnlocked,
                parentUpgradeLevel: base.parentUpgradeLevel,
                reqParentUpgradeLevel: base.reqParentUpgradeLevel,
                parentLevelMet: base.parentLevelMet,
                currentBestInRunLevel: base.currentBestInRunLevel,
                reqMaxInRunLevel: base.reqMaxInRunLevel,
                inRunLevelMet: base.inRunLevelMet,
                currentMaxDepth: base.currentMaxDepth,
                reqMaxDepth: base.reqMaxDepth,
                depthMet: base.depthMet,
                coinsMet: base.coinsMet,
                genesMet: base.genesMet
            )
        }
        return base
    }

    /// Returns the immediate next locked shark form in the 48-shark chain (or nil if all 48 are unlocked)
    public static func getNextEvolutionTarget(save: SharkMetaSaveData) -> (form: SharkFormConfig, check: UnlockCheckResult)? {
        for form in GameConfigGenerated.sharkForms {
            if !save.unlockedSharkIds.contains(form.id) {
                return (form, evaluateSharkUnlock(form: form, save: save))
            }
        }
        return nil
    }

    /// Loads 3-tier score mastery milestones & one-time crown rewards from shared/configs/crown_mastery_config.json
    public static func getSharkMasteryConfig(form: SharkFormConfig) -> SharkMasteryConfig {
        let entries = DomainConfigs.crownBySharkId[form.id]
            ?? DomainConfigs.crownMastery.sharks.first?.tiers
            ?? []
        return SharkMasteryConfig(
            sharkId: form.id,
            tiers: entries.map { entry in
                MasteryRewardTierConfig(
                    tier: entry.tier,
                    labelZh: entry.nameZh,
                    labelEn: entry.nameEn,
                    targetScore: entry.scoreThreshold,
                    rewardCoins: entry.coinReward,
                    rewardGenes: entry.geneReward
                )
            }
        )
    }

    /// Evaluates a completed run's score against the active shark's mastery milestones.
    /// Enforces `isEligibleForPermanentProgress(runContext)` & `allowInTrial` so Trial runs NEVER claim crowns or overwrite personal bests.
    public static func settleSharkScoreMastery(
        sharkId: String,
        runScore: Int,
        save: SharkMetaSaveData,
        runContext: PermanentProgressRunContext = PermanentProgressRunContext(isTrial: false)
    ) -> MasterySettlementResult {
        let form = GameConfigGenerated.sharkForms.first(where: { $0.id == sharkId }) ?? GameConfigGenerated.sharkForms[0]
        let config = getSharkMasteryConfig(form: form)
        let prevBest = save.sharkBestScores[sharkId] ?? 0
        let prevTier = save.sharkMasteryTiers[sharkId] ?? 0
        let trialBlocked = runContext.isTrial && !DomainConfigs.crownMastery.allowInTrial

        guard isEligibleForPermanentProgress(runContext) && !trialBlocked else {
            return MasterySettlementResult(
                sharkId: sharkId,
                previousBestScore: prevBest,
                newBestScore: prevBest,
                isNewRecord: false,
                previousMasteryTier: prevTier,
                newMasteryTier: prevTier,
                newlyClaimedTiers: [],
                totalBonusCoins: 0,
                totalBonusGenes: 0
            )
        }

        let cleanScore = max(0, runScore)
        let newBest = max(prevBest, cleanScore)
        let isNewRecord = cleanScore > prevBest && cleanScore > 0

        var newTier = prevTier
        var newlyClaimedTiers: [MasteryRewardTierConfig] = []
        var totalBonusCoins = 0
        var totalBonusGenes = 0

        for tConfig in config.tiers {
            if newBest >= tConfig.targetScore && tConfig.tier > prevTier {
                newTier = max(newTier, tConfig.tier)
                newlyClaimedTiers.append(tConfig)
                totalBonusCoins += tConfig.rewardCoins
                totalBonusGenes += tConfig.rewardGenes
            }
        }

        return MasterySettlementResult(
            sharkId: sharkId,
            previousBestScore: prevBest,
            newBestScore: newBest,
            isNewRecord: isNewRecord,
            previousMasteryTier: prevTier,
            newMasteryTier: newTier,
            newlyClaimedTiers: newlyClaimedTiers,
            totalBonusCoins: totalBonusCoins,
            totalBonusGenes: totalBonusGenes
        )
    }

    /// Computes global collection & mastery crown bonuses across all 48 sharks from shared/configs/world_and_progression_config.json
    public static func getGlobalAtlasBonuses(save: SharkMetaSaveData) -> GlobalAtlasBonuses {
        let atlasCfg = DomainConfigs.worldAndProgression.atlasPassives
        let unlockedCount = max(1, save.unlockedSharkIds.count)
        let extraUnlocked = Double(max(0, unlockedCount - 1))
        let totalMasteryCrowns = save.sharkMasteryTiers.values.reduce(0) { $0 + max(0, min(3, $1)) }
        let crowns = Double(totalMasteryCrowns)

        return GlobalAtlasBonuses(
            unlockedCount: unlockedCount,
            totalMasteryCrowns: totalMasteryCrowns,
            hpMultiplier: 1.0 + extraUnlocked * atlasCfg.extraSharkHpBonusPerShark + crowns * atlasCfg.crownHpBonusPerCrown,
            speedBonus: extraUnlocked * atlasCfg.extraSharkSpeedBonusPerShark,
            rewardMultiplier: 1.0 + extraUnlocked * atlasCfg.extraSharkRewardBonusPerShark + crowns * atlasCfg.crownRewardBonusPerCrown,
            scoreMultiplierBonus: crowns * atlasCfg.crownScoreBonusPerCrown
        )
    }

    /// Computes Hunting Heat streak buff from combo count (read from shared/configs/economy_predation_config.json)
    public static func computeHuntingHeatBuff(comboCount: Int) -> HuntingHeatBuff {
        let cleanCombo = max(0, comboCount)
        let tiers = DomainConfigs.economyPredation.huntingHeatTiers.tiers
        var active = tiers[0]
        for tier in tiers {
            if cleanCombo >= tier.minCombo {
                active = tier
            }
        }
        return HuntingHeatBuff(
            heatLevel: active.level,
            speedMultiplier: 1.0,
            scoreMultiplier: active.scoreMult,
            magnetRadiusBonus: active.magnetBonus,
            energyRegenBonus: active.energyRegenPerSec,
            labelKey: "hud_heat_lv\(min(3, active.level))"
        )
    }

    /// Optical Far / Mid / Near background shrinking ratios driven by true camera zoom (`cameraZoom`: 1.00 -> 0.22)
    public static func getParallaxLayerGrowthScalesFromZoom(cameraZoom: Double) -> ParallaxLayerGrowthScales {
        let clampedZoom = max(cameraZoomMin, min(1.0, cameraZoom.isFinite ? cameraZoom : 1.0))
        let growthProgress = min(1.0, max(0.0, (1.0 - clampedZoom) / (1.0 - cameraZoomMin)))
        return ParallaxLayerGrowthScales(
            growthProgress: growthProgress,
            waterScale: 1.0 - growthProgress * 0.09,
            farScale: 1.0 - growthProgress * 0.132,
            midScale: 1.0 - growthProgress * 0.27,
            ambientScale: 1.0 - growthProgress * 0.33,
            nearScale: 1.0 - growthProgress * 0.42,
            particleScale: 1.0 - growthProgress * 0.27
        )
    }

    /// Legacy relativePreyScale wrapper (retained for compatibility)
    public static func getParallaxLayerGrowthScales(relativePreyScale: Double) -> ParallaxLayerGrowthScales {
        let clampedRel = max(0.015, min(1.0, relativePreyScale.isFinite ? relativePreyScale : 1.0))
        let growthProgress = min(1.0, max(0.0, (1.0 - clampedRel) / (1.0 - 0.015)))
        return ParallaxLayerGrowthScales(
            growthProgress: growthProgress,
            waterScale: 1.0 - growthProgress * 0.09,
            farScale: 1.0 - growthProgress * 0.132,
            midScale: 1.0 - growthProgress * 0.27,
            ambientScale: 1.0 - growthProgress * 0.33,
            nearScale: 1.0 - growthProgress * 0.42,
            particleScale: 1.0 - growthProgress * 0.27
        )
    }

    public struct BiomePlaneTransitionMetrics: Sendable {
        public let waterAlpha: Double
        public let farAlpha: Double
        public let midAlpha: Double
        public let nearAlpha: Double
        public let farWeight: Double
        public let midWeight: Double
        public let nearWeight: Double
        public let farTransitionOffsetY: Double
        public let midTransitionOffsetY: Double
        public let nearTransitionOffsetY: Double
    }

    public struct ParallaxBiomeTransitionState: Sendable {
        public let shallow: BiomePlaneTransitionMetrics
        public let twilight: BiomePlaneTransitionMetrics
        public let abyss: BiomePlaneTransitionMetrics
        public let particleShallowWeight: Double
        public let particleTwilightWeight: Double
        public let particleAbyssWeight: Double
    }

    /// C2-continuous 5th-order Perlin smoothstep 6t^5 - 15t^4 + 10t^3 with zero 1st & 2nd derivatives at endpoints
    public static func quinticSmoothstep(edge0: Double, edge1: Double, x: Double) -> Double {
        guard x.isFinite else { return 0.0 }
        let span = max(1e-6, edge1 - edge0)
        let t = max(0.0, min(1.0, (x - edge0) / span))
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
    }

    public static func quinticSmoothstep(_ edge0: Double, _ edge1: Double, _ x: Double) -> Double {
        return quinticSmoothstep(edge0: edge0, edge1: edge1, x: x)
    }

    private static func compensateUnderLayerAlpha(_ rawWeight: Double) -> Double {
        if rawWeight <= 0.0001 { return 0.0 }
        if rawWeight >= 0.9999 { return 1.0 }
        return min(1.0, pow(rawWeight, 0.62))
    }

    // Piecewise Ocean Depth Conversion (World Y pixels <-> Real Ocean Meters)
    public static let depthStops: [(worldY: Double, meters: Double)] = [
        (0.0, 0.0),
        (2000.0, 200.0),
        (6000.0, 1000.0),
        (10000.0, 4000.0),
        (16000.0, 6000.0),
        (20000.0, 11000.0)
    ]

    public static func worldYToMeterDepth(_ worldY: Double) -> Double {
        let y = max(0.0, worldY)
        for i in 0..<(depthStops.count - 1) {
            let s0 = depthStops[i]
            let s1 = depthStops[i + 1]
            if y <= s1.worldY {
                let t = (y - s0.worldY) / (s1.worldY - s0.worldY)
                return (s0.meters + t * (s1.meters - s0.meters)).rounded()
            }
        }
        let last = depthStops[depthStops.count - 1]
        let prev = depthStops[depthStops.count - 2]
        let rate = (last.meters - prev.meters) / (last.worldY - prev.worldY)
        return (last.meters + (y - last.worldY) * rate).rounded()
    }

    public static func meterDepthToWorldY(_ depthMeters: Double) -> Double {
        let m = max(0.0, depthMeters)
        for i in 0..<(depthStops.count - 1) {
            let s0 = depthStops[i]
            let s1 = depthStops[i + 1]
            if m <= s1.meters {
                let t = (m - s0.meters) / (s1.meters - s0.meters)
                return (s0.worldY + t * (s1.worldY - s0.worldY)).rounded()
            }
        }
        let last = depthStops[depthStops.count - 1]
        let prev = depthStops[depthStops.count - 2]
        let rate = (last.worldY - prev.worldY) / (last.meters - prev.meters)
        return (last.worldY + (m - last.meters) * rate).rounded()
    }

    /// Staggered per-plane C2-smooth biome transition state (1:1 parity with Web src/game/rules.ts)
    public static func computeParallaxBiomeTransitionState(depthMeters: Double) -> ParallaxBiomeTransitionState {
        let d = depthMeters.isFinite ? max(0.0, depthMeters) : 0.0

        let t01Water = quinticSmoothstep(edge0: 280.0, edge1: 760.0, x: d)
        let t01Far = quinticSmoothstep(edge0: 330.0, edge1: 740.0, x: d)
        let t01Mid = quinticSmoothstep(edge0: 390.0, edge1: 720.0, x: d)
        let t01Near = quinticSmoothstep(edge0: 440.0, edge1: 700.0, x: d)

        let t12Water = quinticSmoothstep(edge0: 880.0, edge1: 1420.0, x: d)
        let t12Far = quinticSmoothstep(edge0: 930.0, edge1: 1400.0, x: d)
        let t12Mid = quinticSmoothstep(edge0: 990.0, edge1: 1380.0, x: d)
        let t12Near = quinticSmoothstep(edge0: 1040.0, edge1: 1360.0, x: d)

        let w0Far = 1.0 - t01Far
        let w0Mid = 1.0 - t01Mid
        let w0Near = 1.0 - t01Near

        let w1Far = t01Far * (1.0 - t12Far)
        let w1Mid = t01Mid * (1.0 - t12Mid)
        let w1Near = t01Near * (1.0 - t12Near)

        let alpha1Far = t12Far > 0.0001 ? t01Far * compensateUnderLayerAlpha(1.0 - t12Far) : t01Far
        let alpha1Mid = t12Mid > 0.0001 ? t01Mid * compensateUnderLayerAlpha(1.0 - t12Mid) : t01Mid
        let alpha1Near = t12Near > 0.0001 ? t01Near * compensateUnderLayerAlpha(1.0 - t12Near) : t01Near

        let w2Far = t12Far
        let w2Mid = t12Mid
        let w2Near = t12Near

        let p01 = quinticSmoothstep(edge0: 360.0, edge1: 680.0, x: d)
        let p12 = quinticSmoothstep(edge0: 980.0, edge1: 1320.0, x: d)
        let particleShallowWeight = 1.0 - p01
        let particleTwilightWeight = p01 * (1.0 - p12)
        let particleAbyssWeight = p12

        return ParallaxBiomeTransitionState(
            shallow: BiomePlaneTransitionMetrics(
                waterAlpha: (1.0 - t01Water) * 0.92,
                farAlpha: compensateUnderLayerAlpha(w0Far) * 0.94,
                midAlpha: compensateUnderLayerAlpha(w0Mid),
                nearAlpha: compensateUnderLayerAlpha(w0Near),
                farWeight: w0Far,
                midWeight: w0Mid,
                nearWeight: w0Near,
                farTransitionOffsetY: t01Far * 14.0,
                midTransitionOffsetY: t01Mid * 24.0,
                nearTransitionOffsetY: t01Near * 36.0
            ),
            twilight: BiomePlaneTransitionMetrics(
                waterAlpha: t01Water * (1.0 - t12Water) * 0.46,
                farAlpha: alpha1Far * 0.94,
                midAlpha: alpha1Mid,
                nearAlpha: alpha1Near,
                farWeight: w1Far,
                midWeight: w1Mid,
                nearWeight: w1Near,
                farTransitionOffsetY: (1.0 - t01Far) * 18.0 + t12Far * 14.0,
                midTransitionOffsetY: (1.0 - t01Mid) * 32.0 + t12Mid * 24.0,
                nearTransitionOffsetY: (1.0 - t01Near) * 48.0 + t12Near * 36.0
            ),
            abyss: BiomePlaneTransitionMetrics(
                waterAlpha: t12Water * 0.52,
                farAlpha: w2Far * 0.94,
                midAlpha: w2Mid,
                nearAlpha: w2Near,
                farWeight: w2Far,
                midWeight: w2Mid,
                nearWeight: w2Near,
                farTransitionOffsetY: (1.0 - t12Far) * 20.0,
                midTransitionOffsetY: (1.0 - t12Mid) * 36.0,
                nearTransitionOffsetY: (1.0 - t12Near) * 54.0
            ),
            particleShallowWeight: particleShallowWeight,
            particleTwilightWeight: particleTwilightWeight,
            particleAbyssWeight: particleAbyssWeight
        )
    }

    /// Computes evolved shark stats for any of the 48 shark forms from DomainConfigs
    public static func computeEvolvedSharkStats(
        inRunLevel: Int,
        sharkFormId: String,
        upgradeLevel: Int = 1,
        frenzyActive: Bool = false,
        globalDifficultyMultiplier: Double = 1.0,
        unlockedCount: Int = 1,
        totalCrownCount: Int = 0
    ) -> ComputedSharkStats {
        let form = GameConfigGenerated.sharkForms.first(where: { $0.id == sharkFormId })
            ?? GameConfigGenerated.sharkForms[0]
        let worldCfg = DomainConfigs.worldAndProgression.world
        let upgCfg = DomainConfigs.worldAndProgression.upgradeProgression
        let lvlCfg = DomainConfigs.worldAndProgression.inRunLevelProgression
        let atlasCfg = DomainConfigs.worldAndProgression.atlasPassives
        let diffCfg = DomainConfigs.worldAndProgression.timeDifficulty
        let frenzyCfg = DomainConfigs.economyPredation.frenzy
        let linPassive = DomainConfigs.worldAndProgression.lineagePassives[form.lineage.rawValue]
        let traits = DomainConfigs.sharkTraitsById[form.id] ?? DomainConfigs.defaultTraits()

        let upLv = max(1, min(upgCfg.maxUpgradeLevel, upgradeLevel))
        let extraUnlocked = Double(max(0, unlockedCount - 1))
        let cleanCrowns = Double(max(0, totalCrownCount))

        let collectionHpMult = 1.0 + extraUnlocked * atlasCfg.extraSharkHpBonusPerShark + cleanCrowns * atlasCfg.crownHpBonusPerCrown
        let collectionSpeedBonus = extraUnlocked * atlasCfg.extraSharkSpeedBonusPerShark
        let collectionScoreMult = 1.0 + cleanCrowns * atlasCfg.crownScoreBonusPerCrown
        let collectionRewardMult = 1.0 + extraUnlocked * atlasCfg.extraSharkRewardBonusPerShark + cleanCrowns * atlasCfg.crownRewardBonusPerCrown

        let upgradeHpMult = 1.0 + Double(upLv - 1) * upgCfg.hpMultPerUpgradeLevel
        let upgradeSpeedBonus = Double(upLv - 1) * upgCfg.speedPerUpgradeLevel
        let upgradeDrainRed = Double(upLv - 1) * upgCfg.hpDrainReductionPerUpgradeLevel
        let upgradeBoostRed = Double(upLv - 1) * upgCfg.boostCostReductionPerUpgradeLevel

        var upgradeBiteBonus = 0
        var hpBreakthroughBonusPct = 0.0
        for node in upgCfg.biteTierNodes where upLv >= node.minUpgradeLevel {
            upgradeBiteBonus = max(upgradeBiteBonus, node.bonusTier)
            hpBreakthroughBonusPct = max(hpBreakthroughBonusPct, node.hpBreakthroughBonusPct)
        }

        var inRunBiteBonus = 0
        for node in lvlCfg.biteTierNodes where inRunLevel >= node.minLevel {
            inRunBiteBonus = max(inRunBiteBonus, node.bonusTier)
        }

        let genMaxBiteTier = min(upgCfg.maxBiteTier, form.baseBiteTier + upgCfg.maxBiteTierBonusOverBase)
        let rawBiteTier = min(genMaxBiteTier, form.baseBiteTier + upgradeBiteBonus + inRunBiteBonus)
        let normalBiteTier = min(upgCfg.maxBiteTier, rawBiteTier)
        let biteTier = frenzyActive ? upgCfg.maxBiteTier : normalBiteTier

        let scale = min(
            1.28,
            1.0 + Double(inRunLevel - 1) * lvlCfg.scalePerLevel + Double(form.row) * 0.025 + Double(upLv - 1) * 0.006
        )
        let realBodyLengthM = form.realBodyLengthM * (1.0 + Double(inRunLevel - 1) * 0.025)
        let relativePreyScale = max(0.015, min(1.0, 0.8 / realBodyLengthM))
        let cameraZoom = computeTrueCameraZoom(realBodyLengthM: realBodyLengthM)
        let worldScale = ((scale / cameraZoom) * 1000.0).rounded() / 1000.0

        let hpDrainReduction = min(0.58, form.hpDrainReduction + upgradeDrainRed)
        let boostCostReduction = min(0.68, form.boostCostReduction + upgradeBoostRed)

        let totalSpeedBonus = form.speedBonus + upgradeSpeedBonus + collectionSpeedBonus + Double(inRunLevel - 1) * lvlCfg.speedPerLevel
        let lengthGrowthFactor = pow(realBodyLengthM / 0.8, 0.08)
        let baseSpeed = worldCfg.baseSharkSpeed * lengthGrowthFactor * (1.0 + totalSpeedBonus)
        let moveSpeed = frenzyActive ? baseSpeed * 1.35 : baseSpeed
        let boostSpeed = moveSpeed * worldCfg.boostSpeedMultiplier

        let metabolicBaseDrain = (worldCfg.baseHpDrainPerSec + Double(inRunLevel - 1) * lvlCfg.hpDrainGrowthPerLevel)
            * (1.0 + max(0.0, globalDifficultyMultiplier - 1.0) * diffCfg.hpDrainScalingFactor)
        let hpDrainPerSec = frenzyActive ? 0.0 : metabolicBaseDrain * (1.0 - hpDrainReduction)
        let boostDrainPerSec = frenzyActive ? 0.0 : worldCfg.baseBoostDrainPerSec * (1.0 - boostCostReduction)

        let magnetRadius = (worldCfg.baseMagnetRadius + form.magnetBonus + Double(upLv - 1) * upgCfg.magnetPerUpgradeLevel + Double(inRunLevel - 1) * lvlCfg.magnetPerLevel)
            * (frenzyActive ? frenzyCfg.magnetMultiplier : 1.0)
        let maxHp = ((form.baseHp + Double(inRunLevel - 1) * lvlCfg.hpPerLevelFlat) * upgradeHpMult * collectionHpMult * (1.0 + hpBreakthroughBonusPct)).rounded()
        let maxEnergy = (form.baseEnergy + Double(upLv - 1) * upgCfg.energyFlatPerUpgradeLevel + Double(inRunLevel - 1) * lvlCfg.energyPerLevelFlat).rounded()

        let frenzyDurationBonus = (linPassive?.frenzyDurationBonus ?? 0.0) + traits.frenzyDurationBonus
        let jawSuctionMultiplier = max(linPassive?.jawSuctionMult ?? 1.0, traits.jawSuctionMult)
        let baseRewardMult = collectionRewardMult * (1.0 + Double(form.row) * upgCfg.rowYieldCoinBaseStep)
        let coinYieldMultiplier = baseRewardMult * traits.coinYieldTraitMult
        let geneYieldMultiplier = baseRewardMult * (linPassive?.geneYieldMult ?? 1.0) * traits.geneYieldTraitMult
        let scoreMultiplier = form.scoreMult * collectionScoreMult

        let cruiseSpeedMps = form.cruiseSpeedMps * (1.0 + totalSpeedBonus)
        let boostSpeedMps = cruiseSpeedMps * (frenzyActive ? 2.6 : 2.2)
        let viewportScale = (120.0 * scale) / realBodyLengthM
        let minSpawnablePreyLengthM = realBodyLengthM * worldCfg.minSpawnablePreyLengthRatio

        return ComputedSharkStats(
            level: inRunLevel,
            scale: scale,
            worldScale: worldScale,
            relativePreyScale: relativePreyScale,
            cameraZoom: cameraZoom,
            maxHp: maxHp,
            maxEnergy: maxEnergy,
            moveSpeed: moveSpeed,
            boostSpeed: boostSpeed,
            biteTier: biteTier,
            normalBiteTier: normalBiteTier,
            hpDrainPerSec: hpDrainPerSec,
            boostDrainPerSec: boostDrainPerSec,
            magnetRadius: magnetRadius,
            devourHealMultiplier: form.devourHealMult,
            frenzyDurationBonus: frenzyDurationBonus,
            jawSuctionMultiplier: jawSuctionMultiplier,
            scoreMultiplier: scoreMultiplier,
            coinYieldMultiplier: coinYieldMultiplier,
            geneYieldMultiplier: geneYieldMultiplier,
            bossRewardMultiplier: traits.bossRewardMult,
            specialPreyScoreMultiplier: traits.specialPreyScoreMult,
            damageTakenMultiplier: traits.damageTakenMult,
            mineDamageTakenMultiplier: traits.mineDamageTakenMult,
            knockbackMultiplier: traits.knockbackMult,
            boostRegenMultiplier: traits.boostRegenMult,
            killEnergyBonus: traits.killEnergyBonus,
            maxComboBonus: traits.maxComboBonus,
            goldenMutantReduction: traits.goldenMutantReduction,
            canEatMines: traits.canEatMines,
            realBodyLengthM: realBodyLengthM,
            cruiseSpeedMps: cruiseSpeedMps,
            boostSpeedMps: boostSpeedMps,
            viewportScale: viewportScale,
            minSpawnablePreyLengthM: minSpawnablePreyLengthM,
            parallaxScales: getParallaxLayerGrowthScalesFromZoom(cameraZoom: cameraZoom)
        )
    }

    /// 100% 真实尺寸物理比例：在统一世界坐标系中以 `sharkStats.worldScale` 为基准严格保持 (preyLengthM / sharkLengthM) 线性比例
    public static func getPreyRelativeVisualScale(
        prey: PreyTierConfig,
        sharkStats: ComputedSharkStats,
        mutationVariant: PreyMutationVariant = .NONE
    ) -> Double {
        let sharkParityScale = (sharkEquivalentRadius * sharkStats.worldScale) / max(1.0, prey.radius)
        let sharkLengthM = max(0.6, sharkStats.realBodyLengthM)
        let preyLengthM = max(0.05, (prey.bodyLengthCm > 0 ? prey.bodyLengthCm : prey.radius * 2.5) / 100.0)
        let realRatio = preyLengthM / sharkLengthM

        let behemothScale = DomainConfigs.economyPredation.mutations.abyssBehemoth.visualScaleMult
        let behemothMult = mutationVariant == .ABYSS_BEHEMOTH ? behemothScale : 1.0
        let bossMult = prey.isBoss ? 1.2 : 1.0
        let targetRatio = realRatio * behemothMult * bossMult

        return sharkParityScale * targetRatio * defaultPreySizeMultiplier
    }

    /// Checks whether any non-hazard prey species meeting `minPreyLengthCm` inhabits `worldY` (for P1-2 shallow-depletion guidance)
    public static func hasViablePreyAtDepth(worldY: Double, minPreyLengthCm: Double) -> Bool {
        let isShallow = worldY <= 520.0
        for p in GameConfigGenerated.preyTiers {
            if p.isHazard { continue }
            if isShallow && (p.isBoss || p.behavior == .EEL_CHARGER || p.behavior == .SUB_PATROL) { continue }
            guard worldY >= p.minDepth && worldY <= p.maxDepth else { continue }
            let lenCm = p.bodyLengthCm > 0 ? p.bodyLengthCm : p.radius * 2.5
            if lenCm >= minPreyLengthCm {
                return true
            }
        }
        return false
    }

    /// Returns the shallowest worldY depth where prey >= `minPreyLengthCm` inhabit (nil if no species qualifies)
    public static func getMinViableWorldYForShark(minPreyLengthCm: Double) -> Double? {
        var best: Double? = nil
        for p in GameConfigGenerated.preyTiers {
            if p.isHazard { continue }
            let lenCm = p.bodyLengthCm > 0 ? p.bodyLengthCm : p.radius * 2.5
            if lenCm >= minPreyLengthCm {
                if let cur = best {
                    best = min(cur, p.minDepth)
                } else {
                    best = p.minDepth
                }
            }
        }
        return best
    }

    public static func getEffectivePreyTier(
        prey: PreyTierConfig,
        mutationVariant: PreyMutationVariant = .NONE
    ) -> Int {
        if mutationVariant == .ABYSS_BEHEMOTH {
            return min(50, prey.tier + DomainConfigs.economyPredation.mutations.abyssBehemoth.effectiveTierOffset)
        }
        return prey.tier
    }

    public static func getRequiredArmorHits(
        prey: PreyTierConfig,
        mutationVariant: PreyMutationVariant = .NONE
    ) -> Int {
        let cfg = DomainConfigs.economyPredation.armorCrush
        if prey.isBoss || mutationVariant == .ABYSS_BEHEMOTH {
            return cfg.bossOrBehemothHitsRequired
        }
        return cfg.normalHitsRequired
    }

    /// Collision encounter resolution (DEVOUR vs ARMOR_CRUSH vs NEED_BOOST vs DAMAGE)
    public static func resolvePreyEncounter(
        prey: PreyTierConfig,
        sharkStats: ComputedSharkStats,
        isBoosting: Bool,
        frenzyActive: Bool,
        mutationVariant: PreyMutationVariant = .NONE
    ) -> EncounterOutcome {
        if frenzyActive { return .DEVOUR }
        if prey.isHazard {
            return sharkStats.canEatMines ? .DEVOUR : .DAMAGE
        }
        let crushCfg = DomainConfigs.economyPredation.armorCrush
        let effectiveTier = getEffectivePreyTier(prey: prey, mutationVariant: mutationVariant)
        let tierDiff = effectiveTier - sharkStats.biteTier
        if tierDiff <= 0 {
            return .DEVOUR
        }
        if tierDiff >= crushCfg.armorBandMinDelta && tierDiff <= crushCfg.armorBandMaxDelta {
            return isBoosting ? .ARMOR_CRUSH : .NEED_BOOST
        }
        return .DAMAGE
    }

    /// Config-driven predation economy & pity-counter settlement matching Web `rules.ts` 1:1.
    public static func computePredationSettlement(
        prey: PreyTierConfig,
        sharkStats: ComputedSharkStats,
        encounter: EncounterOutcome,
        frenzyActive: Bool,
        isBoosting: Bool,
        mutationVariant: PreyMutationVariant,
        globalDifficultyMultiplier: Double,
        comboScoreMultiplier: Double,
        genePityMissStreak: inout Int,
        rng: () -> Double = { Double.random(in: 0..<1) }
    ) -> PredationSettlementMetrics {
        let frenzyCfg = DomainConfigs.economyPredation.frenzy
        let crushCfg = DomainConfigs.economyPredation.armorCrush
        let mutCfg = DomainConfigs.economyPredation.mutations
        let xpCfg = DomainConfigs.economyPredation.xpMultipliers
        let geneDropCfg = DomainConfigs.economyPredation.predationGeneDrop
        let combatCfg = DomainConfigs.economyPredation.combat

        let isArmorCrush = encounter == .ARMOR_CRUSH && !frenzyActive
        if encounter == .DEVOUR || encounter == .ARMOR_CRUSH {
            let isCrit = frenzyActive || isBoosting || isArmorCrush || prey.tier >= 10 || mutationVariant != .NONE
            let frenzyCoinMult = frenzyActive ? frenzyCfg.coinMultiplier : 1.0
            let frenzyGeneMult = frenzyActive ? frenzyCfg.geneMultiplier : 1.0
            let frenzyScoreMult = frenzyActive ? frenzyCfg.scoreMultiplier : 1.0

            let crushCoinMult = isArmorCrush ? crushCfg.coinMult : 1.0
            let crushGeneMult = isArmorCrush ? crushCfg.geneMult : 1.0
            let crushScoreMult = isArmorCrush ? crushCfg.scoreMult : 1.0

            let mutCoinMult: Double = mutationVariant == .GOLDEN_SWARM
                ? mutCfg.golden.coinMult
                : (mutationVariant == .ABYSS_BEHEMOTH ? mutCfg.abyssBehemoth.coinMult : 1.0)
            let mutGeneMult: Double = mutationVariant == .ABYSS_BEHEMOTH
                ? mutCfg.abyssBehemoth.geneMult
                : (mutationVariant == .GOLDEN_SWARM ? mutCfg.golden.geneMult : 1.0)
            let mutScoreMult: Double = mutationVariant == .GOLDEN_SWARM
                ? mutCfg.golden.scoreMult
                : (mutationVariant == .ABYSS_BEHEMOTH ? mutCfg.abyssBehemoth.scoreMult : 1.0)

            let xpMult: Double
            if frenzyActive {
                xpMult = xpCfg.frenzy
            } else if mutationVariant == .GOLDEN_SWARM {
                xpMult = xpCfg.golden
            } else if isArmorCrush {
                xpMult = xpCfg.armorCrush
            } else if mutationVariant == .ABYSS_BEHEMOTH {
                xpMult = xpCfg.behemoth
            } else {
                xpMult = xpCfg.normal
            }

            let xpGain = prey.xpValue > 0 ? max(1, Int((Double(prey.xpValue) * xpMult).rounded())) : 0
            let bossBonus = prey.isBoss ? sharkStats.bossRewardMultiplier : 1.0
            let goldenSpecialBonus = mutationVariant == .GOLDEN_SWARM ? sharkStats.specialPreyScoreMultiplier : 1.0

            let rawScore = Double(prey.scoreValue) * frenzyScoreMult * crushScoreMult * mutScoreMult
                * sharkStats.scoreMultiplier * bossBonus * goldenSpecialBonus * comboScoreMultiplier
            let scoreGain = max(0, Int(rawScore.rounded()))

            let applySharkYields = !isArmorCrush || crushCfg.applySharkYieldMultipliers
            let coinYield = applySharkYields ? sharkStats.coinYieldMultiplier : 1.0
            let geneYield = applySharkYields ? sharkStats.geneYieldMultiplier : 1.0

            let rawCoins = Double(prey.coinValue) * frenzyCoinMult * crushCoinMult * mutCoinMult * bossBonus
            let coinGain = rawCoins > 0 ? max(1, Int((rawCoins * coinYield).rounded())) : 0

            var geneGain = 0
            let rawGeneBase = Double(prey.geneValue) * frenzyGeneMult * crushGeneMult * mutGeneMult * bossBonus
            if rawGeneBase > 0 && prey.geneValue > 0 {
                let isSpecial = prey.isBoss || isArmorCrush || mutationVariant == .GOLDEN_SWARM || mutationVariant == .ABYSS_BEHEMOTH
                if isSpecial && geneDropCfg.specialGuaranteed {
                    genePityMissStreak = 0
                    geneGain = max(geneDropCfg.minGenesWhenGuaranteed, Int((rawGeneBase * geneYield).rounded()))
                } else {
                    let isLowTier = prey.tier <= geneDropCfg.lowTierMaxTier
                    let chance = isLowTier ? geneDropCfg.lowTierChance : geneDropCfg.highTierChance
                    let pityLimit = isLowTier ? geneDropCfg.lowTierPityMissLimit : geneDropCfg.highTierPityMissLimit
                    if genePityMissStreak >= pityLimit || rng() < chance {
                        genePityMissStreak = 0
                        geneGain = max(geneDropCfg.minGenesWhenGuaranteed, Int((rawGeneBase * geneYield).rounded()))
                    } else {
                        genePityMissStreak += 1
                    }
                }
            }

            let floatTextKey: String
            if prey.isBoss { floatTextKey = "float_boss_kill" }
            else if prey.isHazard { floatTextKey = "float_mine_crunch" }
            else if isArmorCrush { floatTextKey = "float_armor_crush" }
            else if frenzyActive || mutationVariant == .GOLDEN_SWARM { floatTextKey = "float_gold_rush" }
            else if isCrit { floatTextKey = "float_crit" }
            else { floatTextKey = "float_devour" }

            return PredationSettlementMetrics(
                hpDelta: (prey.hpRestore * sharkStats.devourHealMultiplier).rounded(),
                xpGain: xpGain,
                scoreGain: scoreGain,
                coinGain: coinGain,
                geneGain: geneGain,
                failDamage: 0,
                knockbackForce: 0,
                floatTextKey: floatTextKey,
                isCrit: isCrit
            )
        }

        let crushBand = encounter == .NEED_BOOST
        let behemothFailMult = mutationVariant == .ABYSS_BEHEMOTH ? mutCfg.abyssBehemoth.failDamageMult : 1.0
        let maxHpPenalty: Double = prey.isHazard
            ? (sharkStats.maxHp * 0.14).rounded()
            : ((prey.tier >= 30 || mutationVariant == .ABYSS_BEHEMOTH) ? (sharkStats.maxHp * 0.08).rounded() : 0.0)
        let needBoostDamping = crushBand ? combatCfg.armorFailDamageFactor : 1.0
        let mineExtraMult = prey.isHazard ? 1.4 : 1.0
        let rawFail = (prey.damageOnFail * needBoostDamping * mineExtraMult * behemothFailMult * max(1.0, globalDifficultyMultiplier)).rounded() + maxHpPenalty
        let armorMit = sharkStats.damageTakenMultiplier * (prey.isHazard ? sharkStats.mineDamageTakenMultiplier : 1.0)
        let scaledFail = max(1.0, (rawFail * armorMit).rounded())
        let knockback = ((prey.isHazard ? combatCfg.mineKnockbackForce : (crushBand ? 260.0 : combatCfg.predatorKnockbackForce)) * sharkStats.knockbackMultiplier).rounded()

        return PredationSettlementMetrics(
            hpDelta: -scaledFail,
            xpGain: 0,
            scoreGain: 0,
            coinGain: 0,
            geneGain: 0,
            failDamage: scaledFail,
            knockbackForce: knockback,
            floatTextKey: prey.isHazard ? "float_mine_hit" : (crushBand ? "float_need_boost" : "float_too_big"),
            isCrit: false
        )
    }

    /// Continuous bathymetric water color interpolation across 0m ~ 20,000m (1:1 parity with Web parallaxBackground.ts)
    public static func sampleBathymetricWaterRGB(depthMeters: Double) -> SIMD3<Double> {
        let stops: [(depth: Double, r: Double, g: Double, b: Double)] = [
            (-220, 56, 189, 248),
            (-10, 125, 211, 252),
            (0, 14, 184, 218),
            (140, 6, 148, 194),
            (340, 3, 105, 161),
            (520, 18, 68, 138),
            (780, 17, 38, 92),
            (1150, 10, 18, 48),
            (1800, 9, 8, 28),
            (3200, 14, 7, 24),
            (6500, 18, 6, 18),
            (12000, 22, 5, 12),
            (20000, 10, 2, 8)
        ]
        if depthMeters <= stops[0].depth {
            return SIMD3(stops[0].r / 255.0, stops[0].g / 255.0, stops[0].b / 255.0)
        }
        let last = stops[stops.count - 1]
        if depthMeters >= last.depth {
            return SIMD3(last.r / 255.0, last.g / 255.0, last.b / 255.0)
        }
        for i in 0..<(stops.count - 1) {
            let a = stops[i]
            let b = stops[i + 1]
            if depthMeters >= a.depth && depthMeters <= b.depth {
                let rawT = (depthMeters - a.depth) / max(1.0, b.depth - a.depth)
                let t = rawT * rawT * (3.0 - 2.0 * rawT)
                return SIMD3(
                    (a.r + (b.r - a.r) * t) / 255.0,
                    (a.g + (b.g - a.g) * t) / 255.0,
                    (a.b + (b.b - a.b) * t) / 255.0
                )
            }
        }
        return SIMD3(6.0 / 255.0, 148.0 / 255.0, 194.0 / 255.0)
    }
}
