import { I18N } from './i18n';
import { GAME_CONFIG } from './config';
import { SHARK_EVOLUTION_FORMS } from './sharkEvolutionConfig';

/**
 * Generates and downloads a standalone single-file HTML5 version of Hungry Shark: Infinite Evolution
 * featuring the 48-Shark Body Evolution Matrix (6x8 valley-aligned slicing of sharks_ec921c3b.png),
 * depth-stratified marine ecology, relative prey shrink, and cross-run body evolution progression.
 */
export function downloadStandaloneSingleFileHtml(): void {
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>Hungry Shark: 48-Form Evolution | 饥饿鲨：48阶本体进化</title>
<style>
  * { box-sizing: border-box; user-select: none; -webkit-user-select: none; margin: 0; padding: 0; }
  html, body { position: fixed; inset: 0; width: 100%; height: 100%; height: 100dvh; overflow: hidden; overscroll-behavior: none; background: #020617; font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #f8fafc; touch-action: none; }
  canvas { display: block; width: 100%; height: 100%; }
  .hud { position: fixed; inset: 0; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
  .panel { background: rgba(2,6,23,0.84); border: 1px solid rgba(56,189,248,0.35); border-radius: 12px; padding: 8px 12px; pointer-events: auto; backdrop-filter: blur(8px); }
  .btn { pointer-events: auto; cursor: pointer; border: none; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 12px; transition: transform 0.1s; }
  .btn:active { transform: scale(0.95); }
  .btn-green { background: #34d399; color: #020617; }
  .btn-gold { background: linear-gradient(90deg, #f59e0b, #fde047); color: #020617; }
  .btn-cyan { background: rgba(6,182,212,0.22); color: #67e8f9; border: 1px solid rgba(34,211,238,0.45); }
  .btn-dark { background: rgba(15,23,42,0.9); color: #e2e8f0; border: 1px solid #475569; }
  .bar-bg { width: 180px; height: 8px; background: #0f172a; border-radius: 99px; overflow: hidden; margin: 3px 0 6px; border: 1px solid #334155; }
  .bar-fill { height: 100%; transform-origin: left; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="hud">
  <div class="row">
    <div class="panel">
      <div id="lbl-form" style="font-size:12px;color:#fde047;font-weight:900;margin-bottom:3px;">G1 · 幼年礁鲨 (1/48)</div>
      <div id="lbl-hp" style="font-size:11px;color:#6ee7b7;font-weight:700;">HP: 100/100</div>
      <div class="bar-bg"><div id="hp-fill" class="bar-fill" style="background:#34d399;width:100%;"></div></div>
      <div id="lbl-en" style="font-size:11px;color:#7dd3fc;font-weight:700;">Energy: 100%</div>
      <div class="bar-bg"><div id="en-fill" class="bar-fill" style="background:#38bdf8;width:100%;"></div></div>
      <div id="lbl-lv" style="font-size:11px;color:#d8b4fe;font-weight:700;">Lv.1 · Bite T2 · 相对体型 1.00x</div>
    </div>
    <div class="row">
      <div class="panel" id="lbl-score" style="font-size:15px;font-weight:900;">Score: 0 | 🧬 0 | 🪙 0</div>
      <button class="btn btn-gold" id="btn-evolve">⚡ 进化下一形态</button>
      <button class="btn btn-cyan" id="btn-cycle">🦈 切换图鉴形态</button>
      <button class="btn btn-dark" id="btn-lang">🌐 中 / EN</button>
    </div>
  </div>
  <div class="row" style="align-items:flex-end;">
    <div style="font-size:11px;color:#94a3b8;" id="lbl-hint">Move Mouse/Touch or WASD to Steer · Space/Click to Boost</div>
    <button class="btn btn-green" id="btn-boost" style="width:82px;height:82px;border-radius:50%;font-size:14px;">🚀 Boost</button>
  </div>
</div>
<script>
const I18N = ${JSON.stringify(I18N)};
const GAME_CONFIG = ${JSON.stringify(GAME_CONFIG)};
const SHARK_FORMS = ${JSON.stringify(SHARK_EVOLUTION_FORMS)};
let lang = (navigator.language || 'zh').toLowerCase().startsWith('en') ? 'en' : 'zh';
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.zh[k] || k;

const SHARK_COL_SPLITS = [0, 178, 344, 505, 672, 839, 1000, 1170, 1344];
const SHARK_ROW_SPLITS = [0, 131, 250, 382, 513, 639, 768];

class SpriteSheetManager {
  constructor() { this.preyFrames = []; this.sharkFrames = []; }
  cleanAndCrop(srcCanvas, sx, sy, sw, sh) {
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const ctx = c.getContext('2d'); ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const id = ctx.getImageData(0, 0, sw, sh), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      if ((r > 235 && g > 235 && b > 235) || (lum > 224 && sat < 0.08)) d[i+3] = 0;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }
  loadPrey(url = '/assets/aistudio/fish_24bdaa5a.png') {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const sc = document.createElement('canvas'); sc.width = w; sc.height = h;
      sc.getContext('2d').drawImage(img, 0, 0);
      const cw = Math.floor(w / 4), ch = Math.floor(h / 4);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          this.preyFrames.push(this.cleanAndCrop(sc, c * cw, r * ch, cw, ch));
        }
      }
    };
    img.src = url;
  }
  loadSharks(url = '/assets/aistudio/sharks_ec921c3b.png') {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const sc = document.createElement('canvas'); sc.width = w; sc.height = h;
      sc.getContext('2d').drawImage(img, 0, 0);
      const sxScale = w / 1344, syScale = h / 768;
      for (let r = 0; r < 6; r++) {
        const y0 = Math.round(SHARK_ROW_SPLITS[r] * syScale);
        const y1 = Math.round(SHARK_ROW_SPLITS[r + 1] * syScale);
        for (let c = 0; c < 8; c++) {
          const x0 = Math.round(SHARK_COL_SPLITS[c] * sxScale);
          const x1 = Math.round(SHARK_COL_SPLITS[c + 1] * sxScale);
          this.sharkFrames.push(this.cleanAndCrop(sc, x0, y0, x1 - x0, y1 - y0));
        }
      }
    };
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
  load(url = '/assets/aistudio/ocean_bg_a7a0ef52.png') {
    const img = new Image(); img.crossOrigin = 'anonymous';
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
    const aspect = layer.width / layer.height;
    const stripH = vh > vw ? Math.min(vh, Math.max(480, Math.round(vw * 1.15))) : vh;
    const drawY = vh - stripH;
    const tw = Math.max(1, Math.round(stripH * aspect));
    const px = camX * 0.4;
    const sx = -(((px % tw) + tw) % tw);
    const topSliceH = Math.max(2, Math.floor(layer.height * 0.1));
    for (let x = sx; x < vw; x += tw) {
      if (drawY > 0) ctx.drawImage(layer, 0, 0, layer.width, topSliceH, x, 0, tw + 1, drawY + 2);
      ctx.drawImage(layer, x, drawY, tw + 1, stripH);
    }
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

const sprites = new SpriteSheetManager();
sprites.loadPrey();
sprites.loadSharks();
const parallaxBg = new ParallaxBackground();
parallaxBg.load();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const resize = () => {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width || innerWidth));
  canvas.height = Math.max(1, Math.round(rect.height || innerHeight));
};
addEventListener('resize', resize); resize();

let shark = { x: 0, y: 260, angle: 0, phase: 0, hp: 120, maxHp: 120, energy: 100, lv: 1, xp: 0, bite: 2, score: 0, genes: 50, coins: 200, boost: false, formIndex: 0 };
let cam = { x: 0, y: 260 };
let preys = [];

function applyFormStats(idx) {
  shark.formIndex = ((idx % SHARK_FORMS.length) + SHARK_FORMS.length) % SHARK_FORMS.length;
  const f = SHARK_FORMS[shark.formIndex];
  shark.maxHp = f.baseStats.maxHealth + (shark.lv - 1) * 14;
  shark.hp = shark.maxHp;
  shark.bite = f.baseStats.biteTier;
}
applyFormStats(0);

function spawnPrey(sx, sy) {
  const ang = Math.random() * Math.PI * 2;
  const dist = 550 + Math.random() * 850;
  const px = sx + Math.cos(ang) * dist;
  const rawY = Math.max(90, sy + Math.sin(ang) * dist);
  const matching = GAME_CONFIG.preyTiers.filter(c => rawY >= c.minDepth - 120 && rawY <= c.maxDepth + 120);
  const pool = matching.length > 0 ? matching : GAME_CONFIG.preyTiers;
  const cfg = pool[Math.floor(Math.random() * pool.length)];
  const py = Math.max(cfg.minDepth, Math.min(cfg.maxDepth, rawY));
  preys.push({
    cfg, x: px, y: py,
    vx: (Math.random() < 0.5 ? -1 : 1) * cfg.baseSpeed,
    phase: Math.random() * 6.28
  });
}
for (let i = 0; i < 48; i++) spawnPrey(0, 260);

document.getElementById('btn-lang').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; };
document.getElementById('btn-evolve').onclick = () => {
  applyFormStats(shark.formIndex + 1);
};
document.getElementById('btn-cycle').onclick = () => {
  applyFormStats(shark.formIndex + 8);
};
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
  const dt = 0.016;
  const form = SHARK_FORMS[shark.formIndex];
  shark.phase += 0.14;
  const spd = shark.boost && shark.energy > 0 ? form.baseStats.boostSpeed : form.baseStats.swimSpeed;
  if (shark.boost && shark.energy > 0) shark.energy = Math.max(0, shark.energy - 0.35);
  else shark.energy = Math.min(100, shark.energy + 0.25);

  shark.x += Math.cos(shark.angle) * spd * dt;
  shark.y = Math.max(40, shark.y + Math.sin(shark.angle) * spd * dt);
  cam.x += (shark.x - cam.x) * 0.12;
  cam.y += (shark.y - cam.y) * 0.12;

  const preyShrinkFactor = Math.max(0.42, Math.pow(0.955, shark.lv - 1) * (1 / Math.max(1, (form.baseStats.visualSizeMultiplier - 1) * 0.45 + 1)));
  const perceivedScale = (1 / preyShrinkFactor).toFixed(2);

  parallaxBg.render(ctx, cam.x, shark.y, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - cam.x, canvas.height / 2 - cam.y);

  for (let i = preys.length - 1; i >= 0; i--) {
    const p = preys[i];
    p.phase += 0.08;
    p.x += p.vx * dt;
    const canEat = !p.cfg.isHazard && shark.bite >= p.cfg.tier;
    const sharkBaseR = 42;
    const targetRatio = canEat
      ? Math.max(0.22, 0.64 * Math.pow(0.79, shark.bite - p.cfg.tier) * (0.64 + 0.36 * preyShrinkFactor))
      : Math.min(1.9, 1.18 + Math.max(0, p.cfg.tier - shark.bite - 1) * 0.17);
    const pr = sharkBaseR * targetRatio;
    if (Math.hypot(shark.x - p.x, shark.y - p.y) < 38 + pr * 0.85) {
      if (canEat) {
        shark.score += p.cfg.scoreValue;
        shark.genes += p.cfg.geneValue;
        shark.coins += p.cfg.coinValue;
        shark.xp += p.cfg.xpValue;
        if (shark.xp >= shark.lv * 100) {
          shark.xp = 0;
          shark.lv += 1;
          shark.maxHp += 14;
          shark.hp = shark.maxHp;
        }
        shark.hp = Math.min(shark.maxHp, shark.hp + 8);
        preys.splice(i, 1);
        spawnPrey(shark.x, shark.y);
        continue;
      } else {
        shark.hp = Math.max(10, shark.hp - p.cfg.damageOnFail * 0.15);
      }
    }
    if (Math.hypot(shark.x - p.x, shark.y - p.y) > 1700) {
      preys.splice(i, 1);
      spawnPrey(shark.x, shark.y);
      continue;
    }
    const pf = sprites.preyFrames[PREY_FRAME_IDX[p.cfg.tier] || 8];
    if (pf) {
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.vx < 0) ctx.scale(-1, 1);
      ctx.rotate(Math.sin(p.phase) * 0.08);
      const sz = pr * 2.25;
      ctx.drawImage(pf, -sz/2, -sz/2, sz, sz);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(shark.x, shark.y); ctx.rotate(shark.angle);
  if (Math.cos(shark.angle) < 0) ctx.scale(1, -1);
  ctx.rotate(Math.sin(shark.phase) * 0.06);
  const sf = sprites.sharkFrames[shark.formIndex];
  if (sf) {
    const sw = 128, sh = 76;
    ctx.drawImage(sf, -sw / 2, -sh / 2, sw, sh);
  }
  ctx.restore();
  ctx.restore();

  document.getElementById('lbl-form').textContent = 'G' + form.generation + ' · ' + (lang === 'zh' ? form.nameZh : form.nameEn) + ' (' + (shark.formIndex + 1) + '/48)';
  document.getElementById('lbl-hp').textContent = t('hud_hp') + ': ' + Math.round(shark.hp) + '/' + Math.round(shark.maxHp);
  document.getElementById('hp-fill').style.width = Math.min(100, (shark.hp / shark.maxHp) * 100) + '%';
  document.getElementById('lbl-en').textContent = t('hud_energy') + ': ' + Math.round(shark.energy) + '%';
  document.getElementById('en-fill').style.width = shark.energy + '%';
  document.getElementById('lbl-lv').textContent = 'Lv.' + shark.lv + ' · Bite T' + shark.bite + ' · 体型 ' + perceivedScale + 'x';
  document.getElementById('lbl-score').textContent = t('hud_score') + ': ' + shark.score + ' | 🧬 ' + shark.genes + ' | 🪙 ' + shark.coins;
  document.getElementById('lbl-hint').textContent = t('control_hint');
  document.getElementById('btn-boost').textContent = '🚀 ' + t('btn_boost');
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
  a.download = 'hungry-shark-48-evolution.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

