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

---

## 2. 强制性“代码 ⇄ 文档”同步映射表（Code-to-Doc Sync Matrix）

AI 在修改以下任一源代码文件时，**必须在同一次任务中检查并更新右侧对应的文档章节**：

| 修改的源码文件 | 必须同步核查并更新的文档与章节 |
| :--- | :--- |
| `src/game/rules.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 1~6 节：等级 `Lv`、咬合阶位 `T`、猎物体型缩放 `getPreyRelativeVisualScale`、碰撞判定 `resolvePreyEncounter`） |
| `src/game/sharkEvolutionConfig.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 3~4 节：48 阶鲨鱼矩阵、四重血统、三重解锁门禁、跨局存档 `SharkMetaSaveData`） |
| `src/game/config.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 6 节：海洋深度带、32 种海洋生物属性与深度分布） |
| `src/game/ecosystemSpawner.ts` | [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)（生态刷新器章节）与 [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 6.3 节：85% 原生栖息地保护规则） |
| `src/game/infiniteProgressionManager.ts` | [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)（第 7 节：无限成长与深渊变异公式） |
| `src/game/canvasRenderer.ts` / `src/game/spriteSheetManager.ts` | [`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md)（第 1~2 节：48 阶精灵图裁切、无外挂部件纯净躯体渲染、猎物渲染与尺寸一致性） |
| `src/App.tsx` | [`docs/01-ARCHITECTURE.md`](./docs/01-ARCHITECTURE.md)（主循环与 HUD 同步）及 [`docs/02-DESIGN_SPEC.md`](./docs/02-DESIGN_SPEC.md)（第 3~4 节：HUD 布局、移动端多点触控 `bindMultiTouchButton` 与虚拟摇杆规范） |
| `package.json` / `.npmrc` / `vite.config.ts` | [`docs/04-COLLABORATION_AND_DEPLOYMENT.md`](./docs/04-COLLABORATION_AND_DEPLOYMENT.md)（依赖管理、构建与 Vercel 部署章节） |

---

## 3. 不可逾越的五大工程与玩法红线（Core Invariants）

1. **纯本体进化（严禁外挂部件回退）**：
   - 鲨鱼成长采用 **48 阶本体形态进化（6 代 × 8 列）**，使用 `/assets/aistudio/sharks_ec921c3b.png` 8×6 精灵图与程序化脊柱摆动渲染，**严禁在鲨鱼身上绘制任何外挂器官/机械炮台/外置推进器部件**。
2. **屏幕视觉体型 = 吞噬判定绝对契约**：
   - 所有可被当前鲨鱼直接吞噬的鱼（`canDevourDirectly === true`），其在屏幕上的实际渲染尺寸与碰撞半径**必须严格小于玩家鲨鱼（`<= 64%` 鲨鱼尺寸）**。
   - 所有会咬伤玩家或需要冲刺破甲的危险鱼类/水雷（`canDevourDirectly === false`），其在屏幕上的实际渲染尺寸**必须大于或等于玩家鲨鱼（`>= 118%` 鲨鱼尺寸）**。
   - 渲染函数 `drawPreyEntity` 与物理碰撞 `resolvePreyEncounter` 必须共享同一个 `getPreyRelativeVisualScale()` 计算结果，严禁各算各的。
3. **移动端多指触控零阻塞（Multi-Touch First）**：
   - 左手按住虚拟摇杆或画布转向时，**严禁在 `pointermove` 中触发 React `setState`**（必须使用 `joystickKnobRef` 直接修改 DOM `style.transform`）。
   - 所有局内 HUD 按钮（升级躯体、破茧进化、图谱、狂暴、突破、空投、暂停等）**必须使用 `bindMultiTouchButton`（同时绑定 `onPointerDown` + `onTouchStart` + `onClick` 并做防重触发）**，确保左手按住摇杆时右手点击升级 100% 即时响应。
4. **鱼类真实深度栖息地（85% 原生深度带约束）**：
   - 浅海珊瑚鱼（`0m ~ 520m`）、暮光带中层鱼（`520m ~ 1150m`）、深渊发光/巨怪鱼（`1150m+`）必须严格遵守各自的 `[minDepth, maxDepth]`，严禁浅水热带鱼刷到深渊或深海安康鱼刷到阳光浅滩。
5. **纯逻辑与单元测试先行**：
   - 所有核心数值与判定逻辑必须保持在 `src/game/rules.ts` 与 `src/game/sharkEvolutionConfig.ts` 纯函数中，任何改动后必须通过 `npx tsx --test src/game/rules.test.ts` 与 `npm run lint`（`tsc --noEmit`）。

---

## 4. AI 每次修改代码的强制自检工作流（Definition of Done）

1. **Read First**：阅读 `AGENTS.md`、`docs/00-AI_CONSTRAINTS.md` 及目标模块对应的 `docs/0X-*.md`。
2. **Code & Test**：完成代码修改，若有公式/判定变更，同步更新 `src/game/rules.test.ts` 并运行测试通过。
3. **Sync Docs（强制步骤）**：对照上方《代码 ⇄ 文档同步映射表》，打开对应的 `docs/0X-*.md` 文件，更新其中的公式、表格、参数值与更新日志（Changelog）。
4. **Verify Build**：运行 `npm run lint` 与 `npm run build` 确保零类型错误与构建通过。
