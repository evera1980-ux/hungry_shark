import {
  WorldConfig,
  WorldConfigType,
  formatChunkId,
} from './worldCore';
import {
  GeneratedChunkData,
  generateChunk,
} from './ecologyAndPoi';
import {
  ChunkLifecycleState,
  WorldObjectPool,
  worldObjectPool,
  DesiredChunkWindow,
  getDesiredChunkWindow,
  ChunkLifecycleRecord,
  transitionChunkState,
  PerformanceDegradationLevel,
  PerformanceDegradationController,
  performanceDegradationController,
  WorldPersistence,
  worldPersistence,
} from './chunkStateAndPersistence';

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

