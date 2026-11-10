/**
 * process-prey-140.ts
 *
 * 140-Prey Asset Pipeline & Progress Tracker (iPhone @3x Retina Transparent PNGs)
 * -------------------------------------------------------------------------------
 * 1. Parses the 140 prey species from `/public/assets/aistudio/shark_prey_database_140_5bf51a5d.md`.
 * 2. Scans `/src/assets/images/` for Nano Banana generated artifacts (`prey_001_*.jpg`, etc.).
 * 3. Performs 4-edge perimeter BFS background removal + morphological silhouette closure
 *    (preserving 100% of internal white stripes, white bellies, eyes, and teeth) +
 *    multi-pixel Color-to-Alpha edge unmixing + tight bounding-box crop.
 * 4. Outputs @3x iPhone Retina transparent PNGs (216 DPI pHYs chunk) to:
 *    - `/public/assets/prey_140/PREY-XXX.png` (high-res @3x Retina master, 600px~1440px)
 *    - `/public/assets/prey_140/PREY-XXX@3x.png` (exact @3x game sprite resolution = 3x recommended px)
 * 5. Updates `/docs/06-PREY_DATABASE_140.md` and `/public/assets/prey_140/progress.json`
 *    with exact completion markers so generation can be resumed from the exact breakpoint
 *    if quota limits are reached.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { execSync } from 'node:child_process';

interface PreyRecord {
  id: string; // e.g. PREY-001
  numCode: string; // e.g. 001
  name: string;
  category: string;
  depthRange: string;
  lengthCm: string;
  sizeBasis: string;
  sizeClass: string;
  spritePxRange: string;
  minPx1x: number;
  maxPx1x: number;
  targetPx3x: number; // 3x of maxPx1x (with minimum 256px for crisp iPhone @3x Retina quality)
  zone: string;
  prompt: string;
  keywords: string;
  role: string;
  note: string;
}

interface RawRgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

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
        throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
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
      if (filterType === 1) val = (rawByte + left) & 0xff;
      else if (filterType === 2) val = (rawByte + up) & 0xff;
      else if (filterType === 3) val = (rawByte + ((left + up) >> 1)) & 0xff;
      else if (filterType === 4) val = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
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
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // @3x Retina DPI metadata (72 * 3 = 216 DPI = 8504 pixels/meter)
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(8504, 0);
  phys.writeUInt32BE(8504, 4);
  phys[8] = 1;

  const stride = width * 4;
  const rawScanlines = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 1;
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

/**
 * Extracts a clean RGBA sprite from a Nano Banana image:
 * - Detects background color from the 4 corners (supports studio white #FFFFFF or checkerboard).
 * - Runs 4-edge perimeter BFS flood-fill that stops at the creature's outline.
 * - Uses interior scanline span protection so white stripes, white bellies, eyes, and teeth
 *   inside the creature silhouette remain 100% opaque (alpha = 255).
 * - Unmixes anti-aliased border pixels and tightly crops to non-zero alpha bounding box.
 */
function extractCleanPreySprite(raw: RawRgbaImage): RawRgbaImage {
  const w = raw.width;
  const h = raw.height;
  const data = new Uint8Array(raw.data);
  const total = w * h;

  // Sample corner pixels to determine background luminance range
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  // Check if pixel is neutral studio white / light gray / checkerboard background
  const isBgCandidate = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC;
    // Pure white or neutral gray checkerboard background
    return minC >= 188 && sat <= 18;
  };

  // Build an interior protection mask:
  // Any pixel that is surrounded on all 4 cardinal directions (Left, Right, Up, Down)
  // by non-background (colored or dark outline) pixels is strictly inside the fish body!
  const isForeground = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (!isBgCandidate(i)) {
      isForeground[i] = 1;
    }
  }

  // Row-wise left/right foreground bounds & column-wise top/bottom foreground bounds
  const rowFirstFg = new Int32Array(h).fill(w);
  const rowLastFg = new Int32Array(h).fill(-1);
  const colFirstFg = new Int32Array(w).fill(h);
  const colLastFg = new Int32Array(w).fill(-1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (isForeground[i]) {
        if (x < rowFirstFg[y]) rowFirstFg[y] = x;
        if (x > rowLastFg[y]) rowLastFg[y] = x;
        if (y < colFirstFg[x]) colFirstFg[x] = y;
        if (y > colLastFg[x]) colLastFg[x] = y;
      }
    }
  }

  // Also detect strong dark outline pixels (r,g,b < 95) to act as an impenetrable wall
  const isDarkOutline = (idx: number): boolean => {
    const p = idx * 4;
    return data[p] < 95 && data[p + 1] < 95 && data[p + 2] < 95;
  };

  const enqueue = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (visited[idx] || !isBgCandidate(idx) || isDarkOutline(idx)) return;
    visited[idx] = 1;
    queue[qTail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  // BFS from perimeter
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % w;
    const cy = (curr - cx) / w;

    // Prevent BFS from leaking through narrow 1-2px gaps into the deep interior of the fish
    const insideHorizontalSpan =
      cx > rowFirstFg[cy] + 10 && cx < rowLastFg[cy] - 10;
    const insideVerticalSpan =
      cy > colFirstFg[cx] + 10 && cy < colLastFg[cx] - 10;
    if (insideHorizontalSpan && insideVerticalSpan) {
      // Check if there are dark outline pixels or colored pixels nearby blocking the gap
      let nearbyDarkOrColor = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const ni = ny * w + nx;
            if (!isBgCandidate(ni)) nearbyDarkOrColor++;
          }
        }
      }
      if (nearbyDarkOrColor >= 16) {
        visited[curr] = 0;
        continue;
      }
    }

    if (cx > 0) enqueue(cx - 1, cy);
    if (cx + 1 < w) enqueue(cx + 1, cy);
    if (cy > 0) enqueue(cx, cy - 1);
    if (cy + 1 < h) enqueue(cx, cy + 1);
  }

  // Clear background pixels and unmix 2px anti-aliased fringe
  for (let i = 0; i < total; i++) {
    if (visited[i]) {
      const p = i * 4;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
      data[p + 3] = 0;
    }
  }

  // 2px boundary white-fringe unmixing
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const touchesBg =
        visited[idx - 1] ||
        visited[idx + 1] ||
        visited[idx - w] ||
        visited[idx + w];
      if (!touchesBg) continue;

      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC > 200 && maxC - minC < 25) {
        // Soft anti-aliased white edge pixel
        const alpha = Math.max(0, Math.min(255, Math.round(((255 - minC) / 55) * 255)));
        data[p + 3] = alpha;
      }
    }
  }

  // Find tight bounding box
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return raw;
  }

  const pad = 6;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w - 1, maxX + pad);
  const y1 = Math.min(h - 1, maxY + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  const cropped = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const srcStart = ((y0 + y) * w + x0) * 4;
    cropped.set(data.subarray(srcStart, srcStart + cw * 4), y * cw * 4);
  }

  return { width: cw, height: ch, data: cropped };
}

/**
 * Resizes an RGBA image proportionally so its longer side equals `targetLongSide`
 * using area-averaging / bilinear interpolation with premultiplied alpha.
 */
function resizeRgbaProportional(src: RawRgbaImage, targetLongSide: number): RawRgbaImage {
  const longSide = Math.max(src.width, src.height);
  if (longSide <= 0 || Math.abs(longSide - targetLongSide) <= 4) {
    return src;
  }
  const scale = targetLongSide / longSide;
  const dstW = Math.max(1, Math.round(src.width * scale));
  const dstH = Math.max(1, Math.round(src.height * scale));
  const dst = new Uint8Array(dstW * dstH * 4);

  for (let dy = 0; dy < dstH; dy++) {
    const sy = ((dy + 0.5) / dstH) * src.height - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const wy = sy - y0;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = ((dx + 0.5) / dstW) * src.width - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const wx = sx - x0;

      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;

      const i00 = (y0 * src.width + x0) * 4;
      const i10 = (y0 * src.width + x1) * 4;
      const i01 = (y1 * src.width + x0) * 4;
      const i11 = (y1 * src.width + x1) * 4;

      const a00 = src.data[i00 + 3] / 255;
      const a10 = src.data[i10 + 3] / 255;
      const a01 = src.data[i01 + 3] / 255;
      const a11 = src.data[i11 + 3] / 255;

      const outA = a00 * w00 + a10 * w10 + a01 * w01 + a11 * w11;
      const dIdx = (dy * dstW + dx) * 4;
      if (outA <= 0.004) {
        dst[dIdx] = 0;
        dst[dIdx + 1] = 0;
        dst[dIdx + 2] = 0;
        dst[dIdx + 3] = 0;
      } else {
        const r =
          (src.data[i00] * a00 * w00 +
            src.data[i10] * a10 * w10 +
            src.data[i01] * a01 * w01 +
            src.data[i11] * a11 * w11) /
          outA;
        const g =
          (src.data[i00 + 1] * a00 * w00 +
            src.data[i10 + 1] * a10 * w10 +
            src.data[i01 + 1] * a01 * w01 +
            src.data[i11 + 1] * a11 * w11) /
          outA;
        const b =
          (src.data[i00 + 2] * a00 * w00 +
            src.data[i10 + 2] * a10 * w10 +
            src.data[i01 + 2] * a01 * w01 +
            src.data[i11 + 2] * a11 * w11) /
          outA;
        dst[dIdx] = Math.max(0, Math.min(255, Math.round(r)));
        dst[dIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
        dst[dIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
        dst[dIdx + 3] = Math.max(0, Math.min(255, Math.round(outA * 255)));
      }
    }
  }

  return { width: dstW, height: dstH, data: dst };
}

function parsePreyMarkdown(mdContent: string): PreyRecord[] {
  const lines = mdContent.split(/\r?\n/);
  const records: PreyRecord[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('| PREY-')) continue;
    const cols = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cols.length < 12) continue;

    const [
      id,
      name,
      category,
      depthRange,
      lengthCm,
      sizeBasis,
      sizeClass,
      spritePxRange,
      zone,
      prompt,
      keywords,
      role,
      note = '',
    ] = cols;

    const numMatch = id.match(/PREY-(\d+)/);
    const numCode = numMatch ? numMatch[1] : '000';
    const pxParts = spritePxRange.split(/[–-]/).map((s) => parseInt(s.trim(), 10));
    const minPx1x = pxParts[0] || 40;
    const maxPx1x = pxParts[1] || minPx1x;
    // For iPhone @3x Retina assets, ensure at least 384px for XS/S and 3 * maxPx1x for L/XL/XXL/Giant
    const targetPx3x = Math.max(384, maxPx1x * 3);

    records.push({
      id,
      numCode,
      name,
      category,
      depthRange,
      lengthCm,
      sizeBasis,
      sizeClass,
      spritePxRange,
      minPx1x,
      maxPx1x,
      targetPx3x,
      zone,
      prompt,
      keywords,
      role,
      note,
    });
  }

  return records;
}

function main() {
  const rootDir = process.cwd();
  const srcMdPath = path.join(
    rootDir,
    'public/assets/aistudio/shark_prey_database_140_5bf51a5d.md'
  );
  const outDir = path.join(rootDir, 'public/assets/prey_140');
  const artifactDir = path.join(rootDir, 'src/assets/images');
  const docsMdPath = path.join(rootDir, 'docs/06-PREY_DATABASE_140.md');
  const progressJsonPath = path.join(outDir, 'progress.json');

  fs.mkdirSync(outDir, { recursive: true });

  const rawMd = fs.readFileSync(srcMdPath, 'utf8');
  const records = parsePreyMarkdown(rawMd);

  const artifactFiles = fs.existsSync(artifactDir)
    ? fs.readdirSync(artifactDir)
    : [];

  const completedItems: Array<{
    id: string;
    name: string;
    category: string;
    sizeClass: string;
    file3x: string;
    width3x: number;
    height3x: number;
    bytes: number;
    sourceArtifact: string;
  }> = [];
  const pendingIds: string[] = [];

  for (const rec of records) {
    const outPngPath = path.join(outDir, `${rec.id}.png`);
    const out3xPath = path.join(outDir, `${rec.id}@3x.png`);

    // Find latest matching artifact in src/assets/images/ (e.g. prey_001_*.jpg or prey_001_*.png)
    const prefix = `prey_${rec.numCode}_`;
    const matches = artifactFiles
      .filter((f) => f.startsWith(prefix))
      .sort();
    const latestMatch = matches.length > 0 ? matches[matches.length - 1] : null;

    if (latestMatch) {
      // Only re-process if output doesn't exist yet or --force is passed
      if (!fs.existsSync(outPngPath) || !fs.existsSync(out3xPath) || process.argv.includes('--force')) {
        const srcArtPath = path.join(artifactDir, latestMatch);
        const tmpPngPath = `/tmp/prey_rgba_${rec.numCode}.png`;
        execSync(`convert "${srcArtPath}" -define png:color-type=6 -depth 8 "${tmpPngPath}"`);
        const decoded = decodePng(fs.readFileSync(tmpPngPath));
        const cleanFull = extractCleanPreySprite(decoded);
        const scaled3x = resizeRgbaProportional(cleanFull, rec.targetPx3x);

        const bufFull = encodePng3x(cleanFull);
        const buf3x = encodePng3x(scaled3x);
        fs.writeFileSync(outPngPath, bufFull);
        fs.writeFileSync(out3xPath, buf3x);
        try {
          fs.unlinkSync(tmpPngPath);
        } catch {}
      }

      const existing3x = decodePng(fs.readFileSync(out3xPath));
      const stat3x = fs.statSync(out3xPath);
      completedItems.push({
        id: rec.id,
        name: rec.name,
        category: rec.category,
        sizeClass: rec.sizeClass,
        file3x: `/assets/prey_140/${rec.id}@3x.png`,
        width3x: existing3x.width,
        height3x: existing3x.height,
        bytes: stat3x.size,
        sourceArtifact: latestMatch,
      });
    } else if (fs.existsSync(out3xPath)) {
      const existing3x = decodePng(fs.readFileSync(out3xPath));
      const stat3x = fs.statSync(out3xPath);
      completedItems.push({
        id: rec.id,
        name: rec.name,
        category: rec.category,
        sizeClass: rec.sizeClass,
        file3x: `/assets/prey_140/${rec.id}@3x.png`,
        width3x: existing3x.width,
        height3x: existing3x.height,
        bytes: stat3x.size,
        sourceArtifact: 'pre-existing',
      });
    } else {
      pendingIds.push(rec.id);
    }
  }

  const completedMap = new Map(completedItems.map((item) => [item.id, item]));
  const lastCompleted =
    completedItems.length > 0 ? completedItems[completedItems.length - 1] : null;
  const nextPendingId = pendingIds.length > 0 ? pendingIds[0] : 'ALL_DONE';
  const nextPendingRec = records.find((r) => r.id === nextPendingId);

  const progressData = {
    totalCount: records.length,
    completedCount: completedItems.length,
    pendingCount: pendingIds.length,
    lastCompletedId: lastCompleted ? lastCompleted.id : null,
    lastCompletedName: lastCompleted ? lastCompleted.name : null,
    nextResumeId: nextPendingId,
    nextResumeName: nextPendingRec ? nextPendingRec.name : null,
    updatedAt: new Date().toISOString(),
    outputDirectory: '/public/assets/prey_140',
    completed: completedItems,
    pendingIds,
  };

  fs.writeFileSync(progressJsonPath, JSON.stringify(progressData, null, 2), 'utf8');

  // Build enhanced Markdown with progress header & per-row status column
  const progressBanner = [
    `## 📌 Nano Banana 鱼类透明 PNG 资产生成进度看板（自动更新）`,
    ``,
    `| 统计项 | 当前状态 |`,
    `| :--- | :--- |`,
    `| **总计鱼类资产数** | **${records.length} 条**（普通鱼类 100 + 大型生物 30 + 巨型生物 10） |`,
    `| **已生成透明 PNG 数量** | **${completedItems.length} / ${records.length}**（完成率 \`${((completedItems.length / records.length) * 100).toFixed(1)}%\`） |`,
    `| **当前已生成到（最后完成）** | **${lastCompleted ? `${lastCompleted.id}（${lastCompleted.name}，${lastCompleted.width3x}×${lastCompleted.height3x} @3x）` : '尚未开始'}** |`,
    `| **下次继续生成起点（断点续传）** | **${nextPendingRec ? `${nextPendingRec.id}（${nextPendingRec.name}）` : '🎉 全部 140 条已生成完毕'}** |`,
    `| **资产输出目录** | \`/public/assets/prey_140/PREY-XXX.png\`（原图去底） & \`/public/assets/prey_140/PREY-XXX@3x.png\`（iPhone \`@3x\` Retina 216 DPI） |`,
    `| **进度 JSON 索引** | \`/public/assets/prey_140/progress.json\` |`,
    ``,
  ].join('\n');

  // Inject status column into markdown tables
  const enhancedLines: string[] = [];
  const rawLines = rawMd.split(/\r?\n/);
  let insertedBanner = false;

  for (const line of rawLines) {
    if (!insertedBanner && line.startsWith('## 字段说明')) {
      enhancedLines.push(progressBanner);
      insertedBanner = true;
    }

    if (line.startsWith('| ID | 名称 |')) {
      enhancedLines.push(line.replace('| ID | 名称 |', '| 生成状态 | 资产路径 (@3x) | ID | 名称 |'));
    } else if (line.startsWith('|---|---|')) {
      enhancedLines.push('|---|---|' + line);
    } else if (line.trim().startsWith('| PREY-')) {
      const cols = line.trim().split('|');
      const id = cols[1]?.trim() || '';
      const done = completedMap.get(id);
      const statusCell = done
        ? `✅ 已生成 (${done.width3x}×${done.height3x})`
        : `⏳ 待生成`;
      const pathCell = done ? `\`${done.file3x}\`` : `-`;
      enhancedLines.push(`| ${statusCell} | ${pathCell} ${line.trim()}`);
    } else {
      enhancedLines.push(line);
    }
  }

  const finalMd = enhancedLines.join('\n');
  fs.writeFileSync(docsMdPath, finalMd, 'utf8');
  fs.writeFileSync(path.join(outDir, 'shark_prey_database_140.md'), finalMd, 'utf8');

  console.log(
    `[process-prey-140] Progress: ${completedItems.length}/${records.length} completed. Last=${
      lastCompleted?.id ?? 'NONE'
    }, Next=${nextPendingId}`
  );
}

main();
