/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { detectDefaultLang, Lang, translate } from './game/i18n';
import {
  FactionId,
  GAME_CONFIG,
  OrganConfig,
  OrganSlotId,
  PreyTierConfig,
} from './game/config';
import {
  addEvolutionProgress,
  ComputedSharkStats,
  computeSharkStats,
  EquippedOrgansMap,
  getDepthZone,
  getEffectivePreyTier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getMaxMechaLoadout,
  getOrganRerollCost,
  getPreyRelativeVisualScale,
  getXpRequiredForLevel,
  OrganStarsMap,
  pickEvolutionChoices,
  resolvePreyEncounter,
} from './game/rules';
import { soundFX } from './game/audio';
import { adManager, AdPlacement } from './game/adManager';
import {
  drawOffScreenRadarIndicators,
  drawPreyEntity,
  drawSharkWithOrgans,
  PreyEntity,
} from './game/canvasRenderer';
import { OrganCanvasPreview } from './components/OrganCanvasPreview';
import { downloadStandaloneSingleFileHtml } from './game/singleFileExporter';
import { spriteSheetManager } from './game/spriteSheetManager';
import { parallaxBackground } from './game/parallaxBackground';
import { infiniteWorldManager } from './game/infiniteWorldManager';
import { ecosystemSpawner } from './game/ecosystemSpawner';
import { infiniteProgressionManager } from './game/infiniteProgressionManager';

type GameState = 'title' | 'playing' | 'paused' | 'gameover';

interface PooledParticle {
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

interface PooledPickup {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'COIN' | 'DNA_CRYSTAL' | 'SUPPLY_CHEST';
  value: number;
  phase: number;
}

interface PooledFloatText {
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

interface SimulatedAdState {
  active: boolean;
  placement: AdPlacement;
  secondsLeft: number;
  onReward: () => void;
  onCancel?: () => void;
}

interface RunSummarySnapshot {
  score: number;
  maxDepth: number;
  preyEaten: number;
  level: number;
  coins: number;
  genes: number;
  organsCount: number;
}

const MAX_PARTICLES = 220;
const MAX_PICKUPS = 65;
const MAX_FLOAT_TEXTS = 36;
const TARGET_PREY_COUNT = 54;

const ALL_SLOTS: OrganSlotId[] = ['JAWS', 'DORSAL', 'TAIL', 'ARMOR', 'AURA'];

export default function App() {
  const [lang, setLang] = useState<Lang>(() => detectDefaultLang());
  const langRef = useRef<Lang>(lang);
  langRef.current = lang;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(key, lang, params),
    [lang]
  );

  // Primary game state machine
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });
  const gameStateRef = useRef<GameState>(gameState);

  // Sub-modals inside gameplay / gameover
  const [evoChoices, setEvoChoices] = useState<OrganConfig[] | null>(null);
  const evoChoicesRef = useRef<OrganConfig[] | null>(null);
  evoChoicesRef.current = evoChoices;

  // Non-interrupting Evolution Queue & Auto-Evolve toggle
  const [autoEvolve, setAutoEvolve] = useState<boolean>(false);
  const autoEvolveRef = useRef<boolean>(false);
  autoEvolveRef.current = autoEvolve;

  const [reviveOffered, setReviveOffered] = useState<boolean>(true);
  const [runSnapshot, setRunSnapshot] = useState<RunSummarySnapshot>({
    score: 0,
    maxDepth: 120,
    preyEaten: 0,
    level: 1,
    coins: 0,
    genes: 0,
    organsCount: 0,
  });

  // Simulated Rewarded Ad Overlay state
  const [simAd, setSimAd] = useState<SimulatedAdState | null>(null);
  const simAdRef = useRef<SimulatedAdState | null>(null);
  simAdRef.current = simAd;

  // Audio mute state
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Discrete HUD state (throttled updates so React never reconciles at 60Hz unnecessarily)
  const [hudState, setHudState] = useState({
    hp: 100,
    maxHp: 100,
    energy: 100,
    maxEnergy: 100,
    level: 1,
    xp: 0,
    xpToNext: getXpRequiredForLevel(1),
    score: 0,
    genes: 0,
    coins: 0,
    depth: 120,
    zoneKey: 'zone_shallow',
    biteTier: 2,
    frenzyTimer: 0,
    trialActive: false,
    targetFishNameKey: 'prey_blue_tang_name',
    targetFishProgress: 0,
    targetFishRequired: 2,
    activeSynergy: null as FactionId | null,
    goldOverdriveCost: getGoldOverdriveCost(0),
    geneSurgeCost: getGeneSurgeCost(1, 0),
    rerollCost: getOrganRerollCost(0),
    pendingEvoCount: 0,
    comboCount: 0,
    comboMultiplier: 1.0,
    goldenMutantCharge: 0,
    goldenMutantRequired: 8,
    frenzyCooldown: 12,
  });

  const [equippedOrgans, setEquippedOrgans] = useState<EquippedOrgansMap>({});
  const equippedRef = useRef<EquippedOrgansMap>({});

  const [organStars, setOrganStars] = useState<OrganStarsMap>({});
  const organStarsRef = useRef<OrganStarsMap>({});

  const economyUsesRef = useRef<{
    goldOverdriveCount: number;
    geneSurgeCount: number;
    rerollCount: number;
  }>({
    goldOverdriveCount: 0,
    geneSurgeCount: 0,
    rerollCount: 0,
  });

  // DOM refs for smooth 60fps bar transforms without React re-renders
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hpBarFillRef = useRef<HTMLDivElement | null>(null);
  const hpGhostFillRef = useRef<HTMLDivElement | null>(null);
  const energyBarFillRef = useRef<HTMLDivElement | null>(null);
  const xpBarFillRef = useRef<HTMLDivElement | null>(null);

  // Virtual Joystick UI state for rendering knob position
  const [joystickVisual, setJoystickVisual] = useState<{
    active: boolean;
    dx: number;
    dy: number;
  }>({ active: false, dx: 0, dy: 0 });
  const [boostVisual, setBoostVisual] = useState<boolean>(false);

  // Mutable 60Hz simulation engine state stored in ref
  const simRef = useRef<{
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
      pendingEvoCount: number;
      comboCount: number;
      comboTimer: number;
      reachedTwilight: boolean;
      reachedAbyss: boolean;
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
      joyOriginX: number;
      joyOriginY: number;
      joyDx: number;
      joyDy: number;
      boostPointerHeld: boolean;
      canvasPointerActive: boolean;
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
  }>({
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
      genes: 0,
      coins: 0,
      maxDepthReached: 220,
      preyEatenCount: 0,
      frenzyTimer: 0,
      hitFlashTimer: 0,
      hitstopTimer: 0,
      invulnerableTimer: 0,
      cameraShakeTrauma: 0,
      trialActive: false,
      pendingEvoCount: 0,
      comboCount: 0,
      comboTimer: 0,
      reachedTwilight: false,
      reachedAbyss: false,
      stats: computeSharkStats(1, {}, false),
    },
    camera: {
      x: 0,
      y: 220,
      zoom: 1.0,
    },
    input: {
      keys: new Set(),
      joyActive: false,
      joyOriginX: 0,
      joyOriginY: 0,
      joyDx: 0,
      joyDy: 0,
      boostPointerHeld: false,
      canvasPointerActive: false,
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
        GAME_CONFIG.preyTiers.find((p) => p.id === 'regal_blue_tang') ??
        GAME_CONFIG.preyTiers[1],
      progress: 0,
      required: 2,
    },
  });

  // Sync document.body.dataset.state whenever gameState changes
  useEffect(() => {
    gameStateRef.current = gameState;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = gameState;
    }
  }, [gameState]);

  // Register Browser Simulated Video Ad Runner & Load 4x4 + 6x5 Sprite Sheets + 3-Layer Parallax Background
  useEffect(() => {
    spriteSheetManager.load(
      '/assets/aistudio/fish_24bdaa5a.png',
      '/assets/aistudio/fish2_fc857cfa.png'
    );
    parallaxBackground.load('/assets/aistudio/ocean_bg_a7a0ef52.png');
    adManager.registerBrowserSimulator((placement, onReward, onCancel) => {
      setSimAd({
        active: true,
        placement,
        secondsLeft: 3,
        onReward,
        onCancel,
      });
    });
  }, []);

  // Countdown timer for Simulated Rewarded Video Ad
  useEffect(() => {
    if (!simAd || !simAd.active) return;
    if (simAd.secondsLeft <= 0) return;

    const timer = window.setTimeout(() => {
      setSimAd((prev) =>
        prev ? { ...prev, secondsLeft: Math.max(0, prev.secondsLeft - 1) } : null
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [simAd]);

  // Spawn helper for zero-GC pooled particles
  const spawnParticle = useCallback(
    (
      x: number,
      y: number,
      vx: number,
      vy: number,
      radius: number,
      maxLife: number,
      color: string,
      kind: PooledParticle['kind']
    ) => {
      const sim = simRef.current;
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
    },
    []
  );

  // Spawn helper for zero-GC pooled pickups (Coins, DNA Crystals, Supply Drop Chest)
  const spawnPickup = useCallback(
    (
      x: number,
      y: number,
      vx: number,
      vy: number,
      kind: PooledPickup['kind'],
      value: number
    ) => {
      const sim = simRef.current;
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
    },
    []
  );

  // Spawn helper for bilingual floating combat text
  const spawnFloatText = useCallback(
    (
      x: number,
      y: number,
      textKey: string,
      bonusText: string,
      color: string,
      scale: number = 1.0
    ) => {
      const sim = simRef.current;
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
    },
    []
  );

  // Pick an edible Target Fish species strictly native to the current ocean depth zone
  const rollTargetBountyConfig = useCallback(
    (maxBiteTier: number, currentDepth: number, excludeId?: string): PreyTierConfig => {
      const effectiveMaxTier = currentDepth > 500 ? Math.max(3, maxBiteTier) : Math.max(2, maxBiteTier);
      const edible = GAME_CONFIG.preyTiers.filter(
        (p) =>
          p.tier <= effectiveMaxTier &&
          !p.isHazard &&
          p.id !== excludeId
      );
      const strictNative = edible.filter(
        (p) => currentDepth >= p.minDepth && currentDepth <= p.maxDepth
      );
      const nearNative = edible.filter(
        (p) => currentDepth >= p.minDepth - 80 && currentDepth <= p.maxDepth + 80
      );
      const pool =
        strictNative.length > 0
          ? strictNative
          : nearNative.length > 0
          ? nearNative
          : edible;
      if (pool.length === 0) return GAME_CONFIG.preyTiers[0];
      return pool[Math.floor(Math.random() * pool.length)];
    },
    []
  );

  // Spawn a single prey entity across all 32 marine species in GAME_CONFIG.preyTiers
  const createPreyEntity = useCallback(
    (nearSharkX?: number, nearSharkY?: number): PreyEntity => {
      const sim = simRef.current;
      const halfW = infiniteWorldManager.worldWidth / 2;
      const refDepth = typeof nearSharkY === 'number' ? Math.max(0, nearSharkY) : 220;

      // Weight lower tiers higher in shallow water; shift toward deep abyssal tiers when diving past 1200m+
      const tierWeights =
        refDepth > 1250
          ? [12, 12, 14, 16, 16, 12, 12, 6]
          : [26, 24, 16, 11, 9, 7, 5, 2];
      const totalWeight = tierWeights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * totalWeight;
      let chosenTierNum = 1;
      for (let t = 0; t < tierWeights.length; t++) {
        roll -= tierWeights[t];
        if (roll <= 0) {
          chosenTierNum = t + 1;
          break;
        }
      }

      const tierCandidates = GAME_CONFIG.preyTiers.filter(
        (p) => p.tier === chosenTierNum
      );
      const chosenTier: PreyTierConfig =
        tierCandidates.length > 0
          ? tierCandidates[Math.floor(Math.random() * tierCandidates.length)]
          : GAME_CONFIG.preyTiers[0];

      let y =
        chosenTier.minDepth +
        Math.random() * (chosenTier.maxDepth - chosenTier.minDepth);
      // In infinite downward depth mode, if shark dives deeper than 1400m, spawn around the shark's current abyssal depth
      if (refDepth > 1400) {
        y = Math.max(1150, refDepth + (Math.random() - 0.45) * 900);
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
    },
    []
  );

  // Initialize or reset a run
  const startNewRun = useCallback(
    (withMaxMechaTrial: boolean = false) => {
      const sim = simRef.current;
      const initialOrgans = withMaxMechaTrial ? getMaxMechaLoadout() : {};
      const initialStars: OrganStarsMap = withMaxMechaTrial
        ? { JAWS: 1, DORSAL: 1, TAIL: 1, ARMOR: 1, AURA: 1 }
        : {};
      equippedRef.current = initialOrgans;
      organStarsRef.current = initialStars;
      setEquippedOrgans({ ...initialOrgans });
      setOrganStars({ ...initialStars });

      economyUsesRef.current = {
        goldOverdriveCount: 0,
        geneSurgeCount: 0,
        rerollCount: 0,
      };

      const initialLevel = withMaxMechaTrial ? 3 : 1;
      const stats = computeSharkStats(
        initialLevel,
        initialOrgans,
        false,
        initialStars,
        1.0
      );

      sim.shark = {
        x: 0,
        y: 220,
        vx: stats.moveSpeed * 0.6,
        vy: 0,
        angle: 0,
        targetAngle: 0,
        swimPhase: 0,
        biteAnim: 0,
        hp: stats.maxHp,
        ghostHp: stats.maxHp,
        energy: stats.maxEnergy,
        level: initialLevel,
        xp: 0,
        score: 0,
        genes: 0,
        coins: 0,
        maxDepthReached: 220,
        preyEatenCount: 0,
        frenzyTimer: withMaxMechaTrial ? 4.0 : 0,
        hitFlashTimer: 0,
        hitstopTimer: 0,
        invulnerableTimer: 0,
        cameraShakeTrauma: 0,
        trialActive: withMaxMechaTrial,
        pendingEvoCount: 0,
        comboCount: 0,
        comboTimer: 0,
        reachedTwilight: false,
        reachedAbyss: false,
        stats,
      };

      sim.camera.x = sim.shark.x;
      sim.camera.y = sim.shark.y;
      sim.camera.zoom = stats.cameraZoom;

      // Clear held inputs
      sim.input.keys.clear();
      sim.input.joyActive = false;
      sim.input.joyDx = 0;
      sim.input.joyDy = 0;
      sim.input.boostPointerHeld = false;
      sim.input.canvasPointerActive = false;
      sim.input.rightMouseBoostHeld = false;
      setJoystickVisual({ active: false, dx: 0, dy: 0 });
      setBoostVisual(false);

      // Reset pools
      sim.particles.forEach((p) => (p.active = false));
      sim.pickups.forEach((pk) => (pk.active = false));
      sim.floatTexts.forEach((ft) => (ft.active = false));

      // Initialize first Target Fish Bounty & sync with EcosystemSpawner
      const firstTargetConfig = rollTargetBountyConfig(stats.biteTier, 220);
      sim.targetBounty = {
        preyConfig: firstTargetConfig,
        progress: 0,
        required: 2,
      };
      ecosystemSpawner.activeTargetPreyId = firstTargetConfig.id;

      // Populate initial ocean ecosystem via EcosystemSpawner object pool & reset InfiniteProgressionManager
      infiniteProgressionManager.reset();
      ecosystemSpawner.reset(sim.preyList);
      const initialSpawnCount = Math.max(44, ecosystemSpawner.maxActivePreys - 6);
      for (let i = 0; i < initialSpawnCount; i++) {
        const spawned = ecosystemSpawner.spawnPreyOffScreen(
          sim.preyList,
          sim.shark.x,
          sim.shark.y,
          Math.random,
          [540, ecosystemSpawner.spawnRadius],
          0
        );
        // Ensure the first 2 off-screen spawns are the active Target Bounty species within its natural depth habitat
        if (i < 2) {
          spawned.config = firstTargetConfig;
          spawned.y = Math.max(
            Math.max(25, firstTargetConfig.minDepth),
            Math.min(firstTargetConfig.maxDepth, spawned.y)
          );
        }
      }
      // Guarantee 6 edible Tier 1 & Tier 2 reef fish in upper/lower shallow lanes so the player sees a lively reef immediately without auto-triggering a modal on frame 1
      const starterShowcaseIds = [
        'neon_tetra_school',
        'regal_blue_tang',
        'coral_clownfish',
        'rainbow_seahorse',
        'striped_butterflyfish',
        'reef_hermit_crab',
      ];
      for (let i = 0; i < 6; i++) {
        const tierConfig =
          GAME_CONFIG.preyTiers.find((p) => p.id === starterShowcaseIds[i]) ??
          GAME_CONFIG.preyTiers[i % 2];
        sim.preyList.push({
          uid: sim.nextPreyUid++,
          config: tierConfig,
          x: 260 + i * 130,
          y: i % 2 === 0 ? 135 : 305,
          vx: 45,
          vy: 0,
          angle: 0,
          phase: i,
          telegraphTimer: 0,
          isInflated: false,
          scaleMultiplier: 1.0,
        });
      }

      setEvoChoices(null);
      setReviveOffered(true);
      setHudState({
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        energy: stats.maxEnergy,
        maxEnergy: stats.maxEnergy,
        level: initialLevel,
        xp: 0,
        xpToNext: getXpRequiredForLevel(initialLevel),
        score: 0,
        genes: 0,
        coins: 0,
        depth: 220,
        zoneKey: 'zone_shallow',
        biteTier: stats.biteTier,
        frenzyTimer: withMaxMechaTrial ? 4 : 0,
        trialActive: withMaxMechaTrial,
        targetFishNameKey: firstTargetConfig.nameKey,
        targetFishProgress: 0,
        targetFishRequired: 2,
        activeSynergy: stats.activeSynergy,
        goldOverdriveCost: getGoldOverdriveCost(0),
        geneSurgeCost: getGeneSurgeCost(initialLevel, 0),
        rerollCost: getOrganRerollCost(0),
        pendingEvoCount: 0,
        comboCount: 0,
        comboMultiplier: 1.0,
        goldenMutantCharge: 0,
        goldenMutantRequired: infiniteProgressionManager.goldenMutantRequired,
        frenzyCooldown: 12,
      });

      if (withMaxMechaTrial) {
        soundFX.playEvolution();
        spawnFloatText(0, 180, 'float_trial_start', '+5 MECHA', '#38bdf8', 1.25);
      }

      // Immediately update state and blur any focused button
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.dataset.state = 'playing';
      setGameState('playing');
    },
    [rollTargetBountyConfig, spawnFloatText]
  );

  // If booted with ?autostart=1, initialize the ocean run immediately on mount
  useEffect(() => {
    if (gameState === 'playing' && simRef.current.preyList.length === 0) {
      startNewRun(false);
    }
  }, [gameState, startNewRun]);

  // Smart Auto-Evolution helper: mounts/upgrades the highest-priority organ on the fly without opening any modal!
  const autoMountBestOrgan = useCallback(() => {
    const sim = simRef.current;
    const candidates = pickEvolutionChoices(equippedRef.current);
    if (candidates.length === 0) return;

    // Priority: 1. Empty JAWS slot -> 2. Any empty slot -> 3. Organ matching current dominant faction
    const chosen =
      candidates.find((c) => c.slot === 'JAWS' && !equippedRef.current.JAWS) ??
      candidates.find((c) => !equippedRef.current[c.slot]) ??
      candidates[0];

    const hadSlot = Boolean(equippedRef.current[chosen.slot]);
    const nextStar = hadSlot ? (organStarsRef.current[chosen.slot] ?? 1) + 1 : 1;

    const nextEquipped: EquippedOrgansMap = {
      ...equippedRef.current,
      [chosen.slot]: chosen,
    };
    const nextStars: OrganStarsMap = {
      ...organStarsRef.current,
      [chosen.slot]: nextStar,
    };
    equippedRef.current = nextEquipped;
    organStarsRef.current = nextStars;
    setEquippedOrgans(nextEquipped);
    setOrganStars(nextStars);

    sim.shark.stats = computeSharkStats(
      sim.shark.level,
      nextEquipped,
      sim.shark.frenzyTimer > 0,
      nextStars,
      infiniteProgressionManager.globalDifficultyMultiplier
    );
    sim.shark.hp = Math.min(sim.shark.stats.maxHp, sim.shark.hp + 20);
    spawnFloatText(
      sim.shark.x,
      sim.shark.y - 38,
      chosen.nameKey,
      nextStar > 1 ? `⚡★${nextStar}` : '⚡+EVO',
      chosen.primaryColor,
      1.22
    );
  }, [spawnFloatText]);

  // Open queued Evolution Modal at the player's convenience (via HUD button or [E] key)
  const handleOpenPendingEvo = useCallback(() => {
    const sim = simRef.current;
    if (sim.shark.pendingEvoCount <= 0 || evoChoicesRef.current) return;
    setEvoChoices(pickEvolutionChoices(equippedRef.current));
  }, []);

  // Toggle Auto-Evolve: if turning ON while pending points or modal exist, auto-mount all pending points immediately!
  const handleToggleAutoEvolve = useCallback(() => {
    const nextVal = !autoEvolveRef.current;
    autoEvolveRef.current = nextVal;
    setAutoEvolve(nextVal);
    if (nextVal) {
      const sim = simRef.current;
      const totalToApply =
        sim.shark.pendingEvoCount + (evoChoicesRef.current && sim.shark.pendingEvoCount === 0 ? 1 : 0);
      sim.shark.pendingEvoCount = 0;
      setEvoChoices(null);
      for (let i = 0; i < totalToApply; i++) {
        autoMountBestOrgan();
      }
      setHudState((prev) => ({ ...prev, pendingEvoCount: 0 }));
    }
  }, [autoMountBestOrgan]);

  // Mount a single selected organ from Evolution Modal (upgrades Star Level if slot is already occupied)
  const handleSelectSingleOrgan = useCallback(
    (organ: OrganConfig) => {
      const sim = simRef.current;
      const hadSlot = Boolean(equippedRef.current[organ.slot]);
      const nextStar = hadSlot ? (organStarsRef.current[organ.slot] ?? 1) + 1 : 1;

      const nextEquipped: EquippedOrgansMap = {
        ...equippedRef.current,
        [organ.slot]: organ,
      };
      const nextStars: OrganStarsMap = {
        ...organStarsRef.current,
        [organ.slot]: nextStar,
      };
      equippedRef.current = nextEquipped;
      organStarsRef.current = nextStars;
      setEquippedOrgans(nextEquipped);
      setOrganStars(nextStars);

      sim.shark.pendingEvoCount = Math.max(0, sim.shark.pendingEvoCount - 1);
      sim.shark.stats = computeSharkStats(
        sim.shark.level,
        nextEquipped,
        sim.shark.frenzyTimer > 0,
        nextStars,
        infiniteProgressionManager.globalDifficultyMultiplier
      );
      sim.shark.hp = Math.min(sim.shark.stats.maxHp, sim.shark.hp + 25);
      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 35,
        organ.nameKey,
        nextStar > 1 ? `★${nextStar} EVO!` : '+EVO',
        organ.primaryColor,
        1.2
      );
      setHudState((prev) => ({
        ...prev,
        pendingEvoCount: sim.shark.pendingEvoCount,
      }));
      if (sim.shark.pendingEvoCount > 0 && !autoEvolveRef.current) {
        setEvoChoices(pickEvolutionChoices(nextEquipped));
      } else {
        setEvoChoices(null);
      }
    },
    [spawnFloatText]
  );

  // Ad Placement 1: Watch Ad to Claim All 3 Evolution Organs
  const handleClaimAllThreeOrgansAd = useCallback(() => {
    const choices = evoChoicesRef.current;
    if (!choices || choices.length === 0) return;

    adManager.showRewardedVideoAd('EVO_CLAIM_ALL', () => {
      const sim = simRef.current;
      const nextEquipped: EquippedOrgansMap = { ...equippedRef.current };
      const nextStars: OrganStarsMap = { ...organStarsRef.current };
      for (const organ of choices) {
        const hadSlot = Boolean(nextEquipped[organ.slot]);
        nextEquipped[organ.slot] = organ;
        nextStars[organ.slot] = hadSlot ? (nextStars[organ.slot] ?? 1) + 1 : 1;
      }
      equippedRef.current = nextEquipped;
      organStarsRef.current = nextStars;
      setEquippedOrgans(nextEquipped);
      setOrganStars(nextStars);

      sim.shark.pendingEvoCount = Math.max(0, sim.shark.pendingEvoCount - 1);
      sim.shark.stats = computeSharkStats(
        sim.shark.level,
        nextEquipped,
        sim.shark.frenzyTimer > 0,
        nextStars,
        infiniteProgressionManager.globalDifficultyMultiplier
      );
      sim.shark.hp = sim.shark.stats.maxHp;
      sim.shark.energy = sim.shark.stats.maxEnergy;
      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 45,
        'float_all_three',
        '+3 ORGANS!',
        '#fde047',
        1.35
      );
      setHudState((prev) => ({
        ...prev,
        pendingEvoCount: sim.shark.pendingEvoCount,
      }));
      if (sim.shark.pendingEvoCount > 0 && !autoEvolveRef.current) {
        setEvoChoices(pickEvolutionChoices(nextEquipped));
      } else {
        setEvoChoices(null);
      }
    });
  }, [spawnFloatText]);

  // Ad Placement 2: Watch Ad on Death for Full HP + 8s Gold Frenzy Magnet Revive
  const handleReviveWithFrenzyAd = useCallback(() => {
    adManager.showRewardedVideoAd('REVIVE_FRENZY', () => {
      const sim = simRef.current;
      infiniteProgressionManager.addFrenzyStack();
      sim.shark.stats = computeSharkStats(
        sim.shark.level,
        equippedRef.current,
        true,
        organStarsRef.current,
        infiniteProgressionManager.globalDifficultyMultiplier
      );
      sim.shark.frenzyTimer =
        GAME_CONFIG.world.frenzyDuration + sim.shark.stats.frenzyDurationBonus;
      sim.shark.hp = sim.shark.stats.maxHp;
      sim.shark.ghostHp = sim.shark.stats.maxHp;
      sim.shark.energy = sim.shark.stats.maxEnergy;

      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 40,
        'float_frenzy_start',
        '8s GOLD FRENZY!',
        '#fde047',
        1.35
      );
      setReviveOffered(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
    });
  }, [spawnFloatText]);

  // Ad Placement 3: Title Screen Trial Max Mecha Shark
  const handleTrialMaxMechaAd = useCallback(() => {
    adManager.showRewardedVideoAd('TRIAL_MAX_MECHA', () => {
      startNewRun(true);
    });
  }, [startNewRun]);

  // Ad Placement 4: Top HUD Gene Supply Drop
  const handleGeneSupplyDropAd = useCallback(() => {
    adManager.showRewardedVideoAd('GENE_SUPPLY_DROP', () => {
      const sim = simRef.current;
      soundFX.playEvolution();
      // Burst of gold coins & DNA crystals around the shark + immediate 3-choice Evolution modal
      for (let i = 0; i < 14; i++) {
        const ang = (i * Math.PI * 2) / 14;
        const spd = 90 + Math.random() * 90;
        spawnPickup(
          sim.shark.x + Math.cos(ang) * 40,
          sim.shark.y + Math.sin(ang) * 40,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          i % 2 === 0 ? 'DNA_CRYSTAL' : 'COIN',
          5
        );
      }
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 45,
        'float_supply_drop',
        '+50 GENES',
        '#4ade80',
        1.3
      );
      sim.shark.genes += 50;
      sim.shark.coins += 35;
      setEvoChoices(pickEvolutionChoices(equippedRef.current));
    });
  }, [spawnFloatText, spawnPickup]);

  // P2-2 In-Run Economy Action 1: Spend Dynamic Gold Coins for Instant Overdrive (+45 HP, Full Boost Energy, 4.5s+ Gold Frenzy)
  const handleGoldOverdrive = useCallback(() => {
    const sim = simRef.current;
    const shark = sim.shark;
    const cost = getGoldOverdriveCost(economyUsesRef.current.goldOverdriveCount);
    if (shark.coins < cost) return;
    shark.coins -= cost;
    economyUsesRef.current.goldOverdriveCount += 1;
    shark.stats = computeSharkStats(
      shark.level,
      equippedRef.current,
      true,
      organStarsRef.current,
      infiniteProgressionManager.globalDifficultyMultiplier
    );
    shark.frenzyTimer = Math.max(
      shark.frenzyTimer,
      4.5 + shark.stats.frenzyDurationBonus
    );
    shark.hp = Math.min(shark.stats.maxHp, shark.hp + 45);
    shark.energy = shark.stats.maxEnergy;
    shark.invulnerableTimer = Math.max(shark.invulnerableTimer, 1.0);
    soundFX.playEvolution();
    spawnFloatText(
      shark.x,
      shark.y - 42,
      'float_gold_overdrive',
      '+45 HP · FRENZY!',
      '#fde047',
      1.28
    );
    setHudState((prev) => ({
      ...prev,
      coins: shark.coins,
      hp: Math.ceil(shark.hp),
      energy: Math.round(shark.energy),
      frenzyTimer: Number(shark.frenzyTimer.toFixed(1)),
      goldOverdriveCost: getGoldOverdriveCost(
        economyUsesRef.current.goldOverdriveCount
      ),
    }));
  }, [spawnFloatText]);

  // P2-2 In-Run Economy Action 2: Spend Dynamic Gene Shards for Mutation Surge (+45% Evolution XP & instant Level-Up check)
  const handleGeneSurge = useCallback(() => {
    const sim = simRef.current;
    const shark = sim.shark;
    const cost = getGeneSurgeCost(
      shark.level,
      economyUsesRef.current.geneSurgeCount
    );
    if (shark.genes < cost) return;
    shark.genes -= cost;
    economyUsesRef.current.geneSurgeCount += 1;
    const xpReq = getXpRequiredForLevel(shark.level);
    const bonusXp = Math.ceil(xpReq * 0.45);
    shark.xp += bonusXp;
    shark.hp = Math.min(shark.stats.maxHp, shark.hp + 20);
    soundFX.playEvolution();
    spawnFloatText(
      shark.x,
      shark.y - 42,
      'float_gene_surge',
      `+${bonusXp} XP`,
      '#34d399',
      1.26
    );
    if (shark.xp >= xpReq) {
      shark.xp -= xpReq;
      shark.level += 1;
      shark.stats = computeSharkStats(
        shark.level,
        equippedRef.current,
        shark.frenzyTimer > 0,
        organStarsRef.current,
        infiniteProgressionManager.globalDifficultyMultiplier
      );
      shark.hp = Math.min(
        shark.stats.maxHp,
        shark.hp + Math.round(shark.stats.maxHp * 0.35)
      );
      if (autoEvolveRef.current) {
        autoMountBestOrgan();
      } else {
        shark.pendingEvoCount += 1;
        setEvoChoices(pickEvolutionChoices(equippedRef.current));
      }
    }
    setHudState((prev) => ({
      ...prev,
      genes: shark.genes,
      level: shark.level,
      xp: Math.round(shark.xp),
      xpToNext: getXpRequiredForLevel(shark.level),
      hp: Math.ceil(shark.hp),
      geneSurgeCost: getGeneSurgeCost(
        shark.level,
        economyUsesRef.current.geneSurgeCount
      ),
      pendingEvoCount: shark.pendingEvoCount,
    }));
  }, [autoMountBestOrgan, spawnFloatText]);

  // P2-2 In-Run Economy Action 3: Spend Dynamic Gene Shards inside Evolution Modal to Reroll 3 Organ Choices
  const handleRerollOrgans = useCallback(() => {
    const sim = simRef.current;
    const cost = getOrganRerollCost(economyUsesRef.current.rerollCount);
    if (sim.shark.genes < cost) return;
    sim.shark.genes -= cost;
    economyUsesRef.current.rerollCount += 1;
    soundFX.playCoin();
    setEvoChoices(pickEvolutionChoices(equippedRef.current));
    setHudState((prev) => ({
      ...prev,
      genes: sim.shark.genes,
      rerollCost: getOrganRerollCost(economyUsesRef.current.rerollCount),
    }));
  }, []);

  // Keyboard Listeners (WASD / Arrows / Space / E / P / M / Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If simulated ad is open, ignore game keys
      if (simAdRef.current?.active) return;

      if (gameStateRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startNewRun(false);
        }
        return;
      }

      if (e.code === 'KeyE') {
        if (
          gameStateRef.current === 'playing' &&
          !evoChoicesRef.current &&
          simRef.current.shark.pendingEvoCount > 0
        ) {
          e.preventDefault();
          setEvoChoices(pickEvolutionChoices(equippedRef.current));
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (evoChoicesRef.current) return;
        e.preventDefault();
        setGameState((prev) => {
          if (prev === 'playing') return 'paused';
          if (prev === 'paused') return 'playing';
          return prev;
        });
        return;
      }

      if (e.code === 'KeyM') {
        const muted = soundFX.toggleMute();
        setIsMuted(muted);
        return;
      }

      simRef.current.input.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        setBoostVisual(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      simRef.current.input.keys.delete(e.code);
      if (e.code === 'Space') {
        setBoostVisual(simRef.current.input.boostPointerHeld);
      }
    };

    const handleWindowBlur = () => {
      simRef.current.input.keys.clear();
      simRef.current.input.joyActive = false;
      simRef.current.input.boostPointerHeld = false;
      simRef.current.input.canvasPointerActive = false;
      simRef.current.input.rightMouseBoostHeld = false;
      setJoystickVisual({ active: false, dx: 0, dy: 0 });
      setBoostVisual(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [startNewRun]);

  // Main 60 FPS Canvas 2D Simulation & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let animId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const sim = simRef.current;
      const shark = sim.shark;
      const isPausedOrOverlay =
        gameStateRef.current === 'paused' ||
        gameStateRef.current === 'gameover' ||
        Boolean(evoChoicesRef.current) ||
        Boolean(simAdRef.current?.active);

      // ==================== 1. UPDATE SIMULATION ====================
      if (gameStateRef.current === 'title') {
        // Title Screen Live World Camera Tour / Hero Patrol
        shark.swimPhase += dt * 7.5;
        shark.biteAnim = Math.max(0, shark.biteAnim - dt * 3);
        const tSec = now * 0.0008;
        const targetX = Math.cos(tSec) * 280;
        const targetY = 260 + Math.sin(tSec * 2) * 85;
        const dx = targetX - shark.x;
        const dy = targetY - shark.y;
        shark.angle = Math.atan2(dy, dx);
        shark.x = targetX;
        shark.y = targetY;
        sim.camera.x = shark.x;
        sim.camera.y = shark.y - 115;
        sim.camera.zoom = 1.05;

        // Ambient prey swim on title screen
        if (sim.preyList.length === 0) {
          for (let i = 0; i < 32; i++) {
            sim.preyList.push(createPreyEntity(0, 260));
          }
        }
        for (const prey of sim.preyList) {
          prey.phase += dt * 3;
          prey.x = infiniteWorldManager.wrapEntityX(prey.x + prey.vx * dt * 0.5);
        }
      } else if (gameStateRef.current === 'playing' && !isPausedOrOverlay) {
        // Hitstop decay
        if (shark.hitstopTimer > 0) {
          shark.hitstopTimer = Math.max(0, shark.hitstopTimer - dt);
        }
        const simDt = shark.hitstopTimer > 0 ? dt * 0.12 : dt;

        // Timers
        if (shark.hitFlashTimer > 0) {
          shark.hitFlashTimer = Math.max(0, shark.hitFlashTimer - dt);
        }
        if (shark.invulnerableTimer > 0) {
          shark.invulnerableTimer = Math.max(0, shark.invulnerableTimer - dt);
        }
        if (shark.cameraShakeTrauma > 0) {
          shark.cameraShakeTrauma = Math.max(0, shark.cameraShakeTrauma - dt * 2.2);
        }
        if (shark.comboTimer > 0) {
          shark.comboTimer = Math.max(0, shark.comboTimer - dt);
          if (shark.comboTimer === 0) {
            shark.comboCount = 0;
          }
        }
        if (shark.frenzyTimer > 0) {
          shark.frenzyTimer = Math.max(0, shark.frenzyTimer - dt);
          if (shark.frenzyTimer === 0) {
            shark.stats = computeSharkStats(
              shark.level,
              equippedRef.current,
              false,
              organStarsRef.current,
              infiniteProgressionManager.globalDifficultyMultiplier
            );
          }
        }

        // Steering Vector from Virtual Joystick, Keyboard WASD/Arrows, OR Full-Screen Canvas Pointer
        let inputX = 0;
        let inputY = 0;
        if (sim.input.joyActive) {
          inputX = sim.input.joyDx;
          inputY = sim.input.joyDy;
        } else {
          const keys = sim.input.keys;
          if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
          if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
          if (keys.has('KeyW') || keys.has('ArrowUp')) inputY -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown')) inputY += 1;

          // If no keyboard directional key is pressed, check full-canvas direct pointer steering
          if (inputX === 0 && inputY === 0 && sim.input.canvasPointerActive) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const vW = canvas.width / dpr;
            const vH = canvas.height / dpr;
            const sharkScreenX = vW / 2 + (shark.x - sim.camera.x) * sim.camera.zoom;
            const sharkScreenY = vH / 2 + (shark.y - sim.camera.y) * sim.camera.zoom;
            const rawDx = sim.input.canvasPointerX - sharkScreenX;
            const rawDy = sim.input.canvasPointerY - sharkScreenY;
            const dist = Math.hypot(rawDx, rawDy);
            if (dist > 14) {
              const norm = Math.min(1, dist / 115);
              inputX = (rawDx / dist) * norm;
              inputY = (rawDy / dist) * norm;
            }
          }
        }

        const inputMag = Math.hypot(inputX, inputY);
        if (inputMag > 0.08) {
          shark.targetAngle = Math.atan2(inputY, inputX);
          // Smooth angular interpolation
          let diff = shark.targetAngle - shark.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          shark.angle += diff * Math.min(1, simDt * 10.5);
        }

        // Boost Handling (2x Speed + Tail Flame Particles; supports Space, Boost Button, or Right-Click)
        const wantsBoost =
          sim.input.boostPointerHeld ||
          sim.input.rightMouseBoostHeld ||
          sim.input.keys.has('Space');
        const isBoosting =
          wantsBoost && (shark.energy > 2 || shark.frenzyTimer > 0);

        if (isBoosting) {
          shark.energy = Math.max(
            0,
            shark.energy - shark.stats.boostDrainPerSec * simDt
          );
          soundFX.playBoostPulse();
          // Emit vibrant tail flame / bubble particles
          if (Math.random() < 0.75) {
            const tailX = shark.x - Math.cos(shark.angle) * 44 * shark.stats.scale;
            const tailY = shark.y - Math.sin(shark.angle) * 44 * shark.stats.scale;
            spawnParticle(
              tailX + (Math.random() - 0.5) * 12,
              tailY + (Math.random() - 0.5) * 12,
              -Math.cos(shark.angle) * (120 + Math.random() * 90),
              -Math.sin(shark.angle) * (120 + Math.random() * 90),
              3.5 + Math.random() * 4.5,
              0.42,
              shark.frenzyTimer > 0 ? '#fde047' : '#38bdf8',
              'BUBBLE'
            );
          }
        } else {
          // Sea-surface breather bonus: swimming near the sunlit surface (y < 48m) accelerates boost recovery
          const surfaceBreatherBonus = shark.y < 48 ? 18 : 0;
          shark.energy = Math.min(
            shark.stats.maxEnergy,
            shark.energy +
              (GAME_CONFIG.world.baseBoostRegenPerSec + surfaceBreatherBonus) *
                simDt
          );
        }

        // Smoothly decelerate to a gentle underwater glide (18% speed) when player releases controls
        const targetSpeed = isBoosting
          ? shark.stats.boostSpeed
          : inputMag > 0.08
          ? shark.stats.moveSpeed * Math.min(1, Math.max(0.55, inputMag))
          : shark.stats.moveSpeed * 0.18;

        shark.vx += (Math.cos(shark.angle) * targetSpeed - shark.vx) * Math.min(1, simDt * 7);
        shark.vy += (Math.sin(shark.angle) * targetSpeed - shark.vy) * Math.min(1, simDt * 7);

        shark.x += shark.vx * simDt;
        shark.y += shark.vy * simDt;

        // 模块 A：无限世界与动态边界控制器 (InfiniteWorldManager)
        // 1. 无限横向循环逻辑 ([-worldWidth/2, +worldWidth/2] 自动传送 + 相机无缝同步)
        // 2. 垂直方向向下无边界跟随 (海面 Y=0，向下深渊无限延伸)
        infiniteWorldManager.update(dt, shark, sim.camera);
        sim.camera.zoom +=
          (shark.stats.cameraZoom - sim.camera.zoom) * Math.min(1, dt * 3.5);

        shark.maxDepthReached = Math.max(
          shark.maxDepthReached,
          Math.round(shark.y)
        );

        // Depth Zone Milestone Notifications (First time crossing into Twilight 520m & Cthulhu Abyss 1150m)
        if (!shark.reachedTwilight && shark.y >= 520) {
          shark.reachedTwilight = true;
          spawnFloatText(
            shark.x,
            shark.y - 46,
            'float_zone_twilight',
            '',
            '#38bdf8',
            1.28
          );
        } else if (!shark.reachedAbyss && shark.y >= 1150) {
          shark.reachedAbyss = true;
          shark.cameraShakeTrauma = Math.max(shark.cameraShakeTrauma, 0.35);
          spawnFloatText(
            shark.x,
            shark.y - 46,
            'float_zone_abyss',
            '',
            '#c084fc',
            1.35
          );
        }

        // Sync skeletal swim phase with actual speed
        const speedNorm = Math.hypot(shark.vx, shark.vy) / 220;
        shark.swimPhase += simDt * (6.5 + speedNorm * 5.2);
        shark.biteAnim = Math.max(0, shark.biteAnim - simDt * 3.8);

        // Hunger HP Drain + Delayed Ghost Bar
        shark.hp = Math.max(0, shark.hp - shark.stats.hpDrainPerSec * simDt);
        if (shark.ghostHp > shark.hp) {
          shark.ghostHp = Math.max(
            shark.hp,
            shark.ghostHp - (shark.ghostHp - shark.hp) * simDt * 3.2 - 2 * simDt
          );
        } else {
          shark.ghostHp = shark.hp;
        }

        // 模块 C：让游戏永远玩下去的数值膨胀系统 (InfiniteProgressionManager)
        // 每过 60 秒，全球难度（敌人生命值、体型、攻击性、分值回报、深海代谢消耗）提升 10%
        const prevDiff = infiniteProgressionManager.globalDifficultyMultiplier;
        infiniteProgressionManager.update(simDt);
        if (infiniteProgressionManager.globalDifficultyMultiplier !== prevDiff) {
          shark.stats = computeSharkStats(
            shark.level,
            equippedRef.current,
            shark.frenzyTimer > 0,
            organStarsRef.current,
            infiniteProgressionManager.globalDifficultyMultiplier
          );
        }

        // If the shark dives or ascends outside the current Target Bounty species' natural depth habitat,
        // automatically switch the bounty target to a native species of the current depth zone!
        if (
          shark.y < sim.targetBounty.preyConfig.minDepth - 140 ||
          shark.y > sim.targetBounty.preyConfig.maxDepth + 140
        ) {
          const zoneNativeTarget = rollTargetBountyConfig(
            shark.stats.biteTier,
            shark.y,
            sim.targetBounty.preyConfig.id
          );
          sim.targetBounty = {
            preyConfig: zoneNativeTarget,
            progress: 0,
            required: 2,
          };
          ecosystemSpawner.activeTargetPreyId = zoneNativeTarget.id;
        }

        // 模块 B：生态鱼群智能刷新与回收池 (EcosystemSpawner)
        // 维持同屏 maxActivePreys=50，回收距离超出 spawnRadius*1.5 的鱼，并在视野外生成严格符合水深栖息带的鱼群
        ecosystemSpawner.update(
          simDt,
          sim.preyList,
          shark.x,
          shark.y,
          Math.random,
          shark.score
        );

        // Mouth & Front-Body hitbox world coordinates
        const mouthX = shark.x + Math.cos(shark.angle) * 32 * shark.stats.scale;
        const mouthY = shark.y + Math.sin(shark.angle) * 32 * shark.stats.scale;
        const frontBodyX = shark.x + Math.cos(shark.angle) * 10 * shark.stats.scale;
        const frontBodyY = shark.y + Math.sin(shark.angle) * 10 * shark.stats.scale;
        const mouthRadius = 28 * shark.stats.scale;

        // Update Prey AI, Jaw Suction Assist & Check Mouth Devour Collision
        for (let i = sim.preyList.length - 1; i >= 0; i--) {
          const prey = sim.preyList[i];
          prey.phase += simDt * 3.2;

          const distToShark = Math.hypot(shark.x - prey.x, shark.y - prey.y);
          const visualPreyScale = getPreyRelativeVisualScale(
            prey.config,
            shark.stats,
            prey.mutationVariant
          );
          const effectivePreyTier = getEffectivePreyTier(
            prey.config,
            prey.mutationVariant
          );
          const requiresBoostArmorBreak =
            (prey.mutationVariant === 'ABYSS_BEHEMOTH' && prey.config.tier >= 7) ||
            Boolean(prey.config.isBoss);
          const canEatNow =
            (shark.frenzyTimer > 0 ||
              (shark.stats.biteTier >= effectivePreyTier &&
                (!requiresBoostArmorBreak || isBoosting))) &&
            !prey.config.isHazard;
          // Generous jaw suction & bite floor (0.78x) on shrunk edible fish so eating tiny minnows stays effortless
          const eatHitScale = Math.max(visualPreyScale, 0.78);
          const suctionRadius =
            mouthRadius * 2.15 + prey.config.radius * eatHitScale;
          const distToMouthPre = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          const inJawSuctionZone = canEatNow && distToMouthPre < suctionRadius;

          // Distinct AI Behavior Policies per Prey Archetype
          switch (prey.config.behavior) {
            case 'DRIFT_SWARM': {
              prey.vy = Math.sin(prey.phase * 1.5) * 28;
              break;
            }
            case 'SCHOOL_FLEE': {
              // Suppress last-pixel panic scatter once inside the shark's jaw suction zone
              if (
                distToShark < 240 &&
                shark.stats.biteTier >= effectivePreyTier &&
                !inJawSuctionZone
              ) {
                const fleeAngle = Math.atan2(prey.y - shark.y, prey.x - shark.x);
                prey.vx = Math.cos(fleeAngle) * prey.config.baseSpeed * 1.25;
                prey.vy = Math.sin(fleeAngle) * prey.config.baseSpeed * 1.25;
              }
              break;
            }
            case 'PUFFER_INFLATE': {
              prey.isInflated = distToShark < 190;
              if (prey.isInflated && !inJawSuctionZone) {
                const fleeAngle = Math.atan2(prey.y - shark.y, prey.x - shark.x);
                prey.vx = Math.cos(fleeAngle) * prey.config.baseSpeed * 1.15;
                prey.vy = Math.sin(fleeAngle) * prey.config.baseSpeed * 1.15;
              }
              break;
            }
            case 'SUB_PATROL': {
              prey.vy = Math.cos(prey.phase * 0.8) * 35;
              break;
            }
            case 'EEL_CHARGER': {
              if (distToShark < 290 && prey.telegraphTimer <= 0) {
                prey.telegraphTimer = 0.55;
              }
              if (prey.telegraphTimer > 0) {
                prey.telegraphTimer -= simDt;
                if (prey.telegraphTimer <= 0) {
                  // Lunge toward shark
                  const atkAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
                  prey.vx = Math.cos(atkAngle) * prey.config.baseSpeed * 1.85;
                  prey.vy = Math.sin(atkAngle) * prey.config.baseSpeed * 1.85;
                }
              }
              break;
            }
            case 'MINE_HAZARD': {
              prey.vx = Math.sin(prey.phase * 0.6) * 12;
              prey.vy = Math.cos(prey.phase * 0.9) * 12;
              if (distToShark < 150) {
                prey.telegraphTimer = 0.4;
              } else {
                prey.telegraphTimer = Math.max(0, prey.telegraphTimer - simDt);
              }
              break;
            }
            case 'HEAVY_CRUISER':
            case 'KRAKEN_BOSS': {
              if (distToShark < 420) {
                const dirAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
                // Abyss Behemoths and Bosses aggressively hunt the shark outside of Gold Frenzy!
                const isAggressiveApex =
                  prey.config.isBoss ||
                  prey.mutationVariant === 'ABYSS_BEHEMOTH' ||
                  shark.stats.biteTier < effectivePreyTier;
                const mult =
                  shark.frenzyTimer > 0
                    ? -0.75
                    : isAggressiveApex
                    ? 1.08
                    : -0.75;
                prey.vx = Math.cos(dirAngle) * prey.config.baseSpeed * mult;
                prey.vy = Math.sin(dirAngle) * prey.config.baseSpeed * mult;
              }
              break;
            }
          }

          // P0-3 Jaw Suction Pull: smoothly pull edible prey into the shark's open jaws when close
          if (inJawSuctionZone) {
            const pullRatio = Math.max(0, 1 - distToMouthPre / suctionRadius);
            const sharkSpeed = Math.hypot(shark.vx, shark.vy);
            const suctionSpeed = (220 + sharkSpeed * 0.65) * (0.45 + pullRatio * 0.75);
            const pullAngle = Math.atan2(mouthY - prey.y, mouthX - prey.x);
            prey.x += Math.cos(pullAngle) * suctionSpeed * simDt;
            prey.y += Math.sin(pullAngle) * suctionSpeed * simDt;
            shark.biteAnim = Math.max(shark.biteAnim, 0.35 * pullRatio);
          }

          // Golden Frenzy Magnet only gently pulls nearby small T1~T2 fish (prevents screen-wide vacuum snowballing)
          if (
            shark.frenzyTimer > 0 &&
            prey.config.tier <= 2 &&
            !prey.config.isHazard &&
            distToShark < shark.stats.magnetRadius * 0.72
          ) {
            const pullAngle = Math.atan2(mouthY - prey.y, mouthX - prey.x);
            prey.x += Math.cos(pullAngle) * 165 * simDt;
            prey.y += Math.sin(pullAngle) * 165 * simDt;
          }

          prey.x = infiniteWorldManager.wrapEntityX(prey.x + prey.vx * simDt);
          prey.y += prey.vy * simDt;

          // Strictly keep every fish within its natural biological depth habitat [minDepth, maxDepth]
          const minHabitatY = Math.max(25, prey.config.minDepth);
          const maxHabitatY = prey.config.maxDepth;
          if (prey.y < minHabitatY) {
            prey.y = minHabitatY;
            prey.vy = Math.abs(prey.vy) * 0.65;
          } else if (prey.y > maxHabitatY) {
            prey.y = maxHabitatY;
            prey.vy = -Math.abs(prey.vy) * 0.65;
          }

          // Check collision with Shark Mouth / Front-Body (using visualPreyScale for hazards and generous eatHitScale for edible prey)
          const distToMouth = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          const distToFrontBody = Math.hypot(frontBodyX - prey.x, frontBodyY - prey.y);
          const effectiveHitDist = canEatNow
            ? Math.min(distToMouth, distToFrontBody * 0.95)
            : distToMouth;
          const hitThreshold = canEatNow
            ? mouthRadius * 1.18 + prey.config.radius * eatHitScale * 1.02
            : mouthRadius * 0.92 + prey.config.radius * visualPreyScale * 0.92;

          if (effectiveHitDist < hitThreshold) {
            const outcome = resolvePreyEncounter(
              shark.stats,
              prey.config,
              shark.frenzyTimer > 0,
              isBoosting,
              prey.mutationVariant ?? 'NONE',
              infiniteProgressionManager.globalDifficultyMultiplier
            );

            if (outcome.canDevour) {
              // Devour! Build Feeding Combo Chain + Restore Boost Energy on every kill (veteran hunt-to-boost flow!)
              shark.comboCount += 1;
              shark.comboTimer = 3.2;
              const comboMult = Number(
                (1 + Math.min(1.0, (shark.comboCount - 1) * 0.08)).toFixed(2)
              );
              const boostRefill = 6 + prey.config.tier * 2;
              shark.energy = Math.min(
                shark.stats.maxEnergy,
                shark.energy + boostRefill
              );

              const variant = prey.mutationVariant ?? 'NONE';
              const variantScoreMult =
                variant === 'GOLDEN_MUTANT'
                  ? 3.0
                  : variant === 'ABYSS_BEHEMOTH'
                  ? 2.2
                  : 1.0;
              const frenzyStackMult =
                shark.frenzyTimer > 0
                  ? infiniteProgressionManager.getFrenzyScoreMultiplier()
                  : 1.0;
              const rewardScale =
                (prey.scaleMultiplier ?? 1.0) *
                variantScoreMult *
                frenzyStackMult *
                comboMult;

              const finalScoreGain = infiniteProgressionManager.getScaledPreyValue(
                Math.round(outcome.scoreGain * rewardScale)
              );

              shark.biteAnim = 1.0;
              shark.hp = Math.min(
                shark.stats.maxHp,
                shark.hp + Math.round(outcome.hpDelta * (prey.scaleMultiplier ?? 1.0))
              );
              shark.score += finalScoreGain;
              shark.genes += Math.round(
                outcome.geneGain * (variant === 'ABYSS_BEHEMOTH' ? 2.5 : 1.0)
              );
              shark.coins += Math.round(
                outcome.coinGain * (variant === 'GOLDEN_MUTANT' ? 3.0 : 1.0)
              );
              shark.preyEatenCount += 1;

              // Requires devouring 8 true Golden Mutants outside of Frenzy + passing the 12s initial / 25s post-frenzy cooldown!
              if (
                variant === 'GOLDEN_MUTANT' &&
                shark.frenzyTimer <= 0 &&
                infiniteProgressionManager.registerGoldenMutantDevoured()
              ) {
                shark.stats = computeSharkStats(
                  shark.level,
                  equippedRef.current,
                  true,
                  organStarsRef.current,
                  infiniteProgressionManager.globalDifficultyMultiplier
                );
                shark.frenzyTimer = 3.6 + shark.stats.frenzyDurationBonus;
              }
              if (prey.config.tier >= 4) {
                shark.hitstopTimer = 0.045;
                shark.cameraShakeTrauma = 0.32;
              }

              soundFX.playBite(prey.config.tier);

              // Compliant Green Slime Bubbles & DNA Crystals Burst (Zero red blood!)
              const burstCount = 10 + prey.config.tier * 2;
              for (let b = 0; b < burstCount; b++) {
                const ang = (b * Math.PI * 2) / burstCount + Math.random() * 0.4;
                const spd = 60 + Math.random() * 140;
                spawnParticle(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  4 + Math.random() * 5,
                  0.55 + Math.random() * 0.35,
                  b % 2 === 0 ? '#4ade80' : '#2dd4bf',
                  b % 3 === 0 ? 'DNA' : 'SLIME'
                );
              }

              // Spawn Collectible Gold Coins & DNA Helix Pickups
              const pickupDrops = Math.min(6, Math.ceil(prey.config.tier / 2) + 1);
              for (let d = 0; d < pickupDrops; d++) {
                const ang = Math.random() * Math.PI * 2;
                spawnPickup(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * 95,
                  Math.sin(ang) * 95,
                  d % 2 === 0 ? 'COIN' : 'DNA_CRYSTAL',
                  prey.config.tier * 2
                );
              }

              const comboSuffix =
                shark.comboCount >= 2 ? ` · x${shark.comboCount}🔥` : '';
              spawnFloatText(
                prey.x,
                prey.y - 16,
                outcome.floatTextKey,
                `+${finalScoreGain}${comboSuffix}`,
                outcome.isCrit || shark.comboCount >= 5 ? '#fde047' : '#4ade80',
                outcome.isCrit || shark.comboCount >= 5 ? 1.22 : 1.0
              );

              // Check if devoured prey matches the active Target Fish Bounty (🎯 悬赏目标鱼)
              if (prey.config.id === sim.targetBounty.preyConfig.id) {
                sim.targetBounty.progress += 1;
                if (sim.targetBounty.progress >= sim.targetBounty.required) {
                  const bountyBonusScore = infiniteProgressionManager.getScaledPreyValue(
                    350 * prey.config.tier
                  );
                  shark.score += bountyBonusScore;
                  shark.genes += 12;
                  shark.coins += 18;
                  spawnFloatText(
                    shark.x,
                    shark.y - 38,
                    'float_target_bounty',
                    `+${bountyBonusScore} 🎯`,
                    '#38bdf8',
                    1.28
                  );
                  const nextTarget = rollTargetBountyConfig(
                    shark.stats.biteTier,
                    shark.y,
                    prey.config.id
                  );
                  sim.targetBounty = {
                    preyConfig: nextTarget,
                    progress: 0,
                    required: 2,
                  };
                  ecosystemSpawner.activeTargetPreyId = nextTarget.id;

                  // Immediately assign 2 off-screen fish to the new Target Bounty species within its natural depth habitat
                  let assignedBountyCount = 0;
                  for (let k = 0; k < sim.preyList.length && assignedBountyCount < 2; k++) {
                    const candidate = sim.preyList[k];
                    if (candidate.uid === prey.uid) continue;
                    const dist = Math.hypot(candidate.x - shark.x, candidate.y - shark.y);
                    if (dist > 480) {
                      candidate.config = nextTarget;
                      candidate.y = Math.max(
                        Math.max(25, nextTarget.minDepth),
                        Math.min(nextTarget.maxDepth, candidate.y)
                      );
                      assignedBountyCount++;
                    }
                  }
                }
              }

              // Evolution XP check
              const prog = addEvolutionProgress(
                shark.level,
                shark.xp,
                outcome.xpGain
              );
              shark.level = prog.level;
              shark.xp = prog.xp;
              if (prog.leveledUpCount > 0) {
                shark.stats = computeSharkStats(
                  shark.level,
                  equippedRef.current,
                  shark.frenzyTimer > 0,
                  organStarsRef.current,
                  infiniteProgressionManager.globalDifficultyMultiplier
                );
                // Leveling up restores 35% of maxHp instead of 100% full heal
                shark.hp = Math.min(
                  shark.stats.maxHp,
                  shark.hp + Math.round(shark.stats.maxHp * 0.35)
                );
                soundFX.playEvolution();
                if (autoEvolveRef.current) {
                  for (let e = 0; e < prog.leveledUpCount; e++) {
                    autoMountBestOrgan();
                  }
                } else {
                  shark.pendingEvoCount += prog.leveledUpCount;
                  spawnFloatText(
                    shark.x,
                    shark.y - 44,
                    'float_evo_ready',
                    `LV.${shark.level}`,
                    '#38bdf8',
                    1.24
                  );
                }
              }

              // Recycle devoured prey into EcosystemSpawner pool and respawn off-screen with Infinite Scaling
              ecosystemSpawner.recycleAndRespawn(
                sim.preyList,
                i,
                shark.x,
                shark.y,
                Math.random,
                shark.score
              );
            } else {
              // Oversized Prey or Active Mine Hazard -> Respect 0.55s Invulnerability Frames (i-frames)
              const bounceAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
              if (shark.invulnerableTimer > 0) {
                // Gently separate during i-frames without taking repeated multi-frame damage
                shark.x += Math.cos(bounceAngle) * 10;
                shark.y += Math.sin(bounceAngle) * 10;
                continue;
              }

              const sizeFactor = Math.min(1.65, prey.scaleMultiplier ?? 1.0);
              const scaledDamage = Math.round(outcome.hpDelta * sizeFactor);
              shark.hp = Math.max(0, shark.hp + scaledDamage);
              shark.hitFlashTimer = 0.28;
              shark.invulnerableTimer = 0.55;
              shark.hitstopTimer = 0.055;
              shark.cameraShakeTrauma = 0.65;

              shark.vx = Math.cos(bounceAngle) * outcome.knockbackForce;
              shark.vy = Math.sin(bounceAngle) * outcome.knockbackForce;
              shark.x += Math.cos(bounceAngle) * 18;
              shark.y += Math.sin(bounceAngle) * 18;

              soundFX.playHit();
              spawnFloatText(
                shark.x,
                shark.y - 25,
                outcome.floatTextKey,
                `${scaledDamage} HP`,
                '#fb7185',
                1.18
              );

              if (prey.config.isHazard) {
                // Mine explodes into green/amber plasma sparks, recycles to pool & respawns off-screen
                for (let b = 0; b < 16; b++) {
                  const ang = (b * Math.PI * 2) / 16;
                  spawnParticle(
                    prey.x,
                    prey.y,
                    Math.cos(ang) * 190,
                    Math.sin(ang) * 190,
                    5,
                    0.5,
                    '#fbbf24',
                    'SPARK'
                  );
                }
                ecosystemSpawner.recycleAndRespawn(
                  sim.preyList,
                  i,
                  shark.x,
                  shark.y,
                  Math.random,
                  shark.score
                );
              }
            }
          }
        }

        // Update Pickups (Magnet Pull toward Shark)
        for (const pk of sim.pickups) {
          if (!pk.active) continue;
          pk.phase += simDt * 4;
          pk.vx *= 0.92;
          pk.vy *= 0.92;

          const dist = Math.hypot(shark.x - pk.x, shark.y - pk.y);
          if (dist < shark.stats.magnetRadius) {
            const pullAngle = Math.atan2(shark.y - pk.y, shark.x - pk.x);
            const pullSpeed = 380 + (shark.stats.magnetRadius - dist) * 2.2;
            pk.vx = Math.cos(pullAngle) * pullSpeed;
            pk.vy = Math.sin(pullAngle) * pullSpeed;
          }

          pk.x += pk.vx * simDt;
          pk.y += pk.vy * simDt;

          if (dist < 34 * shark.stats.scale) {
            pk.active = false;
            soundFX.playCoin();
            if (pk.kind === 'COIN') {
              shark.coins += pk.value;
              shark.score += pk.value * 10;
            } else {
              shark.genes += pk.value;
              shark.score += pk.value * 15;
            }
          }
        }

        // Update Particles
        for (const p of sim.particles) {
          if (!p.active) continue;
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt - 18 * dt; // Buoyant upward drift underwater
          p.vx *= 0.95;
          p.vy *= 0.95;
        }

        // Update Floating Bilingual Combat Texts
        for (const ft of sim.floatTexts) {
          if (!ft.active) continue;
          ft.life -= dt;
          if (ft.life <= 0) {
            ft.active = false;
            continue;
          }
          ft.y += ft.vy * dt;
        }

        // Direct 60Hz DOM Bar Width Updates (Zero React Re-render Overhead)
        const hpPct = Math.max(0, Math.min(100, (shark.hp / shark.stats.maxHp) * 100));
        const ghostPct = Math.max(
          0,
          Math.min(100, (shark.ghostHp / shark.stats.maxHp) * 100)
        );
        const energyPct = Math.max(
          0,
          Math.min(100, (shark.energy / shark.stats.maxEnergy) * 100)
        );
        const xpToNext = getXpRequiredForLevel(shark.level);
        const xpPct = Math.max(0, Math.min(100, (shark.xp / xpToNext) * 100));

        if (hpBarFillRef.current) {
          hpBarFillRef.current.style.transform = `scaleX(${hpPct / 100})`;
        }
        if (hpGhostFillRef.current) {
          hpGhostFillRef.current.style.transform = `scaleX(${ghostPct / 100})`;
        }
        if (energyBarFillRef.current) {
          energyBarFillRef.current.style.transform = `scaleX(${energyPct / 100})`;
        }
        if (xpBarFillRef.current) {
          xpBarFillRef.current.style.transform = `scaleX(${xpPct / 100})`;
        }

        // Check Defeat Condition (HP <= 0)
        if (shark.hp <= 0) {
          soundFX.playHit();
          setRunSnapshot({
            score: Math.round(shark.score),
            maxDepth: Math.round(shark.maxDepthReached),
            preyEaten: shark.preyEatenCount,
            level: shark.level,
            coins: shark.coins,
            genes: shark.genes,
            organsCount: Object.keys(equippedRef.current).length,
          });
          document.body.dataset.state = 'gameover';
          setGameState('gameover');
        }

        // Throttled HUD Integer Sync (every 120ms)
        if (now - sim.lastHudSyncTime > 120) {
          sim.lastHudSyncTime = now;
          const currentZone = getDepthZone(shark.y);
          setHudState({
            hp: Math.ceil(shark.hp),
            maxHp: shark.stats.maxHp,
            energy: Math.round(shark.energy),
            maxEnergy: shark.stats.maxEnergy,
            level: shark.level,
            xp: Math.round(shark.xp),
            xpToNext,
            score: Math.round(shark.score),
            genes: shark.genes,
            coins: shark.coins,
            depth: Math.round(shark.y),
            zoneKey: currentZone.nameKey,
            biteTier: shark.stats.biteTier,
            frenzyTimer: Number(shark.frenzyTimer.toFixed(1)),
            trialActive: shark.trialActive,
            targetFishNameKey: sim.targetBounty.preyConfig.nameKey,
            targetFishProgress: sim.targetBounty.progress,
            targetFishRequired: sim.targetBounty.required,
            activeSynergy: shark.stats.activeSynergy,
            goldOverdriveCost: getGoldOverdriveCost(
              economyUsesRef.current.goldOverdriveCount
            ),
            geneSurgeCost: getGeneSurgeCost(
              shark.level,
              economyUsesRef.current.geneSurgeCount
            ),
            rerollCost: getOrganRerollCost(economyUsesRef.current.rerollCount),
            pendingEvoCount: shark.pendingEvoCount,
            comboCount: shark.comboCount,
            comboMultiplier: Number(
              (1 + Math.min(1.0, Math.max(0, shark.comboCount - 1) * 0.08)).toFixed(2)
            ),
            goldenMutantCharge: infiniteProgressionManager.goldenMutantCharge,
            goldenMutantRequired: infiniteProgressionManager.goldenMutantRequired,
            frenzyCooldown: Math.ceil(infiniteProgressionManager.frenzyCooldownTimer),
          });
        }
      }

      // ==================== 2. RENDER OCEAN WORLD ====================
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 3-Tier Seamless Parallax Background (0.4x horizontal modulo scroll + depth cross-fade + God rays + rising bubbles)
      parallaxBackground.render(
        ctx,
        sim.camera.x,
        shark.y,
        viewW,
        viewH,
        now,
        dt
      );

      // Camera transform with trauma-squared screen shake
      const shakeMag =
        shark.cameraShakeTrauma * shark.cameraShakeTrauma * 18;
      const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
      const shakeY = (Math.random() - 0.5) * 2 * shakeMag;

      ctx.translate(viewW / 2 + shakeX, viewH / 2 + shakeY);
      ctx.scale(sim.camera.zoom, sim.camera.zoom);
      ctx.translate(-sim.camera.x, -sim.camera.y);

      // Dynamic phase-locked horizontal span around camera.x (120px is a multiple of 60px wave step & 24px dash period)
      const halfSpanX = Math.ceil(viewW / Math.max(0.35, sim.camera.zoom)) + 480;
      const surfStart = Math.floor((sim.camera.x - halfSpanX) / 120) * 120;
      const surfEnd = Math.ceil((sim.camera.x + halfSpanX) / 120) * 120;

      // P2-1 Vivid Sunlit Sea Surface & Animated Dual Wave Crests at y = 0..32
      const skySurfGrad = ctx.createLinearGradient(0, -180, 0, 32);
      skySurfGrad.addColorStop(0, 'rgba(186, 230, 253, 0.36)');
      skySurfGrad.addColorStop(0.75, 'rgba(125, 211, 252, 0.22)');
      skySurfGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = skySurfGrad;
      ctx.fillRect(surfStart, -180, surfEnd - surfStart, 212);

      // Secondary deeper wave ribbon
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let wx = surfStart; wx <= surfEnd; wx += 60) {
        const wy = 24 + Math.cos(wx * 0.012 - now * 0.0024) * 7;
        if (wx === surfStart) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();

      // Primary sunlit foam wave crest at y = 14
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let wx = surfStart; wx <= surfEnd; wx += 60) {
        const wy = 14 + Math.sin(wx * 0.015 + now * 0.0032) * 8;
        if (wx === surfStart) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();

      // Zone Depth Boundary Lines (Subtle diegetic depth markers, phase-locked to 24px dash cycle)
      for (const z of GAME_CONFIG.zones) {
        if (z.minDepth > 0) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.setLineDash([12, 12]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(surfStart, z.minDepth);
          ctx.lineTo(surfEnd, z.minDepth);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // P2-2 Render Distinct 3D Spinning Gold Coins & Faceted DNA Crystals
      for (const pk of sim.pickups) {
        if (!pk.active) continue;
        ctx.save();
        const bobY = Math.sin(pk.phase) * 3.5;
        ctx.translate(pk.x, pk.y + bobY);

        if (pk.kind === 'COIN') {
          const spinScaleX = 0.35 + Math.abs(Math.cos(pk.phase * 0.85)) * 0.65;
          // Soft golden aura
          ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.scale(spinScaleX, 1);
          // Outer gold coin rim
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Inner bright gold face
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
          ctx.fill();

          // Center emblem bar
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-2, -4.5, 4, 9);
        } else {
          // DNA_CRYSTAL: Faceted glowing emerald-cyan crystal shard
          const rot = Math.sin(pk.phase * 0.6) * 0.22;
          ctx.rotate(rot);

          ctx.fillStyle = 'rgba(52, 211, 153, 0.24)';
          ctx.beginPath();
          ctx.arc(0, 0, 17, 0, Math.PI * 2);
          ctx.fill();

          // Outer diamond crystal
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#a7f3d0';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -13);
          ctx.lineTo(9.5, 0);
          ctx.lineTo(0, 13);
          ctx.lineTo(-9.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner bioluminescent core facet
          ctx.fillStyle = '#6ee7b7';
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(4.5, 0);
          ctx.lineTo(0, 7);
          ctx.lineTo(-4.5, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Render Prey Entities within camera frustum
      const cullMargin = 220 / sim.camera.zoom;
      const minX = sim.camera.x - viewW / (2 * sim.camera.zoom) - cullMargin;
      const maxX = sim.camera.x + viewW / (2 * sim.camera.zoom) + cullMargin;
      const minY = sim.camera.y - viewH / (2 * sim.camera.zoom) - cullMargin;
      const maxY = sim.camera.y + viewH / (2 * sim.camera.zoom) + cullMargin;

      const isBoosting =
        (sim.input.boostPointerHeld ||
          sim.input.rightMouseBoostHeld ||
          sim.input.keys.has('Space')) &&
        (shark.energy > 2 || shark.frenzyTimer > 0);

      for (const prey of sim.preyList) {
        if (
          prey.x >= minX &&
          prey.x <= maxX &&
          prey.y >= minY &&
          prey.y <= maxY
        ) {
          drawPreyEntity(
            ctx,
            prey,
            shark.stats.biteTier,
            shark.frenzyTimer > 0,
            sim.targetBounty.preyConfig.id,
            isBoosting,
            shark.stats.relativePreyScale
          );
        }
      }

      // Render Player's Articulated Shark + Mounted Evolution Organs
      drawSharkWithOrgans(ctx, {
        x: shark.x,
        y: shark.y,
        angle: shark.angle,
        scale: shark.stats.scale,
        swimPhase: shark.swimPhase,
        biteAnim: shark.biteAnim,
        isBoosting,
        frenzyTimer: shark.frenzyTimer,
        hitFlashTimer: shark.hitFlashTimer,
        invulnerableTimer: shark.invulnerableTimer,
        equipped: equippedRef.current,
      });

      // Render Compliant Green Slime Bubbles & Devour FX Sprite Particles
      const devourFxFrame = spriteSheetManager.getFrame('DEVOUR_FX');
      for (const p of sim.particles) {
        if (!p.active) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        if (p.kind === 'DNA' && devourFxFrame) {
          const sz = p.radius * 4.8;
          ctx.drawImage(devourFxFrame, -sz / 2, -sz / 2, sz, sz);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Render Bilingual Floating Combat Texts
      for (const ft of sim.floatTexts) {
        if (!ft.active) continue;
        const alpha = Math.max(0, ft.life / ft.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(ft.x, ft.y);
        ctx.scale(ft.scale, ft.scale);
        ctx.font = '800 16px "Outfit", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 4;
        const label = `${translate(ft.textKey, langRef.current)} ${ft.bonusText}`;
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = ft.color;
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // Render Screen-Space Off-Screen Radar Indicators (P1-2: 🎯 Bounty / ★ Golden / ⚠️ Apex Predator)
      if (gameStateRef.current === 'playing') {
        ctx.save();
        ctx.scale(dpr, dpr);
        drawOffScreenRadarIndicators(
          ctx,
          sim.preyList,
          sim.camera,
          viewW,
          viewH,
          shark.stats.biteTier,
          shark.frenzyTimer > 0,
          sim.targetBounty.preyConfig.id,
          now
        );
        ctx.restore();
      }

      // Render Screen-Space Pointer Guide Reticle when Direct Canvas Steering is Active
      if (
        gameStateRef.current === 'playing' &&
        sim.input.canvasPointerActive &&
        !sim.input.joyActive
      ) {
        ctx.save();
        ctx.scale(dpr, dpr);
        const px = sim.input.canvasPointerX;
        const py = sim.input.canvasPointerY;
        const sharkScreenX = viewW / 2 + (shark.x - sim.camera.x) * sim.camera.zoom;
        const sharkScreenY = viewH / 2 + (shark.y - sim.camera.y) * sim.camera.zoom;

        ctx.strokeStyle = isBoosting
          ? 'rgba(250, 204, 21, 0.45)'
          : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(sharkScreenX, sharkScreenY);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = isBoosting
          ? 'rgba(250, 204, 21, 0.85)'
          : 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, isBoosting ? 14 : 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [createPreyEntity, spawnFloatText, spawnParticle, spawnPickup]);

  // Full-Canvas Direct Pointer Steering & Right-Click Boost Handlers (P0-4)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    simRef.current.input.canvasPointerActive = true;
    simRef.current.input.canvasPointerX = e.clientX;
    simRef.current.input.canvasPointerY = e.clientY;
    if (e.button === 2) {
      simRef.current.input.rightMouseBoostHeld = true;
      setBoostVisual(true);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    simRef.current.input.canvasPointerX = e.clientX;
    simRef.current.input.canvasPointerY = e.clientY;
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      simRef.current.input.rightMouseBoostHeld = false;
    }
    if (e.buttons === 0) {
      simRef.current.input.canvasPointerActive = false;
      simRef.current.input.rightMouseBoostHeld = false;
    }
    setBoostVisual(
      simRef.current.input.boostPointerHeld ||
        simRef.current.input.rightMouseBoostHeld ||
        simRef.current.input.keys.has('Space')
    );
  };

  // Virtual Joystick Pointer Handlers (Bottom-Left)
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawDx = e.clientX - centerX;
    const rawDy = e.clientY - centerY;
    const maxR = 46;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(maxR, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const nx = dist > 0 ? (Math.cos(angle) * clampedDist) / maxR : 0;
    const ny = dist > 0 ? (Math.sin(angle) * clampedDist) / maxR : 0;

    simRef.current.input.joyActive = true;
    simRef.current.input.joyOriginX = centerX;
    simRef.current.input.joyOriginY = centerY;
    simRef.current.input.joyDx = nx;
    simRef.current.input.joyDy = ny;
    setJoystickVisual({ active: true, dx: nx * maxR, dy: ny * maxR });
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!simRef.current.input.joyActive) return;
    const rawDx = e.clientX - simRef.current.input.joyOriginX;
    const rawDy = e.clientY - simRef.current.input.joyOriginY;
    const maxR = 46;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(maxR, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const nx = dist > 0 ? (Math.cos(angle) * clampedDist) / maxR : 0;
    const ny = dist > 0 ? (Math.sin(angle) * clampedDist) / maxR : 0;

    simRef.current.input.joyDx = nx;
    simRef.current.input.joyDy = ny;
    setJoystickVisual({ active: true, dx: nx * maxR, dy: ny * maxR });
  };

  const handleJoystickPointerUp = () => {
    simRef.current.input.joyActive = false;
    simRef.current.input.joyDx = 0;
    simRef.current.input.joyDy = 0;
    setJoystickVisual({ active: false, dx: 0, dy: 0 });
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const toggleMute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const muted = soundFX.toggleMute();
    setIsMuted(muted);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-slate-950">
      {/* Isolated Full-Viewport 60 FPS Canvas 2D Ocean World */}
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="block w-full h-full touch-none"
      />

      {/* Low HP Danger Vignette */}
      <AnimatePresence>
        {gameState === 'playing' && hudState.hp < hudState.maxHp * 0.28 && (
          <motion.div
            key="low-hp-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 pointer-events-none animate-pulse-danger"
            style={{
              boxShadow: 'inset 0 0 90px rgba(244, 63, 94, 0.55)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ==================== TOP-RIGHT UTILITY BAR (ON TITLE SCREEN) ==================== */}
      <AnimatePresence>
        {gameState === 'title' && (
          <motion.div
            key="title-top-right-bar"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="fixed top-3 right-3 md:top-4 md:right-4 z-30 flex items-center gap-2 pointer-events-auto"
          >
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={t('btn_lang_toggle')}
              className="game-btn-spring px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg font-display font-bold text-xs tracking-wide text-sky-100 bg-slate-900/95 border border-sky-400/40 hover:border-sky-300 hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              🌐 {t('btn_lang_toggle')} ({lang.toUpperCase()})
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={toggleMute}
              aria-label={isMuted ? t('btn_unmute') : t('btn_mute')}
              className="game-btn-spring px-3 py-1.5 md:px-3 md:py-2 rounded-lg font-display font-semibold text-xs text-slate-200 bg-slate-900/95 border border-slate-700 hover:border-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isMuted ? '🔇' : '🔊'} {isMuted ? t('btn_unmute') : t('btn_mute')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 1. TITLE SCREEN OVERLAY ==================== */}
      <AnimatePresence>
        {gameState === 'title' && (
          <motion.section
            key="title-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-label={t('game_title')}
            className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 md:p-10 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 35%, rgba(2, 132, 199, 0.12) 0%, rgba(2, 6, 23, 0.8) 100%)',
            }}
          >
            <div className="h-2 sm:h-4" />

            {/* Centerpiece SVG Emblem + Primary Start & Trial Max Mecha Ad CTA */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -14 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="landscape-title-wrap max-w-2xl mx-auto flex flex-col items-center text-center pointer-events-auto -mt-4 md:-mt-10"
            >
              {/* Bespoke Inline SVG Shark Fin & DNA Crest Emblem */}
              <svg
                viewBox="0 0 180 76"
                className="landscape-title-emblem w-28 h-12 sm:w-36 sm:h-16 mb-1.5 sm:mb-2 overflow-visible animate-float-emblem"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="crestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <path
                  d="M25 62 Q70 52 92 10 Q96 36 116 54 Q138 58 156 62 Z"
                  fill="url(#crestGrad)"
                  stroke="#e0f2fe"
                  strokeWidth="2.5"
                />
                <circle cx="92" cy="42" r="6" fill="#fde047" />
                <path
                  d="M16 66 Q90 54 164 66"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <h1
                className="font-display font-extrabold text-white tracking-tight hud-stroke mb-1 sm:mb-2"
                style={{
                  fontSize: 'clamp(1.75rem, 3.8vw, 3.35rem)',
                  textWrap: 'balance',
                }}
              >
                {t('game_title')}
              </h1>

              <p className="text-sky-200/90 text-xs sm:text-sm md:text-base font-medium mb-3.5 sm:mb-5 max-w-md">
                {t('game_subtitle')}
              </p>

              {/* Primary Actions (<= 3 menu actions total, horizontal on mobile landscape) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3.5 w-full">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startNewRun(false)}
                  className="game-btn-spring w-full sm:w-auto px-7 py-2.5 sm:py-3.5 rounded-xl font-display font-extrabold text-sm sm:text-base md:text-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  ▶ {t('btn_start')}
                </button>

                <button
                  type="button"
                  onClick={handleTrialMaxMechaAd}
                  className="game-btn-spring w-full sm:w-auto px-5 py-2.5 sm:py-3.5 rounded-xl font-display font-bold text-xs sm:text-sm md:text-base text-amber-950 bg-amber-400 hover:bg-amber-300 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  {t('btn_trial_mecha')}
                </button>
              </div>

              <button
                type="button"
                onClick={downloadStandaloneSingleFileHtml}
                className="mt-2 sm:mt-3 px-4 py-1 text-[11px] sm:text-xs font-medium text-sky-300/85 hover:text-white underline underline-offset-4 cursor-pointer whitespace-nowrap transition-colors"
              >
                ⬇ {t('btn_export_html')}
              </button>
            </motion.div>

            {/* Flat Single-Line Control Hint in Bottom Safe Margin */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ delay: 0.08, duration: 0.25 }}
              className="text-center text-[11px] sm:text-xs md:text-sm text-slate-300/90 font-medium tracking-wide truncate"
            >
              {t('control_hint')}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ==================== 2. PLAYING HUD (MOBILE-LANDSCAPE-FIRST PERIMETER SHELL) ==================== */}
      <AnimatePresence>
        {gameState !== 'title' && (
          <motion.div
            key="playing-hud"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="landscape-compact-pad fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-3 md:p-4"
          >
            {/* ==================== TOP PERIMETER RIBBON (ALWAYS SINGLE HORIZONTAL ROW ON LANDSCAPE & DESKTOP) ==================== */}
            <div className="flex items-start justify-between gap-1.5 sm:gap-2.5 w-full">
              {/* 1. Top-Left Cluster: Compact Biometric & 5-Organ Socket Pod */}
              <motion.div
                initial={{ opacity: 0, x: -28, y: -10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: -28, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="landscape-hud-biometric game-hud-card flex flex-col gap-1 border border-sky-400/35 rounded-xl p-2 md:p-2.5 w-[198px] sm:w-[232px] md:w-[268px] pointer-events-auto shrink-0"
              >
                {/* Row 1: Vitality HP Bar with Delayed Damage Ghost Bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] md:text-xs font-bold mb-0.5">
                    <span className="text-emerald-300 uppercase tracking-wider">
                      {t('hud_hp')}
                    </span>
                    <span className="font-mono-num text-white">
                      {hudState.hp}/{hudState.maxHp}
                    </span>
                  </div>
                  <div className="relative h-2 md:h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700/90">
                    <div
                      ref={hpGhostFillRef}
                      className="absolute inset-y-0 left-0 w-full bg-rose-500/75 origin-left transition-transform duration-75"
                      style={{ transform: 'scaleX(1)' }}
                    />
                    <div
                      ref={hpBarFillRef}
                      className="relative h-full w-full bg-emerald-400 origin-left"
                      style={{ transform: 'scaleX(1)' }}
                    />
                  </div>
                </div>

                {/* Row 2: Side-by-Side Boost Energy & Evolution Level/XP (Saves 35% vertical height on mobile landscape!) */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  {/* Boost Energy Mini-Column */}
                  <div>
                    <div className="flex items-center justify-between text-[9px] md:text-[10px] font-bold mb-0.5">
                      <span className="text-sky-300 truncate">{t('hud_energy')}</span>
                      <span className="font-mono-num text-sky-100">{hudState.energy}%</span>
                    </div>
                    <div className="relative h-1.5 md:h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700/90">
                      <div
                        ref={energyBarFillRef}
                        className="h-full w-full bg-sky-400 origin-left"
                        style={{ transform: 'scaleX(1)' }}
                      />
                    </div>
                  </div>

                  {/* Evo Level & Bite Tier Mini-Column */}
                  <div>
                    <div className="flex items-center justify-between text-[9px] md:text-[10px] font-bold mb-0.5">
                      <span className="text-purple-300 truncate">
                        Lv.{hudState.level}·T{hudState.biteTier}
                      </span>
                      <span className="font-mono-num text-purple-200">
                        {hudState.xp}/{hudState.xpToNext}
                      </span>
                    </div>
                    <div className="relative h-1.5 md:h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700/90">
                      <div
                        ref={xpBarFillRef}
                        className="h-full w-full bg-purple-400 origin-left"
                        style={{ transform: 'scaleX(0)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: 5 Modular Organ Sockets Strip */}
                <div className="grid grid-cols-5 gap-1 pt-1 border-t border-slate-800/90 text-center">
                  {ALL_SLOTS.map((slot) => {
                    const mounted = equippedOrgans[slot];
                    const star = organStars[slot] ?? 1;
                    return (
                      <div
                        key={slot}
                        title={
                          mounted
                            ? `${t(mounted.nameKey)} (★${star}): ${t(mounted.descKey)}`
                            : t(`slot_${slot}`)
                        }
                        className={`py-0.5 rounded text-[8px] sm:text-[9px] font-mono-num font-bold border transition-all duration-200 truncate ${
                          mounted
                            ? 'bg-sky-950/95 border-sky-400 text-sky-200'
                            : 'bg-slate-900/70 border-slate-800 text-slate-500'
                        }`}
                      >
                        {slot}
                        {mounted && star > 1 ? `★${star}` : ''}
                      </div>
                    );
                  })}
                </div>

                {/* Optional Active 3-Piece Faction Synergy Strip */}
                {hudState.activeSynergy && (
                  <div className="px-1.5 py-0.5 rounded bg-purple-950/85 border border-purple-400/50 text-[9px] md:text-[10px] font-display font-bold text-purple-200 text-center truncate">
                    {t(`synergy_${hudState.activeSynergy}`)}
                  </div>
                )}
              </motion.div>

              {/* 2. Top-Center Cluster: Single-Line Telemetry & Bounty Ribbon (Zero clipping & zero vertical wrapping!) */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.02 }}
                className="flex flex-col items-center gap-1 pointer-events-auto min-w-0 flex-1"
              >
                <div className="game-hud-card border border-sky-500/25 rounded-xl px-3 py-1 sm:px-3.5 sm:py-1.5 flex items-center justify-center gap-2 sm:gap-3">
                  {/* Score */}
                  <div className="shrink-0">
                    <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400 font-semibold leading-none mb-0.5">
                      {t('hud_score')}
                    </div>
                    <div className="font-display font-extrabold text-sm sm:text-base md:text-xl text-white font-mono-num leading-none">
                      {hudState.score}
                    </div>
                  </div>

                  <div className="h-5 w-px bg-slate-800 shrink-0" />

                  {/* Genes */}
                  <div className="shrink-0">
                    <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-emerald-400 font-semibold leading-none mb-0.5">
                      🧬 {t('hud_genes')}
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm md:text-base text-emerald-300 font-mono-num leading-none">
                      {hudState.genes}
                    </div>
                  </div>

                  <div className="h-5 w-px bg-slate-800 shrink-0" />

                  {/* Coins */}
                  <div className="shrink-0">
                    <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-amber-400 font-semibold leading-none mb-0.5">
                      🪙 {t('hud_coins')}
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm md:text-base text-amber-300 font-mono-num leading-none">
                      {hudState.coins}
                    </div>
                  </div>

                  <div className="hidden sm:block h-5 w-px bg-slate-800 shrink-0" />

                  {/* Ocean Depth */}
                  <div className="hidden sm:block shrink-0">
                    <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-sky-400 font-semibold leading-none mb-0.5">
                      <span className="hidden lg:inline">{t(hudState.zoneKey)}</span>
                      <span className="lg:hidden">🌊 {t('hud_depth')}</span>
                    </div>
                    <div className="font-mono-num font-bold text-xs sm:text-sm text-sky-200 leading-none">
                      {hudState.depth}m
                    </div>
                  </div>

                  <div className="hidden xl:block h-5 w-px bg-slate-800 shrink-0" />

                  {/* Target Bounty (Inline on wide xl desktop, compact sub-pill on mobile landscape/tablet) */}
                  <div className="hidden xl:block shrink-0">
                    <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-cyan-300 font-semibold leading-none mb-0.5">
                      🎯 {t('hud_target_fish')}
                    </div>
                    <div className="font-display font-bold text-xs text-cyan-100 whitespace-nowrap leading-none">
                      {t(hudState.targetFishNameKey)}{' '}
                      <span className="font-mono-num text-amber-300">
                        ({hudState.targetFishProgress}/{hudState.targetFishRequired})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compact Sub-Ribbon Status Pills: Target Bounty (on <xl), Active Combo, Gold Frenzy Timer / Charge */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <div className="xl:hidden px-2 py-0.5 rounded-md bg-slate-950/90 border border-cyan-500/35 text-[10px] font-display font-bold text-cyan-200 whitespace-nowrap">
                    🎯 {t(hudState.targetFishNameKey)} ({hudState.targetFishProgress}/
                    {hudState.targetFishRequired})
                  </div>

                  <AnimatePresence>
                    {hudState.comboCount >= 2 && (
                      <motion.div
                        key="combo-badge"
                        initial={{ opacity: 0, scale: 0.75, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.75, y: -4 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                        className="px-2 py-0.5 rounded-md bg-orange-500/95 border border-amber-200 text-slate-950 font-display font-extrabold text-[10px] sm:text-xs font-mono-num shadow whitespace-nowrap"
                      >
                        {t('hud_combo', {
                          count: hudState.comboCount,
                          mult: hudState.comboMultiplier.toFixed(2),
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {hudState.frenzyTimer > 0 ? (
                      <motion.div
                        key="frenzy-badge"
                        initial={{ opacity: 0, scale: 0.75 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.75 }}
                        className="animate-frenzy-glow px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-display font-extrabold text-[10px] sm:text-xs font-mono-num whitespace-nowrap"
                      >
                        ⚡ {t('hud_frenzy')}: {hudState.frenzyTimer.toFixed(1)}s
                      </motion.div>
                    ) : (
                      <motion.div
                        key="gold-charge-badge"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="px-2 py-0.5 rounded-md bg-slate-950/90 border border-amber-400/35 text-amber-300 font-display font-bold text-[10px] sm:text-xs font-mono-num whitespace-nowrap"
                      >
                        {hudState.frenzyCooldown > 0
                          ? t('hud_gold_cd', { sec: hudState.frenzyCooldown })
                          : t('hud_gold_charge', {
                              cur: hudState.goldenMutantCharge,
                              max: hudState.goldenMutantRequired,
                            })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* 3. Top-Right Cluster: Unified Compact System Utility Bar (Works seamlessly on Mobile Landscape & Desktop) */}
              <motion.div
                initial={{ opacity: 0, x: 28, y: -10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 28, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28, delay: 0.04 }}
                className="flex items-center gap-1.5 pointer-events-auto shrink-0"
              >
                <button
                  type="button"
                  onClick={toggleLanguage}
                  aria-label={t('btn_lang_toggle')}
                  className="game-btn-spring h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-display font-bold text-[11px] sm:text-xs tracking-wide text-sky-100 bg-slate-950/90 border border-sky-400/40 hover:border-sky-300 whitespace-nowrap cursor-pointer"
                >
                  🌐 <span className="hidden md:inline">{t('btn_lang_toggle')} </span>(
                  {lang.toUpperCase()})
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={toggleMute}
                  aria-label={isMuted ? t('btn_unmute') : t('btn_mute')}
                  className="game-btn-spring h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-display font-semibold text-[11px] sm:text-xs text-slate-200 bg-slate-950/90 border border-slate-700 hover:border-slate-500 whitespace-nowrap cursor-pointer"
                >
                  {isMuted ? '🔇' : '🔊'}
                  <span className="hidden lg:inline ml-1">
                    {isMuted ? t('btn_unmute') : t('btn_mute')}
                  </span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setGameState('paused');
                  }}
                  aria-label={t('btn_pause')}
                  className="game-btn-spring h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-display font-semibold text-[11px] sm:text-xs text-slate-200 bg-slate-950/90 border border-slate-700 hover:border-slate-500 whitespace-nowrap cursor-pointer"
                >
                  ⏸<span className="hidden lg:inline ml-1">{t('btn_pause')} [P]</span>
                </button>
              </motion.div>
            </div>

            {/* ==================== BOTTOM PERIMETER ROW: LEFT THUMB JOYSTICK + RIGHT THUMB TACTICAL ARC ==================== */}
            <div className="flex items-end justify-between w-full pb-1 sm:pb-2 px-1 sm:px-2">
              {/* Bottom-Left: Ergonomic Virtual Steering Joystick with Compass Reticle */}
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                role="slider"
                aria-label="Virtual Steering Joystick"
                aria-valuenow={Math.round(joystickVisual.dx)}
                onPointerDown={handleJoystickPointerDown}
                onPointerMove={handleJoystickPointerMove}
                onPointerUp={handleJoystickPointerUp}
                onPointerCancel={handleJoystickPointerUp}
                className="landscape-thumb-joy relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-slate-950/70 border-2 border-sky-400/40 flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing touch-none shadow-lg"
              >
                {/* Inner compass ring & directional ticks */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-sky-400/20 pointer-events-none" />
                <div className="absolute top-1.5 w-1 h-2 rounded-full bg-sky-400/35 pointer-events-none" />
                <div className="absolute bottom-1.5 w-1 h-2 rounded-full bg-sky-400/35 pointer-events-none" />
                <div className="absolute left-1.5 w-2 h-1 rounded-full bg-sky-400/35 pointer-events-none" />
                <div className="absolute right-1.5 w-2 h-1 rounded-full bg-sky-400/35 pointer-events-none" />
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-sky-400/95 border-2 border-white shadow-md pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `translate3d(${joystickVisual.dx}px, ${joystickVisual.dy}px, 0)`,
                  }}
                />
              </motion.div>

              {/* Bottom-Right: Ergonomic Right-Thumb Tactical Cluster (Tactical Action Dock + Primary Boost Button) */}
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                className="flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-auto"
              >
                {/* Upper Right-Thumb Row: Queued Evolution Awakening Button & Auto-Evo Toggle */}
                <div className="flex items-center gap-1.5">
                  {hudState.pendingEvoCount > 0 && !autoEvolve && (
                    <button
                      type="button"
                      onClick={handleOpenPendingEvo}
                      className="game-btn-spring px-3 py-1.5 rounded-xl font-display font-extrabold text-xs bg-sky-400 text-slate-950 border-2 border-white hover:bg-sky-300 shadow-lg cursor-pointer whitespace-nowrap animate-bounce"
                    >
                      {t('btn_open_evo', { count: hudState.pendingEvoCount })}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleAutoEvolve}
                    className={`game-btn-spring px-2.5 py-1.5 rounded-xl font-display font-bold text-[11px] sm:text-xs border whitespace-nowrap cursor-pointer transition-all ${
                      autoEvolve
                        ? 'bg-cyan-400 text-slate-950 border-white shadow-md'
                        : 'bg-slate-950/90 text-slate-300 border-slate-700 hover:border-sky-400/50'
                    }`}
                  >
                    {autoEvolve ? t('btn_auto_evo_on') : t('btn_auto_evo_off')}
                  </button>
                </div>

                {/* Lower Right-Thumb Row: 3 Tactical Abilities Docked Beside Primary Boost Button */}
                <div className="flex items-end gap-2 sm:gap-2.5">
                  {/* Right-Thumb Tactical Skill Column/Grid (Supply Drop, Gold Overdrive, Gene Surge) */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleGeneSupplyDropAd}
                      title={t('btn_supply_drop')}
                      className="game-btn-spring px-2.5 py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-200 shadow-md cursor-pointer whitespace-nowrap"
                    >
                      <span className="hidden lg:inline">{t('btn_supply_drop')}</span>
                      <span className="lg:hidden">{t('btn_supply_short')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={hudState.coins < hudState.goldOverdriveCost}
                      onClick={handleGoldOverdrive}
                      title={t('btn_gold_overdrive', { cost: hudState.goldOverdriveCost })}
                      className={`game-btn-spring px-2.5 py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs border whitespace-nowrap transition-all ${
                        hudState.coins >= hudState.goldOverdriveCost
                          ? 'bg-amber-500 text-slate-950 border-amber-200 hover:bg-amber-400 shadow-md cursor-pointer animate-pulse'
                          : 'bg-slate-950/85 text-amber-200/45 border-amber-500/25 cursor-not-allowed'
                      }`}
                    >
                      <span className="hidden xl:inline">
                        {t('btn_gold_overdrive', { cost: hudState.goldOverdriveCost })}
                      </span>
                      <span className="xl:hidden">
                        {t('btn_overdrive_short', { cost: hudState.goldOverdriveCost })}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={hudState.genes < hudState.geneSurgeCost}
                      onClick={handleGeneSurge}
                      title={t('btn_gene_surge', { cost: hudState.geneSurgeCost })}
                      className={`game-btn-spring px-2.5 py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs border whitespace-nowrap transition-all ${
                        hudState.genes >= hudState.geneSurgeCost
                          ? 'bg-emerald-400 text-slate-950 border-emerald-200 hover:bg-emerald-300 shadow-md cursor-pointer animate-pulse'
                          : 'bg-slate-950/85 text-emerald-200/45 border-emerald-500/25 cursor-not-allowed'
                      }`}
                    >
                      <span className="hidden xl:inline">
                        {t('btn_gene_surge', { cost: hudState.geneSurgeCost })}
                      </span>
                      <span className="xl:hidden">
                        {t('btn_surge_short', { cost: hudState.geneSurgeCost })}
                      </span>
                    </button>
                  </div>

                  {/* Primary 2x Boost Thumb Button with Integrated SVG Energy Ring */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      simRef.current.input.boostPointerHeld = true;
                      setBoostVisual(true);
                    }}
                    onPointerUp={() => {
                      simRef.current.input.boostPointerHeld = false;
                      setBoostVisual(simRef.current.input.keys.has('Space'));
                    }}
                    onPointerCancel={() => {
                      simRef.current.input.boostPointerHeld = false;
                      setBoostVisual(false);
                    }}
                    className={`landscape-thumb-boost relative w-22 h-22 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full font-display font-extrabold text-xs sm:text-sm md:text-base flex flex-col items-center justify-center shadow-xl cursor-pointer transition-transform shrink-0 ${
                      boostVisual
                        ? 'bg-sky-400 text-slate-950 scale-95'
                        : 'bg-slate-950/90 text-sky-100 hover:bg-slate-900'
                    }`}
                  >
                    {/* Live Radial Boost Energy Ring */}
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="rgba(30, 41, 59, 0.85)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={
                          hudState.frenzyTimer > 0
                            ? '#fde047'
                            : boostVisual
                            ? '#ffffff'
                            : '#38bdf8'
                        }
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="283"
                        strokeDashoffset={
                          283 -
                          (283 *
                            Math.max(
                              0,
                              Math.min(100, (hudState.energy / hudState.maxEnergy) * 100)
                            )) /
                            100
                        }
                      />
                    </svg>
                    <span className="text-lg sm:text-xl leading-none mb-0.5">🚀</span>
                    <span>{t('btn_boost')}</span>
                    <span className="text-[9px] font-mono-num opacity-80 leading-none mt-0.5">
                      {hudState.energy}%
                    </span>
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 3. EVOLUTION 3-CHOICE MODAL (LANDSCAPE-FIT 3-COLUMN GRID) ==================== */}
      <AnimatePresence>
        {evoChoices && (
          <motion.div
            key="evo-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('evo_modal_title')}
            className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-slate-950/92 pointer-events-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="landscape-modal-card w-full max-w-3xl max-h-[94dvh] overflow-y-auto bg-slate-900 border border-sky-500/45 rounded-2xl p-3.5 sm:p-5 md:p-6 shadow-2xl"
            >
              <div className="text-center mb-2.5 sm:mb-4">
                <h2 className="font-display font-extrabold text-lg sm:text-2xl md:text-3xl text-white mb-0.5">
                  🧬 {t('evo_modal_title')}
                </h2>
                <p className="text-[11px] sm:text-xs md:text-sm text-slate-300">
                  {t('evo_modal_subtitle')}
                </p>
              </div>

              {/* 3-Column Horizontal Grid on Mobile Landscape (sm:grid-cols-3) & Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 mb-3.5 sm:mb-5 items-stretch">
                {evoChoices.map((organ, idx) => {
                  const hasSlot = Boolean(equippedOrgans[organ.slot]);
                  const nextStar = hasSlot ? (organStars[organ.slot] ?? 1) + 1 : 1;
                  return (
                    <motion.div
                      key={organ.id}
                      initial={{ opacity: 0, y: 16, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: idx * 0.05,
                        type: 'spring',
                        stiffness: 380,
                        damping: 26,
                      }}
                      className="h-full flex flex-col justify-between bg-slate-950 border border-slate-800 hover:border-sky-400/60 rounded-xl p-2.5 sm:p-3.5 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 mb-1.5">
                          <span>{t(`faction_${organ.faction}`)}</span>
                          <span>·</span>
                          <span>{t(`slot_${organ.slot}`)}</span>
                        </div>

                        {hasSlot && (
                          <div className="mb-1.5 inline-block px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-display font-bold text-amber-300">
                            {t('evo_star_upgrade', { star: nextStar })}
                          </div>
                        )}

                        <div className="flex items-center gap-2.5 mb-2">
                          <OrganCanvasPreview organ={organ} size={46} />
                          <h3 className="font-display font-bold text-xs sm:text-sm md:text-base text-white leading-snug">
                            {t(organ.nameKey)}
                          </h3>
                        </div>

                        <p className="text-[11px] sm:text-xs text-slate-300 leading-snug mb-2.5 sm:mb-3.5">
                          {t(organ.descKey)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSingleOrgan(organ)}
                        className="game-btn-spring w-full py-2 px-3 rounded-lg font-display font-bold text-xs text-white bg-sky-600 hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                      >
                        {t('evo_btn_select')}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Bottom Action Row: Claim All 3 Ad + Gene Reroll + 1-Click Auto-Evo */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={handleClaimAllThreeOrgansAd}
                  className="game-btn-spring w-full sm:w-auto py-2.5 sm:py-3 px-5 rounded-xl font-display font-extrabold text-xs sm:text-sm text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-lg cursor-pointer whitespace-nowrap"
                >
                  {t('evo_btn_claim_all')}
                </button>

                <button
                  type="button"
                  disabled={hudState.genes < hudState.rerollCost}
                  onClick={handleRerollOrgans}
                  className={`game-btn-spring w-full sm:w-auto py-2.5 sm:py-3 px-4 rounded-xl font-display font-bold text-xs border whitespace-nowrap transition-all ${
                    hudState.genes >= hudState.rerollCost
                      ? 'bg-emerald-950/90 text-emerald-200 border-emerald-400 hover:bg-emerald-900 cursor-pointer'
                      : 'bg-slate-950/60 text-slate-500 border-slate-800 cursor-not-allowed'
                  }`}
                >
                  {t('evo_btn_reroll', { cost: hudState.rerollCost })} ({hudState.genes})
                </button>

                <button
                  type="button"
                  onClick={handleToggleAutoEvolve}
                  className="game-btn-spring w-full sm:w-auto py-2.5 px-3.5 rounded-xl font-display font-bold text-xs text-cyan-200 bg-cyan-950/80 border border-cyan-500/50 hover:bg-cyan-900 cursor-pointer whitespace-nowrap"
                >
                  {t('evo_btn_auto_enable')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 4. PAUSE MODAL (LANDSCAPE-FIT COMPACT LAYOUT) ==================== */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <motion.div
            key="pause-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('btn_pause')}
            className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/92 pointer-events-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="landscape-modal-card w-full max-w-lg max-h-[94dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 text-center shadow-2xl"
            >
              <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white mb-1">
                {t('btn_pause')}
              </h2>
              <p className="text-xs text-slate-400 mb-3 sm:mb-4">
                {t('stat_organs_equipped')}: {Object.keys(equippedOrgans).length} / 5
              </p>

              {/* Equipped Organ Summary Grid (2 columns on landscape for compact height) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 mb-4 sm:mb-5 text-left">
                {ALL_SLOTS.map((slot) => {
                  const org = equippedOrgans[slot];
                  const star = organStars[slot] ?? 1;
                  return (
                    <div
                      key={slot}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] sm:text-xs"
                    >
                      <span className="text-slate-400 font-semibold">
                        {t(`slot_${slot}`)}
                      </span>
                      <span
                        className={
                          org ? 'text-sky-300 font-bold truncate ml-2' : 'text-slate-600'
                        }
                      >
                        {org ? `${t(org.nameKey)} ★${star}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGameState('playing')}
                  className="game-btn-spring sm:col-span-2 w-full py-2.5 sm:py-3 rounded-xl font-display font-bold text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 cursor-pointer"
                >
                  ▶ {t('btn_resume')}
                </button>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="game-btn-spring w-full py-2 rounded-xl font-display font-semibold text-xs text-sky-200 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  🌐 {t('btn_lang_toggle')} ({lang.toUpperCase()})
                </button>
                <button
                  type="button"
                  onClick={() => startNewRun(false)}
                  className="game-btn-spring w-full py-2 rounded-xl font-display font-semibold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  ↻ {t('btn_restart')}
                </button>
                <button
                  type="button"
                  onClick={() => setGameState('title')}
                  className="game-btn-spring sm:col-span-2 w-full py-2 rounded-xl font-display font-semibold text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('btn_title')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 5. GAMEOVER / AD REVIVE & SETTLEMENT MODAL ==================== */}
      <AnimatePresence>
        {gameState === 'gameover' && (
          <motion.div
            key="gameover-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            role="dialog"
            aria-modal="true"
            aria-label={reviveOffered ? t('gameover_title') : t('settlement_title')}
            className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/92 pointer-events-auto"
          >
            <motion.div
              key={reviveOffered ? 'revive-card' : 'settlement-card'}
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="landscape-modal-card w-full max-w-lg max-h-[94dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 text-center shadow-2xl"
            >
              {reviveOffered ? (
                <>
                  <h2 className="font-display font-extrabold text-xl sm:text-2xl text-rose-400 mb-1.5">
                    ⚡ {t('gameover_title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mb-4 sm:mb-5">
                    {t('gameover_subtitle')}
                  </p>

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handleReviveWithFrenzyAd}
                      className="game-btn-spring w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm sm:text-base text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-lg cursor-pointer"
                    >
                      {t('btn_revive_ad')}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        adManager.showInterstitialAd();
                        setReviveOffered(false);
                      }}
                      className="game-btn-spring w-full py-2 rounded-xl font-display font-semibold text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      {t('btn_give_up')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white mb-0.5">
                    🏆 {t('settlement_title')}
                  </h2>
                  <p className="text-xs text-slate-400 mb-3 sm:mb-4">
                    {t('settlement_subtitle')}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-4 sm:mb-5 text-left">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <div className="text-[10px] text-slate-400 truncate">
                        {t('stat_final_score')}
                      </div>
                      <div className="font-display font-extrabold text-base sm:text-lg text-white font-mono-num">
                        {runSnapshot.score}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <div className="text-[10px] text-slate-400 truncate">
                        {t('stat_max_depth')}
                      </div>
                      <div className="font-display font-extrabold text-base sm:text-lg text-sky-300 font-mono-num">
                        {runSnapshot.maxDepth}m
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <div className="text-[10px] text-slate-400 truncate">
                        {t('stat_prey_eaten')}
                      </div>
                      <div className="font-display font-extrabold text-base sm:text-lg text-emerald-300 font-mono-num">
                        {runSnapshot.preyEaten}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <div className="text-[10px] text-slate-400 truncate">
                        {t('stat_organs_equipped')}
                      </div>
                      <div className="font-display font-extrabold text-base sm:text-lg text-purple-300 font-mono-num">
                        {runSnapshot.organsCount} / 5
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      data-start="true"
                      onClick={() => startNewRun(false)}
                      className="game-btn-spring flex-1 py-3 rounded-xl font-display font-extrabold text-sm sm:text-base text-slate-950 bg-emerald-400 hover:bg-emerald-300 cursor-pointer"
                    >
                      ▶ {t('btn_restart')}
                    </button>
                    <button
                      type="button"
                      onClick={handleTrialMaxMechaAd}
                      className="game-btn-spring flex-1 py-3 rounded-xl font-display font-bold text-xs sm:text-sm text-amber-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
                    >
                      {t('btn_trial_mecha')}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 6. SIMULATED REWARDED VIDEO AD OVERLAY (3S COUNTDOWN) ==================== */}
      <AnimatePresence>
        {simAd && simAd.active && (
          <motion.div
            key="sim-ad-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('ad_sim_title')}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 pointer-events-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.86, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="landscape-modal-card w-full max-w-md max-h-[94dvh] overflow-y-auto bg-slate-900 border-2 border-amber-400/70 rounded-2xl p-4 sm:p-6 text-center shadow-2xl"
            >
              <div className="text-[11px] font-mono-num text-amber-300 uppercase tracking-wider mb-1">
                {t('ad_sim_badge')} · {t(`ad_env_${adManager.detectPlatform()}`)}
              </div>

              <h3 className="font-display font-extrabold text-lg sm:text-xl text-white mb-1">
                🎬 {t('ad_sim_title')}
              </h3>
              <p className="text-xs text-slate-300 mb-3 sm:mb-4">{t('ad_sim_desc')}</p>

              {/* Visual Animated Ad Preview Stage */}
              <div className="relative h-24 sm:h-32 w-full rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center mb-3.5 sm:mb-4 overflow-hidden">
                <div className="font-display font-extrabold text-3xl sm:text-4xl text-amber-400 font-mono-num mb-1">
                  {simAd.secondsLeft > 0 ? `${simAd.secondsLeft}s` : '✓'}
                </div>
                <div className="text-xs text-sky-200 font-medium">
                  {simAd.secondsLeft > 0
                    ? t('ad_sim_countdown', { sec: simAd.secondsLeft })
                    : t('ad_sim_ready')}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={simAd.secondsLeft > 0}
                  onClick={() => {
                    const rewardFn = simAd.onReward;
                    setSimAd(null);
                    rewardFn();
                  }}
                  className={`game-btn-spring w-full py-3 rounded-xl font-display font-extrabold text-sm ${
                    simAd.secondsLeft > 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 cursor-pointer'
                  }`}
                >
                  🎁 {t('ad_sim_claim_btn')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cancelFn = simAd.onCancel;
                    setSimAd(null);
                    if (cancelFn) cancelFn();
                  }}
                  className="game-btn-spring w-full py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('ad_sim_cancel_btn')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
