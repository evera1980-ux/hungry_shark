import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lang } from '../../game/i18n';
import { adManager } from '../../game/adManager';
import {
  getSharkFormById,
  SharkFormConfig,
  SharkMetaSaveData,
} from '../../game/sharkEvolutionConfig';
import {
  GameState,
  HudStateSnapshot,
  RunSummarySnapshot,
} from '../../game/sim/types';
import { SharkFormCanvasPreview } from '../SharkFormCanvasPreview';
import {
  UiAtlasIcon,
  UiSettingButton,
  UiSettingModalFrame,
  UiSettingSharkCard,
} from '../UiAtlasIcon';

export interface GameOverModalOverlayProps {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  metaSave: SharkMetaSaveData;
  setShowAtlasModal: React.Dispatch<React.SetStateAction<boolean>>;
  reviveOffered: boolean;
  setReviveOffered: React.Dispatch<React.SetStateAction<boolean>>;
  runSnapshot: RunSummarySnapshot;
  hudState: HudStateSnapshot;
  startNewRun: (withMaxMechaTrial?: boolean) => void;
  handleReviveWithFrenzyAd: () => void;
  handleTrialMaxMechaAd: () => void;
  activeHudSharkForm: SharkFormConfig;
}

export const GameOverModalOverlay: React.FC<GameOverModalOverlayProps> = ({
  lang,
  t,
  gameState,
  setGameState,
  metaSave,
  setShowAtlasModal,
  reviveOffered,
  setReviveOffered,
  runSnapshot,
  hudState,
  startNewRun,
  handleReviveWithFrenzyAd,
  handleTrialMaxMechaAd,
  activeHudSharkForm,
}) => {
  return (
      <AnimatePresence>
        {gameState === 'gameover' && (
          <motion.div
            key="gameover-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            role="dialog"
            aria-modal="true"
            aria-label={reviveOffered ? t('gameover_title') : t('settlement_title')}
            className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 pointer-events-auto"
          >
            <motion.div
              key="gameover-modal-container"
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-[630px] flex items-center justify-center"
            >
              {reviveOffered ? (
                <UiSettingModalFrame
                  dataTestId="gameover-revive-modal"
                  variant="revive"
                  headerIconKey="UI_ICON_DANGER_SKULL"
                  title={lang === 'zh' ? '深海重创' : 'DEFEAT'}
                >
                  {/* Row 0: Emergency Warning Subtitle */}
                  <p className="h-[7.2%] shrink-0 flex items-center justify-center text-[2.15cqw] font-sans font-bold text-rose-200/95 tracking-wide text-center leading-none px-[1.5cqw]">
                    {t('gameover_subtitle')}
                  </p>

                  {/* Row 1: Fallen Predator & Unbanked Run Progress Card */}
                  <UiSettingSharkCard
                    dataTestId="gameover-revive-shark-card"
                    className="h-[24.0%]"
                    avatarContent={
                      <SharkFormCanvasPreview
                        sharkId={runSnapshot.activeSharkId}
                        width={84}
                        height={48}
                        className="w-full h-full object-contain"
                      />
                    }
                    sharkName={
                      <span className="inline-flex items-center gap-[1cqw]">
                        <span>
                          {lang === 'zh'
                            ? (getSharkFormById(runSnapshot.activeSharkId) ??
                                activeHudSharkForm).nameZh
                            : (getSharkFormById(runSnapshot.activeSharkId) ??
                                activeHudSharkForm).nameEn}
                        </span>
                        <span className="text-[2.1cqw] font-mono-num text-amber-300">
                          Lv.{runSnapshot.level} · T{hudState.biteTier}
                        </span>
                      </span>
                    }
                    subtitle={
                      lang === 'zh'
                        ? `当前得分 ${runSnapshot.score.toLocaleString()} · 下潜 ${runSnapshot.maxDepth}m · 已获 +${runSnapshot.coinsEarned}💰 +${runSnapshot.genesEarned}🧬`
                        : `Score ${runSnapshot.score.toLocaleString()} · Depth ${runSnapshot.maxDepth}m · +${runSnapshot.coinsEarned}💰 +${runSnapshot.genesEarned}🧬`
                    }
                    actionButton={
                      <div className="w-full h-full rounded-[1.2cqw] bg-gradient-to-r from-rose-950/95 via-amber-950/90 to-rose-950/95 border border-amber-400/55 shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center justify-center gap-[0.7cqw] px-[1cqw]">
                        <UiAtlasIcon
                          iconKey="UI_BTN_GOLD_FRENZY"
                          size={16}
                          className="!w-[3.2cqw] !h-[3.2cqw]"
                        />
                        <span className="font-display font-extrabold text-[1.95cqw] text-amber-200 whitespace-nowrap leading-none">
                          {lang === 'zh' ? '待复苏' : 'STASIS'}
                        </span>
                      </div>
                    }
                  />

                  {/* Row 2: 3-Column Sci-Fi Emergency Revive Buff Showcase */}
                  <div className="grid grid-cols-3 gap-[1.8cqw] w-full h-[26.5%] shrink-0">
                    <div className="rounded-[1.6cqw] bg-gradient-to-b from-[#13283c]/95 to-[#091322]/98 border border-emerald-400/40 shadow-[inset_0_1px_10px_rgba(16,185,129,0.18)] flex flex-col items-center justify-center px-[1.2cqw] text-center">
                      <UiAtlasIcon
                        iconKey="UI_BTN_BODY_UPGRADE"
                        size={24}
                        className="!w-[5.5cqw] !h-[5.5cqw] mb-[0.4cqw]"
                      />
                      <div className="font-display font-extrabold text-[2.1cqw] text-emerald-300 leading-tight whitespace-nowrap">
                        {lang === 'zh' ? '100% 满血修复' : '100% Full HP'}
                      </div>
                      <div className="text-[1.6cqw] font-sans text-slate-300/90 mt-[0.2cqw] leading-tight whitespace-nowrap">
                        {lang === 'zh' ? '装甲与生命全满' : 'Full Hull & Energy'}
                      </div>
                    </div>

                    <div className="rounded-[1.6cqw] bg-gradient-to-b from-[#2b2012]/95 to-[#120d08]/98 border border-amber-400/50 shadow-[inset_0_1px_12px_rgba(245,158,11,0.22)] flex flex-col items-center justify-center px-[1.2cqw] text-center">
                      <UiAtlasIcon
                        iconKey="UI_BTN_GOLD_FRENZY"
                        size={24}
                        className="!w-[5.5cqw] !h-[5.5cqw] mb-[0.4cqw]"
                      />
                      <div className="font-display font-extrabold text-[2.1cqw] text-amber-300 leading-tight whitespace-nowrap">
                        {lang === 'zh' ? '黄金狂暴冲刺' : 'Gold Frenzy'}
                      </div>
                      <div className="text-[1.6cqw] font-sans text-amber-100/90 mt-[0.2cqw] leading-tight whitespace-nowrap">
                        {lang === 'zh' ? '全属性暴走越阶' : 'Overdrive + Tier Up'}
                      </div>
                    </div>

                    <div className="rounded-[1.6cqw] bg-gradient-to-b from-[#132342]/95 to-[#081021]/98 border border-cyan-400/40 shadow-[inset_0_1px_10px_rgba(34,211,238,0.18)] flex flex-col items-center justify-center px-[1.2cqw] text-center">
                      <UiAtlasIcon
                        iconKey="UI_BTN_GENE_SURGE"
                        size={24}
                        className="!w-[5.5cqw] !h-[5.5cqw] mb-[0.4cqw]"
                      />
                      <div className="font-display font-extrabold text-[2.1cqw] text-cyan-300 leading-tight whitespace-nowrap">
                        {lang === 'zh' ? '无敌力场护盾' : 'Force Shield'}
                      </div>
                      <div className="text-[1.6cqw] font-sans text-slate-300/90 mt-[0.2cqw] leading-tight whitespace-nowrap">
                        {lang === 'zh' ? '免疫水雷与撕咬' : 'Hazard Immunity'}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Primary Gold Video Ad Revive Octagonal Button */}
                  <UiSettingButton
                    settingKey="SETTING_BTN_TUTORIAL"
                    customIconKey="UI_ICON_VIDEO_AD"
                    dataTestId="gameover-revive-ad-btn"
                    onClick={handleReviveWithFrenzyAd}
                    className="w-full h-[18.0%] shrink-0"
                    labelClassName="text-[2.75cqw]"
                  >
                    {t('btn_revive_ad')}
                  </UiSettingButton>

                  {/* Row 4: Secondary Steel Octagonal Give Up / Settle Run Button */}
                  <UiSettingButton
                    settingKey="SETTING_BTN_MAIN_MENU"
                    dataTestId="gameover-give-up-btn"
                    onClick={() => {
                      adManager.showInterstitialAd();
                      setReviveOffered(false);
                    }}
                    className="w-full h-[13.8%] shrink-0"
                    labelClassName="text-[2.3cqw]"
                  >
                    {t('btn_give_up')}
                  </UiSettingButton>
                </UiSettingModalFrame>
              ) : (
                <UiSettingModalFrame
                  dataTestId="gameover-settlement-modal"
                  variant="settlement"
                  headerIconKey="UI_ICON_SCORE_TROPHY"
                  title={lang === 'zh' ? '狩猎结算' : 'REPORT'}
                >
                  {/* Row 0: Permanent Account Banked Currencies Strip */}
                  <div className="h-[5.8%] shrink-0 flex items-center justify-center gap-[1.3cqw] text-[2.0cqw] font-sans font-bold text-slate-200/95 tracking-wide leading-none">
                    <span>
                      {lang === 'zh'
                        ? '本局金币与基因已永久存入账户：'
                        : 'Run coins & genes permanently banked:'}
                    </span>
                    <span className="text-amber-300 font-mono-num font-extrabold inline-flex items-center gap-[0.45cqw]">
                      <UiAtlasIcon
                        iconKey="UI_ICON_COIN"
                        size={14}
                        className="!w-[2.5cqw] !h-[2.5cqw]"
                      />
                      {metaSave.bankedCoins}
                    </span>
                    <span className="text-emerald-300 font-mono-num font-extrabold inline-flex items-center gap-[0.45cqw]">
                      <UiAtlasIcon
                        iconKey="UI_ICON_GENE"
                        size={14}
                        className="!w-[2.5cqw] !h-[2.5cqw]"
                      />
                      {metaSave.bankedGenes}
                    </span>
                  </div>

                  {/* Row 1: Returning Shark Summary Card + Direct Evolve Button */}
                  <UiSettingSharkCard
                    dataTestId="settlement-shark-card"
                    className="h-[21.0%]"
                    onClick={() => setShowAtlasModal(true)}
                    avatarContent={
                      <SharkFormCanvasPreview
                        sharkId={runSnapshot.activeSharkId}
                        width={84}
                        height={48}
                        className="w-full h-full object-contain"
                      />
                    }
                    sharkName={
                      <span className="inline-flex items-center gap-[0.8cqw]">
                        <span>
                          {lang === 'zh'
                            ? (getSharkFormById(runSnapshot.activeSharkId) ??
                                activeHudSharkForm).nameZh
                            : (getSharkFormById(runSnapshot.activeSharkId) ??
                                activeHudSharkForm).nameEn}
                        </span>
                        {runSnapshot.masteryCrownTier > 0 && (
                          <span className="text-[2.6cqw] leading-none">
                            {runSnapshot.masteryCrownTier === 3
                              ? '👑'
                              : runSnapshot.masteryCrownTier === 2
                              ? '🥈'
                              : '🥉'}
                          </span>
                        )}
                      </span>
                    }
                    subtitle={
                      lang === 'zh'
                        ? `强化 Lv.${hudState.activeUpgradeLevel}/10 · 咬合 T${hudState.biteTier} · 本局吞噬 ${runSnapshot.preyEaten} 条猎物`
                        : `Lv.${hudState.activeUpgradeLevel}/10 · Bite T${hudState.biteTier} · Devoured ${runSnapshot.preyEaten} Prey`
                    }
                    actionButton={
                      <UiSettingButton
                        settingKey="SETTING_BTN_EVOLVE"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAtlasModal(true);
                        }}
                        className="w-full h-full"
                        labelClassName="text-[2.2cqw]"
                      >
                        {lang === 'zh' ? '进化' : 'Evolve'}
                      </UiSettingButton>
                    }
                  />

                  {/* Row 2: 4-Column Sci-Fi Metallic Telemetry Grid */}
                  <div className="grid grid-cols-4 grid-rows-[minmax(0,1fr)] gap-[1.5cqw] w-full h-[21.0%] shrink-0 text-center overflow-hidden">
                    {/* Col 1: Final Score */}
                    <div className="rounded-[1.5cqw] bg-gradient-to-b from-[#162647]/95 to-[#091224]/98 border border-amber-400/35 shadow-[inset_0_1px_10px_rgba(251,191,36,0.14)] flex flex-col items-center justify-center px-[1cqw]">
                      <div className="text-[1.75cqw] font-sans font-bold text-slate-300 flex items-center justify-center gap-[0.5cqw] leading-none">
                        <span>{t('stat_final_score')}</span>
                        {runSnapshot.isNewRecord && (
                          <span className="px-[0.6cqw] py-[0.15cqw] rounded bg-amber-400 text-slate-950 font-black text-[1.4cqw] leading-none">
                            NEW!
                          </span>
                        )}
                      </div>
                      <div className="font-display font-extrabold text-[2.95cqw] text-white font-mono-num flex items-center justify-center gap-[0.5cqw] mt-[0.4cqw] leading-none">
                        <span>{runSnapshot.score}</span>
                      </div>
                      <div className="text-[1.55cqw] font-mono text-amber-200/80 mt-[0.35cqw] leading-none whitespace-nowrap">
                        {lang === 'zh' ? '最高' : 'PB'}:{' '}
                        {runSnapshot.personalBestScore.toLocaleString()}
                      </div>
                    </div>

                    {/* Col 2: Max Depth */}
                    <div className="rounded-[1.5cqw] bg-gradient-to-b from-[#132644]/95 to-[#091224]/98 border border-sky-400/35 shadow-[inset_0_1px_10px_rgba(56,189,248,0.14)] flex flex-col items-center justify-center px-[1cqw]">
                      <div className="text-[1.75cqw] font-sans font-bold text-slate-300 leading-none">
                        {t('stat_max_depth')}
                      </div>
                      <div className="font-display font-extrabold text-[2.95cqw] text-sky-300 font-mono-num mt-[0.4cqw] leading-none">
                        {runSnapshot.maxDepth}m
                      </div>
                      <div className="text-[1.55cqw] font-sans text-sky-200/75 mt-[0.35cqw] leading-none whitespace-nowrap">
                        {runSnapshot.maxDepth > 1150
                          ? lang === 'zh'
                            ? '深渊海沟带'
                            : 'Abyssal Trench'
                          : runSnapshot.maxDepth > 520
                          ? lang === 'zh'
                            ? '暮光中层带'
                            : 'Twilight Zone'
                          : lang === 'zh'
                          ? '阳光珊瑚礁'
                          : 'Sunlit Reef'}
                      </div>
                    </div>

                    {/* Col 3: Run Harvest */}
                    <div className="rounded-[1.5cqw] bg-gradient-to-b from-[#15283d]/95 to-[#091224]/98 border border-emerald-400/35 shadow-[inset_0_1px_10px_rgba(16,185,129,0.14)] flex flex-col items-center justify-center px-[1cqw]">
                      <div className="text-[1.75cqw] font-sans font-bold text-slate-300 leading-none">
                        {lang === 'zh' ? '本局收获' : 'Harvest'}
                      </div>
                      <div className="font-display font-extrabold text-[2.3cqw] text-amber-300 font-mono-num flex items-center justify-center gap-[0.8cqw] mt-[0.5cqw] leading-none whitespace-nowrap">
                        <span className="inline-flex items-center gap-[0.25cqw]">
                          +{runSnapshot.coinsEarned}
                          <UiAtlasIcon
                            iconKey="UI_ICON_COIN"
                            size={13}
                            className="!w-[2.2cqw] !h-[2.2cqw]"
                          />
                        </span>
                        <span className="inline-flex items-center gap-[0.25cqw] text-emerald-300">
                          +{runSnapshot.genesEarned}
                          <UiAtlasIcon
                            iconKey="UI_ICON_GENE"
                            size={13}
                            className="!w-[2.2cqw] !h-[2.2cqw]"
                          />
                        </span>
                      </div>
                      <div className="text-[1.55cqw] font-mono text-emerald-200/80 mt-[0.35cqw] leading-none whitespace-nowrap">
                        {runSnapshot.masteryGenesBonus > 0
                          ? `👑 +${runSnapshot.masteryGenesBonus}🧬`
                          : lang === 'zh'
                          ? '已永久入库'
                          : 'Banked'}
                      </div>
                    </div>

                    {/* Col 4: Evolution Progress */}
                    <div className="rounded-[1.5cqw] bg-gradient-to-b from-[#1e1b44]/95 to-[#0b0f24]/98 border border-purple-400/35 shadow-[inset_0_1px_10px_rgba(192,132,252,0.16)] flex flex-col items-center justify-center px-[1cqw]">
                      <div className="text-[1.75cqw] font-sans font-bold text-slate-300 leading-none">
                        {lang === 'zh' ? '进化进度' : 'Evolution'}
                      </div>
                      <div className="font-display font-extrabold text-[2.95cqw] text-purple-300 font-mono-num mt-[0.4cqw] leading-none">
                        {runSnapshot.unlockedFormsCount} / 48
                      </div>
                      <div className="text-[1.55cqw] font-mono text-purple-200/80 mt-[0.35cqw] leading-none whitespace-nowrap">
                        {lang === 'zh'
                          ? `图谱加成 +${Math.max(0, (runSnapshot.unlockedFormsCount - 1) * 2)}%`
                          : `Atlas +${Math.max(0, (runSnapshot.unlockedFormsCount - 1) * 2)}%`}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Primary Full-Width Glowing Emerald Play Again Button */}
                  <UiSettingButton
                    settingKey="SETTING_BTN_RESUME"
                    dataStart={true}
                    dataTestId="settlement-restart-btn"
                    onClick={() => startNewRun(false)}
                    className="w-full h-[15.8%] shrink-0"
                    labelClassName="text-[3.35cqw]"
                  >
                    {t('btn_restart')}
                  </UiSettingButton>

                  {/* Row 4: Full-Width Gold Trial Mecha Leviathan Button */}
                  <UiSettingButton
                    settingKey="SETTING_BTN_TUTORIAL"
                    customIconKey="UI_ICON_VIDEO_AD"
                    dataTestId="settlement-trial-mecha-btn"
                    onClick={handleTrialMaxMechaAd}
                    className="w-full h-[12.6%] shrink-0"
                    labelClassName="text-[2.35cqw]"
                  >
                    {lang === 'zh' ? '试驾机甲利维坦' : 'Trial Mecha'}
                  </UiSettingButton>

                  {/* Row 5: 2-Column Evolution / Upgrade + Return to Main Menu */}
                  <div className="grid grid-cols-2 grid-rows-[minmax(0,1fr)] gap-[2.2cqw] w-full h-[12.6%] shrink-0 overflow-hidden">
                    <UiSettingButton
                      settingKey="SETTING_BTN_LANG"
                      customIconKey="UI_ICON_GENE"
                      dataTestId="settlement-evolve-btn"
                      onClick={() => setShowAtlasModal(true)}
                      className="w-full h-full"
                      labelClassName="text-[2.25cqw]"
                    >
                      {lang === 'zh' ? '进化 / 强化' : 'Evolution'}
                    </UiSettingButton>

                    <UiSettingButton
                      settingKey="SETTING_BTN_MAIN_MENU"
                      dataTestId="settlement-main-menu-btn"
                      onClick={() => setGameState('title')}
                      className="w-full h-full"
                      labelClassName="text-[2.25cqw]"
                    >
                      {lang === 'zh' ? '返回主界面' : 'Main Menu'}
                    </UiSettingButton>
                  </div>
                </UiSettingModalFrame>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};
