import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lang } from '../../game/i18n';
import { BindMultiTouchFn } from '../../game/sim/types';

export interface DebugPanelOverlayProps {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  showDebugPanel: boolean;
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>;
  debugMaxPreys: number;
  debugPreySizeMult: number;
  liveActivePreyCount: number;
  debugWorldGrid: boolean;
  bindMultiTouchButton: BindMultiTouchFn;
  handleDebugMaxPreysChange: (nextVal: number) => void;
  handleDebugPreySizeChange: (nextVal: number) => void;
  handleToggleWorldDebugGrid: () => void;
  handleResetDebugParams: () => void;
}

export const DebugPanelOverlay: React.FC<DebugPanelOverlayProps> = ({
  lang,
  t,
  showDebugPanel,
  setShowDebugPanel,
  debugMaxPreys,
  debugPreySizeMult,
  liveActivePreyCount,
  debugWorldGrid,
  bindMultiTouchButton,
  handleDebugMaxPreysChange,
  handleDebugPreySizeChange,
  handleToggleWorldDebugGrid,
  handleResetDebugParams,
}) => {
  return (
      <AnimatePresence>
        {showDebugPanel && (
          <motion.aside
            key="live-debug-panel"
            data-testid="live-debug-panel"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className="fixed top-14 left-2 sm:top-16 sm:left-3 z-40 w-[268px] sm:w-[296px] rounded-2xl bg-slate-950/90 backdrop-blur-md p-3 text-white shadow-[0_12px_32px_rgba(2,6,23,0.85)] border border-cyan-400/30 pointer-events-auto select-none"
          >
            <div className="flex items-center justify-between gap-2 mb-2.5 pb-1.5 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🛠️</span>
                <span className="font-display font-extrabold text-xs tracking-wide text-cyan-300">
                  {lang === 'zh'
                    ? '实时调试面板 (Debug)'
                    : 'Live Debug Controls'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="debug-reset-btn"
                  {...bindMultiTouchButton(handleResetDebugParams)}
                  className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 font-display font-bold text-[10px] text-amber-300 cursor-pointer"
                >
                  {lang === 'zh' ? '重置默认' : 'Reset'}
                </button>
                <button
                  type="button"
                  data-testid="debug-close-btn"
                  {...bindMultiTouchButton(() => setShowDebugPanel(false))}
                  className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 font-display font-bold text-[10px] text-slate-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Regulator 1: Fish Spawn Count / Density */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] font-display font-bold mb-1">
                <span className="text-slate-200">
                  {lang === 'zh' ? '1. 鱼群刷新数量' : '1. Fish Spawn Count'}
                </span>
                <span className="font-mono-num text-cyan-300 font-extrabold">
                  {debugMaxPreys}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({lang === 'zh' ? '同屏' : 'live'}: {liveActivePreyCount})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="debug-fish-minus-btn"
                  {...bindMultiTouchButton(() =>
                    handleDebugMaxPreysChange(debugMaxPreys - 4)
                  )}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-mono-num font-bold text-[11px] text-cyan-200 cursor-pointer shrink-0"
                >
                  -4
                </button>
                <input
                  type="range"
                  data-testid="debug-fish-count-slider"
                  min={4}
                  max={80}
                  step={1}
                  value={debugMaxPreys}
                  onChange={(e) =>
                    handleDebugMaxPreysChange(Number(e.target.value))
                  }
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <button
                  type="button"
                  data-testid="debug-fish-plus-btn"
                  {...bindMultiTouchButton(() =>
                    handleDebugMaxPreysChange(debugMaxPreys + 4)
                  )}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-mono-num font-bold text-[11px] text-cyan-200 cursor-pointer shrink-0"
                >
                  +4
                </button>
              </div>
            </div>

            {/* Regulator 2: Prey Display Size Multiplier */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-display font-bold mb-1">
                <span className="text-slate-200">
                  {lang === 'zh' ? '2. 猎物显示大小' : '2. Prey Display Size'}
                </span>
                <span className="font-mono-num text-emerald-300 font-extrabold">
                  {debugPreySizeMult.toFixed(2)}x{' '}
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({Math.round(debugPreySizeMult * 100)}%)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="debug-size-minus-btn"
                  {...bindMultiTouchButton(() =>
                    handleDebugPreySizeChange(debugPreySizeMult - 0.1)
                  )}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-mono-num font-bold text-[11px] text-emerald-200 cursor-pointer shrink-0"
                >
                  -0.1
                </button>
                <input
                  type="range"
                  data-testid="debug-prey-size-slider"
                  min={0.35}
                  max={2.5}
                  step={0.05}
                  value={debugPreySizeMult}
                  onChange={(e) =>
                    handleDebugPreySizeChange(Number(e.target.value))
                  }
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <button
                  type="button"
                  data-testid="debug-size-plus-btn"
                  {...bindMultiTouchButton(() =>
                    handleDebugPreySizeChange(debugPreySizeMult + 0.1)
                  )}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-mono-num font-bold text-[11px] text-emerald-200 cursor-pointer shrink-0"
                >
                  +0.1
                </button>
              </div>
            </div>

            {/* Regulator 3: Stage-A 2D Chunk Bounds & Coordinate Debug Overlay */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-display font-bold text-slate-200">
                {lang === 'zh'
                  ? '3. 2D Chunk 网格调试'
                  : '3. 2D Chunk Grid Debug'}
              </span>
              <button
                type="button"
                data-testid="debug-world-grid-btn"
                {...bindMultiTouchButton(handleToggleWorldDebugGrid)}
                className={`px-2.5 py-0.5 rounded-lg font-mono-num font-bold text-[11px] cursor-pointer ${
                  debugWorldGrid
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {debugWorldGrid
                  ? lang === 'zh'
                    ? '已开启 (ON)'
                    : 'ON'
                  : lang === 'zh'
                  ? '已关闭 (OFF)'
                  : 'OFF'}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
  );
};
