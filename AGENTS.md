# AGENTS.md — AI 辅助协同开发最高约束规范 (Mandatory AI Governance)

> **⚠️ 致所有 AI 编程助手（Cursor / Claude Code / GitHub Copilot / Windsurf / Cline / Google AI Studio）：**
> 在阅读、修改或新增本仓库任何代码之前，**必须首先完整阅读本文件与 [`docs/00-AI_CONSTRAINTS.md`](./docs/00-AI_CONSTRAINTS.md)**。
> **任何代码变更若涉及架构、UI/交互规范、数值公式、鱼类配置或进化规则，必须在同一次提交中同步更新 `docs/` 目录下对应的 Markdown 文档，严禁出现“代码已改、文档过期”的不一致状态！**

---

## 1. 文档体系总览（Single Source of Truth）

本项目的全部设计、架构与数值规范由以下文档构成：

| 文档路径 | 核心职责 | 何时必须同步更新 |
| :--- | :--- | :--- |
| [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md) | AI 协同入口与最高红线索引 | 新增顶层模块、修改文档目录结构或新增全局红线时 |
| [`docs/00-AI_CONSTRAINTS.md`](./docs/00-AI_CONSTRAINTS.md) | **AI 编码红线与文档防过期同步契约** | 新增核心不变量（Invariants）、修改测试要求或变更代码-文档映射关系时 |
| [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md) | **项目架构与模块职责说明书** | 新增/重命名 `src/` 文件、修改状态流转、改变存档结构或游戏主循环时 |
| [`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md) | **渲染、UI/UX 与移动端多指交互规范** | 修改鲨鱼/猎物渲染、HUD 布局、多点触控事件、视差背景或音效规范时 |
| [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md) | **核心数值策划案（Lv/T 计算、48阶进化、经济、生态深度）** | 修改任何计算公式、升级消耗、属性成长、猎物体型算法、鱼类深度分布时 |
| [`docs/04-COLLABORATION_AND_DEPLOYMENT.md`](./docs/04-COLLABORATION_AND_DEPLOYMENT.md) | **多人协同流程、单元测试与 Vercel 部署手册** | 修改 `package.json` 依赖、构建脚本、分支策略、测试用例或部署配置时 |
| [`docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md`](./docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md) | **移动端与跨平台原生移植避坑指南（iOS/Android/小游戏）** | 修改 `scripts/build-ios-native.ts`、跨平台图集处理、多语言模板或移动端适配逻辑时 |
| [`docs/06-PREY_DATABASE_140.md`](./docs/06-PREY_DATABASE_140.md) | **140 种统一猎物数据库与 Nano Banana `@3x` 透明资产进度看板** | 新增/继续生成 140 种猎物透明 PNG 资产（`scripts/process-prey-140.ts`）或调整猎物规划表时 |
| [`docs/07-REVIEW_AND_ACTION_PLAN.md`](./docs/07-REVIEW_AND_ACTION_PLAN.md) | **Web 主工程双视角深度 Review 与可追踪整改计划** | 完成或更新任意 Web 端 P0/P1/P2 整改任务时 |
| [`docs/08-IOS_SWIFT_REVIEW_AND_ACTION_PLAN.md`](./docs/08-IOS_SWIFT_REVIEW_AND_ACTION_PLAN.md) | **iOS 原生 Swift 工程深度 Review 与可追踪整改计划** | 完成或更新任意 iOS 端 P0/P1/P2 整改任务或同步 `ios-native/` Swift 代码时 |
| [`docs/09-P2_1_RETENTION_MONETIZATION_PLAN.md`](./docs/09-P2_1_RETENTION_MONETIZATION_PLAN.md) | **P2-1 中后期留存玩法与商业化闭环升级（24 步 Check 方案）** | 推进或勾选 Phase A（血统技能）/ B（Boss 战）/ C（任务成就云存档）/ D（混合变现）各开发步骤时 |
| [`docs/GAMEPLAY_BASELINE.md`](./docs/GAMEPLAY_BASELINE.md) | **第一阶段审计：现有玩法、成长系统与玩家体验基线** | 核心循环、新手引导、生态利用率或跨端特性变化后同步复审 |
| [`docs/ECONOMY_SOURCE_SINK.md`](./docs/ECONOMY_SOURCE_SINK.md) | **第一阶段审计：金币与基因全量来源/消耗出口明细** | 修改掉率、悬赏、王冠奖励、强化消费或广告变现包后同步复审 |
| [`docs/ECONOMY_AUDIT_VERIFICATION.md`](./docs/ECONOMY_AUDIT_VERIFICATION.md) | **第一阶段核实：Web vs iOS 经济系统代码级逐项核实报告** | 复核/修正经济审计结论、统一双端结算口径或修改奖励公式时同步更新 |
| [`docs/ECONOMY_FIX_ROADMAP.md`](./docs/ECONOMY_FIX_ROADMAP.md) | **第一阶段路线图：P0/P1/P2 问题分级、修复依赖与产品决策矩阵** | 确认产品决策、推进修复批次或变更任务优先级时同步更新 |
| [`docs/P0_ECONOMY_FIX_REPORT.md`](./docs/P0_ECONOMY_FIX_REPORT.md) | **Task 02：P0 经济漏洞与 Trial 正式进度隔离修复报告** | 复核 P0 修复范围、双端测试覆盖与存档兼容性时查阅/更新 |
| [`docs/ECONOMY_SIMULATION_REPORT.md`](./docs/ECONOMY_SIMULATION_REPORT.md) | **Task 03：真实规则经济系统模拟报告（含 48 阶效率、分代五分位与 P0 前后对比）** | 调参、新增模拟器规则基线或进入 Task 04 规则统一前查阅/复现 |
| [`docs/CROSS_PLATFORM_GAME_RULES_PROPOSAL.md`](./docs/CROSS_PLATFORM_GAME_RULES_PROPOSAL.md) | **Task 04：Web / iOS 经济与成长规则统一方案（含 Bite Tier 核审、模拟校验与 D3~D8 决策表）** | 审核拍板双端统一规则或推进 Task 05 数值与成长落地前查阅 |
| [`docs/ECONOMY_BALANCE_IMPLEMENTATION_REPORT.md`](./docs/ECONOMY_BALANCE_IMPLEMENTATION_REPORT.md) | **Task 05：成长体系、经济平衡及全配置表驱动落地报告（含 `D3~D8` 与双端验证）** | 调整 `shared/configs/*.json` 或双端统一经济/成长机制后同步更新 |
| [`docs/PROGRESSION_CURVE_AUDIT.md`](./docs/PROGRESSION_CURVE_AUDIT.md) | **第一阶段审计：48 阶成长表、异常诊断与三类玩家模型** | 调整 48 阶鲨鱼数值、门禁梯度或猎物阶位分布后同步复审 |
| [`docs/ECONOMY_REBALANCE_PROPOSAL.md`](./docs/ECONOMY_REBALANCE_PROPOSAL.md) | **第一阶段审计：P0/P1/P2 经济与成长重平衡建议案** | 确认或实施数值调优及 P2-1 奖池预算时对照核销 |

---

## 2. 强制性“代码 ⇄ 文档”同步映射表（Code-to-Doc Sync Matrix）

AI 在修改以下任一源代码文件时，**必须在同一次任务中检查并更新右侧对应的文档章节**：

| 修改的源码文件 | 必须同步核查并更新的文档与章节 |
| :--- | :--- |
| `shared/configs/*.json`（6 域唯一配置真源：`world_and_progression_config.json`、`economy_predation_config.json`、`shark_evolution_config.json`、`crown_mastery_config.json`、`ads_and_monetization_config.json`、`prey_ecology_config.json`） | 运行 `npm run sync:ios` 同步至 `ios-native/` 资源束，并同步更新 [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)、[`docs/06-PREY_DATABASE_140.md`](./docs/06-PREY_DATABASE_140.md) 与 [`docs/ECONOMY_BALANCE_IMPLEMENTATION_REPORT.md`](./docs/ECONOMY_BALANCE_IMPLEMENTATION_REPORT.md) |
| `src/game/rules.ts` / `ios-native/.../Core/GameRules.swift` / `DomainConfigs.swift` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 1~6 节：等级 `Lv`、咬合阶位 `T`、真实体长比例 `getPreyRelativeVisualScale`、碰撞判定 `resolvePreyEncounter`、`computePredationSettlement`） |
| `src/game/sharkEvolutionConfig.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 3~4 节：48 阶鲨鱼矩阵、四重血统、三重解锁门禁、王冠段位与跨局存档 `SharkMetaSaveData`） |
| `src/game/preyDatabase140.ts` / `src/game/config.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md) 与 [`docs/06-PREY_DATABASE_140.md`](./docs/06-PREY_DATABASE_140.md)（海洋五层水深带、234 种现役海洋生物 + `cyber_mine` = 235 项配置） |
| `src/game/adManager.ts` / `ios-native/.../Monetization/GoogleAdMobManager.swift` | [`docs/09-P2_1_RETENTION_MONETIZATION_PLAN.md`](./docs/09-P2_1_RETENTION_MONETIZATION_PLAN.md) 与 [`docs/ECONOMY_BALANCE_IMPLEMENTATION_REPORT.md`](./docs/ECONOMY_BALANCE_IMPLEMENTATION_REPORT.md)（5 广告位 CD/日上限、动态阶梯空投、Trial 试玩配置） |
| `src/game/worldGenerationSystem.ts` / `src/game/world/*.ts` | [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)（第 5 节：11 子模块程序化世界生成、地形样条、海床渲染与 Chunk 生命周期） |
| `src/game/ecosystemSpawner.ts` | [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)（生态刷新器章节）与 [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 6.3 节：85% 原生栖息地保护规则） |
| `src/game/infiniteProgressionManager.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 7 节：无限成长与深渊变异公式） |
| `src/game/canvasRenderer.ts` / `src/game/spriteSheetManager.ts` | [`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md)（第 1~2 节：48 阶精灵图裁切、无外挂部件纯净躯体渲染、猎物五步态渲染与视觉碰撞一致性） |
| `src/game/sim/*.ts` (`SharkGameEngine` / `stepSimulation` / `renderOceanWorld` / `types`) | [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)（第 3.2 节：60FPS 零 GC 纯 TS 仿真与渲染引擎） |
| `src/App.tsx` / `src/components/game/*.tsx` | [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)（React 薄视图壳与 HUD 同步）及 [`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md)（第 3~4 节：HUD 布局、移动端多点触控 `bindMultiTouchButton` 与虚拟摇杆规范） |
| `src/game/sharedGameData.ts` / `scripts/build-ios-native.ts` / `src/game/i18n.ts` | [`docs/04-COLLABORATION_AND_DEPLOYMENT.md`](./docs/04-COLLABORATION_AND_DEPLOYMENT.md)（第 5 节：Web ↔ iOS 共享 JSON 数据契约同步）及 [`docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md`](./docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md) |
| `package.json` / `.npmrc` / `vite.config.ts` | [`docs/04-COLLABORATION_AND_DEPLOYMENT.md`](./docs/04-COLLABORATION_AND_DEPLOYMENT.md)（依赖管理、构建与 Vercel 部署章节） |

---

## 3. 不可逾越的五大工程与玩法红线（Core Invariants）

1. **纯本体进化（严禁外挂部件回退）**：
   - 鲨鱼成长采用 **48 阶本体形态进化（6 代 × 8 列）**，使用 48 阶专属精灵与程序化脊柱摆动渲染，**严禁在鲨鱼身上绘制任何外挂器官/机械炮台/外置推进器部件**。
2. **屏幕视觉体型 = 物理碰撞体积绝对同源契约（100% Real Physical Scale & Single Source of Truth）**：
   - 234 种现役海洋生物与 48 阶鲨鱼均按真实生物学体长（`realBodyLengthM`）驱动屏幕视觉比例与吞噬阶位（`biteTier`）判定，**严禁视觉与碰撞各算各的**。
   - 渲染函数 `drawPreyEntity`（`src/game/canvasRenderer.ts`）与物理碰撞 `stepSharkSimulation`（`src/game/sim/stepSimulation.ts`）**必须共享同一个 `getPreyRelativeVisualScale()` 计算结果并统一透传 `shark.stats.realBodyLengthM`**，杜绝屏幕大小与碰撞盒错位。
3. **移动端多指触控零阻塞（Multi-Touch First）**：
   - 左手按住虚拟摇杆或画布转向时，**严禁在 `pointermove` 中触发 React `setState`**（必须使用 `joystickKnobRef` 直接修改 DOM `style.transform`）。
   - 所有局内 HUD 按钮（升级躯体、破茧进化、图谱、狂暴、突破、空投、暂停等，定义于 `src/components/game/InGameHudOverlay.tsx`）**必须使用 `bindMultiTouchButton`（同时绑定 `onPointerDown` + `onTouchStart` + `onClick` 并做防重触发）**，确保左手按住摇杆时右手点击升级 100% 即时响应。
4. **鱼类真实五层水深栖息地（`0m ~ 20,000m` 与 85% 原生深度带约束）**：
   - 234 种现役海洋生物 + `cyber_mine`（共 235 项，定义于 `src/game/preyDatabase140.ts`）分布于五层海洋水深带（表层浅海 `0~2000m`、中层暮光 `2000~6000m`、深层半深海 `6000~10000m`、深渊 `10000~16000m`、冥渊海沟 `16000~20000m`，浅滩珊瑚安全区 `0~520m`），刷新逻辑必须严格遵守各自的 `[minDepth, maxDepth]`，严禁浅水热带鱼刷到深渊或深海巨怪/主动掠食者刷到阳光浅滩。
5. **纯逻辑与单元测试先行**：
   - 所有核心数值与判定逻辑必须保持在 `src/game/rules.ts`、`src/game/sharkEvolutionConfig.ts` 与 `src/game/sharedGameData.ts` 纯函数中，任何改动后必须通过 `npx tsx --test src/game/rules.test.ts` 与 `npm run lint`（`tsc --noEmit`）。

---

## 4. AI 每次修改代码的强制自检工作流（Definition of Done）

1. **Read First**：阅读 `AGENTS.md`、`docs/00-AI_CONSTRAINTS.md` 及目标模块对应的 `docs/0X-*.md`。
2. **Code & Test**：完成代码修改，若有公式/判定变更，同步更新 `src/game/rules.test.ts` 并运行测试通过。
3. **Sync Docs（强制步骤）**：对照上方《代码 ⇄ 文档同步映射表》，打开对应的 `docs/0X-*.md` 文件，更新其中的公式、表格、参数值与更新日志（Changelog）。
4. **Verify Build**：运行 `npm run lint` 与 `npm run build` 确保零类型错误与构建通过。
