import React, { useEffect, useRef } from 'react';
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
        const padY = height * 0.86;
        const scale = Math.min(padX / frame.width, padY / frame.height);
        const drawW = frame.width * scale;
        const drawH = frame.height * scale;

        ctx.translate(width / 2, height / 2);
        if (animate) {
          phase += 0.06;
          ctx.rotate(Math.sin(phase) * 0.045);
          const stretch = 1 + Math.sin(phase * 2) * 0.02;
          ctx.scale(stretch, 2 - stretch);
        }

        if (locked) {
          ctx.filter = 'brightness(0.55) saturate(0.35) contrast(1.1)';
          ctx.globalAlpha = 0.78;
        }
        ctx.drawImage(frame, -drawW / 2, -drawH / 2, drawW, drawH);
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
