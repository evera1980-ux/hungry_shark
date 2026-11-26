import { GAME_CONFIG, PreyTierConfig } from '../../src/game/config';
import {
  addEvolutionProgress,
  buildPredationRewardPlan,
  CAMERA_ZOOM_MIN,
  collectPickupEntity,
  computeEvolvedSharkStats,
  computeHuntingHeatBuff,
  ComputedSharkStats,
  ECONOMY_PREDATION_CONFIG,
  getEffectivePreyTier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getPreyRelativeVisualScale,
  getRequiredArmorHits,
  getXpRequiredForLevel,
  MIN_RENDER_ZOOM_FLOOR,
  resolvePreyEncounter,
  WORLD_CONFIG,
} from '../../src/game/rules';
import { ADS_AND_MONETIZATION_CONFIG } from '../../src/game/adManager';
import {
  getGlobalAtlasBonuses,
  getSharkFormById,
  getSharkMasteryConfig,
  settleSharkScoreMastery,
  SharkMetaSaveData,
} from '../../src/game/sharkEvolutionConfig';
import { PreyEntity } from '../../src/game/canvasRenderer';
import {
  EcosystemSpawner,
  ViewportSpawnBounds,
} from '../../src/game/ecosystemSpawner';
import {
  infiniteProgressionManager,
  PreyMutationVariant,
} from '../../src/game/infiniteProgressionManager';
import { infiniteWorldManager } from '../../src/game/infiniteWorldManager';
import {
  detectShatterableTerraceHit,
  formatTerraceBreachKey,
  getEngineFloorDepthAt,
  getFloorDepthAt,
  meterDepthToWorldY,
  resolveSeabedCollision,
  resolveSeabedKineticStep,
  SEABED_TERRACE_TIERS,
  TERRACE_BREACH_CELL_WIDTH,
  worldYToMeterDepth,
} from '../../src/game/worldGenerationSystem';
import { worldYToMeterDepth as depthScaleYToM } from '../../src/game/depthScale';
import { rollTargetBountySpecies } from '../../src/game/sim/types';
import {
  computeIosSharkMasteryConfig,
  computeWebPreP0LegacyPredationExpectation,
} from './staticAnalyzer';
import { withSeededMathRandomSync } from './prng';
import type {
  PlayerArchetypeSpec,
  RuleScenarioSpec,
  SingleRunTelemetry,
} from './types';

interface SimPickup {
  active: boolean;
  collected: boolean;
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'COIN' | 'DNA_CRYSTAL';
  value: number;
  life: number;
}

interface IosExtraPreyState {
  armorHp: number;
  cruiseCenterY: number;
  cruiseAmpY: number;
  cruiseFreq: number;
  stateTimer: number;
}

export interface RunExecutionOptions {
  seed: number;
  rng: () => number;
  scenario: RuleScenarioSpec;
  archetype: PlayerArchetypeSpec;
  sharkId: string;
  upgradeLevel: number;
  metaSave: SharkMetaSaveData;
  isTrialRun?: boolean;
  allowReviveAd?: boolean;
  allowInRunSpend?: boolean;
  /** Optional depth goal (meters) when player is trying to push unlock reqMaxDepth */
  pushDepthMetersTarget?: number;
  /** Optional in-run level goal when player is pushing unlock reqMaxInRunLevel */
  pushLevelTarget?: number;
  /** Minimum genes to preserve when pushing level via GeneSurge */
  reserveGenesForUnlock?: number;
  /** Hard safety cap in simulated game seconds */
  maxRunDurationSec?: number;
}

const PRE_INDEXED_NON_HAZARD_PREY = GAME_CONFIG.preyTiers.filter(
  (p) => !p.isHazard && Boolean(p.externalPngUrl)
);
const PRE_INDEXED_ALL_IOS_PREY = GAME_CONFIG.preyTiers;

/**
 * Computes effective shark stats for a given Scenario, always starting from
 * `computeEvolvedSharkStats()` in `src/game/rules.ts` and applying documented iOS overrides only
 * where `GameRules.swift` actually differs.
 */
export function computeScenarioSharkStats(
  scenario: RuleScenarioSpec,
  inRunLevel: number,
  sharkId: string,
  upgradeLevel: number,
  frenzyActive: boolean,
  globalDifficultyMultiplier: number,
  unlockedCount: number,
  totalCrownCount: number = 0
): ComputedSharkStats {
  const baseStats = computeEvolvedSharkStats(
    inRunLevel,
    sharkId,
    upgradeLevel,
    frenzyActive,
    scenario.difficultyPer60s > 0 ? globalDifficultyMultiplier : 1.0,
    unlockedCount,
    totalCrownCount
  );

  if (scenario.useSharkSpecificYieldTraits) {
    return baseStats;
  }

  // Exact GameRules.swift:818-846 behavior (no per-shark coin/gene traits or #39 boss mult; fixed 1.0 damageTakenMultiplier)
  const form = getSharkFormById(sharkId);
  const extraUnlocked = Math.max(0, unlockedCount - 1);
  const collectionRewardMult = 1.0 + extraUnlocked * 0.025;
  const baseRewardMult = collectionRewardMult * (1.0 + form.row * 0.12);
  const iosGeneMult =
    baseRewardMult * (form.lineage === 'ELDER_ABYSS' ? 1.15 : 1.0);

  return {
    ...baseStats,
    coinYieldMultiplier: Number(baseRewardMult.toFixed(2)),
    geneYieldMultiplier: Number(iosGeneMult.toFixed(2)),
    rewardMultiplier: Number(baseRewardMult.toFixed(2)),
    bossRewardMultiplier: 1.0,
    damageTakenMultiplier: 1.0,
    specialPreyScoreMultiplier: 1.0,
  };
}

/** Computes iOS Heat Buff matching GameRules.swift:550-561 */
function computeIosHuntingHeatBuff(comboCount: number): {
  speedMultiplier: number;
  scoreMultiplier: number;
} {
  if (comboCount >= 18) return { speedMultiplier: 1.24, scoreMultiplier: 1.6 };
  if (comboCount >= 10) return { speedMultiplier: 1.15, scoreMultiplier: 1.3 };
  if (comboCount >= 4) return { speedMultiplier: 1.08, scoreMultiplier: 1.15 };
  return { speedMultiplier: 1.0, scoreMultiplier: 1.0 };
}

/**
 * Finds the best biological depth zone `worldY` band for an active shark given its
 * biteTier, biological body length filter (`minSpawnablePreyLengthM`), and player depth aggression.
 */
function computeOptimalHuntingDepthY(
  normalBiteTier: number,
  minPreyLenCm: number,
  archetype: PlayerArchetypeSpec,
  pushDepthMetersTarget?: number
): { minY: number; maxY: number; preferredY: number } {
  const viable = PRE_INDEXED_NON_HAZARD_PREY.filter((p) => {
    if (p.tier > normalBiteTier + 2) return false;
    const lenCm = p.bodyLengthCm ?? p.radius * 2.5;
    return lenCm >= minPreyLenCm;
  });

  if (viable.length === 0) {
    return { minY: 600, maxY: 2200, preferredY: 1200 };
  }

  // Score discrete depth probes (every 120px up to 16000px) by edible prey expected coin/tier richness
  let bestY = 300;
  let bestScore = -1;
  let maxSafeY = 480;

  for (let probeY = 140; probeY <= 15000; probeY += 160) {
    const isShallow = probeY <= 520;
    let edibleCount = 0;
    let edibleTierSum = 0;
    let hazardPenalty = 0;

    for (const p of viable) {
      if (probeY < p.minDepth || probeY > p.maxDepth) continue;
      if (
        isShallow &&
        (p.behavior === 'EEL_CHARGER' ||
          p.behavior === 'SUB_PATROL' ||
          p.behavior === 'HEAVY_CRUISER' ||
          p.behavior === 'KRAKEN_BOSS')
      ) {
        continue;
      }
      edibleCount++;
      if (p.tier <= normalBiteTier) {
        edibleTierSum += p.coinValue + p.geneValue * 1.5;
      } else {
        edibleTierSum += p.coinValue * 0.35;
      }
    }

    // Penalize depths dominated by lethal predators way above shark biteTier
    for (const p of PRE_INDEXED_NON_HAZARD_PREY) {
      if (probeY >= p.minDepth && probeY <= p.maxDepth && p.tier >= normalBiteTier + 4) {
        hazardPenalty += 1;
      }
    }

    if (edibleCount > 0) {
      maxSafeY = Math.max(maxSafeY, probeY);
      const sanctuarySafety =
        probeY <= 520
          ? 1.2
          : normalBiteTier < 10
          ? 0.28
          : 1 / (1 + hazardPenalty * 0.16);
      const desirability =
        (edibleTierSum / Math.max(1, edibleCount)) *
        Math.min(1.0, edibleCount / 4.0) *
        sanctuarySafety;
      if (desirability > bestScore) {
        bestScore = desirability;
        bestY = probeY;
      }
    }
  }

  let preferredY = bestY;
  if (archetype.depthAggression < 0.55) {
    preferredY = Math.max(180, bestY * (0.55 + archetype.depthAggression * 0.65));
  }
  if (pushDepthMetersTarget && pushDepthMetersTarget > 0) {
    const goalY = meterDepthToWorldY(pushDepthMetersTarget);
    if (goalY > preferredY) {
      preferredY = Math.min(maxSafeY + 350, goalY);
    }
  }

  return {
    minY: Math.max(95, preferredY - 260),
    maxY: Math.min(18500, preferredY + 260),
    preferredY: Math.max(160, Math.min(18000, preferredY)),
  };
}

/** Mirror of PreySimulation.swift:spawnOnePrey() for iOS fidelity */
function spawnIosPreyOffScreen(
  activePreys: PreyEntity[],
  iosExtra: WeakMap<PreyEntity, IosExtraPreyState>,
  uidRef: { nextUid: number },
  sharkX: number,
  sharkY: number,
  stats: ComputedSharkStats,
  renderZoom: number,
  cameraX: number,
  rng: () => number
): PreyEntity | null {
  const viewW = 1280;
  const viewH = 720;
  const invZoom = 1 / Math.max(CAMERA_ZOOM_MIN, renderZoom);
  const halfViewW = Math.max(520, (viewW * 0.5) / renderZoom);
  const halfViewH = Math.max(320, (viewH * 0.5) / renderZoom);
  const verticalSpread = Math.min(halfViewH * 0.85, Math.max(260, halfViewH * 0.72));

  const minSpawnLenM = stats.minSpawnablePreyLengthM ?? 0;
  let targetDepth = Math.max(45, sharkY + (rng() * 2 - 1) * verticalSpread);
  if (sharkY <= 430 && minSpawnLenM < 1.2) {
    targetDepth = Math.min(495, targetDepth);
  }
  const isShallowZone = targetDepth <= 520;
  const habitatPool = PRE_INDEXED_ALL_IOS_PREY.filter((p) => {
    if (
      isShallowZone &&
      (p.isHazard ||
        p.isBoss ||
        p.behavior === 'EEL_CHARGER' ||
        p.behavior === 'SUB_PATROL')
    ) {
      return false;
    }
    return targetDepth >= p.minDepth && targetDepth <= p.maxDepth;
  });
  const rawCandidates =
    habitatPool.length > 0
      ? habitatPool
      : isShallowZone
      ? PRE_INDEXED_ALL_IOS_PREY.filter((p) => p.minDepth <= 520)
      : targetDepth > 1150
      ? PRE_INDEXED_ALL_IOS_PREY.filter((p) => p.maxDepth >= 1150)
      : PRE_INDEXED_ALL_IOS_PREY.filter(
          (p) => p.minDepth >= 500 || p.maxDepth >= 800
        );

  const minPreyLenCm = minSpawnLenM * 100;
  const candidates =
    minPreyLenCm > 0
      ? rawCandidates.filter(
          (p) => (p.bodyLengthCm ?? p.radius * 2.5) >= minPreyLenCm
        )
      : rawCandidates;
  if (candidates.length === 0) return null;

  let targetTier = 2.0;
  if (targetDepth <= 520) {
    targetTier = 1 + ((targetDepth - 25) / 495) * 8.5;
  } else if (targetDepth <= 2000) {
    targetTier = 9.5 + ((targetDepth - 520) / 1480) * 6.5;
  } else if (targetDepth <= 6000) {
    targetTier = 16 + ((targetDepth - 2000) / 4000) * 10;
  } else if (targetDepth <= 10000) {
    targetTier = 26 + ((targetDepth - 6000) / 4000) * 10;
  } else if (targetDepth <= 16000) {
    targetTier = 36 + ((targetDepth - 10000) / 6000) * 7;
  } else {
    targetTier = 43 + Math.min(1, (targetDepth - 16000) / 4000) * 5;
  }

  const predatorRoll = rng();
  if (predatorRoll < 0.12) targetTier = Math.min(48, targetTier + 4.5);
  else if (predatorRoll < 0.36) targetTier = Math.min(48, targetTier + 2.0);

  let totalW = 0;
  const weights = new Array<number>(candidates.length);
  for (let i = 0; i < candidates.length; i++) {
    const diff = (candidates[i].tier - targetTier) / 3.0;
    const w = 1 / (1 + diff * diff);
    weights[i] = w;
    totalW += w;
  }
  let roll = rng() * Math.max(0.001, totalW);
  let chosen = candidates[candidates.length - 1];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = candidates[i];
      break;
    }
  }

  const spawnOnLeft = rng() < 0.5;
  const edgeOffset = (80 + rng() * 95) * invZoom;
  const px = infiniteWorldManager.wrapEntityX(
    spawnOnLeft ? cameraX - halfViewW - edgeOffset : cameraX + halfViewW + edgeOffset
  );
  const dir = rng() < 0.5 ? 1 : -1;
  const localFloorLimit = Math.max(
    140,
    getFloorDepthAt(px) - chosen.radius - 34
  );
  const rawPy = Math.max(
    chosen.minDepth,
    Math.min(chosen.maxDepth, sharkY + (rng() * 2 - 1) * halfViewH * 0.82)
  );
  const clampedPy = Math.min(localFloorLimit, rawPy);
  const spawnCol = resolveSeabedCollision(
    px,
    clampedPy,
    chosen.radius + 16,
    10,
    undefined,
    clampedPy
  );
  const py = Math.max(
    chosen.minDepth + 16,
    Math.min(localFloorLimit, spawnCol.engineY)
  );

  const mutation: PreyMutationVariant =
    rng() < 0.08 ? 'GOLDEN_MUTANT' : 'NONE';

  const entity: PreyEntity = {
    uid: uidRef.nextUid++,
    config: chosen,
    x: px,
    y: py,
    vx: dir * chosen.baseSpeed,
    vy: (rng() - 0.5) * 16,
    angle: dir > 0 ? 0 : Math.PI,
    phase: rng() * Math.PI * 2,
    telegraphTimer: 0,
    isInflated: false,
    scaleMultiplier: 1.0,
    mutationVariant: mutation,
    devoured: false,
  };
  iosExtra.set(entity, {
    armorHp: 2,
    cruiseCenterY: Math.max(
      chosen.minDepth + 35,
      Math.min(chosen.maxDepth - 35, py)
    ),
    cruiseAmpY: 12 + rng() * 14,
    cruiseFreq: 0.36 + rng() * 0.32,
    stateTimer: rng() * 4.0,
  });
  activePreys.push(entity);
  return entity;
}

/**
 * Headless 2D Spatial Run Simulator driven directly by real Web TypeScript modules
 * (or exact Swift-mirrored iOS variants using shared `GAME_CONFIG.preyTiers` & `SHARK_EVOLUTION_FORMS`).
 */
export function simulateSingleRun(options: RunExecutionOptions): SingleRunTelemetry {
  const {
    seed,
    rng,
    scenario,
    archetype,
    sharkId,
    upgradeLevel,
    metaSave,
    isTrialRun = false,
    allowReviveAd = false,
    allowInRunSpend = true,
    pushDepthMetersTarget,
    pushLevelTarget,
    reserveGenesForUnlock = 0,
    maxRunDurationSec,
  } = options;

  return withSeededMathRandomSync(rng, () => {
    const dt = 0.05; // 20 Hz fixed spatial physics step
    const viewW = 1280;
    const viewH = 720;
    const isIosPool = scenario.platformBase === 'ios';
    const effectiveMaxRunSec =
      maxRunDurationSec ??
      Math.round(archetype.sessionHorizonSec * (0.86 + rng() * 0.28));

    // Initialize isolated spawner & progression state for this run
    const spawner = new EcosystemSpawner(scenario.maxActivePreys, 1650, 640);
    const activePreys: PreyEntity[] = [];
    const settledPreyUids = new Set<number>();
    const breachedTerraceCells = new Set<string>();
    const iosExtraMap = new WeakMap<PreyEntity, IosExtraPreyState>();
    const iosUidRef = { nextUid: 1 };
    let iosSpawnTimer = 0.35 + rng() * 0.53;

    // Reset shared infinite progression manager safely before running
    infiniteProgressionManager.reset();
    if (scenario.frenzyInitProtectionSec === 0) {
      infiniteProgressionManager.frenzyCooldownTimer = 0;
    } else {
      infiniteProgressionManager.frenzyCooldownTimer = scenario.frenzyInitProtectionSec;
    }

    const unlockedCount = metaSave.unlockedSharkIds.length;
    const form = getSharkFormById(sharkId);
    const atlasBonus = getGlobalAtlasBonuses(metaSave);

    const trialCfg = ADS_AND_MONETIZATION_CONFIG.placements.TRIAL_SHARK;
    let level = isTrialRun
      ? (scenario.id === 'ios_pre_p0' ? 5 : trialCfg.trialInRunLevel)
      : 1;
    let xp = 0;
    let xpEarned = 0;
    let score = 0;
    let frenzyTimer = isTrialRun && scenario.id !== 'ios_pre_p0'
      ? trialCfg.initialFrenzyDurationSec
      : 0;
    let frenzyTriggers = frenzyTimer > 0 ? 1 : 0;
    let frenzySeconds = 0;
    let goldenCharge = 0;
    let frenzyCooldown = scenario.frenzyInitProtectionSec;
    let goldenNeeds = Math.max(
      ECONOMY_PREDATION_CONFIG.frenzy.minChargeFloor,
      scenario.goldenNeedForFrenzy - (form.traits?.goldenMutantReduction ?? 0)
    );

    let globalDiffMult = 1.0;
    let stats = computeScenarioSharkStats(
      scenario,
      level,
      sharkId,
      upgradeLevel,
      frenzyTimer > 0,
      globalDiffMult,
      unlockedCount,
      atlasBonus.totalMasteryCrowns
    );

    const initWorldScale = stats.worldScale ?? stats.scale;
    const initSpawnY = Math.max(220, Math.round(22 * initWorldScale + 95));
    let sharkX = 0;
    let sharkY = initSpawnY;
    let sharkVx = 0;
    let sharkVy = 0;
    let sharkAngle = 0;
    let hp = stats.maxHp;
    let energy = stats.maxEnergy;
    let invulnTimer = 1.8;
    let comboCount = 0;
    let comboTimer = 0;
    let maxDepthMeters = Math.max(
      22,
      Math.round(depthScaleYToM(sharkY))
    );
    let survivalSec = 0;
    let maxDiffObserved = 1.0;

    // Telemetry accumulators
    let preyEaten = 0;
    let goldMutantsEaten = 0;
    let behemothsEaten = 0;
    let armorCrushes = 0;
    let bountiesCompleted = 0;
    let damageHitsTaken = 0;
    let revivesUsed = 0;
    let goldOverdrivesUsed = 0;
    let geneSurgesUsed = 0;
    let coinsFromOverdriveSpend = 0;
    let genesFromSurgeSpend = 0;

    let coinsFromDirectPredation = 0;
    let genesFromDirectPredation = 0;
    let coinsFromPickups = 0;
    let genesFromPickups = 0;
    let coinsFromBounty = 0;
    let genesFromBounty = 0;
    let coinsGenerated = 0;
    let genesGenerated = 0;

    const genePityState = { pityMissStreak: 0, rng };
    let unifiedGeneMissStreak = 0;

    // Crown tracking (respecting Scenario timing & Trial isolation)
    let workingSave: SharkMetaSaveData = {
      ...metaSave,
      sharkBestScores: { ...(metaSave.sharkBestScores ?? {}) },
      sharkMasteryTiers: { ...(metaSave.sharkMasteryTiers ?? {}) },
    };
    const iosMasteryCfg = computeIosSharkMasteryConfig(form);
    const startCrownTier = workingSave.sharkMasteryTiers?.[sharkId] ?? 0;
    let liveCrownTier = startCrownTier;
    let crownCoinsAwarded = 0;
    let crownGenesAwarded = 0;

    // Pickups pool
    const pickups: SimPickup[] = [];
    let nextPickupId = 1;

    const spawnPickupLocal = (
      px: number,
      py: number,
      pvx: number,
      pvy: number,
      kind: 'COIN' | 'DNA_CRYSTAL',
      val: number
    ) => {
      if (val <= 0) return;
      if (kind === 'COIN') coinsGenerated += val;
      else genesGenerated += val;

      // Enforce Web MAX_PICKUPS = 120 soft capacity if ever exceeded
      if (!isIosPool && pickups.length >= 120) {
        const inactiveIdx = pickups.findIndex((pk) => !pk.active);
        if (inactiveIdx >= 0) {
          const pk = pickups[inactiveIdx];
          pk.active = true;
          pk.collected = false;
          pk.id = nextPickupId++;
          pk.x = px;
          pk.y = py;
          pk.vx = pvx;
          pk.vy = pvy;
          pk.kind = kind;
          pk.value = val;
          pk.life = scenario.pickupLifetimeSec ?? 99999;
          return;
        }
        pickups.shift();
      }
      pickups.push({
        active: true,
        collected: false,
        id: nextPickupId++,
        x: px,
        y: py,
        vx: pvx,
        vy: pvy,
        kind,
        value: val,
        life: scenario.pickupLifetimeSec ?? 99999,
      });
    };

    // Initial Bounty target using real `rollTargetBountySpecies`
    const minPreyLenCmInit = (stats.realBodyLengthM ?? 0.8) * 13.3;
    let targetBountyConfig: PreyTierConfig = rollTargetBountySpecies(
      stats.normalBiteTier ?? stats.biteTier,
      sharkY,
      undefined,
      minPreyLenCmInit
    );
    let bountyProgress = 0;
    const bountyRequired =
      scenario.bountyMode === 'web_dynamic_2kill'
        ? 2
        : scenario.bountyMode === 'unified_scaled_2kill'
        ? ECONOMY_PREDATION_CONFIG.bounty.requiredKills
        : 3;

    spawner.activeTargetPreyId = targetBountyConfig.id;
    spawner.activeSharkBiteTier = stats.normalBiteTier ?? stats.biteTier;
    spawner.tutorialProtectionActive = false;
    spawner.reset(activePreys);

    const initCamZoom = Math.max(CAMERA_ZOOM_MIN, stats.cameraZoom);
    const initViewport: ViewportSpawnBounds = {
      halfW: Math.max(680, (viewW * 0.5) / initCamZoom),
      halfH: Math.max(400, (viewH * 0.5) / initCamZoom),
      cameraX: sharkX,
      cameraY: sharkY,
      sharkVx: 0,
      renderZoom: initCamZoom,
    };

    for (let i = 0; i < scenario.maxActivePreys; i++) {
      const p = isIosPool
        ? spawnIosPreyOffScreen(
            activePreys,
            iosExtraMap,
            iosUidRef,
            sharkX,
            sharkY,
            stats,
            initCamZoom,
            sharkX,
            rng
          )
        : spawner.spawnPreyOffScreen(
            activePreys,
            sharkX,
            sharkY,
            rng,
            undefined,
            score,
            stats.realBodyLengthM,
            initViewport
          );
      if (!p) break;
      if (i < 3) {
        p.config = targetBountyConfig;
        p.y = Math.max(
          Math.max(25, targetBountyConfig.minDepth),
          Math.min(targetBountyConfig.maxDepth, p.y)
        );
      }
    }

    // Optimal hunting band tracking (recomputed when level / biteTier changes)
    let cachedBandBiteTier = stats.normalBiteTier ?? stats.biteTier;
    let depthBand = computeOptimalHuntingDepthY(
      cachedBandBiteTier,
      minPreyLenCmInit,
      archetype,
      pushDepthMetersTarget
    );

    // Steering AI state
    let decisionTimer = 0;
    let steerAngle = 0;
    let steerWantsBoost = false;
    let wanderDir = rng() < 0.5 ? 1 : -1;
    let hudCrownTimer = 0;
    let ledgeSlideTimer = 0;
    let ledgeSlideTargetDir = rng() < 0.5 ? 1 : -1;
    let endedBySessionHorizon = false;

    // ==================== MAIN TICK LOOP (20 Hz real physics) ====================
    while (survivalSec < effectiveMaxRunSec) {
      survivalSec += dt;

      // 1. Time Difficulty Creep (Web InfiniteProgressionManager every 60s +10% vs iOS 0)
      if (scenario.difficultyPer60s > 0) {
        const prevDiff = infiniteProgressionManager.globalDifficultyMultiplier;
        infiniteProgressionManager.update(dt);
        // If scenario uses a non-default rate (e.g. unified 0.05/min), override smoothly & cap
        if (scenario.difficultyPer60s !== 0.1) {
          infiniteProgressionManager.globalDifficultyMultiplier = Math.min(
            WORLD_CONFIG.timeDifficulty.maxDifficultyMultiplier,
            Number(
              (1.0 + Math.floor(survivalSec / WORLD_CONFIG.timeDifficulty.intervalSec) * scenario.difficultyPer60s).toFixed(2)
            )
          );
        }
        globalDiffMult = infiniteProgressionManager.globalDifficultyMultiplier;
        if (globalDiffMult > maxDiffObserved) maxDiffObserved = globalDiffMult;
        if (globalDiffMult !== prevDiff) {
          stats = computeScenarioSharkStats(
            scenario,
            level,
            sharkId,
            upgradeLevel,
            frenzyTimer > 0,
            globalDiffMult,
            unlockedCount,
            atlasBonus.totalMasteryCrowns
          );
        }
      }
      if (frenzyCooldown > 0) {
        frenzyCooldown = Math.max(0, frenzyCooldown - dt);
        infiniteProgressionManager.frenzyCooldownTimer = frenzyCooldown;
      }

      // 2. Frenzy & Combo timers
      if (comboTimer > 0) {
        comboTimer = Math.max(0, comboTimer - dt);
        if (comboTimer <= 0) comboCount = 0;
      }
      if (frenzyTimer > 0) {
        frenzySeconds += dt;
        frenzyTimer = Math.max(0, frenzyTimer - dt);
        if (frenzyTimer <= 0) {
          stats = computeScenarioSharkStats(
            scenario,
            level,
            sharkId,
            upgradeLevel,
            false,
            globalDiffMult,
            unlockedCount,
            atlasBonus.totalMasteryCrowns
          );
        }
      }
      if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);

      const worldScale = stats.worldScale ?? stats.scale;
      const effCamZoom = Math.max(MIN_RENDER_ZOOM_FLOOR, stats.cameraZoom);
      const invZoom = 1 / Math.max(CAMERA_ZOOM_MIN, effCamZoom);
      const halfViewW = (viewW * 0.5) / effCamZoom;
      const halfViewH = (viewH * 0.5) / effCamZoom;
      const minPreyLenCm = (stats.realBodyLengthM ?? 0.8) * 13.3;

      // 3. Archetype Tactical Decision & Steering AI
      if (ledgeSlideTimer > 0) {
        ledgeSlideTimer = Math.max(0, ledgeSlideTimer - dt);
      }
      decisionTimer -= dt;
      if (decisionTimer <= 0) {
        decisionTimer = archetype.decisionIntervalSec * (0.85 + rng() * 0.3);

        const curBiteT = stats.normalBiteTier ?? stats.biteTier;
        if (curBiteT !== cachedBandBiteTier) {
          cachedBandBiteTier = curBiteT;
          depthBand = computeOptimalHuntingDepthY(
            curBiteT,
            minPreyLenCm,
            archetype,
            pushDepthMetersTarget
          );
        }

        const hasFoodHere = spawner.hasViablePreyAtDepth(
          sharkY,
          stats.realBodyLengthM
        );

        let targetX = sharkX + wanderDir * 320 * invZoom;
        let targetY = depthBand.preferredY;
        let wantBoostNow = frenzyTimer > 0;

        const halfVisW = halfViewW * archetype.sightScreenFrac;
        const senseRange = halfVisW;
        const shouldWanderThisCycle =
          rng() < archetype.cruisingWanderRate && hp > stats.maxHp * 0.42;

        if (ledgeSlideTimer > 0) {
          // Navigating horizontally along a reef shelf / seabed wall to pass through canyon gap
          targetX = sharkX + ledgeSlideTargetDir * 600 * invZoom;
          targetY = sharkY + 75 * ledgeSlideTargetDir * 0 + (sharkY < depthBand.preferredY ? 120 : -90);
          wantBoostNow = frenzyTimer > 0 || (energy > stats.maxEnergy * 0.45 && rng() < 0.45);
        } else if (!hasFoodHere) {
          // Deep-dive out of depleted shallows
          const minViableY = spawner.getMinViableWorldYForShark(
            stats.realBodyLengthM
          );
          targetY = minViableY !== null ? minViableY + 260 : 1200;
          wantBoostNow = energy > 25 && rng() < 0.7;
        } else if (shouldWanderThisCycle) {
          if (rng() < 0.15) wanderDir = -wanderDir;
          targetX = sharkX + wanderDir * 420 * invZoom;
          targetY = depthBand.preferredY + (rng() - 0.5) * 260;
          wantBoostNow =
            frenzyTimer > 0 ||
            (energy > stats.maxEnergy * 0.45 && rng() < archetype.boostUsageRate * 0.6);
        } else {
          // Score nearby pickups & prey inside visible screen perception radius
          let bestUtility = -1e9;
          let bestIsPickup = false;
          let bestNeedsCrush = false;

          const curMagR = isIosPool
            ? ((frenzyTimer > 0 ? 390 : 120) + stats.magnetRadius) * invZoom
            : (stats.magnetRadius +
                (scenario.heatMode === 'web_score_magnet_regen'
                  ? computeHuntingHeatBuff(comboCount).magnetRadiusBonus
                  : 0)) *
              (frenzyTimer > 0 ? ECONOMY_PREDATION_CONFIG.pickups.frenzyMagnetMultiplier : 1.0) *
              invZoom;

          // Only detour for pickups outside current magnet pull (inner pickups are pulled automatically)
          if (hp > stats.maxHp * 0.35 && archetype.pickupChaseWeight > 0.35) {
            for (let i = 0; i < pickups.length; i++) {
              const pk = pickups[i];
              if (!pk.active || pk.collected) continue;
              const dx = infiniteWorldManager.getShortestDeltaX(sharkX, pk.x);
              const dy = pk.y - sharkY;
              const d = Math.hypot(dx, dy);
              if (d < curMagR * 0.9 || d > curMagR * 2.2) continue;

              const isDna = pk.kind === 'DNA_CRYSTAL';
              const valueEq = isDna
                ? pk.value * (1.8 + archetype.dnaPriorityWeight * 1.4)
                : pk.value * 0.45;
              const urgencyBonus =
                pk.life < 4.0 && scenario.pickupLifetimeSec !== null ? 1.5 : 1.0;
              const util =
                archetype.pickupChaseWeight *
                (valueEq * urgencyBonus) /
                Math.max(40, d * 0.35);

              if (util > bestUtility) {
                bestUtility = util;
                targetX = sharkX + dx;
                targetY = pk.y;
                bestIsPickup = true;
                bestNeedsCrush = false;
              }
            }
          }

          // Evaluate visible prey
          for (let i = 0; i < activePreys.length; i++) {
            const p = activePreys[i];
            if (p.devoured) continue;
            const dx = infiniteWorldManager.getShortestDeltaX(sharkX, p.x);
            const dy = p.y - sharkY;
            const d = Math.hypot(dx, dy);
            if (d > senseRange) continue;

            const effT = getEffectivePreyTier(p.config, p.mutationVariant);
            const isDanger =
              (p.config.isHazard && !stats.canEatMines && frenzyTimer <= 0) ||
              (frenzyTimer <= 0 && effT >= stats.biteTier + 4);
            if (isDanger) {
              // Evade threat proportionally to archetype hazardAvoidanceSkill
              if (d < 210 * worldScale && rng() < archetype.hazardAvoidanceSkill) {
                targetX = sharkX - dx * 2.2;
                targetY = Math.max(90, sharkY - dy * 1.8);
                bestUtility = 99999;
                bestIsPickup = false;
              }
              continue;
            }

            const needsCrush = frenzyTimer <= 0 && effT > stats.biteTier;
            if (needsCrush && effT <= stats.biteTier + 3) {
              if (
                energy < 30 ||
                rng() > archetype.armorCrushAggression
              ) {
                continue;
              }
            }

            const isBounty = p.config.id === targetBountyConfig.id;
            const isGold = p.mutationVariant === 'GOLDEN_MUTANT';
            const valueWeight =
              (p.config.coinValue + p.config.geneValue * 2.4 + p.config.hpRestore * 0.4) *
              (isGold ? 2.8 : 1.0) *
              (isBounty ? 1 + archetype.bountyFocusWeight * 2.5 : 1.0);
            const distPenalty = Math.max(40, d * 0.14);
            const depthPenalty =
              p.y > depthBand.maxY + 450
                ? 0.45
                : p.y < depthBand.minY - 350
                ? 0.65
                : 1.0;

            const isDivingToBand = sharkY < depthBand.minY - 350;
            const util =
              (valueWeight / distPenalty) *
              depthPenalty *
              (isDivingToBand && p.y < sharkY ? 0.15 : 1.0);
            if (util > bestUtility) {
              bestUtility = util;
              targetX = sharkX + dx;
              targetY = p.y;
              bestIsPickup = false;
              bestNeedsCrush = needsCrush;
            }
          }

          if (sharkY < depthBand.minY - 350 && bestUtility < 0.8) {
            // Continue diving into optimal depth layer if current corridor is sparse
            if (rng() < 0.08) wanderDir = -wanderDir;
            targetX = sharkX + wanderDir * 180 * invZoom;
            targetY = depthBand.preferredY;
          } else if (bestUtility < 0) {
            if (rng() < 0.08) wanderDir = -wanderDir;
            targetX = sharkX + wanderDir * 350 * invZoom;
            targetY =
              depthBand.preferredY + (rng() - 0.5) * 180;
          }

          wantBoostNow =
            frenzyTimer > 0 ||
            bestNeedsCrush ||
            (!bestIsPickup &&
              energy > stats.maxEnergy * 0.35 &&
              rng() < archetype.boostUsageRate);
        }

        const rawAngle = Math.atan2(targetY - sharkY, targetX - sharkX);
        const angleJitter =
          (1 - archetype.huntingSkill) * (rng() - 0.5) * 1.05;
        steerAngle = rawAngle + angleJitter;
        steerWantsBoost = wantBoostNow && (energy > 2 || frenzyTimer > 0);
      }

      // Smooth shark turning (matching stepSimulation.ts)
      let angDiff = steerAngle - sharkAngle;
      while (angDiff > Math.PI) angDiff -= Math.PI * 2;
      while (angDiff < -Math.PI) angDiff += Math.PI * 2;
      const isBoosting = steerWantsBoost && (energy > 2 || frenzyTimer > 0);
      const turnAgility = (isBoosting ? 15 : 11.5) * (1 + Math.min(0.45, Math.abs(angDiff) / Math.PI));
      sharkAngle += angDiff * Math.min(1, dt * turnAgility);

      // 4. Shark Physics & Metabolic Energy/HP Drain
      if (isBoosting) {
        energy = Math.max(0, energy - stats.boostDrainPerSec * dt);
      } else {
        const surfaceBreather = sharkY < 48 * worldScale ? 18 : 0;
        const regenBonus =
          scenario.heatMode === 'web_score_magnet_regen'
            ? computeHuntingHeatBuff(comboCount).energyRegenBonus
            : 0;
        const regenMult = stats.boostRegenMultiplier ?? 1.0;
        energy = Math.min(
          stats.maxEnergy,
          energy +
            (GAME_CONFIG.world.baseBoostRegenPerSec * regenMult +
              surfaceBreather +
              regenBonus) *
              dt
        );
      }

      const heatMultSpeed =
        scenario.heatMode === 'ios_combo_speed_score'
          ? computeIosHuntingHeatBuff(comboCount).speedMultiplier
          : 1.0;
      const targetScreenSpeed =
        (isBoosting ? stats.boostSpeed : stats.moveSpeed * 0.92) * heatMultSpeed;
      const worldSpeed = targetScreenSpeed * invZoom;
      sharkVx = Math.cos(sharkAngle) * worldSpeed;
      sharkVy = Math.sin(sharkAngle) * worldSpeed;

      const prevSharkX = sharkX;
      const prevSharkY = sharkY;
      const sharkRadiusWorld = 22 * worldScale;
      const candNextX = sharkX + sharkVx * dt;
      const candNextY = sharkY + sharkVy * dt;
      let nearTerraceBand = false;
      for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
        const tierSpec = SEABED_TERRACE_TIERS[tIdx];
        const bMin = tierSpec.minRidgeY - sharkRadiusWorld - 265;
        const bMax = tierSpec.archMaxDepthY + sharkRadiusWorld + 125;
        if (
          !(
            (candNextY < bMin && prevSharkY < bMin) ||
            (candNextY > bMax && prevSharkY > bMax)
          )
        ) {
          nearTerraceBand = true;
          break;
        }
      }
      const floorEngineYQuick =
        candNextY + sharkRadiusWorld + 5 < 420
          ? 420
          : getEngineFloorDepthAt(candNextX);

      if (!nearTerraceBand && candNextY + sharkRadiusWorld + 5 < floorEngineYQuick) {
        sharkX = infiniteWorldManager.wrapEntityX(candNextX);
        sharkY = Math.max(46, Math.min(20000, candNextY));
      } else {
        const step = resolveSeabedKineticStep(
          sharkX,
          sharkY,
          sharkVx,
          sharkVy,
          dt,
          sharkRadiusWorld,
          undefined,
          {
            sharkLengthM: stats.realBodyLengthM,
            breachedCells: breachedTerraceCells,
          }
        );
        sharkX = infiniteWorldManager.wrapEntityX(step.engineX);
        sharkY = Math.max(46, Math.min(20000, step.engineY));
        sharkVx = step.vx;
        sharkVy = step.vy;

        // Shatter upper seabed terraces when giant shark collides (matching stepSimulation.ts:488-517)
        const shatterHit = detectShatterableTerraceHit(
          prevSharkX,
          prevSharkY,
          sharkX,
          sharkY,
          sharkRadiusWorld,
          stats.realBodyLengthM ?? 0.8,
          breachedTerraceCells
        );
        if (shatterHit) {
          const cellSpan = Math.max(
            1,
            Math.ceil(sharkRadiusWorld / TERRACE_BREACH_CELL_WIDTH)
          );
          for (
            let c = shatterHit.cellIndex - cellSpan;
            c <= shatterHit.cellIndex + cellSpan;
            c++
          ) {
            const key = formatTerraceBreachKey(shatterHit.tierIndex, c);
            if (!breachedTerraceCells.has(key)) {
              if (breachedTerraceCells.size >= 512) {
                const oldest = breachedTerraceCells.values().next().value;
                if (oldest !== undefined) breachedTerraceCells.delete(oldest);
              }
              breachedTerraceCells.add(key);
            }
          }
        }

        // If blocked vertically by seabed terrace / ceiling, steer persistently sideways to clear shelf opening
        if (
          step.collided &&
          Math.abs(Math.sin(steerAngle)) > 0.4 &&
          Math.abs(sharkY - prevSharkY) < Math.abs(Math.sin(steerAngle) * worldSpeed * dt) * 0.3
        ) {
          if (ledgeSlideTimer <= 0) {
            ledgeSlideTimer = 2.0;
            decisionTimer = 0;
          }
        }
      }

      const curDepthM = Math.round(worldYToMeterDepth(sharkY));
      if (curDepthM > maxDepthMeters) maxDepthMeters = curDepthM;

      // Passive HP Hunger Drain (paused during Frenzy)
      hp = Math.max(0, hp - stats.hpDrainPerSec * dt);

      // Optional Tactical Active Skills (Gold Overdrive & Gene Surge) on emergency HP / high ROI
      if (allowInRunSpend) {
        const canSpendCoins = metaSave.bankedCoins + coinsFromPickups + coinsFromDirectPredation + coinsFromBounty - coinsFromOverdriveSpend;
        const canSpendGenes = metaSave.bankedGenes + genesFromPickups + genesFromDirectPredation + genesFromBounty + crownGenesAwarded - genesFromSurgeSpend;
        if (
          hp > 0 &&
          hp < stats.maxHp * archetype.emergencyHpRatioForOverdrive &&
          goldOverdrivesUsed < archetype.maxGoldOverdrivePerRun &&
          !(scenario.goldOverdriveBlockWhileFrenzy && frenzyTimer > 0)
        ) {
          const overdriveCost = getGoldOverdriveCost(goldOverdrivesUsed, form.row);
          if (canSpendCoins >= overdriveCost && overdriveCost <= stats.maxHp * 2.5) {
            goldOverdrivesUsed += 1;
            coinsFromOverdriveSpend += overdriveCost;
            frenzyTimer = Math.max(
              frenzyTimer,
              scenario.goldOverdriveDurationBase + stats.frenzyDurationBonus
            );
            frenzyTriggers += 1;
            stats = computeScenarioSharkStats(
              scenario,
              level,
              sharkId,
              upgradeLevel,
              true,
              globalDiffMult,
              unlockedCount,
              atlasBonus.totalMasteryCrowns
            );
            hp =
              scenario.goldOverdriveHealPctOrFlat.kind === 'full'
                ? stats.maxHp
                : scenario.goldOverdriveHealPctOrFlat.kind === 'pct'
                ? Math.min(stats.maxHp, hp + Math.round(stats.maxHp * scenario.goldOverdriveHealPctOrFlat.value))
                : Math.min(stats.maxHp, hp + scenario.goldOverdriveHealPctOrFlat.value);
            energy = stats.maxEnergy;
            invulnTimer = Math.max(invulnTimer, 1.0);
          }
        }
        const isPushingLevelWall =
          typeof pushLevelTarget === 'number' &&
          level < pushLevelTarget &&
          (level >= Math.max(1, pushLevelTarget - 4) ||
            survivalSec >= effectiveMaxRunSec * 0.65);
        const effectiveSurgeCap = isPushingLevelWall
          ? Math.max(archetype.maxGeneSurgePerRun, 10)
          : archetype.maxGeneSurgePerRun;
        if (
          geneSurgesUsed < effectiveSurgeCap &&
          hp > 0 &&
          (isPushingLevelWall || (hp < stats.maxHp * 0.25 && form.row >= 3))
        ) {
          const surgeCost = getGeneSurgeCost(level, geneSurgesUsed, form.row);
          const safeThreshold = isPushingLevelWall
            ? reserveGenesForUnlock + surgeCost
            : Math.max(reserveGenesForUnlock, surgeCost * 4);
          if (canSpendGenes >= safeThreshold) {
            geneSurgesUsed += 1;
            genesFromSurgeSpend += surgeCost;
            const surgeCfg = ECONOMY_PREDATION_CONFIG.activeSkills.geneSurge;
            const surgeHeal =
              scenario.predationMode === 'web_post_p0_single_pickup'
                ? Math.max(surgeCfg.healMinFlat, Math.round(stats.maxHp * surgeCfg.healMaxHpPct))
                : 35;
            const bonusXp = Math.round(getXpRequiredForLevel(level) * surgeCfg.xpGrantRatio);
            xpEarned += bonusXp;
            const prog = addEvolutionProgress(level, xp, bonusXp);
            level = prog.level;
            xp = prog.xp;
            if (prog.leveledUpCount > 0) {
              stats = computeScenarioSharkStats(
                scenario,
                level,
                sharkId,
                upgradeLevel,
                frenzyTimer > 0,
                globalDiffMult,
                unlockedCount,
                atlasBonus.totalMasteryCrowns
              );
              hp = Math.min(stats.maxHp, hp + Math.round(stats.maxHp * WORLD_CONFIG.inRunLevelProgression.levelUpHealMaxHpPct));
            }
            hp = Math.min(stats.maxHp, hp + surgeHeal);
            energy = stats.maxEnergy;
          }
        }
      }

      // Check Death / Ad Revive
      if (hp <= 0) {
        if (allowReviveAd && revivesUsed === 0 && rng() < archetype.reviveUsageRate) {
          revivesUsed += 1;
          const reviveCfg = ADS_AND_MONETIZATION_CONFIG.placements.REVIVE;
          if (scenario.predationMode === 'web_pre_p0_double_settlement' && reviveCfg.grantFrenzyStack) {
            infiniteProgressionManager.addFrenzyStack();
          }
          stats = computeScenarioSharkStats(
            scenario,
            level,
            sharkId,
            upgradeLevel,
            true,
            globalDiffMult,
            unlockedCount,
            atlasBonus.totalMasteryCrowns
          );
          frenzyTimer =
            (scenario.id === 'web_pre_p0' || scenario.id === 'ios_pre_p0'
              ? GAME_CONFIG.world.frenzyDuration
              : reviveCfg.frenzyDurationSec) + stats.frenzyDurationBonus;
          frenzyTriggers += 1;
          hp = stats.maxHp;
          energy = stats.maxEnergy;
          invulnTimer = reviveCfg.invulnDurationSec;
        } else {
          break;
        }
      }

      // 5. Ecosystem Spawner Update
      const curViewportBounds: ViewportSpawnBounds = {
        halfW: halfViewW,
        halfH: halfViewH,
        cameraX: sharkX,
        cameraY: sharkY,
        sharkVx,
        renderZoom: effCamZoom,
      };
      if (isIosPool) {
        const cullThreshold = Math.max(1950, halfViewW * 1.55 + 650);
        for (let i = activePreys.length - 1; i >= 0; i--) {
          const p = activePreys[i];
          const dx = infiniteWorldManager.getShortestDeltaX(sharkX, p.x);
          const dy = p.y - sharkY;
          if (Math.hypot(dx, dy) > cullThreshold) {
            activePreys.splice(i, 1);
          }
        }
        if (activePreys.length < scenario.maxActivePreys) {
          iosSpawnTimer -= dt;
          while (iosSpawnTimer <= 0 && activePreys.length < scenario.maxActivePreys) {
            spawnIosPreyOffScreen(
              activePreys,
              iosExtraMap,
              iosUidRef,
              sharkX,
              sharkY,
              stats,
              effCamZoom,
              sharkX,
              rng
            );
            iosSpawnTimer += 0.35 + rng() * 0.53;
          }
        }
      } else {
        spawner.activeSharkBiteTier = stats.normalBiteTier ?? stats.biteTier;
        spawner.update(
          dt,
          activePreys,
          sharkX,
          sharkY,
          rng,
          score,
          stats.realBodyLengthM,
          curViewportBounds
        );
      }

      // 6. Update Prey Positions, Jaw Suction & Collision Resolution
      const mouthX = sharkX + Math.cos(sharkAngle) * 32 * worldScale;
      const mouthY = sharkY + Math.sin(sharkAngle) * 32 * worldScale;
      const frontBodyX = sharkX + Math.cos(sharkAngle) * 10 * worldScale;
      const frontBodyY = sharkY + Math.sin(sharkAngle) * 10 * worldScale;
      const mouthRadius = 28 * worldScale;

      for (let i = activePreys.length - 1; i >= 0; i--) {
        const prey = activePreys[i];
        if (prey.devoured) continue;

        const visualScale = getPreyRelativeVisualScale(
          prey.config,
          stats,
          prey.mutationVariant,
          frenzyTimer > 0
        );
        const effTier = getEffectivePreyTier(prey.config, prey.mutationVariant);
        const canEatNow =
          (frenzyTimer > 0 || stats.biteTier >= effTier) &&
          (!prey.config.isHazard || Boolean(stats.canEatMines));
        const renderedPreyRadius = prey.config.radius * visualScale;
        const eatHitRadius = Math.max(renderedPreyRadius, 18 * worldScale);
        const jawSuctionMult = stats.jawSuctionMultiplier ?? 1.0;
        const suctionRadius = mouthRadius * 2.15 * jawSuctionMult + eatHitRadius;

        const distToMouthPre = Math.hypot(mouthX - prey.x, mouthY - prey.y);
        if (canEatNow && !prey.config.isHazard && distToMouthPre < suctionRadius) {
          const pullRatio = Math.max(0, 1 - distToMouthPre / suctionRadius);
          const suctionSpeed =
            (220 * invZoom + Math.hypot(sharkVx, sharkVy) * 0.65) *
            (0.45 + pullRatio * 0.75);
          const pullAng = Math.atan2(mouthY - prey.y, mouthX - prey.x);
          prey.x += Math.cos(pullAng) * suctionSpeed * dt;
          prey.y += Math.sin(pullAng) * suctionSpeed * dt;
        }

        // Real Prey AI behaviors matching stepSimulation.ts & PreySimulation.swift
        const dirSign = prey.vx >= 0 ? 1 : -1;
        const dxToShark = infiniteWorldManager.getShortestDeltaX(prey.x, sharkX);
        const dyToShark = sharkY - prey.y;
        const distToShark = Math.hypot(dxToShark, dyToShark);
        const aiDistScale = Math.max(1, Math.sqrt(worldScale));

        if (prey.config.behavior === 'SCHOOL_FLEE' && canEatNow && distToShark < 210 * aiDistScale) {
          const fleeA = Math.atan2(-dyToShark, -dxToShark);
          prey.vx = Math.cos(fleeA) * prey.config.baseSpeed * (isIosPool ? 1.42 : 1.2);
          prey.vy = Math.sin(fleeA) * prey.config.baseSpeed * (isIosPool ? 1.42 : 1.2);
        } else if (prey.config.behavior === 'PUFFER_INFLATE' && distToShark < 190 * aiDistScale) {
          const fleeA = Math.atan2(-dyToShark, -dxToShark);
          prey.vx = Math.cos(fleeA) * prey.config.baseSpeed * (isIosPool ? 0.65 : 1.15);
          prey.vy = Math.sin(fleeA) * prey.config.baseSpeed * (isIosPool ? 0.65 : 1.15);
        } else if (
          prey.config.behavior === 'EEL_CHARGER' &&
          sharkY > 520 &&
          prey.y > 520 &&
          !canEatNow &&
          distToShark < 300 * aiDistScale
        ) {
          const atkA = Math.atan2(dyToShark, dxToShark);
          prey.vx = Math.cos(atkA) * prey.config.baseSpeed * (isIosPool ? 1.42 : 1.85);
          prey.vy = Math.sin(atkA) * prey.config.baseSpeed * (isIosPool ? 1.42 : 1.85);
        } else if (
          (prey.config.behavior === 'HEAVY_CRUISER' || prey.config.behavior === 'KRAKEN_BOSS') &&
          sharkY > 520 &&
          prey.y > 520 &&
          distToShark < 420 * aiDistScale
        ) {
          const atkA = Math.atan2(dyToShark, dxToShark);
          const chaseMult = frenzyTimer > 0 ? -0.75 : !canEatNow || prey.config.isBoss ? 1.08 : -0.75;
          prey.vx = Math.cos(atkA) * prey.config.baseSpeed * chaseMult;
          prey.vy = Math.sin(atkA) * prey.config.baseSpeed * chaseMult;
        } else {
          prey.vx = dirSign * prey.config.baseSpeed;
        }
        prey.x = infiniteWorldManager.wrapEntityX(prey.x + prey.vx * dt);
        prey.y = Math.max(
          Math.max(25, prey.config.minDepth),
          Math.min(prey.config.maxDepth, prey.y + prey.vy * dt)
        );

        const canBoostCrushNow =
          isBoosting &&
          !prey.config.isHazard &&
          effTier <= stats.biteTier + 3;
        const canBiteConnect = canEatNow || canBoostCrushNow;
        const distToMouth = Math.hypot(mouthX - prey.x, mouthY - prey.y);
        const distToFrontBody = Math.hypot(frontBodyX - prey.x, frontBodyY - prey.y);
        const effectiveHitDist = canBiteConnect
          ? Math.min(distToMouth, distToFrontBody * 0.95)
          : distToMouth;
        const hitThreshold = isIosPool
          ? prey.config.radius * visualScale + 28 * worldScale
          : canBiteConnect
          ? mouthRadius * 1.18 + eatHitRadius * 1.02
          : mouthRadius * 0.84 + renderedPreyRadius * 0.72;

        if (effectiveHitDist < hitThreshold) {
          const outcome = resolvePreyEncounter(
            stats,
            prey.config,
            frenzyTimer > 0,
            isBoosting,
            prey.mutationVariant ?? 'NONE',
            scenario.difficultyPer60s > 0 ? globalDiffMult : 1.0
          );

          if (outcome.canDevour) {
            const variant = prey.mutationVariant ?? 'NONE';
            // Multi-hit armor crush check (Boss / Abyss Behemoth = 2 hits, normal = 1 hit)
            if (outcome.isArmorCrush) {
              if (iosExtraMap.has(prey) && scenario.armorCrushHitsNeeded > 1) {
                const extra = iosExtraMap.get(prey)!;
                extra.armorHp -= 1;
                if (extra.armorHp > 0) {
                  invulnTimer = Math.max(invulnTimer, 0.45);
                  prey.x += ((prey.x - sharkX) / Math.max(1, effectiveHitDist)) * 65 * Math.max(1, worldScale * 0.5);
                  continue;
                }
              } else {
                const neededHits = getRequiredArmorHits(prey.config, variant);
                const curArmorHp = (prey as { armorHp?: number }).armorHp ?? neededHits;
                if (curArmorHp > 1) {
                  (prey as { armorHp?: number }).armorHp = curArmorHp - 1;
                  invulnTimer = Math.max(invulnTimer, 0.28);
                  prey.x += ((prey.x - sharkX) / Math.max(1, effectiveHitDist)) * 65 * Math.max(1, worldScale * 0.5);
                  continue;
                }
              }
            }

            // Devour confirmed!
            preyEaten += 1;
            if (outcome.isArmorCrush) armorCrushes += 1;
            if (variant === 'GOLDEN_MUTANT') goldMutantsEaten += 1;
            if (variant === 'ABYSS_BEHEMOTH') behemothsEaten += 1;

            comboCount += 1;
            comboTimer = isIosPool
              ? 4.2
              : ECONOMY_PREDATION_CONFIG.huntingHeatTiers.comboWindowSec;
            const boostRefill =
              ECONOMY_PREDATION_CONFIG.huntingHeatTiers.baseKillEnergyBonus +
              Math.round(prey.config.tier * ECONOMY_PREDATION_CONFIG.huntingHeatTiers.killEnergyPerTier) +
              (stats.killEnergyBonus ?? 0);
            energy = Math.min(stats.maxEnergy, energy + boostRefill);

            const effectiveGeneMult =
              stats.geneYieldMultiplier ?? stats.rewardMultiplier ?? atlasBonus.rewardMultiplier;
            const effectiveCoinMult =
              stats.coinYieldMultiplier ?? stats.rewardMultiplier ?? atlasBonus.rewardMultiplier;

            let xpGained = outcome.xpGain;
            let scoreGained = outcome.scoreGain;

            if (scenario.platformBase === 'ios') {
              const isArmorFinal = Boolean(outcome.isArmorCrush && scenario.armorCrushBypassesMultAndBounty);
              const mult = variant === 'GOLDEN_MUTANT' ? 3 : 1;
              const iosHeat = computeIosHuntingHeatBuff(comboCount);
              scoreGained = isArmorFinal
                ? prey.config.scoreValue * 2
                : Math.round(prey.config.scoreValue * mult * iosHeat.scoreMultiplier);
              xpGained = isArmorFinal
                ? Math.round(prey.config.xpValue * scenario.armorCrushXpScale)
                : variant === 'GOLDEN_MUTANT'
                ? Math.round(prey.config.xpValue * scenario.goldenXpScale)
                : Math.round(
                    prey.config.xpValue *
                      (frenzyTimer > 0 ? scenario.frenzyXpScale : scenario.normalXpScale)
                  );
            } else {
              const heatBuff = computeHuntingHeatBuff(comboCount);
              const maxComboBonus = stats.maxComboBonus ?? 1.0;
              const comboMult =
                1 +
                Math.min(
                  maxComboBonus,
                  (comboCount - 1) * ECONOMY_PREDATION_CONFIG.huntingHeatTiers.comboScorePerStack
                );
              const bountyPreyScoreBonus =
                prey.config.id === targetBountyConfig.id
                  ? stats.specialPreyScoreMultiplier ?? 1.0
                  : 1.0;
              const frenzyStackMult =
                scenario.predationMode === 'web_pre_p0_double_settlement' && frenzyTimer > 0
                  ? infiniteProgressionManager.getFrenzyScoreMultiplier()
                  : 1.0;
              const rewardScale =
                (prey.scaleMultiplier ?? 1.0) *
                heatBuff.scoreMultiplier *
                bountyPreyScoreBonus *
                frenzyStackMult *
                comboMult;
              scoreGained = infiniteProgressionManager.getScaledPreyValue(
                Math.round(outcome.scoreGain * rewardScale)
              );
              if (scenario.platformBase === 'unified' && scenario.predationMode !== 'web_post_p0_single_pickup') {
                xpGained = outcome.isArmorCrush
                  ? Math.round(prey.config.xpValue * scenario.armorCrushXpScale)
                  : variant === 'GOLDEN_MUTANT'
                  ? Math.round(prey.config.xpValue * scenario.goldenXpScale)
                  : Math.round(
                      prey.config.xpValue *
                        (frenzyTimer > 0 ? scenario.frenzyXpScale : scenario.normalXpScale)
                    );
              }
            }

            // Reward packaging by Scenario PredationMode
            if (scenario.predationMode === 'web_post_p0_single_pickup') {
              const plan = buildPredationRewardPlan(
                prey,
                outcome,
                {
                  effectiveCoinMult,
                  effectiveGeneMult,
                  finalScoreGain: scoreGained,
                },
                settledPreyUids,
                genePityState
              );
              if (!plan.settled) continue;
              hp = Math.min(stats.maxHp, hp + plan.hpDelta);
              score += plan.scoreGain;
              for (let d = 0; d < plan.pickups.length; d++) {
                const drop = plan.pickups[d];
                const ang = (d * Math.PI * 2) / Math.max(1, plan.pickups.length);
                const spd = 82 + rng() * 56;
                spawnPickupLocal(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  drop.kind,
                  drop.value
                );
              }
            } else if (scenario.predationMode === 'web_pre_p0_double_settlement') {
              prey.devoured = true;
              const directCoins = Math.max(
                1,
                Math.round(
                  outcome.coinGain *
                    (variant === 'GOLDEN_MUTANT' ? 3.0 : 1.0) *
                    effectiveCoinMult
                )
              );
              const directGenes = Math.max(
                1,
                Math.round(
                  outcome.geneGain *
                    (variant === 'ABYSS_BEHEMOTH' ? 2.5 : 1.0) *
                    effectiveGeneMult
                )
              );
              coinsFromDirectPredation += directCoins;
              genesFromDirectPredation += directGenes;
              coinsGenerated += directCoins;
              genesGenerated += directGenes;
              hp = Math.min(stats.maxHp, hp + outcome.hpDelta);
              score += scoreGained;

              const preLegacy = computeWebPreP0LegacyPredationExpectation(prey.config);
              const isHighGeneSource =
                prey.config.id === targetBountyConfig.id ||
                variant === 'ABYSS_BEHEMOTH' ||
                prey.config.tier >= 18;
              for (let d = 0; d < preLegacy.dropCount; d++) {
                const isDna = isHighGeneSource ? d % 2 === 1 : d % 4 === 3;
                const ang = (d * Math.PI * 2) / preLegacy.dropCount;
                const spd = 82 + rng() * 56;
                const scaledUnit = Math.max(1, Math.round(prey.config.tier * 0.45));
                const pkVal = isDna
                  ? Math.max(1, Math.round(scaledUnit * 1.2 * effectiveGeneMult))
                  : Math.max(3, Math.round(scaledUnit * 2.5 * effectiveCoinMult));
                spawnPickupLocal(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  isDna ? 'DNA_CRYSTAL' : 'COIN',
                  pkVal
                );
              }
            } else if (scenario.predationMode === 'ios_pickup_38pct_gene') {
              prey.devoured = true;
              hp = Math.min(stats.maxHp, hp + Math.round(prey.config.hpRestore * stats.devourHealMultiplier));
              score += scoreGained;

              let cGain = 0;
              let gGain = 0;
              if (outcome.isArmorCrush) {
                cGain = Math.max(1, prey.config.coinValue * 2);
                gGain = Math.max(1, prey.config.geneValue * 2);
              } else {
                const mult = variant === 'GOLDEN_MUTANT' ? 3 : 1;
                cGain = Math.max(1, Math.round(prey.config.coinValue * mult * effectiveCoinMult));
                if (
                  prey.config.geneValue > 0 &&
                  (variant === 'GOLDEN_MUTANT' || rng() < 0.38)
                ) {
                  gGain = Math.max(1, Math.round(prey.config.geneValue * effectiveGeneMult));
                }
              }

              const coinCount = Math.min(4, Math.max(1, Math.floor((cGain + 3) / 4)));
              const baseVal = Math.max(1, Math.floor(cGain / coinCount));
              for (let d = 0; d < coinCount; d++) {
                const v = d === coinCount - 1 ? Math.max(1, cGain - baseVal * (coinCount - 1)) : baseVal;
                const ang = rng() * Math.PI * 2;
                const spd = 75 + rng() * 90;
                spawnPickupLocal(
                  prey.x + Math.cos(ang) * 10,
                  prey.y + Math.sin(ang) * 10,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd - 35,
                  'COIN',
                  v
                );
              }
              if (gGain > 0) {
                const ang = rng() * Math.PI * 2;
                spawnPickupLocal(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * 120,
                  Math.sin(ang) * 120 - 45,
                  'DNA_CRYSTAL',
                  gGain
                );
              }
            } else {
              // unified_pickup_pity_gene
              prey.devoured = true;
              hp = Math.min(stats.maxHp, hp + outcome.hpDelta);
              score += scoreGained;

              const fMult = frenzyTimer > 0 ? scenario.frenzyRewardMult : 1.0;
              const crushMult = outcome.isArmorCrush && frenzyTimer <= 0 ? 1.35 : 1.0;
              const goldMult = variant === 'GOLDEN_MUTANT' ? 3.0 : 1.0;
              const behMult = variant === 'ABYSS_BEHEMOTH' ? 2.5 : 1.0;
              const cGain = Math.max(
                1,
                Math.round(prey.config.coinValue * fMult * crushMult * goldMult * effectiveCoinMult)
              );

              let gGain = 0;
              if (prey.config.geneValue > 0) {
                const baseP = scenario.unifiedGeneBaseChance ?? 0.35;
                const pityCap = scenario.unifiedGenePityAfterMisses ?? 2;
                const guaranteed =
                  variant === 'GOLDEN_MUTANT' ||
                  variant === 'ABYSS_BEHEMOTH' ||
                  outcome.isArmorCrush ||
                  unifiedGeneMissStreak >= pityCap;
                if (guaranteed || rng() < baseP) {
                  unifiedGeneMissStreak = 0;
                  gGain = Math.max(
                    1,
                    Math.round(prey.config.geneValue * crushMult * behMult * effectiveGeneMult)
                  );
                } else {
                  unifiedGeneMissStreak += 1;
                }
              }

              const coinCount = Math.min(4, Math.max(1, Math.floor((cGain + 3) / 4)));
              const baseVal = Math.max(1, Math.floor(cGain / coinCount));
              for (let d = 0; d < coinCount; d++) {
                const v = d === coinCount - 1 ? Math.max(1, cGain - baseVal * (coinCount - 1)) : baseVal;
                const ang = (d * Math.PI * 2) / coinCount;
                const spd = 80 + rng() * 60;
                spawnPickupLocal(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  'COIN',
                  v
                );
              }
              if (gGain > 0) {
                const ang = rng() * Math.PI * 2;
                spawnPickupLocal(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * 100,
                  Math.sin(ang) * 100,
                  'DNA_CRYSTAL',
                  gGain
                );
              }
            }

            // Golden frenzy charging
            const skipForIosCrush =
              outcome.isArmorCrush && scenario.armorCrushBypassesMultAndBounty;
            if (variant === 'GOLDEN_MUTANT' && !skipForIosCrush) {
              const allowDuringFrenzy = scenario.frenzyCooldownSec === 0 && frenzyTimer > 0 ? false : frenzyTimer <= 0;
              if (allowDuringFrenzy && frenzyCooldown <= 0) {
                goldenCharge += 1;
                if (goldenCharge >= goldenNeeds) {
                  goldenCharge = 0;
                  frenzyCooldown = scenario.frenzyCooldownSec;
                  if (scenario.platformBase === 'web') {
                    infiniteProgressionManager.addFrenzyStack();
                  }
                  stats = computeScenarioSharkStats(
                    scenario,
                    level,
                    sharkId,
                    upgradeLevel,
                    true,
                    globalDiffMult,
                    unlockedCount,
                    atlasBonus.totalMasteryCrowns
                  );
                  frenzyTimer = scenario.frenzyBaseDurationSec + stats.frenzyDurationBonus;
                  frenzyTriggers += 1;
                }
              }
            }

            // Bounty progress & completion
            if (prey.config.id === targetBountyConfig.id && !skipForIosCrush) {
              bountyProgress += 1;
              if (bountyProgress >= bountyRequired) {
                bountiesCompleted += 1;
                let bCoins = 0;
                let bGenes = 0;
                if (scenario.bountyMode === 'web_dynamic_2kill') {
                  score += infiniteProgressionManager.getScaledPreyValue(
                    Math.round(350 * Math.max(1, prey.config.tier * 0.35))
                  );
                  bCoins = Math.round((48 + prey.config.tier * 2.5) * effectiveCoinMult);
                  bGenes = Math.round((18 + prey.config.tier * 0.85) * effectiveGeneMult);
                } else if (scenario.bountyMode === 'ios_fixed_3kill') {
                  bCoins = 45;
                  bGenes = 3;
                } else if (scenario.bountyMode === 'unified_scaled_2kill') {
                  const bountyCfg = ECONOMY_PREDATION_CONFIG.bounty;
                  score += infiniteProgressionManager.getScaledPreyValue(
                    Math.round(bountyCfg.scoreBase * Math.max(1, prey.config.tier * bountyCfg.scoreTierMult))
                  );
                  bCoins = Math.round(
                    (bountyCfg.baseCoins + prey.config.tier * bountyCfg.coinsPerTier) *
                      (bountyCfg.applySharkYieldMultipliers ? effectiveCoinMult : 1.0)
                  );
                  bGenes = Math.round(
                    (bountyCfg.baseGenes + prey.config.tier * bountyCfg.genesPerTier) *
                      (bountyCfg.applySharkYieldMultipliers ? effectiveGeneMult : 1.0)
                  );
                } else {
                  // unified_scaled_3kill
                  score += Math.round(300 * Math.max(1, prey.config.tier * 0.3));
                  bCoins = Math.round((30 + prey.config.tier * 1.8) * effectiveCoinMult);
                  bGenes = Math.round((5 + prey.config.tier * 0.35) * effectiveGeneMult);
                }
                coinsFromBounty += bCoins;
                genesFromBounty += bGenes;
                coinsGenerated += bCoins;
                genesGenerated += bGenes;

                targetBountyConfig = rollTargetBountySpecies(
                  stats.normalBiteTier ?? stats.biteTier,
                  sharkY,
                  prey.config.id,
                  minPreyLenCm
                );
                bountyProgress = 0;
                spawner.activeTargetPreyId = targetBountyConfig.id;
              }
            }

            // XP & In-Run Level Up
            xpEarned += xpGained;
            const prog = addEvolutionProgress(level, xp, xpGained);
            level = prog.level;
            xp = prog.xp;
            if (prog.leveledUpCount > 0) {
              stats = computeScenarioSharkStats(
                scenario,
                level,
                sharkId,
                upgradeLevel,
                frenzyTimer > 0,
                globalDiffMult,
                unlockedCount,
                atlasBonus.totalMasteryCrowns
              );
              const healFrac =
                scenario.predationMode === 'web_post_p0_single_pickup'
                  ? WORLD_CONFIG.inRunLevelProgression.levelUpHealMaxHpPct
                  : 0.35;
              hp = Math.min(stats.maxHp, hp + Math.round(stats.maxHp * healFrac));
              if (scenario.platformBase === 'ios' || scenario.predationMode === 'web_post_p0_single_pickup') {
                energy = Math.min(
                  stats.maxEnergy,
                  energy + stats.maxEnergy * WORLD_CONFIG.inRunLevelProgression.levelUpEnergyRestorePct
                );
              }
            }

            // Respawn prey
            if (isIosPool) {
              activePreys.splice(i, 1);
            } else {
              spawner.recycleAndRespawn(
                activePreys,
                i,
                sharkX,
                sharkY,
                rng,
                score,
                stats.realBodyLengthM,
                curViewportBounds
              );
            }
          } else {
            // Damage collision
            if (invulnTimer <= 0) {
              damageHitsTaken += 1;
              let dmg = 0;
              if (isIosPool) {
                const isArmorBand =
                  !prey.config.isHazard &&
                  effTier - stats.biteTier >= 1 &&
                  effTier - stats.biteTier <= 3;
                dmg =
                  prey.config.damageOnFail *
                  (isArmorBand ? 0.85 : 1.0) *
                  (stats.damageTakenMultiplier ?? 1.0);
                invulnTimer = isArmorBand ? 0.65 : 0.85;
              } else {
                dmg = Math.abs(outcome.hpDelta);
                invulnTimer = 0.55;
              }
              hp = Math.max(0, hp - dmg);
              sharkX += (sharkX >= prey.x ? 1 : -1) * 18 * invZoom;
              if (prey.config.isHazard) {
                if (isIosPool) activePreys.splice(i, 1);
                else {
                  spawner.recycleAndRespawn(
                    activePreys,
                    i,
                    sharkX,
                    sharkY,
                    rng,
                    score,
                    stats.realBodyLengthM,
                    curViewportBounds
                  );
                }
              }
            }
          }
        }
      }

      // 7. Pickups Update (2x Sub-stepped Magnet Pull + Continuous Swept Segment Collection + Expiry)
      const webHeatMagnet =
        scenario.heatMode === 'web_score_magnet_regen'
          ? computeHuntingHeatBuff(comboCount).magnetRadiusBonus
          : 0;
      const frenzyMagMult =
        !isIosPool && frenzyTimer > 0
          ? ECONOMY_PREDATION_CONFIG.pickups.frenzyMagnetMultiplier
          : 1.0;
      const magnetRadius = isIosPool
        ? ((frenzyTimer > 0 ? 390 : 120) + stats.magnetRadius) * invZoom
        : (stats.magnetRadius + webHeatMagnet + scenario.frenzyPickupMagnetBonusFlat * (frenzyTimer > 0 ? 1 : 0)) *
          invZoom *
          frenzyMagMult;
      const collectRadius = scenario.collectRadiusWorldFactor * worldScale;

      const subSteps = 2;
      const subDt = dt / subSteps;
      const sharkSubDx = infiniteWorldManager.getShortestDeltaX(prevSharkX, sharkX) / subSteps;
      const sharkSubDy = (sharkY - prevSharkY) / subSteps;

      for (let sub = 0; sub < subSteps; sub++) {
        const subSharkX = infiniteWorldManager.wrapEntityX(prevSharkX + sharkSubDx * (sub + 0.5));
        const subSharkY = prevSharkY + sharkSubDy * (sub + 0.5);

        for (let k = pickups.length - 1; k >= 0; k--) {
          const pk = pickups[k];
          if (!pk.active) continue;
          if (scenario.pickupLifetimeSec !== null) {
            pk.life -= subDt;
          }
          const dx = infiniteWorldManager.getShortestDeltaX(pk.x, subSharkX);
          const dy = subSharkY - pk.y;
          const dist = Math.hypot(dx, dy);

          if (isIosPool) {
            if (dist < magnetRadius && dist > 1) {
              const pullSpeed = (frenzyTimer > 0 ? 620 : 410) * invZoom;
              pk.vx += (dx / dist) * pullSpeed * subDt * 5.2;
              pk.vy += (dy / dist) * pullSpeed * subDt * 5.2;
              // Velocity cap + mild damping prevents orbital slingshotting
              const curV = Math.hypot(pk.vx, pk.vy);
              const maxPull = pullSpeed * 1.35;
              if (curV > maxPull) {
                pk.vx = (pk.vx / curV) * maxPull;
                pk.vy = (pk.vy / curV) * maxPull;
              }
            } else {
              pk.vx *= 0.94;
              pk.vy = pk.vy * 0.94 - 8 * subDt;
            }
          } else {
            pk.vx *= 0.92;
            pk.vy *= 0.92;
            if (dist < magnetRadius && dist > 1) {
              const pullSpeed = 380 * invZoom + (magnetRadius - dist) * 2.2;
              pk.vx = (dx / dist) * pullSpeed;
              pk.vy = (dy / dist) * pullSpeed;
            }
          }

          const oldPkX = pk.x;
          const oldPkY = pk.y;
          pk.x = infiniteWorldManager.wrapEntityX(pk.x + pk.vx * subDt);
          pk.y += pk.vy * subDt;

          // Closest point along relative sweep segment prevents high-speed tunneling
          const stepDx = infiniteWorldManager.getShortestDeltaX(oldPkX, pk.x) - sharkSubDx;
          const stepDy = pk.y - oldPkY - sharkSubDy;
          const relX0 = infiniteWorldManager.getShortestDeltaX(subSharkX, oldPkX);
          const relY0 = oldPkY - subSharkY;
          const segLenSq = stepDx * stepDx + stepDy * stepDy;
          const tClosest =
            segLenSq > 1e-6
              ? Math.max(0, Math.min(1, -(relX0 * stepDx + relY0 * stepDy) / segLenSq))
              : 0;
          const minSweepDist = Math.hypot(relX0 + stepDx * tClosest, relY0 + stepDy * tClosest);

          if (minSweepDist < collectRadius) {
            const mockTarget = {
              coins: 0,
              genes: 0,
              score: 0,
              runCoinsEarned: 0,
              runGenesEarned: 0,
            };
            const col = collectPickupEntity(pk, mockTarget);
            if (col.collected) {
              coinsFromPickups += col.coinsAdded;
              genesFromPickups += col.genesAdded;
              score += col.scoreAdded;
            }
            pickups.splice(k, 1);
            continue;
          }
          if (scenario.pickupLifetimeSec !== null && pk.life <= 0) {
            pk.active = false;
            pickups.splice(k, 1);
          }
        }
      }

      // 8. Live 120ms Crown Check (Web mode settles crowns immediately during run)
      if (scenario.crownsTiming === 'live_120ms') {
        hudCrownTimer += dt;
        if (hudCrownTimer >= 0.12) {
          hudCrownTimer = 0;
          const allowCrowns = !(isTrialRun && scenario.isolateTrialProgress);
          if (allowCrowns && liveCrownTier < 3) {
            const res = settleSharkScoreMastery(
              sharkId,
              score,
              !allowCrowns,
              workingSave
            );
            if (res.coinsAwarded > 0 || res.genesAwarded > 0) {
              liveCrownTier = res.newCrownTier;
              crownCoinsAwarded += Math.round(res.coinsAwarded * scenario.crownCoinScale);
              crownGenesAwarded += Math.round(res.genesAwarded * scenario.crownGeneScale);
              workingSave = res.updatedSave;
            }
          }
        }
      }
    } // end while
    if (hp > 0 && survivalSec >= effectiveMaxRunSec - dt * 0.5) {
      endedBySessionHorizon = true;
    }

    // End-of-Run Crown Settlement
    const eligibleForCrowns = !(isTrialRun && scenario.isolateTrialProgress);
    if (eligibleForCrowns) {
      if (scenario.crownsUseIosTable) {
        const idx = form.index;
        const row = form.row;
        const baseC = Math.round(45 + idx * 24 + row * 65);
        const baseG = Math.round(4 + Math.floor(idx * 0.85) + row * 3);
        const tConfigs = [
          { tier: 1, threshold: iosMasteryCfg.bronzeScore, c: baseC, g: baseG },
          { tier: 2, threshold: iosMasteryCfg.silverScore, c: Math.round(baseC * 2.2), g: Math.round(baseG * 2.0) },
          { tier: 3, threshold: iosMasteryCfg.goldScore, c: Math.round(baseC * 4.5), g: Math.round(baseG * 4.0) },
        ];
        for (const tc of tConfigs) {
          if (score >= tc.threshold && tc.tier > liveCrownTier) {
            liveCrownTier = tc.tier;
            crownCoinsAwarded += Math.round(tc.c * scenario.crownCoinScale);
            crownGenesAwarded += Math.round(tc.g * scenario.crownGeneScale);
          }
        }
      } else {
        const res = settleSharkScoreMastery(sharkId, score, false, workingSave);
        if (res.coinsAwarded > 0 || res.genesAwarded > 0) {
          liveCrownTier = res.newCrownTier;
          crownCoinsAwarded += Math.round(res.coinsAwarded * scenario.crownCoinScale);
          crownGenesAwarded += Math.round(res.genesAwarded * scenario.crownGeneScale);
        }
      }
    }

    const coinsCollected = coinsFromDirectPredation + coinsFromPickups;
    const genesCollected = genesFromDirectPredation + genesFromPickups;
    const totalPickupsGenerated =
      coinsGenerated - coinsFromBounty - coinsFromDirectPredation +
      (genesGenerated - genesFromBounty - genesFromDirectPredation);
    const totalPickupsCollected = coinsFromPickups + genesFromPickups;
    const coinPickupsGen = coinsGenerated - coinsFromBounty - coinsFromDirectPredation;
    const genePickupsGen = genesGenerated - genesFromBounty - genesFromDirectPredation;

    const runCoinsEarned = coinsCollected + coinsFromBounty;
    const runGenesEarned = genesCollected + genesFromBounty;

    return {
      seed,
      scenarioId: scenario.id,
      archetypeId: archetype.id,
      sharkId,
      sharkIndex: form.index,
      generation: form.generation,
      upgradeLevel,
      survivalSec: Number(survivalSec.toFixed(2)),
      preyEaten,
      goldMutantsEaten,
      behemothsEaten,
      armorCrushes,
      bountiesCompleted,
      damageHitsTaken,
      revivesUsed,
      goldOverdrivesUsed,
      geneSurgesUsed,
      coinsGenerated,
      genesGenerated,
      coinsCollected,
      genesCollected,
      coinsFromBounty,
      genesFromBounty,
      coinsFromDirectPredation,
      genesFromDirectPredation,
      coinsFromPickups,
      genesFromPickups,
      coinsFromOverdriveSpend,
      genesFromSurgeSpend,
      runCoinsEarned,
      runGenesEarned,
      xpEarned,
      score: Math.round(score),
      finalInRunLevel: level,
      maxDepthMeters,
      frenzySeconds: Number(frenzySeconds.toFixed(2)),
      frenzyTriggers,
      frenzyCoveragePct:
        survivalSec > 0
          ? Number(((frenzySeconds / survivalSec) * 100).toFixed(2))
          : 0,
      pickupCollectionRatePct:
        totalPickupsGenerated > 0
          ? Number(((totalPickupsCollected / totalPickupsGenerated) * 100).toFixed(2))
          : 100,
      coinPickupRatePct:
        coinPickupsGen > 0
          ? Number(((coinsFromPickups / coinPickupsGen) * 100).toFixed(2))
          : 100,
      genePickupRatePct:
        genePickupsGen > 0
          ? Number(((genesFromPickups / genePickupsGen) * 100).toFixed(2))
          : 100,
      crownsUnlockedThisRun: liveCrownTier - startCrownTier,
      crownCoinsAwarded,
      crownGenesAwarded,
      maxDifficultyMultiplier: maxDiffObserved,
      endedBySessionHorizon,
    };
  });
}
