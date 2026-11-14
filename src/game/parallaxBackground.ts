import {
  computeParallaxBiomeTransitionState,
  getParallaxLayerGrowthScales,
  quinticSmoothstep,
} from './rules';
import {
  WorldConfig,
  createChunkRng,
  getDepthVisualProfile,
  meterDepthToWorldY,
  proceduralOceanWorld,
} from './worldGenerationSystem';

export interface AmbientBubble {
  x: number;
  y: number;
  r: number;
  speedY: number;
  wobblePhase: number;
  alpha: number;
  kind: 'BUBBLE' | 'MARINE_SNOW' | 'BIO_SPORE' | 'MAGMA_EMBER';
}

export type AmbientSpriteKind =
  | 'SARDINE_BAITBALL'
  | 'BUTTERFLYFISH_SCHOOL'
  | 'MANTA_RAY'
  | 'MOON_JELLYFISH'
  | 'GIANT_KELP'
  | 'BIOLUM_SEA_WHIP'
  | 'BUBBLE_STREAM'
  | 'LANTERNFISH_SCHOOL';

export interface AmbientBackgroundSchool {
  x: number;
  y: number;
  speedX: number;
  dir: 1 | -1;
  count: number;
  spreadX: number;
  spreadY: number;
  phase: number;
  zone: 0 | 1; // 0 = shallow reef, 1 = twilight canyon
  spriteKind: AmbientSpriteKind;
  scale: number;
}

export interface WaterSpectrumSample {
  r: number;
  g: number;
  b: number;
  css: string;
}

interface DepthColorStop {
  depth: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Physically-inspired bathymetric color spectrum stops from Sea Surface (0m)
 * through Sunlit Reef (0~520m), Twilight Canyon (520~1150m), to Abyssal Volcanic Trench (1150m~2200m+).
 */
const BATHYMETRIC_COLOR_STOPS: readonly DepthColorStop[] = [
  { depth: -220, r: 56, g: 189, b: 248 },  // High sky azure
  { depth: -10, r: 125, g: 211, b: 252 },  // Horizon sky mist
  { depth: 0, r: 14, g: 184, b: 218 },     // Sunlit surface turquoise
  { depth: 140, r: 6, g: 148, b: 194 },    // Upper epipelagic cyan-blue
  { depth: 340, r: 3, g: 105, b: 161 },    // Mid coral shelf cerulean
  { depth: 520, r: 18, g: 68, b: 138 },    // Epipelagic-Mesopelagic thermocline
  { depth: 780, r: 17, g: 38, b: 92 },     // Twilight sunken ruins sapphire
  { depth: 1150, r: 10, g: 18, b: 48 },    // Twilight-Abyssal boundary midnight
  { depth: 1480, r: 9, g: 8, b: 26 },      // Upper abyssal obsidian-violet
  { depth: 1950, r: 24, g: 8, b: 14 },     // Hadal hydrothermal magma-tinted floor
];

/**
 * Pure function that interpolates the continuous ocean water color at any world depth (meters).
 * Guarantees smooth C0/C1 transitions across ecological zones with zero hard seams or alpha ghosting.
 */
export function sampleBathymetricWaterColor(depthMeters: number): WaterSpectrumSample {
  if (!Number.isFinite(depthMeters)) {
    return { r: 6, g: 148, b: 194, css: 'rgb(6, 148, 194)' };
  }

  if (depthMeters <= BATHYMETRIC_COLOR_STOPS[0].depth) {
    const s = BATHYMETRIC_COLOR_STOPS[0];
    return { r: s.r, g: s.g, b: s.b, css: `rgb(${s.r}, ${s.g}, ${s.b})` };
  }

  const lastIdx = BATHYMETRIC_COLOR_STOPS.length - 1;
  if (depthMeters >= BATHYMETRIC_COLOR_STOPS[lastIdx].depth) {
    const s = BATHYMETRIC_COLOR_STOPS[lastIdx];
    return { r: s.r, g: s.g, b: s.b, css: `rgb(${s.r}, ${s.g}, ${s.b})` };
  }

  for (let i = 0; i < lastIdx; i++) {
    const a = BATHYMETRIC_COLOR_STOPS[i];
    const b = BATHYMETRIC_COLOR_STOPS[i + 1];
    if (depthMeters >= a.depth && depthMeters <= b.depth) {
      const span = Math.max(1, b.depth - a.depth);
      const rawT = (depthMeters - a.depth) / span;
      const t = rawT * rawT * (3 - 2 * rawT);
      const r = Math.round(a.r + (b.r - a.r) * t);
      const g = Math.round(a.g + (b.g - a.g) * t);
      const bl = Math.round(a.b + (b.b - a.b) * t);
      return { r, g, b: bl, css: `rgb(${r}, ${g}, ${bl})` };
    }
  }

  const fallback = BATHYMETRIC_COLOR_STOPS[2];
  return {
    r: fallback.r,
    g: fallback.g,
    b: fallback.b,
    css: `rgb(${fallback.r}, ${fallback.b}, ${fallback.b})`,
  };
}

/**
 * Asset manifest for the 13 layered AI-generated ocean environment textures.
 */
export const OCEAN_LAYER_ASSET_PATHS = {
  shallow: {
    water: '/assets/aistudio/bg_shallow_0_water_0e65cb68.png',
    far: '/assets/aistudio/bg_shallow_1_far_8898229a.png',
    mid: '/assets/aistudio/bg_shallow_2_mid_b4e0d30a.png',
    near: '/assets/aistudio/bg_shallow_3_near_96e92ee1.png',
  },
  twilight: {
    water: '/assets/aistudio/bg_twilight_0_17bcb84c.png',
    far: '/assets/aistudio/bg_twilight_1_04f5d35f.png',
    mid: '/assets/aistudio/bg_twilight_2_fd5a1b33.png',
    near: '/assets/aistudio/bg_twilight_3_6e0dd7c1.png',
  },
  abyss: {
    water: '/assets/aistudio/bg_abyss_0_1bbf506a.png',
    far: '/assets/aistudio/bg_abyss_1_75e4a628.png',
    mid: '/assets/aistudio/bg_abyss_2_6ce66695.png',
    near: '/assets/aistudio/bg_abyss_3_a4986280.png',
  },
  ambientSprites: '/assets/aistudio/bg_ambient_sprites_0c6882ce.png',
} as const;

export interface BiomeParallaxPlanes {
  water?: HTMLCanvasElement;
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  near: HTMLCanvasElement;
}

/**
 * Deterministic periodic wave helper for procedural fallback before image assets finish decoding.
 */
function periodicWave(
  x: number,
  width: number,
  harmonics: ReadonlyArray<{ freq: number; amp: number; phase: number }>
): number {
  const theta = (x / width) * Math.PI * 2;
  let sum = 0;
  for (const h of harmonics) {
    sum += Math.sin(theta * h.freq + h.phase) * h.amp;
  }
  return sum;
}

/**
 * Synthesizes a horizontally-seamless tile from a source canvas by cross-fading a `seamRatio` overlap band
 * using a cosine weight curve (zero vertical seam lines and zero Rorschach mirror symmetry).
 */
function makeHorizontallySeamlessCanvas(
  src: HTMLCanvasElement,
  seamRatio: number = 0.14
): HTMLCanvasElement {
  const sw = src.width;
  const sh = src.height;
  const overlap = Math.max(16, Math.min(Math.floor(sw * 0.25), Math.round(sw * seamRatio)));
  const outW = sw - overlap;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = sh;
  const oCtx = out.getContext('2d');
  const sCtx = src.getContext('2d');
  if (!oCtx || !sCtx) return src;

  const srcData = sCtx.getImageData(0, 0, sw, sh);
  const outData = oCtx.createImageData(outW, sh);
  const sBuf = srcData.data;
  const oBuf = outData.data;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < outW; x++) {
      const dstIdx = (y * outW + x) * 4;
      if (x < overlap) {
        // Cosine blend between the right tail [outW + x] and left head [x]
        const t = (x + 0.5) / overlap;
        const wLeft = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const wRight = 1 - wLeft;

        const idxL = (y * sw + x) * 4;
        const idxR = (y * sw + (outW + x)) * 4;

        const aL = sBuf[idxL + 3] / 255;
        const aR = sBuf[idxR + 3] / 255;
        const outA = aL * wLeft + aR * wRight;

        if (outA <= 0.001) {
          oBuf[dstIdx] = 0;
          oBuf[dstIdx + 1] = 0;
          oBuf[dstIdx + 2] = 0;
          oBuf[dstIdx + 3] = 0;
        } else {
          const weightL = (aL * wLeft) / outA;
          const weightR = (aR * wRight) / outA;
          oBuf[dstIdx] = Math.round(sBuf[idxL] * weightL + sBuf[idxR] * weightR);
          oBuf[dstIdx + 1] = Math.round(sBuf[idxL + 1] * weightL + sBuf[idxR + 1] * weightR);
          oBuf[dstIdx + 2] = Math.round(sBuf[idxL + 2] * weightL + sBuf[idxR + 2] * weightR);
          oBuf[dstIdx + 3] = Math.round(outA * 255);
        }
      } else {
        const idxS = (y * sw + x) * 4;
        oBuf[dstIdx] = sBuf[idxS];
        oBuf[dstIdx + 1] = sBuf[idxS + 1];
        oBuf[dstIdx + 2] = sBuf[idxS + 2];
        oBuf[dstIdx + 3] = sBuf[idxS + 3];
      }
    }
  }

  oCtx.putImageData(outData, 0, 0);
  return out;
}

interface TerrainProcessOptions {
  /** Special handling for legacy shallow_1_far which had #FF00FF top sky */
  isShallowFar?: boolean;
  /** Whether to key out enclosed pure-white holes in the upper `maxHoleYRatio` (e.g. rock archways, coral gaps, fossil skull eye sockets) */
  punchUpperInteriorWhiteHoles?: boolean;
  /** Normalized vertical ratio [0..1] up to which enclosed pure-white holes are keyed out (default 0.62) */
  maxHoleYRatio?: number;
  /** Optional normalized bottom crop ratio (0..1) to trim stray artifacts at the bottom margin before processing */
  cropBottomRatio?: number;
  /** Optional rect [x0Ratio, y0Ratio, x1Ratio, y1Ratio] to clear stray slice-overlap artifacts */
  clearArtifactRectRatio?: [number, number, number, number];
  /** Whether to round off the flat-sliced top-left seamount peak in shallow.far so it has a natural dome silhouette */
  roundTopLeftSlicedPeak?: boolean;
  /** Whether to extend the lowest opaque terrain pixel in each column down to the bottom edge so elevated parallax planes have a 100% solid base */
  groundBottomColumns?: boolean;
  /** Normalized bottom band height [0..1] within which transparent bottom notches are grounded (default 0.18) */
  groundBottomBandRatio?: number;
  /** Unmixes soft grey/black hydrothermal smoke plumes painted against a #FFFFFF sky while preserving lower white tube worms */
  unmixHydrothermalSmokeSky?: boolean;
  /** Target top padding in source pixels when cropping */
  trimTopPaddingPx?: number;
}

/**
 * Processes an AI-generated terrain layer (either 1024x1024 square or 1916xH ultra-wide panoramic strip):
 * 1. Preserves exact source aspect ratio with high working resolution (up to 1440px wide for panoramic strips).
 * 2. Flood-fills from the top sky edge (and bottom edge if white margin exists) plus optional interior archway/branch holes.
 * 3. Smoothly despills and feathers anti-aliased white/magenta edge pixels.
 * 4. Optionally grounds bottom column notches so stacked parallax planes have a seamless solid base.
 * 5. Crops empty sky & bottom margin rows and applies a cosine horizontal seam blend.
 */
function processTerrainLayerToSeamlessStrip(
  img: HTMLImageElement,
  options: TerrainProcessOptions = {}
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width || 1024;
  const srcH = img.naturalHeight || img.height || 1024;
  const effectiveSrcH = options.cropBottomRatio
    ? Math.max(32, Math.round(srcH * options.cropBottomRatio))
    : srcH;
  const isPanoramicStrip = srcW / Math.max(1, effectiveSrcH) > 1.8;
  const maxDim = isPanoramicStrip ? 1440 : 640;
  const scale = srcW > maxDim ? maxDim / srcW : 1;
  const w = Math.max(64, Math.round(srcW * scale));
  const h = Math.max(24, Math.round(effectiveSrcH * scale));

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = w;
  rawCanvas.height = h;
  const ctx = rawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return rawCanvas;

  ctx.drawImage(img, 0, 0, srcW, effectiveSrcH, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  if (options.clearArtifactRectRatio) {
    const [rx0, ry0, rx1, ry1] = options.clearArtifactRectRatio;
    const x0 = Math.max(0, Math.floor(w * rx0));
    const y0 = Math.max(0, Math.floor(h * ry0));
    const x1 = Math.min(w, Math.ceil(w * rx1));
    const y1 = Math.min(h, Math.ceil(h * ry1));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 0;
      }
    }
  }

  // Round off the flat-sliced top-left seamount summit (x in 3.5%..15.5%) so it forms a natural organic peak
  if (options.roundTopLeftSlicedPeak) {
    const xStart = Math.floor(w * 0.032);
    const xEnd = Math.ceil(w * 0.158);
    const xCenter = (xStart + xEnd) * 0.5;
    const xHalf = Math.max(1, (xEnd - xStart) * 0.5);
    for (let x = xStart; x <= xEnd; x++) {
      const nx = (x - xCenter) / xHalf;
      const archCurve = Math.round(
        h * (0.015 + 0.14 * nx * nx + 0.025 * Math.sin(nx * Math.PI * 2))
      );
      for (let y = 0; y < Math.min(h, archCurve); y++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 0;
      }
    }
  }

  const isBgCandidate = (idx: number): boolean => {
    if (data[idx + 3] < 16) return true;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    // Solid white / near-white background
    const isWhite = minC >= 218 && maxC - minC <= 32;
    // Solid #FF00FF magenta background
    const isMagenta = r >= 180 && b >= 180 && g <= 135 && r - g >= 65 && b - g >= 65;
    return isWhite || isMagenta;
  };

  // 1. BFS Flood-Fill from top sky border and bottom border (if bottom has white margin)
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0;
  let qTail = 0;

  const pushSeed = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    if (isBgCandidate(p * 4)) {
      visited[p] = 1;
      queue[qTail++] = p;
    }
  };

  // Seed top row and upper 68% left/right edges
  for (let x = 0; x < w; x++) {
    pushSeed(x, 0);
    pushSeed(x, 1);
  }
  for (let y = 0; y < Math.floor(h * 0.68); y++) {
    pushSeed(0, y);
    pushSeed(w - 1, y);
  }

  // Check if bottom row has significant white margin
  let bottomWhiteCount = 0;
  for (let x = 0; x < w; x += 4) {
    if (isBgCandidate(((h - 1) * w + x) * 4)) bottomWhiteCount++;
  }
  if (bottomWhiteCount > (w / 4) * 0.25 && !options.groundBottomColumns) {
    for (let x = 0; x < w; x++) {
      pushSeed(x, h - 1);
      pushSeed(x, h - 2);
    }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % w;
    const cy = (curr - cx) / w;

    if (cx > 0) {
      const n = curr - 1;
      if (!visited[n] && isBgCandidate(n * 4)) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cx + 1 < w) {
      const n = curr + 1;
      if (!visited[n] && isBgCandidate(n * 4)) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cy > 0) {
      const n = curr - w;
      if (!visited[n] && isBgCandidate(n * 4)) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cy + 1 < h) {
      const n = curr + w;
      if (!visited[n] && isBgCandidate(n * 4)) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  // Optional: punch enclosed pure-white holes in the upper `maxHoleYRatio` (rock archways, coral branches, kelp fronds, skull sockets)
  if (options.punchUpperInteriorWhiteHoles) {
    const holeRatio = options.maxHoleYRatio ?? 0.62;
    const maxHoleY = Math.floor(h * holeRatio);
    for (let y = 0; y < maxHoleY; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!visited[p]) {
          const idx = p * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const minC = Math.min(r, g, b);
          const maxC = Math.max(r, g, b);
          if (minC >= 224 && maxC - minC <= 26) {
            visited[p] = 1;
          }
        }
      }
    }
  }

  // Zero out alpha on all flood-filled background pixels
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      data[p * 4 + 3] = 0;
    }
  }

  // Optional: unmix soft grey/black hydrothermal smoke plumes painted over #FFFFFF sky
  // while 100% preserving red-and-white tube worms in the lower volcanic bed
  if (options.unmixHydrothermalSmokeSky) {
    const smokeMaxY = Math.floor(h * 0.64);
    const smokeVisited = new Uint8Array(w * h);
    let sHead = 0;
    let sTail = 0;
    const isSmokeMistCandidate = (p: number, y: number): boolean => {
      if (y >= smokeMaxY) return false;
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      return minC >= 78 && maxC - minC <= 32;
    };

    for (let y = 0; y < smokeMaxY; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (visited[p]) {
          smokeVisited[p] = 1;
          queue[sTail++] = p;
        }
      }
    }

    while (sHead < sTail) {
      const curr = queue[sHead++];
      const cx = curr % w;
      const cy = (curr - cx) / w;
      const neighbors = [
        cx > 0 ? curr - 1 : -1,
        cx + 1 < w ? curr + 1 : -1,
        cy > 0 ? curr - w : -1,
        cy + 1 < smokeMaxY ? curr + w : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && !smokeVisited[n]) {
          const ny = Math.floor(n / w);
          if (isSmokeMistCandidate(n, ny)) {
            smokeVisited[n] = 1;
            queue[sTail++] = n;
          }
        }
      }
    }

    for (let y = 0; y < smokeMaxY; y++) {
      const vertFade =
        y < h * 0.52 ? 1 : Math.max(0, (smokeMaxY - y) / Math.max(1, smokeMaxY - h * 0.52));
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!smokeVisited[p] || visited[p]) continue;
        const idx = p * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const minC = Math.min(r, g, b);
        if (minC >= 212) {
          visited[p] = 1;
          data[idx + 3] = 0;
        } else {
          const rawSmokeAlpha = Math.max(0, Math.min(1, (212 - minC) / (212 - 78)));
          const smokeAlpha = Math.pow(rawSmokeAlpha, 1.2) * 0.92;
          const effAlpha = (1 - vertFade) + vertFade * smokeAlpha;
          data[idx] = Math.round(r * (1 - vertFade) + 22 * vertFade);
          data[idx + 1] = Math.round(g * (1 - vertFade) + 24 * vertFade);
          data[idx + 2] = Math.round(b * (1 - vertFade) + 28 * vertFade);
          data[idx + 3] = Math.round(data[idx + 3] * effAlpha);
          if (data[idx + 3] < 8) {
            visited[p] = 1;
            data[idx + 3] = 0;
          }
        }
      }
    }
  }

  // 2. Despill & feather 2px boundary halo around removed background
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (visited[p]) continue;

      const hasTransNeighbor =
        visited[p - 1] ||
        visited[p + 1] ||
        visited[p - w] ||
        visited[p + w] ||
        visited[p - w - 1] ||
        visited[p - w + 1] ||
        visited[p + w - 1] ||
        visited[p + w + 1];

      if (hasTransNeighbor) {
        const idx = p * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);

        // Soften bright white edge fringe & unmix white halo
        if (minC > 165 && maxC - minC < 52) {
          const keep = Math.max(0, Math.min(1, (232 - minC) / 67));
          data[idx] = Math.round(r * 0.66);
          data[idx + 1] = Math.round(g * 0.72);
          data[idx + 2] = Math.round(b * 0.80);
          data[idx + 3] = Math.round(data[idx + 3] * keep);
        }
        // Soften magenta edge fringe
        if (r > g + 25 && b > g + 25) {
          const magentaExcess = Math.min(r - g, b - g);
          const keep = Math.max(0, Math.min(1, 1 - magentaExcess / 110));
          data[idx] = g;
          data[idx + 2] = Math.min(b, g + 35);
          data[idx + 3] = Math.round(data[idx + 3] * keep);
        }
      }
    }
  }

  // 3. Optional bottom-column grounding: fills any bottom white cutout notches along the lower band
  //    by extending the lowest opaque terrain pixel in each column downward to the bottom edge.
  if (options.groundBottomColumns) {
    const bandRatio = options.groundBottomBandRatio ?? 0.18;
    const minSearchY = Math.max(4, Math.floor(h * (1 - bandRatio)));
    for (let x = 0; x < w; x++) {
      let lastSolidY = -1;
      for (let y = h - 1; y >= minSearchY; y--) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);
        const isWhiteBottomMargin = minC >= 212 && maxC - minC <= 34;
        if (data[idx + 3] > 200 && !isWhiteBottomMargin) {
          lastSolidY = y;
          break;
        }
      }
      if (lastSolidY >= minSearchY && lastSolidY < h - 1) {
        const srcY = Math.max(0, lastSolidY - 2);
        const srcIdx = (srcY * w + x) * 4;
        const sr = data[srcIdx];
        const sg = data[srcIdx + 1];
        const sb = data[srcIdx + 2];
        for (let y = lastSolidY; y < h; y++) {
          const dstIdx = (y * w + x) * 4;
          data[dstIdx] = sr;
          data[dstIdx + 1] = sg;
          data[dstIdx + 2] = sb;
          data[dstIdx + 3] = 255;
        }
      }
    }
  }

  // 4. Find vertical opaque bounding box [minY, maxY] to trim empty sky & any bottom white margin
  let minY = h - 1;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    let rowOpaqueCount = 0;
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 28) {
        rowOpaqueCount++;
      }
    }
    if (rowOpaqueCount >= 4) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const scaledPad = Math.max(1, Math.round((options.trimTopPaddingPx ?? 4) * scale));
  if (maxY <= minY + 16) {
    minY = 0;
    maxY = h - 1;
  } else {
    minY = Math.max(0, minY - scaledPad);
    maxY = Math.min(h - 1, Math.max(minY + 24, maxY - 1));
  }

  ctx.putImageData(imgData, 0, 0);

  const cropH = maxY - minY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = w;
  cropped.height = cropH;
  const cCtx = cropped.getContext('2d');
  if (cCtx) {
    cCtx.drawImage(rawCanvas, 0, minY, w, cropH, 0, 0, w, cropH);
  }

  const seamless = makeHorizontallySeamlessCanvas(cropped, isPanoramicStrip ? 0.10 : 0.14);
  rawCanvas.width = 0;
  rawCanvas.height = 0;
  cropped.width = 0;
  cropped.height = 0;
  return seamless;
}

/**
 * Processes the panoramic Shallow Water Surface & Sunbeam Canopy (`bg_shallow_0_water_0e65cb68.png`, 1916x267):
 * - Preserves full panoramic aspect ratio (up to 1440px wide).
 * - Trims top white margin and bottom stray slice-overlap tip.
 * - Smoothly unmixes the bottom #FFFFFF fade with a C1-continuous cosine envelope so sunbeams dissolve invisibly into the water column.
 */
function processShallowWaterCanopyToSeamlessStrip(
  img: HTMLImageElement
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width || 1916;
  const srcH = img.naturalHeight || img.height || 267;
  // Trim the top 7px white margin and bottom 21px stray rock-tip overlap
  const cropTop = Math.round(srcH * 0.028);
  const cropBot = Math.round(srcH * 0.905);
  const cropSrcH = Math.max(32, cropBot - cropTop);

  const maxDim = 1440;
  const scale = srcW > maxDim ? maxDim / srcW : 1;
  const w = Math.max(128, Math.round(srcW * scale));
  const h = Math.max(32, Math.round(cropSrcH * scale));

  const raw = document.createElement('canvas');
  raw.width = w;
  raw.height = h;
  const ctx = raw.getContext('2d', { willReadFrequently: true });
  if (!ctx) return raw;

  ctx.drawImage(img, 0, cropTop, srcW, cropSrcH, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    const v = y / Math.max(1, h - 1);
    // C1-continuous cosine vertical fade starting from v=0.26 down to v=1.0 (zero hard bottom edge)
    const verticalEnvelope =
      v <= 0.26
        ? 1
        : Math.pow(Math.cos(((v - 0.26) / 0.74) * Math.PI * 0.5), 1.65);

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

      // Top 6% residual white border cleanup
      if (v < 0.06 && minC >= 236 && sat < 0.06) {
        data[idx + 3] = 0;
        continue;
      }

      if (v >= 0.22) {
        const cyanInk = Math.max((255 - r) / 235, sat * 1.25);
        const rawAlpha = Math.max(0, Math.min(1, cyanInk));
        const unmixWeight = Math.min(1, (v - 0.22) / 0.26);
        const effAlpha =
          (1 - unmixWeight + unmixWeight * rawAlpha) * verticalEnvelope;

        if (effAlpha <= 0.008) {
          data[idx + 3] = 0;
          continue;
        }

        if (rawAlpha > 0.05 && rawAlpha < 0.98) {
          const invA = 1 / Math.max(0.24, rawAlpha);
          const ur = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - rawAlpha)) * invA)));
          const ug = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - rawAlpha)) * invA)));
          const ub = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - rawAlpha)) * invA)));
          data[idx] = Math.round(r * (1 - unmixWeight) + ur * unmixWeight);
          data[idx + 1] = Math.round(g * (1 - unmixWeight) + ug * unmixWeight);
          data[idx + 2] = Math.round(b * (1 - unmixWeight) + ub * unmixWeight);
        }
        data[idx + 3] = Math.round(effAlpha * 255);
      } else {
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const seamless = makeHorizontallySeamlessCanvas(raw, 0.10);
  raw.width = 0;
  raw.height = 0;
  return seamless;
}

/**
 * Processes an AI-generated Layer 0 Water Backdrop into a horizontally-seamless tileable canvas.
 * For deep-water backdrops (`twilight.water` & `abyss.water`), applies a soft vertical cosine alpha envelope
 * at the top and bottom so they act as delicate volumetric light/ember veils over the continuous
 * `sampleBathymetricWaterColor` gradient rather than opaque full-screen wallpaper swaps.
 */
function processWaterLayerToSeamlessTile(img: HTMLImageElement): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width || 1024;
  const srcH = img.naturalHeight || img.height || 1024;
  if (srcW / Math.max(1, srcH) > 3.0) {
    return processShallowWaterCanopyToSeamlessStrip(img);
  }
  const isWidescreenWater = srcW / Math.max(1, srcH) > 1.8;
  const maxDim = isWidescreenWater ? 1024 : 512;
  const scale = srcW > maxDim ? maxDim / srcW : 1;
  const w = Math.max(64, Math.round(srcW * scale));
  const h = Math.max(64, Math.round(srcH * scale));
  const raw = document.createElement('canvas');
  raw.width = w;
  raw.height = h;
  const ctx = raw.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let y = 0; y < h; y++) {
      const v = y / Math.max(1, h - 1);
      // Soft vertical atmospheric envelope: preserves upper-mid light shafts while feathering the bottom 38% into the water column
      const topEnv = v < 0.08 ? 0.65 + 0.35 * Math.sin((v / 0.08) * Math.PI * 0.5) : 1.0;
      const botEnv =
        v <= 0.62
          ? 1.0
          : 0.16 + 0.84 * Math.pow(Math.cos(((v - 0.62) / 0.38) * Math.PI * 0.5), 1.5);
      const rowAlpha = Math.round(topEnv * botEnv * 255);
      for (let x = 0; x < w; x++) {
        data[(y * w + x) * 4 + 3] = rowAlpha;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  const seamless = makeHorizontallySeamlessCanvas(raw, isWidescreenWater ? 0.12 : 0.16);
  raw.width = 0;
  raw.height = 0;
  return seamless;
}

/**
 * Slices the 4x2 `bg_ambient_sprites` sheet into 8 isolated, background-stripped,
 * tight-cropped sprite canvases while preserving soft bioluminescent glows.
 */
function sliceAmbientSpriteSheet(
  img: HTMLImageElement
): Partial<Record<AmbientSpriteKind, HTMLCanvasElement>> {
  const srcW = img.naturalWidth || img.width || 1024;
  const srcH = img.naturalHeight || img.height || 1024;
  const maxDim = 768;
  const scale = srcW > maxDim ? maxDim / srcW : 1;
  const w = Math.max(128, Math.round(srcW * scale));
  const h = Math.max(128, Math.round(srcH * scale));
  const cols = 4;
  const rows = 2;
  const cellW = Math.floor(w / cols);
  const cellH = Math.floor(h / rows);

  const orderedKinds: AmbientSpriteKind[] = [
    'SARDINE_BAITBALL',
    'BUTTERFLYFISH_SCHOOL',
    'MANTA_RAY',
    'MOON_JELLYFISH',
    'GIANT_KELP',
    'BIOLUM_SEA_WHIP',
    'BUBBLE_STREAM',
    'LANTERNFISH_SCHOOL',
  ];

  const result: Partial<Record<AmbientSpriteKind, HTMLCanvasElement>> = {};

  for (let idx = 0; idx < orderedKinds.length; idx++) {
    const kind = orderedKinds[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = cellW;
    cellCanvas.height = cellH;
    const cCtx = cellCanvas.getContext('2d', { willReadFrequently: true });
    if (!cCtx) continue;

    cCtx.drawImage(
      img,
      (col * srcW) / cols,
      (row * srcH) / rows,
      srcW / cols,
      srcH / rows,
      0,
      0,
      cellW,
      cellH
    );

    const imgData = cCtx.getImageData(0, 0, cellW, cellH);
    const data = imgData.data;

    let minX = cellW;
    let minY = cellH;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        // Ignore 5px outer cell border to prevent grid neighbor bleed
        if (x < 5 || x >= cellW - 5 || y < 5 || y >= cellH - 5) {
          data[(y * cellW + x) * 4 + 3] = 0;
          continue;
        }

        const i = (y * cellW + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

        // Pure neutral white background -> transparent
        if (minC >= 240 && sat < 0.065) {
          data[i + 3] = 0;
          continue;
        }

        // For fish schools (BUTTERFLYFISH_SCHOOL & LANTERNFISH_SCHOOL), strip the soft pastel-blue background aura
        // painted behind the fish in the sprite sheet so there is no circular patch in the water
        if (
          (kind === 'BUTTERFLYFISH_SCHOOL' || kind === 'LANTERNFISH_SCHOOL') &&
          minC >= 150 &&
          b >= r + 12 &&
          g >= r + 10 &&
          sat < 0.32
        ) {
          data[i + 3] = 0;
          continue;
        }

        // Soft white halo transition -> smooth alpha extraction + white despill
        let alpha = 1;
        if (minC > 180 && sat < 0.38) {
          const darknessScore = (244 - minC) / 64;
          const colorScore = sat * 2.2;
          alpha = Math.max(0, Math.min(1, Math.max(darknessScore, colorScore)));
          if (alpha > 0.04 && alpha < 0.98) {
            // Unmix white background contribution so glowing jellyfish/corals have zero milky fringe
            const invA = 1 / Math.max(0.22, alpha);
            data[i] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alpha)) * invA)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - alpha)) * invA)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - alpha)) * invA)));
          }
        }

        const outA = Math.round(alpha * 255);
        data[i + 3] = outA;

        if (outA > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    cCtx.putImageData(imgData, 0, 0);

    if (maxX > minX + 6 && maxY > minY + 6) {
      const pad = 3;
      const sx = Math.max(0, minX - pad);
      const sy = Math.max(0, minY - pad);
      const sw = Math.min(cellW - sx, maxX - minX + 1 + pad * 2);
      const sh = Math.min(cellH - sy, maxY - minY + 1 + pad * 2);

      const trimmed = document.createElement('canvas');
      trimmed.width = sw;
      trimmed.height = sh;
      const tCtx = trimmed.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(cellCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      }
      cellCanvas.width = 0;
      cellCanvas.height = 0;
      result[kind] = trimmed;
    } else {
      result[kind] = cellCanvas;
    }
  }

  return result;
}

/**
 * Lightweight procedural fallback planes used during the first few milliseconds before image assets finish decoding,
 * or in headless Node unit tests where HTMLImageElement decoding does not run.
 */
function bakeFallbackPlanes(
  w: number,
  h: number,
  topCol: string,
  midCol: string,
  botCol: string,
  rimCol: string
): BiomeParallaxPlanes {
  const far = document.createElement('canvas');
  const mid = document.createElement('canvas');
  const near = document.createElement('canvas');
  far.width = mid.width = near.width = w;
  far.height = mid.height = near.height = h;

  const drawLayer = (
    canvas: HTMLCanvasElement,
    baseYRatio: number,
    amp: number,
    col: string,
    phase: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) {
      const y =
        h * baseYRatio +
        periodicWave(x, w, [
          { freq: 2, amp, phase },
          { freq: 5, amp: amp * 0.45, phase: phase + 1.3 },
        ]);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rimCol;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  drawLayer(far, 0.46, 42, topCol, 0.4);
  drawLayer(mid, 0.64, 30, midCol, 1.5);
  drawLayer(near, 0.78, 18, botCol, 2.7);

  return { far, mid, near };
}

/**
 * Legacy-compatible helper that returns a 1920x1080 3-row composite preview sheet.
 */
export function createFallbackOceanSheetCanvas(): HTMLCanvasElement {
  const w = 1920;
  const rowH = 360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = rowH * 3;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const biomes = [
    {
      planes: bakeFallbackPlanes(w, rowH, '#0369a1', '#0e7490', '#f59e0b', '#38bdf8'),
      topDepth: 40,
      botDepth: 420,
    },
    {
      planes: bakeFallbackPlanes(w, rowH, '#1e3a8a', '#172554', '#0f172a', '#22d3ee'),
      topDepth: 560,
      botDepth: 1050,
    },
    {
      planes: bakeFallbackPlanes(w, rowH, '#1e1b4b', '#14111d', '#09070e', '#f97316'),
      topDepth: 1220,
      botDepth: 1850,
    },
  ];

  biomes.forEach((b, idx) => {
    const y0 = idx * rowH;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + rowH);
    grad.addColorStop(0, sampleBathymetricWaterColor(b.topDepth).css);
    grad.addColorStop(1, sampleBathymetricWaterColor(b.botDepth).css);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, w, rowH);
    ctx.drawImage(b.planes.far, 0, y0);
    ctx.drawImage(b.planes.mid, 0, y0);
    ctx.drawImage(b.planes.near, 0, y0);
  });

  return canvas;
}

/**
 * True 5-Layer Multi-Plane AI-Illustrated Ocean Environment Engine:
 * - Layer 0: Seamless AI-painted Water Column Backdrop (`bg_{zone}_0_water`) blended over continuous Bathymetric Water Spectrum (`0.04x` horizontal, `0.010x` vertical parallax)
 * - Layer 1: Distant Seamounts / Sunken Atlantean Ruins / Prehistoric Abyssal Skull (`bg_{zone}_1_far`, `0.10x` horizontal, `0.015x` vertical parallax)
 * - Layer 2: Ambient Marine Life Sprites (`bg_ambient_sprites` — sardine baitballs, butterflyfish, manta rays, glowing jellyfish, lanternfish, `0.16x` horizontal, `0.022x` vertical parallax)
 * - Layer 3: Midground Coral Cliffs / Whale Ribcage Canyon / Black Smoker Chimneys (`bg_{zone}_2_mid`, `0.22x` horizontal, `0.028x` vertical parallax)
 * - Layer 4: Foreground Pearl Clams & Anchor / Glowing Rune Monoliths / Molten Lava Crust (`bg_{zone}_3_near`, `0.38x` horizontal, `0.042x` vertical parallax) + Animated Swaying Kelp & Sea Whip Sprites (`0.42x` horizontal, `0.042x` vertical parallax)
 */
export class ParallaxBackground {
  public layers: HTMLCanvasElement[] = [];
  public loaded: boolean = false;
  private biomePlanes: BiomeParallaxPlanes[] = [];
  private ambientSprites: Partial<Record<AmbientSpriteKind, HTMLCanvasElement>> = {};
  private assetsLoadingStarted: boolean = false;
  private processingQueue: Array<() => void> = [];
  private isProcessingQueueRunning: boolean = false;
  private vignetteCanvas: HTMLCanvasElement | null = null;
  private bubbles: AmbientBubble[] = [];
  private schools: AmbientBackgroundSchool[] = [];
  private smoothedRelativePreyScale: number = 1.0;
  private smoothedDepthRefY: number = -1;
  private readonly ambientRng: () => number;

  constructor() {
    this.ambientRng = createChunkRng(
      WorldConfig.worldSeed,
      WorldConfig.generatorVersion,
      0,
      0,
      'ambient'
    );
    const kinds: AmbientBubble['kind'][] = [
      'BUBBLE',
      'MARINE_SNOW',
      'BIO_SPORE',
      'MAGMA_EMBER',
    ];
    for (let i = 0; i < 40; i++) {
      this.bubbles.push({
        x: this.ambientRng() * 2400,
        y: this.ambientRng() * 1400,
        r: 1.8 + this.ambientRng() * 4.4,
        speedY: 14 + this.ambientRng() * 26,
        wobblePhase: this.ambientRng() * Math.PI * 2,
        alpha: 0.18 + this.ambientRng() * 0.34,
        kind: kinds[i % kinds.length],
      });
    }

    const shallowSprites: AmbientSpriteKind[] = [
      'SARDINE_BAITBALL',
      'BUTTERFLYFISH_SCHOOL',
      'MANTA_RAY',
      'BUTTERFLYFISH_SCHOOL',
      'SARDINE_BAITBALL',
    ];
    const twilightSprites: AmbientSpriteKind[] = [
      'MOON_JELLYFISH',
      'LANTERNFISH_SCHOOL',
      'MOON_JELLYFISH',
      'LANTERNFISH_SCHOOL',
    ];

    for (let s = 0; s < 6; s++) {
      const isTwilight = s >= 3;
      const spriteKind = isTwilight
        ? twilightSprites[(s - 3) % twilightSprites.length]
        : shallowSprites[s % shallowSprites.length];
      this.schools.push({
        x: s * 560 + (s * 113) % 220,
        y: 0.18 + (s % 4) * 0.11,
        speedX: spriteKind === 'SARDINE_BAITBALL' ? 8 : spriteKind === 'MANTA_RAY' ? 22 : 16 + (s % 3) * 5,
        dir: s % 2 === 0 ? 1 : -1,
        count: 5 + (s % 3) * 2,
        spreadX: 38 + (s % 3) * 14,
        spreadY: 16 + (s % 2) * 10,
        phase: s * 1.1,
        zone: isTwilight ? 1 : 0,
        spriteKind,
        scale: spriteKind === 'MANTA_RAY' ? 0.54 : spriteKind === 'SARDINE_BAITBALL' ? 0.44 : 0.40,
      });
    }
  }

  private getOrCreateVignetteCanvas(): HTMLCanvasElement | null {
    if (this.vignetteCanvas) return this.vignetteCanvas;
    if (typeof document === 'undefined') return null;
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const vCtx = c.getContext('2d');
    if (vCtx) {
      const cx = size * 0.5;
      const cy = size * 0.5;
      const grad = vCtx.createRadialGradient(cx, cy, size * 0.24, cx, cy, size * 0.72);
      grad.addColorStop(0, 'rgba(2, 6, 23, 0)');
      grad.addColorStop(0.7, 'rgba(4, 12, 34, 0.48)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
      vCtx.fillStyle = grad;
      vCtx.fillRect(0, 0, size, size);
    }
    this.vignetteCanvas = c;
    return c;
  }

  /**
   * Executes at most 1 heavy offscreen image flood-fill/seam task per animation frame
   * so startup never stalls the 60 FPS game loop.
   */
  private enqueueProcessingTask(task: () => void, highPriority: boolean = false): void {
    if (highPriority) {
      this.processingQueue.unshift(task);
    } else {
      this.processingQueue.push(task);
    }
    if (!this.isProcessingQueueRunning) {
      this.isProcessingQueueRunning = true;
      this.pumpProcessingQueue();
    }
  }

  private pumpProcessingQueue(): void {
    const nextTask = this.processingQueue.shift();
    if (!nextTask) {
      this.isProcessingQueueRunning = false;
      return;
    }
    try {
      nextTask();
    } catch {
      // Ignore individual asset processing errors
    }
    if (typeof window !== 'undefined') {
      window.setTimeout(() => this.pumpProcessingQueue(), 16);
    } else {
      this.pumpProcessingQueue();
    }
  }

  /**
   * Initializes procedural fallback immediately and kicks off asynchronous loading + staggered offscreen alpha/seam processing
   * for all 13 AI-generated background layer assets.
   */
  public load(_url?: string): void {
    if (typeof document === 'undefined') return;

    if (this.biomePlanes.length < 3) {
      const shallow = bakeFallbackPlanes(640, 260, '#0369a1', '#0e7490', '#f59e0b', '#38bdf8');
      const twilight = bakeFallbackPlanes(640, 260, '#1e3a8a', '#172554', '#0f172a', '#22d3ee');
      const abyssal = bakeFallbackPlanes(640, 260, '#1e1b4b', '#14111d', '#09070e', '#f97316');
      this.biomePlanes = [shallow, twilight, abyssal];
      this.layers = [shallow.near, twilight.near, abyssal.near];
      this.loaded = true;
    }

    if (this.assetsLoadingStarted || typeof Image === 'undefined') return;
    this.assetsLoadingStarted = true;

    const loadImg = (
      src: string,
      highPriority: boolean,
      onReady: (img: HTMLImageElement) => void
    ) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          this.enqueueProcessingTask(() => onReady(img), highPriority);
        }
      };
      img.src = src;
    };

    // 1. Shallow Zone Water Canopy (0m ~ 520m — original Far/Mid/Near PNG strips removed)
    loadImg(OCEAN_LAYER_ASSET_PATHS.shallow.water, true, (img) => {
      this.biomePlanes[0].water = processWaterLayerToSeamlessTile(img);
    });

    // 2. Ambient Marine Sprite Sheet (4x2 grid)
    loadImg(OCEAN_LAYER_ASSET_PATHS.ambientSprites, false, (img) => {
      this.ambientSprites = sliceAmbientSpriteSheet(img);
    });

    // 3. Twilight Zone Water Backdrop (520m ~ 1150m — original Far/Mid/Near PNG strips removed)
    loadImg(OCEAN_LAYER_ASSET_PATHS.twilight.water, false, (img) => {
      this.biomePlanes[1].water = processWaterLayerToSeamlessTile(img);
    });

    // 4. Abyss Zone Water Backdrop (1150m+ — original Far/Mid/Near PNG strips removed)
    loadImg(OCEAN_LAYER_ASSET_PATHS.abyss.water, false, (img) => {
      this.biomePlanes[2].water = processWaterLayerToSeamlessTile(img);
    });
  }

  /**
   * Computes physically consistent, strictly ordered vertical parallax offsets (Far < Mid < Near)
   * anchored at each biome's seabed floor (`biomeFloorY`) using a single shared normalized elevation
   * curve `u = Math.tanh(Math.max(0, biomeFloorY - midWorldY) / 480)` in `[0, 1]`:
   * - Because all three planes share the exact same monotonic curve `u` with strictly increasing
   *   positive amplitudes (`far: 8px < mid: 16px < near: 28px`, velocity ratio `1 : 2 : 3.5`),
   *   their relative motion direction is 100% consistent at every depth in the biome:
   *   1. Shark dives DOWN (`midWorldY` increases -> `u` decreases):
   *      All layers move UP on screen, with Near rising 1.75x faster than Mid (`nearY - midY` decreases),
   *      so the closer Foreground rises relative to Midground and naturally occludes more of the lower Midground.
   *   2. Shark swims UP (`midWorldY` decreases -> `u` increases):
   *      All layers move DOWN on screen, with Near dropping 1.75x faster than Mid (`nearY - midY` increases),
   *      so the closer Foreground drops faster and reveals more of the Midground behind it.
   *   3. Near never lifts its bottom edge above `viewH` (`nearY = 28 * u >= 0`) and never freezes mid-biome.
   */
  private computeBiomeVerticalOffsets(
    midWorldY: number,
    biomeFloorY: number,
    nearScale: number = 1.0
  ): { farY: number; midY: number; nearY: number } {
    const u = Math.tanh(Math.max(0, biomeFloorY - midWorldY) / 480);
    return {
      farY: (-20 + 2.5 * u) * nearScale,
      midY: (-10 + 14 * u) * nearScale,
      nearY: 28 * u * nearScale,
    };
  }

  /**
   * Draws a horizontally-seamless Layer 0 Water Backdrop anchored cleanly at the top of the viewport
   * with ultra-subtle 0.012x horizontal and <=2px vertical parallax so the distant water surface canopy
   * remains nearly stationary even when the shark swims up to the sea surface, while shrinking subtly (`waterScale`)
   * around the viewport center as the shark grows.
   */
  private drawSeamlessWaterBackdrop(
    ctx: CanvasRenderingContext2D,
    waterPlane: HTMLCanvasElement | undefined,
    cameraX: number,
    sharkDepthY: number,
    viewW: number,
    viewH: number,
    alpha: number,
    layerScale: number = 1.0
  ): void {
    if (!waterPlane || alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const aspect = waterPlane.width / Math.max(1, waterPlane.height);
    const isPanoramicCanopy = aspect > 3.0;
    const refH = isPanoramicCanopy
      ? Math.min(viewH, Math.max(360, viewW * 0.65))
      : viewH;
    const baseDrawH = isPanoramicCanopy
      ? Math.max(108, Math.min(360, Math.round(refH * 0.36)))
      : viewH + 24;
    const drawH = isPanoramicCanopy
      ? Math.max(88, Math.round(baseDrawH * layerScale))
      : viewH + 24;
    const baseTileW = Math.max(320, Math.round(baseDrawH * aspect));
    const tileW = Math.max(240, Math.round(drawH * aspect));
    const scrollFactor = isPanoramicCanopy ? 0.012 : 0.025;
    const normPhase = (((cameraX * scrollFactor) / baseTileW) % 1 + 1) % 1;
    const centerAnchorX = viewW * 0.5 - normPhase * tileW;
    const startX = (((centerAnchorX % tileW) + tileW) % tileW) - tileW;
    const u = Math.tanh(Math.max(0, 680 - sharkDepthY) / 480);
    const parallaxY = isPanoramicCanopy
      ? -Math.round((1 - u) * 2)
      : -Math.tanh((Math.max(0, sharkDepthY) * 0.01) / 10) * 6;

    for (let x = startX; x < viewW; x += tileW) {
      ctx.drawImage(waterPlane, Math.floor(x), parallaxY, tileW + 1, drawH);
    }
    ctx.restore();
  }

  /**
   * Draws a single transparent parallax terrain plane seamlessly tiled across X
   * with column-sliced continuous L1 terrain contour warping (`sampleColumnContourOffsetPx`),
   * preserving natural artwork proportions, coupling vertical offset to camera depth,
   * and scaling by `layerScale` (`nearScale < midScale < farScale`) around the viewport center
   * with zero horizontal phase jump when the shark levels up or evolves.
   */
  private drawParallaxPlane(
    ctx: CanvasRenderingContext2D,
    plane: HTMLCanvasElement,
    cameraX: number,
    viewW: number,
    viewH: number,
    parallaxXFactor: number,
    verticalOffsetPx: number,
    alpha: number,
    heightViewportRatio: number = 0.44,
    minHeightPx: number = 180,
    maxHeightPx: number = 460,
    maxSkirtExtendPx?: number,
    layerScale: number = 1.0,
    depthRefY: number = 260,
    layerKind: 'FAR' | 'MID' | 'NEAR' = 'NEAR'
  ): void {
    if (alpha <= 0.01 || !plane || plane.width <= 0 || plane.height <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const aspect = plane.width / plane.height;
    const baseTargetH = Math.max(
      minHeightPx,
      Math.min(maxHeightPx, Math.round(viewH * heightViewportRatio))
    );
    const targetH = Math.max(
      Math.max(36, Math.round(minHeightPx * layerScale)),
      Math.round(baseTargetH * layerScale)
    );
    const baseTileW = Math.max(256, Math.round(baseTargetH * aspect));
    const tileW = Math.max(148, Math.round(targetH * aspect));
    const baseDrawY = viewH - targetH + verticalOffsetPx;

    if (baseDrawY >= viewH + 72) {
      ctx.restore();
      return;
    }

    const normPhase = (((cameraX * parallaxXFactor) / baseTileW) % 1 + 1) % 1;
    const centerAnchorX = viewW * 0.5 - normPhase * tileW;
    const startX = (((centerAnchorX % tileW) + tileW) % tileW) - tileW;

    // Column-sliced continuous L1 terrain contour warping:
    // Each vertical slice samples the global world coordinate `colWorldX` so adjacent tiles & Chunks
    // bend organically into submarine ridges, flat sandy plains, and steep canyon walls with zero seam!
    const sliceColumns = 32;
    const srcSliceW = plane.width / sliceColumns;
    const dstSliceW = tileW / sliceColumns;
    const worldScaleFactor = Math.max(0.08, parallaxXFactor * 2.4);

    for (let x = startX; x < viewW; x += tileW) {
      for (let col = 0; col < sliceColumns; col++) {
        const dx = Math.floor(x + col * dstSliceW);
        const nextDx = Math.floor(x + (col + 1) * dstSliceW);
        const drawSliceW = Math.max(1, nextDx - dx);
        if (dx + drawSliceW < 0 || dx > viewW) continue;

        const sliceCenterX = dx + drawSliceW * 0.5;
        const colWorldX =
          cameraX + (sliceCenterX - viewW * 0.5) / Math.max(0.35, layerScale) / worldScaleFactor;
        const contourDy =
          proceduralOceanWorld.terrainGenerator.sampleColumnContourOffsetPx(
            colWorldX,
            depthRefY,
            layerKind
          ) * layerScale;
        const drawY = Math.round(baseDrawY + contourDy);
        // When contourDy < 0 (ridge uplift), stretch colTargetH downward so the bottom edge remains solidly anchored at viewH with zero barcode seam
        const ridgeStretchH = contourDy < 0 ? Math.ceil(-contourDy) + 4 : 0;
        const colTargetH = targetH + ridgeStretchH;

        const sx = Math.max(0, Math.floor(col * srcSliceW));
        const sw = Math.max(1, Math.min(plane.width - sx, Math.ceil(srcSliceW)));

        ctx.drawImage(
          plane,
          sx,
          0,
          sw,
          plane.height,
          dx,
          drawY,
          drawSliceW,
          colTargetH
        );
      }
    }

    ctx.restore();
  }

  /**
   * Draws live swaying kelp (`GIANT_KELP`), glowing twilight sea-whips (`BIOLUM_SEA_WHIP`),
   * and rising bubble columns (`BUBBLE_STREAM`) sliced from `bg_ambient_sprites` and locked
   * to the foreground seabed plane (`0.38x` horizontal, `nearY` vertical & `nearScale` size) so roots never slide.
   */
  private drawAnimatedSeabedSprites(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    verticalOffsetPx: number,
    alpha: number,
    mode: 'SHALLOW' | 'TWILIGHT',
    nearScale: number = 1.0
  ): void {
    if (alpha <= 0.02 || verticalOffsetPx > 160) return;

    const bubbleSprite = this.ambientSprites.BUBBLE_STREAM;
    if (!bubbleSprite) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const baseSpacing = 360;
    const spacing = Math.max(160, baseSpacing * nearScale);
    const centerWorldIdx = (cameraX * 0.38) / baseSpacing;
    const halfSpanIdx = Math.ceil((viewW * 0.5 + 220) / spacing);
    const firstWorldIdx = Math.floor(centerWorldIdx) - halfSpanIdx;
    const lastWorldIdx = Math.ceil(centerWorldIdx) + halfSpanIdx;
    const baseY = viewH + verticalOffsetPx;

    for (let worldIdx = firstWorldIdx; worldIdx <= lastWorldIdx; worldIdx++) {
      const screenX = viewW * 0.5 + (worldIdx - centerWorldIdx) * spacing;
      const hash = Math.abs(Math.sin(worldIdx * 12.9898) * 43758.5453);
      const frac = hash - Math.floor(hash);
      const anchorX = screenX + (frac - 0.5) * 70 * nearScale;
      const anchorY = baseY + 8 * nearScale;

      // Occasional rising bubble stream in shallow reef
      if (mode === 'SHALLOW' && bubbleSprite && Math.abs(worldIdx) % 2 === 0) {
        const bH = 105 * nearScale;
        const bW = bH * (bubbleSprite.width / bubbleSprite.height);
        const riseOffset =
          ((nowMs * 0.028 + Math.abs(worldIdx) * 45) % 90) * nearScale;
        const bAlpha = Math.sin((riseOffset / (90 * nearScale)) * Math.PI) * 0.55 * alpha;
        ctx.save();
        ctx.globalAlpha = Math.max(0, bAlpha);
        ctx.drawImage(
          bubbleSprite,
          anchorX + 42 * nearScale - bW * 0.5,
          anchorY - 45 * nearScale - riseOffset - bH,
          bW,
          bH
        );
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /**
   * Draws distant atmospheric marine life (`bg_ambient_sprites`: sardine baitballs, butterflyfish schools,
   * manta rays, glowing moon jellyfish, and deep-sea lanternfish) in the mid-far water column (`0.16x` horizontal,
   * `12px` vertical amplitude between Far `8px` and Mid `16px`) scaled by `ambientScale` as the shark grows.
   */
  private drawDistantAmbientSchools(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    sharkY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    dt: number,
    screenSurfaceY: number,
    ambientScale: number = 1.0,
    nearScale: number = 1.0,
    shallowSchoolWeight: number = 1.0,
    twilightSchoolWeight: number = 0.0
  ): void {
    if (shallowSchoolWeight <= 0.01 && twilightSchoolWeight <= 0.01) return;

    ctx.save();
    const wrapW = viewW + 420;

    for (const sc of this.schools) {
      const zoneFade = sc.zone === 0 ? shallowSchoolWeight : twilightSchoolWeight;
      if (zoneFade <= 0.015) continue;

      sc.x += sc.speedX * sc.dir * dt;
      sc.phase += dt * 2.4;

      const baseX =
        (((sc.x - cameraX * 0.16 * ambientScale) % wrapW) + wrapW) % wrapW - 210;
      const zoneFloorY = sc.zone === 0 ? 680 : 1340;
      const u = Math.tanh(Math.max(0, zoneFloorY - sharkY) / 480);
      const schoolParallaxY = (-6 + 12 * u) * nearScale;
      const bobY = Math.sin(sc.phase * 0.65) * 9 * ambientScale;
      const baseY = viewH * sc.y + schoolParallaxY + bobY;

      const distBelowSurface = baseY - (screenSurfaceY + 38);
      if (distBelowSurface <= 0) continue;
      const surfaceFade = Math.min(1, distBelowSurface / 56);
      const effectiveFade = zoneFade * surfaceFade;
      if (effectiveFade <= 0.015) continue;

      const sprite = this.ambientSprites[sc.spriteKind];
      if (sprite && sprite.width > 0 && sprite.height > 0) {
        ctx.save();
        const baseOpacity =
          sc.spriteKind === 'MOON_JELLYFISH'
            ? 0.56
            : sc.spriteKind === 'MANTA_RAY'
            ? 0.38
            : 0.46;
        ctx.globalAlpha = baseOpacity * effectiveFade;
        ctx.translate(baseX, baseY);

        const drawW = sprite.width * sc.scale * ambientScale;
        const drawH = sprite.height * sc.scale * ambientScale;

        if (sc.spriteKind === 'SARDINE_BAITBALL') {
          ctx.rotate(nowMs * 0.00035 * sc.dir);
        } else if (sc.spriteKind === 'MOON_JELLYFISH') {
          const pulse = Math.sin(sc.phase * 1.1) * 0.06;
          ctx.scale(1 - pulse, 1 + pulse);
        } else {
          const nativeFacingDir = 1;
          if (sc.dir !== nativeFacingDir) {
            ctx.scale(-1, 1);
          }
          ctx.rotate(Math.sin(sc.phase * 0.8) * 0.04);
        }

        ctx.drawImage(sprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
        ctx.restore();
      } else {
        ctx.globalAlpha = 0.22 * effectiveFade;
        ctx.fillStyle = sc.zone === 1 ? '#38bdf8' : '#075985';
        for (let f = 0; f < sc.count; f++) {
          const fx =
            baseX +
            Math.cos(f * 1.9 + sc.phase * 0.25) * sc.spreadX * ambientScale +
            f * 7 * -sc.dir * ambientScale;
          const fy =
            baseY + Math.sin(f * 2.3 + sc.phase * 0.4) * sc.spreadY * ambientScale;
          ctx.beginPath();
          ctx.ellipse(
            fx,
            fy,
            5.5 * ambientScale,
            2.2 * ambientScale,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /**
   * Renders the complete 5-layer depth-continuous AI-illustrated ocean environment,
   * using staggered C2 quintic per-plane transitions, vertical spatial emergence/subduction,
   * strict Far -> Mid -> Near cross-biome depth ordering, and continuous 3-biome particle blending.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    sharkY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    dt: number,
    cameraY: number = sharkY,
    renderZoom: number = 1,
    relativePreyScale: number = 1.0
  ): void {
    if (this.biomePlanes.length < 3) {
      this.load();
    }

    const targetRelScale = Number.isFinite(relativePreyScale)
      ? Math.max(0.4, Math.min(1.0, relativePreyScale))
      : 1.0;
    if (
      dt <= 0 ||
      Math.abs(targetRelScale - this.smoothedRelativePreyScale) > 0.35
    ) {
      this.smoothedRelativePreyScale = targetRelScale;
    } else {
      const lerpFactor = Math.min(1, dt * 4.5);
      this.smoothedRelativePreyScale +=
        (targetRelScale - this.smoothedRelativePreyScale) * lerpFactor;
    }
    const bgScales = getParallaxLayerGrowthScales(
      this.smoothedRelativePreyScale
    );

    const effZoom = Math.max(0.35, renderZoom);
    const rawDepthY = Math.max(0, sharkY);
    if (
      this.smoothedDepthRefY < 0 ||
      dt <= 0 ||
      Math.abs(rawDepthY - this.smoothedDepthRefY) > 650
    ) {
      this.smoothedDepthRefY = rawDepthY;
    } else {
      this.smoothedDepthRefY +=
        (rawDepthY - this.smoothedDepthRefY) * Math.min(1, dt * 5.8);
    }
    const depthRefY = this.smoothedDepthRefY;
    const transition = computeParallaxBiomeTransitionState(depthRefY);

    const topWorldY = Math.max(0, cameraY - (viewH * 0.5) / effZoom);
    const midWorldY = Math.max(0, cameraY);
    const botWorldY = Math.max(0, cameraY + (viewH * 0.5) / effZoom);
    const topWaterSample = sampleBathymetricWaterColor(topWorldY);
    const midWaterSample = sampleBathymetricWaterColor(midWorldY);
    const botWaterSample = sampleBathymetricWaterColor(botWorldY);

    // ==================== 1. CONTINUOUS WORLD-SPACE WATER COLUMN ====================
    // 1A. Continuous Bathymetric Water Column Base Gradient across full viewport
    {
      const waterGrad = ctx.createLinearGradient(0, 0, 0, viewH);
      waterGrad.addColorStop(0, topWaterSample.css);
      waterGrad.addColorStop(0.5, midWaterSample.css);
      waterGrad.addColorStop(1, botWaterSample.css);
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    // 1B. Layer 0 Painted Water Backdrop (`bg_{zone}_0_water`) blended with C2 quintic weights
    if (this.biomePlanes.length === 3) {
      const [shallow, twilight, abyssal] = this.biomePlanes;

      if (transition.shallow.waterAlpha > 0.01 && shallow.water) {
        this.drawSeamlessWaterBackdrop(
          ctx,
          shallow.water,
          cameraX,
          depthRefY,
          viewW,
          viewH,
          transition.shallow.waterAlpha,
          bgScales.waterScale
        );
      }

      if (transition.twilight.waterAlpha > 0.01 && twilight.water) {
        this.drawSeamlessWaterBackdrop(
          ctx,
          twilight.water,
          cameraX,
          depthRefY,
          viewW,
          viewH,
          transition.twilight.waterAlpha,
          bgScales.waterScale
        );
      }

      if (transition.abyss.waterAlpha > 0.01 && abyssal.water) {
        this.drawSeamlessWaterBackdrop(
          ctx,
          abyssal.water,
          cameraX,
          depthRefY,
          viewW,
          viewH,
          transition.abyss.waterAlpha,
          bgScales.waterScale
        );
      }
    }

    // ==================== 2. UNIFIED DEPTH VISUAL PROFILE + VOLUMETRIC GOD RAYS ====================
    // 直接采样轻量纯函数 getDepthVisualProfile，避免每帧调用旧版 proceduralOceanWorld.stepExploration 引发跨深度带 Chunk 缓存反复清空重建！
    const depthVisualProfile = getDepthVisualProfile(
      meterDepthToWorldY(depthRefY),
      WorldConfig
    );
    const rayVisibility = depthVisualProfile.lightShaftIntensity;
    if (rayVisibility > 0.02) {
      ctx.save();
      const tSec = nowMs * 0.00035;
      const rayOriginY = 0;
      const rayEndY = viewH * 0.72 * bgScales.waterScale;

      ctx.globalAlpha = rayVisibility * 0.32;
      const sharedRayGrad = ctx.createLinearGradient(0, rayOriginY, 0, rayEndY);
      sharedRayGrad.addColorStop(0, 'rgba(254, 249, 195, 0.14)');
      sharedRayGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.045)');
      sharedRayGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = sharedRayGrad;

      const spanB = viewW + 360;
      ctx.beginPath();
      for (let r = 0; r < 5; r++) {
        const baseX =
          (((r * 310 + 90 - cameraX * 0.015) % spanB) + spanB) % spanB - 180;
        const sway = Math.cos(tSec * 1.1 + r * 0.95) * 14;
        ctx.moveTo(baseX, rayOriginY);
        ctx.lineTo(baseX + 46 * bgScales.waterScale, rayOriginY);
        ctx.lineTo(baseX + (155 + sway) * bgScales.waterScale, rayEndY);
        ctx.lineTo(baseX + (42 + sway) * bgScales.waterScale, rayEndY);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }

    // ==================== 3. DISTANT AMBIENT MARINE SCHOOLS & JELLYFISH (ORIGINAL FAR/MID/NEAR PNG PLANES REMOVED) ====================
    this.drawDistantAmbientSchools(
      ctx,
      cameraX,
      depthRefY,
      viewW,
      viewH,
      nowMs,
      dt,
      0,
      bgScales.ambientScale,
      bgScales.nearScale,
      transition.particleShallowWeight,
      transition.particleTwilightWeight
    );

    // ==================== 4. CONTINUOUS 3-BIOME BLENDED ECOLOGICAL PARTICLES (ZERO 520m / 1150m SNAP) ====================
    ctx.save();
    const wS = transition.particleShallowWeight;
    const wT = transition.particleTwilightWeight;
    const wA = transition.particleAbyssWeight;
    const pScale = bgScales.particleScale;
    for (const b of this.bubbles) {
      const twilightVertDir = b.kind === 'MARINE_SNOW' ? 0.35 : -1;
      const verticalDir = -1 * (wS + wA) + twilightVertDir * wT;
      b.y += verticalDir * b.speedY * dt;
      b.wobblePhase += dt * 2.1;

      if (b.y < -20) {
        b.y = viewH + 18;
        b.x = this.ambientRng() * viewW;
      } else if (b.y > viewH + 24) {
        b.y = 10;
        b.x = this.ambientRng() * viewW;
      }

      const screenX =
        (((b.x - cameraX * 0.55 * pScale + Math.sin(b.wobblePhase) * 11 * pScale) % viewW) +
          viewW) %
        viewW;
      const effR = b.r * pScale * (wS * 1.0 + wT * 0.66 + wA * 0.74);

      if (wS > 0.01) {
        ctx.globalAlpha = b.alpha * wS;
        ctx.strokeStyle = '#bae6fd';
        ctx.fillStyle = 'rgba(186, 230, 253, 0.16)';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(screenX, b.y, effR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(
          screenX - effR * 0.32,
          b.y - effR * 0.32,
          effR * 0.24,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      if (wT > 0.01) {
        const pulse = 0.55 + Math.sin(b.wobblePhase * 1.5) * 0.45;
        ctx.globalAlpha = b.alpha * pulse * wT;
        ctx.fillStyle = b.kind === 'BIO_SPORE' ? '#22d3ee' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(screenX, b.y, effR, 0, Math.PI * 2);
        ctx.fill();
      }

      if (wA > 0.01) {
        const pulse = 0.65 + Math.sin(b.wobblePhase * 1.8) * 0.35;
        ctx.globalAlpha = b.alpha * pulse * wA;
        ctx.fillStyle = b.kind === 'BIO_SPORE' ? '#c084fc' : '#fb923c';
        ctx.beginPath();
        ctx.arc(screenX, b.y, effR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ==================== 5. C2-SMOOTH DEPTH PRESSURE VIGNETTE & HYDROTHERMAL MAGMA UNDERGLOW ====================
    if (depthRefY > 420) {
      ctx.save();
      const depthPressure = quinticSmoothstep(420, 1620, depthRefY);
      const vigCanvas = this.getOrCreateVignetteCanvas();
      if (vigCanvas && depthPressure > 0.01) {
        ctx.globalAlpha = depthPressure * 0.48;
        ctx.drawImage(vigCanvas, 0, 0, viewW, viewH);
      }

      if (depthRefY > 1020) {
        const magmaFactor = quinticSmoothstep(1020, 1520, depthRefY);
        const pulse = 0.78 + Math.sin(nowMs * 0.0028) * 0.22;
        ctx.globalAlpha = magmaFactor * 0.18 * pulse;
        const lavaGrad = ctx.createLinearGradient(0, viewH * 0.68, 0, viewH);
        lavaGrad.addColorStop(0, 'rgba(234, 88, 12, 0)');
        lavaGrad.addColorStop(0.65, 'rgba(234, 88, 12, 0.45)');
        lavaGrad.addColorStop(1, 'rgba(251, 146, 60, 1)');
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(0, viewH * 0.68, viewW, viewH * 0.32);
      }
      ctx.restore();
    }
  }
}

export const parallaxBackground = new ParallaxBackground();
