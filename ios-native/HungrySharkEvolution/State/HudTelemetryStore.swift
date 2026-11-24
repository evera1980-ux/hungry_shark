import Foundation
import SwiftUI
import QuartzCore

/// Isolated high-frequency HUD telemetry store (iOS-P1-1).
/// Subscribed ONLY by lightweight leaf HUD views (HP/Energy bar, depth readout, combo/frenzy banner,
/// boost ring, onboarding boost timer) so continuous 60Hz simulation ticks NEVER trigger root `ContentView` diffs.
@MainActor
public final class HudTelemetryStore: ObservableObject {
    @Published public var hp: Double = 100
    @Published public var maxHp: Double = 100
    @Published public var ghostHpPct: Double = 100
    @Published public var energy: Double = 100
    @Published public var maxEnergy: Double = 100
    @Published public var depthMeters: Int = 22
    @Published public var deepDivePromptMeters: Int? = nil
    @Published public var comboCount: Int = 0
    @Published public var frenzyActive: Bool = false
    @Published public var frenzyTimer: Double = 0
    @Published public var onboardingBoostSeconds: Double = 0

    private var lastPushTimestamp: TimeInterval = 0
    private let minSyncInterval: TimeInterval = 1.0 / 18.0 // ~18Hz smooth HUD refresh ceiling

    public init() {}

    /// Immediately resets or pushes all HUD telemetry (used on run start, level up, frenzy toggle, damage spike, death).
    public func pushImmediate(
        hp: Double,
        maxHp: Double,
        ghostHpPct: Double,
        energy: Double,
        maxEnergy: Double,
        depthMeters: Int,
        deepDivePromptMeters: Int?,
        comboCount: Int,
        frenzyActive: Bool,
        frenzyTimer: Double,
        onboardingBoostSeconds: Double,
        timestamp: TimeInterval = CACurrentMediaTime()
    ) {
        lastPushTimestamp = timestamp
        applyChanges(
            hp: hp,
            maxHp: maxHp,
            ghostHpPct: ghostHpPct,
            energy: energy,
            maxEnergy: maxEnergy,
            depthMeters: depthMeters,
            deepDivePromptMeters: deepDivePromptMeters,
            comboCount: comboCount,
            frenzyActive: frenzyActive,
            frenzyTimer: frenzyTimer,
            onboardingBoostSeconds: onboardingBoostSeconds
        )
    }

    /// Throttled telemetry push called from the SpriteKit simulation loop (`update(_:)`).
    /// Bypasses throttle automatically when discrete visual states change (combo, frenzy, deep-dive prompt).
    public func syncThrottled(
        hp: Double,
        maxHp: Double,
        ghostHpPct: Double,
        energy: Double,
        maxEnergy: Double,
        depthMeters: Int,
        deepDivePromptMeters: Int?,
        comboCount: Int,
        frenzyActive: Bool,
        frenzyTimer: Double,
        onboardingBoostSeconds: Double,
        timestamp: TimeInterval
    ) {
        let discreteChanged =
            comboCount != self.comboCount ||
            frenzyActive != self.frenzyActive ||
            deepDivePromptMeters != self.deepDivePromptMeters

        if !discreteChanged && (timestamp - lastPushTimestamp) < minSyncInterval {
            return
        }
        lastPushTimestamp = timestamp
        applyChanges(
            hp: hp,
            maxHp: maxHp,
            ghostHpPct: ghostHpPct,
            energy: energy,
            maxEnergy: maxEnergy,
            depthMeters: depthMeters,
            deepDivePromptMeters: deepDivePromptMeters,
            comboCount: comboCount,
            frenzyActive: frenzyActive,
            frenzyTimer: frenzyTimer,
            onboardingBoostSeconds: onboardingBoostSeconds
        )
    }

    private func applyChanges(
        hp: Double,
        maxHp: Double,
        ghostHpPct: Double,
        energy: Double,
        maxEnergy: Double,
        depthMeters: Int,
        deepDivePromptMeters: Int?,
        comboCount: Int,
        frenzyActive: Bool,
        frenzyTimer: Double,
        onboardingBoostSeconds: Double
    ) {
        if abs(self.hp - hp) >= 0.45 || (hp <= 0 && self.hp > 0) || (hp >= maxHp && self.hp < maxHp) {
            self.hp = hp
        }
        if abs(self.maxHp - maxHp) >= 0.5 {
            self.maxHp = maxHp
        }
        if abs(self.ghostHpPct - ghostHpPct) >= 0.45 {
            self.ghostHpPct = ghostHpPct
        }
        if abs(self.energy - energy) >= 0.45 || (energy <= 0 && self.energy > 0) || (energy >= maxEnergy && self.energy < maxEnergy) {
            self.energy = energy
        }
        if abs(self.maxEnergy - maxEnergy) >= 0.5 {
            self.maxEnergy = maxEnergy
        }
        if self.depthMeters != depthMeters {
            self.depthMeters = depthMeters
        }
        if self.deepDivePromptMeters != deepDivePromptMeters {
            self.deepDivePromptMeters = deepDivePromptMeters
        }
        if self.comboCount != comboCount {
            self.comboCount = comboCount
        }
        if self.frenzyActive != frenzyActive {
            self.frenzyActive = frenzyActive
        }
        if abs(self.frenzyTimer - frenzyTimer) >= 0.08 || (!frenzyActive && self.frenzyTimer != 0) {
            self.frenzyTimer = frenzyActive ? max(0.0, frenzyTimer) : 0.0
        }
        if abs(self.onboardingBoostSeconds - onboardingBoostSeconds) >= 0.08 {
            self.onboardingBoostSeconds = onboardingBoostSeconds
        }
    }
}
