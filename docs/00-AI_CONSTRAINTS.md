# 00. AI 辅助开发约束与文档防过期同步规范 (AI Constraints & Doc-Sync Contract)

> **文档状态**：生效中（Active）
> **最后更新**：2026-10-26
> **适用对象**：全体开发人员及其使用的 AI 编程工具（Cursor、Claude Code、Windsurf、GitHub Copilot、Cline、Google AI Studio 等）

---

## 1. 为什么要设立本约束文件？

在多人协同且全员使用 AI 辅助编程的项目中，最常见的问题是：
1. **上下文丢失导致回退（Regression）**：某位成员让 AI 修改 UI 时，AI 不了解移动端多点触控规范，把 `bindMultiTouchButton` 改回了普通 `onClick`，导致手机端左手按住摇杆时右手无法点击升级。
2. **视觉与物理判定脱节**：AI 修改了猎物渲染尺寸，却没同步修改碰撞半径，导致屏幕上看起来比鲨鱼小的鱼反而咬伤玩家。
3. **文档迅速过期失效（Documentation Drift）**：调整了升级消耗、等级 `Lv` 或咬合阶位 `T` 的公式后，只改了 `.ts` 代码没改 `.md` 文档，后续其他成员的 AI 读取旧文档后写出互相冲突的代码。

为此，本项目实行**“代码与文档原子级同步（Atomic Code-Doc Sync）”**制度。

---

## 2. AI 修改代码前的“五步预检”（Pre-Flight Checklist）

AI 在动手写任何一行代码前，必须按顺序确认：

- [ ] **Step 1：定位变更域**：本次需求属于【架构/状态】、【渲染/UI/触控】、【数值/进化/生态】还是【工程/部署】？
- [ ] **Step 2：读取对应文档**：使用文件读取工具查阅对应的 `docs/01~04.md` 章节，获取当前的设计上下文。
- [ ] **Step 3：核查核心不变量（Invariants）**：确认修改方案不会破坏下文第 3 节列出的 6 条刚性约束。
- [ ] **Step 4：纯函数优先**：凡涉及数值计算、解锁判断、体型缩放、碰撞结果，一律在 `src/game/rules.ts` 或 `src/game/sharkEvolutionConfig.ts` 中修改纯函数，不要把核心公式硬编码进 `src/App.tsx` 的 JSX 或 Canvas 循环里。
- [ ] **Step 5：明确需同步的文档清单**：在开始改代码前，先列出本次任务结束前需要同步更新的 `.md` 文件路径及章节。

---

## 3. 六大刚性工程与设计红线（Hard Guardrails）

### 红线 1：严禁恢复“外挂器官部件”，坚持 48 阶鲨鱼本体进化
- 本项目已彻底移除旧版“在鲨鱼身上拼接机械炮/发光鱼饵/推进器部件”的视觉表现。
- 玩家养成与外观变化完全通过 **48 阶鲨鱼本体进化（6 代 × 8 列，精灵图 `/public/assets/aistudio/sharks_ec921c3b.png`）** 实现。
- `drawSharkEntity` 中严禁绘制任何外挂器官几何图形。

### 红线 2：屏幕视觉体型与吞噬判定的绝对一致性（Visual Size === Edible Rule）
- **核心定律**：
  1. 凡是当前鲨鱼可以直接吞噬的猎物（`canDevourDirectly === true`），其在屏幕上的渲染尺寸与碰撞体积**必须严格小于玩家鲨鱼（线性尺寸 `<= 64%` 鲨鱼尺寸，即 `<= 0.64 * 96 * shark.stats.scale`）**。
  2. 凡是当前鲨鱼无法直接吞噬、触碰会扣血或需要冲刺撕咬的猎物/水雷（`canDevourDirectly === false`），其在屏幕上的渲染尺寸与碰撞体积**必须大于或等于玩家鲨鱼（线性尺寸 `>= 118%` 鲨鱼尺寸，即 `>= 1.18 * 96 * shark.stats.scale`）**。
- **实现约束**：`src/game/canvasRenderer.ts` 的 `drawPreyEntity()` 与 `src/App.tsx` 的碰撞检测**必须统一调用 `src/game/rules.ts` 中的 `getPreyRelativeVisualScale()`**，严禁在渲染层或碰撞层单独乘以额外的缩放系数。

### 红线 3：移动端多点触控与零重渲染摇杆（Mobile Multi-Touch Isolation）
- **摇杆零 React 重渲染**：左手按住虚拟摇杆（`.landscape-thumb-joy`）拖动时，`handleJoystickPointerMove` **只能更新 `simRef.current.input` 并通过 `joystickKnobRef.current.style.transform` 直接操作 DOM**，严禁在 `pointermove` 中调用 `useState` 的 `setter`（否则 60Hz~120Hz 重渲染会吞掉右手对升级按钮的点击）。
- **按钮多指即时触发**：移动端浏览器在手指 1 按住 `touch-none` 区域（摇杆或画布）时，手指 2 点击按钮不会触发合成 `onClick` 事件。因此所有局内按钮**必须使用 `bindMultiTouchButton(action, isDisabled)`**（同时监听 `onPointerDown`、`onTouchStart`、`onClick` 并带 320ms 时间戳去重）。
- **多指 Pointer ID 隔离**：`simRef.current.input` 必须独立维护 `joyPointerId`、`canvasPointerId` 和 `boostPointerId`，任何一根手指抬起（`pointerup` / `pointercancel`）时只能释放自己对应的控制通道。

### 红线 4：鱼类真实海洋深度分布（Strict Habitat Depth Zones）
- 32 种海洋生物严格划分为三大深度带：**阳光珊瑚浅海（`0m ~ 520m`）**、**暮光温跃层（`520m ~ 1150m`）**、**午夜深渊海沟（`1150m+`）**。
- 刷新逻辑（`src/game/ecosystemSpawner.ts` 与 `src/App.tsx` 中的 `createPreyEntity`）必须保证猎物生成 Y 坐标被钳制在 `[chosenTier.minDepth, chosenTier.maxDepth]` 范围内，严禁浅水小丑鱼/蝴蝶鱼出现在深渊，或深海安康鱼/大王乌贼刷到浅滩。

### 红线 5：60FPS 零 GC 游戏主循环（Zero-GC Simulation Loop）
- `requestAnimationFrame` 主循环内的粒子（`particles`）、掉落物（`pickups`）、飘字（`floatTexts`）必须复用固定长度环形对象池（Object Pool），严禁每帧 `new` 对象或调用 `.filter()` 创建新数组。
- React HUD 状态（`hudState`）采用 **120ms 节流同步 + 关键操作（升级躯体、破茧进化、狂暴、基因突破）同帧立即同步** 的混合策略。

### 红线 6：Vercel 与生产构建兼容性
- `package.json` 中的 `esbuild` 版本需与 `vite@^8.3.0` 的 peerDependency（`^0.27.0 || ^0.28.0`）保持兼容（当前锁定 `^0.28.0`），并保留根目录 `.npmrc`（`legacy-peer-deps=true`），确保 Vercel 云端构建 `npm install` 零报错。

---

## 4. 文档强制同步规则（Documentation Update Protocol）

每当 AI 完成代码修改后，**在向开发者汇报完成之前**，必须执行以下文档更新检查：

1. **检查数值与公式变更**：
   - 如果修改了 `getXpRequiredForLevel`、`computeEvolvedSharkStats`、`getPreyRelativeVisualScale`、`resolvePreyEncounter`、`getGoldOverdriveCost`、`getGeneSurgeCost`、`getSharkUpgradeCost` 或任何解锁条件：
   - **必须打开 [`docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`](./03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md)**，将文档中的数学公式、参数表格和示例数值修改为最新代码逻辑。
2. **检查 UI、渲染与交互变更**：
   - 如果新增了按钮、修改了 HUD 布局、调整了精灵图裁切或改动了触控逻辑：
   - **必须打开 [`docs/02-DESIGN_SPEC.md`](./02-DESIGN_SPEC.md)**，同步更新交互说明与组件规范。
3. **检查模块、文件或状态结构变更**：
   - 如果新增了 `.ts`/`.tsx` 文件、修改了 `SharkMetaSaveData` 存档字段或调整了模块调用关系：
   - **必须打开 [`docs/01-ARCHITECTURE.md`](./01-ARCHITECTURE.md)**，更新目录树、数据流图及存档 Schema 表。
4. **更新文档顶部的 `最后更新` 日期与底部的 `变更记录（Changelog）`**：
   - 每次更新任何一个 `docs/*.md` 文件时，在该文档底部的《文档变更记录》表格中追加一行，记录修改日期、修改内容摘要及涉及的源码文件。

---

## 5. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-10-26 | 初始化 AI 协同约束规范与代码-文档强制同步机制 | `AGENTS.md`, `CLAUDE.md`, `docs/00-AI_CONSTRAINTS.md` |
