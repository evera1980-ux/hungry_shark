import React, { useEffect, useRef, useState } from 'react';
import { AdPlacement, GOOGLE_ADS_CONFIG } from '../game/adManager';
import { Lang } from '../game/i18n';

interface GoogleRewardedVideoAdOverlayProps {
  placement: AdPlacement;
  lang: Lang;
  onReward: () => void;
  onCancel?: () => void;
}

export const GoogleRewardedVideoAdOverlay: React.FC<
  GoogleRewardedVideoAdOverlayProps
> = ({ placement, lang, onReward, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adContainerRef = useRef<HTMLDivElement | null>(null);
  const adsManagerRef = useRef<any>(null);
  const adsLoaderRef = useRef<any>(null);
  const adDisplayContainerRef = useRef<any>(null);

  const [secondsLeft, setSecondsLeft] = useState<number>(5);
  const [rewardUnlocked, setRewardUnlocked] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [usingDirectStream, setUsingDirectStream] = useState<boolean>(false);
  const [adStatusText, setAdStatusText] = useState<string>(
    lang === 'zh' ? '正在加载 Google 视频广告...' : 'Loading Google Video Ad...'
  );

  // Countdown timer for reward eligibility
  useEffect(() => {
    if (rewardUnlocked) return;
    if (secondsLeft <= 0) {
      setRewardUnlocked(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setRewardUnlocked(true);
        }
        return next;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, rewardUnlocked]);

  // Boot Google IMA HTML5 Video SDK (or direct HTML5 MP4 video stream if blocked by adblocker)
  useEffect(() => {
    let cancelled = false;
    const videoEl = videoRef.current;
    const containerEl = adContainerRef.current;
    if (!videoEl || !containerEl) return;

    const startDirectStreamVideo = () => {
      if (cancelled) return;
      setUsingDirectStream(true);
      setAdStatusText(
        lang === 'zh'
          ? 'Google AdMob / H5 激励视频广告'
          : 'Google AdMob / H5 Rewarded Video'
      );
      try {
        videoEl.src = GOOGLE_ADS_CONFIG.fallbackVideoStreamUrl;
        videoEl.muted = false;
        videoEl.currentTime = 0;
        const playPromise = videoEl.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            videoEl.muted = true;
            setIsMuted(true);
            videoEl.play().catch(() => {});
          });
        }
      } catch {
        // Ignore playback errors
      }
    };

    const ima = window.google?.ima;
    if (!ima) {
      startDirectStreamVideo();
      return;
    }

    try {
      const adDisplayContainer = new ima.AdDisplayContainer(
        containerEl,
        videoEl
      );
      adDisplayContainer.initialize();
      adDisplayContainerRef.current = adDisplayContainer;

      const adsLoader = new ima.AdsLoader(adDisplayContainer);
      adsLoaderRef.current = adsLoader;

      adsLoader.addEventListener(
        ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (adsManagerLoadedEvent: any) => {
          if (cancelled) return;
          try {
            const adsRenderingSettings = new ima.AdsRenderingSettings();
            adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
            adsRenderingSettings.enablePreloading = true;

            const adsManager = adsManagerLoadedEvent.getAdsManager(
              videoEl,
              adsRenderingSettings
            );
            adsManagerRef.current = adsManager;

            adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => {
              try {
                adsManager.destroy();
              } catch {
                // Ignore
              }
              startDirectStreamVideo();
            });

            adsManager.addEventListener(ima.AdEvent.Type.STARTED, () => {
              if (cancelled) return;
              setAdStatusText(
                lang === 'zh'
                  ? 'Google IMA 激励视频播放中'
                  : 'Google IMA Rewarded Video Playing'
              );
            });

            const handleImaComplete = () => {
              if (cancelled) return;
              setSecondsLeft(0);
              setRewardUnlocked(true);
              onReward();
            };

            adsManager.addEventListener(
              ima.AdEvent.Type.COMPLETE,
              handleImaComplete
            );
            adsManager.addEventListener(
              ima.AdEvent.Type.ALL_ADS_COMPLETED,
              handleImaComplete
            );
            adsManager.addEventListener(
              ima.AdEvent.Type.SKIPPED,
              handleImaComplete
            );

            const rect = containerEl.getBoundingClientRect();
            const w = Math.max(320, Math.round(rect.width || window.innerWidth));
            const h = Math.max(
              240,
              Math.round(rect.height || window.innerHeight - 90)
            );
            adsManager.init(w, h, ima.ViewMode.NORMAL);
            adsManager.start();
          } catch {
            startDirectStreamVideo();
          }
        },
        false
      );

      adsLoader.addEventListener(
        ima.AdErrorEvent.Type.AD_ERROR,
        () => {
          startDirectStreamVideo();
        },
        false
      );

      const adsRequest = new ima.AdsRequest();
      const correlator = Date.now();
      const pageUrl = encodeURIComponent(window.location.href);
      adsRequest.adTagUrl = `${GOOGLE_ADS_CONFIG.imaVastTagUrl}&correlator=${correlator}&description_url=${pageUrl}&cust_params=${encodeURIComponent(
        `client=${GOOGLE_ADS_CONFIG.h5ClientId}&placement=${placement}`
      )}`;
      const rect = containerEl.getBoundingClientRect();
      adsRequest.linearAdSlotWidth = Math.max(
        320,
        Math.round(rect.width || 640)
      );
      adsRequest.linearAdSlotHeight = Math.max(
        240,
        Math.round(rect.height || 360)
      );
      adsRequest.nonLinearAdSlotWidth = adsRequest.linearAdSlotWidth;
      adsRequest.nonLinearAdSlotHeight = Math.round(
        adsRequest.linearAdSlotHeight / 3
      );

      adsLoader.requestAds(adsRequest);
    } catch {
      startDirectStreamVideo();
    }

    return () => {
      cancelled = true;
      try {
        adsManagerRef.current?.destroy?.();
        adsLoaderRef.current?.destroy?.();
        adDisplayContainerRef.current?.destroy?.();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [lang, onReward, placement]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    try {
      if (adsManagerRef.current?.setVolume) {
        adsManagerRef.current.setVolume(nextMuted ? 0 : 1);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Google Rewarded Video Ad"
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between pointer-events-auto select-none"
    >
      {/* Top Official Google Ad Header Bar */}
      <div className="relative z-20 flex items-center justify-between px-3 sm:px-5 py-2.5 bg-gradient-to-b from-black/90 to-black/40 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono-num font-black text-[10px] tracking-wider uppercase shrink-0">
            Ad
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white/90 truncate">
            {adStatusText}
          </span>
          <span className="hidden md:inline-block text-[11px] font-mono text-slate-400 truncate">
            ({GOOGLE_ADS_CONFIG.admobRewardedAdUnitId} · {GOOGLE_ADS_CONFIG.h5ClientId})
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            {isMuted
              ? lang === 'zh'
                ? '🔇 静音'
                : '🔇 Muted'
              : lang === 'zh'
                ? '🔊 声音'
                : '🔊 Sound'}
          </button>

          {rewardUnlocked ? (
            <button
              type="button"
              onClick={onReward}
              className="px-3.5 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer transition-transform active:scale-95"
            >
              {lang === 'zh' ? '✓ 领取奖励并关闭' : '✓ Claim Reward & Close'}
            </button>
          ) : (
            <div className="px-3 py-1 rounded-full bg-white/15 text-amber-300 font-mono-num font-bold text-xs">
              {lang === 'zh'
                ? `${secondsLeft} 秒后可领取奖励`
                : `Reward in ${secondsLeft}s`}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (rewardUnlocked) {
                onReward();
              } else if (onCancel) {
                onCancel();
              }
            }}
            title={lang === 'zh' ? '关闭广告' : 'Close Ad'}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Central Full-Screen Video & Google IMA SDK Container */}
      <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          onEnded={() => {
            setSecondsLeft(0);
            setRewardUnlocked(true);
            if (usingDirectStream) {
              onReward();
            }
          }}
          className="w-full h-full max-h-[82dvh] object-contain bg-black"
        />
        <div
          ref={adContainerRef}
          className="absolute inset-0 z-10 flex items-center justify-center"
        />
      </div>

      {/* Bottom Progress & Attribution Bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-black/90 border-t border-white/10 text-[11px] text-slate-400">
        <span>
          Google AdSense for Games · Publisher ID: {GOOGLE_ADS_CONFIG.h5ClientId}
        </span>
        <span>
          {rewardUnlocked
            ? lang === 'zh'
              ? '已达成激励条件'
              : 'Reward Unlocked'
            : lang === 'zh'
              ? '观看完整视频以解锁奖励'
              : 'Watch video to unlock reward'}
        </span>
      </div>
    </div>
  );
};
