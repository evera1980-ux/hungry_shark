import {
  FactionId,
  GAME_CONFIG,
  OrganConfig,
  OrganSlotId,
  OceanZoneConfig,
  PreyTierConfig,
} from './config';
import type { PreyMutationVariant } from './infiniteProgressionManager';

export type EquippedOrgansMap = Partial<Record<OrganSlotId, OrganConfig>>;
export type OrganStarsMap = Partial<Record<OrganSlotId, number>>;

export interface ComputedSharkStats {
  level: number;
  scale: number;
  relativePreyScale: number;
  cameraZoom: number;
  maxHp: number;
  maxEnergy: number;
  moveSpeed: number;
  boostSpeed: number;
  biteTier: number;
  hpDrainPerSec: number;
  boostDrainPerSec: number;
  magnetRadius: number;
  activeSynergy: FactionId | null;
  devourHealMultiplier: number;
  frenzyDurationBonus: number;
  totalOrganStars: number;
}

export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 140;
  return Math.round(140 + (level - 1) * 145 + Math.pow(level - 1, 1.75) * 65);
}

/**
 * Dynamic In-Run Economy Costs to prevent infinite overdrive / level-skip arbitrage
 */
export function getGoldOverdriveCost(useCount: number): number {
  return 35 + Math.max(0, useCount) * 25;
}

export function getGeneSurgeCost(level: number, useCount: number): number {
  return 15 + Math.max(0, level - 1) * 6 + Math.max(0, useCount) * 10;
}

export function getOrganRerollCost(rerollCount: number): number {
  return 8 + Math.max(0, rerollCount) * 4;
}

export function getEffectivePreyTier(
  prey: PreyTierConfig,
  mutationVariant: PreyMutationVariant = 'NONE'
): number {
  if (mutationVariant === 'ABYSS_BEHEMOTH') {
    return prey.tier + 1;
  }
  return prey.tier;
}

/**
 * Computes the visual & hitbox scale of a prey entity relative to the shark's current growth.
 * Instead of letting the shark balloon and block the screen, other fish shrink progressively
 * as the shark levels up—and outclassed lower-tier fish shrink even further into bite-sized minnows.
 */
export function getPreyRelativeVisualScale(
  prey: PreyTierConfig,
  sharkStats: Pick<ComputedSharkStats, 'biteTier' | 'relativePreyScale'>,
  mutationVariant: PreyMutationVariant = 'NONE'
): number {
  const baseRel = sharkStats.relativePreyScale ?? 1.0;
  const tierDiff = Math.max(0, sharkStats.biteTier - prey.tier);
  const outclassedShrink = prey.isHazard
    ? 1.0
    : Math.max(0.72, 1.0 - tierDiff * 0.06);
  const behemothBoost = mutationVariant === 'ABYSS_BEHEMOTH' ? 1.24 : 1.0;
  return Number(
    Math.max(0.34, Math.min(1.35, baseRel * outclassedShrink * behemothBoost)).toFixed(3)
  );
}

export function computeSharkStats(
  level: number,
  equipped: EquippedOrgansMap,
  frenzyActive: boolean,
  organStars: OrganStarsMap = {},
  globalDifficultyMultiplier: number = 1.0
): ComputedSharkStats {
  let speedBonus = 0;
  let biteTierBonus = 0;
  let hpDrainReduction = 0;
  let boostCostReduction = 0;
  let magnetRadiusBonus = 0;
  let totalOrganStars = 0;

  const factionCounts: Record<FactionId, number> = {
    MECHA: 0,
    ABYSS: 0,
    MAGMA: 0,
  };

  const slots: OrganSlotId[] = ['JAWS', 'DORSAL', 'TAIL', 'ARMOR', 'AURA'];
  for (const slot of slots) {
    const organ = equipped[slot];
    if (organ) {
      const star = Math.max(1, organStars[slot] ?? 1);
      totalOrganStars += star;
      const starMult = 1 + (star - 1) * 0.25;
      factionCounts[organ.faction] += 1;

      speedBonus += organ.stats.speedBonus * starMult;
      biteTierBonus += organ.stats.biteTierBonus;
      hpDrainReduction += organ.stats.hpDrainReduction * starMult;
      boostCostReduction += organ.stats.boostCostReduction * starMult;
      magnetRadiusBonus += organ.stats.magnetRadiusBonus * starMult;
    }
  }

  // Check 3-Piece Faction Set Synergy (>= 3 organs of the same faction)
  let activeSynergy: FactionId | null = null;
  let synergyMaxHpBonus = 0;
  let synergyMaxEnergyBonus = 0;
  let devourHealMultiplier = 1.0;
  let frenzyDurationBonus = 0;

  if (factionCounts.MECHA >= 3) {
    activeSynergy = 'MECHA';
    boostCostReduction += 0.15;
    magnetRadiusBonus += 90;
    synergyMaxEnergyBonus = 25;
  } else if (factionCounts.ABYSS >= 3) {
    activeSynergy = 'ABYSS';
    hpDrainReduction += 0.12;
    devourHealMultiplier = 1.35;
    synergyMaxHpBonus = 25;
  } else if (factionCounts.MAGMA >= 3) {
    activeSynergy = 'MAGMA';
    biteTierBonus += 1;
    speedBonus += 0.12;
    frenzyDurationBonus = 1.5;
  }

  // Clamp reductions so hunger pressure remains meaningful in late game (max 50% hunger drain reduction, 65% boost cost reduction)
  hpDrainReduction = Math.min(0.5, hpDrainReduction);
  boostCostReduction = Math.min(0.65, boostCostReduction);

  // Non-obstructive shark scale (capped at 1.28x so the shark never blocks the screen)
  // paired with progressive relative prey shrinking (1.00x -> 0.42x) to create the sensation of growing into a sea leviathan!
  const extraStars = Math.max(0, totalOrganStars - Object.keys(equipped).length);
  const scale = Number(
    Math.min(
      1.28,
      1.0 + (level - 1) * 0.032 + Object.keys(equipped).length * 0.015 + extraStars * 0.008
    ).toFixed(3)
  );
  const growthIndex =
    (level - 1) * 0.13 + Object.keys(equipped).length * 0.03 + extraStars * 0.012;
  const relativePreyScale = Number(
    Math.max(0.42, 1.0 / (1 + growthIndex)).toFixed(3)
  );
  // Subtle camera zoom out that preserves full environmental clarity and wide field of view
  const cameraZoom = Number(Math.max(0.88, 1.0 / (1 + (scale - 1) * 0.42)).toFixed(3));

  // Early levels (Lv.1~4) grant +1 Bite Tier at Lv.2 and Lv.4; after Lv.4 require 3 levels per +1 Bite Tier
  const levelBiteBonus =
    level <= 4 ? Math.floor(level / 2) : 2 + Math.floor((level - 4) / 3);
  const rawBiteTier = GAME_CONFIG.world.baseBiteTier + levelBiteBonus + biteTierBonus;
  const biteTier = frenzyActive ? 8 : Math.min(8, rawBiteTier);

  const baseSpeed = GAME_CONFIG.world.baseSharkSpeed * (1 + (level - 1) * 0.03 + speedBonus);
  const moveSpeed = Math.round(frenzyActive ? baseSpeed * 1.35 : baseSpeed);
  const boostSpeed = Math.round(moveSpeed * GAME_CONFIG.world.boostSpeedMultiplier);

  // Dynamic Metabolic Hunger Drain: bigger sharks & longer survival times require higher caloric intake
  const metabolicBaseDrain =
    (GAME_CONFIG.world.baseHpDrainPerSec + (level - 1) * 0.72) *
    (1 + Math.max(0, globalDifficultyMultiplier - 1.0) * 0.55);

  const hpDrainPerSec = frenzyActive
    ? 0
    : Number((metabolicBaseDrain * (1 - hpDrainReduction)).toFixed(2));

  const boostDrainPerSec = frenzyActive
    ? 0
    : Number((GAME_CONFIG.world.baseBoostDrainPerSec * (1 - boostCostReduction)).toFixed(2));

  const magnetRadius = Math.round(
    (GAME_CONFIG.world.baseMagnetRadius + magnetRadiusBonus + (level - 1) * 10) *
      (frenzyActive ? 1.35 : 1.0)
  );

  return {
    level,
    scale,
    relativePreyScale,
    cameraZoom,
    maxHp: 100 + (level - 1) * 15 + synergyMaxHpBonus,
    maxEnergy: 100 + (level - 1) * 4 + synergyMaxEnergyBonus,
    moveSpeed,
    boostSpeed,
    biteTier,
    hpDrainPerSec,
    boostDrainPerSec,
    magnetRadius,
    activeSynergy,
    devourHealMultiplier,
    frenzyDurationBonus,
    totalOrganStars,
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
  isBoosting: boolean,
  mutationVariant: PreyMutationVariant = 'NONE',
  globalDifficultyMultiplier: number = 1.0
): EncounterOutcome {
  const effectiveTier = getEffectivePreyTier(prey, mutationVariant);

  // T7+ Abyss Behemoths and T8 Bosses have reinforced armor: outside of Frenzy, the shark must both meet the tier requirement AND actively Boost to crunch through!
  const requiresBoostArmorBreak =
    (mutationVariant === 'ABYSS_BEHEMOTH' && prey.tier >= 7) || Boolean(prey.isBoss);
  const predatorGate = requiresBoostArmorBreak
    ? frenzyActive || (sharkStats.biteTier >= Math.min(8, effectiveTier) && isBoosting)
    : sharkStats.biteTier >= effectiveTier;

  // Deep-sea hazards (Naval Mines, Toxic Slime, Plasma Core) ALWAYS explode on contact unless Gold Frenzy is active!
  const canDevour = prey.isHazard ? frenzyActive : frenzyActive || predatorGate;

  if (canDevour) {
    const isCrit =
      frenzyActive || isBoosting || prey.tier >= 3 || mutationVariant !== 'NONE';
    const mult = frenzyActive ? 2 : 1;
    let floatTextKey = 'float_devour';
    if (prey.isBoss) floatTextKey = 'float_boss_kill';
    else if (prey.isHazard) floatTextKey = 'float_mine_crunch';
    else if (
      prey.tier === 3 ||
      frenzyActive ||
      mutationVariant === 'GOLDEN_MUTANT'
    )
      floatTextKey = 'float_gold_rush';
    else if (isCrit) floatTextKey = 'float_crit';

    const healMult = sharkStats.devourHealMultiplier ?? 1.0;
    // Scale normal hunting XP to 55% and Gold Frenzy XP to 22% so level-ups are well-paced and never spam the player
    const dampedXpGain = frenzyActive
      ? Math.max(2, Math.round(prey.xpValue * 0.22))
      : Math.max(3, Math.round(prey.xpValue * 0.55));

    return {
      canDevour: true,
      hpDelta: Math.round(prey.hpRestore * healMult),
      xpGain: dampedXpGain,
      scoreGain: prey.scoreValue * mult,
      geneGain: prey.geneValue * mult,
      coinGain: prey.coinValue * mult,
      knockbackForce: 0,
      floatTextKey,
      isCrit,
    };
  }

  // Otherwise shark takes damage scaled by mutation, global difficulty, and maxHP percentage (so high-level sharks are never invincible in the deep sea)
  const behemothDamageMult = mutationVariant === 'ABYSS_BEHEMOTH' ? 1.35 : 1.0;
  const maxHpPercentPenalty = prey.isHazard
    ? Math.round(sharkStats.maxHp * 0.14)
    : prey.tier >= 6 || mutationVariant === 'ABYSS_BEHEMOTH'
    ? Math.round(sharkStats.maxHp * 0.08)
    : 0;
  const scaledFailDamage = Math.max(
    1,
    Math.round(
      prey.damageOnFail *
        behemothDamageMult *
        Math.max(1.0, globalDifficultyMultiplier)
    ) + maxHpPercentPenalty
  );

  return {
    canDevour: false,
    hpDelta: -scaledFailDamage,
    xpGain: 0,
    scoreGain: 0,
    geneGain: 0,
    coinGain: 0,
    knockbackForce: prey.isHazard ? 440 : 300,
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

  // When fewer than 4 slots are filled, prioritize unequipped organs so player fills slots first;
  // afterwards mix all 15 organs so player can either Star-Upgrade occupied slots (★2..★5+) or pivot Faction Synergies
  const unequippedPool = GAME_CONFIG.organs.filter((o) => !equippedIds.has(o.id));
  const sourcePool =
    Object.keys(equipped).length < 4 && unequippedPool.length >= 3
      ? [...unequippedPool]
      : [...GAME_CONFIG.organs];

  // Pick 3 organs from distinct slots for rich strategic choice
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

