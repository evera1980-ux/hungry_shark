# 07 · 项目深度 Review 与可追踪整改计划（Action Plan）

> **文档定位**：将资深游戏开发（主程/架构）与产品经理（玩法/留存/商业化）双重视角的项目 Review 结论落盘为**可勾选、可逐条推进、带明确验收标准（DoD）**的执行清单。
> **状态说明**：`[ ]` 待启动 ｜ `[-]` 进行中 ｜ `[x]` 已完成并验证
> **创建日期**：2026-11-21

---

## 一、现状基线快照（Review Baseline）

| 维度 | 当前实测基线 | 关键风险 / 问题 |
| :--- | :--- | :--- |
| **代码规模** | ~54,488 行 TS/TSX | 高度集中于 3 个上帝文件：`build-ios-native.ts`（12,422 行）、`worldGenerationSystem.ts`（11,284 行）、`App.tsx`（5,447 行） |
| **编译健康度** | `npx tsc --noEmit` **失败（6 个 Error）** | 半途回滚遗留 5,583 行孤儿死代码（`useSharkSimulation.ts` + 5 个未引用组件）阻塞编译 |
| **自动化测试** | `npx tsx --test src/game/rules.test.ts` **45/45 通过** | 纯逻辑不变量覆盖良好，是后续重构的核心护城河 |
| **Web 资源体积** | `public/assets/` **~61 MB**（`aistudio` 35MB + `prey_140` 19MB + `sharks_3x` 7MB） | 启动时双重加载鲨鱼大图（7.2MB）+ 48 张单图（7MB）+ 废弃旧鱼图集（2.3MB），且在主线程逐张 `getImageData` 裁切 134 张 PNG |
| **生态阶位分布** | 135 种猎物中 **89 种（66%）挤在 T1**，最高仅到 **T36（1 种）** | `T4/5/6/9/12/17/19/21/25/26/27/30/33/34/35` 与 **`T37~T48` 完全为 0**，48 阶鲨鱼后期无同阶生态 |
| **缩放与拟真** | `0.8m -> 45.0m` 线性缩放（最大 56x 缩小）+ `L_min = L_shark * 0.133` | 巨鲨阶段海床与珊瑚被压缩成像素噪点，浅海出现“无鱼可吃”空海死区 |
| **商业化接入** | `adManager.ts` 4 激励位 + 结算插屏 | 插屏误用激励 Unit ID；微信/抖音 SDK 误传 Google AdMob ID；缺少频控且默认降级链存在白嫖发奖风险 |
| **音频体验** | `audio.ts`（181 行）纯振荡器 6 种 SFX | 缺少分深度 BGM/环境音、黄金狂热变奏与连击音高递增 |
| **长线留存** | 仅 `localStorage` 存档 + 48 阶图鉴 + 三色皇冠 | 缺少血统主动技能、Boss 战、每日任务/成就、云存档与排行榜 |
| **文档一致性** | `AGENTS.md` 与 `docs/00~06` | `AGENTS.md` 仍残留旧规范（“32种生物”、“<=64%/>=118%尺寸契约”），与现行 135 猎物 + 真实体长比脱节 |

---

## 二、总览进度看板（Master Checklist）

### P0 · 立即止血（上线硬阻塞项）
- [x] **P0-1**：清理 5,583 行孤儿死代码 & 恢复 `tsc --noEmit` 0 Error 绿灯
- [x] **P0-2**：Web 资源包体瘦身（61 MB → < 10 MB）& 消除启动期重复加载与主线程 `getImageData` 卡顿
- [ ] **P0-3**：修复 `adManager.ts` 跨平台广告位配置错误、补齐频控与防白嫖兜底

### P1 · 上线前必做（核心体验与架构稳固）
- [ ] **P1-1**：重平衡 135 种猎物的 `T1 ~ T48` 阶位分布（消除 T1 拥挤与 T37~T48 生态真空）
- [x] **P1-2**：修正 `0.8m -> 45.0m` 巨鲨缩放与浅海空海闭环（废除微缩投影补丁、回归真相机变焦 + 撞碎上层阶梯海床 + 浅海深潜引导）
- [x] **P1-3**：拆分上帝文件（`worldGenerationSystem.ts` / `App.tsx`）并同步刷新 `AGENTS.md` 与 `docs/`
- [ ] **P1-4**：补齐听觉闭环（浅海/暮光/深渊 3 层自适应环境音与 BGM + 黄金狂热变奏 + 连击音阶爬升）

### P2 · 商业化与长线留存放大
- [ ] **P2-1**：补强中后期留存玩法（4 大血统主动技能 + 局内 Boss 战 + 每日任务/成就 + 云存档/榜单）
- [x] **P2-2**：重构 Web ↔ iOS 双端同步架构（摆脱 12,422 行 TS 模板字符串拼 Swift 源码）

---

## 三、逐条任务详细规格与验收清单

### [x] P0-1 · 清理孤儿死代码，恢复编译绿灯
- **当前问题**：
  - `src/game/useSharkSimulation.ts`（3,722 行）及 `src/components/{InGameHud,GameOverModal,TitleScreen,PauseModal,DebugPanel}.tsx`（1,861 行）已不被 `src/App.tsx` 引用，却导致 `npx tsc --noEmit` 报 6 个错。
  - `config.ts`、`rules.ts`、`OrganCanvasPreview.tsx`、`src/game/legacy/` 残留早期“外挂器官”遗留代码。
- **可选方案**：
  - **方案 A（推荐）**：删除 6 个报错的孤儿文件，并同步清理已弃用的外挂器官死代码（保留纯逻辑测试兼容）。
  - **方案 B**：仅删除 6 个孤儿文件，暂不动早期器官遗留代码。
  - **方案 C**：修复 6 个孤儿文件类型错误，并把 `App.tsx` 重新迁移到模块化结构。
- **决策记录**：**采用方案 A（2026-11-21 执行完成）** — 已删除 6 个孤儿拆分文件、移除 `OrganCanvasPreview.tsx` 与 `src/game/legacy/organSystem.ts`，并清理 `config.ts` / `rules.ts` / `canvasRenderer.ts` / `spriteSheetManager.ts` / `i18n.ts` 中的全部外挂器官遗留代码，将相关单测迁移至 48 阶本体进化公式 `computeEvolvedSharkStats()`。
- **验收标准（DoD）**：
  - [x] `npx tsc --noEmit` 返回 0 Error
  - [x] `npx tsx --test src/game/rules.test.ts` 全部通过（45/45）
  - [x] `npm run build` 打包成功

---

### [x] P0-2 · 资源瘦身（61MB → <10MB）与加载链路优化
- **当前问题**：
  - `public/assets/` 高达 61 MB；启动同时拉取 `sharks_ec921c3b.png`（7.2 MB）+ 48 张 `sharks_3x`（7.0 MB）+ 已废弃的 `fish_24bdaa5a.png`（1.1 MB）+ `fish2_fc857cfa.png`（1.2 MB）。
  - 后台加载 134 张 `prey_140`（19 MB）时在主线程调用 `cropAndScalePreyImage()` 逐像素 `getImageData` 裁切透明边。
  - 背景图单张达 1.2~2.3 MB 未做 WebP 压缩。
- **可选方案**：
  - **方案 A（推荐）**：离线脚本预裁切透明边 + 全部资产转 WebP（背景/鲨鱼/猎物）+ 移除冗余旧图集加载 + 按深度带懒加载猎物与按需加载鲨鱼。
  - **方案 B**：离线裁切后直接按深度带打包为 3~4 张 WebP Texture Atlas（进一步把 182 个请求降到 <10 个）。
  - **方案 C**：最小改动，仅移除冗余旧图集加载并将大图转 WebP，保留单图结构。
- **决策记录**：**采用方案 A（2026-11-23 执行完成）** — 新增 `npm run optimize:assets`（`scripts/optimize-web-assets.ts`），离线对 135 项猎物（`PREY-001..210` + `cyber_mine`）与 48 阶鲨鱼（`shark_form_00..47`）执行非透明紧致包围盒裁切（`+2px` pad，上限 `420px` 宽）与高保真 WebP 编码，并将 18 项 UI/水幕/海床/生态/POI 图集全面转为 WebP、提取独立 `devour_fx.webp`（`6.7 KB`），清理全部冗余旧图，使 `public/assets/` 从 **61.18 MB（373 文件）降至 4.50 MB（202 文件，-92.6%）**（`ios-native/` 原生 PNG/JPG 保持 100% 不变）；重构 `spriteSheetManager.ts` 移除主线程 `cropAndScalePreyImage`（`getImageData` 逐像素裁切）及旧图集切片器，实装按水深带量化桶懒加载猎物（`selectPreyIdsForDepthBand` / `preloadPreyForDepth`）与按需加载鲨鱼（`ensureSharkLoaded` / `ensureSharkWindowLoaded`，首屏仅加载出战鲨鱼与下一阶目标共 2 张鲨鱼 + 浅海带猎物，首屏资源传输仅 `~2.55 MB`）。
- **验收标准（DoD）**：
  - [x] `public/assets/` 总体积降至 `< 12 MB`（实测 **4.50 MB**，首屏必需资源实测 **2.55 MB** `< 3 MB`）
  - [x] 运行时不再加载 `sharks_ec921c3b.png`、`fish_24bdaa5a.png`、`fish2_fc857cfa.png`
  - [x] 运行时移除 `prey_140` 主线程 `getImageData` 逐像素裁切
  - [x] 画面清晰度与碰撞盒贴合度无回归（离线 `+2px` 紧致裁切与原运行时包围盒一致）

---

### [ ] P0-3 · 修复广告 SDK 配置与变现合规隐患
- **当前问题**：
  - `adManager.ts:299` 将 Google AdMob 的 `admobRewardedAdUnitId` 传给微信/抖音小游戏 SDK。
  - `adManager.ts:391` `showInterstitialAd()` 默认参数错误复用了 Rewarded Video 的 Unit ID。
  - 缺少各广告位冷却时间（Cooldown）与每日次数上限，且默认降级路径存在直接 `onReward()` 白嫖发奖漏洞。
- **可选方案**：
  - **方案 A（推荐）**：拆分独立配置项（AdMob 激励/插屏、微信激励/插屏、抖音激励/插屏），补齐统一频控状态机，生产环境禁止未观看完直接发奖，仅在显式 Dev Flag 下启用浏览器模拟播放。
  - **方案 B**：仅修复 Unit ID 错配与移除白嫖发奖，暂不加频控 UI。
- **决策记录**：`待决策`
- **验收标准（DoD）**：
  - [ ] 激励视频与插屏广告使用完全独立的 Unit ID 配置与环境变量映射
  - [ ] 微信/抖音小游戏使用独立 AdUnit 配置，不再串用 AdMob ID
  - [ ] 具备广告位冷却与错误提示，非开发模式严禁失败时直接调用 `onReward()`

---

### [ ] P1-1 · 重平衡 135 种猎物的 T1~T48 阶位生态曲线
- **当前问题**：
  - 89/135 种猎物全挤在 `T1`，15 个中间阶位为 0，`T37~T48` 全空（最高仅 1 种 `T36`），导致 48 阶鲨鱼成长阶梯断层。
- **可选方案**：
  - **方案 A（推荐）**：保留 48 阶鲨鱼体系，按体长与深度带对 135 种猎物重新映射到连续分布的 `T1~T42`，并在深渊/异界层补足 `T37~T48` 终极猎物与巨型敌对单位。
  - **方案 B**：将鲨鱼咬合阶位从 `T1~T48` 收敛为更紧凑的 **`T1~T16`**（每 3 阶鲨鱼共用 1 个咬合阶位），让 135 种猎物在每个阶位都有 6~10 种丰富生态。
  - **方案 C**：保持当前阶位表不动，通过动态精英变体（黄金/变异/巨化）填补高阶空缺。
- **决策记录**：`待决策`
- **验收标准（DoD）**：
  - [ ] 不再存在 50% 以上生物堆叠在单一阶位的情况
  - [ ] 玩家从 1 阶成长到最高阶，每一代都有明确的“由躲避/破甲变为直接吞噬”的标志性猎物
  - [ ] `rules.test.ts` 新增阶位覆盖率与生态连续性单元测试

---

### [x] P1-2 · 修正 45m 巨鲨缩放与浅海空海问题
- **当前问题**：
  - 原 `seabedScale = 0.8 / realBodyLengthM` 双空间微缩投影补丁导致 `45m` 鲨鱼阶段海床与珊瑚被缩小 56 倍坍塌成噪点，且在浅海出现无提示的空海死区与阶梯洞口卡死风险。
- **决策记录**：**2026-11-23 按用户确认的四项核心支柱执行完成** —
  1. **废除 `seabedScale` 微缩投影补丁，回归单一 1:1 世界空间 + 原生 2D 真相机变焦**：在 `rules.ts` 新增 `CAMERA_ZOOM_MIN = 0.22`、`MIN_RENDER_ZOOM_FLOOR = 0.14`、`computeTrueCameraZoom(L)` 与 `stats.worldScale = scale / cameraZoom`，全量清除 `renderOceanWorld.ts` / `stepSimulation.ts` / `seabedRenderer.ts` / `worldRenderer.ts` 中的双空间缩放补丁，并将 `WorldConfig.chunk.maxActiveChunks` 扩容至 `20` 配合 `zoom < 0.45` 自适应海床与植被 LOD。
  2. **猎物保持严格线性生物体长比**：`getPreyRelativeVisualScale` 锚定 `worldScale`，经原生相机变焦投影后严格守恒 `preyScreenSize / sharkScreenSize === (L_prey / L_shark) * bossMult` 且视觉 === 碰撞 100% 同源。
  3. **巨鲨撞碎上层浅海阶梯海床（Tiers 0~4）**：为 `SEABED_TERRACE_TIERS[0..4]` 注入体长破壁门槛（`8m/12m/18m/26m/36m`）与 `breachedTerraceCells` 破口追踪，撞穿时触发碎岩粒子、`soundFX.playRockShatter()` 与镜头震动，同时保留 `Tiers 5~8` 与主海床为深渊不可破坏基岩。
  4. **保持 45m 巨鲨浅海无鱼状态并建立深潜引导闭环**：维持 `minPreyLengthCm = L_shark * 13.3` 迫使巨鲨下潜深海；对齐 `EcosystemSpawner` 在 `zoom = 0.22` 广角视口下的屏外刷怪与回收半径，升级 `rollTargetBountySpecies` 按 `minPreyLengthCm` 过滤并优先指向深海适口猎物，并在 `InGameHudOverlay` 增加滞留浅海 `> 1.5s` 触发的非阻断双语深潜 HUD 提示。
- **验收标准（DoD）**：
  - [x] 全链路彻底移除 `seabedScale` / `effPreyX` 双空间投影补丁，45m 巨鲨在 `cameraZoom = 0.22` 原生 2D 变焦下保持清晰海床纹理与 20-Chunk 无缝覆盖
  - [x] 猎物在全进化阶段保持严格线性体长比与视觉-碰撞同源对齐
  - [x] 达到破壁体长的巨鲨可无阻碍撞碎 `Tier 0~4` 上层阶梯海床，`Tier 5~8` 与主海床保持不可破坏基岩碰撞
  - [x] `rules.test.ts` 新增 P1-2 全量单测（真相机变焦、线性体长比、阶梯破壁、广角刷怪/防误回收、浅海空海与深海生态校验，48/48 全绿）

---

### [x] P1-3 · 拆分上帝文件并同步刷新文档体系
- **当前问题**：
  - `worldGenerationSystem.ts`（11,285 行）与 `App.tsx`（5,448 行）耦合严重；`AGENTS.md` 与部分 `docs/` 仍记录旧规则。
- **决策记录**：**2026-11-22 执行完成** —
  1. `src/game/worldGenerationSystem.ts`（11,285 行 → **15 行**向后兼容 Barrel）拆分为 `src/game/world/` 下 **11 个无环职责子模块**（`worldCore.ts` 630 行、`terrainSystem.ts` 2,249 行、`biomeSystem.ts` 555 行、`ecologyAndPoi.ts` 1,292 行、`chunkStateAndPersistence.ts` 828 行、`worldAssetRegistry.ts` 854 行、`seabedRenderer.ts` 1,186 行、`worldRenderer.ts` 773 行、`chunkLifecycleManager.ts` 526 行、`worldDebug.ts` 493 行、`proceduralWorldSystem.ts` 2,104 行）。
  2. `src/App.tsx`（5,448 行 → **1,607 行**薄层编排容器）拆出 **4 个零 React 依赖的纯 TS 60FPS 引擎模块**（`src/game/sim/SharkGameEngine.ts` 135 行、`stepSimulation.ts` 1,499 行、`renderOceanWorld.ts` 407 行、`types.ts` 641 行）与 **5 个薄层 React UI 覆盖层组件**（`src/components/game/{DebugPanel,TitleScreen,InGameHud,PauseModal,GameOverModal}Overlay.tsx`，共 1,895 行），100% 保留移动端多指触控零重渲染摇杆与 `bindMultiTouchButton` 契约。
  3. 无头 Chromium 真机实测中捕获并顺手根治了 `seabedRenderer.ts` 浅海提前 `return` 及尾部缺失外层 `ctx.restore()` 导致相机矩阵逐帧累乘的隐藏渲染缺陷（改用 `try/finally` 栈守恒 + `renderOceanWorld.ts` 每帧 `ctx.setTransform` 归零保护）。
  4. 同步刷新 `AGENTS.md`、`docs/00-AI_CONSTRAINTS.md`、`docs/01-ARCHITECTURE.md` 与本文档，彻底清理旧“32 种生物”与旧 `<=64%/>=118%` 过期规范。
- **验收标准（DoD）**：
  - [x] `worldGenerationSystem.ts` 按职责拆分为地形样条 / 生态群落 / 装饰物 / 渲染 / 生命周期共 11 个无环子模块（入口 15 行兼容导出）
  - [x] `App.tsx` 核心 60fps 模拟与渲染循环抽离为独立纯 TS 引擎类（`SharkGameEngine`），React 拆分为薄层编排壳 + 5 个独立 UI 覆盖层
  - [x] `AGENTS.md` 与 `docs/00` / `01` / `07` 全面同步现行真实规则，消除文档过期漂移
  - [x] `rules.test.ts` 46/46 全绿、`tsc --noEmit` 0 Error、`npm run build` 成功，且无头 Chromium 真机验收（Title / Playing / Pause 三态）画面完整、Console 0 Error 0 Warning

---

### [ ] P1-4 · 补齐听觉闭环（BGM + 深度环境音 + 爽感反馈）
- **当前问题**：
  - 仅 6 个合成器音效，无 BGM、无深度声景变化、无连击音阶爬升。
- **决策记录**：`待决策`
- **验收标准（DoD）**：
  - [ ] 浅海 / 暮光 / 深渊 3 层无缝淡入淡出环境音或程序化动态配乐
  - [ ] 黄金狂热（Gold Frenzy）触发专属高能变奏，连击吞噬支持音高阶梯递增
  - [ ] 静音开关与后台切出自动暂停音频上下文无泄漏

---

### [ ] P2-1 · 中后期留存玩法与商业化闭环升级
- **待规划子项**：
  - [ ] 4 大血统（生物 / 机甲 / 元素 / 深渊）各 1 套差异化主动技能
  - [ ] 阶段性 Boss 战（海面猎鲨战舰 / 深渊克拉肯 / 核动力潜艇）
  - [ ] 每日任务、里程碑成就与云存档（Firebase / 平台云存档）+ 榜单
  - [ ] 混合变现设计（去广告礼盒 / 基因月卡 / 限时特惠鲨）
- **决策记录**：`待决策`

---

### [x] P2-2 · 重构 Web ↔ iOS 双端同步架构
- **当前问题**：
  - `scripts/build-ios-native.ts` 用 12,422 行 TS 字符串生成 Swift 源码，极易双端漂移且无 Xcode 编译期提示。
- **可选方案**：
  - **方案 A（方案 1）**：将数值表/物种库/进化树抽为跨端共享 JSON（`shared/game_data.json`），Swift 原生工程作为正常独立代码库维护，不再用 TS 字符串生成 Swift。
  - **方案 B**：评估以 WebGL（PixiJS）+ Capacitor 统一双端代码，彻底消除双端重复开发成本。
- **决策记录**：**采用方案 A / 方案 1（2026-11-21 执行完成）** — 新增 `src/game/sharedGameData.ts` 导出 `shared/game_data.json` 并同步至 `ios-native/HungrySharkEvolution/Resources/Assets/game_data.json`；`GameConfigGenerated.swift` 由 6,489 行精简为 ~255 行 `JSONDecoder` 轻量加载器并 100% 保持原公开 Swift API；`scripts/build-ios-native.ts` 由 12,423 行瘦身至 ~440 行，仅负责 JSON 导出、资源同步与 `project.pbxproj` 刷新（动态扫描 `.swift` 并注册 `game_data.json`），不再覆盖任何 Swift 源码；新增 `npm run sync:ios` 别名与跨端 JSON 契约单测。
- **验收标准（DoD）**：
  - [x] `scripts/build-ios-native.ts` 彻底移除 TS 字符串拼接 Swift 源码模板（12,423 行 → ~440 行），且永不覆盖 `ios-native/` 下任何 `.swift` 文件
  - [x] `shared/game_data.json` 与 `ios-native/HungrySharkEvolution/Resources/Assets/game_data.json` 字节一致且已注册进 `project.pbxproj`（`text.json`）
  - [x] `GameConfigGenerated.swift` 改为 `JSONDecoder` 加载并 100% 保留原有公开 Swift API（6,489 行 → ~255 行）
  - [x] `rules.test.ts` 新增跨端共享 JSON 契约单测（46/46 全绿），`tsc --noEmit` 0 Error，`npm run build` 成功（注：当前 Linux 环境无 macOS `xcodebuild`，Xcode 编译待在 macOS 本机打开 `ios-native/HungrySharkEvolution.xcodeproj` 复验）

---

## 四、执行日志（Execution Log）

| 日期 | 任务编号 | 决策内容 | 状态 | 验证结果 |
| :--- | :--- | :--- | :---: | :--- |
| 2026-11-21 | Baseline | 完成双视角深度 Review 并落盘可 Check 计划 | `[x]` | `rules.test.ts` 45/45 通过；`tsc --noEmit` 6 Errors 已定位 |
| 2026-11-21 | P0-1 | 执行方案 A：删除 6 个孤儿文件 + `OrganCanvasPreview` + `src/game/legacy/`，并清理 `config`/`rules`/`canvasRenderer`/`spriteSheetManager`/`i18n` 中的全部旧外挂器官代码 | `[x]` | `tsc --noEmit` 0 Error；`rules.test.ts` 45/45 通过；`npm run build` 成功 |
| 2026-11-21 | P2-2 | 执行方案 1（Shared JSON Data Contract）：新增 `src/game/sharedGameData.ts` 导出 `shared/game_data.json`，`GameConfigGenerated.swift` 重构为 ~255 行 JSON `Codable` 加载器，`scripts/build-ios-native.ts` 瘦身至 ~440 行并停止覆写 Swift 源码，新增 `npm run sync:ios` 与跨端契约单测 | `[x]` | `npm run sync:ios` 成功；`rules.test.ts` 46/46 通过；`tsc --noEmit` 0 Error；`npm run build` 成功 |
| 2026-11-22 | P1-3 | 拆分 `worldGenerationSystem.ts`（11,285→15 行 + `world/` 11 模块）与 `App.tsx`（5,448→1,607 行 + `sim/` 4 引擎模块 + `components/game/` 5 视图覆盖层）；修复浏览器验收捕获的 `seabedRenderer.ts` `ctx.save()` 栈泄漏；同步刷新 `AGENTS.md` 与 `docs/00/01/07` | `[x]` | `rules.test.ts` 46/46 通过；`tsc --noEmit` 0 Error；`npm run build` 成功；无头 Chromium Title/Playing/Pause 三态验证 0 Error |
| 2026-11-23 | P0-2 | 执行方案 A：新增 `scripts/optimize-web-assets.ts`（`npm run optimize:assets`）离线预裁切透明边并全量转 WebP（`public/assets/` 61.18 MB → 4.50 MB，-92.6%）；移除 `sharks_ec921c3b.png` / `fish_24bdaa5a.png` / `fish2_fc857cfa.png` 重复加载与主线程 `getImageData` 猎物裁切；实装按水深带懒加载猎物与按需加载鲨鱼 | `[x]` | `rules.test.ts` 47/47 通过；`tsc --noEmit` 0 Error；`npm run build` 成功；首屏网络资源实测 2.55 MB（2 张鲨鱼 + 浅海带猎物，0 旧图集，0 404） |
| 2026-11-23 | P1-2 | 废除 `seabedScale` 微缩投影补丁，全面回归单一 1:1 世界坐标 + 原生 2D 真相机变焦（`CAMERA_ZOOM_MIN = 0.22` / `worldScale = scale / cameraZoom`）+ 严守线性猎物体长比 + 巨鲨撞碎上层阶梯海床（`Tier 0~4: 8/12/18/26/36m`，`breachedTerraceCells`）+ 保持浅海空海并实装广角视口刷怪/回收同步与双语 HUD 深潜引导 | `[x]` | `rules.test.ts` 48/48 通过；`npm run sync:ios` 同步；`tsc --noEmit` 0 Error；`npm run build` 成功 |
