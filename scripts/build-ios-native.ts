import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
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
    public static let googleAdMobBackupRewardedAdUnitId: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.admobIosBackupRewardedAdUnitId)}"
    public static let googleH5ClientId: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.h5ClientId)}"
    public static let imaVastTagUrl: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.imaVastTagUrl)}"
    public static let fallbackVideoStreamUrl: String = "${escapeSwiftString(GOOGLE_ADS_CONFIG.fallbackVideoStreamUrl)}"

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

    /// Continuous 1.0x world-space seafloor mountain & trench profile (matches Web TerrainGenerator.getFloorDepthAt)
    public static func getFloorDepthAt(worldX x: Double) -> Double {
        let macroWave = sin(x * 0.00016 + 0.35) * 0.55 + cos(x * 0.000075 - 0.8) * 0.45
        let baseShelf = 1120.0 + (macroWave * 0.5 + 0.5) * 5200.0
        let mountainRidge = noise1D(x * 0.00038, salt: 11) * 1450.0
        let canyonCarve = noise1D(x * 0.0011, salt: 23) * 480.0
        let reefBumps = noise1D(x * 0.0032, salt: 37) * 95.0

        let trenchSignal = noise1D(x * 0.00019 + 4.2, salt: 71)
        let trenchFactor = max(0.0, (trenchSignal - 0.38) / 0.62)
        let trenchDrop = trenchFactor * trenchFactor * 5500.0

        let spawnDist = abs(x - 100.0)
        let spawnFlatten = max(0.0, 1.0 - spawnDist / 900.0)
        let rawDepth = baseShelf + mountainRidge + canyonCarve + reefBumps + trenchDrop
        let flattened = rawDepth * (1.0 - spawnFlatten * 0.65) + 740.0 * (spawnFlatten * 0.65)

        return max(520.0, min(18500.0, flattened))
    }

    public static func getTerrainSlopeAt(worldX x: Double) -> Double {
        let d1 = getFloorDepthAt(worldX: x - 8.0)
        let d2 = getFloorDepthAt(worldX: x + 8.0)
        return (d2 - d1) / 16.0
    }

    public struct SeabedTerraceTierSpec {
        public let tierIndex: Int
        public let baseDepth: Double
        public let period: Double
        public let phaseShift: Double
        public let openDuty: Double
        public let stripId: String
        public let reliefAmp: Double
        public let dropAmplitude: Double
        public let thicknessBase: Double
        public let clearanceFromMainFloor: Double
    }

    /// 9-Tier Non-Uniformly Spaced Multi-Depth Seabed Terraces (414m -> 16,900m, 1:1 parity with Web SEABED_TERRACE_TIERS)
    public static let seabedTerraceTiers: [SeabedTerraceTierSpec] = [
        // Tier 0 (~414m, spacing baseline): Shallow sunlit coral seabed
        SeabedTerraceTierSpec(
            tierIndex: 0, baseDepth: 414.0, period: 1680.0, phaseShift: 0.0, openDuty: 0.24,
            stripId: "coral_reef", reliefAmp: 1.0, dropAmplitude: 175.0, thicknessBase: 195.0, clearanceFromMainFloor: 130.0
        ),
        // Tier 1 (~820m, gap +406m): Upper twilight rocky coral shelf
        SeabedTerraceTierSpec(
            tierIndex: 1, baseDepth: 820.0, period: 1960.0, phaseShift: 740.0, openDuty: 0.28,
            stripId: "rocky_shelf", reliefAmp: 1.32, dropAmplitude: 215.0, thicknessBase: 225.0, clearanceFromMainFloor: 165.0
        ),
        // Tier 2 (~1380m, gap +560m): Lower twilight canyon terrace
        SeabedTerraceTierSpec(
            tierIndex: 2, baseDepth: 1380.0, period: 2240.0, phaseShift: 1420.0, openDuty: 0.30,
            stripId: "underwater_canyon", reliefAmp: 1.62, dropAmplitude: 255.0, thicknessBase: 250.0, clearanceFromMainFloor: 190.0
        ),
        // Tier 3 (~2180m, gap +800m): Midnight canyon terrace
        SeabedTerraceTierSpec(
            tierIndex: 3, baseDepth: 2180.0, period: 2560.0, phaseShift: 520.0, openDuty: 0.31,
            stripId: "underwater_canyon", reliefAmp: 1.85, dropAmplitude: 295.0, thicknessBase: 275.0, clearanceFromMainFloor: 215.0
        ),
        // Tier 4 (~3350m, gap +1170m): Upper abyssal basalt shelf
        SeabedTerraceTierSpec(
            tierIndex: 4, baseDepth: 3350.0, period: 2920.0, phaseShift: 1680.0, openDuty: 0.33,
            stripId: "deep_abyss", reliefAmp: 2.10, dropAmplitude: 340.0, thicknessBase: 300.0, clearanceFromMainFloor: 240.0
        ),
        // Tier 5 (~5050m, gap +1700m): Mid-abyssal volcanic terrace
        SeabedTerraceTierSpec(
            tierIndex: 5, baseDepth: 5050.0, period: 3320.0, phaseShift: 910.0, openDuty: 0.34,
            stripId: "deep_abyss", reliefAmp: 2.35, dropAmplitude: 390.0, thicknessBase: 330.0, clearanceFromMainFloor: 265.0
        ),
        // Tier 6 (~7500m, gap +2450m): Deep abyssal trench ledge
        SeabedTerraceTierSpec(
            tierIndex: 6, baseDepth: 7500.0, period: 3760.0, phaseShift: 2190.0, openDuty: 0.36,
            stripId: "deep_abyss", reliefAmp: 2.65, dropAmplitude: 450.0, thicknessBase: 360.0, clearanceFromMainFloor: 290.0
        ),
        // Tier 7 (~11200m, gap +3700m): Upper Hadal fault terrace
        SeabedTerraceTierSpec(
            tierIndex: 7, baseDepth: 11200.0, period: 4280.0, phaseShift: 1270.0, openDuty: 0.38,
            stripId: "deep_abyss", reliefAmp: 3.00, dropAmplitude: 520.0, thicknessBase: 395.0, clearanceFromMainFloor: 320.0
        ),
        // Tier 8 (~16900m, gap +5700m): Deep Hadal abyssal core ledge
        SeabedTerraceTierSpec(
            tierIndex: 8, baseDepth: 16900.0, period: 4880.0, phaseShift: 2840.0, openDuty: 0.40,
            stripId: "deep_abyss", reliefAmp: 3.40, dropAmplitude: 600.0, thicknessBase: 430.0, clearanceFromMainFloor: 350.0
        )
    ]

    public struct SeabedTerraceSample {
        public let isPresent: Bool
        public let topY: Double
        public let bottomArchY: Double
        public let edgeFactor: Double
        public let caveFactor: Double
        public let slope: Double
        public let tierIndex: Int
        public let stripId: String
    }

    /// Samples any of the 9 continuous seabed terraces (tierIndex = 0..8).
    /// Where isPresent == false (and main floor is deep enough), caveFactor (0 -> 1) describes the downward-curved cave opening!
    public static func getSeabedTerraceAt(worldX: Double, tierIndex: Int = 0) -> SeabedTerraceSample {
        let clampedTier = max(0, min(seabedTerraceTiers.count - 1, tierIndex))
        let spec = seabedTerraceTiers[clampedTier]
        let mainFloor = getFloorDepthAt(worldX: worldX)
        if mainFloor < spec.baseDepth + spec.clearanceFromMainFloor {
            return SeabedTerraceSample(
                isPresent: false, topY: mainFloor, bottomArchY: mainFloor,
                edgeFactor: 0.0, caveFactor: 0.0, slope: 0.0,
                tierIndex: spec.tierIndex, stripId: spec.stripId
            )
        }

        let saltBase = spec.tierIndex * 131
        let warpedX = worldX + spec.phaseShift + noise1D(worldX * 0.00055, salt: 401 + saltBase) * 260.0
        let cellPhase = ((warpedX.truncatingRemainder(dividingBy: spec.period)) + spec.period).truncatingRemainder(dividingBy: spec.period) / spec.period
        let distFromGapCenter = abs(cellPhase - 0.5) * 2.0 // 0 at cave center, 1 at plateau center

        let relief = (noise1D(worldX * 0.0022, salt: 419 + saltBase) * 38.0
            + noise1D(worldX * 0.0068, salt: 431 + saltBase) * 14.0) * spec.reliefAmp
        let baseTopY = spec.baseDepth + relief
        let baseSlope = ((noise1D((worldX + 8.0) * 0.0022, salt: 419 + saltBase)
            - noise1D((worldX - 8.0) * 0.0022, salt: 419 + saltBase)) * 38.0 * spec.reliefAmp) / 16.0
        let gapSign: Double = cellPhase >= 0.5 ? 1.0 : -1.0
        let dDistDx: Double = (2.0 / spec.period) * gapSign

        // Inside the downward cave opening (shark can swim freely up & down through this portal!)
        if distFromGapCenter < spec.openDuty {
            let normCave = distFromGapCenter / spec.openDuty // 0 at center of opening, 1 at rim lip
            let caveArch = cos(normCave * .pi * 0.5)
            let dropOffset = spec.dropAmplitude + (1.0 - normCave * normCave) * (spec.dropAmplitude * 0.54)
            let dDropDx = -2.0 * normCave * (spec.dropAmplitude * 0.54) * (dDistDx / max(0.01, spec.openDuty))
            let caveFloorY = min(mainFloor - 24.0, baseTopY + dropOffset)
            let caveSlope = max(-2.4, min(2.4, baseSlope + dDropDx))
            return SeabedTerraceSample(
                isPresent: false,
                topY: caveFloorY,
                bottomArchY: min(mainFloor, caveFloorY + spec.thicknessBase * 0.92),
                edgeFactor: 0.0,
                caveFactor: caveArch,
                slope: caveSlope,
                tierIndex: spec.tierIndex,
                stripId: spec.stripId
            )
        }

        let rampSpan = 0.17
        let edgeFactor = min(1.0, (distFromGapCenter - spec.openDuty) / rampSpan)
        let smoothEdge = edgeFactor * edgeFactor * (3.0 - 2.0 * edgeFactor)
        let dSmoothEdgeDx = edgeFactor < 1.0
            ? (6.0 * edgeFactor * (1.0 - edgeFactor)) * (dDistDx / rampSpan)
            : 0.0
        let rimDrop = (1.0 - smoothEdge) * spec.dropAmplitude
        let dRimDropDx = -dSmoothEdgeDx * spec.dropAmplitude
        let topY = min(mainFloor - 36.0, baseTopY + rimDrop)
        let slope = max(-2.4, min(2.4, baseSlope + dRimDropDx))

        let archThickness = spec.thicknessBase + smoothEdge * (spec.thicknessBase * 0.44)
            + noise1D(worldX * 0.0038, salt: 443 + saltBase) * (28.0 * spec.reliefAmp)
        let bottomArchY = min(mainFloor, topY + archThickness)

        return SeabedTerraceSample(
            isPresent: true,
            topY: topY,
            bottomArchY: bottomArchY,
            edgeFactor: smoothEdge,
            caveFactor: 0.0,
            slope: slope,
            tierIndex: spec.tierIndex,
            stripId: spec.stripId
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

    /// Generates deterministic seabed outcrops along both the main seafloor AND all 9 seabed terraces
    public static func getSeabedOutcropsForChunk(chunkIndex: Int, chunkWidth: Double = 600.0) -> [SeabedOutcropPlacement] {
        var placements: [SeabedOutcropPlacement] = []
        let chunkStartX = Double(chunkIndex) * chunkWidth

        // 1. Main seafloor outcrops
        let count = 2 + Int(floor(hash1D(chunkIndex, salt: 811) * 2.0)) // 2 or 3 per chunk
        let slotSpan = chunkWidth / Double(count)

        for i in 0..<count {
            let h1 = hash1D(chunkIndex * 7 + i, salt: 823)
            let h2 = hash1D(chunkIndex * 13 + i, salt: 829)
            let h3 = hash1D(chunkIndex * 19 + i, salt: 839)
            let worldX = chunkStartX + (Double(i) + 0.18 + h1 * 0.64) * slotSpan
            let baseY = getFloorDepthAt(worldX: worldX)

            let type: SeabedOutcropType
            if baseY < 620.0 {
                type = h2 < 0.68 ? .CORAL_MOUND : .KELP_CLUSTER
            } else if baseY < 1350.0 {
                type = h2 < 0.45 ? .CORAL_MOUND : (h2 < 0.78 ? .ROCK_SPIRE : .KELP_CLUSTER)
            } else {
                type = h2 < 0.58 ? .ROCK_SPIRE : .ABYSSAL_CHIMNEY
            }

            let width: Double
            let height: Double
            switch type {
            case .CORAL_MOUND:
                width = 115.0 + h2 * 105.0
                height = 75.0 + h3 * 70.0
            case .KELP_CLUSTER:
                width = 90.0 + h2 * 70.0
                height = 130.0 + h3 * 110.0
            default:
                width = 110.0 + h2 * 95.0
                height = 95.0 + h3 * 95.0
            }

            placements.append(SeabedOutcropPlacement(
                worldX: worldX, baseY: baseY, width: width, height: height,
                type: type, variant: Int(floor(h3 * 4.0)), seed: h1
            ))
        }

        // 2. Multi-Tier Seabed Terrace Outcrops across all 9 tiers (tierIndex = 0..8)
        let terraceSlotCount = 2
        let terraceSlotSpan = chunkWidth / Double(terraceSlotCount)
        for tierIdx in 0..<seabedTerraceTiers.count {
            let saltOffset = tierIdx * 197
            for i in 0..<terraceSlotCount {
                let h1 = hash1D(chunkIndex * 11 + i, salt: 911 + saltOffset)
                if tierIdx >= 4 && h1 < 0.28 { continue }
                let h2 = hash1D(chunkIndex * 17 + i, salt: 919 + saltOffset)
                let h3 = hash1D(chunkIndex * 23 + i, salt: 929 + saltOffset)
                let worldX = chunkStartX + (Double(i) + 0.16 + h1 * 0.68) * terraceSlotSpan
                let terrace = getSeabedTerraceAt(worldX: worldX, tierIndex: tierIdx)
                if terrace.isPresent && terrace.edgeFactor > 0.35 {
                    let type: SeabedOutcropType
                    if tierIdx == 0 {
                        type = h2 < 0.74 ? .CORAL_MOUND : .KELP_CLUSTER
                    } else if tierIdx == 1 {
                        type = h2 < 0.50 ? .CORAL_MOUND : (h2 < 0.80 ? .ROCK_SPIRE : .KELP_CLUSTER)
                    } else if tierIdx <= 3 {
                        type = h2 < 0.30 ? .CORAL_MOUND : .ROCK_SPIRE
                    } else {
                        type = h2 < 0.56 ? .ROCK_SPIRE : .ABYSSAL_CHIMNEY
                    }

                    let sizeScale = 1.0 + Double(tierIdx) * 0.08
                    let width: Double
                    let height: Double
                    switch type {
                    case .CORAL_MOUND:
                        width = (120.0 + h2 * 105.0) * sizeScale
                        height = (78.0 + h3 * 68.0) * sizeScale
                    case .KELP_CLUSTER:
                        width = 88.0 + h2 * 64.0
                        height = 115.0 + h3 * 92.0
                    default:
                        width = (112.0 + h2 * 96.0) * sizeScale
                        height = (90.0 + h3 * 88.0) * sizeScale
                    }

                    placements.append(SeabedOutcropPlacement(
                        worldX: worldX, baseY: terrace.topY, width: width, height: height,
                        type: type, variant: Int(floor(h3 * 4.0)), seed: h1
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

    /// Physical Seabed Two-Way Collision Solver (Prevents swimming through the main seafloor or any of the 9 seabed terraces from above OR below!)
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
        let refPrevY = prevWorldY ?? (worldY - vy * 0.016)
        let clearance = entityRadius + clearancePadding

        // 1. Check all 9 seabed terraces (both landing on top AND bumping head against underside!)
        for tierIdx in 0..<seabedTerraceTiers.count {
            let terrace = getSeabedTerraceAt(worldX: worldX, tierIndex: tierIdx)
            guard terrace.isPresent && terrace.edgeFactor > 0.2 else { continue }
            let terraceTopMaxY = terrace.topY - clearance
            let terraceUndersideMinY = terrace.bottomArchY + clearance * 0.88
            let slabMidY = (terrace.topY + terrace.bottomArchY) * 0.5

            // Case 1A: Approaching or resting on TOP of this terrace from above
            if refPrevY <= slabMidY && worldY <= slabMidY + entityRadius * 0.6 {
                if worldY > terraceTopMaxY {
                    return SeabedCollisionResult(
                        y: terraceTopMaxY,
                        vy: min(0.0, vy * -0.15),
                        hitSeabed: true,
                        hitAtollUnderside: false,
                        floorY: terrace.topY,
                        slope: terrace.slope
                    )
                }
                return SeabedCollisionResult(
                    y: worldY, vy: vy, hitSeabed: false, hitAtollUnderside: false,
                    floorY: terrace.topY, slope: terrace.slope
                )
            }

            // Case 1B: Swimming UPWARD from below this terrace -> block upward penetration through the bedrock!
            if refPrevY > slabMidY && worldY < terraceUndersideMinY {
                return SeabedCollisionResult(
                    y: terraceUndersideMinY,
                    vy: max(0.0, vy * -0.2),
                    hitSeabed: false,
                    hitAtollUnderside: true,
                    floorY: mainFloorY,
                    slope: terrace.slope
                )
            }
        }

        // 2. Main continuous seafloor collision
        let maxAllowedY = mainFloorY - clearance
        if worldY > maxAllowedY {
            return SeabedCollisionResult(
                y: maxAllowedY,
                vy: min(0.0, vy * -0.15),
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

    /// Full 2D Kinetic Seabed Step with Sub-Stepping & Tangent Arc-Length Conservation (prevents tunneling and eliminates speed stacking along cave opening downward slopes)
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
            let targetX = stepPrevX + stepDx
            let targetY = stepPrevY + stepDy

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
                let prevColAtOldX = resolveSeabedCollision(
                    worldX: stepPrevX,
                    worldY: stepPrevY,
                    vy: curVy,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    prevWorldY: stepPrevY
                )
                if !prevColAtOldX.hitAtollUnderside && !prevColAtOldX.hitSeabed && abs(stepPrevY - col.y) > entityRadius * 0.42 {
                    curX = stepPrevX
                    curVx = 0.0
                    curY = max(stepPrevY, min(prevColAtOldX.y, stepPrevY + maxSubstepDist))
                } else {
                    let projectedX = stepPrevX + stepDx * tangentScale * 0.92
                    let secondCol = resolveSeabedCollision(
                        worldX: projectedX,
                        worldY: targetY,
                        vy: curVy,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        prevWorldY: stepPrevY
                    )
                    var nextStepX = projectedX
                    var nextStepY = secondCol.hitAtollUnderside ? secondCol.y : col.y
                    let actualSubDist = hypot(nextStepX - stepPrevX, nextStepY - stepPrevY)
                    if actualSubDist > maxSubstepDist && actualSubDist > 1e-6 && maxSubstepDist > 1e-6 {
                        let shrink = maxSubstepDist / actualSubDist
                        nextStepX = stepPrevX + (nextStepX - stepPrevX) * shrink
                        let clampedCol = resolveSeabedCollision(
                            worldX: nextStepX,
                            worldY: stepPrevY + (nextStepY - stepPrevY) * shrink,
                            vy: curVy,
                            entityRadius: entityRadius,
                            clearancePadding: clearancePadding,
                            prevWorldY: stepPrevY
                        )
                        nextStepY = clampedCol.hitAtollUnderside ? clampedCol.y : (stepPrevY + (nextStepY - stepPrevY) * shrink)
                    }
                    curX = nextStepX
                    curY = nextStepY
                    curVx = vx * tangentScale * 0.92
                    curVy = vy < 0.0 ? 0.0 : vy * tangentScale * 0.92
                }
            } else if col.hitSeabed {
                hitSeabed = true
                let isUphill = stepDx * col.slope < -1e-5
                let scaleFactor = isUphill ? tangentScale * 0.90 : tangentScale * 0.95
                let projectedX = stepPrevX + stepDx * scaleFactor
                let secondCol = resolveSeabedCollision(
                    worldX: projectedX,
                    worldY: targetY,
                    vy: curVy,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    prevWorldY: stepPrevY
                )
                var nextStepX = projectedX
                var nextStepY = secondCol.hitSeabed ? secondCol.y : col.y
                let maxAllowed = maxSubstepDist * (isUphill ? 0.92 : 1.0)
                let actualSubDist = hypot(nextStepX - stepPrevX, nextStepY - stepPrevY)
                if actualSubDist > maxAllowed && actualSubDist > 1e-6 && maxAllowed > 1e-6 {
                    let shrink = maxAllowed / actualSubDist
                    nextStepX = stepPrevX + (nextStepX - stepPrevX) * shrink
                    let clampedCol = resolveSeabedCollision(
                        worldX: nextStepX,
                        worldY: stepPrevY + (nextStepY - stepPrevY) * shrink,
                        vy: curVy,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        prevWorldY: stepPrevY
                    )
                    nextStepY = clampedCol.hitSeabed ? clampedCol.y : (stepPrevY + (nextStepY - stepPrevY) * shrink)
                }
                curX = nextStepX
                curY = nextStepY
                curVx = vx * scaleFactor
                curVy = vy > 0.0 ? 0.0 : vy * scaleFactor
            } else {
                curX = targetX
                curY = col.y
            }
        }

        let outSpeed = hypot(curVx, curVy)
        if outSpeed > intendedSpeed && outSpeed > 1e-6 {
            let s = intendedSpeed / outSpeed
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
`;
}

function generateSpriteAtlasManagerSwift(): string {
  return `import UIKit
import SpriteKit
import CoreGraphics
import SwiftUI

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
/// and ocean parallax layers on a background Task.detached thread with zero main-thread blocking.
@MainActor
public final class SpriteAtlasManager: ObservableObject {
    public static let shared = SpriteAtlasManager()

    @Published public private(set) var loadingProgress: Double = 0.0
    @Published public private(set) var loadingStageZh: String = "正在潜入深海基因库..."
    @Published public private(set) var loadingStageEn: String = "Diving into Abyssal Gene Bank..."
    @Published public private(set) var isReady: Bool = false

    private var sharkTextures: [String: SKTexture] = [:]
    private var sharkUIImages: [String: UIImage] = [:]
    private var preyTextures: [String: SKTexture] = [:]
    private var preyUIImages: [String: UIImage] = [:]
    private var uiIconImages: [String: UIImage] = [:]
    private var uiBannerImages: [String: UIImage] = [:]
    private var uiSettingImages: [String: UIImage] = [:]
    private var uiSettingIconImages: [String: UIImage] = [:]
    private var oceanLayerTextures: [String: SKTexture] = [:]
    private var seabedStripTextures: [String: SKTexture] = [:]
    private var seabedSubStratumTextures: [String: SKTexture] = [:]
    private var ecologySpriteTextures: [String: SKTexture] = [:]
    private var poiSpriteTextures: [String: SKTexture] = [:]
    private var cavePortalShadowTex: SKTexture?

    private var cachedLoadingBg: UIImage?
    private var cachedLoadingLogo: UIImage?
    private var cachedLoadingMascot: UIImage?

    private var isPreloaded = false
    private var isPreloading = false

    public private(set) var avatarBarHollowMetrics = AvatarBarHollowMetrics(
        cxPct: 23.0,
        cyPct: 48.0,
        innerDiaPctH: 48.0,
        outerDiaPctH: 60.0,
        aspectRatio: 2.85
    )

    private init() {}

    // MARK: - Scheme A Hot-Replaceable Startup Loading Assets (Instant, Zero Atlas Wait)
    /// Convention: Replace \`loading_background.png\`, \`loading_logo.png\`, or \`loading_mascot.png\` in Resources/Assets
    /// to reskin holiday/festival loading screens without modifying any Swift code.
    public func loadingBackgroundImage() -> UIImage? {
        if let cached = cachedLoadingBg { return cached }
        let img = Self.loadBundledImage(named: "loading_background")
        cachedLoadingBg = img
        return img
    }

    public func loadingLogoImage() -> UIImage? {
        if let cached = cachedLoadingLogo { return cached }
        let img = Self.loadBundledImage(named: "loading_logo") ?? titleLogoImage()
        cachedLoadingLogo = img
        return img
    }

    public func loadingMascotImage() -> UIImage? {
        if let cached = cachedLoadingMascot { return cached }
        if let raw = Self.loadBundledImage(named: "loading_mascot") ?? Self.loadBundledImage(named: "shark_form_00@3x"),
           let cg = raw.cgImage {
            let img = UIImage(cgImage: cg, scale: 3.0, orientation: .up)
            cachedLoadingMascot = img
            return img
        }
        return nil
    }

    /// Launches asynchronous off-main-thread texture decoding, sprite sheet slicing & Metal GPU warm-up.
    /// Keeps the main thread 100% free on frame 1 so \`StartupLoadingView\` renders immediately at 60/120fps.
    public func startAsyncPreloadIfNeeded() {
        if isPreloaded {
            if !isReady { isReady = true }
            return
        }
        guard !isPreloading else { return }
        isPreloading = true
        loadingProgress = 0.04
        loadingStageZh = "正在唤醒 48 阶深海巨鲨..."
        loadingStageEn = "Awakening 48 Abyssal Sharks..."

        Task.detached(priority: .userInitiated) {
            // Stage 1 (0.04 -> 0.36): Decode 48 @3x Shark PNGs (with sheet fallback if any file is absent)
            var localSharkUI: [String: UIImage] = [:]
            var localSharkTex: [String: SKTexture] = [:]
            var missingForms: [SharkFormConfig] = []
            let allForms = GameConfigGenerated.sharkForms
            let totalSharks = max(1, allForms.count)

            for (idx, form) in allForms.enumerated() {
                let baseName = String(format: "shark_form_%02d", form.index)
                if let rawImg = Self.loadBundledImage(named: "\\(baseName)@3x") ?? Self.loadBundledImage(named: baseName),
                   let cg = rawImg.cgImage {
                    let img3x = UIImage(cgImage: cg, scale: 3.0, orientation: .up)
                    localSharkUI[form.spriteKey] = img3x
                    let tex = SKTexture(image: img3x)
                    tex.filteringMode = .linear
                    localSharkTex[form.spriteKey] = tex
                } else {
                    missingForms.append(form)
                }

                if idx % 8 == 7 || idx == totalSharks - 1 {
                    let prog = 0.04 + (Double(idx + 1) / Double(totalSharks)) * 0.32
                    await MainActor.run {
                        self.loadingProgress = max(self.loadingProgress, prog)
                    }
                }
            }

            if !missingForms.isEmpty, let sharkSheet = Self.loadBundledImage(named: "sharks_ec921c3b") {
                for form in missingForms {
                    if let sliced = Self.sliceAndKeyNormalizedCell(
                        from: sharkSheet,
                        bounds: form.normalizedBounds,
                        preserveInteriorWhite: true
                    ) {
                        localSharkUI[form.spriteKey] = sliced
                        let tex = SKTexture(image: sliced)
                        tex.filteringMode = .linear
                        localSharkTex[form.spriteKey] = tex
                    }
                }
            }

            let committedSharkUI = localSharkUI
            let committedSharkTex = localSharkTex
            await MainActor.run {
                self.sharkUIImages.merge(committedSharkUI) { _, new in new }
                self.sharkTextures.merge(committedSharkTex) { _, new in new }
                self.loadingProgress = 0.38
                self.loadingStageZh = "正在演化深海生态鱼群..."
                self.loadingStageEn = "Spawning Marine Ecosystem..."
            }

            // Stage 2 (0.38 -> 0.56): Load @3x Prey PNGs first, fallback to slicing fish_24bdaa5a.png & fish2_fc857cfa.png
            var localPreyUI: [String: UIImage] = [:]
            var localPreyTex: [String: SKTexture] = [:]
            let primarySheet = Self.loadBundledImage(named: "fish_24bdaa5a")
            let fish2Sheet = Self.loadBundledImage(named: "fish2_fc857cfa")
            let allPreys = GameConfigGenerated.preyTiers
            let totalPreys = max(1, allPreys.count)

            for (idx, prey) in allPreys.enumerated() {
                if localPreyTex[prey.spriteKey] != nil { continue }
                if let raw3x = Self.loadBundledImage(named: "prey_\\(prey.id)@3x") ?? Self.loadBundledImage(named: "prey_\\(prey.id)"),
                   let cg3x = raw3x.cgImage {
                    let img3x = UIImage(cgImage: cg3x, scale: 3.0, orientation: .up)
                    localPreyUI[prey.spriteKey] = img3x
                    let tex = SKTexture(image: img3x)
                    tex.filteringMode = .linear
                    localPreyTex[prey.spriteKey] = tex
                } else {
                    let srcImg = prey.sheetName == "fish2_fc857cfa" ? fish2Sheet : primarySheet
                    if let img = srcImg,
                       let sliced = Self.sliceAndKeyNormalizedCell(
                           from: img,
                           bounds: prey.normalizedBounds,
                           preserveInteriorWhite: false
                       ) {
                        localPreyUI[prey.spriteKey] = sliced
                        let tex = SKTexture(image: sliced)
                        tex.filteringMode = .linear
                        localPreyTex[prey.spriteKey] = tex
                    }
                }
                if idx % 8 == 7 || idx == totalPreys - 1 {
                    let prog = 0.38 + (Double(idx + 1) / Double(totalPreys)) * 0.18
                    await MainActor.run {
                        self.loadingProgress = max(self.loadingProgress, prog)
                    }
                }
            }

            let committedPreyUI = localPreyUI
            let committedPreyTex = localPreyTex
            await MainActor.run {
                self.preyUIImages = committedPreyUI
                self.preyTextures = committedPreyTex
                self.loadingProgress = 0.56
                self.loadingStageZh = "正在校准深海声呐与装甲界面..."
                self.loadingStageEn = "Calibrating Sonar & HUD..."
            }

            // Stage 3 (0.56 -> 0.72): Slice UI Icon Sheet, Banner Sheet & Setting Sheet
            let localIcons: [String: UIImage]
            if let iconSheet = Self.loadBundledImage(named: "icons_f5128c12") {
                localIcons = Self.sliceUiIconSheet(iconSheet)
            } else {
                localIcons = [:]
            }
            await MainActor.run {
                self.uiIconImages = localIcons
                self.loadingProgress = 0.62
            }

            let bannerResult: (images: [String: UIImage], metrics: AvatarBarHollowMetrics?)
            if let bannerSheet = Self.loadBundledImage(named: "buttons_16e3a0cf") {
                bannerResult = Self.sliceUiBannerSheet(bannerSheet)
            } else {
                bannerResult = ([:], nil)
            }
            await MainActor.run {
                self.uiBannerImages = bannerResult.images
                if let m = bannerResult.metrics {
                    self.avatarBarHollowMetrics = m
                }
                self.loadingProgress = 0.67
            }

            let settingResult: (images: [String: UIImage], icons: [String: UIImage])
            if let settingSheet = Self.loadBundledImage(named: "setting_83a7a273") {
                settingResult = Self.sliceUiSettingSheet(settingSheet)
            } else {
                settingResult = ([:], [:])
            }
            await MainActor.run {
                self.uiSettingImages = settingResult.images
                self.uiSettingIconImages = settingResult.icons
                self.loadingProgress = 0.72
                self.loadingStageZh = "正在构建 9 阶深海海床与珊瑚地貌..."
                self.loadingStageEn = "Building 9-Tier Seabed & Coral Reefs..."
            }

            // Stage 4 (0.72 -> 0.94): Process Water Canopies + World Seabed Strips + Subsurface Bedrock Strata + Ecology & POI Atlases
            let waterCanopies: [String] = [
                "bg_shallow_0_water_0e65cb68",
                "bg_twilight_0_17bcb84c",
                "bg_abyss_0_1bbf506a"
            ]
            var localOceanTex: [String: SKTexture] = [:]
            for (idx, waterName) in waterCanopies.enumerated() {
                if let rawImg = Self.loadBundledImage(named: waterName) {
                    let processed = Self.processWaterLayerToSeamlessTile(rawImg, assetName: waterName) ?? rawImg
                    let tex = SKTexture(image: processed)
                    tex.filteringMode = .linear
                    localOceanTex[waterName] = tex
                }
                let prog = 0.72 + (Double(idx + 1) / Double(waterCanopies.count)) * 0.06
                let partialOcean = localOceanTex
                await MainActor.run {
                    self.oceanLayerTextures = partialOcean
                    self.loadingProgress = max(self.loadingProgress, prog)
                }
            }

            // Load 4 Standalone High-Res Realistic Transparent Seabed PNGs (no multi-row sprite sheet slicing)
            var localSeabedStrips: [String: SKTexture] = [:]
            var localSeabedSubStrata: [String: SKTexture] = [:]
            let standaloneSeabedDefs: [(id: String, assetName: String)] = [
                ("coral_reef", "seabed_strip_coral_reef"),
                ("rocky_shelf", "seabed_strip_rocky_shelf"),
                ("underwater_canyon", "seabed_strip_underwater_canyon"),
                ("deep_abyss", "seabed_strip_deep_abyss")
            ]
            for def in standaloneSeabedDefs {
                if let standaloneImg = Self.loadBundledImage(named: def.assetName) {
                    if let stripImg = Self.sliceSeabedStrip(from: standaloneImg, y0Ratio: 0.0, y1Ratio: 1.0) {
                        let tex = SKTexture(image: stripImg)
                        tex.filteringMode = .linear
                        localSeabedStrips[def.id] = tex
                    }
                    if let subImg = Self.sliceSeabedSubStratum(from: standaloneImg, stripId: def.id, y0Ratio: 0.0, y1Ratio: 1.0) {
                        let subTex = SKTexture(image: subImg)
                        subTex.filteringMode = .linear
                        localSeabedSubStrata[def.id] = subTex
                    }
                }
            }
            let committedStrips = localSeabedStrips
            let committedSubStrata = localSeabedSubStrata
            await MainActor.run {
                self.seabedStripTextures = committedStrips
                self.seabedSubStratumTextures = committedSubStrata
                self.loadingProgress = max(self.loadingProgress, 0.85)
            }

            // Load 4 Standalone High-Res (@3x) Realistic Transparent Ecology PNGs (no 4x4 sprite sheet slicing) & 10 POI Sprites
            var localEcologyTex: [String: SKTexture] = [:]
            let standaloneEcologyDefs: [(prefix: String, assetName: String)] = [
                ("coral", "ecology_coral_reef_cluster"),
                ("rock", "ecology_rocky_outcrop"),
                ("kelp", "ecology_kelp_forest_cluster"),
                ("vent", "ecology_abyssal_vent_debris")
            ]
            for def in standaloneEcologyDefs {
                if let ecoImg = Self.loadBundledImage(named: def.assetName) {
                    let tex = SKTexture(image: ecoImg)
                    tex.filteringMode = .linear
                    localEcologyTex[def.prefix] = tex
                    for idx in 1...4 {
                        localEcologyTex["\\(def.prefix)_\\(idx)"] = tex
                    }
                }
            }
            var localPoiTex: [String: SKTexture] = [:]
            if let poiSheet = Self.loadBundledImage(named: "world_pois_atlas_1794473250443") {
                localPoiTex = Self.sliceWorldPoisAtlas(from: poiSheet)
            }
            let portalShadow = Self.makeCavePortalShadowTexture()
            let committedEco = localEcologyTex
            let committedPoi = localPoiTex
            await MainActor.run {
                self.ecologySpriteTextures = committedEco
                self.poiSpriteTextures = committedPoi
                self.cavePortalShadowTex = portalShadow
                self.loadingProgress = max(self.loadingProgress, 0.94)
            }

            // Stage 5 (0.94 -> 1.00): Metal GPU Texture Preload & Smooth Fade-Out
            await MainActor.run {
                self.loadingProgress = 0.95
                self.loadingStageZh = "正在预热 Metal GPU 渲染管线..."
                self.loadingStageEn = "Warming Metal GPU Pipeline..."

                let allGpuTextures = Array(self.sharkTextures.values)
                    + Array(self.preyTextures.values)
                    + Array(self.oceanLayerTextures.values)
                    + Array(self.seabedStripTextures.values)
                    + Array(self.seabedSubStratumTextures.values)
                    + Array(self.ecologySpriteTextures.values)
                    + Array(self.poiSpriteTextures.values)

                SKTexture.preload(allGpuTextures) {
                    Task { @MainActor in
                        self.loadingProgress = 1.0
                        self.loadingStageZh = "深海猎场已就绪！"
                        self.loadingStageEn = "Abyssal Hunting Grounds Ready!"
                        self.isPreloaded = true
                        self.isPreloading = false
                        try? await Task.sleep(nanoseconds: 140_000_000)
                        withAnimation(.easeInOut(duration: 0.45)) {
                            self.isReady = true
                        }
                    }
                }
            }
        }
    }

    public func preloadAllIfNeeded() {
        startAsyncPreloadIfNeeded()
    }

    /// Fast single-shark on-demand loader (<1ms) if queried before full background preload finishes
    private func loadSingleSharkOnDemand(for spriteKey: String) {
        guard sharkTextures[spriteKey] == nil else { return }
        guard let form = GameConfigGenerated.sharkForms.first(where: { $0.id == spriteKey || $0.spriteKey == spriteKey }) else { return }
        let baseName = String(format: "shark_form_%02d", form.index)
        if let rawImg = Self.loadBundledImage(named: "\\(baseName)@3x") ?? Self.loadBundledImage(named: baseName),
           let cg = rawImg.cgImage {
            let img3x = UIImage(cgImage: cg, scale: 3.0, orientation: .up)
            sharkUIImages[form.spriteKey] = img3x
            let tex = SKTexture(image: img3x)
            tex.filteringMode = .linear
            sharkTextures[form.spriteKey] = tex
        }
    }

    public func sharkTexture(for spriteKey: String) -> SKTexture? {
        if let tex = sharkTextures[spriteKey] { return tex }
        loadSingleSharkOnDemand(for: spriteKey)
        return sharkTextures[spriteKey]
    }

    public func sharkUIImage(for spriteKey: String) -> UIImage? {
        if let img = sharkUIImages[spriteKey] { return img }
        loadSingleSharkOnDemand(for: spriteKey)
        return sharkUIImages[spriteKey]
    }

    public func preyTexture(for spriteKey: String) -> SKTexture? {
        return preyTextures[spriteKey]
    }

    public func preyUIImage(for spriteKey: String) -> UIImage? {
        return preyUIImages[spriteKey]
    }

    public func uiIconImage(for key: String) -> UIImage? {
        return uiIconImages[key]
    }

    public func uiBannerImage(for key: String) -> UIImage? {
        return uiBannerImages[key]
    }

    public func uiSettingImage(for key: String) -> UIImage? {
        return uiSettingImages[key]
    }

    public func uiSettingIconImage(for key: String) -> UIImage? {
        return uiSettingIconImages[key]
    }

    public func titleLogoImage() -> UIImage? {
        return Self.loadBundledImage(named: "title3_cae0290c")
            ?? Self.loadBundledImage(named: "title2_dbfd9f83")
            ?? Self.loadBundledImage(named: "title_11de9fff")
    }

    public func oceanParallaxTexture(named assetName: String, isWaterCanopy: Bool = false) -> SKTexture? {
        return oceanLayerTextures[assetName]
    }

    public func seabedStripTexture(for stripId: String) -> SKTexture? {
        return seabedStripTextures[stripId] ?? seabedStripTextures["coral_reef"]
    }

    public func seabedSubStratumTexture(for stripId: String) -> SKTexture? {
        return seabedSubStratumTextures[stripId] ?? seabedSubStratumTextures["coral_reef"]
    }

    public func ecologySpriteTexture(for id: String) -> SKTexture? {
        return ecologySpriteTextures[id]
    }

    public func poiSpriteTexture(for id: String) -> SKTexture? {
        return poiSpriteTextures[id]
    }

    public func cavePortalShadowTexture() -> SKTexture? {
        if let tex = cavePortalShadowTex { return tex }
        let tex = Self.makeCavePortalShadowTexture()
        cavePortalShadowTex = tex
        return tex
    }

    nonisolated private static func loadBundledImage(named name: String) -> UIImage? {
        var cleanBase = name
        if cleanBase.hasSuffix(".png") {
            cleanBase = String(cleanBase.dropLast(4))
        } else if cleanBase.hasSuffix(".jpg") {
            cleanBase = String(cleanBase.dropLast(4))
        } else if cleanBase.hasSuffix(".jpeg") {
            cleanBase = String(cleanBase.dropLast(5))
        }
        let exts = ["png", "jpg", "jpeg"]
        let roots: [URL] = [Bundle.main.resourceURL, Bundle.main.bundleURL].compactMap { $0 }
        for root in roots {
            for ext in exts {
                let candidates = [
                    root.appendingPathComponent("Assets/\\(cleanBase).\\(ext)"),
                    root.appendingPathComponent("Assets/\\(cleanBase)@3x.\\(ext)"),
                    root.appendingPathComponent("Resources/Assets/\\(cleanBase).\\(ext)"),
                    root.appendingPathComponent("Resources/Assets/\\(cleanBase)@3x.\\(ext)"),
                    root.appendingPathComponent("\\(cleanBase).\\(ext)"),
                    root.appendingPathComponent("\\(cleanBase)@3x.\\(ext)")
                ]
                for url in candidates {
                    if FileManager.default.fileExists(atPath: url.path),
                       let img = UIImage(contentsOfFile: url.path) {
                        return img
                    }
                }
            }
        }
        for ext in exts {
            if let path = Bundle.main.path(forResource: cleanBase, ofType: ext),
               let img = UIImage(contentsOfFile: path) {
                return img
            }
            if let path = Bundle.main.path(forResource: cleanBase, ofType: ext, inDirectory: "Assets"),
               let img = UIImage(contentsOfFile: path) {
                return img
            }
            if let path = Bundle.main.path(forResource: "\\(cleanBase)@3x", ofType: ext),
               let img = UIImage(contentsOfFile: path) {
                return img
            }
            if let path = Bundle.main.path(forResource: "\\(cleanBase)@3x", ofType: ext, inDirectory: "Assets"),
               let img = UIImage(contentsOfFile: path) {
                return img
            }
        }
        if let img = UIImage(named: cleanBase) { return img }
        return nil
    }

    /// Slices the 6x4 UI Icon Sheet (icons_f5128c12.png) with center hollow seed for UI_AVATAR_FRAME & UI_JOYSTICK_BASE
    /// and tight bounding-box aspect-fit normalization into a 128x128 square UIImage.
    nonisolated private static func sliceUiIconSheet(_ sheetImage: UIImage) -> [String: UIImage] {
        var outIcons: [String: UIImage] = [:]
        guard let cgSheet = sheetImage.cgImage else { return outIcons }
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
                    let normImg = renderer.image { _ in
                        UIImage(cgImage: tightCG).draw(in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
                    }
                    outIcons[key] = normImg
                    continue
                }
            }
            outIcons[key] = UIImage(cgImage: keyedCG)
        }
        return outIcons
    }

    /// Slices the Banner & Avatar Plate Sheet (buttons_16e3a0cf.png)
    /// Neutral dark grey background (~RGB 60,60,60), hollowing out the circular shark window in UI_PLATE_AVATAR_BAR.
    nonisolated private static func sliceUiBannerSheet(_ sheetImage: UIImage) -> (images: [String: UIImage], metrics: AvatarBarHollowMetrics?) {
        var outBanners: [String: UIImage] = [:]
        var outMetrics: AvatarBarHollowMetrics? = nil
        guard let cgSheet = sheetImage.cgImage else { return (outBanners, outMetrics) }
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
                    outMetrics = AvatarBarHollowMetrics(
                        cxPct: CGFloat(holeCx * 100.0),
                        cyPct: CGFloat(holeCy * 100.0),
                        innerDiaPctH: CGFloat(holeInnerDia * 100.0),
                        outerDiaPctH: CGFloat(holeOuterDia * 100.0),
                        aspectRatio: CGFloat(Double(bw) / Double(bh))
                    )
                }

                if let tightCG = keyedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    outBanners[key] = UIImage(cgImage: tightCG)
                    continue
                }
            }
            outBanners[key] = UIImage(cgImage: keyedCG)
        }
        return (outBanners, outMetrics)
    }

    /// Slices the Pause / Settings / GameOver Modal & Button Sheet (setting_83a7a273.png)
    /// Includes inner window hollowing for SETTING_MODAL_FRAME, clean medallion variant SETTING_MODAL_FRAME_CLEAN,
    /// 5-slice horizontal widening for SETTING_SHARK_CARD (4.80:1), and icon extraction + scanline patching for SETTING_BTN_*.
    nonisolated private static func sliceUiSettingSheet(_ sheetImage: UIImage) -> (images: [String: UIImage], icons: [String: UIImage]) {
        var outImages: [String: UIImage] = [:]
        var outIcons: [String: UIImage] = [:]
        guard let cgSheet = sheetImage.cgImage else { return (outImages, outIcons) }
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
                    outIcons[key] = renderer.image { _ in
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
                outImages[key] = wideImg
                continue
            }

            outImages[key] = UIImage(cgImage: tightCG)

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
                    outImages["SETTING_MODAL_FRAME_CLEAN"] = UIImage(cgImage: cleanTightCG)
                }
            }
        }
        return (outImages, outIcons)
    }

    /// CoreGraphics Perimeter BFS Flood-Fill + Boundary Color-to-Alpha White Unmixing
    nonisolated private static func sliceAndKeyNormalizedCell(
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
    nonisolated private static func makeHorizontallySeamlessImage(
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
    nonisolated private static func processWaterLayerToSeamlessTile(_ image: UIImage, assetName: String) -> UIImage? {
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
        } else {
            // Soft vertical atmospheric envelope for deep-water backdrops (bg_twilight_0 & bg_abyss_0)
            // so they act as delicate volumetric light/ember veils rather than opaque full-screen wallpaper swaps
            for y in 0..<h {
                let v = Double(y) / Double(max(1, h - 1))
                let topEnv = v < 0.08 ? (0.65 + 0.35 * sin((v / 0.08) * .pi * 0.5)) : 1.0
                let botEnv = v <= 0.62 ? 1.0 : (0.16 + 0.84 * pow(cos(((v - 0.62) / 0.38) * .pi * 0.5), 1.5))
                let envAlpha = topEnv * botEnv
                let rowOff = y * w
                for x in 0..<w {
                    let idx = (rowOff + x) * 4
                    rgba[idx] = UInt8(max(0.0, min(255.0, (Double(rgba[idx]) * envAlpha).rounded())))
                    rgba[idx + 1] = UInt8(max(0.0, min(255.0, (Double(rgba[idx + 1]) * envAlpha).rounded())))
                    rgba[idx + 2] = UInt8(max(0.0, min(255.0, (Double(rgba[idx + 2]) * envAlpha).rounded())))
                    rgba[idx + 3] = UInt8(max(0.0, min(255.0, (Double(rgba[idx + 3]) * envAlpha).rounded())))
                }
            }
        }

        return makeHorizontallySeamlessImage(rgba: rgba, width: w, height: h, seamRatio: isShallowCanopy ? 0.10 : 0.14)
    }

    /// Processes Far / Mid / Near Ocean Terrain Layers ('bg_{zone}_{1|2|3}') with 1:1 parity to 'parallaxBackground.ts':
    nonisolated private static func processTerrainLayerToSeamlessStrip(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height

        let isShallowFar = assetName.contains("shallow_1_far")
        let isShallowMid = assetName.contains("shallow_2_mid")
        let isShallowNear = assetName.contains("shallow_3_near")
        let unmixHydrothermalSmoke = assetName.contains("abyss_2") || assetName.contains("abyss_3")


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

        // 3B. Unmix soft grey/black hydrothermal smoke plumes painted over #FFFFFF sky on bg_abyss_2 & bg_abyss_3
        // while 100% preserving red-and-white tube worms in the lower volcanic bed (1:1 parity with Web parallaxBackground.ts)
        if unmixHydrothermalSmoke {
            let smokeMaxY = Int(Double(h) * 0.64)
            var smokeVisited = [UInt8](repeating: 0, count: w * h)
            var sHead = 0
            var sTail = 0

            func isSmokeMistCandidate(_ i: Int, _ y: Int) -> Bool {
                if y >= smokeMaxY { return false }
                let p = i * 4
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let minC = min(r, min(g, b))
                let maxC = max(r, max(g, b))
                return minC >= 78 && (maxC - minC) <= 32
            }

            for y in 0..<min(h, smokeMaxY) {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 {
                        smokeVisited[i] = 1
                        queue[sTail] = i
                        sTail += 1
                    }
                }
            }

            while sHead < sTail {
                let curr = queue[sHead]
                sHead += 1
                let cx = curr % w
                let cy = (curr - cx) / w
                let neighbors = [
                    cx > 0 ? curr - 1 : -1,
                    cx + 1 < w ? curr + 1 : -1,
                    cy > 0 ? curr - w : -1,
                    cy + 1 < smokeMaxY ? curr + w : -1
                ]
                for n in neighbors where n >= 0 && smokeVisited[n] == 0 {
                    let ny = n / w
                    if isSmokeMistCandidate(n, ny) {
                        smokeVisited[n] = 1
                        queue[sTail] = n
                        sTail += 1
                    }
                }
            }

            let fadeStartY = Double(h) * 0.52
            let fadeSpan = max(1.0, Double(smokeMaxY) - fadeStartY)
            for y in 0..<min(h, smokeMaxY) {
                let vertFade = Double(y) < fadeStartY ? 1.0 : max(0.0, (Double(smokeMaxY) - Double(y)) / fadeSpan)
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if smokeVisited[i] == 0 || visited[i] != 0 { continue }
                    let p = i * 4
                    let r = Double(rgba[p])
                    let g = Double(rgba[p + 1])
                    let b = Double(rgba[p + 2])
                    let minC = min(r, min(g, b))
                    if minC >= 212.0 {
                        visited[i] = 1
                        rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
                    } else {
                        let rawSmokeAlpha = max(0.0, min(1.0, (212.0 - minC) / (212.0 - 78.0)))
                        let smokeAlpha = pow(rawSmokeAlpha, 1.2) * 0.92
                        let effAlpha = (1.0 - vertFade) + vertFade * smokeAlpha
                        let outA = Double(rgba[p + 3]) * effAlpha
                        if outA < 8.0 {
                            visited[i] = 1
                            rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
                        } else {
                            let targetR = r * (1.0 - vertFade) + 22.0 * vertFade
                            let targetG = g * (1.0 - vertFade) + 24.0 * vertFade
                            let targetB = b * (1.0 - vertFade) + 28.0 * vertFade
                            let aNorm = outA / 255.0
                            rgba[p] = UInt8(max(0.0, min(255.0, (targetR * aNorm).rounded())))
                            rgba[p + 1] = UInt8(max(0.0, min(255.0, (targetG * aNorm).rounded())))
                            rgba[p + 2] = UInt8(max(0.0, min(255.0, (targetB * aNorm).rounded())))
                            rgba[p + 3] = UInt8(max(0.0, min(255.0, outA.rounded())))
                        }
                    }
                }
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

    /// Slices one of the 4 horizontal seabed surface bands from world_seabed_strips_1794473245165.jpg,
    /// removes the top #FFFFFF background via top-edge BFS flood-fill, grounds the base, and cross-fades horizontally.
    nonisolated private static func sliceSeabedStrip(from image: UIImage, y0Ratio: Double, y1Ratio: Double) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let fullW = cgImg.width
        let fullH = cgImg.height
        let sy = max(0, Int((Double(fullH) * y0Ratio).rounded()))
        let ey = min(fullH, Int((Double(fullH) * y1Ratio).rounded()))
        let rawH = max(32, ey - sy)
        let padX = max(2, Int((Double(fullW) * 0.008).rounded()))
        let rawW = max(64, fullW - padX * 2)

        guard let croppedCG = cgImg.cropping(to: CGRect(x: padX, y: sy, width: rawW, height: rawH)) else {
            return nil
        }

        let w = rawW
        let h = rawH
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

        var visited = [UInt8](repeating: 0, count: w * h)
        var queue = [Int](repeating: 0, count: w * h)
        var qHead = 0
        var qTail = 0

        func isBg(_ i: Int) -> Bool {
            let p = i * 4
            let r = Int(rgba[p])
            let g = Int(rgba[p + 1])
            let b = Int(rgba[p + 2])
            let minC = min(r, min(g, b))
            let maxC = max(r, max(g, b))
            return minC >= 205 && (maxC - minC) <= 42
        }

        func push(_ x: Int, _ y: Int) {
            if x < 0 || x >= w || y < 0 || y >= Int(Double(h) * 0.82) { return }
            let i = y * w + x
            if visited[i] != 0 || !isBg(i) { return }
            visited[i] = 1
            queue[qTail] = i
            qTail += 1
        }

        for x in 0..<w {
            push(x, 0)
            push(x, 1)
        }
        for y in 0..<Int(Double(h) * 0.45) {
            push(0, y)
            push(w - 1, y)
        }

        while qHead < qTail {
            let curr = queue[qHead]
            qHead += 1
            let cx = curr % w
            let cy = (curr - cx) / w
            if cx > 0 { push(cx - 1, cy) }
            if cx + 1 < w { push(cx + 1, cy) }
            if cy > 0 { push(cx, cy - 1) }
            if cy + 1 < h { push(cx, cy + 1) }
        }

        for i in 0..<(w * h) where visited[i] != 0 {
            let p = i * 4
            rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
        }

        // Feather top silhouette edge (2px despill)
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
                        if minC > 165.0 {
                            let keep = max(0.0, min(1.0, (235.0 - minC) / 70.0))
                            rgba[p] = UInt8((r * 0.72 * keep).rounded())
                            rgba[p + 1] = UInt8((g * 0.76 * keep).rounded())
                            rgba[p + 2] = UInt8((b * 0.82 * keep).rounded())
                            rgba[p + 3] = UInt8((Double(rgba[p + 3]) * keep).rounded())
                        }
                    }
                }
            }
        }

        // Ground lower 42% of each column so seabed base is 100% solid
        let minSearchY = max(4, Int(Double(h) * 0.58))
        for x in 0..<w {
            var lastSolidY = -1
            for y in stride(from: h - 1, through: minSearchY, by: -1) {
                let p = (y * w + x) * 4
                let r = Int(rgba[p]), g = Int(rgba[p + 1]), b = Int(rgba[p + 2])
                let minC = min(r, min(g, b))
                let maxC = max(r, max(g, b))
                if rgba[p + 3] > 200 && !(minC >= 205 && (maxC - minC) <= 40) {
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

        var minY = h - 1
        var maxY = 0
        for y in 0..<h {
            var opaqueCount = 0
            let rowOff = y * w
            for x in stride(from: 0, to: w, by: 2) {
                if rgba[(rowOff + x) * 4 + 3] > 32 {
                    opaqueCount += 1
                }
            }
            if opaqueCount >= 6 {
                if y < minY { minY = y }
                if y > maxY { maxY = y }
            }
        }
        if maxY <= minY + 16 {
            minY = 0; maxY = h - 1
        } else {
            minY = max(0, minY - 2)
            maxY = min(h - 1, max(minY + 24, maxY - 2))
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

        return makeHorizontallySeamlessImage(rgba: croppedRgba, width: w, height: cropH, seamRatio: 0.14)
    }

    /// Builds a 100% opaque, horizontally & vertically seamless subsurface bedrock stratum tile
    /// from the lower 58% of each seabed band in world_seabed_strips_1794473245165.jpg (1:1 parity with Web sliceSeabedSubStratum).
    nonisolated private static func sliceSeabedSubStratum(
        from image: UIImage,
        stripId: String,
        y0Ratio: Double,
        y1Ratio: Double
    ) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let fullW = cgImg.width
        let fullH = cgImg.height
        let bandSpan = y1Ratio - y0Ratio
        let subY0 = y0Ratio + bandSpan * 0.42
        let subY1 = y1Ratio - bandSpan * 0.02
        let sy = max(0, Int((Double(fullH) * subY0).rounded()))
        let ey = min(fullH, Int((Double(fullH) * subY1).rounded()))
        let rawH = max(32, ey - sy)
        let padX = max(2, Int((Double(fullW) * 0.01).rounded()))
        let rawW = max(64, fullW - padX * 2)

        guard let croppedCG = cgImg.cropping(to: CGRect(x: padX, y: sy, width: rawW, height: rawH)) else {
            return nil
        }

        let w = rawW
        let h = rawH
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

        let fallbackRGB: (Double, Double, Double)
        switch stripId {
        case "coral_reef": fallbackRGB = (42.0, 36.0, 48.0)
        case "rocky_shelf": fallbackRGB = (28.0, 38.0, 54.0)
        case "underwater_canyon": fallbackRGB = (34.0, 26.0, 44.0)
        default: fallbackRGB = (18.0, 16.0, 28.0)
        }

        for x in 0..<w {
            var validR = fallbackRGB.0
            var validG = fallbackRGB.1
            var validB = fallbackRGB.2
            for y in stride(from: h - 1, through: 0, by: -1) {
                let p = (y * w + x) * 4
                let r = Double(rgba[p]), g = Double(rgba[p + 1]), b = Double(rgba[p + 2])
                let minC = min(r, min(g, b))
                let maxC = max(r, min(g, b))
                if rgba[p + 3] > 210 && !(minC >= 185.0 && (maxC - minC) <= 45.0) {
                    validR = r * 0.72
                    validG = g * 0.74
                    validB = b * 0.78
                    break
                }
            }

            for y in 0..<h {
                let p = (y * w + x) * 4
                var r = Double(rgba[p]), g = Double(rgba[p + 1]), b = Double(rgba[p + 2])
                let minC = min(r, min(g, b))
                let maxC = max(r, max(g, b))
                if rgba[p + 3] < 220 || (minC >= 180.0 && (maxC - minC) <= 48.0) {
                    r = validR
                    g = validG
                    b = validB
                } else {
                    validR = r * 0.85 + validR * 0.15
                    validG = g * 0.85 + validG * 0.15
                    validB = b * 0.85 + validB * 0.15
                }

                let vRatio = Double(y) / Double(max(1, h - 1))
                let strataWave = sin(vRatio * .pi * 6.0 + Double(x) * 0.035) * 0.06
                    + cos(vRatio * .pi * 14.0 - Double(x) * 0.02) * 0.035
                let depthShade = 0.86 - vRatio * 0.24 + strataWave

                rgba[p] = UInt8(max(6.0, min(255.0, (r * depthShade).rounded())))
                rgba[p + 1] = UInt8(max(6.0, min(255.0, (g * depthShade).rounded())))
                rgba[p + 2] = UInt8(max(8.0, min(255.0, (b * depthShade).rounded())))
                rgba[p + 3] = 255
            }
        }

        // Cross-fade top and bottom 16% rows so vertical strata stack seamlessly
        let vOverlap = max(4, Int((Double(h) * 0.16).rounded()))
        for y in 0..<vOverlap {
            let t = (Double(y) + 0.5) / Double(vOverlap)
            let wTop = 0.5 - 0.5 * cos(.pi * t)
            let wBot = 1.0 - wTop
            let botY = h - vOverlap + y
            for x in 0..<w {
                let pTop = (y * w + x) * 4
                let pBot = (botY * w + x) * 4
                let rMix = UInt8(max(0.0, min(255.0, (Double(rgba[pTop]) * wTop + Double(rgba[pBot]) * wBot).rounded())))
                let gMix = UInt8(max(0.0, min(255.0, (Double(rgba[pTop + 1]) * wTop + Double(rgba[pBot + 1]) * wBot).rounded())))
                let bMix = UInt8(max(0.0, min(255.0, (Double(rgba[pTop + 2]) * wTop + Double(rgba[pBot + 2]) * wBot).rounded())))
                rgba[pTop] = rMix; rgba[pTop + 1] = gMix; rgba[pTop + 2] = bMix
            }
        }

        return makeHorizontallySeamlessImage(rgba: rgba, width: w, height: h, seamRatio: 0.16)
    }

    /// Slices the 4x4 World Ecology Atlas (world_ecology_atlas_1794473252524.jpg) into 16 transparent SKTextures
    nonisolated private static func sliceWorldEcologyAtlas(from image: UIImage) -> [String: SKTexture] {
        var out: [String: SKTexture] = [:]
        let rows: [[String]] = [
            ["kelp_1", "kelp_2", "kelp_3", "kelp_4"],
            ["coral_1", "coral_2", "coral_3", "coral_4"],
            ["rock_1", "rock_2", "rock_3", "rock_4"],
            ["vent_1", "vent_2", "vent_3", "vent_4"]
        ]
        for r in 0..<4 {
            for c in 0..<4 {
                let id = rows[r][c]
                let bounds = SIMD4<Double>(
                    Double(c) * 0.25 + 0.015,
                    Double(r) * 0.25 + 0.015,
                    0.22,
                    0.22
                )
                if let uiImg = sliceAndKeyNormalizedCell(from: image, bounds: bounds, preserveInteriorWhite: false) {
                    let tex = SKTexture(image: uiImg)
                    tex.filteringMode = .linear
                    out[id] = tex
                }
            }
        }
        return out
    }

    /// Slices the 10 Landmark POIs from world_pois_atlas_1794473250443.jpg into transparent SKTextures
    nonisolated private static func sliceWorldPoisAtlas(from image: UIImage) -> [String: SKTexture] {
        var out: [String: SKTexture] = [:]
        let defs: [(id: String, bounds: SIMD4<Double>)] = [
            ("shipwreck_1", SIMD4(0.02, 0.02, 0.46, 0.22)),
            ("shipwreck_2", SIMD4(0.52, 0.02, 0.46, 0.22)),
            ("statue_1", SIMD4(0.02, 0.27, 0.46, 0.21)),
            ("statue_2", SIMD4(0.52, 0.27, 0.46, 0.21)),
            ("arch_1", SIMD4(0.02, 0.52, 0.46, 0.21)),
            ("arch_2", SIMD4(0.52, 0.52, 0.46, 0.21)),
            ("skeleton_1", SIMD4(0.02, 0.77, 0.30, 0.21)),
            ("skeleton_2", SIMD4(0.35, 0.77, 0.30, 0.21)),
            ("mine_1", SIMD4(0.68, 0.77, 0.14, 0.21)),
            ("mine_2", SIMD4(0.84, 0.77, 0.14, 0.21))
        ]
        for def in defs {
            if let uiImg = sliceAndKeyNormalizedCell(from: image, bounds: def.bounds, preserveInteriorWhite: false) {
                let tex = SKTexture(image: uiImg)
                tex.filteringMode = .linear
                out[def.id] = tex
            }
        }
        return out
    }

    /// Generates a soft radial abyssal portal shadow texture for downward-curved cave openings
    nonisolated private static func makeCavePortalShadowTexture() -> SKTexture? {
        let size = 128
        var rgba = [UInt8](repeating: 0, count: size * size * 4)
        let center = Double(size - 1) * 0.5
        let maxR = Double(size) * 0.5
        for y in 0..<size {
            for x in 0..<size {
                let dx = Double(x) - center
                let dy = Double(y) - center
                let r = min(1.0, hypot(dx, dy) / maxR)
                let alpha = pow(1.0 - r * r, 1.8) * 0.76
                let idx = (y * size + x) * 4
                let rCol = 4.0 * alpha
                let gCol = 16.0 * alpha
                let bCol = 36.0 * alpha
                rgba[idx] = UInt8(max(0.0, min(255.0, rCol.rounded())))
                rgba[idx + 1] = UInt8(max(0.0, min(255.0, gCol.rounded())))
                rgba[idx + 2] = UInt8(max(0.0, min(255.0, bCol.rounded())))
                rgba[idx + 3] = UInt8(max(0.0, min(255.0, (alpha * 255.0).rounded())))
            }
        }
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &rgba,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ), let cgImg = ctx.makeImage() else { return nil }
        let tex = SKTexture(cgImage: cgImg)
        tex.filteringMode = .linear
        return tex
    }
}
`;
}

function generateOceanGameSceneSwift(): string {
  return `import SpriteKit
import SwiftUI
import UIKit
import AudioToolbox
import ObjectiveC
import simd
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// Runtime Info.plist Guard & Auto-Injector for Google Mobile Ads SDK.
/// Prevents uncaught Objective-C NSException 'GADInvalidInitializationException' even when
/// an Xcode 15/16 target uses GENERATE_INFOPLIST_FILE=YES or omits Info.plist keys.
public enum GADInfoPlistRuntimePatch {
    private static var isInstalled = false
    private static let lock = NSLock()

    public static func installIfNeeded() {
        lock.lock()
        defer { lock.unlock() }
        guard !isInstalled else { return }
        isInstalled = true

        if let existing = Bundle.main.infoDictionary?["GADApplicationIdentifier"] as? String,
           existing.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("ca-app-pub-") {
            return
        }

        let origObjSel = #selector(Bundle.object(forInfoDictionaryKey:))
        let swizObjSel = #selector(Bundle.gad_swizzled_object(forInfoDictionaryKey:))
        if let origMethod = class_getInstanceMethod(Bundle.self, origObjSel),
           let swizMethod = class_getInstanceMethod(Bundle.self, swizObjSel) {
            method_exchangeImplementations(origMethod, swizMethod)
        }

        let origDictSel = #selector(getter: Bundle.infoDictionary)
        let swizDictSel = #selector(Bundle.gad_swizzled_infoDictionary)
        if let origDictMethod = class_getInstanceMethod(Bundle.self, origDictSel),
           let swizDictMethod = class_getInstanceMethod(Bundle.self, swizDictSel) {
            method_exchangeImplementations(origDictMethod, swizDictMethod)
        }
    }
}

extension Bundle {
    @objc fileprivate func gad_swizzled_object(forInfoDictionaryKey key: String) -> Any? {
        if let val = self.gad_swizzled_object(forInfoDictionaryKey: key) {
            return val
        }
        if self == Bundle.main {
            if key == "GADApplicationIdentifier" {
                return GameConfigGenerated.googleAdMobAppId
            }
            if key == "GADIsAdManagerApp" {
                return NSNumber(value: true)
            }
        }
        return nil
    }

    @objc fileprivate func gad_swizzled_infoDictionary() -> [String: Any]? {
        var dict = self.gad_swizzled_infoDictionary() ?? [:]
        if self == Bundle.main {
            if dict["GADApplicationIdentifier"] == nil {
                dict["GADApplicationIdentifier"] = GameConfigGenerated.googleAdMobAppId
            }
            if dict["GADIsAdManagerApp"] == nil {
                dict["GADIsAdManagerApp"] = true
            }
        }
        return dict
    }
}

/// Production Google AdMob Rewarded Video Bridge (App ID: ${GOOGLE_ADS_CONFIG.admobAppId}, Unit ID: ${GOOGLE_ADS_CONFIG.admobRewardedAdUnitId}).
/// Automatically activates real GADRewardedAd when GoogleMobileAds SPM package is linked in Xcode,
/// maintains an instant-ready Google rewarded video pool, and gracefully connects with zero premature fallback simulation.
@MainActor
public final class GoogleAdMobManager: NSObject, ObservableObject {
    public static let shared = GoogleAdMobManager()
    public let appId: String = GameConfigGenerated.googleAdMobAppId
    public let rewardedAdUnitId: String = GameConfigGenerated.googleAdMobRewardedAdUnitId
    /// Google official rewarded video test unit for iOS development verification
    public static let officialTestRewardedAdUnitId: String = "ca-app-pub-3940256099942544/1712485313"

    @Published public var isConnectingAd: Bool = false

    #if canImport(GoogleMobileAds)
    private var rewardedAd: GADRewardedAd?
    private var isLoadingAd: Bool = false
    private var sdkStarted: Bool = false
    private var pendingRewardAction: (() -> Void)? = nil
    private var pendingUnavailableAction: (() -> Void)? = nil
    private var timeoutTask: Task<Void, Never>? = nil
    #endif

    public override init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        super.init()
    }

    public var hasValidPlistAdMobConfig: Bool {
        GADInfoPlistRuntimePatch.installIfNeeded()
        if let gadAppId = Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String,
           gadAppId.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("ca-app-pub-") {
            return true
        }
        if let isAdManager = Bundle.main.object(forInfoDictionaryKey: "GADIsAdManagerApp") as? Bool,
           isAdManager {
            return true
        }
        return false
    }

    public func startSDKAndPreload() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        #if canImport(GoogleMobileAds)
        guard hasValidPlistAdMobConfig else { return }
        if !sdkStarted {
            sdkStarted = true
            print("[GoogleAdMob] 🚀 Starting Google Mobile Ads SDK...")
            GADMobileAds.sharedInstance().requestConfiguration.testDeviceIdentifiers = [
                GADSimulatorID,
                "4599a37a91ce92ab678ffee214ef6819"
            ]
            let startAds = { [weak self] in
                GADMobileAds.sharedInstance().start { status in
                    print("[GoogleAdMob] ✅ SDK initialized. Status: \\(status.adapterStatusesByClassName.keys)")
                    Task { @MainActor in
                        self?.preloadRewardedAd()
                    }
                }
            }
            #if canImport(AppTrackingTransparency)
            if #available(iOS 14, *) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    ATTrackingManager.requestTrackingAuthorization { status in
                        print("[GoogleAdMob] 🔒 ATT Status: \\(status.rawValue)")
                        Task { @MainActor in
                            startAds()
                        }
                    }
                }
            } else {
                startAds()
            }
            #else
            startAds()
            #endif
        } else {
            preloadRewardedAd()
        }
        #else
        print("[GoogleAdMob] ⚠️ GoogleMobileAds SDK is NOT linked in current build target.")
        print("[GoogleAdMob] 💡 Add SPM: https://github.com/googleads/swift-package-manager-google-mobile-ads.git")
        #endif
    }

    public func preloadRewardedAd() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        #if canImport(GoogleMobileAds)
        guard hasValidPlistAdMobConfig else { return }
        guard !isLoadingAd, rewardedAd == nil else { return }
        isLoadingAd = true
        print("[GoogleAdMob] 📡 Preloading Google rewarded video ad into memory pool...")

        // Prioritize official test ad unit for 100% reliable instant presentation in test device
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: Self.officialTestRewardedAdUnitId, request: request) { [weak self] ad, error in
            Task { @MainActor in
                guard let self = self else { return }
                self.isLoadingAd = false
                if let loadedAd = ad {
                    self.rewardedAd = loadedAd
                    print("[GoogleAdMob] 🎉 Real Google rewarded video ad loaded into memory pool!")
                    self.presentPendingAdIfAny()
                } else if let error = error as? NSError {
                    print("[GoogleAdMob] ⚠️ Test ad load failed (code: \\(error.code)): \\(error.localizedDescription)")
                    self.loadProductionUnitAd()
                }
            }
        }
        #endif
    }

    #if canImport(GoogleMobileAds)
    private func loadProductionUnitAd() {
        guard !isLoadingAd, rewardedAd == nil else { return }
        isLoadingAd = true
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: rewardedAdUnitId, request: request) { [weak self] ad, error in
            Task { @MainActor in
                guard let self = self else { return }
                self.isLoadingAd = false
                if let loadedAd = ad {
                    self.rewardedAd = loadedAd
                    print("[GoogleAdMob] 🎉 Production rewarded ad loaded successfully!")
                    self.presentPendingAdIfAny()
                } else if let error = error as? NSError {
                    print("[GoogleAdMob] ❌ Both ad units failed (code: \\(error.code)): \\(error.localizedDescription)")
                    self.failPendingAdIfAny()
                }
            }
        }
    }

    private func presentPendingAdIfAny() {
        guard let pending = pendingRewardAction,
              let ad = rewardedAd,
              let rootVC = Self.topViewController() else { return }
        print("[GoogleAdMob] 🎬 Presenting queued Google rewarded video ad now!")
        pendingRewardAction = nil
        pendingUnavailableAction = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        isConnectingAd = false
        rewardedAd = nil
        ad.fullScreenContentDelegate = self
        ad.present(fromRootViewController: rootVC) {
            print("[GoogleAdMob] 🎁 User completed rewarded ad, granting reward!")
            pending()
        }
        preloadRewardedAd()
    }

    private func failPendingAdIfAny() {
        guard let unavailable = pendingUnavailableAction else { return }
        pendingRewardAction = nil
        pendingUnavailableAction = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        isConnectingAd = false
        unavailable()
    }
    #endif

    public func showRewardedAd(
        onReward: @escaping () -> Void,
        onUnavailable: @escaping () -> Void
    ) {
        #if canImport(GoogleMobileAds)
        // 1. If ad is already loaded in memory, present immediately (Zero delay)
        if let ad = rewardedAd, let rootVC = Self.topViewController() {
            print("[GoogleAdMob] 🎬 Presenting real Google rewarded video ad immediately...")
            rewardedAd = nil
            ad.fullScreenContentDelegate = self
            ad.present(fromRootViewController: rootVC) {
                print("[GoogleAdMob] 🎁 User completed rewarded ad, granting reward!")
                onReward()
            }
            preloadRewardedAd()
            return
        }

        // 2. If ad is not ready yet, queue the presentation with an elegant loading HUD
        print("[GoogleAdMob] ⏳ Ad not ready in cache yet. Connecting to Google and queuing presentation...")
        isConnectingAd = true
        pendingRewardAction = onReward
        pendingUnavailableAction = onUnavailable

        preloadRewardedAd()

        // 4-second safety watchdog: if Google returns no fill or network is slow, report unavailable
        timeoutTask?.cancel()
        timeoutTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if self.isConnectingAd {
                print("[GoogleAdMob] ⚠️ 4s timeout connecting to Google Ad. Reporting unavailable.")
                self.failPendingAdIfAny()
            }
        }
        #else
        print("[GoogleAdMob] ⚠️ GoogleMobileAds SDK is not linked. Reporting unavailable.")
        onUnavailable()
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

#if canImport(GoogleMobileAds)
extension GoogleAdMobManager: GADFullScreenContentDelegate {
    public func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        print("[GoogleAdMob] 🎬 Ad was dismissed by user (closed). Preloading next ad...")
        preloadRewardedAd()
    }

    public func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("[GoogleAdMob] ❌ Failed to present full screen ad: \\(error.localizedDescription)")
        failPendingAdIfAny()
    }
}
#endif

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

    // Ad Unavailable Alert Notice (Zero simulated 3s ad on iOS!)
    @Published public var adUnavailableMessage: String? = nil

    // Non-Published real-time input state (Zero SwiftUI re-render during 60/120Hz joystick drag!)
    public var joyDx: CGFloat = 0
    public var joyDy: CGFloat = 0
    public var joyActive: Bool = false
    public var isBoostingHeld: Bool = false
    public var lastRenderedSpriteKey: String = ""

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

    // MARK: - Google AdMob Rewarded Video (iOS Native Zero-Simulation)
    public func showRewardedAd(kind: SimRewardedAdKind) {
        GoogleAdMobManager.shared.showRewardedAd(
            onReward: { [weak self] in
                self?.grantAdReward(for: kind)
            },
            onUnavailable: { [weak self] in
                guard let self = self else { return }
                self.adUnavailableMessage = self.lang == "zh"
                    ? "暂时没有可用的广告，请稍后再试"
                    : "No ads currently available. Please try again later."
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
    private var smoothedDepthRefY: Double = -1.0
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
    private var seabedArchFillPool: [SKShapeNode] = []
    private var activeSeabedArchFillCount: Int = 0
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
        backgroundColor = UIColor(red: 6/255, green: 21/255, blue: 40/255, alpha: 1)
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0, y: 0)

        // Start off-main-thread asynchronous texture decoding & Metal GPU warm-up (zero main-thread blocking!)
        SpriteAtlasManager.shared.startAsyncPreloadIfNeeded()

        removeAllChildren()
        addChild(waterBgNode)
        addChild(parallaxContainer)
        bubbleContainer.zPosition = 8
        addChild(bubbleContainer)
        addChild(worldContainer)
        addChild(fxContainer)

        if seabedArchFillPool.isEmpty {
            for _ in 0..<14 {
                let sNode = SKShapeNode()
                sNode.zPosition = 4.0
                sNode.lineWidth = 0.0
                sNode.strokeColor = .clear
                sNode.isHidden = true
                parallaxContainer.addChild(sNode)
                seabedArchFillPool.append(sNode)
            }
        } else {
            for sNode in seabedArchFillPool where sNode.parent == nil {
                parallaxContainer.addChild(sNode)
            }
        }

        if parallaxTilePool.isEmpty {
            for _ in 0..<160 {
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

    public func onAtlasPreloadCompleted() {
        refreshSharkTexture()
        for prey in activePreys where prey.node.texture == nil {
            if let tex = SpriteAtlasManager.shared.preyTexture(for: prey.config.spriteKey) {
                prey.node.texture = tex
            }
        }
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
        } else if vm.gameState == "playing" {
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

        // 2. Sea-Surface Locked Camera Tracking (keeps shark centered at 50% X, 50% Y on Title Screen)
        let minSurfaceCameraY = 40.0
        let targetCamX = vm.gameState == "title"
            ? sharkX
            : (sharkX + cos(sharkAngle) * 58.0)
        let targetCamY = vm.gameState == "title"
            ? max(minSurfaceCameraY, sharkY)
            : max(minSurfaceCameraY, sharkY + sin(sharkAngle) * 28.0)
        cameraX += (targetCamX - cameraX) * min(1.0, dt * 6.5)
        cameraY += (targetCamY - cameraY) * min(1.0, dt * 6.5)

        if cameraShakeTrauma > 0.01 {
            let shakeMag = cameraShakeTrauma * cameraShakeTrauma * 9.0
            cameraX += Double.random(in: -shakeMag...shakeMag)
            cameraY += Double.random(in: -shakeMag...shakeMag)
        }

        // 3. Smooth Optical Growth Shrinking of Background Layers
        let targetRelScale = stats.relativePreyScale
        if abs(targetRelScale - smoothedRelativePreyScale) > 0.35 {
            smoothedRelativePreyScale = targetRelScale
        } else {
            smoothedRelativePreyScale += (targetRelScale - smoothedRelativePreyScale) * min(1.0, dt * 4.5)
        }
        let bgScales = GameRules.getParallaxLayerGrowthScales(relativePreyScale: smoothedRelativePreyScale)

        let rawDepthY = max(0.0, sharkY)
        if smoothedDepthRefY < 0.0 || abs(rawDepthY - smoothedDepthRefY) > 650.0 {
            smoothedDepthRefY = rawDepthY
        } else {
            smoothedDepthRefY += (rawDepthY - smoothedDepthRefY) * min(1.0, dt * 5.8)
        }
        let transition = GameRules.computeParallaxBiomeTransitionState(depthMeters: smoothedDepthRefY)

        renderParallaxBackground(viewW: viewW, viewH: viewH, bgScales: bgScales, transition: transition, zoom: stats.cameraZoom)
        stepAndRenderAmbientBubbles(viewW: viewW, viewH: viewH, bgScales: bgScales, transition: transition, dt: dt)
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

        let prevX = sharkX
        let prevY = sharkY
        let nextX = sharkX + sharkVx * dt
        let nextY = max(46.0, min(20000.0, sharkY + sharkVy * dt))

        // Enforce 2-way physical seabed & 9-tier terrace collision (top landing + underside anti-penetration!)
        let sharkHitRadius = 26.0 * stats.scale
        let stepCol = GameRules.resolveSeabedKineticStep(
            prevX: prevX,
            prevY: prevY,
            nextX: nextX,
            nextY: nextY,
            vx: sharkVx,
            vy: sharkVy,
            entityRadius: sharkHitRadius,
            clearancePadding: 8.0
        )
        sharkX = stepCol.x
        sharkY = max(46.0, min(20000.0, stepCol.y))
        sharkVx = stepCol.vx
        sharkVy = stepCol.vy
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

    private func stepAndRenderAmbientBubbles(
        viewW: Double,
        viewH: Double,
        bgScales: ParallaxLayerGrowthScales,
        transition: GameRules.ParallaxBiomeTransitionState,
        dt: Double
    ) {
        initAmbientBubblesIfNeeded(viewW: viewW, viewH: viewH)
        let wS = transition.particleShallowWeight
        let wT = transition.particleTwilightWeight
        let wA = transition.particleAbyssWeight
        let pScale = bgScales.particleScale

        for b in ambientBubbles {
            // In SpriteKit Y=0 is bottom and Y=viewH is top, so rising bubbles increase Y (+1.0)
            let twilightVertDir: Double = (b.kindIndex == 1) ? -0.35 : 1.0
            let vertDir: Double = 1.0 * (wS + wA) + twilightVertDir * wT
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

            let effScale = pScale * (wS * 1.0 + wT * 0.72 + wA * 0.78)
            b.ringNode.setScale(CGFloat(effScale))

            let pulseT = 0.55 + 0.45 * sin(b.wobblePhase * 1.5)
            let pulseA = 0.65 + 0.35 * sin(b.wobblePhase * 1.8)
            let effPulse = wS * 1.0 + wT * pulseT + wA * pulseA
            b.ringNode.alpha = CGFloat(b.baseAlpha * effPulse)

            // Smoothly blend bubble RGB & stroke across Shallow -> Twilight -> Abyss (zero 1-frame snap at 520m / 1150m!)
            let twR: Double = (b.kindIndex == 2) ? (34.0 / 255.0) : (148.0 / 255.0)
            let twG: Double = (b.kindIndex == 2) ? (211.0 / 255.0) : (163.0 / 255.0)
            let twB: Double = (b.kindIndex == 2) ? (238.0 / 255.0) : (184.0 / 255.0)

            let abR: Double = (b.kindIndex == 2) ? (192.0 / 255.0) : (251.0 / 255.0)
            let abG: Double = (b.kindIndex == 2) ? (132.0 / 255.0) : (146.0 / 255.0)
            let abB: Double = (b.kindIndex == 2) ? (252.0 / 255.0) : (60.0 / 255.0)

            let shR: Double = 186.0 / 255.0
            let shG: Double = 230.0 / 255.0
            let shB: Double = 253.0 / 255.0

            let fillR = shR * wS + twR * wT + abR * wA
            let fillG = shG * wS + twG * wT + abG * wA
            let fillB = shB * wS + twB * wT + abB * wA
            let fillA = 0.18 * wS + 0.90 * (wT + wA)

            b.ringNode.fillColor = UIColor(red: CGFloat(fillR), green: CGFloat(fillG), blue: CGFloat(fillB), alpha: CGFloat(fillA))
            b.ringNode.strokeColor = wS > 0.02
                ? UIColor(red: CGFloat(shR), green: CGFloat(shG), blue: CGFloat(shB), alpha: CGFloat(0.90 * wS))
                : .clear
            b.highlightNode.isHidden = wS <= 0.03
            b.highlightNode.alpha = CGFloat(0.72 * wS)
        }
    }

    // MARK: - Continuous Cross-Depth Multi-Biome Parallax Background & 1.0x Physical Seabed (1:1 Parity with Web parallaxBackground.ts & worldGenerationSystem.ts)
    private func renderParallaxBackground(
        viewW: Double,
        viewH: Double,
        bgScales: ParallaxLayerGrowthScales,
        transition: GameRules.ParallaxBiomeTransitionState,
        zoom: Double
    ) {
        let depthRefY = max(0.0, smoothedDepthRefY >= 0.0 ? smoothedDepthRefY : sharkY)
        let rgb = GameRules.sampleBathymetricWaterRGB(depthMeters: cameraY)
        let ambientWaterColor = UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z), alpha: 1.0)
        waterBgNode.color = ambientWaterColor
        waterBgNode.size = CGSize(width: viewW, height: viewH)
        waterBgNode.position = CGPoint(x: viewW * 0.5, y: viewH * 0.5)

        activeParallaxTileCount = 0
        activeSeabedArchFillCount = 0

        let waterMap: [String: String] = [
            "bg_shallow": "bg_shallow_0_water_0e65cb68",
            "bg_twilight": "bg_twilight_0_17bcb84c",
            "bg_abyss": "bg_abyss_0_1bbf506a"
        ]

        // 1. Layer 0 Water Backdrops blended with C2 quintic weights & soft vertical envelope
        if transition.shallow.waterAlpha > 0.01,
           let wName0 = waterMap["bg_shallow"],
           let water0 = SpriteAtlasManager.shared.oceanParallaxTexture(named: wName0, isWaterCanopy: true) {
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
                alpha: transition.shallow.waterAlpha,
                zPos: 1.0,
                fogColor: ambientWaterColor,
                fogBlendFactor: 0.0
            )
        }

        if transition.twilight.waterAlpha > 0.01,
           let wName1 = waterMap["bg_twilight"],
           let water1 = SpriteAtlasManager.shared.oceanParallaxTexture(named: wName1, isWaterCanopy: true) {
            addTiledStrip(
                texture: water1,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: transition.twilight.waterAlpha,
                zPos: 1.1,
                fogColor: ambientWaterColor,
                fogBlendFactor: 0.18
            )
        }

        if transition.abyss.waterAlpha > 0.01,
           let wName2 = waterMap["bg_abyss"],
           let water2 = SpriteAtlasManager.shared.oceanParallaxTexture(named: wName2, isWaterCanopy: true) {
            addTiledStrip(
                texture: water2,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: transition.abyss.waterAlpha,
                zPos: 1.2,
                fogColor: ambientWaterColor,
                fogBlendFactor: 0.16
            )
        }

        // 2. Render 1.0x World-Space Physical Seabed, Subsurface Bedrock Strata, 9-Tier Seabed Terraces & Composite Coral Outcrops
        renderPhysicalSeabedAndEcology(
            viewW: viewW,
            viewH: viewH,
            zoom: max(0.35, zoom)
        )

        // Hide any unused pooled tile nodes without removing them from the scene graph
        if activeParallaxTileCount < parallaxTilePool.count {
            for i in activeParallaxTileCount..<parallaxTilePool.count {
                parallaxTilePool[i].isHidden = true
            }
        }
        if activeSeabedArchFillCount < seabedArchFillPool.count {
            for i in activeSeabedArchFillCount..<seabedArchFillPool.count {
                seabedArchFillPool[i].isHidden = true
            }
        }
    }

    private func acquirePooledArchFillNode() -> SKShapeNode {
        if activeSeabedArchFillCount < seabedArchFillPool.count {
            let node = seabedArchFillPool[activeSeabedArchFillCount]
            activeSeabedArchFillCount += 1
            node.isHidden = false
            return node
        }
        let node = SKShapeNode()
        node.strokeColor = .clear
        node.lineWidth = 0
        parallaxContainer.addChild(node)
        seabedArchFillPool.append(node)
        activeSeabedArchFillCount += 1
        return node
    }

    private func addWarpedWorldStrip(
        texture: SKTexture,
        x0: Double,
        x1: Double,
        topEYAt: (Double) -> Double,
        botEYAt: (Double) -> Double,
        alpha: Double,
        zPos: CGFloat,
        flipX: Bool = false,
        color: UIColor = .clear,
        colorBlendFactor: Double = 0.0
    ) {
        let spanW = x1 - x0
        guard spanW > 0.5 && alpha > 0.01 else { return }

        let cols = 8
        var topYs = [Double](repeating: 0.0, count: cols + 1)
        var botYs = [Double](repeating: 0.0, count: cols + 1)
        var minY = Double.greatestFiniteMagnitude
        var maxY = -Double.greatestFiniteMagnitude

        for c in 0...cols {
            let u = Double(c) / Double(cols)
            let ty = topEYAt(u)
            let by = min(ty - 1.0, botEYAt(u))
            topYs[c] = ty
            botYs[c] = by
            if by < minY { minY = by }
            if ty > maxY { maxY = ty }
        }

        let boxH = max(4.0, maxY - minY)
        let node = acquirePooledParallaxTile()
        node.texture = texture
        node.anchorPoint = CGPoint(x: 0.0, y: 0.0)
        node.xScale = 1.0
        node.yScale = 1.0
        node.zRotation = 0.0
        node.size = CGSize(width: spanW, height: boxH)
        node.position = CGPoint(x: x0, y: minY)
        node.alpha = CGFloat(alpha)
        node.zPosition = zPos
        node.color = color
        node.colorBlendFactor = CGFloat(max(0.0, min(0.85, colorBlendFactor)))

        var src: [SIMD2<Float>] = []
        var dst: [SIMD2<Float>] = []
        src.reserveCapacity((cols + 1) * 2)
        dst.reserveCapacity((cols + 1) * 2)

        for row in 0...1 {
            let vSrc = Float(row)
            for col in 0...cols {
                let uNorm = Float(col) / Float(cols)
                let uSrc = flipX ? (1.0 - uNorm) : uNorm
                src.append(SIMD2<Float>(uSrc, vSrc))
                let targetY = (row == 0) ? botYs[col] : topYs[col]
                let vDst = Float((targetY - minY) / boxH)
                dst.append(SIMD2<Float>(uNorm, vDst))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: src, destinationPositions: dst)
    }

    private func renderPhysicalSeabedAndEcology(
        viewW: Double,
        viewH: Double,
        zoom: Double
    ) {
        let halfWorldW = (viewW * 0.5) / zoom + 450.0
        let startWorldX = cameraX - halfWorldW
        let endWorldX = cameraX + halfWorldW

        let toScreenX: (Double) -> Double = { wx in
            (wx - self.cameraX) * zoom + viewW * 0.5
        }
        let toScreenY: (Double) -> Double = { wy in
            viewH * 0.5 - (wy - self.cameraY) * zoom
        }

        // Determine active seabed strip ID by depth
        let stripId: String
        if cameraY < 620.0 {
            stripId = "coral_reef"
        } else if cameraY < 1350.0 {
            stripId = "rocky_shelf"
        } else if cameraY < 2800.0 {
            stripId = "underwater_canyon"
        } else {
            stripId = "deep_abyss"
        }

        guard let stripTex = SpriteAtlasManager.shared.seabedStripTexture(for: stripId) else { return }
        let subTex = SpriteAtlasManager.shared.seabedSubStratumTexture(for: stripId) ?? stripTex
        let texSize = stripTex.size()
        let texAspect = texSize.height > 0 ? Double(texSize.width / texSize.height) : 4.266
        let tileWorldW = 680.0
        let tileWorldH = tileWorldW / max(1.0, texAspect)

        // 1A. Main Floor Underfill Polygon (prevents any sub-pixel gap below subsurface strata)
        let firstTile = Int(floor(startWorldX / tileWorldW))
        let lastTile = Int(ceil(endWorldX / tileWorldW))
        var anyMainFloorVisible = false
        for tIdx in firstTile...lastTile {
            let fy0 = GameRules.getFloorDepthAt(worldX: Double(tIdx) * tileWorldW)
            let fy1 = GameRules.getFloorDepthAt(worldX: Double(tIdx + 1) * tileWorldW)
            let top0 = toScreenY(fy0 - tileWorldH * 0.62)
            let top1 = toScreenY(fy1 - tileWorldH * 0.62)
            if max(top0, top1) > -200.0 {
                anyMainFloorVisible = true
                break
            }
        }

        if anyMainFloorVisible {
            let fillNode = acquirePooledArchFillNode()
            fillNode.zPosition = 2.6
            let path = CGMutablePath()
            let stepW = 80.0
            let firstX = floor(startWorldX / stepW) * stepW
            path.move(to: CGPoint(x: toScreenX(firstX), y: -640.0))
            var wx = firstX
            while wx <= endWorldX + stepW {
                let fy = GameRules.getFloorDepthAt(worldX: wx)
                let sy = toScreenY(fy - tileWorldH * 0.34)
                path.addLine(to: CGPoint(x: toScreenX(wx), y: sy))
                wx += stepW
            }
            path.addLine(to: CGPoint(x: toScreenX(wx), y: -640.0))
            path.closeSubpath()
            fillNode.path = path
            fillNode.fillColor = stripId == "coral_reef"
                ? UIColor(red: 28/255, green: 52/255, blue: 74/255, alpha: 0.96)
                : stripId == "rocky_shelf"
                ? UIColor(red: 16/255, green: 34/255, blue: 58/255, alpha: 0.96)
                : UIColor(red: 10/255, green: 18/255, blue: 34/255, alpha: 0.98)

            // 1B. Main Floor Multi-Tier Subsurface Bedrock Strata + Top Surface Strip
            let subLayerScales: [(yStartFrac: Double, heightMult: Double, flipX: Bool, alpha: Double, shade: Double, zOff: CGFloat)] = [
                (0.28, 1.45, true,  0.94, 0.18, 2.8),
                (1.18, 1.65, false, 0.90, 0.38, 2.7),
                (2.22, 1.85, true,  0.86, 0.56, 2.65)
            ]

            for tIdx in firstTile...lastTile {
                let wx0 = Double(tIdx) * tileWorldW
                let wx1 = wx0 + tileWorldW
                let sx0 = toScreenX(wx0)
                let sx1 = toScreenX(wx1)
                if sx1 < -80.0 || sx0 > viewW + 80.0 { continue }

                let screenTileH = tileWorldH * zoom
                for sub in subLayerScales {
                    let subH = screenTileH * sub.heightMult
                    let topCheck = toScreenY(GameRules.getFloorDepthAt(worldX: wx0)) - screenTileH * sub.yStartFrac
                    if topCheck < -subH - 80.0 { continue }
                    addWarpedWorldStrip(
                        texture: subTex,
                        x0: sx0,
                        x1: sx1,
                        topEYAt: { u in
                            let wx = wx0 + u * tileWorldW
                            return toScreenY(GameRules.getFloorDepthAt(worldX: wx)) - screenTileH * sub.yStartFrac
                        },
                        botEYAt: { u in
                            let wx = wx0 + u * tileWorldW
                            return toScreenY(GameRules.getFloorDepthAt(worldX: wx)) - screenTileH * sub.yStartFrac - subH
                        },
                        alpha: sub.alpha,
                        zPos: sub.zOff,
                        flipX: sub.flipX,
                        color: .black,
                        colorBlendFactor: sub.shade
                    )
                }

                // Main Seabed Top Surface Strip
                addWarpedWorldStrip(
                    texture: stripTex,
                    x0: sx0,
                    x1: sx1,
                    topEYAt: { u in
                        let wx = wx0 + u * tileWorldW
                        return toScreenY(GameRules.getFloorDepthAt(worldX: wx) - tileWorldH * 0.62)
                    },
                    botEYAt: { u in
                        let wx = wx0 + u * tileWorldW
                        return toScreenY(GameRules.getFloorDepthAt(worldX: wx) + tileWorldH * 0.38)
                    },
                    alpha: 0.98,
                    zPos: 3.2
                )
            }
        }

        // 2. Render 9 Non-Uniformly Spaced Continuous Seabed Terraces (414m down to 16,900m)
        let terraceSubLayers: [(yStartFrac: Double, heightMult: Double, flipX: Bool, alpha: Double, shade: Double, zOff: CGFloat)] = [
            (0.20, 0.88, true,  0.94, 0.16, 3.5),
            (0.76, 1.04, false, 0.90, 0.34, 3.45)
        ]

        for (tierIdx, tier) in GameRules.seabedTerraceTiers.enumerated() {
            let minScreenY = toScreenY(tier.baseDepth + 440.0)
            let maxScreenY = toScreenY(tier.baseDepth - 240.0)
            if minScreenY > viewH + 260.0 || maxScreenY < -260.0 { continue }

            guard let tierStripTex = SpriteAtlasManager.shared.seabedStripTexture(for: tier.stripId) else { continue }
            let tierSubTex = SpriteAtlasManager.shared.seabedSubStratumTexture(for: tier.stripId) ?? tierStripTex
            let tierTexSize = tierStripTex.size()
            let tierAspect = tierTexSize.height > 0 ? Double(tierTexSize.width / tierTexSize.height) : 4.266
            let atollTileW = 480.0
            let atollTileH = atollTileW / max(1.0, tierAspect)
            let screenAtollH = atollTileH * zoom
            let firstAtollTile = Int(floor(startWorldX / atollTileW))
            let lastAtollTile = Int(ceil(endWorldX / atollTileW))

            // 2A. Distant Cave Opening & Solid Rock Arch Backfill Polygon (replaces old floating pillars!)
            let archFillNode = acquirePooledArchFillNode()
            archFillNode.zPosition = 3.35
            let archPath = CGMutablePath()
            let stepX = 36.0
            let startSampleX = Double(firstAtollTile) * atollTileW
            let endSampleX = Double(lastAtollTile + 1) * atollTileW

            var wx = startSampleX
            var firstPt = true
            while wx <= endSampleX {
                let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                let topY = toScreenY(s.topY) - screenAtollH * 0.16
                if firstPt {
                    archPath.move(to: CGPoint(x: toScreenX(wx), y: topY))
                    firstPt = false
                } else {
                    archPath.addLine(to: CGPoint(x: toScreenX(wx), y: topY))
                }
                wx += stepX
            }
            wx = endSampleX
            while wx >= startSampleX {
                let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                let botY = toScreenY(s.bottomArchY)
                archPath.addLine(to: CGPoint(x: toScreenX(wx), y: botY))
                wx -= stepX
            }
            archPath.closeSubpath()
            archFillNode.path = archPath
            archFillNode.fillColor = tier.stripId == "coral_reef"
                ? UIColor(red: 14/255, green: 36/255, blue: 58/255, alpha: 0.94)
                : tier.stripId == "rocky_shelf"
                ? UIColor(red: 11/255, green: 25/255, blue: 46/255, alpha: 0.95)
                : UIColor(red: 7/255, green: 14/255, blue: 28/255, alpha: 0.96)

            // 2B. Cave Portal Elliptical Depth Shadow inside each downward-curved opening
            let firstPeriod = Int(floor(startWorldX / tier.period))
            let lastPeriod = Int(ceil(endWorldX / tier.period))
            if let portalShadowTex = SpriteAtlasManager.shared.cavePortalShadowTexture() {
                for pIdx in firstPeriod...lastPeriod {
                    let gapCenterWX = (Double(pIdx) + 0.5) * tier.period - tier.phaseShift
                    let sx = toScreenX(gapCenterWX)
                    let portalHalfW = tier.period * tier.openDuty * 0.95 * zoom
                    if sx + portalHalfW < -80.0 || sx - portalHalfW > viewW + 80.0 { continue }
                    let sCenter = GameRules.getSeabedTerraceAt(worldX: gapCenterWX, tierIndex: tierIdx)
                    let sy = toScreenY(sCenter.topY + 38.0)
                    let portalNode = acquirePooledParallaxTile()
                    portalNode.warpGeometry = nil
                    portalNode.texture = portalShadowTex
                    portalNode.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                    portalNode.xScale = 1.0
                    portalNode.yScale = 1.0
                    portalNode.zRotation = 0.0
                    portalNode.size = CGSize(width: portalHalfW * 2.1, height: max(56.0, 148.0 * zoom))
                    portalNode.position = CGPoint(x: sx, y: sy)
                    portalNode.alpha = 0.88
                    portalNode.zPosition = 3.4
                    portalNode.colorBlendFactor = 0.0
                }
            }

            // 2C. Terrace Subsurface Strata (strictly clamped above bottomArchY so zero overflow under arch!)
            for tIdx in firstAtollTile...lastAtollTile {
                let wx0 = Double(tIdx) * atollTileW
                let wx1 = wx0 + atollTileW
                let sx0 = toScreenX(wx0)
                let sx1 = toScreenX(wx1)
                if sx1 < -80.0 || sx0 > viewW + 80.0 { continue }

                for sub in terraceSubLayers {
                    let subH = screenAtollH * sub.heightMult
                    addWarpedWorldStrip(
                        texture: tierSubTex,
                        x0: sx0,
                        x1: sx1,
                        topEYAt: { u in
                            let wx = wx0 + u * atollTileW
                            let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                            let archTopY = toScreenY(s.bottomArchY - 4.0)
                            let rawTopY = toScreenY(s.topY) - screenAtollH * sub.yStartFrac
                            return max(archTopY + 1.5, rawTopY)
                        },
                        botEYAt: { u in
                            let wx = wx0 + u * atollTileW
                            let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                            let archTopY = toScreenY(s.bottomArchY - 4.0)
                            let rawBotY = toScreenY(s.topY) - screenAtollH * sub.yStartFrac - subH
                            return max(archTopY, rawBotY)
                        },
                        alpha: sub.alpha,
                        zPos: sub.zOff,
                        flipX: sub.flipX,
                        color: .black,
                        colorBlendFactor: sub.shade
                    )
                }

                // 2D. Continuous Terrace Top Surface Strip (warps downward into cave opening!)
                addWarpedWorldStrip(
                    texture: tierStripTex,
                    x0: sx0,
                    x1: sx1,
                    topEYAt: { u in
                        let wx = wx0 + u * atollTileW
                        let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                        let sinkScale = 1.0 - s.caveFactor * 0.25
                        return toScreenY(s.topY) + screenAtollH * 0.62 * sinkScale
                    },
                    botEYAt: { u in
                        let wx = wx0 + u * atollTileW
                        let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                        let archTopY = toScreenY(s.bottomArchY - 2.0)
                        let rawBotY = toScreenY(s.topY) - screenAtollH * 0.38
                        return max(archTopY, rawBotY)
                    },
                    alpha: 0.98,
                    zPos: 3.65
                )
            }
        }

        // 3. Render Composite Coral Outcrops, Seaweed Forests, Hydrothermal Vents & POIs along Main Floor & All 9 Terraces
        let chunkWidth = 600.0
        let firstChunk = Int(floor(startWorldX / chunkWidth)) - 1
        let lastChunk = Int(ceil(endWorldX / chunkWidth)) + 1

        struct CoralLayerSpec {
            let isPoi: Bool
            let spriteId: String
            let dxRatio: Double
            let dyRatio: Double
            let scaleW: Double
            let scaleH: Double
            let flipX: Bool
            let zOff: CGFloat
        }

        func layersForOutcrop(_ outcrop: GameRules.SeabedOutcropPlacement) -> [CoralLayerSpec] {
            let v = max(1, min(4, outcrop.variant + 1))
            let flipMain = outcrop.seed > 0.5

            switch outcrop.type {
            case .CORAL_MOUND:
                return [
                    CoralLayerSpec(isPoi: false, spriteId: "kelp_\\(v)",  dxRatio: -0.28, dyRatio: 0.02,  scaleW: 0.62, scaleH: 0.68, flipX: !flipMain, zOff: 0.01),
                    CoralLayerSpec(isPoi: false, spriteId: "coral_\\(v)", dxRatio: 0.0,   dyRatio: 0.0,   scaleW: 1.08, scaleH: 1.08, flipX: flipMain,  zOff: 0.03)
                ]
            case .KELP_CLUSTER:
                return [
                    CoralLayerSpec(isPoi: false, spriteId: "kelp_\\(v)",  dxRatio: 0.0,   dyRatio: 0.0,   scaleW: 1.06, scaleH: 1.12, flipX: flipMain,  zOff: 0.02)
                ]
            case .ROCK_SPIRE:
                var list: [CoralLayerSpec] = [
                    CoralLayerSpec(isPoi: false, spriteId: "rock_\\(v)",  dxRatio: 0.0,   dyRatio: 0.0,   scaleW: 1.08, scaleH: 1.08, flipX: flipMain,  zOff: 0.02)
                ]
                if outcrop.seed > 0.78 {
                    let poiIds = ["shipwreck_1", "statue_1", "arch_1", "skeleton_1"]
                    let poiId = poiIds[outcrop.variant % poiIds.count]
                    list.append(CoralLayerSpec(isPoi: true, spriteId: poiId, dxRatio: 0.0, dyRatio: -0.08, scaleW: 1.35, scaleH: 1.15, flipX: flipMain, zOff: 0.04))
                }
                return list
            case .ABYSSAL_CHIMNEY:
                return [
                    CoralLayerSpec(isPoi: false, spriteId: "vent_\\(v)",  dxRatio: 0.0,   dyRatio: 0.0,   scaleW: 1.08, scaleH: 1.12, flipX: flipMain,  zOff: 0.02)
                ]
            }
        }

        for cIdx in firstChunk...lastChunk {
            let outcrops = GameRules.getSeabedOutcropsForChunk(chunkIndex: cIdx, chunkWidth: chunkWidth)
            for outcrop in outcrops {
                let sx = toScreenX(outcrop.worldX)
                let sy = toScreenY(outcrop.baseY)
                let drawBaseW = outcrop.width * zoom
                let drawBaseH = outcrop.height * zoom
                if sx + drawBaseW * 1.6 < -100.0 || sx - drawBaseW * 1.6 > viewW + 100.0 { continue }
                if sy + drawBaseH * 1.6 < -100.0 || sy - drawBaseH * 1.6 > viewH + 100.0 { continue }

                let slope = GameRules.getTerrainSlopeAt(worldX: outcrop.worldX)
                let slopeRot = max(-0.26, min(0.26, atan(slope) * 0.48))
                let layers = layersForOutcrop(outcrop)

                for layer in layers {
                    let texOpt = layer.isPoi
                        ? SpriteAtlasManager.shared.poiSpriteTexture(for: layer.spriteId)
                        : SpriteAtlasManager.shared.ecologySpriteTexture(for: layer.spriteId)
                    guard let tex = texOpt else { continue }
                    let drawW = drawBaseW * layer.scaleW
                    let drawH = drawBaseH * layer.scaleH
                    let sinkY = drawBaseH * 0.14
                    let lx = sx + layer.dxRatio * drawBaseW
                    // Note: in Web Canvas +dyRatio moves DOWN; in SpriteKit -dyRatio moves DOWN
                    let ly = sy - layer.dyRatio * drawBaseH - sinkY

                    let node = acquirePooledParallaxTile()
                    node.warpGeometry = nil
                    node.texture = tex
                    node.anchorPoint = CGPoint(x: 0.5, y: 0.0)
                    node.size = CGSize(width: drawW, height: drawH)
                    node.position = CGPoint(x: lx, y: ly)
                    node.xScale = layer.flipX ? -1.0 : 1.0
                    node.yScale = 1.0
                    node.zRotation = CGFloat(-slopeRot)
                    node.alpha = 0.96
                    node.zPosition = 3.8 + layer.zOff
                    node.colorBlendFactor = 0.0
                }
            }
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
        zPos: CGFloat,
        fogColor: UIColor = .clear,
        fogBlendFactor: Double = 0.0
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
            node.warpGeometry = nil
            node.anchorPoint = CGPoint(x: 0.0, y: 0.0)
            node.xScale = 1.0
            node.yScale = 1.0
            node.zRotation = 0.0
            node.texture = texture
            // Exact physical pixel boundary abutment (x0 -> x1) with ZERO double-alpha overlap!
            node.size = CGSize(width: max(1.0, x1 - x0), height: alignedH)
            node.position = CGPoint(x: x0, y: alignedY)
            node.alpha = CGFloat(alpha)
            node.zPosition = zPos
            node.color = fogColor
            node.colorBlendFactor = CGFloat(max(0.0, min(0.85, fogBlendFactor)))
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
        let localFloorLimit = max(140.0, GameRules.getFloorDepthAt(worldX: px) - chosen.radius - 28.0)
        let rawPy = max(chosen.minDepth, min(chosen.maxDepth, sharkY + sin(ang) * dist * 0.6))
        let py = min(rawPy, localFloorLimit)
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

            let prevPreyY = p.y
            p.x += p.vx * dt
            p.y += p.vy * dt
            if p.y < p.config.minDepth + 14.0 {
                p.y = p.config.minDepth + 14.0
                p.vy = abs(p.vy) * 0.65 + 18.0
            } else if p.y > p.config.maxDepth - 14.0 {
                p.y = p.config.maxDepth - 14.0
                p.vy = -abs(p.vy) * 0.65 - 18.0
            }
            let preyFloorCol = GameRules.resolveSeabedCollision(
                worldX: p.x,
                worldY: p.y,
                vy: p.vy,
                entityRadius: p.config.radius * visualScale * 0.75 + 12.0,
                prevWorldY: prevPreyY
            )
            if preyFloorCol.hitSeabed || preyFloorCol.hitAtollUnderside {
                p.y = preyFloorCol.y
                p.vy = preyFloorCol.vy
            }

            let postDx = p.x - sharkX
            let postDy = p.y - sharkY
            let postDist = hypot(postDx, postDy)
            let hitRadius = p.config.radius * visualScale + 28.0 * stats.scale

            if vm.gameState == "playing" && postDist < hitRadius {
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
            if p.node.texture == nil,
               let loadedTex = SpriteAtlasManager.shared.preyTexture(for: p.config.spriteKey) {
                p.node.texture = loadedTex
            }
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
import AVKit
import WebKit

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

// MARK: - 2. Dynamic Interactive Startup Loading Overlay (Scheme A Hot-Replaceable Assets)
/// Eliminates the 0.3s ~ 3.0s startup black screen by rendering on frame 1 while \`SpriteAtlasManager\`
/// decodes 48 @3x sharks, slices 33 preys, and warms 12 ocean parallax layers on a background thread.
/// Hot-replaceable asset convention in \`Resources/Assets\`:
/// - \`loading_background.png\` (Loading backdrop / festival poster)
/// - \`loading_logo.png\` (Brand / game main title with Breathe Effect)
/// - \`loading_mascot.png\` (Mascot baby shark swimming along the progress bar from 0% -> 100%)
public struct StartupLoadingView: View {
    @ObservedObject var vm: GameViewModel
    @ObservedObject var atlasManager: SpriteAtlasManager

    public var body: some View {
        GeometryReader { geo in
            let fullW: CGFloat = max(geo.size.width, UIScreen.main.bounds.width)
            let fullH: CGFloat = max(geo.size.height, UIScreen.main.bounds.height)
            let barW: CGFloat = min(460.0, fullW * 0.62)
            let barH: CGFloat = 12.0
            let progress: Double = max(0.0, min(1.0, atlasManager.loadingProgress))

            TimelineView(.animation) { timeline in
                let t: Double = timeline.date.timeIntervalSinceReferenceDate
                loadingStageContent(
                    fullW: fullW,
                    fullH: fullH,
                    barW: barW,
                    barH: barH,
                    progress: progress,
                    t: t
                )
            }
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private func loadingStageContent(
        fullW: CGFloat,
        fullH: CGFloat,
        barW: CGFloat,
        barH: CGFloat,
        progress: Double,
        t: Double
    ) -> some View {
        ZStack {
            // 1. Base Abyssal Blue (#061528) matching UILaunchScreen LaunchBg 1:1
            Color(red: 6.0 / 255.0, green: 21.0 / 255.0, blue: 40.0 / 255.0)
                .ignoresSafeArea()

            // 2. Hot-Replaceable Loading Background Poster (loading_background.png)
            if let bgImg = atlasManager.loadingBackgroundImage() {
                Image(uiImage: bgImg)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFill()
                    .frame(width: fullW, height: fullH)
                    .clipped()
                    .ignoresSafeArea()
            }

            // 3. Procedural 60/120fps Caustic Light Rays & Rising Bioluminescent Bubbles
            Canvas { (ctx: inout GraphicsContext, size: CGSize) in
                drawUnderwaterAtmosphere(ctx: &ctx, size: size, t: t)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)

            // 4. Foreground Content: Breathing Brand Logo + Swimming Mascot Shark + Progress Bar
            VStack(spacing: 0) {
                Spacer(minLength: fullH * 0.08)
                brandLogoSection(fullW: fullW, fullH: fullH, t: t)
                Spacer()
                mascotAndProgressSection(barW: barW, barH: barH, fullH: fullH, progress: progress, t: t)
            }
        }
    }

    private func drawUnderwaterAtmosphere(ctx: inout GraphicsContext, size: CGSize, t: Double) {
        let widthD: Double = max(1.0, Double(size.width))
        let heightD: Double = max(1.0, Double(size.height))
        for rayIdx in 0..<5 {
            drawCausticRay(ctx: &ctx, widthD: widthD, heightD: heightD, t: t, rayIdx: rayIdx)
        }
        for bIdx in 0..<28 {
            drawRisingBubble(ctx: &ctx, widthD: widthD, heightD: heightD, t: t, bIdx: bIdx)
        }
    }

    private func drawCausticRay(
        ctx: inout GraphicsContext,
        widthD: Double,
        heightD: Double,
        t: Double,
        rayIdx: Int
    ) {
        let fi: Double = Double(rayIdx)
        let sway: Double = sin(t * 0.75 + fi * 1.15) * 36.0
        let anchorRatio: Double = 0.18 + fi * 0.16
        let topX: Double = widthD * anchorRatio + sway
        let rayW: Double = 55.0 + 18.0 * sin(t * 1.1 + fi)
        let bottomY: Double = heightD * 0.85

        var path = Path()
        path.move(to: CGPoint(x: topX - rayW * 0.45, y: -10.0))
        path.addLine(to: CGPoint(x: topX + rayW * 0.45, y: -10.0))
        path.addLine(to: CGPoint(x: topX + rayW * 1.45 + 45.0, y: bottomY))
        path.addLine(to: CGPoint(x: topX - rayW * 1.15 + 45.0, y: bottomY))
        path.closeSubpath()

        let rayAlpha: Double = 0.055 + 0.025 * sin(t * 1.4 + fi * 0.9)
        let cTop = Color(red: 56.0 / 255.0, green: 189.0 / 255.0, blue: 248.0 / 255.0).opacity(rayAlpha)
        let cMid = Color(red: 14.0 / 255.0, green: 165.0 / 255.0, blue: 233.0 / 255.0).opacity(rayAlpha * 0.35)
        let grad = Gradient(colors: [cTop, cMid, Color.clear])

        ctx.fill(
            path,
            with: .linearGradient(
                grad,
                startPoint: CGPoint(x: topX, y: 0.0),
                endPoint: CGPoint(x: topX + 35.0, y: bottomY)
            )
        )
    }

    private func drawRisingBubble(
        ctx: inout GraphicsContext,
        widthD: Double,
        heightD: Double,
        t: Double,
        bIdx: Int
    ) {
        let idxD: Double = Double(bIdx)
        let mod7D: Double = Double(bIdx % 7)
        let mod4D: Double = Double(bIdx % 4)
        let mod5D: Double = Double(bIdx % 5)

        let seed: Double = idxD * 137.5
        let speed: Double = 22.0 + mod7D * 6.5
        let cycleSpan: Double = heightD + 60.0
        let travelY: Double = (t * speed + seed).truncatingRemainder(dividingBy: cycleSpan)
        let rawY: Double = (heightD + 40.0) - travelY

        let baseX: Double = (seed * 3.7).truncatingRemainder(dividingBy: widthD)
        let wobbleAmp: Double = 8.0 + mod4D * 3.0
        let wobbleX: Double = sin(t * 2.1 + idxD) * wobbleAmp
        let bx: Double = baseX + wobbleX
        let radius: Double = 2.2 + mod5D * 1.35
        let diameter: Double = radius * 2.0
        let pulse: Double = 0.32 + 0.24 * sin(t * 2.8 + idxD)

        let bubbleRect = CGRect(x: bx - radius, y: rawY - radius, width: diameter, height: diameter)
        if bIdx % 3 == 0 {
            ctx.fill(
                Path(ellipseIn: bubbleRect),
                with: .color(Color.cyan.opacity(pulse * 0.75))
            )
        } else {
            let rimColor = Color(red: 186.0 / 255.0, green: 230.0 / 255.0, blue: 253.0 / 255.0).opacity(pulse)
            ctx.stroke(
                Path(ellipseIn: bubbleRect),
                with: .color(rimColor),
                lineWidth: 1.1
            )
            let specOffset: Double = radius * 0.45
            let specRect = CGRect(
                x: bx - specOffset,
                y: rawY - specOffset,
                width: specOffset,
                height: specOffset
            )
            ctx.fill(
                Path(ellipseIn: specRect),
                with: .color(Color.white.opacity(pulse * 0.9))
            )
        }
    }

    @ViewBuilder
    private func brandLogoSection(fullW: CGFloat, fullH: CGFloat, t: Double) -> some View {
        let breatheScale: CGFloat = CGFloat(1.0 + 0.028 * sin(t * 2.3))
        let floatOffsetY: CGFloat = CGFloat(sin(t * 1.7) * 4.5)
        let glowAlpha: Double = 0.42 + 0.18 * sin(t * 2.3)
        let titleAspect: CGFloat = 1323.0 / 371.0
        let maxWByHeight: CGFloat = (fullH * 0.34) * titleAspect
        let logoW: CGFloat = min(680.0, min(fullW * 0.70, maxWByHeight))
        let logoH: CGFloat = logoW / titleAspect

        if let logoImg = atlasManager.loadingLogoImage() {
            Image(uiImage: logoImg)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: logoW, height: logoH)
                .scaleEffect(breatheScale)
                .offset(y: floatOffsetY)
                .shadow(color: Color.cyan.opacity(glowAlpha), radius: 18, x: 0, y: 4)
                .shadow(color: Color.black.opacity(0.9), radius: 14, x: 0, y: 6)
        }
    }

    private func mascotAndProgressSection(
        barW: CGFloat,
        barH: CGFloat,
        fullH: CGFloat,
        progress: Double,
        t: Double
    ) -> some View {
        let mascotW: CGFloat = 68.0
        let mascotH: CGFloat = 42.0
        let progressCG: CGFloat = CGFloat(progress)
        let mascotX: CGFloat = -barW * 0.5 + barW * progressCG
        let swimPitch: Double = sin(t * 9.5) * 4.8
        let swimBobY: CGFloat = CGFloat(cos(t * 6.5) * 2.8)
        let fillW: CGFloat = max(barH, barW * progressCG)
        let pctInt: Int = Int((progress * 100.0).rounded())
        let stageText: String = vm.lang == "zh" ? atlasManager.loadingStageZh : atlasManager.loadingStageEn

        return VStack(spacing: 8) {
            ZStack {
                ForEach(0..<4, id: \\.self) { wakeIdx in
                    mascotWakeBubble(wakeIdx: wakeIdx, mascotX: mascotX, swimBobY: swimBobY, t: t)
                }

                if let mascotImg = atlasManager.loadingMascotImage() {
                    Image(uiImage: mascotImg)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFit()
                        .frame(width: mascotW, height: mascotH)
                        .rotationEffect(.degrees(swimPitch))
                        .offset(x: mascotX, y: swimBobY)
                        .shadow(color: Color.cyan.opacity(0.75), radius: 8, x: 0, y: 2)
                }
            }
            .frame(width: barW, height: mascotH + 6.0)
            .animation(.easeOut(duration: 0.22), value: progress)

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color(red: 2.0 / 255.0, green: 10.0 / 255.0, blue: 24.0 / 255.0).opacity(0.88))
                    .frame(width: barW, height: barH)
                    .overlay(
                        Capsule()
                            .stroke(Color.cyan.opacity(0.42), lineWidth: 1.2)
                    )

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 2.0 / 255.0, green: 132.0 / 255.0, blue: 199.0 / 255.0),
                                Color(red: 34.0 / 255.0, green: 211.0 / 255.0, blue: 238.0 / 255.0),
                                Color(red: 110.0 / 255.0, green: 231.0 / 255.0, blue: 183.0 / 255.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: fillW, height: barH - 2.0)
                    .padding(.leading, 1)
                    .shadow(color: Color.cyan.opacity(0.8), radius: 6)
                    .animation(.easeOut(duration: 0.22), value: progress)
            }
            .frame(width: barW, height: barH)

            HStack {
                Text(stageText)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundColor(Color(red: 186.0 / 255.0, green: 230.0 / 255.0, blue: 253.0 / 255.0).opacity(0.92))
                Spacer()
                Text("\\(pctInt)%")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.cyan)
            }
            .frame(width: barW)
        }
        .padding(.bottom, max(22.0, fullH * 0.07))
    }

    private func mascotWakeBubble(
        wakeIdx: Int,
        mascotX: CGFloat,
        swimBobY: CGFloat,
        t: Double
    ) -> some View {
        let wSeed: Double = Double(wakeIdx)
        let wakePhase: Double = (t * 3.8 + wSeed * 0.25).truncatingRemainder(dividingBy: 1.0)
        let bubbleAlpha: Double = (1.0 - wakePhase) * 0.75
        let bubbleDiameter: CGFloat = CGFloat(6.5 - wakePhase * 3.5)
        let trailDx: CGFloat = CGFloat(28.0 + wakePhase * 26.0)
        let trailDy: CGFloat = CGFloat(sin(t * 8.0 + wSeed) * 4.0)

        return Circle()
            .fill(Color.cyan.opacity(bubbleAlpha))
            .frame(width: bubbleDiameter, height: bubbleDiameter)
            .offset(x: mascotX - trailDx, y: swimBobY + trailDy)
    }
}

// MARK: - 3. Main ContentView (Title, Playing HUD, Sonar Joystick, MOBA Fan, Pause & GameOver)

public struct ContentView: View {
    @StateObject private var vm = GameViewModel()
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared
    @ObservedObject private var adManager = GoogleAdMobManager.shared
    @State private var scene: OceanGameScene = {
        let s = OceanGameScene(size: CGSize(width: 844, height: 390))
        s.scaleMode = .resizeFill
        return s
    }()
    @State private var knobOffset: CGSize = .zero

    public init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
    }

    public var body: some View {
        GeometryReader { geo in
            let isCompactH: Bool = geo.size.height < 430
            ZStack {
                // 0. Base Abyssal Backdrop (#061528) so the root container is never black
                Color(red: 6.0 / 255.0, green: 21.0 / 255.0, blue: 40.0 / 255.0)
                    .ignoresSafeArea()

                // 1. Native Metal-Accelerated SpriteKit Ocean Canvas (Zero WebView!)
                oceanSpriteCanvasLayer

                // 2. Active Gameplay or Title Screen HUD Layer
                activeStateHudLayer(geo: geo, isCompactH: isCompactH)

                // 3. Pause, GameOver & 48-Shark Evolution Atlas Modals
                modalAndAtlasLayer(geo: geo)

                // 4. Ad Connection, Ad Alert & Layer 2 Dynamic Startup Loading Overlay
                systemAndStartupOverlayLayer
            }
        }
        .statusBarHidden(true)
    }

    private var oceanSpriteCanvasLayer: some View {
        SpriteView(scene: scene, preferredFramesPerSecond: 120)
            .ignoresSafeArea()
            .onAppear {
                atlasManager.startAsyncPreloadIfNeeded()
                scene.viewModel = vm
                scene.refreshSharkTexture()
            }
            .onChange(of: atlasManager.isReady) { ready in
                if ready {
                    scene.onAtlasPreloadCompleted()
                }
            }
            .onChange(of: vm.save.selectedSharkId) { _ in
                scene.refreshSharkTexture()
            }
            .onChange(of: vm.trialSharkIdForRun) { _ in
                scene.refreshSharkTexture()
            }
    }

    @ViewBuilder
    private func activeStateHudLayer(geo: GeometryProxy, isCompactH: Bool) -> some View {
        if vm.gameState == "playing" {
            VStack(spacing: 3) {
                HStack(alignment: .top, spacing: 8) {
                    UiAvatarDataBarView(vm: vm, height: isCompactH ? 56 : 64)
                    Spacer(minLength: 4)
                    telemetryPill(isCompact: isCompactH)
                    Spacer(minLength: 4)
                    pauseMedallionButton
                }
                .padding(.horizontal, 12)
                .padding(.top, 6)

                hudRow2Overlays
                    .allowsHitTesting(false)
                Spacer()
            }

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
        } else if vm.gameState == "title" {
            titleScreenOverlay(geo: geo)
        }
    }

    @ViewBuilder
    private func modalAndAtlasLayer(geo: GeometryProxy) -> some View {
        if vm.gameState == "paused" {
            pauseModalOverlay(geo: geo)
        }
        if vm.gameState == "gameover" {
            gameOverModalOverlay(geo: geo)
        }
        if vm.showEvolutionAtlas {
            EvolutionAtlasSheetView(vm: vm)
                .transition(.opacity)
                .zIndex(50)
        }
    }

    @ViewBuilder
    private var systemAndStartupOverlayLayer: some View {
        if adManager.isConnectingAd {
            ZStack {
                Color.black.opacity(0.72).ignoresSafeArea()
                VStack(spacing: 14) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .yellow))
                        .scaleEffect(1.6)
                    Text(vm.lang == "zh" ? "正在连接 Google 激励视频广告..." : "Connecting to Google Video Ad...")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                    Text(vm.lang == "zh" ? "广告准备中，即将为您全屏播放" : "Preparing full-screen player...")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white.opacity(0.7))
                }
                .padding(24)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(red: 15.0 / 255.0, green: 23.0 / 255.0, blue: 42.0 / 255.0).opacity(0.96))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.yellow.opacity(0.7), lineWidth: 1.5))
                )
            }
            .zIndex(75)
            .transition(.opacity)
        }

        if let msg = vm.adUnavailableMessage {
            adUnavailableAlertModal(message: msg)
                .zIndex(85)
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
        }

        if !atlasManager.isReady {
            StartupLoadingView(vm: vm, atlasManager: atlasManager)
                .zIndex(200)
                .transition(.opacity)
        }
    }

    // MARK: - Title Screen Overlay
    private func titleScreenOverlay(geo: GeometryProxy) -> some View {
        let showcase = vm.nextShowcaseSharkForm
        let showcaseName = vm.lang == "zh" ? showcase.nameZh : showcase.nameEn
        let screenBounds = UIScreen.main.bounds.size
        let fullW = max(geo.size.width, screenBounds.width)
        let fullH = max(geo.size.height, screenBounds.height)
        // Exact 1323x371 (3.566:1) aspect ratio box so SwiftUI never adds vertical centering dead space above the title
        let titleAspect: CGFloat = 1323.0 / 371.0
        let maxTitleH = fullH * 0.36
        let targetTitleW = min(760.0, min(fullW * 0.74, maxTitleH * titleAspect))
        let targetTitleH = targetTitleW / titleAspect
        let btnW = min(226.0, max(168.0, (geo.size.width - 56.0) / 3.0))
        let btnH = max(50.0, btnW / 3.6)

        return ZStack {
            // Matching radial vignette from Web preview so white brush title pops against shallow water
            RadialGradient(
                gradient: Gradient(colors: [
                    Color(red: 2/255, green: 132/255, blue: 199/255).opacity(0.12),
                    Color(red: 2/255, green: 6/255, blue: 23/255).opacity(0.76)
                ]),
                center: UnitPoint(x: 0.5, y: 0.35),
                startRadius: 20,
                endRadius: max(fullW, fullH) * 0.7
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                // Upper Title Banner (Wide 3.57:1 horizontal banner title3_cae0290c.png, pinned flush to top)
                if let titleImg = SpriteAtlasManager.shared.titleLogoImage() {
                    Image(uiImage: titleImg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: targetTitleW, height: targetTitleH, alignment: .top)
                        .shadow(color: .black.opacity(0.9), radius: 16, x: 0, y: 6)
                        .padding(.top, 2)
                } else {
                    Text(vm.t("game_title"))
                        .font(.system(size: min(40, max(26, geo.size.width * 0.05)), weight: .black))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, Color(red: 165/255, green: 243/255, blue: 252/255), Color.cyan],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .shadow(color: .black.opacity(0.85), radius: 8, x: 0, y: 3)
                        .padding(.top, 6)
                }

                Spacer(minLength: 0)

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
                        vm.showRewardedAd(kind: .TRIAL_SHARK)
                    }
                )
            }
            .padding(.bottom, 8)
            }
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

public struct FixedEvolutionHudButton: View {
    @ObservedObject var vm: GameViewModel
    @State private var isPulsing: Bool = false

    public var body: some View {
        let nextTarget = GameRules.getNextEvolutionTarget(save: vm.save)
        let evoReady = nextTarget?.check.canUnlockNow ?? false
        let targetForm = nextTarget?.form

        Button {
            vm.playUiTick()
            if evoReady {
                vm.evolveToNextReadySharkInRun()
            } else {
                vm.showEvolutionAtlas = true
            }
        } label: {
            ZStack {
                // 1. 特效：满足条件时的跳动光圈与金色/翠绿放射辉光
                if evoReady {
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [.yellow, .green, .mint, .yellow],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3.0
                        )
                        .frame(width: 58, height: 58)
                        .scaleEffect(isPulsing ? 1.15 : 1.0)
                        .opacity(isPulsing ? 1.0 : 0.45)
                        .shadow(color: .green.opacity(0.85), radius: isPulsing ? 10 : 4)

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.green.opacity(0.35), Color.clear],
                                center: .center,
                                startRadius: 4,
                                endRadius: 30
                            )
                        )
                        .frame(width: 60, height: 60)
                        .scaleEffect(isPulsing ? 1.12 : 0.95)
                }

                // 2. 底盘圆形
                Circle()
                    .fill(
                        evoReady
                            ? RadialGradient(
                                colors: [Color(red: 6/255, green: 78/255, blue: 59/255).opacity(0.95), Color(red: 2/255, green: 22/255, blue: 18/255).opacity(0.98)],
                                center: .center,
                                startRadius: 4,
                                endRadius: 28
                              )
                            : RadialGradient(
                                colors: [Color(red: 15/255, green: 23/255, blue: 42/255).opacity(0.92), Color(red: 4/255, green: 10/255, blue: 24/255).opacity(0.96)],
                                center: .center,
                                startRadius: 4,
                                endRadius: 28
                              )
                    )
                    .frame(width: 52, height: 52)
                    .overlay(
                        Circle()
                            .stroke(
                                evoReady ? Color.yellow : Color.cyan.opacity(0.4),
                                lineWidth: evoReady ? 2.2 : 1.5
                            )
                    )
                    .shadow(color: evoReady ? Color.yellow.opacity(0.65) : Color.black.opacity(0.5), radius: 6)

                // 3. 中心图标：满足条件时换成最近一条可进化的鲨鱼！不满足时显示进化图鉴图标
                if evoReady, let target = targetForm {
                    if let img = SpriteAtlasManager.shared.sharkUIImage(for: target.spriteKey) {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 28)
                            .shadow(color: .green, radius: 4)
                            .scaleEffect(isPulsing ? 1.08 : 0.96)
                    } else {
                        UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 36)
                    }
                } else {
                    UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 34)
                        .opacity(0.85)
                }

                // 4. 上下方文案
                VStack(spacing: 0) {
                    Text(evoReady ? (vm.lang == "zh" ? "⚡立即进化" : "EVOLVE") : (vm.lang == "zh" ? "进化图鉴" : "ATLAS"))
                        .font(.system(size: 7.5, weight: .black))
                        .foregroundColor(evoReady ? .yellow : .white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 0.8)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.88))
                                .overlay(Capsule().stroke(evoReady ? Color.yellow.opacity(0.8) : Color.cyan.opacity(0.3), lineWidth: 0.8))
                        )

                    Spacer()

                    if evoReady, let target = targetForm {
                        Text(vm.lang == "zh" ? target.nameZh : target.nameEn)
                            .font(.system(size: 7.5, weight: .black))
                            .foregroundColor(Color(red: 167/255, green: 243/255, blue: 208/255))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 0.6)
                            .background(Capsule().fill(Color.black.opacity(0.9)))
                    } else if let target = targetForm {
                        Text("🪙\\(target.unlockCoins)")
                            .font(.system(size: 7.5, weight: .black, design: .monospaced))
                            .foregroundColor(.gray)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 0.6)
                            .background(Capsule().fill(Color.black.opacity(0.85)))
                    } else {
                        Text("MAX")
                            .font(.system(size: 7.5, weight: .black, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                }
                .frame(height: 58)
            }
            .frame(width: 58, height: 60)
            .scaleEffect(evoReady && isPulsing ? 1.08 : 1.0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.65).repeatForever(autoreverses: true)) {
                    isPulsing = true
                }
            }
        }
        .buttonStyle(.plain)
    }
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
            // 0. Fixed Evolution Button directly above Body Upgrade (x: -4, y: -164)
            FixedEvolutionHudButton(vm: vm)
                .offset(x: -4, y: -164)

            // Optional Emergency Supply Drop when short on all resources
            if !canGold && !canGene && !canUpgrade && !evoReady {
                skillFanSatelliteButton(
                    iconKey: "UI_ICON_GIFT",
                    label: vm.lang == "zh" ? "免费空投" : "AIRDROP",
                    costText: "📺+300🪙+25🧬",
                    ringColor: .yellow,
                    enabled: true,
                    pulse: true
                ) {
                    vm.showRewardedAd(kind: .SUPPLY_DROP)
                }
                .offset(x: -116, y: -70)
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
                                vm.showRewardedAd(kind: .REVIVE)
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
                                vm.showRewardedAd(kind: .DOUBLE_SETTLEMENT)
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

    // MARK: - Ad Unavailable Alert Modal (Replaces 3s simulation on iOS)
    private func adUnavailableAlertModal(message: String) -> some View {
        ZStack {
            Color.black.opacity(0.82)
                .ignoresSafeArea()
                .onTapGesture {
                    vm.dismissAdUnavailableAlert()
                }

            VStack(spacing: 16) {
                // Header Icon & Title
                VStack(spacing: 8) {
                    Text("📺")
                        .font(.system(size: 38))
                    Text(vm.lang == "zh" ? "广告提示" : "Ad Notice")
                        .font(.system(size: 20, weight: .black))
                        .foregroundColor(.white)
                }

                // Description
                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color(red: 224/255, green: 242/255, blue: 254/255))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)

                // Close / Acknowledge Button
                Button {
                    vm.dismissAdUnavailableAlert()
                } label: {
                    Text(vm.lang == "zh" ? "知道了" : "Dismiss")
                        .font(.system(size: 15, weight: .black))
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            LinearGradient(
                                colors: [Color.yellow, Color(red: 245/255, green: 158/255, blue: 11/255)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .cornerRadius(22)
                        .shadow(color: Color.yellow.opacity(0.4), radius: 6, x: 0, y: 2)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .padding(.top, 4)
            }
            .padding(24)
            .frame(width: 320)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(red: 15/255, green: 23/255, blue: 42/255).opacity(0.96))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.white.opacity(0.18), lineWidth: 1.5)
                    )
            )
            .shadow(color: .black.opacity(0.6), radius: 24, x: 0, y: 10)
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
                            vm.showRewardedAd(kind: .SUPPLY_DROP)
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
import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock = UIInterfaceOrientationMask.landscape

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Ensure system UIWindow background matches LaunchBg (#061528) so there is zero black flash
        let abyssalBg = UIColor(red: 6/255, green: 21/255, blue: 40/255, alpha: 1.0)
        UIWindow.appearance().backgroundColor = abyssalBg
        return true
    }

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        return AppDelegate.orientationLock
    }
}

@main
struct HungrySharkEvolutionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        UIWindow.appearance().backgroundColor = UIColor(red: 6/255, green: 21/255, blue: 40/255, alpha: 1.0)
    }

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
        <key>UIImageName</key>
        <string>LaunchLogo</string>
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
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>GADApplicationIdentifier</key>
    <string>${GOOGLE_ADS_CONFIG.admobAppId}</string>
    <key>NSUserTrackingUsageDescription</key>
    <string>允许追踪以提供个性化深海狩猎激励视频广告体验</string>
    <key>SKAdNetworkItems</key>
    <array>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>cstr6suwn9.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>4fzdc2evr5.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>2fnua5tdw4.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>ydx93a7ass.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>p78axxw29g.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>v72qych5uu.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>mlmmfzh3r3.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>c6kg9kv798.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>wzmmz9fp6w.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>yclnxrl5pm.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>t38b2kh725.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>7ug5zh24hu.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>gta9lk7p23.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>v9wttpbfk9.skadnetwork</string>
        </dict>
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>n38lu8286q.skadnetwork</string>
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
packages:
  GoogleMobileAds:
    url: https://github.com/googleads/swift-package-manager-google-mobile-ads.git
    from: 11.2.0
targets:
  HungrySharkEvolution:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources:
      - path: HungrySharkEvolution
        excludes:
          - "Resources/Assets/*.png"
          - "Resources/Assets/*.jpg"
      - path: HungrySharkEvolution/Resources/Assets
        type: folder
        buildPhase: resources
    dependencies:
      - package: GoogleMobileAds
        product: GoogleMobileAds
    info:
      path: HungrySharkEvolution/Info.plist
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.deepsea.hungryshark.evolution
        MARKETING_VERSION: 1.0.0
        CURRENT_PROJECT_VERSION: 1
        SWIFT_VERSION: 5.9
        TARGETED_DEVICE_FAMILY: "1,2"
        OTHER_LDFLAGS: "-ObjC"
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_FILE: HungrySharkEvolution/Info.plist
        DEVELOPMENT_TEAM: 3N2FUK7M23
        CODE_SIGN_STYLE: Automatic
        INFOPLIST_KEY_CFBundleDisplayName: "deepsea:evolution"
        INFOPLIST_KEY_GADApplicationIdentifier: "${GOOGLE_ADS_CONFIG.admobAppId}"
        INFOPLIST_KEY_GADIsAdManagerApp: YES
        INFOPLIST_KEY_NSUserTrackingUsageDescription: "允许追踪以提供个性化深海狩猎激励视频广告体验"
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
    dependencies: [
        .package(url: "https://github.com/googleads/swift-package-manager-google-mobile-ads.git", from: "11.2.0")
    ],
    targets: [
        .target(
            name: "HungrySharkEvolutionCore",
            dependencies: [
                .product(name: "GoogleMobileAds", package: "swift-package-manager-google-mobile-ads", condition: .when(platforms: [.iOS]))
            ],
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

function generatePbxproj(assetFiles: string[] = []): string {
  // Valid Xcode 15/16 project.pbxproj referencing all 6 Swift files, Assets.xcassets, the bundled Assets folder,
  // GoogleMobileAds Swift Package (with strictly quoted minimumVersion = "11.2.0"),
  // AND every individual PNG/JPG asset (including shark_form_00@3x.png .. shark_form_47@3x.png, prey_140 @3x PNGs, and world seabed/ecology/POI JPG atlases).
  const sortedAssets = [...assetFiles]
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && (f.endsWith('.png') || f.endsWith('.jpg')))
    .sort();

  const assetBuildFiles = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      return `\t\tB100${idxHex}2B00000000000001 /* ${f} in Resources */ = {isa = PBXBuildFile; fileRef = B200${idxHex}2B00000000000001 /* ${f} */; };`;
    })
    .join('\n');

  const assetFileRefs = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      const fileType = f.endsWith('.jpg') ? 'image.jpeg' : 'image.png';
      return `\t\tB200${idxHex}2B00000000000001 /* ${f} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; name = "${f}"; path = "Resources/Assets/${f}"; sourceTree = "<group>"; };`;
    })
    .join('\n');

  const assetResourceEntries = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      return `\t\t\t\tB100${idxHex}2B00000000000001 /* ${f} in Resources */,`;
    })
    .join('\n');

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
		A10000082B00000000000001 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A20000102B00000000000001 /* Assets.xcassets */; };
		A10000092B00000000000001 /* GoogleMobileAds in Frameworks */ = {isa = PBXBuildFile; productRef = A99000022B00000000000001 /* GoogleMobileAds */; };
${assetBuildFiles}
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		A00000012B00000000000001 /* HungrySharkEvolution.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = HungrySharkEvolution.app; sourceTree = BUILT_PRODUCTS_DIR; };
		A20000012B00000000000001 /* HungrySharkEvolutionApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HungrySharkEvolutionApp.swift; sourceTree = "<group>"; };
		A20000022B00000000000001 /* GameConfigGenerated.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Generated/GameConfigGenerated.swift"; sourceTree = "<group>"; };
		A20000032B00000000000001 /* GameRules.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Core/GameRules.swift"; sourceTree = "<group>"; };
		A20000042B00000000000001 /* SpriteAtlasManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Rendering/SpriteAtlasManager.swift"; sourceTree = "<group>"; };
		A20000052B00000000000001 /* OceanGameScene.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Rendering/OceanGameScene.swift"; sourceTree = "<group>"; };
		A20000062B00000000000001 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "UI/ContentView.swift"; sourceTree = "<group>"; };
		A20000072B00000000000001 /* Assets */ = {isa = PBXFileReference; lastKnownFileType = folder; path = "Resources/Assets"; sourceTree = "<group>"; };
		A20000082B00000000000001 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
		A20000102B00000000000001 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
${assetFileRefs}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		A30000012B00000000000001 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000092B00000000000001 /* GoogleMobileAds in Frameworks */,
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
				A20000102B00000000000001 /* Assets.xcassets */,
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
			packageProductDependencies = (
				A99000022B00000000000001 /* GoogleMobileAds */,
			);
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
			packageReferences = (
				A99000012B00000000000001 /* XCRemoteSwiftPackageReference "swift-package-manager-google-mobile-ads" */,
			);
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
				A10000082B00000000000001 /* Assets.xcassets in Resources */,
				A10000072B00000000000001 /* Assets in Resources */,
${assetResourceEntries}
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
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				ONLY_ACTIVE_ARCH = YES;
				OTHER_LDFLAGS = "-ObjC";
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
				SWIFT_VERSION = "5.0";
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
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				MTL_ENABLE_DEBUG_INFO = NO;
				OTHER_LDFLAGS = "-ObjC";
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				SWIFT_OPTIMIZATION_LEVEL = "-O";
				SWIFT_VERSION = "5.0";
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		A90000032B00000000000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_FILE = "HungrySharkEvolution/Info.plist";
				INFOPLIST_KEY_CFBundleDisplayName = "deepsea:evolution";
				INFOPLIST_KEY_GADApplicationIdentifier = "${GOOGLE_ADS_CONFIG.admobAppId}";
				INFOPLIST_KEY_GADIsAdManagerApp = YES;
				INFOPLIST_KEY_NSUserTrackingUsageDescription = "Allow tracking to deliver personalized rewarded video ads.";
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = "1.0.0";
				OTHER_LDFLAGS = "-ObjC";
				PRODUCT_BUNDLE_IDENTIFIER = "com.deepsea.hungryshark.evolution";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = "5.0";
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		A90000042B00000000000001 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_FILE = "HungrySharkEvolution/Info.plist";
				INFOPLIST_KEY_CFBundleDisplayName = "deepsea:evolution";
				INFOPLIST_KEY_GADApplicationIdentifier = "${GOOGLE_ADS_CONFIG.admobAppId}";
				INFOPLIST_KEY_GADIsAdManagerApp = YES;
				INFOPLIST_KEY_NSUserTrackingUsageDescription = "Allow tracking to deliver personalized rewarded video ads.";
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = "1.0.0";
				OTHER_LDFLAGS = "-ObjC";
				PRODUCT_BUNDLE_IDENTIFIER = "com.deepsea.hungryshark.evolution";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = "5.0";
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

/* Begin XCRemoteSwiftPackageReference section */
		A99000012B00000000000001 /* XCRemoteSwiftPackageReference "swift-package-manager-google-mobile-ads" */ = {
			isa = XCRemoteSwiftPackageReference;
			repositoryURL = "https://github.com/googleads/swift-package-manager-google-mobile-ads.git";
			requirement = {
				kind = upToNextMajorVersion;
				minimumVersion = "11.2.0";
			};
		};
/* End XCRemoteSwiftPackageReference section */

/* Begin XCSwiftPackageProductDependency section */
		A99000022B00000000000001 /* GoogleMobileAds */ = {
			isa = XCSwiftPackageProductDependency;
			package = A99000012B00000000000001 /* XCRemoteSwiftPackageReference "swift-package-manager-google-mobile-ads" */;
			productName = GoogleMobileAds;
		};
/* End XCSwiftPackageProductDependency section */
	};
	rootObject = A70000012B00000000000001 /* Project object */;
}
`;
}

/**
 * Validates that the generated project.pbxproj strictly conforms to Xcode's OpenStep PropertyList grammar:
 * 1. Pure ASCII only (prevents CFPropertyList encoding rejections).
 * 2. No unquoted multi-dot version numbers (e.g. minimumVersion = 11.2.0; or MARKETING_VERSION = 1.0.0;).
 * 3. No empty array elements / stray commas / balanced braces & parentheses.
 */
function validateOpenStepPbxproj(pbx: string): void {
  for (let i = 0; i < pbx.length; i++) {
    const code = pbx.charCodeAt(i);
    if (code > 127) {
      throw new Error(
        `[build:ios] OpenStep Plist validation failed: Non-ASCII character (code ${code}) at offset ${i}`
      );
    }
  }
  const stripped = pbx.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/=\s*\d+\.\d+\.\d+\s*;/.test(stripped)) {
    throw new Error(
      `[build:ios] OpenStep Plist validation failed: Unquoted semantic version detected in project.pbxproj`
    );
  }
  if (/,\s*,/.test(stripped) || /\(\s*,/.test(stripped)) {
    throw new Error(
      `[build:ios] OpenStep Plist validation failed: Empty array item / stray comma detected in project.pbxproj`
    );
  }
  let braceDepth = 0;
  let parenDepth = 0;
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '"' && stripped[i - 1] !== '\\') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
      if (braceDepth < 0 || parenDepth < 0) {
        throw new Error(
          `[build:ios] OpenStep Plist validation failed: Unbalanced delimiter at offset ${i}`
        );
      }
    }
  }
  if (inQuotes || braceDepth !== 0 || parenDepth !== 0) {
    throw new Error(
      `[build:ios] OpenStep Plist validation failed: Unclosed quotes or delimiters (brace=${braceDepth}, paren=${parenDepth})`
    );
  }
}

function generateLaunchAssetsCatalog(appDir: string, srcAssetsDir: string): void {
  const xcassetsDir = path.join(appDir, 'Assets.xcassets');
  const appIconDir = path.join(xcassetsDir, 'AppIcon.appiconset');
  const launchBgDir = path.join(xcassetsDir, 'LaunchBg.colorset');
  const launchLogoDir = path.join(xcassetsDir, 'LaunchLogo.imageset');
  ensureDir(appIconDir);
  ensureDir(launchBgDir);
  ensureDir(launchLogoDir);

  fs.writeFileSync(
    path.join(xcassetsDir, 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
    'utf8'
  );

  // 0. AppIcon.appiconset (Required by actool when ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon)
  const iconCandidates = [
    path.join(srcAssetsDir, 'app_icon_1024.png'),
    path.join(srcAssetsDir, 'loading_mascot.png'),
  ];
  for (const candidate of iconCandidates) {
    if (fs.existsSync(candidate)) {
      fs.copyFileSync(candidate, path.join(appIconDir, 'AppIcon.png'));
      break;
    }
  }
  fs.writeFileSync(
    path.join(appIconDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          {
            filename: 'AppIcon.png',
            idiom: 'universal',
            platform: 'ios',
            size: '1024x1024',
          },
        ],
        info: {
          author: 'xcode',
          version: 1,
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  // 1. Deep-sea abyssal blue (#061528) for Layer 1 UILaunchScreen background
  fs.writeFileSync(
    path.join(launchBgDir, 'Contents.json'),
    JSON.stringify(
      {
        colors: [
          {
            color: {
              'color-space': 'srgb',
              components: {
                alpha: '1.000',
                blue: '0x28',
                green: '0x15',
                red: '0x06',
              },
            },
            idiom: 'universal',
          },
          {
            appearances: [
              {
                appearance: 'luminosity',
                value: 'dark',
              },
            ],
            color: {
              'color-space': 'srgb',
              components: {
                alpha: '1.000',
                blue: '0x28',
                green: '0x15',
                red: '0x06',
              },
            },
            idiom: 'universal',
          },
        ],
        info: {
          author: 'xcode',
          version: 1,
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  // 2. Copy loading_logo.png (or fallback title3_cae0290c.png) into LaunchLogo.imageset
  const logoCandidates = [
    path.join(srcAssetsDir, 'loading_logo.png'),
    path.join(srcAssetsDir, 'title3_cae0290c.png'),
  ];
  for (const candidate of logoCandidates) {
    if (fs.existsSync(candidate)) {
      fs.copyFileSync(candidate, path.join(launchLogoDir, 'loading_logo.png'));
      break;
    }
  }

  fs.writeFileSync(
    path.join(launchLogoDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          {
            filename: 'loading_logo.png',
            idiom: 'universal',
            scale: '1x',
          },
          {
            idiom: 'universal',
            scale: '2x',
          },
          {
            idiom: 'universal',
            scale: '3x',
          },
        ],
        info: {
          author: 'xcode',
          version: 1,
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

function main() {
  ensureDir(path.join(APP_DIR, 'Generated'));
  ensureDir(path.join(APP_DIR, 'Core'));
  ensureDir(path.join(APP_DIR, 'Rendering'));
  ensureDir(path.join(APP_DIR, 'UI'));
  const assetsDst = path.join(APP_DIR, 'Resources', 'Assets');
  ensureDir(assetsDst);
  const xcodeprojDir = path.join(IOS_ROOT, 'HungrySharkEvolution.xcodeproj');
  const xcworkspaceDir = path.join(xcodeprojDir, 'project.xcworkspace');
  ensureDir(xcodeprojDir);
  ensureDir(xcworkspaceDir);

  // Clean up any stale Xcode user session caches (xcuserdata) that can trigger InitialEditorMissingFile
  for (const staleUserDir of [
    path.join(xcodeprojDir, 'xcuserdata'),
    path.join(xcworkspaceDir, 'xcuserdata'),
  ]) {
    if (fs.existsSync(staleUserDir)) {
      fs.rmSync(staleUserDir, { recursive: true, force: true });
    }
  }

  // Write clean project.xcworkspace/contents.xcworkspacedata
  fs.writeFileSync(
    path.join(xcworkspaceDir, 'contents.xcworkspacedata'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<Workspace\n   version = "1.0">\n   <FileRef\n      location = "self:">\n   </FileRef>\n</Workspace>\n`,
    'utf8'
  );

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

  // 2. Copy all PNG & JPG assets from public/assets/aistudio, 48 individual @3x shark PNGs from public/assets/sharks_3x,
  //    and 140 individual @3x prey PNGs from public/assets/prey_140 into ios-native/HungrySharkEvolution/Resources/Assets
  const srcAssetsDir = path.join(ROOT_DIR, 'public', 'assets', 'aistudio');
  generateLaunchAssetsCatalog(APP_DIR, srcAssetsDir);

  let copiedCount = 0;
  if (fs.existsSync(srcAssetsDir)) {
    for (const file of fs.readdirSync(srcAssetsDir)) {
      if (file.endsWith('.png') || file.endsWith('.jpg')) {
        fs.copyFileSync(
          path.join(srcAssetsDir, file),
          path.join(assetsDst, file)
        );
        copiedCount++;
      }
    }
  }
  const srcSharks3xDir = path.join(ROOT_DIR, 'public', 'assets', 'sharks_3x');
  if (fs.existsSync(srcSharks3xDir)) {
    for (const file of fs.readdirSync(srcSharks3xDir)) {
      if (file.endsWith('.png')) {
        fs.copyFileSync(
          path.join(srcSharks3xDir, file),
          path.join(assetsDst, file)
        );
        copiedCount++;
      }
    }
  }
  const srcPrey140Dir = path.join(ROOT_DIR, 'public', 'assets', 'prey_140');
  if (fs.existsSync(srcPrey140Dir)) {
    for (const file of fs.readdirSync(srcPrey140Dir)) {
      if (file.endsWith('.png')) {
        fs.copyFileSync(
          path.join(srcPrey140Dir, file),
          path.join(assetsDst, file)
        );
        copiedCount++;
      }
    }
  }

  // 3. Write XcodeGen spec (project.yml) & Package.swift, then generate or preserve project.pbxproj
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

  const pbxprojPath = path.join(xcodeprojDir, 'project.pbxproj');
  const existingPbxproj = fs.existsSync(pbxprojPath)
    ? fs.readFileSync(pbxprojPath, 'utf8')
    : '';

  // Generate 100% Apple-compliant project.pbxproj via XcodeGen if available
  let xcodegenSuccess = false;
  try {
    child_process.execSync('xcodegen generate', { cwd: IOS_ROOT, stdio: 'pipe' });
    xcodegenSuccess = true;
    console.log('[build:ios] ✅ Generated Xcode project via XcodeGen (100% Apple native format).');
  } catch {
    if (existingPbxproj.includes('objectVersion = 77')) {
      xcodegenSuccess = true;
      console.log('[build:ios] ℹ️ Preserved existing XcodeGen project.pbxproj (objectVersion = 77).');
    } else {
      console.warn('[build:ios] ⚠️ XcodeGen not available, falling back to built-in OpenStep template.');
    }
  }

  if (!xcodegenSuccess) {
    const allBundledAssetFiles = fs
      .readdirSync(assetsDst)
      .filter((f) => f.endsWith('.png') || f.endsWith('.jpg'));
    const pbxprojContent = generatePbxproj(allBundledAssetFiles);
    validateOpenStepPbxproj(pbxprojContent);
    fs.writeFileSync(pbxprojPath, pbxprojContent, 'utf8');
  }

  // Clean stale UI session state so Xcode opens fresh without "InitialEditorMissingFile" or corrupted cache
  const xcuserState = path.join(
    IOS_ROOT,
    'HungrySharkEvolution.xcodeproj',
    'project.xcworkspace',
    'xcuserdata'
  );
  if (fs.existsSync(xcuserState)) {
    fs.rmSync(xcuserState, { recursive: true, force: true });
  }

  console.log(
    `[build:ios] Native iOS project (SwiftUI + SpriteKit/Metal, ZERO WebView) generated at ./ios-native/`
  );
  console.log(
    `[build:ios] Exported ${SHARK_EVOLUTION_FORMS.length} shark forms, ${GAME_CONFIG.preyTiers.length} prey species, and copied ${copiedCount} PNG/JPG assets.`
  );
}

main();
