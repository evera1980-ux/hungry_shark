import Foundation
import UIKit
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// Read-only startup validator for Google Mobile Ads Info.plist configuration.
/// (Zero Objective-C Method Swizzling — relies cleanly on bundled Info.plist / Build Settings.)
public enum GADInfoPlistRuntimePatch {
    private static var hasValidated = false

    public static func installIfNeeded() {
        guard !hasValidated else { return }
        hasValidated = true
        #if DEBUG
        if let appId = Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String,
           appId.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("ca-app-pub-") {
            print("[GoogleAdMob] Info.plist GADApplicationIdentifier verified.")
        } else {
            print("[GoogleAdMob] WARNING: Missing GADApplicationIdentifier in Info.plist.")
        }
        #endif
    }
}

public enum SimRewardedAdKind: String, Sendable {
    case REVIVE
    case DOUBLE_SETTLEMENT
    case SUPPLY_DROP
    case TRIAL_SHARK
}

/// Production Google AdMob Rewarded Video Bridge (App Store & ATT Guideline 5.1.2 Compliant).
/// - Requests App Tracking Transparency (ATT) authorization BEFORE starting GADMobileAds SDK.
/// - Strictly isolates Google official test Ad Unit & simulator test identifiers behind `#if DEBUG`.
/// - Release builds ALWAYS load primary production `rewardedAdUnitId`, falling back to `backupRewardedAdUnitId`.
/// - Enforces per-placement cooldowns & daily caps; NEVER grants rewards unless SDK confirms completion.
@MainActor
public final class GoogleAdMobManager: NSObject, ObservableObject {
    public static let shared = GoogleAdMobManager()
    public let appId: String = GameConfigGenerated.googleAdMobAppId
    public let rewardedAdUnitId: String = GameConfigGenerated.googleAdMobRewardedAdUnitId
    public let backupRewardedAdUnitId: String = GameConfigGenerated.googleAdMobBackupRewardedAdUnitId

    #if DEBUG
    /// Google official rewarded video test unit — strictly `#if DEBUG` only, never compiled into Release.
    public static let officialTestRewardedAdUnitId: String = "ca-app-pub-3940256099942544/1712485313"
    #endif

    @Published public var isConnectingAd: Bool = false

    private var lastGrantedAtByKind: [SimRewardedAdKind: Date] = [:]
    private var dailyGrantCountByKind: [SimRewardedAdKind: Int] = [:]
    private var dailyCapDayKey: String = ""

    #if canImport(GoogleMobileAds)
    private var rewardedAd: GADRewardedAd?
    private var isLoadingAd: Bool = false
    private var sdkBootstrapStarted: Bool = false
    private var sdkStarted: Bool = false
    private var pendingRewardAction: (() -> Void)? = nil
    private var pendingUnavailableAction: (() -> Void)? = nil
    private var activeAdRewardCallback: (() -> Void)? = nil
    private var activeAdKind: SimRewardedAdKind? = nil
    private var activeAdDidEarnReward: Bool = false
    private var activeAdDidDismiss: Bool = false
    private var timeoutTask: Task<Void, Never>? = nil
    #endif

    public override init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        super.init()
    }

    public var hasValidPlistAdMobConfig: Bool {
        if let gadAppId = Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String,
           gadAppId.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("ca-app-pub-") {
            return true
        }
        if let isAdManager = Bundle.main.object(forInfoDictionaryKey: "GADIsAdManagerApp") as? Bool,
           isAdManager {
            return true
        }
        return false
    }

    // MARK: - Placement Cooldown & Daily Cap Guard

    private func refreshDailyCounterIfNeeded() {
        let comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        let key = "\(comps.year ?? 0)-\(comps.month ?? 0)-\(comps.day ?? 0)"
        if key != dailyCapDayKey {
            dailyCapDayKey = key
            dailyGrantCountByKind.removeAll()
        }
    }

    private func cooldownSeconds(for kind: SimRewardedAdKind) -> TimeInterval {
        switch kind {
        case .SUPPLY_DROP: return 90.0
        case .TRIAL_SHARK: return 60.0
        case .REVIVE: return 5.0
        case .DOUBLE_SETTLEMENT: return 5.0
        }
    }

    private func dailyCap(for kind: SimRewardedAdKind) -> Int {
        switch kind {
        case .SUPPLY_DROP: return 10
        case .TRIAL_SHARK: return 6
        case .REVIVE: return 20
        case .DOUBLE_SETTLEMENT: return 20
        }
    }

    public func remainingCooldownSeconds(for kind: SimRewardedAdKind) -> Int {
        refreshDailyCounterIfNeeded()
        if let last = lastGrantedAtByKind[kind] {
            let rem = cooldownSeconds(for: kind) - Date().timeIntervalSince(last)
            if rem > 0.5 {
                return Int(ceil(rem))
            }
        }
        return 0
    }

    public func isDailyCapReached(for kind: SimRewardedAdKind) -> Bool {
        refreshDailyCounterIfNeeded()
        return (dailyGrantCountByKind[kind] ?? 0) >= dailyCap(for: kind)
    }

    private func recordRewardGranted(for kind: SimRewardedAdKind?) {
        guard let kind = kind else { return }
        refreshDailyCounterIfNeeded()
        lastGrantedAtByKind[kind] = Date()
        dailyGrantCountByKind[kind] = (dailyGrantCountByKind[kind] ?? 0) + 1
    }

    // MARK: - ATT-First SDK Initialization (Apple Guideline 5.1.2 Compliant)

    public func startSDKAndPreload() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        #if canImport(GoogleMobileAds)
        guard hasValidPlistAdMobConfig else { return }
        if sdkStarted {
            preloadRewardedAd()
            return
        }
        guard !sdkBootstrapStarted else { return }
        sdkBootstrapStarted = true

        Task { @MainActor [weak self] in
            guard let self = self else { return }
            #if canImport(AppTrackingTransparency)
            if #available(iOS 14, *) {
                // Wait briefly until the UIWindowScene is active so iOS presents the ATT dialog reliably.
                var attempts = 0
                while UIApplication.shared.applicationState != .active && attempts < 20 {
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    attempts += 1
                }
                if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
                    // Brief settle delay after first frame presentation before requesting ATT.
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    _ = await ATTrackingManager.requestTrackingAuthorization()
                }
            }
            #endif
            self.initializeAdMobSDKAndPreload()
        }
        #endif
    }

    #if canImport(GoogleMobileAds)
    private func initializeAdMobSDKAndPreload() {
        guard !sdkStarted else {
            preloadRewardedAd()
            return
        }
        sdkStarted = true
        #if DEBUG
        GADMobileAds.sharedInstance().requestConfiguration.testDeviceIdentifiers = [GADSimulatorID]
        #endif
        GADMobileAds.sharedInstance().start { [weak self] _ in
            Task { @MainActor in
                self?.preloadRewardedAd()
            }
        }
    }
    #endif

    public func preloadRewardedAd() {
        #if canImport(GoogleMobileAds)
        guard hasValidPlistAdMobConfig, sdkStarted else { return }
        guard !isLoadingAd, rewardedAd == nil else { return }
        isLoadingAd = true

        #if DEBUG
        // Debug builds use Google's official test rewarded ad unit first to avoid invalid test impressions.
        loadRewardedUnitChain(units: [
            Self.officialTestRewardedAdUnitId,
            rewardedAdUnitId,
            backupRewardedAdUnitId
        ])
        #else
        // Release / App Store builds strictly use production ad units (primary -> backup).
        loadRewardedUnitChain(units: [
            rewardedAdUnitId,
            backupRewardedAdUnitId
        ])
        #endif
        #endif
    }

    #if canImport(GoogleMobileAds)
    private func loadRewardedUnitChain(units: [String]) {
        let cleanedUnits = units
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let currentUnit = cleanedUnits.first else {
            isLoadingAd = false
            failPendingAdIfAny()
            return
        }

        let remainingUnits = Array(cleanedUnits.dropFirst())
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: currentUnit, request: request) { [weak self] ad, _ in
            Task { @MainActor in
                guard let self = self else { return }
                if let loadedAd = ad {
                    self.isLoadingAd = false
                    self.rewardedAd = loadedAd
                    self.presentPendingAdIfAny()
                } else if !remainingUnits.isEmpty {
                    self.loadRewardedUnitChain(units: remainingUnits)
                } else {
                    self.isLoadingAd = false
                    self.failPendingAdIfAny()
                }
            }
        }
    }

    private func presentPendingAdIfAny() {
        guard let pending = pendingRewardAction,
              let ad = rewardedAd,
              let rootVC = Self.topViewController() else { return }
        pendingRewardAction = nil
        pendingUnavailableAction = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        isConnectingAd = false
        rewardedAd = nil
        activeAdDidEarnReward = false
        activeAdDidDismiss = false
        activeAdRewardCallback = pending
        ad.fullScreenContentDelegate = self
        ad.present(fromRootViewController: rootVC) { [weak self] in
            self?.handleAdRewardEarned()
        }
        preloadRewardedAd()
    }

    private func handleAdRewardEarned() {
        activeAdDidEarnReward = true
        if activeAdDidDismiss, let cb = activeAdRewardCallback {
            let kind = activeAdKind
            activeAdRewardCallback = nil
            activeAdKind = nil
            recordRewardGranted(for: kind)
            cb()
        }
    }

    private func failPendingAdIfAny() {
        guard let unavailable = pendingUnavailableAction else { return }
        pendingRewardAction = nil
        pendingUnavailableAction = nil
        activeAdKind = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        isConnectingAd = false
        unavailable()
    }
    #endif

    public func showRewardedAd(
        kind: SimRewardedAdKind? = nil,
        onReward: @escaping () -> Void,
        onUnavailable: @escaping () -> Void,
        onCooldown: ((Int) -> Void)? = nil
    ) {
        if let k = kind {
            let rem = remainingCooldownSeconds(for: k)
            if rem > 0 {
                onCooldown?(rem)
                return
            }
            if isDailyCapReached(for: k) {
                onUnavailable()
                return
            }
        }

        #if canImport(GoogleMobileAds)
        if !sdkStarted {
            startSDKAndPreload()
        }

        // 1. If ad is already cached in memory, present immediately (zero delay).
        if let ad = rewardedAd, let rootVC = Self.topViewController() {
            rewardedAd = nil
            activeAdKind = kind
            activeAdDidEarnReward = false
            activeAdDidDismiss = false
            activeAdRewardCallback = onReward
            ad.fullScreenContentDelegate = self
            ad.present(fromRootViewController: rootVC) { [weak self] in
                self?.handleAdRewardEarned()
            }
            preloadRewardedAd()
            return
        }

        // 2. Otherwise queue presentation with a 4.5s safety timeout (never grants reward on timeout).
        isConnectingAd = true
        activeAdKind = kind
        pendingRewardAction = onReward
        pendingUnavailableAction = onUnavailable

        preloadRewardedAd()

        timeoutTask?.cancel()
        timeoutTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 4_500_000_000)
            if self.isConnectingAd {
                self.failPendingAdIfAny()
            }
        }
        #else
        onUnavailable()
        #endif
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let window = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) ?? scenes.flatMap({ $0.windows }).first,
              var top = window.rootViewController else {
            return nil
        }
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}

#if canImport(GoogleMobileAds)
extension GoogleAdMobManager: GADFullScreenContentDelegate {
    public func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        activeAdDidDismiss = true
        if activeAdDidEarnReward, let cb = activeAdRewardCallback {
            let kind = activeAdKind
            activeAdRewardCallback = nil
            activeAdKind = nil
            recordRewardGranted(for: kind)
            cb()
        } else {
            activeAdRewardCallback = nil
            activeAdKind = nil
        }
        preloadRewardedAd()
    }

    public func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        activeAdRewardCallback = nil
        activeAdKind = nil
        activeAdDidEarnReward = false
        activeAdDidDismiss = false
        failPendingAdIfAny()
    }
}
#endif
