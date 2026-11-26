import SwiftUI

public struct FixedEvolutionHudButton: View {
    @ObservedObject var vm: GameViewModel
    @ObservedObject private var atlasManager = SpriteAtlasManager.shared
    @State private var isPulsing: Bool = false

    public var body: some View {
        let _ = atlasManager.atlasRevision
        let canModifyFormal = vm.permanentProgressEligibility.allowSharkUnlockAndUpgrade
        let nextTarget = canModifyFormal ? GameRules.getNextEvolutionTarget(save: vm.save) : nil
        let evoReady = canModifyFormal && (nextTarget?.check.canUnlockNow ?? false)
        let targetForm = nextTarget?.form

        Button {
            vm.playUiTick()
            if evoReady {
                vm.evolveToNextReadySharkInRun()
            } else {
                vm.showEvolutionAtlas = true
            }
        } label: {
            ZStack {
                // 1. 特效：满足条件时的跳动光圈与金色/翠绿放射辉光
                if evoReady {
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [.yellow, .green, .mint, .yellow],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3.0
                        )
                        .frame(width: 58, height: 58)
                        .scaleEffect(isPulsing ? 1.15 : 1.0)
                        .opacity(isPulsing ? 1.0 : 0.45)
                        .shadow(color: .green.opacity(0.85), radius: isPulsing ? 10 : 4)

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.green.opacity(0.35), Color.clear],
                                center: .center,
                                startRadius: 4,
                                endRadius: 30
                            )
                        )
                        .frame(width: 60, height: 60)
                        .scaleEffect(isPulsing ? 1.12 : 0.95)
                }

                // 2. 底盘圆形
                Circle()
                    .fill(
                        evoReady
                            ? RadialGradient(
                                colors: [Color(red: 6/255, green: 78/255, blue: 59/255).opacity(0.95), Color(red: 2/255, green: 22/255, blue: 18/255).opacity(0.98)],
                                center: .center,
                                startRadius: 4,
                                endRadius: 28
                              )
                            : RadialGradient(
                                colors: [Color(red: 15/255, green: 23/255, blue: 42/255).opacity(0.92), Color(red: 4/255, green: 10/255, blue: 24/255).opacity(0.96)],
                                center: .center,
                                startRadius: 4,
                                endRadius: 28
                              )
                    )
                    .frame(width: 52, height: 52)
                    .overlay(
                        Circle()
                            .stroke(
                                evoReady ? Color.yellow : Color.cyan.opacity(0.4),
                                lineWidth: evoReady ? 2.2 : 1.5
                            )
                    )
                    .shadow(color: evoReady ? Color.yellow.opacity(0.65) : Color.black.opacity(0.5), radius: 6)

                // 3. 中心图标：满足条件时换成最近一条可进化的鲨鱼！不满足时显示进化图鉴图标
                if evoReady, let target = targetForm {
                    if let img = atlasManager.sharkUIImage(for: target.spriteKey) {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 28)
                            .shadow(color: .green, radius: 4)
                            .scaleEffect(isPulsing ? 1.08 : 0.96)
                    } else {
                        UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 36)
                    }
                } else {
                    UiAtlasIconView(iconKey: "UI_BTN_MORPH_EVOLVE", size: 34)
                        .opacity(0.85)
                }

                // 4. 上下方文案
                VStack(spacing: 0) {
                    Text(evoReady ? (vm.lang == "zh" ? "⚡立即进化" : "EVOLVE") : (vm.lang == "zh" ? "进化图鉴" : "ATLAS"))
                        .font(.system(size: 7.5, weight: .black))
                        .foregroundColor(evoReady ? .yellow : .white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 0.8)
                        .background(
                            Capsule()
                                .fill(Color.black.opacity(0.88))
                                .overlay(Capsule().stroke(evoReady ? Color.yellow.opacity(0.8) : Color.cyan.opacity(0.3), lineWidth: 0.8))
                        )

                    Spacer()

                    if evoReady, let target = targetForm {
                        Text(vm.lang == "zh" ? target.nameZh : target.nameEn)
                            .font(.system(size: 7.5, weight: .black))
                            .foregroundColor(Color(red: 167/255, green: 243/255, blue: 208/255))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 0.6)
                            .background(Capsule().fill(Color.black.opacity(0.9)))
                    } else if let target = targetForm {
                        Text("🪙\(target.unlockCoins)")
                            .font(.system(size: 7.5, weight: .black, design: .monospaced))
                            .foregroundColor(.gray)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 0.6)
                            .background(Capsule().fill(Color.black.opacity(0.85)))
                    } else {
                        Text("MAX")
                            .font(.system(size: 7.5, weight: .black, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                }
                .frame(height: 58)
            }
            .frame(width: 58, height: 60)
            .scaleEffect(evoReady && isPulsing ? 1.08 : 1.0)
            .onAppear {
                if evoReady {
                    withAnimation(.easeInOut(duration: 0.65).repeatForever(autoreverses: true)) {
                        isPulsing = true
                    }
                } else {
                    isPulsing = false
                }
            }
            .onChange(of: evoReady) { ready in
                if ready {
                    withAnimation(.easeInOut(duration: 0.65).repeatForever(autoreverses: true)) {
                        isPulsing = true
                    }
                } else {
                    withAnimation(.easeOut(duration: 0.15)) {
                        isPulsing = false
                    }
                }
            }
        }
        .buttonStyle(.plain)
    }
}

extension ContentView {
    // MARK: - Bottom-Right 90° MOBA Skill Fan (using UI_BTN_* from icons_f5128c12.png)
    func mobaSkillFan(rawSafeTrail: CGFloat = 0.0) -> some View {
        let form = vm.activeSharkForm
        let goldCost = GameRules.getGoldOverdriveCost(useCount: vm.goldOverdriveUseCount, generationRow: form.row)
        let geneCost = GameRules.getGeneSurgeCost(level: vm.inRunLevel, useCount: vm.geneSurgeUseCount, generationRow: form.row)
        let upCoinCost = GameRules.getSharkUpgradeCoinCost(form: form, currentLevel: vm.activeUpgradeLevel)
        let upGeneCost = GameRules.getSharkUpgradeGeneCost(form: form, currentLevel: vm.activeUpgradeLevel)
        let canModifyFormal = vm.permanentProgressEligibility.allowSharkUnlockAndUpgrade
        let canGold = vm.save.bankedCoins >= goldCost && !vm.frenzyActive
        let canGene = vm.save.bankedGenes >= geneCost
        let canUpgrade = canModifyFormal && vm.activeUpgradeLevel < 10 && vm.save.bankedCoins >= upCoinCost && vm.save.bankedGenes >= upGeneCost
        let nextTarget = canModifyFormal ? GameRules.getNextEvolutionTarget(save: vm.save) : nil
        let evoReady = canModifyFormal && (nextTarget?.check.canUnlockNow ?? false)

        // When anchored 24pt from the right corner on Dynamic Island / Notch iPhones,
        // nudge only the upper buttons (`y ≈ 192..318pt`) along the fan arc so they stay
        // 100% clear of the mid-height sensor housing (`y ≈ 152..278pt`).
        let isDynamicIsland = rawSafeTrail >= 48.0
        let isNotch = !isDynamicIsland && rawSafeTrail >= 34.0
        let evoOffsetX: CGFloat = isDynamicIsland ? -36.0 : (isNotch ? -28.0 : -4.0)
        let evoOffsetY: CGFloat = (isDynamicIsland || isNotch) ? -162.0 : -164.0
        let upgradeOffsetX: CGFloat = isDynamicIsland ? -14.0 : (isNotch ? -10.0 : -4.0)
        let surgeOffsetX: CGFloat = isDynamicIsland ? -78.0 : (isNotch ? -74.0 : -70.0)
        let frenzyOffsetX: CGFloat = (isDynamicIsland || isNotch) ? -96.0 : -98.0
        let airdropOffsetX: CGFloat = isDynamicIsland ? -142.0 : (isNotch ? -138.0 : -116.0)

        return ZStack(alignment: .bottomTrailing) {
            // 0. Fixed Evolution Button directly above Body Upgrade
            FixedEvolutionHudButton(vm: vm)
                .offset(x: evoOffsetX, y: evoOffsetY)

            // Optional Emergency Supply Drop when short on all resources
            if !canGold && !canGene && !canUpgrade && !evoReady {
                let drop = vm.currentSupplyDropReward
                skillFanSatelliteButton(
                    iconKey: "UI_ICON_GIFT",
                    label: vm.lang == "zh" ? "免费空投" : "AIRDROP",
                    costText: "📺+\(drop.coins)🪙+\(drop.genes)🧬",
                    ringColor: .yellow,
                    enabled: true,
                    pulse: true
                ) {
                    vm.showRewardedAd(kind: .SUPPLY_DROP)
                }
                .offset(x: airdropOffsetX, y: -70)
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
            .offset(x: frenzyOffsetX, y: -4)

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
            .offset(x: surgeOffsetX, y: -70)

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
            .offset(x: upgradeOffsetX, y: -98)

            // 4. Primary Bottom-Right Anchor: Isolated Hold-to-Boost Medallion (iOS-P1-1 + iOS-P1-2)
            BoostMedallionView(vm: vm, telemetry: vm.telemetry, resetToken: joystickResetToken)
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

    // MARK: - Pause Modal Overlay (100% replication of PauseModal in src/App.tsx using setting_83a7a273.png)
    func pauseModalOverlay(geo: GeometryProxy) -> some View {
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
    func gameOverModalOverlay(geo: GeometryProxy) -> some View {
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
                                vm.showRewardedAd(kind: .REVIVE)
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
                                    if vm.trialSharkIdForRun != nil {
                                        Text(vm.lang == "zh"
                                             ? "🪙 +\(vm.runCoinsEarned)   🧬 +\(vm.runGenesEarned)   试玩不计王冠/纪录"
                                             : "🪙 +\(vm.runCoinsEarned)   🧬 +\(vm.runGenesEarned)   Trial: No Crown/Record")
                                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                                            .foregroundColor(.yellow)
                                    } else {
                                        Text("🪙 +\(vm.runCoinsEarned)   🧬 +\(vm.runGenesEarned)   👑 \(vm.save.sharkMasteryTiers[form.id] ?? 0)/3")
                                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                                            .foregroundColor(.yellow)
                                        if let ms = vm.lastMasterySettlement, (ms.totalBonusCoins > 0 || ms.totalBonusGenes > 0) {
                                            Text(vm.lang == "zh"
                                                 ? "👑 王冠结算: +\(ms.totalBonusCoins)🪙 +\(ms.totalBonusGenes)🧬 (不参与翻倍)"
                                                 : "👑 Crown Bonus: +\(ms.totalBonusCoins)🪙 +\(ms.totalBonusGenes)🧬 (Not 2x)")
                                                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                                                .foregroundColor(.mint)
                                        }
                                    }
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
                        let canDoubleReward = vm.permanentProgressEligibility.allowDoubleSettlementAd
                            && !vm.settlementDoubled
                            && (vm.runCoinsEarned > 0 || vm.runGenesEarned > 0)
                        HStack(spacing: 6) {
                            UiSettingButtonView(
                                variantKey: "SETTING_BTN_SOUND",
                                label: !vm.permanentProgressEligibility.allowDoubleSettlementAd
                                    ? (vm.lang == "zh" ? "试玩不可翻倍" : "TRIAL: NO 2X")
                                    : vm.settlementDoubled
                                    ? (vm.lang == "zh" ? "✓ 已翻倍领取" : "✓ 2X CLAIMED")
                                    : (vm.lang == "zh" ? "📺 奖励×2倍" : "📺 2X BOUNTY"),
                                sublabel: !vm.permanentProgressEligibility.allowDoubleSettlementAd
                                    ? (vm.lang == "zh" ? "本局奖励已保留" : "Harvest Kept")
                                    : "+🪙\(vm.runCoinsEarned) +🧬\(vm.runGenesEarned)",
                                customIconText: "📺",
                                width: thirdW,
                                height: btnH,
                                disabled: !canDoubleReward
                            ) {
                                vm.showRewardedAd(kind: .DOUBLE_SETTLEMENT)
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

    // MARK: - Ad Unavailable Alert Modal (Replaces 3s simulation on iOS)
    func adUnavailableAlertModal(message: String) -> some View {
        ZStack {
            Color.black.opacity(0.82)
                .ignoresSafeArea()
                .onTapGesture {
                    vm.dismissAdUnavailableAlert()
                }

            VStack(spacing: 16) {
                // Header Icon & Title
                VStack(spacing: 8) {
                    Text("📺")
                        .font(.system(size: 38))
                    Text(vm.lang == "zh" ? "广告提示" : "Ad Notice")
                        .font(.system(size: 20, weight: .black))
                        .foregroundColor(.white)
                }

                // Description
                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color(red: 224/255, green: 242/255, blue: 254/255))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)

                // Close / Acknowledge Button
                Button {
                    vm.dismissAdUnavailableAlert()
                } label: {
                    Text(vm.lang == "zh" ? "知道了" : "Dismiss")
                        .font(.system(size: 15, weight: .black))
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            LinearGradient(
                                colors: [Color.yellow, Color(red: 245/255, green: 158/255, blue: 11/255)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .cornerRadius(22)
                        .shadow(color: Color.yellow.opacity(0.4), radius: 6, x: 0, y: 2)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .padding(.top, 4)
            }
            .padding(24)
            .frame(width: 320)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(red: 15/255, green: 23/255, blue: 42/255).opacity(0.96))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.white.opacity(0.18), lineWidth: 1.5)
                    )
            )
            .shadow(color: .black.opacity(0.6), radius: 24, x: 0, y: 10)
        }
    }
}
