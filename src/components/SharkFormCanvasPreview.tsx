import React, { useEffect, useRef } from 'react';
import { computeSpineSliceDeformation } from '../game/canvasRenderer';
import { getSharkFormById } from '../game/sharkEvolutionConfig';
import { spriteSheetManager } from '../game/spriteSheetManager';

interface SharkFormCanvasPreviewProps {
  sharkId: string;
  width?: number;
  height?: number;
  locked?: boolean;
  animate?: boolean;
}

export const SharkFormCanvasPreview: React.FC<SharkFormCanvasPreviewProps> = ({
  sharkId,
  width = 88,
  height = 56,
  locked = false,
  animate = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    let phase = Math.random() * Math.PI * 2;
    const form = getSharkFormById(sharkId);

    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Subtle glowing backdrop disc
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        4,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.48
      );
      grad.addColorStop(0, locked ? 'rgba(51, 65, 85, 0.32)' : `${form.glowColor}33`);
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const frame = spriteSheetManager.getSharkFormFrame(form.spriteKey);
      if (frame && frame.width > 0 && frame.height > 0) {
        const padX = width * 0.88;
        const padY = height * 0.82;
        const scale = Math.min(padX / frame.width, padY / frame.height);
        const drawW = frame.width * scale;
        const drawH = frame.height * scale;

        ctx.translate(width / 2, height / 2);
        if (locked) {
          ctx.filter = 'brightness(0.55) saturate(0.35) contrast(1.1)';
          ctx.globalAlpha = 0.78;
        }

        if (animate) {
          phase += 0.11;
          ctx.rotate(Math.sin(phase) * 0.024);
          const sliceCount = width >= 120 ? 12 : 8;
          const srcW = frame.width;
          const srcH = frame.height;
          const sliceSrcW = srcW / sliceCount;
          const sliceDstW = drawW / sliceCount;
          const startDstX = -drawW / 2;

          for (let i = 0; i < sliceCount; i++) {
            const t = (i + 0.5) / sliceCount;
            const u = 1 - t;
            const { dy, scaleY } = computeSpineSliceDeformation(
              u,
              phase,
              'SHARK_APEX',
              drawH,
              0.92,
              0
            );
            const sx = i * sliceSrcW;
            const overlapSrc =
              i < sliceCount - 1 ? Math.min(1.2, srcW - (sx + sliceSrcW)) : 0;
            const overlapDst = i < sliceCount - 1 ? 0.75 : 0;
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
        } else {
          ctx.drawImage(frame, -drawW / 2, -drawH / 2, drawW, drawH);
        }
        ctx.filter = 'none';
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
  }, [sharkId, width, height, locked, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="pointer-events-none select-none block"
    />
  );
};
