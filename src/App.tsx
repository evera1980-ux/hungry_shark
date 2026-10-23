/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { detectDefaultLang, Lang, translate } from './game/i18n';
import {
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
  getMaxMechaLoadout,
  getXpRequiredForLevel,
  pickEvolutionChoices,
  resolvePreyEncounter,
} from './game/rules';
import { soundFX } from './game/audio';
import { adManager, AdPlacement } from './game/adManager';
import {
  drawPreyEntity,
  drawSharkWithOrgans,
  PreyEntity,
} from './game/canvasRenderer';
import { OrganCanvasPreview } from './components/OrganCanvasPreview';
import { downloadStandaloneSingleFileHtml } from './game/singleFileExporter';
import { spriteSheetManager } from './game/spriteSheetManager';
import { parallaxBackground } from './game/parallaxBackground';

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
  });

  const [equippedOrgans, setEquippedOrgans] = useState<EquippedOrgansMap>({});
  const equippedRef = useRef<EquippedOrgansMap>({});

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
      cameraShakeTrauma: number;
      trialActive: boolean;
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
  }>({
    shark: {
      x: 1200,
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
      cameraShakeTrauma: 0,
      trialActive: false,
      stats: computeSharkStats(1, {}, false),
    },
    camera: {
      x: 1200,
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
  });

  // Sync document.body.dataset.state whenever gameState changes
  useEffect(() => {
    gameStateRef.current = gameState;
    if (typeof document !== 'undefined') {
      document.body.dataset.state = gameState;
    }
  }, [gameState]);

  // Register Browser Simulated Video Ad Runner & Load 4x4 Sprite Sheet + 3-Layer Parallax Background
  useEffect(() => {
    spriteSheetManager.load('/assets/aistudio/fish_24bdaa5a.png');
    parallaxBackground.load('/ocean_bg.png');
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

  // Spawn a single prey entity at appropriate depth
  const createPreyEntity = useCallback(
    (nearSharkX?: number): PreyEntity => {
      const sim = simRef.current;
      // Weight lower tiers slightly higher so there's always plentiful food
      const weights = [26, 24, 16, 11, 9, 7, 5, 2];
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * totalWeight;
      let chosenTier: PreyTierConfig = GAME_CONFIG.preyTiers[0];
      for (let i = 0; i < GAME_CONFIG.preyTiers.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          chosenTier = GAME_CONFIG.preyTiers[i];
          break;
        }
      }

      const y =
        chosenTier.minDepth +
        Math.random() * (chosenTier.maxDepth - chosenTier.minDepth);
      let x = Math.random() * (GAME_CONFIG.world.width - 200) + 100;
      if (typeof nearSharkX === 'number') {
        const dir = Math.random() < 0.5 ? -1 : 1;
        x = Math.max(
          100,
          Math.min(
            GAME_CONFIG.world.width - 100,
            nearSharkX + dir * (480 + Math.random() * 750)
          )
        );
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
      equippedRef.current = initialOrgans;
      setEquippedOrgans({ ...initialOrgans });

      const initialLevel = withMaxMechaTrial ? 3 : 1;
      const stats = computeSharkStats(initialLevel, initialOrgans, false);

      sim.shark = {
        x: 1200,
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
        cameraShakeTrauma: 0,
        trialActive: withMaxMechaTrial,
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
      setJoystickVisual({ active: false, dx: 0, dy: 0 });
      setBoostVisual(false);

      // Reset pools
      sim.particles.forEach((p) => (p.active = false));
      sim.pickups.forEach((pk) => (pk.active = false));
      sim.floatTexts.forEach((ft) => (ft.active = false));

      // Populate initial ocean ecosystem
      sim.preyList = [];
      for (let i = 0; i < TARGET_PREY_COUNT; i++) {
        sim.preyList.push(createPreyEntity());
      }
      // Guarantee several edible Tier 1 & Tier 2 fish right in front of the starting shark
      for (let i = 0; i < 6; i++) {
        const tierConfig = GAME_CONFIG.preyTiers[i % 2];
        sim.preyList.push({
          uid: sim.nextPreyUid++,
          config: tierConfig,
          x: 1380 + i * 70,
          y: 190 + (i % 3) * 35,
          vx: 45,
          vy: 0,
          angle: 0,
          phase: i,
          telegraphTimer: 0,
          isInflated: false,
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
      });

      if (withMaxMechaTrial) {
        soundFX.playEvolution();
        spawnFloatText(1200, 180, 'float_trial_start', '+5 MECHA', '#38bdf8', 1.25);
      }

      // Immediately update state and blur any focused button
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.dataset.state = 'playing';
      setGameState('playing');
    },
    [createPreyEntity, spawnFloatText]
  );

  // If booted with ?autostart=1, initialize the ocean run immediately on mount
  useEffect(() => {
    if (gameState === 'playing' && simRef.current.preyList.length === 0) {
      startNewRun(false);
    }
  }, [gameState, startNewRun]);

  // Mount a single selected organ from Evolution Modal
  const handleSelectSingleOrgan = useCallback(
    (organ: OrganConfig) => {
      const sim = simRef.current;
      const nextEquipped: EquippedOrgansMap = {
        ...equippedRef.current,
        [organ.slot]: organ,
      };
      equippedRef.current = nextEquipped;
      setEquippedOrgans(nextEquipped);

      sim.shark.stats = computeSharkStats(
        sim.shark.level,
        nextEquipped,
        sim.shark.frenzyTimer > 0
      );
      sim.shark.hp = Math.min(sim.shark.stats.maxHp, sim.shark.hp + 25);
      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 35,
        organ.nameKey,
        '+EVO',
        organ.primaryColor,
        1.2
      );
      setEvoChoices(null);
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
      for (const organ of choices) {
        nextEquipped[organ.slot] = organ;
      }
      equippedRef.current = nextEquipped;
      setEquippedOrgans(nextEquipped);

      sim.shark.stats = computeSharkStats(
        sim.shark.level,
        nextEquipped,
        sim.shark.frenzyTimer > 0
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
      setEvoChoices(null);
    });
  }, [spawnFloatText]);

  // Ad Placement 2: Watch Ad on Death for Full HP + 8s Gold Frenzy Magnet Revive
  const handleReviveWithFrenzyAd = useCallback(() => {
    adManager.showRewardedVideoAd('REVIVE_FRENZY', () => {
      const sim = simRef.current;
      sim.shark.frenzyTimer = GAME_CONFIG.world.frenzyDuration;
      sim.shark.stats = computeSharkStats(
        sim.shark.level,
        equippedRef.current,
        true
      );
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

  // Keyboard Listeners (WASD / Arrows / Space / P / M / Enter)
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
        const targetX = 1200 + Math.cos(tSec) * 280;
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
            sim.preyList.push(createPreyEntity(1200));
          }
        }
        for (const prey of sim.preyList) {
          prey.phase += dt * 3;
          prey.x += prey.vx * dt * 0.5;
          if (prey.x < 100 || prey.x > GAME_CONFIG.world.width - 100) {
            prey.vx *= -1;
          }
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
        if (shark.cameraShakeTrauma > 0) {
          shark.cameraShakeTrauma = Math.max(0, shark.cameraShakeTrauma - dt * 2.2);
        }
        if (shark.frenzyTimer > 0) {
          shark.frenzyTimer = Math.max(0, shark.frenzyTimer - dt);
          if (shark.frenzyTimer === 0) {
            shark.stats = computeSharkStats(
              shark.level,
              equippedRef.current,
              false
            );
          }
        }

        // Steering Vector from Virtual Joystick OR Keyboard WASD/Arrows
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
        }

        const inputMag = Math.hypot(inputX, inputY);
        if (inputMag > 0.08) {
          shark.targetAngle = Math.atan2(inputY, inputX);
          // Smooth angular interpolation
          let diff = shark.targetAngle - shark.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          shark.angle += diff * Math.min(1, simDt * 9.5);
        }

        // Boost Handling (2x Speed + Tail Flame Particles)
        const wantsBoost =
          sim.input.boostPointerHeld || sim.input.keys.has('Space');
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
          shark.energy = Math.min(
            shark.stats.maxEnergy,
            shark.energy + GAME_CONFIG.world.baseBoostRegenPerSec * simDt
          );
        }

        const targetSpeed = isBoosting
          ? shark.stats.boostSpeed
          : inputMag > 0.08
          ? shark.stats.moveSpeed * Math.min(1, Math.max(0.55, inputMag))
          : shark.stats.moveSpeed * 0.52;

        shark.vx += (Math.cos(shark.angle) * targetSpeed - shark.vx) * Math.min(1, simDt * 7);
        shark.vy += (Math.sin(shark.angle) * targetSpeed - shark.vy) * Math.min(1, simDt * 7);

        shark.x += shark.vx * simDt;
        shark.y += shark.vy * simDt;

        // Clamp within world bounds
        const margin = 70;
        if (shark.x < margin) {
          shark.x = margin;
          shark.vx = Math.abs(shark.vx);
          shark.angle = 0;
        } else if (shark.x > GAME_CONFIG.world.width - margin) {
          shark.x = GAME_CONFIG.world.width - margin;
          shark.vx = -Math.abs(shark.vx);
          shark.angle = Math.PI;
        }
        if (shark.y < 55) {
          shark.y = 55;
          shark.vy = Math.abs(shark.vy) * 0.5;
        } else if (shark.y > GAME_CONFIG.world.height - margin) {
          shark.y = GAME_CONFIG.world.height - margin;
          shark.vy = -Math.abs(shark.vy) * 0.5;
        }

        shark.maxDepthReached = Math.max(
          shark.maxDepthReached,
          Math.round(shark.y)
        );

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

        // Smooth camera tracking & dynamic zoom out as shark evolves
        sim.camera.x += (shark.x - sim.camera.x) * Math.min(1, dt * 6.5);
        sim.camera.y += (shark.y - sim.camera.y) * Math.min(1, dt * 6.5);
        sim.camera.zoom +=
          (shark.stats.cameraZoom - sim.camera.zoom) * Math.min(1, dt * 3.5);

        // Mouth hitbox world coordinates
        const mouthX = shark.x + Math.cos(shark.angle) * 32 * shark.stats.scale;
        const mouthY = shark.y + Math.sin(shark.angle) * 32 * shark.stats.scale;
        const mouthRadius = 28 * shark.stats.scale;

        // Update Prey AI & Check Mouth Devour Collision
        for (let i = sim.preyList.length - 1; i >= 0; i--) {
          const prey = sim.preyList[i];
          prey.phase += simDt * 3.2;

          const distToShark = Math.hypot(shark.x - prey.x, shark.y - prey.y);

          // Distinct AI Behavior Policies per Prey Archetype
          switch (prey.config.behavior) {
            case 'DRIFT_SWARM': {
              prey.vy = Math.sin(prey.phase * 1.5) * 28;
              break;
            }
            case 'SCHOOL_FLEE': {
              if (distToShark < 240 && shark.stats.biteTier >= prey.config.tier) {
                const fleeAngle = Math.atan2(prey.y - shark.y, prey.x - shark.x);
                prey.vx = Math.cos(fleeAngle) * prey.config.baseSpeed * 1.35;
                prey.vy = Math.sin(fleeAngle) * prey.config.baseSpeed * 1.35;
              }
              break;
            }
            case 'PUFFER_INFLATE': {
              prey.isInflated = distToShark < 190;
              if (prey.isInflated) {
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
              if (distToShark < 380) {
                const dirAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
                const mult = shark.stats.biteTier >= prey.config.tier ? -0.8 : 0.95;
                prey.vx = Math.cos(dirAngle) * prey.config.baseSpeed * mult;
                prey.vy = Math.sin(dirAngle) * prey.config.baseSpeed * mult;
              }
              break;
            }
          }

          // Golden Frenzy Magnet pulls edible prey toward the shark's jaws
          if (shark.frenzyTimer > 0 && distToShark < shark.stats.magnetRadius * 1.45) {
            const pullAngle = Math.atan2(mouthY - prey.y, mouthX - prey.x);
            prey.x += Math.cos(pullAngle) * 340 * simDt;
            prey.y += Math.sin(pullAngle) * 340 * simDt;
          }

          prey.x += prey.vx * simDt;
          prey.y += prey.vy * simDt;

          // Keep prey within their ecological depth band and world width
          if (prey.x < 80) {
            prey.x = 80;
            prey.vx = Math.abs(prey.vx);
          } else if (prey.x > GAME_CONFIG.world.width - 80) {
            prey.x = GAME_CONFIG.world.width - 80;
            prey.vx = -Math.abs(prey.vx);
          }
          if (prey.y < prey.config.minDepth) {
            prey.y = prey.config.minDepth;
            prey.vy = Math.abs(prey.vy);
          } else if (prey.y > prey.config.maxDepth) {
            prey.y = prey.config.maxDepth;
            prey.vy = -Math.abs(prey.vy);
          }

          // Check collision with Shark Mouth / Body
          const distToMouth = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          if (distToMouth < mouthRadius + prey.config.radius) {
            const outcome = resolvePreyEncounter(
              shark.stats,
              prey.config,
              shark.frenzyTimer > 0,
              isBoosting
            );

            if (outcome.canDevour) {
              // Devour! Trigger bite animation, green slime bubbles, coins & DNA crystals
              shark.biteAnim = 1.0;
              shark.hp = Math.min(shark.stats.maxHp, shark.hp + outcome.hpDelta);
              shark.score += outcome.scoreGain;
              shark.genes += outcome.geneGain;
              shark.coins += outcome.coinGain;
              shark.preyEatenCount += 1;
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

              spawnFloatText(
                prey.x,
                prey.y - 16,
                outcome.floatTextKey,
                `+${outcome.scoreGain}`,
                outcome.isCrit ? '#fde047' : '#4ade80',
                outcome.isCrit ? 1.22 : 1.0
              );

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
                  shark.frenzyTimer > 0
                );
                shark.hp = shark.stats.maxHp;
                soundFX.playEvolution();
                // Trigger Evolution 3-Choice Modal!
                setEvoChoices(pickEvolutionChoices(equippedRef.current));
              }

              // Respawn replacement prey elsewhere in the ocean
              sim.preyList[i] = createPreyEntity(shark.x);
            } else {
              // Oversized Prey or Active Mine Hazard -> Screen Shake, Knockback & Damage
              shark.hp = Math.max(0, shark.hp + outcome.hpDelta);
              shark.hitFlashTimer = 0.28;
              shark.hitstopTimer = 0.055;
              shark.cameraShakeTrauma = 0.65;

              const bounceAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
              shark.vx = Math.cos(bounceAngle) * outcome.knockbackForce;
              shark.vy = Math.sin(bounceAngle) * outcome.knockbackForce;
              shark.x += Math.cos(bounceAngle) * 18;
              shark.y += Math.sin(bounceAngle) * 18;

              soundFX.playHit();
              spawnFloatText(
                shark.x,
                shark.y - 25,
                outcome.floatTextKey,
                `${outcome.hpDelta} HP`,
                '#fb7185',
                1.18
              );

              if (prey.config.isHazard) {
                // Mine explodes into green/amber plasma sparks and respawns elsewhere
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
                sim.preyList[i] = createPreyEntity(shark.x);
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

      // Ocean Surface Waves at y = 35
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let wx = 0; wx <= GAME_CONFIG.world.width; wx += 60) {
        const wy = 35 + Math.sin(wx * 0.015 + now * 0.003) * 8;
        if (wx === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();

      // Zone Depth Boundary Lines (Subtle diegetic depth markers)
      for (const z of GAME_CONFIG.zones) {
        if (z.minDepth > 0) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.setLineDash([12, 12]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, z.minDepth);
          ctx.lineTo(GAME_CONFIG.world.width, z.minDepth);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Render Pickups & Devour FX Icon (Frame [3,3]: DEVOUR_FX)
      const devourFxFrame = spriteSheetManager.getFrame('DEVOUR_FX');
      for (const pk of sim.pickups) {
        if (!pk.active) continue;
        ctx.save();
        ctx.translate(pk.x, pk.y);
        const bobY = Math.sin(pk.phase) * 3;
        if (devourFxFrame) {
          const sz = pk.kind === 'COIN' ? 30 : 34;
          ctx.drawImage(devourFxFrame, -sz / 2, -sz / 2 + bobY, sz, sz);
        }
        ctx.restore();
      }

      // Render Prey Entities within camera frustum
      const cullMargin = 220 / sim.camera.zoom;
      const minX = sim.camera.x - viewW / (2 * sim.camera.zoom) - cullMargin;
      const maxX = sim.camera.x + viewW / (2 * sim.camera.zoom) + cullMargin;
      const minY = sim.camera.y - viewH / (2 * sim.camera.zoom) - cullMargin;
      const maxY = sim.camera.y + viewH / (2 * sim.camera.zoom) + cullMargin;

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
            shark.frenzyTimer > 0
          );
        }
      }

      // Render Player's Articulated Shark + Mounted Evolution Organs
      const isBoosting =
        sim.input.boostPointerHeld || sim.input.keys.has('Space');
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
        equipped: equippedRef.current,
      });

      // Render Compliant Green Slime Bubbles & Devour FX Sprite Particles
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

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [createPreyEntity, spawnFloatText, spawnParticle, spawnPickup]);

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
        className="block w-full h-full"
      />

      {/* Low HP Danger Vignette */}
      {gameState === 'playing' && hudState.hp < hudState.maxHp * 0.28 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 90px rgba(244, 63, 94, 0.55)',
          }}
        />
      )}

      {/* ==================== TOP-RIGHT UTILITY BAR (ON TITLE SCREEN) ==================== */}
      {gameState === 'title' && (
        <div className="fixed top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t('btn_lang_toggle')}
            className="px-3.5 py-2 rounded-lg font-display font-bold text-xs tracking-wide text-sky-100 bg-slate-900/90 border border-sky-400/40 hover:border-sky-300 hover:bg-slate-800 active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
          >
            🌐 {t('btn_lang_toggle')} ({lang.toUpperCase()})
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={toggleMute}
            aria-label={isMuted ? t('btn_unmute') : t('btn_mute')}
            className="px-3 py-2 rounded-lg font-display font-semibold text-xs text-slate-200 bg-slate-900/90 border border-slate-700 hover:border-slate-500 active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isMuted ? '🔇' : '🔊'} {isMuted ? t('btn_unmute') : t('btn_mute')}
          </button>
        </div>
      )}

      {/* ==================== 1. TITLE SCREEN OVERLAY ==================== */}
      {gameState === 'title' && (
        <section
          aria-label={t('game_title')}
          className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(2, 132, 199, 0.12) 0%, rgba(2, 6, 23, 0.78) 100%)',
          }}
        >
          <div className="h-4" />

          {/* Centerpiece SVG Emblem + Primary Start & Trial Max Mecha Ad CTA */}
          <div className="max-w-xl mx-auto flex flex-col items-center text-center pointer-events-auto -mt-12">
            {/* Bespoke Inline SVG Shark Fin & DNA Crest Emblem */}
            <svg
              viewBox="0 0 180 76"
              className="w-36 h-16 mb-2 overflow-visible"
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
              className="font-display font-extrabold text-white tracking-tight hud-stroke mb-2"
              style={{
                fontSize: 'clamp(2.1rem, 4.2vw, 3.4rem)',
                textWrap: 'balance',
              }}
            >
              {t('game_title')}
            </h1>

            <p className="text-sky-200/90 text-sm md:text-base font-medium mb-6 max-w-md">
              {t('game_subtitle')}
            </p>

            {/* Primary Actions (<= 3 menu actions total) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewRun(false)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-display font-extrabold text-base md:text-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 transition-transform shadow-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                ▶ {t('btn_start')}
              </button>

              <button
                type="button"
                onClick={handleTrialMaxMechaAd}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-display font-bold text-sm md:text-base text-amber-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-transform shadow-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                {t('btn_trial_mecha')}
              </button>
            </div>

            <button
              type="button"
              onClick={downloadStandaloneSingleFileHtml}
              className="mt-3.5 px-4 py-1 text-xs font-medium text-sky-300/85 hover:text-white underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              ⬇ {t('btn_export_html')}
            </button>
          </div>

          {/* Flat Single-Line Control Hint in Bottom Safe Margin */}
          <div className="text-center text-xs md:text-sm text-slate-300/90 font-medium tracking-wide">
            {t('control_hint')}
          </div>
        </section>
      )}

      {/* ==================== 2. PLAYING HUD (WORLD-MATCHED PERIMETER CLUSTERS) ==================== */}
      {gameState !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 md:p-5">
          {/* Top Perimeter Row: Left Vitality/Evolution Cluster + Center Score & Gene Supply Drop + Right Utility Buttons */}
          <div className="flex flex-col md:flex-row items-stretch md:items-start justify-between gap-2.5 w-full">
            {/* Top Row on Mobile: Vitality Card + Compact Utility Controls side-by-side */}
            <div className="flex items-start justify-between gap-2">
              {/* Top-Left Cluster: Vitality HP, Boost Energy, Evolution Level & 5 Organ Sockets */}
              <div className="flex flex-col gap-1.5 bg-slate-950/85 border border-sky-500/30 rounded-xl p-2.5 md:p-3 w-[225px] sm:w-[260px] md:w-[280px] pointer-events-auto shrink-0">
                {/* HP Bar with Delayed Damage Ghost Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] md:text-xs font-bold mb-1">
                    <span className="text-emerald-300 uppercase tracking-wider">
                      {t('hud_hp')}
                    </span>
                    <span className="font-mono-num text-white">
                      {hudState.hp}/{hudState.maxHp}
                    </span>
                  </div>
                  <div className="relative h-2.5 md:h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div
                      ref={hpGhostFillRef}
                      className="absolute inset-y-0 left-0 w-full bg-rose-500/70 origin-left transition-transform duration-75"
                      style={{ transform: 'scaleX(1)' }}
                    />
                    <div
                      ref={hpBarFillRef}
                      className="relative h-full w-full bg-emerald-400 origin-left"
                      style={{ transform: 'scaleX(1)' }}
                    />
                  </div>
                </div>

                {/* Boost Energy Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] md:text-xs font-bold mb-1">
                    <span className="text-sky-300 uppercase tracking-wider">
                      {t('hud_energy')}
                    </span>
                    <span className="font-mono-num text-sky-100">
                      {hudState.energy}%
                    </span>
                  </div>
                  <div className="relative h-2 md:h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div
                      ref={energyBarFillRef}
                      className="h-full w-full bg-sky-400 origin-left"
                      style={{ transform: 'scaleX(1)' }}
                    />
                  </div>
                </div>

                {/* Evolution Level & XP Progress */}
                <div>
                  <div className="flex items-center justify-between text-[11px] md:text-xs font-bold mb-1">
                    <span className="text-purple-300">
                      {t('hud_level')} Lv.{hudState.level} · {t('hud_bite_tier')} T
                      {hudState.biteTier}
                    </span>
                    <span className="font-mono-num text-purple-200">
                      {hudState.xp}/{hudState.xpToNext}
                    </span>
                  </div>
                  <div className="relative h-1.5 md:h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div
                      ref={xpBarFillRef}
                      className="h-full w-full bg-purple-400 origin-left"
                      style={{ transform: 'scaleX(0)' }}
                    />
                  </div>
                </div>

                {/* 5 Modular Organ Sockets Strip */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800">
                  {ALL_SLOTS.map((slot) => {
                    const mounted = equippedOrgans[slot];
                    return (
                      <div
                        key={slot}
                        title={
                          mounted
                            ? `${t(mounted.nameKey)}: ${t(mounted.descKey)}`
                            : t(`slot_${slot}`)
                        }
                        className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-mono-num font-bold border ${
                          mounted
                            ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                            : 'bg-slate-900/70 border-slate-800 text-slate-500'
                        }`}
                      >
                        {slot}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile-only right utility stack */}
              <div className="flex md:hidden flex-col items-end gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={toggleLanguage}
                  aria-label={t('btn_lang_toggle')}
                  className="px-2.5 py-1.5 rounded-lg font-display font-bold text-[11px] text-sky-100 bg-slate-900/90 border border-sky-400/40 whitespace-nowrap cursor-pointer"
                >
                  🌐 {lang.toUpperCase()}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={toggleMute}
                    aria-label={isMuted ? t('btn_unmute') : t('btn_mute')}
                    className="px-2.5 py-1.5 rounded-lg font-display font-semibold text-[11px] text-slate-200 bg-slate-900/90 border border-slate-700 whitespace-nowrap cursor-pointer"
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setGameState('paused');
                    }}
                    aria-label={t('btn_pause')}
                    className="px-2.5 py-1.5 rounded-lg font-display font-semibold text-[11px] text-slate-200 bg-slate-900/90 border border-slate-700 whitespace-nowrap cursor-pointer"
                  >
                    ⏸
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGeneSupplyDropAd}
                  className="px-2.5 py-1.5 rounded-lg font-display font-bold text-[11px] text-amber-950 bg-amber-400 shadow whitespace-nowrap cursor-pointer"
                >
                  {t('btn_supply_drop')}
                </button>
              </div>
            </div>

            {/* Center Score & Gene Supply Drop Ad Cluster */}
            <div className="flex flex-wrap items-center gap-2.5 pointer-events-auto">
              <div className="bg-slate-950/85 border border-slate-700/80 rounded-xl px-3.5 py-1.5 md:px-4 md:py-2 flex items-center gap-3.5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    {t('hud_score')}
                  </div>
                  <div className="font-display font-extrabold text-lg md:text-2xl text-white font-mono-num">
                    {hudState.score}
                  </div>
                </div>

                <div className="h-6 w-px bg-slate-800" />

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                    🧬 {t('hud_genes')}
                  </div>
                  <div className="font-display font-bold text-sm md:text-lg text-emerald-300 font-mono-num">
                    {hudState.genes}
                  </div>
                </div>

                <div className="h-6 w-px bg-slate-800" />

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                    🪙 {t('hud_coins')}
                  </div>
                  <div className="font-display font-bold text-sm md:text-lg text-amber-300 font-mono-num">
                    {hudState.coins}
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-px bg-slate-800" />

                <div className="hidden sm:block">
                  <div className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold">
                    {t(hudState.zoneKey)}
                  </div>
                  <div className="font-mono-num font-bold text-xs md:text-sm text-sky-200">
                    {hudState.depth}m
                  </div>
                </div>
              </div>

              {/* High-Conversion Ad Placement #4: Top Bar Gene Supply Drop (Desktop/Tablet) */}
              <button
                type="button"
                onClick={handleGeneSupplyDropAd}
                className="hidden md:inline-flex px-4 py-2.5 rounded-xl font-display font-bold text-xs md:text-sm text-amber-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-transform shadow-md cursor-pointer whitespace-nowrap shrink-0"
              >
                {t('btn_supply_drop')}
              </button>

              {hudState.frenzyTimer > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-amber-500/95 text-slate-950 font-display font-extrabold text-xs font-mono-num">
                  ⚡ {t('hud_frenzy')}: {hudState.frenzyTimer.toFixed(1)}s
                </div>
              )}
            </div>

            {/* Desktop Top-Right Utility Controls */}
            <div className="hidden md:flex items-center gap-2 pointer-events-auto shrink-0">
              <button
                type="button"
                onClick={toggleLanguage}
                aria-label={t('btn_lang_toggle')}
                className="px-3.5 py-2 rounded-lg font-display font-bold text-xs tracking-wide text-sky-100 bg-slate-900/90 border border-sky-400/40 hover:border-sky-300 hover:bg-slate-800 active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
              >
                🌐 {t('btn_lang_toggle')} ({lang.toUpperCase()})
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={toggleMute}
                aria-label={isMuted ? t('btn_unmute') : t('btn_mute')}
                className="px-3 py-2 rounded-lg font-display font-semibold text-xs text-slate-200 bg-slate-900/90 border border-slate-700 hover:border-slate-500 active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isMuted ? '🔇' : '🔊'} {isMuted ? t('btn_unmute') : t('btn_mute')}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameState('paused');
                }}
                aria-label={t('btn_pause')}
                className="px-3 py-2 rounded-lg font-display font-semibold text-xs text-slate-200 bg-slate-900/90 border border-slate-700 hover:border-slate-500 active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
              >
                ⏸ {t('btn_pause')} [P]
              </button>
            </div>
          </div>

          {/* Bottom Perimeter Row: Left Virtual Joystick + Right Boost Button */}
          <div className="flex items-end justify-between w-full pb-2 px-2">
            {/* Bottom-Left Virtual Joystick (Mouse & Touch Drag) */}
            <div
              role="slider"
              aria-label="Virtual Steering Joystick"
              aria-valuenow={Math.round(joystickVisual.dx)}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
              className="relative w-28 h-28 md:w-32 md:h-32 rounded-full bg-slate-900/65 border-2 border-sky-400/40 flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-16 h-16 rounded-full border border-sky-400/20 pointer-events-none" />
              <div
                className="w-12 h-12 rounded-full bg-sky-400/90 border-2 border-white shadow-md pointer-events-none transition-transform duration-75"
                style={{
                  transform: `translate3d(${joystickVisual.dx}px, ${joystickVisual.dy}px, 0)`,
                }}
              />
            </div>

            {/* Bottom-Right Large 2x Boost Button */}
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
              className={`w-24 h-24 md:w-28 md:h-28 rounded-full font-display font-extrabold text-sm md:text-base flex flex-col items-center justify-center border-4 shadow-xl pointer-events-auto cursor-pointer transition-transform ${
                boostVisual
                  ? 'bg-sky-400 text-slate-950 border-white scale-95'
                  : 'bg-slate-900/85 text-sky-200 border-sky-400 hover:bg-slate-800'
              }`}
            >
              <span className="text-xl leading-none mb-1">🚀</span>
              <span>{t('btn_boost')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== 3. EVOLUTION 3-CHOICE MODAL (WITH CLAIM ALL 3 AD) ==================== */}
      {evoChoices && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('evo_modal_title')}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/88 pointer-events-auto"
        >
          <div className="w-full max-w-3xl bg-slate-900 border border-sky-500/40 rounded-2xl p-5 md:p-7 shadow-2xl">
            <div className="text-center mb-5">
              <h2 className="font-display font-extrabold text-2xl md:text-3xl text-white mb-1">
                🧬 {t('evo_modal_title')}
              </h2>
              <p className="text-xs md:text-sm text-slate-300">
                {t('evo_modal_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {evoChoices.map((organ) => (
                <div
                  key={organ.id}
                  className="flex flex-col justify-between bg-slate-950 border border-slate-800 hover:border-sky-400/60 rounded-xl p-4 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>{t(`faction_${organ.faction}`)}</span>
                      <span>·</span>
                      <span>{t(`slot_${organ.slot}`)}</span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <OrganCanvasPreview organ={organ} size={60} />
                      <h3 className="font-display font-bold text-base text-white leading-snug">
                        {t(organ.nameKey)}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      {t(organ.descKey)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectSingleOrgan(organ)}
                    className="w-full py-2.5 px-4 rounded-lg font-display font-bold text-xs md:text-sm text-white bg-sky-600 hover:bg-sky-500 active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
                  >
                    {t('evo_btn_select')}
                  </button>
                </div>
              ))}
            </div>

            {/* High-Conversion Golden Ad CTA: Claim All 3 Organs at Once! */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleClaimAllThreeOrgansAd}
                className="w-full md:w-auto min-w-[290px] py-3.5 px-8 rounded-xl font-display font-extrabold text-sm md:text-base text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-transform shadow-lg cursor-pointer whitespace-nowrap"
              >
                {t('evo_btn_claim_all')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. PAUSE MODAL ==================== */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('btn_pause')}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/88 pointer-events-auto"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
            <h2 className="font-display font-extrabold text-2xl text-white mb-2">
              {t('btn_pause')}
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              {t('stat_organs_equipped')}: {Object.keys(equippedOrgans).length} / 5
            </p>

            {/* Equipped Organ Summary List */}
            <div className="flex flex-col gap-2 mb-6 text-left">
              {ALL_SLOTS.map((slot) => {
                const org = equippedOrgans[slot];
                return (
                  <div
                    key={slot}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  >
                    <span className="text-slate-400 font-semibold">
                      {t(`slot_${slot}`)}
                    </span>
                    <span className={org ? 'text-sky-300 font-bold' : 'text-slate-600'}>
                      {org ? t(org.nameKey) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="w-full py-3 rounded-xl font-display font-bold text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 cursor-pointer"
              >
                ▶ {t('btn_resume')}
              </button>
              <button
                type="button"
                onClick={toggleLanguage}
                className="w-full py-2.5 rounded-xl font-display font-semibold text-xs text-sky-200 bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                🌐 {t('btn_lang_toggle')} ({lang.toUpperCase()})
              </button>
              <button
                type="button"
                onClick={() => startNewRun(false)}
                className="w-full py-2.5 rounded-xl font-display font-semibold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                ↻ {t('btn_restart')}
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="w-full py-2.5 rounded-xl font-display font-semibold text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {t('btn_title')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 5. GAMEOVER / AD REVIVE & SETTLEMENT MODAL ==================== */}
      {gameState === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={reviveOffered ? t('gameover_title') : t('settlement_title')}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/90 pointer-events-auto"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
            {reviveOffered ? (
              <>
                <h2 className="font-display font-extrabold text-2xl text-rose-400 mb-2">
                  ⚡ {t('gameover_title')}
                </h2>
                <p className="text-xs md:text-sm text-slate-300 mb-6">
                  {t('gameover_subtitle')}
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleReviveWithFrenzyAd}
                    className="w-full py-4 px-5 rounded-xl font-display font-extrabold text-sm md:text-base text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-transform shadow-lg cursor-pointer"
                  >
                    {t('btn_revive_ad')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      adManager.showInterstitialAd();
                      setReviveOffered(false);
                    }}
                    className="w-full py-2.5 rounded-xl font-display font-semibold text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    {t('btn_give_up')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display font-extrabold text-2xl text-white mb-1">
                  🏆 {t('settlement_title')}
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  {t('settlement_subtitle')}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">
                      {t('stat_final_score')}
                    </div>
                    <div className="font-display font-extrabold text-xl text-white font-mono-num">
                      {runSnapshot.score}
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">
                      {t('stat_max_depth')}
                    </div>
                    <div className="font-display font-extrabold text-xl text-sky-300 font-mono-num">
                      {runSnapshot.maxDepth}m
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">
                      {t('stat_prey_eaten')}
                    </div>
                    <div className="font-display font-extrabold text-xl text-emerald-300 font-mono-num">
                      {runSnapshot.preyEaten}
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">
                      {t('stat_organs_equipped')}
                    </div>
                    <div className="font-display font-extrabold text-xl text-purple-300 font-mono-num">
                      {runSnapshot.organsCount} / 5
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => startNewRun(false)}
                    className="w-full py-3.5 rounded-xl font-display font-extrabold text-base text-slate-950 bg-emerald-400 hover:bg-emerald-300 cursor-pointer"
                  >
                    ▶ {t('btn_restart')}
                  </button>
                  <button
                    type="button"
                    onClick={handleTrialMaxMechaAd}
                    className="w-full py-3 rounded-xl font-display font-bold text-xs md:text-sm text-amber-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
                  >
                    {t('btn_trial_mecha')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== 6. SIMULATED REWARDED VIDEO AD OVERLAY (3S COUNTDOWN) ==================== */}
      {simAd && simAd.active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('ad_sim_title')}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 pointer-events-auto"
        >
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400/70 rounded-2xl p-6 text-center shadow-2xl">
            <div className="text-xs font-mono-num text-amber-300 uppercase tracking-wider mb-2">
              {t('ad_sim_badge')} · {t(`ad_env_${adManager.detectPlatform()}`)}
            </div>

            <h3 className="font-display font-extrabold text-xl text-white mb-2">
              🎬 {t('ad_sim_title')}
            </h3>
            <p className="text-xs text-slate-300 mb-5">{t('ad_sim_desc')}</p>

            {/* Visual Animated Ad Preview Stage */}
            <div className="relative h-36 w-full rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center mb-5 overflow-hidden">
              <div className="font-display font-extrabold text-4xl text-amber-400 font-mono-num mb-1">
                {simAd.secondsLeft > 0 ? `${simAd.secondsLeft}s` : '✓'}
              </div>
              <div className="text-xs text-sky-200 font-medium">
                {simAd.secondsLeft > 0
                  ? t('ad_sim_countdown', { sec: simAd.secondsLeft })
                  : t('ad_sim_ready')}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={simAd.secondsLeft > 0}
                onClick={() => {
                  const rewardFn = simAd.onReward;
                  setSimAd(null);
                  rewardFn();
                }}
                className={`w-full py-3.5 rounded-xl font-display font-extrabold text-sm transition-transform ${
                  simAd.secondsLeft > 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 active:scale-95 cursor-pointer'
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
                className="w-full py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {t('ad_sim_cancel_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
