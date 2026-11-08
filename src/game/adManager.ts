export type AdPlacement =
  | 'EVO_CLAIM_ALL'
  | 'REVIVE_FRENZY'
  | 'TRIAL_MAX_MECHA'
  | 'GENE_SUPPLY_DROP';

export type AdPlatformEnv = 'admob' | 'h5_ads' | 'wx' | 'tt' | 'web';

/**
 * Single Source of Truth for Google AdMob (iOS / Android) & Google H5 Games Ads (AdSense for Games).
 * Synced automatically into `./ios-native/` via `npm run build:ios`.
 */
export const GOOGLE_ADS_CONFIG = {
  /** Google AdMob App ID (Android / iOS) */
  admobAppId:
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: Record<string, string> }).env
        ?.VITE_GOOGLE_ADMOB_APP_ID) ||
    'ca-app-pub-9273669553362347~9016886171',

  /** Google AdMob Rewarded Video Ad Unit ID */
  admobRewardedAdUnitId:
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: Record<string, string> }).env
        ?.VITE_GOOGLE_ADMOB_REWARDED_AD_UNIT_ID) ||
    'ca-app-pub-9273669553362347/8698331137',

  /** Google AdSense for Games / H5 Games Ads Client ID (Publisher ID) */
  h5ClientId:
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: Record<string, string> }).env
        ?.VITE_GOOGLE_H5_CLIENT_ID) ||
    'ca-pub-9273669553362347',
} as const;

interface MiniGameVideoAd {
  show: () => Promise<void>;
  load: () => Promise<void>;
  onClose: (cb: (res: { isEnded: boolean }) => void) => void;
  offClose?: (cb: (res: { isEnded: boolean }) => void) => void;
  onError?: (cb: (err: unknown) => void) => void;
}

interface MiniGameInterstitialAd {
  show: () => Promise<void>;
}

interface MiniGameSDK {
  createRewardedVideoAd?: (opts: { adUnitId: string }) => MiniGameVideoAd;
  createInterstitialAd?: (opts: { adUnitId: string }) => MiniGameInterstitialAd;
}

interface H5AdBreakPlacementInfo {
  breakType: string;
  breakName: string;
  breakFormat: 'interstitial' | 'reward';
  breakStatus:
    | 'viewed'
    | 'dismissed'
    | 'notReady'
    | 'noAdPreloaded'
    | 'other'
    | 'error'
    | 'invalid'
    | 'ignored'
    | 'frequencyCapped';
}

interface H5AdBreakOptions {
  type: 'start' | 'pause' | 'next' | 'browse' | 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: H5AdBreakPlacementInfo) => void;
}

interface H5AdConfigOptions {
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  onReady?: () => void;
}

interface CapacitorAdMobPlugin {
  initialize?: (opts?: { initializeForTesting?: boolean }) => Promise<void>;
  prepareRewardVideoAd?: (opts: { adId: string }) => Promise<void>;
  showRewardVideoAd?: () => Promise<{ type?: string; amount?: number }>;
}

declare global {
  interface Window {
    wx?: MiniGameSDK;
    tt?: MiniGameSDK;
    adsbygoogle?: unknown[];
    adBreak?: (opts: H5AdBreakOptions) => void;
    adConfig?: (opts: H5AdConfigOptions) => void;
    Capacitor?: {
      Plugins?: {
        AdMob?: CapacitorAdMobPlugin;
      };
    };
    admob?: {
      rewarded?: {
        load?: (opts: { id: string }) => Promise<void>;
        show?: () => Promise<void>;
      };
    };
  }
}

export class AdManager {
  private simulatedAdRunner:
    | ((placement: AdPlacement, onReward: () => void, onCancel?: () => void) => void)
    | null = null;
  private h5AdsReady = false;
  private admobInitialized = false;

  constructor() {
    this.initGoogleAdsRuntime();
  }

  private initGoogleAdsRuntime(): void {
    if (typeof window === 'undefined') return;

    // 1. Initialize Google H5 Games Ads Placement API if present
    try {
      if (typeof window.adConfig === 'function') {
        window.adConfig({
          preloadAdBreaks: 'on',
          sound: 'on',
          onReady: () => {
            this.h5AdsReady = true;
          },
        });
      }
    } catch {
      // Ignore if blocked by browser extension
    }

    // 2. Initialize Native Capacitor AdMob bridge if running inside hybrid native shell
    try {
      const capAdMob = window.Capacitor?.Plugins?.AdMob;
      if (capAdMob && typeof capAdMob.initialize === 'function' && !this.admobInitialized) {
        this.admobInitialized = true;
        capAdMob.initialize({ initializeForTesting: false }).catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  public getConfig() {
    return GOOGLE_ADS_CONFIG;
  }

  public detectPlatform(): AdPlatformEnv {
    if (typeof window === 'undefined') return 'web';
    if (
      window.Capacitor?.Plugins?.AdMob ||
      window.admob?.rewarded
    ) {
      return 'admob';
    }
    if (window.wx && typeof window.wx.createRewardedVideoAd === 'function') {
      return 'wx';
    }
    if (window.tt && typeof window.tt.createRewardedVideoAd === 'function') {
      return 'tt';
    }
    if (this.h5AdsReady && typeof window.adBreak === 'function') {
      return 'h5_ads';
    }
    return 'web';
  }

  public registerBrowserSimulator(
    runner: (placement: AdPlacement, onReward: () => void, onCancel?: () => void) => void
  ): void {
    this.simulatedAdRunner = runner;
  }

  private runFallbackSimulator(
    placement: AdPlacement,
    onReward: () => void,
    onCancel?: () => void
  ): void {
    if (this.simulatedAdRunner) {
      this.simulatedAdRunner(placement, onReward, onCancel);
    } else {
      onReward();
    }
  }

  public showRewardedVideoAd(
    placement: AdPlacement,
    onReward: () => void,
    onCancel?: () => void
  ): void {
    if (typeof window === 'undefined') {
      onReward();
      return;
    }

    // 1. Native AdMob Plugin Bridge (Capacitor / Cordova) using GOOGLE_ADMOB_REWARDED_AD_UNIT_ID
    const capAdMob = window.Capacitor?.Plugins?.AdMob;
    if (
      capAdMob &&
      typeof capAdMob.prepareRewardVideoAd === 'function' &&
      typeof capAdMob.showRewardVideoAd === 'function'
    ) {
      capAdMob
        .prepareRewardVideoAd({ adId: GOOGLE_ADS_CONFIG.admobRewardedAdUnitId })
        .then(() => capAdMob.showRewardVideoAd!())
        .then(() => {
          onReward();
        })
        .catch(() => {
          this.runFallbackSimulator(placement, onReward, onCancel);
        });
      return;
    }

    // 2. WeChat Mini-Game (window.wx) or Douyin Mini-Game (window.tt)
    const env = this.detectPlatform();
    const sdk = env === 'wx' ? window.wx : env === 'tt' ? window.tt : undefined;
    if (sdk && typeof sdk.createRewardedVideoAd === 'function') {
      try {
        const videoAd = sdk.createRewardedVideoAd({
          adUnitId: GOOGLE_ADS_CONFIG.admobRewardedAdUnitId,
        });
        const handleClose = (res: { isEnded: boolean }) => {
          if (videoAd.offClose) videoAd.offClose(handleClose);
          if (res && res.isEnded) {
            onReward();
          } else if (onCancel) {
            onCancel();
          }
        };
        videoAd.onClose(handleClose);
        videoAd
          .show()
          .catch(() => {
            videoAd
              .load()
              .then(() => videoAd.show())
              .catch(() => {
                this.runFallbackSimulator(placement, onReward, onCancel);
              });
          });
        return;
      } catch {
        // Fall through to Google H5 Games Ads
      }
    }

    // 3. Google AdSense for Games / H5 Games Ads Placement API (ca-pub-9273669553362347)
    if (typeof window.adBreak === 'function') {
      let settled = false;
      let adStartedShowing = false;

      // Safety watchdog: if H5 AdSense script is still pending domain review or blocked by adblocker,
      // smoothly fall back to the 3s in-game simulated ad overlay after 900ms so player never hangs.
      const watchdog = window.setTimeout(() => {
        if (!settled && !adStartedShowing) {
          settled = true;
          this.runFallbackSimulator(placement, onReward, onCancel);
        }
      }, 900);

      try {
        window.adBreak({
          type: 'reward',
          name: placement.toLowerCase(),
          beforeReward: (showAdFn) => {
            adStartedShowing = true;
            window.clearTimeout(watchdog);
            showAdFn();
          },
          adViewed: () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(watchdog);
            onReward();
          },
          adDismissed: () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(watchdog);
            if (onCancel) onCancel();
          },
          adBreakDone: (placementInfo) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(watchdog);
            if (placementInfo.breakStatus === 'viewed') {
              onReward();
            } else if (placementInfo.breakStatus === 'dismissed') {
              if (onCancel) onCancel();
            } else {
              // No fill / notReady / frequencyCapped in dev or preview -> fallback simulator
              this.runFallbackSimulator(placement, onReward, onCancel);
            }
          },
        });
        return;
      } catch {
        window.clearTimeout(watchdog);
      }
    }

    // 4. Browser / AI Studio Preview Simulated Rewarded Video Ad Overlay (3s countdown)
    this.runFallbackSimulator(placement, onReward, onCancel);
  }

  public showInterstitialAd(
    adUnitId: string = GOOGLE_ADS_CONFIG.admobRewardedAdUnitId
  ): void {
    if (typeof window === 'undefined') return;

    const env = this.detectPlatform();
    const sdk = env === 'wx' ? window.wx : env === 'tt' ? window.tt : undefined;
    if (sdk && typeof sdk.createInterstitialAd === 'function') {
      try {
        const interstitialAd = sdk.createInterstitialAd({ adUnitId });
        interstitialAd.show().catch(() => {});
        return;
      } catch {
        // Ignore interstitial errors
      }
    }

    if (typeof window.adBreak === 'function') {
      try {
        window.adBreak({
          type: 'next',
          name: 'settlement_interstitial',
        });
      } catch {
        // Ignore
      }
    }
  }
}

export const adManager = new AdManager();
