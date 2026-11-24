import { worldAssetRegistry } from './worldAssetRegistry';
import { MIN_RENDER_ZOOM_FLOOR, quinticSmoothstep } from '../rules';
import {
  WorldConfig,
  WorldConfigType,
  WORLD_UNITS_PER_METER,
  worldYToEngineY,
  mixSubsystemSeed,
} from './worldCore';
import {
  TerrainSamplePoint,
  getFloorDepthAt,
  getTerrainSamples,
  SEABED_TERRACE_TIERS,
  getSeabedTerraceAt,
  isTerraceCellBreached,
} from './terrainSystem';

/**
 * 规范第 0.6 & 11 节：在 1.0x 单一真实世界空间渲染可碰撞的实体海床地壳层与多层《world_seabed_strips》手绘轮廓材质
 * 同时绘制：
 * 1) 全水深 9 级连续阶梯海床 (`SEABED_TERRACE_TIERS`) 与向远处弧形弯曲的下潜洞口（支持巨鲨撞碎上层阶梯留下的破口）；
 * 2) 连续主海床 (`getTerrainSamples(chunkX)`) 及 4 条手绘海床轮廓材质带 (`coral_reef` / `rocky_shelf` / `underwater_canyon` / `deep_abyss`)。
 */
const scratchSeabedRenderPoints: TerrainSamplePoint[] = [];

export function renderPhysicalSeabed(
  ctx: CanvasRenderingContext2D,
  params: {
    cameraEngineX: number;
    cameraEngineY: number;
    viewW: number;
    viewH: number;
    renderZoom: number;
    relativePreyScale?: number;
    breachedTerraceCells?: ReadonlySet<string>;
    config?: WorldConfigType;
  }
): void {
  const config = params.config ?? WorldConfig;
  const zoom = Math.max(MIN_RENDER_ZOOM_FLOOR, params.renderZoom);
  const halfSpanEngineX = params.viewW / (2 * zoom) + 180;
  const halfSpanEngineY = params.viewH / (2 * zoom) + 180;
  const minEngineY = params.cameraEngineY - halfSpanEngineY;
  const maxEngineY = params.cameraEngineY + halfSpanEngineY;
  const lowDetailLod = zoom < 0.45;
  const skipEmbeddedMicroRocks = zoom < 0.35;

  // 若当前相机视野完全处于浅海环礁与海床最浅可能深度之上，则快速跳过
  const minPossibleFloorEngineY = Math.min(
    320,
    worldYToEngineY(config.terrain.minFloorDepth)
  );
  if (maxEngineY < minPossibleFloorEngineY - 60) {
    return;
  }

  const leftWorldX = (params.cameraEngineX - halfSpanEngineX) * WORLD_UNITS_PER_METER;
  const rightWorldX = (params.cameraEngineX + halfSpanEngineX) * WORLD_UNITS_PER_METER;
  const minChunkX = Math.floor(leftWorldX / config.chunk.width);
  const maxChunkX = Math.floor(rightWorldX / config.chunk.width);

  worldAssetRegistry.ensureAtlasesLoaded();
  const stripCoral = worldAssetRegistry.getSeabedStripCanvas('coral_reef');
  const stripRocky = worldAssetRegistry.getSeabedStripCanvas('rocky_shelf');
  const stripCanyon = worldAssetRegistry.getSeabedStripCanvas('underwater_canyon');
  const stripAbyss = worldAssetRegistry.getSeabedStripCanvas('deep_abyss');

  const subCoral = worldAssetRegistry.getSeabedSubStratumCanvas('coral_reef');
  const subRocky = worldAssetRegistry.getSeabedSubStratumCanvas('rocky_shelf');
  const subCanyon = worldAssetRegistry.getSeabedSubStratumCanvas('underwater_canyon');
  const subAbyss = worldAssetRegistry.getSeabedSubStratumCanvas('deep_abyss');

  const rockSlab = worldAssetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
  const rockBoulder = worldAssetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');
  const rockSpire = worldAssetRegistry.getSpriteCanvas('eco_seabed_rock', 'jagged_spire');

  const stripDrawH = 124;
  const crestLift = 22;
  const tileSpanEngineX = 520;

  /**
   * 沿斜率切变绘制无缝水平循环条带（支持跨 u=1.0 循环边界自动双段无缝拼接，彻底消除边界像素拉伸）
   */
  const drawSeamlessShearedStrip = (
    stripCanvas: HTMLCanvasElement,
    ex0: number,
    ey0: number,
    segW: number,
    drawH: number,
    slope: number,
    alpha: number,
    uPhaseOffset: number = 0,
    tileSpan: number = tileSpanEngineX
  ) => {
    if (alpha <= 0.01 || segW <= 0) return;
    const sw = stripCanvas.width;
    const sh = stripCanvas.height;
    if (sw <= 2 || sh <= 2) return;

    const u0 = ((((ex0 / tileSpan) + uPhaseOffset) % 1) + 1) % 1;
    const uSpan = Math.min(0.95, segW / tileSpan);
    const sx = Math.min(sw - 1, Math.floor(u0 * sw));
    const totalSw = Math.max(2, Math.round(uSpan * sw));

    ctx.save();
    ctx.transform(1, slope, 0, 1, ex0, ey0);
    ctx.globalAlpha = alpha;

    if (sx + totalSw <= sw) {
      ctx.drawImage(
        stripCanvas,
        sx,
        0,
        totalSw,
        sh,
        -0.6,
        0,
        segW + 1.2,
        drawH
      );
    } else {
      const firstSw = Math.max(1, sw - sx);
      const secondSw = Math.max(1, totalSw - firstSw);
      const firstRatio = firstSw / totalSw;
      const firstW = segW * firstRatio;
      const secondW = segW - firstW;

      ctx.drawImage(
        stripCanvas,
        sx,
        0,
        firstSw,
        sh,
        -0.6,
        0,
        firstW + 0.9,
        drawH
      );
      ctx.drawImage(
        stripCanvas,
        0,
        0,
        Math.min(sw, secondSw),
        sh,
        firstW - 0.4,
        0,
        secondW + 1.0,
        drawH
      );
    }
    ctx.restore();
  };

  // ==========================================================================
  // 单一 1:1 真实世界空间绘制（缩放完全交由外层原生 Canvas 2D 真相机矩阵处理）
  // ==========================================================================
  ctx.save();
  try {

  // ==========================================================================
  // A. 绘制浅海与中层 5 级连续阶梯海床 (`SEABED_TERRACE_TIERS`) 与向远处弯曲的弧形下潜洞口
  // 1) 取消原本突兀且未落地的悬空支柱；
  // 2) 在各层交错分布的下潜通道区绘制向远处深海弯曲凹陷的连续海床后壁与深邃弧形下潜洞口；
  // 3) 在各层前景实心海床段绘制圆润洞口岩唇、表层以下三阶层状地质断面与底部弧形洞顶，让中层广阔海域处处有海床参照物。
  // ==========================================================================
  if (config.terrain.minFloorDepth <= 600) {
    for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
      const tier = SEABED_TERRACE_TIERS[tIdx];
      if (maxEngineY < tier.minRidgeY - 90 || minEngineY > tier.archMaxDepthY + 280) {
        continue;
      }

      const tierStripPrimary =
        tIdx === 0
          ? stripCoral
          : tIdx <= 2
          ? (stripRocky ?? stripCoral)
          : tIdx <= 6
          ? (stripCanyon ?? stripRocky)
          : (stripAbyss ?? stripCanyon);
      const tierStripSecondary =
        tIdx === 1
          ? stripCoral
          : tIdx === 2
          ? stripCanyon
          : tIdx === 3
          ? stripRocky
          : tIdx === 6
          ? stripAbyss
          : tIdx === 7
          ? stripCanyon
          : null;
      const tierStripBlend =
        tIdx === 1
          ? 0.32
          : tIdx === 2
          ? 0.22
          : tIdx === 3
          ? 0.28
          : tIdx === 6
          ? 0.38
          : tIdx === 7
          ? 0.24
          : 0;

      const archSubPrimary =
        tIdx === 0
          ? (subCoral ?? stripCoral)
          : tIdx <= 2
          ? (subRocky ?? stripRocky ?? subCoral)
          : tIdx <= 6
          ? (subCanyon ?? stripCanyon ?? subRocky)
          : (subAbyss ?? stripAbyss ?? subCanyon);
      const archSubSecondary =
        tIdx === 0
          ? (subRocky ?? stripRocky)
          : tIdx <= 2
          ? (subCanyon ?? stripCanyon ?? subCoral)
          : tIdx <= 6
          ? (subAbyss ?? stripAbyss ?? subRocky)
          : (subCanyon ?? stripCanyon ?? subAbyss);

      // A1. 先绘制当前层「向远处弯曲的弧形下潜洞口后壁与深邃洞腔」(Receding Arched Cave Openings)
      const firstSeamIdx = Math.floor(
        (leftWorldX - tier.seamPhaseOffsetX - tier.bowlHalfWidth) / tier.cellWidth
      );
      const lastSeamIdx = Math.ceil(
        (rightWorldX - tier.seamPhaseOffsetX + tier.bowlHalfWidth) / tier.cellWidth
      );

      ctx.save();
      for (let seamIdx = firstSeamIdx; seamIdx <= lastSeamIdx; seamIdx++) {
        if (tier.skipZeroSeam && seamIdx === 0) continue; // 第 0 层 X = 0 为新手出生主海山，无下潜洞口
        const seamWorldX = seamIdx * tier.cellWidth + tier.seamPhaseOffsetX;
        if (getFloorDepthAt(seamWorldX, config) <= tier.minMainFloorForOpening) continue;

        const bowlSpan = tier.bowlHalfWidth;
        const bowlLeftX = seamWorldX - bowlSpan;
        const bowlRightX = seamWorldX + bowlSpan;
        if (bowlRightX < leftWorldX - 60 || bowlLeftX > rightWorldX + 60) continue;

        const bowlSteps = lowDetailLod ? 16 : 28;
        const bowlSegW = (bowlRightX - bowlLeftX) / bowlSteps;
        const bowlPts: Array<{
          x: number;
          rimY: number;
          botY: number;
          slope: number;
          openFactor: number;
        }> = [];

        for (let s = 0; s <= bowlSteps; s++) {
          const wx = bowlLeftX + s * bowlSegW;
          const sample = getSeabedTerraceAt(wx, tIdx, config);
          const rimY = sample.visualRimY ?? sample.topFloorY;
          const openFactor = sample.openingDepthFactor ?? 0;
          const botY = Math.max(
            tier.archMaxDepthY + 32,
            rimY + 218 + openFactor * 136
          );
          bowlPts.push({
            x: wx / WORLD_UNITS_PER_METER,
            rimY,
            botY,
            slope: sample.visualRimSlope ?? sample.slope,
            openFactor,
          });
        }

        const centerPt = bowlPts[Math.floor(bowlSteps * 0.5)];
        const seamEngineX = seamWorldX / WORLD_UNITS_PER_METER;

        // 1) 洞口后退弧形海床岩壁基底与层理（向深水自然渐变消融，无生硬底边）
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < bowlPts.length; i++) {
          const pt = bowlPts[i];
          if (i === 0) ctx.moveTo(pt.x, pt.rimY + 14);
          else ctx.lineTo(pt.x, pt.rimY + 14);
        }
        for (let i = bowlPts.length - 1; i >= 0; i--) {
          const pt = bowlPts[i];
          ctx.lineTo(pt.x, pt.botY);
        }
        ctx.closePath();

        const backWallGrad = ctx.createLinearGradient(
          0,
          centerPt.rimY - 30,
          0,
          centerPt.botY
        );
        if (tIdx === 0) {
          backWallGrad.addColorStop(0, 'rgba(92, 58, 36, 0.95)');
          backWallGrad.addColorStop(0.38, 'rgba(42, 40, 56, 0.90)');
          backWallGrad.addColorStop(0.76, 'rgba(14, 28, 52, 0.62)');
          backWallGrad.addColorStop(1, 'rgba(6, 16, 34, 0.0)');
        } else if (tIdx <= 2) {
          backWallGrad.addColorStop(0, 'rgba(54, 70, 92, 0.95)');
          backWallGrad.addColorStop(0.40, 'rgba(28, 42, 62, 0.90)');
          backWallGrad.addColorStop(0.78, 'rgba(12, 24, 44, 0.62)');
          backWallGrad.addColorStop(1, 'rgba(5, 12, 26, 0.0)');
        } else if (tIdx <= 6) {
          backWallGrad.addColorStop(0, 'rgba(34, 50, 82, 0.95)');
          backWallGrad.addColorStop(0.40, 'rgba(18, 30, 56, 0.90)');
          backWallGrad.addColorStop(0.78, 'rgba(8, 16, 36, 0.62)');
          backWallGrad.addColorStop(1, 'rgba(4, 8, 20, 0.0)');
        } else {
          backWallGrad.addColorStop(0, 'rgba(52, 28, 26, 0.96)');
          backWallGrad.addColorStop(0.42, 'rgba(28, 16, 18, 0.90)');
          backWallGrad.addColorStop(0.78, 'rgba(14, 10, 18, 0.64)');
          backWallGrad.addColorStop(1, 'rgba(5, 4, 10, 0.0)');
        }
        ctx.fillStyle = backWallGrad;
        ctx.fill();

        ctx.clip();
        if (archSubPrimary) {
          for (let i = 0; i < bowlPts.length - 1; i++) {
            const p0 = bowlPts[i];
            const p1 = bowlPts[i + 1];
            const w = p1.x - p0.x;
            if (w <= 0) continue;
            const sl = (p1.rimY - p0.rimY) / w;
            const backWallThick = Math.max(p0.botY - p0.rimY, p1.botY - p1.rimY);
            const bwStepY = 82;
            const bwDrawH = 162;
            for (let bTier = 0; bTier < 6; bTier++) {
              const offsetY = 22 + bTier * bwStepY;
              if (offsetY > backWallThick + 20) break;
              const tierTex = bTier === 0 ? archSubPrimary : (archSubSecondary ?? archSubPrimary);
              const slopeFactor = Math.max(0.38, 0.92 - bTier * 0.16);
              const alphaFactor = Math.max(0.34, 0.84 - bTier * 0.14);
              const phase = (0.21 + bTier * 0.37 + seamIdx * (0.13 + bTier * 0.07) + tIdx * 0.19) % 1;
              drawSeamlessShearedStrip(
                tierTex,
                p0.x,
                p0.rimY + offsetY,
                w,
                bwDrawH,
                sl * slopeFactor,
                alphaFactor,
                phase
              );
            }
          }
        }

        // 叠加海水远景大气透视雾（使下弯的海床后壁产生强烈的「向远处弧形后退」空间纵深感）
        const depthHazeGrad = ctx.createRadialGradient(
          seamEngineX,
          centerPt.rimY + 65,
          24,
          seamEngineX,
          centerPt.rimY + 95,
          bowlSpan * 0.95
        );
        depthHazeGrad.addColorStop(0, 'rgba(7, 28, 56, 0.72)');
        depthHazeGrad.addColorStop(0.58, 'rgba(11, 38, 70, 0.44)');
        depthHazeGrad.addColorStop(1, 'rgba(12, 42, 74, 0.0)');
        ctx.fillStyle = depthHazeGrad;
        ctx.fillRect(
          bowlPts[0].x,
          centerPt.rimY - 120,
          bowlPts[bowlPts.length - 1].x - bowlPts[0].x,
          480
        );

        // 2) 绘制「向下的深邃弧形洞口」洞腔暗影、3 道向内弯曲的环形岩阶
        const portalCenterY = centerPt.rimY + 112;
        const portalRx = tier.openingHalfWidth * 1.18;
        const portalRy = 186;
        ctx.save();
        ctx.translate(seamEngineX, portalCenterY);
        ctx.scale(portalRx / portalRy, 1);
        const cavePortalGrad = ctx.createRadialGradient(0, -14, 14, 0, 12, portalRy);
        cavePortalGrad.addColorStop(0, 'rgba(2, 7, 18, 0.94)');
        cavePortalGrad.addColorStop(0.52, 'rgba(5, 16, 36, 0.82)');
        cavePortalGrad.addColorStop(0.84, 'rgba(9, 28, 54, 0.38)');
        cavePortalGrad.addColorStop(1, 'rgba(12, 36, 66, 0.0)');
        ctx.fillStyle = cavePortalGrad;
        ctx.beginPath();
        ctx.arc(0, 0, portalRy, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 洞腔内壁 3 道向远处向下弯曲的同心弧形岩脊环阶（强化隧道/洞口向下延伸的立体透视）
        for (let ring = 0; ring < 3; ring++) {
          const ringDepthOffset = 52 + ring * 52;
          const ringSpread = (1 - ring * 0.14) * tier.openingHalfWidth * 1.12;
          const ringLeftX = seamEngineX - ringSpread;
          const ringRightX = seamEngineX + ringSpread;
          const ringTopY = centerPt.rimY - 18 + ring * 30;
          const ringDipY = centerPt.rimY + ringDepthOffset + 68;

          ctx.strokeStyle =
            ring === 0
              ? 'rgba(18, 42, 68, 0.68)'
              : ring === 1
              ? 'rgba(14, 34, 58, 0.55)'
              : 'rgba(10, 26, 46, 0.42)';
          ctx.lineWidth = 6.0 - ring * 1.1;
          ctx.beginPath();
          ctx.moveTo(ringLeftX, ringTopY);
          ctx.quadraticCurveTo(seamEngineX, ringDipY, ringRightX, ringTopY);
          ctx.stroke();

          ctx.strokeStyle = `rgba(56, 189, 248, ${(0.19 - ring * 0.045).toFixed(3)})`;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(ringLeftX + 12, ringTopY - 2);
          ctx.quadraticCurveTo(seamEngineX, ringDipY - 3, ringRightX - 12, ringTopY - 2);
          ctx.stroke();
        }
        ctx.restore();

        // 3) 沿向远处下弯的连续洞口后壁顶沿铺设当前层海床表层条带，并叠加远景水雾暗化，让各层海床视觉上 100% 连续不断开
        if (tierStripPrimary) {
          for (let i = 0; i < bowlPts.length - 1; i++) {
            const p0 = bowlPts[i];
            const p1 = bowlPts[i + 1];
            const w = p1.x - p0.x;
            if (w <= 0) continue;
            const sl = (p1.rimY - p0.rimY) / w;
            drawSeamlessShearedStrip(
              tierStripPrimary,
              p0.x,
              p0.rimY - crestLift,
              w,
              stripDrawH * 0.92,
              sl,
              0.94 * (1 - tierStripBlend),
              tIdx * 0.17
            );
            if (tierStripSecondary && tierStripBlend > 0.01) {
              drawSeamlessShearedStrip(
                tierStripSecondary,
                p0.x,
                p0.rimY - crestLift,
                w,
                stripDrawH * 0.92,
                sl,
                0.94 * tierStripBlend,
                tIdx * 0.17
              );
            }
          }

          // 为洞口段下弯的后壁表层带叠加一层深海远景蓝影，使其退居后景，与前景两侧洞唇拉开前后层次
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < bowlPts.length; i++) {
            const pt = bowlPts[i];
            if (i === 0) ctx.moveTo(pt.x, pt.rimY - crestLift - 6);
            else ctx.lineTo(pt.x, pt.rimY - crestLift - 6);
          }
          for (let i = bowlPts.length - 1; i >= 0; i--) {
            const pt = bowlPts[i];
            ctx.lineTo(pt.x, pt.rimY + 52);
          }
          ctx.closePath();
          const rimShadeGrad = ctx.createLinearGradient(bowlLeftX, 0, bowlRightX, 0);
          rimShadeGrad.addColorStop(0, 'rgba(8, 30, 56, 0.0)');
          rimShadeGrad.addColorStop(0.28, 'rgba(8, 30, 56, 0.36)');
          rimShadeGrad.addColorStop(0.5, 'rgba(6, 22, 44, 0.56)');
          rimShadeGrad.addColorStop(0.72, 'rgba(8, 30, 56, 0.36)');
          rimShadeGrad.addColorStop(1, 'rgba(8, 30, 56, 0.0)');
          ctx.fillStyle = rimShadeGrad;
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      // A2. 绘制当前层前景实心海床段（无悬空立柱、两侧洞壁向下弯曲围合洞口、厚实三阶地下岩层）
      const firstAtollCell =
        Math.floor((leftWorldX - tier.seamPhaseOffsetX) / tier.cellWidth) - 1;
      const lastAtollCell =
        Math.floor((rightWorldX - tier.seamPhaseOffsetX) / tier.cellWidth) + 1;

      ctx.save();
      for (let cellIdx = firstAtollCell; cellIdx <= lastAtollCell; cellIdx++) {
        const segStartX =
          tier.skipZeroSeam && cellIdx === 0
            ? 0
            : cellIdx * tier.cellWidth + tier.seamPhaseOffsetX + tier.openingHalfWidth;
        const segEndX =
          tier.skipZeroSeam && cellIdx === -1
            ? 0
            : (cellIdx + 1) * tier.cellWidth +
              tier.seamPhaseOffsetX -
              tier.openingHalfWidth;

        if (segEndX < leftWorldX - 80 || segStartX > rightWorldX + 80 || segEndX <= segStartX) {
          continue;
        }

        const stepCount = lowDetailLod ? 20 : 36;
        const segW = (segEndX - segStartX) / stepCount;
        const allPts: Array<{
          x: number;
          topY: number;
          bottomY: number;
          mainFloorY: number;
          slope: number;
          valid: boolean;
        }> = [];

        for (let s = 0; s <= stepCount; s++) {
          const wx = segStartX + s * segW;
          const mainFloorY = getFloorDepthAt(wx, config);
          const sample = getSeabedTerraceAt(wx, tIdx, config);
          // 仅在主海床下潜至 > graftStartMainY - 20m 且该格未被巨鲨撞碎时绘制前景实心岩段
          const valid =
            mainFloorY > tier.graftStartMainY - 20 &&
            !isTerraceCellBreached(tIdx, wx, params.breachedTerraceCells);
          allPts.push({
            x: wx / WORLD_UNITS_PER_METER,
            topY: sample.topFloorY,
            bottomY: Math.max(sample.topFloorY + 38, sample.bottomArchY),
            mainFloorY,
            slope: sample.slope,
            valid,
          });
        }

        // 提取连续有效的实心段子序列
        let runStart = -1;
        for (let idx = 0; idx <= allPts.length; idx++) {
          const isVal = idx < allPts.length && allPts[idx].valid;
          if (isVal && runStart === -1) {
            runStart = idx;
          } else if (!isVal && runStart !== -1) {
            const topPts = allPts.slice(runStart, idx);
            runStart = -1;
            if (topPts.length < 2) continue;

            // 1. 绘制前景海床实心岩体与表层以下多层地质断面 + 镶嵌岩块（外层统一由 ctx.scale 各向同性微缩）
            const archTopInset = 18;
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < topPts.length; i++) {
              const pt = topPts[i];
              const insetTopY = Math.min(pt.bottomY - 6, pt.topY + archTopInset);
              if (i === 0) ctx.moveTo(pt.x, insetTopY);
              else ctx.lineTo(pt.x, insetTopY);
            }
            for (let i = topPts.length - 1; i >= 0; i--) {
              const pt = topPts[i];
              ctx.lineTo(pt.x, pt.bottomY);
            }
            ctx.closePath();

            const archGrad = ctx.createLinearGradient(
              0,
              tier.minRidgeY,
              0,
              tier.archMaxDepthY + 15
            );
            if (tIdx === 0) {
              archGrad.addColorStop(0, '#7a4b2a');
              archGrad.addColorStop(0.36, '#54321c');
              archGrad.addColorStop(0.72, '#341e12');
              archGrad.addColorStop(1, '#1b1114');
            } else if (tIdx <= 2) {
              archGrad.addColorStop(0, '#364960');
              archGrad.addColorStop(0.38, '#233246');
              archGrad.addColorStop(0.74, '#152030');
              archGrad.addColorStop(1, '#0b121e');
            } else if (tIdx <= 6) {
              archGrad.addColorStop(0, '#243558');
              archGrad.addColorStop(0.38, '#16233e');
              archGrad.addColorStop(0.74, '#0d1528');
              archGrad.addColorStop(1, '#060a17');
            } else {
              archGrad.addColorStop(0, '#331d1a');
              archGrad.addColorStop(0.38, '#1f1110');
              archGrad.addColorStop(0.74, '#120a0a');
              archGrad.addColorStop(1, '#080405');
            }
            ctx.fillStyle = archGrad;
            ctx.fill();

            ctx.clip();
            if (archSubPrimary) {
              const subStepY = 82;
              const subDrawH = 164;
              for (let i = 0; i < topPts.length - 1; i++) {
                const p0 = topPts[i];
                const p1 = topPts[i + 1];
                const w = p1.x - p0.x;
                if (w <= 0) continue;
                const sl = (p1.topY - p0.topY) / w;
                const archThick = Math.max(
                  p0.bottomY - p0.topY,
                  p1.bottomY - p1.topY
                );

                for (let sTier = 0; sTier < 8; sTier++) {
                  const offsetY = 24 + sTier * subStepY;
                  if (sTier > 0 && offsetY > archThick + 12) break;
                  const tierTex = sTier <= 1 ? archSubPrimary : (archSubSecondary ?? archSubPrimary);
                  const slopeFactor = Math.max(0.45, 0.95 - sTier * 0.13);
                  const alphaFactor = Math.max(0.78, 0.98 - sTier * 0.04);
                  const phase = (0.37 + sTier * 0.37 + cellIdx * (0.17 + sTier * 0.09) + tIdx * 0.23) % 1;
                  drawSeamlessShearedStrip(
                    tierTex,
                    p0.x,
                    p0.topY + offsetY,
                    w,
                    subDrawH,
                    sl * slopeFactor,
                    alphaFactor,
                    phase
                  );
                }

                // 在海床断面内按确定性哈希镶嵌阶梯砂岩与巨石 (`mossy_slab` / `basalt_boulder` / `jagged_spire`)
                if (
                  !skipEmbeddedMicroRocks &&
                  archThick > 155 &&
                  (i & 1) === 0 &&
                  (rockSlab || rockBoulder || rockSpire)
                ) {
                  const rHash = mixSubsystemSeed(
                    config.worldSeed,
                    config.generatorVersion,
                    cellIdx * 64 + i,
                    619 + tIdx * 197,
                    'terrain'
                  );
                  if ((rHash % 100) < 62) {
                    const rockImg =
                      tIdx === 0
                        ? (rHash & 1) === 0
                          ? (rockSlab ?? rockBoulder)
                          : (rockBoulder ?? rockSlab)
                        : (rHash % 3) === 0
                        ? (rockSlab ?? rockBoulder)
                        : (rHash % 3) === 1
                        ? (rockBoulder ?? rockSlab)
                        : (rockSpire ?? rockBoulder);
                    if (rockImg) {
                      const rScale = 0.35 + (((rHash >>> 8) % 18) / 100);
                      const rw = rockImg.width * rScale;
                      const rh = rockImg.height * rScale;
                      const rx = p0.x + w * 0.5;
                      const ry = p0.topY + 132 + (((rHash >>> 14) % 48) - 20);
                      ctx.save();
                      ctx.translate(rx, ry);
                      ctx.rotate(Math.max(-0.32, Math.min(0.32, sl * 0.45)));
                      ctx.scale((rHash & 2) !== 0 ? -1 : 1, 1);
                      ctx.globalAlpha = 0.34;
                      ctx.drawImage(rockImg, -rw * 0.5, -rh * 0.5, rw, rh);
                      ctx.restore();
                    }
                  }
                }
              }
            }
            ctx.restore();

            // 2. 拱形洞顶底壁环境闭塞暗影与微光岩石边缘（仅在主海床已深于洞顶 bottomY + 14m 的悬空水道区绘制，山体根部融合区绝不画分割线！）
            ctx.strokeStyle = 'rgba(10, 16, 28, 0.58)';
            ctx.lineWidth = 6.0;
            ctx.beginPath();
            let strokeOpen = false;
            for (let i = 0; i < topPts.length; i++) {
              const pt = topPts[i];
              if (pt.mainFloorY > pt.bottomY + 14) {
                if (!strokeOpen) {
                  ctx.moveTo(pt.x, pt.bottomY - 2);
                  strokeOpen = true;
                } else {
                  ctx.lineTo(pt.x, pt.bottomY - 2);
                }
              } else {
                strokeOpen = false;
              }
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            strokeOpen = false;
            for (let i = 0; i < topPts.length; i++) {
              const pt = topPts[i];
              if (pt.mainFloorY > pt.bottomY + 14) {
                if (!strokeOpen) {
                  ctx.moveTo(pt.x, pt.bottomY);
                  strokeOpen = true;
                } else {
                  ctx.lineTo(pt.x, pt.bottomY);
                }
              } else {
                strokeOpen = false;
              }
            }
            ctx.stroke();

            // 3. 在洞口左右两侧的前景圆润洞壁唇口处点缀镶嵌礁石 (`mossy_slab` / `basalt_boulder`)，强化天然向下洞口轮廓
            const lipRock = tIdx <= 1 ? (rockSlab ?? rockBoulder) : (rockBoulder ?? rockSlab);
            if (lipRock) {
              const leftLipPt = topPts[0];
              const rightLipPt = topPts[topPts.length - 1];
              const lipCandidates = [
                { pt: leftLipPt, isLeft: true },
                { pt: rightLipPt, isLeft: false },
              ];
              for (const cand of lipCandidates) {
                if (cand.pt.mainFloorY <= cand.pt.bottomY + 14) continue; // 山体根部交汇端无须洞唇石
                const rScale = 0.44;
                const rw = lipRock.width * rScale;
                const rh = lipRock.height * rScale;
                ctx.save();
                ctx.translate(cand.pt.x, cand.pt.topY + 28);
                ctx.rotate(cand.isLeft ? -0.32 : 0.32);
                ctx.scale(cand.isLeft ? 1 : -1, 1);
                ctx.globalAlpha = 0.90;
                ctx.drawImage(lipRock, -rw * 0.5, -rh * 0.5, rw, rh);
                ctx.restore();
              }
            }

            // 4. 在前景实心海床顶面铺设手绘表层条带 (`coral_reef` / `rocky_shelf` / `underwater_canyon`)
            if (tierStripPrimary) {
              for (let i = 0; i < topPts.length - 1; i++) {
                const p0 = topPts[i];
                const p1 = topPts[i + 1];
                const w = p1.x - p0.x;
                if (w <= 0) continue;
                const sl = (p1.topY - p0.topY) / w;
                drawSeamlessShearedStrip(
                  tierStripPrimary,
                  p0.x,
                  p0.topY - crestLift,
                  w,
                  stripDrawH,
                  sl,
                  0.98 * (1 - tierStripBlend),
                  tIdx * 0.17
                );
                if (tierStripSecondary && tierStripBlend > 0.01) {
                  drawSeamlessShearedStrip(
                    tierStripSecondary,
                    p0.x,
                    p0.topY - crestLift,
                    w,
                    stripDrawH,
                    sl,
                    0.98 * tierStripBlend,
                    tIdx * 0.17
                  );
                }
              }
            }
          }
        }
      }
      ctx.restore();
    }
  }

  // ==========================================================================
  // B. 绘制 1.0x 连续主海床 (`getTerrainSamples`) — 4×25m Catmull-Rom 山脊曲线细分
  // ==========================================================================
  const samplePoints = scratchSeabedRenderPoints;
  samplePoints.length = 0;
  for (let cx = minChunkX; cx <= maxChunkX; cx++) {
    const chunkSamples = getTerrainSamples(cx, config);
    const startIdx = cx === minChunkX ? 0 : 1;
    for (let i = startIdx; i < chunkSamples.points.length; i++) {
      samplePoints.push(chunkSamples.points[i]);
    }
  }

  if (samplePoints.length < 2) return;

  // 检查当前视野内是否有主海床进入可见高度范围
  let minVisFloorEngineY = Infinity;
  for (let i = 0; i < samplePoints.length; i++) {
    const ey = worldYToEngineY(samplePoints[i].floorY);
    if (ey < minVisFloorEngineY) minVisFloorEngineY = ey;
  }
  if (maxEngineY < minVisFloorEngineY - 60) {
    return;
  }

  const bottomCapEngineY = Math.max(
    maxEngineY + 240,
    worldYToEngineY(config.bounds.maxDepth) + 160
  );

  // 计算每 100m 网格段内的自然山脊样条插值高度（高倍拉远 zoom < 0.45 时自适应降采样为 2 段，稳守 60FPS）
  const SUB_STEPS = lowDetailLod ? 2 : 4;
  const evalSubSegmentEngineY = (segIdx: number, subStep: number): number => {
    const p0 = samplePoints[segIdx];
    const p1 = samplePoints[segIdx + 1];
    const ey0 = p0.floorY / WORLD_UNITS_PER_METER;
    const ey1 = p1.floorY / WORLD_UNITS_PER_METER;
    if (subStep <= 0) return ey0;
    if (subStep >= SUB_STEPS) return ey1;

    const pPrev = samplePoints[Math.max(0, segIdx - 1)];
    const pNext = samplePoints[Math.min(samplePoints.length - 1, segIdx + 2)];
    const eyPrev = pPrev.floorY / WORLD_UNITS_PER_METER;
    const eyNext = pNext.floorY / WORLD_UNITS_PER_METER;

    const t = subStep / SUB_STEPS;
    const t2 = t * t;
    const t3 = t2 * t;
    // Catmull-Rom 三次样条（张力 0.5），将折线平滑为自然起伏的山峰与鞍部曲线
    const catmullY =
      0.5 *
      (2 * ey0 +
        (-eyPrev + ey1) * t +
        (2 * eyPrev - 5 * ey0 + 4 * ey1 - eyNext) * t2 +
        (-eyPrev + 3 * ey0 - 3 * ey1 + eyNext) * t3);

    // 叠加在段端点 (t=0, t=1) 归零的确定性岩脊微起伏，彻底杜绝任何局部直线的存在
    const ex = (p0.worldX + (p1.worldX - p0.worldX) * t) / WORLD_UNITS_PER_METER;
    const microRipple =
      Math.sin(Math.PI * t) *
      (Math.sin(ex * 0.058 + 1.1) * 5.2 + Math.cos(ex * 0.115 - 0.7) * 3.1);

    return catmullY + microRipple;
  };

  const resolveStripPairForDepth = (
    segDepthM: number,
    cCoral: HTMLCanvasElement | null,
    cRocky: HTMLCanvasElement | null,
    cCanyon: HTMLCanvasElement | null,
    cAbyss: HTMLCanvasElement | null
  ): {
    primary: HTMLCanvasElement | null;
    secondary: HTMLCanvasElement | null;
    blend: number;
  } => {
    if (segDepthM < 1500) {
      return { primary: cCoral, secondary: null, blend: 0 };
    }
    if (segDepthM < 2300) {
      const t = (segDepthM - 1500) / 800;
      return { primary: cCoral, secondary: cRocky, blend: t };
    }
    if (segDepthM < 5400) {
      return { primary: cRocky, secondary: null, blend: 0 };
    }
    if (segDepthM < 6600) {
      const t = (segDepthM - 5400) / 1200;
      return { primary: cRocky, secondary: cCanyon, blend: t };
    }
    if (segDepthM < 11800) {
      return { primary: cCanyon, secondary: null, blend: 0 };
    }
    if (segDepthM < 13400) {
      const t = (segDepthM - 11800) / 1600;
      return { primary: cCanyon, secondary: cAbyss, blend: t };
    }
    return { primary: cAbyss, secondary: null, blend: 0 };
  };

  ctx.save();

  // 1. 构建 1.0x 世界层主海床多边形路径（沿 25m 曲线细分点绘制，顶边下沉 18px 以完全藏于表层金沙核心之后），填充地质基底色并开启 Clip 剪裁
  const subsurfaceTopInset = 18;
  const firstEngineX = samplePoints[0].worldX / WORLD_UNITS_PER_METER;
  const lastEngineX = samplePoints[samplePoints.length - 1].worldX / WORLD_UNITS_PER_METER;
  const gradTopY = Math.max(minEngineY, minVisFloorEngineY);
  const avgDepthM = params.cameraEngineY;

  const seabedGrad = ctx.createLinearGradient(0, gradTopY, 0, bottomCapEngineY);
  if (avgDepthM <= 1800) {
    seabedGrad.addColorStop(0, '#7a4b2a');
    seabedGrad.addColorStop(0.28, '#54321c');
    seabedGrad.addColorStop(0.65, '#361f12');
    seabedGrad.addColorStop(1, '#1c100a');
  } else if (avgDepthM <= 5800) {
    seabedGrad.addColorStop(0, '#33465e');
    seabedGrad.addColorStop(0.35, '#1e2b3c');
    seabedGrad.addColorStop(1, '#0b121e');
  } else if (avgDepthM <= 12500) {
    seabedGrad.addColorStop(0, '#1e2d52');
    seabedGrad.addColorStop(0.35, '#111b34');
    seabedGrad.addColorStop(1, '#060a17');
  } else {
    seabedGrad.addColorStop(0, '#331d1a');
    seabedGrad.addColorStop(0.35, '#1b0f0e');
    seabedGrad.addColorStop(1, '#090505');
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    firstEngineX,
    samplePoints[0].floorY / WORLD_UNITS_PER_METER + subsurfaceTopInset
  );
  for (let i = 0; i < samplePoints.length - 1; i++) {
    const ex0 = samplePoints[i].worldX / WORLD_UNITS_PER_METER;
    const ex1 = samplePoints[i + 1].worldX / WORLD_UNITS_PER_METER;
    const fullW = ex1 - ex0;
    for (let s = 1; s <= SUB_STEPS; s++) {
      const subX = ex0 + (fullW * s) / SUB_STEPS;
      const subY = evalSubSegmentEngineY(i, s) + subsurfaceTopInset;
      ctx.lineTo(subX, subY);
    }
  }
  ctx.lineTo(lastEngineX, bottomCapEngineY);
  ctx.lineTo(firstEngineX, bottomCapEngineY);
  ctx.closePath();
  ctx.fillStyle = seabedGrad;
  ctx.fill();

  // ==========================================================================
  // 2. 在主海床山体剪裁区域内，铺满「表层以下」全高度多层顺应山势的地质岩壁与镶嵌断面岩块
  // ==========================================================================
  ctx.clip();

  const effSubCoral = subCoral ?? stripCoral;
  const effSubRocky = subRocky ?? stripRocky;
  const effSubCanyon = subCanyon ?? stripCanyon;
  const effSubAbyss = subAbyss ?? stripAbyss;

  if (effSubCoral || effSubRocky || effSubCanyon || effSubAbyss) {
    for (let i = 0; i < samplePoints.length - 1; i++) {
      const p0 = samplePoints[i];
      const p1 = samplePoints[i + 1];
      const ex0 = p0.worldX / WORLD_UNITS_PER_METER;
      const ey0 = p0.floorY / WORLD_UNITS_PER_METER;
      const ex1 = p1.worldX / WORLD_UNITS_PER_METER;
      const ey1 = p1.floorY / WORLD_UNITS_PER_METER;
      const fullW = ex1 - ex0;
      if (fullW <= 0) continue;

      const minSegEy = Math.min(ey0, ey1);
      if (minSegEy > maxEngineY + 80) continue;

      const segDepthM = (ey0 + ey1) * 0.5;
      const segSlope = (ey1 - ey0) / fullW;
      const { primary: subPri, secondary: subSec, blend: subBlend } =
        resolveStripPairForDepth(
          segDepthM,
          effSubCoral,
          effSubRocky,
          effSubCanyon,
          effSubAbyss
        );

      // 2.1 近表层第 0、1、2 阶地下岩层（offsetY = 24px、106px、192px）：按 25m 样条子段紧贴表层山脊起伏绘制
      const subW = fullW / SUB_STEPS;
      let prevSubX = ex0;
      let prevSubY = ey0;
      for (let s = 1; s <= SUB_STEPS; s++) {
        const nextSubX = ex0 + subW * s;
        const nextSubY = evalSubSegmentEngineY(i, s);
        const subSlope = (nextSubY - prevSubY) / subW;

        // Tier 0: 紧接表层金沙砂岩唇口下方的第一道断层岩壁（无缝衔接表层底部）
        const t0OffsetY = 24;
        const t0DrawH = 156;
        if (prevSubY + t0OffsetY < maxEngineY + 80) {
          if (subPri && subSec && subBlend > 0.02) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + t0OffsetY, subW, t0DrawH, subSlope * 0.96, (1 - subBlend) * 0.98, 0.37);
            drawSeamlessShearedStrip(subSec, prevSubX, prevSubY + t0OffsetY, subW, t0DrawH, subSlope * 0.96, subBlend * 0.98, 0.37);
          } else if (subPri) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + t0OffsetY, subW, t0DrawH, subSlope * 0.96, 0.98, 0.37);
          }
        }

        // Tier 1: 表层以下 106px 处的第二道交错沉积岩层
        const t1OffsetY = 106;
        const t1DrawH = 164;
        if (prevSubY + t1OffsetY < maxEngineY + 80) {
          const t1Slope = subSlope * 0.86;
          if (subPri && subSec && subBlend > 0.02) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + t1OffsetY, subW, t1DrawH, t1Slope, (1 - subBlend) * 0.95, 0.74);
            drawSeamlessShearedStrip(subSec, prevSubX, prevSubY + t1OffsetY, subW, t1DrawH, t1Slope, subBlend * 0.95, 0.74);
          } else if (subPri) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + t1OffsetY, subW, t1DrawH, t1Slope, 0.95, 0.74);
          }
        }

        // Tier 2: 表层以下 192px 处的第三道交错沉积岩层
        const t2OffsetY = 192;
        const t2DrawH = 168;
        if (prevSubY + t2OffsetY < maxEngineY + 80) {
          const t2Slope = subSlope * 0.75;
          if (subPri && subSec && subBlend > 0.02) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + t2OffsetY, subW, t2DrawH, t2Slope, (1 - subBlend) * 0.92, 0.19);
            drawSeamlessShearedStrip(subSec, prevSubX, prevSubY + t2OffsetY, subW, t2DrawH, t2Slope, subBlend * 0.92, 0.19);
          } else if (subPri) {
            drawSeamlessShearedStrip(subPri, prevSubX, prevSubY + t2OffsetY, subW, t2DrawH, t2Slope, 0.92, 0.19);
          }
        }

        prevSubX = nextSubX;
        prevSubY = nextSubY;
      }

      // 2.2 深部多层地质基岩层（Tier 3..28，从表层以下 280px 一路无缝叠铺至视野底端 maxEngineY）
      // 按 100m 网格段高效绘制，每层水平相位按黄金分割偏移、斜率逐层平缓化，彻底消除山体内部空洞感
      const tierStepY = 92;
      const tierDrawH = 168;
      for (let tier = 3; tier <= 28; tier++) {
        const tierOffsetY = 280 + (tier - 3) * tierStepY;
        if (minSegEy + tierOffsetY > maxEngineY + 80) break;

        const tierSlope = segSlope * Math.pow(0.78, Math.min(12, tier));
        const uPhase = ((tier * 0.381966) + (tier % 2) * 0.23) % 1;
        const depthFade = Math.max(0.64, 0.90 - (tier - 3) * 0.025);

        if (subPri && subSec && subBlend > 0.02) {
          drawSeamlessShearedStrip(subPri, ex0, ey0 + tierOffsetY, fullW, tierDrawH, tierSlope, (1 - subBlend) * depthFade, uPhase);
          drawSeamlessShearedStrip(subSec, ex0, ey0 + tierOffsetY, fullW, tierDrawH, tierSlope, subBlend * depthFade, uPhase);
        } else if (subPri) {
          drawSeamlessShearedStrip(subPri, ex0, ey0 + tierOffsetY, fullW, tierDrawH, tierSlope, depthFade, uPhase);
        }
      }

      // 2.3 山体断面内嵌阶梯岩块与巨石露头（当山体在视野内露出高度 > 160px 且非极远镜头时，按确定性哈希镶嵌手绘阶梯岩架）
      const visMountainH = maxEngineY - minSegEy;
      if (!skipEmbeddedMicroRocks && visMountainH > 160 && (rockSlab || rockBoulder || rockSpire)) {
        const segGridIdx = Math.round(ex0 / 100);
        const segHash = mixSubsystemSeed(
          config.worldSeed,
          config.generatorVersion,
          segGridIdx,
          313,
          'terrain'
        );
        const maxOutcropTiers = Math.min(
          4,
          Math.floor((visMountainH - 100) / 135)
        );
        for (let ot = 0; ot < maxOutcropTiers; ot++) {
          const subHash = mixSubsystemSeed(segHash, ot, segGridIdx, 571, 'terrain');
          if ((subHash % 100) >= 65) continue;

          // 浅海砂岩区优先使用阶梯状层岩 (`mossy_slab`)，深海区混合玄武岩巨石与尖峰
          const spriteChoice = segDepthM < 1800 ? 0 : (subHash >>> 4) % 3;
          const rockSprite =
            spriteChoice === 0
              ? (rockSlab ?? rockBoulder)
              : spriteChoice === 1
              ? (rockBoulder ?? rockSlab)
              : (rockSpire ?? rockSlab);
          if (!rockSprite) continue;

          const fracX = 0.18 + (((subHash >>> 8) % 640) / 1000);
          const rx = ex0 + fullW * fracX;
          const baseSurfY = ey0 + (ey1 - ey0) * fracX;
          const ry =
            baseSurfY +
            (125 +
              ot * 135 +
              (((subHash >>> 18) % 36) - 18));
          if (ry > maxEngineY + 70) continue;

          const rScale = 0.34 + (((subHash >>> 12) % 24) / 100);
          const drawW = rockSprite.width * rScale;
          const drawH = rockSprite.height * rScale;
          const flipX = (subHash & 2) !== 0 ? -1 : 1;
          const tilt = Math.max(-0.36, Math.min(0.36, segSlope * 0.42));

          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(tilt);
          ctx.scale(flipX, 1);
          ctx.globalAlpha = Math.max(0.22, 0.38 - ot * 0.04);
          ctx.drawImage(rockSprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
          ctx.restore();
        }
      }
    }
  }

  // 退出主海床山体内部 Clip
  ctx.restore();

  // ==========================================================================
  // 3. 沿 25m 曲线细分主海床采样绘制最顶层手绘海床表层轮廓材质 (`world_seabed_strips`)
  // ==========================================================================
  if (stripCoral || stripRocky || stripCanyon || stripAbyss) {
    for (let i = 0; i < samplePoints.length - 1; i++) {
      const p0 = samplePoints[i];
      const p1 = samplePoints[i + 1];
      const ex0 = p0.worldX / WORLD_UNITS_PER_METER;
      const ey0 = p0.floorY / WORLD_UNITS_PER_METER;
      const ex1 = p1.worldX / WORLD_UNITS_PER_METER;
      const ey1 = p1.floorY / WORLD_UNITS_PER_METER;
      const fullW = ex1 - ex0;
      if (fullW <= 0) continue;
      if (Math.min(ey0, ey1) - crestLift > maxEngineY + 60) continue;

      const subW = fullW / SUB_STEPS;
      let prevSubX = ex0;
      let prevSubY = ey0;
      for (let s = 1; s <= SUB_STEPS; s++) {
        const nextSubX = ex0 + subW * s;
        const nextSubY = evalSubSegmentEngineY(i, s);
        const subSlope = (nextSubY - prevSubY) / subW;
        const segDepthM = (prevSubY + nextSubY) * 0.5;

        // 当主海床斜坡处于任一层连续阶梯海床的融合山根内部 ([graftStartMainY, graftFuseMainY + 5]) 时，隐去内部表层线，使其与上方阶梯海床断面无缝融为一体
        let surfaceAlpha = 1;
        if (config.terrain.minFloorDepth <= 600) {
          for (let tIdx = 0; tIdx < SEABED_TERRACE_TIERS.length; tIdx++) {
            const tier = SEABED_TERRACE_TIERS[tIdx];
            if (
              segDepthM > tier.graftStartMainY &&
              segDepthM < tier.graftFuseMainY + 5
            ) {
              const midWorldX = (prevSubX + nextSubX) * 0.5 * WORLD_UNITS_PER_METER;
              const terraceHere = getSeabedTerraceAt(midWorldX, tIdx, config);
              if (
                terraceHere.active &&
                !isTerraceCellBreached(tIdx, midWorldX, params.breachedTerraceCells) &&
                terraceHere.topFloorY < segDepthM - 4
              ) {
                const fadeInEnd = tier.graftStartMainY + 52;
                const fadeOutStart = tier.graftFuseMainY - 42;
                const tierAlpha =
                  segDepthM < fadeInEnd
                    ? 1 - quinticSmoothstep(tier.graftStartMainY, fadeInEnd, segDepthM)
                    : segDepthM > fadeOutStart
                    ? quinticSmoothstep(fadeOutStart, tier.graftFuseMainY + 5, segDepthM)
                    : 0;
                surfaceAlpha = Math.min(surfaceAlpha, tierAlpha);
              }
            }
          }
        }

        if (surfaceAlpha > 0.01) {
          const { primary, secondary, blend } = resolveStripPairForDepth(
            segDepthM,
            stripCoral,
            stripRocky,
            stripCanyon,
            stripAbyss
          );

          if (primary && secondary && blend > 0.02) {
            drawSeamlessShearedStrip(
              primary,
              prevSubX,
              prevSubY - crestLift,
              subW,
              stripDrawH,
              subSlope,
              (1 - blend) * surfaceAlpha,
              0
            );
            drawSeamlessShearedStrip(
              secondary,
              prevSubX,
              prevSubY - crestLift,
              subW,
              stripDrawH,
              subSlope,
              blend * surfaceAlpha,
              0
            );
          } else if (primary) {
            drawSeamlessShearedStrip(
              primary,
              prevSubX,
              prevSubY - crestLift,
              subW,
              stripDrawH,
              subSlope,
              surfaceAlpha,
              0
            );
          }
        }
        prevSubX = nextSubX;
        prevSubY = nextSubY;
      }
    }
  }

  ctx.restore();
  } finally {
    ctx.restore();
  }
}

