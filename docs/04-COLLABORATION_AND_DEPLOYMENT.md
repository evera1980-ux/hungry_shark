# 04. 多人协同开发、自动化测试与 Vercel 部署手册 (Collaboration & Deployment)

> **文档状态**：生效中（Active）
> **最后更新**：2026-10-26
> **关联约束**：修改 `package.json`、`.npmrc`、`vite.config.ts`、测试脚本或部署流程时，必须同步更新本文档（参见 [`docs/00-AI_CONSTRAINTS.md`](./00-AI_CONSTRAINTS.md)）。

---

## 1. 本地开发环境快速启动

### 1.1 环境要求
- **Node.js**：推荐 `v20.x` 或 `v22.x` LTS
- **包管理器**：`npm`（已配置 `.npmrc` 开启 `legacy-peer-deps=true`）

### 1.2 常用命令速查

| 命令 | 用途说明 |
| :--- | :--- |
| `npm install` | 安装全部项目依赖（自动读取 `.npmrc` 避免 peerDependency 冲突） |
| `npm run dev` | 在 `http://localhost:3000` 启动本地 Vite 开发服务器 |
| `npx tsx --test src/game/rules.test.ts` | 运行核心纯函数单元测试（验证 `Lv`/`T` 公式、48 阶进化与猎物体型不变量） |
| `npm run lint` | 运行 `tsc --noEmit` 全量 TypeScript 类型检查 |
| `npm run build` | 执行生产环境打包，产物输出至 `dist/` 目录 |
| `npm run preview` | 本地预览 `dist/` 生产构建产物 |
| `npm run build:ios` | **纯原生 iOS 工程生成（零 WebView 套壳）**：从 TypeScript 唯一数据源同步生成 `ios-native/` 下的 Swift 5.9 + SpriteKit (Metal) + SwiftUI 完整 Xcode 工程与 22 张原生图片资源 |

---

## 2. 多人 + AI 协同开发分支与提交流程

### 2.1 分支命名规范
- `main`：稳定主分支，与 Vercel 生产环境自动绑定，任何合并入 `main` 的代码必须 100% 通过单测、`npm run lint` 和 `npm run build`。
- `feat/<功能名称>`：新功能或新玩法分支（例如 `feat/shark-48-evolution`、`feat/boss-events`）。
- `fix/<问题名称>`：缺陷修复分支（例如 `fix/mobile-multitouch-upgrade`、`fix/vercel-esbuild-peer`）。
- `balance/<数值调整>`：数值策划调优分支（例如 `balance/tier-scaling-curve`）。

### 2.2 AI 辅助开发必做三步（PR 准入条件）
每位团队成员使用 AI（Cursor / Claude Code / Copilot / AI Studio）完成代码修改后，提交 Commit 前必须确认：
1. **单元测试全绿**：运行 `npx tsx --test src/game/rules.test.ts` 全部通过；若修改了核心公式，已同步更新或新增了对应单测断言。
2. **类型与构建零报错**：运行 `npm run lint && npm run build` 零错误。
3. **Markdown 文档已同步**：已按照 [`AGENTS.md`](../AGENTS.md) 中的《代码 ⇄ 文档同步映射表》，同步更新了 `docs/01~04.md` 中对应的公式、表格及底部变更记录。

---

## 3. 核心单元测试说明 (`src/game/rules.test.ts`)

`src/game/rules.test.ts` 守护着游戏最关键的数值与视觉契约，任何时候都不允许删除或跳过以下测试：

1. **经验与等级曲线测试**：验证 `getXpRequiredForLevel` 单调递增。
2. **猎物相对视觉体型核心契约测试（Visual Size Invariant）**：
   - 遍历 `T1 ~ T8` 所有咬合阶位与局内等级 `Lv.1 ~ Lv.15`，断言**所有可直接吞噬的鱼（`canDevourDirectly === true`）在屏幕上的实际绘制尺寸 `preyDrawSize <= 0.64 * sharkDrawSize`（严格小于玩家鲨鱼）**。
   - 断言**所有不可直接吞噬、会造成伤害的鱼（`canDevourDirectly === false`）在屏幕上的实际绘制尺寸 `preyDrawSize >= 1.18 * sharkDrawSize`（严格大于或等于玩家鲨鱼）**。
   - 断言黄金狂暴（Frenzy）状态下，全部 `T1 ~ T8` 猎物及水雷均自动缩小至可一口吞噬尺寸（`<= 0.64 * sharkDrawSize`）。
3. **远/中/近景光学深度视差联动缩小测试（`getParallaxLayerGrowthScales`）**：
   - 验证鲨鱼长大时，`nearScale < ambientScale < midScale < farScale < waterScale` 严格成立，且各层随 `relativePreyScale` 单调递减。
4. **碰撞与冲刺破甲判定测试（`resolvePreyEncounter`）**：
   - 验证同阶/低阶直接吞噬（`DEVOUR`）、跨 1 阶按住冲刺破甲（`ARMOR_CRUSH`）、跨 1 阶不冲刺受击（`DAMAGE`）及跨 2 阶以上不可破甲受击。
5. **48 阶鲨鱼进化与三重门禁测试**：
   - 验证 48 只鲨鱼形态配置完整性、躯体 `Lv.1 -> Lv.10` 强化属性递增以及三重解锁门禁（前置强化等级 + 局内最高等级 + 历史最大深度 + 双货币）。

---

## 4. Vercel 部署参数与排障手册

本项目为纯前端 Vite + React 静态单页应用（SPA），在 Vercel 上部署时的标准参数如下：

### 4.1 Vercel 控制台标准配置参数

| 配置项 (Setting) | 填写值 (Value) | 说明 |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Vercel 会自动识别，若未识别请手动选 `Vite` |
| **Root Directory** | `./` | 保持默认仓库根目录 |
| **Build Command** | `npm run build` | 默认即可 |
| **Output Directory** | `dist` | Vite 默认打包输出目录 |
| **Install Command** | `npm install` | 仓库内置 `.npmrc` 已自动开启 `legacy-peer-deps=true` |
| **Environment Variables** | 无需配置任何必填项 | 游戏本体、Web Audio 音效与跨局存档均在浏览器端原生运行 |

### 4.2 常见构建问题与已固化的解决方案
- **问题现象**：Vercel 构建时 `npm install` 报 `ERESOLVE could not resolve`（`vite@8.3.x` 要求 `peerOptional esbuild@"^0.27.0 || ^0.28.0"`）。
- **已固化方案**：
  1. `package.json` 的 `devDependencies.esbuild` 已升级至 `"^0.28.0"`，与 `vite@^8.3.0` 原生匹配。
  2. 仓库根目录已提交 `.npmrc` 文件（内容为 `legacy-peer-deps=true`），确保任何云端构建环境执行 `npm install` 均不会因次级依赖的 peerDependency 版本冲突而中断。
  - **注意**：团队成员后续新增 npm 包时，**切勿删除 `.npmrc` 或将 `esbuild` 降级回 `0.25.x`**。

---

## 5. 纯原生 iOS 工程生成与编译手册 (`ios-native/`)

本项目提供 **100% 纯原生 iOS 工程（Swift 5.9 + SpriteKit Metal 硬件加速 2D 引擎 + SwiftUI 原生 HUD，零 `WKWebView`/Capacitor/Cordova 套壳）**。

### 5.1 单一数据源自动同步架构 (`scripts/build-ios-native.ts`)
每当修改了 `src/game/sharkEvolutionConfig.ts`、`src/game/config.ts`、`src/game/rules.ts` 或 `public/assets/aistudio/*.png` 素材后，只需在项目根目录执行：
```bash
npm run build:ios
```
该脚本会自动完成以下工作：
1. 将 48 阶鲨鱼完整属性矩阵、33 种海洋猎物配置、3 大深度生态区及精灵图归一化裁切坐标编译生成至 `ios-native/HungrySharkEvolution/Generated/GameConfigGenerated.swift`。
2. 同步生成纯原生核心模块：
   - `Core/GameRules.swift`：100% 对齐 `src/game/rules.ts` 的经验曲线、48 阶躯体成长、猎物严格体型契约 `getPreyRelativeVisualScale`、远中近景光学视差缩小 `getParallaxLayerGrowthScales`、碰撞破甲判定 `resolvePreyEncounter` 及 `UserDefaults` 跨局存档。
   - `Rendering/SpriteAtlasManager.swift`：基于 `CoreGraphics` (`CGContext`) 的离屏四边 BFS 泛洪去白底 + 边缘 `Color-to-Alpha` 半透明抗锯齿解混，将 4K 鲨鱼大图与鱼类/UI 图集切分为原生 `SKTexture` 与 `UIImage`。
   - `Rendering/OceanGameScene.swift`：基于 Apple Metal 驱动的 `SKScene`（支持 iPhone ProMotion 120Hz），包含 10 列 `SKWarpGeometryGrid` 脊椎 S 型摆动与转向流体 C 型弯曲、2.5D 侧身甩尾翻转、5 层海底视差背景随鲨鱼体型联动缩小、85% 原生深度带刷怪器及 `UIImpactFeedbackGenerator` 物理震动反馈。
   - `UI/ContentView.swift`：纯 SwiftUI 原生无边框 HUD（左上鲨鱼实时裁剪头像与双进度条、顶中深度/生态胶囊、左下零状态阻塞原生多指声呐摇杆、右下 90° 扇形技能轮盘与 48 阶进化图谱弹窗）。
3. 将 `public/assets/aistudio/` 下的全部 22 张高清 PNG 资源同步拷贝至 `ios-native/HungrySharkEvolution/Resources/Assets/`。
4. 生成可直接双击打开的 `ios-native/HungrySharkEvolution.xcodeproj/project.pbxproj`、`ios-native/project.yml`（支持 XcodeGen）与 `ios-native/Package.swift`。

### 5.2 在 macOS Xcode 中运行与真机打包步骤
1. 在 macOS 上直接打开 Xcode 工程：
   ```bash
   open ios-native/HungrySharkEvolution.xcodeproj
   ```
2. 在 Xcode 顶部 Toolbar 选择目标设备（如 **iPhone 16 Pro** 模拟器或连接的真机），配置 `Signing & Capabilities -> Team` 后按下 **`Cmd + R`** 即可编译运行纯原生 Metal 60/120fps 版本。

---

## 6. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-10-26 | 创建多人协同开发、单测说明与 Vercel 部署参数手册 | `package.json`, `.npmrc`, `src/game/rules.test.ts` |
| 2026-11-05 | 新增 `npm run build:ios` 纯原生 iOS (Swift + SpriteKit Metal + SwiftUI，零 WebView) 工程生成器与 Xcode 编译文档 | `scripts/build-ios-native.ts`, `package.json`, `ios-native/` |

