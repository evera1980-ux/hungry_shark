/**
 * 海底程序化世界生成系统 (Procedural Ocean World Generation System)
 * 严格遵循《无限横向海洋地图：程序化生成与开发实施规范 v1.0》分阶段架构（阶段 A -> G）
 * 以及「宏观规划 (L0) + 连续地形生成 (L1) + 地貌结构模板/SDF (L2) + 聚集式 Poisson Disk 生态群落与细节 (L3) + 游戏性约束」。
 */

import {
  quinticSmoothstep,
  DEPTH_MAPPING_STOPS,
  meterDepthToWorldY,
  worldYToMeterDepth,
} from '../rules';

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
  chunk: { width: 3000, height: 1500, preloadAhead: 4, retainBehind: 2, maxActiveChunks: 20 },
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
    maxQueueSize: 48,
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
 * 规范第 2 节：适配层坐标转换与 5 大生态深度带非线性拟合
 * 游戏内核心玩法世界高度为 20,000px（0px ~ 20,000px），对应真实海洋 0m ~ 11,000m（马里亚纳海沟挑战者深渊）。
 * 坐标系中 engineX 与 worldX 为 1:1 物理像素；engineY 与 worldY 为 1:1 物理像素。
 * 真实海洋水深 (m) 与世界像素坐标 (worldY) 通过 rules.ts 的 DEPTH_MAPPING_STOPS 进行分段拟合。
 */
export const WORLD_UNITS_PER_METER = 1;

export {
  DEPTH_MAPPING_STOPS,
  meterDepthToWorldY,
  worldYToMeterDepth,
};

export function engineXToWorldX(engineX: number): number {
  return engineX;
}

export function worldXToEngineX(worldX: number): number {
  return worldX;
}

export function engineYToWorldY(engineY: number): number {
  return engineY;
}

export function worldYToEngineY(worldY: number): number {
  return worldY;
}

export function engineCoordToWorldCoord(
  engineX: number,
  engineY: number
): { worldX: number; worldY: number } {
  return {
    worldX: engineX,
    worldY: engineY,
  };
}

export function worldCoordToEngineCoord(
  worldX: number,
  worldY: number
): { engineX: number; engineY: number } {
  return {
    engineX: worldX,
    engineY: worldY,
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
