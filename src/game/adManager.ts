import adsConfigJson from '../../shared/configs/ads_and_monetization_config.json';
import sharkEvolutionJson from '../../shared/configs/shark_evolution_config.json';

export type AdPlacement =
  | 'DOUBLE_SETTLEMENT'
  | 'REVIVE'
  | 'TRIAL_SHARK'
  | 'SUPPLY_DROP';

export type AdFrequencyKey = AdPlacement | 'INTERSTITIAL';

export type AdPlatformEnv = 'admob' | 'h5_ads' | 'wx' | 'tt' | 'web';

export type AdBlockReason =
  | 'COOLDOWN'
  | 'DAILY_CAP'
  | 'IN_FLIGHT'
  | 'UNCONFIGURED_AD_UNIT'
  | 'AD_UNAVAILABLE'
  | 'DISMISSED'
  | 'NO_WINDOW';

export interface AdErrorInfo {
  placement: AdFrequencyKey;
  reason: AdBlockReason;
  retryAfterMs?: number;
  remainingToday?: number;
  messageZh: string;
  messageEn: string;
}

export interface AdAvailability {
  allowed: boolean;
  reason?: 'COOLDOWN' | 'DAILY_CAP' | 'IN_FLIGHT';
  retryAfterMs: number;
  remainingToday: number;
  dailyCap: number;
}

export interface AdPlacementRule {
  cooldownMs: number;
  dailyCap: number;
}

export const ADS_AND_MONETIZATION_CONFIG = adsConfigJson;

export const AD_PLACEMENT_RULES: Record<AdFrequencyKey, AdPlacementRule> = {
  DOUBLE_SETTLEMENT: {
    cooldownMs: adsConfigJson.placements.DOUBLE_SETTLEMENT.cooldownSec * 1000,
    dailyCap: adsConfigJson.placements.DOUBLE_SETTLEMENT.dailyCap,
  },
  REVIVE: {
    cooldownMs: adsConfigJson.placements.REVIVE.cooldownSec * 1000,
    dailyCap: adsConfigJson.placements.REVIVE.dailyCap,
  },
  TRIAL_SHARK: {
    cooldownMs: adsConfigJson.placements.TRIAL_SHARK.cooldownSec * 1000,
    dailyCap: adsConfigJson.placements.TRIAL_SHARK.dailyCap,
  },
  SUPPLY_DROP: {
    cooldownMs: adsConfigJson.placements.SUPPLY_DROP.cooldownSec * 1000,
    dailyCap: adsConfigJson.placements.SUPPLY_DROP.dailyCap,
  },
  INTERSTITIAL: {
    cooldownMs: adsConfigJson.placements.INTERSTITIAL.cooldownSec * 1000,
    dailyCap: adsConfigJson.placements.INTERSTITIAL.dailyCap,
  },
};

export function getScaledSupplyDropReward(maxUnlockedRow: number): {
  row: number;
  generation: number;
  coins: number;
  genes: number;
} {
  const table = adsConfigJson.placements.SUPPLY_DROP.rewardsByMaxUnlockedRow;
  const clampedRow = Math.max(0, Math.min(table.length - 1, Math.floor(maxUnlockedRow)));
  return table[clampedRow];
}

export function getMaxUnlockedRowFromSave(unlockedSharkIds: readonly string[]): number {
  let maxRow = 0;
  for (const id of unlockedSharkIds) {
    const found = sharkEvolutionJson.sharks.find((s) => s.id === id);
    if (found && found.row > maxRow) {
      maxRow = found.row;
    }
  }
  return maxRow;
}

export function getTrialTargetSharkSpec(unlockedSharkIds: readonly string[]): {
  sharkId: string;
  upgradeLevel: number;
  inRunLevel: number;
  initialFrenzyDurationSec: number;
} {
  const trialCfg = adsConfigJson.placements.TRIAL_SHARK;
  const ownedSet = new Set(unlockedSharkIds);
  const nextUnowned =
    trialCfg.targetMode === 'next_unowned_shark'
      ? sharkEvolutionJson.sharks.find((s) => !ownedSet.has(s.id))
      : undefined;
  const chosenId = nextUnowned?.id ?? trialCfg.fallbackSharkId;
  return {
    sharkId: chosenId,
    upgradeLevel: trialCfg.trialUpgradeLevel,
    inRunLevel: trialCfg.trialInRunLevel,
    initialFrenzyDurationSec: trialCfg.initialFrenzyDurationSec,
  };
}

export function getOnboardingStarterGiftConfig(): {
  enabled: boolean;
  coins: number;
  genes: number;
  oneTimeOnly: boolean;
} {
  return adsConfigJson.onboardingStarterGift;
}

function readEnv(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined') {
      const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env;
      if (metaEnv && typeof metaEnv[key] === 'string' && metaEnv[key]) {
        return metaEnv[key] as string;
      }
    }
  } catch {
    // Ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {
    // Ignore
  }
  return undefined;
}

function isViteDevMode(): boolean {
  try {
    if (typeof import.meta !== 'undefined') {
      const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env;
      if (metaEnv && metaEnv.DEV === true) {
        return true;
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Single Source of Truth for Google AdMob (iOS / Android) & Google H5 Games Ads (AdSense for Games).
 * Synced automatically into `./ios-native/` via `npm run sync:ios`.
 */
export const GOOGLE_ADS_CONFIG = {
  /** Google AdMob App ID (Android / iOS) */
  admobAppId:
    readEnv('VITE_GOOGLE_ADMOB_APP_ID') ||
    adsConfigJson.providers.admobAppId,

  /** Google AdMob Rewarded Video Ad Unit ID */
  admobRewardedAdUnitId:
    readEnv('VITE_GOOGLE_ADMOB_REWARDED_AD_UNIT_ID') ||
    adsConfigJson.providers.admobRewardedAdUnitId,

  /** Google AdMob Interstitial Ad Unit ID (strictly separate from Rewarded Video) */
  admobInterstitialAdUnitId:
    readEnv('VITE_GOOGLE_ADMOB_INTERSTITIAL_AD_UNIT_ID') ||
    adsConfigJson.providers.admobInterstitialAdUnitId,

  /** Google AdMob Official iOS Rewarded Video Backup Unit ID (used only when production unit returns No-Fill in Simulator/Dev) */
  admobIosBackupRewardedAdUnitId:
    adsConfigJson.providers.admobIosBackupRewardedAdUnitId,

  /** Google AdSense for Games / H5 Games Ads Client ID (Publisher ID) */
  h5ClientId:
    readEnv('VITE_GOOGLE_H5_CLIENT_ID') ||
    adsConfigJson.providers.h5ClientId,

  /** Google IMA HTML5 VAST Rewarded Video Tag (serves real Google video ads in web/iframe environments) */
  imaVastTagUrl: adsConfigJson.providers.imaVastTagUrl,

  /** Google Cloud sample video stream fallback if browser adblocker blocks DoubleClick VAST XML */
  fallbackVideoStreamUrl: adsConfigJson.providers.fallbackVideoStreamUrl,
} as const;

/**
 * Per-platform AdUnit IDs — WeChat & Douyin Mini-Games use strictly independent Unit IDs
 * configured via env vars and NEVER fall back to Google AdMob IDs.
 */
export const PLATFORM_ADS_CONFIG = {
  admob: {
    rewardedAdUnitId: GOOGLE_ADS_CONFIG.admobRewardedAdUnitId,
    interstitialAdUnitId: GOOGLE_ADS_CONFIG.admobInterstitialAdUnitId,
  },
  wx: {
    rewardedAdUnitId: readEnv('VITE_WX_REWARDED_AD_UNIT_ID') || '',
    interstitialAdUnitId: readEnv('VITE_WX_INTERSTITIAL_AD_UNIT_ID') || '',
  },
  tt: {
    rewardedAdUnitId: readEnv('VITE_TT_REWARDED_AD_UNIT_ID') || '',
    interstitialAdUnitId: readEnv('VITE_TT_INTERSTITIAL_AD_UNIT_ID') || '',
  },
} as const;

export function resolvePlatformAdUnitId(
  platform: 'admob' | 'wx' | 'tt',
  format: 'rewarded' | 'interstitial',
  overrideUnitId?: string
): string {
  if (overrideUnitId && overrideUnitId.trim().length > 0) {
    return overrideUnitId.trim();
  }
  const entry = PLATFORM_ADS_CONFIG[platform];
  return format === 'rewarded' ? entry.rewardedAdUnitId : entry.interstitialAdUnitId;
}

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
  prepareInterstitial?: (opts: { adId: string }) => Promise<void>;
  showInterstitial?: () => Promise<void>;
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
    __ENABLE_AD_SIMULATOR__?: boolean;
  }
}

interface PersistedFrequencyState {
  dateKey: string;
  lastShownAt: Partial<Record<AdFrequencyKey, number>>;
  dailyCounts: Partial<Record<AdFrequencyKey, number>>;
}

const FREQ_STORAGE_KEY = 'hs_ad_freq_v1';

function getTodayDateKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildErrorInfo(
  placement: AdFrequencyKey,
  reason: AdBlockReason,
  retryAfterMs?: number,
  remainingToday?: number
): AdErrorInfo {
  switch (reason) {
    case 'COOLDOWN': {
      const sec = Math.max(1, Math.ceil((retryAfterMs ?? 1000) / 1000));
      return {
        placement,
        reason,
        retryAfterMs,
        remainingToday,
        messageZh: `广告冷却中，请 ${sec} 秒后再试`,
        messageEn: `Ad cooling down, retry in ${sec}s`,
      };
    }
    case 'DAILY_CAP':
      return {
        placement,
        reason,
        remainingToday: 0,
        messageZh: '今日该广告次数已达上限，明天再来吧',
        messageEn: 'Daily ad limit reached for today',
      };
    case 'IN_FLIGHT':
      return {
        placement,
        reason,
        messageZh: '广告正在加载中，请稍候',
        messageEn: 'Ad is already loading',
      };
    case 'UNCONFIGURED_AD_UNIT':
      return {
        placement,
        reason,
        messageZh: '当前平台广告位未配置，暂不可用',
        messageEn: 'Ad unit not configured for this platform',
      };
    case 'DISMISSED':
      return {
        placement,
        reason,
        messageZh: '需完整观看广告才能领取奖励',
        messageEn: 'Watch the full ad to claim reward',
      };
    case 'NO_WINDOW':
    case 'AD_UNAVAILABLE':
    default:
      return {
        placement,
        reason,
        messageZh: '暂无可用广告，请检查网络后重试',
        messageEn: 'No ad available right now, please try again later',
      };
  }
}

export class AdManager {
  private webVideoAdRunner:
    | ((placement: AdPlacement, onReward: () => void, onCancel?: () => void) => void)
    | null = null;
  private errorHandler: ((err: AdErrorInfo) => void) | null = null;
  private h5AdsReady = false;
  private admobInitialized = false;
  private inFlight = false;
  private devSimulatorOverride: boolean | null = null;
  private freqState: PersistedFrequencyState;

  constructor() {
    this.freqState = this.loadFrequencyState();
    this.initGoogleAdsRuntime();
  }

  private loadFrequencyState(nowMs: number = Date.now()): PersistedFrequencyState {
    const today = getTodayDateKey(nowMs);
    const empty: PersistedFrequencyState = {
      dateKey: today,
      lastShownAt: {},
      dailyCounts: {},
    };
    if (typeof localStorage === 'undefined') return empty;
    try {
      const raw = localStorage.getItem(FREQ_STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as Partial<PersistedFrequencyState>;
      if (!parsed || parsed.dateKey !== today) {
        return empty;
      }
      return {
        dateKey: today,
        lastShownAt: parsed.lastShownAt ?? {},
        dailyCounts: parsed.dailyCounts ?? {},
      };
    } catch {
      return empty;
    }
  }

  private saveFrequencyState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(this.freqState));
    } catch {
      // Ignore storage quota errors
    }
  }

  private ensureTodayState(nowMs: number): void {
    const today = getTodayDateKey(nowMs);
    if (this.freqState.dateKey !== today) {
      this.freqState = {
        dateKey: today,
        lastShownAt: {},
        dailyCounts: {},
      };
      this.saveFrequencyState();
    }
  }

  public resetFrequencyStateForTests(): void {
    this.inFlight = false;
    this.freqState = {
      dateKey: getTodayDateKey(),
      lastShownAt: {},
      dailyCounts: {},
    };
    this.saveFrequencyState();
  }

  public setDevSimulatorEnabled(enabled: boolean | null): void {
    this.devSimulatorOverride = enabled;
  }

  public isDevSimulatorEnabled(): boolean {
    if (this.devSimulatorOverride !== null) {
      return this.devSimulatorOverride;
    }
    const envFlag = readEnv('VITE_ENABLE_AD_SIMULATOR');
    if (envFlag === 'true') return true;
    if (envFlag === 'false') return false;
    if (typeof window !== 'undefined' && window.__ENABLE_AD_SIMULATOR__ === true) {
      return true;
    }
    return isViteDevMode();
  }

  public canShowAd(key: AdFrequencyKey, nowMs: number = Date.now()): AdAvailability {
    this.ensureTodayState(nowMs);
    const rule = AD_PLACEMENT_RULES[key];
    const usedToday = this.freqState.dailyCounts[key] ?? 0;
    const remainingToday = Math.max(0, rule.dailyCap - usedToday);

    if (this.inFlight) {
      return {
        allowed: false,
        reason: 'IN_FLIGHT',
        retryAfterMs: 0,
        remainingToday,
        dailyCap: rule.dailyCap,
      };
    }

    if (usedToday >= rule.dailyCap) {
      return {
        allowed: false,
        reason: 'DAILY_CAP',
        retryAfterMs: 0,
        remainingToday: 0,
        dailyCap: rule.dailyCap,
      };
    }

    const lastAt = this.freqState.lastShownAt[key] ?? 0;
    const elapsed = nowMs - lastAt;
    if (lastAt > 0 && elapsed < rule.cooldownMs) {
      return {
        allowed: false,
        reason: 'COOLDOWN',
        retryAfterMs: rule.cooldownMs - elapsed,
        remainingToday,
        dailyCap: rule.dailyCap,
      };
    }

    return {
      allowed: true,
      retryAfterMs: 0,
      remainingToday,
      dailyCap: rule.dailyCap,
    };
  }

  private recordAdImpression(key: AdFrequencyKey, nowMs: number = Date.now()): void {
    this.ensureTodayState(nowMs);
    this.freqState.lastShownAt[key] = nowMs;
    this.freqState.dailyCounts[key] = (this.freqState.dailyCounts[key] ?? 0) + 1;
    this.saveFrequencyState();
  }

  private emitError(
    placement: AdFrequencyKey,
    reason: AdBlockReason,
    onError?: (err: AdErrorInfo) => void,
    retryAfterMs?: number,
    remainingToday?: number
  ): void {
    const info = buildErrorInfo(placement, reason, retryAfterMs, remainingToday);
    if (onError) {
      onError(info);
    }
    if (this.errorHandler) {
      this.errorHandler(info);
    }
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

  public getInterstitialProtectedRunsCount(): number {
    return adsConfigJson.placements.INTERSTITIAL.starterProtectedRuns;
  }

  public getConfig() {
    return GOOGLE_ADS_CONFIG;
  }

  public getPlatformConfig() {
    return PLATFORM_ADS_CONFIG;
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

  public registerErrorHandler(handler: ((err: AdErrorInfo) => void) | null): void {
    this.errorHandler = handler;
  }

  private runWebVideoAdPlayer(
    placement: AdPlacement,
    onSuccess: () => void,
    onCancel?: () => void,
    onError?: (err: AdErrorInfo) => void
  ): void {
    if (this.webVideoAdRunner && this.isDevSimulatorEnabled()) {
      this.webVideoAdRunner(
        placement,
        () => {
          this.inFlight = false;
          this.recordAdImpression(placement);
          onSuccess();
        },
        () => {
          this.inFlight = false;
          this.emitError(placement, 'DISMISSED', onError);
          if (onCancel) onCancel();
        }
      );
      return;
    }

    // Production / unsimulated fallback: NEVER grant free reward!
    this.inFlight = false;
    this.emitError(placement, 'AD_UNAVAILABLE', onError);
    if (onCancel) onCancel();
  }

  public showRewardedVideoAd(
    placement: AdPlacement,
    onReward: () => void,
    onCancel?: () => void,
    onError?: (err: AdErrorInfo) => void
  ): void {
    if (typeof window === 'undefined') {
      this.emitError(placement, 'NO_WINDOW', onError);
      if (onCancel) onCancel();
      return;
    }

    const avail = this.canShowAd(placement);
    if (!avail.allowed) {
      this.emitError(
        placement,
        avail.reason ?? 'COOLDOWN',
        onError,
        avail.retryAfterMs,
        avail.remainingToday
      );
      if (onCancel) onCancel();
      return;
    }

    this.inFlight = true;
    const settleReward = () => {
      this.inFlight = false;
      this.recordAdImpression(placement);
      onReward();
    };
    const settleCancel = (reason: AdBlockReason = 'DISMISSED') => {
      this.inFlight = false;
      this.emitError(placement, reason, onError);
      if (onCancel) onCancel();
    };

    // 1. Native AdMob Plugin Bridge (Capacitor / Cordova)
    const capAdMob = window.Capacitor?.Plugins?.AdMob;
    if (
      capAdMob &&
      typeof capAdMob.prepareRewardVideoAd === 'function' &&
      typeof capAdMob.showRewardVideoAd === 'function'
    ) {
      const admobUnitId = resolvePlatformAdUnitId('admob', 'rewarded');
      capAdMob
        .prepareRewardVideoAd({ adId: admobUnitId })
        .then(() => capAdMob.showRewardVideoAd!())
        .then(() => {
          settleReward();
        })
        .catch(() => {
          this.runWebVideoAdPlayer(placement, onReward, onCancel, onError);
        });
      return;
    }

    // 2. WeChat Mini-Game (window.wx) or Douyin Mini-Game (window.tt)
    const env = this.detectPlatform();
    if (env === 'wx' || env === 'tt') {
      const sdk = env === 'wx' ? window.wx : window.tt;
      const miniGameUnitId = resolvePlatformAdUnitId(env, 'rewarded');
      if (!miniGameUnitId) {
        settleCancel('UNCONFIGURED_AD_UNIT');
        return;
      }
      if (sdk && typeof sdk.createRewardedVideoAd === 'function') {
        try {
          const videoAd = sdk.createRewardedVideoAd({ adUnitId: miniGameUnitId });
          const handleClose = (res: { isEnded: boolean }) => {
            if (videoAd.offClose) videoAd.offClose(handleClose);
            if (res && res.isEnded) {
              settleReward();
            } else {
              settleCancel('DISMISSED');
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
                  if (videoAd.offClose) videoAd.offClose(handleClose);
                  settleCancel('AD_UNAVAILABLE');
                });
            });
          return;
        } catch {
          settleCancel('AD_UNAVAILABLE');
          return;
        }
      }
    }

    // 3. Google AdSense for Games / H5 Games Ads Placement API
    if (typeof window.adBreak === 'function' && this.h5AdsReady) {
      let settled = false;
      let adStartedShowing = false;

      const watchdog = window.setTimeout(() => {
        if (!settled && !adStartedShowing) {
          settled = true;
          this.runWebVideoAdPlayer(placement, onReward, onCancel, onError);
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
            settleReward();
          },
          adDismissed: () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(watchdog);
            settleCancel('DISMISSED');
          },
          adBreakDone: (placementInfo) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(watchdog);
            if (placementInfo?.breakStatus === 'viewed') {
              settleReward();
            } else if (placementInfo?.breakStatus === 'dismissed') {
              settleCancel('DISMISSED');
            } else {
              this.runWebVideoAdPlayer(placement, onReward, onCancel, onError);
            }
          },
        });
        return;
      } catch {
        window.clearTimeout(watchdog);
      }
    }

    // 4. Dev-only Browser Simulator / VAST fallback (never grants free reward in prod)
    this.runWebVideoAdPlayer(placement, onReward, onCancel, onError);
  }

  public showInterstitialAd(overrideAdUnitId?: string): boolean {
    if (typeof window === 'undefined') return false;

    const avail = this.canShowAd('INTERSTITIAL');
    if (!avail.allowed) {
      return false;
    }

    // 1. Native Capacitor AdMob Interstitial
    const capAdMob = window.Capacitor?.Plugins?.AdMob;
    if (
      capAdMob &&
      typeof capAdMob.prepareInterstitial === 'function' &&
      typeof capAdMob.showInterstitial === 'function'
    ) {
      const adId = resolvePlatformAdUnitId('admob', 'interstitial', overrideAdUnitId);
      this.recordAdImpression('INTERSTITIAL');
      capAdMob
        .prepareInterstitial({ adId })
        .then(() => capAdMob.showInterstitial!())
        .catch(() => {});
      return true;
    }

    // 2. WeChat / Douyin Mini-Game Interstitial (strictly uses wx/tt interstitial Unit ID)
    const env = this.detectPlatform();
    if (env === 'wx' || env === 'tt') {
      const sdk = env === 'wx' ? window.wx : window.tt;
      const adUnitId = resolvePlatformAdUnitId(env, 'interstitial', overrideAdUnitId);
      if (!adUnitId) {
        return false;
      }
      if (sdk && typeof sdk.createInterstitialAd === 'function') {
        try {
          const interstitialAd = sdk.createInterstitialAd({ adUnitId });
          this.recordAdImpression('INTERSTITIAL');
          interstitialAd.show().catch(() => {});
          return true;
        } catch {
          return false;
        }
      }
    }

    // 3. Google H5 Games Ads Interstitial
    if (typeof window.adBreak === 'function' && this.h5AdsReady) {
      try {
        this.recordAdImpression('INTERSTITIAL');
        window.adBreak({
          type: 'next',
          name: 'settlement_interstitial',
        });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}

export const adManager = new AdManager();
