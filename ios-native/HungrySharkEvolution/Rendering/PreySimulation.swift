import SpriteKit
import UIKit
import simd

/// Five-gait biomechanical swim classification sets (stored outside extensions per Swift rules).
private enum PreyGaitCatalog {
    static let sharkLikeIds: Set<String> = [
        "PREY-089", "PREY-090", "PREY-091", "PREY-092", "PREY-093",
        "PREY-094", "PREY-095", "PREY-096", "PREY-097", "PREY-098",
        "PREY-111", "PREY-112", "PREY-113"
    ]
    static let elongatedIds: Set<String> = [
        "PREY-079", "PREY-081", "PREY-083", "PREY-127", "PREY-128", "PREY-129"
    ]
    static let pufferIds: Set<String> = [
        "PREY-050", "PREY-051", "PREY-052", "PREY-053", "PREY-054",
        "PREY-069", "PREY-070", "PREY-071", "PREY-072", "PREY-073",
        "PREY-099", "PREY-103"
    ]
    static let rigidIds: Set<String> = [
        "PREY-114", "PREY-115", "PREY-116"
    ]
}

/// Prey ecosystem spawning, depth-band filtering, AI cruising, jaw suction, combat resolution & spine warp.
extension OceanGameScene {
    func classifyPreySwimGait(_ p: PreyTierConfig) -> PreySwimGait {
        if PreyGaitCatalog.sharkLikeIds.contains(p.id) { return .SHARK_APEX }
        if p.isHazard || PreyGaitCatalog.rigidIds.contains(p.id) { return .RIGID_PROPULSION }
        if p.behavior == .EEL_CHARGER || PreyGaitCatalog.elongatedIds.contains(p.id) {
            return .ANGUILLIFORM
        }
        if p.behavior == .PUFFER_INFLATE || PreyGaitCatalog.pufferIds.contains(p.id) {
            return .PUFFER_BUOYANT
        }
        return .CARANGIFORM
    }

    func applyPreySpineWaveWarp(to node: SKSpriteNode, prey: ActivePrey, screenMaxDim: Double, currentTime: TimeInterval) {
        let gait = classifyPreySwimGait(prey.config)
        if gait == .RIGID_PROPULSION || screenMaxDim < 22.0 {
            if node.warpGeometry != nil { node.warpGeometry = nil }
            return
        }
        // Throttle prey spine warp to ~30Hz (halves SKWarpGeometryGrid GPU uploads with imperceptible visual diff)
        if node.warpGeometry != nil && (currentTime - prey.lastWarpTime) < (1.0 / 30.0) {
            return
        }
        prey.lastWarpTime = currentTime

        let cols = 6
        let count = (cols + 1) * 2
        preyWarpSrc.removeAll(keepingCapacity: true)
        preyWarpDst.removeAll(keepingCapacity: true)
        if preyWarpSrc.capacity < count { preyWarpSrc.reserveCapacity(count) }
        if preyWarpDst.capacity < count { preyWarpDst.reserveCapacity(count) }

        for row in 0...1 {
            let v = Float(row)
            for col in 0...cols {
                let u = Float(col) / Float(cols)
                preyWarpSrc.append(SIMD2<Float>(u, v))
                let tailProgress = Double(1.0 - u)
                let sharkLikeEnv = 0.015 * tailProgress + 0.985 * pow(tailProgress, 2.25)
                let dy: Double
                switch gait {
                case .SHARK_APEX:
                    dy = sin(prey.phase - tailProgress * 2.15 * .pi) * 0.088 * sharkLikeEnv
                case .CARANGIFORM:
                    dy = sin(prey.phase - tailProgress * 2.15 * .pi) * 0.068 * sharkLikeEnv
                case .ANGUILLIFORM:
                    let eelEnv = 0.02 * tailProgress + 0.98 * pow(tailProgress, 1.95)
                    dy = sin(prey.phase * 1.12 - tailProgress * 2.35 * .pi) * 0.082 * eelEnv
                case .MEDUSOID_JET:
                    dy = sin(prey.phase * 0.92 - tailProgress * 1.85 * .pi) * 0.056 * sharkLikeEnv
                case .PUFFER_BUOYANT:
                    dy = sin(prey.phase * 1.15 - tailProgress * 1.95 * .pi) * 0.046 * sharkLikeEnv
                case .RIGID_PROPULSION:
                    dy = 0
                }
                preyWarpDst.append(SIMD2<Float>(u, v + Float(dy)))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: preyWarpSrc, destinationPositions: preyWarpDst)
    }

    func syncPreyPopulationInitial() {
        var attempts = 0
        let maxAttempts = maxActivePreys * 2
        while activePreys.count < maxActivePreys && attempts < maxAttempts {
            attempts += 1
            if !spawnOnePrey() {
                break
            }
        }
        preySpawnTimer = Double.random(in: 0.35...0.88)
    }

    func syncPreyPopulation(dt: Double) {
        guard activePreys.count < maxActivePreys else { return }
        preySpawnTimer -= dt
        if preySpawnTimer <= 0 {
            spawnOnePrey()
            preySpawnTimer = Double.random(in: 0.35...0.88)
        }
    }

    @discardableResult
    func spawnOnePrey() -> Bool {
        let viewW = Double(max(320, size.width))
        let viewH = Double(max(240, size.height))
        let renderZoom = max(GameRules.minRenderZoomFloor, smoothedCameraZoom)
        let invZoom = 1.0 / max(GameRules.cameraZoomMin, renderZoom)
        let halfViewW = max(520.0, (viewW * 0.5) / renderZoom)
        let halfViewH = max(320.0, (viewH * 0.5) / renderZoom)
        let verticalSpread = min(halfViewH * 0.85, max(260.0, halfViewH * 0.72))

        let minSpawnLenM = viewModel?.currentStats.minSpawnablePreyLengthM ?? 0.0
        var targetDepth = max(45.0, sharkY + Double.random(in: -verticalSpread...verticalSpread))
        if sharkY <= 430.0 && minSpawnLenM < 1.2 {
            targetDepth = min(495.0, targetDepth)
        }
        let isShallowZone = targetDepth <= 520.0
        let habitatPool = GameConfigGenerated.preyTiers.filter { p in
            if isShallowZone && (p.isHazard || p.isBoss || p.behavior == .EEL_CHARGER || p.behavior == .SUB_PATROL) {
                return false
            }
            return targetDepth >= p.minDepth && targetDepth <= p.maxDepth
        }
        let rawCandidates = !habitatPool.isEmpty
            ? habitatPool
            : (isShallowZone
                ? GameConfigGenerated.preyTiers.filter { $0.minDepth <= 520.0 }
                : (targetDepth > 1150.0
                    ? GameConfigGenerated.preyTiers.filter { $0.maxDepth >= 1150.0 }
                    : GameConfigGenerated.preyTiers.filter { $0.minDepth >= 500.0 || $0.maxDepth >= 800.0 }))

        let minPreyLenCm = minSpawnLenM * 100.0
        let candidates = minPreyLenCm > 0
            ? rawCandidates.filter { ($0.bodyLengthCm > 0 ? $0.bodyLengthCm : $0.radius * 2.5) >= minPreyLenCm }
            : rawCandidates

        if candidates.isEmpty {
            return false
        }

        var targetTier: Double = 2.0
        if targetDepth <= 520.0 {
            targetTier = 1.0 + ((targetDepth - 25.0) / 495.0) * 8.5
        } else if targetDepth <= 1150.0 {
            targetTier = 11.0 + ((targetDepth - 520.0) / 630.0) * 13.0
        } else if targetDepth <= 3500.0 {
            targetTier = 24.0 + ((targetDepth - 1150.0) / 2350.0) * 11.0
        } else if targetDepth <= 9500.0 {
            targetTier = 35.0 + ((targetDepth - 3500.0) / 6000.0) * 8.0
        } else {
            targetTier = 43.0 + min(1.0, (targetDepth - 9500.0) / 9000.0) * 5.0
        }

        let predatorRoll = Double.random(in: 0...1)
        if predatorRoll < 0.12 {
            targetTier = min(48.0, targetTier + 4.5)
        } else if predatorRoll < 0.36 {
            targetTier = min(48.0, targetTier + 2.0)
        }

        let weights = candidates.map { p -> Double in
            let diff = (Double(p.tier) - targetTier) / 3.0
            return 1.0 / (1.0 + diff * diff)
        }
        let totalW = weights.reduce(0.0, +)
        var roll = Double.random(in: 0..<max(0.001, totalW))
        var chosen = candidates.last ?? GameConfigGenerated.preyTiers[0]
        for (i, p) in candidates.enumerated() {
            roll -= weights[i]
            if roll <= 0 {
                chosen = p
                break
            }
        }
        let spawnOnLeft = Bool.random()
        let edgeOffset = Double.random(in: 80.0...175.0) * invZoom
        let px = spawnOnLeft ? (cameraX - halfViewW - edgeOffset) : (cameraX + halfViewW + edgeOffset)
        let dir: Double = Bool.random() ? 1.0 : -1.0

        let localFloorLimit = max(140.0, GameRules.getFloorDepthAt(worldX: px) - chosen.radius - 34.0)
        let rawPy = max(chosen.minDepth, min(chosen.maxDepth, sharkY + Double.random(in: -halfViewH...halfViewH) * 0.82))
        let clampedPy = min(rawPy, localFloorLimit)
        let spawnCol = GameRules.resolveSeabedCollision(
            worldX: px,
            worldY: clampedPy,
            vy: 0.0,
            entityRadius: chosen.radius + 16.0,
            clearancePadding: 10.0,
            prevWorldY: clampedPy,
            options: GameRules.SeabedCollisionOptions(breachedCells: breachedTerraceCells)
        )
        let py = max(chosen.minDepth + 16.0, min(localFloorLimit, spawnCol.y))

        let node = SKSpriteNode()
        if let tex = SpriteAtlasManager.shared.preyTexture(for: chosen.spriteKey) {
            node.texture = tex
        }
        node.zPosition = 12
        worldContainer.addChild(node)
        activePreys.append(
            ActivePrey(
                config: chosen,
                node: node,
                x: px,
                y: py,
                vx: dir * chosen.baseSpeed,
                vy: Double.random(in: -8.0...8.0),
                mutation: Double.random(in: 0...1) < 0.08 ? .GOLDEN_SWARM : .NONE
            )
        )
        return true
    }

    func stepAndRenderPreys(viewW: Double, viewH: Double, stats: ComputedSharkStats, renderZoom: Double, dt: Double, currentTime: TimeInterval) {
        guard let vm = viewModel else { return }
        syncPreyPopulation(dt: dt)
        let zoom = renderZoom
        let halfViewW = max(520.0, (viewW * 0.5) / zoom)
        let cullDist = max(1950.0, halfViewW * 1.55 + 650.0)
        let senseScale = max(1.0, stats.worldScale * 0.55)
        let preySeabedOptions = GameRules.SeabedCollisionOptions(breachedCells: breachedTerraceCells)

        var idx = activePreys.count - 1
        while idx >= 0 {
            let p = activePreys[idx]
            let gait = classifyPreySwimGait(p.config)
            let worldPreySpeed = p.config.baseSpeed
            let speedNorm = max(0.72, min(1.35, hypot(p.vx, p.vy) / max(18.0, p.config.baseSpeed)))
            p.phase += dt * 4.6 * speedNorm
            p.stateTimer += dt

            let dx = p.x - sharkX
            let dy = p.y - sharkY
            let dist = hypot(dx, dy)

            if dist > cullDist {
                p.node.removeFromParent()
                activePreys.remove(at: idx)
                idx -= 1
                continue
            }

            let visualScale = GameRules.getPreyRelativeVisualScale(
                prey: p.config,
                sharkStats: stats,
                mutationVariant: p.mutation
            )
            let encounterPreview = GameRules.resolvePreyEncounter(
                prey: p.config,
                sharkStats: stats,
                isBoosting: vm.isBoostingHeld && vm.energy > 2.0,
                frenzyActive: vm.frenzyActive,
                mutationVariant: p.mutation
            )

            let dirSign: Double = p.vx >= 0 ? 1.0 : -1.0
            switch p.config.behavior {
            case .SCHOOL_FLEE:
                if dist < 250.0 * senseScale && encounterPreview == .DEVOUR && dist > 1.0 {
                    let fleeAng = atan2(dy, dx) + sin(p.phase * 1.35) * 0.18
                    let fleeSpd = worldPreySpeed * 1.42
                    p.vx += (cos(fleeAng) * fleeSpd - p.vx) * min(1.0, dt * 4.5)
                    p.vy += (sin(fleeAng) * fleeSpd - p.vy) * min(1.0, dt * 4.5)
                } else {
                    let targetY = p.cruiseDepthCenter + sin(p.stateTimer * p.cruiseFreq) * p.cruiseAmpY
                    let desiredVy = (targetY - p.y) * 0.92 + cos(p.phase * 0.65) * worldPreySpeed * 0.14
                    let desiredVx = dirSign * worldPreySpeed * (0.92 + 0.12 * sin(p.stateTimer * 0.95))
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
                }
            case .PUFFER_INFLATE:
                let targetInflate = dist < 195.0 * senseScale ? 1.0 : 0.0
                p.inflateRatio += (targetInflate - p.inflateRatio) * min(1.0, dt * 4.5)
                let targetY = p.cruiseDepthCenter + sin(p.stateTimer * 0.65) * (p.cruiseAmpY * 0.65)
                let desiredVy = (targetY - p.y) * 0.85 + sin(p.phase * 0.6) * 12.0
                let desiredVx = dirSign * worldPreySpeed * (1.0 - p.inflateRatio * 0.35)
                p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
            case .EEL_CHARGER:
                if dist < 310.0 * senseScale && encounterPreview != .DEVOUR && dist > 1.0 {
                    let atkAng = atan2(-dy, -dx) + sin(p.phase * 1.4) * 0.14
                    let atkSpd = worldPreySpeed * 1.42
                    p.vx += (cos(atkAng) * atkSpd - p.vx) * min(1.0, dt * 4.0)
                    p.vy += (sin(atkAng) * atkSpd - p.vy) * min(1.0, dt * 4.0)
                } else {
                    let desiredVy = cos(p.phase * 0.75) * worldPreySpeed * 0.18
                    let desiredVx = dirSign * worldPreySpeed
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.0)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.0)
                }
            case .MINE_HAZARD:
                p.vx = sin(p.stateTimer * 0.8 + p.phase * 0.2) * 8.0
                p.vy = cos(p.stateTimer * 1.1 + p.phase * 0.3) * 10.0
            default:
                if gait == .MEDUSOID_JET {
                    let jetPulse = 0.72 + 0.38 * pow(max(0.0, sin(p.phase * 0.65)), 2.0)
                    let desiredVx = dirSign * worldPreySpeed * jetPulse
                    let desiredVy = cos(p.stateTimer * 0.75) * 14.0
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 3.5)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 3.5)
                } else {
                    let targetY = p.cruiseDepthCenter + sin(p.stateTimer * p.cruiseFreq) * p.cruiseAmpY
                    let desiredVy = (targetY - p.y) * 0.88 + sin(p.phase * 0.6) * worldPreySpeed * 0.14
                    let desiredVx = dirSign * worldPreySpeed * (0.92 + 0.12 * cos(p.stateTimer * 0.85))
                    p.vx += (desiredVx - p.vx) * min(1.0, dt * 2.8)
                    p.vy += (desiredVy - p.vy) * min(1.0, dt * 2.8)
                }
            }

            let suctionRadius = (58.0 + stats.magnetRadius * 0.35) * stats.jawSuctionMultiplier * stats.worldScale
            let mouthX = sharkX + cos(sharkAngle) * 28.0 * stats.worldScale
            let mouthY = sharkY + sin(sharkAngle) * 28.0 * stats.worldScale
            let mouthDist = hypot(mouthX - p.x, mouthY - p.y)
            if vm.gameState == "playing" && encounterPreview == .DEVOUR && mouthDist < suctionRadius && mouthDist > 1.0 {
                let pullStrength = (1.0 - mouthDist / suctionRadius) * 540.0 * max(1.0, stats.worldScale * 0.65)
                p.x += ((mouthX - p.x) / mouthDist) * pullStrength * dt
                p.y += ((mouthY - p.y) / mouthDist) * pullStrength * dt
                if biteAnim < 0.35 {
                    biteAnim = 0.55
                }
            }

            let prevPreyX = p.x
            let prevPreyY = p.y
            let nextPreyX = p.x + p.vx * dt
            var nextPreyY = p.y + p.vy * dt
            if nextPreyY < p.config.minDepth + 14.0 {
                nextPreyY = p.config.minDepth + 14.0
                p.vy = abs(p.vy) * 0.65 + 18.0
            } else if nextPreyY > p.config.maxDepth - 14.0 {
                nextPreyY = p.config.maxDepth - 14.0
                p.vy = -abs(p.vy) * 0.65 - 18.0
            }
            let preyHitRadius = p.config.radius * visualScale * 0.85 + 14.0
            let preyStepCol = GameRules.resolveSeabedKineticStep(
                prevX: prevPreyX,
                prevY: prevPreyY,
                nextX: nextPreyX,
                nextY: nextPreyY,
                vx: p.vx,
                vy: p.vy,
                entityRadius: preyHitRadius,
                clearancePadding: 8.0,
                options: preySeabedOptions
            )
            p.x = preyStepCol.x
            p.y = preyStepCol.y
            if preyStepCol.hitSeabed {
                p.vy = min(preyStepCol.vy, -abs(p.config.baseSpeed) * 0.45 - 16.0)
                p.cruiseDepthCenter = max(p.config.minDepth + 35.0, min(p.cruiseDepthCenter, p.y - 42.0))
                if abs(preyStepCol.x - prevPreyX) < abs(nextPreyX - prevPreyX) * 0.35 {
                    p.vx = -p.vx
                }
            } else if preyStepCol.hitAtollUnderside {
                p.vy = max(preyStepCol.vy, abs(p.config.baseSpeed) * 0.45 + 16.0)
                p.cruiseDepthCenter = min(p.config.maxDepth - 35.0, max(p.cruiseDepthCenter, p.y + 42.0))
                if abs(preyStepCol.x - prevPreyX) < abs(nextPreyX - prevPreyX) * 0.35 {
                    p.vx = -p.vx
                }
            }

            let postDx = p.x - sharkX
            let postDy = p.y - sharkY
            let postDist = hypot(postDx, postDy)
            let hitRadius = p.config.radius * visualScale + 28.0 * stats.worldScale

            if vm.gameState == "playing" && postDist < hitRadius {
                if encounterPreview == .DEVOUR {
                    biteAnim = 1.0
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + (p.config.tier >= 4 ? 0.36 : 0.16))

                    let mult = p.mutation == .GOLDEN_SWARM ? 3 : 1
                    let heatScoreMult = vm.huntingHeatBuff.scoreMultiplier
                    let scoreGain = Int((Double(p.config.scoreValue * mult) * heatScoreMult).rounded())
                    vm.score += scoreGain

                    let coinGain = max(1, Int((Double(p.config.coinValue * mult) * stats.coinYieldMultiplier).rounded()))
                    var geneGain = 0
                    if p.config.geneValue > 0 && (p.mutation == .GOLDEN_SWARM || Double.random(in: 0...1) < 0.38) {
                        geneGain = max(1, Int((Double(p.config.geneValue) * stats.geneYieldMultiplier).rounded()))
                    }

                    spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier, isGolden: p.mutation == .GOLDEN_SWARM)
                    spawnDevourPickups(x: p.x, y: p.y, coinGain: coinGain, geneGain: geneGain)

                    vm.comboCount += 1
                    vm.comboTimer = 4.2
                    if vm.comboCount > vm.runPeakCombo {
                        vm.runPeakCombo = vm.comboCount
                    }
                    if vm.save.soundEnabled {
                        OceanAudioEngine.shared.playBite(tier: p.config.tier, combo: vm.comboCount)
                    }

                    let devourLabel: String
                    if p.mutation == .GOLDEN_SWARM {
                        devourLabel = vm.lang == "zh" ? "✨ 黄金吞噬! +\(scoreGain)" : "✨ GOLDEN! +\(scoreGain)"
                    } else if vm.comboCount >= 3 {
                        devourLabel = vm.lang == "zh"
                            ? "一口吞噬! +\(scoreGain) · x\(vm.comboCount)🔥"
                            : "CHOMP! +\(scoreGain) · x\(vm.comboCount)🔥"
                    } else {
                        devourLabel = "+\(scoreGain)"
                    }
                    spawnFloatingText(
                        x: p.x,
                        y: p.y - 14.0 * max(1.0, stats.worldScale * 0.5),
                        text: devourLabel,
                        color: p.mutation == .GOLDEN_SWARM
                            ? UIColor(red: 250/255, green: 204/255, blue: 21/255, alpha: 1.0)
                            : UIColor(red: 74/255, green: 222/255, blue: 128/255, alpha: 1.0),
                        fontSize: vm.comboCount >= 5 ? 15 : 13
                    )

                    if p.config.id == vm.targetBountyPreyId {
                        vm.targetBountyCaptured += 1
                        if vm.targetBountyCaptured >= 3 {
                            vm.save.bankedCoins += 45
                            vm.save.bankedGenes += 3
                            vm.runCoinsEarned += 45
                            vm.runGenesEarned += 3
                            vm.pickNewBountyPrey(currentWorldY: sharkY)
                            vm.playSuccessSound()
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 34.0 * max(1.0, stats.worldScale * 0.5),
                                text: vm.lang == "zh" ? "🎯 悬赏达成! +45🪙 +3🧬" : "🎯 BOUNTY! +45🪙 +3🧬",
                                color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                                fontSize: 15
                            )
                        }
                    }

                    if p.mutation == .GOLDEN_SWARM {
                        vm.goldenMutantCharge += 1
                        if vm.goldenMutantCharge >= vm.goldenMutantNeed {
                            vm.goldenMutantCharge = 0
                            vm.frenzyActive = true
                            vm.frenzyTimer = GameConfigGenerated.frenzyDuration + stats.frenzyDurationBonus
                            vm.recomputeCurrentSharkStats()
                            if vm.save.soundEnabled {
                                OceanAudioEngine.shared.playFrenzy()
                            }
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 40.0 * max(1.0, stats.worldScale * 0.5),
                                text: vm.lang == "zh" ? "🔥 黄金狂暴觉醒!" : "🔥 GOLDEN FRENZY!",
                                color: UIColor.yellow,
                                fontSize: 16
                            )
                        }
                    }

                    if vm.onboardingStep == .EAT_SMALL_FISH {
                        vm.onboardingEatCount += 1
                        if vm.onboardingEatCount >= 3 {
                            vm.onboardingStep = .HOLD_BOOST
                            vm.playSuccessSound()
                        }
                    }

                    vm.hp = min(vm.maxHp, vm.hp + p.config.hpRestore * stats.devourHealMultiplier)
                    if vm.addXp(p.config.xpValue * mult) {
                        spawnFloatingText(
                            x: sharkX,
                            y: sharkY - 38.0 * max(1.0, stats.worldScale * 0.5),
                            text: vm.lang == "zh" ? "⚡ LV.\(vm.inRunLevel) 体型成长!" : "⚡ LV.\(vm.inRunLevel) SIZE UP!",
                            color: UIColor.cyan,
                            fontSize: 16
                        )
                    }
                    HapticFeedbackManager.shared.playLight()
                    p.node.removeFromParent()
                    activePreys.remove(at: idx)
                    idx -= 1
                    continue
                } else if encounterPreview == .ARMOR_CRUSH {
                    p.armorHp -= 1
                    biteAnim = 0.85
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.42)
                    invulnTimer = 0.45
                    HapticFeedbackManager.shared.playHeavy()
                    if vm.save.soundEnabled {
                        OceanAudioEngine.shared.playArmorCrush(broken: p.armorHp <= 0)
                    }
                    if p.armorHp <= 0 {
                        vm.score += p.config.scoreValue * 2
                        let gGain = max(1, p.config.geneValue * 2)
                        spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier + 2, isGolden: true)
                        spawnDevourPickups(x: p.x, y: p.y, coinGain: p.config.coinValue * 2, geneGain: gGain)
                        spawnFloatingText(
                            x: p.x,
                            y: p.y - 16.0 * max(1.0, stats.worldScale * 0.5),
                            text: vm.lang == "zh" ? "💥 破甲粉碎! +\(p.config.scoreValue * 2)" : "💥 ARMOR CRUSH! +\(p.config.scoreValue * 2)",
                            color: UIColor.cyan,
                            fontSize: 15
                        )
                        _ = vm.addXp(Int(Double(p.config.xpValue) * 1.5))
                        p.node.removeFromParent()
                        activePreys.remove(at: idx)
                        idx -= 1
                        continue
                    } else {
                        spawnFloatingText(
                            x: p.x,
                            y: p.y - 14.0 * max(1.0, stats.worldScale * 0.5),
                            text: vm.lang == "zh" ? "⚡ 护甲裂纹!" : "⚡ ARMOR CRACK!",
                            color: UIColor.orange,
                            fontSize: 13
                        )
                        p.x += (postDx / max(1.0, postDist)) * 65.0 * max(1.0, stats.worldScale * 0.5)
                    }
                } else if encounterPreview == .NEED_BOOST {
                    if invulnTimer <= 0 {
                        vm.hp = max(0, vm.hp - p.config.damageOnFail * 0.85 * stats.damageTakenMultiplier)
                        invulnTimer = 0.65
                        cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.35)
                        spawnFloatingText(
                            x: sharkX,
                            y: sharkY - 26.0 * max(1.0, stats.worldScale * 0.5),
                            text: vm.lang == "zh" ? "⚠️ 按住冲刺破甲!" : "⚠️ BOOST TO CRUSH!",
                            color: UIColor.orange,
                            fontSize: 14
                        )
                        HapticFeedbackManager.shared.playNotification(.warning)
                        if vm.save.soundEnabled {
                            OceanAudioEngine.shared.playHit()
                        }
                        vm.flushTelemetryImmediate(timestamp: currentTime)
                        p.x += (postDx / max(1.0, postDist)) * 45.0 * max(1.0, stats.worldScale * 0.5)
                    }
                } else if invulnTimer <= 0 {
                    vm.hp = max(0, vm.hp - p.config.damageOnFail * stats.damageTakenMultiplier)
                    invulnTimer = 0.85
                    cameraShakeTrauma = min(1.0, cameraShakeTrauma + 0.48)
                    spawnFloatingText(
                        x: sharkX,
                        y: sharkY - 26.0 * max(1.0, stats.worldScale * 0.5),
                        text: vm.lang == "zh" ? "⚠️ 致命天敌! 需T\(p.config.tier)" : "⚠️ DEADLY! NEED T\(p.config.tier)",
                        color: UIColor(red: 248/255, green: 113/255, blue: 113/255, alpha: 1.0),
                        fontSize: 14
                    )
                    HapticFeedbackManager.shared.playNotification(.error)
                    if vm.save.soundEnabled {
                        OceanAudioEngine.shared.playHit()
                    }
                    vm.flushTelemetryImmediate(timestamp: currentTime)
                }
            }

            let screenX = viewW * 0.5 + (p.x - cameraX) * zoom
            let screenY = viewH * 0.5 - (p.y - cameraY) * zoom
            let inflateScale = 1.0 + p.inflateRatio * 0.38
            let baseSize = p.config.radius * GameRules.preyRadiusToDrawSize * visualScale * inflateScale * zoom
            if p.node.texture == nil,
               let loadedTex = SpriteAtlasManager.shared.preyTexture(for: p.config.spriteKey) {
                p.node.texture = loadedTex
            }
            let texAspect: Double
            if let tex = p.node.texture, tex.size().height > 0 {
                texAspect = Double(tex.size().width / tex.size().height)
            } else {
                texAspect = 1.45
            }
            let clampedAspect = max(0.42, min(2.65, texAspect))
            let sqrtAspect = sqrt(clampedAspect)
            let drawW = baseSize * sqrtAspect
            let drawH = (baseSize / sqrtAspect) * (p.inflateRatio > 0.05 ? 1.16 : 1.0)
            p.node.size = CGSize(width: drawW, height: drawH)
            p.node.position = CGPoint(x: screenX, y: screenY)

            let facingSign: Double = p.vx >= 0 ? 1.0 : -1.0
            let pitchAngle = max(-0.22, min(0.22, atan2(-p.vy, max(24.0, abs(p.vx))) * 0.42))
            p.node.xScale = CGFloat(facingSign)
            p.node.yScale = 1.0
            p.node.zRotation = CGFloat(pitchAngle * facingSign)

            if vm.frenzyActive || p.mutation == .GOLDEN_SWARM {
                p.node.color = UIColor(red: 1.0, green: 0.85, blue: 0.12, alpha: 1.0)
                p.node.colorBlendFactor = CGFloat(0.66 + 0.14 * sin(p.phase * 1.8))
            } else if p.mutation == .ABYSS_BEHEMOTH {
                p.node.color = UIColor(red: 0.68, green: 0.28, blue: 0.98, alpha: 1.0)
                p.node.colorBlendFactor = 0.45
            } else {
                p.node.colorBlendFactor = 0.0
            }

            applyPreySpineWaveWarp(to: p.node, prey: p, screenMaxDim: max(drawW, drawH), currentTime: currentTime)
            idx -= 1
        }
    }
}
