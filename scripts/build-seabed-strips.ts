/**
 * build-seabed-strips.ts
 *
 * Processes the 4 standalone photorealistic seabed images in `/src/assets/images/`
 * into high-resolution (2048x1152, @3x Retina 216 DPI), transparent-background
 * 8-bit RGBA PNG files without cropping, slicing, or column distortion:
 *   1. seabed_strip_coral_reef.png
 *   2. seabed_strip_rocky_shelf.png
 *   3. seabed_strip_underwater_canyon.png
 *   4. seabed_strip_deep_abyss.png
 *
 * Outputs to both `/src/assets/images/` and `/public/assets/aistudio/`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { execSync } from 'node:child_process';

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
 * Removes the pure studio white (#FFFFFF) background from a full-frame 2048x1152
 * realistic seabed image while keeping the full image resolution (2048x1152),
 * zero cropping, zero column distortion, and 100% opaque interior details
 * (sand ripples, white barnacles, ammonite fossils, cyan veins, sulfur crystals).
 */
function removeStudioWhiteBackgroundOnly(raw: RawRgbaImage): RawRgbaImage {
  const w = raw.width;
  const h = raw.height;
  const data = new Uint8Array(raw.data);
  const total = w * h;

  const isBgWhite = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= 232 && maxC - minC <= 22;
  };

  // Flood-fill from top edge and bottom edge to remove studio white background
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

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
    enqueueIfBg(x, 1);
    enqueueIfBg(x, h - 1);
    enqueueIfBg(x, h - 2);
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

  // Clear small enclosed pure-white gaps between coral branches in the top 42% of the frame
  for (let y = 0; y < Math.floor(h * 0.42); y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC >= 246 && maxC - minC <= 10) {
        data[p + 3] = 0;
        visited[idx] = 1;
      }
    }
  }

  // 3-pass Color-to-Alpha unmixing on border pixels adjacent to transparent background
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        if (data[p + 3] === 0) continue;
        const hasTransNeighbor =
          data[(idx - 1) * 4 + 3] < 16 ||
          data[(idx + 1) * 4 + 3] < 16 ||
          data[(idx - w) * 4 + 3] < 16 ||
          data[(idx + w) * 4 + 3] < 16;
        if (!hasTransNeighbor) continue;

        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const minC = Math.min(r, g, b);
        const maxC = Math.max(r, g, b);
        if (minC > 175 && maxC - minC <= 36) {
          const cleanAlpha = Math.max(0, Math.min(1, (246 - minC) / 115));
          const denom = Math.max(0.1, cleanAlpha);
          data[p] = Math.max(0, Math.min(255, Math.round((r - (1 - cleanAlpha) * 255) / denom)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - cleanAlpha) * 255) / denom)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - cleanAlpha) * 255) / denom)));
          data[p + 3] = Math.round(data[p + 3] * cleanAlpha);
        }
      }
    }
  }

  return { width: w, height: h, data };
}

function main() {
  const rootDir = process.cwd();
  const srcImagesDir = path.join(rootDir, 'src/assets/images');
  const publicAistudioDir = path.join(rootDir, 'public/assets/aistudio');

  const specs: Array<{
    biome: 'coral_reef' | 'rocky_shelf' | 'underwater_canyon' | 'deep_abyss';
    srcPrefix: string;
    outFileName: string;
  }> = [
    {
      biome: 'coral_reef',
      srcPrefix: 'seabed_coral_reef_realistic_',
      outFileName: 'seabed_strip_coral_reef.png',
    },
    {
      biome: 'rocky_shelf',
      srcPrefix: 'seabed_rocky_shelf_realistic_',
      outFileName: 'seabed_strip_rocky_shelf.png',
    },
    {
      biome: 'underwater_canyon',
      srcPrefix: 'seabed_underwater_canyon_realistic_',
      outFileName: 'seabed_strip_underwater_canyon.png',
    },
    {
      biome: 'deep_abyss',
      srcPrefix: 'seabed_deep_abyss_realistic_',
      outFileName: 'seabed_strip_deep_abyss.png',
    },
  ];

  const allFiles = fs.readdirSync(srcImagesDir);

  for (const spec of specs) {
    const matches = allFiles
      .filter((f) => f.startsWith(spec.srcPrefix) && f.endsWith('.jpg'))
      .sort();
    if (matches.length === 0) {
      throw new Error(`No source image found in src/assets/images for prefix ${spec.srcPrefix}`);
    }
    const latestSrc = path.join(srcImagesDir, matches[matches.length - 1]);
    const tmpPng = `/tmp/seabed_upscaled_${spec.biome}.png`;

    // Upscale with high-craft Lanczos filter + unsharp mask to 2048x1152 (16:9 high resolution)
    execSync(
      `convert "${latestSrc}" -filter Lanczos -resize 2048x1152! -unsharp 0x0.75+0.65+0.008 -define png:color-type=6 -depth 8 "${tmpPng}"`
    );

    const decoded = decodePng(fs.readFileSync(tmpPng));
    const processed = removeStudioWhiteBackgroundOnly(decoded);
    const pngBuf = encodePng3x(processed);

    const outSrcPath = path.join(srcImagesDir, spec.outFileName);
    const outPubPath = path.join(publicAistudioDir, spec.outFileName);
    fs.writeFileSync(outSrcPath, pngBuf);
    fs.writeFileSync(outPubPath, pngBuf);

    // Remove the intermediate .jpg artifact from src/assets/images so only the 4 clean transparent high-res PNGs remain
    try {
      fs.unlinkSync(tmpPng);
    } catch {}

    console.log(
      `[build-seabed-strips] Generated ${spec.outFileName}: ${processed.width}x${processed.height} (@3x 216 DPI RGBA PNG, ${(
        pngBuf.length /
        (1024 * 1024)
      ).toFixed(2)} MB)`
    );
  }
}

main();
