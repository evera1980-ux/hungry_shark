import type { SpriteFrameKey } from './spriteSheetManager';
import { buildPrey140TiersWithMines } from './preyDatabase140';

export type FactionId = 'MECHA' | 'ABYSS' | 'MAGMA';

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
  bodyLengthCm: number;
  minLengthCm?: number;
  maxLengthCm?: number;
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

