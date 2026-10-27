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

export type SpriteFrameKey =
  | PrimarySpriteFrameKey
  | Fish2SpriteKey
  | SharkSpriteKey;

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
 * in /assets/aistudio/sharks_ec921c3b.png (1376x768)
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
  public rawGridFrames: HTMLCanvasElement[] = [];
  public fish2GridFrames: HTMLCanvasElement[] = [];
  public sharksGridFrames: HTMLCanvasElement[] = [];
  public loaded: boolean = false;
  public fish2Loaded: boolean = false;
  public sharksLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Loads:
   * 1. Primary 4x4 sprite sheet (/assets/aistudio/fish_24bdaa5a.png)
   * 2. Extended 6x5 target fish sprite sheet (/assets/aistudio/fish2_fc857cfa.png)
   * 3. 48-Shark Evolution Matrix 8x6 sprite sheet (/assets/aistudio/sharks_ec921c3b.png)
   */
  public load(
    primaryUrl: string = '/assets/aistudio/fish_24bdaa5a.png',
    fish2Url: string = '/assets/aistudio/fish2_fc857cfa.png',
    sharksUrl: string = '/assets/aistudio/sharks_ec921c3b.png'
  ): Promise<void> {
    if (this.loaded && this.fish2Loaded && this.sharksLoaded) {
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
        resolve();
      };
      img.onerror = () => {
        if (primaryUrl !== '/spritesheet.png') {
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          fallbackImg.onload = () => {
            this.processAndSlicePrimaryImage(fallbackImg);
            this.loaded = true;
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
        resolve();
      };
      imgSharks.onerror = () => resolve();
      imgSharks.src = sharksUrl;
    });

    this.loadingPromise = Promise.all([loadPrimary, loadFish2, loadSharks]).then(
      () => undefined
    );
    return this.loadingPromise;
  }

  private createChromaKeyCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
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
    return sheetCanvas;
  }

  private sliceBoundedFrame(
    sheetCanvas: HTMLCanvasElement,
    sheetCtx: CanvasRenderingContext2D,
    bounds: [number, number, number, number]
  ): HTMLCanvasElement {
    const fullW = sheetCanvas.width;
    const fullH = sheetCanvas.height;
    const [nx0, ny0, nx1, ny1] = bounds;
    const sx = Math.floor(nx0 * fullW);
    const sy = Math.floor(ny0 * fullH);
    const cellW = Math.max(1, Math.floor((nx1 - nx0) * fullW));
    const cellH = Math.max(1, Math.floor((ny1 - ny0) * fullH));

    const cellData = sheetCtx.getImageData(sx, sy, cellW, cellH);
    let minX = cellW;
    let minY = cellH;
    let maxX = 0;
    let maxY = 0;
    let hasPixels = false;

    for (let py = 0; py < cellH; py++) {
      for (let px = 0; px < cellW; px++) {
        const alpha = cellData.data[(py * cellW + px) * 4 + 3];
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
    const sheetCanvas = this.createChromaKeyCanvas(img);
    if (!sheetCanvas) return;
    const sheetCtx = sheetCanvas.getContext('2d', { willReadFrequently: true });
    if (!sheetCtx) return;

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
        sheetCtx,
        SPRITE_CELL_BOUNDS[key]
      );
      this.frames[key] = frameCanvas;
      this.rawGridFrames.push(frameCanvas);
    }
  }

  private processAndSliceFish2Image(img: HTMLImageElement): void {
    const sheetCanvas = this.createChromaKeyCanvas(img);
    if (!sheetCanvas) return;
    const sheetCtx = sheetCanvas.getContext('2d', { willReadFrequently: true });
    if (!sheetCtx) return;

    this.fish2GridFrames = [];
    const orderedFish2Keys = Object.keys(FISH2_GRID_MAP) as Fish2SpriteKey[];

    for (const key of orderedFish2Keys) {
      const frameCanvas = this.sliceBoundedFrame(
        sheetCanvas,
        sheetCtx,
        FISH2_CELL_BOUNDS[key]
      );
      this.frames[key] = frameCanvas;
      this.fish2GridFrames.push(frameCanvas);
    }
  }

  private processAndSliceSharksImage(img: HTMLImageElement): void {
    const sheetCanvas = this.createChromaKeyCanvas(img);
    if (!sheetCanvas) return;
    const sheetCtx = sheetCanvas.getContext('2d', { willReadFrequently: true });
    if (!sheetCtx) return;

    this.sharksGridFrames = [];
    const orderedSharkKeys = Object.keys(SHARK_GRID_MAP) as SharkSpriteKey[];

    for (const key of orderedSharkKeys) {
      const frameCanvas = this.sliceBoundedFrame(
        sheetCanvas,
        sheetCtx,
        SHARK_CELL_BOUNDS[key]
      );
      this.frames[key] = frameCanvas;
      this.sharksGridFrames.push(frameCanvas);
    }
  }

  public getFrame(key: SpriteFrameKey): HTMLCanvasElement | undefined {
    return this.frames[key];
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
