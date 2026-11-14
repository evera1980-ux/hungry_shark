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

    // MARK: - Procedural Ocean World System (L0 Macro Zones + L1 Multi-Octave Terrain + L3 Environmental Probabilities)
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

    public static func getTerrainHeight(worldX: Double) -> Double {
        return noise1D(worldX * 0.0005, salt: 11) * 500.0
            + noise1D(worldX * 0.002, salt: 23) * 150.0
            + noise1D(worldX * 0.008, salt: 37) * 30.0
    }

    public static func sampleColumnContourOffsetPx(worldX: Double, depthY: Double, layerKind: Int) -> Double {
        let mod = sampleParallaxTerrainModulation(worldX: worldX, depthY: depthY)
        let rawH = getTerrainHeight(worldX: worldX)
        let ridgeWave = tanh(rawH / 320.0)
        if layerKind == 0 {
            // FAR
            let farWave = noise1D(worldX * 0.0012 + 3.7, salt: 193) * 0.65 + ridgeWave * 0.35
            return (-farWave * 38.0 * mod.reliefMultiplier) + max(0.0, mod.seabedBiasPx * 0.45)
        } else if layerKind == 1 {
            // MID
            let midWave = noise1D(worldX * 0.0022 + 11.4, salt: 149) * 0.55 + ridgeWave * 0.45
            return (-midWave * 46.0 * mod.reliefMultiplier) + mod.seabedBiasPx * 0.85
        } else {
            // NEAR
            let detailWave = noise1D(worldX * 0.0045 + 5.2, salt: 37) * 14.0
            return (-ridgeWave * 36.0 * mod.reliefMultiplier - detailWave) + mod.seabedBiasPx
        }
    }

    public static func sampleParallaxTerrainModulation(worldX: Double, depthY: Double) -> ProceduralTerrainModulation {
        let baseMacroSpan = 960.0
        let warpedX = worldX + noise1D(worldX * 0.00035, salt: 307) * 240.0
        let scaledCoord = warpedX / baseMacroSpan
        let cellIdx = Int(floor(scaledCoord))
        let cellFrac = scaledCoord - Double(cellIdx)

        func presetForCell(_ cIdx: Int) -> (relief: Double, bias: Double, clusterProb: Double) {
            let m = ((cIdx % 4) + 4) % 4
            if depthY <= 520.0 {
                switch m {
                case 0: return (1.05, -6.0, 0.78)  // SHALLOW_CORAL_REEF
                case 1: return (0.36, 26.0, 0.42)  // SANDY_OPEN_FLAT
                case 2: return (1.42, -18.0, 0.85) // DENSE_REEF_PASSAGE
                default: return (1.62, 12.0, 0.64) // SUBMARINE_CANYON_DROP
                }
            } else if depthY <= 1150.0 {
                switch m {
                case 0: return (1.62, 12.0, 0.64)
                case 1: return (1.42, -18.0, 0.85)
                case 2: return (1.18, -8.0, 0.82)  // BIOLUMINESCENT_GROVE
                default: return (0.48, 22.0, 0.50) // ABYSSAL_PLAIN_EXPANSE
                }
            } else {
                let m3 = ((cIdx % 3) + 3) % 3
                switch m3 {
                case 0: return (0.48, 22.0, 0.50)
                case 1: return (1.18, -8.0, 0.82)
                default: return (1.75, 18.0, 0.38) // HADAL_TRENCH_CHASM
                }
            }
        }

        let pA = presetForCell(cellIdx)
        var pB = pA
        var t = 0.0
        if cellFrac < 0.28 {
            pB = presetForCell(cellIdx - 1)
            t = (1.0 - quinticSmoothstep(edge0: 0.0, edge1: 0.28, x: cellFrac)) * 0.5
        } else if cellFrac > 0.72 {
            pB = presetForCell(cellIdx + 1)
            t = quinticSmoothstep(edge0: 0.72, edge1: 1.0, x: cellFrac) * 0.5
        }

        let relief = pA.relief * (1.0 - t) + pB.relief * t
        let bias = pA.bias * (1.0 - t) + pB.bias * t
        let clusterProb = pA.clusterProb * (1.0 - t) + pB.clusterProb * t

        let rawH = getTerrainHeight(worldX: worldX)
        let normRidge = tanh(rawH / 360.0)
        let farOffset = max(0.0, (0.5 - 0.5 * normRidge) * 22.0 * relief)
        let midOffset = max(0.0, (0.5 - 0.5 * noise1D(worldX * 0.0014, salt: 61)) * 30.0 * relief + max(0.0, bias * 0.55))
        let nearOffset = max(0.0, (0.5 - 0.5 * normRidge) * 26.0 * relief + max(0.0, bias))

        return ProceduralTerrainModulation(
            farRidgeOffsetPx: farOffset,
            midStratumOffsetPx: midOffset,
            nearSeabedOffsetPx: nearOffset,
            reliefMultiplier: relief,
            seabedBiasPx: bias,
            schoolClusterProbability: clusterProb
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

    /// Continuous bathymetric water color interpolation across 0m ~ 2200m+
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
            (1480, 9, 8, 26),
            (1950, 24, 8, 14)
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
