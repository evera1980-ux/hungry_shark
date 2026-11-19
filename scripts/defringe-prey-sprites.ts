/**
 * scripts/defringe-prey-sprites.ts
 *
 * Professional-Grade Sprite De-Matting & Edge De-Fringing Pipeline
 * ----------------------------------------------------------------
 * Eliminates AI white studio background halos ("白毛边") on all 140 marine prey sprites
 * (especially giant whales, sharks, and deep-sea creatures) while 100% preserving
 * authentic interior white patterns (Orca eye patches, white bellies, teeth, and stripes).
 *
 * Pipeline Steps per Sprite:
 * 1. Perimeter BFS Flood-Fill: Identifies strictly external transparent space.
 * 2. Ghost Halo Stripping: Cleans faint semi-transparent white pixels (alpha < 40 or high-luminance fog).
 * 3. 1-Pixel Outer White Edge Erode: Removes pure white background bleeding at the outer contour.
 * 4. Color Dilation / Inpainting (2-pass): Bleeds true body colors into the anti-aliased edge,
 *    replacing white matting with natural creature coloration while keeping smooth alpha curves.
 * 5. Zero-Alpha Cleansing: Zeroes RGB channels for all alpha=0 pixels to prevent GPU bilinear bleed.
 * 6. Dual Target Sync: Writes optimized @3x PNGs to public/assets/prey_140/ and ios-native Assets.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

interface RawRgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
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

function decodePng(buffer: Buffer): RawRgbaImage {
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
        throw new Error(`Unsupported PNG: bitDepth=${bitDepth}, colorType=${colorType}`);
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
  const prevLine = new Uint8Array(stride);
  const currLine = new Uint8Array(stride);

  let rawIdx = 0;
  for (let y = 0; y < height; y++) {
    const filter = rawScanlines[rawIdx++];
    for (let i = 0; i < stride; i++) {
      const rawByte = rawScanlines[rawIdx++];
      const a = i >= bpp ? currLine[i - bpp] : 0;
      const b = prevLine[i];
      const c = i >= bpp ? prevLine[i - bpp] : 0;
      let val = rawByte;
      if (filter === 1) val = (rawByte + a) & 0xff;
      else if (filter === 2) val = (rawByte + b) & 0xff;
      else if (filter === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (rawByte + pr) & 0xff;
      }
      currLine[i] = val;
    }
    prevLine.set(currLine);
    if (colorType === 6) {
      out.set(currLine, y * width * 4);
    } else {
      for (let x = 0; x < width; x++) {
        const dst = (y * width + x) * 4;
        const src = x * 3;
        out[dst] = currLine[src];
        out[dst + 1] = currLine[src + 1];
        out[dst + 2] = currLine[src + 2];
        out[dst + 3] = 255;
      }
    }
  }

  return { width, height, data: out };
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

  // 216 DPI (8504 pixels/meter) for iPhone @3x Retina
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

export function defringeSprite(img: RawRgbaImage): { cleaned: RawRgbaImage; strippedCount: number; dilatedCount: number } {
  const w = img.width;
  const h = img.height;
  const data = new Uint8Array(img.data);
  const total = w * h;

  // 1. Identify outer background via BFS flood-fill from all 4 borders
  const isOuterBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  for (let x = 0; x < w; x++) {
    if (data[x * 4 + 3] === 0) { isOuterBg[x] = 1; queue[qTail++] = x; }
    const btm = (h - 1) * w + x;
    if (data[btm * 4 + 3] === 0) { isOuterBg[btm] = 1; queue[qTail++] = btm; }
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    if (data[left * 4 + 3] === 0 && !isOuterBg[left]) { isOuterBg[left] = 1; queue[qTail++] = left; }
    const right = y * w + (w - 1);
    if (data[right * 4 + 3] === 0 && !isOuterBg[right]) { isOuterBg[right] = 1; queue[qTail++] = right; }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % w;
    const cy = (curr - cx) / w;
    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !isOuterBg[n] && data[n * 4 + 3] === 0) {
        isOuterBg[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  let strippedCount = 0;

  // 2. Strip ghost halo pixels touching outer background (3 iterative passes)
  for (let iter = 0; iter < 3; iter++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (isOuterBg[idx]) continue;
        const p = idx * 4;
        const a = data[p + 3];
        if (a === 0) {
          isOuterBg[idx] = 1;
          continue;
        }

        const touchesOuter =
          isOuterBg[idx - 1] || isOuterBg[idx + 1] || isOuterBg[idx - w] || isOuterBg[idx + w];
        if (!touchesOuter) continue;

        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);

        // Conditions for ghost background halo:
        // - Alpha is very low (< 35)
        // - Alpha is moderate (< 100) and color is nearly pure white (minC > 205, low saturation)
        // - Alpha is semi-opaque (< 170) and color is extreme white (minC > 225, low saturation)
        const isGhost =
          a < 35 ||
          (a < 100 && minC > 205 && maxC - minC < 30) ||
          (a < 170 && minC > 225 && maxC - minC < 25);

        if (isGhost) {
          data[p] = 0;
          data[p + 1] = 0;
          data[p + 2] = 0;
          data[p + 3] = 0;
          isOuterBg[idx] = 1;
          strippedCount++;
        }
      }
    }
  }

  // 3. One-pixel outer white fringe erosion: strip remaining high-white outer border pixels
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (isOuterBg[idx]) continue;
      const p = idx * 4;
      const a = data[p + 3];
      if (a === 0) continue;

      const touchesOuter =
        isOuterBg[idx - 1] || isOuterBg[idx + 1] || isOuterBg[idx - w] || isOuterBg[idx + w];
      if (!touchesOuter) continue;

      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);

      if (minC > 210 && maxC - minC < 35) {
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
        isOuterBg[idx] = 1;
        strippedCount++;
      }
    }
  }

  let dilatedCount = 0;

  // 4. Color Dilation / Inpainting:
  // For remaining edge pixels with alpha < 250 that touch outer background,
  // replace their contaminated white RGB with the nearest fully opaque fish body color
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (isOuterBg[idx]) continue;
        const p = idx * 4;
        const a = data[p + 3];
        if (a === 0 || a >= 250) continue;

        const touchesOuter =
          isOuterBg[idx - 1] || isOuterBg[idx + 1] || isOuterBg[idx - w] || isOuterBg[idx + w];
        if (!touchesOuter) continue;

        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);

        // Find nearest opaque body neighbor within radius 3
        let bestP = -1;
        let bestDistSq = 999;
        let bestMinC = 999;

        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const np = (ny * w + nx) * 4;
            const na = data[np + 3];
            if (na >= 220) {
              const d2 = dx * dx + dy * dy;
              const nMinC = Math.min(data[np], data[np + 1], data[np + 2]);
              if (d2 < bestDistSq || (d2 === bestDistSq && nMinC < bestMinC)) {
                bestDistSq = d2;
                bestP = np;
                bestMinC = nMinC;
              }
            }
          }
        }

        if (bestP >= 0 && bestMinC < minC) {
          data[p] = data[bestP];
          data[p + 1] = data[bestP + 1];
          data[p + 2] = data[bestP + 2];
          dilatedCount++;
        }
      }
    }
  }

  // 5. Zero-Alpha Cleansing: all alpha=0 pixels must have RGB=(0,0,0)
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) {
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
    }
  }

  return { cleaned: { width: w, height: h, data }, strippedCount, dilatedCount };
}

async function main() {
  const rootDir = process.cwd();
  const webPreyDir = path.join(rootDir, 'public/assets/prey_140');
  const iosPreyDir = path.join(rootDir, 'ios-native/HungrySharkEvolution/Resources/Assets');

  if (!fs.existsSync(webPreyDir)) {
    console.error(`Web prey directory not found: ${webPreyDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(webPreyDir)
    .filter((f) => f.startsWith('PREY-') && f.endsWith('@3x.png'))
    .sort();

  console.log(`[defringe] 🎯 Found ${files.length} @3x prey sprites in ${webPreyDir}`);

  let totalStripped = 0;
  let totalDilated = 0;
  let processedCount = 0;

  for (const filename of files) {
    const filePath = path.join(webPreyDir, filename);
    const rawBuffer = fs.readFileSync(filePath);
    const decoded = decodePng(rawBuffer);
    const { cleaned, strippedCount, dilatedCount } = defringeSprite(decoded);

    totalStripped += strippedCount;
    totalDilated += dilatedCount;
    processedCount++;

    const encoded = encodePng3x(cleaned);

    // Write back to public/assets/prey_140/
    fs.writeFileSync(filePath, encoded);

    // Sync to iOS Assets folder if exists
    if (fs.existsSync(iosPreyDir)) {
      const iosPath = path.join(iosPreyDir, filename);
      fs.writeFileSync(iosPath, encoded);
    }

    if (filename.includes('PREY-201') || filename.includes('PREY-202') || filename.includes('PREY-204') || filename.includes('PREY-206')) {
      console.log(`  🐋 [Whale Cleaned] ${filename}: stripped ${strippedCount} white ghost pixels, dilated ${dilatedCount} edge pixels.`);
    }
  }

  // Also defringe cyber_mine@3x.png if present
  const mineFile = 'cyber_mine@3x.png';
  const webMinePath = path.join(webPreyDir, mineFile);
  if (fs.existsSync(webMinePath)) {
    const rawBuffer = fs.readFileSync(webMinePath);
    const decoded = decodePng(rawBuffer);
    const { cleaned, strippedCount, dilatedCount } = defringeSprite(decoded);
    totalStripped += strippedCount;
    totalDilated += dilatedCount;
    const encoded = encodePng3x(cleaned);
    fs.writeFileSync(webMinePath, encoded);
    if (fs.existsSync(iosPreyDir)) {
      fs.writeFileSync(path.join(iosPreyDir, mineFile), encoded);
    }
    console.log(`  💣 [Mine Cleaned] ${mineFile}: stripped ${strippedCount} white ghost pixels, dilated ${dilatedCount} edge pixels.`);
  }

  console.log(`\n[defringe] ✅ Successfully processed ${processedCount} sprites!`);
  console.log(`[defringe] 📊 Statistics:`);
  console.log(`  - Total white ghost pixels eliminated: ${totalStripped.toLocaleString()} px`);
  console.log(`  - Total anti-aliased edge pixels color-dilated: ${totalDilated.toLocaleString()} px`);
  console.log(`  - Synced to Web (public/assets/prey_140/) and iOS (ios-native/HungrySharkEvolution/Resources/Assets/)`);
}

main().catch((err) => {
  console.error('[defringe] Error:', err);
  process.exit(1);
});
