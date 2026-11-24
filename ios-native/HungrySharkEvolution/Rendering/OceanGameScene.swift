import SpriteKit
import SwiftUI
import UIKit
import AudioToolbox
import simd

/// Native SpriteKit (Metal-Accelerated) Ocean Simulation, 5-Layer Parallax & Devour FX Scene
/// (AdMob monetization lives in Monetization/GoogleAdMobManager.swift; ViewModel state lives in State/GameViewModel.swift)
@MainActor
public final class OceanGameScene: SKScene {
    public weak var viewModel: GameViewModel?

    private var sharkX: Double = 0
    private var sharkY: Double = 220
    private var sharkVx: Double = 160
    private var sharkVy: Double = 0
    private var sharkAngle: Double = 0
    private var sharkTargetAngle: Double = 0
    private var swimPhase: Double = 0
    private var facingDir: Double = 1
    private var facingScaleX: Double = 1
    private var turnRate: Double = 0
    private var biteAnim: Double = 0
    private var cameraShakeTrauma: Double = 0
    private var invulnTimer: Double = 0
    private var cameraX: Double = 0
    private var cameraY: Double = 220
    private var smoothedCameraZoom: Double = 1.0
    private var smoothedDepthRefY: Double = -1.0
    private var breachedTerraceCells: Set<String> = []
    private var breachedTerraceOrder: [String] = []
    private var shallowDepletionTimer: Double = 0.0
    private var lastUpdateTime: TimeInterval = 0
    private var survivalAccumulator: Double = 0
    private var lastTrackedGameState: String = ""
    private var lastTrackedRunSequenceId: Int = -1

    // Pre-allocated warp grid scratch buffers (iOS-P1-1: eliminates dozens of per-frame heap allocations)
    private var sharkWarpSrc: [SIMD2<Float>] = []
    private var sharkWarpDst: [SIMD2<Float>] = []
    private var preyWarpSrc: [SIMD2<Float>] = []
    private var preyWarpDst: [SIMD2<Float>] = []
    private var seabedWarpSrc: [SIMD2<Float>] = []
    private var seabedWarpDst: [SIMD2<Float>] = []

    private let waterBgNode = SKSpriteNode()
    private let parallaxContainer = SKNode()
    private let worldContainer = SKNode()
    private let fxContainer = SKNode()
    private let sharkNode = SKSpriteNode()

    private enum PreySwimGait {
        case SHARK_APEX
        case CARANGIFORM
        case ANGUILLIFORM
        case MEDUSOID_JET
        case PUFFER_BUOYANT
        case RIGID_PROPULSION
    }

    private final class ActivePrey {
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

    private final class ActiveParticle {
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

    private final class ActivePickup {
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

    private final class ActiveFloatText {
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

    private final class AmbientOceanBubble {
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

    private let bubbleContainer = SKNode()
    private var seabedArchFillPool: [SKShapeNode] = []
    private var activeSeabedArchFillCount: Int = 0
    private var parallaxTilePool: [SKSpriteNode] = []
    private var activeParallaxTileCount: Int = 0
    private var ambientBubbles: [AmbientOceanBubble] = []
    private var trailBubbleAccumulator: Double = 0.0
    private var activePreys: [ActivePrey] = []
    private var activeParticles: [ActiveParticle] = []
    private var activePickups: [ActivePickup] = []
    private var activeFloatTexts: [ActiveFloatText] = []
    private var preySpawnTimer: Double = 0.0
    private let maxActivePreys = 22

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
                    AudioServicesPlaySystemSound(1105)
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

    private func spawnTerraceShatterParticles(x: Double, y: Double, stripId: String, worldScale: Double) {
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

    private func spawnSharkWakeBubble(stats: ComputedSharkStats, isBoosting: Bool, isFrenzy: Bool) {
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

    private static let prey140SharkLikeIds: Set<String> = [
        "PREY-089", "PREY-090", "PREY-091", "PREY-092", "PREY-093",
        "PREY-094", "PREY-095", "PREY-096", "PREY-097", "PREY-098",
        "PREY-111", "PREY-112", "PREY-113"
    ]
    private static let prey140ElongatedIds: Set<String> = [
        "PREY-079", "PREY-081", "PREY-083", "PREY-127", "PREY-128", "PREY-129"
    ]
    private static let prey140PufferIds: Set<String> = [
        "PREY-050", "PREY-051", "PREY-052", "PREY-053", "PREY-054",
        "PREY-069", "PREY-070", "PREY-071", "PREY-072", "PREY-073",
        "PREY-099", "PREY-103"
    ]
    private static let prey140RigidIds: Set<String> = [
        "PREY-114", "PREY-115", "PREY-116"
    ]

    private func classifyPreySwimGait(_ p: PreyTierConfig) -> PreySwimGait {
        if Self.prey140SharkLikeIds.contains(p.id) { return .SHARK_APEX }
        if p.isHazard || Self.prey140RigidIds.contains(p.id) { return .RIGID_PROPULSION }
        if p.behavior == .EEL_CHARGER || Self.prey140ElongatedIds.contains(p.id) {
            return .ANGUILLIFORM
        }
        if p.behavior == .PUFFER_INFLATE || Self.prey140PufferIds.contains(p.id) {
            return .PUFFER_BUOYANT
        }
        return .CARANGIFORM
    }

    private func applyPreySpineWaveWarp(to node: SKSpriteNode, prey: ActivePrey, screenMaxDim: Double, currentTime: TimeInterval) {
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

        // Shark-like sleek anterior-locked envelope: head & chest (u -> 1.0) stay steady, posterior tail (u -> 0.0) sweeps smoothly
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

    // MARK: - 42 Depth-Reactive Ambient Ocean Bubbles / Marine Snow / Bioluminescent Spores / Magma Embers
    private func initAmbientBubblesIfNeeded(viewW: Double, viewH: Double) {
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

    private func stepAndRenderAmbientBubbles(
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
            // In SpriteKit Y=0 is bottom and Y=viewH is top, so rising bubbles increase Y (+1.0)
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

            // Smoothly blend bubble RGB & stroke across Shallow -> Twilight -> Abyss (zero 1-frame snap at 520m / 1150m!)
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

    // MARK: - Continuous Cross-Depth Multi-Biome Parallax Background & 1.0x Physical Seabed (1:1 Parity with Web parallaxBackground.ts & worldGenerationSystem.ts)
    private func renderParallaxBackground(
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

        // 1. Layer 0 Water Backdrops blended with C2 quintic weights & soft vertical envelope
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

        // 2. Render 1.0x World-Space Physical Seabed, Subsurface Bedrock Strata, 9-Tier Seabed Terraces & Composite Coral Outcrops
        renderPhysicalSeabedAndEcology(
            viewW: viewW,
            viewH: viewH,
            zoom: max(GameRules.minRenderZoomFloor, zoom)
        )

        // Hide any unused pooled tile nodes without removing them from the scene graph
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

    private func acquirePooledArchFillNode() -> SKShapeNode {
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

    private func renderPhysicalSeabedAndEcology(
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
            // Uses terrain-locked depth blending (resolveSeabedStripPairForDepth) & world-locked UVs (zero cameraY pop!)
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

            // Helper closure for checking active opening at an analytical world seamIdx
            func hasOpeningAtSeam(_ seamIdx: Int) -> Bool {
                if tier.skipZeroSeam && seamIdx == 0 { return false }
                let seamWX = Double(seamIdx) * tier.cellWidth + tier.seamPhaseOffsetX
                let seamFloorY = GameRules.getFloorDepthAt(worldX: seamWX)
                return seamFloorY > tier.minMainFloorForOpening
            }

            // 2A. Analytical Cave Backwall Bowl Rendering (100% viewport-invariant seamIdx -> zero boulder swaps or texture flips!)
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

                // Clamp backwall bottom outside [openLeftWX, openRightWX] smoothly over 42m (> warp column spacing)
                // so ZERO diagonal blue gaps can peek out and ZERO column aliasing flickers can occur!
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

                // (i) Two feathered deep-recessed backwall rock strata across the entire cave bowl with world-locked UVs
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

                // (ii) Continuous Recessed Cave Backwall Top Surface Strip (world-locked UVs, zero camera/cIdx flip!)
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

                // (iii) Soft Elliptical Abyssal Cave Portal Shadow strictly inside the recessed cave mouth (behind foreground archFill z=3.42)
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

                // (iv) Deterministic Rounded Cave-Lip Boulder Clusters straddling the cliff edges (100% world-locked to seamIdx)
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

            // 2B. Solid Terrace Foreground Intervals (100% world-grid anchored, zero cameraX sliding scans or 22m lip dead-zones!)
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
                // Inside graft zone (mainY < graftFuseMainY), smoothly pinch bottom into mainFloorY so no hanging cliff slab protrudes below mainFloorY!
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

                // Fixed world-grid chunk iteration (camera-invariant vertices cw0..cw1)
                let chunkStep = 240.0
                let firstChunkIdx = Int(floor(max(segStartWX, startWorldX - 260.0) / chunkStep))
                let lastChunkIdx = Int(ceil(min(segEndWX, endWorldX + 260.0) / chunkStep))
                if lastChunkIdx < firstChunkIdx { continue }

                // (i) Solid Interior Fill Polygon over fixed 40m world sub-grid runs (prevents camera-anchored scan jumps & z=3.42 occludes portalShadow z=3.39)
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

                // (ii) Render foreground subsurface & top strips in fixed world-grid spans (split to 60m sub-spans only inside graft slopes)
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

                        // 2C. Solid Terrace Subsurface Strata
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

                        // 2D. Solid Terrace Foreground Top Surface Strip (world-locked UVs, zero camera flicker!)
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
            // outcrop.variant is 0..4 (v = 1..5, where 1..4 are the 16 distinct stylized atlas sprites and 5 is the cleaned standalone cluster)
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

                // Depth-matched underwater color grading so outcrops blend naturally with the seabed
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
                    // Preserve true sprite aspect ratio so no sprite is ever stretched or squashed!
                    let texAspect = max(0.45, min(2.2, Double(texSize.width / texSize.height)))
                    let drawH = drawBaseH * layer.scaleH
                    let drawW = drawH * texAspect
                    // Deep 26% base embedding + slope sink so outcrops sit firmly inside the seabed rock
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

    private func acquirePooledParallaxTile() -> SKSpriteNode {
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

    private func addTiledStrip(
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
            // Exact physical pixel boundary abutment (x0 -> x1) with ZERO double-alpha overlap!
            node.size = CGSize(width: max(1.0, x1 - x0), height: alignedH)
            node.position = CGPoint(x: x0, y: alignedY)
            node.alpha = CGFloat(alpha)
            node.zPosition = zPos
            node.color = fogColor
            node.colorBlendFactor = CGFloat(max(0.0, min(0.85, fogBlendFactor)))
            startX += tileW
        }
    }

    private func syncPreyPopulationInitial() {
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

    private func syncPreyPopulation(dt: Double) {
        guard activePreys.count < maxActivePreys else { return }
        preySpawnTimer -= dt
        if preySpawnTimer <= 0 {
            spawnOnePrey()
            // 平滑随机刷新计时器：消除一波一波出怪的卡顿波次感，0.35s ~ 0.88s 随机单条涌入
            preySpawnTimer = Double.random(in: 0.35...0.88)
        }
    }

    @discardableResult
    private func spawnOnePrey() -> Bool {
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

        // Giant shark scale filter: do not spawn tiny fish if shark is too large (preserves shallow depletion loop)
        let minPreyLenCm = minSpawnLenM * 100.0
        let candidates = minPreyLenCm > 0
            ? rawCandidates.filter { ($0.bodyLengthCm > 0 ? $0.bodyLengthCm : $0.radius * 2.5) >= minPreyLenCm }
            : rawCandidates

        if candidates.isEmpty {
            return false
        }

        // Continuous Depth Target Tier (0m ~ 20,000m) + Lorentzian Distribution (1:1 with Web ecosystemSpawner.ts)
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
        // 屏幕边缘游入刷新：按真实相机视野半宽 halfViewW 在屏幕外侧边缘生成，严禁在视野内瞬移！
        let spawnOnLeft = Bool.random()
        let edgeOffset = Double.random(in: 80.0...175.0) * invZoom
        let px = spawnOnLeft ? (cameraX - halfViewW - edgeOffset) : (cameraX + halfViewW + edgeOffset)
        // 随机游动方向：消除全向鲨鱼游动的刻板感，猎物按自然海洋生物随机朝左或朝右游动
        let dir: Double = Bool.random() ? 1.0 : -1.0

        let localFloorLimit = max(140.0, GameRules.getFloorDepthAt(worldX: px) - chosen.radius - 34.0)
        let rawPy = max(chosen.minDepth, min(chosen.maxDepth, sharkY + Double.random(in: -halfViewH...halfViewH) * 0.82))
        let clampedPy = min(rawPy, localFloorLimit)
        // Ensure prey never spawns inside any intact seabed terrace or below the main floor
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

    // MARK: - Devour Particles, Spinning Coin/Gene Pickups & Floating Combat Text
    private func spawnDevourParticles(x: Double, y: Double, preyTier: Int, isGolden: Bool) {
        // 1. Expanding Devour Shockwave Ring
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

        // 2. Bursting Green/Teal Devour Slime Bubbles & Golden Sparks
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

    private func spawnDevourPickups(x: Double, y: Double, coinGain: Int, geneGain: Int) {
        let coinTex = SpriteAtlasManager.shared.uiIconTexture(for: "UI_ICON_COIN")
        let coinCount = min(4, max(1, (coinGain + 3) / 4))
        let baseCoinVal = max(1, coinGain / coinCount)
        for i in 0..<coinCount {
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

        if geneGain > 0 {
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

    private func spawnFloatingText(x: Double, y: Double, text: String, color: UIColor, fontSize: CGFloat = 14) {
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

    private func stepAndRenderDevourFX(viewW: Double, viewH: Double, stats: ComputedSharkStats, renderZoom: Double, dt: Double) {
        guard let vm = viewModel else { return }
        let zoom = renderZoom
        let invZoom = 1.0 / max(GameRules.cameraZoomMin, zoom)

        // 1. Update & Render Devour Burst Particles
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

        // 2. Update & Render 3D Spinning Coin & Gene Pickups with Magnetic Pull
        let magnetR = ((vm.frenzyActive ? 390.0 : 120.0) + stats.magnetRadius) * invZoom
        let collectRadius = 38.0 * stats.worldScale
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
                if dist < collectRadius {
                    if pk.isGene {
                        vm.save.bankedGenes += pk.value
                        vm.runGenesEarned += pk.value
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 12.0 * invZoom,
                            text: "+\(pk.value) 🧬",
                            color: UIColor(red: 110/255, green: 231/255, blue: 183/255, alpha: 1.0),
                            fontSize: 13
                        )
                    } else {
                        vm.save.bankedCoins += pk.value
                        vm.runCoinsEarned += pk.value
                        spawnFloatingText(
                            x: pk.x,
                            y: pk.y - 10.0 * invZoom,
                            text: "+\(pk.value) 🪙",
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
            // 3D coin flip / crystal spin effect (stays legible even at 0.22x giant zoom)
            let pkScale = CGFloat(max(0.72, min(1.15, 0.82 + 0.18 * zoom)))
            pk.node.xScale = CGFloat(0.35 + 0.65 * abs(cos(pk.spinPhase))) * pkScale
            pk.node.yScale = pkScale
            kIdx -= 1
        }

        // 3. Update & Render Floating Combat Text Popups
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

    private func stepAndRenderPreys(viewW: Double, viewH: Double, stats: ComputedSharkStats, renderZoom: Double, dt: Double, currentTime: TimeInterval) {
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

            // 统一世界坐标系：物理碰撞与真相机变焦投影 100% 同源，彻底废除 seabedScale/effPrey 微缩补丁
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

            // Biomechanical Smooth Horizontal Cruising Trajectory AI (1:1 parity with Web)
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

            // Jaw Suction Pull: pull devourable prey straight into the shark's open jaws in unified world space
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

                    // Spawn devour particles, spinning coin/gene pickups & floating combat text
                    spawnDevourParticles(x: p.x, y: p.y, preyTier: p.config.tier, isGolden: p.mutation == .GOLDEN_SWARM)
                    spawnDevourPickups(x: p.x, y: p.y, coinGain: coinGain, geneGain: geneGain)

                    vm.comboCount += 1
                    vm.comboTimer = 4.2
                    if vm.comboCount > vm.runPeakCombo {
                        vm.runPeakCombo = vm.comboCount
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

                    // Target Bounty check
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

                    // Golden mutant charge check
                    if p.mutation == .GOLDEN_SWARM {
                        vm.goldenMutantCharge += 1
                        if vm.goldenMutantCharge >= vm.goldenMutantNeed {
                            vm.goldenMutantCharge = 0
                            vm.frenzyActive = true
                            vm.frenzyTimer = GameConfigGenerated.frenzyDuration + stats.frenzyDurationBonus
                            vm.recomputeCurrentSharkStats()
                            spawnFloatingText(
                                x: sharkX,
                                y: sharkY - 40.0 * max(1.0, stats.worldScale * 0.5),
                                text: vm.lang == "zh" ? "🔥 黄金狂暴觉醒!" : "🔥 GOLDEN FRENZY!",
                                color: UIColor.yellow,
                                fontSize: 16
                            )
                        }
                    }

                    // Onboarding Step 1 check
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

            // Smooth horizontal flip (prey sprites face RIGHT in sheet: +1 when vx >= 0, -1 when vx < 0) + calm shark-like horizontal pitch
            let facingSign: Double = p.vx >= 0 ? 1.0 : -1.0
            let pitchAngle = max(-0.22, min(0.22, atan2(-p.vy, max(24.0, abs(p.vx))) * 0.42))
            p.node.xScale = CGFloat(facingSign)
            p.node.yScale = 1.0
            p.node.zRotation = CGFloat(pitchAngle * facingSign)

            // Gold Frenzy & Golden Mutant 24K Gold Shimmer Tint (1:1 parity with Web drawPreyEntity)
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
