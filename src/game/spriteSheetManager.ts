import type { SharkSpriteKey } from './sharkEvolutionConfig';

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
  public uiIconsLoaded: boolean = false;
  public uiBannersLoaded: boolean = false;
  public uiSettingsLoaded: boolean = false;
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
   * Loads:
   * 1. Primary 4x4 sprite sheet (/assets/aistudio/fish_24bdaa5a.png)
   * 2. Extended 6x5 target fish sprite sheet (/assets/aistudio/fish2_fc857cfa.png)
   * 3. 48-Shark Evolution Matrix 8x6 sprite sheet (/assets/aistudio/sharks_ec921c3b.png)
   * 4. 24-Icon Game UI Atlas 6x4 sprite sheet (/assets/aistudio/icons_f5128c12.png)
   * 5. Sci-Fi Avatar Data Bar & 3 Pill Buttons sheet (/assets/aistudio/buttons_16e3a0cf.png)
   * 6. Pause / Settings Modal UI sheet (/assets/aistudio/setting_83a7a273.png)
   */
  public load(
    primaryUrl: string = '/assets/aistudio/fish_24bdaa5a.png',
    fish2Url: string = '/assets/aistudio/fish2_fc857cfa.png',
    sharksUrl: string = '/assets/aistudio/sharks_ec921c3b.png',
    uiIconsUrl: string = '/assets/aistudio/icons_f5128c12.png',
    uiBannersUrl: string = '/assets/aistudio/buttons_16e3a0cf.png',
    uiSettingsUrl: string = '/assets/aistudio/setting_83a7a273.png'
  ): Promise<void> {
    if (
      this.loaded &&
      this.fish2Loaded &&
      this.sharksLoaded &&
      this.uiIconsLoaded &&
      this.uiBannersLoaded &&
      this.uiSettingsLoaded
    ) {
      return Promise.resolve();
    }
    if (this.loadingPromise) return this.loadingPromise;
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve();
    }

    const loadPrimary = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.processAndSlicePrimaryImage(img);
        this.loaded = true;
        this.notifyListeners();
        resolve();
      };
      img.onerror = () => {
        if (primaryUrl !== '/spritesheet.png') {
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          fallbackImg.onload = () => {
            this.processAndSlicePrimaryImage(fallbackImg);
            this.loaded = true;
            this.notifyListeners();
            resolve();
          };
          fallbackImg.onerror = () => resolve();
          fallbackImg.src = '/spritesheet.png';
        } else {
          resolve();
        }
      };
      img.src = primaryUrl;
    });

    const loadFish2 = new Promise<void>((resolve) => {
      const img2 = new Image();
      img2.crossOrigin = 'anonymous';
      img2.onload = () => {
        this.processAndSliceFish2Image(img2);
        this.fish2Loaded = true;
        this.notifyListeners();
        resolve();
      };
      img2.onerror = () => resolve();
      img2.src = fish2Url;
    });

    const loadSharks = new Promise<void>((resolve) => {
      const imgSharks = new Image();
      imgSharks.crossOrigin = 'anonymous';
      imgSharks.onload = () => {
        this.processAndSliceSharksImage(imgSharks);
        this.sharksLoaded = true;
        this.notifyListeners();
        resolve();
      };
      imgSharks.onerror = () => resolve();
      imgSharks.src = sharksUrl;
    });

    const loadUiIcons = new Promise<void>((resolve) => {
      const imgIcons = new Image();
      imgIcons.crossOrigin = 'anonymous';
      imgIcons.onload = () => {
        this.processAndSliceUiIconsImage(imgIcons);
        this.uiIconsLoaded = true;
        this.notifyListeners();
        resolve();
      };
      imgIcons.onerror = () => resolve();
      imgIcons.src = uiIconsUrl;
    });

    const loadUiBanners = new Promise<void>((resolve) => {
      const imgBanners = new Image();
      imgBanners.crossOrigin = 'anonymous';
      imgBanners.onload = () => {
        this.processAndSliceUiBannersImage(imgBanners);
        this.uiBannersLoaded = true;
        this.notifyListeners();
        resolve();
      };
      imgBanners.onerror = () => resolve();
      imgBanners.src = uiBannersUrl;
    });

    const loadUiSettings = new Promise<void>((resolve) => {
      const imgSettings = new Image();
      imgSettings.crossOrigin = 'anonymous';
      imgSettings.onload = () => {
        this.processAndSliceUiSettingsImage(imgSettings);
        this.uiSettingsLoaded = true;
        this.notifyListeners();
        resolve();
      };
      imgSettings.onerror = () => resolve();
      imgSettings.src = uiSettingsUrl;
    });

    this.loadingPromise = Promise.all([
      loadPrimary,
      loadFish2,
      loadSharks,
      loadUiIcons,
      loadUiBanners,
      loadUiSettings,
    ]).then(() => undefined);
    return this.loadingPromise;
  }

  private createChromaKeyCanvas(
    img: HTMLImageElement
  ): { sheetCanvas: HTMLCanvasElement; imgData: ImageData } | null {
    const fullW = img.naturalWidth || img.width;
    const fullH = img.naturalHeight || img.height;
    if (!fullW || !fullH) return null;

    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = fullW;
    sheetCanvas.height = fullH;
    const sheetCtx = sheetCanvas.getContext('2d', { willReadFrequently: true });
    if (!sheetCtx) return null;

    sheetCtx.drawImage(img, 0, 0);
    const imgData = sheetCtx.getImageData(0, 0, fullW, fullH);
    const data = imgData.data;

    // Chroma-Key White Background Removal: R > 240, G > 240, B > 240 -> Alpha = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0;
      } else if (r > 222 && g > 222 && b > 222) {
        const maxChannel = Math.max(r, g, b);
        const factor = Math.max(0, (240 - maxChannel) / 18);
        data[i + 3] = Math.round(data[i + 3] * factor);
      }
    }
    sheetCtx.putImageData(imgData, 0, 0);
    return { sheetCanvas, imgData };
  }

  private sliceBoundedFrame(
    sheetCanvas: HTMLCanvasElement,
    fullData: Uint8ClampedArray,
    bounds: [number, number, number, number]
  ): HTMLCanvasElement {
    const fullW = sheetCanvas.width;
    const fullH = sheetCanvas.height;
    const [nx0, ny0, nx1, ny1] = bounds;
    const sx = Math.floor(nx0 * fullW);
    const sy = Math.floor(ny0 * fullH);
    const cellW = Math.max(1, Math.floor((nx1 - nx0) * fullW));
    const cellH = Math.max(1, Math.floor((ny1 - ny0) * fullH));

    let minX = cellW;
    let minY = cellH;
    let maxX = 0;
    let maxY = 0;
    let hasPixels = false;

    for (let py = 0; py < cellH; py++) {
      const rowOffset = (sy + py) * fullW + sx;
      for (let px = 0; px < cellW; px++) {
        const alpha = fullData[(rowOffset + px) * 4 + 3];
        if (alpha > 18) {
          hasPixels = true;
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
      }
    }

    const frameCanvas = document.createElement('canvas');
    if (hasPixels) {
      const pad = 4;
      const bx = Math.max(0, minX - pad);
      const by = Math.max(0, minY - pad);
      const bw = Math.min(cellW - bx, maxX - minX + 1 + pad * 2);
      const bh = Math.min(cellH - by, maxY - minY + 1 + pad * 2);
      frameCanvas.width = bw;
      frameCanvas.height = bh;
      const fCtx = frameCanvas.getContext('2d');
      if (fCtx) {
        fCtx.drawImage(sheetCanvas, sx + bx, sy + by, bw, bh, 0, 0, bw, bh);
      }
    } else {
      frameCanvas.width = cellW;
      frameCanvas.height = cellH;
      const fCtx = frameCanvas.getContext('2d');
      if (fCtx) {
        fCtx.drawImage(sheetCanvas, sx, sy, cellW, cellH, 0, 0, cellW, cellH);
      }
    }

    return frameCanvas;
  }

  private processAndSlicePrimaryImage(img: HTMLImageElement): void {
    const res = this.createChromaKeyCanvas(img);
    if (!res) return;
    const { sheetCanvas, imgData } = res;
    const fullData = imgData.data;

    this.rawGridFrames = [];
    const orderedKeys: PrimarySpriteFrameKey[] = [
      'BASE_SHARK',
      'MECHA_JAWS',
      'ABYSS_JAWS',
      'MAGMA_JAWS',
      'MECHA_DORSAL',
      'ABYSS_DORSAL',
      'MAGMA_DORSAL',
      'EVO_TAIL',
      'PREY_JELLY',
      'PREY_PUFFER',
      'PREY_SUB',
      'PREY_CRAB',
      'PREY_EEL',
      'PREY_MINE',
      'PREY_KRAKEN',
      'DEVOUR_FX',
    ];

    for (const key of orderedKeys) {
      const frameCanvas = this.sliceBoundedFrame(
        sheetCanvas,
        fullData,
        SPRITE_CELL_BOUNDS[key]
      );
      this.frames[key] = frameCanvas;
      this.rawGridFrames.push(frameCanvas);
    }
  }

  private processAndSliceFish2Image(img: HTMLImageElement): void {
    const res = this.createChromaKeyCanvas(img);
    if (!res) return;
    const { sheetCanvas, imgData } = res;
    const fullData = imgData.data;

    this.fish2GridFrames = [];
    const orderedFish2Keys = Object.keys(FISH2_GRID_MAP) as Fish2SpriteKey[];

    for (const key of orderedFish2Keys) {
      const frameCanvas = this.sliceBoundedFrame(
        sheetCanvas,
        fullData,
        FISH2_CELL_BOUNDS[key]
      );
      this.frames[key] = frameCanvas;
      this.fish2GridFrames.push(frameCanvas);
    }
  }

  private processAndSliceSharksImage(img: HTMLImageElement): void {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return;

    // High-DPI working resolution cap:
    // A 4K sheet (4096x2286 = 9.36M pixels) has ~512x381px per cell, whereas the largest
    // on-screen shark render is ~224x120 CSS px (448x240 physical px on 2x Retina).
    // Supersampling to 2400px width (~300x220 per cell) preserves 100% of 4K crispness
    // while cutting pixel-processing time and per-frame 18-slice GPU/CPU bandwidth by ~70%.
    const MAX_SHARK_SHEET_W = 2400;
    const scale = Math.min(1, MAX_SHARK_SHEET_W / srcW);
    const fullW = Math.max(1, Math.round(srcW * scale));
    const fullH = Math.max(1, Math.round(srcH * scale));

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = fullW;
    rawCanvas.height = fullH;
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
    if (!rawCtx) return;
    rawCtx.imageSmoothingEnabled = true;
    rawCtx.imageSmoothingQuality = 'high';
    rawCtx.drawImage(img, 0, 0, fullW, fullH);
    const fullImgData = rawCtx.getImageData(0, 0, fullW, fullH);
    const fullData = fullImgData.data;

    this.sharksGridFrames = [];
    const orderedSharkKeys = Object.keys(SHARK_GRID_MAP) as SharkSpriteKey[];
    const pad = Math.max(4, Math.round((fullW / 1376) * 4));

    // Preallocate reusable BFS buffers sized for the largest cell to avoid 48x GC allocations
    const maxCellPixels = Math.ceil(fullW * 0.2) * Math.ceil(fullH * 0.25);
    let sharedVisited = new Uint8Array(maxCellPixels);
    let sharedDistMap = new Uint8Array(maxCellPixels);
    let sharedQueue = new Int32Array(maxCellPixels);

    for (let idx = 0; idx < orderedSharkKeys.length; idx++) {
      const key = orderedSharkKeys[idx];
      const [nx0, ny0, nx1, ny1] = SHARK_CELL_BOUNDS[key];
      const sx = Math.floor(nx0 * fullW);
      const sy = Math.floor(ny0 * fullH);
      const cellW = Math.max(1, Math.floor((nx1 - nx0) * fullW));
      const cellH = Math.max(1, Math.floor((ny1 - ny0) * fullH));
      const cellLen = cellW * cellH;

      if (sharedVisited.length < cellLen) {
        sharedVisited = new Uint8Array(cellLen);
        sharedDistMap = new Uint8Array(cellLen);
        sharedQueue = new Int32Array(cellLen);
      } else {
        sharedVisited.fill(0, 0, cellLen);
        sharedDistMap.fill(0, 0, cellLen);
      }

      const visited = sharedVisited;
      const distMap = sharedDistMap;
      const queue = sharedQueue;

      const cellImg = rawCtx.createImageData(cellW, cellH);
      const data = cellImg.data;
      for (let py = 0; py < cellH; py++) {
        const srcRowStart = ((sy + py) * fullW + sx) * 4;
        const dstRowStart = py * cellW * 4;
        data.set(
          fullData.subarray(srcRowStart, srcRowStart + cellW * 4),
          dstRowStart
        );
      }

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

      // 1. Seed all 4 perimeter edges of the cell
      for (let px = 0; px < cellW; px++) {
        enqueue(px, 0);
        enqueue(px, cellH - 1);
      }
      for (let py = 0; py < cellH; py++) {
        enqueue(0, py);
        enqueue(cellW - 1, py);
      }

      // 2. Run BFS Flood-Fill for studio white background
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

      // 3. Also clear any enclosed pure studio-white pockets (e.g. inside portal rings, cable/tentacle loops)
      // while preserving Clown Fry (#00) white stripes and all internal shaded teeth/eyes/highlights
      if (idx !== 0) {
        const pocketMinSpan = Math.max(4, Math.round((fullW / 1376) * 3));
        for (let py = pocketMinSpan; py < cellH - pocketMinSpan; py += 2) {
          const rowOff = py * cellW;
          for (let px = pocketMinSpan; px < cellW - pocketMinSpan; px += 2) {
            const i = rowOff + px;
            if (visited[i]) continue;
            const p = i * 4;
            if (data[p] >= 252 && data[p + 1] >= 252 && data[p + 2] >= 252) {
              // Verify it is a flat pure-white background pocket (all 4 cardinal neighbors at pocketMinSpan are also pure >=250 white)
              const nUp = (py - pocketMinSpan) * cellW + px;
              const nDn = (py + pocketMinSpan) * cellW + px;
              const nLt = rowOff + (px - pocketMinSpan);
              const nRt = rowOff + (px + pocketMinSpan);
              if (
                data[nUp * 4] >= 250 &&
                data[nUp * 4 + 1] >= 250 &&
                data[nUp * 4 + 2] >= 250 &&
                data[nDn * 4] >= 250 &&
                data[nDn * 4 + 1] >= 250 &&
                data[nDn * 4 + 2] >= 250 &&
                data[nLt * 4] >= 250 &&
                data[nLt * 4 + 1] >= 250 &&
                data[nLt * 4 + 2] >= 250 &&
                data[nRt * 4] >= 250 &&
                data[nRt * 4 + 1] >= 250 &&
                data[nRt * 4 + 2] >= 250
              ) {
                qHead = 0;
                qTail = 0;
                enqueue(px, py);
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
              }
            }
          }
        }
      }

      // 4. Multi-pixel boundary Color-to-Alpha white unmixing (eliminates 100% of white anti-aliasing fringe on 4K outlines & glowing auras)
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

          // Any boundary pixel within maxHaloSteps that still contains white component (minC > 45)
          // is unmixed against pure white (255,255,255) so min(R',G',B') -> 0 (pure dark outline or pure saturated aura)
          if (minC > 45) {
            distMap[nIdx] = d + 1;
            queue[bTail++] = nIdx;
            const cleanAlpha = Math.max(0, Math.min(1, (250 - minC) / 205));
            if (cleanAlpha <= 0.03) {
              data[p + 3] = 0;
            } else {
              const unmixDiv = Math.max(0.05, (255 - minC) / 255);
              data[p] = Math.max(
                0,
                Math.min(255, Math.round((r - minC) / unmixDiv))
              );
              data[p + 1] = Math.max(
                0,
                Math.min(255, Math.round((g - minC) / unmixDiv))
              );
              data[p + 2] = Math.max(
                0,
                Math.min(255, Math.round((b - minC) / unmixDiv))
              );
              data[p + 3] = Math.round(
                data[p + 3] * Math.pow(cleanAlpha, 1.15)
              );
            }
          }
        }
      }

      // 5. Find tight non-transparent bounding box and slice into frameCanvas
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

      const tempCell = document.createElement('canvas');
      tempCell.width = cellW;
      tempCell.height = cellH;
      const tempCtx = tempCell.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(cellImg, 0, 0);
      }

      const frameCanvas = document.createElement('canvas');
      if (hasPixels) {
        const bx = Math.max(0, minX - pad);
        const by = Math.max(0, minY - pad);
        const bw = Math.min(cellW - bx, maxX - minX + 1 + pad * 2);
        const bh = Math.min(cellH - by, maxY - minY + 1 + pad * 2);
        frameCanvas.width = bw;
        frameCanvas.height = bh;
        const fCtx = frameCanvas.getContext('2d');
        if (fCtx) {
          fCtx.drawImage(tempCell, bx, by, bw, bh, 0, 0, bw, bh);
        }
      } else {
        frameCanvas.width = cellW;
        frameCanvas.height = cellH;
        const fCtx = frameCanvas.getContext('2d');
        if (fCtx) {
          fCtx.drawImage(tempCell, 0, 0);
        }
      }

      this.frames[key] = frameCanvas;
      this.sharksGridFrames.push(frameCanvas);
    }
  }

  /**
   * Slices the 6x4 Game UI Icon Atlas (/assets/aistudio/icons_f5128c12.png) using
   * Flood-Fill Alpha Matting from the cell perimeter (plus hollow center seed for
   * UI_AVATAR_FRAME and UI_JOYSTICK_BASE) so internal specular highlights and white teeth
   * remain 100% opaque while the outer background & hollow rings become cleanly transparent.
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

      // Seed hollow center for ring icons (UI_AVATAR_FRAME and UI_JOYSTICK_BASE)
      if (key === 'UI_AVATAR_FRAME' || key === 'UI_JOYSTICK_BASE') {
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

      // Anti-alias feathering on 1px boundary next to flood-filled background
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
            const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
            if (lum > 205) {
              data[p + 3] = Math.round(
                data[p + 3] * Math.max(0.15, (240 - lum) / 35)
              );
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

      // Normalize into a crisp 128x128 square offscreen canvas preserving aspect ratio
      const outSize = 128;
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = outSize;
      frameCanvas.height = outSize;
      const fCtx = frameCanvas.getContext('2d');

      if (fCtx && hasPixels) {
        const bw = Math.max(1, maxX - minX + 1);
        const bh = Math.max(1, maxY - minY + 1);
        const targetSpan = outSize - 6; // 3px clean breathing margin on each side
        const scale = Math.min(targetSpan / bw, targetSpan / bh);
        const dw = bw * scale;
        const dh = bh * scale;
        const dx = (outSize - dw) / 2;
        const dy = (outSize - dh) / 2;
        fCtx.drawImage(tempCell, minX, minY, bw, bh, dx, dy, dw, dh);
      } else if (fCtx) {
        fCtx.drawImage(tempCell, 0, 0, cellW, cellH, 0, 0, outSize, outSize);
      }

      this.frames[key] = frameCanvas;
      this.uiIconsGridFrames.push(frameCanvas);
    }
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

      this.frames[key] = frameCanvas;
      this.uiBannersGridFrames.push(frameCanvas);
    }
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
            frameCanvas = widened;
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
  }

  public getFrame(key: SpriteFrameKey): HTMLCanvasElement | undefined {
    return this.frames[key];
  }

  public getUiIconFrame(key: UiIconKey): HTMLCanvasElement | undefined {
    return this.frames[key];
  }

  public getUiIconDataUrl(key: UiIconKey): string | undefined {
    const cached = this.uiIconDataUrls[key];
    if (cached) return cached;
    const frameCanvas = this.frames[key];
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
    if (typeof keyOrIndex === 'number') {
      const clamped = Math.max(0, Math.min(47, Math.floor(keyOrIndex)));
      const key = `SHARK_FORM_${String(clamped).padStart(2, '0')}` as SharkSpriteKey;
      return this.frames[key] ?? this.frames.BASE_SHARK;
    }
    return this.frames[keyOrIndex] ?? this.frames.BASE_SHARK;
  }

  public getOrganFrame(organId: string): HTMLCanvasElement | undefined {
    switch (organId) {
      case 'mecha_jaws':
        return this.frames.MECHA_JAWS;
      case 'abyss_jaws':
        return this.frames.ABYSS_JAWS;
      case 'magma_jaws':
        return this.frames.MAGMA_JAWS;
      case 'mecha_dorsal':
      case 'mecha_armor':
        return this.frames.MECHA_DORSAL;
      case 'abyss_dorsal':
      case 'abyss_armor':
        return this.frames.ABYSS_DORSAL;
      case 'magma_dorsal':
      case 'magma_armor':
        return this.frames.MAGMA_DORSAL;
      case 'mecha_tail':
      case 'abyss_tail':
      case 'magma_tail':
        return this.frames.EVO_TAIL;
      case 'mecha_aura':
      case 'abyss_aura':
        return this.frames.DEVOUR_FX;
      default:
        return this.frames.MECHA_DORSAL;
    }
  }

  public getPreySprite(config: {
    tier: number;
    spriteKey?: SpriteFrameKey;
  }): HTMLCanvasElement | undefined {
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
