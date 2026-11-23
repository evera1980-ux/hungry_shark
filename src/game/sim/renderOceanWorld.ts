import { GAME_CONFIG } from '../config';
import { Lang, translate } from '../i18n';
import { spriteSheetManager } from '../spriteSheetManager';
import {
  drawOffScreenRadarIndicators,
  drawPreyEntity,
  drawSharkWithOrgans,
} from '../canvasRenderer';
import { parallaxBackground } from '../parallaxBackground';
import {
  engineXToWorldX,
  getWorldDebugEnabled,
  renderPhysicalSeabed,
  worldChunkLifecycleManager,
  worldDebug,
  worldPersistence,
  worldRenderer,
} from '../worldGenerationSystem';
import { infiniteWorldManager } from '../infiniteWorldManager';
import { GameState, SharkSimState } from './types';

export interface RenderOceanWorldParams {
  ctx: CanvasRenderingContext2D;
  sim: SharkSimState;
  dt: number;
  now: number;
  viewW: number;
  viewH: number;
  scaleX: number;
  scaleY: number;
  aspectZoomFactor: number;
  lang: Lang;
  gameState: GameState;
}

/**
 * Pure Canvas 2D world frame renderer extracted from App.tsx.
 * Draws 5-layer depth parallax, physical seabed + terraces, active chunk flora/POIs,
 * prey entities, player shark, zero-GC particles/pickups/float texts, radar indicators, and debug grid.
 */
export function renderOceanWorld(params: RenderOceanWorldParams): void {
  const {
    ctx,
    sim,
    dt,
    now,
    viewW,
    viewH,
    scaleX,
    scaleY,
    aspectZoomFactor,
    lang,
    gameState,
  } = params;
  const shark = sim.shark;

      // ==================== 2. RENDER OCEAN WORLD ====================
      const renderZoom = sim.camera.zoom * aspectZoomFactor;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.scale(scaleX, scaleY);

      // 5-Layer Multi-Plane Depth-Continuous Ocean Environment (with Far/Mid/Near optical growth shrinking)
      parallaxBackground.render(
        ctx,
        sim.camera.x,
        shark.y,
        viewW,
        viewH,
        now,
        dt,
        sim.camera.y,
        renderZoom,
        shark.stats.relativePreyScale
      );

      // Camera transform with trauma-squared screen shake
      const shakeMag =
        shark.cameraShakeTrauma * shark.cameraShakeTrauma * 18;
      const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
      const shakeY = (Math.random() - 0.5) * 2 * shakeMag;

      ctx.translate(viewW / 2 + shakeX, viewH / 2 + shakeY);
      ctx.scale(renderZoom, renderZoom);
      ctx.translate(-sim.camera.x, -sim.camera.y);

      const cullMargin = 115 / renderZoom;
      const minX = sim.camera.x - viewW / (2 * renderZoom) - cullMargin;
      const maxX = sim.camera.x + viewW / (2 * renderZoom) + cullMargin;
      const minY = sim.camera.y - viewH / (2 * renderZoom) - cullMargin;
      const maxY = sim.camera.y + viewH / (2 * renderZoom) + cullMargin;

      const halfSpanX = Math.ceil(viewW / Math.max(0.35, renderZoom) * 0.55) + 180;
      const surfStart = Math.floor((sim.camera.x - halfSpanX) / 120) * 120;
      const surfEnd = Math.ceil((sim.camera.x + halfSpanX) / 120) * 120;

      // Organic Thermocline Shimmer Wave at Ecological Depth Boundaries (only drawn when in viewport!)
      for (const z of GAME_CONFIG.zones) {
        if (z.minDepth > 0 && z.minDepth >= minY - 36 && z.minDepth <= maxY + 36) {
          const isAbyssBoundary = z.minDepth >= 1000;
          const thermGrad = ctx.createLinearGradient(
            0,
            z.minDepth - 24,
            0,
            z.minDepth + 24
          );
          thermGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
          thermGrad.addColorStop(
            0.5,
            isAbyssBoundary
              ? 'rgba(139, 92, 246, 0.09)'
              : 'rgba(56, 189, 248, 0.08)'
          );
          thermGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = thermGrad;
          ctx.fillRect(surfStart, z.minDepth - 24, surfEnd - surfStart, 48);

          ctx.strokeStyle = isAbyssBoundary
            ? 'rgba(167, 139, 250, 0.14)'
            : 'rgba(125, 211, 252, 0.14)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let wx = surfStart; wx <= surfEnd; wx += 80) {
            const wy =
              z.minDepth + Math.sin(wx * 0.008 + now * 0.0015) * 6;
            if (wx === surfStart) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        }
      }

      // 阶段 B：渲染 1.0x 世界层连续可碰撞海床（与 resolveSeabedCollision / getFloorDepthAt 严格同源，且随鲨鱼成长按 relativePreyScale 同步缩小）
      const smoothedSeabedScale =
        parallaxBackground.getSmoothedRelativePreyScale();
      renderPhysicalSeabed(ctx, {
        cameraEngineX: sim.camera.x,
        cameraEngineY: sim.camera.y,
        viewW,
        viewH,
        renderZoom,
        relativePreyScale: smoothedSeabedScale,
      });

      // 阶段 E/F/G：更新 2D Chunk 生命周期窗口（方向性预加载 + 帧预算 2ms + Active 上限 10）并渲染 1.0x 世界层激活态 POI 与海床生态物
      worldPersistence.setPlayerPosition(
        engineXToWorldX(shark.x),
        shark.y
      );
      const clampedWorldSeabedScale = Math.max(0.06, Math.min(1.0, smoothedSeabedScale));
      const chunkHalfW = viewW / (2 * renderZoom * clampedWorldSeabedScale) + cullMargin;
      const chunkHalfH = viewH / (2 * renderZoom * clampedWorldSeabedScale) + cullMargin;
      const { activeChunks } = worldChunkLifecycleManager.updateForViewport(
        {
          minWorldX: engineXToWorldX(sim.camera.x - chunkHalfW),
          maxWorldX: engineXToWorldX(sim.camera.x + chunkHalfW),
          minWorldY: sim.camera.y - chunkHalfH,
          maxWorldY: sim.camera.y + chunkHalfH,
        },
        shark.vx
      );
      worldRenderer.renderActiveChunkEntities(
        ctx,
        {
          cameraEngineX: sim.camera.x,
          cameraEngineY: sim.camera.y,
          viewW,
          viewH,
          renderZoom,
          nowMs: now,
          relativePreyScale: smoothedSeabedScale,
        },
        activeChunks
      );

      // Render 3D Spinning Gold Coins & Faceted DNA Crystals using sliced UI Icon Atlas sprites (scaled in equal proportion with world)
      const coinSprite = spriteSheetManager.getUiIconFrame('UI_ICON_COIN');
      const geneSprite = spriteSheetManager.getUiIconFrame('UI_ICON_GENE');
      const pickupVisualScale = Math.max(0.18, Math.min(1.0, smoothedSeabedScale * 1.25));
      const preyCullHalfW = (viewW * 0.5) / (renderZoom * clampedWorldSeabedScale) + 120;
      const preyCullHalfH = (viewH * 0.5) / (renderZoom * clampedWorldSeabedScale) + 120;
      for (const pk of sim.pickups) {
        if (
          !pk.active ||
          Math.abs(pk.x - sim.camera.x) > preyCullHalfW ||
          Math.abs(pk.y - sim.camera.y) > preyCullHalfH
        ) {
          continue;
        }
        ctx.save();
        const bobY = Math.sin(pk.phase) * 3.5;
        // 投影至微缩世界层空间，与海床 100% 相对静止，消除冲刺漂移
        const effPkX = sim.camera.x + (pk.x - sim.camera.x) * smoothedSeabedScale;
        const effPkY = sim.camera.y + (pk.y - sim.camera.y) * smoothedSeabedScale;
        ctx.translate(effPkX, effPkY + bobY);
        ctx.scale(pickupVisualScale, pickupVisualScale);

        if (pk.kind === 'COIN') {
          const spinScaleX = 0.55 + Math.abs(Math.cos(pk.phase * 0.85)) * 0.45;
          ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.scale(spinScaleX, 1);
          if (coinSprite) {
            ctx.drawImage(coinSprite, -13, -13, 26, 26);
          } else {
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else {
          const rot = Math.sin(pk.phase * 0.6) * 0.22;
          ctx.rotate(rot);

          ctx.fillStyle = 'rgba(52, 211, 153, 0.24)';
          ctx.beginPath();
          ctx.arc(0, 0, 17, 0, Math.PI * 2);
          ctx.fill();

          if (geneSprite) {
            ctx.drawImage(geneSprite, -14, -14, 28, 28);
          } else {
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
          }
        }
        ctx.restore();
      }

      // Render Prey Entities within camera frustum
      const isBoosting =
        (sim.input.boostPointerHeld ||
          sim.input.rightMouseBoostHeld ||
          sim.input.keys.has('Space')) &&
        (shark.energy > 2 || shark.frenzyTimer > 0);

      for (const prey of sim.preyList) {
        if (
          Math.abs(prey.x - sim.camera.x) <= preyCullHalfW &&
          Math.abs(prey.y - sim.camera.y) <= preyCullHalfH
        ) {
          // 统一微缩空间投影：猎物与海床严格共用 (camera + (world - camera) * scale) 几何空间，彻底消除冲刺时相对海床的逆流后移
          const effPreyX = sim.camera.x + (prey.x - sim.camera.x) * smoothedSeabedScale;
          const effPreyY = sim.camera.y + (prey.y - sim.camera.y) * smoothedSeabedScale;
          const visualPrey = { ...prey, x: effPreyX, y: effPreyY };
          drawPreyEntity(
            ctx,
            visualPrey,
            shark.stats.normalBiteTier ?? shark.stats.biteTier,
            shark.frenzyTimer > 0,
            sim.targetBounty.preyConfig.id,
            isBoosting,
            shark.stats.relativePreyScale,
            shark.stats.scale,
            Boolean(shark.stats.canEatMines),
            shark.stats.realBodyLengthM ?? 1.5
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
        turnRate: shark.turnRate,
        facingScaleX: shark.facingScaleX,
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
        const effFtX = sim.camera.x + (ft.x - sim.camera.x) * smoothedSeabedScale;
        const effFtY = sim.camera.y + (ft.y - sim.camera.y) * smoothedSeabedScale;
        ctx.translate(effFtX, effFtY);
        ctx.scale(ft.scale, ft.scale);
        ctx.font = '800 16px "Outfit", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.lineWidth = 4;
        const label = `${translate(ft.textKey, lang)} ${ft.bonusText}`;
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = ft.color;
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // Render Stage-A WorldDebug 2D Chunk Bounds Overlay when enabled (default false in production)
      if (worldDebug.isEnabled()) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        worldDebug.drawChunkBounds(ctx, {
          cameraEngineX: sim.camera.x,
          cameraEngineY: sim.camera.y,
          playerEngineX: shark.x,
          playerEngineY: shark.y,
          viewW,
          viewH,
          renderZoom,
        });
        ctx.restore();
      }

      // Render Screen-Space Off-Screen Radar Indicators (P1-2: 🎯 Bounty / ★ Golden / ⚠️ Apex Predator)
      if (gameState === 'playing') {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        drawOffScreenRadarIndicators(
          ctx,
          sim.preyList,
          { ...sim.camera, zoom: renderZoom },
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
        gameState === 'playing' &&
        sim.input.canvasPointerActive &&
        !sim.input.joyActive
      ) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        const px = sim.input.canvasPointerX;
        const py = sim.input.canvasPointerY;
        const sharkScreenX =
          viewW / 2 + (shark.x - sim.camera.x) * renderZoom;
        const sharkScreenY =
          viewH / 2 + (shark.y - sim.camera.y) * renderZoom;

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
}
