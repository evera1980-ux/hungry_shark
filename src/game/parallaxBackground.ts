export interface AmbientBubble {
  x: number;
  y: number;
  r: number;
  speedY: number;
  wobblePhase: number;
  alpha: number;
}

/**
 * Synthesizes a high-detail, horizontally tileable 3-row ocean_bg sheet (1920 x 1080, 3 rows of 1920 x 360)
 * matching the 3 ecological zones:
 * - Row 0: Sunlit Shallow Coral Reef (Turquoise water, sunbeams, colorful corals, anemones, sandy floor)
 * - Row 1: Twilight Sunken Ruins (Deep blue water, ancient Greek temple columns, sunken yellow submarine, glowing cyan crystals)
 * - Row 2: Abyssal Volcanic Trench (Obsidian-purple void, smoking black volcanic vents, glowing molten orange lava cracks)
 */
export function createFallbackOceanSheetCanvas(): HTMLCanvasElement {
  const w = 1920;
  const rowH = 360;
  const h = rowH * 3;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // ==================== ROW 0: SHALLOW CORAL REEF (y: 0..360) ====================
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, rowH);
  ctx.clip();

  const g0 = ctx.createLinearGradient(0, 0, 0, rowH);
  g0.addColorStop(0, '#38bdf8');
  g0.addColorStop(0.35, '#06b6d4');
  g0.addColorStop(0.82, '#0284c7');
  g0.addColorStop(1, '#0369a1');
  ctx.fillStyle = g0;
  ctx.fillRect(0, 0, w, rowH);

  // Radial Golden-Cyan Sunbeams from center-top
  for (let i = -6; i <= 6; i++) {
    const beamGrad = ctx.createLinearGradient(w / 2, 0, w / 2 + i * 160, rowH);
    beamGrad.addColorStop(0, 'rgba(254, 249, 195, 0.42)');
    beamGrad.addColorStop(0.6, 'rgba(165, 243, 252, 0.14)');
    beamGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 40, -10);
    ctx.lineTo(w / 2 + 40, -10);
    ctx.lineTo(w / 2 + i * 190 + 95, rowH);
    ctx.lineTo(w / 2 + i * 190 - 95, rowH);
    ctx.closePath();
    ctx.fill();
  }

  // Distant silhouettes of coral ridges (seamless sin waves)
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.moveTo(0, rowH);
  for (let x = 0; x <= w; x += 20) {
    const t = (x / w) * Math.PI * 2;
    const y = 250 + Math.sin(t * 3) * 26 + Math.cos(t * 7) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, rowH);
  ctx.closePath();
  ctx.fill();

  // Foreground colorful coral reef & golden sandbanks (seamless at x=0 and x=w)
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.moveTo(0, rowH);
  for (let x = 0; x <= w; x += 20) {
    const t = (x / w) * Math.PI * 2;
    const y = 312 + Math.sin(t * 2) * 16 + Math.cos(t * 5) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, rowH);
  ctx.closePath();
  ctx.fill();

  // Colorful Coral Reefs, Branching Staghorn Corals & Swaying Kelp
  const coralColors = ['#f43f5e', '#ec4899', '#eab308', '#f97316', '#10b981', '#8b5cf6'];
  for (let c = 0; c < 32; c++) {
    const cx = (c / 32) * w;
    const baseY = 324 + Math.sin((cx / w) * Math.PI * 4) * 8;
    const color = coralColors[c % coralColors.length];

    for (const shift of [0, -w, w]) {
      const dx = cx + shift;
      if (dx < -80 || dx > w + 80) continue;

      if (c % 3 === 0) {
        // Swaying green kelp blades
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(dx + k * 9, baseY + 10);
          ctx.quadraticCurveTo(dx + k * 14 - 8, baseY - 22, dx + k * 10 + 6, baseY - 48);
          ctx.stroke();
        }
      } else {
        // Branching coral cluster
        ctx.fillStyle = color;
        for (let b = -2; b <= 2; b++) {
          ctx.beginPath();
          ctx.ellipse(
            dx + b * 8,
            baseY - 12 - (2 - Math.abs(b)) * 4,
            5.5,
            16,
            b * 0.25,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();

  // ==================== ROW 1: TWILIGHT SUNKEN RUINS (y: 360..720) ====================
  ctx.save();
  ctx.translate(0, rowH);
  ctx.beginPath();
  ctx.rect(0, 0, w, rowH);
  ctx.clip();

  const g1 = ctx.createLinearGradient(0, 0, 0, rowH);
  g1.addColorStop(0, '#1e3a8a');
  g1.addColorStop(0.5, '#0f172a');
  g1.addColorStop(1, '#090d16');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, rowH);

  // Soft Twilight Cyan-Blue Light Shafts
  for (let i = -4; i <= 4; i++) {
    const shaft = ctx.createLinearGradient(w * 0.48, 0, w * 0.48 + i * 180, rowH);
    shaft.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
    shaft.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(w * 0.48 - 60, 0);
    ctx.lineTo(w * 0.48 + 60, 0);
    ctx.lineTo(w * 0.48 + i * 200 + 110, rowH);
    ctx.lineTo(w * 0.48 + i * 200 - 110, rowH);
    ctx.closePath();
    ctx.fill();
  }

  // Sunken Ancient Temple Columns (left-center)
  ctx.save();
  ctx.translate(620, 255);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-140, -130, 280, 24); // Architrave beam
  for (let col = -2; col <= 2; col++) {
    ctx.fillRect(col * 55 - 12, -106, 24, 120);
  }
  ctx.restore();

  // Sunken Submarine Wreck Silhouette (right-center)
  ctx.save();
  ctx.translate(1380, 250);
  ctx.rotate(-0.22);
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 145, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-35, -78, 55, 38); // Conning tower
  // Portholes
  ctx.fillStyle = '#0ea5e9';
  for (const px of [-55, 0, 55]) {
    ctx.beginPath();
    ctx.arc(px, -4, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Rocky Twilight Seabed (seamless)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, rowH);
  for (let x = 0; x <= w; x += 20) {
    const t = (x / w) * Math.PI * 2;
    const y = 296 + Math.sin(t * 3) * 18 + Math.cos(t * 6) * 12;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, rowH);
  ctx.closePath();
  ctx.fill();

  // Glowing Cyan Bioluminescent Crystals & Kelp
  for (let k = 0; k < 16; k++) {
    const kx = (k / 16) * w + 40;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(kx, 305);
    ctx.lineTo(kx - 14, 340);
    ctx.lineTo(kx + 14, 340);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ==================== ROW 2: ABYSSAL VOLCANIC TRENCH (y: 720..1080) ====================
  ctx.save();
  ctx.translate(0, rowH * 2);
  ctx.beginPath();
  ctx.rect(0, 0, w, rowH);
  ctx.clip();

  const g2 = ctx.createLinearGradient(0, 0, 0, rowH);
  g2.addColorStop(0, '#1e1b4b');
  g2.addColorStop(0.55, '#090514');
  g2.addColorStop(1, '#270905');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, rowH);

  // Volcanic Hydrothermal Cones & Glowing Magma Veins
  const volcanoX = [260, 640, 1080, 1680];
  for (const vx of volcanoX) {
    // Volcano cone
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(vx - 140, 320);
    ctx.lineTo(vx - 28, 125);
    ctx.lineTo(vx + 28, 125);
    ctx.lineTo(vx + 140, 320);
    ctx.closePath();
    ctx.fill();

    // Glowing crater & lava streams
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(vx, 128);
    ctx.quadraticCurveTo(vx - 20, 220, vx - 65, 320);
    ctx.moveTo(vx + 8, 130);
    ctx.quadraticCurveTo(vx + 30, 230, vx + 75, 320);
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(vx, 125, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Basalt Trench Floor + Molten Lava Rivers (seamless)
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.moveTo(0, rowH);
  for (let x = 0; x <= w; x += 20) {
    const t = (x / w) * Math.PI * 2;
    const y = 312 + Math.sin(t * 4) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, rowH);
  ctx.closePath();
  ctx.fill();

  // Lava Pools on Floor
  for (let p = 0; p < 8; p++) {
    const px = (p / 8) * w + 90;
    const gradLava = ctx.createRadialGradient(px, 342, 4, px, 342, 75);
    gradLava.addColorStop(0, '#fde047');
    gradLava.addColorStop(0.5, '#f97316');
    gradLava.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = gradLava;
    ctx.beginPath();
    ctx.ellipse(px, 342, 75, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return canvas;
}

export class ParallaxBackground {
  public layers: HTMLCanvasElement[] = [];
  public loaded: boolean = false;
  private bubbles: AmbientBubble[] = [];

  constructor() {
    // Initialize 36 ambient rising underwater bubbles
    for (let i = 0; i < 36; i++) {
      this.bubbles.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        r: 2 + Math.random() * 5.5,
        speedY: 18 + Math.random() * 32,
        wobblePhase: Math.random() * Math.PI * 2,
        alpha: 0.16 + Math.random() * 0.32,
      });
    }
  }

  /**
   * Loads ocean_bg.png (/assets/aistudio/ocean_bg_a7a0ef52.png) and slices it into 3 horizontal ecological strips:
   * - row 0: Shallow Coral Reef (height = img.height / 3)
   * - row 1: Twilight Sunken Ruins (height = img.height / 3)
   * - row 2: Abyssal Magma Trench (height = img.height / 3)
   */
  public load(url: string = '/assets/aistudio/ocean_bg_a7a0ef52.png'): void {
    if (typeof document === 'undefined') return;

    // Immediately slice fallback 3-tier sheet so frame 0 is ready before image decode completes
    if (this.layers.length === 0) {
      const sheet = createFallbackOceanSheetCanvas();
      this.sliceSheetIntoThreeLayers(sheet);
      this.loaded = true;
    }

    if (typeof Image !== 'undefined') {
      const candidates = [
        url,
        '/assets/aistudio/ocean_bg_a7a0ef52.png',
        '/ocean_bg.png',
        'ocean_bg.png',
      ];
      let idx = 0;
      const tryNext = () => {
        if (idx >= candidates.length) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            this.sliceSheetIntoThreeLayers(img);
            this.loaded = true;
          }
        };
        img.onerror = () => {
          idx++;
          tryNext();
        };
        img.src = candidates[idx];
      };
      tryNext();
    }
  }

  private sliceSheetIntoThreeLayers(
    source: HTMLImageElement | HTMLCanvasElement
  ): void {
    const rawW =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const rawH =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const layerH = Math.floor(rawH / 3);

    // Trim 12px from left/right edges to remove any source image border artifacts,
    // and build a 2x ping-pong mirror-tiled strip [A | flipH(A)] so horizontal wrapping has zero seam
    const trimX = rawW > 200 ? 12 : 0;
    const cropW = Math.max(1, rawW - trimX * 2);

    const sliced: HTMLCanvasElement[] = [];
    for (let row = 0; row < 3; row++) {
      const c = document.createElement('canvas');
      c.width = cropW * 2;
      c.height = layerH;
      const cCtx = c.getContext('2d');
      if (cCtx) {
        // Left half: normal strip
        cCtx.drawImage(
          source,
          trimX,
          row * layerH,
          cropW,
          layerH,
          0,
          0,
          cropW,
          layerH
        );
        // Right half: horizontally mirrored strip so both joins (x=cropW and x=2*cropW) match pixel-for-pixel
        cCtx.save();
        cCtx.translate(cropW * 2, 0);
        cCtx.scale(-1, 1);
        cCtx.drawImage(
          source,
          trimX,
          row * layerH,
          cropW,
          layerH,
          0,
          0,
          cropW,
          layerH
        );
        cCtx.restore();
      }
      sliced.push(c);
    }
    this.layers = sliced;
  }

  /**
   * Draw a single horizontal strip seamlessly tiled across the viewport width
   * using camera.x * 0.4 parallax and modulo (%) wrapping.
   */
  private drawTiledLayer(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement,
    cameraX: number,
    viewW: number,
    viewH: number,
    alpha: number
  ): void {
    if (alpha <= 0.001 || !layer) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Scale strip height to fill viewport height, preserving aspect ratio for width
    const aspect = layer.width / layer.height;
    const tileW = Math.max(viewW, Math.round(viewH * aspect));

    // Parallax factor 0.4 + modulo (%) seamless horizontal tiling
    const parallaxX = cameraX * 0.4;
    const startX = -(((parallaxX % tileW) + tileW) % tileW);

    // Loop and draw connected slices horizontally across the screen
    for (let x = startX; x < viewW; x += tileW) {
      ctx.drawImage(layer, Math.floor(x), 0, tileW + 1, viewH);
    }

    ctx.restore();
  }

  /**
   * Renders the 3-tier parallax background with smooth depth cross-fade (ctx.globalAlpha),
   * plus foreground rising bubbles and refracted top God Rays.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    sharkY: number,
    viewW: number,
    viewH: number,
    nowMs: number,
    dt: number
  ): void {
    if (this.layers.length < 3) {
      this.load();
    }

    const [layer0, layer1, layer2] = this.layers;

    // 1. Depth Cross-Fade Calculation based on shark.y:
    // - 0 ~ 680m: Layer 0 (Shallow Coral Reef, 0 ~ 800m zone)
    // - 680 ~ 920m: Cross-fade Layer 0 -> Layer 1 at the 800m boundary
    // - 920 ~ 1250m: Layer 1 (Twilight Sunken Ruins)
    // - 1250 ~ 1520m: Cross-fade Layer 1 -> Layer 2
    // - > 1520m: Layer 2 (Abyssal Magma Trench)
    if (sharkY < 680) {
      this.drawTiledLayer(ctx, layer0, cameraX, viewW, viewH, 1.0);
    } else if (sharkY < 920) {
      const t = (sharkY - 680) / 240;
      this.drawTiledLayer(ctx, layer0, cameraX, viewW, viewH, 1.0);
      this.drawTiledLayer(ctx, layer1, cameraX, viewW, viewH, t);
    } else if (sharkY < 1250) {
      this.drawTiledLayer(ctx, layer1, cameraX, viewW, viewH, 1.0);
    } else if (sharkY < 1520) {
      const t = (sharkY - 1250) / 270;
      this.drawTiledLayer(ctx, layer1, cameraX, viewW, viewH, 1.0);
      this.drawTiledLayer(ctx, layer2, cameraX, viewW, viewH, t);
    } else {
      this.drawTiledLayer(ctx, layer2, cameraX, viewW, viewH, 1.0);
    }

    // 2. Top Refracted Sunbeams (God Rays) — strongest in shallow/twilight zones
    const rayVisibility = Math.max(0, 1 - sharkY / 1150);
    if (rayVisibility > 0.02) {
      ctx.save();
      ctx.globalAlpha = rayVisibility;
      const tSec = nowMs * 0.0006;
      for (let r = 0; r < 6; r++) {
        const baseX =
          ((r * 320 - cameraX * 0.25) % (viewW + 400) + (viewW + 400)) %
            (viewW + 400) -
          200;
        const sway = Math.sin(tSec + r * 1.1) * 35;
        const grad = ctx.createLinearGradient(
          baseX,
          0,
          baseX + 110 + sway,
          viewH * 0.78
        );
        grad.addColorStop(0, 'rgba(224, 242, 254, 0.22)');
        grad.addColorStop(0.5, 'rgba(125, 211, 252, 0.08)');
        grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(baseX, 0);
        ctx.lineTo(baseX + 85, 0);
        ctx.lineTo(baseX + 210 + sway, viewH * 0.78);
        ctx.lineTo(baseX + 45 + sway, viewH * 0.78);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Foreground Slowly Rising Semi-Transparent Underwater Bubbles
    ctx.save();
    for (const b of this.bubbles) {
      b.y -= b.speedY * dt;
      b.wobblePhase += dt * 2.2;
      if (b.y < -20) {
        b.y = viewH + 20;
        b.x = Math.random() * viewW;
      }
      const screenX =
        ((b.x - cameraX * 0.55 + Math.sin(b.wobblePhase) * 10) % viewW +
          viewW) %
        viewW;

      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = sharkY > 1250 ? '#fdba74' : '#bae6fd';
      ctx.fillStyle =
        sharkY > 1250
          ? 'rgba(251, 146, 60, 0.15)'
          : 'rgba(186, 230, 253, 0.18)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(screenX, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 4. P2-1 Depth-Based Ambient Pressure Vignette & Abyssal Magma Underglow
    if (sharkY > 520) {
      ctx.save();
      const depthPressure = Math.min(1, (sharkY - 520) / 1100);
      const outerR = Math.hypot(viewW, viewH) * 0.58;
      const innerR = Math.min(viewW, viewH) * (0.28 - depthPressure * 0.06);
      const vig = ctx.createRadialGradient(
        viewW * 0.5,
        viewH * 0.5,
        innerR,
        viewW * 0.5,
        viewH * 0.5,
        outerR
      );
      vig.addColorStop(0, 'rgba(2, 6, 23, 0)');
      vig.addColorStop(
        0.72,
        `rgba(4, 12, 34, ${(depthPressure * 0.28).toFixed(3)})`
      );
      vig.addColorStop(
        1,
        `rgba(2, 6, 23, ${(depthPressure * 0.56).toFixed(3)})`
      );
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, viewW, viewH);

      // Pulsing hydrothermal magma underglow when diving into the Abyssal Trench (>1180m)
      if (sharkY > 1180) {
        const magmaFactor = Math.min(1, (sharkY - 1180) / 450);
        const pulse = 0.78 + Math.sin(nowMs * 0.0028) * 0.22;
        const lavaGrad = ctx.createLinearGradient(0, viewH * 0.62, 0, viewH);
        lavaGrad.addColorStop(0, 'rgba(234, 88, 12, 0)');
        lavaGrad.addColorStop(
          0.7,
          `rgba(234, 88, 12, ${(magmaFactor * 0.12 * pulse).toFixed(3)})`
        );
        lavaGrad.addColorStop(
          1,
          `rgba(251, 146, 60, ${(magmaFactor * 0.26 * pulse).toFixed(3)})`
        );
        ctx.fillStyle = lavaGrad;
        ctx.fillRect(0, viewH * 0.62, viewW, viewH * 0.38);
      }
      ctx.restore();
    }
  }
}

export const parallaxBackground = new ParallaxBackground();
