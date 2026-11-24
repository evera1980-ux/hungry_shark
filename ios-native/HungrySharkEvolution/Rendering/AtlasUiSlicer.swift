import UIKit
import SpriteKit

// MARK: - SpriteAtlasManager UI Atlas Slicers & Image Normalization

extension SpriteAtlasManager {
    /// Slices the 6x4 UI Icon Sheet (icons_f5128c12.png) with center hollow seed for UI_AVATAR_FRAME & UI_JOYSTICK_BASE
    /// and tight bounding-box aspect-fit normalization into a 128x128 square UIImage.
    nonisolated static func sliceUiIconSheet(_ sheetImage: UIImage) -> [String: UIImage] {
        var outIcons: [String: UIImage] = [:]
        guard let cgSheet = sheetImage.cgImage else { return outIcons }
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
                    let normImg = renderer.image { _ in
                        UIImage(cgImage: tightCG).draw(in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
                    }
                    outIcons[key] = normImg
                    continue
                }
            }
            outIcons[key] = UIImage(cgImage: keyedCG)
        }
        return outIcons
    }

    /// Slices the Banner & Avatar Plate Sheet (buttons_16e3a0cf.png)
    /// Neutral dark grey background (~RGB 60,60,60), hollowing out the circular shark window in UI_PLATE_AVATAR_BAR.
    nonisolated static func sliceUiBannerSheet(_ sheetImage: UIImage) -> (images: [String: UIImage], metrics: AvatarBarHollowMetrics?) {
        var outBanners: [String: UIImage] = [:]
        var outMetrics: AvatarBarHollowMetrics? = nil
        guard let cgSheet = sheetImage.cgImage else { return (outBanners, outMetrics) }
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
                    outMetrics = AvatarBarHollowMetrics(
                        cxPct: CGFloat(holeCx * 100.0),
                        cyPct: CGFloat(holeCy * 100.0),
                        innerDiaPctH: CGFloat(holeInnerDia * 100.0),
                        outerDiaPctH: CGFloat(holeOuterDia * 100.0),
                        aspectRatio: CGFloat(Double(bw) / Double(bh))
                    )
                }

                if let tightCG = keyedCG.cropping(to: CGRect(x: minX, y: minY, width: bw, height: bh)) {
                    outBanners[key] = UIImage(cgImage: tightCG)
                    continue
                }
            }
            outBanners[key] = UIImage(cgImage: keyedCG)
        }
        return (outBanners, outMetrics)
    }

    /// Slices the Pause / Settings / GameOver Modal & Button Sheet (setting_83a7a273.png)
    /// Includes inner window hollowing for SETTING_MODAL_FRAME, clean medallion variant SETTING_MODAL_FRAME_CLEAN,
    /// 5-slice horizontal widening for SETTING_SHARK_CARD (4.80:1), and icon extraction + scanline patching for SETTING_BTN_*.
    nonisolated static func sliceUiSettingSheet(_ sheetImage: UIImage) -> (images: [String: UIImage], icons: [String: UIImage]) {
        var outImages: [String: UIImage] = [:]
        var outIcons: [String: UIImage] = [:]
        guard let cgSheet = sheetImage.cgImage else { return (outImages, outIcons) }
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
                    outIcons[key] = renderer.image { _ in
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

            // Special 5-slice horizontal widening for SETTING_SHARK_CARD:
            // Widens BOTH the left recessed shark avatar frame (so horizontal sharks fit 100% inside the box)
            // AND the right data body to match the 4.80:1 card aspect ratio!
            if key == "SETTING_SHARK_CARD" {
                let targetW = max(bw, Int((Double(bh) * 4.80).rounded()))
                let s1W = Int((Double(bw) * 0.085).rounded(.down))
                let s2W = Int((Double(bw) * 0.090).rounded(.down))
                let s3W = Int((Double(bw) * 0.085).rounded(.down))
                let s5W = Int((Double(bw) * 0.100).rounded(.down))
                let s4W = max(1, bw - s1W - s2W - s3W - s5W)

                let extraAvatarW = Int((Double(bh) * 0.50).rounded())
                let dstS2W = s2W + extraAvatarW
                let dstS4W = max(1, targetW - s1W - dstS2W - s3W - s5W)

                let format = UIGraphicsImageRendererFormat()
                format.scale = 1.0
                format.opaque = false
                let renderer = UIGraphicsImageRenderer(size: CGSize(width: targetW, height: bh), format: format)
                let wideImg = renderer.image { _ in
                    var srcX = 0
                    var dstX = 0

                    // Slice 1: Left card border + left rim of recessed avatar box
                    if let c1 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s1W, height: bh)) {
                        UIImage(cgImage: c1).draw(in: CGRect(x: dstX, y: 0, width: s1W, height: bh))
                    }
                    srcX += s1W; dstX += s1W

                    // Slice 2: Uniform middle of recessed avatar box (widened so horizontal shark fits inside!)
                    if let c2 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s2W, height: bh)) {
                        UIImage(cgImage: c2).draw(in: CGRect(x: dstX, y: 0, width: dstS2W, height: bh))
                    }
                    srcX += s2W; dstX += dstS2W

                    // Slice 3: Right rim of recessed avatar box
                    if let c3 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s3W, height: bh)) {
                        UIImage(cgImage: c3).draw(in: CGRect(x: dstX, y: 0, width: s3W, height: bh))
                    }
                    srcX += s3W; dstX += s3W

                    // Slice 4: Uniform middle of right card body
                    if let c4 = tightCG.cropping(to: CGRect(x: srcX, y: 0, width: s4W, height: bh)) {
                        UIImage(cgImage: c4).draw(in: CGRect(x: dstX, y: 0, width: dstS4W, height: bh))
                    }
                    srcX += s4W; dstX += dstS4W

                    // Slice 5: Right chamfered border of card
                    if let c5 = tightCG.cropping(to: CGRect(x: bw - s5W, y: 0, width: s5W, height: bh)) {
                        UIImage(cgImage: c5).draw(in: CGRect(x: dstX, y: 0, width: s5W, height: bh))
                    }
                }
                outImages[key] = wideImg
                continue
            }

            outImages[key] = UIImage(cgImage: tightCG)

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
                    outImages["SETTING_MODAL_FRAME_CLEAN"] = UIImage(cgImage: cleanTightCG)
                }
            }
        }
        return (outImages, outIcons)
    }

    /// CoreGraphics Perimeter BFS Flood-Fill + Boundary Color-to-Alpha White Unmixing
    /// (Includes strict [x0, y0, x1, y1] & 2D bounding-box guards so a 1px or thin barcode texture can NEVER be created!)
    nonisolated static func sliceAndKeyNormalizedCell(
        from sheetImage: UIImage,
        bounds: SIMD4<Double>,
        preserveInteriorWhite: Bool,
        topSkyOnly: Bool = false
    ) -> UIImage? {
        guard let cgSheet = sheetImage.cgImage else { return nil }
        let fullW = Double(cgSheet.width)
        let fullH = Double(cgSheet.height)
        guard bounds.z > bounds.x + 0.03, bounds.w > bounds.y + 0.03 else { return nil }

        let sx = max(0, Int((bounds.x * fullW).rounded(.down)))
        let sy = max(0, Int((bounds.y * fullH).rounded(.down)))
        let cellW = max(1, min(cgSheet.width - sx, Int(((bounds.z - bounds.x) * fullW).rounded(.down))))
        let cellH = max(1, min(cgSheet.height - sy, Int(((bounds.w - bounds.y) * fullH).rounded(.down))))
        guard cellW >= 24 && cellH >= 24 else { return nil }

        guard let croppedCG = cgSheet.cropping(to: CGRect(x: sx, y: sy, width: cellW, height: cellH)) else {
            return nil
        }

        let maxCellW = topSkyOnly ? 1024 : 340
        let scale = cellW > maxCellW ? Double(maxCellW) / Double(cellW) : 1.0
        let w = max(16, Int((Double(cellW) * scale).rounded()))
        let h = max(16, Int((Double(cellH) * scale).rounded()))

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
            return nil
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
            return minC >= 224 && (maxC - minC) <= 28
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

        // Clear enclosed pure-white holes inside rigging/anchors/coral branches when !preserveInteriorWhite
        if !preserveInteriorWhite && !topSkyOnly {
            for idx in 0..<(w * h) {
                if visited[idx] != 0 { continue }
                let p = idx * 4
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let minC = min(r, min(g, b))
                let maxC = max(r, max(g, b))
                if minC >= 242 && (maxC - minC) <= 14 {
                    rgba[p] = 0
                    rgba[p + 1] = 0
                    rgba[p + 2] = 0
                    rgba[p + 3] = 0
                    visited[idx] = 1
                }
            }
        }

        // Boundary Color-to-Alpha unmixing on 2px halo around removed white background + tight bounding-box measurement
        var minX = w
        var minY = h
        var maxX = 0
        var maxY = 0

        if h > 2 && w > 2 {
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
                    if rgba[p + 3] > 20 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }
        }

        guard let outCG = ctx.makeImage() else { return nil }
        if topSkyOnly {
            return UIImage(cgImage: outCG)
        }
        guard maxX >= minX && maxY >= minY else { return nil }
        let pad = 2
        let cx = max(0, minX - pad)
        let cy = max(0, minY - pad)
        let cw = min(w - cx, (maxX - minX + 1) + pad * 2)
        let ch = min(h - cy, (maxY - minY + 1) + pad * 2)
        guard cw >= 18 && ch >= 18 else { return nil }
        let aspect = Double(cw) / Double(ch)
        guard aspect >= 0.18 && aspect <= 5.5 else { return nil }
        guard let tightCG = outCG.cropping(to: CGRect(x: cx, y: cy, width: cw, height: ch)) else {
            return nil
        }
        return UIImage(cgImage: tightCG)
    }

    /// Synthesizes a horizontally-seamless tile from an RGBA pixel buffer by cross-fading a seamRatio overlap band
    /// using a cosine weight curve (zero vertical seam lines between repeated tiles).
    nonisolated static func makeHorizontallySeamlessImage(
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

}
