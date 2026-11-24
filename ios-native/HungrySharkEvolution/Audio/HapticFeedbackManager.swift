import UIKit
import QuartzCore

/// Singleton reusable Taptic Engine manager (iOS-P1-1).
/// Reuses pre-allocated `UIImpactFeedbackGenerator` & `UINotificationFeedbackGenerator` instances
/// with `.prepare()` and rate limiting so rapid multi-fish devouring produces zero per-frame allocations.
@MainActor
public final class HapticFeedbackManager {
    public static let shared = HapticFeedbackManager()

    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let notification = UINotificationFeedbackGenerator()

    private var lastLightAt: CFTimeInterval = 0
    private var lastHeavyAt: CFTimeInterval = 0
    private var lastNotifyAt: CFTimeInterval = 0

    private init() {
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()
        notification.prepare()
    }

    public func prepareAll() {
        lightImpact.prepare()
        heavyImpact.prepare()
        notification.prepare()
    }

    public func playLight(minInterval: CFTimeInterval = 0.04) {
        let now = CACurrentMediaTime()
        guard now - lastLightAt >= minInterval else { return }
        lastLightAt = now
        lightImpact.impactOccurred()
        lightImpact.prepare()
    }

    public func playMedium(minInterval: CFTimeInterval = 0.05) {
        let now = CACurrentMediaTime()
        guard now - lastLightAt >= minInterval else { return }
        lastLightAt = now
        mediumImpact.impactOccurred()
        mediumImpact.prepare()
    }

    public func playHeavy(minInterval: CFTimeInterval = 0.08) {
        let now = CACurrentMediaTime()
        guard now - lastHeavyAt >= minInterval else { return }
        lastHeavyAt = now
        heavyImpact.impactOccurred()
        heavyImpact.prepare()
    }

    public func playNotification(_ type: UINotificationFeedbackGenerator.FeedbackType, minInterval: CFTimeInterval = 0.09) {
        let now = CACurrentMediaTime()
        guard now - lastNotifyAt >= minInterval else { return }
        lastNotifyAt = now
        notification.notificationOccurred(type)
        notification.prepare()
    }
}
