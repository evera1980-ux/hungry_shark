import Foundation

/// Thread-safe bounded LRU block cache for deterministic procedural terrain spline evaluation (`iOS-P1-3`).
/// Replaces the previous unlocked static dictionary on `GameRules` to satisfy Swift 6 strict concurrency.
private final class SeabedTerrainBlockCache: @unchecked Sendable {
    static let shared = SeabedTerrainBlockCache()

    private let lock = NSLock()
    private var cache: [Int: [Double]] = [:]
    private var order: [Int] = []
    private let maxCacheSize: Int = 128

    func cachedNodes(for blockIdx: Int) -> [Double]? {
        lock.lock()
        defer { lock.unlock() }
        return cache[blockIdx]
    }

    func storeNodes(_ solvedNodes: [Double], for blockIdx: Int) {
        lock.lock()
        defer { lock.unlock() }
        if cache[blockIdx] != nil {
            return
        }
        if cache.count >= maxCacheSize, let oldest = order.first {
            order.removeFirst()
            cache.removeValue(forKey: oldest)
        }
        cache[blockIdx] = solvedNodes
        order.append(blockIdx)
    }
}

enum SeabedTerrainConstants {
    static let terrainMaxSlope: Double = 1.65
    static let terrainSampleStepX: Double = 100.0
    static let terrainBaseFloorDepth: Double = 10100.0
    static let terrainLargeWaveAmplitude: Double = 9600.0
    static let terrainMediumWaveAmplitude: Double = 3800.0
    static let terrainSmallWaveAmplitude: Double = 720.0
    static let terrainMinFloorDepth: Double = 420.0
    static let terrainMaxFloorDepth: Double = 19800.0
    static let sandyPlainCellWidth: Double = 1800.0
    static let tanhGainNorm: Double = tanh(1.82)

    static let seabedTerraceTiers: [GameRules.SeabedTerraceTierSpec] = [
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 0, stripId: "coral_reef",
            baseRidgeY: 414.0, minRidgeY: 332.0, maxRidgeY: 496.0, maxVisualRimY: 648.0,
            archTargetBaseY: 708.0, archMaxDepthY: 736.0, cellWidth: 1600.0, seamPhaseOffsetX: 0.0,
            skipZeroSeam: true, openingHalfWidth: 232.0, bowlHalfWidth: 416.0, bowlDropDepth: 148.0,
            minMainFloorForOpening: 680.0, graftStartMainY: 560.0, graftEndMainY: 880.0, graftFuseMainY: 760.0, seedSalt: 613,
            shatterLengthM: 8.0
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 1, stripId: "rocky_shelf",
            baseRidgeY: 1220.0, minRidgeY: 1130.0, maxRidgeY: 1310.0, maxVisualRimY: 1475.0,
            archTargetBaseY: 1512.0, archMaxDepthY: 1545.0, cellWidth: 1800.0, seamPhaseOffsetX: 800.0,
            skipZeroSeam: false, openingHalfWidth: 248.0, bowlHalfWidth: 440.0, bowlDropDepth: 156.0,
            minMainFloorForOpening: 1500.0, graftStartMainY: 1370.0, graftEndMainY: 1710.0, graftFuseMainY: 1575.0, seedSalt: 1619,
            shatterLengthM: 12.0
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 2, stripId: "rocky_shelf",
            baseRidgeY: 2220.0, minRidgeY: 2120.0, maxRidgeY: 2320.0, maxVisualRimY: 2495.0,
            archTargetBaseY: 2532.0, archMaxDepthY: 2568.0, cellWidth: 2000.0, seamPhaseOffsetX: 350.0,
            skipZeroSeam: false, openingHalfWidth: 266.0, bowlHalfWidth: 468.0, bowlDropDepth: 164.0,
            minMainFloorForOpening: 2520.0, graftStartMainY: 2380.0, graftEndMainY: 2750.0, graftFuseMainY: 2600.0, seedSalt: 2633,
            shatterLengthM: 18.0
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 3, stripId: "underwater_canyon",
            baseRidgeY: 3460.0, minRidgeY: 3350.0, maxRidgeY: 3570.0, maxVisualRimY: 3755.0,
            archTargetBaseY: 3792.0, archMaxDepthY: 3832.0, cellWidth: 2200.0, seamPhaseOffsetX: 1100.0,
            skipZeroSeam: false, openingHalfWidth: 284.0, bowlHalfWidth: 496.0, bowlDropDepth: 172.0,
            minMainFloorForOpening: 3780.0, graftStartMainY: 3630.0, graftEndMainY: 4030.0, graftFuseMainY: 3865.0, seedSalt: 3671,
            shatterLengthM: 26.0
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 4, stripId: "underwater_canyon",
            baseRidgeY: 5040.0, minRidgeY: 4910.0, maxRidgeY: 5170.0, maxVisualRimY: 5365.0,
            archTargetBaseY: 5402.0, archMaxDepthY: 5446.0, cellWidth: 2400.0, seamPhaseOffsetX: 600.0,
            skipZeroSeam: false, openingHalfWidth: 302.0, bowlHalfWidth: 524.0, bowlDropDepth: 180.0,
            minMainFloorForOpening: 5390.0, graftStartMainY: 5230.0, graftEndMainY: 5660.0, graftFuseMainY: 5480.0, seedSalt: 4723,
            shatterLengthM: 36.0
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 5, stripId: "underwater_canyon",
            baseRidgeY: 7060.0, minRidgeY: 6910.0, maxRidgeY: 7210.0, maxVisualRimY: 7420.0,
            archTargetBaseY: 7456.0, archMaxDepthY: 7506.0, cellWidth: 2600.0, seamPhaseOffsetX: 1500.0,
            skipZeroSeam: false, openingHalfWidth: 324.0, bowlHalfWidth: 560.0, bowlDropDepth: 192.0,
            minMainFloorForOpening: 7440.0, graftStartMainY: 7270.0, graftEndMainY: 7740.0, graftFuseMainY: 7545.0, seedSalt: 5801,
            shatterLengthM: .infinity
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 6, stripId: "underwater_canyon",
            baseRidgeY: 9640.0, minRidgeY: 9470.0, maxRidgeY: 9810.0, maxVisualRimY: 10030.0,
            archTargetBaseY: 10066.0, archMaxDepthY: 10122.0, cellWidth: 2900.0, seamPhaseOffsetX: 700.0,
            skipZeroSeam: false, openingHalfWidth: 350.0, bowlHalfWidth: 604.0, bowlDropDepth: 206.0,
            minMainFloorForOpening: 10050.0, graftStartMainY: 9880.0, graftEndMainY: 10380.0, graftFuseMainY: 10165.0, seedSalt: 6883,
            shatterLengthM: .infinity
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 7, stripId: "deep_abyss",
            baseRidgeY: 12900.0, minRidgeY: 12710.0, maxRidgeY: 13090.0, maxVisualRimY: 13324.0,
            archTargetBaseY: 13360.0, archMaxDepthY: 13422.0, cellWidth: 3200.0, seamPhaseOffsetX: 1900.0,
            skipZeroSeam: false, openingHalfWidth: 380.0, bowlHalfWidth: 652.0, bowlDropDepth: 222.0,
            minMainFloorForOpening: 13340.0, graftStartMainY: 13160.0, graftEndMainY: 13700.0, graftFuseMainY: 13470.0, seedSalt: 7949,
            shatterLengthM: .infinity
        ),
        GameRules.SeabedTerraceTierSpec(
            tierIndex: 8, stripId: "deep_abyss",
            baseRidgeY: 16900.0, minRidgeY: 16690.0, maxRidgeY: 17110.0, maxVisualRimY: 17360.0,
            archTargetBaseY: 17396.0, archMaxDepthY: 17464.0, cellWidth: 3600.0, seamPhaseOffsetX: 900.0,
            skipZeroSeam: false, openingHalfWidth: 416.0, bowlHalfWidth: 710.0, bowlDropDepth: 240.0,
            minMainFloorForOpening: 17370.0, graftStartMainY: 17180.0, graftEndMainY: 17760.0, graftFuseMainY: 17515.0, seedSalt: 9013,
            shatterLengthM: .infinity
        )
    ]
}

// MARK: - Procedural Ocean World & 9-Tier Continuous Seabed System (1:1 Parity with src/game/worldGenerationSystem.ts)

extension GameRules {
    public struct ProceduralTerrainModulation: Sendable {
        public let farRidgeOffsetPx: Double
        public let midStratumOffsetPx: Double
        public let nearSeabedOffsetPx: Double
        public let reliefMultiplier: Double
        public let seabedBiasPx: Double
        public let schoolClusterProbability: Double
    }

    public static func hash1D(_ n: Int, salt: Int = 0) -> Double {
        let seed: UInt32 = 20261110
        let n32 = UInt32(bitPattern: Int32(truncatingIfNeeded: n))
        let s32 = UInt32(bitPattern: Int32(truncatingIfNeeded: salt))
        var x = (n32 &* 374761393) &+ ((seed ^ s32) &* 668265263)
        x = (x ^ (x >> 13)) &* 1274126177
        x = x ^ (x >> 16)
        return Double(x) / 4294967296.0
    }

    public static func noise1D(_ x: Double, salt: Int = 0) -> Double {
        let x0 = Int(floor(x))
        let tx = x - Double(x0)
        let u = tx * tx * tx * (tx * (tx * 6.0 - 15.0) + 10.0)
        let v0 = hash1D(x0, salt: salt) * 2.0 - 1.0
        let v1 = hash1D(x0 + 1, salt: salt) * 2.0 - 1.0
        return v0 + (v1 - v0) * u
    }

    /// Exact 1:1 port of Web terrainLatticeValue(latticeIndex, waveSalt, WorldConfig)
    /// (worldSeed = 123456789, generatorVersion = 1, subsystemKey = "terrain", subHash = 0x8a86635c, baseH = 0x7811b100)
    private static func terrainLatticeValue(_ latticeIndex: Int, waveSalt: Int) -> Double {
        let ncx = UInt32(bitPattern: Int32(truncatingIfNeeded: latticeIndex))
        let ncy = UInt32(bitPattern: Int32(truncatingIfNeeded: waveSalt))
        var h: UInt32 = 0x7811b100
        h = (h ^ ncx) &* 0x165667b1
        h = (h ^ ncy) &* 0xd3a2646c
        h = h ^ 0x8a86635c
        h ^= h >> 16
        h = h &* 0x85ebca6b
        h ^= h >> 13
        h = h &* 0xc2b2ae35
        h ^= h >> 16
        let nonZeroH: UInt32 = h != 0 ? h : 0x6d2b79f5
        return (Double(nonZeroH) / 4294967296.0) * 2.0 - 1.0
    }

    private static func smoothedTerrainLatticeValue(_ latticeIndex: Int, waveSalt: Int) -> Double {
        let vm1 = terrainLatticeValue(latticeIndex - 1, waveSalt: waveSalt)
        let v0 = terrainLatticeValue(latticeIndex, waveSalt: waveSalt)
        let vp1 = terrainLatticeValue(latticeIndex + 1, waveSalt: waveSalt)
        return 0.25 * vm1 + 0.5 * v0 + 0.25 * vp1
    }

    private static func contrastStretchedLatticeValue(_ latticeIndex: Int, waveSalt: Int) -> Double {
        if SeabedTerrainConstants.terrainMinFloorDepth <= 600.0 {
            if latticeIndex == 0 { return -0.94 }
            if latticeIndex == 1 || latticeIndex == -1 {
                let n = abs(terrainLatticeValue(latticeIndex, waveSalt: waveSalt + 7))
                return 0.42 + 0.12 * n
            }
            if latticeIndex == 2 || latticeIndex == -2 {
                let n = abs(terrainLatticeValue(latticeIndex, waveSalt: waveSalt + 13))
                return 0.92 + 0.08 * n
            }
        }
        let raw = terrainLatticeValue(latticeIndex, waveSalt: waveSalt)
        if raw < 0.0 {
            return -pow(abs(raw), 0.68) * 0.94
        }
        return pow(abs(raw), 0.56)
    }

    static func evalSmoothTerrainWave(
        _ worldX: Double,
        wavelength: Double,
        waveSalt: Int,
        useContrastStretch: Bool = false
    ) -> Double {
        let scaled = worldX / wavelength
        let i0 = Int(floor(scaled))
        let t = scaled - Double(i0)
        let u = t * t * (3.0 - 2.0 * t)
        let v0 = useContrastStretch
            ? contrastStretchedLatticeValue(i0, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0, waveSalt: waveSalt)
        let v1 = useContrastStretch
            ? contrastStretchedLatticeValue(i0 + 1, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0 + 1, waveSalt: waveSalt)
        return v0 + (v1 - v0) * u
    }

    private static func evalWarpedTerrainWave(
        _ worldX: Double,
        wavelength: Double,
        waveSalt: Int,
        useContrastStretch: Bool = false
    ) -> Double {
        let scaled = worldX / wavelength
        let i0 = Int(floor(scaled))
        let t = scaled - Double(i0)
        let h = t * t * (3.0 - 2.0 * t)

        let asymScale = useContrastStretch ? 0.32 : 0.54
        let stepScale = useContrastStretch ? 0.26 : 0.38
        let asym = terrainLatticeValue(i0, waveSalt: waveSalt + 19) * asymScale
        let step1 = terrainLatticeValue(i0, waveSalt: waveSalt + 37) * stepScale
        let step2 = terrainLatticeValue(i0, waveSalt: waveSalt + 53) * (stepScale * 0.55)

        let warpedU = h
            + asym * h * (1.0 - h) * (1.0 - 2.0 * h)
            + step1 * (sin(.pi * 2.0 * h) / (.pi * 2.0))
            + step2 * (sin(.pi * 4.0 * h) / (.pi * 4.0))
        let u = max(0.0, min(1.0, warpedU))

        let v0 = useContrastStretch
            ? contrastStretchedLatticeValue(i0, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0, waveSalt: waveSalt)
        let v1 = useContrastStretch
            ? contrastStretchedLatticeValue(i0 + 1, waveSalt: waveSalt)
            : smoothedTerrainLatticeValue(i0 + 1, waveSalt: waveSalt)
        return v0 + (v1 - v0) * u
    }

    private static func evalRidgedTerrainWave(
        _ worldX: Double,
        wavelength: Double,
        waveSalt: Int
    ) -> Double {
        let rawW = evalSmoothTerrainWave(worldX, wavelength: wavelength, waveSalt: waveSalt, useContrastStretch: false)
        let w = tanh(rawW * 1.82) / SeabedTerrainConstants.tanhGainNorm
        let eps = 0.34
        let minVal = sqrt(eps)
        let maxVal = sqrt(1.0 + eps)
        let normFold = (sqrt(w * w + eps) - minVal) / (maxVal - minVal)
        let roundedFold = 1.0 - 2.0 * normFold
        let cosineArch = cos(w * .pi * 0.94)
        var blended = roundedFold * 0.62 + cosineArch * 0.38
        if blended < -0.20 {
            let u = min(1.0, (-blended - 0.20) / 0.80)
            let flatDome = u - 0.34 * u * u
            blended = -(0.20 + 0.80 * (flatDome / 0.66) * 0.90)
        }
        return max(-1.0, min(1.0, blended))
    }

    private static func evalSlopeVariationOffset(_ worldX: Double) -> Double {
        let mountainChain =
            evalRidgedTerrainWave(worldX, wavelength: 1180.0, waveSalt: 601) * 320.0 +
            evalRidgedTerrainWave(worldX, wavelength: 780.0, waveSalt: 619) * 260.0
        let subPeaks =
            evalWarpedTerrainWave(worldX, wavelength: 520.0, waveSalt: 643, useContrastStretch: false) * 210.0 +
            evalRidgedTerrainWave(worldX, wavelength: 340.0, waveSalt: 661) * 145.0
        let phaseMod = evalSmoothTerrainWave(worldX, wavelength: 920.0, waveSalt: 677) * 1.8
        let ridgeWave =
            sin((worldX / 220.0) * .pi * 2.0 + phaseMod) * 72.0 +
            cos((worldX / 145.0) * .pi * 2.0 - phaseMod * 0.7) * 34.0
        return mountainChain + subPeaks + ridgeWave
    }

    private static func evalBaseMacroOffsetAtX(_ worldX: Double, effA1: Double, isBlockAnchor: Bool) -> Double {
        let macroPrimary = isBlockAnchor
            ? evalSmoothTerrainWave(worldX, wavelength: 18500.0, waveSalt: 101, useContrastStretch: true)
            : evalWarpedTerrainWave(worldX, wavelength: 18500.0, waveSalt: 101, useContrastStretch: true)
        let macroSecondary = isBlockAnchor
            ? evalSmoothTerrainWave(worldX, wavelength: 26000.0, waveSalt: 157, useContrastStretch: true)
            : evalWarpedTerrainWave(worldX, wavelength: 26000.0, waveSalt: 157, useContrastStretch: true)
        var combinedMacroNorm = max(-1.0, min(1.0, macroPrimary * 0.62 + macroSecondary * 0.38))

        if combinedMacroNorm < -0.35 {
            let u = min(1.0, (-combinedMacroNorm - 0.35) / 0.65)
            let flatTop = u - 0.36 * u * u
            combinedMacroNorm = -(0.35 + 0.65 * (flatTop / 0.64))
        }

        var macroOffset = combinedMacroNorm * effA1
        if SeabedTerrainConstants.terrainMinFloorDepth <= 600.0 && effA1 >= 5000.0 {
            let absX = abs(worldX)
            if absX < 7600.0 {
                let targetOriginOffset: Double
                if absX <= 560.0 {
                    let u = absX / 560.0
                    let spawnHills =
                        sin(worldX / 88.0) * 34.0 +
                        cos(worldX / 52.0 + 0.8) * 22.0 +
                        sin(worldX / 155.0 - 0.5) * 28.0
                    targetOriginOffset = -effA1 + 22.0 + 30.0 * (u * u) + spawnHills
                } else if absX <= 4200.0 {
                    let slopeProgress = (absX - 560.0) / 3640.0
                    let smoothDrop = 0.44 * slopeProgress + 0.56 * quinticSmoothstep(edge0: 0.0, edge1: 1.0, x: slopeProgress)
                    let mountainOsc = sin((absX - 560.0) / 115.0) * 195.0 + cos(worldX / 74.0) * 115.0
                    targetOriginOffset = -effA1 + 52.0 + 3880.0 * smoothDrop + mountainOsc * sin(.pi * slopeProgress)
                } else {
                    targetOriginOffset = -effA1 + 3932.0 + (absX - 4200.0) * 0.72
                }
                let oceanBlend = quinticSmoothstep(edge0: 3600.0, edge1: 7600.0, x: absX)
                macroOffset = targetOriginOffset + (macroOffset - targetOriginOffset) * oceanBlend
            }
        }
        return macroOffset
    }

    public static func evalSandyPlainFactor(_ worldX: Double) -> Double {
        let cellW = SeabedTerrainConstants.sandyPlainCellWidth
        let scaled = worldX / cellW
        let cellIdx = Int(floor(scaled))
        let u = scaled - Double(cellIdx)

        let rampIn = quinticSmoothstep(edge0: 0.0, edge1: 0.16, x: u)
        let rampOut = 1.0 - quinticSmoothstep(edge0: 0.84, edge1: 1.0, x: u)
        let cellWindow = rampIn * rampOut

        let cellCenterX = (Double(cellIdx) + 0.5) * cellW
        let w1 = evalSmoothTerrainWave(cellCenterX, wavelength: 3200.0, waveSalt: 509)
        let w2 = terrainLatticeValue(cellIdx, waveSalt: 577)
        let selectorSignal = w1 * 0.55 + w2 * 0.45
        let cellStrength = quinticSmoothstep(edge0: -0.28, edge1: 0.08, x: selectorSignal)
        let rawPlain = cellWindow * cellStrength

        if SeabedTerrainConstants.terrainMinFloorDepth <= 600.0 {
            let absX = abs(worldX)
            if absX <= 520.0 { return 0.75 }
            if absX < 3400.0 { return rawPlain * 0.25 }
        }
        return rawPlain
    }

    private static func evalRawRandomFloorDepthAtX(_ worldX: Double, isBlockAnchor: Bool = false) -> Double {
        let A1 = SeabedTerrainConstants.terrainLargeWaveAmplitude
        let A2 = SeabedTerrainConstants.terrainMediumWaveAmplitude
        let A3 = SeabedTerrainConstants.terrainSmallWaveAmplitude
        let plainFactor = evalSandyPlainFactor(worldX)

        let roughEnvWave = evalSmoothTerrainWave(worldX, wavelength: 5800.0, waveSalt: 707)
        let baseRoughness = 0.46 + 0.54 * (0.5 + 0.5 * roughEnvWave)
        let roughness = baseRoughness * (1.0 - 0.58 * plainFactor)

        let effA1 = min(A1, 9600.0)
        var macroOffset = evalBaseMacroOffsetAtX(worldX, effA1: effA1, isBlockAnchor: false)

        if plainFactor > 0.05 && effA1 > 200.0 && abs(worldX) > 3400.0 {
            let cellW = SeabedTerrainConstants.sandyPlainCellWidth
            let cellIdx = Int(floor(worldX / cellW))
            let cellCenterX = (Double(cellIdx) + 0.5) * cellW
            let centerMacroOffset = evalBaseMacroOffsetAtX(cellCenterX, effA1: effA1, isBlockAnchor: true)
            let originBlend = quinticSmoothstep(edge0: 3400.0, edge1: 4200.0, x: abs(worldX))
            let gentleMacroLock = plainFactor * 0.52 * originBlend
            let rollingHills =
                sin((worldX / 580.0) * .pi * 2.0 + Double(cellIdx) * 1.7) * 64.0 +
                cos((worldX / 310.0) * .pi * 2.0 - Double(cellIdx) * 1.1) * 32.0
            macroOffset = macroOffset + (centerMacroOffset - macroOffset) * gentleMacroLock + rollingHills * plainFactor * originBlend
        }

        let originDetailFade = SeabedTerrainConstants.terrainMinFloorDepth <= 600.0 ? quinticSmoothstep(edge0: 560.0, edge1: 1280.0, x: abs(worldX)) : 1.0

        let effA2 = min(A2, 3800.0) * originDetailFade
        let mesoRidgedPrimary = evalRidgedTerrainWave(worldX, wavelength: 2100.0, waveSalt: 263)
        let mesoRidgedSecondary = evalRidgedTerrainWave(worldX, wavelength: 1320.0, waveSalt: 281)
        let mesoWarped = evalWarpedTerrainWave(worldX, wavelength: 1750.0, waveSalt: 202, useContrastStretch: false)
        var mesoFolded = mesoRidgedPrimary * 0.44 + mesoRidgedSecondary * 0.32 + mesoWarped * 0.24
        if mesoFolded < -0.24 {
            let uPeak = min(1.0, (-mesoFolded - 0.24) / 0.76)
            let flatPeak = uPeak - 0.35 * uPeak * uPeak
            mesoFolded = -(0.24 + 0.76 * (flatPeak / 0.65) * 0.85)
        }
        let mesoEnvelope = (0.58 + 0.42 * baseRoughness) * (1.0 - 0.62 * plainFactor)
        let mediumOffset = mesoFolded * effA2 * mesoEnvelope * 0.42

        let effA3 = min(A3, 720.0) * originDetailFade
        let slopeVarWeight = originDetailFade * (0.38 + 0.62 * (1.0 - 0.65 * plainFactor)) * min(1.0, A2 / 1000.0)
        let mountainRangeOffset = evalSlopeVariationOffset(worldX) * slopeVarWeight
        let cragWave = evalWarpedTerrainWave(worldX, wavelength: 480.0, waveSalt: 303, useContrastStretch: false)
        let microJagged = evalSmoothTerrainWave(worldX, wavelength: 230.0, waveSalt: 409)
        let smallOffset =
            mountainRangeOffset +
            cragWave * effA3 * (0.45 + 0.55 * roughness) +
            microJagged * min(effA3 * 0.38, 180.0) * (0.45 + 0.55 * roughness)

        let blockSpan = 20.0 * SeabedTerrainConstants.terrainSampleStepX
        let blockInteriorArch = sin((worldX / blockSpan) * .pi)
        let mountainCap = 240.0 + 480.0 * (blockInteriorArch * blockInteriorArch)
        let rawMountainSum = mediumOffset + smallOffset
        let boundedMountainOffset = mountainCap > 0.0 ? mountainCap * tanh(rawMountainSum / mountainCap) : 0.0

        var rawDepth = SeabedTerrainConstants.terrainBaseFloorDepth + macroOffset + boundedMountainOffset
        if SeabedTerrainConstants.terrainMinFloorDepth <= 600.0 && rawDepth < 740.0 {
            let shallowExcess = 740.0 - rawDepth
            let maxGentleRise = 310.0
            let cushionedRise = maxGentleRise * tanh(shallowExcess / maxGentleRise)
            rawDepth = 740.0 - cushionedRise
        }
        return rawDepth
    }

    private static func evalGridNodeFloorDepth(_ gridIndex: Int) -> Double {
        let stepX = SeabedTerrainConstants.terrainSampleStepX
        let minFloor = SeabedTerrainConstants.terrainMinFloorDepth
        let maxFloor = SeabedTerrainConstants.terrainMaxFloorDepth
        let blockSteps = 20
        let blockIdx = Int(floor(Double(gridIndex) / Double(blockSteps)))
        let localStep = gridIndex - blockIdx * blockSteps

        if let cached = SeabedTerrainBlockCache.shared.cachedNodes(for: blockIdx) {
            return cached[localStep]
        }

        let maxStepDelta = SeabedTerrainConstants.terrainMaxSlope * stepX
        let blockStartGrid = blockIdx * blockSteps

        var scratchRawY = [Double](repeating: 0.0, count: blockSteps + 1)
        var scratchDeltas = [Double](repeating: 0.0, count: blockSteps)
        var scratchRooms = [Double](repeating: 0.0, count: blockSteps)
        var scratchWeightedRooms = [Double](repeating: 0.0, count: blockSteps)
        var scratchStepRhythm = [Double](repeating: 0.0, count: blockSteps)

        for j in 0...blockSteps {
            let gx = blockStartGrid + j
            let yVal = evalRawRandomFloorDepthAtX(Double(gx) * stepX, isBlockAnchor: false)
            scratchRawY[j] = max(minFloor, min(maxFloor, yVal))
        }

        let safeLimit = maxStepDelta - 1e-6
        let redistributionLimit = 1.36 * stepX
        var clampedSum = 0.0

        for j in 0..<blockSteps {
            let stepGridIdx = blockStartGrid + j
            let midX = (Double(stepGridIdx) + 0.5) * stepX
            let isSpawnZone = minFloor <= 600.0 && abs(midX) <= 600.0
            let pf = evalSandyPlainFactor(midX)
            let rawD = scratchRawY[j + 1] - scratchRawY[j]

            let hStep = terrainLatticeValue(stepGridIdx, waveSalt: 829)
            let ridgePhase = sin(Double(stepGridIdx) * 1.35 + hStep * 1.45)
            let modulatedD: Double

            if isSpawnZone {
                modulatedD = rawD
                scratchStepRhythm[j] = 0.0
            } else if pf > 0.32 {
                let hillSlope = (sin(Double(stepGridIdx) * 1.55 + hStep * 0.9) * 0.14
                    + cos(Double(stepGridIdx) * 0.85 - hStep * 0.7) * 0.06) * stepX
                modulatedD = rawD * (1.0 - 0.68 * pf) + hillSlope * pf
                scratchStepRhythm[j] = 0.03
            } else if ridgePhase < -0.56 {
                let reverseKick = (hStep < 0.0 ? -0.22 : 0.12) * stepX
                modulatedD = rawD * 0.25 + reverseKick
                scratchStepRhythm[j] = 0.06
            } else {
                modulatedD = rawD
                scratchStepRhythm[j] = 1.0
            }

            let c = max(-redistributionLimit, min(redistributionLimit, modulatedD))
            scratchDeltas[j] = c
            clampedSum += c
        }

        let targetDiff = scratchRawY[blockSteps] - scratchRawY[0]
        let excess = targetDiff - clampedSum
        if abs(excess) > 1e-9 {
            var totalWeightedRoom = 0.0
            for j in 0..<blockSteps {
                let midX = (Double(blockStartGrid + j) + 0.5) * stepX
                let isSpawnZone = minFloor <= 600.0 && abs(midX) <= 600.0
                let pf = evalSandyPlainFactor(midX)
                let room = isSpawnZone
                    ? 0.0
                    : max(0.0, excess > 0.0 ? (redistributionLimit - scratchDeltas[j]) : (scratchDeltas[j] + redistributionLimit))
                scratchRooms[j] = room
                let nonPlain = max(0.02, min(1.0, 1.0 - pf))
                let weight = min(1.0, nonPlain * nonPlain * scratchStepRhythm[j])
                scratchWeightedRooms[j] = room * weight
                totalWeightedRoom += scratchWeightedRooms[j]
            }

            if totalWeightedRoom >= abs(excess) && totalWeightedRoom > 1e-9 {
                let ratio = abs(excess) / totalWeightedRoom
                let sign = excess > 0.0 ? 1.0 : -1.0
                for j in 0..<blockSteps {
                    scratchDeltas[j] += sign * scratchWeightedRooms[j] * ratio
                }
            } else {
                let sign = excess > 0.0 ? 1.0 : -1.0
                var remainingExcess = abs(excess)
                if totalWeightedRoom > 1e-9 {
                    for j in 0..<blockSteps {
                        let add = min(scratchRooms[j], scratchWeightedRooms[j])
                        scratchDeltas[j] += sign * add
                        scratchRooms[j] = max(0.0, scratchRooms[j] - add)
                        remainingExcess -= add
                    }
                }
                if remainingExcess > 1e-9 {
                    var totalRoom = 0.0
                    for j in 0..<blockSteps { totalRoom += scratchRooms[j] }
                    if totalRoom > 1e-9 {
                        let ratio = min(1.0, remainingExcess / totalRoom)
                        for j in 0..<blockSteps {
                            scratchDeltas[j] += sign * scratchRooms[j] * ratio
                        }
                    }
                }
            }
        }

        let minAbsD = 0.045 * stepX
        let absAvgDeadHalf = 0.048 * stepX
        for m in 0..<10 {
            let j0 = m * 2
            let j1 = j0 + 1
            let d0 = scratchDeltas[j0]
            let d1 = scratchDeltas[j1]
            let avg = (d0 + d1) * 0.5
            let absAvg = abs(avg)
            let cMax = max(0.0, safeLimit - absAvg - 1e-4)
            let midX = Double(blockStartGrid + j0 + 1) * stepX
            let pf = evalSandyPlainFactor(midX)
            let hPair = abs(terrainLatticeValue(blockStartGrid + j0, waveSalt: 947))

            let targetC = pf > 0.32
                ? (0.068 + 0.035 * hPair) * stepX
                : (0.105 + 0.085 * hPair + 0.08 * min(1.0, absAvg / stepX)) * stepX
            var c = max((d1 - d0) * 0.5, min(cMax * 0.92, targetC))
            if c > cMax * 0.96 { c = cMax * 0.96 }

            if abs(c - absAvg) < absAvgDeadHalf {
                let upperC = absAvg + absAvgDeadHalf
                let lowerC = absAvg - absAvgDeadHalf
                if upperC <= cMax * 0.96 {
                    c = upperC
                } else if lowerC >= 0.048 * stepX {
                    c = lowerC
                }
            }
            scratchDeltas[j0] = avg - c
            scratchDeltas[j1] = avg + c
        }

        for m in 0..<9 {
            let jOdd = m * 2 + 1
            let jEvenNext = jOdd + 1
            let diffOddEven = scratchDeltas[jEvenNext] - scratchDeltas[jOdd]
            if abs(diffOddEven) < 0.095 * stepX {
                let needed = diffOddEven + 0.115 * stepX
                let jEvenCurr = m * 2
                let roomCurr = min(safeLimit + scratchDeltas[jEvenCurr], safeLimit - scratchDeltas[jOdd])
                var boostCurr = min(roomCurr * 0.85, needed)
                if boostCurr > 0.0 && (abs(scratchDeltas[jEvenCurr] - boostCurr) < minAbsD || abs(scratchDeltas[jOdd] + boostCurr) < minAbsD) {
                    let altBoost = min(roomCurr * 0.92, boostCurr + 2.2 * minAbsD)
                    if abs(scratchDeltas[jEvenCurr] - altBoost) >= minAbsD && abs(scratchDeltas[jOdd] + altBoost) >= minAbsD {
                        boostCurr = altBoost
                    } else {
                        boostCurr = 0.0
                    }
                }
                if boostCurr > 0.0 {
                    scratchDeltas[jEvenCurr] -= boostCurr
                    scratchDeltas[jOdd] += boostCurr
                }

                let remNeeded = scratchDeltas[jEvenNext] - scratchDeltas[jOdd] + 0.11 * stepX
                if remNeeded > 0.0 {
                    let jOddNext = jEvenNext + 1
                    let roomNext = min(safeLimit + scratchDeltas[jEvenNext], safeLimit - scratchDeltas[jOddNext])
                    var boostNext = min(roomNext * 0.85, remNeeded)
                    if boostNext > 0.0 && (abs(scratchDeltas[jEvenNext] - boostNext) < minAbsD || abs(scratchDeltas[jOddNext] + boostNext) < minAbsD) {
                        let altBoost = min(roomNext * 0.92, boostNext + 2.2 * minAbsD)
                        if abs(scratchDeltas[jEvenNext] - altBoost) >= minAbsD && abs(scratchDeltas[jOddNext] + altBoost) >= minAbsD {
                            boostNext = altBoost
                        } else {
                            boostNext = 0.0
                        }
                    }
                    if boostNext > 0.0 {
                        scratchDeltas[jEvenNext] -= boostNext
                        scratchDeltas[jOddNext] += boostNext
                    }
                }
            }
        }

        let latticeStep = 0.36 * stepX
        func snapBoundaryPair(jTarget: Int, jPartner: Int, jInnerNeighbor: Int, latticeOffset: Double) {
            let pairSum = scratchDeltas[jTarget] + scratchDeltas[jPartner]
            let currTarget = scratchDeltas[jTarget]
            let baseK = Int((currTarget - latticeOffset) / latticeStep + (currTarget - latticeOffset >= 0 ? 0.5 : -0.5))
            var bestTarget = currTarget
            var bestScore = Double.infinity
            for dk in -3...3 {
                let candTarget = Double(baseK + dk) * latticeStep + latticeOffset
                let candPartner = pairSum - candTarget
                if abs(candTarget) > safeLimit || abs(candPartner) > safeLimit { continue }
                if abs(candTarget) < minAbsD || abs(candPartner) < minAbsD { continue }
                if abs(candTarget - candPartner) < 0.095 * stepX { continue }
                if abs(candPartner - scratchDeltas[jInnerNeighbor]) < 0.095 * stepX { continue }
                let score = abs(candTarget - currTarget)
                if score < bestScore {
                    bestScore = score
                    bestTarget = candTarget
                }
            }
            scratchDeltas[jTarget] = bestTarget
            scratchDeltas[jPartner] = pairSum - bestTarget
        }

        snapBoundaryPair(jTarget: 0, jPartner: 1, jInnerNeighbor: 2, latticeOffset: 0.09 * stepX)
        snapBoundaryPair(jTarget: 19, jPartner: 18, jInnerNeighbor: 17, latticeOffset: -0.09 * stepX)

        var solvedNodes = [Double](repeating: 0.0, count: blockSteps + 1)
        var accY = scratchRawY[0]
        solvedNodes[0] = max(minFloor, min(maxFloor, accY))
        for j in 0..<blockSteps {
            let clampedStep = max(-maxStepDelta, min(maxStepDelta, scratchDeltas[j]))
            accY += clampedStep
            solvedNodes[j + 1] = max(minFloor, min(maxFloor, accY))
        }

        SeabedTerrainBlockCache.shared.storeNodes(solvedNodes, for: blockIdx)
        return solvedNodes[localStep]
    }

    /// Continuous 1.0x world-space seafloor mountain & trench profile (100% bit-for-bit parity with Web getFloorDepthAt)
    public static func getFloorDepthAt(worldX x: Double) -> Double {
        if !x.isFinite { return SeabedTerrainConstants.terrainBaseFloorDepth }
        let stepX = SeabedTerrainConstants.terrainSampleStepX
        let scaled = x / stepX
        let k0 = Int(floor(scaled))
        let frac = scaled - Double(k0)
        let y0 = evalGridNodeFloorDepth(k0)
        if frac == 0.0 { return y0 }
        let y1 = evalGridNodeFloorDepth(k0 + 1)
        let interpolated = y0 + (y1 - y0) * frac
        return max(SeabedTerrainConstants.terrainMinFloorDepth, min(SeabedTerrainConstants.terrainMaxFloorDepth, interpolated))
    }

    /// Exact 1:1 port of Web getTerrainSlopeAt(worldX)
    public static func getTerrainSlopeAt(worldX x: Double) -> Double {
        if !x.isFinite { return 0.0 }
        let stepX = SeabedTerrainConstants.terrainSampleStepX
        let k0 = Int(floor(x / stepX))
        let y0 = evalGridNodeFloorDepth(k0)
        let y1 = evalGridNodeFloorDepth(k0 + 1)
        return (y1 - y0) / stepX
    }

}
