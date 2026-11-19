/**
 * 分段拟合海洋深度映射（世界像素 Y 坐标 0~20,000px 对应真实海洋深度 0~11,000m）：
 * 1. 阳光表层带 (Epipelagic): 0~2000px <-> 0~200m (比例: 10 px/m，珊瑚礁 0~30m 对应 0~300px)
 * 2. 暮光中层带 (Mesopelagic): 2000~6000px <-> 200~1000m (比例: 5 px/m，弱光大王乌贼带)
 * 3. 半深海午夜带 (Bathypelagic): 6000~10000px <-> 1000~4000m (比例: 1.33 px/m，黑角安康鱼)
 * 4. 深渊深层带 (Abyssopelagic): 10000~16000px <-> 4000~6000m (比例: 3.0 px/m，深渊热液喷口)
 * 5. 超深渊海沟带 (Hadal-like): 16000~20000px <-> 6000~11000m (比例: 0.8 px/m，马里亚纳海沟挑战者深渊 11000m)
 */

export interface DepthMappingStop {
  readonly worldY: number;
  readonly meters: number;
}

export const DEPTH_MAPPING_STOPS: readonly DepthMappingStop[] = [
  { worldY: 0, meters: 0 },
  { worldY: 2000, meters: 200 },
  { worldY: 6000, meters: 1000 },
  { worldY: 10000, meters: 4000 },
  { worldY: 16000, meters: 6000 },
  { worldY: 20000, meters: 11000 },
] as const;

export function meterDepthToWorldY(depthMeters: number): number {
  const m = Math.max(0, depthMeters);
  for (let i = 0; i < DEPTH_MAPPING_STOPS.length - 1; i++) {
    const s0 = DEPTH_MAPPING_STOPS[i];
    const s1 = DEPTH_MAPPING_STOPS[i + 1];
    if (m <= s1.meters) {
      const t = (m - s0.meters) / (s1.meters - s0.meters);
      return Math.round(s0.worldY + t * (s1.worldY - s0.worldY));
    }
  }
  const last = DEPTH_MAPPING_STOPS[DEPTH_MAPPING_STOPS.length - 1];
  const prev = DEPTH_MAPPING_STOPS[DEPTH_MAPPING_STOPS.length - 2];
  const rate = (last.worldY - prev.worldY) / (last.meters - prev.meters);
  return Math.round(last.worldY + (m - last.meters) * rate);
}

export function worldYToMeterDepth(worldY: number): number {
  const y = Math.max(0, worldY);
  for (let i = 0; i < DEPTH_MAPPING_STOPS.length - 1; i++) {
    const s0 = DEPTH_MAPPING_STOPS[i];
    const s1 = DEPTH_MAPPING_STOPS[i + 1];
    if (y <= s1.worldY) {
      const t = (y - s0.worldY) / (s1.worldY - s0.worldY);
      return Math.round(s0.meters + t * (s1.meters - s0.meters));
    }
  }
  const last = DEPTH_MAPPING_STOPS[DEPTH_MAPPING_STOPS.length - 1];
  const prev = DEPTH_MAPPING_STOPS[DEPTH_MAPPING_STOPS.length - 2];
  const rate = (last.meters - prev.meters) / (last.worldY - prev.worldY);
  return Math.round(last.meters + (y - last.worldY) * rate);
}
