import SwiftUI

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
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared

    public var body: some View {
        let _ = atlasManager.atlasRevision
        if let img = atlasManager.uiIconImage(for: iconKey) {
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
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared

    public var body: some View {
        let _ = atlasManager.atlasRevision
        if let img = atlasManager.sharkUIImage(for: form.spriteKey) {
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

private struct BannerPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .brightness(configuration.isPressed ? 0.08 : 0.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Home & HUD Horizontal Banner Button (`buttons_16e3a0cf.png`: UI_BAR_BTN_GREEN / BLUE / GOLD)
public struct UiBannerButtonView<LeftContent: View>: View {
    public let bannerKey: String // "UI_BAR_BTN_GREEN", "UI_BAR_BTN_BLUE", "UI_BAR_BTN_GOLD"
    public let title: String
    public let subtitle: String?
    public let badgeText: String?
    public var width: CGFloat = 168
    public var height: CGFloat = 55
    public let leftContent: () -> LeftContent
    public let action: () -> Void
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared

    public init(
        bannerKey: String,
        title: String,
        subtitle: String? = nil,
        badgeText: String? = nil,
        width: CGFloat = 168,
        height: CGFloat = 55,
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
        let _ = atlasManager.atlasRevision
        let iconDiameter = height * 0.54
        let isGreen = bannerKey == "UI_BAR_BTN_GREEN"
        Button(action: action) {
            ZStack {
                // Opaque-alpha hit-catch base ensures taps register cleanly over SpriteView
                Color.black.opacity(0.001)

                if let bgImg = atlasManager.uiBannerImage(for: bannerKey) {
                    Image(uiImage: bgImg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: width, height: height)
                        .clipped()
                        .allowsHitTesting(false)
                } else {
                    RoundedRectangle(cornerRadius: height * 0.36)
                        .fill(Color(red: 8/255, green: 32/255, blue: 62/255))
                        .frame(width: width, height: height)
                        .overlay(RoundedRectangle(cornerRadius: height * 0.36).stroke(Color.cyan, lineWidth: 2))
                        .allowsHitTesting(false)
                }

                HStack(spacing: 0) {
                    Color.clear
                        .frame(width: width * 0.085, height: height)

                    leftContent()
                        .frame(width: iconDiameter, height: iconDiameter)
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(.system(size: max(10.5, min(14.5, height * 0.25)), weight: .black))
                            .foregroundColor(.white)
                            .shadow(color: .black.opacity(0.92), radius: 2, x: 0, y: 1)
                            .lineLimit(1)
                            .minimumScaleFactor(0.68)
                        if let sub = subtitle {
                            Text(sub)
                                .font(.system(size: max(7.5, min(10.0, height * 0.165)), weight: .heavy))
                                .foregroundColor(.white.opacity(0.92))
                                .shadow(color: .black.opacity(0.92), radius: 1.5, x: 0, y: 1)
                                .lineLimit(1)
                                .minimumScaleFactor(0.68)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, width * 0.055)
                    .padding(.trailing, isGreen ? width * 0.12 : width * 0.06)
                }
                .frame(width: width, height: height)
                .allowsHitTesting(false)
            }
            .frame(width: width, height: height)
            .contentShape(Rectangle())
            .overlay(alignment: .topTrailing) {
                if let badge = badgeText {
                    Text(badge)
                        .font(.system(size: 8.5, weight: .black, design: .monospaced))
                        .foregroundColor(Color(red: 254/255, green: 240/255, blue: 138/255))
                        .padding(.horizontal, 5.5)
                        .padding(.vertical, 1.5)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.88))
                                .overlay(Capsule().stroke(Color.yellow.opacity(0.65), lineWidth: 1))
                        )
                        .offset(x: -6, y: -7)
                        .allowsHitTesting(false)
                }
            }
        }
        .buttonStyle(BannerPressButtonStyle())
        .contentShape(Rectangle())
    }
}

/// Top-Left Frameless Avatar & Angled HP/Boost Bar (`buttons_16e3a0cf.png`: UI_PLATE_AVATAR_BAR)
public struct UiAvatarDataBarView: View {
    @ObservedObject var vm: GameViewModel
    @ObservedObject var telemetry: HudTelemetryStore
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared
    public var height: CGFloat = 68

    public init(vm: GameViewModel, height: CGFloat = 68) {
        self._vm = ObservedObject(wrappedValue: vm)
        self._telemetry = ObservedObject(wrappedValue: vm.telemetry)
        self.height = height
    }

    public var body: some View {
        let _ = atlasManager.atlasRevision
        let metrics = atlasManager.avatarBarHollowMetrics
        let width = height * metrics.aspectRatio
        let holeCx = width * (metrics.cxPct / 100.0)
        let holeCy = height * (metrics.cyPct / 100.0)
        let innerD = height * (metrics.innerDiaPctH / 100.0)
        let outerD = height * (metrics.outerDiaPctH / 100.0)

        let hpPct = max(0.0, min(1.0, telemetry.hp / max(1.0, telemetry.maxHp)))
        let ghostPct = max(hpPct, min(1.0, telemetry.ghostHpPct / 100.0))
        let energyPct = max(0.0, min(1.0, telemetry.energy / max(1.0, telemetry.maxEnergy)))
        let xpPct = max(0.0, min(1.0, Double(vm.xp) / Double(max(1, vm.xpRequired))))
        let nextTarget = GameRules.getNextEvolutionTarget(save: vm.save)
        let evoReady = nextTarget?.check.canUnlockNow ?? false

        Button {
            vm.playUiTick()
            vm.showEvolutionAtlas = true
        } label: {
            ZStack(alignment: .topLeading) {
                Color.black.opacity(0.001)
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
                if let plateImg = atlasManager.uiBannerImage(for: "UI_PLATE_AVATAR_BAR") {
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
                            Text("\(Int(telemetry.hp))/\(Int(telemetry.maxHp))")
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
            .contentShape(Rectangle())
            .allowsHitTesting(true)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
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
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared

    public var body: some View {
        let _ = atlasManager.atlasRevision
        Button {
            if !disabled { action() }
        } label: {
            ZStack {
                Color.black.opacity(0.001)
                if let bg = atlasManager.uiSettingImage(for: variantKey) {
                    Image(uiImage: bg)
                        .resizable()
                        .interpolation(.high)
                        .frame(width: width, height: height)
                        .clipped()
                        .allowsHitTesting(false)
                } else {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(red: 12/255, green: 34/255, blue: 68/255))
                        .frame(width: width, height: height)
                        .allowsHitTesting(false)
                }

                // Left Icon Slot (left: 14%, width: 17%)
                Group {
                    if let custom = customIconText {
                        Text(custom)
                            .font(.system(size: height * 0.38))
                    } else if let iconImg = atlasManager.uiSettingIconImage(for: variantKey) {
                        Image(uiImage: iconImg)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: height * 0.52, height: height * 0.52)
                    }
                }
                .position(x: width * 0.225, y: height * 0.50)
                .allowsHitTesting(false)

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
                .allowsHitTesting(false)

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
                        .allowsHitTesting(false)
                }
            }
            .frame(width: width, height: height)
            .contentShape(Rectangle())
            .opacity(disabled ? 0.45 : 1.0)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}

/// 3-Slice Widened Horizontal Shark Summary Banner Card (`SETTING_SHARK_CARD` from `setting_83a7a273.png`)
public struct UiSettingSharkCardView<RightContent: View>: View {
    public let form: SharkFormConfig
    public var width: CGFloat = 390
    public var height: CGFloat = 68
    public let rightContent: () -> RightContent
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared

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
        let _ = atlasManager.atlasRevision
        ZStack {
            if let cardImg = atlasManager.uiSettingImage(for: "SETTING_SHARK_CARD") {
                Image(uiImage: cardImg)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: width, height: height)
            } else {
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color(red: 7/255, green: 24/255, blue: 52/255))
                    .frame(width: width, height: height)
            }

            // Left Wide Recessed Rectangular Avatar Window (left: 2.7%..26.0%, center x: 14.35%, width: 23.3%)
            SharkPreviewView(form: form, width: width * 0.195, height: height * 0.56)
                .frame(width: width * 0.218, height: height * 0.64)
                .clipShape(RoundedRectangle(cornerRadius: 7))
                .position(x: width * 0.1435, y: height * 0.50)

            // Right Content Slot (left: 28.5%, right: 5.5%, center x: 61.5%, width: 66.0%)
            rightContent()
                .frame(width: width * 0.66, height: height * 0.78)
                .position(x: width * 0.615, y: height * 0.50)
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
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared

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
        let _ = atlasManager.atlasRevision
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
            if let frameImg = atlasManager.uiSettingImage(for: key)
                ?? atlasManager.uiSettingImage(for: "SETTING_MODAL_FRAME") {
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
