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

  /** Google AdMob Official iOS Rewarded Video Backup Unit ID (used only when production unit returns No-Fill in Simulator/Dev) */
  admobIosBackupRewardedAdUnitId: 'ca-app-pub-3940256099942544/1712485313',

  /** Google AdSense for Games / H5 Games Ads Client ID (Publisher ID) */
  h5ClientId:
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: Record<string, string> }).env
        ?.VITE_GOOGLE_H5_CLIENT_ID) ||
    'ca-pub-9273669553362347',

  /** Google IMA HTML5 VAST Rewarded Video Tag (serves real Google video ads in web/iframe environments) */
  imaVastTagUrl:
    'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250,728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s',

  /** Google Cloud sample video stream fallback if browser adblocker blocks DoubleClick VAST XML */
  fallbackVideoStreamUrl:
    'https://storage.googleapis.com/gvabox/media/samples/stock.mp4',
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

// Google IMA HTML5 SDK minimal types
export interface GoogleImaNamespace {
  AdDisplayContainer: new (
    containerElement: HTMLElement,
    videoElement: HTMLVideoElement
  ) => {
    initialize: () => void;
    destroy: () => void;
  };
  AdsLoader: new (container: unknown) => {
    addEventListener: (
      event: string,
      handler: (e: any) => void,
      useCapture?: boolean
    ) => void;
    requestAds: (request: unknown) => void;
    contentComplete: () => void;
    destroy: () => void;
  };
  AdsRequest: new () => {
    adTagUrl: string;
    linearAdSlotWidth: number;
    linearAdSlotHeight: number;
    nonLinearAdSlotWidth: number;
    nonLinearAdSlotHeight: number;
  };
  AdsManagerLoadedEvent: {
    Type: {
      ADS_MANAGER_LOADED: string;
    };
  };
  AdErrorEvent: {
    Type: {
      AD_ERROR: string;
    };
  };
  AdEvent: {
    Type: {
      LOADED: string;
      STARTED: string;
      COMPLETE: string;
      ALL_ADS_COMPLETED: string;
      SKIPPED: string;
      USER_CLOSE: string;
      CLICK: string;
    };
  };
  ViewMode: {
    NORMAL: string;
    FULLSCREEN: string;
  };
   AdsRenderingSettings: new () => {
    restoreCustomPlaybackStateOnAdBreakComplete: boolean;
    enablePreloading: boolean;
  };
}

declare global {
  interface Window {
    wx?: MiniGameSDK;
    tt?: MiniGameSDK;
    adsbygoogle?: unknown[] & { loaded?: boolean };
    adBreak?: (opts: H5AdBreakOptions) => void;
    adConfig?: (opts: H5AdConfigOptions) => void;
    google?: {
      ima?: GoogleImaNamespace;
    };
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
  private webVideoAdRunner:
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
    if (window.Capacitor?.Plugins?.AdMob || window.admob?.rewarded) {
      return 'admob';
    }
    if (window.wx && typeof window.wx.createRewardedVideoAd === 'function') {
      return 'wx';
    }
    if (window.tt && typeof window.tt.createRewardedVideoAd === 'function') {
      return 'tt';
    }
    if (this.h5AdsReady || window.google?.ima) {
      return 'h5_ads';
    }
    return 'web';
  }

  public registerBrowserSimulator(
    runner: (placement: AdPlacement, onReward: () => void, onCancel?: () => void) => void
  ): void {
    this.webVideoAdRunner = runner;
  }

  private runWebVideoAdPlayer(
    placement: AdPlacement,
    onReward: () => void,
    onCancel?: () => void
  ): void {
    if (this.webVideoAdRunner) {
      this.webVideoAdRunner(placement, onReward, onCancel);
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
          this.runWebVideoAdPlayer(placement, onReward, onCancel);
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
                this.runWebVideoAdPlayer(placement, onReward, onCancel);
              });
          });
        return;
      } catch {
        // Fall through to Google H5 Games Ads / IMA SDK
      }
    }

    // 3. Google AdSense for Games / H5 Games Ads Placement API (ca-pub-9273669553362347)
    // Only invoke adBreak first if adsbygoogle script has loaded and we are not blocked in an iframe;
    // otherwise launch the Google IMA HTML5 Video Ad Player immediately.
    if (typeof window.adBreak === 'function' && this.h5AdsReady) {
      let settled = false;
      let adStartedShowing = false;

      const watchdog = window.setTimeout(() => {
        if (!settled && !adStartedShowing) {
          settled = true;
          this.runWebVideoAdPlayer(placement, onReward, onCancel);
        }
      }, 650);

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
              // H5 adBreak returned notReady/noAdPreloaded -> Launch Google IMA HTML5 Video Ad Player
              this.runWebVideoAdPlayer(placement, onReward, onCancel);
            }
          },
        });
        return;
      } catch {
        window.clearTimeout(watchdog);
      }
    }

    // 4. Launch Google IMA HTML5 Video Ad Player (serves real VAST video ads via google.ima.AdsLoader)
    this.runWebVideoAdPlayer(placement, onReward, onCancel);
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
