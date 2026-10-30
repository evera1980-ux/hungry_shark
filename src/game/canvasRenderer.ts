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

export type SwimGaitType =
  | 'SHARK_APEX'
  | 'CARANGIFORM'
  | 'ANGUILLIFORM'
  | 'MEDUSOID_JET'
  | 'PUFFER_BUOYANT'
  | 'RIGID_PROPULSION';

const ANGUILLIFORM_IDS = new Set<string>([
  'electric_eel',
  'green_moray_eel',
  'abyssal_viperfish',
  'abyssal_gulper_eel',
]);

const MEDUSOID_JET_IDS = new Set<string>([
  'gene_jelly',
  'vampire_squid',
  'giant_humboldt_squid',
  'cthulhu_kraken',
  'kraken_abyss_tentacle',
]);

const PUFFER_BUOYANT_IDS = new Set<string>([
  'gold_puffer',
  'venom_lionfish',
  'rainbow_seahorse',
  'trench_blobfish',
]);

const RIGID_PROPULSION_IDS = new Set<string>([
  'probe_sub',
  'cyber_mine',
  'reef_hermit_crab',
  'giant_isopod',
  'abyssal_king_crab',
  'diver_snorkel_mask',
  'sunken_atlantean_idol',
  'radioactive_slime_hazard',
  'megalodon_tooth_fossil',
  'fusion_plasma_core',
]);

/**
 * Classifies each marine species into one of 5 authentic biomechanical swimming gaits.
 */
export function getPreySwimGait(config: PreyTierConfig): SwimGaitType {
  if (config.id === 'cyber_mecha_shark_boss') return 'SHARK_APEX';
  if (ANGUILLIFORM_IDS.has(config.id)) return 'ANGUILLIFORM';
  if (MEDUSOID_JET_IDS.has(config.id)) return 'MEDUSOID_JET';
  if (PUFFER_BUOYANT_IDS.has(config.id)) return 'PUFFER_BUOYANT';
  if (RIGID_PROPULSION_IDS.has(config.id) || config.isHazard) {
    return 'RIGID_PROPULSION';
  }
  return 'CARANGIFORM';
}

/**
 * Computes the vertical spine displacement and local vertical scale for a normalized slice
 * at `u` in [0, 1], where u = 0 is the snout/head (right side of sprite) and u = 1 is the tail tip (left side).
 */
export function computeSpineSliceDeformation(
  u: number,
  phase: number,
  gait: SwimGaitType,
  drawH: number,
  intensity: number = 1.0,
  biteAnim: number = 0
): { dy: number; scaleY: number } {
  const clampedU = Math.max(0, Math.min(1, u));

  switch (gait) {
    case 'SHARK_APEX': {
      // Anterior 42% (snout, jaws, gills, dorsal torso) stays sleek and cohesive;
      // posterior 58% (caudal peduncle + crescent tail fin) whips with a smooth C1 envelope
      const envelope = 0.015 * clampedU + 0.985 * Math.pow(clampedU, 2.25);
      const waveNumber = 2.15;
      const theta = phase - clampedU * waveNumber;
      const baseAmp = drawH * (0.118 * intensity + biteAnim * 0.042);
      // C1-smooth head counter-nod during bite snap (zero derivative at u = 0.28)
      const biteHeadSnap =
        clampedU < 0.28
          ? -biteAnim * drawH * 0.032 * Math.pow(1 - clampedU / 0.28, 2)
          : 0;
      const dy = Math.sin(theta) * baseAmp * envelope + biteHeadSnap;
      const tailFlare =
        clampedU > 0.65
          ? 1 +
            Math.pow((clampedU - 0.65) / 0.35, 1.5) * 0.055 * Math.cos(theta * 2)
          : 1.0;
      return { dy, scaleY: tailFlare };
    }

    case 'ANGUILLIFORM': {
      // Eels & sea-serpents: full-body multi-wave S-slither along the body
      const envelope = 0.14 + 0.86 * Math.pow(clampedU, 1.15);
      const waveNumber = 4.35;
      const theta = phase - clampedU * waveNumber;
      const dy = Math.sin(theta) * drawH * 0.145 * intensity * envelope;
      return { dy, scaleY: 1.0 };
    }

    case 'MEDUSOID_JET': {
      // Squids, Jellyfish & Kraken: C1-continuous bell/mantle pulse + trailing tentacle whip
      const jetPulse = Math.sin(phase) + 0.32 * Math.sin(phase * 2);
      if (clampedU < 0.45) {
        const bellFactor = Math.pow(1 - clampedU / 0.45, 1.5);
        return {
          dy: Math.cos(phase) * drawH * 0.028 * bellFactor,
          scaleY: 1 - jetPulse * 0.085 * bellFactor * intensity,
        };
      }
      const tentacleU = (clampedU - 0.45) / 0.55;
      const theta = phase - tentacleU * 3.2;
      const dy =
        Math.sin(theta) *
        drawH *
        0.14 *
        intensity *
        Math.pow(tentacleU, 1.5);
      return {
        dy,
        scaleY: 1 + Math.sin(theta) * 0.04 * Math.pow(tentacleU, 1.5),
      };
    }

    case 'PUFFER_BUOYANT': {
      // Pufferfish, Lionfish, Seahorse: C1-continuous buoyant breathing body + caudal fin flutter
      const bobY = Math.sin(phase * 0.9) * drawH * 0.026;
      const finU = clampedU > 0.62 ? (clampedU - 0.62) / 0.38 : 0;
      const smoothFin = finU > 0 ? Math.pow(finU, 1.6) : 0;
      const breath =
        1 +
        Math.sin(phase * 1.6 - clampedU * 1.1) *
          0.038 *
          intensity *
          (1 - smoothFin);
      const flutterDy =
        Math.sin(phase * 2.1 - finU * 2.2) *
        drawH *
        0.1 *
        intensity *
        smoothFin;
      return { dy: bobY + flutterDy, scaleY: breath };
    }

    case 'RIGID_PROPULSION': {
      // Submarines, Crabs & Relics: rigid hull/carapace with subtle rear propeller/leg vibration
      const rearVib =
        clampedU > 0.78
          ? Math.sin(phase * 3.2) *
            drawH *
            0.022 *
            Math.pow((clampedU - 0.78) / 0.22, 1.5)
          : 0;
      return { dy: rearVib, scaleY: 1.0 };
    }

    case 'CARANGIFORM':
    default: {
      // Standard pelagic & reef fish: steady anterior body, smooth posterior S-wave propulsion
      const envelope = 0.02 + 0.98 * Math.pow(clampedU, 1.95);
      const waveNumber = 2.35;
      const theta = phase - clampedU * waveNumber;
      const dy = Math.sin(theta) * drawH * 0.12 * intensity * envelope;
      const tailFlare =
        clampedU > 0.68
          ? 1 +
            Math.pow((clampedU - 0.68) / 0.32, 1.5) * 0.05 * Math.cos(theta * 2)
          : 1.0;
      return { dy, scaleY: tailFlare };
    }
  }
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
 * Continuous Affine-Sheared Ribbon Spine Renderer.
 * Preserves the exact bounding footprint (drawW × drawH) of drawNaturalAspectFrame
 * while warping the sprite along a C1-smooth spinal curve.
 * Each vertical strip shares exact boundary deformations (def0 at left edge, def1 at right edge)
 * and applies an affine Y-shear (`shearY = (def1.dy - def0.dy) / sliceDstW`) with locked
 * UV-to-destination seam padding, completely eliminating stair-step segmentation artifacts.
 */
export function drawUndulatingSpriteFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | undefined,
  baseSize: number,
  phase: number,
  gait: SwimGaitType,
  offsetX: number = 0,
  offsetY: number = 0,
  inflateY: number = 1.0,
  intensity: number = 1.0,
  biteAnim: number = 0
): void {
  if (!frame || frame.width === 0 || frame.height === 0) return;

  // Rigid objects or ultra-small distant sprites can fast-path when no spinal bending is needed
  if (gait === 'RIGID_PROPULSION' && baseSize < 42) {
    drawNaturalAspectFrame(ctx, frame, baseSize, offsetX, offsetY, inflateY);
    return;
  }

  const rawAspect = frame.width / Math.max(1, frame.height);
  const clampedAspect = Math.max(0.42, Math.min(2.65, rawAspect));
  const sqrtAspect = Math.sqrt(clampedAspect);
  const drawW = baseSize * sqrtAspect;
  const drawH = (baseSize / sqrtAspect) * inflateY;

  // High-resolution adaptive slice density: 24 strips for player sharks & hero previews
  const sliceCount =
    baseSize >= 84 ? 24 : baseSize >= 46 ? 16 : baseSize >= 24 ? 10 : 6;
  const srcW = frame.width;
  const srcH = frame.height;
  const sliceSrcW = srcW / sliceCount;
  const sliceDstW = drawW / sliceCount;
  const startDstX = offsetX - drawW / 2;
  const srcPerDstRatio = srcW / Math.max(1e-4, drawW);
  const dstPerSrcRatio = drawW / Math.max(1e-4, srcW);

  // Evaluate left-most boundary (i = 0 => t0 = 0 => tail tip u0 = 1) once, then reuse right boundary as next left boundary
  let def0 = computeSpineSliceDeformation(
    1.0,
    phase,
    gait,
    drawH,
    intensity,
    biteAnim
  );

  for (let i = 0; i < sliceCount; i++) {
    // Right boundary of slice i: t1 = (i + 1) / sliceCount => u1 = 1 - t1
    const u1 = 1 - (i + 1) / sliceCount;
    const def1 = computeSpineSliceDeformation(
      u1,
      phase,
      gait,
      drawH,
      intensity,
      biteAnim
    );

    const sx = i * sliceSrcW;
    // Proportional UV & destination sub-pixel overlap prevents anti-aliasing hairline seams without texture ghosting
    const padDst = i < sliceCount - 1 ? 0.55 : 0;
    const sw = Math.min(sliceSrcW + padDst * srcPerDstRatio, srcW - sx);
    const dw = sw * dstPerSrcRatio;

    const avgScaleY = 0.5 * (def0.scaleY + def1.scaleY);
    const dh = drawH * avgScaleY;
    const dx = startDstX + i * sliceDstW;
    const centerY0 = offsetY + def0.dy;
    const shearY = (def1.dy - def0.dy) / Math.max(1e-4, sliceDstW);

    ctx.save();
    ctx.translate(dx, centerY0);
    ctx.transform(1, shearY, 0, 1, 0, 0);
    ctx.drawImage(frame, sx, 0, sw, srcH, 0, -dh / 2, dw, dh);
    ctx.restore();

    def0 = def1;
  }
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
 * preserving natural aspect ratio, multi-slice sinusoidal spine wave deformation, upright dorsal orientation,
 * and Morph Breakthrough shockwave feedback.
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

  // Invulnerability (i-frames) natural body flicker after taking damage (no outer circle)
  if (invulnerableTimer > 0) {
    const blinkOn = Math.floor(invulnerableTimer * 18) % 2 === 0;
    ctx.globalAlpha = blinkOn ? 0.55 : 0.92;
  }

  // Subtle hydro-yaw + bite lunge coupled with multi-slice spinal wave propulsion
  const bodyYaw = Math.sin(swimPhase) * 0.028;
  const lungeX = biteAnim * 7.5;
  const stretchX =
    1 +
    Math.sin(swimPhase * 2) * 0.018 +
    (isBoosting ? 0.048 : 0) +
    biteAnim * 0.045;
  const squashY = 1 - Math.sin(swimPhase * 2) * 0.015 + biteAnim * 0.05;
  const swimIntensity =
    isBoosting || frenzyTimer > 0 ? 1.32 : 1.0;

  ctx.rotate(bodyYaw);

  // Pure 48-Form Shark Evolution Body Sprite (No outer circles or bolted-on clutter!)
  const sharkFrame = spriteSheetManager.getSharkFormFrame(sharkForm.spriteKey);
  ctx.save();
  ctx.translate(lungeX, 0);
  ctx.scale(stretchX, squashY);
  if (hitFlashTimer > 0 || morphFlashTimer > 0.55) {
    ctx.filter = 'brightness(1.85) contrast(1.2)';
  } else if (frenzyTimer > 0) {
    ctx.filter = 'sepia(0.85) saturate(3.5) brightness(1.15)';
  }
  drawUndulatingSpriteFrame(
    ctx,
    sharkFrame,
    96,
    swimPhase,
    'SHARK_APEX',
    0,
    0,
    1.0,
    swimIntensity,
    biteAnim
  );
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
 * preserving each species' authentic aspect ratio, upright dorsal orientation, and species-specific biomechanical swimming gait.
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
    isInflated,
    mutationVariant = 'NONE',
  } = prey;
  const effectiveTier = getEffectivePreyTier(config, mutationVariant);
  const canEatWithoutFrenzy = config.isHazard
    ? canEatMines
    : sharkBiteTier >= effectiveTier;
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

  ctx.save();
  ctx.translate(x, y);

  // Pure natural creature rendering — no artificial outer circles or T{N} text labels!
  // Visual Size === Devourability Contract guarantees edible fish are <= 64% of shark size
  // and dangerous predators/hazards are >= 118% of shark size.
  ctx.save();
  const gait = getPreySwimGait(config);

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

  // Species-specific whole-body secondary motion coupled with spinal slice undulation
  const speedMag = Math.hypot(vx, vy);
  const speedRatio = Math.max(
    0.65,
    Math.min(1.65, speedMag / Math.max(25, config.baseSpeed))
  );
  const swimPhase = phase * 3.1;
  const swimRock =
    gait === 'RIGID_PROPULSION'
      ? Math.sin(swimPhase * 0.55) * 0.045
      : Math.sin(swimPhase) * 0.032;
  ctx.rotate(swimRock);

  if (frenzyActive || mutationVariant === 'GOLDEN_MUTANT') {
    ctx.filter = 'sepia(0.85) saturate(3.2) hue-rotate(5deg) brightness(1.15)';
  } else if (mutationVariant === 'ABYSS_BEHEMOTH') {
    ctx.filter = 'hue-rotate(255deg) saturate(1.6) contrast(1.1)';
  }

  const preyFrame = spriteSheetManager.getPreySprite(config);
  const drawSize = r * 2.25;
  drawUndulatingSpriteFrame(
    ctx,
    preyFrame,
    drawSize,
    swimPhase,
    gait,
    0,
    0,
    isInflated ? 1.16 : 1.0,
    speedRatio
  );
  ctx.filter = 'none';
  ctx.restore();

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



