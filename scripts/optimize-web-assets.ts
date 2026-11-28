/**
 * Offline Web Asset Optimization Pipeline (`npm run optimize:assets` / P0-2 Option A)
 *
 * Transforms raw high-resolution PNG/JPG assets into tight-trimmed, WebP-compressed
 * Web runtime assets under `public/assets/`:
 * 1. Pre-trims transparent borders (+2px pad) and caps width to <= 420px on all 135 active
 *    prey (`PREY-001..210` + `cyber_mine`) and 48 individual sharks (`shark_form_00..47`),
 *    eliminating runtime main-thread `getImageData()` pixel trimming completely.
 * 2. Converts the 17 actively used UI/water/seabed/ecology/world-atlas assets to WebP
 *    and extracts a tiny standalone `devour_fx.webp` (~4 KB) replacing 1.1 MB `fish_24bdaa5a.png`.
 * 3. Removes unused legacy Web files (`sharks_ec921c3b.png`, `fish_24bdaa5a.png`,
 *    `fish2_fc857cfa.png`, 9 retired far/mid/near backgrounds, duplicate iOS launch icons,
 *    and excluded non-fish mammal prey PNGs) from `public/assets/`, while leaving
 *    `ios-native/HungrySharkEvolution/Resources/Assets/` 100% untouched.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PREY_140_RECORDS } from '../src/game/preyDatabase140';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PUBLIC_ASSETS = path.join(ROOT_DIR, 'public', 'assets');
const PUBLIC_AISTUDIO = path.join(PUBLIC_ASSETS, 'aistudio');
const PUBLIC_PREY = path.join(PUBLIC_ASSETS, 'prey_140');
const PUBLIC_SHARKS = path.join(PUBLIC_ASSETS, 'sharks_3x');
const IOS_ASSETS = path.join(
  ROOT_DIR,
  'ios-native',
  'HungrySharkEvolution',
  'Resources',
  'Assets'
);

interface AssetJob {
  label: string;
  srcCandidates: string[];
  dst: string;
  args: (src: string, dst: string) => string[];
}

function resolveSource(candidates: string[]): string {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`[optimize-web-assets] Missing source asset. Checked:\n  ${candidates.join('\n  ')}`);
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

function walkBytes(dir: string): { files: number; bytes: number } {
  if (!fs.existsSync(dir)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walkBytes(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files++;
      bytes += fs.statSync(full).size;
    }
  }
  return { files, bytes };
}

async function extractDevourFx(): Promise<void> {
  const src = resolveSource([
    path.join(PUBLIC_AISTUDIO, 'fish_24bdaa5a.png'),
    path.join(IOS_ASSETS, 'fish_24bdaa5a.png'),
  ]);
  const dst = path.join(PUBLIC_AISTUDIO, 'devour_fx.webp');

  const { stdout } = await execFileAsync('identify', ['-format', '%w %h', src]);
  const [wStr, hStr] = stdout.trim().split(/\s+/);
  const fullW = Number(wStr);
  const fullH = Number(hStr);
  if (!fullW || !fullH) {
    throw new Error(`[optimize-web-assets] Unable to inspect dimensions of ${src}`);
  }

  // Matches SPRITE_CELL_BOUNDS.DEVOUR_FX = [0.795, 0.74, 0.99, 0.988]
  const sx = Math.floor(0.795 * fullW);
  const sy = Math.floor(0.74 * fullH);
  const cw = Math.max(1, Math.floor((0.99 - 0.795) * fullW));
  const ch = Math.max(1, Math.floor((0.988 - 0.74) * fullH));

  await execFileAsync('convert', [
    src,
    '-crop',
    `${cw}x${ch}+${sx}+${sy}`,
    '+repage',
    '-alpha',
    'set',
    '-fuzz',
    '10%',
    '-fill',
    'none',
    '-draw',
    'color 0,0 floodfill',
    '-trim',
    '+repage',
    '-bordercolor',
    'none',
    '-border',
    '2',
    '-resize',
    '128x128>',
    '-quality',
    '88',
    '-define',
    'webp:alpha-quality=96',
    '-define',
    'webp:method=6',
    dst,
  ]);
}

async function main(): Promise<void> {
  const before = walkBytes(PUBLIC_ASSETS);
  console.log(
    `[optimize-web-assets] Before: ${before.files} files, ${(before.bytes / 1024 / 1024).toFixed(2)} MB`
  );

  const jobs: AssetJob[] = [];
  const keepAistudio = new Set<string>(['devour_fx.webp']);
  const keepPrey = new Set<string>();
  const keepSharks = new Set<string>();

  // 1. 234 Active Marine Prey + cyber_mine (235 total) -> pre-trimmed <=420px WebP
  const activePreyIds = [...PREY_140_RECORDS.map((r) => r.id), 'cyber_mine'];
  for (const id of activePreyIds) {
    const outName = `${id}@3x.webp`;
    keepPrey.add(outName);
    const pngCandidates = [
      path.join(ROOT_DIR, 'raw_assets', 'prey_ai_transparent', `${id}@3x.png`),
      path.join(PUBLIC_PREY, `${id}@3x.png`),
      path.join(IOS_ASSETS, `${id}@3x.png`),
    ];
    const hasPngSource = pngCandidates.some((c) => fs.existsSync(c));
    const dstPath = path.join(PUBLIC_PREY, outName);
    if (!hasPngSource && fs.existsSync(dstPath)) {
      // Preserve existing pink placeholder WebP (or user-supplied direct WebP) when raw PNG is absent
      continue;
    }
    jobs.push({
      label: `prey/${outName}`,
      srcCandidates: pngCandidates,
      dst: dstPath,
      args: (src, dst) => [
        src,
        '-alpha',
        'on',
        '-fuzz',
        '6%',
        '-trim',
        '+repage',
        '-bordercolor',
        'none',
        '-border',
        '2',
        '-resize',
        '420x420>',
        '-quality',
        '86',
        '-define',
        'webp:alpha-quality=95',
        '-define',
        'webp:method=6',
        dst,
      ],
    });
  }

  // 2. 48 Individual Shark Forms -> pre-trimmed <=420px WebP
  for (let i = 0; i < 48; i++) {
    const num = String(i).padStart(2, '0');
    const outName = `shark_form_${num}@3x.webp`;
    keepSharks.add(outName);
    jobs.push({
      label: `sharks/${outName}`,
      srcCandidates: [
        path.join(PUBLIC_SHARKS, `shark_form_${num}@3x.png`),
        path.join(IOS_ASSETS, `shark_form_${num}@3x.png`),
      ],
      dst: path.join(PUBLIC_SHARKS, outName),
      args: (src, dst) => [
        src,
        '-alpha',
        'on',
        '-fuzz',
        '6%',
        '-trim',
        '+repage',
        '-bordercolor',
        'none',
        '-border',
        '2',
        '-resize',
        '420x420>',
        '-quality',
        '88',
        '-define',
        'webp:alpha-quality=96',
        '-define',
        'webp:method=6',
        dst,
      ],
    });
  }

  // 3. 17 Actively Used Web UI / Water / Seabed / Ecology / World Atlas Assets -> WebP
  const aistudioSpecs: Array<{
    srcFile: string;
    dstFile: string;
    maxGeom?: string;
    quality: number;
    alphaQuality?: number;
  }> = [
      // Water canopies & ambient sprites
      { srcFile: 'bg_shallow_0_water_0e65cb68.png', dstFile: 'bg_shallow_0_water_0e65cb68.webp', quality: 84 },
      { srcFile: 'bg_twilight_0_17bcb84c.png', dstFile: 'bg_twilight_0_17bcb84c.webp', quality: 84 },
      { srcFile: 'bg_abyss_0_1bbf506a.png', dstFile: 'bg_abyss_0_1bbf506a.webp', quality: 84 },
      { srcFile: 'bg_ambient_sprites_0c6882ce.png', dstFile: 'bg_ambient_sprites_0c6882ce.webp', quality: 92 },
      // UI Atlases & Title Logo (high quality so BFS white-key slicing stays 100% razor-sharp)
      { srcFile: 'icons_f5128c12.png', dstFile: 'icons_f5128c12.webp', quality: 92 },
      { srcFile: 'buttons_16e3a0cf.png', dstFile: 'buttons_16e3a0cf.webp', quality: 92 },
      { srcFile: 'setting_83a7a273.png', dstFile: 'setting_83a7a273.webp', quality: 92 },
      { srcFile: 'title3_cae0290c.png', dstFile: 'title3_cae0290c.webp', quality: 90, alphaQuality: 98 },
      // 4 Seabed Strips (runtime draws into 960x540 canvas -> cap at 1024px wide)
      { srcFile: 'seabed_strip_coral_reef.png', dstFile: 'seabed_strip_coral_reef.webp', maxGeom: '1024x1024>', quality: 86, alphaQuality: 95 },
      { srcFile: 'seabed_strip_rocky_shelf.png', dstFile: 'seabed_strip_rocky_shelf.webp', maxGeom: '1024x1024>', quality: 86, alphaQuality: 95 },
      { srcFile: 'seabed_strip_underwater_canyon.png', dstFile: 'seabed_strip_underwater_canyon.webp', maxGeom: '1024x1024>', quality: 86, alphaQuality: 95 },
      { srcFile: 'seabed_strip_deep_abyss.png', dstFile: 'seabed_strip_deep_abyss.webp', maxGeom: '1024x1024>', quality: 86, alphaQuality: 95 },
      // 4 Ecology Sprites (cap at 768px)
      { srcFile: 'ecology_coral_reef_cluster.png', dstFile: 'ecology_coral_reef_cluster.webp', maxGeom: '768x768>', quality: 86, alphaQuality: 95 },
      { srcFile: 'ecology_rocky_outcrop.png', dstFile: 'ecology_rocky_outcrop.webp', maxGeom: '768x768>', quality: 86, alphaQuality: 95 },
      { srcFile: 'ecology_kelp_forest_cluster.png', dstFile: 'ecology_kelp_forest_cluster.webp', maxGeom: '768x768>', quality: 86, alphaQuality: 95 },
      { srcFile: 'ecology_abyssal_vent_debris.png', dstFile: 'ecology_abyssal_vent_debris.webp', maxGeom: '768x768>', quality: 86, alphaQuality: 95 },
      // 2 World Atlases (BFS white-key sliced at runtime -> quality 90)
      { srcFile: 'world_pois_atlas_1794473250443.jpg', dstFile: 'world_pois_atlas_1794473250443.webp', quality: 90 },
      { srcFile: 'world_ecology_atlas_1794473252524.jpg', dstFile: 'world_ecology_atlas_1794473252524.webp', quality: 90 },
    ];

  for (const spec of aistudioSpecs) {
    keepAistudio.add(spec.dstFile);
    jobs.push({
      label: `aistudio/${spec.dstFile}`,
      srcCandidates: [
        path.join(PUBLIC_AISTUDIO, spec.srcFile),
        path.join(IOS_ASSETS, spec.srcFile),
      ],
      dst: path.join(PUBLIC_AISTUDIO, spec.dstFile),
      args: (src, dst) => {
        const cmd: string[] = [src];
        if (spec.maxGeom) {
          cmd.push('-resize', spec.maxGeom);
        }
        cmd.push(
          '-quality',
          String(spec.quality),
          '-define',
          `webp:alpha-quality=${spec.alphaQuality ?? 95}`,
          '-define',
          'webp:method=6',
          dst
        );
        return cmd;
      },
    });
  }

  // Extract standalone devour_fx.webp before cleaning legacy fish_24bdaa5a.png
  await extractDevourFx();

  const concurrency = Math.max(2, Math.min(8, os.cpus().length));
  console.log(`[optimize-web-assets] Converting ${jobs.length} assets with concurrency=${concurrency}...`);

  await runPool(jobs, concurrency, async (job) => {
    const src = resolveSource(job.srcCandidates);
    await execFileAsync('convert', job.args(src, job.dst));
  });

  // 4. Prune legacy / duplicate / non-WebP files from public/assets/*
  let removedCount = 0;
  const pruneDir = (dir: string, keepSet: Set<string>) => {
    for (const file of fs.readdirSync(dir)) {
      if (!keepSet.has(file)) {
        fs.rmSync(path.join(dir, file), { force: true, recursive: true });
        removedCount++;
      }
    }
  };
  pruneDir(PUBLIC_AISTUDIO, keepAistudio);
  pruneDir(PUBLIC_PREY, keepPrey);
  pruneDir(PUBLIC_SHARKS, keepSharks);

  const after = walkBytes(PUBLIC_ASSETS);
  const pct = (((before.bytes - after.bytes) / Math.max(1, before.bytes)) * 100).toFixed(1);
  console.log(
    `[optimize-web-assets] ✅ Done! Pruned ${removedCount} redundant files.`
  );
  console.log(
    `[optimize-web-assets] ✅ After: ${after.files} files, ${(after.bytes / 1024 / 1024).toFixed(2)} MB (-${pct}% vs ${(before.bytes / 1024 / 1024).toFixed(2)} MB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
