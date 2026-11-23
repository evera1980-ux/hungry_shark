import { GAME_CONFIG } from '../config';
import {
  addEvolutionProgress,
  computeHuntingHeatBuff,
  getDepthZone,
  getDebugPreySizeMultiplier,
  getEffectivePreyTier,
  getGeneSurgeCost,
  getGoldOverdriveCost,
  getPreyRelativeVisualScale,
  getXpRequiredForLevel,
  resolvePreyEncounter,
} from '../rules';
import {
  evaluateSharkUnlock,
  getGlobalAtlasBonuses,
  getNextEvolutionTarget,
  getSharkFormById,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  saveSharkMetaSave,
  settleSharkScoreMastery,
  SharkMetaSaveData,
} from '../sharkEvolutionConfig';
import { soundFX } from '../audio';
import { adManager } from '../adManager';
import { parallaxBackground } from '../parallaxBackground';
import { spriteSheetManager } from '../spriteSheetManager';
import {
  engineXToWorldX,
  meterDepthToWorldY,
  resolveSeabedCollision,
  resolveSeabedKineticStep,
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
      if (gameStateRef.current === 'title') {
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

        const curSeabedScale = Math.max(
          0.015,
          Math.min(1.0, parallaxBackground.getSmoothedRelativePreyScale())
        );
        const patrolSpeed =
          ((shark.stats.moveSpeed || 280) * 0.62) / curSeabedScale;
        shark.vx +=
          (Math.cos(shark.angle) * patrolSpeed - shark.vx) * Math.min(1, dt * 7);
        shark.vy +=
          (Math.sin(shark.angle) * patrolSpeed - shark.vy) * Math.min(1, dt * 7);

        shark.x = infiniteWorldManager.wrapEntityX(shark.x + shark.vx * dt);
        shark.y = Math.max(190, Math.min(375, shark.y + shark.vy * dt));

        const cadenceFactor = Math.max(
          0.42,
          Math.min(
            1.0,
            Math.pow(0.8 / (shark.stats.realBodyLengthM || 0.8), 0.22)
          )
        );
        const speedNorm =
          (Math.hypot(shark.vx, shark.vy) * curSeabedScale) /
          Math.max(180, shark.stats.moveSpeed || 280);
        shark.swimPhase += dt * (4.8 + speedNorm * 6.8) * cadenceFactor;

        sim.camera.zoom = 1.15;
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

        if (isBoosting) {
          shark.energy = Math.max(
            0,
            shark.energy - shark.stats.boostDrainPerSec * simDt
          );
          soundFX.playBoostPulse();
          // Tutorial Step 2 -> Step 3: Accumulate 0.7s of Boost and immediately award +80 Coins & +20 Genes starter supply gift!
          if (tutorialStepRef.current === 'HOLD_BOOST') {
            tutorialBoostAccumRef.current += simDt;
            if (tutorialBoostAccumRef.current >= 0.7) {
              tutorialStepRef.current = 'HANDS_ON_UPGRADE';
              setTutorialStep('HANDS_ON_UPGRADE');
              const giftCoins = 80;
              const giftGenes = 20;
              const curSave = metaSaveRef.current;
              const giftedSave: SharkMetaSaveData = {
                ...curSave,
                bankedCoins: curSave.bankedCoins + giftCoins,
                bankedGenes: curSave.bankedGenes + giftGenes,
              };
              metaSaveRef.current = giftedSave;
              saveSharkMetaSave(giftedSave);
              setMetaSave(giftedSave);
              shark.coins = giftedSave.bankedCoins;
              shark.genes = giftedSave.bankedGenes;
              sim.lastHudSyncTime = 0;
              soundFX.playEvolution();
              spawnFloatText(
                shark.x,
                shark.y - 48,
                'float_supply_drop',
                langRef.current === 'zh'
                  ? '🎁 新手补给 +80🪙 +20🧬!'
                  : '🎁 Starter Gift +80🪙 +20🧬!',
                '#fde047',
                1.35
              );
            }
          }
          // 柔和尾迹气泡：消除过强后坐力式向后喷射气泡带来的“逆向水流冲击”错觉
          if (Math.random() < 0.4) {
            const tailX = shark.x - Math.cos(shark.angle) * 44 * shark.stats.scale;
            const tailY = shark.y - Math.sin(shark.angle) * 44 * shark.stats.scale;
            spawnParticle(
              tailX + (Math.random() - 0.5) * 8,
              tailY + (Math.random() - 0.5) * 8,
              -Math.cos(shark.angle) * (32 + Math.random() * 24),
              -Math.sin(shark.angle) * (32 + Math.random() * 24),
              2.2 + Math.random() * 2.8,
              0.38,
              shark.frenzyTimer > 0 ? '#fde047' : '#38bdf8',
              'BUBBLE'
            );
          }
        } else {
          const activeSharkForm = getSharkFormById(shark.sharkFormId);
          const heatBuff = computeHuntingHeatBuff(
            shark.score,
            activeSharkForm.row
          );
          const surfaceBreatherBonus = shark.y < 48 ? 18 : 0;
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

        const curSeabedScale = Math.max(
          0.015,
          Math.min(1.0, parallaxBackground.getSmoothedRelativePreyScale())
        );
        // Keep shark stationary in place when joystick / directional controls are not active
        const targetScreenSpeed = isBoosting
          ? shark.stats.boostSpeed
          : inputMag > 0.08
          ? shark.stats.moveSpeed * Math.min(1, Math.max(0.55, inputMag))
          : 0;
        const targetSpeed = targetScreenSpeed / curSeabedScale;

        if (targetSpeed === 0) {
          shark.vx = 0;
          shark.vy = 0;
        } else {
          // 冲刺状态下使用超灵敏即时响应加速度 (28.0) 且转向时矢量紧密贴合朝向，彻底消除漂移滞后与逆向阻水手感
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

        // 阶段 B：1.0x 世界层连续海床与浅海镂空珊瑚环礁拱台切向等速物理碰撞解算
        // 严格将沿斜坡上坡/下坡及洞口向下斜线水平移动的位移投影至单位切向量并守恒二维步长，彻底消除顺地形/沿洞口斜线移动的速度叠加！
        const sharkStep = resolveSeabedKineticStep(
          shark.x,
          shark.y,
          shark.vx,
          shark.vy,
          simDt,
          (22 * shark.stats.scale) / curSeabedScale
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

        // 模块 A：无限世界与动态边界控制器 (InfiniteWorldManager)
        infiniteWorldManager.update(dt, shark, sim.camera);
        sim.camera.zoom +=
          (shark.stats.cameraZoom - sim.camera.zoom) * Math.min(1, dt * 3.5);
        // 海平面镜头上界锚定：当鲨鱼游向海平面 (shark.y -> 0) 时，镜头顶部锚定在海面水体不再向上穿出天空，
        // 让鲨鱼在屏幕内真实游向顶部海面波浪，同时保持远景海水与远景礁石静止稳定
        const effCamZoom = Math.max(0.35, sim.camera.zoom * aspectZoomFactor);
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
            shark.y - 46,
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
            shark.y - 46,
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
          (Math.hypot(shark.vx, shark.vy) * curSeabedScale) /
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

          // 物理判定与视觉渲染坐标严格同源对齐（共用相对海床微缩比例尺，彻底消除冲刺逆流漂移与吃鱼错位）
          const effPreyX = shark.x + (prey.x - shark.x) * curSeabedScale;
          const effPreyY = shark.y + (prey.y - shark.y) * curSeabedScale;
          const distToShark = Math.hypot(shark.x - effPreyX, shark.y - effPreyY);
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
          const jawSuctionMult = shark.stats.jawSuctionMultiplier ?? 1.0;
          const suctionRadius =
            mouthRadius * 2.15 * jawSuctionMult + eatHitRadius;
          const distToMouthPre = Math.hypot(mouthX - effPreyX, mouthY - effPreyY);
          const inJawSuctionZone =
            canEatNow && !prey.config.isHazard && distToMouthPre < suctionRadius;

          // Distinct AI Behavior Policies per Prey Archetype (with organic curved trajectories)
          const dirSign = prey.vx >= 0 ? 1 : -1;
          const uidSeed = (prey.uid % 17) * 0.37;
          const worldPreySpeed = prey.config.baseSpeed / curSeabedScale;
          switch (prey.config.behavior) {
            case 'DRIFT_SWARM': {
              // Pulsing jellyfish bell-jet propulsion + horizontal current weave
              const pulse = Math.sin(prey.phase * 1.6 + uidSeed);
              prey.vx = dirSign * worldPreySpeed * (0.65 + 0.35 * Math.cos(prey.phase * 0.7));
              prey.vy = ((pulse > 0 ? -pulse * 36 : -pulse * 18) + Math.cos(prey.phase * 0.85) * 14) / curSeabedScale;
              break;
            }
            case 'SCHOOL_FLEE': {
              // Gentle flee during Tutorial Step 1 or Lv.1 so new players effortlessly catch their first small fish
              const fleeMult =
                tutorialStepRef.current === 'EAT_SMALL_FISH' || shark.level <= 1
                  ? 0.55
                  : 1.2;
              if (
                distToShark < 210 &&
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
              prey.isInflated = distToShark < 190;
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
                  (Math.sin(prey.phase * 0.85 + uidSeed) * 14 +
                  Math.cos(prey.phase * 0.5) * 6) / curSeabedScale;
              }
              break;
            }
            case 'SUB_PATROL': {
              prey.vx = dirSign * worldPreySpeed * (0.94 + 0.06 * Math.sin(prey.phase * 0.5));
              prey.vy = (Math.cos(prey.phase * 0.65 + uidSeed) * 18) / curSeabedScale;
              break;
            }
            case 'EEL_CHARGER': {
              // Shallow Sanctuary Protection: eels never actively charge at players swimming in the shallow zone (<= 520m)
              if (shark.y <= 520 || prey.y <= 520) {
                prey.telegraphTimer = 0;
                prey.vx = dirSign * worldPreySpeed * 0.9;
                prey.vy = (Math.sin(prey.phase * 0.95 + uidSeed) * 16) / curSeabedScale;
                break;
              }
              if (distToShark < 290 && prey.telegraphTimer <= 0) {
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
                prey.vy = (Math.sin(prey.phase * 1.05 + uidSeed) * 18) / curSeabedScale;
              }
              break;
            }
            case 'MINE_HAZARD': {
              prey.vx = (Math.sin(prey.phase * 0.6 + uidSeed) * 10) / curSeabedScale;
              prey.vy = (Math.cos(prey.phase * 0.9 + uidSeed) * 10) / curSeabedScale;
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
                prey.vy = (Math.sin(prey.phase * 0.75 + uidSeed) * 16) / curSeabedScale;
              }
              break;
            }
          }

          // Advance prey swimming phase dynamically coupled to actual instantaneous speed (fleeing/charging fish beat their tails faster)
          const preySpeedRatio = Math.max(
            0.55,
            Math.min(
              2.2,
              (Math.hypot(prey.vx, prey.vy) * curSeabedScale) /
                Math.max(25, prey.config.baseSpeed)
            )
          );
          prey.phase += simDt * (1.85 + preySpeedRatio * 1.75);

          // P0-3 Jaw Suction Pull: smoothly pull edible prey into the shark's open jaws when close
          if (inJawSuctionZone) {
            const pullRatio = Math.max(0, 1 - distToMouthPre / suctionRadius);
            const sharkSpeed = Math.hypot(shark.vx, shark.vy);
            const suctionSpeed =
              ((220 + sharkSpeed * curSeabedScale * 0.65) *
                (0.45 + pullRatio * 0.75)) /
              curSeabedScale;
            const pullAngle = Math.atan2(mouthY - effPreyY, mouthX - effPreyX);
            prey.x += Math.cos(pullAngle) * suctionSpeed * simDt;
            prey.y += Math.sin(pullAngle) * suctionSpeed * simDt;
            shark.biteAnim = Math.max(shark.biteAnim, 0.35 * pullRatio);
          }

          // Golden Frenzy Magnet gently pulls nearby small T1~T12 reef fish
          if (
            shark.frenzyTimer > 0 &&
            prey.config.tier <= 12 &&
            !prey.config.isHazard &&
            distToShark < shark.stats.magnetRadius * 0.72
          ) {
            const pullAngle = Math.atan2(mouthY - effPreyY, mouthX - effPreyX);
            prey.x += Math.cos(pullAngle) * (165 / curSeabedScale) * simDt;
            prey.y += Math.sin(pullAngle) * (165 / curSeabedScale) * simDt;
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
          const preySeabedCollision = resolveSeabedCollision(
            prey.x,
            prey.y,
            renderedPreyRadius,
            prey.vy,
            undefined,
            prevPreyY
          );
          if (preySeabedCollision.collided) {
            prey.x = infiniteWorldManager.wrapEntityX(
              prevPreyX + prey.vx * simDt * preySeabedCollision.tangentScale
            );
            prey.y = preySeabedCollision.engineY;
            prey.vy = preySeabedCollision.vy;
          }

          // Check collision with Shark Mouth / Front-Body (including +1T~+3T Boost Armor-Crush)
          const canBoostCrushNow =
            isBoosting &&
            !prey.config.isHazard &&
            effectivePreyTier <= shark.stats.biteTier + 3;
          const canBiteConnect = canEatNow || canBoostCrushNow;
          const postEffX = shark.x + (prey.x - shark.x) * curSeabedScale;
          const postEffY = shark.y + (prey.y - shark.y) * curSeabedScale;
          const distToMouth = Math.hypot(mouthX - postEffX, mouthY - postEffY);
          const distToFrontBody = Math.hypot(frontBodyX - postEffX, frontBodyY - postEffY);
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
              // Devour! Build Feeding Combo Chain + Restore Boost Energy on every kill
              shark.comboCount += 1;
              shark.comboTimer = 3.2;
              const maxComboBonus = shark.stats.maxComboBonus ?? 1.0;
              const comboMult = Number(
                (
                  1 + Math.min(maxComboBonus, (shark.comboCount - 1) * 0.08)
                ).toFixed(2)
              );
              const boostRefill =
                6 +
                Math.round(prey.config.tier * 0.45) +
                (shark.stats.killEnergyBonus ?? 0);
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
              const bountyPreyScoreBonus =
                prey.config.id === sim.targetBounty.preyConfig.id
                  ? shark.stats.specialPreyScoreMultiplier ?? 1.0
                  : 1.0;
              const frenzyStackMult =
                shark.frenzyTimer > 0
                  ? infiniteProgressionManager.getFrenzyScoreMultiplier()
                  : 1.0;
              const rewardScale =
                (prey.scaleMultiplier ?? 1.0) *
                variantScoreMult *
                bountyPreyScoreBonus *
                frenzyStackMult *
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

              const earnedGenes = Math.max(
                1,
                Math.round(
                  outcome.geneGain *
                    (variant === 'ABYSS_BEHEMOTH' ? 2.5 : 1.0) *
                    effectiveGeneMult
                )
              );
              const earnedCoins = Math.max(
                1,
                Math.round(
                  outcome.coinGain *
                    (variant === 'GOLDEN_MUTANT' ? 3.0 : 1.0) *
                    effectiveCoinMult
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

              // Requires devouring 8 true Golden Mutants outside of Frenzy (or 7 with Void Lightning trait) + passing cooldown
              if (variant === 'GOLDEN_MUTANT' && shark.frenzyTimer <= 0) {
                const triggeredStandard =
                  infiniteProgressionManager.registerGoldenMutantDevoured();
                const reducedReq = Math.max(
                  3,
                  infiniteProgressionManager.goldenMutantRequired -
                    (shark.stats.goldenMutantReduction ?? 0)
                );
                const triggeredByTrait =
                  !triggeredStandard &&
                  (shark.stats.goldenMutantReduction ?? 0) > 0 &&
                  infiniteProgressionManager.goldenMutantCharge >= reducedReq;
                if (triggeredByTrait) {
                  infiniteProgressionManager.goldenMutantCharge = 0;
                  infiniteProgressionManager.frenzyCooldownTimer = 25;
                  infiniteProgressionManager.addFrenzyStack();
                }
                if (triggeredStandard || triggeredByTrait) {
                  shark.stats = recomputeSharkStats(shark.level, true);
                  shark.frenzyTimer = 3.6 + shark.stats.frenzyDurationBonus;
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

              // Spawn Collectible Gold Coins (75%) & DNA Helix Pickups (25% on normal fish; guaranteed bonus DNA on Bounty Target / Abyss Behemoth / T18+)
              const isHighGeneSource =
                prey.config.id === sim.targetBounty.preyConfig.id ||
                variant === 'ABYSS_BEHEMOTH' ||
                prey.config.tier >= 18;
              const pickupDrops = Math.min(6, Math.ceil(prey.config.tier / 9) + 1);
              for (let d = 0; d < pickupDrops; d++) {
                const ang = Math.random() * Math.PI * 2;
                const dropKind =
                  isHighGeneSource && d % 2 === 1
                    ? 'DNA_CRYSTAL'
                    : d % 4 === 3
                    ? 'DNA_CRYSTAL'
                    : 'COIN';
                const basePickupVal =
                  dropKind === 'COIN'
                    ? Math.max(
                        3,
                        Math.round(
                          Math.max(1, prey.config.tier * 0.45) *
                            2.5 *
                            effectiveCoinMult
                        )
                      )
                    : Math.max(
                        1,
                        Math.round(
                          Math.max(1, prey.config.tier * 0.45) *
                            1.2 *
                            effectiveGeneMult
                        )
                      );
                spawnPickup(
                  prey.x,
                  prey.y,
                  Math.cos(ang) * 95,
                  Math.sin(ang) * 95,
                  dropKind,
                  basePickupVal
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

              // Check if devoured prey matches the active Target Fish Bounty (🎯 悬赏目标鱼 — Primary High-Concentration Gene & Coin Source)
              if (prey.config.id === sim.targetBounty.preyConfig.id) {
                sim.targetBounty.progress += 1;
                if (sim.targetBounty.progress >= sim.targetBounty.required) {
                  const bountyBonusScore = infiniteProgressionManager.getScaledPreyValue(
                    Math.round(
                      350 *
                        Math.max(1, prey.config.tier * 0.35) *
                        bountyPreyScoreBonus
                    )
                  );
                  const bountyGenes = Math.round(
                    (18 + prey.config.tier * 0.85) * effectiveGeneMult
                  );
                  const bountyCoins = Math.round(
                    (48 + prey.config.tier * 2.5) * effectiveCoinMult
                  );
                  shark.score += bountyBonusScore;
                  shark.genes += bountyGenes;
                  shark.coins += bountyCoins;
                  spawnFloatText(
                    shark.x,
                    shark.y - 38,
                    'float_target_bounty',
                    `+${bountyBonusScore} 🎯 (+${bountyGenes}🧬)`,
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
                shark.score,
                shark.stats.realBodyLengthM,
                curViewportBounds
              );
            } else {
              // Oversized Prey or Active Mine Hazard -> Respect 0.55s Invulnerability Frames (i-frames)
              const bounceAngle = Math.atan2(shark.y - postEffY, shark.x - postEffX);
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
                  shark.score,
                  shark.stats.realBodyLengthM,
                  curViewportBounds
                );
              }
            }
          }
        }

        // Update Pickups (Magnet Pull toward Shark + Hunting Heat Magnet Bonus)
        const activeFormForHeat = getSharkFormById(shark.sharkFormId);
        const currentHeatBuff = computeHuntingHeatBuff(
          shark.score,
          activeFormForHeat.row
        );
        const effectiveMagnetRadius =
          shark.stats.magnetRadius + currentHeatBuff.magnetRadiusBonus;
        for (const pk of sim.pickups) {
          if (!pk.active) continue;
          pk.phase += simDt * 4;
          pk.vx *= 0.92;
          pk.vy *= 0.92;

          const dist = Math.hypot(shark.x - pk.x, shark.y - pk.y);
          if (dist < effectiveMagnetRadius) {
            const pullAngle = Math.atan2(shark.y - pk.y, shark.x - pk.x);
            const pullSpeed = 380 + (effectiveMagnetRadius - dist) * 2.2;
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

        // Check Defeat Condition (HP <= 0) -> Persist all earned Coins, Genes, and Per-Shark Mastery Records!
        if (shark.hp <= 0) {
          soundFX.playHit();
          const curSave = metaSaveRef.current;
          const preMasterySave: SharkMetaSaveData = {
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
          const finalMastery = settleSharkScoreMastery(
            shark.sharkFormId,
            shark.score,
            shark.trialActive,
            preMasterySave
          );
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
            personalBestScore: finalMastery.newBestScore,
            isNewRecord:
              !shark.trialActive &&
              Math.round(shark.score) >
                economyUsesRef.current.runStartBestScore &&
              Math.round(shark.score) > 0,
            masteryGenesBonus: economyUsesRef.current.runMasteryGenesAwarded,
            masteryCrownTier: finalMastery.newCrownTier,
          });
          clearAllInputs();
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
          }

          // Live Per-Shark Mastery Crown Evaluation (awards 1st-clear Gene bonus immediately upon crossing threshold!)
          const liveMastery = settleSharkScoreMastery(
            shark.sharkFormId,
            shark.score,
            shark.trialActive,
            activeSave
          );
          if (liveMastery.genesAwarded > 0) {
            shark.genes = liveMastery.updatedSave.bankedGenes;
            economyUsesRef.current.runMasteryGenesAwarded +=
              liveMastery.genesAwarded;
            const topNewTier =
              liveMastery.newlyUnlockedTiers[
                liveMastery.newlyUnlockedTiers.length - 1
              ];
            soundFX.playEvolution();
            spawnFloatText(
              shark.x,
              shark.y - 54,
              'float_evo_ready',
              `${topNewTier.badgeIcon} ${
                langRef.current === 'zh'
                  ? topNewTier.nameZh
                  : topNewTier.nameEn
              } (+${liveMastery.genesAwarded}🧬)`,
              '#fde047',
              1.35
            );
          }
          if (liveMastery.updatedSave !== curSave || activeSave !== curSave) {
            activeSave = liveMastery.updatedSave;
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
          const upgGeneCost = getSharkUpgradeGeneCost(activeForm, activeUpg);
          const currentDepthMeters = Math.round(worldYToMeterDepth(shark.y));
          const currentZone = getDepthZone(currentDepthMeters);
          const hudHeat = computeHuntingHeatBuff(shark.score, activeForm.row);

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
            canBreakthroughNow: Boolean(nextEval?.canUnlockNow),
            canUpgradeBodyNow:
              !shark.trialActive &&
              activeUpg < 10 &&
              activeSave.bankedCoins >= upgCost &&
              activeSave.bankedGenes >= upgGeneCost,
            bodyUpgradeCost: upgCost,
            bodyUpgradeGeneCost: upgGeneCost,
            heatLevel: hudHeat.heatLevel,
            masteryCrownTier: liveMastery.newCrownTier,
          });
          setLiveActivePreyCount(sim.preyList.length);
        }
      }
}
