import { OrganConfig, PreyTierConfig } from './config';
import {
  EquippedOrgansMap,
  getEffectivePreyTier,
  getPreyRelativeVisualScale,
} from './rules';
import { getSharkFormById } from './sharkEvolutionConfig';
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
  equipped?: EquippedOrgansMap;
  sharkFormId?: string;
  morphFlashTimer?: number;
}

/**
 * Helper to draw a sliced sprite frame while preserving its true tight-cropped aspect ratio
 * so elongated creatures (Moray Eel, Electric Eel, Barracuda, Sea-Dragon) and vertical/winged creatures
 * (Seahorse, Jellyfish, Kraken Tentacle, Valkyrie Shark) are never squashed or stretched.
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
 * Legacy helper kept for OrganCanvasPreview compatibility
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
  const boostScale = isBoosting ? 1.12 : 1.0;
  ctx.rotate(sway * 0.4 - biteAnim * 0.1);
  ctx.scale(boostScale, boostScale);
  drawNaturalAspectFrame(ctx, frame, 48, 0, 0);
  ctx.restore();
}

/**
 * Draw the player's evolved Shark Form (1 of 48 forms from /assets/aistudio/sharks_ec921c3b.png),
 * preserving natural aspect ratio, sinusoidal swimming wave deformation, upright dorsal orientation,
 * lineage aura, and Morph Breakthrough shockwave feedback.
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
    sharkFormId = 'shark_00_clown_fry',
    morphFlashTimer = 0,
  } = params;

  const sharkForm = getSharkFormById(sharkFormId);

  ctx.save();
  ctx.translate(x, y);

  // Morph Breakthrough Shockwave (when evolving mid-run into a higher shark form)
  if (morphFlashTimer > 0) {
    const progress = 1 - Math.min(1, morphFlashTimer / 0.85);
    const waveR = 36 + progress * 155;
    ctx.save();
    ctx.strokeStyle = sharkForm.glowColor;
    ctx.lineWidth = Math.max(1.5, (1 - progress) * 7);
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.beginPath();
    ctx.arc(0, 0, waveR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1, (1 - progress) * 4);
    ctx.beginPath();
    ctx.arc(0, 0, waveR * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

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
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Sinusoidal swimming physics + bite lunge
  const bodyRock = Math.sin(swimPhase) * 0.062;
  const midSwayY = Math.sin(swimPhase - 0.7) * 2.6;
  const lungeX = biteAnim * 7.5;
  const stretchX =
    1 +
    Math.sin(swimPhase * 2) * 0.026 +
    (isBoosting ? 0.055 : 0) +
    biteAnim * 0.05;
  const squashY = 1 - Math.sin(swimPhase * 2) * 0.022 + biteAnim * 0.055;

  ctx.rotate(bodyRock);

  // High-Generation Lineage Halo (Generation IV~VI sharks emit a subtle ambient domain ring)
  if (sharkForm.generation >= 4 || isBoosting) {
    const auraPulse = 0.5 + 0.5 * Math.sin(swimPhase * 3.2);
    ctx.save();
    ctx.strokeStyle = sharkForm.glowColor;
    ctx.globalAlpha = isBoosting ? 0.48 : 0.22 + (sharkForm.generation - 4) * 0.06;
    ctx.lineWidth = isBoosting ? 2.6 : 1.8;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(-4, 0, 52 + auraPulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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

  // Pure 48-Form Shark Evolution Body Sprite (No bolted-on external clutter!)
  const sharkFrame = spriteSheetManager.getSharkFormFrame(sharkForm.spriteKey);
  ctx.save();
  ctx.translate(lungeX, 0);
  ctx.scale(stretchX, squashY);
  if (hitFlashTimer > 0 || morphFlashTimer > 0.55) {
    ctx.filter = 'brightness(1.85) contrast(1.2)';
  } else if (frenzyTimer > 0) {
    ctx.filter = 'sepia(0.85) saturate(3.5) brightness(1.15)';
  }
  drawNaturalAspectFrame(ctx, sharkFrame, 96, 0, midSwayY * 0.25);
  ctx.filter = 'none';
  ctx.restore();

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
  _isBoosting: boolean = false,
  relativePreyScale: number = 1.0,
  sharkScale: number = 1.0,
  canEatMines: boolean = false
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
  const effectiveTier = getEffectivePreyTier(config, mutationVariant);
  const canEatWithoutFrenzy = config.isHazard
    ? canEatMines
    : sharkBiteTier >= effectiveTier;
  const canEatByTier = frenzyActive || canEatWithoutFrenzy;
  const needsBoostNow = false;
  const canEat = canEatByTier;
  const visualScale = getPreyRelativeVisualScale(
    config,
    {
      biteTier: sharkBiteTier,
      normalBiteTier: sharkBiteTier,
      relativePreyScale,
      scale: sharkScale,
      canEatMines,
    },
    mutationVariant,
    frenzyActive
  );
  // Keep inflated edible pufferfish strictly smaller than the shark (<= 0.72x shark size), while giant puffers preserve their menacing size even during Gold Frenzy
  const inflateMult = isInflated ? (canEatWithoutFrenzy ? 1.12 : 1.24) : 1.0;
  const r = config.radius * visualScale * inflateMult;
  const isBountyTarget = Boolean(targetPreyId && config.id === targetPreyId);

  ctx.save();
  ctx.translate(x, y);

  // Active Target Fish Bounty Lock Reticle
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

  // Threat ring (crimson) vs Gold Frenzy giant-hunt highlight ring
  if (needsBoostNow) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 7 + Math.sin(phase * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (!canEat || (config.isHazard && !canEatByTier)) {
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
  } else if (frenzyActive && !canEatWithoutFrenzy) {
    // During Gold Frenzy, giant apex prey/hazards keep their massive size and glow with a golden feast ring!
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 6 + Math.sin(phase * 6) * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
      : frenzyActive && !canEatWithoutFrenzy
      ? '#fde047'
      : needsBoostNow
      ? '#fde047'
      : isBountyTarget
      ? '#38bdf8'
      : mutationVariant === 'GOLDEN_MUTANT'
      ? '#fde047'
      : mutationVariant === 'ABYSS_BEHEMOTH'
      ? '#e879f9'
      : '#86efac';

    const iconKey = !canEatByTier
      ? 'UI_ICON_DANGER_SKULL'
      : isBountyTarget
      ? 'UI_ICON_BOUNTY_TARGET'
      : null;
    const iconFrame = iconKey
      ? spriteSheetManager.getUiIconFrame(iconKey)
      : undefined;

    if (iconFrame) {
      ctx.drawImage(iconFrame, -19, -r - 20, 14, 14);
      ctx.fillText(`T${effectiveTier}`, 5, -r - 9);
    } else {
      const prefix =
        mutationVariant === 'GOLDEN_MUTANT' || (frenzyActive && !canEatWithoutFrenzy)
          ? '★'
          : '';
      ctx.fillText(`${prefix}T${effectiveTier}`, 0, -r - 8);
    }
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

    // Corner UI icon badge on radar pod
    const podBadgeKey =
      kind === 'BOUNTY'
        ? 'UI_ICON_BOUNTY_TARGET'
        : kind === 'DANGER'
        ? 'UI_ICON_DANGER_SKULL'
        : null;
    const podBadgeFrame = podBadgeKey
      ? spriteSheetManager.getUiIconFrame(podBadgeKey)
      : undefined;
    if (podBadgeFrame) {
      ctx.drawImage(podBadgeFrame, -20, -20, 15, 15);
    }

    // Distance pill label
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.fillRect(-26, 13, 52, 14);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-26, 13, 52, 14);
    ctx.fillStyle = borderColor;
    const labelText =
      kind === 'DANGER' ? `T${prey.config.tier} ${distMeters}m` : `${distMeters}m`;
    ctx.fillText(labelText, 0, 23);

    ctx.restore();
  }
}



