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
│       ├── fish2_fc857cfa.png                 # 32 种海洋猎物与巨兽核心精灵图
│       ├── icons_f5128c12.png                 # 24 枚游戏级 UI 技能勋章与图标图集（6 列 × 4 行）
│       ├── buttons_16e3a0cf.png               # 科幻金属中空头像数据栏（UI_PLATE_AVATAR_BAR）与绿/蓝/金三色横幅按钮图集
│       ├── setting_83a7a273.png               # 暂停/设置弹窗 9 合 1 科幻金属框体、鲨鱼信息卡与八角按钮图集
│       ├── bg_shallow_0_water_0e65cb68.png    # 浅海带 Layer 0：阳光丁达尔光束与焦散水体底图
│       ├── bg_shallow_1_far_8898229a.png      # 浅海带 Layer 1：远景海底山脉拱门与沉船剪影
│       ├── bg_shallow_2_mid_b4e0d30a.png      # 浅海带 Layer 2：中景鹿角珊瑚礁盘与紫管海绵崖壁
│       ├── bg_shallow_3_near_96e92ee1.png     # 浅海带 Layer 3：近景金沙滩、珍珠巨蚌与沉没铁锚
│       ├── bg_twilight_0_17bcb84c.png         # 暮光带 Layer 0：深海幽蓝斜射光束与生物发光微粒水体底图
│       ├── bg_twilight_1_04f5d35f.png         # 暮光带 Layer 1：远景亚特兰蒂斯沉没柱廊神殿与发光裂谷崖壁
│       ├── bg_twilight_2_fd5a1b33.png         # 暮光带 Layer 2：中景巨鲸肋骨拱廊、发光海葵、玻璃海绵与白珊瑚
│       ├── bg_twilight_3_6e0dd7c1.png         # 暮光带 Layer 3：近景深海海百合、紫色海扇与沉没古陶罐海床
│       ├── bg_abyss_0_1bbf506a.png            # 深渊带 Layer 0：黑曜石深渊热液红光与上浮火星水体底图
│       ├── bg_abyss_1_75e4a628.png            # 深渊带 Layer 1：远景海底火山群峰、柱状玄武岩与熔岩溪流
│       ├── bg_abyss_2_6ce66695.png            # 深渊带 Layer 2：中景黑烟囱热液喷口浓烟、红白巨型管虫与熔岩裂隙
│       ├── bg_abyss_3_a4986280.png            # 深渊带 Layer 3：近景黑烟囱热液群、红冠管虫簇与龟裂熔岩海床
│       └── bg_ambient_sprites_0c6882ce.png    # 4×2 海洋氛围精灵图集（沙丁鱼风暴/蝶鱼群/蝠鲼/水母/巨藻/海鞭/气泡/灯笼鱼）
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
    │   ├── UiAtlasIcon.tsx                    # UI 图集渲染组件（UiAtlasIcon / UiAvatarDataBar / UiBannerButton / UiSettingModalFrame / UiSettingSharkCard / UiSettingButton）
    │   └── SharkEvolutionAtlasModal.tsx       # 48 阶鲨鱼图谱弹窗（支持血统筛选、本体升级与新形态解锁）
    └── game/
        ├── config.ts                          # 静态世界常量、3 大深度带、32 种海洋生物基础配置
        ├── sharkEvolutionConfig.ts            # 48 阶鲨鱼进化矩阵、四重血统、三重解锁门禁、跨局存档读写
        ├── rules.ts                           # 纯函数核心规则（Lv/T 属性合成、猎物相对体型缩放、碰撞判定）
        ├── rules.test.ts                      # 核心纯函数单元测试套件（17 项核心断言）
        ├── spriteSheetManager.ts              # 8×6 鲨鱼精灵图 + 6×4 UI 图标 + 头像栏/横幅按钮 + 暂停界面 9 合 1 图集加载、BFS 智能镂空抠图与离屏缓存
        ├── canvasRenderer.ts                  # 鲨鱼多段脊柱游动渲染、32 种猎物骨骼渲染、状态指示环与定制图标头标
        ├── parallaxBackground.ts              # 13 张 AI 分层美术背景离屏 BFS 抠图/余弦无缝拼接与五层真视差海洋环境引擎
        ├── infiniteWorldManager.ts            # 无限水平环形世界与动态深海垂直下潜边界控制器
        ├── ecosystemSpawner.ts                # 85% 原生深度带生态刷新器、浅滩新手安全区与咬合阶位感知刷新
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
  - `shark`：玩家鲨鱼坐标、速度、角度、转向角速度 `turnRate`、水平朝向与 2.5D 透视翻转系数（`facingDir` / `facingScaleX`）、生命值、饥饿延迟黄条 `ghostHp`、冲刺能量、局内等级 `level`、经验 `xp`、当前形态 `sharkFormId` 及合成属性 `stats`。
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

## 5. 生态刷新器与浅滩无主动攻击保护区 (`ecosystemSpawner.ts`)

- **舒适疏朗的同屏生态密度控制（`maxActivePreys = 20`）与实时动态扩缩容（`syncPreyCountImmediate`）**：默认将同屏活跃猎物上限设定为 `20` 条，视野外生成环扩展为 `640px ~ 1650px`，并将 `T1` 小型鱼成簇概率控制在 `28%`（每次仅伴游 `1` 条同种鱼形成双鱼结伴，伴游间距 `96px × 64px`），避免浅海垂直空间内鱼群过度扎堆拥挤；同时保留 `syncPreyCountImmediate()` 方法与局内 Debug 调节面板代码（`4 ~ 80` 条，默认隐藏调参按钮）。
- **85% 原生深度带约束 + 浅滩下界永久钳制 (`ecosystemSpawner.ts`)**：当玩家处于阳光珊瑚浅滩上中层（`sharkY <= 430m`）时，屏幕外向下预刷新的鱼群深度全程被钳制在浅海区内（新手期 `<= 440m`，常态期 `<= 495m`），彻底杜绝 `520m+` 暮光带鳗鱼等掠食者在浅海玩家正下方提前刷出。
- **浅海全程零主动攻击鱼类 + 动态咬合阶位感知权重（Bite-Tier-Aware Spawning）**：
  - 整个阳光珊瑚浅海（`0m ~ 520m`）全程永久屏蔽主动冲刺攻击型掠食者（`EEL_CHARGER` / `SUB_PATROL` / `HEAVY_CRUISER` / `KRAKEN_BOSS`）与水雷（`MINE_HAZARD`），仅刷新 `T1 ~ T3` 珊瑚礁鱼群。
  - 新手保护期（教程进行中或 `T1` 开局前 20 秒）：浅滩刷新权重为 `T1: 84% / T2: 16% / T3+: 0%`。
  - 常规 `T1` 浅滩期：`T1: 76% / T2: 18% / T3: 6% / T4+: 0%`。
  - `T2+` 浅滩进阶期：`T1: 58% / T2: 28% / T3: 14% / T4+: 0%`。

---

## 6. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-11-03 | **替换暮光深海带与深渊海沟带 8 张 21:9 超宽全景背景素材（`bg_twilight_0..3_*.png` & `bg_abyss_0..3_*.png`）**：更新 `OCEAN_LAYER_ASSET_PATHS` 资产清单、新增 `unmixHydrothermalSmokeSky` 黑烟白底解混管线，并按 `1916×821` 超宽画幅标定暮光带与深渊带三平面高度与高程比例 | `src/game/parallaxBackground.ts`, `public/assets/aistudio/bg_twilight_*.png`, `public/assets/aistudio/bg_abyss_*.png`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-02 | **全面升级死亡复苏与狩猎结算界面（`gameState === 'gameover'`）科幻装甲弹窗体系、优化游戏主界面顶部 HUD 与暂停界面布局**：① 为 `SETTING_MODAL_FRAME` 生成顶部梯形铭牌去暂停标纯净变体（`getUiSettingCleanModalFrameDataUrl()`），使死亡紧急复苏（`variant="revive"`）与狩猎结算（`variant="settlement"`）统一采用 `980:688` 科幻金属装甲框体、`<UiSettingSharkCard />` 实时鲨鱼展台、三联复苏增益矩阵 / 四维金属遥测铭牌与平衡八角按钮，消除横屏溢出与按钮 2+1 孤行折行；② 将局内左上角 `hud-avatar-data-bar` 缩小 30% 至 `w-[151px] sm:w-[178px] lg:w-[217px]`，并将分数组件 `hud-telemetry-pill` 水平居中且将上边缘精确对齐至头像框右侧数据板上边直线部分高度（`mt-[8.5px] sm:mt-0 sm:top-[15.5%]`），确保全分辨率下零 UI 重叠；③ 将暂停界面 `UiSettingSharkCard` 高度缩短为 `h-[23.5%] shrink-0` 使所有按钮完整收纳于框内，并修复 `Restart`/`Main Menu` 按钮图标提取与底图线性插值修补 | `src/App.tsx`, `src/components/UiAtlasIcon.tsx`, `src/game/spriteSheetManager.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-01 | **调整移动端优先首页（`gameState === 'title'`）布局与中央鲨鱼水平转身动画**：将首页头像名称及数据模块（`title-avatar-data-bar`）移至左上角，并将首页头像数据模块（缩小 30% 至 `w-[203px] sm:w-[245px] md:w-[273px]`）及三枚主操作横幅按钮（立即潜入深海 / 进化 / 试驾机甲利维坦，缩小 30% 至 `w-[154px] sm:w-[140~144px] md:w-[157~162px]`）等比缩减 30%；去掉离线 HTML 下载链接与底部操作提示文字；将主标题上移至顶部区域、三枚主按钮下移至底部区域，将首页摄像机锁定于鲨鱼正中心（`sim.camera.y = shark.y`），并复用局内优化过的 **2.5D 透视水平甩尾掉头与流体力学 C 形脊柱转弯物理机制**驱动首页鲨鱼水平巡游转身 | `src/App.tsx`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-01 | **接入 `setting_83a7a273.png` 暂停弹窗 9 合 1 图集并按 `setting1.png` 重构暂停页布局**：① `spriteSheetManager.ts` 新增 `UiSettingKey` 与 `processAndSliceUiSettingsImage()`，自动抠除 `setting_83a7a273.png` 外围与弹窗框体内部深灰网格背景（`RGB(27,28,32)`），裁切出弹窗外框（`SETTING_MODAL_FRAME`）、鲨鱼信息卡（`SETTING_SHARK_CARD`）及进化/继续狩猎/语言/音效/引导/重新开始/返回主界面共 9 个高清组件；② `UiAtlasIcon.tsx` 新增 `<UiSettingModalFrame />`、`<UiSettingSharkCard />` 与 `<UiSettingButton />`；③ `App.tsx` 按 `setting1.png` 布局重构暂停界面 | `public/assets/aistudio/setting_83a7a273.png`, `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-11-01 | **接入 `buttons_16e3a0cf.png` 科幻金属中空头像数据栏与绿/蓝/金三色横幅按钮图集**：① `spriteSheetManager.ts` 新增 `UiBannerKey`（`UI_PLATE_AVATAR_BAR`、`UI_BAR_BTN_GREEN`、`UI_BAR_BTN_BLUE`、`UI_BAR_BTN_GOLD`）与 `processAndSliceUiBannersImage()`，通过 BFS 泛洪去底 + 左环圆心 `(0.2398W, 0.3125H)` 镂空抠图 + 6px 外发光光晕去灰底（`RGB(60,60,60)`）并完整保护右侧深海藏青数据板（`RGB(26,34,45)`）；② `UiAtlasIcon.tsx` 新增 `<UiAvatarDataBar />` 与 `<UiBannerButton />` 组件；③ `App.tsx` 全面替换首页头像数据栏与三大主按钮、局内左上角头像与血条/能量条组件，以及暂停界面/结算界面的头像栏与操作按钮 | `public/assets/aistudio/buttons_16e3a0cf.png`, `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-10-31 | **固化默认参数（鱼群刷新数量 `20`、猎物显示大小 `0.8`）并隐藏调参按钮（保留调参代码功能）**：① `ecosystemSpawner.ts` 将默认 `maxActivePreys` 固化为 `20`；② `rules.ts` 将默认 `debugPreySizeMultiplier` 固化为 `0.8`；③ `App.tsx` 保留全部实时调参代码与重置逻辑（重置为 `20 / 0.8`），将 `showDebugPanel` 默认设为 `false` 并隐藏标题页与局内 HUD 的 `🛠 调参` 按钮 | `src/game/ecosystemSpawner.ts`, `src/game/rules.ts`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-10-31 | **新增实时调参 Debug 面板（鱼群刷新数量 & 猎物显示大小实时调节器）**：① `ecosystemSpawner.ts` 新增 `syncPreyCountImmediate()`，支持实时调高/调低 `maxActivePreys`（`4 ~ 80`）并在同帧从最远端回收多余猎物或补充新鱼；② `rules.ts` 新增 `getDebugPreySizeMultiplier()` / `setDebugPreySizeMultiplier()`（`0.35x ~ 2.50x`），在 `getPreyRelativeVisualScale` 中同步缩放渲染与碰撞半径；③ `App.tsx` 新增可收起/展开的 `🛠 实时调试面板 (Debug)`，支持滑动条、快捷步进与一键重置默认 | `src/App.tsx`, `src/game/rules.ts`, `src/game/ecosystemSpawner.ts`, `src/game/rules.test.ts` |
| 2026-10-31 | **降低鱼群刷新密度与阳光浅水区零主动攻击优化**：① `ecosystemSpawner.ts` 将同屏最大猎物数 `maxActivePreys` 由 `50` 下调至 `28`，生成环扩展至 `640~1650px`，并将 `T1` 小鱼成簇概率由 `55%`（3 条扎堆）下调为 `28%`（双鱼结伴），`App.tsx` 开局迎宾小鱼由 `10` 条精简为 `5` 条、标题界面巡游鱼由 `32` 条精简为 `18` 条；② 浅水区（`0m ~ 520m`）永久移除海鳝（`green_moray_eel` 迁至 `560m ~ 1180m`）等主动冲刺攻击鱼类 | `src/game/ecosystemSpawner.ts`, `src/App.tsx`, `src/game/parallaxBackground.ts`, `src/game/config.ts`, `src/game/rules.test.ts` |
| 2026-10-30 | 全链路 60FPS 渲染与启动性能深度优化：（1）`canvasRenderer.ts` 引入 `WeakMap` 离屏着色纹理缓存（`getPrebakedTintedFrame`），彻底消除黄金狂暴/变异鱼/受击闪烁时每帧数百次切片级 `ctx.filter` 重绘开销，并将 `drawUndulatingSpriteFrame` 内层切片循环改为仿射逆矩阵直驱（零 `ctx.save/restore`）；（2）`parallaxBackground.ts` 引入分帧异步预处理队列（`enqueueProcessingTask`，每帧最多处理 1 张背景图层）与 640px 最优纹理降采样、单遍 $O(W\times H)$ 天际线柔化、单次合并渲染的体积光束及预烘焙 256×256 深海暗角缓存；（3）`spriteSheetManager.ts` 消除 94 次冗余 `getImageData` GPU 回读并将 UI 图标 `toDataURL` 改为按需懒加载；（4）`App.tsx` 移除 `tick()` 中每帧同步触发的 `getBoundingClientRect()` 强制回流，并对海面波浪、温跃层波带及掉落物/猎物执行严格视锥体裁剪（Frustum Culling） | `src/game/canvasRenderer.ts`, `src/game/parallaxBackground.ts`, `src/game/spriteSheetManager.ts`, `src/App.tsx`, `src/components/SharkFormCanvasPreview.tsx` |
| 2026-10-30 | `parallaxBackground.ts` 升级为五层连续水深光谱（`sampleBathymetricWaterColor`）与远/中/近（`0.13x`/`0.27x`/`0.48x`）三平面真视差海洋环境引擎；`simRef.current.shark` 新增流体力学转向状态（`turnRate`、`facingDir`、`facingScaleX`） | `src/game/parallaxBackground.ts`, `src/App.tsx`, `src/game/canvasRenderer.ts`, `src/game/rules.test.ts` |
| 2026-10-28 | 新增 3 步实操新手引导状态机（`EAT_SMALL_FISH` ➔ `HOLD_BOOST` ➔ `HANDS_ON_UPGRADE` + 新手补给礼包）、`ecosystemSpawner.ts` 浅滩安全区与咬合阶位感知权重，以及底部罗盘弧形拨盘进化图谱组件 | `src/App.tsx`, `src/game/ecosystemSpawner.ts`, `src/components/SharkEvolutionAtlasModal.tsx` |
| 2026-10-27 | 新增 `public/assets/aistudio/icons_f5128c12.png`（6×4 UI 图标图集）、`src/components/UiAtlasIcon.tsx` 及 `spriteSheetManager.ts` BFS 智能镂空抠图与缓存管线 | `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx` |
| 2026-10-26 | 建立完整的三层解耦架构文档、目录职责表与 `SharkMetaSaveData` 存档规范 | `src/App.tsx`, `src/game/*` |
