/**
 * 模块 B：生态鱼群智能刷新与回收池 (EcosystemSpawner.ts)
 * 解决“深海鱼吃完不刷新”的问题。利用对象池与视口裁剪，鱼被吃掉或游出屏幕后会自动回收，
 * 并在视野外随机重生，且随着游戏时间推移，鱼群会自动变强（Infinite Scaling: scaleMultiplier = 1.0 + gameTime * 0.01）。
 */

import { GAME_CONFIG, PreyTierConfig } from './config';
import { PreyEntity } from './canvasRenderer';
import { infiniteWorldManager } from './infiniteWorldManager';
import { infiniteProgressionManager } from './infiniteProgressionManager';

export class EcosystemSpawner {
  /**
   * 同屏最大鱼数量
   */
  public maxActivePreys: number = 50;

  /**
   * 在距离玩家多远的外围生成 (minSpawnRadius ~ spawnRadius)
   */
  public spawnRadius: number = 1500;

  /**
   * 视野外生成的内圈最小半径
   */
  public minSpawnRadius: number = 800;

  /**
   * 累计游戏时长（秒），驱动无限数值膨胀 (Infinite Scaling)
   */
  public gameTime: number = 0;

  /**
   * 猎物对象回收池（避免频繁 GC 分配）
   */
  private pool: PreyEntity[] = [];
  private nextUid: number = 1;

  /**
   * 群居小鱼（SCHOOL_FLEE）成簇结队生成锚点，让小丑鱼/霓虹灯鱼/沙丁鱼等自动排成 3~4 条的小鱼群
   */
  private schoolClusterAnchor: {
    config: PreyTierConfig;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    remainingMates: number;
  } | null = null;

  constructor(
    maxActivePreys: number = 50,
    spawnRadius: number = 1500,
    minSpawnRadius: number = 540
  ) {
    this.maxActivePreys = maxActivePreys;
    this.spawnRadius = spawnRadius;
    this.minSpawnRadius = Math.min(minSpawnRadius, Math.floor(spawnRadius * 0.6));
  }

  /**
   * 重置生态计时器并回收现有鱼群至对象池
   */
  public reset(activePreys?: PreyEntity[]): void {
    this.gameTime = 0;
    this.schoolClusterAnchor = null;
    if (activePreys) {
      while (activePreys.length > 0) {
        const p = activePreys.pop();
        if (p) this.pool.push(p);
      }
    }
  }

  /**
   * 【核心创新】计算当前游戏时长对应的无限变强倍率（前 50s 线性成长，50s 后平滑收敛至 1.65x 软上限，防止小鱼视觉体型超过高阶巨鲨）
   */
  public getScaleMultiplier(): number {
    if (this.gameTime <= 50) {
      return Number((1.0 + this.gameTime * 0.01).toFixed(4));
    }
    const extra = Math.min(0.15, (this.gameTime - 50) * 0.0012);
    return Number((1.5 + extra).toFixed(4));
  }

  /**
   * 将被吞噬或销毁的鱼回收到对象池，并立即在视野外补充一条新鱼
   */
  public recycleAndRespawn(
    activePreys: PreyEntity[],
    index: number,
    sharkX: number,
    sharkY: number,
    rng: () => number = Math.random,
    currentScore: number = 0
  ): PreyEntity {
    const [removed] = activePreys.splice(index, 1);
    if (removed) {
      this.pool.push(removed);
    }
    return this.spawnPreyOffScreen(activePreys, sharkX, sharkY, rng, undefined, currentScore);
  }

  /**
   * 每帧更新：
   * 1. 累加 gameTime
   * 2. 清理距离玩家过远（distance > spawnRadius * 1.5）的鱼并回收到对象池
   * 3. 维持同屏鱼群数量达到 maxActivePreys
   */
  public update(
    deltaTime: number,
    activePreys: PreyEntity[],
    sharkX: number,
    sharkY: number,
    rng: () => number = Math.random,
    currentScore: number = 0
  ): void {
    this.gameTime += Math.max(0, deltaTime);

    // 1. 清理距离玩家过远（超出视野 spawnRadius * 1.5）的鱼并回收重置
    const cullThreshold = this.spawnRadius * 1.5;
    for (let i = activePreys.length - 1; i >= 0; i--) {
      const prey = activePreys[i];
      const dx = infiniteWorldManager.getShortestDeltaX(sharkX, prey.x);
      const dy = prey.y - sharkY;
      const dist = Math.hypot(dx, dy);

      if (dist > cullThreshold) {
        activePreys.splice(i, 1);
        this.pool.push(prey);
      }
    }

    // 2. 维持同屏鱼群数量 (补齐至 maxActivePreys)
    while (activePreys.length < this.maxActivePreys) {
      this.spawnPreyOffScreen(activePreys, sharkX, sharkY, rng, undefined, currentScore);
    }
  }

  /**
   * 在鲨鱼视野外黄金狩猎环 (minSpawnRadius ~ spawnRadius) 生成猎物，
   * 支持无限向下深渊、群居鱼成簇编队，并应用 Infinite Scaling
   */
  public spawnPreyOffScreen(
    activePreys: PreyEntity[],
    sharkX: number,
    sharkY: number,
    rng: () => number = Math.random,
    customDistanceRange?: [number, number],
    currentScore: number = 0
  ): PreyEntity {
    const scaleMultiplier = this.getScaleMultiplier();
    // 若玩家已快速潜入/上浮离开该鱼群锚点所在水深带，立即清空旧鱼群锚点，防止跨生态层生成伴游鱼
    if (
      this.schoolClusterAnchor &&
      (Math.abs(sharkY - this.schoolClusterAnchor.y) > 320 ||
        sharkY < this.schoolClusterAnchor.config.minDepth - 120 ||
        sharkY > this.schoolClusterAnchor.config.maxDepth + 120)
    ) {
      this.schoolClusterAnchor = null;
    }

    // 若当前存在未生成的同伴鱼群锚点，优先在领头鱼附近 (32~68px) 生成同种伴游鱼，形成鱼群编队
    // 重要防滚雪球机制：伴游鱼固定为普通个体 ('NONE')，严禁一簇鱼群同时刷出 4 条黄金变异鱼导致秒触发狂暴
    if (this.schoolClusterAnchor && this.schoolClusterAnchor.remainingMates > 0) {
      const anchor = this.schoolClusterAnchor;
      anchor.remainingMates -= 1;
      if (anchor.remainingMates <= 0) {
        this.schoolClusterAnchor = null;
      }

      const offsetX = (rng() - 0.5) * 76;
      const offsetY = (rng() - 0.5) * 52;
      const mateX = infiniteWorldManager.wrapEntityX(anchor.x + offsetX);
      const mateY = Math.max(
        Math.max(25, anchor.config.minDepth),
        Math.min(anchor.config.maxDepth, anchor.y + offsetY)
      );

      const entity = this.pool.pop() ?? ({} as PreyEntity);
      entity.uid = this.nextUid++;
      entity.config = anchor.config;
      entity.x = mateX;
      entity.y = mateY;
      entity.vx = anchor.vx * (0.94 + rng() * 0.12);
      entity.vy = anchor.vy + (rng() - 0.5) * 10;
      entity.angle = anchor.angle;
      entity.phase = rng() * Math.PI * 2;
      entity.telegraphTimer = 0;
      entity.isInflated = false;
      entity.scaleMultiplier = scaleMultiplier;
      entity.mutationVariant = 'NONE';

      activePreys.push(entity);
      return entity;
    }

    const angle = rng() * Math.PI * 2;
    const minD = customDistanceRange ? customDistanceRange[0] : this.minSpawnRadius;
    const maxD = customDistanceRange ? customDistanceRange[1] : this.spawnRadius;
    const distance = minD + rng() * Math.max(1, maxD - minD);

    const rawX = sharkX + Math.cos(angle) * distance;
    const spawnX = infiniteWorldManager.wrapEntityX(rawX);

    // Canvas 2D 坐标系下 Y=0 为海面，向下为正方向无限延伸（确保不生成在海面上方）
    let spawnY = sharkY + Math.sin(angle) * distance;
    if (spawnY < 35) {
      spawnY = 35 + rng() * 220;
    }

    // 根据猎物实际生成的目标水深 spawnY 严格匹配对应生态层的鱼种，并将生成坐标钳制在该物种真实栖息水深内
    const chosenTier = this.pickPreyConfigForDepth(spawnY, rng);
    spawnY = Math.max(
      Math.max(25, chosenTier.minDepth),
      Math.min(chosenTier.maxDepth, spawnY)
    );
    const rolledMutation = infiniteProgressionManager.rollPreyMutation(currentScore, rng);
    // 水雷/核废料等危险物不生成黄金变异，且浅海前 10 秒降低黄金变异出现率
    const mutationVariant =
      chosenTier.isHazard && rolledMutation === 'GOLDEN_MUTANT'
        ? 'NONE'
        : rolledMutation;

    const speedBoost =
      (mutationVariant === 'ABYSS_BEHEMOTH' ? 1.25 : 1.0) *
      Math.min(1.6, infiniteProgressionManager.globalDifficultyMultiplier);
    const moveDir = rng() < 0.5 ? -1 : 1;
    const vx = moveDir * chosenTier.baseSpeed * speedBoost;
    const vy = (rng() - 0.5) * 24;
    const headingAngle = moveDir > 0 ? 0 : Math.PI;

    // 若抽中小型群居鱼 (SCHOOL_FLEE) 或 T1/T2 浅海鱼，建立 2~3 条伴游鱼编队锚点
    if (
      (chosenTier.behavior === 'SCHOOL_FLEE' || chosenTier.tier <= 2) &&
      !chosenTier.isHazard &&
      rng() < 0.65
    ) {
      this.schoolClusterAnchor = {
        config: chosenTier,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        angle: headingAngle,
        remainingMates: chosenTier.tier === 1 ? 3 : 2,
      };
    }

    const entity = this.pool.pop() ?? ({} as PreyEntity);
    entity.uid = this.nextUid++;
    entity.config = chosenTier;
    entity.x = spawnX;
    entity.y = spawnY;
    entity.vx = vx;
    entity.vy = vy;
    entity.angle = headingAngle;
    entity.phase = rng() * Math.PI * 2;
    entity.telegraphTimer = 0;
    entity.isInflated = false;
    entity.scaleMultiplier = scaleMultiplier;
    entity.mutationVariant = mutationVariant;

    activePreys.push(entity);
    return entity;
  }

  /**
   * 当前悬赏目标鱼 ID（开启时提高该目标鱼在对应栖息海域的刷新权重）
   */
  public activeTargetPreyId: string | null = null;

  private pickPreyConfigForDepth(
    targetDepthY: number,
    rng: () => number
  ): PreyTierConfig {
    const allPreys = GAME_CONFIG.preyTiers;
    if (allPreys.length === 0) {
      throw new Error('GAME_CONFIG.preyTiers is empty');
    }

    const depth = Math.max(25, targetDepthY);

    // 严格筛选当前水深落在该鱼种真实自然栖息带 [minDepth, maxDepth] 内的物种（绝不让浅水鱼刷到深海，也绝不让深水鱼刷到浅海）
    const habitatPool = allPreys.filter(
      (p) => depth >= p.minDepth && depth <= p.maxDepth
    );
    const activePool =
      habitatPool.length > 0
        ? habitatPool
        : depth <= 520
        ? allPreys.filter((p) => p.maxDepth <= 520)
        : allPreys.filter((p) => p.minDepth >= 500);

    // 若存在当前悬赏目标鱼，仅当该目标鱼确实属于当前水深栖息群落时，才以 26% 概率优先刷新（杜绝跨水深强行刷出浅水/深水目标鱼）
    if (this.activeTargetPreyId && rng() < 0.26) {
      const targetConfig = activePool.find((p) => p.id === this.activeTargetPreyId);
      if (targetConfig) {
        return targetConfig;
      }
    }

    // 根据真实海洋生态垂直分层动态分配 Tier 1..8 阶位权重：
    // 浅海珊瑚礁 (0~520m)：T1~T4 热带珊瑚礁鱼类；暮光带 (520~1150m)：T3~T6 中层发光鱼与乌贼；深渊带 (1150m+)：T3~T8 深渊掠食者与巨兽
    const tierWeights =
      depth > 1150
        ? [0, 0, 12, 18, 22, 20, 16, 12]
        : depth > 520
        ? [0, 0, 32, 30, 24, 14, 0, 0]
        : [40, 34, 18, 8, 0, 0, 0, 0];

    const totalWeight = tierWeights.reduce((a, b) => a + b, 0);
    let roll = rng() * totalWeight;
    let chosenTierNum = 1;
    for (let t = 0; t < tierWeights.length; t++) {
      roll -= tierWeights[t];
      if (roll <= 0) {
        chosenTierNum = t + 1;
        break;
      }
    }

    const tierMatches = activePool.filter((p) => p.tier === chosenTierNum);
    const finalPool = tierMatches.length > 0 ? tierMatches : activePool;
    const idx = Math.min(finalPool.length - 1, Math.floor(rng() * finalPool.length));
    return finalPool[idx];
  }
}

// 局内实时生态生成器：将刷新圈收紧至紧贴视口外缘的黄金狩猎环 (520px ~ 1060px)，同屏上限提升至 58 条
export const ecosystemSpawner = new EcosystemSpawner(58, 1060, 520);


