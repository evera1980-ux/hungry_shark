import { GAME_CONFIG } from '../config';
import {
  addEvolutionProgress,
  buildPredationRewardPlan,
  CAMERA_ZOOM_MIN,
  collectPickupEntity,
  computeHuntingHeatBuff,
  ECONOMY_PREDATION_CONFIG,
  getDepthZone,
  getDebugPreySizeMultiplier,
  getEffectivePreyTier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getPreyRelativeVisualScale,
  getRequiredArmorHits,
  getXpRequiredForLevel,
  MIN_RENDER_ZOOM_FLOOR,
  resolvePreyEncounter,
  WORLD_CONFIG,
} from '../rules';
import {
  claimOnboardingStarterGift,
  evaluateSharkUnlockForRun,
  getGlobalAtlasBonuses,
  getNextEvolutionTarget,
  getPermanentProgressEligibility,
  getSharkFormById,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  recordPermanentRunProgress,
  saveSharkMetaSave,
  settleSharkScoreMastery,
  SharkMetaSaveData,
} from '../sharkEvolutionConfig';
import { soundFX } from '../audio';
import {
  adManager,
  getOnboardingStarterGiftConfig,
  getTrialTargetSharkSpec,
} from '../adManager';
import { spriteSheetManager } from '../spriteSheetManager';
import {
  detectShatterableTerraceHit,
  engineXToWorldX,
  formatTerraceBreachKey,
  meterDepthToWorldY,
  resolveSeabedCollision,
  resolveSeabedKineticStep,
  TERRACE_BREACH_CELL_WIDTH,
  worldChunkLifecycleManager,
  worldYToMeterDepth,
} from '../worldGenerationSystem';
import { infiniteWorldManager } from '../infiniteWorldManager';
import { ecosystemSpawner, ViewportSpawnBounds } from '../ecosystemSpawner';
import { infiniteProgressionManager } from '../infiniteProgressionManager';
import { SimEngineHost, TARGET_PREY_COUNT } from './types';

export interface StepSimulationParams {
  host: SimEngineHost;
  dt: number;
  now: number;
  viewW: number;
  viewH: number;
  aspectZoomFactor: number;
  isPausedOrOverlay: boolean;
}

/**
 * Pure imperative 60 FPS simulation step extracted from App.tsx.
 * Mutates pre-allocated zero-GC ring buffers and sim state directly,
 * synchronizing HUD snapshots at ~120ms intervals through the host bridge.
 */
export function stepSharkSimulation(params: StepSimulationParams): void {
  const { host, dt, now, viewW, viewH, aspectZoomFactor, isPausedOrOverlay } = params;
  const {
    simRef,
    langRef,
    gameStateRef,
    metaSaveRef,
    tutorialStepRef,
    tutorialBoostAccumRef,
    economyUsesRef,
    hudDomRefs,
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
  } = host;
  const { hpBarFillRef, hpGhostFillRef, energyBarFillRef, xpBarFillRef } = hudDomRefs;

  const sim = simRef.current;
  const shark = sim.shark;

      // ==================== 1. UPDATE SIMULATION ====================
      if (gameStateRef.current === 'title' && !isPausedOrOverlay) {
        // Title Screen Hero Patrol: uses the exact in-game Hydrodynamic Horizontal Whip-Turn & 2.5D Spinal C-Bend physics
        const selectedId = metaSaveRef.current.selectedSharkId;
        const selectedUpgLv =
          metaSaveRef.current.sharkUpgradeLevels[selectedId] ?? 1;
        if (
          shark.sharkFormId !== selectedId ||
          shark.stats.upgradeLevel !== selectedUpgLv
        ) {
          shark.sharkFormId = selectedId;
          shark.stats = recomputeSharkStats(1, false, selectedId);
        }
        shark.biteAnim = Math.max(0, shark.biteAnim - dt * 3);
        shark.morphFlashTimer = Math.max(0, shark.morphFlashTimer - dt * 1.4);

        // Alternate horizontal patrol direction every ~3.3s with gentle horizontal cruise undulation
        const patrolDir = Math.cos(now * 0.00095) >= 0 ? 1 : -1;
        const inputX = patrolDir;
        const inputY =
          Math.sin(now * 0.0022) * 0.12 +
          Math.max(-0.18, Math.min(0.18, (285 - shark.y) * 0.008));

        shark.targetAngle = Math.atan2(inputY, inputX);
        let diff = shark.targetAngle - shark.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const cosCur = Math.cos(shark.angle);
        const cosTgt = Math.cos(shark.targetAngle);
        // Hydrodynamic Horizontal Whip-Turn: pivot horizontally with 2.5D spinal C-bend whip instead of pitching 90° up/down
        if (Math.abs(diff) > 1.85 && cosCur * cosTgt < -0.15) {
          shark.facingDir = cosTgt >= 0 ? 1 : -1;
          shark.angle = Math.atan2(
            Math.sin(shark.angle),
            -Math.cos(shark.angle)
          );
          diff = shark.targetAngle - shark.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          const whipSign =
            (Math.sin(shark.targetAngle) - Math.sin(shark.angle)) *
              shark.facingDir >=
            0
              ? 1
              : -1;
          shark.turnRate = whipSign * 0.92;
          shark.swimPhase += 0.68;
        }

        const turnAgility = 11.2 * (1 + Math.min(0.45, Math.abs(diff) / Math.PI));
        shark.angle += diff * Math.min(1, dt * turnAgility);
        shark.angle = Math.atan2(Math.sin(shark.angle), Math.cos(shark.angle));

        const cosAfter = Math.cos(shark.angle);
        if (cosAfter > 0.18) {
          shark.facingDir = 1;
        } else if (cosAfter < -0.18) {
          shark.facingDir = -1;
        }

        const localTargetTurnBend = Math.max(
          -1,
          Math.min(1, (diff / 1.05) * shark.facingDir)
        );
        shark.turnRate +=
          (localTargetTurnBend - shark.turnRate) * Math.min(1, dt * 14);
        shark.facingScaleX +=
          (shark.facingDir - shark.facingScaleX) * Math.min(1, dt * 13.5);

        const titleCamZoom = Math.max(
          CAMERA_ZOOM_MIN,
          shark.stats.cameraZoom
        );
        const titleWorldScale = shark.stats.worldScale ?? shark.stats.scale;
        const patrolSpeed =
          ((shark.stats.moveSpeed || 280) * 0.62) / titleCamZoom;
        shark.vx +=
          (Math.cos(shark.angle) * patrolSpeed - shark.vx) * Math.min(1, dt * 7);
        shark.vy +=
          (Math.sin(shark.angle) * patrolSpeed - shark.vy) * Math.min(1, dt * 7);

        const minTitleY = Math.max(190, 22 * titleWorldScale + 75);
        const maxTitleY = Math.max(375, minTitleY + 140);
        shark.x = infiniteWorldManager.wrapEntityX(shark.x + shark.vx * dt);
        shark.y = Math.max(minTitleY, Math.min(maxTitleY, shark.y + shark.vy * dt));

        const cadenceFactor = Math.max(
          0.42,
          Math.min(
            1.0,
            Math.pow(0.8 / (shark.stats.realBodyLengthM || 0.8), 0.22)
          )
        );
        const speedNorm =
          (Math.hypot(shark.vx, shark.vy) * titleCamZoom) /
          Math.max(180, shark.stats.moveSpeed || 280);
        shark.swimPhase += dt * (4.8 + speedNorm * 6.8) * cadenceFactor;

        sim.camera.zoom = Math.max(0.26, shark.stats.cameraZoom * 1.15);
        // Keep the hero shark vertically centered (50% viewport height) on the title screen
        sim.camera.x = shark.x;
        sim.camera.y = shark.y;

        // Ambient prey swim on title screen
        if (sim.preyList.length === 0) {
          for (let i = 0; i < 18; i++) {
            sim.preyList.push(createPreyEntity(0, 240));
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
            const effectiveZoom = sim.camera.zoom * aspectZoomFactor;
            const sharkScreenX =
              viewW / 2 + (shark.x - sim.camera.x) * effectiveZoom;
            const sharkScreenY =
              viewH / 2 + (shark.y - sim.camera.y) * effectiveZoom;
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
        const wantsBoostForTurn =
          sim.input.boostPointerHeld ||
          sim.input.rightMouseBoostHeld ||
          sim.input.keys.has('Space');
        const isBoostingForTurn =
          wantsBoostForTurn && (shark.energy > 2 || shark.frenzyTimer > 0);

        if (inputMag > 0.08) {
          shark.targetAngle = Math.atan2(inputY, inputX);
          let diff = shark.targetAngle - shark.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          const cosCur = Math.cos(shark.angle);
          const cosTgt = Math.cos(shark.targetAngle);
          // Hydrodynamic Horizontal Whip-Turn: when reversing across left/right hemispheres (> 106°),
          // pivot horizontally with a 2.5D spinal C-bend whip instead of pitching 90° straight up/down like a clock hand!
          if (
            inputMag > 0.16 &&
            Math.abs(diff) > 1.85 &&
            cosCur * cosTgt < -0.15
          ) {
            shark.facingDir = cosTgt >= 0 ? 1 : -1;
            shark.angle = Math.atan2(
              Math.sin(shark.angle),
              -Math.cos(shark.angle)
            );
            diff = shark.targetAngle - shark.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const whipSign =
              (Math.sin(shark.targetAngle) - Math.sin(shark.angle)) *
                shark.facingDir >=
              0
                ? 1
                : -1;
            shark.turnRate = whipSign * 0.92;
            shark.swimPhase += 0.68;
          }

          const turnAgility =
            (isBoostingForTurn ? 15.0 : 12.0) *
            (1 + Math.min(0.45, Math.abs(diff) / Math.PI));
          shark.angle += diff * Math.min(1, simDt * turnAgility);
          shark.angle = Math.atan2(
            Math.sin(shark.angle),
            Math.cos(shark.angle)
          );

          const cosAfter = Math.cos(shark.angle);
          if (cosAfter > 0.18) {
            shark.facingDir = 1;
          } else if (cosAfter < -0.18) {
            shark.facingDir = -1;
          }

          const localTargetTurnBend = Math.max(
            -1,
            Math.min(1, (diff / 1.05) * shark.facingDir)
          );
          shark.turnRate +=
            (localTargetTurnBend - shark.turnRate) * Math.min(1, simDt * 14);
        } else {
          shark.turnRate += (0 - shark.turnRate) * Math.min(1, simDt * 10);
        }

        // Smooth 2.5D horizontal facing interpolation (+1 <-> -1) so crossing vertical or whip-turning never pops in 1 frame
        shark.facingScaleX +=
          (shark.facingDir - shark.facingScaleX) * Math.min(1, simDt * 13.5);

        // Boost Handling (2x Speed + Tail Flame Particles; supports Space, Boost Button, or Right-Click)
        const wantsBoost =
          sim.input.boostPointerHeld ||
          sim.input.rightMouseBoostHeld ||
          sim.input.keys.has('Space');
        const isBoosting =
          wantsBoost && (shark.energy > 2 || shark.frenzyTimer > 0);

        const worldScale = shark.stats.worldScale ?? shark.stats.scale;
        const zoomFactor = Math.max(CAMERA_ZOOM_MIN, shark.stats.cameraZoom);
        const invZoom = 1 / zoomFactor;
        const fxScale = Math.max(1, Math.sqrt(worldScale));

        if (isBoosting) {
          shark.energy = Math.max(
            0,
            shark.energy - shark.stats.boostDrainPerSec * simDt
          );
          soundFX.playBoostPulse();
          // Tutorial Step 2 -> Step 3: Accumulate 0.7s of Boost and award one-time +80 Coins & +20 Genes starter gift!
          if (tutorialStepRef.current === 'HOLD_BOOST') {
            tutorialBoostAccumRef.current += simDt;
            if (tutorialBoostAccumRef.current >= 0.7) {
              tutorialStepRef.current = 'HANDS_ON_UPGRADE';
              setTutorialStep('HANDS_ON_UPGRADE');
              const curSave = metaSaveRef.current;
              const syncedSave: SharkMetaSaveData = {
                ...curSave,
                bankedCoins: shark.coins,
                bankedGenes: shark.genes,
              };
              const giftCfg = getOnboardingStarterGiftConfig();
              const giftResult = giftCfg.enabled
                ? claimOnboardingStarterGift(syncedSave, giftCfg.coins, giftCfg.genes)
                : { updatedSave: syncedSave, granted: false };
              if (giftResult.granted) {
                metaSaveRef.current = giftResult.updatedSave;
                saveSharkMetaSave(giftResult.updatedSave);
                setMetaSave(giftResult.updatedSave);
                shark.coins = giftResult.updatedSave.bankedCoins;
                shark.genes = giftResult.updatedSave.bankedGenes;
                sim.lastHudSyncTime = 0;
                soundFX.playEvolution();
                spawnFloatText(
                  shark.x,
                  shark.y - 48 * worldScale,
                  'float_supply_drop',
                  langRef.current === 'zh'
                    ? `🎁 新手补给 +${giftCfg.coins}🪙 +${giftCfg.genes}🧬!`
                    : `🎁 Starter Gift +${giftCfg.coins}🪙 +${giftCfg.genes}🧬!`,
                  '#fde047',
                  1.35
                );
              }
            }
          }
          // 柔和尾迹气泡（按真实世界体长 worldScale 锚定尾尖位置与粒子尺寸）
          if (Math.random() < 0.4) {
            const tailX = shark.x - Math.cos(shark.angle) * 44 * worldScale;
            const tailY = shark.y - Math.sin(shark.angle) * 44 * worldScale;
            spawnParticle(
              tailX + (Math.random() - 0.5) * 8 * fxScale,
              tailY + (Math.random() - 0.5) * 8 * fxScale,
              -Math.cos(shark.angle) * (32 + Math.random() * 24) * fxScale,
              -Math.sin(shark.angle) * (32 + Math.random() * 24) * fxScale,
              (2.2 + Math.random() * 2.8) * fxScale,
              0.38,
              shark.frenzyTimer > 0 ? '#fde047' : '#38bdf8',
              'BUBBLE'
            );
          }
        } else {
          const heatBuff = computeHuntingHeatBuff(shark.comboCount);
          const surfaceBreatherBonus = shark.y < 48 * worldScale ? 18 : 0;
          const boostRegenMult = shark.stats.boostRegenMultiplier ?? 1.0;
          shark.energy = Math.min(
            shark.stats.maxEnergy,
            shark.energy +
              (GAME_CONFIG.world.baseBoostRegenPerSec * boostRegenMult +
                surfaceBreatherBonus +
                heatBuff.energyRegenBonus) *
                simDt
          );
        }

        // 真相机变焦下的单一 1:1 世界速度：保持各体长鲨鱼在屏幕上的巡航/冲刺体感速度一致
        const targetScreenSpeed = isBoosting
          ? shark.stats.boostSpeed
          : inputMag > 0.08
          ? shark.stats.moveSpeed * Math.min(1, Math.max(0.55, inputMag))
          : 0;
        const targetSpeed = targetScreenSpeed * invZoom;

        if (targetSpeed === 0) {
          shark.vx = 0;
          shark.vy = 0;
        } else {
          const accelRate = isBoosting ? 28 : 18;
          shark.vx += (Math.cos(shark.angle) * targetSpeed - shark.vx) * Math.min(1, simDt * accelRate);
          shark.vy += (Math.sin(shark.angle) * targetSpeed - shark.vy) * Math.min(1, simDt * accelRate);
          const preStepSpeed = Math.hypot(shark.vx, shark.vy);
          if (preStepSpeed > targetSpeed && preStepSpeed > 1e-6) {
            const clampScale = targetSpeed / preStepSpeed;
            shark.vx *= clampScale;
            shark.vy *= clampScale;
          }
        }

        // 单一 1:1 世界海床物理碰撞解算 + 巨鲨撞碎上层阶梯海床 (Tiers 0~4)
        const sharkRadiusWorld = 22 * worldScale;
        const prevSharkX = shark.x;
        const prevSharkY = shark.y;
        const sharkStep = resolveSeabedKineticStep(
          shark.x,
          shark.y,
          shark.vx,
          shark.vy,
          simDt,
          sharkRadiusWorld,
          undefined,
          {
            sharkLengthM: shark.stats.realBodyLengthM,
            breachedCells: sim.breachedTerraceCells,
          }
        );
        shark.x = sharkStep.engineX;
        shark.y = sharkStep.engineY;
        shark.vx = sharkStep.vx;
        shark.vy = sharkStep.vy;
        if (targetSpeed > 0) {
          const postStepSpeed = Math.hypot(shark.vx, shark.vy);
          if (postStepSpeed > targetSpeed && postStepSpeed > 1e-6) {
            const clampScale = targetSpeed / postStepSpeed;
            shark.vx *= clampScale;
            shark.vy *= clampScale;
          }
        }

        // 检测巨鲨是否撞穿可破碎的上层阶梯海床，写入局部破口集合并触发碎岩反馈
        const shatterHit = detectShatterableTerraceHit(
          prevSharkX,
          prevSharkY,
          shark.x,
          shark.y,
          sharkRadiusWorld,
          shark.stats.realBodyLengthM ?? 0.8,
          sim.breachedTerraceCells
        );
        if (shatterHit) {
          const cellSpan = Math.max(
            1,
            Math.ceil(sharkRadiusWorld / TERRACE_BREACH_CELL_WIDTH)
          );
          for (
            let c = shatterHit.cellIndex - cellSpan;
            c <= shatterHit.cellIndex + cellSpan;
            c++
          ) {
            const key = formatTerraceBreachKey(shatterHit.tierIndex, c);
            if (!sim.breachedTerraceCells.has(key)) {
              if (sim.breachedTerraceCells.size >= 512) {
                const oldest = sim.breachedTerraceCells.values().next().value;
                if (oldest !== undefined) {
                  sim.breachedTerraceCells.delete(oldest);
                }
              }
              sim.breachedTerraceCells.add(key);
            }
          }
          if (shatterHit.isNewlyBreached) {
            shark.vx *= 0.92;
            shark.vy *= 0.92;
            shark.cameraShakeTrauma = Math.max(shark.cameraShakeTrauma, 0.28);
            soundFX.playRockShatter();
            const isCoralTier = shatterHit.biomeId === 'coral_reef';
            for (let d = 0; d < 18; d++) {
              const ang = (d * Math.PI * 2) / 18 + (Math.random() - 0.5) * 0.45;
              const spd = (95 + Math.random() * 190) * fxScale;
              const isBubble = d % 3 === 0;
              spawnParticle(
                shark.x + Math.cos(ang) * sharkRadiusWorld * 0.45,
                shark.y + Math.sin(ang) * sharkRadiusWorld * 0.45,
                Math.cos(ang) * spd,
                Math.sin(ang) * spd,
                (isBubble ? 4 + Math.random() * 4 : 5.5 + Math.random() * 5.5) * fxScale,
                0.55 + Math.random() * 0.35,
                isBubble
                  ? '#bae6fd'
                  : isCoralTier
                  ? d % 2 === 0
                    ? '#d97706'
                    : '#f59e0b'
                  : d % 2 === 0
                  ? '#64748b'
                  : '#94a3b8',
                isBubble ? 'BUBBLE' : 'SPARK'
              );
            }
          }
        }

        // 模块 A：无限世界与动态边界控制器 (InfiniteWorldManager)
        infiniteWorldManager.update(dt, shark, sim.camera);
        sim.camera.zoom +=
          (shark.stats.cameraZoom - sim.camera.zoom) * Math.min(1, dt * 4.2);
        // 海平面镜头上界锚定：允许真相机变焦降至 MIN_RENDER_ZOOM_FLOOR (0.14)
        const effCamZoom = Math.max(
          MIN_RENDER_ZOOM_FLOOR,
          sim.camera.zoom * aspectZoomFactor
        );
        const minSurfaceCameraY = Math.max(72, (viewH * 0.5 - 76) / effCamZoom);
        if (sim.camera.y < minSurfaceCameraY) {
          sim.camera.y = minSurfaceCameraY;
        }

        const curHalfViewW = (viewW * 0.5) / effCamZoom;
        const curHalfViewH = (viewH * 0.5) / effCamZoom;
        const curViewportBounds: ViewportSpawnBounds = {
          halfW: curHalfViewW,
          halfH: curHalfViewH,
          cameraX: sim.camera.x,
          cameraY: sim.camera.y,
          sharkVx: shark.vx,
          renderZoom: effCamZoom,
        };

        const currentDepthMeters = worldYToMeterDepth(shark.y);
        // Depth-band lazy-preload upcoming prey WebP sprites (O(1) quantized bucket check)
        void spriteSheetManager.preloadPreyForDepth(currentDepthMeters);
        shark.maxDepthReached = Math.max(
          shark.maxDepthReached,
          Math.round(currentDepthMeters)
        );

        // Depth Zone Milestone Notifications (in real meters: 520m Twilight, 1150m Abyss)
        if (!shark.reachedTwilight && currentDepthMeters >= 520) {
          shark.reachedTwilight = true;
          spawnFloatText(
            shark.x,
            shark.y - 46 * worldScale,
            'float_zone_twilight',
            '',
            '#38bdf8',
            1.28
          );
        } else if (!shark.reachedAbyss && currentDepthMeters >= 1150) {
          shark.reachedAbyss = true;
          shark.cameraShakeTrauma = Math.max(shark.cameraShakeTrauma, 0.35);
          spawnFloatText(
            shark.x,
            shark.y - 46 * worldScale,
            'float_zone_abyss',
            '',
            '#c084fc',
            1.35
          );
        }

        // Sync skeletal swim phase with actual speed & boost/frenzy state
        const cadenceFactor = Math.max(
          0.42,
          Math.min(
            1.0,
            Math.pow(0.8 / (shark.stats.realBodyLengthM || 0.8), 0.22)
          )
        );
        const speedNorm =
          (Math.hypot(shark.vx, shark.vy) * zoomFactor) /
          Math.max(180, shark.stats.moveSpeed || 280);
        const boostCadenceBonus =
          isBoosting || shark.frenzyTimer > 0 ? 4.2 : 0;
        shark.swimPhase +=
          simDt * (4.8 + speedNorm * 6.8 + boostCadenceBonus) * cadenceFactor;
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

        // 巨鲨浅海空海检测与深潜引导计时：保持巨鲨浅海无鱼可吃状态，滞留 >1.5s 触发 HUD 下潜提示
        const minPreyLengthCm = (shark.stats.realBodyLengthM ?? 0.8) * 13.3;
        const hasViableFoodHere = ecosystemSpawner.hasViablePreyAtDepth(
          shark.y,
          shark.stats.realBodyLengthM
        );
        if (!hasViableFoodHere) {
          sim.shallowDepletionTimer += dt;
          if (sim.shallowDepletionTimer >= 1.5) {
            const minViableY = ecosystemSpawner.getMinViableWorldYForShark(
              shark.stats.realBodyLengthM
            );
            sim.deepDiveTargetMeters =
              minViableY !== null
                ? Math.max(
                    100,
                    Math.ceil(worldYToMeterDepth(minViableY) / 50) * 50
                  )
                : 750;
          }
        } else {
          sim.shallowDepletionTimer = 0;
          sim.deepDiveTargetMeters = null;
        }

        // Switch bounty target if too small for giant shark OR shark leaves habitat while viable prey exist at current depth
        const currentBountyLenCm =
          sim.targetBounty.preyConfig.bodyLengthCm ??
          sim.targetBounty.preyConfig.radius * 2.5;
        const bountyTooSmall =
          minPreyLengthCm > 0 && currentBountyLenCm < minPreyLengthCm;
        const leftBountyHabitat =
          hasViableFoodHere &&
          (shark.y < sim.targetBounty.preyConfig.minDepth - 140 ||
            shark.y > sim.targetBounty.preyConfig.maxDepth + 140);
        if (bountyTooSmall || leftBountyHabitat) {
          const zoneNativeTarget = rollTargetBountyConfig(
            shark.stats.biteTier,
            shark.y,
            sim.targetBounty.preyConfig.id,
            minPreyLengthCm
          );
          sim.targetBounty = {
            preyConfig: zoneNativeTarget,
            progress: 0,
            required: ECONOMY_PREDATION_CONFIG.bounty.requiredKills,
          };
          ecosystemSpawner.activeTargetPreyId = zoneNativeTarget.id;
        }

        // 模块 B：生态鱼群智能刷新与回收池 (EcosystemSpawner)
        ecosystemSpawner.activeSharkBiteTier =
          shark.stats.normalBiteTier ?? shark.stats.biteTier;
        ecosystemSpawner.update(
          simDt,
          sim.preyList,
          shark.x,
          shark.y,
          Math.random,
          shark.score,
          shark.stats.realBodyLengthM,
          curViewportBounds
        );

        // Mouth & Front-Body hitbox in 1:1 world space (scaled by worldScale)
        const mouthX = shark.x + Math.cos(shark.angle) * 32 * worldScale;
        const mouthY = shark.y + Math.sin(shark.angle) * 32 * worldScale;
        const frontBodyX = shark.x + Math.cos(shark.angle) * 10 * worldScale;
        const frontBodyY = shark.y + Math.sin(shark.angle) * 10 * worldScale;
        const mouthRadius = 28 * worldScale;
        const aiDistScale = Math.max(1, Math.sqrt(worldScale));
        const atlasBonus = getGlobalAtlasBonuses(metaSaveRef.current);

        // Update Prey AI, Jaw Suction Assist & Check Mouth Devour Collision
        for (let i = sim.preyList.length - 1; i >= 0; i--) {
          const prey = sim.preyList[i];
          if (prey.devoured) continue;

          // 1:1 单一世界坐标判定：视觉绘制与物理碰撞共享完全一致的 (prey.x, prey.y) 与 visualPreyScale
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
          // Generous jaw suction & bite floor on shrunk edible fish so eating small prey stays responsive
          const eatHitRadius = Math.max(
            renderedPreyRadius,
            18 * worldScale
          );
          const jawSuctionMult = shark.stats.jawSuctionMultiplier ?? 1.0;
          const suctionRadius =
            mouthRadius * 2.15 * jawSuctionMult + eatHitRadius;
          const distToMouthPre = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          const inJawSuctionZone =
            canEatNow && !prey.config.isHazard && distToMouthPre < suctionRadius;

          // Distinct AI Behavior Policies per Prey Archetype (natural 1:1 world speeds)
          const dirSign = prey.vx >= 0 ? 1 : -1;
          const uidSeed = (prey.uid % 17) * 0.37;
          const worldPreySpeed = prey.config.baseSpeed;
          switch (prey.config.behavior) {
            case 'DRIFT_SWARM': {
              // Pulsing jellyfish bell-jet propulsion + horizontal current weave
              const pulse = Math.sin(prey.phase * 1.6 + uidSeed);
              prey.vx = dirSign * worldPreySpeed * (0.65 + 0.35 * Math.cos(prey.phase * 0.7));
              prey.vy = (pulse > 0 ? -pulse * 36 : -pulse * 18) + Math.cos(prey.phase * 0.85) * 14;
              break;
            }
            case 'SCHOOL_FLEE': {
              // Gentle flee during Tutorial Step 1 or Lv.1 so new players effortlessly catch their first small fish
              const fleeMult =
                tutorialStepRef.current === 'EAT_SMALL_FISH' || shark.level <= 1
                  ? 0.55
                  : 1.2;
              if (
                distToShark < 210 * aiDistScale &&
                shark.stats.biteTier >= effectivePreyTier &&
                !inJawSuctionZone
              ) {
                const fleeAngle =
                  Math.atan2(prey.y - shark.y, prey.x - shark.x) +
                  Math.sin(prey.phase * 2.4 + uidSeed) * 0.28;
                prey.vx = Math.cos(fleeAngle) * worldPreySpeed * fleeMult;
                prey.vy = Math.sin(fleeAngle) * worldPreySpeed * fleeMult;
              } else {
                // Natural gentle horizontal schooling trajectory when undisturbed
                const cruiseSpeed =
                  worldPreySpeed * (0.92 + 0.1 * Math.sin(prey.phase * 0.7 + uidSeed));
                const curvePitch =
                  Math.sin(prey.phase * 0.75 + uidSeed) * 0.12 +
                  Math.cos(prey.phase * 0.42 + uidSeed) * 0.06;
                prey.vx = dirSign * Math.cos(curvePitch) * cruiseSpeed;
                prey.vy = Math.sin(curvePitch) * cruiseSpeed;
              }
              break;
            }
            case 'PUFFER_INFLATE': {
              prey.isInflated = distToShark < 190 * aiDistScale;
              if (prey.isInflated && !inJawSuctionZone) {
                const fleeAngle =
                  Math.atan2(prey.y - shark.y, prey.x - shark.x) +
                  Math.sin(prey.phase * 1.4) * 0.14;
                prey.vx = Math.cos(fleeAngle) * worldPreySpeed * 1.15;
                prey.vy = Math.sin(fleeAngle) * worldPreySpeed * 1.15;
              } else {
                // Gentle buoyant cruising trajectory
                prey.vx = dirSign * worldPreySpeed * (0.9 + 0.1 * Math.cos(prey.phase * 0.65));
                prey.vy =
                  Math.sin(prey.phase * 0.85 + uidSeed) * 14 +
                  Math.cos(prey.phase * 0.5) * 6;
              }
              break;
            }
            case 'SUB_PATROL': {
              prey.vx = dirSign * worldPreySpeed * (0.94 + 0.06 * Math.sin(prey.phase * 0.5));
              prey.vy = Math.cos(prey.phase * 0.65 + uidSeed) * 18;
              break;
            }
            case 'EEL_CHARGER': {
              // Shallow Sanctuary Protection: eels never actively charge at players swimming in the shallow zone (<= 520m)
              if (shark.y <= 520 || prey.y <= 520) {
                prey.telegraphTimer = 0;
                prey.vx = dirSign * worldPreySpeed * 0.9;
                prey.vy = Math.sin(prey.phase * 0.95 + uidSeed) * 16;
                break;
              }
              if (distToShark < 290 * aiDistScale && prey.telegraphTimer <= 0) {
                prey.telegraphTimer = 0.55;
              }
              if (prey.telegraphTimer > 0) {
                prey.telegraphTimer -= simDt;
                if (prey.telegraphTimer <= 0) {
                  const atkAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
                  prey.vx = Math.cos(atkAngle) * worldPreySpeed * 1.85;
                  prey.vy = Math.sin(atkAngle) * worldPreySpeed * 1.85;
                }
              } else {
                // Smooth horizontal glide while patrolling
                prey.vy = Math.sin(prey.phase * 1.05 + uidSeed) * 18;
              }
              break;
            }
            case 'MINE_HAZARD': {
              prey.vx = Math.sin(prey.phase * 0.6 + uidSeed) * 10;
              prey.vy = Math.cos(prey.phase * 0.9 + uidSeed) * 10;
              if (distToShark < 150 * aiDistScale) {
                prey.telegraphTimer = 0.4;
              } else {
                prey.telegraphTimer = Math.max(0, prey.telegraphTimer - simDt);
              }
              break;
            }
            case 'HEAVY_CRUISER':
            case 'KRAKEN_BOSS': {
              if (distToShark < 420 * aiDistScale) {
                const dirAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
                const isAggressiveApex =
                  shark.y > 520 &&
                  prey.y > 520 &&
                  (prey.config.isBoss ||
                    prey.mutationVariant === 'ABYSS_BEHEMOTH' ||
                    shark.stats.biteTier < effectivePreyTier);
                const mult =
                  shark.frenzyTimer > 0
                    ? -0.75
                    : isAggressiveApex
                    ? 1.08
                    : -0.75;
                prey.vx = Math.cos(dirAngle) * worldPreySpeed * mult;
                prey.vy = Math.sin(dirAngle) * worldPreySpeed * mult;
              } else {
                // Smooth horizontal glide when patrolling
                prey.vx = dirSign * worldPreySpeed * (0.92 + 0.08 * Math.cos(prey.phase * 0.55));
                prey.vy = Math.sin(prey.phase * 0.75 + uidSeed) * 16;
              }
              break;
            }
          }

          // Advance prey swimming phase dynamically coupled to actual instantaneous speed (fleeing/charging fish beat their tails faster)
          const preySpeedRatio = Math.max(
            0.55,
            Math.min(
              2.2,
              Math.hypot(prey.vx, prey.vy) /
                Math.max(25, prey.config.baseSpeed)
            )
          );
          prey.phase += simDt * (1.85 + preySpeedRatio * 1.75);

          // P0-3 Jaw Suction Pull: smoothly pull edible prey into the shark's open jaws in 1:1 world space
          if (inJawSuctionZone) {
            const pullRatio = Math.max(0, 1 - distToMouthPre / suctionRadius);
            const sharkSpeed = Math.hypot(shark.vx, shark.vy);
            const suctionSpeed =
              (220 * invZoom + sharkSpeed * 0.65) *
              (0.45 + pullRatio * 0.75);
            const pullAngle = Math.atan2(mouthY - prey.y, mouthX - prey.x);
            prey.x += Math.cos(pullAngle) * suctionSpeed * simDt;
            prey.y += Math.sin(pullAngle) * suctionSpeed * simDt;
            shark.biteAnim = Math.max(shark.biteAnim, 0.35 * pullRatio);
          }

          // Golden Frenzy Magnet gently pulls nearby small T1~T12 reef fish
          if (
            shark.frenzyTimer > 0 &&
            prey.config.tier <= 12 &&
            !prey.config.isHazard &&
            distToShark < shark.stats.magnetRadius * invZoom * 0.72
          ) {
            const pullAngle = Math.atan2(mouthY - prey.y, mouthX - prey.x);
            prey.x += Math.cos(pullAngle) * (165 * invZoom) * simDt;
            prey.y += Math.sin(pullAngle) * (165 * invZoom) * simDt;
          }

          const prevPreyX = prey.x;
          const prevPreyY = prey.y;
          prey.x = infiniteWorldManager.wrapEntityX(prey.x + prey.vx * simDt);
          prey.y += prey.vy * simDt;

          // Strictly keep every fish within its natural biological depth habitat [minDepth, maxDepth] and above physical seabed
          const minHabitatY = Math.max(25, prey.config.minDepth);
          const maxHabitatY = prey.config.maxDepth;
          if (prey.y < minHabitatY) {
            prey.y = minHabitatY;
            prey.vy = Math.abs(prey.vy) * 0.65;
          } else if (prey.y > maxHabitatY) {
            prey.y = maxHabitatY;
            prey.vy = -Math.abs(prey.vy) * 0.65;
          }
          // 猎物遵守完整阶梯海床碰撞，但可通过已被巨鲨撞碎的破口区间
          const preySeabedCollision = resolveSeabedCollision(
            prey.x,
            prey.y,
            renderedPreyRadius,
            prey.vy,
            undefined,
            prevPreyY,
            { breachedCells: sim.breachedTerraceCells }
          );
          if (preySeabedCollision.collided) {
            prey.x = infiniteWorldManager.wrapEntityX(
              prevPreyX + prey.vx * simDt * preySeabedCollision.tangentScale
            );
            prey.y = preySeabedCollision.engineY;
            prey.vy = preySeabedCollision.vy;
          }

          // Check collision with Shark Mouth / Front-Body in 1:1 world space
          const canBoostCrushNow =
            isBoosting &&
            !prey.config.isHazard &&
            effectivePreyTier <= shark.stats.biteTier + 3;
          const canBiteConnect = canEatNow || canBoostCrushNow;
          const distToMouth = Math.hypot(mouthX - prey.x, mouthY - prey.y);
          const distToFrontBody = Math.hypot(frontBodyX - prey.x, frontBodyY - prey.y);
          const effectiveHitDist = canBiteConnect
            ? Math.min(distToMouth, distToFrontBody * 0.95)
            : distToMouth;
          const hitThreshold = canBiteConnect
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
              const variant = prey.mutationVariant ?? 'NONE';
              if (outcome.isArmorCrush) {
                const neededHits = getRequiredArmorHits(prey.config, variant);
                const curArmorHp = prey.armorHp ?? neededHits;
                if (curArmorHp > 1) {
                  prey.armorHp = curArmorHp - 1;
                  const bounceAng = Math.atan2(shark.y - prey.y, shark.x - prey.x);
                  shark.invulnerableTimer = Math.max(shark.invulnerableTimer, 0.28);
                  shark.vx = Math.cos(bounceAng) * 210 * invZoom;
                  shark.vy = Math.sin(bounceAng) * 210 * invZoom;
                  shark.cameraShakeTrauma = Math.max(shark.cameraShakeTrauma, 0.3);
                  soundFX.playHit();
                  spawnFloatText(
                    prey.x,
                    prey.y - 24 * worldScale,
                    'float_armor_crush',
                    langRef.current === 'zh' ? '破甲裂缝!' : 'CRACK!',
                    '#f97316',
                    1.15
                  );
                  for (let k = 0; k < 8; k++) {
                    const ang = (k * Math.PI * 2) / 8;
                    spawnParticle(
                      prey.x,
                      prey.y,
                      Math.cos(ang) * 140 * fxScale,
                      Math.sin(ang) * 140 * fxScale,
                      4 * fxScale,
                      0.35,
                      '#f97316',
                      'SPARK'
                    );
                  }
                  continue;
                }
              }

              // Devour! Build Feeding Combo Chain + Restore Boost Energy on every kill
              shark.comboCount += 1;
              shark.comboTimer = ECONOMY_PREDATION_CONFIG.huntingHeatTiers.comboWindowSec;
              const maxComboBonus = shark.stats.maxComboBonus ?? 1.0;
              const comboMult = Number(
                (
                  1 +
                  Math.min(
                    maxComboBonus,
                    (shark.comboCount - 1) *
                      ECONOMY_PREDATION_CONFIG.huntingHeatTiers.comboScorePerStack
                  )
                ).toFixed(2)
              );
              const boostRefill =
                ECONOMY_PREDATION_CONFIG.huntingHeatTiers.baseKillEnergyBonus +
                Math.round(
                  prey.config.tier *
                    ECONOMY_PREDATION_CONFIG.huntingHeatTiers.killEnergyPerTier
                ) +
                (shark.stats.killEnergyBonus ?? 0);
              shark.energy = Math.min(
                shark.stats.maxEnergy,
                shark.energy + boostRefill
              );

              const heatBuff = computeHuntingHeatBuff(shark.comboCount);
              const bountyPreyScoreBonus =
                prey.config.id === sim.targetBounty.preyConfig.id
                  ? shark.stats.specialPreyScoreMultiplier ?? 1.0
                  : 1.0;
              const rewardScale =
                (prey.scaleMultiplier ?? 1.0) *
                bountyPreyScoreBonus *
                heatBuff.scoreMultiplier *
                comboMult;

              const finalScoreGain = infiniteProgressionManager.getScaledPreyValue(
                Math.round(outcome.scoreGain * rewardScale)
              );

              const effectiveGeneMult =
                shark.stats.geneYieldMultiplier ??
                shark.stats.rewardMultiplier ??
                atlasBonus.rewardMultiplier;
              const effectiveCoinMult =
                shark.stats.coinYieldMultiplier ??
                shark.stats.rewardMultiplier ??
                atlasBonus.rewardMultiplier;

              // Single-source predation reward plan: D6-X stratified probability + pity counter
              const rewardPlan = buildPredationRewardPlan(
                prey,
                outcome,
                {
                  effectiveCoinMult,
                  effectiveGeneMult,
                  finalScoreGain,
                },
                sim.settledPreyUids,
                sim.genePityState
              );
              if (!rewardPlan.settled) {
                continue;
              }

              shark.biteAnim = 1.0;
              shark.hp = Math.min(
                shark.stats.maxHp,
                shark.hp + rewardPlan.hpDelta
              );
              shark.score += rewardPlan.scoreGain;
              shark.preyEatenCount += 1;

              // Tutorial Step 1 -> Step 2 progression when player eats 3 small fish
              if (tutorialStepRef.current === 'EAT_SMALL_FISH') {
                const nextProgress = Math.min(3, shark.preyEatenCount);
                setTutorialEatProgress(nextProgress);
                if (shark.preyEatenCount >= 3) {
                  tutorialStepRef.current = 'HOLD_BOOST';
                  setTutorialStep('HOLD_BOOST');
                  soundFX.playEvolution();
                }
              }

              // Golden Mutant charge -> Gold Frenzy (D4-A: 6 Golden Mutants [5 for #28], 15s CD, 6.0s + bonus, no stack inflation)
              if (variant === 'GOLDEN_MUTANT' && shark.frenzyTimer <= 0) {
                const triggeredFrenzy =
                  infiniteProgressionManager.registerGoldenMutantDevoured(
                    shark.stats.goldenMutantReduction ?? 0
                  );
                if (triggeredFrenzy) {
                  shark.stats = recomputeSharkStats(shark.level, true);
                  shark.frenzyTimer =
                    ECONOMY_PREDATION_CONFIG.frenzy.baseDurationSec +
                    shark.stats.frenzyDurationBonus;
                }
              }
              if (
                prey.config.tier >= 18 ||
                outcome.encounterState === 'ARMOR_CRUSH'
              ) {
                shark.hitstopTimer = 0.045;
                shark.cameraShakeTrauma = 0.32;
              }

              soundFX.playBite(Math.ceil(prey.config.tier / 6));

              // Compliant Green Slime Bubbles & DNA Crystals Burst
              const burstCount =
                10 + Math.min(24, Math.ceil(prey.config.tier * 0.45));
              for (let b = 0; b < burstCount; b++) {
                const ang = (b * Math.PI * 2) / burstCount + Math.random() * 0.4;
                const spd = (60 + Math.random() * 140) * fxScale;
                spawnParticle(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  (4 + Math.random() * 5) * fxScale,
                  0.55 + Math.random() * 0.35,
                  b % 2 === 0 ? '#4ade80' : '#2dd4bf',
                  b % 3 === 0 ? 'DNA' : 'SLIME'
                );
              }

              // Spawn Collectible Gold Coins & DNA Crystal Pickups summing strictly to the single-source predation reward plan
              for (let d = 0; d < rewardPlan.pickups.length; d++) {
                const drop = rewardPlan.pickups[d];
                const ang =
                  (d * Math.PI * 2) / Math.max(1, rewardPlan.pickups.length) +
                  (Math.random() - 0.5) * 0.6;
                const spd = (82 + Math.random() * 56) * fxScale;
                spawnPickup(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * spd,
                  Math.sin(ang) * spd,
                  drop.kind,
                  drop.value
                );
              }

              const comboSuffix =
                shark.comboCount >= 2 ? ` · x${shark.comboCount}🔥` : '';
              spawnFloatText(
                prey.x,
                prey.y - 16 * worldScale,
                outcome.floatTextKey,
                `+${finalScoreGain}${comboSuffix}`,
                outcome.isCrit || shark.comboCount >= 5 ? '#fde047' : '#4ade80',
                outcome.isCrit || shark.comboCount >= 5 ? 1.22 : 1.0
              );

              // Check if devoured prey matches the active Target Fish Bounty (D5-A unified 2-kill scaled bounty)
              if (prey.config.id === sim.targetBounty.preyConfig.id) {
                sim.targetBounty.progress += 1;
                if (sim.targetBounty.progress >= sim.targetBounty.required) {
                  const bountyCfg = ECONOMY_PREDATION_CONFIG.bounty;
                  const bountyBonusScore = infiniteProgressionManager.getScaledPreyValue(
                    Math.round(
                      bountyCfg.scoreBase *
                        Math.max(1, prey.config.tier * bountyCfg.scoreTierMult) *
                        bountyPreyScoreBonus
                    )
                  );
                  const bountyGenes = Math.round(
                    (bountyCfg.baseGenes + prey.config.tier * bountyCfg.genesPerTier) *
                      (bountyCfg.applySharkYieldMultipliers ? effectiveGeneMult : 1.0)
                  );
                  const bountyCoins = Math.round(
                    (bountyCfg.baseCoins + prey.config.tier * bountyCfg.coinsPerTier) *
                      (bountyCfg.applySharkYieldMultipliers ? effectiveCoinMult : 1.0)
                  );
                  shark.score += bountyBonusScore;
                  shark.genes += bountyGenes;
                  shark.coins += bountyCoins;
                  economyUsesRef.current.runCoinsEarned += bountyCoins;
                  economyUsesRef.current.runGenesEarned += bountyGenes;
                  spawnFloatText(
                    shark.x,
                    shark.y - 38 * worldScale,
                    'float_target_bounty',
                    `+${bountyBonusScore} 🎯 (+${bountyCoins}🪙 +${bountyGenes}🧬)`,
                    '#38bdf8',
                    1.28
                  );
                  const nextTarget = rollTargetBountyConfig(
                    shark.stats.biteTier,
                    shark.y,
                    prey.config.id,
                    minPreyLengthCm
                  );
                  sim.targetBounty = {
                    preyConfig: nextTarget,
                    progress: 0,
                    required: bountyCfg.requiredKills,
                  };
                  ecosystemSpawner.activeTargetPreyId = nextTarget.id;

                  let assignedBountyCount = 0;
                  for (let k = 0; k < sim.preyList.length && assignedBountyCount < 2; k++) {
                    const candidate = sim.preyList[k];
                    if (candidate.uid === prey.uid) continue;
                    const dist = Math.hypot(candidate.x - shark.x, candidate.y - shark.y);
                    if (dist > 480 * invZoom) {
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
                  shark.y - 44 * worldScale,
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
                shark.score,
                shark.stats.realBodyLengthM,
                curViewportBounds
              );
            } else {
              // Oversized Prey or Active Mine Hazard -> Respect 0.55s Invulnerability Frames (i-frames)
              const bounceAngle = Math.atan2(shark.y - prey.y, shark.x - prey.x);
              if (shark.invulnerableTimer > 0) {
                shark.x += Math.cos(bounceAngle) * 10 * invZoom;
                shark.y += Math.sin(bounceAngle) * 10 * invZoom;
                continue;
              }

              const sizeFactor = Math.min(1.65, prey.scaleMultiplier ?? 1.0);
              const scaledDamage = Math.round(outcome.hpDelta * sizeFactor);
              shark.hp = Math.max(0, shark.hp + scaledDamage);
              shark.hitFlashTimer = 0.28;
              shark.invulnerableTimer = 0.55;
              shark.hitstopTimer = 0.055;
              shark.cameraShakeTrauma = 0.65;

              shark.vx = Math.cos(bounceAngle) * outcome.knockbackForce * invZoom;
              shark.vy = Math.sin(bounceAngle) * outcome.knockbackForce * invZoom;
              shark.x += Math.cos(bounceAngle) * 18 * invZoom;
              shark.y += Math.sin(bounceAngle) * 18 * invZoom;

              soundFX.playHit();
              spawnFloatText(
                shark.x,
                shark.y - 25 * worldScale,
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
                    Math.cos(ang) * 190 * fxScale,
                    Math.sin(ang) * 190 * fxScale,
                    5 * fxScale,
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
                  shark.score,
                  shark.stats.realBodyLengthM,
                  curViewportBounds
                );
              }
            }
          }
        }

        // Update Pickups (D5-A: 14s lifetime expiry + 1.45x frenzy magnet + combo Heat Magnet Bonus)
        const currentHeatBuff = computeHuntingHeatBuff(shark.comboCount);
        const frenzyMagMult =
          shark.frenzyTimer > 0
            ? ECONOMY_PREDATION_CONFIG.pickups.frenzyMagnetMultiplier
            : 1.0;
        const effectiveMagnetRadius =
          (shark.stats.magnetRadius + currentHeatBuff.magnetRadiusBonus) *
          invZoom *
          frenzyMagMult;
        const collectRadius =
          ECONOMY_PREDATION_CONFIG.pickups.collectRadiusWorldFactor * worldScale;
        for (const pk of sim.pickups) {
          if (!pk.active) continue;
          pk.life -= simDt;
          if (pk.life <= 0) {
            pk.active = false;
            continue;
          }
          pk.phase += simDt * 4;
          pk.vx *= 0.92;
          pk.vy *= 0.92;

          const dist = Math.hypot(shark.x - pk.x, shark.y - pk.y);
          if (dist < effectiveMagnetRadius) {
            const pullAngle = Math.atan2(shark.y - pk.y, shark.x - pk.x);
            const pullSpeed = 380 * invZoom + (effectiveMagnetRadius - dist) * 2.2;
            pk.vx = Math.cos(pullAngle) * pullSpeed;
            pk.vy = Math.sin(pullAngle) * pullSpeed;
          }

          pk.x += pk.vx * simDt;
          pk.y += pk.vy * simDt;

          if (dist < collectRadius) {
            const pickupRes = collectPickupEntity(pk, {
              coins: shark.coins,
              genes: shark.genes,
              score: shark.score,
              runCoinsEarned: economyUsesRef.current.runCoinsEarned,
              runGenesEarned: economyUsesRef.current.runGenesEarned,
            });
            if (pickupRes.collected) {
              shark.coins += pickupRes.coinsAdded;
              shark.genes += pickupRes.genesAdded;
              shark.score += pickupRes.scoreAdded;
              economyUsesRef.current.runCoinsEarned += pickupRes.coinsAdded;
              economyUsesRef.current.runGenesEarned += pickupRes.genesAdded;
              soundFX.playCoin();
              if (pickupRes.genesAdded > 0) {
                spawnFloatText(
                  pk.x,
                  pk.y - 12 * invZoom,
                  'float_devour',
                  `+${pickupRes.genesAdded}🧬`,
                  '#6ee7b7',
                  0.92
                );
              } else if (pickupRes.coinsAdded > 0) {
                spawnFloatText(
                  pk.x,
                  pk.y - 10 * invZoom,
                  'float_devour',
                  `+${pickupRes.coinsAdded}🪙`,
                  '#fde047',
                  0.84
                );
              }
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
          p.y += p.vy * dt - 18 * fxScale * dt;
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
          ft.y += ft.vy * invZoom * dt;
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

        // Check Defeat Condition (HP <= 0) -> Persist earned Coins/Genes (D1) while enforcing unified Trial permanent-progress gate (D2)!
        if (shark.hp <= 0) {
          soundFX.playHit();
          const curSave = metaSaveRef.current;
          const runContext = { trialActive: shark.trialActive, activeInRun: true };
          const permEligibility = getPermanentProgressEligibility(runContext);
          const progressedSave = recordPermanentRunProgress(
            curSave,
            runContext,
            shark.level,
            shark.maxDepthReached
          );
          const preMasterySave: SharkMetaSaveData = {
            ...progressedSave,
            bankedCoins: shark.coins,
            bankedGenes: shark.genes,
          };
          const finalMastery = settleSharkScoreMastery(
            shark.sharkFormId,
            shark.score,
            shark.trialActive,
            preMasterySave
          );
          if (finalMastery.coinsAwarded > 0) {
            shark.coins = finalMastery.updatedSave.bankedCoins;
            economyUsesRef.current.runMasteryCoinsAwarded +=
              finalMastery.coinsAwarded;
          }
          if (finalMastery.genesAwarded > 0) {
            shark.genes = finalMastery.updatedSave.bankedGenes;
            economyUsesRef.current.runMasteryGenesAwarded +=
              finalMastery.genesAwarded;
          }
          const settledSave = finalMastery.updatedSave;
          metaSaveRef.current = settledSave;
          saveSharkMetaSave(settledSave);
          setMetaSave(settledSave);

          setRunSnapshot({
            score: Math.round(shark.score),
            maxDepth: Math.round(shark.maxDepthReached),
            preyEaten: shark.preyEatenCount,
            level: shark.level,
            coinsEarned: economyUsesRef.current.runCoinsEarned,
            genesEarned: economyUsesRef.current.runGenesEarned,
            unlockedFormsCount: settledSave.unlockedSharkIds.length,
            activeSharkId: shark.sharkFormId,
            personalBestScore: permEligibility.allowSharkMasteryAndCrown
              ? finalMastery.newBestScore
              : curSave.sharkBestScores?.[shark.sharkFormId] ?? 0,
            isNewRecord:
              permEligibility.allowRunRecords &&
              Math.round(shark.score) >
                economyUsesRef.current.runStartBestScore &&
              Math.round(shark.score) > 0,
            masteryCoinsBonus: permEligibility.allowSharkMasteryAndCrown
              ? economyUsesRef.current.runMasteryCoinsAwarded
              : 0,
            masteryGenesBonus: permEligibility.allowSharkMasteryAndCrown
              ? economyUsesRef.current.runMasteryGenesAwarded
              : 0,
            masteryCrownTier: permEligibility.allowSharkMasteryAndCrown
              ? finalMastery.newCrownTier
              : 0,
          });
          if (
            permEligibility.allowRunRecords &&
            settledSave.totalRunsPlayed >=
              adManager.getInterstitialProtectedRunsCount()
          ) {
            adManager.showInterstitialAd();
          }
          clearAllInputs();
          document.body.dataset.state = 'gameover';
          setGameState('gameover');
        }

        // Throttled HUD Integer & Persistent Meta-Save Sync (every 120ms)
        if (now - sim.lastHudSyncTime > 120) {
          sim.lastHudSyncTime = now;
          const curSave = metaSaveRef.current;
          const runContext = { trialActive: shark.trialActive, activeInRun: true };
          const permEligibility = getPermanentProgressEligibility(runContext);
          const progressedSave = recordPermanentRunProgress(
            curSave,
            runContext,
            shark.level,
            shark.maxDepthReached
          );
          let activeSave = progressedSave;
          if (
            progressedSave.bankedCoins !== shark.coins ||
            progressedSave.bankedGenes !== shark.genes
          ) {
            activeSave = {
              ...progressedSave,
              bankedCoins: shark.coins,
              bankedGenes: shark.genes,
            };
          }

          // D3-A: Preview Crown attainment for HUD notification only; actual Crown payout settles cleanly at GameOver
          const liveMastery = settleSharkScoreMastery(
            shark.sharkFormId,
            shark.score,
            shark.trialActive,
            activeSave,
            { previewOnly: true }
          );
          if (
            liveMastery.newlyUnlockedTiers.length > 0 &&
            liveMastery.newCrownTier > economyUsesRef.current.announcedCrownTier
          ) {
            economyUsesRef.current.announcedCrownTier = liveMastery.newCrownTier;
            const topNewTier =
              liveMastery.newlyUnlockedTiers[
                liveMastery.newlyUnlockedTiers.length - 1
              ];
            soundFX.playEvolution();
            spawnFloatText(
              shark.x,
              shark.y - 54 * worldScale,
              'float_evo_ready',
              `${topNewTier.badgeIcon} ${
                langRef.current === 'zh'
                  ? topNewTier.nameZh
                  : topNewTier.nameEn
              }!`,
              '#fde047',
              1.35
            );
          }
          if (activeSave !== curSave) {
            metaSaveRef.current = activeSave;
            saveSharkMetaSave(activeSave);
            setMetaSave(activeSave);
          }

          const activeForm = getSharkFormById(shark.sharkFormId);
          const activeUpg = shark.trialActive
            ? getTrialTargetSharkSpec(activeSave.unlockedSharkIds).upgradeLevel
            : activeSave.sharkUpgradeLevels[shark.sharkFormId] ?? 1;
          const nextEvo = getNextEvolutionTarget(shark.sharkFormId, activeSave);
          const nextEval = nextEvo
            ? evaluateSharkUnlockForRun(
                nextEvo,
                activeSave,
                runContext,
                0,
                0,
                shark.level,
                Math.round(shark.maxDepthReached)
              )
            : null;
          const upgCost = getSharkUpgradeCost(activeForm, activeUpg);
          const upgGeneCost = getSharkUpgradeGeneCost(activeForm, activeUpg);
          const currentDepthMeters = Math.round(worldYToMeterDepth(shark.y));
          const currentZone = getDepthZone(currentDepthMeters);
          const hudHeat = computeHuntingHeatBuff(shark.comboCount);

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
            depth: currentDepthMeters,
            zoneKey: currentZone.nameKey,
            biteTier: shark.stats.biteTier,
            frenzyTimer: Number(shark.frenzyTimer.toFixed(1)),
            trialActive: shark.trialActive,
            targetFishNameKey: sim.targetBounty.preyConfig.nameKey,
            targetFishProgress: sim.targetBounty.progress,
            targetFishRequired: sim.targetBounty.required,
            targetFishLengthCm: sim.targetBounty.preyConfig.bodyLengthCm,
            targetFishSpeed: sim.targetBounty.preyConfig.baseSpeed,
            activeSynergy: shark.stats.activeSynergy,
            goldOverdriveCost: getGoldOverdriveCost(
              economyUsesRef.current.goldOverdriveCount,
              activeForm.row
            ),
            geneSurgeCost: getGeneSurgeCost(
              shark.level,
              economyUsesRef.current.geneSurgeCount,
              activeForm.row
            ),
            comboCount: shark.comboCount,
            comboMultiplier: Number(
              (
                1 +
                Math.min(
                  shark.stats.maxComboBonus ?? 1.0,
                  Math.max(0, shark.comboCount - 1) * 0.08
                )
              ).toFixed(2)
            ),
            goldenMutantCharge: infiniteProgressionManager.goldenMutantCharge,
            goldenMutantRequired: Math.max(
              3,
              infiniteProgressionManager.goldenMutantRequired -
                (shark.stats.goldenMutantReduction ?? 0)
            ),
            frenzyCooldown: Math.ceil(infiniteProgressionManager.frenzyCooldownTimer),
            activeSharkId: shark.sharkFormId,
            activeUpgradeLevel: activeUpg,
            unlockedFormsCount: activeSave.unlockedSharkIds.length,
            nextEvoTargetId: nextEvo?.id ?? null,
            canBreakthroughNow: Boolean(
              permEligibility.allowSharkUnlockAndUpgrade && nextEval?.canUnlockNow
            ),
            canUpgradeBodyNow:
              permEligibility.allowSharkUnlockAndUpgrade &&
              activeUpg < 10 &&
              activeSave.bankedCoins >= upgCost &&
              activeSave.bankedGenes >= upgGeneCost,
            bodyUpgradeCost: upgCost,
            bodyUpgradeGeneCost: upgGeneCost,
            heatLevel: hudHeat.heatLevel,
            masteryCrownTier: liveMastery.newCrownTier,
            deepDivePromptMeters: sim.deepDiveTargetMeters,
          });
          setLiveActivePreyCount(sim.preyList.length);
        }
      }
}
