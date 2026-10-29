import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lang } from '../game/i18n';
import {
  evaluateSharkUnlock,
  GENERATION_NAMES,
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
    // Ignore clicks on explicit buttons inside the stage
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

    // Flick or drag threshold to spin the wheel
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

  const handleSelectGeneration = (genNumber: number) => {
    const startIdx = (genNumber - 1) * 8;
    const rowSharks = SHARK_EVOLUTION_FORMS.slice(startIdx, startIdx + 8);
    const curForm = SHARK_EVOLUTION_FORMS[activeIndex];
    if (curForm.generation === genNumber) return;

    const readyInRow = rowSharks.find((s) =>
      readyToEvolveSharks.some((r) => r.id === s.id)
    );
    const activeInRow = rowSharks.find(
      (s) => s.id === metaSave.selectedSharkId
    );
    const unlockedInRow = [...rowSharks]
      .reverse()
      .find((s) => metaSave.unlockedSharkIds.includes(s.id));
    const pick = readyInRow ?? activeInRow ?? unlockedInRow ?? rowSharks[0];
    setDragOffsetPx(0);
    setActiveIndex(pick.index);
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

  const currentGenMeta =
    GENERATION_NAMES[inspectedForm.generation - 1] ?? GENERATION_NAMES[0];
  const currentGenSharks = SHARK_EVOLUTION_FORMS.slice(
    (inspectedForm.generation - 1) * 8,
    (inspectedForm.generation - 1) * 8 + 8
  );

  // 5 visible wheel slots around the center spotlight: [-2, -1, 0, +1, +2]
  const wheelOffsets = [-2, -1, 0, 1, 2];
  const normalizedDrag = dragOffsetPx / 160; // -1.375 .. +1.375

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-1.5 sm:p-3 overflow-hidden select-none">
      <div className="w-full max-w-6xl h-[96dvh] max-h-[96dvh] flex flex-col rounded-2xl bg-slate-900/95 border border-sky-400/35 shadow-[0_0_55px_rgba(14,165,233,0.3)] overflow-hidden">
        {/* ==================== 1. TOP HEADER BAR ==================== */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-slate-950/95 border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <UiAtlasIcon
              iconKey="UI_BTN_MORPH_EVOLVE"
              size={24}
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-base font-black text-white tracking-wide">
                  {lang === 'zh'
                    ? '深海巨鲨 48 形态进化轮盘'
                    : '48-Form Shark Evolution Wheel'}
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 border border-sky-400/40 text-sky-300 leading-none">
                  {atlasBonuses.unlockedCount}/48
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-400/40 text-amber-300 leading-none"
                  title={
                    lang === 'zh'
                      ? '物种统治王冠收集进度（每只鲨鱼 3 阶皇冠）'
                      : 'Species Mastery Crowns collected (3 tiers per shark)'
                  }
                >
                  👑 {atlasBonuses.totalMasteryCrowns}/144
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                {lang === 'zh'
                  ? `全局图鉴加成：生命 x${atlasBonuses.hpMultiplier} · 游速 +${Math.round(atlasBonuses.speedBonus * 100)}% · 收益 x${atlasBonuses.rewardMultiplier}`
                  : `Atlas Bonus: HP x${atlasBonuses.hpMultiplier} · Speed +${Math.round(atlasBonuses.speedBonus * 100)}% · Rewards x${atlasBonuses.rewardMultiplier}`}
              </p>
            </div>
          </div>

          {/* Quick-Focus Buttons + Live Persistent Resource Bar + Close */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              type="button"
              onClick={handleJumpToActive}
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition flex items-center gap-1 cursor-pointer shrink-0 ${
                isInspectedActive
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-emerald-400/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{lang === 'zh' ? '当前出战' : 'Active'}</span>
            </button>

            {readyToEvolveSharks.length > 0 && (
              <button
                type="button"
                onClick={handleJumpToReady}
                className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-amber-500/25 border border-amber-400 text-amber-200 animate-pulse flex items-center gap-1 cursor-pointer shrink-0"
              >
                <UiAtlasIcon iconKey="UI_BTN_MORPH_EVOLVE" size={12} />
                <span>
                  {lang === 'zh'
                    ? `可进化(${readyToEvolveSharks.length})`
                    : `Ready(${readyToEvolveSharks.length})`}
                </span>
              </button>
            )}

            <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-900 border border-amber-400/35 text-[11px] sm:text-xs font-mono font-bold text-amber-300">
              <UiAtlasIcon iconKey="UI_ICON_COIN" size={14} />
              <span>{totalCoins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-900 border border-emerald-400/35 text-[11px] sm:text-xs font-mono font-bold text-emerald-300">
              <UiAtlasIcon iconKey="UI_ICON_GENE" size={14} />
              <span>{totalGenes.toLocaleString()}</span>
            </div>

            <button
              type="button"
              data-testid="close-atlas-btn"
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-600/70 transition cursor-pointer shrink-0"
            >
              ✕ {lang === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
        </div>

        {/* ==================== 2. ADAPTIVE WHEEL + COMMAND DECK BODY ==================== */}
        <div className="flex-1 min-h-0 atlas-split-container overflow-hidden">
          {/* LEFT / TOP: G1~G6 6-Grid Bar + 3D Coverflow Wheel Carousel + 8-Slot Gen Indicator */}
          <div className="flex-1 min-h-0 flex flex-col justify-between bg-gradient-to-b from-slate-950/90 via-sky-950/20 to-slate-950/90 overflow-hidden p-2 sm:p-3">
            {/* Fixed 6-Column Generation Switcher (Zero Scrollbar!) */}
            <div className="shrink-0 space-y-1">
              <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                {GENERATION_NAMES.map((genMeta, idx) => {
                  const rowSharks = SHARK_EVOLUTION_FORMS.slice(
                    idx * 8,
                    idx * 8 + 8
                  );
                  const unlockedInGen = rowSharks.filter((s) =>
                    metaSave.unlockedSharkIds.includes(s.id)
                  ).length;
                  const hasReadyInGen = rowSharks.some((s) =>
                    readyToEvolveSharks.some((r) => r.id === s.id)
                  );
                  const isCurrentGen = inspectedForm.generation === genMeta.gen;

                  return (
                    <button
                      key={genMeta.gen}
                      type="button"
                      onClick={() => handleSelectGeneration(genMeta.gen)}
                      className={`relative py-1 sm:py-1.5 px-1 rounded-xl border transition flex flex-col items-center justify-center cursor-pointer ${
                        isCurrentGen
                          ? 'bg-sky-500/25 border-sky-400 text-white shadow-[0_0_14px_rgba(56,189,248,0.32)]'
                          : 'bg-slate-900/85 border-slate-800/90 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 leading-none">
                        <span
                          className="text-[11px] sm:text-xs font-black font-mono"
                          style={{
                            color: isCurrentGen ? '#ffffff' : genMeta.color,
                          }}
                        >
                          G{genMeta.gen}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-mono opacity-85">
                          {unlockedInGen}/8
                        </span>
                      </div>
                      {hasReadyInGen && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Generation Banner Subtitle */}
              <div className="flex items-center justify-between px-1 text-[10px] sm:text-xs">
                <span
                  className="font-extrabold tracking-wide"
                  style={{ color: currentGenMeta.color }}
                >
                  {lang === 'zh'
                    ? currentGenMeta.nameZh
                    : currentGenMeta.nameEn}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {lang === 'zh'
                    ? '◀ 左右滑动轮盘 / 点击两侧卡片或箭头切换 ▶'
                    : '◀ Swipe Wheel / Click Arrows or Side Cards ▶'}
                </span>
              </div>
            </div>

            {/* ==================== 3D COVERFLOW WHEEL STAGE ==================== */}
            <div
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={finishStagePointerDrag}
              onPointerCancel={finishStagePointerDrag}
              onWheel={handleStageWheel}
              className="relative flex-1 min-h-[168px] flex items-center justify-center overflow-hidden touch-none cursor-grab active:cursor-grabbing my-1"
            >
              {/* Ambient Underwater Radial Spotlight Behind Center Shark */}
              <div
                className="pointer-events-none absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full blur-3xl opacity-30 transition-colors duration-300"
                style={{
                  background: `radial-gradient(circle, ${inspectedForm.glowColor} 0%, transparent 70%)`,
                }}
              />

              {/* Left Cyber Arrow Button (Non-Touch & Quick Step) */}
              <button
                type="button"
                data-testid="atlas-prev-btn"
                aria-label={lang === 'zh' ? '上一只鲨鱼' : 'Previous Shark'}
                onClick={(e) => {
                  e.stopPropagation();
                  stepCarousel(-1);
                }}
                className="z-40 absolute left-1 sm:left-2.5 w-9 h-14 sm:w-11 sm:h-16 rounded-2xl bg-slate-900/90 hover:bg-sky-950/90 active:scale-90 border border-sky-400/45 hover:border-sky-300 text-sky-200 shadow-[0_0_20px_rgba(2,6,23,0.85)] flex items-center justify-center transition cursor-pointer"
              >
                <span className="text-lg sm:text-xl font-black select-none">
                  ◀
                </span>
              </button>

              {/* Right Cyber Arrow Button (Non-Touch & Quick Step) */}
              <button
                type="button"
                data-testid="atlas-next-btn"
                aria-label={lang === 'zh' ? '下一只鲨鱼' : 'Next Shark'}
                onClick={(e) => {
                  e.stopPropagation();
                  stepCarousel(1);
                }}
                className="z-40 absolute right-1 sm:right-2.5 w-9 h-14 sm:w-11 sm:h-16 rounded-2xl bg-slate-900/90 hover:bg-sky-950/90 active:scale-90 border border-sky-400/45 hover:border-sky-300 text-sky-200 shadow-[0_0_20px_rgba(2,6,23,0.85)] flex items-center justify-center transition cursor-pointer"
              >
                <span className="text-lg sm:text-xl font-black select-none">
                  ▶
                </span>
              </button>

              {/* 5-Card 3D Cylindrical Wheel Items: [-2, -1, 0, +1, +2] */}
              <div className="relative w-full h-full flex items-center justify-center">
                {wheelOffsets.map((relOffset) => {
                  const targetIdx = wrapIndex(activeIndex + relOffset);
                  const shark = SHARK_EVOLUTION_FORMS[targetIdx];
                  const unlocked = metaSave.unlockedSharkIds.includes(shark.id);
                  const isActive = metaSave.selectedSharkId === shark.id;
                  const upLv = metaSave.sharkUpgradeLevels[shark.id] ?? 1;
                  const check = evaluateSharkUnlock(
                    shark,
                    metaSave,
                    liveRunCoins,
                    liveRunGenes,
                    liveRunLevel,
                    liveRunMaxDepth
                  );
                  const crownTier =
                    metaSave.sharkMasteryTiers?.[shark.id] ?? 0;
                  const sharkLineage = LINEAGE_META[shark.lineage];
                  const isCenter = relOffset === 0;

                  // Continuous wheel kinematics with live finger drag offset
                  const effectiveOffset = relOffset + normalizedDrag;
                  const absOffset = Math.abs(effectiveOffset);
                  const scale = Math.max(
                    0.48,
                    1 - absOffset * 0.25
                  );
                  const translateXPercent = effectiveOffset * 68;
                  const translateY = Math.min(28, absOffset * absOffset * 7);
                  const rotateDeg = effectiveOffset * 9;
                  const opacity = Math.max(
                    0,
                    1 - Math.max(0, absOffset - 0.15) * 0.38
                  );
                  const zIndex = 30 - Math.round(absOffset * 10);

                  return (
                    <div
                      key={shark.id}
                      data-testid={
                        isCenter
                          ? `atlas-wheel-center-${shark.id}`
                          : `atlas-wheel-side-${shark.id}`
                      }
                      onClick={() => {
                        if (dragStateRef.current.hasMoved) return;
                        if (relOffset !== 0) {
                          stepCarousel(relOffset);
                        }
                      }}
                      style={{
                        transform: `translate3d(${translateXPercent.toFixed(
                          1
                        )}%, ${translateY.toFixed(
                          1
                        )}px, 0) scale(${scale.toFixed(
                          3
                        )}) rotate(${rotateDeg.toFixed(1)}deg)`,
                        opacity,
                        zIndex,
                        transition: dragStateRef.current.isDragging
                          ? 'none'
                          : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease',
                      }}
                      className={`w-[218px] sm:w-[258px] rounded-2xl p-2.5 sm:p-3.5 border flex flex-col items-center justify-between select-none ${
                        isCenter
                          ? 'bg-slate-900/95 border-sky-400 shadow-[0_12px_36px_rgba(14,165,233,0.35)] cursor-default'
                          : 'bg-slate-950/90 border-slate-700/80 hover:border-sky-400/60 cursor-pointer'
                      }`}
                    >
                      {/* Card Top Row: #Index + Gen + Lineage + Tier */}
                      <div className="w-full flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono">
                        <span className="font-black text-slate-300 flex items-center gap-1">
                          <span>
                            #{String(shark.index + 1).padStart(2, '0')} · G
                            {shark.generation}
                          </span>
                          {crownTier > 0 && (
                            <span>
                              {crownTier === 3
                                ? '👑'
                                : crownTier === 2
                                ? '🥈'
                                : '🥉'}
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-1">
                          <span
                            className="px-1.5 py-0.5 rounded-full font-bold text-[9px] flex items-center gap-0.5"
                            style={{
                              backgroundColor: `${sharkLineage.badgeColor}22`,
                              color: sharkLineage.badgeColor,
                              border: `1px solid ${sharkLineage.badgeColor}55`,
                            }}
                          >
                            <UiAtlasIcon
                              iconKey={getLineageUiIconKey(shark.lineage)}
                              size={11}
                            />
                            <span>
                              {lang === 'zh'
                                ? sharkLineage.nameZh
                                : sharkLineage.nameEn}
                            </span>
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded font-black text-[10px]"
                            style={{
                              backgroundColor: `${shark.primaryColor}33`,
                              color: shark.glowColor,
                            }}
                          >
                            T{shark.baseBiteTier}
                          </span>
                        </div>
                      </div>

                      {/* Large Live Swimming Shark Sprite Preview */}
                      <div className="my-1 sm:my-2 flex items-center justify-center">
                        <SharkFormCanvasPreview
                          sharkId={shark.id}
                          width={176}
                          height={98}
                          locked={!unlocked}
                          animate={isCenter}
                        />
                      </div>

                      {/* Full Uncut Shark Name & Title (Never Truncated!) */}
                      <div className="w-full text-center space-y-0.5">
                        <div className="text-sm sm:text-base font-black text-white leading-tight break-words">
                          {lang === 'zh' ? shark.nameZh : shark.nameEn}
                        </div>
                        <div
                          className="text-[10px] sm:text-[11px] font-bold leading-tight break-words"
                          style={{ color: shark.glowColor }}
                        >
                          {lang === 'zh' ? shark.titleZh : shark.titleEn}
                        </div>
                      </div>

                      {/* Bottom Status Pill on Wheel Card */}
                      <div className="mt-1.5 w-full flex items-center justify-center">
                        {isActive ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/60 text-emerald-300 text-[10px] font-black">
                            {lang === 'zh'
                              ? `✓ 当前出战 · Lv.${upLv}/10`
                              : `✓ ACTIVE · Lv.${upLv}/10`}
                          </span>
                        ) : unlocked ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-mono font-bold">
                            {lang === 'zh'
                              ? `已解锁 · 强化 Lv.${upLv}/10`
                              : `Unlocked · Lv.${upLv}/10`}
                          </span>
                        ) : check.canUnlockNow ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-200 text-[10px] font-black flex items-center gap-1 animate-pulse">
                            <UiAtlasIcon
                              iconKey="UI_BTN_MORPH_EVOLVE"
                              size={12}
                            />
                            {lang === 'zh'
                              ? '满足条件 · 可立即进化'
                              : 'READY TO EVOLVE'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-mono font-bold flex items-center gap-1">
                            <UiAtlasIcon iconKey="UI_ICON_COIN" size={11} />
                            {shark.unlockCoins.toLocaleString()}
                            <span className="text-slate-600">·</span>
                            <UiAtlasIcon iconKey="UI_ICON_GENE" size={11} />
                            {shark.unlockGenes.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Generation 8-Shark Quick Selector Strip (Zero Scrollbar, 8 Equal Slots) */}
            <div className="shrink-0 pt-1">
              <div className="grid grid-cols-8 gap-1 sm:gap-1.5">
                {currentGenSharks.map((shark) => {
                  const unlocked = metaSave.unlockedSharkIds.includes(shark.id);
                  const isActive = metaSave.selectedSharkId === shark.id;
                  const isCurrent = shark.index === activeIndex;
                  const check = evaluateSharkUnlock(
                    shark,
                    metaSave,
                    liveRunCoins,
                    liveRunGenes,
                    liveRunLevel,
                    liveRunMaxDepth
                  );
                  return (
                    <button
                      key={shark.id}
                      type="button"
                      data-testid={`atlas-card-${shark.id}`}
                      onClick={() => {
                        setDragOffsetPx(0);
                        setActiveIndex(shark.index);
                      }}
                      className={`py-1 px-0.5 rounded-lg border font-mono text-[10px] font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-500/30 border-sky-400 text-white shadow-[0_0_10px_rgba(56,189,248,0.35)] scale-105'
                          : isActive
                          ? 'bg-emerald-950/60 border-emerald-400/70 text-emerald-300'
                          : unlocked
                          ? 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-500'
                          : check.canUnlockNow
                          ? 'bg-amber-950/60 border-amber-400 text-amber-200 animate-pulse'
                          : 'bg-slate-950/80 border-slate-800/80 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span>#{shark.index + 1}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                          isActive
                            ? 'bg-emerald-400'
                            : unlocked
                            ? 'bg-sky-400'
                            : check.canUnlockNow
                            ? 'bg-amber-400'
                            : 'bg-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ==================== RIGHT / BOTTOM: ZERO-SCROLL COMMAND DECK ==================== */}
          <div className="atlas-inspector-panel p-2.5 sm:p-3.5 bg-slate-900/98 flex flex-col justify-between gap-2">
            <div className="space-y-2">
              {/* 1. Full Uncut Evolution Trait Box */}
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-sky-400 flex items-center gap-1">
                    <UiAtlasIcon
                      iconKey={getLineageUiIconKey(inspectedForm.lineage)}
                      size={13}
                    />
                    <span>
                      {lang === 'zh'
                        ? `${inspectedForm.nameZh} · 专属进化特性`
                        : `${inspectedForm.nameEn} · Evolution Trait`}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {lang === 'zh' ? '最高纪录' : 'Records'}: Lv.{maxLvRecord} ·{' '}
                    {maxDepthRecord}m
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {lang === 'zh'
                    ? inspectedForm.traitZh
                    : inspectedForm.traitEn}
                </p>
              </div>

              {/* 2. Single-Row 4-Column Core Numerical Telemetry Strip */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 px-1.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '咬合阶位' : 'Bite Tier'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-amber-300 mt-0.5">
                    T{inspectedForm.baseBiteTier}
                    <span className="text-[10px] text-slate-400 ml-0.5">
                      →T{Math.min(8, inspectedForm.baseBiteTier + 2)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 px-1.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '生命上限' : 'Max HP'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-emerald-300 mt-0.5">
                    {Math.round(
                      inspectedForm.baseHp *
                        (1 + (inspectedUpgradeLv - 1) * 0.08)
                    )}{' '}
                    HP
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 px-1.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '推进极速' : 'Swim Speed'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-sky-300 mt-0.5">
                    +
                    {Math.round(
                      (inspectedForm.speedBonus +
                        (inspectedUpgradeLv - 1) * 0.022) *
                        100
                    )}
                    %
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 px-1.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '得分倍率' : 'Score Mult'}
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-purple-300 mt-0.5">
                    {inspectedForm.scoreMult}x
                  </div>
                </div>
              </div>

              {/* 3. Species Mastery Crowns & 1st-Clear Gene Bonus */}
              <div className="rounded-xl bg-slate-950/85 border border-amber-400/25 px-2.5 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
                  <span className="font-extrabold text-amber-300 flex items-center gap-1">
                    <UiAtlasIcon iconKey="UI_ICON_SCORE_TROPHY" size={13} />
                    <span>
                      {lang === 'zh'
                        ? '物种统治王冠 · 首通基因奖励'
                        : 'Species Mastery · 1st-Clear Bonus'}
                    </span>
                  </span>
                  <span className="font-mono text-slate-300">
                    {lang === 'zh' ? '最高分' : 'Best'}:{' '}
                    <strong className="text-amber-200">
                      {inspectedBestScore.toLocaleString()}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {inspectedMasteryTiers.map((mTier) => {
                    const claimed = inspectedClaimedCrown >= mTier.tier;
                    return (
                      <div
                        key={mTier.tier}
                        className={`rounded-lg px-2 py-1 border flex items-center justify-between gap-1 ${
                          claimed
                            ? 'bg-emerald-950/45 border-emerald-400/55 text-emerald-200'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300'
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
                          <div className="text-[9px] font-mono text-slate-400 leading-tight mt-0.5">
                            {mTier.scoreThreshold.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-[10px] font-mono font-extrabold shrink-0">
                          {claimed ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <span className="text-emerald-300 flex items-center gap-0.5">
                              +{mTier.geneReward}
                              <UiAtlasIcon iconKey="UI_ICON_GENE" size={10} />
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
                <div className="rounded-xl bg-slate-950/90 border border-amber-500/30 px-2.5 py-2">
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px]">
                    {/* Gate 1: Parent Shark */}
                    <div
                      className={`rounded-lg px-2 py-1 border flex items-center justify-between ${
                        unlockCheck.parentMet
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/35 text-rose-300'
                      }`}
                    >
                      <span>
                        {lang === 'zh'
                          ? `前置≥Lv.${inspectedForm.reqParentUpgradeLevel}`
                          : `Parent≥Lv.${inspectedForm.reqParentUpgradeLevel}`}
                      </span>
                      <span className="font-mono font-bold ml-1">
                        {unlockCheck.parentMet
                          ? '✓'
                          : `${unlockCheck.bestParentCurrentLv}/${inspectedForm.reqParentUpgradeLevel}`}
                      </span>
                    </div>

                    {/* Gate 2: Max Level & Depth */}
                    <div
                      className={`rounded-lg px-2 py-1 border flex items-center justify-between ${
                        unlockCheck.levelMet && unlockCheck.depthMet
                          ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/35 text-rose-300'
                      }`}
                    >
                      <span>
                        {lang === 'zh'
                          ? `Lv.${inspectedForm.reqMaxInRunLevel}${
                              inspectedForm.reqMaxDepth > 0
                                ? `·${inspectedForm.reqMaxDepth}m`
                                : ''
                            }`
                          : `Lv.${inspectedForm.reqMaxInRunLevel}${
                              inspectedForm.reqMaxDepth > 0
                                ? `·${inspectedForm.reqMaxDepth}m`
                                : ''
                            }`}
                      </span>
                      <span className="font-mono font-bold ml-1">
                        {unlockCheck.levelMet && unlockCheck.depthMet
                          ? '✓'
                          : `Lv.${maxLvRecord}`}
                      </span>
                    </div>

                    {/* Gate 3: Coins & Genes */}
                    <div
                      className={`rounded-lg px-2 py-1 border flex items-center justify-center gap-1.5 font-mono font-bold ${
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
                            ? '体质已满级 (Lv.10)'
                            : 'MAX (Lv.10)'
                          : lang === 'zh'
                          ? `${
                              upgradeGeneCost > 0 ? '阶级突破' : '强化体质'
                            } Lv.${inspectedUpgradeLv}→${
                              inspectedUpgradeLv + 1
                            }`
                          : `${
                              upgradeGeneCost > 0 ? 'Breakthrough' : 'Upgrade'
                            } Lv.${inspectedUpgradeLv}→${
                              inspectedUpgradeLv + 1
                            }`}
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
                        ? '✓ 当前出战中'
                        : '✓ Active Form'
                      : lang === 'zh'
                      ? '切换为出战鲨鱼'
                      : 'Deploy This Shark'}
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
                        ? '立即破茧进化解锁并出战！'
                        : 'Evolve & Deploy Now!'
                      : lang === 'zh'
                      ? '未满足全部进化解锁条件'
                      : 'Requirements Not Yet Met'}
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
