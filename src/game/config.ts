import type { SpriteFrameKey } from './spriteSheetManager';
import { buildPrey140TiersWithMines } from './preyDatabase140';

export type FactionId = 'MECHA' | 'ABYSS' | 'MAGMA';
export type OrganSlotId = 'JAWS' | 'DORSAL' | 'TAIL' | 'ARMOR' | 'AURA';

export interface OrganStats {
  speedBonus: number;       // e.g. 0.18 = +18% speed
  biteTierBonus: number;    // e.g. 1 = +1 bite tier threshold
  hpDrainReduction: number; // e.g. 0.25 = -25% HP drain rate
  boostCostReduction: number; // e.g. 0.25 = -25% boost energy consumption
  magnetRadiusBonus: number;  // e.g. 90 = +90px magnet pull radius
}

export interface OrganConfig {
  id: string;
  faction: FactionId;
  slot: OrganSlotId;
  nameKey: string;
  descKey: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  stats: OrganStats;
  /** Reserved external PNG sprite path if replaced by custom asset */
  externalPngUrl?: string | null;
}

export type PreyBehavior =
  | 'DRIFT_SWARM'
  | 'SCHOOL_FLEE'
  | 'PUFFER_INFLATE'
  | 'SUB_PATROL'
  | 'EEL_CHARGER'
  | 'MINE_HAZARD'
  | 'HEAVY_CRUISER'
  | 'KRAKEN_BOSS';

export interface PreyTierConfig {
  tier: number;
  id: string;
  nameKey: string;
  spriteKey?: SpriteFrameKey;
  minDepth: number; // 0 to 1800+
  maxDepth: number;
  radius: number;
  baseSpeed: number;
  hpRestore: number;
  xpValue: number;
  scoreValue: number;
  geneValue: number;
  coinValue: number;
  damageOnFail: number;
  behavior: PreyBehavior;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  isHazard?: boolean;
  isBoss?: boolean;
  externalPngUrl?: string | null;
}

export interface OceanZoneConfig {
  id: 'shallow' | 'twilight' | 'abyss';
  nameKey: string;
  minDepth: number;
  maxDepth: number;
  topColor: string;
  bottomColor: string;
  accentColor: string;
}

export const GAME_CONFIG = {
  world: {
    width: 3000,
    height: 1800,
    baseSharkSpeed: 140,
    boostSpeedMultiplier: 2.0,
    baseHpDrainPerSec: 3.4,
    baseBoostDrainPerSec: 34,
    baseBoostRegenPerSec: 18,
    baseMagnetRadius: 110,
    baseBiteTier: 2,
    frenzyDuration: 8.0,
  },

  zones: [
    {
      id: 'shallow',
      nameKey: 'zone_shallow',
      minDepth: 0,
      maxDepth: 520,
      topColor: '#0284c7',
      bottomColor: '#0369a1',
      accentColor: '#38bdf8',
    },
    {
      id: 'twilight',
      nameKey: 'zone_twilight',
      minDepth: 520,
      maxDepth: 1150,
      topColor: '#0369a1',
      bottomColor: '#0f172a',
      accentColor: '#818cf8',
    },
    {
      id: 'abyss',
      nameKey: 'zone_abyss',
      minDepth: 1150,
      maxDepth: Number.POSITIVE_INFINITY,
      topColor: '#0f172a',
      bottomColor: '#020617',
      accentColor: '#c084fc',
    },
  ] as OceanZoneConfig[],

  organs: [
    // ==================== MECHA FACTION (5) — Specialization: Boost Efficiency & Magnet Radar ====================
    {
      id: 'mecha_jaws',
      faction: 'MECHA',
      slot: 'JAWS',
      nameKey: 'organ_mecha_jaws_name',
      descKey: 'organ_mecha_jaws_desc',
      primaryColor: '#38bdf8',
      secondaryColor: '#e2e8f0',
      glowColor: '#0ea5e9',
      stats: {
        speedBonus: 0.06,
        biteTierBonus: 1,
        hpDrainReduction: 0.04,
        boostCostReduction: 0.14,
        magnetRadiusBonus: 45,
      },
      externalPngUrl: null,
    },
    {
      id: 'mecha_dorsal',
      faction: 'MECHA',
      slot: 'DORSAL',
      nameKey: 'organ_mecha_dorsal_name',
      descKey: 'organ_mecha_dorsal_desc',
      primaryColor: '#0ea5e9',
      secondaryColor: '#94a3b8',
      glowColor: '#38bdf8',
      stats: {
        speedBonus: 0.15,
        biteTierBonus: 0,
        hpDrainReduction: 0.06,
        boostCostReduction: 0.18,
        magnetRadiusBonus: 95,
      },
      externalPngUrl: null,
    },
    {
      id: 'mecha_tail',
      faction: 'MECHA',
      slot: 'TAIL',
      nameKey: 'organ_mecha_tail_name',
      descKey: 'organ_mecha_tail_desc',
      primaryColor: '#0284c7',
      secondaryColor: '#f8fafc',
      glowColor: '#22d3ee',
      stats: {
        speedBonus: 0.2,
        biteTierBonus: 0,
        hpDrainReduction: 0,
        boostCostReduction: 0.28,
        magnetRadiusBonus: 40,
      },
      externalPngUrl: null,
    },
    {
      id: 'mecha_armor',
      faction: 'MECHA',
      slot: 'ARMOR',
      nameKey: 'organ_mecha_armor_name',
      descKey: 'organ_mecha_armor_desc',
      primaryColor: '#475569',
      secondaryColor: '#38bdf8',
      glowColor: '#0ea5e9',
      stats: {
        speedBonus: 0.06,
        biteTierBonus: 0,
        hpDrainReduction: 0.18,
        boostCostReduction: 0.16,
        magnetRadiusBonus: 55,
      },
      externalPngUrl: null,
    },
    {
      id: 'mecha_aura',
      faction: 'MECHA',
      slot: 'AURA',
      nameKey: 'organ_mecha_aura_name',
      descKey: 'organ_mecha_aura_desc',
      primaryColor: '#22d3ee',
      secondaryColor: '#0ea5e9',
      glowColor: '#67e8f9',
      stats: {
        speedBonus: 0.1,
        biteTierBonus: 0,
        hpDrainReduction: 0.08,
        boostCostReduction: 0.18,
        magnetRadiusBonus: 185,
      },
      externalPngUrl: null,
    },

    // ==================== ABYSS FACTION (5) — Specialization: Vitality Sustain & Hunger Drain Reduction ====================
    {
      id: 'abyss_jaws',
      faction: 'ABYSS',
      slot: 'JAWS',
      nameKey: 'organ_abyss_jaws_name',
      descKey: 'organ_abyss_jaws_desc',
      primaryColor: '#a855f7',
      secondaryColor: '#4ade80',
      glowColor: '#c084fc',
      stats: {
        speedBonus: 0.07,
        biteTierBonus: 1,
        hpDrainReduction: 0.14,
        boostCostReduction: 0.05,
        magnetRadiusBonus: 35,
      },
      externalPngUrl: null,
    },
    {
      id: 'abyss_dorsal',
      faction: 'ABYSS',
      slot: 'DORSAL',
      nameKey: 'organ_abyss_dorsal_name',
      descKey: 'organ_abyss_dorsal_desc',
      primaryColor: '#9333ea',
      secondaryColor: '#f43f5e',
      glowColor: '#e879f9',
      stats: {
        speedBonus: 0.13,
        biteTierBonus: 0,
        hpDrainReduction: 0.2,
        boostCostReduction: 0.1,
        magnetRadiusBonus: 65,
      },
      externalPngUrl: null,
    },
    {
      id: 'abyss_tail',
      faction: 'ABYSS',
      slot: 'TAIL',
      nameKey: 'organ_abyss_tail_name',
      descKey: 'organ_abyss_tail_desc',
      primaryColor: '#7e22ce',
      secondaryColor: '#2dd4bf',
      glowColor: '#a855f7',
      stats: {
        speedBonus: 0.22,
        biteTierBonus: 0,
        hpDrainReduction: 0.12,
        boostCostReduction: 0.15,
        magnetRadiusBonus: 45,
      },
      externalPngUrl: null,
    },
    {
      id: 'abyss_armor',
      faction: 'ABYSS',
      slot: 'ARMOR',
      nameKey: 'organ_abyss_armor_name',
      descKey: 'organ_abyss_armor_desc',
      primaryColor: '#3b0764',
      secondaryColor: '#10b981',
      glowColor: '#a855f7',
      stats: {
        speedBonus: 0.05,
        biteTierBonus: 0,
        hpDrainReduction: 0.26,
        boostCostReduction: 0.08,
        magnetRadiusBonus: 40,
      },
      externalPngUrl: null,
    },
    {
      id: 'abyss_aura',
      faction: 'ABYSS',
      slot: 'AURA',
      nameKey: 'organ_abyss_aura_name',
      descKey: 'organ_abyss_aura_desc',
      primaryColor: '#c084fc',
      secondaryColor: '#34d399',
      glowColor: '#d8b4fe',
      stats: {
        speedBonus: 0.11,
        biteTierBonus: 0,
        hpDrainReduction: 0.18,
        boostCostReduction: 0.16,
        magnetRadiusBonus: 145,
      },
      externalPngUrl: null,
    },

    // ==================== MAGMA FACTION (5) — Specialization: Apex Swim Velocity & Predatory Ferocity ====================
    {
      id: 'magma_jaws',
      faction: 'MAGMA',
      slot: 'JAWS',
      nameKey: 'organ_magma_jaws_name',
      descKey: 'organ_magma_jaws_desc',
      primaryColor: '#f97316',
      secondaryColor: '#fde047',
      glowColor: '#fb923c',
      stats: {
        speedBonus: 0.14,
        biteTierBonus: 1,
        hpDrainReduction: 0.04,
        boostCostReduction: 0.08,
        magnetRadiusBonus: 25,
      },
      externalPngUrl: null,
    },
    {
      id: 'magma_dorsal',
      faction: 'MAGMA',
      slot: 'DORSAL',
      nameKey: 'organ_magma_dorsal_name',
      descKey: 'organ_magma_dorsal_desc',
      primaryColor: '#ea580c',
      secondaryColor: '#facc15',
      glowColor: '#f97316',
      stats: {
        speedBonus: 0.21,
        biteTierBonus: 0,
        hpDrainReduction: 0.06,
        boostCostReduction: 0.2,
        magnetRadiusBonus: 45,
      },
      externalPngUrl: null,
    },
    {
      id: 'magma_tail',
      faction: 'MAGMA',
      slot: 'TAIL',
      nameKey: 'organ_magma_tail_name',
      descKey: 'organ_magma_tail_desc',
      primaryColor: '#dc2626',
      secondaryColor: '#fde047',
      glowColor: '#f59e0b',
      stats: {
        speedBonus: 0.28,
        biteTierBonus: 0,
        hpDrainReduction: 0,
        boostCostReduction: 0.18,
        magnetRadiusBonus: 30,
      },
      externalPngUrl: null,
    },
    {
      id: 'magma_armor',
      faction: 'MAGMA',
      slot: 'ARMOR',
      nameKey: 'organ_magma_armor_name',
      descKey: 'organ_magma_armor_desc',
      primaryColor: '#7c2d12',
      secondaryColor: '#fb923c',
      glowColor: '#f97316',
      stats: {
        speedBonus: 0.12,
        biteTierBonus: 0,
        hpDrainReduction: 0.2,
        boostCostReduction: 0.1,
        magnetRadiusBonus: 30,
      },
      externalPngUrl: null,
    },
    {
      id: 'magma_aura',
      faction: 'MAGMA',
      slot: 'AURA',
      nameKey: 'organ_magma_aura_name',
      descKey: 'organ_magma_aura_desc',
      primaryColor: '#fbbf24',
      secondaryColor: '#f97316',
      glowColor: '#fde047',
      stats: {
        speedBonus: 0.18,
        biteTierBonus: 0,
        hpDrainReduction: 0.06,
        boostCostReduction: 0.14,
        magnetRadiusBonus: 130,
      },
      externalPngUrl: null,
    },
  ] as OrganConfig[],

  preyTiers: buildPrey140TiersWithMines(),
};

/**
 * Reserved External PNG Texture Cache
 * Allows drop-in replacement of procedural Canvas parts with external PNG images.
 */
export const EXTERNAL_SPRITE_CACHE: Record<string, HTMLImageElement> = {};

export function registerExternalSprite(key: string, url: string): void {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  EXTERNAL_SPRITE_CACHE[key] = img;
}

