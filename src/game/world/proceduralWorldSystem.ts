import { quinticSmoothstep } from '../rules';
import {
  WorldConfig,
  WorldConfigType,
  engineCoordToWorldCoord,
} from './worldCore';
import {
  TerrainChunkSamples,
  getFloorDepthAt,
  getTerrainSlopeAt,
  getTerrainSamples,
} from './terrainSystem';
import {
  BiomeSampleResult,
  getBiomeAt,
  DepthVisualProfile,
  getDepthVisualProfile,
} from './biomeSystem';
import {
  GeneratedObject,
  generateEcology,
} from './ecologyAndPoi';

// ============================================================================
// 0. 核心类型与四尺度 (L0 ~ L3) 数据契约定义
// ============================================================================

/**
 * L0 宏观海洋地理结构 (Section 1)
 */
export type MacroGeographyType =
  | 'CONTINENTAL_SHELF'   // 浅海大陆架（沙地、岩礁）
  | 'CORAL_REEF_BELT'     // 珊瑚礁带（珊瑚群落、礁石通道）
  | 'CONTINENTAL_SLOPE'   // 大陆坡（连续岩壁、碎石坡）
  | 'SUBMARINE_CANYON'    // 海底峡谷（峡谷边缘、洞穴）
  | 'ABYSSAL_PLAIN'       // 深海盆地（深海平原、发光生物群）
  | 'OCEANIC_TRENCH';     // 海沟（陡峭岩壁、稀疏生态）

/**
 * 宏观探索节奏区域序列 (Section 6)
 * 浅海珊瑚礁 -> 沙地开阔区 -> 礁石密集区 -> 海底峡谷 -> 深海平原 -> 发光生物区 -> 大型海沟
 */
export type ExplorationZoneType =
  | 'SHALLOW_CORAL_REEF'     // 浅海珊瑚礁
  | 'SANDY_OPEN_FLAT'        // 沙地开阔区
  | 'DENSE_REEF_PASSAGE'     // 礁石密集区
  | 'SUBMARINE_CANYON_DROP'  // 海底峡谷
  | 'ABYSSAL_PLAIN_EXPANSE'  // 深海平原
  | 'BIOLUMINESCENT_GROVE'   // 发光生物区
  | 'HADAL_TRENCH_CHASM';    // 大型海沟

/**
 * 六大连续环境数值场采样结果 (Section 3)
 */
export interface TerrainEnvironmentFields {
  worldX: number;
  worldY: number;
  /** depthField: 深度场 (m, >= 0) */
  depth: number;
  /** heightField: 海底地形起伏高度 (px, 连续多层噪声合成) */
  height: number;
  /** slopeField: 归一化地形坡度 (0 = 平坦沙地, 1 = 陡峭悬崖/岩壁) */
  slope: number;
  /** temperatureField: 归一化水温场 (0 = 极寒海沟, 1 = 温暖浅海或热液喷口核心) */
  temperature: number;
  /** lightField: 归一化光照场 (0 = 无光深渊, 1 = 阳光充沛表层) */
  light: number;
  /** biomeField: 当前主导宏观探索群落类型 */
  biome: ExplorationZoneType;
  /** L0 宏观地理分区 */
  macroGeography: MacroGeographyType;
  /** 次级过渡群落类型（位于两个宏观区域交界过渡带时存在） */
  secondaryBiome: ExplorationZoneType;
  /** 主导群落向次级群落的平滑过渡权重 [0, 1] */
  biomeTransitionFactor: number;
}

/**
 * L2 地貌结构类型 (Section 2 & 5)
 */
export type LandformStructureKind =
  | 'CAVE_CHAMBER'       // 连续岩体洞穴/拱廊（跨 Chunk 连续 SDF）
  | 'REEF_ARCHWAY'       // 珊瑚礁石通道拱门
  | 'CONTINUOUS_CLIFF'   // 连续阶梯岩壁
  | 'SAND_DUNE_RIDGE'    // 浅海波纹沙丘
  | 'CANYON_PILLAR'      // 海底峡谷石柱
  | 'HYDROTHERMAL_MOUND';// 深渊热液黑烟囱岩冢

export interface LandformStructureInstance {
  id: string;
  kind: LandformStructureKind;
  centerX: number;
  baseY: number;
  width: number;
  height: number;
  archRadius: number;
  slope: number;
  seed: number;
  biome: ExplorationZoneType;
}

/**
 * L3 生态群落类型与局部装饰类型 (Section 2 & 4)
 */
export type EcologyClusterType =
  | 'coral_reef'         // 珊瑚礁群落
  | 'seagrass_meadow'    // 浅海沙地海草床
  | 'kelp_forest'        // 巨藻林群落
  | 'boulder_outcrop'    // 碎石岩块群
  | 'biolum_grove'       // 深海发光海鞭/水母群落
  | 'hydrothermal_oasis';// 海沟热液管虫与气泡群落

export type DecorationPropKind =
  | 'STAGHORN_CORAL'
  | 'BRAIN_CORAL'
  | 'TUBE_SPONGE'
  | 'SEAGRASS_TUFT'
  | 'GIANT_KELP_STALK'
  | 'MOSSY_BOULDER'
  | 'BIOLUM_SEA_WHIP'
  | 'GLOW_ANEMONE'
  | 'HYDROTHERMAL_BUBBLE_VENT'
  | 'ABYSSAL_CRYSTAL_SPIRE';

export interface EcologyCluster {
  id: string;
  center: { x: number; y: number };
  radius: number;
  type: EcologyClusterType;
  density: number;
  seed: number;
  biome: ExplorationZoneType;
  /** 群落关联的推荐猎物行为倾向（供 EcosystemSpawner 聚集刷怪联动） */
  preferredPreyArchetype: 'REEF_SWARM' | 'SAND_GRAZER' | 'CANYON_HUNTER' | 'BIOLUM_DRIFTER' | 'ABYSS_APEX';
}

export interface DecorationPropInstance {
  id: string;
  clusterId: string;
  kind: DecorationPropKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  swayPhase: number;
  tintHex: string;
  secondaryHex: string;
  lodPriority: 0 | 1 | 2; // 0 = 关键主景 (全 LOD 可见), 1 = 中等细节, 2 = 近距微细节
}

/**
 * 单个 Chunk 的缓存数据结构 (Section 5 & 7)
 * Chunk 只负责缓存、组织与渲染，地形高度与结构边界全部通过全局坐标采样保证 100% 连续
 */
export interface WorldChunkData {
  chunkIndex: number;
  startX: number;
  endX: number;
  width: number;
  macroBiome: ExplorationZoneType;
  macroGeography: MacroGeographyType;
  /** 采样点间隔固定（含 startX 与 endX 闭区间端点），确保相邻 Chunk 左右边缘高度严格相等 */
  terrainSampleStep: number;
  /** L1 海底主轮廓高度采样序列（相对于生态带基准海床的起伏偏移 px） */
  heightSamples: Float32Array;
  /** L1 中景岩层高度采样序列 */
  midStratumSamples: Float32Array;
  /** L1 远景海山轮廓采样序列 */
  farRidgeSamples: Float32Array;
  /** L1 坡度采样序列 */
  slopeSamples: Float32Array;
  /** L2 地貌结构实例（洞穴、礁石拱门、岩壁、沙丘） */
  structures: LandformStructureInstance[];
  /** L3 聚集式生态群落中心 */
  clusters: EcologyCluster[];
  /** L3 经 Poisson Disk Sampling 与环境场过滤后的局部装饰实例 */
  decorations: DecorationPropInstance[];
  lastAccessedTime: number;
}

// ============================================================================
// 1. 模块一：WorldGenerator（全局种子、连续多层噪声与六大环境场）
// ============================================================================

export class WorldGenerator {
  public readonly worldSeed: number;

  constructor(worldSeed: number = 20261110) {
    this.worldSeed = worldSeed >>> 0;
  }

  /**
   * 确定性整数哈希函数 -> [0, 1)
   */
  public hash1D(n: number, salt: number = 0): number {
    let x = (Math.imul(Math.floor(n), 374761393) + Math.imul(this.worldSeed ^ salt, 668265263)) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * 确定性二维哈希函数 -> [0, 1)
   */
  public hash2D(ix: number, iy: number, salt: number = 0): number {
    let h =
      (Math.imul(Math.floor(ix), 374761393) +
        Math.imul(Math.floor(iy), 668265263) +
        Math.imul(this.worldSeed ^ salt, 2147483647)) >>>
      0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * 生成确定性伪随机数流 (Mulberry32)
   */
  public createSeededRng(localSeed: number): () => number {
    let state = (this.worldSeed ^ (localSeed >>> 0)) >>> 0;
    if (state === 0) state = 0x6d2b79f5;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 一维 C2 连续梯度/值噪声 (返回值范围 [-1, 1])
   */
  public noise1D(x: number, salt: number = 0): number {
    const x0 = Math.floor(x);
    const tx = x - x0;
    // Quintic C2 Hermite curve: 6t^5 - 15t^4 + 10t^3
    const u = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
    const v0 = this.hash1D(x0, salt) * 2 - 1;
    const v1 = this.hash1D(x0 + 1, salt) * 2 - 1;
    return v0 + (v1 - v0) * u;
  }

  /**
   * 二维 C2 连续平滑噪声 (返回值范围 [-1, 1])
   */
  public noise2D(x: number, y: number, salt: number = 0): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    const a = this.hash2D(ix, iy, salt) * 2 - 1;
    const b = this.hash2D(ix + 1, iy, salt) * 2 - 1;
    const c = this.hash2D(ix, iy + 1, salt) * 2 - 1;
    const d = this.hash2D(ix + 1, iy + 1, salt) * 2 - 1;

    const ab = a + (b - a) * ux;
    const cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
  }

  /**
   * 一维 Voronoi 细胞距离场 (用于 L2 地貌结构：礁石群、洞穴腔体、峡谷裂隙)
   */
  public voronoi1D(
    x: number,
    cellSize: number,
    salt: number = 101
  ): { cellIndex: number; cellCenterX: number; distToCenter: number; normalizedDist: number; cellSeed: number } {
    const safeSize = Math.max(16, cellSize);
    const baseCell = Math.floor(x / safeSize);
    let bestCell = baseCell;
    let bestCenterX = (baseCell + 0.5) * safeSize;
    let bestDist = Infinity;

    for (let offset = -1; offset <= 1; offset++) {
      const candidateCell = baseCell + offset;
      const jitter = (this.hash1D(candidateCell, salt) - 0.5) * 0.68;
      const centerX = (candidateCell + 0.5 + jitter) * safeSize;
      const dist = Math.abs(x - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = candidateCell;
        bestCenterX = centerX;
      }
    }

    const cellSeed = Math.floor(this.hash1D(bestCell, salt + 77) * 0x7fffffff);
    return {
      cellIndex: bestCell,
      cellCenterX: bestCenterX,
      distToCenter: bestDist,
      normalizedDist: Math.min(1, bestDist / (safeSize * 0.5)),
      cellSeed,
    };
  }

  /**
   * 方案第五节标准公式：多层连续地形高度采样 `getTerrainHeight(worldX)`
   * - L0 低频大陆架起伏: `noise(worldX * 0.0005) * 500`
   * - L1 中频海底山脉/岩壁: `noise(worldX * 0.002) * 150`
   * - L2/L3 高频礁盘起伏: `noise(worldX * 0.008) * 30`
   * 任意相邻 Chunk 在边界 `worldX` 处调用此函数，返回值在数学上 100% 恒等。
   */
  public getTerrainHeight(worldX: number): number {
    return (
      this.noise1D(worldX * 0.0005, 11) * 500 +
      this.noise1D(worldX * 0.002, 23) * 150 +
      this.noise1D(worldX * 0.008, 37) * 30
    );
  }

  /**
   * 计算世界坐标 `worldX` 处的归一化地形坡度 `slopeField` ∈ [0, 1]
   */
  public getSlope(worldX: number): number {
    const delta = 12;
    const hL = this.getTerrainHeight(worldX - delta);
    const hR = this.getTerrainHeight(worldX + delta);
    const derivative = Math.abs(hR - hL) / (2 * delta);
    // 三层噪声合成的最大理论斜率约为 (500*0.0005 + 150*0.002 + 30*0.008) * 3.2 ≈ 2.6，归一化至 [0, 1]
    return Math.max(0, Math.min(1, derivative / 2.6));
  }

  /**
   * 计算深度场 `depthField` (m)
   * 结合垂直坐标 `worldY` 与横向海沟/峡谷下陷调制
   */
  public getDepth(worldX: number, worldY: number): number {
    const baseDepth = Math.max(0, worldY);
    const macroTrenchDrop = Math.max(0, -this.noise1D(worldX * 0.00025, 53)) * 45;
    return baseDepth + macroTrenchDrop;
  }

  /**
   * 计算光照场 `lightField` ∈ [0, 1]
   * 遵循水下 Beer-Lambert 光衰减定律 + 横向宏观礁盘开阔度调制
   */
  public getLight(worldY: number, worldX: number = 0): number {
    const depth = Math.max(0, worldY);
    // 0m = 1.0, 250m ≈ 0.56, 520m ≈ 0.25, 1150m ≈ 0.03
    const verticalLight = Math.exp(-depth / 410);
    const canopyMod = 1 + this.noise1D(worldX * 0.0004, 71) * 0.12;
    return Math.max(0, Math.min(1, verticalLight * canopyMod));
  }

  /**
   * 计算温度场 `temperatureField` ∈ [0, 1]
   * 表层温暖 (0.85~1.0) -> 暮光温跃层骤降 (0.35) -> 深渊寒冷 (0.12)，但在深海热液喷口附近回升
   */
  public getTemperature(worldX: number, worldY: number): number {
    const depth = Math.max(0, worldY);
    const surfaceWarmth = Math.exp(-depth / 580);
    const hydrothermalAnomaly =
      depth > 950
        ? Math.pow(Math.max(0, this.noise1D(worldX * 0.0018, 89)), 2) *
          quinticSmoothstep(950, 1400, depth) *
          0.65
        : 0;
    return Math.max(0.08, Math.min(1, surfaceWarmth * 0.92 + 0.08 + hydrothermalAnomaly));
  }

  // ---- 方案第三节：基于环境场的生态出现概率纯函数 ----

  /**
   * 方案第三节标准示例公式：珊瑚出现概率 `coralProbability(env)`
   * 珊瑚出现在浅海、光照充足、坡度平缓~适中的礁区
   */
  public coralProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    // 浅海因子：0m 最高，随深度超过 520m 平滑衰减至 0
    const shallowFactor = 1 - quinticSmoothstep(40, 540, env.depth);
    const lightFactor = quinticSmoothstep(0.15, 0.8, env.light);
    const slopeFactor = 1 - quinticSmoothstep(0.25, 0.85, env.slope);
    return Math.max(0, Math.min(1, shallowFactor * lightFactor * slopeFactor));
  }

  /**
   * 海草出现概率：更适合浅海平坦沙地 (`slope < 0.35`)
   */
  public seagrassProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    const shallowFactor = 1 - quinticSmoothstep(20, 460, env.depth);
    const lightFactor = quinticSmoothstep(0.22, 0.85, env.light);
    const flatSandFactor = 1 - quinticSmoothstep(0.08, 0.45, env.slope);
    return Math.max(0, Math.min(1, shallowFactor * lightFactor * flatSandFactor));
  }

  /**
   * 巨藻林出现概率：适合大陆架边缘与峡谷坡地 (`120m ~ 780m`)
   */
  public kelpForestProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    const depthBand =
      quinticSmoothstep(60, 220, env.depth) * (1 - quinticSmoothstep(520, 880, env.depth));
    const slopeBand = 1 - quinticSmoothstep(0.35, 0.88, env.slope);
    return Math.max(0, Math.min(1, depthBand * slopeBand));
  }

  /**
   * 深海生物发光群落概率：在暮光带下半部与深渊区增加出现概率
   */
  public biolumProbability(env: Pick<TerrainEnvironmentFields, 'depth' | 'light' | 'slope'>): number {
    const deepFactor = quinticSmoothstep(420, 980, env.depth);
    const lowLightFactor = 1 - quinticSmoothstep(0.02, 0.45, env.light);
    return Math.max(0, Math.min(1, deepFactor * lowLightFactor));
  }
}

// ============================================================================
// 2. 模块二：BiomeManager（L0 宏观区域规划器与 7 大探索节奏平滑过渡）
// ============================================================================

const SHALLOW_EXPLORATION_CYCLE: readonly ExplorationZoneType[] = [
  'SHALLOW_CORAL_REEF',
  'SANDY_OPEN_FLAT',
  'DENSE_REEF_PASSAGE',
  'SUBMARINE_CANYON_DROP',
];

const TWILIGHT_EXPLORATION_CYCLE: readonly ExplorationZoneType[] = [
  'SUBMARINE_CANYON_DROP',
  'DENSE_REEF_PASSAGE',
  'BIOLUMINESCENT_GROVE',
  'ABYSSAL_PLAIN_EXPANSE',
];

const ABYSS_EXPLORATION_CYCLE: readonly ExplorationZoneType[] = [
  'ABYSSAL_PLAIN_EXPANSE',
  'BIOLUMINESCENT_GROVE',
  'HADAL_TRENCH_CHASM',
];

export interface MacroZoneEvaluation {
  primaryBiome: ExplorationZoneType;
  secondaryBiome: ExplorationZoneType;
  transitionFactor: number; // 0 = 纯 primary, 0..1 = 过渡带内平滑插值
  macroGeography: MacroGeographyType;
  zoneCenterX: number;
  zoneRadius: number;
  /** 对海底地形高度的缩放调制（例如沙地开阔区压平，峡谷/礁石密集区放大起伏） */
  reliefMultiplier: number;
  /** 对海床近景层的纵向抬升/下沉偏移 (px, >= -22) */
  seabedVerticalBiasPx: number;
  /** 珊瑚/海草/发光植被密度乘数 */
  floraDensityMultiplier: number;
  /** 鱼群聚集度乘数 */
  schoolClusterProbability: number;
}

export class BiomeManager {
  private readonly worldGen: WorldGenerator;
  /** 宏观区域基准跨度（非硬切固定长度，内部叠加 Voronoi 种子扰动，使玩家横向游动时每 960m 平滑经历不同探索节奏区域） */
  public readonly baseMacroSpan: number = 960;

  constructor(worldGen: WorldGenerator) {
    this.worldGen = worldGen;
  }

  /**
   * 根据宏观探索区域映射对应的 L0 宏观地理结构 (Section 1)
   */
  public mapZoneToMacroGeography(zone: ExplorationZoneType, depth: number): MacroGeographyType {
    if (depth > 1350 || zone === 'HADAL_TRENCH_CHASM') {
      return 'OCEANIC_TRENCH';
    }
    if (depth > 950 || zone === 'ABYSSAL_PLAIN_EXPANSE' || zone === 'BIOLUMINESCENT_GROVE') {
      return 'ABYSSAL_PLAIN';
    }
    switch (zone) {
      case 'SHALLOW_CORAL_REEF':
      case 'DENSE_REEF_PASSAGE':
        return 'CORAL_REEF_BELT';
      case 'SANDY_OPEN_FLAT':
        return 'CONTINENTAL_SHELF';
      case 'SUBMARINE_CANYON_DROP':
        return depth > 480 ? 'SUBMARINE_CANYON' : 'CONTINENTAL_SLOPE';
      default:
        return 'CONTINENTAL_SHELF';
    }
  }

  /**
   * 获取指定探索区域的环境调制参数
   */
  private getZonePreset(zone: ExplorationZoneType): {
    reliefMultiplier: number;
    seabedVerticalBiasPx: number;
    floraDensityMultiplier: number;
    schoolClusterProbability: number;
  } {
    switch (zone) {
      case 'SHALLOW_CORAL_REEF':
        return {
          reliefMultiplier: 1.05,
          seabedVerticalBiasPx: -6,
          floraDensityMultiplier: 1.4,
          schoolClusterProbability: 0.78,
        };
      case 'SANDY_OPEN_FLAT':
        return {
          reliefMultiplier: 0.36,
          seabedVerticalBiasPx: 26, // 沙地开阔区岩礁下沉，露出平缓金色波纹沙床与开阔巡航视野
          floraDensityMultiplier: 0.55,
          schoolClusterProbability: 0.42,
        };
      case 'DENSE_REEF_PASSAGE':
        return {
          reliefMultiplier: 1.42,
          seabedVerticalBiasPx: -18, // 礁石密集区岩层显著隆起，形成丰富礁石通道与拱门
          floraDensityMultiplier: 1.55,
          schoolClusterProbability: 0.85,
        };
      case 'SUBMARINE_CANYON_DROP':
        return {
          reliefMultiplier: 1.62,
          seabedVerticalBiasPx: 12,
          floraDensityMultiplier: 0.85,
          schoolClusterProbability: 0.64,
        };
      case 'ABYSSAL_PLAIN_EXPANSE':
        return {
          reliefMultiplier: 0.48,
          seabedVerticalBiasPx: 22,
          floraDensityMultiplier: 0.6,
          schoolClusterProbability: 0.5,
        };
      case 'BIOLUMINESCENT_GROVE':
        return {
          reliefMultiplier: 1.18,
          seabedVerticalBiasPx: -8,
          floraDensityMultiplier: 1.5,
          schoolClusterProbability: 0.82,
        };
      case 'HADAL_TRENCH_CHASM':
        return {
          reliefMultiplier: 1.75,
          seabedVerticalBiasPx: 18,
          floraDensityMultiplier: 0.48,
          schoolClusterProbability: 0.38,
        };
    }
  }

  /**
   * 基于宏观 Seed 在水平与垂直维度决定当前区域的探索节奏，并在相邻区域间建立平滑过渡带 (Section 6)
   */
  public evaluateMacroZone(worldX: number, worldY: number): MacroZoneEvaluation {
    const depth = Math.max(0, worldY);
    // 通过非线性相位扭曲避免固定长度区域，使每个宏观区域长度自然变化
    const warpedX =
      worldX + this.worldGen.noise1D(worldX * 0.00035, 307) * 240;
    const scaledCoord = warpedX / this.baseMacroSpan;
    const cellIdx = Math.floor(scaledCoord);
    const cellFrac = scaledCoord - cellIdx; // [0, 1)

    const pickZoneForCell = (cIdx: number): ExplorationZoneType => {
      const h = this.worldGen.hash1D(cIdx, 409);
      if (depth <= 520) {
        const idx =
          ((cIdx % SHALLOW_EXPLORATION_CYCLE.length) + SHALLOW_EXPLORATION_CYCLE.length) %
          SHALLOW_EXPLORATION_CYCLE.length;
        if (h > 0.82) {
          return SHALLOW_EXPLORATION_CYCLE[(idx + 1) % SHALLOW_EXPLORATION_CYCLE.length];
        }
        return SHALLOW_EXPLORATION_CYCLE[idx];
      }
      if (depth <= 1150) {
        const idx =
          ((cIdx % TWILIGHT_EXPLORATION_CYCLE.length) + TWILIGHT_EXPLORATION_CYCLE.length) %
          TWILIGHT_EXPLORATION_CYCLE.length;
        return TWILIGHT_EXPLORATION_CYCLE[idx];
      }
      const idx =
        ((cIdx % ABYSS_EXPLORATION_CYCLE.length) + ABYSS_EXPLORATION_CYCLE.length) %
        ABYSS_EXPLORATION_CYCLE.length;
      return ABYSS_EXPLORATION_CYCLE[idx];
    };

    const currentZone = pickZoneForCell(cellIdx);
    // 在每个区域首尾 28% 宽度建立平滑过渡带
    let neighborZone = currentZone;
    let transitionFactor = 0;

    if (cellFrac < 0.28) {
      neighborZone = pickZoneForCell(cellIdx - 1);
      transitionFactor = (1 - quinticSmoothstep(0, 0.28, cellFrac)) * 0.5;
    } else if (cellFrac > 0.72) {
      neighborZone = pickZoneForCell(cellIdx + 1);
      transitionFactor = quinticSmoothstep(0.72, 1.0, cellFrac) * 0.5;
    }

    const pA = this.getZonePreset(currentZone);
    const pB = this.getZonePreset(neighborZone);
    const t = transitionFactor;

    return {
      primaryBiome: currentZone,
      secondaryBiome: neighborZone,
      transitionFactor: t,
      macroGeography: this.mapZoneToMacroGeography(currentZone, depth),
      zoneCenterX: (cellIdx + 0.5) * this.baseMacroSpan,
      zoneRadius: this.baseMacroSpan * 0.5,
      reliefMultiplier: pA.reliefMultiplier * (1 - t) + pB.reliefMultiplier * t,
      seabedVerticalBiasPx:
        pA.seabedVerticalBiasPx * (1 - t) + pB.seabedVerticalBiasPx * t,
      floraDensityMultiplier:
        pA.floraDensityMultiplier * (1 - t) + pB.floraDensityMultiplier * t,
      schoolClusterProbability:
        pA.schoolClusterProbability * (1 - t) + pB.schoolClusterProbability * t,
    };
  }

  /**
   * 采样完整的六大连续环境数值场 `TerrainEnvironmentFields` (Section 3)
   */
  public sampleEnvironmentFields(worldX: number, worldY: number): TerrainEnvironmentFields {
    const macro = this.evaluateMacroZone(worldX, worldY);
    const depth = this.worldGen.getDepth(worldX, worldY);
    const height = this.worldGen.getTerrainHeight(worldX) * macro.reliefMultiplier;
    const slope = Math.min(1, this.worldGen.getSlope(worldX) * macro.reliefMultiplier);
    const light = this.worldGen.getLight(depth, worldX);
    const temperature = this.worldGen.getTemperature(worldX, depth);

    return {
      worldX,
      worldY,
      depth,
      height,
      slope,
      temperature,
      light,
      biome: macro.primaryBiome,
      macroGeography: macro.macroGeography,
      secondaryBiome: macro.secondaryBiome,
      biomeTransitionFactor: macro.transitionFactor,
    };
  }
}

// ============================================================================
// 3. 模块三：TerrainGenerator（L1 连续海底地形轮廓与多岩层剖面生成）
// ============================================================================

export class TerrainGenerator {
  private readonly worldGen: WorldGenerator;
  private readonly biomeMgr: BiomeManager;

  constructor(worldGen: WorldGenerator, biomeMgr: BiomeManager) {
    this.worldGen = worldGen;
    this.biomeMgr = biomeMgr;
  }

  /**
   * 规范第 6.1 & 13 节：全局连续海床深度函数 `getFloorDepthAt(worldX)`
   */
  public getFloorDepthAt(worldX: number, config: WorldConfigType = WorldConfig): number {
    return getFloorDepthAt(worldX, config);
  }

  /**
   * 规范第 6.2 & 13 节：全局海床斜率函数 `getTerrainSlopeAt(worldX)`
   */
  public getTerrainSlopeAt(worldX: number, config: WorldConfigType = WorldConfig): number {
    return getTerrainSlopeAt(worldX, config);
  }

  /**
   * 规范第 6.2 & 13 节：Chunk 海床采样序列 `getTerrainSamples(chunkX)`
   */
  public getTerrainSamples(chunkX: number, config: WorldConfigType = WorldConfig): TerrainChunkSamples {
    return getTerrainSamples(chunkX, config);
  }

  /**
   * 计算任意全局坐标 `worldX` 处的连续海底地形轮廓高度（兼容 Chunk 边界 100% 精确相等）
   */
  public getContinuousTerrainHeight(worldX: number, referenceDepthY: number = 260): number {
    const macro = this.biomeMgr.evaluateMacroZone(worldX, referenceDepthY);
    return this.worldGen.getTerrainHeight(worldX) * macro.reliefMultiplier;
  }

  /**
   * 计算屏幕任意垂直切片列对应的世界坐标 `worldX` 处的连续地形垂直位移 (px)
   * 用于驱动 Far / Mid / Near 视差图层切片产生真实的海山、岩坡、峡谷、平缓沙地起伏（告别平直死板的贴图平铺！）
   */
  public sampleColumnContourOffsetPx(
    worldX: number,
    depthY: number,
    layerKind: 'FAR' | 'MID' | 'NEAR'
  ): number {
    const macro = this.biomeMgr.evaluateMacroZone(worldX, depthY);
    const rawH = this.worldGen.getTerrainHeight(worldX);
    const ridgeWave = Math.tanh(rawH / 320); // [-1, 1]

    if (layerKind === 'FAR') {
      const farWave =
        this.worldGen.noise1D(worldX * 0.0012 + 3.7, 193) * 0.65 +
        ridgeWave * 0.35;
      // 负值代表海山向上隆起，正值代表海谷下沉
      return Math.round(
        (-farWave * 38 * macro.reliefMultiplier) +
          Math.max(0, macro.seabedVerticalBiasPx * 0.45)
      );
    }

    if (layerKind === 'MID') {
      const midWave =
        this.worldGen.noise1D(worldX * 0.0022 + 11.4, 149) * 0.55 +
        ridgeWave * 0.45;
      return Math.round(
        (-midWave * 46 * macro.reliefMultiplier) +
          macro.seabedVerticalBiasPx * 0.85
      );
    }

    // NEAR: 海床近景主轮廓
    const detailWave = this.worldGen.noise1D(worldX * 0.0045 + 5.2, 37) * 14;
    return Math.round(
      (-ridgeWave * 36 * macro.reliefMultiplier - detailWave) +
        macro.seabedVerticalBiasPx
    );
  }

  /**
   * 计算用于视差图层调制的三平面连续地形偏移（px）
   */
  public sampleParallaxTerrainModulation(
    worldX: number,
    depthY: number
  ): {
    farRidgeOffsetPx: number;
    midStratumOffsetPx: number;
    nearSeabedOffsetPx: number;
    macroZone: MacroZoneEvaluation;
  } {
    const macro = this.biomeMgr.evaluateMacroZone(worldX, depthY);
    const rawH = this.worldGen.getTerrainHeight(worldX);
    const normalizedRidge = Math.tanh(rawH / 360); // [-1, 1]

    const farRidgeOffsetPx = Math.max(
      0,
      Math.round((0.5 - 0.5 * normalizedRidge) * 22 * macro.reliefMultiplier)
    );
    const midStratumOffsetPx = Math.max(
      0,
      Math.round(
        (0.5 - 0.5 * this.worldGen.noise1D(worldX * 0.0014, 61)) *
          30 *
          macro.reliefMultiplier +
          Math.max(0, macro.seabedVerticalBiasPx * 0.55)
      )
    );
    const nearSeabedOffsetPx = Math.max(
      0,
      Math.round(
        (0.5 - 0.5 * normalizedRidge) * 26 * macro.reliefMultiplier +
          Math.max(0, macro.seabedVerticalBiasPx)
      )
    );

    return {
      farRidgeOffsetPx,
      midStratumOffsetPx,
      nearSeabedOffsetPx,
      macroZone: macro,
    };
  }

  /**
   * 为指定 Chunk `[startX, endX]` 采样连续地形轮廓数组
   * 第 0 个采样点严格对应 `startX`，最后一个采样点严格对应 `endX`
   */
  public generateChunkTerrainProfiles(
    startX: number,
    endX: number,
    step: number,
    referenceDepthY: number
  ): {
    heightSamples: Float32Array;
    midStratumSamples: Float32Array;
    farRidgeSamples: Float32Array;
    slopeSamples: Float32Array;
  } {
    const span = Math.max(step, endX - startX);
    const count = Math.floor(span / step) + 1;
    const heightSamples = new Float32Array(count);
    const midStratumSamples = new Float32Array(count);
    const farRidgeSamples = new Float32Array(count);
    const slopeSamples = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const wx = i === count - 1 ? endX : startX + i * step;
      const h = this.getContinuousTerrainHeight(wx, referenceDepthY);
      heightSamples[i] = h;
      midStratumSamples[i] =
        h * 0.62 + this.worldGen.noise1D(wx * 0.0016 + 17.3, 149) * 95;
      farRidgeSamples[i] =
        this.worldGen.noise1D(wx * 0.00038 + 5.1, 193) * 320 +
        this.worldGen.noise1D(wx * 0.0011, 211) * 90;
      slopeSamples[i] = this.worldGen.getSlope(wx);
    }

    return {
      heightSamples,
      midStratumSamples,
      farRidgeSamples,
      slopeSamples,
    };
  }
}

// ============================================================================
// 4. 模块四：StructureGenerator（L2 地貌结构：Voronoi + 规则模板 + 跨边界洞穴 SDF）
// ============================================================================

export class StructureGenerator {
  private readonly worldGen: WorldGenerator;
  private readonly biomeMgr: BiomeManager;
  /** Voronoi 地貌结构单元格跨度（全局坐标系，天然跨 Chunk 边界共享） */
  public readonly structureCellSpan: number = 340;

  constructor(worldGen: WorldGenerator, biomeMgr: BiomeManager) {
    this.worldGen = worldGen;
    this.biomeMgr = biomeMgr;
  }

  /**
   * 评估全局坐标 `(worldX, worldY)` 处的洞穴/拱廊有符号距离场 (Signed Distance Field)
   * 返回值 `< 0` 表示处于天然岩洞/礁石拱门内部通道，`> 0` 表示在外部开放水域。
   * 由于直接基于全局 Voronoi 单元格采样，洞穴绝不会被 Chunk 边界截断。
   */
  public evaluateCaveSignedDistance(worldX: number, worldY: number): number {
    const vor = this.worldGen.voronoi1D(worldX, this.structureCellSpan, 503);
    const env = this.biomeMgr.sampleEnvironmentFields(vor.cellCenterX, worldY);

    // 规则约束：洞穴只生成在岩体坡度较高 (`slope > 0.28`) 或海底峡谷/礁石密集区，绝不在平坦沙地突兀出现
    const canHostCave =
      env.slope > 0.28 ||
      env.biome === 'SUBMARINE_CANYON_DROP' ||
      env.biome === 'DENSE_REEF_PASSAGE' ||
      env.biome === 'HADAL_TRENCH_CHASM';
    if (!canHostCave) {
      return 999;
    }

    const roll = this.worldGen.hash1D(vor.cellIndex, 521);
    if (roll > 0.52) {
      return 999;
    }

    const archRadiusX = 135 + this.worldGen.hash1D(vor.cellIndex, 541) * 85;
    const archRadiusY = 72 + this.worldGen.hash1D(vor.cellIndex, 557) * 45;
    const caveCenterY = Math.max(140, Math.min(2100, worldY));

    const nx = (worldX - vor.cellCenterX) / archRadiusX;
    const ny = (worldY - caveCenterY) / archRadiusY;
    const warp = this.worldGen.noise2D(worldX * 0.006, worldY * 0.006, 569) * 0.18;
    return Math.hypot(nx, ny) + warp - 1.0;
  }

  /**
   * 获取覆盖 `[startX, endX]` 的所有 L2 地貌结构实例
   * 采用全局 Voronoi 网格索引扫描（含左右跨界扩展格），因此跨 Chunk 边界的大型洞穴或岩壁在两个相邻 Chunk 中拥有完全一致的世界坐标。
   */
  public generateStructuresForRange(
    startX: number,
    endX: number,
    referenceDepthY: number
  ): LandformStructureInstance[] {
    const results: LandformStructureInstance[] = [];
    const span = this.structureCellSpan;
    const firstCell = Math.floor((startX - span * 0.5) / span);
    const lastCell = Math.ceil((endX + span * 0.5) / span);

    for (let cellIdx = firstCell; cellIdx <= lastCell; cellIdx++) {
      const jitter = (this.worldGen.hash1D(cellIdx, 503) - 0.5) * 0.56;
      const centerX = (cellIdx + 0.5 + jitter) * span;
      const width = 210 + this.worldGen.hash1D(cellIdx, 601) * 210;

      // 若该结构包围盒与当前 Chunk 区间无交集则跳过
      if (centerX + width * 0.5 < startX || centerX - width * 0.5 > endX) {
        continue;
      }

      const env = this.biomeMgr.sampleEnvironmentFields(centerX, referenceDepthY);
      const typeRoll = this.worldGen.hash1D(cellIdx, 613);
      let kind: LandformStructureKind;

      if (env.biome === 'SANDY_OPEN_FLAT' && env.slope < 0.42) {
        kind = 'SAND_DUNE_RIDGE';
      } else if (env.depth > 1050 && typeRoll < 0.58) {
        kind = 'HYDROTHERMAL_MOUND';
      } else if (
        (env.biome === 'SUBMARINE_CANYON_DROP' || env.slope > 0.32) &&
        typeRoll < 0.48
      ) {
        kind = 'CAVE_CHAMBER';
      } else if (
        (env.biome === 'DENSE_REEF_PASSAGE' || env.biome === 'SHALLOW_CORAL_REEF') &&
        typeRoll < 0.68
      ) {
        kind = 'REEF_ARCHWAY';
      } else if (env.slope > 0.38) {
        kind = 'CONTINUOUS_CLIFF';
      } else {
        kind = 'CANYON_PILLAR';
      }

      const height =
        kind === 'SAND_DUNE_RIDGE'
          ? 52 + this.worldGen.hash1D(cellIdx, 619) * 38
          : kind === 'CAVE_CHAMBER' || kind === 'REEF_ARCHWAY'
          ? 145 + this.worldGen.hash1D(cellIdx, 619) * 95
          : 120 + this.worldGen.hash1D(cellIdx, 619) * 110;

      results.push({
        id: `struct_${cellIdx}`,
        kind,
        centerX,
        baseY: env.depth,
        width,
        height,
        archRadius: kind === 'CAVE_CHAMBER' || kind === 'REEF_ARCHWAY' ? width * 0.35 : 0,
        slope: env.slope,
        seed: Math.floor(this.worldGen.hash1D(cellIdx, 631) * 0x7fffffff),
        biome: env.biome,
      });
    }

    return results;
  }
}

// ============================================================================
// 5. 模块五：EcologyGenerator（群落中心 + Poisson Disk Sampling + 环境过滤）
// ============================================================================

export class EcologyGenerator {
  private readonly worldGen: WorldGenerator;
  private readonly biomeMgr: BiomeManager;
  public readonly clusterCellSpan: number = 280;

  constructor(worldGen: WorldGenerator, biomeMgr: BiomeManager) {
    this.worldGen = worldGen;
    this.biomeMgr = biomeMgr;
  }

  /**
   * 规范第 7、8、13 节：生成指定二维 Chunk `(chunkX, chunkY)` 的生态对象纯数据 `generateEcology`
   */
  public generateEcology(
    chunkX: number,
    chunkY: number,
    config: WorldConfigType = WorldConfig
  ): GeneratedObject[] {
    return generateEcology(chunkX, chunkY, config);
  }

  /**
   * 方案第四节核心算法：在给定群落圆形区域内执行 Poisson Disk Sampling + 微小位置扰动
   * 保证任意两个生成点之间的欧氏距离 `>= minDistance`，消除纯随机堆叠伪影。
   */
  public samplePoissonDiskInCluster(
    cluster: EcologyCluster,
    minDistance: number,
    maxPoints: number
  ): Array<{ x: number; y: number; rNorm: number; seed: number }> {
    const rng = this.worldGen.createSeededRng(cluster.seed);
    const accepted: Array<{ x: number; y: number; rNorm: number; seed: number }> = [];
    const safeMinDist = Math.max(12, minDistance);
    const minDistSq = safeMinDist * safeMinDist;
    const maxCandidates = Math.max(16, maxPoints * 9);

    for (let attempt = 0; attempt < maxCandidates && accepted.length < maxPoints; attempt++) {
      // 聚集式径向分布：中心密度更高、边缘自然稀疏 (sqrt(u) * u^0.35)
      const angle = rng() * Math.PI * 2;
      const radialBias = Math.pow(rng(), 0.68);
      const r = radialBias * cluster.radius;
      // 添加小幅自然位置扰动
      const jitterX = (rng() - 0.5) * safeMinDist * 0.28;
      const jitterY = (rng() - 0.5) * safeMinDist * 0.28;
      const px = cluster.center.x + Math.cos(angle) * r + jitterX;
      const py = cluster.center.y + Math.sin(angle) * r * 0.45 + jitterY;

      let conflict = false;
      for (let i = 0; i < accepted.length; i++) {
        const dx = px - accepted[i].x;
        const dy = py - accepted[i].y;
        if (dx * dx + dy * dy < minDistSq) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        accepted.push({
          x: px,
          y: py,
          rNorm: radialBias,
          seed: Math.floor(rng() * 0x7fffffff),
        });
      }
    }

    return accepted;
  }

  /**
   * 根据环境场决定群落类型、半径与密度 (Section 4)
   */
  public generateClustersAndDecorationsForRange(
    startX: number,
    endX: number,
    referenceDepthY: number
  ): {
    clusters: EcologyCluster[];
    decorations: DecorationPropInstance[];
  } {
    const clusters: EcologyCluster[] = [];
    const decorations: DecorationPropInstance[] = [];

    const span = this.clusterCellSpan;
    const firstCell = Math.floor(startX / span);
    const lastCell = Math.floor(endX / span);

    for (let cellIdx = firstCell; cellIdx <= lastCell; cellIdx++) {
      const cellRng = this.worldGen.createSeededRng(cellIdx * 7919 + 104729);
      const centerX = (cellIdx + 0.16 + cellRng() * 0.68) * span;
      if (centerX < startX || centerX > endX) continue;

      const env = this.biomeMgr.sampleEnvironmentFields(centerX, referenceDepthY);
      const coralProb = this.worldGen.coralProbability(env);
      const grassProb = this.worldGen.seagrassProbability(env);
      const kelpProb = this.worldGen.kelpForestProbability(env);
      const biolumProb = this.worldGen.biolumProbability(env);

      // 根据环境场与宏观区域决定群落类型（而非无视环境纯随机抽取）
      let clusterType: EcologyClusterType = 'boulder_outcrop';
      let preferredPreyArchetype: EcologyCluster['preferredPreyArchetype'] = 'REEF_SWARM';

      if (env.depth > 1100) {
        clusterType = cellRng() < 0.58 ? 'hydrothermal_oasis' : 'biolum_grove';
        preferredPreyArchetype = 'ABYSS_APEX';
      } else if (biolumProb > 0.45 && env.depth > 520) {
        clusterType = 'biolum_grove';
        preferredPreyArchetype = 'BIOLUM_DRIFTER';
      } else if (env.biome === 'SANDY_OPEN_FLAT' && grassProb > 0.18) {
        clusterType = cellRng() < 0.72 ? 'seagrass_meadow' : 'coral_reef';
        preferredPreyArchetype = 'SAND_GRAZER';
      } else if (
        (env.biome === 'SUBMARINE_CANYON_DROP' || kelpProb > 0.18) &&
        cellRng() < 0.52
      ) {
        clusterType = 'kelp_forest';
        preferredPreyArchetype = 'CANYON_HUNTER';
      } else if (coralProb >= grassProb && coralProb > 0.18) {
        clusterType = 'coral_reef';
        preferredPreyArchetype = 'REEF_SWARM';
      } else if (grassProb > 0.2) {
        clusterType = 'seagrass_meadow';
        preferredPreyArchetype = 'SAND_GRAZER';
      } else if (kelpProb > 0.15) {
        clusterType = 'kelp_forest';
        preferredPreyArchetype = 'CANYON_HUNTER';
      }

      const radius = 120 + cellRng() * 145;
      const baseDensity =
        clusterType === 'coral_reef'
          ? 0.84
          : clusterType === 'seagrass_meadow'
          ? 0.88
          : clusterType === 'kelp_forest'
          ? 0.76
          : clusterType === 'biolum_grove'
          ? 0.8
          : 0.65;

      const cluster: EcologyCluster = {
        id: `cluster_${cellIdx}`,
        center: { x: centerX, y: env.depth },
        radius,
        type: clusterType,
        density: Number(Math.min(1, baseDensity).toFixed(2)),
        seed: Math.floor(cellRng() * 0x7fffffff),
        biome: env.biome,
        preferredPreyArchetype,
      };
      clusters.push(cluster);

      // 在群落内部执行 Poisson Disk Sampling 并按坡度/深度环境条件过滤对象
      const targetPoints = Math.max(3, Math.round(cluster.density * 5));
      const minSpacing = clusterType === 'seagrass_meadow' ? 38 : 54;
      const samples = this.samplePoissonDiskInCluster(cluster, minSpacing, targetPoints);

      for (let sIdx = 0; sIdx < samples.length; sIdx++) {
        const pt = samples[sIdx];
        const localEnv = this.biomeMgr.sampleEnvironmentFields(pt.x, pt.y);

        // 环境条件过滤：陡坡 (`slope > 0.72`) 不长海草，深渊不长浅海鹿角珊瑚
        if (clusterType === 'seagrass_meadow' && localEnv.slope > 0.72) {
          continue;
        }
        if (clusterType === 'coral_reef' && localEnv.depth > 620) {
          continue;
        }

        const propSpec = this.pickDecorationPropSpec(clusterType, pt.seed);
        decorations.push({
          id: `${cluster.id}_prop_${sIdx}`,
          clusterId: cluster.id,
          kind: propSpec.kind,
          x: pt.x,
          y: pt.y,
          scale: (0.72 + (1 - pt.rNorm * 0.45) * 0.48) * propSpec.baseScale,
          rotation: ((pt.seed % 100) / 100 - 0.5) * 0.22,
          swayPhase: (pt.seed % 628) / 100,
          tintHex: propSpec.tintHex,
          secondaryHex: propSpec.secondaryHex,
          lodPriority: sIdx < 2 ? 0 : sIdx < 4 ? 1 : 2,
        });
      }
    }

    return { clusters, decorations };
  }

  private pickDecorationPropSpec(
    clusterType: EcologyClusterType,
    seed: number
  ): {
    kind: DecorationPropKind;
    baseScale: number;
    tintHex: string;
    secondaryHex: string;
  } {
    const r = seed % 100;
    switch (clusterType) {
      case 'coral_reef':
        if (r < 42) {
          return {
            kind: 'STAGHORN_CORAL',
            baseScale: 0.88,
            tintHex: '#e11d48',
            secondaryHex: '#fda4af',
          };
        }
        if (r < 75) {
          return {
            kind: 'TUBE_SPONGE',
            baseScale: 0.82,
            tintHex: '#7e22ce',
            secondaryHex: '#d8b4fe',
          };
        }
        return {
          kind: 'BRAIN_CORAL',
          baseScale: 0.85,
          tintHex: '#d97706',
          secondaryHex: '#fde68a',
        };
      case 'seagrass_meadow':
        return {
          kind: 'SEAGRASS_TUFT',
          baseScale: 0.92,
          tintHex: '#059669',
          secondaryHex: '#6ee7b7',
        };
      case 'kelp_forest':
        return {
          kind: 'GIANT_KELP_STALK',
          baseScale: 1.05,
          tintHex: '#047857',
          secondaryHex: '#34d399',
        };
      case 'biolum_grove':
        return r < 58
          ? {
              kind: 'BIOLUM_SEA_WHIP',
              baseScale: 0.95,
              tintHex: '#0891b2',
              secondaryHex: '#67e8f9',
            }
          : {
              kind: 'GLOW_ANEMONE',
              baseScale: 0.88,
              tintHex: '#4f46e5',
              secondaryHex: '#c7d2fe',
            };
      case 'hydrothermal_oasis':
        return r < 62
          ? {
              kind: 'HYDROTHERMAL_BUBBLE_VENT',
              baseScale: 0.96,
              tintHex: '#ea580c',
              secondaryHex: '#fed7aa',
            }
          : {
              kind: 'ABYSSAL_CRYSTAL_SPIRE',
              baseScale: 0.92,
              tintHex: '#7e22ce',
              secondaryHex: '#e9d5ff',
            };
      default:
        return {
          kind: 'MOSSY_BOULDER',
          baseScale: 0.88,
          tintHex: '#334155',
          secondaryHex: '#94a3b8',
        };
    }
  }
}

// ============================================================================
// 6. 模块六：ChunkManager（屏外预生成、LRU 缓存与远端回收）
// ============================================================================

export class ChunkManager {
  public readonly chunkWidth: number = 1024;
  public readonly terrainSampleStep: number = 32;
  public readonly preloadRadiusChunks: number = 2;
  public readonly maxCachedChunks: number = 16;

  private readonly biomeMgr: BiomeManager;
  private readonly terrainGen: TerrainGenerator;
  private readonly structureGen: StructureGenerator;
  private readonly ecologyGen: EcologyGenerator;

  private readonly chunkCache: Map<number, WorldChunkData> = new Map();
  private lastDepthBandKey: number = 0;

  constructor(
    biomeMgr: BiomeManager,
    terrainGen: TerrainGenerator,
    structureGen: StructureGenerator,
    ecologyGen: EcologyGenerator
  ) {
    this.biomeMgr = biomeMgr;
    this.terrainGen = terrainGen;
    this.structureGen = structureGen;
    this.ecologyGen = ecologyGen;
  }

  public worldXToChunkIndex(worldX: number): number {
    return Math.floor(worldX / this.chunkWidth);
  }

  /**
   * 获取或即时生成指定 `chunkIndex` 的完整 Chunk 数据
   */
  public getOrGenerateChunk(
    chunkIndex: number,
    referenceDepthY: number = 260,
    nowMs: number = 0
  ): WorldChunkData {
    // 当玩家跨越大深度带（每 220m 一档）时刷新生态群落缓存以贴合当前深度场
    const depthBandKey = Math.floor(Math.max(0, referenceDepthY) / 220);
    if (depthBandKey !== this.lastDepthBandKey) {
      this.chunkCache.clear();
      this.lastDepthBandKey = depthBandKey;
    }

    const existing = this.chunkCache.get(chunkIndex);
    if (existing) {
      existing.lastAccessedTime = nowMs;
      return existing;
    }

    const startX = chunkIndex * this.chunkWidth;
    const endX = startX + this.chunkWidth;
    const centerX = startX + this.chunkWidth * 0.5;

    const macro = this.biomeMgr.evaluateMacroZone(centerX, referenceDepthY);
    const profiles = this.terrainGen.generateChunkTerrainProfiles(
      startX,
      endX,
      this.terrainSampleStep,
      referenceDepthY
    );
    const structures = this.structureGen.generateStructuresForRange(
      startX,
      endX,
      referenceDepthY
    );
    const { clusters, decorations } =
      this.ecologyGen.generateClustersAndDecorationsForRange(
        startX,
        endX,
        referenceDepthY
      );

    const chunk: WorldChunkData = {
      chunkIndex,
      startX,
      endX,
      width: this.chunkWidth,
      macroBiome: macro.primaryBiome,
      macroGeography: macro.macroGeography,
      terrainSampleStep: this.terrainSampleStep,
      heightSamples: profiles.heightSamples,
      midStratumSamples: profiles.midStratumSamples,
      farRidgeSamples: profiles.farRidgeSamples,
      slopeSamples: profiles.slopeSamples,
      structures,
      clusters,
      decorations,
      lastAccessedTime: nowMs,
    };

    this.chunkCache.set(chunkIndex, chunk);
    this.evictDistantChunks(chunkIndex);
    return chunk;
  }

  /**
   * 屏外预生成活跃区域 `[centerChunk - preloadRadius .. centerChunk + preloadRadius]` 并返回当前活跃 Chunk 列表
   */
  public updateActiveChunks(
    cameraX: number,
    referenceDepthY: number,
    nowMs: number = 0
  ): WorldChunkData[] {
    const centerChunk = this.worldXToChunkIndex(cameraX);
    const active: WorldChunkData[] = [];
    for (
      let c = centerChunk - this.preloadRadiusChunks;
      c <= centerChunk + this.preloadRadiusChunks;
      c++
    ) {
      active.push(this.getOrGenerateChunk(c, referenceDepthY, nowMs));
    }
    return active;
  }

  private evictDistantChunks(centerChunkIndex: number): void {
    if (this.chunkCache.size <= this.maxCachedChunks) return;
    for (const [idx] of this.chunkCache) {
      if (Math.abs(idx - centerChunkIndex) > this.preloadRadiusChunks + 3) {
        this.chunkCache.delete(idx);
      }
    }
  }

  public getCachedChunkCount(): number {
    return this.chunkCache.size;
  }
}

// ============================================================================
// 7. 模块七：DecorationRenderer（连续地形轮廓、L2 地貌结构与 L3 聚集生态 LOD 绘制器）
// ============================================================================

export class DecorationRenderer {
  /**
   * 采样任意全局坐标 `worldX` 处在活跃 Chunk 中的连续海床高度偏移 (px)
   * 相邻 Chunk 在边界 `startX / endX` 处共享完全一致的采样值，保证跨 Chunk 地形轮廓 100% 无缝连续。
   */
  public sampleContinuousSeabedOffsetPx(
    activeChunks: readonly WorldChunkData[],
    worldX: number,
    nearScale: number = 1.0,
    profileKind: 'NEAR' | 'MID' | 'FAR' = 'NEAR'
  ): number {
    for (let i = 0; i < activeChunks.length; i++) {
      const ch = activeChunks[i];
      if (worldX >= ch.startX && worldX <= ch.endX) {
        const relX = worldX - ch.startX;
        const exactIdx = relX / ch.terrainSampleStep;
        const idx0 = Math.max(0, Math.min(ch.heightSamples.length - 1, Math.floor(exactIdx)));
        const idx1 = Math.max(0, Math.min(ch.heightSamples.length - 1, idx0 + 1));
        const frac = exactIdx - idx0;
        const arr =
          profileKind === 'FAR'
            ? ch.farRidgeSamples
            : profileKind === 'MID'
            ? ch.midStratumSamples
            : ch.heightSamples;
        const rawVal = arr[idx0] * (1 - frac) + arr[idx1] * frac;
        const scaleFactor =
          profileKind === 'FAR' ? 0.14 : profileKind === 'MID' ? 0.12 : 0.085;
        return Math.max(-78, Math.min(78, rawVal * scaleFactor)) * nearScale;
      }
    }
    return 0;
  }

  /**
   * 绘制中景 L1 连续岩层/沙丘剖面与 L2 地貌结构（礁石通道拱门 REEF_ARCHWAY、跨边界 SDF 洞穴 CAVE_CHAMBER、
   * 浅海波纹沙丘 SAND_DUNE_RIDGE、海底峡谷阶梯岩壁 CONTINUOUS_CLIFF / CANYON_PILLAR、深渊热液烟囱 HYDROTHERMAL_MOUND）
   * 位于 Mid 图层与 Near 海床图层之间，形成强烈的立体纵深与地理探索节奏感。
   */
  public renderMidgroundStructuresAndStrata(
    ctx: CanvasRenderingContext2D,
    activeChunks: readonly WorldChunkData[],
    cameraX: number,
    depthRefY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    nearScale: number = 1.0,
    seabedCrestBaseY: number = viewH - 135
  ): void {
    if (activeChunks.length === 0) return;

    const parallaxX = 0.28;
    const effScale = Math.max(0.45, nearScale);
    const worldCenterAtScreenCenter = (cameraX * parallaxX) / effScale;
    const halfWorldSpan = (viewW * 0.72) / effScale;
    const minVisibleWorldX = worldCenterAtScreenCenter - halfWorldSpan;
    const maxVisibleWorldX = worldCenterAtScreenCenter + halfWorldSpan;

    const worldToScreenX = (wx: number): number =>
      viewW * 0.5 + (wx - worldCenterAtScreenCenter) * effScale;
    const screenToWorldX = (sx: number): number =>
      worldCenterAtScreenCenter + (sx - viewW * 0.5) / effScale;

    const isAbyss = depthRefY > 1100;
    const isTwilight = depthRefY > 520 && !isAbyss;
    const tSec = nowMs * 0.001;

    ctx.save();

    // 1. 绘制 L1 中景连续海底山脉/大陆坡/沙洲轮廓多边形 (Chunk 边界 100% 连续)
    const midBaseY = seabedCrestBaseY - 22 * effScale;
    ctx.beginPath();
    ctx.moveTo(-8, viewH + 16);
    const stepPx = 24;
    for (let sx = -8; sx <= viewW + stepPx; sx += stepPx) {
      const wx = screenToWorldX(sx);
      const contourH = this.sampleContinuousSeabedOffsetPx(
        activeChunks,
        wx,
        effScale,
        'MID'
      );
      const sy = midBaseY - contourH;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(viewW + 16, viewH + 16);
    ctx.closePath();

    const midGrad = ctx.createLinearGradient(0, midBaseY - 95 * effScale, 0, viewH);
    if (isAbyss) {
      midGrad.addColorStop(0, 'rgba(30, 27, 75, 0.45)');
      midGrad.addColorStop(0.6, 'rgba(17, 12, 36, 0.62)');
      midGrad.addColorStop(1, 'rgba(9, 7, 18, 0.78)');
    } else if (isTwilight) {
      midGrad.addColorStop(0, 'rgba(15, 38, 82, 0.38)');
      midGrad.addColorStop(0.6, 'rgba(12, 25, 58, 0.55)');
      midGrad.addColorStop(1, 'rgba(8, 16, 38, 0.72)');
    } else {
      midGrad.addColorStop(0, 'rgba(12, 108, 152, 0.32)');
      midGrad.addColorStop(0.55, 'rgba(14, 86, 128, 0.48)');
      midGrad.addColorStop(1, 'rgba(8, 52, 86, 0.66)');
    }
    ctx.fillStyle = midGrad;
    ctx.fill();

    // 中景山脊高光轮廓线
    ctx.strokeStyle = isAbyss
      ? 'rgba(249, 115, 22, 0.28)'
      : isTwilight
      ? 'rgba(56, 189, 248, 0.26)'
      : 'rgba(125, 211, 252, 0.34)';
    ctx.lineWidth = 1.8 * effScale;
    ctx.stroke();

    // 2. 绘制 L2 宏观地貌结构（Voronoi + 规则模板生成）
    const renderedStructIds = new Set<string>();
    for (let cIdx = 0; cIdx < activeChunks.length; cIdx++) {
      const chunk = activeChunks[cIdx];
      for (let sIdx = 0; sIdx < chunk.structures.length; sIdx++) {
        const st = chunk.structures[sIdx];
        if (renderedStructIds.has(st.id)) continue;
        if (
          st.centerX + st.width < minVisibleWorldX ||
          st.centerX - st.width > maxVisibleWorldX
        ) {
          continue;
        }
        renderedStructIds.add(st.id);

        const sx = worldToScreenX(st.centerX);
        const localContourH = this.sampleContinuousSeabedOffsetPx(
          activeChunks,
          st.centerX,
          effScale,
          'MID'
        );
        const sy = midBaseY - localContourH + 18 * effScale;
        const sw = st.width * effScale * 0.74;
        const sh = st.height * effScale * 0.72;

        ctx.save();
        if (st.kind === 'SAND_DUNE_RIDGE') {
          // 浅海开阔区波纹沙丘 (SANDY_OPEN_FLAT)
          const duneGrad = ctx.createLinearGradient(sx, sy - sh, sx, sy + 28);
          duneGrad.addColorStop(0, isAbyss ? 'rgba(68, 52, 88, 0.48)' : isTwilight ? 'rgba(30, 88, 138, 0.45)' : 'rgba(251, 191, 36, 0.44)');
          duneGrad.addColorStop(1, isAbyss ? 'rgba(24, 16, 38, 0.68)' : isTwilight ? 'rgba(15, 42, 78, 0.64)' : 'rgba(180, 120, 28, 0.58)');
          ctx.fillStyle = duneGrad;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.65, sy + 24);
          ctx.quadraticCurveTo(sx - sw * 0.18, sy - sh * 1.05, sx + sw * 0.08, sy - sh * 0.75);
          ctx.quadraticCurveTo(sx + sw * 0.38, sy - sh * 0.42, sx + sw * 0.65, sy + 24);
          ctx.closePath();
          ctx.fill();

          // 沙丘阳光波纹脊线
          ctx.strokeStyle = isTwilight ? 'rgba(103, 232, 249, 0.32)' : 'rgba(254, 240, 138, 0.46)';
          ctx.lineWidth = 1.8 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.48, sy + 8);
          ctx.quadraticCurveTo(sx - sw * 0.12, sy - sh * 0.88, sx + sw * 0.42, sy + 6);
          ctx.stroke();
        } else if (st.kind === 'CAVE_CHAMBER' || st.kind === 'REEF_ARCHWAY') {
          // 天然礁石拱门 (REEF_ARCHWAY) 与跨边界 SDF 岩洞腔体 (CAVE_CHAMBER)
          const rockGrad = ctx.createLinearGradient(sx, sy - sh, sx, sy + 30);
          if (isAbyss) {
            rockGrad.addColorStop(0, 'rgba(49, 46, 129, 0.62)');
            rockGrad.addColorStop(1, 'rgba(15, 11, 29, 0.78)');
          } else if (isTwilight) {
            rockGrad.addColorStop(0, 'rgba(30, 58, 138, 0.56)');
            rockGrad.addColorStop(1, 'rgba(15, 23, 42, 0.74)');
          } else {
            rockGrad.addColorStop(0, 'rgba(14, 116, 144, 0.52)');
            rockGrad.addColorStop(0.5, 'rgba(15, 82, 118, 0.64)');
            rockGrad.addColorStop(1, 'rgba(12, 48, 76, 0.76)');
          }
          ctx.fillStyle = rockGrad;

          const archW = sw * 0.3;
          const archH = sh * 0.58;

          ctx.beginPath();
          // 外层自然层叠岩拱轮廓
          ctx.moveTo(sx - sw * 0.56, sy + 32);
          ctx.lineTo(sx - sw * 0.46, sy - sh * 0.48);
          ctx.quadraticCurveTo(sx - sw * 0.24, sy - sh * 1.04, sx, sy - sh * 0.98);
          ctx.quadraticCurveTo(sx + sw * 0.26, sy - sh * 1.02, sx + sw * 0.46, sy - sh * 0.44);
          ctx.lineTo(sx + sw * 0.56, sy + 32);
          ctx.closePath();

          // 内层拱洞镂空通道 (evenodd)
          ctx.moveTo(sx - archW, sy + 28);
          ctx.quadraticCurveTo(sx - archW * 0.85, sy - archH, sx, sy - archH * 1.06);
          ctx.quadraticCurveTo(sx + archW * 0.85, sy - archH, sx + archW, sy + 28);
          ctx.closePath();
          ctx.fill('evenodd');

          // 拱门顶部受光边缘高光
          ctx.strokeStyle = isAbyss
            ? 'rgba(251, 146, 60, 0.36)'
            : isTwilight
            ? 'rgba(34, 211, 238, 0.34)'
            : 'rgba(125, 211, 252, 0.44)';
          ctx.lineWidth = 2.0 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.44, sy - sh * 0.46);
          ctx.quadraticCurveTo(sx, sy - sh * 1.02, sx + sw * 0.44, sy - sh * 0.42);
          ctx.stroke();
        } else if (st.kind === 'HYDROTHERMAL_MOUND') {
          // 深渊热液黑烟囱岩冢 (HYDROTHERMAL_MOUND)
          ctx.fillStyle = 'rgba(24, 16, 36, 0.78)';
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.42, sy + 28);
          ctx.lineTo(sx - sw * 0.18, sy - sh * 0.96);
          ctx.lineTo(sx + sw * 0.16, sy - sh * 0.92);
          ctx.lineTo(sx + sw * 0.42, sy + 28);
          ctx.closePath();
          ctx.fill();

          // 熔岩裂缝发光脉络
          const pulse = 0.65 + 0.35 * Math.sin(tSec * 2.6 + st.seed);
          ctx.strokeStyle = `rgba(251, 146, 60, ${(0.58 * pulse).toFixed(2)})`;
          ctx.lineWidth = 2.2 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.06, sy - sh * 0.9);
          ctx.lineTo(sx + sw * 0.04, sy - sh * 0.45);
          ctx.lineTo(sx - sw * 0.08, sy + 4);
          ctx.stroke();
        } else {
          // 海底峡谷阶梯岩壁 / 峡谷石柱 (CONTINUOUS_CLIFF / CANYON_PILLAR)
          ctx.fillStyle = isAbyss
            ? 'rgba(30, 27, 75, 0.64)'
            : isTwilight
            ? 'rgba(23, 37, 84, 0.58)'
            : 'rgba(14, 94, 132, 0.52)';
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.45, sy + 28);
          ctx.lineTo(sx - sw * 0.36, sy - sh * 0.48);
          ctx.lineTo(sx - sw * 0.22, sy - sh * 0.52);
          ctx.lineTo(sx - sw * 0.14, sy - sh);
          ctx.lineTo(sx + sw * 0.18, sy - sh * 0.94);
          ctx.lineTo(sx + sw * 0.28, sy - sh * 0.46);
          ctx.lineTo(sx + sw * 0.45, sy + 28);
          ctx.closePath();
          ctx.fill();

          // 岩壁水平沉积岩层线
          ctx.strokeStyle = isTwilight
            ? 'rgba(56, 189, 248, 0.28)'
            : 'rgba(125, 211, 252, 0.34)';
          ctx.lineWidth = 1.6 * effScale;
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.34, sy - sh * 0.48);
          ctx.lineTo(sx + sw * 0.26, sy - sh * 0.46);
          ctx.moveTo(sx - sw * 0.14, sy - sh);
          ctx.lineTo(sx + sw * 0.18, sy - sh * 0.94);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * 绘制前景 L1 连续海床轮廓与 L3 Poisson Disk 聚集式生态群落装饰（带 3 级 LOD 裁剪）
   */
  public renderProceduralWorldOverlay(
    ctx: CanvasRenderingContext2D,
    activeChunks: readonly WorldChunkData[],
    cameraX: number,
    depthRefY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    nearScale: number = 1.0,
    seabedBaseOffsetY: number = 0,
    nearPlaneTargetH: number = 180
  ): void {
    if (activeChunks.length === 0) return;

    const parallaxX = 0.38;
    const effScale = Math.max(0.45, nearScale);
    const worldCenterAtScreenCenter = (cameraX * parallaxX) / effScale;
    const halfWorldSpan = (viewW * 0.68) / effScale;
    const minVisibleWorldX = worldCenterAtScreenCenter - halfWorldSpan;
    const maxVisibleWorldX = worldCenterAtScreenCenter + halfWorldSpan;

    const worldToScreenX = (wx: number): number =>
      viewW * 0.5 + (wx - worldCenterAtScreenCenter) * effScale;
    const screenToWorldX = (sx: number): number =>
      worldCenterAtScreenCenter + (sx - viewW * 0.5) / effScale;

    // 关键锚点：海床基准线位于屏幕下方海床表面的真实视觉脊线处（距屏幕底边约 44% nearPlaneTargetH）
    const visibleSeabedCrestY = Math.min(
      viewH - 28 * effScale,
      viewH - nearPlaneTargetH * 0.44 + seabedBaseOffsetY * 0.45
    );
    const isAbyss = depthRefY > 1100;
    const isTwilight = depthRefY > 520 && !isAbyss;
    const tSec = nowMs * 0.001;

    ctx.save();

    // 1. 绘制前景 L1 连续起伏海床表面层与发光/阳光沙脊边缘线
    ctx.beginPath();
    ctx.moveTo(-8, viewH + 16);
    const stepPx = 20;
    for (let sx = -8; sx <= viewW + stepPx; sx += stepPx) {
      const wx = screenToWorldX(sx);
      const localH = this.sampleContinuousSeabedOffsetPx(
        activeChunks,
        wx,
        effScale,
        'NEAR'
      );
      const sy = visibleSeabedCrestY - localH;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(viewW + 16, viewH + 16);
    ctx.closePath();

    const nearFloorGrad = ctx.createLinearGradient(
      0,
      visibleSeabedCrestY - 50 * effScale,
      0,
      viewH
    );
    if (isAbyss) {
      nearFloorGrad.addColorStop(0, 'rgba(59, 24, 56, 0.24)');
      nearFloorGrad.addColorStop(0.5, 'rgba(24, 11, 32, 0.36)');
      nearFloorGrad.addColorStop(1, 'rgba(9, 5, 15, 0.52)');
    } else if (isTwilight) {
      nearFloorGrad.addColorStop(0, 'rgba(14, 58, 104, 0.22)');
      nearFloorGrad.addColorStop(0.5, 'rgba(10, 32, 68, 0.34)');
      nearFloorGrad.addColorStop(1, 'rgba(6, 16, 38, 0.48)');
    } else {
      nearFloorGrad.addColorStop(0, 'rgba(245, 188, 72, 0.20)');
      nearFloorGrad.addColorStop(0.45, 'rgba(180, 124, 42, 0.28)');
      nearFloorGrad.addColorStop(1, 'rgba(18, 62, 88, 0.44)');
    }
    ctx.fillStyle = nearFloorGrad;
    ctx.fill();

    // 海床顶部连续受光脊线
    ctx.strokeStyle = isAbyss
      ? 'rgba(251, 146, 60, 0.38)'
      : isTwilight
      ? 'rgba(34, 211, 238, 0.36)'
      : 'rgba(254, 240, 138, 0.42)';
    ctx.lineWidth = 2.0 * effScale;
    ctx.stroke();

    // 2. 绘制 L3 Poisson Disk 聚集式生态群落装饰（按离屏幕中心距离自动分级 LOD0 / LOD1 / LOD2）
    for (let cIdx = 0; cIdx < activeChunks.length; cIdx++) {
      const chunk = activeChunks[cIdx];
      for (let dIdx = 0; dIdx < chunk.decorations.length; dIdx++) {
        const prop = chunk.decorations[dIdx];
        if (prop.x < minVisibleWorldX || prop.x > maxVisibleWorldX) continue;

        const sx = worldToScreenX(prop.x);
        const distFromCenterRatio = Math.abs(sx - viewW * 0.5) / Math.max(1, viewW * 0.5);

        // LOD 裁剪：边缘区域 (>88% 半屏宽) 仅绘制 LOD0/LOD1 主景，略过 LOD2 微细节
        if (distFromCenterRatio > 0.88 && prop.lodPriority === 2) continue;
        if (distFromCenterRatio > 1.12 && prop.lodPriority >= 1) continue;

        const localH = this.sampleContinuousSeabedOffsetPx(
          activeChunks,
          prop.x,
          effScale,
          'NEAR'
        );
        // 在群落内部赋予轻微的前后纵深层次错落 (-8px .. +22px)
        const depthJitterY = (((prop.swayPhase * 100) % 30) - 8) * effScale;
        const sy = visibleSeabedCrestY - localH + depthJitterY;
        const drawScale = prop.scale * effScale;
        const sway = Math.sin(tSec * 2.1 + prop.swayPhase) * 8 * drawScale;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(prop.rotation);

        // 根部海床环境闭塞柔和阴影 (Ambient Occlusion Ground Shadow)
        ctx.fillStyle = 'rgba(6, 21, 40, 0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 4 * drawScale, 14 * drawScale, 4.2 * drawScale, 0, 0, Math.PI * 2);
        ctx.fill();

        switch (prop.kind) {
          case 'SEAGRASS_TUFT':
          case 'GIANT_KELP_STALK': {
            const isKelp = prop.kind === 'GIANT_KELP_STALK';
            const bladeCount = isKelp ? 3 : 4;
            const bladeH = (isKelp ? 76 : 36) * drawScale;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.78;
            const bladeGrad = ctx.createLinearGradient(0, 4 * drawScale, 0, -bladeH);
            bladeGrad.addColorStop(0, '#064e3b');
            bladeGrad.addColorStop(0.55, prop.tintHex);
            bladeGrad.addColorStop(1, prop.secondaryHex);

            for (let b = 0; b < bladeCount; b++) {
              const bx = (b - (bladeCount - 1) * 0.5) * (isKelp ? 7.5 : 5.0) * drawScale;
              const bH = bladeH * (0.76 + (b % 2) * 0.24);
              const tipX = bx + sway * (0.85 + b * 0.12);
              ctx.strokeStyle = bladeGrad;
              ctx.lineWidth = Math.max(2.0, (isKelp ? 3.8 : 2.6) * drawScale);
              ctx.beginPath();
              ctx.moveTo(bx, 5 * drawScale);
              ctx.quadraticCurveTo(bx + sway * 0.45, -bH * 0.52, tipX, -bH);
              ctx.stroke();

              // 巨藻叶片细节
              if (isKelp) {
                ctx.fillStyle = bladeGrad;
                for (let lf = 1; lf <= 3; lf++) {
                  const ly = -bH * (lf * 0.26);
                  const lx = bx + sway * (lf * 0.25);
                  const dir = lf % 2 === 0 ? 1 : -1;
                  ctx.beginPath();
                  ctx.ellipse(
                    lx + dir * 6 * drawScale,
                    ly,
                    6.5 * drawScale,
                    2.8 * drawScale,
                    dir * 0.45,
                    0,
                    Math.PI * 2
                  );
                  ctx.fill();
                }
              }
            }
            break;
          }
          case 'STAGHORN_CORAL':
          case 'BIOLUM_SEA_WHIP': {
            const isBiolum = prop.kind === 'BIOLUM_SEA_WHIP';
            const branchH = (isBiolum ? 54 : 42) * drawScale;
            ctx.lineCap = 'round';
            ctx.globalAlpha = isBiolum ? 0.84 : 0.76;

            const coralGrad = ctx.createLinearGradient(0, 6 * drawScale, 0, -branchH);
            coralGrad.addColorStop(0, isBiolum ? '#164e63' : '#881337');
            coralGrad.addColorStop(0.6, prop.tintHex);
            coralGrad.addColorStop(1, prop.secondaryHex);

            ctx.strokeStyle = coralGrad;
            ctx.lineWidth = Math.max(2.4, 4.2 * drawScale);
            ctx.beginPath();
            ctx.moveTo(0, 5 * drawScale);
            ctx.quadraticCurveTo(sway * 0.35, -branchH * 0.5, sway * 0.65, -branchH);
            ctx.moveTo(sway * 0.18, -branchH * 0.32);
            ctx.quadraticCurveTo(
              -10 * drawScale + sway * 0.3,
              -branchH * 0.58,
              -15 * drawScale + sway * 0.45,
              -branchH * 0.82
            );
            ctx.moveTo(sway * 0.28, -branchH * 0.48);
            ctx.quadraticCurveTo(
              10 * drawScale + sway * 0.4,
              -branchH * 0.68,
              16 * drawScale + sway * 0.55,
              -branchH * 0.88
            );
            ctx.stroke();

            // 珊瑚/发光海鞭顶端荧光生长点
            ctx.fillStyle = prop.secondaryHex;
            const tips = [
              { x: sway * 0.65, y: -branchH },
              { x: -15 * drawScale + sway * 0.45, y: -branchH * 0.82 },
              { x: 16 * drawScale + sway * 0.55, y: -branchH * 0.88 },
            ];
            for (const tip of tips) {
              ctx.beginPath();
              ctx.arc(tip.x, tip.y, (isBiolum ? 3.4 : 2.6) * drawScale, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          case 'TUBE_SPONGE': {
            ctx.globalAlpha = 0.76;
            const tubes = [
              { dx: -7.5 * drawScale, h: 28 * drawScale, w: 6.5 * drawScale },
              { dx: 0, h: 36 * drawScale, w: 7.5 * drawScale },
              { dx: 7.5 * drawScale, h: 24 * drawScale, w: 6.0 * drawScale },
            ];
            for (const tb of tubes) {
              const tubeGrad = ctx.createLinearGradient(tb.dx, 4 * drawScale, tb.dx, -tb.h);
              tubeGrad.addColorStop(0, '#3b0764');
              tubeGrad.addColorStop(0.65, prop.tintHex);
              tubeGrad.addColorStop(1, prop.secondaryHex);
              ctx.fillStyle = tubeGrad;
              ctx.beginPath();
              ctx.roundRect(tb.dx - tb.w * 0.5, -tb.h, tb.w, tb.h + 5 * drawScale, 3.5 * drawScale);
              ctx.fill();
              ctx.fillStyle = '#2e1065';
              ctx.beginPath();
              ctx.ellipse(tb.dx, -tb.h, tb.w * 0.36, 1.8 * drawScale, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          case 'BRAIN_CORAL':
          case 'GLOW_ANEMONE': {
            const rad = 15 * drawScale;
            ctx.globalAlpha = 0.78;
            const domeGrad = ctx.createRadialGradient(
              -rad * 0.2,
              -rad * 0.45,
              rad * 0.15,
              0,
              0,
              rad
            );
            domeGrad.addColorStop(0, prop.secondaryHex);
            domeGrad.addColorStop(0.65, prop.tintHex);
            domeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
            ctx.fillStyle = domeGrad;
            ctx.beginPath();
            ctx.arc(0, 2 * drawScale, rad, Math.PI, 0);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = prop.secondaryHex;
            ctx.lineWidth = 1.6 * drawScale;
            ctx.beginPath();
            ctx.arc(0, 2 * drawScale, rad * 0.65, Math.PI * 1.15, -Math.PI * 0.15);
            ctx.stroke();
            break;
          }
          case 'ABYSSAL_CRYSTAL_SPIRE': {
            ctx.globalAlpha = 0.82;
            const spires = [
              { dx: -8 * drawScale, h: 30 * drawScale, w: 6 * drawScale, tilt: -0.18 },
              { dx: 0, h: 44 * drawScale, w: 7.5 * drawScale, tilt: 0.04 },
              { dx: 8 * drawScale, h: 26 * drawScale, w: 5.5 * drawScale, tilt: 0.2 },
            ];
            for (const sp of spires) {
              ctx.save();
              ctx.translate(sp.dx, 4 * drawScale);
              ctx.rotate(sp.tilt);
              ctx.fillStyle = prop.tintHex;
              ctx.beginPath();
              ctx.moveTo(-sp.w, 0);
              ctx.lineTo(0, -sp.h);
              ctx.lineTo(sp.w, 0);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = prop.secondaryHex;
              ctx.lineWidth = 1.4 * drawScale;
              ctx.stroke();
              ctx.restore();
            }
            break;
          }
          case 'HYDROTHERMAL_BUBBLE_VENT': {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.moveTo(-14 * drawScale, 6 * drawScale);
            ctx.lineTo(-6 * drawScale, -18 * drawScale);
            ctx.lineTo(6 * drawScale, -18 * drawScale);
            ctx.lineTo(14 * drawScale, 6 * drawScale);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = prop.tintHex;
            const rise = ((nowMs * 0.045 + prop.swayPhase * 36) % 64) * drawScale;
            ctx.beginPath();
            ctx.arc(sway * 0.3, -22 * drawScale - rise, 4.2 * drawScale, 0, Math.PI * 2);
            ctx.arc(
              -5 * drawScale - sway * 0.25,
              -36 * drawScale - rise * 0.75,
              3.1 * drawScale,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          }
          default: {
            // MOSSY_BOULDER
            ctx.globalAlpha = 0.84;
            ctx.fillStyle = prop.tintHex;
            ctx.beginPath();
            ctx.ellipse(0, 0, 18 * drawScale, 12 * drawScale, 0, Math.PI, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = prop.secondaryHex;
            ctx.lineWidth = 2 * drawScale;
            ctx.stroke();
            break;
          }
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }
}

// ============================================================================
// 8. 模块八：WorldStateManager（玩家探索足迹、活跃区域状态与存档管理）
// ============================================================================

export interface ProceduralWorldSaveState {
  worldSeed: number;
  discoveredBiomes: ExplorationZoneType[];
  visitedChunkCount: number;
  interactedClusterIds: string[];
}

export class WorldStateManager {
  public worldSeed: number;
  public readonly discoveredBiomes: Set<ExplorationZoneType> = new Set([
    'SHALLOW_CORAL_REEF',
  ]);
  public readonly visitedChunks: Set<number> = new Set([0]);
  public readonly interactedClusterIds: Set<string> = new Set();
  public activeMacroZone: ExplorationZoneType = 'SHALLOW_CORAL_REEF';
  public activeMacroGeography: MacroGeographyType = 'CORAL_REEF_BELT';

  constructor(worldSeed: number = 20261110) {
    this.worldSeed = worldSeed;
  }

  public recordPlayerExploration(
    worldX: number,
    worldY: number,
    chunkIndex: number,
    biomeEval: MacroZoneEvaluation
  ): void {
    this.visitedChunks.add(chunkIndex);
    this.discoveredBiomes.add(biomeEval.primaryBiome);
    this.activeMacroZone = biomeEval.primaryBiome;
    this.activeMacroGeography = biomeEval.macroGeography;
    if (this.visitedChunks.size > 512) {
      const first = this.visitedChunks.values().next().value;
      if (typeof first === 'number') {
        this.visitedChunks.delete(first);
      }
    }
  }

  public markClusterInteracted(clusterId: string): void {
    this.interactedClusterIds.add(clusterId);
  }

  public serialize(): ProceduralWorldSaveState {
    return {
      worldSeed: this.worldSeed,
      discoveredBiomes: Array.from(this.discoveredBiomes),
      visitedChunkCount: this.visitedChunks.size,
      interactedClusterIds: Array.from(this.interactedClusterIds).slice(-64),
    };
  }
}

// ============================================================================
// 9. 统一门面与单例导出 (ProceduralOceanWorldSystem)
// ============================================================================

export class ProceduralOceanWorldSystem {
  public readonly worldGenerator: WorldGenerator;
  public readonly biomeManager: BiomeManager;
  public readonly terrainGenerator: TerrainGenerator;
  public readonly structureGenerator: StructureGenerator;
  public readonly ecologyGenerator: EcologyGenerator;
  public readonly chunkManager: ChunkManager;
  public readonly decorationRenderer: DecorationRenderer;
  public readonly worldStateManager: WorldStateManager;

  constructor(seed: number = 20261110) {
    this.worldGenerator = new WorldGenerator(seed);
    this.biomeManager = new BiomeManager(this.worldGenerator);
    this.terrainGenerator = new TerrainGenerator(
      this.worldGenerator,
      this.biomeManager
    );
    this.structureGenerator = new StructureGenerator(
      this.worldGenerator,
      this.biomeManager
    );
    this.ecologyGenerator = new EcologyGenerator(
      this.worldGenerator,
      this.biomeManager
    );
    this.chunkManager = new ChunkManager(
      this.biomeManager,
      this.terrainGenerator,
      this.structureGenerator,
      this.ecologyGenerator
    );
    this.decorationRenderer = new DecorationRenderer();
    this.worldStateManager = new WorldStateManager(seed);
  }

  /**
   * 鲨鱼探索帧更新：更新活跃 Chunk、记录探索足迹并返回当前位置的环境场、宏观 Biome 平滑混合权重与统一深度视觉 Profile
   */
  public stepExploration(
    cameraX: number,
    sharkY: number,
    nowMs: number = 0
  ): {
    activeChunks: WorldChunkData[];
    environment: TerrainEnvironmentFields;
    terrainModulation: ReturnType<TerrainGenerator['sampleParallaxTerrainModulation']>;
    biomeSample: BiomeSampleResult;
    depthVisualProfile: DepthVisualProfile;
  } {
    const activeChunks = this.chunkManager.updateActiveChunks(
      cameraX,
      sharkY,
      nowMs
    );
    const environment = this.biomeManager.sampleEnvironmentFields(
      cameraX,
      sharkY
    );
    const terrainModulation =
      this.terrainGenerator.sampleParallaxTerrainModulation(cameraX, sharkY);
    const worldCoords = engineCoordToWorldCoord(cameraX, sharkY);
    const biomeSample = getBiomeAt(worldCoords.worldX, worldCoords.worldY, WorldConfig);
    const depthVisualProfile = getDepthVisualProfile(worldCoords.worldY, WorldConfig);
    const chunkIdx = this.chunkManager.worldXToChunkIndex(cameraX);
    this.worldStateManager.recordPlayerExploration(
      cameraX,
      sharkY,
      chunkIdx,
      terrainModulation.macroZone
    );

    return {
      activeChunks,
      environment,
      terrainModulation,
      biomeSample,
      depthVisualProfile,
    };
  }
}

export const proceduralOceanWorld = new ProceduralOceanWorldSystem(20261110);


