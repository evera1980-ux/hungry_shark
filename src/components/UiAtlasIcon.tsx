import React, { useEffect, useRef, useState } from 'react';
import { spriteSheetManager, UiIconKey } from '../game/spriteSheetManager';
import type { SharkLineageId } from '../game/sharkEvolutionConfig';

export function getLineageUiIconKey(lineage: SharkLineageId): UiIconKey {
  switch (lineage) {
    case 'APEX_BIO':
      return 'UI_LINEAGE_BIO';
    case 'CYBER_MECHA':
      return 'UI_LINEAGE_MECHA';
    case 'ELEMENTAL_CORE':
      return 'UI_LINEAGE_ELEM';
    case 'ELDER_ABYSS':
      return 'UI_LINEAGE_ABYSS';
  }
}

interface UiAtlasIconProps {
  iconKey: UiIconKey;
  size?: number;
  className?: string;
  alt?: string;
}

export const UiAtlasIcon: React.FC<UiAtlasIconProps> = ({
  iconKey,
  size = 24,
  className = '',
  alt = '',
}) => {
  const [readyTick, setReadyTick] = useState<number>(() =>
    spriteSheetManager.uiIconsLoaded ? 1 : 0
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    spriteSheetManager.load();
    return spriteSheetManager.subscribe(() => {
      setReadyTick((t) => t + 1);
    });
  }, []);

  const dataUrl = spriteSheetManager.getUiIconDataUrl(iconKey);

  useEffect(() => {
    if (dataUrl) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const frame = spriteSheetManager.getUiIconFrame(iconKey);
    if (frame) {
      ctx.drawImage(frame, 0, 0, cvs.width, cvs.height);
    }
  }, [iconKey, readyTick, dataUrl]);

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        className={`select-none pointer-events-none object-contain shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      aria-label={alt}
      className={`select-none pointer-events-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
