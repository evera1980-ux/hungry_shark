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

  /**
   * 黄金狂暴充能进度（需在非狂暴期间累计吞噬 8 条黄金变异鱼，且冷却完毕才可触发自然狂暴）
   */
  public goldenMutantCharge: number = 0;
  public readonly goldenMutantRequired: number = 8;
  public frenzyCooldownTimer: number = 0;

  public reset(): void {
    this.totalPlayTime = 0;
    this.globalDifficultyMultiplier = 1.0;
    this.frenzyStacks = 0;
    this.goldenMutantCharge = 0;
    this.frenzyCooldownTimer = 12.0; // 开局前 12 秒保护期不触发自然黄金狂暴
  }

  public getTotalPlayTime(): number {
    return this.totalPlayTime;
  }

  public update(deltaTime: number): void {
    const dt = Math.max(0, deltaTime);
    this.totalPlayTime += dt;
    if (this.frenzyCooldownTimer > 0) {
      this.frenzyCooldownTimer = Math.max(0, this.frenzyCooldownTimer - dt);
    }

    // 每过 60 秒，全球难度（敌人生命值、体型、攻击性）提升 10%
    this.globalDifficultyMultiplier = Number(
      (1.0 + Math.floor(this.totalPlayTime / 60) * 0.1).toFixed(2)
    );
  }

  /**
   * 当吞噬一条黄金变异猎物时累积充能；集满 8 条且冷却结束时触发狂暴并进入 25 秒冷却
   */
  public registerGoldenMutantDevoured(): boolean {
    if (this.frenzyCooldownTimer > 0) {
      return false;
    }
    this.goldenMutantCharge += 1;
    if (this.goldenMutantCharge >= this.goldenMutantRequired) {
      this.goldenMutantCharge = 0;
      this.frenzyCooldownTimer = 25.0;
      this.addFrenzyStack();
      return true;
    }
    return false;
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
   * 开局黄金变异率下调至 2.5%，深海巨兽率随时间提升以增强后期压迫感
   */
  public rollPreyMutation(
    currentScore: number,
    rng: () => number = Math.random
  ): PreyMutationVariant {
    const scoreFactor = Math.min(0.12, currentScore / 45000);
    const timeFactor = Math.min(0.18, (this.globalDifficultyMultiplier - 1.0) * 0.5);

    const goldenChance = 0.025 + scoreFactor * 0.25;
    const behemothChance = 0.08 + scoreFactor * 0.6 + timeFactor * 0.85;

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

