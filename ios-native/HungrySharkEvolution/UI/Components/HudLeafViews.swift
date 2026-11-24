import SwiftUI

/// Isolated Sonar Virtual Joystick subview (iOS-P1-1).
/// Owns `@State knobOffset` & `@GestureState isDragging` locally and writes directly to non-`@Published`
/// `vm.joyDx/joyDy/joyActive`, guaranteeing ZERO root `ContentView` SwiftUI redraws while steering.
public struct SonarJoystickView: View {
    public let vm: GameViewModel
    public let resetToken: Int

    @State private var knobOffset: CGSize = .zero
    @GestureState private var isDragging: Bool = false

    public init(vm: GameViewModel, resetToken: Int) {
        self.vm = vm
        self.resetToken = resetToken
    }

    public var body: some View {
        ZStack {
            UiAtlasIconView(iconKey: "UI_JOYSTICK_BASE", size: 118)
                .opacity(isDragging ? 0.96 : 0.78)

            Circle()
                .stroke(Color.cyan.opacity(isDragging ? 0.45 : 0.18), lineWidth: 1)
                .frame(width: 82, height: 82)

            UiAtlasIconView(iconKey: "UI_JOYSTICK_KNOB", size: 58)
                .shadow(color: .cyan.opacity(isDragging ? 0.85 : 0.35), radius: 8)
                .offset(knobOffset)
        }
        .frame(width: 124, height: 124)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .updating($isDragging) { _, state, _ in
                    state = true
                }
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
        .onChange(of: isDragging) { dragging in
            if !dragging {
                knobOffset = .zero
                vm.joyDx = 0
                vm.joyDy = 0
                vm.joyActive = false
            }
        }
        .onChange(of: resetToken) { _ in
            knobOffset = .zero
            vm.joyDx = 0
            vm.joyDy = 0
            vm.joyActive = false
        }
        .onDisappear {
            knobOffset = .zero
            vm.joyDx = 0
            vm.joyDy = 0
            vm.joyActive = false
        }
    }
}

/// Isolated Hold-to-Boost Medallion subview (iOS-P1-1).
/// Subscribes only to `HudTelemetryStore` (~18Hz energy ring) and owns its own drag gesture state.
public struct BoostMedallionView: View {
    public let vm: GameViewModel
    @ObservedObject public var telemetry: HudTelemetryStore
    @GestureState private var isBoostDragging: Bool = false

    public init(vm: GameViewModel, telemetry: HudTelemetryStore) {
        self.vm = vm
        self._telemetry = ObservedObject(wrappedValue: telemetry)
    }

    public var body: some View {
        let energyPct = max(0.0, min(1.0, telemetry.energy / max(1.0, telemetry.maxEnergy)))
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: isBoostDragging
                            ? [Color.cyan.opacity(0.65), Color.blue.opacity(0.92)]
                            : [Color(red: 12/255, green: 34/255, blue: 68/255).opacity(0.88), Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.95)],
                        center: .center,
                        startRadius: 4,
                        endRadius: 42
                    )
                )
                .frame(width: 82, height: 82)

            Circle()
                .stroke(Color.white.opacity(0.14), lineWidth: 4)
                .frame(width: 76, height: 76)
            Circle()
                .trim(from: 0, to: CGFloat(energyPct))
                .stroke(
                    telemetry.frenzyActive ? Color.yellow : Color.cyan,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .frame(width: 76, height: 76)

            UiAtlasIconView(iconKey: "UI_BTN_BOOST", size: 62)
                .scaleEffect(isBoostDragging ? 0.92 : 1.0)

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
                .updating($isBoostDragging) { _, state, _ in
                    state = true
                }
                .onChanged { _ in vm.isBoostingHeld = true }
                .onEnded { _ in vm.isBoostingHeld = false }
        )
        .onChange(of: isBoostDragging) { dragging in
            if !dragging {
                vm.isBoostingHeld = false
            }
        }
        .onDisappear {
            vm.isBoostingHeld = false
        }
    }
}

/// Isolated depth meter readout (subscribes only to `HudTelemetryStore`).
public struct TelemetryDepthReadoutView: View {
    @ObservedObject public var telemetry: HudTelemetryStore
    public let iconSize: CGFloat

    public init(telemetry: HudTelemetryStore, iconSize: CGFloat) {
        self._telemetry = ObservedObject(wrappedValue: telemetry)
        self.iconSize = iconSize
    }

    public var body: some View {
        HStack(spacing: 3) {
            UiAtlasIconView(iconKey: "UI_ICON_DEPTH", size: iconSize)
            Text("\(telemetry.depthMeters)m")
                .foregroundColor(telemetry.depthMeters >= 1000 ? .pink : (telemetry.depthMeters >= 200 ? .purple : .cyan))
        }
    }
}

/// Isolated Row-2 combo, frenzy countdown, and shallow-depletion deep-dive guidance pills (iOS-P1-1).
public struct HudRow2StatusOverlayView: View {
    public let vm: GameViewModel
    @ObservedObject public var telemetry: HudTelemetryStore

    public init(vm: GameViewModel, telemetry: HudTelemetryStore) {
        self.vm = vm
        self._telemetry = ObservedObject(wrappedValue: telemetry)
    }

    public var body: some View {
        let heatBuff = GameRules.computeHuntingHeatBuff(comboCount: telemetry.comboCount)
        VStack(spacing: 5) {
            HStack(spacing: 8) {
                if telemetry.comboCount > 1 {
                    let comboText = vm.t(
                        "hud_combo",
                        [
                            "count": "\(telemetry.comboCount)",
                            "mult": String(format: "%.1f", heatBuff.scoreMultiplier)
                        ]
                    )
                    HStack(spacing: 4) {
                        UiAtlasIconView(iconKey: "UI_ICON_COMBO_FIRE", size: 15)
                        Text(comboText)
                            .font(.system(size: 10, weight: .black))
                            .foregroundColor(.white)
                        if heatBuff.heatLevel > 0 {
                            Text("· \(vm.t(heatBuff.labelKey)) ⚡+\(Int((heatBuff.speedMultiplier - 1.0) * 100))%")
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

                if telemetry.frenzyActive {
                    Text("🔥 \(vm.t("hud_frenzy")) · \(String(format: "%.1fs", telemetry.frenzyTimer))")
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

            if let targetDepth = telemetry.deepDivePromptMeters {
                VStack(spacing: 1) {
                    Text("⬇️ \(vm.t("hud_deep_dive_cue", ["depth": "\(targetDepth)"]))")
                        .font(.system(size: 10.5, weight: .black))
                        .foregroundColor(Color(red: 125/255, green: 211/255, blue: 252/255))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Text(vm.t("hud_deep_dive_sub"))
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundColor(Color.white.opacity(0.82))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(Color(red: 7/255, green: 24/255, blue: 48/255).opacity(0.84))
                        .overlay(Capsule().stroke(Color.cyan.opacity(0.65), lineWidth: 1))
                )
                .allowsHitTesting(false)
            }
        }
    }
}

/// Isolated onboarding boost timer label (avoids root ContentView redraws during Step 2 hold).
public struct OnboardingBoostProgressLabel: View {
    @ObservedObject public var telemetry: HudTelemetryStore

    public init(telemetry: HudTelemetryStore) {
        self._telemetry = ObservedObject(wrappedValue: telemetry)
    }

    public var body: some View {
        Text(String(format: "(%.1f/1.2s)", telemetry.onboardingBoostSeconds))
            .font(.system(size: 10, weight: .black, design: .monospaced))
            .foregroundColor(.white)
    }
}
