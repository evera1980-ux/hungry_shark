import SwiftUI
import SpriteKit

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

                // 2. Top-Left Frameless Avatar & Angled HP/Boost Bar
                VStack {
                    HStack(alignment: .top) {
                        avatarDataBar
                        Spacer()
                        if vm.gameState == "playing" {
                            telemetryPill
                            Spacer()
                            pauseButton
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    Spacer()
                }

                // 3. Title Screen Bottom Action Banners
                if vm.gameState == "title" {
                    VStack {
                        Spacer()
                        HStack(spacing: 16) {
                            Button {
                                vm.startNewRun()
                            } label: {
                                bannerPill(title: "立即潜入深海", subtitle: "START HUNTING", color: .green)
                            }
                            Button {
                                vm.showEvolutionAtlas = true
                            } label: {
                                bannerPill(
                                    title: "进化 ((vm.save.unlockedSharkIds.count)/48)",
                                    subtitle: "EVOLUTION ATLAS",
                                    color: .cyan
                                )
                            }
                            Button {
                                vm.startNewRun(trialSharkId: "shark_41_star_destroyer")
                            } label: {
                                bannerPill(title: "试驾机甲利维坦", subtitle: "MECHA TRIAL", color: .orange)
                            }
                        }
                        .padding(.bottom, 22)
                    }
                }

                // 4. In-Game Multi-Touch Sonar Joystick (Bottom-Left) + 90° MOBA Skill Fan (Bottom-Right)
                if vm.gameState == "playing" {
                    VStack {
                        Spacer()
                        HStack(alignment: .bottom) {
                            sonarJoystick
                                .padding(.leading, 28)
                                .padding(.bottom, 20)
                            Spacer()
                            mobaSkillFan
                                .padding(.trailing, 24)
                                .padding(.bottom, 18)
                        }
                    }
                }

                // 5. Pause / Game Over Native Overlay
                if vm.gameState == "paused" || vm.gameState == "gameover" {
                    pauseOrGameOverModal
                }
            }
            .sheet(isPresented: $vm.showEvolutionAtlas) {
                EvolutionAtlasSheetView(vm: vm)
            }
        }
        .statusBarHidden(true)
    }

    private var avatarDataBar: some View {
        Button {
            vm.showEvolutionAtlas = true
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .stroke(
                            LinearGradient(colors: [.cyan, .purple], startPoint: .topLeading, endPoint: .bottomTrailing),
                            lineWidth: 3
                        )
                        .frame(width: 54, height: 54)
                    if let uiImg = SpriteAtlasManager.shared.sharkUIImage(for: vm.activeSharkForm.spriteKey) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 30)
                    }
                    Text("T\(vm.biteTier)")
                        .font(.system(size: 10, weight: .black, design: .rounded))
                        .foregroundColor(.black)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.yellow))
                        .offset(x: -18, y: 20)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(vm.activeSharkForm.nameZh)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                        Text("Lv.\(vm.activeUpgradeLevel)")
                            .font(.system(size: 11, weight: .heavy, design: .monospaced))
                            .foregroundColor(.cyan)
                    }
                    // Skewed HP Bar
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.black.opacity(0.55))
                            .frame(width: 128, height: 8)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(LinearGradient(colors: [.green, .mint], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(0, 128 * CGFloat(vm.hp / max(1, vm.maxHp))), height: 8)
                    }
                    // Skewed Boost Bar
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.black.opacity(0.55))
                            .frame(width: 112, height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(LinearGradient(colors: [.cyan, .blue], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(0, 112 * CGFloat(vm.energy / max(1, vm.maxEnergy))), height: 6)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(red: 4/255, green: 15/255, blue: 38/255).opacity(0.76))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.cyan.opacity(0.45), lineWidth: 1.2)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var telemetryPill: some View {
        HStack(spacing: 14) {
            Label("\(vm.score)", systemImage: "trophy.fill")
                .foregroundColor(.yellow)
            Label("\(vm.save.bankedCoins)", systemImage: "bitcoinsign.circle.fill")
                .foregroundColor(.orange)
            Label("\(vm.save.bankedGenes)", systemImage: "allergens")
                .foregroundColor(.mint)
            Label("\(vm.depthMeters)m", systemImage: "arrow.down.to.line")
                .foregroundColor(.cyan)
        }
        .font(.system(size: 13, weight: .heavy, design: .monospaced))
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.45))
                .overlay(Capsule().stroke(Color.white.opacity(0.16), lineWidth: 1))
        )
    }

    private var pauseButton: some View {
        Button {
            vm.gameState = "paused"
        } label: {
            Image(systemName: "pause.circle.fill")
                .font(.system(size: 34))
                .foregroundColor(.cyan)
        }
    }

    private var sonarJoystick: some View {
        ZStack {
            Circle()
                .stroke(Color.cyan.opacity(0.45), lineWidth: 2)
                .background(Circle().fill(Color.black.opacity(0.25)))
                .frame(width: 108, height: 108)
            Circle()
                .fill(
                    RadialGradient(
                        colors: [.cyan, .blue.opacity(0.8)],
                        center: .center,
                        startRadius: 2,
                        endRadius: 22
                    )
                )
                .frame(width: 42, height: 42)
                .offset(knobOffset)
        }
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

    private var mobaSkillFan: some View {
        ZStack(alignment: .bottomTrailing) {
            // 0° Left Slot: Gold Frenzy
            skillMedallion(
                title: "狂暴",
                cost: "🪙\(GameRules.getGoldOverdriveCost(useCount: vm.goldOverdriveUseCount, generationRow: vm.activeSharkForm.row))",
                color: .yellow,
                iconKey: "UI_BTN_GOLD_FRENZY"
            ) {
                vm.triggerGoldFrenzy()
            }
            .offset(x: -96, y: -4)

            // 45° Diagonal Slot: Gene Surge
            skillMedallion(
                title: "突破",
                cost: "🧬\(GameRules.getGeneSurgeCost(level: vm.inRunLevel, useCount: vm.geneSurgeUseCount, generationRow: vm.activeSharkForm.row))",
                color: .mint,
                iconKey: "UI_BTN_GENE_SURGE"
            ) {
                vm.triggerGeneSurge()
            }
            .offset(x: -68, y: -68)

            // 90° Top Slot: Body Upgrade
            skillMedallion(
                title: "强化 Lv.\(vm.activeUpgradeLevel)",
                cost: "🪙\(GameRules.getSharkUpgradeCoinCost(form: vm.activeSharkForm, currentLevel: vm.activeUpgradeLevel))",
                color: .cyan,
                iconKey: "UI_BTN_BODY_UPGRADE"
            ) {
                vm.upgradeActiveSharkBody()
            }
            .offset(x: -4, y: -96)

            // Anchor: Main Boost Button (Hold to Boost)
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: vm.isBoostingHeld ? [.yellow, .orange] : [.cyan, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 74, height: 74)
                    .shadow(color: .cyan.opacity(0.6), radius: 10)
                VStack(spacing: 2) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 24, weight: .black))
                        .foregroundColor(.white)
                    Text("冲刺")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(.white)
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in vm.isBoostingHeld = true }
                    .onEnded { _ in vm.isBoostingHeld = false }
            )
        }
    }

    private func skillMedallion(title: String, cost: String, color: Color, iconKey: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                ZStack {
                    Circle()
                        .fill(Color.black.opacity(0.65))
                        .frame(width: 48, height: 48)
                        .overlay(Circle().stroke(color, lineWidth: 2))
                    if let uiImg = SpriteAtlasManager.shared.uiIconImage(for: iconKey) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 34, height: 34)
                    } else {
                        Image(systemName: "sparkles")
                            .foregroundColor(color)
                    }
                }
                Text("\(title) \(cost)")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Capsule().fill(Color.black.opacity(0.7)))
            }
        }
        .buttonStyle(.plain)
    }

    private func bannerPill(title: String, subtitle: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 14, weight: .black))
                .foregroundColor(.white)
            Text(subtitle)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(color.opacity(0.9))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(red: 6/255, green: 22/255, blue: 48/255).opacity(0.88))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(color, lineWidth: 1.8))
        )
    }

    private var pauseOrGameOverModal: some View {
        ZStack {
            Color.black.opacity(0.65).ignoresSafeArea()
            VStack(spacing: 16) {
                Text(vm.gameState == "gameover" ? "狩猎结算 · HUNT COMPLETE" : "暂停 · PAUSED")
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(.cyan)

                HStack(spacing: 24) {
                    VStack {
                        Text("本局得分")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text("\(vm.score)")
                            .font(.title2.bold())
                            .foregroundColor(.yellow)
                    }
                    VStack {
                        Text("下潜深度")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text("\(vm.depthMeters)m")
                            .font(.title2.bold())
                            .foregroundColor(.cyan)
                    }
                    VStack {
                        Text("局内等级")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text("Lv.\(vm.inRunLevel)")
                            .font(.title2.bold())
                            .foregroundColor(.mint)
                    }
                }

                HStack(spacing: 14) {
                    if vm.gameState == "paused" {
                        Button("继续狩猎") {
                            vm.gameState = "playing"
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    }
                    Button("再次潜入") {
                        vm.startNewRun()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.cyan)

                    Button("进化图谱") {
                        vm.showEvolutionAtlas = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)

                    Button("返回主页") {
                        vm.gameState = "title"
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(28)
            .background(
                RoundedRectangle(cornerRadius: 22)
                    .fill(Color(red: 7/255, green: 16/255, blue: 36/255))
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.cyan.opacity(0.6), lineWidth: 2))
            )
        }
    }
}

public struct EvolutionAtlasSheetView: View {
    @ObservedObject var vm: GameViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var inspectedIndex: Int = 0

    private var inspectedForm: SharkFormConfig {
        GameConfigGenerated.sharkForms[max(0, min(47, inspectedIndex))]
    }

    public var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 4/255, green: 18/255, blue: 42/255), Color(red: 2/255, green: 8/255, blue: 22/255)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                // Header
                HStack {
                    Text("进化 · 48阶鲨鱼基因图谱")
                        .font(.system(size: 18, weight: .black))
                        .foregroundColor(.white)
                    Spacer()
                    Text("🪙 \(vm.save.bankedCoins)   🧬 \(vm.save.bankedGenes)")
                        .font(.system(size: 14, weight: .heavy, design: .monospaced))
                        .foregroundColor(.yellow)
                    Button("关闭") { dismiss() }
                        .buttonStyle(.bordered)
                }
                .padding(.horizontal, 20)
                .padding(.top, 14)

                // Giant Aquarium Hero Spotlight
                VStack(spacing: 6) {
                    Text("\(inspectedForm.titleZh) · T\(inspectedForm.baseBiteTier)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)
                    if let uiImg = SpriteAtlasManager.shared.sharkUIImage(for: inspectedForm.spriteKey) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 220, height: 115)
                            .shadow(color: .cyan.opacity(0.5), radius: 16)
                    }
                    Text(inspectedForm.nameZh)
                        .font(.system(size: 20, weight: .black))
                        .foregroundColor(.white)
                    Text(inspectedForm.traitZh)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                // Action Row
                HStack(spacing: 16) {
                    Button("◀ 上一阶") {
                        inspectedIndex = (inspectedIndex + 47) % 48
                    }
                    .buttonStyle(.bordered)

                    if vm.save.unlockedSharkIds.contains(inspectedForm.id) {
                        Button(vm.save.selectedSharkId == inspectedForm.id ? "✓ 当前出战" : "出战该鲨鱼") {
                            vm.save.selectedSharkId = inspectedForm.id
                            vm.recomputeCurrentSharkStats()
                            vm.persistSave()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    } else {
                        Button("破茧进化 (🪙\(inspectedForm.unlockCoins) · 🧬\(inspectedForm.unlockGenes))") {
                            if vm.save.bankedCoins >= inspectedForm.unlockCoins && vm.save.bankedGenes >= inspectedForm.unlockGenes {
                                vm.save.bankedCoins -= inspectedForm.unlockCoins
                                vm.save.bankedGenes -= inspectedForm.unlockGenes
                                vm.save.unlockedSharkIds.append(inspectedForm.id)
                                vm.save.sharkUpgradeLevels[inspectedForm.id] = 1
                                vm.save.selectedSharkId = inspectedForm.id
                                vm.recomputeCurrentSharkStats()
                                vm.persistSave()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.cyan)
                    }

                    Button("下一阶 ▶") {
                        inspectedIndex = (inspectedIndex + 1) % 48
                    }
                    .buttonStyle(.bordered)
                }

                // 180-Degree Continuous Dial Strip
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(GameConfigGenerated.sharkForms) { form in
                            let unlocked = vm.save.unlockedSharkIds.contains(form.id)
                            Button {
                                inspectedIndex = form.index
                            } label: {
                                VStack(spacing: 3) {
                                    if let img = SpriteAtlasManager.shared.sharkUIImage(for: form.spriteKey) {
                                        Image(uiImage: img)
                                            .resizable()
                                            .scaledToFit()
                                            .frame(width: 52, height: 34)
                                            .opacity(unlocked ? 1.0 : 0.38)
                                    }
                                    Text(form.nameZh)
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(inspectedIndex == form.index ? .cyan : .white.opacity(0.75))
                                }
                                .padding(6)
                                .background(
                                    Circle()
                                        .fill(inspectedIndex == form.index ? Color.cyan.opacity(0.22) : Color.clear)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 10)
            }
        }
        .onAppear {
            inspectedIndex = vm.activeSharkForm.index
        }
    }
}
