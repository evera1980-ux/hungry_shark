import UIKit
import SpriteKit
import CoreGraphics
import SwiftUI

public struct AvatarBarHollowMetrics: Sendable {
    public let cxPct: CGFloat
    public let cyPct: CGFloat
    public let innerDiaPctH: CGFloat
    public let outerDiaPctH: CGFloat
    public let aspectRatio: CGFloat
}

/// Pure Native CoreGraphics Offscreen Sprite Sheet Processor & Texture Cache
/// Performs perimeter BFS flood-fill + Color-to-Alpha boundary unmixing on the 4K shark atlas,
/// prey sheets, 6x4 UI icon sheet, banner button sheet (buttons_16e3a0cf), setting modal sheet (setting_83a7a273),
/// and ocean parallax layers on a background Task.detached thread with zero main-thread blocking.
@MainActor
public final class SpriteAtlasManager: ObservableObject {
    public static let shared = SpriteAtlasManager()

    @Published public private(set) var loadingProgress: Double = 0.0
    @Published public private(set) var loadingStageZh: String = "正在潜入深海基因库..."
    @Published public private(set) var loadingStageEn: String = "Diving into Abyssal Gene Bank..."
    @Published public private(set) var isReady: Bool = false
    @Published public private(set) var atlasRevision: Int = 0

    private var sharkTextures: [String: SKTexture] = [:]
    private var sharkLastUsedTick: [String: UInt64] = [:]
    private let sharkUIImageCache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 14
        return cache
    }()

    private var preyTextures: [String: SKTexture] = [:]
    private var preyLastUsedTick: [String: UInt64] = [:]
    private let preyUIImageCache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 18
        return cache
    }()

    private var uiIconImages: [String: UIImage] = [:]
    private var uiIconTextures: [String: SKTexture] = [:]
    private var uiBannerImages: [String: UIImage] = [:]
    private var uiSettingImages: [String: UIImage] = [:]
    private var uiSettingIconImages: [String: UIImage] = [:]
    private var oceanLayerTextures: [String: SKTexture] = [:]
    private var seabedStripTextures: [String: SKTexture] = [:]
    private var seabedSubStratumTextures: [String: SKTexture] = [:]
    private var ecologySpriteTextures: [String: SKTexture] = [:]
    private var poiSpriteTextures: [String: SKTexture] = [:]
    private var cavePortalShadowTex: SKTexture?

    private var cachedLoadingBg: UIImage?
    private var cachedLoadingLogo: UIImage?
    private var cachedLoadingMascot: UIImage?

    private var accessTick: UInt64 = 0
    private let maxResidentSharkTextures: Int = 8
    private let maxResidentPreyTextures: Int = 52
    private var activePrewarmDepthBand: Int = -1
    private var prewarmingPreyKeys: Set<String> = []
    private var prewarmingSharkKeys: Set<String> = []
    private var pinnedSharkKeys: Set<String> = []

    private var isPreloaded = false
    private var isPreloading = false

    public private(set) var avatarBarHollowMetrics = AvatarBarHollowMetrics(
        cxPct: 23.0,
        cyPct: 48.0,
        innerDiaPctH: 48.0,
        outerDiaPctH: 60.0,
        aspectRatio: 2.85
    )

    private init() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.handleMemoryWarning()
            }
        }
    }

    /// Releases cold CPU/GPU texture caches on iOS memory pressure (`didReceiveMemoryWarningNotification`).
    public func handleMemoryWarning() {
        sharkUIImageCache.removeAllObjects()
        preyUIImageCache.removeAllObjects()
        releaseStartupLoadingImages()
        evictColdSharkTextures(targetCount: 3)
        evictColdPreyTextures(targetCount: 22)
    }

    /// Releases the 3 full-resolution launch loading images once the ocean scene is visible.
    public func releaseStartupLoadingImages() {
        cachedLoadingBg = nil
        cachedLoadingLogo = nil
        cachedLoadingMascot = nil
    }

    private func evictColdSharkTextures(targetCount: Int) {
        guard sharkTextures.count > targetCount else { return }
        let candidates = sharkTextures.keys
            .filter { !pinnedSharkKeys.contains($0) }
            .sorted { (sharkLastUsedTick[$0] ?? 0) < (sharkLastUsedTick[$1] ?? 0) }
        var toDrop = sharkTextures.count - targetCount
        for key in candidates where toDrop > 0 {
            sharkTextures.removeValue(forKey: key)
            sharkLastUsedTick.removeValue(forKey: key)
            toDrop -= 1
        }
    }

    private func evictColdPreyTextures(targetCount: Int) {
        guard preyTextures.count > targetCount else { return }
        let candidates = preyTextures.keys
            .sorted { (preyLastUsedTick[$0] ?? 0) < (preyLastUsedTick[$1] ?? 0) }
        var toDrop = preyTextures.count - targetCount
        for key in candidates where toDrop > 0 {
            preyTextures.removeValue(forKey: key)
            preyLastUsedTick.removeValue(forKey: key)
            toDrop -= 1
        }
    }

    // MARK: - Scheme A Hot-Replaceable Startup Loading Assets (Instant, Zero Atlas Wait)
    /// Convention: Replace `loading_background.png`, `loading_logo.png`, or `loading_mascot.png` in Resources/Assets
    /// to reskin holiday/festival loading screens without modifying any Swift code.
    public func loadingBackgroundImage() -> UIImage? {
        if let cached = cachedLoadingBg { return cached }
        let img = Self.loadBundledImage(named: "loading_background")
        cachedLoadingBg = img
        return img
    }

    public func loadingLogoImage() -> UIImage? {
        if let cached = cachedLoadingLogo { return cached }
        let img = Self.loadBundledImage(named: "loading_logo") ?? titleLogoImage()
        cachedLoadingLogo = img
        return img
    }

    public func loadingMascotImage() -> UIImage? {
        if let cached = cachedLoadingMascot { return cached }
        if let raw = Self.loadBundledImage(named: "loading_mascot") ?? Self.loadBundledImage(named: "shark_form_00@3x"),
           let cg = raw.cgImage {
            let img = UIImage(cgImage: cg, scale: 3.0, orientation: .up)
            cachedLoadingMascot = img
            return img
        }
        return nil
    }

    /// Launches lightweight, OOM-safe asynchronous startup decoding & Metal GPU warm-up (iOS-P0-3).
    /// Startup ONLY loads UI sheets, seabed/water canopies, active shark window (current + next evolution),
    /// and shallow-band prey (`minDepth <= 2200`). Remaining sharks & deeper ocean bands load on-demand.
    public func startAsyncPreloadIfNeeded(initialSharkId: String? = nil) {
        if isPreloaded {
            if !isReady { isReady = true }
            return
        }
        guard !isPreloading else { return }
        isPreloading = true
        loadingProgress = 0.05
        loadingStageZh = "正在唤醒出战巨鲨..."
        loadingStageEn = "Awakening Active Shark..."

        let allForms = GameConfigGenerated.sharkForms
        let activeIdx = allForms.firstIndex(where: { $0.id == initialSharkId }) ?? 0
        var startupFormIndices = Set<Int>([0, activeIdx])
        if activeIdx + 1 < allForms.count { startupFormIndices.insert(activeIdx + 1) }
        let startupForms = startupFormIndices.sorted().map { allForms[$0] }
        pinnedSharkKeys = Set(startupForms.map { $0.spriteKey })

        // Shallow band prey only (`minDepth <= 2200`) — keeps cold-start RAM & VRAM minimal.
        let shallowPreys = GameConfigGenerated.preyTiers.filter { $0.minDepth <= 2200.0 }

        Task.detached(priority: .userInitiated) {
            // Stage 1 (0.05 -> 0.24): Decode Active Shark Window (2-3 sharks instead of all 48)
            var localSharkUI: [String: UIImage] = [:]
            var localSharkTex: [String: SKTexture] = [:]
            for (idx, form) in startupForms.enumerated() {
                if let img3x = Self.decodeShark3xImage(for: form) {
                    localSharkUI[form.spriteKey] = img3x
                    let tex = SKTexture(image: img3x)
                    tex.filteringMode = .linear
                    localSharkTex[form.spriteKey] = tex
                }
                let prog = 0.05 + (Double(idx + 1) / Double(max(1, startupForms.count))) * 0.19
                await MainActor.run {
                    self.loadingProgress = max(self.loadingProgress, prog)
                }
            }

            let committedSharkUI = localSharkUI
            let committedSharkTex = localSharkTex
            await MainActor.run {
                for (k, img) in committedSharkUI {
                    self.sharkUIImageCache.setObject(img, forKey: k as NSString)
                }
                for (k, tex) in committedSharkTex {
                    self.accessTick &+= 1
                    self.sharkTextures[k] = tex
                    self.sharkLastUsedTick[k] = self.accessTick
                }
                self.atlasRevision &+= 1
                self.loadingProgress = 0.25
                self.loadingStageZh = "正在演化浅海生态鱼群..."
                self.loadingStageEn = "Spawning Shallow Reef Ecosystem..."
            }

            // Stage 2 (0.25 -> 0.48): Decode Shallow-Band Prey Only (deep bands warm asynchronously on dive)
            var localPreyTex: [String: SKTexture] = [:]
            let totalShallow = max(1, shallowPreys.count)
            for (idx, prey) in shallowPreys.enumerated() {
                if localPreyTex[prey.spriteKey] != nil { continue }
                if let img3x = Self.decodePrey3xImage(for: prey) {
                    let tex = SKTexture(image: img3x)
                    tex.filteringMode = .linear
                    localPreyTex[prey.spriteKey] = tex
                }
                if idx % 6 == 5 || idx == totalShallow - 1 {
                    let prog = 0.25 + (Double(idx + 1) / Double(totalShallow)) * 0.23
                    await MainActor.run {
                        self.loadingProgress = max(self.loadingProgress, prog)
                    }
                }
            }

            let committedPreyTex = localPreyTex
            await MainActor.run {
                for (k, tex) in committedPreyTex {
                    self.accessTick &+= 1
                    self.preyTextures[k] = tex
                    self.preyLastUsedTick[k] = self.accessTick
                }
                self.activePrewarmDepthBand = 0
                self.atlasRevision &+= 1
                self.loadingProgress = 0.49
                self.loadingStageZh = "正在校准深海声呐与装甲界面..."
                self.loadingStageEn = "Calibrating Sonar & HUD..."
            }

            // Stage 3 (0.49 -> 0.68): Slice UI Icon Sheet, Banner Sheet & Setting Sheet
            let localIcons: [String: UIImage]
            if let iconSheet = Self.loadBundledImage(named: "icons_f5128c12") {
                localIcons = Self.sliceUiIconSheet(iconSheet)
            } else {
                localIcons = [:]
            }
            var localUiIconTex: [String: SKTexture] = [:]
            for pickupKey in ["UI_ICON_COIN", "UI_ICON_GENE"] {
                if let img = localIcons[pickupKey] {
                    let tex = SKTexture(image: img)
                    tex.filteringMode = .linear
                    localUiIconTex[pickupKey] = tex
                }
            }
            let committedUiIconTex = localUiIconTex
            await MainActor.run {
                self.uiIconImages.merge(localIcons) { _, new in new }
                self.uiIconTextures.merge(committedUiIconTex) { _, new in new }
                self.atlasRevision &+= 1
                self.loadingProgress = 0.56
            }

            let bannerResult: (images: [String: UIImage], metrics: AvatarBarHollowMetrics?)
            if let bannerSheet = Self.loadBundledImage(named: "buttons_16e3a0cf") {
                bannerResult = Self.sliceUiBannerSheet(bannerSheet)
            } else {
                bannerResult = ([:], nil)
            }
            await MainActor.run {
                self.uiBannerImages.merge(bannerResult.images) { _, new in new }
                if let m = bannerResult.metrics {
                    self.avatarBarHollowMetrics = m
                }
                self.atlasRevision &+= 1
                self.loadingProgress = 0.62
            }

            let settingResult: (images: [String: UIImage], icons: [String: UIImage])
            if let settingSheet = Self.loadBundledImage(named: "setting_83a7a273") {
                settingResult = Self.sliceUiSettingSheet(settingSheet)
            } else {
                settingResult = ([:], [:])
            }
            await MainActor.run {
                self.uiSettingImages.merge(settingResult.images) { _, new in new }
                self.uiSettingIconImages.merge(settingResult.icons) { _, new in new }
                self.atlasRevision &+= 1
                self.loadingProgress = 0.68
                self.loadingStageZh = "正在构建 9 阶深海海床与珊瑚地貌..."
                self.loadingStageEn = "Building 9-Tier Seabed & Coral Reefs..."
            }

            // Stage 4 (0.68 -> 0.93): Process Water Canopies + World Seabed Strips + Subsurface Bedrock Strata + Ecology & POI Atlases
            let waterCanopies: [String] = [
                "bg_shallow_0_water_0e65cb68",
                "bg_twilight_0_17bcb84c",
                "bg_abyss_0_1bbf506a"
            ]
            var localOceanTex: [String: SKTexture] = [:]
            for (idx, waterName) in waterCanopies.enumerated() {
                if let rawImg = Self.loadBundledImage(named: waterName) {
                    let processed = Self.processWaterLayerToSeamlessTile(rawImg, assetName: waterName) ?? rawImg
                    let tex = SKTexture(image: processed)
                    tex.filteringMode = .linear
                    localOceanTex[waterName] = tex
                }
                let prog = 0.68 + (Double(idx + 1) / Double(waterCanopies.count)) * 0.08
                let partialOcean = localOceanTex
                await MainActor.run {
                    self.oceanLayerTextures.merge(partialOcean) { _, new in new }
                    self.loadingProgress = max(self.loadingProgress, prog)
                }
            }

            var localSeabedStrips: [String: SKTexture] = [:]
            var localSeabedSubStrata: [String: SKTexture] = [:]
            let standaloneSeabedDefs: [(id: String, assetName: String)] = [
                ("coral_reef", "seabed_strip_coral_reef"),
                ("rocky_shelf", "seabed_strip_rocky_shelf"),
                ("underwater_canyon", "seabed_strip_underwater_canyon"),
                ("deep_abyss", "seabed_strip_deep_abyss")
            ]
            for def in standaloneSeabedDefs {
                if let standaloneImg = Self.loadBundledImage(named: def.assetName) {
                    if let stripImg = Self.sliceSeabedStrip(from: standaloneImg, y0Ratio: 0.0, y1Ratio: 1.0) {
                        let tex = SKTexture(image: stripImg)
                        tex.filteringMode = .linear
                        localSeabedStrips[def.id] = tex
                    }
                    if let subImg = Self.sliceSeabedSubStratum(from: standaloneImg, stripId: def.id, y0Ratio: 0.0, y1Ratio: 1.0) {
                        let subTex = SKTexture(image: subImg)
                        subTex.filteringMode = .linear
                        localSeabedSubStrata[def.id] = subTex
                    }
                }
            }
            let committedStrips = localSeabedStrips
            let committedSubStrata = localSeabedSubStrata
            await MainActor.run {
                self.seabedStripTextures.merge(committedStrips) { _, new in new }
                self.seabedSubStratumTextures.merge(committedSubStrata) { _, new in new }
                self.atlasRevision &+= 1
                self.loadingProgress = max(self.loadingProgress, 0.84)
            }

            var localEcologyTex: [String: SKTexture] = [:]
            if let ecoSheet = Self.loadBundledImage(named: "world_ecology_atlas_1794473252524") {
                localEcologyTex = Self.sliceWorldEcologyAtlas(from: ecoSheet)
            }
            let standaloneEcologyDefs: [(prefix: String, assetName: String, removeSmoke: Bool)] = [
                ("coral", "ecology_coral_reef_cluster", false),
                ("rock", "ecology_rocky_outcrop", false),
                ("kelp", "ecology_kelp_forest_cluster", false),
                ("vent", "ecology_abyssal_vent_debris", true)
            ]
            for def in standaloneEcologyDefs {
                if let rawEcoImg = Self.loadBundledImage(named: def.assetName) {
                    let cleanedImg = Self.prepareStandaloneEcologyImage(from: rawEcoImg, removeTopWhiteSmoke: def.removeSmoke) ?? rawEcoImg
                    let tex = SKTexture(image: cleanedImg)
                    tex.filteringMode = .linear
                    localEcologyTex["\(def.prefix)_5"] = tex
                    localEcologyTex[def.prefix] = tex
                    for idx in 1...4 {
                        if localEcologyTex["\(def.prefix)_\(idx)"] == nil {
                            localEcologyTex["\(def.prefix)_\(idx)"] = tex
                        }
                    }
                }
            }
            var localPoiTex: [String: SKTexture] = [:]
            if let poiSheet = Self.loadBundledImage(named: "world_pois_atlas_1794473250443") {
                localPoiTex = Self.sliceWorldPoisAtlas(from: poiSheet)
            }
            let portalShadow = Self.makeCavePortalShadowTexture()
            let committedEco = localEcologyTex
            let committedPoi = localPoiTex
            await MainActor.run {
                self.ecologySpriteTextures.merge(committedEco) { _, new in new }
                self.poiSpriteTextures.merge(committedPoi) { _, new in new }
                self.cavePortalShadowTex = portalShadow
                self.atlasRevision &+= 1
                self.loadingProgress = max(self.loadingProgress, 0.93)
            }

            // Stage 5 (0.93 -> 1.00): Lightweight Metal GPU Preload (ONLY active startup working set)
            await MainActor.run {
                self.loadingProgress = 0.95
                self.loadingStageZh = "正在预热 Metal GPU 渲染管线..."
                self.loadingStageEn = "Warming Metal GPU Pipeline..."

                let startupGpuTextures = Array(self.sharkTextures.values)
                    + Array(self.preyTextures.values)
                    + Array(self.uiIconTextures.values)
                    + Array(self.oceanLayerTextures.values)
                    + Array(self.seabedStripTextures.values)
                    + Array(self.seabedSubStratumTextures.values)
                    + Array(self.ecologySpriteTextures.values)
                    + Array(self.poiSpriteTextures.values)

                SKTexture.preload(startupGpuTextures) {
                    Task { @MainActor in
                        self.loadingProgress = 1.0
                        self.loadingStageZh = "深海猎场已就绪！"
                        self.loadingStageEn = "Abyssal Hunting Grounds Ready!"
                        self.isPreloaded = true
                        self.isPreloading = false
                        self.atlasRevision &+= 1
                        try? await Task.sleep(nanoseconds: 120_000_000)
                        withAnimation(.easeInOut(duration: 0.42)) {
                            self.isReady = true
                            self.atlasRevision &+= 1
                        }
                        try? await Task.sleep(nanoseconds: 500_000_000)
                        self.releaseStartupLoadingImages()
                    }
                }
            }
        }
    }

    public func preloadAllIfNeeded() {
        startAsyncPreloadIfNeeded()
    }

    nonisolated private static func decodeShark3xImage(for form: SharkFormConfig) -> UIImage? {
        let baseName = String(format: "shark_form_%02d", form.index)
        guard let rawImg = Self.loadBundledImage(named: "\(baseName)@3x") ?? Self.loadBundledImage(named: baseName),
              let cg = rawImg.cgImage else { return nil }
        return UIImage(cgImage: cg, scale: 3.0, orientation: .up)
    }

    nonisolated private static func decodePrey3xImage(for prey: PreyTierConfig) -> UIImage? {
        guard let raw3x = Self.loadBundledImage(named: "\(prey.id)@3x")
            ?? Self.loadBundledImage(named: prey.id)
            ?? Self.loadBundledImage(named: "prey_\(prey.id)@3x")
            ?? Self.loadBundledImage(named: "prey_\(prey.id)"),
              let cg3x = raw3x.cgImage else { return nil }
        return UIImage(cgImage: cg3x, scale: 3.0, orientation: .up)
    }

    /// Asynchronously pre-decodes the active shark and its next evolution target off the main thread.
    public func prewarmSharkWindow(selectedSharkId: String) {
        let allForms = GameConfigGenerated.sharkForms
        guard let idx = allForms.firstIndex(where: { $0.id == selectedSharkId }) else { return }
        var windowForms: [SharkFormConfig] = [allForms[idx]]
        if idx + 1 < allForms.count { windowForms.append(allForms[idx + 1]) }
        pinnedSharkKeys = Set(windowForms.map { $0.spriteKey })

        let toLoad = windowForms.filter {
            sharkTextures[$0.spriteKey] == nil && !prewarmingSharkKeys.contains($0.spriteKey)
        }
        guard !toLoad.isEmpty else { return }
        for f in toLoad { prewarmingSharkKeys.insert(f.spriteKey) }

        Task.detached(priority: .utility) {
            var decoded: [(String, UIImage, SKTexture)] = []
            for form in toLoad {
                if let img3x = Self.decodeShark3xImage(for: form) {
                    let tex = SKTexture(image: img3x)
                    tex.filteringMode = .linear
                    decoded.append((form.spriteKey, img3x, tex))
                }
            }
            let finished = decoded
            await MainActor.run {
                for f in toLoad { self.prewarmingSharkKeys.remove(f.spriteKey) }
                for (k, img, tex) in finished {
                    self.accessTick &+= 1
                    self.sharkTextures[k] = tex
                    self.sharkLastUsedTick[k] = self.accessTick
                    self.sharkUIImageCache.setObject(img, forKey: k as NSString)
                }
                self.evictColdSharkTextures(targetCount: self.maxResidentSharkTextures)
                if !finished.isEmpty {
                    self.atlasRevision &+= 1
                }
            }
        }
    }

    /// Asynchronously pre-decodes prey textures for the shark's current depth band (~2000px band stride)
    /// and evicts cold distant-band GPU textures so memory footprint stays bounded.
    public func prewarmDepthBandIfNeeded(worldY: Double) {
        let bandIdx = max(0, Int(floor(worldY / 2000.0)))
        guard bandIdx != activePrewarmDepthBand else { return }
        activePrewarmDepthBand = bandIdx

        let minY = max(0.0, Double(bandIdx) * 2000.0 - 900.0)
        let maxY = Double(bandIdx + 1) * 2000.0 + 1400.0
        let candidates = GameConfigGenerated.preyTiers.filter { p in
            p.maxDepth >= minY && p.minDepth <= maxY
                && preyTextures[p.spriteKey] == nil
                && !prewarmingPreyKeys.contains(p.spriteKey)
        }
        guard !candidates.isEmpty else { return }
        for p in candidates { prewarmingPreyKeys.insert(p.spriteKey) }

        Task.detached(priority: .utility) {
            var decoded: [(String, SKTexture)] = []
            for prey in candidates {
                if let img3x = Self.decodePrey3xImage(for: prey) {
                    let tex = SKTexture(image: img3x)
                    tex.filteringMode = .linear
                    decoded.append((prey.spriteKey, tex))
                }
            }
            let finished = decoded
            await MainActor.run {
                for p in candidates { self.prewarmingPreyKeys.remove(p.spriteKey) }
                for (k, tex) in finished {
                    self.accessTick &+= 1
                    self.preyTextures[k] = tex
                    self.preyLastUsedTick[k] = self.accessTick
                }
                self.evictColdPreyTextures(targetCount: self.maxResidentPreyTextures)
            }
        }
    }

    /// Fast single-shark on-demand loader (<1ms) with bounded GPU LRU cache.
    private func loadSingleSharkOnDemand(for spriteKey: String) {
        guard let form = GameConfigGenerated.sharkForms.first(where: { $0.id == spriteKey || $0.spriteKey == spriteKey }) else { return }
        if let img3x = Self.decodeShark3xImage(for: form) {
            sharkUIImageCache.setObject(img3x, forKey: form.spriteKey as NSString)
            if sharkTextures[form.spriteKey] == nil {
                let tex = SKTexture(image: img3x)
                tex.filteringMode = .linear
                accessTick &+= 1
                sharkTextures[form.spriteKey] = tex
                sharkLastUsedTick[form.spriteKey] = accessTick
                evictColdSharkTextures(targetCount: maxResidentSharkTextures)
            }
        }
    }

    public func sharkTexture(for spriteKey: String) -> SKTexture? {
        if let tex = sharkTextures[spriteKey] {
            accessTick &+= 1
            sharkLastUsedTick[spriteKey] = accessTick
            return tex
        }
        loadSingleSharkOnDemand(for: spriteKey)
        return sharkTextures[spriteKey]
    }

    /// Returns a UIImage for HUD/Atlas previews via bounded `NSCache` (never pins all 48 sharks in RAM).
    public func sharkUIImage(for spriteKey: String) -> UIImage? {
        if let img = sharkUIImageCache.object(forKey: spriteKey as NSString) { return img }
        guard let form = GameConfigGenerated.sharkForms.first(where: { $0.id == spriteKey || $0.spriteKey == spriteKey }),
              let img3x = Self.decodeShark3xImage(for: form) else { return nil }
        sharkUIImageCache.setObject(img3x, forKey: form.spriteKey as NSString)
        return img3x
    }

    private func loadSinglePreyOnDemand(for spriteKey: String) {
        guard let prey = GameConfigGenerated.preyTiers.first(where: { $0.id == spriteKey || $0.spriteKey == spriteKey }) else { return }
        if let img3x = Self.decodePrey3xImage(for: prey) {
            let tex = SKTexture(image: img3x)
            tex.filteringMode = .linear
            accessTick &+= 1
            preyTextures[prey.spriteKey] = tex
            preyLastUsedTick[prey.spriteKey] = accessTick
            evictColdPreyTextures(targetCount: maxResidentPreyTextures)
        }
    }

    public func preyTexture(for spriteKey: String) -> SKTexture? {
        if let tex = preyTextures[spriteKey] {
            accessTick &+= 1
            preyLastUsedTick[spriteKey] = accessTick
            return tex
        }
        loadSinglePreyOnDemand(for: spriteKey)
        return preyTextures[spriteKey]
    }

    /// Returns a UIImage for bounty HUD badges via bounded `NSCache` (never pins all 135 prey bitmaps in RAM).
    public func preyUIImage(for spriteKey: String) -> UIImage? {
        if let img = preyUIImageCache.object(forKey: spriteKey as NSString) { return img }
        guard let prey = GameConfigGenerated.preyTiers.first(where: { $0.id == spriteKey || $0.spriteKey == spriteKey }),
              let img3x = Self.decodePrey3xImage(for: prey) else { return nil }
        preyUIImageCache.setObject(img3x, forKey: prey.spriteKey as NSString)
        return img3x
    }

    public func uiIconImage(for key: String) -> UIImage? {
        if let img = uiIconImages[key] { return img }
        if uiIconImages.isEmpty, let iconSheet = Self.loadBundledImage(named: "icons_f5128c12") {
            uiIconImages = Self.sliceUiIconSheet(iconSheet)
        }
        return uiIconImages[key]
    }

    /// Cached singleton `SKTexture` for UI icons (e.g. `UI_ICON_COIN`, `UI_ICON_GENE`) so pickup drops do 0 runtime texture uploads (iOS-P1-1).
    public func uiIconTexture(for key: String) -> SKTexture? {
        if let tex = uiIconTextures[key] { return tex }
        guard let img = uiIconImage(for: key) else { return nil }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        uiIconTextures[key] = tex
        return tex
    }

    public func uiBannerImage(for key: String) -> UIImage? {
        if let img = uiBannerImages[key] { return img }
        if uiBannerImages.isEmpty, let bannerSheet = Self.loadBundledImage(named: "buttons_16e3a0cf") {
            let result = Self.sliceUiBannerSheet(bannerSheet)
            uiBannerImages = result.images
            if let m = result.metrics {
                avatarBarHollowMetrics = m
            }
        }
        return uiBannerImages[key]
    }

    public func uiSettingImage(for key: String) -> UIImage? {
        if let img = uiSettingImages[key] { return img }
        if uiSettingImages.isEmpty, let settingSheet = Self.loadBundledImage(named: "setting_83a7a273") {
            let result = Self.sliceUiSettingSheet(settingSheet)
            uiSettingImages = result.images
            uiSettingIconImages = result.icons
        }
        return uiSettingImages[key]
    }

    public func uiSettingIconImage(for key: String) -> UIImage? {
        if let img = uiSettingIconImages[key] { return img }
        if uiSettingIconImages.isEmpty, let settingSheet = Self.loadBundledImage(named: "setting_83a7a273") {
            let result = Self.sliceUiSettingSheet(settingSheet)
            uiSettingImages = result.images
            uiSettingIconImages = result.icons
        }
        return uiSettingIconImages[key]
    }

    public func titleLogoImage() -> UIImage? {
        return Self.loadBundledImage(named: "title3_cae0290c")
    }

    public func oceanParallaxTexture(named assetName: String, isWaterCanopy: Bool = false) -> SKTexture? {
        if let tex = oceanLayerTextures[assetName] { return tex }
        if let rawImg = Self.loadBundledImage(named: assetName) {
            let processed = Self.processWaterLayerToSeamlessTile(rawImg, assetName: assetName) ?? rawImg
            let tex = SKTexture(image: processed)
            tex.filteringMode = .linear
            oceanLayerTextures[assetName] = tex
            return tex
        }
        return nil
    }

    private func loadSeabedTextureOnDemand(for stripId: String) {
        let assetMap: [String: String] = [
            "coral_reef": "seabed_strip_coral_reef",
            "rocky_shelf": "seabed_strip_rocky_shelf",
            "underwater_canyon": "seabed_strip_underwater_canyon",
            "deep_abyss": "seabed_strip_deep_abyss"
        ]
        guard let assetName = assetMap[stripId],
              let standaloneImg = Self.loadBundledImage(named: assetName) else { return }
        if seabedStripTextures[stripId] == nil,
           let stripImg = Self.sliceSeabedStrip(from: standaloneImg, y0Ratio: 0.0, y1Ratio: 1.0) {
            let tex = SKTexture(image: stripImg)
            tex.filteringMode = .linear
            seabedStripTextures[stripId] = tex
        }
        if seabedSubStratumTextures[stripId] == nil,
           let subImg = Self.sliceSeabedSubStratum(from: standaloneImg, stripId: stripId, y0Ratio: 0.0, y1Ratio: 1.0) {
            let subTex = SKTexture(image: subImg)
            subTex.filteringMode = .linear
            seabedSubStratumTextures[stripId] = subTex
        }
    }

    public func seabedStripTexture(for stripId: String) -> SKTexture? {
        if let tex = seabedStripTextures[stripId] { return tex }
        loadSeabedTextureOnDemand(for: stripId)
        if let tex = seabedStripTextures[stripId] { return tex }
        if seabedStripTextures["coral_reef"] == nil {
            loadSeabedTextureOnDemand(for: "coral_reef")
        }
        return seabedStripTextures["coral_reef"]
    }

    public func seabedSubStratumTexture(for stripId: String) -> SKTexture? {
        if let tex = seabedSubStratumTextures[stripId] { return tex }
        loadSeabedTextureOnDemand(for: stripId)
        if let tex = seabedSubStratumTextures[stripId] { return tex }
        if seabedSubStratumTextures["coral_reef"] == nil {
            loadSeabedTextureOnDemand(for: "coral_reef")
        }
        return seabedSubStratumTextures["coral_reef"]
    }

    public func ecologySpriteTexture(for id: String) -> SKTexture? {
        if let tex = ecologySpriteTextures[id] { return tex }
        if ecologySpriteTextures.isEmpty {
            if let ecoSheet = Self.loadBundledImage(named: "world_ecology_atlas_1794473252524") {
                ecologySpriteTextures = Self.sliceWorldEcologyAtlas(from: ecoSheet)
            }
            let standaloneEcologyDefs: [(prefix: String, assetName: String, removeSmoke: Bool)] = [
                ("coral", "ecology_coral_reef_cluster", false),
                ("rock", "ecology_rocky_outcrop", false),
                ("kelp", "ecology_kelp_forest_cluster", false),
                ("vent", "ecology_abyssal_vent_debris", true)
            ]
            for def in standaloneEcologyDefs {
                if let rawEcoImg = Self.loadBundledImage(named: def.assetName) {
                    let cleanedImg = Self.prepareStandaloneEcologyImage(from: rawEcoImg, removeTopWhiteSmoke: def.removeSmoke) ?? rawEcoImg
                    let tex = SKTexture(image: cleanedImg)
                    tex.filteringMode = .linear
                    ecologySpriteTextures["\(def.prefix)_5"] = tex
                    ecologySpriteTextures[def.prefix] = tex
                    for idx in 1...4 {
                        if ecologySpriteTextures["\(def.prefix)_\(idx)"] == nil {
                            ecologySpriteTextures["\(def.prefix)_\(idx)"] = tex
                        }
                    }
                }
            }
        }
        return ecologySpriteTextures[id]
    }

    public func poiSpriteTexture(for id: String) -> SKTexture? {
        if let tex = poiSpriteTextures[id] { return tex }
        if poiSpriteTextures.isEmpty,
           let poiSheet = Self.loadBundledImage(named: "world_pois_atlas_1794473250443") {
            poiSpriteTextures = Self.sliceWorldPoisAtlas(from: poiSheet)
        }
        return poiSpriteTextures[id]
    }

    public func cavePortalShadowTexture() -> SKTexture? {
        if let tex = cavePortalShadowTex { return tex }
        let tex = Self.makeCavePortalShadowTexture()
        cavePortalShadowTex = tex
        return tex
    }

    nonisolated private static func loadBundledImage(named name: String) -> UIImage? {
        var cleanBase = name
        if cleanBase.hasSuffix(".webp") {
            cleanBase = String(cleanBase.dropLast(5))
        } else if cleanBase.hasSuffix(".png") {
            cleanBase = String(cleanBase.dropLast(4))
        } else if cleanBase.hasSuffix(".jpg") {
            cleanBase = String(cleanBase.dropLast(4))
        } else if cleanBase.hasSuffix(".jpeg") {
            cleanBase = String(cleanBase.dropLast(5))
        }
        let baseWithoutScale: String
        if cleanBase.hasSuffix("@3x") || cleanBase.hasSuffix("@2x") {
            baseWithoutScale = String(cleanBase.dropLast(3))
        } else {
            baseWithoutScale = cleanBase
        }
        // iOS 16+ ImageIO natively decodes WebP (`UIImage(contentsOfFile:)`) — prefer compact WebP first.
        let exts = ["webp", "png", "jpg", "jpeg"]
        let roots: [URL] = [Bundle.main.resourceURL, Bundle.main.bundleURL].compactMap { $0 }
        let baseVariants = Array(NSOrderedSet(array: [cleanBase, "\(baseWithoutScale)@3x", baseWithoutScale])) as? [String] ?? [cleanBase]
        for root in roots {
            for ext in exts {
                for variant in baseVariants {
                    let candidates = [
                        root.appendingPathComponent("Assets/\(variant).\(ext)"),
                        root.appendingPathComponent("Resources/Assets/\(variant).\(ext)"),
                        root.appendingPathComponent("\(variant).\(ext)")
                    ]
                    for url in candidates {
                        if FileManager.default.fileExists(atPath: url.path),
                           let img = UIImage(contentsOfFile: url.path) {
                            return img
                        }
                    }
                }
            }
        }
        for ext in exts {
            for variant in baseVariants {
                if let path = Bundle.main.path(forResource: variant, ofType: ext),
                   let img = UIImage(contentsOfFile: path) {
                    return img
                }
                if let path = Bundle.main.path(forResource: variant, ofType: ext, inDirectory: "Assets"),
                   let img = UIImage(contentsOfFile: path) {
                    return img
                }
                if let path = Bundle.main.path(forResource: variant, ofType: ext, inDirectory: "Resources/Assets"),
                   let img = UIImage(contentsOfFile: path) {
                    return img
                }
            }
        }
        if let img = UIImage(named: cleanBase) ?? UIImage(named: baseWithoutScale) { return img }
        return nil
    }
}
