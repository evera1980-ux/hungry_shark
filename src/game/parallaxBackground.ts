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
    water: '/assets/aistudio/bg_twilight_0_water_7d347ca5.png',
    far: '/assets/aistudio/bg_twilight_1_far_449e76e5.png',
    mid: '/assets/aistudio/bg_twilight_2_mid_019e225b.png',
    near: '/assets/aistudio/bg_twilight_3_near_c853fc41.png',
  },
  abyss: {
    water: '/assets/aistudio/bg_abyss_0_water_b0e53cc2.png',
    far: '/assets/aistudio/bg_abyss_1_far_7817748d.png',
    mid: '/assets/aistudio/bg_abyss_2_mid_eff4191c.png',
    near: '/assets/aistudio/bg_abyss_3_near_52736f9c.png',
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
  /** Special handling for shallow_1_far which has #FF00FF top sky and a horizontal water line at y≈512 */
  isShallowFar?: boolean;
  /** Whether to key out enclosed pure-white holes in the upper 62% (e.g. fossil skull eye sockets) */
  punchUpperInteriorWhiteHoles?: boolean;
  /** Target height fraction when rendered on screen */
  trimTopPaddingPx?: number;
}

/**
 * Processes an AI-generated terrain layer (1024x1024 JPEG/PNG with solid #FFFFFF or #FF00FF background):
 * 1. Downscales to an optimal 640px working width (reducing pixel-processing cost and per-frame texture bandwidth by 61%).
 * 2. Flood-fills from the top sky edge (and bottom edge if white margin exists, e.g. bg_abyss_3_near)
 *    so interior white artwork details (pearls, hydrothermal tube worms, crab shells) are 100% preserved.
 * 3. Smoothly despills and feathers anti-aliased JPEG edge pixels.
 * 4. Crops empty sky & bottom margin rows into a wide-aspect terrain strip.
 * 5. Applies a 14% cosine horizontal seam blend so tiled strips loop seamlessly across X.
 */
function processTerrainLayerToSeamlessStrip(
  img: HTMLImageElement,
  options: TerrainProcessOptions = {}
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width || 1024;
  const srcH = img.naturalHeight || img.height || 1024;
  const maxDim = 640;
  const scale = srcW > maxDim ? maxDim / srcW : 1;
  const w = Math.max(64, Math.round(srcW * scale));
  const h = Math.max(64, Math.round(srcH * scale));

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = w;
  rawCanvas.height = h;
  const ctx = rawCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return rawCanvas;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const isBgCandidate = (idx: number): boolean => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    // Solid white / near-white JPEG background
    const isWhite = minC >= 218 && maxC - minC <= 32;
    // Solid #FF00FF magenta JPEG background (used in bg_shallow_1_far)
    const isMagenta = r >= 180 && b >= 180 && g <= 135 && r - g >= 65 && b - g >= 65;
    return isWhite || isMagenta;
  };

  // 1. BFS Flood-Fill from top sky border and bottom border (if bottom has white margin like bg_abyss_3_near)
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

  // Seed top row and upper 40% left/right edges
  for (let x = 0; x < w; x++) {
    pushSeed(x, 0);
    pushSeed(x, 1);
  }
  for (let y = 0; y < Math.floor(h * 0.45); y++) {
    pushSeed(0, y);
    pushSeed(w - 1, y);
  }

  // Check if bottom row is predominantly white margin (like bg_abyss_3_near_52736f9c.png)
  let bottomWhiteCount = 0;
  for (let x = 0; x < w; x += 4) {
    if (isBgCandidate(((h - 1) * w + x) * 4)) bottomWhiteCount++;
  }
  if (bottomWhiteCount > (w / 4) * 0.7) {
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

  // Optional: punch enclosed pure-white holes in the upper 62% (e.g. eye sockets of the fossil skull in bg_abyss_1_far)
  if (options.punchUpperInteriorWhiteHoles) {
    const maxHoleY = Math.floor(h * 0.62);
    for (let y = 0; y < maxHoleY; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!visited[p]) {
          const idx = p * 4;
          if (data[idx] >= 235 && data[idx + 1] >= 235 && data[idx + 2] >= 235) {
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

        // Soften bright white JPEG edge fringe
        if (minC > 175 && maxC - minC < 45) {
          const keep = Math.max(0, Math.min(1, (235 - minC) / 60));
          data[idx] = Math.round(r * 0.68);
          data[idx + 1] = Math.round(g * 0.72);
          data[idx + 2] = Math.round(b * 0.78);
          data[idx + 3] = Math.round(data[idx + 3] * keep);
        }
        // Soften magenta JPEG edge fringe (for bg_shallow_1_far)
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

  // 3. O(W * H) single-pass horizon feathering for bg_shallow_1_far_8898229a.png:
  // Tracks vertical distance from sky in O(1) per pixel down each column (replacing nested while loop).
  if (options.isShallowFar) {
    const startY = Math.floor(h * 0.42);
    const endY = Math.floor(h * 0.68);
    const maxScan = Math.max(24, Math.round(56 * scale));
    const cyanRampSpan = Math.max(16, Math.round(48 * scale));
    const solidRampSpan = Math.max(4, Math.round(7 * scale));

    for (let x = 0; x < w; x++) {
      let distFromSky = 0;
      for (let y = startY; y < endY; y++) {
        const p = y * w + x;
        if (visited[p]) {
          distFromSky = 0;
          continue;
        }
        distFromSky++;
        if (distFromSky < maxScan) {
          const idx = p * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const isBrightCyanBackdrop = g > 145 && b > 155 && b >= r + 35;
          const ramp = isBrightCyanBackdrop
            ? Math.max(0, Math.min(1, (distFromSky - 4) / cyanRampSpan))
            : Math.max(0, Math.min(1, distFromSky / solidRampSpan));
          data[idx + 3] = Math.round(data[idx + 3] * ramp * ramp);
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

  const scaledPad = Math.max(3, Math.round((options.trimTopPaddingPx ?? 8) * scale));
  if (maxY <= minY + 24) {
    minY = Math.floor(h * 0.35);
    maxY = h - 1;
  } else {
    minY = Math.max(0, minY - scaledPad);
    // Trim 2px inside maxY to guarantee zero bottom white border fringe
    maxY = Math.min(h - 1, Math.max(minY + 40, maxY - 2));
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

  return makeHorizontallySeamlessCanvas(cropped, 0.14);
}

/**
 * Processes an AI-generated Layer 0 Water Backdrop into a compact 512x512 horizontally-seamless tileable canvas.
 */
function processWaterLayerToSeamlessTile(img: HTMLImageElement): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width || 1024;
  const srcH = img.naturalHeight || img.height || 1024;
  const maxDim = 512;
  const scale = srcW > maxDim ? maxDim / srcW : 1;
  const w = Math.max(64, Math.round(srcW * scale));
  const h = Math.max(64, Math.round(srcH * scale));
  const raw = document.createElement('canvas');
  raw.width = w;
  raw.height = h;
  const ctx = raw.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0, w, h);
  }
  return makeHorizontallySeamlessCanvas(raw, 0.16);
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

  constructor() {
    const kinds: AmbientBubble['kind'][] = [
      'BUBBLE',
      'MARINE_SNOW',
      'BIO_SPORE',
      'MAGMA_EMBER',
    ];
    for (let i = 0; i < 40; i++) {
      this.bubbles.push({
        x: Math.random() * 2400,
        y: Math.random() * 1400,
        r: 1.8 + Math.random() * 4.4,
        speedY: 14 + Math.random() * 26,
        wobblePhase: Math.random() * Math.PI * 2,
        alpha: 0.18 + Math.random() * 0.34,
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

    // 1. Shallow Zone (0m ~ 520m — highPriority = true since player starts here!)
    loadImg(OCEAN_LAYER_ASSET_PATHS.shallow.water, true, (img) => {
      this.biomePlanes[0].water = processWaterLayerToSeamlessTile(img);
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.shallow.far, true, (img) => {
      this.biomePlanes[0].far = processTerrainLayerToSeamlessStrip(img, {
        isShallowFar: true,
        trimTopPaddingPx: 6,
      });
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.shallow.mid, true, (img) => {
      this.biomePlanes[0].mid = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 8,
      });
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.shallow.near, true, (img) => {
      const processed = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 8,
      });
      this.biomePlanes[0].near = processed;
      this.layers[0] = processed;
    });

    // 2. Ambient Marine Sprite Sheet (4x2 grid)
    loadImg(OCEAN_LAYER_ASSET_PATHS.ambientSprites, false, (img) => {
      this.ambientSprites = sliceAmbientSpriteSheet(img);
    });

    // 3. Twilight Zone (520m ~ 1150m)
    loadImg(OCEAN_LAYER_ASSET_PATHS.twilight.water, false, (img) => {
      this.biomePlanes[1].water = processWaterLayerToSeamlessTile(img);
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.twilight.far, false, (img) => {
      this.biomePlanes[1].far = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 8,
      });
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.twilight.mid, false, (img) => {
      this.biomePlanes[1].mid = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 8,
      });
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.twilight.near, false, (img) => {
      const processed = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 8,
      });
      this.biomePlanes[1].near = processed;
      this.layers[1] = processed;
    });

    // 4. Abyss Zone (1150m+)
    loadImg(OCEAN_LAYER_ASSET_PATHS.abyss.water, false, (img) => {
      this.biomePlanes[2].water = processWaterLayerToSeamlessTile(img);
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.abyss.far, false, (img) => {
      this.biomePlanes[2].far = processTerrainLayerToSeamlessStrip(img, {
        punchUpperInteriorWhiteHoles: true,
        trimTopPaddingPx: 8,
      });
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.abyss.mid, false, (img) => {
      this.biomePlanes[2].mid = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 8,
      });
    });
    loadImg(OCEAN_LAYER_ASSET_PATHS.abyss.near, false, (img) => {
      const processed = processTerrainLayerToSeamlessStrip(img, {
        trimTopPaddingPx: 6,
      });
      this.biomePlanes[2].near = processed;
      this.layers[2] = processed;
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
    biomeFloorY: number
  ): { farY: number; midY: number; nearY: number } {
    const u = Math.tanh(Math.max(0, biomeFloorY - midWorldY) / 480);
    return {
      farY: -20 + 8 * u,
      midY: -10 + 16 * u,
      nearY: 28 * u,
    };
  }

  /**
   * Draws a horizontally-seamless Layer 0 Water Backdrop with gentle 0.04x horizontal
   * and 0.010x vertical parallax, maintaining constant vertical aspect ratio without
   * stretching or bobbing when the shark swims near the surface.
   */
  private drawSeamlessWaterBackdrop(
    ctx: CanvasRenderingContext2D,
    waterPlane: HTMLCanvasElement | undefined,
    cameraX: number,
    cameraY: number,
    waterTopY: number,
    viewW: number,
    viewH: number,
    alpha: number
  ): void {
    if (!waterPlane || alpha <= 0.01 || waterTopY >= viewH) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (waterTopY > 0) {
      ctx.beginPath();
      ctx.rect(0, waterTopY, viewW, viewH - waterTopY);
      ctx.clip();
    }
    const drawH = viewH + 24;
    const aspect = waterPlane.width / Math.max(1, waterPlane.height);
    const tileW = Math.max(320, Math.round(drawH * aspect));
    const scrollX = cameraX * 0.04;
    const startX = -(((scrollX % tileW) + tileW) % tileW);
    const parallaxY = -Math.tanh((Math.max(0, cameraY) * 0.01) / 10) * 10;

    for (let x = startX; x < viewW; x += tileW) {
      ctx.drawImage(waterPlane, Math.floor(x), parallaxY, tileW + 1, drawH);
    }
    ctx.restore();
  }

  /**
   * Draws a single transparent parallax terrain plane seamlessly tiled across X,
   * preserving natural artwork proportions and coupling vertical offset to camera depth.
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
    maxHeightPx: number = 460
  ): void {
    if (alpha <= 0.01 || !plane || plane.width <= 0 || plane.height <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const aspect = plane.width / plane.height;
    const targetH = Math.max(
      minHeightPx,
      Math.min(maxHeightPx, Math.round(viewH * heightViewportRatio))
    );
    const tileW = Math.max(256, Math.round(targetH * aspect));
    const drawY = viewH - targetH + verticalOffsetPx;

    if (drawY >= viewH + 8) {
      ctx.restore();
      return;
    }

    const scrollX = cameraX * parallaxXFactor;
    const startX = -(((scrollX % tileW) + tileW) % tileW);

    for (let x = startX; x < viewW; x += tileW) {
      const dx = Math.floor(x);
      ctx.drawImage(plane, dx, drawY, tileW + 1, targetH);
      // Extend bottom-most row downward if vertical parallax lifted the strip above viewH
      if (drawY + targetH < viewH) {
        ctx.drawImage(
          plane,
          0,
          plane.height - 2,
          plane.width,
          2,
          dx,
          drawY + targetH - 1,
          tileW + 1,
          viewH - (drawY + targetH) + 2
        );
      }
    }

    ctx.restore();
  }

  /**
   * Draws live swaying kelp (`GIANT_KELP`), glowing twilight sea-whips (`BIOLUM_SEA_WHIP`),
   * and rising bubble columns (`BUBBLE_STREAM`) sliced from `bg_ambient_sprites` and locked
   * to the foreground seabed plane (`0.38x` horizontal & `nearY` vertical parallax) so roots never slide.
   */
  private drawAnimatedSeabedSprites(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    verticalOffsetPx: number,
    alpha: number,
    mode: 'SHALLOW' | 'TWILIGHT'
  ): void {
    if (alpha <= 0.02 || verticalOffsetPx > 160) return;

    const floraSprite =
      mode === 'SHALLOW'
        ? this.ambientSprites.GIANT_KELP
        : this.ambientSprites.BIOLUM_SEA_WHIP;
    const bubbleSprite = this.ambientSprites.BUBBLE_STREAM;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const spacing = 360;
    const scrollX = cameraX * 0.38;
    const firstWorldIdx = Math.floor((scrollX - 180) / spacing);
    const count = Math.ceil((viewW + 360) / spacing) + 1;
    const baseY = viewH + verticalOffsetPx;
    const tSec = nowMs * 0.0018;

    for (let i = 0; i < count; i++) {
      const worldIdx = firstWorldIdx + i;
      const screenX = worldIdx * spacing - scrollX;
      const hash = Math.abs(Math.sin(worldIdx * 12.9898) * 43758.5453);
      const frac = hash - Math.floor(hash);
      const swayAngle = Math.sin(tSec + worldIdx * 0.85) * 0.09;

      if (floraSprite && floraSprite.width > 0) {
        const targetH = mode === 'SHALLOW' ? 135 + (Math.abs(worldIdx) % 3) * 20 : 125 + (Math.abs(worldIdx) % 3) * 18;
        const targetW = targetH * (floraSprite.width / floraSprite.height);
        const anchorX = screenX + (frac - 0.5) * 70;
        const anchorY = baseY + 8;

        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.rotate(swayAngle);
        if (worldIdx % 2 === 0) {
          ctx.scale(-1, 1);
        }
        ctx.drawImage(floraSprite, -targetW * 0.5, -targetH, targetW, targetH);
        ctx.restore();

        // Occasional rising bubble stream in shallow reef
        if (mode === 'SHALLOW' && bubbleSprite && Math.abs(worldIdx) % 2 === 0) {
          const bH = 115;
          const bW = bH * (bubbleSprite.width / bubbleSprite.height);
          const riseOffset = ((nowMs * 0.028 + Math.abs(worldIdx) * 45) % 90);
          const bAlpha = Math.sin((riseOffset / 90) * Math.PI) * 0.62 * alpha;
          ctx.save();
          ctx.globalAlpha = Math.max(0, bAlpha);
          ctx.drawImage(
            bubbleSprite,
            anchorX + 42 - bW * 0.5,
            anchorY - 55 - riseOffset - bH,
            bW,
            bH
          );
          ctx.restore();
        }
      } else if (mode === 'SHALLOW') {
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 5;
        const bx = screenX + (frac - 0.5) * 35;
        const kelpH = 64;
        const sway = Math.sin(tSec + worldIdx) * 16;
        ctx.beginPath();
        ctx.moveTo(bx, baseY);
        ctx.quadraticCurveTo(bx + sway * 0.5, baseY - kelpH * 0.5, bx + sway, baseY - kelpH);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Draws distant atmospheric marine life (`bg_ambient_sprites`: sardine baitballs, butterflyfish schools,
   * manta rays, glowing moon jellyfish, and deep-sea lanternfish) in the mid-far water column (`0.16x` horizontal,
   * `12px` vertical amplitude between Far `8px` and Mid `16px`) at reduced atmospheric contrast.
   */
  private drawDistantAmbientSchools(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    sharkY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    dt: number,
    screenSurfaceY: number
  ): void {
    if (sharkY > 1280) return;

    ctx.save();
    const wrapW = viewW + 420;

    for (const sc of this.schools) {
      const inZone =
        sc.zone === 0
          ? sharkY < 620
          : sharkY > 420 && sharkY < 1260;
      if (!inZone) continue;

      const zoneFade =
        sc.zone === 0
          ? sharkY < 440
            ? 1
            : Math.max(0, 1 - (sharkY - 440) / 180)
          : sharkY < 580
          ? (sharkY - 420) / 160
          : sharkY > 1060
          ? Math.max(0, 1 - (sharkY - 1060) / 200)
          : 1;

      if (zoneFade <= 0.02) continue;

      sc.x += sc.speedX * sc.dir * dt;
      sc.phase += dt * 2.4;

      const baseX =
        (((sc.x - cameraX * 0.16) % wrapW) + wrapW) % wrapW - 210;
      const zoneFloorY = sc.zone === 0 ? 680 : 1340;
      const u = Math.tanh(Math.max(0, zoneFloorY - sharkY) / 480);
      const schoolParallaxY = -6 + 12 * u;
      const bobY = Math.sin(sc.phase * 0.65) * 9;
      const baseY = viewH * sc.y + schoolParallaxY + bobY;

      const distBelowSurface = baseY - (screenSurfaceY + 38);
      if (distBelowSurface <= 0) continue;
      const surfaceFade = Math.min(1, distBelowSurface / 56);
      const effectiveFade = zoneFade * surfaceFade;
      if (effectiveFade <= 0.02) continue;

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

        const drawW = sprite.width * sc.scale;
        const drawH = sprite.height * sc.scale;

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
            Math.cos(f * 1.9 + sc.phase * 0.25) * sc.spreadX +
            f * 7 * -sc.dir;
          const fy =
            baseY + Math.sin(f * 2.3 + sc.phase * 0.4) * sc.spreadY;
          ctx.beginPath();
          ctx.ellipse(fx, fy, 5.5, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /**
   * Renders the complete 5-layer depth-continuous AI-illustrated ocean environment.
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
    renderZoom: number = 1
  ): void {
    if (this.biomePlanes.length < 3) {
      this.load();
    }

    const effZoom = Math.max(0.35, renderZoom);
    const topWorldY = cameraY - (viewH * 0.5) / effZoom;
    const midWorldY = cameraY;
    const botWorldY = cameraY + (viewH * 0.5) / effZoom;
    const screenSurfaceY = viewH * 0.5 - cameraY * effZoom;

    // ==================== 1. CONTINUOUS WORLD-SPACE WATER COLUMN & SKY DOME ====================
    const waterTopY = Math.max(0, Math.floor(screenSurfaceY));

    // 1A. Tropical Sky Dome & Distant Horizon Clouds when near the surface (screenSurfaceY > 0)
    if (screenSurfaceY > 0) {
      const skyH = Math.min(viewH, Math.ceil(screenSurfaceY) + 2);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.52, '#38bdf8');
      skyGrad.addColorStop(0.88, '#bae6fd');
      skyGrad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, viewW, skyH);

      const sunX =
        viewW * 0.52 -
        ((((cameraX * 0.03) % viewW) + viewW) % viewW - viewW * 0.5) * 0.25;
      const sunY = Math.max(18, screenSurfaceY - 64);
      const sunHalo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 170);
      sunHalo.addColorStop(0, 'rgba(254, 249, 195, 0.85)');
      sunHalo.addColorStop(0.35, 'rgba(253, 230, 138, 0.32)');
      sunHalo.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = sunHalo;
      ctx.fillRect(0, 0, viewW, skyH);

      ctx.save();
      ctx.fillStyle = 'rgba(14, 116, 144, 0.36)';
      const islandSpan = 960;
      const islStart = -((((cameraX * 0.06) % islandSpan) + islandSpan) % islandSpan);
      for (let ix = islStart; ix < viewW; ix += islandSpan) {
        ctx.beginPath();
        ctx.moveTo(ix + 140, screenSurfaceY + 2);
        ctx.quadraticCurveTo(ix + 235, screenSurfaceY - 38, ix + 310, screenSurfaceY - 14);
        ctx.quadraticCurveTo(ix + 370, screenSurfaceY - 52, ix + 460, screenSurfaceY + 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 1B. Continuous Bathymetric Water Column Base Gradient (3 stops instead of 4)
    if (waterTopY < viewH) {
      const topSampleDepth = Math.max(0, topWorldY);
      const midSampleDepth = Math.max(0, midWorldY);
      const botSampleDepth = Math.max(0, botWorldY);

      const waterGrad = ctx.createLinearGradient(0, waterTopY, 0, viewH);
      waterGrad.addColorStop(0, sampleBathymetricWaterColor(topSampleDepth).css);
      waterGrad.addColorStop(0.5, sampleBathymetricWaterColor(midSampleDepth).css);
      waterGrad.addColorStop(1, sampleBathymetricWaterColor(botSampleDepth).css);
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, waterTopY, viewW, viewH - waterTopY);
    }

    // 1C. Layer 0 Painted Water Backdrop (`bg_{zone}_0_water`) blended seamlessly across depth zones
    if (this.biomePlanes.length === 3 && waterTopY < viewH) {
      const [shallow, twilight, abyssal] = this.biomePlanes;

      if (midWorldY < 680 && shallow.water) {
        const wAlpha0 =
          midWorldY < 440 ? 0.86 : Math.max(0, (1 - (midWorldY - 440) / 240) * 0.86);
        this.drawSeamlessWaterBackdrop(
          ctx,
          shallow.water,
          cameraX,
          midWorldY,
          waterTopY,
          viewW,
          viewH,
          wAlpha0
        );
      }

      if (midWorldY > 420 && midWorldY < 1320 && twilight.water) {
        let wAlpha1 = 0.88;
        if (midWorldY < 660) {
          wAlpha1 = ((midWorldY - 420) / 240) * 0.88;
        } else if (midWorldY > 1060) {
          wAlpha1 = (1 - (midWorldY - 1060) / 260) * 0.88;
        }
        this.drawSeamlessWaterBackdrop(
          ctx,
          twilight.water,
          cameraX,
          midWorldY,
          waterTopY,
          viewW,
          viewH,
          wAlpha1
        );
      }

      if (midWorldY > 1040 && abyssal.water) {
        const wAlpha2 =
          midWorldY < 1300 ? ((midWorldY - 1040) / 260) * 0.92 : 0.92;
        this.drawSeamlessWaterBackdrop(
          ctx,
          abyssal.water,
          cameraX,
          midWorldY,
          waterTopY,
          viewW,
          viewH,
          wAlpha2
        );
      }
    }

    // ==================== 2. BATCHED VOLUMETRIC GOD RAYS (1 GRADIENT + 1 FILL) ====================
    const rayVisibility = Math.max(0, 1 - midWorldY / 1050);
    if (rayVisibility > 0.02 && waterTopY < viewH) {
      ctx.save();
      const tSec = nowMs * 0.00055;
      const rayOriginY = Math.max(0, screenSurfaceY);
      const rayEndY = Math.min(viewH, rayOriginY + viewH * 0.72);

      if (rayEndY > rayOriginY + 12) {
        ctx.globalAlpha = rayVisibility * 0.52;
        const sharedRayGrad = ctx.createLinearGradient(0, rayOriginY, 0, rayEndY);
        sharedRayGrad.addColorStop(0, 'rgba(254, 249, 195, 0.16)');
        sharedRayGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.055)');
        sharedRayGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = sharedRayGrad;

        const spanB = viewW + 360;
        ctx.beginPath();
        for (let r = 0; r < 5; r++) {
          const baseX =
            (((r * 310 + 90 - cameraX * 0.07) % spanB) + spanB) % spanB - 180;
          const sway = Math.cos(tSec * 1.35 + r * 0.95) * 28;
          ctx.moveTo(baseX, rayOriginY);
          ctx.lineTo(baseX + 46, rayOriginY);
          ctx.lineTo(baseX + 155 + sway, rayEndY);
          ctx.lineTo(baseX + 42 + sway, rayEndY);
          ctx.closePath();
        }
        ctx.fill();
      }
      ctx.restore();
    }

    // ==================== 3. LAYER 1 (FAR) -> AMBIENT SPRITES -> LAYER 2 (MID) -> LAYER 3 (NEAR) ====================
    if (this.biomePlanes.length === 3) {
      const [shallow, twilight, abyssal] = this.biomePlanes;
      const shallowOffsets = this.computeBiomeVerticalOffsets(midWorldY, 680);
      const twilightOffsets = this.computeBiomeVerticalOffsets(midWorldY, 1340);
      const abyssOffsets = this.computeBiomeVerticalOffsets(midWorldY, 2100);

      // Biome 0 Far: Sunlit Coral Reef (0m ~ 680m)
      if (midWorldY < 700) {
        const alpha0 =
          midWorldY < 460 ? 1 : Math.max(0, 1 - (midWorldY - 460) / 220);

        // Layer 1: Far Seamount Arches & Sunken Galleon (0.10x horizontal, 8px vertical amplitude)
        this.drawParallaxPlane(
          ctx,
          shallow.far,
          cameraX,
          viewW,
          viewH,
          0.1,
          shallowOffsets.farY,
          alpha0 * 0.92,
          0.56,
          240,
          520
        );
      }

      // Biome 1 Far: Twilight Sunken Atlantean Temple (440m ~ 1340m)
      if (midWorldY > 440 && midWorldY < 1340) {
        let alpha1 = 1;
        if (midWorldY < 660) {
          alpha1 = (midWorldY - 440) / 220;
        } else if (midWorldY > 1080) {
          alpha1 = 1 - (midWorldY - 1080) / 260;
        }

        this.drawParallaxPlane(
          ctx,
          twilight.far,
          cameraX,
          viewW,
          viewH,
          0.1,
          twilightOffsets.farY,
          alpha1 * 0.94,
          0.58,
          250,
          540
        );
      }

      // Biome 2 Far: Abyssal Volcanic Peak & Prehistoric Skull (1060m+)
      if (midWorldY > 1060) {
        const alpha2 =
          midWorldY < 1320 ? (midWorldY - 1060) / 260 : 1;

        this.drawParallaxPlane(
          ctx,
          abyssal.far,
          cameraX,
          viewW,
          viewH,
          0.1,
          abyssOffsets.farY,
          alpha2 * 0.94,
          0.62,
          270,
          580
        );
      }

      // Ambient Marine Schools & Jellyfish (0.16x horizontal, 12px vertical amplitude)
      this.drawDistantAmbientSchools(
        ctx,
        cameraX,
        midWorldY,
        viewW,
        viewH,
        nowMs,
        dt,
        screenSurfaceY
      );

      // Biome 0 Mid & Near
      if (midWorldY < 700) {
        const alpha0 =
          midWorldY < 460 ? 1 : Math.max(0, 1 - (midWorldY - 460) / 220);

        // Layer 2: Midground Coral Reef Cliffs & Purple Tube Sponges (0.22x horizontal, 16px vertical amplitude)
        this.drawParallaxPlane(
          ctx,
          shallow.mid,
          cameraX,
          viewW,
          viewH,
          0.22,
          shallowOffsets.midY,
          alpha0,
          0.42,
          185,
          400
        );
        // Layer 3: Foreground Sandbank, Pearl Clams & Rusty Anchor (0.38x horizontal, 28px vertical amplitude)
        this.drawParallaxPlane(
          ctx,
          shallow.near,
          cameraX,
          viewW,
          viewH,
          0.38,
          shallowOffsets.nearY,
          alpha0,
          0.31,
          135,
          300
        );
        // Layer 4: Swaying Giant Kelp & Rising Bubble Streams locked to Near seabed (0.38x horizontal, 28px vertical amplitude)
        this.drawAnimatedSeabedSprites(
          ctx,
          cameraX,
          viewW,
          viewH,
          nowMs,
          shallowOffsets.nearY,
          alpha0,
          'SHALLOW'
        );
      }

      // Biome 1 Mid & Near: Twilight Whale Ribcage & Glowing Rune Monoliths
      if (midWorldY > 440 && midWorldY < 1340) {
        let alpha1 = 1;
        if (midWorldY < 660) {
          alpha1 = (midWorldY - 440) / 220;
        } else if (midWorldY > 1080) {
          alpha1 = 1 - (midWorldY - 1080) / 260;
        }

        this.drawParallaxPlane(
          ctx,
          twilight.mid,
          cameraX,
          viewW,
          viewH,
          0.22,
          twilightOffsets.midY,
          alpha1,
          0.43,
          190,
          410
        );
        this.drawParallaxPlane(
          ctx,
          twilight.near,
          cameraX,
          viewW,
          viewH,
          0.38,
          twilightOffsets.nearY,
          alpha1,
          0.3,
          130,
          290
        );
        this.drawAnimatedSeabedSprites(
          ctx,
          cameraX,
          viewW,
          viewH,
          nowMs,
          twilightOffsets.nearY,
          alpha1,
          'TWILIGHT'
        );
      }

      // Biome 2 Mid & Near: Abyssal Black Smokers, Tube Worms & Cracked Lava Crust
      if (midWorldY > 1060) {
        const alpha2 =
          midWorldY < 1320 ? (midWorldY - 1060) / 260 : 1;

        this.drawParallaxPlane(
          ctx,
          abyssal.mid,
          cameraX,
          viewW,
          viewH,
          0.22,
          abyssOffsets.midY,
          alpha2,
          0.48,
          210,
          460
        );
        this.drawParallaxPlane(
          ctx,
          abyssal.near,
          cameraX,
          viewW,
          viewH,
          0.38,
          abyssOffsets.nearY,
          alpha2,
          0.22,
          95,
          210
        );
      }
    }

    // ==================== 4. 3-MODE DEPTH-REACTIVE ECOLOGICAL PARTICLES ====================
    ctx.save();
    const isAbyss = midWorldY > 1150;
    const isTwilight = midWorldY >= 520 && midWorldY <= 1150;
    for (const b of this.bubbles) {
      const verticalDir = isTwilight && b.kind === 'MARINE_SNOW' ? 0.35 : -1;
      b.y += verticalDir * b.speedY * dt;
      b.wobblePhase += dt * 2.1;

      if (b.y < Math.max(-20, screenSurfaceY + 6)) {
        b.y = viewH + 18;
        b.x = Math.random() * viewW;
      } else if (b.y > viewH + 24) {
        b.y = Math.max(10, screenSurfaceY + 12);
        b.x = Math.random() * viewW;
      }

      const screenX =
        (((b.x - cameraX * 0.55 + Math.sin(b.wobblePhase) * 11) % viewW) +
          viewW) %
        viewW;

      if (isAbyss) {
        const pulse = 0.65 + Math.sin(b.wobblePhase * 1.8) * 0.35;
        ctx.globalAlpha = b.alpha * pulse;
        ctx.fillStyle = b.kind === 'BIO_SPORE' ? '#c084fc' : '#fb923c';
        ctx.beginPath();
        ctx.arc(screenX, b.y, b.r * 0.72, 0, Math.PI * 2);
        ctx.fill();
      } else if (isTwilight) {
        const pulse = 0.55 + Math.sin(b.wobblePhase * 1.5) * 0.45;
        ctx.globalAlpha = b.alpha * pulse;
        ctx.fillStyle = b.kind === 'BIO_SPORE' ? '#22d3ee' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(screenX, b.y, b.r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = b.alpha;
        ctx.strokeStyle = '#bae6fd';
        ctx.fillStyle = 'rgba(186, 230, 253, 0.16)';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(screenX, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(screenX - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ==================== 5. PRE-BAKED DEPTH PRESSURE VIGNETTE & HYDROTHERMAL MAGMA UNDERGLOW ====================
    if (midWorldY > 520) {
      ctx.save();
      const depthPressure = Math.min(1, (midWorldY - 520) / 1100);
      const vigCanvas = this.getOrCreateVignetteCanvas();
      if (vigCanvas && depthPressure > 0.02) {
        ctx.globalAlpha = depthPressure * 0.48;
        ctx.drawImage(vigCanvas, 0, 0, viewW, viewH);
      }

      if (midWorldY > 1150) {
        const magmaFactor = Math.min(1, (midWorldY - 1150) / 450);
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
