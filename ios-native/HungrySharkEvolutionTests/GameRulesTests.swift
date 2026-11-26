import XCTest
import Dispatch
import SpriteKit
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
        XCTAssertEqual(preys.count, 235, "Expected 234 ocean species + cyber_mine = 235 prey tiers")
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

    // MARK: - 7. Task 02 P0 Economy & Trial Isolation Tests

    func testUnifiedPermanentProgressGateAndTrialIsolation() {
        XCTAssertTrue(GameRules.isEligibleForPermanentProgress(PermanentProgressRunContext(isTrial: false)))
        XCTAssertFalse(GameRules.isEligibleForPermanentProgress(PermanentProgressRunContext(isTrial: true)))
        XCTAssertFalse(GameRules.isEligibleForPermanentProgress(PermanentProgressRunContext(isTrial: false, sandboxOrCheatMode: true)))

        let trialEligibility = GameRules.getPermanentProgressEligibility(PermanentProgressRunContext(isTrial: true, activeInRun: true))
        XCTAssertFalse(trialEligibility.eligible)
        XCTAssertFalse(trialEligibility.allowRunRecords)
        XCTAssertFalse(trialEligibility.allowSharkMasteryAndCrown)
        XCTAssertFalse(trialEligibility.allowSharkUnlockAndUpgrade)
        XCTAssertFalse(trialEligibility.allowAchievements)
        XCTAssertFalse(trialEligibility.allowMissions)
        XCTAssertFalse(trialEligibility.allowEncyclopediaDiscovery)
        XCTAssertFalse(trialEligibility.allowRunCountIncrement)
        XCTAssertFalse(trialEligibility.allowDoubleSettlementAd)
        XCTAssertTrue(trialEligibility.allowTrialCurrencyCarryOver)

        var save = SharkMetaSaveData.createDefault()
        let trialCtx = PermanentProgressRunContext(isTrial: true, activeInRun: true)
        XCTAssertFalse(GameRules.recordFormalRunStarted(runContext: trialCtx, save: &save))
        XCTAssertEqual(save.totalRuns, 0)

        XCTAssertFalse(GameRules.recordPermanentRunProgress(save: &save, runContext: trialCtx, inRunLevel: 18, maxDepthMeters: 5000.0))
        XCTAssertEqual(save.bestInRunLevel, 1)
        XCTAssertEqual(save.maxDepthReached, 200.0, accuracy: 0.001)

        // Trial Crown must grant 0 coins / 0 genes and leave mastery & best score unchanged
        let lockedTrialShark = GameConfigGenerated.sharkForms[8]
        let goldScore = GameRules.getSharkMasteryConfig(form: lockedTrialShark).tiers[2].targetScore
        let trialSettlement = GameRules.settleSharkScoreMastery(
            sharkId: lockedTrialShark.id,
            runScore: goldScore + 5000,
            save: save,
            runContext: trialCtx
        )
        XCTAssertEqual(trialSettlement.totalBonusCoins, 0)
        XCTAssertEqual(trialSettlement.totalBonusGenes, 0)
        XCTAssertEqual(trialSettlement.newMasteryTier, 0)
        XCTAssertFalse(trialSettlement.isNewRecord)
        XCTAssertTrue(trialSettlement.newlyClaimedTiers.isEmpty)
    }

    @MainActor
    func testGameViewModelTrialSettlementDoubleAdAndMidTrialIsolation() {
        let suiteName = "hs_test_vm_\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let vm = GameViewModel(
            userDefaults: defaults,
            saveKey: "test_meta_save",
            onboardingDoneKey: "test_onboarding_done",
            preloadAds: false
        )

        // Prepare enough currency & parent upgrades so unlock would succeed if not guarded by Trial
        vm.save.bankedCoins = 50_000
        vm.save.bankedGenes = 10_000
        vm.save.sharkUpgradeLevels[GameConfigGenerated.sharkForms[0].id] = 10
        vm.save.bestInRunLevel = 10
        vm.save.maxDepthReached = 1000.0

        // Start a Trial run on locked shark #8
        let lockedTrialShark = GameConfigGenerated.sharkForms[8]
        vm.startNewRun(trialSharkId: lockedTrialShark.id)
        XCTAssertEqual(vm.save.totalRuns, 0, "Trial run must not increment totalRuns")
        XCTAssertFalse(vm.isEligibleForPermanentProgress)

        // Mid-Trial: unlocking, upgrading, or switching formal sharks is blocked
        let shark1 = GameConfigGenerated.sharkForms[1]
        XCTAssertFalse(vm.unlockSharkForm(shark1), "Active Trial must block unlocking formal sharks mid-run")
        XCTAssertFalse(vm.upgradeSharkForm(GameConfigGenerated.sharkForms[0]), "Active Trial must block upgrading formal sharks mid-run")
        vm.selectSharkForm(GameConfigGenerated.sharkForms[0])
        XCTAssertEqual(vm.trialSharkIdForRun, lockedTrialShark.id, "Active Trial must block switching back to formal shark mid-run")

        // Trial reaching higher level (Lv.12) & deep depth (4500m) must not overwrite formal save
        let prevBestLv = vm.save.bestInRunLevel
        let prevDepth = vm.save.maxDepthReached
        _ = vm.addXp(500_000)
        XCTAssertGreaterThan(vm.inRunLevel, prevBestLv)
        XCTAssertEqual(vm.save.bestInRunLevel, prevBestLv, "Trial level must never overwrite save.bestInRunLevel")

        GameRules.recordPermanentRunProgress(
            save: &vm.save,
            runContext: vm.permanentProgressContext,
            inRunLevel: vm.inRunLevel,
            maxDepthMeters: 4500.0
        )
        XCTAssertEqual(vm.save.maxDepthReached, prevDepth, accuracy: 0.001, "Trial depth must never overwrite save.maxDepthReached")

        // Trial reaching Gold Crown threshold & settling at GameOver: 0 Crown coins/genes, D1 carry-over kept, DOUBLE_SETTLEMENT blocked
        let goldScore = GameRules.getSharkMasteryConfig(form: lockedTrialShark).tiers[2].targetScore
        vm.score = goldScore + 10_000
        vm.runCoinsEarned = 420
        vm.runGenesEarned = 35
        vm.save.bankedCoins += 420
        vm.save.bankedGenes += 35

        let coinsBeforeSettlement = vm.save.bankedCoins
        let genesBeforeSettlement = vm.save.bankedGenes
        vm.triggerGameOver()
        vm.declineRevive()

        XCTAssertNil(vm.save.sharkBestScores[lockedTrialShark.id], "Trial must never record best score for locked trial shark")
        XCTAssertNil(vm.save.sharkMasteryTiers[lockedTrialShark.id], "Trial must never unlock crown tier for locked trial shark")
        XCTAssertEqual(vm.save.bankedCoins, coinsBeforeSettlement, "Trial must award 0 Crown coins")
        XCTAssertEqual(vm.save.bankedGenes, genesBeforeSettlement, "Trial must award 0 Crown genes")

        // DOUBLE_SETTLEMENT must be strictly blocked on Trial runs
        vm.grantAdReward(for: .DOUBLE_SETTLEMENT)
        XCTAssertFalse(vm.settlementDoubled, "Trial run must block DOUBLE_SETTLEMENT")
        XCTAssertEqual(vm.save.bankedCoins, coinsBeforeSettlement)
        XCTAssertEqual(vm.save.bankedGenes, genesBeforeSettlement)

        // Normal run works as expected: increments totalRuns, claims Mastery once, allows DOUBLE_SETTLEMENT once for >0 earnings, blocks 0-earning empty floor
        vm.startNewRun(trialSharkId: nil)
        XCTAssertEqual(vm.save.totalRuns, 1)
        XCTAssertTrue(vm.isEligibleForPermanentProgress)

        // Empty 0-earning run must NOT trigger +30C / +5G fake floor
        vm.runCoinsEarned = 0
        vm.runGenesEarned = 0
        vm.triggerGameOver()
        vm.declineRevive()
        vm.grantAdReward(for: .DOUBLE_SETTLEMENT)
        XCTAssertFalse(vm.settlementDoubled, "Zero-earning run must not claim empty floor DOUBLE_SETTLEMENT")

        // Positive normal run settles Crown once & doubles actual earned coins/genes once
        vm.startNewRun(trialSharkId: nil)
        XCTAssertEqual(vm.save.totalRuns, 2)
        let starterForm = GameConfigGenerated.sharkForms[0]
        let starterGold = GameRules.getSharkMasteryConfig(form: starterForm).tiers[2].targetScore
        vm.score = starterGold + 500
        vm.runCoinsEarned = 250
        vm.runGenesEarned = 18
        let preNormalCoins = vm.save.bankedCoins
        let preNormalGenes = vm.save.bankedGenes

        vm.triggerGameOver()
        vm.declineRevive()
        let settledCoins = vm.lastMasterySettlement?.totalBonusCoins ?? 0
        let settledGenes = vm.lastMasterySettlement?.totalBonusGenes ?? 0
        XCTAssertGreaterThan(settledCoins, 0)
        XCTAssertGreaterThan(settledGenes, 0)
        XCTAssertEqual(vm.save.sharkMasteryTiers[starterForm.id], 3)

        // Duplicate finalizeRunSettlement call in same run must not double-grant
        vm.finalizeRunSettlement()
        XCTAssertEqual(vm.save.bankedCoins, preNormalCoins + settledCoins)
        XCTAssertEqual(vm.save.bankedGenes, preNormalGenes + settledGenes)

        // DOUBLE_SETTLEMENT doubles exact runCoinsEarned / runGenesEarned once
        vm.grantAdReward(for: .DOUBLE_SETTLEMENT)
        XCTAssertTrue(vm.settlementDoubled)
        XCTAssertEqual(vm.save.bankedCoins, preNormalCoins + settledCoins + 250)
        XCTAssertEqual(vm.save.bankedGenes, preNormalGenes + settledGenes + 18)

        vm.grantAdReward(for: .DOUBLE_SETTLEMENT)
        XCTAssertEqual(vm.save.bankedCoins, preNormalCoins + settledCoins + 250, "Duplicate DOUBLE_SETTLEMENT must not pay twice")
    }

    func testOnboardingOneTimeTopUpAndLegacySaveMigration() throws {
        var save = SharkMetaSaveData.createDefault()
        save.bankedCoins = 5
        XCTAssertTrue(GameRules.claimOnboardingStarterTopUp(save: &save))
        XCTAssertEqual(save.bankedCoins, 22, "First-time onboarding tops up to starter Lv.1 cost (22C)")
        XCTAssertTrue(save.onboardingGiftClaimed)

        // Even if player later unlocks high-tier shark and drops to 0 coins, replaying tutorial grants 0 coins
        save.bankedCoins = 0
        XCTAssertFalse(GameRules.claimOnboardingStarterTopUp(save: &save))
        XCTAssertEqual(save.bankedCoins, 0, "Replay onboarding must NEVER top up coins again")

        // Legacy v2 JSON save without onboardingGiftClaimed defaults to true if totalRuns > 0
        let legacyJson = """
        {
          "selectedSharkId": "shark_00_clown_fry",
          "unlockedSharkIds": ["shark_00_clown_fry"],
          "sharkUpgradeLevels": {"shark_00_clown_fry": 2},
          "bankedCoins": 10,
          "bankedGenes": 5,
          "bestInRunLevel": 3,
          "maxDepthReached": 200,
          "totalRuns": 2,
          "language": "zh",
          "soundEnabled": true
        }
        """.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(SharkMetaSaveData.self, from: legacyJson)
        XCTAssertTrue(decoded.onboardingGiftClaimed)
    }

    @MainActor
    func testPickupDeduplicationAndGoogleAdMobPersistenceAndMutex() {
        // 1. Pickup collision deduplication: collectIfEligible grants value once and nil on repeat
        let pickup = OceanGameScene.ActivePickup(
            isGene: false,
            value: 17,
            node: SKSpriteNode(),
            x: 0,
            y: 0,
            vx: 0,
            vy: 0
        )
        XCTAssertEqual(pickup.collectIfEligible(), 17)
        XCTAssertNil(pickup.collectIfEligible(), "Duplicate collision on same ActivePickup must return nil")

        // 1b. ActivePrey devour guard defaults to false and stays latched once marked devoured
        let preyCfg = GameConfigGenerated.preyTiers[0]
        let activePrey = OceanGameScene.ActivePrey(
            config: preyCfg,
            node: SKSpriteNode(),
            x: 0,
            y: 200,
            vx: 10,
            vy: 0,
            mutation: .NONE
        )
        XCTAssertFalse(activePrey.isDevoured)
        activePrey.isDevoured = true
        XCTAssertTrue(activePrey.isDevoured)

        // 2. GoogleAdMobManager persists cooldown & daily caps across process/instance restart
        let suiteName = "hs_test_admob_\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let now = Date()
        let mgr1 = GoogleAdMobManager(userDefaults: defaults, storageKey: "test_ad_freq")
        mgr1.recordRewardGranted(for: .SUPPLY_DROP, now: now)
        XCTAssertGreaterThan(mgr1.remainingCooldownSeconds(for: .SUPPLY_DROP, now: now.addingTimeInterval(5)), 0)
        XCTAssertEqual(mgr1.dailyGrantCount(for: .SUPPLY_DROP, now: now), 1)

        // Simulate app kill + fresh cold start with same UserDefaults
        let mgr2 = GoogleAdMobManager(userDefaults: defaults, storageKey: "test_ad_freq")
        XCTAssertGreaterThan(mgr2.remainingCooldownSeconds(for: .SUPPLY_DROP, now: now.addingTimeInterval(5)), 0, "Cooldown must survive app restart")
        XCTAssertEqual(mgr2.dailyGrantCount(for: .SUPPLY_DROP, now: now), 1, "Daily cap count must survive app restart")

        // 3. Concurrency mutex lock prevents overlapping showRewardedAd calls
        var secondRejected = false
        mgr2.showRewardedAd(
            kind: .TRIAL_SHARK,
            onReward: {},
            onUnavailable: {},
            onCooldown: { _ in }
        )
        if mgr2.isInFlight {
            mgr2.showRewardedAd(
                kind: .REVIVE,
                onReward: {},
                onUnavailable: { secondRejected = true },
                onCooldown: { _ in }
            )
            XCTAssertTrue(secondRejected, "Overlapping ad request while in-flight must be rejected immediately")
        }
    }

    @MainActor
    func testTask05DomainConfigsAndCrossPlatformParity() {
        // 1. D5-A Starter Save Defaults & #0 minRef=12 -> 32G full Lv.10
        let defSave = SharkMetaSaveData.createDefault()
        XCTAssertEqual(defSave.bankedCoins, 120)
        XCTAssertEqual(defSave.bankedGenes, 20)
        XCTAssertEqual(defSave.maxDepthReached, 200.0, accuracy: 0.001)

        let clown = GameConfigGenerated.sharkForms[0]
        XCTAssertEqual(
            GameRules.getSharkUpgradeGeneCost(form: clown, currentLevel: 4)
            + GameRules.getSharkUpgradeGeneCost(form: clown, currentLevel: 9),
            32
        )

        // 2. D7-1 (U-B) + D7-2 (Lv.15): Lv.5/Lv.10 body upgrades, 0 negative transitions, vertical parent unlock
        let lv1 = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: clown.id, upgradeLevel: 1)
        let lv3 = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: clown.id, upgradeLevel: 3)
        let lv5 = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: clown.id, upgradeLevel: 5)
        let lv10 = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: clown.id, upgradeLevel: 10)
        let lv10InRun12 = GameRules.computeEvolvedSharkStats(inRunLevel: 12, sharkFormId: clown.id, upgradeLevel: 10)
        XCTAssertEqual(lv3.biteTier, lv1.biteTier)
        XCTAssertEqual(lv5.biteTier, lv1.biteTier + 1)
        XCTAssertEqual(lv10.biteTier, lv1.biteTier + 2)
        XCTAssertEqual(lv10InRun12.biteTier, lv1.biteTier + 6)
        XCTAssertLessThanOrEqual(GameConfigGenerated.sharkForms.last!.reqMaxInRunLevel, 15)

        for i in 1..<GameConfigGenerated.sharkForms.count {
            let prev = GameConfigGenerated.sharkForms[i - 1]
            let cur = GameConfigGenerated.sharkForms[i]
            let prevStats = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: prev.id, upgradeLevel: cur.reqParentUpgradeLevel, unlockedCount: i)
            let curStats = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: cur.id, upgradeLevel: 1, unlockedCount: i + 1)
            XCTAssertGreaterThanOrEqual(curStats.normalBiteTier, prevStats.normalBiteTier)
            XCTAssertGreaterThanOrEqual(cur.baseHp, prev.baseHp)
        }

        // Vertical parent path: #16 Great White (Lv.5) unlocks #24 Megalodon
        var vertSave = SharkMetaSaveData.createDefault()
        vertSave.unlockedSharkIds.append("shark_16_great_white")
        vertSave.sharkUpgradeLevels["shark_16_great_white"] = 5
        vertSave.bestInRunLevel = 9
        vertSave.maxDepthReached = 850
        vertSave.bankedCoins = 5000
        vertSave.bankedGenes = 800
        let megaForm = GameConfigGenerated.sharkForms[24]
        let megaCheck = GameRules.evaluateSharkUnlock(form: megaForm, save: vertSave)
        XCTAssertTrue(megaCheck.canUnlockNow)
        XCTAssertEqual(megaCheck.parentForm?.id, "shark_16_great_white")

        // 3. D3-A Crowns Total (44,940C / 9,619G; G1~G3 11,238C / 2,659G) + Atlas Crown passives
        var crownTotalC = 0
        var crownTotalG = 0
        var g13CrownC = 0
        var g13CrownG = 0
        for form in GameConfigGenerated.sharkForms {
            let cfg = GameRules.getSharkMasteryConfig(form: form)
            let c = cfg.tiers.reduce(0) { $0 + $1.rewardCoins }
            let g = cfg.tiers.reduce(0) { $0 + $1.rewardGenes }
            crownTotalC += c
            crownTotalG += g
            if form.row <= 2 {
                g13CrownC += c
                g13CrownG += g
            }
        }
        XCTAssertEqual(crownTotalC, 44_940)
        XCTAssertEqual(crownTotalG, 9_619)
        XCTAssertEqual(g13CrownC, 11_238)
        XCTAssertEqual(g13CrownG, 2_659)

        var crownSave = SharkMetaSaveData.createDefault()
        crownSave.sharkMasteryTiers["shark_00_clown_fry"] = 3
        let crownAtlas = GameRules.getGlobalAtlasBonuses(save: crownSave)
        XCTAssertEqual(crownAtlas.scoreMultiplierBonus, 3.0 * 0.0035, accuracy: 0.0001)
        XCTAssertEqual(crownAtlas.hpMultiplier, 1.0 + 3.0 * 0.002, accuracy: 0.0001)
        XCTAssertEqual(crownAtlas.rewardMultiplier, 1.0, accuracy: 0.0001)

        // 4. D4-A 2-hit Boss/Behemoth Armor Crush vs 1-hit Normal + #28 reduction
        let t3Prey = GameConfigGenerated.preyTiers.first(where: { !$0.isHazard && !$0.isBoss && $0.tier == 3 })!
        let bossPrey = GameConfigGenerated.preyTiers.first(where: { $0.isBoss })!
        XCTAssertEqual(GameRules.getRequiredArmorHits(prey: t3Prey, mutationVariant: .NONE), 1)
        XCTAssertEqual(GameRules.getRequiredArmorHits(prey: t3Prey, mutationVariant: .ABYSS_BEHEMOTH), 2)
        XCTAssertEqual(GameRules.getRequiredArmorHits(prey: bossPrey, mutationVariant: .NONE), 2)
        let voidStats = GameRules.computeEvolvedSharkStats(inRunLevel: 1, sharkFormId: "shark_28_void_lightning", upgradeLevel: 1)
        XCTAssertEqual(voidStats.goldenMutantReduction, 1)

        // 5. D6-X Gene Pity Counter (T1..17: 30%/3 misses, T18+: 45%/2 misses)
        let lowPrey = GameConfigGenerated.preyTiers.first(where: { !$0.isHazard && !$0.isBoss && $0.tier <= 17 && $0.geneValue > 0 })!
        let highPrey = GameConfigGenerated.preyTiers.first(where: { !$0.isHazard && !$0.isBoss && $0.tier >= 18 && $0.geneValue > 0 })!
        let apexStats = GameRules.computeEvolvedSharkStats(inRunLevel: 15, sharkFormId: GameConfigGenerated.sharkForms.last!.id, upgradeLevel: 10)

        var pityLow = 0
        for _ in 0..<3 {
            let res = GameRules.computePredationSettlement(
                prey: lowPrey,
                sharkStats: apexStats,
                encounter: .DEVOUR,
                frenzyActive: false,
                isBoosting: false,
                mutationVariant: .NONE,
                globalDifficultyMultiplier: 1.0,
                comboScoreMultiplier: 1.0,
                genePityMissStreak: &pityLow,
                rng: { 0.99 }
            )
            XCTAssertEqual(res.geneGain, 0)
        }
        XCTAssertEqual(pityLow, 3)
        let lowGuaranteed = GameRules.computePredationSettlement(
            prey: lowPrey,
            sharkStats: apexStats,
            encounter: .DEVOUR,
            frenzyActive: false,
            isBoosting: false,
            mutationVariant: .NONE,
            globalDifficultyMultiplier: 1.0,
            comboScoreMultiplier: 1.0,
            genePityMissStreak: &pityLow,
            rng: { 0.99 }
        )
        XCTAssertGreaterThanOrEqual(lowGuaranteed.geneGain, 1)
        XCTAssertEqual(pityLow, 0)

        var pityHigh = 0
        for _ in 0..<2 {
            _ = GameRules.computePredationSettlement(
                prey: highPrey,
                sharkStats: apexStats,
                encounter: .DEVOUR,
                frenzyActive: false,
                isBoosting: false,
                mutationVariant: .NONE,
                globalDifficultyMultiplier: 1.0,
                comboScoreMultiplier: 1.0,
                genePityMissStreak: &pityHigh,
                rng: { 0.99 }
            )
        }
        XCTAssertEqual(pityHigh, 2)
        let highGuaranteed = GameRules.computePredationSettlement(
            prey: highPrey,
            sharkStats: apexStats,
            encounter: .DEVOUR,
            frenzyActive: false,
            isBoosting: false,
            mutationVariant: .NONE,
            globalDifficultyMultiplier: 1.0,
            comboScoreMultiplier: 1.0,
            genePityMissStreak: &pityHigh,
            rng: { 0.99 }
        )
        XCTAssertGreaterThanOrEqual(highGuaranteed.geneGain, 1)
        XCTAssertEqual(pityHigh, 0)

        // 6. D5-A Combo Heat + D8 Supply Drop Scaling + Trial Specs + Interstitial Starter Protection
        let heat4 = GameRules.computeHuntingHeatBuff(comboCount: 28)
        XCTAssertEqual(heat4.heatLevel, 4)
        XCTAssertEqual(heat4.scoreMultiplier, 1.45, accuracy: 0.001)
        XCTAssertEqual(heat4.magnetRadiusBonus, 80.0, accuracy: 0.001)
        XCTAssertEqual(heat4.energyRegenBonus, 10.0, accuracy: 0.001)

        XCTAssertEqual(DomainConfigs.supplyDropReward(forMaxUnlockedRow: 0).coins, 160)
        XCTAssertEqual(DomainConfigs.supplyDropReward(forMaxUnlockedRow: 5).coins, 16000)
        let trialForm = DomainConfigs.trialTargetSharkForm(unlockedSharkIds: ["shark_00_clown_fry"])
        XCTAssertEqual(trialForm.id, "shark_01_lemon_pup")

        let suiteName = "hs_test_task05_ad_\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let adMgr = GoogleAdMobManager(userDefaults: defaults, storageKey: "test_task05_ad")
        XCTAssertFalse(adMgr.canShowInterstitial(totalRunsCompleted: 2))
        XCTAssertTrue(adMgr.canShowInterstitial(totalRunsCompleted: 3))
    }
}
