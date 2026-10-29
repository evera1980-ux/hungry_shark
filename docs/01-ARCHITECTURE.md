# 01. 项目系统架构与模块说明书 (System Architecture)

> **文档状态**：生效中（Active）
> **最后更新**：2026-10-26
> **关联约束**：修改任何模块划分、文件职责、主循环状态或存档 Schema 时，必须同步更新本文档（参见 [`docs/00-AI_CONSTRAINTS.md`](./00-AI_CONSTRAINTS.md)）。

---

## 1. 技术栈概览

- **核心框架**：React 19 + TypeScript + Vite 8（纯前端 SPA 架构，无后端状态依赖，支持一键部署至 Vercel / GitHub Pages 或导出单文件离线 HTML）。
- **样式与动效**：Tailwind CSS v4（`@tailwindcss/vite`）+ `motion`（Framer Motion，仅用于弹窗与边缘 HUD 入场动效）。
- **渲染引擎**：原生 HTML5 Canvas 2D 高帧率渲染管线（60FPS 零 GC 环形对象池 + 8×6 精灵图智能去底裁切 + 多段正弦脊柱骨骼摆动）。
- **音频系统**：基于原生 Web Audio API 的零外部音频资源程序化合成器（`src/game/audio.ts`）。
- **单元测试**：Node.js 原生测试运行器（`node:test` + `tsx`，位于 `src/game/rules.test.ts`）。

---

## 2. 目录结构与模块职责

```text
/
├── AGENTS.md                                  # AI 协同最高约束入口（Codex / 通用 Agent 自动读取）
├── CLAUDE.md                                  # Claude Code 专用引导入口
├── README.md                                  # 项目总览与文档导航目录
├── .npmrc                                     # NPM 依赖解析配置（legacy-peer-deps=true，保障 Vercel 构建）
├── package.json                               # 依赖与构建脚本定义
├── vite.config.ts                             # Vite 构建与开发服务器配置
├── public/
│   └── assets/aistudio/
│       ├── sharks_ec921c3b.png                # 48 阶鲨鱼进化核心精灵图（8 列 × 6 行）
│       └── icons_f5128c12.png                 # 24 枚游戏级 UI 技能勋章与图标图集（6 列 × 4 行）
├── docs/
│   ├── 00-AI_CONSTRAINTS.md                   # AI 修改代码与同步更新文档的强制规范
│   ├── 01-ARCHITECTURE.md                     # 本文档：系统架构与模块职责
│   ├── 02-DESIGN_SPEC.md                      # 视觉渲染、UI/UX 与移动端多指交互规范
│   ├── 03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md# 核心数值策划案（Lv/T 计算、48阶进化、鱼类体型与深度）
│   └── 04-COLLABORATION_AND_DEPLOYMENT.md     # 多人协同、测试与 Vercel 部署手册
└── src/
    ├── main.tsx                               # React 挂载入口
    ├── index.css                              # 全局字体、Tailwind v4 导入与自定义样式工具类
    ├── App.tsx                                # 顶层游戏容器、60FPS 物理仿真循环、无框图标化 HUD 与多指交互控制器
    ├── components/
    │   ├── UiAtlasIcon.tsx                    # 6×4 UI 图标图集渲染组件与血统图标映射辅助函数
    │   └── SharkEvolutionAtlasModal.tsx       # 48 阶鲨鱼图谱弹窗（支持血统筛选、本体升级与新形态解锁）
    └── game/
        ├── config.ts                          # 静态世界常量、3 大深度带、32 种海洋生物基础配置
        ├── sharkEvolutionConfig.ts            # 48 阶鲨鱼进化矩阵、四重血统、三重解锁门禁、跨局存档读写
        ├── rules.ts                           # 纯函数核心规则（Lv/T 属性合成、猎物相对体型缩放、碰撞判定）
        ├── rules.test.ts                      # 核心纯函数单元测试套件（12 项核心断言）
        ├── spriteSheetManager.ts              # 8×6 鲨鱼精灵图 + 6×4 UI 图标图集加载、BFS 智能镂空抠图与离屏缓存
        ├── canvasRenderer.ts                  # 鲨鱼多段脊柱游动渲染、32 种猎物骨骼渲染、状态指示环与定制图标头标
        ├── parallaxBackground.ts              # 三层海洋深度视差背景、丁达尔光束、海床地形与深海发光浮游物
        ├── infiniteWorldManager.ts            # 无限水平环形世界与动态深海垂直下潜边界控制器
        ├── ecosystemSpawner.ts                # 85% 原生深度带生态刷新器、鱼群 Boids 聚落与精英刷新
        ├── infiniteProgressionManager.ts      # 无限局内难度递增、深渊变异词缀与狂暴叠层控制器
        ├── audio.ts                           # Web Audio API 程序化音效合成器（吞噬、升级、破甲、警报）
        ├── adManager.ts                       # 模拟激励视频广告管理器（复活狂暴、空投补给、试驾机甲利维坦）
        ├── singleFileExporter.ts              # 离线单文件 HTML 导出生成器
        └── i18n.ts                            # 中英双语词典与格式化工具
```

---

## 3. 核心架构分层设计

本项目严格遵循 **“纯函数规则层（Pure Rules） ➔ 高频仿真层（Imperative 60FPS Sim） ➔ 低频声明式 UI 层（Declarative React HUD）”** 的三层解耦架构：

### 3.1 第一层：纯函数规则与数值层 (`src/game/rules.ts` & `src/game/sharkEvolutionConfig.ts`)
- **零副作用、零 DOM 依赖**：所有属性计算（`computeEvolvedSharkStats`）、猎物视觉体型缩放（`getPreyRelativeVisualScale`）、碰撞吞噬/破甲/反伤判定（`resolvePreyEncounter`）、解锁校验（`evaluateSharkUnlock`）均为纯函数。
- **100% 可单测**：不启动浏览器即可通过 `npx tsx --test src/game/rules.test.ts` 在毫秒级验证全部数值与判定不变量。

### 3.2 第二层：60FPS 零 GC 高频物理与 Canvas 仿真层 (`simRef.current`)
- 所有每帧变化的游戏实体全部存储在 `useRef`（`simRef.current`）中，**绝不放入 React `useState`**：
  - `shark`：玩家鲨鱼坐标、速度、角度、生命值、饥饿延迟黄条 `ghostHp`、冲刺能量、局内等级 `level`、经验 `xp`、当前形态 `sharkFormId` 及合成属性 `stats`。
  - `preyList`：当前活跃的海洋猎物与深水雷列表。
  - `particles`（容量 160）、`pickups`（容量 80）、`floatTexts`（容量 36）：**预分配环形对象池（Ring-Buffer Object Pools）**，通过游标（`particleCursor` / `pickupCursor` / `floatCursor`）循环覆写，`requestAnimationFrame` 期间零内存分配、零 GC 卡顿。
  - `input`：键盘按键集合、鼠标/触控转向坐标、虚拟摇杆向量（`joyDx`, `joyDy`）以及**独立隔离的多指触控 ID**（`joyPointerId`, `canvasPointerId`, `boostPointerId`）。

### 3.3 第三层：React 边缘 HUD 与图谱弹窗层 (`hudState` & `metaSave`)
- **双通道状态更新策略**：
  1. **常规 120ms 节流同步**：在 `requestAnimationFrame` 循环中，每隔 `120ms`（约 8Hz）将 `simRef.current.shark` 的 HP、能量、深度、金币、基因及可升级状态同步到 `hudState`，避免 60Hz 重渲染拖慢 Canvas。
  2. **玩家交互同帧立即同步**：当玩家点击 `⬆️ 躯体 Lv.+1`、`⚡ 破茧进化`、`🪙 黄金狂暴` 或 `🧬 基因突破` 时，处理函数在修改 `simRef.current` 与 `metaSaveRef.current` 的**同一帧立即调用 `setHudState(...)`**，保证按钮文案与属性面板实现零延迟响应。

---

## 4. 跨局持久化存档结构 (`SharkMetaSaveData`)

跨局进度保存在浏览器 `localStorage` 中，存储键名为 `hungry_shark_evo_meta_v1`（定义于 `src/game/sharkEvolutionConfig.ts`）：

| 字段名 | 类型 | 默认初始值 | 含义说明 |
| :--- | :--- | :--- | :--- |
| `version` | `number` | `1` | 存档数据结构版本号 |
| `bankedCoins` | `number` | `120` | 跨局累计金币（每局拾取实时入库；提供 120 初始金币供新手体验升级） |
| `bankedGenes` | `number` | `25` | 跨局累计基因碎片（每局吞噬/拾取实时入库；用于解锁新鲨鱼与局内基因突破） |
| `unlockedSharkIds` | `string[]` | `['shark_00_clown_fry']` | 已解锁的鲨鱼形态 ID 列表（共 48 阶） |
| `selectedSharkId` | `string` | `'shark_00_clown_fry'` | 当前出战的鲨鱼形态 ID |
| `sharkUpgradeLevels` | `Record<string, number>` | `{ shark_00_clown_fry: 1 }` | 每只已解锁鲨鱼的本体强化等级（范围 `1 ~ 10`） |
| `bestInRunLevel` | `number` | `1` | 历史单局达到的最高局内等级 `Lv`（用于三重进化门禁校验） |
| `bestDepthReached` | `number` | `220` | 历史下潜达到的最大深度 `m`（用于三重进化门禁校验） |
| `totalRunsPlayed` | `number` | `0` | 累计游玩局数 |

此外，3 步实操新手引导完成标记保存在 `localStorage` 键名 `hungry_shark_tutorial_done_v1`（值为 `'1'` 表示已完成或跳过，可通过暂停菜单“🎓 重温新手引导”重置）。

---

## 5. 生态刷新器与新手浅滩安全区 (`src/game/ecosystemSpawner.ts`)

- **85% 原生深度带约束 + 浅滩安全区钳制**：当玩家处于阳光珊瑚浅滩（`sharkY <= 380m`）时，屏幕外向下预刷新的鱼群深度被严格钳制在 `<= 440m`，杜绝 `520m+` 暮光带掠食者在浅海玩家正下方提前刷出。
- **动态咬合阶位感知权重（Bite-Tier-Aware Spawning）**：
  - 新手保护期（教程进行中或 `T1` 开局前 20 秒）：浅滩刷新权重为 `T1: 84% / T2: 16% / T3+: 0%`，并自动过滤深水雷（`isHazard`）与主动追咬掠食者（`CHASE_ATTACK`），只保留温顺或受惊逃逸的猎物。
  - 常规 `T1` 浅滩期：`T1: 76% / T2: 18% / T3: 6%`。
  - `T2+` 浅滩进阶期：`T1: 54% / T2: 26% / T3: 14% / T4: 6%`。

---

## 6. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-10-28 | 新增 3 步实操新手引导状态机（`EAT_SMALL_FISH` ➔ `HOLD_BOOST` ➔ `HANDS_ON_UPGRADE` + 新手补给礼包）、`ecosystemSpawner.ts` 浅滩安全区与咬合阶位感知权重，以及 3D 轮盘式进化图谱组件 | `src/App.tsx`, `src/game/ecosystemSpawner.ts`, `src/components/SharkEvolutionAtlasModal.tsx` |
| 2026-10-27 | 新增 `public/assets/aistudio/icons_f5128c12.png`（6×4 UI 图标图集）、`src/components/UiAtlasIcon.tsx` 及 `spriteSheetManager.ts` BFS 智能镂空抠图与缓存管线 | `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx` |
| 2026-10-26 | 建立完整的三层解耦架构文档、目录职责表与 `SharkMetaSaveData` 存档规范 | `src/App.tsx`, `src/game/*` |

