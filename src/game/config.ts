import worldAndProgressionJson from '../../shared/configs/world_and_progression_config.json';
import { buildPrey140TiersWithMines } from './preyDatabase140';
import type { SpriteFrameKey } from './spriteSheetManager';

export type FactionId = 'MECHA' | 'ABYSS' | 'MAGMA';

export type PreyBehavior =
  | 'DRIFT_SWARM'
  | 'SWARM_CRUISE'
  | 'JELLY_PULSE'
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
  /** Real @3x pre-trimmed biological sprite PNG URL */
  externalPngUrl?: string;
  minDepth: number;
  maxDepth: number;
  radius: number;
  baseSpeed: number;
  /** Authentic biological adult length (cm) for linear size & spawn scaling */
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
}

export interface OceanZoneConfig {
  id: string;
  nameKey: string;
  minDepth: number;
  maxDepth: number | null;
  topColor: string;
  bottomColor: string;
  accentColor: string;
}

export const WORLD_AND_PROGRESSION_CONFIG = worldAndProgressionJson;

export const GAME_CONFIG = {
  world: {
    width: worldAndProgressionJson.world.width,
    height: worldAndProgressionJson.world.height,
    baseSharkSpeed: worldAndProgressionJson.world.baseSharkSpeed,
    boostSpeedMultiplier: worldAndProgressionJson.world.boostSpeedMultiplier,
    baseHpDrainPerSec: worldAndProgressionJson.world.baseHpDrainPerSec,
    baseBoostDrainPerSec: worldAndProgressionJson.world.baseBoostDrainPerSec,
    baseBoostRegenPerSec: worldAndProgressionJson.world.baseBoostRegenPerSec,
    baseMagnetRadius: worldAndProgressionJson.world.baseMagnetRadius,
    baseBiteTier: worldAndProgressionJson.world.baseBiteTier,
    frenzyDuration: worldAndProgressionJson.world.frenzyDuration,
  },

  zones: worldAndProgressionJson.zones as OceanZoneConfig[],

  /** Active biological marine species + cyber_mine loaded directly from shared/configs/prey_ecology_config.json */
  preyTiers: buildPrey140TiersWithMines(),
};

export const EXTERNAL_SPRITE_CACHE: Record<string, HTMLImageElement> = {};

export function registerExternalSprite(key: string, url: string): void {
  if (typeof Image === 'undefined') return;
  if (EXTERNAL_SPRITE_CACHE[key]) return;
  const img = new Image();
  img.src = url;
  EXTERNAL_SPRITE_CACHE[key] = img;
}
