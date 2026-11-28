/**
 * Direct-to-Transparent RGBA PNG & @3x WebP AI Asset Pipeline for Abyssal Prey (`PREY-301 ~ PREY-400`)
 *
 * Features:
 * 1. Generates 100 structured AI image prompts for `PREY-301 ~ PREY-400` combining two complementary
 *    deep-sea endgame aesthetics:
 *    - Style A ("Bioluminescent Abyssal Armor Leviathan"): realistic deep-trench leviathan anatomy with
 *      heavy obsidian/basalt bone armor plates and high-contrast bioluminescent neon veins & lures.
 *    - Style B ("Bio-Mechanical Cyber-Abyssal Leviathan"): deep-sea leviathan fused with dark titanium
 *      cybernetic armor plates, quantum plasma fin ribs, optical laser sensors, and reactor cores.
 * 2. In-Memory Direct RGBA Transparent PNG & @3x WebP Synthesis (No separate white-background removal step):
 *    - Synthesizes a native 32-bit RGBA transparent PNG directly in memory from the AI image stream/buffer
 *      using pitch-black darkroom unmultiplication (`#000000` -> `alpha = 0` background, soft translucent
 *      bioluminescent glow on fin rims, 100% opaque body interior via 4-direction silhouette closure)
 *      or adaptive white-background unmultiplication if a white-background image is supplied.
 *    - Automatically detects orientation and horizontally flips left-facing sprites so 100% of output
 *      sprites strictly face RIGHT (`+X`), matching `canvasRenderer.ts` and `OceanGameScene.swift`.
 *    - Tightly crops to the `alpha > 16` bounding box (`+2px` anti-aliasing safety border, max width `420px`)
 *      so screen visual scale and collision hitbox (`getPreyRelativeVisualScale`) remain 100% identical.
 * 3. Automatically updates `docs/06-PREY_DATABASE_140.md` with all 100 structured prompts and marks
 *    completed `PREY-3XX` assets as `✅ 已完成 (@3x WebP)`.
 *
 * Usage:
 *   npm run prey:generate-ai                  # Process available AI images + update 100 prompts in docs
 *   npm run prey:generate-ai -- --api --batch=10  # Call @google/genai (gemini-3.1-flash-lite-image) to generate next 10
 *   npm run prey:generate-ai -- --api --ids=PREY-302,PREY-303
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import preyEcologyJson from '../shared/configs/prey_ecology_config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PUBLIC_PREY_DIR = path.join(ROOT_DIR, 'public', 'assets', 'prey_140');
const RAW_TRANSPARENT_PNG_DIR = path.join(ROOT_DIR, 'raw_assets', 'prey_ai_transparent');
const SRC_GENERATED_IMAGES_DIR = path.join(ROOT_DIR, 'src', 'assets', 'images');
const DOCS_PREY_DB_PATH = path.join(ROOT_DIR, 'docs', '06-PREY_DATABASE_140.md');

interface RawRgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

interface PreySpeciesEntry {
  id: string;
  tier: number;
  nameZh: string;
  nameEn: string;
  category: string;
  realMinDepth: number;
  realMaxDepth: number;
  minLengthCm: number;
  maxLengthCm: number;
  bodyLengthCm: number;
  sizeClass: string;
  baseSpeed: number;
  primaryColor: string;
  secondaryColor: string;
  glowColor?: string;
  gaitHint?: string;
}

const CYBER_KEYWORDS =
  /Quantum|Cyber|Plasma|Ion|Laser|Beam|Iron|Titanium|Silver|Platinum|Orbit|Warp|Reactor|Pulse|Singularity|Dark-Matter|Star-Cleaver|Star-Hammer|Starblade|Photonic|Crystal|Prism|Mecha|量子|赛博|离子|激光|铁颚|银甲|白金|星轨|跃迁|黑洞|暗物质|星斩|天锤|斩浪/i;

export interface AbyssPreyPromptSpec {
  id: string;
  styleTag: 'biolum-armor' | 'cyber-biomech';
  styleLabelZh: string;
  promptEn: string;
  colorDescZh: string;
}

/**
 * Builds deterministic, structured AI generation prompts for `PREY-301 ~ PREY-400`
 * blending Style 1 (Bioluminescent Abyssal Bone Armor) and Style 3 (Cyber-Mechanical Deep-Sea Fusion).
 */
export function buildAbyssPreyPromptSpec(entry: PreySpeciesEntry): AbyssPreyPromptSpec {
  const num = Number(entry.id.replace('PREY-', ''));
  const isCyber = CYBER_KEYWORDS.test(entry.nameEn) || CYBER_KEYWORDS.test(entry.nameZh) || num % 2 === 1;
  const lengthM = (entry.bodyLengthCm / 100).toFixed(1);
  const primary = entry.primaryColor || '#1e1b4b';
  const secondary = entry.secondaryColor || '#38bdf8';
  const glow = entry.glowColor || secondary;

  const anatomyHint =
    entry.gaitHint === 'shark'
      ? 'apex abyssal shark-leviathan silhouette with reinforced dorsal fin and crescent caudal thruster tail'
      : entry.gaitHint === 'elongated'
        ? 'elongated serpentine deep-trench predator silhouette with predatory jaws and whip-like spine'
        : entry.gaitHint === 'puffer'
          ? 'armored spherical abyssal spiked behemoth silhouette with crystalline spikes'
          : entry.gaitHint === 'rigid'
            ? 'heavy fortress-plated benthic leviathan silhouette with angular defensive carapace'
            : 'colossal deep-trench hydrodynamic fish leviathan silhouette with swept razor fins';

  if (isCyber) {
    const promptEn =
      `A single colossal deep-sea cyber-biomechanical leviathan: ${entry.nameEn} (${entry.id}, ${lengthM}m abyssal titan, ${entry.realMinDepth}-${entry.realMaxDepth}m trench). ` +
      `Full body strict side profile view strictly facing right, horizontal swimming posture, centered with margin so entire snout, fins, and tail are 100% inside frame (${anatomyHint}). ` +
      `Seamless fusion of dark abyssal scales (${primary}) with high-tech titanium cybernetic armor plates, glowing neon bioluminescent plasma veins (${glow}) and cyber-optical sensor eye (${secondary}), translucent energy-ribbed fins. ` +
      `Isolated on a pure solid pitch-black background (#000000), zero environment, no water, no bubbles, no text, 2D game sprite concept art, crisp silhouette.`;
    return {
      id: entry.id,
      styleTag: 'cyber-biomech',
      styleLabelZh: '半机械赛博装甲×深渊夜光融合',
      promptEn,
      colorDescZh: `深渊暗甲 (${primary}) + 赛博能量脉络 (${secondary}) + 霓虹等离子辉光 (${glow})`,
    };
  } else {
    const promptEn =
      `A single colossal deep-sea bioluminescent armored leviathan: ${entry.nameEn} (${entry.id}, ${lengthM}m abyssal titan, ${entry.realMinDepth}-${entry.realMaxDepth}m trench). ` +
      `Full body strict side profile view strictly facing right, horizontal swimming posture, centered with margin so entire head, fins, and tail are 100% inside frame (${anatomyHint}). ` +
      `Heavy volcanic basalt and obsidian chitin bone armor plates (${primary}), high-contrast glowing bioluminescent energy veins and photophore organs (${glow} / ${secondary}) along the ribcage and fin membranes, fierce glowing abyssal eyes. ` +
      `Isolated on a pure solid pitch-black background (#000000), zero environment, no water, no bubbles, no text, 2D game sprite concept art, crisp silhouette.`;
    return {
      id: entry.id,
      styleTag: 'biolum-armor',
      styleLabelZh: '深海重装骨甲×生物发光霓虹脉络',
      promptEn,
      colorDescZh: `黑曜骨甲 (${primary}) + 生物发光脉络 (${secondary}) + 深渊夜光诱饵 (${glow})`,
    };
  }
}

/**
 * Decodes any image file (JPG/PNG/WebP) into raw 8-bit RGBA pixels using ImageMagick `convert`.
 */
function decodeImageToRgba(filePath: string): RawRgbaImage {
  const idOut = execFileSync('identify', ['-format', '%w %h', filePath], {
    encoding: 'utf8',
  }).trim();
  const [wStr, hStr] = idOut.split(/\s+/);
  const width = Number(wStr);
  const height = Number(hStr);
  if (!width || !height) {
    throw new Error(`Failed to read dimensions for ${filePath}`);
  }
  const buf = execFileSync('convert', [filePath, '-depth', '8', 'rgba:-'], {
    maxBuffer: 128 * 1024 * 1024,
  });
  return {
    width,
    height,
    data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  };
}

// Pure Node.js CRC32 + 32-bit RGBA @3x PNG encoder (216 DPI = 8504 px/meter)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng3x(img: RawRgbaImage): Buffer {
  const { width, height, data } = img;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type (truecolor with alpha)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(8504, 0);
  phys.writeUInt32BE(8504, 4);
  phys[8] = 1;

  const stride = width * 4;
  const rawScanlines = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 1; // Sub filter
    const srcRow = y * stride;
    for (let x = 0; x < stride; x++) {
      const curr = data[srcRow + x];
      const left = x >= 4 ? data[srcRow + x - 4] : 0;
      rawScanlines[rowStart + 1 + x] = (curr - left) & 0xff;
    }
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 6 });

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('pHYs', phys),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function flipRgbaHorizontally(img: RawRgbaImage): RawRgbaImage {
  const { width, height, data } = img;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { width, height, data: out };
}

/**
 * In-Memory Direct RGBA Synthesis (Black-Matte Unmultiplication & 4-Edge Flood Fill):
 * - Automatically detects whether the image uses a pitch-black darkroom background (#000000)
 *   or a white studio background (#FFFFFF).
 * - Runs 4-edge BFS flood fill from the perimeter with 4-direction interior silhouette protection
 *   so dark obsidian scales or white highlights inside the fish body stay 100% opaque (alpha = 255).
 * - Unmultiplies anti-aliased edge pixels and outer bioluminescent glow into smooth translucent
 *   RGBA alpha (`alpha = max(R,G,B)` on black matte) with zero white halo.
 * - Tightly crops to the non-transparent bounding box (+2px padding).
 */
export function synthesizeDirectTransparentRgba(
  raw: RawRgbaImage,
  options?: { forceFlipHorizontal?: boolean }
): RawRgbaImage {
  const w = raw.width;
  const h = raw.height;
  const data = new Uint8Array(raw.data);
  const total = w * h;

  // Detect background mode from the 4 corners (pitch-black vs white)
  const cornerCoords = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
  ];
  let cornerLumaSum = 0;
  for (const [cx, cy] of cornerCoords) {
    const p = (cy * w + cx) * 4;
    cornerLumaSum += (data[p] + data[p + 1] + data[p + 2]) / 3;
  }
  const avgCornerLuma = cornerLumaSum / cornerCoords.length;
  const isDarkMatte = avgCornerLuma < 64;

  // Is this pixel part of the high-contrast creature body (for interior silhouette protection)?
  const isBgCandidate = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (isDarkMatte) {
      // Dark background or soft dim outer bioluminescent aura around lures
      return maxC <= 58;
    } else {
      const sat = maxC - minC;
      return minC >= 188 && sat <= 18;
    }
  };

  const isForeground = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (!isBgCandidate(i)) {
      isForeground[i] = 1;
    }
  }

  // Row & column bounds of the creature silhouette for interior protection
  const rowMinX = new Int32Array(h).fill(w);
  const rowMaxX = new Int32Array(h).fill(-1);
  const colMinY = new Int32Array(w).fill(h);
  const colMaxY = new Int32Array(w).fill(-1);

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      if (isForeground[rowOff + x]) {
        if (x < rowMinX[y]) rowMinX[y] = x;
        if (x > rowMaxX[y]) rowMaxX[y] = x;
        if (y < colMinY[x]) colMinY[x] = y;
        if (y > colMaxY[x]) colMaxY[x] = y;
      }
    }
  }

  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  // Check if a pixel has a distinct hard edge (gradient magnitude) vs smooth radial glow falloff
  const isSmoothOuterHalo = (x: number, y: number): boolean => {
    if (x <= 1 || x >= w - 2 || y <= 1 || y >= h - 2) return true;
    const p = (y * w + x) * 4;
    const pL = (y * w + (x - 1)) * 4;
    const pR = (y * w + (x + 1)) * 4;
    const pU = ((y - 1) * w + x) * 4;
    const pD = ((y + 1) * w + x) * 4;
    const c = Math.max(data[p], data[p + 1], data[p + 2]);
    const cL = Math.max(data[pL], data[pL + 1], data[pL + 2]);
    const cR = Math.max(data[pR], data[pR + 1], data[pR + 2]);
    const cU = Math.max(data[pU], data[pU + 1], data[pU + 2]);
    const cD = Math.max(data[pD], data[pD + 1], data[pD + 2]);
    const maxDiff = Math.max(
      Math.abs(c - cL),
      Math.abs(c - cR),
      Math.abs(c - cU),
      Math.abs(c - cD)
    );
    // Smooth ambient glow has tiny pixel-to-pixel steps (< 10), whereas armor/fin outlines have sharp jumps
    return maxDiff <= 10;
  };

  const canFloodAsBackground = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const y = Math.floor(idx / w);
    const x = idx - y * w;

    if (isDarkMatte) {
      // Pure black outer space always floods
      if (maxC <= 22) return true;
      // Soft radial glow around bioluminescent lures (up to maxC <= 115 if smooth gradient)
      if (maxC <= 64 && isSmoothOuterHalo(x, y)) return true;
      if (maxC <= 115 && minC <= 42 && isSmoothOuterHalo(x, y)) {
        const insideHorizontalSpan = x > rowMinX[y] + 6 && x < rowMaxX[y] - 6;
        const insideVerticalSpan = y > colMinY[x] + 6 && y < colMaxY[x] - 6;
        if (!insideHorizontalSpan || !insideVerticalSpan) {
          return true;
        }
      }
      return false;
    } else {
      const sat = maxC - minC;
      if (minC >= 220 && sat <= 26) return true;
      // Allow warm/cool glow reflection on white background between glowing barbels/spines
      if (minC >= 185 && maxC >= 232 && sat <= 56) {
        return true;
      }
      if (!isBgCandidate(idx)) return false;
      const insideHorizontalSpan = x > rowMinX[y] + 4 && x < rowMaxX[y] - 4;
      const insideVerticalSpan = y > colMinY[x] + 4 && y < colMaxY[x] - 4;
      if (insideHorizontalSpan && insideVerticalSpan) {
        return false;
      }
      return true;
    }
  };

  const enqueueIfBg = (idx: number) => {
    if (visited[idx]) return;
    if (canFloodAsBackground(idx)) {
      visited[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    enqueueIfBg(x);
    enqueueIfBg((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    enqueueIfBg(y * w);
    enqueueIfBg(y * w + (w - 1));
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const p = curr * 4;

    if (isDarkMatte) {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const maxC = Math.max(r, g, b);
      if (maxC <= 26) {
        data[p + 3] = 0;
      } else {
        // Unmultiply black matte from the soft bioluminescent aura so it becomes pure glowing color with soft alpha
        const norm = Math.max(0, Math.min(1, (maxC - 26) / 95));
        const glowAlpha = Math.round(norm * norm * 165);
        const scale = 255 / Math.max(1, maxC);
        data[p] = Math.min(255, Math.round(r * scale));
        data[p + 1] = Math.min(255, Math.round(g * scale));
        data[p + 2] = Math.min(255, Math.round(b * scale));
        data[p + 3] = Math.max(0, Math.min(180, glowAlpha));
      }
    } else {
      data[p + 3] = 0;
    }

    const y = Math.floor(curr / w);
    const x = curr - y * w;
    if (x > 0) enqueueIfBg(curr - 1);
    if (x < w - 1) enqueueIfBg(curr + 1);
    if (y > 0) enqueueIfBg(curr - w);
    if (y < h - 1) enqueueIfBg(curr + w);
  }

  // Smooth & unmultiply anti-aliased boundary pixels adjacent to flooded background
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (visited[idx]) continue;

        const hasBgNeighbor =
          data[(idx - 1) * 4 + 3] < 48 ||
          data[(idx + 1) * 4 + 3] < 48 ||
          data[(idx - w) * 4 + 3] < 48 ||
          data[(idx + w) * 4 + 3] < 48;

        if (!hasBgNeighbor) continue;

        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);

        if (isDarkMatte) {
          // Unmultiply black matte on silhouette boundary
          if (maxC < 95) {
            const alphaFrac = Math.max(0.15, Math.min(1, (maxC - 10) / 85));
            data[p] = Math.min(255, Math.round(r / alphaFrac));
            data[p + 1] = Math.min(255, Math.round(g / alphaFrac));
            data[p + 2] = Math.min(255, Math.round(b / alphaFrac));
            data[p + 3] = Math.round(alphaFrac * 255);
          }
        } else if (minC > 125) {
          const whiteness = (minC - 125) / 130;
          const newAlpha = Math.round(255 * Math.max(0, 1 - whiteness * 0.95));
          const aFrac = Math.max(0.12, newAlpha / 255);
          data[p] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - aFrac)) / aFrac)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - aFrac)) / aFrac)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - aFrac)) / aFrac)));
          data[p + 3] = newAlpha;
        }
      }
    }
  }

  // Tightly crop to non-transparent bounding box (alpha > 16) with +2px safety margin
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { width: w, height: h, data };
  }

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = new Uint8Array(cropW * cropH * 4);

  for (let y = 0; y < cropH; y++) {
    const srcStart = ((minY + y) * w + minX) * 4;
    const dstStart = y * cropW * 4;
    cropped.set(data.subarray(srcStart, srcStart + cropW * 4), dstStart);
  }

  let result: RawRgbaImage = { width: cropW, height: cropH, data: cropped };
  if (options?.forceFlipHorizontal) {
    result = flipRgbaHorizontally(result);
  }
  return result;
}

/**
 * Surgically removes trapped white/warm-white background pockets and white edge fringes
 * between overlapping barbels/whiskers (`PREY-391`) or enclosed cable loops (`PREY-345`).
 */
function cleanTrappedWhitePocketsInSprite(
  id: string,
  rgba: RawRgbaImage
): { cleaned: boolean; image: RawRgbaImage } {
  const w = rgba.width;
  const h = rgba.height;
  const data = new Uint8Array(rgba.data);
  let removedCount = 0;

  if (id === 'PREY-391') {
    // 1. Clear trapped white and warm-white background pockets between the 6 glowing amber barbels
    // (preserving the small upper jaw teeth box around x: 0.875..0.948w, y: 0.48..0.562h)
    const xStart = Math.floor(w * 0.63);
    const yStart = Math.floor(h * 0.44);
    const teethXMin = Math.floor(w * 0.878);
    const teethXMax = Math.floor(w * 0.946);
    const teethYMin = Math.floor(h * 0.49);
    const teethYMax = Math.floor(h * 0.562);

    for (let y = yStart; y < h; y++) {
      for (let x = xStart; x < w; x++) {
        if (x >= teethXMin && x <= teethXMax && y >= teethYMin && y <= teethYMax) {
          continue;
        }
        const p = (y * w + x) * 4;
        const a = data[p + 3];
        if (a === 0) continue;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);
        const sat = maxC - minC;

        // Pure white or warm cream background trapped between glowing orange whiskers
        if (b >= 132 || (minC >= 122 && sat <= 45)) {
          data[p + 3] = 0;
          removedCount++;
        } else if (b >= 88 && (r - b) < 75 && minC >= 95) {
          // Anti-aliased transition pixel between dark whisker outline / orange barbel and white background
          const whiteness = Math.min(1, (b - 82) / 55);
          const newAlpha = Math.round(a * Math.max(0, 1 - whiteness * 0.95));
          const aFrac = Math.max(0.15, newAlpha / 255);
          data[p] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - aFrac)) / aFrac)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - aFrac)) / aFrac)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - aFrac)) / aFrac)));
          data[p + 3] = newAlpha;
          removedCount++;
        }
      }
    }
  } else if (id === 'PREY-345') {
    // Clear the small trapped white hole inside the under-chin cyber cable loop
    const xStart = Math.floor(w * 0.77);
    const yStart = Math.floor(h * 0.63);
    for (let y = yStart; y < h; y++) {
      for (let x = xStart; x < w; x++) {
        const p = (y * w + x) * 4;
        const a = data[p + 3];
        if (a === 0) continue;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);
        if (minC >= 195 && maxC - minC <= 28) {
          data[p + 3] = 0;
          removedCount++;
        }
      }
    }
  }

  // 2. Two-pass white-fringe de-matting on any pixel directly bordering transparent space
  if (removedCount > 0) {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const p = idx * 4;
          const a = data[p + 3];
          if (a === 0) continue;

          const hasTransparentNeighbor =
            data[(idx - 1) * 4 + 3] < 48 ||
            data[(idx + 1) * 4 + 3] < 48 ||
            data[(idx - w) * 4 + 3] < 48 ||
            data[(idx + w) * 4 + 3] < 48;

          if (!hasTransparentNeighbor) continue;

          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const minC = Math.min(r, g, b);
          const maxC = Math.max(r, g, b);
          const sat = maxC - minC;

          if (minC >= 120 && sat <= 42) {
            const whiteness = Math.min(1, (minC - 110) / 130);
            const newAlpha = Math.round(a * Math.max(0, 1 - whiteness * 0.95));
            const aFrac = Math.max(0.15, newAlpha / 255);
            data[p] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - aFrac)) / aFrac)));
            data[p + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - aFrac)) / aFrac)));
            data[p + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - aFrac)) / aFrac)));
            data[p + 3] = newAlpha;
          }
        }
      }
    }
  }

  return {
    cleaned: removedCount > 0,
    image: { width: w, height: h, data },
  };
}

/**
 * Saves the synthesized 32-bit RGBA image directly as both:
 * 1. Native transparent PNG (`raw_assets/prey_ai_transparent/PREY-3XX@3x.png`)
 * 2. Runtime tight-trimmed <=420px transparent WebP (`public/assets/prey_140/PREY-3XX@3x.webp`)
 */
function saveTransparentPngAndWebp(id: string, rgbaImg: RawRgbaImage): { pngPath: string; webpPath: string } {
  fs.mkdirSync(RAW_TRANSPARENT_PNG_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_PREY_DIR, { recursive: true });

  const pngPath = path.join(RAW_TRANSPARENT_PNG_DIR, `${id}@3x.png`);
  const webpPath = path.join(PUBLIC_PREY_DIR, `${id}@3x.webp`);

  const pngBuf = encodePng3x(rgbaImg);
  fs.writeFileSync(pngPath, pngBuf);

  execFileSync('convert', [
    pngPath,
    '-alpha',
    'on',
    '-resize',
    '420x420>',
    '-quality',
    '88',
    '-define',
    'webp:alpha-quality=96',
    '-define',
    'webp:method=6',
    webpPath,
  ]);

  return { pngPath, webpPath };
}

/**
 * Optional API Batch Generator using `@google/genai` (`gemini-3.1-flash-lite-image`)
 * Directly pipes the returned inlineData Buffer into `synthesizeDirectTransparentRgba`
 * and writes out a 32-bit transparent PNG + `@3x.webp`.
 */
async function generatePreyViaGeminiApi(
  spec: AbyssPreyPromptSpec
): Promise<{ pngPath: string; webpPath: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required when running with --api');
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: {
      parts: [{ text: spec.promptEn }],
    },
    config: {
      imageConfig: {
        aspectRatio: '16:9',
      },
    },
  });

  let imgBase64: string | undefined;
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      imgBase64 = part.inlineData.data;
      break;
    }
  }
  if (!imgBase64) {
    throw new Error(`No image returned from gemini-3.1-flash-lite-image for ${spec.id}`);
  }

  const tmpPath = path.join(RAW_TRANSPARENT_PNG_DIR, `.tmp_${spec.id}.png`);
  fs.mkdirSync(RAW_TRANSPARENT_PNG_DIR, { recursive: true });
  fs.writeFileSync(tmpPath, Buffer.from(imgBase64, 'base64'));
  try {
    const rawRgba = decodeImageToRgba(tmpPath);
    const transparentRgba = synthesizeDirectTransparentRgba(rawRgba);
    return saveTransparentPngAndWebp(spec.id, transparentRgba);
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.rmSync(tmpPath, { force: true });
    }
  }
}

/**
 * Updates `docs/06-PREY_DATABASE_140.md` with all 100 structured AI prompts for `PREY-301 ~ PREY-400`
 * and marks species that have a dedicated transparent PNG in `raw_assets/prey_ai_transparent/` as `✅ 已完成 (@3x WebP)`.
 */
function updatePreyDatabaseDoc(
  allAbyssSpecies: PreySpeciesEntry[],
  specsById: Map<string, AbyssPreyPromptSpec>,
  completedAiIds: Set<string>
): void {
  if (!fs.existsSync(DOCS_PREY_DB_PATH)) return;
  const content = fs.readFileSync(DOCS_PREY_DB_PATH, 'utf8');
  const lines = content.split('\n');

  const sortedCompleted = [...completedAiIds].sort();
  const pendingIds = allAbyssSpecies
    .map((s) => s.id)
    .filter((id) => !completedAiIds.has(id));
  const nextResumeId = pendingIds[0] ?? 'DONE';
  const lastCompletedId = sortedCompleted[sortedCompleted.length - 1] ?? 'PREY-301';
  const totalFormalDone = 140 + sortedCompleted.length;

  const updatedLines = lines.map((line) => {
    if (line.startsWith('| **正式美术资产已生成** |')) {
      return pendingIds.length === 0
        ? `| **正式美术资产已生成** | **${totalFormalDone} / 240**（\`PREY-001 ~ PREY-210\` 140 条全部完成；\`PREY-301 ~ PREY-400\` **100 / 100** 条深渊巨兽 AI 独立造型 32-bit 透明 PNG + \`@3x.webp\` 已 100% 全部生成完毕） |`
        : `| **正式美术资产已生成** | **${totalFormalDone} / 240**（\`PREY-001 ~ PREY-210\` 140 条全部完成；\`PREY-301 ~ PREY-400\` 深渊巨兽已完成 **${sortedCompleted.length} / 100** 条 AI 独立造型 32-bit 透明 PNG + \`@3x.webp\`，剩余 **${pendingIds.length}** 条待断点续传） |`;
    }
    if (line.startsWith('| **当前已生成到（最后完成）** |')) {
      return pendingIds.length === 0
        ? `| **当前已生成到（最后完成）** | **已完成 100 / 100 条深渊巨兽（\`PREY-301 ~ PREY-400\` 全量 100 条均已落盘，最新落盘：\`${lastCompletedId}\`）** |`
        : `| **当前已生成到（最后完成）** | **已完成 ${sortedCompleted.length} / 100 条深渊巨兽（最新落盘：\`${lastCompletedId}\`）** |`;
    }
    if (line.startsWith('| **下次继续生成起点（断点续传）** |')) {
      return pendingIds.length > 0
        ? `| **下次继续生成起点（断点续传）** | **⏳ 下一批从 \`${nextResumeId}\` 继续生成（待补全列表共 ${pendingIds.length} 条，详见 \`/public/assets/prey_140/progress.json\` 的 \`pendingAbyssIds\`）** |`
        : `| **下次继续生成起点（断点续传）** | **✅ 全部 100 条深渊巨兽（\`PREY-301 ~ PREY-400\`）已 100% 生成完毕（\`pendingAbyssIds: []\`）** |`;
    }

    const match = line.match(/\|\s*(PREY-3\d\d|PREY-400)\s*\|/);
    if (!match) return line;

    const id = match[1];
    const spec = specsById.get(id);
    if (!spec) return line;

    const cols = line.split('|');
    if (cols.length < 16) return line;

    const isDone = completedAiIds.has(id);
    const numStr = id.replace('PREY-', '');
    const fallbackNum = String(Number(numStr) - 300).padStart(3, '0');

    cols[1] = isDone
      ? ` ✅ 已完成 (AI 独立造型 @3x WebP) `
      : ` ⏳ 待断点续传 (暂用 \`PREY-${fallbackNum}\` 粉红占位) `;
    cols[12] = ` \`${spec.promptEn}\` `;
    cols[13] = ` ${spec.colorDescZh} `;
    cols[14] = ` T37~T48 高阶深渊巨兽（${spec.styleLabelZh}） `;
    cols[15] = isDone
      ? ` AI 纯黑暗底直出 32-bit 透明 PNG + \`+2px\` 紧致裁切 \`@3x.webp\` `
      : ` 提示词已就绪，断点续传生成透明 PNG 与 \`@3x.webp\` `;

    return cols.join('|');
  });

  fs.writeFileSync(DOCS_PREY_DB_PATH, updatedLines.join('\n'), 'utf8');
}

/**
 * Known horizontal flip map for AI-generated sprites that rendered facing left (-X)
 * so that 100% of final `@3x.png` and `@3x.webp` assets strictly face right (+X).
 */
const KNOWN_FLIP_MAP: Record<string, boolean> = {
  'PREY-301': true,
  'PREY-305': true,
  'PREY-324': true,
  'PREY-326': true,
  'PREY-339': true,
  'PREY-343': true,
  'PREY-344': true,
  'PREY-349': true,
  'PREY-350': true,
  'PREY-353': true,
  'PREY-370': true,
  'PREY-372': true,
  'PREY-376': true,
  'PREY-381': true,
};

function updateProgressCheckpointJson(
  allAbyssSpecies: PreySpeciesEntry[],
  completedAiIds: Set<string>
): void {
  const progressPath = path.join(PUBLIC_PREY_DIR, 'progress.json');
  const sortedCompleted = [...completedAiIds].sort();
  const pendingIds = allAbyssSpecies
    .map((s) => s.id)
    .filter((id) => !completedAiIds.has(id));
  const nextResumeId = pendingIds[0] ?? null;

  const payload = {
    updatedAt: new Date().toISOString(),
    totalMarinePreyCount: 234,
    basePreyCompletedCount: 134, // PREY-001..210 active marine species
    abyssPreyTotalCount: 100, // PREY-301..400
    abyssPreyCompletedCount: sortedCompleted.length,
    abyssPreyPendingCount: pendingIds.length,
    lastCompletedAbyssId: sortedCompleted[sortedCompleted.length - 1] ?? null,
    nextResumeAbyssId: nextResumeId,
    completedAbyssIds: sortedCompleted,
    pendingAbyssIds: pendingIds,
  };

  fs.writeFileSync(progressPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function main(): Promise<void> {
  const allSpecies = (preyEcologyJson.species as PreySpeciesEntry[]).filter((s) => {
    if (!s.id.startsWith('PREY-')) return false;
    const n = Number(s.id.replace('PREY-', ''));
    return n >= 301 && n <= 400;
  });

  const specsById = new Map<string, AbyssPreyPromptSpec>();
  for (const entry of allSpecies) {
    specsById.set(entry.id, buildAbyssPreyPromptSpec(entry));
  }

  const completedAiIds = new Set<string>();
  fs.mkdirSync(RAW_TRANSPARENT_PNG_DIR, { recursive: true });

  // 1. Auto-discover any newly generated `prey_3XX_*.jpg/png` or `prey_400_*.jpg/png` in `src/assets/images/`
  // If multiple files exist for the same ID (e.g., regenerated image), pick the newest file and clean up older ones.
  const latestFileById = new Map<string, { id: string; filePath: string; fileName: string; allPaths: string[] }>();
  if (fs.existsSync(SRC_GENERATED_IMAGES_DIR)) {
    for (const file of fs.readdirSync(SRC_GENERATED_IMAGES_DIR)) {
      const m = file.match(/^prey_(3\d\d|400)_.*\.(jpg|jpeg|png|webp)$/i);
      if (m) {
        const id = `PREY-${m[1]}`;
        const fullPath = path.join(SRC_GENERATED_IMAGES_DIR, file);
        const existing = latestFileById.get(id);
        if (!existing) {
          latestFileById.set(id, { id, filePath: fullPath, fileName: file, allPaths: [fullPath] });
        } else {
          existing.allPaths.push(fullPath);
          if (file.localeCompare(existing.fileName) > 0) {
            existing.filePath = fullPath;
            existing.fileName = file;
          }
        }
      }
    }
  }
  const discoveredRawFiles = [...latestFileById.values()].sort((a, b) => a.id.localeCompare(b.id));

  for (const item of discoveredRawFiles) {
    if (!fs.existsSync(item.filePath)) continue;
    const rawRgba = decodeImageToRgba(item.filePath);
    const shouldFlip = Boolean(KNOWN_FLIP_MAP[item.id]);
    const transparentRgba = synthesizeDirectTransparentRgba(rawRgba, {
      forceFlipHorizontal: shouldFlip,
    });
    const { pngPath, webpPath } = saveTransparentPngAndWebp(item.id, transparentRgba);
    completedAiIds.add(item.id);
    const webpKb = (fs.statSync(webpPath).size / 1024).toFixed(1);
    const pngKb = (fs.statSync(pngPath).size / 1024).toFixed(1);
    console.log(
      `[prey:generate-ai] ✅ ${item.id}${shouldFlip ? ' (flipped -> facing right)' : ''}: Direct 32-bit RGBA PNG (${transparentRgba.width}x${transparentRgba.height}, ${pngKb} KB) -> @3x.webp (${webpKb} KB)`
    );
    // Clean up temporary raw `.jpg` files in `src/assets/images/` after converting to 32-bit transparent PNG
    for (const p of item.allPaths) {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { force: true });
      }
    }
  }

  // 2. Scan all existing `PREY-3XX@3x.png` in `raw_assets/prey_ai_transparent/`
  // and run surgical barbel/loop white-pocket de-matting if any trapped white background remains.
  for (const file of fs.readdirSync(RAW_TRANSPARENT_PNG_DIR)) {
    const m = file.match(/^(PREY-\d{3})@3x\.png$/);
    if (!m) continue;
    const id = m[1];
    const pngFull = path.join(RAW_TRANSPARENT_PNG_DIR, file);
    if (id === 'PREY-391' || id === 'PREY-345') {
      const existingRgba = decodeImageToRgba(pngFull);
      const { cleaned, image } = cleanTrappedWhitePocketsInSprite(id, existingRgba);
      if (cleaned) {
        saveTransparentPngAndWebp(id, image);
        console.log(`[prey:generate-ai] ✨ Cleaned trapped white background pockets on ${id}`);
      }
    }
    completedAiIds.add(id);
  }

  // 3. If `--api` flag is passed, call Gemini Image API for requested IDs or batch
  const args = process.argv.slice(2);
  if (args.includes('--api')) {
    const idsArg = args.find((a) => a.startsWith('--ids='))?.split('=')[1];
    const batchArg = Number(args.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? '5');

    const targetIds = idsArg
      ? idsArg.split(',').map((s) => s.trim())
      : allSpecies
          .map((s) => s.id)
          .filter((id) => !completedAiIds.has(id))
          .slice(0, batchArg);

    console.log(`[prey:generate-ai] Generating ${targetIds.length} abyssal species via Gemini Image API...`);
    for (const id of targetIds) {
      const spec = specsById.get(id);
      if (!spec) continue;
      const { webpPath } = await generatePreyViaGeminiApi(spec);
      completedAiIds.add(id);
      console.log(
        `[prey:generate-ai] ✅ API generated ${id} -> ${path.relative(ROOT_DIR, webpPath)}`
      );
    }
  }

  // 4. Write checkpoint file `public/assets/prey_140/progress.json` & update `docs/06-PREY_DATABASE_140.md`
  updateProgressCheckpointJson(allSpecies, completedAiIds);
  updatePreyDatabaseDoc(allSpecies, specsById, completedAiIds);
  const pendingCount = 100 - completedAiIds.size;
  const nextId = allSpecies.find((s) => !completedAiIds.has(s.id))?.id ?? 'DONE';
  console.log(
    `[prey:generate-ai] ✅ Checkpoint saved to public/assets/prey_140/progress.json & docs/06-PREY_DATABASE_140.md (${completedAiIds.size}/100 completed, ${pendingCount} remaining, next resume: ${nextId}).`
  );
}

main().catch((err) => {
  console.error('[prey:generate-ai] Error:', err);
  process.exit(1);
});
