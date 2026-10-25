import { OrganConfig, PreyTierConfig } from './config';
import {
  EquippedOrgansMap,
  getEffectivePreyTier,
  getPreyRelativeVisualScale,
} from './rules';
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
  invulnerableTimer?: number;
  equipped: EquippedOrgansMap;
}

/**
 * Helper to draw a sliced sprite frame centered at (offsetX, offsetY) with target width & height
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
 * Helper to draw a sliced sprite frame while preserving its true tight-cropped aspect ratio
 * so elongated creatures (Moray Eel, Electric Eel, Barracuda) and vertical creatures
 * (Seahorse, Jellyfish, Kraken Tentacle) are never squashed or stretched.
 */
function drawNaturalAspectFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | undefined,
  baseSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  inflateY: number = 1.0
): void {
  if (!frame || frame.width === 0 || frame.height === 0) return;
  const rawAspect = frame.width / Math.max(1, frame.height);
  const clampedAspect = Math.max(0.42, Math.min(2.65, rawAspect));

  // Keep constant visual area (drawW * drawH ≈ baseSize²) while matching exact aspect ratio
  const sqrtAspect = Math.sqrt(clampedAspect);
  const drawW = baseSize * sqrtAspect;
  const drawH = (baseSize / sqrtAspect) * inflateY;

  ctx.drawImage(
    frame,
    offsetX - drawW / 2,
    offsetY - drawH / 2,
    drawW,
    drawH
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
      drawNaturalAspectFrame(ctx, frame, 50, 10, 2);
      break;
    }

    case 'DORSAL': {
      ctx.rotate(sway * 0.4);
      drawNaturalAspectFrame(ctx, frame, 48, 0, -8);
      break;
    }

    case 'TAIL': {
      const tailWag = Math.sin(swimPhase * 1.6) * 0.24;
      const boostScale = isBoosting ? 1.18 : 1.0;
      ctx.rotate(tailWag);
      ctx.scale(boostScale, boostScale);
      drawNaturalAspectFrame(ctx, frame, 50, -10, 0);
      break;
    }

    case 'ARMOR': {
      ctx.rotate(sway * 0.2);
      drawNaturalAspectFrame(ctx, frame, 48, 0, 0);
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
        drawNaturalAspectFrame(ctx, frame, 30, 0, 0);
        ctx.restore();
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * Draw the player's shark and all mounted organs using the sliced sprites from SpriteSheetManager,
 * while preserving sinusoidal swimming wave deformation, upright dorsal orientation, and i-frame feedback.
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
    invulnerableTimer = 0,
    equipped,
  } = params;

  ctx.save();
  ctx.translate(x, y);

  // Normalize angle to [-PI, PI] and keep dorsal fin strictly upright when swimming left
  const normAngle = Math.atan2(Math.sin(angle), Math.cos(angle));
  const isFacingLeft = Math.abs(normAngle) > Math.PI * 0.5;
  if (isFacingLeft) {
    // Mirror horizontally first, then rotate by the mirrored pitch angle so belly never flips up
    ctx.scale(-1, 1);
    const leftPitch =
      normAngle > 0 ? Math.PI - normAngle : -Math.PI - normAngle;
    ctx.rotate(leftPitch);
  } else {
    ctx.rotate(normAngle);
  }

  ctx.scale(scale, scale);

  // Invulnerability (i-frames) protective flicker & barrier ring after taking damage
  if (invulnerableTimer > 0) {
    const blinkOn = Math.floor(invulnerableTimer * 18) % 2 === 0;
    ctx.globalAlpha = blinkOn ? 0.55 : 0.92;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Sinusoidal swimming physics
  const bodyRock = Math.sin(swimPhase) * 0.065;
  const tailSwayY = Math.sin(swimPhase) * 6.5;
  const midSwayY = Math.sin(swimPhase - 0.7) * 3.0;
  const stretchX =
    1 + Math.sin(swimPhase * 2) * 0.025 + (isBoosting ? 0.05 : 0) + biteAnim * 0.04;
  const squashY = 1 - Math.sin(swimPhase * 2) * 0.02 + biteAnim * 0.06;

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
 * Draw any of the 33 Ocean Prey / Hazard / Boss species using the sliced sprites from SpriteSheetManager,
 * preserving each species' authentic aspect ratio and upright dorsal swimming orientation.
 */
export function drawPreyEntity(
  ctx: CanvasRenderingContext2D,
  prey: PreyEntity,
  sharkBiteTier: number,
  frenzyActive: boolean,
  targetPreyId?: string,
  isBoosting: boolean = false,
  relativePreyScale: number = 1.0
): void {
  const {
    config,
    x,
    y,
    vx,
    vy,
    angle,
    phase,
    telegraphTimer,
    isInflated,
    mutationVariant = 'NONE',
  } = prey;
  const visualScale = getPreyRelativeVisualScale(
    config,
    { biteTier: sharkBiteTier, relativePreyScale },
    mutationVariant
  );
  const r = config.radius * visualScale * (isInflated ? 1.32 : 1.0);
  const effectiveTier = getEffectivePreyTier(config, mutationVariant);
  const requiresBoostArmorBreak =
    (mutationVariant === 'ABYSS_BEHEMOTH' && config.tier >= 7) ||
    Boolean(config.isBoss);
  const canEatByTier = !config.isHazard && (frenzyActive || sharkBiteTier >= effectiveTier);
  const needsBoostNow =
    canEatByTier && requiresBoostArmorBreak && !frenzyActive && !isBoosting;
  const canEat = canEatByTier && !needsBoostNow;
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

  // Threat ring (crimson) vs Boost Armor-Break prompt ring (amber dashed)
  if (needsBoostNow) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 7 + Math.sin(phase * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (!canEat || config.isHazard) {
    ctx.strokeStyle =
      telegraphTimer > 0 ? '#f43f5e' : 'rgba(244, 63, 94, 0.55)';
    ctx.lineWidth = telegraphTimer > 0 ? 3 : 1.8;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      r + 6 + (telegraphTimer > 0 ? Math.sin(phase * 10) * 4 : Math.sin(phase * 4) * 1.5),
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  ctx.save();
  // Upright swimming orientation: flip horizontally when moving left, and tilt along vertical trajectory
  // without ever flipping upside-down
  if (config.behavior !== 'DRIFT_SWARM' && config.behavior !== 'MINE_HAZARD') {
    const facingLeft =
      vx < -0.5 || (Math.abs(vx) <= 0.5 && Math.cos(angle) < 0);
    if (facingLeft) {
      ctx.scale(-1, 1);
    }
    const pitch = Math.max(
      -0.52,
      Math.min(0.52, Math.atan2(vy, Math.abs(vx) + 18) * 0.65)
    );
    ctx.rotate(pitch);
  }

  // Sinusoidal swimming wobble & squash-stretch per prey species
  const swimRock = Math.sin(phase * 3.2) * 0.08;
  const pulseScale = 1 + Math.sin(phase * 2.6) * 0.04;
  ctx.rotate(swimRock);
  ctx.scale(pulseScale, 2 - pulseScale);

  if (frenzyActive || mutationVariant === 'GOLDEN_MUTANT') {
    ctx.filter = 'sepia(0.85) saturate(3.2) hue-rotate(5deg) brightness(1.15)';
  } else if (mutationVariant === 'ABYSS_BEHEMOTH') {
    ctx.filter = 'hue-rotate(255deg) saturate(1.6) contrast(1.1)';
  }

  const preyFrame = spriteSheetManager.getPreySprite(config);
  const drawSize = r * 2.25;
  drawNaturalAspectFrame(
    ctx,
    preyFrame,
    drawSize,
    0,
    0,
    isInflated ? 1.16 : 1.0
  );
  ctx.restore();

  // Tier indicator label on Tier 3+ prey/hazards, mutated variants, unedible threats, or active Bounty Target
  if (
    config.tier >= 3 ||
    mutationVariant !== 'NONE' ||
    isBountyTarget ||
    !canEat
  ) {
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = !canEatByTier
      ? '#fda4af'
      : needsBoostNow
      ? '#fde047'
      : isBountyTarget
      ? '#38bdf8'
      : mutationVariant === 'GOLDEN_MUTANT'
      ? '#fde047'
      : mutationVariant === 'ABYSS_BEHEMOTH'
      ? '#e879f9'
      : '#86efac';
    const prefix = !canEatByTier
      ? '⚠️'
      : needsBoostNow
      ? '🚀'
      : isBountyTarget
      ? '🎯'
      : mutationVariant === 'GOLDEN_MUTANT'
      ? '★'
      : mutationVariant === 'ABYSS_BEHEMOTH'
      ? '⚡'
      : '';
    ctx.fillText(`${prefix}T${effectiveTier}`, 0, -r - 8);
  }

  ctx.restore();
}

interface RadarMarker {
  prey: PreyEntity;
  kind: 'BOUNTY' | 'GOLDEN' | 'DANGER';
  worldDist: number;
  screenDx: number;
  screenDy: number;
}

/**
 * P1-2: Off-Screen Edge Radar Indicators (🎯 悬赏目标鱼 / ★ 黄金变异种 / ⚠️ 巨兽预警)
 * Draws sleek directional pods with miniature species icons and distance meters along the viewport border.
 */
export function drawOffScreenRadarIndicators(
  ctx: CanvasRenderingContext2D,
  preyList: PreyEntity[],
  camera: { x: number; y: number; zoom: number },
  viewW: number,
  viewH: number,
  sharkBiteTier: number,
  frenzyActive: boolean,
  targetPreyId?: string,
  nowMs: number = 0
): void {
  const halfW = viewW / 2;
  const halfH = viewH / 2;
  const bountyMarkers: RadarMarker[] = [];
  const goldenMarkers: RadarMarker[] = [];
  const dangerMarkers: RadarMarker[] = [];

  for (const prey of preyList) {
    const sx = halfW + (prey.x - camera.x) * camera.zoom;
    const sy = halfH + (prey.y - camera.y) * camera.zoom;

    // Skip if already visible inside the main viewport
    if (sx >= 24 && sx <= viewW - 24 && sy >= 78 && sy <= viewH - 24) {
      continue;
    }

    const screenDx = sx - halfW;
    const screenDy = sy - halfH;
    const worldDist = Math.hypot(prey.x - camera.x, prey.y - camera.y);
    if (worldDist > 1650 || worldDist < 40) continue;

    const isBounty = Boolean(targetPreyId && prey.config.id === targetPreyId);
    const effectiveTier = getEffectivePreyTier(
      prey.config,
      prey.mutationVariant
    );
    const canEat = frenzyActive || sharkBiteTier >= effectiveTier;

    if (isBounty) {
      bountyMarkers.push({
        prey,
        kind: 'BOUNTY',
        worldDist,
        screenDx,
        screenDy,
      });
    } else if (
      prey.mutationVariant === 'GOLDEN_MUTANT' &&
      canEat &&
      !prey.config.isHazard &&
      worldDist < 1250
    ) {
      goldenMarkers.push({
        prey,
        kind: 'GOLDEN',
        worldDist,
        screenDx,
        screenDy,
      });
    } else if (
      ((!canEat && !prey.config.isHazard && prey.config.tier >= 5) ||
        prey.mutationVariant === 'ABYSS_BEHEMOTH') &&
      worldDist < 880
    ) {
      dangerMarkers.push({
        prey,
        kind: 'DANGER',
        worldDist,
        screenDx,
        screenDy,
      });
    }
  }

  bountyMarkers.sort((a, b) => a.worldDist - b.worldDist);
  goldenMarkers.sort((a, b) => a.worldDist - b.worldDist);
  dangerMarkers.sort((a, b) => a.worldDist - b.worldDist);

  const selected: RadarMarker[] = [
    ...bountyMarkers.slice(0, 2),
    ...goldenMarkers.slice(0, 1),
    ...dangerMarkers.slice(0, 1),
  ];
  if (selected.length === 0) return;

  // Safe inner screen box that avoids the top HUD bar and bottom corner touch controls
  const minX = 48;
  const maxX = viewW - 48;
  const minY = 96;
  const maxY = viewH - 64;

  const placedPositions: Array<{ x: number; y: number }> = [];

  for (const marker of selected) {
    const { prey, kind, worldDist, screenDx, screenDy } = marker;
    const ang = Math.atan2(screenDy, screenDx);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    // Ray-box intersection from screen center (halfW, halfH) to [minX..maxX, minY..maxY]
    const tx =
      cos > 0.0001
        ? (maxX - halfW) / cos
        : cos < -0.0001
        ? (minX - halfW) / cos
        : Infinity;
    const ty =
      sin > 0.0001
        ? (maxY - halfH) / sin
        : sin < -0.0001
        ? (minY - halfH) / sin
        : Infinity;
    const t = Math.min(tx, ty);
    let edgeX = halfW + cos * t;
    let edgeY = halfH + sin * t;

    // Push out of bottom-left joystick & bottom-right tactical dock + boost button zones
    if (edgeX < 160 && edgeY > viewH - 155) {
      edgeY = viewH - 160;
    } else if (edgeX > viewW - 150 && edgeY > viewH - 175) {
      edgeY = viewH - 180;
    } else if (edgeX > viewW - 430 && edgeY > viewH - 88) {
      edgeX = Math.max(165, viewW - 435);
    }

    // Prevent two radar pods from overlapping along the same edge
    for (const prev of placedPositions) {
      if (Math.hypot(edgeX - prev.x, edgeY - prev.y) < 58) {
        if (Math.abs(sin) > Math.abs(cos)) {
          edgeX = Math.max(minX + 30, Math.min(maxX - 30, prev.x + 62));
        } else {
          edgeY = Math.max(minY + 30, Math.min(maxY - 30, prev.y - 62));
        }
      }
    }
    placedPositions.push({ x: edgeX, y: edgeY });

    const borderColor =
      kind === 'BOUNTY'
        ? '#38bdf8'
        : kind === 'GOLDEN'
        ? '#fde047'
        : '#f43f5e';
    const badgePrefix =
      kind === 'BOUNTY'
        ? '🎯'
        : kind === 'GOLDEN'
        ? '★'
        : `⚠️T${prey.config.tier}`;
    const distMeters = Math.max(5, Math.round(worldDist / 12));
    const pulse = 0.85 + 0.15 * Math.sin(nowMs * 0.008);

    ctx.save();
    ctx.translate(edgeX, edgeY);

    // Outward directional chevron pointer
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(19, -6);
    ctx.lineTo(19, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Circular dark-glass radar pod
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.2 * pulse;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Miniature species icon inside pod
    const preyFrame = spriteSheetManager.getPreySprite(prey.config);
    drawNaturalAspectFrame(ctx, preyFrame, 21, 0, -2);

    // Distance pill label
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.fillRect(-26, 13, 52, 14);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-26, 13, 52, 14);
    ctx.fillStyle = borderColor;
    ctx.fillText(`${badgePrefix} ${distMeters}m`, 0, 23);

    ctx.restore();
  }
}



