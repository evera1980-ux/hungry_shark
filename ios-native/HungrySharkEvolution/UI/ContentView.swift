import SwiftUI
import SpriteKit
import UIKit

// MARK: - Main ContentView (Title, Playing HUD, Sonar Joystick & Lifecycle Shell)

public struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject var vm = GameViewModel()
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared
    @ObservedObject private var adManager = GoogleAdMobManager.shared
    @State private var scene: OceanGameScene = {
        let s = OceanGameScene(size: CGSize(width: 844, height: 390))
        s.scaleMode = .resizeFill
        return s
    }()
    @State var joystickResetToken: Int = 0

    public init() {
        GADInfoPlistRuntimePatch.installIfNeeded()
    }

    public var body: some View {
        GeometryReader { geo in
            let isCompactH: Bool = geo.size.height < 460
            ZStack {
                // 0. Base Abyssal Backdrop (#061528) so the root container is never black
                Color(red: 6.0 / 255.0, green: 21.0 / 255.0, blue: 40.0 / 255.0)
                    .ignoresSafeArea()

                // 1. Native Metal-Accelerated SpriteKit Ocean Canvas (Zero WebView!)
                oceanSpriteCanvasLayer

                // 2. Active Gameplay or Title Screen HUD Layer
                activeStateHudLayer(geo: geo, isCompactH: isCompactH)

                // 3. Pause, GameOver & 48-Shark Evolution Atlas Modals
                modalAndAtlasLayer(geo: geo)

                // 4. Ad Connection, Ad Alert & Layer 2 Dynamic Startup Loading Overlay
                systemAndStartupOverlayLayer
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        .statusBarHidden(true)
        .onChange(of: vm.gameState) { _ in
            joystickResetToken &+= 1
            vm.resetInputState()
        }
        .onChange(of: vm.runSequenceId) { _ in
            joystickResetToken &+= 1
            vm.resetInputState()
        }
        .onChange(of: vm.showEvolutionAtlas) { shown in
            if shown {
                joystickResetToken &+= 1
                vm.resetInputState()
            }
        }
        .onChange(of: scenePhase) { newPhase in
            switch newPhase {
            case .active:
                handleAppBecameActive()
            case .inactive, .background:
                handleAppResignedActive()
            @unknown default:
                handleAppResignedActive()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)) { _ in
            handleAppResignedActive()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            handleAppBecameActive()
        }
    }

    private func handleAppResignedActive() {
        joystickResetToken &+= 1
        vm.resetInputState()
        scene.isPaused = true
        scene.resetFrameClock()
        if vm.gameState == "playing" {
            vm.pauseGame(silent: true)
        }
        OceanAudioEngine.shared.handleAppBackgrounded()
    }

    private func handleAppBecameActive() {
        scene.resetFrameClock()
        scene.isPaused = false
        OceanAudioEngine.shared.handleAppForegrounded(soundEnabled: vm.save.soundEnabled)
    }

    private var oceanSpriteCanvasLayer: some View {
        SpriteView(scene: scene, preferredFramesPerSecond: 60)
            .ignoresSafeArea()
            .onAppear {
                atlasManager.startAsyncPreloadIfNeeded(initialSharkId: vm.activeSharkId)
                scene.viewModel = vm
                scene.refreshSharkTexture()
            }
            .onChange(of: atlasManager.isReady) { ready in
                if ready {
                    scene.onAtlasPreloadCompleted()
                }
            }
            .onChange(of: vm.save.selectedSharkId) { _ in
                scene.refreshSharkTexture()
            }
            .onChange(of: vm.trialSharkIdForRun) { _ in
                scene.refreshSharkTexture()
            }
    }

    static func currentWindowSafeAreaInsets() -> UIEdgeInsets {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            if let keyWindow = windowScene.windows.first(where: \.isKeyWindow) ?? windowScene.windows.first {
                return keyWindow.safeAreaInsets
            }
        }
        return .zero
    }

    static func cornerHudInset(for rawSafeInset: CGFloat, fallback: CGFloat = 14.0) -> CGFloat {
        if rawSafeInset >= 48.0 {
            // Dynamic Island (iPhone 14/15/16 Pro & Pro Max report 59pt across the full vertical edge):
            // Top/bottom HUD sit completely above/below the island housing (`y ≈ 152..278pt`) and only
            // need ~24pt to trace the 55pt rounded screen corner cleanly.
            return 24.0
        } else if rawSafeInset >= 34.0 {
            // Notch iPhones (44~47pt landscape safe area): 20pt comfortably clears corner bezels.
            return 20.0
        } else {
            return max(fallback, rawSafeInset)
        }
    }

    @ViewBuilder
    private func activeStateHudLayer(geo: GeometryProxy, isCompactH: Bool) -> some View {
        let winInsets = Self.currentWindowSafeAreaInsets()
        let rawLead = max(geo.safeAreaInsets.leading, winInsets.left)
        let rawTrail = max(geo.safeAreaInsets.trailing, winInsets.right)
        let rawTop = max(geo.safeAreaInsets.top, winInsets.top)
        let rawBottom = max(geo.safeAreaInsets.bottom, winInsets.bottom)

        let hudLead = Self.cornerHudInset(for: rawLead, fallback: isCompactH ? 18.0 : 16.0)
        let hudTrail = Self.cornerHudInset(for: rawTrail, fallback: isCompactH ? 18.0 : 16.0)
        let hudTop = max(isCompactH ? 8.0 : 10.0, rawTop)
        // Corner joystick & boost sit far left/right of the centered Home Indicator (`x ≈ 308..624pt`).
        let cornerBottom: CGFloat = 12.0
        let centerBannerBottom = max(14.0, rawBottom)

        if vm.gameState == "playing" {
            VStack(spacing: 3) {
                HStack(alignment: .top, spacing: 8) {
                    UiAvatarDataBarView(vm: vm, height: isCompactH ? 56 : 64)
                    Spacer(minLength: 4)
                    telemetryPill(isCompact: isCompactH)
                    Spacer(minLength: 4)
                    pauseMedallionButton
                }
                .padding(.leading, hudLead)
                .padding(.trailing, hudTrail)
                .padding(.top, hudTop)

                HudRow2StatusOverlayView(vm: vm, telemetry: vm.telemetry)
                    .allowsHitTesting(false)
                Spacer()
            }

            VStack {
                Spacer()
                HStack(alignment: .bottom) {
                    SonarJoystickView(vm: vm, resetToken: joystickResetToken)
                        .padding(.leading, hudLead)
                        .padding(.bottom, cornerBottom)
                    Spacer(minLength: 6)
                    if vm.onboardingStep != .DONE {
                        onboardingBottomBanner
                            .padding(.bottom, centerBannerBottom)
                    }
                    Spacer(minLength: 6)
                    mobaSkillFan(rawSafeTrail: rawTrail)
                        .padding(.trailing, hudTrail)
                        .padding(.bottom, cornerBottom)
                }
            }
        } else if vm.gameState == "title" {
            titleScreenOverlay(geo: geo, hudLead: hudLead, hudTrail: hudTrail, hudTop: hudTop, rawBottom: rawBottom)
        }
    }

    @ViewBuilder
    private func modalAndAtlasLayer(geo: GeometryProxy) -> some View {
        if vm.gameState == "paused" {
            pauseModalOverlay(geo: geo)
        }
        if vm.gameState == "gameover" {
            gameOverModalOverlay(geo: geo)
        }
        if vm.showEvolutionAtlas {
            EvolutionAtlasSheetView(vm: vm)
                .transition(.opacity)
                .zIndex(50)
        }
    }

    @ViewBuilder
    private var systemAndStartupOverlayLayer: some View {
        if adManager.isConnectingAd {
            ZStack {
                Color.black.opacity(0.72).ignoresSafeArea()
                VStack(spacing: 14) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .yellow))
                        .scaleEffect(1.6)
                    Text(vm.lang == "zh" ? "正在连接 Google 激励视频广告..." : "Connecting to Google Video Ad...")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                    Text(vm.lang == "zh" ? "广告准备中，即将为您全屏播放" : "Preparing full-screen player...")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white.opacity(0.7))
                }
                .padding(24)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(red: 15.0 / 255.0, green: 23.0 / 255.0, blue: 42.0 / 255.0).opacity(0.96))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.yellow.opacity(0.7), lineWidth: 1.5))
                )
            }
            .zIndex(75)
            .transition(.opacity)
        }

        if let msg = vm.adUnavailableMessage {
            adUnavailableAlertModal(message: msg)
                .zIndex(85)
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
        }

        if !atlasManager.isReady {
            StartupLoadingView(vm: vm, atlasManager: atlasManager)
                .zIndex(200)
                .transition(.opacity)
        }
    }

    // MARK: - Title Screen Overlay
    private func titleScreenOverlay(
        geo: GeometryProxy,
        hudLead: CGFloat,
        hudTrail: CGFloat,
        hudTop: CGFloat,
        rawBottom: CGFloat
    ) -> some View {
        let showcase = vm.nextShowcaseSharkForm
        let showcaseName = vm.lang == "zh" ? showcase.nameZh : showcase.nameEn
        let screenBounds = UIScreen.main.bounds.size
        let fullW = max(geo.size.width, screenBounds.width)
        let fullH = max(geo.size.height, screenBounds.height)
        // Exact 1323x371 (3.566:1) aspect ratio box so SwiftUI never adds vertical centering dead space above the title
        let titleAspect: CGFloat = 1323.0 / 371.0
        let maxTitleH = fullH * 0.36
        let targetTitleW = min(760.0, min(fullW * 0.74, maxTitleH * titleAspect))
        let targetTitleH = targetTitleW / titleAspect
        let usableBtnSpan = max(520.0, fullW - hudLead - hudTrail - 24.0)
        let btnW = min(264.0, max(168.0, usableBtnSpan / 3.0))
        let btnH = max(50.0, min(68.0, btnW / 3.65))

        return ZStack {
            // Matching radial vignette from Web preview so white brush title pops against shallow water
            RadialGradient(
                gradient: Gradient(colors: [
                    Color(red: 2/255, green: 132/255, blue: 199/255).opacity(0.12),
                    Color(red: 2/255, green: 6/255, blue: 23/255).opacity(0.76)
                ]),
                center: UnitPoint(x: 0.5, y: 0.35),
                startRadius: 20,
                endRadius: max(fullW, fullH) * 0.7
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                // Upper Title Banner (Wide 3.57:1 horizontal banner title3_cae0290c.png, pinned flush to top)
                if let titleImg = SpriteAtlasManager.shared.titleLogoImage() {
                    Image(uiImage: titleImg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: targetTitleW, height: targetTitleH, alignment: .top)
                        .shadow(color: .black.opacity(0.9), radius: 16, x: 0, y: 6)
                        .padding(.top, max(2.0, hudTop - 4.0))
                } else {
                    Text(vm.t("game_title"))
                        .font(.system(size: min(40, max(26, geo.size.width * 0.05)), weight: .black))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, Color(red: 165/255, green: 243/255, blue: 252/255), Color.cyan],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .shadow(color: .black.opacity(0.85), radius: 8, x: 0, y: 3)
                        .padding(.top, max(6.0, hudTop))
                }

                Spacer(minLength: 0)

            // Bottom 3 Sliced Banner Buttons (UI_BAR_BTN_GREEN, UI_BAR_BTN_BLUE, UI_BAR_BTN_GOLD)
            HStack(spacing: 12) {
                // 1. Primary Green Start Button
                UiBannerButtonView(
                    bannerKey: "UI_BAR_BTN_GREEN",
                    title: vm.t("btn_start"),
                    subtitle: vm.lang == "zh" ? "立即潜入深海" : "START HUNTING",
                    width: btnW,
                    height: btnH,
                    leftContent: {
                        Text("▶")
                            .font(.system(size: btnH * 0.36, weight: .black))
                            .foregroundColor(.white)
                    },
                    action: {
                        vm.startNewRun()
                    }
                )

                // 2. Blue Evolution Atlas Button
                let evoReady = GameRules.getNextEvolutionTarget(save: vm.save)?.check.canUnlockNow ?? false
                UiBannerButtonView(
                    bannerKey: "UI_BAR_BTN_BLUE",
                    title: vm.lang == "zh"
                        ? "进化 (\(vm.save.unlockedSharkIds.count)/48)"
                        : "EVOLVE (\(vm.save.unlockedSharkIds.count)/48)",
                    subtitle: evoReady
                        ? (vm.lang == "zh" ? "✨ 可立即破茧进化！" : "✨ READY TO EVOLVE!")
                        : (vm.lang == "zh" ? "48阶图谱 · 点击打开" : "48-SHARK ATLAS"),
                    badgeText: "🪙\(vm.save.bankedCoins) · 🧬\(vm.save.bankedGenes)",
                    width: btnW,
                    height: btnH,
                    leftContent: {
                        SharkPreviewView(form: vm.activeSharkForm, width: btnH * 0.54, height: btnH * 0.38)
                    },
                    action: {
                        vm.playUiTick()
                        vm.showEvolutionAtlas = true
                    }
                )

                // 3. Gold Apex Trial Button
                UiBannerButtonView(
                    bannerKey: "UI_BAR_BTN_GOLD",
                    title: vm.lang == "zh" ? "试驾 · \(showcaseName)" : "TRIAL · \(showcaseName)",
                    subtitle: vm.lang == "zh" ? "📺 本局免费体验高阶巨兽" : "📺 FREE APEX SHARK TRIAL",
                    badgeText: "T\(showcase.baseBiteTier) · Lv.5",
                    width: btnW,
                    height: btnH,
                    leftContent: {
                        SharkPreviewView(form: showcase, width: btnH * 0.54, height: btnH * 0.38)
                    },
                    action: {
                        vm.showRewardedAd(kind: .TRIAL_SHARK)
                    }
                )
            }
            .padding(.leading, hudLead)
            .padding(.trailing, hudTrail)
            .padding(.bottom, max(14.0, rawBottom))
            }
        }
    }

    // MARK: - Top-Center Unified Telemetry Pill & Pause Medallion
    private func telemetryPill(isCompact: Bool) -> some View {
        let iconSz: CGFloat = isCompact ? 15 : 18
        let fontSz: CGFloat = isCompact ? 11 : 12.5
        let bountyPrey = vm.targetBountyPrey

        return HStack(spacing: isCompact ? 8 : 11) {
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_SCORE_TROPHY", size: iconSz)
                Text("\(vm.score)")
                    .foregroundColor(.white)
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_GENE", size: iconSz)
                Text("\(vm.save.bankedGenes)")
                    .foregroundColor(Color(red: 110/255, green: 231/255, blue: 183/255))
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_COIN", size: iconSz)
                Text("\(vm.save.bankedCoins)")
                    .foregroundColor(Color(red: 253/255, green: 224/255, blue: 71/255))
            }
            Text("·").foregroundColor(.gray.opacity(0.6))
            TelemetryDepthReadoutView(telemetry: vm.telemetry, iconSize: iconSz)
            Text("·").foregroundColor(.gray.opacity(0.6))
            // Target Bounty Fish
            HStack(spacing: 3) {
                if let pImg = SpriteAtlasManager.shared.preyUIImage(for: bountyPrey.spriteKey) {
                    Image(uiImage: pImg)
                        .resizable()
                        .scaledToFit()
                        .frame(width: iconSz * 1.2, height: iconSz)
                } else {
                    UiAtlasIconView(iconKey: "UI_ICON_BOUNTY_TARGET", size: iconSz)
                }
                Text("\(vm.targetBountyCaptured)/3")
                    .foregroundColor(Color(red: 253/255, green: 224/255, blue: 71/255))
            }
            // Golden Mutant Charge
            HStack(spacing: 2) {
                Text("✨\(vm.goldenMutantCharge)/\(vm.goldenMutantNeed)")
                    .foregroundColor(.yellow)
            }
        }
        .font(.system(size: fontSz, weight: .black, design: .monospaced))
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.62))
                .overlay(Capsule().stroke(Color.white.opacity(0.16), lineWidth: 1))
        )
    }

    private var pauseMedallionButton: some View {
        Button {
            vm.pauseGame()
        } label: {
            ZStack {
                Circle()
                    .fill(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.62))
                    .frame(width: 40, height: 40)
                    .overlay(Circle().stroke(Color.white.opacity(0.22), lineWidth: 1))
                UiAtlasIconView(iconKey: "UI_ICON_PAUSE", size: 28)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Bottom-Center Compact Onboarding Guide Pill (Never blocks the swimming shark!)
    private var onboardingBottomBanner: some View {
        HStack(spacing: 7) {
            if vm.onboardingStep == .EAT_SMALL_FISH {
                Text("🎯")
                    .font(.system(size: 11))
                Text(vm.t("onboard_step1_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.cyan)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text("(\(vm.onboardingEatCount)/3)")
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .foregroundColor(.yellow)
            } else if vm.onboardingStep == .HOLD_BOOST {
                Text("⚡")
                    .font(.system(size: 11))
                Text(vm.t("onboard_step2_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.yellow)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                OnboardingBoostProgressLabel(telemetry: vm.telemetry)
            } else if vm.onboardingStep == .HANDS_ON_UPGRADE {
                Text("💪")
                    .font(.system(size: 11))
                Text(vm.t("onboard_step3_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.mint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            } else if vm.onboardingStep == .CELEBRATE {
                Text("🎉")
                    .font(.system(size: 11))
                Text(vm.t("onboard_done_title"))
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.yellow)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            if vm.onboardingStep != .CELEBRATE {
                Button {
                    vm.skipOnboardingTutorial()
                } label: {
                    Text(vm.t("onboard_skip"))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.white.opacity(0.18)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color(red: 2/255, green: 12/255, blue: 32/255).opacity(0.82))
                .overlay(Capsule().stroke(Color.cyan.opacity(0.5), lineWidth: 1))
        )
    }
}
