import {
  WorldConfig,
  WorldConfigType,
  ChunkBounds2D,
  worldToChunkCoord,
  getChunkBounds,
  isPointInChunkBounds,
  clampWorldDepth,
  createChunkRng,
  createStableId,
} from './worldCore';
import {
  TerrainChunkSamples,
  getFloorDepthAt,
  getTerrainSlopeAt,
  getTerrainSamples,
} from './terrainSystem';
import {
  BiomeId,
  DepthBandId,
  BiomeSampleResult,
  getBiomeAt,
  DepthVisualProfile,
  getDepthVisualProfile,
} from './biomeSystem';

// ============================================================================
// 阶段 D（规范第 7、8、9、13、14-D 节）：生态对象配置、POI 生成器 (POIGenerator)、生态生成与 ChunkGenerator 11 步管线
// ============================================================================

/**
 * 规范第 11 节：世界渲染层枚举
 */
export type WorldRenderLayerId =
  | 'far_background'
  | 'mid_background'
  | 'near_background'
  | 'ambient_particles'
  | 'creatures'
  | 'terrain'
  | 'terrain_detail'
  | 'poi'
  | 'foreground_occluders'
  | 'ui';

export const WORLD_RENDER_LAYER_ORDER: Record<WorldRenderLayerId, number> = {
  far_background: 0,
  mid_background: 1,
  near_background: 2,
  ambient_particles: 3,
  creatures: 4,
  terrain: 5,
  terrain_detail: 6,
  poi: 7,
  foreground_occluders: 8,
  ui: 9,
};

/**
 * 规范第 7 & 9 节：生态对象与 POI 类型枚举
 * 覆盖规范第 7 节全部 13 类对象（珊瑚、岩石、海草、鱼群、水母、发光生物、沉船碎片、气泡、浮游颗粒、海雪、洞穴、宝藏、地标）
 * 以及规范第 9 节全部 5 类首版 POI（shipwreck、cave、treasure、rare_creature_nest、landmark）。
 */
export type EcologyObjectType =
  | 'coral'
  | 'rock'
  | 'seagrass'
  | 'fish_school'
  | 'jellyfish'
  | 'biolum_organism'
  | 'shipwreck_debris'
  | 'bubble_stream'
  | 'plankton_mote'
  | 'marine_snow'
  | 'cave'
  | 'treasure'
  | 'landmark'
  | 'shipwreck'
  | 'rare_creature_nest';

export type POIType =
  | 'shipwreck'
  | 'cave'
  | 'treasure'
  | 'rare_creature_nest'
  | 'landmark';

export const POI_TYPES: readonly POIType[] = [
  'shipwreck',
  'cave',
  'treasure',
  'rare_creature_nest',
  'landmark',
] as const;

export type ObjectCollisionType = 'none' | 'solid' | 'trigger' | 'hazard';
export type ObjectLifecycleType = 'static' | 'spawner' | 'ambient_loop' | 'interactive_poi';
export type SeabedPlacementConstraint = 'floor_anchored' | 'near_floor' | 'water_column';

/**
 * 规范第 7 节：每类生态对象完整配置表
 * 包含 type、Biome 白名单 (allowedBiomes)、min/maxDepth、spawnWeight、minSpacing、assetKey、collisionType、renderLayer、lifecycle
 */
export interface EcologyObjectConfig {
  type: EcologyObjectType;
  category: 'flora' | 'fauna' | 'terrain_detail' | 'ambient' | 'poi';
  subsystemKey: 'flora' | 'fauna' | 'ambient' | 'poi';
  allowedBiomes: readonly BiomeId[];
  minDepth: number;
  maxDepth: number;
  spawnWeight: number;
  minSpacing: number;
  assetKey: string;
  collisionType: ObjectCollisionType;
  renderLayer: WorldRenderLayerId;
  lifecycle: ObjectLifecycleType;
  seabedConstraint: SeabedPlacementConstraint;
  /** 对于 floor_anchored / near_floor 对象，距离海床 floorY(x) 的最大允许垂直偏移 (worldPx) */
  maxDistanceToFloor: number;
  variants: readonly string[];
}

export const ECOLOGY_OBJECT_CONFIGS: Record<EcologyObjectType, EcologyObjectConfig> = {
  coral: {
    type: 'coral',
    category: 'flora',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 280,
    maxDepth: 19800,
    spawnWeight: 1.55,
    minSpacing: 130,
    assetKey: 'eco_coral_cluster',
    collisionType: 'none',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 110,
    variants: ['staghorn', 'brain_coral', 'fan_coral', 'tube_sponge'],
  },
  rock: {
    type: 'rock',
    category: 'terrain_detail',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 280,
    maxDepth: 19800,
    spawnWeight: 1.38,
    minSpacing: 140,
    assetKey: 'eco_seabed_rock',
    collisionType: 'solid',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 95,
    variants: ['basalt_boulder', 'mossy_slab', 'jagged_spire'],
  },
  seagrass: {
    type: 'seagrass',
    category: 'flora',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean'],
    minDepth: 200,
    maxDepth: 14500,
    spawnWeight: 1.3,
    minSpacing: 120,
    assetKey: 'eco_seagrass_bed',
    collisionType: 'none',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 100,
    variants: ['meadow_tuft', 'ribbon_grass', 'kelp_sprout'],
  },
  fish_school: {
    type: 'fish_school',
    category: 'fauna',
    subsystemKey: 'fauna',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon'],
    minDepth: 80,
    maxDepth: 12000,
    spawnWeight: 1.5,
    minSpacing: 220,
    assetKey: 'eco_fish_school_spawner',
    collisionType: 'trigger',
    renderLayer: 'creatures',
    lifecycle: 'spawner',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['reef_anthias_swarm', 'silver_sardine_ball', 'twilight_lantern_school'],
  },
  jellyfish: {
    type: 'jellyfish',
    category: 'fauna',
    subsystemKey: 'fauna',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 1000,
    maxDepth: 19000,
    spawnWeight: 1.1,
    minSpacing: 185,
    assetKey: 'eco_jellyfish_bloom',
    collisionType: 'hazard',
    renderLayer: 'creatures',
    lifecycle: 'spawner',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['moon_jelly', 'compass_jelly', 'abyssal_comb_jelly'],
  },
  biolum_organism: {
    type: 'biolum_organism',
    category: 'fauna',
    subsystemKey: 'fauna',
    allowedBiomes: ['underwater_canyon', 'deep_abyss', 'rocky_shelf', 'open_ocean'],
    minDepth: 5500,
    maxDepth: 19800,
    spawnWeight: 1.42,
    minSpacing: 165,
    assetKey: 'eco_biolum_organism',
    collisionType: 'none',
    renderLayer: 'creatures',
    lifecycle: 'spawner',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['siphonophore_chain', 'glow_ctenophore', 'abyss_sea_angel'],
  },
  shipwreck_debris: {
    type: 'shipwreck_debris',
    category: 'terrain_detail',
    subsystemKey: 'flora',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.72,
    minSpacing: 190,
    assetKey: 'eco_shipwreck_debris',
    collisionType: 'none',
    renderLayer: 'terrain_detail',
    lifecycle: 'static',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 95,
    variants: ['rusted_anchor', 'broken_mast_timber', 'barnacle_cannon'],
  },
  bubble_stream: {
    type: 'bubble_stream',
    category: 'ambient',
    subsystemKey: 'ambient',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 200,
    maxDepth: 19800,
    spawnWeight: 1.0,
    minSpacing: 150,
    assetKey: 'eco_bubble_stream',
    collisionType: 'none',
    renderLayer: 'ambient_particles',
    lifecycle: 'ambient_loop',
    seabedConstraint: 'near_floor',
    maxDistanceToFloor: 900,
    variants: ['reef_oxygen_plume', 'canyon_fissure_vent', 'thermal_micro_vent'],
  },
  plankton_mote: {
    type: 'plankton_mote',
    category: 'ambient',
    subsystemKey: 'ambient',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon'],
    minDepth: 50,
    maxDepth: 12000,
    spawnWeight: 1.35,
    minSpacing: 130,
    assetKey: 'eco_plankton_mote',
    collisionType: 'none',
    renderLayer: 'ambient_particles',
    lifecycle: 'ambient_loop',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['sunlit_copepod_cloud', 'golden_diatom_drift'],
  },
  marine_snow: {
    type: 'marine_snow',
    category: 'ambient',
    subsystemKey: 'ambient',
    allowedBiomes: ['open_ocean', 'underwater_canyon', 'deep_abyss', 'rocky_shelf'],
    minDepth: 2000,
    maxDepth: 19800,
    spawnWeight: 1.25,
    minSpacing: 135,
    assetKey: 'eco_marine_snow',
    collisionType: 'none',
    renderLayer: 'ambient_particles',
    lifecycle: 'ambient_loop',
    seabedConstraint: 'water_column',
    maxDistanceToFloor: 20000,
    variants: ['detritus_flurry', 'abyssal_organic_fall'],
  },
  cave: {
    type: 'cave',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['rocky_shelf', 'underwater_canyon', 'deep_abyss', 'coral_reef'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 1.0,
    minSpacing: 1800,
    assetKey: 'poi_abyssal_cave_arch',
    collisionType: 'solid',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 140,
    variants: ['limestone_grotto', 'basalt_canyon_cavern'],
  },
  treasure: {
    type: 'treasure',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.95,
    minSpacing: 1800,
    assetKey: 'poi_sunken_treasure_chest',
    collisionType: 'trigger',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 80,
    variants: ['galleon_gold_coffer', 'ancient_relic_vault'],
  },
  landmark: {
    type: 'landmark',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.85,
    minSpacing: 1800,
    assetKey: 'poi_ancient_ocean_monolith',
    collisionType: 'solid',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 120,
    variants: ['leviathan_rib_arch', 'runic_trench_obelisk'],
  },
  shipwreck: {
    type: 'shipwreck',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 18500,
    spawnWeight: 1.1,
    minSpacing: 1800,
    assetKey: 'poi_shipwreck_hull',
    collisionType: 'solid',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'floor_anchored',
    maxDistanceToFloor: 120,
    variants: ['sunken_frigate', 'rusted_research_sub'],
  },
  rare_creature_nest: {
    type: 'rare_creature_nest',
    category: 'poi',
    subsystemKey: 'poi',
    allowedBiomes: ['underwater_canyon', 'deep_abyss', 'rocky_shelf'],
    minDepth: 2000,
    maxDepth: 19800,
    spawnWeight: 0.8,
    minSpacing: 1800,
    assetKey: 'poi_rare_creature_nest',
    collisionType: 'trigger',
    renderLayer: 'poi',
    lifecycle: 'interactive_poi',
    seabedConstraint: 'near_floor',
    maxDistanceToFloor: 380,
    variants: ['apex_kraken_lair', 'biolume_leviathan_den'],
  },
};

/**
 * 规范第 8 节：Chunk 生成对象标准数据结构 `GeneratedObject`
 */
export type GeneratedObject = {
  id: string;
  type: string;
  worldX: number;
  worldY: number;
  rotation?: number;
  scale?: number;
  variant?: string;
  biomeId: string;
  chunkX: number;
  chunkY: number;
  seedKey: string;
  state?: Record<string, unknown>;
};

/**
 * 规范第 9 节：POI 类型配置与实例数据结构
 */
export interface POITypeConfig {
  type: POIType;
  allowedBiomes: readonly BiomeId[];
  minDepth: number;
  maxDepth: number;
  spawnWeight: number;
  /** POI 占地半径 (worldPx) */
  footprintRadius: number;
  /** POI 之间最小中心间距 (worldPx) */
  minPOISpacing: number;
  /** 单个 30000 宽度宏区内的最大数量上限 */
  maxPerMacroBiome: number;
  width: number;
  height: number;
  assetKey: string;
  triggerType: 'wreck_exploration' | 'shelter_zone' | 'loot_chest' | 'elite_ambush' | 'discovery_landmark';
  seabedConstraint: 'floor_anchored' | 'near_floor';
  variants: readonly string[];
}

export const POI_CONFIGS: Record<POIType, POITypeConfig> = {
  shipwreck: {
    type: 'shipwreck',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 18500,
    spawnWeight: 1.1,
    footprintRadius: 420,
    minPOISpacing: 1800,
    maxPerMacroBiome: 3,
    width: 680,
    height: 340,
    assetKey: 'poi_shipwreck_hull',
    triggerType: 'wreck_exploration',
    seabedConstraint: 'floor_anchored',
    variants: ['sunken_frigate', 'rusted_research_sub'],
  },
  cave: {
    type: 'cave',
    allowedBiomes: ['rocky_shelf', 'underwater_canyon', 'deep_abyss', 'coral_reef'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 1.0,
    footprintRadius: 380,
    minPOISpacing: 1800,
    maxPerMacroBiome: 4,
    width: 620,
    height: 360,
    assetKey: 'poi_abyssal_cave_arch',
    triggerType: 'shelter_zone',
    seabedConstraint: 'floor_anchored',
    variants: ['limestone_grotto', 'basalt_canyon_cavern'],
  },
  treasure: {
    type: 'treasure',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.95,
    footprintRadius: 280,
    minPOISpacing: 1800,
    maxPerMacroBiome: 4,
    width: 360,
    height: 240,
    assetKey: 'poi_sunken_treasure_chest',
    triggerType: 'loot_chest',
    seabedConstraint: 'floor_anchored',
    variants: ['galleon_gold_coffer', 'ancient_relic_vault'],
  },
  rare_creature_nest: {
    type: 'rare_creature_nest',
    allowedBiomes: ['underwater_canyon', 'deep_abyss', 'rocky_shelf'],
    minDepth: 2000,
    maxDepth: 19800,
    spawnWeight: 0.8,
    footprintRadius: 360,
    minPOISpacing: 1800,
    maxPerMacroBiome: 3,
    width: 540,
    height: 320,
    assetKey: 'poi_rare_creature_nest',
    triggerType: 'elite_ambush',
    seabedConstraint: 'near_floor',
    variants: ['apex_kraken_lair', 'biolume_leviathan_den'],
  },
  landmark: {
    type: 'landmark',
    allowedBiomes: ['coral_reef', 'rocky_shelf', 'open_ocean', 'underwater_canyon', 'deep_abyss'],
    minDepth: 320,
    maxDepth: 19800,
    spawnWeight: 0.85,
    footprintRadius: 340,
    minPOISpacing: 1800,
    maxPerMacroBiome: 3,
    width: 480,
    height: 460,
    assetKey: 'poi_ancient_ocean_monolith',
    triggerType: 'discovery_landmark',
    seabedConstraint: 'floor_anchored',
    variants: ['leviathan_rib_arch', 'runic_trench_obelisk'],
  },
};

export interface GeneratedPOI extends GeneratedObject {
  type: POIType;
  width: number;
  height: number;
  footprintRadius: number;
  minPOISpacing: number;
  ownerChunkX: number;
  ownerChunkY: number;
  ownerChunkId: string;
  depthBand: DepthBandId;
  assetKey: string;
  triggerType: POITypeConfig['triggerType'];
  poiState?: 'unvisited' | 'discovered' | 'interacted' | 'depleted';
}

/**
 * 规范第 9 节：计算水平 POI 槽位 `slotIndex = Math.floor(chunkX / 2)` 的唯一确定性 POI 实体
 * 设计性质：
 * 1. 每个水平槽位覆盖 2 个水平 Chunk（宽 6000 worldPx），槽位内至多生成 1 个 POI，因此任意单个 Chunk 至多拥有 1 个 POI。
 * 2. 每个 POI 的中心点 `worldX` 距离槽位左右外边界至少 950 worldPx，因此任意两个不同槽位的 POI 水平间距恒 >= 1900 worldPx（> 1800 最小间距且 > 任意两个占地半径之和 840），100% 杜绝占地重叠。
 * 3. 当 `worldX` 落在槽位内部 `chunkX = 2*s` 与 `2*s + 1` 交界附近时，POI 的 `footprintRadius` (280..420) 可自然跨越到相邻 Chunk，但 `ownerChunkId = worldToChunkCoord(worldX, worldY)` 严格唯一，仅中心所在 Chunk 管理生成与归属！
 */
function evaluatePOISlot(
  slotIndex: number,
  config: WorldConfigType = WorldConfig
): GeneratedPOI | null {
  const baseChunkX = slotIndex * 2;
  const slotStartX = baseChunkX * config.chunk.width;
  const slotWidth = config.chunk.width * 2; // 6000

  // 使用独立的 'poi' 子系统随机流（与 fauna / flora / terrain / ambient 完全隔离）
  const slotRng = createChunkRng(
    config.worldSeed,
    config.generatorVersion,
    baseChunkX,
    0,
    'poi'
  );

  // 宏区密度控制：每个 30000 宏区含 5 个 6000 槽位，跳过第 4 槽位使每个宏区至多生成 4 个 POI
  const slotInMacro = ((slotIndex % 5) + 5) % 5;
  if (slotInMacro === 4) {
    return null;
  }

  const spawnRoll = slotRng();
  if (spawnRoll > 0.82) {
    return null;
  }

  // 在 [slotStartX + 950, slotStartX + slotWidth - 950] 之间确定性选取 worldX
  // 其中约 35% 概率靠近中间 Chunk 接缝 (slotStartX + 3000 ± 180)，以便测试与展现跨 Chunk 占地但唯一归属
  const edgeBiasRoll = slotRng();
  const seamX = slotStartX + config.chunk.width;
  let worldX: number;
  if (edgeBiasRoll < 0.36) {
    const offsetFromSeam = (slotRng() * 2 - 1) * 180;
    worldX = Math.round(seamX + (Math.abs(offsetFromSeam) < 12 ? 24 : offsetFromSeam));
  } else {
    const margin = 950;
    worldX = Math.round(slotStartX + margin + slotRng() * (slotWidth - margin * 2));
  }

  const floorY = getFloorDepthAt(worldX, config);
  const prelimBiome = getBiomeAt(worldX, floorY, config);

  // 过滤符合当前 Biome 与海床深度范围的候选 POI 类型
  const eligibleConfigs: POITypeConfig[] = [];
  for (const poiType of POI_TYPES) {
    const cfg = POI_CONFIGS[poiType];
    if (!cfg.allowedBiomes.includes(prelimBiome.primaryBiome)) continue;
    const candidateY =
      cfg.seabedConstraint === 'near_floor'
        ? Math.max(cfg.minDepth, floorY - 180)
        : Math.max(cfg.minDepth, floorY - 28);
    if (candidateY >= cfg.minDepth && candidateY <= cfg.maxDepth) {
      eligibleConfigs.push(cfg);
    }
  }

  if (eligibleConfigs.length === 0) {
    return null;
  }

  // 按权重确定性抽取 POI 类型
  let totalWeight = 0;
  for (const cfg of eligibleConfigs) {
    totalWeight += cfg.spawnWeight;
  }
  let pick = slotRng() * totalWeight;
  let chosenCfg = eligibleConfigs[0];
  for (const cfg of eligibleConfigs) {
    pick -= cfg.spawnWeight;
    if (pick <= 0) {
      chosenCfg = cfg;
      break;
    }
  }

  // 计算 POI 垂直世界坐标 worldY（严格位于海床之上且满足 [minDepth, maxDepth] 与 [bounds.minDepth, bounds.maxDepth)）
  const verticalLift =
    chosenCfg.seabedConstraint === 'near_floor'
      ? Math.round(90 + slotRng() * 160)
      : Math.round(16 + slotRng() * 42);
  const rawWorldY = floorY - verticalLift;
  const worldY = Math.max(
    chosenCfg.minDepth,
    Math.min(
      Math.min(chosenCfg.maxDepth, config.bounds.maxDepth - 1),
      Math.max(config.bounds.minDepth, rawWorldY)
    )
  );

  // 计算中心点唯一归属的二维 Chunk (ownerChunkX, ownerChunkY)
  const ownerCoord = worldToChunkCoord(worldX, worldY, config);
  const ownerRng = createChunkRng(
    config.worldSeed,
    config.generatorVersion,
    ownerCoord.chunkX,
    ownerCoord.chunkY,
    'poi'
  );
  const variantIdx = Math.floor(ownerRng() * chosenCfg.variants.length);
  const variant = chosenCfg.variants[variantIdx] ?? chosenCfg.variants[0];
  const scale = Number((0.92 + ownerRng() * 0.18).toFixed(3));
  const rotation = Number(((ownerRng() - 0.5) * 0.12).toFixed(4));

  const finalBiomeSample = getBiomeAt(worldX, worldY, config);
  const seedKey = `poi_slot_${slotIndex}`;
  const id = createStableId(
    config.worldSeed,
    config.generatorVersion,
    chosenCfg.type,
    ownerCoord.chunkX,
    ownerCoord.chunkY,
    seedKey
  );

  return {
    id,
    type: chosenCfg.type,
    worldX,
    worldY,
    rotation,
    scale,
    variant,
    biomeId: finalBiomeSample.primaryBiome,
    chunkX: ownerCoord.chunkX,
    chunkY: ownerCoord.chunkY,
    seedKey,
    width: chosenCfg.width,
    height: chosenCfg.height,
    footprintRadius: chosenCfg.footprintRadius,
    minPOISpacing: chosenCfg.minPOISpacing,
    ownerChunkX: ownerCoord.chunkX,
    ownerChunkY: ownerCoord.chunkY,
    ownerChunkId: ownerCoord.chunkId,
    depthBand: finalBiomeSample.depthBand,
    assetKey: chosenCfg.assetKey,
    triggerType: chosenCfg.triggerType,
    poiState: 'unvisited',
    state: {
      isPOI: true,
      status: 'unvisited',
      discovered: false,
      interacted: false,
      triggerType: chosenCfg.triggerType,
      footprintRadius: chosenCfg.footprintRadius,
      ownerChunkId: ownerCoord.chunkId,
    },
  };
}

/**
 * 规范第 9 & 13 节：查询中心点唯一归属于 `(chunkX, chunkY)` 的 POI 列表（至多 1 个）
 * POI owner 严格为中心点 `(worldX, worldY)` 所在的 Chunk，跨 Chunk 显示绝不重复生成！
 */
export function generatePOIs(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedPOI[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  const slotIndex = Math.floor(bounds.chunkX / 2);
  const candidate = evaluatePOISlot(slotIndex, config);
  if (!candidate) return [];
  if (
    candidate.ownerChunkX === bounds.chunkX &&
    candidate.ownerChunkY === bounds.chunkY &&
    isPointInChunkBounds(candidate.worldX, candidate.worldY, bounds)
  ) {
    return [candidate];
  }
  return [];
}

/**
 * 规范第 8.3 & 9 节：查询中心点在邻近 Chunk、但占地半径 `footprintRadius` 跨界覆盖到 `(chunkX, chunkY)` 的外部 POI
 * 用于跨 Chunk 占地避让与跨界显示引用，而不重复生成或改变其 ownerChunkId。
 */
export function getOverlappingPOIsForChunk(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedPOI[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  const baseSlot = Math.floor(bounds.chunkX / 2);
  const overlapping: GeneratedPOI[] = [];

  for (let s = baseSlot - 1; s <= baseSlot + 1; s++) {
    const poi = evaluatePOISlot(s, config);
    if (!poi) continue;
    // 若归属于当前 Chunk 自身，则已在 generatePOIs 中返回，不计入外部跨界列表
    if (poi.ownerChunkX === bounds.chunkX && poi.ownerChunkY === bounds.chunkY) {
      continue;
    }
    // 计算 POI 中心点到当前 Chunk 矩形 [startX, endX) × [startY, endY) 的最短欧氏距离
    const clampedX = Math.max(bounds.startX, Math.min(bounds.endX, poi.worldX));
    const clampedY = Math.max(bounds.startY, Math.min(bounds.endY, poi.worldY));
    const dist = Math.hypot(poi.worldX - clampedX, poi.worldY - clampedY);
    if (dist <= poi.footprintRadius) {
      overlapping.push(poi);
    }
  }

  return overlapping;
}

/**
 * 规范第 13 节：POIGenerator 服务类
 */
export class POIGenerator {
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public generatePOIs(chunkX: number, chunkY: number): GeneratedPOI[] {
    return generatePOIs(chunkX, chunkY, this.config);
  }

  public getOverlappingPOIsForChunk(chunkX: number, chunkY: number): GeneratedPOI[] {
    return getOverlappingPOIsForChunk(chunkX, chunkY, this.config);
  }
}

export const poiGenerator = new POIGenerator(WorldConfig);

interface RawEcologyCandidate {
  type: EcologyObjectType;
  worldX: number;
  worldY: number;
  rotation: number;
  scale: number;
  variant: string;
  biomeId: BiomeId;
  chunkX: number;
  chunkY: number;
  seedKey: string;
  minSpacing: number;
  priority: number;
  renderLayer: WorldRenderLayerId;
  subsystemKey: 'flora' | 'fauna' | 'ambient';
}

const SUBSYSTEM_OBJECT_TYPES: Record<'flora' | 'fauna' | 'ambient', readonly EcologyObjectType[]> = {
  flora: ['coral', 'rock', 'seagrass', 'shipwreck_debris'],
  fauna: ['fish_school', 'jellyfish', 'biolum_organism'],
  ambient: ['bubble_stream', 'plankton_mote', 'marine_snow'],
};

/**
 * 在单个二维 Chunk `(chunkX, chunkY)` 的单个隔离随机流 `subsystemKey` 下产生候选生态点（簇群中心分布 + 环境过滤）
 * 严格使用 `createChunkRng(worldSeed, generatorVersion, chunkX, chunkY, subsystemKey)`，确保不同子系统 RNG 100% 互不干扰！
 */
function generateSubsystemRawCandidatesForChunk(
  chunkX: number,
  chunkY: number,
  subsystemKey: 'flora' | 'fauna' | 'ambient',
  config: WorldConfigType = WorldConfig
): RawEcologyCandidate[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  // 若 Chunk 完全在合法海洋深度之外则不生成任何对象
  if (bounds.endY <= config.bounds.minDepth || bounds.startY >= config.bounds.maxDepth) {
    return [];
  }

  // 步骤 3：创建当前子系统独立 RNG
  const rng = createChunkRng(
    config.worldSeed,
    config.generatorVersion,
    bounds.chunkX,
    bounds.chunkY,
    subsystemKey
  );

  // 检查当前二维 Chunk 全部 31 个海床采样点，精准识别海床穿过本 Chunk 的水平子区间
  const midWorldX = bounds.startX + bounds.width * 0.5;
  const terrainSamples = getTerrainSamples(bounds.chunkX, config);
  let minChunkFloorY = Infinity;
  let maxChunkFloorY = -Infinity;
  const inChunkSeabedX: number[] = [];

  for (const pt of terrainSamples.points) {
    if (pt.floorY < minChunkFloorY) minChunkFloorY = pt.floorY;
    if (pt.floorY > maxChunkFloorY) maxChunkFloorY = pt.floorY;
    if (
      pt.worldX >= bounds.startX + 45 &&
      pt.worldX <= bounds.endX - 45 &&
      pt.floorY >= bounds.startY + 6 &&
      pt.floorY < bounds.endY - 4
    ) {
      inChunkSeabedX.push(pt.worldX);
    }
  }

  // 若整个 Chunk 位于海床基岩下方（即 startY > maxChunkFloorY），属于海床地壳内部，不生成水体/海床表面生态对象
  if (bounds.startY > maxChunkFloorY) {
    return [];
  }

  const chunkContainsSeabed =
    inChunkSeabedX.length > 0 ||
    (maxChunkFloorY >= bounds.startY && minChunkFloorY < bounds.endY);
  const chunkNearSeabed =
    minChunkFloorY - bounds.endY <= 850 && maxChunkFloorY >= bounds.startY;

  // flora 子系统（珊瑚/岩石/海草/沉船碎片）仅锚定在包含海床的 Chunk 中
  if (subsystemKey === 'flora' && !chunkContainsSeabed) {
    return [];
  }

  const centerBiome = getBiomeAt(
    midWorldX,
    Math.min(bounds.endY - 1, Math.max(bounds.startY, minChunkFloorY - 200)),
    config
  );

  // 步骤 4：采用簇群中心分布（允许大片空海域，告别均匀撒豆）
  const baseTarget = Math.max(0, config.generation.staticObjectsPerChunkTarget);
  const densityMod =
    subsystemKey === 'flora'
      ? (centerBiome.blendedParams.floraDensity + centerBiome.blendedParams.rockDensity) * 0.5
      : subsystemKey === 'fauna'
      ? centerBiome.blendedParams.faunaDensity
      : 0.9 + centerBiome.blendedParams.bioluminescenceBoost * 0.35;

  const subsystemShare =
    subsystemKey === 'flora' ? 0.45 : subsystemKey === 'fauna' ? 0.32 : 0.23;
  const maxSubsystemTarget = Math.max(
    1,
    Math.min(18, Math.round(baseTarget * subsystemShare * densityMod))
  );

  const clusterCount = Math.max(1, Math.min(3, Math.ceil(maxSubsystemTarget / 4)));
  const clusters: Array<{ cx: number; cy: number; radiusX: number; radiusY: number }> = [];
  for (let c = 0; c < clusterCount; c++) {
    const rX = rng();
    let cx = bounds.startX + (0.14 + rX * 0.72) * bounds.width;
    if (subsystemKey === 'flora' && inChunkSeabedX.length > 0) {
      const exactIdx = rX * (inChunkSeabedX.length - 1);
      const i0 = Math.floor(exactIdx);
      const i1 = Math.min(inChunkSeabedX.length - 1, i0 + 1);
      const frac = exactIdx - i0;
      cx = inChunkSeabedX[i0] * (1 - frac) + inChunkSeabedX[i1] * frac;
    }
    const localFloor = getFloorDepthAt(cx, config);
    const cy =
      subsystemKey === 'flora'
        ? Math.max(bounds.startY + 8, Math.min(bounds.endY - 8, localFloor - 24))
        : bounds.startY + (0.15 + rng() * 0.7) * Math.min(bounds.height, Math.max(120, localFloor - bounds.startY));
    clusters.push({
      cx,
      cy,
      radiusX: 220 + rng() * 280,
      radiusY: 140 + rng() * 190,
    });
  }

  const candidateTypes = SUBSYSTEM_OBJECT_TYPES[subsystemKey];
  const rawCandidates: RawEcologyCandidate[] = [];
  const totalSlots = maxSubsystemTarget * 2;

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const cluster = clusters[slotIdx % clusters.length];
    const angle = rng() * Math.PI * 2;
    const radial = Math.pow(rng(), 0.65);
    const priority = rng();
    const typeRoll = rng();
    const variantRoll = rng();
    const scaleRoll = rng();
    const rotRoll = rng();
    const verticalOffsetRoll = rng();

    let worldX = Math.round(cluster.cx + Math.cos(angle) * radial * cluster.radiusX);
    if (subsystemKey === 'flora' && inChunkSeabedX.length > 0) {
      const minSeabedX = inChunkSeabedX[0];
      const maxSeabedX = inChunkSeabedX[inChunkSeabedX.length - 1];
      worldX = Math.max(minSeabedX, Math.min(maxSeabedX, worldX));
    }
    // 严格限制在左闭右开 [startX, endX) 内
    if (worldX < bounds.startX || worldX >= bounds.endX) {
      continue;
    }

    const floorY = getFloorDepthAt(worldX, config);
    let worldY: number;
    if (subsystemKey === 'flora') {
      // 贴地生成：锚定在海床表面 getFloorDepthAt(worldX) 之上 6..72 worldPx
      const floorLift = Math.round(6 + verticalOffsetRoll * 66);
      worldY = Math.round(floorY - floorLift);
    } else if (subsystemKey === 'ambient' && chunkNearSeabed && verticalOffsetRoll < 0.42) {
      // 近底气泡流或深水颗粒
      worldY = Math.round(Math.min(bounds.endY - 2, floorY - (40 + verticalOffsetRoll * 520)));
    } else {
      // 水体开放空间生成（距离海床至少 140 worldPx 安全净空）
      worldY = Math.round(cluster.cy + Math.sin(angle) * radial * cluster.radiusY);
      if (worldY > floorY - 140) {
        worldY = Math.round(floorY - 140 - verticalOffsetRoll * 180);
      }
    }

    // 步骤 5：过滤 Chunk 边界 [startX, endX) × [startY, endY) 与海洋全局深度边界
    if (!isPointInChunkBounds(worldX, worldY, bounds)) {
      continue;
    }
    if (
      worldY < config.bounds.minDepth ||
      worldY >= config.bounds.maxDepth ||
      worldY > floorY
    ) {
      continue;
    }

    // 查询该点的精确 Biome 与深度带
    const localBiome = getBiomeAt(worldX, worldY, config);
    const distToFloor = floorY - worldY;

    // 步骤 5 & 6：过滤符合深度、Biome 白名单与海床距离的对象类型，并按平滑权重选择类型与变体
    const validConfigs: Array<{ cfg: EcologyObjectConfig; weight: number }> = [];
    for (const t of candidateTypes) {
      const cfg = ECOLOGY_OBJECT_CONFIGS[t];
      if (worldY < cfg.minDepth || worldY > cfg.maxDepth) continue;
      if (!cfg.allowedBiomes.includes(localBiome.primaryBiome)) continue;
      if (cfg.seabedConstraint === 'floor_anchored' && distToFloor > cfg.maxDistanceToFloor) {
        continue;
      }
      if (
        cfg.seabedConstraint === 'near_floor' &&
        (distToFloor < 10 || distToFloor > cfg.maxDistanceToFloor)
      ) {
        continue;
      }
      if (cfg.seabedConstraint === 'water_column' && distToFloor < 120) {
        continue;
      }

      // 结合当前 Biome 平滑混合参数动态调制权重
      let effWeight = cfg.spawnWeight;
      if (cfg.type === 'coral' || cfg.type === 'seagrass') {
        effWeight *= localBiome.blendedParams.floraDensity;
      } else if (cfg.type === 'rock' || cfg.type === 'shipwreck_debris') {
        effWeight *= localBiome.blendedParams.rockDensity;
      } else if (cfg.type === 'biolum_organism') {
        effWeight *= 0.6 + localBiome.blendedParams.bioluminescenceBoost;
      } else if (cfg.type === 'fish_school' || cfg.type === 'jellyfish') {
        effWeight *= localBiome.blendedParams.faunaDensity;
      }
      if (effWeight > 0) {
        validConfigs.push({ cfg, weight: effWeight });
      }
    }

    if (validConfigs.length === 0) {
      continue;
    }

    let weightSum = 0;
    for (const item of validConfigs) weightSum += item.weight;
    let pickW = typeRoll * weightSum;
    let selectedCfg = validConfigs[0].cfg;
    for (const item of validConfigs) {
      pickW -= item.weight;
      if (pickW <= 0) {
        selectedCfg = item.cfg;
        break;
      }
    }

    const effectiveMinSpacing = Math.max(
      config.generation.minObjectSpacing,
      selectedCfg.minSpacing
    );

    const variantIndex = Math.floor(variantRoll * selectedCfg.variants.length);
    const variant = selectedCfg.variants[variantIndex] ?? selectedCfg.variants[0];
    const scale = Number((0.82 + scaleRoll * 0.42).toFixed(3));
    const rotation =
      selectedCfg.seabedConstraint === 'floor_anchored'
        ? Number((getTerrainSlopeAt(worldX, config) * 0.45 + (rotRoll - 0.5) * 0.14).toFixed(4))
        : Number(((rotRoll - 0.5) * 0.25).toFixed(4));

    const seedKey = `${subsystemKey}_slot_${slotIdx}`;
    rawCandidates.push({
      type: selectedCfg.type,
      worldX,
      worldY,
      rotation,
      scale,
      variant,
      biomeId: localBiome.primaryBiome,
      chunkX: bounds.chunkX,
      chunkY: bounds.chunkY,
      seedKey,
      minSpacing: effectiveMinSpacing,
      priority,
      renderLayer: selectedCfg.renderLayer,
      subsystemKey,
    });
  }

  // 在当前 Chunk 内部先按固有槽位与优先级执行一次内部间距去重，确保结果数量 <= maxSubsystemTarget
  const internalAccepted: RawEcologyCandidate[] = [];
  for (const cand of rawCandidates) {
    if (internalAccepted.length >= maxSubsystemTarget) break;
    let conflict = false;
    for (const acc of internalAccepted) {
      const reqDist = Math.max(cand.minSpacing, acc.minSpacing);
      const dx = cand.worldX - acc.worldX;
      const dy = cand.worldY - acc.worldY;
      if (dx * dx + dy * dy < reqDist * reqDist) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      internalAccepted.push(cand);
    }
  }

  return internalAccepted;
}

/**
 * 规范第 7、8、13 节：生成指定二维 Chunk `(chunkX, chunkY)` 的生态对象纯数据 `generateEcology`
 * - 子系统随机流 (`flora`、`fauna`、`ambient`) 严格相互隔离
 * - 包含跨邻 Chunk (`chunkX ± 1, chunkY ± 1`) 的确定性对称间距消解，保证任意生成顺序下跨边界间距 >= minSpacing 且 100% 结果恒等
 * - 自动避让本 Chunk 及邻近跨界 POI 的占地半径 (`footprintRadius`)
 */
export function generateEcology(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedObject[] {
  const bounds = getChunkBounds(chunkX, chunkY, config);
  const subsystems: readonly ('flora' | 'fauna' | 'ambient')[] = ['flora', 'fauna', 'ambient'];

  // 收集本 Chunk 归属及跨界覆盖的 POI 占地圆，用于避让固体 POI 核心区
  const activePois = [
    ...generatePOIs(bounds.chunkX, bounds.chunkY, config),
    ...getOverlappingPOIsForChunk(bounds.chunkX, bounds.chunkY, config),
  ];

  const finalObjects: GeneratedObject[] = [];

  for (const subKey of subsystems) {
    const ownCandidates = generateSubsystemRawCandidatesForChunk(
      bounds.chunkX,
      bounds.chunkY,
      subKey,
      config
    );
    if (ownCandidates.length === 0) continue;

    // 收集周围 8 个邻接 Chunk 在同一子系统下的候选点（仅用于跨 Chunk 边界间距检查，绝对顺序无关）
    const neighborCandidates: RawEcologyCandidate[] = [];
    const borderCheckMargin = 320;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ncx = bounds.chunkX + dx;
        const ncy = bounds.chunkY + dy;
        const nCands = generateSubsystemRawCandidatesForChunk(ncx, ncy, subKey, config);
        for (const nc of nCands) {
          // 仅需考虑靠近当前 Chunk 边界 borderCheckMargin 范围内的邻格点
          if (
            nc.worldX >= bounds.startX - borderCheckMargin &&
            nc.worldX <= bounds.endX + borderCheckMargin &&
            nc.worldY >= bounds.startY - borderCheckMargin &&
            nc.worldY <= bounds.endY + borderCheckMargin
          ) {
            neighborCandidates.push(nc);
          }
        }
      }
    }

    // 步骤 7：检查间距（含邻 Chunk）与 POI 占地避让
    for (const cand of ownCandidates) {
      // 7.1 检查是否落入固体 POI 的核心排斥半径内
      let insideSolidPoi = false;
      for (const poi of activePois) {
        const distToPoi = Math.hypot(cand.worldX - poi.worldX, cand.worldY - poi.worldY);
        if (distToPoi < poi.footprintRadius * 0.55) {
          insideSolidPoi = true;
          break;
        }
      }
      if (insideSolidPoi) continue;

      // 7.2 与邻 Chunk 候选点做确定性优先级比对（若间距小于 reqDist，仅保留优先级更高或字典序更小的一方）
      let defeatedByNeighbor = false;
      for (const nc of neighborCandidates) {
        const reqDist = Math.max(cand.minSpacing, nc.minSpacing);
        const dx = cand.worldX - nc.worldX;
        const dy = cand.worldY - nc.worldY;
        if (dx * dx + dy * dy < reqDist * reqDist) {
          if (
            nc.priority > cand.priority ||
            (nc.priority === cand.priority &&
              (nc.chunkX < cand.chunkX ||
                (nc.chunkX === cand.chunkX && nc.chunkY < cand.chunkY)))
          ) {
            defeatedByNeighbor = true;
            break;
          }
        }
      }
      if (defeatedByNeighbor) continue;

      // 步骤 9：生成稳定 ID（基于 worldSeed、generatorVersion、type、chunkX、chunkY、固有槽位 seedKey）
      const stableId = createStableId(
        config.worldSeed,
        config.generatorVersion,
        cand.type,
        cand.chunkX,
        cand.chunkY,
        cand.seedKey
      );

      const objCfg = ECOLOGY_OBJECT_CONFIGS[cand.type];
      finalObjects.push({
        id: stableId,
        type: cand.type,
        worldX: cand.worldX,
        worldY: cand.worldY,
        rotation: cand.rotation,
        scale: cand.scale,
        variant: cand.variant,
        biomeId: cand.biomeId,
        chunkX: cand.chunkX,
        chunkY: cand.chunkY,
        seedKey: cand.seedKey,
        state: {
          category: objCfg.category,
          assetKey: objCfg.assetKey,
          collisionType: objCfg.collisionType,
          renderLayer: objCfg.renderLayer,
          lifecycle: objCfg.lifecycle,
        },
      });
    }
  }

  // 步骤 10：按稳定规则排序 (renderLayerOrder -> worldX -> worldY -> id)
  finalObjects.sort((a, b) => {
    const layerA =
      WORLD_RENDER_LAYER_ORDER[
        (a.state?.renderLayer as WorldRenderLayerId) ?? 'terrain_detail'
      ] ?? 6;
    const layerB =
      WORLD_RENDER_LAYER_ORDER[
        (b.state?.renderLayer as WorldRenderLayerId) ?? 'terrain_detail'
      ] ?? 6;
    if (layerA !== layerB) return layerA - layerB;
    if (a.worldX !== b.worldX) return a.worldX - b.worldX;
    if (a.worldY !== b.worldY) return a.worldY - b.worldY;
    return a.id.localeCompare(b.id);
  });

  return finalObjects;
}

/**
 * 规范第 8 & 13 节：单个二维 Chunk 的完整纯数据输出结构 `GeneratedChunkData`
 */
export interface GeneratedChunkData {
  chunkX: number;
  chunkY: number;
  chunkId: string;
  bounds: ChunkBounds2D;
  biomeSample: BiomeSampleResult;
  depthBand: DepthBandId;
  depthVisualProfile: DepthVisualProfile;
  terrainSamples: TerrainChunkSamples;
  /** 唯一归属于本 Chunk 的全部生成对象（含生态对象与本 Chunk 归属的 POI 对象，按稳定规则排序） */
  objects: GeneratedObject[];
  /** 唯一归属于本 Chunk 的生态对象列表 */
  ecologyObjects: GeneratedObject[];
  /** 唯一归属于本 Chunk 的 POI 列表（至多 1 个，满足 ownerChunkId === chunkId） */
  pois: GeneratedPOI[];
  /** 中心在邻近 Chunk、但占地半径跨界覆盖本 Chunk 的外部 POI 引用列表（不重复生成） */
  overlappingPOIs: GeneratedPOI[];
}

/**
 * 规范第 8 & 13 节：ChunkGenerator 编排数据生成纯函数 `generateChunk(chunkX, chunkY, config)`
 * 严格遵循规范第 8.2 节的 11 步固定生成管线顺序：
 * 1) 算 Chunk bounds；2) 查询 Biome/深度带；3) 创建独立 RNG；
 * 4) 产生稳定候选点；5) 过滤深度/Biome/海床距离/边界；
 * 6) 按权重选类型与变体；7) 检查间距（含邻 Chunk）；
 * 8) 生成 POI 并检查唯一归属；9) 生成稳定 ID；
 * 10) 按稳定规则排序；11) 输出纯数据，再由管理器创建渲染实例。
 */
export function generateChunk(
  chunkX: number,
  chunkY: number,
  config: WorldConfigType = WorldConfig
): GeneratedChunkData {
  // 1) 算 Chunk bounds
  const bounds = getChunkBounds(chunkX, chunkY, config);

  // 2) 查询 Biome/深度带与统一深度视觉 Profile
  const centerX = bounds.startX + bounds.width * 0.5;
  const centerY = clampWorldDepth(bounds.startY + bounds.height * 0.5, config);
  const biomeSample = getBiomeAt(centerX, centerY, config);
  const depthVisualProfile = getDepthVisualProfile(centerY, config);
  const terrainSamples = getTerrainSamples(bounds.chunkX, config);

  // 3) ~ 7) & 9)：通过隔离 RNG 生成生态对象并检查跨邻 Chunk 间距
  const ecologyObjects = generateEcology(bounds.chunkX, bounds.chunkY, config);

  // 8) 生成 POI 并检查唯一归属（每个 Chunk 至多 1 个 POI，中心点严格位于当前 Chunk bounds 内）
  const pois = generatePOIs(bounds.chunkX, bounds.chunkY, config);
  const overlappingPOIs = getOverlappingPOIsForChunk(bounds.chunkX, bounds.chunkY, config);

  // 10) 合并本 Chunk 唯一归属的对象并按稳定规则排序
  const objects: GeneratedObject[] = [...ecologyObjects, ...pois];
  objects.sort((a, b) => {
    const layerA =
      WORLD_RENDER_LAYER_ORDER[
        (a.state?.renderLayer as WorldRenderLayerId) ?? (a.state?.isPOI ? 'poi' : 'terrain_detail')
      ] ?? 6;
    const layerB =
      WORLD_RENDER_LAYER_ORDER[
        (b.state?.renderLayer as WorldRenderLayerId) ?? (b.state?.isPOI ? 'poi' : 'terrain_detail')
      ] ?? 6;
    if (layerA !== layerB) return layerA - layerB;
    if (a.worldX !== b.worldX) return a.worldX - b.worldX;
    if (a.worldY !== b.worldY) return a.worldY - b.worldY;
    return a.id.localeCompare(b.id);
  });

  // 11) 输出纯数据
  return {
    chunkX: bounds.chunkX,
    chunkY: bounds.chunkY,
    chunkId: bounds.chunkId,
    bounds,
    biomeSample,
    depthBand: biomeSample.depthBand,
    depthVisualProfile,
    terrainSamples,
    objects,
    ecologyObjects,
    pois,
    overlappingPOIs,
  };
}

/**
 * 规范第 13 节：ChunkGenerator 编排器类
 */
export class ChunkGenerator {
  private readonly config: WorldConfigType;

  constructor(config: WorldConfigType = WorldConfig) {
    this.config = config;
  }

  public generateChunk(chunkX: number, chunkY: number): GeneratedChunkData {
    return generateChunk(chunkX, chunkY, this.config);
  }
}

export const chunkGenerator = new ChunkGenerator(WorldConfig);

