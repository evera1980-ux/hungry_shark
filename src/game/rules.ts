import {
  FactionId,
  GAME_CONFIG,
  OrganConfig,
  OrganSlotId,
  OceanZoneConfig,
  PreyTierConfig,
} from './config';
import type { PreyMutationVariant } from './infiniteProgressionManager';
import { getSharkFormById } from './sharkEvolutionConfig';

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
  normalBiteTier?: number;
  hpDrainPerSec: number;
  boostDrainPerSec: number;
  magnetRadius: number;
  activeSynergy: FactionId | null;
  devourHealMultiplier: number;
  frenzyDurationBonus: number;
  totalOrganStars: number;
  sharkFormId?: string;
  upgradeLevel?: number;
  scoreMultiplier?: number;
  rewardMultiplier?: number;
  canEatMines?: boolean;
}

export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 140;
  return Math.round(140 + (level - 1) * 145 + Math.pow(level - 1, 1.75) * 65);
}

/**
 * Dynamic In-Run Economy Costs (Generation-Anchored + Quadratic Acceleration)
 * - First 1~2 uses remain affordable for emergency saves in early runs.
 * - Quadratic `n^2` acceleration + generation row multiplier (`row = 0..5`) prevents
 *   late-game deep-sea infinite Gold Frenzy / Gene Surge loop arbitrage.
 */
export function getGoldOverdriveCost(
  useCount: number,
  generationRow: number = 0
): number {
  const n = Math.max(0, useCount);
  const rowMult = 1 + Math.max(0, generationRow) * 0.35;
  return Math.round((35 + n * 25 + n * n * 12) * rowMult);
}

export function getGeneSurgeCost(
  level: number,
  useCount: number,
  generationRow: number = 0
): number {
  const lv = Math.max(1, level);
  const n = Math.max(0, useCount);
  const rowMult = 1 + Math.max(0, generationRow) * 0.25;
  return Math.round((12 + (lv - 1) * 5 + n * 10 + n * n * 6) * rowMult);
}

export function getOrganRerollCost(rerollCount: number): number {
  return 8 + Math.max(0, rerollCount) * 4;
}

export const SHARK_BASE_DRAW_SIZE = 96;
export const PREY_RADIUS_TO_DRAW_SIZE = 2.25;
export const SHARK_EQUIVALENT_RADIUS =
  SHARK_BASE_DRAW_SIZE / PREY_RADIUS_TO_DRAW_SIZE; // 42.6667

export function getEffectivePreyTier(
  prey: PreyTierConfig,
  mutationVariant: PreyMutationVariant = 'NONE'
): number {
  if (mutationVariant === 'ABYSS_BEHEMOTH') {
    return Math.min(8, prey.tier + 1);
  }
  return prey.tier;
}

/**
 * Computes the visual & hitbox scale of a prey entity relative to the shark's current on-screen size.
 * Core visual-gameplay contract:
 * 1. Normal State (`frenzyActive === false`):
 *    - Any prey that can be directly swallowed (`canDevourNormally === true`) is rendered STRICTLY SMALLER
 *      than the player's shark on screen (`preyDrawSize <= 0.64 * sharkDrawSize`), and shrinks progressively
 *      as the shark's biteTier and in-run level (`relativePreyScale`) increase.
 *    - Any prey/hazard that deals damage on contact (`canDevourNormally === false`) is rendered EQUAL TO OR
 *      LARGER than the player's shark on screen (`preyDrawSize >= 1.18 * sharkDrawSize`), scaling up with tier gap.
 * 2. Gold Frenzy Special Exception (`frenzyActive === true`):
 *    - Entering Gold Frenzy temporarily boosts bite power to swallow everything (`resolvePreyEncounter` -> DEVOUR),
 *      but DOES NOT shrink other fish! All fish and giant deep-sea monsters preserve their pre-frenzy visual size
 *      (`normalBiteTier`) so hunting and devouring massive predators during Gold Frenzy feels maximally rewarding.
 */
export function getPreyRelativeVisualScale(
  prey: PreyTierConfig,
  sharkStats: Pick<ComputedSharkStats, 'biteTier' | 'relativePreyScale'> &
    Partial<Pick<ComputedSharkStats, 'scale' | 'canEatMines' | 'normalBiteTier'>>,
  mutationVariant: PreyMutationVariant = 'NONE',
  _frenzyActive: boolean = false
): number {
  const sharkScale = sharkStats.scale ?? 1.0;
  const baseRel = sharkStats.relativePreyScale ?? 1.0;
  const effectiveTier = getEffectivePreyTier(prey, mutationVariant);
  // Always use the shark's pre-frenzy normalBiteTier for visual sizing so Gold Frenzy never shrinks giant prey
  const visualBiteTier = sharkStats.normalBiteTier ?? sharkStats.biteTier;

  const canDevourNormally = prey.isHazard
    ? Boolean(sharkStats.canEatMines)
    : visualBiteTier >= effectiveTier;

  // Scale factor at which `prey.radius * visualScale * 2.25 === 96 * sharkScale` (exact 1:1 visual parity with player shark)
  const sharkParityScale =
    (SHARK_EQUIVALENT_RADIUS * sharkScale) / Math.max(1, prey.radius);

  if (canDevourNormally) {
    // Edible fish: strictly smaller than the player's shark (<= 64% of shark's linear size)
    const tierDiff = Math.max(0, visualBiteTier - effectiveTier);
    const tierRatio = Math.max(0.18, 0.64 * Math.pow(0.79, tierDiff));
    const levelShrink = 0.64 + 0.36 * baseRel;
    const targetSharkRatio = Math.max(
      0.16,
      Math.min(0.64, tierRatio * levelShrink)
    );
    return Number((sharkParityScale * targetSharkRatio).toFixed(3));
  }

  // Inedible / dangerous fish (or giant prey during Gold Frenzy): strictly >= 118% of shark's linear size
  const overTier = Math.max(1, effectiveTier - visualBiteTier);
  const behemothExtra = mutationVariant === 'ABYSS_BEHEMOTH' ? 0.12 : 0;
  const bossExtra = prey.isBoss ? 0.14 : 0;
  const targetDangerRatio = Math.min(
    1.95,
    1.18 + (overTier - 1) * 0.17 + behemothExtra + bossExtra
  );
  return Number((sharkParityScale * targetDangerRatio).toFixed(3));
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
  const normalBiteTier = Math.min(8, rawBiteTier);
  const biteTier = frenzyActive ? 8 : normalBiteTier;

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
    normalBiteTier,
    hpDrainPerSec,
    boostDrainPerSec,
    magnetRadius,
    activeSynergy,
    devourHealMultiplier,
    frenzyDurationBonus,
    totalOrganStars,
  };
}

/**
 * Computes stats for the 48-Form Shark Evolution System (combining Shark Form Generation,
 * Persistent Coin Upgrade Level 1..10, In-Run Level, and Global Atlas Collection Bonuses).
 */
export function computeEvolvedSharkStats(
  inRunLevel: number,
  sharkFormId: string,
  upgradeLevel: number = 1,
  frenzyActive: boolean = false,
  globalDifficultyMultiplier: number = 1.0,
  unlockedCount: number = 1
): ComputedSharkStats {
  const form = getSharkFormById(sharkFormId);
  const upLv = Math.max(1, Math.min(10, upgradeLevel));
  const extraUnlocked = Math.max(0, unlockedCount - 1);

  // Global Atlas collection bonuses
  const collectionHpMult = 1 + extraUnlocked * 0.02;
  const collectionSpeedBonus = extraUnlocked * 0.008;
  const collectionRewardMult = 1 + extraUnlocked * 0.025;

  // Upgrade level (1..10) bonuses on the current shark form
  const upgradeHpMult = 1 + (upLv - 1) * 0.08;
  const upgradeSpeedBonus = (upLv - 1) * 0.022;
  const upgradeDrainRed = (upLv - 1) * 0.015;
  const upgradeBoostRed = (upLv - 1) * 0.018;
  const upgradeBiteBonus = upLv >= 10 ? 2 : upLv >= 5 ? 1 : 0;

  // In-run level Bite Tier growth (capped by generation ceiling so evolving to higher generations unlocks higher prey tiers!)
  const inRunBiteBonus =
    form.index === 0 && inRunLevel >= 2
      ? 1 + Math.floor((inRunLevel - 2) / 3)
      : Math.floor((inRunLevel - 1) / 3);
  const genMaxBiteTier = Math.min(8, form.baseBiteTier + 2);
  const rawBiteTier = Math.min(
    genMaxBiteTier,
    form.baseBiteTier + upgradeBiteBonus + inRunBiteBonus
  );
  const normalBiteTier = Math.min(8, rawBiteTier);
  const biteTier = frenzyActive ? 8 : normalBiteTier;

  // Non-obstructive shark scale (1.0 -> 1.28) + progressive relative prey shrinking (1.0 -> 0.40)
  const scale = Number(
    Math.min(
      1.28,
      1.0 + (inRunLevel - 1) * 0.028 + form.row * 0.025 + (upLv - 1) * 0.006
    ).toFixed(3)
  );
  const growthIndex =
    (inRunLevel - 1) * 0.12 + form.row * 0.14 + (upLv - 1) * 0.02;
  const relativePreyScale = Number(
    Math.max(0.4, 1.0 / (1 + growthIndex)).toFixed(3)
  );
  const cameraZoom = Number(
    Math.max(0.88, 1.0 / (1 + (scale - 1) * 0.42)).toFixed(3)
  );

  const hpDrainReduction = Math.min(
    0.58,
    form.hpDrainReduction + upgradeDrainRed
  );
  const boostCostReduction = Math.min(
    0.68,
    form.boostCostReduction + upgradeBoostRed
  );

  const totalSpeedBonus =
    form.speedBonus + upgradeSpeedBonus + collectionSpeedBonus + (inRunLevel - 1) * 0.028;
  const baseSpeed = GAME_CONFIG.world.baseSharkSpeed * (1 + totalSpeedBonus);
  const moveSpeed = Math.round(frenzyActive ? baseSpeed * 1.35 : baseSpeed);
  const boostSpeed = Math.round(
    moveSpeed * GAME_CONFIG.world.boostSpeedMultiplier
  );

  const metabolicBaseDrain =
    (GAME_CONFIG.world.baseHpDrainPerSec + (inRunLevel - 1) * 0.65) *
    (1 + Math.max(0, globalDifficultyMultiplier - 1.0) * 0.52);
  const hpDrainPerSec = frenzyActive
    ? 0
    : Number((metabolicBaseDrain * (1 - hpDrainReduction)).toFixed(2));

  const boostDrainPerSec = frenzyActive
    ? 0
    : Number(
        (
          GAME_CONFIG.world.baseBoostDrainPerSec *
          (1 - boostCostReduction)
        ).toFixed(2)
      );

  const magnetRadius = Math.round(
    (GAME_CONFIG.world.baseMagnetRadius +
      form.magnetBonus +
      (upLv - 1) * 8 +
      (inRunLevel - 1) * 10) *
      (frenzyActive ? 1.35 : 1.0)
  );

  const maxHp = Math.round(
    (form.baseHp + (inRunLevel - 1) * 16) * upgradeHpMult * collectionHpMult
  );
  const maxEnergy = Math.round(
    form.baseEnergy + (upLv - 1) * 5 + (inRunLevel - 1) * 4
  );

  const activeSynergy: FactionId | null =
    form.lineage === 'CYBER_MECHA'
      ? 'MECHA'
      : form.lineage === 'ELDER_ABYSS'
      ? 'ABYSS'
      : form.lineage === 'ELEMENTAL_CORE'
      ? 'MAGMA'
      : null;

  const frenzyDurationBonus =
    form.id === 'shark_43_solar_supernova'
      ? 4.0
      : form.id === 'shark_33_hellfire_behemoth'
      ? 2.5
      : form.lineage === 'ELEMENTAL_CORE'
      ? 1.0 + form.row * 0.3
      : 0;

  // Bio-Radioactive Venom Shark (#25) and Generation VI Cosmic Elder Gods can crunch mines directly
  const canEatMines =
    form.id === 'shark_25_bio_venom' || form.generation >= 6;

  return {
    level: inRunLevel,
    scale,
    relativePreyScale,
    cameraZoom,
    maxHp,
    maxEnergy,
    moveSpeed,
    boostSpeed,
    biteTier,
    normalBiteTier,
    hpDrainPerSec,
    boostDrainPerSec,
    magnetRadius,
    activeSynergy,
    devourHealMultiplier: form.devourHealMult,
    frenzyDurationBonus,
    totalOrganStars: upLv,
    sharkFormId: form.id,
    upgradeLevel: upLv,
    scoreMultiplier: form.scoreMult,
    rewardMultiplier: Number(
      (collectionRewardMult * (1 + form.row * 0.12)).toFixed(2)
    ),
    canEatMines,
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

  // In 48-Shark Evolution mode (sharkFormId defined), any fish smaller than the shark (effectiveTier <= biteTier) is directly devourable on contact.
  // Legacy organ mode (!sharkFormId) retains the boost armor-break requirement for unit test compatibility.
  const requiresBoostArmorBreak =
    !sharkStats.sharkFormId &&
    ((mutationVariant === 'ABYSS_BEHEMOTH' && prey.tier >= 7) || Boolean(prey.isBoss));
  const predatorGate = requiresBoostArmorBreak
    ? frenzyActive || (sharkStats.biteTier >= Math.min(8, effectiveTier) && isBoosting)
    : sharkStats.biteTier >= effectiveTier;

  // Deep-sea hazards (Naval Mines, Toxic Slime, Plasma Core) ALWAYS explode on contact unless Gold Frenzy is active or shark has Bio-Venom / Elder God Mine Immunity!
  const canDevour = prey.isHazard
    ? frenzyActive || Boolean(sharkStats.canEatMines)
    : frenzyActive || predatorGate;

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

    const scoreMult = sharkStats.scoreMultiplier ?? 1.0;

    return {
      canDevour: true,
      hpDelta: Math.round(prey.hpRestore * healMult),
      xpGain: dampedXpGain,
      scoreGain: Math.round(prey.scoreValue * mult * scoreMult),
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

export interface HuntingHeatBuff {
  heatLevel: number; // 0..5
  magnetRadiusBonus: number; // +0..+80 px
  energyRegenBonus: number; // +0..+11 / sec
}

/**
 * Maps current in-run score into a passive Hunting Heat level (Lv.0 .. Lv.5)
 * scaled by the active shark's generation row (0..5).
 * Provides wider pickup magnet radius and faster boost energy recovery without
 * polluting the pickup pool or creating suicide-farming incentives.
 */
export function computeHuntingHeatBuff(
  currentScore: number,
  generationRow: number = 0
): HuntingHeatBuff {
  const cleanScore = Math.max(0, currentScore);
  const rowScale = Math.pow(1.85, Math.max(0, Math.min(5, generationRow)));
  const unitScore = 1200 * rowScale;
  const rawLevel = Math.floor(Math.sqrt(cleanScore / unitScore));
  const heatLevel = Math.max(0, Math.min(5, rawLevel));
  return {
    heatLevel,
    magnetRadiusBonus: heatLevel * 16,
    energyRegenBonus: Number((heatLevel * 2.2).toFixed(1)),
  };
}


