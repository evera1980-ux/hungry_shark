import SpriteKit
import UIKit

/// Multi-biome water canopy parallax strips, 42 depth-reactive ambient ocean particles,
/// terrace shatter debris, shark wake bubbles, devour FX, coin/gene pickups & floating combat text.
extension OceanGameScene {
    // MARK: - 42 Depth-Reactive Ambient Ocean Bubbles / Marine Snow / Bioluminescent Spores / Magma Embers
    func initAmbientBubblesIfNeeded(viewW: Double, viewH: Double) {
        if !ambientBubbles.isEmpty { return }
        bubbleContainer.removeAllChildren()
        for i in 0..<42 {
            let r = Double.random(in: 2.2...5.8)
            let ring = SKShapeNode(circleOfRadius: CGFloat(r))
            ring.lineWidth = 1.15

            let spec = SKShapeNode(circleOfRadius: CGFloat(r * 0.28))
            spec.fillColor = UIColor(white: 1.0, alpha: 0.72)
            spec.strokeColor = .clear
            spec.position = CGPoint(x: -r * 0.32, y: r * 0.32)
            ring.addChild(spec)

            bubbleContainer.addChild(ring)
            ambientBubbles.append(
                AmbientOceanBubble(
                    ringNode: ring,
                    highlightNode: spec,
                    x: Double.random(in: 0...(max(800, viewW * 1.5))),
                    y: Double.random(in: 0...(max(420, viewH))),
                    r: r,
                    speedY: Double.random(in: 16.0...38.0),
                    wobblePhase: Double.random(in: 0...(Double.pi * 2)),
                    baseAlpha: Double.random(in: 0.24...0.52),
                    kindIndex: i % 4
                )
            )
        }
    }

    func stepAndRenderAmbientBubbles(
        viewW: Double,
        viewH: Double,
        bgScales: ParallaxLayerGrowthScales,
        transition: GameRules.ParallaxBiomeTransitionState,
        dt: Double
    ) {
        initAmbientBubblesIfNeeded(viewW: viewW, viewH: viewH)
        let wS = transition.particleShallowWeight
        let wT = transition.particleTwilightWeight
        let wA = transition.particleAbyssWeight
        let pScale = bgScales.particleScale

        for b in ambientBubbles {
            let twilightVertDir: Double = (b.kindIndex == 1) ? -0.35 : 1.0
            let vertDir: Double = 1.0 * (wS + wA) + twilightVertDir * wT
            b.y += vertDir * b.speedY * dt
            b.wobblePhase += dt * 2.1

            if b.y > viewH + 22.0 {
                b.y = -16.0
                b.x = Double.random(in: 0...viewW)
            } else if b.y < -22.0 {
                b.y = viewH + 16.0
                b.x = Double.random(in: 0...viewW)
            }

            let rawX = b.x - cameraX * 0.16 * pScale + sin(b.wobblePhase) * 11.0 * pScale
            let screenX = ((rawX.truncatingRemainder(dividingBy: viewW)) + viewW).truncatingRemainder(dividingBy: viewW)
            b.ringNode.position = CGPoint(x: screenX, y: b.y)

            let effScale = pScale * (wS * 1.0 + wT * 0.72 + wA * 0.78)
            b.ringNode.setScale(CGFloat(effScale))

            let pulseT = 0.55 + 0.45 * sin(b.wobblePhase * 1.5)
            let pulseA = 0.65 + 0.35 * sin(b.wobblePhase * 1.8)
            let effPulse = wS * 1.0 + wT * pulseT + wA * pulseA
            b.ringNode.alpha = CGFloat(b.baseAlpha * effPulse)

            let twR: Double = (b.kindIndex == 2) ? (34.0 / 255.0) : (148.0 / 255.0)
            let twG: Double = (b.kindIndex == 2) ? (211.0 / 255.0) : (163.0 / 255.0)
            let twB: Double = (b.kindIndex == 2) ? (238.0 / 255.0) : (184.0 / 255.0)

            let abR: Double = (b.kindIndex == 2) ? (192.0 / 255.0) : (251.0 / 255.0)
            let abG: Double = (b.kindIndex == 2) ? (132.0 / 255.0) : (146.0 / 255.0)
            let abB: Double = (b.kindIndex == 2) ? (252.0 / 255.0) : (60.0 / 255.0)

            let shR: Double = 186.0 / 255.0
            let shG: Double = 230.0 / 255.0
            let shB: Double = 253.0 / 255.0

            let fillR = shR * wS + twR * wT + abR * wA
            let fillG = shG * wS + twG * wT + abG * wA
            let fillB = shB * wS + twB * wT + abB * wA
            let fillA = 0.18 * wS + 0.90 * (wT + wA)

            b.ringNode.fillColor = UIColor(red: CGFloat(fillR), green: CGFloat(fillG), blue: CGFloat(fillB), alpha: CGFloat(fillA))
            b.ringNode.strokeColor = wS > 0.02
                ? UIColor(red: CGFloat(shR), green: CGFloat(shG), blue: CGFloat(shB), alpha: CGFloat(0.90 * wS))
                : .clear
            b.highlightNode.isHidden = wS <= 0.03
            b.highlightNode.alpha = CGFloat(0.72 * wS)
        }
    }

    // MARK: - Continuous Cross-Depth Multi-Biome Parallax Water Backdrop
    func renderParallaxBackground(
        viewW: Double,
        viewH: Double,
        bgScales: ParallaxLayerGrowthScales,
        transition: GameRules.ParallaxBiomeTransitionState,
        zoom: Double
    ) {
        let depthRefY = max(0.0, smoothedDepthRefY >= 0.0 ? smoothedDepthRefY : sharkY)
        let rgb = GameRules.sampleBathymetricWaterRGB(depthMeters: cameraY)
        let ambientWaterColor = UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z), alpha: 1.0)
        waterBgNode.color = ambientWaterColor
        waterBgNode.size = CGSize(width: viewW, height: viewH)
        waterBgNode.position = CGPoint(x: viewW * 0.5, y: viewH * 0.5)

        activeParallaxTileCount = 0
        activeSeabedArchFillCount = 0

        let waterMap: [String: String] = [
            "bg_shallow": "bg_shallow_0_water_0e65cb68",
            "bg_twilight": "bg_twilight_0_17bcb84c",
            "bg_abyss": "bg_abyss_0_1bbf506a"
        ]

        if transition.shallow.waterAlpha > 0.01,
           let wName0 = waterMap["bg_shallow"],
           let water0 = SpriteAtlasManager.shared.oceanParallaxTexture(named: wName0, isWaterCanopy: true) {
            let refH = min(viewH, max(360.0, viewW * 0.65))
            let baseCanopyH = max(96.0, min(220.0, refH * 0.32))
            let canopyH = baseCanopyH * bgScales.waterScale
            let u0 = tanh(max(0.0, 680.0 - depthRefY) / 480.0)
            let canopyBottomY = viewH - canopyH + (1.0 - u0) * 4.0
            addTiledStrip(
                texture: water0,
                baseTargetH: baseCanopyH,
                scaledTargetH: canopyH,
                bottomYFromBottom: canopyBottomY,
                parallaxXFactor: 0.012,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: transition.shallow.waterAlpha,
                zPos: 1.0,
                fogColor: ambientWaterColor,
                fogBlendFactor: 0.0
            )
        }

        if transition.twilight.waterAlpha > 0.01,
           let wName1 = waterMap["bg_twilight"],
           let water1 = SpriteAtlasManager.shared.oceanParallaxTexture(named: wName1, isWaterCanopy: true) {
            addTiledStrip(
                texture: water1,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: transition.twilight.waterAlpha,
                zPos: 1.1,
                fogColor: ambientWaterColor,
                fogBlendFactor: 0.18
            )
        }

        if transition.abyss.waterAlpha > 0.01,
           let wName2 = waterMap["bg_abyss"],
           let water2 = SpriteAtlasManager.shared.oceanParallaxTexture(named: wName2, isWaterCanopy: true) {
            addTiledStrip(
                texture: water2,
                baseTargetH: viewH + 24.0,
                scaledTargetH: viewH + 24.0,
                bottomYFromBottom: -12.0,
                parallaxXFactor: 0.025,
                phaseOffset: 0.50,
                viewW: viewW,
                alpha: transition.abyss.waterAlpha,
                zPos: 1.2,
                fogColor: ambientWaterColor,
                fogBlendFactor: 0.16
            )
        }

        renderPhysicalSeabedAndEcology(
            viewW: viewW,
            viewH: viewH,
            zoom: max(GameRules.minRenderZoomFloor, zoom)
        )

        if activeParallaxTileCount < parallaxTilePool.count {
            for i in activeParallaxTileCount..<parallaxTilePool.count {
                parallaxTilePool[i].isHidden = true
            }
        }
        if activeSeabedArchFillCount < seabedArchFillPool.count {
            for i in activeSeabedArchFillCount..<seabedArchFillPool.count {
                seabedArchFillPool[i].isHidden = true
            }
        }
    }

    func addTiledStrip(
        texture: SKTexture,
        baseTargetH: Double,
        scaledTargetH: Double,
        bottomYFromBottom: Double,
        parallaxXFactor: Double,
        phaseOffset: Double = 0.50,
        viewW: Double,
        alpha: Double,
        zPos: CGFloat,
        fogColor: UIColor = .clear,
        fogBlendFactor: Double = 0.0
    ) {
        let texSize = texture.size()
        guard texSize.height > 0 && alpha > 0.004 else { return }
        let aspect = Double(texSize.width / texSize.height)
        let baseTileW = max(256.0, baseTargetH * aspect)
        let tileW = ceil(max(148.0, scaledTargetH * aspect))
        let displayScale = Double(max(1.0, view?.contentScaleFactor ?? UIScreen.main.scale))

        let rawPhase = (cameraX * parallaxXFactor) / baseTileW + phaseOffset
        let normPhase = (rawPhase.truncatingRemainder(dividingBy: 1.0) + 1.0).truncatingRemainder(dividingBy: 1.0)
        let centerAnchorX = viewW * 0.5 - normPhase * tileW
        var startX = ((centerAnchorX.truncatingRemainder(dividingBy: tileW) + tileW).truncatingRemainder(dividingBy: tileW)) - tileW
        let alignedY = (bottomYFromBottom * displayScale).rounded(.down) / displayScale
        let alignedH = ceil(scaledTargetH * displayScale) / displayScale

        while startX < viewW {
            let x0 = (startX * displayScale).rounded() / displayScale
            let x1 = ((startX + tileW) * displayScale).rounded() / displayScale
            let node = acquirePooledParallaxTile()
            node.warpGeometry = nil
            node.anchorPoint = CGPoint(x: 0.0, y: 0.0)
            node.xScale = 1.0
            node.yScale = 1.0
            node.zRotation = 0.0
            node.texture = texture
            node.size = CGSize(width: max(1.0, x1 - x0), height: alignedH)
            node.position = CGPoint(x: x0, y: alignedY)
            node.alpha = CGFloat(alpha)
            node.zPosition = zPos
            node.color = fogColor
            node.colorBlendFactor = CGFloat(max(0.0, min(0.85, fogBlendFactor)))
            startX += tileW
        }
    }

    // MARK: - Shatter, Wake, Devour Particles, Spinning Coin/Gene Pickups & Floating Combat Text
    func spawnTerraceShatterParticles(x: Double, y: Double, stripId: String, worldScale: Double) {
        let fxScale = max(1.0, min(4.2, worldScale * 0.72))
        let isCoral = (stripId == "coral_reef")
        let count = 16
        for i in 0..<count {
            if activeParticles.count > 72 { break }
            let ang = (Double(i) * .pi * 2.0) / Double(count) + Double.random(in: -0.35...0.35)
            let spd = Double.random(in: 95.0...265.0) * fxScale
            let isBubble = (i % 3 == 0)
            let rad = isBubble ? Double.random(in: 3.5...6.5) : Double.random(in: 5.0...9.5)
            let dot = SKShapeNode(circleOfRadius: CGFloat(rad))
            if isBubble {
                dot.fillColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.75)
                dot.strokeColor = UIColor.white.withAlphaComponent(0.75)
            } else if isCoral {
                dot.fillColor = (i % 2 == 0)
                    ? UIColor(red: 217/255, green: 119/255, blue: 6/255, alpha: 0.95)
                    : UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 120/255, green: 53/255, blue: 15/255, alpha: 0.85)
            } else {
                dot.fillColor = (i % 2 == 0)
                    ? UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 0.95)
                    : UIColor(red: 71/255, green: 85/255, blue: 105/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 0.85)
            }
            dot.lineWidth = 1.2
            dot.zPosition = 24
            fxContainer.addChild(dot)
            let offsetR = 14.0 * worldScale
            activeParticles.append(
                ActiveParticle(
                    node: dot,
                    x: x + cos(ang) * offsetR,
                    y: y + sin(ang) * offsetR,
                    vx: cos(ang) * spd,
                    vy: sin(ang) * spd - Double.random(in: 10.0...40.0) * fxScale,
                    maxLife: Double.random(in: 0.52...0.88),
                    baseRadius: rad
                )
            )
        }
    }

    func spawnSharkWakeBubble(stats: ComputedSharkStats, isBoosting: Bool, isFrenzy: Bool) {
        if activeParticles.count > 44 { return }
        let ws = stats.worldScale
        let tailX = sharkX - cos(sharkAngle) * 40.0 * ws + Double.random(in: -6...6) * ws
        let tailY = sharkY - sin(sharkAngle) * 40.0 * ws + Double.random(in: -6...6) * ws
        let rad = isFrenzy ? Double.random(in: 3.2...6.4) : (isBoosting ? Double.random(in: 2.8...5.6) : Double.random(in: 2.0...4.0))
        let bubble = SKShapeNode(circleOfRadius: CGFloat(rad))
        if isFrenzy {
            bubble.fillColor = UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 0.88)
            bubble.strokeColor = UIColor(red: 255/255, green: 251/255, blue: 235/255, alpha: 0.95)
            bubble.lineWidth = 1.4
        } else {
            bubble.fillColor = UIColor(red: 186/255, green: 230/255, blue: 253/255, alpha: 0.22)
            bubble.strokeColor = UIColor(red: 224/255, green: 242/255, blue: 254/255, alpha: 0.78)
            bubble.lineWidth = 1.15
        }
        bubble.zPosition = 18
        fxContainer.addChild(bubble)
        let velScale = max(1.0, sqrt(ws))
        let backVx = (-cos(sharkAngle) * (isBoosting ? 42.0 : 16.0) + Double.random(in: -14...14)) * velScale
        let upVy = -Double.random(in: 22...52) * velScale
        activeParticles.append(
            ActiveParticle(
                node: bubble,
                x: tailX,
                y: tailY,
                vx: backVx,
                vy: upVy,
                maxLife: isFrenzy ? 0.58 : 0.65,
                baseRadius: rad
            )
        )
    }

    func spawnDevourParticles(x: Double, y: Double, preyTier: Int, isGolden: Bool) {
        let ringNode = SKShapeNode(circleOfRadius: 10)
        ringNode.strokeColor = isGolden
            ? UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 0.95)
            : UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 0.90)
        ringNode.fillColor = .clear
        ringNode.lineWidth = 2.6
        ringNode.zPosition = 26
        fxContainer.addChild(ringNode)
        activeParticles.append(
            ActiveParticle(node: ringNode, x: x, y: y, vx: 0, vy: 0, maxLife: 0.34, baseRadius: 10, isRing: true)
        )

        let count = min(22, 10 + preyTier * 2)
        for i in 0..<count {
            let ang = Double.random(in: 0...(Double.pi * 2))
            let spd = Double.random(in: 65...255)
            let rad = Double.random(in: 2.8...6.8)
            let dot = SKShapeNode(circleOfRadius: CGFloat(rad))
            if isGolden || i % 3 == 0 {
                dot.fillColor = UIColor(red: 250/255, green: 204/255, blue: 21/255, alpha: 1.0)
                dot.strokeColor = UIColor.white.withAlphaComponent(0.7)
            } else if i % 2 == 0 {
                dot.fillColor = UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 187/255, green: 247/255, blue: 208/255, alpha: 0.8)
            } else {
                dot.fillColor = UIColor(red: 45/255, green: 212/255, blue: 191/255, alpha: 0.95)
                dot.strokeColor = UIColor(red: 153/255, green: 246/255, blue: 228/255, alpha: 0.8)
            }
            dot.lineWidth = 1.0
            dot.zPosition = 25
            fxContainer.addChild(dot)
            activeParticles.append(
                ActiveParticle(
                    node: dot,
                    x: x,
                    y: y,
                    vx: cos(ang) * spd,
                    vy: sin(ang) * spd - Double.random(in: 12...45),
                    maxLife: Double.random(in: 0.36...0.68),
                    baseRadius: rad
                )
            )
        }
    }

    func spawnDevourPickups(x: Double, y: Double, coinGain: Int, geneGain: Int) {
        let pickupCfg = DomainConfigs.economyPredation.pickups
        let coinTex = SpriteAtlasManager.shared.uiIconTexture(for: "UI_ICON_COIN")
        if coinGain > 0 {
            let maxSplit = max(1, pickupCfg.maxCoinsPerPredation)
            let coinCount = min(maxSplit, max(1, (coinGain + maxSplit - 1) / maxSplit))
            let baseCoinVal = max(1, coinGain / coinCount)
            for i in 0..<coinCount {
                if activePickups.count >= pickupCfg.maxPooledPickups {
                    let evicted = activePickups.removeFirst()
                    evicted.node.removeFromParent()
                }
                let val = (i == coinCount - 1) ? max(1, coinGain - baseCoinVal * (coinCount - 1)) : baseCoinVal
                let node = SKSpriteNode(texture: coinTex)
                node.size = CGSize(width: 22, height: 22)
                node.zPosition = 24
                fxContainer.addChild(node)
                let ang = Double.random(in: 0...(Double.pi * 2))
                let spd = Double.random(in: 75...165)
                activePickups.append(
                    ActivePickup(
                        isGene: false,
                        value: val,
                        node: node,
                        x: x + cos(ang) * 10.0,
                        y: y + sin(ang) * 10.0,
                        vx: cos(ang) * spd,
                        vy: sin(ang) * spd - 35.0
                    )
                )
            }
        }

        if geneGain > 0 {
            if activePickups.count >= pickupCfg.maxPooledPickups {
                let evicted = activePickups.removeFirst()
                evicted.node.removeFromParent()
            }
            let geneTex = SpriteAtlasManager.shared.uiIconTexture(for: "UI_ICON_GENE")
            let node = SKSpriteNode(texture: geneTex)
            node.size = CGSize(width: 24, height: 24)
            node.zPosition = 24
            fxContainer.addChild(node)
            let ang = Double.random(in: 0...(Double.pi * 2))
            activePickups.append(
                ActivePickup(
                    isGene: true,
                    value: geneGain,
                    node: node,
                    x: x,
                    y: y,
                    vx: cos(ang) * 120.0,
                    vy: sin(ang) * 120.0 - 45.0
                )
            )
        }
    }

    func spawnFloatingText(x: Double, y: Double, text: String, color: UIColor, fontSize: CGFloat = 14) {
        if activeFloatTexts.count > 16 {
            let oldest = activeFloatTexts.removeFirst()
            oldest.node.removeFromParent()
        }
        let lbl = SKLabelNode(fontNamed: "AvenirNext-Heavy")
        lbl.text = text
        lbl.fontSize = fontSize
        lbl.fontColor = color
        lbl.verticalAlignmentMode = .center
        lbl.horizontalAlignmentMode = .center
        lbl.zPosition = 30
        fxContainer.addChild(lbl)
        activeFloatTexts.append(
            ActiveFloatText(node: lbl, x: x, y: y, vy: -52.0, maxLife: 0.95)
        )
    }

    func stepAndRenderDevourFX(viewW: Double, viewH: Double, stats: ComputedSharkStats, renderZoom: Double, dt: Double) {
        guard let vm = viewModel else { return }
        let zoom = renderZoom
        let invZoom = 1.0 / max(GameRules.cameraZoomMin, zoom)

        var pIdx = activeParticles.count - 1
        while pIdx >= 0 {
            let pt = activeParticles[pIdx]
            pt.life -= dt
            if pt.life <= 0 {
                pt.node.removeFromParent()
                activeParticles.remove(at: pIdx)
                pIdx -= 1
                continue
            }
            let progress = 1.0 - (pt.life / pt.maxLife)
            if pt.isRing {
                let scale = 1.0 + progress * 3.8
                pt.node.setScale(CGFloat(scale))
                pt.node.alpha = CGFloat(max(0.0, 1.0 - progress))
            } else {
                pt.x += pt.vx * dt
                pt.y += pt.vy * dt
                pt.vx *= 0.92
                pt.vy = pt.vy * 0.92 - 18.0 * dt
                pt.node.setScale(CGFloat(max(0.2, 1.0 - progress * 0.65)))
                pt.node.alpha = CGFloat(max(0.0, 1.0 - progress * 0.85))
            }
            let sx = viewW * 0.5 + (pt.x - cameraX) * zoom
            let sy = viewH * 0.5 - (pt.y - cameraY) * zoom
            pt.node.position = CGPoint(x: sx, y: sy)
            pIdx -= 1
        }

        let pickupCfg = DomainConfigs.economyPredation.pickups
        let currentHeatBuff = vm.huntingHeatBuff
        let frenzyMagMult = vm.frenzyActive ? pickupCfg.frenzyMagnetMultiplier : 1.0
        let magnetR = (stats.magnetRadius + currentHeatBuff.magnetRadiusBonus) * invZoom * frenzyMagMult
        let collectRadius = pickupCfg.collectRadiusWorldFactor * stats.worldScale
        var kIdx = activePickups.count - 1
        while kIdx >= 0 {
            let pk = activePickups[kIdx]
            pk.life -= dt
            pk.spinPhase += dt * 9.5
            let dx = sharkX - pk.x
            let dy = sharkY - pk.y
            let dist = hypot(dx, dy)

            if dist < magnetR && dist > 1.0 {
                let pullSpeed = (vm.frenzyActive ? 620.0 : 410.0) * invZoom
                pk.vx += (dx / dist) * pullSpeed * dt * 5.2
                pk.vy += (dy / dist) * pullSpeed * dt * 5.2
            } else {
                pk.vx *= 0.94
                pk.vy = pk.vy * 0.94 - 8.0 * dt
            }
            pk.x += pk.vx * dt
            pk.y += pk.vy * dt

            if dist < collectRadius || pk.life <= 0 {
                if dist < collectRadius, let collectedVal = pk.collectIfEligible() {
                    if pk.isGene {
                        vm.save.bankedGenes += collectedVal
                        vm.runGenesEarned += collectedVal
                        vm.score += collectedVal * pickupCfg.geneScorePerUnit
                        if vm.save.soundEnabled {
                            OceanAudioEngine.shared.playCoin(isGene: true)
                        }
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 12.0 * invZoom,
                            text: "+\(collectedVal) 🧬",
                            color: UIColor(red: 110/255, green: 231/255, blue: 183/255, alpha: 1.0),
                            fontSize: 13
                        )
                    } else {
                        vm.save.bankedCoins += collectedVal
                        vm.runCoinsEarned += collectedVal
                        vm.score += collectedVal * pickupCfg.coinScorePerUnit
                        if vm.save.soundEnabled {
                            OceanAudioEngine.shared.playCoin(isGene: false)
                        }
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 10.0 * invZoom,
                            text: "+\(collectedVal) 🪙",
                            color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                            fontSize: 12
                        )
                    }
                }
                pk.node.removeFromParent()
                activePickups.remove(at: kIdx)
                kIdx -= 1
                continue
            }

            let sx = viewW * 0.5 + (pk.x - cameraX) * zoom
            let sy = viewH * 0.5 - (pk.y - cameraY) * zoom
            pk.node.position = CGPoint(x: sx, y: sy)
            let pkScale = CGFloat(max(0.72, min(1.15, 0.82 + 0.18 * zoom)))
            pk.node.xScale = CGFloat(0.35 + 0.65 * abs(cos(pk.spinPhase))) * pkScale
            pk.node.yScale = pkScale
            pk.node.alpha = pk.life <= pickupCfg.blinkStartRemainingSec
                ? CGFloat(0.28 + 0.72 * abs(sin(pk.life * 14.0)))
                : 1.0
            kIdx -= 1
        }

        var fIdx = activeFloatTexts.count - 1
        while fIdx >= 0 {
            let ft = activeFloatTexts[fIdx]
            ft.life -= dt
            if ft.life <= 0 {
                ft.node.removeFromParent()
                activeFloatTexts.remove(at: fIdx)
                fIdx -= 1
                continue
            }
            ft.y += ft.vy * dt * invZoom
            ft.vy *= 0.94
            let progress = 1.0 - (ft.life / ft.maxLife)
            let popScale = progress < 0.18 ? (0.65 + (progress / 0.18) * 0.48) : (1.13 - (progress - 0.18) * 0.22)
            let sx = viewW * 0.5 + (ft.x - cameraX) * zoom
            let sy = viewH * 0.5 - (ft.y - cameraY) * zoom
            ft.node.position = CGPoint(x: sx, y: sy)
            ft.node.setScale(CGFloat(max(0.5, popScale)))
            ft.node.alpha = CGFloat(min(1.0, ft.life / (ft.maxLife * 0.42)))
            fIdx -= 1
        }
    }
}
