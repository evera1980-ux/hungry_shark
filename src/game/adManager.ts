export type AdPlacement =
  | 'EVO_CLAIM_ALL'
  | 'REVIVE_FRENZY'
  | 'TRIAL_MAX_MECHA'
  | 'GENE_SUPPLY_DROP';

export type AdPlatformEnv = 'wx' | 'tt' | 'web';

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

declare global {
  interface Window {
    wx?: MiniGameSDK;
    tt?: MiniGameSDK;
  }
}

export class AdManager {
  private simulatedAdRunner: ((placement: AdPlacement, onReward: () => void, onCancel?: () => void) => void) | null = null;

  public detectPlatform(): AdPlatformEnv {
    if (typeof window === 'undefined') return 'web';
    if (window.wx && typeof window.wx.createRewardedVideoAd === 'function') {
      return 'wx';
    }
    if (window.tt && typeof window.tt.createRewardedVideoAd === 'function') {
      return 'tt';
    }
    return 'web';
  }

  public registerBrowserSimulator(
    runner: (placement: AdPlacement, onReward: () => void, onCancel?: () => void) => void
  ): void {
    this.simulatedAdRunner = runner;
  }

  public showRewardedVideoAd(
    placement: AdPlacement,
    onReward: () => void,
    onCancel?: () => void
  ): void {
    const env = this.detectPlatform();

    // 1. WeChat Mini-Game (window.wx) or Douyin Mini-Game (window.tt)
    const sdk = env === 'wx' ? window.wx : env === 'tt' ? window.tt : undefined;
    if (sdk && typeof sdk.createRewardedVideoAd === 'function') {
      try {
        const videoAd = sdk.createRewardedVideoAd({
          adUnitId: `adunit_${placement.toLowerCase()}`,
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
                // Fallback to simulated overlay if ad load fails in test environment
                if (this.simulatedAdRunner) {
                  this.simulatedAdRunner(placement, onReward, onCancel);
                } else {
                  onReward();
                }
              });
          });
        return;
      } catch {
        // Fall through to simulated overlay
      }
    }

    // 2. Browser / AI Studio Preview Simulated Rewarded Video Ad Overlay (3s countdown)
    if (this.simulatedAdRunner) {
      this.simulatedAdRunner(placement, onReward, onCancel);
    } else {
      onReward();
    }
  }

  public showInterstitialAd(adUnitId: string = 'adunit_interstitial_settlement'): void {
    const env = this.detectPlatform();
    const sdk = env === 'wx' ? window.wx : env === 'tt' ? window.tt : undefined;
    if (sdk && typeof sdk.createInterstitialAd === 'function') {
      try {
        const interstitialAd = sdk.createInterstitialAd({ adUnitId });
        interstitialAd.show().catch(() => {});
      } catch {
        // Ignore interstitial errors
      }
    }
  }
}

export const adManager = new AdManager();
