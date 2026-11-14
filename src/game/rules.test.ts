import test from 'node:test';
import assert from 'node:assert/strict';
import { I18N, translate } from './i18n';
import { GAME_CONFIG } from './config';
import {
  computeSharkStats,
  computeEvolvedSharkStats,
  computeHuntingHeatBuff,
  resolvePreyEncounter,
  addEvolutionProgress,
  pickEvolutionChoices,
  getMaxMechaLoadout,
  getDepthZone,
  getParallaxLayerGrowthScales,
  computeParallaxBiomeTransitionState,
  quinticSmoothstep,
} from './rules';
import {
  createDefaultMetaSave,
  evaluateSharkUnlock,
  getGlobalAtlasBonuses,
  getNextEvolutionTarget,
  getSharkFormById,
  getSharkMasteryConfig,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  settleSharkScoreMastery,
  SHARK_EVOLUTION_FORMS,
} from './sharkEvolutionConfig';
import {
  SHARK_CELL_BOUNDS,
  SHARK_GRID_MAP,
  spriteSheetManager,
  UI_BANNER_BOUNDS,
  UI_SETTING_BOUNDS,
} from './spriteSheetManager';
import {
  computeSpineSliceDeformation,
  getPreySwimGait,
} from './canvasRenderer';
import { sampleBathymetricWaterColor } from './parallaxBackground';
import { ProceduralOceanWorldSystem } from './worldGenerationSystem';

test('I18N dictionary has complete and matching keys in both zh and en', () => {
  const zhKeys = Object.keys(I18N.zh).sort();
  const enKeys = Object.keys(I18N.en).sort();
  assert.deepEqual(zhKeys, enKeys, 'zh and en dictionaries must have identical key sets');

  for (const key of zhKeys) {
    assert.ok(I18N.zh[key].length > 0, `zh key ${key} must not be empty`);
    assert.ok(I18N.en[key].length > 0, `en key ${key} must not be empty`);
  }
  assert.equal(
    translate('ad_sim_countdown', 'zh', { sec: 3 }),
    '剩余倒计时：3 秒'
  );
  assert.equal(
    translate('ad_sim_countdown', 'en', { sec: 3 }),
    'Reward ready in 3s'
  );
});

test('GAME_CONFIG has 15 organs across 3 factions and 5 slots, plus 33 target prey species across 8 tiers', () => {
  assert.equal(GAME_CONFIG.organs.length, 15);
  assert.equal(GAME_CONFIG.preyTiers.length, 33);

  const factions = new Set(GAME_CONFIG.organs.map((o) => o.faction));
  const slots = new Set(GAME_CONFIG.organs.map((o) => o.slot));
  assert.deepEqual([...factions].sort(), ['ABYSS', 'MAGMA', 'MECHA']);
  assert.deepEqual([...slots].sort(), ['ARMOR', 'AURA', 'DORSAL', 'JAWS', 'TAIL']);

  // Every organ nameKey and descKey exists in I18N
  for (const organ of GAME_CONFIG.organs) {
    assert.ok(I18N.zh[organ.nameKey], `Missing zh name for ${organ.id}`);
    assert.ok(I18N.en[organ.nameKey], `Missing en name for ${organ.id}`);
    assert.ok(I18N.zh[organ.descKey], `Missing zh desc for ${organ.id}`);
    assert.ok(I18N.en[organ.descKey], `Missing en desc for ${organ.id}`);
  }

  // Every prey species nameKey exists in I18N
  for (const prey of GAME_CONFIG.preyTiers) {
    assert.ok(I18N.zh[prey.nameKey], `Missing zh name for prey ${prey.id}`);
    assert.ok(I18N.en[prey.nameKey], `Missing en name for prey ${prey.id}`);
  }
});

test('computeSharkStats scales speed, bite tier, zoom, and drain reduction with organs', () => {
  const baseStats = computeSharkStats(1, {}, false);
  assert.equal(baseStats.scale, 1.0);
  assert.equal(baseStats.cameraZoom, 1.0);
  assert.equal(baseStats.biteTier, 2);

  const mechaLoadout = getMaxMechaLoadout();
  assert.equal(Object.keys(mechaLoadout).length, 5);

  const armedStats = computeSharkStats(3, mechaLoadout, false);
  assert.ok(armedStats.moveSpeed > baseStats.moveSpeed);
  assert.ok(armedStats.biteTier > baseStats.biteTier);
  assert.ok(armedStats.hpDrainPerSec < baseStats.hpDrainPerSec);
  assert.ok(armedStats.cameraZoom < baseStats.cameraZoom);

  // Gold Frenzy sets biteTier to 8 and eliminates HP/boost drain
  const frenzyStats = computeSharkStats(1, {}, true);
  assert.equal(frenzyStats.biteTier, 8);
  assert.equal(frenzyStats.hpDrainPerSec, 0);
  assert.equal(frenzyStats.boostDrainPerSec, 0);
});

test('resolvePreyEncounter distinguishes devourable prey from oversized hazards', () => {
  const baseStats = computeSharkStats(1, {}, false);
  const tier1Prey = GAME_CONFIG.preyTiers[0]; // Tier 1 Jellyfish
  const tier6Mine = GAME_CONFIG.preyTiers[5]; // Tier 6 Mine
  const tier8Boss = GAME_CONFIG.preyTiers[7]; // Tier 8 Kraken Boss

  const eatSmall = resolvePreyEncounter(baseStats, tier1Prey, false, false);
  assert.equal(eatSmall.canDevour, true);
  assert.ok(eatSmall.hpDelta > 0);
  assert.ok(eatSmall.scoreGain > 0);

  const hitMine = resolvePreyEncounter(baseStats, tier6Mine, false, false);
  assert.equal(hitMine.canDevour, false);
  assert.ok(hitMine.hpDelta < 0);
  assert.ok(hitMine.knockbackForce > 0);

  const frenzyEatBoss = resolvePreyEncounter(baseStats, tier8Boss, true, true);
  assert.equal(frenzyEatBoss.canDevour, true);
  assert.equal(frenzyEatBoss.floatTextKey, 'float_boss_kill');
});

test('addEvolutionProgress handles single and multi-level XP gains and pickEvolutionChoices returns 3 unique organs', () => {
  const p1 = addEvolutionProgress(1, 0, 30);
  assert.equal(p1.level, 1);
  assert.equal(p1.leveledUpCount, 0);

  const p2 = addEvolutionProgress(1, 50, 100);
  assert.equal(p2.level, 2);
  assert.equal(p2.leveledUpCount, 1);

  const choices = pickEvolutionChoices({}, () => 0.42);
  assert.equal(choices.length, 3);
  const uniqueIds = new Set(choices.map((c) => c.id));
  assert.equal(uniqueIds.size, 3);

  assert.equal(getDepthZone(100).id, 'shallow');
  assert.equal(getDepthZone(800).id, 'twilight');
  assert.equal(getDepthZone(1500).id, 'abyss');
});

import {
  SPRITE_GRID_MAP,
  FISH2_GRID_MAP,
  FISH2_CELL_BOUNDS,
} from './spriteSheetManager';
import { InfiniteWorldManager } from './infiniteWorldManager';

test('SPRITE_GRID_MAP covers all 16 primary cells and FISH2_GRID_MAP covers all 30 target fish cells uniquely', () => {
  const entries = Object.entries(SPRITE_GRID_MAP);
  assert.equal(entries.length, 16);
  const coords = new Set(entries.map(([, [r, c]]) => `${r},${c}`));
  assert.equal(coords.size, 16);

  const fish2Entries = Object.entries(FISH2_GRID_MAP);
  assert.equal(fish2Entries.length, 30);
  const fish2Coords = new Set(fish2Entries.map(([, [r, c]]) => `${r},${c}`));
  assert.equal(fish2Coords.size, 30);

  for (const [key, [x0, y0, x1, y1]] of Object.entries(FISH2_CELL_BOUNDS)) {
    assert.ok(x1 > x0 && y1 > y0, `Invalid bounds for ${key}`);
  }
});

test('InfiniteWorldManager provides seamless continuous horizontal swimming without boundary refresh and unbounded downward depth', () => {
  // Default continuous mode: crossing ±1500 does NOT teleport/reset coordinates
  const continuousMgr = new InfiniteWorldManager(3000, 0, false);

  const sharkRight = { x: 1520, y: 400 };
  const camRight = { x: 1510, y: 400 };
  const resRight = continuousMgr.update(0, sharkRight, camRight);
  assert.equal(resRight.wrappedHorizontally, false);
  assert.equal(sharkRight.x, 1520);
  assert.equal(camRight.x, 1520);

  const sharkLeft = { x: -4530, y: 600 };
  const camLeft = { x: -4520, y: 600 };
  const resLeft = continuousMgr.update(0, sharkLeft, camLeft);
  assert.equal(resLeft.wrappedHorizontally, false);
  assert.equal(sharkLeft.x, -4530);

  // Optional hard-wrap mode shifts active entities together when enabled
  const wrapMgr = new InfiniteWorldManager(3000, 0, true);
  const wrappedShark = { x: 1520, y: 400 };
  const wrappedCam = { x: 1510, y: 400 };
  const nearbyFish = [{ x: 1480, y: 400 }];
  const resWrap = wrapMgr.update(0, wrappedShark, wrappedCam, nearbyFish);
  assert.equal(resWrap.wrappedHorizontally, true);
  assert.equal(wrappedShark.x, -1450);
  assert.equal(nearbyFish[0].x, -1490);

  // Infinite downward depth: y = 6500 is NOT clamped to 1800
  const sharkDeep = { x: 200, y: 6500 };
  const camDeep = { x: 200, y: 6400 };
  const resDeep = continuousMgr.update(1, sharkDeep, camDeep);
  assert.equal(sharkDeep.y, 6500);
  assert.equal(resDeep.targetCameraY, 6500);
  assert.equal(getDepthZone(6500).id, 'abyss');

  // Sea surface clamp: y < 0 is clamped to seaSurfaceY = 0
  const sharkSurface = { x: 0, y: -45, vy: -100 };
  const camSurface = { x: 0, y: 10 };
  const resSurface = continuousMgr.update(0, sharkSurface, camSurface);
  assert.equal(resSurface.clampedAtSurface, true);
  assert.equal(sharkSurface.y, 0);
});

import { EcosystemSpawner } from './ecosystemSpawner';
import { PreyEntity } from './canvasRenderer';

test('EcosystemSpawner maintains default maxActivePreys=20, recycles distant prey beyond 1.5x spawnRadius, and applies Infinite Scaling', () => {
  const spawner = new EcosystemSpawner();
  assert.equal(spawner.maxActivePreys, 20);
  assert.equal(spawner.spawnRadius, 1650);
  const activePreys: PreyEntity[] = [];

  // Advance 25 seconds -> scaleMultiplier = 1.0 + 25 * 0.01 = 1.25
  spawner.update(25, activePreys, 0, 500, () => 0.5);
  assert.equal(activePreys.length, 20);
  assert.equal(spawner.getScaleMultiplier(), 1.25);
  assert.equal(activePreys[0].scaleMultiplier, 1.25);

  // Move one prey far outside spawnRadius * 1.5 (e.g. y = 4000, distance = 3500 > 2475)
  activePreys[0].y = 4000;
  spawner.update(5, activePreys, 0, 500, () => 0.25);
  // Still 20 active preys after culling and respawning off-screen with new scaleMultiplier = 1.30
  assert.equal(activePreys.length, 20);
  assert.equal(spawner.getScaleMultiplier(), 1.3);
  assert.equal(activePreys[activePreys.length - 1].scaleMultiplier, 1.3);
});

import { InfiniteProgressionManager } from './infiniteProgressionManager';

test('InfiniteProgressionManager increases globalDifficultyMultiplier by 10% every 60s and scales prey values', () => {
  const prog = new InfiniteProgressionManager();
  assert.equal(prog.globalDifficultyMultiplier, 1.0);
  assert.equal(prog.getScaledPreyValue(100), 100);

  // Advance 59s -> still 1.0
  prog.update(59);
  assert.equal(prog.globalDifficultyMultiplier, 1.0);

  // Advance 2s (total 61s) -> 1.1
  prog.update(2);
  assert.equal(prog.globalDifficultyMultiplier, 1.1);
  assert.equal(prog.getScaledPreyValue(100), 110);

  // Advance 120s (total 181s -> 3 full minutes) -> 1.3
  prog.update(120);
  assert.equal(prog.globalDifficultyMultiplier, 1.3);
  assert.equal(prog.getScaledPreyValue(200), 260);

  // Frenzy stacks & mutation variants
  assert.equal(prog.addFrenzyStack(), 1.25);
  assert.equal(prog.addFrenzyStack(), 1.5);
  assert.equal(prog.rollPreyMutation(10000, () => 0.01), 'GOLDEN_MUTANT');
  assert.equal(prog.rollPreyMutation(10000, () => 0.12), 'ABYSS_BEHEMOTH');
  assert.equal(prog.rollPreyMutation(10000, () => 0.95), 'NONE');
});

import {
  getEffectivePreyTier,
  getDebugPreySizeMultiplier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getOrganRerollCost,
  getPreyRelativeVisualScale,
  setDebugPreySizeMultiplier,
} from './rules';

test('Senior Numerical Tuning: 3-piece faction synergies, organ star upgrades, Abyss Behemoth armor tier, and dynamic economy costs', () => {
  // 1. ARMOR no longer grants redundant +1 biteTierBonus; only JAWS and 3-piece MAGMA synergy grant +1 Bite Tier
  for (const organ of GAME_CONFIG.organs) {
    if (organ.slot === 'ARMOR') {
      assert.equal(organ.stats.biteTierBonus, 0, `${organ.id} should not grant biteTierBonus`);
    }
    if (organ.slot === 'JAWS') {
      assert.equal(organ.stats.biteTierBonus, 1, `${organ.id} must grant +1 biteTierBonus`);
    }
  }

  // 2. 3-Piece Faction Synergies & Organ Star Upgrades (★1 -> ★3)
  const mechaLoadout = getMaxMechaLoadout();
  const s1 = computeSharkStats(4, mechaLoadout, false, { JAWS: 1, TAIL: 1 }, 1.0);
  const s3 = computeSharkStats(4, mechaLoadout, false, { JAWS: 3, TAIL: 3 }, 1.0);
  assert.equal(s1.activeSynergy, 'MECHA');
  assert.ok(s3.moveSpeed > s1.moveSpeed, 'Star-upgraded organs must increase moveSpeed');
  assert.ok(s3.magnetRadius > s1.magnetRadius, 'Star-upgraded organs must increase magnetRadius');

  // Dynamic metabolic hunger drain increases with level and globalDifficultyMultiplier
  const earlyDrain = computeSharkStats(1, {}, false, {}, 1.0).hpDrainPerSec;
  const lateDrain = computeSharkStats(10, {}, false, {}, 1.5).hpDrainPerSec;
  assert.ok(lateDrain > earlyDrain * 2.5, 'Late-game metabolic hunger drain must scale up significantly');

  // 3. Abyss Behemoth adds +1 effective Bite Tier and increases fail damage
  const tier4Sub = GAME_CONFIG.preyTiers[3]; // Tier 4 Submarine
  assert.equal(getEffectivePreyTier(tier4Sub, 'NONE'), 4);
  assert.equal(getEffectivePreyTier(tier4Sub, 'ABYSS_BEHEMOTH'), 5);

  const tier4Shark = computeSharkStats(4, {}, false); // biteTier = 2 + 2 = 4
  const normalSubEncounter = resolvePreyEncounter(tier4Shark, tier4Sub, false, false, 'NONE', 1.0);
  const behemothSubEncounter = resolvePreyEncounter(tier4Shark, tier4Sub, false, false, 'ABYSS_BEHEMOTH', 1.4);
  assert.equal(normalSubEncounter.canDevour, true, 'BiteTier 4 shark can eat normal Tier 4 sub');
  assert.equal(behemothSubEncounter.canDevour, false, 'BiteTier 4 shark cannot eat Tier 4 Abyss Behemoth (effective Tier 5)');
  assert.ok(behemothSubEncounter.hpDelta < -tier4Sub.damageOnFail, 'Abyss Behemoth at 1.4x difficulty deals amplified damage');

  // 4. Dynamic Economy Cost Scaling (Generation-Anchored + Quadratic n^2) prevents infinite loop arbitrage
  assert.equal(getGoldOverdriveCost(0), 35);
  assert.equal(getGoldOverdriveCost(1), 72);
  assert.equal(getGoldOverdriveCost(2), 133);
  assert.ok(
    getGoldOverdriveCost(1, 3) > getGoldOverdriveCost(1, 0),
    'Gold Overdrive cost must scale up with shark generation row'
  );

  assert.equal(getGeneSurgeCost(1, 0), 12);
  assert.equal(getGeneSurgeCost(5, 2), 76);
  assert.ok(
    getGeneSurgeCost(5, 2, 3) > getGeneSurgeCost(5, 2, 0),
    'Gene Surge cost must scale up with shark generation row'
  );

  assert.equal(getOrganRerollCost(0), 8);
  assert.equal(getOrganRerollCost(3), 20);

  // 5. EcosystemSpawner soft-caps scaleMultiplier at 1.65x in long runs
  const longSpawner = new EcosystemSpawner(50, 1500);
  const dummyPreys: PreyEntity[] = [];
  longSpawner.update(400, dummyPreys, 0, 500, () => 0.5);
  assert.equal(longSpawner.getScaleMultiplier(), 1.65);

  // 6. Anti-Snowball Verification:
  // (a) Initial 12s protection + 8 Golden Mutants required + 25s post-frenzy cooldown
  const progMgr = new InfiniteProgressionManager();
  progMgr.reset();
  assert.equal(progMgr.frenzyCooldownTimer, 12);
  assert.equal(progMgr.registerGoldenMutantDevoured(), false, 'Cannot charge frenzy during 12s initial cooldown');
  progMgr.update(12.5);
  for (let i = 0; i < 7; i++) {
    assert.equal(progMgr.registerGoldenMutantDevoured(), false, `Golden mutant #${i + 1} should not trigger frenzy yet`);
  }
  assert.equal(progMgr.registerGoldenMutantDevoured(), true, '8th Golden Mutant after cooldown triggers frenzy');
  assert.equal(progMgr.frenzyCooldownTimer, 25, 'Post-frenzy cooldown set to 25s');

  // (b) Deep-sea hazards (Naval Mines) ALWAYS explode outside of Gold Frenzy, even at Lv.16 Bite Tier 8 while boosting
  const maxShark = computeSharkStats(16, getMaxMechaLoadout(), false);
  assert.equal(maxShark.biteTier, 8);
  const tier6Mine = GAME_CONFIG.preyTiers[5];
  const mineHitAtMaxLevel = resolvePreyEncounter(maxShark, tier6Mine, false, true, 'NONE', 1.5);
  assert.equal(mineHitAtMaxLevel.canDevour, false, 'Mines must ALWAYS explode outside of Gold Frenzy even at Bite Tier 8');
  assert.ok(mineHitAtMaxLevel.hpDelta < -80, 'Mines deal lethal flat + maxHP% damage in deep sea');

  // (c) Tier 8 Bosses & Tier 7+ Abyss Behemoths require active Boost outside of Gold Frenzy even at Bite Tier 8
  const tier8Boss = GAME_CONFIG.preyTiers[7];
  const bossNoBoost = resolvePreyEncounter(maxShark, tier8Boss, false, false, 'NONE', 1.2);
  const bossWithBoost = resolvePreyEncounter(maxShark, tier8Boss, false, true, 'NONE', 1.2);
  assert.equal(bossNoBoost.canDevour, false, 'Tier 8 Boss counter-bites if shark is not actively Boosting');
  assert.equal(bossWithBoost.canDevour, true, 'Tier 8 Boss can be devoured at Bite Tier 8 when actively Boosting');

  // 7. Relative Prey Shrinking: shark scale stays non-obstructive (<= 1.28) while other fish shrink progressively as shark levels up
  const lv1Shark = computeSharkStats(1, {}, false);
  const lv5Shark = computeSharkStats(5, {}, false);
  const lv12Shark = computeSharkStats(12, getMaxMechaLoadout(), false);
  assert.equal(lv1Shark.relativePreyScale, 1.0);
  assert.ok(lv5Shark.relativePreyScale < lv1Shark.relativePreyScale);
  assert.ok(lv12Shark.relativePreyScale < lv5Shark.relativePreyScale);
  assert.ok(lv12Shark.scale <= 1.28, 'Shark on-screen scale must stay bounded so it never obstructs field of view');

  const tier1Fish = GAME_CONFIG.preyTiers[0];
  const fishScaleAtLv1 = getPreyRelativeVisualScale(tier1Fish, lv1Shark, 'NONE');
  const fishScaleAtLv5 = getPreyRelativeVisualScale(tier1Fish, lv5Shark, 'NONE');
  const fishScaleAtLv12 = getPreyRelativeVisualScale(tier1Fish, lv12Shark, 'NONE');
  assert.ok(fishScaleAtLv5 < fishScaleAtLv1, 'Prey visually shrinks as shark grows to Lv.5');
  assert.ok(fishScaleAtLv12 < fishScaleAtLv5, 'Prey shrinks further at Lv.12');

  // 8. Authentic Marine Depth Stratification: shallow coral reef fish never spawn in deep sea, and deep-sea fish never spawn in shallow water
  const depthSpawner = new EcosystemSpawner(50, 1000, 500);
  const shallowSamples: PreyEntity[] = [];
  const deepSamples: PreyEntity[] = [];

  for (let i = 0; i < 40; i++) {
    // Spawn near y = 180m (Shallow Coral Reef) with tight radius [10, 60]
    const sPrey = depthSpawner.spawnPreyOffScreen(shallowSamples, 0, 180, () => (i % 10) / 10, [10, 60], 0);
    assert.ok(
      sPrey.y >= sPrey.config.minDepth && sPrey.y <= sPrey.config.maxDepth,
      `Shallow spawn ${sPrey.config.id} at y=${sPrey.y} must be within [${sPrey.config.minDepth}, ${sPrey.config.maxDepth}]`
    );
    assert.ok(
      sPrey.config.minDepth <= 520,
      `Deep-sea species ${sPrey.config.id} (minDepth=${sPrey.config.minDepth}) must never spawn in shallow water`
    );

    // Spawn near y = 1500m (Deep Abyss) with tight radius [10, 60]
    const dPrey = depthSpawner.spawnPreyOffScreen(deepSamples, 0, 1500, () => (i % 10) / 10, [10, 60], 0);
    assert.ok(
      dPrey.y >= dPrey.config.minDepth && dPrey.y <= dPrey.config.maxDepth,
      `Deep spawn ${dPrey.config.id} at y=${dPrey.y} must be within [${dPrey.config.minDepth}, ${dPrey.config.maxDepth}]`
    );
    assert.ok(
      dPrey.config.maxDepth >= 1150,
      `Shallow reef species ${dPrey.config.id} (maxDepth=${dPrey.config.maxDepth}) must never spawn in the deep abyss`
    );
  }

  // Verify that no actively attacking eel/predator (EEL_CHARGER / SUB_PATROL / MINE_HAZARD) resides or spawns in the shallow zone (<= 520m), even in late game at Bite Tier 4
  for (const p of GAME_CONFIG.preyTiers) {
    if (p.minDepth < 520) {
      assert.notEqual(
        p.behavior,
        'EEL_CHARGER',
        `Shallow-water species ${p.id} (minDepth=${p.minDepth}) must never have EEL_CHARGER behavior`
      );
      assert.equal(
        Boolean(p.isHazard),
        false,
        `Shallow-water species ${p.id} must never be an active hazard`
      );
    }
  }
  depthSpawner.activeSharkBiteTier = 4;
  depthSpawner.tutorialProtectionActive = false;
  depthSpawner.update(45, shallowSamples, 0, 260, () => 0.92);
  for (let i = 0; i < 40; i++) {
    const sLate = depthSpawner.spawnPreyOffScreen(
      shallowSamples,
      0,
      260,
      () => ((i * 3) % 10) / 10,
      [520, 1000],
      5000
    );
    assert.notEqual(
      sLate.config.behavior,
      'EEL_CHARGER',
      `Late-game shallow spawn ${sLate.config.id} must never be an EEL_CHARGER`
    );
    assert.ok(
      sLate.y <= 520,
      `Off-screen spawn while shark is in shallow zone (y=260) must stay in shallow water <= 520m (got y=${sLate.y})`
    );
  }
});

test('48-Shark Body Evolution System: 6x8 matrix, triple-gate unlock, body upgrade scaling, and evolved stats', () => {
  // 1. Verify all 48 shark forms and sprite grid bounds are complete and strictly ordered
  assert.equal(SHARK_EVOLUTION_FORMS.length, 48);
  assert.equal(Object.keys(SHARK_GRID_MAP).length, 48);
  assert.equal(Object.keys(SHARK_CELL_BOUNDS).length, 48);

  for (let i = 0; i < 48; i++) {
    const form = SHARK_EVOLUTION_FORMS[i];
    assert.equal(form.index, i);
    assert.equal(form.row, Math.floor(i / 8));
    assert.equal(form.col, i % 8);
    assert.equal(form.generation, Math.floor(i / 8) + 1);
    const key = `SHARK_FORM_${String(i).padStart(2, '0')}`;
    const bounds = SHARK_CELL_BOUNDS[key as keyof typeof SHARK_CELL_BOUNDS];
    assert.ok(bounds, `Missing SHARK_CELL_BOUNDS for ${key}`);
    assert.ok(bounds[0] >= 0 && bounds[2] > bounds[0] && bounds[2] <= 1.0);
    assert.ok(bounds[1] >= 0 && bounds[3] > bounds[1] && bounds[3] <= 1.0);
  }

  // 2. Verify Triple-Gate Unlock Evaluation on Shark #1 (Tiger Pup)
  const save = createDefaultMetaSave();
  save.bankedCoins = 0;
  save.bankedGenes = 0;
  assert.equal(save.selectedSharkId, 'shark_00_clown_fry');
  const nextTarget = getNextEvolutionTarget('shark_00_clown_fry', save);
  assert.equal(nextTarget?.id, 'shark_01_lemon_pup');

  const lemonForm = getSharkFormById('shark_01_lemon_pup');
  // Initially locked because parent is Lv.1 (needs Lv.2), in-run level is 1 (needs Lv.2), and coins/genes are 0
  const initialEval = evaluateSharkUnlock(lemonForm, save, 0, 0, 1, 150);
  assert.equal(initialEval.alreadyUnlocked, false);
  assert.equal(initialEval.parentMet, false);
  assert.equal(initialEval.bestParentId, 'shark_00_clown_fry');
  assert.equal(initialEval.bestParentIndex, 0);
  assert.equal(initialEval.bestParentNameZh, '拟态小丑幼鲨');
  assert.equal(initialEval.bestParentNameEn, 'Mimic Clown Fry');
  assert.equal(initialEval.levelMet, false);
  assert.equal(initialEval.canUnlockNow, false);

  // Verify that for any shark k > 0 (e.g. #8 Blacktip Pelagic Shark), its default prerequisite parent is shark #(k-1) (#7 Steel-Plated Patrol Shark)
  const blacktipForm = getSharkFormById('shark_08_blacktip_reef');
  const blacktipEval = evaluateSharkUnlock(blacktipForm, save, 0, 0, 1, 150);
  assert.equal(blacktipEval.bestParentId, 'shark_07_steel_patrol');
  assert.equal(blacktipEval.bestParentIndex, 7);
  assert.equal(blacktipEval.bestParentNameZh, '重铆钢甲巡逻鲨');

  // Verify Prehistoric Megalodon (#25 shark_24_megalodon, row=3, col=0) exact gates, dual-parent unlock paths, and row-wrap next target
  const megalodonForm = getSharkFormById('shark_24_megalodon');
  assert.equal(megalodonForm.index, 24);
  assert.equal(megalodonForm.row, 3);
  assert.equal(megalodonForm.col, 0);
  assert.equal(megalodonForm.reqParentUpgradeLevel, 6);
  assert.equal(megalodonForm.reqMaxInRunLevel, 10);
  assert.equal(megalodonForm.reqMaxDepth, 850);
  assert.equal(megalodonForm.unlockCoins, 3800);
  assert.equal(megalodonForm.unlockGenes, 720);

  // Row-wrap next target: when playing #24 Cthulhu Mindflayer Shark (row=2, col=7), next target is #25 Prehistoric Megalodon
  const nextFromCthulhu = getNextEvolutionTarget('shark_23_mindflayer_shark', save);
  assert.equal(nextFromCthulhu?.id, 'shark_24_megalodon');

  // Dual-parent path: default displayed parent is #24 Cthulhu Mindflayer Shark (index 23), while either #24 at Lv.6 OR #17 Great White (row=2, col=0) at Lv.6 satisfies the parent gate
  const megaSave = createDefaultMetaSave();
  const megaInitialEval = evaluateSharkUnlock(megalodonForm, megaSave, 3800, 720, 10, 850);
  assert.equal(megaInitialEval.bestParentId, 'shark_23_mindflayer_shark');
  assert.equal(megaInitialEval.bestParentNameZh, '克苏鲁夺心章鱼鲨');
  assert.equal(megaInitialEval.parentMet, false);

  megaSave.unlockedSharkIds.push('shark_16_great_white');
  megaSave.sharkUpgradeLevels['shark_16_great_white'] = 6;
  const megaReadyEval = evaluateSharkUnlock(megalodonForm, megaSave, 3800, 720, 10, 850);
  assert.equal(megaReadyEval.parentMet, true);
  assert.equal(megaReadyEval.bestParentId, 'shark_16_great_white');
  assert.equal(megaReadyEval.canUnlockNow, true);

  // Upgrade parent (#0 Clown Fry) to Lv.2, reach In-Run Lv.2, Depth 180m, and bank 100 Coins + 25 Genes
  save.sharkUpgradeLevels['shark_00_clown_fry'] = 2;
  save.bankedCoins = 100;
  save.bankedGenes = 25;
  const readyEval = evaluateSharkUnlock(lemonForm, save, 0, 0, 2, 180);
  assert.equal(readyEval.parentMet, true);
  assert.equal(readyEval.levelMet, true);
  assert.equal(readyEval.depthMet, true);
  assert.equal(readyEval.coinsMet, true);
  assert.equal(readyEval.genesMet, true);
  assert.equal(readyEval.canUnlockNow, true);

  // 3. Verify Body Upgrade Cost & Stat Scaling (Lv.1 -> Lv.5 -> Lv.10) + Breakthrough Gene Sinks at Lv.4->5 and Lv.9->10
  const clownForm = getSharkFormById('shark_00_clown_fry');
  const costLv1 = getSharkUpgradeCost(clownForm, 1);
  const costLv5 = getSharkUpgradeCost(clownForm, 5);
  assert.ok(costLv5 > costLv1, 'Body upgrade cost must scale progressively with level');
  assert.equal(getSharkUpgradeGeneCost(clownForm, 1), 0, 'Normal level upgrade (Lv.1->2) requires 0 genes');
  assert.equal(getSharkUpgradeGeneCost(clownForm, 3), 0, 'Normal level upgrade (Lv.3->4) requires 0 genes');
  assert.ok(getSharkUpgradeGeneCost(clownForm, 4) > 0, 'Breakthrough level upgrade (Lv.4->5, +1 Bite Tier) requires Gene Shards');
  assert.equal(getSharkUpgradeGeneCost(clownForm, 7), 0, 'Normal level upgrade (Lv.7->8) requires 0 genes');
  assert.ok(
    getSharkUpgradeGeneCost(clownForm, 9) > getSharkUpgradeGeneCost(clownForm, 4),
    'Max-level breakthrough upgrade (Lv.9->10, +1 Bite Tier) requires more Gene Shards than Lv.4->5'
  );

  const statsLv1 = computeEvolvedSharkStats(1, 'shark_00_clown_fry', 1, false, 1.0, 1);
  const statsLv5 = computeEvolvedSharkStats(1, 'shark_00_clown_fry', 5, false, 1.0, 1);
  const statsLv10 = computeEvolvedSharkStats(1, 'shark_00_clown_fry', 10, false, 1.0, 1);

  assert.ok(statsLv5.maxHp > statsLv1.maxHp, 'Body upgrade Lv.5 increases Max HP');
  assert.ok(statsLv10.moveSpeed > statsLv5.moveSpeed, 'Body upgrade Lv.10 increases Swim Speed');
  assert.equal(statsLv5.biteTier, statsLv1.biteTier + 1, 'Body upgrade Lv.5 grants +1 Bite Tier breakthrough');
  assert.equal(statsLv10.biteTier, statsLv1.biteTier + 2, 'Body upgrade Lv.10 grants +2 total Bite Tier breakthrough');

  // 4. Verify Tier VI Cosmic Apex Form (#47 Omega Devourer) has canEatMines and massive stats while keeping relativePreyScale shrinking
  const omegaStats = computeEvolvedSharkStats(8, 'shark_47_omega_devourer', 10, false, 1.0, 48);
  assert.equal(omegaStats.canEatMines, true);
  assert.equal(omegaStats.biteTier, 8);
  assert.ok(omegaStats.maxHp > 1500, 'Tier VI Omega Devourer at Lv.10 has massive HP pool');
  assert.ok(omegaStats.scale <= 1.28, 'Shark screen size stays bounded <= 1.28 so vision is never blocked');
  assert.ok(omegaStats.relativePreyScale < statsLv1.relativePreyScale, 'Higher generation + in-run level shrinks surrounding prey');

  // Verify canEatMines allows devouring Naval Mines even outside of Gold Frenzy!
  const tier6Mine = GAME_CONFIG.preyTiers[5];
  const omegaMineOutcome = resolvePreyEncounter(omegaStats, tier6Mine, false, false, 'NONE', 1.0);
  assert.equal(omegaMineOutcome.canDevour, true, 'Shark with canEatMines (Tier V+ Mecha/Omega) devours naval mines safely');

  // 5. Verify Global Atlas Collection Bonus scales with unlocked count
  const bonus1 = getGlobalAtlasBonuses(save);
  const fullSave = createDefaultMetaSave();
  fullSave.unlockedSharkIds = SHARK_EVOLUTION_FORMS.map((f) => f.id);
  const bonus48 = getGlobalAtlasBonuses(fullSave);
  assert.ok(bonus48.hpMultiplier > bonus1.hpMultiplier);
  assert.ok(bonus48.rewardMultiplier > bonus1.rewardMultiplier);

  // 6. Verify Per-Shark Mastery Crowns (Bronze/Silver/Gold), Trial Isolation, and One-Time First-Clear Gene Rewards
  const masteryTiers = getSharkMasteryConfig(clownForm);
  assert.equal(masteryTiers.length, 3);
  assert.equal(masteryTiers[0].scoreThreshold, 3500);
  assert.equal(masteryTiers[0].geneReward, 12);

  // (a) Trial runs must NEVER record personal best scores or claim mastery crowns
  const trialResult = settleSharkScoreMastery('shark_45_mecha_leviathan', 999999, true, save);
  assert.equal(trialResult.genesAwarded, 0, 'Trial run must award 0 mastery genes');
  assert.equal(trialResult.newCrownTier, 0, 'Trial run must not unlock mastery crowns');
  assert.equal(trialResult.isNewRecord, false, 'Trial run must not set personal best score');

  // (b) Reaching Bronze threshold (3500) on #01 Clown Fry awards 12 Genes once, and 0 on repeat runs
  const bronzeSettle = settleSharkScoreMastery('shark_00_clown_fry', 4200, false, save);
  assert.equal(bronzeSettle.newCrownTier, 1);
  assert.equal(bronzeSettle.genesAwarded, 12);
  assert.equal(bronzeSettle.isNewRecord, true);

  const repeatBronze = settleSharkScoreMastery('shark_00_clown_fry', 4000, false, bronzeSettle.updatedSave);
  assert.equal(repeatBronze.genesAwarded, 0, 'Repeating same mastery tier must not award duplicate genes');
  assert.equal(repeatBronze.newCrownTier, 1);

  // (c) Jumping from Bronze (1) directly to Gold (3) awards Silver + Gold genes together once
  const goldSettle = settleSharkScoreMastery('shark_00_clown_fry', 20000, false, bronzeSettle.updatedSave);
  assert.equal(goldSettle.newCrownTier, 3);
  assert.equal(
    goldSettle.genesAwarded,
    masteryTiers[1].geneReward + masteryTiers[2].geneReward
  );

  // 7. Verify In-Run Hunting Heat Buff passive scaling
  const heat0 = computeHuntingHeatBuff(0, 0);
  const heatMax = computeHuntingHeatBuff(50000, 0);
  assert.equal(heat0.heatLevel, 0);
  assert.equal(heatMax.heatLevel, 5);
  assert.equal(heatMax.magnetRadiusBonus, 80);
  assert.equal(heatMax.energyRegenBonus, 11);
});

test('Visual Size vs. Devourability Contract + Gold Frenzy Size Preservation Exception', () => {
  const sharkFormsToTest = [
    { id: 'shark_00_clown_fry', inRunLv: 1, upgLv: 1 },
    { id: 'shark_05_mako_spear', inRunLv: 3, upgLv: 5 },
    { id: 'shark_16_basking_filter', inRunLv: 5, upgLv: 6 },
    { id: 'shark_25_bio_venom', inRunLv: 7, upgLv: 8 },
    { id: 'shark_47_omega_devourer', inRunLv: 10, upgLv: 10 },
  ];

  const variants = ['NONE', 'GOLDEN_MUTANT', 'ABYSS_BEHEMOTH'] as const;

  for (const cfg of sharkFormsToTest) {
    const normalStats = computeEvolvedSharkStats(
      cfg.inRunLv,
      cfg.id,
      cfg.upgLv,
      false,
      1.0,
      10
    );
    const frenzyStats = computeEvolvedSharkStats(
      cfg.inRunLv,
      cfg.id,
      cfg.upgLv,
      true,
      1.0,
      10
    );
    const sharkDrawSize =
      96 * normalStats.scale * getDebugPreySizeMultiplier();

    for (const prey of GAME_CONFIG.preyTiers) {
      for (const variant of variants) {
        const normalVisualScale = getPreyRelativeVisualScale(
          prey,
          normalStats,
          variant,
          false
        );
        const frenzyVisualScale = getPreyRelativeVisualScale(
          prey,
          frenzyStats,
          variant,
          true
        );

        // Gold Frenzy Special Exception: entering Gold Frenzy must NEVER shrink any fish;
        // every species keeps its exact pre-frenzy visual size!
        assert.equal(
          frenzyVisualScale,
          normalVisualScale,
          `Gold Frenzy must preserve pre-frenzy visual size for ${prey.id} (${variant}) on ${cfg.id}`
        );

        const preyDrawSize = prey.radius * normalVisualScale * 2.25;
        // Test normal state (frenzy = false) non-boosting direct contact
        const normalOutcome = resolvePreyEncounter(
          normalStats,
          prey,
          false,
          false,
          variant,
          1.0
        );
        // Test Gold Frenzy state (frenzy = true): even giant oversized monsters & mines are devourable!
        const frenzyOutcome = resolvePreyEncounter(
          frenzyStats,
          prey,
          true,
          false,
          variant,
          1.0
        );
        assert.equal(
          frenzyOutcome.canDevour,
          true,
          `During Gold Frenzy, ${prey.id} (${variant}) must be devourable even while preserving its pre-frenzy size`
        );

        if (preyDrawSize < sharkDrawSize) {
          assert.equal(
            normalOutcome.canDevour,
            true,
            `Prey ${prey.id} (${variant}) with drawSize=${preyDrawSize.toFixed(1)} < sharkDrawSize=${sharkDrawSize.toFixed(1)} MUST be directly devourable without boosting!`
          );
          assert.ok(
            preyDrawSize <= sharkDrawSize * 0.66,
            `Edible prey ${prey.id} drawSize=${preyDrawSize.toFixed(1)} must be unmistakably smaller (<=66%) than sharkDrawSize=${sharkDrawSize.toFixed(1)}`
          );
        } else {
          assert.equal(
            normalOutcome.canDevour,
            false,
            `Prey ${prey.id} (${variant}) with drawSize=${preyDrawSize.toFixed(1)} >= sharkDrawSize=${sharkDrawSize.toFixed(1)} MUST deal damage on contact outside Gold Frenzy!`
          );
          assert.ok(
            normalOutcome.hpDelta < 0,
            `Dangerous prey ${prey.id} must reduce shark HP on contact outside Gold Frenzy`
          );
          assert.ok(
            preyDrawSize >= sharkDrawSize * 1.15,
            `Dangerous prey ${prey.id} drawSize=${preyDrawSize.toFixed(1)} must be visibly larger (>=115%) than sharkDrawSize=${sharkDrawSize.toFixed(1)}`
          );
        }
      }
    }
  }
});

test('Senior QA Audit: 48-Shark Panel Stats, Trait Descriptions, and Gameplay Calculation Consistency', () => {
  // 1. Verify every shark's traitZh / traitEn numerical claims match its exact SharkFormConfig fields
  for (const form of SHARK_EVOLUTION_FORMS) {
    const biteMatch = form.traitEn.match(/Bite Tier T(\d)/);
    if (biteMatch) {
      assert.equal(
        form.baseBiteTier,
        Number(biteMatch[1]),
        `${form.id} traitEn Bite Tier T${biteMatch[1]} must match baseBiteTier=${form.baseBiteTier}`
      );
    }

    const hpMatch = form.traitEn.match(/(\d+)\s+Base HP/);
    if (hpMatch) {
      assert.equal(
        form.baseHp,
        Number(hpMatch[1]),
        `${form.id} traitEn ${hpMatch[1]} Base HP must match baseHp=${form.baseHp}`
      );
    }

    const speedMatch = form.traitEn.match(/\+(\d+)%\s+(?:swim\s+)?speed/);
    if (speedMatch) {
      assert.equal(
        Math.round(form.speedBonus * 100),
        Number(speedMatch[1]),
        `${form.id} traitEn +${speedMatch[1]}% speed must match speedBonus=${Math.round(form.speedBonus * 100)}%`
      );
    }

    const scoreMultMatch = form.traitEn.match(/(\d+\.\d+)x\s+(?:[Ss]core|\(\+\d+%\)\s+feeding\s+score)/);
    if (scoreMultMatch) {
      assert.equal(
        form.scoreMult,
        Number(scoreMultMatch[1]),
        `${form.id} traitEn ${scoreMultMatch[1]}x score must match scoreMult=${form.scoreMult}`
      );
    }
  }

  // 2. Verify Lineage Passives in computeEvolvedSharkStats
  const bioStats = computeEvolvedSharkStats(1, 'shark_08_blacktip_reef', 1, false, 1.0, 1);
  const abyssStats = computeEvolvedSharkStats(1, 'shark_12_starry_whale', 1, false, 1.0, 1);
  assert.equal(bioStats.jawSuctionMultiplier, 1.18, 'APEX_BIO lineage grants 1.18x jaw suction radius');
  assert.equal(abyssStats.jawSuctionMultiplier, 1.35, 'Starry Whale Shark grants 1.35x jaw suction radius');
  assert.ok(
    (abyssStats.geneYieldMultiplier ?? 1) > (bioStats.geneYieldMultiplier ?? 1),
    'ELDER_ABYSS lineage grants +15% bonus gene crystal yield'
  );

  // 3. Verify Specific Shark Trait Multipliers & Combat Mitigation in resolvePreyEncounter
  const tier6Mine = GAME_CONFIG.preyTiers[5]; // Naval Mine hazard
  const tier8Boss = GAME_CONFIG.preyTiers[7]; // Kraken Boss

  const standardTier2 = computeEvolvedSharkStats(1, 'shark_11_tiger_shark', 1, false, 1.0, 1);
  const bullShark = computeEvolvedSharkStats(1, 'shark_10_bull_shark', 1, false, 1.0, 1);
  const cyberAlloy = computeEvolvedSharkStats(1, 'shark_21_cyber_alloy', 1, false, 1.0, 1);
  const earthGolem = computeEvolvedSharkStats(1, 'shark_30_earth_golem', 1, false, 1.0, 1);
  const paladinShark = computeEvolvedSharkStats(1, 'shark_44_celestial_paladin', 1, false, 1.0, 1);
  const krakenShark = computeEvolvedSharkStats(1, 'shark_39_kraken_hydra', 1, false, 1.0, 1);

  assert.equal(bullShark.damageTakenMultiplier, 0.75, '#10 Bull Shark reduces collision damage by 25%');
  assert.equal(cyberAlloy.mineDamageTakenMultiplier, 0.6, '#21 Cyber Alloy reduces mine explosion damage by 40%');
  assert.equal(earthGolem.knockbackMultiplier, 0.5, '#30 Earth Golem reduces knockback by 50%');
  assert.equal(paladinShark.damageTakenMultiplier, 0.5, '#44 Celestial Paladin reduces all damage by 50%');
  assert.equal( paladinShark.coinYieldMultiplier, Number((1.6 * 2.0).toFixed(2)), '#44 Celestial Paladin doubles coin yield on top of Gen VI bonus');

  const stdBossHit = resolvePreyEncounter(standardTier2, tier8Boss, false, false, 'NONE', 1.0);
  const bullBossHit = resolvePreyEncounter(bullShark, tier8Boss, false, false, 'NONE', 1.0);
  assert.ok(
    Math.abs(bullBossHit.hpDelta) < Math.abs(stdBossHit.hpDelta),
    'Bull Shark takes less fail damage from oversized Boss than unarmored peer'
  );

  const golemMineHit = resolvePreyEncounter(earthGolem, tier6Mine, false, false, 'NONE', 1.0);
  assert.equal(golemMineHit.knockbackForce, 220, 'Earth Golem halves mine knockback from 440 to 220');

  // Verify #39 Kraken Hydra 2x Boss Slayer reward
  const dreadnoughtStats = computeEvolvedSharkStats(1, 'shark_36_dreadnought_cannon', 1, false, 1.0, 1);
  const stdBossEat = resolvePreyEncounter(dreadnoughtStats, tier8Boss, false, false, 'NONE', 1.0);
  const krakenBossEat = resolvePreyEncounter(krakenShark, tier8Boss, false, false, 'NONE', 1.0);
  assert.equal(krakenBossEat.coinGain, stdBossEat.coinGain * 2, '#39 Kraken Hydra doubles Boss coin reward');
  assert.equal(krakenBossEat.geneGain, stdBossEat.geneGain * 2, '#39 Kraken Hydra doubles Boss gene reward');
});

test('Biomechanical Swimming Gait Classification & Anatomical Spine Envelope Invariants', () => {
  const byId = Object.fromEntries(GAME_CONFIG.preyTiers.map((p) => [p.id, p]));

  assert.equal(getPreySwimGait(byId['coral_clownfish']), 'CARANGIFORM');
  assert.equal(getPreySwimGait(byId['electric_eel']), 'ANGUILLIFORM');
  assert.equal(getPreySwimGait(byId['green_moray_eel']), 'ANGUILLIFORM');
  assert.equal(getPreySwimGait(byId['gene_jelly']), 'MEDUSOID_JET');
  assert.equal(getPreySwimGait(byId['cthulhu_kraken']), 'MEDUSOID_JET');
  assert.equal(getPreySwimGait(byId['gold_puffer']), 'PUFFER_BUOYANT');
  assert.equal(getPreySwimGait(byId['probe_sub']), 'RIGID_PROPULSION');
  assert.equal(getPreySwimGait(byId['cyber_mine']), 'RIGID_PROPULSION');
  assert.equal(getPreySwimGait(byId['cyber_mecha_shark_boss']), 'SHARK_APEX');

  // Verify snout (u=0) stays anchored with minimal sway while caudal fin (u=1) whips with maximum amplitude
  const drawH = 60;
  let maxSnoutDy = 0;
  let maxTailDy = 0;
  for (let p = 0; p < Math.PI * 2; p += 0.2) {
    const snout = computeSpineSliceDeformation(0, p, 'SHARK_APEX', drawH, 1.0, 0);
    const tail = computeSpineSliceDeformation(1, p, 'SHARK_APEX', drawH, 1.0, 0);
    maxSnoutDy = Math.max(maxSnoutDy, Math.abs(snout.dy));
    maxTailDy = Math.max(maxTailDy, Math.abs(tail.dy));
  }
  assert.ok(
    maxSnoutDy < 0.5,
    `Shark snout (u=0) must remain rock-steady for bite alignment (got ${maxSnoutDy.toFixed(2)}px)`
  );
  assert.ok(
    maxTailDy > 6.5,
    `Shark tail fin (u=1) must whip with clear propulsion amplitude (got ${maxTailDy.toFixed(2)}px)`
  );

  // Verify C0/C1 continuity across 24 slices for all 6 gaits (zero segmentation / stair-step jumps), including active turning C-bend
  const allGaits = [
    'SHARK_APEX',
    'CARANGIFORM',
    'ANGUILLIFORM',
    'MEDUSOID_JET',
    'PUFFER_BUOYANT',
    'RIGID_PROPULSION',
  ] as const;
  const sliceCount = 24;
  const sliceDstW = 140 / sliceCount;

  for (const gait of allGaits) {
    let prevDef = computeSpineSliceDeformation(1.0, 1.25, gait, drawH, 1.0, 0.5, 0.75);
    for (let i = 0; i < sliceCount; i++) {
      const u1 = 1 - (i + 1) / sliceCount;
      const nextDef = computeSpineSliceDeformation(u1, 1.25, gait, drawH, 1.0, 0.5, 0.75);
      const shearY = (nextDef.dy - prevDef.dy) / sliceDstW;
      // Right edge of affine-sheared slice i at localX = sliceDstW must match left edge of slice i+1
      const rightEdgeY = prevDef.dy + sliceDstW * shearY;
      assert.ok(
        Math.abs(rightEdgeY - nextDef.dy) < 1e-9,
        `Affine shear right edge of slice ${i} must match left edge of slice ${i + 1} for ${gait}`
      );
      assert.ok(
        Math.abs(nextDef.scaleY - prevDef.scaleY) < 0.03,
        `Adjacent slices must not have abrupt scaleY jumps for ${gait}`
      );
      prevDef = nextDef;
    }
  }

  // Verify Hydrodynamic Turning C-Bend: when turnBend > 0, snout (u=0) leads into the turn (+dy)
  // while posterior tail (u=1) trails opposite to the turn (-dy)
  const straightSnout = computeSpineSliceDeformation(0, 0, 'SHARK_APEX', drawH, 1.0, 0, 0);
  const turnSnout = computeSpineSliceDeformation(0, 0, 'SHARK_APEX', drawH, 1.0, 0, 0.85);
  const straightTail = computeSpineSliceDeformation(1, 0, 'SHARK_APEX', drawH, 1.0, 0, 0);
  const turnTail = computeSpineSliceDeformation(1, 0, 'SHARK_APEX', drawH, 1.0, 0, 0.85);

  assert.ok(
    turnSnout.dy - straightSnout.dy > 2.5,
    'Positive turnBend must lead the shark snout into the turn (+dy)'
  );
  assert.ok(
    turnTail.dy - straightTail.dy < -8.0,
    'Positive turnBend must trail the shark tail along the turning C-arc (-dy)'
  );
});

test('sampleBathymetricWaterColor interpolates smoothly across shallow, twilight, and abyssal depths without discontinuities', () => {
  const surface = sampleBathymetricWaterColor(0);
  const shallow = sampleBathymetricWaterColor(250);
  const twilight = sampleBathymetricWaterColor(800);
  const abyss = sampleBathymetricWaterColor(1500);
  const hadal = sampleBathymetricWaterColor(2100);

  // Luminance decreases from sunlit surface down to upper abyss
  const lum = (c: { r: number; g: number; b: number }) =>
    0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  assert.ok(lum(surface) > lum(shallow), 'Surface must be brighter than mid-shallow reef');
  assert.ok(lum(shallow) > lum(twilight), 'Shallow reef must be brighter than twilight zone');
  assert.ok(lum(twilight) > lum(abyss), 'Twilight zone must be brighter than upper abyss');

  // Hadal volcanic trench (>1900m) introduces warm geothermal red-amber underglow
  assert.ok(hadal.r > abyss.r, 'Hadal hydrothermal zone must have warmer red magma tint than upper abyss');

  // Verify C0 continuity across every 10m step in the underwater column from 0m to 2000m (zero color jumps)
  let prev = sampleBathymetricWaterColor(0);
  for (let d = 10; d <= 2000; d += 10) {
    const cur = sampleBathymetricWaterColor(d);
    const maxChannelDelta = Math.max(
      Math.abs(cur.r - prev.r),
      Math.abs(cur.g - prev.g),
      Math.abs(cur.b - prev.b)
    );
    assert.ok(
      maxChannelDelta <= 12,
      `Water color jump too large between ${d - 10}m and ${d}m (delta=${maxChannelDelta})`
    );
    prev = cur;
  }
});

test('Live Debug Regulators: setDebugPreySizeMultiplier and EcosystemSpawner.syncPreyCountImmediate', () => {
  // 1. Verify default debugPreySizeMultiplier is 0.8 and setDebugPreySizeMultiplier scales getPreyRelativeVisualScale linearly
  const sharkStats = computeEvolvedSharkStats(1, 'shark_00_clown_fry', 1, false, 1.0, 1);
  const clownfish = GAME_CONFIG.preyTiers[0];
  assert.equal(getDebugPreySizeMultiplier(), 0.8);
  const defaultScale08 = getPreyRelativeVisualScale(clownfish, sharkStats);

  setDebugPreySizeMultiplier(1.0);
  assert.equal(getDebugPreySizeMultiplier(), 1.0);
  const baseScale = getPreyRelativeVisualScale(clownfish, sharkStats);
  assert.ok(
    Math.abs(defaultScale08 - baseScale * 0.8) < 0.005,
    `Expected default 0.8x scale ~ ${baseScale * 0.8}, got ${defaultScale08}`
  );

  setDebugPreySizeMultiplier(1.5);
  assert.equal(getDebugPreySizeMultiplier(), 1.5);
  const enlargedScale = getPreyRelativeVisualScale(clownfish, sharkStats);
  assert.ok(
    Math.abs(enlargedScale - baseScale * 1.5) < 0.005,
    `Expected enlargedScale ~ ${baseScale * 1.5}, got ${enlargedScale}`
  );

  setDebugPreySizeMultiplier(0.5);
  const shrunkScale = getPreyRelativeVisualScale(clownfish, sharkStats);
  assert.ok(
    Math.abs(shrunkScale - baseScale * 0.5) < 0.005,
    `Expected shrunkScale ~ ${baseScale * 0.5}, got ${shrunkScale}`
  );

  // Restore to configured default 0.8
  setDebugPreySizeMultiplier(0.8);
  assert.equal(getPreyRelativeVisualScale(clownfish, sharkStats), defaultScale08);

  // 2. Verify EcosystemSpawner defaults to maxActivePreys = 20 and syncPreyCountImmediate trims/spawns immediately
  const spawner = new EcosystemSpawner();
  assert.equal(spawner.maxActivePreys, 20);
  const activePreys: PreyEntity[] = [];
  spawner.syncPreyCountImmediate(activePreys, 0, 220, () => 0.4, 0);
  assert.equal(activePreys.length, 20);

  // Lower target to 10 -> immediately trims down to 10 and recycles 10 into pool
  spawner.maxActivePreys = 10;
  spawner.syncPreyCountImmediate(activePreys, 0, 220, () => 0.4, 0);
  assert.equal(activePreys.length, 10);
  assert.ok(spawner.getPoolSize() >= 10);

  // Raise target to 36 -> immediately spawns back up to 36
  spawner.maxActivePreys = 36;
  spawner.syncPreyCountImmediate(activePreys, 0, 220, () => 0.4, 0);
  assert.equal(activePreys.length, 36);
});

test('UI_BANNER_BOUNDS (buttons_16e3a0cf.png) defines 4 non-overlapping normalized regions and valid hollow avatar metrics', () => {
  const keys = Object.keys(UI_BANNER_BOUNDS) as Array<keyof typeof UI_BANNER_BOUNDS>;
  assert.deepEqual(keys.sort(), [
    'UI_BAR_BTN_BLUE',
    'UI_BAR_BTN_GOLD',
    'UI_BAR_BTN_GREEN',
    'UI_PLATE_AVATAR_BAR',
  ]);

  for (const key of keys) {
    const [x0, y0, x1, y1] = UI_BANNER_BOUNDS[key];
    assert.ok(x0 >= 0 && x1 <= 1 && x0 < x1, `${key} x bounds valid`);
    assert.ok(y0 >= 0 && y1 <= 1 && y0 < y1, `${key} y bounds valid`);
  }

  // Top avatar plate must not overlap vertically with bottom 3 buttons
  const [, , , plateY1] = UI_BANNER_BOUNDS.UI_PLATE_AVATAR_BAR;
  for (const btnKey of ['UI_BAR_BTN_GREEN', 'UI_BAR_BTN_BLUE', 'UI_BAR_BTN_GOLD'] as const) {
    const [, btnY0] = UI_BANNER_BOUNDS[btnKey];
    assert.ok(plateY1 <= btnY0, `Top avatar bar must not overlap vertically with ${btnKey}`);
  }

  // Bottom 3 buttons must be ordered left-to-right (Green -> Blue -> Gold) with zero horizontal overlap
  assert.ok(UI_BANNER_BOUNDS.UI_BAR_BTN_GREEN[2] <= UI_BANNER_BOUNDS.UI_BAR_BTN_BLUE[0]);
  assert.ok(UI_BANNER_BOUNDS.UI_BAR_BTN_BLUE[2] <= UI_BANNER_BOUNDS.UI_BAR_BTN_GOLD[0]);

  // Verify hollow avatar circle metrics are within left circular medallion region
  const metrics = spriteSheetManager.avatarBarHollowMetrics;
  assert.ok(metrics.cxPct > 12 && metrics.cxPct < 26);
  assert.ok(metrics.cyPct >= 45 && metrics.cyPct <= 55);
  assert.ok(metrics.innerDiaPctH >= 45 && metrics.innerDiaPctH <= 65);

  // Verify all 9 UI_SETTING_BOUNDS (setting_83a7a273.png) are valid and pairwise non-overlapping
  const settingKeys = Object.keys(UI_SETTING_BOUNDS) as Array<keyof typeof UI_SETTING_BOUNDS>;
  assert.equal(settingKeys.length, 9);
  for (let i = 0; i < settingKeys.length; i++) {
    const k1 = settingKeys[i];
    const [ax0, ay0, ax1, ay1] = UI_SETTING_BOUNDS[k1];
    assert.ok(ax0 >= 0 && ax1 <= 1 && ax0 < ax1, `${k1} x bounds valid`);
    assert.ok(ay0 >= 0 && ay1 <= 1 && ay0 < ay1, `${k1} y bounds valid`);
    for (let j = i + 1; j < settingKeys.length; j++) {
      const k2 = settingKeys[j];
      const [bx0, by0, bx1, by1] = UI_SETTING_BOUNDS[k2];
      const overlaps = ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
      assert.equal(overlaps, false, `${k1} and ${k2} must not overlap in setting_83a7a273.png`);
    }
  }
});

test('getParallaxLayerGrowthScales shrinks Near > Ambient > Mid > Far > Water in strict optical depth proportion as shark grows', () => {
  const starterStats = computeEvolvedSharkStats(1, 'shark_00_clown_fry', 1, false, 1.0, 1);
  assert.equal(starterStats.relativePreyScale, 1.0);
  const starterScales = getParallaxLayerGrowthScales(starterStats.relativePreyScale);
  assert.equal(starterScales.growthProgress, 0);
  assert.equal(starterScales.waterScale, 1.0);
  assert.equal(starterScales.farScale, 1.0);
  assert.equal(starterScales.midScale, 1.0);
  assert.equal(starterScales.ambientScale, 1.0);
  assert.equal(starterScales.nearScale, 1.0);

  // Mid-game evolution (Gen 3 #17 Lv.5 upgrade, in-run Lv.6)
  const midGameStats = computeEvolvedSharkStats(6, 'shark_16_armor_plating', 5, false, 1.0, 17);
  const midScales = getParallaxLayerGrowthScales(midGameStats.relativePreyScale);
  assert.ok(midScales.growthProgress > 0.5 && midScales.growthProgress < 1.0);
  assert.ok(
    midGameStats.relativePreyScale < midScales.nearScale &&
      midScales.nearScale < midScales.ambientScale &&
      midScales.ambientScale < midScales.midScale &&
      midScales.midScale < midScales.farScale &&
      midScales.farScale < midScales.waterScale &&
      midScales.waterScale < 1.0,
    'Background layers must obey strict optical depth shrinking hierarchy: Prey < Near < Ambient < Mid < Far < Water < 1.0'
  );

  // Max leviathan growth (Gen 6 #48 Omega Devourer Lv.10 upgrade, in-run Lv.12 -> relativePreyScale = 0.40)
  const omegaStats = computeEvolvedSharkStats(12, 'shark_47_omega_devourer', 10, false, 1.0, 48);
  assert.equal(omegaStats.relativePreyScale, 0.4);
  const maxScales = getParallaxLayerGrowthScales(omegaStats.relativePreyScale);
  assert.equal(maxScales.growthProgress, 1);
  assert.equal(maxScales.nearScale, 0.58);     // -42.0% shrink (0.70 weight)
  assert.equal(maxScales.ambientScale, 0.67);  // -33.0% shrink (0.55 weight)
  assert.equal(maxScales.midScale, 0.73);      // -27.0% shrink (0.45 weight)
  assert.equal(maxScales.farScale, 0.868);     // -13.2% shrink (0.22 weight)
  assert.equal(maxScales.waterScale, 0.91);    //  -9.0% shrink (0.15 weight)
});

test('computeParallaxBiomeTransitionState enforces C2 quintic continuity, staggered Far->Mid->Near optical lead, Porter-Duff coverage compensation, and non-negative spatial emergence', () => {
  // 1. Quintic smoothstep endpoint & midpoint invariants
  assert.equal(quinticSmoothstep(300, 700, 300), 0);
  assert.equal(quinticSmoothstep(300, 700, 700), 1);
  assert.equal(quinticSmoothstep(300, 700, 500), 0.5);

  // 2. Staggered Optical Lead: at 470m (approaching the 520m thermocline),
  //    Twilight Far horizon leads ahead of Mid cliffs, which leads ahead of Near seabed
  const at470 = computeParallaxBiomeTransitionState(470);
  assert.ok(
    at470.twilight.farWeight > at470.twilight.midWeight &&
      at470.twilight.midWeight > at470.twilight.nearWeight &&
      at470.twilight.nearWeight > 0,
    'Twilight Far horizon must emerge earlier than Mid cliffs, which must emerge earlier than Near seabed'
  );

  // Similarly at 1070m (approaching the 1150m abyssal boundary),
  // Abyss Far volcanic ridge leads ahead of Mid black smokers, which leads ahead of Near lava bed
  const at1070 = computeParallaxBiomeTransitionState(1070);
  assert.ok(
    at1070.abyss.farWeight > at1070.abyss.midWeight &&
      at1070.abyss.midWeight > at1070.abyss.nearWeight &&
      at1070.abyss.nearWeight > 0,
    'Abyss Far horizon must emerge earlier than Mid black smokers, which must emerge earlier than Near lava bed'
  );

  // 3. Porter-Duff Constant-Coverage Opacity Compensation at Near crossfade midpoints (570m and 1200m)
  const at570 = computeParallaxBiomeTransitionState(570);
  const combinedNear570 =
    1 - (1 - at570.shallow.nearAlpha) * (1 - at570.twilight.nearAlpha);
  assert.ok(
    combinedNear570 > 0.81,
    `Combined Porter-Duff Near seabed coverage at 570m must exceed 81% to prevent transparency dip (got ${combinedNear570.toFixed(3)})`
  );

  const at1200 = computeParallaxBiomeTransitionState(1200);
  const combinedNear1200 =
    1 - (1 - at1200.twilight.nearAlpha) * (1 - at1200.abyss.nearAlpha);
  assert.ok(
    combinedNear1200 > 0.81,
    `Combined Porter-Duff Near seabed coverage at 1200m must exceed 81% to prevent transparency dip (got ${combinedNear1200.toFixed(3)})`
  );

  // 4. Spatial Emergence & Subduction Offsets and Continuous Particle Weights across 0m .. 2000m (5m steps)
  let prev = computeParallaxBiomeTransitionState(0);
  for (let d = 0; d <= 2000; d += 5) {
    const cur = computeParallaxBiomeTransitionState(d);

    // Particle weights must always sum to 1.0
    const pSum =
      cur.particleShallowWeight +
      cur.particleTwilightWeight +
      cur.particleAbyssWeight;
    assert.ok(
      Math.abs(pSum - 1.0) < 1e-9,
      `Particle weights must sum to 1.0 at depth ${d}m (got ${pSum})`
    );

    // All vertical transition offsets must be >= 0 (never lifting any terrain bottom edge above viewH)
    // and bounded within each plane's physical emergence span
    for (const biome of [cur.shallow, cur.twilight, cur.abyss]) {
      assert.ok(biome.farTransitionOffsetY >= 0 && biome.farTransitionOffsetY <= 20.001);
      assert.ok(biome.midTransitionOffsetY >= 0 && biome.midTransitionOffsetY <= 36.001);
      assert.ok(biome.nearTransitionOffsetY >= 0 && biome.nearTransitionOffsetY <= 54.001);
    }
  }

  // Incoming biomes during diving must exhibit Near > Mid > Far emergence offset (foreground rises fastest)
  assert.ok(
    at470.twilight.nearTransitionOffsetY > at470.twilight.midTransitionOffsetY &&
      at470.twilight.midTransitionOffsetY > at470.twilight.farTransitionOffsetY,
    'Incoming Twilight biome at 470m must have Near emergence offset > Mid > Far'
  );
  assert.ok(
    at1070.abyss.nearTransitionOffsetY > at1070.abyss.midTransitionOffsetY &&
      at1070.abyss.midTransitionOffsetY > at1070.abyss.farTransitionOffsetY,
    'Incoming Abyss biome at 1070m must have Near emergence offset > Mid > Far'
  );

  prev = computeParallaxBiomeTransitionState(0);
  for (let d = 0; d <= 2000; d += 5) {
    const cur = computeParallaxBiomeTransitionState(d);

    // Verify smooth step-to-step C1 continuity (zero abrupt jumps per 5m step)
    assert.ok(
      Math.abs(cur.shallow.nearAlpha - prev.shallow.nearAlpha) < 0.045 &&
        Math.abs(cur.twilight.nearAlpha - prev.twilight.nearAlpha) < 0.045 &&
        Math.abs(cur.abyss.nearAlpha - prev.abyss.nearAlpha) < 0.045 &&
        Math.abs(cur.particleTwilightWeight - prev.particleTwilightWeight) < 0.035,
      `Transition state jumped too abruptly between ${d - 5}m and ${d}m`
    );
    prev = cur;
  }
});

test('ProceduralOceanWorldSystem (8-Module Architecture): L0 Macro Zones, L1 Continuous Chunk Boundaries, L2 Cave SDF, L3 Poisson Disk Clusters, and 6 Environmental Fields', () => {
  const sys = new ProceduralOceanWorldSystem(20261110);

  // 1. Six Continuous Environmental Fields & Probability Functions (WorldGenerator & BiomeManager)
  const shallowEnv = sys.biomeManager.sampleEnvironmentFields(420, 120);
  const abyssEnv = sys.biomeManager.sampleEnvironmentFields(420, 1480);

  assert.ok(shallowEnv.light > 0.65 && abyssEnv.light < 0.08, 'Light field must attenuate with depth');
  assert.ok(shallowEnv.slope >= 0 && shallowEnv.slope <= 1, 'Slope field must be normalized in [0, 1]');
  assert.ok(
    sys.worldGenerator.coralProbability(shallowEnv) >
      sys.worldGenerator.coralProbability(abyssEnv),
    'Coral probability must be significantly higher in sunlit shallow reef than in dark abyss'
  );
  assert.ok(
    sys.worldGenerator.biolumProbability(abyssEnv) >
      sys.worldGenerator.biolumProbability(shallowEnv),
    'Bioluminescent flora probability must be higher in deep ocean than in shallow sunlit reef'
  );

  // 2. Chunk Boundary Continuity (Chunk 12 right edge === Chunk 13 left edge)
  const chunk12 = sys.chunkManager.getOrGenerateChunk(12, 260, 1000);
  const chunk13 = sys.chunkManager.getOrGenerateChunk(13, 260, 1000);
  assert.equal(chunk12.endX, chunk13.startX, 'Adjacent chunks must share exact boundary coordinate');
  const h12Right = chunk12.heightSamples[chunk12.heightSamples.length - 1];
  const h13Left = chunk13.heightSamples[0];
  assert.ok(
    Math.abs(h12Right - h13Left) < 1e-6,
    `Chunk 12 right edge height (${h12Right}) must equal Chunk 13 left edge height (${h13Left})`
  );

  // 3. Poisson Disk Sampling + Cluster minimum spacing invariant (EcologyGenerator)
  const testCluster = chunk12.clusters[0] ?? {
    id: 'test_coral_cluster',
    center: { x: 1200, y: 180 },
    radius: 320,
    type: 'coral_reef' as const,
    density: 0.75,
    seed: 2381,
    biome: 'SHALLOW_CORAL_REEF' as const,
    preferredPreyArchetype: 'REEF_SWARM' as const,
  };
  const minDist = 42;
  const poissonPts = sys.ecologyGenerator.samplePoissonDiskInCluster(testCluster, minDist, 10);
  assert.ok(poissonPts.length >= 3, 'Poisson Disk sampler must generate multiple points in cluster');
  for (let i = 0; i < poissonPts.length; i++) {
    for (let j = i + 1; j < poissonPts.length; j++) {
      const dist = Math.hypot(poissonPts[i].x - poissonPts[j].x, poissonPts[i].y - poissonPts[j].y);
      assert.ok(
        dist >= minDist - 1e-4,
        `Poisson Disk samples (${i}, ${j}) violated minimum spacing: ${dist.toFixed(2)} < ${minDist}`
      );
    }
  }

  // 4. Macro Exploration Pacing & State Tracking (BiomeManager, ChunkManager, WorldStateManager)
  for (let x = 0; x <= 12000; x += 900) {
    const step = sys.stepExploration(x, 220, x);
    assert.equal(step.activeChunks.length, sys.chunkManager.preloadRadiusChunks * 2 + 1);
    assert.ok(step.terrainModulation.nearSeabedOffsetPx >= 0);
  }
  const serialized = sys.worldStateManager.serialize();
  assert.ok(
    serialized.discoveredBiomes.length >= 2,
    'Horizontal exploration across 12,000m must traverse multiple macro exploration zones'
  );
});

import {
  WorldConfig,
  type WorldConfigType,
  validateWorldConfig,
  worldToChunkCoord,
  getChunkBounds,
  isPointInChunkBounds,
  formatChunkId,
  parseChunkId,
  clampWorldDepth,
  getVisibleChunkRange,
  meterDepthToWorldY,
  worldYToMeterDepth,
  engineCoordToWorldCoord,
  worldCoordToEngineCoord,
  worldDebug,
  getWorldDebugEnabled,
  setWorldDebugEnabled,
  WorldSeedService,
  createChunkRng,
  createStableId,
  TERRAIN_MAX_SLOPE,
  evalRidgedTerrainWave,
  evalSandyPlainFactor,
  getTerrainCacheStats,
  getFloorDepthAt,
  getTerrainSlopeAt,
  getTerrainSamples,
  getEngineFloorDepthAt,
  sampleSeabedAnchorAt,
  getShallowCoralAtollAt,
  getShallowCoralAtollOutcropsForChunk,
  resolveSeabedCollision,
  resolveSeabedKineticStep,
  BIOME_IDS,
  DEPTH_BAND_CONFIGS,
  getMacroBiomeForIndex,
  getDepthBandAt,
  getBiomeAt,
  getDepthVisualProfile,
  biomeGenerator,
  ECOLOGY_OBJECT_CONFIGS,
  POI_CONFIGS,
  POI_TYPES,
  generateEcology,
  generatePOIs,
  getOverlappingPOIsForChunk,
  generateChunk,
  poiGenerator,
  chunkGenerator,
  isValidChunkStateTransition,
  transitionChunkState,
  WorldObjectPool,
  getDesiredChunkWindow,
  ChunkLifecycleManager,
  PerformanceDegradationController,
  PERFORMANCE_DEGRADATION_ORDER,
  WorldPersistence,
  WorldAssetRegistry,
  PARALLAX_LAYER_FACTORS,
  type ChunkLifecycleRecord,
  type ChunkLifecycleState,
  type EcologyObjectType,
  type GeneratedObject,
  type GeneratedPOI,
} from './worldGenerationSystem';

test('v1.0 Spec Stage A (#1): 2D Chunk positive/negative coordinates, Math.floor indexing, and half-open [start, end) bounds uniqueness', () => {
  // Default Chunk size: width = 3000, height = 1500
  assert.equal(WorldConfig.chunk.width, 3000);
  assert.equal(WorldConfig.chunk.height, 1500);
  assert.equal(WorldConfig.bounds.minDepth, 0);
  assert.equal(WorldConfig.bounds.maxDepth, 20000);

  // 1. Origin and positive coordinates
  assert.deepEqual(worldToChunkCoord(0, 0), { chunkX: 0, chunkY: 0, chunkId: '0:0' });
  assert.deepEqual(worldToChunkCoord(2999.999, 1499.999), { chunkX: 0, chunkY: 0, chunkId: '0:0' });
  // Right/bottom boundary belongs to the NEXT chunk due to half-open [start, end)
  assert.deepEqual(worldToChunkCoord(3000, 1500), { chunkX: 1, chunkY: 1, chunkId: '1:1' });

  // 2. Negative coordinates MUST use Math.floor
  assert.deepEqual(worldToChunkCoord(-0.001, 0), { chunkX: -1, chunkY: 0, chunkId: '-1:0' });
  assert.deepEqual(worldToChunkCoord(-3000, 0), { chunkX: -1, chunkY: 0, chunkId: '-1:0' });
  assert.deepEqual(worldToChunkCoord(-3000.001, 0), { chunkX: -2, chunkY: 0, chunkId: '-2:0' });
  assert.deepEqual(worldToChunkCoord(-6000, 4500), { chunkX: -2, chunkY: 3, chunkId: '-2:3' });

  // 3. Half-open interval [startX, endX) and [startY, endY) uniqueness across adjacent chunks
  const bNeg1 = getChunkBounds(-1, 0);
  const bZero = getChunkBounds(0, 0);
  const bPos1 = getChunkBounds(1, 0);

  assert.equal(bNeg1.startX, -3000);
  assert.equal(bNeg1.endX, 0);
  assert.equal(bZero.startX, 0);
  assert.equal(bZero.endX, 3000);
  assert.equal(bPos1.startX, 3000);
  assert.equal(bPos1.endX, 6000);

  // Boundary point X = 0 belongs ONLY to Chunk 0:0, NOT Chunk -1:0
  assert.equal(isPointInChunkBounds(0, 500, bNeg1), false);
  assert.equal(isPointInChunkBounds(0, 500, bZero), true);

  // Boundary point X = 3000 belongs ONLY to Chunk 1:0, NOT Chunk 0:0
  assert.equal(isPointInChunkBounds(3000, 500, bZero), false);
  assert.equal(isPointInChunkBounds(3000, 500, bPos1), true);

  // Boundary point X = -3000 belongs to Chunk -1:0
  assert.equal(isPointInChunkBounds(-3000, 500, bNeg1), true);

  // 4. chunkId formatting & parsing round-trip (including negative indices and -0 normalization)
  assert.equal(formatChunkId(-0, -0), '0:0');
  assert.deepEqual(parseChunkId('-3:12'), { chunkX: -3, chunkY: 12 });
  assert.throws(() => parseChunkId('invalid_id'), /Invalid chunkId format/);
  assert.throws(() => parseChunkId('1.5:2'), /Non-integer coordinates/);

  // 5. Depth clamping & visible 2D Chunk range
  assert.equal(clampWorldDepth(-500), 0);
  assert.equal(clampWorldDepth(12345), 12345);
  assert.equal(clampWorldDepth(35000), 20000);

  const vis = getVisibleChunkRange({ x: -1500, y: 1200, width: 5000, height: 2000 });
  assert.equal(vis.minChunkX, -1);
  assert.equal(vis.maxChunkX, 1);
  assert.equal(vis.minChunkY, 0);
  assert.equal(vis.maxChunkY, 2);
  assert.equal(vis.chunkCoords.length, 3 * 3);

  // 6. Adapter layer lossless round-trip (1m = 1 worldPx, 0m ~ 20000m)
  assert.equal(meterDepthToWorldY(520), 520);
  assert.equal(worldYToMeterDepth(11500), 11500);
  const wCoord = engineCoordToWorldCoord(-320, 1480);
  assert.deepEqual(wCoord, { worldX: -320, worldY: 1480 });
  assert.deepEqual(worldCoordToEngineCoord(wCoord.worldX, wCoord.worldY), {
    engineX: -320,
    engineY: 1480,
  });

  // 7. WorldDebug default off & toggle state
  assert.equal(getWorldDebugEnabled(), false);
  setWorldDebugEnabled(true);
  assert.equal(worldDebug.isEnabled(), true);
  setWorldDebugEnabled(false);
  assert.equal(worldDebug.isEnabled(), false);
});

test('v1.0 Spec Stage A (#2): validateWorldConfig rejects illegal configuration values with clear errors', () => {
  // Default config must pass
  assert.equal(validateWorldConfig(WorldConfig), true);

  const cloneConfig = (): WorldConfigType =>
    JSON.parse(JSON.stringify(WorldConfig)) as WorldConfigType;

  // Illegal generatorVersion
  assert.throws(() => {
    const c = cloneConfig();
    c.generatorVersion = 0;
    validateWorldConfig(c);
  }, /generatorVersion/);

  // Illegal bounds (minDepth < 0 or maxDepth <= minDepth)
  assert.throws(() => {
    const c = cloneConfig();
    c.bounds.minDepth = -10;
    validateWorldConfig(c);
  }, /bounds\.minDepth/);

  assert.throws(() => {
    const c = cloneConfig();
    c.bounds.maxDepth = 0;
    validateWorldConfig(c);
  }, /bounds\.maxDepth/);

  // Illegal chunk dimensions
  assert.throws(() => {
    const c = cloneConfig();
    c.chunk.width = -3000;
    validateWorldConfig(c);
  }, /chunk\.width/);

  assert.throws(() => {
    const c = cloneConfig();
    c.chunk.height = 0;
    validateWorldConfig(c);
  }, /chunk\.height/);

  // Illegal biome transitionWidth >= macroWidth
  assert.throws(() => {
    const c = cloneConfig();
    c.biome.transitionWidth = c.biome.macroWidth;
    validateWorldConfig(c);
  }, /biome\.transitionWidth/);

  // Illegal terrain sampleStepX not dividing chunk.width or invalid floor depths
  assert.throws(() => {
    const c = cloneConfig();
    c.terrain.sampleStepX = 137;
    validateWorldConfig(c);
  }, /chunk\.width must be an exact multiple of terrain\.sampleStepX/);

  assert.throws(() => {
    const c = cloneConfig();
    c.terrain.minFloorDepth = 19500;
    c.terrain.maxFloorDepth = 19200;
    validateWorldConfig(c);
  }, /terrain\.minFloorDepth/);

  // Illegal performance budget / cache limits
  assert.throws(() => {
    const c = cloneConfig();
    c.performance.generationBudgetMsPerFrame = 0;
    validateWorldConfig(c);
  }, /generationBudgetMsPerFrame/);

  assert.throws(() => {
    const c = cloneConfig();
    c.performance.maxCachedChunkRecords = 0;
    validateWorldConfig(c);
  }, /maxCachedChunkRecords/);
});

test('v1.0 Spec Stage B (#3): Seed reproducibility and stable ID determinism across access orders', () => {
  const seedA = 123456789;
  const seedB = 987654321;
  const rng1 = createChunkRng(seedA, 1, -4, 7, 'terrain');
  const rng2 = createChunkRng(seedA, 1, -4, 7, 'terrain');
  const rngDiffSeed = createChunkRng(seedB, 1, -4, 7, 'terrain');
  const rngDiffVersion = createChunkRng(seedA, 2, -4, 7, 'terrain');
  const rngDiffChunk = createChunkRng(seedA, 1, -3, 7, 'terrain');

  const seq1 = Array.from({ length: 16 }, () => rng1());
  const seq2 = Array.from({ length: 16 }, () => rng2());
  const seqDiffSeed = Array.from({ length: 16 }, () => rngDiffSeed());
  const seqDiffVer = Array.from({ length: 16 }, () => rngDiffVersion());
  const seqDiffChunk = Array.from({ length: 16 }, () => rngDiffChunk());

  // Identical inputs must yield bit-for-bit identical sequences in [0, 1)
  assert.deepEqual(seq1, seq2);
  for (const val of seq1) {
    assert.ok(val >= 0 && val < 1, `RNG output ${val} must be in [0, 1)`);
  }
  assert.notDeepEqual(seq1, seqDiffSeed, 'Different worldSeed must yield different sequence');
  assert.notDeepEqual(seq1, seqDiffVer, 'Different generatorVersion must yield different sequence');
  assert.notDeepEqual(seq1, seqDiffChunk, 'Different chunk coordinate must yield different sequence');

  // Stable ID must be 100% deterministic, independent of call order or intervening calls
  const svc = new WorldSeedService(WorldConfig);
  const idBefore = svc.createStableId('chest', -5, 3, 2);
  // Generate 50 other IDs in between
  for (let i = 0; i < 50; i++) {
    svc.createStableId('coral', i - 25, i % 6, `slot_${i}`);
  }
  const idAfter = svc.createStableId('chest', -5, 3, 2);
  assert.equal(idBefore, idAfter, 'Stable ID must be identical when regenerated at any time');
  assert.equal(
    idBefore,
    createStableId(WorldConfig.worldSeed, WorldConfig.generatorVersion, 'chest', -5, 3, 2)
  );
  assert.notEqual(
    idBefore,
    createStableId(WorldConfig.worldSeed + 1, WorldConfig.generatorVersion, 'chest', -5, 3, 2)
  );
  assert.notEqual(
    idBefore,
    createStableId(WorldConfig.worldSeed, WorldConfig.generatorVersion + 1, 'chest', -5, 3, 2)
  );
});

test('v1.0 Spec Stage B (#4): Subsystem RNG isolation (consuming fauna never alters poi, terrain, flora, or ambient)', () => {
  const seed = WorldConfig.worldSeed;
  const ver = WorldConfig.generatorVersion;
  const cx = 8;
  const cy = 4;

  // Baseline POI and Terrain sequences without touching fauna
  const poiBaselineRng = createChunkRng(seed, ver, cx, cy, 'poi');
  const terrainBaselineRng = createChunkRng(seed, ver, cx, cy, 'terrain');
  const poiBaseline = Array.from({ length: 20 }, () => poiBaselineRng());
  const terrainBaseline = Array.from({ length: 20 }, () => terrainBaselineRng());

  // Now create fauna, flora, ambient, poi, and terrain streams and draw heavily from fauna/flora/ambient
  const faunaRng = createChunkRng(seed, ver, cx, cy, 'fauna');
  const floraRng = createChunkRng(seed, ver, cx, cy, 'flora');
  const ambientRng = createChunkRng(seed, ver, cx, cy, 'ambient');
  const poiAfterRng = createChunkRng(seed, ver, cx, cy, 'poi');
  const terrainAfterRng = createChunkRng(seed, ver, cx, cy, 'terrain');

  const faunaSamples: number[] = [];
  for (let i = 0; i < 500; i++) {
    faunaSamples.push(faunaRng());
    floraRng();
    ambientRng();
  }

  const poiAfter = Array.from({ length: 20 }, () => poiAfterRng());
  const terrainAfter = Array.from({ length: 20 }, () => terrainAfterRng());

  assert.deepEqual(
    poiBaseline,
    poiAfter,
    'Consuming fauna/flora/ambient RNG streams must have zero impact on poi RNG stream'
  );
  assert.deepEqual(
    terrainBaseline,
    terrainAfter,
    'Consuming fauna/flora/ambient RNG streams must have zero impact on terrain RNG stream'
  );
  assert.notDeepEqual(
    poiBaseline,
    faunaSamples.slice(0, 20),
    'Distinct subsystem keys on the same chunk must produce distinct RNG sequences'
  );
});

test('v1.0 Spec Stage B (#5): Terrain Chunk seam consistency (last sample of chunkX === first sample of chunkX + 1 in any order)', () => {
  // Query chunks in a shuffled non-sequential order to prove zero order dependency
  const chunkIndices = [0, -1, 5, -8, 12, -12, 3, -4, 1, 2, -2, -3, 4, 6, -7, -6];
  const sampleMap = new Map<number, ReturnType<typeof getTerrainSamples>>();
  for (const cx of chunkIndices) {
    sampleMap.set(cx, getTerrainSamples(cx, WorldConfig));
  }

  for (let cx = -12; cx <= 12; cx++) {
    const leftChunk = sampleMap.get(cx) ?? getTerrainSamples(cx, WorldConfig);
    const rightChunk = sampleMap.get(cx + 1) ?? getTerrainSamples(cx + 1, WorldConfig);

    assert.equal(
      leftChunk.endX,
      rightChunk.startX,
      `Chunk ${cx} endX (${leftChunk.endX}) must equal Chunk ${cx + 1} startX (${rightChunk.startX})`
    );
    const leftLastPt = leftChunk.points[leftChunk.points.length - 1];
    const rightFirstPt = rightChunk.points[0];

    assert.equal(leftLastPt.worldX, rightFirstPt.worldX);
    assert.equal(
      leftLastPt.floorY,
      rightFirstPt.floorY,
      `Seam mismatch between Chunk ${cx} right edge (${leftLastPt.floorY}) and Chunk ${cx + 1} left edge (${rightFirstPt.floorY})`
    );
    assert.equal(
      leftLastPt.floorY,
      getFloorDepthAt(leftChunk.endX, WorldConfig),
      'Chunk boundary sample must exactly match getFloorDepthAt(endX)'
    );
  }
});

test('v1.0 Spec Stage B (#6): Terrain depth clamp (getFloorDepthAt always stays within [minFloorDepth, maxFloorDepth])', () => {
  // 1. Default WorldConfig across wide positive and negative coordinates (including fractional X)
  for (let x = -120000; x <= 120000; x += 237.5) {
    const fy = getFloorDepthAt(x, WorldConfig);
    assert.ok(
      fy >= WorldConfig.terrain.minFloorDepth && fy <= WorldConfig.terrain.maxFloorDepth,
      `floorY(${x}) = ${fy} violated [${WorldConfig.terrain.minFloorDepth}, ${WorldConfig.terrain.maxFloorDepth}]`
    );
  }

  // 2. Extreme wave amplitudes that exceed min/max floor bounds must still be strictly clamped
  const extremeConfig: WorldConfigType = {
    ...WorldConfig,
    terrain: {
      ...WorldConfig.terrain,
      baseFloorDepth: 14000,
      largeWaveAmplitude: 50000,
      mediumWaveAmplitude: 25000,
      smallWaveAmplitude: 12000,
      minFloorDepth: 800,
      maxFloorDepth: 19800,
    },
  };
  for (let x = -60000; x <= 60000; x += 311.25) {
    const fy = getFloorDepthAt(x, extremeConfig);
    assert.ok(
      fy >= extremeConfig.terrain.minFloorDepth && fy <= extremeConfig.terrain.maxFloorDepth,
      `Extreme config floorY(${x}) = ${fy} violated [${extremeConfig.terrain.minFloorDepth}, ${extremeConfig.terrain.maxFloorDepth}]`
    );
  }
});

test('v1.0 Spec Stage B (#7): Slope limit enforcement and single source of truth for seabed render, collision, and anchor sampling', () => {
  // 1. Verify |s[i+1] - s[i]| / sampleStepX <= TERRAIN_MAX_SLOPE across chunks [-10..10]
  for (let cx = -10; cx <= 10; cx++) {
    const samples = getTerrainSamples(cx, WorldConfig);
    assert.equal(samples.points.length, WorldConfig.chunk.width / WorldConfig.terrain.sampleStepX + 1);
    assert.ok(
      samples.maxAbsSlope <= TERRAIN_MAX_SLOPE + 1e-9,
      `Chunk ${cx} maxAbsSlope (${samples.maxAbsSlope}) exceeded TERRAIN_MAX_SLOPE (${TERRAIN_MAX_SLOPE})`
    );
    for (let i = 0; i < samples.points.length - 1; i++) {
      const p0 = samples.points[i];
      const p1 = samples.points[i + 1];
      const stepSlope = Math.abs(p1.floorY - p0.floorY) / samples.sampleStepX;
      assert.ok(
        stepSlope <= TERRAIN_MAX_SLOPE + 1e-9,
        `Step slope at worldX=${p0.worldX} (${stepSlope}) exceeded TERRAIN_MAX_SLOPE (${TERRAIN_MAX_SLOPE})`
      );
      // Midpoint between p0 and p1 must match linear interpolation in getFloorDepthAt
      const midX = (p0.worldX + p1.worldX) * 0.5;
      const expectedMidY = (p0.floorY + p1.floorY) * 0.5;
      assert.ok(
        Math.abs(getFloorDepthAt(midX, WorldConfig) - expectedMidY) < 1e-9,
        'getFloorDepthAt at midpoint must match linear segment of getTerrainSamples'
      );
      assert.ok(
        Math.abs(getTerrainSlopeAt(midX, WorldConfig) - p0.slope) < 1e-9,
        'getTerrainSlopeAt must match segment slope'
      );
    }
  }

  // 2. Verify single source of truth across getFloorDepthAt, getEngineFloorDepthAt, sampleSeabedAnchorAt, and resolveSeabedCollision
  const testEngineX = -425.5;
  const testWorldX = testEngineX;
  const floorWorldY = getFloorDepthAt(testWorldX, WorldConfig);
  const floorEngineY = getEngineFloorDepthAt(testEngineX, WorldConfig);
  assert.ok(Math.abs(floorWorldY - floorEngineY) < 1e-9);

  const anchor = sampleSeabedAnchorAt(testWorldX, -15, WorldConfig);
  assert.equal(anchor.floorY, floorWorldY);
  assert.equal(anchor.anchorY, floorWorldY - 15);
  assert.equal(anchor.slope, getTerrainSlopeAt(testWorldX, WorldConfig));

  // Above seabed: no collision
  const radiusM = 24;
  const aboveCollision = resolveSeabedCollision(testEngineX, floorEngineY - radiusM - 10, radiusM, 45, WorldConfig);
  assert.equal(aboveCollision.collided, false);
  assert.equal(aboveCollision.floorWorldY, floorWorldY);

  // Below seabed: clamped to exact floorEngineY - radiusM
  const belowCollision = resolveSeabedCollision(testEngineX, floorEngineY - radiusM + 18, radiusM, 80, WorldConfig);
  assert.equal(belowCollision.collided, true);
  assert.ok(Math.abs(belowCollision.engineY - (floorEngineY - radiusM)) < 1e-9);
  assert.ok(belowCollision.vy <= 0, 'Downward velocity must be deflected upon seabed collision');
});

test('v1.0 Spec Stage C (#8): Biome reproducibility, macro region determinism (no per-Chunk random lottery), and distinct adjacent macro regions', () => {
  // 1. Exact 5 macro biome IDs (shipwreck is a local POI, not a macro biome)
  assert.deepEqual(BIOME_IDS, [
    'coral_reef',
    'rocky_shelf',
    'open_ocean',
    'underwater_canyon',
    'deep_abyss',
  ]);

  // 2. Macro biome selection is a pure order-independent function of (worldSeed, generatorVersion, macroIndex)
  const macroIndices = [0, -1, 1, 15, -15, 7, 8, -8, -9, 23, -24, 2, -2, 3, 4, 5, 6];
  const recorded = new Map<number, string>();
  for (const m of macroIndices) {
    recorded.set(m, getMacroBiomeForIndex(m, WorldConfig));
  }
  for (let m = -25; m <= 25; m++) {
    const b1 = getMacroBiomeForIndex(m, WorldConfig);
    const b2 = recorded.get(m) ?? getMacroBiomeForIndex(m, WorldConfig);
    assert.equal(b1, b2, `Macro biome at index ${m} must be 100% deterministic across query orders`);
    assert.ok(BIOME_IDS.includes(b1));

    // Adjacent macro indices m and m+1 are guaranteed to have distinct biomes
    const bNext = getMacroBiomeForIndex(m + 1, WorldConfig);
    assert.notEqual(
      b1,
      bNext,
      `Adjacent macro regions ${m} and ${m + 1} must have distinct biomes (both were ${b1})`
    );
  }

  // 3. Chunks inside the core [3000, 27000] of the same macro region (width 30000) share the exact same primaryBiome with blend=0
  for (const m of [-3, -1, 0, 1, 4]) {
    const expectedBiome = getMacroBiomeForIndex(m, WorldConfig);
    const macroStart = m * WorldConfig.biome.macroWidth;
    // Chunks +1 .. +8 inside this macro region lie strictly inside core [3000, 27000]
    for (let localChunkOffset = 1; localChunkOffset <= 8; localChunkOffset++) {
      const sampleX = macroStart + localChunkOffset * WorldConfig.chunk.width + 500;
      const sample = getBiomeAt(sampleX, 3500, WorldConfig);
      assert.equal(sample.macroIndex, m);
      assert.equal(sample.primaryBiome, expectedBiome);
      assert.equal(sample.secondaryBiome, undefined);
      assert.equal(sample.blend, 0);
      assert.equal(sample.weights[expectedBiome], 1);
    }
  }

  // 4. Changing worldSeed or generatorVersion changes the macro sequence
  const altSeedConfig: WorldConfigType = { ...WorldConfig, worldSeed: 999888777 };
  const seqDefault = Array.from({ length: 12 }, (_, i) => getMacroBiomeForIndex(i - 6, WorldConfig));
  const seqAltSeed = Array.from({ length: 12 }, (_, i) => getMacroBiomeForIndex(i - 6, altSeedConfig));
  assert.notDeepEqual(seqDefault, seqAltSeed, 'Different worldSeed must produce a different macro biome sequence');
});

test('v1.0 Spec Stage C (#9): Biome blend 0..1 and C2 continuity across macro boundaries + unified DepthBand & getDepthVisualProfile continuity', () => {
  // 1. Verify horizontal biome blending across [-60000 .. +60000] (spanning 4 macro boundaries at -60k, -30k, 0, +30k, +60k)
  const stepX = 100;
  let prevSample = getBiomeAt(-60000, 4200, WorldConfig);

  for (let x = -60000; x <= 60000; x += stepX) {
    const cur = getBiomeAt(x, 4200, WorldConfig);

    // blend must always be in [0, 1]
    assert.ok(cur.blend >= 0 && cur.blend <= 1, `blend at x=${x} (${cur.blend}) must be in [0, 1]`);

    // weights must be non-negative and sum to 1.0
    let weightSum = 0;
    for (const id of BIOME_IDS) {
      const w = cur.weights[id];
      assert.ok(w >= -1e-9 && w <= 1 + 1e-9, `weight[${id}] at x=${x} out of range: ${w}`);
      weightSum += w;
      // Step-to-step weight change per 100 worldPx across a 6000 worldPx transition band:
      // max derivative of quinticSmoothstep is 1.875 / 6000 * 100 = 0.03125
      const deltaW = Math.abs(w - prevSample.weights[id]);
      assert.ok(
        deltaW <= 0.035,
        `Biome weight[${id}] jumped discontinuously between x=${x - stepX} and x=${x} (delta=${deltaW.toFixed(4)})`
      );
    }
    assert.ok(
      Math.abs(weightSum - 1.0) < 1e-9,
      `Biome weights at x=${x} must sum to 1.0 (got ${weightSum})`
    );

    // Blended parameters (floraDensity, rockDensity, faunaDensity, bioluminescenceBoost) must also vary smoothly without jumps
    assert.ok(
      Math.abs(cur.blendedParams.floraDensity - prevSample.blendedParams.floraDensity) < 0.04 &&
        Math.abs(cur.blendedParams.rockDensity - prevSample.blendedParams.rockDensity) < 0.05 &&
        Math.abs(cur.blendedParams.bioluminescenceBoost - prevSample.blendedParams.bioluminescenceBoost) < 0.03,
      `Blended biome parameters jumped discontinuously at x=${x}`
    );

    prevSample = cur;
  }

  // Exact macro boundary x = 30000 must have equal 0.5 / 0.5 weights between macro 0 and macro 1
  const atBoundary = getBiomeAt(30000, 1000, WorldConfig);
  const b0 = getMacroBiomeForIndex(0, WorldConfig);
  const b1 = getMacroBiomeForIndex(1, WorldConfig);
  assert.ok(Math.abs(atBoundary.weights[b0] - 0.5) < 1e-9);
  assert.ok(Math.abs(atBoundary.weights[b1] - 0.5) < 1e-9);
  assert.ok(Math.abs(atBoundary.blend - 0.5) < 1e-9);

  // 2. Verify all 5 Depth Bands (Epipelagic, Mesopelagic, Bathypelagic, Abyssopelagic, Hadal-like)
  assert.equal(DEPTH_BAND_CONFIGS.length, 5);
  assert.equal(getDepthBandAt(0), 'Epipelagic');
  assert.equal(getDepthBandAt(1999.9), 'Epipelagic');
  assert.equal(getDepthBandAt(2000), 'Mesopelagic');
  assert.equal(getDepthBandAt(5999.9), 'Mesopelagic');
  assert.equal(getDepthBandAt(6000), 'Bathypelagic');
  assert.equal(getDepthBandAt(9999.9), 'Bathypelagic');
  assert.equal(getDepthBandAt(10000), 'Abyssopelagic');
  assert.equal(getDepthBandAt(15999.9), 'Abyssopelagic');
  assert.equal(getDepthBandAt(16000), 'Hadal-like');
  assert.equal(getDepthBandAt(20000), 'Hadal-like');

  // 3. Verify getDepthVisualProfile(depth) continuity & monotonic optical trends across 0..20000
  const surfaceProfile = biomeGenerator.getDepthVisualProfile(0);
  const hadalProfile = biomeGenerator.getDepthVisualProfile(20000);
  assert.equal(surfaceProfile.brightness, 1.0);
  assert.equal(surfaceProfile.lightShaftIntensity, 1.0);
  assert.equal(surfaceProfile.bioluminescenceRatio, 0.0);
  assert.ok(hadalProfile.brightness <= 0.05);
  assert.equal(hadalProfile.lightShaftIntensity, 0.0);
  assert.ok(hadalProfile.bioluminescenceRatio >= 0.95);
  assert.ok(surfaceProfile.visibilityDistance > hadalProfile.visibilityDistance);

  let prevProf = getDepthVisualProfile(0, WorldConfig);
  for (let d = 50; d <= 20000; d += 50) {
    const curProf = getDepthVisualProfile(d, WorldConfig);
    assert.ok(curProf.brightness <= prevProf.brightness + 1e-9, `Brightness must decrease monotonically at d=${d}`);
    assert.ok(
      curProf.lightShaftIntensity <= prevProf.lightShaftIntensity + 1e-9,
      `Light shaft intensity must decrease monotonically at d=${d}`
    );
    assert.ok(
      curProf.bioluminescenceRatio >= prevProf.bioluminescenceRatio - 1e-9,
      `Bioluminescence ratio must increase monotonically at d=${d}`
    );
    assert.ok(
      curProf.visibilityDistance <= prevProf.visibilityDistance + 1e-9,
      `Visibility distance must decrease monotonically at d=${d}`
    );
    // Step-to-step continuity check (no jumps at 2000, 6000, 10000, 16000 band boundaries)
    assert.ok(
      Math.abs(curProf.brightness - prevProf.brightness) < 0.025 &&
        Math.abs(curProf.lightShaftIntensity - prevProf.lightShaftIntensity) < 0.035 &&
        Math.abs(curProf.bioluminescenceRatio - prevProf.bioluminescenceRatio) < 0.025,
      `DepthVisualProfile jumped discontinuously at depth ${d}`
    );
    prevProf = curProf;
  }
});

test('v1.0 Spec Stage D (#10): Ecology filtering (depth range, Biome whitelist, seabed distance, half-open Chunk bounds, and cross-Chunk minimum spacing)', () => {
  // 1. Verify all 13 required Section 7 object types + 2 POI types are configured with complete metadata
  const requiredTypes: readonly EcologyObjectType[] = [
    'coral',
    'rock',
    'seagrass',
    'fish_school',
    'jellyfish',
    'biolum_organism',
    'shipwreck_debris',
    'bubble_stream',
    'plankton_mote',
    'marine_snow',
    'cave',
    'treasure',
    'landmark',
    'shipwreck',
    'rare_creature_nest',
  ];
  for (const t of requiredTypes) {
    const cfg = ECOLOGY_OBJECT_CONFIGS[t];
    assert.ok(cfg, `Missing ECOLOGY_OBJECT_CONFIGS entry for "${t}"`);
    assert.equal(cfg.type, t);
    assert.ok(cfg.allowedBiomes.length >= 1, `${t} must have at least 1 allowed Biome`);
    assert.ok(cfg.minDepth >= 0 && cfg.maxDepth > cfg.minDepth && cfg.maxDepth <= WorldConfig.bounds.maxDepth);
    assert.ok(cfg.spawnWeight > 0);
    assert.ok(cfg.minSpacing >= WorldConfig.generation.minObjectSpacing);
    assert.ok(cfg.assetKey.length > 0);
  }

  // 2. Scan a multi-macro, multi-depth grid of Chunks (covering shallow, midwater, and seabed Chunks)
  const testChunkXList = [-11, -10, -1, 0, 1, 2, 9, 10, 11, 20];
  let totalGeneratedEcologyCount = 0;
  let totalFloraCount = 0;
  let totalFaunaCount = 0;
  let totalAmbientCount = 0;

  for (const cx of testChunkXList) {
    const midFloorY = getFloorDepthAt((cx + 0.5) * WorldConfig.chunk.width, WorldConfig);
    const seabedChunkY = Math.floor(midFloorY / WorldConfig.chunk.height);
    const chunkYList = Array.from(new Set([0, 2, 5, Math.max(0, seabedChunkY - 1), seabedChunkY]));

    for (const cy of chunkYList) {
      const chunk = generateChunk(cx, cy, WorldConfig);
      const bounds = chunk.bounds;

      for (const obj of chunk.ecologyObjects) {
        totalGeneratedEcologyCount++;
        const cfg = ECOLOGY_OBJECT_CONFIGS[obj.type as EcologyObjectType];
        assert.ok(cfg, `Unknown ecology object type "${obj.type}"`);
        if (cfg.subsystemKey === 'flora') totalFloraCount++;
        if (cfg.subsystemKey === 'fauna') totalFaunaCount++;
        if (cfg.subsystemKey === 'ambient') totalAmbientCount++;

        // Rule A: Object must strictly lie inside its owning Chunk's half-open bounds [startX, endX) x [startY, endY)
        assert.equal(obj.chunkX, cx);
        assert.equal(obj.chunkY, cy);
        assert.equal(
          isPointInChunkBounds(obj.worldX, obj.worldY, bounds),
          true,
          `Object ${obj.id} at (${obj.worldX}, ${obj.worldY}) fell outside Chunk ${chunk.chunkId} bounds`
        );

        // Rule B: Object depth must satisfy [cfg.minDepth, cfg.maxDepth] and never fall below seabed floorY(x)
        const floorY = getFloorDepthAt(obj.worldX, WorldConfig);
        assert.ok(
          obj.worldY >= cfg.minDepth && obj.worldY <= cfg.maxDepth,
          `Object ${obj.type} at worldY=${obj.worldY} violated depth range [${cfg.minDepth}, ${cfg.maxDepth}]`
        );
        assert.ok(
          obj.worldY <= floorY,
          `Object ${obj.id} (${obj.type}) spawned below seabed: worldY=${obj.worldY} > floorY=${floorY}`
        );

        // Rule C: Object biomeId must match getBiomeAt(worldX, worldY).primaryBiome and be in cfg.allowedBiomes
        const localBiome = getBiomeAt(obj.worldX, obj.worldY, WorldConfig);
        assert.equal(obj.biomeId, localBiome.primaryBiome);
        assert.ok(
          cfg.allowedBiomes.includes(obj.biomeId as (typeof BIOME_IDS)[number]),
          `Object ${obj.type} spawned in disallowed biome "${obj.biomeId}" (allowed: ${cfg.allowedBiomes.join(',')})`
        );

        // Rule D: Seabed placement constraint (floor_anchored vs near_floor vs water_column)
        const distToFloor = floorY - obj.worldY;
        if (cfg.seabedConstraint === 'floor_anchored') {
          assert.ok(
            distToFloor >= 0 && distToFloor <= cfg.maxDistanceToFloor,
            `Floor-anchored ${obj.type} too far from seabed: distToFloor=${distToFloor} > ${cfg.maxDistanceToFloor}`
          );
        } else if (cfg.seabedConstraint === 'near_floor') {
          assert.ok(
            distToFloor >= 10 && distToFloor <= cfg.maxDistanceToFloor,
            `Near-floor ${obj.type} out of floor offset band: distToFloor=${distToFloor}`
          );
        } else {
          assert.ok(
            distToFloor >= 120,
            `Water-column ${obj.type} spawned too close to seabed: distToFloor=${distToFloor} < 120`
          );
        }
      }
    }
  }

  assert.ok(totalGeneratedEcologyCount >= 80, `Expected rich ecology generation, got ${totalGeneratedEcologyCount}`);
  assert.ok(totalFloraCount >= 10, 'Expected seabed flora/rock objects to be generated');
  assert.ok(totalFaunaCount >= 20, 'Expected water-column fauna spawners to be generated');
  assert.ok(totalAmbientCount >= 20, 'Expected ambient particles/bubbles to be generated');

  // 3. Verify intra-Chunk and cross-Chunk minimum spacing within each subsystem across adjacent Chunks
  for (let cx = -2; cx <= 2; cx++) {
    const floorY = getFloorDepthAt((cx + 0.5) * WorldConfig.chunk.width, WorldConfig);
    const cy = Math.floor(floorY / WorldConfig.chunk.height);
    const curChunk = generateChunk(cx, cy, WorldConfig);
    const rightChunk = generateChunk(cx + 1, cy, WorldConfig);
    const combined = [...curChunk.ecologyObjects, ...rightChunk.ecologyObjects];

    for (let i = 0; i < combined.length; i++) {
      for (let j = i + 1; j < combined.length; j++) {
        const a = combined[i];
        const b = combined[j];
        const cfgA = ECOLOGY_OBJECT_CONFIGS[a.type as EcologyObjectType];
        const cfgB = ECOLOGY_OBJECT_CONFIGS[b.type as EcologyObjectType];
        if (cfgA.subsystemKey !== cfgB.subsystemKey) continue;
        const reqSpacing = Math.max(
          WorldConfig.generation.minObjectSpacing,
          cfgA.minSpacing,
          cfgB.minSpacing
        );
        const dist = Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);
        assert.ok(
          dist >= reqSpacing - 1e-4,
          `Subsystem "${cfgA.subsystemKey}" spacing violation between ${a.id} and ${b.id}: dist=${dist.toFixed(2)} < ${reqSpacing}`
        );
      }
    }
  }
});

test('v1.0 Spec Stage D (#11): Object ID stability, 11-step deterministic pipeline, and order-independent Chunk regeneration', () => {
  // 1. Generate a target 3x2 neighborhood in forward order vs reverse/shuffled order
  const coords: Array<[number, number]> = [
    [-2, 0],
    [-1, 0],
    [0, 0],
    [0, 9],
    [1, 9],
    [2, 9],
  ];

  const forwardMap = new Map<string, ReturnType<typeof generateChunk>>();
  for (const [cx, cy] of coords) {
    forwardMap.set(`${cx}:${cy}`, chunkGenerator.generateChunk(cx, cy));
  }

  // Interleave with unrelated RNG calls and reverse coordinate order
  for (let k = 0; k < 40; k++) {
    createChunkRng(WorldConfig.worldSeed, WorldConfig.generatorVersion, k, k, 'fauna')();
  }

  const reversedCoords = [...coords].reverse();
  for (const [cx, cy] of reversedCoords) {
    const again = generateChunk(cx, cy, WorldConfig);
    const baseline = forwardMap.get(`${cx}:${cy}`)!;
    assert.deepEqual(
      again.objects,
      baseline.objects,
      `Chunk ${cx}:${cy} objects must be 100% identical regardless of generation order`
    );
    assert.deepEqual(
      again.pois,
      baseline.pois,
      `Chunk ${cx}:${cy} POIs must be 100% identical regardless of generation order`
    );

    // Every object ID within the Chunk must be unique and deterministically match createStableId
    const seenIds = new Set<string>();
    for (const obj of again.objects) {
      assert.equal(seenIds.has(obj.id), false, `Duplicate object ID ${obj.id} in Chunk ${cx}:${cy}`);
      seenIds.add(obj.id);
      const expectedId = createStableId(
        WorldConfig.worldSeed,
        WorldConfig.generatorVersion,
        obj.type,
        obj.chunkX,
        obj.chunkY,
        obj.seedKey
      );
      assert.equal(obj.id, expectedId, `Object ID ${obj.id} did not match createStableId (${expectedId})`);
    }
  }
});

test('v1.0 Spec Stage D (#12): POI cross-Chunk uniqueness (max 1 POI/Chunk, single ownerChunkId, footprint non-overlap, and cross-Chunk overlappingPOIs reference)', () => {
  // 1. Verify all 5 required first-edition POI types are configured
  assert.deepEqual(POI_TYPES, [
    'shipwreck',
    'cave',
    'treasure',
    'rare_creature_nest',
    'landmark',
  ]);
  for (const pt of POI_TYPES) {
    const pCfg = POI_CONFIGS[pt];
    assert.ok(pCfg.footprintRadius >= 200);
    assert.ok(pCfg.minPOISpacing >= 1500);
    assert.ok(pCfg.assetKey.length > 0);
  }

  // 2. Scan a wide horizontal & vertical range of Chunks: cx in [-30..30], cy in [0..13]
  const allOwnedPois: GeneratedPOI[] = [];
  const poiOwnerCountMap = new Map<string, number>();
  let crossChunkOverlapReferences = 0;

  for (let cx = -30; cx <= 30; cx++) {
    for (let cy = 0; cy <= 13; cy++) {
      const ownedPois = poiGenerator.generatePOIs(cx, cy);
      // Max 1 POI per Chunk
      assert.ok(
        ownedPois.length <= 1,
        `Chunk ${cx}:${cy} owned ${ownedPois.length} POIs (max allowed is 1)`
      );

      if (ownedPois.length === 1) {
        const poi = ownedPois[0];
        const bounds = getChunkBounds(cx, cy, WorldConfig);

        // POI ownerChunkId must match this Chunk and center (worldX, worldY) must lie strictly inside [startX, endX) x [startY, endY)
        assert.equal(poi.ownerChunkX, cx);
        assert.equal(poi.ownerChunkY, cy);
        assert.equal(poi.ownerChunkId, `${cx === 0 ? 0 : cx}:${cy === 0 ? 0 : cy}`);
        assert.equal(
          isPointInChunkBounds(poi.worldX, poi.worldY, bounds),
          true,
          `POI ${poi.id} center (${poi.worldX}, ${poi.worldY}) must lie inside owner Chunk ${poi.ownerChunkId}`
        );

        // Check Biome & Depth constraints
        const pCfg = POI_CONFIGS[poi.type];
        assert.ok(
          poi.worldY >= pCfg.minDepth && poi.worldY <= pCfg.maxDepth,
          `POI ${poi.id} (${poi.type}) depth ${poi.worldY} violated [${pCfg.minDepth}, ${pCfg.maxDepth}]`
        );
        assert.ok(
          pCfg.allowedBiomes.includes(poi.biomeId as (typeof BIOME_IDS)[number]),
          `POI ${poi.id} (${poi.type}) biome ${poi.biomeId} not in allowedBiomes`
        );

        poiOwnerCountMap.set(poi.id, (poiOwnerCountMap.get(poi.id) ?? 0) + 1);
        allOwnedPois.push(poi);
      }

      // Check overlappingPOIs from adjacent Chunks
      const overlapping = getOverlappingPOIsForChunk(cx, cy, WorldConfig);
      for (const ov of overlapping) {
        crossChunkOverlapReferences++;
        assert.notEqual(
          ov.ownerChunkId,
          `${cx === 0 ? 0 : cx}:${cy === 0 ? 0 : cy}`,
          'overlappingPOIs must only contain POIs owned by neighbor Chunks, never self-owned POIs'
        );
        // Verify the neighborChunk actually owns this exact POI with identical ID and coordinates
        const ownerPois = generatePOIs(ov.ownerChunkX, ov.ownerChunkY, WorldConfig);
        assert.equal(ownerPois.length, 1);
        assert.deepEqual(ownerPois[0], ov);
      }
    }
  }

  assert.ok(allOwnedPois.length >= 12, `Expected multiple POIs across [-30..30], got ${allOwnedPois.length}`);
  assert.ok(
    crossChunkOverlapReferences >= 1,
    'Expected at least one POI footprint near a Chunk border to be referenced in neighbor overlappingPOIs'
  );

  // 3. Every POI ID must be owned by EXACTLY ONE Chunk (never duplicated across Chunk borders)
  for (const [poiId, count] of poiOwnerCountMap.entries()) {
    assert.equal(count, 1, `POI ${poiId} was owned by ${count} Chunks (must be strictly 1)`);
  }

  // 4. Verify non-overlapping footprints and minimum POI spacing across all generated POIs
  for (let i = 0; i < allOwnedPois.length; i++) {
    for (let j = i + 1; j < allOwnedPois.length; j++) {
      const a = allOwnedPois[i];
      const b = allOwnedPois[j];
      const dist = Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);
      const minFootprintDist = a.footprintRadius + b.footprintRadius;
      const reqPoiSpacing = Math.max(a.minPOISpacing, b.minPOISpacing);
      assert.ok(
        dist >= minFootprintDist,
        `POI footprint overlap between ${a.id} and ${b.id}: dist=${dist.toFixed(1)} < ${minFootprintDist}`
      );
      assert.ok(
        dist >= reqPoiSpacing,
        `POI minimum spacing violation between ${a.id} and ${b.id}: dist=${dist.toFixed(1)} < ${reqPoiSpacing}`
      );
    }
  }
});

test('v1.0 Spec Stage E (#13): ChunkLifecycleState legal transitions and rejection of illegal state jumps', () => {
  const makeRecord = (initial: ChunkLifecycleState = 'unloaded'): ChunkLifecycleRecord => ({
    chunkX: 2,
    chunkY: 1,
    chunkId: '2:1',
    state: initial,
    stateHistory: [initial],
    data: null,
    activeTaskId: null,
    lastTouchedTick: 0,
    generationDurationMs: 0,
  });

  // 1. Standard full lifecycle: unloaded -> queued -> generating -> ready -> active -> releasing -> unloaded
  const rec = makeRecord('unloaded');
  transitionChunkState(rec, 'queued');
  assert.equal(rec.state, 'queued');
  transitionChunkState(rec, 'generating');
  assert.equal(rec.state, 'generating');
  transitionChunkState(rec, 'ready');
  assert.equal(rec.state, 'ready');
  transitionChunkState(rec, 'active');
  assert.equal(rec.state, 'active');
  transitionChunkState(rec, 'releasing');
  assert.equal(rec.state, 'releasing');
  transitionChunkState(rec, 'unloaded');
  assert.equal(rec.state, 'unloaded');

  // 2. Legal short-circuit paths: queued -> unloaded (cancelled queue), ready -> releasing (evicted before activation), unloaded -> ready (LRU cache hit)
  const recCancel = makeRecord('unloaded');
  transitionChunkState(recCancel, 'queued');
  transitionChunkState(recCancel, 'unloaded');
  assert.equal(recCancel.state, 'unloaded');

  const recReadyRelease = makeRecord('ready');
  transitionChunkState(recReadyRelease, 'releasing');
  transitionChunkState(recReadyRelease, 'unloaded');
  assert.equal(recReadyRelease.state, 'unloaded');

  const recCacheHit = makeRecord('unloaded');
  transitionChunkState(recCacheHit, 'ready');
  assert.equal(recCacheHit.state, 'ready');

  // 3. Illegal state transitions must be rejected and throw explicit errors
  const illegalPairs: Array<[ChunkLifecycleState, ChunkLifecycleState]> = [
    ['unloaded', 'active'],
    ['unloaded', 'generating'],
    ['unloaded', 'releasing'],
    ['queued', 'ready'],
    ['queued', 'active'],
    ['generating', 'active'],
    ['generating', 'unloaded'],
    ['active', 'unloaded'],
    ['active', 'ready'],
    ['releasing', 'active'],
    ['releasing', 'ready'],
  ];

  for (const [fromState, toState] of illegalPairs) {
    assert.equal(
      isValidChunkStateTransition(fromState, toState),
      false,
      `Transition ${fromState} -> ${toState} must be invalid`
    );
    const badRec = makeRecord(fromState);
    assert.throws(
      () => transitionChunkState(badRec, toState),
      /Invalid ChunkLifecycleState transition/,
      `Expected transitionChunkState(${fromState} -> ${toState}) to throw`
    );
  }
});

test('v1.0 Spec Stage E (#14): Directional preload/retain window, vertical buffer constraint, and complete object pool reference sanitization on unload', () => {
  const cameraRect = {
    minWorldX: 0,
    maxWorldX: 2800, // ChunkX = 0
    minWorldY: 3100,
    maxWorldY: 4400, // ChunkY = 2
  };

  // 1. Directional preload/retain checks:
  // Moving right (vx > 5): preloadRight = 4, preloadLeft = 2
  const winRight = getDesiredChunkWindow(cameraRect, 180, WorldConfig);
  assert.equal(winRight.preloadRight, 4);
  assert.equal(winRight.preloadLeft, 2);
  assert.equal(winRight.minWindowChunkX, -2);
  assert.equal(winRight.maxWindowChunkX, 4);

  // Moving left (vx < -5): preloadLeft = 4, preloadRight = 2
  const winLeft = getDesiredChunkWindow(cameraRect, -180, WorldConfig);
  assert.equal(winLeft.preloadLeft, 4);
  assert.equal(winLeft.preloadRight, 2);
  assert.equal(winLeft.minWindowChunkX, -4);
  assert.equal(winLeft.maxWindowChunkX, 2);

  // Stationary (|vx| <= 5): symmetric 3 left, 3 right
  const winIdle = getDesiredChunkWindow(cameraRect, 0, WorldConfig);
  assert.equal(winIdle.preloadLeft, 3);
  assert.equal(winIdle.preloadRight, 3);

  // Vertical buffer: only visible row (2) ± 1 => [1..3], never loading full ocean column [0..13]
  assert.equal(winRight.minWindowChunkY, 1);
  assert.equal(winRight.maxWindowChunkY, 3);

  // 2. Object pool release & unload sanitization (zero strong references to unloaded Chunk data)
  const pool = new WorldObjectPool(300);
  const persistence = new WorldPersistence(WorldConfig);
  const mgr = new ChunkLifecycleManager(WorldConfig, pool, persistence);

  // Update at X = 0..2800 so Chunk 0:2 becomes active and acquires pooled instances
  mgr.updateForViewport(cameraRect, 120, { maxSyncGenerateCount: 16 });
  assert.equal(mgr.getChunkState(0, 2), 'active');
  const activeInstancesAtOrigin = [...pool.getActiveInstancesForChunk('0:2')];
  assert.ok(activeInstancesAtOrigin.length > 0, 'Active Chunk 0:2 must acquire pooled instances');

  // Attach dummy event listener and timer to verify cleanup on release
  let listenerCleanedUp = false;
  activeInstancesAtOrigin[0].eventListeners.push(() => {
    listenerCleanedUp = true;
  });
  activeInstancesAtOrigin[0].timers.push(999);

  // Now move camera far away to ChunkX = 30 (worldX = 90000..92800)
  mgr.updateForViewport(
    {
      minWorldX: 90000,
      maxWorldX: 92800,
      minWorldY: 3100,
      maxWorldY: 4400,
    },
    120,
    { maxSyncGenerateCount: 16 }
  );

  // Chunk 0:2 is now outside the retain window and must be unloaded
  assert.equal(mgr.getChunkState(0, 2), 'unloaded');
  assert.equal(
    pool.getActiveInstancesForChunk('0:2').length,
    0,
    'Unloaded Chunk 0:2 must have zero active instances'
  );
  assert.equal(listenerCleanedUp, true, 'Event listener cleanup callback must run on release');

  // Every released instance returned to the pool must have null chunkId, null sourceDataRef, and reset state
  for (const inst of activeInstancesAtOrigin) {
    if (!inst.active) {
      assert.equal(inst.chunkId, null, 'Released pooled instance must not retain chunkId');
      assert.equal(
        inst.sourceDataRef,
        null,
        'Released pooled instance must not retain strong reference to Chunk data'
      );
      assert.equal(inst.collisionEnabled, false);
      assert.equal(inst.eventListeners.length, 0);
      assert.equal(inst.timers.length, 0);
    }
  }
});

test('v1.0 Spec Stage E (#15) & Stage F: Bounded cache (<= 64), object pool (<= 300/type), queue (<= 32), active chunks (<= 10), and missing asset placeholder fallback', () => {
  const pool = new WorldObjectPool(WorldConfig.performance.maxPooledObjectsPerType);
  const persistence = new WorldPersistence(WorldConfig);
  const mgr = new ChunkLifecycleManager(WorldConfig, pool, persistence);

  // 1. Test Object Pool per-type upper bound (maxPooledObjectsPerType = 300)
  const dummyObj = generateChunk(0, 0, WorldConfig).objects[0];
  const acquired: ReturnType<typeof pool.acquire>[] = [];
  for (let i = 0; i < 420; i++) {
    acquired.push(pool.acquire('eco:kelp_patch', `test:${i}`, dummyObj));
  }
  for (const inst of acquired) {
    pool.release(inst);
  }
  assert.equal(
    pool.getPooledCountForType('eco:kelp_patch'),
    WorldConfig.performance.maxPooledObjectsPerType,
    'Pooled objects per type must never exceed maxPooledObjectsPerType (300)'
  );
  assert.equal(pool.getStats().totalDroppedOverflowCount, 120);

  // 2. Test Queue (<= 32), Active Chunks (<= 10), and Cache (<= 64) across wide sweeps
  for (let step = 0; step < 30; step++) {
    const baseX = step * 9000;
    mgr.updateForViewport(
      {
        minWorldX: baseX,
        maxWorldX: baseX + 5500,
        minWorldY: 1500,
        maxWorldY: 4200,
      },
      220,
      { maxSyncGenerateCount: 4 }
    );
    const stats = mgr.getStats();
    assert.ok(
      stats.activeChunkCount <= WorldConfig.chunk.maxActiveChunks,
      `activeChunkCount (${stats.activeChunkCount}) exceeded maxActiveChunks (${WorldConfig.chunk.maxActiveChunks})`
    );
    assert.ok(
      stats.cachedChunkCount <= WorldConfig.performance.maxCachedChunkRecords,
      `cachedChunkCount (${stats.cachedChunkCount}) exceeded maxCachedChunkRecords (${WorldConfig.performance.maxCachedChunkRecords})`
    );
    assert.ok(
      stats.queueLength <= WorldConfig.performance.maxQueueSize,
      `queueLength (${stats.queueLength}) exceeded maxQueueSize (${WorldConfig.performance.maxQueueSize})`
    );
  }

  // 3. Stage F: WorldAssetRegistry missing asset key fallback without crashing and 5-layer parallax factors
  assert.equal(PARALLAX_LAYER_FACTORS.far_silhouette, 0.08);
  assert.equal(PARALLAX_LAYER_FACTORS.mid_terrain, 0.18);
  assert.equal(PARALLAX_LAYER_FACTORS.sub_mid_shadow, 0.35);
  assert.equal(PARALLAX_LAYER_FACTORS.world_main, 1.0);
  assert.equal(PARALLAX_LAYER_FACTORS.foreground_particles, 1.12);

  const registry = new WorldAssetRegistry();
  const known = registry.getAssetOrPlaceholder('poi_shipwreck_hull', 'poi');
  assert.equal(known.isPlaceholder, false);
  const missing = registry.getAssetOrPlaceholder('non_existent_custom_asset_xyz', 'flora');
  assert.equal(missing.isPlaceholder, true);
  assert.equal(registry.getPlaceholderFallbackCount(), 1);
});

test('v1.0 Spec Stage E (#16): Stale async generation task completing after camera moved away never transitions to active', () => {
  const pool = new WorldObjectPool(300);
  const persistence = new WorldPersistence(WorldConfig);
  const mgr = new ChunkLifecycleManager(WorldConfig, pool, persistence);

  // Camera starts at Chunk 0:1
  mgr.updateForViewport(
    { minWorldX: 100, maxWorldX: 2500, minWorldY: 1600, maxWorldY: 2800 },
    0,
    { maxSyncGenerateCount: 2 }
  );

  // Start an async generation task for Chunk (2, 1)
  const taskId = mgr.startAsyncChunkTask(2, 1);
  assert.equal(mgr.getChunkState(2, 1), 'generating');

  // Before the async task finishes, the player teleports/moves far away to ChunkX = 50 (worldX = 150000)
  mgr.updateForViewport(
    { minWorldX: 150000, maxWorldX: 152500, minWorldY: 1600, maxWorldY: 2800 },
    200,
    { maxSyncGenerateCount: 4 }
  );

  // Now the async task for Chunk (2, 1) completes late!
  const completion = mgr.completeAsyncChunkTask(taskId);
  assert.equal(
    completion.activated,
    false,
    'Stale async task for out-of-range Chunk (2, 1) must NOT be activated'
  );
  assert.equal(
    completion.finalState,
    'unloaded',
    'Stale async task must transition generating -> ready -> releasing -> unloaded'
  );
  assert.equal(mgr.getChunkState(2, 1), 'unloaded');
  assert.equal(
    pool.getActiveInstancesForChunk('2:1').length,
    0,
    'Stale async task must not leak any active pooled instances'
  );
  assert.ok(mgr.getStaleTasksPreventedCount() >= 1);

  // Verify the state history of (2, 1) went through generating -> ready -> releasing -> unloaded without 'active'
  const rec = mgr.getChunkRecord(2, 1);
  if (rec) {
    assert.equal(rec.stateHistory.includes('active'), false);
  }
});

test('v1.0 Spec Stage G (#17): Round-trip exploration reproduces static objects identically from Seed and restores modified POI states via WorldPersistence', () => {
  const pool = new WorldObjectPool(300);
  const persistence = new WorldPersistence(WorldConfig);
  const mgr = new ChunkLifecycleManager(WorldConfig, pool, persistence);

  // Find a Chunk that owns a POI so we can test both static reproduction and POI state persistence
  let targetChunkX = 0;
  let targetChunkY = 1;
  let targetPoiId = '';
  for (let cx = -15; cx <= 15 && !targetPoiId; cx++) {
    for (let cy = 0; cy <= 8 && !targetPoiId; cy++) {
      const c = generateChunk(cx, cy, WorldConfig);
      if (c.pois.length > 0) {
        targetChunkX = cx;
        targetChunkY = cy;
        targetPoiId = c.pois[0].id;
      }
    }
  }
  assert.ok(targetPoiId.length > 0, 'Must locate a Chunk with a generated POI');

  const targetBounds = getChunkBounds(targetChunkX, targetChunkY, WorldConfig);
  const targetCameraRect = {
    minWorldX: targetBounds.startX + 100,
    maxWorldX: targetBounds.endX - 100,
    minWorldY: targetBounds.startY + 100,
    maxWorldY: targetBounds.endY - 100,
  };

  // 1. First visit: activate target Chunk and record baseline static ecology objects
  mgr.updateForViewport(targetCameraRect, 0, { maxSyncGenerateCount: 16 });
  const firstVisitChunk = mgr
    .getActiveChunks()
    .find((c) => c.chunkX === targetChunkX && c.chunkY === targetChunkY);
  assert.ok(firstVisitChunk, 'Target Chunk must be active on first visit');
  assert.equal(firstVisitChunk.pois[0].poiState, 'unvisited');
  assert.equal(firstVisitChunk.pois[0].state?.status, 'unvisited');
  const firstVisitStaticObjects = JSON.parse(
    JSON.stringify(firstVisitChunk.ecologyObjects)
  );

  // Player interacts with the POI and removes one dynamic object
  const removedObjectId = firstVisitChunk.ecologyObjects[0]?.id;
  persistence.setPOIState(targetPoiId, 'depleted', {
    rewardClaimed: true,
    remainingCooldown: 0,
    updatedAt: 1700000000000,
  });
  if (removedObjectId) {
    persistence.setObjectState(removedObjectId, {
      removed: true,
      triggered: true,
      updatedAt: 1700000000000,
    });
  }

  // Save incremental world state (must NOT serialize untouched static objects)
  const savedPayload = persistence.save();
  assert.equal(savedPayload.worldSeed, WorldConfig.worldSeed);
  assert.equal(savedPayload.generatorVersion, WorldConfig.generatorVersion);
  assert.equal(savedPayload.modifiedPOIs[targetPoiId]?.state, 'depleted');
  assert.equal(savedPayload.modifiedPOIs[targetPoiId]?.rewardClaimed, true);

  // 2. Move far away so target Chunk is completely unloaded AND evicted from LRU cache
  for (let step = 1; step <= 25; step++) {
    const farX = (targetChunkX + step * 10) * WorldConfig.chunk.width;
    mgr.updateForViewport(
      {
        minWorldX: farX,
        maxWorldX: farX + 2600,
        minWorldY: 1500,
        maxWorldY: 4200,
      },
      250,
      { maxSyncGenerateCount: 8 }
    );
  }
  assert.equal(mgr.getChunkState(targetChunkX, targetChunkY), 'unloaded');

  // 3. Simulate reload from saved incremental data and return to target Chunk
  const restoredPersistence = new WorldPersistence(WorldConfig);
  restoredPersistence.load(savedPayload);
  const restoredMgr = new ChunkLifecycleManager(WorldConfig, pool, restoredPersistence);

  restoredMgr.updateForViewport(targetCameraRect, 0, { maxSyncGenerateCount: 16 });
  const secondVisitChunk = restoredMgr
    .getActiveChunks()
    .find((c) => c.chunkX === targetChunkX && c.chunkY === targetChunkY);
  assert.ok(secondVisitChunk, 'Target Chunk must be active on return visit');

  // Modified POI must restore 'depleted' state
  assert.equal(
    secondVisitChunk.pois[0].poiState,
    'depleted',
    'Modified POI state must persist across unload and reload'
  );
  assert.equal(secondVisitChunk.pois[0].state?.status, 'depleted');

  // Removed object must stay removed, while all other static objects match 100% identically
  if (removedObjectId) {
    assert.equal(
      secondVisitChunk.ecologyObjects.some((o) => o.id === removedObjectId),
      false,
      'Removed dynamic object must remain removed after reload'
    );
  }
  const expectedRemainingStatic = firstVisitStaticObjects.filter(
    (o: { id: string }) => o.id !== removedObjectId
  );
  assert.deepEqual(
    secondVisitChunk.ecologyObjects,
    expectedRemainingStatic,
    'All unmodified static ecology objects must be 100% identical on round-trip revisit'
  );
});

test('v1.0 Spec Stage G (#18): Long-running exploration stress test (100+ Chunks) maintains bounded memory/pools and enforces 5-step performance degradation order', () => {
  const pool = new WorldObjectPool(WorldConfig.performance.maxPooledObjectsPerType);
  const persistence = new WorldPersistence(WorldConfig);
  const degradation = new PerformanceDegradationController(
    WorldConfig.performance.generationBudgetMsPerFrame
  );
  const mgr = new ChunkLifecycleManager(WorldConfig, pool, persistence, degradation);

  // 1. Verify 5-step degradation order and critical system protection
  assert.deepEqual(PERFORMANCE_DEGRADATION_ORDER, [
    'distant_particles',
    'distant_decorations',
    'background_animations',
    'distant_noncritical_fauna',
    'distant_task_priority',
  ]);
  assert.equal(degradation.canDegradeCriticalSystem('current_view_terrain_collision'), false);
  assert.equal(degradation.canDegradeCriticalSystem('nearby_critical_poi'), false);
  assert.equal(degradation.canDegradeCriticalSystem('chunk_manager_stability'), false);

  degradation.setDegradationStepForTest(2);
  assert.deepEqual(degradation.getActiveDegradations(), [
    'distant_particles',
    'distant_decorations',
  ]);
  degradation.setDegradationStepForTest(0);

  // 2. Simulate continuous long-distance exploration across 120 horizontal Chunks & varying depths
  for (let i = 0; i < 120; i++) {
    const worldX = i * WorldConfig.chunk.width * 0.85;
    const worldY = 800 + Math.abs(Math.sin(i * 0.15)) * 14000;
    const vx = i % 3 === 0 ? -160 : 210;

    mgr.updateForViewport(
      {
        minWorldX: worldX,
        maxWorldX: worldX + 2600,
        minWorldY: worldY,
        maxWorldY: Math.min(WorldConfig.bounds.maxDepth, worldY + 1400),
      },
      vx,
      { maxSyncGenerateCount: 5 }
    );

    const mgrStats = mgr.getStats();
    const poolStats = pool.getStats();

    assert.ok(
      mgrStats.activeChunkCount <= WorldConfig.chunk.maxActiveChunks,
      `Step ${i}: activeChunkCount ${mgrStats.activeChunkCount} > ${WorldConfig.chunk.maxActiveChunks}`
    );
    assert.ok(
      mgrStats.cachedChunkCount <= WorldConfig.performance.maxCachedChunkRecords,
      `Step ${i}: cachedChunkCount ${mgrStats.cachedChunkCount} > ${WorldConfig.performance.maxCachedChunkRecords}`
    );
    assert.ok(
      mgrStats.queueLength <= WorldConfig.performance.maxQueueSize,
      `Step ${i}: queueLength ${mgrStats.queueLength} > ${WorldConfig.performance.maxQueueSize}`
    );
    // Tracked records must remain bounded (never accumulating all 120+ historical Chunks)
    assert.ok(
      mgrStats.trackedRecordCount <=
        WorldConfig.performance.maxCachedChunkRecords + 36,
      `Step ${i}: trackedRecordCount (${mgrStats.trackedRecordCount}) grew unboundedly`
    );
    assert.equal(
      pool.getActiveChunkCountWithInstances(),
      mgrStats.activeChunkCount,
      `Step ${i}: pool active chunk count (${pool.getActiveChunkCountWithInstances()}) must match activeChunkCount (${mgrStats.activeChunkCount})`
    );
    assert.ok(
      poolStats.totalPooledInstances <=
        WorldConfig.performance.maxPooledObjectsPerType * 25,
      `Step ${i}: totalPooledInstances (${poolStats.totalPooledInstances}) exceeded bound`
    );
  }
});

test('Rounded U/V-Folded Waves, Frequent Sandy Plains, Preload Chunk Stability, and Bounded Terrain Caches', () => {
  // 1. Medium wave amplitude is upgraded to 3800m and evalRidgedTerrainWave produces smooth, full-range [-1, 1] U/V folds without sharp cusps
  assert.equal(WorldConfig.terrain.mediumWaveAmplitude, 3800);
  let minRidge = Infinity;
  let maxRidge = -Infinity;
  let maxSecondDerivativePerStep = 0;
  const dx = 25;
  for (let x = -30000; x <= 30000; x += dx) {
    const y0 = evalRidgedTerrainWave(x - dx, 2100, 263, WorldConfig);
    const y1 = evalRidgedTerrainWave(x, 2100, 263, WorldConfig);
    const y2 = evalRidgedTerrainWave(x + dx, 2100, 263, WorldConfig);
    minRidge = Math.min(minRidge, y1);
    maxRidge = Math.max(maxRidge, y1);
    const d2 = Math.abs(y2 - 2 * y1 + y0);
    maxSecondDerivativePerStep = Math.max(maxSecondDerivativePerStep, d2);
  }
  assert.ok(minRidge >= -1.0 && minRidge <= -0.82, `minRidge (${minRidge}) should reach deep trough near -1`);
  assert.ok(maxRidge <= 1.0 && maxRidge >= 0.85, `maxRidge (${maxRidge}) should reach full crest near +1`);
  assert.ok(
    maxSecondDerivativePerStep < 0.015,
    `Second difference (${maxSecondDerivativePerStep}) must be smooth and rounded without sharp V-cusp spikes`
  );

  // 2. Frequent flat sandy plains (evalSandyPlainFactor) and gentle seabed segments (|slope| <= 0.22)
  let plainSampleCount = 0;
  let totalPlainSamples = 0;
  let gentleSlopeStepCount = 0;
  let totalSlopeSteps = 0;

  for (let cx = -25; cx <= 25; cx++) {
    const samples = getTerrainSamples(cx, WorldConfig);
    for (let i = 0; i < samples.points.length - 1; i++) {
      const pt = samples.points[i];
      totalPlainSamples++;
      if (evalSandyPlainFactor(pt.worldX, WorldConfig) >= 0.25) {
        plainSampleCount++;
      }
      totalSlopeSteps++;
      if (pt.absSlope <= 0.22) {
        gentleSlopeStepCount++;
      }
    }
  }

  const plainCoverageRatio = plainSampleCount / totalPlainSamples;
  const gentleSlopeRatio = gentleSlopeStepCount / totalSlopeSteps;
  assert.ok(
    plainCoverageRatio >= 0.30,
    `Sandy plain envelope coverage (${(plainCoverageRatio * 100).toFixed(1)}%) must be >= 30%`
  );
  assert.ok(
    gentleSlopeRatio >= 0.22,
    `Gentle sandy plain seabed steps |slope|<=0.22 (${(gentleSlopeRatio * 100).toFixed(1)}%) must be >= 22%`
  );

  // 3. Preload Chunks (inRetain && !inActive) must not churn through ready -> releasing -> unloaded across 60 consecutive 60FPS frames
  const pool = new WorldObjectPool(WorldConfig.performance.maxPooledObjectsPerType);
  const persistence = new WorldPersistence(WorldConfig);
  const mgr = new ChunkLifecycleManager(
    WorldConfig,
    pool,
    persistence,
    new PerformanceDegradationController(100)
  );
  const viewport = {
    minWorldX: 0,
    maxWorldX: 2400,
    minWorldY: 400,
    maxWorldY: 1400,
  };
  mgr.updateForViewport(viewport, 150, { maxSyncGenerateCount: 30 });
  while (mgr.getQueueLength() > 0) {
    mgr.updateForViewport(viewport, 150, { maxSyncGenerateCount: 30 });
  }
  const preloadRecord = mgr.getChunkRecord(4, 0);
  assert.ok(preloadRecord, 'Forward preload Chunk 4:0 must exist in retain window');
  const historyLenBefore = preloadRecord!.stateHistory.length;

  for (let frame = 0; frame < 60; frame++) {
    mgr.updateForViewport(viewport, 150, { maxSyncGenerateCount: 4 });
    const recNow = mgr.getChunkRecord(4, 0);
    assert.ok(recNow, 'Preload Chunk 4:0 must remain tracked');
    assert.equal(
      recNow!.stateHistory.length,
      historyLenBefore,
      'Preload Chunk 4:0 must not churn state transitions on every 60FPS frame'
    );
  }

  // 4. Terrain caches remain strictly bounded even after sampling 300 Chunks (900,000m)
  for (let cx = -150; cx < 150; cx++) {
    getTerrainSamples(cx, WorldConfig);
  }
  const cacheStats = getTerrainCacheStats();
  assert.ok(
    cacheStats.blockCacheSize <= cacheStats.maxBlockCacheSize,
    `blockCacheSize (${cacheStats.blockCacheSize}) must not exceed ${cacheStats.maxBlockCacheSize}`
  );
  assert.ok(
    cacheStats.chunkSamplesCacheSize <= cacheStats.maxChunkSamplesCacheSize,
    `chunkSamplesCacheSize (${cacheStats.chunkSamplesCacheSize}) must not exceed ${cacheStats.maxChunkSamplesCacheSize}`
  );
});

test('Undulating Mountain Range Seabed (Zero Flat or Diagonal Straight Lines), Uphill Speed Normalization, and Multi-Peak Shallow Coral Atoll Bridges', () => {
  // 1. Undulating Coral Mountain Range at Spawn (X ∈ [-500m, +500m]):
  // Stays in shallow coral water [410m, 660m], TERRAIN_MAX_SLOPE is 1.65, and the contour is an undulating hill range (never a flat straight line!)
  assert.equal(TERRAIN_MAX_SLOPE, 1.65);
  let spawnPositiveSlopes = 0;
  let spawnNegativeSlopes = 0;
  for (let x = -500; x <= 500; x += 100) {
    const fy = getFloorDepthAt(x, WorldConfig);
    const sl = getTerrainSlopeAt(x, WorldConfig);
    assert.ok(
      fy >= 410 && fy <= 660,
      `Spawn coral hills floorY(${x}) = ${fy} should lie in shallow coral zone [410, 660]`
    );
    if (sl > 0.04) spawnPositiveSlopes++;
    if (sl < -0.04) spawnNegativeSlopes++;
  }
  assert.ok(
    spawnPositiveSlopes >= 2 && spawnNegativeSlopes >= 2,
    `Spawn coral hill range must undulate with both rising and falling slopes (pos=${spawnPositiveSlopes}, neg=${spawnNegativeSlopes})`
  );

  // 2. Zero Flat Horizontal Lines & Zero Sloped Diagonal Straight Lines across Chunks -3..3:
  // Every pair of adjacent 100m steps must bend in slope (no constant-slope straight lines, whether flat or diagonal),
  // and descending continental slopes (X ∈ [600m, 14000m]) must include true counter-peak climbs (slope < -0.08) as well as rounded crests/saddles.
  for (let cx = -3; cx <= 3; cx++) {
    const samples = getTerrainSamples(cx, WorldConfig).points;
    for (let i = 0; i < samples.length - 1; i++) {
      const segSlope = (samples[i + 1].floorY - samples[i].floorY) / (samples[i + 1].worldX - samples[i].worldX);
      assert.ok(
        Math.abs(segSlope) >= 0.035,
        `Chunk ${cx} segment ${i} must not be a dead-flat horizontal line (got slope=${segSlope})`
      );
      if (i + 2 < samples.length) {
        const nextSlope = (samples[i + 2].floorY - samples[i + 1].floorY) / (samples[i + 2].worldX - samples[i + 1].worldX);
        assert.ok(
          Math.abs(nextSlope - segSlope) >= 0.08,
          `Chunk ${cx} adjacent segments ${i},${i + 1} must curve like undulating mountain ridges, never collinear straight lines (s0=${segSlope.toFixed(3)}, s1=${nextSlope.toFixed(3)})`
        );
      }
    }
  }

  let benchStepsOnDescent = 0;
  let counterPeakClimbsOnDescent = 0;
  let inflectionSteps = 0;
  let prevSlope = getTerrainSlopeAt(600, WorldConfig);
  for (let x = 700; x <= 14000; x += 100) {
    const sl = getTerrainSlopeAt(x, WorldConfig);
    if (Math.abs(sl) <= 0.25) {
      benchStepsOnDescent++;
    }
    if (sl < -0.08) {
      counterPeakClimbsOnDescent++;
    }
    if (Math.abs(sl - prevSlope) >= 0.14 || sl * prevSlope <= 0) {
      inflectionSteps++;
    }
    prevSlope = sl;
  }
  assert.ok(
    benchStepsOnDescent >= 10,
    `Descending mountain range must contain rounded crests and saddles (got ${benchStepsOnDescent})`
  );
  assert.ok(
    counterPeakClimbsOnDescent >= 12,
    `Descending mountain range must climb back up over secondary submarine peaks instead of dropping in a straight line (got ${counterPeakClimbsOnDescent} uphill steps)`
  );
  assert.ok(
    inflectionSteps >= 60,
    `Descending mountain range must continuously curve and undulate (got ${inflectionSteps} inflection steps)`
  );

  // 3. Uphill Speed Normalization (resolveSeabedKineticStep):
  // Find a steep seabed segment (|slope| >= 0.65) and verify that swimming uphill along the seabed NEVER exceeds open-water swim speed!
  let steepX = 1450;
  for (let x = 800; x <= 12000; x += 100) {
    if (Math.abs(getTerrainSlopeAt(x, WorldConfig)) >= 0.65) {
      steepX = x;
      break;
    }
  }
  const slopeAtSteep = getTerrainSlopeAt(steepX, WorldConfig);
  assert.ok(Math.abs(slopeAtSteep) >= 0.5, `Expected steep slope at x=${steepX}, got ${slopeAtSteep}`);

  const swimSpeed = 320; // m/s
  const simDt = 1 / 60;
  const sharkRadius = 22;
  // Swim uphill: if slope > 0 (depth increases to the right), uphill is moving left (vx = -swimSpeed)
  const uphillVx = slopeAtSteep > 0 ? -swimSpeed : swimSpeed;
  const startY = getEngineFloorDepthAt(steepX, WorldConfig) - sharkRadius;

  const kineticStep = resolveSeabedKineticStep(
    steepX,
    startY,
    uphillVx,
    25, // pressing against the slope while swimming uphill
    simDt,
    sharkRadius,
    WorldConfig
  );
  assert.equal(kineticStep.collided, true);
  assert.ok(
    kineticStep.effectiveSpeed2D <= swimSpeed * 0.93,
    `Uphill 2D speed along terrain (${kineticStep.effectiveSpeed2D.toFixed(2)}) must NEVER exceed open-water swimSpeed (${swimSpeed})`
  );

  // 4. Dual-Layer Shallow Coral Reef Atoll Bridges (with undulating coral mountain ridges):
  // Distant horizontal Chunks (both left X < 0 and right X > 0) have active shallow coral atolls (310m~560m) with attached coral reef outcrops,
  // WHILE deep-water horizontal passage (e.g., Y = 900m, 4500m, 12000m) underneath those exact same X coordinates is 100% unobstructed!
  for (const distantChunkX of [-12, -8, -4, -2, 2, 4, 8, 12]) {
    const outcrops = getShallowCoralAtollOutcropsForChunk(distantChunkX, WorldConfig);
    assert.ok(
      outcrops.length >= 6,
      `Distant ChunkX=${distantChunkX} must have rich shallow coral atoll outcrops (got ${outcrops.length})`
    );
    const coralOutcrops = outcrops.filter((o) => o.type === 'coral');
    assert.ok(
      coralOutcrops.length >= 2,
      `Distant ChunkX=${distantChunkX} must contain composite coral reef mounds in shallow water`
    );

    const sampleOutcrop = coralOutcrops[0];
    const atollSample = getShallowCoralAtollAt(sampleOutcrop.worldX, WorldConfig);
    assert.equal(atollSample.active, true);
    assert.ok(
      atollSample.topFloorY >= 310 && atollSample.topFloorY <= 560,
      `Atoll topFloorY (${atollSample.topFloorY}) must lie in the sunlit shallow coral zone [310, 560]`
    );

    const shallowHit = resolveSeabedCollision(
      sampleOutcrop.worldX,
      atollSample.topFloorY - 5,
      20,
      40,
      WorldConfig
    );
    assert.equal(shallowHit.collided, true, 'Shallow shark touching atoll top must land on the reef mountain ridge');
    assert.equal(shallowHit.onShallowAtoll, true);

    const deepPass900 = resolveSeabedCollision(sampleOutcrop.worldX, 900, 20, 0, WorldConfig);
    assert.equal(
      deepPass900.collided,
      false,
      `Deep water passage at Y=900m underneath shallow atoll X=${sampleOutcrop.worldX} must be 100% unobstructed`
    );

    // 5. Bottom-to-Top Impenetrability of Shallow Seabed:
    // Any entity approaching the shallow seabed from below (prevY > topFloorY + 4) MUST collide with the underside arch ceiling (bottomArchY + radius)
    // and NEVER penetrate upward to the top surface (topFloorY - radius)!
    const underCollision = resolveSeabedCollision(
      sampleOutcrop.worldX,
      atollSample.bottomArchY + 8,
      sharkRadius,
      -260,
      WorldConfig,
      atollSample.bottomArchY + 25
    );
    assert.equal(underCollision.collided, true);
    assert.equal(underCollision.onShallowAtoll, true);
    assert.equal(underCollision.hitAtollUnderside, true);
    assert.ok(
      underCollision.engineY >= atollSample.bottomArchY + sharkRadius - 1e-4,
      `Underside collision at X=${sampleOutcrop.worldX} must clamp shark below bottomArchY + radius (${atollSample.bottomArchY + sharkRadius}), got ${underCollision.engineY}`
    );
    assert.ok(
      underCollision.vy >= 0,
      `Upward velocity into shallow seabed ceiling must be arrested/reflected downward (got vy=${underCollision.vy})`
    );

    // Simulate 60 consecutive frames of full upward & diagonal boost against the underside of the shallow seabed
    let simX = sampleOutcrop.worldX;
    let simY = atollSample.bottomArchY + sharkRadius + 6;
    let simVx = 180;
    let simVy = -620; // extreme upward boost
    for (let frame = 0; frame < 60; frame++) {
      const step = resolveSeabedKineticStep(
        simX,
        simY,
        simVx,
        -620, // player continuously holding UP boost
        1 / 60,
        sharkRadius,
        WorldConfig
      );
      simX = step.engineX;
      simY = step.engineY;
      simVx = step.vx;
      simVy = step.vy;
      const curAtoll = getShallowCoralAtollAt(simX, WorldConfig);
      if (curAtoll.active) {
        assert.ok(
          simY >= curAtoll.bottomArchY + sharkRadius - 1e-3,
          `Frame ${frame}: Shark boosting upward from below must NEVER penetrate shallow seabed ceiling at X=${simX.toFixed(1)} (simY=${simY.toFixed(2)}, ceiling=${(curAtoll.bottomArchY + sharkRadius).toFixed(2)})`
        );
      }
    }
    void simVy;
  }

  // 6. Continuous Shallow Seabed with Receding Arched Downward Cave Openings:
  // Across cell seam X = 3200m (and -3200m), the visual seabed rim (visualRimY) is C1 continuous with zero breaks,
  // curves downward into a concave cave mouth (+110m ~ +160m deeper at the seam center than at the shoulders),
  // and opens physical collision (active === false, isDiveOpening === true) inside the downward cave mouth!
  for (const seamX of [-3200, 1600, 3200, 4800]) {
    const leftShoulder = getShallowCoralAtollAt(seamX - 420, WorldConfig);
    const centerCave = getShallowCoralAtollAt(seamX, WorldConfig);
    const rightShoulder = getShallowCoralAtollAt(seamX + 420, WorldConfig);
    const leftOfSeam = getShallowCoralAtollAt(seamX - 1, WorldConfig);
    const rightOfSeam = getShallowCoralAtollAt(seamX + 1, WorldConfig);

    assert.equal(leftShoulder.active, true, `Left shoulder at X=${seamX - 420} must be solid shallow seabed`);
    assert.equal(rightShoulder.active, true, `Right shoulder at X=${seamX + 420} must be solid shallow seabed`);
    assert.equal(centerCave.active, false, `Cave mouth center at X=${seamX} must be open for downward diving`);
    assert.equal(centerCave.isDiveOpening, true, `Cave mouth center at X=${seamX} must be marked as dive opening`);

    const rimContinuityDiff = Math.abs((leftOfSeam.visualRimY ?? 0) - (rightOfSeam.visualRimY ?? 0));
    assert.ok(
      rimContinuityDiff < 2.5,
      `Visual seabed rim across seam X=${seamX} must be continuous (diff=${rimContinuityDiff.toFixed(3)})`
    );

    const shoulderAvgY = ((leftShoulder.visualRimY ?? leftShoulder.topFloorY) + (rightShoulder.visualRimY ?? rightShoulder.topFloorY)) * 0.5;
    const caveDrop = (centerCave.visualRimY ?? centerCave.topFloorY) - shoulderAvgY;
    assert.ok(
      caveDrop >= 95,
      `Downward cave opening at X=${seamX} must curve downward into a recessed arc (expected drop >= 95m, got ${caveDrop.toFixed(1)}m)`
    );
  }
});





