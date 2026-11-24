import SwiftUI
import UIKit

/// Native UIKit Multi-Touch Sonar Joystick (`iOS-P1-2`).
/// - Enables `isMultipleTouchEnabled = true` and `isExclusiveTouch = false` so the player can steer with
///   their left thumb while simultaneously tapping MOBA skills or holding Boost with their right hand.
/// - Tracks an explicit `UITouch` identity and guarantees clean reset on `touchesCancelled` / `willMove(toWindow: nil)`.
/// - Animates knob movement purely inside UIKit (`knobView.center`), eliminating SwiftUI redraw overhead during steering.
public struct UIKitSonarJoystickView: UIViewRepresentable {
    public let baseImage: UIImage?
    public let knobImage: UIImage?
    public let resetToken: Int
    public let onVectorChange: (_ dx: CGFloat, _ dy: CGFloat, _ active: Bool) -> Void
    public let onDraggingStateChange: (_ dragging: Bool) -> Void

    public init(
        baseImage: UIImage?,
        knobImage: UIImage?,
        resetToken: Int,
        onVectorChange: @escaping (_ dx: CGFloat, _ dy: CGFloat, _ active: Bool) -> Void,
        onDraggingStateChange: @escaping (_ dragging: Bool) -> Void = { _ in }
    ) {
        self.baseImage = baseImage
        self.knobImage = knobImage
        self.resetToken = resetToken
        self.onVectorChange = onVectorChange
        self.onDraggingStateChange = onDraggingStateChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(resetToken: resetToken)
    }

    public func makeUIView(context: Context) -> TouchJoystickPadUIView {
        let view = TouchJoystickPadUIView()
        view.baseImage = baseImage
        view.knobImage = knobImage
        view.onVectorChange = onVectorChange
        view.onDraggingStateChange = onDraggingStateChange
        return view
    }

    public func updateUIView(_ uiView: TouchJoystickPadUIView, context: Context) {
        uiView.baseImage = baseImage
        uiView.knobImage = knobImage
        uiView.onVectorChange = onVectorChange
        uiView.onDraggingStateChange = onDraggingStateChange
        if context.coordinator.lastResetToken != resetToken {
            context.coordinator.lastResetToken = resetToken
            uiView.forceReset()
        }
    }

    public final class Coordinator {
        var lastResetToken: Int
        init(resetToken: Int) {
            self.lastResetToken = resetToken
        }
    }
}

public final class TouchJoystickPadUIView: UIView {
    public var baseImage: UIImage? {
        didSet {
            if baseImageView.image !== baseImage {
                baseImageView.image = baseImage
            }
        }
    }
    public var knobImage: UIImage? {
        didSet {
            if knobImageView.image !== knobImage {
                knobImageView.image = knobImage
            }
        }
    }
    public var onVectorChange: ((_ dx: CGFloat, _ dy: CGFloat, _ active: Bool) -> Void)?
    public var onDraggingStateChange: ((_ dragging: Bool) -> Void)?

    private let baseImageView = UIImageView()
    private let ringLayer = CAShapeLayer()
    private let knobImageView = UIImageView()

    private weak var activeTouch: UITouch?
    private let maxKnobRadius: CGFloat = 42.0

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupSubviews()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupSubviews()
    }

    private func setupSubviews() {
        backgroundColor = .clear
        isMultipleTouchEnabled = true
        isExclusiveTouch = false

        baseImageView.contentMode = .scaleAspectFit
        baseImageView.alpha = 0.78
        baseImageView.isUserInteractionEnabled = false
        addSubview(baseImageView)

        ringLayer.fillColor = UIColor.clear.cgColor
        ringLayer.strokeColor = UIColor.cyan.withAlphaComponent(0.18).cgColor
        ringLayer.lineWidth = 1.0
        layer.addSublayer(ringLayer)

        knobImageView.contentMode = .scaleAspectFit
        knobImageView.isUserInteractionEnabled = false
        knobImageView.layer.shadowColor = UIColor.cyan.cgColor
        knobImageView.layer.shadowOpacity = 0.35
        knobImageView.layer.shadowRadius = 8.0
        knobImageView.layer.shadowOffset = .zero
        addSubview(knobImageView)
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        let centerPt = CGPoint(x: bounds.midX, y: bounds.midY)
        baseImageView.frame = CGRect(x: centerPt.x - 59, y: centerPt.y - 59, width: 118, height: 118)
        let ringRect = CGRect(x: centerPt.x - 41, y: centerPt.y - 41, width: 82, height: 82)
        ringLayer.path = UIBezierPath(ovalIn: ringRect).cgPath
        if activeTouch == nil {
            knobImageView.frame = CGRect(x: centerPt.x - 29, y: centerPt.y - 29, width: 58, height: 58)
        } else {
            knobImageView.bounds = CGRect(x: 0, y: 0, width: 58, height: 58)
        }
    }

    public override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let centerPt = CGPoint(x: bounds.midX, y: bounds.midY)
        let hitRadius = max(bounds.width, bounds.height) * 0.54
        return hypot(point.x - centerPt.x, point.y - centerPt.y) <= hitRadius
    }

    public override func willMove(toWindow newWindow: UIWindow?) {
        super.willMove(toWindow: newWindow)
        if newWindow == nil {
            forceReset()
        }
    }

    public func forceReset() {
        let wasActive = activeTouch != nil
        activeTouch = nil
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        baseImageView.alpha = 0.78
        ringLayer.strokeColor = UIColor.cyan.withAlphaComponent(0.18).cgColor
        knobImageView.layer.shadowOpacity = 0.35
        knobImageView.center = CGPoint(x: bounds.midX, y: bounds.midY)
        CATransaction.commit()
        onVectorChange?(0, 0, false)
        if wasActive {
            onDraggingStateChange?(false)
        }
    }

    public override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if activeTouch == nil, let touch = touches.first {
            activeTouch = touch
            setActiveAppearance(true)
            updateVector(for: touch.location(in: self))
            onDraggingStateChange?(true)
        }
    }

    public override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active) else { return }
        updateVector(for: active.location(in: self))
    }

    public override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active) else { return }
        forceReset()
    }

    public override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active) else { return }
        forceReset()
    }

    private func setActiveAppearance(_ active: Bool) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        baseImageView.alpha = active ? 0.96 : 0.78
        ringLayer.strokeColor = UIColor.cyan.withAlphaComponent(active ? 0.45 : 0.18).cgColor
        knobImageView.layer.shadowOpacity = active ? 0.85 : 0.35
        CATransaction.commit()
    }

    private func updateVector(for loc: CGPoint) {
        let centerPt = CGPoint(x: bounds.midX, y: bounds.midY)
        let dx = loc.x - centerPt.x
        let dy = loc.y - centerPt.y
        let dist = max(0.001, hypot(dx, dy))
        let clampedDist = min(maxKnobRadius, dist)
        let nx = dx / dist
        let ny = dy / dist

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        knobImageView.center = CGPoint(
            x: centerPt.x + nx * clampedDist,
            y: centerPt.y + ny * clampedDist
        )
        CATransaction.commit()

        let ratio = clampedDist / maxKnobRadius
        onVectorChange?(nx * ratio, ny * ratio, true)
    }
}

/// Native UIKit Multi-Touch Hold Overlay (`iOS-P1-2`).
/// Captures hold press state independently of SwiftUI gesture recognition so holding Boost with the right hand
/// never conflicts with steering on the left-hand `UIKitSonarJoystickView`.
public struct UIKitHoldTouchOverlay: UIViewRepresentable {
    public let resetToken: Int
    public let onPressChange: (_ pressing: Bool) -> Void

    public init(resetToken: Int = 0, onPressChange: @escaping (_ pressing: Bool) -> Void) {
        self.resetToken = resetToken
        self.onPressChange = onPressChange
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(resetToken: resetToken)
    }

    public func makeUIView(context: Context) -> HoldTouchPadUIView {
        let view = HoldTouchPadUIView()
        view.onPressChange = onPressChange
        return view
    }

    public func updateUIView(_ uiView: HoldTouchPadUIView, context: Context) {
        uiView.onPressChange = onPressChange
        if context.coordinator.lastResetToken != resetToken {
            context.coordinator.lastResetToken = resetToken
            uiView.forceReset()
        }
    }

    public final class Coordinator {
        var lastResetToken: Int
        init(resetToken: Int) {
            self.lastResetToken = resetToken
        }
    }
}

public final class HoldTouchPadUIView: UIView {
    public var onPressChange: ((_ pressing: Bool) -> Void)?
    private weak var activeTouch: UITouch?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isMultipleTouchEnabled = true
        isExclusiveTouch = false
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .clear
        isMultipleTouchEnabled = true
        isExclusiveTouch = false
    }

    public override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let centerPt = CGPoint(x: bounds.midX, y: bounds.midY)
        let r = min(bounds.width, bounds.height) * 0.56
        return hypot(point.x - centerPt.x, point.y - centerPt.y) <= r
    }

    public override func willMove(toWindow newWindow: UIWindow?) {
        super.willMove(toWindow: newWindow)
        if newWindow == nil {
            forceReset()
        }
    }

    public func forceReset() {
        let wasActive = activeTouch != nil
        activeTouch = nil
        if wasActive {
            onPressChange?(false)
        }
    }

    public override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if activeTouch == nil, let touch = touches.first {
            activeTouch = touch
            onPressChange?(true)
        }
    }

    public override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active) else { return }
        forceReset()
    }

    public override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let active = activeTouch, touches.contains(active) else { return }
        forceReset()
    }
}
