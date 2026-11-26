import SwiftUI
import QuartzCore
import UIKit

// MARK: - 48-Shark Evolution Atlas Modal (Silky-Smooth Continuous Rotary Wheel + Command Deck)

public struct EvolutionAtlasSheetView: View {
    @ObservedObject var vm: GameViewModel
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared
    @State private var inspectedIndex: Int = 0
    @State private var wheelPosition: Double = 0.0
    @State private var wheelVelocity: Double = 0.0 // slots per second
    @State private var wheelTargetSlot: Double? = nil
    @State private var isDraggingWheel: Bool = false
    @State private var dragHasMoved: Bool = false
    @State private var dragBaseWheelPos: Double? = nil
    @State private var dragStartTime: TimeInterval = 0.0
    @State private var inheritedWheelVelocity: Double = 0.0
    @State private var dragTouchSamples: [(pos: Double, time: TimeInterval)] = []
    @State private var lastTickIndex: Int = 0
    @State private var lastTickFeedbackTime: TimeInterval = 0.0
    @State private var lastPhysicsFrameTime: TimeInterval = 0.0
    @State private var selectionFeedback = UISelectionFeedbackGenerator()

    // iPhone Alarm Clock (UIPickerView) Drum Physics Constants (1:1 Parity with Web SharkEvolutionAtlasModal.tsx):
    // UIKit UIScrollView.DecelerationRate.normal = 0.998/ms (~2.00 s^-1); UIPickerView drum = 0.9978/ms (lambda = 2.05 s^-1)
    private let pickerDecelLambda: Double = 2.05
    private let pickerPxPerSlot: Double = 34.0
    private let pickerMaxVelocity: Double = 42.0
    private let wheelPhysicsTimer = Timer.publish(every: 1.0 / 120.0, on: .main, in: .common).autoconnect()

    private var inspectedForm: SharkFormConfig {
        let total = GameConfigGenerated.sharkForms.count
        let norm = ((inspectedIndex % total) + total) % total
        return GameConfigGenerated.sharkForms[norm]
    }

    private func fireDetentFeedbackIfCrossed(at position: Double) {
        let total = GameConfigGenerated.sharkForms.count
        let roundedSlot = Int(position.rounded())
        let curIdx = ((roundedSlot % total) + total) % total
        if curIdx != inspectedIndex {
            inspectedIndex = curIdx
        }
        if roundedSlot != lastTickIndex {
            lastTickIndex = roundedSlot
            let now = CACurrentMediaTime()
            // Throttle haptic & audio tick to >= 24ms interval so high-speed 40-slot spins never block the 120Hz main thread
            if now - lastTickFeedbackTime >= 0.024 {
                lastTickFeedbackTime = now
                selectionFeedback.selectionChanged()
                selectionFeedback.prepare()
                if vm.save.soundEnabled {
                    OceanAudioEngine.shared.playWheelDetentTick(
                        speedRatio: min(1.0, abs(wheelVelocity) / pickerMaxVelocity)
                    )
                }
            }
        }
    }

    private func snapWheel(to targetPosition: Double) {
        let snapped = targetPosition.rounded()
        lastPhysicsFrameTime = CACurrentMediaTime()
        wheelTargetSlot = snapped
        wheelVelocity = (snapped - wheelPosition) * pickerDecelLambda * 1.35
    }

    private func stepWheelPhysics() {
        guard !isDraggingWheel else {
            lastPhysicsFrameTime = CACurrentMediaTime()
            return
        }
        guard let target = wheelTargetSlot else {
            lastPhysicsFrameTime = CACurrentMediaTime()
            return
        }

        let now = CACurrentMediaTime()
        let dt = lastPhysicsFrameTime <= 0 ? (1.0 / 60.0) : min(0.045, max(0.001, now - lastPhysicsFrameTime))
        lastPhysicsFrameTime = now

        let rem = target - wheelPosition
        let absRem = abs(rem)

        if absRem > 0.26 {
            // Phase 1: Authentic iPhone Alarm (UIPickerView) Exponential Drum Glide
            // with subtle mechanical detent ratchet modulation across each slot boundary
            let baseExpVel = rem * pickerDecelLambda
            let ratchetMod = 1.0 + 0.075 * cos(2.0 * .pi * wheelPosition)
            let desiredVel = baseExpVel * ratchetMod
            wheelVelocity += (desiredVel - wheelVelocity) * min(1.0, dt * 24.0)
            wheelPosition += wheelVelocity * dt
        } else {
            // Phase 2: Final Magnetic Detent Notch Lock-In (overdamped, zero overshoot)
            let detentStiffness = 115.0
            let detentDamping = 22.5
            let accel = rem * detentStiffness - wheelVelocity * detentDamping
            wheelVelocity += accel * dt
            wheelPosition += wheelVelocity * dt

            if abs(target - wheelPosition) < 0.002 && abs(wheelVelocity) < 0.015 {
                wheelPosition = target
                wheelVelocity = 0.0
                wheelTargetSlot = nil
                fireDetentFeedbackIfCrossed(at: target)
                return
            }
        }

        fireDetentFeedbackIfCrossed(at: wheelPosition)
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
            let winInsets = ContentView.currentWindowSafeAreaInsets()
            let rawLead = max(geo.safeAreaInsets.leading, winInsets.left)
            let rawTrail = max(geo.safeAreaInsets.trailing, winInsets.right)
            let rawTop = max(geo.safeAreaInsets.top, winInsets.top)
            let rawBottom = max(geo.safeAreaInsets.bottom, winInsets.bottom)
            let headerLead = ContentView.cornerHudInset(for: rawLead, fallback: 16.0)
            let headerTrail = ContentView.cornerHudInset(for: rawTrail, fallback: 16.0)
            let splitLead: CGFloat = isLandscape ? max(12.0, rawLead) : 0.0
            let splitTrail: CGFloat = isLandscape ? max(12.0, rawTrail) : 0.0
            let usableSplitW = max(320.0, geo.size.width - splitLead - splitTrail)

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
                        .padding(.leading, headerLead)
                        .padding(.trailing, headerTrail)
                        .padding(.top, max(8.0, rawTop))
                        .padding(.bottom, 8)
                        .background(Color(red: 2/255, green: 8/255, blue: 23/255).opacity(0.65))

                    Divider().background(Color.cyan.opacity(0.2))

                    // 2. Main Split Stage (Left/Top: Giant Aquarium + Continuous Rotary Wheel; Right/Bottom: De-Boxed Command Deck)
                    if isLandscape {
                        HStack(spacing: 0) {
                            aquariumAndArcDialStage(
                                form: form,
                                check: check,
                                lineageMeta: lineageMeta,
                                curLv: curLv,
                                stageWidth: usableSplitW * 0.50
                            )
                            .frame(width: usableSplitW * 0.50)
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
                            .frame(width: usableSplitW * 0.50)
                        }
                        .padding(.leading, splitLead)
                        .padding(.trailing, splitTrail)
                        .padding(.bottom, max(4.0, rawBottom * 0.55))
                    } else {
                        VStack(spacing: 0) {
                            aquariumAndArcDialStage(
                                form: form,
                                check: check,
                                lineageMeta: lineageMeta,
                                curLv: curLv,
                                stageWidth: geo.size.width
                            )
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
                        .padding(.bottom, rawBottom)
                    }
                }
            }
        }
        .onAppear {
            inspectedIndex = vm.activeSharkForm.index
            wheelPosition = Double(vm.activeSharkForm.index)
            wheelVelocity = 0.0
            wheelTargetSlot = nil
            lastTickIndex = vm.activeSharkForm.index
            lastPhysicsFrameTime = CACurrentMediaTime()
            selectionFeedback.prepare()
        }
        .onReceive(wheelPhysicsTimer) { _ in
            stepWheelPhysics()
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

    // MARK: - Unified Touch/Drag Gesture Handler (1:1 Parity with Web handleStagePointerDown/Move/Up)
    private func makeWheelDragGesture(stageWidth: CGFloat, allowArcTapSelection: Bool) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { val in
                let now = val.time.timeIntervalSinceReferenceDate
                let tx = Double(val.translation.width)
                let ty = Double(val.translation.height)

                if !isDraggingWheel || dragBaseWheelPos == nil {
                    isDraggingWheel = true
                    dragHasMoved = false
                    inheritedWheelVelocity = abs(wheelVelocity) > 2.0 ? wheelVelocity : 0.0
                    wheelTargetSlot = nil
                    wheelVelocity = 0.0
                    dragBaseWheelPos = wheelPosition
                    dragStartTime = now
                    dragTouchSamples = [(pos: wheelPosition, time: now)]
                    selectionFeedback.prepare()
                }

                if abs(tx) > 4.0 || abs(ty) > 4.0 {
                    dragHasMoved = true
                }

                let startPos = dragBaseWheelPos ?? wheelPosition
                let rawPos = startPos - tx / pickerPxPerSlot
                dragTouchSamples.append((pos: rawPos, time: now))
                while dragTouchSamples.count > 10, let first = dragTouchSamples.first, (now - first.time) > 0.12 {
                    dragTouchSamples.removeFirst()
                }

                let firstSample = dragTouchSamples.first ?? (pos: rawPos, time: now)
                let dtSec = max(0.008, now - firstSample.time)
                let dragVel = (rawPos - firstSample.pos) / dtSec

                // Subtle slow-drag magnetic detent dwell across each integer slot (like iPhone Alarm drum)
                let detentStrength = max(0.0, 1.0 - abs(dragVel) / 3.2) * 0.055
                let displayPos = rawPos - detentStrength * sin(2.0 * .pi * rawPos)

                wheelPosition = displayPos
                wheelVelocity = dragVel
                fireDetentFeedbackIfCrossed(at: displayPos)
            }
            .onEnded { val in
                let now = val.time.timeIntervalSinceReferenceDate
                let startPos = dragBaseWheelPos ?? wheelPosition
                let moved = dragHasMoved
                isDraggingWheel = false
                dragHasMoved = false
                dragBaseWheelPos = nil
                lastPhysicsFrameTime = CACurrentMediaTime()

                // If user tapped without dragging (< 4pt movement), resolve tapped shark slot on the arc
                if !moved && allowArcTapSelection {
                    let maxHalfSpan = min(186.0, Double(stageWidth) * 0.44)
                    let pxPerArcSlot = max(24.0, maxHalfSpan / 3.05)
                    let dxFromCenter = Double(val.startLocation.x - stageWidth * 0.5)
                    let tappedSlotOffset = (dxFromCenter / pxPerArcSlot).rounded()
                    if abs(tappedSlotOffset) >= 1.0 && abs(tappedSlotOffset) <= 3.0 {
                        let baseTarget = wheelPosition.rounded()
                        snapWheel(to: baseTarget + tappedSlotOffset)
                        dragTouchSamples.removeAll()
                        return
                    }
                }

                let latest = dragTouchSamples.last ?? (pos: wheelPosition, time: now)
                let pauseBeforeLiftSec = max(0.0, now - latest.time)
                var releaseVel: Double = 0.0

                if pauseBeforeLiftSec < 0.095 && dragTouchSamples.count >= 2 {
                    var anchor = dragTouchSamples[0]
                    for idx in stride(from: dragTouchSamples.count - 2, through: 0, by: -1) {
                        anchor = dragTouchSamples[idx]
                        if (latest.time - anchor.time) >= 0.030 {
                            break
                        }
                    }
                    let windowSec = latest.time - anchor.time
                    if windowSec >= 0.005 {
                        releaseVel = (latest.pos - anchor.pos) / windowSec
                    }
                }

                // Blend UIKit's hardware-predicted end translation for crisp short thumb flicks
                if pauseBeforeLiftSec < 0.095 {
                    let predictedExtraDx = Double(val.predictedEndTranslation.width - val.translation.width)
                    let predictedEndPos = startPos - Double(val.predictedEndTranslation.width) / pickerPxPerSlot
                    let systemThrowVel = (predictedEndPos - wheelPosition) * pickerDecelLambda
                    let extraThrowVel = (-predictedExtraDx / pickerPxPerSlot) * pickerDecelLambda * 0.95
                    let bestSystemVel = abs(extraThrowVel) > abs(systemThrowVel) ? extraThrowVel : systemThrowVel
                    if abs(bestSystemVel) > abs(releaseVel) {
                        releaseVel = releaseVel * 0.30 + bestSystemVel * 0.70
                    }
                }

                // Multi-flick momentum stacking (just like spinning the iPhone Alarm minute wheel repeatedly!)
                let gestureDuration = now - dragStartTime
                if gestureDuration < 0.28 && abs(releaseVel) > 1.8 && (releaseVel * inheritedWheelVelocity > 0) {
                    releaseVel += inheritedWheelVelocity * 0.72
                }
                releaseVel = max(-pickerMaxVelocity, min(pickerMaxVelocity, releaseVel))
                dragTouchSamples.removeAll()

                let targetSlot: Double
                if abs(releaseVel) > 1.05 {
                    let projected = wheelPosition + releaseVel / pickerDecelLambda
                    var roundedTarget = projected.rounded()
                    if roundedTarget == wheelPosition.rounded() {
                        roundedTarget += releaseVel > 0 ? 1.0 : -1.0
                    }
                    targetSlot = roundedTarget
                } else {
                    targetSlot = wheelPosition.rounded()
                }

                wheelTargetSlot = targetSlot
                wheelVelocity = (targetSlot - wheelPosition) * pickerDecelLambda
            }
    }

    // MARK: - Left/Top: Giant Aquarium Spotlight + Silky-Smooth Continuous Rotary Wheel
    private func aquariumAndArcDialStage(
        form: SharkFormConfig,
        check: UnlockCheckResult,
        lineageMeta: SharkLineageMeta?,
        curLv: Int,
        stageWidth: CGFloat
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

            // Center Giant Shark Spotlight with Left / Right Step Arrows (Center Spotlight also draggable!)
            HStack {
                Button {
                    let base = wheelTargetSlot ?? wheelPosition.rounded()
                    snapWheel(to: base - 1.0)
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
                .contentShape(Rectangle())
                .highPriorityGesture(makeWheelDragGesture(stageWidth: stageWidth, allowArcTapSelection: false))

                Spacer()

                Button {
                    let base = wheelTargetSlot ?? wheelPosition.rounded()
                    snapWheel(to: base + 1.0)
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

            // Bottom Silky-Smooth Continuous Rotary Wheel (1:1 Parabolic Arc & Stable View Identity with Web SharkEvolutionAtlasModal.tsx)
            GeometryReader { dialGeo in
                let dialW = dialGeo.size.width
                let dialH = dialGeo.size.height
                let total = GameConfigGenerated.sharkForms.count
                let centerSlot = Int(wheelPosition.rounded())
                let visibleRawSlots = Array((centerSlot - 4)...(centerSlot + 4))
                let maxHalfSpan = min(186.0, Double(dialW) * 0.44)

                ZStack {
                    // Upper & Lower Curved Compass Rim Tracks (1:1 with Web SVG paths)
                    Path { path in
                        path.move(to: CGPoint(x: dialW * 0.05, y: dialH * 0.68))
                        path.addQuadCurve(
                            to: CGPoint(x: dialW * 0.95, y: dialH * 0.68),
                            control: CGPoint(x: dialW * 0.50, y: dialH * 0.14)
                        )
                    }
                    .stroke(Color.cyan.opacity(0.32), lineWidth: 1.75)

                    Path { path in
                        path.move(to: CGPoint(x: dialW * 0.03, y: dialH * 0.78))
                        path.addQuadCurve(
                            to: CGPoint(x: dialW * 0.97, y: dialH * 0.78),
                            control: CGPoint(x: dialW * 0.50, y: dialH * 0.24)
                        )
                    }
                    .stroke(Color.cyan.opacity(0.14), style: StrokeStyle(lineWidth: 1.0, dash: [4, 6]))

                    // Key by stable virtual slot rawIdx so SwiftUI NEVER swaps shark textures across integer boundaries!
                    ForEach(visibleRawSlots, id: \.self) { rawIdx in
                        let itemIdx = ((rawIdx % total) + total) % total
                        let itemForm = GameConfigGenerated.sharkForms[itemIdx]
                        let itemUnlocked = vm.save.unlockedSharkIds.contains(itemForm.id)
                        let isActive = vm.save.selectedSharkId == itemForm.id
                        let slotPos = Double(rawIdx) - wheelPosition
                        let absSlot = abs(slotPos)

                        if absSlot <= 3.65 {
                            let isCenter = absSlot < 0.45
                            let xOffset = (slotPos / 3.05) * maxHalfSpan
                            let normalizedX = min(1.25, absSlot / 3.05)
                            let yOffset = -4.0 + normalizedX * normalizedX * 18.0
                            let rotDeg = slotPos * 6.5
                            let scale = CGFloat(max(0.60, 1.12 - absSlot * 0.14))
                            let edgeOpacity = max(0.15, 1.0 - max(0.0, absSlot - 2.4) * 0.70)
                            let nodeOpacity = itemUnlocked ? edgeOpacity : edgeOpacity * 0.65

                            VStack(spacing: 2) {
                                ZStack {
                                    Circle()
                                        .fill(
                                            isCenter
                                                ? Color.cyan.opacity(0.22)
                                                : (isActive ? Color.green.opacity(0.16) : Color.white.opacity(0.04))
                                        )
                                        .frame(width: 46, height: 46)
                                        .overlay(
                                            Circle().stroke(
                                                isCenter ? Color.cyan.opacity(0.85) : (isActive ? Color.green.opacity(0.55) : Color.clear),
                                                lineWidth: isCenter ? 1.8 : 1.0
                                            )
                                        )
                                        .shadow(color: isCenter ? Color.cyan.opacity(0.65) : .clear, radius: 10)

                                    if isCenter {
                                        Circle()
                                            .fill(Color.cyan)
                                            .frame(width: 5, height: 5)
                                            .shadow(color: .cyan, radius: 4)
                                            .offset(y: -25)
                                    } else if isActive {
                                        Circle()
                                            .fill(Color.green)
                                            .frame(width: 5, height: 5)
                                            .offset(x: 15, y: -15)
                                    }

                                    SharkPreviewView(form: itemForm, width: 38, height: 22, locked: !itemUnlocked)
                                }
                                Text(vm.lang == "zh" ? itemForm.nameZh : itemForm.nameEn)
                                    .font(.system(size: 8.5, weight: isCenter ? .black : .bold))
                                    .foregroundColor(isCenter ? .white : Color.white.opacity(0.55))
                                    .lineLimit(1)
                            }
                            .scaleEffect(scale)
                            .rotationEffect(.degrees(rotDeg))
                            .opacity(nodeOpacity)
                            .position(
                                x: dialW * 0.50 + CGFloat(xOffset),
                                y: dialH * 0.48 + CGFloat(yOffset)
                            )
                            .zIndex(isCenter ? 35.0 : (25.0 - absSlot * 3.0))
                            .allowsHitTesting(false)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .highPriorityGesture(makeWheelDragGesture(stageWidth: dialW, allowArcTapSelection: true))
            }
            .frame(height: 86)
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
                    sub: "Max T\(min(48, form.baseBiteTier + 6))",
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
            if !vm.permanentProgressEligibility.allowSharkUnlockAndUpgrade {
                HStack(spacing: 8) {
                    Text(vm.lang == "zh"
                         ? "试玩模式仅预览图谱（本局结束后可消费金币/基因）"
                         : "Trial Preview Only (Spend currency after run)")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(.yellow)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.yellow.opacity(0.14))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.yellow.opacity(0.45), lineWidth: 1.2))
                        )
                }
            } else {
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
                        let drop = vm.currentSupplyDropReward
                        Button {
                            vm.showRewardedAd(kind: .SUPPLY_DROP)
                        } label: {
                            Text(vm.lang == "zh" ? "📺 免费补给 (+\(drop.coins)🪙+\(drop.genes)🧬)" : "📺 FREE DROP (+\(drop.coins)🪙+\(drop.genes)🧬)")
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
