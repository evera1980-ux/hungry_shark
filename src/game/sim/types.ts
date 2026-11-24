import type React from 'react';
import { FactionId, GAME_CONFIG, PreyTierConfig } from '../config';
import {
  ComputedSharkStats,
  computeEvolvedSharkStats,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getXpRequiredForLevel,
} from '../rules';
import {
  evaluateSharkUnlock,
  getNextEvolutionTarget,
  getSharkFormById,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  SharkMetaSaveData,
} from '../sharkEvolutionConfig';
import { AdPlacement } from '../adManager';
import { PreyEntity } from '../canvasRenderer';
import { infiniteWorldManager } from '../infiniteWorldManager';
import { Lang } from '../i18n';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type TutorialStep =
  | 'EAT_SMALL_FISH'
  | 'HOLD_BOOST'
  | 'HANDS_ON_UPGRADE'
  | 'CELEBRATE'
  | 'DONE';

export const TUTORIAL_STORAGE_KEY = 'hungry_shark_tutorial_done_v1';

export const MAX_PARTICLES = 220;
export const MAX_PICKUPS = 65;
export const MAX_FLOAT_TEXTS = 36;
export const TARGET_PREY_COUNT = 54;

export interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'BUBBLE' | 'SLIME' | 'DNA' | 'SPARK';
  phase: number;
}

export interface PooledPickup {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'COIN' | 'DNA_CRYSTAL' | 'SUPPLY_CHEST';
  value: number;
  phase: number;
}

export interface PooledFloatText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  textKey: string;
  bonusText: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface SimulatedAdState {
  active: boolean;
  placement: AdPlacement;
  secondsLeft: number;
  onReward: () => void;
  onCancel?: () => void;
}

export interface RunSummarySnapshot {
  score: number;
  maxDepth: number;
  preyEaten: number;
  level: number;
  coinsEarned: number;
  genesEarned: number;
  unlockedFormsCount: number;
  activeSharkId: string;
  personalBestScore: number;
  isNewRecord: boolean;
  masteryGenesBonus: number;
  masteryCrownTier: number;
}

export interface EconomyUsesState {
  goldOverdriveCount: number;
  geneSurgeCount: number;
  runStartCoins: number;
  runStartGenes: number;
  runStartBestScore: number;
  runMasteryGenesAwarded: number;
}

export interface HudStateSnapshot {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  level: number;
  xp: number;
  xpToNext: number;
  score: number;
  genes: number;
  coins: number;
  depth: number;
  zoneKey: string;
  biteTier: number;
  frenzyTimer: number;
  trialActive: boolean;
  targetFishNameKey: string;
  targetFishProgress: number;
  targetFishRequired: number;
  targetFishLengthCm: number;
  targetFishSpeed: number;
  activeSynergy: FactionId | null;
  goldOverdriveCost: number;
  geneSurgeCost: number;
  comboCount: number;
  comboMultiplier: number;
  goldenMutantCharge: number;
  goldenMutantRequired: number;
  frenzyCooldown: number;
  activeSharkId: string;
  activeUpgradeLevel: number;
  unlockedFormsCount: number;
  nextEvoTargetId: string | null;
  canBreakthroughNow: boolean;
  canUpgradeBodyNow: boolean;
  bodyUpgradeCost: number;
  bodyUpgradeGeneCost: number;
  heatLevel: number;
  masteryCrownTier: number;
  deepDivePromptMeters: number | null;
}

export interface SharkSimState {
  shark: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    targetAngle: number;
    swimPhase: number;
    biteAnim: number;
    hp: number;
    ghostHp: number;
    energy: number;
    level: number;
    xp: number;
    score: number;
    genes: number;
    coins: number;
    maxDepthReached: number;
    preyEatenCount: number;
    frenzyTimer: number;
    hitFlashTimer: number;
    hitstopTimer: number;
    invulnerableTimer: number;
    cameraShakeTrauma: number;
    trialActive: boolean;
    comboCount: number;
    comboTimer: number;
    reachedTwilight: boolean;
    reachedAbyss: boolean;
    sharkFormId: string;
    morphFlashTimer: number;
    turnRate: number;
    facingDir: number;
    facingScaleX: number;
    stats: ComputedSharkStats;
  };
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  input: {
    keys: Set<string>;
    joyActive: boolean;
    joyPointerId: number | null;
    joyOriginX: number;
    joyOriginY: number;
    joyDx: number;
    joyDy: number;
    boostPointerHeld: boolean;
    boostPointerId: number | null;
    canvasPointerActive: boolean;
    canvasPointerId: number | null;
    canvasPointerX: number;
    canvasPointerY: number;
    rightMouseBoostHeld: boolean;
  };
  preyList: PreyEntity[];
  nextPreyUid: number;
  particles: PooledParticle[];
  particleCursor: number;
  pickups: PooledPickup[];
  pickupCursor: number;
  floatTexts: PooledFloatText[];
  floatCursor: number;
  lastHudSyncTime: number;
  targetBounty: {
    preyConfig: PreyTierConfig;
    progress: number;
    required: number;
  };
  /** 本局已被巨鲨撞碎的上层阶梯海床局部单元集合 (`${tierIndex}:${cellIndex}`) */
  breachedTerraceCells: Set<string>;
  /** 巨鲨滞留在无适口猎物的浅海区域的累计时长 (s) */
  shallowDepletionTimer: number;
  /** 浅海空海时向 HUD 展示的建议下潜目标深度 (m)，有猎物时为 null */
  deepDiveTargetMeters: number | null;
}

export interface HudDomBarRefs {
  hpBarFillRef: { current: HTMLDivElement | null };
  hpGhostFillRef: { current: HTMLDivElement | null };
  energyBarFillRef: { current: HTMLDivElement | null };
  xpBarFillRef: { current: HTMLDivElement | null };
}

export interface SimEngineHost {
  simRef: { current: SharkSimState };
  langRef: { current: Lang };
  gameStateRef: { current: GameState };
  metaSaveRef: { current: SharkMetaSaveData };
  showAtlasModalRef: { current: boolean };
  simAdRef: { current: SimulatedAdState | null };
  tutorialStepRef: { current: TutorialStep };
  tutorialBoostAccumRef: { current: number };
  economyUsesRef: { current: EconomyUsesState };
  hudDomRefs: HudDomBarRefs;
  setGameState: (next: GameState) => void;
  setMetaSave: (next: SharkMetaSaveData) => void;
  setRunSnapshot: (next: RunSummarySnapshot) => void;
  setLiveActivePreyCount: (count: number) => void;
  setTutorialStep: (step: TutorialStep) => void;
  setTutorialEatProgress: (progress: number) => void;
  setHudState: (next: HudStateSnapshot) => void;
  spawnParticle: (
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    maxLife: number,
    color: string,
    kind: PooledParticle['kind']
  ) => void;
  spawnPickup: (
    x: number,
    y: number,
    vx: number,
    vy: number,
    kind: PooledPickup['kind'],
    value: number
  ) => void;
  spawnFloatText: (
    x: number,
    y: number,
    textKey: string,
    bonusText: string,
    color: string,
    scale?: number
  ) => void;
  rollTargetBountyConfig: (
    maxBiteTier: number,
    currentDepth: number,
    excludeId?: string,
    minPreyLengthCm?: number
  ) => PreyTierConfig;
  createPreyEntity: (nearSharkX?: number, nearSharkY?: number) => PreyEntity;
  recomputeSharkStats: (
    inRunLevel: number,
    frenzyActive: boolean,
    sharkFormIdOverride?: string,
    saveOverride?: SharkMetaSaveData
  ) => ComputedSharkStats;
  clearAllInputs: () => void;
}

export type BindMultiTouchFn = (
  action: () => void,
  isDisabled?: boolean
) => {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export function createInitialHudState(initialSave: SharkMetaSaveData): HudStateSnapshot {
  const activeForm = getSharkFormById(initialSave.selectedSharkId);
  const activeUpg = initialSave.sharkUpgradeLevels[activeForm.id] ?? 1;
  const nextEvo = getNextEvolutionTarget(activeForm.id, initialSave);
  const nextEval = nextEvo
    ? evaluateSharkUnlock(
        nextEvo,
        initialSave,
        0,
        0,
        initialSave.bestInRunLevel,
        initialSave.bestDepthReached
      )
    : null;
  const upgCost = getSharkUpgradeCost(activeForm, activeUpg);
  const upgGeneCost = getSharkUpgradeGeneCost(activeForm, activeUpg);

  return {
    hp: 100,
    maxHp: 100,
    energy: 100,
    maxEnergy: 100,
    level: 1,
    xp: 0,
    xpToNext: getXpRequiredForLevel(1),
    score: 0,
    genes: initialSave.bankedGenes,
    coins: initialSave.bankedCoins,
    depth: 12,
    zoneKey: 'zone_shallow',
    biteTier: activeForm.baseBiteTier,
    frenzyTimer: 0,
    trialActive: false,
    targetFishNameKey: 'prey_140_PREY-002',
    targetFishProgress: 0,
    targetFishRequired: 2,
    targetFishLengthCm: 23,
    targetFishSpeed: 68,
    activeSynergy: null,
    goldOverdriveCost: getGoldOverdriveCost(0, activeForm.row),
    geneSurgeCost: getGeneSurgeCost(1, 0, activeForm.row),
    comboCount: 0,
    comboMultiplier: 1.0,
    goldenMutantCharge: 0,
    goldenMutantRequired: 8,
    frenzyCooldown: 12,
    activeSharkId: activeForm.id,
    activeUpgradeLevel: activeUpg,
    unlockedFormsCount: initialSave.unlockedSharkIds.length,
    nextEvoTargetId: nextEvo?.id ?? null,
    canBreakthroughNow: Boolean(nextEval?.canUnlockNow),
    canUpgradeBodyNow:
      activeUpg < 10 &&
      initialSave.bankedCoins >= upgCost &&
      initialSave.bankedGenes >= upgGeneCost,
    bodyUpgradeCost: upgCost,
    bodyUpgradeGeneCost: upgGeneCost,
    heatLevel: 0,
    masteryCrownTier: initialSave.sharkMasteryTiers?.[activeForm.id] ?? 0,
    deepDivePromptMeters: null,
  };
}

export function createInitialSimState(metaSave: SharkMetaSaveData): SharkSimState {
  return {
    shark: {
      x: 0,
      y: 220,
      vx: 180,
      vy: 0,
      angle: 0,
      targetAngle: 0,
      swimPhase: 0,
      biteAnim: 0,
      hp: 100,
      ghostHp: 100,
      energy: 100,
      level: 1,
      xp: 0,
      score: 0,
      genes: metaSave.bankedGenes,
      coins: metaSave.bankedCoins,
      maxDepthReached: 22,
      preyEatenCount: 0,
      frenzyTimer: 0,
      hitFlashTimer: 0,
      hitstopTimer: 0,
      invulnerableTimer: 0,
      cameraShakeTrauma: 0,
      trialActive: false,
      comboCount: 0,
      comboTimer: 0,
      reachedTwilight: false,
      reachedAbyss: false,
      sharkFormId: metaSave.selectedSharkId,
      morphFlashTimer: 0,
      turnRate: 0,
      facingDir: 1,
      facingScaleX: 1,
      stats: computeEvolvedSharkStats(
        1,
        metaSave.selectedSharkId,
        metaSave.sharkUpgradeLevels[metaSave.selectedSharkId] ?? 1,
        false,
        1.0,
        metaSave.unlockedSharkIds.length
      ),
    },
    camera: {
      x: 0,
      y: 220,
      zoom: 1.0,
    },
    input: {
      keys: new Set(),
      joyActive: false,
      joyPointerId: null,
      joyOriginX: 0,
      joyOriginY: 0,
      joyDx: 0,
      joyDy: 0,
      boostPointerHeld: false,
      boostPointerId: null,
      canvasPointerActive: false,
      canvasPointerId: null,
      canvasPointerX: 0,
      canvasPointerY: 0,
      rightMouseBoostHeld: false,
    },
    preyList: [],
    nextPreyUid: 1,
    particles: Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 4,
      life: 0,
      maxLife: 1,
      color: '#4ade80',
      kind: 'BUBBLE',
      phase: 0,
    })),
    particleCursor: 0,
    pickups: Array.from({ length: MAX_PICKUPS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      kind: 'COIN',
      value: 1,
      phase: 0,
    })),
    pickupCursor: 0,
    floatTexts: Array.from({ length: MAX_FLOAT_TEXTS }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -40,
      textKey: 'float_devour',
      bonusText: '',
      color: '#4ade80',
      life: 0,
      maxLife: 1,
      scale: 1,
    })),
    floatCursor: 0,
    lastHudSyncTime: 0,
    targetBounty: {
      preyConfig:
        GAME_CONFIG.preyTiers.find((p) => p.id === 'PREY-002') ??
        GAME_CONFIG.preyTiers[1],
      progress: 0,
      required: 2,
    },
    breachedTerraceCells: new Set<string>(),
    shallowDepletionTimer: 0,
    deepDiveTargetMeters: null,
  };
}

export function spawnPooledParticle(
  sim: SharkSimState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  maxLife: number,
  color: string,
  kind: PooledParticle['kind']
): void {
  const p = sim.particles[sim.particleCursor];
  sim.particleCursor = (sim.particleCursor + 1) % MAX_PARTICLES;
  p.active = true;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.radius = radius;
  p.life = maxLife;
  p.maxLife = maxLife;
  p.color = color;
  p.kind = kind;
  p.phase = Math.random() * Math.PI * 2;
}

export function spawnPooledPickup(
  sim: SharkSimState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  kind: PooledPickup['kind'],
  value: number
): void {
  const pk = sim.pickups[sim.pickupCursor];
  sim.pickupCursor = (sim.pickupCursor + 1) % MAX_PICKUPS;
  pk.active = true;
  pk.x = x;
  pk.y = y;
  pk.vx = vx;
  pk.vy = vy;
  pk.kind = kind;
  pk.value = value;
  pk.phase = Math.random() * Math.PI * 2;
}

export function spawnPooledFloatText(
  sim: SharkSimState,
  x: number,
  y: number,
  textKey: string,
  bonusText: string,
  color: string,
  scale: number = 1.0
): void {
  const ft = sim.floatTexts[sim.floatCursor];
  sim.floatCursor = (sim.floatCursor + 1) % MAX_FLOAT_TEXTS;
  ft.active = true;
  ft.x = x;
  ft.y = y;
  ft.vy = -52;
  ft.textKey = textKey;
  ft.bonusText = bonusText;
  ft.color = color;
  ft.life = 1.15;
  ft.maxLife = 1.15;
  ft.scale = scale;
}

export function rollTargetBountySpecies(
  maxBiteTier: number,
  currentDepth: number,
  excludeId?: string,
  minPreyLengthCm: number = 0
): PreyTierConfig {
  const isShallow = currentDepth <= 520;
  const effectiveMaxTier = isShallow
    ? Math.min(18, Math.max(1, maxBiteTier))
    : Math.max(8, maxBiteTier);
  const realPreyOnly = GAME_CONFIG.preyTiers.filter(
    (p) => !p.isHazard && Boolean(p.externalPngUrl)
  );
  // 巨鲨体型感知过滤：确保悬赏目标体长满足 minPreyLengthCm，避免给 45m 巨鲨指派永远不会在浅海刷出的小鱼
  const sizeEligible =
    minPreyLengthCm > 0
      ? realPreyOnly.filter(
          (p) => (p.bodyLengthCm ?? p.radius * 2.5) >= minPreyLengthCm
        )
      : realPreyOnly;
  const activeRealPool = sizeEligible.length > 0 ? sizeEligible : realPreyOnly;

  // 若当前处于浅海且巨鲨体型已大到浅海无任何适口物种，则跨越浅海阶位限制，从最浅的深海适口物种中选取悬赏以引导下潜
  const hasShallowSizeMatch =
    !isShallow ||
    activeRealPool.some((p) => p.minDepth <= 520 && p.tier <= effectiveMaxTier);
  const bountyMaxTier = hasShallowSizeMatch
    ? effectiveMaxTier
    : Math.max(8, maxBiteTier);

  const edible = activeRealPool.filter(
    (p) =>
      p.tier <= bountyMaxTier &&
      p.id !== excludeId &&
      (!isShallow ||
        !hasShallowSizeMatch ||
        (p.behavior !== 'EEL_CHARGER' &&
          p.behavior !== 'SUB_PATROL' &&
          p.behavior !== 'HEAVY_CRUISER' &&
          p.behavior !== 'KRAKEN_BOSS'))
  );
  const strictNative = edible.filter(
    (p) => currentDepth >= p.minDepth && currentDepth <= p.maxDepth
  );
  const nearNative = edible.filter(
    (p) => currentDepth >= p.minDepth - 80 && currentDepth <= p.maxDepth + 80
  );
  let pool: PreyTierConfig[];
  if (strictNative.length > 0) {
    pool = strictNative;
  } else if (nearNative.length > 0) {
    pool = nearNative;
  } else if (minPreyLengthCm > 0 && edible.length > 0) {
    // 浅海空海时优先挑选距当前深度最近的深海适口猎物作为引导悬赏
    const sortedByDepth = [...edible].sort(
      (a, b) => Math.abs(a.minDepth - currentDepth) - Math.abs(b.minDepth - currentDepth)
    );
    pool = sortedByDepth.slice(0, Math.min(4, sortedByDepth.length));
  } else {
    pool = edible;
  }
  if (pool.length === 0) return activeRealPool[0] ?? GAME_CONFIG.preyTiers[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createPreyEntityForSim(
  sim: SharkSimState,
  nearSharkX?: number,
  nearSharkY?: number
): PreyEntity {
  const halfW = infiniteWorldManager.worldWidth / 2;
  const refDepth = typeof nearSharkY === 'number' ? Math.max(0, nearSharkY) : 220;

  const realPreyOnly = GAME_CONFIG.preyTiers.filter(
    (p) => !p.isHazard && Boolean(p.externalPngUrl)
  );
  const depthMatched = realPreyOnly.filter(
    (p) =>
      refDepth >= p.minDepth - 140 &&
      refDepth <= p.maxDepth + 140 &&
      (refDepth > 520 ||
        (p.behavior !== 'EEL_CHARGER' && p.behavior !== 'SUB_PATROL'))
  );
  const pool = depthMatched.length > 0 ? depthMatched : realPreyOnly;
  const chosenTier: PreyTierConfig =
    pool[Math.floor(Math.random() * pool.length)];

  let y =
    chosenTier.minDepth +
    Math.random() * Math.max(40, chosenTier.maxDepth - chosenTier.minDepth);
  if (refDepth > 1400) {
    y = Math.max(
      Math.max(1150, chosenTier.minDepth),
      Math.min(chosenTier.maxDepth, refDepth + (Math.random() - 0.45) * 900)
    );
  }

  let x = (Math.random() - 0.5) * (infiniteWorldManager.worldWidth - 100);
  if (typeof nearSharkX === 'number') {
    const dir = Math.random() < 0.5 ? -1 : 1;
    x = infiniteWorldManager.wrapEntityX(
      nearSharkX + dir * (480 + Math.random() * 750)
    );
  } else {
    x = Math.max(-halfW + 50, Math.min(halfW - 50, x));
  }

  const moveDir = Math.random() < 0.5 ? -1 : 1;
  return {
    uid: sim.nextPreyUid++,
    config: chosenTier,
    x,
    y,
    vx: moveDir * chosenTier.baseSpeed,
    vy: (Math.random() - 0.5) * 20,
    angle: moveDir > 0 ? 0 : Math.PI,
    phase: Math.random() * Math.PI * 2,
    telegraphTimer: 0,
    isInflated: false,
  };
}
