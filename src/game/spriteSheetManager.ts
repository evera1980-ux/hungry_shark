export type SpriteFrameKey =
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

export const SPRITE_GRID_MAP: Record<SpriteFrameKey, [number, number]> = {
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

/**
 * Exact normalized cell bounds [x0, y0, x1, y1] for each of the 16 sprites in the 4x4 sheet
 * so wide sprites (like Row 0 Col 0 Shark, Row 3 Col 0 Eel, Row 3 Col 2 Kraken Boss) are never clipped.
 */
export const SPRITE_CELL_BOUNDS: Record<
  SpriteFrameKey,
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

export class SpriteSheetManager {
  public frames: Partial<Record<SpriteFrameKey, HTMLCanvasElement>> = {};
  public rawGridFrames: HTMLCanvasElement[] = [];
  public loaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Loads the 4x4 sprite sheet, removes pure white background (R>240, G>240, B>240 -> Alpha=0)
   * via offscreen Canvas getImageData, and slices into 16 tight transparent sprite frames.
   */
  public load(url: string = '/assets/aistudio/fish_24bdaa5a.png'): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loadingPromise) return this.loadingPromise;
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve();
    }

    this.loadingPromise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.processAndSliceImage(img);
        this.loaded = true;
        resolve();
      };
      img.onerror = () => {
        if (url !== '/spritesheet.png') {
          this.loadingPromise = null;
          this.load('/spritesheet.png').then(resolve);
        } else {
          resolve();
        }
      };
      img.src = url;
    });

    return this.loadingPromise;
  }

  private processAndSliceImage(img: HTMLImageElement): void {
    const fullW = img.naturalWidth || img.width;
    const fullH = img.naturalHeight || img.height;
    if (!fullW || !fullH) return;

    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = fullW;
    sheetCanvas.height = fullH;
    const sheetCtx = sheetCanvas.getContext('2d', { willReadFrequently: true });
    if (!sheetCtx) return;

    sheetCtx.drawImage(img, 0, 0);
    const imgData = sheetCtx.getImageData(0, 0, fullW, fullH);
    const data = imgData.data;

    // 1. Chroma-Key White Background Removal: R > 240, G > 240, B > 240 -> Alpha = 0
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

    // 2. Slice all 16 sprites using their cell bounds and trim transparent padding
    this.rawGridFrames = [];
    const orderedKeys: SpriteFrameKey[] = [
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
      const [nx0, ny0, nx1, ny1] = SPRITE_CELL_BOUNDS[key];
      const sx = Math.floor(nx0 * fullW);
      const sy = Math.floor(ny0 * fullH);
      const cellW = Math.floor((nx1 - nx0) * fullW);
      const cellH = Math.floor((ny1 - ny0) * fullH);

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

      this.frames[key] = frameCanvas;
      this.rawGridFrames.push(frameCanvas);
    }
  }

  public getFrame(key: SpriteFrameKey): HTMLCanvasElement | undefined {
    return this.frames[key];
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
      case 'magma_aura':
        return this.frames.DEVOUR_FX;
      default:
        return this.frames.MECHA_DORSAL;
    }
  }

  public getPreyFrame(tier: number): HTMLCanvasElement | undefined {
    switch (tier) {
      case 1:
        return this.frames.PREY_JELLY;
      case 2:
        return this.frames.PREY_CRAB;
      case 3:
        return this.frames.PREY_PUFFER;
      case 4:
        return this.frames.PREY_SUB;
      case 5:
        return this.frames.PREY_EEL;
      case 6:
        return this.frames.PREY_MINE;
      case 7:
        return this.frames.PREY_CRAB;
      case 8:
        return this.frames.PREY_KRAKEN;
      default:
        return this.frames.PREY_JELLY;
    }
  }
}

export const spriteSheetManager = new SpriteSheetManager();
