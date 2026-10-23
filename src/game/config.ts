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
  minDepth: number; // 0 to 1800
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
    baseSharkSpeed: 280,
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
    // ==================== MECHA FACTION (5) ====================
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
        hpDrainReduction: 0,
        boostCostReduction: 0.05,
        magnetRadiusBonus: 20,
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
        speedBonus: 0.18,
        biteTierBonus: 0,
        hpDrainReduction: 0.08,
        boostCostReduction: 0.1,
        magnetRadiusBonus: 85,
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
        speedBonus: 0.22,
        biteTierBonus: 0,
        hpDrainReduction: 0,
        boostCostReduction: 0.25,
        magnetRadiusBonus: 30,
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
        speedBonus: 0.05,
        biteTierBonus: 1,
        hpDrainReduction: 0.25,
        boostCostReduction: 0.08,
        magnetRadiusBonus: 25,
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
        hpDrainReduction: 0.1,
        boostCostReduction: 0.12,
        magnetRadiusBonus: 150,
      },
      externalPngUrl: null,
    },

    // ==================== ABYSS FACTION (5) ====================
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
        speedBonus: 0.08,
        biteTierBonus: 1,
        hpDrainReduction: 0.08,
        boostCostReduction: 0,
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
        speedBonus: 0.14,
        biteTierBonus: 0,
        hpDrainReduction: 0.2,
        boostCostReduction: 0.12,
        magnetRadiusBonus: 60,
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
        speedBonus: 0.24,
        biteTierBonus: 0,
        hpDrainReduction: 0.05,
        boostCostReduction: 0.18,
        magnetRadiusBonus: 40,
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
        speedBonus: 0.04,
        biteTierBonus: 1,
        hpDrainReduction: 0.28,
        boostCostReduction: 0.05,
        magnetRadiusBonus: 30,
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
        speedBonus: 0.12,
        biteTierBonus: 0,
        hpDrainReduction: 0.12,
        boostCostReduction: 0.2,
        magnetRadiusBonus: 135,
      },
      externalPngUrl: null,
    },

    // ==================== MAGMA FACTION (5) ====================
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
        speedBonus: 0.1,
        biteTierBonus: 1,
        hpDrainReduction: 0.05,
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
        speedBonus: 0.16,
        biteTierBonus: 0,
        hpDrainReduction: 0.1,
        boostCostReduction: 0.22,
        magnetRadiusBonus: 55,
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
        speedBonus: 0.25,
        biteTierBonus: 0,
        hpDrainReduction: 0,
        boostCostReduction: 0.2,
        magnetRadiusBonus: 35,
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
        speedBonus: 0.06,
        biteTierBonus: 1,
        hpDrainReduction: 0.3,
        boostCostReduction: 0.05,
        magnetRadiusBonus: 20,
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
        speedBonus: 0.15,
        biteTierBonus: 0,
        hpDrainReduction: 0.1,
        boostCostReduction: 0.15,
        magnetRadiusBonus: 160,
      },
      externalPngUrl: null,
    },
  ] as OrganConfig[],

  preyTiers: [
    {
      tier: 1,
      id: 'gene_jelly',
      nameKey: 'prey_tier1_name',
      minDepth: 40,
      maxDepth: 1100,
      radius: 16,
      baseSpeed: 55,
      hpRestore: 8,
      xpValue: 14,
      scoreValue: 50,
      geneValue: 2,
      coinValue: 1,
      damageOnFail: 0,
      behavior: 'DRIFT_SWARM',
      primaryColor: '#4ade80',
      secondaryColor: '#2dd4bf',
      glowColor: '#86efac',
    },
    {
      tier: 2,
      id: 'coral_clownfish',
      nameKey: 'prey_tier2_name',
      minDepth: 30,
      maxDepth: 650,
      radius: 20,
      baseSpeed: 135,
      hpRestore: 11,
      xpValue: 20,
      scoreValue: 85,
      geneValue: 3,
      coinValue: 2,
      damageOnFail: 4,
      behavior: 'SCHOOL_FLEE',
      primaryColor: '#fb923c',
      secondaryColor: '#f8fafc',
      glowColor: '#fdba74',
    },
    {
      tier: 3,
      id: 'gold_puffer',
      nameKey: 'prey_tier3_name',
      minDepth: 160,
      maxDepth: 1050,
      radius: 26,
      baseSpeed: 110,
      hpRestore: 16,
      xpValue: 32,
      scoreValue: 160,
      geneValue: 5,
      coinValue: 8,
      damageOnFail: 10,
      behavior: 'PUFFER_INFLATE',
      primaryColor: '#facc15',
      secondaryColor: '#ca8a04',
      glowColor: '#fde047',
    },
    {
      tier: 4,
      id: 'probe_sub',
      nameKey: 'prey_tier4_name',
      minDepth: 380,
      maxDepth: 1350,
      radius: 34,
      baseSpeed: 145,
      hpRestore: 22,
      xpValue: 48,
      scoreValue: 280,
      geneValue: 8,
      coinValue: 12,
      damageOnFail: 14,
      behavior: 'SUB_PATROL',
      primaryColor: '#38bdf8',
      secondaryColor: '#cbd5e1',
      glowColor: '#7dd3fc',
    },
    {
      tier: 5,
      id: 'electric_eel',
      nameKey: 'prey_tier5_name',
      minDepth: 550,
      maxDepth: 1600,
      radius: 38,
      baseSpeed: 185,
      hpRestore: 28,
      xpValue: 68,
      scoreValue: 450,
      geneValue: 12,
      coinValue: 16,
      damageOnFail: 18,
      behavior: 'EEL_CHARGER',
      primaryColor: '#22d3ee',
      secondaryColor: '#6366f1',
      glowColor: '#67e8f9',
    },
    {
      tier: 6,
      id: 'cyber_mine',
      nameKey: 'prey_tier6_name',
      minDepth: 280,
      maxDepth: 1700,
      radius: 32,
      baseSpeed: 20,
      hpRestore: 20,
      xpValue: 55,
      scoreValue: 520,
      geneValue: 10,
      coinValue: 20,
      damageOnFail: 26,
      behavior: 'MINE_HAZARD',
      primaryColor: '#475569',
      secondaryColor: '#f43f5e',
      glowColor: '#fb7185',
      isHazard: true,
    },
    {
      tier: 7,
      id: 'magma_coelacanth',
      nameKey: 'prey_tier7_name',
      minDepth: 950,
      maxDepth: 1760,
      radius: 48,
      baseSpeed: 140,
      hpRestore: 36,
      xpValue: 95,
      scoreValue: 800,
      geneValue: 20,
      coinValue: 30,
      damageOnFail: 22,
      behavior: 'HEAVY_CRUISER',
      primaryColor: '#ea580c',
      secondaryColor: '#431407',
      glowColor: '#fb923c',
    },
    {
      tier: 8,
      id: 'cthulhu_kraken',
      nameKey: 'prey_tier8_name',
      minDepth: 1220,
      maxDepth: 1740,
      radius: 68,
      baseSpeed: 125,
      hpRestore: 65,
      xpValue: 180,
      scoreValue: 2000,
      geneValue: 50,
      coinValue: 80,
      damageOnFail: 30,
      behavior: 'KRAKEN_BOSS',
      primaryColor: '#9333ea',
      secondaryColor: '#4ade80',
      glowColor: '#d8b4fe',
      isBoss: true,
    },
  ] as PreyTierConfig[],
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
