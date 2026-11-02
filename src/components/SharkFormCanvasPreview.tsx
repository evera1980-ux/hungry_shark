import React, { useEffect, useRef } from 'react';
import {
  computeSpineSliceDeformation,
  getPrebakedTintedFrame,
} from '../game/canvasRenderer';
import { getSharkFormById } from '../game/sharkEvolutionConfig';
import { spriteSheetManager } from '../game/spriteSheetManager';

interface SharkFormCanvasPreviewProps {
  sharkId: string;
  width?: number;
  height?: number;
  locked?: boolean;
  animate?: boolean;
  heroStage?: boolean;
  className?: string;
}

export const SharkFormCanvasPreview: React.FC<SharkFormCanvasPreviewProps> = ({
  sharkId,
  width = 88,
  height = 56,
  locked = false,
  animate = false,
  heroStage = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    let phase = heroStage ? 0.4 : Math.random() * Math.PI * 2;
    const form = getSharkFormById(sharkId);

    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        canvas.width !== Math.round(width * dpr) ||
        canvas.height !== Math.round(height * dpr)
      ) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (heroStage) {
        // 1. Deep-Sea Bioluminescent & Sunlit Aura Backdrop
        const auraGrad = ctx.createRadialGradient(
          width * 0.52,
          height * 0.5,
          12,
          width * 0.52,
          height * 0.5,
          width * 0.46
        );
        auraGrad.addColorStop(0, `${form.glowColor}44`);
        auraGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.14)');
        auraGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = auraGrad;
        ctx.fillRect(0, 0, width, height);

        // 2. Crescent Hydro-Vortex Water Swirl Behind & Around Tail Fin
        ctx.save();
        const swirlCx = width * 0.34;
        const swirlCy = height * 0.54;
        const swirlRx = width * 0.24;
        const swirlRy = height * 0.39;

        // Outer soft cyan hydro wake arc
        for (let ring = 0; ring < 4; ring++) {
          const rScale = 0.84 + ring * 0.08;
          const startAng = Math.PI * (0.58 - ring * 0.04) + Math.sin(phase * 0.7 + ring) * 0.05;
          const endAng = Math.PI * (1.42 + ring * 0.03) + Math.cos(phase * 0.6 + ring) * 0.05;

          ctx.save();
          ctx.translate(swirlCx, swirlCy);
          ctx.rotate(-0.12);
          ctx.scale(swirlRx * rScale, swirlRy * rScale);

          ctx.beginPath();
          ctx.arc(0, 0, 1, startAng, endAng, false);
          ctx.restore();

          ctx.strokeStyle =
            ring === 1
              ? 'rgba(224, 242, 254, 0.78)'
              : ring === 2
              ? 'rgba(125, 211, 252, 0.55)'
              : 'rgba(56, 189, 248, 0.32)';
          ctx.lineWidth = ring === 1 ? 3.2 : ring === 2 ? 2.2 : 1.4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Sparkling water droplets & micro-bubbles along the hydro-vortex
        for (let b = 0; b < 22; b++) {
          const prog = ((b / 22 + phase * 0.045) % 1);
          const ang = Math.PI * (0.52 + prog * 1.02);
          const radialOffset = ((b * 17) % 19) - 9;
          const bx =
            swirlCx +
            Math.cos(ang - 0.12) * (swirlRx + radialOffset * 1.4);
          const by =
            swirlCy +
            Math.sin(ang - 0.12) * (swirlRy + radialOffset * 0.9);
          const bRadius = 1.2 + ((b * 7) % 4) * 0.75;
          const bAlpha = Math.sin(prog * Math.PI) * 0.82;

          ctx.fillStyle =
            b % 3 === 0
              ? `rgba(255, 255, 255, ${bAlpha.toFixed(2)})`
              : `rgba(186, 230, 253, ${(bAlpha * 0.85).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        // Subtle glowing backdrop disc for compact avatars/cards
        const grad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          4,
          width / 2,
          height / 2,
          Math.max(width, height) * 0.48
        );
        grad.addColorStop(
          0,
          locked ? 'rgba(51, 65, 85, 0.32)' : `${form.glowColor}33`
        );
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      const rawFrame = spriteSheetManager.getSharkFormFrame(form.spriteKey);
      const frame = getPrebakedTintedFrame(rawFrame, locked ? 'LOCKED' : 'NONE');
      if (frame && frame.width > 0 && frame.height > 0) {
        const padX = width * (heroStage ? 0.86 : 0.88);
        const padY = height * (heroStage ? 0.9 : 0.82);
        const scale = Math.min(padX / frame.width, padY / frame.height);
        const drawW = frame.width * scale;
        const drawH = frame.height * scale;

        const floatY = heroStage ? Math.sin(phase * 0.65) * 3.5 : 0;
        ctx.translate(width * (heroStage ? 0.52 : 0.5), height / 2 + floatY);
        if (locked) {
          ctx.globalAlpha = 0.78;
        }

        if (animate) {
          phase += heroStage ? 0.065 : 0.11;
          ctx.rotate(Math.sin(phase) * (heroStage ? 0.016 : 0.024));
          const sliceCount = heroStage ? 18 : width >= 120 ? 12 : 8;
          const srcW = frame.width;
          const srcH = frame.height;
          const sliceSrcW = srcW / sliceCount;
          const sliceDstW = drawW / sliceCount;
          const startDstX = -drawW / 2;

          if (heroStage) {
            ctx.shadowColor = form.glowColor;
            ctx.shadowBlur = 18;
          }

          for (let i = 0; i < sliceCount; i++) {
            const t = (i + 0.5) / sliceCount;
            const u = 1 - t;
            const { dy, scaleY } = computeSpineSliceDeformation(
              u,
              phase,
              'SHARK_APEX',
              drawH,
              heroStage ? 0.72 : 0.92,
              0
            );
            const sx = i * sliceSrcW;
            const overlapSrc =
              i < sliceCount - 1 ? Math.min(1.5, srcW - (sx + sliceSrcW)) : 0;
            const overlapDst = i < sliceCount - 1 ? 0.95 : 0;
            const dh = drawH * scaleY;
            ctx.drawImage(
              frame,
              sx,
              0,
              sliceSrcW + overlapSrc,
              srcH,
              startDstX + i * sliceDstW,
              dy - dh / 2,
              sliceDstW + overlapDst,
              dh
            );
          }

          if (heroStage) {
            ctx.shadowBlur = 0;
            // Foreground water stream wisps crossing over the lower tail/body
            ctx.strokeStyle = 'rgba(224, 242, 254, 0.52)';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-drawW * 0.36, drawH * 0.18 + Math.sin(phase) * 4);
            ctx.quadraticCurveTo(
              -drawW * 0.12,
              drawH * 0.32,
              drawW * 0.14,
              drawH * 0.22 + Math.cos(phase) * 3
            );
            ctx.stroke();
          }
        } else {
          ctx.drawImage(frame, -drawW / 2, -drawH / 2, drawW, drawH);
        }
      }

      ctx.restore();

      if (animate) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    const timer = window.setTimeout(renderFrame, 280);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.clearTimeout(timer);
    };
  }, [sharkId, width, height, locked, animate, heroStage]);

  return (
    <canvas
      ref={canvasRef}
      style={
        className
          ? undefined
          : { width: `${width}px`, height: `${height}px` }
      }
      className={`pointer-events-none select-none block ${className}`}
    />
  );
};
