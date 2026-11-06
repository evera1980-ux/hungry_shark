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

public struct SharkMetaSaveData: Codable, Sendable {
    public var selectedSharkId: String
    public var unlockedSharkIds: [String]
    public var sharkUpgradeLevels: [String: Int]
    public var bankedCoins: Int
    public var bankedGenes: Int
    public var bestInRunLevel: Int
    public var maxDepthReached: Double
    public var totalRuns: Int
    public var language: String
    public var soundEnabled: Bool

    public static func createDefault() -> SharkMetaSaveData {
        SharkMetaSaveData(
            selectedSharkId: "shark_00_clown_fry",
            unlockedSharkIds: ["shark_00_clown_fry"],
            sharkUpgradeLevels: ["shark_00_clown_fry": 1],
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
    public static let sharkBaseDrawSize: Double = 96.0
    public static let preyRadiusToDrawSize: Double = 2.25
    public static let sharkEquivalentRadius: Double = 96.0 / 2.25 // 42.6667
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
