/**
 * Deterministic Seeded PRNG & Quantile Statistical Aggregator
 * Ensures bit-identical reproducible simulation results for any fixed seed.
 */

export function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function withSeededMathRandom<T>(
  rng: () => number,
  fn: () => Promise<T> | T
): Promise<T> {
  const originalRandom = Math.random;
  Math.random = rng;
  try {
    return await fn();
  } finally {
    Math.random = originalRandom;
  }
}

export function withSeededMathRandomSync<T>(rng: () => number, fn: () => T): T {
  const originalRandom = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

export interface DistributionSummary {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
  max: number;
}

function linearPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function computeDistributionStats(
  values: readonly number[],
  decimals: number = 2
): DistributionSummary {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      mean: 0,
      max: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const round = (x: number): number => {
    const f = Math.pow(10, decimals);
    return Math.round(x * f) / f;
  };
  return {
    count: sorted.length,
    min: round(sorted[0]),
    p25: round(linearPercentile(sorted, 0.25)),
    median: round(linearPercentile(sorted, 0.5)),
    p75: round(linearPercentile(sorted, 0.75)),
    p90: round(linearPercentile(sorted, 0.9)),
    mean: round(sum / sorted.length),
    max: round(sorted[sorted.length - 1]),
  };
}
