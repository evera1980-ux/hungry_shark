import SwiftUI
import SpriteKit

// MARK: - Hex Color Helper
extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: UInt64
        switch cleaned.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (56, 189, 248)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: 1.0
        )
    }
}

// MARK: - 1. Reusable Sprite Atlas UI Components (1:1 parity with src/components/UiAtlasIcon.tsx)

public struct UiAtlasIconView: View {
    public let iconKey: String
    public var size: CGFloat = 28

    public var body: some View {
        if let img = SpriteAtlasManager.shared.uiIconImage(for: iconKey) {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            Circle()
                .fill(Color.cyan.opacity(0.35))
                .frame(width: size, height: size)
        }
    }
}

public struct SharkPreviewView: View {
    public let form: SharkFormConfig
    public var width: CGFloat = 120
    public var height: CGFloat = 68
    public var locked: Bool = false

    public var body: some View {
        if let img = SpriteAtlasManager.shared.sharkUIImage(for: form.spriteKey) {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: width, height: height)
                .brightness(locked ? -0.55 : 0.0)
                .saturation(locked ? 0.15 : 1.0)
                .opacity(locked ? 0.72 : 1.0)
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(hex: form.primaryColorHex).opacity(0.4))
                .frame(width: width, height: height)
        }
    }
}

/// Home & HUD Horizontal Banner Button (`buttons_16e3a0cf.png`: UI_BAR_BTN_GREEN / BLUE / GOLD)
public struct UiBannerButtonView<LeftContent: View>: View {
    public let bannerKey: String // "UI_BAR_BTN_GREEN", "UI_BAR_BTN_BLUE", "UI_BAR_BTN_GOLD"
    public let title: String
    public let subtitle: String?
    public let badgeText: String?
    public var width: CGFloat = 216
    public var height: CGFloat = 60
    public let leftContent: () -> LeftContent
    public let action: () -> Void

    public init(
        bannerKey: String,
        title: String,
        subtitle: String? = nil,
        badgeText: String? = nil,
        width: CGFloat = 216,
        height: CGFloat = 60,
        @ViewBuilder leftContent: @escaping () -> LeftContent,
        action: @escaping () -> Void
    ) {
        self.bannerKey = bannerKey
        self.title = title
        self.subtitle = subtitle
        self.badgeText = badgeText
        self.width = width
        self.height = height
        self.leftContent = leftContent
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                if let bgImg = SpriteAtlasManager.shared.uiBannerImage(for: bannerKey) {
                    Image(uiImage: bgImg)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFill()
                        .frame(width: width, height: height)
                } else {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color(red: 8/255, green: 32/255, blue: 62/255))
                        .frame(width: width, height: height)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.cyan, lineWidth: 2))
                }

                // Left Circular Medallion Window (centered at ~23.5% x, 50% y)
                leftContent()
                    .frame(width: height * 0.56, height: height * 0.56)
                    .clipShape(Circle())
                    .position(x: width * 0.235, y: height * 0.50)

                // Right Text Area (35.5% .. 93.5% x)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: max(11, height * 0.22), weight: .black))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.9), radius: 2, x: 0, y: 1)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    if let sub = subtitle {
                        Text(sub)
                            .font(.system(size: max(8, height * 0.145), weight: .heavy))
                            .foregroundColor(.white.opacity(0.92))
                            .shadow(color: .black.opacity(0.9), radius: 1, x: 0, y: 1)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }
                .frame(width: width * 0.58, alignment: .leading)
                .position(x: width * 0.645, y: height * 0.50)

                if let badge = badgeText {
                    Text(badge)
                        .font(.system(size: 9, weight: .black))
                        .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.88))
                                .overlay(Capsule().stroke(Color.yellow.opacity(0.65), lineWidth: 1))
                        )
                        .position(x: width * 0.86, y: 4)
                }
            }
            .frame(width: width, height: height)
        }
        .buttonStyle(.plain)
    }
}

/// Top-Left Frameless Avatar & Angled HP/Boost Bar (`buttons_16e3a0cf.png`: UI_PLATE_AVATAR_BAR)
public struct UiAvatarDataBarView: View {
    @ObservedObject var vm: GameViewModel
    public var height: CGFloat = 68

    public var body: some View {
        let metrics = SpriteAtlasManager.shared.avatarBarHollowMetrics
        let width = height * metrics.aspectRatio
        let holeCx = width * (metrics.cxPct / 100.0)
        let holeCy = height * (metrics.cyPct / 100.0)
        let innerD = height * (metrics.innerDiaPctH / 100.0)
        let outerD = height * (metrics.outerDiaPctH / 100.0)

        let hpPct = max(0.0, min(1.0, vm.hp / max(1.0, vm.maxHp)))
        let ghostPct = max(hpPct, min(1.0, vm.ghostHpPct / 100.0))
        let energyPct = max(0.0, min(1.0, vm.energy / max(1.0, vm.maxEnergy)))
        let xpPct = max(0.0, min(1.0, Double(vm.xp) / Double(max(1, vm.xpRequired))))
        let nextTarget = GameRules.getNextEvolutionTarget(save: vm.save)
        let evoReady = nextTarget?.check.canUnlockNow ?? false

        Button {
            vm.playUiTick()
            vm.showEvolutionAtlas = true
        } label: {
            ZStack(alignment: .topLeading) {
                // Layer 0: Deep Ocean Backdrop Disc inside the hollow ring
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color(red: 14/255, green: 116/255, blue: 144/255), Color(red: 2/255, green: 6/255, blue: 23/255)],
                            center: .center,
                            startRadius: 2,
                            endRadius: innerD * 0.55
                        )
                    )
                    .frame(width: innerD * 1.06, height: innerD * 1.06)
                    .position(x: holeCx, y: holeCy)

                // Layer 1: Shark Avatar Clipped to Hollow Ring
                SharkPreviewView(form: vm.activeSharkForm, width: innerD * 0.96, height: innerD * 0.68)
                    .frame(width: innerD * 1.04, height: innerD * 1.04)
                    .clipShape(Circle())
                    .position(x: holeCx, y: holeCy)

                // Layer 2: Sliced Metallic Plate Frame (UI_PLATE_AVATAR_BAR)
                if let plateImg = SpriteAtlasManager.shared.uiBannerImage(for: "UI_PLATE_AVATAR_BAR") {
                    Image(uiImage: plateImg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: width, height: height)
                }

                // Layer 2.5: Circular Purple XP Progress Ring around outer rim
                Circle()
                    .trim(from: 0, to: CGFloat(xpPct))
                    .stroke(
                        LinearGradient(
                            colors: [Color.purple, Color(red: 232/255, green: 121/255, blue: 249/255), Color.cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .frame(width: outerD * 1.08, height: outerD * 1.08)
                    .position(x: holeCx, y: holeCy)

                // Layer 3: Bottom-Left Bite Tier Shield Badge (UI_BADGE_TIER)
                ZStack {
                    UiAtlasIconView(iconKey: "UI_BADGE_TIER", size: outerD * 0.44)
                    Text("T\(vm.biteTier)")
                        .font(.system(size: max(8, outerD * 0.16), weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .shadow(color: .black, radius: 1.5)
                }
                .position(x: holeCx - outerD * 0.36, y: holeCy + outerD * 0.36)

                // Layer 3.1: Bottom-Right Level Pill (Lv.X)
                Text("Lv.\(vm.gameState == "playing" ? vm.inRunLevel : vm.activeUpgradeLevel)")
                    .font(.system(size: max(8, outerD * 0.16), weight: .black, design: .monospaced))
                    .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(
                        Capsule()
                            .fill(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.92))
                            .overlay(Capsule().stroke(Color.yellow.opacity(0.75), lineWidth: 1))
                    )
                    .position(x: holeCx + outerD * 0.34, y: holeCy + outerD * 0.38)

                // Layer 3.2: Top-Right Atlas Collection Progress Badge
                HStack(spacing: 2) {
                    Text(evoReady ? "🧬" : "📖")
                        .font(.system(size: 8))
                    Text("\(vm.save.unlockedSharkIds.count)/48")
                        .font(.system(size: 8, weight: .black, design: .monospaced))
                        .foregroundColor(evoReady ? Color(red: 167/255, green: 243/255, blue: 208/255) : Color.cyan)
                }
                .padding(.horizontal, 5)
                .padding(.vertical, 1.5)
                .background(
                    Capsule()
                        .fill(evoReady ? Color.green.opacity(0.85) : Color.black.opacity(0.88))
                        .overlay(Capsule().stroke(evoReady ? Color.mint : Color.cyan.opacity(0.55), lineWidth: 1))
                )
                .position(x: width * 0.82, y: height * 0.18)

                // Layer 4: Right-Side Skewed HP Bar + Energy Bar (left: 39.5%, right: 6.5%, top: 30%, bottom: 30%)
                let barW = width * 0.54
                let barH = height * 0.40
                VStack(alignment: .leading, spacing: 3) {
                    // Skewed HP Bar with Ghost Decay
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(red: 2/255, green: 8/255, blue: 24/255).opacity(0.92))
                            .frame(width: barW, height: barH * 0.54)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.white.opacity(0.45))
                            .frame(width: barW * CGFloat(ghostPct), height: barH * 0.50)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(
                                LinearGradient(
                                    colors: vm.frenzyActive
                                        ? [.yellow, .orange, .red]
                                        : (hpPct < 0.28 ? [.red, .orange] : [Color(red: 22/255, green: 163/255, blue: 74/255), Color(red: 74/255, green: 222/255, blue: 128/255)]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: barW * CGFloat(hpPct), height: barH * 0.50)
                        HStack(spacing: 2) {
                            Text(
                                vm.frenzyActive
                                    ? (vm.lang == "zh" ? "🔥 狂暴" : "🔥 FRENZY")
                                    : (hpPct < 0.28 ? (vm.lang == "zh" ? "⚠️ 濒危" : "⚠️ LOW HP") : "HP")
                            )
                            .font(.system(size: 7.5, weight: .black))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                            Spacer(minLength: 2)
                            Text("\(Int(vm.hp))/\(Int(vm.maxHp))")
                                .font(.system(size: 7.5, weight: .black, design: .monospaced))
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 5)
                        .frame(width: barW)
                    }
                    // Skewed Boost Energy Bar
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(red: 2/255, green: 8/255, blue: 24/255).opacity(0.92))
                            .frame(width: barW, height: barH * 0.36)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(
                                LinearGradient(
                                    colors: [Color(red: 2/255, green: 132/255, blue: 199/255), Color.cyan],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: barW * CGFloat(energyPct), height: barH * 0.32)
                        HStack(spacing: 2) {
                            Text("⚡ \(vm.t("hud_mobile_boost"))")
                                .font(.system(size: 6.5, weight: .black))
                                .foregroundColor(.cyan)
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                            Spacer(minLength: 2)
                            Text("\(Int(energyPct * 100))%")
                                .font(.system(size: 6.5, weight: .black, design: .monospaced))
                                .foregroundColor(.white)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 5)
                        .frame(width: barW)
                    }
                }
                .position(x: width * 0.665, y: height * 0.52)
            }
            .frame(width: width, height: height)
        }
        .buttonStyle(.plain)
    }
}

/// Sci-Fi Octagonal Button from `setting_83a7a273.png` (with extracted icon & scanline-patched interior)
public struct UiSettingButtonView: View {
    public let variantKey: String
    public let label: String
    public var sublabel: String? = nil
    public var badgeText: String? = nil
    public var customIconText: String? = nil
    public var width: CGFloat = 148
    public var height: CGFloat = 46
    public var disabled: Bool = false
    public let action: () -> Void

    public var body: some View {
        Button {
            if !disabled { action() }
        } label: {
            ZStack {
                if let bg = SpriteAtlasManager.shared.uiSettingImage(for: variantKey) {
                    Image(uiImage: bg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: width, height: height)
                } else {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(red: 12/255, green: 34/255, blue: 68/255))
                        .frame(width: width, height: height)
                }

                // Left Icon Slot (left: 14%, width: 17%)
                Group {
                    if let custom = customIconText {
                        Text(custom)
                            .font(.system(size: height * 0.38))
                    } else if let iconImg = SpriteAtlasManager.shared.uiSettingIconImage(for: variantKey) {
                        Image(uiImage: iconImg)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: height * 0.52, height: height * 0.52)
                    }
                }
                .position(x: width * 0.225, y: height * 0.50)

                // Right Text Slot (left: 33%, right: 10%)
                VStack(spacing: 0) {
                    Text(label)
                        .font(.system(size: max(10, height * 0.25), weight: .black))
                        .foregroundColor(.white)
                        .shadow(color: .black, radius: 2, x: 0, y: 1)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let sub = sublabel {
                        Text(sub)
                            .font(.system(size: max(7.5, height * 0.17), weight: .bold))
                            .foregroundColor(Color.cyan.opacity(0.92))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }
                .frame(width: width * 0.56)
                .position(x: width * 0.61, y: height * 0.50)

                if let badge = badgeText {
                    Text(badge)
                        .font(.system(size: 8.5, weight: .black, design: .monospaced))
                        .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1.5)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.9))
                                .overlay(Capsule().stroke(Color.cyan.opacity(0.55), lineWidth: 1))
                        )
                        .position(x: width * 0.84, y: 3)
                }
            }
            .frame(width: width, height: height)
            .opacity(disabled ? 0.45 : 1.0)
        }
        .buttonStyle(.plain)
    }
}

/// 3-Slice Widened Horizontal Shark Summary Banner Card (`SETTING_SHARK_CARD` from `setting_83a7a273.png`)
public struct UiSettingSharkCardView<RightContent: View>: View {
    public let form: SharkFormConfig
    public var width: CGFloat = 390
    public var height: CGFloat = 68
    public let rightContent: () -> RightContent

    public init(
        form: SharkFormConfig,
        width: CGFloat = 390,
        height: CGFloat = 68,
        @ViewBuilder rightContent: @escaping () -> RightContent
    ) {
        self.form = form
        self.width = width
        self.height = height
        self.rightContent = rightContent
    }

    public var body: some View {
        ZStack {
            if let cardImg = SpriteAtlasManager.shared.uiSettingImage(for: "SETTING_SHARK_CARD") {
                Image(uiImage: cardImg)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: width, height: height)
            } else {
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color(red: 7/255, green: 24/255, blue: 52/255))
                    .frame(width: width, height: height)
            }

            // Left Circular Medallion Window (left: 4.8%, width: 12.8%, top: 10.5%, height: 79%)
            SharkPreviewView(form: form, width: height * 0.72, height: height * 0.50)
                .frame(width: height * 0.76, height: height * 0.76)
                .clipShape(Circle())
                .position(x: width * 0.112, y: height * 0.50)

            // Right Content Slot (left: 19.5%, right: 5.5%)
            rightContent()
                .frame(width: width * 0.74, height: height * 0.78)
                .position(x: width * 0.57, y: height * 0.50)
        }
        .frame(width: width, height: height)
    }
}

/// Sci-Fi Modal Frame (`SETTING_MODAL_FRAME` / `SETTING_MODAL_FRAME_CLEAN` from `setting_83a7a273.png`)
public struct UiSettingModalFrameView<Content: View>: View {
    public let title: String
    public var subtitle: String? = nil
    public var hideMedallion: Bool = false
    public var frameWidth: CGFloat = 500
    public var frameHeight: CGFloat = 335
    public let onClose: (() -> Void)?
    public let content: () -> Content

    public init(
        title: String,
        subtitle: String? = nil,
        hideMedallion: Bool = false,
        frameWidth: CGFloat = 500,
        frameHeight: CGFloat = 335,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.hideMedallion = hideMedallion
        self.frameWidth = frameWidth
        self.frameHeight = frameHeight
        self.onClose = onClose
        self.content = content
    }

    public var body: some View {
        let key = hideMedallion ? "SETTING_MODAL_FRAME_CLEAN" : "SETTING_MODAL_FRAME"
        ZStack {
            // Inner frosted dark ocean backdrop
            RoundedRectangle(cornerRadius: 20)
                .fill(
                    LinearGradient(
                        colors: [Color(red: 4/255, green: 20/255, blue: 46/255).opacity(0.95), Color(red: 2/255, green: 8/255, blue: 24/255).opacity(0.98)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: frameWidth * 0.80, height: frameHeight * 0.72)
                .position(x: frameWidth * 0.50, y: frameHeight * 0.545)

            // Sliced Sci-Fi Metallic Frame Overlay
            if let frameImg = SpriteAtlasManager.shared.uiSettingImage(for: key)
                ?? SpriteAtlasManager.shared.uiSettingImage(for: "SETTING_MODAL_FRAME") {
                Image(uiImage: frameImg)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: frameWidth, height: frameHeight)
                    .allowsHitTesting(false)
            }

            // Top Header Title Slot
            VStack(spacing: 1) {
                Text(title)
                    .font(.system(size: max(13, frameHeight * 0.048), weight: .black))
                    .foregroundColor(.white)
                    .shadow(color: .black, radius: 3, x: 0, y: 1)
                if let sub = subtitle {
                    Text(sub)
                        .font(.system(size: max(8.5, frameHeight * 0.028), weight: .bold))
                        .foregroundColor(.cyan.opacity(0.88))
                }
            }
            .position(x: hideMedallion ? frameWidth * 0.50 : frameWidth * 0.56, y: frameHeight * 0.118)

            // Top-Right Red X Close Hotspot (right: 3.4%, top: 4.8%, width: 8.6%, height: 13.0%)
            if let closeAction = onClose {
                Button(action: closeAction) {
                    Color.white.opacity(0.001)
                        .frame(width: frameWidth * 0.095, height: frameHeight * 0.135)
                }
                .position(x: frameWidth * 0.923, y: frameHeight * 0.113)
            }

            // Inner Window Content Slot (left: 11.5%, right: 11.5%, top: 20.5%, bottom: 11.5%)
            content()
                .frame(width: frameWidth * 0.77, height: frameHeight * 0.68)
                .position(x: frameWidth * 0.50, y: frameHeight * 0.545)
        }
        .frame(width: frameWidth, height: frameHeight)
    }
}

// MARK: - 2. Main ContentView (Title, Playing HUD, Sonar Joystick, MOBA Fan, Pause & GameOver)

public struct ContentView: View {
    @StateObject private var vm = GameViewModel()
    @State private var scene: OceanGameScene = {
        let s = OceanGameScene(size: CGSize(width: 844, height: 390))
        s.scaleMode = .resizeFill
        return s
    }()
    @State private var knobOffset: CGSize = .zero

    public init() {}

    public var body: some View {
        GeometryReader { geo in
            let isCompactH = geo.size.height < 430
            ZStack {
                // 1. Native Metal-Accelerated SpriteKit Ocean Canvas (Zero WebView!)
                SpriteView(scene: scene, preferredFramesPerSecond: 120)
                    .ignoresSafeArea()
                    .onAppear {
                        scene.viewModel = vm
                        scene.refreshSharkTexture()
                    }
                    .onChange(of: vm.save.selectedSharkId) { _ in
                        scene.refreshSharkTexture()
                    }
                    .onChange(of: vm.trialSharkIdForRun) { _ in
                        scene.refreshSharkTexture()
                    }

                // 2. Top HUD Bar (Row 1: Frameless Avatar Bar + Telemetry Pill + Pause Button; Row 2: Compact Combo / Frenzy Pills)
                VStack(spacing: 3) {
                    HStack(alignment: .top, spacing: 8) {
                        UiAvatarDataBarView(vm: vm, height: isCompactH ? 56 : 64)
                        Spacer(minLength: 4)
                        if vm.gameState == "playing" {
                            telemetryPill(isCompact: isCompactH)
                            Spacer(minLength: 4)
                            pauseMedallionButton
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 6)

                    if vm.gameState == "playing" {
                        hudRow2Overlays
                            .allowsHitTesting(false)
                    }
                    Spacer()
                }

                // 3. Title Screen Hero & Bottom 3 Sliced Banner Buttons (UI_BAR_BTN_GREEN / BLUE / GOLD)
                if vm.gameState == "title" {
                    titleScreenOverlay(geo: geo)
                }

                // 4. In-Game Multi-Touch Sonar Joystick (Bottom-Left) + Onboarding Guide (Bottom-Center) + 90° MOBA Skill Fan (Bottom-Right)
                if vm.gameState == "playing" {
                    VStack {
                        Spacer()
                        HStack(alignment: .bottom) {
                            sonarJoystick
                                .padding(.leading, 26)
                                .padding(.bottom, 18)
                            Spacer(minLength: 6)
                            if vm.onboardingStep != .DONE {
                                onboardingBottomBanner
                                    .padding(.bottom, 14)
                            }
                            Spacer(minLength: 6)
                            mobaSkillFan
                                .padding(.trailing, 22)
                                .padding(.bottom, 16)
                        }
                    }
                }

                // 5. Pause Modal (1:1 setting_83a7a273.png replication)
                if vm.gameState == "paused" {
                    pauseModalOverlay(geo: geo)
                }

                // 6. Game Over Revive & Settlement Modal (1:1 setting_83a7a273.png replication)
                if vm.gameState == "gameover" {
                    gameOverModalOverlay(geo: geo)
                }

                // 7. Full-Screen 48-Shark Evolution Atlas Modal
                if vm.showEvolutionAtlas {
                    EvolutionAtlasSheetView(vm: vm)
                        .transition(.opacity)
                        .zIndex(50)
                }

                // 8. 3-Second Simulated Rewarded Video Ad Overlay
                if let ad = vm.simAd {
                    simulatedRewardedAdModal(ad: ad)
                        .zIndex(80)
                }
            }
        }
        .statusBarHidden(true)
    }

    // MARK: - Title Screen Overlay
    private func titleScreenOverlay(geo: GeometryProxy) -> some View {
        let showcase = vm.nextShowcaseSharkForm
        let showcaseName = vm.lang == "zh" ? showcase.nameZh : showcase.nameEn
        let btnW = min(226.0, max(168.0, (geo.size.width - 56.0) / 3.0))
        let btnH = max(50.0, btnW / 3.6)

        return VStack {
            // Upper Title Banner
            VStack(spacing: 4) {
                Text(vm.t("game_title"))
                    .font(.system(size: min(34, max(22, geo.size.width * 0.042)), weight: .black))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, Color(red: 165/255, green: 243/255, blue: 252/255), Color.cyan],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: .black.opacity(0.85), radius: 8, x: 0, y: 3)
                Text(vm.t("title_sub_short"))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(red: 224/255, green: 242/255, blue: 254/255).opacity(0.92))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color(red: 2/255, green: 12/255, blue: 32/255).opacity(0.55))
                            .overlay(Capsule().stroke(Color.cyan.opacity(0.35), lineWidth: 1))
                    )
            }
            .padding(.top, max(54, geo.size.height * 0.14))

            Spacer()

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
                        vm.openSimulatedRewardedAd(kind: .TRIAL_SHARK)
                    }
                )
            }
            .padding(.bottom, 18)
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
            HStack(spacing: 3) {
                UiAtlasIconView(iconKey: "UI_ICON_DEPTH", size: iconSz)
                Text("\(vm.depthMeters)m")
                    .foregroundColor(vm.depthMeters >= 1150 ? .pink : (vm.depthMeters >= 520 ? .purple : .cyan))
            }
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

    // MARK: - HUD Row 2 (Compact Combo & Frenzy Pills docked right under Top Telemetry Bar)
    private var hudRow2Overlays: some View {
        HStack(spacing: 8) {
            if vm.comboCount > 1 {
                let comboText = vm.t(
                    "hud_combo",
                    [
                        "count": "\(vm.comboCount)",
                        "mult": String(format: "%.1f", vm.huntingHeatBuff.scoreMultiplier)
                    ]
                )
                HStack(spacing: 4) {
                    UiAtlasIconView(iconKey: "UI_ICON_COMBO_FIRE", size: 15)
                    Text(comboText)
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.white)
                    if vm.huntingHeatBuff.heatLevel > 0 {
                        Text("· \(vm.t(vm.huntingHeatBuff.labelKey)) ⚡+\(Int((vm.huntingHeatBuff.speedMultiplier - 1.0) * 100))%")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundColor(.yellow)
                    }
                }
                .padding(.horizontal, 9)
                .padding(.vertical, 2.5)
                .background(
                    Capsule()
                        .fill(LinearGradient(colors: [.orange.opacity(0.84), .red.opacity(0.84)], startPoint: .leading, endPoint: .trailing))
                        .overlay(Capsule().stroke(Color.yellow.opacity(0.85), lineWidth: 1))
                )
            }

            if vm.frenzyActive {
                Text("🔥 \(vm.t("hud_frenzy")) · \(String(format: "%.1fs", vm.frenzyTimer))")
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.yellow)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 2.5)
                    .background(
                        Capsule()
                            .fill(Color.red.opacity(0.84))
                            .overlay(Capsule().stroke(Color.yellow, lineWidth: 1))
                    )
            }
        }
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
                Text(String(format: "(%.1f/1.2s)", vm.onboardingBoostSeconds))
                    .font(.system(size: 10, weight: .black, design: .monospaced))
                    .foregroundColor(.white)
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

    // MARK: - Bottom-Left Sonar Virtual Joystick (using UI_JOYSTICK_BASE & UI_JOYSTICK_KNOB from icons_f5128c12.png)
    private var sonarJoystick: some View {
        ZStack {
            // Outer Sonar Base Ring from icons_f5128c12.png
            UiAtlasIconView(iconKey: "UI_JOYSTICK_BASE", size: 118)
                .opacity(vm.joyActive ? 0.96 : 0.78)

            // Crosshair subtle ticks
            Circle()
                .stroke(Color.cyan.opacity(vm.joyActive ? 0.45 : 0.18), lineWidth: 1)
                .frame(width: 82, height: 82)

            // Draggable Inner Sonar Core Knob from icons_f5128c12.png
            UiAtlasIconView(iconKey: "UI_JOYSTICK_KNOB", size: 58)
                .shadow(color: .cyan.opacity(vm.joyActive ? 0.85 : 0.35), radius: 8)
                .offset(knobOffset)
        }
        .frame(width: 124, height: 124)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    let maxR: CGFloat = 42
                    let dx = value.translation.width
                    let dy = value.translation.height
                    let dist = max(0.001, hypot(dx, dy))
                    let clampedDist = min(maxR, dist)
                    let nx = dx / dist
                    let ny = dy / dist
                    knobOffset = CGSize(width: nx * clampedDist, height: ny * clampedDist)
                    vm.joyDx = nx * (clampedDist / maxR)
                    vm.joyDy = ny * (clampedDist / maxR)
                    vm.joyActive = true
                }
                .onEnded { _ in
                    knobOffset = .zero
                    vm.joyDx = 0
                    vm.joyDy = 0
                    vm.joyActive = false
                }
        )
    }

    // MARK: - Bottom-Right 90° MOBA Skill Fan (using UI_BTN_* from icons_f5128c12.png)
    private var mobaSkillFan: some View {
        let form = vm.activeSharkForm
        let goldCost = GameRules.getGoldOverdriveCost(useCount: vm.goldOverdriveUseCount, generationRow: form.row)
        let geneCost = GameRules.getGeneSurgeCost(level: vm.inRunLevel, useCount: vm.geneSurgeUseCount, generationRow: form.row)
        let upCoinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: vm.activeUpgradeLevel)
        let upGeneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: vm.activeUpgradeLevel)
        let canGold = vm.save.bankedCoins >= goldCost && !vm.frenzyActive
        let canGene = vm.save.bankedGenes >= geneCost
        let canUpgrade = vm.activeUpgradeLevel < 10 && vm.save.bankedCoins >= upCoinCost && vm.save.bankedGenes >= upGeneCost
        let nextTarget = GameRules.getNextEvolutionTarget(save: vm.save)
        let evoReady = nextTarget?.check.canUnlockNow ?? false
        let energyPct = max(0.0, min(1.0, vm.energy / max(1.0, vm.maxEnergy)))

        return ZStack(alignment: .bottomTrailing) {
            // Optional Outer-Top Slot: Evolve Now (when next shark is ready to unlock) or Emergency Supply Drop
            if evoReady, let target = nextTarget {
                skillFanSatelliteButton(
                    iconKey: "UI_BTN_MORPH_EVOLVE",
                    label: vm.lang == "zh" ? "破茧进化" : "EVOLVE",
                    costText: vm.lang == "zh" ? target.form.nameZh : target.form.nameEn,
                    ringColor: .green,
                    enabled: true,
                    pulse: true
                ) {
                    vm.evolveToNextReadySharkInRun()
                }
                .offset(x: -74, y: -116)
            } else if !canGold && !canGene && !canUpgrade {
                skillFanSatelliteButton(
                    iconKey: "UI_ICON_GIFT",
                    label: vm.lang == "zh" ? "免费空投" : "AIRDROP",
                    costText: "📺+300🪙+25🧬",
                    ringColor: .yellow,
                    enabled: true,
                    pulse: true
                ) {
                    vm.openSimulatedRewardedAd(kind: .SUPPLY_DROP)
                }
                .offset(x: -74, y: -116)
            }

            // 1. 0° Left Slot: Gold Frenzy (UI_BTN_GOLD_FRENZY)
            skillFanSatelliteButton(
                iconKey: "UI_BTN_GOLD_FRENZY",
                label: vm.lang == "zh" ? "狂暴" : "FRENZY",
                costText: "🪙\(goldCost)",
                ringColor: .yellow,
                enabled: canGold,
                pulse: false
            ) {
                vm.triggerGoldFrenzy()
            }
            .offset(x: -98, y: -4)

            // 2. 45° Diagonal Slot: Gene Surge (UI_BTN_GENE_SURGE)
            skillFanSatelliteButton(
                iconKey: "UI_BTN_GENE_SURGE",
                label: vm.lang == "zh" ? "突破" : "SURGE",
                costText: "🧬\(geneCost)",
                ringColor: .mint,
                enabled: canGene,
                pulse: false
            ) {
                vm.triggerGeneSurge()
            }
            .offset(x: -70, y: -70)

            // 3. 90° Top Slot: Body Upgrade (UI_BTN_BODY_UPGRADE)
            skillFanSatelliteButton(
                iconKey: "UI_BTN_BODY_UPGRADE",
                label: vm.activeUpgradeLevel >= 10
                    ? "MAX"
                    : (vm.lang == "zh" ? "强化Lv.\(vm.activeUpgradeLevel)" : "UP Lv.\(vm.activeUpgradeLevel)"),
                costText: vm.activeUpgradeLevel >= 10
                    ? "Lv.10"
                    : (upGeneCost > 0 ? "🪙\(upCoinCost) 🧬\(upGeneCost)" : "🪙\(upCoinCost)"),
                ringColor: .cyan,
                enabled: canUpgrade,
                pulse: vm.onboardingStep == .HANDS_ON_UPGRADE
            ) {
                vm.upgradeActiveSharkBody()
            }
            .offset(x: -4, y: -98)

            // 4. Primary Bottom-Right Anchor: Hold-to-Boost Medallion (UI_BTN_BOOST + Circular Energy Ring)
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: vm.isBoostingHeld
                                ? [Color.cyan.opacity(0.65), Color.blue.opacity(0.92)]
                                : [Color(red: 12/255, green: 34/255, blue: 68/255).opacity(0.88), Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.95)],
                            center: .center,
                            startRadius: 4,
                            endRadius: 42
                        )
                    )
                    .frame(width: 82, height: 82)

                // Circular Energy Ring
                Circle()
                    .stroke(Color.white.opacity(0.14), lineWidth: 4)
                    .frame(width: 76, height: 76)
                Circle()
                    .trim(from: 0, to: CGFloat(energyPct))
                    .stroke(
                        vm.frenzyActive ? Color.yellow : Color.cyan,
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .frame(width: 76, height: 76)

                UiAtlasIconView(iconKey: "UI_BTN_BOOST", size: 62)
                    .scaleEffect(vm.isBoostingHeld ? 0.92 : 1.0)

                VStack {
                    Spacer()
                    Text(vm.t("hud_mobile_boost"))
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.black.opacity(0.78)))
                }
                .frame(height: 84)
            }
            .frame(width: 84, height: 84)
            .contentShape(Circle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in vm.isBoostingHeld = true }
                    .onEnded { _ in vm.isBoostingHeld = false }
            )
        }
    }

    private func skillFanSatelliteButton(
        iconKey: String,
        label: String,
        costText: String,
        ringColor: Color,
        enabled: Bool,
        pulse: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            if enabled { action() }
        } label: {
            ZStack {
                Circle()
                    .fill(Color(red: 4/255, green: 14/255, blue: 34/255).opacity(0.9))
                    .frame(width: 52, height: 52)
                    .overlay(
                        Circle()
                            .stroke(enabled ? ringColor : Color.gray.opacity(0.35), lineWidth: pulse ? 3.0 : 2.0)
                    )
                    .shadow(color: enabled ? ringColor.opacity(0.55) : .clear, radius: pulse ? 10 : 5)

                UiAtlasIconView(iconKey: iconKey, size: 38)
                    .opacity(enabled ? 1.0 : 0.42)

                VStack {
                    Text(label)
                        .font(.system(size: 7.5, weight: .black))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 0.5)
                        .background(Capsule().fill(Color.black.opacity(0.82)))
                    Spacer()
                    Text(costText)
                        .font(.system(size: 8, weight: .black, design: .monospaced))
                        .foregroundColor(enabled ? Color(red: 254/255, green: 240/255, blue: 138/255) : .gray)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.9))
                                .overlay(Capsule().stroke(enabled ? ringColor.opacity(0.6) : Color.clear, lineWidth: 0.8))
                        )
                }
                .frame(height: 58)
            }
            .frame(width: 56, height: 58)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Pause Modal Overlay (100% replication ofPauseModal in src/App.tsx using setting_83a7a273.png)
    private func pauseModalOverlay(geo: GeometryProxy) -> some View {
        let modalW = min(510.0, geo.size.width * 0.92)
        let modalH = min(345.0, max(285.0, geo.size.height * 0.88))
        let innerW = modalW * 0.77
        let form = vm.activeSharkForm

        return ZStack {
            Color.black.opacity(0.68)
                .ignoresSafeArea()
                .onTapGesture { vm.resumeGame() }

            UiSettingModalFrameView(
                title: vm.t("pause_title"),
                subtitle: "ABYSS TACTICAL COMMAND · 48-SHARK MATRIX",
                hideMedallion: false,
                frameWidth: modalW,
                frameHeight: modalH,
                onClose: { vm.resumeGame() }
            ) {
                VStack(spacing: 8) {
                    // 1. Active Shark Summary Card (SETTING_SHARK_CARD)
                    UiSettingSharkCardView(form: form, width: innerW, height: modalH * 0.25) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 5) {
                                    Text(vm.lang == "zh" ? form.nameZh : form.nameEn)
                                        .font(.system(size: 13, weight: .black))
                                        .foregroundColor(.white)
                                    Text("Lv.\(vm.activeUpgradeLevel)/10")
                                        .font(.system(size: 9.5, weight: .black, design: .monospaced))
                                        .foregroundColor(.cyan)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Capsule().fill(Color.black.opacity(0.6)))
                                }
                                Text("T\(vm.biteTier) · ❤️\(Int(vm.hp))/\(Int(vm.maxHp)) · 🪙\(vm.save.bankedCoins) · 🧬\(vm.save.bankedGenes)")
                                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.85))
                            }
                            Spacer()
                            Button {
                                vm.playUiTick()
                                vm.showEvolutionAtlas = true
                            } label: {
                                Text(vm.lang == "zh" ? "🧬 进化图谱" : "🧬 ATLAS")
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 5)
                                    .background(
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color.cyan.opacity(0.35))
                                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.cyan, lineWidth: 1))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // 2. 4-Column Stat Pills
                    HStack(spacing: 6) {
                        pauseStatPill(label: vm.t("hud_score"), val: "\(vm.score)", color: .yellow)
                        pauseStatPill(label: vm.lang == "zh" ? "最高等级" : "BEST LV", val: "Lv.\(vm.save.bestInRunLevel)", color: .cyan)
                        pauseStatPill(label: vm.lang == "zh" ? "最大深度" : "MAX DEPTH", val: "\(Int(vm.save.maxDepthReached))m", color: .purple)
                        pauseStatPill(label: vm.lang == "zh" ? "图谱收集" : "ATLAS", val: "\(vm.save.unlockedSharkIds.count)/48", color: .mint)
                    }
                    .frame(width: innerW)

                    // 3. 3-Column Utility Toggle Row (Language, Sound, Tutorial)
                    let thirdW = (innerW - 12) / 3.0
                    let btnH = max(36.0, modalH * 0.125)
                    HStack(spacing: 6) {
                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_LANG",
                            label: vm.lang == "zh" ? "语言: 中文" : "LANG: EN",
                            sublabel: vm.lang == "zh" ? "点击切换 EN" : "Tap for 中文",
                            width: thirdW,
                            height: btnH
                        ) {
                            vm.toggleLanguage()
                        }

                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_SOUND",
                            label: vm.save.soundEnabled
                                ? (vm.lang == "zh" ? "音效: 开启" : "SFX: ON")
                                : (vm.lang == "zh" ? "音效: 静音" : "SFX: MUTE"),
                            sublabel: vm.lang == "zh" ? "深海声呐反馈" : "Sonar Audio",
                            width: thirdW,
                            height: btnH
                        ) {
                            vm.toggleMute()
                        }

                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_TUTORIAL",
                            label: vm.lang == "zh" ? "重播新手引导" : "TUTORIAL",
                            sublabel: vm.lang == "zh" ? "3步交互教学" : "3-Step Guide",
                            width: thirdW,
                            height: btnH
                        ) {
                            vm.restartOnboardingTutorial()
                        }
                    }

                    // 4. 2-Column Primary Action Row (Resume Hunting & Main Menu)
                    let halfW = (innerW - 8) / 2.0
                    HStack(spacing: 8) {
                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_RESTART",
                            label: vm.t("btn_resume"),
                            sublabel: vm.lang == "zh" ? "返回深海战场" : "Back to Ocean",
                            width: halfW,
                            height: btnH * 1.08
                        ) {
                            vm.resumeGame()
                        }

                        UiSettingButtonView(
                            variantKey: "SETTING_BTN_MAIN_MENU",
                            label: vm.t("btn_quit"),
                            sublabel: vm.lang == "zh" ? "保存金币与基因" : "Save Progress",
                            width: halfW,
                            height: btnH * 1.08
                        ) {
                            vm.returnToTitle()
                        }
                    }
                }
            }
        }
    }

    private func pauseStatPill(label: String, val: String, color: Color) -> some View {
        VStack(spacing: 1) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.gray)
                .lineLimit(1)
            Text(val)
                .font(.system(size: 11, weight: .black, design: .monospaced))
                .foregroundColor(color)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.black.opacity(0.45))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.cyan.opacity(0.22), lineWidth: 1))
        )
    }

    // MARK: - GameOver Revive & Settlement Modal Overlay
    private func gameOverModalOverlay(geo: GeometryProxy) -> some View {
        let modalW = min(520.0, geo.size.width * 0.92)
        let modalH = min(355.0, max(295.0, geo.size.height * 0.90))
        let innerW = modalW * 0.77
        let form = vm.activeSharkForm
        let btnH = max(38.0, modalH * 0.13)

        return ZStack {
            Color.black.opacity(0.72).ignoresSafeArea()

            if vm.reviveOffered {
                UiSettingModalFrameView(
                    title: vm.t("revive_title"),
                    subtitle: "EMERGENCY RESCUE SIGNAL · 1 CHANCE PER RUN",
                    hideMedallion: true,
                    frameWidth: modalW,
                    frameHeight: modalH,
                    onClose: { vm.declineRevive() }
                ) {
                    VStack(spacing: 10) {
                        UiSettingSharkCardView(form: form, width: innerW, height: modalH * 0.27) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(vm.lang == "zh" ? "\(form.nameZh) 生命耗尽！" : "\(form.nameEn) Critical!")
                                    .font(.system(size: 13, weight: .black))
                                    .foregroundColor(.yellow)
                                Text(vm.t("revive_desc"))
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.9))
                                    .lineLimit(2)
                            }
                        }

                        HStack(spacing: 8) {
                            pauseStatPill(label: vm.t("hud_score"), val: "\(vm.score)", color: .yellow)
                            pauseStatPill(label: vm.t("stat_max_depth"), val: "\(vm.runMaxDepth)m", color: .cyan)
                            pauseStatPill(label: vm.lang == "zh" ? "本局金币" : "COINS", val: "+\(vm.runCoinsEarned)", color: .orange)
                            pauseStatPill(label: vm.lang == "zh" ? "本局基因" : "GENES", val: "+\(vm.runGenesEarned)", color: .mint)
                        }
                        .frame(width: innerW)

                        let halfW = (innerW - 8) / 2.0
                        HStack(spacing: 8) {
                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_RESTART",
                                label: vm.lang == "zh" ? "📺 免费满血复活" : "📺 FREE REVIVE",
                                sublabel: vm.lang == "zh" ? "满血 + 狂暴冲刺" : "Full HP + Frenzy",
                                customIconText: "📺",
                                width: halfW,
                                height: btnH * 1.12
                            ) {
                                vm.openSimulatedRewardedAd(kind: .REVIVE)
                            }

                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_MAIN_MENU",
                                label: vm.t("btn_decline_revive"),
                                sublabel: vm.lang == "zh" ? "进入战利品结算" : "Proceed to Summary",
                                width: halfW,
                                height: btnH * 1.12
                            ) {
                                vm.declineRevive()
                            }
                        }
                    }
                }
            } else {
                UiSettingModalFrameView(
                    title: vm.t("gameover_title"),
                    subtitle: vm.t("gameover_sub"),
                    hideMedallion: true,
                    frameWidth: modalW,
                    frameHeight: modalH,
                    onClose: { vm.returnToTitle() }
                ) {
                    VStack(spacing: 8) {
                        UiSettingSharkCardView(form: form, width: innerW, height: modalH * 0.25) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(vm.lang == "zh" ? form.nameZh : form.nameEn) · Lv.\(vm.inRunLevel)")
                                        .font(.system(size: 13, weight: .black))
                                        .foregroundColor(.white)
                                    Text("🪙 +\(vm.runCoinsEarned)   🧬 +\(vm.runGenesEarned)   👑 \(vm.save.sharkMasteryTiers[form.id] ?? 0)/3")
                                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                                        .foregroundColor(.yellow)
                                }
                                Spacer()
                                if let ms = vm.lastMasterySettlement, ms.isNewRecord {
                                    Text(vm.lang == "zh" ? "🏆 新纪录!" : "🏆 NEW BEST!")
                                        .font(.system(size: 10, weight: .black))
                                        .foregroundColor(.yellow)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 3)
                                        .background(Capsule().fill(Color.orange.opacity(0.35)))
                                }
                            }
                        }

                        HStack(spacing: 6) {
                            pauseStatPill(label: vm.t("stat_final_score"), val: "\(vm.score)", color: .yellow)
                            pauseStatPill(label: vm.t("stat_survival"), val: "\(vm.runSurvivalSec)s", color: .white)
                            pauseStatPill(label: vm.t("stat_max_depth"), val: "\(vm.runMaxDepth)m", color: .cyan)
                            pauseStatPill(label: vm.t("stat_peak_combo"), val: "\(vm.runPeakCombo)x", color: .orange)
                        }
                        .frame(width: innerW)

                        let thirdW = (innerW - 12) / 3.0
                        HStack(spacing: 6) {
                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_SOUND",
                                label: vm.settlementDoubled
                                    ? (vm.lang == "zh" ? "✓ 已翻倍领取" : "✓ 2X CLAIMED")
                                    : (vm.lang == "zh" ? "📺 奖励×2倍" : "📺 2X BOUNTY"),
                                sublabel: "+🪙\(max(30, vm.runCoinsEarned)) +🧬\(max(5, vm.runGenesEarned))",
                                customIconText: "📺",
                                width: thirdW,
                                height: btnH,
                                disabled: vm.settlementDoubled
                            ) {
                                vm.openSimulatedRewardedAd(kind: .DOUBLE_SETTLEMENT)
                            }

                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_TUTORIAL",
                                label: vm.lang == "zh" ? "进化图谱" : "EVOLVE ATLAS",
                                sublabel: "\(vm.save.unlockedSharkIds.count)/48",
                                customIconText: "🧬",
                                width: thirdW,
                                height: btnH
                            ) {
                                vm.showEvolutionAtlas = true
                            }

                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_RESTART",
                                label: vm.t("btn_play_again"),
                                sublabel: vm.lang == "zh" ? "立即再次潜入" : "Dive Again",
                                width: thirdW,
                                height: btnH
                            ) {
                                vm.startNewRun()
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - 3-Second Simulated Rewarded Video Ad Modal
    private func simulatedRewardedAdModal(ad: SimRewardedAdState) -> some View {
        ZStack {
            Color.black.opacity(0.84).ignoresSafeArea()
            VStack(spacing: 14) {
                HStack {
                    Text(vm.lang == "zh" ? "📺 模拟激励视频广告" : "📺 SIMULATED REWARDED VIDEO")
                        .font(.system(size: 11, weight: .black, design: .monospaced))
                        .foregroundColor(.yellow)
                    Spacer()
                    Text(ad.secondsLeft > 0
                         ? (vm.lang == "zh" ? "\(ad.secondsLeft)秒后可领奖" : "Reward in \(ad.secondsLeft)s")
                         : (vm.lang == "zh" ? "✅ 播放完成" : "✅ COMPLETED"))
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(ad.secondsLeft > 0 ? .white : .green)
                }

                Text(ad.title)
                    .font(.system(size: 18, weight: .black))
                    .foregroundColor(.white)

                Text(ad.rewardDesc)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.cyan)
                    .multilineTextAlignment(.center)

                GeometryReader { barGeo in
                    let pct = CGFloat(3 - ad.secondsLeft) / 3.0
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.15))
                        Capsule()
                            .fill(LinearGradient(colors: [.yellow, .green], startPoint: .leading, endPoint: .trailing))
                            .frame(width: barGeo.size.width * pct)
                    }
                }
                .frame(height: 8)

                HStack(spacing: 12) {
                    Button {
                        vm.cancelSimulatedAd()
                    } label: {
                        Text(vm.lang == "zh" ? "关闭" : "CLOSE")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white.opacity(0.75))
                            .padding(.horizontal, 18)
                            .padding(.vertical, 9)
                            .background(Capsule().fill(Color.white.opacity(0.12)))
                    }
                    .buttonStyle(.plain)

                    Button {
                        vm.claimSimulatedAdReward()
                    } label: {
                        Text(ad.secondsLeft > 0
                             ? (vm.lang == "zh" ? "请等待 \(ad.secondsLeft)s..." : "Wait \(ad.secondsLeft)s...")
                             : (vm.lang == "zh" ? "🎁 立即领取奖励" : "🎁 CLAIM REWARD"))
                            .font(.system(size: 13, weight: .black))
                            .foregroundColor(.black)
                            .padding(.horizontal, 22)
                            .padding(.vertical, 9)
                            .background(
                                Capsule()
                                    .fill(ad.secondsLeft > 0 ? Color.gray : Color.yellow)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(ad.secondsLeft > 0)
                }
            }
            .padding(24)
            .frame(width: 380)
            .background(
                RoundedRectangle(cornerRadius: 22)
                    .fill(Color(red: 4/255, green: 14/255, blue: 34/255))
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.yellow.opacity(0.65), lineWidth: 2))
            )
        }
    }
}

// MARK: - 3. 48-Shark Evolution Atlas Modal (Silky-Smooth Continuous Rotary Wheel + Command Deck)

public struct EvolutionAtlasSheetView: View {
    @ObservedObject var vm: GameViewModel
    @State private var inspectedIndex: Int = 0
    @State private var wheelPosition: Double = 0.0
    @State private var dragBaseWheelPos: Double? = nil
    @State private var lastTickIndex: Int = 0

    private let wheelSlotOffsets: [Int] = [-4, -3, -2, -1, 0, 1, 2, 3, 4]

    private var inspectedForm: SharkFormConfig {
        let total = GameConfigGenerated.sharkForms.count
        let norm = ((inspectedIndex % total) + total) % total
        return GameConfigGenerated.sharkForms[norm]
    }

    private func snapWheel(to targetPosition: Double) {
        let total = GameConfigGenerated.sharkForms.count
        let snapped = targetPosition.rounded()
        let normIdx = ((Int(snapped) % total) + total) % total
        withAnimation(.interpolatingSpring(stiffness: 170, damping: 22)) {
            wheelPosition = snapped
            inspectedIndex = normIdx
        }
        if lastTickIndex != normIdx {
            lastTickIndex = normIdx
            vm.playUiTick()
        }
    }

    public var body: some View {
        let form = inspectedForm
        let check = GameRules.evaluateSharkUnlock(form: form, save: vm.save)
        let curLv = vm.save.sharkUpgradeLevels[form.id] ?? 1
        let stats = GameRules.computeEvolvedSharkStats(
            inRunLevel: 1,
            sharkFormId: form.id,
            upgradeLevel: curLv,
            frenzyActive: false,
            globalDifficultyMultiplier: 1.0,
            unlockedCount: vm.save.unlockedSharkIds.count
        )
        let masteryConfig = GameRules.getSharkMasteryConfig(form: form)
        let bestScore = vm.save.sharkBestScores[form.id] ?? 0
        let claimedTier = vm.save.sharkMasteryTiers[form.id] ?? 0
        let globalBonuses = GameRules.getGlobalAtlasBonuses(save: vm.save)
        let lineageMeta = GameConfigGenerated.lineageMeta[form.lineage]

        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            ZStack {
                // Deep-Sea Bioluminescent Backdrop
                LinearGradient(
                    colors: [
                        Color(red: 4/255, green: 21/255, blue: 48/255),
                        Color(red: 2/255, green: 10/255, blue: 26/255),
                        Color(red: 1/255, green: 4/255, blue: 13/255)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 0) {
                    // 1. Single-Line Header Bar
                    atlasHeaderBar(globalBonuses: globalBonuses)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.65))

                    Divider().background(Color.cyan.opacity(0.2))

                    // 2. Main Split Stage (Left/Top: Giant Aquarium + Continuous Rotary Wheel; Right/Bottom: De-Boxed Command Deck)
                    if isLandscape {
                        HStack(spacing: 0) {
                            aquariumAndArcDialStage(form: form, check: check, lineageMeta: lineageMeta, curLv: curLv)
                                .frame(width: geo.size.width * 0.50)
                            Divider().background(Color.cyan.opacity(0.18))
                            commandDeckPanel(
                                form: form,
                                check: check,
                                curLv: curLv,
                                stats: stats,
                                masteryConfig: masteryConfig,
                                bestScore: bestScore,
                                claimedTier: claimedTier
                            )
                            .frame(width: geo.size.width * 0.50)
                        }
                    } else {
                        VStack(spacing: 0) {
                            aquariumAndArcDialStage(form: form, check: check, lineageMeta: lineageMeta, curLv: curLv)
                                .frame(height: geo.size.height * 0.48)
                            Divider().background(Color.cyan.opacity(0.18))
                            commandDeckPanel(
                                form: form,
                                check: check,
                                curLv: curLv,
                                stats: stats,
                                masteryConfig: masteryConfig,
                                bestScore: bestScore,
                                claimedTier: claimedTier
                            )
                        }
                    }
                }
            }
        }
        .onAppear {
            inspectedIndex = vm.activeSharkForm.index
            wheelPosition = Double(vm.activeSharkForm.index)
            lastTickIndex = vm.activeSharkForm.index
        }
    }

    // MARK: - Header Bar
    private func atlasHeaderBar(globalBonuses: GlobalAtlasBonuses) -> some View {
        HStack(spacing: 10) {
            UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 28)
            Text(vm.lang == "zh" ? "进化 · 48阶鲨鱼基因图谱" : "EVOLUTION · 48-SHARK ATLAS")
                .font(.system(size: 15, weight: .black))
                .foregroundColor(.white)
                .lineLimit(1)

            Text("\(vm.save.unlockedSharkIds.count)/48")
                .font(.system(size: 11, weight: .black, design: .monospaced))
                .foregroundColor(.cyan)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(Capsule().fill(Color.cyan.opacity(0.16)))

            // Global Collection & Mastery Bonus Pills
            HStack(spacing: 6) {
                Text("❤️+\(Int(((globalBonuses.hpMultiplier - 1.0) * 100).rounded()))%")
                    .foregroundColor(.green)
                Text("⚡+\(Int((globalBonuses.speedBonus * 100).rounded()))%")
                    .foregroundColor(.cyan)
                Text("🪙+\(Int(((globalBonuses.rewardMultiplier - 1.0) * 100).rounded()))%")
                    .foregroundColor(.yellow)
                Text("👑\(globalBonuses.totalMasteryCrowns)/144")
                    .foregroundColor(.orange)
            }
            .font(.system(size: 10, weight: .black, design: .monospaced))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(Color.black.opacity(0.45)))

            Spacer()

            // Banked Coins & Genes
            HStack(spacing: 4) {
                UiAtlasIconView(iconKey: "UI_ICON_COIN", size: 16)
                Text("\(vm.save.bankedCoins)")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.yellow)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Capsule().fill(Color.black.opacity(0.55)))

            HStack(spacing: 4) {
                UiAtlasIconView(iconKey: "UI_ICON_GENE", size: 16)
                Text("\(vm.save.bankedGenes)")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.mint)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Capsule().fill(Color.black.opacity(0.55)))

            Button {
                vm.playUiTick()
                vm.showEvolutionAtlas = false
            } label: {
                Text("✕")
                    .font(.system(size: 14, weight: .black))
                    .foregroundColor(.white)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Color.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Left/Top: Giant Aquarium Spotlight + Silky-Smooth Continuous Rotary Wheel
    private func aquariumAndArcDialStage(
        form: SharkFormConfig,
        check: UnlockCheckResult,
        lineageMeta: SharkLineageMeta?,
        curLv: Int
    ) -> some View {
        let lineageIconKey: String = {
            switch form.lineage {
            case .APEX_BIO: return "UI_LINEAGE_APEX"
            case .CYBER_MECHA: return "UI_LINEAGE_MECHA"
            case .ELEMENTAL_CORE: return "UI_LINEAGE_ELEMENTAL"
            case .ELDER_ABYSS: return "UI_LINEAGE_ABYSS"
            }
        }()

        return VStack(spacing: 4) {
            // Top Stage Title & Lineage Badge
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        UiAtlasIconView(iconKey: lineageIconKey, size: 16)
                        Text(vm.lang == "zh" ? (lineageMeta?.nameZh ?? "") : (lineageMeta?.nameEn ?? ""))
                            .font(.system(size: 10, weight: .black))
                            .foregroundColor(Color(hex: lineageMeta?.themeColorHex ?? form.primaryColorHex))
                        Text("· GEN \(["I","II","III","IV","V","VI"][max(0, min(5, form.row))]) · #\(String(format: "%02d", form.index + 1))")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                    Text(vm.lang == "zh" ? form.nameZh : form.nameEn)
                        .font(.system(size: 20, weight: .black))
                        .foregroundColor(.white)
                    Text(vm.lang == "zh" ? form.titleZh : form.titleEn)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.cyan.opacity(0.85))
                }
                Spacer()
                if vm.save.selectedSharkId == form.id {
                    Text(vm.lang == "zh" ? "⚡ 当前出战" : "⚡ DEPLOYED")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.green)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.green.opacity(0.2)).overlay(Capsule().stroke(Color.green, lineWidth: 1)))
                } else if check.isUnlocked {
                    Text("Lv.\(curLv)/10")
                        .font(.system(size: 11, weight: .black, design: .monospaced))
                        .foregroundColor(.cyan)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.cyan.opacity(0.18)))
                } else if check.canUnlockNow {
                    Text(vm.lang == "zh" ? "✨ 可立即进化" : "✨ READY")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.yellow)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.yellow.opacity(0.22)).overlay(Capsule().stroke(Color.yellow, lineWidth: 1)))
                } else {
                    Text(vm.lang == "zh" ? "🔒 待解锁" : "🔒 LOCKED")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.black.opacity(0.5)))
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Spacer(minLength: 2)

            // Center Giant Shark Spotlight with Left / Right Step Arrows
            HStack {
                Button {
                    snapWheel(to: wheelPosition.rounded() - 1.0)
                } label: {
                    Text("◀")
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(.cyan)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.black.opacity(0.55)).overlay(Circle().stroke(Color.cyan.opacity(0.35), lineWidth: 1)))
                }
                .buttonStyle(.plain)

                Spacer()

                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color(hex: form.glowColorHex).opacity(0.32), .clear],
                                center: .center,
                                startRadius: 8,
                                endRadius: 110
                            )
                        )
                        .frame(width: 220, height: 120)

                    SharkPreviewView(form: form, width: 220, height: 118, locked: !check.isUnlocked && !check.canUnlockNow)
                        .shadow(color: Color(hex: form.glowColorHex).opacity(0.55), radius: 14)
                }

                Spacer()

                Button {
                    snapWheel(to: wheelPosition.rounded() + 1.0)
                } label: {
                    Text("▶")
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(.cyan)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.black.opacity(0.55)).overlay(Circle().stroke(Color.cyan.opacity(0.35), lineWidth: 1)))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)

            Spacer(minLength: 2)

            // Bottom Silky-Smooth Continuous Rotary Wheel (Fractional offsets + Drag Inertia + Spring Snapping)
            GeometryReader { dialGeo in
                let dialW = dialGeo.size.width
                let dialH = dialGeo.size.height
                let total = GameConfigGenerated.sharkForms.count
                let baseInt = Int(floor(wheelPosition))
                let frac = wheelPosition - Double(baseInt)

                ZStack {
                    // Glowing Outer & Inner Compass Rim Tracks
                    Path { path in
                        path.move(to: CGPoint(x: dialW * 0.04, y: dialH * 0.90))
                        path.addQuadCurve(
                            to: CGPoint(x: dialW * 0.96, y: dialH * 0.90),
                            control: CGPoint(x: dialW * 0.50, y: dialH * 0.02)
                        )
                    }
                    .stroke(Color.cyan.opacity(0.32), style: StrokeStyle(lineWidth: 1.6, dash: [6, 4]))

                    // Top-Center Selection Pointer Triangle
                    Text("▼")
                        .font(.system(size: 9, weight: .black))
                        .foregroundColor(.cyan)
                        .position(x: dialW * 0.50, y: dialH * 0.08)

                    ForEach(wheelSlotOffsets, id: \.self) { k in
                        let rawIdx = baseInt + k
                        let itemIdx = ((rawIdx % total) + total) % total
                        let itemForm = GameConfigGenerated.sharkForms[itemIdx]
                        let itemUnlocked = vm.save.unlockedSharkIds.contains(itemForm.id)
                        let relOffset = Double(k) - frac
                        let absOff = abs(relOffset)

                        if absOff <= 3.65 {
                            let angleDeg = relOffset * 20.5
                            let angleRad = angleDeg * .pi / 180.0
                            let xPct = 0.50 + sin(angleRad) * 0.44
                            let yPct = 0.34 + (1.0 - cos(angleRad)) * 0.88
                            let scale = CGFloat(max(0.46, 1.15 - absOff * 0.19))
                            let opacity = max(0.18, 1.0 - max(0.0, absOff - 2.3) * 0.65)
                            let isCenter = absOff < 0.45

                            Button {
                                snapWheel(to: Double(rawIdx))
                            } label: {
                                VStack(spacing: 2) {
                                    ZStack {
                                        Circle()
                                            .fill(
                                                isCenter
                                                    ? Color(red: 8/255, green: 36/255, blue: 72/255).opacity(0.96)
                                                    : Color(red: 2/255, green: 10/255, blue: 28/255).opacity(0.86)
                                            )
                                            .frame(width: 54, height: 54)
                                            .overlay(
                                                Circle().stroke(
                                                    isCenter ? Color.cyan : (itemUnlocked ? Color.cyan.opacity(0.42) : Color.white.opacity(0.15)),
                                                    lineWidth: isCenter ? 2.4 : 1.0
                                                )
                                            )
                                            .shadow(color: isCenter ? Color.cyan.opacity(0.55) : .clear, radius: 8)
                                        SharkPreviewView(form: itemForm, width: 46, height: 28, locked: !itemUnlocked)
                                    }
                                    Text(vm.lang == "zh" ? itemForm.nameZh : itemForm.nameEn)
                                        .font(.system(size: 8.5, weight: .black))
                                        .foregroundColor(isCenter ? .white : .gray)
                                        .lineLimit(1)
                                }
                                .scaleEffect(scale)
                                .rotationEffect(.degrees(angleDeg * 0.42))
                                .opacity(opacity)
                            }
                            .buttonStyle(.plain)
                            .position(x: dialW * CGFloat(xPct), y: dialH * CGFloat(yPct))
                            .zIndex(10.0 - absOff)
                        }
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { val in
                            if dragBaseWheelPos == nil {
                                dragBaseWheelPos = wheelPosition
                            }
                            let startPos = dragBaseWheelPos ?? wheelPosition
                            let newPos = startPos - Double(val.translation.width) / 56.0
                            wheelPosition = newPos
                            let curIdx = ((Int(newPos.rounded()) % total) + total) % total
                            if curIdx != inspectedIndex {
                                inspectedIndex = curIdx
                            }
                            if curIdx != lastTickIndex {
                                lastTickIndex = curIdx
                                UISelectionFeedbackGenerator().selectionChanged()
                            }
                        }
                        .onEnded { val in
                            let startPos = dragBaseWheelPos ?? wheelPosition
                            dragBaseWheelPos = nil
                            let predictedPos = startPos - Double(val.predictedEndTranslation.width) / 56.0
                            let clampedTarget = max(wheelPosition - 6.0, min(wheelPosition + 6.0, predictedPos))
                            snapWheel(to: clampedTarget)
                        }
                )
            }
            .frame(height: 114)
            .padding(.bottom, 6)
        }
    }

    // MARK: - Right/Bottom: De-Boxed Command Deck (Trait + 4-Col Stat Strip + 3-Col Mastery Crowns + Gate/Reinforce + Actions)
    private func commandDeckPanel(
        form: SharkFormConfig,
        check: UnlockCheckResult,
        curLv: Int,
        stats: ComputedSharkStats,
        masteryConfig: SharkMasteryConfig,
        bestScore: Int,
        claimedTier: Int
    ) -> some View {
        let upCoinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: curLv)
        let upGeneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: curLv)
        let canUpgrade = check.isUnlocked && curLv < 10 && vm.save.bankedCoins >= upCoinCost && vm.save.bankedGenes >= upGeneCost

        return VStack(alignment: .leading, spacing: 8) {
            // 1. Special Ability Trait
            VStack(alignment: .leading, spacing: 2) {
                Text(vm.lang == "zh" ? "🧬 专属觉醒特性" : "🧬 AWAKENED TRAIT")
                    .font(.system(size: 9.5, weight: .black))
                    .foregroundColor(.cyan)
                Text(vm.lang == "zh" ? form.traitZh : form.traitEn)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(.white.opacity(0.92))
                    .lineLimit(2)
            }

            Divider().background(Color.white.opacity(0.1))

            // 2. 4-Column Stat Strip (Bite Tier, Max HP, Swim Speed, Boost Energy)
            HStack(spacing: 8) {
                deckStatItem(
                    label: vm.lang == "zh" ? "咬合阶位" : "BITE TIER",
                    value: "T\(stats.normalBiteTier)",
                    sub: "Max T\(min(8, form.baseBiteTier + 2))",
                    color: .yellow
                )
                deckStatItem(
                    label: vm.lang == "zh" ? "生命上限" : "MAX HP",
                    value: "\(Int(stats.maxHp.rounded()))",
                    sub: "-\(Int((form.hpDrainReduction * 100).rounded()))% Drain",
                    color: .green
                )
                deckStatItem(
                    label: vm.lang == "zh" ? "巡航速度" : "SPEED",
                    value: "\(Int(stats.moveSpeed.rounded()))",
                    sub: "Boost \(Int(stats.boostSpeed.rounded()))",
                    color: .cyan
                )
                deckStatItem(
                    label: vm.lang == "zh" ? "氮气能量" : "ENERGY",
                    value: "\(Int(stats.maxEnergy.rounded()))",
                    sub: "Mag +\(Int(form.magnetBonus))",
                    color: .purple
                )
            }

            Divider().background(Color.white.opacity(0.1))

            // 3. 3-Column Score Mastery Crown Track
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(vm.lang == "zh" ? "👑 单鲨积分专精悬赏" : "👑 SCORE MASTERY BOUNTY")
                        .font(.system(size: 9.5, weight: .black))
                        .foregroundColor(.yellow)
                    Spacer()
                    Text(vm.lang == "zh" ? "最高纪录: \(bestScore)" : "BEST: \(bestScore)")
                        .font(.system(size: 9.5, weight: .black, design: .monospaced))
                        .foregroundColor(.white.opacity(0.85))
                }
                HStack(spacing: 6) {
                    ForEach(masteryConfig.tiers, id: \.tier) { mTier in
                        let achieved = claimedTier >= mTier.tier || bestScore >= mTier.targetScore
                        let icon = mTier.tier == 1 ? "🥉" : (mTier.tier == 2 ? "🥈" : "🥇")
                        VStack(alignment: .leading, spacing: 1) {
                            HStack {
                                Text("\(icon) \(vm.lang == "zh" ? mTier.labelZh : mTier.labelEn)")
                                    .font(.system(size: 8.5, weight: .black))
                                    .foregroundColor(achieved ? .yellow : .white.opacity(0.75))
                                Spacer()
                                Text(achieved ? "✓" : "\(mTier.targetScore)")
                                    .font(.system(size: 8, weight: .black, design: .monospaced))
                                    .foregroundColor(achieved ? .green : .gray)
                            }
                            Text("+🪙\(mTier.rewardCoins) +🧬\(mTier.rewardGenes)")
                                .font(.system(size: 8, weight: .bold, design: .monospaced))
                                .foregroundColor(.cyan)
                        }
                        .padding(5)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: 7)
                                .fill(achieved ? Color.yellow.opacity(0.12) : Color.black.opacity(0.38))
                                .overlay(RoundedRectangle(cornerRadius: 7).stroke(achieved ? Color.yellow.opacity(0.45) : Color.white.opacity(0.08), lineWidth: 1))
                        )
                    }
                }
            }

            // 4. Unlock Prerequisite Gate OR 10-Segment Body Reinforcement Bar
            if check.isUnlocked {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(vm.lang == "zh" ? "🔧 躯体强化进度 (Lv.\(curLv)/10)" : "🔧 BODY REINFORCEMENT (Lv.\(curLv)/10)")
                            .font(.system(size: 9.5, weight: .black))
                            .foregroundColor(.cyan)
                        Spacer()
                        Text(vm.lang == "zh" ? "Lv.5 & Lv.10 突破咬合阶位 T+1" : "Lv.5 & Lv.10 Unlock Bite Tier +1")
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundColor(.yellow)
                    }
                    HStack(spacing: 4) {
                        ForEach(1...10, id: \.self) { seg in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(seg <= curLv ? (seg == 5 || seg == 10 ? Color.yellow : Color.cyan) : Color.white.opacity(0.12))
                                .frame(height: 7)
                        }
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    Text(vm.lang == "zh" ? "🔓 破茧进化前置条件" : "🔓 EVOLUTION PREREQUISITES")
                        .font(.system(size: 9.5, weight: .black))
                        .foregroundColor(.orange)
                    HStack(spacing: 8) {
                        if let parent = check.parentForm {
                            let pName = vm.lang == "zh" ? parent.nameZh : parent.nameEn
                            Text("\(check.parentLevelMet && check.parentUnlocked ? "✅" : "🔒") \(pName) Lv.\(check.parentUpgradeLevel)/\(check.reqParentUpgradeLevel)")
                                .font(.system(size: 9.5, weight: .bold))
                                .foregroundColor(check.parentLevelMet && check.parentUnlocked ? .green : .orange)
                        }
                        Text("\(check.depthMet ? "✅" : "🔒") \(vm.lang == "zh" ? "探索深度" : "Depth") \(Int(check.currentMaxDepth))m/\(Int(check.reqMaxDepth))m")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundColor(check.depthMet ? .green : .orange)
                    }
                }
            }

            Spacer(minLength: 2)

            // 5. Bottom Action Buttons
            HStack(spacing: 10) {
                if check.isUnlocked {
                    // Upgrade Body Button
                    Button {
                        _ = vm.upgradeSharkForm(form)
                    } label: {
                        HStack(spacing: 5) {
                            UiAtlasIconView(iconKey: "UI_BTN_BODY_UPGRADE", size: 20)
                            Text(curLv >= 10
                                 ? (vm.lang == "zh" ? "已满级 MAX" : "MAX LEVEL")
                                 : (upGeneCost > 0
                                    ? "\(vm.lang == "zh" ? "突破阶位" : "BREAKTHROUGH") 🪙\(upCoinCost) 🧬\(upGeneCost)"
                                    : "\(vm.lang == "zh" ? "强化躯体" : "UPGRADE") 🪙\(upCoinCost)"))
                                .font(.system(size: 11.5, weight: .black))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(canUpgrade ? Color.blue : Color.white.opacity(0.1))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(canUpgrade ? Color.cyan : Color.clear, lineWidth: 1.2))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!canUpgrade)

                    // Deploy / Active Button
                    let isSelected = vm.save.selectedSharkId == form.id
                    Button {
                        vm.selectSharkForm(form)
                    } label: {
                        Text(isSelected
                             ? (vm.lang == "zh" ? "✓ 当前出战中" : "✓ DEPLOYED")
                             : (vm.lang == "zh" ? "⚡ 出战该鲨鱼" : "⚡ DEPLOY SHARK"))
                            .font(.system(size: 11.5, weight: .black))
                            .foregroundColor(isSelected ? .green : .black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(isSelected ? Color.green.opacity(0.18) : Color.green)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.green, lineWidth: 1.2))
                            )
                    }
                    .buttonStyle(.plain)
                } else {
                    // Unlock / Evolve Button
                    Button {
                        _ = vm.unlockSharkForm(form)
                    } label: {
                        HStack(spacing: 6) {
                            UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 22)
                            Text("\(vm.lang == "zh" ? "立即破茧进化" : "EVOLVE NOW") (🪙\(form.unlockCoins) · 🧬\(form.unlockGenes))")
                                .font(.system(size: 12, weight: .black))
                                .foregroundColor(check.canUnlockNow ? .black : .white.opacity(0.5))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(check.canUnlockNow ? Color.green : Color.white.opacity(0.1))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(check.canUnlockNow ? Color.mint : Color.white.opacity(0.15), lineWidth: 1.2))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!check.canUnlockNow)

                    // Free Supply Drop Ad Button when short on Coins / Genes
                    if !check.coinsMet || !check.genesMet {
                        Button {
                            vm.openSimulatedRewardedAd(kind: .SUPPLY_DROP)
                        } label: {
                            Text(vm.lang == "zh" ? "📺 免费补给 (+300🪙+25🧬)" : "📺 FREE DROP (+300🪙+25🧬)")
                                .font(.system(size: 10.5, weight: .black))
                                .foregroundColor(.black)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Color.yellow))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func deckStatItem(label: String, value: String, sub: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 8.5, weight: .bold))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 14, weight: .black, design: .monospaced))
                .foregroundColor(color)
            Text(sub)
                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                .foregroundColor(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
