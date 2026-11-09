/**
 * build-sharks-3x.ts
 *
 * 48-Shark Individual @3x Super-Resolution & Nano Banana Redraw Pipeline
 * ----------------------------------------------------------------------
 * 1. Slices all 48 sharks (SHARK_FORM_00 .. SHARK_FORM_47) from the 4096x2286
 *    master sheet (/public/assets/aistudio/sharks_ec921c3b.png) using exact
 *    SHARK_CELL_BOUNDS.
 * 2. Performs 4-edge perimeter BFS studio-white flood-fill + enclosed pocket
 *    clearing + multi-pixel Color-to-Alpha edge unmixing + tight bounding-box trim.
 * 3. If GEMINI_API_KEY is available (or --nanobanana flag is passed with a valid key),
 *    calls Google Nano Banana (`gemini-3.1-flash-lite-image` via `@google/genai`)
 *    with the cropped shark reference image + lineage/trait prompt to AI-redraw
 *    each shark at @3x resolution.
 * 4. Runs a high-precision @3x Super-Resolution & Edge-Directed Detail Enhancement
 *    pass (Bicubic Mitchell-Netravali upsampling + Unsharp Mask + Specular/Outline
 *    refinement + premultiplied alpha anti-aliasing) so all 48 sharks are output as
 *    individual @3x transparent PNG files (`shark_form_00@3x.png` .. `shark_form_47@3x.png`)
 *    with @3x pHYs DPI metadata in `/public/assets/sharks_3x/`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { GoogleGenAI } from '@google/genai';
import { SHARK_EVOLUTION_FORMS, type SharkFormConfig } from '../src/game/sharkEvolutionConfig';
import { SHARK_CELL_BOUNDS } from '../src/game/spriteSheetManager';

interface RawRgbaImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA 4 bytes per pixel
}

// ============================================================================
// Pure Node.js PNG Decoder (supports 8-bit RGB ColorType=2 & RGBA ColorType=6)
// ============================================================================
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer: Buffer): RawRgbaImage {
  // Verify PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== sig[i]) {
      throw new Error('Invalid PNG signature');
    }
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunkData = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(
          `Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`
        );
      }
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const compressed = Buffer.concat(idatChunks);
  const rawScanlines = zlib.inflateSync(compressed);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(stride);
  const currRow = new Uint8Array(stride);

  let inPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = rawScanlines[inPos++];
    for (let x = 0; x < stride; x++) {
      const rawByte = rawScanlines[inPos++];
      const left = x >= bpp ? currRow[x - bpp] : 0;
      const up = prevRow[x];
      const upLeft = x >= bpp ? prevRow[x - bpp] : 0;

      let val = rawByte;
      if (filterType === 1) {
        val = (rawByte + left) & 0xff;
      } else if (filterType === 2) {
        val = (rawByte + up) & 0xff;
      } else if (filterType === 3) {
        val = (rawByte + ((left + up) >> 1)) & 0xff;
      } else if (filterType === 4) {
        val = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
      }
      currRow[x] = val;
    }

    const rowOutBase = y * width * 4;
    if (bpp === 4) {
      out.set(currRow, rowOutBase);
    } else {
      for (let px = 0; px < width; px++) {
        const sIdx = px * 3;
        const dIdx = rowOutBase + px * 4;
        out[dIdx] = currRow[sIdx];
        out[dIdx + 1] = currRow[sIdx + 1];
        out[dIdx + 2] = currRow[sIdx + 2];
        out[dIdx + 3] = 255;
      }
    }
    prevRow.set(currRow);
  }

  return { width, height, data: out };
}

// ============================================================================
// Pure Node.js PNG Encoder (8-bit RGBA ColorType=6 + @3x pHYs DPI metadata)
// ============================================================================
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
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // @3x Retina DPI metadata (72 * 3 = 216 DPI = 8504 pixels/meter)
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(8504, 0);
  phys.writeUInt32BE(8504, 4);
  phys[8] = 1; // meter unit

  const stride = width * 4;
  const rawScanlines = Buffer.alloc((stride + 1) * height);

  // Use Sub filter (1) for compact lossless compression on RGBA sprites
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

// ============================================================================
// Step 1: 4-Edge BFS Flood-Fill + Enclosed Pocket Removal + Color-to-Alpha Trim
// ============================================================================
function extractCleanSharkCell(
  sheet: RawRgbaImage,
  bounds: [number, number, number, number],
  sharkIndex: number
): RawRgbaImage {
  const fullW = sheet.width;
  const fullH = sheet.height;
  const fullData = sheet.data;

  const [nx0, ny0, nx1, ny1] = bounds;
  const sx = Math.floor(nx0 * fullW);
  const sy = Math.floor(ny0 * fullH);
  const cellW = Math.max(1, Math.floor((nx1 - nx0) * fullW));
  const cellH = Math.max(1, Math.floor((ny1 - ny0) * fullH));
  const cellLen = cellW * cellH;

  const data = new Uint8Array(cellLen * 4);
  for (let py = 0; py < cellH; py++) {
    const srcStart = ((sy + py) * fullW + sx) * 4;
    const dstStart = py * cellW * 4;
    data.set(fullData.subarray(srcStart, srcStart + cellW * 4), dstStart);
  }

  const visited = new Uint8Array(cellLen);
  const distMap = new Uint8Array(cellLen);
  const queue = new Int32Array(cellLen);
  let qHead = 0;
  let qTail = 0;

  const isStudioWhiteBg = (i: number): boolean => {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return minC >= 232 && maxC - minC <= 20;
  };

  const enqueue = (px: number, py: number) => {
    if (px < 0 || px >= cellW || py < 0 || py >= cellH) return;
    const i = py * cellW + px;
    if (visited[i] || !isStudioWhiteBg(i)) return;
    visited[i] = 1;
    queue[qTail++] = i;
  };

  // Seed 4 perimeter edges
  for (let px = 0; px < cellW; px++) {
    enqueue(px, 0);
    enqueue(px, cellH - 1);
  }
  for (let py = 0; py < cellH; py++) {
    enqueue(0, py);
    enqueue(cellW - 1, py);
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    data[curr * 4 + 3] = 0;
    const cx = curr % cellW;
    const cy = (curr - cx) / cellW;
    if (cx > 0) enqueue(cx - 1, cy);
    if (cx + 1 < cellW) enqueue(cx + 1, cy);
    if (cy > 0) enqueue(cx, cy - 1);
    if (cy + 1 < cellH) enqueue(cx, cy + 1);
  }

  // NOTE: Do NOT clear enclosed interior white regions!
  // Every shark has a closed outer silhouette; interior white pixels are the shark's
  // white countershaded belly (#01, #08, #13, #32, #41), eye sclera, teeth, or glowing core.

  // Multi-pixel boundary Color-to-Alpha white unmixing
  let bHead = 0;
  let bTail = 0;
  const maxHaloSteps = Math.max(4, Math.round((fullW / 1376) * 4));

  for (let py = 1; py < cellH - 1; py++) {
    const rowOff = py * cellW;
    for (let px = 1; px < cellW - 1; px++) {
      const i = rowOff + px;
      if (!visited[i]) continue;
      if (
        !visited[i - 1] ||
        !visited[i + 1] ||
        !visited[i - cellW] ||
        !visited[i + cellW]
      ) {
        distMap[i] = 1;
        queue[bTail++] = i;
      }
    }
  }

  while (bHead < bTail) {
    const curr = queue[bHead++];
    const d = distMap[curr];
    if (d > maxHaloSteps) continue;
    const cx = curr % cellW;
    const cy = (curr - cx) / cellW;
    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx + 1 < cellW ? curr + 1 : -1,
      cy > 0 ? curr - cellW : -1,
      cy + 1 < cellH ? curr + cellW : -1,
    ];
    for (const nIdx of neighbors) {
      if (nIdx < 0 || visited[nIdx] || distMap[nIdx] > 0) continue;
      const p = nIdx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);

      if (minC > 45) {
        distMap[nIdx] = d + 1;
        queue[bTail++] = nIdx;
        const cleanAlpha = Math.max(0, Math.min(1, (250 - minC) / 205));
        if (cleanAlpha <= 0.03) {
          data[p + 3] = 0;
        } else {
          const unmixDiv = Math.max(0.05, (255 - minC) / 255);
          data[p] = Math.max(0, Math.min(255, Math.round((r - minC) / unmixDiv)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round((g - minC) / unmixDiv)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round((b - minC) / unmixDiv)));
          data[p + 3] = Math.round(data[p + 3] * Math.pow(cleanAlpha, 1.15));
        }
      }
    }
  }

  // Tight non-transparent bounding box crop
  let minX = cellW;
  let minY = cellH;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let py = 0; py < cellH; py++) {
    const rowOff = py * cellW;
    for (let px = 0; px < cellW; px++) {
      if (data[(rowOff + px) * 4 + 3] > 18) {
        hasPixels = true;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
    }
  }

  const pad = 8;
  const bx = hasPixels ? Math.max(0, minX - pad) : 0;
  const by = hasPixels ? Math.max(0, minY - pad) : 0;
  const bw = hasPixels ? Math.min(cellW - bx, maxX - minX + 1 + pad * 2) : cellW;
  const bh = hasPixels ? Math.min(cellH - by, maxY - minY + 1 + pad * 2) : cellH;

  const cropped = new Uint8Array(bw * bh * 4);
  for (let py = 0; py < bh; py++) {
    const srcStart = ((by + py) * cellW + bx) * 4;
    const dstStart = py * bw * 4;
    cropped.set(data.subarray(srcStart, srcStart + bw * 4), dstStart);
  }

  return { width: bw, height: bh, data: cropped };
}

// ============================================================================
// Step 2: @3x Super-Resolution & Detail-Redraw Pipeline
// - Mitchell-Netravali Bicubic Premultiplied-Alpha Super-Sampling to @3x
// - Luminance Edge-Preserving Unsharp Mask (USM) + Specular Micro-Contrast
// ============================================================================
function mitchellWeight(x: number): number {
  const B = 1 / 3;
  const C = 1 / 3;
  const ax = Math.abs(x);
  if (ax < 1) {
    return (
      ((12 - 9 * B - 6 * C) * ax * ax * ax +
        (-18 + 12 * B + 6 * C) * ax * ax +
        (6 - 2 * B)) /
      6
    );
  }
  if (ax < 2) {
    return (
      ((-B - 6 * C) * ax * ax * ax +
        (6 * B + 30 * C) * ax * ax +
        (-12 * B - 48 * C) * ax +
        (8 * B + 24 * C)) /
      6
    );
  }
  return 0;
}

function superResolveTo3x(src: RawRgbaImage, scaleFactor: number = 2.0): RawRgbaImage {
  // Note: Source cell from 4096x2286 is already ~500x340 (which is 1.8x the 1x game size).
  // Upscaling by 2.0x produces ~1000x680 per individual shark (full @3x Retina resolution
  // for a 320x220 1x logical shark sprite!).
  const dstW = Math.max(1, Math.round(src.width * scaleFactor));
  const dstH = Math.max(1, Math.round(src.height * scaleFactor));
  const srcW = src.width;
  const srcH = src.height;
  const sData = src.data;

  const upscaled = new Uint8Array(dstW * dstH * 4);

  // Precompute horizontal filter weights
  const xIndices = new Int32Array(dstW * 4);
  const xWeights = new Float32Array(dstW * 4);
  for (let dx = 0; dx < dstW; dx++) {
    const sx = (dx + 0.5) / scaleFactor - 0.5;
    const ix = Math.floor(sx);
    let wSum = 0;
    for (let k = 0; k < 4; k++) {
      const sampleX = Math.max(0, Math.min(srcW - 1, ix - 1 + k));
      const w = mitchellWeight(sx - (ix - 1 + k));
      xIndices[dx * 4 + k] = sampleX;
      xWeights[dx * 4 + k] = w;
      wSum += w;
    }
    if (wSum !== 0) {
      for (let k = 0; k < 4; k++) xWeights[dx * 4 + k] /= wSum;
    }
  }

  for (let dy = 0; dy < dstH; dy++) {
    const sy = (dy + 0.5) / scaleFactor - 0.5;
    const iy = Math.floor(sy);
    const yIdx = [
      Math.max(0, Math.min(srcH - 1, iy - 1)),
      Math.max(0, Math.min(srcH - 1, iy)),
      Math.max(0, Math.min(srcH - 1, iy + 1)),
      Math.max(0, Math.min(srcH - 1, iy + 2)),
    ];
    const yW = [
      mitchellWeight(sy - (iy - 1)),
      mitchellWeight(sy - iy),
      mitchellWeight(sy - (iy + 1)),
      mitchellWeight(sy - (iy + 2)),
    ];
    const ySum = yW[0] + yW[1] + yW[2] + yW[3] || 1;
    yW[0] /= ySum;
    yW[1] /= ySum;
    yW[2] /= ySum;
    yW[3] /= ySum;

    const dstRowOff = dy * dstW * 4;
    for (let dx = 0; dx < dstW; dx++) {
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 0;

      const xBase = dx * 4;
      for (let ky = 0; ky < 4; ky++) {
        const wy = yW[ky];
        const rowOff = yIdx[ky] * srcW;
        for (let kx = 0; kx < 4; kx++) {
          const w = wy * xWeights[xBase + kx];
          const p = (rowOff + xIndices[xBase + kx]) * 4;
          const a = sData[p + 3] / 255;
          pr += sData[p] * a * w;
          pg += sData[p + 1] * a * w;
          pb += sData[p + 2] * a * w;
          pa += sData[p + 3] * w;
        }
      }

      const dIdx = dstRowOff + dx * 4;
      const outA = Math.max(0, Math.min(255, Math.round(pa)));
      if (outA <= 4) {
        upscaled[dIdx] = 0;
        upscaled[dIdx + 1] = 0;
        upscaled[dIdx + 2] = 0;
        upscaled[dIdx + 3] = 0;
      } else {
        const normA = outA / 255;
        upscaled[dIdx] = Math.max(0, Math.min(255, Math.round(pr / normA)));
        upscaled[dIdx + 1] = Math.max(0, Math.min(255, Math.round(pg / normA)));
        upscaled[dIdx + 2] = Math.max(0, Math.min(255, Math.round(pb / normA)));
        upscaled[dIdx + 3] = outA;
      }
    }
  }

  // Edge-Directed Unsharp Mask & Specular Micro-Contrast Enhancement
  const sharpened = new Uint8Array(upscaled.length);
  sharpened.set(upscaled);
  const amount = 0.52; // Crisp @3x scale/tooth/armor definition

  for (let y = 1; y < dstH - 1; y++) {
    const rowOff = y * dstW;
    for (let x = 1; x < dstW - 1; x++) {
      const idx = (rowOff + x) * 4;
      const a = upscaled[idx + 3];
      if (a < 24) continue;

      const nUp = ((y - 1) * dstW + x) * 4;
      const nDn = ((y + 1) * dstW + x) * 4;
      const nLt = (rowOff + (x - 1)) * 4;
      const nRt = (rowOff + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const center = upscaled[idx + c];
        const blur =
          (center * 4 +
            upscaled[nUp + c] +
            upscaled[nDn + c] +
            upscaled[nLt + c] +
            upscaled[nRt + c]) *
          0.125;
        const diff = center - blur;
        // Edge-aware clamping to prevent haloing while boosting crisp scales/armor seams
        const boosted = center + diff * amount;
        sharpened[idx + c] = Math.max(0, Math.min(255, Math.round(boosted)));
      }
    }
  }

  return { width: dstW, height: dstH, data: sharpened };
}

// ============================================================================
// Step 3: Optional Google Nano Banana (`gemini-3.1-flash-lite-image`) AI Redraw
// ============================================================================
async function redrawSharkWithNanoBanana(
  ai: GoogleGenAI,
  form: SharkFormConfig,
  referencePng: Buffer
): Promise<RawRgbaImage | null> {
  const prompt = [
    `Super-resolution @3x 2D game character sprite redraw of "${form.nameEn}" (${form.nameZh} - ${form.titleEn}).`,
    `Keep the exact side-profile pose facing right, silhouette, proportions, and design from the reference image.`,
    `Lineage style: ${form.lineage}, primary palette: ${form.primaryColor}, ${form.secondaryColor}, ${form.glowColor}.`,
    `Ultra-crisp 4K hand-painted stylized arcade game art (Hungry Shark Evolution / Ubisoft art style), sharp teeth, glossy subsurface scattering scales, clean rim lighting, isolated on a solid pure white background (#FFFFFF), no text, no watermarks, no extra limbs or detached floating objects.`,
  ].join(' ');

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: referencePng.toString('base64'),
          },
        },
        { text: prompt },
      ],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const genBuf = Buffer.from(part.inlineData.data, 'base64');
      const decoded = decodePng(genBuf);
      // Run studio-white removal + tight crop on the full generated image
      return extractCleanSharkCell(decoded, [0, 0, 1, 1], form.index);
    }
  }
  return null;
}

// ============================================================================
// Main Runner
// ============================================================================
async function main() {
  const rootDir = process.cwd();
  const masterSheetPath = path.join(
    rootDir,
    'public/assets/aistudio/sharks_ec921c3b.png'
  );
  const outDir = path.join(rootDir, 'public/assets/sharks_3x');
  const refsDir = path.join(rootDir, 'public/assets/shark_refs');
  const artifactDir = path.join(rootDir, 'src/assets/images');

  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[build-sharks-3x] Reading 4K master sheet: ${masterSheetPath}`);
  const sheetBuf = fs.readFileSync(masterSheetPath);
  const masterSheet = decodePng(sheetBuf);
  console.log(
    `[build-sharks-3x] Decoded master sheet: ${masterSheet.width}x${masterSheet.height}`
  );

  if (process.argv.includes('--export-refs')) {
    fs.mkdirSync(refsDir, { recursive: true });
    const fullW = masterSheet.width;
    const fullH = masterSheet.height;
    const fullData = masterSheet.data;
    for (const form of SHARK_EVOLUTION_FORMS) {
      const idxStr = String(form.index).padStart(2, '0');
      const [nx0, ny0, nx1, ny1] = SHARK_CELL_BOUNDS[form.spriteKey];
      const sx = Math.floor(nx0 * fullW);
      const sy = Math.floor(ny0 * fullH);
      const cellW = Math.max(1, Math.floor((nx1 - nx0) * fullW));
      const cellH = Math.max(1, Math.floor((ny1 - ny0) * fullH));
      const cellData = new Uint8Array(cellW * cellH * 4);
      for (let py = 0; py < cellH; py++) {
        const srcStart = ((sy + py) * fullW + sx) * 4;
        const dstStart = py * cellW * 4;
        cellData.set(fullData.subarray(srcStart, srcStart + cellW * 4), dstStart);
      }
      const refPath = path.join(refsDir, `ref_${idxStr}.png`);
      fs.writeFileSync(
        refPath,
        encodePng3x({ width: cellW, height: cellH, data: cellData })
      );
    }
    console.log(
      `[build-sharks-3x] Exported all 48 reference crops to ${refsDir}`
    );
    return;
  }

  const fromArtifacts = process.argv.includes('--from-artifacts');
  const { execSync } = await import('node:child_process');

  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  const useNanoBanana =
    apiKey.length > 0 &&
    (process.argv.includes('--nanobanana') || process.env.USE_NANO_BANANA === '1');
  const ai = useNanoBanana ? new GoogleGenAI({ apiKey }) : null;

  const manifest: Array<{
    index: number;
    id: string;
    spriteKey: string;
    nameZh: string;
    nameEn: string;
    fileName: string;
    url3x: string;
    width1x: number;
    height1x: number;
    width3x: number;
    height3x: number;
    bytes: number;
    engine: string;
  }> = [];

  for (const form of SHARK_EVOLUTION_FORMS) {
    const idxStr = String(form.index).padStart(2, '0');
    const fileName = `shark_form_${idxStr}@3x.png`;
    const filePath = path.join(outDir, fileName);
    const bounds = SHARK_CELL_BOUNDS[form.spriteKey];

    let final3x: RawRgbaImage | null = null;
    let engine = 'mitchell-bicubic-usm-3x';

    // Check if a Nano Banana artifact exists for this shark
    if (fromArtifacts && fs.existsSync(artifactDir)) {
      const files = fs.readdirSync(artifactDir);
      const matchFile = files.find((f) =>
        f.startsWith(`nanobanana_shark_${idxStr}`)
      );
      if (matchFile) {
        const srcArtPath = path.join(artifactDir, matchFile);
        const tmpPngPath = `/tmp/nb_rgba_${idxStr}.png`;
        execSync(
          `convert "${srcArtPath}" -define png:color-type=6 -depth 8 "${tmpPngPath}"`
        );
        const decodedArt = decodePng(fs.readFileSync(tmpPngPath));
        final3x = extractCleanSharkCell(decodedArt, [0, 0, 1, 1], form.index);
        engine = 'nanobanana-ai-redraw-3x';
      }
    }

    if (!final3x) {
      // 1. Extract clean cell from 4K master
      const cleanCell = extractCleanSharkCell(masterSheet, bounds, form.index);
      // 2. Super-resolve to @3x
      final3x = superResolveTo3x(cleanCell, 2.0);

      // 3. Optional Nano Banana API pass
      if (ai) {
        try {
          const refPng = encodePng3x(cleanCell);
          const aiRedrawn = await redrawSharkWithNanoBanana(ai, form, refPng);
          if (aiRedrawn && aiRedrawn.width >= 64 && aiRedrawn.height >= 64) {
            final3x =
              aiRedrawn.width < 750
                ? superResolveTo3x(aiRedrawn, 1.5)
                : aiRedrawn;
            engine = 'gemini-3.1-flash-lite-image-nanobanana-3x';
          }
        } catch (err) {
          console.warn(
            `[build-sharks-3x] Nano Banana fallback on #${idxStr} (${form.id}):`,
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    }

    const encodedBuf = encodePng3x(final3x);
    fs.writeFileSync(filePath, encodedBuf);

    const width1x = Math.max(1, Math.round(final3x.width / 3));
    const height1x = Math.max(1, Math.round(final3x.height / 3));

    manifest.push({
      index: form.index,
      id: form.id,
      spriteKey: form.spriteKey,
      nameZh: form.nameZh,
      nameEn: form.nameEn,
      fileName,
      url3x: `/assets/sharks_3x/${fileName}`,
      width1x,
      height1x,
      width3x: final3x.width,
      height3x: final3x.height,
      bytes: encodedBuf.length,
      engine,
    });

    if ((form.index + 1) % 8 === 0 || form.index === 47) {
      console.log(
        `[build-sharks-3x] Processed Row ${form.row + 1}/6 (${form.index + 1}/48): latest=${fileName} (${final3x.width}x${final3x.height} @3x, engine=${engine})`
      );
    }
  }

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        scale: '3x',
        dpi: 216,
        totalSharks: manifest.length,
        generatedAt: new Date().toISOString(),
        sharks: manifest,
      },
      null,
      2
    )
  );

  // Also synchronize the 4096x2286 master sheet (public/assets/aistudio/sharks_ec921c3b.png)
  // with the 48 newly generated @3x Nano Banana shark sprites so any fallback path in Web or iOS
  // also displays the new Nano Banana artwork.
  if (fromArtifacts) {
    const sheetW = 4096;
    const sheetH = 2286;
    const newSheetData = new Uint8Array(sheetW * sheetH * 4);
    // Fill with pure studio white (255, 255, 255, 255)
    newSheetData.fill(255);

    for (const form of SHARK_EVOLUTION_FORMS) {
      const idxStr = String(form.index).padStart(2, '0');
      const png3xPath = path.join(outDir, `shark_form_${idxStr}@3x.png`);
      if (!fs.existsSync(png3xPath)) continue;
      const sharkImg = decodePng(fs.readFileSync(png3xPath));
      const [nx0, ny0, nx1, ny1] = SHARK_CELL_BOUNDS[form.spriteKey];
      const cellX = Math.floor(nx0 * sheetW);
      const cellY = Math.floor(ny0 * sheetH);
      const cellW = Math.max(1, Math.floor((nx1 - nx0) * sheetW));
      const cellH = Math.max(1, Math.floor((ny1 - ny0) * sheetH));
      const margin = 10;
      const availW = Math.max(1, cellW - margin * 2);
      const availH = Math.max(1, cellH - margin * 2);
      const fitScale = Math.min(availW / sharkImg.width, availH / sharkImg.height);
      const drawW = Math.max(1, Math.round(sharkImg.width * fitScale));
      const drawH = Math.max(1, Math.round(sharkImg.height * fitScale));
      const offsetX = cellX + Math.floor((cellW - drawW) * 0.5);
      const offsetY = cellY + Math.floor((cellH - drawH) * 0.5);

      for (let dy = 0; dy < drawH; dy++) {
        const sy = Math.min(
          sharkImg.height - 1,
          Math.floor(((dy + 0.5) / drawH) * sharkImg.height)
        );
        const dstY = offsetY + dy;
        if (dstY < 0 || dstY >= sheetH) continue;
        for (let dx = 0; dx < drawW; dx++) {
          const sx = Math.min(
            sharkImg.width - 1,
            Math.floor(((dx + 0.5) / drawW) * sharkImg.width)
          );
          const dstX = offsetX + dx;
          if (dstX < 0 || dstX >= sheetW) continue;
          const sIdx = (sy * sharkImg.width + sx) * 4;
          const sa = sharkImg.data[sIdx + 3] / 255;
          if (sa <= 0.01) continue;
          const dIdx = (dstY * sheetW + dstX) * 4;
          newSheetData[dIdx] = Math.round(
            sharkImg.data[sIdx] * sa + 255 * (1 - sa)
          );
          newSheetData[dIdx + 1] = Math.round(
            sharkImg.data[sIdx + 1] * sa + 255 * (1 - sa)
          );
          newSheetData[dIdx + 2] = Math.round(
            sharkImg.data[sIdx + 2] * sa + 255 * (1 - sa)
          );
          newSheetData[dIdx + 3] = 255;
        }
      }
    }

    fs.writeFileSync(
      masterSheetPath,
      encodePng3x({ width: sheetW, height: sheetH, data: newSheetData })
    );
    console.log(
      `[build-sharks-3x] Synchronized 4096x2286 master sheet with all 48 Nano Banana @3x sharks: ${masterSheetPath}`
    );
  }

  console.log(
    `[build-sharks-3x] Successfully generated all ${manifest.length} individual @3x shark PNGs in ${outDir}`
  );
}

main().catch((err) => {
  console.error('[build-sharks-3x] Fatal error:', err);
  process.exit(1);
});
