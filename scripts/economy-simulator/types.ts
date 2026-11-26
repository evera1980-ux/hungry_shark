import type { DistributionSummary } from './prng';

export type RuleScenarioId =
  | 'web_pre_p0'
  | 'web_post_p0'
  | 'ios_pre_p0'
  | 'ios_post_p0'
  | 'unified_candidate';

export type PlayerArchetypeId = 'Casual' | 'Normal' | 'Efficient' | 'Farming';

export type CrownSettlementTiming = 'live_120ms' | 'end_of_run';
export type HuntingHeatMode = 'web_score_magnet_regen' | 'ios_combo_speed_score';
export type PredationSettlementMode =
  | 'web_pre_p0_double_settlement'
  | 'web_post_p0_single_pickup'
  | 'ios_pickup_38pct_gene'
  | 'unified_pickup_pity_gene';

export interface RuleScenarioSpec {
  id: RuleScenarioId;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  platformBase: 'web' | 'ios' | 'unified';
  /** Initial meta save baseline */
  initialCoins: number;
  initialGenes: number;
  initialBestDepth: number;
  /** Minimum clamp in gene breakthrough cost (Web 20 vs iOS 8) */
  geneBreakthroughMinRef: number;
  /** Whether parent prerequisite accepts cross-gen ancestor (Web) or strictly index - 1 (iOS) */
  allowVerticalParentUnlock: boolean;
  /** Whether shard mastery awards Coins in addition to Genes */
  crownsUseIosTable: boolean;
  crownsTiming: CrownSettlementTiming;
  /** Crown coin scale (1.0 on current iOS table, 0.0 on Web table, e.g. 0.12 on candidate) */
  crownCoinScale: number;
  /** Crown gene scale */
  crownGeneScale: number;
  /** Predation payout mode */
  predationMode: PredationSettlementMode;
  /** Mutation roll model */
  mutationMode: 'web_progressive' | 'ios_fixed_8pct_gold' | 'unified_balanced';
  /** Golden mutants needed to trigger frenzy (before -1 trait) & cooldown seconds */
  goldenNeedForFrenzy: number;
  frenzyCooldownSec: number;
  frenzyInitProtectionSec: number;
  frenzyBaseDurationSec: number;
  frenzyRewardMult: number;
  /** Armor crush config */
  armorCrushHitsNeeded: number;
  armorCrushBypassesMultAndBounty: boolean;
  /** Pickup physics */
  pickupLifetimeSec: number | null; // null = infinite
  frenzyPickupMagnetBonusFlat: number; // 0 for Web (uses *1.35), 390 vs 120 for iOS
  collectRadiusWorldFactor: number; // Web 34, iOS 38
  maxActivePreys: number;
  allowDepthHazardsInPool: boolean;
  /** XP scaling relative to prey.xpValue */
  normalXpScale: number;
  frenzyXpScale: number;
  armorCrushXpScale: number;
  goldenXpScale: number;
  /** Bounty mode */
  bountyMode: 'web_dynamic_2kill' | 'ios_fixed_3kill' | 'unified_scaled_3kill' | 'unified_scaled_2kill';
  /** Time difficulty creep rate per 60s (Web 0.10, iOS 0.0) */
  difficultyPer60s: number;
  /** Apply Web per-shark trait coin/gene multipliers or base/lineage only (iOS) */
  useSharkSpecificYieldTraits: boolean;
  /** Heat buff mode */
  heatMode: HuntingHeatMode;
  /** Gold Overdrive effect spec */
  goldOverdriveBlockWhileFrenzy: boolean;
  goldOverdriveDurationBase: number;
  goldOverdriveHealPctOrFlat: { kind: 'flat' | 'full' | 'pct'; value: number };
  /** P0 Trial isolation flag (false on pre_p0 baselines to measure historical exploit) */
  isolateTrialProgress: boolean;
  /** Ads available in career simulation when adsEnabled = true */
  adCapabilities: {
    hasSupplyDrop: boolean;
    supplyDropCoins: number;
    supplyDropGenes: number;
    useRowScaledSupplyDrop?: boolean;
    supplyDropCapPerDay: number;
    hasDoubleSettlement: boolean;
    doubleSettlementCapPerDay: number;
    doubleSettlementFloorCoins: number;
    doubleSettlementFloorGenes: number;
    reviveCapPerDay: number;
    trialCapPerDay: number;
  };
  /** Unified candidate DNA probability + deterministic pity ceiling */
  unifiedGeneBaseChance?: number;
  unifiedGenePityAfterMisses?: number;
}

export interface PlayerArchetypeSpec {
  id: PlayerArchetypeId;
  labelZh: string;
  runsPerDay: number;
  /** Target hunting depth quantile within shark's comfortable bite zone [0..1] */
  depthAggression: number;
  /** Steering & prey-chasing efficiency [0..1] (0.55 Casual .. 0.98 Farming) */
  huntingSkill: number;
  /** Visible screen fraction used for target acquisition (human players mostly react inside 0.65..0.95 of screen) */
  sightScreenFrac: number;
  /** Fraction of decision cycles spent casually cruising rather than laser-locked onto optimal prey */
  cruisingWanderRate: number;
  /** Reaction delay / direction retarget interval (seconds) */
  decisionIntervalSec: number;
  /** Realistic maximum session horizon per run (seconds) when shark out-heals hunger drain */
  sessionHorizonSec: number;
  /** Boost discipline & tendency [0..1] */
  boostUsageRate: number;
  /** Willingness to actively boost into tier+1..+3 prey for Armor Crush */
  armorCrushAggression: number;
  /** Probability of actively detours to chase nearby uncollected Coin/DNA pickups */
  pickupChaseWeight: number;
  /** Weight given to pursuing DNA pickups over Coins */
  dnaPriorityWeight: number;
  /** Weight given to chasing Bounty species & Golden mutants */
  bountyFocusWeight: number;
  /** Probability of dodging Deadly predators / mines successfully on approach */
  hazardAvoidanceSkill: number;
  /** In-run emergency GoldOverdrive / GeneSurge threshold & budget cap ratio of banked currency */
  maxGoldOverdrivePerRun: number;
  maxGeneSurgePerRun: number;
  emergencyHpRatioForOverdrive: number;
  /** Ad engagement rates [0..1] (used ONLY when includeAds = true) */
  reviveUsageRate: number;
  doubleSettlementRate: number;
  supplyDropFillRate: number; // fraction of daily cap used per day
  trialAdRate: number;
  /** Fraction of non-mandatory upgrades / optional crowns pursued during progression */
  optionalCrownPursuitRate: number;
}

export interface SingleRunTelemetry {
  seed: number;
  scenarioId: RuleScenarioId;
  archetypeId: PlayerArchetypeId;
  sharkId: string;
  sharkIndex: number;
  generation: number;
  upgradeLevel: number;
  survivalSec: number;
  preyEaten: number;
  goldMutantsEaten: number;
  behemothsEaten: number;
  armorCrushes: number;
  bountiesCompleted: number;
  damageHitsTaken: number;
  revivesUsed: number;
  goldOverdrivesUsed: number;
  geneSurgesUsed: number;
  coinsGenerated: number;
  genesGenerated: number;
  coinsCollected: number;
  genesCollected: number;
  coinsFromBounty: number;
  genesFromBounty: number;
  coinsFromDirectPredation: number;
  genesFromDirectPredation: number;
  coinsFromPickups: number;
  genesFromPickups: number;
  coinsFromOverdriveSpend: number;
  genesFromSurgeSpend: number;
  /** Net run coins earned before settlement ad (excluding spending from bank) */
  runCoinsEarned: number;
  runGenesEarned: number;
  xpEarned: number;
  score: number;
  finalInRunLevel: number;
  maxDepthMeters: number;
  frenzySeconds: number;
  frenzyTriggers: number;
  frenzyCoveragePct: number;
  pickupCollectionRatePct: number;
  coinPickupRatePct: number;
  genePickupRatePct: number;
  crownsUnlockedThisRun: number;
  crownCoinsAwarded: number;
  crownGenesAwarded: number;
  maxDifficultyMultiplier: number;
  endedBySessionHorizon: boolean;
}

export interface StatMetricBundle {
  coinsPerRun: DistributionSummary;
  genesPerRun: DistributionSummary;
  coinsPerMin: DistributionSummary;
  genesPerMin: DistributionSummary;
  xpPerRun: DistributionSummary;
  survivalSec: DistributionSummary;
  preyEaten: DistributionSummary;
  pickupRatePct: DistributionSummary;
  frenzyCoveragePct: DistributionSummary;
  crownCompletionPct: DistributionSummary;
  scorePerRun: DistributionSummary;
  maxLevelPerRun: DistributionSummary;
  maxDepthPerRun: DistributionSummary;
  bountiesPerRun: DistributionSummary;
}

export interface CareerGenerationStats {
  generation: number;
  runsInGeneration: DistributionSummary;
  runsForUnlockNextGen: DistributionSummary;
  runsForMandatoryUpgrades: DistributionSummary;
  coinsEarnedInGen: DistributionSummary;
  genesEarnedInGen: DistributionSummary;
  crownCoinsInGen: DistributionSummary;
  crownGenesInGen: DistributionSummary;
  endBankCoins: DistributionSummary;
  endBankGenes: DistributionSummary;
  primaryBottleneck: 'COINS' | 'GENES' | 'LEVEL_OR_DEPTH' | 'BALANCED';
  bottleneckSharePct: {
    coinsPct: number;
    genesPct: number;
    levelPct: number;
    depthPct: number;
    parentLvPct: number;
  };
}

export interface CareerTrajectoryResult {
  scenarioId: RuleScenarioId;
  archetypeId: PlayerArchetypeId;
  includeAds: boolean;
  careerSeedsCount: number;
  completionRatePct: number;
  totalRunsToMaxShark: DistributionSummary;
  estimatedDaysToMaxShark: DistributionSummary;
  totalCoinsEarned: DistributionSummary;
  totalGenesEarned: DistributionSummary;
  totalAdCoins: DistributionSummary;
  totalAdGenes: DistributionSummary;
  totalCrownCoins: DistributionSummary;
  totalCrownGenes: DistributionSummary;
  perGeneration: CareerGenerationStats[];
  /** Sample stock trajectory checkpoints from representative median seed */
  representativeCurve: Array<{
    afterSharkIndex: number;
    generation: number;
    cumulativeRuns: number;
    bankedCoins: number;
    bankedGenes: number;
    crownsCount: number;
    bottleneckTag: string;
  }>;
}
