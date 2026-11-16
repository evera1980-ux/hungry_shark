import Foundation
import CoreGraphics
import simd

public enum PreyMutationVariant: String, Codable, Sendable {
    case NONE
    case GOLDEN_SWARM
    case FRENZY_PREY
    case ABYSS_BEHEMOTH
}

public enum EncounterOutcome: String, Sendable {
    case DEVOUR
    case ARMOR_CRUSH
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
    public let coinYieldMultiplier: Double
    public let geneYieldMultiplier: Double
    public let damageTakenMultiplier: Double
    public let canEatMines: Bool
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
    public let labelKey: String
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
        self.language = language
        self.soundEnabled = soundEnabled
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.selectedSharkId = (try? c.decode(String.self, forKey: .selectedSharkId)) ?? "shark_00_clown_fry"
        self.unlockedSharkIds = (try? c.decode([String].self, forKey: .unlockedSharkIds)) ?? ["shark_00_clown_fry"]
        self.sharkUpgradeLevels = (try? c.decode([String: Int].self, forKey: .sharkUpgradeLevels)) ?? ["shark_00_clown_fry": 1]
        self.sharkBestScores = (try? c.decode([String: Int].self, forKey: .sharkBestScores)) ?? [:]
        self.sharkMasteryTiers = (try? c.decode([String: Int].self, forKey: .sharkMasteryTiers)) ?? [:]
        self.bankedCoins = (try? c.decode(Int.self, forKey: .bankedCoins)) ?? 120
        self.bankedGenes = (try? c.decode(Int.self, forKey: .bankedGenes)) ?? 15
        self.bestInRunLevel = (try? c.decode(Int.self, forKey: .bestInRunLevel)) ?? 1
        self.maxDepthReached = (try? c.decode(Double.self, forKey: .maxDepthReached)) ?? 180
        self.totalRuns = (try? c.decode(Int.self, forKey: .totalRuns)) ?? 0
        self.language = (try? c.decode(String.self, forKey: .language)) ?? "zh"
        self.soundEnabled = (try? c.decode(Bool.self, forKey: .soundEnabled)) ?? true
    }

    public static func createDefault() -> SharkMetaSaveData {
        SharkMetaSaveData(
            selectedSharkId: "shark_00_clown_fry",
            unlockedSharkIds: ["shark_00_clown_fry"],
            sharkUpgradeLevels: ["shark_00_clown_fry": 1],
            sharkBestScores: [:],
            sharkMasteryTiers: [:],
            bankedCoins: 120,
            bankedGenes: 15,
            bestInRunLevel: 1,
            maxDepthReached: 180,
            totalRuns: 0,
            language: "zh",
            soundEnabled: true
        )
    }
}

public enum GameRules {
    public static let sharkBaseDrawSize: Double = 110.4 // 96.0 * 1.15 mobile viewport presence parity with Web
    public static let preyRadiusToDrawSize: Double = 2.25
    public static let sharkEquivalentRadius: Double = 110.4 / 2.25 // 49.0667 (preserves 1:1 sharkParityScale ratio)
    public static let defaultPreySizeMultiplier: Double = 0.80

    /// XP required to advance from `level` to `level + 1` (matches src/game/rules.ts)
    public static func getXpRequiredForLevel(_ level: Int) -> Int {
        if level <= 1 { return 140 }
        let l = Double(level - 1)
        return Int((140.0 + l * 145.0 + pow(l, 1.75) * 65.0).rounded())
    }

    /// Dynamic Gold Frenzy cost (Generation-Anchored + Quadratic Acceleration)
    public static func getGoldOverdriveCost(useCount: Int, generationRow: Int) -> Int {
        let n = Double(max(0, useCount))
        let rowMult = 1.0 + Double(max(0, generationRow)) * 0.35
        return Int(((35.0 + n * 25.0 + n * n * 12.0) * rowMult).rounded())
    }

    /// Dynamic Gene Surge cost
    public static func getGeneSurgeCost(level: Int, useCount: Int, generationRow: Int) -> Int {
        let lv = Double(max(1, level))
        let n = Double(max(0, useCount))
        let rowMult = 1.0 + Double(max(0, generationRow)) * 0.25
        return Int(((12.0 + (lv - 1.0) * 5.0 + n * 10.0 + n * n * 6.0) * rowMult).rounded())
    }

    /// Body upgrade coin cost (Lv.1 -> Lv.10)
    public static func getSharkUpgradeCoinCost(form: SharkFormConfig, currentLevel: Int) -> Int {
        let lv = max(1, min(9, currentLevel))
        return Int((Double(form.baseUpgradeCoinCost) * pow(1.36, Double(lv - 1))).rounded())
    }

    /// Body upgrade gene cost (only at Bite Tier breakthrough gates Lv.4->5 and Lv.9->10)
    public static func getSharkUpgradeGeneCost(form: SharkFormConfig, currentLevel: Int) -> Int {
        let refGenes = Double(max(8, form.unlockGenes))
        if currentLevel == 4 {
            return Int((refGenes * 0.35 + 6.0).rounded())
        }
        if currentLevel == 9 {
            return Int((refGenes * 0.65 + 14.0).rounded())
        }
        return 0
    }

    /// Evaluates whether a shark form can be unlocked right now
    public static func evaluateSharkUnlock(form: SharkFormConfig, save: SharkMetaSaveData) -> UnlockCheckResult {
        let isUnlocked = save.unlockedSharkIds.contains(form.id)
        let parentForm = form.index > 0 ? GameConfigGenerated.sharkForms[form.index - 1] : nil
        let parentUnlocked = parentForm == nil ? true : save.unlockedSharkIds.contains(parentForm!.id)
        let parentUpgradeLevel = parentForm == nil ? 10 : (save.sharkUpgradeLevels[parentForm!.id] ?? 1)
        let parentLevelMet = parentForm == nil ? true : (parentUpgradeLevel >= form.reqParentUpgradeLevel)

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

    /// Returns the immediate next locked shark form in the 48-shark chain (or nil if all 48 are unlocked)
    public static func getNextEvolutionTarget(save: SharkMetaSaveData) -> (form: SharkFormConfig, check: UnlockCheckResult)? {
        for form in GameConfigGenerated.sharkForms {
            if !save.unlockedSharkIds.contains(form.id) {
                return (form, evaluateSharkUnlock(form: form, save: save))
            }
        }
        return nil
    }

    /// Computes 3-tier score mastery milestones & one-time bounty rewards for any of the 48 sharks
    public static func getSharkMasteryConfig(form: SharkFormConfig) -> SharkMasteryConfig {
        let idx = Double(form.index)
        let row = Double(form.row)
        let baseScore = Double(round((1800.0 + idx * 1450.0 + pow(idx, 1.65) * 420.0) / 100.0) * 100.0)
        let baseCoin = Int((45.0 + idx * 24.0 + row * 65.0).rounded())
        let baseGene = Int((4.0 + floor(idx * 0.85) + row * 3.0).rounded())

        return SharkMasteryConfig(
            sharkId: form.id,
            tiers: [
                MasteryRewardTierConfig(
                    tier: 1,
                    labelZh: "铜冠猎手",
                    labelEn: "BRONZE CROWN",
                    targetScore: Int(baseScore),
                    rewardCoins: baseCoin,
                    rewardGenes: baseGene
                ),
                MasteryRewardTierConfig(
                    tier: 2,
                    labelZh: "银冠霸主",
                    labelEn: "SILVER CROWN",
                    targetScore: Int(round((baseScore * 2.4) / 100.0) * 100.0),
                    rewardCoins: Int((Double(baseCoin) * 2.2).rounded()),
                    rewardGenes: Int((Double(baseGene) * 2.0).rounded())
                ),
                MasteryRewardTierConfig(
                    tier: 3,
                    labelZh: "金冠深渊王",
                    labelEn: "GOLD CROWN",
                    targetScore: Int(round((baseScore * 4.8) / 100.0) * 100.0),
                    rewardCoins: Int((Double(baseCoin) * 4.5).rounded()),
                    rewardGenes: Int((Double(baseGene) * 4.0).rounded())
                )
            ]
        )
    }

    /// Evaluates a completed run's score against the active shark's mastery milestones
    public static func settleSharkScoreMastery(
        sharkId: String,
        runScore: Int,
        save: SharkMetaSaveData
    ) -> MasterySettlementResult {
        let form = GameConfigGenerated.sharkForms.first(where: { $0.id == sharkId }) ?? GameConfigGenerated.sharkForms[0]
        let config = getSharkMasteryConfig(form: form)
        let prevBest = save.sharkBestScores[sharkId] ?? 0
        let prevTier = save.sharkMasteryTiers[sharkId] ?? 0
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

    /// Computes global collection & mastery crown bonuses across all 48 sharks
    public static func getGlobalAtlasBonuses(save: SharkMetaSaveData) -> GlobalAtlasBonuses {
        let unlockedCount = max(1, save.unlockedSharkIds.count)
        let extraUnlocked = Double(max(0, unlockedCount - 1))
        let totalMasteryCrowns = save.sharkMasteryTiers.values.reduce(0) { $0 + max(0, min(3, $1)) }
        let crowns = Double(totalMasteryCrowns)

        return GlobalAtlasBonuses(
            unlockedCount: unlockedCount,
            totalMasteryCrowns: totalMasteryCrowns,
            hpMultiplier: 1.0 + extraUnlocked * 0.02 + crowns * 0.005,
            speedBonus: extraUnlocked * 0.008 + crowns * 0.002,
            rewardMultiplier: 1.0 + extraUnlocked * 0.025 + crowns * 0.008,
            scoreMultiplierBonus: crowns * 0.015
        )
    }

    /// Computes Hunting Heat streak buff from combo count
    public static func computeHuntingHeatBuff(comboCount: Int) -> HuntingHeatBuff {
        if comboCount >= 18 {
            return HuntingHeatBuff(heatLevel: 3, speedMultiplier: 1.24, scoreMultiplier: 1.6, labelKey: "hud_heat_lv3")
        }
        if comboCount >= 10 {
            return HuntingHeatBuff(heatLevel: 2, speedMultiplier: 1.15, scoreMultiplier: 1.3, labelKey: "hud_heat_lv2")
        }
        if comboCount >= 4 {
            return HuntingHeatBuff(heatLevel: 1, speedMultiplier: 1.08, scoreMultiplier: 1.15, labelKey: "hud_heat_lv1")
        }
        return HuntingHeatBuff(heatLevel: 0, speedMultiplier: 1.0, scoreMultiplier: 1.0, labelKey: "hud_heat_lv0")
    }

    /// Optical Far / Mid / Near background shrinking ratios coupled to shark growth (`relativePreyScale`: 1.00 -> 0.40)
    /// Shrink weights: Near (0.70) > Ambient (0.55) > Mid (0.45) > Far (0.22) > Water (0.15)
    public static func getParallaxLayerGrowthScales(relativePreyScale: Double) -> ParallaxLayerGrowthScales {
        let clampedRel = max(0.4, min(1.0, relativePreyScale.isFinite ? relativePreyScale : 1.0))
        let shrinkDelta = max(0.0, 1.0 - clampedRel) // 0.00 -> 0.60
        return ParallaxLayerGrowthScales(
            growthProgress: min(1.0, shrinkDelta / 0.6),
            waterScale: 1.0 - shrinkDelta * 0.15,
            farScale: 1.0 - shrinkDelta * 0.22,
            midScale: 1.0 - shrinkDelta * 0.45,
            ambientScale: 1.0 - shrinkDelta * 0.55,
            nearScale: 1.0 - shrinkDelta * 0.70,
            particleScale: 1.0 - shrinkDelta * 0.45
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

    // MARK: - Procedural Ocean World & 9-Tier Continuous Seabed System (1:1 Parity with src/game/worldGenerationSystem.ts)
    public struct ProceduralTerrainModulation {
        public let farRidgeOffsetPx: Double
        public let midStratumOffsetPx: Double
        public let nearSeabedOffsetPx: Double
        public let reliefMultiplier: Double
        public let seabedBiasPx: Double
        public let schoolClusterProbability: Double
    }

    public static func hash1D(_ n: Int, salt: Int = 0) -> Double {
        let seed: UInt32 = 20261110
        let n32 = UInt32(bitPattern: Int32(truncatingIfNeeded: n))
        let s32 = UInt32(bitPattern: Int32(truncatingIfNeeded: salt))
        var x = (n32 &* 374761393) &+ ((seed ^ s32) &* 668265263)
        x = (x ^ (x >> 13)) &* 1274126177
        x = x ^ (x >> 16)
        return Double(x) / 4294967296.0
    }

    public static func noise1D(_ x: Double, salt: Int = 0) -> Double {
        let x0 = Int(floor(x))
        let tx = x - Double(x0)
        let u = tx * tx * tx * (tx * (tx * 6.0 - 15.0) + 10.0)
        let v0 = hash1D(x0, salt: salt) * 2.0 - 1.0
        let v1 = hash1D(x0 + 1, salt: salt) * 2.0 - 1.0
        return v0 + (v1 - v0) * u
    }

    // MARK: - 1:1 Exact Web TerrainGenerator & 9-Tier Seabed Terrace Port (worldSeed = 123456789, generatorVersion = 1)
    private static let terrainMaxSlope: Double = 1.65
    private static let terrainSampleStepX: Double = 100.0
    private static let terrainBaseFloorDepth: Double = 10100.0
    private static let terrainLargeWaveAmplitude: Double = 9600.0
    private static let terrainMediumWaveAmplitude: Double = 3800.0
    private static let terrainSmallWaveAmplitude: Double = 720.0
    private static let terrainMinFloorDepth: Double = 420.0
    private static let terrainMaxFloorDepth: Double = 19800.0
    private static let sandyPlainCellWidth: Double = 1800.0
    private static let tanhGainNorm: Double = tanh(1.82)

    private static var terrainBlockNodeCache: [Int: [Double]] = [:]
    private static var terrainBlockCacheOrder: [Int] = []
    private static let maxTerrainBlockCacheSize: Int = 128

    /// Exact 1:1 port of Web terrainLatticeValue(latticeIndex, waveSalt, WorldConfig)
    /// (worldSeed = 123456789, generatorVersion = 1, subsystemKey = "terrain", subHash = 0x8a86635c, baseH = 0x7811b100)
    private static func terrainLatticeValue(_ latticeIndex: Int, waveSalt: Int) -> Double {
        let ncx = UInt32(bitPattern: Int32(truncatingIfNeeded: latticeIndex))
        let ncy = UInt32(bitPattern: Int32(truncatingIfNeeded: waveSalt))
        var h: UInt32 = 0x7811b100
        h = (h ^ ncx) &* 0x165667b1
        h = (h ^ ncy) &* 0xd3a2646c
        h = h ^ 0x8a86635c
        h ^= h >> 16
        h = h &* 0x85ebca6b
        h ^= h >> 13
        h = h &* 0xc2b2ae35
        h ^= h >> 16
        let nonZeroH: UInt32 = h != 0 ? h : 0x6d2b79f5
        return (Double(nonZeroH) / 4294967296.0) * 2.0 - 1.0
    }

    private static func smoothedTerrainLatticeValue(_ latticeIndex: Int, waveSalt: Int) -> Double {
        let vm1 = terrainLatticeValue(latticeIndex - 1, waveSalt: waveSalt)
        let v0 = terrainLatticeValue(latticeIndex, waveSalt: waveSalt)
        let vp1 = terrainLatticeValue(latticeIndex + 1, waveSalt: waveSalt)
        return 0.25 * vm1 + 0.5 * v0 + 0.25 * vp1
    }

    private static func contrastStretchedLatticeValue(_ latticeIndex: Int, waveSalt: Int) -> Double {
        if terrainMinFloorDepth <= 600.0 {
            if latticeIndex == 0 { return -0.94 }
            if latticeIndex == 1 || latticeIndex == -1 {
                let n = abs(terrainLatticeValue(latticeIndex, waveSalt: waveSalt + 7))
                return 0.42 + 0.12 * n
            }
            if latticeIndex == 2 || latticeIndex == -2 {
                let n = abs(terrainLatticeValue(latticeIndex, waveSalt: waveSalt + 13))
                return 0.92 + 0.08 * n
            }
        }
        let raw = terrainLatticeValue(latticeIndex, waveSalt: waveSalt)
        if raw < 0.0 {
            return -pow(abs(raw), 0.68) * 0.94
        }
        return pow(abs(raw), 0.56)
    }

    private static func evalSmoothTerrainWave(
        _ worldX: Double,
        wavelength: Double,
        waveSalt: Int,
        useContrastStretch: Bool = false
    ) -> Double {
        let scaled = worldX / wavelength
        let i0 = Int(floor(scaled))
        let t = scaled - Double(i0)
        let u = t * t * (3.0 - 2.0 * t)
        let v0 = useContrastStretch
            ? contrastStretchedLatticeValue(i0, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0, waveSalt: waveSalt)
        let v1 = useContrastStretch
            ? contrastStretchedLatticeValue(i0 + 1, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0 + 1, waveSalt: waveSalt)
        return v0 + (v1 - v0) * u
    }

    private static func evalWarpedTerrainWave(
        _ worldX: Double,
        wavelength: Double,
        waveSalt: Int,
        useContrastStretch: Bool = false
    ) -> Double {
        let scaled = worldX / wavelength
        let i0 = Int(floor(scaled))
        let t = scaled - Double(i0)
        let h = t * t * (3.0 - 2.0 * t)

        let asymScale = useContrastStretch ? 0.32 : 0.54
        let stepScale = useContrastStretch ? 0.26 : 0.38
        let asym = terrainLatticeValue(i0, waveSalt: waveSalt + 19) * asymScale
        let step1 = terrainLatticeValue(i0, waveSalt: waveSalt + 37) * stepScale
        let step2 = terrainLatticeValue(i0, waveSalt: waveSalt + 53) * (stepScale * 0.55)

        let warpedU = h
            + asym * h * (1.0 - h) * (1.0 - 2.0 * h)
            + step1 * (sin(.pi * 2.0 * h) / (.pi * 2.0))
            + step2 * (sin(.pi * 4.0 * h) / (.pi * 4.0))
        let u = max(0.0, min(1.0, warpedU))

        let v0 = useContrastStretch
            ? contrastStretchedLatticeValue(i0, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0, waveSalt: waveSalt)
        let v1 = useContrastStretch
            ? contrastStretchedLatticeValue(i0 + 1, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0 + 1, waveSalt: waveSalt)
        return v0 + (v1 - v0) * u
    }

    private static func evalRidgedTerrainWave(
        _ worldX: Double,
        wavelength: Double,
        waveSalt: Int
    ) -> Double {
        let rawW = evalSmoothTerrainWave(worldX, wavelength: wavelength, waveSalt: waveSalt, useContrastStretch: false)
        let w = tanh(rawW * 1.82) / tanhGainNorm
        let eps = 0.34
        let minVal = sqrt(eps)
        let maxVal = sqrt(1.0 + eps)
        let normFold = (sqrt(w * w + eps) - minVal) / (maxVal - minVal)
        let roundedFold = 1.0 - 2.0 * normFold
        let cosineArch = cos(w * .pi * 0.94)
        var blended = roundedFold * 0.62 + cosineArch * 0.38
        if blended < -0.20 {
            let u = min(1.0, (-blended - 0.20) / 0.80)
            let flatDome = u - 0.34 * u * u
            blended = -(0.20 + 0.80 * (flatDome / 0.66) * 0.90)
        }
        return max(-1.0, min(1.0, blended))
    }

    private static func evalSlopeVariationOffset(_ worldX: Double) -> Double {
        let mountainChain =
            evalRidgedTerrainWave(worldX, wavelength: 1180.0, waveSalt: 601) * 320.0 +
            evalRidgedTerrainWave(worldX, wavelength: 780.0, waveSalt: 619) * 260.0
        let subPeaks =
            evalWarpedTerrainWave(worldX, wavelength: 520.0, waveSalt: 643, useContrastStretch: false) * 210.0 +
            evalRidgedTerrainWave(worldX, wavelength: 340.0, waveSalt: 661) * 145.0
        let phaseMod = evalSmoothTerrainWave(worldX, wavelength: 920.0, waveSalt: 677) * 1.8
        let ridgeWave =
            sin((worldX / 220.0) * .pi * 2.0 + phaseMod) * 72.0 +
            cos((worldX / 145.0) * .pi * 2.0 - phaseMod * 0.7) * 34.0
        return mountainChain + subPeaks + ridgeWave
    }

    private static func evalBaseMacroOffsetAtX(_ worldX: Double, effA1: Double, isBlockAnchor: Bool) -> Double {
        let macroPrimary = isBlockAnchor
            ? evalSmoothTerrainWave(worldX, wavelength: 18500.0, waveSalt: 101, useContrastStretch: true)
            : evalWarpedTerrainWave(worldX, wavelength: 18500.0, waveSalt: 101, useContrastStretch: true)
        let macroSecondary = isBlockAnchor
            ? evalSmoothTerrainWave(worldX, wavelength: 26000.0, waveSalt: 157, useContrastStretch: true)
            : evalWarpedTerrainWave(worldX, wavelength: 26000.0, waveSalt: 157, useContrastStretch: true)
        var combinedMacroNorm = max(-1.0, min(1.0, macroPrimary * 0.62 + macroSecondary * 0.38))

        if combinedMacroNorm < -0.35 {
            let u = min(1.0, (-combinedMacroNorm - 0.35) / 0.65)
            let flatTop = u - 0.36 * u * u
            combinedMacroNorm = -(0.35 + 0.65 * (flatTop / 0.64))
        }

        var macroOffset = combinedMacroNorm * effA1
        if terrainMinFloorDepth <= 600.0 && effA1 >= 5000.0 {
            let absX = abs(worldX)
            if absX < 7600.0 {
                let targetOriginOffset: Double
                if absX <= 560.0 {
                    let u = absX / 560.0
                    let spawnHills =
                        sin(worldX / 88.0) * 34.0 +
                        cos(worldX / 52.0 + 0.8) * 22.0 +
                        sin(worldX / 155.0 - 0.5) * 28.0
                    targetOriginOffset = -effA1 + 22.0 + 30.0 * (u * u) + spawnHills
                } else if absX <= 4200.0 {
                    let slopeProgress = (absX - 560.0) / 3640.0
                    let smoothDrop = 0.44 * slopeProgress + 0.56 * quinticSmoothstep(edge0: 0.0, edge1: 1.0, x: slopeProgress)
                    let mountainOsc = sin((absX - 560.0) / 115.0) * 195.0 + cos(worldX / 74.0) * 115.0
                    targetOriginOffset = -effA1 + 52.0 + 3880.0 * smoothDrop + mountainOsc * sin(.pi * slopeProgress)
                } else {
                    targetOriginOffset = -effA1 + 3932.0 + (absX - 4200.0) * 0.72
                }
                let oceanBlend = quinticSmoothstep(edge0: 3600.0, edge1: 7600.0, x: absX)
                macroOffset = targetOriginOffset + (macroOffset - targetOriginOffset) * oceanBlend
            }
        }
        return macroOffset
    }

    public static func evalSandyPlainFactor(_ worldX: Double) -> Double {
        let scaled = worldX / sandyPlainCellWidth
        let cellIdx = Int(floor(scaled))
        let u = scaled - Double(cellIdx)

        let rampIn = quinticSmoothstep(edge0: 0.0, edge1: 0.16, x: u)
        let rampOut = 1.0 - quinticSmoothstep(edge0: 0.84, edge1: 1.0, x: u)
        let cellWindow = rampIn * rampOut

        let cellCenterX = (Double(cellIdx) + 0.5) * sandyPlainCellWidth
        let w1 = evalSmoothTerrainWave(cellCenterX, wavelength: 3200.0, waveSalt: 509)
        let w2 = terrainLatticeValue(cellIdx, waveSalt: 577)
        let selectorSignal = w1 * 0.55 + w2 * 0.45
        let cellStrength = quinticSmoothstep(edge0: -0.28, edge1: 0.08, x: selectorSignal)
        let rawPlain = cellWindow * cellStrength

        if terrainMinFloorDepth <= 600.0 {
            let absX = abs(worldX)
            if absX <= 520.0 { return 0.75 }
            if absX < 3400.0 { return rawPlain * 0.25 }
        }
        return rawPlain
    }

    private static func evalRawRandomFloorDepthAtX(_ worldX: Double, isBlockAnchor: Bool = false) -> Double {
        let A1 = terrainLargeWaveAmplitude
        let A2 = terrainMediumWaveAmplitude
        let A3 = terrainSmallWaveAmplitude
        let plainFactor = evalSandyPlainFactor(worldX)

        let roughEnvWave = evalSmoothTerrainWave(worldX, wavelength: 5800.0, waveSalt: 707)
        let baseRoughness = 0.46 + 0.54 * (0.5 + 0.5 * roughEnvWave)
        let roughness = baseRoughness * (1.0 - 0.58 * plainFactor)

        let effA1 = min(A1, 9600.0)
        var macroOffset = evalBaseMacroOffsetAtX(worldX, effA1: effA1, isBlockAnchor: false)

        if plainFactor > 0.05 && effA1 > 200.0 && abs(worldX) > 3400.0 {
            let cellIdx = Int(floor(worldX / sandyPlainCellWidth))
            let cellCenterX = (Double(cellIdx) + 0.5) * sandyPlainCellWidth
            let centerMacroOffset = evalBaseMacroOffsetAtX(cellCenterX, effA1: effA1, isBlockAnchor: true)
            let originBlend = quinticSmoothstep(edge0: 3400.0, edge1: 4200.0, x: abs(worldX))
            let gentleMacroLock = plainFactor * 0.52 * originBlend
            let rollingHills =
                sin((worldX / 580.0) * .pi * 2.0 + Double(cellIdx) * 1.7) * 64.0 +
                cos((worldX / 310.0) * .pi * 2.0 - Double(cellIdx) * 1.1) * 32.0
            macroOffset = macroOffset + (centerMacroOffset - macroOffset) * gentleMacroLock + rollingHills * plainFactor * originBlend
        }

        let originDetailFade = terrainMinFloorDepth <= 600.0 ? quinticSmoothstep(edge0: 560.0, edge1: 1280.0, x: abs(worldX)) : 1.0

        let effA2 = min(A2, 3800.0) * originDetailFade
        let mesoRidgedPrimary = evalRidgedTerrainWave(worldX, wavelength: 2100.0, waveSalt: 263)
        let mesoRidgedSecondary = evalRidgedTerrainWave(worldX, wavelength: 1320.0, waveSalt: 281)
        let mesoWarped = evalWarpedTerrainWave(worldX, wavelength: 1750.0, waveSalt: 202, useContrastStretch: false)
        var mesoFolded = mesoRidgedPrimary * 0.44 + mesoRidgedSecondary * 0.32 + mesoWarped * 0.24
        if mesoFolded < -0.24 {
            let uPeak = min(1.0, (-mesoFolded - 0.24) / 0.76)
            let flatPeak = uPeak - 0.35 * uPeak * uPeak
            mesoFolded = -(0.24 + 0.76 * (flatPeak / 0.65) * 0.85)
        }
        let mesoEnvelope = (0.58 + 0.42 * baseRoughness) * (1.0 - 0.62 * plainFactor)
        let mediumOffset = mesoFolded * effA2 * mesoEnvelope * 0.42

        let effA3 = min(A3, 720.0) * originDetailFade
        let slopeVarWeight = originDetailFade * (0.38 + 0.62 * (1.0 - 0.65 * plainFactor)) * min(1.0, A2 / 1000.0)
        let mountainRangeOffset = evalSlopeVariationOffset(worldX) * slopeVarWeight
        let cragWave = evalWarpedTerrainWave(worldX, wavelength: 480.0, waveSalt: 303, useContrastStretch: false)
        let microJagged = evalSmoothTerrainWave(worldX, wavelength: 230.0, waveSalt: 409)
        let smallOffset =
            mountainRangeOffset +
            cragWave * effA3 * (0.45 + 0.55 * roughness) +
            microJagged * min(effA3 * 0.38, 180.0) * (0.45 + 0.55 * roughness)

        let blockSpan = 20.0 * terrainSampleStepX
        let blockInteriorArch = sin((worldX / blockSpan) * .pi)
        let mountainCap = 240.0 + 480.0 * (blockInteriorArch * blockInteriorArch)
        let rawMountainSum = mediumOffset + smallOffset
        let boundedMountainOffset = mountainCap > 0.0 ? mountainCap * tanh(rawMountainSum / mountainCap) : 0.0

        var rawDepth = terrainBaseFloorDepth + macroOffset + boundedMountainOffset
        if terrainMinFloorDepth <= 600.0 && rawDepth < 740.0 {
            let shallowExcess = 740.0 - rawDepth
            let maxGentleRise = 310.0
            let cushionedRise = maxGentleRise * tanh(shallowExcess / maxGentleRise)
            rawDepth = 740.0 - cushionedRise
        }
        return rawDepth
    }

    private static func evalGridNodeFloorDepth(_ gridIndex: Int) -> Double {
        let stepX = terrainSampleStepX
        let blockSteps = 20
        let blockIdx = Int(floor(Double(gridIndex) / Double(blockSteps)))
        let localStep = gridIndex - blockIdx * blockSteps

        if let cached = terrainBlockNodeCache[blockIdx] {
            return cached[localStep]
        }

        let maxStepDelta = terrainMaxSlope * stepX
        let blockStartGrid = blockIdx * blockSteps

        var scratchRawY = [Double](repeating: 0.0, count: blockSteps + 1)
        var scratchDeltas = [Double](repeating: 0.0, count: blockSteps)
        var scratchRooms = [Double](repeating: 0.0, count: blockSteps)
        var scratchWeightedRooms = [Double](repeating: 0.0, count: blockSteps)
        var scratchStepRhythm = [Double](repeating: 0.0, count: blockSteps)

        for j in 0...blockSteps {
            let gx = blockStartGrid + j
            let yVal = evalRawRandomFloorDepthAtX(Double(gx) * stepX, isBlockAnchor: false)
            scratchRawY[j] = max(terrainMinFloorDepth, min(terrainMaxFloorDepth, yVal))
        }

        let safeLimit = maxStepDelta - 1e-6
        let redistributionLimit = 1.36 * stepX
        var clampedSum = 0.0

        for j in 0..<blockSteps {
            let stepGridIdx = blockStartGrid + j
            let midX = (Double(stepGridIdx) + 0.5) * stepX
            let isSpawnZone = terrainMinFloorDepth <= 600.0 && abs(midX) <= 600.0
            let pf = evalSandyPlainFactor(midX)
            let rawD = scratchRawY[j + 1] - scratchRawY[j]

            let hStep = terrainLatticeValue(stepGridIdx, waveSalt: 829)
            let ridgePhase = sin(Double(stepGridIdx) * 1.35 + hStep * 1.45)
            let modulatedD: Double

            if isSpawnZone {
                modulatedD = rawD
                scratchStepRhythm[j] = 0.0
            } else if pf > 0.32 {
                let hillSlope = (sin(Double(stepGridIdx) * 1.55 + hStep * 0.9) * 0.14
                    + cos(Double(stepGridIdx) * 0.85 - hStep * 0.7) * 0.06) * stepX
                modulatedD = rawD * (1.0 - 0.68 * pf) + hillSlope * pf
                scratchStepRhythm[j] = 0.03
            } else if ridgePhase < -0.56 {
                let reverseKick = (hStep < 0.0 ? -0.22 : 0.12) * stepX
                modulatedD = rawD * 0.25 + reverseKick
                scratchStepRhythm[j] = 0.06
            } else {
                modulatedD = rawD
                scratchStepRhythm[j] = 1.0
            }

            let c = max(-redistributionLimit, min(redistributionLimit, modulatedD))
            scratchDeltas[j] = c
            clampedSum += c
        }

        let targetDiff = scratchRawY[blockSteps] - scratchRawY[0]
        let excess = targetDiff - clampedSum
        if abs(excess) > 1e-9 {
            var totalWeightedRoom = 0.0
            for j in 0..<blockSteps {
                let midX = (Double(blockStartGrid + j) + 0.5) * stepX
                let isSpawnZone = terrainMinFloorDepth <= 600.0 && abs(midX) <= 600.0
                let pf = evalSandyPlainFactor(midX)
                let room = isSpawnZone
                    ? 0.0
                    : max(0.0, excess > 0.0 ? (redistributionLimit - scratchDeltas[j]) : (scratchDeltas[j] + redistributionLimit))
                scratchRooms[j] = room
                let nonPlain = max(0.02, min(1.0, 1.0 - pf))
                let weight = min(1.0, nonPlain * nonPlain * scratchStepRhythm[j])
                scratchWeightedRooms[j] = room * weight
                totalWeightedRoom += scratchWeightedRooms[j]
            }

            if totalWeightedRoom >= abs(excess) && totalWeightedRoom > 1e-9 {
                let ratio = abs(excess) / totalWeightedRoom
                let sign = excess > 0.0 ? 1.0 : -1.0
                for j in 0..<blockSteps {
                    scratchDeltas[j] += sign * scratchWeightedRooms[j] * ratio
                }
            } else {
                let sign = excess > 0.0 ? 1.0 : -1.0
                var remainingExcess = abs(excess)
                if totalWeightedRoom > 1e-9 {
                    for j in 0..<blockSteps {
                        let add = min(scratchRooms[j], scratchWeightedRooms[j])
                        scratchDeltas[j] += sign * add
                        scratchRooms[j] = max(0.0, scratchRooms[j] - add)
                        remainingExcess -= add
                    }
                }
                if remainingExcess > 1e-9 {
                    var totalRoom = 0.0
                    for j in 0..<blockSteps { totalRoom += scratchRooms[j] }
                    if totalRoom > 1e-9 {
                        let ratio = min(1.0, remainingExcess / totalRoom)
                        for j in 0..<blockSteps {
                            scratchDeltas[j] += sign * scratchRooms[j] * ratio
                        }
                    }
                }
            }
        }

        let minAbsD = 0.045 * stepX
        let absAvgDeadHalf = 0.048 * stepX
        for m in 0..<10 {
            let j0 = m * 2
            let j1 = j0 + 1
            let d0 = scratchDeltas[j0]
            let d1 = scratchDeltas[j1]
            let avg = (d0 + d1) * 0.5
            let absAvg = abs(avg)
            let cMax = max(0.0, safeLimit - absAvg - 1e-4)
            let midX = Double(blockStartGrid + j0 + 1) * stepX
            let pf = evalSandyPlainFactor(midX)
            let hPair = abs(terrainLatticeValue(blockStartGrid + j0, waveSalt: 947))

            let targetC = pf > 0.32
                ? (0.068 + 0.035 * hPair) * stepX
                : (0.105 + 0.085 * hPair + 0.08 * min(1.0, absAvg / stepX)) * stepX
            var c = max((d1 - d0) * 0.5, min(cMax * 0.92, targetC))
            if c > cMax * 0.96 { c = cMax * 0.96 }

            if abs(c - absAvg) < absAvgDeadHalf {
                let upperC = absAvg + absAvgDeadHalf
                let lowerC = absAvg - absAvgDeadHalf
                if upperC <= cMax * 0.96 {
                    c = upperC
                } else if lowerC >= 0.048 * stepX {
                    c = lowerC
                }
            }
            scratchDeltas[j0] = avg - c
            scratchDeltas[j1] = avg + c
        }

        for m in 0..<9 {
            let jOdd = m * 2 + 1
            let jEvenNext = jOdd + 1
            let diffOddEven = scratchDeltas[jEvenNext] - scratchDeltas[jOdd]
            if abs(diffOddEven) < 0.095 * stepX {
                let needed = diffOddEven + 0.115 * stepX
                let jEvenCurr = m * 2
                let roomCurr = min(safeLimit + scratchDeltas[jEvenCurr], safeLimit - scratchDeltas[jOdd])
                var boostCurr = min(roomCurr * 0.85, needed)
                if boostCurr > 0.0 && (abs(scratchDeltas[jEvenCurr] - boostCurr) < minAbsD || abs(scratchDeltas[jOdd] + boostCurr) < minAbsD) {
                    let altBoost = min(roomCurr * 0.92, boostCurr + 2.2 * minAbsD)
                    if abs(scratchDeltas[jEvenCurr] - altBoost) >= minAbsD && abs(scratchDeltas[jOdd] + altBoost) >= minAbsD {
                        boostCurr = altBoost
                    } else {
                        boostCurr = 0.0
                    }
                }
                if boostCurr > 0.0 {
                    scratchDeltas[jEvenCurr] -= boostCurr
                    scratchDeltas[jOdd] += boostCurr
                }

                let remNeeded = scratchDeltas[jEvenNext] - scratchDeltas[jOdd] + 0.11 * stepX
                if remNeeded > 0.0 {
                    let jOddNext = jEvenNext + 1
                    let roomNext = min(safeLimit + scratchDeltas[jEvenNext], safeLimit - scratchDeltas[jOddNext])
                    var boostNext = min(roomNext * 0.85, remNeeded)
                    if boostNext > 0.0 && (abs(scratchDeltas[jEvenNext] - boostNext) < minAbsD || abs(scratchDeltas[jOddNext] + boostNext) < minAbsD) {
                        let altBoost = min(roomNext * 0.92, boostNext + 2.2 * minAbsD)
                        if abs(scratchDeltas[jEvenNext] - altBoost) >= minAbsD && abs(scratchDeltas[jOddNext] + altBoost) >= minAbsD {
                            boostNext = altBoost
                        } else {
                            boostNext = 0.0
                        }
                    }
                    if boostNext > 0.0 {
                        scratchDeltas[jEvenNext] -= boostNext
                        scratchDeltas[jOddNext] += boostNext
                    }
                }
            }
        }

        let latticeStep = 0.36 * stepX
        func snapBoundaryPair(jTarget: Int, jPartner: Int, jInnerNeighbor: Int, latticeOffset: Double) {
            let pairSum = scratchDeltas[jTarget] + scratchDeltas[jPartner]
            let currTarget = scratchDeltas[jTarget]
            let baseK = Int((currTarget - latticeOffset) / latticeStep + (currTarget - latticeOffset >= 0 ? 0.5 : -0.5))
            var bestTarget = currTarget
            var bestScore = Double.infinity
            for dk in -3...3 {
                let candTarget = Double(baseK + dk) * latticeStep + latticeOffset
                let candPartner = pairSum - candTarget
                if abs(candTarget) > safeLimit || abs(candPartner) > safeLimit { continue }
                if abs(candTarget) < minAbsD || abs(candPartner) < minAbsD { continue }
                if abs(candTarget - candPartner) < 0.095 * stepX { continue }
                if abs(candPartner - scratchDeltas[jInnerNeighbor]) < 0.095 * stepX { continue }
                let score = abs(candTarget - currTarget)
                if score < bestScore {
                    bestScore = score
                    bestTarget = candTarget
                }
            }
            scratchDeltas[jTarget] = bestTarget
            scratchDeltas[jPartner] = pairSum - bestTarget
        }

        snapBoundaryPair(jTarget: 0, jPartner: 1, jInnerNeighbor: 2, latticeOffset: 0.09 * stepX)
        snapBoundaryPair(jTarget: 19, jPartner: 18, jInnerNeighbor: 17, latticeOffset: -0.09 * stepX)

        var solvedNodes = [Double](repeating: 0.0, count: blockSteps + 1)
        var accY = scratchRawY[0]
        solvedNodes[0] = max(terrainMinFloorDepth, min(terrainMaxFloorDepth, accY))
        for j in 0..<blockSteps {
            let clampedStep = max(-maxStepDelta, min(maxStepDelta, scratchDeltas[j]))
            accY += clampedStep
            solvedNodes[j + 1] = max(terrainMinFloorDepth, min(terrainMaxFloorDepth, accY))
        }

        if terrainBlockNodeCache.count >= maxTerrainBlockCacheSize, let oldest = terrainBlockCacheOrder.first {
            terrainBlockCacheOrder.removeFirst()
            terrainBlockNodeCache.removeValue(forKey: oldest)
        }
        terrainBlockNodeCache[blockIdx] = solvedNodes
        terrainBlockCacheOrder.append(blockIdx)

        return solvedNodes[localStep]
    }

    /// Continuous 1.0x world-space seafloor mountain & trench profile (100% bit-for-bit parity with Web getFloorDepthAt)
    public static func getFloorDepthAt(worldX x: Double) -> Double {
        if !x.isFinite { return terrainBaseFloorDepth }
        let stepX = terrainSampleStepX
        let scaled = x / stepX
        let k0 = Int(floor(scaled))
        let frac = scaled - Double(k0)
        let y0 = evalGridNodeFloorDepth(k0)
        if frac == 0.0 { return y0 }
        let y1 = evalGridNodeFloorDepth(k0 + 1)
        let interpolated = y0 + (y1 - y0) * frac
        return max(terrainMinFloorDepth, min(terrainMaxFloorDepth, interpolated))
    }

    /// Exact 1:1 port of Web getTerrainSlopeAt(worldX)
    public static func getTerrainSlopeAt(worldX x: Double) -> Double {
        if !x.isFinite { return 0.0 }
        let stepX = terrainSampleStepX
        let k0 = Int(floor(x / stepX))
        let y0 = evalGridNodeFloorDepth(k0)
        let y1 = evalGridNodeFloorDepth(k0 + 1)
        return (y1 - y0) / stepX
    }

    public struct SeabedTerraceTierSpec {
        public let tierIndex: Int
        public let stripId: String
        public let baseRidgeY: Double
        public let minRidgeY: Double
        public let maxRidgeY: Double
        public let maxVisualRimY: Double
        public let archTargetBaseY: Double
        public let archMaxDepthY: Double
        public let cellWidth: Double
        public let seamPhaseOffsetX: Double
        public let skipZeroSeam: Bool
        public let openingHalfWidth: Double
        public let bowlHalfWidth: Double
        public let bowlDropDepth: Double
        public let minMainFloorForOpening: Double
        public let graftStartMainY: Double
        public let graftEndMainY: Double
        public let graftFuseMainY: Double
        public let seedSalt: Int

        public var baseDepth: Double { baseRidgeY }
        public var thicknessBase: Double { archTargetBaseY - baseRidgeY }
    }

    /// 9-Tier Non-Uniformly Spaced Multi-Depth Seabed Terraces (414m -> 16,900m, 100% 1:1 parity with Web SEABED_TERRACE_TIERS)
    public static let seabedTerraceTiers: [SeabedTerraceTierSpec] = [
        SeabedTerraceTierSpec(
            tierIndex: 0, stripId: "coral_reef",
            baseRidgeY: 414.0, minRidgeY: 332.0, maxRidgeY: 496.0, maxVisualRimY: 648.0,
            archTargetBaseY: 708.0, archMaxDepthY: 736.0, cellWidth: 1600.0, seamPhaseOffsetX: 0.0,
            skipZeroSeam: true, openingHalfWidth: 232.0, bowlHalfWidth: 416.0, bowlDropDepth: 148.0,
            minMainFloorForOpening: 680.0, graftStartMainY: 560.0, graftEndMainY: 880.0, graftFuseMainY: 760.0, seedSalt: 613
        ),
        SeabedTerraceTierSpec(
            tierIndex: 1, stripId: "rocky_shelf",
            baseRidgeY: 1220.0, minRidgeY: 1130.0, maxRidgeY: 1310.0, maxVisualRimY: 1475.0,
            archTargetBaseY: 1512.0, archMaxDepthY: 1545.0, cellWidth: 1800.0, seamPhaseOffsetX: 800.0,
            skipZeroSeam: false, openingHalfWidth: 248.0, bowlHalfWidth: 440.0, bowlDropDepth: 156.0,
            minMainFloorForOpening: 1500.0, graftStartMainY: 1370.0, graftEndMainY: 1710.0, graftFuseMainY: 1575.0, seedSalt: 1619
        ),
        SeabedTerraceTierSpec(
            tierIndex: 2, stripId: "rocky_shelf",
            baseRidgeY: 2220.0, minRidgeY: 2120.0, maxRidgeY: 2320.0, maxVisualRimY: 2495.0,
            archTargetBaseY: 2532.0, archMaxDepthY: 2568.0, cellWidth: 2000.0, seamPhaseOffsetX: 350.0,
            skipZeroSeam: false, openingHalfWidth: 266.0, bowlHalfWidth: 468.0, bowlDropDepth: 164.0,
            minMainFloorForOpening: 2520.0, graftStartMainY: 2380.0, graftEndMainY: 2750.0, graftFuseMainY: 2600.0, seedSalt: 2633
        ),
        SeabedTerraceTierSpec(
            tierIndex: 3, stripId: "underwater_canyon",
            baseRidgeY: 3460.0, minRidgeY: 3350.0, maxRidgeY: 3570.0, maxVisualRimY: 3755.0,
            archTargetBaseY: 3792.0, archMaxDepthY: 3832.0, cellWidth: 2200.0, seamPhaseOffsetX: 1100.0,
            skipZeroSeam: false, openingHalfWidth: 284.0, bowlHalfWidth: 496.0, bowlDropDepth: 172.0,
            minMainFloorForOpening: 3780.0, graftStartMainY: 3630.0, graftEndMainY: 4030.0, graftFuseMainY: 3865.0, seedSalt: 3671
        ),
        SeabedTerraceTierSpec(
            tierIndex: 4, stripId: "underwater_canyon",
            baseRidgeY: 5040.0, minRidgeY: 4910.0, maxRidgeY: 5170.0, maxVisualRimY: 5365.0,
            archTargetBaseY: 5402.0, archMaxDepthY: 5446.0, cellWidth: 2400.0, seamPhaseOffsetX: 600.0,
            skipZeroSeam: false, openingHalfWidth: 302.0, bowlHalfWidth: 524.0, bowlDropDepth: 180.0,
            minMainFloorForOpening: 5390.0, graftStartMainY: 5230.0, graftEndMainY: 5660.0, graftFuseMainY: 5480.0, seedSalt: 4723
        ),
        SeabedTerraceTierSpec(
            tierIndex: 5, stripId: "underwater_canyon",
            baseRidgeY: 7060.0, minRidgeY: 6910.0, maxRidgeY: 7210.0, maxVisualRimY: 7420.0,
            archTargetBaseY: 7456.0, archMaxDepthY: 7506.0, cellWidth: 2600.0, seamPhaseOffsetX: 1500.0,
            skipZeroSeam: false, openingHalfWidth: 324.0, bowlHalfWidth: 560.0, bowlDropDepth: 192.0,
            minMainFloorForOpening: 7440.0, graftStartMainY: 7270.0, graftEndMainY: 7740.0, graftFuseMainY: 7545.0, seedSalt: 5801
        ),
        SeabedTerraceTierSpec(
            tierIndex: 6, stripId: "underwater_canyon",
            baseRidgeY: 9640.0, minRidgeY: 9470.0, maxRidgeY: 9810.0, maxVisualRimY: 10030.0,
            archTargetBaseY: 10066.0, archMaxDepthY: 10122.0, cellWidth: 2900.0, seamPhaseOffsetX: 700.0,
            skipZeroSeam: false, openingHalfWidth: 350.0, bowlHalfWidth: 604.0, bowlDropDepth: 206.0,
            minMainFloorForOpening: 10050.0, graftStartMainY: 9880.0, graftEndMainY: 10380.0, graftFuseMainY: 10165.0, seedSalt: 6883
        ),
        SeabedTerraceTierSpec(
            tierIndex: 7, stripId: "deep_abyss",
            baseRidgeY: 12900.0, minRidgeY: 12710.0, maxRidgeY: 13090.0, maxVisualRimY: 13324.0,
            archTargetBaseY: 13360.0, archMaxDepthY: 13422.0, cellWidth: 3200.0, seamPhaseOffsetX: 1900.0,
            skipZeroSeam: false, openingHalfWidth: 380.0, bowlHalfWidth: 652.0, bowlDropDepth: 222.0,
            minMainFloorForOpening: 13340.0, graftStartMainY: 13160.0, graftEndMainY: 13700.0, graftFuseMainY: 13470.0, seedSalt: 7949
        ),
        SeabedTerraceTierSpec(
            tierIndex: 8, stripId: "deep_abyss",
            baseRidgeY: 16900.0, minRidgeY: 16690.0, maxRidgeY: 17110.0, maxVisualRimY: 17360.0,
            archTargetBaseY: 17396.0, archMaxDepthY: 17464.0, cellWidth: 3600.0, seamPhaseOffsetX: 900.0,
            skipZeroSeam: false, openingHalfWidth: 416.0, bowlHalfWidth: 710.0, bowlDropDepth: 240.0,
            minMainFloorForOpening: 17370.0, graftStartMainY: 17180.0, graftEndMainY: 17760.0, graftFuseMainY: 17515.0, seedSalt: 9013
        )
    ]

    public struct SeabedTerraceSample {
        public let isPresent: Bool
        public let isDiveOpening: Bool
        public let topY: Double
        public let bottomArchY: Double
        public let edgeFactor: Double
        public let caveFactor: Double
        public let slope: Double
        public let bottomSlope: Double
        public let tierIndex: Int
        public let stripId: String
    }

    /// Exact 1:1 port of Web evalTerraceSeabedContinuousRaw(worldX, tier, WorldConfig)
    private static func evalTerraceSeabedContinuousRaw(
        worldX: Double,
        tier: SeabedTerraceTierSpec
    ) -> (
        topY: Double,
        slope: Double,
        edgeWeight: Double,
        openingDepthFactor: Double,
        isDiveOpening: Bool,
        bottomArchY: Double,
        bottomSlope: Double
    ) {
        let seedPhase = (Double((123456789 + tier.seedSalt * 131) & 0xffff) / 65536.0) * .pi * 2.0
        let cellWave = evalSmoothTerrainWave(worldX, wavelength: tier.cellWidth, waveSalt: tier.seedSalt)
        let k1 = (.pi * 2.0) / (1180.0 + Double(tier.tierIndex) * 110.0)
        let k2 = (.pi * 2.0) / (560.0 + Double(tier.tierIndex) * 45.0)
        let k3 = (.pi * 2.0) / (290.0 + Double(tier.tierIndex) * 22.0)
        let k4 = (.pi * 2.0) / 155.0

        let ampScale = 1.0 + Double(tier.tierIndex) * 0.08
        let w1 = sin(worldX * k1 + seedPhase) * (32.0 * ampScale)
        let w2 = cos(worldX * k2 - seedPhase * 0.7 + 1.1) * (20.0 * ampScale)
        let w3 = sin(worldX * k3 + seedPhase * 1.3 + 2.4) * (11.0 * ampScale)
        let w4 = cos(worldX * k4 - seedPhase * 0.4 + 0.6) * 5.0
        let rawRidgeY = max(
            tier.minRidgeY,
            min(tier.maxRidgeY, tier.baseRidgeY + cellWave * (22.0 * ampScale) + w1 + w2 + w3 + w4)
        )

        let dRidgeDx =
            cos(worldX * k1 + seedPhase) * (32.0 * ampScale * k1) -
            sin(worldX * k2 - seedPhase * 0.7 + 1.1) * (20.0 * ampScale * k2) +
            cos(worldX * k3 + seedPhase * 1.3 + 2.4) * (11.0 * ampScale * k3) -
            sin(worldX * k4 - seedPhase * 0.4 + 0.6) * (5.0 * k4)

        let shiftedX = worldX - tier.seamPhaseOffsetX
        let rawSeamIdx = Int((shiftedX / tier.cellWidth).rounded())
        let nearestOpenSeamIdx: Int
        if tier.skipZeroSeam {
            nearestOpenSeamIdx = shiftedX >= 0.0 ? max(1, rawSeamIdx) : min(-1, rawSeamIdx)
        } else {
            nearestOpenSeamIdx = rawSeamIdx
        }
        let nearestOpenSeamX = Double(nearestOpenSeamIdx) * tier.cellWidth + tier.seamPhaseOffsetX
        let distFromSeam = worldX - nearestOpenSeamX
        let absDist = abs(distFromSeam)

        let seamMainFloorY = getFloorDepthAt(worldX: nearestOpenSeamX)
        let hasOpeningAtSeam = seamMainFloorY > tier.minMainFloorForOpening

        var openingDepthFactor = 0.0
        var dOpeningFactorDx = 0.0
        if hasOpeningAtSeam && absDist < tier.bowlHalfWidth {
            let rimNorm = absDist / tier.bowlHalfWidth
            openingDepthFactor = 0.5 * (1.0 + cos(rimNorm * .pi))
            if absDist > 1e-4 {
                dOpeningFactorDx = -0.5 * (.pi / tier.bowlHalfWidth) * sin(rimNorm * .pi) * (distFromSeam >= 0.0 ? 1.0 : -1.0)
            }
        }

        let bowlPower = 1.35
        let archBowlDrop = openingDepthFactor > 0.0 ? tier.bowlDropDepth * pow(openingDepthFactor, bowlPower) : 0.0
        let dArchBowlDropDx = openingDepthFactor > 1e-4
            ? tier.bowlDropDepth * bowlPower * pow(openingDepthFactor, bowlPower - 1.0) * dOpeningFactorDx
            : 0.0

        let visualRimY = max(tier.minRidgeY - 7.0, min(tier.maxVisualRimY, rawRidgeY + archBowlDrop))
        let visualRimSlope = max(-1.35, min(1.35, dRidgeDx + dArchBowlDropDx))

        let isDiveOpening = hasOpeningAtSeam && absDist < tier.openingHalfWidth
        let edgeWeight: Double
        if !hasOpeningAtSeam {
            edgeWeight = 1.0
        } else if isDiveOpening {
            edgeWeight = 0.0
        } else {
            edgeWeight = quinticSmoothstep(edge0: tier.openingHalfWidth, edge1: tier.openingHalfWidth + 160.0, x: absDist)
        }

        let topY = visualRimY
        let slope = visualRimSlope

        let wallRampSpan = 165.0
        let wallDropU: Double
        if !hasOpeningAtSeam {
            wallDropU = 1.0
        } else if isDiveOpening {
            wallDropU = 0.0
        } else {
            wallDropU = max(0.0, min(1.0, (absDist - tier.openingHalfWidth) / wallRampSpan))
        }
        let wallDropT: Double
        if wallDropU <= 0.0 {
            wallDropT = 0.0
        } else if wallDropU >= 1.0 {
            wallDropT = 1.0
        } else {
            wallDropT = wallDropU * wallDropU * wallDropU * (wallDropU * (wallDropU * 6.0 - 15.0) + 10.0)
        }
        let dWallDropTDx: Double
        if !hasOpeningAtSeam || isDiveOpening || wallDropU <= 0.0 || wallDropU >= 1.0 {
            dWallDropTDx = 0.0
        } else {
            dWallDropTDx = ((30.0 * wallDropU * wallDropU * (wallDropU - 1.0) * (wallDropU - 1.0)) / wallRampSpan) * (distFromSeam >= 0.0 ? 1.0 : -1.0)
        }

        let stalactiteWave = sin(worldX * 0.017 + seedPhase * 1.1) * 14.0 + cos(worldX * 0.029 - seedPhase * 0.6) * 8.0
        let dStalactiteDx = cos(worldX * 0.017 + seedPhase * 1.1) * (14.0 * 0.017) - sin(worldX * 0.029 - seedPhase * 0.6) * (8.0 * 0.029)

        let lipArchY = topY + 86.0
        let targetDeepArchY = max(topY + 195.0, min(tier.archMaxDepthY, tier.archTargetBaseY + stalactiteWave))
        let bottomArchY = lipArchY + (targetDeepArchY - lipArchY) * wallDropT
        let rawBottomSlope = slope * (1.0 - wallDropT) + wallDropT * dStalactiteDx + (targetDeepArchY - lipArchY) * dWallDropTDx
        let bottomSlope = max(-2.6, min(2.6, rawBottomSlope))

        return (
            topY: topY,
            slope: slope,
            edgeWeight: edgeWeight,
            openingDepthFactor: openingDepthFactor,
            isDiveOpening: isDiveOpening,
            bottomArchY: bottomArchY,
            bottomSlope: bottomSlope
        )
    }

    /// Samples any of the 9 continuous seabed terraces (tierIndex = 0..8) with 100% mathematical parity with Web getSeabedTerraceAt.
    public static func getSeabedTerraceAt(worldX: Double, tierIndex: Int = 0) -> SeabedTerraceSample {
        let clampedTier = max(0, min(seabedTerraceTiers.count - 1, tierIndex))
        let tier = seabedTerraceTiers[clampedTier]
        let raw = evalTerraceSeabedContinuousRaw(worldX: worldX, tier: tier)
        let mainFloorY = getFloorDepthAt(worldX: worldX)
        let mainSlope = getTerrainSlopeAt(worldX: worldX)

        if mainFloorY <= tier.graftStartMainY {
            return SeabedTerraceSample(
                isPresent: false,
                isDiveOpening: false,
                topY: mainFloorY,
                bottomArchY: max(raw.bottomArchY, mainFloorY + 60.0),
                edgeFactor: 0.0,
                caveFactor: 0.0,
                slope: mainSlope,
                bottomSlope: mainSlope,
                tierIndex: tier.tierIndex,
                stripId: tier.stripId
            )
        }

        let graftT = quinticSmoothstep(edge0: tier.graftStartMainY, edge1: tier.graftEndMainY, x: mainFloorY)
        let graftedTopY = mainFloorY + (raw.topY - mainFloorY) * graftT
        let graftedSlope = mainSlope + (raw.slope - mainSlope) * graftT
        let graftedBottomArchY: Double
        if mainFloorY < tier.graftFuseMainY {
            graftedBottomArchY = max(raw.bottomArchY, min(tier.archMaxDepthY + 6.0, mainFloorY + 48.0 * (1.0 - graftT * 0.5)))
        } else {
            graftedBottomArchY = min(mainFloorY - 22.0, max(graftedTopY + 86.0, raw.bottomArchY))
        }
        let graftedEdgeWeight = raw.edgeWeight * graftT

        return SeabedTerraceSample(
            isPresent: !raw.isDiveOpening && graftT > 0.03,
            isDiveOpening: raw.isDiveOpening && graftT > 0.02,
            topY: graftedTopY,
            bottomArchY: graftedBottomArchY,
            edgeFactor: graftedEdgeWeight,
            caveFactor: raw.openingDepthFactor * graftT,
            slope: graftedSlope,
            bottomSlope: raw.bottomSlope * graftT + mainSlope * (1.0 - graftT),
            tierIndex: tier.tierIndex,
            stripId: tier.stripId
        )
    }

    public static func getShallowCoralAtollAt(worldX: Double) -> SeabedTerraceSample {
        return getSeabedTerraceAt(worldX: worldX, tierIndex: 0)
    }

    public enum SeabedOutcropType: String {
        case CORAL_MOUND
        case ROCK_SPIRE
        case KELP_CLUSTER
        case ABYSSAL_CHIMNEY
    }

    public struct SeabedOutcropPlacement {
        public let worldX: Double
        public let baseY: Double
        public let width: Double
        public let height: Double
        public let type: SeabedOutcropType
        public let variant: Int
        public let seed: Double
    }

    /// Generates deterministic, naturally proportioned seabed outcrops along both the main seafloor AND all 9 seabed terraces
    /// (5 variants per family: 0..3 = 16 distinct stylized atlas sprites, 4 = rare composite cluster; strict anti-repetition between neighbors)
    public static func getSeabedOutcropsForChunk(chunkIndex: Int, chunkWidth: Double = 600.0) -> [SeabedOutcropPlacement] {
        var placements: [SeabedOutcropPlacement] = []
        let chunkStartX = Double(chunkIndex) * chunkWidth

        // 1. Main seafloor outcrops (natural 38m..68m height scale with neighbor non-repetition)
        let count = 2 + Int(floor(hash1D(chunkIndex, salt: 811) * 2.0)) // 2 or 3 per chunk
        let slotSpan = chunkWidth / Double(count)
        var prevMainVariant = -1
        var prevMainType: SeabedOutcropType? = nil

        for i in 0..<count {
            let h1 = hash1D(chunkIndex * 7 + i, salt: 823)
            let h2 = hash1D(chunkIndex * 13 + i, salt: 829)
            let h3 = hash1D(chunkIndex * 19 + i, salt: 839)
            let worldX = chunkStartX + (Double(i) + 0.16 + h1 * 0.68) * slotSpan
            let baseY = getFloorDepthAt(worldX: worldX)

            var type: SeabedOutcropType
            if baseY < 620.0 {
                type = h2 < 0.54 ? .CORAL_MOUND : (h2 < 0.82 ? .KELP_CLUSTER : .ROCK_SPIRE)
            } else if baseY < 1450.0 {
                type = h2 < 0.38 ? .CORAL_MOUND : (h2 < 0.72 ? .ROCK_SPIRE : .KELP_CLUSTER)
            } else {
                // Mix rocks, deep bioluminescent corals/anemones, and vents in the abyss so it's never all volcanoes!
                type = h2 < 0.46 ? .ROCK_SPIRE : (h2 < 0.76 ? .ABYSSAL_CHIMNEY : .CORAL_MOUND)
            }
            if type == prevMainType && type == .ABYSSAL_CHIMNEY {
                type = .ROCK_SPIRE
            }

            // Variant 0..3 = 16 distinct individual sprites from world_ecology_atlas; Variant 4 = rare standalone cluster (~12% chance, never twice in a row)
            var variant = h3 > 0.88 ? 4 : Int(floor((h3 / 0.88) * 4.0))
            if variant == prevMainVariant {
                variant = (variant + 1) % 4
            }
            prevMainVariant = variant
            prevMainType = type

            let width: Double
            let height: Double
            switch type {
            case .CORAL_MOUND:
                width = 52.0 + h2 * 34.0
                height = 38.0 + h3 * 26.0
            case .KELP_CLUSTER:
                width = 46.0 + h2 * 28.0
                height = 52.0 + h3 * 34.0
            case .ROCK_SPIRE:
                width = 54.0 + h2 * 36.0
                height = 40.0 + h3 * 28.0
            case .ABYSSAL_CHIMNEY:
                width = 50.0 + h2 * 32.0
                height = 42.0 + h3 * 28.0
            }

            placements.append(SeabedOutcropPlacement(
                worldX: worldX, baseY: baseY, width: width, height: height,
                type: type, variant: variant, seed: h1
            ))
        }

        // 2. Multi-Tier Seabed Terrace Outcrops across all 9 tiers (tierIndex = 0..8)
        let terraceSlotCount = 2
        let terraceSlotSpan = chunkWidth / Double(terraceSlotCount)
        for tierIdx in 0..<seabedTerraceTiers.count {
            let saltOffset = tierIdx * 197
            var prevTerraceVariant = -1
            for i in 0..<terraceSlotCount {
                let h1 = hash1D(chunkIndex * 11 + i, salt: 911 + saltOffset)
                if tierIdx >= 4 && h1 < 0.32 { continue }
                let h2 = hash1D(chunkIndex * 17 + i, salt: 919 + saltOffset)
                let h3 = hash1D(chunkIndex * 23 + i, salt: 929 + saltOffset)
                let worldX = chunkStartX + (Double(i) + 0.16 + h1 * 0.68) * terraceSlotSpan
                let terrace = getSeabedTerraceAt(worldX: worldX, tierIndex: tierIdx)
                if terrace.isPresent && terrace.edgeFactor > 0.24 {
                    let type: SeabedOutcropType
                    if tierIdx == 0 {
                        type = h2 < 0.56 ? .CORAL_MOUND : (h2 < 0.84 ? .KELP_CLUSTER : .ROCK_SPIRE)
                    } else if tierIdx == 1 {
                        type = h2 < 0.44 ? .CORAL_MOUND : (h2 < 0.76 ? .ROCK_SPIRE : .KELP_CLUSTER)
                    } else if tierIdx <= 3 {
                        type = h2 < 0.36 ? .CORAL_MOUND : (h2 < 0.78 ? .ROCK_SPIRE : .KELP_CLUSTER)
                    } else {
                        type = h2 < 0.52 ? .ROCK_SPIRE : (h2 < 0.80 ? .ABYSSAL_CHIMNEY : .CORAL_MOUND)
                    }

                    var variant = h3 > 0.88 ? 4 : Int(floor((h3 / 0.88) * 4.0))
                    if variant == prevTerraceVariant {
                        variant = (variant + 1) % 4
                    }
                    prevTerraceVariant = variant

                    let sizeScale = 0.88 + Double((chunkIndex + i + tierIdx) % 3) * 0.08
                    let width: Double
                    let height: Double
                    switch type {
                    case .CORAL_MOUND:
                        width = (50.0 + h2 * 32.0) * sizeScale
                        height = (36.0 + h3 * 24.0) * sizeScale
                    case .KELP_CLUSTER:
                        width = (44.0 + h2 * 26.0) * sizeScale
                        height = (48.0 + h3 * 32.0) * sizeScale
                    default:
                        width = (52.0 + h2 * 34.0) * sizeScale
                        height = (38.0 + h3 * 26.0) * sizeScale
                    }

                    placements.append(SeabedOutcropPlacement(
                        worldX: worldX, baseY: terrace.topY, width: width, height: height,
                        type: type, variant: variant, seed: h1
                    ))
                }
            }
        }

        return placements
    }

    public struct SeabedCollisionResult {
        public let y: Double
        public let vy: Double
        public let hitSeabed: Bool
        public let hitAtollUnderside: Bool
        public let floorY: Double
        public let slope: Double
    }

    /// Physical Seabed Two-Way Collision Solver (Prevents swimming through the main seafloor or any of the 9 seabed terraces from above, below, or horizontally!)
    public static func resolveSeabedCollision(
        worldX: Double,
        worldY: Double,
        vy: Double,
        entityRadius: Double,
        clearancePadding: Double = 6.0,
        prevWorldY: Double? = nil
    ) -> SeabedCollisionResult {
        let mainFloorY = getFloorDepthAt(worldX: worldX)
        let mainSlope = getTerrainSlopeAt(worldX: worldX)
        let maxAllowedMainY = mainFloorY - (entityRadius + clearancePadding)
        let refPrevY = prevWorldY ?? (worldY - vy * 0.016)
        let clearance = entityRadius + clearancePadding

        // 1. Check all 9 seabed terraces (zero dead-zone inside [terraceTopMaxY, terraceUndersideMinY]!)
        for tierIdx in 0..<seabedTerraceTiers.count {
            let spec = seabedTerraceTiers[tierIdx]
            let bandMinY = spec.baseDepth - 240.0 - clearance
            let bandMaxY = spec.baseDepth + spec.thicknessBase + 380.0 + clearance
            if (worldY < bandMinY && refPrevY < bandMinY) || (worldY > bandMaxY && refPrevY > bandMaxY) {
                continue
            }

            let terrace = getSeabedTerraceAt(worldX: worldX, tierIndex: tierIdx)
            guard terrace.isPresent else { continue }

            // Solid graft mountain wedge when main seafloor rises above terrace bottomArchY (zero under-corridor)
            let hasUnderCorridor = (mainFloorY - terrace.bottomArchY) > (clearance * 1.25)
            if !hasUnderCorridor {
                let wedgeTopY = min(terrace.topY, mainFloorY)
                let wedgeTopMaxY = min(maxAllowedMainY, wedgeTopY - clearance)
                if worldY > wedgeTopMaxY && refPrevY >= spec.baseDepth - 240.0 - clearance - 260.0 {
                    let wedgeSlope = terrace.topY <= mainFloorY ? terrace.slope : mainSlope
                    return SeabedCollisionResult(
                        y: wedgeTopMaxY,
                        vy: min(0.0, vy * -0.12),
                        hitSeabed: true,
                        hitAtollUnderside: false,
                        floorY: wedgeTopY,
                        slope: wedgeSlope
                    )
                }
                continue
            }

            let terraceTopMaxY = min(maxAllowedMainY, terrace.topY - clearance)
            let terraceUndersideMinY = terrace.bottomArchY + clearance * 0.90

            if worldY > terraceTopMaxY && worldY < terraceUndersideMinY {
                let isFromBelow = refPrevY > terrace.topY + 4.0
                    || (refPrevY > terrace.topY - clearance * 0.25 && vy < -1e-3)

                if !isFromBelow {
                    return SeabedCollisionResult(
                        y: terraceTopMaxY,
                        vy: min(0.0, vy * -0.12),
                        hitSeabed: true,
                        hitAtollUnderside: false,
                        floorY: terrace.topY,
                        slope: terrace.slope
                    )
                } else {
                    let clampedUnderY = min(maxAllowedMainY, terraceUndersideMinY)
                    return SeabedCollisionResult(
                        y: clampedUnderY,
                        vy: max(0.0, vy * -0.15),
                        hitSeabed: false,
                        hitAtollUnderside: true,
                        floorY: terrace.bottomArchY,
                        slope: terrace.bottomSlope
                    )
                }
            }
        }

        // 2. Main continuous seafloor collision
        if worldY > maxAllowedMainY {
            return SeabedCollisionResult(
                y: maxAllowedMainY,
                vy: min(0.0, vy * -0.12),
                hitSeabed: true,
                hitAtollUnderside: false,
                floorY: mainFloorY,
                slope: mainSlope
            )
        }

        return SeabedCollisionResult(
            y: worldY, vy: vy, hitSeabed: false, hitAtollUnderside: false,
            floorY: mainFloorY, slope: mainSlope
        )
    }

    public struct SeabedKineticStepResult {
        public let x: Double
        public let y: Double
        public let vx: Double
        public let vy: Double
        public let hitSeabed: Bool
        public let hitAtollUnderside: Bool
        public let floorY: Double
        public let slope: Double
    }

    private static func hitsTerraceVerticalWallHorizontally(
        prevX: Double,
        prevY: Double,
        candX: Double,
        entityRadius: Double,
        clearancePadding: Double
    ) -> Bool {
        if abs(candX - prevX) < 1e-6 { return false }
        let clearance = max(0.0, entityRadius + clearancePadding)
        let candMainY = getFloorDepthAt(worldX: candX)

        for tierIdx in 0..<seabedTerraceTiers.count {
            let spec = seabedTerraceTiers[tierIdx]
            let bandMinY = spec.baseDepth - 240.0 - clearance
            let bandMaxY = spec.baseDepth + spec.thicknessBase + 380.0 + clearance
            if prevY < bandMinY || prevY > bandMaxY {
                continue
            }

            let nextT = getSeabedTerraceAt(worldX: candX, tierIndex: tierIdx)
            if !nextT.isPresent { continue }

            let prevT = getSeabedTerraceAt(worldX: prevX, tierIndex: tierIdx)
            let candHasUnderCorridor = (candMainY - nextT.bottomArchY) > (clearance * 1.25)

            // Case A: Crossing from an open cave/graft void (!prevT.isPresent) directly horizontally into a cliff wall
            if !prevT.isPresent {
                let insideVerticalCliff = prevY > nextT.topY - clearance * 0.15
                    && (!candHasUnderCorridor || prevY < nextT.bottomArchY + clearance * 0.35)
                if insideVerticalCliff {
                    return true
                }
            }

            // Case B: Attempting to squeeze horizontally into a pinched graft mountain wedge (clearance < 2 * r + 4)
            if prevY > nextT.topY + 4.0
                && (candMainY - nextT.bottomArchY) < (clearance * 2.0 + 4.0)
                && prevY > min(nextT.topY, candMainY) - clearance * 0.15 {
                return true
            }
        }
        return false
    }

    /// Full 2D Kinetic Seabed Step with Sub-Stepping, 2D Cliff-Wall Blocking, Unit-Tangent Vector Projection & 8-Iteration Binary Search Arc-Length Conservation
    public static func resolveSeabedKineticStep(
        prevX: Double,
        prevY: Double,
        nextX: Double,
        nextY: Double,
        vx: Double,
        vy: Double,
        entityRadius: Double,
        clearancePadding: Double = 6.0
    ) -> SeabedKineticStepResult {
        let totalDx = nextX - prevX
        let totalDy = nextY - prevY
        let dist = hypot(totalDx, totalDy)
        let steps = max(1, min(6, Int(ceil(dist / max(8.0, entityRadius * 0.45)))))
        let stepDx = totalDx / Double(steps)
        let stepDy = totalDy / Double(steps)
        let maxSubstepDist = dist / Double(steps)
        let intendedSpeed = hypot(vx, vy)

        var curX = prevX
        var curY = prevY
        var curVx = vx
        var curVy = vy
        var hitSeabed = false
        var hitAtollUnderside = false
        var lastFloorY = getFloorDepthAt(worldX: nextX)
        var lastSlope = 0.0

        for _ in 1...steps {
            let stepPrevX = curX
            let stepPrevY = curY
            let rawTargetX = stepPrevX + stepDx
            let targetY = stepPrevY + stepDy

            var targetX = rawTargetX
            var hitWallHorizontally = false
            if hitsTerraceVerticalWallHorizontally(
                prevX: stepPrevX,
                prevY: stepPrevY,
                candX: rawTargetX,
                entityRadius: entityRadius,
                clearancePadding: clearancePadding
            ) {
                hitWallHorizontally = true
                var lo = 0.0
                var hi = 1.0
                var safeX = stepPrevX
                for _ in 0..<6 {
                    let mid = (lo + hi) * 0.5
                    let cx = stepPrevX + (rawTargetX - stepPrevX) * mid
                    if hitsTerraceVerticalWallHorizontally(
                        prevX: stepPrevX,
                        prevY: stepPrevY,
                        candX: cx,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding
                    ) {
                        hi = mid
                    } else {
                        lo = mid
                        safeX = cx
                    }
                }
                targetX = safeX
            }

            let col = resolveSeabedCollision(
                worldX: targetX,
                worldY: targetY,
                vy: curVy,
                entityRadius: entityRadius,
                clearancePadding: clearancePadding,
                prevWorldY: stepPrevY
            )

            lastFloorY = col.floorY
            lastSlope = col.slope
            let tangentScale = 1.0 / sqrt(1.0 + col.slope * col.slope)

            if col.hitAtollUnderside {
                hitAtollUnderside = true
                let effStepDx = hitWallHorizontally ? 0.0 : stepDx
                let dotParallel = (effStepDx + max(0.0, stepDy) * col.slope) * tangentScale
                let isPushingIntoSlope = effStepDx * col.slope > 1e-6
                let stepTangentMag: Double
                if isPushingIntoSlope {
                    if effStepDx * dotParallel <= 0.0 {
                        stepTangentMag = 0.0
                    } else {
                        stepTangentMag = max(-maxSubstepDist * 0.88, min(maxSubstepDist * 0.88, dotParallel * 0.88))
                    }
                } else {
                    stepTangentMag = effStepDx * 0.88
                }
                let projectedX = hitWallHorizontally
                    ? targetX
                    : (stepPrevX + (isPushingIntoSlope ? stepTangentMag * tangentScale : stepTangentMag))
                let maxAllowed = isPushingIntoSlope
                    ? min(maxSubstepDist * 0.88, max(maxSubstepDist * 0.25, abs(stepTangentMag)))
                    : maxSubstepDist * 0.88

                var finalStepX = projectedX
                if hitsTerraceVerticalWallHorizontally(
                    prevX: stepPrevX,
                    prevY: stepPrevY,
                    candX: finalStepX,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding
                ) {
                    finalStepX = targetX
                    hitWallHorizontally = true
                }

                let secondCol = resolveSeabedCollision(
                    worldX: finalStepX,
                    worldY: targetY,
                    vy: curVy,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    prevWorldY: stepPrevY
                )
                var finalStepY = secondCol.hitAtollUnderside ? secondCol.y : max(targetY, col.y)

                let actualSubDist = hypot(finalStepX - stepPrevX, finalStepY - stepPrevY)
                if actualSubDist > maxAllowed && actualSubDist > 1e-6 && maxAllowed > 1e-6 {
                    let prevColAtStart = resolveSeabedCollision(
                        worldX: stepPrevX,
                        worldY: stepPrevY,
                        vy: curVy,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        prevWorldY: stepPrevY
                    )
                    let startMinY = prevColAtStart.hitAtollUnderside ? prevColAtStart.y : stepPrevY
                    var lo = 0.0
                    var hi = 1.0
                    var bestX = stepPrevX
                    var bestY = max(startMinY, min(finalStepY, stepPrevY + maxAllowed * 0.35))

                    for _ in 0..<8 {
                        let mid = (lo + hi) * 0.5
                        let candX = stepPrevX + (finalStepX - stepPrevX) * mid
                        let candRawY = stepPrevY + stepDy * mid
                        let candCol = resolveSeabedCollision(
                            worldX: candX,
                            worldY: candRawY,
                            vy: curVy,
                            entityRadius: entityRadius,
                            clearancePadding: clearancePadding,
                            prevWorldY: stepPrevY
                        )
                        let candY = (candCol.hitAtollUnderside || candCol.hitSeabed) ? candCol.y : candRawY
                        let candDist = hypot(candX - stepPrevX, candY - stepPrevY)
                        if candDist <= maxAllowed * 1.0005 {
                            lo = mid
                            bestX = candX
                            bestY = candY
                        } else {
                            hi = mid
                        }
                    }
                    finalStepX = bestX
                    finalStepY = bestY
                }

                curX = finalStepX
                curY = finalStepY
                let vParallel = (vx + max(0.0, vy) * col.slope) * tangentScale
                curVx = hitWallHorizontally ? 0.0 : (isPushingIntoSlope ? (vParallel * tangentScale * 0.88) : (vx * 0.88))
                curVy = vy < 0.0 ? 0.0 : vy * tangentScale * 0.88
            } else if col.hitSeabed {
                hitSeabed = true
                let effStepDx = hitWallHorizontally ? 0.0 : stepDx
                let isUphill = effStepDx * col.slope < -1e-5
                let effDy = isUphill ? min(0.0, stepDy) : max(0.0, stepDy)
                let dotParallel = (effStepDx + effDy * col.slope) * tangentScale
                let damp = isUphill ? 0.88 : 0.90
                let stepTangentMag: Double
                if effStepDx * dotParallel <= 0.0 {
                    stepTangentMag = 0.0
                } else {
                    stepTangentMag = max(-maxSubstepDist * damp, min(maxSubstepDist * damp, dotParallel * damp))
                }
                let projectedX = hitWallHorizontally ? targetX : (stepPrevX + stepTangentMag * tangentScale)
                let maxAllowed = min(maxSubstepDist * damp, max(maxSubstepDist * 0.25, abs(stepTangentMag)))

                var finalStepX = projectedX
                if hitsTerraceVerticalWallHorizontally(
                    prevX: stepPrevX,
                    prevY: stepPrevY,
                    candX: finalStepX,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding
                ) {
                    finalStepX = targetX
                    hitWallHorizontally = true
                }

                let secondCol = resolveSeabedCollision(
                    worldX: finalStepX,
                    worldY: targetY,
                    vy: curVy,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    prevWorldY: stepPrevY
                )
                var finalStepY = secondCol.hitSeabed ? secondCol.y : min(targetY, col.y)

                let actualSubDist = hypot(finalStepX - stepPrevX, finalStepY - stepPrevY)
                if actualSubDist > maxAllowed && actualSubDist > 1e-6 && maxAllowed > 1e-6 {
                    let prevColAtStart = resolveSeabedCollision(
                        worldX: stepPrevX,
                        worldY: stepPrevY,
                        vy: curVy,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        prevWorldY: stepPrevY
                    )
                    let startMaxY = prevColAtStart.hitSeabed ? prevColAtStart.y : stepPrevY
                    var lo = 0.0
                    var hi = 1.0
                    var bestX = stepPrevX
                    var bestY = min(startMaxY, max(finalStepY, stepPrevY - maxAllowed * 0.35))

                    for _ in 0..<8 {
                        let mid = (lo + hi) * 0.5
                        let candX = stepPrevX + (finalStepX - stepPrevX) * mid
                        let candRawY = stepPrevY + stepDy * mid
                        let candCol = resolveSeabedCollision(
                            worldX: candX,
                            worldY: candRawY,
                            vy: curVy,
                            entityRadius: entityRadius,
                            clearancePadding: clearancePadding,
                            prevWorldY: stepPrevY
                        )
                        let candY = (candCol.hitSeabed || candCol.hitAtollUnderside) ? candCol.y : candRawY
                        let candDist = hypot(candX - stepPrevX, candY - stepPrevY)
                        if candDist <= maxAllowed * 1.0005 {
                            lo = mid
                            bestX = candX
                            bestY = candY
                        } else {
                            hi = mid
                        }
                    }
                    finalStepX = bestX
                    finalStepY = bestY
                }

                curX = finalStepX
                curY = finalStepY
                let vParallel = (vx + (isUphill ? min(0.0, vy) : max(0.0, vy)) * col.slope) * tangentScale
                curVx = hitWallHorizontally ? 0.0 : (vParallel * tangentScale * damp)
                curVy = vy > 0.0 ? 0.0 : vy * tangentScale * damp
            } else {
                curX = targetX
                curY = col.y
                if hitWallHorizontally {
                    hitSeabed = true
                    curVx = 0.0
                }
            }
        }

        let capSpeed = (hitSeabed || hitAtollUnderside) ? intendedSpeed * 0.90 : intendedSpeed
        let outSpeed = hypot(curVx, curVy)
        if outSpeed > capSpeed && outSpeed > 1e-6 {
            let s = capSpeed / outSpeed
            curVx *= s
            curVy *= s
        }

        return SeabedKineticStepResult(
            x: curX,
            y: curY,
            vx: curVx,
            vy: curVy,
            hitSeabed: hitSeabed,
            hitAtollUnderside: hitAtollUnderside,
            floorY: lastFloorY,
            slope: lastSlope
        )
    }

    public static func sampleParallaxTerrainModulation(worldX: Double, depthY: Double) -> ProceduralTerrainModulation {
        return ProceduralTerrainModulation(
            farRidgeOffsetPx: 0.0,
            midStratumOffsetPx: 0.0,
            nearSeabedOffsetPx: 0.0,
            reliefMultiplier: 1.0,
            seabedBiasPx: 0.0,
            schoolClusterProbability: 0.72
        )
    }

    /// Computes evolved shark stats for any of the 48 shark forms
    public static func computeEvolvedSharkStats(
        inRunLevel: Int,
        sharkFormId: String,
        upgradeLevel: Int = 1,
        frenzyActive: Bool = false,
        globalDifficultyMultiplier: Double = 1.0,
        unlockedCount: Int = 1
    ) -> ComputedSharkStats {
        let form = GameConfigGenerated.sharkForms.first(where: { $0.id == sharkFormId })
            ?? GameConfigGenerated.sharkForms[0]
        let upLv = max(1, min(10, upgradeLevel))
        let extraUnlocked = Double(max(0, unlockedCount - 1))

        let collectionHpMult = 1.0 + extraUnlocked * 0.02
        let collectionSpeedBonus = extraUnlocked * 0.008
        let collectionRewardMult = 1.0 + extraUnlocked * 0.025

        let upgradeHpMult = 1.0 + Double(upLv - 1) * 0.08
        let upgradeSpeedBonus = Double(upLv - 1) * 0.022
        let upgradeDrainRed = Double(upLv - 1) * 0.015
        let upgradeBoostRed = Double(upLv - 1) * 0.018
        let upgradeBiteBonus = upLv >= 10 ? 2 : (upLv >= 5 ? 1 : 0)

        let inRunBiteBonus: Int
        if form.index == 0 && inRunLevel >= 2 {
            inRunBiteBonus = 1 + (inRunLevel - 2) / 3
        } else {
            inRunBiteBonus = max(0, (inRunLevel - 1) / 3)
        }

        let genMaxBiteTier = min(8, form.baseBiteTier + 2)
        let rawBiteTier = min(genMaxBiteTier, form.baseBiteTier + upgradeBiteBonus + inRunBiteBonus)
        let normalBiteTier = min(8, rawBiteTier)
        let biteTier = frenzyActive ? 8 : normalBiteTier

        let scale = min(
            1.28,
            1.0 + Double(inRunLevel - 1) * 0.028 + Double(form.row) * 0.025 + Double(upLv - 1) * 0.006
        )
        let growthIndex = Double(inRunLevel - 1) * 0.12 + Double(form.row) * 0.14 + Double(upLv - 1) * 0.02
        let relativePreyScale = max(0.4, 1.0 / (1.0 + growthIndex))
        let cameraZoom = max(0.88, 1.0 / (1.0 + (scale - 1.0) * 0.42))

        let hpDrainReduction = min(0.58, form.hpDrainReduction + upgradeDrainRed)
        let boostCostReduction = min(0.68, form.boostCostReduction + upgradeBoostRed)

        let totalSpeedBonus = form.speedBonus + upgradeSpeedBonus + collectionSpeedBonus + Double(inRunLevel - 1) * 0.028
        let baseSpeed = GameConfigGenerated.baseSharkSpeed * (1.0 + totalSpeedBonus)
        let moveSpeed = frenzyActive ? baseSpeed * 1.35 : baseSpeed
        let boostSpeed = moveSpeed * GameConfigGenerated.boostSpeedMultiplier

        let metabolicBaseDrain = (GameConfigGenerated.baseHpDrainPerSec + Double(inRunLevel - 1) * 0.65)
            * (1.0 + max(0.0, globalDifficultyMultiplier - 1.0) * 0.52)
        let hpDrainPerSec = frenzyActive ? 0.0 : metabolicBaseDrain * (1.0 - hpDrainReduction)
        let boostDrainPerSec = frenzyActive ? 0.0 : GameConfigGenerated.baseBoostDrainPerSec * (1.0 - boostCostReduction)

        let magnetRadius = (GameConfigGenerated.baseMagnetRadius + form.magnetBonus + Double(upLv - 1) * 8.0 + Double(inRunLevel - 1) * 10.0)
            * (frenzyActive ? 1.35 : 1.0)
        let maxHp = (form.baseHp + Double(inRunLevel - 1) * 16.0) * upgradeHpMult * collectionHpMult
        let maxEnergy = form.baseEnergy + Double(upLv - 1) * 5.0 + Double(inRunLevel - 1) * 4.0

        let jawSuctionMultiplier: Double = form.lineage == .APEX_BIO ? 1.18 : 1.0
        let baseRewardMult = collectionRewardMult * (1.0 + Double(form.row) * 0.12)
        let canEatMines = form.row >= 5 && (form.lineage == .CYBER_MECHA || form.lineage == .ELDER_ABYSS || form.id == "shark_47_omega_devourer")

        return ComputedSharkStats(
            level: inRunLevel,
            scale: scale,
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
            frenzyDurationBonus: form.lineage == .ELEMENTAL_CORE ? 1.0 + Double(form.row) * 0.3 : 0.0,
            jawSuctionMultiplier: jawSuctionMultiplier,
            coinYieldMultiplier: baseRewardMult,
            geneYieldMultiplier: baseRewardMult * (form.lineage == .ELDER_ABYSS ? 1.15 : 1.0),
            damageTakenMultiplier: 1.0,
            canEatMines: canEatMines,
            parallaxScales: getParallaxLayerGrowthScales(relativePreyScale: relativePreyScale)
        )
    }

    /// Strict Visual Size === Edible Contract (<= 64% shark size for edible prey, >= 118% for dangerous prey)
    public static func getPreyRelativeVisualScale(
        prey: PreyTierConfig,
        sharkStats: ComputedSharkStats,
        mutationVariant: PreyMutationVariant = .NONE
    ) -> Double {
        let effectiveTier = mutationVariant == .ABYSS_BEHEMOTH ? min(8, prey.tier + 1) : prey.tier
        let visualBiteTier = sharkStats.normalBiteTier
        let canDevourNormally = prey.isHazard ? sharkStats.canEatMines : (visualBiteTier >= effectiveTier)
        let sharkParityScale = (sharkEquivalentRadius * sharkStats.scale) / max(1.0, prey.radius)

        if canDevourNormally {
            let tierDiff = Double(max(0, visualBiteTier - effectiveTier))
            let tierRatio = max(0.18, 0.64 * pow(0.79, tierDiff))
            let levelShrink = 0.64 + 0.36 * sharkStats.relativePreyScale
            let targetSharkRatio = max(0.16, min(0.64, tierRatio * levelShrink))
            return sharkParityScale * targetSharkRatio * defaultPreySizeMultiplier
        } else {
            let overTier = Double(max(1, effectiveTier - visualBiteTier))
            let behemothExtra = mutationVariant == .ABYSS_BEHEMOTH ? 0.12 : 0.0
            let bossExtra = prey.isBoss ? 0.14 : 0.0
            let targetDangerRatio = min(1.95, 1.18 + (overTier - 1.0) * 0.17 + behemothExtra + bossExtra)
            return sharkParityScale * targetDangerRatio * defaultPreySizeMultiplier
        }
    }

    /// Collision encounter resolution (DEVOUR vs ARMOR_CRUSH vs DAMAGE)
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
        let effectiveTier = mutationVariant == .ABYSS_BEHEMOTH ? min(8, prey.tier + 1) : prey.tier
        if sharkStats.biteTier >= effectiveTier {
            return .DEVOUR
        }
        if effectiveTier == sharkStats.biteTier + 1 && isBoosting {
            return .ARMOR_CRUSH
        }
        return .DAMAGE
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
