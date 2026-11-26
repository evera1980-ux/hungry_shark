# Task 05：成长体系、经济平衡及全配置表驱动落地报告 (`ECONOMY_BALANCE_IMPLEMENTATION_REPORT`)

> **交付日期**：2026-11-26  
> **决策基准**：全面落实已批准之 `D3=A`、`D4=A`、`D5=A`、`D6=X`、`D7-1=U-B`、`D7-2=Lv.15`、`D8=1+1+目标鲨+50%HP`  
> **架构硬约束**：**100% 配置表驱动（Zero-Hardcode）** — 全部分领域数值配置收敛至 `shared/configs/*.json` 六大唯一真源，Web TypeScript、iOS 原生 Swift（`DomainConfigs.swift`）及无头模拟器同源实时加载，彻底消除代码内散落硬编码。  
> **范围红线**：严格不新增 Achievement（成就）与 Mission（任务）系统；完整向后兼容旧版 `SharkMetaSaveData` 存档。

---

## 一、六大配置表架构（Single Source of Truth & Zero-Hardcode）

为贯彻“数值按域拆表、严禁代码硬编码”原则，建立 [`shared/configs/`](../shared/configs/) 六大 JSON 配置真源，并由 [`scripts/build-ios-native.ts`](../scripts/build-ios-native.ts)（`npm run sync:ios`）实时校验与打包同步至 iOS App Bundle 及 `project.pbxproj`：

| 配置文件路径 | 承载业务域 | Web 加载模块 | iOS 加载模块 |
| :--- | :--- | :--- | :--- |
| [`shared/configs/world_and_progression_config.json`](../shared/configs/world_and_progression_config.json) | 世界物理基准、区域边界、默认存档、躯体/局内升级、Bite Tier 节点、`G4~G6` 门禁倍率、XP 曲线、Atlas 光环、四大血统被动、时间难度膨胀 (`+0.05/60s` 封顶 `2.20x`) | `rules.ts`, `sharkEvolutionConfig.ts`, `config.ts`, `infiniteProgressionManager.ts`, `stepSimulation.ts` | `DomainConfigs.swift`, `GameRules.swift`, `GameViewModel.swift` |
| [`shared/configs/economy_predation_config.json`](../shared/configs/economy_predation_config.json) | 黄金狂暴参数与充能阈值、Golden/Abyss 变异概率及收益、`1/2` 击破甲规则、`predationGeneDrop` 分层掉率+保底、悬赏公式与偏置、拾取物寿命/磁吸、4 档 `HuntingHeat`、`GoldOverdrive`/`GeneSurge`、战斗受击参数 | `rules.ts`, `infiniteProgressionManager.ts`, `ecosystemSpawner.ts`, `stepSimulation.ts`, `sim/types.ts` | `DomainConfigs.swift`, `GameRules.swift`, `OceanGameScene.swift`, `PreySimulation.swift`, `OceanFXSystem.swift`, `GameViewModel.swift` |
| [`shared/configs/shark_evolution_config.json`](../shared/configs/shark_evolution_config.json) | 6 代 × 8 列 48 阶鲨鱼矩阵、血统元信息、进化门禁（含 `D7-1` 纵横解锁与 `G4~G6` 金币后移）、收敛后产出特性 | `sharkEvolutionConfig.ts`, `SharkEvolutionAtlasModal.tsx` | `DomainConfigs.swift`, `GameRules.swift`, `EvolutionAtlasSheetView.swift` |
| [`shared/configs/crown_mastery_config.json`](../shared/configs/crown_mastery_config.json) | 48 只鲨鱼独立铜/银/金三段位门槛与定额金/基因表、统一 `end_of_run` 结算开关、`hudUnlockNotificationOnly`、`allowInTrial: false`、`allowDoubleSettlement: false` | `sharkEvolutionConfig.ts`, `InGameHudOverlay.tsx`, `GameOverModalOverlay.tsx` | `DomainConfigs.swift`, `GameRules.swift`, `GameViewModel.swift`, `HudLeafViews.swift`, `ModalsAndSkillFanViews.swift` |
| [`shared/configs/ads_and_monetization_config.json`](../shared/configs/ads_and_monetization_config.json) | AdMob / H5 VAST 广告单元配置、5 大广告位冷却/日限、`SUPPLY_DROP` 6 代阶梯表、`REVIVE`（6s/2.5s）、`TRIAL_SHARK`（`next_unowned_shark`, Lv.6 / Lv.5 / 4.5s）、`INTERSTITIAL` 3 局新手保护、新手启动礼 | `adManager.ts`, `sharkEvolutionConfig.ts`, `TitleScreenOverlay.tsx`, `GameOverModalOverlay.tsx` | `DomainConfigs.swift`, `GoogleAdMobManager.swift`, `GameViewModel.swift`, `ContentView.swift`, `ModalsAndSkillFanViews.swift` |
| [`shared/configs/prey_ecology_config.json`](../shared/configs/prey_ecology_config.json) | 234 种现役海洋生物 + `cyber_mine`（共 235 项，含 `D6-X` 对 `T18~T48` `geneValue` 稀释）及 `spawnerRules`（刷新上限 20、悬赏偏置 26%、集群与无限缩放参数） | `preyDatabase140.ts`, `config.ts`, `ecosystemSpawner.ts` | `DomainConfigs.swift`, `PreySimulation.swift`, `OceanGameScene.swift`, `GameConfigGenerated.swift`（287 行 `< 350`） |

> 同步辅助修改：[`tsconfig.json`](../tsconfig.json) 开启 `resolveJsonModule` 供 Web TS 与模拟器直接静态类型安全导入 JSON；`ios-native/HungrySharkEvolution/Core/DomainConfigs.swift` 承担全量 JSON 解码，保持 `GameConfigGenerated.swift` 为 `287` 行（远低于 `350` 行上限）。

---

## 二、已落地核心决策摘要 (`D3 ~ D8`)

### 2.1 `D3=A`：王冠系统重构与 Atlas 光环重定位
- **定额与总预算收敛**：全 48 阶（144 冠）总计产出 **`44,940 Coins + 9,619 Genes`**；其中前 3 代（G1~G3）金币产出从 iOS 原 `71,341C` 大幅压低至 **`11,238C + 2,659G`**（仅占 G1~G3 必经金币 `42,652C` 的 **`26.3%`**），消除早期金币溢出。
- **Atlas 被动重定向**：每解锁 1 顶王冠提供 **`+0.35% 分数`** 与 **`+0.20% HP`**，资源产出加成为 **`0%`**（解锁额外鲨鱼仍保留 `+2.0% HP / +0.8% Speed / +2.5% Score / +2.5% Coin&Gene Reward`）。
- **结算边界统一**：双端统一在 **`end_of_run` 一次性结算**，局内仅触发轻量 HUD 提示通知（`hudUnlockNotificationOnly: true`），严禁 Trial 试玩激活或领奖，严禁 `DOUBLE_SETTLEMENT` 翻倍王冠。

### 2.2 `D4=A`：黄金狂暴、变异与冲刺破甲统一
- **黄金狂暴节流与反膨胀**：需 **`6`** 次充能激活（`#29 shark_28_void_lightning` 减 `1` 至 `5`，最低门槛 `minChargeFloor: 3`），开局 **`8.0s`** 保护、结束 **`15.0s`** 冷却、基础持续 **`6.0s`**；倍率统一为 **`1.5x Coins / 1.0x Genes / 2.0x Score / 0.50x XP`**，废除 `frenzyStack` 无限叠层。
- **移除僵尸变异**：双端全面删除未接入表现的 `FRENZY_PREY`。
- **黄金鱼 (`GOLDEN_MUTANT`)**：生成率 **`4.5% ~ 8.0%`**，收益 **`3.0x C / 1.0x G / 3.0x Score / 2.0x XP`**，**100% 必掉基因**。
- **深渊巨兽 (`ABYSS_BEHEMOTH`)**：仅当 `preyTier >= 8 || depthMeters >= 220m` 触发（**`6% ~ 16%`**），有效阶位 **`+1T`**、体型与移速 **`1.25x`**、失败反噬 **`1.35x`**、击败收益 **`1.2x C / 2.0x G / 1.5x XP / 2.2x Score`**，100% 必掉基因。
- **冲刺破甲 (`ARMOR_CRUSH`)**：普通猎物需 **`1`** 次、Boss 或 `ABYSS_BEHEMOTH` 需 **`2`** 次冲刺击穿（`OceanGameScene.swift` 与 `rules.ts` 同步对齐）；奖励 **`1.35x C/G/XP`** 与 **`1.50x Score`**，叠加鲨鱼个体倍率，且双端均计入悬赏击杀与黄金充能。

### 2.3 `D5=A` & `D6=X`：经济基线对齐与基因稀缺收敛
- **新手起跑线统一**：Starter 默认 **`120 Coins / 20 Genes / bestDepthReached: 200m`**；`#0` 基因参考底价统一设为 **`12`**（`#0` `Lv.5` 为 `10G`、`Lv.10` 为 `22G`、合计 **`32G`**；全 48 只满强合计 **`87,428G`**）。
- **悬赏系统统一**：双端固定 **`2`** 击杀结算，奖励公式 `round((36 + 2.2*T)*coinM)` 金币 + `round((6 + 0.35*T)*geneM)` 基因、`300*(1+0.3*T)` 分数，iOS `PreySimulation.swift` 补齐 **`26%`** 悬赏刷新偏置与 `recycleAndRespawn`。
- **拾取物与狩猎热度**：拾取物存活 **`14.0s`**、末 **`2.5s`** 闪烁、拾取半径 `38 * worldScale`、狂暴拾取磁吸 **`1.45x`**、池上限 `120`；`HuntingHeat` 按连击门槛 `[0, 4, 10, 18, 28]` 映射 `1.0 / 1.10 / 1.20 / 1.35 / 1.45x Score`、`+[0, 20, 40, 60, 80] px` 磁吸与 `+[0, 2, 5, 8, 10]/s` 回能。
- **时间难度**：Web 与 iOS 同步为每 **`60s`** 步进 **`+0.05`**、封顶 **`2.20x`**（价值倍率指数 `0.65`）。
- **`D6-X` 基因掉率与保底**：废除 Web 普通捕食 `Math.max(1)` 保底地板；改为 **`T1..17` `30%`（连空 `3` 次第 `4` 杀必掉）**、**`T18+` `45%`（连空 `2` 次第 `3` 杀必掉）**，特殊击杀 `100%` 必掉；对 `T18..T48` `geneValue` 进行阶梯稀释，并将 8 个高产特性收敛至封顶 **`<= 1.50x`**（含 `ELDER_ABYSS 1.10x`、`#40 克拉肯 Boss 1.50x`、`#48 奥米茄 1.50x`）。

### 2.4 `D7-1=U-B` & `D7-2=Lv.15`：成长体系重构
- **Bite Tier 与基因节点对齐**：躯体强化改为 **`Lv.5 (+1T, +6% HP)`** 与 **`Lv.10 (+2T, +12% HP)`**（与 `Lv.4→5` / `Lv.9→10` 基因收费完美对齐），局内成长改为 **`Lv.2 / 5 / 8 / 12`**（`+1..+4T`），合计成长上限仍为 `min(48, base + 6)`，彻底消除此前 `23` 次负跃迁，实现 **`0 / 47`** 次倒挂。
- **数值平滑与后移**：躯体金币升级指数从 `1.36` 调优至 **`1.28`**；G1~G6 父级门槛收敛为 `[3, 4, 5, 5, 5, 6]`；G4~G6 解锁金币施加 `1.25x / 1.55x / 1.85x` 后移；`reqMaxInRunLevel` 单调递增并收尾于 G6 `13..15`；全局 XP 倍率 `normal: 0.80 / frenzy: 0.50 / armorCrush: 1.35 / golden: 2.00 / behemoth: 1.50`。

### 2.5 `D8`：广告、解锁路径与主动技能对齐
- **5 广告位双端统一**：`DOUBLE_SETTLEMENT`（`30s/2d`, `2x`, 排除王冠/Trial）、`SUPPLY_DROP`（`90s/6d`, 按账号最高解锁代际发放 `160/14` 至 `16,000/1,150`）、`REVIVE`（`15s/6d`, 每局 `1` 次, `6s` 狂暴 + `2.5s` 无敌）、`TRIAL_SHARK`（`60s/4d`, 目标 **`next_unowned_shark`**，`upLv=6 / inRunLv=5 / 4.5s` 初始狂暴）、`INTERSTITIAL`（`90s/12d`, 前 **`3`** 局保护）。
- **纵横双路径父级解锁**：双端均同时支持紧邻线性前序（`index - 1`）与同列跨代祖先（`(row - 1) * 8 + col`）。
- **主动技能统一**：`GoldOverdrive` 狂暴期间禁用（`blockWhileFrenzy: true`），释放持续 `6s`、回血 **`50% maxHp`**、回满能量、`1s` 无敌；`GeneSurge` 赠予 **`0.55 * xpReq`** 支持多级连升，回血 `max(35, round(maxHp * 0.15))` 且不跳过引导。

---

## 三、静态总账与四模型真实规则模拟验证

### 3.1 Task 05 静态总账（`runStaticDeterministicAudit()` 实测）

| 指标 | Web / iOS 统一口径 | 关键对比与核查说明 |
| :--- | :---: | :--- |
| **全 48 阶解锁总需求** | **`753,560C / 86,452G`** | 较原 `452,780C`（`D7-1` G4~G6 后移）精准拉升后期金币消耗 |
| **必经路径父级强化** | **`306,289C / 27,001G`** | 较原 `970,062C` 下压 `68.4%`，彻底消除“父级升级比买新鲨还贵” |
| **必经通关总消耗** | **`1,059,849C / 113,453G`** | 双端 100% 一致（`G1~G3` 必经金币 `42,652C`） |
| **全 48 只升满 Lv.10 强化** | **`1,326,672C / 87,428G`** | `D5-A` 统一 `geneUnlockMinRef = 12`，Web 与 iOS 均严格为 `87,428G` |
| **全解锁 + 全满级 Lv.10 总额** | **`2,080,232C / 173,880G`** | 双端 100% 同源无差 |
| **48 只王冠合计 / G1~G3 合计** | **`44,940C / 9,619G`** / **`11,238C / 2,659G`** | G1~G3 王冠金币占比从 `155.4%` 降至 **`26.3%`** |
| **Bite Tier 相邻晋升负跃迁数** | **`0 / 47`** | 从此前 `23` 次 `-1T` 倒挂降为 **零倒挂** |

### 3.2 四类玩家模型全周期通关表现（`seed=20261125`, `runsPerShark=3`, `careerSeeds=3`, 耗时 `627.9s`）

| 方案口径 | 玩家模型 | 广告模式 | 通关率 | 总局数 Median (`P25/P75/Mean`) | 预估天数 (Med) | 总金币 (Med) | 总基因 (Med) | 王冠 C / G (Med) | 广告 C / G (Med) |
| :--- | :--- | :---: | :---: | :--- | :---: | ---: | ---: | :---: | :---: |
| **Web P0前 (历史通胀基线)** | Normal | 零广告 | 100% | 19 局 (18.5/20/avg 19.3) | 4.75 天 | 1,076,741 | 345,353 | 0 / 3,767 | 0 / 0 |
| **Web Task 05 (`web_post_p0`)** | Casual | 零广告 | 100% | **69 局** (67/71/avg 69) | 34.5 天 | 979,819 | 114,637 | 33,903 / 7,105 | 0 / 0 |
| **Web Task 05 (`web_post_p0`)** | **Normal** | 零广告 | 100% | **46 局** (41.5/46/avg 43) | **11.5 天** | 1,002,008 | 112,757 | 30,262 / 6,346 | 0 / 0 |
| **Web Task 05 (`web_post_p0`)** | Efficient | 零广告 | 100% | **34 局** (32.5/35.5/avg 34) | 4.86 天 | 999,312 | 111,040 | 27,013 / 5,653 | 0 / 0 |
| **Web Task 05 (`web_post_p0`)** | Farming | 零广告 | 100% | **28 局** (26/29.5/avg 27.7) | 2.8 天 | 1,060,469 | 111,222 | 25,523 / 5,346 | 0 / 0 |
| **iOS Task 05 (`ios_post_p0`)** | Casual | 零广告 | 100% | **72 局** (69.5/75/avg 72.3) | 36 天 | 991,281 | 110,828 | 33,060 / 6,933 | 0 / 0 |
| **iOS Task 05 (`ios_post_p0`)** | **Normal** | 零广告 | 100% | **42 局** (40.5/43/avg 41.7) | **10.5 天** | 996,260 | 113,069 | 30,444 / 6,373 | 0 / 0 |
| **iOS Task 05 (`ios_post_p0`)** | Efficient | 零广告 | 100% | **30 局** (29/30.5/avg 29.7) | 4.29 天 | 1,012,641 | 109,260 | 27,293 / 5,725 | 0 / 0 |
| **iOS Task 05 (`ios_post_p0`)** | Farming | 零广告 | 100% | **28 局** (27.5/29/avg 28.3) | 2.8 天 | 986,416 | 111,734 | 23,114 / 4,851 | 0 / 0 |
| **统一配置 (`unified_candidate`)** | **Normal** | 零广告 | 100% | **47 局** (44.5/50/avg 47.3) | **11.75 天** | 1,001,748 | 114,702 | 30,321 / 6,336 | 0 / 0 |
| **Web Task 05 (`web_post_p0`)** | **Normal** | 含广告 | 100% | **26 局** (26/26.5/avg 26.3) | **6.5 天** | 1,025,144 | 109,336 | 21,172 / 4,429 | 368,668 / 36,184 |
| **iOS P0前 (历史漏洞基线)** | Casual | 含广告 | **33.3%** | 180 局 (176/180/avg 177.3) | 90 天 | 2,062,631 | 118,155 | 39,882 / 1,541 | 357,475 / 21,170 |
| **iOS Task 05 (`ios_post_p0`)** | Casual | 含广告 | **100%** | **69 局** (67/70/avg 68.3) | 34.5 天 | 1,031,233 | 117,613 | 33,298 / 6,968 | 168,488 / 17,210 |
| **iOS Task 05 (`ios_post_p0`)** | **Normal** | 含广告 | 100% | **26 局** (26/27.5/avg 27) | **6.5 天** | 1,040,890 | 114,084 | 24,734 / 5,194 | 360,204 / 35,617 |
| **iOS Task 05 (`ios_post_p0`)** | Efficient | 含广告 | 100% | **23 局** (23/24/avg 23.7) | 3.29 天 | 1,003,391 | 110,689 | 23,287 / 4,868 | 293,923 / 28,848 |
| **iOS Task 05 (`ios_post_p0`)** | Farming | 含广告 | 100% | **24 局** (23/24.5/avg 23.7) | 2.4 天 | 1,052,673 | 115,612 | 19,233 / 4,064 | 259,105 / 26,273 |
| **统一配置 (`unified_candidate`)** | **Normal** | 含广告 | 100% | **27 局** (25.5/28/avg 26.7) | **6.75 天** | 1,025,967 | 108,083 | 24,570 / 5,141 | 373,648 / 34,275 |

- **Trial 试玩隔离验证（`shark_41_star_destroyer`）**：`web_post_p0` 与 `ios_post_p0` 均拦截了 `bestInRunLevel`（保持 `1`）、`bestDepthReached`（保持 `200m`）及 Crown（`0C / 0G`），同时合法保留 `D1` 允许带回之本局拾取货币（Web `29,468C / 2,761G`、iOS `15,368C / 1,448G`）。
- **结论**：① Web 与 iOS 双端推进节奏高度收敛（`Normal` 零广告 `42~47` 局、含广告 `26~27` 局，广告加速 ~`42%`）；② 修复了 iOS 历史基线中 `Casual` 仅 `33.3%` 通关的后期卡死与 Web 基因暴涨 `34.5万` 溢出现象；③ 模拟器 `staticAnalyzer.ts` 与 `reportGenerator.ts` 已在同批提交后进一步补齐 `iosFullUpgradeGenes = 87,428`（与 `87,428` 完全一致）。

---

## 四、存档兼容与全量测试验证清单

- **旧存档向后兼容**：`loadSharkMetaSave()` 与 Swift `SharkMetaSaveData` 对旧存档缺少的新字段（如 `onboardingGiftClaimed`、`sharkBestScores`、`sharkMasteryTiers`）提供安全默认值恢复；初始起跑基准上调（`120C / 20G / 200m`）通过 `Math.max` 保底融合而不覆盖老玩家更高历史记录，且新加 6 域 JSON 字段均为向后兼容读取。
- **工程验证汇总**：
  1. `npm run sync:ios`：同步 `shared/configs/*.json` + `shared/game_data.json`（48 sharks, 235 prey, 363 i18n keys）至 `ios-native/` 并更新 `project.pbxproj`。
  2. `npm run lint`（`tsc --noEmit`）+ `npm run build`（`vite build`）：零错误构建通过。
  3. `npx tsx --test src/game/rules.test.ts`：**53 / 53** 全部通过（含新增 `Task 05 D3~D8 Approved Rules & Config-Driven Architecture Verification`）。
  4. `npx tsx --test scripts/economy-simulator/simulator.test.ts`：**4 / 4** 全部通过（校验后 Task 05 `753,560C / 1,059,849C / 87,428G / 44,940C / 0` 负跃迁与 `200m` Trial 隔离）。
  5. `xcodebuild test ... -only-testing:HungrySharkEvolutionTests/GameRulesTests`（iPhone 17 Simulator）：**11 / 11** 全部通过（含新增 `testTask05DomainConfigsAndCrossPlatformParity`）。
