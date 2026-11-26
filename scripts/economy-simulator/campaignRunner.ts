import {
  ADS_AND_MONETIZATION_CONFIG,
  getMaxUnlockedRowFromSave,
  getScaledSupplyDropReward,
} from '../../src/game/adManager';
import {
  claimOnboardingStarterGift,
  createDefaultMetaSave,
  evaluateSharkUnlock,
  getParentCandidatesForForm,
  getSharkFormById,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  recordPermanentRunProgress,
  settleSharkScoreMastery,
  SHARK_EVOLUTION_FORMS,
  SharkFormConfig,
  SharkMetaSaveData,
} from '../../src/game/sharkEvolutionConfig';
import { computeDistributionStats, createSeededRng, DistributionSummary, hashStringToSeed } from './prng';
import { simulateSingleRun } from './runSimulator';
import { computeIosSharkMasteryConfig, computeIosUpgradeGeneCost } from './staticAnalyzer';
import type {
  CareerGenerationStats,
  CareerTrajectoryResult,
  PlayerArchetypeId,
  PlayerArchetypeSpec,
  RuleScenarioId,
  RuleScenarioSpec,
  SingleRunTelemetry,
  StatMetricBundle,
} from './types';

export function summarizeRunsToBundle(runs: readonly SingleRunTelemetry[]): StatMetricBundle {
  return {
    coinsPerRun: computeDistributionStats(runs.map((r) => r.runCoinsEarned), 1),
    genesPerRun: computeDistributionStats(runs.map((r) => r.runGenesEarned), 1),
    coinsPerMin: computeDistributionStats(
      runs.map((r) => (r.survivalSec > 0 ? (r.runCoinsEarned / r.survivalSec) * 60 : 0)),
      1
    ),
    genesPerMin: computeDistributionStats(
      runs.map((r) => (r.survivalSec > 0 ? (r.runGenesEarned / r.survivalSec) * 60 : 0)),
      1
    ),
    xpPerRun: computeDistributionStats(runs.map((r) => r.xpEarned), 1),
    survivalSec: computeDistributionStats(runs.map((r) => r.survivalSec), 1),
    preyEaten: computeDistributionStats(runs.map((r) => r.preyEaten), 1),
    pickupRatePct: computeDistributionStats(runs.map((r) => r.pickupCollectionRatePct), 2),
    frenzyCoveragePct: computeDistributionStats(runs.map((r) => r.frenzyCoveragePct), 2),
    crownCompletionPct: computeDistributionStats(
      runs.map((r) => (r.crownsUnlockedThisRun / 3) * 100),
      1
    ),
    scorePerRun: computeDistributionStats(runs.map((r) => r.score), 0),
    maxLevelPerRun: computeDistributionStats(runs.map((r) => r.finalInRunLevel), 1),
    maxDepthPerRun: computeDistributionStats(runs.map((r) => r.maxDepthMeters), 0),
    bountiesPerRun: computeDistributionStats(runs.map((r) => r.bountiesCompleted), 2),
  };
}

export interface PerSharkBenchmarkEntry {
  sharkIndex: number;
  sharkId: string;
  nameZh: string;
  generation: number;
  upgradeLevel: number;
  metrics: StatMetricBundle;
  sessionCapHitRatePct: number;
}

export interface ScenarioArchetypeBenchmark {
  scenarioId: RuleScenarioId;
  archetypeId: PlayerArchetypeId;
  perGeneration: Array<{
    generation: number;
    metrics: StatMetricBundle;
    sessionCapHitRatePct: number;
  }>;
  perShark: PerSharkBenchmarkEntry[];
}

function getStandardRepresentativeUpgradeLevel(form: SharkFormConfig): number {
  const nextForm =
    form.index + 1 < SHARK_EVOLUTION_FORMS.length
      ? SHARK_EVOLUTION_FORMS[form.index + 1]
      : null;
  const reqLv = nextForm ? nextForm.reqParentUpgradeLevel : 9;
  return Math.max(1, Math.min(10, reqLv));
}

/**
 * Benchmarks individual shark & generation efficiency across all 48 sharks using clean
 * non-accumulating save contexts (`unlockedCount = form.index + 1`, midpoint upgrade level).
 */
export function runPerSharkEfficiencyBenchmark(params: {
  masterSeed: number;
  scenarioIds: RuleScenarioId[];
  archetypeIds: PlayerArchetypeId[];
  scenarios: Record<RuleScenarioId, RuleScenarioSpec>;
  archetypes: Record<PlayerArchetypeId, PlayerArchetypeSpec>;
  runsPerShark: number;
  sharkIndices?: number[]; // default all 0..47
}): {
  fullBenchmarks: ScenarioArchetypeBenchmark[];
  uncappedStressProbe: Array<{
    scenarioId: RuleScenarioId;
    generation: number;
    sharkId: string;
    survivalSec: number;
    endedByTimeout: boolean;
    hpRatioAtEnd: number;
    coinsPerRun: number;
    genesPerRun: number;
    maxLevel: number;
    maxDepth: number;
  }>;
} {
  const {
    masterSeed,
    scenarioIds,
    archetypeIds,
    scenarios,
    archetypes,
    runsPerShark,
    sharkIndices = SHARK_EVOLUTION_FORMS.map((s) => s.index),
  } = params;

  const fullBenchmarks: ScenarioArchetypeBenchmark[] = [];

  for (const scId of scenarioIds) {
    const scenario = scenarios[scId];
    for (const archId of archetypeIds) {
      const archetype = archetypes[archId];
      const allRuns: SingleRunTelemetry[] = [];
      const perShark: PerSharkBenchmarkEntry[] = [];

      for (const sIdx of sharkIndices) {
        const form = SHARK_EVOLUTION_FORMS[sIdx];
        const upLv = getStandardRepresentativeUpgradeLevel(form);
        const sharkRuns: SingleRunTelemetry[] = [];

        const unlockedIds = SHARK_EVOLUTION_FORMS.slice(0, sIdx + 1).map((f) => f.id);
        const baseSave: SharkMetaSaveData = {
          ...createDefaultMetaSave(),
          bankedCoins: 500000,
          bankedGenes: 100000,
          unlockedSharkIds: unlockedIds,
          selectedSharkId: form.id,
          sharkUpgradeLevels: { [form.id]: upLv },
          bestInRunLevel: Math.max(1, form.reqMaxInRunLevel),
          bestDepthReached: Math.max(scenario.initialBestDepth, form.reqMaxDepth),
        };

        for (let r = 0; r < runsPerShark; r++) {
          const runSeed =
            (masterSeed ^
              hashStringToSeed(`${scId}:${archId}:shark_${sIdx}:run_${r}`)) >>>
            0;
          const res = simulateSingleRun({
            seed: runSeed,
            rng: createSeededRng(runSeed),
            scenario,
            archetype,
            sharkId: form.id,
            upgradeLevel: upLv,
            metaSave: baseSave,
            allowInRunSpend: true,
            allowReviveAd: false,
          });
          sharkRuns.push(res);
          allRuns.push(res);
        }

        const capHits = sharkRuns.filter((x) => x.endedBySessionHorizon).length;
        perShark.push({
          sharkIndex: form.index,
          sharkId: form.id,
          nameZh: form.nameZh,
          generation: form.generation,
          upgradeLevel: upLv,
          metrics: summarizeRunsToBundle(sharkRuns),
          sessionCapHitRatePct: Number(((capHits / sharkRuns.length) * 100).toFixed(1)),
        });
      }

      const perGeneration: ScenarioArchetypeBenchmark['perGeneration'] = [];
      for (let gen = 1; gen <= 6; gen++) {
        const genRuns = allRuns.filter((r) => r.generation === gen);
        const capHits = genRuns.filter((x) => x.endedBySessionHorizon).length;
        perGeneration.push({
          generation: gen,
          metrics: summarizeRunsToBundle(genRuns),
          sessionCapHitRatePct:
            genRuns.length > 0
              ? Number(((capHits / genRuns.length) * 100).toFixed(1))
              : 0,
        });
      }

      fullBenchmarks.push({
        scenarioId: scId,
        archetypeId: archId,
        perGeneration,
        perShark,
      });
    }
  }

  // Dedicated 900s (15 min) Uncapped Physiological Survival Audit across G1..G6 representatives (Normal)
  const stressSharks = [0, 8, 16, 24, 32, 40];
  const stressScenarios: RuleScenarioId[] = ['web_post_p0', 'ios_post_p0', 'unified_candidate'];
  const uncappedStressProbe: Array<{
    scenarioId: RuleScenarioId;
    generation: number;
    sharkId: string;
    survivalSec: number;
    endedByTimeout: boolean;
    hpRatioAtEnd: number;
    coinsPerRun: number;
    genesPerRun: number;
    maxLevel: number;
    maxDepth: number;
  }> = [];

  for (const scId of stressScenarios) {
    const scenario = scenarios[scId];
    for (const sIdx of stressSharks) {
      const form = SHARK_EVOLUTION_FORMS[sIdx];
      const unlockedIds = SHARK_EVOLUTION_FORMS.slice(0, sIdx + 1).map((f) => f.id);
      const save: SharkMetaSaveData = {
        ...createDefaultMetaSave(),
        unlockedSharkIds: unlockedIds,
        selectedSharkId: form.id,
        sharkUpgradeLevels: { [form.id]: 4 },
      };
      const sSeed = (masterSeed ^ hashStringToSeed(`stress:${scId}:${sIdx}`)) >>> 0;
      const run = simulateSingleRun({
        seed: sSeed,
        rng: createSeededRng(sSeed),
        scenario,
        archetype: archetypes.Normal,
        sharkId: form.id,
        upgradeLevel: 4,
        metaSave: save,
        allowInRunSpend: false,
        allowReviveAd: false,
        maxRunDurationSec: 900,
      });
      uncappedStressProbe.push({
        scenarioId: scId,
        generation: form.generation,
        sharkId: form.id,
        survivalSec: run.survivalSec,
        endedByTimeout: run.endedBySessionHorizon,
        hpRatioAtEnd: run.endedBySessionHorizon ? 1 : 0,
        coinsPerRun: run.runCoinsEarned,
        genesPerRun: run.runGenesEarned,
        maxLevel: run.finalInRunLevel,
        maxDepth: run.maxDepthMeters,
      });
    }
  }

  return { fullBenchmarks, uncappedStressProbe };
}

function getUpgradeGeneCostForScenario(
  scenario: RuleScenarioSpec,
  form: SharkFormConfig,
  curLv: number
): number {
  if (scenario.geneBreakthroughMinRef === 8) {
    return computeIosUpgradeGeneCost(form, curLv);
  }
  return getSharkUpgradeGeneCost(form, curLv);
}

function checkUnlockForScenario(
  scenario: RuleScenarioSpec,
  form: SharkFormConfig,
  save: SharkMetaSaveData
): {
  canUnlockNow: boolean;
  parentMet: boolean;
  levelMet: boolean;
  depthMet: boolean;
  coinsMet: boolean;
  genesMet: boolean;
  blockingParent: SharkFormConfig | null;
} {
  if (scenario.allowVerticalParentUnlock) {
    const res = evaluateSharkUnlock(form, save, 0, 0, 1, 0);
    const candidates = getParentCandidatesForForm(form);
    const parent =
      candidates.find((c) => save.unlockedSharkIds.includes(c.id)) ??
      (form.index > 0 ? SHARK_EVOLUTION_FORMS[form.index - 1] : null);
    return {
      canUnlockNow: res.canUnlockNow,
      parentMet: res.parentMet,
      levelMet: res.levelMet,
      depthMet: res.depthMet,
      coinsMet: res.coinsMet,
      genesMet: res.genesMet,
      blockingParent: parent ?? null,
    };
  }

  // Linear parent index - 1 ONLY (iOS Swift GameRules.swift:363)
  const parent = form.index > 0 ? SHARK_EVOLUTION_FORMS[form.index - 1] : null;
  const parentUnlocked = parent ? save.unlockedSharkIds.includes(parent.id) : true;
  const parentLv = parent ? save.sharkUpgradeLevels[parent.id] ?? 1 : 10;
  const parentMet = parent ? parentUnlocked && parentLv >= form.reqParentUpgradeLevel : true;
  const levelMet = save.bestInRunLevel >= form.reqMaxInRunLevel;
  const depthMet = save.bestDepthReached >= form.reqMaxDepth;
  const coinsMet = save.bankedCoins >= form.unlockCoins;
  const genesMet = save.bankedGenes >= form.unlockGenes;

  return {
    canUnlockNow:
      !save.unlockedSharkIds.includes(form.id) &&
      parentMet &&
      levelMet &&
      depthMet &&
      coinsMet &&
      genesMet,
    parentMet,
    levelMet,
    depthMet,
    coinsMet,
    genesMet,
    blockingParent: parent,
  };
}

/**
 * Simulates complete player progression careers from `#0` to unlocking `#47`.
 */
export function runCareerProgressionSimulation(params: {
  masterSeed: number;
  scenarioIds: RuleScenarioId[];
  archetypeIds: PlayerArchetypeId[];
  scenarios: Record<RuleScenarioId, RuleScenarioSpec>;
  archetypes: Record<PlayerArchetypeId, PlayerArchetypeSpec>;
  careerSeeds: number;
  includeAds: boolean;
  maxCareerRunsCap?: number;
}): CareerTrajectoryResult[] {
  const {
    masterSeed,
    scenarioIds,
    archetypeIds,
    scenarios,
    archetypes,
    careerSeeds,
    includeAds,
    maxCareerRunsCap = 360,
  } = params;

  const results: CareerTrajectoryResult[] = [];

  for (const scId of scenarioIds) {
    const scenario = scenarios[scId];
    for (const archId of archetypeIds) {
      const archetype = archetypes[archId];

      const totalRunsList: number[] = [];
      const totalDaysList: number[] = [];
      const totalCoinsList: number[] = [];
      const totalGenesList: number[] = [];
      const totalAdCoinsList: number[] = [];
      const totalAdGenesList: number[] = [];
      const totalCrownCoinsList: number[] = [];
      const totalCrownGenesList: number[] = [];
      let completedCount = 0;

      // Per generation accumulators across seeds
      const genRunsLists: number[][] = Array.from({ length: 6 }, () => []);
      const genNextGenUnlockRunsLists: number[][] = Array.from({ length: 6 }, () => []);
      const genMandatoryUpgradeRunsLists: number[][] = Array.from({ length: 6 }, () => []);
      const genCoinsEarnedLists: number[][] = Array.from({ length: 6 }, () => []);
      const genGenesEarnedLists: number[][] = Array.from({ length: 6 }, () => []);
      const genCrownCoinsLists: number[][] = Array.from({ length: 6 }, () => []);
      const genCrownGenesLists: number[][] = Array.from({ length: 6 }, () => []);
      const genEndBankCoinsLists: number[][] = Array.from({ length: 6 }, () => []);
      const genEndBankGenesLists: number[][] = Array.from({ length: 6 }, () => []);
      const genBottleneckVotes: Array<{
        coins: number;
        genes: number;
        level: number;
        depth: number;
        parentLv: number;
        checks: number;
      }> = Array.from({ length: 6 }, () => ({
        coins: 0,
        genes: 0,
        level: 0,
        depth: 0,
        parentLv: 0,
        checks: 0,
      }));

      const careerSnapshots: Array<{
        runs: number;
        curve: CareerTrajectoryResult['representativeCurve'];
      }> = [];

      for (let seedIdx = 0; seedIdx < careerSeeds; seedIdx++) {
        const careerSeed =
          (masterSeed ^
            hashStringToSeed(
              `career:${scId}:${archId}:ads_${includeAds ? 1 : 0}:seed_${seedIdx}`
            )) >>>
          0;
        const rng = createSeededRng(careerSeed);

        let save: SharkMetaSaveData = {
          ...createDefaultMetaSave(),
          bankedCoins: scenario.initialCoins,
          bankedGenes: scenario.initialGenes,
          bestInRunLevel: 1,
          bestDepthReached: scenario.initialBestDepth,
          totalRunsPlayed: 0,
          onboardingGiftClaimed: false,
          sharkBestScores: {},
          sharkMasteryTiers: {},
        };

        let careerRuns = 0;
        let totalCoinsEarned = 0;
        let totalGenesEarned = 0;
        let totalAdCoins = 0;
        let totalAdGenes = 0;
        let totalCrownCoins = 0;
        let totalCrownGenes = 0;

        let curDay = -1;
        let dailySupplyDrops = 0;
        let dailyDoubles = 0;
        let dailyRevives = 0;

        const genRuns = new Array(6).fill(0);
        const genMandatoryUpgradesFunded = new Array(6).fill(0);
        const genCoinsEarned = new Array(6).fill(0);
        const genGenesEarned = new Array(6).fill(0);
        const genCrownCoins = new Array(6).fill(0);
        const genCrownGenes = new Array(6).fill(0);
        const genStartRuns = new Array(6).fill(0);
        const genEntered = new Array(6).fill(false);
        genEntered[0] = true;

        const curve: CareerTrajectoryResult['representativeCurve'] = [];
        let stalledWallRuns = 0;
        let lastTargetSharkId = '';

        while (
          !save.unlockedSharkIds.includes('shark_47_omega_devourer') &&
          careerRuns < maxCareerRunsCap
        ) {
          const nextForm = SHARK_EVOLUTION_FORMS.find(
            (f) => !save.unlockedSharkIds.includes(f.id)
          );
          if (!nextForm) break;
          const prevUnlockedCount = save.unlockedSharkIds.length;
          const prevBestLevel = save.bestInRunLevel;
          const prevBestDepth = save.bestDepthReached;
          const prevUpgradesCount = genMandatoryUpgradesFunded.reduce((a, b) => a + b, 0);

          const dayIdx = Math.floor(careerRuns / archetype.runsPerDay);
          if (dayIdx !== curDay) {
            curDay = dayIdx;
            dailySupplyDrops = 0;
            dailyDoubles = 0;
            dailyRevives = 0;
          }

          // Track active generation based on highest unlocked shark row
          const highestUnlockedIdx = Math.max(
            ...save.unlockedSharkIds.map((id) => getSharkFormById(id).index)
          );
          const activeForm = SHARK_EVOLUTION_FORMS[highestUnlockedIdx];
          const curRow = activeForm.row;
          save.selectedSharkId = activeForm.id;

          // Daily Supply Drop Ads (if active in scenario & ads enabled)
          if (
            includeAds &&
            scenario.adCapabilities.hasSupplyDrop &&
            dailySupplyDrops <
              Math.floor(
                scenario.adCapabilities.supplyDropCapPerDay *
                  archetype.supplyDropFillRate
              )
          ) {
            const desiredPerRun =
              (scenario.adCapabilities.supplyDropCapPerDay *
                archetype.supplyDropFillRate) /
              Math.max(1, archetype.runsPerDay);
            const dropsNow = Math.min(
              Math.max(0, Math.round(desiredPerRun)),
              scenario.adCapabilities.supplyDropCapPerDay - dailySupplyDrops
            );
            if (dropsNow > 0) {
              dailySupplyDrops += dropsNow;
              const scaledDrop = scenario.adCapabilities.useRowScaledSupplyDrop
                ? getScaledSupplyDropReward(getMaxUnlockedRowFromSave(save.unlockedSharkIds))
                : {
                    coins: scenario.adCapabilities.supplyDropCoins,
                    genes: scenario.adCapabilities.supplyDropGenes,
                  };
              const addC = dropsNow * scaledDrop.coins;
              const addG = dropsNow * scaledDrop.genes;
              save.bankedCoins += addC;
              save.bankedGenes += addG;
              totalAdCoins += addC;
              totalAdGenes += addG;
              totalCoinsEarned += addC;
              totalGenesEarned += addG;
              genCoinsEarned[curRow] += addC;
              genGenesEarned[curRow] += addG;
            }
          }

          // Check whether next shark merely needs depth/level vs currency/upgrades
          const preCheck = checkUnlockForScenario(scenario, nextForm, save);
          const pushDepthTarget =
            !preCheck.depthMet ? nextForm.reqMaxDepth + 60 : undefined;
          const pushLevelTarget = !preCheck.levelMet
            ? nextForm.reqMaxInRunLevel
            : undefined;
          const reserveGenes = nextForm.unlockGenes;

          const activeUpLv = save.sharkUpgradeLevels[activeForm.id] ?? 1;
          const canReviveNow =
            includeAds && dailyRevives < scenario.adCapabilities.reviveCapPerDay;

          const runSeed =
            (careerSeed ^ hashStringToSeed(`run_${careerRuns}_${activeForm.id}`)) >>> 0;
          const telemetry = simulateSingleRun({
            seed: runSeed,
            rng: createSeededRng(runSeed),
            scenario,
            archetype,
            sharkId: activeForm.id,
            upgradeLevel: activeUpLv,
            metaSave: save,
            isTrialRun: false,
            allowReviveAd: canReviveNow,
            allowInRunSpend: true,
            pushDepthMetersTarget: pushDepthTarget,
            pushLevelTarget,
            reserveGenesForUnlock: reserveGenes,
          });

          careerRuns += 1;
          genRuns[curRow] += 1;
          if (telemetry.revivesUsed > 0) {
            dailyRevives += telemetry.revivesUsed;
          }

          // Run 1 onboarding gift
          if (!save.onboardingGiftClaimed) {
            if (scenario.platformBase === 'web' && !scenario.adCapabilities.useRowScaledSupplyDrop) {
              const giftCfg = ADS_AND_MONETIZATION_CONFIG.onboardingStarterGift;
              const gift = claimOnboardingStarterGift(save, giftCfg.coins, giftCfg.genes);
              save = gift.updatedSave;
              totalCoinsEarned += giftCfg.coins;
              totalGenesEarned += giftCfg.genes;
              genCoinsEarned[curRow] += giftCfg.coins;
              genGenesEarned[curRow] += giftCfg.genes;
            } else {
              save = { ...save, onboardingGiftClaimed: true };
            }
          }

          // Apply run progress & earnings
          save = recordPermanentRunProgress(
            save,
            { trialActive: false },
            telemetry.finalInRunLevel,
            telemetry.maxDepthMeters
          );

          save.bankedCoins = Math.max(
            0,
            save.bankedCoins +
              telemetry.runCoinsEarned -
              telemetry.coinsFromOverdriveSpend
          );
          save.bankedGenes = Math.max(
            0,
            save.bankedGenes +
              telemetry.runGenesEarned -
              telemetry.genesFromSurgeSpend
          );
          totalCoinsEarned += telemetry.runCoinsEarned;
          totalGenesEarned += telemetry.runGenesEarned;
          genCoinsEarned[curRow] += telemetry.runCoinsEarned;
          genGenesEarned[curRow] += telemetry.runGenesEarned;

          // Double Settlement Ad
          if (
            includeAds &&
            scenario.adCapabilities.hasDoubleSettlement &&
            dailyDoubles < scenario.adCapabilities.doubleSettlementCapPerDay &&
            rng() < archetype.doubleSettlementRate
          ) {
            const dblC = Math.max(
              scenario.adCapabilities.doubleSettlementFloorCoins,
              telemetry.runCoinsEarned
            );
            const dblG = Math.max(
              scenario.adCapabilities.doubleSettlementFloorGenes,
              telemetry.runGenesEarned
            );
            if (dblC > 0 || dblG > 0) {
              dailyDoubles += 1;
              save.bankedCoins += dblC;
              save.bankedGenes += dblG;
              totalAdCoins += dblC;
              totalAdGenes += dblG;
              totalCoinsEarned += dblC;
              totalGenesEarned += dblG;
              genCoinsEarned[curRow] += dblC;
              genGenesEarned[curRow] += dblG;
            }
          }

          // Settle Mastery Crowns cleanly (only newly reached tiers!)
          const prevTier = save.sharkMasteryTiers?.[activeForm.id] ?? 0;
          let addedCrownC = 0;
          let addedCrownG = 0;
          let newTier = prevTier;
          if (scenario.crownsUseIosTable) {
            const cfg = computeIosSharkMasteryConfig(activeForm);
            const baseC = Math.round(45 + activeForm.index * 24 + activeForm.row * 65);
            const baseG = Math.round(
              4 + Math.floor(activeForm.index * 0.85) + activeForm.row * 3
            );
            const table = [
              { tier: 1, s: cfg.bronzeScore, c: baseC, g: baseG },
              { tier: 2, s: cfg.silverScore, c: Math.round(baseC * 2.2), g: Math.round(baseG * 2) },
              { tier: 3, s: cfg.goldScore, c: Math.round(baseC * 4.5), g: Math.round(baseG * 4) },
            ];
            for (const rowCfg of table) {
              if (telemetry.score >= rowCfg.s && rowCfg.tier > prevTier) {
                newTier = Math.max(newTier, rowCfg.tier);
                addedCrownC += Math.round(rowCfg.c * scenario.crownCoinScale);
                addedCrownG += Math.round(rowCfg.g * scenario.crownGeneScale);
              }
            }
          } else {
            const mastery = settleSharkScoreMastery(
              activeForm.id,
              telemetry.score,
              false,
              save
            );
            newTier = mastery.newCrownTier;
            addedCrownC = Math.round(mastery.coinsAwarded * scenario.crownCoinScale);
            addedCrownG = Math.round(mastery.genesAwarded * scenario.crownGeneScale);
          }

          if (newTier > prevTier || addedCrownC > 0 || addedCrownG > 0) {
            save = {
              ...save,
              bankedCoins: save.bankedCoins + addedCrownC,
              bankedGenes: save.bankedGenes + addedCrownG,
              sharkBestScores: {
                ...(save.sharkBestScores ?? {}),
                [activeForm.id]: Math.max(
                  save.sharkBestScores?.[activeForm.id] ?? 0,
                  telemetry.score
                ),
              },
              sharkMasteryTiers: {
                ...(save.sharkMasteryTiers ?? {}),
                [activeForm.id]: newTier,
              },
            };
            totalCrownCoins += addedCrownC;
            totalCrownGenes += addedCrownG;
            totalCoinsEarned += addedCrownC;
            totalGenesEarned += addedCrownG;
            genCrownCoins[curRow] += addedCrownC;
            genCrownGenes[curRow] += addedCrownG;
            genCoinsEarned[curRow] += addedCrownC;
            genGenesEarned[curRow] += addedCrownG;
          }

          // Spend currencies post-run: prioritize mandatory parent upgrades & unlocking next sharks
          let progressedAny = true;
          while (progressedAny) {
            progressedAny = false;
            const target = SHARK_EVOLUTION_FORMS.find(
              (f) => !save.unlockedSharkIds.includes(f.id)
            );
            if (!target) break;

            const status = checkUnlockForScenario(scenario, target, save);
            if (status.canUnlockNow) {
              save = {
                ...save,
                bankedCoins: save.bankedCoins - target.unlockCoins,
                bankedGenes: save.bankedGenes - target.unlockGenes,
                unlockedSharkIds: [...save.unlockedSharkIds, target.id],
                selectedSharkId: target.id,
                sharkUpgradeLevels: {
                  ...save.sharkUpgradeLevels,
                  [target.id]: 1,
                },
              };
              progressedAny = true;
              if (!genEntered[target.row]) {
                genEntered[target.row] = true;
                genStartRuns[target.row] = careerRuns;
              }
              const totalCrownsNow = Object.values(
                save.sharkMasteryTiers ?? {}
              ).reduce((a, b) => a + b, 0);
              const tag = !preCheck.genesMet
                ? 'Genes'
                : !preCheck.coinsMet
                ? 'Coins'
                : !preCheck.depthMet
                ? 'Depth'
                : !preCheck.levelMet
                ? 'Lv'
                : 'Cleared';
              curve.push({
                afterSharkIndex: target.index,
                generation: target.generation,
                cumulativeRuns: careerRuns,
                bankedCoins: save.bankedCoins,
                bankedGenes: save.bankedGenes,
                crownsCount: totalCrownsNow,
                bottleneckTag: tag,
              });
              continue;
            }

            // Try upgrading required parent up to `reqParentUpgradeLevel`
            if (!status.parentMet && status.blockingParent) {
              const pForm = status.blockingParent;
              const pLv = save.sharkUpgradeLevels[pForm.id] ?? 1;
              if (pLv < target.reqParentUpgradeLevel && pLv < 10) {
                const cCost = getSharkUpgradeCost(pForm, pLv);
                const gCost = getUpgradeGeneCostForScenario(scenario, pForm, pLv);
                if (save.bankedCoins >= cCost && save.bankedGenes >= gCost) {
                  save = {
                    ...save,
                    bankedCoins: save.bankedCoins - cCost,
                    bankedGenes: save.bankedGenes - gCost,
                    sharkUpgradeLevels: {
                      ...save.sharkUpgradeLevels,
                      [pForm.id]: pLv + 1,
                    },
                  };
                  genMandatoryUpgradesFunded[pForm.row] += 1;
                  progressedAny = true;
                } else {
                  const v = genBottleneckVotes[target.row];
                  v.checks += 1;
                  v.parentLv += 1;
                  if (save.bankedCoins < cCost) v.coins += 1;
                  if (save.bankedGenes < gCost) v.genes += 1;
                }
              }
            } else {
              // Parent met; check what is still blocking unlock
              const v = genBottleneckVotes[target.row];
              v.checks += 1;
              if (!status.coinsMet) v.coins += 1;
              if (!status.genesMet) v.genes += 1;
              if (!status.levelMet) v.level += 1;
              if (!status.depthMet) v.depth += 1;
            }
          } // end post-run spend loop

          const postCheck = checkUnlockForScenario(scenario, nextForm, save);
          const progressedSave =
            save.unlockedSharkIds.length > prevUnlockedCount ||
            save.bestInRunLevel > prevBestLevel ||
            save.bestDepthReached > prevBestDepth ||
            genMandatoryUpgradesFunded.reduce((a, b) => a + b, 0) > prevUpgradesCount;
          if (nextForm.id !== lastTargetSharkId || progressedSave) {
            lastTargetSharkId = nextForm.id;
            stalledWallRuns = 0;
          } else if (
            postCheck.parentMet &&
            postCheck.coinsMet &&
            postCheck.genesMet &&
            (!postCheck.levelMet || !postCheck.depthMet) &&
            (telemetry.geneSurgesUsed >= 10 || save.bankedGenes >= nextForm.unlockGenes + 6000)
          ) {
            stalledWallRuns += 1;
            if (stalledWallRuns >= 18) {
              break;
            }
          }
        } // end career while

        if (save.unlockedSharkIds.includes('shark_47_omega_devourer')) {
          completedCount += 1;
        }
        totalRunsList.push(careerRuns);
        totalDaysList.push(Number((careerRuns / archetype.runsPerDay).toFixed(2)));
        totalCoinsList.push(totalCoinsEarned);
        totalGenesList.push(totalGenesEarned);
        totalAdCoinsList.push(totalAdCoins);
        totalAdGenesList.push(totalAdGenes);
        totalCrownCoinsList.push(totalCrownCoins);
        totalCrownGenesList.push(totalCrownGenes);
        careerSnapshots.push({ runs: careerRuns, curve });

        for (let row = 0; row < 6; row++) {
          genRunsLists[row].push(genRuns[row]);
          const nextRowStart =
            row < 5
              ? genEntered[row + 1]
                ? genStartRuns[row + 1]
                : careerRuns
              : careerRuns;
          genNextGenUnlockRunsLists[row].push(Math.max(1, nextRowStart - genStartRuns[row]));
          genMandatoryUpgradeRunsLists[row].push(genMandatoryUpgradesFunded[row]);
          genCoinsEarnedLists[row].push(genCoinsEarned[row]);
          genGenesEarnedLists[row].push(genGenesEarned[row]);
          genCrownCoinsLists[row].push(genCrownCoins[row]);
          genCrownGenesLists[row].push(genCrownGenes[row]);
          const rowEndPt = curve
            .filter((c) => c.generation === row + 1)
            .slice(-1)[0];
          genEndBankCoinsLists[row].push(rowEndPt?.bankedCoins ?? save.bankedCoins);
          genEndBankGenesLists[row].push(rowEndPt?.bankedGenes ?? save.bankedGenes);
        }
      } // end seeds loop

      const perGeneration: CareerGenerationStats[] = [];
      for (let row = 0; row < 6; row++) {
        const votes = genBottleneckVotes[row];
        const denom = Math.max(1, votes.checks);
        const coinsPct = Number(((votes.coins / denom) * 100).toFixed(1));
        const genesPct = Number(((votes.genes / denom) * 100).toFixed(1));
        const levelPct = Number(((votes.level / denom) * 100).toFixed(1));
        const depthPct = Number(((votes.depth / denom) * 100).toFixed(1));
        const parentLvPct = Number(((votes.parentLv / denom) * 100).toFixed(1));

        let primaryBottleneck: CareerGenerationStats['primaryBottleneck'] = 'BALANCED';
        if (genesPct > coinsPct * 1.15 && genesPct >= 25) {
          primaryBottleneck = 'GENES';
        } else if (coinsPct > genesPct * 1.15 && coinsPct >= 25) {
          primaryBottleneck = 'COINS';
        } else if (levelPct + depthPct > Math.max(coinsPct, genesPct)) {
          primaryBottleneck = 'LEVEL_OR_DEPTH';
        }

        perGeneration.push({
          generation: row + 1,
          runsInGeneration: computeDistributionStats(genRunsLists[row], 1),
          runsForUnlockNextGen: computeDistributionStats(genNextGenUnlockRunsLists[row], 1),
          runsForMandatoryUpgrades: computeDistributionStats(genMandatoryUpgradeRunsLists[row], 1),
          coinsEarnedInGen: computeDistributionStats(genCoinsEarnedLists[row], 0),
          genesEarnedInGen: computeDistributionStats(genGenesEarnedLists[row], 0),
          crownCoinsInGen: computeDistributionStats(genCrownCoinsLists[row], 0),
          crownGenesInGen: computeDistributionStats(genCrownGenesLists[row], 0),
          endBankCoins: computeDistributionStats(genEndBankCoinsLists[row], 0),
          endBankGenes: computeDistributionStats(genEndBankGenesLists[row], 0),
          primaryBottleneck,
          bottleneckSharePct: {
            coinsPct,
            genesPct,
            levelPct,
            depthPct,
            parentLvPct,
          },
        });
      }

      // Pick median career snapshot
      const sortedSnaps = [...careerSnapshots].sort((a, b) => a.runs - b.runs);
      const medianSnap =
        sortedSnaps[Math.floor(sortedSnaps.length / 2)] ?? careerSnapshots[0];

      results.push({
        scenarioId: scId,
        archetypeId: archId,
        includeAds,
        careerSeedsCount: careerSeeds,
        completionRatePct: Number(((completedCount / careerSeeds) * 100).toFixed(1)),
        totalRunsToMaxShark: computeDistributionStats(totalRunsList, 1),
        estimatedDaysToMaxShark: computeDistributionStats(totalDaysList, 2),
        totalCoinsEarned: computeDistributionStats(totalCoinsList, 0),
        totalGenesEarned: computeDistributionStats(totalGenesList, 0),
        totalAdCoins: computeDistributionStats(totalAdCoinsList, 0),
        totalAdGenes: computeDistributionStats(totalAdGenesList, 0),
        totalCrownCoins: computeDistributionStats(totalCrownCoinsList, 0),
        totalCrownGenes: computeDistributionStats(totalCrownGenesList, 0),
        perGeneration,
        representativeCurve: medianSnap ? medianSnap.curve : [],
      });
    }
  }

  return results;
}

/**
 * Dedicated P0 Before vs After Trial Exploit Comparison (simulates high-tier Trial runs
 * to contrast formal progress leakage on pre-P0 baselines vs full isolation on post-P0).
 */
export function runTrialExploitContrast(params: {
  masterSeed: number;
  scenarios: Record<RuleScenarioId, RuleScenarioSpec>;
  archetypes: Record<PlayerArchetypeId, PlayerArchetypeSpec>;
}): Array<{
  scenarioId: RuleScenarioId;
  trialSharkId: string;
  trialRunScore: number;
  trialMaxLevel: number;
  trialMaxDepth: number;
  trialCurrencyCarriedCoins: number;
  trialCurrencyCarriedGenes: number;
  leakedBestLevelToSave: number;
  leakedBestDepthToSave: number;
  leakedCrownCoins: number;
  leakedCrownGenes: number;
}> {
  const { masterSeed, scenarios, archetypes } = params;
  const targets: Array<{ scId: RuleScenarioId; trialSharkId: string }> = [
    { scId: 'web_pre_p0', trialSharkId: 'shark_41_star_destroyer' },
    { scId: 'web_post_p0', trialSharkId: 'shark_41_star_destroyer' },
    { scId: 'ios_pre_p0', trialSharkId: 'shark_41_star_destroyer' },
    { scId: 'ios_post_p0', trialSharkId: 'shark_41_star_destroyer' },
  ];

  const rows: ReturnType<typeof runTrialExploitContrast> = [];
  for (const { scId, trialSharkId } of targets) {
    const scenario = scenarios[scId];
    const baseSave: SharkMetaSaveData = {
      ...createDefaultMetaSave(),
      bankedCoins: scenario.initialCoins,
      bankedGenes: scenario.initialGenes,
      bestInRunLevel: 1,
      bestDepthReached: scenario.initialBestDepth,
    };
    const seed = (masterSeed ^ hashStringToSeed(`trial:${scId}:${trialSharkId}`)) >>> 0;
    const run = simulateSingleRun({
      seed,
      rng: createSeededRng(seed),
      scenario,
      archetype: archetypes.Normal,
      sharkId: trialSharkId,
      upgradeLevel: 10,
      metaSave: baseSave,
      isTrialRun: true,
      allowInRunSpend: false,
      allowReviveAd: false,
    });
    const progressed = scenario.isolateTrialProgress
      ? baseSave
      : recordPermanentRunProgress(
          baseSave,
          { trialActive: false },
          run.finalInRunLevel,
          run.maxDepthMeters
        );

    rows.push({
      scenarioId: scId,
      trialSharkId,
      trialRunScore: run.score,
      trialMaxLevel: run.finalInRunLevel,
      trialMaxDepth: run.maxDepthMeters,
      trialCurrencyCarriedCoins: run.runCoinsEarned,
      trialCurrencyCarriedGenes: run.runGenesEarned,
      leakedBestLevelToSave: progressed.bestInRunLevel,
      leakedBestDepthToSave: progressed.bestDepthReached,
      leakedCrownCoins: run.crownCoinsAwarded,
      leakedCrownGenes: run.crownGenesAwarded,
    });
  }
  return rows;
}
