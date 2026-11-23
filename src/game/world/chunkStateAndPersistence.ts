import {
  WorldConfig,
  WorldConfigType,
  formatChunkId,
  clampWorldDepth,
  getVisibleChunkRange,
} from './worldCore';
import {
  BiomeId,
  BIOME_IDS,
} from './biomeSystem';
import {
  EcologyObjectType,
  POI_TYPES,
  ECOLOGY_OBJECT_CONFIGS,
  GeneratedObject,
  GeneratedPOI,
  GeneratedChunkData,
} from './ecologyAndPoi';

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

export function hashToUint32(input: string): number {
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

