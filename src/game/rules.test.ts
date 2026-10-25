import test from 'node:test';
import assert from 'node:assert/strict';
import { I18N, translate } from './i18n';
import { GAME_CONFIG } from './config';
import {
  computeSharkStats,
  resolvePreyEncounter,
  addEvolutionProgress,
  pickEvolutionChoices,
  getMaxMechaLoadout,
  getDepthZone,
} from './rules';

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

test('EcosystemSpawner maintains maxActivePreys=50, recycles distant prey beyond 1.5x spawnRadius, and applies Infinite Scaling', () => {
  const spawner = new EcosystemSpawner(50, 1500);
  const activePreys: PreyEntity[] = [];

  // Advance 25 seconds -> scaleMultiplier = 1.0 + 25 * 0.01 = 1.25
  spawner.update(25, activePreys, 0, 500, () => 0.5);
  assert.equal(activePreys.length, 50);
  assert.equal(spawner.getScaleMultiplier(), 1.25);
  assert.equal(activePreys[0].scaleMultiplier, 1.25);

  // Move one prey far outside spawnRadius * 1.5 (e.g. y = 4000, distance = 3500 > 2250)
  activePreys[0].y = 4000;
  spawner.update(5, activePreys, 0, 500, () => 0.25);
  // Still 50 active preys after culling and respawning off-screen with new scaleMultiplier = 1.30
  assert.equal(activePreys.length, 50);
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
  assert.equal(prog.rollPreyMutation(10000, () => 0.28), 'ABYSS_BEHEMOTH');
  assert.equal(prog.rollPreyMutation(10000, () => 0.95), 'NONE');
});




