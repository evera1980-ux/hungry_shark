import UIKit
import SpriteKit
import CoreGraphics

public struct AvatarBarHollowMetrics: Sendable {
    public let cxPct: CGFloat
    public let cyPct: CGFloat
    public let innerDiaPctH: CGFloat
    public let outerDiaPctH: CGFloat
    public let aspectRatio: CGFloat
}

/// Pure Native CoreGraphics Offscreen Sprite Sheet Processor & Texture Cache
/// Performs perimeter BFS flood-fill + Color-to-Alpha boundary unmixing on the 4K shark atlas,
/// prey sheets, 6x4 UI icon sheet, banner button sheet (buttons_16e3a0cf), setting modal sheet (setting_83a7a273),
/// and ocean parallax layers without any WebView dependency.
@MainActor
public final class SpriteAtlasManager {
    public static let shared = SpriteAtlasManager()

    private var sharkTextures: [String: SKTexture] = [:]
    private var sharkUIImages: [String: UIImage] = [:]
    private var preyTextures: [String: SKTexture] = [:]
    private var preyUIImages: [String: UIImage] = [:]
    private var uiIconImages: [String: UIImage] = [:]
    private var uiBannerImages: [String: UIImage] = [:]
    private var uiSettingImages: [String: UIImage] = [:]
    private var uiSettingIconImages: [String: UIImage] = [:]
    private var oceanLayerTextures: [String: SKTexture] = [:]
    private var isPreloaded = false

    public private(set) var avatarBarHollowMetrics = AvatarBarHollowMetrics(
        cxPct: 23.0,
        cyPct: 48.0,
        innerDiaPctH: 48.0,
        outerDiaPctH: 60.0,
        aspectRatio: 2.85
    )

    private init() {}

    public func preloadAllIfNeeded() {
        guard !isPreloaded else { return }
        isPreloaded = true

        // 1. Slice 48-Form 4K Shark Sprite Sheet (sharks_ec921c3b.png)
        if let sharkSheet = loadBundledImage(named: "sharks_ec921c3b") {
            sliceSharkSheet(sharkSheet)
        }

        // 2. Slice Prey Sprite Sheets (fish_24bdaa5a.png & fish2_fc857cfa.png)
        let primarySheet = loadBundledImage(named: "fish_24bdaa5a")
        let fish2Sheet = loadBundledImage(named: "fish2_fc857cfa")
        for prey in GameConfigGenerated.preyTiers {
            if preyTextures[prey.spriteKey] != nil { continue }
            let srcImg = prey.sheetName == "fish2_fc857cfa" ? fish2Sheet : primarySheet
            if let img = srcImg,
               let sliced = sliceAndKeyNormalizedCell(
                   from: img,
                   bounds: prey.normalizedBounds,
                   preserveInteriorWhite: false
               ) {
                preyUIImages[prey.spriteKey] = sliced
                let tex = SKTexture(image: sliced)
                tex.filteringMode = .linear
                preyTextures[prey.spriteKey] = tex
            }
        }

        // 3. Slice 6x4 UI Icon Sheet (icons_f5128c12.png) with hollow ring seeding & 128x128 normalization
        if let iconSheet = loadBundledImage(named: "icons_f5128c12") {
            sliceUiIconSheet(iconSheet)
        }

        // 4. Slice Home/HUD Banner & Avatar Plate Sheet (buttons_16e3a0cf.png)
        if let bannerSheet = loadBundledImage(named: "buttons_16e3a0cf") {
            sliceUiBannerSheet(bannerSheet)
        }

        // 5. Slice Pause/Settings/GameOver Sci-Fi Modal & Octagonal Button Sheet (setting_83a7a273.png)
        if let settingSheet = loadBundledImage(named: "setting_83a7a273") {
            sliceUiSettingSheet(settingSheet)
        }
    }

    public func sharkTexture(for spriteKey: String) -> SKTexture? {
        preloadAllIfNeeded()
        return sharkTextures[spriteKey]
    }

    public func sharkUIImage(for spriteKey: String) -> UIImage? {
        preloadAllIfNeeded()
        return sharkUIImages[spriteKey]
    }

    public func preyTexture(for spriteKey: String) -> SKTexture? {
        preloadAllIfNeeded()
        return preyTextures[spriteKey]
    }

    public func preyUIImage(for spriteKey: String) -> UIImage? {
        preloadAllIfNeeded()
        return preyUIImages[spriteKey]
    }

    public func uiIconImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiIconImages[key]
    }

    public func uiBannerImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiBannerImages[key]
    }

    public func uiSettingImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiSettingImages[key]
    }

    public func uiSettingIconImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiSettingIconImages[key]
    }

    public func oceanParallaxTexture(named assetName: String, isWaterCanopy: Bool = false) -> SKTexture? {
        if let cached = oceanLayerTextures[assetName] {
            return cached
        }
        guard let rawImg = loadBundledImage(named: assetName) else { return nil }
        let processed: UIImage
        if isWaterCanopy {
            processed = processWaterLayerToSeamlessTile(rawImg, assetName: assetName) ?? rawImg
        } else {
            processed = processTerrainLayerToSeamlessStrip(rawImg, assetName: assetName) ?? rawImg
        }
        let tex = SKTexture(image: processed)
        tex.filteringMode = .linear
        oceanLayerTextures[assetName] = tex
        return tex
    }

    private func loadBundledImage(named name: String) -> UIImage? {
        if let img = UIImage(named: name) { return img }
        if let path = Bundle.main.path(forResource: name, ofType: "png"),
           let img = UIImage(contentsOfFile: path) {
            return img
        }
        if let path = Bundle.main.path(forResource: name, ofType: "png", inDirectory: "Assets"),
           let img = UIImage(contentsOfFile: path) {
            return img
        }
        return nil
    }

    private func sliceSharkSheet(_ sheetImage: UIImage) {
        for form in GameConfigGenerated.sharkForms {
            if let sliced = sliceAndKeyNormalizedCell(
                from: sheetImage,
                bounds: form.normalizedBounds,
                preserveInteriorWhite: form.index == 0
            ) {
                sharkUIImages[form.spriteKey] = sliced
                let tex = SKTexture(image: sliced)
                tex.filteringMode = .linear
                sharkTextures[form.spriteKey] = tex
            }
        }
    }

    /// Slices the 6x4 UI Icon Sheet (icons_f5128c12.png) with center hollow seed for UI_AVATAR_FRAME & UI_JOYSTICK_BASE
    /// and tight bounding-box aspect-fit normalization into a 128x128 square UIImage.
    private func sliceUiIconSheet(_ sheetImage: UIImage) {
        guard let cgSheet = sheetImage.cgImage else { return }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)
        let cols = 6.0
        let rows = 4.0
        let padX = (fullW / cols) * 0.025
        let padY = (fullH / rows) * 0.025
        let outSize = 128

        for (key, grid) in GameConfigGenerated.uiIconGridMap {
            let row = Double(grid.x)
            let col = Double(grid.y)
            let sx = max(0, Int((col * (fullW / cols) + padX).rounded(.down)))
            let sy = max(0, Int((row * (fullH / rows) + padY).rounded(.down)))
            let cellW = max(1, min(cgSheet.width - sx, Int((fullW / cols - padX * 2.0).rounded(.down))))
            let cellH = max(1, min(cgSheet.height - sy, Int((fullH / rows - padY * 2.0).rounded(.down))))

            guard let cropped = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else { continue }
            let w = cellW
            let h = cellH
            var rgba = [UInt8](repeating: 0, count: w * h * 4)
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue

            guard let ctx = CGContext(
                data: &rgba,
                width: w,
                height: h,
                bitsPerComponent: 8,
                bytesPerRow: w * 4,
                space: colorSpace,
                bitmapInfo: bitmapInfo
            ) else { continue }
            ctx.interpolationQuality = .high
            ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))

            var visited = [UInt8](repeating: 0, count: w * h)
            var queue = [Int](repeating: 0, count: w * h)
            var qHead = 0
            var qTail = 0

            func isNeutralWhiteBg(_ idx: Int) -> Bool {
                let p = idx * 4
                if rgba[p + 3] < 16 { return true }
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let maxC = max(r, max(g, b))
                let minC = min(r, min(g, b))
                return minC >= 218 && (maxC - minC) <= 28
            }

            func enqueue(_ x: Int, _ y: Int) {
                if x < 0 || x >= w || y < 0 || y >= h { return }
                let i = y * w + x
                if visited[i] != 0 || !isNeutralWhiteBg(i) { return }
                visited[i] = 1
                queue[qTail] = i
                qTail += 1
            }

            for x in 0..<w {
                enqueue(x, 0)
                enqueue(x, h - 1)
            }
            for y in 0..<h {
                enqueue(0, y)
                enqueue(w - 1, y)
            }

            // Hollow ring center seed for UI_AVATAR_FRAME and UI_JOYSTICK_BASE
            if key == "UI_AVATAR_FRAME" || key == "UI_JOYSTICK_BASE" {
                let cx = w / 2
                let cy = h / 2
                for dy in -4...4 {
                    for dx in -4...4 {
                        enqueue(cx + dx, cy + dy)
                    }
                }
            }

            while qHead < qTail {
                let curr = queue[qHead]
                qHead += 1
                let p = curr * 4
                rgba[p] = 0
                rgba[p + 1] = 0
                rgba[p + 2] = 0
                rgba[p + 3] = 0
                let cx = curr % w
                let cy = (curr - cx) / w
                if cx > 0 { enqueue(cx - 1, cy) }
                if cx + 1 < w { enqueue(cx + 1, cy) }
                if cy > 0 { enqueue(cx, cy - 1) }
                if cy + 1 < h { enqueue(cx, cy + 1) }
            }

            // Boundary white halo unmixing + tight bounding box measurement
            var minX = w
            var minY = h
            var maxX = 0
            var maxY = 0

            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if x > 0 && x + 1 < w && y > 0 && y + 1 < h {
                        if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
                            let r = Double(rgba[p])
                            let g = Double(rgba[p + 1])
                            let b = Double(rgba[p + 2])
                            let minC = min(r, min(g, b))
                            if minC > 150.0 {
                                let cleanAlpha = max(0.0, min(1.0, (250.0 - minC) / 100.0))
                                rgba[p] = UInt8((r * cleanAlpha).rounded())
                                rgba[p + 1] = UInt8((g * cleanAlpha).rounded())
                                rgba[p + 2] = UInt8((b * cleanAlpha).rounded())
                                rgba[p + 3] = UInt8((Double(rgba[p + 3]) * cleanAlpha).rounded())
                            }
                        }
                    }
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }

            guard let keyedCG = ctx.makeImage() else { continue }
            if maxX >= minX && maxY >= minY {
                let bw = max(1, maxX - minX + 1)
                let bh = max(1, maxY - minY + 1)
                if let tightCG = keyedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    let pad: CGFloat = 4.0
                    let avail = CGFloat(outSize) - pad * 2.0
                    let scale = min(avail / CGFloat(bw), avail / CGFloat(bh))
                    let drawW = CGFloat(bw) * scale
                    let drawH = CGFloat(bh) * scale
                    let drawX = (CGFloat(outSize) - drawW) * 0.5
                    let drawY = (CGFloat(outSize) - drawH) * 0.5

                    let format = UIGraphicsImageRendererFormat()
                    format.scale = 1.0
                    format.opaque = false
                    let renderer = UIGraphicsImageRenderer(size: CGSize(width: outSize, height: outSize), format: format)
                    let normImg = renderer.image { rCtx in
                        UIImage(cgImage: tightCG).draw(in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
                    }
                    uiIconImages[key] = normImg
                    continue
                }
            }
            uiIconImages[key] = UIImage(cgImage: keyedCG)
        }
    }

    /// Slices the Banner & Avatar Plate Sheet (buttons_16e3a0cf.png)
    /// Neutral dark grey background (~RGB 60,60,60), hollowing out the circular shark window in UI_PLATE_AVATAR_BAR.
    private func sliceUiBannerSheet(_ sheetImage: UIImage) {
        guard let cgSheet = sheetImage.cgImage else { return }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)

        for (key, bounds) in GameConfigGenerated.uiBannerBounds {
            let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
            let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
            let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
            let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))

            guard let cropped = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else { continue }
            let w = cellW
            let h = cellH
            var rgba = [UInt8](repeating: 0, count: w * h * 4)
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue

            guard let ctx = CGContext(
                data: &rgba,
                width: w,
                height: h,
                bitsPerComponent: 8,
                bytesPerRow: w * 4,
                space: colorSpace,
                bitmapInfo: bitmapInfo
            ) else { continue }
            ctx.interpolationQuality = .high
            ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))

            let cornerR = Int(rgba[0])
            let cornerG = Int(rgba[1])
            let cornerB = Int(rgba[2])
            let bgR = (cornerR > 25 && cornerR < 105) ? cornerR : 60
            let bgG = (cornerG > 25 && cornerG < 105) ? cornerG : 60
            let bgB = (cornerB > 25 && cornerB < 105) ? cornerB : 60

            var visited = [UInt8](repeating: 0, count: w * h)
            var queue = [Int](repeating: 0, count: w * h)
            var qHead = 0
            var qTail = 0

            func isNeutralStudioGrey(_ idx: Int) -> Bool {
                let p = idx * 4
                if rgba[p + 3] < 16 { return true }
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let maxC = max(r, max(g, b))
                let minC = min(r, min(g, b))
                let chroma = maxC - minC
                let diff = max(abs(r - bgR), max(abs(g - bgG), abs(b - bgB)))
                return diff <= 16 && chroma <= 12
            }

            func enqueue(_ x: Int, _ y: Int) {
                if x < 0 || x >= w || y < 0 || y >= h { return }
                let i = y * w + x
                if visited[i] != 0 || !isNeutralStudioGrey(i) { return }
                visited[i] = 1
                queue[qTail] = i
                qTail += 1
            }

            for x in 0..<w {
                enqueue(x, 0)
                enqueue(x, h - 1)
            }
            for y in 0..<h {
                enqueue(0, y)
                enqueue(w - 1, y)
            }

            // Seed center of circular avatar frame in UI_PLATE_AVATAR_BAR so shark preview shows through
            if key == "UI_PLATE_AVATAR_BAR" {
                let seedX = Int((0.2398 * fullW).rounded()) - sx
                let seedY = Int((0.3125 * fullH).rounded()) - sy
                for dy in -8...8 {
                    for dx in -8...8 {
                        enqueue(seedX + dx, seedY + dy)
                    }
                }
            }

            while qHead < qTail {
                let curr = queue[qHead]
                qHead += 1
                let p = curr * 4
                rgba[p] = 0
                rgba[p + 1] = 0
                rgba[p + 2] = 0
                rgba[p + 3] = 0
                let cx = curr % w
                let cy = (curr - cx) / w
                if cx > 0 { enqueue(cx - 1, cy) }
                if cx + 1 < w { enqueue(cx + 1, cy) }
                if cy > 0 { enqueue(cx, cy - 1) }
                if cy + 1 < h { enqueue(cx, cy + 1) }
            }

            // 3px edge feathering + tight bounding box
            var minX = w
            var minY = h
            var maxX = 0
            var maxY = 0
            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if x > 0 && x + 1 < w && y > 0 && y + 1 < h {
                        if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
                            let r = Int(rgba[p])
                            let g = Int(rgba[p + 1])
                            let b = Int(rgba[p + 2])
                            let diff = Double(max(abs(r - bgR), max(abs(g - bgG), abs(b - bgB))))
                            let chroma = Double(max(r, max(g, b)) - min(r, min(g, b)))
                            let edgeSignal = max(diff, chroma * 1.35)
                            if edgeSignal < 44.0 {
                                let cleanAlpha = max(0.0, min(1.0, (edgeSignal - 10.0) / 34.0))
                                rgba[p] = UInt8((Double(r) * cleanAlpha).rounded())
                                rgba[p + 1] = UInt8((Double(g) * cleanAlpha).rounded())
                                rgba[p + 2] = UInt8((Double(b) * cleanAlpha).rounded())
                                rgba[p + 3] = UInt8((Double(rgba[p + 3]) * cleanAlpha).rounded())
                            }
                        }
                    }
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }

            guard let keyedCG = ctx.makeImage() else { continue }
            if maxX >= minX && maxY >= minY {
                let bw = max(1, maxX - minX + 1)
                let bh = max(1, maxY - minY + 1)

                if key == "UI_PLATE_AVATAR_BAR" {
                    let holeCx = (0.2398 * fullW - Double(sx) - Double(minX)) / Double(bw)
                    let holeCy = (0.3125 * fullH - Double(sy) - Double(minY)) / Double(bh)
                    let holeInnerDia = (0.1406 * fullW) / Double(bh)
                    let holeOuterDia = (0.1750 * fullW) / Double(bh)
                    avatarBarHollowMetrics = AvatarBarHollowMetrics(
                        cxPct: CGFloat(holeCx * 100.0),
                        cyPct: CGFloat(holeCy * 100.0),
                        innerDiaPctH: CGFloat(holeInnerDia * 100.0),
                        outerDiaPctH: CGFloat(holeOuterDia * 100.0),
                        aspectRatio: CGFloat(Double(bw) / Double(bh))
                    )
                }

                if let tightCG = keyedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    uiBannerImages[key] = UIImage(cgImage: tightCG)
                    continue
                }
            }
            uiBannerImages[key] = UIImage(cgImage: keyedCG)
        }
    }

    /// Slices the Pause / Settings / GameOver Modal & Button Sheet (setting_83a7a273.png)
    /// Includes inner window hollowing for SETTING_MODAL_FRAME, clean medallion variant SETTING_MODAL_FRAME_CLEAN,
    /// 3-slice horizontal widening for SETTING_SHARK_CARD (6.05:1), and icon extraction + scanline patching for SETTING_BTN_*.
    private func sliceUiSettingSheet(_ sheetImage: UIImage) {
        guard let cgSheet = sheetImage.cgImage else { return }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)

        let iconExtractKeys: Set<String> = [
            "SETTING_BTN_LANG",
            "SETTING_BTN_SOUND",
            "SETTING_BTN_TUTORIAL",
            "SETTING_BTN_RESTART",
            "SETTING_BTN_MAIN_MENU"
        ]

        for (key, bounds) in GameConfigGenerated.uiSettingBounds {
            let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
            let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
            let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
            let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))

            guard let cropped = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else { continue }
            let w = cellW
            let h = cellH
            var rgba = [UInt8](repeating: 0, count: w * h * 4)
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue

            guard let ctx = CGContext(
                data: &rgba,
                width: w,
                height: h,
                bitsPerComponent: 8,
                bytesPerRow: w * 4,
                space: colorSpace,
                bitmapInfo: bitmapInfo
            ) else { continue }
            ctx.interpolationQuality = .high
            ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: w, height: h))

            var visited = [UInt8](repeating: 0, count: w * h)
            var queue = [Int](repeating: 0, count: w * h)
            var qHead = 0
            var qTail = 0

            func isDarkCharcoalBg(_ idx: Int) -> Bool {
                let p = idx * 4
                if rgba[p + 3] < 16 { return true }
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let maxC = max(r, max(g, b))
                let minC = min(r, min(g, b))
                return r <= 37 && g <= 37 && b <= 41 && (maxC - minC) <= 8
            }

            func enqueue(_ x: Int, _ y: Int) {
                if x < 0 || x >= w || y < 0 || y >= h { return }
                let i = y * w + x
                if visited[i] != 0 || !isDarkCharcoalBg(i) { return }
                visited[i] = 1
                queue[qTail] = i
                qTail += 1
            }

            for x in 0..<w {
                enqueue(x, 0)
                enqueue(x, h - 1)
            }
            for y in 0..<h {
                enqueue(0, y)
                enqueue(w - 1, y)
            }

            if key == "SETTING_MODAL_FRAME" {
                let innerSeedX = Int((0.273 * fullW).rounded()) - sx
                let innerSeedY = Int((0.380 * fullH).rounded()) - sy
                for dy in -12...12 {
                    for dx in -12...12 {
                        enqueue(innerSeedX + dx, innerSeedY + dy)
                    }
                }
            }

            while qHead < qTail {
                let curr = queue[qHead]
                qHead += 1
                let p = curr * 4
                rgba[p] = 0
                rgba[p + 1] = 0
                rgba[p + 2] = 0
                rgba[p + 3] = 0
                let cx = curr % w
                let cy = (curr - cx) / w
                if cx > 0 { enqueue(cx - 1, cy) }
                if cx + 1 < w { enqueue(cx + 1, cy) }
                if cy > 0 { enqueue(cx, cy - 1) }
                if cy + 1 < h { enqueue(cx, cy + 1) }
            }

            var minX = w
            var minY = h
            var maxX = 0
            var maxY = 0
            for y in 0..<h {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let p = i * 4
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }

            guard maxX >= minX && maxY >= minY else { continue }
            let bw = max(1, maxX - minX + 1)
            let bh = max(1, maxY - minY + 1)

            // Extract left-baked icon & patch button interior with horizontal scanline interpolation
            if iconExtractKeys.contains(key) {
                let ix0 = minX + Int((Double(bw) * 0.14).rounded(.down))
                let ix1 = minX + Int((Double(bw) * 0.34).rounded(.up))
                let iy0 = minY + Int((Double(bh) * 0.18).rounded(.down))
                let iy1 = minY + Int((Double(bh) * 0.82).rounded(.up))
                let iw = max(1, ix1 - ix0)
                let ih = max(1, iy1 - iy0)

                var iconRgba = [UInt8](repeating: 0, count: iw * ih * 4)
                var iminX = iw, iminY = ih, imaxX = 0, imaxY = 0
                for y in 0..<ih {
                    for x in 0..<iw {
                        let srcIdx = ((iy0 + y) * w + (ix0 + x)) * 4
                        let dstIdx = (y * iw + x) * 4
                        let r = Int(rgba[srcIdx])
                        let g = Int(rgba[srcIdx + 1])
                        let b = Int(rgba[srcIdx + 2])
                        let a = Int(rgba[srcIdx + 3])
                        let lum = (r * 299 + g * 587 + b * 114) / 1000
                        if a > 30 && lum > 92 {
                            let boost = min(1.0, max(0.0, (Double(lum - 92)) / 58.0))
                            let outA = Double(a) * boost
                            iconRgba[dstIdx] = UInt8((Double(r) * boost).rounded())
                            iconRgba[dstIdx + 1] = UInt8((Double(g) * boost).rounded())
                            iconRgba[dstIdx + 2] = UInt8((Double(b) * boost).rounded())
                            iconRgba[dstIdx + 3] = UInt8(outA.rounded())
                            if outA > 25 {
                                if x < iminX { iminX = x }
                                if x > imaxX { imaxX = x }
                                if y < iminY { iminY = y }
                                if y > imaxY { imaxY = y }
                            }
                        }
                    }
                }

                if imaxX >= iminX && imaxY >= iminY,
                   let iconCtx = CGContext(
                       data: &iconRgba,
                       width: iw,
                       height: ih,
                       bitsPerComponent: 8,
                       bytesPerRow: iw * 4,
                       space: colorSpace,
                       bitmapInfo: bitmapInfo
                   ),
                   let rawIconCG = iconCtx.makeImage(),
                   let tightIconCG = rawIconCG.cropping(to: CGRect(x: iminX, y: iminY, width: imaxX - iminX + 1, height: imaxY - iminY + 1)) {
                    let iconSize = 96
                    let pad: CGFloat = 6
                    let tw = imaxX - iminX + 1
                    let th = imaxY - iminY + 1
                    let sc = min((CGFloat(iconSize) - pad * 2) / CGFloat(tw), (CGFloat(iconSize) - pad * 2) / CGFloat(th))
                    let dw = CGFloat(tw) * sc
                    let dh = CGFloat(th) * sc
                    let format = UIGraphicsImageRendererFormat()
                    format.scale = 1.0
                    format.opaque = false
                    let renderer = UIGraphicsImageRenderer(size: CGSize(width: iconSize, height: iconSize), format: format)
                    uiSettingIconImages[key] = renderer.image { _ in
                        UIImage(cgImage: tightIconCG).draw(in: CGRect(x: (CGFloat(iconSize) - dw) * 0.5, y: (CGFloat(iconSize) - dh) * 0.5, width: dw, height: dh))
                    }
                }

                // Patch baked icon region [12%..37% x, 17%..83% y] using horizontal scanline interpolation
                let px0 = minX + Int((Double(bw) * 0.12).rounded(.down))
                let px1 = minX + Int((Double(bw) * 0.37).rounded(.up))
                let py0 = minY + Int((Double(bh) * 0.17).rounded(.down))
                let py1 = minY + Int((Double(bh) * 0.83).rounded(.up))
                let rx0 = minX + Int((Double(bw) * 0.42).rounded(.down))
                let rx1 = minX + Int((Double(bw) * 0.72).rounded(.down))
                let refSpan = max(1, rx1 - rx0)

                for y in py0...min(h - 1, py1) {
                    let leftSampleX = max(minX, px0 - 2)
                    let lp = (y * w + leftSampleX) * 4
                    let lr = Double(rgba[lp])
                    let lg = Double(rgba[lp + 1])
                    let lb = Double(rgba[lp + 2])
                    let la = Double(rgba[lp + 3])

                    for x in px0...min(w - 1, px1) {
                        let t = Double(x - px0) / Double(max(1, px1 - px0))
                        let refX = rx0 + ((x - px0) % refSpan)
                        let rp = (y * w + min(w - 1, refX)) * 4
                        let rr = Double(rgba[rp])
                        let rg = Double(rgba[rp + 1])
                        let rb = Double(rgba[rp + 2])
                        let ra = Double(rgba[rp + 3])

                        let dp = (y * w + x) * 4
                        rgba[dp] = UInt8((lr * (1.0 - t) + rr * t).rounded())
                        rgba[dp + 1] = UInt8((lg * (1.0 - t) + rg * t).rounded())
                        rgba[dp + 2] = UInt8((lb * (1.0 - t) + rb * t).rounded())
                        rgba[dp + 3] = UInt8(max(la, ra).rounded())
                    }
                }
            }

            guard let patchedCG = ctx.makeImage(),
                  let tightCG = patchedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) else { continue }

            // Special 3-slice horizontal widening for SETTING_SHARK_CARD (widen to 6.05:1 aspect ratio)
            if key == "SETTING_SHARK_CARD" {
                let targetW = max(bw, Int((Double(bh) * 6.05).rounded()))
                let leftCap = Int((Double(bw) * 0.26).rounded(.down))
                let rightCap = Int((Double(bw) * 0.10).rounded(.down))
                let srcMidW = max(1, bw - leftCap - rightCap)
                let dstMidW = max(1, targetW - leftCap - rightCap)

                let format = UIGraphicsImageRendererFormat()
                format.scale = 1.0
                format.opaque = false
                let renderer = UIGraphicsImageRenderer(size: CGSize(width: targetW, height: bh), format: format)
                let wideImg = renderer.image { _ in
                    if let leftCG = tightCG.cropping(to: CGRect(x: 0, y: 0, width: leftCap, height: bh)) {
                        UIImage(cgImage: leftCG).draw(in: CGRect(x: 0, y: 0, width: leftCap, height: bh))
                    }
                    if let midCG = tightCG.cropping(to: CGRect(x: leftCap, y: 0, width: srcMidW, height: bh)) {
                        UIImage(cgImage: midCG).draw(in: CGRect(x: leftCap, y: 0, width: dstMidW, height: bh))
                    }
                    if let rightCG = tightCG.cropping(to: CGRect(x: bw - rightCap, y: 0, width: rightCap, height: bh)) {
                        UIImage(cgImage: rightCG).draw(in: CGRect(x: targetW - rightCap, y: 0, width: rightCap, height: bh))
                    }
                }
                uiSettingImages[key] = wideImg
                continue
            }

            uiSettingImages[key] = UIImage(cgImage: tightCG)

            // Also generate SETTING_MODAL_FRAME_CLEAN with top medallion pause bars smoothed out for GameOver modal
            if key == "SETTING_MODAL_FRAME" {
                let mx0 = minX + Int((Double(bw) * 0.424).rounded(.down))
                let mx1 = minX + Int((Double(bw) * 0.488).rounded(.up))
                let my0 = minY + Int((Double(bh) * 0.038).rounded(.down))
                let my1 = minY + Int((Double(bh) * 0.118).rounded(.up))

                for y in my0...min(h - 1, my1) {
                    let lp = (y * w + max(minX, mx0 - 2)) * 4
                    let rp = (y * w + min(w - 1, mx1 + 2)) * 4
                    let lr = Double(rgba[lp]), lg = Double(rgba[lp + 1]), lb = Double(rgba[lp + 2]), la = Double(rgba[lp + 3])
                    let rr = Double(rgba[rp]), rg = Double(rgba[rp + 1]), rb = Double(rgba[rp + 2]), ra = Double(rgba[rp + 3])
                    let span = Double(max(1, mx1 - mx0))
                    for x in mx0...min(w - 1, mx1) {
                        let t = Double(x - mx0) / span
                        let dp = (y * w + x) * 4
                        rgba[dp] = UInt8((lr * (1.0 - t) + rr * t).rounded())
                        rgba[dp + 1] = UInt8((lg * (1.0 - t) + rg * t).rounded())
                        rgba[dp + 2] = UInt8((lb * (1.0 - t) + rb * t).rounded())
                        rgba[dp + 3] = UInt8(max(la, ra).rounded())
                    }
                }
                if let cleanFullCG = ctx.makeImage(),
                   let cleanTightCG = cleanFullCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    uiSettingImages["SETTING_MODAL_FRAME_CLEAN"] = UIImage(cgImage: cleanTightCG)
                }
            }
        }
    }

    /// CoreGraphics Perimeter BFS Flood-Fill + Boundary Color-to-Alpha White Unmixing
    private func sliceAndKeyNormalizedCell(
        from sheetImage: UIImage,
        bounds: SIMD4<Double>,
        preserveInteriorWhite: Bool,
        topSkyOnly: Bool = false
    ) -> UIImage? {
        guard let cgSheet = sheetImage.cgImage else { return nil }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)

        let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
        let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
        let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
        let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))

        guard let croppedCG = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else {
            return nil
        }

        let maxCellW = topSkyOnly ? 1024 : 320
        let scale = cellW > maxCellW ? Double(maxCellW) / Double(cellW) : 1.0
        let w = max(1, Int((Double(cellW) * scale).rounded()))
        let h = max(1, Int((Double(cellH) * scale).rounded()))

        var rgba = [UInt8](repeating: 0, count: w * h * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue

        guard let ctx = CGContext(
            data: &rgba,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else {
            return UIImage(cgImage: croppedCG)
        }

        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: h))

        var visited = [UInt8](repeating: 0, count: w * h)
        var queue = [Int](repeating: 0, count: w * h)
        var qHead = 0
        var qTail = 0

        func isStudioWhiteBg(_ idx: Int) -> Bool {
            let p = idx * 4
            let a = rgba[p + 3]
            if a < 16 { return true }
            let r = Int(rgba[p])
            let g = Int(rgba[p + 1])
            let b = Int(rgba[p + 2])
            let maxC = max(r, max(g, b))
            let minC = min(r, min(g, b))
            return minC >= 226 && (maxC - minC) <= 26
        }

        func enqueue(_ x: Int, _ y: Int) {
            if x < 0 || x >= w || y < 0 || y >= h { return }
            let i = y * w + x
            if visited[i] != 0 || !isStudioWhiteBg(i) { return }
            visited[i] = 1
            queue[qTail] = i
            qTail += 1
        }

        for x in 0..<w {
            enqueue(x, 0)
            if !topSkyOnly {
                enqueue(x, h - 1)
            }
        }
        let maxSideY = topSkyOnly ? Int(Double(h) * 0.65) : h
        for y in 0..<maxSideY {
            enqueue(0, y)
            enqueue(w - 1, y)
        }

        while qHead < qTail {
            let curr = queue[qHead]
            qHead += 1
            let p = curr * 4
            rgba[p] = 0
            rgba[p + 1] = 0
            rgba[p + 2] = 0
            rgba[p + 3] = 0
            let cx = curr % w
            let cy = (curr - cx) / w
            if cx > 0 { enqueue(cx - 1, cy) }
            if cx + 1 < w { enqueue(cx + 1, cy) }
            if cy > 0 { enqueue(cx, cy - 1) }
            if cy + 1 < h { enqueue(cx, cy + 1) }
        }

        // Boundary Color-to-Alpha unmixing on 2px halo around removed white background
        if h > 2 && w > 2 {
            for y in 1..<(h - 1) {
                let rowOff = y * w
                for x in 1..<(w - 1) {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    if visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0 {
                        let p = i * 4
                        let r = Double(rgba[p])
                        let g = Double(rgba[p + 1])
                        let b = Double(rgba[p + 2])
                        let minC = min(r, min(g, b))
                        if minC > 55.0 {
                            let cleanAlpha = max(0.0, min(1.0, (250.0 - minC) / 195.0))
                            if cleanAlpha <= 0.04 {
                                rgba[p] = 0
                                rgba[p + 1] = 0
                                rgba[p + 2] = 0
                                rgba[p + 3] = 0
                            } else {
                                let unmixDiv = max(0.08, (255.0 - minC) / 255.0)
                                let nr = max(0.0, min(255.0, (r - minC) / unmixDiv)) * cleanAlpha
                                let ng = max(0.0, min(255.0, (g - minC) / unmixDiv)) * cleanAlpha
                                let nb = max(0.0, min(255.0, (b - minC) / unmixDiv)) * cleanAlpha
                                rgba[p] = UInt8(nr.rounded())
                                rgba[p + 1] = UInt8(ng.rounded())
                                rgba[p + 2] = UInt8(nb.rounded())
                                rgba[p + 3] = UInt8((Double(rgba[p + 3]) * cleanAlpha).rounded())
                            }
                        }
                    }
                }
            }
        }

        guard let outCG = ctx.makeImage() else { return nil }
        return UIImage(cgImage: outCG)
    }

    /// Synthesizes a horizontally-seamless tile from an RGBA pixel buffer by cross-fading a seamRatio overlap band
    /// using a cosine weight curve (zero vertical seam lines between repeated tiles).
    private func makeHorizontallySeamlessImage(
        rgba sBuf: [UInt8],
        width sw: Int,
        height sh: Int,
        seamRatio: Double
    ) -> UIImage? {
        let overlap = max(12, min(sw / 4, Int((Double(sw) * seamRatio).rounded())))
        let outW = max(16, sw - overlap)
        var oBuf = [UInt8](repeating: 0, count: outW * sh * 4)

        for y in 0..<sh {
            let rowIn = y * sw
            let rowOut = y * outW
            for x in 0..<outW {
                let dstIdx = (rowOut + x) * 4
                if x < overlap {
                    let t = (Double(x) + 0.5) / Double(overlap)
                    let wLeft = 0.5 - 0.5 * cos(.pi * t)
                    let wRight = 1.0 - wLeft

                    let idxL = (rowIn + x) * 4
                    let idxR = (rowIn + outW + x) * 4

                    // Unpremultiply before blending, then repremultiply
                    let aL = Double(sBuf[idxL + 3]) / 255.0
                    let aR = Double(sBuf[idxR + 3]) / 255.0
                    let outA = aL * wLeft + aR * wRight

                    if outA <= 0.002 {
                        oBuf[dstIdx] = 0
                        oBuf[dstIdx + 1] = 0
                        oBuf[dstIdx + 2] = 0
                        oBuf[dstIdx + 3] = 0
                    } else {
                        let rL = aL > 0.01 ? Double(sBuf[idxL]) / aL : 0.0
                        let gL = aL > 0.01 ? Double(sBuf[idxL + 1]) / aL : 0.0
                        let bL = aL > 0.01 ? Double(sBuf[idxL + 2]) / aL : 0.0
                        let rR = aR > 0.01 ? Double(sBuf[idxR]) / aR : 0.0
                        let gR = aR > 0.01 ? Double(sBuf[idxR + 1]) / aR : 0.0
                        let bR = aR > 0.01 ? Double(sBuf[idxR + 2]) / aR : 0.0

                        let weightL = (aL * wLeft) / outA
                        let weightR = (aR * wRight) / outA
                        let rMix = (rL * weightL + rR * weightR) * outA
                        let gMix = (gL * weightL + gR * weightR) * outA
                        let bMix = (bL * weightL + bR * weightR) * outA

                        oBuf[dstIdx] = UInt8(max(0.0, min(255.0, rMix.rounded())))
                        oBuf[dstIdx + 1] = UInt8(max(0.0, min(255.0, gMix.rounded())))
                        oBuf[dstIdx + 2] = UInt8(max(0.0, min(255.0, bMix.rounded())))
                        oBuf[dstIdx + 3] = UInt8(max(0.0, min(255.0, (outA * 255.0).rounded())))
                    }
                } else {
                    let idxS = (rowIn + x) * 4
                    oBuf[dstIdx] = sBuf[idxS]
                    oBuf[dstIdx + 1] = sBuf[idxS + 1]
                    oBuf[dstIdx + 2] = sBuf[idxS + 2]
                    oBuf[dstIdx + 3] = sBuf[idxS + 3]
                }
            }
        }

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &oBuf,
            width: outW,
            height: sh,
            bitsPerComponent: 8,
            bytesPerRow: outW * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ), let cgOut = ctx.makeImage() else {
            return nil
        }
        return UIImage(cgImage: cgOut)
    }

    /// Processes Layer 0 Water Canopy ('bg_shallow_0_water', 'bg_twilight_0', 'bg_abyss_0'):
    /// - Trims top/bottom white margins and right-edge white border on 'bg_shallow_0_water'
    /// - Smoothly unmixes the bottom #FFFFFF fade using a C1 cosine vertical envelope so sunbeams dissolve invisibly into the water column (zero horizontal cutoff line!)
    /// - Applies cosine horizontal cross-fading so repeated tiles have zero vertical seam lines!
    private func processWaterLayerToSeamlessTile(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height
        let isShallowCanopy = assetName.contains("shallow_0_water") || (Double(srcW) / Double(max(1, srcH)) > 3.0)

        let cropLeft = isShallowCanopy ? Int((Double(srcW) * 0.012).rounded()) : 0
        let cropRight = isShallowCanopy ? Int((Double(srcW) * 0.968).rounded()) : srcW
        let cropTop = isShallowCanopy ? Int((Double(srcH) * 0.032).rounded()) : 0
        let cropBot = isShallowCanopy ? Int((Double(srcH) * 0.902).rounded()) : srcH
        let cropW = max(64, cropRight - cropLeft)
        let cropH = max(32, cropBot - cropTop)

        guard let croppedCG = cgImg.cropping(to: CGRect(x: cropLeft, y: cropTop, width: cropW, height: cropH)) else {
            return nil
        }

        let maxDim = isShallowCanopy ? 1280 : 768
        let scale = cropW > maxDim ? Double(maxDim) / Double(cropW) : 1.0
        let w = max(64, Int((Double(cropW) * scale).rounded()))
        let h = max(32, Int((Double(cropH) * scale).rounded()))

        var rgba = [UInt8](repeating: 0, count: w * h * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &rgba,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: h))

        if isShallowCanopy {
            for y in 0..<h {
                let v = Double(y) / Double(max(1, h - 1))
                // C1-continuous cosine vertical fade from v=0.22 down to v=1.0 (zero hard bottom edge)
                let verticalEnvelope = v <= 0.22
                    ? 1.0
                    : pow(cos(((v - 0.22) / 0.78) * .pi * 0.5), 1.65)
                let rowOff = y * w
                for x in 0..<w {
                    let idx = (rowOff + x) * 4
                    let r = Double(rgba[idx])
                    let g = Double(rgba[idx + 1])
                    let b = Double(rgba[idx + 2])
                    let maxC = max(r, max(g, b))
                    let minC = min(r, min(g, b))
                    let sat = maxC > 0 ? (maxC - minC) / maxC : 0.0

                    // Strip any residual neutral white pixels near the top/sides
                    if minC >= 232.0 && sat < 0.08 {
                        rgba[idx] = 0
                        rgba[idx + 1] = 0
                        rgba[idx + 2] = 0
                        rgba[idx + 3] = 0
                        continue
                    }

                    if v >= 0.18 {
                        let cyanInk = max((255.0 - r) / 235.0, sat * 1.25)
                        let rawAlpha = max(0.0, min(1.0, cyanInk))
                        let unmixWeight = min(1.0, (v - 0.18) / 0.26)
                        let effAlpha = (1.0 - unmixWeight + unmixWeight * rawAlpha) * verticalEnvelope
                        if effAlpha <= 0.008 {
                            rgba[idx] = 0
                            rgba[idx + 1] = 0
                            rgba[idx + 2] = 0
                            rgba[idx + 3] = 0
                            continue
                        }
                        var outR = r
                        var outG = g
                        var outB = b
                        if rawAlpha > 0.05 && rawAlpha < 0.98 {
                            let invA = 1.0 / max(0.24, rawAlpha)
                            let ur = max(0.0, min(255.0, (r - 255.0 * (1.0 - rawAlpha)) * invA))
                            let ug = max(0.0, min(255.0, (g - 255.0 * (1.0 - rawAlpha)) * invA))
                            let ub = max(0.0, min(255.0, (b - 255.0 * (1.0 - rawAlpha)) * invA))
                            outR = r * (1.0 - unmixWeight) + ur * unmixWeight
                            outG = g * (1.0 - unmixWeight) + ug * unmixWeight
                            outB = b * (1.0 - unmixWeight) + ub * unmixWeight
                        }
                        // Store premultiplied RGBA
                        rgba[idx] = UInt8(max(0.0, min(255.0, (outR * effAlpha).rounded())))
                        rgba[idx + 1] = UInt8(max(0.0, min(255.0, (outG * effAlpha).rounded())))
                        rgba[idx + 2] = UInt8(max(0.0, min(255.0, (outB * effAlpha).rounded())))
                        rgba[idx + 3] = UInt8(max(0.0, min(255.0, (effAlpha * 255.0).rounded())))
                    }
                }
            }
        }

        return makeHorizontallySeamlessImage(rgba: rgba, width: w, height: h, seamRatio: isShallowCanopy ? 0.10 : 0.14)
    }

    /// Processes Far / Mid / Near Ocean Terrain Layers ('bg_{zone}_{1|2|3}') with 1:1 parity to 'parallaxBackground.ts':
    /// - Applies bottom margin crop (0.915 on 'shallow_1_far', 0.935 on 'shallow_2_mid')
    /// - Clears slice-overlap artifact rect [0, 0.78, 0.14, 1.0] and rounds flat top-left peak on 'shallow_1_far'
    /// - Runs BFS sky flood-fill + punches enclosed white coral/archway holes ('punchUpperInteriorWhiteHoles')
    /// - Despills 2px white/magenta boundary halo
    /// - Grounds bottom column notches ('groundBottomColumns') so stacked parallax layers have a 100% solid base
    /// - Trims vertical [minY, maxY] and applies cosine horizontal seam blending ('makeHorizontallySeamlessImage')
    private func processTerrainLayerToSeamlessStrip(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height

        let isShallowFar = assetName.contains("shallow_1_far")
        let isShallowMid = assetName.contains("shallow_2_mid")
        let isShallowNear = assetName.contains("shallow_3_near")
        let isAbyssMid = assetName.contains("abyss_2")

        let cropBottomRatio: Double = isShallowFar ? 0.915 : (isShallowMid ? 0.935 : 1.0)
        // Also trim 1% off left/right raw edges if there is any thin border artifact
        let cropX0 = Int((Double(srcW) * 0.006).rounded())
        let cropX1 = Int((Double(srcW) * 0.994).rounded())
        let effSrcW = max(64, cropX1 - cropX0)
        let effSrcH = max(32, Int((Double(srcH) * cropBottomRatio).rounded()))

        guard let croppedCG = cgImg.cropping(to: CGRect(x: cropX0, y: 0, width: effSrcW, height: effSrcH)) else {
            return nil
        }

        let isPanoramic = Double(effSrcW) / Double(max(1, effSrcH)) > 1.8
        let maxDim = isPanoramic ? 1280 : 640
        let scale = effSrcW > maxDim ? Double(maxDim) / Double(effSrcW) : 1.0
        let w = max(64, Int((Double(effSrcW) * scale).rounded()))
        let h = max(24, Int((Double(effSrcH) * scale).rounded()))

        var rgba = [UInt8](repeating: 0, count: w * h * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &rgba,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: h))

        // 1. Clear stray slice-overlap artifact rect & round top-left flat-sliced seamount peak on shallow_1_far
        if isShallowFar {
            let rx1 = Int((Double(w) * 0.14).rounded(.up))
            let ry0 = Int((Double(h) * 0.78).rounded(.down))
            for y in max(0, ry0)..<h {
                for x in 0..<min(w, rx1) {
                    let p = (y * w + x) * 4
                    rgba[p] = 255; rgba[p + 1] = 255; rgba[p + 2] = 255; rgba[p + 3] = 0
                }
            }
            let xStart = Int((Double(w) * 0.032).rounded(.down))
            let xEnd = Int((Double(w) * 0.158).rounded(.up))
            let xCenter = Double(xStart + xEnd) * 0.5
            let xHalf = max(1.0, Double(xEnd - xStart) * 0.5)
            for x in max(0, xStart)...min(w - 1, xEnd) {
                let nx = (Double(x) - xCenter) / xHalf
                let archCurve = Int((Double(h) * (0.015 + 0.14 * nx * nx + 0.025 * sin(nx * .pi * 2.0))).rounded())
                for y in 0..<min(h, max(0, archCurve)) {
                    let p = (y * w + x) * 4
                    rgba[p] = 255; rgba[p + 1] = 255; rgba[p + 2] = 255; rgba[p + 3] = 0
                }
            }
        }

        // 2. BFS Flood-Fill from top sky border and upper 68% left/right edges
        var visited = [UInt8](repeating: 0, count: w * h)
        var queue = [Int](repeating: 0, count: w * h)
        var qHead = 0
        var qTail = 0

        func isBgCandidate(_ i: Int) -> Bool {
            let p = i * 4
            if rgba[p + 3] < 16 { return true }
            let r = Int(rgba[p])
            let g = Int(rgba[p + 1])
            let b = Int(rgba[p + 2])
            let maxC = max(r, max(g, b))
            let minC = min(r, min(g, b))
            let isWhite = minC >= 216 && (maxC - minC) <= 32
            let isMagenta = r >= 180 && b >= 180 && g <= 135 && (r - g) >= 65 && (b - g) >= 65
            return isWhite || isMagenta
        }

        func pushSeed(_ x: Int, _ y: Int) {
            if x < 0 || x >= w || y < 0 || y >= h { return }
            let i = y * w + x
            if visited[i] != 0 || !isBgCandidate(i) { return }
            visited[i] = 1
            queue[qTail] = i
            qTail += 1
        }

        for x in 0..<w {
            pushSeed(x, 0)
            pushSeed(x, min(h - 1, 1))
        }
        let maxSideY = Int(Double(h) * 0.68)
        for y in 0..<maxSideY {
            pushSeed(0, y)
            pushSeed(w - 1, y)
        }

        while qHead < qTail {
            let curr = queue[qHead]
            qHead += 1
            let cx = curr % w
            let cy = (curr - cx) / w
            if cx > 0 { pushSeed(cx - 1, cy) }
            if cx + 1 < w { pushSeed(cx + 1, cy) }
            if cy > 0 { pushSeed(cx, cy - 1) }
            if cy + 1 < h { pushSeed(cx, cy + 1) }
        }

        // 3. Punch enclosed white holes in upper coral/rock archways on shallow layers
        if isShallowFar || isShallowMid || isShallowNear {
            let holeRatio = isShallowFar ? 0.86 : (isShallowMid ? 0.82 : 0.48)
            let maxHoleY = Int(Double(h) * holeRatio)
            for y in 0..<min(h, maxHoleY) {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] == 0 {
                        let p = i * 4
                        let r = Int(rgba[p])
                        let g = Int(rgba[p + 1])
                        let b = Int(rgba[p + 2])
                        let minC = min(r, min(g, b))
                        let maxC = max(r, max(g, b))
                        if minC >= 224 && (maxC - minC) <= 26 {
                            visited[i] = 1
                        }
                    }
                }
            }
        }

        for i in 0..<(w * h) {
            if visited[i] != 0 {
                let p = i * 4
                rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
            }
        }

        // 4. Despill & feather 2px boundary halo around removed sky/background
        if h > 2 && w > 2 {
            for y in 1..<(h - 1) {
                let rowOff = y * w
                for x in 1..<(w - 1) {
                    let i = rowOff + x
                    if visited[i] != 0 { continue }
                    let hasTrans = visited[i - 1] != 0 || visited[i + 1] != 0 || visited[i - w] != 0 || visited[i + w] != 0
                    if hasTrans {
                        let p = i * 4
                        let r = Double(rgba[p])
                        let g = Double(rgba[p + 1])
                        let b = Double(rgba[p + 2])
                        let minC = min(r, min(g, b))
                        let maxC = max(r, max(g, b))
                        if minC > 155.0 && (maxC - minC) < 55.0 {
                            let keep = max(0.0, min(1.0, (232.0 - minC) / 77.0))
                            rgba[p] = UInt8((r * 0.66 * keep).rounded())
                            rgba[p + 1] = UInt8((g * 0.72 * keep).rounded())
                            rgba[p + 2] = UInt8((b * 0.80 * keep).rounded())
                            rgba[p + 3] = UInt8((Double(rgba[p + 3]) * keep).rounded())
                        }
                    }
                }
            }
        }

        // 5. Ground bottom columns so elevated parallax planes have a 100% solid base (zero bottom gap lines!)
        let shouldGroundBottom = isShallowFar || isShallowMid || isShallowNear || isAbyssMid
        if shouldGroundBottom {
            let bandRatio = isShallowFar ? 0.24 : (isShallowMid ? 0.14 : 0.18)
            let minSearchY = max(4, Int(Double(h) * (1.0 - bandRatio)))
            for x in 0..<w {
                var lastSolidY = -1
                for y in stride(from: h - 1, through: minSearchY, by: -1) {
                    let p = (y * w + x) * 4
                    let r = Int(rgba[p])
                    let g = Int(rgba[p + 1])
                    let b = Int(rgba[p + 2])
                    let minC = min(r, min(g, b))
                    let maxC = max(r, max(g, b))
                    let isWhiteMargin = minC >= 210 && (maxC - minC) <= 34
                    if rgba[p + 3] > 200 && !isWhiteMargin {
                        lastSolidY = y
                        break
                    }
                }
                if lastSolidY >= minSearchY && lastSolidY < h - 1 {
                    let srcY = max(0, lastSolidY - 2)
                    let sp = (srcY * w + x) * 4
                    let sr = rgba[sp], sg = rgba[sp + 1], sb = rgba[sp + 2]
                    for y in lastSolidY..<h {
                        let dp = (y * w + x) * 4
                        rgba[dp] = sr; rgba[dp + 1] = sg; rgba[dp + 2] = sb; rgba[dp + 3] = 255
                    }
                }
            }
        }

        // 6. Find vertical opaque bounding box [minY, maxY] to trim empty sky & bottom margin rows
        var minY = h - 1
        var maxY = 0
        for y in 0..<h {
            var opaqueCount = 0
            let rowOff = y * w
            for x in stride(from: 0, to: w, by: 2) {
                if rgba[(rowOff + x) * 4 + 3] > 28 {
                    opaqueCount += 1
                }
            }
            if opaqueCount >= 4 {
                if y < minY { minY = y }
                if y > maxY { maxY = y }
            }
        }

        if maxY <= minY + 16 {
            minY = 0
            maxY = h - 1
        } else {
            minY = max(0, minY - 2)
            maxY = min(h - 1, max(minY + 24, maxY - 1))
        }

        let cropH = maxY - minY + 1
        var croppedRgba = [UInt8](repeating: 0, count: w * cropH * 4)
        for y in 0..<cropH {
            let srcOff = (minY + y) * w * 4
            let dstOff = y * w * 4
            for byteIdx in 0..<(w * 4) {
                croppedRgba[dstOff + byteIdx] = rgba[srcOff + byteIdx]
            }
        }

        return makeHorizontallySeamlessImage(
            rgba: croppedRgba,
            width: w,
            height: cropH,
            seamRatio: isPanoramic ? 0.10 : 0.14
        )
    }
}
