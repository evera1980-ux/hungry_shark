import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CONFIG } from '../src/game/config';
import { SHARK_EVOLUTION_FORMS, LINEAGE_META } from '../src/game/sharkEvolutionConfig';
import {
  SHARK_CELL_BOUNDS,
  SPRITE_CELL_BOUNDS,
  FISH2_CELL_BOUNDS,
  UI_ICON_GRID_MAP,
  UI_BANNER_BOUNDS,
  UI_SETTING_BOUNDS,
} from '../src/game/spriteSheetManager';
import { I18N } from '../src/game/i18n';
import { GOOGLE_ADS_CONFIG } from '../src/game/adManager';

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

  const lineageEntries = Object.entries(LINEAGE_META)
    .map(
      ([k, meta]) => `        .${k}: SharkLineageMeta(
            id: .${k},
            nameZh: "${escapeSwiftString(meta.nameZh)}",
            nameEn: "${escapeSwiftString(meta.nameEn)}",
            descZh: "${escapeSwiftString(meta.descZh)}",
            descEn: "${escapeSwiftString(meta.descEn)}",
            themeColorHex: "${escapeSwiftString(meta.badgeColor)}"
        )`
    )
    .join(',\n');

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
            nameKey: "${escapeSwiftString(p.nameKey)}",
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
    .map(([k, [r, c]]) => `        "${k}": SIMD2<Int>(${r}, ${c})`)
    .join(',\n');

  const uiBannerEntries = Object.entries(UI_BANNER_BOUNDS)
    .map(([k, [x0, y0, x1, y1]]) => `        "${k}": SIMD4<Double>(${x0}, ${y0}, ${x1}, ${y1})`)
    .join(',\n');

  const uiSettingEntries = Object.entries(UI_SETTING_BOUNDS)
    .map(([k, [x0, y0, x1, y1]]) => `        "${k}": SIMD4<Double>(${x0}, ${y0}, ${x1}, ${y1})`)
    .join(',\n');

  const i18nZhEntries = Object.entries(I18N.zh)
    .map(([k, v]) => `        "${escapeSwiftString(k)}": "${escapeSwiftString(v)}"`)
    .join(',\n');

  const i18nEnEntries = Object.entries(I18N.en)
    .map(([k, v]) => `        "${escapeSwiftString(k)}": "${escapeSwiftString(v)}"`)
    .join(',\n');

  return `// ============================================================================
// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Generated by \`npm run build:ios\` (scripts/build-ios-native.ts)
// Single Source of Truth: src/game/sharkEvolutionConfig.ts, src/game/config.ts, src/game/i18n.ts
// ============================================================================

import Foundation
import simd

public enum SharkLineageId: String, Codable, CaseIterable, Sendable {
    case APEX_BIO
    case CYBER_MECHA
    case ELEMENTAL_CORE
    case ELDER_ABYSS
}

public struct SharkLineageMeta: Sendable {
    public let id: SharkLineageId
    public let nameZh: String
    public let nameEn: String
    public let descZh: String
    public let descEn: String
    public let themeColorHex: String
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

public struct SharkFormConfig: Identifiable, Codable, Sendable, Equatable {
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
    public let nameKey: String
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

    // Google AdMob & H5 Games Ads Production Identifiers
    public static let googleAdMobAppId: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.admobAppId)}"
    public static let googleAdMobRewardedAdUnitId: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.admobRewardedAdUnitId)}"
    public static let googleH5ClientId: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.h5ClientId)}"

    public static let sharkForms: [SharkFormConfig] = [
${sharkEntries}
    ]

    public static let lineageMeta: [SharkLineageId: SharkLineageMeta] = [
${lineageEntries}
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

    public static let i18nZh: [String: String] = [
${i18nZhEntries}
    ]

    public static let i18nEn: [String: String] = [
${i18nEnEntries}
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

public struct AvatarBarHollowMetrics: Sendable {
    public let cxPct: CGFloat
    public let cyPct: CGFloat
    public let innerDiaPctH: CGFloat
    public let outerDiaPctH: CGFloat
    public let aspectRatio: CGFloat
}

/// Pure Native CoreGraphics Offscreen Sprite Sheet Processor & Texture Cache
/// Performs perimeter BFS flood-fill + Color-to-Alpha boundary unmixing on the 4K shark atlas,
/// prey sheets, 6x4 UI icon sheet, banner button sheet (buttons_16e3a0cf), setting modal sheet (setting_83a7a273),
/// and ocean parallax layers without any WebView dependency.
@MainActor
public final class SpriteAtlasManager {
    public static let shared = SpriteAtlasManager()

    private var sharkTextures: [String: SKTexture] = [:]
    private var sharkUIImages: [String: UIImage] = [:]
    private var preyTextures: [String: SKTexture] = [:]
    private var preyUIImages: [String: UIImage] = [:]
    private var uiIconImages: [String: UIImage] = [:]
    private var uiBannerImages: [String: UIImage] = [:]
    private var uiSettingImages: [String: UIImage] = [:]
    private var uiSettingIconImages: [String: UIImage] = [:]
    private var oceanLayerTextures: [String: SKTexture] = [:]
    private var isPreloaded = false

    public private(set) var avatarBarHollowMetrics = AvatarBarHollowMetrics(
        cxPct: 23.0,
        cyPct: 48.0,
        innerDiaPctH: 48.0,
        outerDiaPctH: 60.0,
        aspectRatio: 2.85
    )

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
                preyUIImages[prey.spriteKey] = sliced
                let tex = SKTexture(image: sliced)
                tex.filteringMode = .linear
                preyTextures[prey.spriteKey] = tex
            }
        }

        // 3. Slice 6x4 UI Icon Sheet (icons_f5128c12.png) with hollow ring seeding & 128x128 normalization
        if let iconSheet = loadBundledImage(named: "icons_f5128c12") {
            sliceUiIconSheet(iconSheet)
        }

        // 4. Slice Home/HUD Banner & Avatar Plate Sheet (buttons_16e3a0cf.png)
        if let bannerSheet = loadBundledImage(named: "buttons_16e3a0cf") {
            sliceUiBannerSheet(bannerSheet)
        }

        // 5. Slice Pause/Settings/GameOver Sci-Fi Modal & Octagonal Button Sheet (setting_83a7a273.png)
        if let settingSheet = loadBundledImage(named: "setting_83a7a273") {
            sliceUiSettingSheet(settingSheet)
        }

        // 6. Pre-process & GPU-warm all 12 Multi-Biome Ocean Parallax Layers up front (zero stutter when diving to Twilight/Abyss!)
        let oceanLayers: [(name: String, isWater: Bool)] = [
            ("bg_shallow_0_water_0e65cb68", true),
            ("bg_shallow_1_far_8898229a", false),
            ("bg_shallow_2_mid_b4e0d30a", false),
            ("bg_shallow_3_near_96e92ee1", false),
            ("bg_twilight_0_17bcb84c", true),
            ("bg_twilight_1_04f5d35f", false),
            ("bg_twilight_2_fd5a1b33", false),
            ("bg_twilight_3_6e0dd7c1", false),
            ("bg_abyss_0_1bbf506a", true),
            ("bg_abyss_1_75e4a628", false),
            ("bg_abyss_2_6ce66695", false),
            ("bg_abyss_3_a4986280", false)
        ]
        for layer in oceanLayers {
            _ = oceanParallaxTexture(named: layer.name, isWaterCanopy: layer.isWater)
        }
        let allGpuTextures = Array(sharkTextures.values) + Array(preyTextures.values) + Array(oceanLayerTextures.values)
        SKTexture.preload(allGpuTextures) {}
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

    public func preyUIImage(for spriteKey: String) -> UIImage? {
        preloadAllIfNeeded()
        return preyUIImages[spriteKey]
    }

    public func uiIconImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiIconImages[key]
    }

    public func uiBannerImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiBannerImages[key]
    }

    public func uiSettingImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiSettingImages[key]
    }

    public func uiSettingIconImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiSettingIconImages[key]
    }

    public func oceanParallaxTexture(named assetName: String, isWaterCanopy: Bool = false) -> SKTexture? {
        if let cached = oceanLayerTextures[assetName] {
            return cached
        }
        guard let rawImg = loadBundledImage(named: assetName) else { return nil }
        let processed: UIImage
        if isWaterCanopy {
            processed = processWaterLayerToSeamlessTile(rawImg, assetName: assetName) ?? rawImg
        } else {
            processed = processTerrainLayerToSeamlessStrip(rawImg, assetName: assetName) ?? rawImg
        }
        let tex = SKTexture(image: processed)
        tex.filteringMode = .linear
        oceanLayerTextures[assetName] = tex
        return tex
    }

    private func loadBundledImage(named name: String) -> UIImage? {
        if let path = Bundle.main.path(forResource: name, ofType: "png"),
           let img = UIImage(contentsOfFile: path) {
            return img
        }
        if let path = Bundle.main.path(forResource: name, ofType: "png", inDirectory: "Assets"),
           let img = UIImage(contentsOfFile: path) {
            return img
        }
        if let img = UIImage(named: name) { return img }
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

    /// Slices the 6x4 UI Icon Sheet (icons_f5128c12.png) with center hollow seed for UI_AVATAR_FRAME & UI_JOYSTICK_BASE
    /// and tight bounding-box aspect-fit normalization into a 128x128 square UIImage.
    private func sliceUiIconSheet(_ sheetImage: UIImage) {
        guard let cgSheet = sheetImage.cgImage else { return }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)
        let cols = 6.0
        let rows = 4.0
        let padX = (fullW / cols) * 0.025
        let padY = (fullH / rows) * 0.025
        let outSize = 128

        for (key, grid) in GameConfigGenerated.uiIconGridMap {
            let row = Double(grid.x)
            let col = Double(grid.y)
            let sx = max(0, Int((col * (fullW / cols) + padX).rounded(.down)))
            let sy = max(0, Int((row * (fullH / rows) + padY).rounded(.down)))
            let cellW = max(1, min(cgSheet.width - sx, Int((fullW / cols - padX * 2.0).rounded(.down))))
            let cellH = max(1, min(cgSheet.height - sy, Int((fullH / rows - padY * 2.0).rounded(.down))))

            guard let cropped = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else { continue }
            let w = cellW
            let h = cellH
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
            ) else { continue }
            ctx.interpolationQuality = .high
            ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))

            var visited = [UInt8](repeating: 0, count: w * h)
            var queue = [Int](repeating: 0, count: w * h)
            var qHead = 0
            var qTail = 0

            func isNeutralWhiteBg(_ idx: Int) -> Bool {
                let p = idx * 4
                if rgba[p + 3] < 16 { return true }
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let maxC = max(r, max(g, b))
                let minC = min(r, min(g, b))
                return minC >= 218 && (maxC - minC) <= 28
            }

            func enqueue(_ x: Int, _ y: Int) {
                if x < 0 || x >= w || y < 0 || y >= h { return }
                let i = y * w + x
                if visited[i] != 0 || !isNeutralWhiteBg(i) { return }
                visited[i] = 1
                queue[qTail] = i
                qTail += 1
            }

            for x in 0..<w {
                enqueue(x, 0)
                enqueue(x, h - 1)
            }
            for y in 0..<h {
                enqueue(0, y)
                enqueue(w - 1, y)
            }

            // Hollow ring center seed for UI_AVATAR_FRAME and UI_JOYSTICK_BASE
            if key == "UI_AVATAR_FRAME" || key == "UI_JOYSTICK_BASE" {
                let cx = w / 2
                let cy = h / 2
                for dy in -4...4 {
                    for dx in -4...4 {
                        enqueue(cx + dx, cy + dy)
                    }
                }
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

            // Boundary white halo unmixing + tight bounding box measurement
            var minX = w
            var minY = h
            var maxX = 0
            var maxY = 0

            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if x > 0 && x + 1 < w && y > 0 && y + 1 < h {
                        if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
                            let r = Double(rgba[p])
                            let g = Double(rgba[p + 1])
                            let b = Double(rgba[p + 2])
                            let minC = min(r, min(g, b))
                            if minC > 150.0 {
                                let cleanAlpha = max(0.0, min(1.0, (250.0 - minC) / 100.0))
                                rgba[p] = UInt8((r * cleanAlpha).rounded())
                                rgba[p + 1] = UInt8((g * cleanAlpha).rounded())
                                rgba[p + 2] = UInt8((b * cleanAlpha).rounded())
                                rgba[p + 3] = UInt8((Double(rgba[p + 3]) * cleanAlpha).rounded())
                            }
                        }
                    }
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }

            guard let keyedCG = ctx.makeImage() else { continue }
            if maxX >= minX && maxY >= minY {
                let bw = max(1, maxX - minX + 1)
                let bh = max(1, maxY - minY + 1)
                if let tightCG = keyedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    let pad: CGFloat = 4.0
                    let avail = CGFloat(outSize) - pad * 2.0
                    let scale = min(avail / CGFloat(bw), avail / CGFloat(bh))
                    let drawW = CGFloat(bw) * scale
                    let drawH = CGFloat(bh) * scale
                    let drawX = (CGFloat(outSize) - drawW) * 0.5
                    let drawY = (CGFloat(outSize) - drawH) * 0.5

                    let format = UIGraphicsImageRendererFormat()
                    format.scale = 1.0
                    format.opaque = false
                    let renderer = UIGraphicsImageRenderer(size: CGSize(width: outSize, height: outSize), format: format)
                    let normImg = renderer.image { rCtx in
                        UIImage(cgImage: tightCG).draw(in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
                    }
                    uiIconImages[key] = normImg
                    continue
                }
            }
            uiIconImages[key] = UIImage(cgImage: keyedCG)
        }
    }

    /// Slices the Banner & Avatar Plate Sheet (buttons_16e3a0cf.png)
    /// Neutral dark grey background (~RGB 60,60,60), hollowing out the circular shark window in UI_PLATE_AVATAR_BAR.
    private func sliceUiBannerSheet(_ sheetImage: UIImage) {
        guard let cgSheet = sheetImage.cgImage else { return }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)

        for (key, bounds) in GameConfigGenerated.uiBannerBounds {
            let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
            let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
            let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
            let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))

            guard let cropped = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else { continue }
            let w = cellW
            let h = cellH
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
            ) else { continue }
            ctx.interpolationQuality = .high
            ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))

            let cornerR = Int(rgba[0])
            let cornerG = Int(rgba[1])
            let cornerB = Int(rgba[2])
            let bgR = (cornerR > 25 && cornerR < 105) ? cornerR : 60
            let bgG = (cornerG > 25 && cornerG < 105) ? cornerG : 60
            let bgB = (cornerB > 25 && cornerB < 105) ? cornerB : 60

            var visited = [UInt8](repeating: 0, count: w * h)
            var queue = [Int](repeating: 0, count: w * h)
            var qHead = 0
            var qTail = 0

            func isNeutralStudioGrey(_ idx: Int) -> Bool {
                let p = idx * 4
                if rgba[p + 3] < 16 { return true }
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let maxC = max(r, max(g, b))
                let minC = min(r, min(g, b))
                let chroma = maxC - minC
                let diff = max(abs(r - bgR), max(abs(g - bgG), abs(b - bgB)))
                return diff <= 16 && chroma <= 12
            }

            func enqueue(_ x: Int, _ y: Int) {
                if x < 0 || x >= w || y < 0 || y >= h { return }
                let i = y * w + x
                if visited[i] != 0 || !isNeutralStudioGrey(i) { return }
                visited[i] = 1
                queue[qTail] = i
                qTail += 1
            }

            for x in 0..<w {
                enqueue(x, 0)
                enqueue(x, h - 1)
            }
            for y in 0..<h {
                enqueue(0, y)
                enqueue(w - 1, y)
            }

            // Seed center of circular avatar frame in UI_PLATE_AVATAR_BAR so shark preview shows through
            if key == "UI_PLATE_AVATAR_BAR" {
                let seedX = Int((0.2398 * fullW).rounded()) - sx
                let seedY = Int((0.3125 * fullH).rounded()) - sy
                for dy in -8...8 {
                    for dx in -8...8 {
                        enqueue(seedX + dx, seedY + dy)
                    }
                }
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

            // 3px edge feathering + tight bounding box
            var minX = w
            var minY = h
            var maxX = 0
            var maxY = 0
            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if x > 0 && x + 1 < w && y > 0 && y + 1 < h {
                        if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
                            let r = Int(rgba[p])
                            let g = Int(rgba[p + 1])
                            let b = Int(rgba[p + 2])
                            let diff = Double(max(abs(r - bgR), max(abs(g - bgG), abs(b - bgB))))
                            let chroma = Double(max(r, max(g, b)) - min(r, min(g, b)))
                            let edgeSignal = max(diff, chroma * 1.35)
                            if edgeSignal < 44.0 {
                                let cleanAlpha = max(0.0, min(1.0, (edgeSignal - 10.0) / 34.0))
                                rgba[p] = UInt8((Double(r) * cleanAlpha).rounded())
                                rgba[p + 1] = UInt8((Double(g) * cleanAlpha).rounded())
                                rgba[p + 2] = UInt8((Double(b) * cleanAlpha).rounded())
                                rgba[p + 3] = UInt8((Double(rgba[p + 3]) * cleanAlpha).rounded())
                            }
                        }
                    }
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }

            guard let keyedCG = ctx.makeImage() else { continue }
            if maxX >= minX && maxY >= minY {
                let bw = max(1, maxX - minX + 1)
                let bh = max(1, maxY - minY + 1)

                if key == "UI_PLATE_AVATAR_BAR" {
                    let holeCx = (0.2398 * fullW - Double(sx) - Double(minX)) / Double(bw)
                    let holeCy = (0.3125 * fullH - Double(sy) - Double(minY)) / Double(bh)
                    let holeInnerDia = (0.1406 * fullW) / Double(bh)
                    let holeOuterDia = (0.1750 * fullW) / Double(bh)
                    avatarBarHollowMetrics = AvatarBarHollowMetrics(
                        cxPct: CGFloat(holeCx * 100.0),
                        cyPct: CGFloat(holeCy * 100.0),
                        innerDiaPctH: CGFloat(holeInnerDia * 100.0),
                        outerDiaPctH: CGFloat(holeOuterDia * 100.0),
                        aspectRatio: CGFloat(Double(bw) / Double(bh))
                    )
                }

                if let tightCG = keyedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    uiBannerImages[key] = UIImage(cgImage: tightCG)
                    continue
                }
            }
            uiBannerImages[key] = UIImage(cgImage: keyedCG)
        }
    }

    /// Slices the Pause / Settings / GameOver Modal & Button Sheet (setting_83a7a273.png)
    /// Includes inner window hollowing for SETTING_MODAL_FRAME, clean medallion variant SETTING_MODAL_FRAME_CLEAN,
    /// 3-slice horizontal widening for SETTING_SHARK_CARD (6.05:1), and icon extraction + scanline patching for SETTING_BTN_*.
    private func sliceUiSettingSheet(_ sheetImage: UIImage) {
        guard let cgSheet = sheetImage.cgImage else { return }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)

        let iconExtractKeys: Set<String> = [
            "SETTING_BTN_LANG",
            "SETTING_BTN_SOUND",
            "SETTING_BTN_TUTORIAL",
            "SETTING_BTN_RESTART",
            "SETTING_BTN_MAIN_MENU"
        ]

        for (key, bounds) in GameConfigGenerated.uiSettingBounds {
            let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
            let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
            let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
            let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))

            guard let cropped = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else { continue }
            let w = cellW
            let h = cellH
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
            ) else { continue }
            ctx.interpolationQuality = .high
            ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))

            var visited = [UInt8](repeating: 0, count: w * h)
            var queue = [Int](repeating: 0, count: w * h)
            var qHead = 0
            var qTail = 0

            func isDarkCharcoalBg(_ idx: Int) -> Bool {
                let p = idx * 4
                if rgba[p + 3] < 16 { return true }
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let maxC = max(r, max(g, b))
                let minC = min(r, min(g, b))
                return r <= 37 && g <= 37 && b <= 41 && (maxC - minC) <= 8
            }

            func enqueue(_ x: Int, _ y: Int) {
                if x < 0 || x >= w || y < 0 || y >= h { return }
                let i = y * w + x
                if visited[i] != 0 || !isDarkCharcoalBg(i) { return }
                visited[i] = 1
                queue[qTail] = i
                qTail += 1
            }

            for x in 0..<w {
                enqueue(x, 0)
                enqueue(x, h - 1)
            }
            for y in 0..<h {
                enqueue(0, y)
                enqueue(w - 1, y)
            }

            if key == "SETTING_MODAL_FRAME" {
                let innerSeedX = Int((0.273 * fullW).rounded()) - sx
                let innerSeedY = Int((0.380 * fullH).rounded()) - sy
                for dy in -12...12 {
                    for dx in -12...12 {
                        enqueue(innerSeedX + dx, innerSeedY + dy)
                    }
                }
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

            var minX = w
            var minY = h
            var maxX = 0
            var maxY = 0
            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }

            guard maxX >= minX && maxY >= minY else { continue }
            let bw = max(1, maxX - minX + 1)
            let bh = max(1, maxY - minY + 1)

            // Extract left-baked icon & patch button interior with horizontal scanline interpolation
            if iconExtractKeys.contains(key) {
                let ix0 = minX + Int((Double(bw) * 0.14).rounded(.down))
                let ix1 = minX + Int((Double(bw) * 0.34).rounded(.up))
                let iy0 = minY + Int((Double(bh) * 0.18).rounded(.down))
                let iy1 = minY + Int((Double(bh) * 0.82).rounded(.up))
                let iw = max(1, ix1 - ix0)
                let ih = max(1, iy1 - iy0)

                var iconRgba = [UInt8](repeating: 0, count: iw * ih * 4)
                var iminX = iw, iminY = ih, imaxX = 0, imaxY = 0
                for y in 0..<ih {
                    for x in 0..<iw {
                        let srcIdx = ((iy0 + y) * w + (ix0 + x)) * 4
                        let dstIdx = (y * iw + x) * 4
                        let r = Int(rgba[srcIdx])
                        let g = Int(rgba[srcIdx + 1])
                        let b = Int(rgba[srcIdx + 2])
                        let a = Int(rgba[srcIdx + 3])
                        let lum = (r * 299 + g * 587 + b * 114) / 1000
                        if a > 30 && lum > 92 {
                            let boost = min(1.0, max(0.0, (Double(lum - 92)) / 58.0))
                            let outA = Double(a) * boost
                            iconRgba[dstIdx] = UInt8((Double(r) * boost).rounded())
                            iconRgba[dstIdx + 1] = UInt8((Double(g) * boost).rounded())
                            iconRgba[dstIdx + 2] = UInt8((Double(b) * boost).rounded())
                            iconRgba[dstIdx + 3] = UInt8(outA.rounded())
                            if outA > 25 {
                                if x < iminX { iminX = x }
                                if x > imaxX { imaxX = x }
                                if y < iminY { iminY = y }
                                if y > imaxY { imaxY = y }
                            }
                        }
                    }
                }

                if imaxX >= iminX && imaxY >= iminY,
                   let iconCtx = CGContext(
                       data: &iconRgba,
                       width: iw,
                       height: ih,
                       bitsPerComponent: 8,
                       bytesPerRow: iw * 4,
                       space: colorSpace,
                       bitmapInfo: bitmapInfo
                   ),
                   let rawIconCG = iconCtx.makeImage(),
                   let tightIconCG = rawIconCG.cropping(to: CGRect(x: iminX, y: iminY, width: imaxX - iminX + 1, height: imaxY - iminY + 1)) {
                    let iconSize = 96
                    let pad: CGFloat = 6
                    let tw = imaxX - iminX + 1
                    let th = imaxY - iminY + 1
                    let sc = min((CGFloat(iconSize) - pad * 2) / CGFloat(tw), (CGFloat(iconSize) - pad * 2) / CGFloat(th))
                    let dw = CGFloat(tw) * sc
                    let dh = CGFloat(th) * sc
                    let format = UIGraphicsImageRendererFormat()
                    format.scale = 1.0
                    format.opaque = false
                    let renderer = UIGraphicsImageRenderer(size: CGSize(width: iconSize, height: iconSize), format: format)
                    uiSettingIconImages[key] = renderer.image { _ in
                        UIImage(cgImage: tightIconCG).draw(in: CGRect(x: (CGFloat(iconSize) - dw) * 0.5, y: (CGFloat(iconSize) - dh) * 0.5, width: dw, height: dh))
                    }
                }

                // Patch baked icon region [12%..37% x, 17%..83% y] using horizontal scanline interpolation
                let px0 = minX + Int((Double(bw) * 0.12).rounded(.down))
                let px1 = minX + Int((Double(bw) * 0.37).rounded(.up))
                let py0 = minY + Int((Double(bh) * 0.17).rounded(.down))
                let py1 = minY + Int((Double(bh) * 0.83).rounded(.up))
                let rx0 = minX + Int((Double(bw) * 0.42).rounded(.down))
                let rx1 = minX + Int((Double(bw) * 0.72).rounded(.down))
                let refSpan = max(1, rx1 - rx0)

                for y in py0...min(h - 1, py1) {
                    let leftSampleX = max(minX, px0 - 2)
                    let lp = (y * w + leftSampleX) * 4
                    let lr = Double(rgba[lp])
                    let lg = Double(rgba[lp + 1])
                    let lb = Double(rgba[lp + 2])
                    let la = Double(rgba[lp + 3])

                    for x in px0...min(w - 1, px1) {
                        let t = Double(x - px0) / Double(max(1, px1 - px0))
                        let refX = rx0 + ((x - px0) % refSpan)
                        let rp = (y * w + min(w - 1, refX)) * 4
                        let rr = Double(rgba[rp])
                        let rg = Double(rgba[rp + 1])
                        let rb = Double(rgba[rp + 2])
                        let ra = Double(rgba[rp + 3])

                        let dp = (y * w + x) * 4
                        rgba[dp] = UInt8((lr * (1.0 - t) + rr * t).rounded())
                        rgba[dp + 1] = UInt8((lg * (1.0 - t) + rg * t).rounded())
                        rgba[dp + 2] = UInt8((lb * (1.0 - t) + rb * t).rounded())
                        rgba[dp + 3] = UInt8(max(la, ra).rounded())
                    }
                }
            }

            guard let patchedCG = ctx.makeImage(),
                  let tightCG = patchedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) else { continue }

            // Special 5-slice horizontal widening for SETTING_SHARK_CARD:
            // Widens BOTH the left recessed shark avatar frame (so horizontal sharks fit 100% inside the box)
            // AND the right data body to match the 4.80:1 card aspect ratio!
            if key == "SETTING_SHARK_CARD" {
                let targetW = max(bw, Int((Double(bh) * 4.80).rounded()))
                let s1W = Int((Double(bw) * 0.085).rounded(.down))
                let s2W = Int((Double(bw) * 0.090).rounded(.down))
                let s3W = Int((Double(bw) * 0.085).rounded(.down))
                let s5W = Int((Double(bw) * 0.100).rounded(.down))
                let s4W = max(1, bw - s1W - s2W - s3W - s5W)

                let extraAvatarW = Int((Double(bh) * 0.50).rounded())
                let dstS2W = s2W + extraAvatarW
                let dstS4W = max(1, targetW - s1W - dstS2W - s3W - s5W)

                let format = UIGraphicsImageRendererFormat()
                format.scale = 1.0
                format.opaque = false
                let renderer = UIGraphicsImageRenderer(size: CGSize(width: targetW, height: bh), format: format)
                let wideImg = renderer.image { _ in
                    var srcX = 0
                    var dstX = 0

                    // Slice 1: Left card border + left rim of recessed avatar box
                    if let c1 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s1W, height: bh)) {
                        UIImage(cgImage: c1).draw(in: CGRect(x: dstX, y: 0, width: s1W, height: bh))
                    }
                    srcX += s1W; dstX += s1W

                    // Slice 2: Uniform middle of recessed avatar box (widened so horizontal shark fits inside!)
                    if let c2 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s2W, height: bh)) {
                        UIImage(cgImage: c2).draw(in: CGRect(x: dstX, y: 0, width: dstS2W, height: bh))
                    }
                    srcX += s2W; dstX += dstS2W

                    // Slice 3: Right rim of recessed avatar box
                    if let c3 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s3W, height: bh)) {
                        UIImage(cgImage: c3).draw(in: CGRect(x: dstX, y: 0, width: s3W, height: bh))
                    }
                    srcX += s3W; dstX += s3W

                    // Slice 4: Uniform middle of right card body
                    if let c4 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s4W, height: bh)) {
                        UIImage(cgImage: c4).draw(in: CGRect(x: dstX, y: 0, width: dstS4W, height: bh))
                    }
                    srcX += s4W; dstX += dstS4W

                    // Slice 5: Right chamfered border of card
                    if let c5 = tightCG.cropping(to: CGRect(x: bw - s5W, y: 0, width: s5W, height: bh)) {
                        UIImage(cgImage: c5).draw(in: CGRect(x: dstX, y: 0, width: s5W, height: bh))
                    }
                }
                uiSettingImages[key] = wideImg
                continue
            }

            uiSettingImages[key] = UIImage(cgImage: tightCG)

            // Also generate SETTING_MODAL_FRAME_CLEAN with top medallion pause bars smoothed out for GameOver modal
            if key == "SETTING_MODAL_FRAME" {
                let mx0 = minX + Int((Double(bw) * 0.424).rounded(.down))
                let mx1 = minX + Int((Double(bw) * 0.488).rounded(.up))
                let my0 = minY + Int((Double(bh) * 0.038).rounded(.down))
                let my1 = minY + Int((Double(bh) * 0.118).rounded(.up))

                for y in my0...min(h - 1, my1) {
                    let lp = (y * w + max(minX, mx0 - 2)) * 4
                    let rp = (y * w + min(w - 1, mx1 + 2)) * 4
                    let lr = Double(rgba[lp]), lg = Double(rgba[lp + 1]), lb = Double(rgba[lp + 2]), la = Double(rgba[lp + 3])
                    let rr = Double(rgba[rp]), rg = Double(rgba[rp + 1]), rb = Double(rgba[rp + 2]), ra = Double(rgba[rp + 3])
                    let span = Double(max(1, mx1 - mx0))
                    for x in mx0...min(w - 1, mx1) {
                        let t = Double(x - mx0) / span
                        let dp = (y * w + x) * 4
                        rgba[dp] = UInt8((lr * (1.0 - t) + rr * t).rounded())
                        rgba[dp + 1] = UInt8((lg * (1.0 - t) + rg * t).rounded())
                        rgba[dp + 2] = UInt8((lb * (1.0 - t) + rb * t).rounded())
                        rgba[dp + 3] = UInt8(max(la, ra).rounded())
                    }
                }
                if let cleanFullCG = ctx.makeImage(),
                   let cleanTightCG = cleanFullCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    uiSettingImages["SETTING_MODAL_FRAME_CLEAN"] = UIImage(cgImage: cleanTightCG)
                }
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

        // Boundary Color-to-Alpha unmixing on 2px halo around removed white background + tight bounding-box measurement
        var minX = w
        var minY = h
        var maxX = 0
        var maxY = 0

        if h > 2 && w > 2 {
            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if x > 0 && x + 1 < w && y > 0 && y + 1 < h {
                        if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
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
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }
        }

        guard let outCG = ctx.makeImage() else { return nil }
        // Tight-crop non-transparent bounding box for all shark & prey sprites (1:1 parity with Web spriteSheetManager.ts)
        if !topSkyOnly && maxX >= minX && maxY >= minY {
            let pad = 2
            let cx = max(0, minX - pad)
            let cy = max(0, minY - pad)
            let cw = min(w - cx, (maxX - minX + 1) + pad * 2)
            let ch = min(h - cy, (maxY - minY + 1) + pad * 2)
            if cw > 4 && ch > 4, let tightCG = outCG.cropping(to: CGRect(x: cx, y: cy, width: cw, height: ch)) {
                return UIImage(cgImage: tightCG)
            }
        }
        return UIImage(cgImage: outCG)
    }

    /// Synthesizes a horizontally-seamless tile from an RGBA pixel buffer by cross-fading a seamRatio overlap band
    /// using a cosine weight curve (zero vertical seam lines between repeated tiles).
    private func makeHorizontallySeamlessImage(
        rgba sBuf: [UInt8],
        width sw: Int,
        height sh: Int,
        seamRatio: Double
    ) -> UIImage? {
        let overlap = max(12, min(sw / 4, Int((Double(sw) * seamRatio).rounded())))
        let outW = max(16, sw - overlap)
        var oBuf = [UInt8](repeating: 0, count: outW * sh * 4)

        for y in 0..<sh {
            let rowIn = y * sw
            let rowOut = y * outW
            for x in 0..<outW {
                let dstIdx = (rowOut + x) * 4
                if x < overlap {
                    let t = (Double(x) + 0.5) / Double(overlap)
                    let wLeft = 0.5 - 0.5 * cos(.pi * t)
                    let wRight = 1.0 - wLeft

                    let idxL = (rowIn + x) * 4
                    let idxR = (rowIn + outW + x) * 4

                    // Unpremultiply before blending, then repremultiply
                    let aL = Double(sBuf[idxL + 3]) / 255.0
                    let aR = Double(sBuf[idxR + 3]) / 255.0
                    let outA = aL * wLeft + aR * wRight

                    if outA <= 0.002 {
                        oBuf[dstIdx] = 0
                        oBuf[dstIdx + 1] = 0
                        oBuf[dstIdx + 2] = 0
                        oBuf[dstIdx + 3] = 0
                    } else {
                        let rL = aL > 0.01 ? Double(sBuf[idxL]) / aL : 0.0
                        let gL = aL > 0.01 ? Double(sBuf[idxL + 1]) / aL : 0.0
                        let bL = aL > 0.01 ? Double(sBuf[idxL + 2]) / aL : 0.0
                        let rR = aR > 0.01 ? Double(sBuf[idxR]) / aR : 0.0
                        let gR = aR > 0.01 ? Double(sBuf[idxR + 1]) / aR : 0.0
                        let bR = aR > 0.01 ? Double(sBuf[idxR + 2]) / aR : 0.0

                        let weightL = (aL * wLeft) / outA
                        let weightR = (aR * wRight) / outA
                        let rMix = (rL * weightL + rR * weightR) * outA
                        let gMix = (gL * weightL + gR * weightR) * outA
                        let bMix = (bL * weightL + bR * weightR) * outA

                        oBuf[dstIdx] = UInt8(max(0.0, min(255.0, rMix.rounded())))
                        oBuf[dstIdx + 1] = UInt8(max(0.0, min(255.0, gMix.rounded())))
                        oBuf[dstIdx + 2] = UInt8(max(0.0, min(255.0, bMix.rounded())))
                        oBuf[dstIdx + 3] = UInt8(max(0.0, min(255.0, (outA * 255.0).rounded())))
                    }
                } else {
                    let idxS = (rowIn + x) * 4
                    oBuf[dstIdx] = sBuf[idxS]
                    oBuf[dstIdx + 1] = sBuf[idxS + 1]
                    oBuf[dstIdx + 2] = sBuf[idxS + 2]
                    oBuf[dstIdx + 3] = sBuf[idxS + 3]
                }
            }
        }

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &oBuf,
            width: outW,
            height: sh,
            bitsPerComponent: 8,
            bytesPerRow: outW * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ), let cgOut = ctx.makeImage() else {
            return nil
        }
        return UIImage(cgImage: cgOut)
    }

    /// Processes Layer 0 Water Canopy ('bg_shallow_0_water', 'bg_twilight_0', 'bg_abyss_0'):
    /// - Trims top/bottom white margins and right-edge white border on 'bg_shallow_0_water'
    /// - Smoothly unmixes the bottom #FFFFFF fade using a C1 cosine vertical envelope so sunbeams dissolve invisibly into the water column (zero horizontal cutoff line!)
    /// - Applies cosine horizontal cross-fading so repeated tiles have zero vertical seam lines!
    private func processWaterLayerToSeamlessTile(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height
        let isShallowCanopy = assetName.contains("shallow_0_water") || (Double(srcW) / Double(max(1, srcH)) > 3.0)

        let cropLeft = Int((Double(srcW) * (isShallowCanopy ? 0.012 : 0.010)).rounded())
        let cropRight = Int((Double(srcW) * (isShallowCanopy ? 0.968 : 0.990)).rounded())
        let cropTop = Int((Double(srcH) * (isShallowCanopy ? 0.032 : 0.008)).rounded())
        let cropBot = Int((Double(srcH) * (isShallowCanopy ? 0.902 : 0.992)).rounded())
        let cropW = max(64, cropRight - cropLeft)
        let cropH = max(32, cropBot - cropTop)

        guard let croppedCG = cgImg.cropping(to: CGRect(x: cropLeft, y: cropTop, width: cropW, height: cropH)) else {
            return nil
        }

        let maxDim = isShallowCanopy ? 1280 : 768
        let scale = cropW > maxDim ? Double(maxDim) / Double(cropW) : 1.0
        let w = max(64, Int((Double(cropW) * scale).rounded()))
        let h = max(32, Int((Double(cropH) * scale).rounded()))

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
        ) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: h))

        if isShallowCanopy {
            for y in 0..<h {
                let v = Double(y) / Double(max(1, h - 1))
                // C1-continuous cosine vertical fade from v=0.18 down to v=0.95 (100% zero alpha at bottom edge)
                let normV = min(1.0, max(0.0, (v - 0.18) / 0.76))
                let verticalEnvelope = v <= 0.18
                    ? 1.0
                    : (v >= 0.94 ? 0.0 : pow(cos(normV * .pi * 0.5), 1.85))
                let rowOff = y * w
                for x in 0..<w {
                    let idx = (rowOff + x) * 4
                    let r = Double(rgba[idx])
                    let g = Double(rgba[idx + 1])
                    let b = Double(rgba[idx + 2])
                    let maxC = max(r, max(g, b))
                    let minC = min(r, min(g, b))
                    let sat = maxC > 0 ? (maxC - minC) / maxC : 0.0

                    // Strip any residual neutral white pixels near the top/sides
                    if minC >= 232.0 && sat < 0.08 {
                        rgba[idx] = 0
                        rgba[idx + 1] = 0
                        rgba[idx + 2] = 0
                        rgba[idx + 3] = 0
                        continue
                    }

                    if v >= 0.18 {
                        let cyanInk = max((255.0 - r) / 235.0, sat * 1.25)
                        let rawAlpha = max(0.0, min(1.0, cyanInk))
                        let unmixWeight = min(1.0, (v - 0.18) / 0.26)
                        let effAlpha = (1.0 - unmixWeight + unmixWeight * rawAlpha) * verticalEnvelope
                        if effAlpha <= 0.008 {
                            rgba[idx] = 0
                            rgba[idx + 1] = 0
                            rgba[idx + 2] = 0
                            rgba[idx + 3] = 0
                            continue
                        }
                        var outR = r
                        var outG = g
                        var outB = b
                        if rawAlpha > 0.05 && rawAlpha < 0.98 {
                            let invA = 1.0 / max(0.24, rawAlpha)
                            let ur = max(0.0, min(255.0, (r - 255.0 * (1.0 - rawAlpha)) * invA))
                            let ug = max(0.0, min(255.0, (g - 255.0 * (1.0 - rawAlpha)) * invA))
                            let ub = max(0.0, min(255.0, (b - 255.0 * (1.0 - rawAlpha)) * invA))
                            outR = r * (1.0 - unmixWeight) + ur * unmixWeight
                            outG = g * (1.0 - unmixWeight) + ug * unmixWeight
                            outB = b * (1.0 - unmixWeight) + ub * unmixWeight
                        }
                        // Store premultiplied RGBA
                        rgba[idx] = UInt8(max(0.0, min(255.0, (outR * effAlpha).rounded())))
                        rgba[idx + 1] = UInt8(max(0.0, min(255.0, (outG * effAlpha).rounded())))
                        rgba[idx + 2] = UInt8(max(0.0, min(255.0, (outB * effAlpha).rounded())))
                        rgba[idx + 3] = UInt8(max(0.0, min(255.0, (effAlpha * 255.0).rounded())))
                    }
                }
            }
        }

        return makeHorizontallySeamlessImage(rgba: rgba, width: w, height: h, seamRatio: isShallowCanopy ? 0.10 : 0.14)
    }

    /// Processes Far / Mid / Near Ocean Terrain Layers ('bg_{zone}_{1|2|3}') with 1:1 parity to 'parallaxBackground.ts':
    /// - Applies bottom margin crop (0.915 on 'shallow_1_far', 0.935 on 'shallow_2_mid')
    /// - Clears slice-overlap artifact rect [0, 0.78, 0.14, 1.0] and rounds flat top-left peak on 'shallow_1_far'
    /// - Runs BFS sky flood-fill + punches enclosed white coral/archway holes ('punchUpperInteriorWhiteHoles')
    /// - Despills 2px white/magenta boundary halo
    /// - Grounds bottom column notches ('groundBottomColumns') so stacked parallax layers have a 100% solid base
    /// - Trims vertical [minY, maxY] and applies cosine horizontal seam blending ('makeHorizontallySeamlessImage')
    private func processTerrainLayerToSeamlessStrip(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height

        let isShallowFar = assetName.contains("shallow_1_far")
        let isShallowMid = assetName.contains("shallow_2_mid")
        let isShallowNear = assetName.contains("shallow_3_near")
        let isAbyssMid = assetName.contains("abyss_2")

        let cropBottomRatio: Double = isShallowFar ? 0.915 : (isShallowMid ? 0.935 : 1.0)
        // Also trim 1% off left/right raw edges if there is any thin border artifact
        let cropX0 = Int((Double(srcW) * 0.006).rounded())
        let cropX1 = Int((Double(srcW) * 0.994).rounded())
        let effSrcW = max(64, cropX1 - cropX0)
        let effSrcH = max(32, Int((Double(srcH) * cropBottomRatio).rounded()))

        guard let croppedCG = cgImg.cropping(to: CGRect(x: cropX0, y: 0, width: effSrcW, height: effSrcH)) else {
            return nil
        }

        let isPanoramic = Double(effSrcW) / Double(max(1, effSrcH)) > 1.8
        let maxDim = isPanoramic ? 1280 : 640
        let scale = effSrcW > maxDim ? Double(maxDim) / Double(effSrcW) : 1.0
        let w = max(64, Int((Double(effSrcW) * scale).rounded()))
        let h = max(24, Int((Double(effSrcH) * scale).rounded()))

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
        ) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: h))

        // 1. Clear stray slice-overlap artifact rect & round top-left flat-sliced seamount peak on shallow_1_far
        if isShallowFar {
            let rx1 = Int((Double(w) * 0.14).rounded(.up))
            let ry0 = Int((Double(h) * 0.78).rounded(.down))
            for y in max(0, ry0)..<h {
                for x in 0..<min(w, rx1) {
                    let p = (y * w + x) * 4
                    rgba[p] = 255; rgba[p + 1] = 255; rgba[p + 2] = 255; rgba[p + 3] = 0
                }
            }
            let xStart = Int((Double(w) * 0.032).rounded(.down))
            let xEnd = Int((Double(w) * 0.158).rounded(.up))
            let xCenter = Double(xStart + xEnd) * 0.5
            let xHalf = max(1.0, Double(xEnd - xStart) * 0.5)
            for x in max(0, xStart)...min(w - 1, xEnd) {
                let nx = (Double(x) - xCenter) / xHalf
                let archCurve = Int((Double(h) * (0.015 + 0.14 * nx * nx + 0.025 * sin(nx * .pi * 2.0))).rounded())
                for y in 0..<min(h, max(0, archCurve)) {
                    let p = (y * w + x) * 4
                    rgba[p] = 255; rgba[p + 1] = 255; rgba[p + 2] = 255; rgba[p + 3] = 0
                }
            }
        }

        // 2. BFS Flood-Fill from top sky border and upper 68% left/right edges
        var visited = [UInt8](repeating: 0, count: w * h)
        var queue = [Int](repeating: 0, count: w * h)
        var qHead = 0
        var qTail = 0

        func isBgCandidate(_ i: Int) -> Bool {
            let p = i * 4
            if rgba[p + 3] < 16 { return true }
            let r = Int(rgba[p])
            let g = Int(rgba[p + 1])
            let b = Int(rgba[p + 2])
            let maxC = max(r, max(g, b))
            let minC = min(r, min(g, b))
            let isWhite = minC >= 216 && (maxC - minC) <= 32
            let isMagenta = r >= 180 && b >= 180 && g <= 135 && (r - g) >= 65 && (b - g) >= 65
            return isWhite || isMagenta
        }

        func pushSeed(_ x: Int, _ y: Int) {
            if x < 0 || x >= w || y < 0 || y >= h { return }
            let i = y * w + x
            if visited[i] != 0 || !isBgCandidate(i) { return }
            visited[i] = 1
            queue[qTail] = i
            qTail += 1
        }

        for x in 0..<w {
            pushSeed(x, 0)
            pushSeed(x, min(h - 1, 1))
        }
        let maxSideY = Int(Double(h) * 0.68)
        for y in 0..<maxSideY {
            pushSeed(0, y)
            pushSeed(w - 1, y)
        }

        while qHead < qTail {
            let curr = queue[qHead]
            qHead += 1
            let cx = curr % w
            let cy = (curr - cx) / w
            if cx > 0 { pushSeed(cx - 1, cy) }
            if cx + 1 < w { pushSeed(cx + 1, cy) }
            if cy > 0 { pushSeed(cx, cy - 1) }
            if cy + 1 < h { pushSeed(cx, cy + 1) }
        }

        // 3. Punch enclosed white holes in upper coral/rock archways on shallow layers
        if isShallowFar || isShallowMid || isShallowNear {
            let holeRatio = isShallowFar ? 0.86 : (isShallowMid ? 0.82 : 0.48)
            let maxHoleY = Int(Double(h) * holeRatio)
            for y in 0..<min(h, maxHoleY) {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] == 0 {
                        let p = i * 4
                        let r = Int(rgba[p])
                        let g = Int(rgba[p + 1])
                        let b = Int(rgba[p + 2])
                        let minC = min(r, min(g, b))
                        let maxC = max(r, max(g, b))
                        if minC >= 224 && (maxC - minC) <= 26 {
                            visited[i] = 1
                        }
                    }
                }
            }
        }

        for i in 0..<(w * h) {
            if visited[i] != 0 {
                let p = i * 4
                rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
            }
        }

        // 4. Despill & feather 2px boundary halo around removed sky/background
        if h > 2 && w > 2 {
            for y in 1..<(h - 1) {
                let rowOff = y * w
                for x in 1..<(w - 1) {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let hasTrans = visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0
                    if hasTrans {
                        let p = i * 4
                        let r = Double(rgba[p])
                        let g = Double(rgba[p + 1])
                        let b = Double(rgba[p + 2])
                        let minC = min(r, min(g, b))
                        let maxC = max(r, max(g, b))
                        if minC > 155.0 && (maxC - minC) < 55.0 {
                            let keep = max(0.0, min(1.0, (232.0 - minC) / 77.0))
                            rgba[p] = UInt8((r * 0.66 * keep).rounded())
                            rgba[p + 1] = UInt8((g * 0.72 * keep).rounded())
                            rgba[p + 2] = UInt8((b * 0.80 * keep).rounded())
                            rgba[p + 3] = UInt8((Double(rgba[p + 3]) * keep).rounded())
                        }
                    }
                }
            }
        }

        // 5. Ground bottom columns so elevated parallax planes have a 100% solid base (zero bottom gap lines!)
        let shouldGroundBottom = true
        if shouldGroundBottom {
            let bandRatio = isShallowFar ? 0.24 : (isShallowMid ? 0.14 : 0.18)
            let minSearchY = max(4, Int(Double(h) * (1.0 - bandRatio)))
            for x in 0..<w {
                var lastSolidY = -1
                for y in stride(from: h - 1, through: minSearchY, by: -1) {
                    let p = (y * w + x) * 4
                    let r = Int(rgba[p])
                    let g = Int(rgba[p + 1])
                    let b = Int(rgba[p + 2])
                    let minC = min(r, min(g, b))
                    let maxC = max(r, max(g, b))
                    let isWhiteMargin = minC >= 210 && (maxC - minC) <= 34
                    if rgba[p + 3] > 200 && !isWhiteMargin {
                        lastSolidY = y
                        break
                    }
                }
                if lastSolidY >= minSearchY && lastSolidY < h - 1 {
                    let srcY = max(0, lastSolidY - 2)
                    let sp = (srcY * w + x) * 4
                    let sr = rgba[sp], sg = rgba[sp + 1], sb = rgba[sp + 2]
                    for y in lastSolidY..<h {
                        let dp = (y * w + x) * 4
                        rgba[dp] = sr; rgba[dp + 1] = sg; rgba[dp + 2] = sb; rgba[dp + 3] = 255
                    }
                }
            }
        }

        // 6. Find vertical opaque bounding box [minY, maxY] to trim empty sky & bottom margin rows
        var minY = h - 1
        var maxY = 0
        for y in 0..<h {
            var opaqueCount = 0
            let rowOff = y * w
            for x in stride(from: 0, to: w, by: 2) {
                if rgba[(rowOff + x) * 4 + 3] > 28 {
                    opaqueCount += 1
                }
            }
            if opaqueCount >= 4 {
                if y < minY { minY = y }
                if y > maxY { maxY = y }
            }
        }

        if maxY <= minY + 16 {
            minY = 0
            maxY = h - 1
        } else {
            minY = max(0, minY - 2)
            maxY = min(h - 1, max(minY + 24, maxY - 1))
        }

        let cropH = maxY - minY + 1
        var croppedRgba = [UInt8](repeating: 0, count: w * cropH * 4)
        for y in 0..<cropH {
            let srcOff = (minY + y) * w * 4
            let dstOff = y * w * 4
            for byteIdx in 0..<(w * 4) {
                croppedRgba[dstOff + byteIdx] = rgba[srcOff + byteIdx]
            }
        }

        return makeHorizontallySeamlessImage(
            rgba: croppedRgba,
            width: w,
            height: cropH,
            seamRatio: isPanoramic ? 0.10 : 0.14
        )
    }
}
`;
}

function generateOceanGameSceneSwift(): string {
  return `import SpriteKit
import SwiftUI
import UIKit
import AudioToolbox
import simd
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// Production Google AdMob Rewarded Video Bridge (App ID: ${GOOGLE_ADS_CONFIG.admobAppId}, Unit ID: ${GOOGLE_ADS_CONFIG.admobRewardedAdUnitId}).
/// Automatically activates real GADRewardedAd when GoogleMobileAds SPM package is linked in Xcode,
/// and seamlessly falls back to the 3s in-app rewarded preview when offline or before SPM linking.
@MainActor
public final class GoogleAdMobManager: NSObject {
    public static let shared = GoogleAdMobManager()
    public let appId: String = GameConfigGenerated.googleAdMobAppId
    public let rewardedAdUnitId: String = GameConfigGenerated.googleAdMobRewardedAdUnitId

    #if canImport(GoogleMobileAds)
    private var rewardedAd: GADRewardedAd?
    private var isLoadingAd: Bool = false
    private var sdkStarted: Bool = false
    #endif

    public func startSDKAndPreload() {
        #if canImport(GoogleMobileAds)
        if !sdkStarted {
            sdkStarted = true
            GADMobileAds.sharedInstance().start { [weak self] _ in
                Task { @MainActor in
                    self?.preloadRewardedAd()
                }
            }
        } else {
            preloadRewardedAd()
        }
        #endif
    }

    public func preloadRewardedAd() {
        #if canImport(GoogleMobileAds)
        guard !isLoadingAd, rewardedAd == nil else { return }
        isLoadingAd = true
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: rewardedAdUnitId, request: request) { [weak self] ad, error in
            Task { @MainActor in
                guard let self = self else { return }
                self.isLoadingAd = false
                if error == nil, let loadedAd = ad {
                    self.rewardedAd = loadedAd
                }
            }
        }
        #endif
    }

    public func showRewardedAd(
        onReward: @escaping () -> Void,
        onFallback: @escaping () -> Void
    ) {
        #if canImport(GoogleMobileAds)
        guard let ad = rewardedAd,
              let rootVC = Self.topViewController() else {
            preloadRewardedAd()
            onFallback()
            return
        }
        rewardedAd = nil
        ad.present(fromRootViewController: rootVC) {
            onReward()
        }
        preloadRewardedAd()
        #else
        onFallback()
        #endif
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) ?? scenes.flatMap({ $0.windows }).first,
              var top = window.rootViewController else {
            return nil
        }
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}

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
            text = text.replacingOccurrences(of: "{\\(k)}", with: v)
        }
        // Guarantee no uninterpolated {var} placeholder ever leaks into the UI
        if text.contains("{"), let regex = try? NSRegularExpression(pattern: "\\\\{[a-zA-Z0-9_]+\\\\}") {
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
        _ = addXp(bonusXp)
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
            playSuccessSound()
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

    // MARK: - Google AdMob Rewarded Video + 3s Fallback Simulator
    public func openSimulatedRewardedAd(kind: SimRewardedAdKind) {
        GoogleAdMobManager.shared.showRewardedAd(
            onReward: { [weak self] in
                self?.grantAdReward(for: kind)
            },
            onFallback: { [weak self] in
                self?.presentFallbackSimulatedAd(kind: kind)
            }
        )
    }

    private func presentFallbackSimulatedAd(kind: SimRewardedAdKind) {
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
            desc = lang == "zh" ? "直接驾驶【\\(sName)】(Lv.5) 潜入深海狩猎！" : "Deploy [\\(sName)] (Lv.5) for this run!"
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
        grantAdReward(for: ad.kind)
    }

    public func grantAdReward(for kind: SimRewardedAdKind) {
        switch kind {
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

/// Native SpriteKit (Metal-Accelerated) Ocean Simulation, 5-Layer Parallax & Devour FX Scene
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
    private var biteAnim: Double = 0
    private var cameraShakeTrauma: Double = 0
    private var invulnTimer: Double = 0
    private var cameraX: Double = 0
    private var cameraY: Double = 220
    private var smoothedRelativePreyScale: Double = 1.0
    private var lastUpdateTime: TimeInterval = 0
    private var survivalAccumulator: Double = 0
    private var lastTrackedGameState: String = ""

    private let waterBgNode = SKSpriteNode()
    private let parallaxContainer = SKNode()
    private let worldContainer = SKNode()
    private let fxContainer = SKNode()
    private let sharkNode = SKSpriteNode()

    private enum PreySwimGait {
        case CARANGIFORM
        case ANGUILLIFORM
        case MEDUSOID_JET
        case PUFFER_BUOYANT
        case RIGID_PROPULSION
    }

    private final class ActivePrey {
        let config: PreyTierConfig
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var phase: Double
        var stateTimer: Double
        var armorHp: Int
        var mutation: PreyMutationVariant
        var inflateRatio: Double
        let cruiseDepthCenter: Double
        let cruiseAmpY: Double
        let cruiseFreq: Double

        init(config: PreyTierConfig, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double, mutation: PreyMutationVariant) {
            self.config = config
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.phase = Double.random(in: 0...(Double.pi * 2))
            self.stateTimer = Double.random(in: 0...4.0)
            self.armorHp = 2
            self.mutation = mutation
            self.inflateRatio = 0.0
            self.cruiseDepthCenter = max(config.minDepth + 35.0, min(config.maxDepth - 35.0, y))
            self.cruiseAmpY = Double.random(in: 12.0...26.0)
            self.cruiseFreq = Double.random(in: 0.36...0.68)
        }
    }

    private final class ActiveParticle {
        let node: SKShapeNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var life: Double
        let maxLife: Double
        let baseRadius: Double
        let isRing: Bool

        init(node: SKShapeNode, x: Double, y: Double, vx: Double, vy: Double, maxLife: Double, baseRadius: Double, isRing: Bool = false) {
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.life = maxLife
            self.maxLife = maxLife
            self.baseRadius = baseRadius
            self.isRing = isRing
        }
    }

    private final class ActivePickup {
        let isGene: Bool
        let value: Int
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var spinPhase: Double
        var life: Double

        init(isGene: Bool, value: Int, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double) {
            self.isGene = isGene
            self.value = value
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.spinPhase = Double.random(in: 0...(Double.pi * 2))
            self.life = 11.0
        }
    }

    private final class ActiveFloatText {
        let node: SKLabelNode
        var x: Double
        var y: Double
        var vy: Double
        var life: Double
        let maxLife: Double

        init(node: SKLabelNode, x: Double, y: Double, vy: Double, maxLife: Double) {
            self.node = node
            self.x = x
            self.y = y
            self.vy = vy
            self.life = maxLife
            self.maxLife = maxLife
        }
    }

    private final class AmbientOceanBubble {
        let ringNode: SKShapeNode
        let highlightNode: SKShapeNode
        var x: Double
        var y: Double
        let r: Double
        let speedY: Double
        var wobblePhase: Double
        let baseAlpha: Double
        let kindIndex: Int // 0 = BUBBLE, 1 = MARINE_SNOW, 2 = BIO_SPORE, 3 = MAGMA_EMBER

        init(ringNode: SKShapeNode, highlightNode: SKShapeNode, x: Double, y: Double, r: Double, speedY: Double, wobblePhase: Double, baseAlpha: Double, kindIndex: Int) {
            self.ringNode = ringNode
            self.highlightNode = highlightNode
            self.x = x
            self.y = y
            self.r = r
            self.speedY = speedY
            self.wobblePhase = wobblePhase
            self.baseAlpha = baseAlpha
            self.kindIndex = kindIndex
        }
    }

    private let bubbleContainer = SKNode()
    private var parallaxTilePool: [SKSpriteNode] = []
    private var activeParallaxTileCount: Int = 0
    private var ambientBubbles: [AmbientOceanBubble] = []
    private var trailBubbleAccumulator: Double = 0.0
    private var activePreys: [ActivePrey] = []
    private var activeParticles: [ActiveParticle] = []
    private var activePickups: [ActivePickup] = []
    private var activeFloatTexts: [ActiveFloatText] = []
    private let maxActivePreys = 22

    public override func didMove(to view: SKView) {
        backgroundColor = UIColor(red: 6/255, green: 148/255, blue: 194/255, alpha: 1)
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0, y: 0)

        SpriteAtlasManager.shared.preloadAllIfNeeded()

        removeAllChildren()
        addChild(waterBgNode)
        addChild(parallaxContainer)
        bubbleContainer.zPosition = 8
        addChild(bubbleContainer)
        addChild(worldContainer)
        addChild(fxContainer)

        if parallaxTilePool.isEmpty {
            for _ in 0..<32 {
                let tileNode = SKSpriteNode()
                tileNode.anchorPoint = CGPoint(x: 0, y: 0)
                tileNode.isHidden = true
                parallaxContainer.addChild(tileNode)
                parallaxTilePool.append(tileNode)
            }
        } else {
            for tileNode in parallaxTilePool where tileNode.parent == nil {
                parallaxContainer.addChild(tileNode)
            }
        }

        sharkNode.zPosition = 20
        worldContainer.addChild(sharkNode)
        refreshSharkTexture()
        initAmbientBubblesIfNeeded(viewW: Double(max(640, size.width)), viewH: Double(max(360, size.height)))
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

        // Pause background SpriteKit simulation & @Published mutations while the Evolution Atlas modal is open
        // so SwiftUI dedicates 100% of main-thread 120Hz budget to the rotary wheel gesture & inertia!
        if vm.showEvolutionAtlas {
            return
        }

        let viewW = Double(max(320, size.width))
        let viewH = Double(max(240, size.height))
        let stats = vm.currentStats

        // Reset shark to comfortable mid-shallow depth when starting a new run
        if vm.gameState != lastTrackedGameState {
            if vm.gameState == "playing" && lastTrackedGameState == "title" {
                sharkY = max(145.0, min(260.0, sharkY))
                cameraY = sharkY
            }
            lastTrackedGameState = vm.gameState
        }

        if sharkNode.texture == nil || vm.lastRenderedSpriteKey != vm.activeSharkForm.spriteKey {
            refreshSharkTexture()
        }

        biteAnim = max(0.0, biteAnim - dt * 3.8)
        cameraShakeTrauma = max(0.0, cameraShakeTrauma - dt * 2.8)

        // Smooth ghost HP bar decay (only mutate @Published when value meaningfully changes to avoid 120Hz SwiftUI view invalidation!)
        let curHpPct = max(0, min(100, (vm.hp / max(1, vm.maxHp)) * 100.0))
        let nextGhostPct: Double
        if vm.ghostHpPct > curHpPct {
            nextGhostPct = max(curHpPct, vm.ghostHpPct - dt * 28.0)
        } else {
            nextGhostPct = curHpPct
        }
        if abs(vm.ghostHpPct - nextGhostPct) > 0.05 {
            vm.ghostHpPct = nextGhostPct
        }

        // 1. Update Shark Physics (Title screen patrol vs In-game hunting)
        if vm.gameState == "title" {
            let patrolDir: Double = cos(currentTime * 0.95) >= 0 ? 1.0 : -1.0
            let inputY = sin(currentTime * 2.2) * 0.12 + max(-0.18, min(0.18, (210.0 - sharkY) * 0.008))
            stepSharkKinematics(inputX: patrolDir, inputY: inputY, inputMagnitude: 1.0, isBoosting: false, stats: stats, dt: dt)
        } else if vm.gameState == "playing" && vm.simAd == nil {
            survivalAccumulator += dt
            if survivalAccumulator >= 1.0 {
                survivalAccumulator -= 1.0
                vm.runSurvivalSec += 1
            }

            let ix = Double(vm.joyDx)
            let iy = Double(vm.joyDy)
            let mag = hypot(ix, iy)
            let normX = mag > 0.08 ? ix / mag : 0.0
            let normY = mag > 0.08 ? iy / mag : 0.0
            let canBoost = vm.isBoostingHeld && vm.energy > 2.0
            stepSharkKinematics(inputX: normX, inputY: normY, inputMagnitude: mag, isBoosting: canBoost, stats: stats, dt: dt)

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
            let curDepth = Int(max(0, sharkY).rounded())
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

        // 2. Sea-Surface Locked Camera Tracking (keeps shark centered below top HUD bars!)
        let minSurfaceCameraY = 40.0
        let targetCamX = sharkX + cos(sharkAngle) * 58.0
        let targetCamY = max(minSurfaceCameraY, sharkY + sin(sharkAngle) * 28.0)
        cameraX += (targetCamX - cameraX) * min(1.0, dt * 6.5)
        cameraY += (targetCamY - cameraY) * min(1.0, dt * 6.5)

        if cameraShakeTrauma > 0.01 {
            let shakeMag = cameraShakeTrauma * cameraShakeTrauma * 9.0
            cameraX += Double.random(in: -shakeMag...shakeMag)
            cameraY += Double.random(in: -shakeMag...shakeMag)
        }

        // 3. Smooth Optical Growth Shrinking of Far / Mid / Near Background Layers
        let targetRelScale = stats.relativePreyScale
        if abs(targetRelScale - smoothedRelativePreyScale) > 0.35 {
            smoothedRelativePreyScale = targetRelScale
        } else {
            smoothedRelativePreyScale += (targetRelScale - smoothedRelativePreyScale) * min(1.0, dt * 4.5)
        }
        let bgScales = GameRules.getParallaxLayerGrowthScales(relativePreyScale: smoothedRelativePreyScale)

        renderParallaxBackground(viewW: viewW, viewH: viewH, bgScales: bgScales)
        stepAndRenderAmbientBubbles(viewW: viewW, viewH: viewH, bgScales: bgScales, dt: dt)
        stepAndRenderPreys(viewW: viewW, viewH: viewH, stats: stats, dt: dt, currentTime: currentTime)
        stepAndRenderDevourFX(viewW: viewW, viewH: viewH, stats: stats, dt: dt)
        renderPlayerShark(viewW: viewW, viewH: viewH, stats: stats)
    }

    private func stepSharkKinematics(inputX: Double, inputY: Double, inputMagnitude: Double, isBoosting: Bool, stats: ComputedSharkStats, dt: Double) {
        let hasDirectionInput = inputMagnitude > 0.08
        if hasDirectionInput {
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
        } else {
            turnRate *= max(0.0, 1.0 - dt * 10.0)
        }

        facingScaleX += (facingDir - facingScaleX) * min(1.0, dt * 11.0)

        // When joystick is not moved and not boosting, keep shark stationary in place (zero drift in previous direction!)
        if !hasDirectionInput && !isBoosting {
            sharkVx = 0.0
            sharkVy = 0.0
            swimPhase += dt * 3.2
            return
        }

        let heatMult = viewModel?.huntingHeatBuff.speedMultiplier ?? 1.0
        let joySpeedFactor = isBoosting ? 1.0 : min(1.0, max(0.55, inputMagnitude))
        let speed = (isBoosting ? stats.boostSpeed : stats.moveSpeed * joySpeedFactor) * heatMult
        sharkVx = cos(sharkAngle) * speed
        sharkVy = sin(sharkAngle) * speed
        sharkX += sharkVx * dt
        sharkY = max(46.0, min(2200.0, sharkY + sharkVy * dt))
        swimPhase += dt * (isBoosting ? 12.5 : 7.8)

        // Emit swimming bubbles from shark tail (faster during Boost, shimmering Gold during Gold Frenzy!)
        let isFrenzy = viewModel?.frenzyActive ?? false
        let emitInterval = (isBoosting || isFrenzy) ? 0.045 : 0.16
        trailBubbleAccumulator += dt
        if trailBubbleAccumulator >= emitInterval {
            trailBubbleAccumulator = 0.0
            spawnSharkWakeBubble(stats: stats, isBoosting: isBoosting, isFrenzy: isFrenzy)
        }
    }

    private func spawnSharkWakeBubble(stats: ComputedSharkStats, isBoosting: Bool, isFrenzy: Bool) {
        if activeParticles.count > 44 { return }
        let tailX = sharkX - cos(sharkAngle) * 38.0 * stats.scale + Double.random(in: -6...6)
        let tailY = sharkY - sin(sharkAngle) * 38.0 * stats.scale + Double.random(in: -6...6)
        let rad = isFrenzy ? Double.random(in: 3.2...6.4) : (isBoosting ? Double.random(in: 2.8...5.6) : Double.random(in: 2.0...4.0))
        let bubble = SKShapeNode(circleOfRadius: CGFloat(rad))
        if isFrenzy {
            bubble.fillColor = UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 0.88)
            bubble.strokeColor = UIColor(red: 255/255, green: 251/255, blue: 235/255, alpha: 0.95)
            bubble.lineWidth = 1.4
        } else {
            bubble.fillColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.22)
            bubble.strokeColor = UIColor(red: 224/255, green: 242/255, blue: 254/255, alpha: 0.78)
            bubble.lineWidth = 1.15
        }
        bubble.zPosition = 18
        fxContainer.addChild(bubble)
        let backVx = -cos(sharkAngle) * (isBoosting ? 42.0 : 16.0) + Double.random(in: -14...14)
        let upVy = -Double.random(in: 22...52)
        activeParticles.append(
            ActiveParticle(
                node: bubble,
                x: tailX,
                y: tailY,
                vx: backVx,
                vy: upVy,
                maxLife: isFrenzy ? 0.58 : 0.65,
                baseRadius: rad
            )
        )
    }

    private func renderPlayerShark(viewW: Double, viewH: Double, stats: ComputedSharkStats) {
        let zoom = stats.cameraZoom
        let biteSnap = sin(biteAnim * .pi)
        let lungeWorld = biteSnap * 14.0 * stats.scale
        let screenX = viewW * 0.5 + (sharkX + cos(sharkAngle) * lungeWorld - cameraX) * zoom
        let screenY = viewH * 0.5 - (sharkY + sin(sharkAngle) * lungeWorld - cameraY) * zoom

        // 1:1 Constant-Area Aspect Normalization (drawW = baseSize * sqrt(aspect), drawH = baseSize / sqrt(aspect)) matching Web canvasRenderer.ts
        let baseSize = GameRules.sharkBaseDrawSize * stats.scale * zoom
        let texAspect: Double
        if let tex = sharkNode.texture, tex.size().height > 0 {
            texAspect = Double(tex.size().width / tex.size().height)
        } else {
            texAspect = 1.65
        }
        let clampedAspect = max(0.42, min(2.65, texAspect))
        let sqrtAspect = sqrt(clampedAspect)
        let drawW = baseSize * sqrtAspect
        let drawH = baseSize / sqrtAspect

        sharkNode.size = CGSize(width: drawW, height: drawH)
        sharkNode.position = CGPoint(x: screenX, y: screenY)

        let absFacing = max(0.15, abs(facingScaleX))
        let perspectiveScaleX = (0.42 + 0.58 * pow(absFacing, 0.8)) * (1.0 + biteSnap * 0.14) * (facingScaleX >= 0 ? 1.0 : -1.0)
        let horizonPitch = atan2(-sin(sharkAngle), abs(cos(sharkAngle)))
        sharkNode.xScale = CGFloat(perspectiveScaleX)
        sharkNode.yScale = CGFloat(1.0 + biteSnap * 0.11)
        sharkNode.zRotation = CGFloat(horizonPitch * (facingScaleX >= 0 ? 1.0 : -1.0))
        sharkNode.alpha = invulnTimer > 0 && Int(invulnTimer * 20) % 2 == 0 ? 0.45 : 1.0

        // Gold Frenzy 24K Shimmering Gold Tint & Damage Hit-Flash (1:1 parity with Web drawSharkWithOrgans)
        let isFrenzy = viewModel?.frenzyActive ?? false
        if invulnTimer > 0.65 {
            sharkNode.color = .white
            sharkNode.colorBlendFactor = 0.72
        } else if isFrenzy {
            sharkNode.color = UIColor(red: 1.0, green: 0.84, blue: 0.08, alpha: 1.0)
            sharkNode.colorBlendFactor = CGFloat(0.68 + 0.14 * sin(swimPhase * 2.2))
        } else {
            sharkNode.colorBlendFactor = 0.0
        }

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

    private func classifyPreySwimGait(_ p: PreyTierConfig) -> PreySwimGait {
        if p.isHazard && p.baseSpeed < 12 { return .RIGID_PROPULSION }
        if p.behavior == .SUB_PATROL { return .RIGID_PROPULSION }
        if p.behavior == .EEL_CHARGER || p.id.contains("eel") || p.id.contains("oarfish") || p.id.contains("worm") {
            return .ANGUILLIFORM
        }
        if p.behavior == .PUFFER_INFLATE || p.id.contains("puffer") || p.id.contains("crab") || p.id.contains("isopod") || p.id.contains("starfish") {
            return .PUFFER_BUOYANT
        }
        if p.id.contains("jelly") || p.id.contains("squid") || p.id.contains("octopus") || p.id.contains("nautilus") || p.behavior == .KRAKEN_BOSS {
            return .MEDUSOID_JET
        }
        return .CARANGIFORM
    }

    private func applyPreySpineWaveWarp(to node: SKSpriteNode, prey: ActivePrey) {
        let gait = classifyPreySwimGait(prey.config)
        if gait == .RIGID_PROPULSION {
            node.warpGeometry = nil
            return
        }
        let cols = 8
        var src: [SIMD2<Float>] = []
        var dst: [SIMD2<Float>] = []
        src.reserveCapacity((cols + 1) * 2)
        dst.reserveCapacity((cols + 1) * 2)

        // Shark-like sleek anterior-locked envelope: head & chest (u -> 1.0) stay steady, posterior tail (u -> 0.0) sweeps smoothly
        for row in 0...1 {
            let v = Float(row)
            for col in 0...cols {
                let u = Float(col) / Float(cols)
                src.append(SIMD2<Float>(u, v))
                let tailProgress = Double(1.0 - u)
                let sharkLikeEnv = 0.015 * tailProgress + 0.985 * pow(tailProgress, 2.25)
                let dy: Double
                switch gait {
                case .CARANGIFORM:
                    dy = sin(prey.phase - tailProgress * 2.15 * .pi) * 0.068 * sharkLikeEnv
                case .ANGUILLIFORM:
                    let eelEnv = 0.02 * tailProgress + 0.98 * pow(tailProgress, 1.95)
                    dy = sin(prey.phase * 1.12 - tailProgress * 2.35 * .pi) * 0.082 * eelEnv
                case .MEDUSOID_JET:
                    dy = sin(prey.phase * 0.92 - tailProgress * 1.85 * .pi) * 0.056 * sharkLikeEnv
                case .PUFFER_BUOYANT:
                    dy = sin(prey.phase * 1.15 - tailProgress * 1.95 * .pi) * 0.046 * sharkLikeEnv
                case .RIGID_PROPULSION:
                    dy = 0
                }
                dst.append(SIMD2<Float>(u, v + Float(dy)))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: src, destinationPositions: dst)
    }

    // MARK: - 42 Depth-Reactive Ambient Ocean Bubbles / Marine Snow / Bioluminescent Spores / Magma Embers
    private func initAmbientBubblesIfNeeded(viewW: Double, viewH: Double) {
        if !ambientBubbles.isEmpty { return }
        bubbleContainer.removeAllChildren()
        for i in 0..<42 {
            let r = Double.random(in: 2.2...5.8)
            let ring = SKShapeNode(circleOfRadius: CGFloat(r))
            ring.lineWidth = 1.15

            let spec = SKShapeNode(circleOfRadius: CGFloat(r * 0.28))
            spec.fillColor = UIColor(white: 1.0, alpha: 0.72)
            spec.strokeColor = .clear
            spec.position = CGPoint(x: -r * 0.32, y: r * 0.32)
            ring.addChild(spec)

            bubbleContainer.addChild(ring)
            ambientBubbles.append(
                AmbientOceanBubble(
                    ringNode: ring,
                    highlightNode: spec,
                    x: Double.random(in: 0...(max(800, viewW * 1.5))),
                    y: Double.random(in: 0...(max(420, viewH))),
                    r: r,
                    speedY: Double.random(in: 16.0...38.0),
                    wobblePhase: Double.random(in: 0...(Double.pi * 2)),
                    baseAlpha: Double.random(in: 0.24...0.52),
                    kindIndex: i % 4
                )
            )
        }
    }

    private func stepAndRenderAmbientBubbles(viewW: Double, viewH: Double, bgScales: ParallaxLayerGrowthScales, dt: Double) {
        initAmbientBubblesIfNeeded(viewW: viewW, viewH: viewH)
        let depthRefY = max(0.0, sharkY)
        let isAbyss = depthRefY > 1150.0
        let isTwilight = depthRefY >= 520.0 && depthRefY <= 1150.0
        let pScale = bgScales.particleScale

        for b in ambientBubbles {
            // In SpriteKit Y=0 is bottom and Y=viewH is top, so rising bubbles increase Y (+1.0)
            let vertDir: Double = (isTwilight && b.kindIndex == 1) ? -0.35 : 1.0
            b.y += vertDir * b.speedY * dt
            b.wobblePhase += dt * 2.1

            if b.y > viewH + 22.0 {
                b.y = -16.0
                b.x = Double.random(in: 0...viewW)
            } else if b.y < -22.0 {
                b.y = viewH + 16.0
                b.x = Double.random(in: 0...viewW)
            }

            let rawX = b.x - cameraX * 0.55 * pScale + sin(b.wobblePhase) * 11.0 * pScale
            let screenX = ((rawX.truncatingRemainder(dividingBy: viewW)) + viewW).truncatingRemainder(dividingBy: viewW)
            b.ringNode.position = CGPoint(x: screenX, y: b.y)

            if isAbyss {
                let pulse = 0.65 + 0.35 * sin(b.wobblePhase * 1.8)
                b.ringNode.setScale(CGFloat(pScale * 0.78))
                b.ringNode.alpha = CGFloat(b.baseAlpha * pulse)
                let col = (b.kindIndex == 2)
                    ? UIColor(red: 192/255, green: 132/255, blue: 252/255, alpha: 1.0)
                    : UIColor(red: 251/255, green: 146/255, blue: 60/255, alpha: 1.0)
                b.ringNode.fillColor = col
                b.ringNode.strokeColor = .clear
                b.highlightNode.isHidden = true
            } else if isTwilight {
                let pulse = 0.55 + 0.45 * sin(b.wobblePhase * 1.5)
                b.ringNode.setScale(CGFloat(pScale * 0.72))
                b.ringNode.alpha = CGFloat(b.baseAlpha * pulse)
                let col = (b.kindIndex == 2)
                    ? UIColor(red: 34/255, green: 211/255, blue: 238/255, alpha: 1.0)
                    : UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 0.85)
                b.ringNode.fillColor = col
                b.ringNode.strokeColor = .clear
                b.highlightNode.isHidden = true
            } else {
                b.ringNode.setScale(CGFloat(pScale))
                b.ringNode.alpha = CGFloat(b.baseAlpha)
                b.ringNode.fillColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.18)
                b.ringNode.strokeColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.90)
                b.highlightNode.isHidden = false
            }
        }
    }

    // MARK: - Continuous Cross-Depth Multi-Biome Parallax Background (1:1 Parity with Web parallaxBackground.ts)
    private func renderParallaxBackground(viewW: Double, viewH: Double, bgScales: ParallaxLayerGrowthScales) {
        let depthRefY = max(0.0, sharkY)
        let rgb = GameRules.sampleBathymetricWaterRGB(depthMeters: cameraY)
        waterBgNode.color = UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z), alpha: 1.0)
        waterBgNode.size = CGSize(width: viewW, height: viewH)
        waterBgNode.position = CGPoint(x: viewW * 0.5, y: viewH * 0.5)

        activeParallaxTileCount = 0

        let assetMap: [String: (water: String, far: String, mid: String, near: String)] = [
            "bg_shallow": ("bg_shallow_0_water_0e65cb68", "bg_shallow_1_far_8898229a", "bg_shallow_2_mid_b4e0d30a", "bg_shallow_3_near_96e92ee1"),
            "bg_twilight": ("bg_twilight_0_17bcb84c", "bg_twilight_1_04f5d35f", "bg_twilight_2_fd5a1b33", "bg_twilight_3_6e0dd7c1"),
            "bg_abyss": ("bg_abyss_0_1bbf506a", "bg_abyss_1_75e4a628", "bg_abyss_2_6ce66695", "bg_abyss_3_a4986280")
        ]

        // 1. Layer 0 Water Backdrops blended smoothly across depth zones (zero horizontal or vertical seam lines!)
        if depthRefY < 680.0,
           let names0 = assetMap["bg_shallow"],
           let water0 = SpriteAtlasManager.shared.oceanParallaxTexture(named: names0.water, isWaterCanopy: true) {
            let wAlpha0 = depthRefY < 440.0 ? 0.92 : max(0.0, (1.0 - (depthRefY - 440.0) / 240.0) * 0.92)
            let refH = min(viewH, max(360.0, viewW * 0.65))
            let baseCanopyH = max(96.0, min(220.0, refH * 0.32))
            let canopyH = baseCanopyH * bgScales.waterScale
            let u0 = tanh(max(0.0, 680.0 - depthRefY) / 480.0)
            let canopyBottomY = viewH - canopyH + (1.0 - u0) * 4.0
            addTiledStrip(
                texture: water0,
                baseTargetH: baseCanopyH,
                scaledTargetH: canopyH,
                bottomYFromBottom: canopyBottomY,
                parallaxXFactor: 0.012,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: wAlpha0,
                zPos: 1.0
            )
        }

        if depthRefY > 420.0 && depthRefY < 1320.0,
           let names1 = assetMap["bg_twilight"],
           let water1 = SpriteAtlasManager.shared.oceanParallaxTexture(named: names1.water, isWaterCanopy: true) {
            var wAlpha1 = 0.88
            if depthRefY < 660.0 {
                wAlpha1 = ((depthRefY - 420.0) / 240.0) * 0.88
            } else if depthRefY > 1060.0 {
                wAlpha1 = (1.0 - (depthRefY - 1060.0) / 260.0) * 0.88
            }
            addTiledStrip(
                texture: water1,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: max(0.0, min(0.88, wAlpha1)),
                zPos: 1.1
            )
        }

        if depthRefY > 1040.0,
           let names2 = assetMap["bg_abyss"],
           let water2 = SpriteAtlasManager.shared.oceanParallaxTexture(named: names2.water, isWaterCanopy: true) {
            let wAlpha2 = depthRefY < 1300.0 ? ((depthRefY - 1040.0) / 260.0) * 0.92 : 0.92
            addTiledStrip(
                texture: water2,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: max(0.0, min(0.92, wAlpha2)),
                zPos: 1.2
            )
        }

        // 2. Layers 1, 2, 3 (Far, Mid, Near Terrain) with continuous cross-depth alpha transitions
        if depthRefY < 700.0, let names0 = assetMap["bg_shallow"] {
            let alpha0 = depthRefY < 460.0 ? 1.0 : max(0.0, 1.0 - (depthRefY - 460.0) / 220.0)
            renderBiomeTerrainPlanes(
                zonePrefix: "bg_shallow",
                names: names0,
                biomeFloorY: 680.0,
                depthRefY: depthRefY,
                alpha: alpha0,
                viewW: viewW,
                viewH: viewH,
                bgScales: bgScales,
                zBase: 2.0
            )
        }

        if depthRefY > 440.0 && depthRefY < 1340.0, let names1 = assetMap["bg_twilight"] {
            var alpha1 = 1.0
            if depthRefY < 660.0 {
                alpha1 = (depthRefY - 440.0) / 220.0
            } else if depthRefY > 1080.0 {
                alpha1 = 1.0 - (depthRefY - 1080.0) / 260.0
            }
            renderBiomeTerrainPlanes(
                zonePrefix: "bg_twilight",
                names: names1,
                biomeFloorY: 1340.0,
                depthRefY: depthRefY,
                alpha: max(0.0, min(1.0, alpha1)),
                viewW: viewW,
                viewH: viewH,
                bgScales: bgScales,
                zBase: 3.0
            )
        }

        if depthRefY > 1060.0, let names2 = assetMap["bg_abyss"] {
            let alpha2 = depthRefY < 1320.0 ? (depthRefY - 1060.0) / 260.0 : 1.0
            renderBiomeTerrainPlanes(
                zonePrefix: "bg_abyss",
                names: names2,
                biomeFloorY: 2100.0,
                depthRefY: depthRefY,
                alpha: max(0.0, min(1.0, alpha2)),
                viewW: viewW,
                viewH: viewH,
                bgScales: bgScales,
                zBase: 4.0
            )
        }

        // Hide any unused pooled tile nodes without removing them from the scene graph
        if activeParallaxTileCount < parallaxTilePool.count {
            for i in activeParallaxTileCount..<parallaxTilePool.count {
                parallaxTilePool[i].isHidden = true
            }
        }
    }

    private func renderBiomeTerrainPlanes(
        zonePrefix: String,
        names: (water: String, far: String, mid: String, near: String),
        biomeFloorY: Double,
        depthRefY: Double,
        alpha: Double,
        viewW: Double,
        viewH: Double,
        bgScales: ParallaxLayerGrowthScales,
        zBase: CGFloat
    ) {
        if alpha <= 0.01 { return }
        let u = tanh(max(0.0, biomeFloorY - depthRefY) / 480.0)
        let panoRefH = min(viewH, max(360.0, viewW * 0.65))
        let baseNearH = max(88.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.25 : zonePrefix == "bg_twilight" ? 0.30 : 0.48))
        let baseMidH = max(78.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.22 : zonePrefix == "bg_twilight" ? 0.37 : 0.54))
        let baseFarH = max(82.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.232 : 0.42))

        if let farTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.far) {
            let farH = baseFarH * bgScales.farScale
            let farBottomY = min(0.0, (baseNearH * 0.32 - (-20.0 + 2.5 * u)) * bgScales.nearScale - farH * 0.12)
            addTiledStrip(
                texture: farTex,
                baseTargetH: baseFarH,
                scaledTargetH: farH,
                bottomYFromBottom: farBottomY,
                parallaxXFactor: 0.025,
                phaseOffset: 0.37,
                viewW: viewW,
                alpha: alpha * 0.94,
                zPos: zBase + 0.1
            )
        }

        if let midTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.mid) {
            let midH = baseMidH * bgScales.midScale
            let midBottomY = min(0.0, (baseNearH * 0.16 - (-10.0 + 14.0 * u)) * bgScales.nearScale - midH * 0.08)
            addTiledStrip(
                texture: midTex,
                baseTargetH: baseMidH,
                scaledTargetH: midH,
                bottomYFromBottom: midBottomY,
                parallaxXFactor: 0.18,
                phaseOffset: 0.63,
                viewW: viewW,
                alpha: alpha,
                zPos: zBase + 0.2
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
                phaseOffset: 0.21,
                viewW: viewW,
                alpha: alpha,
                zPos: zBase + 0.3
            )
        }
    }

    private func acquirePooledParallaxTile() -> SKSpriteNode {
        if activeParallaxTileCount < parallaxTilePool.count {
            let node = parallaxTilePool[activeParallaxTileCount]
            activeParallaxTileCount += 1
            node.isHidden = false
            return node
        }
        let node = SKSpriteNode()
        node.anchorPoint = CGPoint(x: 0, y: 0)
        parallaxContainer.addChild(node)
        parallaxTilePool.append(node)
        activeParallaxTileCount += 1
        return node
    }

    private func addTiledStrip(
        texture: SKTexture,
        baseTargetH: Double,
        scaledTargetH: Double,
        bottomYFromBottom: Double,
        parallaxXFactor: Double,
        phaseOffset: Double = 0.50,
        viewW: Double,
        alpha: Double,
        zPos: CGFloat
    ) {
        let texSize = texture.size()
        guard texSize.height > 0 && alpha > 0.004 else { return }
        let aspect = Double(texSize.width / texSize.height)
        let baseTileW = max(256.0, baseTargetH * aspect)
        let tileW = ceil(max(148.0, scaledTargetH * aspect))
        let displayScale = Double(max(1.0, view?.contentScaleFactor ?? UIScreen.main.scale))

        let rawPhase = (cameraX * parallaxXFactor) / baseTileW + phaseOffset
        let normPhase = (rawPhase.truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0)
        let centerAnchorX = viewW * 0.5 - normPhase * tileW
        var startX = ((centerAnchorX.truncatingRemainder(dividingBy: tileW) + tileW).truncatingRemainder(dividingBy: tileW)) - tileW
        let alignedY = (bottomYFromBottom * displayScale).rounded(.down) / displayScale
        let alignedH = ceil(scaledTargetH * displayScale) / displayScale

        while startX < viewW {
            let x0 = (startX * displayScale).rounded() / displayScale
            let x1 = ((startX + tileW) * displayScale).rounded() / displayScale
            let node = acquirePooledParallaxTile()
            node.texture = texture
            // Exact physical pixel boundary abutment (x0 -> x1) with ZERO double-alpha overlap!
            node.size = CGSize(width: max(1.0, x1 - x0), height: alignedH)
            node.position = CGPoint(x: x0, y: alignedY)
            node.alpha = CGFloat(alpha)
            node.zPosition = zPos
            startX += tileW
        }
    }

    private func syncPreyPopulation() {
        while activePreys.count < maxActivePreys {
            spawnOnePrey(nearShark: activePreys.count < 7)
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
        let dist = nearShark ? Double.random(in: 220...480) : Double.random(in: 580...1400)
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
                vy: sin(ang) * chosen.baseSpeed * 0.25,
                mutation: Double.random(in: 0...1) < 0.08 ? .GOLDEN_SWARM : .NONE
            )
        )
    }

    // MARK: - Devour Particles, Spinning Coin/Gene Pickups & Floating Combat Text
    private func spawnDevourParticles(x: Double, y: Double, preyTier: Int, isGolden: Bool) {
        // 1. Expanding Devour Shockwave Ring
        let ringNode = SKShapeNode(circleOfRadius: 10)
        ringNode.strokeColor = isGolden
            ? UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 0.95)
            : UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 0.90)
        ringNode.fillColor = .clear
        ringNode.lineWidth = 2.6
        ringNode.zPosition = 26
        fxContainer.addChild(ringNode)
        activeParticles.append(
            ActiveParticle(node: ringNode, x: x, y: y, vx: 0, vy: 0, maxLife: 0.34, baseRadius: 10, isRing: true)
        )

        // 2. Bursting Green/Teal Devour Slime Bubbles & Golden Sparks
        let count = min(22, 10 + preyTier * 2)
        for i in 0..<count {
            let ang = Double.random(in: 0...(Double.pi * 2))
            let spd = Double.random(in: 65...255)
            let rad = Double.random(in: 2.8...6.8)
            let dot = SKShapeNode(circleOfRadius: CGFloat(rad))
            if isGolden || i % 3 == 0 {
                dot.fillColor = UIColor(red: 250/255, green: 204/255, blue: 21/255, alpha: 1.0)
                dot.strokeColor = UIColor.white.withAlphaComponent(0.7)
            } else if i % 2 == 0 {
                dot.fillColor = UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 187/255, green: 247/255, blue: 208/255, alpha: 0.8)
            } else {
                dot.fillColor = UIColor(red: 45/255, green: 212/255, blue: 191/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 153/255, green: 246/255, blue: 228/255, alpha: 0.8)
            }
            dot.lineWidth = 1.0
            dot.zPosition = 25
            fxContainer.addChild(dot)
            activeParticles.append(
                ActiveParticle(
                    node: dot,
                    x: x,
                    y: y,
                    vx: cos(ang) * spd,
                    vy: sin(ang) * spd - Double.random(in: 12...45),
                    maxLife: Double.random(in: 0.36...0.68),
                    baseRadius: rad
                )
            )
        }
    }

    private func spawnDevourPickups(x: Double, y: Double, coinGain: Int, geneGain: Int) {
        let coinCount = min(4, max(1, (coinGain + 3) / 4))
        let baseCoinVal = max(1, coinGain / coinCount)
        for i in 0..<coinCount {
            let val = (i == coinCount - 1) ? max(1, coinGain - baseCoinVal * (coinCount - 1)) : baseCoinVal
            let node = SKSpriteNode()
            if let img = SpriteAtlasManager.shared.uiIconImage(for: "UI_ICON_COIN") {
                node.texture = SKTexture(image: img)
            }
            node.size = CGSize(width: 22, height: 22)
            node.zPosition = 24
            fxContainer.addChild(node)
            let ang = Double.random(in: 0...(Double.pi * 2))
            let spd = Double.random(in: 75...165)
            activePickups.append(
                ActivePickup(
                    isGene: false,
                    value: val,
                    node: node,
                    x: x + cos(ang) * 10.0,
                    y: y + sin(ang) * 10.0,
                    vx: cos(ang) * spd,
                    vy: sin(ang) * spd - 35.0
                )
            )
        }

        if geneGain > 0 {
            let node = SKSpriteNode()
            if let img = SpriteAtlasManager.shared.uiIconImage(for: "UI_ICON_GENE") {
                node.texture = SKTexture(image: img)
            }
            node.size = CGSize(width: 24, height: 24)
            node.zPosition = 24
            fxContainer.addChild(node)
            let ang = Double.random(in: 0...(Double.pi * 2))
            activePickups.append(
                ActivePickup(
                    isGene: true,
                    value: geneGain,
                    node: node,
                    x: x,
                    y: y,
                    vx: cos(ang) * 120.0,
                    vy: sin(ang) * 120.0 - 45.0
                )
            )
        }
    }

    private func spawnFloatingText(x: Double, y: Double, text: String, color: UIColor, fontSize: CGFloat = 14) {
        if activeFloatTexts.count > 16 {
            let oldest = activeFloatTexts.removeFirst()
            oldest.node.removeFromParent()
        }
        let lbl = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        lbl.text = text
        lbl.fontSize = fontSize
        lbl.fontColor = color
        lbl.verticalAlignmentMode = .center
        lbl.horizontalAlignmentMode = .center
        lbl.zPosition = 30
        fxContainer.addChild(lbl)
        activeFloatTexts.append(
            ActiveFloatText(node: lbl, x: x, y: y, vy: -52.0, maxLife: 0.95)
        )
    }

    private func stepAndRenderDevourFX(viewW: Double, viewH: Double, stats: ComputedSharkStats, dt: Double) {
        guard let vm = viewModel else { return }
        let zoom = stats.cameraZoom

        // 1. Update & Render Devour Burst Particles
        var pIdx = activeParticles.count - 1
        while pIdx >= 0 {
            let pt = activeParticles[pIdx]
            pt.life -= dt
            if pt.life <= 0 {
                pt.node.removeFromParent()
                activeParticles.remove(at: pIdx)
                pIdx -= 1
                continue
            }
            let progress = 1.0 - (pt.life / pt.maxLife)
            if pt.isRing {
                let scale = 1.0 + progress * 3.8
                pt.node.setScale(CGFloat(scale))
                pt.node.alpha = CGFloat(max(0.0, 1.0 - progress))
            } else {
                pt.x += pt.vx * dt
                pt.y += pt.vy * dt
                pt.vx *= 0.92
                pt.vy = pt.vy * 0.92 - 18.0 * dt
                pt.node.setScale(CGFloat(max(0.2, 1.0 - progress * 0.65)))
                pt.node.alpha = CGFloat(max(0.0, 1.0 - progress * 0.85))
            }
            let sx = viewW * 0.5 + (pt.x - cameraX) * zoom
            let sy = viewH * 0.5 - (pt.y - cameraY) * zoom
            pt.node.position = CGPoint(x: sx, y: sy)
            pIdx -= 1
        }

        // 2. Update & Render 3D Spinning Coin & Gene Pickups with Magnetic Pull
        let magnetR = (vm.frenzyActive ? 390.0 : 120.0) + stats.magnetRadius
        var kIdx = activePickups.count - 1
        while kIdx >= 0 {
            let pk = activePickups[kIdx]
            pk.life -= dt
            pk.spinPhase += dt * 9.5
            let dx = sharkX - pk.x
            let dy = sharkY - pk.y
            let dist = hypot(dx, dy)

            if dist < magnetR && dist > 1.0 {
                let pullSpeed = vm.frenzyActive ? 620.0 : 410.0
                pk.vx += (dx / dist) * pullSpeed * dt * 5.2
                pk.vy += (dy / dist) * pullSpeed * dt * 5.2
            } else {
                pk.vx *= 0.94
                pk.vy = pk.vy * 0.94 - 8.0 * dt
            }
            pk.x += pk.vx * dt
            pk.y += pk.vy * dt

            if dist < 38.0 * stats.scale || pk.life <= 0 {
                if dist < 38.0 * stats.scale {
                    if pk.isGene {
                        vm.save.bankedGenes += pk.value
                        vm.runGenesEarned += pk.value
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 12,
                            text: "+\\(pk.value) 🧬",
                            color: UIColor(red: 110/255, green: 231/255, blue: 183/255, alpha: 1.0),
                            fontSize: 13
                        )
                    } else {
                        vm.save.bankedCoins += pk.value
                        vm.runCoinsEarned += pk.value
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 10,
                            text: "+\\(pk.value) 🪙",
                            color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                            fontSize: 12
                        )
                    }
                }
                pk.node.removeFromParent()
                activePickups.remove(at: kIdx)
                kIdx -= 1
                continue
            }

            let sx = viewW * 0.5 + (pk.x - cameraX) * zoom
            let sy = viewH * 0.5 - (pk.y - cameraY) * zoom
            pk.node.position = CGPoint(x: sx, y: sy)
            // 3D coin flip / crystal spin effect
            pk.node.xScale = CGFloat(0.35 + 0.65 * abs(cos(pk.spinPhase)))
            pk.node.yScale = 1.0
            kIdx -= 1
        }

        // 3. Update & Render Floating Combat Text Popups
        var fIdx = activeFloatTexts.count - 1
        while fIdx >= 0 {
            let ft = activeFloatTexts[fIdx]
            ft.life -= dt
            if ft.life <= 0 {
                ft.node.removeFromParent()
                activeFloatTexts.remove(at: fIdx)
                fIdx -= 1
                continue
            }
            ft.y += ft.vy * dt
            ft.vy *= 0.94
            let progress = 1.0 - (ft.life / ft.maxLife)
            let popScale = progress < 0.18 ? (0.65 + (progress / 0.18) * 0.48) : (1.13 - (progress - 0.18) * 0.22)
            let sx = viewW * 0.5 + (ft.x - cameraX) * zoom
            let sy = viewH * 0.5 - (ft.y - cameraY) * zoom
            ft.node.position = CGPoint(x: sx, y: sy)
            ft.node.setScale(CGFloat(max(0.5, popScale)))
            ft.node.alpha = CGFloat(min(1.0, ft.life / (ft.maxLife * 0.42)))
            fIdx -= 1
        }
    }

    private func stepAndRenderPreys(viewW: Double, viewH: Double, stats: ComputedSharkStats, dt: Double, currentTime: TimeInterval) {
        guard let vm = viewModel else { return }
        syncPreyPopulation()
        let zoom = stats.cameraZoom

        var idx = activePreys.count - 1
        while idx >= 0 {
            let p = activePreys[idx]
            let gait = classifyPreySwimGait(p.config)
            let speedNorm = max(0.72, min(1.35, hypot(p.vx, p.vy) / max(18.0, p.config.baseSpeed)))
            p.phase += dt * 4.6 * speedNorm
            p.stateTimer += dt

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
            let encounterPreview = GameRules.resolvePreyEncounter(
                prey: p.config,
                sharkStats: stats,
                isBoosting: vm.isBoostingHeld && vm.energy > 2.0,
                frenzyActive: vm.frenzyActive,
                mutationVariant: p.mutation
            )

            // Biomechanical Smooth Horizontal Cruising Trajectory AI (1:1 parity with src/App.tsx)
            let dirSign: Double = p.vx >= 0 ? 1.0 : -1.0
            switch p.config.behavior {
            case .SCHOOL_FLEE:
                if dist < 250 && encounterPreview == .DEVOUR && dist > 1.0 {
                    let fleeAng = atan2(dy, dx) + sin(p.phase * 1.35) * 0.18
                    let fleeSpd = p.config.baseSpeed * 1.42
                    p.vx += (cos(fleeAng) * fleeSpd - p.vx) * min(1.0, dt * 4.5)
                    p.vy += (sin(fleeAng) * fleeSpd - p.vy) * min(1.0, dt * 4.5)
                } else {
                    let targetY = p.cruiseDepthCenter + sin(p.stateTimer * p.cruiseFreq) * p.cruiseAmpY
                    let desiredVy = (targetY - p.y) * 0.92 + cos(p.phase * 0.65) * p.config.baseSpeed * 0.14
                    let desiredVx = dirSign * p.config.baseSpeed * (0.92 + 0.12 * sin(p.stateTimer * 0.95))
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
                }
            case .PUFFER_INFLATE:
                let targetInflate = dist < 195 ? 1.0 : 0.0
                p.inflateRatio += (targetInflate - p.inflateRatio) * min(1.0, dt * 4.5)
                let targetY = p.cruiseDepthCenter + sin(p.stateTimer * 0.65) * (p.cruiseAmpY * 0.65)
                let desiredVy = (targetY - p.y) * 0.85 + sin(p.phase * 0.6) * 12.0
                let desiredVx = dirSign * p.config.baseSpeed * (1.0 - p.inflateRatio * 0.35)
                p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
            case .EEL_CHARGER:
                if dist < 310 && encounterPreview != .DEVOUR && dist > 1.0 {
                    let atkAng = atan2(-dy, -dx) + sin(p.phase * 1.4) * 0.14
                    let atkSpd = p.config.baseSpeed * 1.42
                    p.vx += (cos(atkAng) * atkSpd - p.vx) * min(1.0, dt * 4.0)
                    p.vy += (sin(atkAng) * atkSpd - p.vy) * min(1.0, dt * 4.0)
                } else {
                    let desiredVy = cos(p.phase * 0.75) * p.config.baseSpeed * 0.18
                    let desiredVx = dirSign * p.config.baseSpeed
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
                }
            case .MINE_HAZARD:
                p.vx = sin(p.stateTimer * 0.8 + p.phase * 0.2) * 8.0
                p.vy = cos(p.stateTimer * 1.1 + p.phase * 0.3) * 10.0
            default:
                if gait == .MEDUSOID_JET {
                    let jetPulse = 0.72 + 0.38 * pow(max(0.0, sin(p.phase * 0.65)), 2.0)
                    let desiredVx = dirSign * p.config.baseSpeed * jetPulse
                    let desiredVy = cos(p.stateTimer * 0.75) * 14.0
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.5)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.5)
                } else {
                    let targetY = p.cruiseDepthCenter + sin(p.stateTimer * p.cruiseFreq) * p.cruiseAmpY
                    let desiredVy = (targetY - p.y) * 0.88 + sin(p.phase * 0.6) * p.config.baseSpeed * 0.14
                    let desiredVx = dirSign * p.config.baseSpeed * (0.92 + 0.12 * cos(p.stateTimer * 0.85))
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 2.8)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 2.8)
                }
            }

            // Jaw Suction Pull: pull devourable prey straight into the shark's open jaws when close!
            let suctionRadius = (58.0 + stats.magnetRadius * 0.35) * stats.jawSuctionMultiplier * stats.scale
            let mouthX = sharkX + cos(sharkAngle) * 28.0 * stats.scale
            let mouthY = sharkY + sin(sharkAngle) * 28.0 * stats.scale
            let mouthDist = hypot(mouthX - p.x, mouthY - p.y)
            if vm.gameState == "playing" && encounterPreview == .DEVOUR && mouthDist < suctionRadius && mouthDist > 1.0 {
                let pullStrength = (1.0 - mouthDist / suctionRadius) * 540.0
                p.x += ((mouthX - p.x) / mouthDist) * pullStrength * dt
                p.y += ((mouthY - p.y) / mouthDist) * pullStrength * dt
                if biteAnim < 0.35 {
                    biteAnim = 0.55
                }
            }

            p.x += p.vx * dt
            p.y += p.vy * dt
            if p.y < p.config.minDepth + 14.0 {
                p.y = p.config.minDepth + 14.0
                p.vy = abs(p.vy) * 0.65 + 18.0
            } else if p.y > p.config.maxDepth - 14.0 {
                p.y = p.config.maxDepth - 14.0
                p.vy = -abs(p.vy) * 0.65 - 18.0
            }

            let postDx = p.x - sharkX
            let postDy = p.y - sharkY
            let postDist = hypot(postDx, postDy)
            let hitRadius = p.config.radius * visualScale + 28.0 * stats.scale

            if vm.gameState == "playing" && vm.simAd == nil && postDist < hitRadius {
                if encounterPreview == .DEVOUR {
                    biteAnim = 1.0
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + (p.config.tier >= 4 ? 0.36 : 0.16))

                    let mult = p.mutation == .GOLDEN_SWARM ? 3 : 1
                    let heatScoreMult = vm.huntingHeatBuff.scoreMultiplier
                    let scoreGain = Int((Double(p.config.scoreValue * mult) * heatScoreMult).rounded())
                    vm.score += scoreGain

                    let coinGain = max(1, Int((Double(p.config.coinValue * mult) * stats.coinYieldMultiplier).rounded()))
                    var geneGain = 0
                    if p.config.geneValue > 0 && (p.mutation == .GOLDEN_SWARM || Double.random(in: 0...1) < 0.38) {
                        geneGain = max(1, Int((Double(p.config.geneValue) * stats.geneYieldMultiplier).rounded()))
                    }

                    // Spawn devour particles, spinning coin/gene pickups & floating combat text
                    spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier, isGolden: p.mutation == .GOLDEN_SWARM)
                    spawnDevourPickups(x: p.x, y: p.y, coinGain: coinGain, geneGain: geneGain)

                    vm.comboCount += 1
                    vm.comboTimer = 4.2
                    if vm.comboCount > vm.runPeakCombo {
                        vm.runPeakCombo = vm.comboCount
                    }

                    let devourLabel: String
                    if p.mutation == .GOLDEN_SWARM {
                        devourLabel = vm.lang == "zh" ? "✨ 黄金吞噬! +\\(scoreGain)" : "✨ GOLDEN! +\\(scoreGain)"
                    } else if vm.comboCount >= 3 {
                        devourLabel = vm.lang == "zh"
                            ? "一口吞噬! +\\(scoreGain) · x\\(vm.comboCount)🔥"
                            : "CHOMP! +\\(scoreGain) · x\\(vm.comboCount)🔥"
                    } else {
                        devourLabel = "+\\(scoreGain)"
                    }
                    spawnFloatingText(
                        x: p.x,
                        y: p.y - 14,
                        text: devourLabel,
                        color: p.mutation == .GOLDEN_SWARM
                            ? UIColor(red: 250/255, green: 204/255, blue: 21/255, alpha: 1.0)
                            : UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 1.0),
                        fontSize: vm.comboCount >= 5 ? 15 : 13
                    )

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
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 34,
                                text: vm.lang == "zh" ? "🎯 悬赏达成! +45🪙 +3🧬" : "🎯 BOUNTY! +45🪙 +3🧬",
                                color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                                fontSize: 15
                            )
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
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 40,
                                text: vm.lang == "zh" ? "🔥 黄金狂暴觉醒!" : "🔥 GOLDEN FRENZY!",
                                color: UIColor.yellow,
                                fontSize: 16
                            )
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
                    if vm.addXp(p.config.xpValue * mult) {
                        spawnFloatingText(
                            x: sharkX,
                            y: sharkY - 38,
                            text: vm.lang == "zh" ? "⚡ LV.\\(vm.inRunLevel) 体型成长!" : "⚡ LV.\\(vm.inRunLevel) SIZE UP!",
                            color: UIColor.cyan,
                            fontSize: 16
                        )
                    }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    p.node.removeFromParent()
                    activePreys.remove(at: idx)
                    idx -= 1
                    continue
                } else if encounterPreview == .ARMOR_CRUSH {
                    p.armorHp -= 1
                    biteAnim = 0.85
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.42)
                    invulnTimer = 0.45
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    if p.armorHp <= 0 {
                        vm.score += p.config.scoreValue * 2
                        let gGain = max(1, p.config.geneValue * 2)
                        spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier + 2, isGolden: true)
                        spawnDevourPickups(x: p.x, y: p.y, coinGain: p.config.coinValue * 2, geneGain: gGain)
                        spawnFloatingText(
                            x: p.x,
                            y: p.y - 16,
                            text: vm.lang == "zh" ? "💥 破甲粉碎! +\\(p.config.scoreValue * 2)" : "💥 ARMOR CRUSH! +\\(p.config.scoreValue * 2)",
                            color: UIColor.cyan,
                            fontSize: 15
                        )
                        _ = vm.addXp(Int(Double(p.config.xpValue) * 1.5))
                        p.node.removeFromParent()
                        activePreys.remove(at: idx)
                        idx -= 1
                        continue
                    } else {
                        spawnFloatingText(
                            x: p.x,
                            y: p.y - 14,
                            text: vm.lang == "zh" ? "⚡ 护甲裂纹!" : "⚡ ARMOR CRACK!",
                            color: UIColor.orange,
                            fontSize: 13
                        )
                        p.x += (postDx / max(1.0, postDist)) * 65.0
                    }
                } else if invulnTimer <= 0 {
                    vm.hp = max(0, vm.hp - p.config.damageOnFail * stats.damageTakenMultiplier)
                    invulnTimer = 0.85
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.48)
                    spawnFloatingText(
                        x: sharkX,
                        y: sharkY - 26,
                        text: vm.lang == "zh" ? "⚠️ 体型过大! 需T\\(p.config.tier)" : "⚠️ NEED T\\(p.config.tier)!",
                        color: UIColor(red: 248/255, green: 113/255, blue: 113/255, alpha: 1.0),
                        fontSize: 14
                    )
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
            }

            let screenX = viewW * 0.5 + (p.x - cameraX) * zoom
            let screenY = viewH * 0.5 - (p.y - cameraY) * zoom
            let inflateScale = 1.0 + p.inflateRatio * 0.38
            let baseSize = p.config.radius * GameRules.preyRadiusToDrawSize * visualScale * inflateScale * zoom
            let texAspect: Double
            if let tex = p.node.texture, tex.size().height > 0 {
                texAspect = Double(tex.size().width / tex.size().height)
            } else {
                texAspect = 1.45
            }
            let clampedAspect = max(0.42, min(2.65, texAspect))
            let sqrtAspect = sqrt(clampedAspect)
            let drawW = baseSize * sqrtAspect
            let drawH = (baseSize / sqrtAspect) * (p.inflateRatio > 0.05 ? 1.16 : 1.0)
            p.node.size = CGSize(width: drawW, height: drawH)
            p.node.position = CGPoint(x: screenX, y: screenY)

            // Smooth horizontal flip (prey sprites face RIGHT in sheet: +1 when vx >= 0, -1 when vx < 0) + calm shark-like horizontal pitch
            let facingSign: Double = p.vx >= 0 ? 1.0 : -1.0
            let pitchAngle = max(-0.22, min(0.22, atan2(-p.vy, max(24.0, abs(p.vx))) * 0.42))
            p.node.xScale = CGFloat(facingSign)
            p.node.yScale = 1.0
            p.node.zRotation = CGFloat(pitchAngle * facingSign)

            // Gold Frenzy & Golden Mutant 24K Gold Shimmer Tint (1:1 parity with Web drawPreyEntity)
            if vm.frenzyActive || p.mutation == .GOLDEN_SWARM {
                p.node.color = UIColor(red: 1.0, green: 0.85, blue: 0.12, alpha: 1.0)
                p.node.colorBlendFactor = CGFloat(0.66 + 0.14 * sin(p.phase * 1.8))
            } else if p.mutation == .ABYSS_BEHEMOTH {
                p.node.color = UIColor(red: 0.68, green: 0.28, blue: 0.98, alpha: 1.0)
                p.node.colorBlendFactor = 0.45
            } else {
                p.node.colorBlendFactor = 0.0
            }

            applyPreySpineWaveWarp(to: p.node, prey: p)
            idx -= 1
        }
    }
}
`;
}

function generateSwiftUIViews(): string {
  return `import SwiftUI
import SpriteKit
import AudioToolbox
import QuartzCore

// MARK: - Hex Color Helper
extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: UInt64
        switch cleaned.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (56, 189, 248)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: 1.0
        )
    }
}

// MARK: - 1. Reusable Sprite Atlas UI Components (1:1 parity with src/components/UiAtlasIcon.tsx)

public struct UiAtlasIconView: View {
    public let iconKey: String
    public var size: CGFloat = 28

    public var body: some View {
        if let img = SpriteAtlasManager.shared.uiIconImage(for: iconKey) {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            Circle()
                .fill(Color.cyan.opacity(0.35))
                .frame(width: size, height: size)
        }
    }
}

public struct SharkPreviewView: View {
    public let form: SharkFormConfig
    public var width: CGFloat = 120
    public var height: CGFloat = 68
    public var locked: Bool = false

    public var body: some View {
        if let img = SpriteAtlasManager.shared.sharkUIImage(for: form.spriteKey) {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: width, height: height)
                .brightness(locked ? -0.55 : 0.0)
                .saturation(locked ? 0.15 : 1.0)
                .opacity(locked ? 0.72 : 1.0)
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(hex: form.primaryColorHex).opacity(0.4))
                .frame(width: width, height: height)
        }
    }
}

/// Home & HUD Horizontal Banner Button (\`buttons_16e3a0cf.png\`: UI_BAR_BTN_GREEN / BLUE / GOLD)
public struct UiBannerButtonView<LeftContent: View>: View {
    public let bannerKey: String // "UI_BAR_BTN_GREEN", "UI_BAR_BTN_BLUE", "UI_BAR_BTN_GOLD"
    public let title: String
    public let subtitle: String?
    public let badgeText: String?
    public var width: CGFloat = 216
    public var height: CGFloat = 60
    public let leftContent: () -> LeftContent
    public let action: () -> Void

    public init(
        bannerKey: String,
        title: String,
        subtitle: String? = nil,
        badgeText: String? = nil,
        width: CGFloat = 216,
        height: CGFloat = 60,
        @ViewBuilder leftContent: @escaping () -> LeftContent,
        action: @escaping () -> Void
    ) {
        self.bannerKey = bannerKey
        self.title = title
        self.subtitle = subtitle
        self.badgeText = badgeText
        self.width = width
        self.height = height
        self.leftContent = leftContent
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                if let bgImg = SpriteAtlasManager.shared.uiBannerImage(for: bannerKey) {
                    Image(uiImage: bgImg)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFill()
                        .frame(width: width, height: height)
                } else {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(red: 8/255, green: 32/255, blue: 62/255))
                        .frame(width: width, height: height)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.cyan, lineWidth: 2))
                }

                // Left Circular Medallion Window (centered at ~23.5% x, 50% y)
                leftContent()
                    .frame(width: height * 0.56, height: height * 0.56)
                    .clipShape(Circle())
                    .position(x: width * 0.235, y: height * 0.50)

                // Right Text Area (35.5% .. 93.5% x)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: max(11, height * 0.22), weight: .black))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.9), radius: 2, x: 0, y: 1)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    if let sub = subtitle {
                        Text(sub)
                            .font(.system(size: max(8, height * 0.145), weight: .heavy))
                            .foregroundColor(.white.opacity(0.92))
                            .shadow(color: .black.opacity(0.9), radius: 1, x: 0, y: 1)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }
                .frame(width: width * 0.58, alignment: .leading)
                .position(x: width * 0.645, y: height * 0.50)

                if let badge = badgeText {
                    Text(badge)
                        .font(.system(size: 9, weight: .black))
                        .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.88))
                                .overlay(Capsule().stroke(Color.yellow.opacity(0.65), lineWidth: 1))
                        )
                        .position(x: width * 0.86, y: 4)
                }
            }
            .frame(width: width, height: height)
        }
        .buttonStyle(.plain)
    }
}

/// Top-Left Frameless Avatar & Angled HP/Boost Bar (\`buttons_16e3a0cf.png\`: UI_PLATE_AVATAR_BAR)
public struct UiAvatarDataBarView: View {
    @ObservedObject var vm: GameViewModel
    public var height: CGFloat = 68

    public var body: some View {
        let metrics = SpriteAtlasManager.shared.avatarBarHollowMetrics
        let width = height * metrics.aspectRatio
        let holeCx = width * (metrics.cxPct / 100.0)
        let holeCy = height * (metrics.cyPct / 100.0)
        let innerD = height * (metrics.innerDiaPctH / 100.0)
        let outerD = height * (metrics.outerDiaPctH / 100.0)

        let hpPct = max(0.0, min(1.0, vm.hp / max(1.0, vm.maxHp)))
        let ghostPct = max(hpPct, min(1.0, vm.ghostHpPct / 100.0))
        let energyPct = max(0.0, min(1.0, vm.energy / max(1.0, vm.maxEnergy)))
        let xpPct = max(0.0, min(1.0, Double(vm.xp) / Double(max(1, vm.xpRequired))))
        let nextTarget = GameRules.getNextEvolutionTarget(save: vm.save)
        let evoReady = nextTarget?.check.canUnlockNow ?? false

        Button {
            vm.playUiTick()
            vm.showEvolutionAtlas = true
        } label: {
            ZStack(alignment: .topLeading) {
                // Layer 0: Deep Ocean Backdrop Disc inside the hollow ring
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color(red: 14/255, green: 116/255, blue: 144/255), Color(red: 2/255, green: 6/255, blue: 23/255)],
                            center: .center,
                            startRadius: 2,
                            endRadius: innerD * 0.55
                        )
                    )
                    .frame(width: innerD * 1.06, height: innerD * 1.06)
                    .position(x: holeCx, y: holeCy)

                // Layer 1: Shark Avatar Clipped to Hollow Ring
                SharkPreviewView(form: vm.activeSharkForm, width: innerD * 0.96, height: innerD * 0.68)
                    .frame(width: innerD * 1.04, height: innerD * 1.04)
                    .clipShape(Circle())
                    .position(x: holeCx, y: holeCy)

                // Layer 2: Sliced Metallic Plate Frame (UI_PLATE_AVATAR_BAR)
                if let plateImg = SpriteAtlasManager.shared.uiBannerImage(for: "UI_PLATE_AVATAR_BAR") {
                    Image(uiImage: plateImg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: width, height: height)
                }

                // Layer 2.5: Circular Purple XP Progress Ring around outer rim
                Circle()
                    .trim(from: 0, to: CGFloat(xpPct))
                    .stroke(
                        LinearGradient(
                            colors: [Color.purple, Color(red: 232/255, green: 121/255, blue: 249/255), Color.cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .frame(width: outerD * 1.08, height: outerD * 1.08)
                    .position(x: holeCx, y: holeCy)

                // Layer 3: Bottom-Left Bite Tier Shield Badge (UI_BADGE_TIER)
                ZStack {
                    UiAtlasIconView(iconKey: "UI_BADGE_TIER", size: outerD * 0.44)
                    Text("T\\(vm.biteTier)")
                        .font(.system(size: max(8, outerD * 0.16), weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .shadow(color: .black, radius: 1.5)
                }
                .position(x: holeCx - outerD * 0.36, y: holeCy + outerD * 0.36)

                // Layer 3.1: Bottom-Right Level Pill (Lv.X)
                Text("Lv.\\(vm.gameState == "playing" ? vm.inRunLevel : vm.activeUpgradeLevel)")
                    .font(.system(size: max(8, outerD * 0.16), weight: .black, design: .monospaced))
                    .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(
                        Capsule()
                            .fill(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.92))
                            .overlay(Capsule().stroke(Color.yellow.opacity(0.75), lineWidth: 1))
                    )
                    .position(x: holeCx + outerD * 0.34, y: holeCy + outerD * 0.38)

                // Layer 3.2: Top-Right Atlas Collection Progress Badge
                HStack(spacing: 2) {
                    Text(evoReady ? "🧬" : "📖")
                        .font(.system(size: 8))
                    Text("\\(vm.save.unlockedSharkIds.count)/48")
                        .font(.system(size: 8, weight: .black, design: .monospaced))
                        .foregroundColor(evoReady ? Color(red: 167/255, green: 243/255, blue: 208/255) : Color.cyan)
                }
                .padding(.horizontal, 5)
                .padding(.vertical, 1.5)
                .background(
                    Capsule()
                        .fill(evoReady ? Color.green.opacity(0.85) : Color.black.opacity(0.88))
                        .overlay(Capsule().stroke(evoReady ? Color.mint : Color.cyan.opacity(0.55), lineWidth: 1))
                )
                .position(x: width * 0.82, y: height * 0.18)

                // Layer 4: Right-Side Skewed HP Bar + Energy Bar (left: 39.5%, right: 6.5%, top: 30%, bottom: 30%)
                let barW = width * 0.54
                let barH = height * 0.40
                VStack(alignment: .leading, spacing: 3) {
                    // Skewed HP Bar with Ghost Decay
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(red: 2/255, green: 8/255, blue: 24/255).opacity(0.92))
                            .frame(width: barW, height: barH * 0.54)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.white.opacity(0.45))
                            .frame(width: barW * CGFloat(ghostPct), height: barH * 0.50)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(
                                LinearGradient(
                                    colors: vm.frenzyActive
                                        ? [.yellow, .orange, .red]
                                        : (hpPct < 0.28 ? [.red, .orange] : [Color(red: 22/255, green: 163/255, blue: 74/255), Color(red: 74/255, green: 222/255, blue: 128/255)]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: barW * CGFloat(hpPct), height: barH * 0.50)
                        HStack(spacing: 2) {
                            Text(
                                vm.frenzyActive
                                    ? (vm.lang == "zh" ? "🔥 狂暴" : "🔥 FRENZY")
                                    : (hpPct < 0.28 ? (vm.lang == "zh" ? "⚠️ 濒危" : "⚠️ LOW HP") : "HP")
                            )
                            .font(.system(size: 7.5, weight: .black))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                            Spacer(minLength: 2)
                            Text("\\(Int(vm.hp))/\\(Int(vm.maxHp))")
                                .font(.system(size: 7.5, weight: .black, design: .monospaced))
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 5)
                        .frame(width: barW)
                    }
                    // Skewed Boost Energy Bar
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(red: 2/255, green: 8/255, blue: 24/255).opacity(0.92))
                            .frame(width: barW, height: barH * 0.36)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(
                                LinearGradient(
                                    colors: [Color(red: 2/255, green: 132/255, blue: 199/255), Color.cyan],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: barW * CGFloat(energyPct), height: barH * 0.32)
                        HStack(spacing: 2) {
                            Text("⚡ \\(vm.t("hud_mobile_boost"))")
                                .font(.system(size: 6.5, weight: .black))
                                .foregroundColor(.cyan)
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                            Spacer(minLength: 2)
                            Text("\\(Int(energyPct * 100))%")
                                .font(.system(size: 6.5, weight: .black, design: .monospaced))
                                .foregroundColor(.white)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 5)
                        .frame(width: barW)
                    }
                }
                .position(x: width * 0.665, y: height * 0.52)
            }
            .frame(width: width, height: height)
        }
        .buttonStyle(.plain)
    }
}

/// Sci-Fi Octagonal Button from \`setting_83a7a273.png\` (with extracted icon & scanline-patched interior)
public struct UiSettingButtonView: View {
    public let variantKey: String
    public let label: String
    public var sublabel: String? = nil
    public var badgeText: String? = nil
    public var customIconText: String? = nil
    public var width: CGFloat = 148
    public var height: CGFloat = 46
    public var disabled: Bool = false
    public let action: () -> Void

    public var body: some View {
        Button {
            if !disabled { action() }
        } label: {
            ZStack {
                if let bg = SpriteAtlasManager.shared.uiSettingImage(for: variantKey) {
                    Image(uiImage: bg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: width, height: height)
                } else {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(red: 12/255, green: 34/255, blue: 68/255))
                        .frame(width: width, height: height)
                }

                // Left Icon Slot (left: 14%, width: 17%)
                Group {
                    if let custom = customIconText {
                        Text(custom)
                            .font(.system(size: height * 0.38))
                    } else if let iconImg = SpriteAtlasManager.shared.uiSettingIconImage(for: variantKey) {
                        Image(uiImage: iconImg)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: height * 0.52, height: height * 0.52)
                    }
                }
                .position(x: width * 0.225, y: height * 0.50)

                // Right Text Slot (left: 33%, right: 10%)
                VStack(spacing: 0) {
                    Text(label)
                        .font(.system(size: max(10, height * 0.25), weight: .black))
                        .foregroundColor(.white)
                        .shadow(color: .black, radius: 2, x: 0, y: 1)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let sub = sublabel {
                        Text(sub)
                            .font(.system(size: max(7.5, height * 0.17), weight: .bold))
                            .foregroundColor(Color.cyan.opacity(0.92))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }
                .frame(width: width * 0.56)
                .position(x: width * 0.61, y: height * 0.50)

                if let badge = badgeText {
                    Text(badge)
                        .font(.system(size: 8.5, weight: .black, design: .monospaced))
                        .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1.5)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.9))
                                .overlay(Capsule().stroke(Color.cyan.opacity(0.55), lineWidth: 1))
                        )
                        .position(x: width * 0.84, y: 3)
                }
            }
            .frame(width: width, height: height)
            .opacity(disabled ? 0.45 : 1.0)
        }
        .buttonStyle(.plain)
    }
}

/// 3-Slice Widened Horizontal Shark Summary Banner Card (\`SETTING_SHARK_CARD\` from \`setting_83a7a273.png\`)
public struct UiSettingSharkCardView<RightContent: View>: View {
    public let form: SharkFormConfig
    public var width: CGFloat = 390
    public var height: CGFloat = 68
    public let rightContent: () -> RightContent

    public init(
        form: SharkFormConfig,
        width: CGFloat = 390,
        height: CGFloat = 68,
        @ViewBuilder rightContent: @escaping () -> RightContent
    ) {
        self.form = form
        self.width = width
        self.height = height
        self.rightContent = rightContent
    }

    public var body: some View {
        ZStack {
            if let cardImg = SpriteAtlasManager.shared.uiSettingImage(for: "SETTING_SHARK_CARD") {
                Image(uiImage: cardImg)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: width, height: height)
            } else {
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color(red: 7/255, green: 24/255, blue: 52/255))
                    .frame(width: width, height: height)
            }

            // Left Wide Recessed Rectangular Avatar Window (left: 2.7%..26.0%, center x: 14.35%, width: 23.3%)
            SharkPreviewView(form: form, width: width * 0.195, height: height * 0.56)
                .frame(width: width * 0.218, height: height * 0.64)
                .clipShape(RoundedRectangle(cornerRadius: 7))
                .position(x: width * 0.1435, y: height * 0.50)

            // Right Content Slot (left: 28.5%, right: 5.5%, center x: 61.5%, width: 66.0%)
            rightContent()
                .frame(width: width * 0.66, height: height * 0.78)
                .position(x: width * 0.615, y: height * 0.50)
        }
        .frame(width: width, height: height)
    }
}

/// Sci-Fi Modal Frame (\`SETTING_MODAL_FRAME\` / \`SETTING_MODAL_FRAME_CLEAN\` from \`setting_83a7a273.png\`)
public struct UiSettingModalFrameView<Content: View>: View {
    public let title: String
    public var subtitle: String? = nil
    public var hideMedallion: Bool = false
    public var frameWidth: CGFloat = 500
    public var frameHeight: CGFloat = 335
    public let onClose: (() -> Void)?
    public let content: () -> Content

    public init(
        title: String,
        subtitle: String? = nil,
        hideMedallion: Bool = false,
        frameWidth: CGFloat = 500,
        frameHeight: CGFloat = 335,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.hideMedallion = hideMedallion
        self.frameWidth = frameWidth
        self.frameHeight = frameHeight
        self.onClose = onClose
        self.content = content
    }

    public var body: some View {
        let key = hideMedallion ? "SETTING_MODAL_FRAME_CLEAN" : "SETTING_MODAL_FRAME"
        ZStack {
            // Inner frosted dark ocean backdrop
            RoundedRectangle(cornerRadius: 20)
                .fill(
                    LinearGradient(
                        colors: [Color(red: 4/255, green: 20/255, blue: 46/255).opacity(0.95), Color(red: 2/255, green: 8/255, blue: 24/255).opacity(0.98)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: frameWidth * 0.80, height: frameHeight * 0.72)
                .position(x: frameWidth * 0.50, y: frameHeight * 0.545)

            // Sliced Sci-Fi Metallic Frame Overlay
            if let frameImg = SpriteAtlasManager.shared.uiSettingImage(for: key)
                ?? SpriteAtlasManager.shared.uiSettingImage(for: "SETTING_MODAL_FRAME") {
                Image(uiImage: frameImg)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: frameWidth, height: frameHeight)
                    .allowsHitTesting(false)
            }

            // Top Header Title Slot
            VStack(spacing: 1) {
                Text(title)
                    .font(.system(size: max(13, frameHeight * 0.048), weight: .black))
                    .foregroundColor(.white)
                    .shadow(color: .black, radius: 3, x: 0, y: 1)
                if let sub = subtitle {
                    Text(sub)
                        .font(.system(size: max(8.5, frameHeight * 0.028), weight: .bold))
                        .foregroundColor(.cyan.opacity(0.88))
                }
            }
            .position(x: hideMedallion ? frameWidth * 0.50 : frameWidth * 0.56, y: frameHeight * 0.118)

            // Top-Right Red X Close Hotspot (right: 3.4%, top: 4.8%, width: 8.6%, height: 13.0%)
            if let closeAction = onClose {
                Button(action: closeAction) {
                    Color.white.opacity(0.001)
                        .frame(width: frameWidth * 0.095, height: frameHeight * 0.135)
                }
                .position(x: frameWidth * 0.923, y: frameHeight * 0.113)
            }

            // Inner Window Content Slot (left: 11.5%, right: 11.5%, top: 20.5%, bottom: 11.5%)
            content()
                .frame(width: frameWidth * 0.77, height: frameHeight * 0.68)
                .position(x: frameWidth * 0.50, y: frameHeight * 0.545)
        }
        .frame(width: frameWidth, height: frameHeight)
    }
}

// MARK: - 2. Main ContentView (Title, Playing HUD, Sonar Joystick, MOBA Fan, Pause & GameOver)

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
            let isCompactH = geo.size.height < 430
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
                    .onChange(of: vm.trialSharkIdForRun) { _ in
                        scene.refreshSharkTexture()
                    }

                // 2. Top HUD Bar (Row 1: Frameless Avatar Bar + Telemetry Pill + Pause Button; Row 2: Compact Combo / Frenzy Pills)
                VStack(spacing: 3) {
                    HStack(alignment: .top, spacing: 8) {
                        UiAvatarDataBarView(vm: vm, height: isCompactH ? 56 : 64)
                        Spacer(minLength: 4)
                        if vm.gameState == "playing" {
                            telemetryPill(isCompact: isCompactH)
                            Spacer(minLength: 4)
                            pauseMedallionButton
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 6)

                    if vm.gameState == "playing" {
                        hudRow2Overlays
                            .allowsHitTesting(false)
                    }
                    Spacer()
                }

                // 3. Title Screen Hero & Bottom 3 Sliced Banner Buttons (UI_BAR_BTN_GREEN / BLUE / GOLD)
                if vm.gameState == "title" {
                    titleScreenOverlay(geo: geo)
                }

                // 4. In-Game Multi-Touch Sonar Joystick (Bottom-Left) + Onboarding Guide (Bottom-Center) + 90° MOBA Skill Fan (Bottom-Right)
                if vm.gameState == "playing" {
                    VStack {
                        Spacer()
                        HStack(alignment: .bottom) {
                            sonarJoystick
                                .padding(.leading, 26)
                                .padding(.bottom, 18)
                            Spacer(minLength: 6)
                            if vm.onboardingStep != .DONE {
                                onboardingBottomBanner
                                    .padding(.bottom, 14)
                            }
                            Spacer(minLength: 6)
                            mobaSkillFan
                                .padding(.trailing, 22)
                                .padding(.bottom, 16)
                        }
                    }
                }

                // 5. Pause Modal (1:1 setting_83a7a273.png replication)
                if vm.gameState == "paused" {
                    pauseModalOverlay(geo: geo)
                }

                // 6. Game Over Revive & Settlement Modal (1:1 setting_83a7a273.png replication)
                if vm.gameState == "gameover" {
                    gameOverModalOverlay(geo: geo)
                }

                // 7. Full-Screen 48-Shark Evolution Atlas Modal
                if vm.showEvolutionAtlas {
                    EvolutionAtlasSheetView(vm: vm)
                        .transition(.opacity)
                        .zIndex(50)
                }

                // 8. 3-Second Simulated Rewarded Video Ad Overlay
                if let ad = vm.simAd {
                    simulatedRewardedAdModal(ad: ad)
                        .zIndex(80)
                }
            }
        }
        .statusBarHidden(true)
    }

    // MARK: - Title Screen Overlay
    private func titleScreenOverlay(geo: GeometryProxy) -> some View {
        let showcase = vm.nextShowcaseSharkForm
        let showcaseName = vm.lang == "zh" ? showcase.nameZh : showcase.nameEn
        let btnW = min(226.0, max(168.0, (geo.size.width - 56.0) / 3.0))
        let btnH = max(50.0, btnW / 3.6)

        return VStack {
            // Upper Title Banner
            VStack(spacing: 4) {
                Text(vm.t("game_title"))
                    .font(.system(size: min(34, max(22, geo.size.width * 0.042)), weight: .black))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, Color(red: 165/255, green: 243/255, blue: 252/255), Color.cyan],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: .black.opacity(0.85), radius: 8, x: 0, y: 3)
                Text(vm.t("title_sub_short"))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(red: 224/255, green: 242/255, blue: 254/255).opacity(0.92))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color(red: 2/255, green: 12/255, blue: 32/255).opacity(0.55))
                            .overlay(Capsule().stroke(Color.cyan.opacity(0.35), lineWidth: 1))
                    )
            }
            .padding(.top, max(54, geo.size.height * 0.14))

            Spacer()

            // Bottom 3 Sliced Banner Buttons (UI_BAR_BTN_GREEN, UI_BAR_BTN_BLUE, UI_BAR_BTN_GOLD)
            HStack(spacing: 12) {
                // 1. Primary Green Start Button
                UiBannerButtonView(
                    bannerKey: "UI_BAR_BTN_GREEN",
                    title: vm.t("btn_start"),
                    subtitle: vm.lang == "zh" ? "立即潜入深海" : "START HUNTING",
                    width: btnW,
                    height: btnH,
                    leftContent: {
                        Text("▶")
                            .font(.system(size: btnH * 0.36, weight: .black))
                            .foregroundColor(.white)
                    },
                    action: {
                        vm.startNewRun()
                    }
                )

                // 2. Blue Evolution Atlas Button
                let evoReady = GameRules.getNextEvolutionTarget(save: vm.save)?.check.canUnlockNow ?? false
                UiBannerButtonView(
                    bannerKey: "UI_BAR_BTN_BLUE",
                    title: vm.lang == "zh"
                        ? "进化 (\\(vm.save.unlockedSharkIds.count)/48)"
                        : "EVOLVE (\\(vm.save.unlockedSharkIds.count)/48)",
                    subtitle: evoReady
                        ? (vm.lang == "zh" ? "✨ 可立即破茧进化！" : "✨ READY TO EVOLVE!")
                        : (vm.lang == "zh" ? "48阶图谱 · 点击打开" : "48-SHARK ATLAS"),
                    badgeText: "🪙\\(vm.save.bankedCoins) · 🧬\\(vm.save.bankedGenes)",
                    width: btnW,
                    height: btnH,
                    leftContent: {
                        SharkPreviewView(form: vm.activeSharkForm, width: btnH * 0.54, height: btnH * 0.38)
                    },
                    action: {
                        vm.playUiTick()
                        vm.showEvolutionAtlas = true
                    }
                )

                // 3. Gold Apex Trial Button
                UiBannerButtonView(
                    bannerKey: "UI_BAR_BTN_GOLD",
                    title: vm.lang == "zh" ? "试驾 · \\(showcaseName)" : "TRIAL · \\(showcaseName)",
                    subtitle: vm.lang == "zh" ? "📺 本局免费体验高阶巨兽" : "📺 FREE APEX SHARK TRIAL",
                    badgeText: "T\\(showcase.baseBiteTier) · Lv.5",
                    width: btnW,
                    height: btnH,
                    leftContent: {
                        SharkPreviewView(form: showcase, width: btnH * 0.54, height: btnH * 0.38)
                    },
                    action: {
                        vm.openSimulatedRewardedAd(kind: .TRIAL_SHARK)
                    }
                )
            }
            .padding(.bottom, 18)
        }
    }

    // MARK: - Top-Center Unified Telemetry Pill & Pause Medallion
    private func telemetryPill(isCompact: Bool) -> some View {
        let iconSz: CGFloat = isCompact ? 15 : 18
        let fontSz: CGFloat = isCompact ? 11 : 12.5
        let bountyPrey = vm.targetBountyPrey

        return HStack(spacing: isCompact ? 8 : 11) {
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_SCORE_TROPHY", size: iconSz)
                Text("\\(vm.score)")
                    .foregroundColor(.white)
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_GENE", size: iconSz)
                Text("\\(vm.save.bankedGenes)")
                    .foregroundColor(Color(red: 110/255, green: 231/255, blue: 183/255))
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_COIN", size: iconSz)
                Text("\\(vm.save.bankedCoins)")
                    .foregroundColor(Color(red: 253/255, green: 224/255, blue: 71/255))
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_DEPTH", size: iconSz)
                Text("\\(vm.depthMeters)m")
                    .foregroundColor(vm.depthMeters >= 1150 ? .pink : (vm.depthMeters >= 520 ? .purple : .cyan))
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            // Target Bounty Fish
            HStack(spacing: 3) {
                if let pImg = SpriteAtlasManager.shared.preyUIImage(for: bountyPrey.spriteKey) {
                    Image(uiImage: pImg)
                        .resizable()
                        .scaledToFit()
                        .frame(width: iconSz * 1.2, height: iconSz)
                } else {
                    UiAtlasIconView(iconKey: "UI_ICON_BOUNTY_TARGET", size: iconSz)
                }
                Text("\\(vm.targetBountyCaptured)/3")
                    .foregroundColor(Color(red: 253/255, green: 224/255, blue: 71/255))
            }
            // Golden Mutant Charge
            HStack(spacing: 2) {
                Text("✨\\(vm.goldenMutantCharge)/\\(vm.goldenMutantNeed)")
                    .foregroundColor(.yellow)
            }
        }
        .font(.system(size: fontSz, weight: .black, design: .monospaced))
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.62))
                .overlay(Capsule().stroke(Color.white.opacity(0.16), lineWidth: 1))
        )
    }

    private var pauseMedallionButton: some View {
        Button {
            vm.pauseGame()
        } label: {
            ZStack {
                Circle()
                    .fill(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.62))
                    .frame(width: 40, height: 40)
                    .overlay(Circle().stroke(Color.white.opacity(0.22), lineWidth: 1))
                UiAtlasIconView(iconKey: "UI_ICON_PAUSE", size: 28)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - HUD Row 2 (Compact Combo & Frenzy Pills docked right under Top Telemetry Bar)
    private var hudRow2Overlays: some View {
        HStack(spacing: 8) {
            if vm.comboCount > 1 {
                let comboText = vm.t(
                    "hud_combo",
                    [
                        "count": "\\(vm.comboCount)",
                        "mult": String(format: "%.1f", vm.huntingHeatBuff.scoreMultiplier)
                    ]
                )
                HStack(spacing: 4) {
                    UiAtlasIconView(iconKey: "UI_ICON_COMBO_FIRE", size: 15)
                    Text(comboText)
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.white)
                    if vm.huntingHeatBuff.heatLevel > 0 {
                        Text("· \\(vm.t(vm.huntingHeatBuff.labelKey)) ⚡+\\(Int((vm.huntingHeatBuff.speedMultiplier - 1.0) * 100))%")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundColor(.yellow)
                    }
                }
                .padding(.horizontal, 9)
                .padding(.vertical, 2.5)
                .background(
                    Capsule()
                        .fill(LinearGradient(colors: [.orange.opacity(0.84), .red.opacity(0.84)], startPoint: .leading, endPoint: .trailing))
                        .overlay(Capsule().stroke(Color.yellow.opacity(0.85), lineWidth: 1))
                )
            }

            if vm.frenzyActive {
                Text("🔥 \\(vm.t("hud_frenzy")) · \\(String(format: "%.1fs", vm.frenzyTimer))")
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.yellow)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 2.5)
                    .background(
                        Capsule()
                            .fill(Color.red.opacity(0.84))
                            .overlay(Capsule().stroke(Color.yellow, lineWidth: 1))
                    )
            }
        }
    }

    // MARK: - Bottom-Center Compact Onboarding Guide Pill (Never blocks the swimming shark!)
    private var onboardingBottomBanner: some View {
        HStack(spacing: 7) {
            if vm.onboardingStep == .EAT_SMALL_FISH {
                Text("🎯")
                    .font(.system(size: 11))
                Text(vm.t("onboard_step1_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.cyan)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text("(\\(vm.onboardingEatCount)/3)")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .foregroundColor(.yellow)
            } else if vm.onboardingStep == .HOLD_BOOST {
                Text("⚡")
                    .font(.system(size: 11))
                Text(vm.t("onboard_step2_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.yellow)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(String(format: "(%.1f/1.2s)", vm.onboardingBoostSeconds))
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .foregroundColor(.white)
            } else if vm.onboardingStep == .HANDS_ON_UPGRADE {
                Text("💪")
                    .font(.system(size: 11))
                Text(vm.t("onboard_step3_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.mint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            } else if vm.onboardingStep == .CELEBRATE {
                Text("🎉")
                    .font(.system(size: 11))
                Text(vm.t("onboard_done_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.yellow)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            if vm.onboardingStep != .CELEBRATE {
                Button {
                    vm.skipOnboardingTutorial()
                } label: {
                    Text(vm.t("onboard_skip"))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.white.opacity(0.18)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color(red: 2/255, green: 12/255, blue: 32/255).opacity(0.82))
                .overlay(Capsule().stroke(Color.cyan.opacity(0.5), lineWidth: 1))
        )
    }

    // MARK: - Bottom-Left Sonar Virtual Joystick (using UI_JOYSTICK_BASE & UI_JOYSTICK_KNOB from icons_f5128c12.png)
    private var sonarJoystick: some View {
        ZStack {
            // Outer Sonar Base Ring from icons_f5128c12.png
            UiAtlasIconView(iconKey: "UI_JOYSTICK_BASE", size: 118)
                .opacity(vm.joyActive ? 0.96 : 0.78)

            // Crosshair subtle ticks
            Circle()
                .stroke(Color.cyan.opacity(vm.joyActive ? 0.45 : 0.18), lineWidth: 1)
                .frame(width: 82, height: 82)

            // Draggable Inner Sonar Core Knob from icons_f5128c12.png
            UiAtlasIconView(iconKey: "UI_JOYSTICK_KNOB", size: 58)
                .shadow(color: .cyan.opacity(vm.joyActive ? 0.85 : 0.35), radius: 8)
                .offset(knobOffset)
        }
        .frame(width: 124, height: 124)
        .contentShape(Circle())
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

    // MARK: - Bottom-Right 90° MOBA Skill Fan (using UI_BTN_* from icons_f5128c12.png)
    private var mobaSkillFan: some View {
        let form = vm.activeSharkForm
        let goldCost = GameRules.getGoldOverdriveCost(useCount: vm.goldOverdriveUseCount, generationRow: form.row)
        let geneCost = GameRules.getGeneSurgeCost(level: vm.inRunLevel, useCount: vm.geneSurgeUseCount, generationRow: form.row)
        let upCoinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: vm.activeUpgradeLevel)
        let upGeneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: vm.activeUpgradeLevel)
        let canGold = vm.save.bankedCoins >= goldCost && !vm.frenzyActive
        let canGene = vm.save.bankedGenes >= geneCost
        let canUpgrade = vm.activeUpgradeLevel < 10 && vm.save.bankedCoins >= upCoinCost && vm.save.bankedGenes >= upGeneCost
        let nextTarget = GameRules.getNextEvolutionTarget(save: vm.save)
        let evoReady = nextTarget?.check.canUnlockNow ?? false
        let energyPct = max(0.0, min(1.0, vm.energy / max(1.0, vm.maxEnergy)))

        return ZStack(alignment: .bottomTrailing) {
            // Optional Outer-Top Slot: Evolve Now (when next shark is ready to unlock) or Emergency Supply Drop
            if evoReady, let target = nextTarget {
                skillFanSatelliteButton(
                    iconKey: "UI_BTN_MORPH_EVOLVE",
                    label: vm.lang == "zh" ? "破茧进化" : "EVOLVE",
                    costText: vm.lang == "zh" ? target.form.nameZh : target.form.nameEn,
                    ringColor: .green,
                    enabled: true,
                    pulse: true
                ) {
                    vm.evolveToNextReadySharkInRun()
                }
                .offset(x: -74, y: -116)
            } else if !canGold && !canGene && !canUpgrade {
                skillFanSatelliteButton(
                    iconKey: "UI_ICON_GIFT",
                    label: vm.lang == "zh" ? "免费空投" : "AIRDROP",
                    costText: "📺+300🪙+25🧬",
                    ringColor: .yellow,
                    enabled: true,
                    pulse: true
                ) {
                    vm.openSimulatedRewardedAd(kind: .SUPPLY_DROP)
                }
                .offset(x: -74, y: -116)
            }

            // 1. 0° Left Slot: Gold Frenzy (UI_BTN_GOLD_FRENZY)
            skillFanSatelliteButton(
                iconKey: "UI_BTN_GOLD_FRENZY",
                label: vm.lang == "zh" ? "狂暴" : "FRENZY",
                costText: "🪙\\(goldCost)",
                ringColor: .yellow,
                enabled: canGold,
                pulse: false
            ) {
                vm.triggerGoldFrenzy()
            }
            .offset(x: -98, y: -4)

            // 2. 45° Diagonal Slot: Gene Surge (UI_BTN_GENE_SURGE)
            skillFanSatelliteButton(
                iconKey: "UI_BTN_GENE_SURGE",
                label: vm.lang == "zh" ? "突破" : "SURGE",
                costText: "🧬\\(geneCost)",
                ringColor: .mint,
                enabled: canGene,
                pulse: false
            ) {
                vm.triggerGeneSurge()
            }
            .offset(x: -70, y: -70)

            // 3. 90° Top Slot: Body Upgrade (UI_BTN_BODY_UPGRADE)
            skillFanSatelliteButton(
                iconKey: "UI_BTN_BODY_UPGRADE",
                label: vm.activeUpgradeLevel >= 10
                    ? "MAX"
                    : (vm.lang == "zh" ? "强化Lv.\\(vm.activeUpgradeLevel)" : "UP Lv.\\(vm.activeUpgradeLevel)"),
                costText: vm.activeUpgradeLevel >= 10
                    ? "Lv.10"
                    : (upGeneCost > 0 ? "🪙\\(upCoinCost) 🧬\\(upGeneCost)" : "🪙\\(upCoinCost)"),
                ringColor: .cyan,
                enabled: canUpgrade,
                pulse: vm.onboardingStep == .HANDS_ON_UPGRADE
            ) {
                vm.upgradeActiveSharkBody()
            }
            .offset(x: -4, y: -98)

            // 4. Primary Bottom-Right Anchor: Hold-to-Boost Medallion (UI_BTN_BOOST + Circular Energy Ring)
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: vm.isBoostingHeld
                                ? [Color.cyan.opacity(0.65), Color.blue.opacity(0.92)]
                                : [Color(red: 12/255, green: 34/255, blue: 68/255).opacity(0.88), Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.95)],
                            center: .center,
                            startRadius: 4,
                            endRadius: 42
                        )
                    )
                    .frame(width: 82, height: 82)

                // Circular Energy Ring
                Circle()
                    .stroke(Color.white.opacity(0.14), lineWidth: 4)
                    .frame(width: 76, height: 76)
                Circle()
                    .trim(from: 0, to: CGFloat(energyPct))
                    .stroke(
                        vm.frenzyActive ? Color.yellow : Color.cyan,
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .frame(width: 76, height: 76)

                UiAtlasIconView(iconKey: "UI_BTN_BOOST", size: 62)
                    .scaleEffect(vm.isBoostingHeld ? 0.92 : 1.0)

                VStack {
                    Spacer()
                    Text(vm.t("hud_mobile_boost"))
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.black.opacity(0.78)))
                }
                .frame(height: 84)
            }
            .frame(width: 84, height: 84)
            .contentShape(Circle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in vm.isBoostingHeld = true }
                    .onEnded { _ in vm.isBoostingHeld = false }
            )
        }
    }

    private func skillFanSatelliteButton(
        iconKey: String,
        label: String,
        costText: String,
        ringColor: Color,
        enabled: Bool,
        pulse: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            if enabled { action() }
        } label: {
            ZStack {
                Circle()
                    .fill(Color(red: 4/255, green: 14/255, blue: 34/255).opacity(0.9))
                    .frame(width: 52, height: 52)
                    .overlay(
                        Circle()
                            .stroke(enabled ? ringColor : Color.gray.opacity(0.35), lineWidth: pulse ? 3.0 : 2.0)
                    )
                    .shadow(color: enabled ? ringColor.opacity(0.55) : .clear, radius: pulse ? 10 : 5)

                UiAtlasIconView(iconKey: iconKey, size: 38)
                    .opacity(enabled ? 1.0 : 0.42)

                VStack {
                    Text(label)
                        .font(.system(size: 7.5, weight: .black))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 0.5)
                        .background(Capsule().fill(Color.black.opacity(0.82)))
                    Spacer()
                    Text(costText)
                        .font(.system(size: 8, weight: .black, design: .monospaced))
                        .foregroundColor(enabled ? Color(red: 254/255, green: 240/255, blue: 138/255) : .gray)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.9))
                                .overlay(Capsule().stroke(enabled ? ringColor.opacity(0.6) : Color.clear, lineWidth: 0.8))
                        )
                }
                .frame(height: 58)
            }
            .frame(width: 56, height: 58)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Pause Modal Overlay (100% replication ofPauseModal in src/App.tsx using setting_83a7a273.png)
    private func pauseModalOverlay(geo: GeometryProxy) -> some View {
        let modalW = min(510.0, geo.size.width * 0.92)
        let modalH = min(345.0, max(285.0, geo.size.height * 0.88))
        let innerW = modalW * 0.77
        let form = vm.activeSharkForm

        return ZStack {
            Color.black.opacity(0.68)
                .ignoresSafeArea()
                .onTapGesture { vm.resumeGame() }

            UiSettingModalFrameView(
                title: vm.t("pause_title"),
                subtitle: "ABYSS TACTICAL COMMAND · 48-SHARK MATRIX",
                hideMedallion: false,
                frameWidth: modalW,
                frameHeight: modalH,
                onClose: { vm.resumeGame() }
            ) {
                VStack(spacing: 8) {
                    // 1. Active Shark Summary Card (SETTING_SHARK_CARD)
                    UiSettingSharkCardView(form: form, width: innerW, height: modalH * 0.25) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 5) {
                                    Text(vm.lang == "zh" ? form.nameZh : form.nameEn)
                                        .font(.system(size: 13, weight: .black))
                                        .foregroundColor(.white)
                                    Text("Lv.\\(vm.activeUpgradeLevel)/10")
                                        .font(.system(size: 9.5, weight: .black, design: .monospaced))
                                        .foregroundColor(.cyan)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Capsule().fill(Color.black.opacity(0.6)))
                                }
                                Text("T\\(vm.biteTier) · ❤️\\(Int(vm.hp))/\\(Int(vm.maxHp)) · 🪙\\(vm.save.bankedCoins) · 🧬\\(vm.save.bankedGenes)")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.85))
                            }
                            Spacer()
                            Button {
                                vm.playUiTick()
                                vm.showEvolutionAtlas = true
                            } label: {
                                Text(vm.lang == "zh" ? "🧬 进化图谱" : "🧬 ATLAS")
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 5)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color.cyan.opacity(0.35))
                                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.cyan, lineWidth: 1))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // 2. 4-Column Stat Pills
                    HStack(spacing: 6) {
                        pauseStatPill(label: vm.t("hud_score"), val: "\\(vm.score)", color: .yellow)
                        pauseStatPill(label: vm.lang == "zh" ? "最高等级" : "BEST LV", val: "Lv.\\(vm.save.bestInRunLevel)", color: .cyan)
                        pauseStatPill(label: vm.lang == "zh" ? "最大深度" : "MAX DEPTH", val: "\\(Int(vm.save.maxDepthReached))m", color: .purple)
                        pauseStatPill(label: vm.lang == "zh" ? "图谱收集" : "ATLAS", val: "\\(vm.save.unlockedSharkIds.count)/48", color: .mint)
                    }
                    .frame(width: innerW)

                    // 3. 3-Column Utility Toggle Row (Language, Sound, Tutorial)
                    let thirdW = (innerW - 12) / 3.0
                    let btnH = max(36.0, modalH * 0.125)
                    HStack(spacing: 6) {
                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_LANG",
                            label: vm.lang == "zh" ? "语言: 中文" : "LANG: EN",
                            sublabel: vm.lang == "zh" ? "点击切换 EN" : "Tap for 中文",
                            width: thirdW,
                            height: btnH
                        ) {
                            vm.toggleLanguage()
                        }

                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_SOUND",
                            label: vm.save.soundEnabled
                                ? (vm.lang == "zh" ? "音效: 开启" : "SFX: ON")
                                : (vm.lang == "zh" ? "音效: 静音" : "SFX: MUTE"),
                            sublabel: vm.lang == "zh" ? "深海声呐反馈" : "Sonar Audio",
                            width: thirdW,
                            height: btnH
                        ) {
                            vm.toggleMute()
                        }

                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_TUTORIAL",
                            label: vm.lang == "zh" ? "重播新手引导" : "TUTORIAL",
                            sublabel: vm.lang == "zh" ? "3步交互教学" : "3-Step Guide",
                            width: thirdW,
                            height: btnH
                        ) {
                            vm.restartOnboardingTutorial()
                        }
                    }

                    // 4. 2-Column Primary Action Row (Resume Hunting & Main Menu)
                    let halfW = (innerW - 8) / 2.0
                    HStack(spacing: 8) {
                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_RESTART",
                            label: vm.t("btn_resume"),
                            sublabel: vm.lang == "zh" ? "返回深海战场" : "Back to Ocean",
                            width: halfW,
                            height: btnH * 1.08
                        ) {
                            vm.resumeGame()
                        }

                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_MAIN_MENU",
                            label: vm.t("btn_quit"),
                            sublabel: vm.lang == "zh" ? "保存金币与基因" : "Save Progress",
                            width: halfW,
                            height: btnH * 1.08
                        ) {
                            vm.returnToTitle()
                        }
                    }
                }
            }
        }
    }

    private func pauseStatPill(label: String, val: String, color: Color) -> some View {
        VStack(spacing: 1) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.gray)
                .lineLimit(1)
            Text(val)
                .font(.system(size: 11, weight: .black, design: .monospaced))
                .foregroundColor(color)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.black.opacity(0.45))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.cyan.opacity(0.22), lineWidth: 1))
        )
    }

    // MARK: - GameOver Revive & Settlement Modal Overlay
    private func gameOverModalOverlay(geo: GeometryProxy) -> some View {
        let modalW = min(520.0, geo.size.width * 0.92)
        let modalH = min(355.0, max(295.0, geo.size.height * 0.90))
        let innerW = modalW * 0.77
        let form = vm.activeSharkForm
        let btnH = max(38.0, modalH * 0.13)

        return ZStack {
            Color.black.opacity(0.72).ignoresSafeArea()

            if vm.reviveOffered {
                UiSettingModalFrameView(
                    title: vm.t("revive_title"),
                    subtitle: "EMERGENCY RESCUE SIGNAL · 1 CHANCE PER RUN",
                    hideMedallion: true,
                    frameWidth: modalW,
                    frameHeight: modalH,
                    onClose: { vm.declineRevive() }
                ) {
                    VStack(spacing: 10) {
                        UiSettingSharkCardView(form: form, width: innerW, height: modalH * 0.27) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(vm.lang == "zh" ? "\\(form.nameZh) 生命耗尽！" : "\\(form.nameEn) Critical!")
                                    .font(.system(size: 13, weight: .black))
                                    .foregroundColor(.yellow)
                                Text(vm.t("revive_desc"))
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.9))
                                    .lineLimit(2)
                            }
                        }

                        HStack(spacing: 8) {
                            pauseStatPill(label: vm.t("hud_score"), val: "\\(vm.score)", color: .yellow)
                            pauseStatPill(label: vm.t("stat_max_depth"), val: "\\(vm.runMaxDepth)m", color: .cyan)
                            pauseStatPill(label: vm.lang == "zh" ? "本局金币" : "COINS", val: "+\\(vm.runCoinsEarned)", color: .orange)
                            pauseStatPill(label: vm.lang == "zh" ? "本局基因" : "GENES", val: "+\\(vm.runGenesEarned)", color: .mint)
                        }
                        .frame(width: innerW)

                        let halfW = (innerW - 8) / 2.0
                        HStack(spacing: 8) {
                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_RESTART",
                                label: vm.lang == "zh" ? "📺 免费满血复活" : "📺 FREE REVIVE",
                                sublabel: vm.lang == "zh" ? "满血 + 狂暴冲刺" : "Full HP + Frenzy",
                                customIconText: "📺",
                                width: halfW,
                                height: btnH * 1.12
                            ) {
                                vm.openSimulatedRewardedAd(kind: .REVIVE)
                            }

                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_MAIN_MENU",
                                label: vm.t("btn_decline_revive"),
                                sublabel: vm.lang == "zh" ? "进入战利品结算" : "Proceed to Summary",
                                width: halfW,
                                height: btnH * 1.12
                            ) {
                                vm.declineRevive()
                            }
                        }
                    }
                }
            } else {
                UiSettingModalFrameView(
                    title: vm.t("gameover_title"),
                    subtitle: vm.t("gameover_sub"),
                    hideMedallion: true,
                    frameWidth: modalW,
                    frameHeight: modalH,
                    onClose: { vm.returnToTitle() }
                ) {
                    VStack(spacing: 8) {
                        UiSettingSharkCardView(form: form, width: innerW, height: modalH * 0.25) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\\(vm.lang == "zh" ? form.nameZh : form.nameEn) · Lv.\\(vm.inRunLevel)")
                                        .font(.system(size: 13, weight: .black))
                                        .foregroundColor(.white)
                                    Text("🪙 +\\(vm.runCoinsEarned)   🧬 +\\(vm.runGenesEarned)   👑 \\(vm.save.sharkMasteryTiers[form.id] ?? 0)/3")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundColor(.yellow)
                                }
                                Spacer()
                                if let ms = vm.lastMasterySettlement, ms.isNewRecord {
                                    Text(vm.lang == "zh" ? "🏆 新纪录!" : "🏆 NEW BEST!")
                                        .font(.system(size: 10, weight: .black))
                                        .foregroundColor(.yellow)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 3)
                                        .background(Capsule().fill(Color.orange.opacity(0.35)))
                                }
                            }
                        }

                        HStack(spacing: 6) {
                            pauseStatPill(label: vm.t("stat_final_score"), val: "\\(vm.score)", color: .yellow)
                            pauseStatPill(label: vm.t("stat_survival"), val: "\\(vm.runSurvivalSec)s", color: .white)
                            pauseStatPill(label: vm.t("stat_max_depth"), val: "\\(vm.runMaxDepth)m", color: .cyan)
                            pauseStatPill(label: vm.t("stat_peak_combo"), val: "\\(vm.runPeakCombo)x", color: .orange)
                        }
                        .frame(width: innerW)

                        let thirdW = (innerW - 12) / 3.0
                        HStack(spacing: 6) {
                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_SOUND",
                                label: vm.settlementDoubled
                                    ? (vm.lang == "zh" ? "✓ 已翻倍领取" : "✓ 2X CLAIMED")
                                    : (vm.lang == "zh" ? "📺 奖励×2倍" : "📺 2X BOUNTY"),
                                sublabel: "+🪙\\(max(30, vm.runCoinsEarned)) +🧬\\(max(5, vm.runGenesEarned))",
                                customIconText: "📺",
                                width: thirdW,
                                height: btnH,
                                disabled: vm.settlementDoubled
                            ) {
                                vm.openSimulatedRewardedAd(kind: .DOUBLE_SETTLEMENT)
                            }

                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_TUTORIAL",
                                label: vm.lang == "zh" ? "进化图谱" : "EVOLVE ATLAS",
                                sublabel: "\\(vm.save.unlockedSharkIds.count)/48",
                                customIconText: "🧬",
                                width: thirdW,
                                height: btnH
                            ) {
                                vm.showEvolutionAtlas = true
                            }

                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_RESTART",
                                label: vm.t("btn_play_again"),
                                sublabel: vm.lang == "zh" ? "立即再次潜入" : "Dive Again",
                                width: thirdW,
                                height: btnH
                            ) {
                                vm.startNewRun()
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - 3-Second Simulated Rewarded Video Ad Modal
    private func simulatedRewardedAdModal(ad: SimRewardedAdState) -> some View {
        ZStack {
            Color.black.opacity(0.84).ignoresSafeArea()
            VStack(spacing: 14) {
                HStack {
                    Text(vm.lang == "zh" ? "📺 模拟激励视频广告" : "📺 SIMULATED REWARDED VIDEO")
                        .font(.system(size: 11, weight: .black, design: .monospaced))
                        .foregroundColor(.yellow)
                    Spacer()
                    Text(ad.secondsLeft > 0
                         ? (vm.lang == "zh" ? "\\(ad.secondsLeft)秒后可领奖" : "Reward in \\(ad.secondsLeft)s")
                         : (vm.lang == "zh" ? "✅ 播放完成" : "✅ COMPLETED"))
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(ad.secondsLeft > 0 ? .white : .green)
                }

                Text(ad.title)
                    .font(.system(size: 18, weight: .black))
                    .foregroundColor(.white)

                Text(ad.rewardDesc)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.cyan)
                    .multilineTextAlignment(.center)

                GeometryReader { barGeo in
                    let pct = CGFloat(3 - ad.secondsLeft) / 3.0
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.15))
                        Capsule()
                            .fill(LinearGradient(colors: [.yellow, .green], startPoint: .leading, endPoint: .trailing))
                            .frame(width: barGeo.size.width * pct)
                    }
                }
                .frame(height: 8)

                HStack(spacing: 12) {
                    Button {
                        vm.cancelSimulatedAd()
                    } label: {
                        Text(vm.lang == "zh" ? "关闭" : "CLOSE")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white.opacity(0.75))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 9)
                            .background(Capsule().fill(Color.white.opacity(0.12)))
                    }
                    .buttonStyle(.plain)

                    Button {
                        vm.claimSimulatedAdReward()
                    } label: {
                        Text(ad.secondsLeft > 0
                             ? (vm.lang == "zh" ? "请等待 \\(ad.secondsLeft)s..." : "Wait \\(ad.secondsLeft)s...")
                             : (vm.lang == "zh" ? "🎁 立即领取奖励" : "🎁 CLAIM REWARD"))
                            .font(.system(size: 13, weight: .black))
                            .foregroundColor(.black)
                            .padding(.horizontal, 22)
                            .padding(.vertical, 9)
                            .background(
                                Capsule()
                                    .fill(ad.secondsLeft > 0 ? Color.gray : Color.yellow)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(ad.secondsLeft > 0)
                }
            }
            .padding(24)
            .frame(width: 380)
            .background(
                RoundedRectangle(cornerRadius: 22)
                    .fill(Color(red: 4/255, green: 14/255, blue: 34/255))
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.yellow.opacity(0.65), lineWidth: 2))
            )
        }
    }
}

// MARK: - 3. 48-Shark Evolution Atlas Modal (Silky-Smooth Continuous Rotary Wheel + Command Deck)

public struct EvolutionAtlasSheetView: View {
    @ObservedObject var vm: GameViewModel
    @State private var inspectedIndex: Int = 0
    @State private var wheelPosition: Double = 0.0
    @State private var wheelVelocity: Double = 0.0 // slots per second
    @State private var wheelTargetSlot: Double? = nil
    @State private var isDraggingWheel: Bool = false
    @State private var dragHasMoved: Bool = false
    @State private var dragBaseWheelPos: Double? = nil
    @State private var dragStartTime: TimeInterval = 0.0
    @State private var inheritedWheelVelocity: Double = 0.0
    @State private var dragTouchSamples: [(pos: Double, time: TimeInterval)] = []
    @State private var lastTickIndex: Int = 0
    @State private var lastTickFeedbackTime: TimeInterval = 0.0
    @State private var lastPhysicsFrameTime: TimeInterval = 0.0
    @State private var selectionFeedback = UISelectionFeedbackGenerator()

    // iPhone Alarm Clock (UIPickerView) Drum Physics Constants (1:1 Parity with Web SharkEvolutionAtlasModal.tsx):
    // UIKit UIScrollView.DecelerationRate.normal = 0.998/ms (~2.00 s^-1); UIPickerView drum = 0.9978/ms (lambda = 2.05 s^-1)
    private let pickerDecelLambda: Double = 2.05
    private let pickerPxPerSlot: Double = 34.0
    private let pickerMaxVelocity: Double = 42.0
    private let wheelPhysicsTimer = Timer.publish(every: 1.0 / 120.0, on: .main, in: .common).autoconnect()

    private var inspectedForm: SharkFormConfig {
        let total = GameConfigGenerated.sharkForms.count
        let norm = ((inspectedIndex % total) + total) % total
        return GameConfigGenerated.sharkForms[norm]
    }

    private func fireDetentFeedbackIfCrossed(at position: Double) {
        let total = GameConfigGenerated.sharkForms.count
        let roundedSlot = Int(position.rounded())
        let curIdx = ((roundedSlot % total) + total) % total
        if curIdx != inspectedIndex {
            inspectedIndex = curIdx
        }
        if roundedSlot != lastTickIndex {
            lastTickIndex = roundedSlot
            let now = CACurrentMediaTime()
            // Throttle haptic & audio tick to >= 24ms interval so high-speed 40-slot spins never block the 120Hz main thread
            if now - lastTickFeedbackTime >= 0.024 {
                lastTickFeedbackTime = now
                selectionFeedback.selectionChanged()
                selectionFeedback.prepare()
                if vm.save.soundEnabled {
                    AudioServicesPlaySystemSound(1104)
                }
            }
        }
    }

    private func snapWheel(to targetPosition: Double) {
        let snapped = targetPosition.rounded()
        lastPhysicsFrameTime = CACurrentMediaTime()
        wheelTargetSlot = snapped
        wheelVelocity = (snapped - wheelPosition) * pickerDecelLambda * 1.35
    }

    private func stepWheelPhysics() {
        guard !isDraggingWheel else {
            lastPhysicsFrameTime = CACurrentMediaTime()
            return
        }
        guard let target = wheelTargetSlot else {
            lastPhysicsFrameTime = CACurrentMediaTime()
            return
        }

        let now = CACurrentMediaTime()
        let dt = lastPhysicsFrameTime <= 0 ? (1.0 / 60.0) : min(0.045, max(0.001, now - lastPhysicsFrameTime))
        lastPhysicsFrameTime = now

        let rem = target - wheelPosition
        let absRem = abs(rem)

        if absRem > 0.26 {
            // Phase 1: Authentic iPhone Alarm (UIPickerView) Exponential Drum Glide
            // with subtle mechanical detent ratchet modulation across each slot boundary
            let baseExpVel = rem * pickerDecelLambda
            let ratchetMod = 1.0 + 0.075 * cos(2.0 * .pi * wheelPosition)
            let desiredVel = baseExpVel * ratchetMod
            wheelVelocity += (desiredVel - wheelVelocity) * min(1.0, dt * 24.0)
            wheelPosition += wheelVelocity * dt
        } else {
            // Phase 2: Final Magnetic Detent Notch Lock-In (overdamped, zero overshoot)
            let detentStiffness = 115.0
            let detentDamping = 22.5
            let accel = rem * detentStiffness - wheelVelocity * detentDamping
            wheelVelocity += accel * dt
            wheelPosition += wheelVelocity * dt

            if abs(target - wheelPosition) < 0.002 && abs(wheelVelocity) < 0.015 {
                wheelPosition = target
                wheelVelocity = 0.0
                wheelTargetSlot = nil
                fireDetentFeedbackIfCrossed(at: target)
                return
            }
        }

        fireDetentFeedbackIfCrossed(at: wheelPosition)
    }

    public var body: some View {
        let form = inspectedForm
        let check = GameRules.evaluateSharkUnlock(form: form, save: vm.save)
        let curLv = vm.save.sharkUpgradeLevels[form.id] ?? 1
        let stats = GameRules.computeEvolvedSharkStats(
            inRunLevel: 1,
            sharkFormId: form.id,
            upgradeLevel: curLv,
            frenzyActive: false,
            globalDifficultyMultiplier: 1.0,
            unlockedCount: vm.save.unlockedSharkIds.count
        )
        let masteryConfig = GameRules.getSharkMasteryConfig(form: form)
        let bestScore = vm.save.sharkBestScores[form.id] ?? 0
        let claimedTier = vm.save.sharkMasteryTiers[form.id] ?? 0
        let globalBonuses = GameRules.getGlobalAtlasBonuses(save: vm.save)
        let lineageMeta = GameConfigGenerated.lineageMeta[form.lineage]

        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            ZStack {
                // Deep-Sea Bioluminescent Backdrop
                LinearGradient(
                    colors: [
                        Color(red: 4/255, green: 21/255, blue: 48/255),
                        Color(red: 2/255, green: 10/255, blue: 26/255),
                        Color(red: 1/255, green: 4/255, blue: 13/255)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 0) {
                    // 1. Single-Line Header Bar
                    atlasHeaderBar(globalBonuses: globalBonuses)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.65))

                    Divider().background(Color.cyan.opacity(0.2))

                    // 2. Main Split Stage (Left/Top: Giant Aquarium + Continuous Rotary Wheel; Right/Bottom: De-Boxed Command Deck)
                    if isLandscape {
                        HStack(spacing: 0) {
                            aquariumAndArcDialStage(
                                form: form,
                                check: check,
                                lineageMeta: lineageMeta,
                                curLv: curLv,
                                stageWidth: geo.size.width * 0.50
                            )
                            .frame(width: geo.size.width * 0.50)
                            Divider().background(Color.cyan.opacity(0.18))
                            commandDeckPanel(
                                form: form,
                                check: check,
                                curLv: curLv,
                                stats: stats,
                                masteryConfig: masteryConfig,
                                bestScore: bestScore,
                                claimedTier: claimedTier
                            )
                            .frame(width: geo.size.width * 0.50)
                        }
                    } else {
                        VStack(spacing: 0) {
                            aquariumAndArcDialStage(
                                form: form,
                                check: check,
                                lineageMeta: lineageMeta,
                                curLv: curLv,
                                stageWidth: geo.size.width
                            )
                            .frame(height: geo.size.height * 0.48)
                            Divider().background(Color.cyan.opacity(0.18))
                            commandDeckPanel(
                                form: form,
                                check: check,
                                curLv: curLv,
                                stats: stats,
                                masteryConfig: masteryConfig,
                                bestScore: bestScore,
                                claimedTier: claimedTier
                            )
                        }
                    }
                }
            }
        }
        .onAppear {
            inspectedIndex = vm.activeSharkForm.index
            wheelPosition = Double(vm.activeSharkForm.index)
            wheelVelocity = 0.0
            wheelTargetSlot = nil
            lastTickIndex = vm.activeSharkForm.index
            lastPhysicsFrameTime = CACurrentMediaTime()
            selectionFeedback.prepare()
        }
        .onReceive(wheelPhysicsTimer) { _ in
            stepWheelPhysics()
        }
    }

    // MARK: - Header Bar
    private func atlasHeaderBar(globalBonuses: GlobalAtlasBonuses) -> some View {
        HStack(spacing: 10) {
            UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 28)
            Text(vm.lang == "zh" ? "进化 · 48阶鲨鱼基因图谱" : "EVOLUTION · 48-SHARK ATLAS")
                .font(.system(size: 15, weight: .black))
                .foregroundColor(.white)
                .lineLimit(1)

            Text("\\(vm.save.unlockedSharkIds.count)/48")
                .font(.system(size: 11, weight: .black, design: .monospaced))
                .foregroundColor(.cyan)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(Capsule().fill(Color.cyan.opacity(0.16)))

            // Global Collection & Mastery Bonus Pills
            HStack(spacing: 6) {
                Text("❤️+\\(Int(((globalBonuses.hpMultiplier - 1.0) * 100).rounded()))%")
                    .foregroundColor(.green)
                Text("⚡+\\(Int((globalBonuses.speedBonus * 100).rounded()))%")
                    .foregroundColor(.cyan)
                Text("🪙+\\(Int(((globalBonuses.rewardMultiplier - 1.0) * 100).rounded()))%")
                    .foregroundColor(.yellow)
                Text("👑\\(globalBonuses.totalMasteryCrowns)/144")
                    .foregroundColor(.orange)
            }
            .font(.system(size: 10, weight: .black, design: .monospaced))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(Color.black.opacity(0.45)))

            Spacer()

            // Banked Coins & Genes
            HStack(spacing: 4) {
                UiAtlasIconView(iconKey: "UI_ICON_COIN", size: 16)
                Text("\\(vm.save.bankedCoins)")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.yellow)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Capsule().fill(Color.black.opacity(0.55)))

            HStack(spacing: 4) {
                UiAtlasIconView(iconKey: "UI_ICON_GENE", size: 16)
                Text("\\(vm.save.bankedGenes)")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.mint)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Capsule().fill(Color.black.opacity(0.55)))

            Button {
                vm.playUiTick()
                vm.showEvolutionAtlas = false
            } label: {
                Text("✕")
                    .font(.system(size: 14, weight: .black))
                    .foregroundColor(.white)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Unified Touch/Drag Gesture Handler (1:1 Parity with Web handleStagePointerDown/Move/Up)
    private func makeWheelDragGesture(stageWidth: CGFloat, allowArcTapSelection: Bool) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { val in
                let now = val.time.timeIntervalSinceReferenceDate
                let tx = Double(val.translation.width)
                let ty = Double(val.translation.height)

                if !isDraggingWheel || dragBaseWheelPos == nil {
                    isDraggingWheel = true
                    dragHasMoved = false
                    inheritedWheelVelocity = abs(wheelVelocity) > 2.0 ? wheelVelocity : 0.0
                    wheelTargetSlot = nil
                    wheelVelocity = 0.0
                    dragBaseWheelPos = wheelPosition
                    dragStartTime = now
                    dragTouchSamples = [(pos: wheelPosition, time: now)]
                    selectionFeedback.prepare()
                }

                if abs(tx) > 4.0 || abs(ty) > 4.0 {
                    dragHasMoved = true
                }

                let startPos = dragBaseWheelPos ?? wheelPosition
                let rawPos = startPos - tx / pickerPxPerSlot
                dragTouchSamples.append((pos: rawPos, time: now))
                while dragTouchSamples.count > 10, let first = dragTouchSamples.first, (now - first.time) > 0.12 {
                    dragTouchSamples.removeFirst()
                }

                let firstSample = dragTouchSamples.first ?? (pos: rawPos, time: now)
                let dtSec = max(0.008, now - firstSample.time)
                let dragVel = (rawPos - firstSample.pos) / dtSec

                // Subtle slow-drag magnetic detent dwell across each integer slot (like iPhone Alarm drum)
                let detentStrength = max(0.0, 1.0 - abs(dragVel) / 3.2) * 0.055
                let displayPos = rawPos - detentStrength * sin(2.0 * .pi * rawPos)

                wheelPosition = displayPos
                wheelVelocity = dragVel
                fireDetentFeedbackIfCrossed(at: displayPos)
            }
            .onEnded { val in
                let now = val.time.timeIntervalSinceReferenceDate
                let startPos = dragBaseWheelPos ?? wheelPosition
                let moved = dragHasMoved
                isDraggingWheel = false
                dragHasMoved = false
                dragBaseWheelPos = nil
                lastPhysicsFrameTime = CACurrentMediaTime()

                // If user tapped without dragging (< 4pt movement), resolve tapped shark slot on the arc
                if !moved && allowArcTapSelection {
                    let maxHalfSpan = min(186.0, Double(stageWidth) * 0.44)
                    let pxPerArcSlot = max(24.0, maxHalfSpan / 3.05)
                    let dxFromCenter = Double(val.startLocation.x - stageWidth * 0.5)
                    let tappedSlotOffset = (dxFromCenter / pxPerArcSlot).rounded()
                    if abs(tappedSlotOffset) >= 1.0 && abs(tappedSlotOffset) <= 3.0 {
                        let baseTarget = wheelPosition.rounded()
                        snapWheel(to: baseTarget + tappedSlotOffset)
                        dragTouchSamples.removeAll()
                        return
                    }
                }

                let latest = dragTouchSamples.last ?? (pos: wheelPosition, time: now)
                let pauseBeforeLiftSec = max(0.0, now - latest.time)
                var releaseVel: Double = 0.0

                if pauseBeforeLiftSec < 0.095 && dragTouchSamples.count >= 2 {
                    var anchor = dragTouchSamples[0]
                    for idx in stride(from: dragTouchSamples.count - 2, through: 0, by: -1) {
                        anchor = dragTouchSamples[idx]
                        if (latest.time - anchor.time) >= 0.030 {
                            break
                        }
                    }
                    let windowSec = latest.time - anchor.time
                    if windowSec >= 0.005 {
                        releaseVel = (latest.pos - anchor.pos) / windowSec
                    }
                }

                // Blend UIKit's hardware-predicted end translation for crisp short thumb flicks
                if pauseBeforeLiftSec < 0.095 {
                    let predictedExtraDx = Double(val.predictedEndTranslation.width - val.translation.width)
                    let predictedEndPos = startPos - Double(val.predictedEndTranslation.width) / pickerPxPerSlot
                    let systemThrowVel = (predictedEndPos - wheelPosition) * pickerDecelLambda
                    let extraThrowVel = (-predictedExtraDx / pickerPxPerSlot) * pickerDecelLambda * 0.95
                    let bestSystemVel = abs(extraThrowVel) > abs(systemThrowVel) ? extraThrowVel : systemThrowVel
                    if abs(bestSystemVel) > abs(releaseVel) {
                        releaseVel = releaseVel * 0.30 + bestSystemVel * 0.70
                    }
                }

                // Multi-flick momentum stacking (just like spinning the iPhone Alarm minute wheel repeatedly!)
                let gestureDuration = now - dragStartTime
                if gestureDuration < 0.28 && abs(releaseVel) > 1.8 && (releaseVel * inheritedWheelVelocity > 0) {
                    releaseVel += inheritedWheelVelocity * 0.72
                }
                releaseVel = max(-pickerMaxVelocity, min(pickerMaxVelocity, releaseVel))
                dragTouchSamples.removeAll()

                let targetSlot: Double
                if abs(releaseVel) > 1.05 {
                    let projected = wheelPosition + releaseVel / pickerDecelLambda
                    var roundedTarget = projected.rounded()
                    if roundedTarget == wheelPosition.rounded() {
                        roundedTarget += releaseVel > 0 ? 1.0 : -1.0
                    }
                    targetSlot = roundedTarget
                } else {
                    targetSlot = wheelPosition.rounded()
                }

                wheelTargetSlot = targetSlot
                wheelVelocity = (targetSlot - wheelPosition) * pickerDecelLambda
            }
    }

    // MARK: - Left/Top: Giant Aquarium Spotlight + Silky-Smooth Continuous Rotary Wheel
    private func aquariumAndArcDialStage(
        form: SharkFormConfig,
        check: UnlockCheckResult,
        lineageMeta: SharkLineageMeta?,
        curLv: Int,
        stageWidth: CGFloat
    ) -> some View {
        let lineageIconKey: String = {
            switch form.lineage {
            case .APEX_BIO: return "UI_LINEAGE_APEX"
            case .CYBER_MECHA: return "UI_LINEAGE_MECHA"
            case .ELEMENTAL_CORE: return "UI_LINEAGE_ELEMENTAL"
            case .ELDER_ABYSS: return "UI_LINEAGE_ABYSS"
            }
        }()

        return VStack(spacing: 4) {
            // Top Stage Title & Lineage Badge
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        UiAtlasIconView(iconKey: lineageIconKey, size: 16)
                        Text(vm.lang == "zh" ? (lineageMeta?.nameZh ?? "") : (lineageMeta?.nameEn ?? ""))
                            .font(.system(size: 10, weight: .black))
                            .foregroundColor(Color(hex: lineageMeta?.themeColorHex ?? form.primaryColorHex))
                        Text("· GEN \\(["I","II","III","IV","V","VI"][max(0, min(5, form.row))]) · #\\(String(format: "%02d", form.index + 1))")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                    Text(vm.lang == "zh" ? form.nameZh : form.nameEn)
                        .font(.system(size: 20, weight: .black))
                        .foregroundColor(.white)
                    Text(vm.lang == "zh" ? form.titleZh : form.titleEn)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.cyan.opacity(0.85))
                }
                Spacer()
                if vm.save.selectedSharkId == form.id {
                    Text(vm.lang == "zh" ? "⚡ 当前出战" : "⚡ DEPLOYED")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.green)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.green.opacity(0.2)).overlay(Capsule().stroke(Color.green, lineWidth: 1)))
                } else if check.isUnlocked {
                    Text("Lv.\\(curLv)/10")
                        .font(.system(size: 11, weight: .black, design: .monospaced))
                        .foregroundColor(.cyan)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.cyan.opacity(0.18)))
                } else if check.canUnlockNow {
                    Text(vm.lang == "zh" ? "✨ 可立即进化" : "✨ READY")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.yellow)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.yellow.opacity(0.22)).overlay(Capsule().stroke(Color.yellow, lineWidth: 1)))
                } else {
                    Text(vm.lang == "zh" ? "🔒 待解锁" : "🔒 LOCKED")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.black.opacity(0.5)))
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Spacer(minLength: 2)

            // Center Giant Shark Spotlight with Left / Right Step Arrows (Center Spotlight also draggable!)
            HStack {
                Button {
                    let base = wheelTargetSlot ?? wheelPosition.rounded()
                    snapWheel(to: base - 1.0)
                } label: {
                    Text("◀")
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(.cyan)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.black.opacity(0.55)).overlay(Circle().stroke(Color.cyan.opacity(0.35), lineWidth: 1)))
                }
                .buttonStyle(.plain)

                Spacer()

                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color(hex: form.glowColorHex).opacity(0.32), .clear],
                                center: .center,
                                startRadius: 8,
                                endRadius: 110
                            )
                        )
                        .frame(width: 220, height: 120)

                    SharkPreviewView(form: form, width: 220, height: 118, locked: !check.isUnlocked && !check.canUnlockNow)
                        .shadow(color: Color(hex: form.glowColorHex).opacity(0.55), radius: 14)
                }
                .contentShape(Rectangle())
                .highPriorityGesture(makeWheelDragGesture(stageWidth: stageWidth, allowArcTapSelection: false))

                Spacer()

                Button {
                    let base = wheelTargetSlot ?? wheelPosition.rounded()
                    snapWheel(to: base + 1.0)
                } label: {
                    Text("▶")
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(.cyan)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.black.opacity(0.55)).overlay(Circle().stroke(Color.cyan.opacity(0.35), lineWidth: 1)))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)

            Spacer(minLength: 2)

            // Bottom Silky-Smooth Continuous Rotary Wheel (1:1 Parabolic Arc & Stable View Identity with Web SharkEvolutionAtlasModal.tsx)
            GeometryReader { dialGeo in
                let dialW = dialGeo.size.width
                let dialH = dialGeo.size.height
                let total = GameConfigGenerated.sharkForms.count
                let centerSlot = Int(wheelPosition.rounded())
                let visibleRawSlots = Array((centerSlot - 4)...(centerSlot + 4))
                let maxHalfSpan = min(186.0, Double(dialW) * 0.44)

                ZStack {
                    // Upper & Lower Curved Compass Rim Tracks (1:1 with Web SVG paths)
                    Path { path in
                        path.move(to: CGPoint(x: dialW * 0.05, y: dialH * 0.68))
                        path.addQuadCurve(
                            to: CGPoint(x: dialW * 0.95, y: dialH * 0.68),
                            control: CGPoint(x: dialW * 0.50, y: dialH * 0.14)
                        )
                    }
                    .stroke(Color.cyan.opacity(0.32), lineWidth: 1.75)

                    Path { path in
                        path.move(to: CGPoint(x: dialW * 0.03, y: dialH * 0.78))
                        path.addQuadCurve(
                            to: CGPoint(x: dialW * 0.97, y: dialH * 0.78),
                            control: CGPoint(x: dialW * 0.50, y: dialH * 0.24)
                        )
                    }
                    .stroke(Color.cyan.opacity(0.14), style: StrokeStyle(lineWidth: 1.0, dash: [4, 6]))

                    // Key by stable virtual slot rawIdx so SwiftUI NEVER swaps shark textures across integer boundaries!
                    ForEach(visibleRawSlots, id: \\.self) { rawIdx in
                        let itemIdx = ((rawIdx % total) + total) % total
                        let itemForm = GameConfigGenerated.sharkForms[itemIdx]
                        let itemUnlocked = vm.save.unlockedSharkIds.contains(itemForm.id)
                        let isActive = vm.save.selectedSharkId == itemForm.id
                        let slotPos = Double(rawIdx) - wheelPosition
                        let absSlot = abs(slotPos)

                        if absSlot <= 3.65 {
                            let isCenter = absSlot < 0.45
                            let xOffset = (slotPos / 3.05) * maxHalfSpan
                            let normalizedX = min(1.25, absSlot / 3.05)
                            let yOffset = -4.0 + normalizedX * normalizedX * 18.0
                            let rotDeg = slotPos * 6.5
                            let scale = CGFloat(max(0.60, 1.12 - absSlot * 0.14))
                            let edgeOpacity = max(0.15, 1.0 - max(0.0, absSlot - 2.4) * 0.70)
                            let nodeOpacity = itemUnlocked ? edgeOpacity : edgeOpacity * 0.65

                            VStack(spacing: 2) {
                                ZStack {
                                    Circle()
                                        .fill(
                                            isCenter
                                                ? Color.cyan.opacity(0.22)
                                                : (isActive ? Color.green.opacity(0.16) : Color.white.opacity(0.04))
                                        )
                                        .frame(width: 46, height: 46)
                                        .overlay(
                                            Circle().stroke(
                                                isCenter ? Color.cyan.opacity(0.85) : (isActive ? Color.green.opacity(0.55) : Color.clear),
                                                lineWidth: isCenter ? 1.8 : 1.0
                                            )
                                        )
                                        .shadow(color: isCenter ? Color.cyan.opacity(0.65) : .clear, radius: 10)

                                    if isCenter {
                                        Circle()
                                            .fill(Color.cyan)
                                            .frame(width: 5, height: 5)
                                            .shadow(color: .cyan, radius: 4)
                                            .offset(y: -25)
                                    } else if isActive {
                                        Circle()
                                            .fill(Color.green)
                                            .frame(width: 5, height: 5)
                                            .offset(x: 15, y: -15)
                                    }

                                    SharkPreviewView(form: itemForm, width: 38, height: 22, locked: !itemUnlocked)
                                }
                                Text(vm.lang == "zh" ? itemForm.nameZh : itemForm.nameEn)
                                    .font(.system(size: 8.5, weight: isCenter ? .black : .bold))
                                    .foregroundColor(isCenter ? .white : Color.white.opacity(0.55))
                                    .lineLimit(1)
                            }
                            .scaleEffect(scale)
                            .rotationEffect(.degrees(rotDeg))
                            .opacity(nodeOpacity)
                            .position(
                                x: dialW * 0.50 + CGFloat(xOffset),
                                y: dialH * 0.48 + CGFloat(yOffset)
                            )
                            .zIndex(isCenter ? 35.0 : (25.0 - absSlot * 3.0))
                            .allowsHitTesting(false)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .highPriorityGesture(makeWheelDragGesture(stageWidth: dialW, allowArcTapSelection: true))
            }
            .frame(height: 86)
            .padding(.bottom, 6)
        }
    }

    // MARK: - Right/Bottom: De-Boxed Command Deck (Trait + 4-Col Stat Strip + 3-Col Mastery Crowns + Gate/Reinforce + Actions)
    private func commandDeckPanel(
        form: SharkFormConfig,
        check: UnlockCheckResult,
        curLv: Int,
        stats: ComputedSharkStats,
        masteryConfig: SharkMasteryConfig,
        bestScore: Int,
        claimedTier: Int
    ) -> some View {
        let upCoinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: curLv)
        let upGeneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: curLv)
        let canUpgrade = check.isUnlocked && curLv < 10 && vm.save.bankedCoins >= upCoinCost && vm.save.bankedGenes >= upGeneCost

        return VStack(alignment: .leading, spacing: 8) {
            // 1. Special Ability Trait
            VStack(alignment: .leading, spacing: 2) {
                Text(vm.lang == "zh" ? "🧬 专属觉醒特性" : "🧬 AWAKENED TRAIT")
                    .font(.system(size: 9.5, weight: .black))
                    .foregroundColor(.cyan)
                Text(vm.lang == "zh" ? form.traitZh : form.traitEn)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(.white.opacity(0.92))
                    .lineLimit(2)
            }

            Divider().background(Color.white.opacity(0.1))

            // 2. 4-Column Stat Strip (Bite Tier, Max HP, Swim Speed, Boost Energy)
            HStack(spacing: 8) {
                deckStatItem(
                    label: vm.lang == "zh" ? "咬合阶位" : "BITE TIER",
                    value: "T\\(stats.normalBiteTier)",
                    sub: "Max T\\(min(8, form.baseBiteTier + 2))",
                    color: .yellow
                )
                deckStatItem(
                    label: vm.lang == "zh" ? "生命上限" : "MAX HP",
                    value: "\\(Int(stats.maxHp.rounded()))",
                    sub: "-\\(Int((form.hpDrainReduction * 100).rounded()))% Drain",
                    color: .green
                )
                deckStatItem(
                    label: vm.lang == "zh" ? "巡航速度" : "SPEED",
                    value: "\\(Int(stats.moveSpeed.rounded()))",
                    sub: "Boost \\(Int(stats.boostSpeed.rounded()))",
                    color: .cyan
                )
                deckStatItem(
                    label: vm.lang == "zh" ? "氮气能量" : "ENERGY",
                    value: "\\(Int(stats.maxEnergy.rounded()))",
                    sub: "Mag +\\(Int(form.magnetBonus))",
                    color: .purple
                )
            }

            Divider().background(Color.white.opacity(0.1))

            // 3. 3-Column Score Mastery Crown Track
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(vm.lang == "zh" ? "👑 单鲨积分专精悬赏" : "👑 SCORE MASTERY BOUNTY")
                        .font(.system(size: 9.5, weight: .black))
                        .foregroundColor(.yellow)
                    Spacer()
                    Text(vm.lang == "zh" ? "最高纪录: \\(bestScore)" : "BEST: \\(bestScore)")
                        .font(.system(size: 9.5, weight: .black, design: .monospaced))
                        .foregroundColor(.white.opacity(0.85))
                }
                HStack(spacing: 6) {
                    ForEach(masteryConfig.tiers, id: \\.tier) { mTier in
                        let achieved = claimedTier >= mTier.tier || bestScore >= mTier.targetScore
                        let icon = mTier.tier == 1 ? "🥉" : (mTier.tier == 2 ? "🥈" : "🥇")
                        VStack(alignment: .leading, spacing: 1) {
                            HStack {
                                Text("\\(icon) \\(vm.lang == "zh" ? mTier.labelZh : mTier.labelEn)")
                                    .font(.system(size: 8.5, weight: .black))
                                    .foregroundColor(achieved ? .yellow : .white.opacity(0.75))
                                Spacer()
                                Text(achieved ? "✓" : "\\(mTier.targetScore)")
                                    .font(.system(size: 8, weight: .black, design: .monospaced))
                                    .foregroundColor(achieved ? .green : .gray)
                            }
                            Text("+🪙\\(mTier.rewardCoins) +🧬\\(mTier.rewardGenes)")
                                .font(.system(size: 8, weight: .bold, design: .monospaced))
                                .foregroundColor(.cyan)
                        }
                        .padding(5)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: 7)
                                .fill(achieved ? Color.yellow.opacity(0.12) : Color.black.opacity(0.38))
                                .overlay(RoundedRectangle(cornerRadius: 7).stroke(achieved ? Color.yellow.opacity(0.45) : Color.white.opacity(0.08), lineWidth: 1))
                        )
                    }
                }
            }

            // 4. Unlock Prerequisite Gate OR 10-Segment Body Reinforcement Bar
            if check.isUnlocked {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(vm.lang == "zh" ? "🔧 躯体强化进度 (Lv.\\(curLv)/10)" : "🔧 BODY REINFORCEMENT (Lv.\\(curLv)/10)")
                            .font(.system(size: 9.5, weight: .black))
                            .foregroundColor(.cyan)
                        Spacer()
                        Text(vm.lang == "zh" ? "Lv.5 & Lv.10 突破咬合阶位 T+1" : "Lv.5 & Lv.10 Unlock Bite Tier +1")
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundColor(.yellow)
                    }
                    HStack(spacing: 4) {
                        ForEach(1...10, id: \\.self) { seg in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(seg <= curLv ? (seg == 5 || seg == 10 ? Color.yellow : Color.cyan) : Color.white.opacity(0.12))
                                .frame(height: 7)
                        }
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    Text(vm.lang == "zh" ? "🔓 破茧进化前置条件" : "🔓 EVOLUTION PREREQUISITES")
                        .font(.system(size: 9.5, weight: .black))
                        .foregroundColor(.orange)
                    HStack(spacing: 8) {
                        if let parent = check.parentForm {
                            let pName = vm.lang == "zh" ? parent.nameZh : parent.nameEn
                            Text("\\(check.parentLevelMet && check.parentUnlocked ? "✅" : "🔒") \\(pName) Lv.\\(check.parentUpgradeLevel)/\\(check.reqParentUpgradeLevel)")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(check.parentLevelMet && check.parentUnlocked ? .green : .orange)
                        }
                        Text("\\(check.depthMet ? "✅" : "🔒") \\(vm.lang == "zh" ? "探索深度" : "Depth") \\(Int(check.currentMaxDepth))m/\\(Int(check.reqMaxDepth))m")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundColor(check.depthMet ? .green : .orange)
                    }
                }
            }

            Spacer(minLength: 2)

            // 5. Bottom Action Buttons
            HStack(spacing: 10) {
                if check.isUnlocked {
                    // Upgrade Body Button
                    Button {
                        _ = vm.upgradeSharkForm(form)
                    } label: {
                        HStack(spacing: 5) {
                            UiAtlasIconView(iconKey: "UI_BTN_BODY_UPGRADE", size: 20)
                            Text(curLv >= 10
                                 ? (vm.lang == "zh" ? "已满级 MAX" : "MAX LEVEL")
                                 : (upGeneCost > 0
                                    ? "\\(vm.lang == "zh" ? "突破阶位" : "BREAKTHROUGH") 🪙\\(upCoinCost) 🧬\\(upGeneCost)"
                                    : "\\(vm.lang == "zh" ? "强化躯体" : "UPGRADE") 🪙\\(upCoinCost)"))
                                .font(.system(size: 11.5, weight: .black))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(canUpgrade ? Color.blue : Color.white.opacity(0.1))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(canUpgrade ? Color.cyan : Color.clear, lineWidth: 1.2))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!canUpgrade)

                    // Deploy / Active Button
                    let isSelected = vm.save.selectedSharkId == form.id
                    Button {
                        vm.selectSharkForm(form)
                    } label: {
                        Text(isSelected
                             ? (vm.lang == "zh" ? "✓ 当前出战中" : "✓ DEPLOYED")
                             : (vm.lang == "zh" ? "⚡ 出战该鲨鱼" : "⚡ DEPLOY SHARK"))
                            .font(.system(size: 11.5, weight: .black))
                            .foregroundColor(isSelected ? .green : .black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(isSelected ? Color.green.opacity(0.18) : Color.green)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.green, lineWidth: 1.2))
                            )
                    }
                    .buttonStyle(.plain)
                } else {
                    // Unlock / Evolve Button
                    Button {
                        _ = vm.unlockSharkForm(form)
                    } label: {
                        HStack(spacing: 6) {
                            UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 22)
                            Text("\\(vm.lang == "zh" ? "立即破茧进化" : "EVOLVE NOW") (🪙\\(form.unlockCoins) · 🧬\\(form.unlockGenes))")
                                .font(.system(size: 12, weight: .black))
                                .foregroundColor(check.canUnlockNow ? .black : .white.opacity(0.5))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(check.canUnlockNow ? Color.green : Color.white.opacity(0.1))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(check.canUnlockNow ? Color.mint : Color.white.opacity(0.15), lineWidth: 1.2))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!check.canUnlockNow)

                    // Free Supply Drop Ad Button when short on Coins / Genes
                    if !check.coinsMet || !check.genesMet {
                        Button {
                            vm.openSimulatedRewardedAd(kind: .SUPPLY_DROP)
                        } label: {
                            Text(vm.lang == "zh" ? "📺 免费补给 (+300🪙+25🧬)" : "📺 FREE DROP (+300🪙+25🧬)")
                                .font(.system(size: 10.5, weight: .black))
                                .foregroundColor(.black)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color.yellow))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func deckStatItem(label: String, value: String, sub: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 8.5, weight: .bold))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 14, weight: .black, design: .monospaced))
                .foregroundColor(color)
            Text(sub)
                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                .foregroundColor(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
    <string>deepsea:evolution</string>
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
    <key>GADApplicationIdentifier</key>
    <string>${GOOGLE_ADS_CONFIG.admobAppId}</string>
    <key>GADIsAdManagerApp</key>
    <true/>
    <key>NSUserTrackingUsageDescription</key>
    <string>允许追踪以提供个性化深海狩猎激励视频广告体验</string>
    <key>SKAdNetworkItems</key>
    <array>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>cstr6suwn9.skadnetwork</string>
        </dict>
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
