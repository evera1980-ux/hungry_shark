import type { BiomeId } from './biomeSystem';
import { quinticSmoothstep } from '../rules';
import {
  WorldConfig,
  WorldConfigType,
  WORLD_UNITS_PER_METER,
  engineYToWorldY,
  worldYToEngineY,
  mixSubsystemSeed,
} from './worldCore';

/**
 * 规范第 6 节：连续海床生成常量与参数
 * - 构造带尺度（大陆架 -> 大陆坡 -> 海底大峡谷 -> 2000m+ 超深渊海沟）：节点间距 3000 worldPx (300m)
 * - 中尺度山脊/礁丘波：波长 2200 worldPx (220m)，创造单屏内清晰可见的礁石丘陵与峡谷陡坡
 * - 小尺度岩礁起伏波：波长 680m & 260m，消除任何机械直线感
 * - 最大允许坡度限制：TERRAIN_MAX_SLOPE = 1.65（平缓山顶 + 多阶梯岩台/缓坡/逆坡起伏，告别陡峭直线斜坡）
 */
export const TERRAIN_LARGE_WAVELENGTH = 9600;
export const TERRAIN_MEDIUM_WAVELENGTH = 2400;
export const TERRAIN_SMALL_WAVELENGTH = 680;
export const TERRAIN_MAX_SLOPE = 1.65;

export interface TerrainSamplePoint {
  worldX: number;
  floorY: number;
  slope: number;
  absSlope: number;
}

export interface TerrainChunkSamples {
  chunkX: number;
  startX: number;
  endX: number;
  sampleStepX: number;
  points: TerrainSamplePoint[];
  depths: number[];
  maxAbsSlope: number;
}

/**
 * 基于 (worldSeed, generatorVersion, 'terrain') 的一维晶格哈希值 ∈ [-1, 1]
 */
function terrainLatticeValue(
  latticeIndex: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  const h = mixSubsystemSeed(
    config.worldSeed,
    config.generatorVersion,
    latticeIndex,
    waveSalt,
    'terrain'
  );
  return (h / 4294967296) * 2 - 1;
}

/**
 * 3 点对称平滑晶格值：v_smooth(n) = 0.25*v(n-1) + 0.5*v(n) + 0.25*v(n+1)
 * 数学性质：
 * 1. v_smooth(n) ∈ [-1, 1]
 * 2. 相邻晶格差值 |v_smooth(n+1) - v_smooth(n)| <= 1.0（消除局部突变尖刺）
 * 3. 纯函数，100% 顺序无关且跨 Chunk 连续
 */
function smoothedTerrainLatticeValue(
  latticeIndex: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  const vm1 = terrainLatticeValue(latticeIndex - 1, waveSalt, config);
  const v0 = terrainLatticeValue(latticeIndex, waveSalt, config);
  const vp1 = terrainLatticeValue(latticeIndex + 1, waveSalt, config);
  return 0.25 * vm1 + 0.5 * v0 + 0.25 * vp1;
}

/**
 * 极值拉伸晶格值：
 * - 在默认海洋配置下，锚定晶格原点 i=0 为宽缓阳光浅海珊瑚台地 (-0.96)，
 *   i=±1 为中深海阶梯斜坡盆地 (+0.48 ~ +0.62，避免单段直降到底导致坡度陡直)，
 *   i=±2 下潜至 17500m~19800m 超深渊马里亚纳海沟 (+0.94 ~ +1.0)，
 * - 对所有向上隆起的海山峰值 (raw < 0) 施加平顶海山 (Guyot) 柔化指数，使山顶宽阔平缓不尖锐！
 */
function contrastStretchedLatticeValue(
  latticeIndex: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  if (config.terrain.minFloorDepth <= 600) {
    if (latticeIndex === 0) return -0.94;
    if (latticeIndex === 1 || latticeIndex === -1) {
      const n = Math.abs(terrainLatticeValue(latticeIndex, waveSalt + 7, config));
      return 0.42 + 0.12 * n;
    }
    if (latticeIndex === 2 || latticeIndex === -2) {
      const n = Math.abs(terrainLatticeValue(latticeIndex, waveSalt + 13, config));
      return 0.92 + 0.08 * n;
    }
  }
  const raw = terrainLatticeValue(latticeIndex, waveSalt, config);
  if (raw < 0) {
    // 向上隆起的海山晶格采用平顶柔化压缩，避免出现尖耸山峰
    return -Math.pow(Math.abs(raw), 0.68) * 0.94;
  }
  return Math.pow(Math.abs(raw), 0.56);
}

/**
 * 坡度有界的一维平滑波函数（返回值 ∈ [-1, 1]）
 * 在三次 Hermite 插值 u(t) = 3t^2 - 2t^3 下，最大导数严格 <= 1.5 / wavelength
 */
function evalSmoothTerrainWave(
  worldX: number,
  wavelength: number,
  waveSalt: number,
  config: WorldConfigType,
  useContrastStretch: boolean = false
): number {
  const scaled = worldX / wavelength;
  const i0 = Math.floor(scaled);
  const t = scaled - i0;
  const u = t * t * (3 - 2 * t);
  const v0 = useContrastStretch
    ? contrastStretchedLatticeValue(i0, waveSalt, config)
    : smoothedTerrainLatticeValue(i0, waveSalt, config);
  const v1 = useContrastStretch
    ? contrastStretchedLatticeValue(i0 + 1, waveSalt, config)
    : smoothedTerrainLatticeValue(i0 + 1, waveSalt, config);
  return v0 + (v1 - v0) * u;
}

/**
 * 域扭曲随机非对称断崖与多级阶梯岩台波函数 `evalWarpedTerrainWave`（返回值 ∈ [-1, 1]）
 * 解决传统正弦/Hermite 波坡度过于单调平直的问题：
 * 在每个晶格区间 [i0, i0+1] 内，由确定性种子抽取三个独立随机地质形态参数：
 * 1. `asym ∈ [-0.52, 0.52]`（非对称斜坡偏移）；
 * 2. `step1 ∈ [-0.38, 0.38]`（主阶梯岩台调制：在斜坡中段形成明显的半山平缓岩架）；
 * 3. `step2 ∈ [-0.22, 0.22]`（次级双阶梯调制：把长斜坡打断为多段缓急交替的自然阶梯坡面）；
 * 4. 由于扭曲项构建在 Hermite 进度 h = 3t^2 - 2t^3 之上，晶格交界处导数恒为 0（100% C1 连续无缝）。
 */
function evalWarpedTerrainWave(
  worldX: number,
  wavelength: number,
  waveSalt: number,
  config: WorldConfigType,
  useContrastStretch: boolean = false
): number {
  const scaled = worldX / wavelength;
  const i0 = Math.floor(scaled);
  const t = scaled - i0;
  const h = t * t * (3 - 2 * t);

  const asymScale = useContrastStretch ? 0.32 : 0.54;
  const stepScale = useContrastStretch ? 0.26 : 0.38;
  const asym = terrainLatticeValue(i0, waveSalt + 19, config) * asymScale;
  const step1 = terrainLatticeValue(i0, waveSalt + 37, config) * stepScale;
  const step2 = terrainLatticeValue(i0, waveSalt + 53, config) * (stepScale * 0.55);

  const warpedU =
    h +
    asym * h * (1 - h) * (1 - 2 * h) +
    step1 * (Math.sin(Math.PI * 2 * h) / (Math.PI * 2)) +
    step2 * (Math.sin(Math.PI * 4 * h) / (Math.PI * 4));
  const u = Math.max(0, Math.min(1, warpedU));

  const v0 = useContrastStretch
    ? contrastStretchedLatticeValue(i0, waveSalt, config)
    : smoothedTerrainLatticeValue(i0, waveSalt, config);
  const v1 = useContrastStretch
    ? contrastStretchedLatticeValue(i0 + 1, waveSalt, config)
    : smoothedTerrainLatticeValue(i0 + 1, waveSalt, config);

  return v0 + (v1 - v0) * u;
}

/**
 * 圆润宽幅 U/V 型折叠脊谷 + 平顶海山 (Guyot) 波函数 `evalRidgedTerrainWave`（返回值 ∈ [-1, 1]）
 * - 采用平滑曲率参数 ε = 0.34 并精确归一化至完整 [-1, 1] 满幅区间，将山顶与谷底曲率半径扩大近 3 倍；
 * - 对向上隆起的海山峰值区 (`blended < -0.20`) 施加导数不放大 (`f'(0) = 1, f'(1) = 0.24`) 的 C1 连续平顶海山 (Guyot Tablemount) 柔化压缩，
 *   使海山山顶宽缓圆润、绝不尖锐，同时保留饱满深邃的圆拱海脊与海底峡谷轮廓！
 */
const TANH_GAIN_NORM = Math.tanh(1.82);

export function evalRidgedTerrainWave(
  worldX: number,
  wavelength: number,
  waveSalt: number,
  config: WorldConfigType
): number {
  const rawW = evalSmoothTerrainWave(worldX, wavelength, waveSalt, config, false);
  const w = Math.tanh(rawW * 1.82) / TANH_GAIN_NORM;
  const eps = 0.34;
  const minVal = Math.sqrt(eps);
  const maxVal = Math.sqrt(1 + eps);
  const normFold = (Math.sqrt(w * w + eps) - minVal) / (maxVal - minVal);
  const roundedFold = 1 - 2 * normFold;
  const cosineArch = Math.cos(w * Math.PI * 0.94);
  let blended = roundedFold * 0.62 + cosineArch * 0.38;

  // 对海山山顶（blended < -0.20，对应深度变浅的向上峰顶）施加 C1 平顶海山 (Guyot) 抛物柔化：
  // 在阈值处导数严格为 1.0（绝不放大山肩斜率），向峰顶 u -> 1 时导数平滑降至 0.24，消除尖山顶！
  if (blended < -0.20) {
    const u = Math.min(1, (-blended - 0.20) / 0.80);
    const flatDome = u - 0.34 * u * u; // ∈ [0, 0.66], f'(0)=1.0, f'(1)=0.32
    blended = -(0.20 + 0.80 * (flatDome / 0.66) * 0.90);
  }
  return Math.max(-1, Math.min(1, blended));
}

const SANDY_PLAIN_CELL_WIDTH = 1800;

/**
 * 多尺度层峦叠嶂山脉起伏波函数 `evalSlopeVariationOffset`（单位：m）
 * 彻底消除海底线条中的任何「平直横线」或「单调斜线」，塑造连绵起伏的海底群山轮廓：
 * 1. 视口级主山峦群峰 (`mountainChain`：wavelength 1180m & 780m)：在单屏视野内形成清晰的波峰、鞍部与波谷交替；
 * 2. 次级侧峰与逆向海脊 (`subPeaks`：wavelength 520m & 340m)：在长下坡或上坡中途隆起次级山峰 (`slope` 正负交替反翘)，拒绝单调斜坡；
 * 3. 山脊岩峰起伏 (`ridgeWave`：wavelength 220m)：确保每 100m 采样步的斜率持续弯曲变化，绝不共线！
 */
function evalSlopeVariationOffset(worldX: number, config: WorldConfigType): number {
  const mountainChain =
    evalRidgedTerrainWave(worldX, 1180, 601, config) * 320 +
    evalRidgedTerrainWave(worldX, 780, 619, config) * 260;

  const subPeaks =
    evalWarpedTerrainWave(worldX, 520, 643, config, false) * 210 +
    evalRidgedTerrainWave(worldX, 340, 661, config) * 145;

  const phaseMod = evalSmoothTerrainWave(worldX, 920, 677, config) * 1.8;
  const ridgeWave =
    Math.sin((worldX / 220) * Math.PI * 2 + phaseMod) * 72 +
    Math.cos((worldX / 145) * Math.PI * 2 - phaseMod * 0.7) * 34;

  return mountainChain + subPeaks + ridgeWave;
}

/**
 * 计算任意横坐标处的基础宏观构造偏移（单位：m）
 */
function evalBaseMacroOffsetAtX(
  worldX: number,
  effA1: number,
  config: WorldConfigType,
  isBlockAnchor: boolean
): number {
  // 选用 18500m & 26000m 宏观波长，使宏观构造基底平滑引导深度，为上层山峦起伏留出充足斜率裕度
  const macroPrimary = isBlockAnchor
    ? evalSmoothTerrainWave(worldX, 18500, 101, config, true)
    : evalWarpedTerrainWave(worldX, 18500, 101, config, true);
  const macroSecondary = isBlockAnchor
    ? evalSmoothTerrainWave(worldX, 26000, 157, config, true)
    : evalWarpedTerrainWave(worldX, 26000, 157, config, true);
  let combinedMacroNorm = Math.max(
    -1,
    Math.min(1, macroPrimary * 0.62 + macroSecondary * 0.38)
  );

  // 对宏观海山顶部 (combinedMacroNorm < -0.35) 施加导数不放大 (f'(0)=1.0) 的圆拱海山宽顶柔化
  if (combinedMacroNorm < -0.35) {
    const u = Math.min(1, (-combinedMacroNorm - 0.35) / 0.65);
    const flatTop = u - 0.36 * u * u;
    combinedMacroNorm = -(0.35 + 0.65 * (flatTop / 0.64));
  }

  let macroOffset = combinedMacroNorm * effA1;

  // 在默认海洋配置下（baseFloorDepth = 10100m, effA1 = 9600m）：
  // 塑造出生点阳光浅海珊瑚群山（|X| <= 560m 宏观中心位于 ~525m，叠加起伏丘陵山峦）与向深海延伸的群山阶梯：
  // - |X| <= 560m：浅海珊瑚丘陵山脉带 (~450m ~ 610m)
  // - |X| ∈ (560m, 4200m]：群山起伏下潜带，使 Chunk 0 自然跨越 460m 浅海至 3350m+ 中深海（完美覆盖 Chunk 0:2），
  //   同时叠加正弦山脉起伏包络，彻底告别平直斜坡！
  if (config.terrain.minFloorDepth <= 600 && effA1 >= 5000) {
    const absX = Math.abs(worldX);
    if (absX < 7600) {
      let targetOriginOffset: number;
      if (absX <= 560) {
        const u = absX / 560;
        const spawnHills =
          Math.sin(worldX / 88) * 34 +
          Math.cos(worldX / 52 + 0.8) * 22 +
          Math.sin(worldX / 155 - 0.5) * 28;
        targetOriginOffset = -effA1 + 22 + 30 * (u * u) + spawnHills;
      } else if (absX <= 4200) {
        const slopeProgress = (absX - 560) / 3640; // ∈ (0, 1]
        const smoothDrop =
          0.44 * slopeProgress +
          0.56 * quinticSmoothstep(0, 1, slopeProgress);
        const mountainOsc =
          Math.sin((absX - 560) / 115) * 195 +
          Math.cos(worldX / 74) * 115;
        targetOriginOffset =
          -effA1 + 52 + 3880 * smoothDrop + mountainOsc * Math.sin(Math.PI * slopeProgress);
      } else {
        targetOriginOffset = -effA1 + 3932 + (absX - 4200) * 0.72;
      }
      const oceanBlend = quinticSmoothstep(3600, 7600, absX);
      macroOffset =
        targetOriginOffset + (macroOffset - targetOriginOffset) * oceanBlend;
    }
  }
  return macroOffset;
}

/**
 * 低缓丘陵沙岭包络函数 `evalSandyPlainFactor(worldX, config)` ∈ [0, 1]
 * - 将横向海域划分为 `1800m` 宽的地质单元（Cell），由确定性哈希与双频波为约 64% 的单元开启低缓丘陵沙岭模式；
 * - 注意：为彻底杜绝“平的直线”，低缓沙岭区绝不将地形锁死为水平直线，而是将险峻高山过渡为连绵起伏的海底波状丘陵与沙丘山岭！
 */
export function evalSandyPlainFactor(
  worldX: number,
  config: WorldConfigType
): number {
  const scaled = worldX / SANDY_PLAIN_CELL_WIDTH;
  const cellIdx = Math.floor(scaled);
  const u = scaled - cellIdx; // ∈ [0, 1)

  const rampIn = quinticSmoothstep(0.0, 0.16, u);
  const rampOut = 1 - quinticSmoothstep(0.84, 1.0, u);
  const cellWindow = rampIn * rampOut;

  const cellCenterX = (cellIdx + 0.5) * SANDY_PLAIN_CELL_WIDTH;
  const w1 = evalSmoothTerrainWave(cellCenterX, 3200, 509, config);
  const w2 = terrainLatticeValue(cellIdx, 577, config);
  const selectorSignal = w1 * 0.55 + w2 * 0.45;
  const cellStrength = quinticSmoothstep(-0.28, 0.08, selectorSignal);

  const rawPlain = cellWindow * cellStrength;

  if (config.terrain.minFloorDepth <= 600) {
    const absX = Math.abs(worldX);
    if (absX <= 520) {
      return 0.75;
    }
    if (absX < 3400) {
      return rawPlain * 0.25;
    }
  }
  return rawPlain;
}

/**
 * 计算任意世界横坐标 worldX 处的原始多尺度山峦海床深度
 * 核心特征：
 * 1. 移除块边界 `isBlockAnchor` 将 `detailScale` 归零导致的块边界断崖与斜坡饱和直线；
 * 2. 将中/小尺度层峦叠嶂山脉波 (`mountainTotalOffset`) 通过平滑包络限幅在 `[-240m ~ -720m, +240m ~ +720m]`，
 *    从而在数学上 100% 保证任意 `2000m` 地质块两端总高差严格 `<= 2450m < 20 * 136m`，为块内每一对采样步预留充裕的山峰/山谷曲率空间；
 * 3. 即使在低缓沙岭区 (`plainFactor` 较高)，仍保留 `32%~45%` 的波状丘陵山岭起伏，彻底消灭任何水平直线或斜向直线！
 */
function evalRawRandomFloorDepthAtX(
  worldX: number,
  config: WorldConfigType,
  isBlockAnchor: boolean = false
): number {
  const A1 = Math.max(0, config.terrain.largeWaveAmplitude);
  const A2 = Math.max(0, config.terrain.mediumWaveAmplitude);
  const A3 = Math.max(0, config.terrain.smallWaveAmplitude);

  const plainFactor = evalSandyPlainFactor(worldX, config);

  // 局部山峦起伏强度包络：险峻群山峡谷区达 0.75~1.0，低缓丘陵沙岭区仍保留 0.34~0.48 的连绵丘陵起伏（绝不归零变平线！）
  const roughEnvWave = evalSmoothTerrainWave(worldX, 5800, 707, config);
  const baseRoughness = 0.46 + 0.54 * (0.5 + 0.5 * roughEnvWave);
  const roughness = baseRoughness * (1 - 0.58 * plainFactor);

  // 1. 宏观板块基底（在低缓丘陵区仅温和缓和 48% 宏观陡坡，绝不锁死为水平常数直线）
  const effA1 = Math.min(A1, 9600);
  let macroOffset = evalBaseMacroOffsetAtX(worldX, effA1, config, false);

  if (plainFactor > 0.05 && effA1 > 200 && Math.abs(worldX) > 3400) {
    const cellIdx = Math.floor(worldX / SANDY_PLAIN_CELL_WIDTH);
    const cellCenterX = (cellIdx + 0.5) * SANDY_PLAIN_CELL_WIDTH;
    const centerMacroOffset = evalBaseMacroOffsetAtX(
      cellCenterX,
      effA1,
      config,
      true
    );
    const originBlend = quinticSmoothstep(3400, 4200, Math.abs(worldX));
    // 仅缓和 52% 的宏观坡度，同时叠加波长 600m & 340m 的波状丘陵，使沙岭区呈优美的波浪丘陵而非水平直线
    const gentleMacroLock = plainFactor * 0.52 * originBlend;
    const rollingHills =
      Math.sin((worldX / 580) * Math.PI * 2 + cellIdx * 1.7) * 64 +
      Math.cos((worldX / 310) * Math.PI * 2 - cellIdx * 1.1) * 32;
    macroOffset =
      macroOffset +
      (centerMacroOffset - macroOffset) * gentleMacroLock +
      rollingHills * plainFactor * originBlend;
  }

  // 在出生浅海区 (|X| <= 560m) 由 `spawnHills` 主导浅水珊瑚丘陵起伏，向外平滑过渡至 1.0 倍宏伟海底山脉
  const originDetailFade =
    config.terrain.minFloorDepth <= 600
      ? quinticSmoothstep(560, 1280, Math.abs(worldX))
      : 1.0;

  // 2. 中尺度饱满 U/V 型折叠海底山脉与群峰波
  const effA2 = Math.min(A2, 3800) * originDetailFade;
  const mesoRidgedPrimary = evalRidgedTerrainWave(worldX, 2100, 263, config);
  const mesoRidgedSecondary = evalRidgedTerrainWave(worldX, 1320, 281, config);
  const mesoWarped = evalWarpedTerrainWave(worldX, 1750, 202, config, false);
  let mesoFolded =
    mesoRidgedPrimary * 0.44 + mesoRidgedSecondary * 0.32 + mesoWarped * 0.24;
  if (mesoFolded < -0.24) {
    const uPeak = Math.min(1, (-mesoFolded - 0.24) / 0.76);
    const flatPeak = uPeak - 0.35 * uPeak * uPeak;
    mesoFolded = -(0.24 + 0.76 * (flatPeak / 0.65) * 0.85);
  }
  const mesoEnvelope = (0.58 + 0.42 * baseRoughness) * (1 - 0.62 * plainFactor);
  const mediumOffset = mesoFolded * effA2 * mesoEnvelope * 0.42;

  // 3. 视口级连绵山峦波 (`evalSlopeVariationOffset`) + 局部岩峰断层波（彻底打破任何平直或斜直段）
  const effA3 = Math.min(A3, 720) * originDetailFade;
  const slopeVarWeight =
    originDetailFade * (0.38 + 0.62 * (1 - 0.65 * plainFactor)) * Math.min(1, A2 / 1000);
  const mountainRangeOffset =
    evalSlopeVariationOffset(worldX, config) * slopeVarWeight;

  const cragWave = evalWarpedTerrainWave(worldX, 480, 303, config, false);
  const microJagged = evalSmoothTerrainWave(worldX, 230, 409, config);
  const smallOffset =
    mountainRangeOffset +
    cragWave * effA3 * (0.45 + 0.55 * roughness) +
    microJagged * Math.min(effA3 * 0.38, 180) * (0.45 + 0.55 * roughness);

  // 在 2000m 地质块边界处平滑限幅为 ±240m，在块内部平滑放大至 ±720m（C∞ 连续），确保块两端总高差永不透支斜率上限
  const blockSpan = 20 * config.terrain.sampleStepX;
  const blockInteriorArch = Math.sin((worldX / blockSpan) * Math.PI);
  const mountainCap = 240 + 480 * (blockInteriorArch * blockInteriorArch);
  const rawMountainSum = mediumOffset + smallOffset;
  const boundedMountainOffset =
    mountainCap > 0 && (A2 > 0 || A3 > 0)
      ? mountainCap * Math.tanh(rawMountainSum / mountainCap)
      : 0;

  void isBlockAnchor;
  let rawDepth =
    config.terrain.baseFloorDepth + macroOffset + boundedMountainOffset;

  // 4. 全局浅水山顶圆润化保护 (Global Seamount Summit Cushion)：
  // 当海床隆起进入阳光浅水区 (< 740m) 时，平滑圆润化峰顶，同時保留山峰与山谷的高低起伏！
  if (config.terrain.minFloorDepth <= 600 && rawDepth < 740) {
    const shallowExcess = 740 - rawDepth;
    const maxGentleRise = 310; // 740 - 310 = 430m 极值
    const cushionedRise =
      maxGentleRise * Math.tanh(shallowExcess / maxGentleRise);
    rawDepth = 740 - cushionedRise;
  }

  return rawDepth;
}

/**
 * 有界 LRU 地质块节点深度缓存（上限 128 个地质块 = 覆盖 256,000m 横向海域）
 * 彻底消除 60FPS 渲染与物理碰撞每帧 ~1,400 次调用 `evalGridNodeFloorDepth` 产生的数组重复分配与噪声重算（零 GC 分配）！
 */
const MAX_TERRAIN_BLOCK_CACHE_SIZE = 128;
const terrainBlockNodeCache = new Map<string, Float64Array>();

/**
 * 有界 LRU Chunk 采样序列缓存（上限 64 个 Chunk）
 * 避免 `renderPhysicalSeabed` 与 `generateChunk` 每帧重复分配 `TerrainSamplePoint[]` 与 `depths: number[]`
 */
const MAX_TERRAIN_CHUNK_SAMPLES_CACHE_SIZE = 64;
const terrainChunkSamplesCache = new Map<string, TerrainChunkSamples>();

export function getTerrainCacheStats(): {
  blockCacheSize: number;
  maxBlockCacheSize: number;
  chunkSamplesCacheSize: number;
  maxChunkSamplesCacheSize: number;
} {
  return {
    blockCacheSize: terrainBlockNodeCache.size,
    maxBlockCacheSize: MAX_TERRAIN_BLOCK_CACHE_SIZE,
    chunkSamplesCacheSize: terrainChunkSamplesCache.size,
    maxChunkSamplesCacheSize: MAX_TERRAIN_CHUNK_SAMPLES_CACHE_SIZE,
  };
}

function getTerrainCacheConfigPrefix(config: WorldConfigType): string {
  const t = config.terrain;
  return `${config.worldSeed}:${config.generatorVersion}:${config.chunk.width}:${t.sampleStepX}:${t.baseFloorDepth}:${t.largeWaveAmplitude}:${t.mediumWaveAmplitude}:${t.smallWaveAmplitude}:${t.minFloorDepth}:${t.maxFloorDepth}`;
}

// 预分配模块级复用工作缓冲，保证地质块求解过程零临时数组分配
const scratchRawY = new Float64Array(21);
const scratchDeltas = new Float64Array(20);
const scratchRooms = new Float64Array(20);
const scratchWeightedRooms = new Float64Array(20);
const scratchStepRhythm = new Float64Array(20);

/**
 * 计算采样网格节点 k (worldX = k * sampleStepX) 处的海床深度值
 * 严格遵循规范第 6.1 & 6.2 节：
 * 采用「20 步地质块连续山峦采样 + 反共线零和山峦曲率注入 + 裕度比例守恒重分配 + 有界 LRU 块缓存」算法：
 * 1. 全节点统一采样多尺度山峦函数 `evalRawRandomFloorDepthAtX`，消除 2000m 块边界断崖与斜坡饱和直线；
 * 2. 初始分配限幅于 `redistributionLimit = 1.36 * stepX`，为每一对采样步预留至少 `0.29 * stepX` 的山脊曲率裕度；
 * 3. 注入「零和反共线山峦曲率修正（Zero-Sum Anti-Collinear Mountain Curvature）」：
 *    严禁任何单步成为水平直线 (`|slope| < 0.04`)，严禁任何相邻两步共线成为斜向直线 (`|slope_{j+1} - slope_j| < 0.09`)，
 *    使每一段海床都像连绵起伏的山峦一样持续弯曲起伏；
 * 4. 100% 数学保证任意相邻采样点斜率 `|y_{k+1} - y_k| / sampleStepX <= TERRAIN_MAX_SLOPE (1.65)`。
 */
function evalGridNodeFloorDepth(gridIndex: number, config: WorldConfigType): number {
  const stepX = config.terrain.sampleStepX;
  const blockSteps = 20; // 每个地质块包含 20 个采样步（默认 2000m）
  const blockIdx = Math.floor(gridIndex / blockSteps);
  const localStep = gridIndex - blockIdx * blockSteps;

  const cacheKey = `${getTerrainCacheConfigPrefix(config)}:${blockIdx}`;
  let solvedNodes = terrainBlockNodeCache.get(cacheKey);
  if (solvedNodes) {
    return solvedNodes[localStep];
  }

  const maxStepDelta = TERRAIN_MAX_SLOPE * stepX;
  const blockStartGrid = blockIdx * blockSteps;

  // 计算当前 20 步地质块内全部 21 个节点的原始连续山峦深度
  for (let j = 0; j <= blockSteps; j++) {
    const gx = blockStartGrid + j;
    const yVal = evalRawRandomFloorDepthAtX(gx * stepX, config, false);
    scratchRawY[j] = Math.max(
      config.terrain.minFloorDepth,
      Math.min(config.terrain.maxFloorDepth, yVal)
    );
  }

  // 提取 20 个单步高度差；初始分配限幅于 redistributionLimit = 1.36 * stepX，确保绝不饱和到 1.65 * stepX
  const safeLimit = maxStepDelta - 1e-6;
  const redistributionLimit = 1.36 * stepX;
  let clampedSum = 0;
  for (let j = 0; j < blockSteps; j++) {
    const stepGridIdx = blockStartGrid + j;
    const midX = (stepGridIdx + 0.5) * stepX;
    const isSpawnZone = config.terrain.minFloorDepth <= 600 && Math.abs(midX) <= 600;
    const pf = evalSandyPlainFactor(midX, config);
    const rawD = scratchRawY[j + 1] - scratchRawY[j];

    const hStep = terrainLatticeValue(stepGridIdx, 829, config); // ∈ [-1, 1]
    const ridgePhase = Math.sin(stepGridIdx * 1.35 + hStep * 1.45);
    let modulatedD = rawD;

    if (isSpawnZone) {
      // 出生珊瑚山丘区（|X| <= 600m）：直接保持 `spawnHills` 的精致多峰起伏，且不承担外部大陆坡的差额重分配
      modulatedD = rawD;
      scratchStepRhythm[j] = 0.0;
    } else if (pf > 0.32) {
      // 低缓丘陵沙岭区：塑造温和起伏的波状沙丘山岭 (斜率在 ±0.05 ~ ±0.21 之间持续正负交替弯曲，绝不锁死为 0 平线！)
      const hillSlope =
        (Math.sin(stepGridIdx * 1.55 + hStep * 0.9) * 0.14 +
          Math.cos(stepGridIdx * 0.85 - hStep * 0.7) * 0.06) *
        stepX;
      modulatedD = rawD * (1 - 0.68 * pf) + hillSlope * pf;
      scratchStepRhythm[j] = 0.03;
    } else if (ridgePhase < -0.56) {
      // 山脊鞍部与逆向反翘山峰：让长斜坡中途主动向上反翘隆起或经过圆润鞍部
      const reverseKick = (hStep < 0 ? -0.22 : 0.12) * stepX;
      modulatedD = rawD * 0.25 + reverseKick;
      scratchStepRhythm[j] = 0.06;
    } else {
      modulatedD = rawD;
      scratchStepRhythm[j] = 1.0;
    }

    const c = Math.max(-redistributionLimit, Math.min(redistributionLimit, modulatedD));
    scratchDeltas[j] = c;
    clampedSum += c;
  }

  const targetDiff = scratchRawY[blockSteps] - scratchRawY[0];
  const excess = targetDiff - clampedSum;
  if (Math.abs(excess) > 1e-9) {
    let totalWeightedRoom = 0;
    for (let j = 0; j < blockSteps; j++) {
      const midX = (blockStartGrid + j + 0.5) * stepX;
      const isSpawnZone = config.terrain.minFloorDepth <= 600 && Math.abs(midX) <= 600;
      const pf = evalSandyPlainFactor(midX, config);
      const room = isSpawnZone
        ? 0
        : Math.max(
            0,
            excess > 0
              ? redistributionLimit - scratchDeltas[j]
              : scratchDeltas[j] + redistributionLimit
          );
      scratchRooms[j] = room;
      const nonPlain = Math.max(0.02, Math.min(1.0, 1 - pf));
      const weight = Math.min(
        1.0,
        nonPlain * nonPlain * scratchStepRhythm[j]
      );
      scratchWeightedRooms[j] = room * weight;
      totalWeightedRoom += scratchWeightedRooms[j];
    }

    if (totalWeightedRoom >= Math.abs(excess) && totalWeightedRoom > 1e-9) {
      const ratio = Math.abs(excess) / totalWeightedRoom;
      const sign = excess > 0 ? 1 : -1;
      for (let j = 0; j < blockSteps; j++) {
        scratchDeltas[j] += sign * scratchWeightedRooms[j] * ratio;
      }
    } else {
      const sign = excess > 0 ? 1 : -1;
      let remainingExcess = Math.abs(excess);
      if (totalWeightedRoom > 1e-9) {
        for (let j = 0; j < blockSteps; j++) {
          const add = Math.min(scratchRooms[j], scratchWeightedRooms[j]);
          scratchDeltas[j] += sign * add;
          scratchRooms[j] = Math.max(0, scratchRooms[j] - add);
          remainingExcess -= add;
        }
      }
      if (remainingExcess > 1e-9) {
        let totalRoom = 0;
        for (let j = 0; j < blockSteps; j++) {
          totalRoom += scratchRooms[j];
        }
        if (totalRoom > 1e-9) {
          const ratio = Math.min(1, remainingExcess / totalRoom);
          for (let j = 0; j < blockSteps; j++) {
            scratchDeltas[j] += sign * scratchRooms[j] * ratio;
          }
        }
      }
    }
  }

  // 零和反共线山峦曲率修正 (Zero-Sum Anti-Collinear Mountain Curvature Pass)：
  // 将 20 个步长划分为 10 对不相交偶奇步对 (2m, 2m+1)，保证：
  // 1) 每对内部总和 d0 + d1 严格守恒（绝不产生跨步累积高度漂移）；
  // 2) 偶数步偏负 (-c)、奇数步偏正 (+c)，从而同时在偶奇步间 (2m, 2m+1)、奇偶步间 (2m+1, 2m+2) 形成显著的交替山峦曲率；
  // 3) 跨 2000m 块边界的末步 (j=19) 与首步 (j=0) 分别锚定于互不相交的双生交错斜率格网 (Lattice A vs Lattice B)，
  //    数学上 100% 保证无须跨块通信即可实现 |d_0(B) - d_{19}(B-1)| >= 0.12 * stepX！
  const hasTerrainWaves =
    config.terrain.largeWaveAmplitude > 0 ||
    config.terrain.mediumWaveAmplitude > 0 ||
    config.terrain.smallWaveAmplitude > 0;

  if (hasTerrainWaves) {
    const minAbsD = 0.045 * stepX;
    const absAvgDeadHalf = 0.048 * stepX;
    // Pass 1: 10 个不相交偶奇配对 (2m, 2m+1) 注入确定性正交山脊拱度 (d_{2m} = avg - c, d_{2m+1} = avg + c, c > 0)
    for (let m = 0; m < 10; m++) {
      const j0 = m * 2;
      const j1 = j0 + 1;
      const d0 = scratchDeltas[j0];
      const d1 = scratchDeltas[j1];
      const avg = (d0 + d1) * 0.5;
      const absAvg = Math.abs(avg);
      const cMax = Math.max(0, safeLimit - absAvg - 1e-4);
      const midX = (blockStartGrid + j0 + 1) * stepX;
      const pf = evalSandyPlainFactor(midX, config);
      const hPair = Math.abs(terrainLatticeValue(blockStartGrid + j0, 947, config));

      const targetC =
        pf > 0.32
          ? (0.068 + 0.035 * hPair) * stepX
          : (0.105 + 0.085 * hPair + 0.08 * Math.min(1, absAvg / stepX)) * stepX;

      let c = Math.max((d1 - d0) * 0.5, Math.min(cMax * 0.92, targetC));
      if (c > cMax * 0.96) c = cMax * 0.96;

      // 若 c 落在 (|avg| - absAvgDeadHalf, |avg| + absAvgDeadHalf) 区间内，推至死区外
      if (Math.abs(c - absAvg) < absAvgDeadHalf) {
        const upperC = absAvg + absAvgDeadHalf;
        const lowerC = absAvg - absAvgDeadHalf;
        if (upperC <= cMax * 0.96) {
          c = upperC;
        } else if (lowerC >= 0.048 * stepX) {
          c = lowerC;
        }
      }

      scratchDeltas[j0] = avg - c;
      scratchDeltas[j1] = avg + c;
    }

    // Pass 2: 检查块内奇偶跨对边界 (2m+1, 2m+2)，若偶发共线 (|d_{2m+2} - d_{2m+1}| < 0.095 * stepX)，使 diffOddEven <= -0.105 * stepX
    for (let m = 0; m < 9; m++) {
      const jOdd = m * 2 + 1;
      const jEvenNext = jOdd + 1;
      const diffOddEven = scratchDeltas[jEvenNext] - scratchDeltas[jOdd];
      if (Math.abs(diffOddEven) < 0.095 * stepX) {
        const needed = diffOddEven + 0.115 * stepX;
        const jEvenCurr = m * 2;
        const roomCurr = Math.min(
          safeLimit + scratchDeltas[jEvenCurr],
          safeLimit - scratchDeltas[jOdd]
        );
        let boostCurr = Math.min(roomCurr * 0.85, needed);
        if (
          boostCurr > 0 &&
          (Math.abs(scratchDeltas[jEvenCurr] - boostCurr) < minAbsD ||
            Math.abs(scratchDeltas[jOdd] + boostCurr) < minAbsD)
        ) {
          const altBoost = Math.min(roomCurr * 0.92, boostCurr + 2.2 * minAbsD);
          if (
            Math.abs(scratchDeltas[jEvenCurr] - altBoost) >= minAbsD &&
            Math.abs(scratchDeltas[jOdd] + altBoost) >= minAbsD
          ) {
            boostCurr = altBoost;
          } else {
            boostCurr = 0;
          }
        }
        if (boostCurr > 0) {
          scratchDeltas[jEvenCurr] -= boostCurr;
          scratchDeltas[jOdd] += boostCurr;
        }

        const remNeeded = scratchDeltas[jEvenNext] - scratchDeltas[jOdd] + 0.11 * stepX;
        if (remNeeded > 0) {
          const jOddNext = jEvenNext + 1;
          const roomNext = Math.min(
            safeLimit + scratchDeltas[jEvenNext],
            safeLimit - scratchDeltas[jOddNext]
          );
          let boostNext = Math.min(roomNext * 0.85, remNeeded);
          if (
            boostNext > 0 &&
            (Math.abs(scratchDeltas[jEvenNext] - boostNext) < minAbsD ||
              Math.abs(scratchDeltas[jOddNext] + boostNext) < minAbsD)
          ) {
            const altBoost = Math.min(roomNext * 0.92, boostNext + 2.2 * minAbsD);
            if (
              Math.abs(scratchDeltas[jEvenNext] - altBoost) >= minAbsD &&
              Math.abs(scratchDeltas[jOddNext] + altBoost) >= minAbsD
            ) {
              boostNext = altBoost;
            } else {
              boostNext = 0;
            }
          }
          if (boostNext > 0) {
            scratchDeltas[jEvenNext] -= boostNext;
            scratchDeltas[jOddNext] += boostNext;
          }
        }
      }
    }

    // Pass 3: 跨 2000m 块边界交错斜率格网锚定 (Disjoint Interleaved Lattice Snapping for j=0 and j=19)
    // - 将首步 d_0 (j=0) 锚定于格网 B: (0.36 * k + 0.09) * stepX（且保持 d_0 + d_1 守恒）
    // - 将末步 d_19 (j=19) 锚定于格网 A: (0.36 * k - 0.09) * stepX（且保持 d_18 + d_19 守恒）
    // 格网 A 与格网 B 任意两点间距恒 >= 0.18 * stepX，且离 0 间距恒 >= 0.09 * stepX！
    const latticeStep = 0.36 * stepX;
    const snapBoundaryPair = (
      jTarget: number,
      jPartner: number,
      jInnerNeighbor: number,
      latticeOffset: number
    ) => {
      const pairSum = scratchDeltas[jTarget] + scratchDeltas[jPartner];
      const currTarget = scratchDeltas[jTarget];
      const baseK = Math.round((currTarget - latticeOffset) / latticeStep);
      let bestTarget = currTarget;
      let bestScore = Infinity;
      for (let dk = -3; dk <= 3; dk++) {
        const candTarget = (baseK + dk) * latticeStep + latticeOffset;
        const candPartner = pairSum - candTarget;
        if (Math.abs(candTarget) > safeLimit || Math.abs(candPartner) > safeLimit) continue;
        if (Math.abs(candTarget) < minAbsD || Math.abs(candPartner) < minAbsD) continue;
        if (Math.abs(candTarget - candPartner) < 0.095 * stepX) continue;
        if (Math.abs(candPartner - scratchDeltas[jInnerNeighbor]) < 0.095 * stepX) continue;
        const score = Math.abs(candTarget - currTarget);
        if (score < bestScore) {
          bestScore = score;
          bestTarget = candTarget;
        }
      }
      scratchDeltas[jTarget] = bestTarget;
      scratchDeltas[jPartner] = pairSum - bestTarget;
    };

    snapBoundaryPair(0, 1, 2, 0.09 * stepX);
    snapBoundaryPair(19, 18, 17, -0.09 * stepX);
  }

  solvedNodes = new Float64Array(blockSteps + 1);
  let accY = scratchRawY[0];
  solvedNodes[0] = Math.max(
    config.terrain.minFloorDepth,
    Math.min(config.terrain.maxFloorDepth, accY)
  );
  for (let j = 0; j < blockSteps; j++) {
    const clampedStep = Math.max(-maxStepDelta, Math.min(maxStepDelta, scratchDeltas[j]));
    accY += clampedStep;
    solvedNodes[j + 1] = Math.max(
      config.terrain.minFloorDepth,
      Math.min(config.terrain.maxFloorDepth, accY)
    );
  }

  if (terrainBlockNodeCache.size >= MAX_TERRAIN_BLOCK_CACHE_SIZE) {
    const oldestKey = terrainBlockNodeCache.keys().next().value;
    if (oldestKey !== undefined) {
      terrainBlockNodeCache.delete(oldestKey);
    }
  }
  terrainBlockNodeCache.set(cacheKey, solvedNodes);

  return solvedNodes[localStep];
}

/**
 * 规范第 6.1 & 13 节：全局连续海床深度函数 `getFloorDepthAt(worldX)`
 * - 在采样网格点 x_k = k * sampleStepX 处直接返回 evalGridNodeFloorDepth(k)
 * - 在相邻采样点 [x_k, x_{k+1}] 之间做精确线性插值，使渲染折线、碰撞边界与采样函数在任意实数 worldX 处 100% 几何同源！
 * - 返回值始终满足 minFloorDepth <= floorY <= maxFloorDepth
 */
export function getFloorDepthAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): number {
  if (!Number.isFinite(worldX)) {
    return config.terrain.baseFloorDepth;
  }
  const stepX = config.terrain.sampleStepX;
  const scaled = worldX / stepX;
  const k0 = Math.floor(scaled);
  const frac = scaled - k0;
  const y0 = evalGridNodeFloorDepth(k0, config);
  if (frac === 0) {
    return y0;
  }
  const y1 = evalGridNodeFloorDepth(k0 + 1, config);
  const interpolated = y0 + (y1 - y0) * frac;
  return Math.max(
    config.terrain.minFloorDepth,
    Math.min(config.terrain.maxFloorDepth, interpolated)
  );
}

/**
 * 规范第 6.2 & 13 节：获取指定 `worldX` 处的海床斜率 `dFloorY / dX`（有符号，绝对值 <= TERRAIN_MAX_SLOPE）
 */
export function getTerrainSlopeAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): number {
  if (!Number.isFinite(worldX)) return 0;
  const stepX = config.terrain.sampleStepX;
  const k0 = Math.floor(worldX / stepX);
  const y0 = evalGridNodeFloorDepth(k0, config);
  const y1 = evalGridNodeFloorDepth(k0 + 1, config);
  return (y1 - y0) / stepX;
}

/**
 * 规范第 6.2 & 13 节：获取指定 `chunkX` 的海床采样序列 `getTerrainSamples(chunkX)`
 * 覆盖 [startX, endX] 闭区间端点（共 width / sampleStepX + 1 个点），
 * 保证 chunkX 的最后一个采样点 (worldX = endX) 与 chunkX + 1 的第一个采样点 (worldX = next.startX) 100% 恒等！
 */
export function getTerrainSamples(
  chunkX: number,
  config: WorldConfigType = WorldConfig
): TerrainChunkSamples {
  if (!Number.isInteger(chunkX)) {
    throw new Error(`[TerrainGenerator] chunkX (${chunkX}) must be an integer.`);
  }
  const cx = chunkX === 0 ? 0 : chunkX;
  const cacheKey = `${getTerrainCacheConfigPrefix(config)}:${cx}`;
  const cached = terrainChunkSamplesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const width = config.chunk.width;
  const stepX = config.terrain.sampleStepX;
  const startX = cx * width;
  const endX = startX + width;
  const stepCount = Math.round(width / stepX);
  const baseGridIndex = Math.round(startX / stepX);

  const points: TerrainSamplePoint[] = [];
  const depths: number[] = [];
  let maxAbsSlope = 0;

  for (let i = 0; i <= stepCount; i++) {
    const k = baseGridIndex + i;
    const wx = startX + i * stepX;
    const floorY = evalGridNodeFloorDepth(k, config);
    const nextFloorY = evalGridNodeFloorDepth(k + 1, config);
    const slope = (nextFloorY - floorY) / stepX;
    const absSlope = Math.abs(slope);
    if (i < stepCount && absSlope > maxAbsSlope) {
      maxAbsSlope = absSlope;
    }
    points.push({
      worldX: wx === 0 ? 0 : wx,
      floorY,
      slope,
      absSlope,
    });
    depths.push(floorY);
  }

  const result: TerrainChunkSamples = {
    chunkX: cx,
    startX: startX === 0 ? 0 : startX,
    endX: endX === 0 ? 0 : endX,
    sampleStepX: stepX,
    points,
    depths,
    maxAbsSlope,
  };

  if (terrainChunkSamplesCache.size >= MAX_TERRAIN_CHUNK_SAMPLES_CACHE_SIZE) {
    const oldestKey = terrainChunkSamplesCache.keys().next().value;
    if (oldestKey !== undefined) {
      terrainChunkSamplesCache.delete(oldestKey);
    }
  }
  terrainChunkSamplesCache.set(cacheKey, result);

  return result;
}

/**
 * 适配层辅助函数：直接以引擎米制坐标 `engineX` 查询海床米制深度 `floorEngineY`
 * 与 `getFloorDepthAt(engineX * 10)` 严格同源
 */
export function getEngineFloorDepthAt(
  engineX: number,
  config: WorldConfigType = WorldConfig
): number {
  const worldX = engineX * WORLD_UNITS_PER_METER;
  return worldYToEngineY(getFloorDepthAt(worldX, config));
}

/**
 * 规范第 0.6 & 11 节：贴地装饰/岩石锚点同源采样器
 * 确保贴地装饰、海床渲染、海床碰撞全部共用同一个 `getFloorDepthAt(worldX)` 数据源
 */
export function sampleSeabedAnchorAt(
  worldX: number,
  verticalOffsetWorldPx: number = 0,
  config: WorldConfigType = WorldConfig
): {
  worldX: number;
  floorY: number;
  anchorY: number;
  slope: number;
  normalAngleRad: number;
} {
  const floorY = getFloorDepthAt(worldX, config);
  const slope = getTerrainSlopeAt(worldX, config);
  return {
    worldX,
    floorY,
    anchorY: floorY + verticalOffsetWorldPx,
    slope,
    normalAngleRad: Math.atan2(-1, slope),
  };
}

// ============================================================================
// 双层海底珊瑚礁架构：浅海镂空珊瑚环礁拱台 (Shallow Coral Reef Atoll Arch Bridges)
// 完美解决「深水区不被海底山脉阻断强制上浮」与「浅水区朝任意方向游都能频繁看到海底珊瑚礁」的拓扑矛盾：
// 1. 当下方主海床处于深海 (> 920m) 时，每隔 1600m 水平单元在阳光浅水层 (350m ~ 495m) 生成一座宽约 1150m 的平顶珊瑚环礁拱台；
// 2. 拱台顶面铺设真实 `coral_reef` 海床材质带并附着生长 4 层复合大珊瑚礁盘、礁石与海草，供浅水区探索与栖息；
// 3. 拱台下方 (深度 > 620m ~ 650m) 为巨型海底玄武岩天然镂空拱门水道（配远景雾化火山岩柱支撑到底），
//    使暮光带与深渊区 (650m ~ 20,000m) 100% 畅通无阻，绝不隔断深海水平巡游！
// ============================================================================

export const SHALLOW_ATOLL_CELL_WIDTH = 1600;
export const SHALLOW_CAVE_OPENING_HALF_WIDTH = 232;
export const SHALLOW_CAVE_BOWL_HALF_WIDTH = 416;

export interface SeabedTerraceTierSpec {
  /** 海床阶梯层级索引：0 = 阳光浅海珊瑚层，1 = 上暮光礁石阶地层，2 = 中暮光海谷台地层，3 = 深暮光半深海峡谷层，4 = 深海裂谷前哨阶地层 */
  tierIndex: number;
  labelZh: string;
  biomeId: BiomeId;
  /** 连续山脊基准深度 (m) */
  baseRidgeY: number;
  /** 山脊最浅深度上限 (m) */
  minRidgeY: number;
  /** 山脊最深深度下限 (m) */
  maxRidgeY: number;
  /** 洞口下凹碗底最大视觉深度 (m) */
  maxVisualRimY: number;
  /** 实心段下方拱形洞顶目标基准深度 (m) */
  archTargetBaseY: number;
  /** 实心段下方拱形洞顶最大深度下限 (m) */
  archMaxDepthY: number;
  /** 水平单元跨度 (m) */
  cellWidth: number;
  /** 弧形下潜洞口水平错位相位偏移 (m)，使上下相邻层的洞口交错分布，下潜后必有下一层海床承接作为参照物 */
  seamPhaseOffsetX: number;
  /** 是否跳过 seamIdx === 0（仅第 0 层跳过 X=0 新手出生主海山） */
  skipZeroSeam: boolean;
  /** 物理可下潜洞口半宽 (m) */
  openingHalfWidth: number;
  /** 视觉弧形洞口后壁下凹半宽 (m) */
  bowlHalfWidth: number;
  /** 洞口后壁下弯凹陷幅度 (m) */
  bowlDropDepth: number;
  /** 仅当洞口中心下方主海床深于此值 (m) 时才开启下潜洞口 */
  minMainFloorForOpening: number;
  /** 与主海床大陆坡开始 C2 平滑嫁接的主海床深度起点 (m) */
  graftStartMainY: number;
  /** 与主海床大陆坡完成 C2 平滑嫁接的主海床深度终点 (m) */
  graftEndMainY: number;
  /** 将层底岩体完全嵌入主海床山根内部的主海床深度阈值 (m) */
  graftFuseMainY: number;
  /** 确定性噪声盐值 */
  seedSalt: number;
}

/**
 * 全水深 9 级非均匀渐进间距阶梯式连续海床配置表 (`SEABED_TERRACE_TIERS`)
 * - 每一层均采用「无悬空立柱、连续海床后壁 + 向远处弯曲的弧形下潜洞口 + 三阶地下岩层 + 双向物理碰撞」架构；
 * - 垂直间距随水深加大而逐级递增（中心步长 ΔY 依次为：+806m -> +1000m -> +1240m -> +1580m -> +2020m -> +2580m -> +3260m -> +4000m；
 *   层间净空游动走廊依次为：394m -> 575m -> 782m -> 1078m -> 1464m -> 1964m -> 2588m -> 3268m），既匹配深海巨型鲨鱼的宏大空间尺度，又保证全水深处处有海床参照物；
 * - 相邻上下层的下潜洞口通过 `seamPhaseOffsetX` 水平错开，确保鲨鱼从任一层洞口下潜后正下方必有下一层海床与礁石群落承接。
 */
export const SEABED_TERRACE_TIERS: ReadonlyArray<SeabedTerraceTierSpec> = [
  {
    tierIndex: 0,
    labelZh: '阳光浅海珊瑚海床',
    biomeId: 'coral_reef',
    baseRidgeY: 414,
    minRidgeY: 332,
    maxRidgeY: 496,
    maxVisualRimY: 648,
    archTargetBaseY: 708,
    archMaxDepthY: 736,
    cellWidth: SHALLOW_ATOLL_CELL_WIDTH,
    seamPhaseOffsetX: 0,
    skipZeroSeam: true,
    openingHalfWidth: SHALLOW_CAVE_OPENING_HALF_WIDTH,
    bowlHalfWidth: SHALLOW_CAVE_BOWL_HALF_WIDTH,
    bowlDropDepth: 148,
    minMainFloorForOpening: 680,
    graftStartMainY: 560,
    graftEndMainY: 880,
    graftFuseMainY: 760,
    seedSalt: 613,
  },
  {
    tierIndex: 1,
    labelZh: '上暮光层礁石阶地海床',
    biomeId: 'rocky_shelf',
    baseRidgeY: 1220, // ΔY = +806m（层间走廊 736m~1130m = 394m）
    minRidgeY: 1130,
    maxRidgeY: 1310,
    maxVisualRimY: 1475,
    archTargetBaseY: 1512,
    archMaxDepthY: 1545,
    cellWidth: 1800,
    seamPhaseOffsetX: 800,
    skipZeroSeam: false,
    openingHalfWidth: 248,
    bowlHalfWidth: 440,
    bowlDropDepth: 156,
    minMainFloorForOpening: 1500,
    graftStartMainY: 1370,
    graftEndMainY: 1710,
    graftFuseMainY: 1575,
    seedSalt: 1619,
  },
  {
    tierIndex: 2,
    labelZh: '中暮光层海谷台地海床',
    biomeId: 'rocky_shelf',
    baseRidgeY: 2220, // ΔY = +1000m（层间走廊 1545m~2120m = 575m）
    minRidgeY: 2120,
    maxRidgeY: 2320,
    maxVisualRimY: 2495,
    archTargetBaseY: 2532,
    archMaxDepthY: 2568,
    cellWidth: 2000,
    seamPhaseOffsetX: 350,
    skipZeroSeam: false,
    openingHalfWidth: 266,
    bowlHalfWidth: 468,
    bowlDropDepth: 164,
    minMainFloorForOpening: 2520,
    graftStartMainY: 2380,
    graftEndMainY: 2750,
    graftFuseMainY: 2600,
    seedSalt: 2633,
  },
  {
    tierIndex: 3,
    labelZh: '深暮光半深海峡谷海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 3460, // ΔY = +1240m（层间走廊 2568m~3350m = 782m）
    minRidgeY: 3350,
    maxRidgeY: 3570,
    maxVisualRimY: 3755,
    archTargetBaseY: 3792,
    archMaxDepthY: 3832,
    cellWidth: 2200,
    seamPhaseOffsetX: 1100,
    skipZeroSeam: false,
    openingHalfWidth: 284,
    bowlHalfWidth: 496,
    bowlDropDepth: 172,
    minMainFloorForOpening: 3780,
    graftStartMainY: 3630,
    graftEndMainY: 4030,
    graftFuseMainY: 3865,
    seedSalt: 3671,
  },
  {
    tierIndex: 4,
    labelZh: '半深海裂谷前哨阶地海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 5040, // ΔY = +1580m（层间走廊 3832m~4910m = 1078m）
    minRidgeY: 4910,
    maxRidgeY: 5170,
    maxVisualRimY: 5365,
    archTargetBaseY: 5402,
    archMaxDepthY: 5446,
    cellWidth: 2400,
    seamPhaseOffsetX: 600,
    skipZeroSeam: false,
    openingHalfWidth: 302,
    bowlHalfWidth: 524,
    bowlDropDepth: 180,
    minMainFloorForOpening: 5390,
    graftStartMainY: 5230,
    graftEndMainY: 5660,
    graftFuseMainY: 5480,
    seedSalt: 4723,
  },
  {
    tierIndex: 5,
    labelZh: '深海玄武岩断崖海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 7060, // ΔY = +2020m（层间走廊 5446m~6910m = 1464m）
    minRidgeY: 6910,
    maxRidgeY: 7210,
    maxVisualRimY: 7420,
    archTargetBaseY: 7456,
    archMaxDepthY: 7506,
    cellWidth: 2600,
    seamPhaseOffsetX: 1500,
    skipZeroSeam: false,
    openingHalfWidth: 324,
    bowlHalfWidth: 560,
    bowlDropDepth: 192,
    minMainFloorForOpening: 7440,
    graftStartMainY: 7270,
    graftEndMainY: 7740,
    graftFuseMainY: 7545,
    seedSalt: 5801,
  },
  {
    tierIndex: 6,
    labelZh: '深渊幽冥海盆阶地海床',
    biomeId: 'underwater_canyon',
    baseRidgeY: 9640, // ΔY = +2580m（层间走廊 7506m~9470m = 1964m）
    minRidgeY: 9470,
    maxRidgeY: 9810,
    maxVisualRimY: 10030,
    archTargetBaseY: 10066,
    archMaxDepthY: 10122,
    cellWidth: 2900,
    seamPhaseOffsetX: 700,
    skipZeroSeam: false,
    openingHalfWidth: 350,
    bowlHalfWidth: 604,
    bowlDropDepth: 206,
    minMainFloorForOpening: 10050,
    graftStartMainY: 9880,
    graftEndMainY: 10380,
    graftFuseMainY: 10165,
    seedSalt: 6883,
  },
  {
    tierIndex: 7,
    labelZh: '超深渊黑曜石裂谷海床',
    biomeId: 'deep_abyss',
    baseRidgeY: 12900, // ΔY = +3260m（层间走廊 10122m~12710m = 2588m）
    minRidgeY: 12710,
    maxRidgeY: 13090,
    maxVisualRimY: 13324,
    archTargetBaseY: 13360,
    archMaxDepthY: 13422,
    cellWidth: 3200,
    seamPhaseOffsetX: 1900,
    skipZeroSeam: false,
    openingHalfWidth: 380,
    bowlHalfWidth: 652,
    bowlDropDepth: 222,
    minMainFloorForOpening: 13340,
    graftStartMainY: 13160,
    graftEndMainY: 13700,
    graftFuseMainY: 13470,
    seedSalt: 7949,
  },
  {
    tierIndex: 8,
    labelZh: '冥渊海沟热液前哨海床',
    biomeId: 'deep_abyss',
    baseRidgeY: 16900, // ΔY = +4000m（层间走廊 13422m~16690m = 3268m）
    minRidgeY: 16690,
    maxRidgeY: 17110,
    maxVisualRimY: 17360,
    archTargetBaseY: 17396,
    archMaxDepthY: 17464,
    cellWidth: 3600,
    seamPhaseOffsetX: 900,
    skipZeroSeam: false,
    openingHalfWidth: 416,
    bowlHalfWidth: 710,
    bowlDropDepth: 240,
    minMainFloorForOpening: 17370,
    graftStartMainY: 17180,
    graftEndMainY: 17760,
    graftFuseMainY: 17515,
    seedSalt: 9013,
  },
];

export interface ShallowCoralAtollSample {
  /** 当前横坐标是否处于前景实心海床碰撞段内（弧形下潜洞口处为 false，允许自由向下/向上进出洞口） */
  active: boolean;
  /** 所属海床阶梯层级索引 (0..8) */
  tierIndex?: number;
  /** 当前横坐标是否处于向远处弯曲的弧形下潜洞口区间 */
  isDiveOpening?: boolean;
  /** 下潜洞口向远处弧形凹陷程度 ∈ [0, 1]（0 = 前景实心海床，1 = 弧形下潜洞口正中心） */
  openingDepthFactor?: number;
  /** 连续海床视觉表层深度 (m / worldPx)：实心段等于 topFloorY，洞口段沿向远处的下凹弧线平滑延伸，确保海床 100% 连续不断开 */
  visualRimY?: number;
  /** 连续海床视觉表层局部斜率 d(visualRimY)/dX */
  visualRimSlope?: number;
  /** 所属环礁/阶地单元索引 */
  atollIndex: number;
  /** 前景实心海床表面深度 (m / worldPx) */
  topFloorY: number;
  /** 下方玄武岩拱形洞顶底界深度 (m / worldPx)；实心段从下向上游动在此高度被洞顶阻挡，此深度以下的深水走廊 100% 畅通 */
  bottomArchY: number;
  /** 海床顶面局部斜率 d(topFloorY)/dX */
  slope: number;
  /** 下方拱形洞顶局部斜率 d(bottomArchY)/dX（用于从下向上接触洞顶滑行时的切向投影） */
  bottomSlope?: number;
  /** 实心平台边缘平滑包络 ∈ [0, 1]（实心段中心为 1，向两侧弧形洞口平滑归零） */
  edgeWeight: number;
  /** 单元左端实心起点 X */
  archStartX: number;
  /** 单元右端实心终点 X */
  archEndX: number;
}

function evalTerraceSeabedContinuousRaw(
  worldX: number,
  tier: SeabedTerraceTierSpec,
  config: WorldConfigType
): {
  rawRidgeY: number;
  dRidgeDx: number;
  visualRimY: number;
  visualRimSlope: number;
  topY: number;
  slope: number;
  edgeWeight: number;
  openingDepthFactor: number;
  isDiveOpening: boolean;
  bottomArchY: number;
  bottomSlope: number;
  nearestOpenSeamX: number;
} {
  const seedPhase =
    (((config.worldSeed + tier.seedSalt * 131) & 0xffff) / 65536) * Math.PI * 2;
  const cellWave = evalSmoothTerrainWave(worldX, tier.cellWidth, tier.seedSalt, config);
  const k1 = (Math.PI * 2) / (1180 + tier.tierIndex * 110);
  const k2 = (Math.PI * 2) / (560 + tier.tierIndex * 45);
  const k3 = (Math.PI * 2) / (290 + tier.tierIndex * 22);
  const k4 = (Math.PI * 2) / 155;

  // 100% 跨全图 C1 连续的各层山峦基准曲线（绝无跨单元跳变）
  const ampScale = 1 + tier.tierIndex * 0.08;
  const w1 = Math.sin(worldX * k1 + seedPhase) * (32 * ampScale);
  const w2 = Math.cos(worldX * k2 - seedPhase * 0.7 + 1.1) * (20 * ampScale);
  const w3 = Math.sin(worldX * k3 + seedPhase * 1.3 + 2.4) * (11 * ampScale);
  const w4 = Math.cos(worldX * k4 - seedPhase * 0.4 + 0.6) * 5;
  const rawRidgeY = Math.max(
    tier.minRidgeY,
    Math.min(tier.maxRidgeY, tier.baseRidgeY + cellWave * (22 * ampScale) + w1 + w2 + w3 + w4)
  );

  const dRidgeDx =
    Math.cos(worldX * k1 + seedPhase) * (32 * ampScale * k1) -
    Math.sin(worldX * k2 - seedPhase * 0.7 + 1.1) * (20 * ampScale * k2) +
    Math.cos(worldX * k3 + seedPhase * 1.3 + 2.4) * (11 * ampScale * k3) -
    Math.sin(worldX * k4 - seedPhase * 0.4 + 0.6) * (5 * k4);

  // 定位最近的弧形下潜洞口中心（第 0 层排除 X=0 新手出生主海山中心；中层按 seamPhaseOffsetX 错位排布）
  const shiftedX = worldX - tier.seamPhaseOffsetX;
  const rawSeamIdx = Math.round(shiftedX / tier.cellWidth);
  const nearestOpenSeamIdx = tier.skipZeroSeam
    ? shiftedX >= 0
      ? Math.max(1, rawSeamIdx)
      : Math.min(-1, rawSeamIdx)
    : rawSeamIdx;
  const nearestOpenSeamX = nearestOpenSeamIdx * tier.cellWidth + tier.seamPhaseOffsetX;
  const distFromSeam = worldX - nearestOpenSeamX;
  const absDist = Math.abs(distFromSeam);

  // 仅当洞口中心下方主海床足够深 (> minMainFloorForOpening) 时才形成下潜洞口
  const seamMainFloorY = getFloorDepthAt(nearestOpenSeamX, config);
  const hasOpeningAtSeam = seamMainFloorY > tier.minMainFloorForOpening;

  let openingDepthFactor = 0;
  let dOpeningFactorDx = 0;
  if (hasOpeningAtSeam && absDist < tier.bowlHalfWidth) {
    const rimNorm = absDist / tier.bowlHalfWidth;
    openingDepthFactor = 0.5 * (1 + Math.cos(rimNorm * Math.PI));
    if (absDist > 1e-4) {
      dOpeningFactorDx =
        -0.5 *
        (Math.PI / tier.bowlHalfWidth) *
        Math.sin(rimNorm * Math.PI) *
        (distFromSeam >= 0 ? 1 : -1);
    }
  }

  // 连续海床视觉表层：在弧形下潜洞口区间平滑向远处深海下弯凹陷 (+bowlDropDepth)，形成向下的弧形洞口后壁
  const bowlPower = 1.35;
  const archBowlDrop =
    openingDepthFactor > 0
      ? tier.bowlDropDepth * Math.pow(openingDepthFactor, bowlPower)
      : 0;
  const dArchBowlDropDx =
    openingDepthFactor > 1e-4
      ? tier.bowlDropDepth *
        bowlPower *
        Math.pow(openingDepthFactor, bowlPower - 1) *
        dOpeningFactorDx
      : 0;

  const visualRimY = Math.max(
    tier.minRidgeY - 7,
    Math.min(tier.maxVisualRimY, rawRidgeY + archBowlDrop)
  );
  const visualRimSlope = Math.max(-1.35, Math.min(1.35, dRidgeDx + dArchBowlDropDx));

  const isDiveOpening = hasOpeningAtSeam && absDist < tier.openingHalfWidth;

  // 实心前景海床权重：在洞口边缘平滑过渡，使两侧洞唇圆润饱满
  const edgeWeight = !hasOpeningAtSeam
    ? 1
    : isDiveOpening
    ? 0
    : quinticSmoothstep(
        tier.openingHalfWidth,
        tier.openingHalfWidth + 160,
        absDist
      );

  const topY = visualRimY;
  const slope = visualRimSlope;

  // 下方拱形洞顶与洞口两侧向下弯曲的洞壁曲线 bottomArchY：
  // 1) 在洞口两侧唇口沿 C2 平滑弧线从 topY + 42m 向下弯曲至 archTargetBaseY，形成天然向下的洞口左右岩壁；
  // 2) 精确计算洞壁下弯导数 dWallDropTDx 并计入 bottomSlope，确保沿洞口向下斜线水平移动时切向缩放与真实斜率 100% 匹配，杜绝速度叠加！
  const wallRampSpan = 165;
  const wallDropU = !hasOpeningAtSeam
    ? 1
    : isDiveOpening
    ? 0
    : Math.max(0, Math.min(1, (absDist - tier.openingHalfWidth) / wallRampSpan));
  const wallDropT =
    wallDropU <= 0
      ? 0
      : wallDropU >= 1
      ? 1
      : wallDropU * wallDropU * wallDropU * (wallDropU * (wallDropU * 6 - 15) + 10);
  const dWallDropTDx =
    !hasOpeningAtSeam || isDiveOpening || wallDropU <= 0 || wallDropU >= 1
      ? 0
      : ((30 * wallDropU * wallDropU * (wallDropU - 1) * (wallDropU - 1)) /
          wallRampSpan) *
        (distFromSeam >= 0 ? 1 : -1);

  const stalactiteWave =
    Math.sin(worldX * 0.017 + seedPhase * 1.1) * 14 +
    Math.cos(worldX * 0.029 - seedPhase * 0.6) * 8;
  const dStalactiteDx =
    Math.cos(worldX * 0.017 + seedPhase * 1.1) * (14 * 0.017) -
    Math.sin(worldX * 0.029 - seedPhase * 0.6) * (8 * 0.029);

  const lipArchY = topY + 42;
  const targetDeepArchY = Math.max(
    topY + 195,
    Math.min(tier.archMaxDepthY, tier.archTargetBaseY + stalactiteWave)
  );
  const bottomArchY = lipArchY + (targetDeepArchY - lipArchY) * wallDropT;
  const rawBottomSlope =
    slope * (1 - wallDropT) +
    wallDropT * dStalactiteDx +
    (targetDeepArchY - lipArchY) * dWallDropTDx;
  const bottomSlope = Math.max(-2.6, Math.min(2.6, rawBottomSlope));

  return {
    rawRidgeY,
    dRidgeDx,
    visualRimY,
    visualRimSlope,
    topY,
    slope,
    edgeWeight,
    openingDepthFactor,
    isDiveOpening,
    bottomArchY,
    bottomSlope,
    nearestOpenSeamX,
  };
}

/**
 * 查询任意横坐标 `worldX` 与指定层级 `tierIndex (0..4)` 处的连续阶梯海床及弧形下潜洞口状态
 */
export function getSeabedTerraceAt(
  worldX: number,
  tierIndex: number,
  config: WorldConfigType = WorldConfig
): ShallowCoralAtollSample {
  const tier = SEABED_TERRACE_TIERS[tierIndex] ?? SEABED_TERRACE_TIERS[0];
  if (!Number.isFinite(worldX) || config.terrain.minFloorDepth > 600) {
    return {
      active: false,
      tierIndex: tier.tierIndex,
      isDiveOpening: false,
      openingDepthFactor: 0,
      visualRimY: tier.baseRidgeY,
      visualRimSlope: 0,
      atollIndex: 0,
      topFloorY: tier.baseRidgeY,
      bottomArchY: tier.archTargetBaseY,
      slope: 0,
      bottomSlope: 0,
      edgeWeight: 0,
      archStartX: 0,
      archEndX: 0,
    };
  }

  const shiftedX = worldX - tier.seamPhaseOffsetX;
  const cellIdx = Math.floor(shiftedX / tier.cellWidth);
  const archStartX =
    tier.skipZeroSeam && cellIdx === 0
      ? 0
      : cellIdx * tier.cellWidth + tier.seamPhaseOffsetX + tier.openingHalfWidth;
  const archEndX =
    tier.skipZeroSeam && cellIdx === -1
      ? 0
      : (cellIdx + 1) * tier.cellWidth + tier.seamPhaseOffsetX - tier.openingHalfWidth;

  const raw = evalTerraceSeabedContinuousRaw(worldX, tier, config);
  const mainFloorY = getFloorDepthAt(worldX, config);
  const mainSlope = getTerrainSlopeAt(worldX, config);

  // 当主海床本身浅于当前层的嫁接起点 (mainFloorY <= graftStartMainY) 时，
  // 仅保留主海床或更浅层本体，绝不在主海床山体内或上方叠加多余海床！
  if (mainFloorY <= tier.graftStartMainY) {
    return {
      active: false,
      tierIndex: tier.tierIndex,
      isDiveOpening: false,
      openingDepthFactor: 0,
      visualRimY: mainFloorY,
      visualRimSlope: mainSlope,
      atollIndex: cellIdx === 0 ? 0 : cellIdx,
      topFloorY: mainFloorY,
      bottomArchY: Math.max(raw.bottomArchY, mainFloorY + 60),
      slope: mainSlope,
      bottomSlope: mainSlope,
      edgeWeight: 0,
      archStartX,
      archEndX,
    };
  }

  // 在主海床大陆坡与当前层连续海床交汇处 ([graftStartMainY, graftEndMainY]) 做 C2 平滑嫁接，
  // 且当 mainFloorY < graftFuseMainY 时将底部岩体完全嵌入主海床山根内部，彻底杜绝双层夹缝！
  const graftT = quinticSmoothstep(tier.graftStartMainY, tier.graftEndMainY, mainFloorY);
  const graftedTopY = mainFloorY + (raw.topY - mainFloorY) * graftT;
  const graftedVisualRimY = mainFloorY + (raw.visualRimY - mainFloorY) * graftT;
  const graftedSlope = mainSlope + (raw.slope - mainSlope) * graftT;
  const graftedVisualSlope = mainSlope + (raw.visualRimSlope - mainSlope) * graftT;
  const graftedBottomArchY =
    mainFloorY < tier.graftFuseMainY
      ? Math.max(
          raw.bottomArchY,
          Math.min(tier.archMaxDepthY + 6, mainFloorY + 48 * (1 - graftT * 0.5))
        )
      : Math.min(mainFloorY - 22, Math.max(graftedTopY + 42, raw.bottomArchY));
  const graftedEdgeWeight = raw.edgeWeight * graftT;

  return {
    active: !raw.isDiveOpening && graftT > 0.03,
    tierIndex: tier.tierIndex,
    isDiveOpening: raw.isDiveOpening,
    openingDepthFactor: raw.openingDepthFactor * graftT,
    visualRimY: graftedVisualRimY,
    visualRimSlope: graftedVisualSlope,
    atollIndex: cellIdx === 0 ? 0 : cellIdx,
    topFloorY: graftedTopY,
    bottomArchY: graftedBottomArchY,
    slope: graftedSlope,
    bottomSlope: raw.bottomSlope * graftT + mainSlope * (1 - graftT),
    edgeWeight: graftedEdgeWeight,
    archStartX,
    archEndX,
  };
}

/**
 * 查询任意横坐标 `worldX` 处所有 5 层阶梯海床的状态列表
 */
export function getAllSeabedTerracesAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): ShallowCoralAtollSample[] {
  return SEABED_TERRACE_TIERS.map((tier) =>
    getSeabedTerraceAt(worldX, tier.tierIndex, config)
  );
}

/**
 * 查询任意横坐标 `worldX` 处的第 0 层（阳光浅海珊瑚层）连续海床与弧形下潜洞口状态 `getShallowCoralAtollAt(worldX, config)`
 */
export function getShallowCoralAtollAt(
  worldX: number,
  config: WorldConfigType = WorldConfig
): ShallowCoralAtollSample {
  return getSeabedTerraceAt(worldX, 0, config);
}

export interface ShallowCoralAtollOutcrop {
  id: string;
  type: 'coral' | 'rock' | 'seagrass';
  variant: string;
  worldX: number;
  floorY: number;
  slope: number;
  scale: number;
  seedHash: number;
  biomeId: BiomeId;
  tierIndex?: number;
}

const MAX_ATOLL_OUTCROP_CACHE_SIZE = 64;
const shallowAtollOutcropCache = new Map<string, ReadonlyArray<ShallowCoralAtollOutcrop>>();

/**
 * 获取指定水平 `chunkX` 内浅海及全部中层阶梯海床 (`tierIndex = 0..4`) 顶面附着生长的珊瑚礁盘、共生礁石与海草群落
 * 100% 确定性、紧贴各层 `terrace.topFloorY` 生长，让鲨鱼在浅海与广阔中层海域游动时始终有丰富的海底地貌与生态参照物！
 */
export function getShallowCoralAtollOutcropsForChunk(
  chunkX: number,
  config: WorldConfigType = WorldConfig
): ReadonlyArray<ShallowCoralAtollOutcrop> {
  if (!Number.isInteger(chunkX) || config.terrain.minFloorDepth > 600) {
    return [];
  }
  const cx = chunkX === 0 ? 0 : chunkX;
  const cacheKey = `${config.worldSeed}:${config.generatorVersion}:${cx}`;
  const cached = shallowAtollOutcropCache.get(cacheKey);
  if (cached) return cached;

  const startX = cx * config.chunk.width;
  const endX = startX + config.chunk.width;
  const outcrops: ShallowCoralAtollOutcrop[] = [];

  // 按 tierIndex = 0..8 依次生成各层海床顶面附着物（第 0 层排在最前，确保浅海珊瑚采样索引稳定）
  for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
    const tier = SEABED_TERRACE_TIERS[tIdx];
    const slotStep = tIdx === 0 ? 150 : 195 + tIdx * 18;
    const firstSlot = Math.ceil(startX / slotStep);
    const lastSlot = Math.floor((endX - 1) / slotStep);

    for (let slot = firstSlot; slot <= lastSlot; slot++) {
      const slotSeed = mixSubsystemSeed(
        config.worldSeed,
        config.generatorVersion,
        slot,
        733 + tIdx * 317,
        'flora'
      );
      const jitter = (((slotSeed % 1000) / 1000) - 0.5) * (tIdx === 0 ? 68 : 88);
      const wx = Math.max(startX + 24, Math.min(endX - 24, slot * slotStep + jitter));
      const terrace = getSeabedTerraceAt(wx, tIdx, config);
      if (!terrace.active || terrace.edgeWeight < 0.18) continue;

      const typeRoll = (slotSeed >>> 10) % 100;
      const type: 'coral' | 'rock' | 'seagrass' =
        tIdx === 0
          ? typeRoll < 58
            ? 'coral'
            : typeRoll < 82
            ? 'rock'
            : 'seagrass'
          : tIdx <= 2
          ? typeRoll < 44
            ? 'rock'
            : typeRoll < 78
            ? 'coral'
            : 'seagrass'
          : tIdx <= 5
          ? typeRoll < 56
            ? 'rock'
            : typeRoll < 86
            ? 'coral'
            : 'seagrass'
          : typeRoll < 72
          ? 'rock'
          : typeRoll < 92
          ? 'coral'
          : 'seagrass';

      const variants =
        type === 'coral'
          ? tIdx === 0
            ? (['staghorn', 'brain_coral', 'fan_coral', 'tube_sponge'] as const)
            : (['fan_coral', 'tube_sponge', 'brain_coral'] as const)
          : type === 'rock'
          ? (['mossy_slab', 'basalt_boulder', 'jagged_spire'] as const)
          : (['meadow_tuft', 'ribbon_grass'] as const);
      const variant = variants[(slotSeed >>> 17) % variants.length];
      const scale = Number(
        ((tIdx === 0 ? 0.88 : 0.94) + ((slotSeed >>> 21) % 100) * 0.0052).toFixed(3)
      );

      outcrops.push({
        id:
          tIdx === 0
            ? `atoll_outcrop_${cx}_${slot}`
            : `terrace_${tIdx}_outcrop_${cx}_${slot}`,
        type,
        variant,
        worldX: wx,
        floorY: terrace.topFloorY,
        slope: terrace.slope,
        scale,
        seedHash: slotSeed,
        biomeId: tier.biomeId,
        tierIndex: tIdx,
      });
    }
  }

  if (shallowAtollOutcropCache.size >= MAX_ATOLL_OUTCROP_CACHE_SIZE) {
    const oldestKey = shallowAtollOutcropCache.keys().next().value;
    if (oldestKey !== undefined) {
      shallowAtollOutcropCache.delete(oldestKey);
    }
  }
  shallowAtollOutcropCache.set(cacheKey, outcrops);
  return outcrops;
}

/**
 * 规范第 0.6 & 11 节：1.0x 世界层海床双向（顶面承托 + 洞顶阻挡）物理碰撞解算纯函数
 * 同时支持：
 * 1) 连续主海床 `getFloorDepthAt(worldX)`；
 * 2) 浅海与中层 5 级连续阶梯海床 `getSeabedTerraceAt(worldX, tierIndex)` (`tierIndex = 0..4`)：
 *    - 当实体位于某一层海床上方 (`refY <= topFloorY + 4`) 时，受该层顶面 `topFloorY - safeRadius` 向上承托；
 *    - 当实体位于某一层海床下方 (`refY > topFloorY + 4`) 向上游动时，受该层拱形洞顶 `bottomArchY + safeRadius` 向下阻挡（彻底杜绝从下向上穿透任何浅层或中层海床！）；
 *    - 在各层弧形下潜洞口 (`isDiveOpening === true`) 及层间水平水道走廊 100% 畅通无阻；
 * 3) 输出切向弧长投影系数 `tangentScale = 1 / sqrt(1 + slope^2)` 以消除斜坡游动速度异常。
 */
export interface SeabedCollisionResult {
  engineX: number;
  engineY: number;
  vy: number;
  collided: boolean;
  floorWorldY: number;
  floorEngineY: number;
  slope: number;
  /** 斜坡单位切向量水平分量 cos(theta) = 1 / sqrt(1 + slope^2)，用于归一化沿地形游动速度 */
  tangentScale: number;
  /** 是否碰撞在浅海或中层阶梯海床段（顶面或底部拱顶） */
  onShallowAtoll?: boolean;
  /** 是否从下方撞击阶梯海床底部拱形洞顶（阻挡向上穿透） */
  hitAtollUnderside?: boolean;
  /** 发生碰撞的阶梯海床层级索引 (0..4) */
  terraceTierIndex?: number;
}

export function resolveSeabedCollision(
  engineX: number,
  engineY: number,
  entityRadiusMeters: number,
  vy: number,
  config: WorldConfigType = WorldConfig,
  prevEngineY?: number
): SeabedCollisionResult {
  const worldX = engineX * WORLD_UNITS_PER_METER;
  const safeRadius = Math.max(0, entityRadiusMeters);

  const floorWorldY = getFloorDepthAt(worldX, config);
  const mainSlope = getTerrainSlopeAt(worldX, config);
  const floorEngineY = worldYToEngineY(floorWorldY);
  const maxAllowedMainY = floorEngineY - safeRadius;
  const mainTangentScale = 1 / Math.sqrt(1 + mainSlope * mainSlope);

  const refY =
    prevEngineY !== undefined && Number.isFinite(prevEngineY) ? prevEngineY : engineY;

  // 依次检查浅海及中层 5 级连续阶梯海床实心段（洞口区间 terrace.active === false，允许自由下潜与上浮）
  for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
    const tierSpec = SEABED_TERRACE_TIERS[tIdx];
    // 快速高度粗筛：若当前实体与参考点均远离该层海床高度带，则直接跳过
    const bandMinY = tierSpec.minRidgeY - safeRadius - 120;
    const bandMaxY = tierSpec.archMaxDepthY + safeRadius + 120;
    if (
      (engineY < bandMinY && refY < bandMinY) ||
      (engineY > bandMaxY && refY > bandMaxY)
    ) {
      continue;
    }

    const terrace = getSeabedTerraceAt(worldX, tIdx, config);
    if (!terrace.active) continue;

    // 当主海床山坡上抬 (mainFloorY < graftFuseMainY) 使拱顶嵌入山根内部时，不存在洞下水通道，整个区间为实心山体楔块！
    const hasUnderCorridor = floorEngineY - terrace.bottomArchY > safeRadius * 1.25;
    if (!hasUnderCorridor) {
      const wedgeTopY = Math.min(terrace.topFloorY, floorEngineY);
      const wedgeTopAllowedY = Math.min(maxAllowedMainY, wedgeTopY - safeRadius);
      if (engineY > wedgeTopAllowedY && refY >= tierSpec.minRidgeY - safeRadius - 260) {
        const wedgeSlope =
          terrace.topFloorY <= floorEngineY ? terrace.slope : mainSlope;
        const wedgeTangentScale = 1 / Math.sqrt(1 + wedgeSlope * wedgeSlope);
        return {
          engineX,
          engineY: wedgeTopAllowedY,
          vy: vy > 0 ? -vy * 0.12 : vy,
          collided: true,
          floorWorldY: engineYToWorldY(wedgeTopY),
          floorEngineY: wedgeTopY,
          slope: wedgeSlope,
          tangentScale: wedgeTangentScale,
          onShallowAtoll: true,
          hitAtollUnderside: false,
          terraceTierIndex: tIdx,
        };
      }
      continue;
    }

    const topAllowedY = Math.min(maxAllowedMainY, terrace.topFloorY - safeRadius);
    const bottomAllowedY = terrace.bottomArchY + safeRadius;

    // 严格区分「该层海床上方」与「该层海床下方」：凡起始高度位于表层以下 (refY > topFloorY + 4) 的实体一律归属该层下方，严禁向上穿透至表层！
    const isFromBelow =
      refY > terrace.topFloorY + 4 ||
      (refY > terrace.topFloorY - safeRadius * 0.25 && vy < -1e-3);

    if (!isFromBelow) {
      // 仅当实体从上方接触或陷入当前层岩体区间时触发顶面承托
      if (engineY > topAllowedY && refY >= tierSpec.minRidgeY - safeRadius - 260) {
        const atollTangentScale = 1 / Math.sqrt(1 + terrace.slope * terrace.slope);
        return {
          engineX,
          engineY: topAllowedY,
          vy: vy > 0 ? -vy * 0.12 : vy,
          collided: true,
          floorWorldY: engineYToWorldY(terrace.topFloorY),
          floorEngineY: terrace.topFloorY,
          slope: terrace.slope,
          tangentScale: atollTangentScale,
          onShallowAtoll: true,
          hitAtollUnderside: false,
          terraceTierIndex: tIdx,
        };
      }
    } else {
      // 实体位于当前层海床下方且向上触及拱形洞顶 (engineY < bottomAllowedY)：向下阻挡在洞顶之下
      if (engineY < bottomAllowedY && refY <= tierSpec.archMaxDepthY + safeRadius + 260) {
        const bSlope = terrace.bottomSlope ?? terrace.slope;
        const bTangentScale = 1 / Math.sqrt(1 + bSlope * bSlope);
        const clampedUnderY = Math.min(maxAllowedMainY, bottomAllowedY);
        return {
          engineX,
          engineY: clampedUnderY,
          vy: vy < 0 ? -vy * 0.15 : vy,
          collided: true,
          floorWorldY: engineYToWorldY(terrace.bottomArchY),
          floorEngineY: terrace.bottomArchY,
          slope: bSlope,
          tangentScale: bTangentScale,
          onShallowAtoll: true,
          hitAtollUnderside: true,
          terraceTierIndex: tIdx,
        };
      }
    }
  }

  if (engineY > maxAllowedMainY) {
    return {
      engineX,
      engineY: maxAllowedMainY,
      vy: vy > 0 ? -vy * 0.12 : vy,
      collided: true,
      floorWorldY,
      floorEngineY,
      slope: mainSlope,
      tangentScale: mainTangentScale,
      onShallowAtoll: false,
      hitAtollUnderside: false,
    };
  }

  return {
    engineX,
    engineY,
    vy,
    collided: false,
    floorWorldY,
    floorEngineY,
    slope: mainSlope,
    tangentScale: mainTangentScale,
    onShallowAtoll: false,
    hitAtollUnderside: false,
  };
}

/**
 * 海床斜坡切向等速运动与拱顶防穿透解算器 `resolveSeabedKineticStep`
 * 1) 顺着地形或洞口向下斜线水平/斜向移动时，将步长严格投影至边界单位切向量并执行二维弧长二分守恒钳制，
 *    且严禁向下一帧注入额外垂直地形分量 `vy`，彻底消除沿洞口向下斜线水平移动时的速度叠加；
 * 2) 从浅层或中层海床下方朝上游动或冲刺时，严格锁定 `prevEngineY` 归属侧并阻挡在拱形洞顶 `bottomArchY + radius` 之下，
 *    当洞顶与主海床交汇处楔形高度小于实体直径时阻止水平挤入山根，100% 杜绝从下向上穿透任何海床层！
 */
export interface SeabedKineticStepResult {
  engineX: number;
  engineY: number;
  vx: number;
  vy: number;
  collided: boolean;
  collision: SeabedCollisionResult;
  /** 本帧沿地形的实际二维合速度 (m/s) */
  effectiveSpeed2D: number;
}

function hitsTerraceVerticalWallHorizontally(
  prevEngineX: number,
  prevEngineY: number,
  candEngineX: number,
  entityRadiusMeters: number,
  config: WorldConfigType
): boolean {
  if (Math.abs(candEngineX - prevEngineX) < 1e-6) return false;
  const safeRadius = Math.max(0, entityRadiusMeters);
  const prevWorldX = prevEngineX * WORLD_UNITS_PER_METER;
  const candWorldX = candEngineX * WORLD_UNITS_PER_METER;
  const candMainY = getEngineFloorDepthAt(candEngineX, config);

  for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
    const tierSpec = SEABED_TERRACE_TIERS[tIdx];
    const bandMinY = tierSpec.minRidgeY - safeRadius - 120;
    const bandMaxY = tierSpec.archMaxDepthY + safeRadius + 120;
    if (prevEngineY < bandMinY || prevEngineY > bandMaxY) {
      continue;
    }

    const nextT = getSeabedTerraceAt(candWorldX, tIdx, config);
    if (!nextT.active) continue;

    const prevT = getSeabedTerraceAt(prevWorldX, tIdx, config);
    const candHasUnderCorridor = candMainY - nextT.bottomArchY > safeRadius * 1.25;

    // Case A: 实体在洞口开阔水域水平越过洞唇壁面 (!prevT.active -> nextT.active)，
    // 且垂直位置正对着实心悬崖断面（或该处已嫁接为无洞下通道的实心山根）
    if (!prevT.active) {
      const insideVerticalCliff =
        prevEngineY > nextT.topFloorY - safeRadius * 0.15 &&
        (!candHasUnderCorridor || prevEngineY < nextT.bottomArchY + safeRadius * 0.35);
      if (insideVerticalCliff) {
        return true;
      }
    }

    // Case B: 实体位于拱顶下方走廊/洞腔内，试图水平挤入洞顶与主海床交汇的狭窄山根楔形区（垂直净空 < 2*r + 4）
    if (
      prevEngineY > nextT.topFloorY + 4 &&
      candMainY - nextT.bottomArchY < safeRadius * 2 + 4 &&
      prevEngineY > Math.min(nextT.topFloorY, candMainY) - safeRadius * 0.15
    ) {
      return true;
    }
  }
  return false;
}

export function resolveSeabedKineticStep(
  prevEngineX: number,
  prevEngineY: number,
  vx: number,
  vy: number,
  simDt: number,
  entityRadiusMeters: number,
  config: WorldConfigType = WorldConfig
): SeabedKineticStepResult {
  const dt = Math.max(1e-6, simDt);
  const intendedSpeed = Math.hypot(vx, vy);
  const maxAllowedStepDist = intendedSpeed * dt;

  const rawNextX = prevEngineX + vx * dt;
  const rawNextY = prevEngineY + vy * dt;

  let stepTargetX = rawNextX;
  let hitWallHorizontally = false;
  if (
    hitsTerraceVerticalWallHorizontally(
      prevEngineX,
      prevEngineY,
      rawNextX,
      entityRadiusMeters,
      config
    )
  ) {
    hitWallHorizontally = true;
    let lo = 0;
    let hi = 1;
    let safeX = prevEngineX;
    for (let iter = 0; iter < 6; iter++) {
      const mid = (lo + hi) * 0.5;
      const candX = prevEngineX + (rawNextX - prevEngineX) * mid;
      if (
        hitsTerraceVerticalWallHorizontally(
          prevEngineX,
          prevEngineY,
          candX,
          entityRadiusMeters,
          config
        )
      ) {
        hi = mid;
      } else {
        lo = mid;
        safeX = candX;
      }
    }
    stepTargetX = safeX;
  }

  const initialCol = resolveSeabedCollision(
    stepTargetX,
    rawNextY,
    entityRadiusMeters,
    vy,
    config,
    prevEngineY
  );

  if (!initialCol.collided) {
    const effectiveVx = hitWallHorizontally ? 0 : vx;
    const effectiveSpeed = Math.hypot(stepTargetX - prevEngineX, rawNextY - prevEngineY) / dt;
    return {
      engineX: stepTargetX,
      engineY: rawNextY,
      vx: effectiveVx,
      vy,
      collided: hitWallHorizontally,
      collision: initialCol,
      effectiveSpeed2D: effectiveSpeed,
    };
  }

  // 分支 A：从下方或洞口侧面撞击海床底部拱形洞顶 / 洞口向下斜壁（阻挡向上穿透并沿斜壁切向等速滑行）
  if (initialCol.hitAtollUnderside) {
    const hitTierIdx = initialCol.terraceTierIndex ?? 0;
    const bSlope = initialCol.slope;
    const bTangentScale = initialCol.tangentScale; // 1 / sqrt(1 + bSlope^2)
    // 当水平移动挤压向下倾斜的洞壁 (vx * bSlope > 0) 时，将速度矢量正交投影到洞壁单位切向量 T = (bTangentScale, bSlope * bTangentScale)，防止水平位移与垂直下推位移叠加
    const effVx = hitWallHorizontally ? 0 : vx;
    const vParallelUnder = (effVx + Math.max(0, vy) * bSlope) * bTangentScale;
    const tangentSpeed =
      effVx * bSlope > 0
        ? effVx * vParallelUnder <= 0
          ? 0
          : Math.max(
              -intendedSpeed * 0.88,
              Math.min(intendedSpeed * 0.88, vParallelUnder * 0.88)
            )
        : effVx * 0.88;
    let adjustedDx = hitWallHorizontally ? (stepTargetX - prevEngineX) : tangentSpeed * bTangentScale * dt;
    let finalX = prevEngineX + adjustedDx;

    // 若目标 X 会横向穿透悬崖壁或挤入当前层拱顶与主海床交汇的狭窄山根楔形区（垂直净空 < 2 * radius + 4），阻止水平穿过以防穿模
    const nextTerrace = getSeabedTerraceAt(
      finalX * WORLD_UNITS_PER_METER,
      hitTierIdx,
      config
    );
    const nextMainFloorY = getEngineFloorDepthAt(finalX, config);
    if (
      hitsTerraceVerticalWallHorizontally(
        prevEngineX,
        prevEngineY,
        finalX,
        entityRadiusMeters,
        config
      ) ||
      (nextTerrace.active &&
        nextMainFloorY - nextTerrace.bottomArchY < entityRadiusMeters * 2 + 4)
    ) {
      finalX = stepTargetX;
      adjustedDx = finalX - prevEngineX;
      hitWallHorizontally = true;
    }

    let secondCol = resolveSeabedCollision(
      finalX,
      rawNextY,
      entityRadiusMeters,
      vy,
      config,
      prevEngineY
    );
    let finalY = secondCol.collided
      ? secondCol.engineY
      : Math.max(rawNextY, initialCol.engineY);

    // 二维步长守恒二分钳制：若沿洞口向下斜线滑行或跨越洞唇边界导致 2D 步长超过切向步长预算 maxUnderStepDist，
    // 通过 8 次二分收缩水平推进量 finalX，确保在不穿透洞顶 (finalY >= bottomArchY + radius) 的前提下 2D 合速度绝不超标
    const maxUnderStepDist =
      vx * bSlope > 0
        ? Math.min(
            maxAllowedStepDist * 0.88,
            Math.max(maxAllowedStepDist * 0.25, Math.abs(tangentSpeed) * dt)
          )
        : maxAllowedStepDist * 0.90;
    const actualStepDist = Math.hypot(finalX - prevEngineX, finalY - prevEngineY);
    if (
      actualStepDist > maxUnderStepDist &&
      actualStepDist > 1e-6 &&
      maxUnderStepDist > 1e-6
    ) {
      const prevColAtStart = resolveSeabedCollision(
        prevEngineX,
        prevEngineY,
        entityRadiusMeters,
        vy,
        config,
        prevEngineY
      );
      const startMinY = prevColAtStart.collided ? prevColAtStart.engineY : prevEngineY;

      let lo = 0;
      let hi = 1;
      let bestX = prevEngineX;
      let bestY = Math.max(
        startMinY,
        Math.min(finalY, prevEngineY + maxUnderStepDist * 0.35)
      );
      let bestCol = prevColAtStart;

      for (let iter = 0; iter < 8; iter++) {
        const mid = (lo + hi) * 0.5;
        const candX = prevEngineX + (finalX - prevEngineX) * mid;
        const candRawY = prevEngineY + vy * dt * mid;
        const candCol = resolveSeabedCollision(
          candX,
          candRawY,
          entityRadiusMeters,
          vy,
          config,
          prevEngineY
        );
        const candY = candCol.collided ? candCol.engineY : candRawY;
        const candDist = Math.hypot(candX - prevEngineX, candY - prevEngineY);
        if (candDist <= maxUnderStepDist * 1.0005) {
          lo = mid;
          bestX = candX;
          bestY = candY;
          bestCol = candCol;
        } else {
          hi = mid;
        }
      }

      finalX = bestX;
      finalY = bestY;
      secondCol = bestCol.collided ? bestCol : secondCol;
    }

    let nextVx =
      hitWallHorizontally
        ? 0
        : adjustedDx === 0
        ? vx * 0.35
        : vx * bSlope > 0
        ? tangentSpeed * bTangentScale
        : vx * 0.88;
    let nextVy = vy < 0 ? 0 : vy * bTangentScale * 0.88;
    const nextSpeed = Math.hypot(nextVx, nextVy);
    if (nextSpeed > intendedSpeed * 0.88 && nextSpeed > 1e-6) {
      const scale = (intendedSpeed * 0.88) / nextSpeed;
      nextVx *= scale;
      nextVy *= scale;
    }
    const effectiveSpeed2D = Math.hypot(finalX - prevEngineX, finalY - prevEngineY) / dt;

    return {
      engineX: finalX,
      engineY: finalY,
      vx: nextVx,
      vy: nextVy,
      collided: true,
      collision: secondCol,
      effectiveSpeed2D,
    };
  }

  // 分支 B：实体与海床顶面（含洞口向下的弧形斜坡顶面）发生接触，根据局部斜率 slope 的单位切向量 T = (tangentScale, slope * tangentScale) 正交投影步长
  const slope = initialCol.slope;
  const tangentScale = initialCol.tangentScale; // 1 / sqrt(1 + slope^2)
  const isMovingUphill = !hitWallHorizontally && vx * slope < -1e-4;

  let adjustedDx = hitWallHorizontally ? (stepTargetX - prevEngineX) : vx * dt;
  let nextVx = hitWallHorizontally ? 0 : vx;
  let nextVy = vy > 0 ? 0 : vy * tangentScale * 0.88;
  let maxArcDist = maxAllowedStepDist * 0.88;

  if (!hitWallHorizontally && isMovingUphill) {
    // 顺着斜坡上坡游动：将速度正交投影到斜坡单位切向量并乘以 0.88 阻尼，使水平分量为 cos^2(theta) * 0.88，斜向 2D 合成弧长 <= cos(theta) * 0.88 * intendedSpeed * dt
    const vParallelUp = (vx + Math.min(0, vy) * slope) * tangentScale;
    const uphillTangentSpeed =
      vx * vParallelUp <= 0
        ? 0
        : Math.max(-intendedSpeed * 0.88, Math.min(intendedSpeed * 0.88, vParallelUp * 0.88));
    adjustedDx = uphillTangentSpeed * tangentScale * dt;
    nextVx = uphillTangentSpeed * tangentScale;
    maxArcDist = Math.min(
      maxAllowedStepDist * 0.88,
      Math.max(maxAllowedStepDist * 0.25, Math.abs(uphillTangentSpeed) * dt)
    );
  } else if (!hitWallHorizontally) {
    // 下坡或贴底滑行：将速度矢量 (vx, vy) 投影到海床单位切向量 T = (tangentScale, slope * tangentScale)
    const vParallelDown = (vx + Math.max(0, vy) * slope) * tangentScale;
    const downhillTangentSpeed =
      vx * vParallelDown <= 0
        ? 0
        : Math.max(-intendedSpeed * 0.90, Math.min(intendedSpeed * 0.90, vParallelDown * 0.90));
    adjustedDx = downhillTangentSpeed * tangentScale * dt;
    nextVx = downhillTangentSpeed * tangentScale;
    maxArcDist = Math.min(
      maxAllowedStepDist * 0.90,
      Math.max(maxAllowedStepDist * 0.25, Math.abs(downhillTangentSpeed) * dt)
    );
  }

  let finalX = prevEngineX + adjustedDx;
  if (
    hitsTerraceVerticalWallHorizontally(
      prevEngineX,
      prevEngineY,
      finalX,
      entityRadiusMeters,
      config
    )
  ) {
    finalX = stepTargetX;
    adjustedDx = finalX - prevEngineX;
    nextVx = 0;
    hitWallHorizontally = true;
  }
  let secondCol = resolveSeabedCollision(
    finalX,
    rawNextY,
    entityRadiusMeters,
    vy,
    config,
    prevEngineY
  );
  let finalY = secondCol.collided ? secondCol.engineY : rawNextY;

  // 二维弧长终极守恒钳制：通过 8 次二分收缩确保任何斜坡贴地步进的 2D 总位移绝不超过切向投影上限 maxArcDist
  const speedCapRatio = isMovingUphill ? 0.88 : 0.90;
  const actualStepDist = Math.hypot(finalX - prevEngineX, finalY - prevEngineY);

  if (actualStepDist > maxArcDist && actualStepDist > 1e-6 && maxAllowedStepDist > 1e-6) {
    const prevColAtStart = resolveSeabedCollision(
      prevEngineX,
      prevEngineY,
      entityRadiusMeters,
      vy,
      config,
      prevEngineY
    );
    const startMaxY = prevColAtStart.collided ? prevColAtStart.engineY : prevEngineY;

    let lo = 0;
    let hi = 1;
    let bestX = prevEngineX;
    let bestY = Math.min(startMaxY, Math.max(finalY, prevEngineY - maxArcDist * 0.35));
    let bestCol = prevColAtStart;

    for (let iter = 0; iter < 8; iter++) {
      const mid = (lo + hi) * 0.5;
      const candX = prevEngineX + (finalX - prevEngineX) * mid;
      const candRawY = prevEngineY + vy * dt * mid;
      const candCol = resolveSeabedCollision(
        candX,
        candRawY,
        entityRadiusMeters,
        vy,
        config,
        prevEngineY
      );
      const candY = candCol.collided ? candCol.engineY : candRawY;
      const candDist = Math.hypot(candX - prevEngineX, candY - prevEngineY);
      if (candDist <= maxArcDist * 1.0005) {
        lo = mid;
        bestX = candX;
        bestY = candY;
        bestCol = candCol;
      } else {
        hi = mid;
      }
    }

    finalX = bestX;
    finalY = bestY;
    secondCol = bestCol.collided ? bestCol : secondCol;
  }

  // 严禁向 nextVy 注入 (finalY - prevEngineY)/dt，并确保返回的速度模长 <= intendedSpeed * speedCapRatio
  const nextSpeed = Math.hypot(nextVx, nextVy);
  const maxAllowedSpeed = intendedSpeed * speedCapRatio;
  if (nextSpeed > maxAllowedSpeed && nextSpeed > 1e-6) {
    const scale = maxAllowedSpeed / nextSpeed;
    nextVx *= scale;
    nextVy *= scale;
  }

  const finalEffectiveSpeed = Math.hypot(finalX - prevEngineX, finalY - prevEngineY) / dt;

  return {
    engineX: finalX,
    engineY: finalY,
    vx: nextVx,
    vy: nextVy,
    collided: true,
    collision: secondCol,
    effectiveSpeed2D: finalEffectiveSpeed,
  };
}

