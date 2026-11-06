import React, { useEffect, useRef, useState } from 'react';
import {
  spriteSheetManager,
  UiBannerKey,
  UiIconKey,
  UiSettingKey,
} from '../game/spriteSheetManager';
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
        referrerPolicy="no-referrer"
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

export type UiBannerButtonVariant = 'green' | 'blue' | 'gold';

const VARIANT_TO_BANNER_KEY: Record<UiBannerButtonVariant, UiBannerKey> = {
  green: 'UI_BAR_BTN_GREEN',
  blue: 'UI_BAR_BTN_BLUE',
  gold: 'UI_BAR_BTN_GOLD',
};

const VARIANT_FALLBACK_BG: Record<UiBannerButtonVariant, string> = {
  green:
    'linear-gradient(90deg, rgba(16,185,129,0.92) 0%, rgba(5,150,105,0.92) 100%)',
  blue: 'linear-gradient(90deg, rgba(14,165,233,0.92) 0%, rgba(3,105,161,0.92) 100%)',
  gold: 'linear-gradient(90deg, rgba(245,158,11,0.92) 0%, rgba(180,83,9,0.92) 100%)',
};

interface UiBannerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: UiBannerButtonVariant;
  dataTestId?: string;
  dataStart?: boolean;
  labelClassName?: string;
}

/**
 * Renders one of the 3 horizontal sci-fi pill buttons from /assets/aistudio/buttons_16e3a0cf.png
 * (Green Cyclone Play / Blue DNA Evolution / Gold Video Ad Clapperboard).
 */
export const UiBannerButton: React.FC<UiBannerButtonProps> = ({
  variant,
  dataTestId,
  dataStart,
  className = '',
  labelClassName = '',
  children,
  disabled,
  ...rest
}) => {
  const [, setReadyTick] = useState<number>(() =>
    spriteSheetManager.uiBannersLoaded ? 1 : 0
  );

  useEffect(() => {
    spriteSheetManager.load();
    return spriteSheetManager.subscribe(() => {
      setReadyTick((t) => t + 1);
    });
  }, []);

  const bannerKey = VARIANT_TO_BANNER_KEY[variant];
  const dataUrl = spriteSheetManager.getUiBannerDataUrl(bannerKey);

  // Green button has both a left cyclone medallion (~31%) and a right play triangle (~12%)
  // Blue & Gold buttons have a left medallion (~31%) and a rounded right cap (~7%)
  const textPaddingClass =
    variant === 'green' ? 'pl-[29%] pr-[15%]' : 'pl-[31%] pr-[7%]';

  return (
    <button
      type="button"
      data-testid={dataTestId}
      data-start={dataStart ? 'true' : undefined}
      disabled={disabled}
      className={`game-btn-spring relative inline-flex items-center justify-center aspect-[410/140] select-none shrink-0 ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:brightness-110 active:scale-96'
      } ${className}`}
      style={
        !dataUrl
          ? {
              background: VARIANT_FALLBACK_BG[variant],
              borderRadius: '9999px',
            }
          : undefined
      }
      {...rest}
    >
      {dataUrl && (
        <img
          src={dataUrl}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none drop-shadow-[0_8px_20px_rgba(2,6,23,0.72)]"
        />
      )}
      <span
        className={`relative z-10 w-full flex items-center justify-center text-center font-display font-extrabold text-white hud-stroke whitespace-nowrap leading-none tracking-wide ${textPaddingClass} ${labelClassName}`}
      >
        {children}
      </span>
    </button>
  );
};

interface UiAvatarDataBarProps {
  /** Content rendered inside the hollow left circular window (e.g. animated SharkFormCanvasPreview) */
  avatarContent: React.ReactNode;
  /** Optional badges, SVG XP ring, or interactive button layered over the left circular ring */
  ringOverlay?: React.ReactNode;
  /** Content rendered inside the right dark-navy angled sci-fi data plate */
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  dataTestId?: string;
  title?: string;
}

/**
 * Renders the top sci-fi Avatar & Data Bar from /assets/aistudio/buttons_16e3a0cf.png
 * (`UI_PLATE_AVATAR_BAR`), placing `avatarContent` inside the hollow left metallic ring
 * and `children` inside the right angled dark-navy data plate.
 */
export const UiAvatarDataBar: React.FC<UiAvatarDataBarProps> = ({
  avatarContent,
  ringOverlay,
  children,
  onClick,
  className = '',
  dataTestId,
  title,
}) => {
  const [, setReadyTick] = useState<number>(() =>
    spriteSheetManager.uiBannersLoaded ? 1 : 0
  );

  useEffect(() => {
    spriteSheetManager.load();
    return spriteSheetManager.subscribe(() => {
      setReadyTick((t) => t + 1);
    });
  }, []);

  const dataUrl = spriteSheetManager.getUiBannerDataUrl('UI_PLATE_AVATAR_BAR');
  const metrics = spriteSheetManager.avatarBarHollowMetrics;

  return (
    <div
      data-testid={dataTestId}
      onClick={onClick}
      title={title}
      className={`relative select-none aspect-[1102/406] ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
      style={
        !dataUrl
          ? {
              background:
                'linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.88) 100%)',
              borderRadius: '9999px',
            }
          : undefined
      }
    >
      {/* Layer 0: Deep-sea circular backdrop & Shark Preview centered in the hollow left ring */}
      <div
        className="absolute rounded-full bg-slate-950/80 flex items-center justify-center overflow-hidden pointer-events-none"
        style={{
          left: `${metrics.cxPct}%`,
          top: `${metrics.cyPct}%`,
          height: `${metrics.innerDiaPctH + 4}%`,
          aspectRatio: '1 / 1',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {avatarContent}
      </div>

      {/* Layer 1: Sliced Sci-Fi Metallic Ring + Dark-Navy Angled Data Plate Sprite */}
      {dataUrl && (
        <img
          src={dataUrl}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none drop-shadow-[0_10px_26px_rgba(2,6,23,0.8)]"
        />
      )}

      {/* Layer 2A: Ring Overlay (XP progress ring, Tier shield badge, Level tag, Atlas click target) */}
      {ringOverlay && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${metrics.cxPct}%`,
            top: `${metrics.cyPct}%`,
            height: `${metrics.outerDiaPctH}%`,
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {ringOverlay}
        </div>
      )}

      {/* Layer 2B: Right Dark-Navy Angled Data Plate Content */}
      <div
        className="absolute z-10 flex flex-col justify-center overflow-hidden"
        style={{
          left: '35.5%',
          right: '11.5%',
          top: '24%',
          bottom: '26%',
        }}
      >
        {children}
      </div>
    </div>
  );
};

interface UiSettingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  settingKey: Exclude<
    UiSettingKey,
    'SETTING_MODAL_FRAME' | 'SETTING_SHARK_CARD'
  >;
  dataTestId?: string;
  dataStart?: boolean;
  customIconKey?: UiIconKey;
  labelClassName?: string;
}

/**
 * Renders one of the 7 sliced octagonal buttons from /assets/aistudio/setting_83a7a273.png
 * (Evolve, Resume, Language, Sound, Tutorial, Restart, Main Menu).
 */
export const UiSettingButton: React.FC<UiSettingButtonProps> = ({
  settingKey,
  dataTestId,
  dataStart,
  customIconKey,
  className = '',
  labelClassName = '',
  children,
  disabled,
  ...rest
}) => {
  const [, setReadyTick] = useState<number>(() =>
    spriteSheetManager.uiSettingsLoaded ? 1 : 0
  );

  useEffect(() => {
    spriteSheetManager.load();
    return spriteSheetManager.subscribe(() => {
      setReadyTick((t) => t + 1);
    });
  }, []);

  const dataUrl = spriteSheetManager.getUiSettingDataUrl(settingKey);
  const customIconUrl = customIconKey
    ? spriteSheetManager.getUiIconDataUrl(customIconKey)
    : undefined;
  const extractedIconUrl =
    customIconUrl ?? spriteSheetManager.getUiSettingIconDataUrl(settingKey);

  // Exact alignment matching setting1.png:
  // - SETTING_BTN_RESUME: dark play triangle is baked at x ~ 38%..41.8%, so text starts at left: 43.4%
  // - SETTING_BTN_EVOLVE: DNA helix is baked at left ~34%, text sits in right 64%
  // - SETTING_BTN_LANG / SOUND / TUTORIAL / RESTART / MAIN_MENU: extracted icon + text centered together as a unit in the middle of the button!
  let alignClass =
    'px-[4%] justify-center gap-[1.15cqw] text-white hud-stroke text-[2.38cqw]';
  if (settingKey === 'SETTING_BTN_RESUME') {
    alignClass =
      'pl-[43.4%] pr-[6%] justify-start text-[#032215] text-[3.45cqw] drop-shadow-[0_1px_2px_rgba(167,243,208,0.88)]';
  } else if (settingKey === 'SETTING_BTN_EVOLVE') {
    alignClass =
      'pl-[36%] pr-[6%] justify-center text-[#041b29] text-[2.3cqw] drop-shadow-[0_1px_1px_rgba(186,230,253,0.85)]';
  } else if (settingKey === 'SETTING_BTN_TUTORIAL') {
    alignClass =
      'px-[4%] justify-center gap-[1.25cqw] text-[#fde68a] hud-stroke text-[2.45cqw]';
  }

  return (
    <button
      type="button"
      data-testid={dataTestId}
      data-start={dataStart ? 'true' : undefined}
      disabled={disabled}
      className={`game-btn-spring relative inline-flex items-center select-none shrink-0 ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:brightness-110 active:scale-97'
      } ${className}`}
      {...rest}
    >
      {dataUrl && (
        <img
          src={dataUrl}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none drop-shadow-[0_4px_12px_rgba(2,6,23,0.72)]"
        />
      )}
      <span
        className={`relative z-10 w-full h-full flex items-center font-display font-extrabold whitespace-nowrap leading-none tracking-wide ${alignClass} ${labelClassName}`}
      >
        {extractedIconUrl &&
          settingKey !== 'SETTING_BTN_RESUME' &&
          settingKey !== 'SETTING_BTN_EVOLVE' && (
            <img
              src={extractedIconUrl}
              alt=""
              referrerPolicy="no-referrer"
              draggable={false}
              className="w-[3.1cqw] h-[3.1cqw] object-contain select-none pointer-events-none shrink-0 drop-shadow-[0_1px_3px_rgba(2,6,23,0.75)]"
            />
          )}
        <span>{children}</span>
      </span>
    </button>
  );
};

interface UiSettingSharkCardProps {
  /** Shark preview rendered inside the left recessed square avatar frame */
  avatarContent: React.ReactNode;
  /** Primary shark name title */
  sharkName: React.ReactNode;
  /** Subtitle (e.g. Body Level Lv.1/10 · Bite T4) */
  subtitle: React.ReactNode;
  /** Right-side Evolve button */
  actionButton: React.ReactNode;
  onClick?: () => void;
  className?: string;
  dataTestId?: string;
}

/**
 * Renders the wide dark-metallic Shark Summary Card (`SETTING_SHARK_CARD`)
 * from /assets/aistudio/setting_83a7a273.png with left square avatar slot,
 * center title/subtitle, and right-aligned Evolve button matching setting1.png.
 */
export const UiSettingSharkCard: React.FC<UiSettingSharkCardProps> = ({
  avatarContent,
  sharkName,
  subtitle,
  actionButton,
  onClick,
  className = '',
  dataTestId,
}) => {
  const [, setReadyTick] = useState<number>(() =>
    spriteSheetManager.uiSettingsLoaded ? 1 : 0
  );

  useEffect(() => {
    spriteSheetManager.load();
    return spriteSheetManager.subscribe(() => {
      setReadyTick((t) => t + 1);
    });
  }, []);

  const dataUrl = spriteSheetManager.getUiSettingDataUrl('SETTING_SHARK_CARD');

  const hasCustomHeight = /\bh-\[/.test(className);

  return (
    <div
      data-testid={dataTestId}
      onClick={onClick}
      className={`relative w-full ${
        hasCustomHeight ? '' : 'h-[23.5%]'
      } shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {dataUrl && (
        <img
          src={dataUrl}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none drop-shadow-[0_6px_16px_rgba(2,6,23,0.78)]"
        />
      )}

      {/* Left Wide Recessed Rectangular Avatar Slot (encloses full horizontal shark inside the recessed frame) */}
      <div
        className="absolute z-10 flex items-center justify-center overflow-hidden pointer-events-none p-[3px]"
        style={{
          left: '2.3%',
          width: '18.8%',
          top: '15.0%',
          bottom: '15.0%',
        }}
      >
        {avatarContent}
      </div>

      {/* Center Shark Name (with purple-magenta neon glow) & Upgrade/Bite Subtitle */}
      <div
        className="absolute z-10 flex flex-col justify-center text-left overflow-hidden"
        style={{
          left: '23.2%',
          right: '23.4%',
          top: '10%',
          bottom: '10%',
        }}
      >
        <div
          className="font-display font-extrabold text-[2.95cqw] text-[#faf5ff] truncate leading-tight"
          style={{
            textShadow:
              '0 0 8px rgba(217, 70, 239, 0.92), 0 0 16px rgba(168, 85, 247, 0.68), 0 2px 3px rgba(2, 6, 23, 0.95)',
          }}
        >
          {sharkName}
        </div>
        <div
          className="font-sans font-bold text-[1.95cqw] text-slate-200 truncate mt-[0.2cqw] leading-tight"
          style={{
            textShadow: '0 1px 3px rgba(2, 6, 23, 0.95)',
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Right Action Slot (SETTING_BTN_EVOLVE) */}
      <div
        className="absolute z-10 flex items-center justify-end"
        style={{
          right: '2.6%',
          top: '18.5%',
          bottom: '18.5%',
          width: '19.0%',
        }}
      >
        {actionButton}
      </div>
    </div>
  );
};

interface UiSettingModalFrameProps {
  title: React.ReactNode;
  children: React.ReactNode;
  variant?: 'pause' | 'revive' | 'settlement';
  headerIconKey?: UiIconKey;
  className?: string;
  dataTestId?: string;
}

/**
 * Renders the outer Sci-Fi Dialog Frame (`SETTING_MODAL_FRAME`)
 * using a responsive container (`aspect-[980/688]`) and CSS Container Query (`cqw`) units
 * so all child rows stay strictly inside the frame in both mobile landscape and portrait modes.
 */
export const UiSettingModalFrame: React.FC<UiSettingModalFrameProps> = ({
  title,
  children,
  variant = 'pause',
  headerIconKey,
  className = '',
  dataTestId,
}) => {
  const [, setReadyTick] = useState<number>(() =>
    spriteSheetManager.uiSettingsLoaded ? 1 : 0
  );

  useEffect(() => {
    spriteSheetManager.load();
    return spriteSheetManager.subscribe(() => {
      setReadyTick((t) => t + 1);
    });
  }, []);

  const dataUrl =
    variant === 'pause'
      ? spriteSheetManager.getUiSettingDataUrl('SETTING_MODAL_FRAME')
      : spriteSheetManager.getUiSettingCleanModalFrameDataUrl() ??
        spriteSheetManager.getUiSettingDataUrl('SETTING_MODAL_FRAME');

  const headerIconUrl = headerIconKey
    ? spriteSheetManager.getUiIconDataUrl(headerIconKey)
    : undefined;

  const isRevive = variant === 'revive';
  const isSettlement = variant === 'settlement';

  return (
    <div
      data-testid={dataTestId}
      className={`relative select-none aspect-[980/688] shrink-0 ${className}`}
      style={{
        width: 'min(460px, 92vw, calc(90dvh * 1.4244))',
        containerType: 'inline-size',
      }}
    >
      {/* Layer 0: Smooth Deep-Sea Dark Navy Interior Backdrop (clipped inside frame border) */}
      <div
        className={`absolute rounded-[2.6cqw] pointer-events-none ${
          isRevive
            ? 'bg-gradient-to-b from-[#211026]/98 via-[#0e1428]/98 to-[#070d1b]/99 shadow-[0_20px_60px_rgba(0,0,0,0.92),0_0_32px_rgba(244,63,94,0.28)]'
            : isSettlement
            ? 'bg-gradient-to-b from-[#101e38]/98 via-[#0b1528]/98 to-[#070e1d]/99 shadow-[0_20px_60px_rgba(0,0,0,0.92),0_0_32px_rgba(245,158,11,0.22)]'
            : 'bg-gradient-to-b from-[#101c35]/97 via-[#0b1528]/98 to-[#070e1d]/98 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_28px_rgba(34,211,238,0.2)]'
        }`}
        style={{
          left: '3.0%',
          right: '3.0%',
          top: '6.0%',
          bottom: '4.0%',
        }}
      />

      {/* Layer 1: Sliced Sci-Fi Neon Metallic Frame + Top Trapezoidal Header Plate */}
      {dataUrl && (
        <img
          src={dataUrl}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none drop-shadow-[0_14px_38px_rgba(2,6,23,0.92)]"
        />
      )}

      {/* Layer 2A: Custom Icon inside Left Circular Header Medallion (for Revive & Settlement) */}
      {variant !== 'pause' && headerIconUrl && (
        <div
          className="absolute z-10 flex items-center justify-center pointer-events-none"
          style={{
            left: '45.6%',
            top: '7.8%',
            height: '6.4%',
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <img
            src={headerIconUrl}
            alt=""
            referrerPolicy="no-referrer"
            draggable={false}
            className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_1px_4px_rgba(2,6,23,0.95)]"
          />
        </div>
      )}

      {/* Layer 2B: Header Title Text positioned right next to the circular medallion inside the top trapezoidal plate */}
      <div
        className="absolute z-10 flex items-center justify-start pointer-events-none"
        style={{
          left: variant === 'pause' ? '49.6%' : '51.2%',
          right: '22%',
          top: '2.2%',
          height: '11.4%',
        }}
      >
        <h2
          className={`font-display font-extrabold text-[4.05cqw] tracking-[0.10em] leading-none whitespace-nowrap ${
            isRevive
              ? 'text-rose-100'
              : isSettlement
              ? 'text-amber-50'
              : 'text-cyan-50'
          }`}
          style={{
            textShadow: isRevive
              ? '0 0 12px rgba(244, 63, 94, 0.92), 0 2px 4px rgba(2, 6, 23, 0.95)'
              : isSettlement
              ? '0 0 12px rgba(251, 191, 36, 0.85), 0 2px 4px rgba(2, 6, 23, 0.95)'
              : '0 0 12px rgba(56, 189, 248, 0.85), 0 2px 4px rgba(2, 6, 23, 0.95)',
          }}
        >
          {title}
        </h2>
      </div>

      {/* Layer 2C: Bounded Interior Flex Container for the modal rows (strictly inside frame borders) */}
      <div
        className="absolute z-10 flex flex-col justify-between overflow-hidden"
        style={{
          left: '6.4%',
          right: '6.4%',
          top: '14.6%',
          height: '78.8%',
        }}
      >
        {children}
      </div>
    </div>
  );
};



