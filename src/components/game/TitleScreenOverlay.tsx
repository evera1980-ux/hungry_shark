import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lang } from '../../game/i18n';
import { SharkFormConfig } from '../../game/sharkEvolutionConfig';
import { GameState } from '../../game/sim/types';
import { UiBannerButton } from '../UiAtlasIcon';

export interface TitleScreenOverlayProps {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  gameState: GameState;
  unlockedTotalCount: number;
  trialTargetForm: SharkFormConfig;
  setShowAtlasModal: React.Dispatch<React.SetStateAction<boolean>>;
  startNewRun: (withTrialShark?: boolean) => void;
  handleTrialSharkAd: () => void;
}

export const TitleScreenOverlay: React.FC<TitleScreenOverlayProps> = ({
  lang,
  t,
  gameState,
  unlockedTotalCount,
  trialTargetForm,
  setShowAtlasModal,
  startNewRun,
  handleTrialSharkAd,
}) => {
  return (
      <AnimatePresence>
        {gameState === 'title' && (
          <motion.section
            key="title-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-label={t('game_title')}
            className="fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-3.5 md:p-4 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 35%, rgba(2, 132, 199, 0.12) 0%, rgba(2, 6, 23, 0.78) 100%)',
            }}
          >
            {/* Top Section: Maximized Wide Horizontal Title Banner (3.57:1 aspect ratio, 100% unobstructed top zone) */}
            <div className="w-full flex flex-col items-center pt-0.5 sm:pt-1">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -14 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="landscape-title-wrap w-full max-w-6xl mx-auto flex flex-col items-center text-center pointer-events-auto"
              >
                <h1 className="flex items-center justify-center">
                  <img
                    src="/assets/aistudio/title3_cae0290c.webp"
                    alt={t('game_title')}
                    draggable={false}
                    style={{
                      width: 'min(760px, 74vw, calc(36dvh * 3.566))',
                    }}
                    className="h-auto object-contain object-top select-none drop-shadow-[0_10px_26px_rgba(0,0,0,0.9)]"
                  />
                  <span className="sr-only">{t('game_title')}</span>
                </h1>
              </motion.div>
            </div>

            {/* Bottom Section: 3 Primary Action Buttons (Moved further downward so center shark stage is 100% unobstructed) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="mb-6 sm:mb-8 md:mb-10 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full pointer-events-auto"
            >
              <UiBannerButton
                variant="green"
                dataStart={true}
                dataTestId="start-game-btn"
                onClick={() => startNewRun(false)}
                className="w-[154px] sm:w-[144px] md:w-[160px]"
                labelClassName="text-[10px] sm:text-[10.5px] md:text-[11.5px]"
              >
                {t('btn_start')}
              </UiBannerButton>

              <UiBannerButton
                variant="blue"
                dataTestId="open-atlas-btn"
                onClick={() => setShowAtlasModal(true)}
                className="w-[154px] sm:w-[140px] md:w-[157px]"
                labelClassName="text-[10px] sm:text-[10.5px] md:text-[11.5px]"
              >
                {lang === 'zh' ? '进化' : 'Evolution'} ({unlockedTotalCount}
                /48)
              </UiBannerButton>

              <UiBannerButton
                variant="gold"
                dataTestId="trial-mecha-btn"
                onClick={handleTrialSharkAd}
                className="w-[154px] sm:w-[144px] md:w-[162px]"
                labelClassName="text-[9.5px] sm:text-[10px] md:text-[11px]"
              >
                {lang === 'zh'
                  ? `试玩 · ${trialTargetForm.nameZh}`
                  : `Trial · ${trialTargetForm.nameEn}`}
              </UiBannerButton>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
  );
};
