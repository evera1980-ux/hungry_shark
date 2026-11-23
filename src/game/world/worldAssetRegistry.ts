import {
  BiomeId,
} from './biomeSystem';
import {
  ECOLOGY_OBJECT_CONFIGS,
  POI_CONFIGS,
} from './ecologyAndPoi';

// ============================================================================
// 阶段 F：资源注册、占位符回退与 1.0x 激活态渲染器 (WorldAssetRegistry & WorldRenderer, 规范第 11、13、14-F 节)
// ============================================================================

/**
 * 规范第 11 节：5 层视差系数定义
 * 地形海床、POI、生态交互物严格位于 world_main (1.0x)
 */
export const PARALLAX_LAYER_FACTORS = {
  far_silhouette: 0.08,
  mid_terrain: 0.18,
  sub_mid_shadow: 0.35,
  world_main: 1.0,
  foreground_particles: 1.12,
} as const;

export interface WorldAssetDescriptor {
  assetKey: string;
  category: 'flora' | 'fauna' | 'ambient' | 'poi' | 'terrain';
  primaryColor: string;
  secondaryColor: string;
  glowColor?: string;
  shape: 'kelp' | 'coral' | 'vent' | 'sponge' | 'rock' | 'shipwreck' | 'cave' | 'treasure' | 'nest' | 'landmark' | 'generic';
  isPlaceholder: boolean;
}

export const WORLD_SEABED_STRIP_URLS = {
  coral_reef: '/assets/aistudio/seabed_strip_coral_reef.webp',
  rocky_shelf: '/assets/aistudio/seabed_strip_rocky_shelf.webp',
  underwater_canyon: '/assets/aistudio/seabed_strip_underwater_canyon.webp',
  deep_abyss: '/assets/aistudio/seabed_strip_deep_abyss.webp',
} as const;

export const WORLD_ECOLOGY_SPRITE_URLS = {
  coral_reef_cluster: '/assets/aistudio/ecology_coral_reef_cluster.webp',
  rocky_outcrop: '/assets/aistudio/ecology_rocky_outcrop.webp',
  kelp_forest_cluster: '/assets/aistudio/ecology_kelp_forest_cluster.webp',
  abyssal_vent_debris: '/assets/aistudio/ecology_abyssal_vent_debris.webp',
} as const;

export const WORLD_ATLAS_ASSET_URLS = {
  seabedStrips: WORLD_SEABED_STRIP_URLS.coral_reef,
  seabedStripCoralReef: WORLD_SEABED_STRIP_URLS.coral_reef,
  seabedStripRockyShelf: WORLD_SEABED_STRIP_URLS.rocky_shelf,
  seabedStripUnderwaterCanyon: WORLD_SEABED_STRIP_URLS.underwater_canyon,
  seabedStripDeepAbyss: WORLD_SEABED_STRIP_URLS.deep_abyss,
  poisAtlas: '/assets/aistudio/world_pois_atlas_1794473250443.webp',
  ecologyAtlas: '/assets/aistudio/world_ecology_atlas_1794473252524.webp',
  ecologyCoralReefCluster: WORLD_ECOLOGY_SPRITE_URLS.coral_reef_cluster,
  ecologyRockyOutcrop: WORLD_ECOLOGY_SPRITE_URLS.rocky_outcrop,
  ecologyKelpForestCluster: WORLD_ECOLOGY_SPRITE_URLS.kelp_forest_cluster,
  ecologyAbyssalVentDebris: WORLD_ECOLOGY_SPRITE_URLS.abyssal_vent_debris,
} as const;

/**
 * 离屏 BFS 连通域纯白背景抠图 + 抗锯齿白边解混 + 紧致包围盒裁切
 */
function sliceAndCleanWorldSpriteRegion(
  sourceImg: HTMLImageElement,
  normRect: readonly [number, number, number, number],
  cleanInteriorHoles: boolean = true,
  maxTargetDim: number = 360
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const [nx0, ny0, nx1, ny1] = normRect;
  const sx = Math.max(0, Math.floor(nx0 * natW));
  const sy = Math.max(0, Math.floor(ny0 * natH));
  const sw = Math.max(1, Math.min(natW - sx, Math.ceil((nx1 - nx0) * natW)));
  const sh = Math.max(1, Math.min(natH - sy, Math.ceil((ny1 - ny0) * natH)));

  const scale = Math.min(1, maxTargetDim / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * scale));
  const h = Math.max(8, Math.round(sh * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBgWhite = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= 224 && maxC - minC <= 26;
  };

  const enqueueIfBg = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    if (isBgWhite(idx)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    enqueueIfBg(x, 0);
    enqueueIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueueIfBg(0, y);
    enqueueIfBg(w - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    data[curr * 4 + 3] = 0;
    const cx = curr % w;
    const cy = (curr - cx) / w;
    if (cx > 0) enqueueIfBg(cx - 1, cy);
    if (cx < w - 1) enqueueIfBg(cx + 1, cy);
    if (cy > 0) enqueueIfBg(cx, cy - 1);
    if (cy < h - 1) enqueueIfBg(cx, cy + 1);
  }

  // 清理物体镂空处的纯白封闭背景孔洞（如铁锚链环、船舵辐条、珊瑚枝隙）
  if (cleanInteriorHoles) {
    for (let idx = 0; idx < total; idx++) {
      if (visited[idx]) continue;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC >= 242 && maxC - minC <= 14) {
        data[p + 3] = 0;
        visited[idx] = 1;
      }
    }
  }

  // 对紧邻透明背景的 2 层抗锯齿边缘执行 Color-to-Alpha 白边解混
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        if (data[p + 3] === 0) continue;
        const hasTransNeighbor =
          data[(idx - 1) * 4 + 3] === 0 ||
          data[(idx + 1) * 4 + 3] === 0 ||
          data[(idx - w) * 4 + 3] === 0 ||
          data[(idx + w) * 4 + 3] === 0;
        if (!hasTransNeighbor) continue;

        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);
        if (minC > 175) {
          const cleanAlpha = Math.max(0, Math.min(1, (248 - minC) / 145));
          const denom = Math.max(0.08, cleanAlpha);
          data[p] = Math.max(0, Math.min(255, Math.round((r - (1 - cleanAlpha) * 255) / denom)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - cleanAlpha) * 255) / denom)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - cleanAlpha) * 255) / denom)));
          data[p + 3] = Math.round(data[p + 3] * cleanAlpha);
        }
      }
    }
  }

  // 计算紧致包围盒
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    workCanvas.width = 0;
    workCanvas.height = 0;
    return null;
  }
  ctx.putImageData(imgData, 0, 0);

  const pad = 2;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return workCanvas;
  outCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  // 立即将临时工作 Canvas 尺寸清零，通知浏览器 GPU / 显存立即释放临时帧缓冲
  workCanvas.width = 0;
  workCanvas.height = 0;
  return outCanvas;
}

/**
 * 从独立的 2048x2048 (@3x) 写实透明背景海床生态 PNG 构建离屏精灵 Canvas：
 * 1) 针对深渊热液喷口 (`removeTopWhiteSmoke = true`) 自动滤除顶部亮白/浅灰静态烟团，消除深黑海床背景下的突兀白块；
 * 2) 底部 16% 岩石基座做余弦 Alpha 柔化渐隐，确保嵌入海床条带时无生硬裁切边缘。
 */
function prepareStandaloneEcologySpriteCanvas(
  sourceImg: HTMLImageElement,
  maxTargetDim: number = 380,
  removeTopWhiteSmoke: boolean = false
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const scale = Math.min(1, maxTargetDim / Math.max(natW, natH));
  const w = Math.max(16, Math.round(natW * scale));
  const h = Math.max(16, Math.round(natH * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, 0, 0, natW, natH, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  if (removeTopWhiteSmoke) {
    const smokeCutY = Math.floor(h * 0.28);
    for (let y = 0; y < smokeCutY; y++) {
      const vRatio = y / Math.max(1, smokeCutY);
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        const a = data[p + 3];
        if (a === 0) continue;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        if (vRatio < 0.62 || (minC > 95 && sat < 48) || (r > 135 && g > 115 && b > 105 && sat < 64)) {
          const keep = vRatio < 0.62 ? 0 : Math.max(0, Math.min(1, (vRatio - 0.62) / 0.38)) * 0.35;
          data[p + 3] = Math.round(a * keep);
        }
      }
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return work;
  }

  const boxH = Math.max(1, maxY - minY + 1);
  const featherStartY = minY + Math.floor(boxH * 0.84);
  for (let y = minY; y <= maxY; y++) {
    let baseFade = 1.0;
    if (y >= featherStartY) {
      const t = (y - featherStartY) / Math.max(1, maxY - featherStartY);
      baseFade = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, t * 0.82)));
    }
    for (let x = minX; x <= maxX; x++) {
      const p = (y * w + x) * 4;
      if (data[p + 3] === 0) continue;
      data[p] = Math.round(data[p] * 0.90);
      data[p + 1] = Math.round(data[p + 1] * 0.93);
      data[p + 2] = Math.round(Math.min(255, data[p + 2] * 0.96 + 6));
      data[p + 3] = Math.round(data[p + 3] * baseFade);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const pad = 2;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return work;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(work, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  work.width = 0;
  work.height = 0;
  return outCanvas;
}

/**
 * 从独立的 2048x1152 写实透明背景海床 PNG 直接构建高分辨率（1240px 宽）无缝海床表层轮廓条带
 * （无需再对单张四合一合集图做多行切图）
 */
function prepareStandaloneSeabedSurfaceCanvas(
  sourceImg: HTMLImageElement
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const w = 960;
  const h = 540;
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, 0, 0, natW, natH, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 定位整张透明背景海床图的最高非透明轮廓线 minTopY
  let minTopY = Math.floor(h * 0.24);
  for (let y = 0; y < h; y++) {
    let found = false;
    for (let x = 0; x < w; x += 4) {
      if (data[(y * w + x) * 4 + 3] > 32) {
        found = true;
        break;
      }
    }
    if (found) {
      minTopY = Math.max(0, y - 4);
      break;
    }
  }

  // 保留从顶部写实珊瑚/藤壶/化石/硫磺晶簇到下方岩唇的完整高清表层带（高度 200px）
  const outH = Math.min(200, h - minTopY);
  const overlap = Math.max(32, Math.floor(w * 0.12));
  const outW = w - overlap;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) {
    work.width = 0;
    work.height = 0;
    return null;
  }

  const outImg = outCtx.createImageData(outW, outH);
  const oData = outImg.data;
  const bottomFeatherStart = Math.floor(outH * 0.64);

  for (let y = 0; y < outH; y++) {
    const sy = Math.min(h - 1, minTopY + y);
    let bottomFade = 1.0;
    if (y >= bottomFeatherStart) {
      const ft = (y - bottomFeatherStart) / Math.max(1, outH - 1 - bottomFeatherStart);
      bottomFade = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, ft)));
    }

    for (let x = 0; x < outW; x++) {
      const dstIdx = (y * outW + x) * 4;
      if (x < overlap) {
        const t = x / overlap;
        const wA = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const wB = 1 - wA;
        const idxA = (sy * w + x) * 4;
        const idxB = (sy * w + (x + outW)) * 4;
        const aA = data[idxA + 3] / 255;
        const aB = data[idxB + 3] / 255;
        const outA = aA * wA + aB * wB;
        if (outA <= 0.005) {
          oData[dstIdx] = 0;
          oData[dstIdx + 1] = 0;
          oData[dstIdx + 2] = 0;
          oData[dstIdx + 3] = 0;
        } else {
          oData[dstIdx] = Math.round((data[idxA] * aA * wA + data[idxB] * aB * wB) / outA);
          oData[dstIdx + 1] = Math.round((data[idxA + 1] * aA * wA + data[idxB + 1] * aB * wB) / outA);
          oData[dstIdx + 2] = Math.round((data[idxA + 2] * aA * wA + data[idxB + 2] * aB * wB) / outA);
          oData[dstIdx + 3] = Math.round(outA * 255 * bottomFade);
        }
      } else {
        const idxA = (sy * w + x) * 4;
        oData[dstIdx] = data[idxA];
        oData[dstIdx + 1] = data[idxA + 1];
        oData[dstIdx + 2] = data[idxA + 2];
        oData[dstIdx + 3] = Math.round(data[idxA + 3] * bottomFade);
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  work.width = 0;
  work.height = 0;
  return outCanvas;
}

/**
 * 从独立的 2048x1152 写实透明背景海床 PNG 直接构建高分辨率「表层以下」无缝地质基岩条带
 * （自动检测每列真实不透明岩体上下界并从内部 2D 岩层采样，彻底杜绝透明空洞或 1D 纵向拉伸条纹）
 */
function prepareStandaloneSeabedSubsurfaceCanvas(
  sourceImg: HTMLImageElement
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const natW = sourceImg.naturalWidth || sourceImg.width;
  const natH = sourceImg.naturalHeight || sourceImg.height;
  if (natW <= 0 || natH <= 0) return null;

  const w = 960;
  const fullH = 540;
  const outH = 240;

  const work = document.createElement('canvas');
  work.width = w;
  work.height = fullH;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, 0, 0, natW, natH, 0, 0, w, fullH);

  const srcData = ctx.getImageData(0, 0, w, fullH).data;

  // 1. 逐列检测真实不透明岩层上下边界 [rawTopY, rawBotY] 并进行宽窗口水平平滑（保留 2D 纹理连续性）
  const rawTopY = new Float64Array(w);
  const rawBotY = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let top = Math.floor(fullH * 0.25);
    let bot = Math.floor(fullH * 0.72);
    for (let y = 0; y < fullH; y++) {
      if (srcData[(y * w + x) * 4 + 3] > 200) {
        top = y;
        break;
      }
    }
    for (let y = fullH - 1; y >= top; y--) {
      if (srcData[(y * w + x) * 4 + 3] > 200) {
        bot = y;
        break;
      }
    }
    if (bot <= top + 16) {
      top = Math.floor(fullH * 0.25);
      bot = Math.floor(fullH * 0.72);
    }
    rawTopY[x] = top;
    rawBotY[x] = bot;
  }

  const colTopY = new Float64Array(w);
  const colBotY = new Float64Array(w);
  const smoothRadius = 32;
  for (let x = 0; x < w; x++) {
    let sumT = 0;
    let sumB = 0;
    let cnt = 0;
    for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
      const sx = (x + dx + w) % w;
      sumT += rawTopY[sx];
      sumB += rawBotY[sx];
      cnt++;
    }
    colTopY[x] = sumT / cnt;
    colBotY[x] = Math.max(colTopY[x] + 24, sumB / cnt);
  }

  // 2. 从每列真实内部 2D 岩层区间 [top + 0.24*span, bot - 0.08*span] 采样构建 w x outH 基岩条带
  const bandRgba = new Uint8ClampedArray(w * outH * 4);
  for (let x = 0; x < w; x++) {
    const cTop = colTopY[x];
    const cBot = colBotY[x];
    const span = Math.max(24, cBot - cTop);
    const inTop = cTop + span * 0.24;
    const inBot = Math.max(inTop + 12, cBot - span * 0.08);
    const inSpan = Math.max(12, inBot - inTop);

    for (let y = 0; y < outH; y++) {
      const v = y / Math.max(1, outH - 1);
      let sy = Math.min(fullH - 1, Math.max(0, Math.round(inTop + v * inSpan)));
      let sIdx = (sy * w + x) * 4;
      if (srcData[sIdx + 3] < 190) {
        const altY = Math.min(
          fullH - 1,
          Math.max(0, Math.round(cTop + span * 0.42 + ((y * 17 + x * 3) % Math.max(8, Math.floor(span * 0.25)))))
        );
        sIdx = (altY * w + x) * 4;
      }
      const shade = 0.88 - v * 0.18;
      const dIdx = (y * w + x) * 4;
      bandRgba[dIdx] = Math.round(srcData[sIdx] * shade);
      bandRgba[dIdx + 1] = Math.round(srcData[sIdx + 1] * shade);
      bandRgba[dIdx + 2] = Math.round(srcData[sIdx + 2] * shade);
      bandRgba[dIdx + 3] = 255;
    }
  }

  const overlap = Math.max(32, Math.floor(w * 0.12));
  const outW = w - overlap;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) {
    work.width = 0;
    work.height = 0;
    return null;
  }

  const outImg = outCtx.createImageData(outW, outH);
  const oData = outImg.data;
  const topFeatherEnd = Math.floor(outH * 0.20);
  const bottomFeatherStart = Math.floor(outH * 0.76);

  for (let y = 0; y < outH; y++) {
    let vAlpha = 1.0;
    if (y < topFeatherEnd) {
      const ft = y / Math.max(1, topFeatherEnd);
      vAlpha = 0.5 * (1 - Math.cos(Math.PI * ft));
    } else if (y >= bottomFeatherStart) {
      const ft = (y - bottomFeatherStart) / Math.max(1, outH - 1 - bottomFeatherStart);
      vAlpha = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, ft)));
    }

    for (let x = 0; x < outW; x++) {
      const dstIdx = (y * outW + x) * 4;
      if (x < overlap) {
        const t = x / overlap;
        const wA = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const wB = 1 - wA;
        const idxA = (y * w + x) * 4;
        const idxB = (y * w + (x + outW)) * 4;
        oData[dstIdx] = Math.round(bandRgba[idxA] * wA + bandRgba[idxB] * wB);
        oData[dstIdx + 1] = Math.round(bandRgba[idxA + 1] * wA + bandRgba[idxB + 1] * wB);
        oData[dstIdx + 2] = Math.round(bandRgba[idxA + 2] * wA + bandRgba[idxB + 2] * wB);
        oData[dstIdx + 3] = Math.round(255 * vAlpha);
      } else {
        const idxA = (y * w + x) * 4;
        oData[dstIdx] = bandRgba[idxA];
        oData[dstIdx + 1] = bandRgba[idxA + 1];
        oData[dstIdx + 2] = bandRgba[idxA + 2];
        oData[dstIdx + 3] = Math.round(255 * vAlpha);
      }
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  work.width = 0;
  work.height = 0;
  return outCanvas;
}

/**
 * 规范第 11 / 14-F 节：资源映射表、AI 图集离屏切图缓存与缺失占位符回退（缺资源时不崩溃）
 */
export class WorldAssetRegistry {
  private readonly registry: Map<string, WorldAssetDescriptor> = new Map();
  private readonly spriteCanvases: Map<string, HTMLCanvasElement> = new Map();
  private readonly seabedStripCanvases: Map<BiomeId, HTMLCanvasElement> = new Map();
  private readonly seabedSubStratumCanvases: Map<BiomeId, HTMLCanvasElement> = new Map();
  private placeholderFallbackCount = 0;
  private atlasesLoadingTriggered = false;

  constructor() {
    this.registerDefaultAssets();
  }

  private registerDefaultAssets(): void {
    const defaults: WorldAssetDescriptor[] = [
      // ECOLOGY_OBJECT_CONFIGS 标准 assetKey
      { assetKey: 'eco_coral_cluster', category: 'flora', primaryColor: '#f43f5e', secondaryColor: '#fb923c', glowColor: '#fda4af', shape: 'coral', isPlaceholder: false },
      { assetKey: 'eco_seabed_rock', category: 'terrain', primaryColor: '#334155', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'eco_seagrass_bed', category: 'flora', primaryColor: '#10b981', secondaryColor: '#047857', shape: 'kelp', isPlaceholder: false },
      { assetKey: 'eco_fish_school_spawner', category: 'fauna', primaryColor: '#38bdf8', secondaryColor: '#bae6fd', shape: 'generic', isPlaceholder: false },
      { assetKey: 'eco_jellyfish_bloom', category: 'fauna', primaryColor: '#c084fc', secondaryColor: '#e9d5ff', glowColor: '#d8b4fe', shape: 'generic', isPlaceholder: false },
      { assetKey: 'eco_biolum_organism', category: 'fauna', primaryColor: '#ec4899', secondaryColor: '#67e8f9', glowColor: '#22d3ee', shape: 'coral', isPlaceholder: false },
      { assetKey: 'eco_shipwreck_debris', category: 'terrain', primaryColor: '#78350f', secondaryColor: '#b45309', shape: 'rock', isPlaceholder: false },
      { assetKey: 'eco_bubble_stream', category: 'ambient', primaryColor: '#475569', secondaryColor: '#38bdf8', glowColor: '#7dd3fc', shape: 'vent', isPlaceholder: false },
      { assetKey: 'eco_plankton_mote', category: 'ambient', primaryColor: '#fde047', secondaryColor: '#fef08a', glowColor: '#fde047', shape: 'generic', isPlaceholder: false },
      { assetKey: 'eco_marine_snow', category: 'ambient', primaryColor: '#cbd5e1', secondaryColor: '#f1f5f9', shape: 'generic', isPlaceholder: false },

      // POI_CONFIGS 标准 assetKey
      { assetKey: 'poi_shipwreck_hull', category: 'poi', primaryColor: '#92400e', secondaryColor: '#f59e0b', glowColor: '#fde047', shape: 'shipwreck', isPlaceholder: false },
      { assetKey: 'poi_abyssal_cave_arch', category: 'poi', primaryColor: '#1e293b', secondaryColor: '#38bdf8', glowColor: '#7dd3fc', shape: 'cave', isPlaceholder: false },
      { assetKey: 'poi_sunken_treasure_chest', category: 'poi', primaryColor: '#eab308', secondaryColor: '#fef08a', glowColor: '#fde047', shape: 'treasure', isPlaceholder: false },
      { assetKey: 'poi_rare_creature_nest', category: 'poi', primaryColor: '#a855f7', secondaryColor: '#e9d5ff', glowColor: '#c084fc', shape: 'nest', isPlaceholder: false },
      { assetKey: 'poi_ancient_ocean_monolith', category: 'poi', primaryColor: '#06b6d4', secondaryColor: '#67e8f9', glowColor: '#22d3ee', shape: 'landmark', isPlaceholder: false },

      // 海床表层岩壳纹理 assetKey
      { assetKey: 'seabed_strip_coral_reef', category: 'terrain', primaryColor: '#f59e0b', secondaryColor: '#f43f5e', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_rocky_shelf', category: 'terrain', primaryColor: '#475569', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_open_ocean', category: 'terrain', primaryColor: '#475569', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_underwater_canyon', category: 'terrain', primaryColor: '#1e293b', secondaryColor: '#22d3ee', glowColor: '#38bdf8', shape: 'rock', isPlaceholder: false },
      { assetKey: 'seabed_strip_deep_abyss', category: 'terrain', primaryColor: '#0f172a', secondaryColor: '#f97316', glowColor: '#fb923c', shape: 'rock', isPlaceholder: false },

      // 兼容别名与阶段 F 单测默认键
      { assetKey: 'flora_kelp_patch', category: 'flora', primaryColor: '#10b981', secondaryColor: '#047857', shape: 'kelp', isPlaceholder: false },
      { assetKey: 'flora_coral_cluster', category: 'flora', primaryColor: '#f43f5e', secondaryColor: '#fb923c', glowColor: '#fda4af', shape: 'coral', isPlaceholder: false },
      { assetKey: 'flora_sea_anemone', category: 'flora', primaryColor: '#ec4899', secondaryColor: '#f472b6', glowColor: '#f9a8d4', shape: 'coral', isPlaceholder: false },
      { assetKey: 'flora_sponge_colony', category: 'flora', primaryColor: '#eab308', secondaryColor: '#ca8a04', shape: 'sponge', isPlaceholder: false },
      { assetKey: 'flora_tube_worm_patch', category: 'flora', primaryColor: '#ef4444', secondaryColor: '#fca5a5', glowColor: '#f87171', shape: 'vent', isPlaceholder: false },
      { assetKey: 'ambient_hydrothermal_vent', category: 'ambient', primaryColor: '#475569', secondaryColor: '#f97316', glowColor: '#fb923c', shape: 'vent', isPlaceholder: false },
      { assetKey: 'ambient_rock_outcrop', category: 'ambient', primaryColor: '#334155', secondaryColor: '#64748b', shape: 'rock', isPlaceholder: false },
      { assetKey: 'ambient_sunken_debris', category: 'ambient', primaryColor: '#78350f', secondaryColor: '#b45309', shape: 'rock', isPlaceholder: false },
      { assetKey: 'ambient_bubble_emitter', category: 'ambient', primaryColor: '#7dd3fc', secondaryColor: '#e0f2fe', glowColor: '#38bdf8', shape: 'generic', isPlaceholder: false },
      { assetKey: 'poi_underwater_cave', category: 'poi', primaryColor: '#1e293b', secondaryColor: '#38bdf8', glowColor: '#7dd3fc', shape: 'cave', isPlaceholder: false },
      { assetKey: 'poi_sunken_treasure', category: 'poi', primaryColor: '#eab308', secondaryColor: '#fef08a', glowColor: '#fde047', shape: 'treasure', isPlaceholder: false },
      { assetKey: 'poi_abyssal_landmark', category: 'poi', primaryColor: '#06b6d4', secondaryColor: '#67e8f9', glowColor: '#22d3ee', shape: 'landmark', isPlaceholder: false },
    ];
    for (const item of defaults) {
      this.registry.set(item.assetKey, item);
    }
  }

  /**
   * 在浏览器环境下懒加载背景美术资产：
   * 1) 4 张独立高分辨率写实透明背景海床 PNG (`seabed_strip_coral_reef.png` 等，无切图)
   * 2) world_pois_atlas (5x2 共 10 种大型地标 POI)
   * 3) world_ecology_atlas (4x4 共 16 种珊瑚/岩石/海藻/残骸/热液喷口)
   */
  public ensureAtlasesLoaded(): void {
    if (this.atlasesLoadingTriggered) return;
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
      return;
    }
    this.atlasesLoadingTriggered = true;

    // 1. 直接加载 4 张独立的高分辨率写实透明背景海床 PNG（不切图）
    const seabedEntries: Array<{
      biome: 'coral_reef' | 'rocky_shelf' | 'underwater_canyon' | 'deep_abyss';
      url: string;
    }> = [
      { biome: 'coral_reef', url: WORLD_SEABED_STRIP_URLS.coral_reef },
      { biome: 'rocky_shelf', url: WORLD_SEABED_STRIP_URLS.rocky_shelf },
      { biome: 'underwater_canyon', url: WORLD_SEABED_STRIP_URLS.underwater_canyon },
      { biome: 'deep_abyss', url: WORLD_SEABED_STRIP_URLS.deep_abyss },
    ];

    for (const entry of seabedEntries) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const stripCanvas = prepareStandaloneSeabedSurfaceCanvas(img);
        if (stripCanvas) {
          this.seabedStripCanvases.set(entry.biome, stripCanvas);
          if (entry.biome === 'rocky_shelf') {
            this.seabedStripCanvases.set('open_ocean', stripCanvas);
          }
        }
        const subCanvas = prepareStandaloneSeabedSubsurfaceCanvas(img);
        if (subCanvas) {
          this.seabedSubStratumCanvases.set(entry.biome, subCanvas);
          if (entry.biome === 'rocky_shelf') {
            this.seabedSubStratumCanvases.set('open_ocean', subCanvas);
          }
        }
      };
      img.src = entry.url;
    }

    // 2. 加载 5x2 大型地标 POI 图集
    const poiImg = new Image();
    poiImg.crossOrigin = 'anonymous';
    poiImg.onload = () => {
      const poiSlices: Array<{
        assetKey: string;
        variant: string;
        rect: readonly [number, number, number, number];
        cleanHoles: boolean;
      }> = [
        // Row 1 (Top)
        { assetKey: 'poi_shipwreck_hull', variant: 'sunken_frigate', rect: [0.005, 0.01, 0.268, 0.37], cleanHoles: true },
        { assetKey: 'poi_abyssal_cave_arch', variant: 'limestone_grotto', rect: [0.265, 0.04, 0.465, 0.375], cleanHoles: false },
        { assetKey: 'poi_sunken_treasure_chest', variant: 'galleon_gold_coffer', rect: [0.465, 0.08, 0.602, 0.375], cleanHoles: false },
        { assetKey: 'poi_rare_creature_nest', variant: 'apex_kraken_lair', rect: [0.602, 0.08, 0.782, 0.375], cleanHoles: false },
        { assetKey: 'poi_ancient_ocean_monolith', variant: 'leviathan_rib_arch', rect: [0.782, 0.06, 0.992, 0.375], cleanHoles: true },
        // Row 2 (Bottom)
        { assetKey: 'poi_shipwreck_hull', variant: 'rusted_research_sub', rect: [0.008, 0.66, 0.242, 0.985], cleanHoles: false },
        { assetKey: 'poi_abyssal_cave_arch', variant: 'basalt_canyon_cavern', rect: [0.245, 0.64, 0.455, 0.985], cleanHoles: false },
        { assetKey: 'poi_sunken_treasure_chest', variant: 'ancient_relic_vault', rect: [0.458, 0.69, 0.618, 0.985], cleanHoles: false },
        { assetKey: 'poi_rare_creature_nest', variant: 'biolume_leviathan_den', rect: [0.618, 0.68, 0.835, 0.985], cleanHoles: false },
        { assetKey: 'poi_ancient_ocean_monolith', variant: 'runic_trench_obelisk', rect: [0.835, 0.54, 0.988, 0.985], cleanHoles: false },
      ];

      for (const spec of poiSlices) {
        const canvas = sliceAndCleanWorldSpriteRegion(poiImg, spec.rect, spec.cleanHoles, 440);
        if (canvas) {
          this.spriteCanvases.set(`${spec.assetKey}:${spec.variant}`, canvas);
          if (!this.spriteCanvases.has(spec.assetKey)) {
            this.spriteCanvases.set(spec.assetKey, canvas);
          }
        }
      }
    };
    poiImg.src = WORLD_ATLAS_ASSET_URLS.poisAtlas;

    // 3. 直接加载 4 张独立的 2048x2048 (@3x) 写实透明背景海床生态 PNG（不切图）
    const standaloneEcoSpecs: Array<{
      url: string;
      assetKeys: readonly string[];
      removeSmoke: boolean;
    }> = [
      {
        url: WORLD_ECOLOGY_SPRITE_URLS.coral_reef_cluster,
        assetKeys: [
          'eco_coral_cluster',
          'flora_coral_cluster',
          'flora_sponge_colony',
          'flora_sea_anemone',
        ],
        removeSmoke: false,
      },
      {
        url: WORLD_ECOLOGY_SPRITE_URLS.rocky_outcrop,
        assetKeys: ['eco_seabed_rock', 'ambient_rock_outcrop'],
        removeSmoke: false,
      },
      {
        url: WORLD_ECOLOGY_SPRITE_URLS.kelp_forest_cluster,
        assetKeys: ['eco_seagrass_bed', 'flora_kelp_patch'],
        removeSmoke: false,
      },
      {
        url: WORLD_ECOLOGY_SPRITE_URLS.abyssal_vent_debris,
        assetKeys: [
          'eco_bubble_stream',
          'eco_shipwreck_debris',
          'ambient_hydrothermal_vent',
          'ambient_sunken_debris',
          'flora_tube_worm_patch',
        ],
        removeSmoke: true,
      },
    ];

    for (const spec of standaloneEcoSpecs) {
      const ecoImg = new Image();
      ecoImg.crossOrigin = 'anonymous';
      ecoImg.onload = () => {
        const canvas = prepareStandaloneEcologySpriteCanvas(ecoImg, 380, spec.removeSmoke);
        if (!canvas) return;
        for (const key of spec.assetKeys) {
          this.spriteCanvases.set(key, canvas);
          this.spriteCanvases.set(`${key}:composite_cluster`, canvas);
        }
      };
      ecoImg.src = spec.url;
    }
  }

  public getSpriteCanvas(assetKey: string, variant?: string): HTMLCanvasElement | null {
    if (variant) {
      const byVariant = this.spriteCanvases.get(`${assetKey}:${variant}`);
      if (byVariant) return byVariant;
    }
    return this.spriteCanvases.get(assetKey) ?? null;
  }

  public getSeabedStripCanvas(biomeId: BiomeId): HTMLCanvasElement | null {
    return this.seabedStripCanvases.get(biomeId) ?? null;
  }

  public getSeabedSubStratumCanvas(biomeId: BiomeId): HTMLCanvasElement | null {
    return this.seabedSubStratumCanvases.get(biomeId) ?? null;
  }

  public registerAsset(descriptor: WorldAssetDescriptor): void {
    this.registry.set(descriptor.assetKey, { ...descriptor, isPlaceholder: false });
  }

  public hasAsset(assetKey: string): boolean {
    return this.registry.has(assetKey);
  }

  /**
   * 获取资源描述符；若 assetKey 未注册，返回安全的矢量占位符且绝不抛异常
   */
  public getAssetOrPlaceholder(
    assetKey: string,
    fallbackCategory: WorldAssetDescriptor['category'] = 'ambient'
  ): WorldAssetDescriptor {
    const found = this.registry.get(assetKey);
    if (found) return found;
    this.placeholderFallbackCount += 1;
    return {
      assetKey: assetKey || 'missing_asset_placeholder',
      category: fallbackCategory,
      primaryColor: '#64748b',
      secondaryColor: '#94a3b8',
      glowColor: '#38bdf8',
      shape: 'generic',
      isPlaceholder: true,
    };
  }

  public getPlaceholderFallbackCount(): number {
    return this.placeholderFallbackCount;
  }
}


export const worldAssetRegistry = new WorldAssetRegistry();
