import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lang } from '../game/i18n';
import { computeEvolvedSharkStats } from '../game/rules';
import {
  evaluateSharkUnlock,
  getGlobalAtlasBonuses,
  getSharkFormById,
  getSharkMasteryConfig,
  getSharkUpgradeCost,
  getSharkUpgradeGeneCost,
  LINEAGE_META,
  SHARK_EVOLUTION_FORMS,
  SharkMetaSaveData,
} from '../game/sharkEvolutionConfig';
import { SharkFormCanvasPreview } from './SharkFormCanvasPreview';
import { getLineageUiIconKey, UiAtlasIcon } from './UiAtlasIcon';

interface SharkEvolutionAtlasModalProps {
  lang: Lang;
  metaSave: SharkMetaSaveData;
  liveRunCoins: number;
  liveRunGenes: number;
  liveRunLevel: number;
  liveRunMaxDepth: number;
  onSelectActiveShark: (sharkId: string) => void;
  onUpgradeShark: (sharkId: string) => void;
  onUnlockShark: (sharkId: string) => void;
  onClose: () => void;
}

const TOTAL_SHARKS = SHARK_EVOLUTION_FORMS.length; // 48
const ARC_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;

function wrapIndex(idx: number): number {
  return ((idx % TOTAL_SHARKS) + TOTAL_SHARKS) % TOTAL_SHARKS;
}

export const SharkEvolutionAtlasModal: React.FC<
  SharkEvolutionAtlasModalProps
> = ({
  lang,
  metaSave,
  liveRunCoins,
  liveRunGenes,
  liveRunLevel,
  liveRunMaxDepth,
  onSelectActiveShark,
  onUpgradeShark,
  onUnlockShark,
  onClose,
}) => {
  // Pre-compute all locked sharks that currently meet all 3 evolution gates
  const readyToEvolveSharks = useMemo(() => {
    return SHARK_EVOLUTION_FORMS.filter((shark) => {
      if (metaSave.unlockedSharkIds.includes(shark.id)) return false;
      return evaluateSharkUnlock(
        shark,
        metaSave,
        liveRunCoins,
        liveRunGenes,
        liveRunLevel,
        liveRunMaxDepth
      ).canUnlockNow;
    });
  }, [
    metaSave,
    liveRunCoins,
    liveRunGenes,
    liveRunLevel,
    liveRunMaxDepth,
  ]);

  // Smart initial focus: prioritize ready-to-evolve shark if available, otherwise active shark
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (readyToEvolveSharks.length > 0) {
      return readyToEvolveSharks[0].index;
    }
    const activeForm = getSharkFormById(
      metaSave.selectedSharkId || 'shark_00_clown_fry'
    );
    return activeForm.index;
  });

  // Live pointer drag state for smooth touch/mouse carousel wheel swiping
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const dragStateRef = useRef<{
    isDragging: boolean;
    pointerId: number | null;
    startX: number;
    lastX: number;
    startTime: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    pointerId: null,
    startX: 0,
    lastX: 0,
    startTime: 0,
    hasMoved: false,
  });
  const lastWheelTimeRef = useRef<number>(0);

  const stepCarousel = useCallback((delta: number) => {
    setDragOffsetPx(0);
    setActiveIndex((prev) => wrapIndex(prev + delta));
  }, []);

  // Keyboard Left/Right Arrow navigation for non-touch desktop convenience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepCarousel(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepCarousel(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, stepCarousel]);

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer capture errors
    }
    dragStateRef.current = {
      isDragging: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      startTime: performance.now(),
      hasMoved: false,
    };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.isDragging || (st.pointerId !== null && e.pointerId !== st.pointerId)) {
      return;
    }
    const dx = e.clientX - st.startX;
    st.lastX = e.clientX;
    if (Math.abs(dx) > 6) {
      st.hasMoved = true;
    }
    setDragOffsetPx(Math.max(-220, Math.min(220, dx)));
  };

  const finishStagePointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.isDragging || (st.pointerId !== null && e.pointerId !== st.pointerId)) {
      return;
    }
    const dx = e.clientX - st.startX;
    const elapsed = Math.max(16, performance.now() - st.startTime);
    const velocity = dx / elapsed; // px per ms

    st.isDragging = false;
    st.pointerId = null;
    setDragOffsetPx(0);

    if (Math.abs(dx) > 36 || Math.abs(velocity) > 0.35) {
      const steps =
        Math.abs(velocity) > 0.95 && Math.abs(dx) > 90
          ? 2
          : 1;
      stepCarousel(dx < 0 ? steps : -steps);
    }
  };

  const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const now = performance.now();
    if (now - lastWheelTimeRef.current < 130) return;
    const dominantDelta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(dominantDelta) > 12) {
      lastWheelTimeRef.current = now;
      stepCarousel(dominantDelta > 0 ? 1 : -1);
    }
  };

  const handleJumpToActive = () => {
    const activeForm = getSharkFormById(
      metaSave.selectedSharkId || 'shark_00_clown_fry'
    );
    setDragOffsetPx(0);
    setActiveIndex(activeForm.index);
  };

  const handleJumpToReady = () => {
    if (readyToEvolveSharks.length === 0) return;
    const curForm = SHARK_EVOLUTION_FORMS[activeIndex];
    const curIdx = readyToEvolveSharks.findIndex((s) => s.id === curForm.id);
    const nextReady =
      readyToEvolveSharks[(curIdx + 1) % readyToEvolveSharks.length];
    setDragOffsetPx(0);
    setActiveIndex(nextReady.index);
  };

  const inspectedForm = SHARK_EVOLUTION_FORMS[activeIndex];
  const isInspectedUnlocked = metaSave.unlockedSharkIds.includes(
    inspectedForm.id
  );
  const isInspectedActive = metaSave.selectedSharkId === inspectedForm.id;
  const inspectedUpgradeLv =
    metaSave.sharkUpgradeLevels[inspectedForm.id] ?? 1;
  const upgradeCost = getSharkUpgradeCost(inspectedForm, inspectedUpgradeLv);
  const upgradeGeneCost = getSharkUpgradeGeneCost(
    inspectedForm,
    inspectedUpgradeLv
  );

  const totalCoins = metaSave.bankedCoins + liveRunCoins;
  const totalGenes = metaSave.bankedGenes + liveRunGenes;
  const canAffordUpgrade =
    inspectedUpgradeLv < 10 &&
    totalCoins >= upgradeCost &&
    totalGenes >= upgradeGeneCost;
  const maxLvRecord = Math.max(metaSave.bestInRunLevel, liveRunLevel);
  const maxDepthRecord = Math.max(
    metaSave.bestDepthReached,
    Math.round(liveRunMaxDepth)
  );

  const unlockCheck = evaluateSharkUnlock(
    inspectedForm,
    metaSave,
    liveRunCoins,
    liveRunGenes,
    liveRunLevel,
    liveRunMaxDepth
  );
  const atlasBonuses = getGlobalAtlasBonuses(metaSave);
  const inspectedStats = computeEvolvedSharkStats(
    1,
    inspectedForm.id,
    inspectedUpgradeLv,
    false,
    1.0,
    atlasBonuses.unlockedCount
  );
  const maxGenBiteTier = Math.min(8, inspectedForm.baseBiteTier + 2);
  const effectiveSpeedBonusPct = Math.round(
    (inspectedForm.speedBonus +
      (inspectedUpgradeLv - 1) * 0.022 +
      atlasBonuses.speedBonus) *
      100
  );
  const lineageInfo = LINEAGE_META[inspectedForm.lineage];
  const inspectedMasteryTiers = getSharkMasteryConfig(inspectedForm);
  const inspectedBestScore =
    metaSave.sharkBestScores?.[inspectedForm.id] ?? 0;
  const inspectedClaimedCrown =
    metaSave.sharkMasteryTiers?.[inspectedForm.id] ?? 0;

  // Responsive stage dimensions so the Arc Dial + Giant Aquarium stage fits 100% inside any mobile/desktop viewport
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({
    w: 390,
    h: 280,
  });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setStageSize({
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    };
    updateSize();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateSize);
      ro.observe(el);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const normalizedDrag = dragOffsetPx / 105; // smooth angular drag offset in slot units
  const isCompactStage = stageSize.w < 460 || stageSize.h < 310;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-0 sm:p-3 overflow-hidden select-none">
      <div className="w-full max-w-6xl h-[100dvh] sm:h-[96dvh] max-h-[100dvh] sm:max-h-[96dvh] flex flex-col sm:rounded-3xl bg-gradient-to-b from-[#040d21] via-[#06132d] to-[#030917] shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* ==================== 1. FRAMELESS SINGLE-LINE HEADER BAR (ZERO OVERLAP ON ALL VIEWPORTS) ==================== */}
        <div className="h-11 sm:h-12 flex items-center justify-between gap-1.5 sm:gap-3 px-2.5 sm:px-5 bg-slate-950/60 border-b border-white/[0.06] shrink-0 whitespace-nowrap overflow-hidden">
          {/* Left: Title + Unboxed Collection & Crown Counters */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <UiAtlasIcon
              iconKey="UI_BTN_MORPH_EVOLVE"
              size={18}
              className="shrink-0"
            />
            <h2 className="text-sm sm:text-lg font-black text-white tracking-wide leading-none">
              {lang === 'zh' ? '进化' : 'Evolution'}
            </h2>
            <span
              className="hidden sm:inline text-slate-600 select-none"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className="text-[11px] sm:text-sm font-mono font-extrabold text-sky-300 leading-none"
              title={
                lang === 'zh'
                  ? `全局加成：生命 x${atlasBonuses.hpMultiplier} · 游速 +${Math.round(atlasBonuses.speedBonus * 100)}% · 收益 x${atlasBonuses.rewardMultiplier}`
                  : `Bonus: HP x${atlasBonuses.hpMultiplier} · Speed +${Math.round(atlasBonuses.speedBonus * 100)}% · Rewards x${atlasBonuses.rewardMultiplier}`
              }
            >
              {atlasBonuses.unlockedCount}
              <span className="text-slate-500">/48</span>
            </span>
            <span
              className="hidden sm:inline text-slate-600 select-none"
              aria-hidden="true"
            >
              ·
            </span>
            <span
              className="text-[11px] sm:text-sm font-mono font-extrabold text-amber-300 leading-none flex items-center gap-0.5 sm:gap-1"
              title={lang === 'zh' ? '王冠收集进度' : 'Mastery Crowns'}
            >
              <span>👑</span>
              <span>
                {atlasBonuses.totalMasteryCrowns}
                <span className="text-slate-500">/144</span>
              </span>
            </span>
          </div>

          {/* Right: Quick-Focus Toggles + Unboxed Resource Counters + Close */}
          <div className="flex items-center gap-1 sm:gap-3 ml-auto shrink-0">
            <button
              type="button"
              onClick={handleJumpToActive}
              className={`${
                readyToEvolveSharks.length > 0 ? 'hidden sm:flex' : 'flex'
              } h-6 sm:h-7 px-2 sm:px-2.5 rounded-full text-[10px] sm:text-[11px] font-extrabold transition items-center gap-1 cursor-pointer shrink-0 ${
                isInspectedActive
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{lang === 'zh' ? '出战中' : 'Active'}</span>
            </button>

            {readyToEvolveSharks.length > 0 && (
              <button
                type="button"
                onClick={handleJumpToReady}
                className="h-6 sm:h-7 px-2 sm:px-2.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-amber-400/20 text-amber-200 animate-pulse flex items-center gap-1 cursor-pointer shrink-0"
              >
                <UiAtlasIcon iconKey="UI_BTN_MORPH_EVOLVE" size={12} />
                <span>
                  {lang === 'zh'
                    ? `可进化(${readyToEvolveSharks.length})`
                    : `Ready(${readyToEvolveSharks.length})`}
                </span>
              </button>
            )}

            {/* Unboxed Live Coins & Genes Readout */}
            <div className="flex items-center gap-1.5 sm:gap-3 px-0.5 sm:px-1.5 text-[11px] sm:text-sm font-mono font-extrabold">
              <div className="flex items-center gap-0.5 sm:gap-1 text-amber-300">
                <UiAtlasIcon iconKey="UI_ICON_COIN" size={13} />
                <span>{totalCoins.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 text-emerald-300">
                <UiAtlasIcon iconKey="UI_ICON_GENE" size={13} />
                <span>{totalGenes.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="button"
              data-testid="close-atlas-btn"
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
              onClick={onClose}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/[0.07] hover:bg-white/[0.15] text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center transition cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ==================== 2. GIANT AQUARIUM + FRAMELESS ARC DIAL & DE-BOXED COMMAND DECK ==================== */}
        <div className="flex-1 min-h-0 atlas-split-container overflow-hidden">
          {/* LEFT / TOP: Giant Aquarium Spotlight + Frameless 48-Shark Curved Arc Dial */}
          <div className="flex-1 min-h-0 flex flex-col justify-between bg-[radial-gradient(ellipse_at_50%_38%,rgba(14,165,233,0.16)_0%,rgba(2,6,23,0.92)_78%)] overflow-hidden px-2 py-1 sm:p-4">
            <div
              ref={stageRef}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={finishStagePointerDrag}
              onPointerCancel={finishStagePointerDrag}
              onWheel={handleStageWheel}
              className="relative flex-1 min-h-[210px] flex items-center justify-center overflow-hidden touch-none cursor-grab active:cursor-grabbing"
            >
              {/* Left Frameless Soft Arrow Button */}
              <button
                type="button"
                data-testid="atlas-prev-btn"
                aria-label={lang === 'zh' ? '上一只鲨鱼' : 'Previous Shark'}
                onClick={(e) => {
                  e.stopPropagation();
                  stepCarousel(-1);
                }}
                className="z-40 absolute left-1 sm:left-2.5 w-8 h-11 sm:w-10 sm:h-14 rounded-full bg-slate-950/55 hover:bg-sky-500/25 active:scale-90 text-sky-200/90 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <span className="text-base sm:text-xl font-black select-none">
                  ◀
                </span>
              </button>

              {/* Right Frameless Soft Arrow Button */}
              <button
                type="button"
                data-testid="atlas-next-btn"
                aria-label={lang === 'zh' ? '下一只鲨鱼' : 'Next Shark'}
                onClick={(e) => {
                  e.stopPropagation();
                  stepCarousel(1);
                }}
                className="z-40 absolute right-1 sm:right-2.5 w-8 h-11 sm:w-10 sm:h-14 rounded-full bg-slate-950/55 hover:bg-sky-500/25 active:scale-90 text-sky-200/90 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <span className="text-base sm:text-xl font-black select-none">
                  ▶
                </span>
              </button>

              <div className="relative w-full h-full flex flex-col justify-between items-center py-0.5">
                {/* Top 68%: Giant Deep-Sea Aquarium Spotlight with Strictly Fixed Vertical Slots */}
                <div className="relative flex-1 w-full flex flex-col items-center justify-center px-10">
                  <div
                    className="pointer-events-none absolute w-52 h-32 sm:w-72 sm:h-44 rounded-full blur-3xl opacity-40"
                    style={{
                      background: `radial-gradient(circle, ${inspectedForm.glowColor} 0%, transparent 72%)`,
                    }}
                  />

                  {/* Slot 1 (Fixed 18px): Unboxed Lineage + Bite Tier Kicker */}
                  <div className="z-10 h-[18px] flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-mono leading-none whitespace-nowrap shrink-0">
                    {inspectedClaimedCrown > 0 && (
                      <span>
                        {inspectedClaimedCrown === 3
                          ? '👑'
                          : inspectedClaimedCrown === 2
                          ? '🥈'
                          : '🥉'}
                      </span>
                    )}
                    <UiAtlasIcon
                      iconKey={getLineageUiIconKey(inspectedForm.lineage)}
                      size={13}
                    />
                    <span className="text-slate-300 font-bold">
                      {lang === 'zh' ? lineageInfo.nameZh : lineageInfo.nameEn}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span
                      className="font-black"
                      style={{
                        color: inspectedForm.glowColor,
                      }}
                    >
                      T{inspectedStats.biteTier}
                    </span>
                  </div>

                  {/* Slot 2 (Fixed 90px / 116px): Giant Unobstructed Hero Shark Sprite */}
                  <div className="z-10 h-[90px] sm:h-[116px] flex items-center justify-center shrink-0">
                    <SharkFormCanvasPreview
                      sharkId={inspectedForm.id}
                      width={isCompactStage ? 168 : 216}
                      height={isCompactStage ? 86 : 112}
                      locked={!isInspectedUnlocked}
                      animate={true}
                    />
                  </div>

                  {/* Slot 3 (Fixed 26px) + Slot 4 (Fixed 18px): Unboxed Shark Name + Status Subtitle */}
                  <div className="z-10 flex flex-col items-center text-center shrink-0">
                    <span
                      data-testid="atlas-hero-shark-name"
                      className="h-[26px] flex items-center justify-center text-base sm:text-xl font-black text-white tracking-wide leading-none whitespace-nowrap drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
                    >
                      {lang === 'zh'
                        ? inspectedForm.nameZh
                        : inspectedForm.nameEn}
                    </span>

                    <div className="h-[18px] flex items-center justify-center gap-1.5 text-[11px] font-bold leading-none whitespace-nowrap">
                      {isInspectedActive ? (
                        <span className="text-emerald-300 font-extrabold">
                          {lang === 'zh'
                            ? `✓ 出战中 · Lv.${inspectedUpgradeLv}/10`
                            : `✓ Active · Lv.${inspectedUpgradeLv}/10`}
                        </span>
                      ) : isInspectedUnlocked ? (
                        <span className="text-sky-300 font-mono">
                          {lang === 'zh'
                            ? `已解锁 · Lv.${inspectedUpgradeLv}/10`
                            : `Unlocked · Lv.${inspectedUpgradeLv}/10`}
                        </span>
                      ) : unlockCheck.canUnlockNow ? (
                        <span className="text-amber-300 font-black animate-pulse">
                          {lang === 'zh' ? '⚡ 满足条件，可立即进化' : '⚡ Ready to Evolve'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono inline-flex items-center gap-1">
                          <UiAtlasIcon iconKey="UI_ICON_COIN" size={11} />
                          <span className="text-amber-300/90">
                            {inspectedForm.unlockCoins.toLocaleString()}
                          </span>
                          <span className="text-slate-600">·</span>
                          <UiAtlasIcon iconKey="UI_ICON_GENE" size={11} />
                          <span className="text-emerald-300/90">
                            {inspectedForm.unlockGenes.toLocaleString()}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom 32%: Frameless Continuous Curved Semi-Circular Compass Arc Dial (Zero Node Overlap) */}
                <div className="relative w-full h-[64px] sm:h-[76px] flex items-end justify-center overflow-visible shrink-0 mt-1">
                  {/* Curved Arc Track SVG */}
                  <svg
                    viewBox="-200 -38 400 56"
                    className="pointer-events-none absolute inset-0 w-full h-full"
                    aria-hidden="true"
                  >
                    <path
                      d="M -180 12 Q 0 -32 180 12"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.32)"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M -188 18 Q 0 -26 188 18"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.12)"
                      strokeWidth="1"
                      strokeDasharray="4 6"
                    />
                  </svg>

                  {/* 7 Neighboring Sharks Floating Organically Along the Arc (Well-Spaced, Zero Overlap) */}
                  <div className="relative w-full h-full flex items-center justify-center">
                    {ARC_OFFSETS.map((relOffset) => {
                      const sharkIdx = wrapIndex(activeIndex + relOffset);
                      const shark = SHARK_EVOLUTION_FORMS[sharkIdx];
                      const isArcCenter = relOffset === 0;
                      const unlocked = metaSave.unlockedSharkIds.includes(
                        shark.id
                      );
                      const isActive = metaSave.selectedSharkId === shark.id;

                      const slotPos = relOffset + normalizedDrag;
                      const maxHalfSpan = Math.min(
                        186,
                        Math.round(stageSize.w * 0.44)
                      );
                      const xPx = (slotPos / 3.05) * maxHalfSpan;
                      const normalizedX = Math.min(
                        1.2,
                        Math.abs(slotPos) / 3.05
                      );
                      const yPx = -4 + normalizedX * normalizedX * 18;
                      const rotDeg = slotPos * 6.5;
                      const scale = isArcCenter
                        ? 1.12
                        : Math.max(0.64, 0.78 - Math.abs(slotPos) * 0.05);

                      return (
                        <div
                          key={shark.id}
                          data-testid={`atlas-card-${shark.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dragStateRef.current.hasMoved) return;
                            if (shark.index !== activeIndex) {
                              setDragOffsetPx(0);
                              setActiveIndex(shark.index);
                            }
                          }}
                          style={{
                            transform: `translate3d(${xPx.toFixed(
                              1
                            )}px, ${yPx.toFixed(
                              1
                            )}px, 0) rotate(${rotDeg.toFixed(
                              1
                            )}deg) scale(${scale.toFixed(2)})`,
                            zIndex: isArcCenter
                              ? 35
                              : Math.round(25 - Math.abs(slotPos) * 3),
                            transition: dragStateRef.current.isDragging
                              ? 'none'
                              : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                          className={`absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none ${
                            isArcCenter
                              ? 'bg-sky-400/20 shadow-[0_0_18px_rgba(56,189,248,0.65)]'
                              : isActive
                              ? 'bg-emerald-400/15'
                              : unlocked
                              ? 'hover:bg-white/[0.06]'
                              : 'opacity-60 hover:opacity-85'
                          }`}
                        >
                          {isArcCenter && (
                            <span className="pointer-events-none absolute -top-1 w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_#38bdf8]" />
                          )}
                          {isActive && !isArcCenter && (
                            <span className="pointer-events-none absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                          <SharkFormCanvasPreview
                            sharkId={shark.id}
                            width={36}
                            height={20}
                            locked={!unlocked}
                            animate={false}
                          />
                          <span
                            className={`text-[8px] sm:text-[9px] font-mono font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] ${
                              isArcCenter ? 'brightness-125' : ''
                            }`}
                            style={{ color: shark.glowColor }}
                          >
                            T{shark.baseBiteTier}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== RIGHT / BOTTOM: DE-BOXED COMMAND DECK (FIXED HEIGHT ACROSS ALL 48 SHARKS) ==================== */}
          <div className="atlas-inspector-panel px-3 py-2 sm:px-5 sm:py-3.5 bg-slate-950/75 flex flex-col justify-between gap-1.5">
            <div className="space-y-1.5 sm:space-y-2">
              {/* 1. Frameless Trait Section (Fixed 2-Line Height so 1-line vs 2-line traits never shift layout) */}
              <div className="px-0.5">
                <div className="h-4 flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[11px] sm:text-xs font-extrabold text-sky-300 flex items-center gap-1.5 leading-none">
                    <UiAtlasIcon
                      iconKey={getLineageUiIconKey(inspectedForm.lineage)}
                      size={13}
                    />
                    <span>{lang === 'zh' ? '特性' : 'Trait'}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 leading-none">
                    Lv.{maxLvRecord} · {maxDepthRecord}m
                  </span>
                </div>
                <p className="h-[34px] sm:h-[38px] text-xs sm:text-[13px] text-slate-200 leading-[17px] sm:leading-[19px] line-clamp-2 overflow-hidden">
                  {lang === 'zh'
                    ? inspectedForm.traitZh
                    : inspectedForm.traitEn}
                </p>
              </div>

              {/* 2. Unified 4-Column Stat Strip (Fixed Height, Hairline Dividers, Zero Individual Boxes) */}
              <div className="h-[44px] sm:h-[48px] grid grid-cols-4 divide-x divide-white/[0.07] items-center rounded-2xl bg-white/[0.03] text-center">
                <div className="px-1">
                  <div className="text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '咬合' : 'Bite'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-amber-300 mt-1 leading-none">
                    T{inspectedStats.biteTier}
                    <span className="text-[10px] text-slate-500 ml-0.5">
                      →T{maxGenBiteTier}
                    </span>
                  </div>
                </div>

                <div className="px-1">
                  <div className="text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '生命' : 'HP'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-emerald-300 mt-1 leading-none">
                    {inspectedStats.maxHp}
                  </div>
                </div>

                <div className="px-1">
                  <div className="text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '速度' : 'Speed'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-sky-300 mt-1 leading-none">
                    +{effectiveSpeedBonusPct}%
                  </div>
                </div>

                <div className="px-1">
                  <div className="text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '倍率' : 'Score'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-purple-300 mt-1 leading-none">
                    {inspectedForm.scoreMult}x
                  </div>
                </div>
              </div>

              {/* 3. Unified Mastery Crown Milestone Track (Fixed Height, Zero Nested Boxes) */}
              <div className="px-0.5 space-y-1">
                <div className="h-4 flex items-center justify-between text-[11px] leading-none">
                  <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                    <UiAtlasIcon iconKey="UI_ICON_SCORE_TROPHY" size={13} />
                    <span>{lang === 'zh' ? '王冠奖励' : 'Mastery'}</span>
                  </span>
                  <span className="font-mono text-slate-400">
                    {lang === 'zh' ? '最高' : 'Best'}:{' '}
                    <strong className="text-amber-200">
                      {inspectedBestScore.toLocaleString()}
                    </strong>
                  </span>
                </div>

                <div className="h-[38px] sm:h-[40px] grid grid-cols-3 divide-x divide-white/[0.07] items-center rounded-2xl bg-white/[0.03]">
                  {inspectedMasteryTiers.map((mTier) => {
                    const claimed = inspectedClaimedCrown >= mTier.tier;
                    return (
                      <div
                        key={mTier.tier}
                        className={`px-2 flex items-center justify-between gap-1 ${
                          claimed ? 'text-emerald-200' : 'text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="text-[10px] font-bold flex items-center gap-0.5 leading-none">
                            <span>{mTier.badgeIcon}</span>
                            <span>
                              {lang === 'zh'
                                ? mTier.tier === 1
                                  ? '铜冠'
                                  : mTier.tier === 2
                                  ? '银冠'
                                  : '金冠'
                                : mTier.tier === 1
                                ? 'Bronze'
                                : mTier.tier === 2
                                ? 'Silver'
                                : 'Gold'}
                            </span>
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 leading-none mt-1">
                            {mTier.scoreThreshold.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-[10px] font-mono font-extrabold shrink-0">
                          {claimed ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <span className="text-emerald-300 flex items-center gap-0.5">
                              +{mTier.geneReward}
                              <UiAtlasIcon iconKey="UI_ICON_GENE" size={9} />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Fixed-Height 2-Row Gate / Reinforcement Box (Always 50px across Unlocked & Locked Sharks, Zero Overlap) */}
              <div className="h-[50px] px-3 py-1.5 rounded-2xl bg-white/[0.03] flex flex-col justify-between text-[11px] overflow-hidden">
                {!isInspectedUnlocked ? (
                  <>
                    {/* Row 1: Dedicated Full-Width Row for Clickable Prerequisite Shark Name & Required Level */}
                    <button
                      type="button"
                      onClick={() => {
                        if (unlockCheck.bestParentId) {
                          setDragOffsetPx(0);
                          setActiveIndex(unlockCheck.bestParentIndex);
                        }
                      }}
                      title={
                        lang === 'zh'
                          ? `点击跳转至前置鲨鱼：${unlockCheck.bestParentNameZh}`
                          : `Jump to prerequisite shark: ${unlockCheck.bestParentNameEn}`
                      }
                      className={`w-full flex items-center justify-between gap-2 font-bold leading-none whitespace-nowrap transition cursor-pointer ${
                        unlockCheck.parentMet
                          ? 'text-emerald-300 hover:text-emerald-200'
                          : 'text-rose-300 hover:text-rose-200'
                      }`}
                    >
                      <span className="underline decoration-current/40 underline-offset-2">
                        {lang === 'zh'
                          ? `${unlockCheck.bestParentNameZh} ≥ Lv.${inspectedForm.reqParentUpgradeLevel}`
                          : `${unlockCheck.bestParentNameEn} ≥ Lv.${inspectedForm.reqParentUpgradeLevel}`}
                      </span>
                      <span className="font-mono text-[10px] opacity-90 shrink-0">
                        {unlockCheck.parentMet
                          ? lang === 'zh'
                            ? '✓ 已达标'
                            : '✓ Met'
                          : `${unlockCheck.bestParentCurrentLv}/${inspectedForm.reqParentUpgradeLevel}`}
                      </span>
                    </button>

                    {/* Row 2: Dedicated Full-Width Row for Level/Depth Gate + Coin/Gene Cost */}
                    <div className="w-full flex items-center justify-between gap-2 leading-none whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono font-bold">
                        <span
                          className={
                            unlockCheck.levelMet
                              ? 'text-emerald-300'
                              : 'text-rose-300'
                          }
                        >
                          {`Lv.${inspectedForm.reqMaxInRunLevel}${
                            unlockCheck.levelMet ? '✓' : `(${maxLvRecord})`
                          }`}
                        </span>
                        {inspectedForm.reqMaxDepth > 0 && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span
                              className={
                                unlockCheck.depthMet
                                  ? 'text-emerald-300'
                                  : 'text-rose-300'
                              }
                            >
                              {`${inspectedForm.reqMaxDepth}m${
                                unlockCheck.depthMet ? '✓' : `(${maxDepthRecord}m)`
                              }`}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 font-mono font-bold shrink-0">
                        <span
                          className={`flex items-center gap-0.5 ${
                            unlockCheck.coinsMet
                              ? 'text-amber-300'
                              : 'text-rose-400'
                          }`}
                        >
                          <UiAtlasIcon iconKey="UI_ICON_COIN" size={11} />
                          {inspectedForm.unlockCoins.toLocaleString()}
                        </span>
                        <span
                          className={`flex items-center gap-0.5 ${
                            unlockCheck.genesMet
                              ? 'text-emerald-300'
                              : 'text-rose-400'
                          }`}
                        >
                          <UiAtlasIcon iconKey="UI_ICON_GENE" size={11} />
                          {inspectedForm.unlockGenes.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Row 1: Body Reinforcement Level + Breakthrough Hint */}
                    <div className="w-full flex items-center justify-between gap-2 leading-none whitespace-nowrap">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        <span>{lang === 'zh' ? '躯体强化' : 'Body Level'}</span>
                        <strong className="font-mono text-sky-300">
                          Lv.{inspectedUpgradeLv}/10
                        </strong>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {inspectedUpgradeLv >= 10
                          ? lang === 'zh'
                            ? '✓ 已满级突破'
                            : '✓ MAX Tier'
                          : lang === 'zh'
                          ? 'Lv.5 / Lv.10 咬合+1'
                          : 'Lv.5 / Lv.10 Bite+1'}
                      </span>
                    </div>

                    {/* Row 2: Full-Width 10-Segment Visual Reinforcement Progress Bar */}
                    <div
                      className="w-full flex items-center gap-1.5"
                      aria-hidden="true"
                    >
                      {Array.from({ length: 10 }, (_, idx) => {
                        const segLv = idx + 1;
                        const filled = segLv <= inspectedUpgradeLv;
                        const isBreakthroughSeg = segLv === 5 || segLv === 10;
                        return (
                          <span
                            key={segLv}
                            className={`h-2 flex-1 rounded-full ${
                              filled
                                ? isBreakthroughSeg
                                  ? 'bg-amber-300'
                                  : 'bg-sky-400'
                                : 'bg-white/[0.08]'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 5. Side-by-Side Thumb-Zone Action Buttons (Fixed 40px / 44px Height) */}
            <div className="pt-1">
              {isInspectedUnlocked ? (
                <div className="grid grid-cols-[1.45fr_1fr] gap-2.5">
                  {/* Coin + Breakthrough Gene Upgrade Button (Lv.1 -> Lv.10) */}
                  <button
                    type="button"
                    data-testid="atlas-upgrade-btn"
                    disabled={inspectedUpgradeLv >= 10 || !canAffordUpgrade}
                    onClick={() => onUpgradeShark(inspectedForm.id)}
                    className={`h-10 sm:h-11 px-3.5 rounded-2xl font-black text-xs flex items-center justify-between gap-1.5 transition whitespace-nowrap ${
                      inspectedUpgradeLv >= 10
                        ? 'bg-white/[0.06] text-slate-400 cursor-not-allowed'
                        : canAffordUpgrade
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-slate-950 shadow-[0_6px_20px_rgba(245,158,11,0.35)] cursor-pointer'
                        : 'bg-white/[0.05] text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <UiAtlasIcon
                        iconKey="UI_BTN_BODY_UPGRADE"
                        size={17}
                        className="shrink-0"
                      />
                      <span>
                        {inspectedUpgradeLv >= 10
                          ? lang === 'zh'
                            ? '已满级'
                            : 'MAX'
                          : lang === 'zh'
                          ? `${
                              upgradeGeneCost > 0 ? '突破' : '强化'
                            } Lv.${inspectedUpgradeLv + 1}`
                          : `${
                              upgradeGeneCost > 0 ? 'Break' : 'UPG'
                            } Lv.${inspectedUpgradeLv + 1}`}
                      </span>
                    </span>
                    {inspectedUpgradeLv < 10 && (
                      <span className="font-mono flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-0.5">
                          <UiAtlasIcon iconKey="UI_ICON_COIN" size={13} />
                          {upgradeCost.toLocaleString()}
                        </span>
                        {upgradeGeneCost > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-950 bg-emerald-300 px-1.5 py-0.5 rounded-md text-[10px] leading-none">
                            <UiAtlasIcon iconKey="UI_ICON_GENE" size={11} />
                            {upgradeGeneCost.toLocaleString()}
                          </span>
                        )}
                      </span>
                    )}
                  </button>

                  {/* Equip / Deploy Shark Form Button */}
                  <button
                    type="button"
                    data-testid="atlas-deploy-btn"
                    disabled={isInspectedActive}
                    onClick={() => onSelectActiveShark(inspectedForm.id)}
                    className={`h-10 sm:h-11 px-3.5 rounded-2xl font-black text-xs flex items-center justify-center transition whitespace-nowrap ${
                      isInspectedActive
                        ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                        : 'bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-110 text-slate-950 shadow-[0_6px_20px_rgba(56,189,248,0.35)] cursor-pointer'
                    }`}
                  >
                    {isInspectedActive
                      ? lang === 'zh'
                        ? '✓ 出战中'
                        : '✓ Active'
                      : lang === 'zh'
                      ? '出战'
                      : 'Deploy'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="atlas-unlock-btn"
                  disabled={!unlockCheck.canUnlockNow}
                  onClick={() => onUnlockShark(inspectedForm.id)}
                  className={`w-full h-10 sm:h-11 px-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition whitespace-nowrap ${
                    unlockCheck.canUnlockNow
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 hover:brightness-110 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.45)] cursor-pointer'
                      : 'bg-white/[0.05] text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <UiAtlasIcon iconKey="UI_BTN_MORPH_EVOLVE" size={17} />
                  <span>
                    {unlockCheck.canUnlockNow
                      ? lang === 'zh'
                        ? '立即进化'
                        : 'Evolve'
                      : lang === 'zh'
                      ? '条件未满'
                      : 'Locked'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
