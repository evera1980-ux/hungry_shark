import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  runCareerProgressionSimulation,
  runPerSharkEfficiencyBenchmark,
  runTrialExploitContrast,
} from './campaignRunner';
import { generateSimulationMarkdownReport, type SimulationReportBundle } from './reportGenerator';
import { PLAYER_ARCHETYPES, RULE_SCENARIOS } from './scenarios';
import { runStaticDeterministicAudit } from './staticAnalyzer';
import type { PlayerArchetypeId, RuleScenarioId } from './types';

function parseCliArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eqIdx = raw.indexOf('=');
    if (eqIdx === -1) {
      args[raw.slice(2)] = true;
    } else {
      args[raw.slice(2, eqIdx)] = raw.slice(eqIdx + 1);
    }
  }
  return args;
}

export function runEconomySimulatorCli(argv: string[] = process.argv.slice(2)): SimulationReportBundle {
  const t0 = performance.now();
  const args = parseCliArgs(argv);
  const isQuick = args.quick === true;

  const masterSeed =
    typeof args.seed === 'string' && Number.isFinite(Number(args.seed))
      ? Math.floor(Number(args.seed))
      : 20261125;
  const runsPerShark =
    typeof args['runs-per-shark'] === 'string' && Number.isFinite(Number(args['runs-per-shark']))
      ? Math.max(2, Math.floor(Number(args['runs-per-shark'])))
      : isQuick
      ? 3
      : 6;
  const careerSeeds =
    typeof args['career-seeds'] === 'string' && Number.isFinite(Number(args['career-seeds']))
      ? Math.max(2, Math.floor(Number(args['career-seeds'])))
      : isQuick
      ? 3
      : 6;

  const repoRoot = resolve(import.meta.dirname ?? process.cwd(), '../..');
  const outMdPath =
    typeof args['out-md'] === 'string'
      ? resolve(args['out-md'])
      : resolve(repoRoot, 'docs/ECONOMY_SIMULATION_REPORT.md');
  const outJsonPath =
    typeof args['out-json'] === 'string'
      ? resolve(args['out-json'])
      : resolve(repoRoot, 'scripts/economy-simulator/output/latest-simulation.json');

  const focusScenarios: RuleScenarioId[] = [
    'web_pre_p0',
    'web_post_p0',
    'ios_post_p0',
    'unified_candidate',
  ];
  const allArchetypes: PlayerArchetypeId[] = [
    'Casual',
    'Normal',
    'Efficient',
    'Farming',
  ];

  console.log(`[ECONOMY_SIMULATOR] seed=${masterSeed}, runsPerShark=${runsPerShark}, careerSeeds=${careerSeeds}`);
  const staticAudit = runStaticDeterministicAudit();
  console.log('[ECONOMY_SIMULATOR] Stage 1 static audit complete');

  // Stage 2A: All 48 sharks across 4 scenarios (Normal) + all 4 archetypes across key baseline scenarios (Normal full + Casual/Efficient/Farming on post-P0 baselines)
  const benchNormal = runPerSharkEfficiencyBenchmark({
    masterSeed,
    scenarioIds: focusScenarios,
    archetypeIds: ['Normal'],
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
    runsPerShark,
  });
  console.log('[ECONOMY_SIMULATOR] Stage 2A normal 48-shark benchmark complete');

  const benchMultiArchetype = runPerSharkEfficiencyBenchmark({
    masterSeed: masterSeed + 7919,
    scenarioIds: ['web_post_p0', 'ios_post_p0'],
    archetypeIds: ['Casual', 'Efficient', 'Farming'],
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
    runsPerShark: Math.max(3, Math.floor(runsPerShark * 0.75)),
    // 2 representative sharks per generation across G1..G6 for cross-archetype contrast
    sharkIndices: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 47],
  });
  console.log('[ECONOMY_SIMULATOR] Stage 2A multi-archetype benchmark complete');

  const benchmarks = [...benchNormal.fullBenchmarks, ...benchMultiArchetype.fullBenchmarks];

  // Stage 2B: Full #0 -> #47 Career Trajectories (No Ads vs With Ads)
  const maxCareerRunsCap = 180;
  const careersNoAds = runCareerProgressionSimulation({
    masterSeed,
    scenarioIds: focusScenarios,
    archetypeIds: allArchetypes,
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
    careerSeeds,
    includeAds: false,
    maxCareerRunsCap,
  });
  console.log('[ECONOMY_SIMULATOR] Stage 2B no-ads career simulations complete');

  const careersWithAds = runCareerProgressionSimulation({
    masterSeed: masterSeed + 104729,
    scenarioIds: ['web_post_p0', 'ios_pre_p0', 'ios_post_p0', 'unified_candidate'],
    archetypeIds: ['Casual', 'Normal', 'Efficient', 'Farming'],
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
    careerSeeds,
    includeAds: true,
    maxCareerRunsCap,
  });
  console.log('[ECONOMY_SIMULATOR] Stage 2B with-ads career simulations complete');

  const trialExploitContrast = runTrialExploitContrast({
    masterSeed,
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
  });

  const elapsedSec = Number(((performance.now() - t0) / 1000).toFixed(2));
  const bundle: SimulationReportBundle = {
    metadata: {
      generatedAtIso: new Date().toISOString(),
      masterSeed,
      runsPerShark,
      careerSeeds,
      elapsedSec,
      commandLine: `npx tsx scripts/economy-simulator/index.ts --seed=${masterSeed} --runs-per-shark=${runsPerShark} --career-seeds=${careerSeeds}`,
    },
    scenarios: RULE_SCENARIOS,
    archetypes: PLAYER_ARCHETYPES,
    staticAudit,
    benchmarks,
    uncappedStressProbe: benchNormal.uncappedStressProbe,
    careersNoAds,
    careersWithAds,
    trialExploitContrast,
  };

  if (args['dry-run'] !== true) {
    mkdirSync(dirname(outMdPath), { recursive: true });
    mkdirSync(dirname(outJsonPath), { recursive: true });
    writeFileSync(outMdPath, generateSimulationMarkdownReport(bundle), 'utf-8');
    writeFileSync(outJsonPath, JSON.stringify(bundle, null, 2), 'utf-8');
    console.log(`[ECONOMY_SIMULATOR] Wrote Markdown report to ${outMdPath}`);
    console.log(`[ECONOMY_SIMULATOR] Wrote JSON snapshot to ${outJsonPath}`);
  }
  console.log(`[ECONOMY_SIMULATOR] Done in ${elapsedSec}s`);
  return bundle;
}

const isDirectEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes('economy-simulator/index');

if (isDirectEntry) {
  runEconomySimulatorCli(process.argv.slice(2));
}
