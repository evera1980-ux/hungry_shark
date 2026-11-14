/**
 * 海底程序化世界生成系统 (Procedural Ocean World Generation System)
 * 严格遵循《无限横向海洋地图：程序化生成与开发实施规范 v1.0》分阶段架构（阶段 A -> G）
 * 以及「宏观规划 (L0) + 连续地形生成 (L1) + 地貌结构模板/SDF (L2) + 聚集式 Poisson Disk 生态群落与细节 (L3) + 游戏性约束」。
 */

import { quinticSmoothstep } from './rules';

// ============================================================================
// 阶段 A（规范第 2、3、13、14-A、15 节）：集中配置 WorldConfig、坐标与二维 Chunk 基础、WorldDebug
// ============================================================================

/**
 * 规范第 3 节：集中配置（默认初始值）
 * 所有参数集中管理，不得散落魔法数字。
 */
export const WorldConfig = {
  worldSeed: 123456789,
  generatorVersion: 1,
  bounds: { minDepth: 0, maxDepth: 20000, infiniteHorizontal: true },
  chunk: { width: 3000, height: 1500, preloadAhead: 4, retainBehind: 2, maxActiveChunks: 10 },
  biome: { macroWidth: 30000, transitionWidth: 6000 },
  terrain: {
    sampleStepX: 100,
    baseFloorDepth: 10100,
    largeWaveAmplitude: 9600,
    mediumWaveAmplitude: 3800,
    smallWaveAmplitude: 720,
    minFloorDepth: 420,
    maxFloorDepth: 19800,
  },
  generation: { staticObjectsPerChunkTarget: 24, minObjectSpacing: 120, deterministic: true },
  rendering: { backgroundParallax: [0.08, 0.18, 0.35], terrainParallax: 1.0 },
  performance: {
    generationBudgetMsPerFrame: 2,
    maxCachedChunkRecords: 64,
    maxPooledObjectsPerType: 300,
    maxQueueSize: 32,
  },
} as const;

export interface WorldConfigType {
  worldSeed: number;
  generatorVersion: number;
  bounds: {
    minDepth: number;
    maxDepth: number;
    infiniteHorizontal: boolean;
  };
  chunk: {
    width: number;
    height: number;
    preloadAhead: number;
    retainBehind: number;
    maxActiveChunks: number;
  };
  biome: {
    macroWidth: number;
    transitionWidth: number;
  };
  terrain: {
    sampleStepX: number;
    baseFloorDepth: number;
    largeWaveAmplitude: number;
    mediumWaveAmplitude: number;
    smallWaveAmplitude: number;
    minFloorDepth: number;
    maxFloorDepth: number;
  };
  generation: {
    staticObjectsPerChunkTarget: number;
    minObjectSpacing: number;
    deterministic: boolean;
  };
  rendering: {
    backgroundParallax: readonly number[];
    terrainParallax: number;
  };
  performance: {
    generationBudgetMsPerFrame: number;
    maxCachedChunkRecords: number;
    maxPooledObjectsPerType: number;
    maxQueueSize: number;
  };
}

/**
 * 规范第 3 节：启动时校验配置范围、正数、深度边界等；非法配置报明确错误。
 */
export function validateWorldConfig(config: WorldConfigType = WorldConfig): true {
  if (!config || typeof config !== 'object') {
    throw new Error('[WorldConfig] Configuration object is required.');
  }
  if (!Number.isFinite(config.worldSeed)) {
    throw new Error('[WorldConfig] worldSeed must be a finite number.');
  }
  if (!Number.isInteger(config.generatorVersion) || config.generatorVersion < 1) {
    throw new Error('[WorldConfig] generatorVersion must be a positive integer >= 1.');
  }

  // Bounds validation
  const { bounds } = config;
  if (!bounds || !Number.isFinite(bounds.minDepth) || !Number.isFinite(bounds.maxDepth)) {
    throw new Error('[WorldConfig] bounds.minDepth and bounds.maxDepth must be finite numbers.');
  }
  if (bounds.minDepth < 0) {
    throw new Error('[WorldConfig] bounds.minDepth must be >= 0 (sea surface Y = 0).');
  }
  if (bounds.maxDepth <= bounds.minDepth) {
    throw new Error('[WorldConfig] bounds.maxDepth must be strictly greater than bounds.minDepth.');
  }
  if (bounds.infiniteHorizontal !== true) {
    throw new Error('[WorldConfig] bounds.infiniteHorizontal must be true for infinite X ocean map.');
  }

  // Chunk validation
  const { chunk } = config;
  if (!chunk || !Number.isFinite(chunk.width) || chunk.width <= 0) {
    throw new Error('[WorldConfig] chunk.width must be a positive number > 0.');
  }
  if (!Number.isFinite(chunk.height) || chunk.height <= 0) {
    throw new Error('[WorldConfig] chunk.height must be a positive number > 0.');
  }
  if (!Number.isInteger(chunk.preloadAhead) || chunk.preloadAhead < 0) {
    throw new Error('[WorldConfig] chunk.preloadAhead must be an integer >= 0.');
  }
  if (!Number.isInteger(chunk.retainBehind) || chunk.retainBehind < 0) {
    throw new Error('[WorldConfig] chunk.retainBehind must be an integer >= 0.');
  }
  if (!Number.isInteger(chunk.maxActiveChunks) || chunk.maxActiveChunks < 1) {
    throw new Error('[WorldConfig] chunk.maxActiveChunks must be an integer >= 1.');
  }

  // Biome validation
  const { biome } = config;
  if (!biome || !Number.isFinite(biome.macroWidth) || biome.macroWidth <= 0) {
    throw new Error('[WorldConfig] biome.macroWidth must be a positive number > 0.');
  }
  if (!Number.isFinite(biome.transitionWidth) || biome.transitionWidth < 0) {
    throw new Error('[WorldConfig] biome.transitionWidth must be >= 0.');
  }
  if (biome.transitionWidth >= biome.macroWidth) {
    throw new Error('[WorldConfig] biome.transitionWidth must be strictly less than biome.macroWidth.');
  }

  // Terrain validation
  const { terrain } = config;
  if (!terrain || !Number.isFinite(terrain.sampleStepX) || terrain.sampleStepX <= 0) {
    throw new Error('[WorldConfig] terrain.sampleStepX must be a positive number > 0.');
  }
  if (chunk.width % terrain.sampleStepX !== 0) {
    throw new Error('[WorldConfig] chunk.width must be an exact multiple of terrain.sampleStepX.');
  }
  if (
    !Number.isFinite(terrain.minFloorDepth) ||
    !Number.isFinite(terrain.maxFloorDepth) ||
    terrain.minFloorDepth < bounds.minDepth ||
    terrain.maxFloorDepth > bounds.maxDepth ||
    terrain.minFloorDepth >= terrain.maxFloorDepth
  ) {
    throw new Error(
      '[WorldConfig] terrain.minFloorDepth and terrain.maxFloorDepth must satisfy minDepth <= minFloorDepth < maxFloorDepth <= maxDepth.'
    );
  }
  if (
    !Number.isFinite(terrain.baseFloorDepth) ||
    terrain.baseFloorDepth < terrain.minFloorDepth ||
    terrain.baseFloorDepth > terrain.maxFloorDepth
  ) {
    throw new Error(
      '[WorldConfig] terrain.baseFloorDepth must lie within [minFloorDepth, maxFloorDepth].'
    );
  }
  if (
    terrain.largeWaveAmplitude < 0 ||
    terrain.mediumWaveAmplitude < 0 ||
    terrain.smallWaveAmplitude < 0
  ) {
    throw new Error('[WorldConfig] terrain wave amplitudes must be >= 0.');
  }

  // Generation validation
  const { generation } = config;
  if (
    !generation ||
    !Number.isFinite(generation.staticObjectsPerChunkTarget) ||
    generation.staticObjectsPerChunkTarget < 0
  ) {
    throw new Error('[WorldConfig] generation.staticObjectsPerChunkTarget must be >= 0.');
  }
  if (!Number.isFinite(generation.minObjectSpacing) || generation.minObjectSpacing <= 0) {
    throw new Error('[WorldConfig] generation.minObjectSpacing must be > 0.');
  }

  // Rendering validation
  const { rendering } = config;
  if (
    !rendering ||
    !Array.isArray(rendering.backgroundParallax) ||
    rendering.backgroundParallax.length === 0 ||
    rendering.backgroundParallax.some((p) => !Number.isFinite(p) || p <= 0 || p > 1)
  ) {
    throw new Error(
      '[WorldConfig] rendering.backgroundParallax must be a non-empty array of numbers in (0, 1].'
    );
  }
  if (!Number.isFinite(rendering.terrainParallax) || rendering.terrainParallax <= 0) {
    throw new Error('[WorldConfig] rendering.terrainParallax must be > 0.');
  }

  // Performance validation
  const { performance: perf } = config;
  if (!perf || !Number.isFinite(perf.generationBudgetMsPerFrame) || perf.generationBudgetMsPerFrame <= 0) {
    throw new Error('[WorldConfig] performance.generationBudgetMsPerFrame must be > 0.');
  }
  if (!Number.isInteger(perf.maxCachedChunkRecords) || perf.maxCachedChunkRecords < 1) {
    throw new Error('[WorldConfig] performance.maxCachedChunkRecords must be an integer >= 1.');
  }
  if (!Number.isInteger(perf.maxPooledObjectsPerType) || perf.maxPooledObjectsPerType < 1) {
    throw new Error('[WorldConfig] performance.maxPooledObjectsPerType must be an integer >= 1.');
  }

  return true;
}

// 启动时立即对默认 WorldConfig 执行一次合法性校验
validateWorldConfig(WorldConfig);

/**
 * 规范第 2 节：适配层坐标转换常量
 * 游戏内核心玩法水深上限扩展至 20000m（0m ~ 20,000m），与《v1.0 规范》世界坐标 maxDepth = 20000 完全 1:1 对齐（1m = 1 worldPx），
 * 每个 3000 × 1500 的二维随机 Chunk 精确对应 3000m × 1500m 物理海域。
 */
export const WORLD_UNITS_PER_METER = 1;

export function meterDepthToWorldY(depthMeters: number): number {
  return depthMeters * WORLD_UNITS_PER_METER;
}

export function worldYToMeterDepth(worldY: number): number {
  return worldY / WORLD_UNITS_PER_METER;
}

export function engineXToWorldX(engineX: number): number {
  return engineX * WORLD_UNITS_PER_METER;
}

export function worldXToEngineX(worldX: number): number {
  return worldX / WORLD_UNITS_PER_METER;
}

export function engineCoordToWorldCoord(
  engineX: number,
  engineY: number
): { worldX: number; worldY: number } {
  return {
    worldX: engineX * WORLD_UNITS_PER_METER,
    worldY: engineY * WORLD_UNITS_PER_METER,
  };
}

export function worldCoordToEngineCoord(
  worldX: number,
  worldY: number
): { engineX: number; engineY: number } {
  return {
    engineX: worldX / WORLD_UNITS_PER_METER,
    engineY: worldY / WORLD_UNITS_PER_METER,
  };
}

/**
 * 规范第 2 节：二维 Chunk 索引与左闭右开范围 [startX, endX)、[startY, endY)
 */
export interface ChunkCoord2D {
  chunkX: number;
  chunkY: number;
  chunkId: string;
}

export interface ChunkBounds2D extends ChunkCoord2D {
  /** 左闭起点 X (包含) */
  startX: number;
  /** 右开终点 X (不包含) */
  endX: number;
  /** 左闭起点 Y (包含) */
  startY: number;
  /** 右开终点 Y (不包含) */
  endY: number;
  width: number;
  height: number;
}

export function formatChunkId(chunkX: number, chunkY: number): string {
  // 消除 -0
  const cx = chunkX === 0 ? 0 : chunkX;
  const cy = chunkY === 0 ? 0 : chunkY;
  return `${cx}:${cy}`;
}

export function parseChunkId(chunkId: string): { chunkX: number; chunkY: number } {
  const parts = chunkId.split(':');
  if (parts.length !== 2) {
    throw new Error(`[ChunkCoord] Invalid chunkId format "${chunkId}", expected "chunkX:chunkY".`);
  }
  const chunkX = Number(parts[0]);
  const chunkY = Number(parts[1]);
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
    throw new Error(`[ChunkCoord] Non-integer coordinates in chunkId "${chunkId}".`);
  }
  return {
    chunkX: chunkX === 0 ? 0 : chunkX,
    chunkY: chunkY === 0 ? 0 : chunkY,
  };
}

/**
 * 规范第 2 节公式：
 * chunkX = Math.floor(worldX / chunkWidth);
 * chunkY = Math.floor(worldY / chunkHeight);
 * chunkId = `${chunkX}:${chunkY}`;
 */
export function worldToChunkCoord(
  worldX: number,
  worldY: number,
  config: WorldConfigType = WorldConfig
): ChunkCoord2D {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    throw new Error(`[ChunkCoord] worldX (${worldX}) and worldY (${worldY}) must be finite numbers.`);
  }
  const rawCx = Math.floor(worldX / config.chunk.width);
  const rawCy = Math.floor(worldY / config.chunk.height);
  const chunkX = rawCx === 0 ? 0 : rawCx;
  const chunkY = rawCy === 0 ? 0 : rawCy;
  return {
    chunkX,
    chunkY,
    chunkId: `${chunkX}:${chunkY}`,
  };
}

/**
 * 计算指定 (chunkX, chunkY) 的左闭右开世界坐标包围盒 [startX, endX) × [startY, endY)
 */
export function getChunkBounds(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): ChunkBounds2D {
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
    throw new Error(`[ChunkBounds] chunkX (${chunkX}) and chunkY (${chunkY}) must be integers.`);
  }
  const cx = chunkX === 0 ? 0 : chunkX;
  const cy = chunkY === 0 ? 0 : chunkY;
  const width = config.chunk.width;
  const height = config.chunk.height;
  const startX = cx * width;
  const endX = startX + width;
  const startY = cy * height;
  const endY = startY + height;
  return {
    chunkX: cx,
    chunkY: cy,
    chunkId: `${cx}:${cy}`,
    startX: startX === 0 ? 0 : startX,
    endX: endX === 0 ? 0 : endX,
    startY: startY === 0 ? 0 : startY,
    endY: endY === 0 ? 0 : endY,
    width,
    height,
  };
}

/**
 * 严格左闭右开区间判定：worldX ∈ [startX, endX) 且 worldY ∈ [startY, endY)
 * 保证任意世界坐标点 (worldX, worldY) 唯一归属于且仅归属于一个二维 Chunk！
 */
export function isPointInChunkBounds(
  worldX: number,
  worldY: number,
  bounds: Pick<ChunkBounds2D, 'startX' | 'endX' | 'startY' | 'endY'>
): boolean {
  return (
    worldX >= bounds.startX &&
    worldX < bounds.endX &&
    worldY >= bounds.startY &&
    worldY < bounds.endY
  );
}

/**
 * 将世界垂直深度坐标限制在合法海洋边界 [minDepth, maxDepth] 内
 */
export function clampWorldDepth(
  worldY: number,
  config: WorldConfigType = WorldConfig
): number {
  if (!Number.isFinite(worldY)) return config.bounds.minDepth;
  return Math.max(config.bounds.minDepth, Math.min(config.bounds.maxDepth, worldY));
}

/**
 * 依据世界空间相机可视矩形计算覆盖的二维 Chunk 索引范围
 * 垂直方向严格限制在 [minDepth, maxDepth) 对应的合法行范围内（不越过海面 Y=0 与海底 Y=maxDepth）
 */
export function getVisibleChunkRange(
  cameraWorldRect: { x: number; y: number; width: number; height: number },
  config: WorldConfigType = WorldConfig
): {
  minChunkX: number;
  maxChunkX: number;
  minChunkY: number;
  maxChunkY: number;
  chunkCoords: ChunkCoord2D[];
} {
  const safeW = Math.max(1, cameraWorldRect.width);
  const safeH = Math.max(1, cameraWorldRect.height);
  const leftX = cameraWorldRect.x;
  // 左闭右开：右边界若恰好落在 Chunk 整数倍边界上，最后一点取 leftX + safeW - 1e-6
  const rightX = cameraWorldRect.x + safeW - 1e-6;

  const clampedTopY = Math.max(
    config.bounds.minDepth,
    Math.min(config.bounds.maxDepth - 1e-6, cameraWorldRect.y)
  );
  const clampedBotY = Math.max(
    clampedTopY,
    Math.min(config.bounds.maxDepth - 1e-6, cameraWorldRect.y + safeH - 1e-6)
  );

  const minChunkX = Math.floor(leftX / config.chunk.width);
  const maxChunkX = Math.floor(rightX / config.chunk.width);
  const minChunkY = Math.floor(clampedTopY / config.chunk.height);
  const maxChunkY = Math.floor(clampedBotY / config.chunk.height);

  const chunkCoords: ChunkCoord2D[] = [];
  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const ncx = cx === 0 ? 0 : cx;
      const ncy = cy === 0 ? 0 : cy;
      chunkCoords.push({
        chunkX: ncx,
        chunkY: ncy,
        chunkId: `${ncx}:${ncy}`,
      });
    }
  }

  return {
    minChunkX: minChunkX === 0 ? 0 : minChunkX,
    maxChunkX: maxChunkX === 0 ? 0 : maxChunkX,
    minChunkY: minChunkY === 0 ? 0 : minChunkY,
    maxChunkY: maxChunkY === 0 ? 0 : maxChunkY,
    chunkCoords,
  };
}

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

// ============================================================================
// 阶段 B（规范第 4、6、11、13、14-B 节）：WorldSeedService（随机流隔离与稳定 ID）与连续海床 TerrainGenerator
// ============================================================================

/**
 * 规范第 4.1 节：子系统随机流标识
 * 不同子系统必须用独立随机流（加吃鱼逻辑不能改变宝物或地形生成）。
 */
export type WorldSubsystemKey = 'terrain' | 'flora' | 'fauna' | 'poi' | 'ambient' | (string & {});

/**
 * 确定性字符串 32 位哈希 (FNV-1a 变体 + 雪崩混洗)
 */
export function hashString32(str: string, seed: number = 0x811c9dc5): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * 将 (worldSeed, generatorVersion, chunkX, chunkY, subsystemKey) 混洗为非零 32 位无符号种子
 */
export function mixSubsystemSeed(
  seed: number,
  version: number,
  cx: number,
  cy: number,
  subsystemKey: string
): number {
  if (!Number.isFinite(seed) || !Number.isFinite(version) || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    throw new Error('[WorldSeedService] seed, version, cx, cy must be finite numbers.');
  }
  if (!subsystemKey || typeof subsystemKey !== 'string') {
    throw new Error('[WorldSeedService] subsystemKey must be a non-empty string.');
  }
  const ncx = cx === 0 ? 0 : Math.trunc(cx);
  const ncy = cy === 0 ? 0 : Math.trunc(cy);
  const s0 = Math.trunc(seed) >>> 0;
  const v0 = Math.trunc(version) >>> 0;
  const subHash = hashString32(subsystemKey, s0 ^ Math.imul(v0, 0x9e3779b9));

  let h = (s0 ^ Math.imul(v0, 0x7f4a7c15)) >>> 0;
  h = Math.imul(h ^ (ncx >>> 0), 0x165667b1) >>> 0;
  h = Math.imul(h ^ (ncy >>> 0), 0xd3a2646c) >>> 0;
  h = (h ^ subHash) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) || 0x6d2b79f5;
}

/**
 * 规范第 4.1 & 13 节：创建隔离的 Chunk 子系统确定性随机流
 * 输入必须包含：worldSeed、generatorVersion、chunkX、chunkY、subsystemKey
 * 返回值范围为 [0, 1) 的确定性函数 () => number
 */
export function createChunkRng(
  seed: number,
  version: number,
  cx: number,
  cy: number,
  subsystemKey: WorldSubsystemKey
): () => number {
  let state = mixSubsystemSeed(seed, version, cx, cy, subsystemKey);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 规范第 4.2 & 13 节：稳定对象 ID 生成函数
 * id = hash(worldSeed, generatorVersion, category, chunkX, chunkY, localIndexOrKey)
 * 同一坐标和索引重生成时 ID 完全一致，绝不使用自增计数器或时间戳。
 */
export function createStableId(
  seed: number,
  version: number,
  category: string,
  chunkX: number,
  chunkY: number,
  localIndexOrKey: number | string
): string {
  if (!category || typeof category !== 'string') {
    throw new Error('[WorldSeedService] category must be a non-empty string.');
  }
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
    throw new Error('[WorldSeedService] chunkX and chunkY must be integers.');
  }
  const cx = chunkX === 0 ? 0 : chunkX;
  const cy = chunkY === 0 ? 0 : chunkY;
  const keyStr = String(localIndexOrKey);
  const canonicalPayload = `${Math.trunc(seed)}|v${Math.trunc(version)}|${category}|${cx}:${cy}|${keyStr}`;
  const h1 = hashString32(canonicalPayload, mixSubsystemSeed(seed, version, cx, cy, category));
  const h2 = hashString32(`${keyStr}#${category}`, h1 ^ 0x9e3779b9);
  const hex = `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
  return `${category}_${cx}_${cy}_${keyStr}_${hex}`;
}

/**
 * 规范第 13 节：WorldSeedService 服务类
 */
export class WorldSeedService {
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public getSeed(): number {
    return this.config.worldSeed;
  }

  public getVersion(): number {
    return this.config.generatorVersion;
  }

  public createChunkRng(
    cx: number,
    cy: number,
    subsystemKey: WorldSubsystemKey
  ): () => number {
    return createChunkRng(
      this.config.worldSeed,
      this.config.generatorVersion,
      cx,
      cy,
      subsystemKey
    );
  }

  public createStableId(
    category: string,
    chunkX: number,
    chunkY: number,
    localIndexOrKey: number | string
  ): string {
    return createStableId(
      this.config.worldSeed,
      this.config.generatorVersion,
      category,
      chunkX,
      chunkY,
      localIndexOrKey
    );
  }
}

export const worldSeedService = new WorldSeedService(WorldConfig);

/**
 * 规范第 6 节：连续海床生成常量与参数
 * - 构造带尺度（大陆架 -> 大陆坡 -> 海底大峡谷 -> 2000m+ 超深渊海沟）：节点间距 3000 worldPx (300m)
 * - 中尺度山脊/礁丘波：波长 2200 worldPx (220m)，创造单屏内清晰可见的礁石丘陵与峡谷陡坡
 * - 小尺度岩礁起伏波：波长 680m & 260m，消除任何机械直线感
 * - 最大允许坡度限制：TERRAIN_MAX_SLOPE = 1.65（平缓山顶 + 多阶梯岩台/缓坡/逆坡起伏，告别陡峭直线斜坡）
 */
export const TERRAIN_LARGE_WAVELENGTH = 9600;
export const TERRAIN_MEDIUM_WAVELENGTH = 2400;
export const TERRAIN_SMALL_WAVELENGTH = 680;
export const TERRAIN_MAX_SLOPE = 1.65;

export interface TerrainSamplePoint {
  worldX: number;
  floorY: number;
  slope: number;
  absSlope: number;
}

export interface TerrainChunkSamples {
  chunkX: number;
  startX: number;
  endX: number;
  sampleStepX: number;
  points: TerrainSamplePoint[];
  depths: number[];
  maxAbsSlope: number;
}

/**
 * 基于 (worldSeed, generatorVersion, 'terrain') 的一维晶格哈希值 ∈ [-1, 1]
 */
function terrainLatticeValue(
  latticeIndex: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  const h = mixSubsystemSeed(
    config.worldSeed,
    config.generatorVersion,
    latticeIndex,
    waveSalt,
    'terrain'
  );
  return (h / 4294967296) * 2 - 1;
}

/**
 * 3 点对称平滑晶格值：v_smooth(n) = 0.25*v(n-1) + 0.5*v(n) + 0.25*v(n+1)
 * 数学性质：
 * 1. v_smooth(n) ∈ [-1, 1]
 * 2. 相邻晶格差值 |v_smooth(n+1) - v_smooth(n)| <= 1.0（消除局部突变尖刺）
 * 3. 纯函数，100% 顺序无关且跨 Chunk 连续
 */
function smoothedTerrainLatticeValue(
  latticeIndex: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  const vm1 = terrainLatticeValue(latticeIndex - 1, waveSalt, config);
  const v0 = terrainLatticeValue(latticeIndex, waveSalt, config);
  const vp1 = terrainLatticeValue(latticeIndex + 1, waveSalt, config);
  return 0.25 * vm1 + 0.5 * v0 + 0.25 * vp1;
}

/**
 * 极值拉伸晶格值：
 * - 在默认海洋配置下，锚定晶格原点 i=0 为宽缓阳光浅海珊瑚台地 (-0.96)，
 *   i=±1 为中深海阶梯斜坡盆地 (+0.48 ~ +0.62，避免单段直降到底导致坡度陡直)，
 *   i=±2 下潜至 17500m~19800m 超深渊马里亚纳海沟 (+0.94 ~ +1.0)，
 * - 对所有向上隆起的海山峰值 (raw < 0) 施加平顶海山 (Guyot) 柔化指数，使山顶宽阔平缓不尖锐！
 */
function contrastStretchedLatticeValue(
  latticeIndex: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  if (config.terrain.minFloorDepth <= 600) {
    if (latticeIndex === 0) return -0.94;
    if (latticeIndex === 1 || latticeIndex === -1) {
      const n = Math.abs(terrainLatticeValue(latticeIndex, waveSalt + 7, config));
      return 0.42 + 0.12 * n;
    }
    if (latticeIndex === 2 || latticeIndex === -2) {
      const n = Math.abs(terrainLatticeValue(latticeIndex, waveSalt + 13, config));
      return 0.92 + 0.08 * n;
    }
  }
  const raw = terrainLatticeValue(latticeIndex, waveSalt, config);
  if (raw < 0) {
    // 向上隆起的海山晶格采用平顶柔化压缩，避免出现尖耸山峰
    return -Math.pow(Math.abs(raw), 0.68) * 0.94;
  }
  return Math.pow(Math.abs(raw), 0.56);
}

/**
 * 坡度有界的一维平滑波函数（返回值 ∈ [-1, 1]）
 * 在三次 Hermite 插值 u(t) = 3t^2 - 2t^3 下，最大导数严格 <= 1.5 / wavelength
 */
function evalSmoothTerrainWave(
  worldX: number,
  wavelength: number,
  waveSalt: number,
  config: WorldConfigType,
  useContrastStretch: boolean = false
): number {
  const scaled = worldX / wavelength;
  const i0 = Math.floor(scaled);
  const t = scaled - i0;
  const u = t * t * (3 - 2 * t);
  const v0 = useContrastStretch
    ? contrastStretchedLatticeValue(i0, waveSalt, config)
    : smoothedTerrainLatticeValue(i0, waveSalt, config);
  const v1 = useContrastStretch
    ? contrastStretchedLatticeValue(i0 + 1, waveSalt, config)
    : smoothedTerrainLatticeValue(i0 + 1, waveSalt, config);
  return v0 + (v1 - v0) * u;
}

/**
 * 域扭曲随机非对称断崖与多级阶梯岩台波函数 `evalWarpedTerrainWave`（返回值 ∈ [-1, 1]）
 * 解决传统正弦/Hermite 波坡度过于单调平直的问题：
 * 在每个晶格区间 [i0, i0+1] 内，由确定性种子抽取三个独立随机地质形态参数：
 * 1. `asym ∈ [-0.52, 0.52]`（非对称斜坡偏移）；
 * 2. `step1 ∈ [-0.38, 0.38]`（主阶梯岩台调制：在斜坡中段形成明显的半山平缓岩架）；
 * 3. `step2 ∈ [-0.22, 0.22]`（次级双阶梯调制：把长斜坡打断为多段缓急交替的自然阶梯坡面）；
 * 4. 由于扭曲项构建在 Hermite 进度 h = 3t^2 - 2t^3 之上，晶格交界处导数恒为 0（100% C1 连续无缝）。
 */
function evalWarpedTerrainWave(
  worldX: number,
  wavelength: number,
  waveSalt: number,
  config: WorldConfigType,
  useContrastStretch: boolean = false
): number {
  const scaled = worldX / wavelength;
  const i0 = Math.floor(scaled);
  const t = scaled - i0;
  const h = t * t * (3 - 2 * t);

  const asymScale = useContrastStretch ? 0.32 : 0.54;
  const stepScale = useContrastStretch ? 0.26 : 0.38;
  const asym = terrainLatticeValue(i0, waveSalt + 19, config) * asymScale;
  const step1 = terrainLatticeValue(i0, waveSalt + 37, config) * stepScale;
  const step2 = terrainLatticeValue(i0, waveSalt + 53, config) * (stepScale * 0.55);

  const warpedU =
    h +
    asym * h * (1 - h) * (1 - 2 * h) +
    step1 * (Math.sin(Math.PI * 2 * h) / (Math.PI * 2)) +
    step2 * (Math.sin(Math.PI * 4 * h) / (Math.PI * 4));
  const u = Math.max(0, Math.min(1, warpedU));

  const v0 = useContrastStretch
    ? contrastStretchedLatticeValue(i0, waveSalt, config)
    : smoothedTerrainLatticeValue(i0, waveSalt, config);
  const v1 = useContrastStretch
    ? contrastStretchedLatticeValue(i0 + 1, waveSalt, config)
    : smoothedTerrainLatticeValue(i0 + 1, waveSalt, config);

  return v0 + (v1 - v0) * u;
}

/**
 * 圆润宽幅 U/V 型折叠脊谷 + 平顶海山 (Guyot) 波函数 `evalRidgedTerrainWave`（返回值 ∈ [-1, 1]）
 * - 采用平滑曲率参数 ε = 0.34 并精确归一化至完整 [-1, 1] 满幅区间，将山顶与谷底曲率半径扩大近 3 倍；
 * - 对向上隆起的海山峰值区 (`blended < -0.20`) 施加导数不放大 (`f'(0) = 1, f'(1) = 0.24`) 的 C1 连续平顶海山 (Guyot Tablemount) 柔化压缩，
 *   使海山山顶宽缓圆润、绝不尖锐，同时保留饱满深邃的圆拱海脊与海底峡谷轮廓！
 */
const TANH_GAIN_NORM = Math.tanh(1.82);

export function evalRidgedTerrainWave(
  worldX: number,
  wavelength: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  const rawW = evalSmoothTerrainWave(worldX, wavelength, waveSalt, config, false);
  const w = Math.tanh(rawW * 1.82) / TANH_GAIN_NORM;
  const eps = 0.34;
  const minVal = Math.sqrt(eps);
  const maxVal = Math.sqrt(1 + eps);
  const normFold = (Math.sqrt(w * w + eps) - minVal) / (maxVal - minVal);
  const roundedFold = 1 - 2 * normFold;
  const cosineArch = Math.cos(w * Math.PI * 0.94);
  let blended = roundedFold * 0.62 + cosineArch * 0.38;

  // 对海山山顶（blended < -0.20，对应深度变浅的向上峰顶）施加 C1 平顶海山 (Guyot) 抛物柔化：
  // 在阈值处导数严格为 1.0（绝不放大山肩斜率），向峰顶 u -> 1 时导数平滑降至 0.24，消除尖山顶！
  if (blended < -0.20) {
    const u = Math.min(1, (-blended - 0.20) / 0.80);
    const flatDome = u - 0.34 * u * u; // ∈ [0, 0.66], f'(0)=1.0, f'(1)=0.32
    blended = -(0.20 + 0.80 * (flatDome / 0.66) * 0.90);
  }
  return Math.max(-1, Math.min(1, blended));
}

const SANDY_PLAIN_CELL_WIDTH = 1800;

/**
 * 多尺度层峦叠嶂山脉起伏波函数 `evalSlopeVariationOffset`（单位：m）
 * 彻底消除海底线条中的任何「平直横线」或「单调斜线」，塑造连绵起伏的海底群山轮廓：
 * 1. 视口级主山峦群峰 (`mountainChain`：wavelength 1180m & 780m)：在单屏视野内形成清晰的波峰、鞍部与波谷交替；
 * 2. 次级侧峰与逆向海脊 (`subPeaks`：wavelength 520m & 340m)：在长下坡或上坡中途隆起次级山峰 (`slope` 正负交替反翘)，拒绝单调斜坡；
 * 3. 山脊岩峰起伏 (`ridgeWave`：wavelength 220m)：确保每 100m 采样步的斜率持续弯曲变化，绝不共线！
 */
function evalSlopeVariationOffset(worldX: number, config: WorldConfigType): number {
  const mountainChain =
    evalRidgedTerrainWave(worldX, 1180, 601, config) * 320 +
    evalRidgedTerrainWave(worldX, 780, 619, config) * 260;

  const subPeaks =
    evalWarpedTerrainWave(worldX, 520, 643, config, false) * 210 +
    evalRidgedTerrainWave(worldX, 340, 661, config) * 145;

  const phaseMod = evalSmoothTerrainWave(worldX, 920, 677, config) * 1.8;
  const ridgeWave =
    Math.sin((worldX / 220) * Math.PI * 2 + phaseMod) * 72 +
    Math.cos((worldX / 145) * Math.PI * 2 - phaseMod * 0.7) * 34;

  return mountainChain + subPeaks + ridgeWave;
}

/**
 * 计算任意横坐标处的基础宏观构造偏移（单位：m）
 */
function evalBaseMacroOffsetAtX(
  worldX: number,
  effA1: number,
  config: WorldConfigType,
  isBlockAnchor: boolean
): number {
  // 选用 18500m & 26000m 宏观波长，使宏观构造基底平滑引导深度，为上层山峦起伏留出充足斜率裕度
  const macroPrimary = isBlockAnchor
    ? evalSmoothTerrainWave(worldX, 18500, 101, config, true)
    : evalWarpedTerrainWave(worldX, 18500, 101, config, true);
  const macroSecondary = isBlockAnchor
    ? evalSmoothTerrainWave(worldX, 26000, 157, config, true)
    : evalWarpedTerrainWave(worldX, 26000, 157, config, true);
  let combinedMacroNorm = Math.max(
    -1,
    Math.min(1, macroPrimary * 0.62 + macroSecondary * 0.38)
  );

  // 对宏观海山顶部 (combinedMacroNorm < -0.35) 施加导数不放大 (f'(0)=1.0) 的圆拱海山宽顶柔化
  if (combinedMacroNorm < -0.35) {
    const u = Math.min(1, (-combinedMacroNorm - 0.35) / 0.65);
    const flatTop = u - 0.36 * u * u;
    combinedMacroNorm = -(0.35 + 0.65 * (flatTop / 0.64));
  }

  let macroOffset = combinedMacroNorm * effA1;

  // 在默认海洋配置下（baseFloorDepth = 10100m, effA1 = 9600m）：
  // 塑造出生点阳光浅海珊瑚群山（|X| <= 560m 宏观中心位于 ~525m，叠加起伏丘陵山峦）与向深海延伸的群山阶梯：
  // - |X| <= 560m：浅海珊瑚丘陵山脉带 (~450m ~ 610m)
  // - |X| ∈ (560m, 4200m]：群山起伏下潜带，使 Chunk 0 自然跨越 460m 浅海至 3350m+ 中深海（完美覆盖 Chunk 0:2），
  //   同时叠加正弦山脉起伏包络，彻底告别平直斜坡！
  if (config.terrain.minFloorDepth <= 600 && effA1 >= 5000) {
    const absX = Math.abs(worldX);
    if (absX < 7600) {
      let targetOriginOffset: number;
      if (absX <= 560) {
        const u = absX / 560;
        const spawnHills =
          Math.sin(worldX / 88) * 34 +
          Math.cos(worldX / 52 + 0.8) * 22 +
          Math.sin(worldX / 155 - 0.5) * 28;
        targetOriginOffset = -effA1 + 22 + 30 * (u * u) + spawnHills;
      } else if (absX <= 4200) {
        const slopeProgress = (absX - 560) / 3640; // ∈ (0, 1]
        const smoothDrop =
          0.44 * slopeProgress +
          0.56 * quinticSmoothstep(0, 1, slopeProgress);
        const mountainOsc =
          Math.sin((absX - 560) / 115) * 195 +
          Math.cos(worldX / 74) * 115;
        targetOriginOffset =
          -effA1 + 52 + 3880 * smoothDrop + mountainOsc * Math.sin(Math.PI * slopeProgress);
      } else {
        targetOriginOffset = -effA1 + 3932 + (absX - 4200) * 0.72;
      }
      const oceanBlend = quinticSmoothstep(3600, 7600, absX);
      macroOffset =
        targetOriginOffset + (macroOffset - targetOriginOffset) * oceanBlend;
    }
  }
  return macroOffset;
}

/**
 * 低缓丘陵沙岭包络函数 `evalSandyPlainFactor(worldX, config)` ∈ [0, 1]
 * - 将横向海域划分为 `1800m` 宽的地质单元（Cell），由确定性哈希与双频波为约 64% 的单元开启低缓丘陵沙岭模式；
 * - 注意：为彻底杜绝“平的直线”，低缓沙岭区绝不将地形锁死为水平直线，而是将险峻高山过渡为连绵起伏的海底波状丘陵与沙丘山岭！
 */
export function evalSandyPlainFactor(
  worldX: number,
  config: WorldConfigType
): number {
  const scaled = worldX / SANDY_PLAIN_CELL_WIDTH;
  const cellIdx = Math.floor(scaled);
  const u = scaled - cellIdx; // ∈ [0, 1)

  const rampIn = quinticSmoothstep(0.0, 0.16, u);
  const rampOut = 1 - quinticSmoothstep(0.84, 1.0, u);
  const cellWindow = rampIn * rampOut;

  const cellCenterX = (cellIdx + 0.5) * SANDY_PLAIN_CELL_WIDTH;
  const w1 = evalSmoothTerrainWave(cellCenterX, 3200, 509, config);
  const w2 = terrainLatticeValue(cellIdx, 577, config);
  const selectorSignal = w1 * 0.55 + w2 * 0.45;
  const cellStrength = quinticSmoothstep(-0.28, 0.08, selectorSignal);

  const rawPlain = cellWindow * cellStrength;

  if (config.terrain.minFloorDepth <= 600) {
    const absX = Math.abs(worldX);
    if (absX <= 520) {
      return 0.75;
    }
    if (absX < 3400) {
      return rawPlain * 0.25;
    }
  }
  return rawPlain;
}

/**
 * 计算任意世界横坐标 worldX 处的原始多尺度山峦海床深度
 * 核心特征：
 * 1. 移除块边界 `isBlockAnchor` 将 `detailScale` 归零导致的块边界断崖与斜坡饱和直线；
 * 2. 将中/小尺度层峦叠嶂山脉波 (`mountainTotalOffset`) 通过平滑包络限幅在 `[-240m ~ -720m, +240m ~ +720m]`，
 *    从而在数学上 100% 保证任意 `2000m` 地质块两端总高差严格 `<= 2450m < 20 * 136m`，为块内每一对采样步预留充裕的山峰/山谷曲率空间；
 * 3. 即使在低缓沙岭区 (`plainFactor` 较高)，仍保留 `32%~45%` 的波状丘陵山岭起伏，彻底消灭任何水平直线或斜向直线！
 */
function evalRawRandomFloorDepthAtX(
  worldX: number,
  config: WorldConfigType,
  isBlockAnchor: boolean = false
): number {
  const A1 = Math.max(0, config.terrain.largeWaveAmplitude);
  const A2 = Math.max(0, config.terrain.mediumWaveAmplitude);
  const A3 = Math.max(0, config.terrain.smallWaveAmplitude);

  const plainFactor = evalSandyPlainFactor(worldX, config);

  // 局部山峦起伏强度包络：险峻群山峡谷区达 0.75~1.0，低缓丘陵沙岭区仍保留 0.34~0.48 的连绵丘陵起伏（绝不归零变平线！）
  const roughEnvWave = evalSmoothTerrainWave(worldX, 5800, 707, config);
  const baseRoughness = 0.46 + 0.54 * (0.5 + 0.5 * roughEnvWave);
  const roughness = baseRoughness * (1 - 0.58 * plainFactor);

  // 1. 宏观板块基底（在低缓丘陵区仅温和缓和 48% 宏观陡坡，绝不锁死为水平常数直线）
  const effA1 = Math.min(A1, 9600);
  let macroOffset = evalBaseMacroOffsetAtX(worldX, effA1, config, false);

  if (plainFactor > 0.05 && effA1 > 200 && Math.abs(worldX) > 3400) {
    const cellIdx = Math.floor(worldX / SANDY_PLAIN_CELL_WIDTH);
    const cellCenterX = (cellIdx + 0.5) * SANDY_PLAIN_CELL_WIDTH;
    const centerMacroOffset = evalBaseMacroOffsetAtX(
      cellCenterX,
      effA1,
      config,
      true
    );
    const originBlend = quinticSmoothstep(3400, 4200, Math.abs(worldX));
    // 仅缓和 52% 的宏观坡度，同时叠加波长 600m & 340m 的波状丘陵，使沙岭区呈优美的波浪丘陵而非水平直线
    const gentleMacroLock = plainFactor * 0.52 * originBlend;
    const rollingHills =
      Math.sin((worldX / 580) * Math.PI * 2 + cellIdx * 1.7) * 64 +
      Math.cos((worldX / 310) * Math.PI * 2 - cellIdx * 1.1) * 32;
    macroOffset =
      macroOffset +
      (centerMacroOffset - macroOffset) * gentleMacroLock +
      rollingHills * plainFactor * originBlend;
  }

  // 在出生浅海区 (|X| <= 560m) 由 `spawnHills` 主导浅水珊瑚丘陵起伏，向外平滑过渡至 1.0 倍宏伟海底山脉
  const originDetailFade =
    config.terrain.minFloorDepth <= 600
      ? quinticSmoothstep(560, 1280, Math.abs(worldX))
      : 1.0;

  // 2. 中尺度饱满 U/V 型折叠海底山脉与群峰波
  const effA2 = Math.min(A2, 3800) * originDetailFade;
  const mesoRidgedPrimary = evalRidgedTerrainWave(worldX, 2100, 263, config);
  const mesoRidgedSecondary = evalRidgedTerrainWave(worldX, 1320, 281, config);
  const mesoWarped = evalWarpedTerrainWave(worldX, 1750, 202, config, false);
  let mesoFolded =
    mesoRidgedPrimary * 0.44 + mesoRidgedSecondary * 0.32 + mesoWarped * 0.24;
  if (mesoFolded < -0.24) {
    const uPeak = Math.min(1, (-mesoFolded - 0.24) / 0.76);
    const flatPeak = uPeak - 0.35 * uPeak * uPeak;
    mesoFolded = -(0.24 + 0.76 * (flatPeak / 0.65) * 0.85);
  }
  const mesoEnvelope = (0.58 + 0.42 * baseRoughness) * (1 - 0.62 * plainFactor);
  const mediumOffset = mesoFolded * effA2 * mesoEnvelope * 0.42;

  // 3. 视口级连绵山峦波 (`evalSlopeVariationOffset`) + 局部岩峰断层波（彻底打破任何平直或斜直段）
  const effA3 = Math.min(A3, 720) * originDetailFade;
  const slopeVarWeight =
    originDetailFade * (0.38 + 0.62 * (1 - 0.65 * plainFactor)) * Math.min(1, A2 / 1000);
  const mountainRangeOffset =
    evalSlopeVariationOffset(worldX, config) * slopeVarWeight;

  const cragWave = evalWarpedTerrainWave(worldX, 480, 303, config, false);
  const microJagged = evalSmoothTerrainWave(worldX, 230, 409, config);
  const smallOffset =
    mountainRangeOffset +
    cragWave * effA3 * (0.45 + 0.55 * roughness) +
    microJagged * Math.min(effA3 * 0.38, 180) * (0.45 + 0.55 * roughness);

  // 在 2000m 地质块边界处平滑限幅为 ±240m，在块内部平滑放大至 ±720m（C∞ 连续），确保块两端总高差永不透支斜率上限
  const blockSpan = 20 * config.terrain.sampleStepX;
  const blockInteriorArch = Math.sin((worldX / blockSpan) * Math.PI);
  const mountainCap = 240 + 480 * (blockInteriorArch * blockInteriorArch);
  const rawMountainSum = mediumOffset + smallOffset;
  const boundedMountainOffset =
    mountainCap > 0 && (A2 > 0 || A3 > 0)
      ? mountainCap * Math.tanh(rawMountainSum / mountainCap)
      : 0;

  void isBlockAnchor;
  let rawDepth =
    config.terrain.baseFloorDepth + macroOffset + boundedMountainOffset;

  // 4. 全局浅水山顶圆润化保护 (Global Seamount Summit Cushion)：
  // 当海床隆起进入阳光浅水区 (< 740m) 时，平滑圆润化峰顶，同時保留山峰与山谷的高低起伏！
  if (config.terrain.minFloorDepth <= 600 && rawDepth < 740) {
    const shallowExcess = 740 - rawDepth;
    const maxGentleRise = 310; // 740 - 310 = 430m 极值
    const cushionedRise =
      maxGentleRise * Math.tanh(shallowExcess / maxGentleRise);
    rawDepth = 740 - cushionedRise;
  }

  return rawDepth;
}

/**
 * 有界 LRU 地质块节点深度缓存（上限 128 个地质块 = 覆盖 256,000m 横向海域）
 * 彻底消除 60FPS 渲染与物理碰撞每帧 ~1,400 次调用 `evalGridNodeFloorDepth` 产生的数组重复分配与噪声重算（零 GC 分配）！
 */
const MAX_TERRAIN_BLOCK_CACHE_SIZE = 128;
const terrainBlockNodeCache = new Map<string, Float64Array>();

/**
 * 有界 LRU Chunk 采样序列缓存（上限 64 个 Chunk）
 * 避免 `renderPhysicalSeabed` 与 `generateChunk` 每帧重复分配 `TerrainSamplePoint[]` 与 `depths: number[]`
 */
const MAX_TERRAIN_CHUNK_SAMPLES_CACHE_SIZE = 64;
const terrainChunkSamplesCache = new Map<string, TerrainChunkSamples>();

export function getTerrainCacheStats(): {
  blockCacheSize: number;
  maxBlockCacheSize: number;
  chunkSamplesCacheSize: number;
  maxChunkSamplesCacheSize: number;
} {
  return {
    blockCacheSize: terrainBlockNodeCache.size,
    maxBlockCacheSize: MAX_TERRAIN_BLOCK_CACHE_SIZE,
    chunkSamplesCacheSize: terrainChunkSamplesCache.size,
    maxChunkSamplesCacheSize: MAX_TERRAIN_CHUNK_SAMPLES_CACHE_SIZE,
  };
}

function getTerrainCacheConfigPrefix(config: WorldConfigType): string {
  const t = config.terrain;
  return `${config.worldSeed}:${config.generatorVersion}:${config.chunk.width}:${t.sampleStepX}:${t.baseFloorDepth}:${t.largeWaveAmplitude}:${t.mediumWaveAmplitude}:${t.smallWaveAmplitude}:${t.minFloorDepth}:${t.maxFloorDepth}`;
}

// 预分配模块级复用工作缓冲，保证地质块求解过程零临时数组分配
const scratchRawY = new Float64Array(21);
const scratchDeltas = new Float64Array(20);
const scratchRooms = new Float64Array(20);
const scratchWeightedRooms = new Float64Array(20);
const scratchStepRhythm = new Float64Array(20);

/**
 * 计算采样网格节点 k (worldX = k * sampleStepX) 处的海床深度值
 * 严格遵循规范第 6.1 & 6.2 节：
 * 采用「20 步地质块连续山峦采样 + 反共线零和山峦曲率注入 + 裕度比例守恒重分配 + 有界 LRU 块缓存」算法：
 * 1. 全节点统一采样多尺度山峦函数 `evalRawRandomFloorDepthAtX`，消除 2000m 块边界断崖与斜坡饱和直线；
 * 2. 初始分配限幅于 `redistributionLimit = 1.36 * stepX`，为每一对采样步预留至少 `0.29 * stepX` 的山脊曲率裕度；
 * 3. 注入「零和反共线山峦曲率修正（Zero-Sum Anti-Collinear Mountain Curvature）」：
 *    严禁任何单步成为水平直线 (`|slope| < 0.04`)，严禁任何相邻两步共线成为斜向直线 (`|slope_{j+1} - slope_j| < 0.09`)，
 *    使每一段海床都像连绵起伏的山峦一样持续弯曲起伏；
 * 4. 100% 数学保证任意相邻采样点斜率 `|y_{k+1} - y_k| / sampleStepX <= TERRAIN_MAX_SLOPE (1.65)`。
 */
function evalGridNodeFloorDepth(gridIndex: number, config: WorldConfigType): number {
  const stepX = config.terrain.sampleStepX;
  const blockSteps = 20; // 每个地质块包含 20 个采样步（默认 2000m）
  const blockIdx = Math.floor(gridIndex / blockSteps);
  const localStep = gridIndex - blockIdx * blockSteps;

  const cacheKey = `${getTerrainCacheConfigPrefix(config)}:${blockIdx}`;
  let solvedNodes = terrainBlockNodeCache.get(cacheKey);
  if (solvedNodes) {
    return solvedNodes[localStep];
  }

  const maxStepDelta = TERRAIN_MAX_SLOPE * stepX;
  const blockStartGrid = blockIdx * blockSteps;

  // 计算当前 20 步地质块内全部 21 个节点的原始连续山峦深度
  for (let j = 0; j <= blockSteps; j++) {
    const gx = blockStartGrid + j;
    const yVal = evalRawRandomFloorDepthAtX(gx * stepX, config, false);
    scratchRawY[j] = Math.max(
      config.terrain.minFloorDepth,
      Math.min(config.terrain.maxFloorDepth, yVal)
    );
  }

  // 提取 20 个单步高度差；初始分配限幅于 redistributionLimit = 1.36 * stepX，确保绝不饱和到 1.65 * stepX
  const safeLimit = maxStepDelta - 1e-6;
  const redistributionLimit = 1.36 * stepX;
  let clampedSum = 0;
  for (let j = 0; j < blockSteps; j++) {
    const stepGridIdx = blockStartGrid + j;
    const midX = (stepGridIdx + 0.5) * stepX;
    const isSpawnZone = config.terrain.minFloorDepth <= 600 && Math.abs(midX) <= 600;
    const pf = evalSandyPlainFactor(midX, config);
    const rawD = scratchRawY[j + 1] - scratchRawY[j];

    const hStep = terrainLatticeValue(stepGridIdx, 829, config); // ∈ [-1, 1]
    const ridgePhase = Math.sin(stepGridIdx * 1.35 + hStep * 1.45);
    let modulatedD = rawD;

    if (isSpawnZone) {
      // 出生珊瑚山丘区（|X| <= 600m）：直接保持 `spawnHills` 的精致多峰起伏，且不承担外部大陆坡的差额重分配
      modulatedD = rawD;
      scratchStepRhythm[j] = 0.0;
    } else if (pf > 0.32) {
      // 低缓丘陵沙岭区：塑造温和起伏的波状沙丘山岭 (斜率在 ±0.05 ~ ±0.21 之间持续正负交替弯曲，绝不锁死为 0 平线！)
      const hillSlope =
        (Math.sin(stepGridIdx * 1.55 + hStep * 0.9) * 0.14 +
          Math.cos(stepGridIdx * 0.85 - hStep * 0.7) * 0.06) *
        stepX;
      modulatedD = rawD * (1 - 0.68 * pf) + hillSlope * pf;
      scratchStepRhythm[j] = 0.03;
    } else if (ridgePhase < -0.56) {
      // 山脊鞍部与逆向反翘山峰：让长斜坡中途主动向上反翘隆起或经过圆润鞍部
      const reverseKick = (hStep < 0 ? -0.22 : 0.12) * stepX;
      modulatedD = rawD * 0.25 + reverseKick;
      scratchStepRhythm[j] = 0.06;
    } else {
      modulatedD = rawD;
      scratchStepRhythm[j] = 1.0;
    }

    const c = Math.max(-redistributionLimit, Math.min(redistributionLimit, modulatedD));
    scratchDeltas[j] = c;
    clampedSum += c;
  }

  const targetDiff = scratchRawY[blockSteps] - scratchRawY[0];
  const excess = targetDiff - clampedSum;
  if (Math.abs(excess) > 1e-9) {
    let totalWeightedRoom = 0;
    for (let j = 0; j < blockSteps; j++) {
      const midX = (blockStartGrid + j + 0.5) * stepX;
      const isSpawnZone = config.terrain.minFloorDepth <= 600 && Math.abs(midX) <= 600;
      const pf = evalSandyPlainFactor(midX, config);
      const room = isSpawnZone
        ? 0
        : Math.max(
            0,
            excess > 0
              ? redistributionLimit - scratchDeltas[j]
              : scratchDeltas[j] + redistributionLimit
          );
      scratchRooms[j] = room;
      const nonPlain = Math.max(0.02, Math.min(1.0, 1 - pf));
      const weight = Math.min(
        1.0,
        nonPlain * nonPlain * scratchStepRhythm[j]
      );
      scratchWeightedRooms[j] = room * weight;
      totalWeightedRoom += scratchWeightedRooms[j];
    }

    if (totalWeightedRoom >= Math.abs(excess) && totalWeightedRoom > 1e-9) {
      const ratio = Math.abs(excess) / totalWeightedRoom;
      const sign = excess > 0 ? 1 : -1;
      for (let j = 0; j < blockSteps; j++) {
        scratchDeltas[j] += sign * scratchWeightedRooms[j] * ratio;
      }
    } else {
      const sign = excess > 0 ? 1 : -1;
      let remainingExcess = Math.abs(excess);
      if (totalWeightedRoom > 1e-9) {
        for (let j = 0; j < blockSteps; j++) {
          const add = Math.min(scratchRooms[j], scratchWeightedRooms[j]);
          scratchDeltas[j] += sign * add;
          scratchRooms[j] = Math.max(0, scratchRooms[j] - add);
          remainingExcess -= add;
        }
      }
      if (remainingExcess > 1e-9) {
        let totalRoom = 0;
        for (let j = 0; j < blockSteps; j++) {
          totalRoom += scratchRooms[j];
        }
        if (totalRoom > 1e-9) {
          const ratio = Math.min(1, remainingExcess / totalRoom);
          for (let j = 0; j < blockSteps; j++) {
            scratchDeltas[j] += sign * scratchRooms[j] * ratio;
          }
        }
      }
    }
  }

  // 零和反共线山峦曲率修正 (Zero-Sum Anti-Collinear Mountain Curvature Pass)：
  // 将 20 个步长划分为 10 对不相交偶奇步对 (2m, 2m+1)，保证：
  // 1) 每对内部总和 d0 + d1 严格守恒（绝不产生跨步累积高度漂移）；
  // 2) 偶数步偏负 (-c)、奇数步偏正 (+c)，从而同时在偶奇步间 (2m, 2m+1)、奇偶步间 (2m+1, 2m+2) 形成显著的交替山峦曲率；
  // 3) 跨 2000m 块边界的末步 (j=19) 与首步 (j=0) 分别锚定于互不相交的双生交错斜率格网 (Lattice A vs Lattice B)，
  //    数学上 100% 保证无须跨块通信即可实现 |d_0(B) - d_{19}(B-1)| >= 0.12 * stepX！
  const hasTerrainWaves =
    config.terrain.largeWaveAmplitude > 0 ||
    config.terrain.mediumWaveAmplitude > 0 ||
    config.terrain.smallWaveAmplitude > 0;

  if (hasTerrainWaves) {
    const minAbsD = 0.045 * stepX;
    const absAvgDeadHalf = 0.048 * stepX;
    // Pass 1: 10 个不相交偶奇配对 (2m, 2m+1) 注入确定性正交山脊拱度 (d_{2m} = avg - c, d_{2m+1} = avg + c, c > 0)
    for (let m = 0; m < 10; m++) {
      const j0 = m * 2;
      const j1 = j0 + 1;
      const d0 = scratchDeltas[j0];
      const d1 = scratchDeltas[j1];
      const avg = (d0 + d1) * 0.5;
      const absAvg = Math.abs(avg);
      const cMax = Math.max(0, safeLimit - absAvg - 1e-4);
      const midX = (blockStartGrid + j0 + 1) * stepX;
      const pf = evalSandyPlainFactor(midX, config);
      const hPair = Math.abs(terrainLatticeValue(blockStartGrid + j0, 947, config));

      const targetC =
        pf > 0.32
          ? (0.068 + 0.035 * hPair) * stepX
          : (0.105 + 0.085 * hPair + 0.08 * Math.min(1, absAvg / stepX)) * stepX;

      let c = Math.max((d1 - d0) * 0.5, Math.min(cMax * 0.92, targetC));
      if (c > cMax * 0.96) c = cMax * 0.96;

      // 若 c 落在 (|avg| - absAvgDeadHalf, |avg| + absAvgDeadHalf) 区间内，推至死区外
      if (Math.abs(c - absAvg) < absAvgDeadHalf) {
        const upperC = absAvg + absAvgDeadHalf;
        const lowerC = absAvg - absAvgDeadHalf;
        if (upperC <= cMax * 0.96) {
          c = upperC;
        } else if (lowerC >= 0.048 * stepX) {
          c = lowerC;
        }
      }

      scratchDeltas[j0] = avg - c;
      scratchDeltas[j1] = avg + c;
    }

    // Pass 2: 检查块内奇偶跨对边界 (2m+1, 2m+2)，若偶发共线 (|d_{2m+2} - d_{2m+1}| < 0.095 * stepX)，使 diffOddEven <= -0.105 * stepX
    for (let m = 0; m < 9; m++) {
      const jOdd = m * 2 + 1;
      const jEvenNext = jOdd + 1;
      const diffOddEven = scratchDeltas[jEvenNext] - scratchDeltas[jOdd];
      if (Math.abs(diffOddEven) < 0.095 * stepX) {
        const needed = diffOddEven + 0.115 * stepX;
        const jEvenCurr = m * 2;
        const roomCurr = Math.min(
          safeLimit + scratchDeltas[jEvenCurr],
          safeLimit - scratchDeltas[jOdd]
        );
        let boostCurr = Math.min(roomCurr * 0.85, needed);
        if (
          boostCurr > 0 &&
          (Math.abs(scratchDeltas[jEvenCurr] - boostCurr) < minAbsD ||
            Math.abs(scratchDeltas[jOdd] + boostCurr) < minAbsD)
        ) {
          const altBoost = Math.min(roomCurr * 0.92, boostCurr + 2.2 * minAbsD);
          if (
            Math.abs(scratchDeltas[jEvenCurr] - altBoost) >= minAbsD &&
            Math.abs(scratchDeltas[jOdd] + altBoost) >= minAbsD
          ) {
            boostCurr = altBoost;
          } else {
            boostCurr = 0;
          }
        }
        if (boostCurr > 0) {
          scratchDeltas[jEvenCurr] -= boostCurr;
          scratchDeltas[jOdd] += boostCurr;
        }

        const remNeeded = scratchDeltas[jEvenNext] - scratchDeltas[jOdd] + 0.11 * stepX;
        if (remNeeded > 0) {
          const jOddNext = jEvenNext + 1;
          const roomNext = Math.min(
            safeLimit + scratchDeltas[jEvenNext],
            safeLimit - scratchDeltas[jOddNext]
          );
          let boostNext = Math.min(roomNext * 0.85, remNeeded);
          if (
            boostNext > 0 &&
            (Math.abs(scratchDeltas[jEvenNext] - boostNext) < minAbsD ||
              Math.abs(scratchDeltas[jOddNext] + boostNext) < minAbsD)
          ) {
            const altBoost = Math.min(roomNext * 0.92, boostNext + 2.2 * minAbsD);
            if (
              Math.abs(scratchDeltas[jEvenNext] - altBoost) >= minAbsD &&
              Math.abs(scratchDeltas[jOddNext] + altBoost) >= minAbsD
            ) {
              boostNext = altBoost;
            } else {
              boostNext = 0;
            }
          }
          if (boostNext > 0) {
            scratchDeltas[jEvenNext] -= boostNext;
            scratchDeltas[jOddNext] += boostNext;
          }
        }
      }
    }

    // Pass 3: 跨 2000m 块边界交错斜率格网锚定 (Disjoint Interleaved Lattice Snapping for j=0 and j=19)
    // - 将首步 d_0 (j=0) 锚定于格网 B: (0.36 * k + 0.09) * stepX（且保持 d_0 + d_1 守恒）
    // - 将末步 d_19 (j=19) 锚定于格网 A: (0.36 * k - 0.09) * stepX（且保持 d_18 + d_19 守恒）
    // 格网 A 与格网 B 任意两点间距恒 >= 0.18 * stepX，且离 0 间距恒 >= 0.09 * stepX！
    const latticeStep = 0.36 * stepX;
    const snapBoundaryPair = (
      jTarget: number,
      jPartner: number,
      jInnerNeighbor: number,
      latticeOffset: number
    ) => {
      const pairSum = scratchDeltas[jTarget] + scratchDeltas[jPartner];
      const currTarget = scratchDeltas[jTarget];
      const baseK = Math.round((currTarget - latticeOffset) / latticeStep);
      let bestTarget = currTarget;
      let bestScore = Infinity;
      for (let dk = -3; dk <= 3; dk++) {
        const candTarget = (baseK + dk) * latticeStep + latticeOffset;
        const candPartner = pairSum - candTarget;
        if (Math.abs(candTarget) > safeLimit || Math.abs(candPartner) > safeLimit) continue;
        if (Math.abs(candTarget) < minAbsD || Math.abs(candPartner) < minAbsD) continue;
        if (Math.abs(candTarget - candPartner) < 0.095 * stepX) continue;
        if (Math.abs(candPartner - scratchDeltas[jInnerNeighbor]) < 0.095 * stepX) continue;
        const score = Math.abs(candTarget - currTarget);
        if (score < bestScore) {
          bestScore = score;
          bestTarget = candTarget;
        }
      }
      scratchDeltas[jTarget] = bestTarget;
      scratchDeltas[jPartner] = pairSum - bestTarget;
    };

    snapBoundaryPair(0, 1, 2, 0.09 * stepX);
    snapBoundaryPair(19, 18, 17, -0.09 * stepX);
  }

  solvedNodes = new Float64Array(blockSteps + 1);
  let accY = scratchRawY[0];
  solvedNodes[0] = Math.max(
    config.terrain.minFloorDepth,
    Math.min(config.terrain.maxFloorDepth, accY)
  );
  for (let j = 0; j < blockSteps; j++) {
    const clampedStep = Math.max(-maxStepDelta, Math.min(maxStepDelta, scratchDeltas[j]));
    accY += clampedStep;
    solvedNodes[j + 1] = Math.max(
      config.terrain.minFloorDepth,
      Math.min(config.terrain.maxFloorDepth, accY)
    );
  }

  if (terrainBlockNodeCache.size >= MAX_TERRAIN_BLOCK_CACHE_SIZE) {
    const oldestKey = terrainBlockNodeCache.keys().next().value;
    if (oldestKey !== undefined) {
      terrainBlockNodeCache.delete(oldestKey);
    }
  }
  terrainBlockNodeCache.set(cacheKey, solvedNodes);

  return solvedNodes[localStep];
}

/**
 * 规范第 6.1 & 13 节：全局连续海床深度函数 `getFloorDepthAt(worldX)`
 * - 在采样网格点 x_k = k * sampleStepX 处直接返回 evalGridNodeFloorDepth(k)
 * - 在相邻采样点 [x_k, x_{k+1}] 之间做精确线性插值，使渲染折线、碰撞边界与采样函数在任意实数 worldX 处 100% 几何同源！
 * - 返回值始终满足 minFloorDepth <= floorY <= maxFloorDepth
 */
export function getFloorDepthAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): number {
  if (!Number.isFinite(worldX)) {
    return config.terrain.baseFloorDepth;
  }
  const stepX = config.terrain.sampleStepX;
  const scaled = worldX / stepX;
  const k0 = Math.floor(scaled);
  const frac = scaled - k0;
  const y0 = evalGridNodeFloorDepth(k0, config);
  if (frac === 0) {
    return y0;
  }
  const y1 = evalGridNodeFloorDepth(k0 + 1, config);
  const interpolated = y0 + (y1 - y0) * frac;
  return Math.max(
    config.terrain.minFloorDepth,
    Math.min(config.terrain.maxFloorDepth, interpolated)
  );
}

/**
 * 规范第 6.2 & 13 节：获取指定 `worldX` 处的海床斜率 `dFloorY / dX`（有符号，绝对值 <= TERRAIN_MAX_SLOPE）
 */
export function getTerrainSlopeAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): number {
  if (!Number.isFinite(worldX)) return 0;
  const stepX = config.terrain.sampleStepX;
  const k0 = Math.floor(worldX / stepX);
  const y0 = evalGridNodeFloorDepth(k0, config);
  const y1 = evalGridNodeFloorDepth(k0 + 1, config);
  return (y1 - y0) / stepX;
}

/**
 * 规范第 6.2 & 13 节：获取指定 `chunkX` 的海床采样序列 `getTerrainSamples(chunkX)`
 * 覆盖 [startX, endX] 闭区间端点（共 width / sampleStepX + 1 个点），
 * 保证 chunkX 的最后一个采样点 (worldX = endX) 与 chunkX + 1 的第一个采样点 (worldX = next.startX) 100% 恒等！
 */
export function getTerrainSamples(
  chunkX: number,
  config: WorldConfigType = WorldConfig
): TerrainChunkSamples {
  if (!Number.isInteger(chunkX)) {
    throw new Error(`[TerrainGenerator] chunkX (${chunkX}) must be an integer.`);
  }
  const cx = chunkX === 0 ? 0 : chunkX;
  const cacheKey = `${getTerrainCacheConfigPrefix(config)}:${cx}`;
  const cached = terrainChunkSamplesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const width = config.chunk.width;
  const stepX = config.terrain.sampleStepX;
  const startX = cx * width;
  const endX = startX + width;
  const stepCount = Math.round(width / stepX);
  const baseGridIndex = Math.round(startX / stepX);

  const points: TerrainSamplePoint[] = [];
  const depths: number[] = [];
  let maxAbsSlope = 0;

  for (let i = 0; i <= stepCount; i++) {
    const k = baseGridIndex + i;
    const wx = startX + i * stepX;
    const floorY = evalGridNodeFloorDepth(k, config);
    const nextFloorY = evalGridNodeFloorDepth(k + 1, config);
    const slope = (nextFloorY - floorY) / stepX;
    const absSlope = Math.abs(slope);
    if (i < stepCount && absSlope > maxAbsSlope) {
      maxAbsSlope = absSlope;
    }
    points.push({
      worldX: wx === 0 ? 0 : wx,
      floorY,
      slope,
      absSlope,
    });
    depths.push(floorY);
  }

  const result: TerrainChunkSamples = {
    chunkX: cx,
    startX: startX === 0 ? 0 : startX,
    endX: endX === 0 ? 0 : endX,
    sampleStepX: stepX,
    points,
    depths,
    maxAbsSlope,
  };

  if (terrainChunkSamplesCache.size >= MAX_TERRAIN_CHUNK_SAMPLES_CACHE_SIZE) {
    const oldestKey = terrainChunkSamplesCache.keys().next().value;
    if (oldestKey !== undefined) {
      terrainChunkSamplesCache.delete(oldestKey);
    }
  }
  terrainChunkSamplesCache.set(cacheKey, result);

  return result;
}

/**
 * 适配层辅助函数：直接以引擎米制坐标 `engineX` 查询海床米制深度 `floorEngineY`
 * 与 `getFloorDepthAt(engineX * 10)` 严格同源
 */
export function getEngineFloorDepthAt(
  engineX: number,
  config: WorldConfigType = WorldConfig
): number {
  const worldX = engineX * WORLD_UNITS_PER_METER;
  return worldYToMeterDepth(getFloorDepthAt(worldX, config));
}

/**
 * 规范第 0.6 & 11 节：贴地装饰/岩石锚点同源采样器
 * 确保贴地装饰、海床渲染、海床碰撞全部共用同一个 `getFloorDepthAt(worldX)` 数据源
 */
export function sampleSeabedAnchorAt(
  worldX: number,
  verticalOffsetWorldPx: number = 0,
  config: WorldConfigType = WorldConfig
): {
  worldX: number;
  floorY: number;
  anchorY: number;
  slope: number;
  normalAngleRad: number;
} {
  const floorY = getFloorDepthAt(worldX, config);
  const slope = getTerrainSlopeAt(worldX, config);
  return {
    worldX,
    floorY,
    anchorY: floorY + verticalOffsetWorldPx,
    slope,
    normalAngleRad: Math.atan2(-1, slope),
  };
}

// ============================================================================
// 双层海底珊瑚礁架构：浅海镂空珊瑚环礁拱台 (Shallow Coral Reef Atoll Arch Bridges)
// 完美解决「深水区不被海底山脉阻断强制上浮」与「浅水区朝任意方向游都能频繁看到海底珊瑚礁」的拓扑矛盾：
// 1. 当下方主海床处于深海 (> 920m) 时，每隔 1600m 水平单元在阳光浅水层 (350m ~ 495m) 生成一座宽约 1150m 的平顶珊瑚环礁拱台；
// 2. 拱台顶面铺设真实 `coral_reef` 海床材质带并附着生长 4 层复合大珊瑚礁盘、礁石与海草，供浅水区探索与栖息；
// 3. 拱台下方 (深度 > 620m ~ 650m) 为巨型海底玄武岩天然镂空拱门水道（配远景雾化火山岩柱支撑到底），
//    使暮光带与深渊区 (650m ~ 20,000m) 100% 畅通无阻，绝不隔断深海水平巡游！
// ============================================================================

export const SHALLOW_ATOLL_CELL_WIDTH = 1600;
export const SHALLOW_CAVE_OPENING_HALF_WIDTH = 232;
export const SHALLOW_CAVE_BOWL_HALF_WIDTH = 416;

export interface SeabedTerraceTierSpec {
  /** 海床阶梯层级索引：0 = 阳光浅海珊瑚层，1 = 上暮光礁石阶地层，2 = 中暮光海谷台地层，3 = 深暮光半深海峡谷层，4 = 深海裂谷前哨阶地层 */
  tierIndex: number;
  labelZh: string;
  biomeId: BiomeId;
  /** 连续山脊基准深度 (m) */
  baseRidgeY: number;
  /** 山脊最浅深度上限 (m) */
  minRidgeY: number;
  /** 山脊最深深度下限 (m) */
  maxRidgeY: number;
  /** 洞口下凹碗底最大视觉深度 (m) */
  maxVisualRimY: number;
  /** 实心段下方拱形洞顶目标基准深度 (m) */
  archTargetBaseY: number;
  /** 实心段下方拱形洞顶最大深度下限 (m) */
  archMaxDepthY: number;
  /** 水平单元跨度 (m) */
  cellWidth: number;
  /** 弧形下潜洞口水平错位相位偏移 (m)，使上下相邻层的洞口交错分布，下潜后必有下一层海床承接作为参照物 */
  seamPhaseOffsetX: number;
  /** 是否跳过 seamIdx === 0（仅第 0 层跳过 X=0 新手出生主海山） */
  skipZeroSeam: boolean;
  /** 物理可下潜洞口半宽 (m) */
  openingHalfWidth: number;
  /** 视觉弧形洞口后壁下凹半宽 (m) */
  bowlHalfWidth: number;
  /** 洞口后壁下弯凹陷幅度 (m) */
  bowlDropDepth: number;
  /** 仅当洞口中心下方主海床深于此值 (m) 时才开启下潜洞口 */
  minMainFloorForOpening: number;
  /** 与主海床大陆坡开始 C2 平滑嫁接的主海床深度起点 (m) */
  graftStartMainY: number;
  /** 与主海床大陆坡完成 C2 平滑嫁接的主海床深度终点 (m) */
  graftEndMainY: number;
  /** 将层底岩体完全嵌入主海床山根内部的主海床深度阈值 (m) */
  graftFuseMainY: number;
  /** 确定性噪声盐值 */
  seedSalt: number;
}

/**
 * 全水深 9 级非均匀渐进间距阶梯式连续海床配置表 (`SEABED_TERRACE_TIERS`)
 * - 每一层均采用「无悬空立柱、连续海床后壁 + 向远处弯曲的弧形下潜洞口 + 三阶地下岩层 + 双向物理碰撞」架构；
 * - 垂直间距随水深加大而逐级递增（中心步长 ΔY 依次为：+806m -> +1000m -> +1240m -> +1580m -> +2020m -> +2580m -> +3260m -> +4000m；
 *   层间净空游动走廊依次为：394m -> 575m -> 782m -> 1078m -> 1464m -> 1964m -> 2588m -> 3268m），既匹配深海巨型鲨鱼的宏大空间尺度，又保证全水深处处有海床参照物；
 * - 相邻上下层的下潜洞口通过 `seamPhaseOffsetX` 水平错开，确保鲨鱼从任一层洞口下潜后正下方必有下一层海床与礁石群落承接。
 */
export const SEABED_TERRACE_TIERS: ReadonlyArray<SeabedTerraceTierSpec> = [
  {
    tierIndex: 0,
    labelZh: '阳光浅海珊瑚海床',
    biomeId: 'coral_reef',
    baseRidgeY: 414,
    minRidgeY: 332,
    maxRidgeY: 496,
    maxVisualRimY: 648,
    archTargetBaseY: 708,
    archMaxDepthY: 736,
    cellWidth: SHALLOW_ATOLL_CELL_WIDTH,
    seamPhaseOffsetX: 0,
    skipZeroSeam: true,
    openingHalfWidth: SHALLOW_CAVE_OPENING_HALF_WIDTH,
    bowlHalfWidth: SHALLOW_CAVE_BOWL_HALF_WIDTH,
    bowlDropDepth: 148,
    minMainFloorForOpening: 680,
    graftStartMainY: 560,
    graftEndMainY: 880,
    graftFuseMainY: 760,
    seedSalt: 613,
  },
  {
    tierIndex: 1,
    labelZh: '上暮光层礁石阶地海床',
    biomeId: 'rocky_shelf',
    baseRidgeY: 1220, // ΔY = +806m（层间走廊 736m~1130m = 394m）
    minRidgeY: 1130,
    maxRidgeY: 1310,
    maxVisualRimY: 1475,
    archTargetBaseY: 1512,
    archMaxDepthY: 1545,
    cellWidth: 1800,
    seamPhaseOffsetX: 800,
    skipZeroSeam: false,
    openingHalfWidth: 248,
    bowlHalfWidth: 440,
    bowlDropDepth: 156,
    minMainFloorForOpening: 1500,
    graftStartMainY: 1370,
    graftEndMainY: 1710,
    graftFuseMainY: 1575,
    seedSalt: 1619,
  },
  {
    tierIndex: 2,
    labelZh: '中暮光层海谷台地海床',
    biomeId: 'rocky_shelf',
    baseRidgeY: 2220, // ΔY = +1000m（层间走廊 1545m~2120m = 575m）
    minRidgeY: 2120,
    maxRidgeY: 2320,
    maxVisualRimY: 2495,
    archTargetBaseY: 2532,
    archMaxDepthY: 2568,
    cellWidth: 2000,
    seamPhaseOffsetX: 350,
    skipZeroSeam: false,
    openingHalfWidth: 266,
    bowlHalfWidth: 468,
    bowlDropDepth: 164,
    minMainFloorForOpening: 2520,
    graftStartMainY: 2380,
    graftEndMainY: 2750,
    graftFuseMainY: 2600,
    seedSalt: 2633,
  },
  {
    tierIndex: 3,
    labelZh: '深暮光半深海峡谷海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 3460, // ΔY = +1240m（层间走廊 2568m~3350m = 782m）
    minRidgeY: 3350,
    maxRidgeY: 3570,
    maxVisualRimY: 3755,
    archTargetBaseY: 3792,
    archMaxDepthY: 3832,
    cellWidth: 2200,
    seamPhaseOffsetX: 1100,
    skipZeroSeam: false,
    openingHalfWidth: 284,
    bowlHalfWidth: 496,
    bowlDropDepth: 172,
    minMainFloorForOpening: 3780,
    graftStartMainY: 3630,
    graftEndMainY: 4030,
    graftFuseMainY: 3865,
    seedSalt: 3671,
  },
  {
    tierIndex: 4,
    labelZh: '半深海裂谷前哨阶地海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 5040, // ΔY = +1580m（层间走廊 3832m~4910m = 1078m）
    minRidgeY: 4910,
    maxRidgeY: 5170,
    maxVisualRimY: 5365,
    archTargetBaseY: 5402,
    archMaxDepthY: 5446,
    cellWidth: 2400,
    seamPhaseOffsetX: 600,
    skipZeroSeam: false,
    openingHalfWidth: 302,
    bowlHalfWidth: 524,
    bowlDropDepth: 180,
    minMainFloorForOpening: 5390,
    graftStartMainY: 5230,
    graftEndMainY: 5660,
    graftFuseMainY: 5480,
    seedSalt: 4723,
  },
  {
    tierIndex: 5,
    labelZh: '深海玄武岩断崖海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 7060, // ΔY = +2020m（层间走廊 5446m~6910m = 1464m）
    minRidgeY: 6910,
    maxRidgeY: 7210,
    maxVisualRimY: 7420,
    archTargetBaseY: 7456,
    archMaxDepthY: 7506,
    cellWidth: 2600,
    seamPhaseOffsetX: 1500,
    skipZeroSeam: false,
    openingHalfWidth: 324,
    bowlHalfWidth: 560,
    bowlDropDepth: 192,
    minMainFloorForOpening: 7440,
    graftStartMainY: 7270,
    graftEndMainY: 7740,
    graftFuseMainY: 7545,
    seedSalt: 5801,
  },
  {
    tierIndex: 6,
    labelZh: '深渊幽冥海盆阶地海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 9640, // ΔY = +2580m（层间走廊 7506m~9470m = 1964m）
    minRidgeY: 9470,
    maxRidgeY: 9810,
    maxVisualRimY: 10030,
    archTargetBaseY: 10066,
    archMaxDepthY: 10122,
    cellWidth: 2900,
    seamPhaseOffsetX: 700,
    skipZeroSeam: false,
    openingHalfWidth: 350,
    bowlHalfWidth: 604,
    bowlDropDepth: 206,
    minMainFloorForOpening: 10050,
    graftStartMainY: 9880,
    graftEndMainY: 10380,
    graftFuseMainY: 10165,
    seedSalt: 6883,
  },
  {
    tierIndex: 7,
    labelZh: '超深渊黑曜石裂谷海床',
    biomeId: 'deep_abyss',
    baseRidgeY: 12900, // ΔY = +3260m（层间走廊 10122m~12710m = 2588m）
    minRidgeY: 12710,
    maxRidgeY: 13090,
    maxVisualRimY: 13324,
    archTargetBaseY: 13360,
    archMaxDepthY: 13422,
    cellWidth: 3200,
    seamPhaseOffsetX: 1900,
    skipZeroSeam: false,
    openingHalfWidth: 380,
    bowlHalfWidth: 652,
    bowlDropDepth: 222,
    minMainFloorForOpening: 13340,
    graftStartMainY: 13160,
    graftEndMainY: 13700,
    graftFuseMainY: 13470,
    seedSalt: 7949,
  },
  {
    tierIndex: 8,
    labelZh: '冥渊海沟热液前哨海床',
    biomeId: 'deep_abyss',
    baseRidgeY: 16900, // ΔY = +4000m（层间走廊 13422m~16690m = 3268m）
    minRidgeY: 16690,
    maxRidgeY: 17110,
    maxVisualRimY: 17360,
    archTargetBaseY: 17396,
    archMaxDepthY: 17464,
    cellWidth: 3600,
    seamPhaseOffsetX: 900,
    skipZeroSeam: false,
    openingHalfWidth: 416,
    bowlHalfWidth: 710,
    bowlDropDepth: 240,
    minMainFloorForOpening: 17370,
    graftStartMainY: 17180,
    graftEndMainY: 17760,
    graftFuseMainY: 17515,
    seedSalt: 9013,
  },
];

export interface ShallowCoralAtollSample {
  /** 当前横坐标是否处于前景实心海床碰撞段内（弧形下潜洞口处为 false，允许自由向下/向上进出洞口） */
  active: boolean;
  /** 所属海床阶梯层级索引 (0..8) */
  tierIndex?: number;
  /** 当前横坐标是否处于向远处弯曲的弧形下潜洞口区间 */
  isDiveOpening?: boolean;
  /** 下潜洞口向远处弧形凹陷程度 ∈ [0, 1]（0 = 前景实心海床，1 = 弧形下潜洞口正中心） */
  openingDepthFactor?: number;
  /** 连续海床视觉表层深度 (m / worldPx)：实心段等于 topFloorY，洞口段沿向远处的下凹弧线平滑延伸，确保海床 100% 连续不断开 */
  visualRimY?: number;
  /** 连续海床视觉表层局部斜率 d(visualRimY)/dX */
  visualRimSlope?: number;
  /** 所属环礁/阶地单元索引 */
  atollIndex: number;
  /** 前景实心海床表面深度 (m / worldPx) */
  topFloorY: number;
  /** 下方玄武岩拱形洞顶底界深度 (m / worldPx)；实心段从下向上游动在此高度被洞顶阻挡，此深度以下的深水走廊 100% 畅通 */
  bottomArchY: number;
  /** 海床顶面局部斜率 d(topFloorY)/dX */
  slope: number;
  /** 下方拱形洞顶局部斜率 d(bottomArchY)/dX（用于从下向上接触洞顶滑行时的切向投影） */
  bottomSlope?: number;
  /** 实心平台边缘平滑包络 ∈ [0, 1]（实心段中心为 1，向两侧弧形洞口平滑归零） */
  edgeWeight: number;
  /** 单元左端实心起点 X */
  archStartX: number;
  /** 单元右端实心终点 X */
  archEndX: number;
}

function evalTerraceSeabedContinuousRaw(
  worldX: number,
  tier: SeabedTerraceTierSpec,
  config: WorldConfigType
): {
  rawRidgeY: number;
  dRidgeDx: number;
  visualRimY: number;
  visualRimSlope: number;
  topY: number;
  slope: number;
  edgeWeight: number;
  openingDepthFactor: number;
  isDiveOpening: boolean;
  bottomArchY: number;
  bottomSlope: number;
  nearestOpenSeamX: number;
} {
  const seedPhase =
    (((config.worldSeed + tier.seedSalt * 131) & 0xffff) / 65536) * Math.PI * 2;
  const cellWave = evalSmoothTerrainWave(worldX, tier.cellWidth, tier.seedSalt, config);
  const k1 = (Math.PI * 2) / (1180 + tier.tierIndex * 110);
  const k2 = (Math.PI * 2) / (560 + tier.tierIndex * 45);
  const k3 = (Math.PI * 2) / (290 + tier.tierIndex * 22);
  const k4 = (Math.PI * 2) / 155;

  // 100% 跨全图 C1 连续的各层山峦基准曲线（绝无跨单元跳变）
  const ampScale = 1 + tier.tierIndex * 0.08;
  const w1 = Math.sin(worldX * k1 + seedPhase) * (32 * ampScale);
  const w2 = Math.cos(worldX * k2 - seedPhase * 0.7 + 1.1) * (20 * ampScale);
  const w3 = Math.sin(worldX * k3 + seedPhase * 1.3 + 2.4) * (11 * ampScale);
  const w4 = Math.cos(worldX * k4 - seedPhase * 0.4 + 0.6) * 5;
  const rawRidgeY = Math.max(
    tier.minRidgeY,
    Math.min(tier.maxRidgeY, tier.baseRidgeY + cellWave * (22 * ampScale) + w1 + w2 + w3 + w4)
  );

  const dRidgeDx =
    Math.cos(worldX * k1 + seedPhase) * (32 * ampScale * k1) -
    Math.sin(worldX * k2 - seedPhase * 0.7 + 1.1) * (20 * ampScale * k2) +
    Math.cos(worldX * k3 + seedPhase * 1.3 + 2.4) * (11 * ampScale * k3) -
    Math.sin(worldX * k4 - seedPhase * 0.4 + 0.6) * (5 * k4);

  // 定位最近的弧形下潜洞口中心（第 0 层排除 X=0 新手出生主海山中心；中层按 seamPhaseOffsetX 错位排布）
  const shiftedX = worldX - tier.seamPhaseOffsetX;
  const rawSeamIdx = Math.round(shiftedX / tier.cellWidth);
  const nearestOpenSeamIdx = tier.skipZeroSeam
    ? shiftedX >= 0
      ? Math.max(1, rawSeamIdx)
      : Math.min(-1, rawSeamIdx)
    : rawSeamIdx;
  const nearestOpenSeamX = nearestOpenSeamIdx * tier.cellWidth + tier.seamPhaseOffsetX;
  const distFromSeam = worldX - nearestOpenSeamX;
  const absDist = Math.abs(distFromSeam);

  // 仅当洞口中心下方主海床足够深 (> minMainFloorForOpening) 时才形成下潜洞口
  const seamMainFloorY = getFloorDepthAt(nearestOpenSeamX, config);
  const hasOpeningAtSeam = seamMainFloorY > tier.minMainFloorForOpening;

  let openingDepthFactor = 0;
  let dOpeningFactorDx = 0;
  if (hasOpeningAtSeam && absDist < tier.bowlHalfWidth) {
    const rimNorm = absDist / tier.bowlHalfWidth;
    openingDepthFactor = 0.5 * (1 + Math.cos(rimNorm * Math.PI));
    if (absDist > 1e-4) {
      dOpeningFactorDx =
        -0.5 *
        (Math.PI / tier.bowlHalfWidth) *
        Math.sin(rimNorm * Math.PI) *
        (distFromSeam >= 0 ? 1 : -1);
    }
  }

  // 连续海床视觉表层：在弧形下潜洞口区间平滑向远处深海下弯凹陷 (+bowlDropDepth)，形成向下的弧形洞口后壁
  const bowlPower = 1.35;
  const archBowlDrop =
    openingDepthFactor > 0
      ? tier.bowlDropDepth * Math.pow(openingDepthFactor, bowlPower)
      : 0;
  const dArchBowlDropDx =
    openingDepthFactor > 1e-4
      ? tier.bowlDropDepth *
        bowlPower *
        Math.pow(openingDepthFactor, bowlPower - 1) *
        dOpeningFactorDx
      : 0;

  const visualRimY = Math.max(
    tier.minRidgeY - 7,
    Math.min(tier.maxVisualRimY, rawRidgeY + archBowlDrop)
  );
  const visualRimSlope = Math.max(-0.82, Math.min(0.82, dRidgeDx + dArchBowlDropDx));

  const isDiveOpening = hasOpeningAtSeam && absDist < tier.openingHalfWidth;

  // 实心前景海床权重：在洞口边缘平滑过渡，使两侧洞唇圆润饱满
  const edgeWeight = !hasOpeningAtSeam
    ? 1
    : isDiveOpening
    ? 0
    : quinticSmoothstep(
        tier.openingHalfWidth,
        tier.openingHalfWidth + 160,
        absDist
      );

  const topY = visualRimY;
  const slope = visualRimSlope;

  // 下方拱形洞顶与洞口两侧向下弯曲的洞壁曲线 bottomArchY：
  // 1) 在洞口两侧唇口沿陡峭弧线从 topY + 42m 向下弯曲至 archTargetBaseY，形成天然向下的洞口左右岩壁；
  // 2) 在实心海床腹地保持深厚岩体，同时确保层间水平水道 100% 畅通无阻
  const wallDropRaw = !hasOpeningAtSeam
    ? 1
    : isDiveOpening
    ? 0
    : quinticSmoothstep(
        tier.openingHalfWidth,
        tier.openingHalfWidth + 115,
        absDist
      );
  const wallDropT = wallDropRaw > 0 ? Math.pow(wallDropRaw, 0.62) : 0;

  const stalactiteWave =
    Math.sin(worldX * 0.017 + seedPhase * 1.1) * 14 +
    Math.cos(worldX * 0.029 - seedPhase * 0.6) * 8;
  const dStalactiteDx =
    Math.cos(worldX * 0.017 + seedPhase * 1.1) * (14 * 0.017) -
    Math.sin(worldX * 0.029 - seedPhase * 0.6) * (8 * 0.029);

  const lipArchY = topY + 42;
  const targetDeepArchY = Math.max(
    topY + 195,
    Math.min(tier.archMaxDepthY, tier.archTargetBaseY + stalactiteWave)
  );
  const bottomArchY = lipArchY + (targetDeepArchY - lipArchY) * wallDropT;
  const bottomSlope = Math.max(
    -0.85,
    Math.min(0.85, slope * (1 - 0.5 * wallDropT) + wallDropT * dStalactiteDx)
  );

  return {
    rawRidgeY,
    dRidgeDx,
    visualRimY,
    visualRimSlope,
    topY,
    slope,
    edgeWeight,
    openingDepthFactor,
    isDiveOpening,
    bottomArchY,
    bottomSlope,
    nearestOpenSeamX,
  };
}

/**
 * 查询任意横坐标 `worldX` 与指定层级 `tierIndex (0..4)` 处的连续阶梯海床及弧形下潜洞口状态
 */
export function getSeabedTerraceAt(
  worldX: number,
  tierIndex: number,
  config: WorldConfigType = WorldConfig
): ShallowCoralAtollSample {
  const tier = SEABED_TERRACE_TIERS[tierIndex] ?? SEABED_TERRACE_TIERS[0];
  if (!Number.isFinite(worldX) || config.terrain.minFloorDepth > 600) {
    return {
      active: false,
      tierIndex: tier.tierIndex,
      isDiveOpening: false,
      openingDepthFactor: 0,
      visualRimY: tier.baseRidgeY,
      visualRimSlope: 0,
      atollIndex: 0,
      topFloorY: tier.baseRidgeY,
      bottomArchY: tier.archTargetBaseY,
      slope: 0,
      bottomSlope: 0,
      edgeWeight: 0,
      archStartX: 0,
      archEndX: 0,
    };
  }

  const shiftedX = worldX - tier.seamPhaseOffsetX;
  const cellIdx = Math.floor(shiftedX / tier.cellWidth);
  const archStartX =
    tier.skipZeroSeam && cellIdx === 0
      ? 0
      : cellIdx * tier.cellWidth + tier.seamPhaseOffsetX + tier.openingHalfWidth;
  const archEndX =
    tier.skipZeroSeam && cellIdx === -1
      ? 0
      : (cellIdx + 1) * tier.cellWidth + tier.seamPhaseOffsetX - tier.openingHalfWidth;

  const raw = evalTerraceSeabedContinuousRaw(worldX, tier, config);
  const mainFloorY = getFloorDepthAt(worldX, config);
  const mainSlope = getTerrainSlopeAt(worldX, config);

  // 当主海床本身浅于当前层的嫁接起点 (mainFloorY <= graftStartMainY) 时，
  // 仅保留主海床或更浅层本体，绝不在主海床山体内或上方叠加多余海床！
  if (mainFloorY <= tier.graftStartMainY) {
    return {
      active: false,
      tierIndex: tier.tierIndex,
      isDiveOpening: false,
      openingDepthFactor: 0,
      visualRimY: mainFloorY,
      visualRimSlope: mainSlope,
      atollIndex: cellIdx === 0 ? 0 : cellIdx,
      topFloorY: mainFloorY,
      bottomArchY: Math.max(raw.bottomArchY, mainFloorY + 60),
      slope: mainSlope,
      bottomSlope: mainSlope,
      edgeWeight: 0,
      archStartX,
      archEndX,
    };
  }

  // 在主海床大陆坡与当前层连续海床交汇处 ([graftStartMainY, graftEndMainY]) 做 C2 平滑嫁接，
  // 且当 mainFloorY < graftFuseMainY 时将底部岩体完全嵌入主海床山根内部，彻底杜绝双层夹缝！
  const graftT = quinticSmoothstep(tier.graftStartMainY, tier.graftEndMainY, mainFloorY);
  const graftedTopY = mainFloorY + (raw.topY - mainFloorY) * graftT;
  const graftedVisualRimY = mainFloorY + (raw.visualRimY - mainFloorY) * graftT;
  const graftedSlope = mainSlope + (raw.slope - mainSlope) * graftT;
  const graftedVisualSlope = mainSlope + (raw.visualRimSlope - mainSlope) * graftT;
  const graftedBottomArchY =
    mainFloorY < tier.graftFuseMainY
      ? Math.max(
          raw.bottomArchY,
          Math.min(tier.archMaxDepthY + 6, mainFloorY + 48 * (1 - graftT * 0.5))
        )
      : Math.min(mainFloorY - 22, Math.max(graftedTopY + 42, raw.bottomArchY));
  const graftedEdgeWeight = raw.edgeWeight * graftT;

  return {
    active: !raw.isDiveOpening && graftedEdgeWeight > 0.02,
    tierIndex: tier.tierIndex,
    isDiveOpening: raw.isDiveOpening,
    openingDepthFactor: raw.openingDepthFactor * graftT,
    visualRimY: graftedVisualRimY,
    visualRimSlope: graftedVisualSlope,
    atollIndex: cellIdx === 0 ? 0 : cellIdx,
    topFloorY: graftedTopY,
    bottomArchY: graftedBottomArchY,
    slope: graftedSlope,
    bottomSlope: raw.bottomSlope * graftT + mainSlope * (1 - graftT),
    edgeWeight: graftedEdgeWeight,
    archStartX,
    archEndX,
  };
}

/**
 * 查询任意横坐标 `worldX` 处所有 5 层阶梯海床的状态列表
 */
export function getAllSeabedTerracesAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): ShallowCoralAtollSample[] {
  return SEABED_TERRACE_TIERS.map((tier) =>
    getSeabedTerraceAt(worldX, tier.tierIndex, config)
  );
}

/**
 * 查询任意横坐标 `worldX` 处的第 0 层（阳光浅海珊瑚层）连续海床与弧形下潜洞口状态 `getShallowCoralAtollAt(worldX, config)`
 */
export function getShallowCoralAtollAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): ShallowCoralAtollSample {
  return getSeabedTerraceAt(worldX, 0, config);
}

export interface ShallowCoralAtollOutcrop {
  id: string;
  type: 'coral' | 'rock' | 'seagrass';
  variant: string;
  worldX: number;
  floorY: number;
  slope: number;
  scale: number;
  seedHash: number;
  biomeId: BiomeId;
  tierIndex?: number;
}

const MAX_ATOLL_OUTCROP_CACHE_SIZE = 64;
const shallowAtollOutcropCache = new Map<string, ReadonlyArray<ShallowCoralAtollOutcrop>>();

/**
 * 获取指定水平 `chunkX` 内浅海及全部中层阶梯海床 (`tierIndex = 0..4`) 顶面附着生长的珊瑚礁盘、共生礁石与海草群落
 * 100% 确定性、紧贴各层 `terrace.topFloorY` 生长，让鲨鱼在浅海与广阔中层海域游动时始终有丰富的海底地貌与生态参照物！
 */
export function getShallowCoralAtollOutcropsForChunk(
  chunkX: number,
  config: WorldConfigType = WorldConfig
): ReadonlyArray<ShallowCoralAtollOutcrop> {
  if (!Number.isInteger(chunkX) || config.terrain.minFloorDepth > 600) {
    return [];
  }
  const cx = chunkX === 0 ? 0 : chunkX;
  const cacheKey = `${config.worldSeed}:${config.generatorVersion}:${cx}`;
  const cached = shallowAtollOutcropCache.get(cacheKey);
  if (cached) return cached;

  const startX = cx * config.chunk.width;
  const endX = startX + config.chunk.width;
  const outcrops: ShallowCoralAtollOutcrop[] = [];

  // 按 tierIndex = 0..8 依次生成各层海床顶面附着物（第 0 层排在最前，确保浅海珊瑚采样索引稳定）
  for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
    const tier = SEABED_TERRACE_TIERS[tIdx];
    const slotStep = tIdx === 0 ? 150 : 195 + tIdx * 18;
    const firstSlot = Math.ceil(startX / slotStep);
    const lastSlot = Math.floor((endX - 1) / slotStep);

    for (let slot = firstSlot; slot <= lastSlot; slot++) {
      const slotSeed = mixSubsystemSeed(
        config.worldSeed,
        config.generatorVersion,
        slot,
        733 + tIdx * 317,
        'flora'
      );
      const jitter = (((slotSeed % 1000) / 1000) - 0.5) * (tIdx === 0 ? 68 : 88);
      const wx = Math.max(startX + 24, Math.min(endX - 24, slot * slotStep + jitter));
      const terrace = getSeabedTerraceAt(wx, tIdx, config);
      if (!terrace.active || terrace.edgeWeight < 0.18) continue;

      const typeRoll = (slotSeed >>> 10) % 100;
      const type: 'coral' | 'rock' | 'seagrass' =
        tIdx === 0
          ? typeRoll < 58
            ? 'coral'
            : typeRoll < 82
            ? 'rock'
            : 'seagrass'
          : tIdx <= 2
          ? typeRoll < 44
            ? 'rock'
            : typeRoll < 78
            ? 'coral'
            : 'seagrass'
          : tIdx <= 5
          ? typeRoll < 56
            ? 'rock'
            : typeRoll < 86
            ? 'coral'
            : 'seagrass'
          : typeRoll < 72
          ? 'rock'
          : typeRoll < 92
          ? 'coral'
          : 'seagrass';

      const variants =
        type === 'coral'
          ? tIdx === 0
            ? (['staghorn', 'brain_coral', 'fan_coral', 'tube_sponge'] as const)
            : (['fan_coral', 'tube_sponge', 'brain_coral'] as const)
          : type === 'rock'
          ? (['mossy_slab', 'basalt_boulder', 'jagged_spire'] as const)
          : (['meadow_tuft', 'ribbon_grass'] as const);
      const variant = variants[(slotSeed >>> 17) % variants.length];
      const scale = Number(
        ((tIdx === 0 ? 0.88 : 0.94) + ((slotSeed >>> 21) % 100) * 0.0052).toFixed(3)
      );

      outcrops.push({
        id:
          tIdx === 0
            ? `atoll_outcrop_${cx}_${slot}`
            : `terrace_${tIdx}_outcrop_${cx}_${slot}`,
        type,
        variant,
        worldX: wx,
        floorY: terrace.topFloorY,
        slope: terrace.slope,
        scale,
        seedHash: slotSeed,
        biomeId: tier.biomeId,
        tierIndex: tIdx,
      });
    }
  }

  if (shallowAtollOutcropCache.size >= MAX_ATOLL_OUTCROP_CACHE_SIZE) {
    const oldestKey = shallowAtollOutcropCache.keys().next().value;
    if (oldestKey !== undefined) {
      shallowAtollOutcropCache.delete(oldestKey);
    }
  }
  shallowAtollOutcropCache.set(cacheKey, outcrops);
  return outcrops;
}

/**
 * 规范第 0.6 & 11 节：1.0x 世界层海床双向（顶面承托 + 洞顶阻挡）物理碰撞解算纯函数
 * 同时支持：
 * 1) 连续主海床 `getFloorDepthAt(worldX)`；
 * 2) 浅海与中层 5 级连续阶梯海床 `getSeabedTerraceAt(worldX, tierIndex)` (`tierIndex = 0..4`)：
 *    - 当实体位于某一层海床上方 (`refY <= topFloorY + 4`) 时，受该层顶面 `topFloorY - safeRadius` 向上承托；
 *    - 当实体位于某一层海床下方 (`refY > topFloorY + 4`) 向上游动时，受该层拱形洞顶 `bottomArchY + safeRadius` 向下阻挡（彻底杜绝从下向上穿透任何浅层或中层海床！）；
 *    - 在各层弧形下潜洞口 (`isDiveOpening === true`) 及层间水平水道走廊 100% 畅通无阻；
 * 3) 输出切向弧长投影系数 `tangentScale = 1 / sqrt(1 + slope^2)` 以消除斜坡游动速度异常。
 */
export interface SeabedCollisionResult {
  engineX: number;
  engineY: number;
  vy: number;
  collided: boolean;
  floorWorldY: number;
  floorEngineY: number;
  slope: number;
  /** 斜坡单位切向量水平分量 cos(theta) = 1 / sqrt(1 + slope^2)，用于归一化沿地形游动速度 */
  tangentScale: number;
  /** 是否碰撞在浅海或中层阶梯海床段（顶面或底部拱顶） */
  onShallowAtoll?: boolean;
  /** 是否从下方撞击阶梯海床底部拱形洞顶（阻挡向上穿透） */
  hitAtollUnderside?: boolean;
  /** 发生碰撞的阶梯海床层级索引 (0..4) */
  terraceTierIndex?: number;
}

export function resolveSeabedCollision(
  engineX: number,
  engineY: number,
  entityRadiusMeters: number,
  vy: number,
  config: WorldConfigType = WorldConfig,
  prevEngineY?: number
): SeabedCollisionResult {
  const worldX = engineX * WORLD_UNITS_PER_METER;
  const safeRadius = Math.max(0, entityRadiusMeters);

  const floorWorldY = getFloorDepthAt(worldX, config);
  const mainSlope = getTerrainSlopeAt(worldX, config);
  const floorEngineY = worldYToMeterDepth(floorWorldY);
  const maxAllowedMainY = floorEngineY - safeRadius;
  const mainTangentScale = 1 / Math.sqrt(1 + mainSlope * mainSlope);

  const refY =
    prevEngineY !== undefined && Number.isFinite(prevEngineY) ? prevEngineY : engineY;

  // 依次检查浅海及中层 5 级连续阶梯海床实心段（洞口区间 terrace.active === false，允许自由下潜与上浮）
  for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
    const tierSpec = SEABED_TERRACE_TIERS[tIdx];
    // 快速高度粗筛：若当前实体与参考点均远离该层海床高度带，则直接跳过
    const bandMinY = tierSpec.minRidgeY - safeRadius - 120;
    const bandMaxY = tierSpec.archMaxDepthY + safeRadius + 120;
    if (
      (engineY < bandMinY && refY < bandMinY) ||
      (engineY > bandMaxY && refY > bandMaxY)
    ) {
      continue;
    }

    const terrace = getSeabedTerraceAt(worldX, tIdx, config);
    if (!terrace.active) continue;

    const topAllowedY = terrace.topFloorY - safeRadius;
    const bottomAllowedY = terrace.bottomArchY + safeRadius;

    // 严格区分「该层海床上方」与「该层海床下方」：凡起始高度位于表层以下 (refY > topFloorY + 4) 的实体一律归属该层下方，严禁向上穿透至表层！
    const isFromBelow =
      refY > terrace.topFloorY + 4 ||
      (refY > terrace.topFloorY - safeRadius * 0.25 && vy < -1e-3);

    if (!isFromBelow) {
      // 仅当实体从上方接触或陷入当前层岩体区间时触发顶面承托
      if (engineY > topAllowedY && refY >= tierSpec.minRidgeY - safeRadius - 260) {
        const atollTangentScale = 1 / Math.sqrt(1 + terrace.slope * terrace.slope);
        return {
          engineX,
          engineY: topAllowedY,
          vy: vy > 0 ? -vy * 0.12 : vy,
          collided: true,
          floorWorldY: meterDepthToWorldY(terrace.topFloorY),
          floorEngineY: terrace.topFloorY,
          slope: terrace.slope,
          tangentScale: atollTangentScale,
          onShallowAtoll: true,
          hitAtollUnderside: false,
          terraceTierIndex: tIdx,
        };
      }
    } else {
      // 实体位于当前层海床下方且向上触及拱形洞顶 (engineY < bottomAllowedY)：向下阻挡在洞顶之下
      if (engineY < bottomAllowedY && refY <= tierSpec.archMaxDepthY + safeRadius + 260) {
        const bSlope = terrace.bottomSlope ?? terrace.slope;
        const bTangentScale = 1 / Math.sqrt(1 + bSlope * bSlope);
        const clampedUnderY = Math.min(maxAllowedMainY, bottomAllowedY);
        return {
          engineX,
          engineY: clampedUnderY,
          vy: vy < 0 ? -vy * 0.15 : vy,
          collided: true,
          floorWorldY: meterDepthToWorldY(terrace.bottomArchY),
          floorEngineY: terrace.bottomArchY,
          slope: bSlope,
          tangentScale: bTangentScale,
          onShallowAtoll: true,
          hitAtollUnderside: true,
          terraceTierIndex: tIdx,
        };
      }
    }
  }

  if (engineY > maxAllowedMainY) {
    return {
      engineX,
      engineY: maxAllowedMainY,
      vy: vy > 0 ? -vy * 0.12 : vy,
      collided: true,
      floorWorldY,
      floorEngineY,
      slope: mainSlope,
      tangentScale: mainTangentScale,
      onShallowAtoll: false,
      hitAtollUnderside: false,
    };
  }

  return {
    engineX,
    engineY,
    vy,
    collided: false,
    floorWorldY,
    floorEngineY,
    slope: mainSlope,
    tangentScale: mainTangentScale,
    onShallowAtoll: false,
    hitAtollUnderside: false,
  };
}

/**
 * 海床斜坡切向等速运动与拱顶防穿透解算器 `resolveSeabedKineticStep`
 * 1) 顺着地形上坡/下坡游动时，将步长投影至海床单位切向量，消除顺地形游动速度异常放大；
 * 2) 从浅层或中层海床下方朝上游动或冲刺时，严格锁定 `prevEngineY` 归属侧并阻挡在拱形洞顶 `bottomArchY + radius` 之下，
 *    当洞顶与主海床交汇处楔形高度小于实体直径时阻止水平挤入山根，100% 杜绝从下向上穿透任何海床层！
 */
export interface SeabedKineticStepResult {
  engineX: number;
  engineY: number;
  vx: number;
  vy: number;
  collided: boolean;
  collision: SeabedCollisionResult;
  /** 本帧沿地形的实际二维合速度 (m/s) */
  effectiveSpeed2D: number;
}

export function resolveSeabedKineticStep(
  prevEngineX: number,
  prevEngineY: number,
  vx: number,
  vy: number,
  simDt: number,
  entityRadiusMeters: number,
  config: WorldConfigType = WorldConfig
): SeabedKineticStepResult {
  const dt = Math.max(1e-6, simDt);
  const intendedSpeed = Math.hypot(vx, vy);
  const maxAllowedStepDist = intendedSpeed * dt;

  const rawNextX = prevEngineX + vx * dt;
  const rawNextY = prevEngineY + vy * dt;

  const initialCol = resolveSeabedCollision(
    rawNextX,
    rawNextY,
    entityRadiusMeters,
    vy,
    config,
    prevEngineY
  );

  if (!initialCol.collided) {
    return {
      engineX: rawNextX,
      engineY: rawNextY,
      vx,
      vy,
      collided: false,
      collision: initialCol,
      effectiveSpeed2D: intendedSpeed,
    };
  }

  // 分支 A：从下方撞击浅海或中层海床底部拱形洞顶（阻挡向上穿透并沿拱顶切向平滑滑行）
  if (initialCol.hitAtollUnderside) {
    const hitTierIdx = initialCol.terraceTierIndex ?? 0;
    const bTangentScale = initialCol.tangentScale;
    let adjustedDx = vx * dt * bTangentScale * 0.92;
    let finalX = prevEngineX + adjustedDx;

    // 若目标 X 处于当前层拱顶与主海床山腰交汇的狭窄山根楔形区内（垂直净空 < 2 * radius + 4），阻止水平挤入山根以防穿模
    const nextTerrace = getSeabedTerraceAt(
      finalX * WORLD_UNITS_PER_METER,
      hitTierIdx,
      config
    );
    const nextMainFloorY = getEngineFloorDepthAt(finalX, config);
    if (
      nextTerrace.active &&
      nextMainFloorY - nextTerrace.bottomArchY < entityRadiusMeters * 2 + 4
    ) {
      finalX = prevEngineX;
      adjustedDx = 0;
    }

    const secondCol = resolveSeabedCollision(
      finalX,
      rawNextY,
      entityRadiusMeters,
      vy,
      config,
      prevEngineY
    );
    let finalY = secondCol.collided
      ? secondCol.engineY
      : Math.max(rawNextY, initialCol.engineY);

    const actualStepDist = Math.hypot(finalX - prevEngineX, finalY - prevEngineY);
    if (
      actualStepDist > maxAllowedStepDist &&
      actualStepDist > 1e-6 &&
      maxAllowedStepDist > 1e-6
    ) {
      const shrink = maxAllowedStepDist / actualStepDist;
      finalX = prevEngineX + (finalX - prevEngineX) * shrink;
      const clampedCol = resolveSeabedCollision(
        finalX,
        prevEngineY + (finalY - prevEngineY) * shrink,
        entityRadiusMeters,
        vy,
        config,
        prevEngineY
      );
      finalY = clampedCol.collided
        ? clampedCol.engineY
        : Math.max(
            prevEngineY + (finalY - prevEngineY) * shrink,
            initialCol.engineY
          );
    }

    const nextVx = adjustedDx === 0 ? vx * 0.35 : vx * 0.92;
    const nextVy = Math.max(0, initialCol.vy, ((finalY - prevEngineY) / dt) * 0.35);
    const effectiveSpeed2D = Math.hypot(finalX - prevEngineX, finalY - prevEngineY) / dt;

    return {
      engineX: finalX,
      engineY: finalY,
      vx: nextVx,
      vy: nextVy,
      collided: true,
      collision: secondCol,
      effectiveSpeed2D,
    };
  }

  // 分支 B：实体与海床顶面发生接触，根据局部斜率 slope 的单位切向量归一化水平步长
  const slope = initialCol.slope;
  const tangentScale = initialCol.tangentScale; // 1 / sqrt(1 + slope^2)
  const isMovingUphill = vx * slope < -1e-4;

  let adjustedDx = vx * dt;
  let nextVx = vx;
  let nextVy = initialCol.vy;

  if (isMovingUphill) {
    // 顺着斜坡上坡游动：将水平步长严格缩放为 cos(theta) * 0.90，使斜向二维合成弧长 = 0.90 * |vx| * dt
    const uphillScale = tangentScale * 0.90;
    adjustedDx = vx * dt * uphillScale;
    nextVx = vx * (0.72 + 0.28 * uphillScale);
  } else {
    // 下坡或贴底滑行：将速度矢量 (vx, vy) 投影到海床切向 T = (tangentScale, slope * tangentScale)，并限制切向速率 <= intendedSpeed
    const tangentSpeed = Math.max(
      -intendedSpeed,
      Math.min(intendedSpeed, (vx + Math.max(0, vy) * slope * 0.65) * tangentScale)
    );
    adjustedDx = tangentSpeed * tangentScale * dt;
    nextVx = vx * 0.92;
  }

  let finalX = prevEngineX + adjustedDx;
  const secondCol = resolveSeabedCollision(
    finalX,
    rawNextY,
    entityRadiusMeters,
    vy,
    config,
    prevEngineY
  );
  let finalY = secondCol.collided ? secondCol.engineY : rawNextY;

  // 二维弧长终极守恒钳制：确保任何斜坡贴地步进的 2D 总位移绝不超过平水位移上限（上坡最高 0.92x，下坡最高 1.0x）
  const speedCapRatio = isMovingUphill ? 0.92 : 1.0;
  const maxArcDist = maxAllowedStepDist * speedCapRatio;
  const actualStepDist = Math.hypot(finalX - prevEngineX, finalY - prevEngineY);

  if (actualStepDist > maxArcDist && actualStepDist > 1e-6 && maxAllowedStepDist > 1e-6) {
    const shrink = maxArcDist / actualStepDist;
    finalX = prevEngineX + (finalX - prevEngineX) * shrink;
    const clampedCol = resolveSeabedCollision(
      finalX,
      prevEngineY + (finalY - prevEngineY) * shrink,
      entityRadiusMeters,
      vy,
      config,
      prevEngineY
    );
    finalY = clampedCol.collided
      ? clampedCol.engineY
      : prevEngineY + (finalY - prevEngineY) * shrink;
  }

  if (isMovingUphill && finalY < prevEngineY) {
    // 赋予柔和的切向爬坡垂直速度反馈，避免镜头垂直抖动
    nextVy = Math.max(-intendedSpeed * 0.65, ((finalY - prevEngineY) / dt) * 0.45);
  }

  const finalEffectiveSpeed = Math.hypot(finalX - prevEngineX, finalY - prevEngineY) / dt;

  return {
    engineX: finalX,
    engineY: finalY,
    vx: nextVx,
    vy: nextVy,
    collided: true,
    collision: secondCol,
    effectiveSpeed2D: finalEffectiveSpeed,
  };
}

/**
 * 规范第 0.6 & 11 节：在 1.0x 世界空间渲染可碰撞的实体海床地壳层与多层《world_seabed_strips》手绘轮廓材质
 * 同时绘制：
 * 1) 浅海与中层 5 级连续阶梯海床 (`SEABED_TERRACE_TIERS`) 与向远处弧形弯曲的下潜洞口（取消悬空立柱，各层海床 100% 连续不断开，可向下游动区呈现向远处弯曲的下潜蓝洞/深海洞口，解决中层巨大空间缺乏参照物的问题）；
 * 2) 连续主海床 (`getTerrainSamples(chunkX)`) 及 4 条手绘海床轮廓材质带 (`coral_reef` / `rocky_shelf` / `underwater_canyon` / `deep_abyss`)。
 */
const scratchSeabedRenderPoints: TerrainSamplePoint[] = [];

export function renderPhysicalSeabed(
  ctx: CanvasRenderingContext2D,
  params: {
    cameraEngineX: number;
    cameraEngineY: number;
    viewW: number;
    viewH: number;
    renderZoom: number;
    config?: WorldConfigType;
  }
): void {
  const config = params.config ?? WorldConfig;
  const zoom = Math.max(0.25, params.renderZoom);
  const halfSpanEngineX = params.viewW / (2 * zoom) + 180;
  const halfSpanEngineY = params.viewH / (2 * zoom) + 180;
  const minEngineY = params.cameraEngineY - halfSpanEngineY;
  const maxEngineY = params.cameraEngineY + halfSpanEngineY;

  // 若当前相机视野完全处于浅海环礁与海床最浅可能深度之上，则快速跳过
  const minPossibleFloorEngineY = Math.min(
    320,
    worldYToMeterDepth(config.terrain.minFloorDepth)
  );
  if (maxEngineY < minPossibleFloorEngineY - 60) {
    return;
  }

  const leftWorldX = (params.cameraEngineX - halfSpanEngineX) * WORLD_UNITS_PER_METER;
  const rightWorldX = (params.cameraEngineX + halfSpanEngineX) * WORLD_UNITS_PER_METER;
  const minChunkX = Math.floor(leftWorldX / config.chunk.width);
  const maxChunkX = Math.floor(rightWorldX / config.chunk.width);

  worldAssetRegistry.ensureAtlasesLoaded();
  const stripCoral = worldAssetRegistry.getSeabedStripCanvas('coral_reef');
  const stripRocky = worldAssetRegistry.getSeabedStripCanvas('rocky_shelf');
  const stripCanyon = worldAssetRegistry.getSeabedStripCanvas('underwater_canyon');
  const stripAbyss = worldAssetRegistry.getSeabedStripCanvas('deep_abyss');

  const subCoral = worldAssetRegistry.getSeabedSubStratumCanvas('coral_reef');
  const subRocky = worldAssetRegistry.getSeabedSubStratumCanvas('rocky_shelf');
  const subCanyon = worldAssetRegistry.getSeabedSubStratumCanvas('underwater_canyon');
  const subAbyss = worldAssetRegistry.getSeabedSubStratumCanvas('deep_abyss');

  const rockSlab = worldAssetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
  const rockBoulder = worldAssetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');
  const rockSpire = worldAssetRegistry.getSpriteCanvas('eco_seabed_rock', 'jagged_spire');

  const stripDrawH = 124;
  const crestLift = 22;
  const tileSpanEngineX = 520;

  /**
   * 沿斜率切变绘制无缝水平循环条带（支持跨 u=1.0 循环边界自动双段无缝拼接，彻底消除边界像素拉伸）
   */
  const drawSeamlessShearedStrip = (
    stripCanvas: HTMLCanvasElement,
    ex0: number,
    ey0: number,
    segW: number,
    drawH: number,
    slope: number,
    alpha: number,
    uPhaseOffset: number = 0,
    tileSpan: number = tileSpanEngineX
  ) => {
    if (alpha <= 0.01 || segW <= 0) return;
    const sw = stripCanvas.width;
    const sh = stripCanvas.height;
    if (sw <= 2 || sh <= 2) return;

    const u0 = ((((ex0 / tileSpan) + uPhaseOffset) % 1) + 1) % 1;
    const uSpan = Math.min(0.95, segW / tileSpan);
    const sx = Math.min(sw - 1, Math.floor(u0 * sw));
    const totalSw = Math.max(2, Math.round(uSpan * sw));

    ctx.save();
    ctx.transform(1, slope, 0, 1, ex0, ey0);
    ctx.globalAlpha = alpha;

    if (sx + totalSw <= sw) {
      ctx.drawImage(
        stripCanvas,
        sx,
        0,
        totalSw,
        sh,
        -0.6,
        0,
        segW + 1.2,
        drawH
      );
    } else {
      const firstSw = Math.max(1, sw - sx);
      const secondSw = Math.max(1, totalSw - firstSw);
      const firstRatio = firstSw / totalSw;
      const firstW = segW * firstRatio;
      const secondW = segW - firstW;

      ctx.drawImage(
        stripCanvas,
        sx,
        0,
        firstSw,
        sh,
        -0.6,
        0,
        firstW + 0.9,
        drawH
      );
      ctx.drawImage(
        stripCanvas,
        0,
        0,
        Math.min(sw, secondSw),
        sh,
        firstW - 0.4,
        0,
        secondW + 1.0,
        drawH
      );
    }
    ctx.restore();
  };

  // ==========================================================================
  // A. 绘制浅海与中层 5 级连续阶梯海床 (`SEABED_TERRACE_TIERS`) 与向远处弯曲的弧形下潜洞口
  // 1) 取消原本突兀且未落地的悬空支柱；
  // 2) 在各层交错分布的下潜通道区绘制向远处深海弯曲凹陷的连续海床后壁与深邃弧形下潜洞口；
  // 3) 在各层前景实心海床段绘制圆润洞口岩唇、表层以下三阶层状地质断面与底部弧形洞顶，让中层广阔海域处处有海床参照物。
  // ==========================================================================
  if (config.terrain.minFloorDepth <= 600) {
    for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
      const tier = SEABED_TERRACE_TIERS[tIdx];
      if (maxEngineY < tier.minRidgeY - 90 || minEngineY > tier.archMaxDepthY + 280) {
        continue;
      }

      const tierStripPrimary =
        tIdx === 0
          ? stripCoral
          : tIdx <= 2
          ? (stripRocky ?? stripCoral)
          : tIdx <= 6
          ? (stripCanyon ?? stripRocky)
          : (stripAbyss ?? stripCanyon);
      const tierStripSecondary =
        tIdx === 1
          ? stripCoral
          : tIdx === 2
          ? stripCanyon
          : tIdx === 3
          ? stripRocky
          : tIdx === 6
          ? stripAbyss
          : tIdx === 7
          ? stripCanyon
          : null;
      const tierStripBlend =
        tIdx === 1
          ? 0.32
          : tIdx === 2
          ? 0.22
          : tIdx === 3
          ? 0.28
          : tIdx === 6
          ? 0.38
          : tIdx === 7
          ? 0.24
          : 0;

      const archSubPrimary =
        tIdx === 0
          ? (subCoral ?? stripCoral)
          : tIdx <= 2
          ? (subRocky ?? stripRocky ?? subCoral)
          : tIdx <= 6
          ? (subCanyon ?? stripCanyon ?? subRocky)
          : (subAbyss ?? stripAbyss ?? subCanyon);
      const archSubSecondary =
        tIdx === 0
          ? (subRocky ?? stripRocky)
          : tIdx <= 2
          ? (subCanyon ?? stripCanyon ?? subCoral)
          : tIdx <= 6
          ? (subAbyss ?? stripAbyss ?? subRocky)
          : (subCanyon ?? stripCanyon ?? subAbyss);

      // A1. 先绘制当前层「向远处弯曲的弧形下潜洞口后壁与深邃洞腔」(Receding Arched Cave Openings)
      const firstSeamIdx = Math.floor(
        (leftWorldX - tier.seamPhaseOffsetX - tier.bowlHalfWidth) / tier.cellWidth
      );
      const lastSeamIdx = Math.ceil(
        (rightWorldX - tier.seamPhaseOffsetX + tier.bowlHalfWidth) / tier.cellWidth
      );

      ctx.save();
      for (let seamIdx = firstSeamIdx; seamIdx <= lastSeamIdx; seamIdx++) {
        if (tier.skipZeroSeam && seamIdx === 0) continue; // 第 0 层 X = 0 为新手出生主海山，无下潜洞口
        const seamWorldX = seamIdx * tier.cellWidth + tier.seamPhaseOffsetX;
        if (getFloorDepthAt(seamWorldX, config) <= tier.minMainFloorForOpening) continue;

        const bowlSpan = tier.bowlHalfWidth;
        const bowlLeftX = seamWorldX - bowlSpan;
        const bowlRightX = seamWorldX + bowlSpan;
        if (bowlRightX < leftWorldX - 60 || bowlLeftX > rightWorldX + 60) continue;

        const bowlSteps = 28;
        const bowlSegW = (bowlRightX - bowlLeftX) / bowlSteps;
        const bowlPts: Array<{
          x: number;
          rimY: number;
          botY: number;
          slope: number;
          openFactor: number;
        }> = [];

        for (let s = 0; s <= bowlSteps; s++) {
          const wx = bowlLeftX + s * bowlSegW;
          const sample = getSeabedTerraceAt(wx, tIdx, config);
          const rimY = sample.visualRimY ?? sample.topFloorY;
          const openFactor = sample.openingDepthFactor ?? 0;
          const botY = Math.max(
            tier.archMaxDepthY + 32,
            rimY + 218 + openFactor * 136
          );
          bowlPts.push({
            x: wx / WORLD_UNITS_PER_METER,
            rimY,
            botY,
            slope: sample.visualRimSlope ?? sample.slope,
            openFactor,
          });
        }

        const centerPt = bowlPts[Math.floor(bowlSteps * 0.5)];
        const seamEngineX = seamWorldX / WORLD_UNITS_PER_METER;

        // 1) 洞口后退弧形海床岩壁基底与层理（向深水自然渐变消融，无生硬底边）
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < bowlPts.length; i++) {
          const pt = bowlPts[i];
          if (i === 0) ctx.moveTo(pt.x, pt.rimY + 14);
          else ctx.lineTo(pt.x, pt.rimY + 14);
        }
        for (let i = bowlPts.length - 1; i >= 0; i--) {
          const pt = bowlPts[i];
          ctx.lineTo(pt.x, pt.botY);
        }
        ctx.closePath();

        const backWallGrad = ctx.createLinearGradient(
          0,
          centerPt.rimY - 30,
          0,
          centerPt.botY
        );
        if (tIdx === 0) {
          backWallGrad.addColorStop(0, 'rgba(92, 58, 36, 0.95)');
          backWallGrad.addColorStop(0.38, 'rgba(42, 40, 56, 0.90)');
          backWallGrad.addColorStop(0.76, 'rgba(14, 28, 52, 0.62)');
          backWallGrad.addColorStop(1, 'rgba(6, 16, 34, 0.0)');
        } else if (tIdx <= 2) {
          backWallGrad.addColorStop(0, 'rgba(54, 70, 92, 0.95)');
          backWallGrad.addColorStop(0.40, 'rgba(28, 42, 62, 0.90)');
          backWallGrad.addColorStop(0.78, 'rgba(12, 24, 44, 0.62)');
          backWallGrad.addColorStop(1, 'rgba(5, 12, 26, 0.0)');
        } else if (tIdx <= 6) {
          backWallGrad.addColorStop(0, 'rgba(34, 50, 82, 0.95)');
          backWallGrad.addColorStop(0.40, 'rgba(18, 30, 56, 0.90)');
          backWallGrad.addColorStop(0.78, 'rgba(8, 16, 36, 0.62)');
          backWallGrad.addColorStop(1, 'rgba(4, 8, 20, 0.0)');
        } else {
          backWallGrad.addColorStop(0, 'rgba(52, 28, 26, 0.96)');
          backWallGrad.addColorStop(0.42, 'rgba(28, 16, 18, 0.90)');
          backWallGrad.addColorStop(0.78, 'rgba(14, 10, 18, 0.64)');
          backWallGrad.addColorStop(1, 'rgba(5, 4, 10, 0.0)');
        }
        ctx.fillStyle = backWallGrad;
        ctx.fill();

        ctx.clip();
        if (archSubPrimary) {
          for (let i = 0; i < bowlPts.length - 1; i++) {
            const p0 = bowlPts[i];
            const p1 = bowlPts[i + 1];
            const w = p1.x - p0.x;
            if (w <= 0) continue;
            const sl = (p1.rimY - p0.rimY) / w;
            drawSeamlessShearedStrip(
              archSubPrimary,
              p0.x,
              p0.rimY + 22,
              w,
              152,
              sl * 0.92,
              0.84,
              0.21 + seamIdx * 0.13 + tIdx * 0.19
            );
            drawSeamlessShearedStrip(
              archSubSecondary ?? archSubPrimary,
              p0.x,
              p0.rimY + 104,
              w,
              162,
              sl * 0.74,
              0.68,
              0.59 + seamIdx * 0.27 + tIdx * 0.31
            );
            drawSeamlessShearedStrip(
              archSubSecondary ?? archSubPrimary,
              p0.x,
              p0.rimY + 188,
              w,
              166,
              sl * 0.56,
              0.52,
              0.14 + seamIdx * 0.39 + tIdx * 0.43
            );
          }
        }

        // 叠加海水远景大气透视雾（使下弯的海床后壁产生强烈的「向远处弧形后退」空间纵深感）
        const depthHazeGrad = ctx.createRadialGradient(
          seamEngineX,
          centerPt.rimY + 65,
          24,
          seamEngineX,
          centerPt.rimY + 95,
          bowlSpan * 0.95
        );
        depthHazeGrad.addColorStop(0, 'rgba(7, 28, 56, 0.72)');
        depthHazeGrad.addColorStop(0.58, 'rgba(11, 38, 70, 0.44)');
        depthHazeGrad.addColorStop(1, 'rgba(12, 42, 74, 0.0)');
        ctx.fillStyle = depthHazeGrad;
        ctx.fillRect(
          bowlPts[0].x,
          centerPt.rimY - 120,
          bowlPts[bowlPts.length - 1].x - bowlPts[0].x,
          480
        );

        // 2) 绘制「向下的深邃弧形洞口」洞腔暗影、3 道向内弯曲的环形岩阶
        const portalCenterY = centerPt.rimY + 112;
        const portalRx = tier.openingHalfWidth * 1.18;
        const portalRy = 186;
        ctx.save();
        ctx.translate(seamEngineX, portalCenterY);
        ctx.scale(portalRx / portalRy, 1);
        const cavePortalGrad = ctx.createRadialGradient(0, -14, 14, 0, 12, portalRy);
        cavePortalGrad.addColorStop(0, 'rgba(2, 7, 18, 0.94)');
        cavePortalGrad.addColorStop(0.52, 'rgba(5, 16, 36, 0.82)');
        cavePortalGrad.addColorStop(0.84, 'rgba(9, 28, 54, 0.38)');
        cavePortalGrad.addColorStop(1, 'rgba(12, 36, 66, 0.0)');
        ctx.fillStyle = cavePortalGrad;
        ctx.beginPath();
        ctx.arc(0, 0, portalRy, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 洞腔内壁 3 道向远处向下弯曲的同心弧形岩脊环阶（强化隧道/洞口向下延伸的立体透视）
        for (let ring = 0; ring < 3; ring++) {
          const ringDepthOffset = 52 + ring * 52;
          const ringSpread = (1 - ring * 0.14) * tier.openingHalfWidth * 1.12;
          const ringLeftX = seamEngineX - ringSpread;
          const ringRightX = seamEngineX + ringSpread;
          const ringTopY = centerPt.rimY - 18 + ring * 30;
          const ringDipY = centerPt.rimY + ringDepthOffset + 68;

          ctx.strokeStyle =
            ring === 0
              ? 'rgba(18, 42, 68, 0.68)'
              : ring === 1
              ? 'rgba(14, 34, 58, 0.55)'
              : 'rgba(10, 26, 46, 0.42)';
          ctx.lineWidth = 6.0 - ring * 1.1;
          ctx.beginPath();
          ctx.moveTo(ringLeftX, ringTopY);
          ctx.quadraticCurveTo(seamEngineX, ringDipY, ringRightX, ringTopY);
          ctx.stroke();

          ctx.strokeStyle = `rgba(56, 189, 248, ${(0.19 - ring * 0.045).toFixed(3)})`;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(ringLeftX + 12, ringTopY - 2);
          ctx.quadraticCurveTo(seamEngineX, ringDipY - 3, ringRightX - 12, ringTopY - 2);
          ctx.stroke();
        }
        ctx.restore();

        // 3) 沿向远处下弯的连续洞口后壁顶沿铺设当前层海床表层条带，并叠加远景水雾暗化，让各层海床视觉上 100% 连续不断开
        if (tierStripPrimary) {
          for (let i = 0; i < bowlPts.length - 1; i++) {
            const p0 = bowlPts[i];
            const p1 = bowlPts[i + 1];
            const w = p1.x - p0.x;
            if (w <= 0) continue;
            const sl = (p1.rimY - p0.rimY) / w;
            drawSeamlessShearedStrip(
              tierStripPrimary,
              p0.x,
              p0.rimY - crestLift,
              w,
              stripDrawH * 0.92,
              sl,
              0.94 * (1 - tierStripBlend),
              tIdx * 0.17
            );
            if (tierStripSecondary && tierStripBlend > 0.01) {
              drawSeamlessShearedStrip(
                tierStripSecondary,
                p0.x,
                p0.rimY - crestLift,
                w,
                stripDrawH * 0.92,
                sl,
                0.94 * tierStripBlend,
                tIdx * 0.17
              );
            }
          }

          // 为洞口段下弯的后壁表层带叠加一层深海远景蓝影，使其退居后景，与前景两侧洞唇拉开前后层次
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < bowlPts.length; i++) {
            const pt = bowlPts[i];
            if (i === 0) ctx.moveTo(pt.x, pt.rimY - crestLift - 6);
            else ctx.lineTo(pt.x, pt.rimY - crestLift - 6);
          }
          for (let i = bowlPts.length - 1; i >= 0; i--) {
            const pt = bowlPts[i];
            ctx.lineTo(pt.x, pt.rimY + 52);
          }
          ctx.closePath();
          const rimShadeGrad = ctx.createLinearGradient(bowlLeftX, 0, bowlRightX, 0);
          rimShadeGrad.addColorStop(0, 'rgba(8, 30, 56, 0.0)');
          rimShadeGrad.addColorStop(0.28, 'rgba(8, 30, 56, 0.36)');
          rimShadeGrad.addColorStop(0.5, 'rgba(6, 22, 44, 0.56)');
          rimShadeGrad.addColorStop(0.72, 'rgba(8, 30, 56, 0.36)');
          rimShadeGrad.addColorStop(1, 'rgba(8, 30, 56, 0.0)');
          ctx.fillStyle = rimShadeGrad;
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      // A2. 绘制当前层前景实心海床段（无悬空立柱、两侧洞壁向下弯曲围合洞口、厚实三阶地下岩层）
      const firstAtollCell =
        Math.floor((leftWorldX - tier.seamPhaseOffsetX) / tier.cellWidth) - 1;
      const lastAtollCell =
        Math.floor((rightWorldX - tier.seamPhaseOffsetX) / tier.cellWidth) + 1;

      ctx.save();
      for (let cellIdx = firstAtollCell; cellIdx <= lastAtollCell; cellIdx++) {
        const segStartX =
          tier.skipZeroSeam && cellIdx === 0
            ? 0
            : cellIdx * tier.cellWidth + tier.seamPhaseOffsetX + tier.openingHalfWidth;
        const segEndX =
          tier.skipZeroSeam && cellIdx === -1
            ? 0
            : (cellIdx + 1) * tier.cellWidth +
              tier.seamPhaseOffsetX -
              tier.openingHalfWidth;

        if (segEndX < leftWorldX - 80 || segStartX > rightWorldX + 80 || segEndX <= segStartX) {
          continue;
        }

        const stepCount = 36;
        const segW = (segEndX - segStartX) / stepCount;
        const allPts: Array<{
          x: number;
          topY: number;
          bottomY: number;
          mainFloorY: number;
          slope: number;
          valid: boolean;
        }> = [];

        for (let s = 0; s <= stepCount; s++) {
          const wx = segStartX + s * segW;
          const mainFloorY = getFloorDepthAt(wx, config);
          const sample = getSeabedTerraceAt(wx, tIdx, config);
          // 仅在主海床下潜至 > graftStartMainY - 20m 时启用当前层海床段（含 20m 锚定山根）
          const valid = mainFloorY > tier.graftStartMainY - 20;
          allPts.push({
            x: wx / WORLD_UNITS_PER_METER,
            topY: sample.topFloorY,
            bottomY: Math.max(sample.topFloorY + 38, sample.bottomArchY),
            mainFloorY,
            slope: sample.slope,
            valid,
          });
        }

        // 提取连续有效的实心段子序列
        let runStart = -1;
        for (let idx = 0; idx <= allPts.length; idx++) {
          const isVal = idx < allPts.length && allPts[idx].valid;
          if (isVal && runStart === -1) {
            runStart = idx;
          } else if (!isVal && runStart !== -1) {
            const topPts = allPts.slice(runStart, idx);
            runStart = -1;
            if (topPts.length < 2) continue;

            // 1. 绘制前景海床实心岩体与表层以下 3 阶层状地质断面 + 镶嵌岩块
            const archTopInset = 18;
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < topPts.length; i++) {
              const pt = topPts[i];
              const insetTopY = Math.min(pt.bottomY - 6, pt.topY + archTopInset);
              if (i === 0) ctx.moveTo(pt.x, insetTopY);
              else ctx.lineTo(pt.x, insetTopY);
            }
            for (let i = topPts.length - 1; i >= 0; i--) {
              const pt = topPts[i];
              ctx.lineTo(pt.x, pt.bottomY);
            }
            ctx.closePath();

            const archGrad = ctx.createLinearGradient(
              0,
              tier.minRidgeY,
              0,
              tier.archMaxDepthY + 15
            );
            if (tIdx === 0) {
              archGrad.addColorStop(0, '#7a4b2a');
              archGrad.addColorStop(0.36, '#54321c');
              archGrad.addColorStop(0.72, '#341e12');
              archGrad.addColorStop(1, '#1b1114');
            } else if (tIdx <= 2) {
              archGrad.addColorStop(0, '#364960');
              archGrad.addColorStop(0.38, '#233246');
              archGrad.addColorStop(0.74, '#152030');
              archGrad.addColorStop(1, '#0b121e');
            } else if (tIdx <= 6) {
              archGrad.addColorStop(0, '#243558');
              archGrad.addColorStop(0.38, '#16233e');
              archGrad.addColorStop(0.74, '#0d1528');
              archGrad.addColorStop(1, '#060a17');
            } else {
              archGrad.addColorStop(0, '#331d1a');
              archGrad.addColorStop(0.38, '#1f1110');
              archGrad.addColorStop(0.74, '#120a0a');
              archGrad.addColorStop(1, '#080405');
            }
            ctx.fillStyle = archGrad;
            ctx.fill();

            ctx.clip();
            if (archSubPrimary) {
              for (let i = 0; i < topPts.length - 1; i++) {
                const p0 = topPts[i];
                const p1 = topPts[i + 1];
                const w = p1.x - p0.x;
                if (w <= 0) continue;
                const sl = (p1.topY - p0.topY) / w;
                const archThick = Math.max(
                  p0.bottomY - p0.topY,
                  p1.bottomY - p1.topY
                );

                drawSeamlessShearedStrip(
                  archSubPrimary,
                  p0.x,
                  p0.topY + 24,
                  w,
                  156,
                  sl * 0.95,
                  0.98,
                  0.37 + cellIdx * 0.17 + tIdx * 0.23
                );
                if (archThick > 88) {
                  drawSeamlessShearedStrip(
                    archSubPrimary,
                    p0.x,
                    p0.topY + 106,
                    w,
                    164,
                    sl * 0.82,
                    0.94,
                    0.74 + cellIdx * 0.29 + tIdx * 0.31
                  );
                }
                if (archThick > 168) {
                  drawSeamlessShearedStrip(
                    archSubSecondary ?? archSubPrimary,
                    p0.x,
                    p0.topY + 190,
                    w,
                    168,
                    sl * 0.68,
                    0.90,
                    0.19 + cellIdx * 0.41 + tIdx * 0.47
                  );
                }

                // 在海床断面内按确定性哈希镶嵌阶梯砂岩与巨石 (`mossy_slab` / `basalt_boulder` / `jagged_spire`)
                if (archThick > 155 && (i & 1) === 0 && (rockSlab || rockBoulder || rockSpire)) {
                  const rHash = mixSubsystemSeed(
                    config.worldSeed,
                    config.generatorVersion,
                    cellIdx * 64 + i,
                    619 + tIdx * 197,
                    'terrain'
                  );
                  if ((rHash % 100) < 62) {
                    const rockImg =
                      tIdx === 0
                        ? (rHash & 1) === 0
                          ? (rockSlab ?? rockBoulder)
                          : (rockBoulder ?? rockSlab)
                        : (rHash % 3) === 0
                        ? (rockSlab ?? rockBoulder)
                        : (rHash % 3) === 1
                        ? (rockBoulder ?? rockSlab)
                        : (rockSpire ?? rockBoulder);
                    if (rockImg) {
                      const rScale = 0.35 + (((rHash >>> 8) % 18) / 100);
                      const rw = rockImg.width * rScale;
                      const rh = rockImg.height * rScale;
                      const rx = p0.x + w * 0.5;
                      const ry = p0.topY + 132 + (((rHash >>> 14) % 48) - 20);
                      ctx.save();
                      ctx.translate(rx, ry);
                      ctx.rotate(Math.max(-0.32, Math.min(0.32, sl * 0.45)));
                      ctx.scale((rHash & 2) !== 0 ? -1 : 1, 1);
                      ctx.globalAlpha = 0.34;
                      ctx.drawImage(rockImg, -rw * 0.5, -rh * 0.5, rw, rh);
                      ctx.restore();
                    }
                  }
                }
              }
            }
            ctx.restore();

            // 2. 拱形洞顶底壁环境闭塞暗影与微光岩石边缘（仅在主海床已深于洞顶 bottomY + 14m 的悬空水道区绘制，山体根部融合区绝不画分割线！）
            ctx.strokeStyle = 'rgba(10, 16, 28, 0.58)';
            ctx.lineWidth = 6.0;
            ctx.beginPath();
            let strokeOpen = false;
            for (let i = 0; i < topPts.length; i++) {
              const pt = topPts[i];
              if (pt.mainFloorY > pt.bottomY + 14) {
                if (!strokeOpen) {
                  ctx.moveTo(pt.x, pt.bottomY - 2);
                  strokeOpen = true;
                } else {
                  ctx.lineTo(pt.x, pt.bottomY - 2);
                }
              } else {
                strokeOpen = false;
              }
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            strokeOpen = false;
            for (let i = 0; i < topPts.length; i++) {
              const pt = topPts[i];
              if (pt.mainFloorY > pt.bottomY + 14) {
                if (!strokeOpen) {
                  ctx.moveTo(pt.x, pt.bottomY);
                  strokeOpen = true;
                } else {
                  ctx.lineTo(pt.x, pt.bottomY);
                }
              } else {
                strokeOpen = false;
              }
            }
            ctx.stroke();

            // 3. 在洞口左右两侧的前景圆润洞壁唇口处点缀镶嵌礁石 (`mossy_slab` / `basalt_boulder`)，强化天然向下洞口轮廓
            const lipRock = tIdx <= 1 ? (rockSlab ?? rockBoulder) : (rockBoulder ?? rockSlab);
            if (lipRock) {
              const leftLipPt = topPts[0];
              const rightLipPt = topPts[topPts.length - 1];
              const lipCandidates = [
                { pt: leftLipPt, isLeft: true },
                { pt: rightLipPt, isLeft: false },
              ];
              for (const cand of lipCandidates) {
                if (cand.pt.mainFloorY <= cand.pt.bottomY + 14) continue; // 山体根部交汇端无须洞唇石
                const rScale = 0.44;
                const rw = lipRock.width * rScale;
                const rh = lipRock.height * rScale;
                ctx.save();
                ctx.translate(cand.pt.x, cand.pt.topY + 28);
                ctx.rotate(cand.isLeft ? -0.32 : 0.32);
                ctx.scale(cand.isLeft ? 1 : -1, 1);
                ctx.globalAlpha = 0.90;
                ctx.drawImage(lipRock, -rw * 0.5, -rh * 0.5, rw, rh);
                ctx.restore();
              }
            }

            // 4. 在前景实心海床顶面铺设手绘表层条带 (`coral_reef` / `rocky_shelf` / `underwater_canyon`)
            if (tierStripPrimary) {
              for (let i = 0; i < topPts.length - 1; i++) {
                const p0 = topPts[i];
                const p1 = topPts[i + 1];
                const w = p1.x - p0.x;
                if (w <= 0) continue;
                const sl = (p1.topY - p0.topY) / w;
                drawSeamlessShearedStrip(
                  tierStripPrimary,
                  p0.x,
                  p0.topY - crestLift,
                  w,
                  stripDrawH,
                  sl,
                  0.98 * (1 - tierStripBlend),
                  tIdx * 0.17
                );
                if (tierStripSecondary && tierStripBlend > 0.01) {
                  drawSeamlessShearedStrip(
                    tierStripSecondary,
                    p0.x,
                    p0.topY - crestLift,
                    w,
                    stripDrawH,
                    sl,
                    0.98 * tierStripBlend,
                    tIdx * 0.17
                  );
                }
              }
            }
          }
        }
      }
      ctx.restore();
    }
  }

  // ==========================================================================
  // B. 绘制 1.0x 连续主海床 (`getTerrainSamples`) — 4×25m Catmull-Rom 山脊曲线细分
  // ==========================================================================
  const samplePoints = scratchSeabedRenderPoints;
  samplePoints.length = 0;
  for (let cx = minChunkX; cx <= maxChunkX; cx++) {
    const chunkSamples = getTerrainSamples(cx, config);
    const startIdx = cx === minChunkX ? 0 : 1;
    for (let i = startIdx; i < chunkSamples.points.length; i++) {
      samplePoints.push(chunkSamples.points[i]);
    }
  }

  if (samplePoints.length < 2) return;

  // 检查当前视野内是否有主海床进入可见高度范围
  let minVisFloorEngineY = Infinity;
  for (let i = 0; i < samplePoints.length; i++) {
    const ey = worldYToMeterDepth(samplePoints[i].floorY);
    if (ey < minVisFloorEngineY) minVisFloorEngineY = ey;
  }
  if (maxEngineY < minVisFloorEngineY - 60) {
    return;
  }

  const bottomCapEngineY = Math.max(
    maxEngineY + 240,
    worldYToMeterDepth(config.bounds.maxDepth) + 160
  );

  // 计算每 100m 网格段内的 4×25m 自然山脊样条插值高度（端点 subT=0/1 严格对齐物理碰撞节点，段内消除 100px 直线折角）
  const SUB_STEPS = 4;
  const evalSubSegmentEngineY = (segIdx: number, subStep: number): number => {
    const p0 = samplePoints[segIdx];
    const p1 = samplePoints[segIdx + 1];
    const ey0 = p0.floorY / WORLD_UNITS_PER_METER;
    const ey1 = p1.floorY / WORLD_UNITS_PER_METER;
    if (subStep <= 0) return ey0;
    if (subStep >= SUB_STEPS) return ey1;

    const pPrev = samplePoints[Math.max(0, segIdx - 1)];
    const pNext = samplePoints[Math.min(samplePoints.length - 1, segIdx + 2)];
    const eyPrev = pPrev.floorY / WORLD_UNITS_PER_METER;
    const eyNext = pNext.floorY / WORLD_UNITS_PER_METER;

    const t = subStep / SUB_STEPS;
    const t2 = t * t;
    const t3 = t2 * t;
    // Catmull-Rom 三次样条（张力 0.5），将折线平滑为自然起伏的山峰与鞍部曲线
    const catmullY =
      0.5 *
      (2 * ey0 +
        (-eyPrev + ey1) * t +
        (2 * eyPrev - 5 * ey0 + 4 * ey1 - eyNext) * t2 +
        (-eyPrev + 3 * ey0 - 3 * ey1 + eyNext) * t3);

    // 叠加在段端点 (t=0, t=1) 归零的确定性岩脊微起伏，彻底杜绝任何局部直线的存在
    const ex = (p0.worldX + (p1.worldX - p0.worldX) * t) / WORLD_UNITS_PER_METER;
    const microRipple =
      Math.sin(Math.PI * t) *
      (Math.sin(ex * 0.058 + 1.1) * 5.2 + Math.cos(ex * 0.115 - 0.7) * 3.1);

    return catmullY + microRipple;
  };

  const resolveStripPairForDepth = (
    segDepthM: number,
    cCoral: HTMLCanvasElement | null,
    cRocky: HTMLCanvasElement | null,
    cCanyon: HTMLCanvasElement | null,
    cAbyss: HTMLCanvasElement | null
  ): {
    primary: HTMLCanvasElement | null;
    secondary: HTMLCanvasElement | null;
    blend: number;
  } => {
    if (segDepthM < 1500) {
      return { primary: cCoral, secondary: null, blend: 0 };
    }
    if (segDepthM < 2300) {
      const t = (segDepthM - 1500) / 800;
      return { primary: cCoral, secondary: cRocky, blend: t };
    }
    if (segDepthM < 5400) {
      return { primary: cRocky, secondary: null, blend: 0 };
    }
    if (segDepthM < 6600) {
      const t = (segDepthM - 5400) / 1200;
      return { primary: cRocky, secondary: cCanyon, blend: t };
    }
    if (segDepthM < 11800) {
      return { primary: cCanyon, secondary: null, blend: 0 };
    }
    if (segDepthM < 13400) {
      const t = (segDepthM - 11800) / 1600;
      return { primary: cCanyon, secondary: cAbyss, blend: t };
    }
    return { primary: cAbyss, secondary: null, blend: 0 };
  };

  ctx.save();

  // 1. 构建 1.0x 世界层主海床多边形路径（沿 25m 曲线细分点绘制，顶边下沉 18px 以完全藏于表层金沙核心之后），填充地质基底色并开启 Clip 剪裁
  const subsurfaceTopInset = 18;
  const firstEngineX = samplePoints[0].worldX / WORLD_UNITS_PER_METER;
  const lastEngineX = samplePoints[samplePoints.length - 1].worldX / WORLD_UNITS_PER_METER;
  const gradTopY = Math.max(minEngineY, minVisFloorEngineY);
  const avgDepthM = params.cameraEngineY;

  const seabedGrad = ctx.createLinearGradient(0, gradTopY, 0, bottomCapEngineY);
  if (avgDepthM <= 1800) {
    seabedGrad.addColorStop(0, '#7a4b2a');
    seabedGrad.addColorStop(0.28, '#54321c');
    seabedGrad.addColorStop(0.65, '#361f12');
    seabedGrad.addColorStop(1, '#1c100a');
  } else if (avgDepthM <= 5800) {
    seabedGrad.addColorStop(0, '#33465e');
    seabedGrad.addColorStop(0.35, '#1e2b3c');
    seabedGrad.addColorStop(1, '#0b121e');
  } else if (avgDepthM <= 12500) {
    seabedGrad.addColorStop(0, '#1e2d52');
    seabedGrad.addColorStop(0.35, '#111b34');
    seabedGrad.addColorStop(1, '#060a17');
  } else {
    seabedGrad.addColorStop(0, '#331d1a');
    seabedGrad.addColorStop(0.35, '#1b0f0e');
    seabedGrad.addColorStop(1, '#090505');
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    firstEngineX,
    samplePoints[0].floorY / WORLD_UNITS_PER_METER + subsurfaceTopInset
  );
  for (let i = 0; i < samplePoints.length - 1; i++) {
    const ex0 = samplePoints[i].worldX / WORLD_UNITS_PER_METER;
    const ex1 = samplePoints[i + 1].worldX / WORLD_UNITS_PER_METER;
    const fullW = ex1 - ex0;
    for (let s = 1; s <= SUB_STEPS; s++) {
      const subX = ex0 + (fullW * s) / SUB_STEPS;
      const subY = evalSubSegmentEngineY(i, s) + subsurfaceTopInset;
      ctx.lineTo(subX, subY);
    }
  }
  ctx.lineTo(lastEngineX, bottomCapEngineY);
  ctx.lineTo(firstEngineX, bottomCapEngineY);
  ctx.closePath();
  ctx.fillStyle = seabedGrad;
  ctx.fill();

  // ==========================================================================
  // 2. 在主海床山体剪裁区域内，铺满「表层以下」全高度多层顺应山势的地质岩壁与镶嵌断面岩块
  // ==========================================================================
  ctx.clip();

  const effSubCoral = subCoral ?? stripCoral;
  const effSubRocky = subRocky ?? stripRocky;
  const effSubCanyon = subCanyon ?? stripCanyon;
  const effSubAbyss = subAbyss ?? stripAbyss;

  if (effSubCoral || effSubRocky || effSubCanyon || effSubAbyss) {
    for (let i = 0; i < samplePoints.length - 1; i++) {
      const p0 = samplePoints[i];
      const p1 = samplePoints[i + 1];
      const ex0 = p0.worldX / WORLD_UNITS_PER_METER;
      const ey0 = p0.floorY / WORLD_UNITS_PER_METER;
      const ex1 = p1.worldX / WORLD_UNITS_PER_METER;
      const ey1 = p1.floorY / WORLD_UNITS_PER_METER;
      const fullW = ex1 - ex0;
      if (fullW <= 0) continue;

      const minSegEy = Math.min(ey0, ey1);
      if (minSegEy > maxEngineY + 80) continue;

      const segDepthM = (ey0 + ey1) * 0.5;
      const segSlope = (ey1 - ey0) / fullW;
      const { primary: subPri, secondary: subSec, blend: subBlend } =
        resolveStripPairForDepth(
          segDepthM,
          effSubCoral,
          effSubRocky,
          effSubCanyon,
          effSubAbyss
        );

      // 2.1 近表层第 0、1、2 阶地下岩层（offsetY = 24px、106px、192px）：按 25m 样条子段紧贴表层山脊起伏绘制
      const subW = fullW / SUB_STEPS;
      let prevSubX = ex0;
      let prevSubY = ey0;
      for (let s = 1; s <= SUB_STEPS; s++) {
        const nextSubX = ex0 + subW * s;
        const nextSubY = evalSubSegmentEngineY(i, s);
        const subSlope = (nextSubY - prevSubY) / subW;

        // Tier 0: 紧接表层金沙砂岩唇口下方的第一道断层岩壁（无缝衔接表层底部）
        if (prevSubY + 20 < maxEngineY + 80) {
          if (subPri && subSec && subBlend > 0.02) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + 24, subW, 156, subSlope * 0.96, (1 - subBlend) * 0.98, 0.37);
            drawSeamlessShearedStrip(subSec, prevSubX, prevSubY + 24, subW, 156, subSlope * 0.96, subBlend * 0.98, 0.37);
          } else if (subPri) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + 24, subW, 156, subSlope * 0.96, 0.98, 0.37);
          }
        }

        // Tier 1: 表层以下 106px 处的第二道交错沉积岩层
        if (prevSubY + 100 < maxEngineY + 80) {
          const t1Slope = subSlope * 0.86;
          if (subPri && subSec && subBlend > 0.02) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + 106, subW, 164, t1Slope, (1 - subBlend) * 0.95, 0.74);
            drawSeamlessShearedStrip(subSec, prevSubX, prevSubY + 106, subW, 164, t1Slope, subBlend * 0.95, 0.74);
          } else if (subPri) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + 106, subW, 164, t1Slope, 0.95, 0.74);
          }
        }

        // Tier 2: 表层以下 192px 处的第三道交错沉积岩层
        if (prevSubY + 185 < maxEngineY + 80) {
          const t2Slope = subSlope * 0.75;
          if (subPri && subSec && subBlend > 0.02) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + 192, subW, 168, t2Slope, (1 - subBlend) * 0.92, 0.19);
            drawSeamlessShearedStrip(subSec, prevSubX, prevSubY + 192, subW, 168, t2Slope, subBlend * 0.92, 0.19);
          } else if (subPri) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + 192, subW, 168, t2Slope, 0.92, 0.19);
          }
        }

        prevSubX = nextSubX;
        prevSubY = nextSubY;
      }

      // 2.2 深部多层地质基岩层（Tier 3..11，从表层以下 280px 一路无缝叠铺至视野底端 maxEngineY）
      // 按 100m 网格段高效绘制，每层水平相位按黄金分割偏移、斜率逐层平缓化，彻底消除山体内部空洞感
      const tierStepY = 92;
      const tierDrawH = 168;
      for (let tier = 3; tier <= 12; tier++) {
        const tierOffsetY = 280 + (tier - 3) * tierStepY;
        if (minSegEy + tierOffsetY > maxEngineY + 80) break;

        const tierSlope = segSlope * Math.pow(0.78, tier);
        const uPhase = ((tier * 0.381966) + (tier % 2) * 0.23) % 1;
        const depthFade = Math.max(0.64, 0.90 - (tier - 3) * 0.035);

        if (subPri && subSec && subBlend > 0.02) {
          drawSeamlessShearedStrip(subPri, ex0, ey0 + tierOffsetY, fullW, tierDrawH, tierSlope, (1 - subBlend) * depthFade, uPhase);
          drawSeamlessShearedStrip(subSec, ex0, ey0 + tierOffsetY, fullW, tierDrawH, tierSlope, subBlend * depthFade, uPhase);
        } else if (subPri) {
          drawSeamlessShearedStrip(subPri, ex0, ey0 + tierOffsetY, fullW, tierDrawH, tierSlope, depthFade, uPhase);
        }
      }

      // 2.3 山体断面内嵌阶梯岩块与巨石露头（当山体在视野内露出高度 > 160px 时，按确定性哈希镶嵌手绘阶梯岩架）
      const visMountainH = maxEngineY - minSegEy;
      if (visMountainH > 160 && (rockSlab || rockBoulder || rockSpire)) {
        const segGridIdx = Math.round(ex0 / 100);
        const segHash = mixSubsystemSeed(
          config.worldSeed,
          config.generatorVersion,
          segGridIdx,
          313,
          'terrain'
        );
        const maxOutcropTiers = Math.min(4, Math.floor((visMountainH - 100) / 135));
        for (let ot = 0; ot < maxOutcropTiers; ot++) {
          const subHash = mixSubsystemSeed(segHash, ot, segGridIdx, 571, 'terrain');
          if ((subHash % 100) >= 65) continue;

          // 浅海砂岩区优先使用阶梯状层岩 (`mossy_slab`)，深海区混合玄武岩巨石与尖峰
          const spriteChoice = segDepthM < 1800 ? 0 : (subHash >>> 4) % 3;
          const rockSprite =
            spriteChoice === 0
              ? (rockSlab ?? rockBoulder)
              : spriteChoice === 1
              ? (rockBoulder ?? rockSlab)
              : (rockSpire ?? rockSlab);
          if (!rockSprite) continue;

          const fracX = 0.18 + (((subHash >>> 8) % 640) / 1000);
          const rx = ex0 + fullW * fracX;
          const baseSurfY = ey0 + (ey1 - ey0) * fracX;
          const ry = baseSurfY + 125 + ot * 135 + (((subHash >>> 18) % 36) - 18);
          if (ry > maxEngineY + 70) continue;

          const rScale = 0.34 + (((subHash >>> 12) % 24) / 100);
          const drawW = rockSprite.width * rScale;
          const drawH = rockSprite.height * rScale;
          const flipX = (subHash & 2) !== 0 ? -1 : 1;
          const tilt = Math.max(-0.36, Math.min(0.36, segSlope * 0.42));

          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(tilt);
          ctx.scale(flipX, 1);
          ctx.globalAlpha = Math.max(0.22, 0.38 - ot * 0.04);
          ctx.drawImage(rockSprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
          ctx.restore();
        }
      }
    }
  }

  // 退出主海床山体内部 Clip
  ctx.restore();

  // ==========================================================================
  // 3. 沿 25m 曲线细分主海床采样绘制最顶层手绘海床表层轮廓材质 (`world_seabed_strips`)
  // ==========================================================================
  if (stripCoral || stripRocky || stripCanyon || stripAbyss) {
    for (let i = 0; i < samplePoints.length - 1; i++) {
      const p0 = samplePoints[i];
      const p1 = samplePoints[i + 1];
      const ex0 = p0.worldX / WORLD_UNITS_PER_METER;
      const ey0 = p0.floorY / WORLD_UNITS_PER_METER;
      const ex1 = p1.worldX / WORLD_UNITS_PER_METER;
      const ey1 = p1.floorY / WORLD_UNITS_PER_METER;
      const fullW = ex1 - ex0;
      if (fullW <= 0) continue;
      if (Math.min(ey0, ey1) - crestLift > maxEngineY + 60) continue;

      const subW = fullW / SUB_STEPS;
      let prevSubX = ex0;
      let prevSubY = ey0;
      for (let s = 1; s <= SUB_STEPS; s++) {
        const nextSubX = ex0 + subW * s;
        const nextSubY = evalSubSegmentEngineY(i, s);
        const subSlope = (nextSubY - prevSubY) / subW;
        const segDepthM = (prevSubY + nextSubY) * 0.5;

        // 当主海床斜坡处于任一层连续阶梯海床的融合山根内部 ([graftStartMainY, graftFuseMainY + 5]) 时，隐去内部表层线，使其与上方阶梯海床断面无缝融为一体
        let surfaceAlpha = 1;
        if (config.terrain.minFloorDepth <= 600) {
          for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
            const tier = SEABED_TERRACE_TIERS[tIdx];
            if (
              segDepthM > tier.graftStartMainY &&
              segDepthM < tier.graftFuseMainY + 5
            ) {
              const midWorldX = (prevSubX + nextSubX) * 0.5 * WORLD_UNITS_PER_METER;
              const terraceHere = getSeabedTerraceAt(midWorldX, tIdx, config);
              if (terraceHere.active && terraceHere.topFloorY < segDepthM - 4) {
                const fadeInEnd = tier.graftStartMainY + 52;
                const fadeOutStart = tier.graftFuseMainY - 42;
                const tierAlpha =
                  segDepthM < fadeInEnd
                    ? 1 - quinticSmoothstep(tier.graftStartMainY, fadeInEnd, segDepthM)
                    : segDepthM > fadeOutStart
                    ? quinticSmoothstep(fadeOutStart, tier.graftFuseMainY + 5, segDepthM)
                    : 0;
                surfaceAlpha = Math.min(surfaceAlpha, tierAlpha);
              }
            }
          }
        }

        if (surfaceAlpha > 0.01) {
          const { primary, secondary, blend } = resolveStripPairForDepth(
            segDepthM,
            stripCoral,
            stripRocky,
            stripCanyon,
            stripAbyss
          );

          if (primary && secondary && blend > 0.02) {
            drawSeamlessShearedStrip(
              primary,
              prevSubX,
              prevSubY - crestLift,
              subW,
              stripDrawH,
              subSlope,
              (1 - blend) * surfaceAlpha,
              0
            );
            drawSeamlessShearedStrip(
              secondary,
              prevSubX,
              prevSubY - crestLift,
              subW,
              stripDrawH,
              subSlope,
              blend * surfaceAlpha,
              0
            );
          } else if (primary) {
            drawSeamlessShearedStrip(
              primary,
              prevSubX,
              prevSubY - crestLift,
              subW,
              stripDrawH,
              subSlope,
              surfaceAlpha,
              0
            );
          }
        }
        prevSubX = nextSubX;
        prevSubY = nextSubY;
      }
    }
  }

  ctx.restore();
}

// ============================================================================
// 阶段 C（规范第 5、7、11、13、14-C 节）：BiomeGenerator（宏观生态区与平滑混合）、5 大深度带与统一 DepthVisualProfile
// ============================================================================

/**
 * 规范第 5 节：首版宏观生态区类型
 * 注意：shipwreck 作为局部 POI/特征（阶段 D），不把整片宏区定义为沉船。
 */
export type BiomeId =
  | 'coral_reef'
  | 'rocky_shelf'
  | 'open_ocean'
  | 'underwater_canyon'
  | 'deep_abyss';

export const BIOME_IDS: readonly BiomeId[] = [
  'coral_reef',
  'rocky_shelf',
  'open_ocean',
  'underwater_canyon',
  'deep_abyss',
] as const;

export interface BiomeParameterPreset {
  id: BiomeId;
  labelZh: string;
  labelEn: string;
  /** 生态区色调偏移 RGB */
  tintBiasRgb: [number, number, number];
  /** 珊瑚/海草等植物装饰密度权重 */
  floraDensity: number;
  /** 岩石/地貌装饰密度权重 */
  rockDensity: number;
  /** 鱼群/生物丰度权重 */
  faunaDensity: number;
  /** 生物发光增益权重 */
  bioluminescenceBoost: number;
}

export const BIOME_PRESETS: Record<BiomeId, BiomeParameterPreset> = {
  coral_reef: {
    id: 'coral_reef',
    labelZh: '珊瑚礁生态区',
    labelEn: 'Coral Reef',
    tintBiasRgb: [14, 165, 233],
    floraDensity: 1.45,
    rockDensity: 0.95,
    faunaDensity: 1.38,
    bioluminescenceBoost: 0.15,
  },
  rocky_shelf: {
    id: 'rocky_shelf',
    labelZh: '岩石大陆架',
    labelEn: 'Rocky Shelf',
    tintBiasRgb: [30, 118, 168],
    floraDensity: 0.82,
    rockDensity: 1.48,
    faunaDensity: 1.05,
    bioluminescenceBoost: 0.22,
  },
  open_ocean: {
    id: 'open_ocean',
    labelZh: '开阔远洋区',
    labelEn: 'Open Ocean',
    tintBiasRgb: [12, 132, 198],
    floraDensity: 0.42,
    rockDensity: 0.38,
    faunaDensity: 1.15,
    bioluminescenceBoost: 0.25,
  },
  underwater_canyon: {
    id: 'underwater_canyon',
    labelZh: '海底大峡谷',
    labelEn: 'Underwater Canyon',
    tintBiasRgb: [22, 86, 148],
    floraDensity: 0.76,
    rockDensity: 1.62,
    faunaDensity: 0.94,
    bioluminescenceBoost: 0.55,
  },
  deep_abyss: {
    id: 'deep_abyss',
    labelZh: '深海幽渊区',
    labelEn: 'Deep Abyss',
    tintBiasRgb: [36, 42, 108],
    floraDensity: 0.52,
    rockDensity: 1.25,
    faunaDensity: 0.78,
    bioluminescenceBoost: 0.92,
  },
};

/**
 * 规范第 7 节：首版可配置 5 大深度带
 * | 名称 | 深度 | 视觉/生态 |
 * | Epipelagic | 0–2000 | 明亮、光束、鱼群 |
 * | Mesopelagic | 2000–6000 | 光线减弱、浮游生物 |
 * | Bathypelagic | 6000–10000 | 深蓝、较稀疏 |
 * | Abyssopelagic | 10000–16000 | 黑暗、发光生物 |
 * | Hadal-like | 16000–20000 | 极暗、稀有生物 |
 */
export type DepthBandId =
  | 'Epipelagic'
  | 'Mesopelagic'
  | 'Bathypelagic'
  | 'Abyssopelagic'
  | 'Hadal-like';

export interface DepthBandConfig {
  id: DepthBandId;
  minDepth: number;
  maxDepth: number;
  descriptionZh: string;
  descriptionEn: string;
}

export const DEPTH_BAND_CONFIGS: readonly DepthBandConfig[] = [
  {
    id: 'Epipelagic',
    minDepth: 0,
    maxDepth: 2000,
    descriptionZh: '明亮、光束、鱼群',
    descriptionEn: 'Sunlit, light shafts, fish schools',
  },
  {
    id: 'Mesopelagic',
    minDepth: 2000,
    maxDepth: 6000,
    descriptionZh: '光线减弱、浮游生物',
    descriptionEn: 'Fading light, plankton',
  },
  {
    id: 'Bathypelagic',
    minDepth: 6000,
    maxDepth: 10000,
    descriptionZh: '深蓝、较稀疏',
    descriptionEn: 'Deep blue, sparse fauna',
  },
  {
    id: 'Abyssopelagic',
    minDepth: 10000,
    maxDepth: 16000,
    descriptionZh: '黑暗、发光生物',
    descriptionEn: 'Pitch dark, bioluminescent life',
  },
  {
    id: 'Hadal-like',
    minDepth: 16000,
    maxDepth: 20000,
    descriptionZh: '极暗超深渊海沟（16000m~20000m）、稀有远古巨兽',
    descriptionEn: 'Ultra-dark 16000m~20000m hadal trench, rare apex life',
  },
] as const;

/**
 * 规范第 7 节：根据世界深度坐标 `worldY` 查询所属深度带 `DepthBandId`
 */
export function getDepthBandAt(
  worldY: number,
  config: WorldConfigType = WorldConfig
): DepthBandId {
  const d = clampWorldDepth(worldY, config);
  if (d < 2000) return 'Epipelagic';
  if (d < 6000) return 'Mesopelagic';
  if (d < 10000) return 'Bathypelagic';
  if (d < 16000) return 'Abyssopelagic';
  return 'Hadal-like';
}

/**
 * 规范第 5 节：由 Seed + 宏区索引确定性计算该宏区的 Biome 类型（O(1) 闭式纯函数，Chunk 绝不独立抽签）
 * 采用 8 宏区分组闭式算法，100% 保证任意相邻宏区 m 与 m+1 类型不同（每个宏区交界均为真实平滑过渡），且完全顺序无关！
 */
export function getMacroBiomeForIndex(
  macroIndex: number,
  config: WorldConfigType = WorldConfig
): BiomeId {
  if (!Number.isInteger(macroIndex)) {
    throw new Error(`[BiomeGenerator] macroIndex (${macroIndex}) must be an integer.`);
  }
  const m = macroIndex === 0 ? 0 : macroIndex;
  const blockSize = 8;
  const blockIndex = Math.floor(m / blockSize);
  const blockStart = blockIndex * blockSize;
  const localIdx = m - blockStart; // 0..7

  const hashAt = (idx: number): number =>
    mixSubsystemSeed(config.worldSeed, config.generatorVersion, idx, 0, 'biome');

  const anchorBiomeIdx = (blockIdx: number): number =>
    hashAt(blockIdx * blockSize) % BIOME_IDS.length;

  let prevIdx = anchorBiomeIdx(blockIndex);
  if (localIdx === 0) {
    return BIOME_IDS[prevIdx];
  }

  for (let j = 1; j <= localIdx; j++) {
    const h = hashAt(blockStart + j);
    if (j < blockSize - 1) {
      // 从除 prevIdx 外的其余 4 个 Biome 中确定性选取
      prevIdx = (prevIdx + 1 + (h % (BIOME_IDS.length - 1))) % BIOME_IDS.length;
    } else {
      // j === 7（当前块末尾）：同时避开左侧 j=6 与下一块起点 j=8，确保跨块边界同样不重复
      const nextBlockFirstIdx = anchorBiomeIdx(blockIndex + 1);
      const candidates: number[] = [];
      for (let c = 0; c < BIOME_IDS.length; c++) {
        if (c !== prevIdx && c !== nextBlockFirstIdx) {
          candidates.push(c);
        }
      }
      prevIdx = candidates[h % candidates.length];
    }
  }

  return BIOME_IDS[prevIdx];
}

export interface BlendedBiomeParameters {
  tintBiasRgb: [number, number, number];
  floraDensity: number;
  rockDensity: number;
  faunaDensity: number;
  bioluminescenceBoost: number;
}

export interface BiomeSampleResult {
  primaryBiome: BiomeId;
  secondaryBiome?: BiomeId;
  /** 过渡混合因子 ∈ [0, 1]（0 表示纯 primaryBiome，过渡带内平滑连续变化） */
  blend: number;
  depthBand: DepthBandId;
  macroIndex: number;
  /** 全部 5 类 Biome 的归一化平滑权重（满足每个权重 ∈ [0, 1] 且总和 === 1.0，跨宏区边界 C2 连续无跳变） */
  weights: Record<BiomeId, number>;
  /** 经平滑权重线性混合后的生态参数（颜色、装饰密度、物种概率等无瞬时跳变） */
  blendedParams: BlendedBiomeParameters;
}

/**
 * 规范第 5 & 13 节：查询任意世界坐标 `(worldX, worldY)` 的宏观生态区、平滑混合权重与深度带
 * - X 方向宏区宽度默认 `config.biome.macroWidth` (30000)
 * - 边界过渡宽度默认 `config.biome.transitionWidth` (6000)，以宏区边界 `m * macroWidth` 为中心左右各延伸 `transitionWidth / 2` (3000)
 * - 采用五次平滑曲线 `quinticSmoothstep` 混合，保证跨越 `m * macroWidth` 时所有权重与生态参数 100% 连续无跳变
 */
export function getBiomeAt(
  worldX: number,
  worldY: number,
  config: WorldConfigType = WorldConfig
): BiomeSampleResult {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    throw new Error(`[BiomeGenerator] worldX (${worldX}) and worldY (${worldY}) must be finite numbers.`);
  }
  const macroW = config.biome.macroWidth;
  const transW = config.biome.transitionWidth;
  const halfTrans = transW * 0.5;

  const rawMacroIdx = Math.floor(worldX / macroW);
  const macroIndex = rawMacroIdx === 0 ? 0 : rawMacroIdx;
  const cellStartX = macroIndex * macroW;
  const localX = worldX - cellStartX; // [0, macroW)

  const currentBiome = getMacroBiomeForIndex(macroIndex, config);
  const depthBand = getDepthBandAt(worldY, config);

  let primaryBiome: BiomeId = currentBiome;
  let secondaryBiome: BiomeId | undefined = undefined;
  let blend = 0;

  const weights: Record<BiomeId, number> = {
    coral_reef: 0,
    rocky_shelf: 0,
    open_ocean: 0,
    underwater_canyon: 0,
    deep_abyss: 0,
  };

  if (transW > 0 && localX < halfTrans) {
    // 处于当前宏区左半过渡带 [cellStartX, cellStartX + halfTrans)，与左侧宏区 (macroIndex - 1) 平滑过渡
    // 整个过渡带 [cellStartX - halfTrans, cellStartX + halfTrans] 上的归一化进度 u ∈ [0.5, 1.0)
    const leftBiome = getMacroBiomeForIndex(macroIndex - 1, config);
    const u = (localX + halfTrans) / transW;
    const wCurrent = quinticSmoothstep(0, 1, u); // [0.5, 1.0)
    const wLeft = 1 - wCurrent; // (0, 0.5]

    if (leftBiome !== currentBiome && wLeft > 1e-9) {
      primaryBiome = currentBiome;
      secondaryBiome = leftBiome;
      blend = wLeft;
      weights[currentBiome] = wCurrent;
      weights[leftBiome] = wLeft;
    } else {
      weights[currentBiome] = 1;
    }
  } else if (transW > 0 && localX > macroW - halfTrans) {
    // 处于当前宏区右半过渡带 (cellStartX + macroW - halfTrans, cellStartX + macroW)，与右侧宏区 (macroIndex + 1) 平滑过渡
    // 整个过渡带上的归一化进度 u ∈ (0, 0.5)
    const rightBiome = getMacroBiomeForIndex(macroIndex + 1, config);
    const u = (localX - (macroW - halfTrans)) / transW;
    const wRight = quinticSmoothstep(0, 1, u); // (0, 0.5)
    const wCurrent = 1 - wRight; // (0.5, 1.0)

    if (rightBiome !== currentBiome && wRight > 1e-9) {
      primaryBiome = currentBiome;
      secondaryBiome = rightBiome;
      blend = wRight;
      weights[currentBiome] = wCurrent;
      weights[rightBiome] = wRight;
    } else {
      weights[currentBiome] = 1;
    }
  } else {
    // 宏区核心区 [halfTrans, macroW - halfTrans]
    weights[currentBiome] = 1;
  }

  // 计算平滑混合后的生态区参数
  let r = 0;
  let g = 0;
  let b = 0;
  let floraDensity = 0;
  let rockDensity = 0;
  let faunaDensity = 0;
  let bioluminescenceBoost = 0;

  for (const id of BIOME_IDS) {
    const w = weights[id];
    if (w <= 0) continue;
    const p = BIOME_PRESETS[id];
    r += p.tintBiasRgb[0] * w;
    g += p.tintBiasRgb[1] * w;
    b += p.tintBiasRgb[2] * w;
    floraDensity += p.floraDensity * w;
    rockDensity += p.rockDensity * w;
    faunaDensity += p.faunaDensity * w;
    bioluminescenceBoost += p.bioluminescenceBoost * w;
  }

  return {
    primaryBiome,
    secondaryBiome,
    blend,
    depthBand,
    macroIndex,
    weights,
    blendedParams: {
      tintBiasRgb: [Math.round(r), Math.round(g), Math.round(b)],
      floraDensity,
      rockDensity,
      faunaDensity,
      bioluminescenceBoost,
    },
  };
}

/**
 * 规范第 11 节：统一深度视觉 Profile 数据结构
 * 提供亮度、色调、光束衰减、颗粒密度、发光比例、可见距离。随深度连续变化，浅层光束明显，深层趋向蓝黑。
 */
export interface DepthVisualProfile {
  /** Clamp 后的世界深度 worldY ∈ [minDepth, maxDepth] */
  depth: number;
  /** 归一化深度 ∈ [0, 1] */
  normalizedDepth: number;
  /** 当前深度带名称 */
  depthBand: DepthBandId;
  /** 亮度 ∈ [0.04, 1.0]，随深度增加连续单调衰减 */
  brightness: number;
  /** 水体色调 RGB [0..255] 与 Hex，浅层青蓝 -> 深层蓝黑 */
  waterTintRgb: [number, number, number];
  waterTintHex: string;
  /** 光束衰减强度 ∈ [0, 1]，浅层光束明显，深层衰减至 0 */
  lightShaftIntensity: number;
  /** 悬浮颗粒/海雪密度 ∈ [0.22, 0.95]，随深度连续变化 */
  particleDensity: number;
  /** 生物发光比例 ∈ [0, 1]，随深度增加连续上升 */
  bioluminescenceRatio: number;
  /** 可见距离 (worldPx)，随深度增加连续缩短 */
  visibilityDistance: number;
}

interface DepthVisualKeyframe {
  depth: number;
  brightness: number;
  waterTintRgb: [number, number, number];
  lightShaftIntensity: number;
  particleDensity: number;
  bioluminescenceRatio: number;
  visibilityDistance: number;
}

const DEPTH_VISUAL_KEYFRAMES: readonly DepthVisualKeyframe[] = [
  // 海面 0：极明亮、强丁达尔光束、零生物发光、极远可见距离
  {
    depth: 0,
    brightness: 1.0,
    waterTintRgb: [14, 165, 233],
    lightShaftIntensity: 1.0,
    particleDensity: 0.25,
    bioluminescenceRatio: 0.0,
    visibilityDistance: 3600,
  },
  // Epipelagic -> Mesopelagic 交界 (2000)
  {
    depth: 2000,
    brightness: 0.72,
    waterTintRgb: [2, 132, 199],
    lightShaftIntensity: 0.58,
    particleDensity: 0.42,
    bioluminescenceRatio: 0.12,
    visibilityDistance: 2700,
  },
  // Mesopelagic -> Bathypelagic 交界 (6000)
  {
    depth: 6000,
    brightness: 0.38,
    waterTintRgb: [15, 62, 128],
    lightShaftIntensity: 0.16,
    particleDensity: 0.64,
    bioluminescenceRatio: 0.45,
    visibilityDistance: 1850,
  },
  // Bathypelagic -> Abyssopelagic 交界 (10000)
  {
    depth: 10000,
    brightness: 0.18,
    waterTintRgb: [12, 28, 74],
    lightShaftIntensity: 0.02,
    particleDensity: 0.78,
    bioluminescenceRatio: 0.76,
    visibilityDistance: 1200,
  },
  // Abyssopelagic -> Hadal-like 交界 (16000)
  {
    depth: 16000,
    brightness: 0.08,
    waterTintRgb: [6, 12, 38],
    lightShaftIntensity: 0.0,
    particleDensity: 0.88,
    bioluminescenceRatio: 0.92,
    visibilityDistance: 780,
  },
  // 最大超深渊海沟边界 (20000m)：极致幽暗与荧光生态
  {
    depth: 20000,
    brightness: 0.04,
    waterTintRgb: [3, 7, 26],
    lightShaftIntensity: 0.0,
    particleDensity: 0.94,
    bioluminescenceRatio: 0.97,
    visibilityDistance: 540,
  },
] as const;

function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${clampByte(r).toString(16).padStart(2, '0')}${clampByte(g)
    .toString(16)
    .padStart(2, '0')}${clampByte(b).toString(16).padStart(2, '0')}`;
}

/**
 * 规范第 11 节：统一深度视觉 Profile 纯函数 `getDepthVisualProfile(depth)`
 * 使用分段 C1/C2 连续插值，确保在整个 [0, 20000] 深度范围内连续无突变。
 */
export function getDepthVisualProfile(
  depth: number,
  config: WorldConfigType = WorldConfig
): DepthVisualProfile {
  const clampedDepth = clampWorldDepth(depth, config);
  const span = Math.max(1, config.bounds.maxDepth - config.bounds.minDepth);
  const normalizedDepth = (clampedDepth - config.bounds.minDepth) / span;
  const depthBand = getDepthBandAt(clampedDepth, config);

  // 在相邻关键帧间进行平滑插值
  let k0 = DEPTH_VISUAL_KEYFRAMES[0];
  let k1 = DEPTH_VISUAL_KEYFRAMES[DEPTH_VISUAL_KEYFRAMES.length - 1];

  for (let i = 0; i < DEPTH_VISUAL_KEYFRAMES.length - 1; i++) {
    const cur = DEPTH_VISUAL_KEYFRAMES[i];
    const next = DEPTH_VISUAL_KEYFRAMES[i + 1];
    if (clampedDepth >= cur.depth && clampedDepth <= next.depth) {
      k0 = cur;
      k1 = next;
      break;
    }
  }

  const segSpan = Math.max(1, k1.depth - k0.depth);
  const linearT = Math.max(0, Math.min(1, (clampedDepth - k0.depth) / segSpan));
  // 采用轻度余弦/平滑混合兼具单调性与跨节点连续性
  const t = 0.35 * linearT + 0.65 * quinticSmoothstep(0, 1, linearT);

  const lerp = (a: number, b: number) => a + (b - a) * t;

  const brightness = lerp(k0.brightness, k1.brightness);
  const r = Math.round(lerp(k0.waterTintRgb[0], k1.waterTintRgb[0]));
  const g = Math.round(lerp(k0.waterTintRgb[1], k1.waterTintRgb[1]));
  const b = Math.round(lerp(k0.waterTintRgb[2], k1.waterTintRgb[2]));
  const lightShaftIntensity = lerp(k0.lightShaftIntensity, k1.lightShaftIntensity);
  const particleDensity = lerp(k0.particleDensity, k1.particleDensity);
  const bioluminescenceRatio = lerp(k0.bioluminescenceRatio, k1.bioluminescenceRatio);
  const visibilityDistance = lerp(k0.visibilityDistance, k1.visibilityDistance);

  return {
    depth: clampedDepth,
    normalizedDepth,
    depthBand,
    brightness,
    waterTintRgb: [r, g, b],
    waterTintHex: rgbToHex(r, g, b),
    lightShaftIntensity,
    particleDensity,
    bioluminescenceRatio,
    visibilityDistance,
  };
}

/**
 * 规范第 13 节：BiomeGenerator 服务类（封装 getBiomeAt、getDepthBandAt、getDepthVisualProfile）
 */
export class BiomeGenerator {
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public getMacroBiomeForIndex(macroIndex: number): BiomeId {
    return getMacroBiomeForIndex(macroIndex, this.config);
  }

  public getDepthBandAt(worldY: number): DepthBandId {
    return getDepthBandAt(worldY, this.config);
  }

  public getBiomeAt(worldX: number, worldY: number): BiomeSampleResult {
    return getBiomeAt(worldX, worldY, this.config);
  }

  public getDepthVisualProfile(depth: number): DepthVisualProfile {
    return getDepthVisualProfile(depth, this.config);
  }
}

export const biomeGenerator = new BiomeGenerator(WorldConfig);

// ============================================================================
// 阶段 D（规范第 7、8、9、13、14-D 节）：生态对象配置、POI 生成器 (POIGenerator)、生态生成与 ChunkGenerator 11 步管线
// ============================================================================

/**
 * 规范第 11 节：世界渲染层枚举
 */
export type WorldRenderLayerId =
  | 'far_background'
  | 'mid_background'
  | 'near_background'
  | 'ambient_particles'
  | 'creatures'
  | 'terrain'
  | 'terrain_detail'
  | 'poi'
  | 'foreground_occluders'
  | 'ui';

export const WORLD_RENDER_LAYER_ORDER: Record<WorldRenderLayerId, number> = {
  far_background: 0,
  mid_background: 1,
  near_background: 2,
  ambient_particles: 3,
  creatures: 4,
  terrain: 5,
  terrain_detail: 6,
  poi: 7,
  foreground_occluders: 8,
  ui: 9,
};

/**
 * 规范第 7 & 9 节：生态对象与 POI 类型枚举
 * 覆盖规范第 7 节全部 13 类对象（珊瑚、岩石、海草、鱼群、水母、发光生物、沉船碎片、气泡、浮游颗粒、海雪、洞穴、宝藏、地标）
 * 以及规范第 9 节全部 5 类首版 POI（shipwreck、cave、treasure、rare_creature_nest、landmark）。
 */
export type EcologyObjectType =
  | 'coral'
  | 'rock'
  | 'seagrass'
  | 'fish_school'
  | 'jellyfish'
  | 'biolum_organism'
  | 'shipwreck_debris'
  | 'bubble_stream'
  | 'plankton_mote'
  | 'marine_snow'
  | 'cave'
  | 'treasure'
  | 'landmark'
  | 'shipwreck'
  | 'rare_creature_nest';

export type POIType =
  | 'shipwreck'
  | 'cave'
  | 'treasure'
  | 'rare_creature_nest'
  | 'landmark';

export const POI_TYPES: readonly POIType[] = [
  'shipwreck',
  'cave',
  'treasure',
  'rare_creature_nest',
  'landmark',
] as const;

export type ObjectCollisionType = 'none' | 'solid' | 'trigger' | 'hazard';
export type ObjectLifecycleType = 'static' | 'spawner' | 'ambient_loop' | 'interactive_poi';
export type SeabedPlacementConstraint = 'floor_anchored' | 'near_floor' | 'water_column';

/**
 * 规范第 7 节：每类生态对象完整配置表
 * 包含 type、Biome 白名单 (allowedBiomes)、min/maxDepth、spawnWeight、minSpacing、assetKey、collisionType、renderLayer、lifecycle
 */
export interface EcologyObjectConfig {
  type: EcologyObjectType;
  category: 'flora' | 'fauna' | 'terrain_detail' | 'ambient' | 'poi';
  subsystemKey: 'flora' | 'fauna' | 'ambient' | 'poi';
  allowedBiomes: readonly BiomeId[];
  minDepth: number;
  maxDepth: number;
  spawnWeight: number;
  minSpacing: number;
  assetKey: string;
  collisionType: ObjectCollisionType;
  renderLayer: WorldRenderLayerId;
  lifecycle: ObjectLifecycleType;
  seabedConstraint: SeabedPlacementConstraint;
  /** 对于 floor_anchored / near_floor 对象，距离海床 floorY(x) 的最大允许垂直偏移 (worldPx) */
  maxDistanceToFloor: number;
  variants: readonly string[];
}

export const ECOLOGY_OBJECT_CONFIGS: Record<EcologyObjectType, EcologyObjectConfig> = {
  coral: {
    type: 'coral',
    category: 'flora',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 280,
    maxDepth: 19800,
    spawnWeight: 1.55,
    minSpacing: 130,
    assetKey: 'eco_coral_cluster',
    collisionType: 'none',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 110,
    variants: ['staghorn', 'brain_coral', 'fan_coral', 'tube_sponge'],
  },
  rock: {
    type: 'rock',
    category: 'terrain_detail',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 280,
    maxDepth: 19800,
    spawnWeight: 1.38,
    minSpacing: 140,
    assetKey: 'eco_seabed_rock',
    collisionType: 'solid',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 95,
    variants: ['basalt_boulder', 'mossy_slab', 'jagged_spire'],
  },
  seagrass: {
    type: 'seagrass',
    category: 'flora',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean'],
    minDepth: 200,
    maxDepth: 14500,
    spawnWeight: 1.3,
    minSpacing: 120,
    assetKey: 'eco_seagrass_bed',
    collisionType: 'none',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 100,
    variants: ['meadow_tuft', 'ribbon_grass', 'kelp_sprout'],
  },
  fish_school: {
    type: 'fish_school',
    category: 'fauna',
    subsystemKey: 'fauna',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon'],
    minDepth: 80,
    maxDepth: 12000,
    spawnWeight: 1.5,
    minSpacing: 220,
    assetKey: 'eco_fish_school_spawner',
    collisionType: 'trigger',
    renderLayer: 'creatures',
    lifecycle: 'spawner',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['reef_anthias_swarm', 'silver_sardine_ball', 'twilight_lantern_school'],
  },
  jellyfish: {
    type: 'jellyfish',
    category: 'fauna',
    subsystemKey: 'fauna',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 1000,
    maxDepth: 19000,
    spawnWeight: 1.1,
    minSpacing: 185,
    assetKey: 'eco_jellyfish_bloom',
    collisionType: 'hazard',
    renderLayer: 'creatures',
    lifecycle: 'spawner',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['moon_jelly', 'compass_jelly', 'abyssal_comb_jelly'],
  },
  biolum_organism: {
    type: 'biolum_organism',
    category: 'fauna',
    subsystemKey: 'fauna',
    allowedBiomes: ['underwater_canyon', 'deep_abyss', 'rocky_shelf', 'open_ocean'],
    minDepth: 5500,
    maxDepth: 19800,
    spawnWeight: 1.42,
    minSpacing: 165,
    assetKey: 'eco_biolum_organism',
    collisionType: 'none',
    renderLayer: 'creatures',
    lifecycle: 'spawner',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['siphonophore_chain', 'glow_ctenophore', 'abyss_sea_angel'],
  },
  shipwreck_debris: {
    type: 'shipwreck_debris',
    category: 'terrain_detail',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.72,
    minSpacing: 190,
    assetKey: 'eco_shipwreck_debris',
    collisionType: 'none',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 95,
    variants: ['rusted_anchor', 'broken_mast_timber', 'barnacle_cannon'],
  },
  bubble_stream: {
    type: 'bubble_stream',
    category: 'ambient',
    subsystemKey: 'ambient',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 200,
    maxDepth: 19800,
    spawnWeight: 1.0,
    minSpacing: 150,
    assetKey: 'eco_bubble_stream',
    collisionType: 'none',
    renderLayer: 'ambient_particles',
    lifecycle: 'ambient_loop',
    seabedConstraint: 'near_floor',
    maxDistanceToFloor: 900,
    variants: ['reef_oxygen_plume', 'canyon_fissure_vent', 'thermal_micro_vent'],
  },
  plankton_mote: {
    type: 'plankton_mote',
    category: 'ambient',
    subsystemKey: 'ambient',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon'],
    minDepth: 50,
    maxDepth: 12000,
    spawnWeight: 1.35,
    minSpacing: 130,
    assetKey: 'eco_plankton_mote',
    collisionType: 'none',
    renderLayer: 'ambient_particles',
    lifecycle: 'ambient_loop',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['sunlit_copepod_cloud', 'golden_diatom_drift'],
  },
  marine_snow: {
    type: 'marine_snow',
    category: 'ambient',
    subsystemKey: 'ambient',
    allowedBiomes: ['open_ocean', 'underwater_canyon', 'deep_abyss', 'rocky_shelf'],
    minDepth: 2000,
    maxDepth: 19800,
    spawnWeight: 1.25,
    minSpacing: 135,
    assetKey: 'eco_marine_snow',
    collisionType: 'none',
    renderLayer: 'ambient_particles',
    lifecycle: 'ambient_loop',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['detritus_flurry', 'abyssal_organic_fall'],
  },
  cave: {
    type: 'cave',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['rocky_shelf', 'underwater_canyon', 'deep_abyss', 'coral_reef'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 1.0,
    minSpacing: 1800,
    assetKey: 'poi_abyssal_cave_arch',
    collisionType: 'solid',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 140,
    variants: ['limestone_grotto', 'basalt_canyon_cavern'],
  },
  treasure: {
    type: 'treasure',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.95,
    minSpacing: 1800,
    assetKey: 'poi_sunken_treasure_chest',
    collisionType: 'trigger',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 80,
    variants: ['galleon_gold_coffer', 'ancient_relic_vault'],
  },
  landmark: {
    type: 'landmark',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.85,
    minSpacing: 1800,
    assetKey: 'poi_ancient_ocean_monolith',
    collisionType: 'solid',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 120,
    variants: ['leviathan_rib_arch', 'runic_trench_obelisk'],
  },
  shipwreck: {
    type: 'shipwreck',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 18500,
    spawnWeight: 1.1,
    minSpacing: 1800,
    assetKey: 'poi_shipwreck_hull',
    collisionType: 'solid',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 120,
    variants: ['sunken_frigate', 'rusted_research_sub'],
  },
  rare_creature_nest: {
    type: 'rare_creature_nest',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['underwater_canyon', 'deep_abyss', 'rocky_shelf'],
    minDepth: 2000,
    maxDepth: 19800,
    spawnWeight: 0.8,
    minSpacing: 1800,
    assetKey: 'poi_rare_creature_nest',
    collisionType: 'trigger',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'near_floor',
    maxDistanceToFloor: 380,
    variants: ['apex_kraken_lair', 'biolume_leviathan_den'],
  },
};

/**
 * 规范第 8 节：Chunk 生成对象标准数据结构 `GeneratedObject`
 */
export type GeneratedObject = {
  id: string;
  type: string;
  worldX: number;
  worldY: number;
  rotation?: number;
  scale?: number;
  variant?: string;
  biomeId: string;
  chunkX: number;
  chunkY: number;
  seedKey: string;
  state?: Record<string, unknown>;
};

/**
 * 规范第 9 节：POI 类型配置与实例数据结构
 */
export interface POITypeConfig {
  type: POIType;
  allowedBiomes: readonly BiomeId[];
  minDepth: number;
  maxDepth: number;
  spawnWeight: number;
  /** POI 占地半径 (worldPx) */
  footprintRadius: number;
  /** POI 之间最小中心间距 (worldPx) */
  minPOISpacing: number;
  /** 单个 30000 宽度宏区内的最大数量上限 */
  maxPerMacroBiome: number;
  width: number;
  height: number;
  assetKey: string;
  triggerType: 'wreck_exploration' | 'shelter_zone' | 'loot_chest' | 'elite_ambush' | 'discovery_landmark';
  seabedConstraint: 'floor_anchored' | 'near_floor';
  variants: readonly string[];
}

export const POI_CONFIGS: Record<POIType, POITypeConfig> = {
  shipwreck: {
    type: 'shipwreck',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 18500,
    spawnWeight: 1.1,
    footprintRadius: 420,
    minPOISpacing: 1800,
    maxPerMacroBiome: 3,
    width: 680,
    height: 340,
    assetKey: 'poi_shipwreck_hull',
    triggerType: 'wreck_exploration',
    seabedConstraint: 'floor_anchored',
    variants: ['sunken_frigate', 'rusted_research_sub'],
  },
  cave: {
    type: 'cave',
    allowedBiomes: ['rocky_shelf', 'underwater_canyon', 'deep_abyss', 'coral_reef'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 1.0,
    footprintRadius: 380,
    minPOISpacing: 1800,
    maxPerMacroBiome: 4,
    width: 620,
    height: 360,
    assetKey: 'poi_abyssal_cave_arch',
    triggerType: 'shelter_zone',
    seabedConstraint: 'floor_anchored',
    variants: ['limestone_grotto', 'basalt_canyon_cavern'],
  },
  treasure: {
    type: 'treasure',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.95,
    footprintRadius: 280,
    minPOISpacing: 1800,
    maxPerMacroBiome: 4,
    width: 360,
    height: 240,
    assetKey: 'poi_sunken_treasure_chest',
    triggerType: 'loot_chest',
    seabedConstraint: 'floor_anchored',
    variants: ['galleon_gold_coffer', 'ancient_relic_vault'],
  },
  rare_creature_nest: {
    type: 'rare_creature_nest',
    allowedBiomes: ['underwater_canyon', 'deep_abyss', 'rocky_shelf'],
    minDepth: 2000,
    maxDepth: 19800,
    spawnWeight: 0.8,
    footprintRadius: 360,
    minPOISpacing: 1800,
    maxPerMacroBiome: 3,
    width: 540,
    height: 320,
    assetKey: 'poi_rare_creature_nest',
    triggerType: 'elite_ambush',
    seabedConstraint: 'near_floor',
    variants: ['apex_kraken_lair', 'biolume_leviathan_den'],
  },
  landmark: {
    type: 'landmark',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.85,
    footprintRadius: 340,
    minPOISpacing: 1800,
    maxPerMacroBiome: 3,
    width: 480,
    height: 460,
    assetKey: 'poi_ancient_ocean_monolith',
    triggerType: 'discovery_landmark',
    seabedConstraint: 'floor_anchored',
    variants: ['leviathan_rib_arch', 'runic_trench_obelisk'],
  },
};

export interface GeneratedPOI extends GeneratedObject {
  type: POIType;
  width: number;
  height: number;
  footprintRadius: number;
  minPOISpacing: number;
  ownerChunkX: number;
  ownerChunkY: number;
  ownerChunkId: string;
  depthBand: DepthBandId;
  assetKey: string;
  triggerType: POITypeConfig['triggerType'];
  poiState?: 'unvisited' | 'discovered' | 'interacted' | 'depleted';
}

/**
 * 规范第 9 节：计算水平 POI 槽位 `slotIndex = Math.floor(chunkX / 2)` 的唯一确定性 POI 实体
 * 设计性质：
 * 1. 每个水平槽位覆盖 2 个水平 Chunk（宽 6000 worldPx），槽位内至多生成 1 个 POI，因此任意单个 Chunk 至多拥有 1 个 POI。
 * 2. 每个 POI 的中心点 `worldX` 距离槽位左右外边界至少 950 worldPx，因此任意两个不同槽位的 POI 水平间距恒 >= 1900 worldPx（> 1800 最小间距且 > 任意两个占地半径之和 840），100% 杜绝占地重叠。
 * 3. 当 `worldX` 落在槽位内部 `chunkX = 2*s` 与 `2*s + 1` 交界附近时，POI 的 `footprintRadius` (280..420) 可自然跨越到相邻 Chunk，但 `ownerChunkId = worldToChunkCoord(worldX, worldY)` 严格唯一，仅中心所在 Chunk 管理生成与归属！
 */
function evaluatePOISlot(
  slotIndex: number,
  config: WorldConfigType = WorldConfig
): GeneratedPOI | null {
  const baseChunkX = slotIndex * 2;
  const slotStartX = baseChunkX * config.chunk.width;
  const slotWidth = config.chunk.width * 2; // 6000

  // 使用独立的 'poi' 子系统随机流（与 fauna / flora / terrain / ambient 完全隔离）
  const slotRng = createChunkRng(
    config.worldSeed,
    config.generatorVersion,
    baseChunkX,
    0,
    'poi'
  );

  // 宏区密度控制：每个 30000 宏区含 5 个 6000 槽位，跳过第 4 槽位使每个宏区至多生成 4 个 POI
  const slotInMacro = ((slotIndex % 5) + 5) % 5;
  if (slotInMacro === 4) {
    return null;
  }

  const spawnRoll = slotRng();
  if (spawnRoll > 0.82) {
    return null;
  }

  // 在 [slotStartX + 950, slotStartX + slotWidth - 950] 之间确定性选取 worldX
  // 其中约 35% 概率靠近中间 Chunk 接缝 (slotStartX + 3000 ± 180)，以便测试与展现跨 Chunk 占地但唯一归属
  const edgeBiasRoll = slotRng();
  const seamX = slotStartX + config.chunk.width;
  let worldX: number;
  if (edgeBiasRoll < 0.36) {
    const offsetFromSeam = (slotRng() * 2 - 1) * 180;
    worldX = Math.round(seamX + (Math.abs(offsetFromSeam) < 12 ? 24 : offsetFromSeam));
  } else {
    const margin = 950;
    worldX = Math.round(slotStartX + margin + slotRng() * (slotWidth - margin * 2));
  }

  const floorY = getFloorDepthAt(worldX, config);
  const prelimBiome = getBiomeAt(worldX, floorY, config);

  // 过滤符合当前 Biome 与海床深度范围的候选 POI 类型
  const eligibleConfigs: POITypeConfig[] = [];
  for (const poiType of POI_TYPES) {
    const cfg = POI_CONFIGS[poiType];
    if (!cfg.allowedBiomes.includes(prelimBiome.primaryBiome)) continue;
    const candidateY =
      cfg.seabedConstraint === 'near_floor'
        ? Math.max(cfg.minDepth, floorY - 180)
        : Math.max(cfg.minDepth, floorY - 28);
    if (candidateY >= cfg.minDepth && candidateY <= cfg.maxDepth) {
      eligibleConfigs.push(cfg);
    }
  }

  if (eligibleConfigs.length === 0) {
    return null;
  }

  // 按权重确定性抽取 POI 类型
  let totalWeight = 0;
  for (const cfg of eligibleConfigs) {
    totalWeight += cfg.spawnWeight;
  }
  let pick = slotRng() * totalWeight;
  let chosenCfg = eligibleConfigs[0];
  for (const cfg of eligibleConfigs) {
    pick -= cfg.spawnWeight;
    if (pick <= 0) {
      chosenCfg = cfg;
      break;
    }
  }

  // 计算 POI 垂直世界坐标 worldY（严格位于海床之上且满足 [minDepth, maxDepth] 与 [bounds.minDepth, bounds.maxDepth)）
  const verticalLift =
    chosenCfg.seabedConstraint === 'near_floor'
      ? Math.round(90 + slotRng() * 160)
      : Math.round(16 + slotRng() * 42);
  const rawWorldY = floorY - verticalLift;
  const worldY = Math.max(
    chosenCfg.minDepth,
    Math.min(
      Math.min(chosenCfg.maxDepth, config.bounds.maxDepth - 1),
      Math.max(config.bounds.minDepth, rawWorldY)
    )
  );

  // 计算中心点唯一归属的二维 Chunk (ownerChunkX, ownerChunkY)
  const ownerCoord = worldToChunkCoord(worldX, worldY, config);
  const ownerRng = createChunkRng(
    config.worldSeed,
    config.generatorVersion,
    ownerCoord.chunkX,
    ownerCoord.chunkY,
    'poi'
  );
  const variantIdx = Math.floor(ownerRng() * chosenCfg.variants.length);
  const variant = chosenCfg.variants[variantIdx] ?? chosenCfg.variants[0];
  const scale = Number((0.92 + ownerRng() * 0.18).toFixed(3));
  const rotation = Number(((ownerRng() - 0.5) * 0.12).toFixed(4));

  const finalBiomeSample = getBiomeAt(worldX, worldY, config);
  const seedKey = `poi_slot_${slotIndex}`;
  const id = createStableId(
    config.worldSeed,
    config.generatorVersion,
    chosenCfg.type,
    ownerCoord.chunkX,
    ownerCoord.chunkY,
    seedKey
  );

  return {
    id,
    type: chosenCfg.type,
    worldX,
    worldY,
    rotation,
    scale,
    variant,
    biomeId: finalBiomeSample.primaryBiome,
    chunkX: ownerCoord.chunkX,
    chunkY: ownerCoord.chunkY,
    seedKey,
    width: chosenCfg.width,
    height: chosenCfg.height,
    footprintRadius: chosenCfg.footprintRadius,
    minPOISpacing: chosenCfg.minPOISpacing,
    ownerChunkX: ownerCoord.chunkX,
    ownerChunkY: ownerCoord.chunkY,
    ownerChunkId: ownerCoord.chunkId,
    depthBand: finalBiomeSample.depthBand,
    assetKey: chosenCfg.assetKey,
    triggerType: chosenCfg.triggerType,
    poiState: 'unvisited',
    state: {
      isPOI: true,
      status: 'unvisited',
      discovered: false,
      interacted: false,
      triggerType: chosenCfg.triggerType,
      footprintRadius: chosenCfg.footprintRadius,
      ownerChunkId: ownerCoord.chunkId,
    },
  };
}

/**
 * 规范第 9 & 13 节：查询中心点唯一归属于 `(chunkX, chunkY)` 的 POI 列表（至多 1 个）
 * POI owner 严格为中心点 `(worldX, worldY)` 所在的 Chunk，跨 Chunk 显示绝不重复生成！
 */
export function generatePOIs(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedPOI[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  const slotIndex = Math.floor(bounds.chunkX / 2);
  const candidate = evaluatePOISlot(slotIndex, config);
  if (!candidate) return [];
  if (
    candidate.ownerChunkX === bounds.chunkX &&
    candidate.ownerChunkY === bounds.chunkY &&
    isPointInChunkBounds(candidate.worldX, candidate.worldY, bounds)
  ) {
    return [candidate];
  }
  return [];
}

/**
 * 规范第 8.3 & 9 节：查询中心点在邻近 Chunk、但占地半径 `footprintRadius` 跨界覆盖到 `(chunkX, chunkY)` 的外部 POI
 * 用于跨 Chunk 占地避让与跨界显示引用，而不重复生成或改变其 ownerChunkId。
 */
export function getOverlappingPOIsForChunk(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedPOI[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  const baseSlot = Math.floor(bounds.chunkX / 2);
  const overlapping: GeneratedPOI[] = [];

  for (let s = baseSlot - 1; s <= baseSlot + 1; s++) {
    const poi = evaluatePOISlot(s, config);
    if (!poi) continue;
    // 若归属于当前 Chunk 自身，则已在 generatePOIs 中返回，不计入外部跨界列表
    if (poi.ownerChunkX === bounds.chunkX && poi.ownerChunkY === bounds.chunkY) {
      continue;
    }
    // 计算 POI 中心点到当前 Chunk 矩形 [startX, endX) × [startY, endY) 的最短欧氏距离
    const clampedX = Math.max(bounds.startX, Math.min(bounds.endX, poi.worldX));
    const clampedY = Math.max(bounds.startY, Math.min(bounds.endY, poi.worldY));
    const dist = Math.hypot(poi.worldX - clampedX, poi.worldY - clampedY);
    if (dist <= poi.footprintRadius) {
      overlapping.push(poi);
    }
  }

  return overlapping;
}

/**
 * 规范第 13 节：POIGenerator 服务类
 */
export class POIGenerator {
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public generatePOIs(chunkX: number, chunkY: number): GeneratedPOI[] {
    return generatePOIs(chunkX, chunkY, this.config);
  }

  public getOverlappingPOIsForChunk(chunkX: number, chunkY: number): GeneratedPOI[] {
    return getOverlappingPOIsForChunk(chunkX, chunkY, this.config);
  }
}

export const poiGenerator = new POIGenerator(WorldConfig);

interface RawEcologyCandidate {
  type: EcologyObjectType;
  worldX: number;
  worldY: number;
  rotation: number;
  scale: number;
  variant: string;
  biomeId: BiomeId;
  chunkX: number;
  chunkY: number;
  seedKey: string;
  minSpacing: number;
  priority: number;
  renderLayer: WorldRenderLayerId;
  subsystemKey: 'flora' | 'fauna' | 'ambient';
}

const SUBSYSTEM_OBJECT_TYPES: Record<'flora' | 'fauna' | 'ambient', readonly EcologyObjectType[]> = {
  flora: ['coral', 'rock', 'seagrass', 'shipwreck_debris'],
  fauna: ['fish_school', 'jellyfish', 'biolum_organism'],
  ambient: ['bubble_stream', 'plankton_mote', 'marine_snow'],
};

/**
 * 在单个二维 Chunk `(chunkX, chunkY)` 的单个隔离随机流 `subsystemKey` 下产生候选生态点（簇群中心分布 + 环境过滤）
 * 严格使用 `createChunkRng(worldSeed, generatorVersion, chunkX, chunkY, subsystemKey)`，确保不同子系统 RNG 100% 互不干扰！
 */
function generateSubsystemRawCandidatesForChunk(
  chunkX: number,
  chunkY: number,
  subsystemKey: 'flora' | 'fauna' | 'ambient',
  config: WorldConfigType = WorldConfig
): RawEcologyCandidate[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  // 若 Chunk 完全在合法海洋深度之外则不生成任何对象
  if (bounds.endY <= config.bounds.minDepth || bounds.startY >= config.bounds.maxDepth) {
    return [];
  }

  // 步骤 3：创建当前子系统独立 RNG
  const rng = createChunkRng(
    config.worldSeed,
    config.generatorVersion,
    bounds.chunkX,
    bounds.chunkY,
    subsystemKey
  );

  // 检查当前二维 Chunk 全部 31 个海床采样点，精准识别海床穿过本 Chunk 的水平子区间
  const midWorldX = bounds.startX + bounds.width * 0.5;
  const terrainSamples = getTerrainSamples(bounds.chunkX, config);
  let minChunkFloorY = Infinity;
  let maxChunkFloorY = -Infinity;
  const inChunkSeabedX: number[] = [];

  for (const pt of terrainSamples.points) {
    if (pt.floorY < minChunkFloorY) minChunkFloorY = pt.floorY;
    if (pt.floorY > maxChunkFloorY) maxChunkFloorY = pt.floorY;
    if (
      pt.worldX >= bounds.startX + 45 &&
      pt.worldX <= bounds.endX - 45 &&
      pt.floorY >= bounds.startY + 6 &&
      pt.floorY < bounds.endY - 4
    ) {
      inChunkSeabedX.push(pt.worldX);
    }
  }

  // 若整个 Chunk 位于海床基岩下方（即 startY > maxChunkFloorY），属于海床地壳内部，不生成水体/海床表面生态对象
  if (bounds.startY > maxChunkFloorY) {
    return [];
  }

  const chunkContainsSeabed =
    inChunkSeabedX.length > 0 ||
    (maxChunkFloorY >= bounds.startY && minChunkFloorY < bounds.endY);
  const chunkNearSeabed =
    minChunkFloorY - bounds.endY <= 850 && maxChunkFloorY >= bounds.startY;

  // flora 子系统（珊瑚/岩石/海草/沉船碎片）仅锚定在包含海床的 Chunk 中
  if (subsystemKey === 'flora' && !chunkContainsSeabed) {
    return [];
  }

  const centerBiome = getBiomeAt(
    midWorldX,
    Math.min(bounds.endY - 1, Math.max(bounds.startY, minChunkFloorY - 200)),
    config
  );

  // 步骤 4：采用簇群中心分布（允许大片空海域，告别均匀撒豆）
  const baseTarget = Math.max(0, config.generation.staticObjectsPerChunkTarget);
  const densityMod =
    subsystemKey === 'flora'
      ? (centerBiome.blendedParams.floraDensity + centerBiome.blendedParams.rockDensity) * 0.5
      : subsystemKey === 'fauna'
      ? centerBiome.blendedParams.faunaDensity
      : 0.9 + centerBiome.blendedParams.bioluminescenceBoost * 0.35;

  const subsystemShare =
    subsystemKey === 'flora' ? 0.45 : subsystemKey === 'fauna' ? 0.32 : 0.23;
  const maxSubsystemTarget = Math.max(
    1,
    Math.min(18, Math.round(baseTarget * subsystemShare * densityMod))
  );

  const clusterCount = Math.max(1, Math.min(3, Math.ceil(maxSubsystemTarget / 4)));
  const clusters: Array<{ cx: number; cy: number; radiusX: number; radiusY: number }> = [];
  for (let c = 0; c < clusterCount; c++) {
    const rX = rng();
    let cx = bounds.startX + (0.14 + rX * 0.72) * bounds.width;
    if (subsystemKey === 'flora' && inChunkSeabedX.length > 0) {
      const exactIdx = rX * (inChunkSeabedX.length - 1);
      const i0 = Math.floor(exactIdx);
      const i1 = Math.min(inChunkSeabedX.length - 1, i0 + 1);
      const frac = exactIdx - i0;
      cx = inChunkSeabedX[i0] * (1 - frac) + inChunkSeabedX[i1] * frac;
    }
    const localFloor = getFloorDepthAt(cx, config);
    const cy =
      subsystemKey === 'flora'
        ? Math.max(bounds.startY + 8, Math.min(bounds.endY - 8, localFloor - 24))
        : bounds.startY + (0.15 + rng() * 0.7) * Math.min(bounds.height, Math.max(120, localFloor - bounds.startY));
    clusters.push({
      cx,
      cy,
      radiusX: 220 + rng() * 280,
      radiusY: 140 + rng() * 190,
    });
  }

  const candidateTypes = SUBSYSTEM_OBJECT_TYPES[subsystemKey];
  const rawCandidates: RawEcologyCandidate[] = [];
  const totalSlots = maxSubsystemTarget * 2;

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const cluster = clusters[slotIdx % clusters.length];
    const angle = rng() * Math.PI * 2;
    const radial = Math.pow(rng(), 0.65);
    const priority = rng();
    const typeRoll = rng();
    const variantRoll = rng();
    const scaleRoll = rng();
    const rotRoll = rng();
    const verticalOffsetRoll = rng();

    let worldX = Math.round(cluster.cx + Math.cos(angle) * radial * cluster.radiusX);
    if (subsystemKey === 'flora' && inChunkSeabedX.length > 0) {
      const minSeabedX = inChunkSeabedX[0];
      const maxSeabedX = inChunkSeabedX[inChunkSeabedX.length - 1];
      worldX = Math.max(minSeabedX, Math.min(maxSeabedX, worldX));
    }
    // 严格限制在左闭右开 [startX, endX) 内
    if (worldX < bounds.startX || worldX >= bounds.endX) {
      continue;
    }

    const floorY = getFloorDepthAt(worldX, config);
    let worldY: number;
    if (subsystemKey === 'flora') {
      // 贴地生成：锚定在海床表面 getFloorDepthAt(worldX) 之上 6..72 worldPx
      const floorLift = Math.round(6 + verticalOffsetRoll * 66);
      worldY = Math.round(floorY - floorLift);
    } else if (subsystemKey === 'ambient' && chunkNearSeabed && verticalOffsetRoll < 0.42) {
      // 近底气泡流或深水颗粒
      worldY = Math.round(Math.min(bounds.endY - 2, floorY - (40 + verticalOffsetRoll * 520)));
    } else {
      // 水体开放空间生成（距离海床至少 140 worldPx 安全净空）
      worldY = Math.round(cluster.cy + Math.sin(angle) * radial * cluster.radiusY);
      if (worldY > floorY - 140) {
        worldY = Math.round(floorY - 140 - verticalOffsetRoll * 180);
      }
    }

    // 步骤 5：过滤 Chunk 边界 [startX, endX) × [startY, endY) 与海洋全局深度边界
    if (!isPointInChunkBounds(worldX, worldY, bounds)) {
      continue;
    }
    if (
      worldY < config.bounds.minDepth ||
      worldY >= config.bounds.maxDepth ||
      worldY > floorY
    ) {
      continue;
    }

    // 查询该点的精确 Biome 与深度带
    const localBiome = getBiomeAt(worldX, worldY, config);
    const distToFloor = floorY - worldY;

    // 步骤 5 & 6：过滤符合深度、Biome 白名单与海床距离的对象类型，并按平滑权重选择类型与变体
    const validConfigs: Array<{ cfg: EcologyObjectConfig; weight: number }> = [];
    for (const t of candidateTypes) {
      const cfg = ECOLOGY_OBJECT_CONFIGS[t];
      if (worldY < cfg.minDepth || worldY > cfg.maxDepth) continue;
      if (!cfg.allowedBiomes.includes(localBiome.primaryBiome)) continue;
      if (cfg.seabedConstraint === 'floor_anchored' && distToFloor > cfg.maxDistanceToFloor) {
        continue;
      }
      if (
        cfg.seabedConstraint === 'near_floor' &&
        (distToFloor < 10 || distToFloor > cfg.maxDistanceToFloor)
      ) {
        continue;
      }
      if (cfg.seabedConstraint === 'water_column' && distToFloor < 120) {
        continue;
      }

      // 结合当前 Biome 平滑混合参数动态调制权重
      let effWeight = cfg.spawnWeight;
      if (cfg.type === 'coral' || cfg.type === 'seagrass') {
        effWeight *= localBiome.blendedParams.floraDensity;
      } else if (cfg.type === 'rock' || cfg.type === 'shipwreck_debris') {
        effWeight *= localBiome.blendedParams.rockDensity;
      } else if (cfg.type === 'biolum_organism') {
        effWeight *= 0.6 + localBiome.blendedParams.bioluminescenceBoost;
      } else if (cfg.type === 'fish_school' || cfg.type === 'jellyfish') {
        effWeight *= localBiome.blendedParams.faunaDensity;
      }
      if (effWeight > 0) {
        validConfigs.push({ cfg, weight: effWeight });
      }
    }

    if (validConfigs.length === 0) {
      continue;
    }

    let weightSum = 0;
    for (const item of validConfigs) weightSum += item.weight;
    let pickW = typeRoll * weightSum;
    let selectedCfg = validConfigs[0].cfg;
    for (const item of validConfigs) {
      pickW -= item.weight;
      if (pickW <= 0) {
        selectedCfg = item.cfg;
        break;
      }
    }

    const effectiveMinSpacing = Math.max(
      config.generation.minObjectSpacing,
      selectedCfg.minSpacing
    );

    const variantIndex = Math.floor(variantRoll * selectedCfg.variants.length);
    const variant = selectedCfg.variants[variantIndex] ?? selectedCfg.variants[0];
    const scale = Number((0.82 + scaleRoll * 0.42).toFixed(3));
    const rotation =
      selectedCfg.seabedConstraint === 'floor_anchored'
        ? Number((getTerrainSlopeAt(worldX, config) * 0.45 + (rotRoll - 0.5) * 0.14).toFixed(4))
        : Number(((rotRoll - 0.5) * 0.25).toFixed(4));

    const seedKey = `${subsystemKey}_slot_${slotIdx}`;
    rawCandidates.push({
      type: selectedCfg.type,
      worldX,
      worldY,
      rotation,
      scale,
      variant,
      biomeId: localBiome.primaryBiome,
      chunkX: bounds.chunkX,
      chunkY: bounds.chunkY,
      seedKey,
      minSpacing: effectiveMinSpacing,
      priority,
      renderLayer: selectedCfg.renderLayer,
      subsystemKey,
    });
  }

  // 在当前 Chunk 内部先按固有槽位与优先级执行一次内部间距去重，确保结果数量 <= maxSubsystemTarget
  const internalAccepted: RawEcologyCandidate[] = [];
  for (const cand of rawCandidates) {
    if (internalAccepted.length >= maxSubsystemTarget) break;
    let conflict = false;
    for (const acc of internalAccepted) {
      const reqDist = Math.max(cand.minSpacing, acc.minSpacing);
      const dx = cand.worldX - acc.worldX;
      const dy = cand.worldY - acc.worldY;
      if (dx * dx + dy * dy < reqDist * reqDist) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      internalAccepted.push(cand);
    }
  }

  return internalAccepted;
}

/**
 * 规范第 7、8、13 节：生成指定二维 Chunk `(chunkX, chunkY)` 的生态对象纯数据 `generateEcology`
 * - 子系统随机流 (`flora`、`fauna`、`ambient`) 严格相互隔离
 * - 包含跨邻 Chunk (`chunkX ± 1, chunkY ± 1`) 的确定性对称间距消解，保证任意生成顺序下跨边界间距 >= minSpacing 且 100% 结果恒等
 * - 自动避让本 Chunk 及邻近跨界 POI 的占地半径 (`footprintRadius`)
 */
export function generateEcology(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedObject[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  const subsystems: readonly ('flora' | 'fauna' | 'ambient')[] = ['flora', 'fauna', 'ambient'];

  // 收集本 Chunk 归属及跨界覆盖的 POI 占地圆，用于避让固体 POI 核心区
  const activePois = [
    ...generatePOIs(bounds.chunkX, bounds.chunkY, config),
    ...getOverlappingPOIsForChunk(bounds.chunkX, bounds.chunkY, config),
  ];

  const finalObjects: GeneratedObject[] = [];

  for (const subKey of subsystems) {
    const ownCandidates = generateSubsystemRawCandidatesForChunk(
      bounds.chunkX,
      bounds.chunkY,
      subKey,
      config
    );
    if (ownCandidates.length === 0) continue;

    // 收集周围 8 个邻接 Chunk 在同一子系统下的候选点（仅用于跨 Chunk 边界间距检查，绝对顺序无关）
    const neighborCandidates: RawEcologyCandidate[] = [];
    const borderCheckMargin = 320;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ncx = bounds.chunkX + dx;
        const ncy = bounds.chunkY + dy;
        const nCands = generateSubsystemRawCandidatesForChunk(ncx, ncy, subKey, config);
        for (const nc of nCands) {
          // 仅需考虑靠近当前 Chunk 边界 borderCheckMargin 范围内的邻格点
          if (
            nc.worldX >= bounds.startX - borderCheckMargin &&
            nc.worldX <= bounds.endX + borderCheckMargin &&
            nc.worldY >= bounds.startY - borderCheckMargin &&
            nc.worldY <= bounds.endY + borderCheckMargin
          ) {
            neighborCandidates.push(nc);
          }
        }
      }
    }

    // 步骤 7：检查间距（含邻 Chunk）与 POI 占地避让
    for (const cand of ownCandidates) {
      // 7.1 检查是否落入固体 POI 的核心排斥半径内
      let insideSolidPoi = false;
      for (const poi of activePois) {
        const distToPoi = Math.hypot(cand.worldX - poi.worldX, cand.worldY - poi.worldY);
        if (distToPoi < poi.footprintRadius * 0.55) {
          insideSolidPoi = true;
          break;
        }
      }
      if (insideSolidPoi) continue;

      // 7.2 与邻 Chunk 候选点做确定性优先级比对（若间距小于 reqDist，仅保留优先级更高或字典序更小的一方）
      let defeatedByNeighbor = false;
      for (const nc of neighborCandidates) {
        const reqDist = Math.max(cand.minSpacing, nc.minSpacing);
        const dx = cand.worldX - nc.worldX;
        const dy = cand.worldY - nc.worldY;
        if (dx * dx + dy * dy < reqDist * reqDist) {
          if (
            nc.priority > cand.priority ||
            (nc.priority === cand.priority &&
              (nc.chunkX < cand.chunkX ||
                (nc.chunkX === cand.chunkX && nc.chunkY < cand.chunkY)))
          ) {
            defeatedByNeighbor = true;
            break;
          }
        }
      }
      if (defeatedByNeighbor) continue;

      // 步骤 9：生成稳定 ID（基于 worldSeed、generatorVersion、type、chunkX、chunkY、固有槽位 seedKey）
      const stableId = createStableId(
        config.worldSeed,
        config.generatorVersion,
        cand.type,
        cand.chunkX,
        cand.chunkY,
        cand.seedKey
      );

      const objCfg = ECOLOGY_OBJECT_CONFIGS[cand.type];
      finalObjects.push({
        id: stableId,
        type: cand.type,
        worldX: cand.worldX,
        worldY: cand.worldY,
        rotation: cand.rotation,
        scale: cand.scale,
        variant: cand.variant,
        biomeId: cand.biomeId,
        chunkX: cand.chunkX,
        chunkY: cand.chunkY,
        seedKey: cand.seedKey,
        state: {
          category: objCfg.category,
          assetKey: objCfg.assetKey,
          collisionType: objCfg.collisionType,
          renderLayer: objCfg.renderLayer,
          lifecycle: objCfg.lifecycle,
        },
      });
    }
  }

  // 步骤 10：按稳定规则排序 (renderLayerOrder -> worldX -> worldY -> id)
  finalObjects.sort((a, b) => {
    const layerA =
      WORLD_RENDER_LAYER_ORDER[
        (a.state?.renderLayer as WorldRenderLayerId) ?? 'terrain_detail'
      ] ?? 6;
    const layerB =
      WORLD_RENDER_LAYER_ORDER[
        (b.state?.renderLayer as WorldRenderLayerId) ?? 'terrain_detail'
      ] ?? 6;
    if (layerA !== layerB) return layerA - layerB;
    if (a.worldX !== b.worldX) return a.worldX - b.worldX;
    if (a.worldY !== b.worldY) return a.worldY - b.worldY;
    return a.id.localeCompare(b.id);
  });

  return finalObjects;
}

/**
 * 规范第 8 & 13 节：单个二维 Chunk 的完整纯数据输出结构 `GeneratedChunkData`
 */
export interface GeneratedChunkData {
  chunkX: number;
  chunkY: number;
  chunkId: string;
  bounds: ChunkBounds2D;
  biomeSample: BiomeSampleResult;
  depthBand: DepthBandId;
  depthVisualProfile: DepthVisualProfile;
  terrainSamples: TerrainChunkSamples;
  /** 唯一归属于本 Chunk 的全部生成对象（含生态对象与本 Chunk 归属的 POI 对象，按稳定规则排序） */
  objects: GeneratedObject[];
  /** 唯一归属于本 Chunk 的生态对象列表 */
  ecologyObjects: GeneratedObject[];
  /** 唯一归属于本 Chunk 的 POI 列表（至多 1 个，满足 ownerChunkId === chunkId） */
  pois: GeneratedPOI[];
  /** 中心在邻近 Chunk、但占地半径跨界覆盖本 Chunk 的外部 POI 引用列表（不重复生成） */
  overlappingPOIs: GeneratedPOI[];
}

/**
 * 规范第 8 & 13 节：ChunkGenerator 编排数据生成纯函数 `generateChunk(chunkX, chunkY, config)`
 * 严格遵循规范第 8.2 节的 11 步固定生成管线顺序：
 * 1) 算 Chunk bounds；2) 查询 Biome/深度带；3) 创建独立 RNG；
 * 4) 产生稳定候选点；5) 过滤深度/Biome/海床距离/边界；
 * 6) 按权重选类型与变体；7) 检查间距（含邻 Chunk）；
 * 8) 生成 POI 并检查唯一归属；9) 生成稳定 ID；
 * 10) 按稳定规则排序；11) 输出纯数据，再由管理器创建渲染实例。
 */
export function generateChunk(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedChunkData {
  // 1) 算 Chunk bounds
  const bounds = getChunkBounds(chunkX, chunkY, config);

  // 2) 查询 Biome/深度带与统一深度视觉 Profile
  const centerX = bounds.startX + bounds.width * 0.5;
  const centerY = clampWorldDepth(bounds.startY + bounds.height * 0.5, config);
  const biomeSample = getBiomeAt(centerX, centerY, config);
  const depthVisualProfile = getDepthVisualProfile(centerY, config);
  const terrainSamples = getTerrainSamples(bounds.chunkX, config);

  // 3) ~ 7) & 9)：通过隔离 RNG 生成生态对象并检查跨邻 Chunk 间距
  const ecologyObjects = generateEcology(bounds.chunkX, bounds.chunkY, config);

  // 8) 生成 POI 并检查唯一归属（每个 Chunk 至多 1 个 POI，中心点严格位于当前 Chunk bounds 内）
  const pois = generatePOIs(bounds.chunkX, bounds.chunkY, config);
  const overlappingPOIs = getOverlappingPOIsForChunk(bounds.chunkX, bounds.chunkY, config);

  // 10) 合并本 Chunk 唯一归属的对象并按稳定规则排序
  const objects: GeneratedObject[] = [...ecologyObjects, ...pois];
  objects.sort((a, b) => {
    const layerA =
      WORLD_RENDER_LAYER_ORDER[
        (a.state?.renderLayer as WorldRenderLayerId) ?? (a.state?.isPOI ? 'poi' : 'terrain_detail')
      ] ?? 6;
    const layerB =
      WORLD_RENDER_LAYER_ORDER[
        (b.state?.renderLayer as WorldRenderLayerId) ?? (b.state?.isPOI ? 'poi' : 'terrain_detail')
      ] ?? 6;
    if (layerA !== layerB) return layerA - layerB;
    if (a.worldX !== b.worldX) return a.worldX - b.worldX;
    if (a.worldY !== b.worldY) return a.worldY - b.worldY;
    return a.id.localeCompare(b.id);
  });

  // 11) 输出纯数据
  return {
    chunkX: bounds.chunkX,
    chunkY: bounds.chunkY,
    chunkId: bounds.chunkId,
    bounds,
    biomeSample,
    depthBand: biomeSample.depthBand,
    depthVisualProfile,
    terrainSamples,
    objects,
    ecologyObjects,
    pois,
    overlappingPOIs,
  };
}

/**
 * 规范第 13 节：ChunkGenerator 编排器类
 */
export class ChunkGenerator {
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public generateChunk(chunkX: number, chunkY: number): GeneratedChunkData {
    return generateChunk(chunkX, chunkY, this.config);
  }
}

export const chunkGenerator = new ChunkGenerator(WorldConfig);

// ============================================================================
// 阶段 E：Chunk 生命周期状态机、方向性预加载、异步任务防激活与对象池 (规范第 10、12、13、14-E 节)
// ============================================================================

/**
 * 规范第 10 节：Chunk 生命周期状态定义
 */
export type ChunkLifecycleState =
  | 'unloaded'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'active'
  | 'releasing';

/**
 * 合法状态流转表（严禁跳过状态如 unloaded -> active 或 generating -> active）
 */
const VALID_CHUNK_STATE_TRANSITIONS: Record<ChunkLifecycleState, ReadonlyArray<ChunkLifecycleState>> = {
  unloaded: ['queued', 'ready'], // unloaded -> ready 仅限命中 LRU 缓存时直接恢复为待激活数据
  queued: ['generating', 'unloaded'], // 排队中若相机移走可直接取消回 unloaded
  generating: ['ready'], // 异步或分帧生成完成后必须先进入 ready
  ready: ['active', 'releasing'], // 在视野内则激活为 active；若完成时已离开目标窗口则进入 releasing
  active: ['releasing'], // 离开保留窗口时必须经过 releasing 回收对象池
  releasing: ['unloaded'], // 清理完对象池与强引用后回到 unloaded
};

/**
 * 校验状态迁移是否合法
 */
export function isValidChunkStateTransition(
  from: ChunkLifecycleState,
  to: ChunkLifecycleState
): boolean {
  return VALID_CHUNK_STATE_TRANSITIONS[from].includes(to);
}

export type WorldObjectData = GeneratedObject;
export type POIData = GeneratedPOI;
export type VisibleChunkRange = ReturnType<typeof getVisibleChunkRange>;

function hashToUint32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Chunk 运行时对象池实例（脱离 Chunk 后可100%干净复用）
 */
export interface PooledWorldInstance {
  poolType: string;
  instanceId: string;
  chunkId: string | null;
  sourceObjectId: string | null;
  sourceDataRef: WorldObjectData | POIData | null;
  worldX: number;
  worldY: number;
  vx: number;
  vy: number;
  scale: number;
  rotation: number;
  animPhase: number;
  collisionEnabled: boolean;
  active: boolean;
  layer: 'background' | 'midground' | 'foreground';
  assetKey: string;
  poiState?: 'unvisited' | 'discovered' | 'interacted' | 'depleted';
  eventListeners: Array<() => void>;
  timers: number[];
}

/**
 * 规范第 10 / 12 节：带容量上限与强引用彻底清理的对象池
 */
export class WorldObjectPool {
  private readonly maxPerType: number;
  private readonly buckets: Map<string, PooledWorldInstance[]> = new Map();
  private readonly activeInstancesByChunk: Map<string, PooledWorldInstance[]> = new Map();
  private nextInstanceSeq = 1;
  private totalAcquiredCount = 0;
  private totalReleasedCount = 0;
  private totalDroppedOverflowCount = 0;

  constructor(maxPerType: number = WorldConfig.performance.maxPooledObjectsPerType) {
    this.maxPerType = Math.max(1, Math.floor(maxPerType));
  }

  public acquire(
    poolType: string,
    chunkId: string,
    sourceData: WorldObjectData | POIData
  ): PooledWorldInstance {
    let bucket = this.buckets.get(poolType);
    let inst: PooledWorldInstance | undefined = bucket?.pop();
    if (!inst) {
      inst = {
        poolType,
        instanceId: `pool_${poolType}_${this.nextInstanceSeq++}`,
        chunkId: null,
        sourceObjectId: null,
        sourceDataRef: null,
        worldX: 0,
        worldY: 0,
        vx: 0,
        vy: 0,
        scale: 1,
        rotation: 0,
        animPhase: 0,
        collisionEnabled: false,
        active: false,
        layer: 'midground',
        assetKey: '',
        eventListeners: [],
        timers: [],
      };
    }

    const ecoCfg = ECOLOGY_OBJECT_CONFIGS[sourceData.type as EcologyObjectType];
    inst.poolType = poolType;
    inst.chunkId = chunkId;
    inst.sourceObjectId = sourceData.id;
    inst.sourceDataRef = sourceData;
    inst.worldX = sourceData.worldX;
    inst.worldY = sourceData.worldY;
    inst.vx = 0;
    inst.vy = 0;
    inst.scale = sourceData.scale ?? 1;
    inst.rotation = sourceData.rotation ?? 0;
    inst.animPhase = (hashToUint32(sourceData.id) % 628) / 100;
    inst.collisionEnabled = true;
    inst.active = true;
    inst.layer = 'midground';
    inst.assetKey =
      'assetKey' in sourceData && typeof sourceData.assetKey === 'string'
        ? sourceData.assetKey
        : ecoCfg?.assetKey ?? '';
    inst.poiState = 'poiState' in sourceData ? sourceData.poiState : undefined;

    let chunkList = this.activeInstancesByChunk.get(chunkId);
    if (!chunkList) {
      chunkList = [];
      this.activeInstancesByChunk.set(chunkId, chunkList);
    }
    chunkList.push(inst);
    this.totalAcquiredCount += 1;
    return inst;
  }

  /**
   * 规范第 10 节对象池清理要求：
   * 重置位置、速度、缩放、旋转、动画、碰撞，并清空 chunkId、sourceDataRef、事件监听与定时器，
   * 确保卸载后零强引用残留。
   */
  public release(inst: PooledWorldInstance): void {
    // 清理挂接的监听器与定时器
    for (const cleanup of inst.eventListeners) {
      try {
        cleanup();
      } catch {
        // ignore listener cleanup errors
      }
    }
    inst.eventListeners.length = 0;
    inst.timers.length = 0;

    // 重置所有物理/渲染与引用字段
    inst.chunkId = null;
    inst.sourceObjectId = null;
    inst.sourceDataRef = null;
    inst.worldX = 0;
    inst.worldY = 0;
    inst.vx = 0;
    inst.vy = 0;
    inst.scale = 1;
    inst.rotation = 0;
    inst.animPhase = 0;
    inst.collisionEnabled = false;
    inst.active = false;
    inst.layer = 'midground';
    inst.assetKey = '';
    inst.poiState = undefined;

    let bucket = this.buckets.get(inst.poolType);
    if (!bucket) {
      bucket = [];
      this.buckets.set(inst.poolType, bucket);
    }
    if (bucket.length < this.maxPerType) {
      bucket.push(inst);
    } else {
      this.totalDroppedOverflowCount += 1;
    }
    this.totalReleasedCount += 1;
  }

  public registerActiveChunk(chunkId: string): void {
    if (!this.activeInstancesByChunk.has(chunkId)) {
      this.activeInstancesByChunk.set(chunkId, []);
    }
  }

  /**
   * 批量释放指定 Chunk 的全部运行实例
   */
  public releaseChunkInstances(chunkId: string): PooledWorldInstance[] {
    const list = this.activeInstancesByChunk.get(chunkId);
    if (!list || list.length === 0) {
      this.activeInstancesByChunk.delete(chunkId);
      return [];
    }
    this.activeInstancesByChunk.delete(chunkId);
    for (const inst of list) {
      this.release(inst);
    }
    return list;
  }

  public getActiveInstancesForChunk(chunkId: string): ReadonlyArray<PooledWorldInstance> {
    return this.activeInstancesByChunk.get(chunkId) ?? [];
  }

  public getActiveChunkCountWithInstances(): number {
    return this.activeInstancesByChunk.size;
  }

  public getTotalActiveInstanceCount(): number {
    let total = 0;
    for (const list of this.activeInstancesByChunk.values()) {
      total += list.length;
    }
    return total;
  }

  public getPooledCountForType(poolType: string): number {
    return this.buckets.get(poolType)?.length ?? 0;
  }

  public getTotalPooledCount(): number {
    let total = 0;
    for (const bucket of this.buckets.values()) {
      total += bucket.length;
    }
    return total;
  }

  public getMaxPooledObjectsPerType(): number {
    return this.maxPerType;
  }

  public clearAll(): void {
    for (const chunkId of Array.from(this.activeInstancesByChunk.keys())) {
      this.releaseChunkInstances(chunkId);
    }
    this.buckets.clear();
  }

  public getStats(): {
    totalActiveInstances: number;
    totalPooledInstances: number;
    maxPerType: number;
    totalAcquiredCount: number;
    totalReleasedCount: number;
    totalDroppedOverflowCount: number;
  } {
    return {
      totalActiveInstances: this.getTotalActiveInstanceCount(),
      totalPooledInstances: this.getTotalPooledCount(),
      maxPerType: this.maxPerType,
      totalAcquiredCount: this.totalAcquiredCount,
      totalReleasedCount: this.totalReleasedCount,
      totalDroppedOverflowCount: this.totalDroppedOverflowCount,
    };
  }
}

export const worldObjectPool = new WorldObjectPool(WorldConfig.performance.maxPooledObjectsPerType);

/**
 * 规范第 10 节：方向性预加载与垂直缓冲窗口计算
 * - 向右移动：右侧预加载 preloadAhead (4)，左侧保留 retainBehind (2)
 * - 向左移动：左侧预加载 preloadAhead (4)，右侧保留 retainBehind (2)
 * - 静止或低速：左右各预加载 3 个 Chunk
 * - 垂直方向：仅围绕当前相机深度层加载可见行 ± 1 行缓冲，严禁整列全深度常驻加载
 */
export interface DesiredChunkWindow {
  visibleRange: VisibleChunkRange;
  minWindowChunkX: number;
  maxWindowChunkX: number;
  minWindowChunkY: number;
  maxWindowChunkY: number;
  preloadLeft: number;
  preloadRight: number;
  verticalBufferRows: number;
  desiredCoords: Array<{
    chunkX: number;
    chunkY: number;
    chunkId: string;
    isVisible: boolean;
    distanceSq: number;
    forwardPriority: number;
  }>;
  activeCandidateIds: Set<string>;
  retainWindowIds: Set<string>;
}

export function getDesiredChunkWindow(
  cameraWorldRect: { minWorldX: number; maxWorldX: number; minWorldY: number; maxWorldY: number },
  playerVelocityX: number = 0,
  config: WorldConfigType = WorldConfig
): DesiredChunkWindow {
  const visibleRange = getVisibleChunkRange(
    {
      x: cameraWorldRect.minWorldX,
      y: cameraWorldRect.minWorldY,
      width: Math.max(1, cameraWorldRect.maxWorldX - cameraWorldRect.minWorldX),
      height: Math.max(1, cameraWorldRect.maxWorldY - cameraWorldRect.minWorldY),
    },
    config
  );
  const { preloadAhead, retainBehind, maxActiveChunks, height } = config.chunk;

  let preloadLeft = 3;
  let preloadRight = 3;
  const speedThreshold = 5;
  if (playerVelocityX > speedThreshold) {
    preloadRight = preloadAhead; // 4
    preloadLeft = retainBehind; // 2
  } else if (playerVelocityX < -speedThreshold) {
    preloadLeft = preloadAhead; // 4
    preloadRight = retainBehind; // 2
  }

  const verticalBufferRows = 1;
  const maxChunkYLimit = Math.max(0, Math.ceil(config.bounds.maxDepth / height) - 1);
  const minWindowChunkX = visibleRange.minChunkX - preloadLeft;
  const maxWindowChunkX = visibleRange.maxChunkX + preloadRight;
  const minWindowChunkY = Math.max(0, visibleRange.minChunkY - verticalBufferRows);
  const maxWindowChunkY = Math.min(maxChunkYLimit, visibleRange.maxChunkY + verticalBufferRows);

  const centerChunkX = (visibleRange.minChunkX + visibleRange.maxChunkX) * 0.5;
  const centerChunkY = (visibleRange.minChunkY + visibleRange.maxChunkY) * 0.5;
  const moveDir = playerVelocityX > speedThreshold ? 1 : playerVelocityX < -speedThreshold ? -1 : 0;

  const visibleSet = new Set(visibleRange.chunkCoords.map((c) => c.chunkId));
  const desiredCoords: DesiredChunkWindow['desiredCoords'] = [];
  const retainWindowIds = new Set<string>();

  for (let cy = minWindowChunkY; cy <= maxWindowChunkY; cy++) {
    for (let cx = minWindowChunkX; cx <= maxWindowChunkX; cx++) {
      const chunkId = formatChunkId(cx, cy);
      retainWindowIds.add(chunkId);
      const isVisible = visibleSet.has(chunkId);
      const dx = cx - centerChunkX;
      const dy = cy - centerChunkY;
      const distanceSq = dx * dx + dy * dy * 1.35;
      // 前方对齐度：在运动前方的 Chunk 优先级更高（数值越小越优先）
      const forwardPriority = moveDir !== 0 && dx * moveDir > 0 ? -0.45 : 0;
      desiredCoords.push({
        chunkX: cx,
        chunkY: cy,
        chunkId,
        isVisible,
        distanceSq,
        forwardPriority,
      });
    }
  }

  // 排序规则：1) 当前屏幕可见优先 -> 2) 运动前方加权距离由近到远 -> 3) chunkId 字典序稳定决胜
  desiredCoords.sort((a, b) => {
    if (a.isVisible !== b.isVisible) return a.isVisible ? -1 : 1;
    const scoreA = a.distanceSq + a.forwardPriority;
    const scoreB = b.distanceSq + b.forwardPriority;
    if (Math.abs(scoreA - scoreB) > 1e-6) return scoreA - scoreB;
    return a.chunkId.localeCompare(b.chunkId);
  });

  // Active 窗口严格受 maxActiveChunks (10) 上限约束
  const activeCandidateIds = new Set<string>();
  for (let i = 0; i < Math.min(maxActiveChunks, desiredCoords.length); i++) {
    activeCandidateIds.add(desiredCoords[i].chunkId);
  }

  return {
    visibleRange,
    minWindowChunkX,
    maxWindowChunkX,
    minWindowChunkY,
    maxWindowChunkY,
    preloadLeft,
    preloadRight,
    verticalBufferRows,
    desiredCoords,
    activeCandidateIds,
    retainWindowIds,
  };
}

/**
 * 单个 Chunk 在生命周期管理器中的状态记录
 */
export interface ChunkLifecycleRecord {
  chunkX: number;
  chunkY: number;
  chunkId: string;
  state: ChunkLifecycleState;
  stateHistory: ChunkLifecycleState[];
  data: GeneratedChunkData | null;
  activeTaskId: number | null;
  lastTouchedTick: number;
  generationDurationMs: number;
}

/**
 * 强制校验并执行 Chunk 状态迁移
 */
export function transitionChunkState(
  record: ChunkLifecycleRecord,
  nextState: ChunkLifecycleState
): void {
  if (!isValidChunkStateTransition(record.state, nextState)) {
    throw new Error(
      `Invalid ChunkLifecycleState transition for ${record.chunkId}: ${record.state} -> ${nextState}`
    );
  }
  record.state = nextState;
  record.stateHistory.push(nextState);
  if (record.stateHistory.length > 16) {
    record.stateHistory.shift();
  }
}

/**
 * 规范第 12 节：5 级性能降级顺序
 */
export type PerformanceDegradationLevel =
  | 'distant_particles'
  | 'distant_decorations'
  | 'background_animations'
  | 'distant_noncritical_fauna'
  | 'distant_task_priority';

export const PERFORMANCE_DEGRADATION_ORDER: ReadonlyArray<PerformanceDegradationLevel> = [
  'distant_particles',
  'distant_decorations',
  'background_animations',
  'distant_noncritical_fauna',
  'distant_task_priority',
];

/**
 * 规范第 12 节：性能预算与 5 级优雅降级控制器
 * 严禁优先降级：当前视野地形与碰撞、玩家附近关键 POI、Chunk 管理器稳定性
 */
export class PerformanceDegradationController {
  private readonly budgetMs: number;
  private activeDegradationStep = 0; // 0 .. 5
  private lastFrameGenMs = 0;

  constructor(budgetMs: number = WorldConfig.performance.generationBudgetMsPerFrame) {
    this.budgetMs = Math.max(0.1, budgetMs);
  }

  public recordFrameGenerationTime(elapsedMs: number): void {
    this.lastFrameGenMs = Math.max(0, elapsedMs);
    if (elapsedMs > this.budgetMs) {
      const overshootRatio = elapsedMs / this.budgetMs;
      const stepsToIncrease = overshootRatio >= 2.5 ? 2 : 1;
      this.activeDegradationStep = Math.min(
        PERFORMANCE_DEGRADATION_ORDER.length,
        this.activeDegradationStep + stepsToIncrease
      );
    } else if (elapsedMs < this.budgetMs * 0.6 && this.activeDegradationStep > 0) {
      this.activeDegradationStep = Math.max(0, this.activeDegradationStep - 1);
    }
  }

  public setDegradationStepForTest(step: number): void {
    this.activeDegradationStep = Math.max(
      0,
      Math.min(PERFORMANCE_DEGRADATION_ORDER.length, Math.floor(step))
    );
  }

  public getActiveDegradations(): ReadonlyArray<PerformanceDegradationLevel> {
    return PERFORMANCE_DEGRADATION_ORDER.slice(0, this.activeDegradationStep);
  }

  public isDegraded(level: PerformanceDegradationLevel): boolean {
    const idx = PERFORMANCE_DEGRADATION_ORDER.indexOf(level);
    return idx >= 0 && idx < this.activeDegradationStep;
  }

  /**
   * 规范第 12 节硬性红线：绝不允许降级当前视野地形碰撞、附近关键 POI 或 Chunk 管理器稳定性
   */
  public canDegradeCriticalSystem(
    system: 'current_view_terrain_collision' | 'nearby_critical_poi' | 'chunk_manager_stability'
  ): boolean {
    void system;
    return false;
  }

  public getLastFrameGenerationMs(): number {
    return this.lastFrameGenMs;
  }
}

export const performanceDegradationController = new PerformanceDegradationController(
  WorldConfig.performance.generationBudgetMsPerFrame
);

// ============================================================================
// 阶段 G（前置声明供阶段 E/F 联动）：增量世界存档 (WorldPersistence, 规范第 12、13 节)
// ============================================================================

export type PersistedPOIStateType = 'unvisited' | 'discovered' | 'interacted' | 'depleted';

export interface PersistedPOIEntry {
  state: PersistedPOIStateType;
  remainingCooldown?: number;
  rewardClaimed?: boolean;
  updatedAt: number;
}

export interface PersistedObjectEntry {
  removed?: boolean;
  triggered?: boolean;
  customState?: string;
  updatedAt: number;
}

/**
 * 规范第 12 节：WorldSaveData 存档结构
 * 只存增量状态，严禁把整张地图的静态生成对象全部写入存档
 */
export interface WorldSaveData {
  worldSeed: string | number;
  generatorVersion: number;
  playerPosition: { worldX: number; worldY: number };
  discoveredBiomes: BiomeId[];
  modifiedPOIs: Record<string, PersistedPOIEntry>;
  modifiedObjects: Record<string, PersistedObjectEntry>;
  compatibility?: {
    migratedFromVersion?: number;
    unmatchedPOIIds?: string[];
  };
}

export class WorldPersistence {
  private readonly config: WorldConfigType;
  private playerPosition: { worldX: number; worldY: number } = { worldX: 0, worldY: 1200 };
  private discoveredBiomes: Set<BiomeId> = new Set();
  private modifiedPOIs: Map<string, PersistedPOIEntry> = new Map();
  private modifiedObjects: Map<string, PersistedObjectEntry> = new Map();
  private compatibilityInfo: { migratedFromVersion?: number; unmatchedPOIIds: string[] } = {
    unmatchedPOIIds: [],
  };

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public setPlayerPosition(worldX: number, worldY: number): void {
    this.playerPosition = {
      worldX: Number.isFinite(worldX) ? worldX : 0,
      worldY: clampWorldDepth(Number.isFinite(worldY) ? worldY : 0, this.config),
    };
  }

  public recordDiscoveredBiome(biomeId: BiomeId): void {
    this.discoveredBiomes.add(biomeId);
  }

  public setPOIState(
    poiId: string,
    state: PersistedPOIStateType,
    extra?: { remainingCooldown?: number; rewardClaimed?: boolean; updatedAt?: number }
  ): void {
    this.modifiedPOIs.set(poiId, {
      state,
      remainingCooldown: extra?.remainingCooldown,
      rewardClaimed: extra?.rewardClaimed ?? (state === 'interacted' || state === 'depleted'),
      updatedAt: extra?.updatedAt ?? Date.now(),
    });
  }

  public getPOIState(poiId: string): PersistedPOIEntry | undefined {
    return this.modifiedPOIs.get(poiId);
  }

  public setObjectState(
    objectId: string,
    entry: { removed?: boolean; triggered?: boolean; customState?: string; updatedAt?: number }
  ): void {
    this.modifiedObjects.set(objectId, {
      removed: entry.removed,
      triggered: entry.triggered,
      customState: entry.customState,
      updatedAt: entry.updatedAt ?? Date.now(),
    });
  }

  public getObjectState(objectId: string): PersistedObjectEntry | undefined {
    return this.modifiedObjects.get(objectId);
  }

  /**
   * 将增量存档状态叠加到确定性生成的 Chunk 纯数据上：
   * - 未修改的静态对象100%保持由 Seed 生成的原状
   * - 已修改的 POI 恢复其 discovered / interacted / depleted 状态
   * - 已移除的动态交互物自动过滤
   */
  public applyToGeneratedChunk(chunk: GeneratedChunkData): GeneratedChunkData {
    this.discoveredBiomes.add(chunk.biomeSample.primaryBiome);

    // 零分配快速路径：当玩家尚未修改任何 POI 或静态交互对象（或当前 Chunk 内无任何被修改项）时，
    // 直接复用确定性生成的 Chunk 对象，避免 60FPS 缓存命中时频繁克隆数组产生 GC 垃圾！
    if (this.modifiedPOIs.size === 0 && this.modifiedObjects.size === 0) {
      return chunk;
    }

    let hasTargetMod = false;
    if (this.modifiedPOIs.size > 0) {
      for (let i = 0; i < chunk.pois.length; i++) {
        if (this.modifiedPOIs.has(chunk.pois[i].id)) {
          hasTargetMod = true;
          break;
        }
      }
      if (!hasTargetMod) {
        for (let i = 0; i < chunk.overlappingPOIs.length; i++) {
          if (this.modifiedPOIs.has(chunk.overlappingPOIs[i].id)) {
            hasTargetMod = true;
            break;
          }
        }
      }
    }
    if (!hasTargetMod && this.modifiedObjects.size > 0) {
      for (let i = 0; i < chunk.ecologyObjects.length; i++) {
        if (this.modifiedObjects.has(chunk.ecologyObjects[i].id)) {
          hasTargetMod = true;
          break;
        }
      }
      if (!hasTargetMod) {
        for (let i = 0; i < chunk.objects.length; i++) {
          if (this.modifiedObjects.has(chunk.objects[i].id)) {
            hasTargetMod = true;
            break;
          }
        }
      }
    }
    if (!hasTargetMod) {
      return chunk;
    }

    const applyPoi = (poi: POIData): POIData => {
      const mod = this.modifiedPOIs.get(poi.id);
      if (!mod) return poi;
      return {
        ...poi,
        poiState: mod.state,
        state: {
          ...(poi.state ?? {}),
          status: mod.state,
          discovered: mod.state !== 'unvisited',
          interacted: mod.state === 'interacted' || mod.state === 'depleted',
        },
      };
    };

    const updatedPois = chunk.pois.map(applyPoi);
    const updatedOverlappingPois = chunk.overlappingPOIs.map(applyPoi);

    const updatedEcologyObjects = chunk.ecologyObjects.filter((obj) => {
      const mod = this.modifiedObjects.get(obj.id);
      return !mod?.removed;
    });

    const updatedObjects = chunk.objects
      .filter((obj) => {
        const mod = this.modifiedObjects.get(obj.id);
        return !mod?.removed;
      })
      .map((obj) => {
        const poiMod = this.modifiedPOIs.get(obj.id);
        if (!poiMod) return obj;
        return {
          ...obj,
          state: {
            ...(obj.state ?? {}),
            status: poiMod.state,
            discovered: poiMod.state !== 'unvisited',
            interacted: poiMod.state === 'interacted' || poiMod.state === 'depleted',
          },
        };
      });

    return {
      ...chunk,
      pois: updatedPois,
      overlappingPOIs: updatedOverlappingPois,
      ecologyObjects: updatedEcologyObjects,
      objects: updatedObjects,
    };
  }

  public save(): WorldSaveData {
    const modifiedPOIsObj: Record<string, PersistedPOIEntry> = {};
    for (const [k, v] of this.modifiedPOIs.entries()) {
      modifiedPOIsObj[k] = { ...v };
    }
    const modifiedObjectsObj: Record<string, PersistedObjectEntry> = {};
    for (const [k, v] of this.modifiedObjects.entries()) {
      modifiedObjectsObj[k] = { ...v };
    }
    return {
      worldSeed: this.config.worldSeed,
      generatorVersion: this.config.generatorVersion,
      playerPosition: { ...this.playerPosition },
      discoveredBiomes: Array.from(this.discoveredBiomes),
      modifiedPOIs: modifiedPOIsObj,
      modifiedObjects: modifiedObjectsObj,
      compatibility:
        this.compatibilityInfo.migratedFromVersion !== undefined ||
        this.compatibilityInfo.unmatchedPOIIds.length > 0
          ? {
              migratedFromVersion: this.compatibilityInfo.migratedFromVersion,
              unmatchedPOIIds: [...this.compatibilityInfo.unmatchedPOIIds],
            }
          : undefined,
    };
  }

  public load(data: WorldSaveData): void {
    this.modifiedPOIs.clear();
    this.modifiedObjects.clear();
    this.discoveredBiomes.clear();
    this.compatibilityInfo = { unmatchedPOIIds: [] };

    if (!data || typeof data !== 'object') return;

    if (data.generatorVersion !== this.config.generatorVersion) {
      this.compatibilityInfo.migratedFromVersion = data.generatorVersion;
    }

    if (data.playerPosition) {
      this.setPlayerPosition(data.playerPosition.worldX, data.playerPosition.worldY);
    }

    if (Array.isArray(data.discoveredBiomes)) {
      for (const b of data.discoveredBiomes) {
        if (BIOME_IDS.includes(b)) {
          this.discoveredBiomes.add(b);
        }
      }
    }

    if (data.modifiedPOIs && typeof data.modifiedPOIs === 'object') {
      for (const [poiId, entry] of Object.entries(data.modifiedPOIs)) {
        if (!entry || typeof entry !== 'object') continue;
        // 校验 POI ID 格式（支持 poi_ 前缀或 5 类标准 POI 类型前缀），若版本升级导致 ID 无法匹配则记录兼容降级日志而不崩溃
        const isKnownPoiId =
          poiId.startsWith('poi_') ||
          POI_TYPES.some((t) => poiId.startsWith(`${t}_`));
        if (!isKnownPoiId) {
          this.compatibilityInfo.unmatchedPOIIds.push(poiId);
          continue;
        }
        this.modifiedPOIs.set(poiId, {
          state: entry.state ?? 'unvisited',
          remainingCooldown: entry.remainingCooldown,
          rewardClaimed: entry.rewardClaimed,
          updatedAt: entry.updatedAt ?? Date.now(),
        });
      }
    }

    if (data.modifiedObjects && typeof data.modifiedObjects === 'object') {
      for (const [objId, entry] of Object.entries(data.modifiedObjects)) {
        if (!entry || typeof entry !== 'object') continue;
        this.modifiedObjects.set(objId, {
          removed: Boolean(entry.removed),
          triggered: Boolean(entry.triggered),
          customState: entry.customState,
          updatedAt: entry.updatedAt ?? Date.now(),
        });
      }
    }
  }

  public reset(): void {
    this.modifiedPOIs.clear();
    this.modifiedObjects.clear();
    this.discoveredBiomes.clear();
    this.compatibilityInfo = { unmatchedPOIIds: [] };
  }
}

export const worldPersistence = new WorldPersistence(WorldConfig);

// ============================================================================
// 阶段 F：资源注册、占位符回退与 1.0x 激活态渲染器 (WorldAssetRegistry & WorldRenderer, 规范第 11、13、14-F 节)
// ============================================================================

/**
 * 规范第 11 节：5 层视差系数定义
 * 地形海床、POI、生态交互物严格位于 world_main (1.0x)
 */
export const PARALLAX_LAYER_FACTORS = {
  far_silhouette: 0.08,
  mid_terrain: 0.18,
  sub_mid_shadow: 0.35,
  world_main: 1.0,
  foreground_particles: 1.12,
} as const;

export interface WorldAssetDescriptor {
  assetKey: string;
  category: 'flora' | 'fauna' | 'ambient' | 'poi' | 'terrain';
  primaryColor: string;
  secondaryColor: string;
  glowColor?: string;
  shape: 'kelp' | 'coral' | 'vent' | 'sponge' | 'rock' | 'shipwreck' | 'cave' | 'treasure' | 'nest' | 'landmark' | 'generic';
  isPlaceholder: boolean;
}

export const WORLD_ATLAS_ASSET_URLS = {
  seabedStrips: '/assets/aistudio/world_seabed_strips_1794473245165.jpg',
  poisAtlas: '/assets/aistudio/world_pois_atlas_1794473250443.jpg',
  ecologyAtlas: '/assets/aistudio/world_ecology_atlas_1794473252524.jpg',
} as const;

/**
 * 离屏 BFS 连通域纯白背景抠图 + 抗锯齿白边解混 + 紧致包围盒裁切
 */
function sliceAndCleanWorldSpriteRegion(
  sourceImg: HTMLImageElement,
  normRect: readonly [number, number, number, number],
  cleanInteriorHoles: boolean = true,
  maxTargetDim: number = 360
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const [nx0, ny0, nx1, ny1] = normRect;
  const sx = Math.max(0, Math.floor(nx0 * natW));
  const sy = Math.max(0, Math.floor(ny0 * natH));
  const sw = Math.max(1, Math.min(natW - sx, Math.ceil((nx1 - nx0) * natW)));
  const sh = Math.max(1, Math.min(natH - sy, Math.ceil((ny1 - ny0) * natH)));

  const scale = Math.min(1, maxTargetDim / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * scale));
  const h = Math.max(8, Math.round(sh * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBgWhite = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= 224 && maxC - minC <= 26;
  };

  const enqueueIfBg = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    if (isBgWhite(idx)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    enqueueIfBg(x, 0);
    enqueueIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueueIfBg(0, y);
    enqueueIfBg(w - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    data[curr * 4 + 3] = 0;
    const cx = curr % w;
    const cy = (curr - cx) / w;
    if (cx > 0) enqueueIfBg(cx - 1, cy);
    if (cx < w - 1) enqueueIfBg(cx + 1, cy);
    if (cy > 0) enqueueIfBg(cx, cy - 1);
    if (cy < h - 1) enqueueIfBg(cx, cy + 1);
  }

  // 清理物体镂空处的纯白封闭背景孔洞（如铁锚链环、船舵辐条、珊瑚枝隙）
  if (cleanInteriorHoles) {
    for (let idx = 0; idx < total; idx++) {
      if (visited[idx]) continue;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC >= 242 && maxC - minC <= 14) {
        data[p + 3] = 0;
        visited[idx] = 1;
      }
    }
  }

  // 对紧邻透明背景的 2 层抗锯齿边缘执行 Color-to-Alpha 白边解混
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        if (data[p + 3] === 0) continue;
        const hasTransNeighbor =
          data[(idx - 1) * 4 + 3] === 0 ||
          data[(idx + 1) * 4 + 3] === 0 ||
          data[(idx - w) * 4 + 3] === 0 ||
          data[(idx + w) * 4 + 3] === 0;
        if (!hasTransNeighbor) continue;

        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);
        if (minC > 175) {
          const cleanAlpha = Math.max(0, Math.min(1, (248 - minC) / 145));
          const denom = Math.max(0.08, cleanAlpha);
          data[p] = Math.max(0, Math.min(255, Math.round((r - (1 - cleanAlpha) * 255) / denom)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - cleanAlpha) * 255) / denom)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - cleanAlpha) * 255) / denom)));
          data[p + 3] = Math.round(data[p + 3] * cleanAlpha);
        }
      }
    }
  }

  // 计算紧致包围盒
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    workCanvas.width = 0;
    workCanvas.height = 0;
    return null;
  }
  ctx.putImageData(imgData, 0, 0);

  const pad = 2;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return workCanvas;
  outCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  // 立即将临时工作 Canvas 尺寸清零，通知浏览器 GPU / 显存立即释放临时帧缓冲
  workCanvas.width = 0;
  workCanvas.height = 0;
  return outCanvas;
}

/**
 * 裁切单条海床表层岩壳纹理、抠除上下白底、执行逐列平滑基线对齐（消除原图自带的大幅波谷透底与波峰下方死黑空洞）、
 * 底部余弦柔化羽化并制作 14% 余弦水平无缝循环条带
 */
function sliceAndMakeSeamlessSeabedStrip(
  sourceImg: HTMLImageElement,
  y0Norm: number,
  y1Norm: number
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const sx = Math.floor(natW * 0.028);
  const sw = Math.floor(natW * 0.944);
  const sy = Math.floor(natH * y0Norm);
  const sh = Math.max(1, Math.floor(natH * (y1Norm - y0Norm)));

  const w = 720;
  const h = 160;
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. 逐列抠除顶部与底部纯白留白并记录每列顶部首个非透明像素高度 rawTopY[x]
  const rawTopY = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let topFound = Math.floor(h * 0.35);
    for (let y = 0; y < h; y++) {
      const p = (y * w + x) * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC >= 225 && maxC - minC <= 26) {
        data[p + 3] = 0;
      } else {
        if (minC > 180) {
          const cleanAlpha = Math.max(0.15, Math.min(1, (245 - minC) / 110));
          data[p + 3] = Math.round(255 * cleanAlpha);
        }
        topFound = y;
        break;
      }
    }
    rawTopY[x] = topFound;

    for (let y = h - 1; y >= 0; y--) {
      const p = (y * w + x) * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC >= 225 && maxC - minC <= 26) {
        data[p + 3] = 0;
      } else {
        break;
      }
    }
  }

  // 2. 计算水平大尺度平滑基线 smoothTopY[x]（窗口半径 32px），将原图自带的巨幅波浪拉直对齐，
  //    同时 100% 保留珊瑚枝尖、贝壳与岩角的局部自然起伏轮廓！
  const smoothTopY = new Float32Array(w);
  const smoothRadius = 32;
  let minSmoothTop = h;
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
      const nx = ((x + dx) % w + w) % w;
      sum += rawTopY[nx];
      count++;
    }
    const avg = sum / count;
    smoothTopY[x] = avg;
    if (avg < minSmoothTop) minSmoothTop = avg;
  }

  // 裁切掉底部悬挑黑洞区域，仅保留饱满的表层珊瑚/沙滩/受光砂岩唇口（coral_reef 取 104px，其余取 116px）
  const isCoralStrip = y0Norm < 0.12;
  const cropH = isCoralStrip ? 104 : 116;
  const alignedData = new Uint8ClampedArray(w * cropH * 4);

  for (let x = 0; x < w; x++) {
    const colShift = Math.round((smoothTopY[x] - minSmoothTop) * 0.88);
    const baseSrcY = Math.max(0, Math.floor(minSmoothTop) - 2 + colShift);
    for (let y = 0; y < cropH; y++) {
      const syCol = Math.min(h - 1, baseSrcY + y);
      const srcIdx = (syCol * w + x) * 4;
      const dstIdx = (y * w + x) * 4;
      alignedData[dstIdx] = data[srcIdx];
      alignedData[dstIdx + 1] = data[srcIdx + 1];
      alignedData[dstIdx + 2] = data[srcIdx + 2];
      alignedData[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  // 3. 14% 余弦水平无缝混合 + 底部 34% 余弦 Alpha 柔化羽化 + 下半部暗穴消融
  const overlap = Math.max(16, Math.floor(w * 0.14));
  const outW = w - overlap;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return work;

  const outImg = outCtx.createImageData(outW, cropH);
  const oData = outImg.data;
  const bottomFeatherStart = Math.floor(cropH * 0.64);
  const shadowDissolveStart = Math.floor(cropH * 0.50);

  for (let y = 0; y < cropH; y++) {
    let bottomFade = 1.0;
    if (y >= bottomFeatherStart) {
      const ft = (y - bottomFeatherStart) / Math.max(1, cropH - 1 - bottomFeatherStart);
      bottomFade = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, ft)));
    }
    const shadowCheckWeight =
      y >= shadowDissolveStart
        ? Math.min(1, (y - shadowDissolveStart) / Math.max(1, cropH * 0.28))
        : 0;

    for (let x = 0; x < outW; x++) {
      const dstIdx = (y * outW + x) * 4;
      let r: number;
      let g: number;
      let b: number;
      let a: number;
      if (x < overlap) {
        const t = x / overlap;
        const wA = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const wB = 1 - wA;
        const idxA = (y * w + x) * 4;
        const idxB = (y * w + (x + outW)) * 4;
        r = Math.round(alignedData[idxA] * wA + alignedData[idxB] * wB);
        g = Math.round(alignedData[idxA + 1] * wA + alignedData[idxB + 1] * wB);
        b = Math.round(alignedData[idxA + 2] * wA + alignedData[idxB + 2] * wB);
        a = alignedData[idxA + 3] * wA + alignedData[idxB + 3] * wB;
      } else {
        const idxA = (y * w + x) * 4;
        r = alignedData[idxA];
        g = alignedData[idxA + 1];
        b = alignedData[idxA + 2];
        a = alignedData[idxA + 3];
      }

      // 将表层底部残余深暗阴影像素柔化提亮为暖褐砂岩色并渐隐，彻底杜绝黑色空洞
      let shadowFade = 1.0;
      if (shadowCheckWeight > 0 && isCoralStrip) {
        const luma = r * 0.299 + g * 0.587 + b * 0.114;
        if (luma < 92) {
          const lift = (92 - luma) * 0.55 * shadowCheckWeight;
          r = Math.min(255, Math.round(r + lift * 1.35));
          g = Math.min(255, Math.round(g + lift * 0.82));
          b = Math.min(255, Math.round(b + lift * 0.45));
          const rawShadowAlpha = Math.pow(Math.max(0, (luma - 18) / 74), 1.35);
          shadowFade = 1 - shadowCheckWeight * (1 - rawShadowAlpha);
        }
      }

      oData[dstIdx] = r;
      oData[dstIdx + 1] = g;
      oData[dstIdx + 2] = b;
      oData[dstIdx + 3] = Math.round(a * bottomFade * shadowFade);
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  work.width = 0;
  work.height = 0;
  return outCanvas;
}

/**
 * 构建海床「表层以下」专属无缝层状岩壁与基岩断面条带 (`subsurfaceStratumCanvases`)：
 * 1) 采用 Strip 2 中下部最均匀饱满的手绘阶梯状沉积岩板 (0.348..0.478) 作为全宽度无空洞基底（避免 Strip 1 拱形黑洞阴影导致局部发黑空洞）；
 * 2) 针对各生态区融合双相位交错阶梯岩层与纵向断层裂隙/发光青脉/火山熔岩纹路，并精确校准为暖金赭石砂岩、大陆架青灰页岩、深海峡谷靛蓝青脉岩与极深渊熔岩黑曜石；
 * 3) 水平方向做 14% 余弦无缝循环，垂直方向在顶部 20% 与底部 24% 做余弦羽化融合，使多层地下岩层纵向无限叠铺时完全无缝连接！
 */
function sliceAndMakeSubsurfaceBedrockStrip(
  sourceImg: HTMLImageElement,
  biomeMode: 'coral_reef' | 'rocky_shelf' | 'underwater_canyon' | 'deep_abyss'
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const sx = Math.floor(natW * 0.028);
  const sw = Math.floor(natW * 0.944);
  const w = 720;
  const h = 168;

  // 提取 Strip 2 中下部最丰富的纯手绘阶梯状岩石层理 (yNorm = 0.350 .. 0.476，全宽度均匀饱满、零黑洞阴影)
  const strataWork = document.createElement('canvas');
  strataWork.width = w;
  strataWork.height = h;
  const strataCtx = strataWork.getContext('2d', { willReadFrequently: true });
  if (!strataCtx) return null;
  strataCtx.drawImage(
    sourceImg,
    sx,
    Math.floor(natH * 0.350),
    sw,
    Math.max(1, Math.floor(natH * (0.476 - 0.350))),
    0,
    0,
    w,
    h
  );
  const strataData = strataCtx.getImageData(0, 0, w, h).data;

  // 提取目标生态区对应的纵向裂隙岩壁区域（coral_reef 采用 Strip 3 的高对比度纵向断层岩壁 0.60..0.72 重着色为暖砂岩，彻底避开 Strip 1 的拱形黑影！）
  let biomeY0 = 0.600;
  let biomeY1 = 0.722;
  if (biomeMode === 'rocky_shelf') {
    biomeY0 = 0.355;
    biomeY1 = 0.482;
  } else if (biomeMode === 'underwater_canyon') {
    biomeY0 = 0.588;
    biomeY1 = 0.726;
  } else if (biomeMode === 'deep_abyss') {
    biomeY0 = 0.828;
    biomeY1 = 0.978;
  }

  const cliffWork = document.createElement('canvas');
  cliffWork.width = w;
  cliffWork.height = h;
  const cliffCtx = cliffWork.getContext('2d', { willReadFrequently: true });
  if (!cliffCtx) {
    strataWork.width = 0;
    strataWork.height = 0;
    return null;
  }
  cliffCtx.drawImage(
    sourceImg,
    sx,
    Math.floor(natH * biomeY0),
    sw,
    Math.max(1, Math.floor(natH * (biomeY1 - biomeY0))),
    0,
    0,
    w,
    h
  );
  const cliffData = cliffCtx.getImageData(0, 0, w, h).data;

  // 合成并校准表层以下岩石层理像素（双相位交错阶梯岩层 + 纵向断层裂隙）
  const combined = new Uint8ClampedArray(w * h * 4);
  const strataShiftA = Math.floor(w * 0.29);
  const strataShiftB = Math.floor(w * 0.67);

  for (let y = 0; y < h; y++) {
    const vNorm = y / Math.max(1, h - 1);
    const yFlip = h - 1 - y;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const sxA = (x + strataShiftA) % w;
      const sxB = (w - 1 - ((x + strataShiftB) % w));
      const psA = (y * w + sxA) * 4;
      const psB = (yFlip * w + sxB) * 4;

      // 主阶梯岩板明度与副阶梯岩板明度
      const lumaA =
        (strataData[psA] * 0.299 + strataData[psA + 1] * 0.587 + strataData[psA + 2] * 0.114) / 255;
      const lumaB =
        (strataData[psB] * 0.299 + strataData[psB + 1] * 0.587 + strataData[psB + 2] * 0.114) / 255;

      // 提亮暗部死黑并拉开岩块受光面与裂缝的立体对比度
      const liftedA = Math.pow(Math.max(0.10, Math.min(1, lumaA)), 0.72);
      const liftedB = Math.pow(Math.max(0.10, Math.min(1, lumaB)), 0.78);
      const compositeStrata = liftedA * 0.68 + liftedB * 0.32;

      const cr = cliffData[p];
      const cg = cliffData[p + 1];
      const cb = cliffData[p + 2];
      const cliffLuma = (cr * 0.299 + cg * 0.587 + cb * 0.114) / 255;

      let outR = cr;
      let outG = cg;
      let outB = cb;

      if (biomeMode === 'coral_reef') {
        // 将 Strip 2 的双交错阶梯岩板与 Strip 3 的纵向岩柱断层统一重映射为温暖明亮的阳光赭石砂岩/礁灰岩色阶 (#df9148 -> #9e5b28 -> #542d14)
        const rockFacet = compositeStrata * 0.74 + Math.pow(Math.max(0.12, cliffLuma), 0.75) * 0.26;
        // 增强岩石块面高光与岩缝深褐对比（S 曲线对比度增强）
        const contrasted = Math.max(0, Math.min(1, 0.5 + (rockFacet - 0.46) * 1.38));

        outR = Math.round(58 + contrasted * 168);
        outG = Math.round(34 + contrasted * 104);
        outB = Math.round(18 + contrasted * 54);
      } else if (biomeMode === 'rocky_shelf') {
        // 大陆架层状青灰岩板：强化岩层台阶高光与深缝立体感
        const slateR = 26 + compositeStrata * 104;
        const slateG = 36 + compositeStrata * 128;
        const slateB = 48 + compositeStrata * 144;
        outR = Math.round(cr * 0.48 + slateR * 0.52);
        outG = Math.round(cg * 0.48 + slateG * 0.52);
        outB = Math.round(cb * 0.48 + slateB * 0.52);
      } else if (biomeMode === 'underwater_canyon') {
        // 深海峡谷：保留青色发光矿脉 (cb > cr * 1.4 && cg > cr * 1.3)，同时注入阶梯状深蓝岩层体块
        const isCyanVein = cb > 95 && cg > 80 && cb > cr * 1.35;
        const canyonStrataR = 18 + compositeStrata * 58;
        const canyonStrataG = 26 + compositeStrata * 82;
        const canyonStrataB = 48 + compositeStrata * 124;
        const blendStrata = isCyanVein ? 0.15 : 0.46;
        outR = Math.round(cr * (1 - blendStrata) + canyonStrataR * blendStrata);
        outG = Math.round(cg * (1 - blendStrata) + canyonStrataG * blendStrata);
        outB = Math.round(cb * (1 - blendStrata) + canyonStrataB * blendStrata);
      } else {
        // 极深渊火山玄武岩：保留橙红熔岩裂隙 (cr > cg * 1.45 && cr > 70)，同时提亮死黑玄武岩块面并叠加层状黑曜石岩架
        const isMagmaVein = cr > 68 && cr > cg * 1.4 && cr > cb * 1.6;
        const basaltStrataR = 24 + compositeStrata * 74;
        const basaltStrataG = 20 + compositeStrata * 56;
        const basaltStrataB = 20 + compositeStrata * 52;
        const blendStrata = isMagmaVein ? 0.14 : 0.50;
        outR = Math.round(cr * (1 - blendStrata) + basaltStrataR * blendStrata);
        outG = Math.round(cg * (1 - blendStrata) + basaltStrataG * blendStrata);
        outB = Math.round(cb * (1 - blendStrata) + basaltStrataB * blendStrata);
      }

      // 注入自然的横向沉积岩层分界暗缝与受光岩檐（在 vNorm ≈ 0.36 与 0.68 处），增强多层地质断面真实感
      const wave1 = 0.36 + 0.035 * Math.sin((x / w) * Math.PI * 4 + 0.7);
      const wave2 = 0.68 + 0.035 * Math.cos((x / w) * Math.PI * 6 - 0.4);
      const d1 = Math.abs(vNorm - wave1);
      const d2 = Math.abs(vNorm - wave2);
      if (d1 < 0.045) {
        const seamFactor = vNorm < wave1 ? 0.74 + 0.26 * (d1 / 0.045) : 1.12 - 0.12 * (d1 / 0.045);
        outR = Math.round(outR * seamFactor);
        outG = Math.round(outG * seamFactor);
        outB = Math.round(outB * seamFactor);
      } else if (d2 < 0.045) {
        const seamFactor = vNorm < wave2 ? 0.76 + 0.24 * (d2 / 0.045) : 1.10 - 0.10 * (d2 / 0.045);
        outR = Math.round(outR * seamFactor);
        outG = Math.round(outG * seamFactor);
        outB = Math.round(outB * seamFactor);
      }

      combined[p] = Math.max(0, Math.min(255, outR));
      combined[p + 1] = Math.max(0, Math.min(255, outG));
      combined[p + 2] = Math.max(0, Math.min(255, outB));
      combined[p + 3] = 255;
    }
  }

  // 14% 余弦水平无缝混合 + 顶部 20% 与底部 24% 余弦 Alpha 柔化羽化
  const overlap = Math.max(16, Math.floor(w * 0.14));
  const outW = w - overlap;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) {
    strataWork.width = 0;
    strataWork.height = 0;
    cliffWork.width = 0;
    cliffWork.height = 0;
    return null;
  }

  const outImg = outCtx.createImageData(outW, h);
  const oData = outImg.data;
  const topFeatherEnd = Math.floor(h * 0.20);
  const bottomFeatherStart = Math.floor(h * 0.76);

  for (let y = 0; y < h; y++) {
    let vAlpha = 1.0;
    if (y < topFeatherEnd) {
      const ft = y / Math.max(1, topFeatherEnd);
      vAlpha = 0.5 * (1 - Math.cos(Math.PI * ft));
    } else if (y >= bottomFeatherStart) {
      const ft = (y - bottomFeatherStart) / Math.max(1, h - 1 - bottomFeatherStart);
      vAlpha = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, ft)));
    }

    for (let x = 0; x < outW; x++) {
      const dstIdx = (y * outW + x) * 4;
      if (x < overlap) {
        const t = x / overlap;
        const wA = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const wB = 1 - wA;
        const idxA = (y * w + x) * 4;
        const idxB = (y * w + (x + outW)) * 4;
        oData[dstIdx] = Math.round(combined[idxA] * wA + combined[idxB] * wB);
        oData[dstIdx + 1] = Math.round(combined[idxA + 1] * wA + combined[idxB + 1] * wB);
        oData[dstIdx + 2] = Math.round(combined[idxA + 2] * wA + combined[idxB + 2] * wB);
        oData[dstIdx + 3] = Math.round(255 * vAlpha);
      } else {
        const idxA = (y * w + x) * 4;
        oData[dstIdx] = combined[idxA];
        oData[dstIdx + 1] = combined[idxA + 1];
        oData[dstIdx + 2] = combined[idxA + 2];
        oData[dstIdx + 3] = Math.round(255 * vAlpha);
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  strataWork.width = 0;
  strataWork.height = 0;
  cliffWork.width = 0;
  cliffWork.height = 0;
  return outCanvas;
}

/**
 * 规范第 11 / 14-F 节：资源映射表、AI 图集离屏切图缓存与缺失占位符回退（缺资源时不崩溃）
 */
export class WorldAssetRegistry {
  private readonly registry: Map<string, WorldAssetDescriptor> = new Map();
  private readonly spriteCanvases: Map<string, HTMLCanvasElement> = new Map();
  private readonly seabedStripCanvases: Map<BiomeId, HTMLCanvasElement> = new Map();
  private readonly seabedSubStratumCanvases: Map<BiomeId, HTMLCanvasElement> = new Map();
  private placeholderFallbackCount = 0;
  private atlasesLoadingTriggered = false;

  constructor() {
    this.registerDefaultAssets();
  }

  private registerDefaultAssets(): void {
    const defaults: WorldAssetDescriptor[] = [
      // ECOLOGY_OBJECT_CONFIGS 标准 assetKey
      { assetKey: 'eco_coral_cluster', category: 'flora', primaryColor: '#f43f5e', secondaryColor: '#fb923c', glowColor: '#fda4af', shape: 'coral', isPlaceholder: false },
      { assetKey: 'eco_seabed_rock', category: 'terrain', primaryColor: '#334155', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'eco_seagrass_bed', category: 'flora', primaryColor: '#10b981', secondaryColor: '#047857', shape: 'kelp', isPlaceholder: false },
      { assetKey: 'eco_fish_school_spawner', category: 'fauna', primaryColor: '#38bdf8', secondaryColor: '#bae6fd', shape: 'generic', isPlaceholder: false },
      { assetKey: 'eco_jellyfish_bloom', category: 'fauna', primaryColor: '#c084fc', secondaryColor: '#e9d5ff', glowColor: '#d8b4fe', shape: 'generic', isPlaceholder: false },
      { assetKey: 'eco_biolum_organism', category: 'fauna', primaryColor: '#ec4899', secondaryColor: '#67e8f9', glowColor: '#22d3ee', shape: 'coral', isPlaceholder: false },
      { assetKey: 'eco_shipwreck_debris', category: 'terrain', primaryColor: '#78350f', secondaryColor: '#b45309', shape: 'rock', isPlaceholder: false },
      { assetKey: 'eco_bubble_stream', category: 'ambient', primaryColor: '#475569', secondaryColor: '#38bdf8', glowColor: '#7dd3fc', shape: 'vent', isPlaceholder: false },
      { assetKey: 'eco_plankton_mote', category: 'ambient', primaryColor: '#fde047', secondaryColor: '#fef08a', glowColor: '#fde047', shape: 'generic', isPlaceholder: false },
      { assetKey: 'eco_marine_snow', category: 'ambient', primaryColor: '#cbd5e1', secondaryColor: '#f1f5f9', shape: 'generic', isPlaceholder: false },

      // POI_CONFIGS 标准 assetKey
      { assetKey: 'poi_shipwreck_hull', category: 'poi', primaryColor: '#92400e', secondaryColor: '#f59e0b', glowColor: '#fde047', shape: 'shipwreck', isPlaceholder: false },
      { assetKey: 'poi_abyssal_cave_arch', category: 'poi', primaryColor: '#1e293b', secondaryColor: '#38bdf8', glowColor: '#7dd3fc', shape: 'cave', isPlaceholder: false },
      { assetKey: 'poi_sunken_treasure_chest', category: 'poi', primaryColor: '#eab308', secondaryColor: '#fef08a', glowColor: '#fde047', shape: 'treasure', isPlaceholder: false },
      { assetKey: 'poi_rare_creature_nest', category: 'poi', primaryColor: '#a855f7', secondaryColor: '#e9d5ff', glowColor: '#c084fc', shape: 'nest', isPlaceholder: false },
      { assetKey: 'poi_ancient_ocean_monolith', category: 'poi', primaryColor: '#06b6d4', secondaryColor: '#67e8f9', glowColor: '#22d3ee', shape: 'landmark', isPlaceholder: false },

      // 海床表层岩壳纹理 assetKey
      { assetKey: 'seabed_strip_coral_reef', category: 'terrain', primaryColor: '#f59e0b', secondaryColor: '#f43f5e', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_rocky_shelf', category: 'terrain', primaryColor: '#475569', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_open_ocean', category: 'terrain', primaryColor: '#475569', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_underwater_canyon', category: 'terrain', primaryColor: '#1e293b', secondaryColor: '#22d3ee', glowColor: '#38bdf8', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_deep_abyss', category: 'terrain', primaryColor: '#0f172a', secondaryColor: '#f97316', glowColor: '#fb923c', shape: 'rock', isPlaceholder: false },

      // 兼容别名与阶段 F 单测默认键
      { assetKey: 'flora_kelp_patch', category: 'flora', primaryColor: '#10b981', secondaryColor: '#047857', shape: 'kelp', isPlaceholder: false },
      { assetKey: 'flora_coral_cluster', category: 'flora', primaryColor: '#f43f5e', secondaryColor: '#fb923c', glowColor: '#fda4af', shape: 'coral', isPlaceholder: false },
      { assetKey: 'flora_sea_anemone', category: 'flora', primaryColor: '#ec4899', secondaryColor: '#f472b6', glowColor: '#f9a8d4', shape: 'coral', isPlaceholder: false },
      { assetKey: 'flora_sponge_colony', category: 'flora', primaryColor: '#eab308', secondaryColor: '#ca8a04', shape: 'sponge', isPlaceholder: false },
      { assetKey: 'flora_tube_worm_patch', category: 'flora', primaryColor: '#ef4444', secondaryColor: '#fca5a5', glowColor: '#f87171', shape: 'vent', isPlaceholder: false },
      { assetKey: 'ambient_hydrothermal_vent', category: 'ambient', primaryColor: '#475569', secondaryColor: '#f97316', glowColor: '#fb923c', shape: 'vent', isPlaceholder: false },
      { assetKey: 'ambient_rock_outcrop', category: 'ambient', primaryColor: '#334155', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'ambient_sunken_debris', category: 'ambient', primaryColor: '#78350f', secondaryColor: '#b45309', shape: 'rock', isPlaceholder: false },
      { assetKey: 'ambient_bubble_emitter', category: 'ambient', primaryColor: '#7dd3fc', secondaryColor: '#e0f2fe', glowColor: '#38bdf8', shape: 'generic', isPlaceholder: false },
      { assetKey: 'poi_underwater_cave', category: 'poi', primaryColor: '#1e293b', secondaryColor: '#38bdf8', glowColor: '#7dd3fc', shape: 'cave', isPlaceholder: false },
      { assetKey: 'poi_sunken_treasure', category: 'poi', primaryColor: '#eab308', secondaryColor: '#fef08a', glowColor: '#fde047', shape: 'treasure', isPlaceholder: false },
      { assetKey: 'poi_abyssal_landmark', category: 'poi', primaryColor: '#06b6d4', secondaryColor: '#67e8f9', glowColor: '#22d3ee', shape: 'landmark', isPlaceholder: false },
    ];
    for (const item of defaults) {
      this.registry.set(item.assetKey, item);
    }
  }

  /**
   * 在浏览器环境下懒加载并自动裁切 3 张新背景美术图集：
   * 1) world_seabed_strips (4 条宏观生态海床表层岩壳 + 4 条表层以下无缝层状基岩纹理)
   * 2) world_pois_atlas (5x2 共 10 种大型地标 POI)
   * 3) world_ecology_atlas (4x4 共 16 种珊瑚/岩石/海藻/残骸/热液喷口)
   */
  public ensureAtlasesLoaded(): void {
    if (this.atlasesLoadingTriggered) return;
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
      return;
    }
    this.atlasesLoadingTriggered = true;

    // 1. 加载 4 条海床表层岩壳纹理合集 + 构建表层以下专属无缝层状基岩纹理
    const seabedImg = new Image();
    seabedImg.crossOrigin = 'anonymous';
    seabedImg.onload = () => {
      const stripCoral = sliceAndMakeSeamlessSeabedStrip(seabedImg, 0.01, 0.245);
      const stripRocky = sliceAndMakeSeamlessSeabedStrip(seabedImg, 0.255, 0.49);
      const stripCanyon = sliceAndMakeSeamlessSeabedStrip(seabedImg, 0.50, 0.735);
      const stripAbyss = sliceAndMakeSeamlessSeabedStrip(seabedImg, 0.745, 0.99);

      if (stripCoral) this.seabedStripCanvases.set('coral_reef', stripCoral);
      if (stripRocky) {
        this.seabedStripCanvases.set('rocky_shelf', stripRocky);
        this.seabedStripCanvases.set('open_ocean', stripRocky);
      }
      if (stripCanyon) this.seabedStripCanvases.set('underwater_canyon', stripCanyon);
      if (stripAbyss) this.seabedStripCanvases.set('deep_abyss', stripAbyss);

      const subCoral = sliceAndMakeSubsurfaceBedrockStrip(seabedImg, 'coral_reef');
      const subRocky = sliceAndMakeSubsurfaceBedrockStrip(seabedImg, 'rocky_shelf');
      const subCanyon = sliceAndMakeSubsurfaceBedrockStrip(seabedImg, 'underwater_canyon');
      const subAbyss = sliceAndMakeSubsurfaceBedrockStrip(seabedImg, 'deep_abyss');

      if (subCoral) this.seabedSubStratumCanvases.set('coral_reef', subCoral);
      if (subRocky) {
        this.seabedSubStratumCanvases.set('rocky_shelf', subRocky);
        this.seabedSubStratumCanvases.set('open_ocean', subRocky);
      }
      if (subCanyon) this.seabedSubStratumCanvases.set('underwater_canyon', subCanyon);
      if (subAbyss) this.seabedSubStratumCanvases.set('deep_abyss', subAbyss);
    };
    seabedImg.src = WORLD_ATLAS_ASSET_URLS.seabedStrips;

    // 2. 加载 5x2 大型地标 POI 图集
    const poiImg = new Image();
    poiImg.crossOrigin = 'anonymous';
    poiImg.onload = () => {
      const poiSlices: Array<{
        assetKey: string;
        variant: string;
        rect: readonly [number, number, number, number];
        cleanHoles: boolean;
      }> = [
        // Row 1 (Top)
        { assetKey: 'poi_shipwreck_hull', variant: 'sunken_frigate', rect: [0.005, 0.01, 0.268, 0.37], cleanHoles: true },
        { assetKey: 'poi_abyssal_cave_arch', variant: 'limestone_grotto', rect: [0.265, 0.04, 0.465, 0.375], cleanHoles: false },
        { assetKey: 'poi_sunken_treasure_chest', variant: 'galleon_gold_coffer', rect: [0.465, 0.08, 0.602, 0.375], cleanHoles: false },
        { assetKey: 'poi_rare_creature_nest', variant: 'apex_kraken_lair', rect: [0.602, 0.08, 0.782, 0.375], cleanHoles: false },
        { assetKey: 'poi_ancient_ocean_monolith', variant: 'leviathan_rib_arch', rect: [0.782, 0.06, 0.992, 0.375], cleanHoles: true },
        // Row 2 (Bottom)
        { assetKey: 'poi_shipwreck_hull', variant: 'rusted_research_sub', rect: [0.008, 0.66, 0.242, 0.985], cleanHoles: false },
        { assetKey: 'poi_abyssal_cave_arch', variant: 'basalt_canyon_cavern', rect: [0.245, 0.64, 0.455, 0.985], cleanHoles: false },
        { assetKey: 'poi_sunken_treasure_chest', variant: 'ancient_relic_vault', rect: [0.458, 0.69, 0.618, 0.985], cleanHoles: false },
        { assetKey: 'poi_rare_creature_nest', variant: 'biolume_leviathan_den', rect: [0.618, 0.68, 0.835, 0.985], cleanHoles: false },
        { assetKey: 'poi_ancient_ocean_monolith', variant: 'runic_trench_obelisk', rect: [0.835, 0.54, 0.988, 0.985], cleanHoles: false },
      ];

      for (const spec of poiSlices) {
        const canvas = sliceAndCleanWorldSpriteRegion(poiImg, spec.rect, spec.cleanHoles, 440);
        if (canvas) {
          this.spriteCanvases.set(`${spec.assetKey}:${spec.variant}`, canvas);
          if (!this.spriteCanvases.has(spec.assetKey)) {
            this.spriteCanvases.set(spec.assetKey, canvas);
          }
        }
      }
    };
    poiImg.src = WORLD_ATLAS_ASSET_URLS.poisAtlas;

    // 3. 加载 4x4 海床生态与环境装饰物图集
    const ecoImg = new Image();
    ecoImg.crossOrigin = 'anonymous';
    ecoImg.onload = () => {
      const gridCell = (col: number, row: number): readonly [number, number, number, number] => [
        col * 0.25 + 0.008,
        row * 0.25 + 0.008,
        (col + 1) * 0.25 - 0.008,
        (row + 1) * 0.25 - 0.008,
      ];

      const ecoSlices: Array<{
        assetKey: string;
        variants: readonly string[];
        col: number;
        row: number;
        cleanHoles: boolean;
      }> = [
        // Row 0: Corals
        { assetKey: 'eco_coral_cluster', variants: ['staghorn'], col: 0, row: 0, cleanHoles: true },
        { assetKey: 'eco_coral_cluster', variants: ['brain_coral'], col: 1, row: 0, cleanHoles: false },
        { assetKey: 'eco_coral_cluster', variants: ['fan_coral'], col: 2, row: 0, cleanHoles: true },
        { assetKey: 'eco_coral_cluster', variants: ['tube_sponge'], col: 3, row: 0, cleanHoles: false },
        // Row 1: Rocks & Thermal Chimney Vent
        { assetKey: 'eco_seabed_rock', variants: ['basalt_boulder'], col: 0, row: 1, cleanHoles: false },
        { assetKey: 'eco_seabed_rock', variants: ['mossy_slab'], col: 1, row: 1, cleanHoles: false },
        { assetKey: 'eco_seabed_rock', variants: ['jagged_spire'], col: 2, row: 1, cleanHoles: false },
        { assetKey: 'eco_bubble_stream', variants: ['thermal_micro_vent'], col: 3, row: 1, cleanHoles: true },
        // Row 2: Seagrass / Kelp & Cyan Fissure Vent
        { assetKey: 'eco_seagrass_bed', variants: ['meadow_tuft'], col: 0, row: 2, cleanHoles: true },
        { assetKey: 'eco_seagrass_bed', variants: ['ribbon_grass'], col: 1, row: 2, cleanHoles: true },
        { assetKey: 'eco_seagrass_bed', variants: ['kelp_sprout'], col: 2, row: 2, cleanHoles: true },
        { assetKey: 'eco_bubble_stream', variants: ['canyon_fissure_vent', 'reef_oxygen_plume'], col: 3, row: 2, cleanHoles: false },
        // Row 3: Sunken Debris & Benthic Bioluminescent Anemone/Crystal Reef Cluster
        { assetKey: 'eco_shipwreck_debris', variants: ['rusted_anchor'], col: 0, row: 3, cleanHoles: true },
        { assetKey: 'eco_shipwreck_debris', variants: ['broken_mast_timber'], col: 1, row: 3, cleanHoles: true },
        { assetKey: 'eco_shipwreck_debris', variants: ['barnacle_cannon'], col: 2, row: 3, cleanHoles: false },
        { assetKey: 'eco_coral_cluster', variants: ['biolum_anemone'], col: 3, row: 3, cleanHoles: false },
      ];

      for (const spec of ecoSlices) {
        const canvas = sliceAndCleanWorldSpriteRegion(
          ecoImg,
          gridCell(spec.col, spec.row),
          spec.cleanHoles,
          280
        );
        if (canvas) {
          if (!this.spriteCanvases.has(spec.assetKey)) {
            this.spriteCanvases.set(spec.assetKey, canvas);
          }
          for (const v of spec.variants) {
            this.spriteCanvases.set(`${spec.assetKey}:${v}`, canvas);
          }
        }
      }
    };
    ecoImg.src = WORLD_ATLAS_ASSET_URLS.ecologyAtlas;
  }

  public getSpriteCanvas(assetKey: string, variant?: string): HTMLCanvasElement | null {
    if (variant) {
      const byVariant = this.spriteCanvases.get(`${assetKey}:${variant}`);
      if (byVariant) return byVariant;
    }
    return this.spriteCanvases.get(assetKey) ?? null;
  }

  public getSeabedStripCanvas(biomeId: BiomeId): HTMLCanvasElement | null {
    return this.seabedStripCanvases.get(biomeId) ?? null;
  }

  public getSeabedSubStratumCanvas(biomeId: BiomeId): HTMLCanvasElement | null {
    return this.seabedSubStratumCanvases.get(biomeId) ?? null;
  }

  public registerAsset(descriptor: WorldAssetDescriptor): void {
    this.registry.set(descriptor.assetKey, { ...descriptor, isPlaceholder: false });
  }

  public hasAsset(assetKey: string): boolean {
    return this.registry.has(assetKey);
  }

  /**
   * 获取资源描述符；若 assetKey 未注册，返回安全的矢量占位符且绝不抛异常
   */
  public getAssetOrPlaceholder(
    assetKey: string,
    fallbackCategory: WorldAssetDescriptor['category'] = 'ambient'
  ): WorldAssetDescriptor {
    const found = this.registry.get(assetKey);
    if (found) return found;
    this.placeholderFallbackCount += 1;
    return {
      assetKey: assetKey || 'missing_asset_placeholder',
      category: fallbackCategory,
      primaryColor: '#64748b',
      secondaryColor: '#94a3b8',
      glowColor: '#38bdf8',
      shape: 'generic',
      isPlaceholder: true,
    };
  }

  public getPlaceholderFallbackCount(): number {
    return this.placeholderFallbackCount;
  }
}

export const worldAssetRegistry = new WorldAssetRegistry();
const scratchActiveChunkRenderedIds = new Set<string>();

/**
 * 规范第 11 / 13 节：WorldRenderer
 * 负责将激活态 Chunk 的四层复合珊瑚礁盘、岩石附生群落、连底海底珊瑚礁柱、热液喷口与大型地标 POI 在 1.0x 世界层绘制
 * 核心生态铁律：任何珊瑚、海葵、海绵、岩石与海草严禁悬空漂浮在海水中，必须 100% 嵌入海底地形、附着在礁石/沉船上、或层叠构成复合大珊瑚礁盘！
 */
export class WorldRenderer {
  private readonly assetRegistry: WorldAssetRegistry;

  constructor(assetRegistry: WorldAssetRegistry = worldAssetRegistry) {
    this.assetRegistry = assetRegistry;
  }

  /**
   * 辅助绘制单个底部中心锚定的精灵贴图（若贴图尚未加载完则安全回退矢量块）
   * 原点 (0, 0) 为贴附表面，sinkRatio 控制底部深入基岩/宿主礁石内部的嵌合比例（彻底消除接缝悬空）
   */
  private drawBottomAnchoredSprite(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement | null,
    localX: number,
    localY: number,
    targetH: number,
    sinkRatio: number,
    tiltRad: number = 0,
    flipX: boolean = false,
    fallbackColor: string = '#475569'
  ): { width: number; height: number } {
    ctx.save();
    ctx.translate(localX, localY);
    if (tiltRad !== 0) ctx.rotate(tiltRad);
    if (flipX) ctx.scale(-1, 1);

    if (sprite && sprite.width > 0 && sprite.height > 0) {
      const aspect = sprite.width / sprite.height;
      const drawH = targetH;
      const drawW = drawH * aspect;
      const sinkPx = drawH * sinkRatio;
      ctx.drawImage(sprite, -drawW * 0.5, -drawH + sinkPx, drawW, drawH);
      ctx.restore();
      return { width: drawW, height: drawH };
    }

    const drawW = targetH * 1.15;
    const drawH = targetH;
    ctx.fillStyle = fallbackColor;
    ctx.beginPath();
    ctx.arc(0, -drawH * 0.35, drawW * 0.45, Math.PI, 0, false);
    ctx.lineTo(drawW * 0.48, drawH * 0.2);
    ctx.lineTo(-drawW * 0.48, drawH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return { width: drawW, height: drawH };
  }

  /**
   * 四层结构化复合大珊瑚礁盘渲染器 (4-Tier Structural Coral Reef Outcrop Composer)
   * 严格遵循真实海洋造礁生态学：
   * - Tier 1 (底层礁岩基座 Plinth)：2~3 块宽幅海底岩板 (`mossy_slab`) 与玄武礁石 (`basalt_boulder`) 深深嵌入地形表面以下，提供稳固承重台面；
   * - Tier 2 (中层块状造礁核心 Massive Core)：脑珊瑚 (`brain_coral`) 与紫金管状海绵 (`tube_sponge`) 紧密叠压在底层礁岩凹槽上；
   * - Tier 3 (冠层分枝鹿角珊瑚与迎流海扇 Crown Branching & Sea Fans)：鹿角珊瑚 (`staghorn`)、柳珊瑚海扇 (`fan_coral`) 或深海发光海葵 (`biolum_anemone`) 扎根于脑珊瑚穹顶及礁石侧肩，随水流微幅摇曳；
   * - Tier 4 (礁麓伴生海草 Apron Flora)：在礁盘左右基底与海床交界处簇生海草 (`meadow_tuft` / `ribbon_grass`)，使珊瑚礁与地形浑然一体。
   */
  private renderCompositeCoralReefMound(
    ctx: CanvasRenderingContext2D,
    anchorEngineX: number,
    anchorFloorEngineY: number,
    localSlope: number,
    scale: number,
    seedHash: number,
    biomeId: BiomeId,
    nowSec: number,
    skipBgAnim: boolean
  ): void {
    const slabSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
    const boulderSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');
    const spireSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'jagged_spire');

    const staghornSprite = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', 'staghorn');
    const brainSprite = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', 'brain_coral');
    const fanSprite = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', 'fan_coral');
    const spongeSprite = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', 'tube_sponge');
    const biolumSprite = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', 'biolum_anemone');

    const tuftSprite = this.assetRegistry.getSpriteCanvas('eco_seagrass_bed', 'meadow_tuft');
    const ribbonSprite = this.assetRegistry.getSpriteCanvas('eco_seagrass_bed', 'ribbon_grass');

    const isDeepBiome = biomeId === 'underwater_canyon' || biomeId === 'deep_abyss';
    const slopeAngle = Math.atan2(localSlope, 1) * 0.68;
    const reefSpanHalfW = 38 * scale;
    // 斜坡嵌入深度补偿：确保在最大斜率 0.65 下礁盘左右两端依然 100% 深入海床内部
    const slopeEmbedSink = Math.abs(localSlope) * reefSpanHalfW + 8 * scale;

    const sway = skipBgAnim
      ? 0
      : Math.sin(nowSec * 1.5 + (seedHash % 97) * 0.065) * 0.045;

    ctx.save();
    ctx.translate(anchorEngineX, anchorFloorEngineY + slopeEmbedSink);
    ctx.rotate(slopeAngle);

    // 0. 礁盘底部接触环境光遮蔽阴影 (Contact Ambient Occlusion)
    ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, 44 * scale, 8.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // ========================================================================
    // Tier 1: 底层地形嵌合基岩礁盘底座 (Terrain-Embedded Reef Plinth)
    // ========================================================================
    const leftRockSprite = (seedHash & 1) === 0 ? boulderSprite : slabSprite;
    const rightRockSprite = (seedHash & 2) === 0 ? slabSprite : (isDeepBiome ? spireSprite : boulderSprite);
    this.drawBottomAnchoredSprite(
      ctx,
      leftRockSprite,
      -20 * scale,
      2 * scale,
      26 * scale,
      0.28,
      -0.08,
      (seedHash & 4) !== 0,
      '#334155'
    );
    this.drawBottomAnchoredSprite(
      ctx,
      rightRockSprite,
      21 * scale,
      3 * scale,
      25 * scale,
      0.28,
      0.09,
      (seedHash & 8) !== 0,
      '#334155'
    );
    // 中央主承重宽幅岩台
    this.drawBottomAnchoredSprite(
      ctx,
      slabSprite,
      0,
      4 * scale,
      32 * scale,
      0.32,
      0,
      (seedHash & 16) !== 0,
      '#475569'
    );

    // ========================================================================
    // Tier 4 (后置底层边缘): 礁麓两侧伴生海草簇 (Reef Apron Seagrass)
    // ========================================================================
    const leftGrass = (seedHash & 32) === 0 ? tuftSprite : ribbonSprite;
    const rightGrass = (seedHash & 64) === 0 ? ribbonSprite : tuftSprite;
    this.drawBottomAnchoredSprite(
      ctx,
      leftGrass,
      -34 * scale,
      2 * scale,
      28 * scale,
      0.26,
      -0.18 + sway * 1.3,
      false,
      '#10b981'
    );
    if ((seedHash % 3) !== 0) {
      this.drawBottomAnchoredSprite(
        ctx,
        rightGrass,
        35 * scale,
        3 * scale,
        26 * scale,
        0.26,
        0.16 + sway * 1.3,
        true,
        '#059669'
      );
    }

    // ========================================================================
    // Tier 2: 中层块状造礁核心堆叠层 (Massive Reef-Building Core Stack)
    // 紧密坐落在第 1 层岩台顶面 (-14m ~ -18m)，底部 34% 嵌入岩台凹槽内
    // ========================================================================
    const coreLeftSprite = isDeepBiome ? biolumSprite : (seedHash & 128) === 0 ? spongeSprite : brainSprite;
    const coreRightSprite = (seedHash & 256) === 0 ? brainSprite : spongeSprite;
    const coreCenterSprite = isDeepBiome && (seedHash & 512) !== 0 ? biolumSprite : brainSprite;

    // 左中层造礁团块
    this.drawBottomAnchoredSprite(
      ctx,
      coreLeftSprite,
      -15 * scale,
      -11 * scale,
      27 * scale,
      0.34,
      -0.14,
      (seedHash & 1024) !== 0,
      '#eab308'
    );
    // 右中层造礁团块
    this.drawBottomAnchoredSprite(
      ctx,
      coreRightSprite,
      16 * scale,
      -10 * scale,
      28 * scale,
      0.34,
      0.15,
      (seedHash & 2048) !== 0,
      '#14b8a6'
    );
    // 中央主造礁脑珊瑚穹顶
    this.drawBottomAnchoredSprite(
      ctx,
      coreCenterSprite,
      0,
      -13 * scale,
      31 * scale,
      0.36,
      0,
      (seedHash & 4096) !== 0,
      '#06b6d4'
    );

    // ========================================================================
    // Tier 3: 冠层分枝鹿角珊瑚、迎流海扇与深海海葵 (Crown Staghorn & Sea Fans)
    // 扎根于中层脑珊瑚穹顶与左右礁石侧肩，顺着岩石法线向外舒展
    // ========================================================================
    const crownMainSprite = isDeepBiome
      ? (seedHash & 8) === 0
        ? fanSprite
        : biolumSprite
      : (seedHash & 8) === 0
      ? staghornSprite
      : fanSprite;
    const crownLeftSprite = (seedHash & 16) === 0 ? fanSprite : staghornSprite;
    const crownRightSprite = isDeepBiome
      ? biolumSprite
      : (seedHash & 32) === 0
      ? staghornSprite
      : spongeSprite;

    // 左岩肩斜向生长的海扇/鹿角珊瑚
    this.drawBottomAnchoredSprite(
      ctx,
      crownLeftSprite,
      -21 * scale,
      -21 * scale,
      28 * scale,
      0.35,
      -0.32 + sway,
      false,
      '#ec4899'
    );
    // 右岩肩斜向生长的鹿角珊瑚/海绵/发光海葵
    this.drawBottomAnchoredSprite(
      ctx,
      crownRightSprite,
      20 * scale,
      -20 * scale,
      27 * scale,
      0.35,
      0.30 + sway,
      true,
      '#f43f5e'
    );
    // 礁盘正中最高冠层主珊瑚
    this.drawBottomAnchoredSprite(
      ctx,
      crownMainSprite,
      0,
      -26 * scale,
      34 * scale,
      0.36,
      sway * 0.85,
      (seedHash & 64) !== 0,
      '#fb7185'
    );

    ctx.restore();
  }

  /**
   * 岩石与沉船残骸及其表面附生珊瑚渲染器 (Rock & Wreck Debris with Attached Epifauna)
   * 确保海底岩石与残骸 100% 嵌入地形，且在珊瑚礁/大陆架/峡谷中岩石顶部与侧肩自然附着生长珊瑚与海草！
   */
  private renderAnchoredRockOrDebrisWithEpifauna(
    ctx: CanvasRenderingContext2D,
    objType: 'rock' | 'shipwreck_debris',
    variant: string | undefined,
    anchorEngineX: number,
    anchorFloorEngineY: number,
    localSlope: number,
    scale: number,
    seedHash: number,
    biomeId: BiomeId,
    nowSec: number,
    skipBgAnim: boolean
  ): void {
    const assetKey = objType === 'rock' ? 'eco_seabed_rock' : 'eco_shipwreck_debris';
    const mainSprite = this.assetRegistry.getSpriteCanvas(assetKey, variant);
    const slabSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
    const slopeAngle = Math.atan2(localSlope, 1) * 0.65;
    const baseH = (objType === 'shipwreck_debris' ? 36 : 32) * scale;
    const slopeEmbedSink = Math.abs(localSlope) * (baseH * 0.6) + 6 * scale;
    const sway = skipBgAnim ? 0 : Math.sin(nowSec * 1.5 + (seedHash % 83) * 0.07) * 0.04;

    ctx.save();
    ctx.translate(anchorEngineX, anchorFloorEngineY + slopeEmbedSink);
    ctx.rotate(slopeAngle);

    // 1. 底部托底基岩片（确保铁锚、船舵、古炮或尖石笋下方有坚实的岩石底座嵌入海床）
    if (objType === 'shipwreck_debris' || variant === 'jagged_spire') {
      this.drawBottomAnchoredSprite(
        ctx,
        slabSprite,
        0,
        4 * scale,
        24 * scale,
        0.34,
        0,
        (seedHash & 1) !== 0,
        '#334155'
      );
    }

    // 2. 绘制岩石或沉船残骸本体
    const { height: drawnRockH } = this.drawBottomAnchoredSprite(
      ctx,
      mainSprite,
      0,
      2 * scale,
      baseH,
      0.28,
      0,
      (seedHash & 2) !== 0,
      '#475569'
    );

    // 3. 在岩石/残骸的顶部与侧壁凹槽上附着生长共生珊瑚/海绵/海葵（符合“珊瑚附着在岩石或残骸上”的自然规律）
    if (biomeId !== 'deep_abyss' || (seedHash % 3) === 0) {
      const isDeep = biomeId === 'underwater_canyon' || biomeId === 'deep_abyss';
      const epifaunaVariants = isDeep
        ? (['biolum_anemone', 'tube_sponge', 'fan_coral'] as const)
        : (['staghorn', 'brain_coral', 'fan_coral', 'tube_sponge'] as const);
      const v1 = epifaunaVariants[seedHash % epifaunaVariants.length];
      const v2 = epifaunaVariants[(seedHash >> 3) % epifaunaVariants.length];
      const coral1 = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', v1);
      const coral2 = this.assetRegistry.getSpriteCanvas('eco_coral_cluster', v2);

      // 岩石肩部附着珊瑚
      this.drawBottomAnchoredSprite(
        ctx,
        coral1,
        ((seedHash & 4) === 0 ? -1 : 1) * 11 * scale,
        -drawnRockH * 0.48,
        21 * scale,
        0.36,
        ((seedHash & 4) === 0 ? -0.24 : 0.24) + sway,
        (seedHash & 8) !== 0,
        '#f43f5e'
      );

      // 岩石顶部冠生珊瑚
      if ((seedHash % 4) !== 0) {
        this.drawBottomAnchoredSprite(
          ctx,
          coral2,
          ((seedHash & 16) === 0 ? 4 : -4) * scale,
          -drawnRockH * 0.68,
          23 * scale,
          0.38,
          sway * 0.8,
          (seedHash & 32) !== 0,
          '#ec4899'
        );
      }
    }

    ctx.restore();
  }

  /**
   * 连底海底珊瑚礁孤峰与阶梯礁崖渲染器 (Terrain-Connected Reef Seamounts & Stepped Coral Pillars)
   * 解决浅海/中层水域（150m ~ 900m）离主海床（1100m+）较远时缺乏地形载体的问题：
   * 每隔固定水平晶格生成一座从下方主海床基岩一路向上耸立的厚重层状岩柱/礁台（底部直通主海床，绝不悬空），
   * 并在岩柱顶部的礁台和侧面阶梯岩架上层层堆叠 4 层复合大珊瑚礁盘！
   */
  private renderTerrainConnectedReefSeamounts(
    ctx: CanvasRenderingContext2D,
    minEngineX: number,
    maxEngineX: number,
    minEngineY: number,
    maxEngineY: number,
    nowSec: number,
    skipBgAnim: boolean
  ): number {
    const cellSpanM = 340; // 每 340m 水平晶格评估一座连底海底珊瑚礁柱/礁台
    const firstCell = Math.floor(minEngineX / cellSpanM) - 1;
    const lastCell = Math.ceil(maxEngineX / cellSpanM) + 1;
    let drawnSeamounts = 0;

    const slabSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
    const boulderSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');

    for (let cellIdx = firstCell; cellIdx <= lastCell; cellIdx++) {
      const cellSeed = mixSubsystemSeed(
        WorldConfig.worldSeed,
        WorldConfig.generatorVersion,
        cellIdx,
        77,
        'flora'
      );
      // 约 72% 晶格生成连底珊瑚礁孤峰，保留自然开阔水道
      if ((cellSeed % 100) >= 72) continue;

      const jitterM = (((cellSeed >>> 8) % 1000) / 1000 - 0.5) * (cellSpanM * 0.52);
      const centerEngineX = (cellIdx + 0.5) * cellSpanM + jitterM;
      const worldX = engineXToWorldX(centerEngineX);
      const floorEngineY = getEngineFloorDepthAt(centerEngineX);
      const biomeSample = getBiomeAt(worldX, meterDepthToWorldY(320), WorldConfig);
      const primaryBiome = biomeSample.primaryBiome;

      // 外海深水区 (open_ocean) 与极深渊减少浅层礁台，保持开阔感
      if (primaryBiome === 'open_ocean' && (cellSeed % 3) !== 0) continue;

      // 根据生态区确定礁台顶部深度 crestEngineY（浅海珊瑚礁在 250m ~ 510m 阳光带，岩架/峡谷在 380m ~ 780m）
      const depthNorm = ((cellSeed >>> 16) % 1000) / 1000;
      const crestEngineY =
        primaryBiome === 'coral_reef'
          ? 250 + depthNorm * 250
          : primaryBiome === 'rocky_shelf'
          ? 310 + depthNorm * 340
          : 420 + depthNorm * 380;

      // 礁台必须位于主海床之上至少 120m 才有必要建立耸立礁柱
      if (crestEngineY >= floorEngineY - 120) continue;

      const topWidthM = 115 + ((cellSeed >>> 20) % 75); // 顶部礁盘宽 115m ~ 190m
      const baseWidthM = topWidthM * 2.35;
      // 视锥裁剪：若整座孤峰（从 crestEngineY - 90m 到 floorEngineY）不在视野内则跳过
      if (
        centerEngineX + baseWidthM * 0.6 < minEngineX ||
        centerEngineX - baseWidthM * 0.6 > maxEngineX ||
        floorEngineY < minEngineY - 60 ||
        crestEngineY - 95 > maxEngineY
      ) {
        continue;
      }

      const pillarBottomY = Math.min(floorEngineY + 35, maxEngineY + 180);
      const pillarHeight = Math.max(80, pillarBottomY - crestEngineY);

      ctx.save();

      // 1. 绘制直通海底基岩的厚重阶梯状珊瑚礁岩柱本体 (Solid Stepped Reef Seamount Pillar)
      const pillarGrad = ctx.createLinearGradient(0, crestEngineY, 0, pillarBottomY);
      if (primaryBiome === 'coral_reef') {
        pillarGrad.addColorStop(0, '#4a3525');
        pillarGrad.addColorStop(0.28, '#2d211b');
        pillarGrad.addColorStop(1, '#0f141c');
      } else if (primaryBiome === 'underwater_canyon') {
        pillarGrad.addColorStop(0, '#1e293b');
        pillarGrad.addColorStop(0.35, '#0f172a');
        pillarGrad.addColorStop(1, '#020617');
      } else {
        pillarGrad.addColorStop(0, '#334155');
        pillarGrad.addColorStop(0.35, '#1e293b');
        pillarGrad.addColorStop(1, '#090d16');
      }

      ctx.fillStyle = pillarGrad;
      ctx.beginPath();
      const halfTop = topWidthM * 0.5;
      const halfMid = topWidthM * 0.78;
      const halfBase = baseWidthM * 0.55;
      const midY1 = crestEngineY + pillarHeight * 0.32;
      const midY2 = crestEngineY + pillarHeight * 0.68;

      ctx.moveTo(centerEngineX - halfTop, crestEngineY + 6);
      ctx.lineTo(centerEngineX + halfTop, crestEngineY + 6);
      ctx.lineTo(centerEngineX + halfMid, midY1);
      ctx.lineTo(centerEngineX + halfBase * 0.88, midY2);
      ctx.lineTo(centerEngineX + halfBase, pillarBottomY);
      ctx.lineTo(centerEngineX - halfBase, pillarBottomY);
      ctx.lineTo(centerEngineX - halfBase * 0.88, midY2);
      ctx.lineTo(centerEngineX - halfMid, midY1);
      ctx.closePath();
      ctx.fill();

      // 岩柱内部层状地质阴影脉络（增强厚重岩石体块感）
      ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
      ctx.beginPath();
      ctx.moveTo(centerEngineX + halfTop * 0.15, crestEngineY + 8);
      ctx.lineTo(centerEngineX + halfTop, crestEngineY + 6);
      ctx.lineTo(centerEngineX + halfMid, midY1);
      ctx.lineTo(centerEngineX + halfBase, pillarBottomY);
      ctx.lineTo(centerEngineX + halfBase * 0.1, pillarBottomY);
      ctx.closePath();
      ctx.fill();

      // 2. 在岩柱中段两侧突出阶梯岩架 (Stepped Rock Ledges)，并在岩架上附着次级珊瑚礁簇
      const leftLedgeX = centerEngineX - halfMid * 0.82;
      const leftLedgeY = crestEngineY + Math.min(115, pillarHeight * 0.28);
      const rightLedgeX = centerEngineX + halfMid * 0.82;
      const rightLedgeY = crestEngineY + Math.min(145, pillarHeight * 0.36);

      if (leftLedgeY >= minEngineY - 80 && leftLedgeY <= maxEngineY + 80) {
        this.drawBottomAnchoredSprite(
          ctx,
          slabSprite,
          leftLedgeX,
          leftLedgeY + 10,
          36,
          0.35,
          -0.12,
          false,
          '#334155'
        );
        this.renderCompositeCoralReefMound(
          ctx,
          leftLedgeX,
          leftLedgeY,
          -0.18,
          0.78,
          cellSeed ^ 0x13579bdf,
          primaryBiome,
          nowSec,
          skipBgAnim
        );
      }

      if (rightLedgeY >= minEngineY - 80 && rightLedgeY <= maxEngineY + 80) {
        this.drawBottomAnchoredSprite(
          ctx,
          boulderSprite,
          rightLedgeX,
          rightLedgeY + 10,
          34,
          0.35,
          0.14,
          true,
          '#334155'
        );
        this.renderCompositeCoralReefMound(
          ctx,
          rightLedgeX,
          rightLedgeY,
          0.18,
          0.74,
          cellSeed ^ 0x2468ace0,
          primaryBiome,
          nowSec,
          skipBgAnim
        );
      }

      // 3. 在礁台顶部铺设海床岩壳条带 (`seabed_strip_*`) 与四层复合主珊瑚礁群落
      const stripCanvas = this.assetRegistry.getSeabedStripCanvas(primaryBiome);
      if (stripCanvas) {
        ctx.drawImage(
          stripCanvas,
          0,
          0,
          stripCanvas.width,
          stripCanvas.height,
          centerEngineX - halfTop * 1.06,
          crestEngineY - 12,
          topWidthM * 1.06,
          42
        );
      }

      // 礁台顶部左、中、右连续堆叠 2~3 组复合大珊瑚礁盘，形成壮观的连片大珊瑚礁台地
      this.renderCompositeCoralReefMound(
        ctx,
        centerEngineX - halfTop * 0.42,
        crestEngineY + 2,
        -0.08,
        0.92,
        cellSeed ^ 0x9e3779b9,
        primaryBiome,
        nowSec,
        skipBgAnim
      );
      this.renderCompositeCoralReefMound(
        ctx,
        centerEngineX + halfTop * 0.42,
        crestEngineY + 3,
        0.08,
        0.90,
        cellSeed ^ 0x85ebca6b,
        primaryBiome,
        nowSec,
        skipBgAnim
      );
      this.renderCompositeCoralReefMound(
        ctx,
        centerEngineX,
        crestEngineY - 4,
        0,
        1.14,
        cellSeed,
        primaryBiome,
        nowSec,
        skipBgAnim
      );

      ctx.restore();
      drawnSeamounts += 1;
    }

    return drawnSeamounts;
  }

  /**
   * 渲染当前所有 Active Chunk 中的 POI 与海床附着生态实体（1.0x 物理世界同源坐标）
   */
  public renderActiveChunkEntities(
    ctx: CanvasRenderingContext2D,
    viewport: {
      cameraEngineX: number;
      cameraEngineY: number;
      viewW: number;
      viewH: number;
      renderZoom: number;
      nowMs?: number;
    },
    activeChunks: ReadonlyArray<GeneratedChunkData>
  ): number {
    if (!activeChunks || activeChunks.length === 0) return 0;
    this.assetRegistry.ensureAtlasesLoaded();

    const zoom = Math.max(0.25, viewport.renderZoom);
    const halfW = viewport.viewW / (2 * zoom) + 260;
    const halfH = viewport.viewH / (2 * zoom) + 260;
    const minEngineX = viewport.cameraEngineX - halfW;
    const maxEngineX = viewport.cameraEngineX + halfW;
    const minEngineY = viewport.cameraEngineY - halfH;
    const maxEngineY = viewport.cameraEngineY + halfH;
    const nowSec = (viewport.nowMs ?? 0) * 0.001;

    const skipDistantDecorations = performanceDegradationController.isDegraded('distant_decorations');
    const skipBgAnim = performanceDegradationController.isDegraded('background_animations');

    const renderedIds = scratchActiveChunkRenderedIds;
    renderedIds.clear();
    let drawnCount = 0;

    ctx.save();

    // 0. 绘制全水深 9 级非均匀渐进间距连续阶梯海床 (`SEABED_TERRACE_TIERS`) 顶面附着生长的复合珊瑚礁盘、共生礁石与海草群落：
    // 让玩家在浅海、暮光、半深海与深渊 (240m~18000m) 游动时始终有丰富的海底生态参照物，同时保持随水深逐级加宽的层间水平走廊 100% 畅通无阻！
    if (minEngineY <= 18000 && maxEngineY >= 240) {
      const minAtollChunkX = Math.floor((minEngineX * WORLD_UNITS_PER_METER) / WorldConfig.chunk.width);
      const maxAtollChunkX = Math.floor((maxEngineX * WORLD_UNITS_PER_METER) / WorldConfig.chunk.width);
      const boulderSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');

      for (let cx = minAtollChunkX; cx <= maxAtollChunkX; cx++) {
        const outcrops = getShallowCoralAtollOutcropsForChunk(cx, WorldConfig);
        for (let i = 0; i < outcrops.length; i++) {
          const item = outcrops[i];
          if (renderedIds.has(item.id)) continue;
          const ex = worldXToEngineX(item.worldX);
          const ey = item.floorY;
          if (
            ex < minEngineX ||
            ex > maxEngineX ||
            ey < minEngineY - 120 ||
            ey > maxEngineY + 120
          ) {
            continue;
          }
          if (
            skipDistantDecorations &&
            Math.hypot(ex - viewport.cameraEngineX, ey - viewport.cameraEngineY) > 680
          ) {
            continue;
          }
          renderedIds.add(item.id);

          if (item.type === 'coral') {
            this.renderCompositeCoralReefMound(
              ctx,
              ex,
              ey,
              item.slope,
              item.scale,
              item.seedHash,
              item.biomeId,
              nowSec,
              skipBgAnim
            );
            drawnCount += 1;
          } else if (item.type === 'rock') {
            this.renderAnchoredRockOrDebrisWithEpifauna(
              ctx,
              'rock',
              item.variant,
              ex,
              ey,
              item.slope,
              item.scale,
              item.seedHash,
              item.biomeId,
              nowSec,
              skipBgAnim
            );
            drawnCount += 1;
          } else {
            const grassSprite = this.assetRegistry.getSpriteCanvas('eco_seagrass_bed', item.variant);
            const slopeAngle = Math.atan2(item.slope, 1) * 0.62;
            const sway = skipBgAnim
              ? 0
              : Math.sin(nowSec * 1.55 + (item.seedHash % 100) * 0.063) * 0.075;
            const slopeEmbedSink = Math.abs(item.slope) * (20 * item.scale) + 6 * item.scale;
            ctx.save();
            ctx.translate(ex, ey + slopeEmbedSink);
            ctx.rotate(slopeAngle);
            this.drawBottomAnchoredSprite(
              ctx,
              boulderSprite,
              0,
              3 * item.scale,
              18 * item.scale,
              0.35,
              0,
              (item.seedHash & 1) !== 0,
              '#334155'
            );
            this.drawBottomAnchoredSprite(
              ctx,
              grassSprite,
              0,
              0,
              44 * item.scale,
              0.26,
              sway,
              (item.seedHash & 2) !== 0,
              '#10b981'
            );
            ctx.restore();
            drawnCount += 1;
          }
        }
      }
    }

    for (const chunk of activeChunks) {
      // 1. 绘制海床栖息生态群落（四层复合大珊瑚礁盘、岩石附生珊瑚、海草巨藻、沉船残骸、热液/氧气喷口）
      for (const obj of chunk.ecologyObjects) {
        if (renderedIds.has(obj.id)) continue;
        const objCfg = ECOLOGY_OBJECT_CONFIGS[obj.type as EcologyObjectType];
        // 严禁将水体游动生物 (fauna: fish_school / jellyfish / biolum_organism) 或浮游微粒当成静态珊瑚/岩石画在半空中！
        if (!objCfg || objCfg.category === 'fauna') continue;
        if (obj.type === 'plankton_mote' || obj.type === 'marine_snow') continue;

        const ex = worldXToEngineX(obj.worldX);
        // 强制铁律：所有海床物体的根部 Y 坐标 100% 锁定在精确的海床表面 getEngineFloorDepthAt(ex)，绝不使用可能悬空的 obj.worldY！
        const floorEngineY = getEngineFloorDepthAt(ex);
        const localSlope = getTerrainSlopeAt(obj.worldX);

        if (
          ex < minEngineX ||
          ex > maxEngineX ||
          floorEngineY < minEngineY - 120 ||
          floorEngineY > maxEngineY + 120
        ) {
          continue;
        }

        if (
          skipDistantDecorations &&
          Math.hypot(ex - viewport.cameraEngineX, floorEngineY - viewport.cameraEngineY) > 680
        ) {
          continue;
        }

        renderedIds.add(obj.id);
        const seedHash = hashToUint32(obj.id);
        const s = Math.max(0.72, Math.min(1.65, obj.scale ?? 1));
        const biomeId = (obj.biomeId as BiomeId) || 'coral_reef';

        // 1A. 珊瑚节点 -> 渲染「四层结构化复合大珊瑚礁盘」（底层礁石基座 + 中层脑珊瑚/海绵堆叠 + 冠层鹿角珊瑚/海扇 + 礁麓海草）
        if (obj.type === 'coral') {
          this.renderCompositeCoralReefMound(
            ctx,
            ex,
            floorEngineY,
            localSlope,
            s,
            seedHash,
            biomeId,
            nowSec,
            skipBgAnim
          );
          drawnCount += 1;
          continue;
        }

        // 1B. 海床岩石与沉船残骸 -> 嵌入海床地形，并在岩石/残骸顶部与侧肩附着生长共生珊瑚
        if (obj.type === 'rock' || obj.type === 'shipwreck_debris') {
          this.renderAnchoredRockOrDebrisWithEpifauna(
            ctx,
            obj.type,
            obj.variant,
            ex,
            floorEngineY,
            localSlope,
            s,
            seedHash,
            biomeId,
            nowSec,
            skipBgAnim
          );
          drawnCount += 1;
          continue;
        }

        // 1C. 海草/巨藻与海底热液/裂隙喷口 -> 根部配礁石底座并 100% 嵌入海床 floorEngineY
        const assetKey = objCfg.assetKey;
        const spriteCanvas = this.assetRegistry.getSpriteCanvas(assetKey, obj.variant);
        const boulderSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');
        const slopeAngle = Math.atan2(localSlope, 1) * 0.62;
        const sway =
          skipBgAnim || obj.type !== 'seagrass'
            ? 0
            : Math.sin(nowSec * 1.55 + (seedHash % 100) * 0.063) * 0.075;
        const slopeEmbedSink = Math.abs(localSlope) * (20 * s) + 6 * s;

        ctx.save();
        ctx.translate(ex, floorEngineY + slopeEmbedSink);
        ctx.rotate(slopeAngle);

        // 海草/喷口根部护根礁石
        this.drawBottomAnchoredSprite(
          ctx,
          boulderSprite,
          0,
          3 * s,
          18 * s,
          0.35,
          0,
          (seedHash & 1) !== 0,
          '#334155'
        );
        // 海草群或喷口主体
        this.drawBottomAnchoredSprite(
          ctx,
          spriteCanvas,
          0,
          0,
          (obj.type === 'seagrass' ? 44 : 42) * s,
          0.26,
          sway,
          (seedHash & 2) !== 0,
          obj.type === 'seagrass' ? '#10b981' : '#38bdf8'
        );

        ctx.restore();
        drawnCount += 1;
      }

      // 2. 绘制大型 POI 地标（包含跨 Chunk 共享引用的 POI，100% 锚定于海床 floorEngineY 并铺设基岩托底）
      const allPois =
        chunk.overlappingPOIs.length > 0
          ? [...chunk.pois, ...chunk.overlappingPOIs]
          : chunk.pois;
      for (const poi of allPois) {
        if (renderedIds.has(poi.id)) continue;
        const ex = worldXToEngineX(poi.worldX);
        const floorEngineY = getEngineFloorDepthAt(ex);
        const localSlope = getTerrainSlopeAt(poi.worldX);
        if (
          ex < minEngineX ||
          ex > maxEngineX ||
          floorEngineY < minEngineY - 160 ||
          floorEngineY > maxEngineY + 160
        ) {
          continue;
        }

        renderedIds.add(poi.id);
        const desc = this.assetRegistry.getAssetOrPlaceholder(poi.assetKey, 'poi');
        const poiSprite = this.assetRegistry.getSpriteCanvas(poi.assetKey, poi.variant);
        const slabSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
        const targetWidthEng = Math.max(58, Math.min(126, poi.width * 0.145));
        const radiusEng = targetWidthEng * 0.5;
        const poiStatus = poi.poiState ?? (poi.state?.status as string | undefined) ?? 'unvisited';
        const isDepleted = poiStatus === 'depleted' || poiStatus === 'interacted';
        const slopeAngle = Math.atan2(localSlope, 1) * 0.55;
        const slopeEmbedSink = Math.abs(localSlope) * radiusEng * 0.65 + 8;

        ctx.save();
        ctx.translate(ex, floorEngineY + slopeEmbedSink);
        ctx.rotate(slopeAngle);

        // 环境氛围柔光底座
        const glowRadius = radiusEng * (isDepleted ? 0.85 : 1.25);
        const grad = ctx.createRadialGradient(0, -radiusEng * 0.35, radiusEng * 0.15, 0, -radiusEng * 0.35, glowRadius);
        grad.addColorStop(
          0,
          isDepleted
            ? 'rgba(148, 163, 184, 0.14)'
            : poi.type === 'treasure'
            ? 'rgba(251, 191, 36, 0.28)'
            : poi.type === 'rare_creature_nest'
            ? 'rgba(192, 132, 252, 0.26)'
            : 'rgba(56, 189, 248, 0.22)'
        );
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -radiusEng * 0.35, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 地标底层承重礁盘基座
        this.drawBottomAnchoredSprite(
          ctx,
          slabSprite,
          0,
          6,
          radiusEng * 0.72,
          0.38,
          0,
          false,
          '#334155'
        );

        if (poiSprite && poiSprite.width > 0 && poiSprite.height > 0) {
          const aspect = poiSprite.width / poiSprite.height;
          const drawW = targetWidthEng * (poi.scale ?? 1);
          const drawH = drawW / Math.max(0.35, aspect);
          if (isDepleted) {
            ctx.globalAlpha = 0.68;
          }
          // 底部深深嵌入海床基座
          ctx.drawImage(
            poiSprite,
            -drawW * 0.5,
            -drawH * 0.76,
            drawW,
            drawH
          );
        } else {
          ctx.fillStyle = isDepleted ? '#475569' : desc.primaryColor;
          ctx.strokeStyle = isDepleted ? '#94a3b8' : desc.secondaryColor;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          if (poi.type === 'shipwreck') {
            ctx.moveTo(-radiusEng * 0.9, -radiusEng * 0.45);
            ctx.lineTo(radiusEng * 0.95, -radiusEng * 0.55);
            ctx.lineTo(radiusEng * 0.65, radiusEng * 0.12);
            ctx.lineTo(-radiusEng * 0.7, radiusEng * 0.12);
            ctx.closePath();
          } else if (poi.type === 'treasure') {
            ctx.roundRect(-radiusEng * 0.55, -radiusEng * 0.7, radiusEng * 1.1, radiusEng * 0.8, 6);
          } else {
            ctx.arc(0, -radiusEng * 0.25, radiusEng * 0.62, Math.PI, 0, false);
            ctx.lineTo(radiusEng * 0.72, radiusEng * 0.1);
            ctx.lineTo(-radiusEng * 0.72, radiusEng * 0.1);
            ctx.closePath();
          }
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
        drawnCount += 1;
      }
    }

    ctx.restore();
    return drawnCount;
  }
}

export const worldRenderer = new WorldRenderer(worldAssetRegistry);

// ============================================================================
// 阶段 E 核心编排器：ChunkLifecycleManager (2D 生命周期、异步取消、容量硬上限与对象池协同)
// ============================================================================

export interface PendingChunkTask {
  taskId: number;
  chunkX: number;
  chunkY: number;
  chunkId: string;
  priorityScore: number;
  isVisible: boolean;
  enqueuedAtTick: number;
}

export class ChunkLifecycleManager {
  private readonly config: WorldConfigType;
  private readonly pool: WorldObjectPool;
  private readonly persistence: WorldPersistence;
  private readonly degradation: PerformanceDegradationController;

  /**
   * 当前处于生命周期追踪中的 Chunk 记录（unloaded 状态且不在缓存中的记录会及时移出 Map）
   */
  private readonly records: Map<string, ChunkLifecycleRecord> = new Map();
  /**
   * 规范第 12 节：有界 LRU 纯数据缓存（上限 maxCachedChunkRecords = 64）
   */
  private readonly dataCache: Map<string, { data: GeneratedChunkData; lastTouchedTick: number }> = new Map();
  /**
   * 规范第 12 节：有界生成优先级队列（上限 maxQueueSize = 32）
   */
  private readonly generationQueue: PendingChunkTask[] = [];
  /**
   * 当前正在异步生成中的任务表（用于模拟或追踪异步 Worker / 分帧生成完成时的过期校验）
   */
  private readonly inFlightTasks: Map<number, PendingChunkTask> = new Map();

  private currentWindow: DesiredChunkWindow | null = null;
  private tickCounter = 0;
  private nextTaskId = 1;
  private staleTasksPreventedCount = 0;
  private cacheEvictionCount = 0;
  private queueDropCount = 0;

  constructor(
    config: WorldConfigType = WorldConfig,
    pool: WorldObjectPool = worldObjectPool,
    persistence: WorldPersistence = worldPersistence,
    degradation: PerformanceDegradationController = performanceDegradationController
  ) {
    this.config = config;
    this.pool = pool;
    this.persistence = persistence;
    this.degradation = degradation;
  }

  private getOrCreateRecord(chunkX: number, chunkY: number): ChunkLifecycleRecord {
    const chunkId = formatChunkId(chunkX, chunkY);
    let rec = this.records.get(chunkId);
    if (!rec) {
      rec = {
        chunkX,
        chunkY,
        chunkId,
        state: 'unloaded',
        stateHistory: ['unloaded'],
        data: null,
        activeTaskId: null,
        lastTouchedTick: this.tickCounter,
        generationDurationMs: 0,
      };
      this.records.set(chunkId, rec);
    }
    return rec;
  }

  private storeInBoundedCache(chunkId: string, data: GeneratedChunkData): void {
    const maxCache = Math.max(1, this.config.performance.maxCachedChunkRecords);
    if (this.dataCache.has(chunkId)) {
      this.dataCache.delete(chunkId);
    }
    this.dataCache.set(chunkId, {
      data,
      lastTouchedTick: this.tickCounter,
    });

    // 超出缓存上限时，优先淘汰非 active 且最久未访问的条目
    while (this.dataCache.size > maxCache) {
      let oldestKey: string | null = null;
      let oldestTick = Infinity;
      for (const [k, v] of this.dataCache.entries()) {
        const rec = this.records.get(k);
        if (rec && rec.state === 'active') continue;
        if (v.lastTouchedTick < oldestTick) {
          oldestTick = v.lastTouchedTick;
          oldestKey = k;
        }
      }
      if (!oldestKey) {
        oldestKey = this.dataCache.keys().next().value ?? null;
      }
      if (!oldestKey) break;
      this.dataCache.delete(oldestKey);
      this.cacheEvictionCount += 1;
    }
  }

  private activateReadyChunk(rec: ChunkLifecycleRecord): void {
    if (rec.state !== 'ready' || !rec.data) return;
    // 应用增量存档状态（POI 已探索/交互状态与已移除动态对象）
    rec.data = this.persistence.applyToGeneratedChunk(rec.data);
    transitionChunkState(rec, 'active');
    rec.lastTouchedTick = this.tickCounter;

    // 注册活跃 Chunk 并从对象池获取运行实例
    this.pool.registerActiveChunk(rec.chunkId);
    for (const obj of rec.data.ecologyObjects) {
      this.pool.acquire(`eco:${obj.type}`, rec.chunkId, obj);
    }
    for (const poi of rec.data.pois) {
      this.pool.acquire(`poi:${poi.type}`, rec.chunkId, poi);
    }
  }

  private releaseChunkToUnloaded(rec: ChunkLifecycleRecord): void {
    if (rec.state === 'active' || rec.state === 'ready') {
      transitionChunkState(rec, 'releasing');
    }
    if (rec.state === 'releasing') {
      this.pool.releaseChunkInstances(rec.chunkId);
      rec.data = null;
      rec.activeTaskId = null;
      transitionChunkState(rec, 'unloaded');
    } else if (rec.state === 'queued') {
      rec.activeTaskId = null;
      transitionChunkState(rec, 'unloaded');
    }
  }

  private enqueueChunkGeneration(
    chunkX: number,
    chunkY: number,
    priorityScore: number,
    isVisible: boolean
  ): void {
    const rec = this.getOrCreateRecord(chunkX, chunkY);
    if (rec.state !== 'unloaded') return;

    // 若命中 LRU 数据缓存，直接恢复为 ready，无需重复排队生成
    const cached = this.dataCache.get(rec.chunkId);
    if (cached) {
      cached.lastTouchedTick = this.tickCounter;
      rec.data = this.persistence.applyToGeneratedChunk(cached.data);
      transitionChunkState(rec, 'ready');
      return;
    }

    // 若触发第 5 级降级（推迟屏幕外较远 Chunk 任务），跳过非可见且距离较远的预加载任务
    if (
      !isVisible &&
      this.degradation.isDegraded('distant_task_priority') &&
      priorityScore > 6.5
    ) {
      return;
    }

    const maxQueue = Math.max(1, this.config.performance.maxQueueSize);
    if (this.generationQueue.length >= maxQueue) {
      // 队列已满时，若新任务比队尾最低优先级任务更紧急，则淘汰队尾任务
      this.generationQueue.sort((a, b) => a.priorityScore - b.priorityScore);
      const worst = this.generationQueue[this.generationQueue.length - 1];
      if (worst && priorityScore < worst.priorityScore) {
        this.generationQueue.pop();
        const worstRec = this.records.get(worst.chunkId);
        if (worstRec && worstRec.state === 'queued') {
          this.releaseChunkToUnloaded(worstRec);
        }
        this.queueDropCount += 1;
      } else {
        this.queueDropCount += 1;
        return;
      }
    }

    const taskId = this.nextTaskId++;
    transitionChunkState(rec, 'queued');
    rec.activeTaskId = taskId;
    this.generationQueue.push({
      taskId,
      chunkX,
      chunkY,
      chunkId: rec.chunkId,
      priorityScore,
      isVisible,
      enqueuedAtTick: this.tickCounter,
    });
    this.generationQueue.sort((a, b) => {
      if (a.isVisible !== b.isVisible) return a.isVisible ? -1 : 1;
      if (Math.abs(a.priorityScore - b.priorityScore) > 1e-6) {
        return a.priorityScore - b.priorityScore;
      }
      return a.chunkId.localeCompare(b.chunkId);
    });
  }

  /**
   * 启动异步 Chunk 生成任务（返回 taskId 供后续 completeAsyncChunkTask 回调验证）
   */
  public startAsyncChunkTask(chunkX: number, chunkY: number): number {
    this.tickCounter += 1;
    const rec = this.getOrCreateRecord(chunkX, chunkY);
    if (rec.state === 'unloaded') {
      transitionChunkState(rec, 'queued');
    }
    if (rec.state !== 'queued') {
      throw new Error(`Cannot start async task for ${rec.chunkId} in state ${rec.state}`);
    }
    const taskId = rec.activeTaskId ?? this.nextTaskId++;
    rec.activeTaskId = taskId;
    transitionChunkState(rec, 'generating');
    const task: PendingChunkTask = {
      taskId,
      chunkX,
      chunkY,
      chunkId: rec.chunkId,
      priorityScore: 0,
      isVisible: true,
      enqueuedAtTick: this.tickCounter,
    };
    this.inFlightTasks.set(taskId, task);
    return taskId;
  }

  /**
   * 规范第 10 节：异步任务完成回调与过期结果防激活保护
   * 当某个异步任务完成时，如果该 Chunk 已经不在需要的范围内：
   * - 可以把纯数据缓存起来（受 LRU 上限约束）
   * - 但绝对不能再把它变成 active（直接 generating -> ready -> releasing -> unloaded）
   */
  public completeAsyncChunkTask(
    taskId: number,
    generatedData?: GeneratedChunkData
  ): { activated: boolean; finalState: ChunkLifecycleState; chunkId: string } {
    const task = this.inFlightTasks.get(taskId);
    if (!task) {
      return { activated: false, finalState: 'unloaded', chunkId: '' };
    }
    this.inFlightTasks.delete(taskId);

    const rec = this.getOrCreateRecord(task.chunkX, task.chunkY);
    const rawData =
      generatedData ?? generateChunk(task.chunkX, task.chunkY, this.config);
    const data = this.persistence.applyToGeneratedChunk(rawData);

    // 无论是否过期，纯数据均可放入有界 LRU 缓存
    this.storeInBoundedCache(rec.chunkId, data);

    if (rec.state === 'generating') {
      rec.data = data;
      transitionChunkState(rec, 'ready');
    }

    const stillDesiredActive =
      this.currentWindow?.activeCandidateIds.has(rec.chunkId) ?? false;
    const activeCount = this.getActiveChunkCount();

    if (
      rec.state === 'ready' &&
      stillDesiredActive &&
      activeCount < this.config.chunk.maxActiveChunks
    ) {
      this.activateReadyChunk(rec);
      return { activated: true, finalState: rec.state, chunkId: rec.chunkId };
    }

    // 任务过期或超出激活窗口：严禁进入 active，立即走 ready -> releasing -> unloaded 回收
    if (rec.state === 'ready') {
      this.staleTasksPreventedCount += 1;
      this.releaseChunkToUnloaded(rec);
    }
    return { activated: false, finalState: rec.state, chunkId: rec.chunkId };
  }

  /**
   * 每帧主循环更新：
   * 1. 计算方向性预加载窗口与垂直缓冲窗口
   * 2. 卸载超出保留窗口的 Chunk，并将超出 maxActiveChunks 的远端 Chunk 降为卸载
   * 3. 将缺失的目标 Chunk 加入有界优先级队列
   * 4. 在每帧生成预算 (generationBudgetMsPerFrame = 2ms) 内消费队列并激活视野内 Chunk
   */
  public updateForViewport(
    cameraWorldRect: { minWorldX: number; maxWorldX: number; minWorldY: number; maxWorldY: number },
    playerVelocityX: number = 0,
    options?: { maxSyncGenerateCount?: number }
  ): {
    window: DesiredChunkWindow;
    activeChunks: GeneratedChunkData[];
    frameGenElapsedMs: number;
  } {
    this.tickCounter += 1;
    const window = getDesiredChunkWindow(cameraWorldRect, playerVelocityX, this.config);
    this.currentWindow = window;

    // 1. 取消队列中已离开保留窗口的排队任务
    for (let i = this.generationQueue.length - 1; i >= 0; i--) {
      const q = this.generationQueue[i];
      if (!window.retainWindowIds.has(q.chunkId)) {
        this.generationQueue.splice(i, 1);
        const rec = this.records.get(q.chunkId);
        if (rec && rec.state === 'queued') {
          this.releaseChunkToUnloaded(rec);
        }
      }
    }

    // 2. 卸载离开保留窗口的 active/ready Chunk，或不再属于 activeCandidateIds 的 active Chunk
    for (const [chunkId, rec] of this.records.entries()) {
      const inRetain = window.retainWindowIds.has(chunkId);
      const inActiveCandidates = window.activeCandidateIds.has(chunkId);
      if (!inRetain) {
        if (rec.state === 'active' || rec.state === 'ready' || rec.state === 'queued') {
          this.releaseChunkToUnloaded(rec);
        }
        if (rec.state === 'unloaded' && !this.dataCache.has(chunkId)) {
          this.records.delete(chunkId);
        }
      } else if (rec.state === 'active' && !inActiveCandidates) {
        // 仍在保留窗口但退出了前 maxActiveChunks (10) 激活名额：释放运行实例，数据保留在 LRU 缓存中
        this.releaseChunkToUnloaded(rec);
      } else if (rec.state === 'ready' && !inActiveCandidates) {
        // ready 状态但不属于当前激活候选，释放回 unloaded（纯数据已在 LRU 缓存中）
        this.releaseChunkToUnloaded(rec);
      }
    }

    // 3. 将期望窗口中的 Chunk 入队（或从缓存恢复为 ready）
    // 注意：对于外围预加载 Chunk（!inActiveCandidates），若其纯数据已经存在于 LRU dataCache 中，
    // 直接刷新缓存时间戳即可，严禁每帧执行 unloaded -> ready -> releasing -> unloaded 状态振荡与重复克隆！
    for (const item of window.desiredCoords) {
      const inActiveCandidates = window.activeCandidateIds.has(item.chunkId);
      const cached = this.dataCache.get(item.chunkId);
      if (!inActiveCandidates && cached) {
        cached.lastTouchedTick = this.tickCounter;
        continue;
      }
      const rec = this.getOrCreateRecord(item.chunkX, item.chunkY);
      if (rec.state === 'unloaded') {
        const priorityScore = item.distanceSq + item.forwardPriority + (item.isVisible ? -10 : 0);
        this.enqueueChunkGeneration(item.chunkX, item.chunkY, priorityScore, item.isVisible);
      }
    }

    // 4. 在每帧时间预算内处理生成队列（保证当前屏幕可见的核心 Chunk 至少推进生成）
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const budgetMs = this.config.performance.generationBudgetMsPerFrame;
    const maxSyncCount = options?.maxSyncGenerateCount ?? 6;
    let generatedThisTick = 0;

    while (this.generationQueue.length > 0 && generatedThisTick < maxSyncCount) {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = nowMs - startMs;
      // 至少允许生成 1 个紧迫可见 Chunk，之后严格检查 2ms 帧预算
      if (generatedThisTick > 0 && elapsed >= budgetMs) {
        break;
      }

      const nextTask = this.generationQueue.shift()!;
      const rec = this.getOrCreateRecord(nextTask.chunkX, nextTask.chunkY);
      if (rec.state !== 'queued') continue;

      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      transitionChunkState(rec, 'generating');

      const rawData = generateChunk(nextTask.chunkX, nextTask.chunkY, this.config);
      const data = this.persistence.applyToGeneratedChunk(rawData);
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

      rec.data = data;
      rec.generationDurationMs = Math.max(0, t1 - t0);
      this.storeInBoundedCache(rec.chunkId, data);
      transitionChunkState(rec, 'ready');
      generatedThisTick += 1;

      if (!window.activeCandidateIds.has(rec.chunkId)) {
        // 属于外围预加载 Chunk：生成数据并写入 LRU 缓存后立即走 ready -> releasing -> unloaded，不占用 active 槽位
        this.releaseChunkToUnloaded(rec);
      }
    }

    const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const frameGenElapsedMs = Math.max(0, endMs - startMs);
    this.degradation.recordFrameGenerationTime(frameGenElapsedMs);

    // 5. 按优先级激活 activeCandidateIds 中处于 ready 状态的 Chunk（严格不超过 maxActiveChunks = 10）
    for (const item of window.desiredCoords) {
      if (!window.activeCandidateIds.has(item.chunkId)) continue;
      if (this.getActiveChunkCount() >= this.config.chunk.maxActiveChunks) break;

      const rec = this.records.get(item.chunkId);
      if (rec && rec.state === 'ready') {
        this.activateReadyChunk(rec);
      }
    }

    return {
      window,
      activeChunks: this.getActiveChunks(),
      frameGenElapsedMs,
    };
  }

  public getActiveChunks(): GeneratedChunkData[] {
    const list: GeneratedChunkData[] = [];
    for (const rec of this.records.values()) {
      if (rec.state === 'active' && rec.data) {
        list.push(rec.data);
      }
    }
    return list;
  }

  public getActiveChunkCount(): number {
    let count = 0;
    for (const rec of this.records.values()) {
      if (rec.state === 'active') count += 1;
    }
    return count;
  }

  public getChunkState(chunkX: number, chunkY: number): ChunkLifecycleState {
    const rec = this.records.get(formatChunkId(chunkX, chunkY));
    return rec?.state ?? 'unloaded';
  }

  public getChunkRecord(chunkX: number, chunkY: number): ChunkLifecycleRecord | undefined {
    return this.records.get(formatChunkId(chunkX, chunkY));
  }

  public getCachedChunkCount(): number {
    return this.dataCache.size;
  }

  public getQueueLength(): number {
    return this.generationQueue.length;
  }

  public getStaleTasksPreventedCount(): number {
    return this.staleTasksPreventedCount;
  }

  public getStats(): {
    activeChunkCount: number;
    maxActiveChunks: number;
    cachedChunkCount: number;
    maxCachedChunkRecords: number;
    queueLength: number;
    maxQueueSize: number;
    trackedRecordCount: number;
    staleTasksPreventedCount: number;
    cacheEvictionCount: number;
    queueDropCount: number;
    lastFrameGenMs: number;
    degradations: ReadonlyArray<PerformanceDegradationLevel>;
  } {
    return {
      activeChunkCount: this.getActiveChunkCount(),
      maxActiveChunks: this.config.chunk.maxActiveChunks,
      cachedChunkCount: this.dataCache.size,
      maxCachedChunkRecords: this.config.performance.maxCachedChunkRecords,
      queueLength: this.generationQueue.length,
      maxQueueSize: this.config.performance.maxQueueSize,
      trackedRecordCount: this.records.size,
      staleTasksPreventedCount: this.staleTasksPreventedCount,
      cacheEvictionCount: this.cacheEvictionCount,
      queueDropCount: this.queueDropCount,
      lastFrameGenMs: this.degradation.getLastFrameGenerationMs(),
      degradations: this.degradation.getActiveDegradations(),
    };
  }

  public reset(): void {
    for (const rec of this.records.values()) {
      if (rec.state === 'active' || rec.state === 'ready' || rec.state === 'queued') {
        this.releaseChunkToUnloaded(rec);
      }
    }
    this.records.clear();
    this.dataCache.clear();
    this.generationQueue.length = 0;
    this.inFlightTasks.clear();
    this.currentWindow = null;
    this.pool.clearAll();
  }
}

export const worldChunkLifecycleManager = new ChunkLifecycleManager(
  WorldConfig,
  worldObjectPool,
  worldPersistence,
  performanceDegradationController
);

// ============================================================================
// 0. 核心类型与四尺度 (L0 ~ L3) 数据契约定义
// ============================================================================

/**
 * L0 宏观海洋地理结构 (Section 1)
 */
export type MacroGeographyType =
  | 'CONTINENTAL_SHELF'   // 浅海大陆架（沙地、岩礁）
  | 'CORAL_REEF_BELT'     // 珊瑚礁带（珊瑚群落、礁石通道）
  | 'CONTINENTAL_SLOPE'   // 大陆坡（连续岩壁、碎石坡）
  | 'SUBMARINE_CANYON'    // 海底峡谷（峡谷边缘、洞穴）
  | 'ABYSSAL_PLAIN'       // 深海盆地（深海平原、发光生物群）
  | 'OCEANIC_TRENCH';     // 海沟（陡峭岩壁、稀疏生态）

/**
 * 宏观探索节奏区域序列 (Section 6)
 * 浅海珊瑚礁 -> 沙地开阔区 -> 礁石密集区 -> 海底峡谷 -> 深海平原 -> 发光生物区 -> 大型海沟
 */
export type ExplorationZoneType =
  | 'SHALLOW_CORAL_REEF'     // 浅海珊瑚礁
  | 'SANDY_OPEN_FLAT'        // 沙地开阔区
  | 'DENSE_REEF_PASSAGE'     // 礁石密集区
  | 'SUBMARINE_CANYON_DROP'  // 海底峡谷
  | 'ABYSSAL_PLAIN_EXPANSE'  // 深海平原
  | 'BIOLUMINESCENT_GROVE'   // 发光生物区
  | 'HADAL_TRENCH_CHASM';    // 大型海沟

/**
 * 六大连续环境数值场采样结果 (Section 3)
 */
export interface TerrainEnvironmentFields {
  worldX: number;
  worldY: number;
  /** depthField: 深度场 (m, >= 0) */
  depth: number;
  /** heightField: 海底地形起伏高度 (px, 连续多层噪声合成) */
  height: number;
  /** slopeField: 归一化地形坡度 (0 = 平坦沙地, 1 = 陡峭悬崖/岩壁) */
  slope: number;
  /** temperatureField: 归一化水温场 (0 = 极寒海沟, 1 = 温暖浅海或热液喷口核心) */
  temperature: number;
  /** lightField: 归一化光照场 (0 = 无光深渊, 1 = 阳光充沛表层) */
  light: number;
  /** biomeField: 当前主导宏观探索群落类型 */
  biome: ExplorationZoneType;
  /** L0 宏观地理分区 */
  macroGeography: MacroGeographyType;
  /** 次级过渡群落类型（位于两个宏观区域交界过渡带时存在） */
  secondaryBiome: ExplorationZoneType;
  /** 主导群落向次级群落的平滑过渡权重 [0, 1] */
  biomeTransitionFactor: number;
}

/**
 * L2 地貌结构类型 (Section 2 & 5)
 */
export type LandformStructureKind =
  | 'CAVE_CHAMBER'       // 连续岩体洞穴/拱廊（跨 Chunk 连续 SDF）
  | 'REEF_ARCHWAY'       // 珊瑚礁石通道拱门
  | 'CONTINUOUS_CLIFF'   // 连续阶梯岩壁
  | 'SAND_DUNE_RIDGE'    // 浅海波纹沙丘
  | 'CANYON_PILLAR'      // 海底峡谷石柱
  | 'HYDROTHERMAL_MOUND';// 深渊热液黑烟囱岩冢

export interface LandformStructureInstance {
  id: string;
  kind: LandformStructureKind;
  centerX: number;
  baseY: number;
  width: number;
  height: number;
  archRadius: number;
  slope: number;
  seed: number;
  biome: ExplorationZoneType;
}

/**
 * L3 生态群落类型与局部装饰类型 (Section 2 & 4)
 */
export type EcologyClusterType =
  | 'coral_reef'         // 珊瑚礁群落
  | 'seagrass_meadow'    // 浅海沙地海草床
  | 'kelp_forest'        // 巨藻林群落
  | 'boulder_outcrop'    // 碎石岩块群
  | 'biolum_grove'       // 深海发光海鞭/水母群落
  | 'hydrothermal_oasis';// 海沟热液管虫与气泡群落

export type DecorationPropKind =
  | 'STAGHORN_CORAL'
  | 'BRAIN_CORAL'
  | 'TUBE_SPONGE'
  | 'SEAGRASS_TUFT'
  | 'GIANT_KELP_STALK'
  | 'MOSSY_BOULDER'
  | 'BIOLUM_SEA_WHIP'
  | 'GLOW_ANEMONE'
  | 'HYDROTHERMAL_BUBBLE_VENT'
  | 'ABYSSAL_CRYSTAL_SPIRE';

export interface EcologyCluster {
  id: string;
  center: { x: number; y: number };
  radius: number;
  type: EcologyClusterType;
  density: number;
  seed: number;
  biome: ExplorationZoneType;
  /** 群落关联的推荐猎物行为倾向（供 EcosystemSpawner 聚集刷怪联动） */
  preferredPreyArchetype: 'REEF_SWARM' | 'SAND_GRAZER' | 'CANYON_HUNTER' | 'BIOLUM_DRIFTER' | 'ABYSS_APEX';
}

export interface DecorationPropInstance {
  id: string;
  clusterId: string;
  kind: DecorationPropKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  swayPhase: number;
  tintHex: string;
  secondaryHex: string;
  lodPriority: 0 | 1 | 2; // 0 = 关键主景 (全 LOD 可见), 1 = 中等细节, 2 = 近距微细节
}

/**
 * 单个 Chunk 的缓存数据结构 (Section 5 & 7)
 * Chunk 只负责缓存、组织与渲染，地形高度与结构边界全部通过全局坐标采样保证 100% 连续
 */
export interface WorldChunkData {
  chunkIndex: number;
  startX: number;
  endX: number;
  width: number;
  macroBiome: ExplorationZoneType;
  macroGeography: MacroGeographyType;
  /** 采样点间隔固定（含 startX 与 endX 闭区间端点），确保相邻 Chunk 左右边缘高度严格相等 */
  terrainSampleStep: number;
  /** L1 海底主轮廓高度采样序列（相对于生态带基准海床的起伏偏移 px） */
  heightSamples: Float32Array;
  /** L1 中景岩层高度采样序列 */
  midStratumSamples: Float32Array;
  /** L1 远景海山轮廓采样序列 */
  farRidgeSamples: Float32Array;
  /** L1 坡度采样序列 */
  slopeSamples: Float32Array;
  /** L2 地貌结构实例（洞穴、礁石拱门、岩壁、沙丘） */
  structures: LandformStructureInstance[];
  /** L3 聚集式生态群落中心 */
  clusters: EcologyCluster[];
  /** L3 经 Poisson Disk Sampling 与环境场过滤后的局部装饰实例 */
  decorations: DecorationPropInstance[];
  lastAccessedTime: number;
}

// ============================================================================
// 1. 模块一：WorldGenerator（全局种子、连续多层噪声与六大环境场）
// ============================================================================

export class WorldGenerator {
  public readonly worldSeed: number;

  constructor(worldSeed: number = 20261110) {
    this.worldSeed = worldSeed >>> 0;
  }

  /**
   * 确定性整数哈希函数 -> [0, 1)
   */
  public hash1D(n: number, salt: number = 0): number {
    let x = (Math.imul(Math.floor(n), 374761393) + Math.imul(this.worldSeed ^ salt, 668265263)) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * 确定性二维哈希函数 -> [0, 1)
   */
  public hash2D(ix: number, iy: number, salt: number = 0): number {
    let h =
      (Math.imul(Math.floor(ix), 374761393) +
        Math.imul(Math.floor(iy), 668265263) +
        Math.imul(this.worldSeed ^ salt, 2147483647)) >>>
      0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * 生成确定性伪随机数流 (Mulberry32)
   */
  public createSeededRng(localSeed: number): () => number {
    let state = (this.worldSeed ^ (localSeed >>> 0)) >>> 0;
    if (state === 0) state = 0x6d2b79f5;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 一维 C2 连续梯度/值噪声 (返回值范围 [-1, 1])
   */
  public noise1D(x: number, salt: number = 0): number {
    const x0 = Math.floor(x);
    const tx = x - x0;
    // Quintic C2 Hermite curve: 6t^5 - 15t^4 + 10t^3
    const u = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
    const v0 = this.hash1D(x0, salt) * 2 - 1;
    const v1 = this.hash1D(x0 + 1, salt) * 2 - 1;
    return v0 + (v1 - v0) * u;
  }

  /**
   * 二维 C2 连续平滑噪声 (返回值范围 [-1, 1])
   */
  public noise2D(x: number, y: number, salt: number = 0): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    const a = this.hash2D(ix, iy, salt) * 2 - 1;
    const b = this.hash2D(ix + 1, iy, salt) * 2 - 1;
    const c = this.hash2D(ix, iy + 1, salt) * 2 - 1;
    const d = this.hash2D(ix + 1, iy + 1, salt) * 2 - 1;

    const ab = a + (b - a) * ux;
    const cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
  }

  /**
   * 一维 Voronoi 细胞距离场 (用于 L2 地貌结构：礁石群、洞穴腔体、峡谷裂隙)
   */
  public voronoi1D(
    x: number,
    cellSize: number,
    salt: number = 101
  ): { cellIndex: number; cellCenterX: number; distToCenter: number; normalizedDist: number; cellSeed: number } {
    const safeSize = Math.max(16, cellSize);
    const baseCell = Math.floor(x / safeSize);
    let bestCell = baseCell;
    let bestCenterX = (baseCell + 0.5) * safeSize;
    let bestDist = Infinity;

    for (let offset = -1; offset <= 1; offset++) {
      const candidateCell = baseCell + offset;
      const jitter = (this.hash1D(candidateCell, salt) - 0.5) * 0.68;
      const centerX = (candidateCell + 0.5 + jitter) * safeSize;
      const dist = Math.abs(x - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = candidateCell;
        bestCenterX = centerX;
      }
    }

    const cellSeed = Math.floor(this.hash1D(bestCell, salt + 77) * 0x7fffffff);
    return {
      cellIndex: bestCell,
      cellCenterX: bestCenterX,
      distToCenter: bestDist,
      normalizedDist: Math.min(1, bestDist / (safeSize * 0.5)),
      cellSeed,
    };
  }

  /**
   * 方案第五节标准公式：多层连续地形高度采样 `getTerrainHeight(worldX)`
   * - L0 低频大陆架起伏: `noise(worldX * 0.0005) * 500`
   * - L1 中频海底山脉/岩壁: `noise(worldX * 0.002) * 150`
   * - L2/L3 高频礁盘起伏: `noise(worldX * 0.008) * 30`
   * 任意相邻 Chunk 在边界 `worldX` 处调用此函数，返回值在数学上 100% 恒等。
   */
  public getTerrainHeight(worldX: number): number {
    return (
      this.noise1D(worldX * 0.0005, 11) * 500 +
      this.noise1D(worldX * 0.002, 23) * 150 +
      this.noise1D(worldX * 0.008, 37) * 30
    );
  }

  /**
   * 计算世界坐标 `worldX` 处的归一化地形坡度 `slopeField` ∈ [0, 1]
   */
  public getSlope(worldX: number): number {
    const delta = 12;
    const hL = this.getTerrainHeight(worldX - delta);
    const hR = this.getTerrainHeight(worldX + delta);
    const derivative = Math.abs(hR - hL) / (2 * delta);
    // 三层噪声合成的最大理论斜率约为 (500*0.0005 + 150*0.002 + 30*0.008) * 3.2 ≈ 2.6，归一化至 [0, 1]
    return Math.max(0, Math.min(1, derivative / 2.6));
  }

  /**
   * 计算深度场 `depthField` (m)
   * 结合垂直坐标 `worldY` 与横向海沟/峡谷下陷调制
   */
  public getDepth(worldX: number, worldY: number): number {
    const baseDepth = Math.max(0, worldY);
    const macroTrenchDrop = Math.max(0, -this.noise1D(worldX * 0.00025, 53)) * 45;
    return baseDepth + macroTrenchDrop;
  }

  /**
   * 计算光照场 `lightField` ∈ [0, 1]
   * 遵循水下 Beer-Lambert 光衰减定律 + 横向宏观礁盘开阔度调制
   */
  public getLight(worldY: number, worldX: number = 0): number {
    const depth = Math.max(0, worldY);
    // 0m = 1.0, 250m ≈ 0.56, 520m ≈ 0.25, 1150m ≈ 0.03
    const verticalLight = Math.exp(-depth / 410);
    const canopyMod = 1 + this.noise1D(worldX * 0.0004, 71) * 0.12;
    return Math.max(0, Math.min(1, verticalLight * canopyMod));
  }

  /**
   * 计算温度场 `temperatureField` ∈ [0, 1]
   * 表层温暖 (0.85~1.0) -> 暮光温跃层骤降 (0.35) -> 深渊寒冷 (0.12)，但在深海热液喷口附近回升
   */
  public getTemperature(worldX: number, worldY: number): number {
    const depth = Math.max(0, worldY);
    const surfaceWarmth = Math.exp(-depth / 580);
    const hydrothermalAnomaly =
      depth > 950
        ? Math.pow(Math.max(0, this.noise1D(worldX * 0.0018, 89)), 2) *
          quinticSmoothstep(950, 1400, depth) *
          0.65
        : 0;
    return Math.max(0.08, Math.min(1, surfaceWarmth * 0.92 + 0.08 + hydrothermalAnomaly));
  }

  // ---- 方案第三节：基于环境场的生态出现概率纯函数 ----

  /**
   * 方案第三节标准示例公式：珊瑚出现概率 `coralProbability(env)`
   * 珊瑚出现在浅海、光照充足、坡度平缓~适中的礁区
   */
  public coralProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    // 浅海因子：0m 最高，随深度超过 520m 平滑衰减至 0
    const shallowFactor = 1 - quinticSmoothstep(40, 540, env.depth);
    const lightFactor = quinticSmoothstep(0.15, 0.8, env.light);
    const slopeFactor = 1 - quinticSmoothstep(0.25, 0.85, env.slope);
    return Math.max(0, Math.min(1, shallowFactor * lightFactor * slopeFactor));
  }

  /**
   * 海草出现概率：更适合浅海平坦沙地 (`slope < 0.35`)
   */
  public seagrassProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    const shallowFactor = 1 - quinticSmoothstep(20, 460, env.depth);
    const lightFactor = quinticSmoothstep(0.22, 0.85, env.light);
    const flatSandFactor = 1 - quinticSmoothstep(0.08, 0.45, env.slope);
    return Math.max(0, Math.min(1, shallowFactor * lightFactor * flatSandFactor));
  }

  /**
   * 巨藻林出现概率：适合大陆架边缘与峡谷坡地 (`120m ~ 780m`)
   */
  public kelpForestProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    const depthBand =
      quinticSmoothstep(60, 220, env.depth) * (1 - quinticSmoothstep(520, 880, env.depth));
    const slopeBand = 1 - quinticSmoothstep(0.35, 0.88, env.slope);
    return Math.max(0, Math.min(1, depthBand * slopeBand));
  }

  /**
   * 深海生物发光群落概率：在暮光带下半部与深渊区增加出现概率
   */
  public biolumProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    const deepFactor = quinticSmoothstep(420, 980, env.depth);
    const lowLightFactor = 1 - quinticSmoothstep(0.02, 0.45, env.light);
    return Math.max(0, Math.min(1, deepFactor * lowLightFactor));
  }
}

// ============================================================================
// 2. 模块二：BiomeManager（L0 宏观区域规划器与 7 大探索节奏平滑过渡）
// ============================================================================

const SHALLOW_EXPLORATION_CYCLE: readonly ExplorationZoneType[] = [
  'SHALLOW_CORAL_REEF',
  'SANDY_OPEN_FLAT',
  'DENSE_REEF_PASSAGE',
  'SUBMARINE_CANYON_DROP',
];

const TWILIGHT_EXPLORATION_CYCLE: readonly ExplorationZoneType[] = [
  'SUBMARINE_CANYON_DROP',
  'DENSE_REEF_PASSAGE',
  'BIOLUMINESCENT_GROVE',
  'ABYSSAL_PLAIN_EXPANSE',
];

const ABYSS_EXPLORATION_CYCLE: readonly ExplorationZoneType[] = [
  'ABYSSAL_PLAIN_EXPANSE',
  'BIOLUMINESCENT_GROVE',
  'HADAL_TRENCH_CHASM',
];

export interface MacroZoneEvaluation {
  primaryBiome: ExplorationZoneType;
  secondaryBiome: ExplorationZoneType;
  transitionFactor: number; // 0 = 纯 primary, 0..1 = 过渡带内平滑插值
  macroGeography: MacroGeographyType;
  zoneCenterX: number;
  zoneRadius: number;
  /** 对海底地形高度的缩放调制（例如沙地开阔区压平，峡谷/礁石密集区放大起伏） */
  reliefMultiplier: number;
  /** 对海床近景层的纵向抬升/下沉偏移 (px, >= -22) */
  seabedVerticalBiasPx: number;
  /** 珊瑚/海草/发光植被密度乘数 */
  floraDensityMultiplier: number;
  /** 鱼群聚集度乘数 */
  schoolClusterProbability: number;
}

export class BiomeManager {
  private readonly worldGen: WorldGenerator;
  /** 宏观区域基准跨度（非硬切固定长度，内部叠加 Voronoi 种子扰动，使玩家横向游动时每 960m 平滑经历不同探索节奏区域） */
  public readonly baseMacroSpan: number = 960;

  constructor(worldGen: WorldGenerator) {
    this.worldGen = worldGen;
  }

  /**
   * 根据宏观探索区域映射对应的 L0 宏观地理结构 (Section 1)
   */
  public mapZoneToMacroGeography(zone: ExplorationZoneType, depth: number): MacroGeographyType {
    if (depth > 1350 || zone === 'HADAL_TRENCH_CHASM') {
      return 'OCEANIC_TRENCH';
    }
    if (depth > 950 || zone === 'ABYSSAL_PLAIN_EXPANSE' || zone === 'BIOLUMINESCENT_GROVE') {
      return 'ABYSSAL_PLAIN';
    }
    switch (zone) {
      case 'SHALLOW_CORAL_REEF':
      case 'DENSE_REEF_PASSAGE':
        return 'CORAL_REEF_BELT';
      case 'SANDY_OPEN_FLAT':
        return 'CONTINENTAL_SHELF';
      case 'SUBMARINE_CANYON_DROP':
        return depth > 480 ? 'SUBMARINE_CANYON' : 'CONTINENTAL_SLOPE';
      default:
        return 'CONTINENTAL_SHELF';
    }
  }

  /**
   * 获取指定探索区域的环境调制参数
   */
  private getZonePreset(zone: ExplorationZoneType): {
    reliefMultiplier: number;
    seabedVerticalBiasPx: number;
    floraDensityMultiplier: number;
    schoolClusterProbability: number;
  } {
    switch (zone) {
      case 'SHALLOW_CORAL_REEF':
        return {
          reliefMultiplier: 1.05,
          seabedVerticalBiasPx: -6,
          floraDensityMultiplier: 1.4,
          schoolClusterProbability: 0.78,
        };
      case 'SANDY_OPEN_FLAT':
        return {
          reliefMultiplier: 0.36,
          seabedVerticalBiasPx: 26, // 沙地开阔区岩礁下沉，露出平缓金色波纹沙床与开阔巡航视野
          floraDensityMultiplier: 0.55,
          schoolClusterProbability: 0.42,
        };
      case 'DENSE_REEF_PASSAGE':
        return {
          reliefMultiplier: 1.42,
          seabedVerticalBiasPx: -18, // 礁石密集区岩层显著隆起，形成丰富礁石通道与拱门
          floraDensityMultiplier: 1.55,
          schoolClusterProbability: 0.85,
        };
      case 'SUBMARINE_CANYON_DROP':
        return {
          reliefMultiplier: 1.62,
          seabedVerticalBiasPx: 12,
          floraDensityMultiplier: 0.85,
          schoolClusterProbability: 0.64,
        };
      case 'ABYSSAL_PLAIN_EXPANSE':
        return {
          reliefMultiplier: 0.48,
          seabedVerticalBiasPx: 22,
          floraDensityMultiplier: 0.6,
          schoolClusterProbability: 0.5,
        };
      case 'BIOLUMINESCENT_GROVE':
        return {
          reliefMultiplier: 1.18,
          seabedVerticalBiasPx: -8,
          floraDensityMultiplier: 1.5,
          schoolClusterProbability: 0.82,
        };
      case 'HADAL_TRENCH_CHASM':
        return {
          reliefMultiplier: 1.75,
          seabedVerticalBiasPx: 18,
          floraDensityMultiplier: 0.48,
          schoolClusterProbability: 0.38,
        };
    }
  }

  /**
   * 基于宏观 Seed 在水平与垂直维度决定当前区域的探索节奏，并在相邻区域间建立平滑过渡带 (Section 6)
   */
  public evaluateMacroZone(worldX: number, worldY: number): MacroZoneEvaluation {
    const depth = Math.max(0, worldY);
    // 通过非线性相位扭曲避免固定长度区域，使每个宏观区域长度自然变化
    const warpedX =
      worldX + this.worldGen.noise1D(worldX * 0.00035, 307) * 240;
    const scaledCoord = warpedX / this.baseMacroSpan;
    const cellIdx = Math.floor(scaledCoord);
    const cellFrac = scaledCoord - cellIdx; // [0, 1)

    const pickZoneForCell = (cIdx: number): ExplorationZoneType => {
      const h = this.worldGen.hash1D(cIdx, 409);
      if (depth <= 520) {
        const idx =
          ((cIdx % SHALLOW_EXPLORATION_CYCLE.length) + SHALLOW_EXPLORATION_CYCLE.length) %
          SHALLOW_EXPLORATION_CYCLE.length;
        if (h > 0.82) {
          return SHALLOW_EXPLORATION_CYCLE[(idx + 1) % SHALLOW_EXPLORATION_CYCLE.length];
        }
        return SHALLOW_EXPLORATION_CYCLE[idx];
      }
      if (depth <= 1150) {
        const idx =
          ((cIdx % TWILIGHT_EXPLORATION_CYCLE.length) + TWILIGHT_EXPLORATION_CYCLE.length) %
          TWILIGHT_EXPLORATION_CYCLE.length;
        return TWILIGHT_EXPLORATION_CYCLE[idx];
      }
      const idx =
        ((cIdx % ABYSS_EXPLORATION_CYCLE.length) + ABYSS_EXPLORATION_CYCLE.length) %
        ABYSS_EXPLORATION_CYCLE.length;
      return ABYSS_EXPLORATION_CYCLE[idx];
    };

    const currentZone = pickZoneForCell(cellIdx);
    // 在每个区域首尾 28% 宽度建立平滑过渡带
    let neighborZone = currentZone;
    let transitionFactor = 0;

    if (cellFrac < 0.28) {
      neighborZone = pickZoneForCell(cellIdx - 1);
      transitionFactor = (1 - quinticSmoothstep(0, 0.28, cellFrac)) * 0.5;
    } else if (cellFrac > 0.72) {
      neighborZone = pickZoneForCell(cellIdx + 1);
      transitionFactor = quinticSmoothstep(0.72, 1.0, cellFrac) * 0.5;
    }

    const pA = this.getZonePreset(currentZone);
    const pB = this.getZonePreset(neighborZone);
    const t = transitionFactor;

    return {
      primaryBiome: currentZone,
      secondaryBiome: neighborZone,
      transitionFactor: t,
      macroGeography: this.mapZoneToMacroGeography(currentZone, depth),
      zoneCenterX: (cellIdx + 0.5) * this.baseMacroSpan,
      zoneRadius: this.baseMacroSpan * 0.5,
      reliefMultiplier: pA.reliefMultiplier * (1 - t) + pB.reliefMultiplier * t,
      seabedVerticalBiasPx:
        pA.seabedVerticalBiasPx * (1 - t) + pB.seabedVerticalBiasPx * t,
      floraDensityMultiplier:
        pA.floraDensityMultiplier * (1 - t) + pB.floraDensityMultiplier * t,
      schoolClusterProbability:
        pA.schoolClusterProbability * (1 - t) + pB.schoolClusterProbability * t,
    };
  }

  /**
   * 采样完整的六大连续环境数值场 `TerrainEnvironmentFields` (Section 3)
   */
  public sampleEnvironmentFields(worldX: number, worldY: number): TerrainEnvironmentFields {
    const macro = this.evaluateMacroZone(worldX, worldY);
    const depth = this.worldGen.getDepth(worldX, worldY);
    const height = this.worldGen.getTerrainHeight(worldX) * macro.reliefMultiplier;
    const slope = Math.min(1, this.worldGen.getSlope(worldX) * macro.reliefMultiplier);
    const light = this.worldGen.getLight(depth, worldX);
    const temperature = this.worldGen.getTemperature(worldX, depth);

    return {
      worldX,
      worldY,
      depth,
      height,
      slope,
      temperature,
      light,
      biome: macro.primaryBiome,
      macroGeography: macro.macroGeography,
      secondaryBiome: macro.secondaryBiome,
      biomeTransitionFactor: macro.transitionFactor,
    };
  }
}

// ============================================================================
// 3. 模块三：TerrainGenerator（L1 连续海底地形轮廓与多岩层剖面生成）
// ============================================================================

export class TerrainGenerator {
  private readonly worldGen: WorldGenerator;
  private readonly biomeMgr: BiomeManager;

  constructor(worldGen: WorldGenerator, biomeMgr: BiomeManager) {
    this.worldGen = worldGen;
    this.biomeMgr = biomeMgr;
  }

  /**
   * 规范第 6.1 & 13 节：全局连续海床深度函数 `getFloorDepthAt(worldX)`
   */
  public getFloorDepthAt(worldX: number, config: WorldConfigType = WorldConfig): number {
    return getFloorDepthAt(worldX, config);
  }

  /**
   * 规范第 6.2 & 13 节：全局海床斜率函数 `getTerrainSlopeAt(worldX)`
   */
  public getTerrainSlopeAt(worldX: number, config: WorldConfigType = WorldConfig): number {
    return getTerrainSlopeAt(worldX, config);
  }

  /**
   * 规范第 6.2 & 13 节：Chunk 海床采样序列 `getTerrainSamples(chunkX)`
   */
  public getTerrainSamples(chunkX: number, config: WorldConfigType = WorldConfig): TerrainChunkSamples {
    return getTerrainSamples(chunkX, config);
  }

  /**
   * 计算任意全局坐标 `worldX` 处的连续海底地形轮廓高度（兼容 Chunk 边界 100% 精确相等）
   */
  public getContinuousTerrainHeight(worldX: number, referenceDepthY: number = 260): number {
    const macro = this.biomeMgr.evaluateMacroZone(worldX, referenceDepthY);
    return this.worldGen.getTerrainHeight(worldX) * macro.reliefMultiplier;
  }

  /**
   * 计算屏幕任意垂直切片列对应的世界坐标 `worldX` 处的连续地形垂直位移 (px)
   * 用于驱动 Far / Mid / Near 视差图层切片产生真实的海山、岩坡、峡谷、平缓沙地起伏（告别平直死板的贴图平铺！）
   */
  public sampleColumnContourOffsetPx(
    worldX: number,
    depthY: number,
    layerKind: 'FAR' | 'MID' | 'NEAR'
  ): number {
    const macro = this.biomeMgr.evaluateMacroZone(worldX, depthY);
    const rawH = this.worldGen.getTerrainHeight(worldX);
    const ridgeWave = Math.tanh(rawH / 320); // [-1, 1]

    if (layerKind === 'FAR') {
      const farWave =
        this.worldGen.noise1D(worldX * 0.0012 + 3.7, 193) * 0.65 +
        ridgeWave * 0.35;
      // 负值代表海山向上隆起，正值代表海谷下沉
      return Math.round(
        (-farWave * 38 * macro.reliefMultiplier) +
          Math.max(0, macro.seabedVerticalBiasPx * 0.45)
      );
    }

    if (layerKind === 'MID') {
      const midWave =
        this.worldGen.noise1D(worldX * 0.0022 + 11.4, 149) * 0.55 +
        ridgeWave * 0.45;
      return Math.round(
        (-midWave * 46 * macro.reliefMultiplier) +
          macro.seabedVerticalBiasPx * 0.85
      );
    }

    // NEAR: 海床近景主轮廓
    const detailWave = this.worldGen.noise1D(worldX * 0.0045 + 5.2, 37) * 14;
    return Math.round(
      (-ridgeWave * 36 * macro.reliefMultiplier - detailWave) +
        macro.seabedVerticalBiasPx
    );
  }

  /**
   * 计算用于视差图层调制的三平面连续地形偏移（px）
   */
  public sampleParallaxTerrainModulation(
    worldX: number,
    depthY: number
  ): {
    farRidgeOffsetPx: number;
    midStratumOffsetPx: number;
    nearSeabedOffsetPx: number;
    macroZone: MacroZoneEvaluation;
  } {
    const macro = this.biomeMgr.evaluateMacroZone(worldX, depthY);
    const rawH = this.worldGen.getTerrainHeight(worldX);
    const normalizedRidge = Math.tanh(rawH / 360); // [-1, 1]

    const farRidgeOffsetPx = Math.max(
      0,
      Math.round((0.5 - 0.5 * normalizedRidge) * 22 * macro.reliefMultiplier)
    );
    const midStratumOffsetPx = Math.max(
      0,
      Math.round(
        (0.5 - 0.5 * this.worldGen.noise1D(worldX * 0.0014, 61)) *
          30 *
          macro.reliefMultiplier +
          Math.max(0, macro.seabedVerticalBiasPx * 0.55)
      )
    );
    const nearSeabedOffsetPx = Math.max(
      0,
      Math.round(
        (0.5 - 0.5 * normalizedRidge) * 26 * macro.reliefMultiplier +
          Math.max(0, macro.seabedVerticalBiasPx)
      )
    );

    return {
      farRidgeOffsetPx,
      midStratumOffsetPx,
      nearSeabedOffsetPx,
      macroZone: macro,
    };
  }

  /**
   * 为指定 Chunk `[startX, endX]` 采样连续地形轮廓数组
   * 第 0 个采样点严格对应 `startX`，最后一个采样点严格对应 `endX`
   */
  public generateChunkTerrainProfiles(
    startX: number,
    endX: number,
    step: number,
    referenceDepthY: number
  ): {
    heightSamples: Float32Array;
    midStratumSamples: Float32Array;
    farRidgeSamples: Float32Array;
    slopeSamples: Float32Array;
  } {
    const span = Math.max(step, endX - startX);
    const count = Math.floor(span / step) + 1;
    const heightSamples = new Float32Array(count);
    const midStratumSamples = new Float32Array(count);
    const farRidgeSamples = new Float32Array(count);
    const slopeSamples = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const wx = i === count - 1 ? endX : startX + i * step;
      const h = this.getContinuousTerrainHeight(wx, referenceDepthY);
      heightSamples[i] = h;
      midStratumSamples[i] =
        h * 0.62 + this.worldGen.noise1D(wx * 0.0016 + 17.3, 149) * 95;
      farRidgeSamples[i] =
        this.worldGen.noise1D(wx * 0.00038 + 5.1, 193) * 320 +
        this.worldGen.noise1D(wx * 0.0011, 211) * 90;
      slopeSamples[i] = this.worldGen.getSlope(wx);
    }

    return {
      heightSamples,
      midStratumSamples,
      farRidgeSamples,
      slopeSamples,
    };
  }
}

// ============================================================================
// 4. 模块四：StructureGenerator（L2 地貌结构：Voronoi + 规则模板 + 跨边界洞穴 SDF）
// ============================================================================

export class StructureGenerator {
  private readonly worldGen: WorldGenerator;
  private readonly biomeMgr: BiomeManager;
  /** Voronoi 地貌结构单元格跨度（全局坐标系，天然跨 Chunk 边界共享） */
  public readonly structureCellSpan: number = 340;

  constructor(worldGen: WorldGenerator, biomeMgr: BiomeManager) {
    this.worldGen = worldGen;
    this.biomeMgr = biomeMgr;
  }

  /**
   * 评估全局坐标 `(worldX, worldY)` 处的洞穴/拱廊有符号距离场 (Signed Distance Field)
   * 返回值 `< 0` 表示处于天然岩洞/礁石拱门内部通道，`> 0` 表示在外部开放水域。
   * 由于直接基于全局 Voronoi 单元格采样，洞穴绝不会被 Chunk 边界截断。
   */
  public evaluateCaveSignedDistance(worldX: number, worldY: number): number {
    const vor = this.worldGen.voronoi1D(worldX, this.structureCellSpan, 503);
    const env = this.biomeMgr.sampleEnvironmentFields(vor.cellCenterX, worldY);

    // 规则约束：洞穴只生成在岩体坡度较高 (`slope > 0.28`) 或海底峡谷/礁石密集区，绝不在平坦沙地突兀出现
    const canHostCave =
      env.slope > 0.28 ||
      env.biome === 'SUBMARINE_CANYON_DROP' ||
      env.biome === 'DENSE_REEF_PASSAGE' ||
      env.biome === 'HADAL_TRENCH_CHASM';
    if (!canHostCave) {
      return 999;
    }

    const roll = this.worldGen.hash1D(vor.cellIndex, 521);
    if (roll > 0.52) {
      return 999;
    }

    const archRadiusX = 135 + this.worldGen.hash1D(vor.cellIndex, 541) * 85;
    const archRadiusY = 72 + this.worldGen.hash1D(vor.cellIndex, 557) * 45;
    const caveCenterY = Math.max(140, Math.min(2100, worldY));

    const nx = (worldX - vor.cellCenterX) / archRadiusX;
    const ny = (worldY - caveCenterY) / archRadiusY;
    const warp = this.worldGen.noise2D(worldX * 0.006, worldY * 0.006, 569) * 0.18;
    return Math.hypot(nx, ny) + warp - 1.0;
  }

  /**
   * 获取覆盖 `[startX, endX]` 的所有 L2 地貌结构实例
   * 采用全局 Voronoi 网格索引扫描（含左右跨界扩展格），因此跨 Chunk 边界的大型洞穴或岩壁在两个相邻 Chunk 中拥有完全一致的世界坐标。
   */
  public generateStructuresForRange(
    startX: number,
    endX: number,
    referenceDepthY: number
  ): LandformStructureInstance[] {
    const results: LandformStructureInstance[] = [];
    const span = this.structureCellSpan;
    const firstCell = Math.floor((startX - span * 0.5) / span);
    const lastCell = Math.ceil((endX + span * 0.5) / span);

    for (let cellIdx = firstCell; cellIdx <= lastCell; cellIdx++) {
      const jitter = (this.worldGen.hash1D(cellIdx, 503) - 0.5) * 0.56;
      const centerX = (cellIdx + 0.5 + jitter) * span;
      const width = 210 + this.worldGen.hash1D(cellIdx, 601) * 210;

      // 若该结构包围盒与当前 Chunk 区间无交集则跳过
      if (centerX + width * 0.5 < startX || centerX - width * 0.5 > endX) {
        continue;
      }

      const env = this.biomeMgr.sampleEnvironmentFields(centerX, referenceDepthY);
      const typeRoll = this.worldGen.hash1D(cellIdx, 613);
      let kind: LandformStructureKind;

      if (env.biome === 'SANDY_OPEN_FLAT' && env.slope < 0.42) {
        kind = 'SAND_DUNE_RIDGE';
      } else if (env.depth > 1050 && typeRoll < 0.58) {
        kind = 'HYDROTHERMAL_MOUND';
      } else if (
        (env.biome === 'SUBMARINE_CANYON_DROP' || env.slope > 0.32) &&
        typeRoll < 0.48
      ) {
        kind = 'CAVE_CHAMBER';
      } else if (
        (env.biome === 'DENSE_REEF_PASSAGE' || env.biome === 'SHALLOW_CORAL_REEF') &&
        typeRoll < 0.68
      ) {
        kind = 'REEF_ARCHWAY';
      } else if (env.slope > 0.38) {
        kind = 'CONTINUOUS_CLIFF';
      } else {
        kind = 'CANYON_PILLAR';
      }

      const height =
        kind === 'SAND_DUNE_RIDGE'
          ? 52 + this.worldGen.hash1D(cellIdx, 619) * 38
          : kind === 'CAVE_CHAMBER' || kind === 'REEF_ARCHWAY'
          ? 145 + this.worldGen.hash1D(cellIdx, 619) * 95
          : 120 + this.worldGen.hash1D(cellIdx, 619) * 110;

      results.push({
        id: `struct_${cellIdx}`,
        kind,
        centerX,
        baseY: env.depth,
        width,
        height,
        archRadius: kind === 'CAVE_CHAMBER' || kind === 'REEF_ARCHWAY' ? width * 0.35 : 0,
        slope: env.slope,
        seed: Math.floor(this.worldGen.hash1D(cellIdx, 631) * 0x7fffffff),
        biome: env.biome,
      });
    }

    return results;
  }
}

// ============================================================================
// 5. 模块五：EcologyGenerator（群落中心 + Poisson Disk Sampling + 环境过滤）
// ============================================================================

export class EcologyGenerator {
  private readonly worldGen: WorldGenerator;
  private readonly biomeMgr: BiomeManager;
  public readonly clusterCellSpan: number = 280;

  constructor(worldGen: WorldGenerator, biomeMgr: BiomeManager) {
    this.worldGen = worldGen;
    this.biomeMgr = biomeMgr;
  }

  /**
   * 规范第 7、8、13 节：生成指定二维 Chunk `(chunkX, chunkY)` 的生态对象纯数据 `generateEcology`
   */
  public generateEcology(
    chunkX: number,
    chunkY: number,
    config: WorldConfigType = WorldConfig
  ): GeneratedObject[] {
    return generateEcology(chunkX, chunkY, config);
  }

  /**
   * 方案第四节核心算法：在给定群落圆形区域内执行 Poisson Disk Sampling + 微小位置扰动
   * 保证任意两个生成点之间的欧氏距离 `>= minDistance`，消除纯随机堆叠伪影。
   */
  public samplePoissonDiskInCluster(
    cluster: EcologyCluster,
    minDistance: number,
    maxPoints: number
  ): Array<{ x: number; y: number; rNorm: number; seed: number }> {
    const rng = this.worldGen.createSeededRng(cluster.seed);
    const accepted: Array<{ x: number; y: number; rNorm: number; seed: number }> = [];
    const safeMinDist = Math.max(12, minDistance);
    const minDistSq = safeMinDist * safeMinDist;
    const maxCandidates = Math.max(16, maxPoints * 9);

    for (let attempt = 0; attempt < maxCandidates && accepted.length < maxPoints; attempt++) {
      // 聚集式径向分布：中心密度更高、边缘自然稀疏 (sqrt(u) * u^0.35)
      const angle = rng() * Math.PI * 2;
      const radialBias = Math.pow(rng(), 0.68);
      const r = radialBias * cluster.radius;
      // 添加小幅自然位置扰动
      const jitterX = (rng() - 0.5) * safeMinDist * 0.28;
      const jitterY = (rng() - 0.5) * safeMinDist * 0.28;
      const px = cluster.center.x + Math.cos(angle) * r + jitterX;
      const py = cluster.center.y + Math.sin(angle) * r * 0.45 + jitterY;

      let conflict = false;
      for (let i = 0; i < accepted.length; i++) {
        const dx = px - accepted[i].x;
        const dy = py - accepted[i].y;
        if (dx * dx + dy * dy < minDistSq) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        accepted.push({
          x: px,
          y: py,
          rNorm: radialBias,
          seed: Math.floor(rng() * 0x7fffffff),
        });
      }
    }

    return accepted;
  }

  /**
   * 根据环境场决定群落类型、半径与密度 (Section 4)
   */
  public generateClustersAndDecorationsForRange(
    startX: number,
    endX: number,
    referenceDepthY: number
  ): {
    clusters: EcologyCluster[];
    decorations: DecorationPropInstance[];
  } {
    const clusters: EcologyCluster[] = [];
    const decorations: DecorationPropInstance[] = [];

    const span = this.clusterCellSpan;
    const firstCell = Math.floor(startX / span);
    const lastCell = Math.floor(endX / span);

    for (let cellIdx = firstCell; cellIdx <= lastCell; cellIdx++) {
      const cellRng = this.worldGen.createSeededRng(cellIdx * 7919 + 104729);
      const centerX = (cellIdx + 0.16 + cellRng() * 0.68) * span;
      if (centerX < startX || centerX > endX) continue;

      const env = this.biomeMgr.sampleEnvironmentFields(centerX, referenceDepthY);
      const coralProb = this.worldGen.coralProbability(env);
      const grassProb = this.worldGen.seagrassProbability(env);
      const kelpProb = this.worldGen.kelpForestProbability(env);
      const biolumProb = this.worldGen.biolumProbability(env);

      // 根据环境场与宏观区域决定群落类型（而非无视环境纯随机抽取）
      let clusterType: EcologyClusterType = 'boulder_outcrop';
      let preferredPreyArchetype: EcologyCluster['preferredPreyArchetype'] = 'REEF_SWARM';

      if (env.depth > 1100) {
        clusterType = cellRng() < 0.58 ? 'hydrothermal_oasis' : 'biolum_grove';
        preferredPreyArchetype = 'ABYSS_APEX';
      } else if (biolumProb > 0.45 && env.depth > 520) {
        clusterType = 'biolum_grove';
        preferredPreyArchetype = 'BIOLUM_DRIFTER';
      } else if (env.biome === 'SANDY_OPEN_FLAT' && grassProb > 0.18) {
        clusterType = cellRng() < 0.72 ? 'seagrass_meadow' : 'coral_reef';
        preferredPreyArchetype = 'SAND_GRAZER';
      } else if (
        (env.biome === 'SUBMARINE_CANYON_DROP' || kelpProb > 0.18) &&
        cellRng() < 0.52
      ) {
        clusterType = 'kelp_forest';
        preferredPreyArchetype = 'CANYON_HUNTER';
      } else if (coralProb >= grassProb && coralProb > 0.18) {
        clusterType = 'coral_reef';
        preferredPreyArchetype = 'REEF_SWARM';
      } else if (grassProb > 0.2) {
        clusterType = 'seagrass_meadow';
        preferredPreyArchetype = 'SAND_GRAZER';
      } else if (kelpProb > 0.15) {
        clusterType = 'kelp_forest';
        preferredPreyArchetype = 'CANYON_HUNTER';
      }

      const radius = 120 + cellRng() * 145;
      const baseDensity =
        clusterType === 'coral_reef'
          ? 0.84
          : clusterType === 'seagrass_meadow'
          ? 0.88
          : clusterType === 'kelp_forest'
          ? 0.76
          : clusterType === 'biolum_grove'
          ? 0.8
          : 0.65;

      const cluster: EcologyCluster = {
        id: `cluster_${cellIdx}`,
        center: { x: centerX, y: env.depth },
        radius,
        type: clusterType,
        density: Number(Math.min(1, baseDensity).toFixed(2)),
        seed: Math.floor(cellRng() * 0x7fffffff),
        biome: env.biome,
        preferredPreyArchetype,
      };
      clusters.push(cluster);

      // 在群落内部执行 Poisson Disk Sampling 并按坡度/深度环境条件过滤对象
      const targetPoints = Math.max(3, Math.round(cluster.density * 5));
      const minSpacing = clusterType === 'seagrass_meadow' ? 38 : 54;
      const samples = this.samplePoissonDiskInCluster(cluster, minSpacing, targetPoints);

      for (let sIdx = 0; sIdx < samples.length; sIdx++) {
        const pt = samples[sIdx];
        const localEnv = this.biomeMgr.sampleEnvironmentFields(pt.x, pt.y);

        // 环境条件过滤：陡坡 (`slope > 0.72`) 不长海草，深渊不长浅海鹿角珊瑚
        if (clusterType === 'seagrass_meadow' && localEnv.slope > 0.72) {
          continue;
        }
        if (clusterType === 'coral_reef' && localEnv.depth > 620) {
          continue;
        }

        const propSpec = this.pickDecorationPropSpec(clusterType, pt.seed);
        decorations.push({
          id: `${cluster.id}_prop_${sIdx}`,
          clusterId: cluster.id,
          kind: propSpec.kind,
          x: pt.x,
          y: pt.y,
          scale: (0.72 + (1 - pt.rNorm * 0.45) * 0.48) * propSpec.baseScale,
          rotation: ((pt.seed % 100) / 100 - 0.5) * 0.22,
          swayPhase: (pt.seed % 628) / 100,
          tintHex: propSpec.tintHex,
          secondaryHex: propSpec.secondaryHex,
          lodPriority: sIdx < 2 ? 0 : sIdx < 4 ? 1 : 2,
        });
      }
    }

    return { clusters, decorations };
  }

  private pickDecorationPropSpec(
    clusterType: EcologyClusterType,
    seed: number
  ): {
    kind: DecorationPropKind;
    baseScale: number;
    tintHex: string;
    secondaryHex: string;
  } {
    const r = seed % 100;
    switch (clusterType) {
      case 'coral_reef':
        if (r < 42) {
          return {
            kind: 'STAGHORN_CORAL',
            baseScale: 0.88,
            tintHex: '#e11d48',
            secondaryHex: '#fda4af',
          };
        }
        if (r < 75) {
          return {
            kind: 'TUBE_SPONGE',
            baseScale: 0.82,
            tintHex: '#7e22ce',
            secondaryHex: '#d8b4fe',
          };
        }
        return {
          kind: 'BRAIN_CORAL',
          baseScale: 0.85,
          tintHex: '#d97706',
          secondaryHex: '#fde68a',
        };
      case 'seagrass_meadow':
        return {
          kind: 'SEAGRASS_TUFT',
          baseScale: 0.92,
          tintHex: '#059669',
          secondaryHex: '#6ee7b7',
        };
      case 'kelp_forest':
        return {
          kind: 'GIANT_KELP_STALK',
          baseScale: 1.05,
          tintHex: '#047857',
          secondaryHex: '#34d399',
        };
      case 'biolum_grove':
        return r < 58
          ? {
              kind: 'BIOLUM_SEA_WHIP',
              baseScale: 0.95,
              tintHex: '#0891b2',
              secondaryHex: '#67e8f9',
            }
          : {
              kind: 'GLOW_ANEMONE',
              baseScale: 0.88,
              tintHex: '#4f46e5',
              secondaryHex: '#c7d2fe',
            };
      case 'hydrothermal_oasis':
        return r < 62
          ? {
              kind: 'HYDROTHERMAL_BUBBLE_VENT',
              baseScale: 0.96,
              tintHex: '#ea580c',
              secondaryHex: '#fed7aa',
            }
          : {
              kind: 'ABYSSAL_CRYSTAL_SPIRE',
              baseScale: 0.92,
              tintHex: '#7e22ce',
              secondaryHex: '#e9d5ff',
            };
      default:
        return {
          kind: 'MOSSY_BOULDER',
          baseScale: 0.88,
          tintHex: '#334155',
          secondaryHex: '#94a3b8',
        };
    }
  }
}

// ============================================================================
// 6. 模块六：ChunkManager（屏外预生成、LRU 缓存与远端回收）
// ============================================================================

export class ChunkManager {
  public readonly chunkWidth: number = 1024;
  public readonly terrainSampleStep: number = 32;
  public readonly preloadRadiusChunks: number = 2;
  public readonly maxCachedChunks: number = 16;

  private readonly biomeMgr: BiomeManager;
  private readonly terrainGen: TerrainGenerator;
  private readonly structureGen: StructureGenerator;
  private readonly ecologyGen: EcologyGenerator;

  private readonly chunkCache: Map<number, WorldChunkData> = new Map();
  private lastDepthBandKey: number = 0;

  constructor(
    biomeMgr: BiomeManager,
    terrainGen: TerrainGenerator,
    structureGen: StructureGenerator,
    ecologyGen: EcologyGenerator
  ) {
    this.biomeMgr = biomeMgr;
    this.terrainGen = terrainGen;
    this.structureGen = structureGen;
    this.ecologyGen = ecologyGen;
  }

  public worldXToChunkIndex(worldX: number): number {
    return Math.floor(worldX / this.chunkWidth);
  }

  /**
   * 获取或即时生成指定 `chunkIndex` 的完整 Chunk 数据
   */
  public getOrGenerateChunk(
    chunkIndex: number,
    referenceDepthY: number = 260,
    nowMs: number = 0
  ): WorldChunkData {
    // 当玩家跨越大深度带（每 220m 一档）时刷新生态群落缓存以贴合当前深度场
    const depthBandKey = Math.floor(Math.max(0, referenceDepthY) / 220);
    if (depthBandKey !== this.lastDepthBandKey) {
      this.chunkCache.clear();
      this.lastDepthBandKey = depthBandKey;
    }

    const existing = this.chunkCache.get(chunkIndex);
    if (existing) {
      existing.lastAccessedTime = nowMs;
      return existing;
    }

    const startX = chunkIndex * this.chunkWidth;
    const endX = startX + this.chunkWidth;
    const centerX = startX + this.chunkWidth * 0.5;

    const macro = this.biomeMgr.evaluateMacroZone(centerX, referenceDepthY);
    const profiles = this.terrainGen.generateChunkTerrainProfiles(
      startX,
      endX,
      this.terrainSampleStep,
      referenceDepthY
    );
    const structures = this.structureGen.generateStructuresForRange(
      startX,
      endX,
      referenceDepthY
    );
    const { clusters, decorations } =
      this.ecologyGen.generateClustersAndDecorationsForRange(
        startX,
        endX,
        referenceDepthY
      );

    const chunk: WorldChunkData = {
      chunkIndex,
      startX,
      endX,
      width: this.chunkWidth,
      macroBiome: macro.primaryBiome,
      macroGeography: macro.macroGeography,
      terrainSampleStep: this.terrainSampleStep,
      heightSamples: profiles.heightSamples,
      midStratumSamples: profiles.midStratumSamples,
      farRidgeSamples: profiles.farRidgeSamples,
      slopeSamples: profiles.slopeSamples,
      structures,
      clusters,
      decorations,
      lastAccessedTime: nowMs,
    };

    this.chunkCache.set(chunkIndex, chunk);
    this.evictDistantChunks(chunkIndex);
    return chunk;
  }

  /**
   * 屏外预生成活跃区域 `[centerChunk - preloadRadius .. centerChunk + preloadRadius]` 并返回当前活跃 Chunk 列表
   */
  public updateActiveChunks(
    cameraX: number,
    referenceDepthY: number,
    nowMs: number = 0
  ): WorldChunkData[] {
    const centerChunk = this.worldXToChunkIndex(cameraX);
    const active: WorldChunkData[] = [];
    for (
      let c = centerChunk - this.preloadRadiusChunks;
      c <= centerChunk + this.preloadRadiusChunks;
      c++
    ) {
      active.push(this.getOrGenerateChunk(c, referenceDepthY, nowMs));
    }
    return active;
  }

  private evictDistantChunks(centerChunkIndex: number): void {
    if (this.chunkCache.size <= this.maxCachedChunks) return;
    for (const [idx] of this.chunkCache) {
      if (Math.abs(idx - centerChunkIndex) > this.preloadRadiusChunks + 3) {
        this.chunkCache.delete(idx);
      }
    }
  }

  public getCachedChunkCount(): number {
    return this.chunkCache.size;
  }
}

// ============================================================================
// 7. 模块七：DecorationRenderer（连续地形轮廓、L2 地貌结构与 L3 聚集生态 LOD 绘制器）
// ============================================================================

export class DecorationRenderer {
  /**
   * 采样任意全局坐标 `worldX` 处在活跃 Chunk 中的连续海床高度偏移 (px)
   * 相邻 Chunk 在边界 `startX / endX` 处共享完全一致的采样值，保证跨 Chunk 地形轮廓 100% 无缝连续。
   */
  public sampleContinuousSeabedOffsetPx(
    activeChunks: readonly WorldChunkData[],
    worldX: number,
    nearScale: number = 1.0,
    profileKind: 'NEAR' | 'MID' | 'FAR' = 'NEAR'
  ): number {
    for (let i = 0; i < activeChunks.length; i++) {
      const ch = activeChunks[i];
      if (worldX >= ch.startX && worldX <= ch.endX) {
        const relX = worldX - ch.startX;
        const exactIdx = relX / ch.terrainSampleStep;
        const idx0 = Math.max(0, Math.min(ch.heightSamples.length - 1, Math.floor(exactIdx)));
        const idx1 = Math.max(0, Math.min(ch.heightSamples.length - 1, idx0 + 1));
        const frac = exactIdx - idx0;
        const arr =
          profileKind === 'FAR'
            ? ch.farRidgeSamples
            : profileKind === 'MID'
            ? ch.midStratumSamples
            : ch.heightSamples;
        const rawVal = arr[idx0] * (1 - frac) + arr[idx1] * frac;
        const scaleFactor =
          profileKind === 'FAR' ? 0.14 : profileKind === 'MID' ? 0.12 : 0.085;
        return Math.max(-78, Math.min(78, rawVal * scaleFactor)) * nearScale;
      }
    }
    return 0;
  }

  /**
   * 绘制中景 L1 连续岩层/沙丘剖面与 L2 地貌结构（礁石通道拱门 REEF_ARCHWAY、跨边界 SDF 洞穴 CAVE_CHAMBER、
   * 浅海波纹沙丘 SAND_DUNE_RIDGE、海底峡谷阶梯岩壁 CONTINUOUS_CLIFF / CANYON_PILLAR、深渊热液烟囱 HYDROTHERMAL_MOUND）
   * 位于 Mid 图层与 Near 海床图层之间，形成强烈的立体纵深与地理探索节奏感。
   */
  public renderMidgroundStructuresAndStrata(
    ctx: CanvasRenderingContext2D,
    activeChunks: readonly WorldChunkData[],
    cameraX: number,
    depthRefY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    nearScale: number = 1.0,
    seabedCrestBaseY: number = viewH - 135
  ): void {
    if (activeChunks.length === 0) return;

    const parallaxX = 0.28;
    const effScale = Math.max(0.45, nearScale);
    const worldCenterAtScreenCenter = (cameraX * parallaxX) / effScale;
    const halfWorldSpan = (viewW * 0.72) / effScale;
    const minVisibleWorldX = worldCenterAtScreenCenter - halfWorldSpan;
    const maxVisibleWorldX = worldCenterAtScreenCenter + halfWorldSpan;

    const worldToScreenX = (wx: number): number =>
      viewW * 0.5 + (wx - worldCenterAtScreenCenter) * effScale;
    const screenToWorldX = (sx: number): number =>
      worldCenterAtScreenCenter + (sx - viewW * 0.5) / effScale;

    const isAbyss = depthRefY > 1100;
    const isTwilight = depthRefY > 520 && !isAbyss;
    const tSec = nowMs * 0.001;

    ctx.save();

    // 1. 绘制 L1 中景连续海底山脉/大陆坡/沙洲轮廓多边形 (Chunk 边界 100% 连续)
    const midBaseY = seabedCrestBaseY - 22 * effScale;
    ctx.beginPath();
    ctx.moveTo(-8, viewH + 16);
    const stepPx = 24;
    for (let sx = -8; sx <= viewW + stepPx; sx += stepPx) {
      const wx = screenToWorldX(sx);
      const contourH = this.sampleContinuousSeabedOffsetPx(
        activeChunks,
        wx,
        effScale,
        'MID'
      );
      const sy = midBaseY - contourH;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(viewW + 16, viewH + 16);
    ctx.closePath();

    const midGrad = ctx.createLinearGradient(0, midBaseY - 95 * effScale, 0, viewH);
    if (isAbyss) {
      midGrad.addColorStop(0, 'rgba(30, 27, 75, 0.45)');
      midGrad.addColorStop(0.6, 'rgba(17, 12, 36, 0.62)');
      midGrad.addColorStop(1, 'rgba(9, 7, 18, 0.78)');
    } else if (isTwilight) {
      midGrad.addColorStop(0, 'rgba(15, 38, 82, 0.38)');
      midGrad.addColorStop(0.6, 'rgba(12, 25, 58, 0.55)');
      midGrad.addColorStop(1, 'rgba(8, 16, 38, 0.72)');
    } else {
      midGrad.addColorStop(0, 'rgba(12, 108, 152, 0.32)');
      midGrad.addColorStop(0.55, 'rgba(14, 86, 128, 0.48)');
      midGrad.addColorStop(1, 'rgba(8, 52, 86, 0.66)');
    }
    ctx.fillStyle = midGrad;
    ctx.fill();

    // 中景山脊高光轮廓线
    ctx.strokeStyle = isAbyss
      ? 'rgba(249, 115, 22, 0.28)'
      : isTwilight
      ? 'rgba(56, 189, 248, 0.26)'
      : 'rgba(125, 211, 252, 0.34)';
    ctx.lineWidth = 1.8 * effScale;
    ctx.stroke();

    // 2. 绘制 L2 宏观地貌结构（Voronoi + 规则模板生成）
    const renderedStructIds = new Set<string>();
    for (let cIdx = 0; cIdx < activeChunks.length; cIdx++) {
      const chunk = activeChunks[cIdx];
      for (let sIdx = 0; sIdx < chunk.structures.length; sIdx++) {
        const st = chunk.structures[sIdx];
        if (renderedStructIds.has(st.id)) continue;
        if (
          st.centerX + st.width < minVisibleWorldX ||
          st.centerX - st.width > maxVisibleWorldX
        ) {
          continue;
        }
        renderedStructIds.add(st.id);

        const sx = worldToScreenX(st.centerX);
        const localContourH = this.sampleContinuousSeabedOffsetPx(
          activeChunks,
          st.centerX,
          effScale,
          'MID'
        );
        const sy = midBaseY - localContourH + 18 * effScale;
        const sw = st.width * effScale * 0.74;
        const sh = st.height * effScale * 0.72;

        ctx.save();
        if (st.kind === 'SAND_DUNE_RIDGE') {
          // 浅海开阔区波纹沙丘 (SANDY_OPEN_FLAT)
          const duneGrad = ctx.createLinearGradient(sx, sy - sh, sx, sy + 28);
          duneGrad.addColorStop(0, isAbyss ? 'rgba(68, 52, 88, 0.48)' : isTwilight ? 'rgba(30, 88, 138, 0.45)' : 'rgba(251, 191, 36, 0.44)');
          duneGrad.addColorStop(1, isAbyss ? 'rgba(24, 16, 38, 0.68)' : isTwilight ? 'rgba(15, 42, 78, 0.64)' : 'rgba(180, 120, 28, 0.58)');
          ctx.fillStyle = duneGrad;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.65, sy + 24);
          ctx.quadraticCurveTo(sx - sw * 0.18, sy - sh * 1.05, sx + sw * 0.08, sy - sh * 0.75);
          ctx.quadraticCurveTo(sx + sw * 0.38, sy - sh * 0.42, sx + sw * 0.65, sy + 24);
          ctx.closePath();
          ctx.fill();

          // 沙丘阳光波纹脊线
          ctx.strokeStyle = isTwilight ? 'rgba(103, 232, 249, 0.32)' : 'rgba(254, 240, 138, 0.46)';
          ctx.lineWidth = 1.8 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.48, sy + 8);
          ctx.quadraticCurveTo(sx - sw * 0.12, sy - sh * 0.88, sx + sw * 0.42, sy + 6);
          ctx.stroke();
        } else if (st.kind === 'CAVE_CHAMBER' || st.kind === 'REEF_ARCHWAY') {
          // 天然礁石拱门 (REEF_ARCHWAY) 与跨边界 SDF 岩洞腔体 (CAVE_CHAMBER)
          const rockGrad = ctx.createLinearGradient(sx, sy - sh, sx, sy + 30);
          if (isAbyss) {
            rockGrad.addColorStop(0, 'rgba(49, 46, 129, 0.62)');
            rockGrad.addColorStop(1, 'rgba(15, 11, 29, 0.78)');
          } else if (isTwilight) {
            rockGrad.addColorStop(0, 'rgba(30, 58, 138, 0.56)');
            rockGrad.addColorStop(1, 'rgba(15, 23, 42, 0.74)');
          } else {
            rockGrad.addColorStop(0, 'rgba(14, 116, 144, 0.52)');
            rockGrad.addColorStop(0.5, 'rgba(15, 82, 118, 0.64)');
            rockGrad.addColorStop(1, 'rgba(12, 48, 76, 0.76)');
          }
          ctx.fillStyle = rockGrad;

          const archW = sw * 0.3;
          const archH = sh * 0.58;

          ctx.beginPath();
          // 外层自然层叠岩拱轮廓
          ctx.moveTo(sx - sw * 0.56, sy + 32);
          ctx.lineTo(sx - sw * 0.46, sy - sh * 0.48);
          ctx.quadraticCurveTo(sx - sw * 0.24, sy - sh * 1.04, sx, sy - sh * 0.98);
          ctx.quadraticCurveTo(sx + sw * 0.26, sy - sh * 1.02, sx + sw * 0.46, sy - sh * 0.44);
          ctx.lineTo(sx + sw * 0.56, sy + 32);
          ctx.closePath();

          // 内层拱洞镂空通道 (evenodd)
          ctx.moveTo(sx - archW, sy + 28);
          ctx.quadraticCurveTo(sx - archW * 0.85, sy - archH, sx, sy - archH * 1.06);
          ctx.quadraticCurveTo(sx + archW * 0.85, sy - archH, sx + archW, sy + 28);
          ctx.closePath();
          ctx.fill('evenodd');

          // 拱门顶部受光边缘高光
          ctx.strokeStyle = isAbyss
            ? 'rgba(251, 146, 60, 0.36)'
            : isTwilight
            ? 'rgba(34, 211, 238, 0.34)'
            : 'rgba(125, 211, 252, 0.44)';
          ctx.lineWidth = 2.0 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.44, sy - sh * 0.46);
          ctx.quadraticCurveTo(sx, sy - sh * 1.02, sx + sw * 0.44, sy - sh * 0.42);
          ctx.stroke();
        } else if (st.kind === 'HYDROTHERMAL_MOUND') {
          // 深渊热液黑烟囱岩冢 (HYDROTHERMAL_MOUND)
          ctx.fillStyle = 'rgba(24, 16, 36, 0.78)';
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.42, sy + 28);
          ctx.lineTo(sx - sw * 0.18, sy - sh * 0.96);
          ctx.lineTo(sx + sw * 0.16, sy - sh * 0.92);
          ctx.lineTo(sx + sw * 0.42, sy + 28);
          ctx.closePath();
          ctx.fill();

          // 熔岩裂缝发光脉络
          const pulse = 0.65 + 0.35 * Math.sin(tSec * 2.6 + st.seed);
          ctx.strokeStyle = `rgba(251, 146, 60, ${(0.58 * pulse).toFixed(2)})`;
          ctx.lineWidth = 2.2 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.06, sy - sh * 0.9);
          ctx.lineTo(sx + sw * 0.04, sy - sh * 0.45);
          ctx.lineTo(sx - sw * 0.08, sy + 4);
          ctx.stroke();
        } else {
          // 海底峡谷阶梯岩壁 / 峡谷石柱 (CONTINUOUS_CLIFF / CANYON_PILLAR)
          ctx.fillStyle = isAbyss
            ? 'rgba(30, 27, 75, 0.64)'
            : isTwilight
            ? 'rgba(23, 37, 84, 0.58)'
            : 'rgba(14, 94, 132, 0.52)';
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.45, sy + 28);
          ctx.lineTo(sx - sw * 0.36, sy - sh * 0.48);
          ctx.lineTo(sx - sw * 0.22, sy - sh * 0.52);
          ctx.lineTo(sx - sw * 0.14, sy - sh);
          ctx.lineTo(sx + sw * 0.18, sy - sh * 0.94);
          ctx.lineTo(sx + sw * 0.28, sy - sh * 0.46);
          ctx.lineTo(sx + sw * 0.45, sy + 28);
          ctx.closePath();
          ctx.fill();

          // 岩壁水平沉积岩层线
          ctx.strokeStyle = isTwilight
            ? 'rgba(56, 189, 248, 0.28)'
            : 'rgba(125, 211, 252, 0.34)';
          ctx.lineWidth = 1.6 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.34, sy - sh * 0.48);
          ctx.lineTo(sx + sw * 0.26, sy - sh * 0.46);
          ctx.moveTo(sx - sw * 0.14, sy - sh);
          ctx.lineTo(sx + sw * 0.18, sy - sh * 0.94);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * 绘制前景 L1 连续海床轮廓与 L3 Poisson Disk 聚集式生态群落装饰（带 3 级 LOD 裁剪）
   */
  public renderProceduralWorldOverlay(
    ctx: CanvasRenderingContext2D,
    activeChunks: readonly WorldChunkData[],
    cameraX: number,
    depthRefY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    nearScale: number = 1.0,
    seabedBaseOffsetY: number = 0,
    nearPlaneTargetH: number = 180
  ): void {
    if (activeChunks.length === 0) return;

    const parallaxX = 0.38;
    const effScale = Math.max(0.45, nearScale);
    const worldCenterAtScreenCenter = (cameraX * parallaxX) / effScale;
    const halfWorldSpan = (viewW * 0.68) / effScale;
    const minVisibleWorldX = worldCenterAtScreenCenter - halfWorldSpan;
    const maxVisibleWorldX = worldCenterAtScreenCenter + halfWorldSpan;

    const worldToScreenX = (wx: number): number =>
      viewW * 0.5 + (wx - worldCenterAtScreenCenter) * effScale;
    const screenToWorldX = (sx: number): number =>
      worldCenterAtScreenCenter + (sx - viewW * 0.5) / effScale;

    // 关键锚点：海床基准线位于屏幕下方海床表面的真实视觉脊线处（距屏幕底边约 44% nearPlaneTargetH）
    const visibleSeabedCrestY = Math.min(
      viewH - 28 * effScale,
      viewH - nearPlaneTargetH * 0.44 + seabedBaseOffsetY * 0.45
    );
    const isAbyss = depthRefY > 1100;
    const isTwilight = depthRefY > 520 && !isAbyss;
    const tSec = nowMs * 0.001;

    ctx.save();

    // 1. 绘制前景 L1 连续起伏海床表面层与发光/阳光沙脊边缘线
    ctx.beginPath();
    ctx.moveTo(-8, viewH + 16);
    const stepPx = 20;
    for (let sx = -8; sx <= viewW + stepPx; sx += stepPx) {
      const wx = screenToWorldX(sx);
      const localH = this.sampleContinuousSeabedOffsetPx(
        activeChunks,
        wx,
        effScale,
        'NEAR'
      );
      const sy = visibleSeabedCrestY - localH;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(viewW + 16, viewH + 16);
    ctx.closePath();

    const nearFloorGrad = ctx.createLinearGradient(
      0,
      visibleSeabedCrestY - 50 * effScale,
      0,
      viewH
    );
    if (isAbyss) {
      nearFloorGrad.addColorStop(0, 'rgba(59, 24, 56, 0.24)');
      nearFloorGrad.addColorStop(0.5, 'rgba(24, 11, 32, 0.36)');
      nearFloorGrad.addColorStop(1, 'rgba(9, 5, 15, 0.52)');
    } else if (isTwilight) {
      nearFloorGrad.addColorStop(0, 'rgba(14, 58, 104, 0.22)');
      nearFloorGrad.addColorStop(0.5, 'rgba(10, 32, 68, 0.34)');
      nearFloorGrad.addColorStop(1, 'rgba(6, 16, 38, 0.48)');
    } else {
      nearFloorGrad.addColorStop(0, 'rgba(245, 188, 72, 0.20)');
      nearFloorGrad.addColorStop(0.45, 'rgba(180, 124, 42, 0.28)');
      nearFloorGrad.addColorStop(1, 'rgba(18, 62, 88, 0.44)');
    }
    ctx.fillStyle = nearFloorGrad;
    ctx.fill();

    // 海床顶部连续受光脊线
    ctx.strokeStyle = isAbyss
      ? 'rgba(251, 146, 60, 0.38)'
      : isTwilight
      ? 'rgba(34, 211, 238, 0.36)'
      : 'rgba(254, 240, 138, 0.42)';
    ctx.lineWidth = 2.0 * effScale;
    ctx.stroke();

    // 2. 绘制 L3 Poisson Disk 聚集式生态群落装饰（按离屏幕中心距离自动分级 LOD0 / LOD1 / LOD2）
    for (let cIdx = 0; cIdx < activeChunks.length; cIdx++) {
      const chunk = activeChunks[cIdx];
      for (let dIdx = 0; dIdx < chunk.decorations.length; dIdx++) {
        const prop = chunk.decorations[dIdx];
        if (prop.x < minVisibleWorldX || prop.x > maxVisibleWorldX) continue;

        const sx = worldToScreenX(prop.x);
        const distFromCenterRatio = Math.abs(sx - viewW * 0.5) / Math.max(1, viewW * 0.5);

        // LOD 裁剪：边缘区域 (>88% 半屏宽) 仅绘制 LOD0/LOD1 主景，略过 LOD2 微细节
        if (distFromCenterRatio > 0.88 && prop.lodPriority === 2) continue;
        if (distFromCenterRatio > 1.12 && prop.lodPriority >= 1) continue;

        const localH = this.sampleContinuousSeabedOffsetPx(
          activeChunks,
          prop.x,
          effScale,
          'NEAR'
        );
        // 在群落内部赋予轻微的前后纵深层次错落 (-8px .. +22px)
        const depthJitterY = (((prop.swayPhase * 100) % 30) - 8) * effScale;
        const sy = visibleSeabedCrestY - localH + depthJitterY;
        const drawScale = prop.scale * effScale;
        const sway = Math.sin(tSec * 2.1 + prop.swayPhase) * 8 * drawScale;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(prop.rotation);

        // 根部海床环境闭塞柔和阴影 (Ambient Occlusion Ground Shadow)
        ctx.fillStyle = 'rgba(6, 21, 40, 0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 4 * drawScale, 14 * drawScale, 4.2 * drawScale, 0, 0, Math.PI * 2);
        ctx.fill();

        switch (prop.kind) {
          case 'SEAGRASS_TUFT':
          case 'GIANT_KELP_STALK': {
            const isKelp = prop.kind === 'GIANT_KELP_STALK';
            const bladeCount = isKelp ? 3 : 4;
            const bladeH = (isKelp ? 76 : 36) * drawScale;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.78;
            const bladeGrad = ctx.createLinearGradient(0, 4 * drawScale, 0, -bladeH);
            bladeGrad.addColorStop(0, '#064e3b');
            bladeGrad.addColorStop(0.55, prop.tintHex);
            bladeGrad.addColorStop(1, prop.secondaryHex);

            for (let b = 0; b < bladeCount; b++) {
              const bx = (b - (bladeCount - 1) * 0.5) * (isKelp ? 7.5 : 5.0) * drawScale;
              const bH = bladeH * (0.76 + (b % 2) * 0.24);
              const tipX = bx + sway * (0.85 + b * 0.12);
              ctx.strokeStyle = bladeGrad;
              ctx.lineWidth = Math.max(2.0, (isKelp ? 3.8 : 2.6) * drawScale);
              ctx.beginPath();
              ctx.moveTo(bx, 5 * drawScale);
              ctx.quadraticCurveTo(bx + sway * 0.45, -bH * 0.52, tipX, -bH);
              ctx.stroke();

              // 巨藻叶片细节
              if (isKelp) {
                ctx.fillStyle = bladeGrad;
                for (let lf = 1; lf <= 3; lf++) {
                  const ly = -bH * (lf * 0.26);
                  const lx = bx + sway * (lf * 0.25);
                  const dir = lf % 2 === 0 ? 1 : -1;
                  ctx.beginPath();
                  ctx.ellipse(
                    lx + dir * 6 * drawScale,
                    ly,
                    6.5 * drawScale,
                    2.8 * drawScale,
                    dir * 0.45,
                    0,
                    Math.PI * 2
                  );
                  ctx.fill();
                }
              }
            }
            break;
          }
          case 'STAGHORN_CORAL':
          case 'BIOLUM_SEA_WHIP': {
            const isBiolum = prop.kind === 'BIOLUM_SEA_WHIP';
            const branchH = (isBiolum ? 54 : 42) * drawScale;
            ctx.lineCap = 'round';
            ctx.globalAlpha = isBiolum ? 0.84 : 0.76;

            const coralGrad = ctx.createLinearGradient(0, 6 * drawScale, 0, -branchH);
            coralGrad.addColorStop(0, isBiolum ? '#164e63' : '#881337');
            coralGrad.addColorStop(0.6, prop.tintHex);
            coralGrad.addColorStop(1, prop.secondaryHex);

            ctx.strokeStyle = coralGrad;
            ctx.lineWidth = Math.max(2.4, 4.2 * drawScale);
            ctx.beginPath();
            ctx.moveTo(0, 5 * drawScale);
            ctx.quadraticCurveTo(sway * 0.35, -branchH * 0.5, sway * 0.65, -branchH);
            ctx.moveTo(sway * 0.18, -branchH * 0.32);
            ctx.quadraticCurveTo(
              -10 * drawScale + sway * 0.3,
              -branchH * 0.58,
              -15 * drawScale + sway * 0.45,
              -branchH * 0.82
            );
            ctx.moveTo(sway * 0.28, -branchH * 0.48);
            ctx.quadraticCurveTo(
              10 * drawScale + sway * 0.4,
              -branchH * 0.68,
              16 * drawScale + sway * 0.55,
              -branchH * 0.88
            );
            ctx.stroke();

            // 珊瑚/发光海鞭顶端荧光生长点
            ctx.fillStyle = prop.secondaryHex;
            const tips = [
              { x: sway * 0.65, y: -branchH },
              { x: -15 * drawScale + sway * 0.45, y: -branchH * 0.82 },
              { x: 16 * drawScale + sway * 0.55, y: -branchH * 0.88 },
            ];
            for (const tip of tips) {
              ctx.beginPath();
              ctx.arc(tip.x, tip.y, (isBiolum ? 3.4 : 2.6) * drawScale, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          case 'TUBE_SPONGE': {
            ctx.globalAlpha = 0.76;
            const tubes = [
              { dx: -7.5 * drawScale, h: 28 * drawScale, w: 6.5 * drawScale },
              { dx: 0, h: 36 * drawScale, w: 7.5 * drawScale },
              { dx: 7.5 * drawScale, h: 24 * drawScale, w: 6.0 * drawScale },
            ];
            for (const tb of tubes) {
              const tubeGrad = ctx.createLinearGradient(tb.dx, 4 * drawScale, tb.dx, -tb.h);
              tubeGrad.addColorStop(0, '#3b0764');
              tubeGrad.addColorStop(0.65, prop.tintHex);
              tubeGrad.addColorStop(1, prop.secondaryHex);
              ctx.fillStyle = tubeGrad;
              ctx.beginPath();
              ctx.roundRect(tb.dx - tb.w * 0.5, -tb.h, tb.w, tb.h + 5 * drawScale, 3.5 * drawScale);
              ctx.fill();
              ctx.fillStyle = '#2e1065';
              ctx.beginPath();
              ctx.ellipse(tb.dx, -tb.h, tb.w * 0.36, 1.8 * drawScale, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          case 'BRAIN_CORAL':
          case 'GLOW_ANEMONE': {
            const rad = 15 * drawScale;
            ctx.globalAlpha = 0.78;
            const domeGrad = ctx.createRadialGradient(
              -rad * 0.2,
              -rad * 0.45,
              rad * 0.15,
              0,
              0,
              rad
            );
            domeGrad.addColorStop(0, prop.secondaryHex);
            domeGrad.addColorStop(0.65, prop.tintHex);
            domeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
            ctx.fillStyle = domeGrad;
            ctx.beginPath();
            ctx.arc(0, 2 * drawScale, rad, Math.PI, 0);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = prop.secondaryHex;
            ctx.lineWidth = 1.6 * drawScale;
            ctx.beginPath();
            ctx.arc(0, 2 * drawScale, rad * 0.65, Math.PI * 1.15, -Math.PI * 0.15);
            ctx.stroke();
            break;
          }
          case 'ABYSSAL_CRYSTAL_SPIRE': {
            ctx.globalAlpha = 0.82;
            const spires = [
              { dx: -8 * drawScale, h: 30 * drawScale, w: 6 * drawScale, tilt: -0.18 },
              { dx: 0, h: 44 * drawScale, w: 7.5 * drawScale, tilt: 0.04 },
              { dx: 8 * drawScale, h: 26 * drawScale, w: 5.5 * drawScale, tilt: 0.2 },
            ];
            for (const sp of spires) {
              ctx.save();
              ctx.translate(sp.dx, 4 * drawScale);
              ctx.rotate(sp.tilt);
              ctx.fillStyle = prop.tintHex;
              ctx.beginPath();
              ctx.moveTo(-sp.w, 0);
              ctx.lineTo(0, -sp.h);
              ctx.lineTo(sp.w, 0);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = prop.secondaryHex;
              ctx.lineWidth = 1.4 * drawScale;
              ctx.stroke();
              ctx.restore();
            }
            break;
          }
          case 'HYDROTHERMAL_BUBBLE_VENT': {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.moveTo(-14 * drawScale, 6 * drawScale);
            ctx.lineTo(-6 * drawScale, -18 * drawScale);
            ctx.lineTo(6 * drawScale, -18 * drawScale);
            ctx.lineTo(14 * drawScale, 6 * drawScale);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = prop.tintHex;
            const rise = ((nowMs * 0.045 + prop.swayPhase * 36) % 64) * drawScale;
            ctx.beginPath();
            ctx.arc(sway * 0.3, -22 * drawScale - rise, 4.2 * drawScale, 0, Math.PI * 2);
            ctx.arc(
              -5 * drawScale - sway * 0.25,
              -36 * drawScale - rise * 0.75,
              3.1 * drawScale,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          }
          default: {
            // MOSSY_BOULDER
            ctx.globalAlpha = 0.84;
            ctx.fillStyle = prop.tintHex;
            ctx.beginPath();
            ctx.ellipse(0, 0, 18 * drawScale, 12 * drawScale, 0, Math.PI, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = prop.secondaryHex;
            ctx.lineWidth = 2 * drawScale;
            ctx.stroke();
            break;
          }
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }
}

// ============================================================================
// 8. 模块八：WorldStateManager（玩家探索足迹、活跃区域状态与存档管理）
// ============================================================================

export interface ProceduralWorldSaveState {
  worldSeed: number;
  discoveredBiomes: ExplorationZoneType[];
  visitedChunkCount: number;
  interactedClusterIds: string[];
}

export class WorldStateManager {
  public worldSeed: number;
  public readonly discoveredBiomes: Set<ExplorationZoneType> = new Set([
    'SHALLOW_CORAL_REEF',
  ]);
  public readonly visitedChunks: Set<number> = new Set([0]);
  public readonly interactedClusterIds: Set<string> = new Set();
  public activeMacroZone: ExplorationZoneType = 'SHALLOW_CORAL_REEF';
  public activeMacroGeography: MacroGeographyType = 'CORAL_REEF_BELT';

  constructor(worldSeed: number = 20261110) {
    this.worldSeed = worldSeed;
  }

  public recordPlayerExploration(
    worldX: number,
    worldY: number,
    chunkIndex: number,
    biomeEval: MacroZoneEvaluation
  ): void {
    this.visitedChunks.add(chunkIndex);
    this.discoveredBiomes.add(biomeEval.primaryBiome);
    this.activeMacroZone = biomeEval.primaryBiome;
    this.activeMacroGeography = biomeEval.macroGeography;
    if (this.visitedChunks.size > 512) {
      const first = this.visitedChunks.values().next().value;
      if (typeof first === 'number') {
        this.visitedChunks.delete(first);
      }
    }
  }

  public markClusterInteracted(clusterId: string): void {
    this.interactedClusterIds.add(clusterId);
  }

  public serialize(): ProceduralWorldSaveState {
    return {
      worldSeed: this.worldSeed,
      discoveredBiomes: Array.from(this.discoveredBiomes),
      visitedChunkCount: this.visitedChunks.size,
      interactedClusterIds: Array.from(this.interactedClusterIds).slice(-64),
    };
  }
}

// ============================================================================
// 9. 统一门面与单例导出 (ProceduralOceanWorldSystem)
// ============================================================================

export class ProceduralOceanWorldSystem {
  public readonly worldGenerator: WorldGenerator;
  public readonly biomeManager: BiomeManager;
  public readonly terrainGenerator: TerrainGenerator;
  public readonly structureGenerator: StructureGenerator;
  public readonly ecologyGenerator: EcologyGenerator;
  public readonly chunkManager: ChunkManager;
  public readonly decorationRenderer: DecorationRenderer;
  public readonly worldStateManager: WorldStateManager;

  constructor(seed: number = 20261110) {
    this.worldGenerator = new WorldGenerator(seed);
    this.biomeManager = new BiomeManager(this.worldGenerator);
    this.terrainGenerator = new TerrainGenerator(
      this.worldGenerator,
      this.biomeManager
    );
    this.structureGenerator = new StructureGenerator(
      this.worldGenerator,
      this.biomeManager
    );
    this.ecologyGenerator = new EcologyGenerator(
      this.worldGenerator,
      this.biomeManager
    );
    this.chunkManager = new ChunkManager(
      this.biomeManager,
      this.terrainGenerator,
      this.structureGenerator,
      this.ecologyGenerator
    );
    this.decorationRenderer = new DecorationRenderer();
    this.worldStateManager = new WorldStateManager(seed);
  }

  /**
   * 鲨鱼探索帧更新：更新活跃 Chunk、记录探索足迹并返回当前位置的环境场、宏观 Biome 平滑混合权重与统一深度视觉 Profile
   */
  public stepExploration(
    cameraX: number,
    sharkY: number,
    nowMs: number = 0
  ): {
    activeChunks: WorldChunkData[];
    environment: TerrainEnvironmentFields;
    terrainModulation: ReturnType<TerrainGenerator['sampleParallaxTerrainModulation']>;
    biomeSample: BiomeSampleResult;
    depthVisualProfile: DepthVisualProfile;
  } {
    const activeChunks = this.chunkManager.updateActiveChunks(
      cameraX,
      sharkY,
      nowMs
    );
    const environment = this.biomeManager.sampleEnvironmentFields(
      cameraX,
      sharkY
    );
    const terrainModulation =
      this.terrainGenerator.sampleParallaxTerrainModulation(cameraX, sharkY);
    const worldCoords = engineCoordToWorldCoord(cameraX, sharkY);
    const biomeSample = getBiomeAt(worldCoords.worldX, worldCoords.worldY, WorldConfig);
    const depthVisualProfile = getDepthVisualProfile(worldCoords.worldY, WorldConfig);
    const chunkIdx = this.chunkManager.worldXToChunkIndex(cameraX);
    this.worldStateManager.recordPlayerExploration(
      cameraX,
      sharkY,
      chunkIdx,
      terrainModulation.macroZone
    );

    return {
      activeChunks,
      environment,
      terrainModulation,
      biomeSample,
      depthVisualProfile,
    };
  }
}

export const proceduralOceanWorld = new ProceduralOceanWorldSystem(20261110);

