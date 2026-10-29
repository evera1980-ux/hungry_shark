import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lang } from '../game/i18n';
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
  const isCompactMobileStage = stageSize.w < 460 || stageSize.h < 275;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-1 sm:p-3 overflow-hidden select-none">
      <div className="w-full max-w-6xl h-[97dvh] max-h-[97dvh] flex flex-col rounded-2xl bg-slate-900/95 border border-sky-400/35 shadow-[0_0_55px_rgba(14,165,233,0.3)] overflow-hidden">
        {/* ==================== 1. SIMPLIFIED SINGLE-LINE HEADER BAR ==================== */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-slate-950/95 border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <UiAtlasIcon
              iconKey="UI_BTN_MORPH_EVOLVE"
              size={20}
              className="shrink-0"
            />
            <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
              {lang === 'zh' ? '进化' : 'Evolution'}
            </h2>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 border border-sky-400/40 text-sky-300 leading-none"
              title={
                lang === 'zh'
                  ? `全局加成：生命 x${atlasBonuses.hpMultiplier} · 游速 +${Math.round(atlasBonuses.speedBonus * 100)}% · 收益 x${atlasBonuses.rewardMultiplier}`
                  : `Bonus: HP x${atlasBonuses.hpMultiplier} · Speed +${Math.round(atlasBonuses.speedBonus * 100)}% · Rewards x${atlasBonuses.rewardMultiplier}`
              }
            >
              {atlasBonuses.unlockedCount}/48
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-400/40 text-amber-300 leading-none"
              title={lang === 'zh' ? '王冠收集进度' : 'Mastery Crowns'}
            >
              👑 {atlasBonuses.totalMasteryCrowns}/144
            </span>
          </div>

          {/* Quick-Focus Buttons + Live Persistent Resource Bar + Close */}
          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <button
              type="button"
              onClick={handleJumpToActive}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] font-extrabold border transition flex items-center gap-1 cursor-pointer shrink-0 ${
                isInspectedActive
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-emerald-400/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{lang === 'zh' ? '出战中' : 'Active'}</span>
            </button>

            {readyToEvolveSharks.length > 0 && (
              <button
                type="button"
                onClick={handleJumpToReady}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] font-extrabold bg-amber-500/25 border border-amber-400 text-amber-200 animate-pulse flex items-center gap-1 cursor-pointer shrink-0"
              >
                <UiAtlasIcon iconKey="UI_BTN_MORPH_EVOLVE" size={12} />
                <span>
                  {lang === 'zh'
                    ? `可进化(${readyToEvolveSharks.length})`
                    : `Ready(${readyToEvolveSharks.length})`}
                </span>
              </button>
            )}

            <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-900 border border-amber-400/35 text-[10px] sm:text-xs font-mono font-bold text-amber-300">
              <UiAtlasIcon iconKey="UI_ICON_COIN" size={13} />
              <span>{totalCoins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-900 border border-emerald-400/35 text-[10px] sm:text-xs font-mono font-bold text-emerald-300">
              <UiAtlasIcon iconKey="UI_ICON_GENE" size={13} />
              <span>{totalGenes.toLocaleString()}</span>
            </div>

            <button
              type="button"
              data-testid="close-atlas-btn"
              aria-label={lang === 'zh' ? '关闭' : 'Close'}
              onClick={onClose}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-600/70 transition cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ==================== 2. GIANT AQUARIUM + CONTINUOUS ARC DIAL & COMMAND DECK ==================== */}
        <div className="flex-1 min-h-0 atlas-split-container overflow-hidden">
          {/* LEFT / TOP: Giant Aquarium Spotlight + Continuous 48-Shark Curved Arc Dial */}
          <div className="flex-1 min-h-0 flex flex-col justify-between bg-gradient-to-b from-slate-950/90 via-sky-950/20 to-slate-950/90 overflow-hidden px-2 py-1.5 sm:p-3">
            <div
              ref={stageRef}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={finishStagePointerDrag}
              onPointerCancel={finishStagePointerDrag}
              onWheel={handleStageWheel}
              className="relative flex-1 min-h-[225px] flex items-center justify-center overflow-hidden touch-none cursor-grab active:cursor-grabbing"
            >
              {/* Left Cyber Arrow Button */}
              <button
                type="button"
                data-testid="atlas-prev-btn"
                aria-label={lang === 'zh' ? '上一只鲨鱼' : 'Previous Shark'}
                onClick={(e) => {
                  e.stopPropagation();
                  stepCarousel(-1);
                }}
                className="z-40 absolute left-0.5 sm:left-2 w-7 h-11 sm:w-9 sm:h-14 rounded-2xl bg-slate-900/90 hover:bg-sky-950/90 active:scale-90 border border-sky-400/45 hover:border-sky-300 text-sky-200 shadow-[0_0_18px_rgba(2,6,23,0.85)] flex items-center justify-center transition cursor-pointer"
              >
                <span className="text-sm sm:text-lg font-black select-none">
                  ◀
                </span>
              </button>

              {/* Right Cyber Arrow Button */}
              <button
                type="button"
                data-testid="atlas-next-btn"
                aria-label={lang === 'zh' ? '下一只鲨鱼' : 'Next Shark'}
                onClick={(e) => {
                  e.stopPropagation();
                  stepCarousel(1);
                }}
                className="z-40 absolute right-0.5 sm:right-2 w-7 h-11 sm:w-9 sm:h-14 rounded-2xl bg-slate-900/90 hover:bg-sky-950/90 active:scale-90 border border-sky-400/45 hover:border-sky-300 text-sky-200 shadow-[0_0_18px_rgba(2,6,23,0.85)] flex items-center justify-center transition cursor-pointer"
              >
                <span className="text-sm sm:text-lg font-black select-none">
                  ▶
                </span>
              </button>

              <div className="relative w-full h-full flex flex-col justify-between items-center py-1">
                {/* Top 68%: Giant Deep-Sea Aquarium Spotlight for Selected Shark */}
                <div className="relative flex-1 w-full flex flex-col items-center justify-center px-8">
                  <div
                    className="pointer-events-none absolute w-52 h-32 sm:w-64 sm:h-40 rounded-full blur-2xl opacity-35"
                    style={{
                      background: `radial-gradient(circle, ${inspectedForm.glowColor} 0%, transparent 72%)`,
                    }}
                  />

                  {/* Clean Lineage + Bite Tier Pill (No Serial Number) */}
                  <div className="z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-slate-700/80 text-[10px] font-mono">
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
                      size={11}
                    />
                    <span className="text-slate-200 font-bold">
                      {lang === 'zh' ? lineageInfo.nameZh : lineageInfo.nameEn}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded font-black text-[9px]"
                      style={{
                        backgroundColor: `${inspectedForm.primaryColor}35`,
                        color: inspectedForm.glowColor,
                      }}
                    >
                      T{inspectedForm.baseBiteTier}
                    </span>
                  </div>

                  {/* Giant Unobstructed Hero Shark Sprite */}
                  <div className="z-10 my-0.5 flex items-center justify-center">
                    <SharkFormCanvasPreview
                      sharkId={inspectedForm.id}
                      width={isCompactMobileStage ? 186 : 220}
                      height={isCompactMobileStage ? 100 : 118}
                      locked={!isInspectedUnlocked}
                      animate={true}
                    />
                  </div>

                  {/* Clean Shark Name + Status Pill (No Serial Number, No Subtitle Clutter) */}
                  <div className="z-10 flex flex-col items-center text-center">
                    <span className="text-base sm:text-lg font-black text-white tracking-wide">
                      {lang === 'zh'
                        ? inspectedForm.nameZh
                        : inspectedForm.nameEn}
                    </span>

                    <div className="mt-0.5">
                      {isInspectedActive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/60 text-emerald-300 text-[10px] font-black">
                          {lang === 'zh'
                            ? `✓ 出战中 · Lv.${inspectedUpgradeLv}/10`
                            : `✓ Active · Lv.${inspectedUpgradeLv}/10`}
                        </span>
                      ) : isInspectedUnlocked ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-mono font-bold">
                          {lang === 'zh'
                            ? `已解锁 · Lv.${inspectedUpgradeLv}/10`
                            : `Unlocked · Lv.${inspectedUpgradeLv}/10`}
                        </span>
                      ) : unlockCheck.canUnlockNow ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-200 text-[10px] font-black animate-pulse">
                          {lang === 'zh' ? '⚡ 可进化' : '⚡ Ready'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                          <UiAtlasIcon iconKey="UI_ICON_COIN" size={10} />
                          {inspectedForm.unlockCoins.toLocaleString()}
                          <span>·</span>
                          <UiAtlasIcon iconKey="UI_ICON_GENE" size={10} />
                          {inspectedForm.unlockGenes.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom 32%: Continuous Curved Semi-Circular Compass Arc Dial */}
                <div className="relative w-full h-[74px] sm:h-[84px] flex items-end justify-center overflow-visible">
                  {/* Curved Arc Track SVG */}
                  <svg
                    viewBox="-200 -45 400 60"
                    className="pointer-events-none absolute inset-0 w-full h-full"
                    aria-hidden="true"
                  >
                    <path
                      d="M -175 10 Q 0 -42 175 10"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.4)"
                      strokeWidth="2"
                    />
                    <path
                      d="M -185 16 Q 0 -36 185 16"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.16)"
                      strokeWidth="1.2"
                      strokeDasharray="4 6"
                    />
                  </svg>

                  {/* 7 Neighboring Sharks Along the Continuous 48-Shark Compass Arc */}
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
                        168,
                        Math.round(stageSize.w * 0.42)
                      );
                      const xPx = (slotPos / 3.4) * maxHalfSpan;
                      const normalizedX = Math.min(1.2, Math.abs(slotPos) / 3.4);
                      const yPx = -15 + normalizedX * normalizedX * 25;
                      const rotDeg = slotPos * 7;
                      const scale = isArcCenter
                        ? 1.18
                        : Math.max(0.75, 0.96 - Math.abs(slotPos) * 0.06);

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
                          className={`absolute w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex flex-col items-center justify-center gap-0.5 p-1 cursor-pointer select-none ${
                            isArcCenter
                              ? 'bg-sky-950/95 border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.8)] ring-1 ring-sky-300'
                              : isActive
                              ? 'bg-emerald-950/90 border-emerald-400/80'
                              : unlocked
                              ? 'bg-slate-900/95 border-slate-700 hover:border-sky-400/60'
                              : 'bg-slate-950/90 border-slate-800 opacity-75'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                          <SharkFormCanvasPreview
                            sharkId={shark.id}
                            width={38}
                            height={22}
                            locked={!unlocked}
                            animate={false}
                          />
                          <span
                            className="text-[8px] font-mono font-black leading-none"
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

          {/* ==================== RIGHT / BOTTOM: SIMPLIFIED COMMAND DECK ==================== */}
          <div className="atlas-inspector-panel p-2 sm:p-3.5 bg-slate-900/98 flex flex-col justify-between gap-1.5">
            <div className="space-y-1.5">
              {/* 1. Concise Trait Box */}
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-sky-400 flex items-center gap-1">
                    <UiAtlasIcon
                      iconKey={getLineageUiIconKey(inspectedForm.lineage)}
                      size={12}
                    />
                    <span>{lang === 'zh' ? '特性' : 'Trait'}</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 shrink-0">
                    Lv.{maxLvRecord} · {maxDepthRecord}m
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-200 leading-snug">
                  {lang === 'zh'
                    ? inspectedForm.traitZh
                    : inspectedForm.traitEn}
                </p>
              </div>

              {/* 2. Single-Row 4-Column Core Stats */}
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="rounded-lg bg-slate-950/80 border border-slate-800/90 px-1 py-1">
                  <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '咬合' : 'Bite'}
                  </div>
                  <div className="font-mono font-black text-xs text-amber-300 mt-0.5 leading-tight">
                    T{inspectedForm.baseBiteTier}
                    <span className="text-[9px] text-slate-400 ml-0.5">
                      →T{Math.min(8, inspectedForm.baseBiteTier + 2)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/80 border border-slate-800/90 px-1 py-1">
                  <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '生命' : 'HP'}
                  </div>
                  <div className="font-mono font-black text-xs text-emerald-300 mt-0.5 leading-tight">
                    {Math.round(
                      inspectedForm.baseHp *
                        (1 + (inspectedUpgradeLv - 1) * 0.08)
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/80 border border-slate-800/90 px-1 py-1">
                  <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '速度' : 'Speed'}
                  </div>
                  <div className="font-mono font-black text-xs text-sky-300 mt-0.5 leading-tight">
                    +
                    {Math.round(
                      (inspectedForm.speedBonus +
                        (inspectedUpgradeLv - 1) * 0.022) *
                        100
                    )}
                    %
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950/80 border border-slate-800/90 px-1 py-1">
                  <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none">
                    {lang === 'zh' ? '倍率' : 'Score'}
                  </div>
                  <div className="font-mono font-black text-xs text-purple-300 mt-0.5 leading-tight">
                    {inspectedForm.scoreMult}x
                  </div>
                </div>
              </div>

              {/* 3. Mastery Crowns */}
              <div className="rounded-xl bg-slate-950/85 border border-amber-400/25 px-2 py-1.5 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-extrabold text-amber-300 flex items-center gap-1">
                    <UiAtlasIcon iconKey="UI_ICON_SCORE_TROPHY" size={12} />
                    <span>{lang === 'zh' ? '王冠奖励' : 'Mastery'}</span>
                  </span>
                  <span className="font-mono text-slate-300">
                    {lang === 'zh' ? '最高' : 'Best'}:{' '}
                    <strong className="text-amber-200">
                      {inspectedBestScore.toLocaleString()}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {inspectedMasteryTiers.map((mTier) => {
                    const claimed = inspectedClaimedCrown >= mTier.tier;
                    return (
                      <div
                        key={mTier.tier}
                        className={`rounded-lg px-1.5 py-0.5 border flex items-center justify-between gap-1 ${
                          claimed
                            ? 'bg-emerald-950/45 border-emerald-400/55 text-emerald-200'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 leading-none">
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
                          <div className="text-[8px] sm:text-[9px] font-mono text-slate-400 leading-tight">
                            {mTier.scoreThreshold.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-[9px] sm:text-[10px] font-mono font-extrabold shrink-0">
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

              {/* 4. Triple-Gate Unlock Checklist (if Locked) */}
              {!isInspectedUnlocked && (
                <div className="rounded-xl bg-slate-950/90 border border-amber-500/30 px-2 py-1">
                  <div className="flex flex-wrap items-center gap-1 text-[10px] sm:text-[11px]">
                    {/* Gate 1: Explicit Parent Shark Name & Required Level */}
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
                          ? `点击查看前置鲨鱼：${unlockCheck.bestParentNameZh}`
                          : `Inspect prerequisite shark: ${unlockCheck.bestParentNameEn}`
                      }
                      className={`flex-[1.6] min-w-fit rounded-lg px-2 py-0.5 border flex items-center justify-between gap-1.5 whitespace-nowrap transition cursor-pointer ${
                        unlockCheck.parentMet
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                          : 'bg-rose-950/30 border-rose-500/35 text-rose-300 hover:border-rose-400'
                      }`}
                    >
                      <span className="font-bold">
                        {lang === 'zh'
                          ? `${unlockCheck.bestParentNameZh}≥Lv.${inspectedForm.reqParentUpgradeLevel}`
                          : `${unlockCheck.bestParentNameEn}≥Lv.${inspectedForm.reqParentUpgradeLevel}`}
                      </span>
                      <span className="font-mono font-bold">
                        {unlockCheck.parentMet
                          ? '✓'
                          : `${unlockCheck.bestParentCurrentLv}/${inspectedForm.reqParentUpgradeLevel}`}
                      </span>
                    </button>

                    {/* Gate 2: Max Level & Depth */}
                    <div
                      className={`flex-1 min-w-fit rounded-lg px-1.5 py-0.5 border flex items-center justify-between gap-1 whitespace-nowrap ${
                        unlockCheck.levelMet && unlockCheck.depthMet
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/35 text-rose-300'
                      }`}
                    >
                      <span>
                        {`Lv.${inspectedForm.reqMaxInRunLevel}${
                          inspectedForm.reqMaxDepth > 0
                            ? `·${inspectedForm.reqMaxDepth}m`
                            : ''
                        }`}
                      </span>
                      <span className="font-mono font-bold">
                        {unlockCheck.levelMet && unlockCheck.depthMet
                          ? '✓'
                          : `Lv.${maxLvRecord}`}
                      </span>
                    </div>

                    {/* Gate 3: Coins & Genes */}
                    <div
                      className={`flex-1 min-w-fit rounded-lg px-1.5 py-0.5 border flex items-center justify-center gap-1.5 font-mono font-bold whitespace-nowrap ${
                        unlockCheck.coinsMet && unlockCheck.genesMet
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900/90 border-slate-700 text-slate-300'
                      }`}
                    >
                      <span
                        className={`flex items-center gap-0.5 ${
                          unlockCheck.coinsMet
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        <UiAtlasIcon iconKey="UI_ICON_COIN" size={10} />
                        {inspectedForm.unlockCoins.toLocaleString()}
                      </span>
                      <span
                        className={`flex items-center gap-0.5 ${
                          unlockCheck.genesMet
                            ? 'text-emerald-300'
                            : 'text-rose-400'
                        }`}
                      >
                        <UiAtlasIcon iconKey="UI_ICON_GENE" size={10} />
                        {inspectedForm.unlockGenes.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Side-by-Side Thumb-Zone Action Buttons */}
            <div className="pt-1.5 border-t border-slate-800/90">
              {isInspectedUnlocked ? (
                <div className="grid grid-cols-[1.45fr_1fr] gap-2">
                  {/* Coin + Breakthrough Gene Upgrade Button (Lv.1 -> Lv.10) */}
                  <button
                    type="button"
                    data-testid="atlas-upgrade-btn"
                    disabled={inspectedUpgradeLv >= 10 || !canAffordUpgrade}
                    onClick={() => onUpgradeShark(inspectedForm.id)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-between gap-1.5 transition ${
                      inspectedUpgradeLv >= 10
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : canAffordUpgrade
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg cursor-pointer'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed'
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
                          <span className="flex items-center gap-0.5 text-emerald-950 bg-emerald-300/95 px-1.5 py-0.5 rounded text-[10px]">
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
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition ${
                      isInspectedActive
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                        : 'bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 shadow-lg cursor-pointer'
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
                  className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition ${
                    unlockCheck.canUnlockNow
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 hover:brightness-110 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.5)] cursor-pointer'
                      : 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed'
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
