import { worldYToMeterDepth } from '../rules';
import {
  WorldConfig,
  WorldConfigType,
  WORLD_UNITS_PER_METER,
  engineXToWorldX,
  engineYToWorldY,
  worldXToEngineX,
  worldYToEngineY,
  engineCoordToWorldCoord,
  worldToChunkCoord,
  getChunkBounds,
  getVisibleChunkRange,
} from './worldCore';
import {
  getFloorDepthAt,
  getTerrainSlopeAt,
  getTerrainSamples,
} from './terrainSystem';
import {
  DEPTH_BAND_CONFIGS,
  getMacroBiomeForIndex,
  getBiomeAt,
  getDepthVisualProfile,
} from './biomeSystem';
import {
  EcologyObjectType,
  ECOLOGY_OBJECT_CONFIGS,
  generateChunk,
} from './ecologyAndPoi';
import { worldObjectPool } from './chunkStateAndPersistence';
import { worldChunkLifecycleManager } from './chunkLifecycleManager';

/**
 * 规范第 13 & 15 节：WorldDebug 调试叠层模块（阶段 A：drawChunkBounds）
 * 发布版默认关闭（enabled = false），可在调试面板中一键切换。
 */
export class WorldDebug {
  public enabled: boolean = false;
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 在屏幕空间绘制二维 Chunk 网格边界、Chunk ID、左闭右开坐标区间、海面/海底边界与玩家/相机实时坐标遥测
   */
  public drawChunkBounds(
    ctx: CanvasRenderingContext2D,
    params: {
      cameraEngineX: number;
      cameraEngineY: number;
      playerEngineX: number;
      playerEngineY: number;
      viewW: number;
      viewH: number;
      renderZoom: number;
    }
  ): void {
    if (!this.enabled) return;

    const {
      cameraEngineX,
      cameraEngineY,
      playerEngineX,
      playerEngineY,
      viewW,
      viewH,
      renderZoom,
    } = params;
    const zoom = Math.max(0.25, renderZoom);

    // 1. 通过适配层将引擎米制坐标转换为《v1.0 规范》世界坐标 (1m = 10 worldPx)
    const camWorld = engineCoordToWorldCoord(cameraEngineX, cameraEngineY);
    const playerWorld = engineCoordToWorldCoord(playerEngineX, playerEngineY);
    const viewWorldW = (viewW / zoom) * WORLD_UNITS_PER_METER;
    const viewWorldH = (viewH / zoom) * WORLD_UNITS_PER_METER;

    const cameraWorldRect = {
      x: camWorld.worldX - viewWorldW * 0.5,
      y: camWorld.worldY - viewWorldH * 0.5,
      width: viewWorldW,
      height: viewWorldH,
    };

    const visibleRange = getVisibleChunkRange(cameraWorldRect, this.config);
    const playerChunk = worldToChunkCoord(playerWorld.worldX, playerWorld.worldY, this.config);

    // 世界坐标 -> 屏幕像素坐标转换器
    const worldXToScreenX = (wx: number): number =>
      viewW * 0.5 + (wx / WORLD_UNITS_PER_METER - cameraEngineX) * zoom;
    const worldYToScreenY = (wy: number): number =>
      viewH * 0.5 + (wy / WORLD_UNITS_PER_METER - cameraEngineY) * zoom;

    ctx.save();

    // 2. 绘制可见及外扩 1 圈的二维 Chunk 网格 [startX, endX) × [startY, endY)
    const minCy = Math.max(0, visibleRange.minChunkY - 1);
    const maxCy = Math.min(
      Math.floor((this.config.bounds.maxDepth - 1e-6) / this.config.chunk.height),
      visibleRange.maxChunkY + 1
    );

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = visibleRange.minChunkX - 1; cx <= visibleRange.maxChunkX + 1; cx++) {
        const bounds = getChunkBounds(cx, cy, this.config);
        const sx0 = worldXToScreenX(bounds.startX);
        const sx1 = worldXToScreenX(bounds.endX);
        const sy0 = worldYToScreenY(bounds.startY);
        const sy1 = worldYToScreenY(bounds.endY);
        const sw = sx1 - sx0;
        const sh = sy1 - sy0;

        if (sx1 < -40 || sx0 > viewW + 40 || sy1 < -40 || sy0 > viewH + 40) {
          continue;
        }

        const isPlayerChunk =
          bounds.chunkX === playerChunk.chunkX && bounds.chunkY === playerChunk.chunkY;
        const isVisibleChunk =
          bounds.chunkX >= visibleRange.minChunkX &&
          bounds.chunkX <= visibleRange.maxChunkX &&
          bounds.chunkY >= visibleRange.minChunkY &&
          bounds.chunkY <= visibleRange.maxChunkY;

        ctx.strokeStyle = isPlayerChunk
          ? 'rgba(52, 211, 153, 0.92)'
          : isVisibleChunk
          ? 'rgba(56, 189, 248, 0.65)'
          : 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = isPlayerChunk ? 2.2 : 1.25;
        ctx.setLineDash(isPlayerChunk ? [] : [6, 4]);
        ctx.strokeRect(sx0, sy0, sw, sh);

        // Chunk 标签背景与文字
        const labelX = Math.max(8, Math.min(viewW - 190, sx0 + 8));
        const labelY = Math.max(54, Math.min(viewH - 36, sy0 + 8));
        if (labelX >= sx0 && labelX + 165 <= sx1 && labelY >= sy0 && labelY + 34 <= sy1) {
          ctx.fillStyle = isPlayerChunk
            ? 'rgba(6, 78, 59, 0.82)'
            : 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(labelX, labelY, 178, 34);
          ctx.fillStyle = isPlayerChunk ? '#6ee7b7' : '#7dd3fc';
          ctx.font = '700 11px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            `Chunk ${bounds.chunkId}${isPlayerChunk ? ' [PLAYER]' : ''}`,
            labelX + 6,
            labelY + 13
          );
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '500 9.5px monospace';
          ctx.fillText(
            `X:[${bounds.startX},${bounds.endX}) Y:[${bounds.startY},${bounds.endY})`,
            labelX + 6,
            labelY + 27
          );
        }
      }
    }

    // 3. 绘制海面边界 (Y = 0) 与海底边界 (Y = maxDepth = 20000)
    ctx.setLineDash([10, 6]);
    const seaSurfaceScreenY = worldYToScreenY(this.config.bounds.minDepth);
    if (seaSurfaceScreenY >= -20 && seaSurfaceScreenY <= viewH + 20) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, seaSurfaceScreenY);
      ctx.lineTo(viewW, seaSurfaceScreenY);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px monospace';
      ctx.fillText(`SEA SURFACE (worldY = ${this.config.bounds.minDepth})`, 14, seaSurfaceScreenY - 6);
    }

    const maxDepthScreenY = worldYToScreenY(this.config.bounds.maxDepth);
    if (maxDepthScreenY >= -20 && maxDepthScreenY <= viewH + 20) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, maxDepthScreenY);
      ctx.lineTo(viewW, maxDepthScreenY);
      ctx.stroke();
      ctx.fillStyle = '#fda4af';
      ctx.font = '700 11px monospace';
      ctx.fillText(`MAX DEPTH BOUNDARY (worldY = ${this.config.bounds.maxDepth})`, 14, maxDepthScreenY - 8);
    }

    // 3.5 [Stage-B] 绘制 1.0x 连续海床采样曲线与 Chunk 接缝采样节点 (getTerrainSamples)
    ctx.setLineDash([]);
    for (let cx = visibleRange.minChunkX - 1; cx <= visibleRange.maxChunkX + 1; cx++) {
      const samples = getTerrainSamples(cx, this.config);
      if (samples.points.length === 0) continue;

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.95)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < samples.points.length; i++) {
        const pt = samples.points[i];
        const sx = worldXToScreenX(pt.worldX);
        const sy = worldYToScreenY(pt.floorY);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // 绘制采样点与 Chunk 边界接缝点
      for (let i = 0; i < samples.points.length; i++) {
        const pt = samples.points[i];
        const sx = worldXToScreenX(pt.worldX);
        const sy = worldYToScreenY(pt.floorY);
        if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;
        const isSeamNode = i === 0 || i === samples.points.length - 1;
        ctx.fillStyle = isSeamNode ? '#fde047' : '#34d399';
        ctx.beginPath();
        ctx.arc(sx, sy, isSeamNode ? 4.2 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3.8 [Stage-C] 绘制水平宏观生态区边界/过渡带 (macroWidth=30000, transitionWidth=6000) 与垂直 5 大深度带分界线
    const macroW = this.config.biome.macroWidth;
    const halfTransW = this.config.biome.transitionWidth * 0.5;
    const minMacroIdx = Math.floor(cameraWorldRect.x / macroW);
    const maxMacroIdx = Math.floor((cameraWorldRect.x + cameraWorldRect.width) / macroW) + 1;

    for (let mIdx = minMacroIdx; mIdx <= maxMacroIdx; mIdx++) {
      const boundaryWorldX = mIdx * macroW;
      const transLeftX = boundaryWorldX - halfTransW;
      const transRightX = boundaryWorldX + halfTransW;

      const bxScreen = worldXToScreenX(boundaryWorldX);
      const tlScreen = worldXToScreenX(transLeftX);
      const trScreen = worldXToScreenX(transRightX);

      // 绘制过渡带半透明背景阴影
      if (trScreen >= 0 && tlScreen <= viewW) {
        const clipLeft = Math.max(0, tlScreen);
        const clipRight = Math.min(viewW, trScreen);
        if (clipRight > clipLeft) {
          ctx.fillStyle = 'rgba(192, 132, 252, 0.07)';
          ctx.fillRect(clipLeft, 0, clipRight - clipLeft, viewH);
        }
      }

      // 绘制宏区中心分界线
      if (bxScreen >= -20 && bxScreen <= viewW + 20) {
        ctx.setLineDash([12, 6]);
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bxScreen, 0);
        ctx.lineTo(bxScreen, viewH);
        ctx.stroke();

        const leftBiome = getMacroBiomeForIndex(mIdx - 1, this.config);
        const rightBiome = getMacroBiomeForIndex(mIdx, this.config);
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '700 10.5px monospace';
        ctx.fillText(
          `MACRO BOUNDARY X=${boundaryWorldX} (${leftBiome} <-> ${rightBiome})`,
          Math.min(viewW - 280, Math.max(12, bxScreen + 6)),
          44
        );
      }
    }

    // 绘制垂直 5 大深度带边界线 (2000, 6000, 10000, 16000)
    ctx.setLineDash([4, 6]);
    for (const band of DEPTH_BAND_CONFIGS) {
      if (band.minDepth <= 0) continue;
      const byScreen = worldYToScreenY(band.minDepth);
      if (byScreen >= -20 && byScreen <= viewH + 20) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, byScreen);
        ctx.lineTo(viewW, byScreen);
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.font = '600 10px monospace';
        ctx.fillText(
          `DEPTH BAND: ${band.id} (worldY >= ${band.minDepth})`,
          14,
          byScreen - 5
        );
      }
    }

    // 3.9 [Stage-D] 绘制可见二维 Chunk 内的生态对象点位/ID 与 POI 占地半径/owner
    const renderedPoiIds = new Set<string>();
    let visibleEcologyObjCount = 0;
    let visiblePoiCount = 0;

    for (let cy = visibleRange.minChunkY; cy <= visibleRange.maxChunkY; cy++) {
      for (let cx = visibleRange.minChunkX; cx <= visibleRange.maxChunkX; cx++) {
        const chunkData = generateChunk(cx, cy, this.config);
        visibleEcologyObjCount += chunkData.objects.length;

        // 绘制当前 Chunk 归属的生态对象点位
        for (let i = 0; i < chunkData.objects.length; i++) {
          const obj = chunkData.objects[i];
          if (obj.state?.isPOI) continue;
          const sx = worldXToScreenX(obj.worldX);
          const sy = worldYToScreenY(obj.worldY);
          if (sx < -24 || sx > viewW + 24 || sy < -24 || sy > viewH + 24) continue;

          const objCfg = ECOLOGY_OBJECT_CONFIGS[obj.type as EcologyObjectType];
          const color =
            objCfg?.category === 'flora'
              ? '#4ade80'
              : objCfg?.category === 'fauna'
              ? '#38bdf8'
              : objCfg?.category === 'terrain_detail'
              ? '#fbbf24'
              : '#c084fc';

          ctx.setLineDash([]);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
          ctx.fill();

          if (i % 3 === 0) {
            ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
            ctx.fillRect(sx + 5, sy - 8, 92, 13);
            ctx.fillStyle = color;
            ctx.font = '600 8.5px monospace';
            ctx.fillText(`${obj.type}#${obj.seedKey.slice(-4)}`, sx + 7, sy + 1);
          }
        }

        // 绘制当前 Chunk 归属或跨界覆盖的 POI 占地半径与 ownerChunkId
        const allChunkPois = [...chunkData.pois, ...chunkData.overlappingPOIs];
        for (const poi of allChunkPois) {
          if (renderedPoiIds.has(poi.id)) continue;
          renderedPoiIds.add(poi.id);
          visiblePoiCount++;

          const sx = worldXToScreenX(poi.worldX);
          const sy = worldYToScreenY(poi.worldY);
          const sr = (poi.footprintRadius / WORLD_UNITS_PER_METER) * zoom;
          if (sx + sr < -40 || sx - sr > viewW + 40 || sy + sr < -40 || sy - sr > viewH + 40) {
            continue;
          }

          ctx.setLineDash([8, 4]);
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(8, sr), 0, Math.PI * 2);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
          ctx.fillRect(sx - 78, sy - 26, 156, 20);
          ctx.fillStyle = '#fed7aa';
          ctx.font = '700 9.5px monospace';
          ctx.fillText(`POI:${poi.type} [Owner ${poi.ownerChunkId}]`, sx - 74, sy - 13);
        }
      }
    }

    // 4. 绘制屏幕右上角阶段 A~G 规范遥测 HUD 浮层
    const playerFloorY = getFloorDepthAt(playerWorld.worldX, this.config);
    const playerSlope = getTerrainSlopeAt(playerWorld.worldX, this.config);
    const playerBiomeSample = getBiomeAt(playerWorld.worldX, playerWorld.worldY, this.config);
    const playerVisualProfile = getDepthVisualProfile(playerWorld.worldY, this.config);
    const playerChunkGenerated = generateChunk(playerChunk.chunkX, playerChunk.chunkY, this.config);
    const mgrStats = worldChunkLifecycleManager.getStats();
    const poolStats = worldObjectPool.getStats();
    const playerChunkState = worldChunkLifecycleManager.getChunkState(
      playerChunk.chunkX,
      playerChunk.chunkY
    );
    ctx.setLineDash([]);
    const panelW = 352;
    const panelH = 206;
    const px = viewW - panelW - 12;
    const py = 58;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px, py, panelW, panelH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `[WorldDebug Stage-G (A-G)] Seed=${this.config.worldSeed} v${this.config.generatorVersion}`,
      px + 8,
      py + 16
    );
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 10.5px monospace';
    ctx.fillText(
      `Player World: X=${Math.round(playerWorld.worldX)} Y=${Math.round(playerWorld.worldY)}`,
      px + 8,
      py + 32
    );
    ctx.fillText(
      `Camera World: X=${Math.round(camWorld.worldX)} Y=${Math.round(camWorld.worldY)}`,
      px + 8,
      py + 47
    );
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(
      `Player Chunk: ${playerChunk.chunkId} [${playerChunkState.toUpperCase()}] (${this.config.chunk.width}x${this.config.chunk.height})`,
      px + 8,
      py + 62
    );
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(
      `Visible 2D Chunks (${visibleRange.chunkCoords.length}): [${visibleRange.minChunkX}..${visibleRange.maxChunkX}]x[${visibleRange.minChunkY}..${visibleRange.maxChunkY}]`,
      px + 8,
      py + 77
    );
    ctx.fillStyle = '#fde047';
    ctx.fillText(
      `Seabed floorY(X)=${Math.round(playerFloorY)} (${Math.round(worldYToMeterDepth(playerFloorY))}m) | slope=${playerSlope.toFixed(3)}`,
      px + 8,
      py + 92
    );
    ctx.fillStyle = '#e9d5ff';
    const secLabel = playerBiomeSample.secondaryBiome
      ? ` -> ${playerBiomeSample.secondaryBiome} (${playerBiomeSample.blend.toFixed(2)})`
      : ' (core 1.00)';
    ctx.fillText(
      `Biome[M${playerBiomeSample.macroIndex}]: ${playerBiomeSample.primaryBiome}${secLabel}`,
      px + 8,
      py + 108
    );
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(
      `DepthBand: ${playerBiomeSample.depthBand} | Bright=${playerVisualProfile.brightness.toFixed(2)} | Biolum=${playerVisualProfile.bioluminescenceRatio.toFixed(2)}`,
      px + 8,
      py + 124
    );
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `LightShaft=${playerVisualProfile.lightShaftIntensity.toFixed(2)} | Vis=${Math.round(playerVisualProfile.visibilityDistance)} | Tint=${playerVisualProfile.waterTintHex}`,
      px + 8,
      py + 140
    );
    ctx.fillStyle = '#fdba74';
    ctx.fillText(
      `Chunk Objects=${playerChunkGenerated.objects.length} (Vis=${visibleEcologyObjCount}) | POIs=${playerChunkGenerated.pois.length} (Vis=${visiblePoiCount})`,
      px + 8,
      py + 156
    );
    ctx.fillStyle = '#86efac';
    ctx.fillText(
      `ActiveChunks=${mgrStats.activeChunkCount}/${mgrStats.maxActiveChunks} | Cache=${mgrStats.cachedChunkCount}/${mgrStats.maxCachedChunkRecords} | Queue=${mgrStats.queueLength}/${mgrStats.maxQueueSize}`,
      px + 8,
      py + 172
    );
    ctx.fillStyle = '#f9a8d4';
    ctx.fillText(
      `Pool Active=${poolStats.totalActiveInstances} Idle=${poolStats.totalPooledInstances} | Gen=${mgrStats.lastFrameGenMs.toFixed(2)}ms`,
      px + 8,
      py + 188
    );

    ctx.restore();
  }
}

export const worldDebug = new WorldDebug(WorldConfig);

let worldDebugEnabledState = false;
export function getWorldDebugEnabled(): boolean {
  return worldDebugEnabledState;
}
export function setWorldDebugEnabled(enabled: boolean): void {
  worldDebugEnabledState = Boolean(enabled);
  worldDebug.setEnabled(worldDebugEnabledState);
}
