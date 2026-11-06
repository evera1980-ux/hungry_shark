import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CONFIG } from '../src/game/config';
import { SHARK_EVOLUTION_FORMS } from '../src/game/sharkEvolutionConfig';
import {
  SHARK_CELL_BOUNDS,
  SPRITE_CELL_BOUNDS,
  FISH2_CELL_BOUNDS,
  UI_ICON_GRID_MAP,
  UI_BANNER_BOUNDS,
  UI_SETTING_BOUNDS,
} from '../src/game/spriteSheetManager';
import { I18N } from '../src/game/i18n';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const IOS_ROOT = path.join(ROOT_DIR, 'ios-native');
const APP_DIR = path.join(IOS_ROOT, 'HungrySharkEvolution');

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeSwiftString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function generateSwiftConfigFile(): string {
  const sharkEntries = SHARK_EVOLUTION_FORMS.map((s) => {
    const bounds = SHARK_CELL_BOUNDS[s.spriteKey] ?? [0, 0, 0.125, 0.166];
    return `        SharkFormConfig(
            index: ${s.index},
            row: ${s.row},
            col: ${s.col},
            generation: ${s.generation},
            id: "${escapeSwiftString(s.id)}",
            spriteKey: "${escapeSwiftString(s.spriteKey)}",
            lineage: .${s.lineage},
            nameZh: "${escapeSwiftString(s.nameZh)}",
            nameEn: "${escapeSwiftString(s.nameEn)}",
            titleZh: "${escapeSwiftString(s.titleZh)}",
            titleEn: "${escapeSwiftString(s.titleEn)}",
            traitZh: "${escapeSwiftString(s.traitZh)}",
            traitEn: "${escapeSwiftString(s.traitEn)}",
            primaryColorHex: "${escapeSwiftString(s.primaryColor)}",
            secondaryColorHex: "${escapeSwiftString(s.secondaryColor)}",
            glowColorHex: "${escapeSwiftString(s.glowColor)}",
            baseBiteTier: ${s.baseBiteTier},
            baseHp: ${s.baseHp},
            baseEnergy: ${s.baseEnergy},
            speedBonus: ${s.speedBonus},
            hpDrainReduction: ${s.hpDrainReduction},
            boostCostReduction: ${s.boostCostReduction},
            magnetBonus: ${s.magnetBonus},
            devourHealMult: ${s.devourHealMult},
            scoreMult: ${s.scoreMult},
            reqParentUpgradeLevel: ${s.reqParentUpgradeLevel},
            reqMaxInRunLevel: ${s.reqMaxInRunLevel},
            reqMaxDepth: ${s.reqMaxDepth},
            unlockCoins: ${s.unlockCoins},
            unlockGenes: ${s.unlockGenes},
            baseUpgradeCoinCost: ${s.baseUpgradeCoinCost},
            normalizedBounds: SIMD4<Double>(${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]})
        )`;
  }).join(',\n');

  const allPreyBounds: Record<string, [number, number, number, number]> = {
    ...SPRITE_CELL_BOUNDS,
    ...FISH2_CELL_BOUNDS,
  };

  const preyEntries = GAME_CONFIG.preyTiers.map((p) => {
    const spKey = p.spriteKey ?? 'FISH2_CLOWNFISH';
    const isFish2 = spKey.startsWith('FISH2_');
    const bounds = allPreyBounds[spKey] ?? [0, 0, 0.2, 0.16];
    const nameZh = (I18N.zh as Record<string, string>)[p.nameKey] ?? p.id;
    const nameEn = (I18N.en as Record<string, string>)[p.nameKey] ?? p.id;
    return `        PreyTierConfig(
            tier: ${p.tier},
            id: "${escapeSwiftString(p.id)}",
            nameZh: "${escapeSwiftString(nameZh)}",
            nameEn: "${escapeSwiftString(nameEn)}",
            spriteKey: "${escapeSwiftString(spKey)}",
            sheetName: "${isFish2 ? 'fish2_fc857cfa' : 'fish_24bdaa5a'}",
            minDepth: ${p.minDepth},
            maxDepth: ${p.maxDepth},
            radius: ${p.radius},
            baseSpeed: ${p.baseSpeed},
            hpRestore: ${p.hpRestore},
            xpValue: ${p.xpValue},
            scoreValue: ${p.scoreValue},
            geneValue: ${p.geneValue},
            coinValue: ${p.coinValue},
            damageOnFail: ${p.damageOnFail},
            behavior: .${p.behavior},
            primaryColorHex: "${escapeSwiftString(p.primaryColor)}",
            secondaryColorHex: "${escapeSwiftString(p.secondaryColor)}",
            glowColorHex: "${escapeSwiftString(p.glowColor)}",
            isHazard: ${Boolean(p.isHazard)},
            isBoss: ${Boolean(p.isBoss)},
            normalizedBounds: SIMD4<Double>(${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]})
        )`;
  }).join(',\n');

  const uiIconEntries = Object.entries(UI_ICON_GRID_MAP)
    .map(
      ([k, [r, c]]) =>
        `        "${k}": SIMD2<Int>(${r}, ${c})`
    )
    .join(',\n');

  const uiBannerEntries = Object.entries(UI_BANNER_BOUNDS)
    .map(
      ([k, [x0, y0, x1, y1]]) =>
        `        "${k}": SIMD4<Double>(${x0}, ${y0}, ${x1}, ${y1})`
    )
    .join(',\n');

  const uiSettingEntries = Object.entries(UI_SETTING_BOUNDS)
    .map(
      ([k, [x0, y0, x1, y1]]) =>
        `        "${k}": SIMD4<Double>(${x0}, ${y0}, ${x1}, ${y1})`
    )
    .join(',\n');

  return `// ============================================================================
// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Generated by \`npm run build:ios\` (scripts/build-ios-native.ts)
// Single Source of Truth: src/game/sharkEvolutionConfig.ts & src/game/config.ts
// ============================================================================

import Foundation
import simd

public enum SharkLineageId: String, Codable, CaseIterable, Sendable {
    case APEX_BIO
    case CYBER_MECHA
    case ELEMENTAL_CORE
    case ELDER_ABYSS
}

public enum PreyBehavior: String, Codable, CaseIterable, Sendable {
    case DRIFT_SWARM
    case SCHOOL_FLEE
    case PUFFER_INFLATE
    case SUB_PATROL
    case EEL_CHARGER
    case MINE_HAZARD
    case HEAVY_CRUISER
    case KRAKEN_BOSS
}

public struct SharkFormConfig: Identifiable, Codable, Sendable {
    public let index: Int
    public let row: Int
    public let col: Int
    public let generation: Int
    public let id: String
    public let spriteKey: String
    public let lineage: SharkLineageId
    public let nameZh: String
    public let nameEn: String
    public let titleZh: String
    public let titleEn: String
    public let traitZh: String
    public let traitEn: String
    public let primaryColorHex: String
    public let secondaryColorHex: String
    public let glowColorHex: String
    public let baseBiteTier: Int
    public let baseHp: Double
    public let baseEnergy: Double
    public let speedBonus: Double
    public let hpDrainReduction: Double
    public let boostCostReduction: Double
    public let magnetBonus: Double
    public let devourHealMult: Double
    public let scoreMult: Double
    public let reqParentUpgradeLevel: Int
    public let reqMaxInRunLevel: Int
    public let reqMaxDepth: Double
    public let unlockCoins: Int
    public let unlockGenes: Int
    public let baseUpgradeCoinCost: Int
    public let normalizedBounds: SIMD4<Double>
}

public struct PreyTierConfig: Identifiable, Codable, Sendable {
    public let tier: Int
    public let id: String
    public let nameZh: String
    public let nameEn: String
    public let spriteKey: String
    public let sheetName: String
    public let minDepth: Double
    public let maxDepth: Double
    public let radius: Double
    public let baseSpeed: Double
    public let hpRestore: Double
    public let xpValue: Int
    public let scoreValue: Int
    public let geneValue: Int
    public let coinValue: Int
    public let damageOnFail: Double
    public let behavior: PreyBehavior
    public let primaryColorHex: String
    public let secondaryColorHex: String
    public let glowColorHex: String
    public let isHazard: Bool
    public let isBoss: Bool
    public let normalizedBounds: SIMD4<Double>
}

public enum GameConfigGenerated {
    public static let baseSharkSpeed: Double = ${GAME_CONFIG.world.baseSharkSpeed}
    public static let boostSpeedMultiplier: Double = ${GAME_CONFIG.world.boostSpeedMultiplier}
    public static let baseHpDrainPerSec: Double = ${GAME_CONFIG.world.baseHpDrainPerSec}
    public static let baseBoostDrainPerSec: Double = ${GAME_CONFIG.world.baseBoostDrainPerSec}
    public static let baseBoostRegenPerSec: Double = ${GAME_CONFIG.world.baseBoostRegenPerSec}
    public static let baseMagnetRadius: Double = ${GAME_CONFIG.world.baseMagnetRadius}
    public static let baseBiteTier: Int = ${GAME_CONFIG.world.baseBiteTier}
    public static let frenzyDuration: Double = ${GAME_CONFIG.world.frenzyDuration}

    public static let sharkForms: [SharkFormConfig] = [
${sharkEntries}
    ]

    public static let preyTiers: [PreyTierConfig] = [
${preyEntries}
    ]

    public static let uiIconGridMap: [String: SIMD2<Int>] = [
${uiIconEntries}
    ]

    public static let uiBannerBounds: [String: SIMD4<Double>] = [
${uiBannerEntries}
    ]

    public static let uiSettingBounds: [String: SIMD4<Double>] = [
${uiSettingEntries}
    ]
}
`;
}

function generateGameRulesSwift(): string {
  return `import Foundation
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

    /// XP required to advance from \`level\` to \`level + 1\` (matches src/game/rules.ts)
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

    /// Optical Far / Mid / Near background shrinking ratios coupled to shark growth (\`relativePreyScale\`: 1.00 -> 0.40)
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
`;
}

function generateSpriteAtlasManagerSwift(): string {
  return `import UIKit
import SpriteKit
import CoreGraphics

/// Pure Native CoreGraphics Offscreen Sprite Sheet Processor & Texture Cache
/// Performs perimeter BFS flood-fill + Color-to-Alpha boundary white unmixing on the 4K shark atlas,
/// prey sheets, UI icon sheet, and ocean parallax layers without any WebView dependency.
@MainActor
public final class SpriteAtlasManager {
    public static let shared = SpriteAtlasManager()

    private var sharkTextures: [String: SKTexture] = [:]
    private var sharkUIImages: [String: UIImage] = [:]
    private var preyTextures: [String: SKTexture] = [:]
    private var uiIconImages: [String: UIImage] = [:]
    private var oceanLayerTextures: [String: SKTexture] = [:]
    private var isPreloaded = false

    private init() {}

    public func preloadAllIfNeeded() {
        guard !isPreloaded else { return }
        isPreloaded = true

        // 1. Slice 48-Form 4K Shark Sprite Sheet (sharks_ec921c3b.png)
        if let sharkSheet = loadBundledImage(named: "sharks_ec921c3b") {
            sliceSharkSheet(sharkSheet)
        }

        // 2. Slice Prey Sprite Sheets (fish_24bdaa5a.png & fish2_fc857cfa.png)
        let primarySheet = loadBundledImage(named: "fish_24bdaa5a")
        let fish2Sheet = loadBundledImage(named: "fish2_fc857cfa")
        for prey in GameConfigGenerated.preyTiers {
            if preyTextures[prey.spriteKey] != nil { continue }
            let srcImg = prey.sheetName == "fish2_fc857cfa" ? fish2Sheet : primarySheet
            if let img = srcImg,
               let sliced = sliceAndKeyNormalizedCell(
                   from: img,
                   bounds: prey.normalizedBounds,
                   preserveInteriorWhite: false
               ) {
                preyTextures[prey.spriteKey] = SKTexture(image: sliced)
            }
        }

        // 3. Slice 6x4 UI Icon Sheet (icons_f5128c12.png)
        if let iconSheet = loadBundledImage(named: "icons_f5128c12") {
            for (key, grid) in GameConfigGenerated.uiIconGridMap {
                let row = Double(grid.x)
                let col = Double(grid.y)
                let bounds = SIMD4<Double>(col / 6.0, row / 4.0, (col + 1.0) / 6.0, (row + 1.0) / 4.0)
                if let iconImg = sliceAndKeyNormalizedCell(
                    from: iconSheet,
                    bounds: bounds,
                    preserveInteriorWhite: true
                ) {
                    uiIconImages[key] = iconImg
                }
            }
        }
    }

    public func sharkTexture(for spriteKey: String) -> SKTexture? {
        preloadAllIfNeeded()
        return sharkTextures[spriteKey]
    }

    public func sharkUIImage(for spriteKey: String) -> UIImage? {
        preloadAllIfNeeded()
        return sharkUIImages[spriteKey]
    }

    public func preyTexture(for spriteKey: String) -> SKTexture? {
        preloadAllIfNeeded()
        return preyTextures[spriteKey]
    }

    public func uiIconImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiIconImages[key]
    }

    public func oceanParallaxTexture(named assetName: String, isWaterCanopy: Bool = false) -> SKTexture? {
        if let cached = oceanLayerTextures[assetName] {
            return cached
        }
        guard let rawImg = loadBundledImage(named: assetName) else { return nil }
        let processed: UIImage
        if isWaterCanopy {
            processed = rawImg
        } else {
            processed = sliceAndKeyNormalizedCell(
                from: rawImg,
                bounds: SIMD4<Double>(0, 0, 1, 1),
                preserveInteriorWhite: true,
                topSkyOnly: true
            ) ?? rawImg
        }
        let tex = SKTexture(image: processed)
        tex.filteringMode = .linear
        oceanLayerTextures[assetName] = tex
        return tex
    }

    private func loadBundledImage(named name: String) -> UIImage? {
        if let img = UIImage(named: name) { return img }
        if let path = Bundle.main.path(forResource: name, ofType: "png"),
           let img = UIImage(contentsOfFile: path) {
            return img
        }
        if let path = Bundle.main.path(forResource: name, ofType: "png", inDirectory: "Assets"),
           let img = UIImage(contentsOfFile: path) {
            return img
        }
        return nil
    }

    private func sliceSharkSheet(_ sheetImage: UIImage) {
        for form in GameConfigGenerated.sharkForms {
            if let sliced = sliceAndKeyNormalizedCell(
                from: sheetImage,
                bounds: form.normalizedBounds,
                preserveInteriorWhite: form.index == 0
            ) {
                sharkUIImages[form.spriteKey] = sliced
                let tex = SKTexture(image: sliced)
                tex.filteringMode = .linear
                sharkTextures[form.spriteKey] = tex
            }
        }
    }

    /// CoreGraphics Perimeter BFS Flood-Fill + Boundary Color-to-Alpha White Unmixing
    private func sliceAndKeyNormalizedCell(
        from sheetImage: UIImage,
        bounds: SIMD4<Double>,
        preserveInteriorWhite: Bool,
        topSkyOnly: Bool = false
    ) -> UIImage? {
        guard let cgSheet = sheetImage.cgImage else { return nil }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)

        let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
        let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
        let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
        let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))

        guard let croppedCG = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else {
            return nil
        }

        // Supersample cap for 4K cells so per-cell processing is fast and crisp
        let maxCellW = topSkyOnly ? 1024 : 320
        let scale = cellW > maxCellW ? Double(maxCellW) / Double(cellW) : 1.0
        let w = max(1, Int((Double(cellW) * scale).rounded()))
        let h = max(1, Int((Double(cellH) * scale).rounded()))

        var rgba = [UInt8](repeating: 0, count: w * h * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue

        guard let ctx = CGContext(
            data: &rgba,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else {
            return UIImage(cgImage: croppedCG)
        }

        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: h))

        var visited = [UInt8](repeating: 0, count: w * h)
        var queue = [Int](repeating: 0, count: w * h)
        var qHead = 0
        var qTail = 0

        func isStudioWhiteBg(_ idx: Int) -> Bool {
            let p = idx * 4
            let a = rgba[p + 3]
            if a < 16 { return true }
            let r = Int(rgba[p])
            let g = Int(rgba[p + 1])
            let b = Int(rgba[p + 2])
            let maxC = max(r, max(g, b))
            let minC = min(r, min(g, b))
            return minC >= 226 && (maxC - minC) <= 26
        }

        func enqueue(_ x: Int, _ y: Int) {
            if x < 0 || x >= w || y < 0 || y >= h { return }
            let i = y * w + x
            if visited[i] != 0 || !isStudioWhiteBg(i) { return }
            visited[i] = 1
            queue[qTail] = i
            qTail += 1
        }

        for x in 0..<w {
            enqueue(x, 0)
            if !topSkyOnly {
                enqueue(x, h - 1)
            }
        }
        let maxSideY = topSkyOnly ? Int(Double(h) * 0.65) : h
        for y in 0..<maxSideY {
            enqueue(0, y)
            enqueue(w - 1, y)
        }

        while qHead < qTail {
            let curr = queue[qHead]
            qHead += 1
            let p = curr * 4
            rgba[p] = 0
            rgba[p + 1] = 0
            rgba[p + 2] = 0
            rgba[p + 3] = 0
            let cx = curr % w
            let cy = (curr - cx) / w
            if cx > 0 { enqueue(cx - 1, cy) }
            if cx + 1 < w { enqueue(cx + 1, cy) }
            if cy > 0 { enqueue(cx, cy - 1) }
            if cy + 1 < h { enqueue(cx, cy + 1) }
        }

        // Boundary Color-to-Alpha unmixing on 2px halo around removed white background
        if h > 2 && w > 2 {
            for y in 1..<(h - 1) {
                let rowOff = y * w
                for x in 1..<(w - 1) {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
                        let p = i * 4
                        let r = Double(rgba[p])
                        let g = Double(rgba[p + 1])
                        let b = Double(rgba[p + 2])
                        let minC = min(r, min(g, b))
                        if minC > 55.0 {
                            let cleanAlpha = max(0.0, min(1.0, (250.0 - minC) / 195.0))
                            if cleanAlpha <= 0.04 {
                                rgba[p] = 0
                                rgba[p + 1] = 0
                                rgba[p + 2] = 0
                                rgba[p + 3] = 0
                            } else {
                                let unmixDiv = max(0.08, (255.0 - minC) / 255.0)
                                let nr = max(0.0, min(255.0, (r - minC) / unmixDiv)) * cleanAlpha
                                let ng = max(0.0, min(255.0, (g - minC) / unmixDiv)) * cleanAlpha
                                let nb = max(0.0, min(255.0, (b - minC) / unmixDiv)) * cleanAlpha
                                rgba[p] = UInt8(nr.rounded())
                                rgba[p + 1] = UInt8(ng.rounded())
                                rgba[p + 2] = UInt8(nb.rounded())
                                rgba[p + 3] = UInt8((Double(rgba[p + 3]) * cleanAlpha).rounded())
                            }
                        }
                    }
                }
            }
        }

        guard let outCG = ctx.makeImage() else { return nil }
        return UIImage(cgImage: outCG)
    }
}
`;
}

function generateOceanGameSceneSwift(): string {
  return `import SpriteKit
import SwiftUI
import UIKit
import simd

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
    @Published public var energy: Double = 100
    @Published public var maxEnergy: Double = 100
    @Published public var biteTier: Int = 1
    @Published public var depthMeters: Int = 22
    @Published public var comboCount: Int = 0
    @Published public var frenzyActive: Bool = false
    @Published public var frenzyTimer: Double = 0
    @Published public var showEvolutionAtlas: Bool = false
    @Published public var goldOverdriveUseCount: Int = 0
    @Published public var geneSurgeUseCount: Int = 0

    // Non-Published real-time input state (Zero SwiftUI re-render during 60/120Hz joystick drag!)
    public var joyDx: CGFloat = 0
    public var joyDy: CGFloat = 0
    public var joyActive: Bool = false
    public var isBoostingHeld: Bool = false

    private let saveKey = "hungry_shark_48_meta_save_v2"

    public init() {
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode(SharkMetaSaveData.self, from: data) {
            self.save = decoded
        } else {
            self.save = SharkMetaSaveData.createDefault()
        }
        recomputeCurrentSharkStats()
    }

    public func persistSave() {
        if let data = try? JSONEncoder().encode(save) {
            UserDefaults.standard.set(data, forKey: saveKey)
        }
    }

    public var activeSharkForm: SharkFormConfig {
        GameConfigGenerated.sharkForms.first(where: { $0.id == save.selectedSharkId })
            ?? GameConfigGenerated.sharkForms[0]
    }

    public var activeUpgradeLevel: Int {
        save.sharkUpgradeLevels[save.selectedSharkId] ?? 1
    }

    public var currentStats: ComputedSharkStats {
        GameRules.computeEvolvedSharkStats(
            inRunLevel: inRunLevel,
            sharkFormId: save.selectedSharkId,
            upgradeLevel: activeUpgradeLevel,
            frenzyActive: frenzyActive,
            globalDifficultyMultiplier: 1.0,
            unlockedCount: save.unlockedSharkIds.count
        )
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

    public func startNewRun(trialSharkId: String? = nil) {
        if let trialId = trialSharkId {
            save.selectedSharkId = trialId
        }
        inRunLevel = trialSharkId != nil ? 5 : 1
        xp = 0
        score = 0
        comboCount = 0
        frenzyActive = false
        frenzyTimer = 0
        goldOverdriveUseCount = 0
        geneSurgeUseCount = 0
        let st = currentStats
        maxHp = st.maxHp
        hp = st.maxHp
        maxEnergy = st.maxEnergy
        energy = st.maxEnergy
        biteTier = st.biteTier
        xpRequired = GameRules.getXpRequiredForLevel(inRunLevel)
        gameState = "playing"
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    public func triggerGoldFrenzy() {
        let form = activeSharkForm
        let cost = GameRules.getGoldOverdriveCost(useCount: goldOverdriveUseCount, generationRow: form.row)
        guard save.bankedCoins >= cost && !frenzyActive else { return }
        save.bankedCoins -= cost
        goldOverdriveUseCount += 1
        frenzyActive = true
        frenzyTimer = GameConfigGenerated.frenzyDuration + currentStats.frenzyDurationBonus
        hp = maxHp
        energy = maxEnergy
        recomputeCurrentSharkStats()
        persistSave()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
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
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }

    public func upgradeActiveSharkBody() {
        let form = activeSharkForm
        let curLv = activeUpgradeLevel
        guard curLv < 10 else { return }
        let coinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: curLv)
        let geneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: curLv)
        guard save.bankedCoins >= coinCost && save.bankedGenes >= geneCost else { return }
        save.bankedCoins -= coinCost
        save.bankedGenes -= geneCost
        save.sharkUpgradeLevels[form.id] = curLv + 1
        recomputeCurrentSharkStats()
        hp = min(maxHp, hp + maxHp * 0.25)
        persistSave()
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
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
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
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
        if let tex = SpriteAtlasManager.shared.sharkTexture(for: vm.activeSharkForm.spriteKey) {
            sharkNode.texture = tex
        }
    }

    public override func update(_ currentTime: TimeInterval) {
        let dt = lastUpdateTime == 0 ? (1.0 / 60.0) : min(0.05, max(0.001, currentTime - lastUpdateTime))
        lastUpdateTime = currentTime
        guard let vm = viewModel else { return }

        let viewW = Double(max(320, size.width))
        let viewH = Double(max(240, size.height))
        let stats = vm.currentStats

        if vm.sharkNodeNeedsRefresh(currentTexture: sharkNode.texture) {
            refreshSharkTexture()
        }

        // 1. Update Shark Physics (Title screen patrol vs In-game hunting)
        if vm.gameState == "title" {
            let patrolDir: Double = cos(currentTime * 0.95) >= 0 ? 1.0 : -1.0
            let inputY = sin(currentTime * 2.2) * 0.12 + max(-0.18, min(0.18, (240.0 - sharkY) * 0.008))
            stepSharkKinematics(inputX: patrolDir, inputY: inputY, isBoosting: false, stats: stats, dt: dt)
        } else if vm.gameState == "playing" {
            let ix = Double(vm.joyDx)
            let iy = Double(vm.joyDy)
            let mag = hypot(ix, iy)
            let normX = mag > 0.08 ? ix / mag : facingDir * 0.35
            let normY = mag > 0.08 ? iy / mag : 0.0
            let canBoost = vm.isBoostingHeld && vm.energy > 2.0
            stepSharkKinematics(inputX: normX, inputY: normY, isBoosting: canBoost, stats: stats, dt: dt)

            if canBoost {
                vm.energy = max(0, vm.energy - stats.boostDrainPerSec * dt)
            } else {
                vm.energy = min(vm.maxEnergy, vm.energy + GameConfigGenerated.baseBoostRegenPerSec * dt)
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
                    vm.gameState = "gameover"
                    vm.persistSave()
                }
            }

            invulnTimer = max(0, invulnTimer - dt)
            let curDepth = Int((max(0, sharkY) * 0.1).rounded())
            if curDepth != vm.depthMeters {
                vm.depthMeters = curDepth
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

        let speed = isBoosting ? stats.boostSpeed : stats.moveSpeed
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

        // 2.5D perspective scale & continuous pitch
        let absFacing = max(0.15, abs(facingScaleX))
        let perspectiveScaleX = (0.42 + 0.58 * pow(absFacing, 0.8)) * (facingScaleX >= 0 ? 1.0 : -1.0)
        let horizonPitch = atan2(-sin(sharkAngle), abs(cos(sharkAngle)))
        sharkNode.xScale = CGFloat(perspectiveScaleX)
        sharkNode.yScale = 1.0
        sharkNode.zRotation = CGFloat(horizonPitch * (facingScaleX >= 0 ? 1.0 : -1.0))
        sharkNode.alpha = invulnTimer > 0 && Int(invulnTimer * 20) % 2 == 0 ? 0.45 : 1.0

        // Apply GPU 12-column SKWarpGeometryGrid spine wave
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
                // Head at u=1 (right-facing sprite), tail at u=0
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

        // Layer 0: Top Water Canopy (shrinks by waterScale: 1.00 -> 0.91x)
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

        // Layer 1: Far Seamounts / Ruins (shrinks least: 1.00 -> 0.868x)
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

        // Layer 2: Mid Reef / Ribcage / Smokers (shrinks moderately: 1.00 -> 0.730x)
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

        // Layer 3: Near Seabed (shrinks most: 1.00 -> 0.580x)
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

        // Screen-center anchored normalized phase (0px horizontal jump during level-up shrinking)
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
        // 85% native habitat rule + zero active chargers in shallow zone (<= 520m)
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

            if vm.gameState == "playing" && dist < hitRadius {
                let outcome = GameRules.resolvePreyEncounter(
                    prey: p.config,
                    sharkStats: stats,
                    isBoosting: vm.isBoostingHeld && vm.energy > 2.0,
                    frenzyActive: vm.frenzyActive,
                    mutationVariant: p.mutation
                )
                if outcome == .DEVOUR {
                    let mult = p.mutation == .GOLDEN_SWARM ? 3 : 1
                    vm.score += p.config.scoreValue * mult
                    vm.save.bankedCoins += max(1, Int((Double(p.config.coinValue * mult) * stats.coinYieldMultiplier).rounded()))
                    if p.config.geneValue > 0 && Double.random(in: 0...1) < 0.35 {
                        vm.save.bankedGenes += max(1, Int((Double(p.config.geneValue) * stats.geneYieldMultiplier).rounded()))
                    }
                    vm.hp = min(vm.maxHp, vm.hp + p.config.hpRestore * stats.devourHealMultiplier)
                    vm.addXp(p.config.xpValue * mult)
                    vm.comboCount += 1
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
                        vm.save.bankedGenes += p.config.geneValue * 2
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

private extension GameViewModel {
    func sharkNodeNeedsRefresh(currentTexture: SKTexture?) -> Bool {
        currentTexture == nil
    }
}
`;
}

function generateSwiftUIViews(): string {
  return `import SwiftUI
import SpriteKit

public struct ContentView: View {
    @StateObject private var vm = GameViewModel()
    @State private var scene: OceanGameScene = {
        let s = OceanGameScene(size: CGSize(width: 844, height: 390))
        s.scaleMode = .resizeFill
        return s
    }()
    @State private var knobOffset: CGSize = .zero

    public init() {}

    public var body: some View {
        GeometryReader { geo in
            ZStack {
                // 1. Native Metal-Accelerated SpriteKit Ocean Canvas (Zero WebView!)
                SpriteView(scene: scene, preferredFramesPerSecond: 120)
                    .ignoresSafeArea()
                    .onAppear {
                        scene.viewModel = vm
                        scene.refreshSharkTexture()
                    }
                    .onChange(of: vm.save.selectedSharkId) { _ in
                        scene.refreshSharkTexture()
                    }

                // 2. Top-Left Frameless Avatar & Angled HP/Boost Bar
                VStack {
                    HStack(alignment: .top) {
                        avatarDataBar
                        Spacer()
                        if vm.gameState == "playing" {
                            telemetryPill
                            Spacer()
                            pauseButton
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    Spacer()
                }

                // 3. Title Screen Bottom Action Banners
                if vm.gameState == "title" {
                    VStack {
                        Spacer()
                        HStack(spacing: 16) {
                            Button {
                                vm.startNewRun()
                            } label: {
                                bannerPill(title: "立即潜入深海", subtitle: "START HUNTING", color: .green)
                            }
                            Button {
                                vm.showEvolutionAtlas = true
                            } label: {
                                bannerPill(
                                    title: "进化 (\(vm.save.unlockedSharkIds.count)/48)",
                                    subtitle: "EVOLUTION ATLAS",
                                    color: .cyan
                                )
                            }
                            Button {
                                vm.startNewRun(trialSharkId: "shark_41_star_destroyer")
                            } label: {
                                bannerPill(title: "试驾机甲利维坦", subtitle: "MECHA TRIAL", color: .orange)
                            }
                        }
                        .padding(.bottom, 22)
                    }
                }

                // 4. In-Game Multi-Touch Sonar Joystick (Bottom-Left) + 90° MOBA Skill Fan (Bottom-Right)
                if vm.gameState == "playing" {
                    VStack {
                        Spacer()
                        HStack(alignment: .bottom) {
                            sonarJoystick
                                .padding(.leading, 28)
                                .padding(.bottom, 20)
                            Spacer()
                            mobaSkillFan
                                .padding(.trailing, 24)
                                .padding(.bottom, 18)
                        }
                    }
                }

                // 5. Pause / Game Over Native Overlay
                if vm.gameState == "paused" || vm.gameState == "gameover" {
                    pauseOrGameOverModal
                }
            }
            .sheet(isPresented: $vm.showEvolutionAtlas) {
                EvolutionAtlasSheetView(vm: vm)
            }
        }
        .statusBarHidden(true)
    }

    private var avatarDataBar: some View {
        Button {
            vm.showEvolutionAtlas = true
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .stroke(
                            LinearGradient(colors: [.cyan, .purple], startPoint: .topLeading, endPoint: .bottomTrailing),
                            lineWidth: 3
                        )
                        .frame(width: 54, height: 54)
                    if let uiImg = SpriteAtlasManager.shared.sharkUIImage(for: vm.activeSharkForm.spriteKey) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 30)
                    }
                    Text("T\\(vm.biteTier)")
                        .font(.system(size: 10, weight: .black, design: .rounded))
                        .foregroundColor(.black)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.yellow))
                        .offset(x: -18, y: 20)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(vm.activeSharkForm.nameZh)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        Text("Lv.\\(vm.activeUpgradeLevel)")
                            .font(.system(size: 11, weight: .heavy, design: .monospaced))
                            .foregroundColor(.cyan)
                    }
                    // Skewed HP Bar
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.black.opacity(0.55))
                            .frame(width: 128, height: 8)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(LinearGradient(colors: [.green, .mint], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(0, 128 * CGFloat(vm.hp / max(1, vm.maxHp))), height: 8)
                    }
                    // Skewed Boost Bar
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.black.opacity(0.55))
                            .frame(width: 112, height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(LinearGradient(colors: [.cyan, .blue], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(0, 112 * CGFloat(vm.energy / max(1, vm.maxEnergy))), height: 6)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(red: 4/255, green: 15/255, blue: 38/255).opacity(0.76))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.cyan.opacity(0.45), lineWidth: 1.2)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var telemetryPill: some View {
        HStack(spacing: 14) {
            Label("\\(vm.score)", systemImage: "trophy.fill")
                .foregroundColor(.yellow)
            Label("\\(vm.save.bankedCoins)", systemImage: "bitcoinsign.circle.fill")
                .foregroundColor(.orange)
            Label("\\(vm.save.bankedGenes)", systemImage: "allergens")
                .foregroundColor(.mint)
            Label("\\(vm.depthMeters)m", systemImage: "arrow.down.to.line")
                .foregroundColor(.cyan)
        }
        .font(.system(size: 13, weight: .heavy, design: .monospaced))
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.45))
                .overlay(Capsule().stroke(Color.white.opacity(0.16), lineWidth: 1))
        )
    }

    private var pauseButton: some View {
        Button {
            vm.gameState = "paused"
        } label: {
            Image(systemName: "pause.circle.fill")
                .font(.system(size: 34))
                .foregroundColor(.cyan)
        }
    }

    private var sonarJoystick: some View {
        ZStack {
            Circle()
                .stroke(Color.cyan.opacity(0.45), lineWidth: 2)
                .background(Circle().fill(Color.black.opacity(0.25)))
                .frame(width: 108, height: 108)
            Circle()
                .fill(
                    RadialGradient(
                        colors: [.cyan, .blue.opacity(0.8)],
                        center: .center,
                        startRadius: 2,
                        endRadius: 22
                    )
                )
                .frame(width: 42, height: 42)
                .offset(knobOffset)
        }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    let maxR: CGFloat = 42
                    let dx = value.translation.width
                    let dy = value.translation.height
                    let dist = max(0.001, hypot(dx, dy))
                    let clampedDist = min(maxR, dist)
                    let nx = dx / dist
                    let ny = dy / dist
                    knobOffset = CGSize(width: nx * clampedDist, height: ny * clampedDist)
                    vm.joyDx = nx * (clampedDist / maxR)
                    vm.joyDy = ny * (clampedDist / maxR)
                    vm.joyActive = true
                }
                .onEnded { _ in
                    knobOffset = .zero
                    vm.joyDx = 0
                    vm.joyDy = 0
                    vm.joyActive = false
                }
        )
    }

    private var mobaSkillFan: some View {
        ZStack(alignment: .bottomTrailing) {
            // 0° Left Slot: Gold Frenzy
            skillMedallion(
                title: "狂暴",
                cost: "🪙\\(GameRules.getGoldOverdriveCost(useCount: vm.goldOverdriveUseCount, generationRow: vm.activeSharkForm.row))",
                color: .yellow,
                iconKey: "UI_BTN_GOLD_FRENZY"
            ) {
                vm.triggerGoldFrenzy()
            }
            .offset(x: -96, y: -4)

            // 45° Diagonal Slot: Gene Surge
            skillMedallion(
                title: "突破",
                cost: "🧬\\(GameRules.getGeneSurgeCost(level: vm.inRunLevel, useCount: vm.geneSurgeUseCount, generationRow: vm.activeSharkForm.row))",
                color: .mint,
                iconKey: "UI_BTN_GENE_SURGE"
            ) {
                vm.triggerGeneSurge()
            }
            .offset(x: -68, y: -68)

            // 90° Top Slot: Body Upgrade
            skillMedallion(
                title: "强化 Lv.\\(vm.activeUpgradeLevel)",
                cost: "🪙\\(GameRules.getSharkUpgradeCoinCost(form: vm.activeSharkForm, currentLevel: vm.activeUpgradeLevel))",
                color: .cyan,
                iconKey: "UI_BTN_BODY_UPGRADE"
            ) {
                vm.upgradeActiveSharkBody()
            }
            .offset(x: -4, y: -96)

            // Anchor: Main Boost Button (Hold to Boost)
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: vm.isBoostingHeld ? [.yellow, .orange] : [.cyan, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 74, height: 74)
                    .shadow(color: .cyan.opacity(0.6), radius: 10)
                VStack(spacing: 2) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 24, weight: .black))
                        .foregroundColor(.white)
                    Text("冲刺")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(.white)
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in vm.isBoostingHeld = true }
                    .onEnded { _ in vm.isBoostingHeld = false }
            )
        }
    }

    private func skillMedallion(title: String, cost: String, color: Color, iconKey: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                ZStack {
                    Circle()
                        .fill(Color.black.opacity(0.65))
                        .frame(width: 48, height: 48)
                        .overlay(Circle().stroke(color, lineWidth: 2))
                    if let uiImg = SpriteAtlasManager.shared.uiIconImage(for: iconKey) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 34, height: 34)
                    } else {
                        Image(systemName: "sparkles")
                            .foregroundColor(color)
                    }
                }
                Text("\\(title) \\(cost)")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Capsule().fill(Color.black.opacity(0.7)))
            }
        }
        .buttonStyle(.plain)
    }

    private func bannerPill(title: String, subtitle: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 14, weight: .black))
                .foregroundColor(.white)
            Text(subtitle)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(color.opacity(0.9))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(red: 6/255, green: 22/255, blue: 48/255).opacity(0.88))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(color, lineWidth: 1.8))
        )
    }

    private var pauseOrGameOverModal: some View {
        ZStack {
            Color.black.opacity(0.65).ignoresSafeArea()
            VStack(spacing: 16) {
                Text(vm.gameState == "gameover" ? "狩猎结算 · HUNT COMPLETE" : "暂停 · PAUSED")
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(.cyan)

                HStack(spacing: 24) {
                    VStack {
                        Text("本局得分")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text("\\(vm.score)")
                            .font(.title2.bold())
                            .foregroundColor(.yellow)
                    }
                    VStack {
                        Text("下潜深度")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text("\\(vm.depthMeters)m")
                            .font(.title2.bold())
                            .foregroundColor(.cyan)
                    }
                    VStack {
                        Text("局内等级")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text("Lv.\\(vm.inRunLevel)")
                            .font(.title2.bold())
                            .foregroundColor(.mint)
                    }
                }

                HStack(spacing: 14) {
                    if vm.gameState == "paused" {
                        Button("继续狩猎") {
                            vm.gameState = "playing"
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    }
                    Button("再次潜入") {
                        vm.startNewRun()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.cyan)

                    Button("进化图谱") {
                        vm.showEvolutionAtlas = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)

                    Button("返回主页") {
                        vm.gameState = "title"
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(28)
            .background(
                RoundedRectangle(cornerRadius: 22)
                    .fill(Color(red: 7/255, green: 16/255, blue: 36/255))
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.cyan.opacity(0.6), lineWidth: 2))
            )
        }
    }
}

public struct EvolutionAtlasSheetView: View {
    @ObservedObject var vm: GameViewModel
    @Environment(\\.dismiss) private var dismiss
    @State private var inspectedIndex: Int = 0

    private var inspectedForm: SharkFormConfig {
        GameConfigGenerated.sharkForms[max(0, min(47, inspectedIndex))]
    }

    public var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 4/255, green: 18/255, blue: 42/255), Color(red: 2/255, green: 8/255, blue: 22/255)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                // Header
                HStack {
                    Text("进化 · 48阶鲨鱼基因图谱")
                        .font(.system(size: 18, weight: .black))
                        .foregroundColor(.white)
                    Spacer()
                    Text("🪙 \\(vm.save.bankedCoins)   🧬 \\(vm.save.bankedGenes)")
                        .font(.system(size: 14, weight: .heavy, design: .monospaced))
                        .foregroundColor(.yellow)
                    Button("关闭") { dismiss() }
                        .buttonStyle(.bordered)
                }
                .padding(.horizontal, 20)
                .padding(.top, 14)

                // Giant Aquarium Hero Spotlight
                VStack(spacing: 6) {
                    Text("\\(inspectedForm.titleZh) · T\\(inspectedForm.baseBiteTier)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)
                    if let uiImg = SpriteAtlasManager.shared.sharkUIImage(for: inspectedForm.spriteKey) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 220, height: 115)
                            .shadow(color: .cyan.opacity(0.5), radius: 16)
                    }
                    Text(inspectedForm.nameZh)
                        .font(.system(size: 20, weight: .black))
                        .foregroundColor(.white)
                    Text(inspectedForm.traitZh)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                // Action Row
                HStack(spacing: 16) {
                    Button("◀ 上一阶") {
                        inspectedIndex = (inspectedIndex + 47) % 48
                    }
                    .buttonStyle(.bordered)

                    if vm.save.unlockedSharkIds.contains(inspectedForm.id) {
                        Button(vm.save.selectedSharkId == inspectedForm.id ? "✓ 当前出战" : "出战该鲨鱼") {
                            vm.save.selectedSharkId = inspectedForm.id
                            vm.recomputeCurrentSharkStats()
                            vm.persistSave()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    } else {
                        Button("破茧进化 (🪙\\(inspectedForm.unlockCoins) · 🧬\\(inspectedForm.unlockGenes))") {
                            if vm.save.bankedCoins >= inspectedForm.unlockCoins && vm.save.bankedGenes >= inspectedForm.unlockGenes {
                                vm.save.bankedCoins -= inspectedForm.unlockCoins
                                vm.save.bankedGenes -= inspectedForm.unlockGenes
                                vm.save.unlockedSharkIds.append(inspectedForm.id)
                                vm.save.sharkUpgradeLevels[inspectedForm.id] = 1
                                vm.save.selectedSharkId = inspectedForm.id
                                vm.recomputeCurrentSharkStats()
                                vm.persistSave()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.cyan)
                    }

                    Button("下一阶 ▶") {
                        inspectedIndex = (inspectedIndex + 1) % 48
                    }
                    .buttonStyle(.bordered)
                }

                // 180-Degree Continuous Dial Strip
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(GameConfigGenerated.sharkForms) { form in
                            let unlocked = vm.save.unlockedSharkIds.contains(form.id)
                            Button {
                                inspectedIndex = form.index
                            } label: {
                                VStack(spacing: 3) {
                                    if let img = SpriteAtlasManager.shared.sharkUIImage(for: form.spriteKey) {
                                        Image(uiImage: img)
                                            .resizable()
                                            .scaledToFit()
                                            .frame(width: 52, height: 34)
                                            .opacity(unlocked ? 1.0 : 0.38)
                                    }
                                    Text(form.nameZh)
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(inspectedIndex == form.index ? .cyan : .white.opacity(0.75))
                                }
                                .padding(6)
                                .background(
                                    Circle()
                                        .fill(inspectedIndex == form.index ? Color.cyan.opacity(0.22) : Color.clear)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 10)
            }
        }
        .onAppear {
            inspectedIndex = vm.activeSharkForm.index
        }
    }
}
`;
}

function generateAppEntrySwift(): string {
  return `import SwiftUI

@main
struct HungrySharkEvolutionApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
`;
}

function generateInfoPlist(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>zh_CN</string>
    <key>CFBundleDisplayName</key>
    <string>深海狂鲨进化</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
    </dict>
    <key>UILaunchScreen</key>
    <dict>
        <key>UIColorName</key>
        <string>LaunchBg</string>
    </dict>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>arm64</string>
        <string>metal</string>
    </array>
    <key>UIStatusBarHidden</key>
    <true/>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
    </array>
</dict>
</plist>
`;
}

function generateXcodeGenProjectYml(): string {
  return `name: HungrySharkEvolution
options:
  bundleIdPrefix: com.deepsea.hungryshark
  deploymentTarget:
    iOS: "16.0"
  xcodeVersion: "15.0"
targets:
  HungrySharkEvolution:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources:
      - path: HungrySharkEvolution
        excludes:
          - "Resources/Assets/*.png"
      - path: HungrySharkEvolution/Resources/Assets
        type: folder
        buildPhase: resources
    info:
      path: HungrySharkEvolution/Info.plist
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.deepsea.hungryshark.evolution
        MARKETING_VERSION: 1.0.0
        CURRENT_PROJECT_VERSION: 1
        SWIFT_VERSION: 5.9
        TARGETED_DEVICE_FAMILY: "1,2"
        INFOPLIST_FILE: HungrySharkEvolution/Info.plist
`;
}

function generatePackageSwift(): string {
  return `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HungrySharkEvolution",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "HungrySharkEvolutionCore",
            targets: ["HungrySharkEvolutionCore"]
        )
    ],
    targets: [
        .target(
            name: "HungrySharkEvolutionCore",
            path: "HungrySharkEvolution",
            exclude: ["Info.plist", "HungrySharkEvolutionApp.swift"],
            resources: [
                .copy("Resources/Assets")
            ]
        )
    ]
)
`;
}

function generatePbxproj(): string {
  // Valid Xcode 15/16 project.pbxproj referencing all 5 Swift files and the bundled Assets folder
  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
		A10000012B00000000000001 /* HungrySharkEvolutionApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = A20000012B00000000000001 /* HungrySharkEvolutionApp.swift */; };
		A10000022B00000000000001 /* GameConfigGenerated.swift in Sources */ = {isa = PBXBuildFile; fileRef = A20000022B00000000000001 /* GameConfigGenerated.swift */; };
		A10000032B00000000000001 /* GameRules.swift in Sources */ = {isa = PBXBuildFile; fileRef = A20000032B00000000000001 /* GameRules.swift */; };
		A10000042B00000000000001 /* SpriteAtlasManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = A20000042B00000000000001 /* SpriteAtlasManager.swift */; };
		A10000052B00000000000001 /* OceanGameScene.swift in Sources */ = {isa = PBXBuildFile; fileRef = A20000052B00000000000001 /* OceanGameScene.swift */; };
		A10000062B00000000000001 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A20000062B00000000000001 /* ContentView.swift */; };
		A10000072B00000000000001 /* Assets in Resources */ = {isa = PBXBuildFile; fileRef = A20000072B00000000000001 /* Assets */; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		A00000012B00000000000001 /* HungrySharkEvolution.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = HungrySharkEvolution.app; sourceTree = BUILT_PRODUCTS_DIR; };
		A20000012B00000000000001 /* HungrySharkEvolutionApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HungrySharkEvolutionApp.swift; sourceTree = "<group>"; };
		A20000022B00000000000001 /* GameConfigGenerated.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Generated/GameConfigGenerated.swift; sourceTree = "<group>"; };
		A20000032B00000000000001 /* GameRules.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Core/GameRules.swift; sourceTree = "<group>"; };
		A20000042B00000000000001 /* SpriteAtlasManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Rendering/SpriteAtlasManager.swift; sourceTree = "<group>"; };
		A20000052B00000000000001 /* OceanGameScene.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Rendering/OceanGameScene.swift; sourceTree = "<group>"; };
		A20000062B00000000000001 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UI/ContentView.swift; sourceTree = "<group>"; };
		A20000072B00000000000001 /* Assets */ = {isa = PBXFileReference; lastKnownFileType = folder; path = Resources/Assets; sourceTree = "<group>"; };
		A20000082B00000000000001 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		A30000012B00000000000001 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		A40000012B00000000000001 = {
			isa = PBXGroup;
			children = (
				A40000022B00000000000001 /* HungrySharkEvolution */,
				A40000032B00000000000001 /* Products */,
			);
			sourceTree = "<group>";
		};
		A40000022B00000000000001 /* HungrySharkEvolution */ = {
			isa = PBXGroup;
			children = (
				A20000012B00000000000001 /* HungrySharkEvolutionApp.swift */,
				A20000022B00000000000001 /* GameConfigGenerated.swift */,
				A20000032B00000000000001 /* GameRules.swift */,
				A20000042B00000000000001 /* SpriteAtlasManager.swift */,
				A20000052B00000000000001 /* OceanGameScene.swift */,
				A20000062B00000000000001 /* ContentView.swift */,
				A20000072B00000000000001 /* Assets */,
				A20000082B00000000000001 /* Info.plist */,
			);
			path = HungrySharkEvolution;
			sourceTree = "<group>";
		};
		A40000032B00000000000001 /* Products */ = {
			isa = PBXGroup;
			children = (
				A00000012B00000000000001 /* HungrySharkEvolution.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		A50000012B00000000000001 /* HungrySharkEvolution */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = A80000022B00000000000001 /* Build configuration list for PBXNativeTarget "HungrySharkEvolution" */;
			buildPhases = (
				A60000012B00000000000001 /* Sources */,
				A30000012B00000000000001 /* Frameworks */,
				A60000022B00000000000001 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = HungrySharkEvolution;
			productName = HungrySharkEvolution;
			productReference = A00000012B00000000000001 /* HungrySharkEvolution.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		A70000012B00000000000001 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1500;
				LastUpgradeCheck = 1500;
			};
			buildConfigurationList = A80000012B00000000000001 /* Build configuration list for PBXProject "HungrySharkEvolution" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = zh_CN;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				zh_CN,
				Base,
			);
			mainGroup = A40000012B00000000000001;
			productRefGroup = A40000032B00000000000001 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				A50000012B00000000000001 /* HungrySharkEvolution */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		A60000022B00000000000001 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000072B00000000000001 /* Assets in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		A60000012B00000000000001 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000012B00000000000001 /* HungrySharkEvolutionApp.swift in Sources */,
				A10000022B00000000000001 /* GameConfigGenerated.swift in Sources */,
				A10000032B00000000000001 /* GameRules.swift in Sources */,
				A10000042B00000000000001 /* SpriteAtlasManager.swift in Sources */,
				A10000052B00000000000001 /* OceanGameScene.swift in Sources */,
				A10000062B00000000000001 /* ContentView.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		A90000012B00000000000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_TESTABILITY = YES;
				GCC_DYNAMIC_NO_PIC = NO;
				GCC_OPTIMIZATION_LEVEL = 0;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
				SWIFT_VERSION = 5.0;
			};
			name = Debug;
		};
		A90000022B00000000000001 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				MTL_ENABLE_DEBUG_INFO = NO;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				SWIFT_OPTIMIZATION_LEVEL = "-O";
				SWIFT_VERSION = 5.0;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		A90000032B00000000000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				INFOPLIST_FILE = HungrySharkEvolution/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.deepsea.hungryshark.evolution;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		A90000042B00000000000001 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				INFOPLIST_FILE = HungrySharkEvolution/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.deepsea.hungryshark.evolution;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		A80000012B00000000000001 /* Build configuration list for PBXProject "HungrySharkEvolution" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A90000012B00000000000001 /* Debug */,
				A90000022B00000000000001 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		A80000022B00000000000001 /* Build configuration list for PBXNativeTarget "HungrySharkEvolution" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A90000032B00000000000001 /* Debug */,
				A90000042B00000000000001 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = A70000012B00000000000001 /* Project object */;
}
`;
}

function main() {
  ensureDir(path.join(APP_DIR, 'Generated'));
  ensureDir(path.join(APP_DIR, 'Core'));
  ensureDir(path.join(APP_DIR, 'Rendering'));
  ensureDir(path.join(APP_DIR, 'UI'));
  const assetsDst = path.join(APP_DIR, 'Resources', 'Assets');
  ensureDir(assetsDst);
  ensureDir(path.join(IOS_ROOT, 'HungrySharkEvolution.xcodeproj'));

  // 1. Write Swift source files
  fs.writeFileSync(
    path.join(APP_DIR, 'Generated', 'GameConfigGenerated.swift'),
    generateSwiftConfigFile(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(APP_DIR, 'Core', 'GameRules.swift'),
    generateGameRulesSwift(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(APP_DIR, 'Rendering', 'SpriteAtlasManager.swift'),
    generateSpriteAtlasManagerSwift(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(APP_DIR, 'Rendering', 'OceanGameScene.swift'),
    generateOceanGameSceneSwift(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(APP_DIR, 'UI', 'ContentView.swift'),
    generateSwiftUIViews(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(APP_DIR, 'HungrySharkEvolutionApp.swift'),
    generateAppEntrySwift(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(APP_DIR, 'Info.plist'),
    generateInfoPlist(),
    'utf8'
  );

  // 2. Copy all PNG assets from public/assets/aistudio into ios-native/HungrySharkEvolution/Resources/Assets
  const srcAssetsDir = path.join(ROOT_DIR, 'public', 'assets', 'aistudio');
  let copiedCount = 0;
  if (fs.existsSync(srcAssetsDir)) {
    for (const file of fs.readdirSync(srcAssetsDir)) {
      if (file.endsWith('.png')) {
        fs.copyFileSync(
          path.join(srcAssetsDir, file),
          path.join(assetsDst, file)
        );
        copiedCount++;
      }
    }
  }

  // 3. Write Xcode project files (project.pbxproj, project.yml, Package.swift)
  fs.writeFileSync(
    path.join(IOS_ROOT, 'HungrySharkEvolution.xcodeproj', 'project.pbxproj'),
    generatePbxproj(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(IOS_ROOT, 'project.yml'),
    generateXcodeGenProjectYml(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(IOS_ROOT, 'Package.swift'),
    generatePackageSwift(),
    'utf8'
  );

  console.log(
    `[build:ios] Native iOS project (SwiftUI + SpriteKit/Metal, ZERO WebView) generated at ./ios-native/`
  );
  console.log(
    `[build:ios] Exported ${SHARK_EVOLUTION_FORMS.length} shark forms, ${GAME_CONFIG.preyTiers.length} prey species, and copied ${copiedCount} PNG assets.`
  );
}

main();
