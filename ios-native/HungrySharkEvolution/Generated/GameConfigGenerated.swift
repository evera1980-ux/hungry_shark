// ============================================================================
// CROSS-PLATFORM SHARED JSON DATA LOADER (Hand-Maintained Native Swift)
// Loads `game_data.json` exported from Web TypeScript single source of truth
// (`shared/game_data.json` -> `Resources/Assets/game_data.json`) via `npm run sync:ios`.
//
// IMPORTANT:
// - This file is NO LONGER overwritten by `scripts/build-ios-native.ts`.
// - Public API (`GameConfigGenerated`, `SharkFormConfig`, `PreyTierConfig`, etc.)
//   is preserved 100% identically for Core/Rendering/UI Swift modules.
// ============================================================================

import Foundation
import simd

public enum SharkLineageId: String, Codable, CaseIterable, Sendable {
    case APEX_BIO
    case CYBER_MECHA
    case ELEMENTAL_CORE
    case ELDER_ABYSS
}

public struct SharkLineageMeta: Codable, Sendable {
    public let id: SharkLineageId
    public let nameZh: String
    public let nameEn: String
    public let descZh: String
    public let descEn: String
    public let themeColorHex: String
}

public enum PreyBehavior: String, Codable, CaseIterable, Sendable {
    case DRIFT_SWARM
    case SCHOOL_FLEE
    case PUFFER_INFLATE
    case SUB_PATROL
    case EEL_CHARGER
    case MINE_HAZARD
    case HEAVY_CRUISER
    case KRAKEN_BOSS
}

public struct SharkFormConfig: Identifiable, Codable, Sendable, Equatable {
    public let index: Int
    public let row: Int
    public let col: Int
    public let generation: Int
    public let id: String
    public let spriteKey: String
    public let lineage: SharkLineageId
    public let nameZh: String
    public let nameEn: String
    public let titleZh: String
    public let titleEn: String
    public let traitZh: String
    public let traitEn: String
    public let primaryColorHex: String
    public let secondaryColorHex: String
    public let glowColorHex: String
    public let realBodyLengthM: Double
    public let cruiseSpeedMps: Double
    public let boostSpeedMps: Double
    public let baseBiteTier: Int
    public let baseHp: Double
    public let baseEnergy: Double
    public let speedBonus: Double
    public let hpDrainReduction: Double
    public let boostCostReduction: Double
    public let magnetBonus: Double
    public let devourHealMult: Double
    public let scoreMult: Double
    public let reqParentUpgradeLevel: Int
    public let reqMaxInRunLevel: Int
    public let reqMaxDepth: Double
    public let unlockCoins: Int
    public let unlockGenes: Int
    public let baseUpgradeCoinCost: Int
    public let normalizedBounds: SIMD4<Double>
}

public struct PreyTierConfig: Identifiable, Codable, Sendable {
    public let tier: Int
    public let id: String
    public let nameKey: String
    public let nameZh: String
    public let nameEn: String
    public let spriteKey: String
    public let sheetName: String
    public let minDepth: Double
    public let maxDepth: Double
    public let radius: Double
    public let baseSpeed: Double
    public let bodyLengthCm: Double
    public let minLengthCm: Double
    public let maxLengthCm: Double
    public let hpRestore: Double
    public let xpValue: Int
    public let scoreValue: Int
    public let geneValue: Int
    public let coinValue: Int
    public let damageOnFail: Double
    public let behavior: PreyBehavior
    public let primaryColorHex: String
    public let secondaryColorHex: String
    public let glowColorHex: String
    public let isHazard: Bool
    public let isBoss: Bool
    public let normalizedBounds: SIMD4<Double>
}

// MARK: - Internal JSON Decoding DTOs

private struct RawWorldConfig: Decodable {
    let baseSharkSpeed: Double
    let boostSpeedMultiplier: Double
    let baseHpDrainPerSec: Double
    let baseBoostDrainPerSec: Double
    let baseBoostRegenPerSec: Double
    let baseMagnetRadius: Double
    let baseBiteTier: Int
    let frenzyDuration: Double
}

private struct RawAdsConfig: Decodable {
    let googleAdMobAppId: String
    let googleAdMobRewardedAdUnitId: String
    let googleAdMobBackupRewardedAdUnitId: String
    let googleH5ClientId: String
    let imaVastTagUrl: String
    let fallbackVideoStreamUrl: String
}

private struct RawI18nBundle: Decodable {
    let zh: [String: String]
    let en: [String: String]
}

private struct RawSharedGameDataPayload: Decodable {
    let schemaVersion: Int
    let world: RawWorldConfig
    let ads: RawAdsConfig
    let lineageMeta: [String: SharkLineageMeta]
    let sharkForms: [SharkFormConfig]
    let preyTiers: [PreyTierConfig]
    let uiIconGridMap: [String: [Int]]
    let uiBannerBounds: [String: [Double]]
    let uiSettingBounds: [String: [Double]]
    let i18n: RawI18nBundle
}

private struct LoadedSharedGameData: Sendable {
    let schemaVersion: Int
    let baseSharkSpeed: Double
    let boostSpeedMultiplier: Double
    let baseHpDrainPerSec: Double
    let baseBoostDrainPerSec: Double
    let baseBoostRegenPerSec: Double
    let baseMagnetRadius: Double
    let baseBiteTier: Int
    let frenzyDuration: Double
    let googleAdMobAppId: String
    let googleAdMobRewardedAdUnitId: String
    let googleAdMobBackupRewardedAdUnitId: String
    let googleH5ClientId: String
    let imaVastTagUrl: String
    let fallbackVideoStreamUrl: String
    let sharkForms: [SharkFormConfig]
    let lineageMeta: [SharkLineageId: SharkLineageMeta]
    let preyTiers: [PreyTierConfig]
    let uiIconGridMap: [String: SIMD2<Int>]
    let uiBannerBounds: [String: SIMD4<Double>]
    let uiSettingBounds: [String: SIMD4<Double>]
    let i18nZh: [String: String]
    let i18nEn: [String: String]
}

private func decodeSIMD2Int(_ values: [Int]) -> SIMD2<Int> {
    guard values.count >= 2 else { return SIMD2<Int>(0, 0) }
    return SIMD2<Int>(values[0], values[1])
}

private func decodeSIMD4Double(_ values: [Double]) -> SIMD4<Double> {
    guard values.count >= 4 else { return SIMD4<Double>(0, 0, 1, 1) }
    return SIMD4<Double>(values[0], values[1], values[2], values[3])
}

private func locateBundledGameDataURL() -> URL {
    #if SWIFT_PACKAGE
    if let url = Bundle.module.url(forResource: "game_data", withExtension: "json", subdirectory: "Assets") {
        return url
    }
    if let url = Bundle.module.url(forResource: "game_data", withExtension: "json") {
        return url
    }
    #endif
    if let url = Bundle.main.url(forResource: "game_data", withExtension: "json", subdirectory: "Assets") {
        return url
    }
    if let url = Bundle.main.url(forResource: "game_data", withExtension: "json") {
        return url
    }
    if let url = Bundle.main.url(forResource: "game_data", withExtension: "json", subdirectory: "Resources/Assets") {
        return url
    }
    fatalError("[GameConfigGenerated] Missing bundled game_data.json. Run `npm run sync:ios` (or `npm run build:ios`) to sync shared/game_data.json into Resources/Assets/.")
}

private func loadSharedGameData() -> LoadedSharedGameData {
    let url = locateBundledGameDataURL()
    do {
        let rawData = try Data(contentsOf: url)
        let decoded = try JSONDecoder().decode(RawSharedGameDataPayload.self, from: rawData)

        var parsedLineageMeta: [SharkLineageId: SharkLineageMeta] = [:]
        parsedLineageMeta.reserveCapacity(decoded.lineageMeta.count)
        for (rawKey, meta) in decoded.lineageMeta {
            if let lineageId = SharkLineageId(rawValue: rawKey) {
                parsedLineageMeta[lineageId] = meta
            }
        }

        let parsedUiIcons = decoded.uiIconGridMap.mapValues(decodeSIMD2Int)
        let parsedUiBanners = decoded.uiBannerBounds.mapValues(decodeSIMD4Double)
        let parsedUiSettings = decoded.uiSettingBounds.mapValues(decodeSIMD4Double)

        return LoadedSharedGameData(
            schemaVersion: decoded.schemaVersion,
            baseSharkSpeed: decoded.world.baseSharkSpeed,
            boostSpeedMultiplier: decoded.world.boostSpeedMultiplier,
            baseHpDrainPerSec: decoded.world.baseHpDrainPerSec,
            baseBoostDrainPerSec: decoded.world.baseBoostDrainPerSec,
            baseBoostRegenPerSec: decoded.world.baseBoostRegenPerSec,
            baseMagnetRadius: decoded.world.baseMagnetRadius,
            baseBiteTier: decoded.world.baseBiteTier,
            frenzyDuration: decoded.world.frenzyDuration,
            googleAdMobAppId: decoded.ads.googleAdMobAppId,
            googleAdMobRewardedAdUnitId: decoded.ads.googleAdMobRewardedAdUnitId,
            googleAdMobBackupRewardedAdUnitId: decoded.ads.googleAdMobBackupRewardedAdUnitId,
            googleH5ClientId: decoded.ads.googleH5ClientId,
            imaVastTagUrl: decoded.ads.imaVastTagUrl,
            fallbackVideoStreamUrl: decoded.ads.fallbackVideoStreamUrl,
            sharkForms: decoded.sharkForms,
            lineageMeta: parsedLineageMeta,
            preyTiers: decoded.preyTiers,
            uiIconGridMap: parsedUiIcons,
            uiBannerBounds: parsedUiBanners,
            uiSettingBounds: parsedUiSettings,
            i18nZh: decoded.i18n.zh,
            i18nEn: decoded.i18n.en
        )
    } catch {
        fatalError("[GameConfigGenerated] Failed to decode game_data.json at \(url.path): \(error)")
    }
}

public enum GameConfigGenerated {
    private static let data: LoadedSharedGameData = loadSharedGameData()

    public static let schemaVersion: Int = data.schemaVersion

    public static let baseSharkSpeed: Double = data.baseSharkSpeed
    public static let boostSpeedMultiplier: Double = data.boostSpeedMultiplier
    public static let baseHpDrainPerSec: Double = data.baseHpDrainPerSec
    public static let baseBoostDrainPerSec: Double = data.baseBoostDrainPerSec
    public static let baseBoostRegenPerSec: Double = data.baseBoostRegenPerSec
    public static let baseMagnetRadius: Double = data.baseMagnetRadius
    public static let baseBiteTier: Int = data.baseBiteTier
    public static let frenzyDuration: Double = data.frenzyDuration

    // Google AdMob & H5 Games Ads Identifiers
    public static let googleAdMobAppId: String = data.googleAdMobAppId
    public static let googleAdMobRewardedAdUnitId: String = data.googleAdMobRewardedAdUnitId
    public static let googleAdMobBackupRewardedAdUnitId: String = data.googleAdMobBackupRewardedAdUnitId
    public static let googleH5ClientId: String = data.googleH5ClientId
    public static let imaVastTagUrl: String = data.imaVastTagUrl
    public static let fallbackVideoStreamUrl: String = data.fallbackVideoStreamUrl

    public static let sharkForms: [SharkFormConfig] = data.sharkForms
    public static let lineageMeta: [SharkLineageId: SharkLineageMeta] = data.lineageMeta
    public static let preyTiers: [PreyTierConfig] = data.preyTiers

    public static let uiIconGridMap: [String: SIMD2<Int>] = data.uiIconGridMap
    public static let uiBannerBounds: [String: SIMD4<Double>] = data.uiBannerBounds
    public static let uiSettingBounds: [String: SIMD4<Double>] = data.uiSettingBounds

    public static let i18nZh: [String: String] = data.i18nZh
    public static let i18nEn: [String: String] = data.i18nEn
}
