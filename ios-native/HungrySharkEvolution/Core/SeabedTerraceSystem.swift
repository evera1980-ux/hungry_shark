import Foundation

// MARK: - 9-Tier Seabed Terrace System, Outcrop Placements & Kinetic Wall Resolution

extension GameRules {
    public struct SeabedTerraceTierSpec: Sendable {
        public let tierIndex: Int
        public let stripId: String
        public let baseRidgeY: Double
        public let minRidgeY: Double
        public let maxRidgeY: Double
        public let maxVisualRimY: Double
        public let archTargetBaseY: Double
        public let archMaxDepthY: Double
        public let cellWidth: Double
        public let seamPhaseOffsetX: Double
        public let skipZeroSeam: Bool
        public let openingHalfWidth: Double
        public let bowlHalfWidth: Double
        public let bowlDropDepth: Double
        public let minMainFloorForOpening: Double
        public let graftStartMainY: Double
        public let graftEndMainY: Double
        public let graftFuseMainY: Double
        public let seedSalt: Int
        /// Minimum real shark body length (m) required to shatter through this terrace tier (.infinity = indestructible deep crust)
        public let shatterLengthM: Double

        public var baseDepth: Double { baseRidgeY }
        public var thicknessBase: Double { archTargetBaseY - baseRidgeY }
    }

    /// 9-Tier Non-Uniformly Spaced Multi-Depth Seabed Terraces (414m -> 16,900m, 100% 1:1 parity with Web SEABED_TERRACE_TIERS)
    public static var seabedTerraceTiers: [SeabedTerraceTierSpec] {
        SeabedTerrainConstants.seabedTerraceTiers
    }

    /// Horizontal cell width (world units) for breached upper-terrace cells shattered by giant sharks (1:1 parity with Web TERRACE_BREACH_CELL_WIDTH)
    public static var terraceBreachCellWidth: Double { 120.0 }

    public static func getTerraceBreachCellIndex(worldX: Double) -> Int {
        return Int(floor(worldX / terraceBreachCellWidth))
    }

    public static func formatTerraceBreachKey(tierIndex: Int, cellIndex: Int) -> String {
        return "\(tierIndex):\(cellIndex)"
    }

    public static func isTerraceCellBreached(
        tierIndex: Int,
        worldX: Double,
        breachedCells: Set<String>?
    ) -> Bool {
        guard let cells = breachedCells, !cells.isEmpty else { return false }
        return cells.contains(formatTerraceBreachKey(tierIndex: tierIndex, cellIndex: getTerraceBreachCellIndex(worldX: worldX)))
    }

    public static func canSharkShatterTerrace(tierIndex: Int, sharkLengthM: Double?) -> Bool {
        guard let len = sharkLengthM, len.isFinite, tierIndex >= 0, tierIndex < seabedTerraceTiers.count else {
            return false
        }
        return len >= seabedTerraceTiers[tierIndex].shatterLengthM
    }

    public struct SeabedCollisionOptions: Sendable {
        public let sharkLengthM: Double?
        public let breachedCells: Set<String>?

        public init(sharkLengthM: Double? = nil, breachedCells: Set<String>? = nil) {
            self.sharkLengthM = sharkLengthM
            self.breachedCells = breachedCells
        }
    }

    public struct TerraceShatterHit: Sendable {
        public let tierIndex: Int
        public let stripId: String
        public let worldX: Double
        public let worldY: Double
        public let cellIndex: Int
        public let isNewlyBreached: Bool
    }

    /// Detects whether a giant shark passed through any shatterable upper-terrace rock span during this frame
    public static func detectShatterableTerraceHit(
        prevX: Double,
        prevY: Double,
        nextX: Double,
        nextY: Double,
        entityRadius: Double,
        sharkLengthM: Double,
        breachedCells: Set<String>?
    ) -> TerraceShatterHit? {
        guard sharkLengthM.isFinite && sharkLengthM >= seabedTerraceTiers[0].shatterLengthM else {
            return nil
        }
        let safeRadius = max(0.0, entityRadius)
        let minY = min(prevY, nextY) - safeRadius * 0.72
        let maxY = max(prevY, nextY) + safeRadius * 0.72
        let midX = (prevX + nextX) * 0.5

        for tIdx in 0..<seabedTerraceTiers.count {
            let tierSpec = seabedTerraceTiers[tIdx]
            if !canSharkShatterTerrace(tierIndex: tIdx, sharkLengthM: sharkLengthM) { continue }
            if maxY < tierSpec.minRidgeY - 40.0 || minY > tierSpec.archMaxDepthY + 40.0 { continue }

            let terrace = getSeabedTerraceAt(worldX: nextX, tierIndex: tIdx)
            let activeSample = terrace.isPresent
                ? terrace
                : getSeabedTerraceAt(worldX: midX, tierIndex: tIdx)
            guard activeSample.isPresent else { continue }

            let hitWorldX = terrace.isPresent ? nextX : midX
            if maxY >= activeSample.topY && minY <= activeSample.bottomArchY {
                let cellIndex = getTerraceBreachCellIndex(worldX: hitWorldX)
                let isNewlyBreached = !isTerraceCellBreached(tierIndex: tIdx, worldX: hitWorldX, breachedCells: breachedCells)
                return TerraceShatterHit(
                    tierIndex: tIdx,
                    stripId: tierSpec.stripId,
                    worldX: hitWorldX,
                    worldY: (activeSample.topY + activeSample.bottomArchY) * 0.5,
                    cellIndex: cellIndex,
                    isNewlyBreached: isNewlyBreached
                )
            }
        }
        return nil
    }

    public struct SeabedTerraceSample: Sendable {
        public let isPresent: Bool
        public let isDiveOpening: Bool
        public let topY: Double
        public let bottomArchY: Double
        public let edgeFactor: Double
        public let caveFactor: Double
        public let slope: Double
        public let bottomSlope: Double
        public let tierIndex: Int
        public let stripId: String
    }

    /// Exact 1:1 port of Web evalTerraceSeabedContinuousRaw(worldX, tier, WorldConfig)
    private static func evalTerraceSeabedContinuousRaw(
        worldX: Double,
        tier: SeabedTerraceTierSpec
    ) -> (
        topY: Double,
        slope: Double,
        edgeWeight: Double,
        openingDepthFactor: Double,
        isDiveOpening: Bool,
        bottomArchY: Double,
        bottomSlope: Double
    ) {
        let seedPhase = (Double((123456789 + tier.seedSalt * 131) & 0xffff) / 65536.0) * .pi * 2.0
        let cellWave = evalSmoothTerrainWave(worldX, wavelength: tier.cellWidth, waveSalt: tier.seedSalt)
        let k1 = (.pi * 2.0) / (1180.0 + Double(tier.tierIndex) * 110.0)
        let k2 = (.pi * 2.0) / (560.0 + Double(tier.tierIndex) * 45.0)
        let k3 = (.pi * 2.0) / (290.0 + Double(tier.tierIndex) * 22.0)
        let k4 = (.pi * 2.0) / 155.0

        let ampScale = 1.0 + Double(tier.tierIndex) * 0.08
        let w1 = sin(worldX * k1 + seedPhase) * (32.0 * ampScale)
        let w2 = cos(worldX * k2 - seedPhase * 0.7 + 1.1) * (20.0 * ampScale)
        let w3 = sin(worldX * k3 + seedPhase * 1.3 + 2.4) * (11.0 * ampScale)
        let w4 = cos(worldX * k4 - seedPhase * 0.4 + 0.6) * 5.0
        let rawRidgeY = max(
            tier.minRidgeY,
            min(tier.maxRidgeY, tier.baseRidgeY + cellWave * (22.0 * ampScale) + w1 + w2 + w3 + w4)
        )

        let dRidgeDx =
            cos(worldX * k1 + seedPhase) * (32.0 * ampScale * k1) -
            sin(worldX * k2 - seedPhase * 0.7 + 1.1) * (20.0 * ampScale * k2) +
            cos(worldX * k3 + seedPhase * 1.3 + 2.4) * (11.0 * ampScale * k3) -
            sin(worldX * k4 - seedPhase * 0.4 + 0.6) * (5.0 * k4)

        let shiftedX = worldX - tier.seamPhaseOffsetX
        let rawSeamIdx = Int((shiftedX / tier.cellWidth).rounded())
        let nearestOpenSeamIdx: Int
        if tier.skipZeroSeam {
            nearestOpenSeamIdx = shiftedX >= 0.0 ? max(1, rawSeamIdx) : min(-1, rawSeamIdx)
        } else {
            nearestOpenSeamIdx = rawSeamIdx
        }
        let nearestOpenSeamX = Double(nearestOpenSeamIdx) * tier.cellWidth + tier.seamPhaseOffsetX
        let distFromSeam = worldX - nearestOpenSeamX
        let absDist = abs(distFromSeam)

        let seamMainFloorY = getFloorDepthAt(worldX: nearestOpenSeamX)
        let hasOpeningAtSeam = seamMainFloorY > tier.minMainFloorForOpening

        var openingDepthFactor = 0.0
        var dOpeningFactorDx = 0.0
        if hasOpeningAtSeam && absDist < tier.bowlHalfWidth {
            let rimNorm = absDist / tier.bowlHalfWidth
            openingDepthFactor = 0.5 * (1.0 + cos(rimNorm * .pi))
            if absDist > 1e-4 {
                dOpeningFactorDx = -0.5 * (.pi / tier.bowlHalfWidth) * sin(rimNorm * .pi) * (distFromSeam >= 0.0 ? 1.0 : -1.0)
            }
        }

        let bowlPower = 1.35
        let archBowlDrop = openingDepthFactor > 0.0 ? tier.bowlDropDepth * pow(openingDepthFactor, bowlPower) : 0.0
        let dArchBowlDropDx = openingDepthFactor > 1e-4
            ? tier.bowlDropDepth * bowlPower * pow(openingDepthFactor, bowlPower - 1.0) * dOpeningFactorDx
            : 0.0

        let visualRimY = max(tier.minRidgeY - 7.0, min(tier.maxVisualRimY, rawRidgeY + archBowlDrop))
        let visualRimSlope = max(-1.35, min(1.35, dRidgeDx + dArchBowlDropDx))

        let isDiveOpening = hasOpeningAtSeam && absDist < tier.openingHalfWidth
        let edgeWeight: Double
        if !hasOpeningAtSeam {
            edgeWeight = 1.0
        } else if isDiveOpening {
            edgeWeight = 0.0
        } else {
            edgeWeight = quinticSmoothstep(edge0: tier.openingHalfWidth, edge1: tier.openingHalfWidth + 160.0, x: absDist)
        }

        let topY = visualRimY
        let slope = visualRimSlope

        let wallRampSpan = 165.0
        let wallDropU: Double
        if !hasOpeningAtSeam {
            wallDropU = 1.0
        } else if isDiveOpening {
            wallDropU = 0.0
        } else {
            wallDropU = max(0.0, min(1.0, (absDist - tier.openingHalfWidth) / wallRampSpan))
        }
        let wallDropT: Double
        if wallDropU <= 0.0 {
            wallDropT = 0.0
        } else if wallDropU >= 1.0 {
            wallDropT = 1.0
        } else {
            wallDropT = wallDropU * wallDropU * wallDropU * (wallDropU * (wallDropU * 6.0 - 15.0) + 10.0)
        }
        let dWallDropTDx: Double
        if !hasOpeningAtSeam || isDiveOpening || wallDropU <= 0.0 || wallDropU >= 1.0 {
            dWallDropTDx = 0.0
        } else {
            dWallDropTDx = ((30.0 * wallDropU * wallDropU * (wallDropU - 1.0) * (wallDropU - 1.0)) / wallRampSpan) * (distFromSeam >= 0.0 ? 1.0 : -1.0)
        }

        let stalactiteWave = sin(worldX * 0.017 + seedPhase * 1.1) * 14.0 + cos(worldX * 0.029 - seedPhase * 0.6) * 8.0
        let dStalactiteDx = cos(worldX * 0.017 + seedPhase * 1.1) * (14.0 * 0.017) - sin(worldX * 0.029 - seedPhase * 0.6) * (8.0 * 0.029)

        let lipArchY = topY + 86.0
        let targetDeepArchY = max(topY + 195.0, min(tier.archMaxDepthY, tier.archTargetBaseY + stalactiteWave))
        let bottomArchY = lipArchY + (targetDeepArchY - lipArchY) * wallDropT
        let rawBottomSlope = slope * (1.0 - wallDropT) + wallDropT * dStalactiteDx + (targetDeepArchY - lipArchY) * dWallDropTDx
        let bottomSlope = max(-2.6, min(2.6, rawBottomSlope))

        return (
            topY: topY,
            slope: slope,
            edgeWeight: edgeWeight,
            openingDepthFactor: openingDepthFactor,
            isDiveOpening: isDiveOpening,
            bottomArchY: bottomArchY,
            bottomSlope: bottomSlope
        )
    }

    /// Samples any of the 9 continuous seabed terraces (tierIndex = 0..8) with 100% mathematical parity with Web getSeabedTerraceAt.
    public static func getSeabedTerraceAt(worldX: Double, tierIndex: Int = 0) -> SeabedTerraceSample {
        let clampedTier = max(0, min(seabedTerraceTiers.count - 1, tierIndex))
        let tier = seabedTerraceTiers[clampedTier]
        let raw = evalTerraceSeabedContinuousRaw(worldX: worldX, tier: tier)
        let mainFloorY = getFloorDepthAt(worldX: worldX)
        let mainSlope = getTerrainSlopeAt(worldX: worldX)

        if mainFloorY <= tier.graftStartMainY {
            return SeabedTerraceSample(
                isPresent: false,
                isDiveOpening: false,
                topY: mainFloorY,
                bottomArchY: max(raw.bottomArchY, mainFloorY + 60.0),
                edgeFactor: 0.0,
                caveFactor: 0.0,
                slope: mainSlope,
                bottomSlope: mainSlope,
                tierIndex: tier.tierIndex,
                stripId: tier.stripId
            )
        }

        let graftT = quinticSmoothstep(edge0: tier.graftStartMainY, edge1: tier.graftEndMainY, x: mainFloorY)
        let graftedTopY = mainFloorY + (raw.topY - mainFloorY) * graftT
        let graftedSlope = mainSlope + (raw.slope - mainSlope) * graftT
        let graftedBottomArchY: Double
        if mainFloorY < tier.graftFuseMainY {
            graftedBottomArchY = max(raw.bottomArchY, min(tier.archMaxDepthY + 6.0, mainFloorY + 48.0 * (1.0 - graftT * 0.5)))
        } else {
            graftedBottomArchY = min(mainFloorY - 22.0, max(graftedTopY + 86.0, raw.bottomArchY))
        }
        let graftedEdgeWeight = raw.edgeWeight * graftT

        return SeabedTerraceSample(
            isPresent: !raw.isDiveOpening && graftT > 0.03,
            isDiveOpening: raw.isDiveOpening && graftT > 0.02,
            topY: graftedTopY,
            bottomArchY: graftedBottomArchY,
            edgeFactor: graftedEdgeWeight,
            caveFactor: raw.openingDepthFactor * graftT,
            slope: graftedSlope,
            bottomSlope: raw.bottomSlope * graftT + mainSlope * (1.0 - graftT),
            tierIndex: tier.tierIndex,
            stripId: tier.stripId
        )
    }

    public static func getShallowCoralAtollAt(worldX: Double) -> SeabedTerraceSample {
        return getSeabedTerraceAt(worldX: worldX, tierIndex: 0)
    }

    public enum SeabedOutcropType: String, Sendable {
        case CORAL_MOUND
        case ROCK_SPIRE
        case KELP_CLUSTER
        case ABYSSAL_CHIMNEY
    }

    public struct SeabedOutcropPlacement: Sendable {
        public let worldX: Double
        public let baseY: Double
        public let width: Double
        public let height: Double
        public let type: SeabedOutcropType
        public let variant: Int
        public let seed: Double
        /// `nil` for main seafloor outcrops; `0...8` for seabed terrace outcrops (used to cull outcrops on shattered terrace cells)
        public let terraceIndex: Int?
    }

    /// Generates deterministic, naturally proportioned seabed outcrops along both the main seafloor AND all 9 seabed terraces
    /// (5 variants per family: 0..3 = 16 distinct stylized atlas sprites, 4 = rare composite cluster; strict anti-repetition between neighbors)
    public static func getSeabedOutcropsForChunk(chunkIndex: Int, chunkWidth: Double = 600.0) -> [SeabedOutcropPlacement] {
        var placements: [SeabedOutcropPlacement] = []
        let chunkStartX = Double(chunkIndex) * chunkWidth

        // 1. Main seafloor outcrops (natural 38m..68m height scale with neighbor non-repetition)
        let count = 2 + Int(floor(hash1D(chunkIndex, salt: 811) * 2.0)) // 2 or 3 per chunk
        let slotSpan = chunkWidth / Double(count)
        var prevMainVariant = -1
        var prevMainType: SeabedOutcropType? = nil

        for i in 0..<count {
            let h1 = hash1D(chunkIndex * 7 + i, salt: 823)
            let h2 = hash1D(chunkIndex * 13 + i, salt: 829)
            let h3 = hash1D(chunkIndex * 19 + i, salt: 839)
            let worldX = chunkStartX + (Double(i) + 0.16 + h1 * 0.68) * slotSpan
            let baseY = getFloorDepthAt(worldX: worldX)

            var type: SeabedOutcropType
            if baseY < 620.0 {
                type = h2 < 0.54 ? .CORAL_MOUND : (h2 < 0.82 ? .KELP_CLUSTER : .ROCK_SPIRE)
            } else if baseY < 1450.0 {
                type = h2 < 0.38 ? .CORAL_MOUND : (h2 < 0.72 ? .ROCK_SPIRE : .KELP_CLUSTER)
            } else {
                // Mix rocks, deep bioluminescent corals/anemones, and vents in the abyss so it's never all volcanoes!
                type = h2 < 0.46 ? .ROCK_SPIRE : (h2 < 0.76 ? .ABYSSAL_CHIMNEY : .CORAL_MOUND)
            }
            if type == prevMainType && type == .ABYSSAL_CHIMNEY {
                type = .ROCK_SPIRE
            }

            // Variant 0..3 = 16 distinct individual sprites from world_ecology_atlas; Variant 4 = rare standalone cluster (~12% chance, never twice in a row)
            var variant = h3 > 0.88 ? 4 : Int(floor((h3 / 0.88) * 4.0))
            if variant == prevMainVariant {
                variant = (variant + 1) % 4
            }
            prevMainVariant = variant
            prevMainType = type

            let width: Double
            let height: Double
            switch type {
            case .CORAL_MOUND:
                width = 52.0 + h2 * 34.0
                height = 38.0 + h3 * 26.0
            case .KELP_CLUSTER:
                width = 46.0 + h2 * 28.0
                height = 52.0 + h3 * 34.0
            case .ROCK_SPIRE:
                width = 54.0 + h2 * 36.0
                height = 40.0 + h3 * 28.0
            case .ABYSSAL_CHIMNEY:
                width = 50.0 + h2 * 32.0
                height = 42.0 + h3 * 28.0
            }

            placements.append(SeabedOutcropPlacement(
                worldX: worldX, baseY: baseY, width: width, height: height,
                type: type, variant: variant, seed: h1, terraceIndex: nil
            ))
        }

        // 2. Multi-Tier Seabed Terrace Outcrops across all 9 tiers (tierIndex = 0..8)
        let terraceSlotCount = 2
        let terraceSlotSpan = chunkWidth / Double(terraceSlotCount)
        for tierIdx in 0..<seabedTerraceTiers.count {
            let saltOffset = tierIdx * 197
            var prevTerraceVariant = -1
            for i in 0..<terraceSlotCount {
                let h1 = hash1D(chunkIndex * 11 + i, salt: 911 + saltOffset)
                if tierIdx >= 4 && h1 < 0.32 { continue }
                let h2 = hash1D(chunkIndex * 17 + i, salt: 919 + saltOffset)
                let h3 = hash1D(chunkIndex * 23 + i, salt: 929 + saltOffset)
                let worldX = chunkStartX + (Double(i) + 0.16 + h1 * 0.68) * terraceSlotSpan
                let terrace = getSeabedTerraceAt(worldX: worldX, tierIndex: tierIdx)
                if terrace.isPresent && terrace.edgeFactor > 0.24 {
                    let type: SeabedOutcropType
                    if tierIdx == 0 {
                        type = h2 < 0.56 ? .CORAL_MOUND : (h2 < 0.84 ? .KELP_CLUSTER : .ROCK_SPIRE)
                    } else if tierIdx == 1 {
                        type = h2 < 0.44 ? .CORAL_MOUND : (h2 < 0.76 ? .ROCK_SPIRE : .KELP_CLUSTER)
                    } else if tierIdx <= 3 {
                        type = h2 < 0.36 ? .CORAL_MOUND : (h2 < 0.78 ? .ROCK_SPIRE : .KELP_CLUSTER)
                    } else {
                        type = h2 < 0.52 ? .ROCK_SPIRE : (h2 < 0.80 ? .ABYSSAL_CHIMNEY : .CORAL_MOUND)
                    }

                    var variant = h3 > 0.88 ? 4 : Int(floor((h3 / 0.88) * 4.0))
                    if variant == prevTerraceVariant {
                        variant = (variant + 1) % 4
                    }
                    prevTerraceVariant = variant

                    let sizeScale = 0.88 + Double((chunkIndex + i + tierIdx) % 3) * 0.08
                    let width: Double
                    let height: Double
                    switch type {
                    case .CORAL_MOUND:
                        width = (50.0 + h2 * 32.0) * sizeScale
                        height = (36.0 + h3 * 24.0) * sizeScale
                    case .KELP_CLUSTER:
                        width = (44.0 + h2 * 26.0) * sizeScale
                        height = (48.0 + h3 * 32.0) * sizeScale
                    default:
                        width = (52.0 + h2 * 34.0) * sizeScale
                        height = (38.0 + h3 * 26.0) * sizeScale
                    }

                    placements.append(SeabedOutcropPlacement(
                        worldX: worldX, baseY: terrace.topY, width: width, height: height,
                        type: type, variant: variant, seed: h1, terraceIndex: tierIdx
                    ))
                }
            }
        }

        return placements
    }

    public struct SeabedCollisionResult: Sendable {
        public let y: Double
        public let vy: Double
        public let hitSeabed: Bool
        public let hitAtollUnderside: Bool
        public let floorY: Double
        public let slope: Double
    }

    /// Physical Seabed Two-Way Collision Solver (Prevents swimming through the main seafloor or any of the 9 seabed terraces from above, below, or horizontally!)
    public static func resolveSeabedCollision(
        worldX: Double,
        worldY: Double,
        vy: Double,
        entityRadius: Double,
        clearancePadding: Double = 6.0,
        prevWorldY: Double? = nil,
        options: SeabedCollisionOptions? = nil
    ) -> SeabedCollisionResult {
        let mainFloorY = getFloorDepthAt(worldX: worldX)
        let mainSlope = getTerrainSlopeAt(worldX: worldX)
        let maxAllowedMainY = mainFloorY - (entityRadius + clearancePadding)
        let refPrevY = prevWorldY ?? (worldY - vy * 0.016)
        let clearance = entityRadius + clearancePadding

        // 1. Check all 9 seabed terraces (zero dead-zone inside [terraceTopMaxY, terraceUndersideMinY]!)
        for tierIdx in 0..<seabedTerraceTiers.count {
            if canSharkShatterTerrace(tierIndex: tierIdx, sharkLengthM: options?.sharkLengthM)
                || isTerraceCellBreached(tierIndex: tierIdx, worldX: worldX, breachedCells: options?.breachedCells) {
                continue
            }
            let spec = seabedTerraceTiers[tierIdx]
            let bandMinY = spec.baseDepth - 240.0 - clearance
            let bandMaxY = spec.baseDepth + spec.thicknessBase + 380.0 + clearance
            if (worldY < bandMinY && refPrevY < bandMinY) || (worldY > bandMaxY && refPrevY > bandMaxY) {
                continue
            }

            let terrace = getSeabedTerraceAt(worldX: worldX, tierIndex: tierIdx)
            guard terrace.isPresent else { continue }

            // Solid graft mountain wedge when main seafloor rises above terrace bottomArchY (zero under-corridor)
            let hasUnderCorridor = (mainFloorY - terrace.bottomArchY) > (clearance * 1.25)
            if !hasUnderCorridor {
                let wedgeTopY = min(terrace.topY, mainFloorY)
                let wedgeTopMaxY = min(maxAllowedMainY, wedgeTopY - clearance)
                if worldY > wedgeTopMaxY && refPrevY >= spec.baseDepth - 240.0 - clearance - 260.0 {
                    let wedgeSlope = terrace.topY <= mainFloorY ? terrace.slope : mainSlope
                    return SeabedCollisionResult(
                        y: wedgeTopMaxY,
                        vy: min(0.0, vy * -0.12),
                        hitSeabed: true,
                        hitAtollUnderside: false,
                        floorY: wedgeTopY,
                        slope: wedgeSlope
                    )
                }
                continue
            }

            let terraceTopMaxY = min(maxAllowedMainY, terrace.topY - clearance)
            let terraceUndersideMinY = terrace.bottomArchY + clearance * 0.90

            if worldY > terraceTopMaxY && worldY < terraceUndersideMinY {
                let isFromBelow = refPrevY > terrace.topY + 4.0
                    || (refPrevY > terrace.topY - clearance * 0.25 && vy < -1e-3)

                if !isFromBelow {
                    return SeabedCollisionResult(
                        y: terraceTopMaxY,
                        vy: min(0.0, vy * -0.12),
                        hitSeabed: true,
                        hitAtollUnderside: false,
                        floorY: terrace.topY,
                        slope: terrace.slope
                    )
                } else {
                    let clampedUnderY = min(maxAllowedMainY, terraceUndersideMinY)
                    return SeabedCollisionResult(
                        y: clampedUnderY,
                        vy: max(0.0, vy * -0.15),
                        hitSeabed: false,
                        hitAtollUnderside: true,
                        floorY: terrace.bottomArchY,
                        slope: terrace.bottomSlope
                    )
                }
            }
        }

        // 2. Main continuous seafloor collision
        if worldY > maxAllowedMainY {
            return SeabedCollisionResult(
                y: maxAllowedMainY,
                vy: min(0.0, vy * -0.12),
                hitSeabed: true,
                hitAtollUnderside: false,
                floorY: mainFloorY,
                slope: mainSlope
            )
        }

        return SeabedCollisionResult(
            y: worldY, vy: vy, hitSeabed: false, hitAtollUnderside: false,
            floorY: mainFloorY, slope: mainSlope
        )
    }

    public struct SeabedKineticStepResult: Sendable {
        public let x: Double
        public let y: Double
        public let vx: Double
        public let vy: Double
        public let hitSeabed: Bool
        public let hitAtollUnderside: Bool
        public let floorY: Double
        public let slope: Double
    }

    private static func hitsTerraceVerticalWallHorizontally(
        prevX: Double,
        prevY: Double,
        candX: Double,
        entityRadius: Double,
        clearancePadding: Double,
        options: SeabedCollisionOptions? = nil
    ) -> Bool {
        if abs(candX - prevX) < 1e-6 { return false }
        let clearance = max(0.0, entityRadius + clearancePadding)
        let candMainY = getFloorDepthAt(worldX: candX)

        for tierIdx in 0..<seabedTerraceTiers.count {
            if canSharkShatterTerrace(tierIndex: tierIdx, sharkLengthM: options?.sharkLengthM)
                || isTerraceCellBreached(tierIndex: tierIdx, worldX: candX, breachedCells: options?.breachedCells) {
                continue
            }
            let spec = seabedTerraceTiers[tierIdx]
            let bandMinY = spec.baseDepth - 240.0 - clearance
            let bandMaxY = spec.baseDepth + spec.thicknessBase + 380.0 + clearance
            if prevY < bandMinY || prevY > bandMaxY {
                continue
            }

            let nextT = getSeabedTerraceAt(worldX: candX, tierIndex: tierIdx)
            if !nextT.isPresent { continue }

            let prevT = getSeabedTerraceAt(worldX: prevX, tierIndex: tierIdx)
            let candHasUnderCorridor = (candMainY - nextT.bottomArchY) > (clearance * 1.25)

            // Case A: Crossing from an open cave/graft void (!prevT.isPresent) directly horizontally into a cliff wall
            if !prevT.isPresent {
                let insideVerticalCliff = prevY > nextT.topY - clearance * 0.15
                    && (!candHasUnderCorridor || prevY < nextT.bottomArchY + clearance * 0.35)
                if insideVerticalCliff {
                    return true
                }
            }

            // Case B: Attempting to squeeze horizontally into a pinched graft mountain wedge (clearance < 2 * r + 4)
            if prevY > nextT.topY + 4.0
                && (candMainY - nextT.bottomArchY) < (clearance * 2.0 + 4.0)
                && prevY > min(nextT.topY, candMainY) - clearance * 0.15 {
                return true
            }
        }
        return false
    }

    /// Full 2D Kinetic Seabed Step with Sub-Stepping, 2D Cliff-Wall Blocking, Unit-Tangent Vector Projection & 8-Iteration Binary Search Arc-Length Conservation
    public static func resolveSeabedKineticStep(
        prevX: Double,
        prevY: Double,
        nextX: Double,
        nextY: Double,
        vx: Double,
        vy: Double,
        entityRadius: Double,
        clearancePadding: Double = 6.0,
        options: SeabedCollisionOptions? = nil
    ) -> SeabedKineticStepResult {
        let totalDx = nextX - prevX
        let totalDy = nextY - prevY
        let dist = hypot(totalDx, totalDy)
        let steps = max(1, min(6, Int(ceil(dist / max(8.0, entityRadius * 0.45)))))
        let stepDx = totalDx / Double(steps)
        let stepDy = totalDy / Double(steps)
        let maxSubstepDist = dist / Double(steps)
        let intendedSpeed = hypot(vx, vy)

        var curX = prevX
        var curY = prevY
        var curVx = vx
        var curVy = vy
        var hitSeabed = false
        var hitAtollUnderside = false
        var lastFloorY = getFloorDepthAt(worldX: nextX)
        var lastSlope = 0.0

        for _ in 1...steps {
            let stepPrevX = curX
            let stepPrevY = curY
            let rawTargetX = stepPrevX + stepDx
            let targetY = stepPrevY + stepDy

            var targetX = rawTargetX
            var hitWallHorizontally = false
            if hitsTerraceVerticalWallHorizontally(
                prevX: stepPrevX,
                prevY: stepPrevY,
                candX: rawTargetX,
                entityRadius: entityRadius,
                clearancePadding: clearancePadding,
                options: options
            ) {
                hitWallHorizontally = true
                var lo = 0.0
                var hi = 1.0
                var safeX = stepPrevX
                for _ in 0..<6 {
                    let mid = (lo + hi) * 0.5
                    let cx = stepPrevX + (rawTargetX - stepPrevX) * mid
                    if hitsTerraceVerticalWallHorizontally(
                        prevX: stepPrevX,
                        prevY: stepPrevY,
                        candX: cx,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        options: options
                    ) {
                        hi = mid
                    } else {
                        lo = mid
                        safeX = cx
                    }
                }
                targetX = safeX
            }

            let col = resolveSeabedCollision(
                worldX: targetX,
                worldY: targetY,
                vy: curVy,
                entityRadius: entityRadius,
                clearancePadding: clearancePadding,
                prevWorldY: stepPrevY,
                options: options
            )

            lastFloorY = col.floorY
            lastSlope = col.slope
            let tangentScale = 1.0 / sqrt(1.0 + col.slope * col.slope)

            if col.hitAtollUnderside {
                hitAtollUnderside = true
                let effStepDx = hitWallHorizontally ? 0.0 : stepDx
                let dotParallel = (effStepDx + max(0.0, stepDy) * col.slope) * tangentScale
                let isPushingIntoSlope = effStepDx * col.slope > 1e-6
                let stepTangentMag: Double
                if isPushingIntoSlope {
                    if effStepDx * dotParallel <= 0.0 {
                        stepTangentMag = 0.0
                    } else {
                        stepTangentMag = max(-maxSubstepDist * 0.88, min(maxSubstepDist * 0.88, dotParallel * 0.88))
                    }
                } else {
                    stepTangentMag = effStepDx * 0.88
                }
                let projectedX = hitWallHorizontally
                    ? targetX
                    : (stepPrevX + (isPushingIntoSlope ? stepTangentMag * tangentScale : stepTangentMag))
                let maxAllowed = isPushingIntoSlope
                    ? min(maxSubstepDist * 0.88, max(maxSubstepDist * 0.25, abs(stepTangentMag)))
                    : maxSubstepDist * 0.88

                var finalStepX = projectedX
                if hitsTerraceVerticalWallHorizontally(
                    prevX: stepPrevX,
                    prevY: stepPrevY,
                    candX: finalStepX,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    options: options
                ) {
                    finalStepX = targetX
                    hitWallHorizontally = true
                }

                let secondCol = resolveSeabedCollision(
                    worldX: finalStepX,
                    worldY: targetY,
                    vy: curVy,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    prevWorldY: stepPrevY,
                    options: options
                )
                var finalStepY = secondCol.hitAtollUnderside ? secondCol.y : max(targetY, col.y)

                let actualSubDist = hypot(finalStepX - stepPrevX, finalStepY - stepPrevY)
                if actualSubDist > maxAllowed && actualSubDist > 1e-6 && maxAllowed > 1e-6 {
                    let prevColAtStart = resolveSeabedCollision(
                        worldX: stepPrevX,
                        worldY: stepPrevY,
                        vy: curVy,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        prevWorldY: stepPrevY,
                        options: options
                    )
                    let startMinY = prevColAtStart.hitAtollUnderside ? prevColAtStart.y : stepPrevY
                    var lo = 0.0
                    var hi = 1.0
                    var bestX = stepPrevX
                    var bestY = max(startMinY, min(finalStepY, stepPrevY + maxAllowed * 0.35))

                    for _ in 0..<8 {
                        let mid = (lo + hi) * 0.5
                        let candX = stepPrevX + (finalStepX - stepPrevX) * mid
                        let candRawY = stepPrevY + stepDy * mid
                        let candCol = resolveSeabedCollision(
                            worldX: candX,
                            worldY: candRawY,
                            vy: curVy,
                            entityRadius: entityRadius,
                            clearancePadding: clearancePadding,
                            prevWorldY: stepPrevY,
                            options: options
                        )
                        let candY = (candCol.hitAtollUnderside || candCol.hitSeabed) ? candCol.y : candRawY
                        let candDist = hypot(candX - stepPrevX, candY - stepPrevY)
                        if candDist <= maxAllowed * 1.0005 {
                            lo = mid
                            bestX = candX
                            bestY = candY
                        } else {
                            hi = mid
                        }
                    }
                    finalStepX = bestX
                    finalStepY = bestY
                }

                curX = finalStepX
                curY = finalStepY
                let vParallel = (vx + max(0.0, vy) * col.slope) * tangentScale
                curVx = hitWallHorizontally ? 0.0 : (isPushingIntoSlope ? (vParallel * tangentScale * 0.88) : (vx * 0.88))
                curVy = vy < 0.0 ? 0.0 : vy * tangentScale * 0.88
            } else if col.hitSeabed {
                hitSeabed = true
                let effStepDx = hitWallHorizontally ? 0.0 : stepDx
                let isUphill = effStepDx * col.slope < -1e-5
                let effDy = isUphill ? min(0.0, stepDy) : max(0.0, stepDy)
                let dotParallel = (effStepDx + effDy * col.slope) * tangentScale
                let damp = isUphill ? 0.88 : 0.90
                let stepTangentMag: Double
                if effStepDx * dotParallel <= 0.0 {
                    stepTangentMag = 0.0
                } else {
                    stepTangentMag = max(-maxSubstepDist * damp, min(maxSubstepDist * damp, dotParallel * damp))
                }
                let projectedX = hitWallHorizontally ? targetX : (stepPrevX + stepTangentMag * tangentScale)
                let maxAllowed = min(maxSubstepDist * damp, max(maxSubstepDist * 0.25, abs(stepTangentMag)))

                var finalStepX = projectedX
                if hitsTerraceVerticalWallHorizontally(
                    prevX: stepPrevX,
                    prevY: stepPrevY,
                    candX: finalStepX,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    options: options
                ) {
                    finalStepX = targetX
                    hitWallHorizontally = true
                }

                let secondCol = resolveSeabedCollision(
                    worldX: finalStepX,
                    worldY: targetY,
                    vy: curVy,
                    entityRadius: entityRadius,
                    clearancePadding: clearancePadding,
                    prevWorldY: stepPrevY,
                    options: options
                )
                var finalStepY = secondCol.hitSeabed ? secondCol.y : min(targetY, col.y)

                let actualSubDist = hypot(finalStepX - stepPrevX, finalStepY - stepPrevY)
                if actualSubDist > maxAllowed && actualSubDist > 1e-6 && maxAllowed > 1e-6 {
                    let prevColAtStart = resolveSeabedCollision(
                        worldX: stepPrevX,
                        worldY: stepPrevY,
                        vy: curVy,
                        entityRadius: entityRadius,
                        clearancePadding: clearancePadding,
                        prevWorldY: stepPrevY,
                        options: options
                    )
                    let startMaxY = prevColAtStart.hitSeabed ? prevColAtStart.y : stepPrevY
                    var lo = 0.0
                    var hi = 1.0
                    var bestX = stepPrevX
                    var bestY = min(startMaxY, max(finalStepY, stepPrevY - maxAllowed * 0.35))

                    for _ in 0..<8 {
                        let mid = (lo + hi) * 0.5
                        let candX = stepPrevX + (finalStepX - stepPrevX) * mid
                        let candRawY = stepPrevY + stepDy * mid
                        let candCol = resolveSeabedCollision(
                            worldX: candX,
                            worldY: candRawY,
                            vy: curVy,
                            entityRadius: entityRadius,
                            clearancePadding: clearancePadding,
                            prevWorldY: stepPrevY,
                            options: options
                        )
                        let candY = (candCol.hitSeabed || candCol.hitAtollUnderside) ? candCol.y : candRawY
                        let candDist = hypot(candX - stepPrevX, candY - stepPrevY)
                        if candDist <= maxAllowed * 1.0005 {
                            lo = mid
                            bestX = candX
                            bestY = candY
                        } else {
                            hi = mid
                        }
                    }
                    finalStepX = bestX
                    finalStepY = bestY
                }

                curX = finalStepX
                curY = finalStepY
                let vParallel = (vx + (isUphill ? min(0.0, vy) : max(0.0, vy)) * col.slope) * tangentScale
                curVx = hitWallHorizontally ? 0.0 : (vParallel * tangentScale * damp)
                curVy = vy > 0.0 ? 0.0 : vy * tangentScale * damp
            } else {
                curX = targetX
                curY = col.y
                if hitWallHorizontally {
                    hitSeabed = true
                    curVx = 0.0
                }
            }
        }

        let capSpeed = (hitSeabed || hitAtollUnderside) ? intendedSpeed * 0.90 : intendedSpeed
        let outSpeed = hypot(curVx, curVy)
        if outSpeed > capSpeed && outSpeed > 1e-6 {
            let s = capSpeed / outSpeed
            curVx *= s
            curVy *= s
        }

        return SeabedKineticStepResult(
            x: curX,
            y: curY,
            vx: curVx,
            vy: curVy,
            hitSeabed: hitSeabed,
            hitAtollUnderside: hitAtollUnderside,
            floorY: lastFloorY,
            slope: lastSlope
        )
    }

    public static func sampleParallaxTerrainModulation(worldX: Double, depthY: Double) -> ProceduralTerrainModulation {
        return ProceduralTerrainModulation(
            farRidgeOffsetPx: 0.0,
            midStratumOffsetPx: 0.0,
            nearSeabedOffsetPx: 0.0,
            reliefMultiplier: 1.0,
            seabedBiasPx: 0.0,
            schoolClusterProbability: 0.72
        )
    }
}
