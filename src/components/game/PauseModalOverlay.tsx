import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lang } from '../../game/i18n';
import { SharkFormConfig } from '../../game/sharkEvolutionConfig';
import { GameState, HudStateSnapshot } from '../../game/sim/types';
import { SharkFormCanvasPreview } from '../SharkFormCanvasPreview';
import {
  UiSettingButton,
  UiSettingModalFrame,
  UiSettingSharkCard,
} from '../UiAtlasIcon';

export interface PauseModalOverlayProps {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  setShowAtlasModal: React.Dispatch<React.SetStateAction<boolean>>;
  isMuted: boolean;
  replayTutorialOnboarding: () => void;
  hudState: HudStateSnapshot;
  startNewRun: (withMaxMechaTrial?: boolean) => void;
  toggleLanguage: () => void;
  toggleMute: (e: React.MouseEvent<HTMLButtonElement>) => void;
  activeHudSharkForm: SharkFormConfig;
}

export const PauseModalOverlay: React.FC<PauseModalOverlayProps> = ({
  lang,
  t,
  gameState,
  setGameState,
  setShowAtlasModal,
  isMuted,
  replayTutorialOnboarding,
  hudState,
  startNewRun,
  toggleLanguage,
  toggleMute,
  activeHudSharkForm,
}) => {
  return (
      <AnimatePresence>
        {gameState === 'paused' && (
          <motion.div
            key="pause-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('btn_pause')}
            className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 pointer-events-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-[630px] flex items-center justify-center"
            >
              <UiSettingModalFrame
                dataTestId="pause-setting-modal"
                title={lang === 'zh' ? '暂停' : 'PAUSE'}
              >
                {/* Subtitle: Unlocked Shark Forms */}
                <p className="h-[6.5%] shrink-0 flex items-center justify-center text-[2.45cqw] font-display font-bold text-slate-200/95 tracking-wide text-center leading-none">
                  {lang === 'zh'
                    ? `已解锁鲨鱼形态: ${hudState.unlockedFormsCount} / 48`
                    : `Unlocked Shark Forms: ${hudState.unlockedFormsCount} / 48`}
                </p>

                {/* Row 1: Shortened Shark Summary Card + Right Evolve Button */}
                <UiSettingSharkCard
                  dataTestId="pause-avatar-data-bar"
                  onClick={() => setShowAtlasModal(true)}
                  avatarContent={
                    <SharkFormCanvasPreview
                      sharkId={activeHudSharkForm.id}
                      width={84}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  }
                  sharkName={
                    lang === 'zh'
                      ? activeHudSharkForm.nameZh
                      : activeHudSharkForm.nameEn
                  }
                  subtitle={
                    lang === 'zh'
                      ? `强化等级 Lv.${hudState.activeUpgradeLevel}/10 · 咬合 T${hudState.biteTier}`
                      : `Body Level Lv.${hudState.activeUpgradeLevel}/10 · Bite T${hudState.biteTier}`
                  }
                  actionButton={
                    <UiSettingButton
                      settingKey="SETTING_BTN_EVOLVE"
                      dataTestId="pause-atlas-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAtlasModal(true);
                      }}
                      className="w-full h-full"
                      labelClassName="text-[2.25cqw]"
                    >
                      {lang === 'zh' ? '进化' : 'Evolve'}
                    </UiSettingButton>
                  }
                />

                {/* Row 2: Wide Green Resume Hunting Button */}
                <UiSettingButton
                  settingKey="SETTING_BTN_RESUME"
                  dataTestId="pause-resume-btn"
                  onClick={() => setGameState('playing')}
                  className="w-full h-[17.5%] shrink-0"
                  labelClassName="text-[3.35cqw]"
                >
                  {lang === 'zh' ? '继续狩猎' : t('btn_resume')}
                </UiSettingButton>

                {/* Row 3: 2-Column Language Toggle + Audio Toggle */}
                <div className="grid grid-cols-2 gap-[2.2cqw] w-full h-[13.8%] shrink-0">
                  <UiSettingButton
                    settingKey="SETTING_BTN_LANG"
                    onClick={toggleLanguage}
                    className="w-full h-full"
                    labelClassName="text-[2.3cqw]"
                  >
                    {t('btn_lang_toggle')} ({lang.toUpperCase()})
                  </UiSettingButton>

                  <UiSettingButton
                    settingKey="SETTING_BTN_SOUND"
                    onClick={toggleMute}
                    className="w-full h-full"
                    labelClassName="text-[2.3cqw]"
                  >
                    {lang === 'zh'
                      ? isMuted
                        ? '音效: 关'
                        : '音效: 开'
                      : isMuted
                      ? 'Audio: OFF'
                      : 'Audio: ON'}
                  </UiSettingButton>
                </div>

                {/* Row 4: Full-Width Gold Replay Onboarding Tutorial Button */}
                <UiSettingButton
                  settingKey="SETTING_BTN_TUTORIAL"
                  onClick={replayTutorialOnboarding}
                  className="w-full h-[13.8%] shrink-0"
                  labelClassName="text-[2.35cqw]"
                >
                  {lang === 'zh' ? '重温新手引导' : 'Replay Onboarding Tutorial'}
                </UiSettingButton>

                {/* Row 5: 2-Column Restart Run + Return to Main Menu */}
                <div className="grid grid-cols-2 gap-[2.2cqw] w-full h-[13.2%] shrink-0">
                  <UiSettingButton
                    settingKey="SETTING_BTN_RESTART"
                    onClick={() => startNewRun(false)}
                    className="w-full h-full"
                    labelClassName="text-[2.25cqw]"
                  >
                    {lang === 'zh' ? '重新开始' : 'Restart'}
                  </UiSettingButton>

                  <UiSettingButton
                    settingKey="SETTING_BTN_MAIN_MENU"
                    onClick={() => setGameState('title')}
                    className="w-full h-full"
                    labelClassName="text-[2.25cqw]"
                  >
                    {lang === 'zh' ? '返回主界面' : 'Main Menu'}
                  </UiSettingButton>
                </div>
              </UiSettingModalFrame>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};
