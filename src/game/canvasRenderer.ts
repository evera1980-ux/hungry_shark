import { OrganConfig, PreyTierConfig } from './config';
import { EquippedOrgansMap } from './rules';
import { spriteSheetManager } from './spriteSheetManager';

export interface RenderSharkParams {
  x: number;
  y: number;
  angle: number;
  scale: number;
  swimPhase: number;
  biteAnim: number; // 0..1 (1 = wide open snap)
  isBoosting: boolean;
  frenzyTimer: number;
  hitFlashTimer: number;
  equipped: EquippedOrgansMap;
}

/**
 * Helper to draw a sliced sprite frame centered at (0, 0) with target width & height
 */
function drawCenteredFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | undefined,
  width: number,
  height: number,
  offsetX: number = 0,
  offsetY: number = 0
): void {
  if (!frame || frame.width === 0 || frame.height === 0) return;
  ctx.drawImage(
    frame,
    offsetX - width / 2,
    offsetY - height / 2,
    width,
    height
  );
}

/**
 * Draw an evolution organ sprite from the 4x4 SpriteSheetManager at local coordinates (0, 0).
 * Used both on the live shark skeleton and inside the Evolution Modal 3-Choice cards.
 */
export function drawOrganPart(
  ctx: CanvasRenderingContext2D,
  organ: OrganConfig,
  swimPhase: number,
  biteAnim: number,
  isBoosting: boolean
): void {
  const frame = spriteSheetManager.getOrganFrame(organ.id);
  if (!frame) return;

  ctx.save();
  const sway = Math.sin(swimPhase * 2) * 0.08;

  switch (organ.slot) {
    case 'JAWS': {
      // Pitch and scale up slightly during bite snap
      const snapAngle = sway * 0.5 - biteAnim * 0.18;
      const snapScale = 1 + biteAnim * 0.18;
      ctx.rotate(snapAngle);
      ctx.scale(snapScale, snapScale);
      drawCenteredFrame(ctx, frame, 58, 42, 10, 2);
      break;
    }

    case 'DORSAL': {
      ctx.rotate(sway * 0.4);
      drawCenteredFrame(ctx, frame, 54, 42, 0, -8);
      break;
    }

    case 'TAIL': {
      const tailWag = Math.sin(swimPhase * 1.6) * 0.24;
      const boostScale = isBoosting ? 1.18 : 1.0;
      ctx.rotate(tailWag);
      ctx.scale(boostScale, boostScale);
      drawCenteredFrame(ctx, frame, 58, 44, -10, 0);
      break;
    }

    case 'ARMOR': {
      ctx.rotate(sway * 0.2);
      drawCenteredFrame(ctx, frame, 56, 38, 0, 0);
      break;
    }

    case 'AURA': {
      // Orbiting devour/gene icons around the shark
      for (let i = 0; i < 3; i++) {
        const orbitAngle = swimPhase * 0.85 + (i * Math.PI * 2) / 3;
        const ox = Math.cos(orbitAngle) * 56;
        const oy = Math.sin(orbitAngle) * 56;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(Math.sin(swimPhase + i) * 0.2);
        drawCenteredFrame(ctx, frame, 30, 30, 0, 0);
        ctx.restore();
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * Draw the player's shark and all mounted organs using the 16 sliced sprites from SpriteSheetManager,
 * while preserving sinusoidal swimming wave deformation, rotation, and scale physics.
 */
export function drawSharkWithOrgans(
  ctx: CanvasRenderingContext2D,
  params: RenderSharkParams
): void {
  const {
    x,
    y,
    angle,
    scale,
    swimPhase,
    biteAnim,
    isBoosting,
    frenzyTimer,
    hitFlashTimer,
    equipped,
  } = params;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Flip vertically when swimming left so dorsal fin stays upright
  if (Math.cos(angle) < 0) {
    ctx.scale(1, -1);
  }
  ctx.scale(scale, scale);

  // Sinusoidal swimming physics
  const bodyRock = Math.sin(swimPhase) * 0.065;
  const tailSwayY = Math.sin(swimPhase) * 6.5;
  const midSwayY = Math.sin(swimPhase - 0.7) * 3.0;
  const stretchX = 1 + Math.sin(swimPhase * 2) * 0.025 + (isBoosting ? 0.05 : 0);
  const squashY = 1 - Math.sin(swimPhase * 2) * 0.02;

  ctx.rotate(bodyRock);

  // 1. AURA slot (behind shark body)
  if (equipped.AURA) {
    drawOrganPart(ctx, equipped.AURA, swimPhase, biteAnim, isBoosting);
  }

  // Golden Frenzy Halo if active
  if (frenzyTimer > 0) {
    const fPulse = 0.5 + 0.5 * Math.sin(swimPhase * 4);
    ctx.save();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 62 + fPulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. TAIL slot mounted at rear caudal peduncle (-44, tailSwayY)
  if (equipped.TAIL) {
    ctx.save();
    ctx.translate(-44, tailSwayY);
    drawOrganPart(ctx, equipped.TAIL, swimPhase, biteAnim, isBoosting);
    ctx.restore();
  }

  // 3. DORSAL slot mounted on top spine (-6, -24 + midSwayY * 0.4)
  if (equipped.DORSAL) {
    ctx.save();
    ctx.translate(-6, -24 + midSwayY * 0.4);
    drawOrganPart(ctx, equipped.DORSAL, swimPhase, biteAnim, isBoosting);
    ctx.restore();
  }

  // 4. Base Shark Body Sprite (Frame [0, 0]: BASE_SHARK)
  const sharkFrame = spriteSheetManager.getFrame('BASE_SHARK');
  ctx.save();
  ctx.scale(stretchX, squashY);
  if (hitFlashTimer > 0) {
    ctx.filter = 'brightness(1.85) contrast(1.2)';
  } else if (frenzyTimer > 0) {
    ctx.filter = 'sepia(0.85) saturate(3.5) brightness(1.15)';
  }
  drawCenteredFrame(ctx, sharkFrame, 118, 68, 0, midSwayY * 0.25);
  ctx.filter = 'none';
  ctx.restore();

  // 5. ARMOR slot mounted across mid-torso (-6, 2 + midSwayY * 0.3)
  if (equipped.ARMOR) {
    ctx.save();
    ctx.translate(-6, 2 + midSwayY * 0.3);
    drawOrganPart(ctx, equipped.ARMOR, swimPhase, biteAnim, isBoosting);
    ctx.restore();
  }

  // 6. JAWS slot mounted at snout/mandible (32, 4)
  if (equipped.JAWS) {
    ctx.save();
    ctx.translate(32, 4);
    drawOrganPart(ctx, equipped.JAWS, swimPhase, biteAnim, isBoosting);
    ctx.restore();
  }

  ctx.restore();
}

export interface PreyEntity {
  uid: number;
  config: PreyTierConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  phase: number;
  telegraphTimer: number;
  isInflated: boolean;
}

/**
 * Draw any of the 8 Ocean Prey / Hazard / Boss tiers using the sliced sprites from SpriteSheetManager
 */
export function drawPreyEntity(
  ctx: CanvasRenderingContext2D,
  prey: PreyEntity,
  sharkBiteTier: number,
  frenzyActive: boolean
): void {
  const { config, x, y, vx, phase, telegraphTimer, isInflated } = prey;
  const r = config.radius * (isInflated ? 1.32 : 1.0);
  const canEat = frenzyActive || sharkBiteTier >= config.tier;

  ctx.save();
  ctx.translate(x, y);

  // Threat or hazard telegraph ring
  if (!canEat || config.isHazard) {
    ctx.strokeStyle =
      telegraphTimer > 0 ? '#f43f5e' : 'rgba(244, 63, 94, 0.38)';
    ctx.lineWidth = telegraphTimer > 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      r + 6 + (telegraphTimer > 0 ? Math.sin(phase * 10) * 4 : 0),
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  ctx.save();
  // Note: In the sprite sheet, Pufferfish [2,1], Submarine [2,2], Crystal Crab [2,3],
  // and Electric Eel [3,0] face right (+X). Flip horizontally when swimming left (vx < -1).
  if (config.behavior !== 'DRIFT_SWARM' && config.behavior !== 'MINE_HAZARD') {
    if (vx < -1) {
      ctx.scale(-1, 1);
    }
  }

  // Sinusoidal swimming wobble & squash-stretch per prey species
  const swimRock = Math.sin(phase * 3.2) * 0.09;
  const pulseScale = 1 + Math.sin(phase * 2.6) * 0.045;
  ctx.rotate(swimRock);
  ctx.scale(pulseScale, 2 - pulseScale);

  const preyFrame = spriteSheetManager.getPreyFrame(config.tier);
  const drawSize = r * 2.35;
  drawCenteredFrame(ctx, preyFrame, drawSize, drawSize * 0.85, 0, 0);
  ctx.restore();

  // Tier indicator label on Tier 3+ prey/hazards
  if (config.tier >= 3) {
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = canEat ? '#86efac' : '#fda4af';
    ctx.fillText(`T${config.tier}`, 0, -r - 8);
  }

  ctx.restore();
}
