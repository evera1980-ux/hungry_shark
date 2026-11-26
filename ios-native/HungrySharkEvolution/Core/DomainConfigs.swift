import Foundation

// MARK: - Domain Config Loader (100% Data-Driven from shared/configs/*.json — Zero Hardcoded Balance Data)

public struct WorldConfigTable: Decodable, Sendable {
    public let width: Double
    public let height: Double
    public let seaSurfaceY: Double
    public let maxDepthMeters: Double
    public let baseSharkSpeed: Double
    public let boostSpeedMultiplier: Double
    public let baseHpDrainPerSec: Double
    public let baseBoostDrainPerSec: Double
    public let baseBoostRegenPerSec: Double
    public let baseMagnetRadius: Double
    public let baseBiteTier: Int
    public let frenzyDuration: Double
    public let cameraZoomMin: Double
    public let minRenderZoomFloor: Double
    public let sharkBaseDrawSizeWeb: Double
    public let sharkBaseDrawSizeIos: Double
    public let preyRadiusToDrawSize: Double
    public let defaultPreySizeMultiplier: Double
    public let preyBaseLengthDenominatorCm: Double
    public let minSpawnablePreyLengthRatio: Double
    public let shallowSanctuaryDepthY: Double
    public let twilightStartDepthY: Double
    public let abyssStartDepthY: Double
}

public struct StarterSaveDefaultsConfig: Decodable, Sendable {
    public let version: Int
    public let bankedCoins: Int
    public let bankedGenes: Int
    public let selectedSharkId: String
    public let unlockedSharkIds: [String]
    public let sharkUpgradeLevels: [String: Int]
    public let bestInRunLevel: Int
    public let bestDepthReached: Int
    public let totalRunsPlayed: Int
    public let onboardingGiftClaimed: Bool
}

public struct GeneCostGateConfig: Decodable, Sendable {
    public let refMult: Double
    public let flatBonus: Double
}

public struct UpgradeBiteTierNodeConfig: Decodable, Sendable {
    public let minUpgradeLevel: Int
    public let bonusTier: Int
    public let hpBreakthroughBonusPct: Double
}

public struct UpgradeProgressionConfig: Decodable, Sendable {
    public let maxUpgradeLevel: Int
    public let coinCostExponent: Double
    public let geneUnlockMinRef: Int
    public let geneCostGateLv4: GeneCostGateConfig
    public let geneCostGateLv9: GeneCostGateConfig
    public let hpMultPerUpgradeLevel: Double
    public let energyFlatPerUpgradeLevel: Double
    public let speedPerUpgradeLevel: Double
    public let magnetPerUpgradeLevel: Double
    public let hpDrainReductionPerUpgradeLevel: Double
    public let boostCostReductionPerUpgradeLevel: Double
    public let devourHealPerUpgradeLevel: Double
    public let biteTierNodes: [UpgradeBiteTierNodeConfig]
    public let maxBiteTierBonusOverBase: Int
    public let maxBiteTier: Int
    public let allowVerticalParentUnlock: Bool
    public let maxParentReqCapByRow: [Int]
    public let unlockCoinsMultByRow: [Double]
    public let rowYieldCoinBaseStep: Double
    public let rowYieldGeneBaseStep: Double
}

public struct XpCurveConfig: Decodable, Sendable {
    public let base: Double
    public let linearStep: Double
    public let powerStep: Double
    public let exponent: Double
}

public struct InRunBiteTierNodeConfig: Decodable, Sendable {
    public let minLevel: Int
    public let bonusTier: Int
}

public struct InRunLevelProgressionConfig: Decodable, Sendable {
    public let xpCurve: XpCurveConfig
    public let biteTierNodes: [InRunBiteTierNodeConfig]
    public let hpPerLevelFlat: Double
    public let energyPerLevelFlat: Double
    public let speedPerLevel: Double
    public let magnetPerLevel: Double
    public let scalePerLevel: Double
    public let hpDrainGrowthPerLevel: Double
    public let devourHealPerLevel: Double
    public let levelUpHealMaxHpPct: Double
    public let levelUpEnergyRestorePct: Double
}

public struct AtlasPassivesConfig: Decodable, Sendable {
    public let extraSharkHpBonusPerShark: Double
    public let extraSharkSpeedBonusPerShark: Double
    public let extraSharkScoreBonusPerShark: Double
    public let extraSharkRewardBonusPerShark: Double
    public let crownScoreBonusPerCrown: Double
    public let crownHpBonusPerCrown: Double
    public let crownRewardBonusPerCrown: Double
}

public struct LineagePassiveConfig: Decodable, Sendable {
    public let jawSuctionMult: Double
    public let devourHealBonus: Double
    public let hpMult: Double
    public let speedMult: Double
    public let boostDrainMult: Double
    public let magnetFlatBonus: Double
    public let scoreMult: Double
    public let frenzyDurationBonus: Double
    public let armorBreakMult: Double
    public let geneYieldMult: Double
    public let synergyTag: String?
}

public struct TimeDifficultyConfig: Decodable, Sendable {
    public let intervalSec: Double
    public let ratePerInterval: Double
    public let maxDifficultyMultiplier: Double
    public let scoreScalingExponent: Double
    public let minScoreScalingFloor: Double
    public let hpDrainScalingFactor: Double
    public let spawnScoreScalingCap: Double
}

public struct WorldAndProgressionConfig: Decodable, Sendable {
    public let schemaVersion: Int
    public let world: WorldConfigTable
    public let starterSaveDefaults: StarterSaveDefaultsConfig
    public let upgradeProgression: UpgradeProgressionConfig
    public let inRunLevelProgression: InRunLevelProgressionConfig
    public let atlasPassives: AtlasPassivesConfig
    public let lineagePassives: [String: LineagePassiveConfig]
    public let timeDifficulty: TimeDifficultyConfig
}

public struct SharkTraitsConfig: Decodable, Sendable {
    public let coinYieldTraitMult: Double
    public let geneYieldTraitMult: Double
    public let bossRewardMult: Double
    public let specialPreyScoreMult: Double
    public let frenzyDurationBonus: Double
    public let jawSuctionMult: Double
    public let damageTakenMult: Double
    public let mineDamageTakenMult: Double
    public let knockbackMult: Double
    public let boostRegenMult: Double
    public let killEnergyBonus: Int
    public let maxComboBonus: Double
    public let goldenMutantReduction: Int
    public let canEatMines: Bool
}

public struct SharkConfigEntry: Decodable, Sendable {
    public let index: Int
    public let row: Int
    public let col: Int
    public let generation: Int
    public let id: String
    public let traits: SharkTraitsConfig
}

public struct SharkEvolutionConfigTable: Decodable, Sendable {
    public let schemaVersion: Int
    public let sharks: [SharkConfigEntry]
}

public struct SpawnerRulesConfig: Decodable, Sendable {
    public let maxActivePreys: Int
    public let spawnRadius: Double
    public let minSpawnRadius: Double
    public let cullRadiusMultiplier: Double
    public let shallowSanctuaryY: Double
    public let shallowProtectMaxY: Double
    public let tutorialShallowMaxY: Double
    public let bountySpawnBias: Double
    public let deepCompanionSpawnProb: Double
    public let deepCompanionMaxTier: Int
    public let predatorRollProb: Double
    public let predatorTierOffset: Double
    public let armorBandRollThreshold: Double
    public let armorBandTierOffset: Double
    public let minPreyLengthRatio: Double
    public let clusterTriggerBaseProb: Double
    public let clusterMaxTier: Int
    public let clusterMaxMates: Int
    public let infiniteScaleEarlySec: Double
    public let infiniteScaleEarlyRate: Double
    public let infiniteScaleLateRate: Double
    public let infiniteScaleLateCapExtra: Double
    public let spawnIntervalMinSec: Double
    public let spawnIntervalRangeSec: Double
}

public struct PreyEcologyConfigTable: Decodable, Sendable {
    public let schemaVersion: Int
    public let spawnerRules: SpawnerRulesConfig
}

public struct FrenzyEconomyConfig: Decodable, Sendable {
    public let goldenChargeRequired: Int
    public let minChargeFloor: Int
    public let initProtectionSec: Double
    public let cooldownSec: Double
    public let baseDurationSec: Double
    public let coinMultiplier: Double
    public let geneMultiplier: Double
    public let scoreMultiplier: Double
    public let allowFrenzyStackInflation: Bool
    public let speedBonus: Double
    public let boostSpeedBonus: Double
    public let magnetMultiplier: Double
    public let pickupMagnetMultiplier: Double
}

public struct GoldenMutationConfig: Decodable, Sendable {
    public let baseChance: Double
    public let scoreScaleCap: Double
    public let scoreScaleDivisor: Double
    public let maxChance: Double
    public let coinMult: Double
    public let geneMult: Double
    public let guaranteedGeneDrop: Bool
    public let scoreMult: Double
    public let xpMult: Double
    public let effectiveTierOffset: Int
}

public struct BehemothMutationConfig: Decodable, Sendable {
    public let enabled: Bool
    public let minPreyTier: Int
    public let minDepthMeters: Double
    public let baseChance: Double
    public let scoreScaleCap: Double
    public let scoreScaleDivisor: Double
    public let maxChance: Double
    public let coinMult: Double
    public let geneMult: Double
    public let guaranteedGeneDrop: Bool
    public let scoreMult: Double
    public let xpMult: Double
    public let effectiveTierOffset: Int
    public let failDamageMult: Double
    public let visualScaleMult: Double
    public let speedBoostMult: Double
}

public struct MutationsConfig: Decodable, Sendable {
    public let golden: GoldenMutationConfig
    public let abyssBehemoth: BehemothMutationConfig
}

public struct ArmorCrushConfig: Decodable, Sendable {
    public let normalHitsRequired: Int
    public let bossOrBehemothHitsRequired: Int
    public let coinMult: Double
    public let geneMult: Double
    public let guaranteedGeneDrop: Bool
    public let xpMult: Double
    public let scoreMult: Double
    public let applySharkYieldMultipliers: Bool
    public let countTowardBounty: Bool
    public let countTowardGoldenCharge: Bool
    public let armorBandMinDelta: Int
    public let armorBandMaxDelta: Int
}

public struct XpMultipliersConfig: Decodable, Sendable {
    public let normal: Double
    public let frenzy: Double
    public let armorCrush: Double
    public let golden: Double
    public let behemoth: Double
}

public struct PredationGeneDropConfig: Decodable, Sendable {
    public let lowTierMaxTier: Int
    public let lowTierChance: Double
    public let lowTierPityMissLimit: Int
    public let highTierMinTier: Int
    public let highTierChance: Double
    public let highTierPityMissLimit: Int
    public let specialGuaranteed: Bool
    public let minGenesWhenGuaranteed: Int
    public let removeOrdinaryFloor: Bool
}

public struct BountyEconomyConfig: Decodable, Sendable {
    public let requiredKills: Int
    public let baseCoins: Double
    public let coinsPerTier: Double
    public let baseGenes: Double
    public let genesPerTier: Double
    public let scoreBase: Double
    public let scoreTierMult: Double
    public let spawnBiasProbability: Double
    public let applySharkYieldMultipliers: Bool
    public let allowTrialBountyCoinsAndGenes: Bool
}

public struct PickupsEconomyConfig: Decodable, Sendable {
    public let lifetimeSec: Double
    public let blinkStartRemainingSec: Double
    public let collectRadiusWorldFactor: Double
    public let frenzyMagnetMultiplier: Double
    public let maxPooledPickups: Int
    public let maxCoinsPerPredation: Int
    public let coinScorePerUnit: Int
    public let geneScorePerUnit: Int
}

public struct HuntingHeatTierEntryConfig: Decodable, Sendable {
    public let level: Int
    public let minCombo: Int
    public let scoreMult: Double
    public let magnetBonus: Double
    public let energyRegenPerSec: Double
}

public struct HuntingHeatTiersConfig: Decodable, Sendable {
    public let comboWindowSec: Double
    public let comboScorePerStack: Double
    public let baseKillEnergyBonus: Int
    public let killEnergyPerTier: Double
    public let tiers: [HuntingHeatTierEntryConfig]
}

public struct GoldOverdriveSkillConfig: Decodable, Sendable {
    public let blockWhileFrenzy: Bool
    public let baseCost: Double
    public let useLinear: Double
    public let useQuad: Double
    public let rowScale: Double
    public let durationSec: Double
    public let healMaxHpPct: Double
    public let energyRestorePct: Double
    public let invulnDurationSec: Double
}

public struct GeneSurgeSkillConfig: Decodable, Sendable {
    public let baseCost: Double
    public let levelLinear: Double
    public let useLinear: Double
    public let useQuad: Double
    public let rowScale: Double
    public let xpGrantRatio: Double
    public let healMinFlat: Int
    public let healMaxHpPct: Double
    public let energyRestorePct: Double
    public let skipTutorialOnUse: Bool
}

public struct ActiveSkillsConfig: Decodable, Sendable {
    public let goldOverdrive: GoldOverdriveSkillConfig
    public let geneSurge: GeneSurgeSkillConfig
}

public struct CombatEconomyConfig: Decodable, Sendable {
    public let invulnerableAfterHitSec: Double
    public let deadlyFailBaseDamage: Double
    public let deadlyFailDamagePerDelta: Double
    public let armorFailDamageFactor: Double
    public let mineKnockbackForce: Double
    public let predatorKnockbackForce: Double
}

public struct EconomyPredationConfig: Decodable, Sendable {
    public let schemaVersion: Int
    public let frenzy: FrenzyEconomyConfig
    public let mutations: MutationsConfig
    public let armorCrush: ArmorCrushConfig
    public let xpMultipliers: XpMultipliersConfig
    public let predationGeneDrop: PredationGeneDropConfig
    public let bounty: BountyEconomyConfig
    public let pickups: PickupsEconomyConfig
    public let huntingHeatTiers: HuntingHeatTiersConfig
    public let activeSkills: ActiveSkillsConfig
    public let combat: CombatEconomyConfig
}

public struct CrownTierConfigEntry: Decodable, Sendable {
    public let tier: Int
    public let badgeIcon: String
    public let nameZh: String
    public let nameEn: String
    public let scoreThreshold: Int
    public let coinReward: Int
    public let geneReward: Int
}

public struct CrownSharkEntryConfig: Decodable, Sendable {
    public let sharkId: String
    public let index: Int
    public let row: Int
    public let col: Int
    public let tiers: [CrownTierConfigEntry]
}

public struct CrownMasteryConfigTable: Decodable, Sendable {
    public let schemaVersion: Int
    public let settlementTiming: String
    public let allowInTrial: Bool
    public let allowDoubleSettlement: Bool
    public let hudUnlockNotificationOnly: Bool
    public let sharks: [CrownSharkEntryConfig]
}

public struct AdProvidersConfig: Decodable, Sendable {
    public let admobAppId: String
    public let admobRewardedAdUnitId: String
    public let admobInterstitialAdUnitId: String
    public let admobIosBackupRewardedAdUnitId: String
    public let h5ClientId: String
    public let imaVastTagUrl: String
    public let fallbackVideoStreamUrl: String
}

public struct DoubleSettlementAdConfig: Decodable, Sendable {
    public let enabled: Bool
    public let cooldownSec: Double
    public let dailyCap: Int
    public let multiplier: Double
    public let excludeCrownAndTrial: Bool
    public let minNetPositiveFloor: Int
}

public struct SupplyDropRowRewardConfig: Decodable, Sendable {
    public let row: Int
    public let generation: Int
    public let coins: Int
    public let genes: Int
}

public struct SupplyDropAdConfig: Decodable, Sendable {
    public let enabled: Bool
    public let cooldownSec: Double
    public let dailyCap: Int
    public let rewardsByMaxUnlockedRow: [SupplyDropRowRewardConfig]
}

public struct ReviveAdConfig: Decodable, Sendable {
    public let enabled: Bool
    public let cooldownSec: Double
    public let dailyCap: Int
    public let maxPerRun: Int
    public let hpRestorePct: Double
    public let energyRestorePct: Double
    public let frenzyDurationSec: Double
    public let invulnDurationSec: Double
    public let grantFrenzyStack: Bool
}

public struct TrialSharkAdConfig: Decodable, Sendable {
    public let enabled: Bool
    public let cooldownSec: Double
    public let dailyCap: Int
    public let targetMode: String
    public let fallbackSharkId: String
    public let trialUpgradeLevel: Int
    public let trialInRunLevel: Int
    public let initialFrenzyDurationSec: Double
}

public struct InterstitialAdConfig: Decodable, Sendable {
    public let enabled: Bool
    public let cooldownSec: Double
    public let dailyCap: Int
    public let starterProtectedRuns: Int
}

public struct AdPlacementsConfig: Decodable, Sendable {
    public let DOUBLE_SETTLEMENT: DoubleSettlementAdConfig
    public let SUPPLY_DROP: SupplyDropAdConfig
    public let REVIVE: ReviveAdConfig
    public let TRIAL_SHARK: TrialSharkAdConfig
    public let INTERSTITIAL: InterstitialAdConfig
}

public struct OnboardingStarterGiftConfig: Decodable, Sendable {
    public let enabled: Bool
    public let coins: Int
    public let genes: Int
    public let oneTimeOnly: Bool
}

public struct AdsAndMonetizationConfigTable: Decodable, Sendable {
    public let schemaVersion: Int
    public let providers: AdProvidersConfig
    public let placements: AdPlacementsConfig
    public let onboardingStarterGift: OnboardingStarterGiftConfig
}

// MARK: - Singleton Registry

public enum DomainConfigs {
    private static func locateResourceURL(named name: String) -> URL {
        #if SWIFT_PACKAGE
        if let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Assets") {
            return url
        }
        if let url = Bundle.module.url(forResource: name, withExtension: "json") {
            return url
        }
        #endif
        if let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Assets") {
            return url
        }
        if let url = Bundle.main.url(forResource: name, withExtension: "json") {
            return url
        }
        if let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Resources/Assets") {
            return url
        }
        fatalError("[DomainConfigs] Missing bundled \(name).json. Run `npm run sync:ios` first.")
    }

    private static func decodeJSON<T: Decodable>(_ name: String, as type: T.Type) -> T {
        let url = locateResourceURL(named: name)
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            fatalError("[DomainConfigs] Failed to decode \(name).json at \(url.path): \(error)")
        }
    }

    public static let worldAndProgression: WorldAndProgressionConfig = decodeJSON(
        "world_and_progression_config",
        as: WorldAndProgressionConfig.self
    )
    public static let sharkEvolution: SharkEvolutionConfigTable = decodeJSON(
        "shark_evolution_config",
        as: SharkEvolutionConfigTable.self
    )
    public static let preyEcology: PreyEcologyConfigTable = decodeJSON(
        "prey_ecology_config",
        as: PreyEcologyConfigTable.self
    )
    public static let economyPredation: EconomyPredationConfig = decodeJSON(
        "economy_predation_config",
        as: EconomyPredationConfig.self
    )
    public static let crownMastery: CrownMasteryConfigTable = decodeJSON(
        "crown_mastery_config",
        as: CrownMasteryConfigTable.self
    )
    public static let adsAndMonetization: AdsAndMonetizationConfigTable = decodeJSON(
        "ads_and_monetization_config",
        as: AdsAndMonetizationConfigTable.self
    )

    public static let sharkTraitsById: [String: SharkTraitsConfig] = Dictionary(
        uniqueKeysWithValues: sharkEvolution.sharks.map { ($0.id, $0.traits) }
    )

    public static let crownBySharkId: [String: [CrownTierConfigEntry]] = Dictionary(
        uniqueKeysWithValues: crownMastery.sharks.map { ($0.sharkId, $0.tiers) }
    )

    public static func defaultTraits() -> SharkTraitsConfig {
        SharkTraitsConfig(
            coinYieldTraitMult: 1.0,
            geneYieldTraitMult: 1.0,
            bossRewardMult: 1.0,
            specialPreyScoreMult: 1.0,
            frenzyDurationBonus: 0.0,
            jawSuctionMult: 1.0,
            damageTakenMult: 1.0,
            mineDamageTakenMult: 1.0,
            knockbackMult: 1.0,
            boostRegenMult: 1.0,
            killEnergyBonus: 0,
            maxComboBonus: 1.0,
            goldenMutantReduction: 0,
            canEatMines: false
        )
    }

    public static func supplyDropReward(forMaxUnlockedRow row: Int) -> SupplyDropRowRewardConfig {
        let table = adsAndMonetization.placements.SUPPLY_DROP.rewardsByMaxUnlockedRow
        let idx = max(0, min(table.count - 1, row))
        return table[idx]
    }

    public static func maxUnlockedRow(unlockedSharkIds: [String]) -> Int {
        let unlockedSet = Set(unlockedSharkIds)
        var maxRow = 0
        for s in sharkEvolution.sharks where unlockedSet.contains(s.id) {
            if s.row > maxRow { maxRow = s.row }
        }
        return maxRow
    }

    public static func trialTargetSharkForm(unlockedSharkIds: [String]) -> SharkFormConfig {
        let cfg = adsAndMonetization.placements.TRIAL_SHARK
        let unlockedSet = Set(unlockedSharkIds)
        if cfg.targetMode == "next_unowned_shark",
           let nextUnowned = GameConfigGenerated.sharkForms.first(where: { !unlockedSet.contains($0.id) }) {
            return nextUnowned
        }
        return GameConfigGenerated.sharkForms.first(where: { $0.id == cfg.fallbackSharkId })
            ?? GameConfigGenerated.sharkForms.last
            ?? GameConfigGenerated.sharkForms[0]
    }
}
