import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lang } from '../../game/i18n';
import { SharkFormConfig } from '../../game/sharkEvolutionConfig';
import {
  BindMultiTouchFn,
  GameState,
  HudStateSnapshot,
  SharkSimState,
  TutorialStep,
} from '../../game/sim/types';
import { SharkFormCanvasPreview } from '../SharkFormCanvasPreview';
import {
  getLineageUiIconKey,
  UiAtlasIcon,
  UiAvatarDataBar,
} from '../UiAtlasIcon';

export interface InGameHudOverlayProps {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  gameState: GameState;
  gameStateRef: React.MutableRefObject<GameState>;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  setShowAtlasModal: React.Dispatch<React.SetStateAction<boolean>>;
  showDebugPanel: boolean;
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>;
  tutorialStep: TutorialStep;
  tutorialEatProgress: number;
  skipTutorialOnboarding: () => void;
  hudState: HudStateSnapshot;
  hpBarFillRef: React.RefObject<HTMLDivElement | null>;
  hpGhostFillRef: React.RefObject<HTMLDivElement | null>;
  energyBarFillRef: React.RefObject<HTMLDivElement | null>;
  xpBarFillRef: React.RefObject<HTMLDivElement | null>;
  joystickKnobRef: React.RefObject<HTMLDivElement | null>;
  joystickVisual: { active: boolean; dx: number; dy: number };
  boostVisual: boolean;
  setBoostVisual: React.Dispatch<React.SetStateAction<boolean>>;
  simRef: React.MutableRefObject<SharkSimState>;
  handleUpgradeSharkForm: (sharkId: string) => void;
  handleInRunBreakthroughOrAtlas: () => void;
  handleGoldOverdrive: () => void;
  handleGeneSurge: () => void;
  handleSupplyDropAd: () => void;
  supplyDropReward: { coins: number; genes: number };
  handleJoystickPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleJoystickPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleJoystickPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  bindMultiTouchButton: BindMultiTouchFn;
  activeHudSharkForm: SharkFormConfig;
  nextEvoTargetForm: SharkFormConfig | null;
}

export const InGameHudOverlay: React.FC<InGameHudOverlayProps> = ({
  lang,
  t,
  gameState,
  gameStateRef,
  setGameState,
  setShowAtlasModal,
  showDebugPanel,
  setShowDebugPanel,
  tutorialStep,
  tutorialEatProgress,
  skipTutorialOnboarding,
  hudState,
  hpBarFillRef,
  hpGhostFillRef,
  energyBarFillRef,
  xpBarFillRef,
  joystickKnobRef,
  joystickVisual,
  boostVisual,
  setBoostVisual,
  simRef,
  handleUpgradeSharkForm,
  handleInRunBreakthroughOrAtlas,
  handleGoldOverdrive,
  handleGeneSurge,
  handleSupplyDropAd,
  supplyDropReward,
  handleJoystickPointerDown,
  handleJoystickPointerMove,
  handleJoystickPointerUp,
  bindMultiTouchButton,
  activeHudSharkForm,
  nextEvoTargetForm,
}) => {
  return (
      <AnimatePresence>
        {gameState !== 'title' && (
          <motion.div
            key="playing-hud"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="landscape-compact-pad fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-1.5 sm:p-2.5 md:p-3.5"
          >
            {/* ==================== TOP PERIMETER RIBBON (ZERO-OVERLAP TWO-ROW RESPONSIVE HUD) ==================== */}
            <div className="flex flex-col gap-1.5 w-full">
              {/* Row 1: Top-Left Avatar & Bars (-30% size) + Top-Center Score/Telemetry Pill (Moved Up & Centered) + Top-Right Pause */}
              <div className="relative flex items-start justify-between gap-1.5 w-full">
                {/* 1. Top-Left: Sliced Sci-Fi Avatar Data Bar (-30% size: 151px / 193px / 217px) */}
                <motion.div
                  initial={{ opacity: 0, x: -24, y: -8 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -24, y: -8 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  className="pointer-events-auto shrink-0"
                >
                  <UiAvatarDataBar
                    dataTestId="hud-avatar-data-bar"
                    className="w-[151px] sm:w-[178px] lg:w-[217px]"
                    avatarContent={
                      <SharkFormCanvasPreview
                        sharkId={activeHudSharkForm.id}
                        width={29}
                        height={20}
                      />
                    }
                    ringOverlay={
                      <button
                        type="button"
                        data-testid="hud-open-atlas-btn"
                        {...bindMultiTouchButton(() => setShowAtlasModal(true))}
                        title={
                          lang === 'zh'
                            ? `点击打开进化图谱 (${hudState.unlockedFormsCount}/48)`
                            : `Open Evolution Atlas (${hudState.unlockedFormsCount}/48)`
                        }
                        className="game-btn-spring relative w-full h-full flex items-center justify-center rounded-full cursor-pointer touch-manipulation group"
                      >
                        {/* Circular Purple XP Ring around the Hollow Avatar Window */}
                        <svg
                          viewBox="0 0 64 64"
                          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                          aria-hidden="true"
                        >
                          <circle
                            cx="32"
                            cy="32"
                            r="29"
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeDasharray="182.2"
                            strokeDashoffset={
                              182.2 -
                              (182.2 *
                                Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (hudState.xp /
                                      Math.max(1, hudState.xpToNext)) *
                                      100
                                  )
                                )) /
                                100
                            }
                          />
                        </svg>

                        {/* Bottom-Left Bite Tier Shield Badge (T1..T8) */}
                        <div className="absolute -bottom-0.5 -left-0.5 z-20 flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4">
                          <UiAtlasIcon
                            iconKey="UI_BADGE_TIER"
                            size={15}
                            className="absolute inset-0"
                          />
                          <span className="relative z-10 font-mono-num font-black text-[6px] sm:text-[7px] text-amber-200 hud-stroke leading-none">
                            T{hudState.biteTier}
                          </span>
                        </div>

                        {/* Bottom-Right In-Run Level Tag */}
                        <span className="absolute -bottom-0.5 -right-0.5 z-20 px-1 py-0.2 rounded-full bg-purple-950/95 font-mono-num font-black text-[5.5px] sm:text-[6.5px] text-purple-200 shadow leading-none">
                          Lv.{hudState.level}
                        </span>

                        {/* Top-Right Mini Atlas Collection Counter */}
                        <span
                          className={`absolute -top-0.5 -right-0.5 z-20 px-1 py-0.2 rounded-full font-display font-extrabold text-[5.5px] sm:text-[6.5px] leading-none whitespace-nowrap shadow transition-all ${
                            tutorialStep === 'CELEBRATE'
                              ? 'bg-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.95)] scale-110 animate-bounce'
                              : 'bg-slate-950/90 text-sky-200'
                          }`}
                        >
                          {lang === 'zh' ? '图谱' : 'Atlas'}{' '}
                          {hudState.unlockedFormsCount}/48
                        </span>
                      </button>
                    }
                  >
                    {/* Right Angled Dark-Navy Data Plate: Shark Name + Skewed HP & Boost Bars */}
                    <div className="flex flex-col justify-between h-full gap-0.5 py-0.2">
                      <div className="flex items-center justify-between text-[6.5px] sm:text-[7.5px] lg:text-[8.5px] font-display font-extrabold text-white hud-stroke leading-none px-0.5 min-w-0">
                        <span className="truncate flex items-center gap-0.5 min-w-0">
                          <UiAtlasIcon
                            iconKey={getLineageUiIconKey(
                              activeHudSharkForm.lineage
                            )}
                            size={8}
                          />
                          <span className="truncate">
                            {lang === 'zh'
                              ? activeHudSharkForm.nameZh
                              : activeHudSharkForm.nameEn}
                          </span>
                        </span>
                        <span className="font-mono-num text-amber-300 shrink-0 ml-0.5">
                          Lv.{hudState.activeUpgradeLevel}
                        </span>
                      </div>

                      {/* Skewed HP Bar with Delayed Damage Ghost Fill */}
                      <div className="relative h-1.5 sm:h-2 lg:h-2.5 w-full bg-slate-950/85 -skew-x-12 rounded-sm overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
                        <div
                          ref={hpGhostFillRef}
                          className="absolute inset-y-0 left-0 w-full bg-rose-500/80 origin-left"
                          style={{ transform: 'scaleX(1)' }}
                        />
                        <div
                          ref={hpBarFillRef}
                          className="relative h-full w-full bg-gradient-to-r from-emerald-500 to-emerald-300 origin-left"
                          style={{ transform: 'scaleX(1)' }}
                        />
                        <span className="absolute inset-0 flex items-center justify-end pr-0.5 text-[5.5px] sm:text-[6.5px] font-mono-num font-extrabold text-white hud-stroke leading-none skew-x-12">
                          {hudState.hp}/{hudState.maxHp}
                        </span>
                      </div>

                      {/* Skewed Boost Energy Bar */}
                      <div className="relative h-1 sm:h-1.5 w-[90%] bg-slate-950/85 -skew-x-12 rounded-sm overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                        <div
                          ref={energyBarFillRef}
                          className="h-full w-full bg-gradient-to-r from-sky-500 to-cyan-300 origin-left"
                          style={{ transform: 'scaleX(1)' }}
                        />
                      </div>

                      {/* Hidden DOM ref for legacy XP bar sync safety */}
                      <div ref={xpBarFillRef} className="hidden" />
                    </div>
                  </UiAvatarDataBar>
                </motion.div>

                {/* 2. Top-Center: Score & Telemetry Strip (Top edge aligned with straight horizontal top edge of Avatar Data Bar at 15.5% height) */}
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 28,
                    delay: 0.01,
                  }}
                  data-testid="hud-telemetry-pill"
                  className="pointer-events-auto shrink-0 mx-auto sm:mx-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2 mt-[8.5px] sm:mt-0 sm:top-[15.5%] px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-slate-950/65 flex items-center gap-1.5 sm:gap-2.5 lg:gap-3.5 shadow-[0_4px_16px_rgba(2,6,23,0.55)]"
                >
                  {/* Score + Mastery Crown + Hunting Heat */}
                  <div
                    className="flex items-center gap-0.5 sm:gap-1 shrink-0"
                    title={
                      lang === 'zh'
                        ? `${t('hud_score')} · 狩猎热度 Lv.${hudState.heatLevel} (磁吸+${hudState.heatLevel * 16}px / 能量恢复+${(hudState.heatLevel * 2.2).toFixed(1)}/s)`
                        : `${t('hud_score')} · Hunting Heat Lv.${hudState.heatLevel} (Magnet +${hudState.heatLevel * 16}px / Regen +${(hudState.heatLevel * 2.2).toFixed(1)}/s)`
                    }
                  >
                    <UiAtlasIcon iconKey="UI_ICON_SCORE_TROPHY" size={13} />
                    <span className="font-display font-extrabold text-[10px] sm:text-xs lg:text-sm text-white font-mono-num hud-stroke leading-none">
                      {hudState.score}
                    </span>
                    {hudState.masteryCrownTier > 0 && (
                      <span className="text-[10px] leading-none">
                        {hudState.masteryCrownTier === 3
                          ? '👑'
                          : hudState.masteryCrownTier === 2
                          ? '🥈'
                          : '🥉'}
                      </span>
                    )}
                    {hudState.heatLevel > 0 && (
                      <span className="px-1 py-0.2 rounded bg-orange-500/35 text-orange-200 font-mono-num font-black text-[8px] leading-none">
                        H{hudState.heatLevel}
                      </span>
                    )}
                  </div>

                  {/* Genes */}
                  <div
                    className="flex items-center gap-0.5 sm:gap-1 shrink-0"
                    title={t('hud_genes')}
                  >
                    <UiAtlasIcon iconKey="UI_ICON_GENE" size={13} />
                    <span className="font-display font-bold text-[10px] sm:text-xs lg:text-sm text-emerald-300 font-mono-num hud-stroke leading-none">
                      {hudState.genes}
                    </span>
                  </div>

                  {/* Coins */}
                  <div
                    className="flex items-center gap-0.5 sm:gap-1 shrink-0"
                    title={t('hud_coins')}
                  >
                    <UiAtlasIcon iconKey="UI_ICON_COIN" size={13} />
                    <span className="font-display font-bold text-[10px] sm:text-xs lg:text-sm text-amber-300 font-mono-num hud-stroke leading-none">
                      {hudState.coins}
                    </span>
                  </div>

                  {/* Depth */}
                  <div
                    className="flex items-center gap-0.5 sm:gap-1 shrink-0"
                    title={t(hudState.zoneKey)}
                  >
                    <UiAtlasIcon iconKey="UI_ICON_DEPTH" size={13} />
                    <span className="font-mono-num font-bold text-[10px] sm:text-xs lg:text-sm text-sky-200 hud-stroke leading-none">
                      {hudState.depth}m
                    </span>
                  </div>

                  {/* Compact Bounty Target Badge (visible on tablet/desktop) */}
                  <div
                    className="hidden md:flex items-center gap-1 pl-1.5 border-l border-white/10 shrink-0"
                    title={t('hud_target_fish')}
                  >
                    <UiAtlasIcon iconKey="UI_ICON_BOUNTY_TARGET" size={13} />
                    <span className="font-display font-bold text-[11px] lg:text-xs text-cyan-200 hud-stroke whitespace-nowrap leading-none flex items-center gap-1">
                      <span className="max-w-[130px] lg:max-w-none truncate">
                        {t(hudState.targetFishNameKey)}
                        <span className="text-[10px] text-cyan-300/80 font-normal ml-1">
                          ({hudState.targetFishLengthCm}cm · {hudState.targetFishSpeed}px/s)
                        </span>
                      </span>
                      <span className="font-mono-num text-amber-300 shrink-0">
                        {hudState.targetFishProgress}/
                        {hudState.targetFishRequired}
                      </span>
                    </span>
                  </div>
                </motion.div>

                {/* 3. Top-Right: Compact Pause Medallion */}
                <motion.div
                  initial={{ opacity: 0, x: 24, y: -8 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 24, y: -8 }}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 28,
                    delay: 0.02,
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0"
                >
                  {/* Compact Debug Panel Toggle Pill (Hidden by default per configuration; code retained) */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="hud-toggle-debug-btn"
                    {...bindMultiTouchButton(() =>
                      setShowDebugPanel((prev) => !prev)
                    )}
                    title={
                      lang === 'zh'
                        ? '打开/收起实时调参面板 (Debug)'
                        : 'Toggle Live Debug Panel'
                    }
                    className={`hidden game-btn-spring px-2.5 py-1 rounded-full font-display font-extrabold text-[10px] sm:text-xs items-center gap-1 cursor-pointer touch-manipulation shrink-0 shadow ${
                      showDebugPanel
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-950/75 text-cyan-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🛠</span>
                    <span className="hidden sm:inline">
                      {lang === 'zh' ? '调参' : 'Debug'}
                    </span>
                  </button>

                  {/* Single Compact Pause Medallion */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="hud-pause-btn"
                    {...bindMultiTouchButton(() => setGameState('paused'))}
                    aria-label={t('btn_pause')}
                    title={`${t('btn_pause')} [P]`}
                    className="game-btn-spring relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer touch-manipulation opacity-85 hover:opacity-100 shrink-0"
                  >
                    <UiAtlasIcon iconKey="UI_ICON_PAUSE" size={34} />
                  </button>
                </motion.div>
              </div>

              {/* Row 2: Full-Width Centered Contextual Strip (Combo / Frenzy + 3-Step Onboarding Banner, Zero Squishing) */}
              <div className="flex flex-col items-center gap-1 w-full">
                <div className="flex flex-wrap items-center justify-center gap-1.5 pointer-events-auto">
                  <AnimatePresence>
                    {hudState.comboCount >= 2 && (
                      <motion.div
                        key="combo-badge"
                        initial={{ opacity: 0, scale: 0.75 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.75 }}
                        className="px-2 py-0.5 rounded-full bg-orange-500 text-slate-950 font-display font-extrabold text-[10px] font-mono-num flex items-center gap-1 shadow whitespace-nowrap"
                      >
                        <UiAtlasIcon iconKey="UI_ICON_COMBO_FIRE" size={13} />
                        <span>
                          {hudState.comboCount}x (
                          {hudState.comboMultiplier.toFixed(1)}x)
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {hudState.frenzyTimer > 0 && (
                      <motion.div
                        key="frenzy-badge"
                        initial={{ opacity: 0, scale: 0.75 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.75 }}
                        className="animate-frenzy-glow px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-display font-extrabold text-[10px] font-mono-num flex items-center gap-1 whitespace-nowrap"
                      >
                        <UiAtlasIcon iconKey="UI_BTN_GOLD_FRENZY" size={14} />
                        <span>{hudState.frenzyTimer.toFixed(1)}s</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Non-Blocking 3-Step Hands-On Onboarding Banner (Full-Width Centered, Never Overlaps Top Bar) */}
                <AnimatePresence mode="wait">
                  {tutorialStep !== 'DONE' && (
                    <motion.div
                      key={tutorialStep}
                      data-testid="onboarding-tutorial-banner"
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 28,
                      }}
                      className={`pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-full shadow-lg max-w-[96vw] sm:max-w-lg ${
                        tutorialStep === 'HANDS_ON_UPGRADE'
                          ? 'bg-amber-950/90 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                          : tutorialStep === 'CELEBRATE'
                          ? 'bg-emerald-950/90 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                          : 'bg-slate-950/88 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                      }`}
                    >
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded-full font-mono-num font-black text-[9px] leading-none ${
                          tutorialStep === 'HANDS_ON_UPGRADE'
                            ? 'bg-amber-400 text-slate-950'
                            : tutorialStep === 'CELEBRATE'
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-cyan-400 text-slate-950'
                        }`}
                      >
                        {tutorialStep === 'EAT_SMALL_FISH'
                          ? `1/3`
                          : tutorialStep === 'HOLD_BOOST'
                          ? `2/3`
                          : tutorialStep === 'HANDS_ON_UPGRADE'
                          ? `3/3`
                          : `🎉`}
                      </span>

                      <span className="text-[11px] sm:text-xs font-display font-bold text-white leading-snug">
                        {tutorialStep === 'EAT_SMALL_FISH' &&
                          (lang === 'zh'
                            ? `拖动左下摇杆（或触屏滑动），吞食比你小的鱼 (${tutorialEatProgress}/3)`
                            : `Drag Joystick (or swipe) to eat smaller fish (${tutorialEatProgress}/3)`)}
                        {tutorialStep === 'HOLD_BOOST' &&
                          (lang === 'zh'
                            ? '按住右下【冲刺】键（或空格键）加速捕猎，还能撞碎刺豚与水雷！'
                            : 'Hold [Boost] button (or Spacebar) to dash & smash spiky hazards!')}
                        {tutorialStep === 'HANDS_ON_UPGRADE' &&
                          (lang === 'zh'
                            ? '🎁 已赠新手补给！立即点击右下发光的【强化】或【突破】升级鲨鱼！'
                            : '🎁 Starter Gift granted! Tap glowing [UPG] or [Surge] on bottom-right!')}
                        {tutorialStep === 'CELEBRATE' &&
                          (lang === 'zh'
                            ? '太棒了！点击左上角头像可随时打开【48阶进化图谱】，向深海进发吧！'
                            : 'Awesome! Tap the Top-Left Avatar anytime to open the [48-Shark Atlas]!')}
                      </span>

                      <button
                        type="button"
                        data-testid="onboarding-skip-btn"
                        {...bindMultiTouchButton(skipTutorialOnboarding)}
                        className="shrink-0 ml-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-display font-semibold text-slate-200 hover:text-white cursor-pointer"
                      >
                        {tutorialStep === 'CELEBRATE'
                          ? lang === 'zh'
                            ? '明白'
                            : 'Got it'
                          : lang === 'zh'
                          ? '跳过'
                          : 'Skip'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Non-Blocking Deep-Dive Guidance Cue for Giant Sharks in Prey-Depleted Shallow Zones */}
                <AnimatePresence>
                  {tutorialStep === 'DONE' &&
                    hudState.deepDivePromptMeters !== null && (
                      <motion.div
                        key="deep-dive-cue"
                        data-testid="hud-deep-dive-cue"
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.24 }}
                        className="pointer-events-none flex flex-col items-center px-3.5 py-1.5 rounded-xl bg-slate-950/78 border border-cyan-400/40 shadow-[0_6px_22px_rgba(8,145,178,0.32)] backdrop-blur-sm max-w-[92vw]"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-display font-extrabold text-cyan-200 hud-stroke leading-tight">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-3.5 h-3.5 text-cyan-300 animate-bounce shrink-0"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 3a.75.75 0 01.75.75v9.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3.75A.75.75 0 0110 3z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>
                            {t('hud_deep_dive_cue', {
                              depth: hudState.deepDivePromptMeters,
                            })}
                          </span>
                        </div>
                        <span className="text-[9.5px] sm:text-[10.5px] font-display font-medium text-sky-300/85 leading-snug mt-0.5 text-center">
                          {t('hud_deep_dive_sub')}
                        </span>
                      </motion.div>
                    )}
                </AnimatePresence>
              </div>
            </div>

            {/* ==================== BOTTOM PERIMETER ROW: ERGONOMIC SONAR JOYSTICK + 90° RADIAL SKILL FAN AROUND BOOST ==================== */}
            <div className="flex items-end justify-between w-full">
              {/* Bottom-Left: Translucent Sonar Compass Virtual Joystick (Ergonomically Shifted Right & Up, Zero React Re-render DOM Direct) */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                role="slider"
                aria-label="Virtual Steering Joystick"
                aria-valuenow={Math.round(joystickVisual.dx)}
                onPointerDown={handleJoystickPointerDown}
                onPointerMove={handleJoystickPointerMove}
                onPointerUp={handleJoystickPointerUp}
                onPointerCancel={handleJoystickPointerUp}
                className={`landscape-thumb-joy hud-joystick-ergonomic relative w-22 h-22 sm:w-26 sm:h-26 md:w-28 md:h-28 rounded-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing touch-none ${
                  tutorialStep === 'EAT_SMALL_FISH'
                    ? 'ring-2 ring-cyan-300/90 shadow-[0_0_20px_rgba(34,211,238,0.65)]'
                    : ''
                }`}
              >
                {tutorialStep === 'EAT_SMALL_FISH' && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-display font-black text-[9px] whitespace-nowrap shadow animate-bounce pointer-events-none">
                    {lang === 'zh' ? '🕹️ 拖动摇杆' : '🕹️ Drag Here'}
                  </span>
                )}
                {/* @3x High-DPI SDF Sonar Compass Joystick Base Ring (Translucent with zero white fringe) */}
                <UiAtlasIcon
                  iconKey="UI_JOYSTICK_BASE"
                  size={112}
                  className="absolute inset-0 w-full h-full opacity-85 pointer-events-none drop-shadow-[0_4px_12px_rgba(2,6,23,0.55)]"
                />
                {/* @3x High-DPI SDF Aqua-Crystal Orb Thumb Knob */}
                <div
                  ref={joystickKnobRef}
                  className="relative z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center pointer-events-none"
                  style={{
                    transform: 'translate3d(0px, 0px, 0)',
                  }}
                >
                  <UiAtlasIcon
                    iconKey="UI_JOYSTICK_KNOB"
                    size={48}
                    className="w-full h-full drop-shadow-[0_3px_8px_rgba(2,6,23,0.65)]"
                  />
                </div>
              </motion.div>

              {/* Bottom-Right: 90° Quarter-Circle MOBA Skill Fan Centered Around Primary Boost Medallion */}
              {(() => {
                const showUpgBtn =
                  !hudState.trialActive && hudState.activeUpgradeLevel < 10;
                const showEvoBtn = Boolean(
                  hudState.canBreakthroughNow && nextEvoTargetForm
                );
                const fanSlotCount =
                  2 + (showUpgBtn ? 1 : 0) + (showEvoBtn ? 1 : 0);

                // Compute polar angle (in degrees, where 0° = directly left of Boost, 90° = directly above Boost)
                const getFanSlotStyle = (
                  slotIdx: number,
                  totalSlots: number
                ): React.CSSProperties => {
                  let deg = 45;
                  if (totalSlots === 2) {
                    deg = slotIdx === 0 ? 18 : 72;
                  } else if (totalSlots === 3) {
                    deg = slotIdx === 0 ? 4 : slotIdx === 1 ? 45 : 86;
                  } else {
                    const angles = [2, 31, 60, 88];
                    deg = angles[slotIdx] ?? 45;
                  }
                  const rad = (deg * Math.PI) / 180;
                  const cosVal = Math.cos(rad).toFixed(4);
                  const sinVal = Math.sin(rad).toFixed(4);
                  return {
                    width: 'var(--sat-size)',
                    height: 'var(--sat-size)',
                    right: `calc(var(--boost-half) + var(--fan-radius) * ${cosVal} - var(--sat-half))`,
                    bottom: `calc(var(--boost-half) + var(--fan-radius) * ${sinVal} - var(--sat-half))`,
                  };
                };

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                    data-testid="hud-skill-fan"
                    data-fan-count={fanSlotCount}
                    className="hud-skill-fan-container relative pointer-events-auto shrink-0"
                  >
                    {/* Satellite Slot #0 (Bottom-Left of Arc): Gold Frenzy Overdrive Medallion */}
                    <button
                      type="button"
                      data-testid="inrun-gold-frenzy-btn"
                      disabled={
                        hudState.frenzyTimer > 0 ||
                        hudState.coins < hudState.goldOverdriveCost
                      }
                      {...bindMultiTouchButton(
                        handleGoldOverdrive,
                        hudState.frenzyTimer > 0 ||
                          hudState.coins < hudState.goldOverdriveCost
                      )}
                      title={t('btn_gold_overdrive', {
                        cost: hudState.goldOverdriveCost,
                      })}
                      style={getFanSlotStyle(0, fanSlotCount)}
                      className={`game-btn-spring absolute rounded-full flex items-center justify-center transition-all touch-manipulation ${
                        hudState.frenzyTimer <= 0 &&
                        hudState.coins >= hudState.goldOverdriveCost
                          ? 'cursor-pointer opacity-100 scale-100'
                          : 'cursor-not-allowed opacity-50 scale-95'
                      }`}
                    >
                      <svg
                        viewBox="0 0 48 48"
                        className="absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)] -rotate-90 pointer-events-none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="24"
                          cy="24"
                          r="22"
                          fill="none"
                          stroke="rgba(251, 191, 36, 0.25)"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="22"
                          fill="none"
                          stroke="#fde047"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="138.2"
                          strokeDashoffset={
                            138.2 -
                            138.2 *
                              Math.min(
                                1,
                                hudState.goldenMutantCharge /
                                  Math.max(1, hudState.goldenMutantRequired)
                              )
                          }
                        />
                      </svg>
                      <UiAtlasIcon
                        iconKey="UI_BTN_GOLD_FRENZY"
                        size={42}
                        className="w-full h-full drop-shadow"
                      />
                      <span className="absolute -bottom-1 px-1 py-0.5 rounded-full bg-slate-950/92 text-amber-300 font-display font-extrabold text-[7px] flex items-center gap-0.5 shadow leading-none whitespace-nowrap">
                        <span>{lang === 'zh' ? '狂暴' : 'Frenzy'}</span>
                        <UiAtlasIcon iconKey="UI_ICON_COIN" size={8} />
                        <span className="font-mono-num">
                          {hudState.goldOverdriveCost}
                        </span>
                      </span>
                    </button>

                    {/* Satellite Slot #1 (Mid-Arc 45°): Gene Surge Mutation Medallion */}
                    <button
                      type="button"
                      data-testid="inrun-gene-surge-btn"
                      disabled={hudState.genes < hudState.geneSurgeCost}
                      {...bindMultiTouchButton(
                        handleGeneSurge,
                        hudState.genes < hudState.geneSurgeCost
                      )}
                      title={t('btn_gene_surge', {
                        cost: hudState.geneSurgeCost,
                      })}
                      style={getFanSlotStyle(1, fanSlotCount)}
                      className={`game-btn-spring absolute rounded-full flex items-center justify-center transition-all touch-manipulation ${
                        hudState.genes >= hudState.geneSurgeCost
                          ? 'cursor-pointer opacity-100 scale-100'
                          : 'cursor-not-allowed opacity-50 scale-95'
                      } ${
                        tutorialStep === 'HANDS_ON_UPGRADE' &&
                        hudState.genes >= hudState.geneSurgeCost
                          ? 'ring-2 ring-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)]'
                          : ''
                      }`}
                    >
                      <UiAtlasIcon
                        iconKey="UI_BTN_GENE_SURGE"
                        size={42}
                        className="w-full h-full drop-shadow"
                      />
                      <span className="absolute -bottom-1 px-1 py-0.5 rounded-full bg-slate-950/92 text-emerald-300 font-display font-extrabold text-[7px] flex items-center gap-0.5 shadow leading-none whitespace-nowrap">
                        <span>{lang === 'zh' ? '突破' : 'Surge'}</span>
                        <UiAtlasIcon iconKey="UI_ICON_GENE" size={8} />
                        <span className="font-mono-num">
                          {hudState.geneSurgeCost}
                        </span>
                      </span>
                    </button>

                    {/* Satellite Slot #2 (Upper Arc): Body Upgrade Medallion */}
                    {showUpgBtn && (
                      <button
                        type="button"
                        data-testid="inrun-upgrade-body-btn"
                        disabled={!hudState.canUpgradeBodyNow}
                        {...bindMultiTouchButton(
                          () => handleUpgradeSharkForm(hudState.activeSharkId),
                          !hudState.canUpgradeBodyNow
                        )}
                        aria-label={`⬆️ Body Lv.${hudState.activeUpgradeLevel + 1} (${hudState.bodyUpgradeCost})`}
                        title={
                          lang === 'zh'
                            ? `强化躯体 Lv.${hudState.activeUpgradeLevel + 1} (🪙${hudState.bodyUpgradeCost})`
                            : `Upgrade Body Lv.${hudState.activeUpgradeLevel + 1} (🪙${hudState.bodyUpgradeCost})`
                        }
                        style={getFanSlotStyle(2, fanSlotCount)}
                        className={`game-btn-spring absolute rounded-full flex items-center justify-center transition-all touch-manipulation ${
                          hudState.canUpgradeBodyNow
                            ? 'cursor-pointer opacity-100 scale-100'
                            : 'cursor-not-allowed opacity-55 scale-95'
                        } ${
                          tutorialStep === 'HANDS_ON_UPGRADE' &&
                          hudState.canUpgradeBodyNow
                            ? 'ring-3 ring-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.95)] animate-bounce'
                            : ''
                        }`}
                      >
                        {tutorialStep === 'HANDS_ON_UPGRADE' &&
                          hudState.canUpgradeBodyNow && (
                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-300 text-slate-950 font-display font-black text-[9px] whitespace-nowrap shadow-md pointer-events-none">
                              {lang === 'zh' ? '👆 点此强化' : '👆 Tap UPG!'}
                            </span>
                          )}
                        <UiAtlasIcon
                          iconKey="UI_BTN_BODY_UPGRADE"
                          size={44}
                          className="w-full h-full drop-shadow-[0_0_8px_rgba(251,191,36,0.75)]"
                        />
                        <span className="sr-only">
                          {`⬆️ Body Lv.${hudState.activeUpgradeLevel + 1} (🪙${hudState.bodyUpgradeCost}) `}
                        </span>
                        <span className="absolute -top-1 -right-0.5 px-1 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono-num font-black text-[7px] shadow leading-none">
                          Lv.{hudState.activeUpgradeLevel + 1}
                        </span>
                        <span className="absolute -bottom-1 px-1 py-0.5 rounded-full bg-slate-950/92 text-amber-300 font-display font-extrabold text-[7px] flex items-center gap-0.5 shadow leading-none whitespace-nowrap">
                          <span>{lang === 'zh' ? '强化' : 'UPG'}</span>
                          <UiAtlasIcon iconKey="UI_ICON_COIN" size={8} />
                          <span className="font-mono-num">
                            {hudState.bodyUpgradeCost}
                          </span>
                          {hudState.bodyUpgradeGeneCost > 0 && (
                            <>
                              <span className="text-emerald-300">+</span>
                              <UiAtlasIcon iconKey="UI_ICON_GENE" size={7} />
                              <span className="text-emerald-300 font-mono-num">
                                {hudState.bodyUpgradeGeneCost}
                              </span>
                            </>
                          )}
                        </span>
                      </button>
                    )}

                    {/* Fixed Evolution Medallion directly above Body Upgrade */}
                    {(() => {
                      const evoReady = hudState.canBreakthroughNow && Boolean(nextEvoTargetForm);
                      return (
                        <button
                          type="button"
                          data-testid="inrun-fixed-evolution-btn"
                          {...bindMultiTouchButton(handleInRunBreakthroughOrAtlas)}
                          title={
                            evoReady && nextEvoTargetForm
                              ? (lang === 'zh' ? `点击立即进化：${nextEvoTargetForm.nameZh}` : `Tap to Evolve: ${nextEvoTargetForm.nameEn}`)
                              : (lang === 'zh' ? '点击查看48阶进化图谱' : 'Open Evolution Atlas')
                          }
                          style={{
                            width: 'var(--sat-size)',
                            height: 'var(--sat-size)',
                            right: 'calc(var(--boost-half) - var(--sat-half))',
                            bottom: 'calc(var(--boost-half) + var(--fan-radius) * 1.58 - var(--sat-half))',
                          }}
                          className={`game-btn-spring absolute rounded-full flex items-center justify-center cursor-pointer touch-manipulation transition-all z-20 ${
                            evoReady
                              ? 'scale-110 animate-bounce shadow-[0_0_24px_rgba(52,211,153,0.95)] ring-3 ring-amber-300'
                              : 'opacity-85 hover:opacity-100 ring-1 ring-cyan-500/50'
                          }`}
                        >
                          {evoReady && (
                            <span className="absolute -inset-1.5 rounded-full border-2 border-emerald-400 animate-ping pointer-events-none opacity-75" />
                          )}
                          {evoReady && nextEvoTargetForm ? (
                            <div className="w-10 h-6 flex items-center justify-center overflow-hidden">
                              <SharkFormCanvasPreview
                                sharkId={nextEvoTargetForm.id}
                                width={44}
                                height={26}
                                className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                              />
                            </div>
                          ) : (
                            <UiAtlasIcon
                              iconKey="UI_BTN_MORPH_EVOLVE"
                              size={44}
                              className="w-full h-full drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                            />
                          )}
                          <span
                            className={`absolute -bottom-1 px-1.5 py-0.5 rounded-full font-display font-black text-[7.5px] whitespace-nowrap shadow leading-none ${
                              evoReady
                                ? 'bg-amber-400 text-slate-950 font-black'
                                : 'bg-slate-950/90 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {evoReady
                              ? (lang === 'zh' ? '⚡立即进化' : 'EVOLVE')
                              : (lang === 'zh' ? '进化图鉴' : 'EVO')}
                          </span>
                        </button>
                      );
                    })()}

                    {/* Emergency Scaled Supply Drop Medallion when short on all resources */}
                    {hudState.coins < hudState.goldOverdriveCost &&
                      hudState.genes < hudState.geneSurgeCost &&
                      !hudState.canUpgradeBodyNow &&
                      !hudState.canBreakthroughNow && (
                        <button
                          type="button"
                          data-testid="inrun-supply-drop-btn"
                          {...bindMultiTouchButton(handleSupplyDropAd)}
                          title={
                            lang === 'zh'
                              ? `观看广告领取补给 (+${supplyDropReward.coins}🪙 +${supplyDropReward.genes}🧬)`
                              : `Watch Ad for Supply Drop (+${supplyDropReward.coins}🪙 +${supplyDropReward.genes}🧬)`
                          }
                          style={{
                            width: 'calc(var(--sat-size) * 0.92)',
                            height: 'calc(var(--sat-size) * 0.92)',
                            right: 'calc(var(--boost-half) + var(--fan-radius) * 1.48)',
                            bottom: 'calc(var(--boost-half) + var(--fan-radius) * 0.52)',
                          }}
                          className="game-btn-spring absolute rounded-full flex items-center justify-center cursor-pointer touch-manipulation animate-pulse ring-2 ring-amber-300/80 shadow-[0_0_16px_rgba(250,204,21,0.75)]"
                        >
                          <UiAtlasIcon
                            iconKey="UI_BTN_SUPPLY_DROP"
                            size={40}
                            className="w-full h-full drop-shadow"
                          />
                          <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded-full bg-amber-300 text-slate-950 font-mono-num font-black text-[7px] shadow leading-none whitespace-nowrap">
                            +{supplyDropReward.coins}🪙 +{supplyDropReward.genes}🧬
                          </span>
                        </button>
                      )}

                    {/* Center Anchor (Bottom-Right Corner): Primary 2x Turbo Boost Medallion with Integrated SVG Energy Ring */}
                    <button
                      type="button"
                      aria-label={t('btn_boost')}
                      onPointerDown={(e) => {
                        if (gameStateRef.current !== 'playing') return;
                        e.stopPropagation();
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId);
                        } catch {
                          // Ignore capture errors on synthetic events
                        }
                        simRef.current.input.boostPointerHeld = true;
                        simRef.current.input.boostPointerId = e.pointerId;
                        setBoostVisual(true);
                      }}
                      onPointerUp={(e) => {
                        if (
                          simRef.current.input.boostPointerId !== null &&
                          e.pointerId !== simRef.current.input.boostPointerId
                        ) {
                          return;
                        }
                        simRef.current.input.boostPointerHeld = false;
                        simRef.current.input.boostPointerId = null;
                        setBoostVisual(simRef.current.input.keys.has('Space'));
                      }}
                      onPointerCancel={(e) => {
                        if (
                          simRef.current.input.boostPointerId !== null &&
                          e.pointerId !== simRef.current.input.boostPointerId
                        ) {
                          return;
                        }
                        simRef.current.input.boostPointerHeld = false;
                        simRef.current.input.boostPointerId = null;
                        setBoostVisual(false);
                      }}
                      style={{
                        width: 'var(--boost-size)',
                        height: 'var(--boost-size)',
                      }}
                      className={`landscape-thumb-boost absolute right-0 bottom-0 rounded-full flex items-center justify-center cursor-pointer transition-transform shrink-0 touch-none ${
                        boostVisual
                          ? 'scale-92 brightness-125'
                          : 'hover:scale-103'
                      } ${
                        tutorialStep === 'HOLD_BOOST'
                          ? 'ring-3 ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.95)]'
                          : ''
                      }`}
                    >
                      {tutorialStep === 'HOLD_BOOST' && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-300 text-slate-950 font-display font-black text-[9px] whitespace-nowrap shadow-md animate-bounce pointer-events-none">
                          {lang === 'zh' ? '👆 按住冲刺' : '👆 Hold Boost'}
                        </span>
                      )}
                      <svg
                        viewBox="0 0 100 100"
                        className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke="rgba(15, 23, 42, 0.7)"
                          strokeWidth="5"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke={
                            hudState.frenzyTimer > 0
                              ? '#fde047'
                              : boostVisual
                              ? '#ffffff'
                              : '#38bdf8'
                          }
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray="289"
                          strokeDashoffset={
                            289 -
                            (289 *
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  (hudState.energy / hudState.maxEnergy) * 100
                                )
                              )) /
                              100
                          }
                        />
                      </svg>
                      <UiAtlasIcon
                        iconKey="UI_BTN_BOOST"
                        size={74}
                        className="w-full h-full drop-shadow-[0_0_12px_rgba(56,189,248,0.55)]"
                      />
                      <span className="absolute -bottom-1 px-1.5 py-0.5 rounded-full bg-slate-950/92 font-display font-extrabold text-[8px] text-sky-200 shadow leading-none whitespace-nowrap">
                        {lang === 'zh' ? '冲刺' : 'Boost'}{' '}
                        <span className="font-mono-num">
                          {hudState.energy}%
                        </span>
                      </span>
                    </button>
                  </motion.div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};
