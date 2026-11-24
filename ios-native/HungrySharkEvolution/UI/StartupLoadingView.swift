import SwiftUI
import UIKit

// MARK: - Dynamic Interactive Startup Loading Overlay (Scheme A Hot-Replaceable Assets)
/// Eliminates the 0.3s ~ 3.0s startup black screen by rendering on frame 1 while `SpriteAtlasManager`
/// decodes 48 @3x sharks, slices 33 preys, and warms 12 ocean parallax layers on a background thread.
/// Hot-replaceable asset convention in `Resources/Assets`:
/// - `loading_background.png` (Loading backdrop / festival poster)
/// - `loading_logo.png` (Brand / game main title with Breathe Effect)
/// - `loading_mascot.png` (Mascot baby shark swimming along the progress bar from 0% -> 100%)
public struct StartupLoadingView: View {
    @ObservedObject var vm: GameViewModel
    @ObservedObject var atlasManager: SpriteAtlasManager

    public var body: some View {
        GeometryReader { geo in
            let fullW: CGFloat = max(geo.size.width, UIScreen.main.bounds.width)
            let fullH: CGFloat = max(geo.size.height, UIScreen.main.bounds.height)
            let barW: CGFloat = min(460.0, fullW * 0.62)
            let barH: CGFloat = 12.0
            let progress: Double = max(0.0, min(1.0, atlasManager.loadingProgress))

            TimelineView(.animation) { timeline in
                let t: Double = timeline.date.timeIntervalSinceReferenceDate
                loadingStageContent(
                    fullW: fullW,
                    fullH: fullH,
                    barW: barW,
                    barH: barH,
                    progress: progress,
                    t: t
                )
            }
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private func loadingStageContent(
        fullW: CGFloat,
        fullH: CGFloat,
        barW: CGFloat,
        barH: CGFloat,
        progress: Double,
        t: Double
    ) -> some View {
        ZStack {
            // 1. Base Abyssal Blue (#061528) matching UILaunchScreen LaunchBg 1:1
            Color(red: 6.0 / 255.0, green: 21.0 / 255.0, blue: 40.0 / 255.0)
                .ignoresSafeArea()

            // 2. Hot-Replaceable Loading Background Poster (loading_background.png)
            if let bgImg = atlasManager.loadingBackgroundImage() {
                Image(uiImage: bgImg)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFill()
                    .frame(width: fullW, height: fullH)
                    .clipped()
                    .ignoresSafeArea()
            }

            // 3. Procedural 60/120fps Caustic Light Rays & Rising Bioluminescent Bubbles
            Canvas { (ctx: inout GraphicsContext, size: CGSize) in
                drawUnderwaterAtmosphere(ctx: &ctx, size: size, t: t)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)

            // 4. Foreground Content: Breathing Brand Logo + Swimming Mascot Shark + Progress Bar
            VStack(spacing: 0) {
                Spacer(minLength: fullH * 0.08)
                brandLogoSection(fullW: fullW, fullH: fullH, t: t)
                Spacer()
                mascotAndProgressSection(barW: barW, barH: barH, fullH: fullH, progress: progress, t: t)
            }
        }
    }

    private func drawUnderwaterAtmosphere(ctx: inout GraphicsContext, size: CGSize, t: Double) {
        let widthD: Double = max(1.0, Double(size.width))
        let heightD: Double = max(1.0, Double(size.height))
        for rayIdx in 0..<5 {
            drawCausticRay(ctx: &ctx, widthD: widthD, heightD: heightD, t: t, rayIdx: rayIdx)
        }
        for bIdx in 0..<28 {
            drawRisingBubble(ctx: &ctx, widthD: widthD, heightD: heightD, t: t, bIdx: bIdx)
        }
    }

    private func drawCausticRay(
        ctx: inout GraphicsContext,
        widthD: Double,
        heightD: Double,
        t: Double,
        rayIdx: Int
    ) {
        let fi: Double = Double(rayIdx)
        let sway: Double = sin(t * 0.75 + fi * 1.15) * 36.0
        let anchorRatio: Double = 0.18 + fi * 0.16
        let topX: Double = widthD * anchorRatio + sway
        let rayW: Double = 55.0 + 18.0 * sin(t * 1.1 + fi)
        let bottomY: Double = heightD * 0.85

        var path = Path()
        path.move(to: CGPoint(x: topX - rayW * 0.45, y: -10.0))
        path.addLine(to: CGPoint(x: topX + rayW * 0.45, y: -10.0))
        path.addLine(to: CGPoint(x: topX + rayW * 1.45 + 45.0, y: bottomY))
        path.addLine(to: CGPoint(x: topX - rayW * 1.15 + 45.0, y: bottomY))
        path.closeSubpath()

        let rayAlpha: Double = 0.055 + 0.025 * sin(t * 1.4 + fi * 0.9)
        let cTop = Color(red: 56.0 / 255.0, green: 189.0 / 255.0, blue: 248.0 / 255.0).opacity(rayAlpha)
        let cMid = Color(red: 14.0 / 255.0, green: 165.0 / 255.0, blue: 233.0 / 255.0).opacity(rayAlpha * 0.35)
        let grad = Gradient(colors: [cTop, cMid, Color.clear])

        ctx.fill(
            path,
            with: .linearGradient(
                grad,
                startPoint: CGPoint(x: topX, y: 0.0),
                endPoint: CGPoint(x: topX + 35.0, y: bottomY)
            )
        )
    }

    private func drawRisingBubble(
        ctx: inout GraphicsContext,
        widthD: Double,
        heightD: Double,
        t: Double,
        bIdx: Int
    ) {
        let idxD: Double = Double(bIdx)
        let mod7D: Double = Double(bIdx % 7)
        let mod4D: Double = Double(bIdx % 4)
        let mod5D: Double = Double(bIdx % 5)

        let seed: Double = idxD * 137.5
        let speed: Double = 22.0 + mod7D * 6.5
        let cycleSpan: Double = heightD + 60.0
        let travelY: Double = (t * speed + seed).truncatingRemainder(dividingBy: cycleSpan)
        let rawY: Double = (heightD + 40.0) - travelY

        let baseX: Double = (seed * 3.7).truncatingRemainder(dividingBy: widthD)
        let wobbleAmp: Double = 8.0 + mod4D * 3.0
        let wobbleX: Double = sin(t * 2.1 + idxD) * wobbleAmp
        let bx: Double = baseX + wobbleX
        let radius: Double = 2.2 + mod5D * 1.35
        let diameter: Double = radius * 2.0
        let pulse: Double = 0.32 + 0.24 * sin(t * 2.8 + idxD)

        let bubbleRect = CGRect(x: bx - radius, y: rawY - radius, width: diameter, height: diameter)
        if bIdx % 3 == 0 {
            ctx.fill(
                Path(ellipseIn: bubbleRect),
                with: .color(Color.cyan.opacity(pulse * 0.75))
            )
        } else {
            let rimColor = Color(red: 186.0 / 255.0, green: 230.0 / 255.0, blue: 253.0 / 255.0).opacity(pulse)
            ctx.stroke(
                Path(ellipseIn: bubbleRect),
                with: .color(rimColor),
                lineWidth: 1.1
            )
            let specOffset: Double = radius * 0.45
            let specRect = CGRect(
                x: bx - specOffset,
                y: rawY - specOffset,
                width: specOffset,
                height: specOffset
            )
            ctx.fill(
                Path(ellipseIn: specRect),
                with: .color(Color.white.opacity(pulse * 0.9))
            )
        }
    }

    @ViewBuilder
    private func brandLogoSection(fullW: CGFloat, fullH: CGFloat, t: Double) -> some View {
        let breatheScale: CGFloat = CGFloat(1.0 + 0.028 * sin(t * 2.3))
        let floatOffsetY: CGFloat = CGFloat(sin(t * 1.7) * 4.5)
        let glowAlpha: Double = 0.42 + 0.18 * sin(t * 2.3)
        let titleAspect: CGFloat = 1323.0 / 371.0
        let maxWByHeight: CGFloat = (fullH * 0.34) * titleAspect
        let logoW: CGFloat = min(680.0, min(fullW * 0.70, maxWByHeight))
        let logoH: CGFloat = logoW / titleAspect

        if let logoImg = atlasManager.loadingLogoImage() {
            Image(uiImage: logoImg)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: logoW, height: logoH)
                .scaleEffect(breatheScale)
                .offset(y: floatOffsetY)
                .shadow(color: Color.cyan.opacity(glowAlpha), radius: 18, x: 0, y: 4)
                .shadow(color: Color.black.opacity(0.9), radius: 14, x: 0, y: 6)
        }
    }

    private func mascotAndProgressSection(
        barW: CGFloat,
        barH: CGFloat,
        fullH: CGFloat,
        progress: Double,
        t: Double
    ) -> some View {
        let mascotW: CGFloat = 68.0
        let mascotH: CGFloat = 42.0
        let progressCG: CGFloat = CGFloat(progress)
        let mascotX: CGFloat = -barW * 0.5 + barW * progressCG
        let swimPitch: Double = sin(t * 9.5) * 4.8
        let swimBobY: CGFloat = CGFloat(cos(t * 6.5) * 2.8)
        let fillW: CGFloat = max(barH, barW * progressCG)
        let pctInt: Int = Int((progress * 100.0).rounded())
        let stageText: String = vm.lang == "zh" ? atlasManager.loadingStageZh : atlasManager.loadingStageEn

        return VStack(spacing: 8) {
            ZStack {
                ForEach(0..<4, id: \.self) { wakeIdx in
                    mascotWakeBubble(wakeIdx: wakeIdx, mascotX: mascotX, swimBobY: swimBobY, t: t)
                }

                if let mascotImg = atlasManager.loadingMascotImage() {
                    Image(uiImage: mascotImg)
                        .resizable()
                        .interpolation(.high)
                        .scaledToFit()
                        .frame(width: mascotW, height: mascotH)
                        .rotationEffect(.degrees(swimPitch))
                        .offset(x: mascotX, y: swimBobY)
                        .shadow(color: Color.cyan.opacity(0.75), radius: 8, x: 0, y: 2)
                }
            }
            .frame(width: barW, height: mascotH + 6.0)
            .animation(.easeOut(duration: 0.22), value: progress)

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color(red: 2.0 / 255.0, green: 10.0 / 255.0, blue: 24.0 / 255.0).opacity(0.88))
                    .frame(width: barW, height: barH)
                    .overlay(
                        Capsule()
                            .stroke(Color.cyan.opacity(0.42), lineWidth: 1.2)
                    )

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 2.0 / 255.0, green: 132.0 / 255.0, blue: 199.0 / 255.0),
                                Color(red: 34.0 / 255.0, green: 211.0 / 255.0, blue: 238.0 / 255.0),
                                Color(red: 110.0 / 255.0, green: 231.0 / 255.0, blue: 183.0 / 255.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: fillW, height: barH - 2.0)
                    .padding(.leading, 1)
                    .shadow(color: Color.cyan.opacity(0.8), radius: 6)
                    .animation(.easeOut(duration: 0.22), value: progress)
            }
            .frame(width: barW, height: barH)

            HStack {
                Text(stageText)
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundColor(Color(red: 186.0 / 255.0, green: 230.0 / 255.0, blue: 253.0 / 255.0).opacity(0.92))
                Spacer()
                Text("\(pctInt)%")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundColor(.cyan)
            }
            .frame(width: barW)
        }
        .padding(.bottom, max(22.0, fullH * 0.07))
    }

    private func mascotWakeBubble(
        wakeIdx: Int,
        mascotX: CGFloat,
        swimBobY: CGFloat,
        t: Double
    ) -> some View {
        let wSeed: Double = Double(wakeIdx)
        let wakePhase: Double = (t * 3.8 + wSeed * 0.25).truncatingRemainder(dividingBy: 1.0)
        let bubbleAlpha: Double = (1.0 - wakePhase) * 0.75
        let bubbleDiameter: CGFloat = CGFloat(6.5 - wakePhase * 3.5)
        let trailDx: CGFloat = CGFloat(28.0 + wakePhase * 26.0)
        let trailDy: CGFloat = CGFloat(sin(t * 8.0 + wSeed) * 4.0)

        return Circle()
            .fill(Color.cyan.opacity(bubbleAlpha))
            .frame(width: bubbleDiameter, height: bubbleDiameter)
            .offset(x: mascotX - trailDx, y: swimBobY + trailDy)
    }
}
