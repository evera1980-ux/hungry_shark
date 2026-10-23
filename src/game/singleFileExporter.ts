import { I18N } from './i18n';
import { GAME_CONFIG } from './config';

/**
 * Generates and downloads a standalone single-file HTML5 version of Hungry Shark: Infinite Evolution
 * powered by SpriteSheetManager (4x4 grid slicing & white-background chroma-key removal)
 * and ParallaxBackground (3-tier ocean_bg.png horizontal modulo tiling + depth cross-fade + God rays + bubbles).
 */
export function downloadStandaloneSingleFileHtml(): void {
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>Hungry Shark: Infinite Evolution | 饥饿鲨：无限进化</title>
<style>
  * { box-sizing: border-box; user-select: none; -webkit-user-select: none; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #020617; font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #f8fafc; touch-action: none; }
  canvas { display: block; width: 100vw; height: 100vh; }
  .hud { position: fixed; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 14px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
  .panel { background: rgba(2,6,23,0.86); border: 1px solid rgba(56,189,248,0.35); border-radius: 12px; padding: 10px 14px; pointer-events: auto; }
  .btn { pointer-events: auto; cursor: pointer; border: none; border-radius: 10px; padding: 10px 16px; font-weight: 800; font-size: 13px; transition: transform 0.1s; }
  .btn:active { transform: scale(0.95); }
  .btn-green { background: #34d399; color: #020617; }
  .btn-gold { background: #fbbf24; color: #020617; }
  .btn-dark { background: rgba(15,23,42,0.9); color: #e2e8f0; border: 1px solid #475569; }
  .bar-bg { width: 200px; height: 10px; background: #0f172a; border-radius: 99px; overflow: hidden; margin: 4px 0 8px; border: 1px solid #334155; }
  .bar-fill { height: 100%; transform-origin: left; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="hud">
  <div class="row">
    <div class="panel">
      <div id="lbl-hp" style="font-size:12px;color:#6ee7b7;font-weight:700;">HP: 100/100</div>
      <div class="bar-bg"><div id="hp-fill" class="bar-fill" style="background:#34d399;width:100%;"></div></div>
      <div id="lbl-en" style="font-size:12px;color:#7dd3fc;font-weight:700;">Energy: 100%</div>
      <div class="bar-bg"><div id="en-fill" class="bar-fill" style="background:#38bdf8;width:100%;"></div></div>
      <div id="lbl-lv" style="font-size:12px;color:#d8b4fe;font-weight:700;">Lv.1 · Bite T2</div>
    </div>
    <div class="row">
      <div class="panel" id="lbl-score" style="font-size:18px;font-weight:900;">Score: 0 | 🧬 0 | 🪙 0</div>
      <button class="btn btn-gold" id="btn-trial">🎬 Max Mecha</button>
      <button class="btn btn-dark" id="btn-lang">🌐 中 / EN</button>
    </div>
  </div>
  <div class="row" style="align-items:flex-end;">
    <div style="font-size:12px;color:#94a3b8;" id="lbl-hint">Move Mouse/Touch or WASD to Steer · Space/Click to Boost</div>
    <button class="btn btn-green" id="btn-boost" style="width:88px;height:88px;border-radius:50%;font-size:15px;">🚀 Boost</button>
  </div>
</div>
<script>
const I18N = ${JSON.stringify(I18N)};
const GAME_CONFIG = ${JSON.stringify(GAME_CONFIG)};
let lang = (navigator.language || 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh';
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.zh[k] || k;

class SpriteSheetManager {
  constructor() { this.frames = []; this.loaded = false; }
  load(url = '/assets/aistudio/fish_24bdaa5a.png') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const sc = document.createElement('canvas'); sc.width = w; sc.height = h;
      const sctx = sc.getContext('2d'); sctx.drawImage(img, 0, 0);
      const id = sctx.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 240 && d[i+1] > 240 && d[i+2] > 240) d[i+3] = 0;
      }
      sctx.putImageData(id, 0, 0);
      const cw = Math.floor(w / 4), ch = Math.floor(h / 4);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const fc = document.createElement('canvas'); fc.width = cw; fc.height = ch;
          fc.getContext('2d').drawImage(sc, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
          this.frames.push(fc);
        }
      }
      this.loaded = true;
    };
    img.onerror = () => { if (url !== 'spritesheet.png') this.load('spritesheet.png'); };
    img.src = url;
  }
}

class ParallaxBackground {
  constructor() {
    this.layers = [];
    this.bubbles = Array.from({length: 30}, () => ({
      x: Math.random() * 1920, y: Math.random() * 1080,
      r: 2 + Math.random() * 5, spd: 20 + Math.random() * 30, phase: Math.random() * 6.28
    }));
  }
  load(url = 'ocean_bg.png') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth, lh = Math.floor(img.naturalHeight / 3);
      this.layers = [0, 1, 2].map(r => {
        const c = document.createElement('canvas'); c.width = w; c.height = lh;
        c.getContext('2d').drawImage(img, 0, r * lh, w, lh, 0, 0, w, lh);
        return c;
      });
    };
    img.src = url;
  }
  drawLayer(ctx, layer, camX, vw, vh, alpha) {
    if (!layer || alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha = alpha;
    const tw = Math.max(vw, Math.round(vh * (layer.width / layer.height)));
    const px = camX * 0.4;
    const sx = -(((px % tw) + tw) % tw);
    for (let x = sx; x < vw; x += tw) ctx.drawImage(layer, x, 0, tw + 1, vh);
    ctx.restore();
  }
  render(ctx, camX, sharkY, vw, vh) {
    if (this.layers.length === 3) {
      if (sharkY < 550) this.drawLayer(ctx, this.layers[0], camX, vw, vh, 1);
      else if (sharkY < 850) {
        this.drawLayer(ctx, this.layers[0], camX, vw, vh, 1);
        this.drawLayer(ctx, this.layers[1], camX, vw, vh, (sharkY - 550) / 300);
      } else if (sharkY < 1150) this.drawLayer(ctx, this.layers[1], camX, vw, vh, 1);
      else if (sharkY < 1450) {
        this.drawLayer(ctx, this.layers[1], camX, vw, vh, 1);
        this.drawLayer(ctx, this.layers[2], camX, vw, vh, (sharkY - 1150) / 300);
      } else this.drawLayer(ctx, this.layers[2], camX, vw, vh, 1);
    } else {
      ctx.fillStyle = sharkY < 550 ? '#0284c7' : sharkY < 1150 ? '#0f172a' : '#020617';
      ctx.fillRect(0, 0, vw, vh);
    }
    ctx.save();
    for (const b of this.bubbles) {
      b.y -= b.spd * 0.016; b.phase += 0.04;
      if (b.y < -10) b.y = vh + 10;
      const bx = ((b.x - camX * 0.5 + Math.sin(b.phase) * 8) % vw + vw) % vw;
      ctx.strokeStyle = 'rgba(186,230,253,0.4)';
      ctx.beginPath(); ctx.arc(bx, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

const sprites = new SpriteSheetManager(); sprites.load();
const parallaxBg = new ParallaxBackground(); parallaxBg.load();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
addEventListener('resize', resize); resize();

let shark = { x: 1200, y: 260, vx: 180, vy: 0, angle: 0, phase: 0, hp: 100, energy: 100, lv: 1, bite: 2, score: 0, genes: 0, coins: 0, boost: false, mecha: false };
let preys = Array.from({length: 45}, (_, i) => {
  const cfg = GAME_CONFIG.preyTiers[i % GAME_CONFIG.preyTiers.length];
  return { cfg, x: Math.random() * 3600 + 200, y: cfg.minDepth + Math.random() * (cfg.maxDepth - cfg.minDepth), vx: (Math.random() < 0.5 ? -1 : 1) * cfg.baseSpeed, phase: i };
});

document.getElementById('btn-lang').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; };
document.getElementById('btn-trial').onclick = () => { shark.bite = 8; shark.lv = 5; shark.hp = 100; shark.mecha = true; };
const boostBtn = document.getElementById('btn-boost');
boostBtn.onpointerdown = () => shark.boost = true;
boostBtn.onpointerup = () => shark.boost = false;
addEventListener('pointermove', (e) => {
  if (e.buttons > 0 || e.pointerType === 'mouse') {
    shark.angle = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2);
  }
});
addEventListener('keydown', (e) => { if (e.code === 'Space') shark.boost = true; });
addEventListener('keyup', (e) => { if (e.code === 'Space') shark.boost = false; });

const PREY_FRAME_IDX = { 1: 8, 2: 11, 3: 9, 4: 10, 5: 12, 6: 13, 7: 11, 8: 14 };

function loop() {
  shark.phase += 0.14;
  const spd = shark.boost && shark.energy > 0 ? 460 : 240;
  if (shark.boost && shark.energy > 0) shark.energy = Math.max(0, shark.energy - 0.4);
  else shark.energy = Math.min(100, shark.energy + 0.25);
  shark.x = Math.max(80, Math.min(4100, shark.x + Math.cos(shark.angle) * spd * 0.016));
  shark.y = Math.max(60, Math.min(1740, shark.y + Math.sin(shark.angle) * spd * 0.016));

  parallaxBg.render(ctx, shark.x, shark.y, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - shark.x, canvas.height / 2 - shark.y);

  for (const p of preys) {
    p.phase += 0.08; p.x += p.vx * 0.016;
    if (p.x < 80 || p.x > 4100) p.vx *= -1;
    if (Math.hypot(shark.x - p.x, shark.y - p.y) < 42 + p.cfg.radius) {
      if (shark.bite >= p.cfg.tier) {
        shark.score += p.cfg.scoreValue; shark.genes += p.cfg.geneValue; shark.coins += p.cfg.coinValue;
        shark.hp = Math.min(100, shark.hp + 8);
        p.x = Math.random() * 3600 + 200;
      } else {
        shark.hp = Math.max(10, shark.hp - 8);
      }
    }
    const pf = sprites.frames[PREY_FRAME_IDX[p.cfg.tier] || 8];
    if (pf) {
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.vx < 0) ctx.scale(-1, 1);
      ctx.rotate(Math.sin(p.phase) * 0.08);
      const sz = p.cfg.radius * 2.4;
      ctx.drawImage(pf, -sz/2, -sz/2, sz, sz);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(shark.x, shark.y); ctx.rotate(shark.angle);
  if (Math.cos(shark.angle) < 0) ctx.scale(1, -1);
  ctx.rotate(Math.sin(shark.phase) * 0.06);
  if (sprites.frames[0]) {
    if (shark.mecha && sprites.frames[7]) ctx.drawImage(sprites.frames[7], -74, -22 + Math.sin(shark.phase)*5, 56, 44);
    if (shark.mecha && sprites.frames[4]) ctx.drawImage(sprites.frames[4], -32, -46, 54, 42);
    ctx.drawImage(sprites.frames[0], -60, -36, 120, 72);
    if (shark.mecha && sprites.frames[1]) ctx.drawImage(sprites.frames[1], 10, -18, 56, 42);
  }
  ctx.restore();
  ctx.restore();

  document.getElementById('lbl-hp').textContent = t('hud_hp') + ': ' + Math.round(shark.hp) + '/100';
  document.getElementById('hp-fill').style.width = shark.hp + '%';
  document.getElementById('lbl-en').textContent = t('hud_energy') + ': ' + Math.round(shark.energy) + '%';
  document.getElementById('en-fill').style.width = shark.energy + '%';
  document.getElementById('lbl-lv').textContent = t('hud_level') + ' Lv.' + shark.lv + ' · T' + shark.bite;
  document.getElementById('lbl-score').textContent = t('hud_score') + ': ' + shark.score + ' | 🧬 ' + shark.genes + ' | 🪙 ' + shark.coins;
  document.getElementById('lbl-hint').textContent = t('control_hint');
  document.getElementById('btn-boost').textContent = '🚀 ' + t('btn_boost');
  document.getElementById('btn-trial').textContent = t('btn_trial_mecha');
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hungry-shark-infinite-evolution.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
