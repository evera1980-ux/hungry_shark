import preyEcologyJson from '../../shared/configs/prey_ecology_config.json';
import sharkEvolutionJson from '../../shared/configs/shark_evolution_config.json';
import type { PreyBehavior, PreyTierConfig } from './config';
import type { SpriteFrameKey } from './spriteSheetManager';

export type Prey140SizeClass = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '巨型';
export type Prey140Category =
  | '普通鱼类'
  | '大型海洋生物'
  | '巨型海洋生物'
  | '机械障碍';

export interface Prey140RawRecord {
  id: string;
  nameZh: string;
  nameEn: string;
  category: Prey140Category;
  realMinDepth: number;
  realMaxDepth: number;
  minLengthCm: number;
  maxLengthCm: number;
  bodyLengthCm: number;
  sizeClass: Prey140SizeClass;
  baseSpeed: number;
}

export interface PreyConfigEntry extends PreyTierConfig {
  nameZh: string;
  nameEn: string;
  category: Prey140Category;
  realMinDepth: number;
  realMaxDepth: number;
  sizeClass: Prey140SizeClass;
  gaitHint: string;
}

export const PREY_ECOLOGY_CONFIG = preyEcologyJson;
export const PREY_SPAWNER_RULES = preyEcologyJson.spawnerRules;

const ALL_SPECIES: PreyConfigEntry[] = preyEcologyJson.species as PreyConfigEntry[];
const ACTIVE_MARINE_SPECIES: PreyConfigEntry[] = ALL_SPECIES.filter(
  (p) => !p.isHazard
);

export const PREY_140_RECORDS: Prey140RawRecord[] = ACTIVE_MARINE_SPECIES.map(
  (entry) => ({
    id: entry.id,
    nameZh: entry.nameZh,
    nameEn: entry.nameEn,
    category: entry.category,
    realMinDepth: entry.realMinDepth,
    realMaxDepth: entry.realMaxDepth,
    minLengthCm: entry.minLengthCm ?? entry.bodyLengthCm,
    maxLengthCm: entry.maxLengthCm ?? entry.bodyLengthCm,
    bodyLengthCm: entry.bodyLengthCm,
    sizeClass: entry.sizeClass,
    baseSpeed: entry.baseSpeed,
  })
);

export const PREY_140_RECORD_BY_ID: Record<string, Prey140RawRecord> =
  Object.fromEntries(PREY_140_RECORDS.map((r) => [r.id, r]));

export const PREY_140_I18N_ZH: Record<string, string> = Object.fromEntries(
  PREY_140_RECORDS.map((r) => [`prey_140_${r.id}`, r.nameZh])
);

export const PREY_140_I18N_EN: Record<string, string> = Object.fromEntries(
  PREY_140_RECORDS.map((r) => [`prey_140_${r.id}`, r.nameEn])
);

export function getPrey140ImageUrl(id: string): string {
  return `/assets/prey_140/${id}@3x.webp`;
}

export const PREY_140_SHARK_LIKE_IDS = new Set<string>(
  ACTIVE_MARINE_SPECIES.filter((p) => p.gaitHint === 'shark').map((p) => p.id)
);

export const PREY_140_ELONGATED_IDS = new Set<string>(
  ACTIVE_MARINE_SPECIES.filter((p) => p.gaitHint === 'elongated').map((p) => p.id)
);

export const PREY_140_RIGID_IDS = new Set<string>(
  ACTIVE_MARINE_SPECIES.filter((p) => p.gaitHint === 'rigid').map((p) => p.id)
);

export const PREY_140_PUFFER_IDS = new Set<string>(
  ACTIVE_MARINE_SPECIES.filter((p) => p.gaitHint === 'puffer').map((p) => p.id)
);

/**
 * Computes Tier (T1~T48) strictly by biological body length against the 48-shark table loaded from shared config.
 */
export function getTierForPreyBodyLengthCm(bodyLengthCm: number): number {
  const sharks = sharkEvolutionJson.sharks;
  for (let i = 0; i < sharks.length; i++) {
    const form = sharks[i];
    const sharkLengthCm = Math.round(form.realBodyLengthM * 100);
    if (bodyLengthCm <= sharkLengthCm) {
      return form.baseBiteTier;
    }
  }
  return sharks[sharks.length - 1]?.baseBiteTier ?? 48;
}

export const PREY_140_TIER_BY_ID: Record<string, number> = Object.fromEntries(
  ACTIVE_MARINE_SPECIES.map((entry) => [entry.id, entry.tier])
);

export const PREY_140_TIER_GROUPS: string[][] = (() => {
  const groups: string[][] = Array.from({ length: 48 }, () => []);
  for (const entry of ACTIVE_MARINE_SPECIES) {
    const tier = Math.max(1, Math.min(48, entry.tier));
    groups[tier - 1].push(entry.id);
  }
  return groups;
})();

const SPECIES_BY_ID: Record<string, PreyConfigEntry> = Object.fromEntries(
  ALL_SPECIES.map((s) => [s.id, s])
);

export function computeMappedPrey140Config(
  rec: Prey140RawRecord
): PreyTierConfig {
  const existing = SPECIES_BY_ID[rec.id];
  if (existing) {
    return {
      tier: existing.tier,
      id: existing.id,
      nameKey: existing.nameKey,
      spriteKey: existing.spriteKey as SpriteFrameKey | undefined,
      minDepth: existing.minDepth,
      maxDepth: existing.maxDepth,
      radius: existing.radius,
      baseSpeed: existing.baseSpeed,
      bodyLengthCm: existing.bodyLengthCm,
      minLengthCm: existing.minLengthCm,
      maxLengthCm: existing.maxLengthCm,
      hpRestore: existing.hpRestore,
      xpValue: existing.xpValue,
      scoreValue: existing.scoreValue,
      geneValue: existing.geneValue,
      coinValue: existing.coinValue,
      damageOnFail: existing.damageOnFail,
      behavior: existing.behavior as PreyBehavior,
      primaryColor: existing.primaryColor,
      secondaryColor: existing.secondaryColor,
      glowColor: existing.glowColor,
      isHazard: Boolean(existing.isHazard),
      isBoss: Boolean(existing.isBoss),
      externalPngUrl: existing.externalPngUrl,
    };
  }
  throw new Error(`Unknown prey record id in prey_ecology_config.json: ${rec.id}`);
}

export function buildPrey140TiersWithMines(): PreyTierConfig[] {
  return ALL_SPECIES.map((entry) => ({
    tier: entry.tier,
    id: entry.id,
    nameKey: entry.nameKey,
    spriteKey: entry.spriteKey as SpriteFrameKey | undefined,
    minDepth: entry.minDepth,
    maxDepth: entry.maxDepth,
    radius: entry.radius,
    baseSpeed: entry.baseSpeed,
    bodyLengthCm: entry.bodyLengthCm,
    minLengthCm: entry.minLengthCm,
    maxLengthCm: entry.maxLengthCm,
    hpRestore: entry.hpRestore,
    xpValue: entry.xpValue,
    scoreValue: entry.scoreValue,
    geneValue: entry.geneValue,
    coinValue: entry.coinValue,
    damageOnFail: entry.damageOnFail,
    behavior: entry.behavior as PreyBehavior,
    primaryColor: entry.primaryColor,
    secondaryColor: entry.secondaryColor,
    glowColor: entry.glowColor,
    isHazard: Boolean(entry.isHazard),
    isBoss: Boolean(entry.isBoss),
    externalPngUrl: entry.externalPngUrl,
  }));
}
