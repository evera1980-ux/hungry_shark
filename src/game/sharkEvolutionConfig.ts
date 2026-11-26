import worldAndProgressionJson from '../../shared/configs/world_and_progression_config.json';
import sharkEvolutionJson from '../../shared/configs/shark_evolution_config.json';
import crownMasteryJson from '../../shared/configs/crown_mastery_config.json';

export type SharkLineageId =
  | 'APEX_BIO'
  | 'CYBER_MECHA'
  | 'ELEMENTAL_CORE'
  | 'ELDER_ABYSS';

export type SharkSpriteKey =
  | 'SHARK_FORM_00'
  | 'SHARK_FORM_01'
  | 'SHARK_FORM_02'
  | 'SHARK_FORM_03'
  | 'SHARK_FORM_04'
  | 'SHARK_FORM_05'
  | 'SHARK_FORM_06'
  | 'SHARK_FORM_07'
  | 'SHARK_FORM_08'
  | 'SHARK_FORM_09'
  | 'SHARK_FORM_10'
  | 'SHARK_FORM_11'
  | 'SHARK_FORM_12'
  | 'SHARK_FORM_13'
  | 'SHARK_FORM_14'
  | 'SHARK_FORM_15'
  | 'SHARK_FORM_16'
  | 'SHARK_FORM_17'
  | 'SHARK_FORM_18'
  | 'SHARK_FORM_19'
  | 'SHARK_FORM_20'
  | 'SHARK_FORM_21'
  | 'SHARK_FORM_22'
  | 'SHARK_FORM_23'
  | 'SHARK_FORM_24'
  | 'SHARK_FORM_25'
  | 'SHARK_FORM_26'
  | 'SHARK_FORM_27'
  | 'SHARK_FORM_28'
  | 'SHARK_FORM_29'
  | 'SHARK_FORM_30'
  | 'SHARK_FORM_31'
  | 'SHARK_FORM_32'
  | 'SHARK_FORM_33'
  | 'SHARK_FORM_34'
  | 'SHARK_FORM_35'
  | 'SHARK_FORM_36'
  | 'SHARK_FORM_37'
  | 'SHARK_FORM_38'
  | 'SHARK_FORM_39'
  | 'SHARK_FORM_40'
  | 'SHARK_FORM_41'
  | 'SHARK_FORM_42'
  | 'SHARK_FORM_43'
  | 'SHARK_FORM_44'
  | 'SHARK_FORM_45'
  | 'SHARK_FORM_46'
  | 'SHARK_FORM_47';

export interface SharkTraitsConfig {
  coinYieldTraitMult: number;
  geneYieldTraitMult: number;
  bossRewardMult: number;
  specialPreyScoreMult: number;
  frenzyDurationBonus: number;
  jawSuctionMult: number;
  damageTakenMult: number;
  mineDamageTakenMult: number;
  knockbackMult: number;
  boostRegenMult: number;
  killEnergyBonus: number;
  maxComboBonus: number;
  goldenMutantReduction: number;
  canEatMines: boolean;
}

export interface SharkFormConfig {
  index: number; // 0..47
  row: number; // 0..5 (Generation I..VI)
  col: number; // 0..7
  generation: number; // 1..6
  id: string;
  spriteKey: SharkSpriteKey;
  /** Individual @3x super-resolved PNG asset URL (/assets/sharks_3x/shark_form_XX@3x.png) */
  sprite3xUrl: string;
  lineage: SharkLineageId;
  nameZh: string;
  nameEn: string;
  titleZh: string;
  titleEn: string;
  traitZh: string;
  traitEn: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  /** Authentic biological adult body length in meters (0.8m ~ 45.0m) */
  realBodyLengthM: number;
  /** Real biological cruising swim speed in m/s (1.2 ~ 7.0 m/s) */
  cruiseSpeedMps: number;
  /** Real biological burst boost swim speed in m/s (2.8 ~ 18.0 m/s) */
  boostSpeedMps: number;
  /** Base bite tier at Lv.1 before in-run level & upgrade bonuses */
  baseBiteTier: number;
  baseHp: number;
  baseEnergy: number;
  speedBonus: number;
  hpDrainReduction: number;
  boostCostReduction: number;
  magnetBonus: number;
  devourHealMult: number;
  scoreMult: number;
  /** Evolution Unlock Gates */
  reqParentUpgradeLevel: number;
  reqMaxInRunLevel: number;
  reqMaxDepth: number;
  unlockCoins: number;
  unlockGenes: number;
  baseUpgradeCoinCost: number;
  traits: SharkTraitsConfig;
}

export interface SharkMetaSaveData {
  version: number;
  bankedCoins: number;
  bankedGenes: number;
  unlockedSharkIds: string[];
  selectedSharkId: string;
  sharkUpgradeLevels: Record<string, number>;
  bestInRunLevel: number;
  bestDepthReached: number;
  totalRunsPlayed: number;
  /** Whether the one-time onboarding starter gift has already been claimed */
  onboardingGiftClaimed?: boolean;
  /** Per-shark personal best score (non-trial runs only) */
  sharkBestScores?: Record<string, number>;
  /** Per-shark highest claimed mastery crown tier (0 = none, 1 = Bronze, 2 = Silver, 3 = Gold) */
  sharkMasteryTiers?: Record<string, number>;
}

export interface PermanentProgressRunContext {
  trialActive: boolean;
  activeInRun?: boolean;
  sandboxOrCheatMode?: boolean;
}

export interface PermanentProgressEligibility {
  eligible: boolean;
  allowRunRecords: boolean;
  allowSharkMasteryAndCrown: boolean;
  allowSharkUnlockAndUpgrade: boolean;
  allowAchievements: boolean;
  allowMissions: boolean;
  allowEncyclopediaDiscovery: boolean;
  allowRunCountIncrement: boolean;
  allowTrialCurrencyCarryOver: boolean;
  allowDoubleSettlementAd: boolean;
}

export function isEligibleForPermanentProgress(
  runContext: PermanentProgressRunContext
): boolean {
  return !runContext.trialActive && !runContext.sandboxOrCheatMode;
}

export function getPermanentProgressEligibility(
  runContext: PermanentProgressRunContext
): PermanentProgressEligibility {
  const eligible = isEligibleForPermanentProgress(runContext);
  return {
    eligible,
    allowRunRecords: eligible,
    allowSharkMasteryAndCrown: eligible,
    allowSharkUnlockAndUpgrade: eligible,
    allowAchievements: eligible,
    allowMissions: eligible,
    allowEncyclopediaDiscovery: eligible,
    allowRunCountIncrement: eligible,
    allowTrialCurrencyCarryOver: !runContext.sandboxOrCheatMode,
    allowDoubleSettlementAd: eligible,
  };
}

export const LINEAGE_META: Record<
  SharkLineageId,
  {
    nameZh: string;
    nameEn: string;
    badgeColor: string;
    descZh: string;
    descEn: string;
  }
> = sharkEvolutionJson.lineageMeta as Record<
  SharkLineageId,
  {
    nameZh: string;
    nameEn: string;
    badgeColor: string;
    descZh: string;
    descEn: string;
  }
>;

export const GENERATION_NAMES: Array<{
  gen: number;
  nameZh: string;
  nameEn: string;
  color: string;
}> = sharkEvolutionJson.generations;

export const SHARK_EVOLUTION_FORMS: SharkFormConfig[] =
  sharkEvolutionJson.sharks as SharkFormConfig[];

const SHARK_BY_ID: Record<string, SharkFormConfig> = Object.fromEntries(
  SHARK_EVOLUTION_FORMS.map((s) => [s.id, s])
);

const META_SAVE_STORAGE_KEY = 'hungry_shark_evo_meta_v1';
const UPGRADE_CFG = worldAndProgressionJson.upgradeProgression;
const ATLAS_CFG = worldAndProgressionJson.atlasPassives;
const STARTER_CFG = worldAndProgressionJson.starterSaveDefaults;
const CROWN_SHARKS_BY_ID = Object.fromEntries(
  crownMasteryJson.sharks.map((s) => [s.sharkId, s.tiers])
);

export function getShark3xImageUrl(
  formOrIndexOrKey: SharkFormConfig | SharkSpriteKey | number
): string {
  let idx = 0;
  if (typeof formOrIndexOrKey === 'number') {
    idx = Math.max(0, Math.min(SHARK_EVOLUTION_FORMS.length - 1, formOrIndexOrKey));
  } else if (typeof formOrIndexOrKey === 'string') {
    const parsed = Number(formOrIndexOrKey.replace('SHARK_FORM_', ''));
    idx = Number.isFinite(parsed)
      ? Math.max(0, Math.min(SHARK_EVOLUTION_FORMS.length - 1, parsed))
      : 0;
  } else {
    idx = formOrIndexOrKey.index;
  }
  const padded = String(idx).padStart(2, '0');
  return `/assets/sharks_3x/shark_form_${padded}@3x.webp`;
}

export function getSharkFormById(id: string): SharkFormConfig {
  return SHARK_BY_ID[id] ?? SHARK_EVOLUTION_FORMS[0];
}

export function getSharkUpgradeCost(
  form: SharkFormConfig,
  currentLevel: number
): number {
  const maxLv = UPGRADE_CFG.maxUpgradeLevel;
  const lv = Math.max(1, Math.min(maxLv - 1, currentLevel));
  return Math.round(
    form.baseUpgradeCoinCost * Math.pow(UPGRADE_CFG.coinCostExponent, lv - 1)
  );
}

/**
 * Returns Gene Shard cost required at Bite Tier breakthrough gates (Lv.4->5 and Lv.9->10).
 */
export function getSharkUpgradeGeneCost(
  form: SharkFormConfig,
  currentLevel: number
): number {
  const refGenes = Math.max(UPGRADE_CFG.geneUnlockMinRef, form.unlockGenes);
  if (currentLevel === 4) {
    return Math.round(
      refGenes * UPGRADE_CFG.geneCostGateLv4.refMult +
        UPGRADE_CFG.geneCostGateLv4.flatBonus
    );
  }
  if (currentLevel === 9) {
    return Math.round(
      refGenes * UPGRADE_CFG.geneCostGateLv9.refMult +
        UPGRADE_CFG.geneCostGateLv9.flatBonus
    );
  }
  return 0;
}

export function getParentCandidatesForForm(
  form: SharkFormConfig
): SharkFormConfig[] {
  if (form.index <= 0) return [];
  const candidates: SharkFormConfig[] = [
    SHARK_EVOLUTION_FORMS[form.index - 1],
  ];
  if (UPGRADE_CFG.allowVerticalParentUnlock && form.row > 0) {
    const verticalParentIdx = (form.row - 1) * 8 + form.col;
    if (
      verticalParentIdx >= 0 &&
      verticalParentIdx < SHARK_EVOLUTION_FORMS.length &&
      verticalParentIdx !== form.index - 1
    ) {
      candidates.push(SHARK_EVOLUTION_FORMS[verticalParentIdx]);
    }
  }
  return candidates;
}

export interface UnlockCheckResult {
  alreadyUnlocked: boolean;
  canUnlockNow: boolean;
  parentMet: boolean;
  levelMet: boolean;
  depthMet: boolean;
  coinsMet: boolean;
  genesMet: boolean;
  bestParentId: string;
  bestParentIndex: number;
  bestParentNameZh: string;
  bestParentNameEn: string;
  bestParentCurrentLv: number;
}

export function evaluateSharkUnlock(
  form: SharkFormConfig,
  save: SharkMetaSaveData,
  liveRunCoins: number = 0,
  liveRunGenes: number = 0,
  liveRunLevel: number = 1,
  liveRunMaxDepth: number = 0
): UnlockCheckResult {
  const alreadyUnlocked = save.unlockedSharkIds.includes(form.id);
  const parents = getParentCandidatesForForm(form);
  let parentMet = form.index === 0;
  let bestParent = parents[0] ?? SHARK_EVOLUTION_FORMS[0];
  let bestParentCurrentLv = 10;

  if (parents.length > 0) {
    let highestUnlockedScore = -1;
    bestParentCurrentLv = 0;
    for (const p of parents) {
      const unlocked = save.unlockedSharkIds.includes(p.id);
      const lv = unlocked ? save.sharkUpgradeLevels[p.id] ?? 1 : 0;
      const rank = unlocked ? 100 + lv : lv;
      if (rank > highestUnlockedScore) {
        highestUnlockedScore = rank;
        bestParent = p;
        bestParentCurrentLv = lv;
      }
      if (unlocked && lv >= form.reqParentUpgradeLevel) {
        parentMet = true;
      }
    }
  }

  const effectiveBestLevel = Math.max(save.bestInRunLevel, liveRunLevel);
  const effectiveBestDepth = Math.max(save.bestDepthReached, liveRunMaxDepth);
  const effectiveCoins = save.bankedCoins + liveRunCoins;
  const effectiveGenes = save.bankedGenes + liveRunGenes;

  const levelMet = effectiveBestLevel >= form.reqMaxInRunLevel;
  const depthMet = effectiveBestDepth >= form.reqMaxDepth;
  const coinsMet = effectiveCoins >= form.unlockCoins;
  const genesMet = effectiveGenes >= form.unlockGenes;

  const canUnlockNow =
    !alreadyUnlocked &&
    parentMet &&
    levelMet &&
    depthMet &&
    coinsMet &&
    genesMet;

  return {
    alreadyUnlocked,
    canUnlockNow,
    parentMet,
    levelMet,
    depthMet,
    coinsMet,
    genesMet,
    bestParentId: bestParent.id,
    bestParentIndex: bestParent.index,
    bestParentNameZh: bestParent.nameZh,
    bestParentNameEn: bestParent.nameEn,
    bestParentCurrentLv,
  };
}

export function evaluateSharkUnlockForRun(
  form: SharkFormConfig,
  save: SharkMetaSaveData,
  runContext: PermanentProgressRunContext,
  liveRunCoins: number = 0,
  liveRunGenes: number = 0,
  liveRunLevel: number = 1,
  liveRunMaxDepth: number = 0
): UnlockCheckResult {
  const eligibility = getPermanentProgressEligibility(runContext);
  const safeLevel = eligibility.allowRunRecords ? liveRunLevel : 1;
  const safeDepth = eligibility.allowRunRecords ? liveRunMaxDepth : 0;
  const base = evaluateSharkUnlock(
    form,
    save,
    liveRunCoins,
    liveRunGenes,
    safeLevel,
    safeDepth
  );
  if (!eligibility.allowSharkUnlockAndUpgrade) {
    return {
      ...base,
      canUnlockNow: false,
    };
  }
  return base;
}

export function getNextEvolutionTarget(
  currentSharkId: string,
  save: SharkMetaSaveData
): SharkFormConfig | null {
  const currentIdx = SHARK_EVOLUTION_FORMS.findIndex((s) => s.id === currentSharkId);
  const startIdx = currentIdx >= 0 ? currentIdx + 1 : 0;
  for (let offset = 0; offset < SHARK_EVOLUTION_FORMS.length; offset++) {
    const candidate =
      SHARK_EVOLUTION_FORMS[(startIdx + offset) % SHARK_EVOLUTION_FORMS.length];
    if (!save.unlockedSharkIds.includes(candidate.id)) {
      return candidate;
    }
  }
  return null;
}

export function createDefaultMetaSave(): SharkMetaSaveData {
  return {
    version: STARTER_CFG.version,
    bankedCoins: STARTER_CFG.bankedCoins,
    bankedGenes: STARTER_CFG.bankedGenes,
    unlockedSharkIds: [...STARTER_CFG.unlockedSharkIds],
    selectedSharkId: STARTER_CFG.selectedSharkId,
    sharkUpgradeLevels: { ...STARTER_CFG.sharkUpgradeLevels },
    bestInRunLevel: STARTER_CFG.bestInRunLevel,
    bestDepthReached: STARTER_CFG.bestDepthReached,
    totalRunsPlayed: STARTER_CFG.totalRunsPlayed,
    onboardingGiftClaimed: STARTER_CFG.onboardingGiftClaimed,
    sharkBestScores: {},
    sharkMasteryTiers: {},
  };
}

export function loadSharkMetaSave(): SharkMetaSaveData {
  const defaults = createDefaultMetaSave();
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }
  try {
    const raw = window.localStorage.getItem(META_SAVE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SharkMetaSaveData>;
    const unlocked =
      Array.isArray(parsed.unlockedSharkIds) && parsed.unlockedSharkIds.length > 0
        ? Array.from(
            new Set([
              STARTER_CFG.selectedSharkId,
              ...parsed.unlockedSharkIds.filter((id) => Boolean(SHARK_BY_ID[id])),
            ])
          )
        : defaults.unlockedSharkIds;
    const upgradeLevels: Record<string, number> = {
      ...defaults.sharkUpgradeLevels,
      ...(parsed.sharkUpgradeLevels ?? {}),
    };
    const totalRuns =
      typeof parsed.totalRunsPlayed === 'number'
        ? Math.max(0, parsed.totalRunsPlayed)
        : 0;
    let tutorialLegacyDone = false;
    try {
      tutorialLegacyDone =
        window.localStorage.getItem('hungry_shark_tutorial_done_v1') === '1';
    } catch {
      tutorialLegacyDone = false;
    }
    const inferredClaimed =
      typeof parsed.onboardingGiftClaimed === 'boolean'
        ? parsed.onboardingGiftClaimed
        : tutorialLegacyDone ||
          totalRuns > 0 ||
          unlocked.length > 1 ||
          (upgradeLevels[STARTER_CFG.selectedSharkId] ?? 1) > 1;
    return {
      version: 1,
      bankedCoins:
        typeof parsed.bankedCoins === 'number'
          ? Math.max(0, Math.floor(parsed.bankedCoins))
          : defaults.bankedCoins,
      bankedGenes:
        typeof parsed.bankedGenes === 'number'
          ? Math.max(0, Math.floor(parsed.bankedGenes))
          : defaults.bankedGenes,
      unlockedSharkIds: unlocked,
      selectedSharkId:
        typeof parsed.selectedSharkId === 'string' &&
        unlocked.includes(parsed.selectedSharkId)
          ? parsed.selectedSharkId
          : unlocked[0],
      sharkUpgradeLevels: upgradeLevels,
      bestInRunLevel:
        typeof parsed.bestInRunLevel === 'number'
          ? Math.max(1, parsed.bestInRunLevel)
          : defaults.bestInRunLevel,
      bestDepthReached:
        typeof parsed.bestDepthReached === 'number'
          ? Math.max(defaults.bestDepthReached, parsed.bestDepthReached)
          : defaults.bestDepthReached,
      totalRunsPlayed: totalRuns,
      onboardingGiftClaimed: inferredClaimed,
      sharkBestScores:
        parsed.sharkBestScores && typeof parsed.sharkBestScores === 'object'
          ? { ...parsed.sharkBestScores }
          : {},
      sharkMasteryTiers:
        parsed.sharkMasteryTiers && typeof parsed.sharkMasteryTiers === 'object'
          ? { ...parsed.sharkMasteryTiers }
          : {},
    };
  } catch {
    return createDefaultMetaSave();
  }
}

export function recordFormalRunStarted(
  runContext: PermanentProgressRunContext,
  save: SharkMetaSaveData
): SharkMetaSaveData {
  const eligibility = getPermanentProgressEligibility(runContext);
  if (!eligibility.allowRunCountIncrement) {
    return save;
  }
  return {
    ...save,
    totalRunsPlayed: save.totalRunsPlayed + 1,
  };
}

export function recordPermanentRunProgress(
  save: SharkMetaSaveData,
  runContext: PermanentProgressRunContext,
  inRunLevel: number,
  maxDepthMeters: number
): SharkMetaSaveData {
  const eligibility = getPermanentProgressEligibility(runContext);
  if (!eligibility.allowRunRecords) {
    return save;
  }
  const nextBestLv = Math.max(save.bestInRunLevel, Math.floor(inRunLevel));
  const nextBestDepth = Math.max(save.bestDepthReached, Math.round(maxDepthMeters));
  if (
    nextBestLv === save.bestInRunLevel &&
    nextBestDepth === save.bestDepthReached
  ) {
    return save;
  }
  return {
    ...save,
    bestInRunLevel: nextBestLv,
    bestDepthReached: nextBestDepth,
  };
}

export function claimOnboardingStarterGift(
  save: SharkMetaSaveData,
  giftCoins: number = 80,
  giftGenes: number = 20
): { updatedSave: SharkMetaSaveData; granted: boolean } {
  if (save.onboardingGiftClaimed) {
    return { updatedSave: save, granted: false };
  }
  return {
    granted: true,
    updatedSave: {
      ...save,
      bankedCoins: save.bankedCoins + Math.max(0, Math.floor(giftCoins)),
      bankedGenes: save.bankedGenes + Math.max(0, Math.floor(giftGenes)),
      onboardingGiftClaimed: true,
    },
  };
}

export function saveSharkMetaSave(data: SharkMetaSaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(META_SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export interface SharkMasteryTierInfo {
  tier: 1 | 2 | 3;
  badgeIcon: '🥉' | '🥈' | '👑';
  nameZh: string;
  nameEn: string;
  scoreThreshold: number;
  coinReward: number;
  geneReward: number;
}

export function getSharkMasteryConfig(
  form: SharkFormConfig
): [SharkMasteryTierInfo, SharkMasteryTierInfo, SharkMasteryTierInfo] {
  const cfg = CROWN_SHARKS_BY_ID[form.id] ?? crownMasteryJson.sharks[0].tiers;
  return cfg.map((t) => ({
    tier: t.tier as 1 | 2 | 3,
    badgeIcon: t.badgeIcon as '🥉' | '🥈' | '👑',
    nameZh: t.nameZh,
    nameEn: t.nameEn,
    scoreThreshold: t.scoreThreshold,
    coinReward: t.coinReward,
    geneReward: t.geneReward,
  })) as [SharkMasteryTierInfo, SharkMasteryTierInfo, SharkMasteryTierInfo];
}

export interface SharkMasterySettlementResult {
  updatedSave: SharkMetaSaveData;
  prevBestScore: number;
  newBestScore: number;
  isNewRecord: boolean;
  prevCrownTier: number;
  newCrownTier: number;
  newlyUnlockedTiers: SharkMasteryTierInfo[];
  coinsAwarded: number;
  genesAwarded: number;
  nextThresholdScore: number | null;
}

/**
 * Evaluates & (unless previewOnly) settles Mastery Crowns cleanly from shared/configs/crown_mastery_config.json.
 * Strictly blocks Trial runs and grants each crown tier once per lifetime (no ad doubling).
 */
export function settleSharkScoreMastery(
  sharkFormId: string,
  runScore: number,
  trialActive: boolean,
  save: SharkMetaSaveData,
  options?: { previewOnly?: boolean }
): SharkMasterySettlementResult {
  const form = getSharkFormById(sharkFormId);
  const tiers = getSharkMasteryConfig(form);
  const bestScoresMap = save.sharkBestScores ?? {};
  const masteryMap = save.sharkMasteryTiers ?? {};

  const prevBestScore = bestScoresMap[form.id] ?? 0;
  const prevCrownTier = masteryMap[form.id] ?? 0;
  const eligibility = getPermanentProgressEligibility({ trialActive });
  const allowCrown = eligibility.allowSharkMasteryAndCrown && (!trialActive || crownMasteryJson.allowInTrial);

  if (!allowCrown) {
    return {
      updatedSave: save,
      prevBestScore,
      newBestScore: prevBestScore,
      isNewRecord: false,
      prevCrownTier,
      newCrownTier: prevCrownTier,
      newlyUnlockedTiers: [],
      coinsAwarded: 0,
      genesAwarded: 0,
      nextThresholdScore: tiers[0].scoreThreshold,
    };
  }

  const cleanScore = Math.max(0, Math.round(runScore));
  const newBestScore = Math.max(prevBestScore, cleanScore);
  const isNewRecord = cleanScore > prevBestScore && cleanScore > 0;

  let newCrownTier = prevCrownTier;
  let coinsAwarded = 0;
  let genesAwarded = 0;
  const newlyUnlockedTiers: SharkMasteryTierInfo[] = [];

  for (const tierInfo of tiers) {
    if (cleanScore >= tierInfo.scoreThreshold && tierInfo.tier > prevCrownTier) {
      newCrownTier = Math.max(newCrownTier, tierInfo.tier);
      coinsAwarded += tierInfo.coinReward;
      genesAwarded += tierInfo.geneReward;
      newlyUnlockedTiers.push(tierInfo);
    }
  }

  const nextTier = tiers.find((t) => t.tier > newCrownTier) ?? null;

  if (options?.previewOnly) {
    return {
      updatedSave: save,
      prevBestScore,
      newBestScore,
      isNewRecord,
      prevCrownTier,
      newCrownTier,
      newlyUnlockedTiers,
      coinsAwarded,
      genesAwarded,
      nextThresholdScore: nextTier ? nextTier.scoreThreshold : null,
    };
  }

  if (
    newBestScore === prevBestScore &&
    newCrownTier === prevCrownTier &&
    coinsAwarded === 0 &&
    genesAwarded === 0
  ) {
    return {
      updatedSave: save,
      prevBestScore,
      newBestScore,
      isNewRecord: false,
      prevCrownTier,
      newCrownTier,
      newlyUnlockedTiers,
      coinsAwarded: 0,
      genesAwarded: 0,
      nextThresholdScore: nextTier ? nextTier.scoreThreshold : null,
    };
  }

  const updatedSave: SharkMetaSaveData = {
    ...save,
    bankedCoins: save.bankedCoins + coinsAwarded,
    bankedGenes: save.bankedGenes + genesAwarded,
    sharkBestScores: {
      ...bestScoresMap,
      [form.id]: newBestScore,
    },
    sharkMasteryTiers: {
      ...masteryMap,
      [form.id]: newCrownTier,
    },
  };

  return {
    updatedSave,
    prevBestScore,
    newBestScore,
    isNewRecord,
    prevCrownTier,
    newCrownTier,
    newlyUnlockedTiers,
    coinsAwarded,
    genesAwarded,
    nextThresholdScore: nextTier ? nextTier.scoreThreshold : null,
  };
}

/**
 * Global Atlas passive bonuses loaded cleanly from shared/configs/world_and_progression_config.json (D3-A: Score +0.35%, HP +0.20%, 0% coin mult from crowns).
 */
export function getGlobalAtlasBonuses(save: SharkMetaSaveData): {
  unlockedCount: number;
  totalMasteryCrowns: number;
  hpMultiplier: number;
  speedBonus: number;
  scoreBonus: number;
  rewardMultiplier: number;
} {
  const unlockedCount = Math.max(1, save.unlockedSharkIds.length);
  const extraCount = unlockedCount - 1;
  const masteryMap = save.sharkMasteryTiers ?? {};
  const totalMasteryCrowns = Object.values(masteryMap).reduce(
    (sum, tier) => sum + Math.max(0, Math.min(3, tier || 0)),
    0
  );
  return {
    unlockedCount,
    totalMasteryCrowns,
    hpMultiplier: Number(
      (
        1 +
        extraCount * ATLAS_CFG.extraSharkHpBonusPerShark +
        totalMasteryCrowns * ATLAS_CFG.crownHpBonusPerCrown
      ).toFixed(4)
    ),
    speedBonus: Number(
      (extraCount * ATLAS_CFG.extraSharkSpeedBonusPerShark).toFixed(4)
    ),
    scoreBonus: Number(
      (totalMasteryCrowns * ATLAS_CFG.crownScoreBonusPerCrown).toFixed(4)
    ),
    rewardMultiplier: Number(
      (
        1 +
        extraCount * ATLAS_CFG.extraSharkRewardBonusPerShark +
        totalMasteryCrowns * ATLAS_CFG.crownRewardBonusPerCrown
      ).toFixed(4)
    ),
  };
}
