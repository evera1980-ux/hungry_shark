import SpriteKit
import UIKit
import simd

/// World-locked 1:1 physical seabed, 9-tier breakable terrace rock strata & composite coral outcrop renderer.
extension OceanGameScene {
    func acquirePooledArchFillNode() -> SKShapeNode {
        if activeSeabedArchFillCount < seabedArchFillPool.count {
            let node = seabedArchFillPool[activeSeabedArchFillCount]
            activeSeabedArchFillCount += 1
            node.isHidden = false
            node.strokeColor = .clear
            node.lineWidth = 0.0
            node.glowWidth = 0.0
            return node
        }
        let node = SKShapeNode()
        node.strokeColor = .clear
        node.lineWidth = 0.0
        node.glowWidth = 0.0
        parallaxContainer.addChild(node)
        seabedArchFillPool.append(node)
        activeSeabedArchFillCount += 1
        return node
    }

    func acquirePooledParallaxTile() -> SKSpriteNode {
        if activeParallaxTileCount < parallaxTilePool.count {
            let node = parallaxTilePool[activeParallaxTileCount]
            activeParallaxTileCount += 1
            node.isHidden = false
            return node
        }
        let node = SKSpriteNode()
        node.anchorPoint = CGPoint(x: 0, y: 0)
        parallaxContainer.addChild(node)
        parallaxTilePool.append(node)
        activeParallaxTileCount += 1
        return node
    }

    private func addWarpedWorldStripSlice(
        texture: SKTexture,
        x0: Double,
        x1: Double,
        uSrc0: Double,
        uSrc1: Double,
        topEYAt: (Double) -> Double,
        botEYAt: (Double) -> Double,
        alpha: Double,
        zPos: CGFloat,
        cols: Int = 8,
        color: UIColor = .clear,
        colorBlendFactor: Double = 0.0
    ) {
        let spanW = x1 - x0
        guard spanW > 0.25 && alpha > 0.008 else { return }

        let safeCols = max(2, min(10, cols))
        var topYs = [Double](repeating: 0.0, count: safeCols + 1)
        var botYs = [Double](repeating: 0.0, count: safeCols + 1)
        var minY = Double.greatestFiniteMagnitude
        var maxY = -Double.greatestFiniteMagnitude

        for c in 0...safeCols {
            let u = Double(c) / Double(safeCols)
            let ty = topEYAt(u)
            let by = min(ty - 1.0, botEYAt(u))
            topYs[c] = ty
            botYs[c] = by
            if by < minY { minY = by }
            if ty > maxY { maxY = ty }
        }

        let boxH = max(4.0, maxY - minY)
        let node = acquirePooledParallaxTile()
        node.texture = texture
        node.anchorPoint = CGPoint(x: 0.0, y: 0.0)
        node.xScale = 1.0
        node.yScale = 1.0
        node.zRotation = 0.0
        node.size = CGSize(width: spanW, height: boxH)
        node.position = CGPoint(x: x0, y: minY)
        node.alpha = CGFloat(alpha)
        node.zPosition = zPos
        node.color = color
        node.colorBlendFactor = CGFloat(max(0.0, min(0.85, colorBlendFactor)))

        let count = (safeCols + 1) * 2
        seabedWarpSrc.removeAll(keepingCapacity: true)
        seabedWarpDst.removeAll(keepingCapacity: true)
        if seabedWarpSrc.capacity < count { seabedWarpSrc.reserveCapacity(count) }
        if seabedWarpDst.capacity < count { seabedWarpDst.reserveCapacity(count) }

        for row in 0...1 {
            let vSrc = Float(row)
            for col in 0...safeCols {
                let uNorm = Float(col) / Float(safeCols)
                let uSrc = Float(uSrc0 + (uSrc1 - uSrc0) * Double(uNorm))
                seabedWarpSrc.append(SIMD2<Float>(uSrc, vSrc))
                let targetY = (row == 0) ? botYs[col] : topYs[col]
                let vDst = Float((targetY - minY) / boxH)
                seabedWarpDst.append(SIMD2<Float>(uNorm, vDst))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: safeCols, rows: 1, sourcePositions: seabedWarpSrc, destinationPositions: seabedWarpDst)
    }

    /// Maps any continuous world span [wx0, wx1] to exact world-locked periodic UVs [0..1] (splitting cleanly across seam=1.0),
    /// eliminating all texture squishing, alternating mirror seams, or popping on camera scroll.
    private func addWorldLockedWarpedSpan(
        texture: SKTexture,
        wx0: Double,
        wx1: Double,
        periodWorldW: Double,
        uPhase: Double = 0.0,
        alpha: Double,
        zPos: CGFloat,
        color: UIColor = .clear,
        colorBlendFactor: Double = 0.0,
        toScreenX: (Double) -> Double,
        topEYAtWX: (Double) -> Double,
        botEYAtWX: (Double) -> Double
    ) {
        guard wx1 > wx0 + 0.25 && alpha > 0.008 else { return }
        let safePeriod = max(80.0, periodWorldW)
        var curWX = wx0
        var safety = 0

        while curWX < wx1 - 0.25 && safety < 16 {
            safety += 1
            let rawU = curWX / safePeriod + uPhase
            var u0 = rawU - floor(rawU)
            if u0 >= 0.9995 { u0 = 0.0 }
            let remToSeamU = max(1e-4, 1.0 - u0)
            let spanU = (wx1 - curWX) / safePeriod
            let stepU = min(remToSeamU, spanU)
            let nextWX = min(wx1, curWX + stepU * safePeriod)
            let u1 = min(1.0, u0 + stepU)
            let segSpan = nextWX - curWX
            if segSpan > 0.25 {
                let sliceWX0 = curWX
                let cols = max(3, min(9, Int(ceil(segSpan / 60.0)) + 2))
                addWarpedWorldStripSlice(
                    texture: texture,
                    x0: toScreenX(sliceWX0),
                    x1: toScreenX(nextWX),
                    uSrc0: u0,
                    uSrc1: u1,
                    topEYAt: { frac in topEYAtWX(sliceWX0 + frac * segSpan) },
                    botEYAt: { frac in botEYAtWX(sliceWX0 + frac * segSpan) },
                    alpha: alpha,
                    zPos: zPos,
                    cols: cols,
                    color: color,
                    colorBlendFactor: colorBlendFactor
                )
            }
            curWX = nextWX
        }
    }

    private func resolveSeabedStripPairForDepth(_ depthMeters: Double) -> (primary: String, secondary: String?, blend: Double) {
        if depthMeters < 1500.0 {
            return ("coral_reef", nil, 0.0)
        } else if depthMeters < 2300.0 {
            return ("coral_reef", "rocky_shelf", (depthMeters - 1500.0) / 800.0)
        } else if depthMeters < 5400.0 {
            return ("rocky_shelf", nil, 0.0)
        } else if depthMeters < 6600.0 {
            return ("rocky_shelf", "underwater_canyon", (depthMeters - 5400.0) / 1200.0)
        } else if depthMeters < 11800.0 {
            return ("underwater_canyon", nil, 0.0)
        } else if depthMeters < 13400.0 {
            return ("underwater_canyon", "deep_abyss", (depthMeters - 11800.0) / 1600.0)
        } else {
            return ("deep_abyss", nil, 0.0)
        }
    }

    private func sampleMainSeabedFillColor(depthMeters: Double) -> UIColor {
        // Continuous depth-locked bedrock color (never hard-snaps on cameraY crossing a constant!)
        if depthMeters < 1800.0 {
            return UIColor(red: 28/255, green: 52/255, blue: 74/255, alpha: 0.96)
        } else if depthMeters < 5800.0 {
            return UIColor(red: 16/255, green: 34/255, blue: 58/255, alpha: 0.96)
        } else if depthMeters < 12500.0 {
            return UIColor(red: 10/255, green: 18/255, blue: 34/255, alpha: 0.98)
        } else {
            return UIColor(red: 18/255, green: 11/255, blue: 14/255, alpha: 0.98)
        }
    }

    func renderPhysicalSeabedAndEcology(
        viewW: Double,
        viewH: Double,
        zoom: Double
    ) {
        let halfWorldW = (viewW * 0.5) / zoom + 480.0
        let startWorldX = cameraX - halfWorldW
        let endWorldX = cameraX + halfWorldW

        let toScreenX: (Double) -> Double = { wx in
            (wx - self.cameraX) * zoom + viewW * 0.5
        }
        let toScreenY: (Double) -> Double = { wy in
            viewH * 0.5 - (wy - self.cameraY) * zoom
        }

        let tileWorldW = 680.0
        // 1:1 visual-to-physical alignment with Web renderPhysicalSeabed under true camera zoom
        let mainCrestLift = 20.0
        let mainStripWorldH = 148.0

        // 1A. Main Floor Underfill Polygon (prevents any sub-pixel gap below subsurface strata)
        let firstTile = Int(floor(startWorldX / tileWorldW))
        let lastTile = Int(ceil(endWorldX / tileWorldW))
        var anyMainFloorVisible = false
        var visFloorDepthSum = 0.0
        var visFloorDepthCount = 0.0
        for tIdx in firstTile...lastTile {
            let fy0 = GameRules.getFloorDepthAt(worldX: Double(tIdx) * tileWorldW)
            let fy1 = GameRules.getFloorDepthAt(worldX: Double(tIdx + 1) * tileWorldW)
            let top0 = toScreenY(fy0 - mainCrestLift)
            let top1 = toScreenY(fy1 - mainCrestLift)
            if max(top0, top1) > -220.0 {
                anyMainFloorVisible = true
                visFloorDepthSum += (fy0 + fy1) * 0.5
                visFloorDepthCount += 1.0
            }
        }

        if anyMainFloorVisible {
            let avgFloorDepth = visFloorDepthCount > 0.0 ? (visFloorDepthSum / visFloorDepthCount) : cameraY
            let fillNode = acquirePooledArchFillNode()
            fillNode.zPosition = 2.6
            let path = CGMutablePath()
            let stepW = zoom < 0.45 ? 160.0 : 80.0
            let firstX = floor(startWorldX / stepW) * stepW
            let bottomFillY = min(-640.0, -viewH - 240.0)
            path.move(to: CGPoint(x: toScreenX(firstX), y: bottomFillY))
            var wx = firstX
            while wx <= endWorldX + stepW {
                let fy = GameRules.getFloorDepthAt(worldX: wx)
                let sy = toScreenY(fy + 22.0)
                path.addLine(to: CGPoint(x: toScreenX(wx), y: sy))
                wx += stepW
            }
            path.addLine(to: CGPoint(x: toScreenX(wx), y: bottomFillY))
            path.closeSubpath()
            fillNode.path = path
            fillNode.fillColor = sampleMainSeabedFillColor(depthMeters: avgFloorDepth)

            // 1B. Main Floor Multi-Tier Subsurface Bedrock Strata + Top Surface Strip
            let allSubLayerSpecs: [(yStartWorld: Double, subWorldH: Double, uPhase: Double, alpha: Double, shade: Double, zOff: CGFloat)] = [
                (34.0, 210.0, 0.37, 0.95, 0.18, 2.8),
                (185.0, 250.0, 0.74, 0.92, 0.38, 2.7),
                (375.0, 290.0, 0.19, 0.88, 0.56, 2.65)
            ]
            // Zoomed-out LOD: render top stratum when wide-angle giant view spans many tiles
            let subLayerSpecs = zoom < 0.42 ? Array(allSubLayerSpecs.prefix(1)) : allSubLayerSpecs

            for tIdx in firstTile...lastTile {
                let wx0 = Double(tIdx) * tileWorldW
                let wx1 = wx0 + tileWorldW
                let sx0 = toScreenX(wx0)
                let sx1 = toScreenX(wx1)
                if sx1 < -80.0 || sx0 > viewW + 80.0 { continue }

                let fy0 = GameRules.getFloorDepthAt(worldX: wx0)
                let fy1 = GameRules.getFloorDepthAt(worldX: wx1)
                let segDepthM = (fy0 + fy1) * 0.5
                let pair = resolveSeabedStripPairForDepth(segDepthM)
                guard let priTex = SpriteAtlasManager.shared.seabedStripTexture(for: pair.primary) else { continue }
                let priSubTex = SpriteAtlasManager.shared.seabedSubStratumTexture(for: pair.primary) ?? priTex
                let secTex = pair.secondary.flatMap { SpriteAtlasManager.shared.seabedStripTexture(for: $0) }
                let secSubTex = pair.secondary.flatMap { SpriteAtlasManager.shared.seabedSubStratumTexture(for: $0) } ?? secTex

                for sub in subLayerSpecs {
                    let topCheck = toScreenY(min(fy0, fy1) + sub.yStartWorld)
                    let subScreenH = sub.subWorldH * zoom
                    if topCheck < -subScreenH - 80.0 { continue }

                    if let sSub = secSubTex, pair.blend > 0.02 {
                        addWorldLockedWarpedSpan(
                            texture: priSubTex,
                            wx0: wx0,
                            wx1: wx1,
                            periodWorldW: tileWorldW,
                            uPhase: sub.uPhase,
                            alpha: sub.alpha * (1.0 - pair.blend),
                            zPos: sub.zOff,
                            color: .black,
                            colorBlendFactor: sub.shade,
                            toScreenX: toScreenX,
                            topEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) + sub.yStartWorld) },
                            botEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) + sub.yStartWorld + sub.subWorldH) }
                        )
                        addWorldLockedWarpedSpan(
                            texture: sSub,
                            wx0: wx0,
                            wx1: wx1,
                            periodWorldW: tileWorldW,
                            uPhase: sub.uPhase,
                            alpha: sub.alpha * pair.blend,
                            zPos: sub.zOff + 0.005,
                            color: .black,
                            colorBlendFactor: sub.shade,
                            toScreenX: toScreenX,
                            topEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) + sub.yStartWorld) },
                            botEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) + sub.yStartWorld + sub.subWorldH) }
                        )
                    } else {
                        addWorldLockedWarpedSpan(
                            texture: priSubTex,
                            wx0: wx0,
                            wx1: wx1,
                            periodWorldW: tileWorldW,
                            uPhase: sub.uPhase,
                            alpha: sub.alpha,
                            zPos: sub.zOff,
                            color: .black,
                            colorBlendFactor: sub.shade,
                            toScreenX: toScreenX,
                            topEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) + sub.yStartWorld) },
                            botEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) + sub.yStartWorld + sub.subWorldH) }
                        )
                    }
                }

                // Main Seabed Top Surface Strip (aligned 1:1 with physical floorDepthAt, zero alternating mirror seams!)
                if let sTex = secTex, pair.blend > 0.02 {
                    addWorldLockedWarpedSpan(
                        texture: priTex,
                        wx0: wx0,
                        wx1: wx1,
                        periodWorldW: tileWorldW,
                        uPhase: 0.0,
                        alpha: 0.98 * (1.0 - pair.blend),
                        zPos: 3.2,
                        toScreenX: toScreenX,
                        topEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) - mainCrestLift) },
                        botEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) - mainCrestLift + mainStripWorldH) }
                    )
                    addWorldLockedWarpedSpan(
                        texture: sTex,
                        wx0: wx0,
                        wx1: wx1,
                        periodWorldW: tileWorldW,
                        uPhase: 0.0,
                        alpha: 0.98 * pair.blend,
                        zPos: 3.21,
                        toScreenX: toScreenX,
                        topEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) - mainCrestLift) },
                        botEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) - mainCrestLift + mainStripWorldH) }
                    )
                } else {
                    addWorldLockedWarpedSpan(
                        texture: priTex,
                        wx0: wx0,
                        wx1: wx1,
                        periodWorldW: tileWorldW,
                        uPhase: 0.0,
                        alpha: 0.98,
                        zPos: 3.2,
                        toScreenX: toScreenX,
                        topEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) - mainCrestLift) },
                        botEYAtWX: { wx in toScreenY(GameRules.getFloorDepthAt(worldX: wx) - mainCrestLift + mainStripWorldH) }
                    )
                }
            }
        }

        // 2. Render 9 Non-Uniformly Spaced Continuous Seabed Terraces (414m down to 16,900m)
        let terraceCrestLift = 18.0
        let terraceStripWorldH = 124.0
        let terracePeriodW = 540.0
        let allTerraceSubLayers: [(yStartWorld: Double, subWorldH: Double, uPhase: Double, alpha: Double, shade: Double, zOff: CGFloat)] = [
            (28.0, 118.0, 0.37, 0.94, 0.16, 3.52),
            (102.0, 144.0, 0.74, 0.90, 0.34, 3.46)
        ]
        let terraceSubLayers = zoom < 0.45 ? Array(allTerraceSubLayers.prefix(1)) : allTerraceSubLayers

        for (tierIdx, tier) in GameRules.seabedTerraceTiers.enumerated() {
            let minScreenY = toScreenY(tier.baseDepth + 440.0)
            let maxScreenY = toScreenY(tier.baseDepth - 240.0)
            if minScreenY > viewH + 260.0 || maxScreenY < -260.0 { continue }

            guard let tierStripTex = SpriteAtlasManager.shared.seabedStripTexture(for: tier.stripId) else { continue }
            let tierSubTex = SpriteAtlasManager.shared.seabedSubStratumTexture(for: tier.stripId) ?? tierStripTex

            // Analytical world-grid seam indices (100% invariant to viewport scrolling!)
            let firstCell = Int(floor((startWorldX - tier.seamPhaseOffsetX) / tier.cellWidth)) - 1
            let lastCell = Int(ceil((endWorldX - tier.seamPhaseOffsetX) / tier.cellWidth)) + 1

            let portalShadowTex = SpriteAtlasManager.shared.cavePortalShadowTexture()
            let deepOceanHazeColor = tier.stripId == "deep_abyss"
                ? UIColor(red: 8/255, green: 10/255, blue: 22/255, alpha: 1.0)
                : UIColor(red: 7/255, green: 26/255, blue: 52/255, alpha: 1.0)
            let tierUPhase = Double(tierIdx) * 0.17

            func hasOpeningAtSeam(_ seamIdx: Int) -> Bool {
                if tier.skipZeroSeam && seamIdx == 0 { return false }
                let seamWX = Double(seamIdx) * tier.cellWidth + tier.seamPhaseOffsetX
                let seamFloorY = GameRules.getFloorDepthAt(worldX: seamWX)
                return seamFloorY > tier.minMainFloorForOpening
            }

            // 2A. Analytical Cave Backwall Bowl Rendering
            for seamIdx in firstCell...(lastCell + 1) {
                if !hasOpeningAtSeam(seamIdx) { continue }
                let seamWX = Double(seamIdx) * tier.cellWidth + tier.seamPhaseOffsetX
                let openLeftWX = seamWX - tier.openingHalfWidth
                let openRightWX = seamWX + tier.openingHalfWidth
                let bowlLeftWX = seamWX - tier.bowlHalfWidth * 1.02
                let bowlRightWX = seamWX + tier.bowlHalfWidth * 1.02

                let sxLeft = toScreenX(bowlLeftWX)
                let sxRight = toScreenX(bowlRightWX)
                if sxRight < -140.0 || sxLeft > viewW + 140.0 { continue }

                let sCenter = GameRules.getSeabedTerraceAt(worldX: seamWX, tierIndex: tierIdx)
                if !sCenter.isDiveOpening && sCenter.caveFactor <= 0.02 { continue }

                func clampBowlBotY(wx: Double, rawDepthOffset: Double) -> Double {
                    let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                    let rawBot = s.topY + rawDepthOffset
                    let distPastLip = abs(wx - seamWX) - tier.openingHalfWidth
                    if distPastLip > 0.0 {
                        let tuckT = min(1.0, distPastLip / 42.0)
                        let safeMaxBot = s.bottomArchY - 10.0
                        let clamped = rawBot + (min(rawBot, safeMaxBot) - rawBot) * tuckT
                        return toScreenY(clamped)
                    }
                    return toScreenY(rawBot)
                }

                addWorldLockedWarpedSpan(
                    texture: tierSubTex,
                    wx0: bowlLeftWX,
                    wx1: bowlRightWX,
                    periodWorldW: terracePeriodW,
                    uPhase: tierUPhase + 0.31,
                    alpha: 0.84,
                    zPos: 3.35,
                    color: deepOceanHazeColor,
                    colorBlendFactor: 0.56,
                    toScreenX: toScreenX,
                    topEYAtWX: { wx in toScreenY(GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx).topY + 22.0) },
                    botEYAtWX: { wx in clampBowlBotY(wx: wx, rawDepthOffset: 162.0) }
                )

                addWorldLockedWarpedSpan(
                    texture: tierSubTex,
                    wx0: bowlLeftWX,
                    wx1: bowlRightWX,
                    periodWorldW: terracePeriodW,
                    uPhase: tierUPhase + 0.67,
                    alpha: 0.68,
                    zPos: 3.342,
                    color: deepOceanHazeColor,
                    colorBlendFactor: 0.68,
                    toScreenX: toScreenX,
                    topEYAtWX: { wx in toScreenY(GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx).topY + 104.0) },
                    botEYAtWX: { wx in clampBowlBotY(wx: wx, rawDepthOffset: 248.0) }
                )

                addWorldLockedWarpedSpan(
                    texture: tierStripTex,
                    wx0: bowlLeftWX,
                    wx1: bowlRightWX,
                    periodWorldW: terracePeriodW,
                    uPhase: tierUPhase,
                    alpha: 0.90,
                    zPos: 3.38,
                    color: deepOceanHazeColor,
                    colorBlendFactor: 0.48,
                    toScreenX: toScreenX,
                    topEYAtWX: { wx in
                        toScreenY(GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx).topY - terraceCrestLift * 0.85)
                    },
                    botEYAtWX: { wx in
                        clampBowlBotY(wx: wx, rawDepthOffset: -terraceCrestLift * 0.85 + terraceStripWorldH * 0.92)
                    }
                )

                let caveSpanW = max(120.0, openRightWX - openLeftWX)
                if let shadowTex = portalShadowTex {
                    let portalNode = acquirePooledParallaxTile()
                    portalNode.warpGeometry = nil
                    portalNode.texture = shadowTex
                    portalNode.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                    portalNode.xScale = 1.0
                    portalNode.yScale = 1.0
                    portalNode.zRotation = 0.0
                    portalNode.size = CGSize(
                        width: max(160.0 * zoom, caveSpanW * 1.02 * zoom),
                        height: max(100.0 * zoom, 210.0 * zoom)
                    )
                    portalNode.position = CGPoint(
                        x: toScreenX(seamWX),
                        y: toScreenY(sCenter.topY + 56.0)
                    )
                    portalNode.alpha = 0.84
                    portalNode.zPosition = 3.39
                    portalNode.colorBlendFactor = 0.0
                }

                let seamHash = abs(seamIdx * 73 + tierIdx * 19)
                let leftRockPrimary = (seamHash % 2 == 0) ? "rock_2" : "rock_1"
                let rightRockPrimary = (seamHash % 2 == 0) ? "rock_1" : "rock_2"
                let lipShoulders: [(wx: Double, dy: Double, lipH: Double, tiltSign: Double, rockId: String, shade: Double, zPos: CGFloat)] = [
                    (openLeftWX - 6.0,  22.0, 74.0, -1.0, leftRockPrimary,  0.14, 3.70),
                    (openLeftWX - 12.0, 58.0, 62.0, -1.0, rightRockPrimary, 0.28, 3.67),
                    (openRightWX + 6.0, 22.0, 74.0,  1.0, rightRockPrimary, 0.14, 3.70),
                    (openRightWX + 12.0,58.0, 62.0,  1.0, leftRockPrimary,  0.28, 3.67)
                ]
                for shoulder in lipShoulders {
                    if GameRules.isTerraceCellBreached(tierIndex: tierIdx, worldX: shoulder.wx, breachedCells: breachedTerraceCells) { continue }
                    let mainAtShoulder = GameRules.getFloorDepthAt(worldX: shoulder.wx)
                    if mainAtShoulder <= tier.graftStartMainY + 24.0 { continue }
                    let sLip = GameRules.getSeabedTerraceAt(worldX: shoulder.wx, tierIndex: tierIdx)
                    if !sLip.isPresent && !sLip.isDiveOpening { continue }
                    if let lipTex = SpriteAtlasManager.shared.ecologySpriteTexture(for: shoulder.rockId) {
                        let texSize = lipTex.size()
                        let aspect = max(0.6, min(1.8, Double(texSize.width / max(1.0, texSize.height))))
                        let lipH = shoulder.lipH * zoom
                        let lipW = lipH * aspect
                        let lipNode = acquirePooledParallaxTile()
                        lipNode.warpGeometry = nil
                        lipNode.texture = lipTex
                        lipNode.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                        lipNode.size = CGSize(width: lipW, height: lipH)
                        lipNode.position = CGPoint(
                            x: toScreenX(shoulder.wx),
                            y: toScreenY(sLip.topY + shoulder.dy)
                        )
                        lipNode.xScale = shoulder.tiltSign < 0 ? 1.0 : -1.0
                        lipNode.yScale = 1.0
                        lipNode.zRotation = CGFloat(-shoulder.tiltSign * 0.22)
                        lipNode.alpha = 0.96
                        lipNode.zPosition = shoulder.zPos
                        lipNode.color = deepOceanHazeColor
                        lipNode.colorBlendFactor = CGFloat(shoulder.shade)
                    }
                    if shoulder.dy < 35.0, let shadowTex = portalShadowTex {
                        let lipShadow = acquirePooledParallaxTile()
                        lipShadow.warpGeometry = nil
                        lipShadow.texture = shadowTex
                        lipShadow.anchorPoint = CGPoint(x: 0.5, y: 0.5)
                        lipShadow.xScale = 1.0
                        lipShadow.yScale = 1.0
                        lipShadow.zRotation = 0.0
                        lipShadow.size = CGSize(width: 68.0 * zoom, height: 112.0 * zoom)
                        lipShadow.position = CGPoint(
                            x: toScreenX(shoulder.wx - shoulder.tiltSign * 4.0),
                            y: toScreenY(sLip.topY + 46.0)
                        )
                        lipShadow.alpha = 0.56
                        lipShadow.zPosition = 3.66
                        lipShadow.colorBlendFactor = 0.0
                    }
                }
            }

            // 2B. Solid Terrace Foreground Intervals
            func terraceGraftVisualMetrics(wx: Double) -> (sample: GameRules.SeabedTerraceSample, mainY: Double, fuseU: Double, visualBotY: Double, visualTopY: Double) {
                let s = GameRules.getSeabedTerraceAt(worldX: wx, tierIndex: tierIdx)
                let mainY = GameRules.getFloorDepthAt(worldX: wx)
                let fuseU: Double
                if mainY <= tier.graftStartMainY {
                    fuseU = 0.0
                } else if mainY >= tier.graftFuseMainY {
                    fuseU = 1.0
                } else {
                    fuseU = (mainY - tier.graftStartMainY) / max(40.0, tier.graftFuseMainY - tier.graftStartMainY)
                }
                let visualTopY = s.topY - terraceCrestLift * fuseU
                let graftBotCap = mainY + 14.0 * fuseU
                let visualBotY = mainY < tier.graftFuseMainY ? min(s.bottomArchY, graftBotCap) : s.bottomArchY
                return (s, mainY, fuseU, visualBotY, visualTopY)
            }

            for cellIdx in firstCell...lastCell {
                let leftSeamHasOpening = hasOpeningAtSeam(cellIdx)
                let rightSeamHasOpening = hasOpeningAtSeam(cellIdx + 1)
                let cellLeftSeamWX = Double(cellIdx) * tier.cellWidth + tier.seamPhaseOffsetX
                let cellRightSeamWX = Double(cellIdx + 1) * tier.cellWidth + tier.seamPhaseOffsetX

                let segStartWX = leftSeamHasOpening ? (cellLeftSeamWX + tier.openingHalfWidth) : cellLeftSeamWX
                let segEndWX = rightSeamHasOpening ? (cellRightSeamWX - tier.openingHalfWidth) : cellRightSeamWX
                if segEndWX <= segStartWX + 8.0 { continue }

                let chunkStep = 240.0
                let firstChunkIdx = Int(floor(max(segStartWX, startWorldX - 260.0) / chunkStep))
                let lastChunkIdx = Int(ceil(min(segEndWX, endWorldX + 260.0) / chunkStep))
                if lastChunkIdx < firstChunkIdx { continue }

                let polyGridStep = 40.0
                let firstGridIdx = Int(floor(max(segStartWX, startWorldX - 260.0) / polyGridStep))
                let lastGridIdx = Int(ceil(min(segEndWX, endWorldX + 260.0) / polyGridStep))
                var activeFillRuns: [(w0: Double, w1: Double)] = []
                var runStartWX: Double? = nil
                if lastGridIdx >= firstGridIdx {
                    for gIdx in firstGridIdx...lastGridIdx {
                        let gx0 = max(segStartWX, Double(gIdx) * polyGridStep)
                        let gx1 = min(segEndWX, Double(gIdx + 1) * polyGridStep)
                        if gx1 <= gx0 + 0.5 { continue }
                        let midGX = (gx0 + gx1) * 0.5
                        let isBreachedCell = GameRules.isTerraceCellBreached(tierIndex: tierIdx, worldX: midGX, breachedCells: breachedTerraceCells)
                        let mMid = GameRules.getFloorDepthAt(worldX: midGX)
                        let m0 = GameRules.getFloorDepthAt(worldX: gx0)
                        let m1 = GameRules.getFloorDepthAt(worldX: gx1)
                        if !isBreachedCell && max(mMid, max(m0, m1)) > tier.graftStartMainY + 12.0 {
                            if runStartWX == nil { runStartWX = gx0 }
                        } else if let r0 = runStartWX {
                            if gx0 - r0 > 6.0 { activeFillRuns.append((r0, gx0)) }
                            runStartWX = nil
                        }
                    }
                    if let r0 = runStartWX {
                        let endClamped = min(segEndWX, Double(lastGridIdx + 1) * polyGridStep)
                        if endClamped - r0 > 6.0 { activeFillRuns.append((r0, endClamped)) }
                    }
                }

                for run in activeFillRuns {
                    let rsWX0 = run.w0
                    let rsWX1 = run.w1
                    let archFillNode = acquirePooledArchFillNode()
                    archFillNode.zPosition = 3.42
                    archFillNode.lineWidth = 0.0
                    archFillNode.strokeColor = .clear
                    let archPath = CGMutablePath()
                    var ptsTop: [CGPoint] = []
                    var ptsBot: [CGPoint] = []
                    let stepBeginIdx = Int(ceil(rsWX0 / polyGridStep))
                    let stepEndIdx = Int(floor(rsWX1 / polyGridStep))
                    var sampleXs: [Double] = [rsWX0]
                    if stepEndIdx >= stepBeginIdx {
                        for k in stepBeginIdx...stepEndIdx {
                            let kx = Double(k) * polyGridStep
                            if kx > rsWX0 + 1.0 && kx < rsWX1 - 1.0 {
                                sampleXs.append(kx)
                            }
                        }
                    }
                    sampleXs.append(rsWX1)

                    for wxPt in sampleXs {
                        let m = terraceGraftVisualMetrics(wx: wxPt)
                        let topD = m.sample.topY + 16.0 * m.fuseU
                        let botD = max(topD + 4.0, min(m.sample.bottomArchY - 10.0, m.visualBotY - 6.0 * m.fuseU))
                        ptsTop.append(CGPoint(x: toScreenX(wxPt), y: toScreenY(topD)))
                        ptsBot.append(CGPoint(x: toScreenX(wxPt), y: toScreenY(botD)))
                    }
                    if let firstP = ptsTop.first {
                        archPath.move(to: firstP)
                        for p in ptsTop.dropFirst() { archPath.addLine(to: p) }
                        for p in ptsBot.reversed() { archPath.addLine(to: p) }
                        archPath.closeSubpath()
                    }
                    archFillNode.path = archPath
                    archFillNode.fillColor = tier.stripId == "coral_reef"
                        ? UIColor(red: 14/255, green: 34/255, blue: 56/255, alpha: 0.95)
                        : tier.stripId == "rocky_shelf"
                        ? UIColor(red: 10/255, green: 24/255, blue: 44/255, alpha: 0.96)
                        : UIColor(red: 5/255, green: 12/255, blue: 26/255, alpha: 0.96)
                }

                for chIdx in firstChunkIdx...lastChunkIdx {
                    let cw0 = max(segStartWX, Double(chIdx) * chunkStep)
                    let cw1 = min(segEndWX, Double(chIdx + 1) * chunkStep)
                    if cw1 - cw0 < 2.0 { continue }

                    let mStart = GameRules.getFloorDepthAt(worldX: cw0)
                    let mQ1 = GameRules.getFloorDepthAt(worldX: cw0 + (cw1 - cw0) * 0.25)
                    let mMid = GameRules.getFloorDepthAt(worldX: (cw0 + cw1) * 0.5)
                    let mQ3 = GameRules.getFloorDepthAt(worldX: cw0 + (cw1 - cw0) * 0.75)
                    let mEnd = GameRules.getFloorDepthAt(worldX: cw1)
                    let maxM = max(mStart, max(mQ1, max(mMid, max(mQ3, mEnd))))
                    let minM = min(mStart, min(mQ1, min(mMid, min(mQ3, mEnd))))
                    if maxM <= tier.graftStartMainY + 2.0 { continue }

                    let hasTierBreaches = !breachedTerraceCells.isEmpty && tier.shatterLengthM.isFinite
                    var subChunkStep = (minM < tier.graftFuseMainY) ? 60.0 : chunkStep
                    if hasTierBreaches {
                        subChunkStep = min(subChunkStep, GameRules.terraceBreachCellWidth)
                    }
                    let subCount = max(1, Int(ceil((cw1 - cw0) / subChunkStep - 1e-4)))

                    for sIdx in 0..<subCount {
                        let sw0 = cw0 + (cw1 - cw0) * (Double(sIdx) / Double(subCount))
                        let sw1 = cw0 + (cw1 - cw0) * (Double(sIdx + 1) / Double(subCount))
                        if sw1 - sw0 < 1.5 { continue }
                        if hasTierBreaches && GameRules.isTerraceCellBreached(tierIndex: tierIdx, worldX: (sw0 + sw1) * 0.5, breachedCells: breachedTerraceCells) {
                            continue
                        }

                        let gA = terraceGraftVisualMetrics(wx: sw0)
                        let gM = terraceGraftVisualMetrics(wx: (sw0 + sw1) * 0.5)
                        let gB = terraceGraftVisualMetrics(wx: sw1)
                        let maxFuse = max(gA.fuseU, max(gM.fuseU, gB.fuseU))
                        if maxFuse <= 0.015 { continue }
                        let avgFuse = min(1.0, (gA.fuseU + gM.fuseU + gB.fuseU) / 3.0)
                        let graftAlpha = min(1.0, avgFuse / 0.26)

                        for sub in terraceSubLayers {
                            let thM = gM.visualBotY - (gM.sample.topY + sub.yStartWorld)
                            let thA = gA.visualBotY - (gA.sample.topY + sub.yStartWorld)
                            let thB = gB.visualBotY - (gB.sample.topY + sub.yStartWorld)
                            let maxThick = max(thM, max(thA, thB))
                            if maxThick <= 10.0 { continue }

                            addWorldLockedWarpedSpan(
                                texture: tierSubTex,
                                wx0: sw0,
                                wx1: sw1,
                                periodWorldW: terracePeriodW,
                                uPhase: tierUPhase + sub.uPhase,
                                alpha: sub.alpha * graftAlpha,
                                zPos: sub.zOff,
                                color: .black,
                                colorBlendFactor: min(0.75, sub.shade),
                                toScreenX: toScreenX,
                                topEYAtWX: { wx in
                                    let m = terraceGraftVisualMetrics(wx: wx)
                                    let safeTop = min(m.visualBotY - 2.0, m.sample.topY + sub.yStartWorld)
                                    return toScreenY(safeTop)
                                },
                                botEYAtWX: { wx in
                                    let m = terraceGraftVisualMetrics(wx: wx)
                                    let clampedBot = min(m.visualBotY + 4.0 * m.fuseU, m.sample.topY + sub.yStartWorld + sub.subWorldH)
                                    return toScreenY(clampedBot)
                                }
                            )
                        }

                        addWorldLockedWarpedSpan(
                            texture: tierStripTex,
                            wx0: sw0,
                            wx1: sw1,
                            periodWorldW: terracePeriodW,
                            uPhase: tierUPhase,
                            alpha: 0.98 * graftAlpha,
                            zPos: 3.65,
                            color: deepOceanHazeColor,
                            colorBlendFactor: 0.0,
                            toScreenX: toScreenX,
                            topEYAtWX: { wx in
                                toScreenY(terraceGraftVisualMetrics(wx: wx).visualTopY)
                            },
                            botEYAtWX: { wx in
                                let m = terraceGraftVisualMetrics(wx: wx)
                                let rawBot = m.visualTopY + terraceStripWorldH * max(0.08, m.fuseU)
                                let clampedBot = min(m.visualBotY + 2.0 * m.fuseU, rawBot)
                                return toScreenY(max(m.visualTopY + 3.0, clampedBot))
                            }
                        )
                    }
                }
            }
        }

        // 3. Render Diverse Multi-Variant Coral Outcrops, Seaweed Forests, Rocks, Hydrothermal Vents & POIs along Main Floor & All 9 Terraces
        let chunkWidth = 600.0
        let firstChunk = Int(floor(startWorldX / chunkWidth)) - 1
        let lastChunk = Int(ceil(endWorldX / chunkWidth)) + 1

        struct CoralLayerSpec {
            let isPoi: Bool
            let spriteId: String
            let dxRatio: Double
            let dyRatio: Double
            let scaleH: Double
            let flipX: Bool
            let zOff: CGFloat
            let isCompositeHero: Bool
        }

        func layersForOutcrop(_ outcrop: GameRules.SeabedOutcropPlacement) -> [CoralLayerSpec] {
            let v = max(1, min(5, outcrop.variant + 1))
            let isHero = (v == 5)
            let v2 = ((outcrop.variant + 1) % 4) + 1
            let rockV = (Int((outcrop.seed * 13.0).rounded(.down)) % 3) + 1
            let kelpV = (Int((outcrop.seed * 17.0).rounded(.down)) % 3) + 1
            let flipMain = outcrop.seed > 0.5

            switch outcrop.type {
            case .CORAL_MOUND:
                if isHero {
                    return [
                        CoralLayerSpec(isPoi: false, spriteId: "kelp_\(kelpV)", dxRatio: -0.34, dyRatio: 0.03, scaleH: 0.64, flipX: !flipMain, zOff: 0.01, isCompositeHero: false),
                        CoralLayerSpec(isPoi: false, spriteId: "coral_5",        dxRatio: 0.0,   dyRatio: 0.0,  scaleH: 0.95, flipX: flipMain,  zOff: 0.03, isCompositeHero: true)
                    ]
                }
                return [
                    CoralLayerSpec(isPoi: false, spriteId: "rock_\(rockV)", dxRatio: 0.0,   dyRatio: 0.06, scaleH: 0.56, flipX: !flipMain, zOff: 0.01, isCompositeHero: false),
                    CoralLayerSpec(isPoi: false, spriteId: "kelp_\(kelpV)", dxRatio: -0.36, dyRatio: 0.04, scaleH: 0.68, flipX: !flipMain, zOff: 0.02, isCompositeHero: false),
                    CoralLayerSpec(isPoi: false, spriteId: "coral_\(v2)",   dxRatio: 0.32,  dyRatio: 0.03, scaleH: 0.64, flipX: !flipMain, zOff: 0.025, isCompositeHero: false),
                    CoralLayerSpec(isPoi: false, spriteId: "coral_\(v)",    dxRatio: 0.0,   dyRatio: 0.0,  scaleH: 0.96, flipX: flipMain,  zOff: 0.03, isCompositeHero: false)
                ]
            case .KELP_CLUSTER:
                if isHero {
                    return [
                        CoralLayerSpec(isPoi: false, spriteId: "rock_\(rockV)", dxRatio: 0.0, dyRatio: 0.05, scaleH: 0.48, flipX: !flipMain, zOff: 0.01, isCompositeHero: false),
                        CoralLayerSpec(isPoi: false, spriteId: "kelp_5",         dxRatio: 0.0, dyRatio: 0.0,  scaleH: 0.92, flipX: flipMain,  zOff: 0.02, isCompositeHero: true)
                    ]
                }
                return [
                    CoralLayerSpec(isPoi: false, spriteId: "rock_\(rockV)", dxRatio: 0.0,   dyRatio: 0.05, scaleH: 0.48, flipX: !flipMain, zOff: 0.01, isCompositeHero: false),
                    CoralLayerSpec(isPoi: false, spriteId: "kelp_\(v2)",    dxRatio: -0.28, dyRatio: 0.03, scaleH: 0.72, flipX: !flipMain, zOff: 0.02, isCompositeHero: false),
                    CoralLayerSpec(isPoi: false, spriteId: "kelp_\(v)",     dxRatio: 0.08,  dyRatio: 0.0,  scaleH: 0.98, flipX: flipMain,  zOff: 0.03, isCompositeHero: false)
                ]
            case .ROCK_SPIRE:
                var list: [CoralLayerSpec] = [
                    CoralLayerSpec(isPoi: false, spriteId: "rock_\(v)", dxRatio: 0.0, dyRatio: 0.0, scaleH: isHero ? 0.92 : 0.96, flipX: flipMain, zOff: 0.02, isCompositeHero: isHero)
                ]
                if !isHero && outcrop.seed > 0.35 && outcrop.seed <= 0.84 {
                    list.append(CoralLayerSpec(isPoi: false, spriteId: "coral_\(v2)", dxRatio: flipMain ? -0.30 : 0.30, dyRatio: 0.04, scaleH: 0.58, flipX: !flipMain, zOff: 0.03, isCompositeHero: false))
                } else if outcrop.seed > 0.84 {
                    let poiIds = ["shipwreck_1", "shipwreck_2", "arch_1", "arch_2", "treasure_1", "treasure_2", "skeleton_1", "statue_1", "nest_1", "nest_2"]
                    let poiIdx = Int((outcrop.seed * 97.0).rounded(.down)) % poiIds.count
                    let poiId = poiIds[poiIdx]
                    list.append(CoralLayerSpec(isPoi: true, spriteId: poiId, dxRatio: 0.0, dyRatio: -0.02, scaleH: 1.12, flipX: flipMain, zOff: 0.04, isCompositeHero: false))
                }
                return list
            case .ABYSSAL_CHIMNEY:
                if isHero {
                    return [
                        CoralLayerSpec(isPoi: false, spriteId: "vent_5", dxRatio: 0.0, dyRatio: 0.0, scaleH: 0.90, flipX: flipMain, zOff: 0.02, isCompositeHero: true)
                    ]
                }
                return [
                    CoralLayerSpec(isPoi: false, spriteId: "rock_\(rockV)", dxRatio: -0.28, dyRatio: 0.04, scaleH: 0.54, flipX: !flipMain, zOff: 0.01, isCompositeHero: false),
                    CoralLayerSpec(isPoi: false, spriteId: "vent_\(v)",     dxRatio: 0.0,   dyRatio: 0.0,  scaleH: 0.94, flipX: flipMain,  zOff: 0.02, isCompositeHero: false)
                ]
            }
        }

        for cIdx in firstChunk...lastChunk {
            let outcrops = GameRules.getSeabedOutcropsForChunk(chunkIndex: cIdx, chunkWidth: chunkWidth)
            for outcrop in outcrops {
                if let tIdx = outcrop.terraceIndex,
                   GameRules.isTerraceCellBreached(tierIndex: tIdx, worldX: outcrop.worldX, breachedCells: breachedTerraceCells) {
                    continue
                }
                let sx = toScreenX(outcrop.worldX)
                let sy = toScreenY(outcrop.baseY)
                let drawBaseW = outcrop.width * zoom
                let drawBaseH = outcrop.height * zoom
                if drawBaseH < 5.0 { continue }
                if sx + drawBaseW * 2.0 < -100.0 || sx - drawBaseW * 2.0 > viewW + 100.0 { continue }
                if sy + drawBaseH * 2.0 < -100.0 || sy - drawBaseH * 2.0 > viewH + 100.0 { continue }

                let slope = GameRules.getTerrainSlopeAt(worldX: outcrop.worldX)
                let slopeRot = max(-0.26, min(0.26, atan(slope) * 0.48))
                let layers = layersForOutcrop(outcrop)

                let tintColor: UIColor
                if outcrop.baseY < 620.0 {
                    tintColor = UIColor(red: 14/255, green: 42/255, blue: 68/255, alpha: 1.0)
                } else if outcrop.baseY < 1450.0 {
                    tintColor = UIColor(red: 10/255, green: 26/255, blue: 48/255, alpha: 1.0)
                } else {
                    tintColor = UIColor(red: 12/255, green: 14/255, blue: 28/255, alpha: 1.0)
                }

                for layer in layers {
                    let texOpt = layer.isPoi
                        ? SpriteAtlasManager.shared.poiSpriteTexture(for: layer.spriteId)
                        : SpriteAtlasManager.shared.ecologySpriteTexture(for: layer.spriteId)
                    guard let tex = texOpt else { continue }
                    let texSize = tex.size()
                    guard texSize.width >= 16.0 && texSize.height >= 16.0 else { continue }
                    let texAspect = max(0.45, min(2.2, Double(texSize.width / texSize.height)))
                    let drawH = drawBaseH * layer.scaleH
                    let drawW = drawH * texAspect
                    let slopeSink = abs(slope) * drawW * 0.28
                    let sinkY = drawH * 0.26 + slopeSink
                    let lx = sx + layer.dxRatio * drawBaseW
                    let ly = sy - layer.dyRatio * drawBaseH - sinkY

                    let node = acquirePooledParallaxTile()
                    node.warpGeometry = nil
                    node.texture = tex
                    node.anchorPoint = CGPoint(x: 0.5, y: 0.0)
                    node.size = CGSize(width: drawW, height: drawH)
                    node.position = CGPoint(x: lx, y: ly)
                    node.xScale = layer.flipX ? -1.0 : 1.0
                    node.yScale = 1.0
                    node.zRotation = CGFloat(-slopeRot)
                    node.alpha = layer.isCompositeHero ? 0.92 : 0.95
                    node.zPosition = 3.78 + layer.zOff
                    node.color = tintColor
                    node.colorBlendFactor = layer.isCompositeHero ? 0.26 : 0.12
                }
            }
        }
    }
}
