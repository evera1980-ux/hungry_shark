import XCTest
import Dispatch
#if SWIFT_PACKAGE
@testable import HungrySharkEvolutionCore
#else
@testable import HungrySharkEvolution
#endif

final class GameRulesTests: XCTestCase {

    // MARK: - 1. Shared JSON Data Contract Parity

    func testSharedGameDataIntegrity() {
        let sharks = GameConfigGenerated.sharkForms
        XCTAssertEqual(sharks.count, 48, "Expected exact 48 evolved shark forms in game_data.json")

        let seenIds = Set(sharks.map(\.id))
        XCTAssertEqual(seenIds.count, 48, "Shark IDs must be unique across all 48 forms")

        for (expectedIdx, form) in sharks.enumerated() {
            XCTAssertEqual(form.index, expectedIdx, "Shark index must be contiguous 0...47")
            XCTAssertFalse(form.nameZh.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            XCTAssertFalse(form.nameEn.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            XCTAssertGreaterThan(form.realBodyLengthM, 0.5)
        }

        XCTAssertEqual(GameConfigGenerated.lineageMeta.count, SharkLineageId.allCases.count)

        let preys = GameConfigGenerated.preyTiers
        XCTAssertEqual(preys.count, 135, "Expected 134 ocean species + cyber_mine = 135 prey tiers")
        for prey in preys {
            XCTAssertFalse(prey.nameZh.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            XCTAssertFalse(prey.nameEn.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            XCTAssertGreaterThan(prey.radius, 0.0)
            XCTAssertLessThanOrEqual(prey.minDepth, prey.maxDepth)
        }

        XCTAssertGreaterThanOrEqual(GameConfigGenerated.i18nZh.count, 40)
        XCTAssertGreaterThanOrEqual(GameConfigGenerated.i18nEn.count, 40)
        for key in GameConfigGenerated.i18nZh.keys {
            XCTAssertNotNil(GameConfigGenerated.i18nEn[key], "Missing English I18N key for \(key)")
        }
    }

    // MARK: - 2. True 2D Camera Zoom & Linear Real Physical Scale Invariance

    func testTrueCameraZoomAndLinearPreyScale() {
        XCTAssertEqual(GameRules.computeTrueCameraZoom(realBodyLengthM: 0.8), 1.0, accuracy: 0.001)
        XCTAssertEqual(GameRules.computeTrueCameraZoom(realBodyLengthM: 45.0), GameRules.cameraZoomMin, accuracy: 0.001)
        XCTAssertEqual(GameRules.computeTrueCameraZoom(realBodyLengthM: 80.0), GameRules.cameraZoomMin, accuracy: 0.001)

        let zoomSmall = GameRules.computeTrueCameraZoom(realBodyLengthM: 1.5)
        let zoomMid = GameRules.computeTrueCameraZoom(realBodyLengthM: 10.0)
        let zoomGiant = GameRules.computeTrueCameraZoom(realBodyLengthM: 32.0)
        XCTAssertGreaterThan(zoomSmall, zoomMid)
        XCTAssertGreaterThan(zoomMid, zoomGiant)
        XCTAssertGreaterThanOrEqual(zoomGiant, GameRules.cameraZoomMin)

        let starterStats = GameRules.computeEvolvedSharkStats(
            inRunLevel: 1,
            sharkFormId: "shark_00_clown_fry",
            upgradeLevel: 1,
            frenzyActive: false,
            globalDifficultyMultiplier: 1.0,
            unlockedCount: 1
        )
        XCTAssertEqual(
            starterStats.worldScale,
            ((starterStats.scale / starterStats.cameraZoom) * 1000.0).rounded() / 1000.0,
            accuracy: 0.0001
        )
        XCTAssertFalse(starterStats.canEatMines)

        let apexForm = GameConfigGenerated.sharkForms.last!
        let apexFrenzyStats = GameRules.computeEvolvedSharkStats(
            inRunLevel: 10,
            sharkFormId: apexForm.id,
            upgradeLevel: 10,
            frenzyActive: true,
            globalDifficultyMultiplier: 1.5,
            unlockedCount: 48
        )
        XCTAssertEqual(apexFrenzyStats.biteTier, 48)
        XCTAssertTrue(apexFrenzyStats.canEatMines)
        XCTAssertEqual(apexFrenzyStats.hpDrainPerSec, 0.0, accuracy: 1e-6)
        XCTAssertEqual(apexFrenzyStats.boostDrainPerSec, 0.0, accuracy: 1e-6)

        // Verify linear proportionality between prey length (cm) and visual*radius world size
        let nonBossPreys = GameConfigGenerated.preyTiers.filter { !$0.isBoss && $0.bodyLengthCm > 0 }
        XCTAssertGreaterThanOrEqual(nonBossPreys.count, 2)
        let smallPrey = nonBossPreys.min(by: { $0.bodyLengthCm < $1.bodyLengthCm })!
        let largePrey = nonBossPreys.max(by: { $0.bodyLengthCm < $1.bodyLengthCm })!

        let smallRadius = smallPrey.radius * GameRules.getPreyRelativeVisualScale(prey: smallPrey, sharkStats: apexFrenzyStats)
        let largeRadius = largePrey.radius * GameRules.getPreyRelativeVisualScale(prey: largePrey, sharkStats: apexFrenzyStats)
        let actualLengthRatio = largePrey.bodyLengthCm / smallPrey.bodyLengthCm
        let visualSizeRatio = largeRadius / smallRadius
        XCTAssertEqual(visualSizeRatio, actualLengthRatio, accuracy: 0.02)

        let normalScale = GameRules.getPreyRelativeVisualScale(prey: smallPrey, sharkStats: starterStats, mutationVariant: .NONE)
        let behemothScale = GameRules.getPreyRelativeVisualScale(prey: smallPrey, sharkStats: starterStats, mutationVariant: .ABYSS_BEHEMOTH)
        XCTAssertEqual(behemothScale / normalScale, 1.25, accuracy: 0.001)
    }

    // MARK: - 3. Piecewise Depth Conversion (worldY <-> meters)

    func testDepthMeterConversions() {
        let expectedStops: [(worldY: Double, meters: Double)] = [
            (0.0, 0.0),
            (2000.0, 200.0),
            (6000.0, 1000.0),
            (10000.0, 4000.0),
            (16000.0, 6000.0),
            (20000.0, 11000.0)
        ]

        for stop in expectedStops {
            XCTAssertEqual(GameRules.worldYToMeterDepth(stop.worldY), stop.meters, accuracy: 0.5)
            XCTAssertEqual(GameRules.meterDepthToWorldY(stop.meters), stop.worldY, accuracy: 1.0)
        }

        XCTAssertEqual(GameRules.worldYToMeterDepth(-150.0), 0.0, accuracy: 0.1)
        XCTAssertEqual(GameRules.worldYToMeterDepth(1000.0), 100.0, accuracy: 0.5)
    }

    // MARK: - 4. 9-Tier Seabed Terraces & Giant Shark Shatter Physics

    func testSeabedTerracesAndShatterThresholds() {
        let tiers = GameRules.seabedTerraceTiers
        XCTAssertEqual(tiers.count, 9)

        let expectedShatterLengths: [Double] = [8.0, 12.0, 18.0, 26.0, 36.0]
        for idx in 0..<5 {
            XCTAssertEqual(tiers[idx].shatterLengthM, expectedShatterLengths[idx], accuracy: 0.001)
            XCTAssertFalse(GameRules.canSharkShatterTerrace(tierIndex: idx, sharkLengthM: expectedShatterLengths[idx] - 0.1))
            XCTAssertTrue(GameRules.canSharkShatterTerrace(tierIndex: idx, sharkLengthM: expectedShatterLengths[idx]))
        }
        for idx in 5..<9 {
            XCTAssertTrue(tiers[idx].shatterLengthM.isInfinite)
            XCTAssertFalse(GameRules.canSharkShatterTerrace(tierIndex: idx, sharkLengthM: 120.0))
        }

        // Locate a present solid span on Tier 0 coral reef and confirm breach + bypass
        var sampleWorldX = 0.0
        var foundPresent = false
        for probe in stride(from: -1200.0, through: 1200.0, by: 40.0) {
            let sample = GameRules.getSeabedTerraceAt(worldX: probe, tierIndex: 0)
            if sample.isPresent && (GameRules.getFloorDepthAt(worldX: probe) - sample.bottomArchY) > 60.0 {
                sampleWorldX = probe
                foundPresent = true
                break
            }
        }
        XCTAssertTrue(foundPresent, "Expected solid Tier 0 coral reef span near shallow water")
        let tier0 = GameRules.getSeabedTerraceAt(worldX: sampleWorldX, tierIndex: 0)
        let midRockY = (tier0.topY + tier0.bottomArchY) * 0.5

        // Small shark (2m) is blocked by Tier 0 rock
        let smallCollision = GameRules.resolveSeabedCollision(
            worldX: sampleWorldX,
            worldY: midRockY,
            vy: 40.0,
            entityRadius: 18.0,
            prevWorldY: tier0.topY - 30.0,
            options: GameRules.SeabedCollisionOptions(sharkLengthM: 2.0, breachedCells: nil)
        )
        XCTAssertTrue(smallCollision.hitSeabed)

        // Giant shark (10m) detects shatterable hit and passes unobstructed
        let shatterHit = GameRules.detectShatterableTerraceHit(
            prevX: sampleWorldX,
            prevY: tier0.topY - 25.0,
            nextX: sampleWorldX,
            nextY: midRockY,
            entityRadius: 28.0,
            sharkLengthM: 10.0,
            breachedCells: nil
        )
        XCTAssertNotNil(shatterHit)
        XCTAssertEqual(shatterHit?.tierIndex, 0)
        XCTAssertTrue(shatterHit?.isNewlyBreached ?? false)

        let cellKey = GameRules.formatTerraceBreachKey(
            tierIndex: 0,
            cellIndex: GameRules.getTerraceBreachCellIndex(worldX: sampleWorldX)
        )
        let breachedCollision = GameRules.resolveSeabedCollision(
            worldX: sampleWorldX,
            worldY: midRockY,
            vy: 40.0,
            entityRadius: 18.0,
            prevWorldY: tier0.topY - 30.0,
            options: GameRules.SeabedCollisionOptions(sharkLengthM: 2.0, breachedCells: [cellKey])
        )
        XCTAssertFalse(breachedCollision.hitSeabed, "Breached cell must allow subsequent passes without rock collision")
    }

    // MARK: - 5. Thread-Safe Terrain Block Cache Stress Test (NSLock)

    func testTerrainBlockCacheConcurrentStress() {
        let iterations = 200
        let queue = DispatchQueue.global(qos: .userInitiated)
        let group = DispatchGroup()
        let lock = NSLock()
        var nanDetected = false

        for i in 0..<iterations {
            group.enter()
            queue.async {
                let x = Double((i * 1973) - 190000)
                let floorY = GameRules.getFloorDepthAt(worldX: x)
                let kinetic = GameRules.resolveSeabedKineticStep(
                    prevX: x,
                    prevY: floorY - 120.0,
                    nextX: x + 48.0,
                    nextY: floorY + 20.0,
                    vx: 180.0,
                    vy: 90.0,
                    entityRadius: 24.0
                )
                if !floorY.isFinite || !kinetic.x.isFinite || !kinetic.y.isFinite {
                    lock.lock()
                    nanDetected = true
                    lock.unlock()
                }
                group.leave()
            }
        }

        let waitResult = group.wait(timeout: .now() + 10.0)
        XCTAssertEqual(waitResult, .success)
        XCTAssertFalse(nanDetected, "Concurrent terrain sampling must remain finite and race-free")
    }

    // MARK: - 6. Encounter Resolution & Progression Gates

    func testPreyEncounterAndEvolutionProgression() {
        let starterStats = GameRules.computeEvolvedSharkStats(
            inRunLevel: 1,
            sharkFormId: "shark_00_clown_fry",
            upgradeLevel: 1
        )
        let t1Prey = GameConfigGenerated.preyTiers.first(where: { !$0.isHazard && $0.tier <= starterStats.biteTier })!
        let crushPrey = GameConfigGenerated.preyTiers.first(where: { !$0.isHazard && $0.tier == starterStats.biteTier + 1 })!
        let lethalPrey = GameConfigGenerated.preyTiers.first(where: { !$0.isHazard && $0.tier >= starterStats.biteTier + 5 })!
        let minePrey = GameConfigGenerated.preyTiers.first(where: { $0.isHazard })!

        XCTAssertEqual(GameRules.resolvePreyEncounter(prey: t1Prey, sharkStats: starterStats, isBoosting: false, frenzyActive: false), .DEVOUR)
        XCTAssertEqual(GameRules.resolvePreyEncounter(prey: crushPrey, sharkStats: starterStats, isBoosting: false, frenzyActive: false), .NEED_BOOST)
        XCTAssertEqual(GameRules.resolvePreyEncounter(prey: crushPrey, sharkStats: starterStats, isBoosting: true, frenzyActive: false), .ARMOR_CRUSH)
        XCTAssertEqual(GameRules.resolvePreyEncounter(prey: lethalPrey, sharkStats: starterStats, isBoosting: true, frenzyActive: false), .DAMAGE)
        XCTAssertEqual(GameRules.resolvePreyEncounter(prey: minePrey, sharkStats: starterStats, isBoosting: false, frenzyActive: false), .DAMAGE)
        XCTAssertEqual(GameRules.resolvePreyEncounter(prey: minePrey, sharkStats: starterStats, isBoosting: false, frenzyActive: true), .DEVOUR)

        var save = SharkMetaSaveData.createDefault()
        let secondShark = GameConfigGenerated.sharkForms[1]
        let lockedCheck = GameRules.evaluateSharkUnlock(form: secondShark, save: save)
        XCTAssertFalse(lockedCheck.isUnlocked)

        save.sharkUpgradeLevels[GameConfigGenerated.sharkForms[0].id] = max(10, secondShark.reqParentUpgradeLevel)
        save.bestInRunLevel = max(10, secondShark.reqMaxInRunLevel)
        save.maxDepthReached = max(5000.0, secondShark.reqMaxDepth)
        save.bankedCoins = max(999_999, secondShark.unlockCoins)
        save.bankedGenes = max(99_999, secondShark.unlockGenes)

        let readyCheck = GameRules.evaluateSharkUnlock(form: secondShark, save: save)
        XCTAssertTrue(readyCheck.canUnlockNow)

        let masteryCfg = GameRules.getSharkMasteryConfig(form: GameConfigGenerated.sharkForms[0])
        let goldTarget = masteryCfg.tiers[2].targetScore
        let settlement = GameRules.settleSharkScoreMastery(
            sharkId: GameConfigGenerated.sharkForms[0].id,
            runScore: goldTarget + 500,
            save: save
        )
        XCTAssertEqual(settlement.newMasteryTier, 3)
        XCTAssertEqual(settlement.newlyClaimedTiers.count, 3)
        XCTAssertGreaterThan(settlement.totalBonusCoins, 0)
        XCTAssertGreaterThan(settlement.totalBonusGenes, 0)

        save.unlockedSharkIds = [GameConfigGenerated.sharkForms[0].id, secondShark.id]
        save.sharkMasteryTiers[GameConfigGenerated.sharkForms[0].id] = 3
        let atlasBonuses = GameRules.getGlobalAtlasBonuses(save: save)
        XCTAssertEqual(atlasBonuses.unlockedCount, 2)
        XCTAssertEqual(atlasBonuses.totalMasteryCrowns, 3)
        XCTAssertGreaterThan(atlasBonuses.hpMultiplier, 1.0)
        XCTAssertGreaterThan(atlasBonuses.rewardMultiplier, 1.0)
    }
}
