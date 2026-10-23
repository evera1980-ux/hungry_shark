import React, { useEffect, useRef } from 'react';
import { OrganConfig } from '../game/config';
import { drawOrganPart } from '../game/canvasRenderer';
import { spriteSheetManager } from '../game/spriteSheetManager';

interface OrganCanvasPreviewProps {
  organ: OrganConfig;
  size?: number;
}

export const OrganCanvasPreview: React.FC<OrganCanvasPreviewProps> = ({
  organ,
  size = 64,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    spriteSheetManager.load('/assets/aistudio/fish_24bdaa5a.png');
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      phase += 0.08;
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        4,
        size / 2,
        size / 2,
        size * 0.46
      );
      grad.addColorStop(0, `${organ.primaryColor}44`);
      grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(size / 2, size / 2);
      const scale = organ.slot === 'AURA' ? 0.52 : 0.92;
      ctx.scale(scale, scale);
      drawOrganPart(ctx, organ, phase, 0.35 + 0.25 * Math.sin(phase), true);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [organ, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block shrink-0"
      aria-hidden="true"
    />
  );
};
