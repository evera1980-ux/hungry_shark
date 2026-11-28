import {
  getShark3xImageUrl,
  getSharkFormById,
  type SharkSpriteKey,
} from './sharkEvolutionConfig';
import {
  buildPrey140TiersWithMines,
  getPrey140ImageUrl,
} from './preyDatabase140';

export type PrimarySpriteFrameKey =
  | 'BASE_SHARK'      // Row 0, Col 0 (0)
  | 'MECHA_JAWS'      // Row 0, Col 1 (1)
  | 'ABYSS_JAWS'      // Row 0, Col 2 (2)
  | 'MAGMA_JAWS'      // Row 0, Col 3 (3)
  | 'MECHA_DORSAL'    // Row 1, Col 0 (4)
  | 'ABYSS_DORSAL'    // Row 1, Col 1 (5)
  | 'MAGMA_DORSAL'    // Row 1, Col 2 (6)
  | 'EVO_TAIL'        // Row 1, Col 3 (7)
  | 'PREY_JELLY'      // Row 2, Col 0 (8)
  | 'PREY_PUFFER'     // Row 2, Col 1 (9)
  | 'PREY_SUB'        // Row 2, Col 2 (10)
  | 'PREY_CRAB'       // Row 2, Col 3 (11)
  | 'PREY_EEL'        // Row 3, Col 0 (12)
  | 'PREY_MINE'       // Row 3, Col 1 (13)
  | 'PREY_KRAKEN'     // Row 3, Col 2 (14)
  | 'DEVOUR_FX';      // Row 3, Col 3 (15)

/**
 * All 30 marine target species & relics from the 6x5 sheet (/assets/aistudio/fish2_fc857cfa.png)
 */
export type Fish2SpriteKey =
  // Row 0: Shallow Reef Small Life
  | 'FISH2_TETRA_SCHOOL'
  | 'FISH2_BLUE_TANG'
  | 'FISH2_CLOWNFISH'
  | 'FISH2_SEAHORSE'
  | 'FISH2_HERMIT_CRAB'
  // Row 1: Coral Reef Mid-Tier
  | 'FISH2_BUTTERFLYFISH'
  | 'FISH2_BARRACUDA'
  | 'FISH2_LIONFISH'
  | 'FISH2_MORAY_EEL'
  | 'FISH2_SNORKEL_MASK'
  // Row 2: Twilight Bioluminescent & Pelagic
  | 'FISH2_JELLY_SWARM'
  | 'FISH2_HATCHETFISH'
  | 'FISH2_LANTERNFISH'
  | 'FISH2_VAMPIRE_SQUID'
  | 'FISH2_SPIKY_PUFFER'
  // Row 3: Deep Sea & Sunken Trench
  | 'FISH2_GIANT_ISOPOD'
  | 'FISH2_ANGLERFISH'
  | 'FISH2_COELACANTH'
  | 'FISH2_GIANT_SQUID'
  | 'FISH2_YELLOW_SUB'
  // Row 4: Abyssal Predators & Relics
  | 'FISH2_KING_CRAB'
  | 'FISH2_VIPERFISH'
  | 'FISH2_BLOBFISH'
  | 'FISH2_GULPER_EEL'
  | 'FISH2_SUNKEN_IDOL'
  // Row 5: Bosses, Hazards & Special Collectibles
  | 'FISH2_KRAKEN_TENTACLE'
  | 'FISH2_MECHA_SHARK'
  | 'FISH2_TOXIC_SLIME'
  | 'FISH2_MEG_TOOTH'
  | 'FISH2_PLASMA_CORE';

/**
 * 24 Professional Game UI Icons & Medallions from the 6x4 sheet (/assets/aistudio/icons_f5128c12.png)
 */
export type UiIconKey =
  // Row 0: Circular Tactical & Evolution Skill Medallions
  | 'UI_BTN_BOOST'
  | 'UI_BTN_BODY_UPGRADE'
  | 'UI_BTN_MORPH_EVOLVE'
  | 'UI_BTN_GOLD_FRENZY'
  | 'UI_BTN_GENE_SURGE'
  | 'UI_BTN_SUPPLY_DROP'
  // Row 1: HUD Frames, Virtual Joystick & Core Currencies
  | 'UI_AVATAR_FRAME'
  | 'UI_BADGE_TIER'
  | 'UI_JOYSTICK_BASE'
  | 'UI_JOYSTICK_KNOB'
  | 'UI_ICON_COIN'
  | 'UI_ICON_GENE'
  // Row 2: Telemetry, Status & Rewarded Video Icons
  | 'UI_ICON_BOUNTY_TARGET'
  | 'UI_ICON_DEPTH'
  | 'UI_ICON_COMBO_FIRE'
  | 'UI_ICON_SCORE_TROPHY'
  | 'UI_ICON_DANGER_SKULL'
  | 'UI_ICON_VIDEO_AD'
  // Row 3: System Controls & 4 Shark Evolution Lineage Crests
  | 'UI_ICON_PAUSE'
  | 'UI_ICON_SOUND'
  | 'UI_LINEAGE_BIO'
  | 'UI_LINEAGE_MECHA'
  | 'UI_LINEAGE_ELEM'
  | 'UI_LINEAGE_ABYSS';

export const UI_ICON_GRID_MAP: Record<UiIconKey, [number, number]> = {
  // Row 0
  UI_BTN_BOOST: [0, 0],
  UI_BTN_BODY_UPGRADE: [0, 1],
  UI_BTN_MORPH_EVOLVE: [0, 2],
  UI_BTN_GOLD_FRENZY: [0, 3],
  UI_BTN_GENE_SURGE: [0, 4],
  UI_BTN_SUPPLY_DROP: [0, 5],
  // Row 1
  UI_AVATAR_FRAME: [1, 0],
  UI_BADGE_TIER: [1, 1],
  UI_JOYSTICK_BASE: [1, 2],
  UI_JOYSTICK_KNOB: [1, 3],
  UI_ICON_COIN: [1, 4],
  UI_ICON_GENE: [1, 5],
  // Row 2
  UI_ICON_BOUNTY_TARGET: [2, 0],
  UI_ICON_DEPTH: [2, 1],
  UI_ICON_COMBO_FIRE: [2, 2],
  UI_ICON_SCORE_TROPHY: [2, 3],
  UI_ICON_DANGER_SKULL: [2, 4],
  UI_ICON_VIDEO_AD: [2, 5],
  // Row 3
  UI_ICON_PAUSE: [3, 0],
  UI_ICON_SOUND: [3, 1],
  UI_LINEAGE_BIO: [3, 2],
  UI_LINEAGE_MECHA: [3, 3],
  UI_LINEAGE_ELEM: [3, 4],
  UI_LINEAGE_ABYSS: [3, 5],
};

/**
 * 4 High-Craft Sci-Fi Game UI Banners & Pill Buttons from (/assets/aistudio/buttons_16e3a0cf.png):
 * - UI_PLATE_AVATAR_BAR: Top sci-fi metallic cyan-lit hollow ring + dark-navy angled data bar
 * - UI_BAR_BTN_GREEN: Bottom-left emerald cyclone play button with right play arrow
 * - UI_BAR_BTN_BLUE: Bottom-center sapphire DNA helix evolution button
 * - UI_BAR_BTN_GOLD: Bottom-right brushed-gold video ad clapperboard button
 */
export type UiBannerKey =
  | 'UI_PLATE_AVATAR_BAR'
  | 'UI_BAR_BTN_GREEN'
  | 'UI_BAR_BTN_BLUE'
  | 'UI_BAR_BTN_GOLD';

export const UI_BANNER_BOUNDS: Record<
  UiBannerKey,
  [number, number, number, number]
> = {
  UI_PLATE_AVATAR_BAR: [0.08, 0.02, 0.91, 0.6],
  UI_BAR_BTN_GREEN: [0.025, 0.68, 0.356, 0.94],
  UI_BAR_BTN_BLUE: [0.356, 0.68, 0.66, 0.94],
  UI_BAR_BTN_GOLD: [0.66, 0.68, 0.985, 0.94],
};

/**
 * 9 Sci-Fi Pause / Settings Modal UI Elements from (/assets/aistudio/setting_83a7a273.png):
 * - SETTING_MODAL_FRAME: Outer neon cyan/purple metallic dialog frame with top pause header plate
 * - SETTING_SHARK_CARD: Wide dark metallic shark summary card with recessed left square avatar frame
 * - SETTING_BTN_EVOLVE: Compact cyan octagonal button with left DNA double-helix icon
 * - SETTING_BTN_RESUME: Wide glowing emerald-green octagonal button with play triangle
 * - SETTING_BTN_LANG: Cyan-bordered dark octagonal button with left globe icon
 * - SETTING_BTN_SOUND: Cyan-bordered dark octagonal button with left speaker icon
 * - SETTING_BTN_TUTORIAL: Full-width gold-bordered dark carbon button with left graduation cap icon
 * - SETTING_BTN_RESTART: Steel-grey octagonal button with left circular refresh icon
 * - SETTING_BTN_MAIN_MENU: Steel-grey octagonal button with left door exit icon
 */
export type UiSettingKey =
  | 'SETTING_MODAL_FRAME'
  | 'SETTING_SHARK_CARD'
  | 'SETTING_BTN_EVOLVE'
  | 'SETTING_BTN_RESUME'
  | 'SETTING_BTN_LANG'
  | 'SETTING_BTN_SOUND'
  | 'SETTING_BTN_TUTORIAL'
  | 'SETTING_BTN_RESTART'
  | 'SETTING_BTN_MAIN_MENU';

export const UI_SETTING_BOUNDS: Record<
  UiSettingKey,
  [number, number, number, number]
> = {
  SETTING_MODAL_FRAME: [0.038, 0.048, 0.51, 0.635],
  SETTING_SHARK_CARD: [0.538, 0.085, 0.962, 0.308],
  SETTING_BTN_EVOLVE: [0.678, 0.39, 0.815, 0.506],
  SETTING_BTN_RESUME: [0.525, 0.55, 0.975, 0.755],
  SETTING_BTN_LANG: [0.038, 0.658, 0.268, 0.782],
  SETTING_BTN_SOUND: [0.276, 0.658, 0.504, 0.782],
  SETTING_BTN_TUTORIAL: [0.038, 0.805, 0.508, 0.935],
  SETTING_BTN_RESTART: [0.538, 0.81, 0.746, 0.925],
  SETTING_BTN_MAIN_MENU: [0.754, 0.81, 0.962, 0.925],
};

export type SpriteFrameKey =
  | PrimarySpriteFrameKey
  | Fish2SpriteKey
  | SharkSpriteKey
  | UiIconKey
  | UiBannerKey
  | UiSettingKey;

export const SPRITE_GRID_MAP: Record<PrimarySpriteFrameKey, [number, number]> = {
  BASE_SHARK: [0, 0],
  MECHA_JAWS: [0, 1],
  ABYSS_JAWS: [0, 2],
  MAGMA_JAWS: [0, 3],
  MECHA_DORSAL: [1, 0],
  ABYSS_DORSAL: [1, 1],
  MAGMA_DORSAL: [1, 2],
  EVO_TAIL: [1, 3],
  PREY_JELLY: [2, 0],
  PREY_PUFFER: [2, 1],
  PREY_SUB: [2, 2],
  PREY_CRAB: [2, 3],
  PREY_EEL: [3, 0],
  PREY_MINE: [3, 1],
  PREY_KRAKEN: [3, 2],
  DEVOUR_FX: [3, 3],
};

export const FISH2_GRID_MAP: Record<Fish2SpriteKey, [number, number]> = {
  // Row 0
  FISH2_TETRA_SCHOOL: [0, 0],
  FISH2_BLUE_TANG: [0, 1],
  FISH2_CLOWNFISH: [0, 2],
  FISH2_SEAHORSE: [0, 3],
  FISH2_HERMIT_CRAB: [0, 4],
  // Row 1
  FISH2_BUTTERFLYFISH: [1, 0],
  FISH2_BARRACUDA: [1, 1],
  FISH2_LIONFISH: [1, 2],
  FISH2_MORAY_EEL: [1, 3],
  FISH2_SNORKEL_MASK: [1, 4],
  // Row 2
  FISH2_JELLY_SWARM: [2, 0],
  FISH2_HATCHETFISH: [2, 1],
  FISH2_LANTERNFISH: [2, 2],
  FISH2_VAMPIRE_SQUID: [2, 3],
  FISH2_SPIKY_PUFFER: [2, 4],
  // Row 3
  FISH2_GIANT_ISOPOD: [3, 0],
  FISH2_ANGLERFISH: [3, 1],
  FISH2_COELACANTH: [3, 2],
  FISH2_GIANT_SQUID: [3, 3],
  FISH2_YELLOW_SUB: [3, 4],
  // Row 4
  FISH2_KING_CRAB: [4, 0],
  FISH2_VIPERFISH: [4, 1],
  FISH2_BLOBFISH: [4, 2],
  FISH2_GULPER_EEL: [4, 3],
  FISH2_SUNKEN_IDOL: [4, 4],
  // Row 5
  FISH2_KRAKEN_TENTACLE: [5, 0],
  FISH2_MECHA_SHARK: [5, 1],
  FISH2_TOXIC_SLIME: [5, 2],
  FISH2_MEG_TOOTH: [5, 3],
  FISH2_PLASMA_CORE: [5, 4],
};

/**
 * Exact normalized cell bounds [x0, y0, x1, y1] for each of the 16 sprites in the primary 4x4 sheet
 */
export const SPRITE_CELL_BOUNDS: Record<
  PrimarySpriteFrameKey,
  [number, number, number, number]
> = {
  // Row 0
  BASE_SHARK: [0.01, 0.0, 0.315, 0.275],
  MECHA_JAWS: [0.325, 0.02, 0.52, 0.255],
  ABYSS_JAWS: [0.53, 0.01, 0.75, 0.265],
  MAGMA_JAWS: [0.77, 0.0, 0.99, 0.265],
  // Row 1
  MECHA_DORSAL: [0.015, 0.275, 0.275, 0.492],
  ABYSS_DORSAL: [0.33, 0.27, 0.505, 0.495],
  MAGMA_DORSAL: [0.55, 0.275, 0.73, 0.485],
  EVO_TAIL: [0.785, 0.275, 0.97, 0.492],
  // Row 2
  PREY_JELLY: [0.045, 0.49, 0.265, 0.732],
  PREY_PUFFER: [0.335, 0.5, 0.5, 0.726],
  PREY_SUB: [0.52, 0.485, 0.695, 0.728],
  PREY_CRAB: [0.79, 0.505, 0.985, 0.732],
  // Row 3
  PREY_EEL: [0.015, 0.74, 0.315, 0.988],
  PREY_MINE: [0.345, 0.725, 0.495, 0.995],
  PREY_KRAKEN: [0.505, 0.73, 0.785, 0.992],
  DEVOUR_FX: [0.795, 0.74, 0.99, 0.988],
};

/**
 * Exact whitespace-valley normalized cell bounds [x0, y0, x1, y1] for all 30 sprites in /assets/aistudio/fish2_fc857cfa.png
 */
export const FISH2_CELL_BOUNDS: Record<
  Fish2SpriteKey,
  [number, number, number, number]
> = {
  // Column 0 (x: 0.000 .. 0.194)
  FISH2_TETRA_SCHOOL: [0.0, 0.0, 0.194, 0.138],
  FISH2_BUTTERFLYFISH: [0.0, 0.138, 0.194, 0.3242],
  FISH2_JELLY_SWARM: [0.0, 0.3242, 0.194, 0.4974],
  FISH2_GIANT_ISOPOD: [0.0, 0.4974, 0.194, 0.6563],
  FISH2_KING_CRAB: [0.0, 0.6563, 0.194, 0.8294],
  FISH2_KRAKEN_TENTACLE: [0.0, 0.8294, 0.194, 1.0],

  // Column 1 (x: 0.194 .. 0.398)
  FISH2_BLUE_TANG: [0.194, 0.0, 0.398, 0.151],
  FISH2_BARRACUDA: [0.194, 0.151, 0.398, 0.3177],
  FISH2_HATCHETFISH: [0.194, 0.3177, 0.398, 0.4974],
  FISH2_ANGLERFISH: [0.194, 0.4974, 0.398, 0.6641],
  FISH2_VIPERFISH: [0.194, 0.6641, 0.398, 0.8138],
  FISH2_MECHA_SHARK: [0.194, 0.8138, 0.398, 1.0],

  // Column 2 (x: 0.398 .. 0.598)
  FISH2_CLOWNFISH: [0.398, 0.0, 0.598, 0.151],
  FISH2_LIONFISH: [0.398, 0.151, 0.598, 0.3307],
  FISH2_LANTERNFISH: [0.398, 0.3307, 0.598, 0.4883],
  FISH2_COELACANTH: [0.398, 0.4883, 0.598, 0.6589],
  FISH2_BLOBFISH: [0.398, 0.6589, 0.598, 0.832],
  FISH2_TOXIC_SLIME: [0.398, 0.832, 0.598, 1.0],

  // Column 3 (x: 0.598 .. 0.822)
  FISH2_SEAHORSE: [0.598, 0.0, 0.822, 0.1641],
  FISH2_MORAY_EEL: [0.598, 0.1641, 0.822, 0.3008],
  FISH2_VAMPIRE_SQUID: [0.598, 0.3008, 0.822, 0.4922],
  FISH2_GIANT_SQUID: [0.598, 0.4922, 0.822, 0.6641],
  FISH2_GULPER_EEL: [0.598, 0.6641, 0.822, 0.8164],
  FISH2_MEG_TOOTH: [0.598, 0.8164, 0.822, 1.0],

  // Column 4 (x: 0.822 .. 1.000)
  FISH2_HERMIT_CRAB: [0.822, 0.0, 1.0, 0.1549],
  FISH2_SNORKEL_MASK: [0.822, 0.1549, 1.0, 0.3268],
  FISH2_SPIKY_PUFFER: [0.822, 0.3268, 1.0, 0.4987],
  FISH2_YELLOW_SUB: [0.822, 0.4987, 1.0, 0.6654],
  FISH2_SUNKEN_IDOL: [0.822, 0.6654, 1.0, 0.832],
  FISH2_PLASMA_CORE: [0.822, 0.832, 1.0, 1.0],
};

/**
 * Exact zero-pixel whitespace valley bounds for the 48 Shark Evolution Forms (8 cols x 6 rows)
 * in /assets/aistudio/sharks_ec921c3b.png (4096x2286 4K sheet)
 */
const SHARK_ROW_Y_BOUNDS = [0, 0.1185, 0.2474, 0.4154, 0.599, 0.8047, 1.0];
const SHARK_ROW_X_SPLITS: number[][] = [
  [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
  [0, 0.125, 0.2536, 0.375, 0.5065, 0.6352, 0.7565, 0.875, 1],
  [0, 0.1323, 0.2645, 0.3939, 0.5203, 0.6374, 0.7587, 0.8765, 1],
  [0, 0.1366, 0.2674, 0.3917, 0.5189, 0.641, 0.7587, 0.8779, 1],
  [0, 0.1374, 0.2696, 0.3903, 0.5167, 0.6366, 0.7594, 0.8779, 1],
  [0, 0.1424, 0.2733, 0.3917, 0.5203, 0.6366, 0.758, 0.8735, 1],
];

export const SHARK_GRID_MAP: Record<SharkSpriteKey, [number, number]> =
  {} as Record<SharkSpriteKey, [number, number]>;
export const SHARK_CELL_BOUNDS: Record<
  SharkSpriteKey,
  [number, number, number, number]
> = {} as Record<SharkSpriteKey, [number, number, number, number]>;

for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 8; c++) {
    const idx = r * 8 + c;
    const key = `SHARK_FORM_${String(idx).padStart(2, '0')}` as SharkSpriteKey;
    SHARK_GRID_MAP[key] = [r, c];
    SHARK_CELL_BOUNDS[key] = [
      SHARK_ROW_X_SPLITS[r][c],
      SHARK_ROW_Y_BOUNDS[r],
      SHARK_ROW_X_SPLITS[r][c + 1],
      SHARK_ROW_Y_BOUNDS[r + 1],
    ];
  }
}

export interface PreyDepthBandEntry {
  id: string;
  minDepth: number;
  maxDepth: number;
}

let cachedPreyDepthEntries: PreyDepthBandEntry[] | null = null;

function getAllPreyDepthEntries(): readonly PreyDepthBandEntry[] {
  if (!cachedPreyDepthEntries) {
    cachedPreyDepthEntries = buildPrey140TiersWithMines().map((cfg) => ({
      id: cfg.id,
      minDepth: cfg.minDepth,
      maxDepth: cfg.maxDepth,
    }));
  }
  return cachedPreyDepthEntries;
}

/**
 * Pure depth-band prey lazy-load selector:
 * Returns all active prey IDs whose gameplay habitat [minDepth, maxDepth] overlaps
 * `[max(0, depthMeters - 350), depthMeters + lookaheadMeters]`, ordered by proximity to `depthMeters`.
 */
export function selectPreyIdsForDepthBand(
  depthMeters: number,
  lookaheadMeters: number = 650
): string[] {
  const safeDepth = Number.isFinite(depthMeters) ? Math.max(0, depthMeters) : 0;
  const lo = Math.max(0, safeDepth - 350);
  const hi = safeDepth + Math.max(100, lookaheadMeters);
  const entries = getAllPreyDepthEntries();

  const matched = entries.filter((e) => e.minDepth <= hi && e.maxDepth >= lo);
  matched.sort((a, b) => {
    const aMid = (a.minDepth + a.maxDepth) * 0.5;
    const bMid = (b.minDepth + b.maxDepth) * 0.5;
    return Math.abs(aMid - safeDepth) - Math.abs(bMid - safeDepth);
  });
  return matched.map((e) => e.id);
}

/**
 * Pure on-demand shark window selector:
 * Returns unique wrapped indices around `centerIndex` prioritized center-first
 * (`[center, center+1, center-1, center+2, center-2, ...]`).
 */
export function selectSharkWindowIndices(
  centerIndex: number,
  radius: number = 4,
  total: number = 48
): number[] {
  if (total <= 0) return [];
  const norm = (i: number) => ((Math.floor(i) % total) + total) % total;
  const clampedRadius = Math.max(0, Math.min(total - 1, Math.floor(radius)));
  const out: number[] = [];
  const seen = new Set<number>();

  const push = (idx: number) => {
    const w = norm(idx);
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  };

  push(centerIndex);
  for (let d = 1; d <= clampedRadius; d++) {
    push(centerIndex + d);
    push(centerIndex - d);
  }
  return out;
}

export interface SpriteSheetLoadOptions {
  /** Currently selected shark form ID (e.g. 'shark_00_clown_fry') or index (0..47) */
  activeSharkId?: string | number;
  /** Initial ocean depth in meters for shallow prey band preloading (defaults to 0m) */
  initialDepthMeters?: number;
  devourFxUrl?: string;
  uiIconsUrl?: string;
  uiBannersUrl?: string;
  uiSettingsUrl?: string;
}

export const WEB_RUNTIME_ATLAS_URLS = {
  devourFx: '/assets/aistudio/devour_fx.webp',
  uiIcons: '/assets/aistudio/icons_f5128c12.webp',
  uiBanners: '/assets/aistudio/buttons_16e3a0cf.webp',
  uiSettings: '/assets/aistudio/setting_83a7a273.webp',
} as const;

export class SpriteSheetManager {
  public frames: Partial<Record<SpriteFrameKey, HTMLCanvasElement>> = {};
  public uiIconDataUrls: Partial<Record<UiIconKey, string>> = {};
  public uiBannerDataUrls: Partial<Record<UiBannerKey, string>> = {};
  public uiSettingDataUrls: Partial<Record<UiSettingKey, string>> = {};
  public uiSettingIconFrames: Partial<Record<UiSettingKey, HTMLCanvasElement>> =
    {};
  public uiSettingIconDataUrls: Partial<Record<UiSettingKey, string>> = {};
  public uiSettingCleanModalFrame: HTMLCanvasElement | null = null;
  public uiSettingCleanModalFrameDataUrl: string | undefined = undefined;
  public avatarBarHollowMetrics: {
    cxPct: number;
    cyPct: number;
    innerDiaPctH: number;
    outerDiaPctH: number;
    aspectRatio: number;
  } = {
    cxPct: 18.42,
    cyPct: 50.0,
    innerDiaPctH: 53.7,
    outerDiaPctH: 85.5,
    aspectRatio: 1102 / 406,
  };
  public rawGridFrames: HTMLCanvasElement[] = [];
  public fish2GridFrames: HTMLCanvasElement[] = [];
  public sharksGridFrames: HTMLCanvasElement[] = [];
  public uiIconsGridFrames: HTMLCanvasElement[] = [];
  public uiBannersGridFrames: HTMLCanvasElement[] = [];
  public uiSettingsGridFrames: HTMLCanvasElement[] = [];
  public loaded: boolean = false;
  public fish2Loaded: boolean = false;
  public sharksLoaded: boolean = false;
  public sharks3xLoadedCount: number = 0;
  private shark3xLoadedKeys: Set<SharkSpriteKey> = new Set();
  private shark3xLoadingKeys: Set<SharkSpriteKey> = new Set();
  public uiIconsLoaded: boolean = false;
  public uiBannersLoaded: boolean = false;
  public uiSettingsLoaded: boolean = false;
  public prey140Frames: Record<string, HTMLCanvasElement> = {};
  public prey140LoadedCount: number = 0;
  private prey140LoadingSet: Set<string> = new Set();
  private preloadedDepthBuckets: Set<number> = new Set();
  private loadingPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Draws an offline pre-trimmed WebP sprite directly into a right-sized canvas
   * with ZERO main-thread `getImageData()` pixel scanning.
   */
  private drawPretrimmedImageToCanvas(
    img: HTMLImageElement,
    maxWidth: number = 420
  ): HTMLCanvasElement | null {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return null;

    const scale = Math.min(1, maxWidth / srcW);
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  private resolveSharkIndex(keyOrIndex: SharkSpriteKey | number | string): number {
    if (typeof keyOrIndex === 'number') {
      return Math.max(0, Math.min(47, Math.floor(keyOrIndex)));
    }
    const match = /^SHARK_FORM_(\d{2})$/.exec(keyOrIndex);
    if (match) {
      return Math.max(0, Math.min(47, Number(match[1])));
    }
    return getSharkFormById(keyOrIndex).index;
  }

  /**
   * On-demand loader for any single shark form WebP (`/assets/sharks_3x/shark_form_XX@3x.webp`).
   * Eliminates startup download of all 48 sharks and legacy 7.2 MB `sharks_ec921c3b.png`.
   */
  public ensureSharkLoaded(keyOrIndex: SharkSpriteKey | number | string): Promise<void> {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve();
    }
    const idx = this.resolveSharkIndex(keyOrIndex);
    const key = `SHARK_FORM_${String(idx).padStart(2, '0')}` as SharkSpriteKey;
    if (this.shark3xLoadedKeys.has(key) || this.shark3xLoadingKeys.has(key)) {
      return Promise.resolve();
    }
    this.shark3xLoadingKeys.add(key);

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        const canvas = this.drawPretrimmedImageToCanvas(img, 420);
        if (canvas) {
          const prevFrame = this.frames[key];
          if (prevFrame && prevFrame !== canvas) {
            prevFrame.width = 0;
            prevFrame.height = 0;
          }
          this.frames[key] = canvas;
          this.sharksGridFrames[idx] = canvas;
          this.shark3xLoadedKeys.add(key);
          this.sharks3xLoadedCount = this.shark3xLoadedKeys.size;
          this.sharksLoaded = true;
          this.notifyListeners();
        }
        img.onload = null;
        img.onerror = null;
        this.shark3xLoadingKeys.delete(key);
        resolve();
      };
      img.onerror = () => {
        img.onload = null;
        img.onerror = null;
        this.shark3xLoadingKeys.delete(key);
        resolve();
      };
      img.src = getShark3xImageUrl(idx);
    });
  }

  /**
   * Preloads a small wrapped window of sharks around `centerIndex` (e.g. visible drum slots in the Atlas).
   */
  public ensureSharkWindowLoaded(centerIndex: number, radius: number = 5): void {
    const indices = selectSharkWindowIndices(centerIndex, radius, 48);
    for (const idx of indices) {
      void this.ensureSharkLoaded(idx);
    }
  }

  /**
   * Loads only the actively used WebP UI & FX assets + active shark + current shallow depth band:
   * 1. Standalone Devour FX WebP (`/assets/aistudio/devour_fx.webp`, ~6.7 KB — replaces 1.1 MB `fish_24bdaa5a.png`)
   * 2. Active Shark + Next Evolution Target WebP (`/assets/sharks_3x/shark_form_XX@3x.webp`, ~35 KB — replaces 7.2 MB + 7.0 MB)
   * 3. 24-Icon Game UI Atlas (`/assets/aistudio/icons_f5128c12.webp`)
   * 4. Sci-Fi Avatar Data Bar & 3 Pill Buttons (`/assets/aistudio/buttons_16e3a0cf.webp`)
   * 5. Pause / Settings Modal UI sheet (`/assets/aistudio/setting_83a7a273.webp`)
   * 6. Shallow starter prey band via `preloadPreyForDepth(initialDepthMeters)` (lazy-loaded by depth band, never all 135 upfront)
   */
  public load(options: SpriteSheetLoadOptions = {}): Promise<void> {
    if (
      this.loaded &&
      this.sharksLoaded &&
      this.uiIconsLoaded &&
      this.uiBannersLoaded &&
      this.uiSettingsLoaded
    ) {
      if (options.activeSharkId !== undefined) {
        void this.ensureSharkLoaded(options.activeSharkId);
      }
      return Promise.resolve();
    }
    if (this.loadingPromise) return this.loadingPromise;
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve();
    }

    const devourFxUrl = options.devourFxUrl ?? WEB_RUNTIME_ATLAS_URLS.devourFx;
    const uiIconsUrl = options.uiIconsUrl ?? WEB_RUNTIME_ATLAS_URLS.uiIcons;
    const uiBannersUrl = options.uiBannersUrl ?? WEB_RUNTIME_ATLAS_URLS.uiBanners;
    const uiSettingsUrl = options.uiSettingsUrl ?? WEB_RUNTIME_ATLAS_URLS.uiSettings;

    // Mark deprecated legacy sheets as complete without fetching fish_24bdaa5a.png / fish2_fc857cfa.png / sharks_ec921c3b.png
    this.fish2Loaded = true;

    const loadDevourFx = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        const canvas = this.drawPretrimmedImageToCanvas(img, 128);
        if (canvas) {
          this.frames.DEVOUR_FX = canvas;
        }
        this.loaded = true;
        this.notifyListeners();
        img.onload = null;
        img.onerror = null;
        resolve();
      };
      img.onerror = () => {
        this.loaded = true;
        img.onload = null;
        img.onerror = null;
        resolve();
      };
      img.src = devourFxUrl;
    });

    const activeIdx =
      options.activeSharkId !== undefined
        ? this.resolveSharkIndex(options.activeSharkId)
        : 0;
    const initialSharkIndices = Array.from(
      new Set([activeIdx, Math.min(47, activeIdx + 1)])
    );
    const loadActiveSharks = Promise.all(
      initialSharkIndices.map((idx) => this.ensureSharkLoaded(idx))
    ).then(() => undefined);

    const loadUiIcons = new Promise<void>((resolve) => {
      const imgIcons = new Image();
      imgIcons.crossOrigin = 'anonymous';
      imgIcons.decoding = 'async';
      imgIcons.onload = () => {
        this.processAndSliceUiIconsImage(imgIcons);
        this.uiIconsLoaded = true;
        this.notifyListeners();
        imgIcons.onload = null;
        imgIcons.onerror = null;
        resolve();
      };
      imgIcons.onerror = () => {
        imgIcons.onload = null;
        imgIcons.onerror = null;
        resolve();
      };
      imgIcons.src = uiIconsUrl;
    });

    const loadUiBanners = new Promise<void>((resolve) => {
      const imgBanners = new Image();
      imgBanners.crossOrigin = 'anonymous';
      imgBanners.decoding = 'async';
      imgBanners.onload = () => {
        this.processAndSliceUiBannersImage(imgBanners);
        this.uiBannersLoaded = true;
        this.notifyListeners();
        imgBanners.onload = null;
        imgBanners.onerror = null;
        resolve();
      };
      imgBanners.onerror = () => {
        imgBanners.onload = null;
        imgBanners.onerror = null;
        resolve();
      };
      imgBanners.src = uiBannersUrl;
    });

    const loadUiSettings = new Promise<void>((resolve) => {
      const imgSettings = new Image();
      imgSettings.crossOrigin = 'anonymous';
      imgSettings.decoding = 'async';
      imgSettings.onload = () => {
        this.processAndSliceUiSettingsImage(imgSettings);
        this.uiSettingsLoaded = true;
        this.notifyListeners();
        imgSettings.onload = null;
        imgSettings.onerror = null;
        resolve();
      };
      imgSettings.onerror = () => {
        imgSettings.onload = null;
        imgSettings.onerror = null;
        resolve();
      };
      imgSettings.src = uiSettingsUrl;
    });

    // Lazy-load ONLY the shallow starting prey band (instead of all 135 species on initial screen!)
    void this.preloadPreyForDepth(options.initialDepthMeters ?? 0, 380);

    this.loadingPromise = Promise.all([
      loadDevourFx,
      loadActiveSharks,
      loadUiIcons,
      loadUiBanners,
      loadUiSettings,
    ]).then(() => undefined);
    return this.loadingPromise;
  }

  public ensurePrey140Loaded(id: string, url?: string | null): void {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return;
    if (this.prey140Frames[id] || this.prey140LoadingSet.has(id)) return;
    const srcUrl = url || getPrey140ImageUrl(id);
    if (!srcUrl) return;
    this.prey140LoadingSet.add(id);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      const canvas = this.drawPretrimmedImageToCanvas(img, 420);
      if (canvas) {
        this.prey140Frames[id] = canvas;
        this.prey140LoadedCount = Object.keys(this.prey140Frames).length;
        this.notifyListeners();
      }
      img.onload = null;
      img.onerror = null;
      this.prey140LoadingSet.delete(id);
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      this.prey140LoadingSet.delete(id);
    };
    img.src = srcUrl;
  }

  /**
   * Depth-band lazy loader for the 235 active marine prey WebP assets.
   * Quantizes depth into 400m buckets so calling every simulation tick is O(1) zero-cost,
   * and streams only uncached species overlapping `[depth - 350m, depth + lookaheadMeters]`
   * in gentle batches of 8 with zero main-thread pixel trimming.
   */
  public async preloadPreyForDepth(
    depthMeters: number,
    lookaheadMeters: number = 650
  ): Promise<void> {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return;
    const bucket = Math.floor(Math.max(0, depthMeters) / 400);
    if (this.preloadedDepthBuckets.has(bucket)) return;
    this.preloadedDepthBuckets.add(bucket);

    const candidateIds = selectPreyIdsForDepthBand(depthMeters, lookaheadMeters).filter(
      (id) => !this.prey140Frames[id] && !this.prey140LoadingSet.has(id)
    );
    if (candidateIds.length === 0) return;

    const BATCH_SIZE = 8;
    for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
      const batch = candidateIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(
          (id) =>
            new Promise<void>((resolve) => {
              if (this.prey140Frames[id] || this.prey140LoadingSet.has(id)) {
                resolve();
                return;
              }
              this.prey140LoadingSet.add(id);
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.decoding = 'async';
              img.onload = () => {
                const canvas = this.drawPretrimmedImageToCanvas(img, 420);
                if (canvas) {
                  this.prey140Frames[id] = canvas;
                  this.prey140LoadedCount = Object.keys(this.prey140Frames).length;
                }
                img.onload = null;
                img.onerror = null;
                this.prey140LoadingSet.delete(id);
                resolve();
              };
              img.onerror = () => {
                img.onload = null;
                img.onerror = null;
                this.prey140LoadingSet.delete(id);
                resolve();
              };
              img.src = getPrey140ImageUrl(id);
            })
        )
      );
      this.notifyListeners();
    }
  }

  /**
   * Renders `@3x` (`384x384`) mathematical Signed-Distance-Field (SDF) textures for
   * `UI_JOYSTICK_BASE` (translucent aqua-crystal sonar ring + 4 rounded beveled directional arrows)
   * and `UI_JOYSTICK_KNOB` (3D glossy aqua-crystal thumb orb with metallic bevel collar).
   * Eliminates 100% of white-background matting fringes (`毛边`) and low-DPI pixelation.
   */
  private renderCrispJoystickIcon3x(
    key: 'UI_JOYSTICK_BASE' | 'UI_JOYSTICK_KNOB',
    size: number = 384
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const cx = size / 2;
    const cy = size / 2;
    const scale = size / 384;

    if (key === 'UI_JOYSTICK_BASE') {
      const rInner = 96.0 * scale;
      const rOuter = 148.0 * scale;
      const rMid = (rInner + rOuter) * 0.5;
      const rHalf = (rOuter - rInner) * 0.5;

      const sdSegment = (
        px: number,
        py: number,
        ax: number,
        ay: number,
        bx: number,
        by: number
      ): number => {
        const pax = px - ax;
        const pay = py - ay;
        const bax = bx - ax;
        const bay = by - ay;
        const h = Math.max(
          0,
          Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay))
        );
        return Math.hypot(pax - bax * h, pay - bay * h);
      };

      const sdCurvedArrow = (uRaw: number, vRaw: number): number => {
        const u = uRaw / scale;
        const v = vRaw / scale;
        const au = Math.abs(u);
        const tx = 0;
        const ty = 171.5;
        const bx = 24.5;
        const by = 125.0;
        const dSideSeg = sdSegment(au, v, tx, ty, bx, by);

        const clampedU = Math.min(bx, au);
        const ratio = clampedU / bx;
        const vCurve = 130.0 - 5.0 * ratio * ratio;
        const dBaseCurve = Math.hypot(au - clampedU, v - vCurve);
        const distBoundary = Math.min(dSideSeg, dBaseCurve);

        const sideCross = (au - tx) * (ty - by) + (v - ty) * (bx - tx);
        const fullRatio = au / bx;
        const vBaseAtU = 130.0 - 5.0 * fullRatio * fullRatio;
        const isInsideCore = sideCross <= 0 && v >= vBaseAtU && v <= ty;

        const signedCore = isInsideCore ? -distBoundary : distBoundary;
        return (signedCore - 8.5) * scale;
      };

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const rad = Math.hypot(dx, dy);
          const dRing = Math.abs(rad - rMid) - rHalf;

          const dTop = sdCurvedArrow(dx, -dy);
          const dBot = sdCurvedArrow(dx, dy);
          const dRight = sdCurvedArrow(dy, dx);
          const dLeft = sdCurvedArrow(dy, -dx);
          const dArrow = Math.min(dTop, dBot, dRight, dLeft);

          let u = dx / scale;
          let v = -dy / scale;
          if (dBot === dArrow) {
            u = dx / scale;
            v = dy / scale;
          } else if (dRight === dArrow) {
            u = dy / scale;
            v = dx / scale;
          } else if (dLeft === dArrow) {
            u = dy / scale;
            v = -dx / scale;
          }

          let outR = 0;
          let outG = 0;
          let outB = 0;
          let outA = 0;

          // Pure cyan ambient glow (zero white contamination)
          if (dRing >= 0 && dRing < 5.5 * scale) {
            const gA = Math.pow(1 - dRing / (5.5 * scale), 2) * 0.28;
            outR = 56;
            outG = 228;
            outB = 250;
            outA = gA;
          }

          // Translucent aqua-crystal torus ring with inner/outer neon rims
          if (dRing < 1.15) {
            const ringAlphaEdge = Math.max(0, Math.min(1, 0.55 - dRing * 0.85));
            const t = Math.max(
              0,
              Math.min(1, (rad - rInner) / (rOuter - rInner))
            );
            const innerRim = Math.exp(-Math.pow((t - 0.065) / 0.06, 2));
            const outerRim = Math.exp(-Math.pow((t - 0.935) / 0.06, 2));
            const rimFactor = Math.max(innerRim, outerRim);
            const groove =
              0.44 * Math.exp(-Math.pow((t - 0.81) / 0.095, 2)) +
              0.24 * Math.exp(-Math.pow((t - 0.19) / 0.095, 2));
            const light =
              0.5 - 0.5 * ((dx + dy) / (rad * Math.SQRT2 + 1e-5));

            let r = 114 + 30 * light - 54 * groove + 48 * rimFactor;
            let g = 199 + 20 * light - 44 * groove + 54 * rimFactor;
            let b = 217 + 16 * light - 36 * groove + 38 * rimFactor;

            const edgeDark = Math.max(0, 1 - Math.abs(dRing) / 1.3);
            r = r * (1 - 0.42 * edgeDark) + 14 * (0.42 * edgeDark);
            g = g * (1 - 0.3 * edgeDark) + 110 * (0.3 * edgeDark);
            b = b * (1 - 0.2 * edgeDark) + 145 * (0.2 * edgeDark);

            const rCol = Math.max(0, Math.min(255, r));
            const gCol = Math.max(0, Math.min(255, g));
            const bCol = Math.max(0, Math.min(255, b));
            const rA = ringAlphaEdge * (0.84 + 0.14 * rimFactor);

            const remA = outA * (1 - rA);
            const totA = rA + remA;
            if (totA > 0) {
              outR = (rCol * rA + outR * remA) / totA;
              outG = (gCol * rA + outG * remA) / totA;
              outB = (bCol * rA + outB * remA) / totA;
              outA = totA;
            }
          }

          // Contact shadow cast by directional arrows onto the ring
          if (dArrow < 5.5 * scale && dRing < 0.5) {
            const shadow =
              Math.max(
                0,
                Math.min(1, (5.5 * scale - Math.max(0, dArrow)) / (5.5 * scale))
              ) * 0.35;
            outR *= 1 - shadow;
            outG *= 1 - shadow * 0.85;
            outB *= 1 - shadow * 0.7;
          }

          // 4 Rounded Beveled Directional Arrows
          if (dArrow < 1.0) {
            const arrowEdgeAlpha = Math.max(
              0,
              Math.min(1, 0.5 - dArrow * 0.88)
            );
            const dNorm = dArrow / scale;
            let ar: number;
            let ag: number;
            let ab: number;
            if (dNorm > -5.8) {
              const bt = Math.max(0, Math.min(1, -dNorm / 5.8));
              ar = 6 + 10 * bt;
              ag = 56 + 34 * bt;
              ab = 72 + 38 * bt;
            } else {
              const innerD = -dNorm - 5.8;
              const rimMix = Math.exp(-Math.pow((innerD - 1.3) / 1.4, 2));
              const vt = Math.max(0, Math.min(1, (v - 122) / 50));
              const ridge =
                Math.exp(-Math.pow(u / 9.5, 2)) * 0.42 +
                (u < 0 ? 0.14 : -0.08);
              ar = Math.min(255, 22 + 120 * vt + 75 * ridge + 95 * rimMix);
              ag = Math.min(255, 192 + 56 * vt + 28 * ridge + 42 * rimMix);
              ab = Math.min(255, 234 + 21 * vt + 14 * ridge + 20 * rimMix);

              const borderBlend = Math.max(
                0,
                Math.min(1, (-5.8 - dNorm) / 1.25)
              );
              ar = 16 * (1 - borderBlend) + ar * borderBlend;
              ag = 90 * (1 - borderBlend) + ag * borderBlend;
              ab = 110 * (1 - borderBlend) + ab * borderBlend;
            }

            const aA = arrowEdgeAlpha;
            const remA = outA * (1 - aA);
            const finalA = aA + remA;
            if (finalA > 0) {
              outR = (ar * aA + outR * remA) / finalA;
              outG = (ag * aA + outG * remA) / finalA;
              outB = (ab * aA + outB * remA) / finalA;
              outA = finalA;
            }
          }

          const p = (y * size + x) * 4;
          data[p] = Math.round(outR);
          data[p + 1] = Math.round(outG);
          data[p + 2] = Math.round(outB);
          data[p + 3] = Math.round(outA * 255);
        }
      }
    } else {
      // UI_JOYSTICK_KNOB: 3D Glossy Aqua-Crystal Thumb Orb + Metallic Collar
      const rOuter = 162.0 * scale;
      const rCollarOuter = 155.5 * scale;
      const rCollarInner = 131.5 * scale;
      const rOrb = 125.0 * scale;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const rad = Math.hypot(dx, dy);
          if (rad > rOuter + 1.5) continue;

          const edgeAlpha = Math.max(
            0,
            Math.min(1, (rOuter + 0.5 - rad) * 0.9)
          );
          let r = 8;
          let g = 42;
          let b = 54;

          if (rad > rCollarOuter) {
            const t = (rad - rCollarOuter) / (rOuter - rCollarOuter);
            r = 8 + 12 * (1 - t);
            g = 40 + 32 * (1 - t);
            b = 52 + 38 * (1 - t);
          } else if (rad > rCollarInner) {
            const ct =
              (rad - rCollarInner) / (rCollarOuter - rCollarInner);
            const nx = dx / (rad + 1e-5);
            const ny = dy / (rad + 1e-5);
            const topLight = Math.max(0, -(nx * 0.55 + ny * 0.83));
            const botRefl = Math.max(0, -nx * 0.45 + ny * 0.89) * 0.55;
            const radialRidge = Math.sin(ct * Math.PI);
            const sheen = 0.35 + 0.65 * topLight + 0.35 * botRefl;

            r =
              45 +
              135 * sheen * radialRidge +
              30 * Math.pow(topLight, 3);
            g =
              115 +
              115 * sheen * radialRidge +
              22 * Math.pow(topLight, 3);
            b =
              140 +
              102 * sheen * radialRidge +
              15 * Math.pow(topLight, 3);

            if (rad > rCollarOuter - 1.4) {
              const bMix = (rCollarOuter - rad) / 1.4;
              r = 14 * (1 - bMix) + r * bMix;
              g = 58 * (1 - bMix) + g * bMix;
              b = 74 * (1 - bMix) + b * bMix;
            }
          } else if (rad > rOrb) {
            const gt = (rad - rOrb) / (rCollarInner - rOrb);
            r = 5 + 22 * gt;
            g = 62 + 42 * gt;
            b = 78 + 46 * gt;
          } else {
            const ux = dx / rOrb;
            const uy = dy / rOrb;
            const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));

            const coreDist = Math.hypot(ux + 0.16, uy + 0.18);
            const coreGlow = Math.max(0, 1 - coreDist * 0.88);
            const rimCaustic =
              Math.pow(1 - uz, 2.2) *
              (0.65 + 0.35 * (-ux * 0.6 + uy * 0.5));

            r = 4 + 28 * Math.pow(coreGlow, 1.5) + 85 * rimCaustic;
            g = 145 + 110 * Math.pow(coreGlow, 0.85) + 88 * rimCaustic;
            b = 195 + 60 * Math.pow(coreGlow, 0.7) + 52 * rimCaustic;

            const crescentDist = Math.hypot(ux - 0.36, uy - 0.08);
            const crescentShadow =
              Math.exp(-Math.pow(crescentDist / 0.45, 2)) *
              0.32 *
              (1 - rimCaustic);
            r *= 1 - crescentShadow;
            g *= 1 - crescentShadow * 0.75;
            b *= 1 - crescentShadow * 0.42;

            const hx1 = (ux + 0.28) * 0.82 + (uy + 0.54) * -0.57;
            const hy1 = (ux + 0.28) * 0.57 + (uy + 0.54) * 0.82;
            const spec1 = Math.exp(
              -Math.pow(Math.hypot(hx1 / 0.21, hy1 / 0.115), 2.4)
            );
            const spec2 =
              Math.exp(
                -Math.pow(
                  Math.hypot((ux - 0.04) / 0.065, (uy + 0.66) / 0.048),
                  2.4
                )
              ) * 0.65;

            const spec = Math.min(1, spec1 * 0.92 + spec2);
            r = r * (1 - spec) + 235 * spec;
            g = g * (1 - spec) + 254 * spec;
            b = b * (1 - spec) + 255 * spec;

            if (rad > rOrb - 1.3) {
              const oMix = (rOrb - rad) / 1.3;
              r = 6 * (1 - oMix) + r * oMix;
              g = 68 * (1 - oMix) + g * oMix;
              b = 84 * (1 - oMix) + b * oMix;
            }
          }

          const p = (y * size + x) * 4;
          data[p] = Math.max(0, Math.min(255, Math.round(r)));
          data[p + 1] = Math.max(0, Math.min(255, Math.round(g)));
          data[p + 2] = Math.max(0, Math.min(255, Math.round(b)));
          data[p + 3] = Math.round(edgeAlpha * 255);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Slices the 6x4 Game UI Icon Atlas (/assets/aistudio/icons_f5128c12.png) using
   * Flood-Fill Alpha Matting from the cell perimeter (plus hollow center seed for
   * UI_AVATAR_FRAME) and renders `@3x` (`384x384`) mathematical SDF textures for
   * `UI_JOYSTICK_BASE` and `UI_JOYSTICK_KNOB` with zero white fringe (`0 毛边`).
   */
  private processAndSliceUiIconsImage(img: HTMLImageElement): void {
    const fullW = img.naturalWidth || img.width;
    const fullH = img.naturalHeight || img.height;
    if (!fullW || !fullH) return;

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = fullW;
    rawCanvas.height = fullH;
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
    if (!rawCtx) return;
    rawCtx.drawImage(img, 0, 0);

    this.uiIconsGridFrames = [];
    const orderedKeys = Object.keys(UI_ICON_GRID_MAP) as UiIconKey[];

    for (const key of orderedKeys) {
      delete this.uiIconDataUrls[key];

      if (key === 'UI_JOYSTICK_BASE' || key === 'UI_JOYSTICK_KNOB') {
        const hdJoystickCanvas = this.renderCrispJoystickIcon3x(key, 384);
        this.frames[key] = hdJoystickCanvas;
        this.uiIconsGridFrames.push(hdJoystickCanvas);
        continue;
      }

      const [row, col] = UI_ICON_GRID_MAP[key];
      const sx = Math.floor((col / 6) * fullW);
      const sy = Math.floor((row / 4) * fullH);
      const ex = Math.floor(((col + 1) / 6) * fullW);
      const ey = Math.floor(((row + 1) / 4) * fullH);
      const cellW = Math.max(1, ex - sx);
      const cellH = Math.max(1, ey - sy);

      const cellData = rawCtx.getImageData(sx, sy, cellW, cellH);
      const data = cellData.data;
      const visited = new Uint8Array(cellW * cellH);
      const queue = new Int32Array(cellW * cellH);
      let qHead = 0;
      let qTail = 0;

      const isBgWhite = (idx: number): boolean => {
        const p = idx * 4;
        if (data[p + 3] < 16) return true;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        return (
          r >= 225 &&
          g >= 225 &&
          b >= 225 &&
          Math.max(r, g, b) - Math.min(r, g, b) <= 28
        );
      };

      const enqueue = (px: number, py: number) => {
        if (px < 0 || px >= cellW || py < 0 || py >= cellH) return;
        const idx = py * cellW + px;
        if (visited[idx]) return;
        if (!isBgWhite(idx)) return;
        visited[idx] = 1;
        queue[qTail++] = idx;
      };

      // Seed perimeter pixels
      for (let px = 0; px < cellW; px++) {
        enqueue(px, 0);
        enqueue(px, cellH - 1);
      }
      for (let py = 0; py < cellH; py++) {
        enqueue(0, py);
        enqueue(cellW - 1, py);
      }

      // Seed hollow center for ring icons (UI_AVATAR_FRAME)
      if (key === 'UI_AVATAR_FRAME') {
        const cx = Math.floor(cellW / 2);
        const cy = Math.floor(cellH / 2);
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            enqueue(cx + dx, cy + dy);
          }
        }
      }

      // BFS Flood-Fill
      while (qHead < qTail) {
        const curr = queue[qHead++];
        const p = curr * 4;
        data[p + 3] = 0;
        const cx = curr % cellW;
        const cy = (curr - cx) / cellW;
        if (cx > 0) enqueue(cx - 1, cy);
        if (cx + 1 < cellW) enqueue(cx + 1, cy);
        if (cy > 0) enqueue(cx, cy - 1);
        if (cy + 1 < cellH) enqueue(cx, cy + 1);
      }

      // Anti-alias feathering & white-background unmultiplication on boundary pixels next to flood-filled background
      for (let py = 1; py < cellH - 1; py++) {
        for (let px = 1; px < cellW - 1; px++) {
          const idx = py * cellW + px;
          if (visited[idx]) continue;
          if (
            visited[idx - 1] ||
            visited[idx + 1] ||
            visited[idx - cellW] ||
            visited[idx + cellW]
          ) {
            const p = idx * 4;
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const minC = Math.min(r, g, b);
            if (minC > 155) {
              const alphaFactor = Math.max(0.08, Math.min(1, (248 - minC) / 93));
              const invA = 1 / Math.max(0.2, alphaFactor);
              data[p] = Math.max(
                0,
                Math.min(255, Math.round((r - 255 * (1 - alphaFactor)) * invA))
              );
              data[p + 1] = Math.max(
                0,
                Math.min(255, Math.round((g - 255 * (1 - alphaFactor)) * invA))
              );
              data[p + 2] = Math.max(
                0,
                Math.min(255, Math.round((b - 255 * (1 - alphaFactor)) * invA))
              );
              data[p + 3] = Math.round(data[p + 3] * alphaFactor);
            }
          }
        }
      }

      // Find tight bounding box of non-transparent icon pixels
      let minX = cellW;
      let minY = cellH;
      let maxX = 0;
      let maxY = 0;
      let hasPixels = false;

      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          if (data[(py * cellW + px) * 4 + 3] > 20) {
            hasPixels = true;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }

      const tempCell = document.createElement('canvas');
      tempCell.width = cellW;
      tempCell.height = cellH;
      const tempCtx = tempCell.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(cellData, 0, 0);
      }

      // Normalize into a crisp 256x256 (@2x Retina) square offscreen canvas preserving aspect ratio
      const outSize = 256;
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = outSize;
      frameCanvas.height = outSize;
      const fCtx = frameCanvas.getContext('2d');

      if (fCtx && hasPixels) {
        fCtx.imageSmoothingEnabled = true;
        fCtx.imageSmoothingQuality = 'high';
        const bw = Math.max(1, maxX - minX + 1);
        const bh = Math.max(1, maxY - minY + 1);
        const targetSpan = outSize - 10; // 5px clean breathing margin on each side
        const scale = Math.min(targetSpan / bw, targetSpan / bh);
        const dw = bw * scale;
        const dh = bh * scale;
        const dx = (outSize - dw) / 2;
        const dy = (outSize - dh) / 2;
        fCtx.drawImage(tempCell, minX, minY, bw, bh, dx, dy, dw, dh);
      } else if (fCtx) {
        fCtx.drawImage(tempCell, 0, 0, cellW, cellH, 0, 0, outSize, outSize);
      }

      tempCell.width = 0;
      tempCell.height = 0;

      this.frames[key] = frameCanvas;
      this.uiIconsGridFrames.push(frameCanvas);
    }
    rawCanvas.width = 0;
    rawCanvas.height = 0;
  }

  /**
   * Slices & mattes the 4 Sci-Fi UI Banners & Buttons from (/assets/aistudio/buttons_16e3a0cf.png):
   * - Removes the neutral dark-grey background (~RGB 60,60,60) via perimeter Flood-Fill
   * - Hollows out the inner circular shark window of UI_PLATE_AVATAR_BAR at (0.240, 0.3125)
   * - Smoothly unmixes the grey background from outer neon cyan/green/blue/gold glow halos
   * - Preserves native tight aspect ratio for crisp rendering at any responsive size
   */
  private processAndSliceUiBannersImage(img: HTMLImageElement): void {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return;

    const scale = Math.min(1, 826 / srcW);
    const fullW = Math.max(1, Math.round(srcW * scale));
    const fullH = Math.max(1, Math.round(srcH * scale));

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = fullW;
    rawCanvas.height = fullH;
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
    if (!rawCtx) return;
    rawCtx.drawImage(img, 0, 0, fullW, fullH);

    this.uiBannersGridFrames = [];
    const orderedKeys = Object.keys(UI_BANNER_BOUNDS) as UiBannerKey[];

    for (const key of orderedKeys) {
      const [nx0, ny0, nx1, ny1] = UI_BANNER_BOUNDS[key];
      const sx = Math.floor(nx0 * fullW);
      const sy = Math.floor(ny0 * fullH);
      const ex = Math.floor(nx1 * fullW);
      const ey = Math.floor(ny1 * fullH);
      const cellW = Math.max(1, ex - sx);
      const cellH = Math.max(1, ey - sy);

      const cellData = rawCtx.getImageData(sx, sy, cellW, cellH);
      const data = cellData.data;
      const bgR = data[0] || 60;
      const bgG = data[1] || 60;
      const bgB = data[2] || 60;

      const visited = new Uint8Array(cellW * cellH);
      const queue = new Int32Array(cellW * cellH);
      let qHead = 0;
      let qTail = 0;

      const isNeutralGreyBg = (idx: number): boolean => {
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const diff = Math.max(
          Math.abs(r - bgR),
          Math.abs(g - bgG),
          Math.abs(b - bgB)
        );
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        return diff <= 16 && chroma <= 12;
      };

      const enqueue = (px: number, py: number) => {
        if (px < 0 || px >= cellW || py < 0 || py >= cellH) return;
        const idx = py * cellW + px;
        if (visited[idx]) return;
        if (!isNeutralGreyBg(idx)) return;
        visited[idx] = 1;
        queue[qTail++] = idx;
      };

      // Seed perimeter pixels
      for (let px = 0; px < cellW; px++) {
        enqueue(px, 0);
        enqueue(px, cellH - 1);
      }
      for (let py = 0; py < cellH; py++) {
        enqueue(0, py);
        enqueue(cellW - 1, py);
      }

      // Seed hollow avatar ring center for UI_PLATE_AVATAR_BAR
      const hollowFullCx = Math.round(0.2398 * fullW);
      const hollowFullCy = Math.round(0.3125 * fullH);
      if (key === 'UI_PLATE_AVATAR_BAR') {
        const localCx = hollowFullCx - sx;
        const localCy = hollowFullCy - sy;
        for (let dy = -8; dy <= 8; dy++) {
          for (let dx = -8; dx <= 8; dx++) {
            enqueue(localCx + dx, localCy + dy);
          }
        }
      }

      // BFS Flood-Fill of flat neutral grey background
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

      // Only seed boundary visited pixels (adjacent to unvisited pixels) for fast halo unmixing
      const distMap = new Uint8Array(cellW * cellH);
      let bHead = 0;
      let bTail = 0;
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
        if (d >= 5) continue;
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
          if (r < 38 && g < 46 && b > r + 6) continue;
          const diff = Math.max(
            Math.abs(r - bgR),
            Math.abs(g - bgG),
            Math.abs(b - bgB)
          );
          if (diff < 46) {
            distMap[nIdx] = d + 1;
            queue[bTail++] = nIdx;
            const alphaFactor = Math.min(1, Math.max(0.04, (diff - 8) / 38));
            data[p + 3] = Math.round(data[p + 3] * alphaFactor);
            const invA = 1 / Math.max(0.15, alphaFactor);
            data[p] = Math.max(
              0,
              Math.min(255, Math.round((r - bgR * (1 - alphaFactor)) * invA))
            );
            data[p + 1] = Math.max(
              0,
              Math.min(255, Math.round((g - bgG * (1 - alphaFactor)) * invA))
            );
            data[p + 2] = Math.max(
              0,
              Math.min(255, Math.round((b - bgB * (1 - alphaFactor)) * invA))
            );
          }
        }
      }

      // Compute tight bounding box of non-transparent pixels
      let minX = cellW;
      let minY = cellH;
      let maxX = 0;
      let maxY = 0;
      let hasPixels = false;

      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          if (data[(py * cellW + px) * 4 + 3] > 18) {
            hasPixels = true;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }

      const tempCell = document.createElement('canvas');
      tempCell.width = cellW;
      tempCell.height = cellH;
      const tempCtx = tempCell.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(cellData, 0, 0);
      }

      const pad = 2;
      const bx = hasPixels ? Math.max(0, minX - pad) : 0;
      const by = hasPixels ? Math.max(0, minY - pad) : 0;
      const bw = hasPixels
        ? Math.min(cellW - bx, maxX - minX + 1 + pad * 2)
        : cellW;
      const bh = hasPixels
        ? Math.min(cellH - by, maxY - minY + 1 + pad * 2)
        : cellH;

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = Math.max(1, bw);
      frameCanvas.height = Math.max(1, bh);
      const fCtx = frameCanvas.getContext('2d');
      if (fCtx) {
        fCtx.drawImage(tempCell, bx, by, bw, bh, 0, 0, bw, bh);
      }
      tempCell.width = 0;
      tempCell.height = 0;

      if (key === 'UI_PLATE_AVATAR_BAR' && hasPixels) {
        const croppedHollowCx = hollowFullCx - sx - bx;
        const croppedHollowCy = hollowFullCy - sy - by;
        const innerRadiusPx = 0.1419 * fullH;
        this.avatarBarHollowMetrics = {
          cxPct: Number(((croppedHollowCx / bw) * 100).toFixed(2)),
          cyPct: Number(((croppedHollowCy / bh) * 100).toFixed(2)),
          innerDiaPctH: Number((((innerRadiusPx * 2) / bh) * 100).toFixed(2)),
          outerDiaPctH: 85.5,
          aspectRatio: bw / bh,
        };
      }

      tempCell.width = 0;
      tempCell.height = 0;

      this.frames[key] = frameCanvas;
      this.uiBannersGridFrames.push(frameCanvas);
    }
    rawCanvas.width = 0;
    rawCanvas.height = 0;
  }

  /**
   * Slices & mattes the 9 Sci-Fi Pause / Settings Modal UI Elements from (/assets/aistudio/setting_83a7a273.png):
   * - Removes the dark charcoal grid background (~RGB 27,28,32) via perimeter Flood-Fill
   * - Hollows out the interior window of SETTING_MODAL_FRAME at (0.273, 0.380) so the background grid lines disappear
   * - Preserves native tight aspect ratios of all 9 components
   */
  private processAndSliceUiSettingsImage(img: HTMLImageElement): void {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return;

    const scale = Math.min(1, 826 / srcW);
    const fullW = Math.max(1, Math.round(srcW * scale));
    const fullH = Math.max(1, Math.round(srcH * scale));

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = fullW;
    rawCanvas.height = fullH;
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
    if (!rawCtx) return;
    rawCtx.drawImage(img, 0, 0, fullW, fullH);

    this.uiSettingsGridFrames = [];
    const orderedKeys = Object.keys(UI_SETTING_BOUNDS) as UiSettingKey[];

    for (const key of orderedKeys) {
      const [nx0, ny0, nx1, ny1] = UI_SETTING_BOUNDS[key];
      const sx = Math.floor(nx0 * fullW);
      const sy = Math.floor(ny0 * fullH);
      const ex = Math.floor(nx1 * fullW);
      const ey = Math.floor(ny1 * fullH);
      const cellW = Math.max(1, ex - sx);
      const cellH = Math.max(1, ey - sy);

      const cellData = rawCtx.getImageData(sx, sy, cellW, cellH);
      const data = cellData.data;
      const bgR = 28;
      const bgG = 28;
      const bgB = 31;

      const visited = new Uint8Array(cellW * cellH);
      const queue = new Int32Array(cellW * cellH);
      let qHead = 0;
      let qTail = 0;

      const isCharcoalGridBg = (idx: number): boolean => {
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        return r <= 37 && g <= 37 && b <= 41 && chroma <= 8;
      };

      const enqueue = (px: number, py: number) => {
        if (px < 0 || px >= cellW || py < 0 || py >= cellH) return;
        const idx = py * cellW + px;
        if (visited[idx]) return;
        if (!isCharcoalGridBg(idx)) return;
        visited[idx] = 1;
        queue[qTail++] = idx;
      };

      // Seed perimeter pixels
      for (let px = 0; px < cellW; px++) {
        enqueue(px, 0);
        enqueue(px, cellH - 1);
      }
      for (let py = 0; py < cellH; py++) {
        enqueue(0, py);
        enqueue(cellW - 1, py);
      }

      // Seed hollow interior window of SETTING_MODAL_FRAME so its inner grid lines become transparent
      if (key === 'SETTING_MODAL_FRAME') {
        const localCx = Math.round(0.273 * fullW) - sx;
        const localCy = Math.round(0.38 * fullH) - sy;
        for (let dy = -10; dy <= 10; dy++) {
          for (let dx = -10; dx <= 10; dx++) {
            enqueue(localCx + dx, localCy + dy);
          }
        }
      }

      // BFS Flood-Fill
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

      // Only seed boundary visited pixels (adjacent to unvisited pixels) for fast halo unmixing
      const distMap = new Uint8Array(cellW * cellH);
      let bHead = 0;
      let bTail = 0;
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
        if (d >= 4) continue;
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
          const diff = Math.max(
            Math.abs(r - bgR),
            Math.abs(g - bgG),
            Math.abs(b - bgB)
          );
          if (diff < 32) {
            distMap[nIdx] = d + 1;
            queue[bTail++] = nIdx;
            const alphaFactor = Math.min(1, Math.max(0.06, (diff - 4) / 28));
            data[p + 3] = Math.round(data[p + 3] * alphaFactor);
            const invA = 1 / Math.max(0.15, alphaFactor);
            data[p] = Math.max(
              0,
              Math.min(255, Math.round((r - bgR * (1 - alphaFactor)) * invA))
            );
            data[p + 1] = Math.max(
              0,
              Math.min(255, Math.round((g - bgG * (1 - alphaFactor)) * invA))
            );
            data[p + 2] = Math.max(
              0,
              Math.min(255, Math.round((b - bgB * (1 - alphaFactor)) * invA))
            );
          }
        }
      }

      // Compute tight bounding box of non-transparent pixels
      let minX = cellW;
      let minY = cellH;
      let maxX = 0;
      let maxY = 0;
      let hasPixels = false;

      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          if (data[(py * cellW + px) * 4 + 3] > 18) {
            hasPixels = true;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }

      const tempCell = document.createElement('canvas');
      tempCell.width = cellW;
      tempCell.height = cellH;
      const tempCtx = tempCell.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(cellData, 0, 0);
      }

      const pad = 2;
      const bx = hasPixels ? Math.max(0, minX - pad) : 0;
      const by = hasPixels ? Math.max(0, minY - pad) : 0;
      const bw = hasPixels
        ? Math.min(cellW - bx, maxX - minX + 1 + pad * 2)
        : cellW;
      const bh = hasPixels
        ? Math.min(cellH - by, maxY - minY + 1 + pad * 2)
        : cellH;

      let frameCanvas = document.createElement('canvas');
      frameCanvas.width = Math.max(1, bw);
      frameCanvas.height = Math.max(1, bh);
      const fCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
      if (fCtx) {
        fCtx.drawImage(tempCell, bx, by, bw, bh, 0, 0, bw, bh);
      }

      // For the 5 bottom setting buttons (LANG, SOUND, TUTORIAL, RESTART, MAIN_MENU),
      // extract the left-baked icon so it can be centered right next to the text (matching setting1.png)
      // and patch the far-left icon region with the button's clean symmetric right-side texture.
      if (
        fCtx &&
        (key === 'SETTING_BTN_LANG' ||
          key === 'SETTING_BTN_SOUND' ||
          key === 'SETTING_BTN_TUTORIAL' ||
          key === 'SETTING_BTN_RESTART' ||
          key === 'SETTING_BTN_MAIN_MENU')
      ) {
        const fImg = fCtx.getImageData(0, 0, bw, bh);
        const fData = fImg.data;
        let xStartRatio = 0.065;
        let xEndRatio = 0.26;
        if (key === 'SETTING_BTN_TUTORIAL') {
          xStartRatio = 0.038;
          xEndRatio = 0.155;
        } else if (key === 'SETTING_BTN_RESTART') {
          xStartRatio = 0.078;
          xEndRatio = 0.305;
        } else if (key === 'SETTING_BTN_MAIN_MENU') {
          xStartRatio = 0.078;
          xEndRatio = 0.32;
        }

        const ix0 = Math.max(2, Math.round(bw * xStartRatio));
        const ix1 = Math.min(bw - 4, Math.round(bw * xEndRatio));
        const iy0 = Math.max(2, Math.round(bh * 0.14));
        const iy1 = Math.min(bh - 3, Math.round(bh * 0.86));
        const iw = Math.max(1, ix1 - ix0 + 1);
        const ih = Math.max(1, iy1 - iy0 + 1);

        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = iw;
        iconCanvas.height = ih;
        const iconCtx = iconCanvas.getContext('2d');
        if (iconCtx) {
          const iconImg = iconCtx.createImageData(iw, ih);
          const iData = iconImg.data;
          let iMinX = iw;
          let iMinY = ih;
          let iMaxX = 0;
          let iMaxY = 0;
          let hasIconPx = false;

          const leftRefX = Math.max(1, ix0 - 2);
          const rightRefX = Math.min(bw - 2, ix1 + 2);
          const spanX = Math.max(1, rightRefX - leftRefX);

          for (let py = iy0; py <= iy1; py++) {
            const leftIdx = (py * bw + leftRefX) * 4;
            const rightIdx = (py * bw + rightRefX) * 4;
            const lR = fData[leftIdx];
            const lG = fData[leftIdx + 1];
            const lB = fData[leftIdx + 2];
            const lA = fData[leftIdx + 3];
            const rR = fData[rightIdx];
            const rG = fData[rightIdx + 1];
            const rB = fData[rightIdx + 2];
            const rA = fData[rightIdx + 3];

            for (let px = ix0; px <= ix1; px++) {
              const pIdx = (py * bw + px) * 4;
              const t = (px - leftRefX) / spanX;
              const bgRowR = Math.round(lR * (1 - t) + rR * t);
              const bgRowG = Math.round(lG * (1 - t) + rG * t);
              const bgRowB = Math.round(lB * (1 - t) + rB * t);
              const bgRowA = Math.round(lA * (1 - t) + rA * t);

              const r = fData[pIdx];
              const g = fData[pIdx + 1];
              const b = fData[pIdx + 2];

              const diff = Math.max(
                Math.abs(r - bgRowR),
                Math.abs(g - bgRowG),
                Math.abs(b - bgRowB)
              );
              if (diff > 11) {
                const lx = px - ix0;
                const ly = py - iy0;
                const outIdx = (ly * iw + lx) * 4;
                const alphaRatio = Math.min(1, (diff - 8) / 26);
                const invA = 1 / Math.max(0.22, alphaRatio);
                iData[outIdx] = Math.max(
                  0,
                  Math.min(
                    255,
                    Math.round((r - bgRowR * (1 - alphaRatio)) * invA)
                  )
                );
                iData[outIdx + 1] = Math.max(
                  0,
                  Math.min(
                    255,
                    Math.round((g - bgRowG * (1 - alphaRatio)) * invA)
                  )
                );
                iData[outIdx + 2] = Math.max(
                  0,
                  Math.min(
                    255,
                    Math.round((b - bgRowB * (1 - alphaRatio)) * invA)
                  )
                );
                iData[outIdx + 3] = Math.round(alphaRatio * 255);
                hasIconPx = true;
                if (lx < iMinX) iMinX = lx;
                if (ly < iMinY) iMinY = ly;
                if (lx > iMaxX) iMaxX = lx;
                if (ly > iMaxY) iMaxY = ly;
              }

              // Cleanly patch button interior with local scanline background gradient
              fData[pIdx] = bgRowR;
              fData[pIdx + 1] = bgRowG;
              fData[pIdx + 2] = bgRowB;
              fData[pIdx + 3] = bgRowA;
            }
          }

          fCtx.putImageData(fImg, 0, 0);
          iconCtx.putImageData(iconImg, 0, 0);

          if (hasIconPx) {
            const tw = Math.max(1, iMaxX - iMinX + 1);
            const th = Math.max(1, iMaxY - iMinY + 1);
            const trimmedIcon = document.createElement('canvas');
            trimmedIcon.width = tw;
            trimmedIcon.height = th;
            const tCtx = trimmedIcon.getContext('2d');
            if (tCtx) {
              tCtx.drawImage(iconCanvas, iMinX, iMinY, tw, th, 0, 0, tw, th);
            }
            this.uiSettingIconFrames[key] = trimmedIcon;
          }
          iconCanvas.width = 0;
          iconCanvas.height = 0;
        }
      }

      // 5-Slice widen SETTING_SHARK_CARD to 6.05:1 while also widening the left recessed avatar frame
      // so horizontal shark sprites fit 100% inside the recessed frame without overflowing!
      if (key === 'SETTING_SHARK_CARD' && bw > 20 && bh > 10) {
        const targetW = Math.round(bh * 6.05);
        if (targetW > bw) {
          const s1W = Math.round(bw * 0.085);
          const s2W = Math.round(bw * 0.09);
          const s3W = Math.round(bw * 0.085);
          const s5W = Math.round(bw * 0.1);
          const s4W = Math.max(1, bw - s1W - s2W - s3W - s5W);

          const extraAvatarW = Math.round(bh * 0.54);
          const dstS2W = s2W + extraAvatarW;
          const dstS4W = Math.max(1, targetW - s1W - dstS2W - s3W - s5W);

          const widened = document.createElement('canvas');
          widened.width = targetW;
          widened.height = bh;
          const wCtx = widened.getContext('2d');
          if (wCtx) {
            let srcX = 0;
            let dstX = 0;
            // Slice 1: Left card border + left rim of recessed avatar box
            wCtx.drawImage(frameCanvas, srcX, 0, s1W, bh, dstX, 0, s1W, bh);
            srcX += s1W;
            dstX += s1W;
            // Slice 2: Uniform middle of recessed avatar box (widened)
            wCtx.drawImage(frameCanvas, srcX, 0, s2W, bh, dstX, 0, dstS2W, bh);
            srcX += s2W;
            dstX += dstS2W;
            // Slice 3: Right rim of recessed avatar box
            wCtx.drawImage(frameCanvas, srcX, 0, s3W, bh, dstX, 0, s3W, bh);
            srcX += s3W;
            dstX += s3W;
            // Slice 4: Uniform middle of right card body
            wCtx.drawImage(frameCanvas, srcX, 0, s4W, bh, dstX, 0, dstS4W, bh);
            srcX += s4W;
            dstX += dstS4W;
            // Slice 5: Right chamfered border of card
            wCtx.drawImage(
              frameCanvas,
              bw - s5W,
              0,
              s5W,
              bh,
              dstX,
              0,
              s5W,
              bh
            );
            const oldCardCanvas = frameCanvas;
            frameCanvas = widened;
            oldCardCanvas.width = 0;
            oldCardCanvas.height = 0;
          }
        }
      }

      // For SETTING_MODAL_FRAME, also generate a clean medallion variant where only the inner || pause bars
      // inside the top circular header medallion (x: 39.6%..44.4%, y: 4.5%..11.2%) are smoothly interpolated
      // with the medallion's own dark-teal interior, preserving the outer glowing circular medallion ring 100% intact!
      if (key === 'SETTING_MODAL_FRAME' && bw > 40 && bh > 40) {
        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = bw;
        cleanCanvas.height = bh;
        const cCtx = cleanCanvas.getContext('2d', { willReadFrequently: true });
        if (cCtx) {
          cCtx.drawImage(frameCanvas, 0, 0);
          const cImg = cCtx.getImageData(0, 0, bw, bh);
          const cData = cImg.data;
          const ix0 = Math.max(2, Math.round(bw * 0.424));
          const ix1 = Math.min(bw - 4, Math.round(bw * 0.488));
          const iy0 = Math.max(2, Math.round(bh * 0.038));
          const iy1 = Math.min(bh - 2, Math.round(bh * 0.118));
          const spanX = Math.max(1, ix1 - ix0);

          for (let py = iy0; py <= iy1; py++) {
            const leftIdx = (py * bw + (ix0 - 1)) * 4;
            const rightIdx = (py * bw + (ix1 + 1)) * 4;
            const lR = cData[leftIdx];
            const lG = cData[leftIdx + 1];
            const lB = cData[leftIdx + 2];
            const lA = cData[leftIdx + 3];
            const rR = cData[rightIdx];
            const rG = cData[rightIdx + 1];
            const rB = cData[rightIdx + 2];
            const rA = cData[rightIdx + 3];

            for (let px = ix0; px <= ix1; px++) {
              const t = (px - ix0) / spanX;
              const dstIdx = (py * bw + px) * 4;
              cData[dstIdx] = Math.round(lR * (1 - t) + rR * t);
              cData[dstIdx + 1] = Math.round(lG * (1 - t) + rG * t);
              cData[dstIdx + 2] = Math.round(lB * (1 - t) + rB * t);
              cData[dstIdx + 3] = Math.round(lA * (1 - t) + rA * t);
            }
          }
          cCtx.putImageData(cImg, 0, 0);
          this.uiSettingCleanModalFrame = cleanCanvas;
        }
      }

      this.frames[key] = frameCanvas;
      this.uiSettingsGridFrames.push(frameCanvas);
    }
    rawCanvas.width = 0;
    rawCanvas.height = 0;
  }

  public getFrame(key: SpriteFrameKey): HTMLCanvasElement | undefined {
    return this.frames[key];
  }

  public getUiIconFrame(key: UiIconKey): HTMLCanvasElement | undefined {
    if (
      !this.frames[key] &&
      (key === 'UI_JOYSTICK_BASE' || key === 'UI_JOYSTICK_KNOB') &&
      typeof document !== 'undefined'
    ) {
      this.frames[key] = this.renderCrispJoystickIcon3x(key, 384);
    }
    return this.frames[key];
  }

  public getUiIconDataUrl(key: UiIconKey): string | undefined {
    const cached = this.uiIconDataUrls[key];
    if (cached) return cached;
    const frameCanvas = this.getUiIconFrame(key);
    if (!frameCanvas) return undefined;
    try {
      const dataUrl = frameCanvas.toDataURL('image/png');
      this.uiIconDataUrls[key] = dataUrl;
      return dataUrl;
    } catch {
      return undefined;
    }
  }

  public getUiBannerFrame(key: UiBannerKey): HTMLCanvasElement | undefined {
    return this.frames[key];
  }

  public getUiBannerDataUrl(key: UiBannerKey): string | undefined {
    const cached = this.uiBannerDataUrls[key];
    if (cached) return cached;
    const frameCanvas = this.frames[key];
    if (!frameCanvas) return undefined;
    try {
      const dataUrl = frameCanvas.toDataURL('image/png');
      this.uiBannerDataUrls[key] = dataUrl;
      return dataUrl;
    } catch {
      return undefined;
    }
  }

  public getUiSettingFrame(key: UiSettingKey): HTMLCanvasElement | undefined {
    return this.frames[key];
  }

  public getUiSettingDataUrl(key: UiSettingKey): string | undefined {
    const cached = this.uiSettingDataUrls[key];
    if (cached) return cached;
    const frameCanvas = this.frames[key];
    if (!frameCanvas) return undefined;
    try {
      const dataUrl = frameCanvas.toDataURL('image/png');
      this.uiSettingDataUrls[key] = dataUrl;
      return dataUrl;
    } catch {
      return undefined;
    }
  }

  public getUiSettingCleanModalFrameDataUrl(): string | undefined {
    if (this.uiSettingCleanModalFrameDataUrl) {
      return this.uiSettingCleanModalFrameDataUrl;
    }
    const cleanCanvas =
      this.uiSettingCleanModalFrame ?? this.frames.SETTING_MODAL_FRAME;
    if (!cleanCanvas) return undefined;
    try {
      const dataUrl = cleanCanvas.toDataURL('image/png');
      this.uiSettingCleanModalFrameDataUrl = dataUrl;
      return dataUrl;
    } catch {
      return undefined;
    }
  }

  public getUiSettingIconDataUrl(key: UiSettingKey): string | undefined {
    const cached = this.uiSettingIconDataUrls[key];
    if (cached) return cached;
    const iconCanvas = this.uiSettingIconFrames[key];
    if (!iconCanvas) return undefined;
    try {
      const dataUrl = iconCanvas.toDataURL('image/png');
      this.uiSettingIconDataUrls[key] = dataUrl;
      return dataUrl;
    } catch {
      return undefined;
    }
  }

  public getSharkFormFrame(
    keyOrIndex: SharkSpriteKey | number
  ): HTMLCanvasElement | undefined {
    const idx = this.resolveSharkIndex(keyOrIndex);
    const key = `SHARK_FORM_${String(idx).padStart(2, '0')}` as SharkSpriteKey;
    const frame = this.frames[key];
    if (!frame) {
      void this.ensureSharkLoaded(idx);
    }
    return frame;
  }

  public getSharkForm3xUrl(keyOrIndex: SharkSpriteKey | number): string {
    return getShark3xImageUrl(keyOrIndex);
  }

  public getPreySprite(config: {
    id?: string;
    tier: number;
    spriteKey?: SpriteFrameKey;
    externalPngUrl?: string | null;
  }): HTMLCanvasElement | undefined {
    if (config.id && this.prey140Frames[config.id]) {
      return this.prey140Frames[config.id];
    }
    if (config.externalPngUrl && config.id) {
      this.ensurePrey140Loaded(config.id, config.externalPngUrl);
      return undefined;
    }
    if (config.spriteKey && this.frames[config.spriteKey]) {
      return this.frames[config.spriteKey];
    }
    return this.getPreyFrame(config.tier);
  }

  public getPreyFrame(tier: number): HTMLCanvasElement | undefined {
    switch (tier) {
      case 1:
        return this.frames.FISH2_JELLY_SWARM ?? this.frames.PREY_JELLY;
      case 2:
        return this.frames.FISH2_CLOWNFISH ?? this.frames.PREY_CRAB;
      case 3:
        return this.frames.FISH2_SPIKY_PUFFER ?? this.frames.PREY_PUFFER;
      case 4:
        return this.frames.FISH2_YELLOW_SUB ?? this.frames.PREY_SUB;
      case 5:
        return this.frames.FISH2_ANGLERFISH ?? this.frames.PREY_EEL;
      case 6:
        return this.frames.PREY_MINE;
      case 7:
        return this.frames.FISH2_COELACANTH ?? this.frames.PREY_CRAB;
      case 8:
        return this.frames.PREY_KRAKEN;
      default:
        return this.frames.PREY_JELLY;
    }
  }
}

export const spriteSheetManager = new SpriteSheetManager();
