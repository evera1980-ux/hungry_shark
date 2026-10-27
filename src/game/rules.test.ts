import test from 'node:test';
import assert from 'node:assert/strict';
import { I18N, translate } from './i18n';
import { GAME_CONFIG } from './config';
import {
  computeSharkStats,
  computeEvolvedSharkStats,
  resolvePreyEncounter,
  addEvolutionProgress,
  pickEvolutionChoices,
  getMaxMechaLoadout,
  getDepthZone,
} from './rules';
import {
  createDefaultMetaSave,
  evaluateSharkUnlock,
  getGlobalAtlasBonuses,
  getNextEvolutionTarget,
  getSharkFormById,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  SHARK_EVOLUTION_FORMS,
} from './sharkEvolutionConfig';
import { SHARK_CELL_BOUNDS, SHARK_GRID_MAP } from './spriteSheetManager';

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
  assert.equal(prog.rollPreyMutation(10000, () => 0.12), 'ABYSS_BEHEMOTH');
  assert.equal(prog.rollPreyMutation(10000, () => 0.95), 'NONE');
});

import {
  getEffectivePreyTier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getOrganRerollCost,
  getPreyRelativeVisualScale,
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
  assert.equal(initialEval.levelMet, false);
  assert.equal(initialEval.canUnlockNow, false);

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
    const sharkDrawSize = 96 * normalStats.scale;

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
