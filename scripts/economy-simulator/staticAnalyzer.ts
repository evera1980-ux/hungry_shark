import { GAME_CONFIG, PreyTierConfig } from '../../src/game/config';
import {
  AD_PLACEMENT_RULES,
  ADS_AND_MONETIZATION_CONFIG,
} from '../../src/game/adManager';
import {
  computeEvolvedSharkStats,
  buildPredationRewardPlan,
  resolvePreyEncounter,
} from '../../src/game/rules';
import {
  SHARK_EVOLUTION_FORMS,
  getParentCandidatesForForm,
  getSharkMasteryConfig,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  SharkFormConfig,
} from '../../src/game/sharkEvolutionConfig';

export interface StaticSharkBreakdown {
  index: number;
  id: string;
  nameZh: string;
  generation: number;
  row: number;
  col: number;
  unlockCoins: number;
  unlockGenes: number;
  reqParentUpgradeLevel: number;
  reqMaxInRunLevel: number;
  reqMaxDepth: number;
  baseUpgradeCoinCost: number;
  lv1To10CoinSum: number;
  webGeneLv5: number;
  webGeneLv10: number;
  webGeneLv10Sum: number;
  iosGeneLv5: number;
  iosGeneLv10: number;
  iosGeneLv10Sum: number;
  mandatoryParentUpgradeCoins: number;
  mandatoryParentUpgradeGenes: number;
  parentExceedsNextUnlockRatio: number;
  webCrownCoins: number;
  webCrownGenes: number;
  iosCrownCoins: number;
  iosCrownGenes: number;
  iosBronzeThresholdVsWebRatio: number;
  lv1BiteTier: number;
  parentReqBiteTier: number | null;
  biteTierDeltaOnEvo: number;
  biteTierLv5AlignedDeltaOnEvo: number | null;
  webMaxCoinMult: number;
  webMaxGeneMult: number;
  iosMaxCoinMult: number;
  iosMaxGeneMult: number;
}

export interface StaticGenerationBreakdown {
  generation: number;
  row: number;
  sharkCount: number;
  unlockCoins: number;
  unlockGenes: number;
  mandatoryParentUpgradeCoins: number;
  mandatoryParentUpgradeGenes: number;
  mandatoryTotalCoins: number;
  mandatoryTotalGenes: number;
  fullUpgradeCoins: number;
  webFullUpgradeGenes: number;
  iosFullUpgradeGenes: number;
  webAllMaxCoins: number;
  webAllMaxGenes: number;
  iosAllMaxCoins: number;
  iosAllMaxGenes: number;
  webCrownCoins: number;
  webCrownGenes: number;
  iosCrownCoins: number;
  iosCrownGenes: number;
  iosCrownOverMandatoryCoinsRatio: number;
}

export interface StaticPreyTierSample {
  tier: number;
  preyId: string;
  nameZh: string;
  coinValue: number;
  geneValue: number;
  xpValue: number;
  isHazard: boolean;
  /** Old Web: direct + legacy pickup expectation at 1.0x mult */
  webPreP0ExpectedCoins: number;
  webPreP0ExpectedGenes: number;
  webPreP0LegacyDnaChancePct: number;
  /** Fixed Web P0: buildPredationRewardPlan at 1.0x mult */
  webPostP0Coins: number;
  webPostP0Genes: number;
  /** Current iOS .DEVOUR expected coins & genes at 1.0x mult (before pickup expiry) */
  iosExpectedCoinsNoGolden: number;
  iosExpectedGenesWith38Pct: number;
  iosExpectedCoinsWith8PctGolden: number;
  iosExpectedGenesWith8PctGolden: number;
}

export interface StaticAuditReport {
  perShark: StaticSharkBreakdown[];
  perGeneration: StaticGenerationBreakdown[];
  totals: {
    unlockCoins: number;
    unlockGenes: number;
    mandatoryParentCoins: number;
    mandatoryParentGenes: number;
    mandatoryTotalCoins: number;
    mandatoryTotalGenes: number;
    fullUpgradeCoins: number;
    webFullUpgradeGenes: number;
    iosFullUpgradeGenes: number;
    webAllMaxTotalCoins: number;
    webAllMaxTotalGenes: number;
    iosAllMaxTotalCoins: number;
    iosAllMaxTotalGenes: number;
    webCrownTotalCoins: number;
    webCrownTotalGenes: number;
    iosCrownTotalCoins: number;
    iosCrownTotalGenes: number;
    iosFirst3GenCrownCoins: number;
    iosFirst3GenMandatoryCoins: number;
    biteTierCurrentNegativeTransitions: number;
    biteTierLv5Lv10NegativeTransitions: number;
    webCrossGenAncestorCount: number;
  };
  adPolicies: {
    webPlacements: typeof AD_PLACEMENT_RULES;
    webActiveUiPlacements: string[];
    webDeadPlacements: string[];
    iosPlacements: Array<{
      kind: string;
      cooldownSec: number;
      dailyCap: number;
      rewardCoins: string;
      rewardGenes: string;
      maxDailyFixedCoins: number;
      maxDailyFixedGenes: number;
    }>;
  };
  preySamples: StaticPreyTierSample[];
  preyEcologyAudit: {
    totalCatalogEntries: number;
    activeMarineSpeciesCount: number;
    hazardCount: number;
    t1To17NonBossCount: number;
    t1To17LegacyWebDnaZeroCount: number;
    missingPreyTiers: number[];
  };
}

/** Exact iOS Swift Mastery Crown table from GameRules.swift:436-471 */
export function computeIosSharkMasteryConfig(form: SharkFormConfig): {
  bronzeScore: number;
  silverScore: number;
  goldScore: number;
  totalCoins: number;
  totalGenes: number;
} {
  const idx = form.index;
  const row = form.row;
  const baseScore =
    Math.round((1800.0 + idx * 1450.0 + Math.pow(idx, 1.65) * 420.0) / 100.0) *
    100.0;
  const silverScore = Math.round((baseScore * 2.4) / 100.0) * 100.0;
  const goldScore = Math.round((baseScore * 4.8) / 100.0) * 100.0;

  const baseCoin = Math.round(45.0 + idx * 24.0 + row * 65.0);
  const silverCoin = Math.round(baseCoin * 2.2);
  const goldCoin = Math.round(baseCoin * 4.5);

  const baseGene = Math.round(4.0 + Math.floor(idx * 0.85) + row * 3.0);
  const silverGene = Math.round(baseGene * 2.0);
  const goldGene = Math.round(baseGene * 4.0);

  return {
    bronzeScore: baseScore,
    silverScore,
    goldScore,
    totalCoins: baseCoin + silverCoin + goldCoin,
    totalGenes: baseGene + silverGene + goldGene,
  };
}

/** Exact iOS Swift gene upgrade cost from GameRules.swift:351-360 */
export function computeIosUpgradeGeneCost(
  form: SharkFormConfig,
  currentLevel: number
): number {
  return getSharkUpgradeGeneCost(form, currentLevel);
}

/** Legacy Pre-P0 Web pickup formula for audit comparison against fixed buildPredationRewardPlan */
export function computeWebPreP0LegacyPredationExpectation(prey: PreyTierConfig): {
  directCoins: number;
  directGenes: number;
  dropCount: number;
  dnaDropsCount: number;
  coinDropsCount: number;
  pickupCoins: number;
  pickupGenes: number;
  legacyDnaChancePct: number;
} {
  const drops = Math.min(6, Math.ceil(prey.tier / 9) + 1);
  const isHighGeneSource = prey.tier >= 18;
  let dnaDropsCount = 0;
  let coinDropsCount = 0;
  for (let d = 0; d < drops; d++) {
    const isDna = isHighGeneSource ? d % 2 === 1 : d % 4 === 3;
    if (isDna) dnaDropsCount++;
    else coinDropsCount++;
  }
  const scaledUnit = Math.max(1, Math.round(prey.tier * 0.45));
  const pickupCoinUnit = Math.max(3, Math.round(scaledUnit * 2.5));
  const pickupGeneUnit = Math.max(1, Math.round(scaledUnit * 1.2));
  const directCoins = Math.max(1, Math.round(prey.coinValue));
  const directGenes = Math.max(1, Math.round(prey.geneValue));
  return {
    directCoins,
    directGenes,
    dropCount: drops,
    dnaDropsCount,
    coinDropsCount,
    pickupCoins: coinDropsCount * pickupCoinUnit,
    pickupGenes: dnaDropsCount * pickupGeneUnit,
    legacyDnaChancePct: Number(((dnaDropsCount / drops) * 100).toFixed(1)),
  };
}

export function runStaticDeterministicAudit(): StaticAuditReport {
  const perShark: StaticSharkBreakdown[] = [];
  let webCrossGenAncestorCount = 0;
  let biteTierCurrentNegativeTransitions = 0;
  let biteTierLv5Lv10NegativeTransitions = 0;

  for (let i = 0; i < SHARK_EVOLUTION_FORMS.length; i++) {
    const form = SHARK_EVOLUTION_FORMS[i];
    const parents = getParentCandidatesForForm(form);
    if (parents.length > 1) {
      webCrossGenAncestorCount++;
    }

    let lv1To10CoinSum = 0;
    let webGeneLv5 = 0;
    let webGeneLv10 = 0;
    let iosGeneLv5 = 0;
    let iosGeneLv10 = 0;
    for (let lv = 1; lv < 10; lv++) {
      lv1To10CoinSum += getSharkUpgradeCost(form, lv);
      const wg = getSharkUpgradeGeneCost(form, lv);
      const ig = computeIosUpgradeGeneCost(form, lv);
      if (lv === 4) {
        webGeneLv5 = wg;
        iosGeneLv5 = ig;
      }
      if (lv === 9) {
        webGeneLv10 = wg;
        iosGeneLv10 = ig;
      }
    }

    // Mandatory parent upgrade cost incurred on previous sequential shark `i - 1`
    let mandatoryParentUpgradeCoins = 0;
    let mandatoryParentUpgradeGenes = 0;
    let parentExceedsNextUnlockRatio = 0;
    let parentReqBiteTier: number | null = null;
    let biteTierDeltaOnEvo = 0;
    let biteTierLv5AlignedDeltaOnEvo: number | null = null;

    if (i > 0) {
      const prevForm = SHARK_EVOLUTION_FORMS[i - 1];
      const reqLv = form.reqParentUpgradeLevel;
      for (let lv = 1; lv < reqLv; lv++) {
        mandatoryParentUpgradeCoins += getSharkUpgradeCost(prevForm, lv);
        mandatoryParentUpgradeGenes += getSharkUpgradeGeneCost(prevForm, lv);
      }
      parentExceedsNextUnlockRatio =
        form.unlockCoins > 0
          ? Number((mandatoryParentUpgradeCoins / form.unlockCoins).toFixed(2))
          : 0;

      const prevStatsAtReq = computeEvolvedSharkStats(1, prevForm.id, reqLv, false, 1.0, i);
      const curStatsAtLv1 = computeEvolvedSharkStats(1, form.id, 1, false, 1.0, i + 1);
      parentReqBiteTier = prevStatsAtReq.normalBiteTier ?? prevStatsAtReq.biteTier;
      const curLv1T = curStatsAtLv1.normalBiteTier ?? curStatsAtLv1.biteTier;
      biteTierDeltaOnEvo = curLv1T - parentReqBiteTier;
      if (biteTierDeltaOnEvo < 0) {
        biteTierCurrentNegativeTransitions++;
      }

      // Hypothetical Lv.5/Lv.10 aligned Bite Tier (+1 at Lv.5, +2 at Lv.10 instead of Lv.3/6/10)
      const prevHypBonus = reqLv >= 10 ? 2 : reqLv >= 5 ? 1 : 0;
      const prevHypT = Math.min(48, prevForm.baseBiteTier + prevHypBonus);
      biteTierLv5AlignedDeltaOnEvo = form.baseBiteTier - prevHypT;
      if (biteTierLv5AlignedDeltaOnEvo < 0) {
        biteTierLv5Lv10NegativeTransitions++;
      }
    }

    const webCrowns = getSharkMasteryConfig(form);
    const webCrownCoins = webCrowns.reduce((s, t) => s + t.coinReward, 0);
    const webCrownGenes = webCrowns.reduce((s, t) => s + t.geneReward, 0);
    const iosCrowns = computeIosSharkMasteryConfig(form);

    // Max collection (all 48 unlocked) multipliers
    const webMaxStats = computeEvolvedSharkStats(1, form.id, 10, false, 1.0, 48);
    const iosMaxCoinMult = webMaxStats.coinYieldMultiplier ?? 1;
    const iosMaxGeneMult = webMaxStats.geneYieldMultiplier ?? 1;

    const curStatsLv1 = computeEvolvedSharkStats(1, form.id, 1, false, 1.0, i + 1);

    perShark.push({
      index: form.index,
      id: form.id,
      nameZh: form.nameZh,
      generation: form.generation,
      row: form.row,
      col: form.col,
      unlockCoins: form.unlockCoins,
      unlockGenes: form.unlockGenes,
      reqParentUpgradeLevel: form.reqParentUpgradeLevel,
      reqMaxInRunLevel: form.reqMaxInRunLevel,
      reqMaxDepth: form.reqMaxDepth,
      baseUpgradeCoinCost: form.baseUpgradeCoinCost,
      lv1To10CoinSum,
      webGeneLv5,
      webGeneLv10,
      webGeneLv10Sum: webGeneLv5 + webGeneLv10,
      iosGeneLv5,
      iosGeneLv10,
      iosGeneLv10Sum: iosGeneLv5 + iosGeneLv10,
      mandatoryParentUpgradeCoins,
      mandatoryParentUpgradeGenes,
      parentExceedsNextUnlockRatio,
      webCrownCoins,
      webCrownGenes,
      iosCrownCoins: webCrownCoins,
      iosCrownGenes: webCrownGenes,
      iosBronzeThresholdVsWebRatio: Number(
        (iosCrowns.bronzeScore / webCrowns[0].scoreThreshold).toFixed(2)
      ),
      lv1BiteTier: curStatsLv1.normalBiteTier ?? curStatsLv1.biteTier,
      parentReqBiteTier,
      biteTierDeltaOnEvo,
      biteTierLv5AlignedDeltaOnEvo,
      webMaxCoinMult: webMaxStats.coinYieldMultiplier ?? 1,
      webMaxGeneMult: webMaxStats.geneYieldMultiplier ?? 1,
      iosMaxCoinMult,
      iosMaxGeneMult,
    });
  }

  const perGeneration: StaticGenerationBreakdown[] = [];
  for (let row = 0; row < 6; row++) {
    const genSharks = perShark.filter((s) => s.row === row);
    const unlockCoins = genSharks.reduce((s, x) => s + x.unlockCoins, 0);
    const unlockGenes = genSharks.reduce((s, x) => s + x.unlockGenes, 0);
    // Attribute mandatory upgrade spending on each shark in `row` needed to unlock `x.index + 1`
    const mandatoryParentUpgradeCoins = genSharks.reduce((s, x) => {
      const next = perShark[x.index + 1];
      return s + (next ? next.mandatoryParentUpgradeCoins : 0);
    }, 0);
    const mandatoryParentUpgradeGenes = genSharks.reduce((s, x) => {
      const next = perShark[x.index + 1];
      return s + (next ? next.mandatoryParentUpgradeGenes : 0);
    }, 0);
    const fullUpgradeCoins = genSharks.reduce((s, x) => s + x.lv1To10CoinSum, 0);
    const webFullUpgradeGenes = genSharks.reduce((s, x) => s + x.webGeneLv10Sum, 0);
    const iosFullUpgradeGenes = genSharks.reduce((s, x) => s + x.iosGeneLv10Sum, 0);
    const webCrownCoins = genSharks.reduce((s, x) => s + x.webCrownCoins, 0);
    const webCrownGenes = genSharks.reduce((s, x) => s + x.webCrownGenes, 0);
    const iosCrownCoins = genSharks.reduce((s, x) => s + x.iosCrownCoins, 0);
    const iosCrownGenes = genSharks.reduce((s, x) => s + x.iosCrownGenes, 0);

    const mandatoryTotalCoins = unlockCoins + mandatoryParentUpgradeCoins;
    const mandatoryTotalGenes = unlockGenes + mandatoryParentUpgradeGenes;

    perGeneration.push({
      generation: row + 1,
      row,
      sharkCount: genSharks.length,
      unlockCoins,
      unlockGenes,
      mandatoryParentUpgradeCoins,
      mandatoryParentUpgradeGenes,
      mandatoryTotalCoins,
      mandatoryTotalGenes,
      fullUpgradeCoins,
      webFullUpgradeGenes,
      iosFullUpgradeGenes,
      webAllMaxCoins: unlockCoins + fullUpgradeCoins,
      webAllMaxGenes: unlockGenes + webFullUpgradeGenes,
      iosAllMaxCoins: unlockCoins + fullUpgradeCoins,
      iosAllMaxGenes: unlockGenes + iosFullUpgradeGenes,
      webCrownCoins,
      webCrownGenes,
      iosCrownCoins,
      iosCrownGenes,
      iosCrownOverMandatoryCoinsRatio: Number(
        (iosCrownCoins / Math.max(1, mandatoryTotalCoins)).toFixed(3)
      ),
    });
  }

  const totals = {
    unlockCoins: perGeneration.reduce((s, g) => s + g.unlockCoins, 0),
    unlockGenes: perGeneration.reduce((s, g) => s + g.unlockGenes, 0),
    mandatoryParentCoins: perGeneration.reduce(
      (s, g) => s + g.mandatoryParentUpgradeCoins,
      0
    ),
    mandatoryParentGenes: perGeneration.reduce(
      (s, g) => s + g.mandatoryParentUpgradeGenes,
      0
    ),
    mandatoryTotalCoins: perGeneration.reduce((s, g) => s + g.mandatoryTotalCoins, 0),
    mandatoryTotalGenes: perGeneration.reduce((s, g) => s + g.mandatoryTotalGenes, 0),
    fullUpgradeCoins: perGeneration.reduce((s, g) => s + g.fullUpgradeCoins, 0),
    webFullUpgradeGenes: perGeneration.reduce((s, g) => s + g.webFullUpgradeGenes, 0),
    iosFullUpgradeGenes: perGeneration.reduce((s, g) => s + g.iosFullUpgradeGenes, 0),
    webAllMaxTotalCoins: perGeneration.reduce((s, g) => s + g.webAllMaxCoins, 0),
    webAllMaxTotalGenes: perGeneration.reduce((s, g) => s + g.webAllMaxGenes, 0),
    iosAllMaxTotalCoins: perGeneration.reduce((s, g) => s + g.iosAllMaxCoins, 0),
    iosAllMaxTotalGenes: perGeneration.reduce((s, g) => s + g.iosAllMaxGenes, 0),
    webCrownTotalCoins: perGeneration.reduce((s, g) => s + g.webCrownCoins, 0),
    webCrownTotalGenes: perGeneration.reduce((s, g) => s + g.webCrownGenes, 0),
    iosCrownTotalCoins: perGeneration.reduce((s, g) => s + g.iosCrownCoins, 0),
    iosCrownTotalGenes: perGeneration.reduce((s, g) => s + g.iosCrownGenes, 0),
    iosFirst3GenCrownCoins: perGeneration
      .slice(0, 3)
      .reduce((s, g) => s + g.iosCrownCoins, 0),
    iosFirst3GenMandatoryCoins: perGeneration
      .slice(0, 3)
      .reduce((s, g) => s + g.mandatoryTotalCoins, 0),
    biteTierCurrentNegativeTransitions,
    biteTierLv5Lv10NegativeTransitions,
    webCrossGenAncestorCount,
  };

  // Sample representative prey species across T1..T48 (including T28 used in original audit docs)
  const targetSampleTiers = [1, 3, 8, 12, 17, 18, 24, 28, 32, 38, 42, 48];
  const baseShark = computeEvolvedSharkStats(10, 'shark_47_omega_devourer', 10, false, 1.0, 1);
  const preySamples: StaticPreyTierSample[] = [];
  for (const tier of targetSampleTiers) {
    const p = GAME_CONFIG.preyTiers.find(
      (item) => item.tier === tier && !item.isHazard
    );
    if (!p) continue;
    const preP0 = computeWebPreP0LegacyPredationExpectation(p);
    const enc = resolvePreyEncounter(baseShark, p, false, false, 'NONE', 1.0);
    const plan = buildPredationRewardPlan(
      { uid: tier, devoured: false, config: p, mutationVariant: 'NONE' },
      enc,
      { effectiveCoinMult: 1.0, effectiveGeneMult: 1.0, finalScoreGain: enc.scoreGain }
    );
    const iosCoin = Math.max(1, p.coinValue);
    const iosCoinWithGold = 0.92 * iosCoin + 0.08 * Math.max(1, p.coinValue * 3);
    const iosGeneNormal = p.geneValue > 0 ? p.geneValue : 0;
    const iosGeneWith38 = iosGeneNormal * 0.38;
    const iosGeneWith8Gold = iosGeneNormal * (0.08 + 0.92 * 0.38);

    preySamples.push({
      tier: p.tier,
      preyId: p.id,
      nameZh: p.nameKey,
      coinValue: p.coinValue,
      geneValue: p.geneValue,
      xpValue: p.xpValue,
      isHazard: Boolean(p.isHazard),
      webPreP0ExpectedCoins: preP0.directCoins + preP0.pickupCoins,
      webPreP0ExpectedGenes: preP0.directGenes + preP0.pickupGenes,
      webPreP0LegacyDnaChancePct: preP0.legacyDnaChancePct,
      webPostP0Coins: plan.totalCoins,
      webPostP0Genes: plan.totalGenes,
      iosExpectedCoinsNoGolden: iosCoin,
      iosExpectedGenesWith38Pct: Number(iosGeneWith38.toFixed(2)),
      iosExpectedCoinsWith8PctGolden: Number(iosCoinWithGold.toFixed(2)),
      iosExpectedGenesWith8PctGolden: Number(iosGeneWith8Gold.toFixed(2)),
    });
  }

  // Prey ecology audit
  const activeSpecies = GAME_CONFIG.preyTiers.filter(
    (p) => !p.isHazard && Boolean(p.externalPngUrl)
  );
  const t1To17 = activeSpecies.filter((p) => p.tier >= 1 && p.tier <= 17 && !p.isBoss);
  const t1To17LegacyZero = t1To17.filter(
    (p) => computeWebPreP0LegacyPredationExpectation(p).dnaDropsCount === 0
  );
  const tierSet = new Set(activeSpecies.map((p) => p.tier));
  const missingPreyTiers: number[] = [];
  for (let t = 1; t <= 48; t++) {
    if (!tierSet.has(t)) missingPreyTiers.push(t);
  }

  return {
    perShark,
    perGeneration,
    totals,
    adPolicies: {
      webPlacements: AD_PLACEMENT_RULES,
      webActiveUiPlacements: ['DOUBLE_SETTLEMENT', 'SUPPLY_DROP', 'REVIVE', 'TRIAL_SHARK', 'INTERSTITIAL'],
      webDeadPlacements: [],
      iosPlacements: [
        {
          kind: 'SUPPLY_DROP',
          cooldownSec: ADS_AND_MONETIZATION_CONFIG.placements.SUPPLY_DROP.cooldownSec,
          dailyCap: ADS_AND_MONETIZATION_CONFIG.placements.SUPPLY_DROP.dailyCap,
          rewardCoins: '160~16,000 (按最高解锁世代缩放)',
          rewardGenes: '14~1,150 (按最高解锁世代缩放)',
          maxDailyFixedCoins:
            ADS_AND_MONETIZATION_CONFIG.placements.SUPPLY_DROP.rewardsByMaxUnlockedRow[0].coins *
            ADS_AND_MONETIZATION_CONFIG.placements.SUPPLY_DROP.dailyCap,
          maxDailyFixedGenes:
            ADS_AND_MONETIZATION_CONFIG.placements.SUPPLY_DROP.rewardsByMaxUnlockedRow[0].genes *
            ADS_AND_MONETIZATION_CONFIG.placements.SUPPLY_DROP.dailyCap,
        },
        {
          kind: 'DOUBLE_SETTLEMENT',
          cooldownSec: ADS_AND_MONETIZATION_CONFIG.placements.DOUBLE_SETTLEMENT.cooldownSec,
          dailyCap: ADS_AND_MONETIZATION_CONFIG.placements.DOUBLE_SETTLEMENT.dailyCap,
          rewardCoins: '2x 本局金币（不含王冠/试玩）',
          rewardGenes: '2x 本局基因（不含王冠/试玩）',
          maxDailyFixedCoins: 0,
          maxDailyFixedGenes: 0,
        },
        {
          kind: 'REVIVE',
          cooldownSec: ADS_AND_MONETIZATION_CONFIG.placements.REVIVE.cooldownSec,
          dailyCap: ADS_AND_MONETIZATION_CONFIG.placements.REVIVE.dailyCap,
          rewardCoins: '0 (6s狂暴+2.5s无敌，每局限1次)',
          rewardGenes: '0 (6s狂暴+2.5s无敌，每局限1次)',
          maxDailyFixedCoins: 0,
          maxDailyFixedGenes: 0,
        },
        {
          kind: 'TRIAL_SHARK',
          cooldownSec: ADS_AND_MONETIZATION_CONFIG.placements.TRIAL_SHARK.cooldownSec,
          dailyCap: ADS_AND_MONETIZATION_CONFIG.placements.TRIAL_SHARK.dailyCap,
          rewardCoins: '目标下一未解锁鲨 (UpLv.6/Lv.5/4.5s狂暴，禁王冠/2x)',
          rewardGenes: '目标下一未解锁鲨 (UpLv.6/Lv.5/4.5s狂暴，禁王冠/2x)',
          maxDailyFixedCoins: 0,
          maxDailyFixedGenes: 0,
        },
      ],
    },
    preySamples,
    preyEcologyAudit: {
      totalCatalogEntries: GAME_CONFIG.preyTiers.length,
      activeMarineSpeciesCount: activeSpecies.length,
      hazardCount: GAME_CONFIG.preyTiers.filter((p) => p.isHazard).length,
      t1To17NonBossCount: t1To17.length,
      t1To17LegacyWebDnaZeroCount: t1To17LegacyZero.length,
      missingPreyTiers,
    },
  };
}
