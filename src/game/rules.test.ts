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

test('GAME_CONFIG has 15 organs across 3 factions and 5 slots, plus 8 prey tiers', () => {
  assert.equal(GAME_CONFIG.organs.length, 15);
  assert.equal(GAME_CONFIG.preyTiers.length, 8);

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

import { SPRITE_GRID_MAP } from './spriteSheetManager';

test('SPRITE_GRID_MAP covers all 16 cells of the 4x4 spritesheet uniquely', () => {
  const entries = Object.entries(SPRITE_GRID_MAP);
  assert.equal(entries.length, 16);
  const coords = new Set(entries.map(([, [r, c]]) => `${r},${c}`));
  assert.equal(coords.size, 16);
});

