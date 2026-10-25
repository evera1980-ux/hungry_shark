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

import { PreyMutationVariant } from './infiniteProgressionManager';

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
  scaleMultiplier?: number;
  mutationVariant?: PreyMutationVariant;
}

/**
 * Draw any of the 32 Ocean Prey / Hazard / Boss species using the sliced sprites from SpriteSheetManager
 */
export function drawPreyEntity(
  ctx: CanvasRenderingContext2D,
  prey: PreyEntity,
  sharkBiteTier: number,
  frenzyActive: boolean,
  targetPreyId?: string
): void {
  const {
    config,
    x,
    y,
    vx,
    phase,
    telegraphTimer,
    isInflated,
    mutationVariant = 'NONE',
  } = prey;
  const behemothBoost = mutationVariant === 'ABYSS_BEHEMOTH' ? 1.28 : 1.0;
  const scaleMult = Math.min(2.45, (prey.scaleMultiplier ?? 1.0) * behemothBoost);
  const r = config.radius * scaleMult * (isInflated ? 1.32 : 1.0);
  const canEat = frenzyActive || sharkBiteTier >= config.tier;
  const isBountyTarget = Boolean(targetPreyId && config.id === targetPreyId);

  ctx.save();
  ctx.translate(x, y);

  // Active Target Fish Bounty Lock Reticle (🎯)
  if (isBountyTarget) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 9 + Math.sin(phase * 5) * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Mutation Variant Aura (Golden Mutant / Abyss Behemoth)
  if (mutationVariant === 'GOLDEN_MUTANT') {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.78)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 5 + Math.sin(phase * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (mutationVariant === 'ABYSS_BEHEMOTH') {
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6 + Math.cos(phase * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

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
  // All directional sprites in both sheets face right (+X). Flip horizontally when swimming left (vx < -1).
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

  if (frenzyActive || mutationVariant === 'GOLDEN_MUTANT') {
    ctx.filter = 'sepia(0.85) saturate(3.2) hue-rotate(5deg) brightness(1.15)';
  } else if (mutationVariant === 'ABYSS_BEHEMOTH') {
    ctx.filter = 'hue-rotate(255deg) saturate(1.6) contrast(1.1)';
  }

  const preyFrame = spriteSheetManager.getPreySprite(config);
  const drawSize = r * 2.35;
  drawCenteredFrame(ctx, preyFrame, drawSize, drawSize * 0.85, 0, 0);
  ctx.restore();

  // Tier indicator label on Tier 3+ prey/hazards, mutated variants, or active Bounty Target
  if (config.tier >= 3 || mutationVariant !== 'NONE' || isBountyTarget) {
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = isBountyTarget
      ? '#38bdf8'
      : mutationVariant === 'GOLDEN_MUTANT'
      ? '#fde047'
      : mutationVariant === 'ABYSS_BEHEMOTH'
      ? '#e879f9'
      : canEat
      ? '#86efac'
      : '#fda4af';
    const prefix = isBountyTarget
      ? '🎯'
      : mutationVariant === 'GOLDEN_MUTANT'
      ? '★'
      : mutationVariant === 'ABYSS_BEHEMOTH'
      ? '⚡'
      : '';
    ctx.fillText(`${prefix}T${config.tier}`, 0, -r - 8);
  }

  ctx.restore();
}

