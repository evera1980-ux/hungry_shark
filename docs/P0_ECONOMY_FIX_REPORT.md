# Task 02：P0 经济与进度完整性修复报告 (`P0_ECONOMY_FIX_REPORT`)

> **文档状态**：Task 02 P0 修复已全部完成并经双端验证。**严格遵守阶段边界：本次仅解决 P0 级经济结算、Trial 正式进度隔离与结算防漏洞问题，未调整任何 P1/P2 经济数值，未修改 Bite Tier 节点，未开发 Achievement 与 Mission。**

---

## 一、已落地产品决策摘要

依据主策划确认的 Task 02 准入决策（同步归档于 [ECONOMY_FIX_ROADMAP.md](file:///Users/ev/Projects/hs_ios/hungry_shark/docs/ECONOMY_FIX_ROADMAP.md)）：

- **D0（Web 捕食结算唯一来源）**：对齐 iOS 单源机制，普通捕食与特殊鱼吃鱼走统一链路 `捕食事件 -> buildPredationRewardPlan() 计算本次奖励 -> 生成金币 / DNA 拾取物 -> collectPickupEntity() 拾取统一入账并保留浮动文字反馈`。悬赏（Bounty）等里程碑事件保持单次直接入账并同步计入本局收益统计，不生成重复拾取物。
- **D1（Trial 本局资源带回规则）**：Trial（试玩）期间通过拾取与悬赏获得的本局金币和基因**允许带回正式存档**（计入 `bankedCoins` / `bankedGenes`），但**严禁**发放试玩鲨鱼 Mastery Crown（王冠）与基因翻倍奖励，且**严禁**在 Trial 结束时触发 `DOUBLE_SETTLEMENT` 2x 广告。
- **D2（Trial 正式成长进度全量隔离）**：除 `D1` 明确允许的本局金币/基因外，其余一切永久成长与统计数据在 Trial 期间全部严格隔离，双端统一经 **`isEligibleForPermanentProgress`** 网关守门。

---

## 二、统一架构改造：正式进度资格判定接口 (`isEligibleForPermanentProgress`)

为消除各模块各自判断 `trialActive` / `trialSharkIdForRun` 导致的遗漏风险，本次在 Web 与 iOS 建立了语义对称的统一资格判定网关与永久变更入口：

| 平台 | 核心接口与类型 | 统一管控范围 | 源码位置 |
| :--- | :--- | :--- | :--- |
| **Web** | `PermanentProgressRunContext`、`PermanentProgressEligibility`、`isEligibleForPermanentProgress()`、`getPermanentProgressEligibility()`、`evaluateSharkUnlockForRun()`、`recordFormalRunStarted()`、`recordPermanentRunProgress()`、`claimOnboardingStarterGift()` | `bestInRunLevel`、`bestDepthReached / maxDepthReached`、活体与局外 `evaluateSharkUnlock`、Shark Mastery Crown、未来 Achievement / Mission / 图鉴发现、`totalRunsPlayed`、一次性新手起步礼 | [sharkEvolutionConfig.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sharkEvolutionConfig.ts)、[rules.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/rules.ts) |
| **iOS** | `PermanentProgressRunContext`、`PermanentProgressEligibility`、`GameRules.isEligibleForPermanentProgress()`、`getPermanentProgressEligibility()`、`recordFormalRunStarted()`、`recordPermanentRunProgress()`、`claimOnboardingStarterTopUp()`、`evaluateSharkUnlockForRun()` | `bestInRunLevel`、`bestDepthReached / maxDepthReached`、局内/结算 `evaluateSharkUnlock`、Shark Mastery Crown、`totalRuns`、一次性新手起步补给、GameViewModel 透传属性（`isActiveTrialInRun` / `permanentProgressContext` / `permanentProgressEligibility`） | [GameRules.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Core/GameRules.swift)、[GameViewModel.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/State/GameViewModel.swift) |

---

## 三、P0 问题修复明细（修复前 / 修复后 / 修改文件 / 测试结果 / 存档兼容性）

### P0-1：Web 捕食奖励重复结算、拾取物去重与双端幂等防线

- **修复前**：
  1. Web `stepSimulation.ts` 在吃鱼瞬间直接执行 `shark.coins += earnedCoins; shark.genes += earnedGenes;`，同时在场景生成可拾取的金币 / `DNA_CRYSTAL` 掉落物，玩家拾取时再次入账，导致普通捕食双重结算。
  2. 部分低阶鱼（`T1~T17`）在拾取物生成分支存在 0% DNA 掉落死区。
  3. Web 与 iOS 均缺乏针对同一 `Prey` / `Pickup` 实体在同帧物理碰撞或对象池回收边界的原子幂等锁；且 Web `MAX_PICKUPS = 65`、`MAX_FLOAT_TEXTS = 36` 在全拾取结算模式下容易过早顶替未拾取资源。
  4. `runSnapshot` 缺少独立的本局货币增量字段，Bounty 事件与普通拾取之间的局统计一致性及 Trial 状态下的个人最佳 / 王冠显示未完整解耦。
- **修复后**：
  1. **单源结算规划**：在 Web `src/game/rules.ts` 新增纯函数 `buildPredationRewardPlan()` 与 `collectPickupEntity()`；`stepSimulation.ts` 移除吃鱼瞬间直接入账逻辑，普通鱼与特殊鱼统一按 `buildPredationRewardPlan()` 生成 `1..4` 枚 `COIN` 及 `DNA_CRYSTAL` 拾取物（同步消除 `T1~T17` 的 0% DNA 死分支），并在收集时由 `collectPickupEntity()` 唯一入账与累计 `runCoinsEarned` / `runGenesEarned`。
  2. **UI 反馈与特殊事件保留**：拾取收集时保留并触发精细化 `+X🪙` / `+Y🧬` 浮动文字反馈；Bounty 悬赏等特殊里程碑事件走一次性直发通道并同步累加 `runCoinsEarned` / `runGenesEarned`，不额外吐出重复拾取物。
  3. **事件与实体幂等防重 + 池扩容**：
     - Web 在 `PreyEntity` 增加 `devoured?: boolean`（对象池弹出/生成时重置，回收时锁定），在 `SharkSimState` 增加 `settledPreyUids: Set<number>` 与 `nextPickupId`，确保同一次捕食事件（同一猎物 `uid`）即使重复进入碰撞也绝不重复结算；在 `PooledPickup` 增加 `collected?: boolean` 与 `id?: number`，确保每枚拾取物最多收集一次；将 `MAX_PICKUPS` 扩容至 `120`、`MAX_FLOAT_TEXTS` 扩容至 `64`，且 `spawnPooledPickup()` 优先分配未激活槽位。
     - iOS 在 `ActivePrey` 增加 `isDevoured` 守卫覆盖 `.DEVOUR` 与 `.ARMOR_CRUSH` 双分支，并在 `ActivePickup` 增加 `isCollected` 与 `collectIfEligible()` 防止同帧多重拾取。
  4. **`RunSummary` 准确性**：Web `EconomyUsesState` 新增独立 `runCoinsEarned` / `runGenesEarned`（`startNewRun` 清零，`settledPreyUids` 清空），`runSnapshot` 准确反映本局真实收益并在 Trial 下屏蔽 `isNewRecord`、`personalBestScore`、`masteryGenesBonus`、`masteryCrownTier`。
- **修改文件**：
  - Web：[rules.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/rules.ts)、[canvasRenderer.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/canvasRenderer.ts)、[ecosystemSpawner.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/ecosystemSpawner.ts)、[types.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sim/types.ts)、[stepSimulation.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sim/stepSimulation.ts)、[App.tsx](file:///Users/ev/Projects/hs_ios/hungry_shark/src/App.tsx)
  - iOS：[PreySimulation.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Rendering/PreySimulation.swift)、[OceanFXSystem.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Rendering/OceanFXSystem.swift)
- **测试结果**：
  - Web 测试用例 `Task 02 P0-1: Single-source predation reward plan, pickup deduplication, duplicate prey guard & RunSummary accuracy`（`0.323708ms`）通过。
  - iOS 测试用例 `testPickupDeduplicationAndGoogleAdMobPersistenceAndMutex`（`0.004s`）通过。
- **存档兼容性**：**100% 兼容**。所有防重标记（`devoured`、`collected`、`settledPreyUids`、`runCoinsEarned`、`runGenesEarned`、`isDevoured`、`isCollected`）均为运行时内存状态，不改动既有持久化字段格式。

---

### P0-2：Trial 正式进度隔离、`totalRuns` 计数防重、局中养殖隔离与资源防刷防线

- **修复前**：
  1. Trial 试玩期间，Web 与 iOS 均允许刷新永久 `bestInRunLevel` 与 `bestDepthReached` / `maxDepthReached`，且 Web 在局内每 `120ms` 将 Trial 高等级/高深度实时传入 `evaluateSharkUnlock` 解锁正式鲨鱼。
  2. Web 与 iOS 在 Trial 进行中仍可打开进化图鉴或局内快捷栏升级/解锁/切换正式鲨鱼。
  3. 双端将 Trial 局也计入 `totalRunsPlayed` / `totalRuns`，且 Web 在 `gameover` 时累加导致看广告复活后二次结算重复 `+1`。
  4. `HOLD_BOOST` 新手引导补给缺少持久化已领标记；Web 升级/开启主动技能前缺少将 `sim.shark.coins`/`genes` 同步入库；iOS `GoogleAdMobManager` 频控与每日上限仅存内存且缺少防重入互斥锁，强杀 App 可重置频控；iOS `reviveUsedInCurrentRun`、`returnToTitle()` 与退后台时主动持久化亦存在缺口。
- **修复后**：
  1. **Trial 永久进度全面隔离**：
     - `bestInRunLevel`、`bestDepthReached / maxDepthReached`、图鉴探索/成就/任务资格统一经 `recordPermanentRunProgress()` 判定，Trial 局仅更新本局展示，严禁污染永久存档。
     - Web 局内与结算解锁统一改走 `evaluateSharkUnlockForRun()`（Trial 直接跳过解锁）；`getCurrentProgressContext()` 在 Trial 期间将图鉴所需 `liveRunLevel` / `liveRunMaxDepth` 钳制为 `1` / `0`。
     - **局中升级/解锁/切换全面锁定**：Web `App.tsx` 与 `SharkEvolutionAtlasModal.tsx`（显示 `trialLockedInRun` 提示横幅）、iOS `GameViewModel.swift`（拦截 `upgradeActiveSharkBody` / `upgradeSharkForm` / `unlockSharkForm` / `selectSharkForm` / `evolveToNextReadySharkInRun`）、`ContentView.swift` 与 `EvolutionAtlasSheetView.swift`（展示 Trial 预览横幅并禁用相关操作）在 Trial 进行中全面禁止改造正式鲨鱼进度；回到 GameOver 结算后恢复使用正式货币培养已解锁鲨鱼。
  2. **开局计次纠偏与状态收口**：Web 与 iOS 统一调用 `recordFormalRunStarted()` 在正式开局计 `1` 次 `totalRunsPlayed` / `totalRuns`（Trial 与复活不再累加）；Web 返回标题时强制刷新货币保存并将 `sim.shark.trialActive = false` 清零。
  3. **新手补给防刷与双端安全加固**：
     - Web 与 iOS 在 `SharkMetaSaveData` 新增 `onboardingGiftClaimed` 字段，分别经 `claimOnboardingStarterGift()` 与 `claimOnboardingStarterTopUp()`（锚定 Lv.1 起始升级成本 `22C`）严格限领一次。
     - Web 在执行升级、解锁、开启 `Gold Overdrive` 与 `Gene Surge` 前先同步 `sim.shark.coins`/`genes`。
     - iOS `GameViewModel` 增加 `reviveUsedInCurrentRun` 单局复活限次，`returnToTitle()` 与 `ContentView.handleAppResignedActive()` 主动调用 `persistSave()` 落盘；`GoogleAdMobManager` 新增 `UserDefaults` 持久化（`PersistedAdFrequencyState`，存储键 `"hs_ios_ad_freq_v1"`）及 `isInFlight` 并发互斥锁，阻断强杀刷广告冷却或重叠回调。
- **修改文件**：
  - Web：[sharkEvolutionConfig.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sharkEvolutionConfig.ts)、[rules.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/rules.ts)、[stepSimulation.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sim/stepSimulation.ts)、[App.tsx](file:///Users/ev/Projects/hs_ios/hungry_shark/src/App.tsx)、[SharkEvolutionAtlasModal.tsx](file:///Users/ev/Projects/hs_ios/hungry_shark/src/components/SharkEvolutionAtlasModal.tsx)
  - iOS：[GameRules.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Core/GameRules.swift)、[GameViewModel.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/State/GameViewModel.swift)、[OceanGameScene.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Rendering/OceanGameScene.swift)、[GoogleAdMobManager.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Monetization/GoogleAdMobManager.swift)、[ContentView.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/UI/ContentView.swift)、[EvolutionAtlasSheetView.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/UI/EvolutionAtlasSheetView.swift)
- **测试结果**：
  - Web 测试用例 `Task 02 P0-2 / P0-4 / P0-7: Unified Trial permanent-progress gate, unlock isolation & onboarding one-time gift`（`0.229667ms`）通过。
  - iOS 测试用例 `testUnifiedPermanentProgressGateAndTrialIsolation`（`0.000s`）、`testOnboardingOneTimeTopUpAndLegacySaveMigration`（`0.001s`）、`testPickupDeduplicationAndGoogleAdMobPersistenceAndMutex`（`0.004s`）全部通过。
- **存档兼容性**：**向后兼容并自动迁移**。
  - Web `loadSharkMetaSave()` 兼容读取缺失 `onboardingGiftClaimed` 的旧存档（可选字段 `onboardingGiftClaimed?: boolean`）。
  - iOS `SharkMetaSaveData.init(from:)` 对缺失 `onboardingGiftClaimed` 的历史 JSON 自动执行兼容迁移（校验 `hungry_shark_onboarding_v2_done`、`totalRuns > 0`、`unlockedSharkIds.count > 1` 或 `shark_00_clown_fry > 1`，老玩家存档自动视为已领取，避免升级后二次发奖或丢失任何旧进度）。

---

### P0-3：iOS Trial Crown 漏洞与结算翻倍 (`DOUBLE_SETTLEMENT`) 防护

- **修复前**：
  1. iOS 试玩未解锁高阶鲨鱼达成高分后，`GameViewModel.finalizeRunSettlement()` 直接调用 `settleSharkScoreMastery()` 写入该试玩鲨鱼的正式 Crown，并向玩家发放大量正式 `masteryGenesBonus`。
  2. `finalizeRunSettlement()` 缺少单局结算幂等标记。
  3. `DOUBLE_SETTLEMENT` 翻倍广告存在 `max(30, ...)` / `max(5, ...)` 空局保底，且未拦截 Trial 状态，允许 0 收益试玩/空局刷保底金币与基因。
- **修复后**：
  1. **Trial 标记贯穿结算与 Crown 判定**：iOS `GameRules.settleSharkScoreMastery()` 新增 `runContext: PermanentProgressRunContext`（默认 `isTrial: false`）并接入 `isEligibleForPermanentProgress` 拦截；`GameViewModel.finalizeRunSettlement()` 传入 `permanentProgressContext`，试玩局彻底禁止解锁 Crown 与写入 `masteryGenesBonus`。Web 侧 `settleSharkScoreMastery()` 同步校验 `getPermanentProgressEligibility({ trialActive })`。
  2. **结算幂等与 `DOUBLE_SETTLEMENT` 规则纠偏**：`GameViewModel` 新增 `hasSettledCurrentRun` 幂等锁防止同一局重复结算；移除 `max(30, ...)` / `max(5, ...)` 空局保底，并彻底禁用 Trial 局 `DOUBLE_SETTLEMENT`（仅正式局且本局真实收益 `> 0` 允许单次翻倍）。
  3. **双端结算 UI 对齐**：iOS `ModalsAndSkillFanViews.swift` 按真实 `+runCoinsEarned` / `+runGenesEarned` 展示（无虚高保底）、展示 Trial 试玩说明并在 Trial 或 0 收益时禁用 `DOUBLE_SETTLEMENT`；Web `GameOverModalOverlay.tsx` 同步显示 Trial 结算隔离提示。
- **修改文件**：
  - iOS：[GameRules.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/Core/GameRules.swift)、[GameViewModel.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/State/GameViewModel.swift)、[ModalsAndSkillFanViews.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution/UI/ModalsAndSkillFanViews.swift)
  - Web：[sharkEvolutionConfig.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sharkEvolutionConfig.ts)、[stepSimulation.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/sim/stepSimulation.ts)、[GameOverModalOverlay.tsx](file:///Users/ev/Projects/hs_ios/hungry_shark/src/components/game/GameOverModalOverlay.tsx)
- **测试结果**：
  - iOS 测试用例 `testGameViewModelTrialSettlementDoubleAdAndMidTrialIsolation`（`0.368s`）验证了 Trial 结算 0 Crown / 0 masteryGenesBonus、禁 `DOUBLE_SETTLEMENT`、正式局真收益翻倍、`totalRuns` 与复活幂等，以及局内升级/解锁/切换隔离。
- **存档兼容性**：**100% 兼容**。`settleSharkScoreMastery()` 保留 `runContext` 默认参数；历史正式局已获得的 Crown 与基因完好保留。

---

## 四、Task 02 必测清单对照与验证命令汇总

### 4.1 必测场景覆盖矩阵

| # | Task 02 要求验证场景 | 验证方式 | 状态 |
| :-: | :--- | :--- | :-: |
| 1 | 普通捕食奖励只结算一次 | Web `buildPredationRewardPlan` + `collectPickupEntity` 单源入账实测 | 已通过 |
| 2 | Pickup 重复碰撞 | Web `PooledPickup.collected` + iOS `ActivePickup.collectIfEligible()` 重复收集单测 | 已通过 |
| 3 | 重复捕食事件 | Web `PreyEntity.devoured` + `settledPreyUids` 与 iOS `ActivePrey.isDevoured` 防重守卫 | 已通过 |
| 4 | Trial 达到高等级 | Web & iOS `recordPermanentRunProgress` 验证 `bestInRunLevel` 不入库且不解锁新鲨 | 已通过 |
| 5 | Trial 到达深海 | Web & iOS `recordPermanentRunProgress` 验证 `bestDepthReached / maxDepthReached` 不入库且不解锁新鲨 | 已通过 |
| 6 | Trial 完成 Crown 条件 | Web `settleSharkScoreMastery` 与 iOS `GameViewModel.finalizeRunSettlement` 验证 0 Crown / 0 `masteryGenesBonus` | 已通过 |
| 7 | Trial 结束结算 | 验证本局拾取货币按 D1 保留、`totalRuns` 不增、禁 `DOUBLE_SETTLEMENT`、UI 提示正确 | 已通过 |
| 8 | 正常游戏不受影响 | 既有 50 项 Web 规则测试与 6 项 iOS 原有核心测试全部回归通过 | 已通过 |
| 9 | Web / iOS 行为一致 | 双端 `isEligibleForPermanentProgress`、单源拾取、Trial 隔离与 `onboardingGiftClaimed` 迁移逻辑一致 | 已通过 |

### 4.2 最终全量回归验证结果

- **Web（[src/game/rules.test.ts](file:///Users/ev/Projects/hs_ios/hungry_shark/src/game/rules.test.ts) + TypeScript + Vite 构建）**：
  - `npm run lint` (`tsc --noEmit`)：退出码 `0`（0 错误）。
  - `npx tsx --test src/game/rules.test.ts`：**52 项通过，0 项失败，0 项跳过**（总耗时 `568.390167ms`）。
  - `npm run build` (`vite build`)：退出码 `0`（转换 `458` 个模块，构建耗时 `270ms`）。
- **iOS（[GameRulesTests.swift](file:///Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolutionTests/GameRulesTests.swift)）**：
  - `xcodebuild test -project /Users/ev/Projects/hs_ios/hungry_shark/ios-native/HungrySharkEvolution.xcodeproj -scheme HungrySharkEvolution -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:HungrySharkEvolutionTests/GameRulesTests`：**执行 10 项测试，0 项失败（0 unexpected），耗时 `0.401 (0.404) seconds`，`** TEST SUCCEEDED **`**。

---

## 五、文档同步记录与下阶段边界声明

- **已同步文档**：
  - [AGENTS.md](file:///Users/ev/Projects/hs_ios/hungry_shark/AGENTS.md)（索引新增本报告）
  - [01-ARCHITECTURE.md](file:///Users/ev/Projects/hs_ios/hungry_shark/docs/01-ARCHITECTURE.md)（补充 `onboardingGiftClaimed` 等数据结构及 Changelog）
  - [03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md](file:///Users/ev/Projects/hs_ios/hungry_shark/docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（同步 Web 单源拾取结算、Trial 隔离及 `DOUBLE_SETTLEMENT` 规则与 Changelog）
  - [ECONOMY_FIX_ROADMAP.md](file:///Users/ev/Projects/hs_ios/hungry_shark/docs/ECONOMY_FIX_ROADMAP.md)（标记 `D0`/`D1`/`D2` 已拍板落地与 Task 02 归档）
- **阶段边界声明**：
  - 本阶段**未修改**任何 P1/P2 数值公式、Bite Tier 增长节点（Lv3/Lv6/Lv10 vs Lv5/Lv10 收费）、Crown 基础奖励数值或跨端掉落差异，亦**未开发** Achievement / Mission 系统。
  - 下一步待审核本报告后，进入 **Task 03（基于真实游戏逻辑模块的经济系统模拟器）**，随后再结合实测数据推进 P1 / P2 平衡调优。
