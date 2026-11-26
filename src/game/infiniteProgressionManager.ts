import worldAndProgressionJson from '../../shared/configs/world_and_progression_config.json';
import economyPredationJson from '../../shared/configs/economy_predation_config.json';

export type PreyMutationVariant = 'NONE' | 'GOLDEN_MUTANT' | 'ABYSS_BEHEMOTH';

const DIFF_CFG = worldAndProgressionJson.timeDifficulty;
const FRENZY_CFG = economyPredationJson.frenzy;
const MUTATION_CFG = economyPredationJson.mutations;

export class InfiniteProgressionManager {
  /** Global difficulty multiplier increasing per time interval from shared config */
  public globalDifficultyMultiplier: number = 1.0;

  /** Elapsed survival time (seconds) */
  private totalPlayTime: number = 0;
  private nextDifficultyMilestone: number = DIFF_CFG.intervalSec;

  /** Historical Frenzy activation count in this run (no longer inflates score multiplier infinitely per D4-A) */
  public frenzyStacks: number = 0;

  /** Golden mutant charge progress toward automatic Gold Frenzy */
  public goldenMutantCharge: number = 0;
  public readonly goldenMutantRequired: number = FRENZY_CFG.goldenChargeRequired;

  /** Cooldown timer (also acts as initial match protection period) */
  public frenzyCooldownTimer: number = 0;

  public reset(): void {
    this.globalDifficultyMultiplier = 1.0;
    this.totalPlayTime = 0;
    this.nextDifficultyMilestone = DIFF_CFG.intervalSec;
    this.frenzyStacks = 0;
    this.goldenMutantCharge = 0;
    this.frenzyCooldownTimer = FRENZY_CFG.initProtectionSec;
  }

  public getTotalPlayTime(): number {
    return this.totalPlayTime;
  }

  public update(deltaTime: number): void {
    const dt = Math.max(0, deltaTime);
    if (this.frenzyCooldownTimer > 0) {
      this.frenzyCooldownTimer = Math.max(0, this.frenzyCooldownTimer - dt);
    }

    this.totalPlayTime += dt;
    while (this.totalPlayTime >= this.nextDifficultyMilestone) {
      this.globalDifficultyMultiplier = Number(
        Math.min(
          DIFF_CFG.maxDifficultyMultiplier,
          this.globalDifficultyMultiplier + DIFF_CFG.ratePerInterval
        ).toFixed(2)
      );
      this.nextDifficultyMilestone += DIFF_CFG.intervalSec;
    }
  }

  /**
   * Registers a Golden Mutant devour. Triggers Gold Frenzy when charge hits threshold.
   */
  public registerGoldenMutantDevoured(chargeReduction: number = 0): boolean {
    if (this.frenzyCooldownTimer > 0) {
      return false;
    }
    const req = Math.max(
      FRENZY_CFG.minChargeFloor,
      this.goldenMutantRequired - Math.max(0, Math.floor(chargeReduction))
    );
    this.goldenMutantCharge += 1;
    if (this.goldenMutantCharge >= req) {
      this.goldenMutantCharge = 0;
      this.frenzyCooldownTimer = FRENZY_CFG.cooldownSec;
      this.addFrenzyStack();
      return true;
    }
    return false;
  }

  public getScaledPreyValue(baseScore: number): number {
    const scale = Math.max(
      DIFF_CFG.minScoreScalingFloor,
      Math.pow(this.globalDifficultyMultiplier, DIFF_CFG.scoreScalingExponent)
    );
    return Math.floor(baseScore * scale);
  }

  public addFrenzyStack(): number {
    this.frenzyStacks += 1;
    return this.getFrenzyScoreMultiplier();
  }

  public getFrenzyScoreMultiplier(): number {
    if (FRENZY_CFG.allowFrenzyStackInflation) {
      return Number(
        (FRENZY_CFG.scoreMultiplier + this.frenzyStacks * 0.5).toFixed(2)
      );
    }
    return FRENZY_CFG.scoreMultiplier;
  }

  public getFrenzyCoinMultiplier(): number {
    return FRENZY_CFG.coinMultiplier;
  }

  public getFrenzyGeneMultiplier(): number {
    return FRENZY_CFG.geneMultiplier;
  }

  /**
   * Rolls prey mutation using D4-A unified chances & Abyss Behemoth depth/tier gating.
   */
  public rollPreyMutation(
    currentScore: number,
    rng: () => number = Math.random,
    preyTier: number = 1,
    depthMeters: number = 0
  ): PreyMutationVariant {
    const safeScore = Math.max(0, currentScore);
    const inInitProtection =
      this.totalPlayTime < FRENZY_CFG.initProtectionSec &&
      this.frenzyCooldownTimer > 0;

    if (!inInitProtection) {
      const g = MUTATION_CFG.golden;
      const goldenChance = Math.min(
        g.maxChance,
        g.baseChance +
          Math.min(g.scoreScaleCap, (safeScore / g.scoreScaleDivisor) * g.scoreScaleCap)
      );
      if (rng() < goldenChance) {
        return 'GOLDEN_MUTANT';
      }
    }

    const b = MUTATION_CFG.abyssBehemoth;
    const eligibleBehemoth =
      b.enabled &&
      (preyTier >= b.minPreyTier || depthMeters >= b.minDepthMeters);
    if (eligibleBehemoth) {
      const behemothChance = Math.min(
        b.maxChance,
        b.baseChance +
          Math.min(b.scoreScaleCap, (safeScore / b.scoreScaleDivisor) * b.scoreScaleCap)
      );
      if (rng() < behemothChance) {
        return 'ABYSS_BEHEMOTH';
      }
    }

    return 'NONE';
  }
}

export const infiniteProgressionManager = new InfiniteProgressionManager();
