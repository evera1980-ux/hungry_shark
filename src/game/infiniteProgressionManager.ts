/**
 * 模块 C：让游戏永远玩下去的数值膨胀系统 (InfiniteProgressionManager.ts)
 * 随着分数和时间的增加，全图的猎物会演化出“黄金变异种 (GOLDEN_MUTANT)”、“深海巨兽化 (ABYSS_BEHEMOTH)”，
 * 并且解锁无限叠加的狂暴机制 (Infinite Frenzy Stacks)。
 */

export type PreyMutationVariant = 'NONE' | 'GOLDEN_MUTANT' | 'ABYSS_BEHEMOTH';

export class InfiniteProgressionManager {
  /**
   * 全球难度倍率（每过 60 秒提升 10%：1.0 + Math.floor(totalPlayTime / 60) * 0.1）
   */
  public globalDifficultyMultiplier: number = 1.0;

  /**
   * 累计游玩总时长（秒）
   */
  private totalPlayTime: number = 0;

  /**
   * 无限叠加的狂暴层数（每次触发黄金狂暴自动 +1 层，提供额外得分与磁吸加成）
   */
  public frenzyStacks: number = 0;

  public reset(): void {
    this.totalPlayTime = 0;
    this.globalDifficultyMultiplier = 1.0;
    this.frenzyStacks = 0;
  }

  public getTotalPlayTime(): number {
    return this.totalPlayTime;
  }

  public update(deltaTime: number): void {
    this.totalPlayTime += Math.max(0, deltaTime);

    // 每过 60 秒，全球难度（敌人生命值、体型、攻击性）提升 10%
    this.globalDifficultyMultiplier = Number(
      (1.0 + Math.floor(this.totalPlayTime / 60) * 0.1).toFixed(2)
    );
  }

  /**
   * 根据全球难度倍率与无限狂暴层数计算缩放后的猎物价值
   */
  public getScaledPreyValue(baseScore: number): number {
    return Math.floor(baseScore * this.globalDifficultyMultiplier);
  }

  /**
   * 触发或叠加无限狂暴层数，返回当前总狂暴倍率
   */
  public addFrenzyStack(): number {
    this.frenzyStacks += 1;
    return this.getFrenzyScoreMultiplier();
  }

  public getFrenzyScoreMultiplier(): number {
    return Number((1.0 + this.frenzyStacks * 0.25).toFixed(2));
  }

  /**
   * 决定新刷出的猎物是否演化为“黄金变异种”或“深海巨兽化”
   */
  public rollPreyMutation(
    currentScore: number,
    rng: () => number = Math.random
  ): PreyMutationVariant {
    const scoreFactor = Math.min(0.18, currentScore / 25000);
    const timeFactor = Math.min(0.15, (this.globalDifficultyMultiplier - 1.0) * 0.5);

    const goldenChance = 0.08 + scoreFactor * 0.5 + timeFactor * 0.5;
    const behemothChance = 0.06 + scoreFactor * 0.5 + timeFactor * 0.6;

    const r = rng();
    if (r < goldenChance) {
      return 'GOLDEN_MUTANT';
    }
    if (r < goldenChance + behemothChance) {
      return 'ABYSS_BEHEMOTH';
    }
    return 'NONE';
  }
}

export const infiniteProgressionManager = new InfiniteProgressionManager();
