import { GAME_CONFIG, type PreyBehavior } from './config';
import {
  SHARK_EVOLUTION_FORMS,
  LINEAGE_META,
  type SharkLineageId,
} from './sharkEvolutionConfig';
import {
  SHARK_CELL_BOUNDS,
  SPRITE_CELL_BOUNDS,
  FISH2_CELL_BOUNDS,
  UI_ICON_GRID_MAP,
  UI_BANNER_BOUNDS,
  UI_SETTING_BOUNDS,
} from './spriteSheetManager';
import { I18N } from './i18n';
import { GOOGLE_ADS_CONFIG } from './adManager';

export const SHARED_GAME_DATA_SCHEMA_VERSION = 1;

export type NormalizedRectTuple = [number, number, number, number];
export type GridCoordTuple = [number, number];

export interface SharedWorldConfig {
  baseSharkSpeed: number;
  boostSpeedMultiplier: number;
  baseHpDrainPerSec: number;
  baseBoostDrainPerSec: number;
  baseBoostRegenPerSec: number;
  baseMagnetRadius: number;
  baseBiteTier: number;
  frenzyDuration: number;
}

export interface SharedAdsConfig {
  googleAdMobAppId: string;
  googleAdMobRewardedAdUnitId: string;
  googleAdMobBackupRewardedAdUnitId: string;
  googleH5ClientId: string;
  imaVastTagUrl: string;
  fallbackVideoStreamUrl: string;
}

export interface SharedLineageMeta {
  id: SharkLineageId;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  themeColorHex: string;
}

export interface SharedSharkFormConfig {
  index: number;
  row: number;
  col: number;
  generation: number;
  id: string;
  spriteKey: string;
  lineage: SharkLineageId;
  nameZh: string;
  nameEn: string;
  titleZh: string;
  titleEn: string;
  traitZh: string;
  traitEn: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  glowColorHex: string;
  realBodyLengthM: number;
  cruiseSpeedMps: number;
  boostSpeedMps: number;
  baseBiteTier: number;
  baseHp: number;
  baseEnergy: number;
  speedBonus: number;
  hpDrainReduction: number;
  boostCostReduction: number;
  magnetBonus: number;
  devourHealMult: number;
  scoreMult: number;
  reqParentUpgradeLevel: number;
  reqMaxInRunLevel: number;
  reqMaxDepth: number;
  unlockCoins: number;
  unlockGenes: number;
  baseUpgradeCoinCost: number;
  normalizedBounds: NormalizedRectTuple;
}

export interface SharedPreyTierConfig {
  tier: number;
  id: string;
  nameKey: string;
  nameZh: string;
  nameEn: string;
  spriteKey: string;
  sheetName: 'prey_140' | 'fish2_fc857cfa' | 'fish_24bdaa5a';
  minDepth: number;
  maxDepth: number;
  radius: number;
  baseSpeed: number;
  bodyLengthCm: number;
  minLengthCm: number;
  maxLengthCm: number;
  hpRestore: number;
  xpValue: number;
  scoreValue: number;
  geneValue: number;
  coinValue: number;
  damageOnFail: number;
  behavior: PreyBehavior;
  primaryColorHex: string;
  secondaryColorHex: string;
  glowColorHex: string;
  isHazard: boolean;
  isBoss: boolean;
  normalizedBounds: NormalizedRectTuple;
}

export interface SharedGameDataPayload {
  schemaVersion: number;
  world: SharedWorldConfig;
  ads: SharedAdsConfig;
  lineageMeta: Record<SharkLineageId, SharedLineageMeta>;
  sharkForms: SharedSharkFormConfig[];
  preyTiers: SharedPreyTierConfig[];
  uiIconGridMap: Record<string, GridCoordTuple>;
  uiBannerBounds: Record<string, NormalizedRectTuple>;
  uiSettingBounds: Record<string, NormalizedRectTuple>;
  i18n: {
    zh: Record<string, string>;
    en: Record<string, string>;
  };
}

function sanitizeFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Pure builder for the Cross-Platform Shared Game Data Contract (`shared/game_data.json`).
 * Consumed by both Web tests and iOS native `GameConfigGenerated.swift` (Codable JSON loader).
 */
export function buildSharedGameData(): SharedGameDataPayload {
  const lineageMeta = {} as Record<SharkLineageId, SharedLineageMeta>;
  for (const [key, meta] of Object.entries(LINEAGE_META) as [
    SharkLineageId,
    (typeof LINEAGE_META)[SharkLineageId],
  ][]) {
    lineageMeta[key] = {
      id: key,
      nameZh: meta.nameZh,
      nameEn: meta.nameEn,
      descZh: meta.descZh,
      descEn: meta.descEn,
      themeColorHex: meta.badgeColor,
    };
  }

  const sharkForms: SharedSharkFormConfig[] = SHARK_EVOLUTION_FORMS.map((s) => {
    const rawBounds = SHARK_CELL_BOUNDS[s.spriteKey] ?? [0, 0, 0.125, 0.166];
    return {
      index: s.index,
      row: s.row,
      col: s.col,
      generation: s.generation,
      id: s.id,
      spriteKey: s.spriteKey,
      lineage: s.lineage,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      titleZh: s.titleZh,
      titleEn: s.titleEn,
      traitZh: s.traitZh,
      traitEn: s.traitEn,
      primaryColorHex: s.primaryColor,
      secondaryColorHex: s.secondaryColor,
      glowColorHex: s.glowColor,
      realBodyLengthM: sanitizeFiniteNumber(s.realBodyLengthM, 1),
      cruiseSpeedMps: sanitizeFiniteNumber(s.cruiseSpeedMps, 1.2),
      boostSpeedMps: sanitizeFiniteNumber(s.boostSpeedMps, 2.8),
      baseBiteTier: s.baseBiteTier,
      baseHp: sanitizeFiniteNumber(s.baseHp, 100),
      baseEnergy: sanitizeFiniteNumber(s.baseEnergy, 100),
      speedBonus: sanitizeFiniteNumber(s.speedBonus, 0),
      hpDrainReduction: sanitizeFiniteNumber(s.hpDrainReduction, 0),
      boostCostReduction: sanitizeFiniteNumber(s.boostCostReduction, 0),
      magnetBonus: sanitizeFiniteNumber(s.magnetBonus, 0),
      devourHealMult: sanitizeFiniteNumber(s.devourHealMult, 1),
      scoreMult: sanitizeFiniteNumber(s.scoreMult, 1),
      reqParentUpgradeLevel: s.reqParentUpgradeLevel,
      reqMaxInRunLevel: s.reqMaxInRunLevel,
      reqMaxDepth: sanitizeFiniteNumber(s.reqMaxDepth, 0),
      unlockCoins: s.unlockCoins,
      unlockGenes: s.unlockGenes,
      baseUpgradeCoinCost: s.baseUpgradeCoinCost,
      normalizedBounds: [rawBounds[0], rawBounds[1], rawBounds[2], rawBounds[3]],
    };
  });

  const allPreyBounds: Record<string, NormalizedRectTuple> = {
    ...SPRITE_CELL_BOUNDS,
    ...FISH2_CELL_BOUNDS,
  };

  const zhDict = I18N.zh as Record<string, string>;
  const enDict = I18N.en as Record<string, string>;

  const preyTiers: SharedPreyTierConfig[] = GAME_CONFIG.preyTiers.map((p) => {
    const spKey = p.spriteKey ?? p.id;
    const isPrey140 = p.id.startsWith('PREY-');
    const isFish2 = spKey.startsWith('FISH2_');
    const rawBounds = allPreyBounds[spKey] ?? [0, 0, 1, 1];
    const bodyLengthCm = p.bodyLengthCm ?? Math.round(p.radius * 2.5);
    const sheetName: SharedPreyTierConfig['sheetName'] = isPrey140
      ? 'prey_140'
      : isFish2
      ? 'fish2_fc857cfa'
      : 'fish_24bdaa5a';

    return {
      tier: p.tier,
      id: p.id,
      nameKey: p.nameKey,
      nameZh: zhDict[p.nameKey] ?? p.id,
      nameEn: enDict[p.nameKey] ?? p.id,
      spriteKey: spKey,
      sheetName,
      minDepth: sanitizeFiniteNumber(p.minDepth, 0),
      maxDepth: sanitizeFiniteNumber(p.maxDepth, 99999),
      radius: sanitizeFiniteNumber(p.radius, 12),
      baseSpeed: sanitizeFiniteNumber(p.baseSpeed, 30),
      bodyLengthCm: sanitizeFiniteNumber(bodyLengthCm, 30),
      minLengthCm: sanitizeFiniteNumber(p.minLengthCm ?? bodyLengthCm, bodyLengthCm),
      maxLengthCm: sanitizeFiniteNumber(p.maxLengthCm ?? bodyLengthCm, bodyLengthCm),
      hpRestore: sanitizeFiniteNumber(p.hpRestore, 0),
      xpValue: p.xpValue,
      scoreValue: p.scoreValue,
      geneValue: p.geneValue,
      coinValue: p.coinValue,
      damageOnFail: sanitizeFiniteNumber(p.damageOnFail, 0),
      behavior: p.behavior,
      primaryColorHex: p.primaryColor,
      secondaryColorHex: p.secondaryColor,
      glowColorHex: p.glowColor,
      isHazard: Boolean(p.isHazard),
      isBoss: Boolean(p.isBoss),
      normalizedBounds: [rawBounds[0], rawBounds[1], rawBounds[2], rawBounds[3]],
    };
  });

  const uiIconGridMap: Record<string, GridCoordTuple> = {};
  for (const [k, [r, c]] of Object.entries(UI_ICON_GRID_MAP)) {
    uiIconGridMap[k] = [r, c];
  }

  const uiBannerBounds: Record<string, NormalizedRectTuple> = {};
  for (const [k, [x0, y0, x1, y1]] of Object.entries(UI_BANNER_BOUNDS)) {
    uiBannerBounds[k] = [x0, y0, x1, y1];
  }

  const uiSettingBounds: Record<string, NormalizedRectTuple> = {};
  for (const [k, [x0, y0, x1, y1]] of Object.entries(UI_SETTING_BOUNDS)) {
    uiSettingBounds[k] = [x0, y0, x1, y1];
  }

  return {
    schemaVersion: SHARED_GAME_DATA_SCHEMA_VERSION,
    world: {
      baseSharkSpeed: GAME_CONFIG.world.baseSharkSpeed,
      boostSpeedMultiplier: GAME_CONFIG.world.boostSpeedMultiplier,
      baseHpDrainPerSec: GAME_CONFIG.world.baseHpDrainPerSec,
      baseBoostDrainPerSec: GAME_CONFIG.world.baseBoostDrainPerSec,
      baseBoostRegenPerSec: GAME_CONFIG.world.baseBoostRegenPerSec,
      baseMagnetRadius: GAME_CONFIG.world.baseMagnetRadius,
      baseBiteTier: GAME_CONFIG.world.baseBiteTier,
      frenzyDuration: GAME_CONFIG.world.frenzyDuration,
    },
    ads: {
      googleAdMobAppId: GOOGLE_ADS_CONFIG.admobAppId,
      googleAdMobRewardedAdUnitId: GOOGLE_ADS_CONFIG.admobRewardedAdUnitId,
      googleAdMobBackupRewardedAdUnitId: GOOGLE_ADS_CONFIG.admobIosBackupRewardedAdUnitId,
      googleH5ClientId: GOOGLE_ADS_CONFIG.h5ClientId,
      imaVastTagUrl: GOOGLE_ADS_CONFIG.imaVastTagUrl,
      fallbackVideoStreamUrl: GOOGLE_ADS_CONFIG.fallbackVideoStreamUrl,
    },
    lineageMeta,
    sharkForms,
    preyTiers,
    uiIconGridMap,
    uiBannerBounds,
    uiSettingBounds,
    i18n: {
      zh: { ...zhDict },
      en: { ...enDict },
    },
  };
}
