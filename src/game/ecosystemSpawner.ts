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
   * 在距离玩家多远的外围生成 (800 ~ spawnRadius)
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

  constructor(maxActivePreys: number = 50, spawnRadius: number = 1500) {
    this.maxActivePreys = maxActivePreys;
    this.spawnRadius = spawnRadius;
  }

  /**
   * 重置生态计时器并回收现有鱼群至对象池
   */
  public reset(activePreys?: PreyEntity[]): void {
    this.gameTime = 0;
    if (activePreys) {
      while (activePreys.length > 0) {
        const p = activePreys.pop();
        if (p) this.pool.push(p);
      }
    }
  }

  /**
   * 【核心创新】计算当前游戏时长对应的无限变强倍率
   * scaleMultiplier = 1.0 + (this.gameTime * 0.01)
   */
  public getScaleMultiplier(): number {
    return Number((1.0 + this.gameTime * 0.01).toFixed(4));
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
   * 3. 维持同屏鱼群数量达到 maxActivePreys (50)
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
   * 在鲨鱼视野外随机方向 (800 ~ spawnRadius) 生成猎物，支持无限向下深渊并应用 Infinite Scaling
   */
  public spawnPreyOffScreen(
    activePreys: PreyEntity[],
    sharkX: number,
    sharkY: number,
    rng: () => number = Math.random,
    customDistanceRange?: [number, number],
    currentScore: number = 0
  ): PreyEntity {
    const chosenTier = this.pickPreyConfigForDepth(sharkY, rng);

    const angle = rng() * Math.PI * 2;
    const minD = customDistanceRange ? customDistanceRange[0] : this.minSpawnRadius;
    const maxD = customDistanceRange ? customDistanceRange[1] : this.spawnRadius;
    const distance = minD + rng() * Math.max(1, maxD - minD);

    const rawX = sharkX + Math.cos(angle) * distance;
    const spawnX = infiniteWorldManager.wrapEntityX(rawX);

    // Canvas 2D 坐标系下 Y=0 为海面，向下为正方向无限延伸（对应 Cocos Y<0 向下延伸，确保不生成在海面上方）
    let spawnY = sharkY + Math.sin(angle) * distance;
    if (spawnY < 100) {
      spawnY = 100 + rng() * 180;
    }

    // 【核心创新】应用无限变强数值膨胀（随游戏时长，新刷出的鱼体积、分值、基因奖励成比例上升）
    const scaleMultiplier = this.getScaleMultiplier();
    const mutationVariant = infiniteProgressionManager.rollPreyMutation(currentScore, rng);
    const speedBoost =
      (mutationVariant === 'ABYSS_BEHEMOTH' ? 1.25 : 1.0) *
      Math.min(1.6, infiniteProgressionManager.globalDifficultyMultiplier);
    const moveDir = rng() < 0.5 ? -1 : 1;

    const entity = this.pool.pop() ?? ({} as PreyEntity);
    entity.uid = this.nextUid++;
    entity.config = chosenTier;
    entity.x = spawnX;
    entity.y = spawnY;
    entity.vx = moveDir * chosenTier.baseSpeed * speedBoost;
    entity.vy = (rng() - 0.5) * 24;
    entity.angle = moveDir > 0 ? 0 : Math.PI;
    entity.phase = rng() * Math.PI * 2;
    entity.telegraphTimer = 0;
    entity.isInflated = false;
    entity.scaleMultiplier = scaleMultiplier;
    entity.mutationVariant = mutationVariant;

    activePreys.push(entity);
    return entity;
  }

  private pickPreyConfigForDepth(
    sharkY: number,
    rng: () => number
  ): PreyTierConfig {
    const tiers = GAME_CONFIG.preyTiers;
    if (tiers.length === 0) {
      throw new Error('GAME_CONFIG.preyTiers is empty');
    }

    // 根据下潜深度与游戏时间动态调整 8 个阶位猎物权重
    const depth = Math.max(0, sharkY);
    const weights =
      depth > 1250
        ? [14, 14, 15, 15, 14, 11, 11, 6]
        : depth > 650
        ? [20, 20, 18, 14, 11, 8, 6, 3]
        : [28, 25, 16, 11, 8, 6, 4, 2];

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * totalWeight;
    for (let i = 0; i < tiers.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return tiers[i];
      }
    }
    return tiers[0];
  }
}

export const ecosystemSpawner = new EcosystemSpawner(50, 1500);
