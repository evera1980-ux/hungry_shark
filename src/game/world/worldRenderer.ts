import { MIN_RENDER_ZOOM_FLOOR, meterDepthToWorldY } from '../rules';
import {
  WorldConfig,
  WORLD_UNITS_PER_METER,
  engineXToWorldX,
  worldXToEngineX,
  mixSubsystemSeed,
} from './worldCore';
import {
  getTerrainSlopeAt,
  getEngineFloorDepthAt,
  SEABED_TERRACE_TIERS,
  getShallowCoralAtollOutcropsForChunk,
  isTerraceCellBreached,
} from './terrainSystem';
import {
  BiomeId,
  getBiomeAt,
} from './biomeSystem';
import {
  EcologyObjectType,
  ECOLOGY_OBJECT_CONFIGS,
  GeneratedChunkData,
} from './ecologyAndPoi';
import {
  hashToUint32,
  performanceDegradationController,
} from './chunkStateAndPersistence';
import {
  WorldAssetRegistry,
  worldAssetRegistry,
} from './worldAssetRegistry';

const scratchActiveChunkRenderedIds = new Set<string>();

/**
 * 规范第 11 / 13 节：WorldRenderer
 * 负责将激活态 Chunk 的四层复合珊瑚礁盘、岩石附生群落、连底海底珊瑚礁柱、热液喷口与大型地标 POI 在 1.0x 世界层绘制
 * 核心生态铁律：任何珊瑚、海葵、海绵、岩石与海草严禁悬空漂浮在海水中，必须 100% 嵌入海底地形、附着在礁石/沉船上、或层叠构成复合大珊瑚礁盘！
 */
export class WorldRenderer {
  private readonly assetRegistry: WorldAssetRegistry;

  constructor(assetRegistry: WorldAssetRegistry = worldAssetRegistry) {
    this.assetRegistry = assetRegistry;
  }

  /**
   * 辅助绘制单个底部中心锚定的精灵贴图（若贴图尚未加载完则安全回退矢量块）
   * 原点 (0, 0) 为贴附表面，sinkRatio 控制底部深入基岩/宿主礁石内部的嵌合比例（彻底消除接缝悬空）
   */
  private drawBottomAnchoredSprite(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement | null,
    localX: number,
    localY: number,
    targetH: number,
    sinkRatio: number,
    tiltRad: number = 0,
    flipX: boolean = false,
    fallbackColor: string = '#475569'
  ): { width: number; height: number } {
    ctx.save();
    ctx.translate(localX, localY);
    if (tiltRad !== 0) ctx.rotate(tiltRad);
    if (flipX) ctx.scale(-1, 1);

    if (sprite && sprite.width > 0 && sprite.height > 0) {
      const aspect = sprite.width / sprite.height;
      const drawH = targetH;
      const drawW = drawH * aspect;
      const sinkPx = drawH * sinkRatio;
      ctx.drawImage(sprite, -drawW * 0.5, -drawH + sinkPx, drawW, drawH);
      ctx.restore();
      return { width: drawW, height: drawH };
    }

    const drawW = targetH * 1.15;
    const drawH = targetH;
    ctx.fillStyle = fallbackColor;
    ctx.beginPath();
    ctx.arc(0, -drawH * 0.35, drawW * 0.45, Math.PI, 0, false);
    ctx.lineTo(drawW * 0.48, drawH * 0.2);
    ctx.lineTo(-drawW * 0.48, drawH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return { width: drawW, height: drawH };
  }

  /**
   * 写实复合珊瑚礁群落渲染器 (Standalone @3x Coral Reef Cluster Renderer)
   * 直接使用完整的 `ecology_coral_reef_cluster.png`（自带天然礁石底座、鹿角珊瑚、脑珊瑚、柳珊瑚海扇与管状海绵），不切图。
   */
  private renderCompositeCoralReefMound(
    ctx: CanvasRenderingContext2D,
    anchorEngineX: number,
    anchorFloorEngineY: number,
    localSlope: number,
    scale: number,
    seedHash: number,
    _biomeId: BiomeId,
    nowSec: number,
    skipBgAnim: boolean
  ): void {
    const clampedScale = Math.max(0.24, Math.min(1.12, scale * 0.82));
    const slopeAngle = Math.atan2(localSlope, 1) * 0.68;
    const reefSpanHalfW = 28 * clampedScale;
    const slopeEmbedSink = Math.abs(localSlope) * reefSpanHalfW + 8 * clampedScale;

    const sway = skipBgAnim
      ? 0
      : Math.sin(nowSec * 1.35 + (seedHash % 97) * 0.065) * 0.025;

    const mainCoralSprite = this.assetRegistry.getSpriteCanvas('eco_coral_cluster');

    ctx.save();
    ctx.translate(anchorEngineX, anchorFloorEngineY + slopeEmbedSink);
    ctx.rotate(slopeAngle);

    // 1. 礁盘底部接触环境光遮蔽阴影 (Contact Ambient Occlusion)
    ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * clampedScale, 32 * clampedScale, 6.5 * clampedScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 完整写实珊瑚礁群落主体（自带礁石基座，底部深嵌海床 28%）
    this.drawBottomAnchoredSprite(
      ctx,
      mainCoralSprite,
      0,
      2 * clampedScale,
      44 * clampedScale,
      0.28,
      sway * 0.4,
      (seedHash & 8) !== 0,
      '#fb7185'
    );

    ctx.restore();
  }

  /**
   * 写实海底岩礁露头与沉船残骸渲染器 (Standalone @3x Rock Outcrop & Debris Renderer)
   * 直接使用完整的 `ecology_rocky_outcrop.png` 与 `ecology_abyssal_vent_debris.png`，不切图。
   */
  private renderAnchoredRockOrDebrisWithEpifauna(
    ctx: CanvasRenderingContext2D,
    objType: 'rock' | 'shipwreck_debris',
    variant: string | undefined,
    anchorEngineX: number,
    anchorFloorEngineY: number,
    localSlope: number,
    scale: number,
    seedHash: number,
    _biomeId: BiomeId,
    _nowSec: number,
    _skipBgAnim: boolean
  ): void {
    const assetKey = objType === 'rock' ? 'eco_seabed_rock' : 'eco_shipwreck_debris';
    const mainSprite = this.assetRegistry.getSpriteCanvas(assetKey, variant);
    const clampedScale = Math.max(0.24, Math.min(1.08, scale * 0.80));
    const slopeAngle = Math.atan2(localSlope, 1) * 0.65;
    const baseH = (objType === 'shipwreck_debris' ? 42 : 44) * clampedScale;
    const slopeEmbedSink = Math.abs(localSlope) * (baseH * 0.45) + 7 * clampedScale;

    ctx.save();
    ctx.translate(anchorEngineX, anchorFloorEngineY + slopeEmbedSink);
    ctx.rotate(slopeAngle);

    // 1. 底部接触阴影
    ctx.fillStyle = 'rgba(2, 6, 23, 0.40)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * clampedScale, 28 * clampedScale, 6 * clampedScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 绘制完整岩石或残骸主体
    this.drawBottomAnchoredSprite(
      ctx,
      mainSprite,
      0,
      2 * clampedScale,
      baseH,
      0.28,
      0,
      (seedHash & 2) !== 0,
      '#475569'
    );

    ctx.restore();
  }

  /**
   * 连底海底珊瑚礁孤峰与阶梯礁崖渲染器 (Terrain-Connected Reef Seamounts & Stepped Coral Pillars)
   * 解决浅海/中层水域（150m ~ 900m）离主海床（1100m+）较远时缺乏地形载体的问题：
   * 每隔固定水平晶格生成一座从下方主海床基岩一路向上耸立的厚重层状岩柱/礁台（底部直通主海床，绝不悬空），
   * 并在岩柱顶部的礁台和侧面阶梯岩架上层层堆叠 4 层复合大珊瑚礁盘！
   */
  private renderTerrainConnectedReefSeamounts(
    ctx: CanvasRenderingContext2D,
    minEngineX: number,
    maxEngineX: number,
    minEngineY: number,
    maxEngineY: number,
    nowSec: number,
    skipBgAnim: boolean
  ): number {
    const cellSpanM = 340; // 每 340m 水平晶格评估一座连底海底珊瑚礁柱/礁台
    const firstCell = Math.floor(minEngineX / cellSpanM) - 1;
    const lastCell = Math.ceil(maxEngineX / cellSpanM) + 1;
    let drawnSeamounts = 0;

    const slabSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
    const boulderSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'basalt_boulder');

    for (let cellIdx = firstCell; cellIdx <= lastCell; cellIdx++) {
      const cellSeed = mixSubsystemSeed(
        WorldConfig.worldSeed,
        WorldConfig.generatorVersion,
        cellIdx,
        77,
        'flora'
      );
      // 约 72% 晶格生成连底珊瑚礁孤峰，保留自然开阔水道
      if ((cellSeed % 100) >= 72) continue;

      const jitterM = (((cellSeed >>> 8) % 1000) / 1000 - 0.5) * (cellSpanM * 0.52);
      const centerEngineX = (cellIdx + 0.5) * cellSpanM + jitterM;
      const worldX = engineXToWorldX(centerEngineX);
      const floorEngineY = getEngineFloorDepthAt(centerEngineX);
      const biomeSample = getBiomeAt(worldX, meterDepthToWorldY(320), WorldConfig);
      const primaryBiome = biomeSample.primaryBiome;

      // 外海深水区 (open_ocean) 与极深渊减少浅层礁台，保持开阔感
      if (primaryBiome === 'open_ocean' && (cellSeed % 3) !== 0) continue;

      // 根据生态区确定礁台顶部深度 crestEngineY（浅海珊瑚礁在 250m ~ 510m 阳光带，岩架/峡谷在 380m ~ 780m）
      const depthNorm = ((cellSeed >>> 16) % 1000) / 1000;
      const crestEngineY =
        primaryBiome === 'coral_reef'
          ? 250 + depthNorm * 250
          : primaryBiome === 'rocky_shelf'
          ? 310 + depthNorm * 340
          : 420 + depthNorm * 380;

      // 礁台必须位于主海床之上至少 120m 才有必要建立耸立礁柱
      if (crestEngineY >= floorEngineY - 120) continue;

      const topWidthM = 115 + ((cellSeed >>> 20) % 75); // 顶部礁盘宽 115m ~ 190m
      const baseWidthM = topWidthM * 2.35;
      // 视锥裁剪：若整座孤峰（从 crestEngineY - 90m 到 floorEngineY）不在视野内则跳过
      if (
        centerEngineX + baseWidthM * 0.6 < minEngineX ||
        centerEngineX - baseWidthM * 0.6 > maxEngineX ||
        floorEngineY < minEngineY - 60 ||
        crestEngineY - 95 > maxEngineY
      ) {
        continue;
      }

      const pillarBottomY = Math.min(floorEngineY + 35, maxEngineY + 180);
      const pillarHeight = Math.max(80, pillarBottomY - crestEngineY);

      ctx.save();

      // 1. 绘制直通海底基岩的厚重阶梯状珊瑚礁岩柱本体 (Solid Stepped Reef Seamount Pillar)
      const pillarGrad = ctx.createLinearGradient(0, crestEngineY, 0, pillarBottomY);
      if (primaryBiome === 'coral_reef') {
        pillarGrad.addColorStop(0, '#4a3525');
        pillarGrad.addColorStop(0.28, '#2d211b');
        pillarGrad.addColorStop(1, '#0f141c');
      } else if (primaryBiome === 'underwater_canyon') {
        pillarGrad.addColorStop(0, '#1e293b');
        pillarGrad.addColorStop(0.35, '#0f172a');
        pillarGrad.addColorStop(1, '#020617');
      } else {
        pillarGrad.addColorStop(0, '#334155');
        pillarGrad.addColorStop(0.35, '#1e293b');
        pillarGrad.addColorStop(1, '#090d16');
      }

      ctx.fillStyle = pillarGrad;
      ctx.beginPath();
      const halfTop = topWidthM * 0.5;
      const halfMid = topWidthM * 0.78;
      const halfBase = baseWidthM * 0.55;
      const midY1 = crestEngineY + pillarHeight * 0.32;
      const midY2 = crestEngineY + pillarHeight * 0.68;

      ctx.moveTo(centerEngineX - halfTop, crestEngineY + 6);
      ctx.lineTo(centerEngineX + halfTop, crestEngineY + 6);
      ctx.lineTo(centerEngineX + halfMid, midY1);
      ctx.lineTo(centerEngineX + halfBase * 0.88, midY2);
      ctx.lineTo(centerEngineX + halfBase, pillarBottomY);
      ctx.lineTo(centerEngineX - halfBase, pillarBottomY);
      ctx.lineTo(centerEngineX - halfBase * 0.88, midY2);
      ctx.lineTo(centerEngineX - halfMid, midY1);
      ctx.closePath();
      ctx.fill();

      // 岩柱内部层状地质阴影脉络（增强厚重岩石体块感）
      ctx.fillStyle = 'rgba(2, 6, 23, 0.34)';
      ctx.beginPath();
      ctx.moveTo(centerEngineX + halfTop * 0.15, crestEngineY + 8);
      ctx.lineTo(centerEngineX + halfTop, crestEngineY + 6);
      ctx.lineTo(centerEngineX + halfMid, midY1);
      ctx.lineTo(centerEngineX + halfBase, pillarBottomY);
      ctx.lineTo(centerEngineX + halfBase * 0.1, pillarBottomY);
      ctx.closePath();
      ctx.fill();

      // 2. 在岩柱中段两侧突出阶梯岩架 (Stepped Rock Ledges)，并在岩架上附着次级珊瑚礁簇
      const leftLedgeX = centerEngineX - halfMid * 0.82;
      const leftLedgeY = crestEngineY + Math.min(115, pillarHeight * 0.28);
      const rightLedgeX = centerEngineX + halfMid * 0.82;
      const rightLedgeY = crestEngineY + Math.min(145, pillarHeight * 0.36);

      if (leftLedgeY >= minEngineY - 80 && leftLedgeY <= maxEngineY + 80) {
        this.drawBottomAnchoredSprite(
          ctx,
          slabSprite,
          leftLedgeX,
          leftLedgeY + 10,
          36,
          0.35,
          -0.12,
          false,
          '#334155'
        );
        this.renderCompositeCoralReefMound(
          ctx,
          leftLedgeX,
          leftLedgeY,
          -0.18,
          0.78,
          cellSeed ^ 0x13579bdf,
          primaryBiome,
          nowSec,
          skipBgAnim
        );
      }

      if (rightLedgeY >= minEngineY - 80 && rightLedgeY <= maxEngineY + 80) {
        this.drawBottomAnchoredSprite(
          ctx,
          boulderSprite,
          rightLedgeX,
          rightLedgeY + 10,
          34,
          0.35,
          0.14,
          true,
          '#334155'
        );
        this.renderCompositeCoralReefMound(
          ctx,
          rightLedgeX,
          rightLedgeY,
          0.18,
          0.74,
          cellSeed ^ 0x2468ace0,
          primaryBiome,
          nowSec,
          skipBgAnim
        );
      }

      // 3. 在礁台顶部铺设海床岩壳条带 (`seabed_strip_*`) 与四层复合主珊瑚礁群落
      const stripCanvas = this.assetRegistry.getSeabedStripCanvas(primaryBiome);
      if (stripCanvas) {
        ctx.drawImage(
          stripCanvas,
          0,
          0,
          stripCanvas.width,
          stripCanvas.height,
          centerEngineX - halfTop * 1.06,
          crestEngineY - 12,
          topWidthM * 1.06,
          42
        );
      }

      // 礁台顶部左、中、右连续堆叠 2~3 组复合大珊瑚礁盘，形成壮观的连片大珊瑚礁台地
      this.renderCompositeCoralReefMound(
        ctx,
        centerEngineX - halfTop * 0.42,
        crestEngineY + 2,
        -0.08,
        0.92,
        cellSeed ^ 0x9e3779b9,
        primaryBiome,
        nowSec,
        skipBgAnim
      );
      this.renderCompositeCoralReefMound(
        ctx,
        centerEngineX + halfTop * 0.42,
        crestEngineY + 3,
        0.08,
        0.90,
        cellSeed ^ 0x85ebca6b,
        primaryBiome,
        nowSec,
        skipBgAnim
      );
      this.renderCompositeCoralReefMound(
        ctx,
        centerEngineX,
        crestEngineY - 4,
        0,
        1.14,
        cellSeed,
        primaryBiome,
        nowSec,
        skipBgAnim
      );

      ctx.restore();
      drawnSeamounts += 1;
    }

    return drawnSeamounts;
  }

  /**
   * 渲染当前所有 Active Chunk 中的 POI 与海床附着生态实体（1.0x 物理世界同源坐标）
   */
  public renderActiveChunkEntities(
    ctx: CanvasRenderingContext2D,
    viewport: {
      cameraEngineX: number;
      cameraEngineY: number;
      viewW: number;
      viewH: number;
      renderZoom: number;
      relativePreyScale?: number;
      breachedTerraceCells?: ReadonlySet<string>;
      nowMs?: number;
    },
    activeChunks: ReadonlyArray<GeneratedChunkData>
  ): number {
    if (!activeChunks || activeChunks.length === 0) return 0;
    this.assetRegistry.ensureAtlasesLoaded();

    const zoom = Math.max(MIN_RENDER_ZOOM_FLOOR, viewport.renderZoom);
    const halfW = viewport.viewW / (2 * zoom) + 260;
    const halfH = viewport.viewH / (2 * zoom) + 260;
    const minEngineX = viewport.cameraEngineX - halfW;
    const maxEngineX = viewport.cameraEngineX + halfW;
    const minEngineY = viewport.cameraEngineY - halfH;
    const maxEngineY = viewport.cameraEngineY + halfH;
    const nowSec = (viewport.nowMs ?? 0) * 0.001;

    const skipDistantDecorations = performanceDegradationController.isDegraded('distant_decorations');
    const skipBgAnim = performanceDegradationController.isDegraded('background_animations');

    const renderedIds = scratchActiveChunkRenderedIds;
    renderedIds.clear();
    let drawnCount = 0;

    ctx.save();

    // 0. 绘制全水深 9 级非均匀渐进间距连续阶梯海床 (`SEABED_TERRACE_TIERS`) 顶面附着生长的复合珊瑚礁盘、共生礁石与海草群落：
    // 自动跳过已被巨鲨撞碎的局部破损格，杜绝浮空装饰物；同时按真相机缩放自动剔除 <5px 微海草以稳守 60FPS。
    if (minEngineY <= 18000 && maxEngineY >= 240) {
      const minAtollChunkX = Math.floor((minEngineX * WORLD_UNITS_PER_METER) / WorldConfig.chunk.width);
      const maxAtollChunkX = Math.floor((maxEngineX * WORLD_UNITS_PER_METER) / WorldConfig.chunk.width);

      for (let cx = minAtollChunkX; cx <= maxAtollChunkX; cx++) {
        const outcrops = getShallowCoralAtollOutcropsForChunk(cx, WorldConfig);
        for (let i = 0; i < outcrops.length; i++) {
          const item = outcrops[i];
          if (renderedIds.has(item.id)) continue;
          if (
            item.tierIndex !== undefined &&
            isTerraceCellBreached(item.tierIndex, item.worldX, viewport.breachedTerraceCells)
          ) {
            continue;
          }
          const ex = worldXToEngineX(item.worldX);
          const ey = item.floorY;
          if (
            ex < minEngineX ||
            ex > maxEngineX ||
            ey < minEngineY - 120 ||
            ey > maxEngineY + 120
          ) {
            continue;
          }
          if (
            skipDistantDecorations &&
            Math.hypot(ex - viewport.cameraEngineX, ey - viewport.cameraEngineY) * zoom > 680
          ) {
            continue;
          }
          const scaledOutcropScale = item.scale;
          if (item.type === 'seagrass' && 44 * scaledOutcropScale * zoom < 5) {
            continue;
          }
          renderedIds.add(item.id);

          if (item.type === 'coral') {
            this.renderCompositeCoralReefMound(
              ctx,
              ex,
              ey,
              item.slope,
              scaledOutcropScale,
              item.seedHash,
              item.biomeId,
              nowSec,
              skipBgAnim
            );
            drawnCount += 1;
          } else if (item.type === 'rock') {
            this.renderAnchoredRockOrDebrisWithEpifauna(
              ctx,
              'rock',
              item.variant,
              ex,
              ey,
              item.slope,
              scaledOutcropScale,
              item.seedHash,
              item.biomeId,
              nowSec,
              skipBgAnim
            );
            drawnCount += 1;
          } else {
            const grassSprite = this.assetRegistry.getSpriteCanvas('eco_seagrass_bed', item.variant);
            const slopeAngle = Math.atan2(item.slope, 1) * 0.62;
            const sway = skipBgAnim
              ? 0
              : Math.sin(nowSec * 1.55 + (item.seedHash % 100) * 0.063) * 0.075;
            const slopeEmbedSink = Math.abs(item.slope) * (20 * scaledOutcropScale) + 6 * scaledOutcropScale;
            ctx.save();
            ctx.translate(ex, ey + slopeEmbedSink);
            ctx.rotate(slopeAngle);
            this.drawBottomAnchoredSprite(
              ctx,
              grassSprite,
              0,
              0,
              44 * scaledOutcropScale,
              0.26,
              sway,
              (item.seedHash & 2) !== 0,
              '#10b981'
            );
            ctx.restore();
            drawnCount += 1;
          }
        }
      }
    }

    for (const chunk of activeChunks) {
      // 1. 绘制海床栖息生态群落（写实珊瑚礁群落、海床礁石、海草巨藻、深渊热液喷口与残骸）
      for (const obj of chunk.ecologyObjects) {
        if (renderedIds.has(obj.id)) continue;
        const objCfg = ECOLOGY_OBJECT_CONFIGS[obj.type as EcologyObjectType];
        // 严禁将水体游动生物 (fauna: fish_school / jellyfish / biolum_organism) 或浮游微粒当成静态珊瑚/岩石画在半空中！
        if (!objCfg || objCfg.category === 'fauna') continue;
        if (obj.type === 'plankton_mote' || obj.type === 'marine_snow') continue;

        const ex = worldXToEngineX(obj.worldX);
        // 强制铁律：所有海床物体的根部 Y 坐标 100% 锁定在精确的海床表面 getEngineFloorDepthAt(ex)，绝不使用可能悬空的 obj.worldY！
        const floorEngineY = getEngineFloorDepthAt(ex);
        const localSlope = getTerrainSlopeAt(obj.worldX);

        if (
          ex < minEngineX ||
          ex > maxEngineX ||
          floorEngineY < minEngineY - 120 ||
          floorEngineY > maxEngineY + 120
        ) {
          continue;
        }

        if (
          skipDistantDecorations &&
          Math.hypot(ex - viewport.cameraEngineX, floorEngineY - viewport.cameraEngineY) * zoom > 680
        ) {
          continue;
        }

        const seedHash = hashToUint32(obj.id);
        const s = Math.max(0.72, Math.min(1.65, obj.scale ?? 1));
        if (obj.type === 'seagrass' && 44 * s * zoom < 5) {
          continue;
        }
        renderedIds.add(obj.id);
        const biomeId = (obj.biomeId as BiomeId) || 'coral_reef';

        // 1A. 珊瑚节点 -> 渲染完整写实珊瑚礁群落 (`ecology_coral_reef_cluster.png`)
        if (obj.type === 'coral') {
          this.renderCompositeCoralReefMound(
            ctx,
            ex,
            floorEngineY,
            localSlope,
            s,
            seedHash,
            biomeId,
            nowSec,
            skipBgAnim
          );
          drawnCount += 1;
          continue;
        }

        // 1B. 海床岩石与沉船残骸 -> 渲染完整写实礁石 (`ecology_rocky_outcrop.png`) 或热液残骸 (`ecology_abyssal_vent_debris.png`)
        if (obj.type === 'rock' || obj.type === 'shipwreck_debris') {
          this.renderAnchoredRockOrDebrisWithEpifauna(
            ctx,
            obj.type,
            obj.variant,
            ex,
            floorEngineY,
            localSlope,
            s,
            seedHash,
            biomeId,
            nowSec,
            skipBgAnim
          );
          drawnCount += 1;
          continue;
        }

        // 1C. 海草/巨藻与海底热液/裂隙喷口 -> 自带天然礁石底座，直接 100% 嵌入海床 floorEngineY
        const assetKey = objCfg.assetKey;
        const spriteCanvas = this.assetRegistry.getSpriteCanvas(assetKey, obj.variant);
        const slopeAngle = Math.atan2(localSlope, 1) * 0.62;
        const sway =
          skipBgAnim || obj.type !== 'seagrass'
            ? 0
            : Math.sin(nowSec * 1.55 + (seedHash % 100) * 0.063) * 0.075;
        const slopeEmbedSink = Math.abs(localSlope) * (20 * s) + 6 * s;

        ctx.save();
        ctx.translate(ex, floorEngineY + slopeEmbedSink);
        ctx.rotate(slopeAngle);

        // 海草群或喷口主体（自带天然岩石底座）
        this.drawBottomAnchoredSprite(
          ctx,
          spriteCanvas,
          0,
          0,
          (obj.type === 'seagrass' ? 44 : 42) * s,
          0.26,
          sway,
          (seedHash & 2) !== 0,
          obj.type === 'seagrass' ? '#10b981' : '#38bdf8'
        );

        ctx.restore();
        drawnCount += 1;
      }

      // 2. 绘制大型 POI 地标（包含跨 Chunk 共享引用的 POI，100% 锚定于海床 floorEngineY 并铺设基岩托底）
      const allPois =
        chunk.overlappingPOIs.length > 0
          ? [...chunk.pois, ...chunk.overlappingPOIs]
          : chunk.pois;
      for (const poi of allPois) {
        if (renderedIds.has(poi.id)) continue;
        const ex = worldXToEngineX(poi.worldX);
        const floorEngineY = getEngineFloorDepthAt(ex);
        const localSlope = getTerrainSlopeAt(poi.worldX);
        if (
          ex < minEngineX ||
          ex > maxEngineX ||
          floorEngineY < minEngineY - 160 ||
          floorEngineY > maxEngineY + 160
        ) {
          continue;
        }

        renderedIds.add(poi.id);
        const desc = this.assetRegistry.getAssetOrPlaceholder(poi.assetKey, 'poi');
        const poiSprite = this.assetRegistry.getSpriteCanvas(poi.assetKey, poi.variant);
        const slabSprite = this.assetRegistry.getSpriteCanvas('eco_seabed_rock', 'mossy_slab');
        const targetWidthEng = Math.max(58, Math.min(126, poi.width * 0.145));
        const radiusEng = targetWidthEng * 0.5;
        const poiStatus = poi.poiState ?? (poi.state?.status as string | undefined) ?? 'unvisited';
        const isDepleted = poiStatus === 'depleted' || poiStatus === 'interacted';
        const slopeAngle = Math.atan2(localSlope, 1) * 0.55;
        const slopeEmbedSink = Math.abs(localSlope) * radiusEng * 0.65 + 8;

        ctx.save();
        ctx.translate(ex, floorEngineY + slopeEmbedSink);
        ctx.rotate(slopeAngle);

        // 环境氛围柔光底座
        const glowRadius = radiusEng * (isDepleted ? 0.85 : 1.25);
        const grad = ctx.createRadialGradient(0, -radiusEng * 0.35, radiusEng * 0.15, 0, -radiusEng * 0.35, glowRadius);
        grad.addColorStop(
          0,
          isDepleted
            ? 'rgba(148, 163, 184, 0.14)'
            : poi.type === 'treasure'
            ? 'rgba(251, 191, 36, 0.28)'
            : poi.type === 'rare_creature_nest'
            ? 'rgba(192, 132, 252, 0.26)'
            : 'rgba(56, 189, 248, 0.22)'
        );
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -radiusEng * 0.35, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 地标底层承重礁盘基座
        this.drawBottomAnchoredSprite(
          ctx,
          slabSprite,
          0,
          6,
          radiusEng * 0.72,
          0.38,
          0,
          false,
          '#334155'
        );

        if (poiSprite && poiSprite.width > 0 && poiSprite.height > 0) {
          const aspect = poiSprite.width / poiSprite.height;
          const drawW = targetWidthEng * (poi.scale ?? 1);
          const drawH = drawW / Math.max(0.35, aspect);
          if (isDepleted) {
            ctx.globalAlpha = 0.68;
          }
          // 底部深深嵌入海床基座
          ctx.drawImage(
            poiSprite,
            -drawW * 0.5,
            -drawH * 0.76,
            drawW,
            drawH
          );
        } else {
          ctx.fillStyle = isDepleted ? '#475569' : desc.primaryColor;
          ctx.strokeStyle = isDepleted ? '#94a3b8' : desc.secondaryColor;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          if (poi.type === 'shipwreck') {
            ctx.moveTo(-radiusEng * 0.9, -radiusEng * 0.45);
            ctx.lineTo(radiusEng * 0.95, -radiusEng * 0.55);
            ctx.lineTo(radiusEng * 0.65, radiusEng * 0.12);
            ctx.lineTo(-radiusEng * 0.7, radiusEng * 0.12);
            ctx.closePath();
          } else if (poi.type === 'treasure') {
            ctx.roundRect(-radiusEng * 0.55, -radiusEng * 0.7, radiusEng * 1.1, radiusEng * 0.8, 6);
          } else {
            ctx.arc(0, -radiusEng * 0.25, radiusEng * 0.62, Math.PI, 0, false);
            ctx.lineTo(radiusEng * 0.72, radiusEng * 0.1);
            ctx.lineTo(-radiusEng * 0.72, radiusEng * 0.1);
            ctx.closePath();
          }
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
        drawnCount += 1;
      }
    }

    ctx.restore();
    return drawnCount;
  }
}

export const worldRenderer = new WorldRenderer(worldAssetRegistry);

