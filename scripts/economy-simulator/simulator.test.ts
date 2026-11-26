import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, SHARK_EVOLUTION_FORMS } from '../../src/game/sharkEvolutionConfig';
import { createSeededRng } from './prng';
import { simulateSingleRun } from './runSimulator';
import { PLAYER_ARCHETYPES, RULE_SCENARIOS } from './scenarios';
import { runStaticDeterministicAudit } from './staticAnalyzer';
import { runTrialExploitContrast } from './campaignRunner';

test('Stage 1 Static Audit reproduces verified 48-shark Web and iOS exact figures', () => {
  const audit = runStaticDeterministicAudit();

  assert.equal(audit.perShark.length, 48);
  assert.equal(audit.perGeneration.length, 6);

  // Unlock totals (post-D7-1 U-B G4..G6 shift): 753,560 Coins + 86,452 Genes
  assert.equal(audit.totals.unlockCoins, 753_560);
  assert.equal(audit.totals.unlockGenes, 86_452);

  // Mandatory parent upgrade totals (post-D7-1 U-B): 306,289 Coins + 27,001 Genes
  assert.equal(audit.totals.mandatoryParentCoins, 306_289);
  assert.equal(audit.totals.mandatoryParentGenes, 27_001);
  assert.equal(audit.totals.mandatoryTotalCoins, 1_059_849);
  assert.equal(audit.totals.mandatoryTotalGenes, 113_453);

  // Full Lv.10 totals (D5 unified #0 minRef=12 -> both 87,428G)
  assert.equal(audit.totals.fullUpgradeCoins, 1_326_672);
  assert.equal(audit.totals.webFullUpgradeGenes, 87_428);
  assert.equal(audit.totals.iosFullUpgradeGenes, 87_428);
  assert.equal(audit.totals.webAllMaxTotalCoins, 2_080_232);
  assert.equal(audit.totals.webAllMaxTotalGenes, 173_880);
  assert.equal(audit.totals.iosAllMaxTotalGenes, 173_880);

  // Crowns: Web 11,520G vs iOS 285,159C + 10,416G
  assert.equal(audit.totals.webCrownTotalCoins, 44_940);
  assert.equal(audit.totals.webCrownTotalGenes, 9_619);
  assert.equal(audit.totals.iosCrownTotalCoins, 44_940);
  assert.equal(audit.totals.iosCrownTotalGenes, 9_619);

  // G1~G3 iOS crown gold overflow check
  assert.equal(audit.totals.iosFirst3GenCrownCoins, 11_238);
  assert.equal(audit.totals.iosFirst3GenMandatoryCoins, 42_652);

  // Bite Tier -1T regression count (#23 -> #46 = 23 negative jumps)
  assert.equal(audit.totals.biteTierCurrentNegativeTransitions, 0);

  // Prey T1~T17 legacy Web 0% DNA dead branch
  assert.ok(audit.preyEcologyAudit.t1To17NonBossCount > 0);
  assert.equal(
    audit.preyEcologyAudit.t1To17LegacyWebDnaZeroCount,
    audit.preyEcologyAudit.t1To17NonBossCount
  );
  assert.deepEqual(audit.preyEcologyAudit.missingPreyTiers, [
    4, 5, 6, 9, 12, 17, 19, 21, 25, 26, 27, 30, 33, 34, 35, 36,
  ]);
});

test('Seeded single-run Monte Carlo simulation is bit-identical across repeats for same seed', () => {
  const save = createDefaultMetaSave();
  for (const scId of ['web_pre_p0', 'web_post_p0', 'ios_post_p0', 'unified_candidate'] as const) {
    const runA = simulateSingleRun({
      seed: 987654321,
      rng: createSeededRng(987654321),
      scenario: RULE_SCENARIOS[scId],
      archetype: PLAYER_ARCHETYPES.Normal,
      sharkId: 'shark_16_great_white',
      upgradeLevel: 5,
      metaSave: save,
    });
    const runB = simulateSingleRun({
      seed: 987654321,
      rng: createSeededRng(987654321),
      scenario: RULE_SCENARIOS[scId],
      archetype: PLAYER_ARCHETYPES.Normal,
      sharkId: 'shark_16_great_white',
      upgradeLevel: 5,
      metaSave: save,
    });
    assert.deepEqual(runA, runB, `Mismatch on scenario ${scId}`);
  }
});

test('Single-source Web Post-P0 eliminates direct predation payouts and reduces inflation vs Pre-P0', () => {
  const save = createDefaultMetaSave();
  const pre = simulateSingleRun({
    seed: 2026,
    rng: createSeededRng(2026),
    scenario: RULE_SCENARIOS.web_pre_p0,
    archetype: PLAYER_ARCHETYPES.Normal,
    sharkId: 'shark_16_great_white',
    upgradeLevel: 5,
    metaSave: save,
  });
  const post = simulateSingleRun({
    seed: 2026,
    rng: createSeededRng(2026),
    scenario: RULE_SCENARIOS.web_post_p0,
    archetype: PLAYER_ARCHETYPES.Normal,
    sharkId: 'shark_16_great_white',
    upgradeLevel: 5,
    metaSave: save,
  });

  assert.equal(post.coinsFromDirectPredation, 0);
  assert.equal(post.genesFromDirectPredation, 0);
  assert.ok(pre.coinsFromDirectPredation > 0);
  assert.ok(pre.genesFromDirectPredation > 0);
  assert.ok(
    pre.runCoinsEarned > post.runCoinsEarned,
    `Expected Web Pre-P0 double coins (${pre.runCoinsEarned}) > Post-P0 (${post.runCoinsEarned})`
  );
});

test('Trial P0 exploit contrast verifies permanent progress and Crown isolation on Web and iOS', () => {
  const rows = runTrialExploitContrast({
    masterSeed: 20261125,
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
  });

  const webPre = rows.find((r) => r.scenarioId === 'web_pre_p0')!;
  const webPost = rows.find((r) => r.scenarioId === 'web_post_p0')!;
  const iosPre = rows.find((r) => r.scenarioId === 'ios_pre_p0')!;
  const iosPost = rows.find((r) => r.scenarioId === 'ios_post_p0')!;

  assert.ok(webPre.leakedBestLevelToSave > 1 || webPre.leakedBestDepthToSave > 200);
  assert.equal(webPost.leakedBestLevelToSave, 1);
  assert.equal(webPost.leakedBestDepthToSave, 200);
  assert.equal(webPost.leakedCrownGenes, 0);

  assert.ok(iosPre.leakedCrownCoins > 0 || iosPre.leakedCrownGenes > 0);
  assert.equal(iosPost.leakedBestLevelToSave, 1);
  assert.equal(iosPost.leakedBestDepthToSave, 200);
  assert.equal(iosPost.leakedCrownCoins, 0);
  assert.equal(iosPost.leakedCrownGenes, 0);

  assert.equal(SHARK_EVOLUTION_FORMS.length, 48);
});
