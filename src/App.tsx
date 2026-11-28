/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { detectDefaultLang, Lang, translate } from './game/i18n';
import { GAME_CONFIG, PreyTierConfig } from './game/config';
import {
  ComputedSharkStats,
  computeEvolvedSharkStats,
  ECONOMY_PREDATION_CONFIG,
  getDebugPreySizeMultiplier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getXpRequiredForLevel,
  setDebugPreySizeMultiplier,
} from './game/rules';
import {
  evaluateSharkUnlockForRun,
  getGlobalAtlasBonuses,
  getNextEvolutionTarget,
  getPermanentProgressEligibility,
  getSharkFormById,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  LINEAGE_META,
  loadSharkMetaSave,
  recordFormalRunStarted,
  saveSharkMetaSave,
  SharkMetaSaveData,
} from './game/sharkEvolutionConfig';
import { soundFX } from './game/audio';
import {
  adManager,
  AdErrorInfo,
  ADS_AND_MONETIZATION_CONFIG,
  getMaxUnlockedRowFromSave,
  getScaledSupplyDropReward,
  getTrialTargetSharkSpec,
} from './game/adManager';
import { PreyEntity } from './game/canvasRenderer';
import { SharkEvolutionAtlasModal } from './components/SharkEvolutionAtlasModal';
import { GoogleRewardedVideoAdOverlay } from './components/GoogleRewardedVideoAdOverlay';
import { DebugPanelOverlay } from './components/game/DebugPanelOverlay';
import { TitleScreenOverlay } from './components/game/TitleScreenOverlay';
import { InGameHudOverlay } from './components/game/InGameHudOverlay';
import { PauseModalOverlay } from './components/game/PauseModalOverlay';
import { GameOverModalOverlay } from './components/game/GameOverModalOverlay';
import { spriteSheetManager } from './game/spriteSheetManager';
import { parallaxBackground } from './game/parallaxBackground';
import {
  getWorldDebugEnabled,
  setWorldDebugEnabled,
} from './game/worldGenerationSystem';
import { ecosystemSpawner, ViewportSpawnBounds } from './game/ecosystemSpawner';
import { infiniteProgressionManager } from './game/infiniteProgressionManager';
import { SharkGameEngine } from './game/sim/SharkGameEngine';
import {
  createInitialHudState,
  createInitialSimState,
  createPreyEntityForSim,
  EconomyUsesState,
  GameState,
  HudStateSnapshot,
  PooledParticle,
  PooledPickup,
  rollTargetBountySpecies,
  RunSummarySnapshot,
  SharkSimState,
  SimulatedAdState,
  spawnPooledFloatText,
  spawnPooledParticle,
  spawnPooledPickup,
  TUTORIAL_STORAGE_KEY,
  TutorialStep,
} from './game/sim/types';

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
  const [settlementDoubled, setSettlementDoubled] = useState<boolean>(false);
  const [runSnapshot, setRunSnapshot] = useState<RunSummarySnapshot>({
    score: 0,
    maxDepth: 120,
    preyEaten: 0,
    level: 1,
    coinsEarned: 0,
    genesEarned: 0,
    unlockedFormsCount: 1,
    activeSharkId: 'shark_00_clown_fry',
    personalBestScore: 0,
    isNewRecord: false,
    masteryCoinsBonus: 0,
    masteryGenesBonus: 0,
    masteryCrownTier: 0,
  });

  // Simulated Rewarded Ad Overlay state
  const [simAd, setSimAd] = useState<SimulatedAdState | null>(null);
  const simAdRef = useRef<SimulatedAdState | null>(null);
  simAdRef.current = simAd;
  const wasPlayingBeforeAdRef = useRef<boolean>(false);
  const [adNotice, setAdNotice] = useState<string | null>(null);
  const adNoticeTimerRef = useRef<number | null>(null);

  // Audio mute state
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Live Debug Panel state (hidden by default)
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const [debugMaxPreys, setDebugMaxPreys] = useState<number>(
    () => ecosystemSpawner.maxActivePreys
  );
  const [debugPreySizeMult, setDebugPreySizeMult] = useState<number>(() =>
    getDebugPreySizeMultiplier()
  );
  const [liveActivePreyCount, setLiveActivePreyCount] = useState<number>(
    () => ecosystemSpawner.maxActivePreys
  );
  const [debugWorldGrid, setDebugWorldGrid] = useState<boolean>(() =>
    getWorldDebugEnabled()
  );

  // 3-Step Hands-On Onboarding Tutorial State
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(() => {
    try {
      return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1'
        ? 'DONE'
        : 'EAT_SMALL_FISH';
    } catch {
      return 'EAT_SMALL_FISH';
    }
  });
  const tutorialStepRef = useRef<TutorialStep>(tutorialStep);
  tutorialStepRef.current = tutorialStep;
  const tutorialBoostAccumRef = useRef<number>(0);
  const [tutorialEatProgress, setTutorialEatProgress] = useState<number>(0);

  const completeTutorialOnboarding = useCallback(() => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    ecosystemSpawner.tutorialProtectionActive = false;
    tutorialStepRef.current = 'CELEBRATE';
    setTutorialStep('CELEBRATE');
    window.setTimeout(() => {
      if (tutorialStepRef.current === 'CELEBRATE') {
        tutorialStepRef.current = 'DONE';
        setTutorialStep('DONE');
      }
    }, 4200);
  }, []);

  const skipTutorialOnboarding = useCallback(() => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    ecosystemSpawner.tutorialProtectionActive = false;
    tutorialStepRef.current = 'DONE';
    setTutorialStep('DONE');
  }, []);

  const replayTutorialOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    tutorialBoostAccumRef.current = 0;
    setTutorialEatProgress(0);
    ecosystemSpawner.tutorialProtectionActive = true;
    tutorialStepRef.current = 'EAT_SMALL_FISH';
    setTutorialStep('EAT_SMALL_FISH');
    setGameState('playing');
  }, []);

  // Discrete HUD state (throttled ~120ms updates so React never reconciles at 60Hz unnecessarily)
  const [hudState, setHudState] = useState<HudStateSnapshot>(() =>
    createInitialHudState(loadSharkMetaSave())
  );

  const economyUsesRef = useRef<EconomyUsesState>({
    goldOverdriveCount: 0,
    geneSurgeCount: 0,
    runStartCoins: 0,
    runStartGenes: 0,
    runStartBestScore: 0,
    runMasteryCoinsAwarded: 0,
    runMasteryGenesAwarded: 0,
    runCoinsEarned: 0,
    runGenesEarned: 0,
    settlementDoubled: false,
    announcedCrownTier: 0,
  });

  // DOM refs for smooth 60fps bar & joystick transforms without React re-renders
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hpBarFillRef = useRef<HTMLDivElement | null>(null);
  const hpGhostFillRef = useRef<HTMLDivElement | null>(null);
  const energyBarFillRef = useRef<HTMLDivElement | null>(null);
  const xpBarFillRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const lastTouchActionTimeRef = useRef<number>(0);

  const [joystickVisual, setJoystickVisual] = useState<{
    active: boolean;
    dx: number;
    dy: number;
  }>({ active: false, dx: 0, dy: 0 });
  const [boostVisual, setBoostVisual] = useState<boolean>(false);

  // Mutable 60Hz simulation engine state stored in ref
  const simRef = useRef<SharkSimState>(createInitialSimState(metaSave));

  // Sync document.body.dataset.state & flush/clear active run flags cleanly on state transitions
  useEffect(() => {
    const prevState = gameStateRef.current;
    gameStateRef.current = gameState;
    if (gameState === 'title') {
      const sim = simRef.current;
      if (prevState === 'playing' || prevState === 'paused') {
        const curSave = metaSaveRef.current;
        if (
          curSave.bankedCoins !== sim.shark.coins ||
          curSave.bankedGenes !== sim.shark.genes
        ) {
          const flushed: SharkMetaSaveData = {
            ...curSave,
            bankedCoins: sim.shark.coins,
            bankedGenes: sim.shark.genes,
          };
          metaSaveRef.current = flushed;
          saveSharkMetaSave(flushed);
          setMetaSave(flushed);
        }
      }
      sim.shark.trialActive = false;
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.state = gameState;
    }
    if (typeof window !== 'undefined') {
      (
        window as unknown as {
          __debugTriggerGameOver?: (revive?: boolean) => void;
        }
      ).__debugTriggerGameOver = (revive: boolean = true) => {
        setRunSnapshot({
          score: 12850,
          maxDepth: 680,
          preyEaten: 34,
          level: 5,
          coinsEarned: 185,
          genesEarned: 28,
          unlockedFormsCount: metaSaveRef.current.unlockedSharkIds.length,
          activeSharkId: metaSaveRef.current.selectedSharkId,
          personalBestScore: 12850,
          isNewRecord: true,
          masteryCoinsBonus: 25,
          masteryGenesBonus: 15,
          masteryCrownTier: 2,
        });
        setSettlementDoubled(false);
        setReviveOffered(revive);
        setGameState('gameover');
      };
    }
  }, [gameState]);

  // Register Browser Simulated Video Ad Runner & Load Sprite Sheets + Parallax Background
  useEffect(() => {
    spriteSheetManager.load({
      activeSharkId: metaSaveRef.current.selectedSharkId,
      initialDepthMeters: 0,
    });
    parallaxBackground.load();
    adManager.registerBrowserSimulator((placement, onReward, onCancel) => {
      const nextAd: SimulatedAdState = {
        active: true,
        placement,
        secondsLeft: 3,
        onReward,
        onCancel,
      };
      simAdRef.current = nextAd;
      setSimAd(nextAd);
    });
    adManager.registerErrorHandler((err: AdErrorInfo) => {
      const msg = langRef.current === 'zh' ? err.messageZh : err.messageEn;
      setAdNotice(msg);
      if (adNoticeTimerRef.current !== null) {
        window.clearTimeout(adNoticeTimerRef.current);
      }
      adNoticeTimerRef.current = window.setTimeout(() => {
        setAdNotice(null);
        adNoticeTimerRef.current = null;
      }, 2600);
    });
    return () => {
      adManager.registerErrorHandler(null);
      if (adNoticeTimerRef.current !== null) {
        window.clearTimeout(adNoticeTimerRef.current);
      }
    };
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

  // Ring-buffer pool helpers bound to simRef
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
      spawnPooledParticle(simRef.current, x, y, vx, vy, radius, maxLife, color, kind);
    },
    []
  );

  const spawnPickup = useCallback(
    (
      x: number,
      y: number,
      vx: number,
      vy: number,
      kind: PooledPickup['kind'],
      value: number
    ) => {
      spawnPooledPickup(simRef.current, x, y, vx, vy, kind, value);
    },
    []
  );

  const spawnFloatText = useCallback(
    (
      x: number,
      y: number,
      textKey: string,
      bonusText: string,
      color: string,
      scale: number = 1.0
    ) => {
      spawnPooledFloatText(simRef.current, x, y, textKey, bonusText, color, scale);
    },
    []
  );

  const rollTargetBountyConfig = useCallback(
    (
      maxBiteTier: number,
      currentDepth: number,
      excludeId?: string,
      minPreyLengthCm?: number
    ): PreyTierConfig =>
      rollTargetBountySpecies(
        maxBiteTier,
        currentDepth,
        excludeId,
        minPreyLengthCm
      ),
    []
  );

  const createPreyEntity = useCallback(
    (nearSharkX?: number, nearSharkY?: number): PreyEntity =>
      createPreyEntityForSim(simRef.current, nearSharkX, nearSharkY),
    []
  );

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
        ? getTrialTargetSharkSpec(save.unlockedSharkIds).upgradeLevel
        : save.sharkUpgradeLevels[formId] ?? 1;
      const atlasBonuses = getGlobalAtlasBonuses(save);
      return computeEvolvedSharkStats(
        inRunLevel,
        formId,
        upgLevel,
        frenzyActive,
        infiniteProgressionManager.globalDifficultyMultiplier,
        atlasBonuses.unlockedCount,
        atlasBonuses.totalMasteryCrowns
      );
    },
    []
  );

  const clearAllInputs = useCallback(() => {
    const input = simRef.current.input;
    input.keys.clear();
    input.joyActive = false;
    input.joyPointerId = null;
    input.joyDx = 0;
    input.joyDy = 0;
    input.boostPointerHeld = false;
    input.boostPointerId = null;
    input.canvasPointerActive = false;
    input.canvasPointerId = null;
    input.rightMouseBoostHeld = false;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    setJoystickVisual({ active: false, dx: 0, dy: 0 });
    setBoostVisual(false);
  }, []);

  useEffect(() => {
    if (gameState !== 'playing' || showAtlasModal || simAd?.active) {
      clearAllInputs();
    }
  }, [gameState, showAtlasModal, simAd?.active, clearAllInputs]);

  useEffect(() => {
    adManager.registerAdStateChangeHandler((active) => {
      clearAllInputs();
      if (active) {
        wasPlayingBeforeAdRef.current =
          gameStateRef.current === 'playing' && !showAtlasModalRef.current;
      } else if (wasPlayingBeforeAdRef.current) {
        wasPlayingBeforeAdRef.current = false;
        gameStateRef.current = 'playing';
        document.body.dataset.state = 'playing';
        setGameState('playing');
      }
    });
    return () => {
      adManager.registerAdStateChangeHandler(null);
    };
  }, [clearAllInputs]);

  // Initialize or reset a run
  const startNewRun = useCallback(
    (withTrialShark: boolean = false) => {
      const sim = simRef.current;
      const baseSave = metaSaveRef.current;
      const runContext = { trialActive: withTrialShark, activeInRun: true };
      const permEligibility = getPermanentProgressEligibility(runContext);
      const save = recordFormalRunStarted(runContext, baseSave);
      if (save !== baseSave) {
        metaSaveRef.current = save;
        saveSharkMetaSave(save);
        setMetaSave(save);
      }

      const trialSpec = getTrialTargetSharkSpec(save.unlockedSharkIds);
      const chosenSharkId = withTrialShark
        ? trialSpec.sharkId
        : save.selectedSharkId;
      const chosenUpgLevel = withTrialShark
        ? trialSpec.upgradeLevel
        : save.sharkUpgradeLevels[chosenSharkId] ?? 1;
      const atlasBonusInit = getGlobalAtlasBonuses(save);
      const unlockedCount = atlasBonusInit.unlockedCount;

      economyUsesRef.current = {
        goldOverdriveCount: 0,
        geneSurgeCount: 0,
        runStartCoins: save.bankedCoins,
        runStartGenes: save.bankedGenes,
        runStartBestScore: save.sharkBestScores?.[chosenSharkId] ?? 0,
        runMasteryCoinsAwarded: 0,
        runMasteryGenesAwarded: 0,
        runCoinsEarned: 0,
        runGenesEarned: 0,
        settlementDoubled: false,
        announcedCrownTier: 0,
      };
      sim.settledPreyUids.clear();
      sim.genePityState = { pityMissStreak: 0 };

      const initialLevel = withTrialShark ? trialSpec.inRunLevel : 1;
      const stats = computeEvolvedSharkStats(
        initialLevel,
        chosenSharkId,
        chosenUpgLevel,
        withTrialShark,
        1.0,
        unlockedCount,
        atlasBonusInit.totalMasteryCrowns
      );

      const initWorldScale = stats.worldScale ?? stats.scale;
      const spawnY = Math.max(220, Math.round(22 * initWorldScale + 95));
      const spawnDepthMeters = Math.max(22, Math.round(spawnY * 0.1));
      const initialFrenzyTimer = withTrialShark
        ? trialSpec.initialFrenzyDurationSec
        : 0;

      sim.shark = {
        x: 0,
        y: spawnY,
        vx: 0,
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
        maxDepthReached: spawnDepthMeters,
        preyEatenCount: 0,
        frenzyTimer: initialFrenzyTimer,
        hitFlashTimer: 0,
        hitstopTimer: 0,
        invulnerableTimer: 1.8,
        cameraShakeTrauma: 0,
        trialActive: withTrialShark,
        comboCount: 0,
        comboTimer: 0,
        reachedTwilight: false,
        reachedAbyss: false,
        sharkFormId: chosenSharkId,
        morphFlashTimer: withTrialShark ? 1.0 : 0.45,
        turnRate: 0,
        facingDir: 1,
        facingScaleX: 1,
        stats,
      };

      sim.camera.x = sim.shark.x;
      sim.camera.y = sim.shark.y;
      sim.camera.zoom = stats.cameraZoom;
      sim.breachedTerraceCells.clear();
      sim.shallowDepletionTimer = 0;
      sim.deepDiveTargetMeters = null;

      clearAllInputs();

      sim.particles.forEach((p) => (p.active = false));
      sim.pickups.forEach((pk) => (pk.active = false));
      sim.floatTexts.forEach((ft) => (ft.active = false));

      const minPreyLengthCm = (stats.realBodyLengthM ?? 0.8) * 13.3;
      const firstTargetConfig = rollTargetBountyConfig(
        stats.biteTier,
        spawnY,
        undefined,
        minPreyLengthCm
      );
      sim.targetBounty = {
        preyConfig: firstTargetConfig,
        progress: 0,
        required: ECONOMY_PREDATION_CONFIG.bounty.requiredKills,
      };
      ecosystemSpawner.activeTargetPreyId = firstTargetConfig.id;
      ecosystemSpawner.activeSharkBiteTier =
        stats.normalBiteTier ?? stats.biteTier;

      let shouldRunTutorial = false;
      try {
        shouldRunTutorial =
          !withTrialShark &&
          localStorage.getItem(TUTORIAL_STORAGE_KEY) !== '1';
      } catch {
        shouldRunTutorial = !withTrialShark;
      }
      ecosystemSpawner.tutorialProtectionActive = shouldRunTutorial;
      if (shouldRunTutorial) {
        tutorialBoostAccumRef.current = 0;
        setTutorialEatProgress(0);
        tutorialStepRef.current = 'EAT_SMALL_FISH';
        setTutorialStep('EAT_SMALL_FISH');
      } else {
        tutorialStepRef.current = 'DONE';
        setTutorialStep('DONE');
      }

      infiniteProgressionManager.reset();
      ecosystemSpawner.reset(sim.preyList);
      const targetMaxPreys = Math.max(4, ecosystemSpawner.maxActivePreys);
      const startW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const startH = typeof window !== 'undefined' ? window.innerHeight : 720;
      const initViewportBounds: ViewportSpawnBounds = {
        halfW: Math.max(680, (startW * 0.5) / (sim.camera.zoom || 1)),
        halfH: Math.max(400, (startH * 0.5) / (sim.camera.zoom || 1)),
        cameraX: sim.shark.x,
        cameraY: sim.shark.y,
        sharkVx: 0,
        renderZoom: sim.camera.zoom || 1,
      };

      for (let i = 0; i < targetMaxPreys; i++) {
        const spawned = ecosystemSpawner.spawnPreyOffScreen(
          sim.preyList,
          sim.shark.x,
          sim.shark.y,
          Math.random,
          undefined,
          0,
          sim.shark.stats.realBodyLengthM,
          initViewportBounds
        );
        if (!spawned) break;
        if (i < 3) {
          spawned.config = firstTargetConfig;
          spawned.y = Math.max(
            Math.max(25, firstTargetConfig.minDepth),
            Math.min(firstTargetConfig.maxDepth, spawned.y)
          );
        }
      }
      setLiveActivePreyCount(sim.preyList.length);

      const activeForm = getSharkFormById(chosenSharkId);
      const nextEvo = getNextEvolutionTarget(chosenSharkId, save);
      const nextEval = nextEvo
        ? evaluateSharkUnlockForRun(
            nextEvo,
            save,
            runContext,
            0,
            0,
            initialLevel,
            spawnDepthMeters
          )
        : null;
      const upgCost = getSharkUpgradeCost(activeForm, chosenUpgLevel);
      const upgGeneCost = getSharkUpgradeGeneCost(activeForm, chosenUpgLevel);

      setShowAtlasModal(false);
      setReviveOffered(true);
      setSettlementDoubled(false);
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
        depth: spawnDepthMeters,
        zoneKey: 'zone_shallow',
        biteTier: stats.biteTier,
        frenzyTimer: initialFrenzyTimer,
        trialActive: withTrialShark,
        targetFishNameKey: firstTargetConfig.nameKey,
        targetFishProgress: 0,
        targetFishRequired: ECONOMY_PREDATION_CONFIG.bounty.requiredKills,
        targetFishLengthCm: firstTargetConfig.bodyLengthCm,
        targetFishSpeed: firstTargetConfig.baseSpeed,
        activeSynergy: stats.activeSynergy,
        goldOverdriveCost: getGoldOverdriveCost(0, activeForm.row),
        geneSurgeCost: getGeneSurgeCost(initialLevel, 0, activeForm.row),
        comboCount: 0,
        comboMultiplier: 1.0,
        goldenMutantCharge: 0,
        goldenMutantRequired: infiniteProgressionManager.goldenMutantRequired,
        frenzyCooldown: ECONOMY_PREDATION_CONFIG.frenzy.initProtectionSec,
        activeSharkId: chosenSharkId,
        activeUpgradeLevel: chosenUpgLevel,
        unlockedFormsCount: unlockedCount,
        nextEvoTargetId: nextEvo?.id ?? null,
        canBreakthroughNow: Boolean(
          permEligibility.allowSharkUnlockAndUpgrade && nextEval?.canUnlockNow
        ),
        canUpgradeBodyNow:
          permEligibility.allowSharkUnlockAndUpgrade &&
          chosenUpgLevel < 10 &&
          save.bankedCoins >= upgCost &&
          save.bankedGenes >= upgGeneCost,
        bodyUpgradeCost: upgCost,
        bodyUpgradeGeneCost: upgGeneCost,
        heatLevel: 0,
        masteryCrownTier: save.sharkMasteryTiers?.[chosenSharkId] ?? 0,
        deepDivePromptMeters: null,
      });

      if (withTrialShark) {
        soundFX.playEvolution();
        spawnFloatText(
          0,
          180,
          'float_trial_start',
          langRef.current === 'zh'
            ? `限时试玩: ${activeForm.nameZh}`
            : `TRIAL: ${activeForm.nameEn}`,
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
    [clearAllInputs, rollTargetBountyConfig, spawnFloatText]
  );

  // If booted with ?autostart=1, initialize the ocean run immediately on mount
  useEffect(() => {
    if (gameState === 'playing' && simRef.current.preyList.length === 0) {
      startNewRun(false);
    }
  }, [gameState, startNewRun]);

  const getCurrentProgressContext = useCallback(() => {
    const inRun =
      gameStateRef.current === 'playing' || gameStateRef.current === 'paused';
    return {
      trialActive: simRef.current.shark.trialActive,
      activeInRun: inRun,
    };
  }, []);

  // Upgrade unlocked shark form body level (Lv.1 -> Lv.10)
  const handleUpgradeSharkForm = useCallback(
    (sharkId: string) => {
      const sim = simRef.current;
      const runContext = getCurrentProgressContext();
      const permEligibility = getPermanentProgressEligibility(runContext);
      if (!permEligibility.allowSharkUnlockAndUpgrade) return;

      const baseSave = metaSaveRef.current;
      const inRun = runContext.activeInRun;
      const syncedCoins = inRun ? sim.shark.coins : baseSave.bankedCoins;
      const syncedGenes = inRun ? sim.shark.genes : baseSave.bankedGenes;
      const save: SharkMetaSaveData = {
        ...baseSave,
        bankedCoins: syncedCoins,
        bankedGenes: syncedGenes,
      };
      if (!save.unlockedSharkIds.includes(sharkId)) return;
      const curLv = save.sharkUpgradeLevels[sharkId] ?? 1;
      if (curLv >= 10) return;
      const form = getSharkFormById(sharkId);
      const cost = getSharkUpgradeCost(form, curLv);
      const geneCost = getSharkUpgradeGeneCost(form, curLv);
      if (save.bankedCoins < cost || save.bankedGenes < geneCost) return;

      const nextLv = curLv + 1;
      const nextSave: SharkMetaSaveData = {
        ...save,
        bankedCoins: save.bankedCoins - cost,
        bankedGenes: save.bankedGenes - geneCost,
        sharkUpgradeLevels: {
          ...save.sharkUpgradeLevels,
          [sharkId]: nextLv,
        },
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);

      sim.shark.coins = nextSave.bankedCoins;
      sim.shark.genes = nextSave.bankedGenes;
      if (inRun && sim.shark.sharkFormId === sharkId && !sim.shark.trialActive) {
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

      const activeForm = getSharkFormById(sim.shark.sharkFormId);
      const activeUpg =
        nextSave.sharkUpgradeLevels[sim.shark.sharkFormId] ?? 1;
      const nextUpgCost = getSharkUpgradeCost(activeForm, activeUpg);
      const nextUpgGeneCost = getSharkUpgradeGeneCost(activeForm, activeUpg);
      const nextEvo = getNextEvolutionTarget(sim.shark.sharkFormId, nextSave);
      const nextEval = nextEvo
        ? evaluateSharkUnlockForRun(
            nextEvo,
            nextSave,
            runContext,
            0,
            0,
            sim.shark.level,
            Math.round(sim.shark.maxDepthReached)
          )
        : null;
      setHudState((prev) => ({
        ...prev,
        coins: nextSave.bankedCoins,
        genes: nextSave.bankedGenes,
        hp: Math.ceil(sim.shark.hp),
        maxHp: sim.shark.stats.maxHp,
        biteTier: sim.shark.stats.biteTier,
        activeUpgradeLevel: activeUpg,
        bodyUpgradeCost: nextUpgCost,
        bodyUpgradeGeneCost: nextUpgGeneCost,
        canUpgradeBodyNow:
          permEligibility.allowSharkUnlockAndUpgrade &&
          activeUpg < 10 &&
          nextSave.bankedCoins >= nextUpgCost &&
          nextSave.bankedGenes >= nextUpgGeneCost,
        nextEvoTargetId: nextEvo?.id ?? null,
        canBreakthroughNow: Boolean(
          permEligibility.allowSharkUnlockAndUpgrade && nextEval?.canUnlockNow
        ),
      }));

      if (tutorialStepRef.current === 'HANDS_ON_UPGRADE') {
        completeTutorialOnboarding();
      }
      soundFX.playEvolution();
    },
    [
      completeTutorialOnboarding,
      getCurrentProgressContext,
      recomputeSharkStats,
      spawnFloatText,
    ]
  );

  // Switch active deployed shark form
  const handleSelectActiveSharkForm = useCallback(
    (sharkId: string) => {
      const sim = simRef.current;
      const runContext = getCurrentProgressContext();
      const permEligibility = getPermanentProgressEligibility(runContext);
      // P0-07: Never allow switching out of a Trial shark mid-run (prevents carrying Lv.5 / depth into formal play)
      if (!permEligibility.allowSharkUnlockAndUpgrade) return;

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
      if (runContext.activeInRun) {
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
          `${langRef.current === 'zh' ? form.nameZh : form.nameEn}`,
          LINEAGE_META[form.lineage].badgeColor,
          1.25
        );
      }
    },
    [getCurrentProgressContext, recomputeSharkStats, spawnFloatText]
  );

  // Unlock a new shark form via Triple-Gate & morph immediately (blocked during active Trial runs)
  const handleUnlockAndSelectSharkForm = useCallback(
    (sharkId: string) => {
      const sim = simRef.current;
      const runContext = getCurrentProgressContext();
      const permEligibility = getPermanentProgressEligibility(runContext);
      if (!permEligibility.allowSharkUnlockAndUpgrade) return;

      const baseSave = metaSaveRef.current;
      const inRun = runContext.activeInRun;
      const save: SharkMetaSaveData = {
        ...baseSave,
        bankedCoins: inRun ? sim.shark.coins : baseSave.bankedCoins,
        bankedGenes: inRun ? sim.shark.genes : baseSave.bankedGenes,
      };
      const form = getSharkFormById(sharkId);
      const evalStatus = evaluateSharkUnlockForRun(
        form,
        save,
        runContext,
        0,
        0,
        sim.shark.level,
        Math.round(sim.shark.maxDepthReached)
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
      if (inRun) {
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
      } else {
        soundFX.playEvolution();
      }

      const newUpg = nextSave.sharkUpgradeLevels[sharkId] ?? 1;
      const newUpgCost = getSharkUpgradeCost(form, newUpg);
      const newUpgGeneCost = getSharkUpgradeGeneCost(form, newUpg);
      const nextEvoAfter = getNextEvolutionTarget(sharkId, nextSave);
      const nextEvalAfter = nextEvoAfter
        ? evaluateSharkUnlockForRun(
            nextEvoAfter,
            nextSave,
            runContext,
            0,
            0,
            sim.shark.level,
            Math.round(sim.shark.maxDepthReached)
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
        canBreakthroughNow: Boolean(
          permEligibility.allowSharkUnlockAndUpgrade && nextEvalAfter?.canUnlockNow
        ),
        canUpgradeBodyNow:
          permEligibility.allowSharkUnlockAndUpgrade &&
          newUpg < 10 &&
          nextSave.bankedCoins >= newUpgCost &&
          nextSave.bankedGenes >= newUpgGeneCost,
        bodyUpgradeCost: newUpgCost,
        bodyUpgradeGeneCost: newUpgGeneCost,
      }));
    },
    [getCurrentProgressContext, recomputeSharkStats, spawnFloatText, spawnParticle]
  );

  const handleInRunBreakthroughOrAtlas = useCallback(() => {
    const sim = simRef.current;
    const save = metaSaveRef.current;
    const runContext = getCurrentProgressContext();
    const permEligibility = getPermanentProgressEligibility(runContext);
    if (permEligibility.allowSharkUnlockAndUpgrade) {
      const nextEvo = getNextEvolutionTarget(sim.shark.sharkFormId, save);
      if (nextEvo) {
        const evalStatus = evaluateSharkUnlockForRun(
          nextEvo,
          save,
          runContext,
          0,
          0,
          sim.shark.level,
          Math.round(sim.shark.maxDepthReached)
        );
        if (evalStatus.canUnlockNow) {
          handleUnlockAndSelectSharkForm(nextEvo.id);
          return;
        }
      }
    }
    setShowAtlasModal(true);
  }, [getCurrentProgressContext, handleUnlockAndSelectSharkForm]);

  const handleReviveWithFrenzyAd = useCallback(() => {
    adManager.showRewardedVideoAd('REVIVE', () => {
      const sim = simRef.current;
      const reviveCfg = ADS_AND_MONETIZATION_CONFIG.placements.REVIVE;
      clearAllInputs();
      sim.shark.stats = recomputeSharkStats(sim.shark.level, true);
      sim.shark.frenzyTimer =
        reviveCfg.frenzyDurationSec + sim.shark.stats.frenzyDurationBonus;
      sim.shark.hp = Math.round(sim.shark.stats.maxHp * reviveCfg.hpRestorePct);
      sim.shark.ghostHp = sim.shark.hp;
      sim.shark.energy = Math.round(
        sim.shark.stats.maxEnergy * reviveCfg.energyRestorePct
      );
      sim.shark.vx = 0;
      sim.shark.vy = 0;
      sim.shark.y = Math.max(46, Math.min(20000, sim.shark.y));
      sim.shark.hitFlashTimer = 0;
      sim.shark.hitstopTimer = 0;
      sim.shark.invulnerableTimer = Math.max(
        sim.shark.invulnerableTimer,
        reviveCfg.invulnDurationSec
      );

      soundFX.playEvolution();
      spawnFloatText(
        sim.shark.x,
        sim.shark.y - 40,
        'float_frenzy_start',
        langRef.current === 'zh' ? '原地满血复活!' : 'REVIVED IN PLACE!',
        '#fde047',
        1.35
      );
      setHudState((prev) => ({
        ...prev,
        hp: Math.ceil(sim.shark.hp),
        maxHp: sim.shark.stats.maxHp,
        energy: Math.round(sim.shark.energy),
        maxEnergy: sim.shark.stats.maxEnergy,
        biteTier: sim.shark.stats.biteTier,
        frenzyTimer: Number(sim.shark.frenzyTimer.toFixed(1)),
      }));
      setReviveOffered(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
    });
  }, [clearAllInputs, recomputeSharkStats, spawnFloatText]);

  const handleTrialSharkAd = useCallback(() => {
    adManager.showRewardedVideoAd('TRIAL_SHARK', () => {
      startNewRun(true);
    });
  }, [startNewRun]);

  const handleDoubleSettlementAd = useCallback(() => {
    const sim = simRef.current;
    const permElig = getPermanentProgressEligibility({
      trialActive: sim.shark.trialActive,
    });
    if (!permElig.allowDoubleSettlementAd || economyUsesRef.current.settlementDoubled) {
      return;
    }
    const extraCoins = economyUsesRef.current.runCoinsEarned;
    const extraGenes = economyUsesRef.current.runGenesEarned;
    if (extraCoins <= 0 && extraGenes <= 0) {
      return;
    }
    adManager.showRewardedVideoAd('DOUBLE_SETTLEMENT', () => {
      if (economyUsesRef.current.settlementDoubled) return;
      economyUsesRef.current.settlementDoubled = true;
      setSettlementDoubled(true);
      const curSave = metaSaveRef.current;
      const nextSave: SharkMetaSaveData = {
        ...curSave,
        bankedCoins: curSave.bankedCoins + extraCoins,
        bankedGenes: curSave.bankedGenes + extraGenes,
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);
      sim.shark.coins = nextSave.bankedCoins;
      sim.shark.genes = nextSave.bankedGenes;
      soundFX.playEvolution();
    });
  }, []);

  const handleSupplyDropAd = useCallback(() => {
    adManager.showRewardedVideoAd('SUPPLY_DROP', () => {
      const sim = simRef.current;
      const curSave = metaSaveRef.current;
      const drop = getScaledSupplyDropReward(
        getMaxUnlockedRowFromSave(curSave.unlockedSharkIds)
      );
      const nextSave: SharkMetaSaveData = {
        ...curSave,
        bankedCoins: curSave.bankedCoins + drop.coins,
        bankedGenes: curSave.bankedGenes + drop.genes,
      };
      metaSaveRef.current = nextSave;
      saveSharkMetaSave(nextSave);
      setMetaSave(nextSave);
      if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
        sim.shark.coins += drop.coins;
        sim.shark.genes += drop.genes;
        const flushed: SharkMetaSaveData = {
          ...nextSave,
          bankedCoins: sim.shark.coins,
          bankedGenes: sim.shark.genes,
        };
        metaSaveRef.current = flushed;
        saveSharkMetaSave(flushed);
        setMetaSave(flushed);
        spawnFloatText(
          sim.shark.x,
          sim.shark.y - 44,
          'float_supply_drop',
          `+${drop.coins}🪙 +${drop.genes}🧬`,
          '#fde047',
          1.3
        );
      }
      soundFX.playEvolution();
    });
  }, [spawnFloatText]);

  const handleGoldOverdrive = useCallback(() => {
    const sim = simRef.current;
    const shark = sim.shark;
    const overdriveCfg = ECONOMY_PREDATION_CONFIG.activeSkills.goldOverdrive;
    if (overdriveCfg.blockWhileFrenzy && shark.frenzyTimer > 0) {
      return;
    }
    const baseSave = metaSaveRef.current;
    const save: SharkMetaSaveData = {
      ...baseSave,
      bankedCoins: shark.coins,
      bankedGenes: shark.genes,
    };
    const activeForm = getSharkFormById(shark.sharkFormId);
    const cost = getGoldOverdriveCost(
      economyUsesRef.current.goldOverdriveCount,
      activeForm.row
    );
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
      overdriveCfg.durationSec + shark.stats.frenzyDurationBonus
    );
    const healAmount = Math.max(1, Math.round(shark.stats.maxHp * overdriveCfg.healMaxHpPct));
    shark.hp = Math.min(shark.stats.maxHp, shark.hp + healAmount);
    shark.energy = Math.round(shark.stats.maxEnergy * overdriveCfg.energyRestorePct);
    shark.invulnerableTimer = Math.max(shark.invulnerableTimer, overdriveCfg.invulnDurationSec);
    soundFX.playEvolution();
    spawnFloatText(
      shark.x,
      shark.y - 42,
      'float_gold_overdrive',
      `+${healAmount} HP · FRENZY!`,
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
        economyUsesRef.current.goldOverdriveCount,
        activeForm.row
      ),
    }));
  }, [recomputeSharkStats, spawnFloatText]);

  const handleGeneSurge = useCallback(() => {
    const sim = simRef.current;
    const shark = sim.shark;
    const surgeCfg = ECONOMY_PREDATION_CONFIG.activeSkills.geneSurge;
    const baseSave = metaSaveRef.current;
    const save: SharkMetaSaveData = {
      ...baseSave,
      bankedCoins: shark.coins,
      bankedGenes: shark.genes,
    };
    const activeForm = getSharkFormById(shark.sharkFormId);
    const cost = getGeneSurgeCost(
      shark.level,
      economyUsesRef.current.geneSurgeCount,
      activeForm.row
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
    const bonusXp = Math.round(
      getXpRequiredForLevel(shark.level) * surgeCfg.xpGrantRatio
    );
    shark.xp += bonusXp;
    const baseHeal = Math.max(
      surgeCfg.healMinFlat,
      Math.round(shark.stats.maxHp * surgeCfg.healMaxHpPct)
    );
    shark.hp = Math.min(shark.stats.maxHp, shark.hp + baseHeal);
    shark.energy = Math.round(shark.stats.maxEnergy * surgeCfg.energyRestorePct);
    shark.morphFlashTimer = Math.max(shark.morphFlashTimer, 0.55);
    soundFX.playEvolution();
    spawnFloatText(
      shark.x,
      shark.y - 42,
      'float_gene_surge',
      `+${bonusXp} XP · MAX ⚡`,
      '#34d399',
      1.26
    );
    let xpReq = getXpRequiredForLevel(shark.level);
    while (shark.xp >= xpReq) {
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
      xpReq = getXpRequiredForLevel(shark.level);
    }
    setHudState((prev) => ({
      ...prev,
      genes: shark.genes,
      level: shark.level,
      xp: Math.round(shark.xp),
      xpToNext: xpReq,
      hp: Math.ceil(shark.hp),
      maxHp: shark.stats.maxHp,
      energy: Math.round(shark.energy),
      maxEnergy: shark.stats.maxEnergy,
      biteTier: shark.stats.biteTier,
      geneSurgeCost: getGeneSurgeCost(
        shark.level,
        economyUsesRef.current.geneSurgeCount,
        activeForm.row
      ),
    }));
  }, [recomputeSharkStats, spawnFloatText]);

  // Keyboard Listeners (WASD / Arrows / Space / E / P / M / Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (simAdRef.current?.active || adManager.isAdInFlight()) return;

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
      clearAllInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [clearAllInputs, handleInRunBreakthroughOrAtlas, startNewRun]);

  // Mount decoupled pure-TS 60 FPS SharkGameEngine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new SharkGameEngine(canvas, {
      simRef,
      langRef,
      gameStateRef,
      metaSaveRef,
      showAtlasModalRef,
      simAdRef,
      tutorialStepRef,
      tutorialBoostAccumRef,
      economyUsesRef,
      hudDomRefs: {
        hpBarFillRef,
        hpGhostFillRef,
        energyBarFillRef,
        xpBarFillRef,
      },
      setGameState,
      setMetaSave,
      setRunSnapshot,
      setLiveActivePreyCount,
      setTutorialStep,
      setTutorialEatProgress,
      setHudState,
      spawnParticle,
      spawnPickup,
      spawnFloatText,
      rollTargetBountyConfig,
      createPreyEntity,
      recomputeSharkStats,
      clearAllInputs,
    });

    engine.start();
    return () => {
      engine.stop();
    };
  }, [
    clearAllInputs,
    createPreyEntity,
    recomputeSharkStats,
    rollTargetBountyConfig,
    spawnFloatText,
    spawnParticle,
    spawnPickup,
  ]);

  // Full-Canvas Direct Pointer Steering & Right-Click Boost Handlers
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
    if (gameStateRef.current !== 'playing') return;
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

  // Virtual Joystick Pointer Handlers (direct DOM transform on joystickKnobRef — zero React setState on pointermove)
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing') return;
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
    if (gameStateRef.current !== 'playing') return;
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

  // Mobile Multi-Touch Button Helper (onPointerDown + onTouchStart + onClick with debounce guard)
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

  const handleDebugMaxPreysChange = useCallback((nextVal: number) => {
    const clamped = Math.max(4, Math.min(80, Math.round(nextVal)));
    ecosystemSpawner.maxActivePreys = clamped;
    setDebugMaxPreys(clamped);
    const sim = simRef.current;
    const startW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const startH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const vpBounds: ViewportSpawnBounds = {
      halfW: Math.max(680, (startW * 0.5) / (sim.camera.zoom || 1)),
      halfH: Math.max(400, (startH * 0.5) / (sim.camera.zoom || 1)),
      cameraX: sim.camera.x,
      cameraY: sim.camera.y,
      sharkVx: sim.shark.vx,
    };
    ecosystemSpawner.syncPreyCountImmediate(
      sim.preyList,
      sim.shark.x,
      sim.shark.y,
      Math.random,
      sim.shark.score,
      undefined,
      sim.shark.stats.realBodyLengthM,
      vpBounds
    );
    setLiveActivePreyCount(sim.preyList.length);
  }, []);

  const handleDebugPreySizeChange = useCallback((nextVal: number) => {
    const clamped = Number(Math.max(0.35, Math.min(2.5, nextVal)).toFixed(2));
    setDebugPreySizeMultiplier(clamped);
    setDebugPreySizeMult(clamped);
  }, []);

  const handleToggleWorldDebugGrid = useCallback(() => {
    const next = !getWorldDebugEnabled();
    setWorldDebugEnabled(next);
    setDebugWorldGrid(next);
  }, []);

  const handleResetDebugParams = useCallback(() => {
    handleDebugMaxPreysChange(20);
    handleDebugPreySizeChange(0.8);
    setWorldDebugEnabled(false);
    setDebugWorldGrid(false);
  }, [handleDebugMaxPreysChange, handleDebugPreySizeChange]);

  const unlockedTotalCount = metaSave.unlockedSharkIds.length;
  const activeHudSharkForm = getSharkFormById(hudState.activeSharkId);
  const nextEvoTargetForm = hudState.nextEvoTargetId
    ? getSharkFormById(hudState.nextEvoTargetId)
    : null;
  const trialTargetSpec = getTrialTargetSharkSpec(metaSave.unlockedSharkIds);
  const trialTargetForm = getSharkFormById(trialTargetSpec.sharkId);
  const supplyDropReward = getScaledSupplyDropReward(
    getMaxUnlockedRowFromSave(metaSave.unlockedSharkIds)
  );

  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden select-none bg-slate-950">
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

      {/* Live Real-Time Debug Regulator Panel */}
      <DebugPanelOverlay
        lang={lang}
        t={t}
        showDebugPanel={showDebugPanel}
        setShowDebugPanel={setShowDebugPanel}
        debugMaxPreys={debugMaxPreys}
        debugPreySizeMult={debugPreySizeMult}
        liveActivePreyCount={liveActivePreyCount}
        debugWorldGrid={debugWorldGrid}
        bindMultiTouchButton={bindMultiTouchButton}
        handleDebugMaxPreysChange={handleDebugMaxPreysChange}
        handleDebugPreySizeChange={handleDebugPreySizeChange}
        handleToggleWorldDebugGrid={handleToggleWorldDebugGrid}
        handleResetDebugParams={handleResetDebugParams}
      />

      {/* 1. Title Screen Overlay */}
      <TitleScreenOverlay
        lang={lang}
        t={t}
        gameState={gameState}
        unlockedTotalCount={unlockedTotalCount}
        trialTargetForm={trialTargetForm}
        setShowAtlasModal={setShowAtlasModal}
        startNewRun={startNewRun}
        handleTrialSharkAd={handleTrialSharkAd}
      />

      {/* 2. Playing HUD (Frameless Iconic 90%+ Viewport Design) */}
      <InGameHudOverlay
        lang={lang}
        t={t}
        gameState={gameState}
        gameStateRef={gameStateRef}
        setGameState={setGameState}
        setShowAtlasModal={setShowAtlasModal}
        showDebugPanel={showDebugPanel}
        setShowDebugPanel={setShowDebugPanel}
        tutorialStep={tutorialStep}
        tutorialEatProgress={tutorialEatProgress}
        skipTutorialOnboarding={skipTutorialOnboarding}
        hudState={hudState}
        hpBarFillRef={hpBarFillRef}
        hpGhostFillRef={hpGhostFillRef}
        energyBarFillRef={energyBarFillRef}
        xpBarFillRef={xpBarFillRef}
        joystickKnobRef={joystickKnobRef}
        joystickVisual={joystickVisual}
        boostVisual={boostVisual}
        setBoostVisual={setBoostVisual}
        simRef={simRef}
        handleUpgradeSharkForm={handleUpgradeSharkForm}
        handleInRunBreakthroughOrAtlas={handleInRunBreakthroughOrAtlas}
        handleGoldOverdrive={handleGoldOverdrive}
        handleGeneSurge={handleGeneSurge}
        handleSupplyDropAd={handleSupplyDropAd}
        supplyDropReward={supplyDropReward}
        handleJoystickPointerDown={handleJoystickPointerDown}
        handleJoystickPointerMove={handleJoystickPointerMove}
        handleJoystickPointerUp={handleJoystickPointerUp}
        bindMultiTouchButton={bindMultiTouchButton}
        activeHudSharkForm={activeHudSharkForm}
        nextEvoTargetForm={nextEvoTargetForm}
      />

      {/* 3. 48-Shark Evolution Atlas & Upgrade Lab Modal */}
      {showAtlasModal && (() => {
        const atlasRunContext = {
          trialActive: simRef.current.shark.trialActive,
          activeInRun: gameState === 'playing' || gameState === 'paused',
        };
        const atlasEligibility = getPermanentProgressEligibility(atlasRunContext);
        const safeLiveLevel = atlasEligibility.allowRunRecords ? hudState.level : 1;
        const safeLiveMaxDepth = atlasEligibility.allowRunRecords
          ? Math.round(simRef.current.shark.maxDepthReached)
          : 0;
        return (
          <SharkEvolutionAtlasModal
            lang={lang}
            metaSave={metaSave}
            liveRunCoins={0}
            liveRunGenes={0}
            liveRunLevel={safeLiveLevel}
            liveRunMaxDepth={safeLiveMaxDepth}
            trialLockedInRun={!atlasEligibility.allowSharkUnlockAndUpgrade}
            onClose={() => setShowAtlasModal(false)}
            onSelectActiveShark={handleSelectActiveSharkForm}
            onUpgradeShark={handleUpgradeSharkForm}
            onUnlockShark={handleUnlockAndSelectSharkForm}
            onSupplyDropAd={handleSupplyDropAd}
          />
        );
      })()}

      {/* 4. Pause Modal */}
      <PauseModalOverlay
        lang={lang}
        t={t}
        gameState={gameState}
        setGameState={setGameState}
        setShowAtlasModal={setShowAtlasModal}
        isMuted={isMuted}
        replayTutorialOnboarding={replayTutorialOnboarding}
        hudState={hudState}
        startNewRun={startNewRun}
        toggleLanguage={toggleLanguage}
        toggleMute={toggleMute}
        activeHudSharkForm={activeHudSharkForm}
      />

      {/* 5. GameOver / Ad Revive & Settlement Modal */}
      <GameOverModalOverlay
        lang={lang}
        t={t}
        gameState={gameState}
        setGameState={setGameState}
        metaSave={metaSave}
        setShowAtlasModal={setShowAtlasModal}
        reviveOffered={reviveOffered}
        setReviveOffered={setReviveOffered}
        settlementDoubled={settlementDoubled}
        runSnapshot={runSnapshot}
        hudState={hudState}
        startNewRun={startNewRun}
        handleReviveWithFrenzyAd={handleReviveWithFrenzyAd}
        handleDoubleSettlementAd={handleDoubleSettlementAd}
        handleTrialSharkAd={handleTrialSharkAd}
        trialTargetForm={trialTargetForm}
        activeHudSharkForm={activeHudSharkForm}
      />

      {/* 6. Google IMA / H5 Rewarded Video Ad Player */}
      <AnimatePresence>
        {simAd && simAd.active && (
          <GoogleRewardedVideoAdOverlay
            key="google-video-ad-overlay"
            placement={simAd.placement}
            lang={lang}
            onReward={() => {
              const rewardFn = simAd.onReward;
              simAdRef.current = null;
              setSimAd(null);
              rewardFn();
            }}
            onCancel={() => {
              const cancelFn = simAd.onCancel;
              simAdRef.current = null;
              setSimAd(null);
              if (cancelFn) cancelFn();
            }}
          />
        )}
      </AnimatePresence>

      {/* 7. Ad Cooldown / Error Toast Notice */}
      {adNotice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="ad-error-notice"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-slate-900/95 border border-amber-400/70 text-amber-200 text-xs sm:text-sm font-bold shadow-xl pointer-events-none"
        >
          {adNotice}
        </div>
      )}
    </main>
  );
}
