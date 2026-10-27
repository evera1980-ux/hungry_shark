import React, { useState } from 'react';
import { Lang } from '../game/i18n';
import {
  evaluateSharkUnlock,
  GENERATION_NAMES,
  getGlobalAtlasBonuses,
  getSharkFormById,
  getSharkUpgradeCost,
  LINEAGE_META,
  SHARK_EVOLUTION_FORMS,
  SharkFormConfig,
  SharkMetaSaveData,
} from '../game/sharkEvolutionConfig';
import { SharkFormCanvasPreview } from './SharkFormCanvasPreview';

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
  const [inspectedId, setInspectedId] = useState<string>(
    metaSave.selectedSharkId || 'shark_00_clown_fry'
  );

  const inspectedForm = getSharkFormById(inspectedId);
  const isInspectedUnlocked = metaSave.unlockedSharkIds.includes(
    inspectedForm.id
  );
  const isInspectedActive = metaSave.selectedSharkId === inspectedForm.id;
  const inspectedUpgradeLv =
    metaSave.sharkUpgradeLevels[inspectedForm.id] ?? 1;
  const upgradeCost = getSharkUpgradeCost(inspectedForm, inspectedUpgradeLv);

  const totalCoins = metaSave.bankedCoins + liveRunCoins;
  const totalGenes = metaSave.bankedGenes + liveRunGenes;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-1.5 sm:p-3 overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[94dvh] flex flex-col rounded-2xl bg-slate-900/95 border border-sky-400/35 shadow-[0_0_50px_rgba(14,165,233,0.28)] overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-950/90 border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg sm:text-xl">🧬</span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
                <span>
                  {lang === 'zh'
                    ? '深海巨鲨 48 形态进化图谱'
                    : '48-Form Shark Evolution Atlas'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/20 border border-sky-400/40 text-sky-300">
                  {atlasBonuses.unlockedCount} / 48
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400">
                {lang === 'zh'
                  ? `全局图鉴加成：生命 x${atlasBonuses.hpMultiplier} · 游速 +${Math.round(atlasBonuses.speedBonus * 100)}% · 金币/基因收益 x${atlasBonuses.rewardMultiplier}`
                  : `Atlas Bonus: HP x${atlasBonuses.hpMultiplier} · Speed +${Math.round(atlasBonuses.speedBonus * 100)}% · Rewards x${atlasBonuses.rewardMultiplier}`}
              </p>
            </div>
          </div>

          {/* Live Persistent Resource Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-400/35 text-xs font-mono font-bold text-amber-300">
              <span>🪙</span>
              <span>{totalCoins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-400/35 text-xs font-mono font-bold text-emerald-300">
              <span>🧬</span>
              <span>{totalGenes.toLocaleString()}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-slate-300">
              <span>
                {lang === 'zh' ? '最高等级' : 'Max Lv'}:{' '}
                <strong className="text-sky-300">Lv.{maxLvRecord}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {lang === 'zh' ? '最深纪录' : 'Max Depth'}:{' '}
                <strong className="text-purple-300">{maxDepthRecord}m</strong>
              </span>
            </div>
            <button
              type="button"
              data-testid="close-atlas-btn"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-600/70 transition cursor-pointer"
            >
              ✕ {lang === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
        </div>

        {/* Main Body: Left 6x8 Evolution Matrix + Right Selected Shark Inspector */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_310px] overflow-hidden">
          {/* Left: Scrollable 6 Generations x 8 Sharks Grid */}
          <div className="overflow-y-auto p-2.5 sm:p-3.5 space-y-3 bg-slate-950/40">
            {GENERATION_NAMES.map((genMeta, rowIdx) => {
              const rowSharks = SHARK_EVOLUTION_FORMS.slice(
                rowIdx * 8,
                rowIdx * 8 + 8
              );
              return (
                <div
                  key={genMeta.gen}
                  className="rounded-xl bg-slate-900/75 border border-slate-800/90 p-2 sm:p-2.5"
                >
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span
                      className="text-[11px] sm:text-xs font-extrabold tracking-wide"
                      style={{ color: genMeta.color }}
                    >
                      {lang === 'zh' ? genMeta.nameZh : genMeta.nameEn}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      #{rowIdx * 8 + 1} ~ #{rowIdx * 8 + 8}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {rowSharks.map((shark) => {
                      const unlocked = metaSave.unlockedSharkIds.includes(
                        shark.id
                      );
                      const isActive = metaSave.selectedSharkId === shark.id;
                      const isInspected = inspectedForm.id === shark.id;
                      const upLv = metaSave.sharkUpgradeLevels[shark.id] ?? 1;
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
                          onClick={() => setInspectedId(shark.id)}
                          className={`relative group flex flex-col items-center justify-between p-1.5 rounded-lg border transition cursor-pointer ${
                            isInspected
                              ? 'bg-sky-950/80 border-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.4)] scale-[1.02]'
                              : isActive
                              ? 'bg-emerald-950/50 border-emerald-400/70'
                              : unlocked
                              ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500'
                              : check.canUnlockNow
                              ? 'bg-amber-950/45 border-amber-400/80 animate-pulse'
                              : 'bg-slate-950/75 border-slate-800/70 opacity-75 hover:opacity-100'
                          }`}
                        >
                          {/* Top Mini Row: Index + Bite Tier */}
                          <div className="w-full flex items-center justify-between text-[9px] font-mono leading-none mb-0.5">
                            <span className="text-slate-400">
                              #{shark.index + 1}
                            </span>
                            <span
                              className="px-1 py-0.5 rounded font-bold"
                              style={{
                                backgroundColor: `${shark.primaryColor}33`,
                                color: shark.glowColor,
                              }}
                            >
                              T{shark.baseBiteTier}
                            </span>
                          </div>

                          {/* Sprite Preview */}
                          <div className="my-0.5">
                            <SharkFormCanvasPreview
                              sharkId={shark.id}
                              width={64}
                              height={40}
                              locked={!unlocked}
                            />
                          </div>

                          {/* Name & Status */}
                          <div className="w-full text-center truncate text-[10px] font-bold text-slate-200 leading-tight">
                            {lang === 'zh' ? shark.nameZh : shark.nameEn}
                          </div>

                          <div className="mt-0.5 w-full flex items-center justify-center">
                            {isActive ? (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/25 text-emerald-300 text-[9px] font-extrabold">
                                {lang === 'zh' ? '🦈 出战中' : 'ACTIVE'}
                              </span>
                            ) : unlocked ? (
                              <span className="text-[9px] font-mono font-bold text-sky-300">
                                Lv.{upLv}/10
                              </span>
                            ) : check.canUnlockNow ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 text-[9px] font-extrabold">
                                ⚡ {lang === 'zh' ? '可进化' : 'READY'}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-500">
                                🔒 🪙{shark.unlockCoins}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Detailed Shark Form Inspector & Upgrade / Evolution Lab */}
          <div className="p-3 sm:p-4 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-2.5">
              {/* Header & Animated Preview */}
              <div className="relative rounded-xl bg-slate-950/90 border border-slate-800 p-3 flex flex-col items-center text-center">
                <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>
                    #{inspectedForm.index + 1} · Gen.{inspectedForm.generation}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full font-bold text-[10px]"
                    style={{
                      backgroundColor: `${lineageInfo.badgeColor}22`,
                      color: lineageInfo.badgeColor,
                      border: `1px solid ${lineageInfo.badgeColor}55`,
                    }}
                  >
                    {lang === 'zh' ? lineageInfo.nameZh : lineageInfo.nameEn}
                  </span>
                </div>

                <SharkFormCanvasPreview
                  sharkId={inspectedForm.id}
                  width={150}
                  height={88}
                  locked={!isInspectedUnlocked}
                  animate={true}
                />

                <h3 className="mt-1 text-base font-black text-white">
                  {lang === 'zh' ? inspectedForm.nameZh : inspectedForm.nameEn}
                </h3>
                <p
                  className="text-[11px] font-bold"
                  style={{ color: inspectedForm.glowColor }}
                >
                  {lang === 'zh'
                    ? inspectedForm.titleZh
                    : inspectedForm.titleEn}
                </p>
              </div>

              {/* Passive Bloodline Trait */}
              <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-0.5">
                  {lang === 'zh' ? '✨ 专属进化特性' : '✨ Evolution Trait'}
                </div>
                <p className="text-xs text-slate-200 leading-snug">
                  {lang === 'zh'
                    ? inspectedForm.traitZh
                    : inspectedForm.traitEn}
                </p>
              </div>

              {/* Core Numerical Attributes */}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '基础咬合阶位' : 'Base Bite Tier'}
                  </div>
                  <div className="font-mono font-black text-amber-300">
                    Tier {inspectedForm.baseBiteTier}{' '}
                    <span className="text-[10px] text-slate-400">
                      (Max T{Math.min(8, inspectedForm.baseBiteTier + 2)})
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '基础生命上限' : 'Base Max HP'}
                  </div>
                  <div className="font-mono font-black text-emerald-300">
                    {Math.round(
                      inspectedForm.baseHp *
                        (1 + (inspectedUpgradeLv - 1) * 0.08)
                    )}{' '}
                    HP
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '推进极速加成' : 'Swim Speed Bonus'}
                  </div>
                  <div className="font-mono font-black text-sky-300">
                    +
                    {Math.round(
                      (inspectedForm.speedBonus +
                        (inspectedUpgradeLv - 1) * 0.022) *
                        100
                    )}
                    %
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-400">
                    {lang === 'zh' ? '捕食得分倍率' : 'Score Multiplier'}
                  </div>
                  <div className="font-mono font-black text-purple-300">
                    {inspectedForm.scoreMult}x
                  </div>
                </div>
              </div>

              {/* Triple-Gate Unlock Checklist (if Locked) */}
              {!isInspectedUnlocked && (
                <div className="rounded-xl bg-slate-950/90 border border-amber-500/30 p-2.5 space-y-1.5 text-xs">
                  <div className="text-[11px] font-extrabold text-amber-300 flex items-center justify-between">
                    <span>
                      {lang === 'zh'
                        ? '🔓 破茧进化解锁条件'
                        : '🔓 Evolution Requirements'}
                    </span>
                    {unlockCheck.canUnlockNow && (
                      <span className="text-emerald-400">
                        ✓ {lang === 'zh' ? '全部满足' : 'Ready!'}
                      </span>
                    )}
                  </div>

                  {/* Gate 1: Parent Shark Upgrade Level */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">
                      1.{' '}
                      {lang === 'zh'
                        ? `前置鲨鱼强化 ≥ Lv.${inspectedForm.reqParentUpgradeLevel}`
                        : `Parent Shark ≥ Lv.${inspectedForm.reqParentUpgradeLevel}`}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        unlockCheck.parentMet
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {unlockCheck.parentMet
                        ? '✓'
                        : `Lv.${unlockCheck.bestParentCurrentLv}/${inspectedForm.reqParentUpgradeLevel}`}
                    </span>
                  </div>

                  {/* Gate 2: Max In-Run Level & Depth */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">
                      2.{' '}
                      {lang === 'zh'
                        ? `单局最高达到 Lv.${inspectedForm.reqMaxInRunLevel}${
                            inspectedForm.reqMaxDepth > 0
                              ? ` & 下潜 ${inspectedForm.reqMaxDepth}m`
                              : ''
                          }`
                        : `Reach Run Lv.${inspectedForm.reqMaxInRunLevel}${
                            inspectedForm.reqMaxDepth > 0
                              ? ` & ${inspectedForm.reqMaxDepth}m`
                              : ''
                          }`}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        unlockCheck.levelMet && unlockCheck.depthMet
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {unlockCheck.levelMet && unlockCheck.depthMet
                        ? '✓'
                        : `Lv.${maxLvRecord}/${inspectedForm.reqMaxInRunLevel}`}
                    </span>
                  </div>

                  {/* Gate 3: Coin & Gene Cost */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                    <span className="text-slate-300">
                      3. {lang === 'zh' ? '进化消耗' : 'Evolution Cost'}
                    </span>
                    <div className="flex items-center gap-2 font-mono font-bold">
                      <span
                        className={
                          unlockCheck.coinsMet
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }
                      >
                        🪙 {inspectedForm.unlockCoins.toLocaleString()}
                      </span>
                      <span
                        className={
                          unlockCheck.genesMet
                            ? 'text-emerald-300'
                            : 'text-rose-400'
                        }
                      >
                        🧬 {inspectedForm.unlockGenes.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
              {isInspectedUnlocked ? (
                <>
                  {/* Coin Upgrade Button (Lv.1 -> Lv.10) */}
                  <button
                    type="button"
                    data-testid="atlas-upgrade-btn"
                    disabled={
                      inspectedUpgradeLv >= 10 || totalCoins < upgradeCost
                    }
                    onClick={() => onUpgradeShark(inspectedForm.id)}
                    className={`w-full py-2 px-3 rounded-xl font-black text-xs flex items-center justify-between transition ${
                      inspectedUpgradeLv >= 10
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : totalCoins >= upgradeCost
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg cursor-pointer'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <span>
                      {inspectedUpgradeLv >= 10
                        ? lang === 'zh'
                          ? '★ 体质已强化至满级 (Lv.10)'
                          : '★ MAX UPGRADE (Lv.10)'
                        : lang === 'zh'
                        ? `⬆️ 强化体质 (Lv.${inspectedUpgradeLv} → Lv.${
                            inspectedUpgradeLv + 1
                          })`
                        : `⬆️ Upgrade Body (Lv.${inspectedUpgradeLv} → Lv.${
                            inspectedUpgradeLv + 1
                          })`}
                    </span>
                    {inspectedUpgradeLv < 10 && (
                      <span className="font-mono">
                        🪙 {upgradeCost.toLocaleString()}
                      </span>
                    )}
                  </button>

                  {/* Equip / Deploy Shark Form Button */}
                  <button
                    type="button"
                    data-testid="atlas-deploy-btn"
                    disabled={isInspectedActive}
                    onClick={() => onSelectActiveShark(inspectedForm.id)}
                    className={`w-full py-2 px-3 rounded-xl font-black text-xs transition ${
                      isInspectedActive
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                        : 'bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 shadow-lg cursor-pointer'
                    }`}
                  >
                    {isInspectedActive
                      ? lang === 'zh'
                        ? '🦈 当前正在使用该形态'
                        : '🦈 Currently Active Form'
                      : lang === 'zh'
                      ? '🦈 切换为当前出战鲨鱼'
                      : '🦈 Deploy This Shark Form'}
                  </button>
                </>
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
                  <span>🧬</span>
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
