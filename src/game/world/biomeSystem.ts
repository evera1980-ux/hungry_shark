import { quinticSmoothstep } from '../rules';
import {
  WorldConfig,
  WorldConfigType,
  clampWorldDepth,
  mixSubsystemSeed,
} from './worldCore';

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

