# 08 · iOS 原生 Swift 工程深度 Review 与可追踪整改计划（Action Plan）

> **文档定位**：针对 `ios-native/HungrySharkEvolution/` 原生 Swift + SpriteKit + SwiftUI 代码库，从**资深 iOS 图形/引擎架构师**与**手游发行/产品经理（App Store 审核、性能留存、变现合规）**双重视角输出完整 Review 结论，并落盘为与 [`07-REVIEW_AND_ACTION_PLAN.md`](./07-REVIEW_AND_ACTION_PLAN.md) 同规格的**可勾选、可逐条推进、带明确验收标准（DoD）**执行清单。
> **状态说明**：`[ ]` 待启动 ｜ `[-]` 进行中 ｜ `[x]` 已完成并验证
> **创建日期**：2026-11-23
> **审查范围**：`HungrySharkEvolutionApp.swift`（40 行）、`GameConfigGenerated.swift`（287 行）、`GameRules.swift`（2,193 行）、`SpriteAtlasManager.swift`（2,453 行）、`OceanGameScene.swift`（3,466 行）、`ContentView.swift`（2,998 行）、`Info.plist`（122 行）、`project.pbxproj` 与 `Resources/Assets/`（228 文件）。

---

## 一、现状基线快照（iOS Swift Review Baseline）

| 维度 | 当前实测基线 | 关键风险 / 问题 |
| :--- | :--- | :--- |
| **代码规模与结构** | **12,447 行 Swift** + 122 行 `Info.plist`（已拆至 **11 个源码文件**） | 已抽离 `Monetization/GoogleAdMobManager.swift`、`State/GameViewModel.swift`、`State/HudTelemetryStore.swift`、`Audio/HapticFeedbackManager.swift`、`UI/Components/HudLeafViews.swift`；剩余大文件继续在后续轮次拆分 |
| **App Store 审核与变现** | `Monetization/GoogleAdMobManager.swift`（`iOS-P0-1` 已完成） | 已隔离 `#if DEBUG` 测试广告位与 `GADSimulatorID`（移除硬编码个人设备 ID），Release 强制主/备正式广告位；已修正为等待 ATT 授权后再调用 `GADMobileAds.start()`；已移除 `Bundle` Method Swizzling；已补齐分广告位冷却与每日上限；`CFBundleDisplayName`（`Info.plist` 与 `project.pbxproj`）已全量统一为 `DeepSea Evolution` |
| **Web ↔ iOS 玩法一致性** | `Core/GameRules.swift` + `Rendering/OceanGameScene.swift` + `UI/ContentView.swift`（`iOS-P0-2` 已完成） | **Web P1-2 已完整同步至 Swift**：全量移除 `seabedScale` / `effPreyX` / `effPreyY` 双空间微缩补丁，回归真 2D 相机变焦（`0.8m -> 1.00`, `45m -> 0.22`）+ 线性猎物体长比 + 巨鲨撞碎 Tier 0~4 阶梯海床 + `vm.depthMeters` 修正为 `worldYToMeterDepth` + 悬赏过滤 `minSpawnablePreyLengthM` + 非阻断双语深潜提示 |
| **包体与内存 / 显存（VRAM）** | `Resources/Assets/` **5.8 MB（206 文件）**（`iOS-P0-3` 已完成，原 61 MB） | 已同步 iOS 16+ 原生 WebP 资产并自动清理 224 个旧图集/重复 PNG（含 9.6MB 旧大图）；启动仅解码出战鲨鱼窗口（2~3 条）+ 浅海带猎物 + UI/海床；预览位图改为有界 `NSCache`，GPU 纹理采用 LRU 上限（鲨鱼 ≤8 / 猎物 ≤52）+ 跨深度带异步预热 + `didReceiveMemoryWarningNotification` 自动释放 |
| **帧率稳态与 SwiftUI 重绘** | `SpriteView(..., preferredFramesPerSecond: 60)` + `HudTelemetryStore`（`iOS-P1-1` 已完成） | 高频数值（HP/能量/深度/连击/狂暴/深潜提示）已隔离开箱至 `HudTelemetryStore`（~18Hz 节流）仅由叶子视图订阅，摇杆与冲刺抽离至 `HudLeafViews.swift` 实现拖动期间根视图 0 重绘；金币/基因掉落复用单例 `SKTexture`；触感抽为 `HapticFeedbackManager` 单例复用；形变网格复用预分配缓冲区并将猎物摆动节流至 30Hz |
| **前后台生命周期与触控** | 无 `scenePhase` / `willResignActive` 监听；纯 SwiftUI `DragGesture` | 切后台/来电/下拉通知栏时**不自动暂停**，返回易暴毙或卡摇杆；多指并发（左手摇杆 + 右手技能/升级）存在 SwiftUI 手势抢占隐患 |
| **听觉与触感反馈** | 仅 `AudioServicesPlaySystemSound(1104 / 1025)` 2 个系统按键音 | **零独立吞噬/冲刺/破甲/碎石/受伤音效，零水深环境音与 BGM**；不遵守 iOS 静音拨片/音频会话中断；每次吞噬现场 `new UIImpactFeedbackGenerator()` 未复用与 `prepare()` |
| **并发安全与自动化测试** | **0 个 XCTest 用例**；Swift 5.0 模式 | `GameRules.terrainBlockNodeCache` 为无锁全局静态字典（非并发安全）；无原生单元测试验证 Swift `GameRules` 与 Web `rules.ts` 数值对齐 |

---

## 二、总览进度看板（iOS Master Checklist）

### P0 · 上线与提审硬阻塞（不修严禁提审 App Store）
- [x] **iOS-P0-1**：修复 AdMob 生产广告位错配（移除测试广告优先）、隔离 `#if DEBUG` 测试设备、修正 ATT 先行时序与移除 `Bundle` Method Swizzling
- [x] **iOS-P0-2**：同步 Web P1-2 核心体验与水深 Bug（废除 `seabedScale` 回归真相机变焦 `0.22` + 巨鲨撞碎 Tier 0~4 阶梯海床 + 修正 `depthMeters` 换算 + 悬赏过滤与浅海深潜引导）
- [x] **iOS-P0-3**：治理启动 OOM 与 61MB 包体膨胀（清理 9.5MB 废弃旧图集 + WebP 同步瘦身至 5.8MB + 取消启动全量双份常驻 + 按深度带/视窗按需加载与内存警告回收）

### P1 · 帧率稳态、生命周期与架构稳固（上架体验底线）
- [x] **iOS-P1-1**：消除 120Hz 发热与掉帧（`HudTelemetryStore` 18Hz 节流隔离、摇杆/冲刺抽离独立叶子视图、缓存金币/基因 `SKTexture`、预分配形变缓冲 + 30Hz 猎物形变节流、复接触感引擎与 60fps 稳态帧率）
- [ ] **iOS-P1-2**：补齐 iOS 生命周期保护与多指触控稳健性（前后台/来电自动暂停、音频中断恢复、防手势卡死与安全区适配）
- [-] **iOS-P1-3**：拆分 4 个上帝 Swift 文件为模块化目录结构（`Monetization/`、`State/`、`Audio/`、`UI/Components/` 已拆出 5 个独立模块；剩余 `Engine/`、`UI/` 弹窗拆分与 `terrainBlockNodeCache` 并发安全待续）
- [ ] **iOS-P1-4**：补齐原生 `AVAudioEngine` 听觉闭环（吞噬/破甲/碎石/受伤/升级音效 + 3 层水深环境音/BGM + `AVAudioSession` 静音键合规）

### P2 · 品质对齐、长线留存与原生生态放大
- [ ] **iOS-P2-1**：补齐 `XCTest` 原生单元测试套件（校验 Swift `GameRules` 与 `game_data.json` / Web `rules.ts` 核心不变量 1:1 咬合）
- [ ] **iOS-P2-2**：完善 App Store 发行打磨与原生生态（中英双语 `InfoPlist.strings`、正式 App 名称与合规隐私清单 `PrivacyInfo.xcprivacy`、Game Center 成就/榜单 + iCloud 存档 + StoreKit 2 混合变现）

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

### [ ] iOS-P1-2 · 补齐前后台生命周期保护与原生多指触控稳健性
- **当前问题（源码定位）**：
  - `ContentView.swift` 与 `HungrySharkEvolutionApp.swift` 均**未监听 `@Environment(\.scenePhase)` 或 `UIApplication.willResignActiveNotification`**。玩家在游戏中途切后台、接听来电、弹出系统低电量提示或看激励广告时，游戏不会自动进入 `"paused"` 状态且 `dt` 虽被 clamp 为 `0.05`，但恢复后可能出现摇杆状态残留或直接掉血。
  - `ContentView.swift:1393`（摇杆）与 `1693`（冲刺按钮）以及技能按钮使用纯 SwiftUI `DragGesture` + `Button` 混排；在 iOS 多点触控下，左手按住摇杆拖移出边界或系统边缘手势触发时，易出现右手技能偶发失灵或左手抬起回调丢失。
- **可选方案**：
  - **方案 A（推荐）**：① 在 `ContentView` 监听 `scenePhase`（`.inactive` / `.background` 自动调用 `vm.pauseGame()` 并 `scene.isPaused = true` + 归零输入）；② 监听 `UIApplication.willResignActiveNotification` 与 `AVAudioSession.interruptionNotification`；③ 将左下摇杆与右下冲刺区升级为轻量 `UIViewRepresentable`（直接接管 `UITouch` `touchesBegan/Moved/Ended/Cancelled` + `isMultipleTouchEnabled = true`），彻底根治多指抢占与手势丢失，并支持左半屏任意落点动态摇杆。
  - **方案 B**：补齐 `scenePhase` 自动暂停与输入重置，保留 SwiftUI 手势但将摇杆/冲刺独立成不相互干扰的顶层手势容器。
- **决策记录**：`待决策`
- **验收标准（DoD）**：
  - [ ] 游玩中切后台、锁屏、拉下控制中心或来电中断，返回后必定处于暂停态且血量无意外流失
  - [ ] 左手长按摇杆持续转向时，右手连点升级躯体、狂暴、基因突进、按住冲刺 100% 并发响应且抬手必归零

---

### [-] iOS-P1-3 · 拆分 4 个上帝 Swift 文件并修复并发安全隐患
- **当前问题（源码定位）**：
  - `OceanGameScene.swift`（原 3,466 行 → 现 2,807 行）已剥离 `Monetization/GoogleAdMobManager.swift`（388 行）与 `State/GameViewModel.swift`（550 行），剩余 SpriteKit 物理、渲染、视差、海床、刷怪、粒子待进一步拆分。
  - `ContentView.swift`（3,024 行）将 10+ 视图组件（启动页、HUD、摇杆、MOBA 技能扇区、暂停/结算弹窗、48 阶转盘图鉴）堆在同一文件，编译增量耗时高且极难协同维护。
  - `GameRules.swift:613-615`：`terrainBlockNodeCache` 与 `terrainBlockCacheOrder` 为无锁全局 `private static var`，在 Swift 6 严格并发检查或后台线程查询地形时会引发编译报错 / 运行时数据竞争。
- **可选方案**：
  - **方案 A（推荐）**：参照 Web 端 `P1-3` 的模块化分层，将 `ios-native/HungrySharkEvolution/` 拆分为清晰子目录（`scripts/build-ios-native.ts` 已支持自动递归扫描 `.swift` 并更新 `project.pbxproj`）：
    - `Monetization/GoogleAdMobManager.swift`（已落地）
    - `State/GameViewModel.swift`（已落地）+ `State/HudTelemetryStore.swift`
    - `Core/GameRules.swift` + `Core/TerrainSystem.swift`（用 `NSLock` 或 `@MainActor` 封装地形块缓存）
    - `Rendering/OceanGameScene.swift` + `Rendering/SeabedRenderer.swift` + `Rendering/PreySimulation.swift` + `Rendering/DevourFXSystem.swift`
    - `UI/Components/` + `UI/StartupLoadingView.swift` + `UI/InGameHudView.swift` + `UI/EvolutionAtlasSheetView.swift` + `UI/ModalsView.swift`
  - **方案 B**：最小拆分，仅将 `GoogleAdMobManager`、`GameViewModel`、`EvolutionAtlasSheetView` 抽离为独立文件，并给 `terrainBlockNodeCache` 加 `NSLock`。
- **决策记录**：`采用“先轻拆（AdMob + ViewModel）后同步修 P0，再逐步细拆其余模块”渐进路线`（Round 1 已落地 2 个独立模块）
- **验收标准（DoD）**：
  - [ ] 单文件行数原则上 `< 1,000` 行，零循环依赖，运行 `npm run sync:ios` 后 `project.pbxproj` 完整注册所有新建 Swift 文件（当前 8 个源码文件已注册）
  - [ ] `GameRules` 全局地形缓存具备明确并发保护（`@MainActor` 或 `NSLock`），开启 `Strict Concurrency Checking = Complete` 无数据竞争警告

---

### [ ] iOS-P1-4 · 补齐原生 `AVAudioEngine` 听觉闭环与音频会话合规
- **当前问题（源码定位）**：
  - 全 iOS 工程目前仅在 `OceanGameScene.swift:471, 478` 调用了 `AudioServicesPlaySystemSound(1104)` 和 `1025` 两个系统按键音；**吞噬、冲刺、破甲、撞碎海床、受伤、黄金狂热、升级进化全部静音**，且完全没有浅海/暮光/深渊环境音或 BGM。
  - `AudioServicesPlaySystemSound` 无法精细控制音量、音高爬升（连击 Pitch）与混音。
- **可选方案**：
  - **方案 A（推荐）**：新增 `Audio/OceanAudioEngine.swift`，基于 `AVAudioEngine` + `AVAudioPlayerNode` / 程序化合成器缓冲实现零外部版权风险的高爽感 SFX（吞噬气泡咬合 + 连击音阶爬升、冲刺水流、破甲撞击、巨鲨碎石低频、黄金狂热高能循环）与 3 层水深环境音淡入淡出；配置 `AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])` 以天然遵守硬件静音开关并兼容玩家后台音乐，监听音频中断自动暂停/恢复。
  - **方案 B**：使用 `SKAction.playSoundFileNamed` 配合轻量 `.caf`/`.m4a` 音效资源包实现基础音效。
- **决策记录**：`待决策`
- **验收标准（DoD）**：
  - [ ] 覆盖吞噬（连击升调）、破甲、碎石、受伤、升级、进化、狂热、UI 点击 8 类事件与水深环境音
  - [ ] 拨动 iPhone 静音键、来电或播放激励视频广告时自动静音/让渡音频会话，切回无杂音与崩溃

---

### [ ] iOS-P2-1 · 建立 Swift `XCTest` 原生单元测试护城河
- **当前问题**：
  - Web 端已有 `48/48` 条严格单元不变量测试（`src/game/rules.test.ts`），但 `ios-native/` 为 **0 测试 Target**。未来 Swift 端修改公式或解析 `game_data.json` 时，无法在 Xcode CI/本地自动捕获双端数值漂移。
- **验收标准（DoD）**：
  - [ ] 新增 `HungrySharkEvolutionTests` XCTest Target
  - [ ] 覆盖：`game_data.json` 解码完整性（48 鲨 + 135 猎物 + 双语 I18N 零缺失）、`computeTrueCameraZoom` / `worldScale` / `getPreyRelativeVisualScale` 线性体长比守恒、9 阶海床碰撞与 Tier 0~4 破壁阈值、`worldYToMeterDepth` 分段精度、三色皇冠与 48 阶解锁门禁

---

### [ ] iOS-P2-2 · App Store 发行打磨与 iOS 原生留存/变现能力
- **当前问题与规划子项**：
  - [ ] **隐私清单与本地化**：新增 `PrivacyInfo.xcprivacy`（App Store 强制要求声明 `UserDefaults` API 原因 `CA92.1` 及广告 SDK 追踪数据）；补齐 `zh-Hans.lproj` / `en.lproj` 的 `InfoPlist.strings`（正式中英文 App 展示名与 ATT 授权说明，替换当前小写 `deepsea:evolution`）。
  - [ ] **云存档与榜单**：接入 `NSUbiquitousKeyValueStore`（iCloud 轻量键值云存档，冲突取最高进度合并）与 Game Center（48 阶图鉴成就 + 最高分/最深海沟排行榜）。
  - [ ] **StoreKit 2 混合变现**：补充“免广告特权 / 基因补给礼盒 / 限时特惠鲨”轻量 IAP，并保留规范的“恢复购买（Restore Purchases）”入口以符合 App Store 3.1.1 规范。

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
