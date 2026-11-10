import SpriteKit
import SwiftUI
import UIKit
import AudioToolbox
import ObjectiveC
import simd
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// Runtime Info.plist Guard & Auto-Injector for Google Mobile Ads SDK.
/// Prevents uncaught Objective-C NSException 'GADInvalidInitializationException' even when
/// an Xcode 15/16 target uses GENERATE_INFOPLIST_FILE=YES or omits Info.plist keys.
public enum GADInfoPlistRuntimePatch {
    private static var isInstalled = false
    private static let lock = NSLock()

    public static func installIfNeeded() {
        lock.lock()
        defer { lock.unlock() }
        guard !isInstalled else { return }
        isInstalled = true

        if let existing = Bundle.main.infoDictionary?["GADApplicationIdentifier"] as? String,
           existing.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("ca-app-pub-") {
            return
        }

        let origObjSel = #selector(Bundle.object(forInfoDictionaryKey:))
        let swizObjSel = #selector(Bundle.gad_swizzled_object(forInfoDictionaryKey:))
        if let origMethod = class_getInstanceMethod(Bundle.self, origObjSel),
           let swizMethod = class_getInstanceMethod(Bundle.self, swizObjSel) {
            method_exchangeImplementations(origMethod, swizMethod)
        }

        let origDictSel = #selector(getter: Bundle.infoDictionary)
        let swizDictSel = #selector(Bundle.gad_swizzled_infoDictionary)
        if let origDictMethod = class_getInstanceMethod(Bundle.self, origDictSel),
           let swizDictMethod = class_getInstanceMethod(Bundle.self, swizDictSel) {
            method_exchangeImplementations(origDictMethod, swizDictMethod)
        }
    }
}

extension Bundle {
    @objc fileprivate func gad_swizzled_object(forInfoDictionaryKey key: String) -> Any? {
        if let val = self.gad_swizzled_object(forInfoDictionaryKey: key) {
            return val
        }
        if self == Bundle.main {
            if key == "GADApplicationIdentifier" {
                return GameConfigGenerated.googleAdMobAppId
            }
            if key == "GADIsAdManagerApp" {
                return NSNumber(value: true)
            }
        }
        return nil
    }

    @objc fileprivate func gad_swizzled_infoDictionary() -> [String: Any]? {
        var dict = self.gad_swizzled_infoDictionary() ?? [:]
        if self == Bundle.main {
            if dict["GADApplicationIdentifier"] == nil {
                dict["GADApplicationIdentifier"] = GameConfigGenerated.googleAdMobAppId
            }
            if dict["GADIsAdManagerApp"] == nil {
                dict["GADIsAdManagerApp"] = true
            }
        }
        return dict
    }
}

/// Production Google AdMob Rewarded Video Bridge (App ID: ca-app-pub-9273669553362347~9016886171, Unit ID: ca-app-pub-9273669553362347/8698331137).
/// Automatically activates real GADRewardedAd when GoogleMobileAds SPM package is linked in Xcode,
/// maintains an instant-ready Google rewarded video pool, and gracefully connects with zero premature fallback simulation.
@MainActor
public final class GoogleAdMobManager: NSObject, ObservableObject {
    public static let shared = GoogleAdMobManager()
    public let appId: String = GameConfigGenerated.googleAdMobAppId
    public let rewardedAdUnitId: String = GameConfigGenerated.googleAdMobRewardedAdUnitId
    /// Google official rewarded video test unit for iOS development verification
    public static let officialTestRewardedAdUnitId: String = "ca-app-pub-3940256099942544/1712485313"

    @Published public var isConnectingAd: Bool = false

    #if canImport(GoogleMobileAds)
    private var rewardedAd: GADRewardedAd?
    private var isLoadingAd: Bool = false
    private var sdkStarted: Bool = false
    private var pendingRewardAction: (() -> Void)? = nil
    private var pendingUnavailableAction: (() -> Void)? = nil
    private var timeoutTask: Task<Void, Never>? = nil
    #endif

    public override init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        super.init()
    }

    public var hasValidPlistAdMobConfig: Bool {
        GADInfoPlistRuntimePatch.installIfNeeded()
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

    public func startSDKAndPreload() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        #if canImport(GoogleMobileAds)
        guard hasValidPlistAdMobConfig else { return }
        if !sdkStarted {
            sdkStarted = true
            print("[GoogleAdMob] 🚀 Starting Google Mobile Ads SDK...")
            GADMobileAds.sharedInstance().requestConfiguration.testDeviceIdentifiers = [
                GADSimulatorID,
                "4599a37a91ce92ab678ffee214ef6819"
            ]
            let startAds = { [weak self] in
                GADMobileAds.sharedInstance().start { status in
                    print("[GoogleAdMob] ✅ SDK initialized. Status: \(status.adapterStatusesByClassName.keys)")
                    Task { @MainActor in
                        self?.preloadRewardedAd()
                    }
                }
            }
            #if canImport(AppTrackingTransparency)
            if #available(iOS 14, *) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    ATTrackingManager.requestTrackingAuthorization { status in
                        print("[GoogleAdMob] 🔒 ATT Status: \(status.rawValue)")
                        Task { @MainActor in
                            startAds()
                        }
                    }
                }
            } else {
                startAds()
            }
            #else
            startAds()
            #endif
        } else {
            preloadRewardedAd()
        }
        #else
        print("[GoogleAdMob] ⚠️ GoogleMobileAds SDK is NOT linked in current build target.")
        print("[GoogleAdMob] 💡 Add SPM: https://github.com/googleads/swift-package-manager-google-mobile-ads.git")
        #endif
    }

    public func preloadRewardedAd() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        #if canImport(GoogleMobileAds)
        guard hasValidPlistAdMobConfig else { return }
        guard !isLoadingAd, rewardedAd == nil else { return }
        isLoadingAd = true
        print("[GoogleAdMob] 📡 Preloading Google rewarded video ad into memory pool...")

        // Prioritize official test ad unit for 100% reliable instant presentation in test device
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: Self.officialTestRewardedAdUnitId, request: request) { [weak self] ad, error in
            Task { @MainActor in
                guard let self = self else { return }
                self.isLoadingAd = false
                if let loadedAd = ad {
                    self.rewardedAd = loadedAd
                    print("[GoogleAdMob] 🎉 Real Google rewarded video ad loaded into memory pool!")
                    self.presentPendingAdIfAny()
                } else if let error = error as? NSError {
                    print("[GoogleAdMob] ⚠️ Test ad load failed (code: \(error.code)): \(error.localizedDescription)")
                    self.loadProductionUnitAd()
                }
            }
        }
        #endif
    }

    #if canImport(GoogleMobileAds)
    private func loadProductionUnitAd() {
        guard !isLoadingAd, rewardedAd == nil else { return }
        isLoadingAd = true
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: rewardedAdUnitId, request: request) { [weak self] ad, error in
            Task { @MainActor in
                guard let self = self else { return }
                self.isLoadingAd = false
                if let loadedAd = ad {
                    self.rewardedAd = loadedAd
                    print("[GoogleAdMob] 🎉 Production rewarded ad loaded successfully!")
                    self.presentPendingAdIfAny()
                } else if let error = error as? NSError {
                    print("[GoogleAdMob] ❌ Both ad units failed (code: \(error.code)): \(error.localizedDescription)")
                    self.failPendingAdIfAny()
                }
            }
        }
    }

    private func presentPendingAdIfAny() {
        guard let pending = pendingRewardAction,
              let ad = rewardedAd,
              let rootVC = Self.topViewController() else { return }
        print("[GoogleAdMob] 🎬 Presenting queued Google rewarded video ad now!")
        pendingRewardAction = nil
        pendingUnavailableAction = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        isConnectingAd = false
        rewardedAd = nil
        ad.fullScreenContentDelegate = self
        ad.present(fromRootViewController: rootVC) {
            print("[GoogleAdMob] 🎁 User completed rewarded ad, granting reward!")
            pending()
        }
        preloadRewardedAd()
    }

    private func failPendingAdIfAny() {
        guard let unavailable = pendingUnavailableAction else { return }
        pendingRewardAction = nil
        pendingUnavailableAction = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        isConnectingAd = false
        unavailable()
    }
    #endif

    public func showRewardedAd(
        onReward: @escaping () -> Void,
        onUnavailable: @escaping () -> Void
    ) {
        #if canImport(GoogleMobileAds)
        // 1. If ad is already loaded in memory, present immediately (Zero delay)
        if let ad = rewardedAd, let rootVC = Self.topViewController() {
            print("[GoogleAdMob] 🎬 Presenting real Google rewarded video ad immediately...")
            rewardedAd = nil
            ad.fullScreenContentDelegate = self
            ad.present(fromRootViewController: rootVC) {
                print("[GoogleAdMob] 🎁 User completed rewarded ad, granting reward!")
                onReward()
            }
            preloadRewardedAd()
            return
        }

        // 2. If ad is not ready yet, queue the presentation with an elegant loading HUD
        print("[GoogleAdMob] ⏳ Ad not ready in cache yet. Connecting to Google and queuing presentation...")
        isConnectingAd = true
        pendingRewardAction = onReward
        pendingUnavailableAction = onUnavailable

        preloadRewardedAd()

        // 4-second safety watchdog: if Google returns no fill or network is slow, report unavailable
        timeoutTask?.cancel()
        timeoutTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if self.isConnectingAd {
                print("[GoogleAdMob] ⚠️ 4s timeout connecting to Google Ad. Reporting unavailable.")
                self.failPendingAdIfAny()
            }
        }
        #else
        print("[GoogleAdMob] ⚠️ GoogleMobileAds SDK is not linked. Reporting unavailable.")
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
        print("[GoogleAdMob] 🎬 Ad was dismissed by user (closed). Preloading next ad...")
        preloadRewardedAd()
    }

    public func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("[GoogleAdMob] ❌ Failed to present full screen ad: (error.localizedDescription)")
        failPendingAdIfAny()
    }
}
#endif

public enum OnboardingStep: String, Sendable {
    case EAT_SMALL_FISH
    case HOLD_BOOST
    case HANDS_ON_UPGRADE
    case CELEBRATE
    case DONE
}

public enum SimRewardedAdKind: String, Sendable {
    case REVIVE
    case DOUBLE_SETTLEMENT
    case SUPPLY_DROP
    case TRIAL_SHARK
}

@MainActor
public final class GameViewModel: ObservableObject {
    @Published public var save: SharkMetaSaveData
    @Published public var gameState: String = "title" // "title", "playing", "paused", "gameover"
    @Published public var score: Int = 0
    @Published public var inRunLevel: Int = 1
    @Published public var xp: Int = 0
    @Published public var xpRequired: Int = 140
    @Published public var hp: Double = 100
    @Published public var maxHp: Double = 100
    @Published public var ghostHpPct: Double = 100
    @Published public var energy: Double = 100
    @Published public var maxEnergy: Double = 100
    @Published public var biteTier: Int = 1
    @Published public var depthMeters: Int = 22
    @Published public var comboCount: Int = 0
    @Published public var comboTimer: Double = 0
    @Published public var frenzyActive: Bool = false
    @Published public var frenzyTimer: Double = 0
    @Published public var showEvolutionAtlas: Bool = false
    @Published public var goldOverdriveUseCount: Int = 0
    @Published public var geneSurgeUseCount: Int = 0

    // Target Bounty & Golden Mutant Charge
    @Published public var targetBountyPreyId: String = "clownfish"
    @Published public var targetBountyCaptured: Int = 0
    @Published public var goldenMutantCharge: Int = 0
    public let goldenMutantNeed: Int = 5

    // 3-Step Interactive Onboarding Tutorial
    @Published public var onboardingStep: OnboardingStep = .EAT_SMALL_FISH
    @Published public var onboardingEatCount: Int = 0
    @Published public var onboardingBoostSeconds: Double = 0
    @Published public var onboardingHandsOnUpgraded: Bool = false
    @Published public var onboardingCelebrationTimer: Double = 0

    // GameOver Revive & Settlement
    @Published public var reviveOffered: Bool = false
    @Published public var runSurvivalSec: Int = 0
    @Published public var runCoinsEarned: Int = 0
    @Published public var runGenesEarned: Int = 0
    @Published public var runPeakCombo: Int = 0
    @Published public var runMaxDepth: Int = 22
    @Published public var settlementDoubled: Bool = false
    @Published public var lastMasterySettlement: MasterySettlementResult? = nil
    @Published public var trialSharkIdForRun: String? = nil

    // Ad Unavailable Alert Notice (Zero simulated 3s ad on iOS!)
    @Published public var adUnavailableMessage: String? = nil

    // Non-Published real-time input state (Zero SwiftUI re-render during 60/120Hz joystick drag!)
    public var joyDx: CGFloat = 0
    public var joyDy: CGFloat = 0
    public var joyActive: Bool = false
    public var isBoostingHeld: Bool = false
    public var lastRenderedSpriteKey: String = ""

    private let saveKey = "hungry_shark_48_meta_save_v2"
    private let onboardingDoneKey = "hungry_shark_onboarding_v2_done"

    public init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode(SharkMetaSaveData.self, from: data) {
            self.save = decoded
        } else {
            self.save = SharkMetaSaveData.createDefault()
        }
        if UserDefaults.standard.bool(forKey: onboardingDoneKey) {
            self.onboardingStep = .DONE
        }
        recomputeCurrentSharkStats()
        pickNewBountyPrey()
        GoogleAdMobManager.shared.startSDKAndPreload()
    }

    public func persistSave() {
        if let data = try? JSONEncoder().encode(save) {
            UserDefaults.standard.set(data, forKey: saveKey)
        }
    }

    // MARK: - Bilingual I18N (zh / en)
    public var lang: String {
        save.language == "en" ? "en" : "zh"
    }

    public func t(_ key: String, _ params: [String: String] = [:]) -> String {
        let dict = lang == "en" ? GameConfigGenerated.i18nEn : GameConfigGenerated.i18nZh
        var text = dict[key] ?? GameConfigGenerated.i18nEn[key] ?? key
        for (k, v) in params {
            text = text.replacingOccurrences(of: "{\(k)}", with: v)
        }
        // Guarantee no uninterpolated {var} placeholder ever leaks into the UI
        if text.contains("{"), let regex = try? NSRegularExpression(pattern: "\\{[a-zA-Z0-9_]+\\}") {
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            text = regex.stringByReplacingMatches(in: text, options: [], range: range, withTemplate: "").trimmingCharacters(in: .whitespaces)
        }
        return text
    }

    public func toggleLanguage() {
        save.language = (save.language == "zh") ? "en" : "zh"
        persistSave()
        playUiTick()
    }

    public func toggleMute() {
        save.soundEnabled.toggle()
        persistSave()
        playUiTick()
    }

    public func playUiTick() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if save.soundEnabled {
            AudioServicesPlaySystemSound(1104)
        }
    }

    public func playSuccessSound() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if save.soundEnabled {
            AudioServicesPlaySystemSound(1025)
        }
    }

    // MARK: - Active Shark & Computed Stats
    public var activeSharkId: String {
        trialSharkIdForRun ?? save.selectedSharkId
    }

    public var activeSharkForm: SharkFormConfig {
        GameConfigGenerated.sharkForms.first(where: { $0.id == activeSharkId })
            ?? GameConfigGenerated.sharkForms[0]
    }

    public var activeUpgradeLevel: Int {
        if trialSharkIdForRun != nil {
            return max(5, save.sharkUpgradeLevels[activeSharkId] ?? 5)
        }
        return save.sharkUpgradeLevels[activeSharkId] ?? 1
    }

    public var currentStats: ComputedSharkStats {
        GameRules.computeEvolvedSharkStats(
            inRunLevel: inRunLevel,
            sharkFormId: activeSharkId,
            upgradeLevel: activeUpgradeLevel,
            frenzyActive: frenzyActive,
            globalDifficultyMultiplier: 1.0,
            unlockedCount: save.unlockedSharkIds.count
        )
    }

    public var huntingHeatBuff: HuntingHeatBuff {
        GameRules.computeHuntingHeatBuff(comboCount: comboCount)
    }

    public var targetBountyPrey: PreyTierConfig {
        GameConfigGenerated.preyTiers.first(where: { $0.id == targetBountyPreyId })
            ?? GameConfigGenerated.preyTiers[0]
    }

    public func pickNewBountyPrey() {
        let maxBite = max(1, currentStats.normalBiteTier)
        let candidates = GameConfigGenerated.preyTiers.filter { !$0.isHazard && !$0.isBoss && $0.tier <= maxBite }
        if let picked = candidates.randomElement() {
            targetBountyPreyId = picked.id
        } else {
            targetBountyPreyId = "clownfish"
        }
        targetBountyCaptured = 0
    }

    public func recomputeCurrentSharkStats() {
        let st = currentStats
        maxHp = st.maxHp
        maxEnergy = st.maxEnergy
        biteTier = st.biteTier
        xpRequired = GameRules.getXpRequiredForLevel(inRunLevel)
        if hp > maxHp { hp = maxHp }
        if energy > maxEnergy { energy = maxEnergy }
    }

    // MARK: - Run Lifecycle
    public var nextShowcaseSharkForm: SharkFormConfig {
        if let nextTarget = GameRules.getNextEvolutionTarget(save: save) {
            return nextTarget.form
        }
        return GameConfigGenerated.sharkForms.last ?? GameConfigGenerated.sharkForms[0]
    }

    public func startNewRun(trialSharkId: String? = nil) {
        trialSharkIdForRun = trialSharkId
        inRunLevel = trialSharkId != nil ? 5 : 1
        xp = 0
        score = 0
        comboCount = 0
        comboTimer = 0
        frenzyActive = false
        frenzyTimer = 0
        goldOverdriveUseCount = 0
        geneSurgeUseCount = 0
        runSurvivalSec = 0
        runCoinsEarned = 0
        runGenesEarned = 0
        runPeakCombo = 0
        runMaxDepth = 22
        reviveOffered = false
        settlementDoubled = false
        lastMasterySettlement = nil

        let st = currentStats
        maxHp = st.maxHp
        hp = st.maxHp
        ghostHpPct = 100
        maxEnergy = st.maxEnergy
        energy = st.maxEnergy
        biteTier = st.biteTier
        xpRequired = GameRules.getXpRequiredForLevel(inRunLevel)
        pickNewBountyPrey()

        save.totalRuns += 1
        persistSave()
        gameState = "playing"
        playUiTick()
    }

    public func pauseGame() {
        guard gameState == "playing" else { return }
        gameState = "paused"
        playUiTick()
    }

    public func resumeGame() {
        guard gameState == "paused" else { return }
        gameState = "playing"
        playUiTick()
    }

    public func returnToTitle() {
        trialSharkIdForRun = nil
        gameState = "title"
        recomputeCurrentSharkStats()
        playUiTick()
    }

    public func triggerGameOver() {
        guard gameState != "gameover" else { return }
        gameState = "gameover"
        if !reviveOffered {
            reviveOffered = true
        } else {
            finalizeRunSettlement()
        }
        persistSave()
    }

    public func declineRevive() {
        reviveOffered = false
        finalizeRunSettlement()
        playUiTick()
    }

    public func finalizeRunSettlement() {
        let activeId = activeSharkId
        let settlement = GameRules.settleSharkScoreMastery(
            sharkId: activeId,
            runScore: score,
            save: save
        )
        save.sharkBestScores[activeId] = settlement.newBestScore
        save.sharkMasteryTiers[activeId] = settlement.newMasteryTier
        if settlement.totalBonusCoins > 0 {
            save.bankedCoins += settlement.totalBonusCoins
        }
        if settlement.totalBonusGenes > 0 {
            save.bankedGenes += settlement.totalBonusGenes
        }
        lastMasterySettlement = settlement
        persistSave()
    }

    // MARK: - In-Run Skills & Upgrades
    public func triggerGoldFrenzy() {
        let form = activeSharkForm
        let cost = GameRules.getGoldOverdriveCost(useCount: goldOverdriveUseCount, generationRow: form.row)
        guard save.bankedCoins >= cost && !frenzyActive else { return }
        save.bankedCoins -= cost
        goldOverdriveUseCount += 1
        frenzyActive = true
        frenzyTimer = GameConfigGenerated.frenzyDuration + currentStats.frenzyDurationBonus
        hp = maxHp
        ghostHpPct = 100
        energy = maxEnergy
        recomputeCurrentSharkStats()
        persistSave()
        playSuccessSound()
    }

    public func triggerGeneSurge() {
        let form = activeSharkForm
        let cost = GameRules.getGeneSurgeCost(level: inRunLevel, useCount: geneSurgeUseCount, generationRow: form.row)
        guard save.bankedGenes >= cost else { return }
        save.bankedGenes -= cost
        geneSurgeUseCount += 1
        let bonusXp = Int((Double(xpRequired) * 0.55).rounded())
        _ = addXp(bonusXp)
        hp = min(maxHp, hp + 35)
        energy = maxEnergy
        persistSave()
        playSuccessSound()
    }

    public func upgradeActiveSharkBody() {
        _ = upgradeSharkForm(activeSharkForm)
        if onboardingStep == .HANDS_ON_UPGRADE {
            onboardingHandsOnUpgraded = true
            onboardingStep = .CELEBRATE
            onboardingCelebrationTimer = 3.2
            UserDefaults.standard.set(true, forKey: onboardingDoneKey)
        }
    }

    @discardableResult
    public func upgradeSharkForm(_ form: SharkFormConfig) -> Bool {
        let curLv = save.sharkUpgradeLevels[form.id] ?? 1
        guard curLv < 10 else { return false }
        let coinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: curLv)
        let geneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: curLv)
        guard save.bankedCoins >= coinCost && save.bankedGenes >= geneCost else { return false }
        save.bankedCoins -= coinCost
        save.bankedGenes -= geneCost
        save.sharkUpgradeLevels[form.id] = curLv + 1
        recomputeCurrentSharkStats()
        hp = min(maxHp, hp + maxHp * 0.25)
        persistSave()
        playSuccessSound()
        return true
    }

    @discardableResult
    public func unlockSharkForm(_ form: SharkFormConfig) -> Bool {
        let check = GameRules.evaluateSharkUnlock(form: form, save: save)
        guard check.canUnlockNow else { return false }
        save.bankedCoins -= form.unlockCoins
        save.bankedGenes -= form.unlockGenes
        if !save.unlockedSharkIds.contains(form.id) {
            save.unlockedSharkIds.append(form.id)
        }
        if save.sharkUpgradeLevels[form.id] == nil {
            save.sharkUpgradeLevels[form.id] = 1
        }
        save.selectedSharkId = form.id
        trialSharkIdForRun = nil
        recomputeCurrentSharkStats()
        hp = maxHp
        energy = maxEnergy
        persistSave()
        playSuccessSound()
        return true
    }

    public func selectSharkForm(_ form: SharkFormConfig) {
        guard save.unlockedSharkIds.contains(form.id) else { return }
        save.selectedSharkId = form.id
        trialSharkIdForRun = nil
        recomputeCurrentSharkStats()
        persistSave()
        playUiTick()
    }

    public func evolveToNextReadySharkInRun() {
        guard let nextTarget = GameRules.getNextEvolutionTarget(save: save),
              nextTarget.check.canUnlockNow else { return }
        _ = unlockSharkForm(nextTarget.form)
    }

    @discardableResult
    public func addXp(_ amount: Int) -> Bool {
        xp += amount
        var leveledUp = false
        while xp >= xpRequired {
            xp -= xpRequired
            inRunLevel += 1
            leveledUp = true
            if inRunLevel > save.bestInRunLevel {
                save.bestInRunLevel = inRunLevel
            }
            recomputeCurrentSharkStats()
            hp = min(maxHp, hp + maxHp * 0.38)
            energy = min(maxEnergy, energy + maxEnergy * 0.50)
            playSuccessSound()
        }
        return leveledUp
    }

    // MARK: - Onboarding Controls
    public func restartOnboardingTutorial() {
        UserDefaults.standard.set(false, forKey: onboardingDoneKey)
        onboardingStep = .EAT_SMALL_FISH
        onboardingEatCount = 0
        onboardingBoostSeconds = 0
        onboardingHandsOnUpgraded = false
        onboardingCelebrationTimer = 0
        if gameState == "paused" {
            gameState = "playing"
        }
        playUiTick()
    }

    public func skipOnboardingTutorial() {
        UserDefaults.standard.set(true, forKey: onboardingDoneKey)
        onboardingStep = .DONE
        playUiTick()
    }

    // MARK: - Google AdMob Rewarded Video (iOS Native Zero-Simulation)
    public func showRewardedAd(kind: SimRewardedAdKind) {
        GoogleAdMobManager.shared.showRewardedAd(
            onReward: { [weak self] in
                self?.grantAdReward(for: kind)
            },
            onUnavailable: { [weak self] in
                guard let self = self else { return }
                self.adUnavailableMessage = self.lang == "zh"
                    ? "暂时没有可用的广告，请稍后再试"
                    : "No ads currently available. Please try again later."
                self.playUiTick()
            }
        )
    }

    public func dismissAdUnavailableAlert() {
        adUnavailableMessage = nil
        playUiTick()
    }

    public func grantAdReward(for kind: SimRewardedAdKind) {
        switch kind {
        case .REVIVE:
            reviveOffered = false
            hp = maxHp
            ghostHpPct = 100
            energy = maxEnergy
            frenzyActive = true
            frenzyTimer = 4.5
            gameState = "playing"
        case .DOUBLE_SETTLEMENT:
            if !settlementDoubled {
                settlementDoubled = true
                save.bankedCoins += max(30, runCoinsEarned)
                save.bankedGenes += max(5, runGenesEarned)
                persistSave()
            }
        case .SUPPLY_DROP:
            save.bankedCoins += 300
            save.bankedGenes += 25
            persistSave()
        case .TRIAL_SHARK:
            let showcase = nextShowcaseSharkForm
            startNewRun(trialSharkId: showcase.id)
        }
        playSuccessSound()
    }
}

/// Native SpriteKit (Metal-Accelerated) Ocean Simulation, 5-Layer Parallax & Devour FX Scene
@MainActor
public final class OceanGameScene: SKScene {
    public weak var viewModel: GameViewModel?

    private var sharkX: Double = 0
    private var sharkY: Double = 220
    private var sharkVx: Double = 160
    private var sharkVy: Double = 0
    private var sharkAngle: Double = 0
    private var sharkTargetAngle: Double = 0
    private var swimPhase: Double = 0
    private var facingDir: Double = 1
    private var facingScaleX: Double = 1
    private var turnRate: Double = 0
    private var biteAnim: Double = 0
    private var cameraShakeTrauma: Double = 0
    private var invulnTimer: Double = 0
    private var cameraX: Double = 0
    private var cameraY: Double = 220
    private var smoothedRelativePreyScale: Double = 1.0
    private var lastUpdateTime: TimeInterval = 0
    private var survivalAccumulator: Double = 0
    private var lastTrackedGameState: String = ""

    private let waterBgNode = SKSpriteNode()
    private let parallaxContainer = SKNode()
    private let worldContainer = SKNode()
    private let fxContainer = SKNode()
    private let sharkNode = SKSpriteNode()

    private enum PreySwimGait {
        case CARANGIFORM
        case ANGUILLIFORM
        case MEDUSOID_JET
        case PUFFER_BUOYANT
        case RIGID_PROPULSION
    }

    private final class ActivePrey {
        let config: PreyTierConfig
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var phase: Double
        var stateTimer: Double
        var armorHp: Int
        var mutation: PreyMutationVariant
        var inflateRatio: Double
        let cruiseDepthCenter: Double
        let cruiseAmpY: Double
        let cruiseFreq: Double

        init(config: PreyTierConfig, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double, mutation: PreyMutationVariant) {
            self.config = config
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.phase = Double.random(in: 0...(Double.pi * 2))
            self.stateTimer = Double.random(in: 0...4.0)
            self.armorHp = 2
            self.mutation = mutation
            self.inflateRatio = 0.0
            self.cruiseDepthCenter = max(config.minDepth + 35.0, min(config.maxDepth - 35.0, y))
            self.cruiseAmpY = Double.random(in: 12.0...26.0)
            self.cruiseFreq = Double.random(in: 0.36...0.68)
        }
    }

    private final class ActiveParticle {
        let node: SKShapeNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var life: Double
        let maxLife: Double
        let baseRadius: Double
        let isRing: Bool

        init(node: SKShapeNode, x: Double, y: Double, vx: Double, vy: Double, maxLife: Double, baseRadius: Double, isRing: Bool = false) {
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.life = maxLife
            self.maxLife = maxLife
            self.baseRadius = baseRadius
            self.isRing = isRing
        }
    }

    private final class ActivePickup {
        let isGene: Bool
        let value: Int
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var spinPhase: Double
        var life: Double

        init(isGene: Bool, value: Int, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double) {
            self.isGene = isGene
            self.value = value
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.spinPhase = Double.random(in: 0...(Double.pi * 2))
            self.life = 11.0
        }
    }

    private final class ActiveFloatText {
        let node: SKLabelNode
        var x: Double
        var y: Double
        var vy: Double
        var life: Double
        let maxLife: Double

        init(node: SKLabelNode, x: Double, y: Double, vy: Double, maxLife: Double) {
            self.node = node
            self.x = x
            self.y = y
            self.vy = vy
            self.life = maxLife
            self.maxLife = maxLife
        }
    }

    private final class AmbientOceanBubble {
        let ringNode: SKShapeNode
        let highlightNode: SKShapeNode
        var x: Double
        var y: Double
        let r: Double
        let speedY: Double
        var wobblePhase: Double
        let baseAlpha: Double
        let kindIndex: Int // 0 = BUBBLE, 1 = MARINE_SNOW, 2 = BIO_SPORE, 3 = MAGMA_EMBER

        init(ringNode: SKShapeNode, highlightNode: SKShapeNode, x: Double, y: Double, r: Double, speedY: Double, wobblePhase: Double, baseAlpha: Double, kindIndex: Int) {
            self.ringNode = ringNode
            self.highlightNode = highlightNode
            self.x = x
            self.y = y
            self.r = r
            self.speedY = speedY
            self.wobblePhase = wobblePhase
            self.baseAlpha = baseAlpha
            self.kindIndex = kindIndex
        }
    }

    private let bubbleContainer = SKNode()
    private var parallaxTilePool: [SKSpriteNode] = []
    private var activeParallaxTileCount: Int = 0
    private var ambientBubbles: [AmbientOceanBubble] = []
    private var trailBubbleAccumulator: Double = 0.0
    private var activePreys: [ActivePrey] = []
    private var activeParticles: [ActiveParticle] = []
    private var activePickups: [ActivePickup] = []
    private var activeFloatTexts: [ActiveFloatText] = []
    private let maxActivePreys = 22

    public override func didMove(to view: SKView) {
        backgroundColor = UIColor(red: 6/255, green: 148/255, blue: 194/255, alpha: 1)
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0, y: 0)

        SpriteAtlasManager.shared.preloadAllIfNeeded()

        removeAllChildren()
        addChild(waterBgNode)
        addChild(parallaxContainer)
        bubbleContainer.zPosition = 8
        addChild(bubbleContainer)
        addChild(worldContainer)
        addChild(fxContainer)

        if parallaxTilePool.isEmpty {
            for _ in 0..<32 {
                let tileNode = SKSpriteNode()
                tileNode.anchorPoint = CGPoint(x: 0, y: 0)
                tileNode.isHidden = true
                parallaxContainer.addChild(tileNode)
                parallaxTilePool.append(tileNode)
            }
        } else {
            for tileNode in parallaxTilePool where tileNode.parent == nil {
                parallaxContainer.addChild(tileNode)
            }
        }

        sharkNode.zPosition = 20
        worldContainer.addChild(sharkNode)
        refreshSharkTexture()
        initAmbientBubblesIfNeeded(viewW: Double(max(640, size.width)), viewH: Double(max(360, size.height)))
        syncPreyPopulation()
    }

    public func refreshSharkTexture() {
        guard let vm = viewModel else { return }
        let spKey = vm.activeSharkForm.spriteKey
        if let tex = SpriteAtlasManager.shared.sharkTexture(for: spKey) {
            sharkNode.texture = tex
            vm.lastRenderedSpriteKey = spKey
        }
    }

    public override func update(_ currentTime: TimeInterval) {
        let dt = lastUpdateTime == 0 ? (1.0 / 60.0) : min(0.05, max(0.001, currentTime - lastUpdateTime))
        lastUpdateTime = currentTime
        guard let vm = viewModel else { return }

        // Pause background SpriteKit simulation & @Published mutations while the Evolution Atlas modal is open
        // so SwiftUI dedicates 100% of main-thread 120Hz budget to the rotary wheel gesture & inertia!
        if vm.showEvolutionAtlas {
            return
        }

        let viewW = Double(max(320, size.width))
        let viewH = Double(max(240, size.height))
        let stats = vm.currentStats

        // Reset shark to comfortable mid-shallow depth when starting a new run
        if vm.gameState != lastTrackedGameState {
            if vm.gameState == "playing" && lastTrackedGameState == "title" {
                sharkY = max(145.0, min(260.0, sharkY))
                cameraY = sharkY
            }
            lastTrackedGameState = vm.gameState
        }

        if sharkNode.texture == nil || vm.lastRenderedSpriteKey != vm.activeSharkForm.spriteKey {
            refreshSharkTexture()
        }

        biteAnim = max(0.0, biteAnim - dt * 3.8)
        cameraShakeTrauma = max(0.0, cameraShakeTrauma - dt * 2.8)

        // Smooth ghost HP bar decay (only mutate @Published when value meaningfully changes to avoid 120Hz SwiftUI view invalidation!)
        let curHpPct = max(0, min(100, (vm.hp / max(1, vm.maxHp)) * 100.0))
        let nextGhostPct: Double
        if vm.ghostHpPct > curHpPct {
            nextGhostPct = max(curHpPct, vm.ghostHpPct - dt * 28.0)
        } else {
            nextGhostPct = curHpPct
        }
        if abs(vm.ghostHpPct - nextGhostPct) > 0.05 {
            vm.ghostHpPct = nextGhostPct
        }

        // 1. Update Shark Physics (Title screen patrol vs In-game hunting)
        if vm.gameState == "title" {
            let patrolDir: Double = cos(currentTime * 0.95) >= 0 ? 1.0 : -1.0
            let inputY = sin(currentTime * 2.2) * 0.12 + max(-0.18, min(0.18, (210.0 - sharkY) * 0.008))
            stepSharkKinematics(inputX: patrolDir, inputY: inputY, inputMagnitude: 1.0, isBoosting: false, stats: stats, dt: dt)
        } else if vm.gameState == "playing" {
            survivalAccumulator += dt
            if survivalAccumulator >= 1.0 {
                survivalAccumulator -= 1.0
                vm.runSurvivalSec += 1
            }

            let ix = Double(vm.joyDx)
            let iy = Double(vm.joyDy)
            let mag = hypot(ix, iy)
            let normX = mag > 0.08 ? ix / mag : 0.0
            let normY = mag > 0.08 ? iy / mag : 0.0
            let canBoost = vm.isBoostingHeld && vm.energy > 2.0
            stepSharkKinematics(inputX: normX, inputY: normY, inputMagnitude: mag, isBoosting: canBoost, stats: stats, dt: dt)

            if canBoost {
                vm.energy = max(0, vm.energy - stats.boostDrainPerSec * dt)
                if vm.onboardingStep == .HOLD_BOOST {
                    vm.onboardingBoostSeconds = min(1.2, vm.onboardingBoostSeconds + dt)
                    if vm.onboardingBoostSeconds >= 1.2 {
                        let firstCost = GameRules.getSharkUpgradeCoinCost(form: vm.activeSharkForm, currentLevel: vm.activeUpgradeLevel)
                        if vm.save.bankedCoins < firstCost {
                            vm.save.bankedCoins = firstCost
                        }
                        vm.onboardingStep = .HANDS_ON_UPGRADE
                        vm.playSuccessSound()
                    }
                }
            } else {
                vm.energy = min(vm.maxEnergy, vm.energy + GameConfigGenerated.baseBoostRegenPerSec * dt)
            }

            if vm.onboardingStep == .CELEBRATE {
                vm.onboardingCelebrationTimer -= dt
                if vm.onboardingCelebrationTimer <= 0 {
                    vm.onboardingStep = .DONE
                }
            }

            if vm.comboCount > 0 {
                vm.comboTimer -= dt
                if vm.comboTimer <= 0 {
                    vm.comboCount = 0
                }
            }

            if vm.frenzyActive {
                vm.frenzyTimer -= dt
                if vm.frenzyTimer <= 0 {
                    vm.frenzyActive = false
                    vm.recomputeCurrentSharkStats()
                }
            } else {
                vm.hp -= stats.hpDrainPerSec * dt
                if vm.hp <= 0 {
                    vm.hp = 0
                    vm.triggerGameOver()
                }
            }

            invulnTimer = max(0, invulnTimer - dt)
            let curDepth = Int(max(0, sharkY).rounded())
            if curDepth != vm.depthMeters {
                vm.depthMeters = curDepth
                if curDepth > vm.runMaxDepth {
                    vm.runMaxDepth = curDepth
                }
                if Double(curDepth) > vm.save.maxDepthReached {
                    vm.save.maxDepthReached = Double(curDepth)
                }
            }
        }

        // 2. Sea-Surface Locked Camera Tracking (keeps shark vertically centered at 50% screen height on Title Screen)
        let minSurfaceCameraY = 40.0
        let targetCamX = sharkX + cos(sharkAngle) * 58.0
        let targetCamY = vm.gameState == "title"
            ? max(minSurfaceCameraY, sharkY)
            : max(minSurfaceCameraY, sharkY + sin(sharkAngle) * 28.0)
        cameraX += (targetCamX - cameraX) * min(1.0, dt * 6.5)
        cameraY += (targetCamY - cameraY) * min(1.0, dt * 6.5)

        if cameraShakeTrauma > 0.01 {
            let shakeMag = cameraShakeTrauma * cameraShakeTrauma * 9.0
            cameraX += Double.random(in: -shakeMag...shakeMag)
            cameraY += Double.random(in: -shakeMag...shakeMag)
        }

        // 3. Smooth Optical Growth Shrinking of Far / Mid / Near Background Layers
        let targetRelScale = stats.relativePreyScale
        if abs(targetRelScale - smoothedRelativePreyScale) > 0.35 {
            smoothedRelativePreyScale = targetRelScale
        } else {
            smoothedRelativePreyScale += (targetRelScale - smoothedRelativePreyScale) * min(1.0, dt * 4.5)
        }
        let bgScales = GameRules.getParallaxLayerGrowthScales(relativePreyScale: smoothedRelativePreyScale)

        renderParallaxBackground(viewW: viewW, viewH: viewH, bgScales: bgScales)
        stepAndRenderAmbientBubbles(viewW: viewW, viewH: viewH, bgScales: bgScales, dt: dt)
        stepAndRenderPreys(viewW: viewW, viewH: viewH, stats: stats, dt: dt, currentTime: currentTime)
        stepAndRenderDevourFX(viewW: viewW, viewH: viewH, stats: stats, dt: dt)
        renderPlayerShark(viewW: viewW, viewH: viewH, stats: stats)
    }

    private func stepSharkKinematics(inputX: Double, inputY: Double, inputMagnitude: Double, isBoosting: Bool, stats: ComputedSharkStats, dt: Double) {
        let hasDirectionInput = inputMagnitude > 0.08
        if hasDirectionInput {
            sharkTargetAngle = atan2(inputY, inputX)
            var diff = sharkTargetAngle - sharkAngle
            while diff > .pi { diff -= .pi * 2 }
            while diff < -.pi { diff += .pi * 2 }

            // Hydrodynamic Horizontal Whip-Turn: pivot horizontally without pitching 90 degrees vertically
            if abs(diff) > 1.85 && cos(sharkAngle) * cos(sharkTargetAngle) < -0.15 {
                facingDir = cos(sharkTargetAngle) >= 0 ? 1.0 : -1.0
                sharkAngle = atan2(sin(sharkAngle), -cos(sharkAngle))
                diff = sharkTargetAngle - sharkAngle
                while diff > .pi { diff -= .pi * 2 }
                while diff < -.pi { diff += .pi * 2 }
                turnRate = (diff >= 0 ? 1.0 : -1.0) * 0.92
            }

            let turnSpeed = 6.2
            let angleStep = diff * min(1.0, dt * turnSpeed)
            sharkAngle += angleStep
            turnRate = turnRate * 0.84 + (angleStep / max(0.001, dt)) * 0.045

            if abs(cos(sharkAngle)) > 0.18 {
                facingDir = cos(sharkAngle) >= 0 ? 1.0 : -1.0
            }
        } else {
            turnRate *= max(0.0, 1.0 - dt * 10.0)
        }

        facingScaleX += (facingDir - facingScaleX) * min(1.0, dt * 11.0)

        // When joystick is not moved and not boosting, keep shark stationary in place (zero drift in previous direction!)
        if !hasDirectionInput && !isBoosting {
            sharkVx = 0.0
            sharkVy = 0.0
            swimPhase += dt * 3.2
            return
        }

        let heatMult = viewModel?.huntingHeatBuff.speedMultiplier ?? 1.0
        let joySpeedFactor = isBoosting ? 1.0 : min(1.0, max(0.55, inputMagnitude))
        let speed = (isBoosting ? stats.boostSpeed : stats.moveSpeed * joySpeedFactor) * heatMult
        sharkVx = cos(sharkAngle) * speed
        sharkVy = sin(sharkAngle) * speed
        sharkX += sharkVx * dt
        sharkY = max(46.0, min(2200.0, sharkY + sharkVy * dt))
        swimPhase += dt * (isBoosting ? 12.5 : 7.8)

        // Emit swimming bubbles from shark tail (faster during Boost, shimmering Gold during Gold Frenzy!)
        let isFrenzy = viewModel?.frenzyActive ?? false
        let emitInterval = (isBoosting || isFrenzy) ? 0.045 : 0.16
        trailBubbleAccumulator += dt
        if trailBubbleAccumulator >= emitInterval {
            trailBubbleAccumulator = 0.0
            spawnSharkWakeBubble(stats: stats, isBoosting: isBoosting, isFrenzy: isFrenzy)
        }
    }

    private func spawnSharkWakeBubble(stats: ComputedSharkStats, isBoosting: Bool, isFrenzy: Bool) {
        if activeParticles.count > 44 { return }
        let tailX = sharkX - cos(sharkAngle) * 38.0 * stats.scale + Double.random(in: -6...6)
        let tailY = sharkY - sin(sharkAngle) * 38.0 * stats.scale + Double.random(in: -6...6)
        let rad = isFrenzy ? Double.random(in: 3.2...6.4) : (isBoosting ? Double.random(in: 2.8...5.6) : Double.random(in: 2.0...4.0))
        let bubble = SKShapeNode(circleOfRadius: CGFloat(rad))
        if isFrenzy {
            bubble.fillColor = UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 0.88)
            bubble.strokeColor = UIColor(red: 255/255, green: 251/255, blue: 235/255, alpha: 0.95)
            bubble.lineWidth = 1.4
        } else {
            bubble.fillColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.22)
            bubble.strokeColor = UIColor(red: 224/255, green: 242/255, blue: 254/255, alpha: 0.78)
            bubble.lineWidth = 1.15
        }
        bubble.zPosition = 18
        fxContainer.addChild(bubble)
        let backVx = -cos(sharkAngle) * (isBoosting ? 42.0 : 16.0) + Double.random(in: -14...14)
        let upVy = -Double.random(in: 22...52)
        activeParticles.append(
            ActiveParticle(
                node: bubble,
                x: tailX,
                y: tailY,
                vx: backVx,
                vy: upVy,
                maxLife: isFrenzy ? 0.58 : 0.65,
                baseRadius: rad
            )
        )
    }

    private func renderPlayerShark(viewW: Double, viewH: Double, stats: ComputedSharkStats) {
        let zoom = stats.cameraZoom
        let biteSnap = sin(biteAnim * .pi)
        let lungeWorld = biteSnap * 14.0 * stats.scale
        let screenX = viewW * 0.5 + (sharkX + cos(sharkAngle) * lungeWorld - cameraX) * zoom
        let screenY = viewH * 0.5 - (sharkY + sin(sharkAngle) * lungeWorld - cameraY) * zoom

        // 1:1 Constant-Area Aspect Normalization (drawW = baseSize * sqrt(aspect), drawH = baseSize / sqrt(aspect)) matching Web canvasRenderer.ts
        let baseSize = GameRules.sharkBaseDrawSize * stats.scale * zoom
        let texAspect: Double
        if let tex = sharkNode.texture, tex.size().height > 0 {
            texAspect = Double(tex.size().width / tex.size().height)
        } else {
            texAspect = 1.65
        }
        let clampedAspect = max(0.42, min(2.65, texAspect))
        let sqrtAspect = sqrt(clampedAspect)
        let drawW = baseSize * sqrtAspect
        let drawH = baseSize / sqrtAspect

        sharkNode.size = CGSize(width: drawW, height: drawH)
        sharkNode.position = CGPoint(x: screenX, y: screenY)

        let absFacing = max(0.15, abs(facingScaleX))
        let perspectiveScaleX = (0.42 + 0.58 * pow(absFacing, 0.8)) * (1.0 + biteSnap * 0.14) * (facingScaleX >= 0 ? 1.0 : -1.0)
        let horizonPitch = atan2(-sin(sharkAngle), abs(cos(sharkAngle)))
        sharkNode.xScale = CGFloat(perspectiveScaleX)
        sharkNode.yScale = CGFloat(1.0 + biteSnap * 0.11)
        sharkNode.zRotation = CGFloat(horizonPitch * (facingScaleX >= 0 ? 1.0 : -1.0))
        sharkNode.alpha = invulnTimer > 0 && Int(invulnTimer * 20) % 2 == 0 ? 0.45 : 1.0

        // Gold Frenzy 24K Shimmering Gold Tint & Damage Hit-Flash (1:1 parity with Web drawSharkWithOrgans)
        let isFrenzy = viewModel?.frenzyActive ?? false
        if invulnTimer > 0.65 {
            sharkNode.color = .white
            sharkNode.colorBlendFactor = 0.72
        } else if isFrenzy {
            sharkNode.color = UIColor(red: 1.0, green: 0.84, blue: 0.08, alpha: 1.0)
            sharkNode.colorBlendFactor = CGFloat(0.68 + 0.14 * sin(swimPhase * 2.2))
        } else {
            sharkNode.colorBlendFactor = 0.0
        }

        applySpineWaveWarp(to: sharkNode, phase: swimPhase, turnBend: turnRate)
    }

    private func applySpineWaveWarp(to node: SKSpriteNode, phase: Double, turnBend: Double) {
        let cols = 10
        var src: [SIMD2<Float>] = []
        var dst: [SIMD2<Float>] = []
        src.reserveCapacity((cols + 1) * 2)
        dst.reserveCapacity((cols + 1) * 2)

        for row in 0...1 {
            let v = Float(row)
            for col in 0...cols {
                let u = Float(col) / Float(cols)
                src.append(SIMD2<Float>(u, v))
                let tailProgress = Double(1.0 - u)
                let env = 0.015 * tailProgress + 0.985 * pow(tailProgress, 2.25)
                let waveDy = sin(phase - tailProgress * 2.15 * .pi) * 0.09 * env
                let cBendDy = -max(-0.8, min(0.8, turnBend)) * 0.14 * pow(tailProgress, 1.72)
                dst.append(SIMD2<Float>(u, v + Float(waveDy + cBendDy)))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: src, destinationPositions: dst)
    }

    private func classifyPreySwimGait(_ p: PreyTierConfig) -> PreySwimGait {
        if p.isHazard && p.baseSpeed < 12 { return .RIGID_PROPULSION }
        if p.behavior == .SUB_PATROL { return .RIGID_PROPULSION }
        if p.behavior == .EEL_CHARGER || p.id.contains("eel") || p.id.contains("oarfish") || p.id.contains("worm") {
            return .ANGUILLIFORM
        }
        if p.behavior == .PUFFER_INFLATE || p.id.contains("puffer") || p.id.contains("crab") || p.id.contains("isopod") || p.id.contains("starfish") {
            return .PUFFER_BUOYANT
        }
        if p.id.contains("jelly") || p.id.contains("squid") || p.id.contains("octopus") || p.id.contains("nautilus") || p.behavior == .KRAKEN_BOSS {
            return .MEDUSOID_JET
        }
        return .CARANGIFORM
    }

    private func applyPreySpineWaveWarp(to node: SKSpriteNode, prey: ActivePrey) {
        let gait = classifyPreySwimGait(prey.config)
        if gait == .RIGID_PROPULSION {
            node.warpGeometry = nil
            return
        }
        let cols = 8
        var src: [SIMD2<Float>] = []
        var dst: [SIMD2<Float>] = []
        src.reserveCapacity((cols + 1) * 2)
        dst.reserveCapacity((cols + 1) * 2)

        // Shark-like sleek anterior-locked envelope: head & chest (u -> 1.0) stay steady, posterior tail (u -> 0.0) sweeps smoothly
        for row in 0...1 {
            let v = Float(row)
            for col in 0...cols {
                let u = Float(col) / Float(cols)
                src.append(SIMD2<Float>(u, v))
                let tailProgress = Double(1.0 - u)
                let sharkLikeEnv = 0.015 * tailProgress + 0.985 * pow(tailProgress, 2.25)
                let dy: Double
                switch gait {
                case .CARANGIFORM:
                    dy = sin(prey.phase - tailProgress * 2.15 * .pi) * 0.068 * sharkLikeEnv
                case .ANGUILLIFORM:
                    let eelEnv = 0.02 * tailProgress + 0.98 * pow(tailProgress, 1.95)
                    dy = sin(prey.phase * 1.12 - tailProgress * 2.35 * .pi) * 0.082 * eelEnv
                case .MEDUSOID_JET:
                    dy = sin(prey.phase * 0.92 - tailProgress * 1.85 * .pi) * 0.056 * sharkLikeEnv
                case .PUFFER_BUOYANT:
                    dy = sin(prey.phase * 1.15 - tailProgress * 1.95 * .pi) * 0.046 * sharkLikeEnv
                case .RIGID_PROPULSION:
                    dy = 0
                }
                dst.append(SIMD2<Float>(u, v + Float(dy)))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: src, destinationPositions: dst)
    }

    // MARK: - 42 Depth-Reactive Ambient Ocean Bubbles / Marine Snow / Bioluminescent Spores / Magma Embers
    private func initAmbientBubblesIfNeeded(viewW: Double, viewH: Double) {
        if !ambientBubbles.isEmpty { return }
        bubbleContainer.removeAllChildren()
        for i in 0..<42 {
            let r = Double.random(in: 2.2...5.8)
            let ring = SKShapeNode(circleOfRadius: CGFloat(r))
            ring.lineWidth = 1.15

            let spec = SKShapeNode(circleOfRadius: CGFloat(r * 0.28))
            spec.fillColor = UIColor(white: 1.0, alpha: 0.72)
            spec.strokeColor = .clear
            spec.position = CGPoint(x: -r * 0.32, y: r * 0.32)
            ring.addChild(spec)

            bubbleContainer.addChild(ring)
            ambientBubbles.append(
                AmbientOceanBubble(
                    ringNode: ring,
                    highlightNode: spec,
                    x: Double.random(in: 0...(max(800, viewW * 1.5))),
                    y: Double.random(in: 0...(max(420, viewH))),
                    r: r,
                    speedY: Double.random(in: 16.0...38.0),
                    wobblePhase: Double.random(in: 0...(Double.pi * 2)),
                    baseAlpha: Double.random(in: 0.24...0.52),
                    kindIndex: i % 4
                )
            )
        }
    }

    private func stepAndRenderAmbientBubbles(viewW: Double, viewH: Double, bgScales: ParallaxLayerGrowthScales, dt: Double) {
        initAmbientBubblesIfNeeded(viewW: viewW, viewH: viewH)
        let depthRefY = max(0.0, sharkY)
        let isAbyss = depthRefY > 1150.0
        let isTwilight = depthRefY >= 520.0 && depthRefY <= 1150.0
        let pScale = bgScales.particleScale

        for b in ambientBubbles {
            // In SpriteKit Y=0 is bottom and Y=viewH is top, so rising bubbles increase Y (+1.0)
            let vertDir: Double = (isTwilight && b.kindIndex == 1) ? -0.35 : 1.0
            b.y += vertDir * b.speedY * dt
            b.wobblePhase += dt * 2.1

            if b.y > viewH + 22.0 {
                b.y = -16.0
                b.x = Double.random(in: 0...viewW)
            } else if b.y < -22.0 {
                b.y = viewH + 16.0
                b.x = Double.random(in: 0...viewW)
            }

            let rawX = b.x - cameraX * 0.55 * pScale + sin(b.wobblePhase) * 11.0 * pScale
            let screenX = ((rawX.truncatingRemainder(dividingBy: viewW)) + viewW).truncatingRemainder(dividingBy: viewW)
            b.ringNode.position = CGPoint(x: screenX, y: b.y)

            if isAbyss {
                let pulse = 0.65 + 0.35 * sin(b.wobblePhase * 1.8)
                b.ringNode.setScale(CGFloat(pScale * 0.78))
                b.ringNode.alpha = CGFloat(b.baseAlpha * pulse)
                let col = (b.kindIndex == 2)
                    ? UIColor(red: 192/255, green: 132/255, blue: 252/255, alpha: 1.0)
                    : UIColor(red: 251/255, green: 146/255, blue: 60/255, alpha: 1.0)
                b.ringNode.fillColor = col
                b.ringNode.strokeColor = .clear
                b.highlightNode.isHidden = true
            } else if isTwilight {
                let pulse = 0.55 + 0.45 * sin(b.wobblePhase * 1.5)
                b.ringNode.setScale(CGFloat(pScale * 0.72))
                b.ringNode.alpha = CGFloat(b.baseAlpha * pulse)
                let col = (b.kindIndex == 2)
                    ? UIColor(red: 34/255, green: 211/255, blue: 238/255, alpha: 1.0)
                    : UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 0.85)
                b.ringNode.fillColor = col
                b.ringNode.strokeColor = .clear
                b.highlightNode.isHidden = true
            } else {
                b.ringNode.setScale(CGFloat(pScale))
                b.ringNode.alpha = CGFloat(b.baseAlpha)
                b.ringNode.fillColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.18)
                b.ringNode.strokeColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.90)
                b.highlightNode.isHidden = false
            }
        }
    }

    // MARK: - Continuous Cross-Depth Multi-Biome Parallax Background (1:1 Parity with Web parallaxBackground.ts)
    private func renderParallaxBackground(viewW: Double, viewH: Double, bgScales: ParallaxLayerGrowthScales) {
        let depthRefY = max(0.0, sharkY)
        let rgb = GameRules.sampleBathymetricWaterRGB(depthMeters: cameraY)
        waterBgNode.color = UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z), alpha: 1.0)
        waterBgNode.size = CGSize(width: viewW, height: viewH)
        waterBgNode.position = CGPoint(x: viewW * 0.5, y: viewH * 0.5)

        activeParallaxTileCount = 0

        let assetMap: [String: (water: String, far: String, mid: String, near: String)] = [
            "bg_shallow": ("bg_shallow_0_water_0e65cb68", "bg_shallow_1_far_8898229a", "bg_shallow_2_mid_b4e0d30a", "bg_shallow_3_near_96e92ee1"),
            "bg_twilight": ("bg_twilight_0_17bcb84c", "bg_twilight_1_04f5d35f", "bg_twilight_2_fd5a1b33", "bg_twilight_3_6e0dd7c1"),
            "bg_abyss": ("bg_abyss_0_1bbf506a", "bg_abyss_1_75e4a628", "bg_abyss_2_6ce66695", "bg_abyss_3_a4986280")
        ]

        // 1. Layer 0 Water Backdrops blended smoothly across depth zones (zero horizontal or vertical seam lines!)
        if depthRefY < 680.0,
           let names0 = assetMap["bg_shallow"],
           let water0 = SpriteAtlasManager.shared.oceanParallaxTexture(named: names0.water, isWaterCanopy: true) {
            let wAlpha0 = depthRefY < 440.0 ? 0.92 : max(0.0, (1.0 - (depthRefY - 440.0) / 240.0) * 0.92)
            let refH = min(viewH, max(360.0, viewW * 0.65))
            let baseCanopyH = max(96.0, min(220.0, refH * 0.32))
            let canopyH = baseCanopyH * bgScales.waterScale
            let u0 = tanh(max(0.0, 680.0 - depthRefY) / 480.0)
            let canopyBottomY = viewH - canopyH + (1.0 - u0) * 4.0
            addTiledStrip(
                texture: water0,
                baseTargetH: baseCanopyH,
                scaledTargetH: canopyH,
                bottomYFromBottom: canopyBottomY,
                parallaxXFactor: 0.012,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: wAlpha0,
                zPos: 1.0
            )
        }

        if depthRefY > 420.0 && depthRefY < 1320.0,
           let names1 = assetMap["bg_twilight"],
           let water1 = SpriteAtlasManager.shared.oceanParallaxTexture(named: names1.water, isWaterCanopy: true) {
            var wAlpha1 = 0.88
            if depthRefY < 660.0 {
                wAlpha1 = ((depthRefY - 420.0) / 240.0) * 0.88
            } else if depthRefY > 1060.0 {
                wAlpha1 = (1.0 - (depthRefY - 1060.0) / 260.0) * 0.88
            }
            addTiledStrip(
                texture: water1,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: max(0.0, min(0.88, wAlpha1)),
                zPos: 1.1
            )
        }

        if depthRefY > 1040.0,
           let names2 = assetMap["bg_abyss"],
           let water2 = SpriteAtlasManager.shared.oceanParallaxTexture(named: names2.water, isWaterCanopy: true) {
            let wAlpha2 = depthRefY < 1300.0 ? ((depthRefY - 1040.0) / 260.0) * 0.92 : 0.92
            addTiledStrip(
                texture: water2,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: max(0.0, min(0.92, wAlpha2)),
                zPos: 1.2
            )
        }

        // 2. Layers 1, 2, 3 (Far, Mid, Near Terrain) with continuous cross-depth alpha transitions
        if depthRefY < 700.0, let names0 = assetMap["bg_shallow"] {
            let alpha0 = depthRefY < 460.0 ? 1.0 : max(0.0, 1.0 - (depthRefY - 460.0) / 220.0)
            renderBiomeTerrainPlanes(
                zonePrefix: "bg_shallow",
                names: names0,
                biomeFloorY: 680.0,
                depthRefY: depthRefY,
                alpha: alpha0,
                viewW: viewW,
                viewH: viewH,
                bgScales: bgScales,
                zBase: 2.0
            )
        }

        if depthRefY > 440.0 && depthRefY < 1340.0, let names1 = assetMap["bg_twilight"] {
            var alpha1 = 1.0
            if depthRefY < 660.0 {
                alpha1 = (depthRefY - 440.0) / 220.0
            } else if depthRefY > 1080.0 {
                alpha1 = 1.0 - (depthRefY - 1080.0) / 260.0
            }
            renderBiomeTerrainPlanes(
                zonePrefix: "bg_twilight",
                names: names1,
                biomeFloorY: 1340.0,
                depthRefY: depthRefY,
                alpha: max(0.0, min(1.0, alpha1)),
                viewW: viewW,
                viewH: viewH,
                bgScales: bgScales,
                zBase: 3.0
            )
        }

        if depthRefY > 1060.0, let names2 = assetMap["bg_abyss"] {
            let alpha2 = depthRefY < 1320.0 ? (depthRefY - 1060.0) / 260.0 : 1.0
            renderBiomeTerrainPlanes(
                zonePrefix: "bg_abyss",
                names: names2,
                biomeFloorY: 2100.0,
                depthRefY: depthRefY,
                alpha: max(0.0, min(1.0, alpha2)),
                viewW: viewW,
                viewH: viewH,
                bgScales: bgScales,
                zBase: 4.0
            )
        }

        // Hide any unused pooled tile nodes without removing them from the scene graph
        if activeParallaxTileCount < parallaxTilePool.count {
            for i in activeParallaxTileCount..<parallaxTilePool.count {
                parallaxTilePool[i].isHidden = true
            }
        }
    }

    private func renderBiomeTerrainPlanes(
        zonePrefix: String,
        names: (water: String, far: String, mid: String, near: String),
        biomeFloorY: Double,
        depthRefY: Double,
        alpha: Double,
        viewW: Double,
        viewH: Double,
        bgScales: ParallaxLayerGrowthScales,
        zBase: CGFloat
    ) {
        if alpha <= 0.01 { return }
        let u = tanh(max(0.0, biomeFloorY - depthRefY) / 480.0)
        let panoRefH = min(viewH, max(360.0, viewW * 0.65))
        let baseNearH = max(88.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.25 : zonePrefix == "bg_twilight" ? 0.30 : 0.48))
        let baseMidH = max(78.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.22 : zonePrefix == "bg_twilight" ? 0.37 : 0.54))
        let baseFarH = max(82.0, panoRefH * (zonePrefix == "bg_shallow" ? 0.232 : 0.42))

        if let farTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.far) {
            let farH = baseFarH * bgScales.farScale
            let farBottomY = min(0.0, (baseNearH * 0.32 - (-20.0 + 2.5 * u)) * bgScales.nearScale - farH * 0.12)
            addTiledStrip(
                texture: farTex,
                baseTargetH: baseFarH,
                scaledTargetH: farH,
                bottomYFromBottom: farBottomY,
                parallaxXFactor: 0.025,
                phaseOffset: 0.37,
                viewW: viewW,
                alpha: alpha * 0.94,
                zPos: zBase + 0.1
            )
        }

        if let midTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.mid) {
            let midH = baseMidH * bgScales.midScale
            let midBottomY = min(0.0, (baseNearH * 0.16 - (-10.0 + 14.0 * u)) * bgScales.nearScale - midH * 0.08)
            addTiledStrip(
                texture: midTex,
                baseTargetH: baseMidH,
                scaledTargetH: midH,
                bottomYFromBottom: midBottomY,
                parallaxXFactor: 0.18,
                phaseOffset: 0.63,
                viewW: viewW,
                alpha: alpha,
                zPos: zBase + 0.2
            )
        }

        if let nearTex = SpriteAtlasManager.shared.oceanParallaxTexture(named: names.near) {
            let nearH = baseNearH * bgScales.nearScale
            let nearBottomY = -28.0 * u * bgScales.nearScale
            addTiledStrip(
                texture: nearTex,
                baseTargetH: baseNearH,
                scaledTargetH: nearH,
                bottomYFromBottom: nearBottomY,
                parallaxXFactor: 0.38,
                phaseOffset: 0.21,
                viewW: viewW,
                alpha: alpha,
                zPos: zBase + 0.3
            )
        }
    }

    private func acquirePooledParallaxTile() -> SKSpriteNode {
        if activeParallaxTileCount < parallaxTilePool.count {
            let node = parallaxTilePool[activeParallaxTileCount]
            activeParallaxTileCount += 1
            node.isHidden = false
            return node
        }
        let node = SKSpriteNode()
        node.anchorPoint = CGPoint(x: 0, y: 0)
        parallaxContainer.addChild(node)
        parallaxTilePool.append(node)
        activeParallaxTileCount += 1
        return node
    }

    private func addTiledStrip(
        texture: SKTexture,
        baseTargetH: Double,
        scaledTargetH: Double,
        bottomYFromBottom: Double,
        parallaxXFactor: Double,
        phaseOffset: Double = 0.50,
        viewW: Double,
        alpha: Double,
        zPos: CGFloat
    ) {
        let texSize = texture.size()
        guard texSize.height > 0 && alpha > 0.004 else { return }
        let aspect = Double(texSize.width / texSize.height)
        let baseTileW = max(256.0, baseTargetH * aspect)
        let tileW = ceil(max(148.0, scaledTargetH * aspect))
        let displayScale = Double(max(1.0, view?.contentScaleFactor ?? UIScreen.main.scale))

        let rawPhase = (cameraX * parallaxXFactor) / baseTileW + phaseOffset
        let normPhase = (rawPhase.truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0)
        let centerAnchorX = viewW * 0.5 - normPhase * tileW
        var startX = ((centerAnchorX.truncatingRemainder(dividingBy: tileW) + tileW).truncatingRemainder(dividingBy: tileW)) - tileW
        let alignedY = (bottomYFromBottom * displayScale).rounded(.down) / displayScale
        let alignedH = ceil(scaledTargetH * displayScale) / displayScale

        while startX < viewW {
            let x0 = (startX * displayScale).rounded() / displayScale
            let x1 = ((startX + tileW) * displayScale).rounded() / displayScale
            let node = acquirePooledParallaxTile()
            node.texture = texture
            // Exact physical pixel boundary abutment (x0 -> x1) with ZERO double-alpha overlap!
            node.size = CGSize(width: max(1.0, x1 - x0), height: alignedH)
            node.position = CGPoint(x: x0, y: alignedY)
            node.alpha = CGFloat(alpha)
            node.zPosition = zPos
            startX += tileW
        }
    }

    private func syncPreyPopulation() {
        while activePreys.count < maxActivePreys {
            spawnOnePrey(nearShark: activePreys.count < 7)
        }
    }

    private func spawnOnePrey(nearShark: Bool) {
        let targetDepth = max(60.0, sharkY + Double.random(in: -260...260))
        let candidates = GameConfigGenerated.preyTiers.filter { p in
            if targetDepth <= 520 && (p.behavior == .EEL_CHARGER || p.isHazard || p.isBoss) {
                return false
            }
            return targetDepth >= p.minDepth && targetDepth <= p.maxDepth
        }
        let chosen = candidates.randomElement() ?? GameConfigGenerated.preyTiers[0]
        let dist = nearShark ? Double.random(in: 220...480) : Double.random(in: 580...1400)
        let ang = Double.random(in: 0...(Double.pi * 2))
        let px = sharkX + cos(ang) * dist
        let py = max(chosen.minDepth, min(chosen.maxDepth, sharkY + sin(ang) * dist * 0.6))
        let dir: Double = Bool.random() ? 1.0 : -1.0

        let node = SKSpriteNode()
        if let tex = SpriteAtlasManager.shared.preyTexture(for: chosen.spriteKey) {
            node.texture = tex
        }
        node.zPosition = 12
        worldContainer.addChild(node)
        activePreys.append(
            ActivePrey(
                config: chosen,
                node: node,
                x: px,
                y: py,
                vx: dir * chosen.baseSpeed,
                vy: sin(ang) * chosen.baseSpeed * 0.25,
                mutation: Double.random(in: 0...1) < 0.08 ? .GOLDEN_SWARM : .NONE
            )
        )
    }

    // MARK: - Devour Particles, Spinning Coin/Gene Pickups & Floating Combat Text
    private func spawnDevourParticles(x: Double, y: Double, preyTier: Int, isGolden: Bool) {
        // 1. Expanding Devour Shockwave Ring
        let ringNode = SKShapeNode(circleOfRadius: 10)
        ringNode.strokeColor = isGolden
            ? UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 0.95)
            : UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 0.90)
        ringNode.fillColor = .clear
        ringNode.lineWidth = 2.6
        ringNode.zPosition = 26
        fxContainer.addChild(ringNode)
        activeParticles.append(
            ActiveParticle(node: ringNode, x: x, y: y, vx: 0, vy: 0, maxLife: 0.34, baseRadius: 10, isRing: true)
        )

        // 2. Bursting Green/Teal Devour Slime Bubbles & Golden Sparks
        let count = min(22, 10 + preyTier * 2)
        for i in 0..<count {
            let ang = Double.random(in: 0...(Double.pi * 2))
            let spd = Double.random(in: 65...255)
            let rad = Double.random(in: 2.8...6.8)
            let dot = SKShapeNode(circleOfRadius: CGFloat(rad))
            if isGolden || i % 3 == 0 {
                dot.fillColor = UIColor(red: 250/255, green: 204/255, blue: 21/255, alpha: 1.0)
                dot.strokeColor = UIColor.white.withAlphaComponent(0.7)
            } else if i % 2 == 0 {
                dot.fillColor = UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 187/255, green: 247/255, blue: 208/255, alpha: 0.8)
            } else {
                dot.fillColor = UIColor(red: 45/255, green: 212/255, blue: 191/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 153/255, green: 246/255, blue: 228/255, alpha: 0.8)
            }
            dot.lineWidth = 1.0
            dot.zPosition = 25
            fxContainer.addChild(dot)
            activeParticles.append(
                ActiveParticle(
                    node: dot,
                    x: x,
                    y: y,
                    vx: cos(ang) * spd,
                    vy: sin(ang) * spd - Double.random(in: 12...45),
                    maxLife: Double.random(in: 0.36...0.68),
                    baseRadius: rad
                )
            )
        }
    }

    private func spawnDevourPickups(x: Double, y: Double, coinGain: Int, geneGain: Int) {
        let coinCount = min(4, max(1, (coinGain + 3) / 4))
        let baseCoinVal = max(1, coinGain / coinCount)
        for i in 0..<coinCount {
            let val = (i == coinCount - 1) ? max(1, coinGain - baseCoinVal * (coinCount - 1)) : baseCoinVal
            let node = SKSpriteNode()
            if let img = SpriteAtlasManager.shared.uiIconImage(for: "UI_ICON_COIN") {
                node.texture = SKTexture(image: img)
            }
            node.size = CGSize(width: 22, height: 22)
            node.zPosition = 24
            fxContainer.addChild(node)
            let ang = Double.random(in: 0...(Double.pi * 2))
            let spd = Double.random(in: 75...165)
            activePickups.append(
                ActivePickup(
                    isGene: false,
                    value: val,
                    node: node,
                    x: x + cos(ang) * 10.0,
                    y: y + sin(ang) * 10.0,
                    vx: cos(ang) * spd,
                    vy: sin(ang) * spd - 35.0
                )
            )
        }

        if geneGain > 0 {
            let node = SKSpriteNode()
            if let img = SpriteAtlasManager.shared.uiIconImage(for: "UI_ICON_GENE") {
                node.texture = SKTexture(image: img)
            }
            node.size = CGSize(width: 24, height: 24)
            node.zPosition = 24
            fxContainer.addChild(node)
            let ang = Double.random(in: 0...(Double.pi * 2))
            activePickups.append(
                ActivePickup(
                    isGene: true,
                    value: geneGain,
                    node: node,
                    x: x,
                    y: y,
                    vx: cos(ang) * 120.0,
                    vy: sin(ang) * 120.0 - 45.0
                )
            )
        }
    }

    private func spawnFloatingText(x: Double, y: Double, text: String, color: UIColor, fontSize: CGFloat = 14) {
        if activeFloatTexts.count > 16 {
            let oldest = activeFloatTexts.removeFirst()
            oldest.node.removeFromParent()
        }
        let lbl = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        lbl.text = text
        lbl.fontSize = fontSize
        lbl.fontColor = color
        lbl.verticalAlignmentMode = .center
        lbl.horizontalAlignmentMode = .center
        lbl.zPosition = 30
        fxContainer.addChild(lbl)
        activeFloatTexts.append(
            ActiveFloatText(node: lbl, x: x, y: y, vy: -52.0, maxLife: 0.95)
        )
    }

    private func stepAndRenderDevourFX(viewW: Double, viewH: Double, stats: ComputedSharkStats, dt: Double) {
        guard let vm = viewModel else { return }
        let zoom = stats.cameraZoom

        // 1. Update & Render Devour Burst Particles
        var pIdx = activeParticles.count - 1
        while pIdx >= 0 {
            let pt = activeParticles[pIdx]
            pt.life -= dt
            if pt.life <= 0 {
                pt.node.removeFromParent()
                activeParticles.remove(at: pIdx)
                pIdx -= 1
                continue
            }
            let progress = 1.0 - (pt.life / pt.maxLife)
            if pt.isRing {
                let scale = 1.0 + progress * 3.8
                pt.node.setScale(CGFloat(scale))
                pt.node.alpha = CGFloat(max(0.0, 1.0 - progress))
            } else {
                pt.x += pt.vx * dt
                pt.y += pt.vy * dt
                pt.vx *= 0.92
                pt.vy = pt.vy * 0.92 - 18.0 * dt
                pt.node.setScale(CGFloat(max(0.2, 1.0 - progress * 0.65)))
                pt.node.alpha = CGFloat(max(0.0, 1.0 - progress * 0.85))
            }
            let sx = viewW * 0.5 + (pt.x - cameraX) * zoom
            let sy = viewH * 0.5 - (pt.y - cameraY) * zoom
            pt.node.position = CGPoint(x: sx, y: sy)
            pIdx -= 1
        }

        // 2. Update & Render 3D Spinning Coin & Gene Pickups with Magnetic Pull
        let magnetR = (vm.frenzyActive ? 390.0 : 120.0) + stats.magnetRadius
        var kIdx = activePickups.count - 1
        while kIdx >= 0 {
            let pk = activePickups[kIdx]
            pk.life -= dt
            pk.spinPhase += dt * 9.5
            let dx = sharkX - pk.x
            let dy = sharkY - pk.y
            let dist = hypot(dx, dy)

            if dist < magnetR && dist > 1.0 {
                let pullSpeed = vm.frenzyActive ? 620.0 : 410.0
                pk.vx += (dx / dist) * pullSpeed * dt * 5.2
                pk.vy += (dy / dist) * pullSpeed * dt * 5.2
            } else {
                pk.vx *= 0.94
                pk.vy = pk.vy * 0.94 - 8.0 * dt
            }
            pk.x += pk.vx * dt
            pk.y += pk.vy * dt

            if dist < 38.0 * stats.scale || pk.life <= 0 {
                if dist < 38.0 * stats.scale {
                    if pk.isGene {
                        vm.save.bankedGenes += pk.value
                        vm.runGenesEarned += pk.value
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 12,
                            text: "+\(pk.value) 🧬",
                            color: UIColor(red: 110/255, green: 231/255, blue: 183/255, alpha: 1.0),
                            fontSize: 13
                        )
                    } else {
                        vm.save.bankedCoins += pk.value
                        vm.runCoinsEarned += pk.value
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 10,
                            text: "+\(pk.value) 🪙",
                            color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                            fontSize: 12
                        )
                    }
                }
                pk.node.removeFromParent()
                activePickups.remove(at: kIdx)
                kIdx -= 1
                continue
            }

            let sx = viewW * 0.5 + (pk.x - cameraX) * zoom
            let sy = viewH * 0.5 - (pk.y - cameraY) * zoom
            pk.node.position = CGPoint(x: sx, y: sy)
            // 3D coin flip / crystal spin effect
            pk.node.xScale = CGFloat(0.35 + 0.65 * abs(cos(pk.spinPhase)))
            pk.node.yScale = 1.0
            kIdx -= 1
        }

        // 3. Update & Render Floating Combat Text Popups
        var fIdx = activeFloatTexts.count - 1
        while fIdx >= 0 {
            let ft = activeFloatTexts[fIdx]
            ft.life -= dt
            if ft.life <= 0 {
                ft.node.removeFromParent()
                activeFloatTexts.remove(at: fIdx)
                fIdx -= 1
                continue
            }
            ft.y += ft.vy * dt
            ft.vy *= 0.94
            let progress = 1.0 - (ft.life / ft.maxLife)
            let popScale = progress < 0.18 ? (0.65 + (progress / 0.18) * 0.48) : (1.13 - (progress - 0.18) * 0.22)
            let sx = viewW * 0.5 + (ft.x - cameraX) * zoom
            let sy = viewH * 0.5 - (ft.y - cameraY) * zoom
            ft.node.position = CGPoint(x: sx, y: sy)
            ft.node.setScale(CGFloat(max(0.5, popScale)))
            ft.node.alpha = CGFloat(min(1.0, ft.life / (ft.maxLife * 0.42)))
            fIdx -= 1
        }
    }

    private func stepAndRenderPreys(viewW: Double, viewH: Double, stats: ComputedSharkStats, dt: Double, currentTime: TimeInterval) {
        guard let vm = viewModel else { return }
        syncPreyPopulation()
        let zoom = stats.cameraZoom

        var idx = activePreys.count - 1
        while idx >= 0 {
            let p = activePreys[idx]
            let gait = classifyPreySwimGait(p.config)
            let speedNorm = max(0.72, min(1.35, hypot(p.vx, p.vy) / max(18.0, p.config.baseSpeed)))
            p.phase += dt * 4.6 * speedNorm
            p.stateTimer += dt

            let dx = p.x - sharkX
            let dy = p.y - sharkY
            let dist = hypot(dx, dy)

            if dist > 1950 {
                p.node.removeFromParent()
                activePreys.remove(at: idx)
                idx -= 1
                continue
            }

            let visualScale = GameRules.getPreyRelativeVisualScale(
                prey: p.config,
                sharkStats: stats,
                mutationVariant: p.mutation
            )
            let encounterPreview = GameRules.resolvePreyEncounter(
                prey: p.config,
                sharkStats: stats,
                isBoosting: vm.isBoostingHeld && vm.energy > 2.0,
                frenzyActive: vm.frenzyActive,
                mutationVariant: p.mutation
            )

            // Biomechanical Smooth Horizontal Cruising Trajectory AI (1:1 parity with src/App.tsx)
            let dirSign: Double = p.vx >= 0 ? 1.0 : -1.0
            switch p.config.behavior {
            case .SCHOOL_FLEE:
                if dist < 250 && encounterPreview == .DEVOUR && dist > 1.0 {
                    let fleeAng = atan2(dy, dx) + sin(p.phase * 1.35) * 0.18
                    let fleeSpd = p.config.baseSpeed * 1.42
                    p.vx += (cos(fleeAng) * fleeSpd - p.vx) * min(1.0, dt * 4.5)
                    p.vy += (sin(fleeAng) * fleeSpd - p.vy) * min(1.0, dt * 4.5)
                } else {
                    let targetY = p.cruiseDepthCenter + sin(p.stateTimer * p.cruiseFreq) * p.cruiseAmpY
                    let desiredVy = (targetY - p.y) * 0.92 + cos(p.phase * 0.65) * p.config.baseSpeed * 0.14
                    let desiredVx = dirSign * p.config.baseSpeed * (0.92 + 0.12 * sin(p.stateTimer * 0.95))
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
                }
            case .PUFFER_INFLATE:
                let targetInflate = dist < 195 ? 1.0 : 0.0
                p.inflateRatio += (targetInflate - p.inflateRatio) * min(1.0, dt * 4.5)
                let targetY = p.cruiseDepthCenter + sin(p.stateTimer * 0.65) * (p.cruiseAmpY * 0.65)
                let desiredVy = (targetY - p.y) * 0.85 + sin(p.phase * 0.6) * 12.0
                let desiredVx = dirSign * p.config.baseSpeed * (1.0 - p.inflateRatio * 0.35)
                p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
            case .EEL_CHARGER:
                if dist < 310 && encounterPreview != .DEVOUR && dist > 1.0 {
                    let atkAng = atan2(-dy, -dx) + sin(p.phase * 1.4) * 0.14
                    let atkSpd = p.config.baseSpeed * 1.42
                    p.vx += (cos(atkAng) * atkSpd - p.vx) * min(1.0, dt * 4.0)
                    p.vy += (sin(atkAng) * atkSpd - p.vy) * min(1.0, dt * 4.0)
                } else {
                    let desiredVy = cos(p.phase * 0.75) * p.config.baseSpeed * 0.18
                    let desiredVx = dirSign * p.config.baseSpeed
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
                }
            case .MINE_HAZARD:
                p.vx = sin(p.stateTimer * 0.8 + p.phase * 0.2) * 8.0
                p.vy = cos(p.stateTimer * 1.1 + p.phase * 0.3) * 10.0
            default:
                if gait == .MEDUSOID_JET {
                    let jetPulse = 0.72 + 0.38 * pow(max(0.0, sin(p.phase * 0.65)), 2.0)
                    let desiredVx = dirSign * p.config.baseSpeed * jetPulse
                    let desiredVy = cos(p.stateTimer * 0.75) * 14.0
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.5)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.5)
                } else {
                    let targetY = p.cruiseDepthCenter + sin(p.stateTimer * p.cruiseFreq) * p.cruiseAmpY
                    let desiredVy = (targetY - p.y) * 0.88 + sin(p.phase * 0.6) * p.config.baseSpeed * 0.14
                    let desiredVx = dirSign * p.config.baseSpeed * (0.92 + 0.12 * cos(p.stateTimer * 0.85))
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 2.8)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 2.8)
                }
            }

            // Jaw Suction Pull: pull devourable prey straight into the shark's open jaws when close!
            let suctionRadius = (58.0 + stats.magnetRadius * 0.35) * stats.jawSuctionMultiplier * stats.scale
            let mouthX = sharkX + cos(sharkAngle) * 28.0 * stats.scale
            let mouthY = sharkY + sin(sharkAngle) * 28.0 * stats.scale
            let mouthDist = hypot(mouthX - p.x, mouthY - p.y)
            if vm.gameState == "playing" && encounterPreview == .DEVOUR && mouthDist < suctionRadius && mouthDist > 1.0 {
                let pullStrength = (1.0 - mouthDist / suctionRadius) * 540.0
                p.x += ((mouthX - p.x) / mouthDist) * pullStrength * dt
                p.y += ((mouthY - p.y) / mouthDist) * pullStrength * dt
                if biteAnim < 0.35 {
                    biteAnim = 0.55
                }
            }

            p.x += p.vx * dt
            p.y += p.vy * dt
            if p.y < p.config.minDepth + 14.0 {
                p.y = p.config.minDepth + 14.0
                p.vy = abs(p.vy) * 0.65 + 18.0
            } else if p.y > p.config.maxDepth - 14.0 {
                p.y = p.config.maxDepth - 14.0
                p.vy = -abs(p.vy) * 0.65 - 18.0
            }

            let postDx = p.x - sharkX
            let postDy = p.y - sharkY
            let postDist = hypot(postDx, postDy)
            let hitRadius = p.config.radius * visualScale + 28.0 * stats.scale

            if vm.gameState == "playing" && postDist < hitRadius {
                if encounterPreview == .DEVOUR {
                    biteAnim = 1.0
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + (p.config.tier >= 4 ? 0.36 : 0.16))

                    let mult = p.mutation == .GOLDEN_SWARM ? 3 : 1
                    let heatScoreMult = vm.huntingHeatBuff.scoreMultiplier
                    let scoreGain = Int((Double(p.config.scoreValue * mult) * heatScoreMult).rounded())
                    vm.score += scoreGain

                    let coinGain = max(1, Int((Double(p.config.coinValue * mult) * stats.coinYieldMultiplier).rounded()))
                    var geneGain = 0
                    if p.config.geneValue > 0 && (p.mutation == .GOLDEN_SWARM || Double.random(in: 0...1) < 0.38) {
                        geneGain = max(1, Int((Double(p.config.geneValue) * stats.geneYieldMultiplier).rounded()))
                    }

                    // Spawn devour particles, spinning coin/gene pickups & floating combat text
                    spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier, isGolden: p.mutation == .GOLDEN_SWARM)
                    spawnDevourPickups(x: p.x, y: p.y, coinGain: coinGain, geneGain: geneGain)

                    vm.comboCount += 1
                    vm.comboTimer = 4.2
                    if vm.comboCount > vm.runPeakCombo {
                        vm.runPeakCombo = vm.comboCount
                    }

                    let devourLabel: String
                    if p.mutation == .GOLDEN_SWARM {
                        devourLabel = vm.lang == "zh" ? "✨ 黄金吞噬! +\(scoreGain)" : "✨ GOLDEN! +\(scoreGain)"
                    } else if vm.comboCount >= 3 {
                        devourLabel = vm.lang == "zh"
                            ? "一口吞噬! +\(scoreGain) · x\(vm.comboCount)🔥"
                            : "CHOMP! +\(scoreGain) · x\(vm.comboCount)🔥"
                    } else {
                        devourLabel = "+\(scoreGain)"
                    }
                    spawnFloatingText(
                        x: p.x,
                        y: p.y - 14,
                        text: devourLabel,
                        color: p.mutation == .GOLDEN_SWARM
                            ? UIColor(red: 250/255, green: 204/255, blue: 21/255, alpha: 1.0)
                            : UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 1.0),
                        fontSize: vm.comboCount >= 5 ? 15 : 13
                    )

                    // Target Bounty check
                    if p.config.id == vm.targetBountyPreyId {
                        vm.targetBountyCaptured += 1
                        if vm.targetBountyCaptured >= 3 {
                            vm.save.bankedCoins += 45
                            vm.save.bankedGenes += 3
                            vm.runCoinsEarned += 45
                            vm.runGenesEarned += 3
                            vm.pickNewBountyPrey()
                            vm.playSuccessSound()
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 34,
                                text: vm.lang == "zh" ? "🎯 悬赏达成! +45🪙 +3🧬" : "🎯 BOUNTY! +45🪙 +3🧬",
                                color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                                fontSize: 15
                            )
                        }
                    }

                    // Golden mutant charge check
                    if p.mutation == .GOLDEN_SWARM {
                        vm.goldenMutantCharge += 1
                        if vm.goldenMutantCharge >= vm.goldenMutantNeed {
                            vm.goldenMutantCharge = 0
                            vm.frenzyActive = true
                            vm.frenzyTimer = GameConfigGenerated.frenzyDuration + stats.frenzyDurationBonus
                            vm.recomputeCurrentSharkStats()
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 40,
                                text: vm.lang == "zh" ? "🔥 黄金狂暴觉醒!" : "🔥 GOLDEN FRENZY!",
                                color: UIColor.yellow,
                                fontSize: 16
                            )
                        }
                    }

                    // Onboarding Step 1 check
                    if vm.onboardingStep == .EAT_SMALL_FISH {
                        vm.onboardingEatCount += 1
                        if vm.onboardingEatCount >= 3 {
                            vm.onboardingStep = .HOLD_BOOST
                            vm.playSuccessSound()
                        }
                    }

                    vm.hp = min(vm.maxHp, vm.hp + p.config.hpRestore * stats.devourHealMultiplier)
                    if vm.addXp(p.config.xpValue * mult) {
                        spawnFloatingText(
                            x: sharkX,
                            y: sharkY - 38,
                            text: vm.lang == "zh" ? "⚡ LV.\(vm.inRunLevel) 体型成长!" : "⚡ LV.\(vm.inRunLevel) SIZE UP!",
                            color: UIColor.cyan,
                            fontSize: 16
                        )
                    }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    p.node.removeFromParent()
                    activePreys.remove(at: idx)
                    idx -= 1
                    continue
                } else if encounterPreview == .ARMOR_CRUSH {
                    p.armorHp -= 1
                    biteAnim = 0.85
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.42)
                    invulnTimer = 0.45
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    if p.armorHp <= 0 {
                        vm.score += p.config.scoreValue * 2
                        let gGain = max(1, p.config.geneValue * 2)
                        spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier + 2, isGolden: true)
                        spawnDevourPickups(x: p.x, y: p.y, coinGain: p.config.coinValue * 2, geneGain: gGain)
                        spawnFloatingText(
                            x: p.x,
                            y: p.y - 16,
                            text: vm.lang == "zh" ? "💥 破甲粉碎! +\(p.config.scoreValue * 2)" : "💥 ARMOR CRUSH! +\(p.config.scoreValue * 2)",
                            color: UIColor.cyan,
                            fontSize: 15
                        )
                        _ = vm.addXp(Int(Double(p.config.xpValue) * 1.5))
                        p.node.removeFromParent()
                        activePreys.remove(at: idx)
                        idx -= 1
                        continue
                    } else {
                        spawnFloatingText(
                            x: p.x,
                            y: p.y - 14,
                            text: vm.lang == "zh" ? "⚡ 护甲裂纹!" : "⚡ ARMOR CRACK!",
                            color: UIColor.orange,
                            fontSize: 13
                        )
                        p.x += (postDx / max(1.0, postDist)) * 65.0
                    }
                } else if invulnTimer <= 0 {
                    vm.hp = max(0, vm.hp - p.config.damageOnFail * stats.damageTakenMultiplier)
                    invulnTimer = 0.85
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.48)
                    spawnFloatingText(
                        x: sharkX,
                        y: sharkY - 26,
                        text: vm.lang == "zh" ? "⚠️ 体型过大! 需T\(p.config.tier)" : "⚠️ NEED T\(p.config.tier)!",
                        color: UIColor(red: 248/255, green: 113/255, blue: 113/255, alpha: 1.0),
                        fontSize: 14
                    )
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
            }

            let screenX = viewW * 0.5 + (p.x - cameraX) * zoom
            let screenY = viewH * 0.5 - (p.y - cameraY) * zoom
            let inflateScale = 1.0 + p.inflateRatio * 0.38
            let baseSize = p.config.radius * GameRules.preyRadiusToDrawSize * visualScale * inflateScale * zoom
            let texAspect: Double
            if let tex = p.node.texture, tex.size().height > 0 {
                texAspect = Double(tex.size().width / tex.size().height)
            } else {
                texAspect = 1.45
            }
            let clampedAspect = max(0.42, min(2.65, texAspect))
            let sqrtAspect = sqrt(clampedAspect)
            let drawW = baseSize * sqrtAspect
            let drawH = (baseSize / sqrtAspect) * (p.inflateRatio > 0.05 ? 1.16 : 1.0)
            p.node.size = CGSize(width: drawW, height: drawH)
            p.node.position = CGPoint(x: screenX, y: screenY)

            // Smooth horizontal flip (prey sprites face RIGHT in sheet: +1 when vx >= 0, -1 when vx < 0) + calm shark-like horizontal pitch
            let facingSign: Double = p.vx >= 0 ? 1.0 : -1.0
            let pitchAngle = max(-0.22, min(0.22, atan2(-p.vy, max(24.0, abs(p.vx))) * 0.42))
            p.node.xScale = CGFloat(facingSign)
            p.node.yScale = 1.0
            p.node.zRotation = CGFloat(pitchAngle * facingSign)

            // Gold Frenzy & Golden Mutant 24K Gold Shimmer Tint (1:1 parity with Web drawPreyEntity)
            if vm.frenzyActive || p.mutation == .GOLDEN_SWARM {
                p.node.color = UIColor(red: 1.0, green: 0.85, blue: 0.12, alpha: 1.0)
                p.node.colorBlendFactor = CGFloat(0.66 + 0.14 * sin(p.phase * 1.8))
            } else if p.mutation == .ABYSS_BEHEMOTH {
                p.node.color = UIColor(red: 0.68, green: 0.28, blue: 0.98, alpha: 1.0)
                p.node.colorBlendFactor = 0.45
            } else {
                p.node.colorBlendFactor = 0.0
            }

            applyPreySpineWaveWarp(to: p.node, prey: p)
            idx -= 1
        }
    }
}
