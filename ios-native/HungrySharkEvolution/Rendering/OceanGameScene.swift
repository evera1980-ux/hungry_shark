import SpriteKit
import SwiftUI
import UIKit
import simd

/// Native SpriteKit (Metal-Accelerated) Ocean Simulation, 5-Layer Parallax & Devour FX Scene
/// (AdMob monetization lives in Monetization/GoogleAdMobManager.swift; ViewModel state lives in State/GameViewModel.swift)
@MainActor
public final class OceanGameScene: SKScene {
    public weak var viewModel: GameViewModel?

    var sharkX: Double = 0
    var sharkY: Double = 220
    var sharkVx: Double = 160
    var sharkVy: Double = 0
    var sharkAngle: Double = 0
    var sharkTargetAngle: Double = 0
    var swimPhase: Double = 0
    var facingDir: Double = 1
    var facingScaleX: Double = 1
    var turnRate: Double = 0
    var biteAnim: Double = 0
    var cameraShakeTrauma: Double = 0
    var invulnTimer: Double = 0
    var cameraX: Double = 0
    var cameraY: Double = 220
    var smoothedCameraZoom: Double = 1.0
    var smoothedDepthRefY: Double = -1.0
    var breachedTerraceCells: Set<String> = []
    var breachedTerraceOrder: [String] = []
    var shallowDepletionTimer: Double = 0.0
    var lastUpdateTime: TimeInterval = 0
    var survivalAccumulator: Double = 0
    var lastTrackedGameState: String = ""
    var lastTrackedRunSequenceId: Int = -1

    // Pre-allocated warp grid scratch buffers (iOS-P1-1: eliminates dozens of per-frame heap allocations)
    var sharkWarpSrc: [SIMD2<Float>] = []
    var sharkWarpDst: [SIMD2<Float>] = []
    var preyWarpSrc: [SIMD2<Float>] = []
    var preyWarpDst: [SIMD2<Float>] = []
    var seabedWarpSrc: [SIMD2<Float>] = []
    var seabedWarpDst: [SIMD2<Float>] = []

    let waterBgNode = SKSpriteNode()
    let parallaxContainer = SKNode()
    let worldContainer = SKNode()
    let fxContainer = SKNode()
    let sharkNode = SKSpriteNode()

    enum PreySwimGait {
        case SHARK_APEX
        case CARANGIFORM
        case ANGUILLIFORM
        case MEDUSOID_JET
        case PUFFER_BUOYANT
        case RIGID_PROPULSION
    }

    final class ActivePrey {
        let config: PreyTierConfig
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var phase: Double
        var stateTimer: Double
        var armorHp: Int
        var mutation: PreyMutationVariant
        var inflateRatio: Double
        var cruiseDepthCenter: Double
        let cruiseAmpY: Double
        let cruiseFreq: Double
        var lastWarpTime: TimeInterval = 0

        init(config: PreyTierConfig, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double, mutation: PreyMutationVariant) {
            self.config = config
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.phase = Double.random(in: 0...(Double.pi * 2))
            self.stateTimer = Double.random(in: 0...4.0)
            self.armorHp = 2
            self.mutation = mutation
            self.inflateRatio = 0.0
            self.cruiseDepthCenter = max(config.minDepth + 35.0, min(config.maxDepth - 35.0, y))
            self.cruiseAmpY = Double.random(in: 12.0...26.0)
            self.cruiseFreq = Double.random(in: 0.36...0.68)
        }
    }

    final class ActiveParticle {
        let node: SKShapeNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var life: Double
        let maxLife: Double
        let baseRadius: Double
        let isRing: Bool

        init(node: SKShapeNode, x: Double, y: Double, vx: Double, vy: Double, maxLife: Double, baseRadius: Double, isRing: Bool = false) {
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.life = maxLife
            self.maxLife = maxLife
            self.baseRadius = baseRadius
            self.isRing = isRing
        }
    }

    final class ActivePickup {
        let isGene: Bool
        let value: Int
        let node: SKSpriteNode
        var x: Double
        var y: Double
        var vx: Double
        var vy: Double
        var spinPhase: Double
        var life: Double

        init(isGene: Bool, value: Int, node: SKSpriteNode, x: Double, y: Double, vx: Double, vy: Double) {
            self.isGene = isGene
            self.value = value
            self.node = node
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
            self.spinPhase = Double.random(in: 0...(Double.pi * 2))
            self.life = 11.0
        }
    }

    final class ActiveFloatText {
        let node: SKLabelNode
        var x: Double
        var y: Double
        var vy: Double
        var life: Double
        let maxLife: Double

        init(node: SKLabelNode, x: Double, y: Double, vy: Double, maxLife: Double) {
            self.node = node
            self.x = x
            self.y = y
            self.vy = vy
            self.life = maxLife
            self.maxLife = maxLife
        }
    }

    final class AmbientOceanBubble {
        let ringNode: SKShapeNode
        let highlightNode: SKShapeNode
        var x: Double
        var y: Double
        let r: Double
        let speedY: Double
        var wobblePhase: Double
        let baseAlpha: Double
        let kindIndex: Int // 0 = BUBBLE, 1 = MARINE_SNOW, 2 = BIO_SPORE, 3 = MAGMA_EMBER

        init(ringNode: SKShapeNode, highlightNode: SKShapeNode, x: Double, y: Double, r: Double, speedY: Double, wobblePhase: Double, baseAlpha: Double, kindIndex: Int) {
            self.ringNode = ringNode
            self.highlightNode = highlightNode
            self.x = x
            self.y = y
            self.r = r
            self.speedY = speedY
            self.wobblePhase = wobblePhase
            self.baseAlpha = baseAlpha
            self.kindIndex = kindIndex
        }
    }

    let bubbleContainer = SKNode()
    var seabedArchFillPool: [SKShapeNode] = []
    var activeSeabedArchFillCount: Int = 0
    var parallaxTilePool: [SKSpriteNode] = []
    var activeParallaxTileCount: Int = 0
    var ambientBubbles: [AmbientOceanBubble] = []
    var trailBubbleAccumulator: Double = 0.0
    var activePreys: [ActivePrey] = []
    var activeParticles: [ActiveParticle] = []
    var activePickups: [ActivePickup] = []
    var activeFloatTexts: [ActiveFloatText] = []
    var preySpawnTimer: Double = 0.0
    let maxActivePreys = 22

    public override func didMove(to view: SKView) {
        backgroundColor = UIColor(red: 6/255, green: 21/255, blue: 40/255, alpha: 1)
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0, y: 0)

        // Start off-main-thread asynchronous texture decoding & Metal GPU warm-up (zero main-thread blocking!)
        SpriteAtlasManager.shared.startAsyncPreloadIfNeeded()

        removeAllChildren()
        addChild(waterBgNode)
        addChild(parallaxContainer)
        bubbleContainer.zPosition = 8
        addChild(bubbleContainer)
        addChild(worldContainer)
        addChild(fxContainer)

        if seabedArchFillPool.isEmpty {
            for _ in 0..<14 {
                let sNode = SKShapeNode()
                sNode.zPosition = 4.0
                sNode.lineWidth = 0.0
                sNode.strokeColor = .clear
                sNode.isHidden = true
                parallaxContainer.addChild(sNode)
                seabedArchFillPool.append(sNode)
            }
        } else {
            for sNode in seabedArchFillPool where sNode.parent == nil {
                parallaxContainer.addChild(sNode)
            }
        }

        if parallaxTilePool.isEmpty {
            for _ in 0..<220 {
                let tileNode = SKSpriteNode()
                tileNode.anchorPoint = CGPoint(x: 0, y: 0)
                tileNode.isHidden = true
                parallaxContainer.addChild(tileNode)
                parallaxTilePool.append(tileNode)
            }
        } else {
            for tileNode in parallaxTilePool where tileNode.parent == nil {
                parallaxContainer.addChild(tileNode)
            }
        }

        sharkNode.zPosition = 20
        worldContainer.addChild(sharkNode)
        refreshSharkTexture()
        initAmbientBubblesIfNeeded(viewW: Double(max(640, size.width)), viewH: Double(max(360, size.height)))
        syncPreyPopulationInitial()
    }

    public func onAtlasPreloadCompleted() {
        refreshSharkTexture()
        for prey in activePreys where prey.node.texture == nil {
            if let tex = SpriteAtlasManager.shared.preyTexture(for: prey.config.spriteKey) {
                prey.node.texture = tex
            }
        }
    }

    public func refreshSharkTexture() {
        guard let vm = viewModel else { return }
        let spKey = vm.activeSharkForm.spriteKey
        if let tex = SpriteAtlasManager.shared.sharkTexture(for: spKey) {
            sharkNode.texture = tex
            vm.lastRenderedSpriteKey = spKey
        }
    }

    public func resetFrameClock() {
        lastUpdateTime = 0
    }

    private func resetSimulationForNewRun(vm: GameViewModel) {
        vm.resetInputState()
        let st = vm.currentStats
        sharkX = 0.0
        sharkY = max(220.0, (22.0 * st.worldScale + 95.0).rounded())
        sharkVx = 0.0
        sharkVy = 0.0
        sharkAngle = 0.0
        sharkTargetAngle = 0.0
        facingDir = 1.0
        facingScaleX = 1.0
        turnRate = 0.0
        biteAnim = 0.0
        cameraShakeTrauma = 0.0
        invulnTimer = 1.8
        cameraX = sharkX
        cameraY = sharkY
        survivalAccumulator = 0.0
        trailBubbleAccumulator = 0.0
        smoothedDepthRefY = sharkY
        smoothedCameraZoom = st.cameraZoom
        breachedTerraceCells.removeAll()
        breachedTerraceOrder.removeAll()
        shallowDepletionTimer = 0.0
        vm.deepDivePromptMeters = nil

        let initDepthM = Int(GameRules.worldYToMeterDepth(sharkY).rounded())
        vm.depthMeters = initDepthM
        vm.runMaxDepth = initDepthM

        for prey in activePreys {
            prey.node.removeFromParent()
        }
        activePreys.removeAll()
        for pk in activePickups {
            pk.node.removeFromParent()
        }
        activePickups.removeAll()
        for pt in activeParticles {
            pt.node.removeFromParent()
        }
        activeParticles.removeAll()
        for ft in activeFloatTexts {
            ft.node.removeFromParent()
        }
        activeFloatTexts.removeAll()

        refreshSharkTexture()
        syncPreyPopulationInitial()
    }

    public override func update(_ currentTime: TimeInterval) {
        let dt = lastUpdateTime == 0 ? (1.0 / 60.0) : min(0.05, max(0.001, currentTime - lastUpdateTime))
        lastUpdateTime = currentTime
        guard let vm = viewModel else { return }

        // Pause background SpriteKit simulation & @Published mutations while the Evolution Atlas modal is open
        // so SwiftUI dedicates 100% of main-thread 120Hz budget to the rotary wheel gesture & inertia!
        if vm.showEvolutionAtlas {
            vm.resetInputState()
            return
        }

        let viewW = Double(max(320, size.width))
        let viewH = Double(max(240, size.height))
        let stats = vm.currentStats

        if vm.gameState != "playing" {
            vm.resetInputState()
        }

        // Reset shark, world pools, and inputs cleanly on EVERY new run (including GameOver Settlement -> Play Again!)
        let startedNewRunThisFrame = vm.runSequenceId != lastTrackedRunSequenceId
        if startedNewRunThisFrame {
            lastTrackedRunSequenceId = vm.runSequenceId
            if vm.gameState == "playing" {
                resetSimulationForNewRun(vm: vm)
            }
        }
        if vm.gameState != lastTrackedGameState {
            if !startedNewRunThisFrame && vm.gameState == "playing" && lastTrackedGameState == "title" {
                let safeSpawnY = max(220.0, (22.0 * stats.worldScale + 95.0).rounded())
                sharkY = max(safeSpawnY, min(max(260.0, safeSpawnY), sharkY))
                cameraY = sharkY
                vm.resetInputState()
            } else if !startedNewRunThisFrame && vm.gameState == "playing" && lastTrackedGameState == "gameover" {
                // In-place ad revive: preserve exact death (sharkX, sharkY, cameraX, cameraY)!
                sharkVx = 0.0
                sharkVy = 0.0
                sharkY = max(46.0, min(20000.0, sharkY))
                cameraX = sharkX
                cameraY = sharkY
                invulnTimer = max(invulnTimer, 2.5)
                vm.resetInputState()
                spawnFloatingText(
                    x: sharkX,
                    y: sharkY - 40.0,
                    text: vm.lang == "zh" ? "原地满血复活!" : "REVIVED IN PLACE!",
                    color: UIColor(red: 253/255, green: 224/255, blue: 71/255, alpha: 1.0),
                    fontSize: 16
                )
            }
            lastTrackedGameState = vm.gameState
        }

        if sharkNode.texture == nil || vm.lastRenderedSpriteKey != vm.activeSharkForm.spriteKey {
            refreshSharkTexture()
        }

        biteAnim = max(0.0, biteAnim - dt * 3.8)
        cameraShakeTrauma = max(0.0, cameraShakeTrauma - dt * 2.8)

        // Smooth ghost HP bar decay (only mutate @Published when value meaningfully changes to avoid 120Hz SwiftUI view invalidation!)
        let curHpPct = max(0, min(100, (vm.hp / max(1, vm.maxHp)) * 100.0))
        let nextGhostPct: Double
        if vm.ghostHpPct > curHpPct {
            nextGhostPct = max(curHpPct, vm.ghostHpPct - dt * 28.0)
        } else {
            nextGhostPct = curHpPct
        }
        if abs(vm.ghostHpPct - nextGhostPct) > 0.05 {
            vm.ghostHpPct = nextGhostPct
        }

        // Smooth true 2D camera zoom (0.8m -> 1.00, 45m -> 0.22) once per frame and share across physics & rendering
        let targetZoom = stats.cameraZoom
        if abs(targetZoom - smoothedCameraZoom) > 0.35 {
            smoothedCameraZoom = targetZoom
        } else {
            smoothedCameraZoom += (targetZoom - smoothedCameraZoom) * min(1.0, dt * 4.5)
        }
        let renderZoom = max(GameRules.minRenderZoomFloor, smoothedCameraZoom)
        let invZoom = 1.0 / max(GameRules.cameraZoomMin, renderZoom)

        // 1. Update Shark Physics (Title screen patrol vs In-game hunting)
        if vm.gameState == "title" {
            let patrolDir: Double = cos(currentTime * 0.95) >= 0 ? 1.0 : -1.0
            let titleCruiseY = max(210.0, (22.0 * stats.worldScale + 95.0).rounded())
            let inputY = sin(currentTime * 2.2) * 0.12 + max(-0.18, min(0.18, (titleCruiseY - sharkY) * 0.008))
            stepSharkKinematics(inputX: patrolDir, inputY: inputY, inputMagnitude: 1.0, isBoosting: false, stats: stats, renderZoom: renderZoom, dt: dt)
            shallowDepletionTimer = 0.0
            if vm.deepDivePromptMeters != nil {
                vm.deepDivePromptMeters = nil
            }
        } else if vm.gameState == "playing" {
            survivalAccumulator += dt
            if survivalAccumulator >= 1.0 {
                survivalAccumulator -= 1.0
                vm.runSurvivalSec += 1
            }

            let ix = Double(vm.joyDx)
            let iy = Double(vm.joyDy)
            let mag = hypot(ix, iy)
            let normX = mag > 0.08 ? ix / mag : 0.0
            let normY = mag > 0.08 ? iy / mag : 0.0
            let canBoost = vm.isBoostingHeld && vm.energy > 2.0
            stepSharkKinematics(inputX: normX, inputY: normY, inputMagnitude: mag, isBoosting: canBoost, stats: stats, renderZoom: renderZoom, dt: dt)

            if canBoost {
                vm.energy = max(0, vm.energy - stats.boostDrainPerSec * dt)
                if vm.save.soundEnabled {
                    OceanAudioEngine.shared.playBoostPulse()
                }
                if vm.onboardingStep == .HOLD_BOOST {
                    vm.onboardingBoostSeconds = min(1.2, vm.onboardingBoostSeconds + dt)
                    if vm.onboardingBoostSeconds >= 1.2 {
                        let firstCost = GameRules.getSharkUpgradeCoinCost(form: vm.activeSharkForm, currentLevel: vm.activeUpgradeLevel)
                        if vm.save.bankedCoins < firstCost {
                            vm.save.bankedCoins = firstCost
                        }
                        vm.onboardingStep = .HANDS_ON_UPGRADE
                        vm.playSuccessSound()
                    }
                }
            } else {
                vm.energy = min(vm.maxEnergy, vm.energy + GameConfigGenerated.baseBoostRegenPerSec * dt)
            }

            if vm.onboardingStep == .CELEBRATE {
                vm.onboardingCelebrationTimer -= dt
                if vm.onboardingCelebrationTimer <= 0 {
                    vm.onboardingStep = .DONE
                }
            }

            if vm.comboCount > 0 {
                vm.comboTimer -= dt
                if vm.comboTimer <= 0 {
                    vm.comboCount = 0
                }
            }

            if vm.frenzyActive {
                vm.frenzyTimer -= dt
                if vm.frenzyTimer <= 0 {
                    vm.frenzyActive = false
                    vm.recomputeCurrentSharkStats()
                }
            } else {
                vm.hp -= stats.hpDrainPerSec * dt
                if vm.hp <= 0 {
                    vm.hp = 0
                    vm.triggerGameOver()
                }
            }

            invulnTimer = max(0, invulnTimer - dt)
            // Convert world-pixel Y to true piecewise ocean meters (matches Web stepSimulation.ts & shark unlock reqMaxDepth)
            let curDepth = Int(GameRules.worldYToMeterDepth(max(0.0, sharkY)).rounded())
            if curDepth != vm.depthMeters {
                vm.depthMeters = curDepth
                if curDepth > vm.runMaxDepth {
                    vm.runMaxDepth = curDepth
                }
                if Double(curDepth) > vm.save.maxDepthReached {
                    vm.save.maxDepthReached = Double(curDepth)
                }
            }

            // Giant-shark shallow depletion guidance: when lingering > 1.5s in waters with no viable prey, prompt deep dive
            let minPreyLenCm = stats.minSpawnablePreyLengthM * 100.0
            let hasViableHere = GameRules.hasViablePreyAtDepth(worldY: sharkY, minPreyLengthCm: minPreyLenCm)
            if !hasViableHere && activePreys.count <= 2,
               let minViableWorldY = GameRules.getMinViableWorldYForShark(minPreyLengthCm: minPreyLenCm),
               minViableWorldY > sharkY + 80.0 {
                shallowDepletionTimer += dt
                if shallowDepletionTimer >= 1.5 {
                    let targetMeters = max(10, Int(GameRules.worldYToMeterDepth(minViableWorldY).rounded()))
                    if vm.deepDivePromptMeters != targetMeters {
                        vm.deepDivePromptMeters = targetMeters
                    }
                }
            } else {
                shallowDepletionTimer = 0.0
                if vm.deepDivePromptMeters != nil {
                    vm.deepDivePromptMeters = nil
                }
            }
        } else {
            shallowDepletionTimer = 0.0
            if vm.deepDivePromptMeters != nil {
                vm.deepDivePromptMeters = nil
            }
        }

        // Throttled ~18Hz HUD telemetry sync (decoupled from root ContentView) & async depth-band texture prewarm
        vm.syncTelemetryThrottled(timestamp: currentTime)
        SpriteAtlasManager.shared.prewarmDepthBandIfNeeded(worldY: sharkY)
        OceanAudioEngine.shared.updateAmbientDepth(
            worldY: sharkY,
            isPlaying: vm.gameState == "playing" && !vm.showEvolutionAtlas,
            isPaused: isPaused
        )

        // 2. Sea-Surface Locked Camera Tracking (scaled by invZoom so look-ahead stays natural at 0.22x giant zoom)
        let minSurfaceCameraY = 40.0
        let targetCamX = vm.gameState == "title"
            ? sharkX
            : (sharkX + cos(sharkAngle) * 58.0 * invZoom)
        let targetCamY = vm.gameState == "title"
            ? max(minSurfaceCameraY, sharkY)
            : max(minSurfaceCameraY, sharkY + sin(sharkAngle) * 28.0 * invZoom)
        let isBoostingCam = vm.gameState == "playing" && vm.isBoostingHeld && vm.energy > 2.0
        let effectiveLerp = isBoostingCam ? 12.0 : 6.5
        cameraX += (targetCamX - cameraX) * min(1.0, dt * effectiveLerp)
        cameraY += (targetCamY - cameraY) * min(1.0, dt * effectiveLerp)

        if cameraShakeTrauma > 0.01 {
            let shakeMag = min(28.0, cameraShakeTrauma * cameraShakeTrauma * 9.0 * invZoom)
            cameraX += Double.random(in: -shakeMag...shakeMag)
            cameraY += Double.random(in: -shakeMag...shakeMag)
        }

        // 3. Smooth Optical Growth Shrinking of Background Layers driven by True Camera Zoom
        let bgScales = GameRules.getParallaxLayerGrowthScalesFromZoom(cameraZoom: renderZoom)

        let rawDepthY = max(0.0, sharkY)
        if smoothedDepthRefY < 0.0 || abs(rawDepthY - smoothedDepthRefY) > 650.0 {
            smoothedDepthRefY = rawDepthY
        } else {
            smoothedDepthRefY += (rawDepthY - smoothedDepthRefY) * min(1.0, dt * 5.8)
        }
        let transition = GameRules.computeParallaxBiomeTransitionState(depthMeters: smoothedDepthRefY)

        renderParallaxBackground(viewW: viewW, viewH: viewH, bgScales: bgScales, transition: transition, zoom: renderZoom)
        stepAndRenderAmbientBubbles(viewW: viewW, viewH: viewH, bgScales: bgScales, transition: transition, dt: dt)
        stepAndRenderPreys(viewW: viewW, viewH: viewH, stats: stats, renderZoom: renderZoom, dt: dt, currentTime: currentTime)
        stepAndRenderDevourFX(viewW: viewW, viewH: viewH, stats: stats, renderZoom: renderZoom, dt: dt)
        renderPlayerShark(viewW: viewW, viewH: viewH, stats: stats, renderZoom: renderZoom)
    }

    private func stepSharkKinematics(
        inputX: Double,
        inputY: Double,
        inputMagnitude: Double,
        isBoosting: Bool,
        stats: ComputedSharkStats,
        renderZoom: Double,
        dt: Double
    ) {
        let hasDirectionInput = inputMagnitude > 0.08
        if hasDirectionInput {
            sharkTargetAngle = atan2(inputY, inputX)
            var diff = sharkTargetAngle - sharkAngle
            while diff > .pi { diff -= .pi * 2 }
            while diff < -.pi { diff += .pi * 2 }

            // Hydrodynamic Horizontal Whip-Turn: pivot horizontally without pitching 90 degrees vertically
            if abs(diff) > 1.85 && cos(sharkAngle) * cos(sharkTargetAngle) < -0.15 {
                facingDir = cos(sharkTargetAngle) >= 0 ? 1.0 : -1.0
                sharkAngle = atan2(sin(sharkAngle), -cos(sharkAngle))
                diff = sharkTargetAngle - sharkAngle
                while diff > .pi { diff -= .pi * 2 }
                while diff < -.pi { diff += .pi * 2 }
                turnRate = (diff >= 0 ? 1.0 : -1.0) * 0.92
            }

            let turnSpeed = isBoosting ? 15.0 : 11.2
            let angleStep = diff * min(1.0, dt * turnSpeed)
            sharkAngle += angleStep
            turnRate = turnRate * 0.84 + (angleStep / max(0.001, dt)) * 0.045

            if abs(cos(sharkAngle)) > 0.18 {
                facingDir = cos(sharkAngle) >= 0 ? 1.0 : -1.0
            }
        } else {
            turnRate *= max(0.0, 1.0 - dt * 10.0)
        }

        facingScaleX += (facingDir - facingScaleX) * min(1.0, dt * 11.0)

        let invZoom = 1.0 / max(GameRules.cameraZoomMin, renderZoom)
        let cadenceFactor = max(0.42, min(1.0, pow(0.8 / max(0.6, stats.realBodyLengthM), 0.22)))

        // When joystick is not moved and not boosting, keep shark stationary in place (zero drift in previous direction!)
        if !hasDirectionInput && !isBoosting {
            sharkVx = 0.0
            sharkVy = 0.0
            swimPhase += dt * 3.2 * cadenceFactor
            return
        }

        let heatMult = viewModel?.huntingHeatBuff.speedMultiplier ?? 1.0
        let joySpeedFactor = isBoosting ? 1.0 : min(1.0, max(0.55, inputMagnitude))
        let targetScreenSpeed = (isBoosting ? stats.boostSpeed : stats.moveSpeed * joySpeedFactor) * heatMult
        let worldSpeed = targetScreenSpeed * invZoom
        sharkVx = cos(sharkAngle) * worldSpeed
        sharkVy = sin(sharkAngle) * worldSpeed

        let prevX = sharkX
        let prevY = sharkY
        let nextX = sharkX + sharkVx * dt
        let nextY = max(46.0, min(20000.0, sharkY + sharkVy * dt))

        // Enforce 2-way physical seabed & 9-tier terrace collision in unified world space (giant sharks shatter upper Tiers 0..4!)
        let sharkHitRadius = 24.0 * stats.worldScale
        let clearancePadding = 6.0 * max(1.0, sqrt(stats.worldScale))
        let seabedOptions = GameRules.SeabedCollisionOptions(
            sharkLengthM: stats.realBodyLengthM,
            breachedCells: breachedTerraceCells
        )
        let stepCol = GameRules.resolveSeabedKineticStep(
            prevX: prevX,
            prevY: prevY,
            nextX: nextX,
            nextY: nextY,
            vx: sharkVx,
            vy: sharkVy,
            entityRadius: sharkHitRadius,
            clearancePadding: clearancePadding,
            options: seabedOptions
        )
        sharkX = stepCol.x
        sharkY = max(46.0, min(20000.0, stepCol.y))
        sharkVx = stepCol.vx
        sharkVy = stepCol.vy
        swimPhase += dt * (isBoosting ? 12.5 : 7.8) * cadenceFactor

        // Giant-shark upper-terrace shattering: carve local breach cells and trigger rock-debris VFX + haptic thud
        if let shatterHit = GameRules.detectShatterableTerraceHit(
            prevX: prevX,
            prevY: prevY,
            nextX: sharkX,
            nextY: sharkY,
            entityRadius: sharkHitRadius,
            sharkLengthM: stats.realBodyLengthM,
            breachedCells: breachedTerraceCells
        ) {
            let cellSpan = max(1, Int(ceil(sharkHitRadius / GameRules.terraceBreachCellWidth)))
            for c in (shatterHit.cellIndex - cellSpan)...(shatterHit.cellIndex + cellSpan) {
                let key = GameRules.formatTerraceBreachKey(tierIndex: shatterHit.tierIndex, cellIndex: c)
                if !breachedTerraceCells.contains(key) {
                    if breachedTerraceCells.count >= 512, let oldest = breachedTerraceOrder.first {
                        breachedTerraceOrder.removeFirst()
                        breachedTerraceCells.remove(oldest)
                    }
                    breachedTerraceCells.insert(key)
                    breachedTerraceOrder.append(key)
                }
            }
            if shatterHit.isNewlyBreached {
                sharkVx *= 0.92
                sharkVy *= 0.92
                cameraShakeTrauma = min(1.0, max(cameraShakeTrauma, 0.34) + 0.24)
                spawnTerraceShatterParticles(
                    x: sharkX,
                    y: sharkY,
                    stripId: shatterHit.stripId,
                    worldScale: stats.worldScale
                )
                HapticFeedbackManager.shared.playHeavy(minInterval: 0.12)
                if viewModel?.save.soundEnabled == true {
                    OceanAudioEngine.shared.playRockShatter()
                }
            }
        }

        // Emit swimming bubbles from shark tail (faster during Boost, shimmering Gold during Gold Frenzy!)
        let isFrenzy = viewModel?.frenzyActive ?? false
        let emitInterval = (isBoosting || isFrenzy) ? 0.045 : 0.16
        trailBubbleAccumulator += dt
        if trailBubbleAccumulator >= emitInterval {
            trailBubbleAccumulator = 0.0
            spawnSharkWakeBubble(stats: stats, isBoosting: isBoosting, isFrenzy: isFrenzy)
        }
    }

    private func renderPlayerShark(viewW: Double, viewH: Double, stats: ComputedSharkStats, renderZoom: Double) {
        let zoom = renderZoom
        let biteSnap = sin(biteAnim * .pi)
        let lungeWorld = biteSnap * 14.0 * stats.worldScale
        let screenX = viewW * 0.5 + (sharkX + cos(sharkAngle) * lungeWorld - cameraX) * zoom
        let screenY = viewH * 0.5 - (sharkY + sin(sharkAngle) * lungeWorld - cameraY) * zoom

        // 1:1 Constant-Area Aspect Normalization in true camera zoom space:
        // worldScale * renderZoom == stats.scale at steady state, preserving comfortable screen framing across 0.8m -> 45m!
        let baseSize = GameRules.sharkBaseDrawSize * stats.worldScale * zoom
        let texAspect: Double
        if let tex = sharkNode.texture, tex.size().height > 0 {
            texAspect = Double(tex.size().width / tex.size().height)
        } else {
            texAspect = 1.65
        }
        let clampedAspect = max(0.42, min(2.65, texAspect))
        let sqrtAspect = sqrt(clampedAspect)
        let drawW = baseSize * sqrtAspect
        let drawH = baseSize / sqrtAspect

        sharkNode.size = CGSize(width: drawW, height: drawH)
        sharkNode.position = CGPoint(x: screenX, y: screenY)

        let absFacing = max(0.15, abs(facingScaleX))
        let perspectiveScaleX = (0.42 + 0.58 * pow(absFacing, 0.8)) * (1.0 + biteSnap * 0.14) * (facingScaleX >= 0 ? 1.0 : -1.0)
        let horizonPitch = atan2(-sin(sharkAngle), abs(cos(sharkAngle)))
        sharkNode.xScale = CGFloat(perspectiveScaleX)
        sharkNode.yScale = CGFloat(1.0 + biteSnap * 0.11)
        sharkNode.zRotation = CGFloat(horizonPitch * (facingScaleX >= 0 ? 1.0 : -1.0))
        sharkNode.alpha = invulnTimer > 0 && Int(invulnTimer * 20) % 2 == 0 ? 0.45 : 1.0

        // Gold Frenzy 24K Shimmering Gold Tint & Damage Hit-Flash (1:1 parity with Web drawSharkWithOrgans)
        let isFrenzy = viewModel?.frenzyActive ?? false
        if invulnTimer > 0.65 {
            sharkNode.color = .white
            sharkNode.colorBlendFactor = 0.72
        } else if isFrenzy {
            sharkNode.color = UIColor(red: 1.0, green: 0.84, blue: 0.08, alpha: 1.0)
            sharkNode.colorBlendFactor = CGFloat(0.68 + 0.14 * sin(swimPhase * 2.2))
        } else {
            sharkNode.colorBlendFactor = 0.0
        }

        applySpineWaveWarp(to: sharkNode, phase: swimPhase, turnBend: turnRate)
    }

    private func applySpineWaveWarp(to node: SKSpriteNode, phase: Double, turnBend: Double) {
        let cols = 10
        let count = (cols + 1) * 2
        sharkWarpSrc.removeAll(keepingCapacity: true)
        sharkWarpDst.removeAll(keepingCapacity: true)
        if sharkWarpSrc.capacity < count { sharkWarpSrc.reserveCapacity(count) }
        if sharkWarpDst.capacity < count { sharkWarpDst.reserveCapacity(count) }

        for row in 0...1 {
            let v = Float(row)
            for col in 0...cols {
                let u = Float(col) / Float(cols)
                sharkWarpSrc.append(SIMD2<Float>(u, v))
                let tailProgress = Double(1.0 - u)
                let env = 0.015 * tailProgress + 0.985 * pow(tailProgress, 2.25)
                let waveDy = sin(phase - tailProgress * 2.15 * .pi) * 0.09 * env
                let cBendDy = -max(-0.8, min(0.8, turnBend)) * 0.14 * pow(tailProgress, 1.72)
                sharkWarpDst.append(SIMD2<Float>(u, v + Float(waveDy + cBendDy)))
            }
        }
        node.warpGeometry = SKWarpGeometryGrid(columns: cols, rows: 1, sourcePositions: sharkWarpSrc, destinationPositions: sharkWarpDst)
    }
}
