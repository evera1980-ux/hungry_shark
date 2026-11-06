import UIKit
import SpriteKit
import CoreGraphics

/// Pure Native CoreGraphics Offscreen Sprite Sheet Processor & Texture Cache
/// Performs perimeter BFS flood-fill + Color-to-Alpha boundary white unmixing on the 4K shark atlas,
/// prey sheets, UI icon sheet, and ocean parallax layers without any WebView dependency.
@MainActor
public final class SpriteAtlasManager {
    public static let shared = SpriteAtlasManager()

    private var sharkTextures: [String: SKTexture] = [:]
    private var sharkUIImages: [String: UIImage] = [:]
    private var preyTextures: [String: SKTexture] = [:]
    private var uiIconImages: [String: UIImage] = [:]
    private var oceanLayerTextures: [String: SKTexture] = [:]
    private var isPreloaded = false

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
                preyTextures[prey.spriteKey] = SKTexture(image: sliced)
            }
        }

        // 3. Slice 6x4 UI Icon Sheet (icons_f5128c12.png)
        if let iconSheet = loadBundledImage(named: "icons_f5128c12") {
            for (key, grid) in GameConfigGenerated.uiIconGridMap {
                let row = Double(grid.x)
                let col = Double(grid.y)
                let bounds = SIMD4<Double>(col / 6.0, row / 4.0, (col + 1.0) / 6.0, (row + 1.0) / 4.0)
                if let iconImg = sliceAndKeyNormalizedCell(
                    from: iconSheet,
                    bounds: bounds,
                    preserveInteriorWhite: true
                ) {
                    uiIconImages[key] = iconImg
                }
            }
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

    public func uiIconImage(for key: String) -> UIImage? {
        preloadAllIfNeeded()
        return uiIconImages[key]
    }

    public func oceanParallaxTexture(named assetName: String, isWaterCanopy: Bool = false) -> SKTexture? {
        if let cached = oceanLayerTextures[assetName] {
            return cached
        }
        guard let rawImg = loadBundledImage(named: assetName) else { return nil }
        let processed: UIImage
        if isWaterCanopy {
            processed = rawImg
        } else {
            processed = sliceAndKeyNormalizedCell(
                from: rawImg,
                bounds: SIMD4<Double>(0, 0, 1, 1),
                preserveInteriorWhite: true,
                topSkyOnly: true
            ) ?? rawImg
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

        // Supersample cap for 4K cells so per-cell processing is fast and crisp
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
}
