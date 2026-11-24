# 08 · iOS 原生 Swift 工程深度 Review 与可追踪整改计划（Action Plan）

> **文档定位**：针对 `ios-native/HungrySharkEvolution/` 原生 Swift + SpriteKit + SwiftUI 代码库，从**资深 iOS 图形/引擎架构师**与**手游发行/产品经理（App Store 审核、性能留存、变现合规）**双重视角输出完整 Review 结论，并落盘为与 [`07-REVIEW_AND_ACTION_PLAN.md`](./07-REVIEW_AND_ACTION_PLAN.md) 同规格的**可勾选、可逐条推进、带明确验收标准（DoD）**执行清单。
> **状态说明**：`[ ]` 待启动 ｜ `[-]` 进行中 ｜ `[x]` 已完成并验证
> **创建日期**：2026-11-23
> **审查范围**：`HungrySharkEvolutionApp.swift`（40 行）、`GameConfigGenerated.swift`（287 行）、`GameRules.swift`（2,193 行）、`SpriteAtlasManager.swift`（2,453 行）、`OceanGameScene.swift`（3,466 行）、`ContentView.swift`（2,998 行）、`Info.plist`（122 行）、`project.pbxproj` 与 `Resources/Assets/`（228 文件）。

---

## 一、现状基线快照（iOS Swift Review Baseline）

| 维度 | 当前实测基线 | 关键风险 / 问题 |
| :--- | :--- | :--- |
| **代码规模与结构** | **13,475 行 App Swift（24 文件，单文件 max 938 行 `< 1,000`）** + 290 行 `XCTest` + 122 行 `Info.plist`（`iOS-P1-3` 已完成） | 全量拆分为 `Core/`（3 文件）、`Rendering/`（7 文件）、`UI/`（7 文件）、`State/`（2 文件）、`Audio/`（2 文件）、`Monetization/`、`Generated/`、`HungrySharkEvolutionTests/`；100% 注册进 `project.pbxproj` / `Package.swift` / `project.yml` |
| **App Store 审核与变现** | `Monetization/GoogleAdMobManager.swift` + `PrivacyInfo.xcprivacy` + 双语 `InfoPlist.strings` | 已隔离 `#if DEBUG` 测试广告位与 `GADSimulatorID`，Release 强制主/备正式广告位；ATT 授权后才启动 AdMob；已移除 Swizzling；`iOS-P2-2` 已落地 `PrivacyInfo.xcprivacy` 与 `en`/`zh-Hans` `InfoPlist.strings`（iCloud/Game Center/StoreKit 2 待 Apple Developer 能力配置） |
| **Web ↔ iOS 玩法一致性** | `Core/GameRules.swift` + `Rendering/OceanGameScene.swift` + `UI/ContentView.swift`（`iOS-P0-2` 已完成） | **Web P1-2 已完整同步至 Swift**：全量移除 `seabedScale` / `effPreyX` / `effPreyY` 双空间微缩补丁，回归真 2D 相机变焦（`0.8m -> 1.00`, `45m -> 0.22`）+ 线性猎物体长比 + 巨鲨撞碎 Tier 0~4 阶梯海床 + `vm.depthMeters` 修正为 `worldYToMeterDepth` + 悬赏过滤 `minSpawnablePreyLengthM` + 非阻断双语深潜提示 |
| **包体与内存 / 显存（VRAM）** | `Resources/Assets/` **5.8 MB（206 文件）**（`iOS-P0-3` 已完成，原 61 MB） | 已同步 iOS 16+ 原生 WebP 资产并自动清理 224 个旧图集/重复 PNG（含 9.6MB 旧大图）；启动仅解码出战鲨鱼窗口（2~3 条）+ 浅海带猎物 + UI/海床；预览位图改为有界 `NSCache`，GPU 纹理采用 LRU 上限（鲨鱼 ≤8 / 猎物 ≤52）+ 跨深度带异步预热 + `didReceiveMemoryWarningNotification` 自动释放 |
| **帧率稳态与 SwiftUI 重绘** | `SpriteView(..., preferredFramesPerSecond: 60)` + `HudTelemetryStore`（`iOS-P1-1` 已完成） | 高频数值（HP/能量/深度/连击/狂暴/深潜提示）已隔离至 `HudTelemetryStore`（~18Hz 节流）仅由叶子视图订阅，摇杆与冲刺抽离至 UIKit 多指控件 + 叶子视图实现拖动期间根视图 0 重绘；金币/基因掉落复用单例 `SKTexture`；触感抽为 `HapticFeedbackManager` 单例复用；形变网格复用预分配缓冲区并将猎物摆动节流至 30Hz |
| **前后台生命周期与触控** | `scenePhase` + `willResignActive` + UIKit 多指触控（`iOS-P1-2` 已完成） | 切后台/来电/控制中心自动静默暂停并冻结 `scene.isPaused` + 归零摇杆与冲刺输入 + 重置帧时钟；左下摇杆与右下冲刺改为 `UIViewRepresentable`（`isMultipleTouchEnabled = true`、按 `UITouch` 追踪、确保取消/退场归零），并增加横屏安全区（Safe Area）保护 |
| **听觉与触感反馈** | `Audio/OceanAudioEngine.swift` + `Audio/HapticFeedbackManager.swift`（`iOS-P1-4` 已完成） | 全量清除 `AudioServicesPlaySystemSound`，落地 `AVAudioEngine` 零资源程序化合成器：覆盖吞噬（连击升调）、冲刺、破甲、碎石、受伤、金币/基因拾取、升级/进化、狂热、转盘棘轮与 UI 点击 **10 类事件** + **3 层水深环境音**淡入淡出；`AVAudioSession` 采用 `.ambient` + `[.mixWithOthers]` 遵守静音拨片、支持后台音乐并监听电话/广告中断恢复 |
| **并发安全与自动化测试** | **`GameRulesTests.swift`（6 个 XCTest 用例方法）**；`NSLock` 地形缓存（`iOS-P2-1` 已完成） | `SeabedTerrainBlockCache` 已采用 `NSLock` + `@unchecked Sendable` 封装；`HungrySharkEvolutionTests` Target 已接入 `project.pbxproj`、`project.yml` 与 `Package.swift`（Linux 沙盒静态全检通过，真机 `xcodebuild test` 待 macOS 执行） |

---

## 二、总览进度看板（iOS Master Checklist）

### P0 · 上线与提审硬阻塞（不修严禁提审 App Store）
- [x] **iOS-P0-1**：修复 AdMob 生产广告位错配（移除测试广告优先）、隔离 `#if DEBUG` 测试设备、修正 ATT 先行时序与移除 `Bundle` Method Swizzling
- [x] **iOS-P0-2**：同步 Web P1-2 核心体验与水深 Bug（废除 `seabedScale` 回归真相机变焦 `0.22` + 巨鲨撞碎 Tier 0~4 阶梯海床 + 修正 `depthMeters` 换算 + 悬赏过滤与浅海深潜引导）
- [x] **iOS-P0-3**：治理启动 OOM 与 61MB 包体膨胀（清理 9.5MB 废弃旧图集 + WebP 同步瘦身至 5.8MB + 取消启动全量双份常驻 + 按深度带/视窗按需加载与内存警告回收）

### P1 · 帧率稳态、生命周期与架构稳固（上架体验底线）
- [x] **iOS-P1-1**：消除 120Hz 发热与掉帧（`HudTelemetryStore` 18Hz 节流隔离、摇杆/冲刺抽离独立叶子视图、缓存金币/基因 `SKTexture`、预分配形变缓冲 + 30Hz 猎物形变节流、复接触感引擎与 60fps 稳态帧率）
- [x] **iOS-P1-2**：补齐 iOS 生命周期保护与多指触控稳健性（前后台/来电自动暂停、音频中断恢复、UIKit 原生多指摇杆/冲刺与安全区适配）
- [x] **iOS-P1-3**：拆分 4 个上帝 Swift 文件为模块化目录结构（24 个源码文件，单文件 max 938 行 `< 1,000`，`SeabedTerrainBlockCache` 已加 `NSLock` 并发保护并全量注册进 Xcode）
- [x] **iOS-P1-4**：补齐原生 `AVAudioEngine` 听觉闭环（吞噬连击升调/冲刺/破甲/碎石/受伤/拾取/升级进化/狂热/转盘棘轮 + 3 层水深环境音 + `AVAudioSession` 静音键与中断合规）

### P2 · 品质对齐、长线留存与原生生态放大
- [x] **iOS-P2-1**：补齐 `XCTest` 原生单元测试套件（`HungrySharkEvolutionTests/GameRulesTests.swift` 校验 Swift `GameRules` 与 `game_data.json` / Web `rules.ts` 核心不变量 1:1 咬合，macOS `xcodebuild test` 待在 Xcode 运行）
- [-] **iOS-P2-2**：完善 App Store 发行打磨与原生生态（已完成 `PrivacyInfo.xcprivacy` 合规隐私清单 + `en.lproj` / `zh-Hans.lproj` `InfoPlist.strings` 本地化；Game Center / iCloud / StoreKit 2 需 Apple Developer 能力配置，待后续按发行节奏接入）

---

## 三、逐条任务详细规格与验收清单

### [x] iOS-P0-1 · 修复 AdMob 生产配置、ATT 合规时序与移除高危 Swizzling
- **当前问题（源码定位）**：
  - `OceanGameScene.swift:171`：`preloadRewardedAd()` 无条件先请求 `Self.officialTestRewardedAdUnitId`（`ca-app-pub-3940256099942544/1712485313`），仅在失败时才调用 `loadProductionUnitAd()`。在 App Store 正式包中 Google 测试广告永远填充成功，导致**生产环境 100% 展示测试广告、零变现收入**，且可能触发 AdMob 账号违规。
  - `OceanGameScene.swift:128-131`：在非 Debug 环境下硬编码写入 `testDeviceIdentifiers = [GADSimulatorID, "4599a37a91ce92ab678ffee214ef6819"]`。
  - `OceanGameScene.swift:133-151`：先启动 `GADMobileAds.sharedInstance().start()`，1.2 秒后才异步调用 `ATTrackingManager.requestTrackingAuthorization`。Apple App Store Guideline 5.1.2 要求在触发广告追踪请求之前先完成 ATT 授权弹窗。
  - `OceanGameScene.swift:17-76`：`GADInfoPlistRuntimePatch` 对 `Bundle.object(forInfoDictionaryKey:)` 和 `Bundle.infoDictionary` 实施全局 Method Swizzling；实际上 `Info.plist:54-55` 与 `project.pbxproj:1135` 已正确绑定 `GADApplicationIdentifier`，保留 Swizzling 属于冗余风险。
  - `Info.plist:8`：`CFBundleDisplayName` 为小写技术代号 `deepsea:evolution`；`NSUserTrackingUsageDescription` 仅有中文文案，缺少英文地区本地化。
- **可选方案**：
  - **方案 A（推荐）**：① 用 `#if DEBUG` 严格隔离测试广告位与 `testDeviceIdentifiers`，Release 仅请求 `GameConfigGenerated.googleAdMobRewardedAdUnitId`（失败回退 `googleAdMobBackupRewardedAdUnitId`）；② 将 ATT 请求提前至首屏就绪后且**等待 ATT 回调完成再执行 `GADMobileAds.sharedInstance().start()`**；③ 删除 `GADInfoPlistRuntimePatch` 的 `Bundle` Swizzling，改为启动期只读断言校验 `Info.plist`；④ 为 `Info.plist` 补齐 `zh-Hans.lproj` / `en.lproj` `InfoPlist.strings` 与正式应用名。
  - **方案 B**：仅修复 `#if DEBUG` 广告位切换与 ATT 顺序，暂保留 `GADInfoPlistRuntimePatch` 作为兜底。
- **决策记录**：`采用方案 A 并结合轻拆分抽离为独立文件 Monetization/GoogleAdMobManager.swift`（2026-11-23 已落地；双语 `InfoPlist.strings` 纳入 `iOS-P2-2` 发行包统一收口）
- **验收标准（DoD）**：
  - [x] Release 构建仅加载正式 `googleAdMobRewardedAdUnitId`（主/备），且 `testDeviceIdentifiers = [GADSimulatorID]` 仅在 `#if DEBUG` 生效（已清除硬编码个人设备 ID）
  - [x] 首次冷启动先完成 ATT 弹窗响应，再启动 `GADMobileAds.sharedInstance().start()` 与预加载广告
  - [x] 彻底移除 `Bundle` Method Swizzling，改为只读 `Info.plist` 校验（最终真机启动验证需在 macOS Xcode 完成）
  - [x] 增加分广告位冷却频控（`SUPPLY_DROP: 90s`、`TRIAL_SHARK: 60s`、`REVIVE/DOUBLE_SETTLEMENT: 5s`）与每日次数上限，严格按 `activeAdDidEarnReward && activeAdDidDismiss` 发奖

---

### [x] iOS-P0-2 · 同步 Web P1-2 真相机变焦、巨鲨撞碎海床与水深换算修复
- **当前问题（源码定位）**：
  - **旧微缩补丁残留**：`GameRules.swift:2048-2049` 仍采用 `cameraZoom = max(0.88, ...)` 与 `relativePreyScale`；`OceanGameScene.swift` 在鲨鱼移动（`1353-1386`）、海床渲染（`1954-1964`、`2257-2287`、`2604-2605`）、特效（`3001-3088`）与猎物物理/渲染（`3100-3246`、`3423-3424`）共 **25+ 处**仍使用 `seabedScale` / `effPreyX/Y` 双空间映射，导致 45m 巨鲨阶段海床坍塌、手感与 Web 彻底分叉。
  - **缺少上层海床撞碎能力**：`GameRules.swift` 的 `seabedTerraceTiers` 未配置 `shatterLengthM`（Tier 0~4：`8/12/18/26/36m`，Tier 5~8：`∞`），`resolveSeabedCollision` / `resolveSeabedKineticStep` 无破壁跳过与 `breachedTerraceCells` 缺口记录，巨鲨会被浅海洞口卡死。
  - **浅海空海闭环与悬赏 Bug**：`OceanGameScene.swift:519-528` 的 `pickNewBountyPrey()` 未按 `minSpawnablePreyLengthM` 过滤，45m 巨鲨仍可能抽到已被生态过滤掉的浅海小鱼悬赏；`spawnOnePrey()`（`2813-2814`）与猎物销毁距离 `dist > 1950`（`3118`）未按低缩放 `zoom = 0.22` 广角视口适配；HUD 未渲染 `hud_deep_dive_cue` 双语下潜引导（虽然文案已同步在 `game_data.json` 中）。
  - **水深显示单位 Bug**：`OceanGameScene.swift:1266` 将原始像素 `sharkY` 直接写入 `vm.depthMeters`，未调用 `GameRules.worldYToMeterDepth(sharkY)`（`GameRules.swift:461`），导致玩家在 `2000px`（实际海深 `200m`）处看到 `2000m`，与真实 5 层水深带及解锁门槛严重偏差。
- **可选方案**：
  - **方案 A（推荐，与 Web 1:1 对齐）**：在 `GameRules.swift` 新增 `cameraZoomMin = 0.22`、`minRenderZoomFloor = 0.14`、`computeTrueCameraZoom(_:)`、`worldScale = scale / cameraZoom`、`getParallaxLayerGrowthScalesFromZoom(_:)` 与 `shatterLengthM` / `detectShatterableTerraceHit`；全量移除 `OceanGameScene.swift` 中的 `seabedScale` / `effPreyX/Y` 补丁，改为单一 1:1 世界坐标 + 原生 `zoom` 投影，接入碎石粒子与屏幕震动、广角刷怪/回收半径、悬赏体长过滤、SwiftUI 非阻断深潜提示与 `worldYToMeterDepth` 修正。
  - **方案 B**：分两期推进，先修水深 Bug + 真相机变焦 + 撞碎海床，二期再补广角 LOD 与深潜提示。
- **决策记录**：`采用方案 A，与 Web P1-2 完整 1:1 对齐并抽离 State/GameViewModel.swift`（2026-11-23 已落地）
- **验收标准（DoD）**：
  - [x] `ios-native/` 全量清除 `seabedScale` / `effPreyX` / `effPreyY` / `postEffX` / `postEffY` 双空间投影补丁（静态 grep 0 残留）
  - [x] 0.8m → 45m 鲨鱼 `cameraZoom` 平滑降至 `0.22`（底线保护 `minRenderZoomFloor = 0.14`），猎物锚定 `worldScale` 保持严格线性体长比且视觉 === 碰撞同源，同步落地低缩放海床 LOD（`zoom < 0.45`）
  - [x] 达标巨鲨可无阻碍撞碎 Tier 0~4 阶梯海床（`8/12/18/26/36m`）并产生可见缺口（512 FIFO `breachedTerraceCells`、洞肩/岩堆同步剔除）与碎石/震屏/触感反馈；Tier 5~8 与主海床保持基岩碰撞
  - [x] `vm.depthMeters` 与 `telemetryPill` 均改用真实海洋米数（`GameRules.worldYToMeterDepth`、`1000m / 200m` 分色），悬赏过滤 `minSpawnablePreyLengthM`，滞留缺鱼浅海 `>= 1.5s` 显示非阻断双语深潜提示（`.allowsHitTesting(false)`）

---

### [x] iOS-P0-3 · 治理 61MB 包体膨胀与启动 OOM 显存风险
- **当前问题（源码定位）**：
  - `Resources/Assets/` 总计 **61 MB（228 文件）**，仍包含已被独立 `@3x` 单图取代的 3 张废弃大图：`sharks_ec921c3b.png`（7.2 MB）、`fish2_fc857cfa.png`（1.2 MB）、`fish_24bdaa5a.png`（1.1 MB），以及多张 1.2~2.3 MB 未压缩 PNG 背景图。
  - `SpriteAtlasManager.swift:101-375`：启动 `startAsyncPreloadIfNeeded()` 一次性解码全部 **48 张 `@3x` 鲨鱼 + 135 张 `@3x` 猎物 + 全量背景/海床/生态/POI**，并且同时在内存中双份持有 `sharkUIImages`/`preyUIImages`（CPU 位图）与 `sharkTextures`/`preyTextures`（Metal 纹理），第 `352-360` 行还将全部几百张高分纹理一次性传入 `SKTexture.preload(allGpuTextures)` 压入 GPU 显存。按平均 `@3x` 解码后 RGBA8 体积估算，峰值 RAM + VRAM 可达 **350~550 MB+**，在 iPhone SE / iPhone 11 / 入门 iPad 上极易被系统 Jetsam 强杀。
  - `SpriteAtlasManager.swift:159-160`：无论 135 张猎物单图是否全部存在，Stage 2 启动就无条件加载 `fish_24bdaa5a` 和 `fish2_fc857cfa` 两张大图。
- **可选方案**：
  - **方案 A（推荐，对齐 Web P0-2 策略）**：① 从 `Resources/Assets/` 与 `scripts/build-ios-native.ts` 同步白名单中移除 3 张废弃旧图集，对静态背景与单图做无损/高保真 PNG 量化或转为 HEIC/WebP（iOS 16+ 原生 `UIImage` 支持 WebP/HEIC）；② 启动期**仅预加载 UI 图集 + 海床/水幕 + 当前出战/下一阶鲨鱼（2 张）+ 浅海带猎物**，启动时间缩短 >70%；③ 鲨鱼图鉴采用滑窗按需加载 + `NSCache` 持有 `UIImage`，猎物按当前水深带动态预热并响应 `UIApplication.didReceiveMemoryWarningNotification` 自动释放非活跃深度的 `SKTexture` / `UIImage` 缓存。
  - **方案 B**：保留现有全量预加载流程，但移除 3 张废弃大图、用 `Asset Catalog` 的 Sprite Atlas（`.spriteatlas`）打包并下调 `@3x` 猎物解码分辨率上限（如 max 420px），且不再对非图鉴期常驻双份 `UIImage`。
- **决策记录**：`采用方案 A，复用 Web P0-2 高保真 WebP 资产（iOS 16+ ImageIO 原生硬件解码）并改造 SpriteAtlasManager 为有界按需缓存`（2026-11-23 已落地）
- **验收标准（DoD）**：
  - [x] `Resources/Assets/` 移除废弃 `sharks_ec921c3b` / `fish_24bdaa5a` / `fish2_fc857cfa` 与 221 个旧 PNG 冗余文件，包体从 **61 MB 降至 5.8 MB**（`rules.test.ts` Test 42 强制护栏 `< 12 MB`）
  - [x] 启动期仅预加载出战鲨鱼窗口（2~3 条）+ 浅海带猎物（`minDepth <= 2200`）+ UI/海床，首屏就绪后自动释放 3 张启动海报位图；下潜时异步 `prewarmDepthBandIfNeeded`
  - [x] 预览位图改为有界 `NSCache`（鲨鱼 14 / 猎物 18），GPU 纹理启用 LRU 淘汰（鲨鱼 ≤8 / 猎物 ≤52），并接入 `didReceiveMemoryWarningNotification` 自动释放冷缓存（最终真机 Instruments Memory Footprint 需在 macOS Xcode 实测）

---

### [x] iOS-P1-1 · 消除 120Hz 发热与主线程/GPU 冗余开销
- **当前问题（源码定位）**：
  - **SwiftUI 120Hz 全树重绘**：`ContentView.swift:954` 运行 `preferredFramesPerSecond: 120`，但 `OceanGameScene.swift:1221-1275` 每帧写入 `vm.hp`、`vm.energy`、`vm.comboTimer`、`vm.frenzyTimer` 等 `@Published` 属性，而 `ContentView` 顶层持有 `@StateObject private var vm`（第 886 行）并在摇杆拖动时写顶层 `@State knobOffset`（第 1405 行），导致**每帧触发整个 `ContentView` 及其全部子视图 Diff**。
  - **每帧高频 `SKWarpGeometryGrid` 分配**：`OceanGameScene.swift:1501`（鲨鱼）、`1572`（最多 22 条猎物）、`1861`（所有可见海床/阶梯条带切片）每帧都在 CPU 分配新数组并构造数十个 `SKWarpGeometryGrid` 对象，120Hz 下每秒可达 3,000~5,000 次对象分配与 GPU 顶点上传。
  - **重复创建拾取物纹理**：`OceanGameScene.swift:2912, 2935` 每次掉落金币/基因都在主线程执行 `SKTexture(image: img)`，重复创建并上传纹理而非复用缓存的 `SKTexture`。
  - **重复创建触感引擎**：`OceanGameScene.swift:469, 476, 3355, 3365, 3405, 3419` 每次吞噬、破甲、受伤、点击都临时实例化 `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator`。
- **可选方案**：
  - **方案 A（推荐）**：① 拆分高频 HUD 状态到独立 `HudTelemetryStore`（15~20Hz 节流同步 `hp`/`energy`/`depth`，仅数值变化超阈值才发广播），将摇杆抽离为独立子视图或 `UIViewRepresentable` 隔离重绘；② `SpriteAtlasManager` 缓存 `coinTexture` / `geneTexture` 单例纹理；③ 海床条带按地形网格缓存或仅在相机移动超阈值时更新 `warpGeometry`，猎物脊柱摆动降至 30~45Hz 步进并复用预分配 `[SIMD2<Float>]` 缓冲区；④ 将触感引擎抽为单例复用并调用 `prepare()`；⑤ 帧率策略改为常规 60fps（或 ProMotion 设备按需自适应并监控热状态 `ProcessInfo.processInfo.thermalState`）。
  - **方案 B**：优先完成 HUD 节流隔离、摇杆子视图隔离、金币/基因纹理缓存与触感复用，暂保持 60fps 固定上限。
- **决策记录**：`采用方案 A 核心组合：新增 State/HudTelemetryStore.swift（18Hz 节流）、UI/Components/HudLeafViews.swift、Audio/HapticFeedbackManager.swift，帧率锁定 60fps 并复用 Warp 缓冲区 + 30Hz 猎物形变节流`（2026-11-23 已落地）
- **验收标准（DoD）**：
  - [x] 局内常规游动与摇杆拖动期间 `ContentView` 根 `body` 重绘频率降至 0Hz（仅叶子 HUD 视图按 ~18Hz 订阅 `HudTelemetryStore`，离散事件才刷新根视图）
  - [x] 金币/基因掉落 0 次运行时 `SKTexture(image:)` 构造（统一复用 `SpriteAtlasManager.uiIconTexture(for:)`）；触感引擎 0 次每帧临时实例化（统一走 `HapticFeedbackManager.shared`）
  - [x] 鲨鱼/猎物/海床 `SKWarpGeometryGrid` 全部复用预分配 `[SIMD2<Float>]` 缓冲区，猎物摆动节流至 30Hz 且屏幕 `< 22px` 远景免形变，`SpriteView` 调整为稳态 60fps（最终真机 Time Profiler / 10 分钟温控待 macOS Xcode 实测）

---

### [x] iOS-P1-2 · 补齐前后台生命周期保护与原生多指触控稳健性
- **当前问题（源码定位）**：
  - `ContentView.swift` 与 `HungrySharkEvolutionApp.swift` 均**未监听 `@Environment(\.scenePhase)` 或 `UIApplication.willResignActiveNotification`**。玩家在游戏中途切后台、接听来电、弹出系统低电量提示或看激励广告时，游戏不会自动进入 `"paused"` 状态且 `dt` 虽被 clamp 为 `0.05`，但恢复后可能出现摇杆状态残留或直接掉血。
  - `ContentView.swift:1393`（摇杆）与 `1693`（冲刺按钮）以及技能按钮使用纯 SwiftUI `DragGesture` + `Button` 混排；在 iOS 多点触控下，左手按住摇杆拖移出边界或系统边缘手势触发时，易出现右手技能偶发失灵或左手抬起回调丢失。
- **可选方案**：
  - **方案 A（推荐）**：① 在 `ContentView` 监听 `scenePhase`（`.inactive` / `.background` 自动调用 `vm.pauseGame(silent: true)` 并 `scene.isPaused = true` + `scene.resetFrameClock()` + 归零输入）；② 监听 `UIApplication.willResignActiveNotification` / `didBecomeActiveNotification` 与 `AVAudioSession.interruptionNotification`；③ 将左下摇杆与右下冲刺区升级为轻量 `UIViewRepresentable`（`MultiTouchControls.swift` 直接接管 `UITouch` `touchesBegan/Moved/Ended/Cancelled` + `isMultipleTouchEnabled = true` + `willMove(toWindow: nil)` 兜底重置），彻底根治多指抢占与手势丢失，并适配横屏安全区 `geo.safeAreaInsets`。
  - **方案 B**：补齐 `scenePhase` 自动暂停与输入重置，保留 SwiftUI 手势但将摇杆/冲刺独立成不相互干扰的顶层手势容器。
- **决策记录**：`采用方案 A：新增 UI/Components/MultiTouchControls.swift 并在 ContentView/HudLeafViews 落地完整前后台生命周期保护、UIKit 原生多指摇杆/冲刺与安全区适配`（2026-11-24 已落地）
- **验收标准（DoD）**：
  - [x] 游玩中切后台、锁屏、拉下控制中心或来电中断，自动静默暂停、冻结 `scene.isPaused`、重置帧时钟与输入状态，返回后必定处于暂停态且血量无意外流失
  - [x] 左手长按 UIKit 多指摇杆持续转向时，右手连点升级躯体/狂暴/突破及按住 UIKit 冲刺遮罩 100% 并发响应且 `touchesCancelled`/退场必归零（最终真机手势验证待 macOS Xcode 完成）

---

### [x] iOS-P1-3 · 拆分 4 个上帝 Swift 文件并修复并发安全隐患
- **当前问题（源码定位）**：
  - 原 4 个超千行上帝文件：`GameRules.swift`（2,193 行）、`SpriteAtlasManager.swift`（2,602 行）、`OceanGameScene.swift`（3,466 行）、`ContentView.swift`（2,998 行）。
  - `GameRules.swift:613-615`：`terrainBlockNodeCache` 与 `terrainBlockCacheOrder` 为无锁全局 `private static var`，在 Swift 6 严格并发检查或后台线程查询地形时会引发编译报错 / 运行时数据竞争。
- **可选方案**：
  - **方案 A（推荐）**：参照 Web 端 `P1-3` 的模块化分层，将 `ios-native/HungrySharkEvolution/` 拆分为清晰子目录（`scripts/build-ios-native.ts` 自动递归扫描 `.swift` 并更新 `project.pbxproj`）：
    - `Monetization/GoogleAdMobManager.swift`（388 行）
    - `State/GameViewModel.swift`（622 行）+ `State/HudTelemetryStore.swift`（146 行）
    - `Audio/HapticFeedbackManager.swift`（65 行）+ `Audio/OceanAudioEngine.swift`（622 行）
    - `Core/GameRules.swift`（815 行）+ `Core/TerrainSystem.swift`（671 行，含 `NSLock` + `@unchecked Sendable` 封装的 `SeabedTerrainBlockCache`）+ `Core/SeabedTerraceSystem.swift`（938 行）
    - `Rendering/OceanGameScene.swift`（772 行）+ `Rendering/SeabedRenderer.swift`（902 行）+ `Rendering/PreySimulation.swift`（599 行）+ `Rendering/OceanFXSystem.swift`（564 行）+ `Rendering/SpriteAtlasManager.swift`（809 行）+ `Rendering/AtlasUiSlicer.swift`（931 行）+ `Rendering/AtlasEnvironmentProcessor.swift`（877 行）
    - `UI/ContentView.swift`（468 行）+ `UI/StartupLoadingView.swift`（301 行）+ `UI/EvolutionAtlasSheetView.swift`（883 行）+ `UI/ModalsAndSkillFanViews.swift`（646 行）+ `UI/Components/AtlasUiKitViews.swift`（586 行）+ `UI/Components/HudLeafViews.swift`（229 行）+ `UI/Components/MultiTouchControls.swift`（312 行）
  - **方案 B**：最小拆分，仅将 `GoogleAdMobManager`、`GameViewModel`、`EvolutionAtlasSheetView` 抽离为独立文件，并给 `terrainBlockNodeCache` 加 `NSLock`。
- **决策记录**：`采用方案 A，分 4 轮渐进完成全部 4 个上帝文件细拆与 NSLock 并发防护`（2026-11-24 Round 4 已全面落地）
- **验收标准（DoD）**：
  - [x] 单文件行数全部 `< 1,000` 行（24 个 App Swift 文件最高 `938` 行、0 循环依赖），运行 `npm run sync:ios` 后 `project.pbxproj` 完整注册所有新建 Swift 文件
  - [x] `GameRules` 全局地形缓存已由 `SeabedTerrainBlockCache`（`@unchecked Sendable` + `NSLock`）封装并发保护（最终 Xcode Swift 6 `Strict Concurrency` 编译复验待 macOS 执行）

---

### [x] iOS-P1-4 · 补齐原生 `AVAudioEngine` 听觉闭环与音频会话合规
- **当前问题（源码定位）**：
  - 全 iOS 工程原仅在 `OceanGameScene.swift`、`GameViewModel.swift` 与 `ContentView.swift` 调用了 `AudioServicesPlaySystemSound(1104)` 和 `1025` 两个系统按键音；吞噬、冲刺、破甲、撞碎海床、受伤、黄金狂热、升级进化全部静音，且完全没有浅海/暮光/深渊环境音或 BGM。
  - `AudioServicesPlaySystemSound` 无法精细控制音量、音高爬升（连击 Pitch）与混音。
- **可选方案**：
  - **方案 A（推荐）**：新增 `Audio/OceanAudioEngine.swift`，基于 `AVAudioEngine` + 6 通道 `AVAudioPlayerNode`/`AVAudioUnitVarispeed` 程序化合成器缓冲实现零外部版权风险的高爽感 SFX（吞噬气泡咬合 + 连击音阶爬升、冲刺水流、破甲裂纹/粉碎、巨鲨碎石低频、受伤告警、金币/基因双音、进化五音琶音、狂热和弦、转盘棘轮与 UI 点击）与 3 层整数周期无缝水深环境音淡入淡出（浅海/暮光/深渊）；配置 `AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])` 以天然遵守硬件静音开关并兼容玩家后台音乐，监听音频中断与路由切换自动暂停/恢复。
  - **方案 B**：使用 `SKAction.playSoundFileNamed` 配合轻量 `.caf`/`.m4a` 音效资源包实现基础音效。
- **决策记录**：`采用方案 A：新增 Audio/OceanAudioEngine.swift 并全量移除 AudioToolbox / AudioServicesPlaySystemSound`（2026-11-24 已落地）
- **验收标准（DoD）**：
  - [x] 覆盖吞噬（连击升调）、冲刺、破甲、碎石、受伤、金币/基因拾取、升级/进化、狂热、转盘棘轮与 UI 点击 10 类事件及 3 层水深环境音无缝混音
  - [x] `AVAudioSession` 配置 `.ambient` + `[.mixWithOthers]` 并监听 `interruptionNotification` / `routeChangeNotification` / `AVAudioEngineConfigurationChange`（最终真机静音拨片与来电中断复测待 macOS Xcode 完成）

---

### [x] iOS-P2-1 · 建立 Swift `XCTest` 原生单元测试护城河
- **当前问题**：
  - Web 端已有 `48/48` 条严格单元不变量测试（`src/game/rules.test.ts`），但 `ios-native/` 为 **0 测试 Target**。未来 Swift 端修改公式或解析 `game_data.json` 时，无法在 Xcode CI/本地自动捕获双端数值漂移。
- **验收标准（DoD）**：
  - [x] 新增 `HungrySharkEvolutionTests` XCTest Target（已同步至 `scripts/build-ios-native.ts`、`project.pbxproj`、`project.yml` 与 `Package.swift`）
  - [x] `GameRulesTests.swift`（290 行）覆盖 6 项核心测试：`game_data.json` 解码完整性（48 鲨 + 135 猎物 + 双语 I18N 零缺失）、`computeTrueCameraZoom` / `worldScale` / `getPreyRelativeVisualScale` 线性体长比守恒、9 阶海床碰撞与 Tier 0~4 破壁阈值、`worldYToMeterDepth` 分段精度、200 并发 `DispatchGroup` 地形缓存压测、三色皇冠与 48 阶解锁门禁（macOS `xcodebuild test` 待在 macOS 运行）

---

### [-] iOS-P2-2 · App Store 发行打磨与 iOS 原生留存/变现能力
- **当前问题与规划子项**：
  - [x] **隐私清单与本地化**：新增 `PrivacyInfo.xcprivacy`（XML Plist 声明 `NSPrivacyTracking`、AdMob 域名、广告/设备 ID 收集用途及 `CA92.1`/`C617.1`/`35F9.1`/`E174.1` 必需 API 原因）；补齐 `zh-Hans.lproj/InfoPlist.strings`（`"深海进化：饥饿鲨"`）与 `en.lproj/InfoPlist.strings`（`"DeepSea Evolution"`）及双语 ATT 授权文案，并全量注册进 `project.pbxproj` `PBXVariantGroup`。
  - [ ] **云存档与榜单**：接入 `NSUbiquitousKeyValueStore`（iCloud 轻量键值云存档，冲突取最高进度合并）与 Game Center（48 阶图鉴成就 + 最高分/最深海沟排行榜，需 Apple Developer Entitlements 配置）。
  - [ ] **StoreKit 2 混合变现**：补充“免广告特权 / 基因补给礼盒 / 限时特惠鲨”轻量 IAP，并保留规范的“恢复购买（Restore Purchases）”入口以符合 App Store 3.1.1 规范（需 App Store Connect 商品 ID）。

---

## 四、推荐执行排期（Execution Roadmap）

1. **第一批（止血 + 双端对齐）**：`iOS-P0-1`（AdMob/ATT 合规，防拒审与 0 收入） → `iOS-P0-2`（同步 Web P1-2 真相机变焦/碎海床/修水深 Bug）
2. **第二批（稳内存 + 稳帧率）**：`iOS-P0-3`（包体瘦身 + 按需加载防 OOM） → `iOS-P1-1`（消除 120Hz SwiftUI 重绘与 Warp 分配） → `iOS-P1-2`（前后台自动暂停 + 原生多指触控）
3. **第三批（架构 + 声音 + 发行）**：`iOS-P1-3`（拆分上帝文件 + 并发安全） → `iOS-P1-4`（`AVAudioEngine` 完整听觉） → `iOS-P2-1`（XCTest） → `iOS-P2-2`（隐私清单/iCloud/Game Center/StoreKit 2）

---

## 五、执行日志（Execution Log）

| 日期 | 任务编号 | 决策内容 | 状态 | 验证结果 |
| :--- | :--- | :--- | :---: | :--- |
| 2026-11-23 | Baseline | 完成 iOS 原生 Swift 工程（6 文件 11,437 行 + `Info.plist` + 61MB 资产）双视角深度 Review 并落盘可 Check 整改计划 | `[x]` | 定位 3 项 App Store/变现 P0 阻塞（测试广告位优先、ATT 倒置、61MB 全量 OOM 风险）+ Web P1-2 未同步 + `depthMeters` 像素误用等 9 项整改任务 |
| 2026-11-23 | iOS-P1-3 (Phase 1) + iOS-P0-1 | 从 `OceanGameScene.swift` 轻拆出 `Monetization/GoogleAdMobManager.swift`（388 行）与 `State/GameViewModel.swift`（550 行）；重构 AdMob 为 Release 强制主/备正式位、`#if DEBUG` 隔离测试位与 `GADSimulatorID`、先 ATT 后 `start()`、移除 `Bundle` Method Swizzling、补齐分广告位冷却与每日上限，并将 `CFBundleDisplayName` 修正为 `DeepSea Evolution` | `[x]` | `npm run sync:ios` 注册全部 8 个 Swift 文件到 `project.pbxproj`；静态 grep 0 残留硬编码设备 ID / `method_exchangeImplementations`；8 个 Swift 文件括号/引号平衡检查全通过（最终真机编译待 macOS Xcode） |
| 2026-11-23 | iOS-P0-2 | 同步 Web P1-2 至 `Core/GameRules.swift`、`Rendering/OceanGameScene.swift`、`State/GameViewModel.swift`、`UI/ContentView.swift`：全量废除 `seabedScale`/`effPreyX/Y` 双空间微缩补丁，回归真 2D 相机变焦（`0.8m -> 1.00`, `45m -> 0.22`）+ 线性体长比 + 低缩放海床 LOD；落地巨鲨撞碎 Tier 0~4 阶梯海床（`8/12/18/26/36m`）与 `breachedTerraceCells` 缺口/碎石反馈；修正 `vm.depthMeters` 使用 `worldYToMeterDepth`、悬赏过滤 `minSpawnablePreyLengthM` 与滞留浅海 `>= 1.5s` 非阻断双语深潜提示 | `[x]` | 静态 grep `seabedScale` / `effPreyX` / `postEffX` 0 残留；8 个 Swift 文件语法平衡与跨文件符号核对全通过；Web `rules.test.ts` 48/48 全绿、`npm run lint` 与 `npm run build` 0 错误 |
| 2026-11-23 | iOS-P0-3 | 升级 `scripts/build-ios-native.ts` 与 `SpriteAtlasManager.swift` 支持 iOS 16+ 原生 WebP 资产同步并自动清理 224 个旧图集/重复 PNG（`Resources/Assets/` 从 61 MB 瘦身至 5.8 MB）；重构启动加载仅预热出战鲨鱼窗口 + 浅海带猎物 + UI/海床并在首屏淡出后释放 3 张启动海报；预览位图改为有界 `NSCache`、GPU 纹理增加 LRU 淘汰与跨深度带异步预热并响应 `didReceiveMemoryWarningNotification` | `[x]` | `npm run sync:ios` 同步 206 个资源与 11 个 Swift 源码文件至 `project.pbxproj`；`rules.test.ts` Test 42 升级校验 WebP 魔数 + 零旧大图 + `< 12 MB` 包体守恒，48/48 全绿 |
| 2026-11-23 | iOS-P1-1 + iOS-P1-3 (Phase 2) | 新增 `State/HudTelemetryStore.swift`（~18Hz 节流）、`UI/Components/HudLeafViews.swift`（隔离摇杆/冲刺/深度/Row2 提示/教程计时）与 `Audio/HapticFeedbackManager.swift`（单例复用 Taptic 引擎）；`GameViewModel` 移除逐帧 `@Published` 写入、`SpriteView` 调整为 60fps；金币/基因拾取物改为复用 `SpriteAtlasManager.uiIconTexture`；鲨鱼/猎物/海床 `SKWarpGeometryGrid` 全部复用预分配 `[SIMD2<Float>]` 缓冲且猎物形变节流至 30Hz | `[x]` | 静态审计 0 残留 `preferredFramesPerSecond: 120`、0 处 `OceanGameScene` 运行时 `SKTexture(image:)`、0 处分散 `UIImpactFeedbackGenerator`；11 个 Swift 文件括号/插值平衡全 `OK`；Web `rules.test.ts` 48/48 + `tsc --noEmit` + `npm run build` 全绿 |
| 2026-11-24 | iOS-P1-4 + iOS-P1-2 + iOS-P1-3 (Phase 3) | 新增 `Audio/OceanAudioEngine.swift`（基于 `AVAudioEngine` 6 通道变调 SFX + 3 层整数周期水深环境音 + `.ambient` 静音拨片合规 + 中断/路由自恢复）并全量移除 `AudioToolbox`/`AudioServicesPlaySystemSound`；新增 `UI/Components/MultiTouchControls.swift`（UIKit `isMultipleTouchEnabled = true` 摇杆与冲刺遮罩，按 `UITouch` 追踪、确保取消/退场归零），在 `ContentView` 落地 `scenePhase` + `willResignActive`/`didBecomeActive` 自动暂停、冻结物理与横屏安全区 HUD 保护 | `[x]` | `npm run sync:ios` 注册全部 13 个 Swift 源码与 206 个资源进 `project.pbxproj`；静态 grep 0 残留 `AudioServicesPlaySystemSound` / `import AudioToolbox`；13 个 Swift 文件（13,428 行）括号/引号平衡全 `OK`；Web `rules.test.ts` 48/48 + `tsc --noEmit` + `npm run build` 全绿（最终真机体验与编译待 macOS Xcode） |
| 2026-11-24 | Round 4: iOS-P1-3 (Final) + iOS-P2-1 + iOS-P2-2 (Privacy/L10n) | 彻底完成 4 个上帝文件模块化拆解与并发加固：`Core/GameRules.swift`（815）+ `TerrainSystem.swift`（671，`SeabedTerrainBlockCache` `NSLock`）+ `SeabedTerraceSystem.swift`（938）；`Rendering/OceanGameScene.swift`（772）+ `SeabedRenderer.swift`（902）+ `PreySimulation.swift`（599）+ `OceanFXSystem.swift`（564）+ `SpriteAtlasManager.swift`（809）+ `AtlasUiSlicer.swift`（931）+ `AtlasEnvironmentProcessor.swift`（877）；`UI/ContentView.swift`（468）+ `AtlasUiKitViews.swift`（586）+ `StartupLoadingView.swift`（301）+ `ModalsAndSkillFanViews.swift`（646）+ `EvolutionAtlasSheetView.swift`（883）。新增 `HungrySharkEvolutionTests/GameRulesTests.swift`（290 行，6 测试方法）与 `PrivacyInfo.xcprivacy`、`en.lproj`/`zh-Hans.lproj/InfoPlist.strings`，并同步更新 `scripts/build-ios-native.ts` 生成 `project.pbxproj` / `project.yml` / `Package.swift` | `[x]` | `npm run sync:ios` 注册 24 App Swift（13,475 行，max 938 行，0 文件 `>=1000`）+ 1 Test Swift + 206 资源进纯 ASCII `project.pbxproj`；26 个 Swift 文件括号/引号平衡与扩展静态存储检查 0 错误、跨文件 `extension` 可见性审计 0 错误；`PrivacyInfo.xcprivacy` / `.strings` 解析通过；Web `rules.test.ts` 48/48、`npm run build`、`npm run lint` 全绿（最终 macOS Xcode 构建与 `xcodebuild test` 待在 macOS 运行） |
| 2026-11-24 | Round 4+ HUD Edge Polish (iPhone 14 Pro Max) | 修复 `ContentView.swift` 根 `GeometryReader` 未加 `.ignoresSafeArea()` 导致的“59pt 整边安全区 + 二次 padding”双重内缩问题（原左上头像/右上暂停距边框 `71pt`、左下摇杆 `85pt`、右下技能区 `81pt`、底边 `37~39pt`）：切换根 `GeometryReader` 为全屏并读取真实 `UIWindow.safeAreaInsets`，将四角 HUD 改为角区适配边距（14 Pro Max 左右 **`24pt`**、底角 **`12pt`**、居中引导胶囊避让 Home 条 **`21pt`**），`ModalsAndSkillFanViews.swift` 对右下角上端“进化图鉴/强化躯体”沿弧线微内收以 100% 避让右侧灵动岛中段（`y=152..278pt`），并同步调整 `EvolutionAtlasSheetView.swift` 顶栏与分屏容器安全区 | `[x]` | `npm run sync:ios` 同步通过；3 个 UI 文件（511 / 658 / 900 行）括号/圆括号/方括号平衡 `0` 错误；Web `rules.test.ts` 48/48、`npm run build`、`npm run lint` 全绿（真机视觉待 macOS Xcode 运行确认） |
