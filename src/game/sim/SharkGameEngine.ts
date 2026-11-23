import { SimEngineHost } from './types';
import { stepSharkSimulation } from './stepSimulation';
import { renderOceanWorld } from './renderOceanWorld';

interface CachedDisplayMetrics {
  dpr: number;
  viewW: number;
  viewH: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Decoupled 60 FPS Canvas 2D Simulation & Render Engine.
 * Owns requestAnimationFrame scheduling, DPR display-box synchronization,
 * fixed-cap delta time stepping, and delegates per-frame logic to pure TS
 * `stepSharkSimulation` and `renderOceanWorld` modules.
 */
export class SharkGameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly host: SimEngineHost;

  private animId: number = 0;
  private lastTime: number = 0;
  private running: boolean = false;
  private cachedDisplay: CachedDisplayMetrics = {
    dpr: 1,
    viewW: 1280,
    viewH: 720,
    scaleX: 1,
    scaleY: 1,
  };

  constructor(canvas: HTMLCanvasElement, host: SimEngineHost) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('[SharkGameEngine] Failed to acquire 2D canvas context');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.host = host;
  }

  public readonly syncCanvasBufferToDisplayBox = (): CachedDisplayMetrics => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(
      1,
      Math.round(rect.width || window.visualViewport?.width || window.innerWidth)
    );
    const cssH = Math.max(
      1,
      Math.round(rect.height || window.visualViewport?.height || window.innerHeight)
    );
    const targetW = Math.floor(cssW * dpr);
    const targetH = Math.floor(cssH * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    this.cachedDisplay = {
      dpr,
      viewW: cssW,
      viewH: cssH,
      scaleX: this.canvas.width / cssW,
      scaleY: this.canvas.height / cssH,
    };
    return this.cachedDisplay;
  };

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(0, rawDt), 0.05);

    const { viewW, viewH, scaleX, scaleY } = this.cachedDisplay;
    const aspectZoomFactor =
      viewW < viewH ? Math.max(0.74, Math.min(1, viewW / 580)) : 1;

    const isPausedOrOverlay =
      this.host.gameStateRef.current === 'paused' ||
      this.host.gameStateRef.current === 'gameover' ||
      Boolean(this.host.showAtlasModalRef.current) ||
      Boolean(this.host.simAdRef.current?.active);

    stepSharkSimulation({
      host: this.host,
      dt,
      now,
      viewW,
      viewH,
      aspectZoomFactor,
      isPausedOrOverlay,
    });

    renderOceanWorld({
      ctx: this.ctx,
      sim: this.host.simRef.current,
      dt,
      now,
      viewW,
      viewH,
      scaleX,
      scaleY,
      aspectZoomFactor,
      lang: this.host.langRef.current,
      gameState: this.host.gameStateRef.current,
    });

    this.animId = requestAnimationFrame(this.tick);
  };

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.syncCanvasBufferToDisplayBox();
    window.addEventListener('resize', this.syncCanvasBufferToDisplayBox);
    window.addEventListener('orientationchange', this.syncCanvasBufferToDisplayBox);
    window.visualViewport?.addEventListener('resize', this.syncCanvasBufferToDisplayBox);

    this.lastTime = performance.now();
    this.animId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.syncCanvasBufferToDisplayBox);
    window.removeEventListener('orientationchange', this.syncCanvasBufferToDisplayBox);
    window.visualViewport?.removeEventListener('resize', this.syncCanvasBufferToDisplayBox);
  }
}
