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
  PreyTierConfig,
} from './game/config';
import {
  addEvolutionProgress,
  ComputedSharkStats,
  computeEvolvedSharkStats,
  getDepthZone,
  getEffectivePreyTier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getPreyRelativeVisualScale,
  getXpRequiredForLevel,
  resolvePreyEncounter,
} from './game/rules';
import {
  evaluateSharkUnlock,
  GENERATION_NAMES,
  getGlobalAtlasBonuses,
  getNextEvolutionTarget,
  getSharkFormById,
  getSharkUpgradeCost,
  LINEAGE_META,
  loadSharkMetaSave,
  saveSharkMetaSave,
  SHARK_EVOLUTION_FORMS,
  SharkMetaSaveData,
} from './game/sharkEvolutionConfig';
import { soundFX } from './game/audio';
import { adManager, AdPlacement } from './game/adManager';
import {
  drawOffScreenRadarIndicators,
  drawPreyEntity,
  drawSharkWithOrgans,
  PreyEntity,
} from './game/canvasRenderer';
import { SharkEvolutionAtlasModal } from './components/SharkEvolutionAtlasModal';
import { SharkFormCanvasPreview } from './components/SharkFormCanvasPreview';
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
  coinsEarned: number;
  genesEarned: number;
  unlockedFormsCount: number;
  activeSharkId: string;
}

const MAX_PARTICLES = 220;
const MAX_PICKUPS = 65;
const MAX_FLOAT_TEXTS = 36;
const TARGET_PREY_COUNT = 54;

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

  // Persistent Cross-Run Shark Evolution & Upgrade Save Data
  const [metaSave, setMetaSave] = useState<SharkMetaSaveData>(() =>
    loadSharkMetaSave()
  );
  const metaSaveRef = useRef<SharkMetaSaveData>(metaSave);
  metaSaveRef.current = metaSave;

  // 48-Shark Evolution Atlas Modal visibility
  const [showAtlasModal, setShowAtlasModal] = useState<boolean>(false);
  const showAtlasModalRef = useRef<boolean>(false);
  showAtlasModalRef.current = showAtlasModal;

  const [reviveOffered, setReviveOffered] = useState<boolean>(true);
  const [runSnapshot, setRunSnapshot] = useState<RunSummarySnapshot>({
    score: 0,
    maxDepth: 120,
    preyEaten: 0,
    level: 1,
    coinsEarned: 0,
    genesEarned: 0,
    unlockedFormsCount: 1,
    activeSharkId: 'shark_00_clown_fry',
  });

  // Simulated Rewarded Ad Overlay state
  const [simAd, setSimAd] = useState<SimulatedAdState | null>(null);
  const simAdRef = useRef<SimulatedAdState | null>(null);
  simAdRef.current = simAd;

  // Audio mute state
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Discrete HUD state (throttled updates so React never reconciles at 60Hz unnecessarily)
  const [hudState, setHudState] = useState(() => {
    const initialSave = loadSharkMetaSave();
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
      depth: 120,
      zoneKey: 'zone_shallow',
      biteTier: activeForm.baseBiteTier,
      frenzyTimer: 0,
      trialActive: false,
      targetFishNameKey: 'prey_blue_tang_name',
      targetFishProgress: 0,
      targetFishRequired: 2,
      activeSynergy: null as FactionId | null,
      goldOverdriveCost: getGoldOverdriveCost(0),
      geneSurgeCost: getGeneSurgeCost(1, 0),
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
      canUpgradeBodyNow: activeUpg < 10 && initialSave.bankedCoins >= upgCost,
      bodyUpgradeCost: upgCost,
    };
  });

  const economyUsesRef = useRef<{
    goldOverdriveCount: number;
    geneSurgeCount: number;
    runStartCoins: number;
    runStartGenes: number;
  }>({
    goldOverdriveCount: 0,
    geneSurgeCount: 0,
    runStartCoins: 0,
    runStartGenes: 0,
  });

  // DOM refs for smooth 60fps bar transforms without React re-renders
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hpBarFillRef = useRef<HTMLDivElement | null>(null);
  const hpGhostFillRef = useRef<HTMLDivElement | null>(null);
  const energyBarFillRef = useRef<HTMLDivElement | null>(null);
  const xpBarFillRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const lastTouchActionTimeRef = useRef<number>(0);

  // Virtual Joystick UI state (kept for aria-valuenow; knob transform updates via joystickKnobRef at 60Hz without re-rendering buttons)
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
      comboCount: number;
      comboTimer: number;
      reachedTwilight: boolean;
      reachedAbyss: boolean;
      sharkFormId: string;
      morphFlashTimer: number;
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
      genes: metaSave.bankedGenes,
      coins: metaSave.bankedCoins,
      maxDepthReached: 220,
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
      '/assets/aistudio/fish2_fc857cfa.png',
      '/assets/aistudio/sharks_ec921c3b.png'
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
      const effectiveMaxTier = currentDepth > 500 ? Math.max(3, maxBiteTier) : Math.max(1, maxBiteTier);
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

  // Helper to recompute shark stats from current form, upgrade level, and unlocked atlas collection count
  const recomputeSharkStats = useCallback(
    (
      inRunLevel: number,
      frenzyActive: boolean,
      sharkFormIdOverride?: string,
      saveOverride?: SharkMetaSaveData
    ): ComputedSharkStats => {
      const save = saveOverride ?? metaSaveRef.current;
      const formId =
        sharkFormIdOverride ??
        simRef.current.shark.sharkFormId ??
        save.selectedSharkId;
      const upgLevel = simRef.current.shark.trialActive
        ? 10
        : save.sharkUpgradeLevels[formId] ?? 1;
      const unlockedCount = save.unlockedSharkIds.length;
      return computeEvolvedSharkStats(
        inRunLevel,
        formId,
        upgLevel,
        frenzyActive,
        infiniteProgressionManager.globalDifficultyMultiplier,
        unlockedCount
      );
    },
    []
  );

  // Initialize or reset a run
  const startNewRun = useCallback(
    (withMaxMechaTrial: boolean = false) => {
      const sim = simRef.current;
      const save = metaSaveRef.current;
      const chosenSharkId = withMaxMechaTrial
        ? 'shark_45_mecha_leviathan'
        : save.selectedSharkId;
      const chosenUpgLevel = withMaxMechaTrial
        ? 10
        : save.sharkUpgradeLevels[chosenSharkId] ?? 1;
      const unlockedCount = save.unlockedSharkIds.length;

      economyUsesRef.current = {
        goldOverdriveCount: 0,
        geneSurgeCount: 0,
        runStartCoins: save.bankedCoins,
        runStartGenes: save.bankedGenes,
      };

      const initialLevel = withMaxMechaTrial ? 5 : 1;
      const stats = computeEvolvedSharkStats(
        initialLevel,
        chosenSharkId,
        chosenUpgLevel,
        withMaxMechaTrial,
        1.0,
        unlockedCount
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
        genes: save.bankedGenes,
        coins: save.bankedCoins,
        maxDepthReached: 220,
        preyEatenCount: 0,
        frenzyTimer: withMaxMechaTrial ? 4.5 : 0,
        hitFlashTimer: 0,
        hitstopTimer: 0,
        invulnerableTimer: 1.8,
        cameraShakeTrauma: 0,
        trialActive: withMaxMechaTrial,
        comboCount: 0,
        comboTimer: 0,
        reachedTwilight: false,
        reachedAbyss: false,
        sharkFormId: chosenSharkId,
        morphFlashTimer: withMaxMechaTrial ? 1.0 : 0.45,
        stats,
      };

      sim.camera.x = sim.shark.x;
      sim.camera.y = sim.shark.y;
      sim.camera.zoom = stats.cameraZoom;

      // Clear held inputs
      sim.input.keys.clear();
      sim.input.joyActive = false;
      sim.input.joyPointerId = null;
      sim.input.joyDx = 0;
      sim.input.joyDy = 0;
      sim.input.boostPointerHeld = false;
      sim.input.boostPointerId = null;
      sim.input.canvasPointerActive = false;
      sim.input.canvasPointerId = null;
      sim.input.rightMouseBoostHeld = false;
      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
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
        if (i < 2) {
          spawned.config = firstTargetConfig;
          spawned.y = Math.max(
            Math.max(25, firstTargetConfig.minDepth),
            Math.min(firstTargetConfig.maxDepth, spawned.y)
          );
        }
      }
      // Guarantee 6 immediately edible shallow reef fish in front of the shark so the opening hunt is lively and safe
      const starterShowcaseIds = [
        'neon_tetra_school',
        'regal_blue_tang',
        'jellyfish_swarm',
        'neon_tetra_school',
        'regal_blue_tang',
        'coral_clownfish',
      ];
      for (let i = 0; i < 6; i++) {
        const candidate =
          GAME_CONFIG.preyTiers.find((p) => p.id === starterShowcaseIds[i]) ??
          GAME_CONFIG.preyTiers[0];
        const tierConfig =
          candidate.tier <= stats.biteTier ? candidate : GAME_CONFIG.preyTiers[0];
        sim.preyList.push({
          uid: sim.nextPreyUid++,
          config: tierConfig,
          x: 220 + i * 115,
          y: i % 2 === 0 ? 155 : 265,
          vx: 42,
          vy: 0,
          angle: 0,
          phase: i,
          telegraphTimer: 0,
          isInflated: false,
          scaleMultiplier: 1.0,
        });
      }

      const activeForm = getSharkFormById(chosenSharkId);
      const nextEvo = getNextEvolutionTarget(chosenSharkId, save);
      const nextEval = nextEvo
        ? evaluateSharkUnlock(
            nextEvo,
            save,
            0,
            0,
            Math.max(save.bestInRunLevel, initialLevel),
            Math.max(save.bestDepthReached, 220)
          )
        : null;
      const upgCost = getSharkUpgradeCost(activeForm, chosenUpgLevel);

      setShowAtlasModal(false);
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
        genes: save.bankedGenes,
        coins: save.bankedCoins,
        depth: 220,
        zoneKey: 'zone_shallow',
        biteTier: stats.biteTier,
        frenzyTimer: withMaxMechaTrial ? 4.5 : 0,
        trialActive: withMaxMechaTrial,
        targetFishNameKey: firstTargetConfig.nameKey,
        targetFishProgress: 0,
        targetFishRequired: 2,
        activeSynergy: stats.activeSynergy,
        goldOverdriveCost: getGoldOverdriveCost(0),
        geneSurgeCost: getGeneSurgeCost(initialLevel, 0),
        comboCount: 0,
        comboMultiplier: 1.0,
        goldenMutantCharge: 0,
        goldenMutantRequired: infiniteProgressionManager.goldenMutantRequired,
        frenzyCooldown: 12,
        activeSharkId: chosenSharkId,
        activeUpgradeLevel: chosenUpgLevel,
        unlockedFormsCount: unlockedCount,
        nextEvoTargetId: nextEvo?.id ?? null,
        canBreakthroughNow: Boolean(nextEval?.canUnlockNow),
        canUpgradeBodyNow: chosenUpgLevel < 10 && save.bankedCoins >= upgCost,
        bodyUpgradeCost: upgCost,
      });

      if (withMaxMechaTrial) {
        soundFX.playEvolution();
        spawnFloatText(
          0,
          180,
          'float_trial_start',
          '#46 MECHA LEVIATHAN',
          '#38bdf8',
          1.25
        );
      }

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

  // Upgrade any unlocked shark form's body level (Lv.1 -> Lv.10) using Coins
  const handleUpgradeSharkForm = useCallback(
    (sharkId: string) => {
      const sim = simRef.current;
      const save = metaSaveRef.current;
      if (!save.unlockedSharkIds.includes(sharkId)) return;
      const curLv = save.sharkUpgradeLevels[sharkId] ?? 1;
      if (curLv >= 10) return;
      const form = getSharkFormById(sharkId);
      const cost = getSharkUpgradeCost(form, curLv);
      if (save.bankedCoins < cost) return;

      const nextLv = curLv + 1;
      const nextSave: SharkMetaSaveData = {
        ...save,
        bankedCoins: save.bankedCoins - cost,
        sharkUpgradeLevels: {
          ...save.sharkUpgradeLevels,
          [sharkId]: nextLv,
        },
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);

      sim.shark.coins = nextSave.bankedCoins;
      if (sim.shark.sharkFormId === sharkId && !sim.shark.trialActive) {
        sim.shark.stats = recomputeSharkStats(
          sim.shark.level,
          sim.shark.frenzyTimer > 0,
          sharkId,
          nextSave
        );
        sim.shark.hp = Math.min(
          sim.shark.stats.maxHp,
          sim.shark.hp + Math.round(sim.shark.stats.maxHp * 0.25)
        );
        sim.shark.morphFlashTimer = 0.65;
        spawnFloatText(
          sim.shark.x,
          sim.shark.y - 38,
          'float_evo_ready',
          `${langRef.current === 'zh' ? form.nameZh : form.nameEn} Lv.${nextLv}!`,
          LINEAGE_META[form.lineage].badgeColor,
          1.22
        );
      }

      // Immediately sync HUD state so mobile multi-touch taps reflect on the exact same frame
      const activeForm = getSharkFormById(sim.shark.sharkFormId);
      const activeUpg =
        nextSave.sharkUpgradeLevels[sim.shark.sharkFormId] ?? 1;
      const nextUpgCost = getSharkUpgradeCost(activeForm, activeUpg);
      const nextEvo = getNextEvolutionTarget(sim.shark.sharkFormId, nextSave);
      const nextEval = nextEvo
        ? evaluateSharkUnlock(
            nextEvo,
            nextSave,
            0,
            0,
            Math.max(nextSave.bestInRunLevel, sim.shark.level),
            Math.max(nextSave.bestDepthReached, Math.round(sim.shark.maxDepthReached))
          )
        : null;
      setHudState((prev) => ({
        ...prev,
        coins: nextSave.bankedCoins,
        hp: Math.ceil(sim.shark.hp),
        maxHp: sim.shark.stats.maxHp,
        biteTier: sim.shark.stats.biteTier,
        activeUpgradeLevel: activeUpg,
        bodyUpgradeCost: nextUpgCost,
        canUpgradeBodyNow:
          !sim.shark.trialActive &&
          activeUpg < 10 &&
          nextSave.bankedCoins >= nextUpgCost,
        nextEvoTargetId: nextEvo?.id ?? null,
        canBreakthroughNow: Boolean(nextEval?.canUnlockNow),
      }));

      soundFX.playEvolution();
    },
    [recomputeSharkStats, spawnFloatText]
  );

  // Switch active deployed shark form to an already-unlocked form
  const handleSelectActiveSharkForm = useCallback(
    (sharkId: string) => {
      const sim = simRef.current;
      const save = metaSaveRef.current;
      if (!save.unlockedSharkIds.includes(sharkId)) return;

      const nextSave: SharkMetaSaveData = {
        ...save,
        selectedSharkId: sharkId,
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);

      sim.shark.trialActive = false;
      sim.shark.sharkFormId = sharkId;
      sim.shark.morphFlashTimer = 0.85;
      sim.shark.stats = recomputeSharkStats(
        sim.shark.level,
        sim.shark.frenzyTimer > 0,
        sharkId,
        nextSave
      );
      sim.shark.hp = Math.min(sim.shark.stats.maxHp, sim.shark.hp);
      const form = getSharkFormById(sharkId);
      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 42,
        'float_evo_ready',
        `#${form.index + 1} ${langRef.current === 'zh' ? form.nameZh : form.nameEn}`,
        LINEAGE_META[form.lineage].badgeColor,
        1.25
      );
    },
    [recomputeSharkStats, spawnFloatText]
  );

  // Unlock a new shark form via Triple-Gate (Parent Upgrade + Level/Depth + Coins & Genes) & immediately Morph into it!
  const handleUnlockAndSelectSharkForm = useCallback(
    (sharkId: string) => {
      const sim = simRef.current;
      const save = metaSaveRef.current;
      const form = getSharkFormById(sharkId);
      const evalStatus = evaluateSharkUnlock(
        form,
        save,
        0,
        0,
        Math.max(save.bestInRunLevel, sim.shark.level),
        Math.max(save.bestDepthReached, Math.round(sim.shark.maxDepthReached))
      );
      if (!evalStatus.canUnlockNow) return;

      const nextUnlocked = save.unlockedSharkIds.includes(sharkId)
        ? save.unlockedSharkIds
        : [...save.unlockedSharkIds, sharkId];
      const nextSave: SharkMetaSaveData = {
        ...save,
        bankedCoins: save.bankedCoins - form.unlockCoins,
        bankedGenes: save.bankedGenes - form.unlockGenes,
        selectedSharkId: sharkId,
        unlockedSharkIds: nextUnlocked,
        sharkUpgradeLevels: {
          ...save.sharkUpgradeLevels,
          [sharkId]: Math.max(1, save.sharkUpgradeLevels[sharkId] ?? 1),
        },
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);

      sim.shark.trialActive = false;
      sim.shark.coins = nextSave.bankedCoins;
      sim.shark.genes = nextSave.bankedGenes;
      sim.shark.sharkFormId = sharkId;
      sim.shark.morphFlashTimer = 1.0;
      sim.shark.frenzyTimer = Math.max(sim.shark.frenzyTimer, 3.2);
      sim.shark.invulnerableTimer = Math.max(sim.shark.invulnerableTimer, 1.5);
      sim.shark.cameraShakeTrauma = Math.max(sim.shark.cameraShakeTrauma, 0.55);
      sim.shark.stats = recomputeSharkStats(
        sim.shark.level,
        true,
        sharkId,
        nextSave
      );
      sim.shark.hp = sim.shark.stats.maxHp;
      sim.shark.ghostHp = sim.shark.stats.maxHp;
      sim.shark.energy = sim.shark.stats.maxEnergy;

      // Emit celebratory evolution burst particles
      const lineageAccent = LINEAGE_META[form.lineage].badgeColor;
      for (let i = 0; i < 24; i++) {
        const ang = (i * Math.PI * 2) / 24;
        const spd = 110 + Math.random() * 140;
        spawnParticle(
          sim.shark.x,
          sim.shark.y,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          5 + Math.random() * 5,
          0.75,
          i % 2 === 0 ? lineageAccent : '#fde047',
          i % 3 === 0 ? 'DNA' : 'SPARK'
        );
      }

      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 48,
        'float_evo_ready',
        `⚡ ${langRef.current === 'zh' ? form.nameZh : form.nameEn}!`,
        '#fde047',
        1.38
      );

      // Immediately sync HUD state on Morph Breakthrough
      const newUpg = nextSave.sharkUpgradeLevels[sharkId] ?? 1;
      const newUpgCost = getSharkUpgradeCost(form, newUpg);
      const nextEvoAfter = getNextEvolutionTarget(sharkId, nextSave);
      const nextEvalAfter = nextEvoAfter
        ? evaluateSharkUnlock(
            nextEvoAfter,
            nextSave,
            0,
            0,
            Math.max(nextSave.bestInRunLevel, sim.shark.level),
            Math.max(nextSave.bestDepthReached, Math.round(sim.shark.maxDepthReached))
          )
        : null;
      setHudState((prev) => ({
        ...prev,
        coins: nextSave.bankedCoins,
        genes: nextSave.bankedGenes,
        hp: sim.shark.stats.maxHp,
        maxHp: sim.shark.stats.maxHp,
        energy: sim.shark.stats.maxEnergy,
        maxEnergy: sim.shark.stats.maxEnergy,
        biteTier: sim.shark.stats.biteTier,
        activeSharkId: sharkId,
        activeUpgradeLevel: newUpg,
        unlockedFormsCount: nextSave.unlockedSharkIds.length,
        nextEvoTargetId: nextEvoAfter?.id ?? null,
        canBreakthroughNow: Boolean(nextEvalAfter?.canUnlockNow),
        canUpgradeBodyNow: newUpg < 10 && nextSave.bankedCoins >= newUpgCost,
        bodyUpgradeCost: newUpgCost,
      }));
    },
    [recomputeSharkStats, spawnFloatText, spawnParticle]
  );

  // In-Run 1-Click Breakthrough Morph button (if next form is ready, evolve on the spot; otherwise open Atlas)
  const handleInRunBreakthroughOrAtlas = useCallback(() => {
    const sim = simRef.current;
    const save = metaSaveRef.current;
    const nextEvo = getNextEvolutionTarget(sim.shark.sharkFormId, save);
    if (nextEvo) {
      const evalStatus = evaluateSharkUnlock(
        nextEvo,
        save,
        0,
        0,
        Math.max(save.bestInRunLevel, sim.shark.level),
        Math.max(save.bestDepthReached, Math.round(sim.shark.maxDepthReached))
      );
      if (evalStatus.canUnlockNow) {
        handleUnlockAndSelectSharkForm(nextEvo.id);
        return;
      }
    }
    setShowAtlasModal(true);
  }, [handleUnlockAndSelectSharkForm]);

  // Ad Placement 2: Watch Ad on Death for Full HP + 8s Gold Frenzy Magnet Revive
  const handleReviveWithFrenzyAd = useCallback(() => {
    adManager.showRewardedVideoAd('REVIVE_FRENZY', () => {
      const sim = simRef.current;
      infiniteProgressionManager.addFrenzyStack();
      sim.shark.stats = recomputeSharkStats(sim.shark.level, true);
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
  }, [recomputeSharkStats, spawnFloatText]);

  // Ad Placement 3: Title Screen Trial Tier VI Cosmic Mecha Leviathan Shark
  const handleTrialMaxMechaAd = useCallback(() => {
    adManager.showRewardedVideoAd('TRIAL_MAX_MECHA', () => {
      startNewRun(true);
    });
  }, [startNewRun]);

  // Ad Placement 4: Top HUD Gene & Coin Supply Drop (Accelerates Shark Evolution!)
  const handleGeneSupplyDropAd = useCallback(() => {
    adManager.showRewardedVideoAd('GENE_SUPPLY_DROP', () => {
      const sim = simRef.current;
      soundFX.playEvolution();
      for (let i = 0; i < 14; i++) {
        const ang = (i * Math.PI * 2) / 14;
        const spd = 90 + Math.random() * 90;
        spawnPickup(
          sim.shark.x + Math.cos(ang) * 40,
          sim.shark.y + Math.sin(ang) * 40,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          i % 2 === 0 ? 'DNA_CRYSTAL' : 'COIN',
          6
        );
      }
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 45,
        'float_supply_drop',
        '+60 🧬 · +80 🪙',
        '#4ade80',
        1.3
      );
      const nextSave: SharkMetaSaveData = {
        ...metaSaveRef.current,
        bankedGenes: metaSaveRef.current.bankedGenes + 60,
        bankedCoins: metaSaveRef.current.bankedCoins + 80,
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);
      sim.shark.genes = nextSave.bankedGenes;
      sim.shark.coins = nextSave.bankedCoins;
    });
  }, [spawnFloatText, spawnPickup]);

  // P2-2 In-Run Economy Action 1: Spend Dynamic Gold Coins for Instant Overdrive (+45 HP, Full Boost Energy, 4.5s+ Gold Frenzy)
  const handleGoldOverdrive = useCallback(() => {
    const sim = simRef.current;
    const shark = sim.shark;
    const save = metaSaveRef.current;
    const cost = getGoldOverdriveCost(economyUsesRef.current.goldOverdriveCount);
    if (save.bankedCoins < cost) return;

    const nextSave: SharkMetaSaveData = {
      ...save,
      bankedCoins: save.bankedCoins - cost,
    };
    metaSaveRef.current = nextSave;
    saveSharkMetaSave(nextSave);
    setMetaSave(nextSave);

    shark.coins = nextSave.bankedCoins;
    economyUsesRef.current.goldOverdriveCount += 1;
    shark.stats = recomputeSharkStats(shark.level, true, shark.sharkFormId, nextSave);
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
  }, [recomputeSharkStats, spawnFloatText]);

  // P2-2 In-Run Economy Action 2: Spend Dynamic Gene Shards for Mutation Surge (+55% Evolution XP & instant Level-Up check)
  const handleGeneSurge = useCallback(() => {
    const sim = simRef.current;
    const shark = sim.shark;
    const save = metaSaveRef.current;
    const cost = getGeneSurgeCost(
      shark.level,
      economyUsesRef.current.geneSurgeCount
    );
    if (save.bankedGenes < cost) return;

    const nextSave: SharkMetaSaveData = {
      ...save,
      bankedGenes: save.bankedGenes - cost,
    };
    metaSaveRef.current = nextSave;
    saveSharkMetaSave(nextSave);
    setMetaSave(nextSave);

    shark.genes = nextSave.bankedGenes;
    economyUsesRef.current.geneSurgeCount += 1;
    const xpReq = getXpRequiredForLevel(shark.level);
    const bonusXp = Math.ceil(xpReq * 0.55);
    shark.xp += bonusXp;
    shark.hp = Math.min(shark.stats.maxHp, shark.hp + 25);
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
      shark.stats = recomputeSharkStats(
        shark.level,
        shark.frenzyTimer > 0,
        shark.sharkFormId,
        nextSave
      );
      shark.hp = Math.min(
        shark.stats.maxHp,
        shark.hp + Math.round(shark.stats.maxHp * 0.35)
      );
      shark.morphFlashTimer = Math.max(shark.morphFlashTimer, 0.45);
      spawnFloatText(
        shark.x,
        shark.y - 52,
        'float_evo_ready',
        `LV.${shark.level}!`,
        '#38bdf8',
        1.25
      );
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
    }));
  }, [recomputeSharkStats, spawnFloatText]);

  // Keyboard Listeners (WASD / Arrows / Space / E / P / M / Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If simulated ad is open, ignore game keys
      if (simAdRef.current?.active) return;

      if (e.code === 'Escape' && showAtlasModalRef.current) {
        e.preventDefault();
        setShowAtlasModal(false);
        return;
      }

      if (gameStateRef.current === 'title') {
        if ((e.code === 'Enter' || e.code === 'Space') && !showAtlasModalRef.current) {
          e.preventDefault();
          startNewRun(false);
        } else if (e.code === 'KeyE') {
          e.preventDefault();
          setShowAtlasModal((prev) => !prev);
        }
        return;
      }

      if (e.code === 'KeyE') {
        if (gameStateRef.current === 'playing') {
          e.preventDefault();
          if (showAtlasModalRef.current) {
            setShowAtlasModal(false);
          } else {
            handleInRunBreakthroughOrAtlas();
          }
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (showAtlasModalRef.current) return;
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
      simRef.current.input.joyPointerId = null;
      simRef.current.input.boostPointerHeld = false;
      simRef.current.input.boostPointerId = null;
      simRef.current.input.canvasPointerActive = false;
      simRef.current.input.canvasPointerId = null;
      simRef.current.input.rightMouseBoostHeld = false;
      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
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
  }, [handleInRunBreakthroughOrAtlas, startNewRun]);

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
        Boolean(showAtlasModalRef.current) ||
        Boolean(simAdRef.current?.active);

      // ==================== 1. UPDATE SIMULATION ====================
      if (gameStateRef.current === 'title') {
        // Title Screen Live World Camera Tour / Hero Patrol with Active Deployed Shark Form
        shark.sharkFormId = metaSaveRef.current.selectedSharkId;
        shark.swimPhase += dt * 7.5;
        shark.biteAnim = Math.max(0, shark.biteAnim - dt * 3);
        shark.morphFlashTimer = Math.max(0, shark.morphFlashTimer - dt * 1.4);
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
        if (shark.morphFlashTimer > 0) {
          shark.morphFlashTimer = Math.max(0, shark.morphFlashTimer - dt * 1.4);
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
            shark.stats = recomputeSharkStats(shark.level, false);
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
        infiniteWorldManager.update(dt, shark, sim.camera);
        sim.camera.zoom +=
          (shark.stats.cameraZoom - sim.camera.zoom) * Math.min(1, dt * 3.5);

        shark.maxDepthReached = Math.max(
          shark.maxDepthReached,
          Math.round(shark.y)
        );

        // Depth Zone Milestone Notifications
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
        const prevDiff = infiniteProgressionManager.globalDifficultyMultiplier;
        infiniteProgressionManager.update(simDt);
        if (infiniteProgressionManager.globalDifficultyMultiplier !== prevDiff) {
          shark.stats = recomputeSharkStats(
            shark.level,
            shark.frenzyTimer > 0
          );
        }

        // Switch bounty target to a native species of the current depth zone if shark leaves habitat
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
        const atlasBonus = getGlobalAtlasBonuses(metaSaveRef.current);

        // Update Prey AI, Jaw Suction Assist & Check Mouth Devour Collision
        for (let i = sim.preyList.length - 1; i >= 0; i--) {
          const prey = sim.preyList[i];
          prey.phase += simDt * 3.2;

          const distToShark = Math.hypot(shark.x - prey.x, shark.y - prey.y);
          const visualPreyScale = getPreyRelativeVisualScale(
            prey.config,
            shark.stats,
            prey.mutationVariant,
            shark.frenzyTimer > 0
          );
          const effectivePreyTier = getEffectivePreyTier(
            prey.config,
            prey.mutationVariant
          );
          const canEatNow =
            (shark.frenzyTimer > 0 || shark.stats.biteTier >= effectivePreyTier) &&
            (!prey.config.isHazard || Boolean(shark.stats.canEatMines));
          const renderedPreyRadius = prey.config.radius * visualPreyScale;
          // Generous jaw suction & bite floor on shrunk edible fish so eating tiny minnows stays effortless
          const eatHitRadius = Math.max(
            renderedPreyRadius,
            18 * shark.stats.scale
          );
          const suctionRadius = mouthRadius * 2.15 + eatHitRadius;
          const distToMouthPre = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          const inJawSuctionZone =
            canEatNow && !prey.config.isHazard && distToMouthPre < suctionRadius;

          // Distinct AI Behavior Policies per Prey Archetype
          switch (prey.config.behavior) {
            case 'DRIFT_SWARM': {
              prey.vy = Math.sin(prey.phase * 1.5) * 28;
              break;
            }
            case 'SCHOOL_FLEE': {
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

          // Golden Frenzy Magnet gently pulls nearby small T1~T2 fish
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

          // Check collision with Shark Mouth / Front-Body
          const distToMouth = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          const distToFrontBody = Math.hypot(frontBodyX - prey.x, frontBodyY - prey.y);
          const effectiveHitDist = canEatNow
            ? Math.min(distToMouth, distToFrontBody * 0.95)
            : distToMouth;
          const hitThreshold = canEatNow
            ? mouthRadius * 1.18 + eatHitRadius * 1.02
            : mouthRadius * 0.84 + renderedPreyRadius * 0.72;

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
              // Devour! Build Feeding Combo Chain + Restore Boost Energy on every kill
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

              const earnedGenes = Math.max(
                1,
                Math.round(
                  outcome.geneGain *
                    (variant === 'ABYSS_BEHEMOTH' ? 2.5 : 1.0) *
                    atlasBonus.rewardMultiplier
                )
              );
              const earnedCoins = Math.max(
                1,
                Math.round(
                  outcome.coinGain *
                    (variant === 'GOLDEN_MUTANT' ? 3.0 : 1.0) *
                    atlasBonus.rewardMultiplier
                )
              );

              shark.biteAnim = 1.0;
              shark.hp = Math.min(
                shark.stats.maxHp,
                shark.hp + Math.round(outcome.hpDelta * (prey.scaleMultiplier ?? 1.0))
              );
              shark.score += finalScoreGain;
              shark.genes += earnedGenes;
              shark.coins += earnedCoins;
              shark.preyEatenCount += 1;

              // Requires devouring 8 true Golden Mutants outside of Frenzy + passing cooldown
              if (
                variant === 'GOLDEN_MUTANT' &&
                shark.frenzyTimer <= 0 &&
                infiniteProgressionManager.registerGoldenMutantDevoured()
              ) {
                shark.stats = recomputeSharkStats(shark.level, true);
                shark.frenzyTimer = 3.6 + shark.stats.frenzyDurationBonus;
              }
              if (prey.config.tier >= 4) {
                shark.hitstopTimer = 0.045;
                shark.cameraShakeTrauma = 0.32;
              }

              soundFX.playBite(prey.config.tier);

              // Compliant Green Slime Bubbles & DNA Crystals Burst
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
                  Math.max(2, Math.round(prey.config.tier * 2 * atlasBonus.rewardMultiplier))
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
                  shark.genes += Math.round(14 * atlasBonus.rewardMultiplier);
                  shark.coins += Math.round(22 * atlasBonus.rewardMultiplier);
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

              // Seamless In-Run Level-Up (Never interrupts hunting with a modal!)
              const prog = addEvolutionProgress(
                shark.level,
                shark.xp,
                outcome.xpGain
              );
              shark.level = prog.level;
              shark.xp = prog.xp;
              if (prog.leveledUpCount > 0) {
                shark.stats = recomputeSharkStats(
                  shark.level,
                  shark.frenzyTimer > 0
                );
                shark.hp = Math.min(
                  shark.stats.maxHp,
                  shark.hp + Math.round(shark.stats.maxHp * 0.35)
                );
                shark.morphFlashTimer = Math.max(shark.morphFlashTimer, 0.45);
                soundFX.playEvolution();
                spawnFloatText(
                  shark.x,
                  shark.y - 44,
                  'float_evo_ready',
                  `LV.${shark.level} (+HP/体型!)`,
                  '#38bdf8',
                  1.24
                );
              }

              // Recycle devoured prey into EcosystemSpawner pool and respawn off-screen
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
          p.y += p.vy * dt - 18 * dt;
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

        // Check Defeat Condition (HP <= 0) -> Persist all earned Coins, Genes, and Records!
        if (shark.hp <= 0) {
          soundFX.playHit();
          const curSave = metaSaveRef.current;
          const settledSave: SharkMetaSaveData = {
            ...curSave,
            bankedCoins: shark.coins,
            bankedGenes: shark.genes,
            bestInRunLevel: Math.max(curSave.bestInRunLevel, shark.level),
            bestDepthReached: Math.max(
              curSave.bestDepthReached,
              Math.round(shark.maxDepthReached)
            ),
            totalRunsPlayed: curSave.totalRunsPlayed + 1,
          };
          metaSaveRef.current = settledSave;
          saveSharkMetaSave(settledSave);
          setMetaSave(settledSave);

          setRunSnapshot({
            score: Math.round(shark.score),
            maxDepth: Math.round(shark.maxDepthReached),
            preyEaten: shark.preyEatenCount,
            level: shark.level,
            coinsEarned: Math.max(
              0,
              shark.coins - economyUsesRef.current.runStartCoins
            ),
            genesEarned: Math.max(
              0,
              shark.genes - economyUsesRef.current.runStartGenes
            ),
            unlockedFormsCount: settledSave.unlockedSharkIds.length,
            activeSharkId: shark.sharkFormId,
          });
          document.body.dataset.state = 'gameover';
          setGameState('gameover');
        }

        // Throttled HUD Integer & Persistent Meta-Save Sync (every 120ms)
        if (now - sim.lastHudSyncTime > 120) {
          sim.lastHudSyncTime = now;
          const curSave = metaSaveRef.current;
          const nextBestLv = Math.max(curSave.bestInRunLevel, shark.level);
          const nextBestDepth = Math.max(
            curSave.bestDepthReached,
            Math.round(shark.maxDepthReached)
          );
          let activeSave = curSave;
          if (
            curSave.bankedCoins !== shark.coins ||
            curSave.bankedGenes !== shark.genes ||
            curSave.bestInRunLevel !== nextBestLv ||
            curSave.bestDepthReached !== nextBestDepth
          ) {
            activeSave = {
              ...curSave,
              bankedCoins: shark.coins,
              bankedGenes: shark.genes,
              bestInRunLevel: nextBestLv,
              bestDepthReached: nextBestDepth,
            };
            metaSaveRef.current = activeSave;
            saveSharkMetaSave(activeSave);
            setMetaSave(activeSave);
          }

          const activeForm = getSharkFormById(shark.sharkFormId);
          const activeUpg = shark.trialActive
            ? 10
            : activeSave.sharkUpgradeLevels[shark.sharkFormId] ?? 1;
          const nextEvo = getNextEvolutionTarget(shark.sharkFormId, activeSave);
          const nextEval = nextEvo
            ? evaluateSharkUnlock(
                nextEvo,
                activeSave,
                0,
                0,
                nextBestLv,
                nextBestDepth
              )
            : null;
          const upgCost = getSharkUpgradeCost(activeForm, activeUpg);
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
            comboCount: shark.comboCount,
            comboMultiplier: Number(
              (1 + Math.min(1.0, Math.max(0, shark.comboCount - 1) * 0.08)).toFixed(2)
            ),
            goldenMutantCharge: infiniteProgressionManager.goldenMutantCharge,
            goldenMutantRequired: infiniteProgressionManager.goldenMutantRequired,
            frenzyCooldown: Math.ceil(infiniteProgressionManager.frenzyCooldownTimer),
            activeSharkId: shark.sharkFormId,
            activeUpgradeLevel: activeUpg,
            unlockedFormsCount: activeSave.unlockedSharkIds.length,
            nextEvoTargetId: nextEvo?.id ?? null,
            canBreakthroughNow: Boolean(nextEval?.canUnlockNow),
            canUpgradeBodyNow:
              !shark.trialActive && activeUpg < 10 && activeSave.bankedCoins >= upgCost,
            bodyUpgradeCost: upgCost,
          });
        }
      }

      // ==================== 2. RENDER OCEAN WORLD ====================
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 3-Tier Seamless Parallax Background
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

      const halfSpanX = Math.ceil(viewW / Math.max(0.35, sim.camera.zoom)) + 480;
      const surfStart = Math.floor((sim.camera.x - halfSpanX) / 120) * 120;
      const surfEnd = Math.ceil((sim.camera.x + halfSpanX) / 120) * 120;

      // Vivid Sunlit Sea Surface & Animated Dual Wave Crests
      const skySurfGrad = ctx.createLinearGradient(0, -180, 0, 32);
      skySurfGrad.addColorStop(0, 'rgba(186, 230, 253, 0.36)');
      skySurfGrad.addColorStop(0.75, 'rgba(125, 211, 252, 0.22)');
      skySurfGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = skySurfGrad;
      ctx.fillRect(surfStart, -180, surfEnd - surfStart, 212);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let wx = surfStart; wx <= surfEnd; wx += 60) {
        const wy = 24 + Math.cos(wx * 0.012 - now * 0.0024) * 7;
        if (wx === surfStart) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let wx = surfStart; wx <= surfEnd; wx += 60) {
        const wy = 14 + Math.sin(wx * 0.015 + now * 0.0032) * 8;
        if (wx === surfStart) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();

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

      // Render 3D Spinning Gold Coins & Faceted DNA Crystals
      for (const pk of sim.pickups) {
        if (!pk.active) continue;
        ctx.save();
        const bobY = Math.sin(pk.phase) * 3.5;
        ctx.translate(pk.x, pk.y + bobY);

        if (pk.kind === 'COIN') {
          const spinScaleX = 0.35 + Math.abs(Math.cos(pk.phase * 0.85)) * 0.65;
          ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.scale(spinScaleX, 1);
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#b45309';
          ctx.fillRect(-2, -4.5, 4, 9);
        } else {
          const rot = Math.sin(pk.phase * 0.6) * 0.22;
          ctx.rotate(rot);

          ctx.fillStyle = 'rgba(52, 211, 153, 0.24)';
          ctx.beginPath();
          ctx.arc(0, 0, 17, 0, Math.PI * 2);
          ctx.fill();

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
            shark.stats.relativePreyScale,
            shark.stats.scale,
            Boolean(shark.stats.canEatMines)
          );
        }
      }

      // Render Player's Evolved Shark Form (from 48-shark evolution matrix)
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
        sharkFormId: shark.sharkFormId,
        morphFlashTimer: shark.morphFlashTimer,
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
  }, [createPreyEntity, recomputeSharkStats, spawnFloatText, spawnParticle, spawnPickup]);

  // Full-Canvas Direct Pointer Steering & Right-Click Boost Handlers (P0-4)
  // Strictly tracks its own pointerId so multi-touch fingers on HUD buttons or Joystick never collide
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing') return;
    if (simRef.current.input.joyActive) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }
    simRef.current.input.canvasPointerActive = true;
    simRef.current.input.canvasPointerId = e.pointerId;
    simRef.current.input.canvasPointerX = e.clientX;
    simRef.current.input.canvasPointerY = e.clientY;
    if (e.button === 2) {
      simRef.current.input.rightMouseBoostHeld = true;
      setBoostVisual(true);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      simRef.current.input.canvasPointerActive &&
      simRef.current.input.canvasPointerId !== null &&
      e.pointerId !== simRef.current.input.canvasPointerId
    ) {
      return;
    }
    simRef.current.input.canvasPointerX = e.clientX;
    simRef.current.input.canvasPointerY = e.clientY;
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      simRef.current.input.canvasPointerId !== null &&
      e.pointerId !== simRef.current.input.canvasPointerId
    ) {
      return;
    }
    if (e.button === 2) {
      simRef.current.input.rightMouseBoostHeld = false;
    }
    simRef.current.input.canvasPointerActive = false;
    simRef.current.input.canvasPointerId = null;
    simRef.current.input.rightMouseBoostHeld = false;
    setBoostVisual(
      simRef.current.input.boostPointerHeld ||
        simRef.current.input.rightMouseBoostHeld ||
        simRef.current.input.keys.has('Space')
    );
  };

  // Virtual Joystick Pointer Handlers (Bottom-Left)
  // Uses direct DOM transform on joystickKnobRef during pointermove so holding the joystick
  // causes ZERO React re-renders and never blocks simultaneous right-thumb button taps on mobile!
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }
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
    simRef.current.input.joyPointerId = e.pointerId;
    simRef.current.input.joyOriginX = centerX;
    simRef.current.input.joyOriginY = centerY;
    simRef.current.input.joyDx = nx;
    simRef.current.input.joyDy = ny;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate3d(${(nx * maxR).toFixed(1)}px, ${(ny * maxR).toFixed(1)}px, 0)`;
    }
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      !simRef.current.input.joyActive ||
      (simRef.current.input.joyPointerId !== null &&
        e.pointerId !== simRef.current.input.joyPointerId)
    ) {
      return;
    }
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
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate3d(${(nx * maxR).toFixed(1)}px, ${(ny * maxR).toFixed(1)}px, 0)`;
    }
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      simRef.current.input.joyPointerId !== null &&
      e.pointerId !== simRef.current.input.joyPointerId
    ) {
      return;
    }
    simRef.current.input.joyActive = false;
    simRef.current.input.joyPointerId = null;
    simRef.current.input.joyDx = 0;
    simRef.current.input.joyDy = 0;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
  };

  /**
   * Mobile Multi-Touch Button Helper:
   * On mobile browsers (iOS Safari / Android Chrome / WebViews), holding Finger #1 on the Virtual Joystick or Canvas
   * suppresses synthetic `click` (`onClick`) events for Finger #2 tapping HUD buttons.
   * This helper fires the action immediately on `onPointerDown` / `onTouchStart` while guarding against duplicate `onClick` firing.
   */
  const bindMultiTouchButton = (
    action: () => void,
    isDisabled: boolean = false
  ) => {
    const triggerOnce = (
      e:
        | React.PointerEvent<HTMLButtonElement>
        | React.TouchEvent<HTMLButtonElement>
        | React.MouseEvent<HTMLButtonElement>
    ) => {
      if (isDisabled) return;
      e.stopPropagation();
      const now = performance.now();
      if (now - lastTouchActionTimeRef.current < 320) return;
      lastTouchActionTimeRef.current = now;
      action();
    };
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        triggerOnce(e);
      },
      onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => {
        triggerOnce(e);
      },
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        triggerOnce(e);
      },
    };
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const toggleMute = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const muted = soundFX.toggleMute();
    setIsMuted(muted);
  };

  const titleSharkForm = getSharkFormById(metaSave.selectedSharkId);
  const titleSharkUpg = metaSave.sharkUpgradeLevels[titleSharkForm.id] ?? 1;
  const unlockedTotalCount = metaSave.unlockedSharkIds.length;
  const activeHudSharkForm = getSharkFormById(hudState.activeSharkId);
  const activeLineageMeta = LINEAGE_META[activeHudSharkForm.lineage];
  const nextEvoTargetForm = hudState.nextEvoTargetId
    ? getSharkFormById(hudState.nextEvoTargetId)
    : null;
  const titleGenInfo =
    GENERATION_NAMES[titleSharkForm.generation - 1] ?? GENERATION_NAMES[0];

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

            {/* Centerpiece Emblem + Deployed Shark Card + Primary CTAs */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -14 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="landscape-title-wrap max-w-2xl mx-auto flex flex-col items-center text-center pointer-events-auto -mt-2 md:-mt-6"
            >
              {/* Active Shark Form & Persistent Bank Status Strip */}
              <div
                onClick={() => setShowAtlasModal(true)}
                className="mb-2 sm:mb-3 px-3 py-1.5 rounded-2xl bg-slate-900/92 border border-sky-400/40 hover:border-sky-300 flex items-center gap-2.5 sm:gap-3.5 shadow-lg cursor-pointer transition-all"
              >
                <SharkFormCanvasPreview
                  sharkId={titleSharkForm.id}
                  width={54}
                  height={36}
                  animate={true}
                />
                <div className="text-left">
                  <div className="text-[10px] font-mono-num text-sky-300 font-bold">
                    {lang === 'zh' ? titleGenInfo.nameZh : titleGenInfo.nameEn}{' '}
                    · Lv.{titleSharkUpg}/10
                  </div>
                  <div className="font-display font-extrabold text-xs sm:text-sm text-white">
                    #{String(titleSharkForm.index + 1).padStart(2, '0')}{' '}
                    {lang === 'zh' ? titleSharkForm.nameZh : titleSharkForm.nameEn}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div className="flex items-center gap-2.5 text-xs font-mono-num font-bold">
                  <span className="text-amber-300">🪙 {metaSave.bankedCoins}</span>
                  <span className="text-emerald-300">🧬 {metaSave.bankedGenes}</span>
                </div>
              </div>

              <h1
                className="font-display font-extrabold text-white tracking-tight hud-stroke mb-1 sm:mb-1.5"
                style={{
                  fontSize: 'clamp(1.65rem, 3.6vw, 3.2rem)',
                  textWrap: 'balance',
                }}
              >
                {t('game_title')}
              </h1>

              <p className="text-sky-200/90 text-xs sm:text-sm md:text-base font-medium mb-3 sm:mb-4 max-w-md">
                {lang === 'zh'
                  ? '48阶鲨鱼本体进化 · 跨局基因与金币养成 · 无缝深海吞噬'
                  : '48-Form Shark Body Evolution · Persistent Coins & Genes · Seamless Hunting'}
              </p>

              {/* Primary Actions (3 buttons, horizontal on mobile landscape) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 w-full">
                <button
                  type="button"
                  data-start="true"
                  data-testid="start-game-btn"
                  onClick={() => startNewRun(false)}
                  className="game-btn-spring w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-xl font-display font-extrabold text-sm sm:text-base md:text-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  ▶ {t('btn_start')}
                </button>

                <button
                  type="button"
                  data-testid="open-atlas-btn"
                  onClick={() => setShowAtlasModal(true)}
                  className="game-btn-spring w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl font-display font-extrabold text-xs sm:text-sm md:text-base text-sky-950 bg-sky-400 hover:bg-sky-300 border border-white/60 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  🧬 {lang === 'zh' ? '鲨鱼进化图谱' : 'Evolution Atlas'} (
                  {unlockedTotalCount}/48)
                </button>

                <button
                  type="button"
                  onClick={handleTrialMaxMechaAd}
                  className="game-btn-spring w-full sm:w-auto px-4 py-2.5 sm:py-3 rounded-xl font-display font-bold text-xs sm:text-sm text-amber-950 bg-amber-400 hover:bg-amber-300 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  🎬 {lang === 'zh' ? '试驾 #46 机甲利维坦' : 'Trial #46 Mecha Leviathan'}
                </button>
              </div>

              <button
                type="button"
                onClick={downloadStandaloneSingleFileHtml}
                className="mt-2 sm:mt-2.5 px-4 py-1 text-[11px] sm:text-xs font-medium text-sky-300/85 hover:text-white underline underline-offset-4 cursor-pointer whitespace-nowrap transition-colors"
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
            {/* ==================== TOP PERIMETER RIBBON ==================== */}
            <div className="flex items-start justify-between gap-1.5 sm:gap-2.5 w-full">
              {/* 1. Top-Left Cluster: Compact Biometric & Active Shark Form Pod */}
              <motion.div
                initial={{ opacity: 0, x: -28, y: -10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: -28, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="landscape-hud-biometric game-hud-card flex flex-col gap-1 border border-sky-400/35 rounded-xl p-2 md:p-2.5 w-[206px] sm:w-[238px] md:w-[274px] pointer-events-auto shrink-0"
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

                {/* Row 2: Side-by-Side Boost Energy & In-Run Level/XP */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
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

                {/* Row 3: Active Shark Form Badge & Quick Atlas Entry */}
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/90">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <SharkFormCanvasPreview
                      sharkId={activeHudSharkForm.id}
                      width={38}
                      height={26}
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-display font-extrabold text-white truncate leading-tight">
                        #{String(activeHudSharkForm.index + 1).padStart(2, '0')}{' '}
                        {lang === 'zh'
                          ? activeHudSharkForm.nameZh
                          : activeHudSharkForm.nameEn}
                      </div>
                      <div
                        className="text-[8px] sm:text-[9px] font-mono-num font-bold truncate leading-tight"
                        style={{ color: activeLineageMeta.badgeColor }}
                      >
                        {lang === 'zh' ? activeLineageMeta.nameZh : activeLineageMeta.nameEn}{' '}
                        · Lv.{hudState.activeUpgradeLevel}/10
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    {...bindMultiTouchButton(() => setShowAtlasModal(true))}
                    className="px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-[9px] font-display font-bold text-sky-200 shrink-0 cursor-pointer touch-manipulation"
                  >
                    🧬 {hudState.unlockedFormsCount}/48
                  </button>
                </div>
              </motion.div>

              {/* 2. Top-Center Cluster: Single-Line Telemetry & Bounty Ribbon */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.02 }}
                className="flex flex-col items-center gap-1 pointer-events-auto min-w-0 flex-1"
              >
                <div className="game-hud-card border border-sky-500/25 rounded-xl px-2.5 py-1 sm:px-3.5 sm:py-1.5 flex items-center justify-center gap-1.5 sm:gap-2.5">
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

                  {/* Target Bounty */}
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

                {/* Compact Sub-Ribbon Status Pills */}
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

              {/* 3. Top-Right Cluster: Unified Compact System Utility Bar */}
              <motion.div
                initial={{ opacity: 0, x: 28, y: -10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 28, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28, delay: 0.04 }}
                className="flex items-center gap-1.5 pointer-events-auto shrink-0"
              >
                <button
                  type="button"
                  {...bindMultiTouchButton(toggleLanguage)}
                  aria-label={t('btn_lang_toggle')}
                  className="game-btn-spring h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-display font-bold text-[11px] sm:text-xs tracking-wide text-sky-100 bg-slate-950/90 border border-sky-400/40 hover:border-sky-300 whitespace-nowrap cursor-pointer touch-manipulation"
                >
                  🌐 <span className="hidden md:inline">{t('btn_lang_toggle')} </span>(
                  {lang.toUpperCase()})
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  {...bindMultiTouchButton(() => {
                    const muted = soundFX.toggleMute();
                    setIsMuted(muted);
                  })}
                  aria-label={isMuted ? t('btn_unmute') : t('btn_mute')}
                  className="game-btn-spring h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-display font-semibold text-[11px] sm:text-xs text-slate-200 bg-slate-950/90 border border-slate-700 hover:border-slate-500 whitespace-nowrap cursor-pointer touch-manipulation"
                >
                  {isMuted ? '🔇' : '🔊'}
                  <span className="hidden lg:inline ml-1">
                    {isMuted ? t('btn_unmute') : t('btn_mute')}
                  </span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  {...bindMultiTouchButton(() => setGameState('paused'))}
                  aria-label={t('btn_pause')}
                  className="game-btn-spring h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-display font-semibold text-[11px] sm:text-xs text-slate-200 bg-slate-950/90 border border-slate-700 hover:border-slate-500 whitespace-nowrap cursor-pointer touch-manipulation"
                >
                  ⏸<span className="hidden lg:inline ml-1">{t('btn_pause')} [P]</span>
                </button>
              </motion.div>
            </div>

            {/* ==================== BOTTOM PERIMETER ROW: LEFT THUMB JOYSTICK + RIGHT THUMB TACTICAL ARC ==================== */}
            <div className="flex items-end justify-between w-full pb-1 sm:pb-2 px-1 sm:px-2">
              {/* Bottom-Left: Ergonomic Virtual Steering Joystick */}
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
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-sky-400/20 pointer-events-none" />
                <div className="absolute top-1.5 w-1 h-2 rounded-full bg-sky-400/35 pointer-events-none" />
                <div className="absolute bottom-1.5 w-1 h-2 rounded-full bg-sky-400/35 pointer-events-none" />
                <div className="absolute left-1.5 w-2 h-1 rounded-full bg-sky-400/35 pointer-events-none" />
                <div className="absolute right-1.5 w-2 h-1 rounded-full bg-sky-400/35 pointer-events-none" />
                <div
                  ref={joystickKnobRef}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-sky-400/95 border-2 border-white shadow-md pointer-events-none"
                  style={{
                    transform: 'translate3d(0px, 0px, 0)',
                  }}
                />
              </motion.div>

              {/* Bottom-Right: Ergonomic Right-Thumb Tactical Cluster */}
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                className="flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-auto"
              >
                {/* Upper Right-Thumb Row: In-Run Instant Morph Breakthrough / Quick Body Upgrade / Atlas Button */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {hudState.canBreakthroughNow && nextEvoTargetForm && (
                    <button
                      type="button"
                      data-testid="inrun-breakthrough-btn"
                      {...bindMultiTouchButton(handleInRunBreakthroughOrAtlas)}
                      className="game-btn-spring px-3 py-1.5 rounded-xl font-display font-extrabold text-xs bg-emerald-400 text-slate-950 border-2 border-white hover:bg-emerald-300 shadow-lg cursor-pointer whitespace-nowrap touch-manipulation"
                    >
                      ⚡{' '}
                      {lang === 'zh'
                        ? `破茧进化：#${nextEvoTargetForm.index + 1} ${nextEvoTargetForm.nameZh}`
                        : `Morph: #${nextEvoTargetForm.index + 1} ${nextEvoTargetForm.nameEn}`}
                    </button>
                  )}

                  {hudState.canUpgradeBodyNow && (
                    <button
                      type="button"
                      data-testid="inrun-upgrade-body-btn"
                      {...bindMultiTouchButton(() =>
                        handleUpgradeSharkForm(hudState.activeSharkId)
                      )}
                      className="game-btn-spring px-2.5 py-1.5 rounded-xl font-display font-bold text-[11px] sm:text-xs bg-amber-400/95 text-slate-950 border border-white hover:bg-amber-300 shadow-md cursor-pointer whitespace-nowrap touch-manipulation"
                    >
                      ⬆️{' '}
                      {lang === 'zh'
                        ? `躯体 Lv.${hudState.activeUpgradeLevel + 1} (🪙${hudState.bodyUpgradeCost})`
                        : `Body Lv.${hudState.activeUpgradeLevel + 1} (🪙${hudState.bodyUpgradeCost})`}
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="hud-open-atlas-btn"
                    {...bindMultiTouchButton(() => setShowAtlasModal(true))}
                    className="game-btn-spring px-2.5 py-1.5 rounded-xl font-display font-bold text-[11px] sm:text-xs bg-slate-950/90 text-sky-200 border border-sky-400/50 hover:border-sky-300 whitespace-nowrap cursor-pointer transition-all touch-manipulation"
                  >
                    🧬{' '}
                    {lang === 'zh'
                      ? `进化图谱 (${hudState.unlockedFormsCount}/48)`
                      : `Atlas (${hudState.unlockedFormsCount}/48)`}
                  </button>
                </div>

                {/* Lower Right-Thumb Row: 3 Tactical Abilities Docked Beside Primary Boost Button */}
                <div className="flex items-end gap-2 sm:gap-2.5">
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                    <button
                      type="button"
                      {...bindMultiTouchButton(handleGeneSupplyDropAd)}
                      title={t('btn_supply_drop')}
                      className="game-btn-spring px-2.5 py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-200 shadow-md cursor-pointer whitespace-nowrap touch-manipulation"
                    >
                      <span className="hidden lg:inline">{t('btn_supply_drop')}</span>
                      <span className="lg:hidden">{t('btn_supply_short')}</span>
                    </button>

                    <button
                      type="button"
                      disabled={hudState.coins < hudState.goldOverdriveCost}
                      {...bindMultiTouchButton(
                        handleGoldOverdrive,
                        hudState.coins < hudState.goldOverdriveCost
                      )}
                      title={t('btn_gold_overdrive', { cost: hudState.goldOverdriveCost })}
                      className={`game-btn-spring px-2.5 py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs border whitespace-nowrap transition-all touch-manipulation ${
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
                      {...bindMultiTouchButton(
                        handleGeneSurge,
                        hudState.genes < hudState.geneSurgeCost
                      )}
                      title={t('btn_gene_surge', { cost: hudState.geneSurgeCost })}
                      className={`game-btn-spring px-2.5 py-2 rounded-xl font-display font-bold text-[11px] sm:text-xs border whitespace-nowrap transition-all touch-manipulation ${
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
                      e.stopPropagation();
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        // Ignore capture errors on synthetic events
                      }
                      simRef.current.input.boostPointerHeld = true;
                      simRef.current.input.boostPointerId = e.pointerId;
                      setBoostVisual(true);
                    }}
                    onPointerUp={(e) => {
                      if (
                        simRef.current.input.boostPointerId !== null &&
                        e.pointerId !== simRef.current.input.boostPointerId
                      ) {
                        return;
                      }
                      simRef.current.input.boostPointerHeld = false;
                      simRef.current.input.boostPointerId = null;
                      setBoostVisual(simRef.current.input.keys.has('Space'));
                    }}
                    onPointerCancel={(e) => {
                      if (
                        simRef.current.input.boostPointerId !== null &&
                        e.pointerId !== simRef.current.input.boostPointerId
                      ) {
                        return;
                      }
                      simRef.current.input.boostPointerHeld = false;
                      simRef.current.input.boostPointerId = null;
                      setBoostVisual(false);
                    }}
                    className={`landscape-thumb-boost relative w-22 h-22 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full font-display font-extrabold text-xs sm:text-sm md:text-base flex flex-col items-center justify-center shadow-xl cursor-pointer transition-transform shrink-0 touch-none ${
                      boostVisual
                        ? 'bg-sky-400 text-slate-950 scale-95'
                        : 'bg-slate-950/90 text-sky-100 hover:bg-slate-900'
                    }`}
                  >
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

      {/* ==================== 3. 48-SHARK EVOLUTION ATLAS & UPGRADE LAB MODAL ==================== */}
      {showAtlasModal && (
        <SharkEvolutionAtlasModal
          lang={lang}
          metaSave={metaSave}
          liveRunCoins={0}
          liveRunGenes={0}
          liveRunLevel={hudState.level}
          liveRunMaxDepth={Math.max(metaSave.bestDepthReached, hudState.depth)}
          onClose={() => setShowAtlasModal(false)}
          onSelectActiveShark={handleSelectActiveSharkForm}
          onUpgradeShark={handleUpgradeSharkForm}
          onUnlockShark={handleUnlockAndSelectSharkForm}
        />
      )}

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
                {lang === 'zh'
                  ? `已解锁鲨鱼形态：${hudState.unlockedFormsCount} / 48`
                  : `Unlocked Shark Forms: ${hudState.unlockedFormsCount} / 48`}
              </p>

              {/* Active Shark Form Summary Card */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-left">
                <div className="flex items-center gap-3">
                  <SharkFormCanvasPreview
                    sharkId={activeHudSharkForm.id}
                    width={64}
                    height={44}
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-display font-extrabold text-white">
                      #{String(activeHudSharkForm.index + 1).padStart(2, '0')}{' '}
                      {lang === 'zh'
                        ? activeHudSharkForm.nameZh
                        : activeHudSharkForm.nameEn}
                    </div>
                    <div className="text-[11px] text-sky-300 font-mono-num">
                      {lang === 'zh' ? '强化等级' : 'Body Level'} Lv.
                      {hudState.activeUpgradeLevel}/10 · {lang === 'zh' ? '咬合' : 'Bite'} T
                      {hudState.biteTier}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAtlasModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-display font-extrabold text-xs hover:bg-sky-400 cursor-pointer"
                >
                  🧬 {lang === 'zh' ? '进化图谱' : 'Atlas'}
                </button>
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
                    {lang === 'zh'
                      ? `本局金币与基因已永久存入账户（当前储备：🪙 ${metaSave.bankedCoins} · 🧬 ${metaSave.bankedGenes}）`
                      : `Run coins & genes permanently banked (Bank: 🪙 ${metaSave.bankedCoins} · 🧬 ${metaSave.bankedGenes})`}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3.5 sm:mb-4 text-left">
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
                        {lang === 'zh' ? '本局收获资源' : 'Run Harvest'}
                      </div>
                      <div className="font-display font-extrabold text-xs sm:text-sm text-amber-300 font-mono-num">
                        +{runSnapshot.coinsEarned}🪙 · +{runSnapshot.genesEarned}🧬
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <div className="text-[10px] text-slate-400 truncate">
                        {lang === 'zh' ? '进化图谱进度' : 'Atlas Progress'}
                      </div>
                      <div className="font-display font-extrabold text-base sm:text-lg text-purple-300 font-mono-num">
                        {runSnapshot.unlockedFormsCount} / 48
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAtlasModal(true)}
                    className="game-btn-spring w-full py-2.5 mb-2.5 rounded-xl font-display font-extrabold text-xs sm:text-sm text-sky-950 bg-sky-400 hover:bg-sky-300 shadow-lg cursor-pointer"
                  >
                    🧬{' '}
                    {lang === 'zh'
                      ? `打开鲨鱼进化图谱 / 强化躯体 (${metaSave.bankedCoins}🪙 · ${metaSave.bankedGenes}🧬)`
                      : `Open Shark Evolution Atlas (${metaSave.bankedCoins}🪙 · ${metaSave.bankedGenes}🧬)`}
                  </button>

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
                      🎬 {lang === 'zh' ? '试驾 #46 机甲利维坦' : 'Trial #46 Mecha Leviathan'}
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
