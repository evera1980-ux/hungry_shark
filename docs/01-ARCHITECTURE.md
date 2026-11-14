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
        ├── worldGenerationSystem.ts           # 八模块程序化海底世界生成系统（WorldGenerator / BiomeManager / TerrainGenerator / StructureGenerator / EcologyGenerator / ChunkManager / DecorationRenderer / WorldStateManager）
        ├── infiniteWorldManager.ts            # 无限水平环形世界与动态深海垂直下潜边界控制器
        ├── ecosystemSpawner.ts                # 85% 原生深度带 + Poisson Disk 群落聚集生态刷新器、浅滩新手安全区与咬合阶位感知刷新
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

## 5. 八模块程序化海底世界生成系统 (`worldGenerationSystem.ts`) 与生态刷新器 (`ecosystemSpawner.ts`)

- **四尺度（`L0 ~ L3`）八模块程序化生成架构 (`src/game/worldGenerationSystem.ts`)**：
  1. `WorldGenerator` & `WorldSeedService`：管理全局种子 `worldSeed`、生成算法版本 `generatorVersion`、子系统隔离随机流 `createChunkRng(seed, version, cx, cy, subsystemKey)`（涵盖 `'terrain' | 'flora' | 'fauna' | 'poi' | 'ambient'`）、稳定对象 ID `createStableId(seed, version, category, chunkX, chunkY, localIndexOrKey)`、确定性哈希、$C^2$ 连续噪声与六大环境数值场（`depthField`、`heightField`、`slopeField`、`temperatureField`、`lightField`、`biomeField`）及生态概率函数（`coralProbability`、`seagrassProbability`、`kelpForestProbability`、`biolumProbability`）。
  2. `BiomeManager` & `BiomeGenerator`：按《v1.0 规范》第 5、7、11 节实现水平宏区确定性 Biome 选择 `getMacroBiomeForIndex(macroIndex)`（宽度 `macroWidth = 30000`、5 类首版宏观生态区 `coral_reef` / `rocky_shelf` / `open_ocean` / `underwater_canyon` / `deep_abyss`，由 `Seed + macroIndex` O(1) 闭式确定并保证相邻宏区必不相同，Chunk 绝不独立抽签）、跨宏区边界 $C^2$ 五次平滑混合 `getBiomeAt(worldX, worldY)`（过渡带 `transitionWidth = 6000`，归一化权重 `sum(weights) === 1.0`）、垂直 5 大深度带 `getDepthBandAt(worldY)`（`Epipelagic 0–2000` / `Mesopelagic 2000–6000` / `Bathypelagic 6000–10000` / `Abyssopelagic 10000–16000` / `Hadal-like 16000–20000`）以及统一深度视觉 Profile `getDepthVisualProfile(depth)`（统一提供连续变化的亮度、色调、光束衰减、颗粒密度、发光比例与可见距离）。
  3. `TerrainGenerator`：基于「20 步地质块锚定 + 4 层多尺度随机域扭曲断崖/阶梯岩台/V 型折叠峡谷 + 守恒斜率重分配」算法（宏观构造双波 `16000m & 10500m` / 振幅 `9600m`、中尺度峡谷阶梯波 `1900m & 1350m` / 振幅 `2800m`、局部岩礁断层波 `620m & 260m` / 振幅 `720m`）实现全局海床深度函数 `getFloorDepthAt(worldX)`、斜率函数 `getTerrainSlopeAt(worldX)`（严格限制最大坡度 `<= TERRAIN_MAX_SLOPE (2.4)`）与 Chunk 采样函数 `getTerrainSamples(chunkX)`，保证任意访问顺序下相邻 Chunk 左右接缝点 100% 恒等（`lastSample === next.firstSample`）、海床深度完整覆盖 `[420m, 19800m]`（世界最大深度 `maxDepth = 20000m`，且 `WORLD_UNITS_PER_METER = 1` 实现引擎坐标与规范坐标 1:1 统一），同时 `1.0x` 世界层海床渲染（`renderPhysicalSeabed`）、物理碰撞（`resolveSeabedCollision`）与贴地锚点采样（`sampleSeabedAnchorAt`）严格共用同一 `getFloorDepthAt(x)` 数据源。
  4. `StructureGenerator` & `POIGenerator`：一方面基于全局 Voronoi 单元格、规则模板与跨边界连续 SDF（`evaluateCaveSignedDistance`）生成礁石通道拱门、岩体洞穴、连续阶梯岩壁、沙丘与深渊热液岩冢；另一方面按《v1.0 规范》第 9 节实现 5 类首版局部 POI（`shipwreck`、`cave`、`treasure`、`rare_creature_nest`、`landmark`）的确定性生成函数 `generatePOIs(chunkX, chunkY)` 与跨界占地查询 `getOverlappingPOIsForChunk(chunkX, chunkY)`，严格保证每个 Chunk 至多拥有 1 个 POI、任意两个 POI 中心间距 `>= 1900 worldPx`（零占地重叠）、宏区密度上限受控，且跨 Chunk 显示仅由中心点所在的 `ownerChunkId` 唯一归属管理。
  5. `EcologyGenerator` & `ChunkGenerator`：一方面维护视差近景 L3 群落装饰，另一方面按《v1.0 规范》第 7、8、13 节实现 15 类完整配置表 `ECOLOGY_OBJECT_CONFIGS`（涵盖珊瑚、岩石、海草、鱼群、水母、发光生物、沉船碎片、气泡、浮游颗粒、海雪、洞穴、宝藏、地标、沉船、稀有生物巢穴）与 11 步固定生成管线 `generateChunk(chunkX, chunkY)` / `generateEcology(chunkX, chunkY)`（含算 bounds、查 Biome/深度带、创建隔离 RNG、通过 `getTerrainSamples` 精确锁定 Chunk 内海床穿过区间 `inChunkSeabedX` 的簇群中心候选点、深度/Biome/海床距离/左闭右开边界过滤、按权重选类型与变体、含邻 Chunk 的对称优先级最小间距消解、POI 唯一归属与占地避让、`createStableId` 稳定 ID、按渲染层与坐标稳定排序、输出纯数据 `GeneratedChunkData`）。
  6. `ChunkManager`：负责屏外预生成（`[-2..+2]` Chunks）、LRU 缓存与远端回收。
  7. `DecorationRenderer`：执行连续地貌结构与局部生态装饰的 3 级 LOD 裁剪与绘制。
  8. `WorldStateManager`：记录玩家探索过的宏观生态区、已访问 Chunk 与群落交互状态。
- **舒适疏朗的同屏生态密度控制（`maxActivePreys = 20`）与 Poisson Disk 群落式伴游生成**：默认将同屏活跃猎物上限设定为 `20` 条，视野外生成环扩展为 `640px ~ 1650px`，结合 `BiomeManager.evaluateMacroZone` 的聚集概率与 `EcologyGenerator.samplePoissonDiskInCluster`（`minDist = 56px`）生成群居伴游鱼；同时保留 `syncPreyCountImmediate()` 方法与局内 Debug 调节面板代码（`4 ~ 80` 条，默认隐藏调参按钮）。
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
| 2026-11-14 | **扩展为全深度 9 级随深度递增的非均匀间距连续阶梯海床架构（`SEABED_TERRACE_TIERS` / `getSeabedTerraceAt`）+ 层间交错弧形下潜洞口 + 全层级双向防穿透碰撞与生态附着（覆盖 `414m` 浅海至 `16900m` 冥渊海沟）**：① **9 级随深度递增的非均匀间距连续海床矩阵**：按浅海连续海床的同等实现范式，从阳光浅海一路向深渊铺设 9 层间距随深度递增的阶梯海床——`Tier 0` 阳光浅海珊瑚层（`~414m`）$\xrightarrow{+806\text{m}}$ `Tier 1` 上暮光层礁石阶地（`~1220m`）$\xrightarrow{+1000\text{m}}$ `Tier 2` 中暮光层海谷台地（`~2220m`）$\xrightarrow{+1240\text{m}}$ `Tier 3` 深暮光半深海峡谷（`~3460m`）$\xrightarrow{+1580\text{m}}$ `Tier 4` 半深海裂谷前哨阶地（`~5040m`）$\xrightarrow{+2020\text{m}}$ `Tier 5` 深海玄武岩断崖（`~7060m`）$\xrightarrow{+2580\text{m}}$ `Tier 6` 深渊幽冥海盆阶地（`~9640m`）$\xrightarrow{+3260\text{m}}$ `Tier 7` 超深渊黑曜石裂谷（`~12900m`）$\xrightarrow{+4000\text{m}}$ `Tier 8` 冥渊海沟热液前哨（`~16900m`），不仅层间垂直间距（`806m -> 4000m`）与净空走廊高度（`394m -> 3268m`）随深度严格递增，水平周期（`1600m -> 3600m`）与下潜洞口宽度（`464m -> 832m`）亦随深海巨型进化鲨鱼体型同步放大；② **上下层交错下潜洞口与主海山无痕嫁接**：各层均采用无悬空立柱、连续海床后壁 + 向远处弯曲的弧形下潜洞口 + 三阶地下沉积岩层（含 `coral_reef`、`rocky_shelf`、`underwater_canyon` 与 `deep_abyss` 黑曜熔岩材质）设计，并通过 `seamPhaseOffsetX` 将相邻层的下潜洞口水平错开，且各层与主海床大陆坡交汇处执行 $C^2$ 平滑嫁接并隐去山根内部表层线；③ **全层级双向物理碰撞与底栖生态扩展**：`resolveSeabedCollision` 与 `resolveSeabedKineticStep` 遍历全部 9 层阶梯海床，支持各层顶面承托、底部拱形洞顶防向上穿透阻挡（`hitAtollUnderside = true`）以及层间水平走廊 100% 畅通巡游；`getShallowCoralAtollOutcropsForChunk` 与 `WorldRenderer.renderActiveChunkEntities` 同步扩展至 `240m~18000m`，在全部浅/中/深渊海床顶面附着生成底栖群落 | `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-13 | **取消浅海悬空立柱 + 连续浅海珊瑚海床与向远处弧形弯曲的下潜洞口（`evalShallowSeabedContinuousRaw`）+ 浅层海床从下向上双向防穿透修复（`resolveSeabedCollision` / `resolveSeabedKineticStep`）**：① **取消悬空立柱并实现浅海海床全连续**：移除 `renderPhysicalSeabed` 中未触底的突兀垂直桥墩（`buttressIdx`），将浅海海床改为全图 $C^1$ 连续曲线并与出生点主海山斜坡执行 $C^2$ 平滑嫁接（`graftT`），使浅海珊瑚海床直接从主海山山腰无缝生长延伸，彻底消除孤立浮岛断口；② **向远处弯曲的弧形下潜洞口**：在每 `1600m` 下潜通道区（`absDist < 232m` 物理开放、`< 416m` 视觉凹陷），海床表层不断开，而是沿向远处下凹的弧线（`visualRimY`，最大下凹 `+148m`）连续延伸，配合远景大气蓝雾、深邃蓝洞洞腔径向暗影、3 道向内向下弯曲的环形岩阶与圆润洞唇礁石，营造自然的向下弧形洞口视觉；③ **彻底修复浅层海床从下向上穿透 Bug**：在 `resolveSeabedCollision` 与 `resolveSeabedKineticStep` 中引入 `prevEngineY` 归属侧锁定（凡 `refY > topFloorY + 4` 一律判定为海床下方），使从下方游向或冲刺撞击浅海海床的实体严格被底部拱形洞顶 `bottomArchY + safeRadius` 向下阻挡（`hitAtollUnderside = true`）并阻止挤入山根狭窄楔形区，100% 杜绝从下向上穿出浅海海床 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-13 | **海床「表层以下」专属无缝层状基岩纹理生成（`sliceAndMakeSubsurfaceBedrockStrip`）+ 山体全高度多层顺势地质岩壁与断面岩块镶嵌（`renderPhysicalSeabed`）**：① **消除表层以下空洞与生硬黑边**：在 `sliceAndMakeSeamlessSeabedStrip` 中为表层岩壳底部 `26%` 注入余弦 Alpha 柔化羽化，消除表层条带底部的硬切边；② **构建 4 生态区专属表层以下无缝层状基岩纹理（`seabedSubStratumCanvases`）**：在 `WorldAssetRegistry` 中新增 `sliceAndMakeSubsurfaceBedrockStrip`，提取 `world_seabed_strips` 中纯手绘阶梯状岩石层理与各生态区纵向裂隙/发光青脉/火山熔岩纹路（彻底剔除表层粉红珊瑚、浅滩金沙等表层元素，并将浅海区重着色为温暖赭石砂岩与礁灰岩），配合 `14%` 水平无缝循环与顶/底双端余弦羽化；③ **山体内部 Clip 全高度多层岩壁叠铺 + 断面巨石露头镶嵌**：在 `renderPhysicalSeabed` 中对主海床山体与浅海珊瑚环礁拱台开启 `ctx.clip()`，近表层（`Tier 0..1`）按 `25m` 样条子段紧贴山脊曲率铺设，深部（`Tier 2..10`）按黄金分割水平错相与逐层平缓化斜率（`slope * 0.78^tier`）一路无缝叠铺至视野底端 `maxEngineY`，并在高耸山体断面上按确定性哈希镶嵌 `mossy_slab` / `basalt_boulder` / `jagged_spire` 阶梯岩块露头，使整座海底山脉从表层以下直至屏幕底端均充满扎实丰富的岩石肌理 | `src/game/worldGenerationSystem.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-13 | **层峦叠嶂山脉海床轮廓（零水平直线 + 零斜向直线）+ 10 对偶奇零和山脊曲率修正 + 跨块双生交错斜率格网（Lattice A/B）锚定 + `4×25m` Catmull-Rom 样条山脊曲线细分渲染**：① **彻底消除平的直线**：移除出生点 `|X| <= 520m` 常数平顶锁死、`evalSandyPlainFactor` 单元中心常数深度锁死以及浅海珊瑚环礁拱台 `±14m` 平顶，改为多频叠加的阳光珊瑚山丘（`spawnHills`）、波状沙丘山岭（`rollingHills`）以及 `±68m` 四谐波连绵珊瑚山峦拱桥（`evalShallowAtollTopAndSlopeRaw` + 钟乳石洞窟拱底），使海床斜率持续正负交替起伏；② **彻底消除斜的直线**：升级 `evalSlopeVariationOffset` 为三层视口级海底山脉波（`1180m/780m` 主山系、`520m/340m` 次级连峰、`220m/145m` 岩脊褶皱），移除 `2000m` 块边界 `detailScale = 0` 断崖锁死，改用 $C^\infty$ 块内山脉包络 `mountainCap = 240 + 480 * sin^2(πx/2000)` 与 `redistributionLimit = 1.36 * stepX`，为块内每一对采样步预留至少 `0.29 * stepX` 的曲率空间；③ **三遍零和反共线山峦曲率修正（`evalGridNodeFloorDepth`）**：Pass 1 对 10 个不相交偶奇步对 `(2m, 2m+1)` 注入正交山脊拱度 `(avg - c, avg + c)` 并精确推离 `[-0.045, +0.045]` 水平死区；Pass 2 消除奇偶跨对共线；Pass 3 将块首步 `d_0` 与块末步 `d_19` 分别锚定于互不相交的双生交错斜率格网 `Lattice B: (0.36k + 0.09)*stepX` 与 `Lattice A: (0.36k - 0.09)*stepX`，100% 保证全海域任意单步 `|slope| >= 0.035` 且任意相邻两步（含跨块边界）`|Δslope| >= 0.08`；④ **`4×25m` Catmull-Rom 样条山脊曲线细分渲染（`renderPhysicalSeabed`）**：将浅海珊瑚环礁拱桥加密至 `32` 段，并将主海床每 `100m` 网格段细分为 `4 × 25m` Catmull-Rom 三次样条 + 确定性岩脊微起伏子段（端点 `subT = 0, 1` 严格对齐物理碰撞节点），使基岩多边形与 `world_seabed_strips` 轮廓贴图呈现如群山般流畅起伏的曲线 | `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-13 | **平顶海山（Guyot）山顶柔化 + 多级阶梯与逆坡斜坡变化（`TERRAIN_MAX_SLOPE = 1.65`）+ 顺地形上坡单位切向量速度守恒（`resolveSeabedKineticStep`）+ 双层空间「浅海镂空珊瑚环礁拱台（`getShallowCoralAtollAt`）」架构**：① **山顶宽缓平顶化**：在 `evalRidgedTerrainWave`、`evalBaseMacroOffsetAtX` 与 `evalRawRandomFloorDepthAtX` 中引入导数不放大（$f'(0)=1.0$）的 $C^1$ 抛物平顶海山（Guyot Tablemount）压缩、全局浅水山顶缓冲（`< 760m`）与 `evalGridNodeFloorDepth` 局部 V 峰钝化，并将出生点浅海珊瑚台地拓宽为 `X ∈ [-520m, +520m]` 的宽阔平坦台地（深度 `~530m~565m`，`|slope| <= 0.14`）；② **下降斜坡多级阶梯与逆坡起伏**：将最大坡度上限 `TERRAIN_MAX_SLOPE` 下调至 `1.65`，新增 `evalSlopeVariationOffset`（半山阶梯缓台波 + 坡中逆向背斜脊波）与 `evalGridNodeFloorDepth` 单步地质节奏调制（`scratchStepRhythm`），使下降斜坡交替呈现水平沙台（`|slope| <= 0.25`）、局部微上扬逆坡（`slope < 0`）、舒缓坡面与岩坎；③ **消除顺地形上坡异常加速**：新增 `resolveSeabedKineticStep`，将贴地游动位移投影至海床单位切向量 $\vec{T} = \frac{1}{\sqrt{1 + s^2}}(1, s)$（乘以 `tangentScale = 1 / Math.sqrt(1 + slope^2)` 及上坡阻力系数 `0.90`），彻底根治此前因 `vx` 未归一化导致的 $\sqrt{1 + s^2}$ 倍（最高 `2.6倍`）上坡超速问题；④ **双层浅海镂空珊瑚环礁拱台（兼顾浅水丰富珊瑚区与深海无阻隔畅游）**：新增 `getShallowCoralAtollAt` 与 `getShallowCoralAtollOutcropsForChunk`（每 `1600m` 水平网格在主海床 `> 920m` 的深水区上方 `350m~510m` 生成宽 `1152m` 的镂空珊瑚礁拱桥），在 `renderPhysicalSeabed` 与 `WorldRenderer.renderActiveChunkEntities` 中绘制拱桥顶层 `coral_reef` 海床贴图、底层玄武岩拱洞及顶面 4 层复合珊瑚礁群落，并在 `resolveSeabedCollision` 中实现双层分流（浅水 `<= 640m` 承托碰撞，深水 `650m ~ 20000m` 从拱桥下方 100% 无阻隔自由穿行） | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-12 | **优化圆润宽幅 U/V 型折叠脊谷波（`evalRidgedTerrainWave`）+ 高频平缓沙坪段台地锁平（`evalSandyPlainFactor`）+ 全链路 5 大内存回收与零 GC 泄漏治理（解决 5 分钟 3GB+ 内存膨胀）**：① 将中尺度折叠波幅度 `mediumWaveAmplitude` 提升至 `3800m`（双波长 `2100m & 1450m`），并在 `evalRidgedTerrainWave` 中引入 $C^\infty$ 双曲正切满幅增益、平滑曲率参数 $\varepsilon = 0.28$ 归一化与 `32%` 余弦圆拱混合，消除尖锐针刺折角，形成舒展饱满的 U/V 型海底峡谷与圆拱海脊；② 新增 `1800m` 地质单元平顶窗口沙坪包络 `evalSandyPlainFactor`（覆盖约 40%+ 海域）与单元中心常数深度锁平（`evalBaseMacroOffsetAtX(cellCenter)`）+ `evalGridNodeFloorDepth` 立方级沙坪斜率保护，使平缓沙坪段（`|slope| <= 0.22`）占比达 `>= 22%`；③ 彻底根治 5 大内存泄漏源：新增有界 LRU 地质块缓存 `terrainBlockNodeCache`（上限 `128` 块）与 `terrainChunkSamplesCache`（上限 `64` Chunk）+ 模块级预分配 `Float64Array` 消除每帧 `~4,200` 个临时数组分配（5 分钟减少 `7560 万` 个数组对象）；修复 `ChunkLifecycleManager.updateForViewport` 外围预加载 Chunk 每帧 `unloaded -> ready -> releasing -> unloaded` 状态振荡与 `WorldPersistence.applyToGeneratedChunk` 数组重复克隆；移除 `parallaxBackground.render()` 每帧调用旧版 `proceduralOceanWorld.stepExploration()` 导致的跨深度带缓存清空重建；将 48 张 `@3x` 鲨鱼离屏 Canvas 限制为 `420px` 宽、将 `tintedFrameCache` 改为上限 `24` 的 LRU 缓存并在淘汰与切图完成时立即执行 `canvas.width = 0; canvas.height = 0;` 释放 GPU 显存；为 `audio.ts` 全部 `OscillatorNode`/`GainNode` 绑定 `onended` 自动 `disconnect()` | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts`, `src/game/audio.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-12 | **深度上限扩展至 `20000m`（`1m = 1 worldPx` 全链路 1:1 坐标统一）+ 2D 随机 Chunk 陡坡海床采样完善 + 4 层多尺度随机域扭曲海床坡度算法（`evalWarpedTerrainWave` / `evalRidgedTerrainWave`）**：① 将 `WORLD_UNITS_PER_METER` 统一为 `1`（`1m = 1 worldPx`），使 `WorldConfig.bounds.maxDepth = 20000`（`20000m`）、`minFloorDepth = 420`（`420m`）、`maxFloorDepth = 19800`（`19800m`）与引擎物理/HUD 深度 `1:1` 对齐，并将深海猎物（`cyber_mine`、`glowing_lanternfish`、`giant_humboldt_squid`、`trench_blobfish`、`radioactive_slime_hazard`）的 `maxDepth` 扩展至 `99999` 覆盖全 `20000m` 深渊；② 完善《v1.0 规范》二维随机 Chunk 生成管线：在 `3000m × 1500m` Chunk 尺度下，通过 `getTerrainSamples` 全部 31 个采样点精确锁定陡坡海床穿过当前 Chunk 的横向子区间 `inChunkSeabedX`，确保 `flora` 珊瑚礁簇群 100% 落在真实海床上；③ 移除固定周期模板 `TECTONIC_CYCLE_TEMPLATE_WORLD_Y`，升级为「20 步地质块锚定 + 4 层多尺度域扭曲非对称断崖（`asym`）/ 阶梯岩台（`step`）/ V 型折叠峡谷（`evalRidgedTerrainWave`）+ 守恒斜率重分配」算法（`TERRAIN_MAX_SLOPE = 2.4`），使海床坡度呈现随机阶梯平台、局部反翘海脊与陡峭断崖的丰富自然变化 | `src/game/worldGenerationSystem.ts`, `src/game/config.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-12 | **重构构造板块级海床起伏（`350m` 浅海珊瑚大陆架 $\to$ 大陆坡峡谷 $\to$ `2040m~2720m` 超深渊海沟）+ 移除突兀人工海山岩柱 + 海底轮廓材质图双层深度自适应贴图**：① 移除 `WorldRenderer.renderActiveChunkEntities` 中拔地而起的突兀垂直海山岩柱（`renderTerrainConnectedReefSeamounts`），由真实连续物理海床（`getFloorDepthAt`）在浅海区自然隆起至 `350m~440m` 承托珊瑚礁群落；② 将 `WorldConfig.bounds.maxDepth` 拓展至 `28000`（`2800m`）、`maxFloorDepth = 27200`（`2720m`）、`TERRAIN_MAX_SLOPE = 1.65`，并在 `evalGridNodeFloorDepth` 中实现构造板块周期控制节点（`TECTONIC_CYCLE_TEMPLATE_WORLD_Y`）与中/小尺度起伏波叠加，从出生点向左（`X = -1440m..-2160m`）或向右（`X = +1680m..+2400m`）沿陡峭海底峡谷顺滑下潜即可进入 `2040m~2711m` 的 2000m+ 超深渊海沟；③ 在 `renderPhysicalSeabed` 中将 `world_seabed_strips` 升级为 `152m` 主岩壳 + 副岩层双层仿射斜切贴图，并按每个海床采样段的真实深度动态平滑混合 4 条材质带 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-12 | **重构海床珊瑚礁 4 层复合结构与通底礁石海山，彻底消除漂浮珊瑚/海葵（`WorldRenderer`）**：① 修正底栖生态锚定逻辑：所有 `flora` / `structure` / `ambient(bubble_stream)` / `POI` 均严格以实时连续海床 `getEngineFloorDepthAt(ex)` 结合坡度深埋补偿（`slopeEmbedSink`）作为唯一落点，并屏蔽 `water_column` 类别绘制静态海葵贴图；② 在 `WorldRenderer` 中新增 4 层复合珊瑚礁构造器 `renderCompositeCoralReefMound`（底层斜切嵌地礁岩基座 $\to$ 中层块状脑珊瑚/海绵造礁核心 $\to$ 冠层鹿角珊瑚/海扇分枝群落 $\to$ 礁麓伴生海草）、礁石/残骸共生珊瑚附着器 `renderAnchoredRockOrDebrisWithEpifauna` 以及从深海床连续隆起至浅中层（`250m~780m`）的阶梯状通底礁石海山 `renderTerrainConnectedReefSeamounts` | `src/game/worldGenerationSystem.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-12 | **生成并接入《v1.0 规范》世界空间 3 大高清美术图集（海床表层岩壳 `world_seabed_strips`、5×2 地标 `world_pois_atlas`、4×4 生态装饰 `world_ecology_atlas`）**：在 `src/game/worldGenerationSystem.ts` 的 `WorldAssetRegistry` 中实现 3 张新图集的懒加载、BFS 纯白背景抠图、镂空孔洞清理、14% 余弦无缝海床条带合成与按 `assetKey:variant` 精确索引，并在 `renderPhysicalSeabed` 与 `WorldRenderer.renderActiveChunkEntities` 中全面替换几何线条为手绘美术贴图（同时保留无头单测环境下的占位符安全回退） | `src/game/worldGenerationSystem.ts`, `public/assets/aistudio/world_seabed_strips_1794473245165.jpg`, `public/assets/aistudio/world_pois_atlas_1794473250443.jpg`, `public/assets/aistudio/world_ecology_atlas_1794473252524.jpg`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **移除原有的远/中/近（`1_far` / `2_mid` / `3_near`）静态分层背景图，切换为纯净连续水深水体 + 世界空间 `1.0x` 程序化实体海床与 Chunk 生态渲染**：在 `src/game/parallaxBackground.ts` 中移除浅海/暮光/深渊共 9 张远/中/近景（`1_far`、`2_mid`、`3_near`）静态背景图的加载与绘制，保留连续水深光谱渐变、`0_water` 水幕、体积光束、远景氛围鱼群精灵、深海微粒与水压暗角，全面交由《v1.0 规范》的 `renderPhysicalSeabed` 与 `worldRenderer.renderActiveChunkEntities` 渲染海底地形与生态地标 | `src/game/parallaxBackground.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 E、阶段 F 与阶段 G（2D `ChunkLifecycleManager`、对象池 `WorldObjectPool`、资源注册/占位符回退 `WorldAssetRegistry` + `WorldRenderer`、增量存档 `WorldPersistence`、性能降级 `PerformanceDegradationController` 及 #13~#18 全套验收测试）**：① 实现 6 态生命周期状态机（`unloaded` / `queued` / `generating` / `ready` / `active` / `releasing`）与严格状态迁移校验 `transitionChunkState`；② 实现方向性预加载窗口 `getDesiredChunkWindow`（前进方向预加载 4、后方保留 2、垂直缓冲 ±1 行，拒绝整列加载）、异步过期任务防激活保护（`startAsyncChunkTask` / `completeAsyncChunkTask`）及卸载零强引用残留的对象池 `WorldObjectPool`（单类上限 `300`）；③ 实现 `WorldAssetRegistry`（缺省 `assetKey` 自动回退矢量占位符不崩溃）与 `WorldRenderer`（`1.0x` 世界层激活态 POI 与海床生态渲染）并接入 `src/App.tsx`；④ 实现只存增量状态的 `WorldPersistence`（`save`/`load` 含 `worldSeed`、`generatorVersion`、`modifiedPOIs`、`modifiedObjects` 与版本兼容迁移）与 5 级性能降级控制器 `PerformanceDegradationController`；⑤ 完成规范第 15 节全部 18 项自动化测试（`#1 ~ #18`）与 `WorldDebug Stage-G (A-G)` 遥测面板 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 D（生态对象配置 `ECOLOGY_OBJECT_CONFIGS`、`POIGenerator` 跨界唯一归属与 `ChunkGenerator` 11 步确定性生成管线）**：① 定义覆盖珊瑚、岩石、海草、鱼群、水母、发光生物、沉船碎片、气泡、浮游颗粒、海雪、洞穴、宝藏、地标、沉船、稀有生物巢穴共 15 类 `ECOLOGY_OBJECT_CONFIGS` 与 5 类 `POI_CONFIGS`；② 实现 `generatePOIs(chunkX, chunkY)` 与 `getOverlappingPOIsForChunk(chunkX, chunkY)`，保证每个 Chunk 至多 1 个 POI、中心点唯一归属 `ownerChunkId`、POI 间距 `>= 1900 worldPx` 且跨 Chunk 占地不重复生成；③ 实现 `generateEcology` 与 11 步纯数据生成管线 `generateChunk`，支持簇群中心分布、深度/Biome/海床距离过滤、跨邻 Chunk 对称优先级间距消解与稳定 ID；④ 扩展 `WorldDebug` 绘制生态对象点位/ID 与 POI 占地半径/owner；⑤ 新增规范第 17 节 #10、#11、#12 自动化单元测试 | `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 C（`BiomeGenerator` 宏观生态区确定性选择与平滑过渡、5 大深度带与统一 `getDepthVisualProfile`）**：① 新增 5 类首版宏观生态区（`coral_reef`、`rocky_shelf`、`open_ocean`、`underwater_canyon`、`deep_abyss`）、宏区确定性索引函数 `getMacroBiomeForIndex` 与跨边界平滑混合函数 `getBiomeAt(x, y)`（`macroWidth: 30000`、`transitionWidth: 6000`，$C^2$ 五次曲线权重和恒为 `1.0`）；② 实现 5 大深度带 `getDepthBandAt`（`Epipelagic` ~ `Hadal-like`）与统一深度视觉函数 `getDepthVisualProfile(depth)` 并接入 `parallaxBackground.ts`；③ 扩展 `WorldDebug` 支持宏区边界/过渡带、深度带分界线与实时 Biome/视觉 Profile 遥测；④ 新增规范第 17 节 #8、#9 自动化单元测试 | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 B（`WorldSeedService` 子系统随机流隔离与稳定 ID、连续海床 `TerrainGenerator` 及渲染/碰撞/采样三同源）**：① 新增 `WorldSeedService`、`createChunkRng(seed, version, cx, cy, subsystemKey)` 与 `createStableId(seed, version, category, chunkX, chunkY, localIndexOrKey)`，并移除 `parallaxBackground.ts` 中残余的 `Math.random()`；② 实现全局连续海床函数 `getFloorDepthAt(worldX)`、`getTerrainSlopeAt(worldX)`（最大坡度限制 `<= 0.65`）与 `getTerrainSamples(chunkX)`（相邻 Chunk 边界点严格相等，深度严格限制在 `[800, 19800]`）；③ 实现 `1.0x` 世界层实体海床渲染 `renderPhysicalSeabed`、海床物理碰撞解算 `resolveSeabedCollision` 与贴地采样 `sampleSeabedAnchorAt` 并接入 `src/App.tsx`；④ 新增规范第 17 节 #3 ~ #7 自动化单元测试 | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 A（坐标/Chunk 基础、集中配置 `WorldConfig` 与 `WorldDebug` 网格调试叠层）**：① 在 `src/game/worldGenerationSystem.ts` 中新增集中配置常量 `WorldConfig`（`maxDepth: 20000`、Chunk `3000×1500`、`preloadAhead: 4`、`retainBehind: 2`、`maxActiveChunks: 10`）与启动校验函数 `validateWorldConfig()`；② 实现二维 Chunk 坐标换算 `worldToChunkCoord`（负坐标强制 `Math.floor`）、左闭右开包围盒 `getChunkBounds`（`[startX, endX) × [startY, endY)`）、`isPointInChunkBounds`、`formatChunkId` / `parseChunkId`、`getVisibleChunkRange` 及引擎适配层无损换算（`1m = 10 worldPx`）；③ 实现 `WorldDebug.drawChunkBounds` 调试叠层并在 `src/App.tsx` 调试面板中接入开关；④ 新增规范第 17 节 #1、#2 自动化单元测试 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-10 | **新增八模块程序化海底世界生成系统 (`src/game/worldGenerationSystem.ts`) 并接入视差引擎与生态刷新器（Web + iOS 同步）**：完整实现 `WorldGenerator`（全局种子、多层连续噪声与六大环境数值场 `depth/height/slope/temperature/light/biome`）、`BiomeManager`（L0 宏观地理结构与 7 阶段探索节奏平滑过渡）、`TerrainGenerator`（L1 全局坐标采样连续海底轮廓，相邻 Chunk 边界零误差）、`StructureGenerator`（L2 Voronoi + 跨边界洞穴 SDF 与礁石拱门模板）、`EcologyGenerator`（L3 群落中心 + Poisson Disk Sampling 聚集采样与环境过滤）、`ChunkManager`（屏外预生成与缓存回收）、`DecorationRenderer`（3 级 LOD 地貌与生态装饰绘制）与 `WorldStateManager`（探索状态追踪），并接入 `parallaxBackground.ts`、`ecosystemSpawner.ts` 与 `scripts/build-ios-native.ts` | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/game/ecosystemSpawner.ts`, `scripts/build-ios-native.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
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
