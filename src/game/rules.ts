import {
  GAME_CONFIG,
  OrganConfig,
  OrganSlotId,
  OceanZoneConfig,
  PreyTierConfig,
} from './config';

export type EquippedOrgansMap = Partial<Record<OrganSlotId, OrganConfig>>;

export interface ComputedSharkStats {
  level: number;
  scale: number;
  cameraZoom: number;
  maxHp: number;
  maxEnergy: number;
  moveSpeed: number;
  boostSpeed: number;
  biteTier: number;
  hpDrainPerSec: number;
  boostDrainPerSec: number;
  magnetRadius: number;
}

export function getXpRequiredForLevel(level: number): number {
  return Math.round(80 + (level - 1) * 55 + Math.pow(level - 1, 1.35) * 20);
}

export function computeSharkStats(
  level: number,
  equipped: EquippedOrgansMap,
  frenzyActive: boolean
): ComputedSharkStats {
  let speedBonus = 0;
  let biteTierBonus = 0;
  let hpDrainReduction = 0;
  let boostCostReduction = 0;
  let magnetRadiusBonus = 0;

  const slots: OrganSlotId[] = ['JAWS', 'DORSAL', 'TAIL', 'ARMOR', 'AURA'];
  for (const slot of slots) {
    const organ = equipped[slot];
    if (organ) {
      speedBonus += organ.stats.speedBonus;
      biteTierBonus += organ.stats.biteTierBonus;
      hpDrainReduction += organ.stats.hpDrainReduction;
      boostCostReduction += organ.stats.boostCostReduction;
      magnetRadiusBonus += organ.stats.magnetRadiusBonus;
    }
  }

  // Clamp reductions so they never exceed 75%
  hpDrainReduction = Math.min(0.75, hpDrainReduction);
  boostCostReduction = Math.min(0.75, boostCostReduction);

  // Level-based growth
  const scale = Number(Math.min(2.35, 1.0 + (level - 1) * 0.13 + Object.keys(equipped).length * 0.04).toFixed(3));
  // Smooth camera zoom out as shark grows from small predator to deep-sea leviathan
  const cameraZoom = Number(Math.max(0.54, 1.0 / (1 + (scale - 1) * 0.48)).toFixed(3));

  const levelBiteBonus = Math.floor(level / 2);
  const rawBiteTier = GAME_CONFIG.world.baseBiteTier + levelBiteBonus + biteTierBonus;
  const biteTier = frenzyActive ? 8 : Math.min(8, rawBiteTier);

  const baseSpeed = GAME_CONFIG.world.baseSharkSpeed * (1 + (level - 1) * 0.03 + speedBonus);
  const moveSpeed = Math.round(frenzyActive ? baseSpeed * 1.35 : baseSpeed);
  const boostSpeed = Math.round(moveSpeed * GAME_CONFIG.world.boostSpeedMultiplier);

  const hpDrainPerSec = frenzyActive
    ? 0
    : Number((GAME_CONFIG.world.baseHpDrainPerSec * (1 - hpDrainReduction)).toFixed(2));

  const boostDrainPerSec = frenzyActive
    ? 0
    : Number((GAME_CONFIG.world.baseBoostDrainPerSec * (1 - boostCostReduction)).toFixed(2));

  const magnetRadius = Math.round(
    (GAME_CONFIG.world.baseMagnetRadius + magnetRadiusBonus + (level - 1) * 12) *
      (frenzyActive ? 2.4 : 1.0)
  );

  return {
    level,
    scale,
    cameraZoom,
    maxHp: 100 + (level - 1) * 15,
    maxEnergy: 100,
    moveSpeed,
    boostSpeed,
    biteTier,
    hpDrainPerSec,
    boostDrainPerSec,
    magnetRadius,
  };
}

export interface EncounterOutcome {
  canDevour: boolean;
  hpDelta: number;
  xpGain: number;
  scoreGain: number;
  geneGain: number;
  coinGain: number;
  knockbackForce: number;
  floatTextKey: string;
  isCrit: boolean;
}

export function resolvePreyEncounter(
  sharkStats: ComputedSharkStats,
  prey: PreyTierConfig,
  frenzyActive: boolean,
  isBoosting: boolean
): EncounterOutcome {
  // Can devour if frenzy is active, or shark's biteTier >= prey.tier, or boosting into a mine with Jaws >= 5
  const canCrunchMine =
    prey.isHazard && (frenzyActive || sharkStats.biteTier >= prey.tier || (isBoosting && sharkStats.biteTier >= 5));
  const canDevour = frenzyActive || (prey.isHazard ? Boolean(canCrunchMine) : sharkStats.biteTier >= prey.tier);

  if (canDevour) {
    const isCrit = frenzyActive || isBoosting || prey.tier >= 3;
    const mult = frenzyActive ? 2 : 1;
    let floatTextKey = 'float_devour';
    if (prey.isBoss) floatTextKey = 'float_boss_kill';
    else if (prey.isHazard) floatTextKey = 'float_mine_crunch';
    else if (prey.tier === 3 || frenzyActive) floatTextKey = 'float_gold_rush';
    else if (isCrit) floatTextKey = 'float_crit';

    return {
      canDevour: true,
      hpDelta: prey.hpRestore,
      xpGain: prey.xpValue,
      scoreGain: prey.scoreValue * mult,
      geneGain: prey.geneValue * mult,
      coinGain: prey.coinValue * mult,
      knockbackForce: 0,
      floatTextKey,
      isCrit,
    };
  }

  // Otherwise shark takes damage and bounces back
  return {
    canDevour: false,
    hpDelta: -prey.damageOnFail,
    xpGain: 0,
    scoreGain: 0,
    geneGain: 0,
    coinGain: 0,
    knockbackForce: prey.isHazard ? 420 : 280,
    floatTextKey: prey.isHazard ? 'float_mine_hit' : 'float_too_big',
    isCrit: false,
  };
}

export interface LevelProgressResult {
  level: number;
  xp: number;
  xpToNext: number;
  leveledUpCount: number;
}

export function addEvolutionProgress(
  currentLevel: number,
  currentXp: number,
  xpGain: number
): LevelProgressResult {
  let level = currentLevel;
  let xp = currentXp + xpGain;
  let leveledUpCount = 0;
  let xpToNext = getXpRequiredForLevel(level);

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    leveledUpCount += 1;
    xpToNext = getXpRequiredForLevel(level);
  }

  return {
    level,
    xp,
    xpToNext,
    leveledUpCount,
  };
}

export function pickEvolutionChoices(
  equipped: EquippedOrgansMap,
  rng: () => number = Math.random
): OrganConfig[] {
  const equippedIds = new Set(
    Object.values(equipped)
      .filter((o): o is OrganConfig => Boolean(o))
      .map((o) => o.id)
  );

  // Prefer organs not currently equipped; fall back to full list if fewer than 3 unequipped
  const unequippedPool = GAME_CONFIG.organs.filter((o) => !equippedIds.has(o.id));
  const sourcePool = unequippedPool.length >= 3 ? [...unequippedPool] : [...GAME_CONFIG.organs];

  // Try to pick 3 organs from distinct slots or factions for rich strategic choice
  const picked: OrganConfig[] = [];
  const usedSlots = new Set<OrganSlotId>();

  const shuffled = [...sourcePool].sort(() => rng() - 0.5);
  for (const organ of shuffled) {
    if (picked.length < 3 && !usedSlots.has(organ.slot)) {
      picked.push(organ);
      usedSlots.add(organ.slot);
    }
  }
  for (const organ of shuffled) {
    if (picked.length < 3 && !picked.some((p) => p.id === organ.id)) {
      picked.push(organ);
    }
  }

  return picked.slice(0, 3);
}

export function getMaxMechaLoadout(): EquippedOrgansMap {
  const loadout: EquippedOrgansMap = {};
  for (const organ of GAME_CONFIG.organs) {
    if (organ.faction === 'MECHA') {
      loadout[organ.slot] = organ;
    }
  }
  return loadout;
}

export function getDepthZone(yWorld: number): OceanZoneConfig {
  const depthY = Math.max(0, yWorld);
  for (const zone of GAME_CONFIG.zones) {
    if (depthY >= zone.minDepth && depthY <= zone.maxDepth) {
      return zone;
    }
  }
  return GAME_CONFIG.zones[GAME_CONFIG.zones.length - 1];
}
