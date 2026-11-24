import UIKit
import SpriteKit

// MARK: - SpriteAtlasManager Ocean Canopy, Seabed Strip & Ecology Processors

extension SpriteAtlasManager {
    /// Processes Layer 0 Water Canopy ('bg_shallow_0_water', 'bg_twilight_0', 'bg_abyss_0'):
    /// - Trims top/bottom white margins and right-edge white border on 'bg_shallow_0_water'
    /// - Smoothly unmixes the bottom #FFFFFF fade using a C1 cosine vertical envelope so sunbeams dissolve invisibly into the water column (zero horizontal cutoff line!)
    /// - Applies cosine horizontal cross-fading so repeated tiles have zero vertical seam lines!
    nonisolated static func processWaterLayerToSeamlessTile(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height
        let isShallowCanopy = assetName.contains("shallow_0_water") || (Double(srcW) / Double(max(1, srcH)) > 3.0)

        let cropLeft = Int((Double(srcW) * (isShallowCanopy ? 0.012 : 0.010)).rounded())
        let cropRight = Int((Double(srcW) * (isShallowCanopy ? 0.968 : 0.990)).rounded())
        let cropTop = Int((Double(srcH) * (isShallowCanopy ? 0.032 : 0.008)).rounded())
        let cropBot = Int((Double(srcH) * (isShallowCanopy ? 0.902 : 0.992)).rounded())
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
                // C1-continuous cosine vertical fade from v=0.18 down to v=0.95 (100% zero alpha at bottom edge)
                let normV = min(1.0, max(0.0, (v - 0.18) / 0.76))
                let verticalEnvelope = v <= 0.18
                    ? 1.0
                    : (v >= 0.94 ? 0.0 : pow(cos(normV * .pi * 0.5), 1.85))
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
        } else {
            // Soft vertical atmospheric envelope for deep-water backdrops (bg_twilight_0 & bg_abyss_0)
            // so they act as delicate volumetric light/ember veils rather than opaque full-screen wallpaper swaps
            for y in 0..<h {
                let v = Double(y) / Double(max(1, h - 1))
                let topEnv = v < 0.08 ? (0.65 + 0.35 * sin((v / 0.08) * .pi * 0.5)) : 1.0
                let botEnv = v <= 0.62 ? 1.0 : (0.16 + 0.84 * pow(cos(((v - 0.62) / 0.38) * .pi * 0.5), 1.5))
                let envAlpha = topEnv * botEnv
                let rowOff = y * w
                for x in 0..<w {
                    let idx = (rowOff + x) * 4
                    rgba[idx] = UInt8(max(0.0, min(255.0, (Double(rgba[idx]) * envAlpha).rounded())))
                    rgba[idx + 1] = UInt8(max(0.0, min(255.0, (Double(rgba[idx + 1]) * envAlpha).rounded())))
                    rgba[idx + 2] = UInt8(max(0.0, min(255.0, (Double(rgba[idx + 2]) * envAlpha).rounded())))
                    rgba[idx + 3] = UInt8(max(0.0, min(255.0, (Double(rgba[idx + 3]) * envAlpha).rounded())))
                }
            }
        }

        return makeHorizontallySeamlessImage(rgba: rgba, width: w, height: h, seamRatio: isShallowCanopy ? 0.10 : 0.14)
    }

    /// Processes Far / Mid / Near Ocean Terrain Layers ('bg_{zone}_{1|2|3}') with 1:1 parity to 'parallaxBackground.ts':
    nonisolated static func processTerrainLayerToSeamlessStrip(_ image: UIImage, assetName: String) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let srcW = cgImg.width
        let srcH = cgImg.height

        let isShallowFar = assetName.contains("shallow_1_far")
        let isShallowMid = assetName.contains("shallow_2_mid")
        let isShallowNear = assetName.contains("shallow_3_near")
        let unmixHydrothermalSmoke = assetName.contains("abyss_2") || assetName.contains("abyss_3")


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

        // 3B. Unmix soft grey/black hydrothermal smoke plumes painted over #FFFFFF sky on bg_abyss_2 & bg_abyss_3
        // while 100% preserving red-and-white tube worms in the lower volcanic bed (1:1 parity with Web parallaxBackground.ts)
        if unmixHydrothermalSmoke {
            let smokeMaxY = Int(Double(h) * 0.64)
            var smokeVisited = [UInt8](repeating: 0, count: w * h)
            var sHead = 0
            var sTail = 0

            func isSmokeMistCandidate(_ i: Int, _ y: Int) -> Bool {
                if y >= smokeMaxY { return false }
                let p = i * 4
                let r = Int(rgba[p])
                let g = Int(rgba[p + 1])
                let b = Int(rgba[p + 2])
                let minC = min(r, min(g, b))
                let maxC = max(r, max(g, b))
                return minC >= 78 && (maxC - minC) <= 32
            }

            for y in 0..<min(h, smokeMaxY) {
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if visited[i] != 0 {
                        smokeVisited[i] = 1
                        queue[sTail] = i
                        sTail += 1
                    }
                }
            }

            while sHead < sTail {
                let curr = queue[sHead]
                sHead += 1
                let cx = curr % w
                let cy = (curr - cx) / w
                let neighbors = [
                    cx > 0 ? curr - 1 : -1,
                    cx + 1 < w ? curr + 1 : -1,
                    cy > 0 ? curr - w : -1,
                    cy + 1 < smokeMaxY ? curr + w : -1
                ]
                for n in neighbors where n >= 0 && smokeVisited[n] == 0 {
                    let ny = n / w
                    if isSmokeMistCandidate(n, ny) {
                        smokeVisited[n] = 1
                        queue[sTail] = n
                        sTail += 1
                    }
                }
            }

            let fadeStartY = Double(h) * 0.52
            let fadeSpan = max(1.0, Double(smokeMaxY) - fadeStartY)
            for y in 0..<min(h, smokeMaxY) {
                let vertFade = Double(y) < fadeStartY ? 1.0 : max(0.0, (Double(smokeMaxY) - Double(y)) / fadeSpan)
                let rowOff = y * w
                for x in 0..<w {
                    let i = rowOff + x
                    if smokeVisited[i] == 0 || visited[i] != 0 { continue }
                    let p = i * 4
                    let r = Double(rgba[p])
                    let g = Double(rgba[p + 1])
                    let b = Double(rgba[p + 2])
                    let minC = min(r, min(g, b))
                    if minC >= 212.0 {
                        visited[i] = 1
                        rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
                    } else {
                        let rawSmokeAlpha = max(0.0, min(1.0, (212.0 - minC) / (212.0 - 78.0)))
                        let smokeAlpha = pow(rawSmokeAlpha, 1.2) * 0.92
                        let effAlpha = (1.0 - vertFade) + vertFade * smokeAlpha
                        let outA = Double(rgba[p + 3]) * effAlpha
                        if outA < 8.0 {
                            visited[i] = 1
                            rgba[p] = 0; rgba[p + 1] = 0; rgba[p + 2] = 0; rgba[p + 3] = 0
                        } else {
                            let targetR = r * (1.0 - vertFade) + 22.0 * vertFade
                            let targetG = g * (1.0 - vertFade) + 24.0 * vertFade
                            let targetB = b * (1.0 - vertFade) + 28.0 * vertFade
                            let aNorm = outA / 255.0
                            rgba[p] = UInt8(max(0.0, min(255.0, (targetR * aNorm).rounded())))
                            rgba[p + 1] = UInt8(max(0.0, min(255.0, (targetG * aNorm).rounded())))
                            rgba[p + 2] = UInt8(max(0.0, min(255.0, (targetB * aNorm).rounded())))
                            rgba[p + 3] = UInt8(max(0.0, min(255.0, outA.rounded())))
                        }
                    }
                }
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

    /// Prepares a standalone 2048x1152 realistic transparent seabed surface strip (seabed_strip_*.png):
    /// crops to the tight vertical opaque rock band, applies a smooth cosine bottom alpha fade, and cross-fades horizontally (ZERO vertical column smearing!).
    nonisolated static func sliceSeabedStrip(from image: UIImage, y0Ratio: Double, y1Ratio: Double) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let fullW = cgImg.width
        let fullH = cgImg.height
        let sy = max(0, Int((Double(fullH) * y0Ratio).rounded()))
        let ey = min(fullH, Int((Double(fullH) * y1Ratio).rounded()))
        let rawH = max(32, ey - sy)
        let padX = max(2, Int((Double(fullW) * 0.008).rounded()))
        let rawW = max(64, fullW - padX * 2)

        guard let croppedCG = cgImg.cropping(to: CGRect(x: padX, y: sy, width: rawW, height: rawH)) else {
            return nil
        }

        let targetW = min(1024, rawW)
        let scale = Double(targetW) / Double(rawW)
        let w = max(64, targetW)
        let h = max(32, Int((Double(rawH) * scale).rounded()))
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

        // Find tight vertical opaque bounding box [minY, maxY] without any vertical column smearing
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
            if opaqueCount >= 6 {
                if y < minY { minY = y }
                if y > maxY { maxY = y }
            }
        }
        if maxY <= minY + 16 {
            minY = 0; maxY = h - 1
        } else {
            minY = max(0, minY - 2)
            maxY = min(h - 1, max(minY + 24, maxY))
        }

        let cropH = maxY - minY + 1
        let bottomFeatherStart = Int(Double(cropH) * 0.72)
        var croppedRgba = [UInt8](repeating: 0, count: w * cropH * 4)
        for y in 0..<cropH {
            var bottomFade = 1.0
            if y >= bottomFeatherStart {
                let ft = Double(y - bottomFeatherStart) / Double(max(1, cropH - 1 - bottomFeatherStart))
                bottomFade = 0.5 * (1.0 + cos(.pi * min(1.0, ft)))
            }
            let srcOff = (minY + y) * w * 4
            let dstOff = y * w * 4
            for x in 0..<w {
                let sp = srcOff + x * 4
                let dp = dstOff + x * 4
                croppedRgba[dp] = UInt8((Double(rgba[sp]) * bottomFade).rounded())
                croppedRgba[dp + 1] = UInt8((Double(rgba[sp + 1]) * bottomFade).rounded())
                croppedRgba[dp + 2] = UInt8((Double(rgba[sp + 2]) * bottomFade).rounded())
                croppedRgba[dp + 3] = UInt8((Double(rgba[sp + 3]) * bottomFade).rounded())
            }
        }

        return makeHorizontallySeamlessImage(rgba: croppedRgba, width: w, height: cropH, seamRatio: 0.12)
    }

    /// Builds a 2D-continuous, horizontally & vertically feathered subsurface bedrock stratum tile
    /// by sampling each column's smoothed interior opaque rock band from the standalone 2048x1152 seabed PNG (ZERO 1D vertical stripe repetition!).
    nonisolated static func sliceSeabedSubStratum(
        from image: UIImage,
        stripId: String,
        y0Ratio: Double,
        y1Ratio: Double
    ) -> UIImage? {
        guard let cgImg = image.cgImage else { return nil }
        let fullW = cgImg.width
        let fullH = cgImg.height
        let padX = max(2, Int((Double(fullW) * 0.008).rounded()))
        let rawW = max(64, fullW - padX * 2)

        guard let croppedCG = cgImg.cropping(to: CGRect(x: padX, y: 0, width: rawW, height: fullH)) else {
            return nil
        }

        let w = 960
        let workH = 540
        let outH = 240
        var srcRgba = [UInt8](repeating: 0, count: w * workH * 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &srcRgba,
            width: w,
            height: workH,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: w, height: workH))

        // 1. Detect per-column opaque rock span [rawTopY, rawBotY] and smooth horizontally across a 65px window
        var rawTopY = [Double](repeating: Double(workH) * 0.25, count: w)
        var rawBotY = [Double](repeating: Double(workH) * 0.72, count: w)
        for x in 0..<w {
            var top = Int(Double(workH) * 0.25)
            var bot = Int(Double(workH) * 0.72)
            for y in 0..<workH {
                if srcRgba[(y * w + x) * 4 + 3] > 200 {
                    top = y
                    break
                }
            }
            for y in stride(from: workH - 1, through: top, by: -1) {
                if srcRgba[(y * w + x) * 4 + 3] > 200 {
                    bot = y
                    break
                }
            }
            if bot <= top + 16 {
                top = Int(Double(workH) * 0.25)
                bot = Int(Double(workH) * 0.72)
            }
            rawTopY[x] = Double(top)
            rawBotY[x] = Double(bot)
        }

        var colTopY = [Double](repeating: 0.0, count: w)
        var colBotY = [Double](repeating: 0.0, count: w)
        let smoothRadius = 32
        for x in 0..<w {
            var sumT = 0.0
            var sumB = 0.0
            var cnt = 0.0
            for dx in -smoothRadius...smoothRadius {
                let sx = (x + dx + w) % w
                sumT += rawTopY[sx]
                sumB += rawBotY[sx]
                cnt += 1.0
            }
            colTopY[x] = sumT / cnt
            colBotY[x] = max(colTopY[x] + 24.0, sumB / cnt)
        }

        // 2. Sample true 2D interior rock band [top + 0.24*span, bot - 0.08*span] with cosine top/bottom feathering
        var outRgba = [UInt8](repeating: 0, count: w * outH * 4)
        let topFeatherEnd = Int(Double(outH) * 0.20)
        let bottomFeatherStart = Int(Double(outH) * 0.76)

        for y in 0..<outH {
            var vAlpha = 1.0
            if y < topFeatherEnd {
                let ft = Double(y) / Double(max(1, topFeatherEnd))
                vAlpha = 0.5 * (1.0 - cos(.pi * ft))
            } else if y >= bottomFeatherStart {
                let ft = Double(y - bottomFeatherStart) / Double(max(1, outH - 1 - bottomFeatherStart))
                vAlpha = 0.5 * (1.0 + cos(.pi * min(1.0, ft)))
            }
            let v = Double(y) / Double(max(1, outH - 1))
            let shade = (0.88 - v * 0.18) * vAlpha

            for x in 0..<w {
                let cTop = colTopY[x]
                let cBot = colBotY[x]
                let span = max(24.0, cBot - cTop)
                let inTop = cTop + span * 0.24
                let inBot = max(inTop + 12.0, cBot - span * 0.08)
                let inSpan = max(12.0, inBot - inTop)

                let sy = min(workH - 1, max(0, Int((inTop + v * inSpan).rounded())))
                var sIdx = (sy * w + x) * 4
                if srcRgba[sIdx + 3] < 190 {
                    let altOffset = Double((y * 17 + x * 3) % max(8, Int(span * 0.25)))
                    let altY = min(workH - 1, max(0, Int((cTop + span * 0.42 + altOffset).rounded())))
                    sIdx = (altY * w + x) * 4
                }

                let dIdx = (y * w + x) * 4
                outRgba[dIdx] = UInt8(max(0.0, min(255.0, (Double(srcRgba[sIdx]) * shade).rounded())))
                outRgba[dIdx + 1] = UInt8(max(0.0, min(255.0, (Double(srcRgba[sIdx + 1]) * shade).rounded())))
                outRgba[dIdx + 2] = UInt8(max(0.0, min(255.0, (Double(srcRgba[sIdx + 2]) * shade).rounded())))
                outRgba[dIdx + 3] = UInt8(max(0.0, min(255.0, (255.0 * vAlpha).rounded())))
            }
        }

        return makeHorizontallySeamlessImage(rgba: outRgba, width: w, height: outH, seamRatio: 0.12)
    }

    /// Cleans standalone @3x ecology PNGs: removes top white/grey static smoke on hydrothermal vents,
    /// softens bottom 16% rock base alpha for seamless seabed embedding, and tight-crops non-transparent bounds
    nonisolated static func prepareStandaloneEcologyImage(
        from image: UIImage,
        removeTopWhiteSmoke: Bool
    ) -> UIImage? {
        guard let cg = image.cgImage else { return nil }
        let maxDim = 360.0
        let scale = min(1.0, maxDim / Double(max(cg.width, cg.height)))
        let w = max(24, Int((Double(cg.width) * scale).rounded()))
        let h = max(24, Int((Double(cg.height) * scale).rounded()))

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
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

        if removeTopWhiteSmoke {
            let smokeCutY = Int(Double(h) * 0.28)
            for y in 0..<smokeCutY {
                let vRatio = Double(y) / Double(max(1, smokeCutY))
                for x in 0..<w {
                    let p = (y * w + x) * 4
                    let a = rgba[p + 3]
                    if a == 0 { continue }
                    let r = Int(rgba[p])
                    let g = Int(rgba[p + 1])
                    let b = Int(rgba[p + 2])
                    let maxC = max(r, max(g, b))
                    let minC = min(r, min(g, b))
                    let sat = maxC - minC
                    if vRatio < 0.62 || (minC > 95 && sat < 48) || (r > 135 && g > 115 && b > 105 && sat < 64) {
                        let keep = vRatio < 0.62 ? 0.0 : max(0.0, min(1.0, (vRatio - 0.62) / 0.38)) * 0.35
                        rgba[p] = UInt8((Double(r) * keep).rounded())
                        rgba[p + 1] = UInt8((Double(g) * keep).rounded())
                        rgba[p + 2] = UInt8((Double(b) * keep).rounded())
                        rgba[p + 3] = UInt8((Double(a) * keep).rounded())
                    }
                }
            }
        }

        var minX = w
        var minY = h
        var maxX = 0
        var maxY = 0
        for y in 0..<h {
            for x in 0..<w {
                if rgba[(y * w + x) * 4 + 3] > 24 {
                    if x < minX { minX = x }
                    if x > maxX { maxX = x }
                    if y < minY { minY = y }
                    if y > maxY { maxY = y }
                }
            }
        }
        guard maxX >= minX && maxY >= minY else { return nil }

        let boxH = max(1, maxY - minY + 1)
        let featherStartY = minY + Int(Double(boxH) * 0.84)
        for y in minY...maxY {
            var baseFade = 1.0
            if y >= featherStartY {
                let t = Double(y - featherStartY) / Double(max(1, maxY - featherStartY))
                baseFade = 0.5 * (1.0 + cos(.pi * min(1.0, t * 0.82)))
            }
            for x in minX...maxX {
                let p = (y * w + x) * 4
                let a = rgba[p + 3]
                if a == 0 { continue }
                rgba[p] = UInt8((Double(rgba[p]) * 0.90 * baseFade).rounded())
                rgba[p + 1] = UInt8((Double(rgba[p + 1]) * 0.93 * baseFade).rounded())
                rgba[p + 2] = UInt8((min(255.0, Double(rgba[p + 2]) * 0.96 + 6.0) * baseFade).rounded())
                rgba[p + 3] = UInt8((Double(a) * baseFade).rounded())
            }
        }

        guard let fullCG = ctx.makeImage() else { return nil }
        let pad = 2
        let cx = max(0, minX - pad)
        let cy = max(0, minY - pad)
        let cw = min(w - cx, (maxX - minX + 1) + pad * 2)
        let ch = min(h - cy, (maxY - minY + 1) + pad * 2)
        guard cw >= 18 && ch >= 18,
              let tightCG = fullCG.cropping(to: CGRect(x: cx, y: cy, width: cw, height: ch)) else {
            return nil
        }
        return UIImage(cgImage: tightCG)
    }

    /// Slices the 4x4 World Ecology Atlas (world_ecology_atlas_1794473252524.jpg) into 16 transparent SKTextures
    /// using exact [x0, y0, x1, y1] normalized bounds and matching the true 4x4 layout of the atlas!
    nonisolated static func sliceWorldEcologyAtlas(from image: UIImage) -> [String: SKTexture] {
        var out: [String: SKTexture] = [:]
        // True 4x4 layout of world_ecology_atlas_1794473252524.jpg:
        // Row 0: pink staghorn, cyan brain coral, purple sea fan, tube sponge
        // Row 1: basalt boulder, mossy stepped slab, cyan-fissured spire, black smoker chimney
        // Row 2: green seagrass, cyan ribbon grass, golden giant kelp, cyan bubble fissure rock
        // Row 3: rusted anchor, ship wheel & planks, sunken cannon, bioluminescent anemones
        let rows: [[String]] = [
            ["coral_1", "coral_2", "coral_3", "coral_4"],
            ["rock_1",  "rock_2",  "rock_3",  "vent_1"],
            ["kelp_1",  "kelp_2",  "kelp_3",  "vent_2"],
            ["vent_3",  "rock_4",  "debris_1", "vent_4"]
        ]
        for r in 0..<4 {
            for c in 0..<4 {
                let id = rows[r][c]
                let bounds = SIMD4<Double>(
                    Double(c) * 0.25 + 0.015,
                    Double(r) * 0.25 + 0.015,
                    Double(c + 1) * 0.25 - 0.015,
                    Double(r + 1) * 0.25 - 0.015
                )
                if let uiImg = sliceAndKeyNormalizedCell(from: image, bounds: bounds, preserveInteriorWhite: false) {
                    let tex = SKTexture(image: uiImg)
                    tex.filteringMode = .linear
                    out[id] = tex
                }
            }
        }
        if out["kelp_4"] == nil {
            out["kelp_4"] = out["kelp_2"] ?? out["kelp_1"]
        }
        return out
    }

    /// Slices the 10 Landmark POIs from world_pois_atlas_1794473250443.jpg into transparent SKTextures
    /// using the exact [x0, y0, x1, y1] normalized bounds from Web (100% eliminates 1px barcode slices!)
    nonisolated static func sliceWorldPoisAtlas(from image: UIImage) -> [String: SKTexture] {
        var out: [String: SKTexture] = [:]
        let defs: [(id: String, bounds: SIMD4<Double>)] = [
            // Row 1 (Top 5 landmarks)
            ("shipwreck_1", SIMD4(0.005, 0.010, 0.268, 0.370)),
            ("arch_1",      SIMD4(0.265, 0.040, 0.465, 0.375)),
            ("treasure_1",  SIMD4(0.465, 0.080, 0.602, 0.375)),
            ("nest_1",      SIMD4(0.602, 0.080, 0.782, 0.375)),
            ("skeleton_1",  SIMD4(0.782, 0.060, 0.992, 0.375)),
            // Row 2 (Bottom 5 landmarks)
            ("shipwreck_2", SIMD4(0.008, 0.660, 0.242, 0.985)),
            ("arch_2",      SIMD4(0.245, 0.640, 0.455, 0.985)),
            ("treasure_2",  SIMD4(0.458, 0.690, 0.618, 0.985)),
            ("nest_2",      SIMD4(0.618, 0.680, 0.835, 0.985)),
            ("statue_1",    SIMD4(0.835, 0.540, 0.988, 0.985))
        ]
        for def in defs {
            if let uiImg = sliceAndKeyNormalizedCell(from: image, bounds: def.bounds, preserveInteriorWhite: false) {
                let tex = SKTexture(image: uiImg)
                tex.filteringMode = .linear
                out[def.id] = tex
            }
        }
        out["statue_2"] = out["statue_1"]
        out["skeleton_2"] = out["nest_2"] ?? out["skeleton_1"]
        return out
    }

    /// Generates a soft radial abyssal portal shadow texture for downward-curved cave openings
    nonisolated static func makeCavePortalShadowTexture() -> SKTexture? {
        let size = 128
        var rgba = [UInt8](repeating: 0, count: size * size * 4)
        let center = Double(size - 1) * 0.5
        let maxR = Double(size) * 0.5
        for y in 0..<size {
            for x in 0..<size {
                let dx = Double(x) - center
                let dy = Double(y) - center
                let r = min(1.0, hypot(dx, dy) / maxR)
                let alpha = pow(1.0 - r * r, 1.8) * 0.76
                let idx = (y * size + x) * 4
                let rCol = 4.0 * alpha
                let gCol = 16.0 * alpha
                let bCol = 36.0 * alpha
                rgba[idx] = UInt8(max(0.0, min(255.0, rCol.rounded())))
                rgba[idx + 1] = UInt8(max(0.0, min(255.0, gCol.rounded())))
                rgba[idx + 2] = UInt8(max(0.0, min(255.0, bCol.rounded())))
                rgba[idx + 3] = UInt8(max(0.0, min(255.0, (alpha * 255.0).rounded())))
            }
        }
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &rgba,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: size * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
        ), let cgImg = ctx.makeImage() else { return nil }
        let tex = SKTexture(cgImage: cgImg)
        tex.filteringMode = .linear
        return tex
    }
}
