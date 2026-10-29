# 02. 渲染规范、UI/UX 与移动端多指交互设计规范 (Design & Interaction Spec)

> **文档状态**：生效中（Active）
> **最后更新**：2026-10-26
> **关联约束**：凡修改鲨鱼/猎物渲染逻辑、HUD 布局、按钮事件绑定或移动端摇杆交互时，必须遵守并在变更后同步更新本文档（参见 [`docs/00-AI_CONSTRAINTS.md`](./00-AI_CONSTRAINTS.md)）。

---

## 1. 鲨鱼本体形态渲染规范（Pure 48-Form Morphology）

### 1.1 精灵图资源与自动去底 (`src/game/spriteSheetManager.ts`)
- **核心图集**：`/public/assets/aistudio/sharks_ec921c3b.png`，共 **8 列 × 6 行 = 48 个独立单元格**，对应 `#01 小丑幼鲨` 至 `#48 欧米茄创世神鲨`。
- **离屏智能抠图**：`spriteSheetManager.ts` 在加载图集后，会自动检测并剔除四周棋盘格背景色像素（保留鲨鱼本体抗锯齿边缘），并为每个单元格计算紧致包围盒（Tight Bounding Box），缓存为独立的离屏 Canvas。
- **回退保护**：若图片尚未加载完成，`drawSharkEntity` 会使用对应血统配色的程序化矢量鲨鱼轮廓兜底，确保首帧绝不白屏。

### 1.2 多段正弦脊柱摆动与零外挂部件原则 (`src/game/canvasRenderer.ts`)
- **五段式切片游动（5-Slice Sinusoidal Spine Wave）**：
  - 将当前鲨鱼形态的离屏贴图沿水平方向切分为 5 段（吻部 ➔ 头部 ➔ 躯干 ➔ 尾柄 ➔ 尾鳍）。
  - 依据 `shark.swimPhase` 与当前游动速度，从头到尾施加振幅递增的垂直正弦偏移，实现自然流畅的鱼类摆尾游动感與张嘴撕咬形变（`shark.biteAnim`）。
- **严禁外挂部件（Zero Organ Attachments）**：
  - 鲨鱼外观**完全由当前出战的 `sharkFormId` 本体精灵图 + 血统光环/护盾特效决定**。
  - **严禁**在鲨鱼背部、腹部或尾部绘制任何旧版外接机械炮、外置螺旋桨或拼接器官图形。

---

## 2. 猎物渲染与“屏幕视觉体型 === 吞噬判定”铁律

### 2.1 视觉可读性第一性原理
玩家在高速游动中**不需要看鱼头上的文字或数字**，仅凭**肉眼观察屏幕上鱼的大小对比**，就能 100% 准确判断哪条鱼能直接一口吞掉、哪条鱼会造成伤害：

| 猎物对当前鲨鱼的状态 | 屏幕实际渲染尺寸（相对于玩家鲨鱼线性尺寸 `96 * shark.stats.scale`） | 视觉表现（零外圈、零 `T{N}` 文字干扰） |
| :--- | :--- | :--- |
| **常态下可直接吞噬** (`canDevourNormally === true`) | **严格小于玩家鲨鱼（`16% ~ 64%` 鲨鱼尺寸）**<br>且随着玩家常态咬合阶位 `normalBiteTier` 和局内等级 `Lv` 提升而进一步缩小 | 纯净自然鱼体渲染（无任何外围圆圈或头顶 `T{N}` 数字）；黄金变异种通体呈璀璨金光色泽 |
| **常态下不可直接吞噬 / 会造成伤害** (`canDevourNormally === false` & `!frenzyActive`) | **严格大于或等于玩家鲨鱼（`118% ~ 195%` 鲨鱼尺寸）**<br>跨阶差距越大、深渊巨兽或 Boss 体型越庞大 | 纯凭显著大于玩家鲨鱼的压迫感体型直观传达威胁（深渊巨化种通体呈暗紫魔化色泽），无需人工红圈或 `T{N}` 标签 |
| **黄金狂暴特例（`frenzyActive === true`）** | **保持进入黄金阶段前的原始体型大小不变（绝不因临时满阶而缩小其他鱼类）** | 原本比玩家庞大的巨兽/潜艇/Boss 依然保持 `118% ~ 195%` 巨型尺寸并覆上一层黄金色泽，玩家可直接正面生吞巨兽，获得极致猎杀爽快感！ |

### 2.2 渲染与物理碰撞统一数据源
- `drawPreyEntity()` 中的绘制缩放比例 `visualScale` 与 `App.tsx` 中 `resolvePreyEncounter()` 的碰撞半径缩放比例**必须调用同一个纯函数 `getPreyRelativeVisualScale(prey, shark.stats, prey.mutationVariant, frenzyActive)`**（内部固定使用 `normalBiteTier` 计算视觉尺寸）。
- 严禁在 `canvasRenderer.ts` 中私自放大或缩小猎物尺寸而不经过 `getPreyRelativeVisualScale`。

---

## 3. 无框图标化边缘 HUD 与 6×4 定制 UI 图集规范（90%+ 开放式海景视野）

### 3.1 24 枚定制游戏 UI 图集 (`public/assets/aistudio/icons_f5128c12.png`)
- **图集规格**：`6 列 × 4 行 = 24 枚高饱和深海机甲风定制图标`，由 `spriteSheetManager.ts` 的 `processAndSliceUiIconsImage()` 在客户端自动完成 **BFS 连通域智能去底 + 环形中心镂空抠图（`UI_AVATAR_FRAME` 与 `UI_JOYSTICK_BASE`）+ 1px 抗锯齿羽化 + 紧致包围盒居中归一化（128×128 离屏 Canvas 与 DataURL 双缓存）**。
- **24 枚图标完整矩阵 (`UiIconKey`)**：
  - **第 1 行（右下角 6 大战术与进化圆章）**：`UI_BTN_BOOST`（涡轮闪电冲刺）、`UI_BTN_BODY_UPGRADE`（金鳍升级箭头）、`UI_BTN_MORPH_EVOLVE`（发光双螺旋破茧进化）、`UI_BTN_GOLD_FRENZY`（黄金鲨首旋涡狂暴）、`UI_BTN_GENE_SURGE`（绿晶簇基因突破）、`UI_BTN_SUPPLY_DROP`（黄金降落伞空投宝箱）。
  - **第 2 行（左上角头像框与摇杆/货币组件）**：`UI_AVATAR_FRAME`（中空圆环科技外框）、`UI_BADGE_TIER`（鲨鱼颚骨阶位盾牌）、`UI_JOYSTICK_BASE`（中空声呐罗盘摇杆底座）、`UI_JOYSTICK_KNOB`（海蓝玻璃球摇杆握把）、`UI_ICON_COIN`（鲨鱼齿金币）、`UI_ICON_GENE`（翡翠双螺旋基因）。
  - **第 3 行（局内遥测与头顶状态图标）**：`UI_ICON_BOUNTY_TARGET`（深海声呐准星）、`UI_ICON_DEPTH`（下潜深度计）、`UI_ICON_COMBO_FIRE`（紫金狂暴火焰）、`UI_ICON_SCORE_TROPHY`（海神三叉戟皇冠）、`UI_ICON_DANGER_SKULL`（猩红剧毒骷髅）、`UI_ICON_VIDEO_AD`（黄金场记板播放符）。
  - **第 4 行（系统控制与四大血统徽章）**：`UI_ICON_PAUSE`（双竖线暂停圆章）、`UI_ICON_SOUND`（声波扩音器）、`UI_LINEAGE_BIO`（狂暴巨齿血统）、`UI_LINEAGE_MECHA`（深海机甲血统）、`UI_LINEAGE_ELEM`（自然元素血统）、`UI_LINEAGE_ABYSS`（深渊古神血统）。
- **零 Emoji 原则**：全项目 HUD、图谱弹窗（`SharkEvolutionAtlasModal.tsx`）以及 Canvas 水中掉落物/头顶警报/屏幕边缘雷达指示器统一使用 `<UiAtlasIcon />` 或 `spriteSheetManager.getUiIconCanvas()` 渲染，彻底淘汰廉价 Emoji。

### 3.2 极简无框 HUD 四角布局（视野留白率 >= 90%）
遵循移动端动作游戏（MOBA / 饥饿鲨进化）“去黑盒化、图标化、状态合并”三大视觉瘦身准则：
1. **顶部左角（一体式圆形鲨鱼头像框 + 双斜切能量条）**：
   - **圆形头像主按钮**：叠加 `UI_AVATAR_FRAME` 科技环、外圈 SVG 紫色经验进度环（`XP Ring`）与当前鲨鱼实时精灵缩略图；左下角镶嵌 `UI_BADGE_TIER` 阶位盾牌（`T1~T8`），右下角镶嵌局内等级胶囊（`Lv.X`），顶部微浮标融合功能名显示 `图谱 X/48`（`Atlas X/48`）。**直接点击头像即可打开 48 阶进化图谱**。
   - **紧凑双斜切条**：头像右侧仅保留 `-skew-x-12` 斜切设计的 **HP 生命条**（含受击延迟消退黄条 `ghostHp` 与血量数值）和 **BOOST 冲刺能量条**，彻底移除占屏的深色背景板。
2. **顶部居中（单行悬浮遥测胶囊 + 3 步非阻断式新手引导条）**：
   - 将得分（`UI_ICON_SCORE_TROPHY`）、基因（`UI_ICON_GENE`）、金币（`UI_ICON_COIN`）、深度（`UI_ICON_DEPTH`）与当前悬赏目标鱼（`UI_ICON_BOUNTY_TARGET` + `×2`）整合为**单行半透明流线胶囊**；连击火焰（`UI_ICON_COMBO_FIRE`）与黄金狂暴倒计时（`UI_BTN_GOLD_FRENZY`）仅在触发时动态浮现。
   - 新玩家首次进入（或暂停菜单点击“🎓 重温新手引导”）时，遥测胶囊下方动态浮现**非阻断式 3 步实操引导胶囊**（随时可一键跳过）。
3. **顶部右角（单枚暂停圆章）**：
   - 局内右上角仅保留单枚 `40×40px` 的 `UI_ICON_PAUSE` 圆形按钮；语言切换、声音开关（`UI_ICON_SOUND`）与重温新手引导收纳至暂停弹窗中。
4. **底部左角（定制声呐罗盘摇杆 `.landscape-thumb-joy`）**：
   - 采用 `UI_JOYSTICK_BASE` 半透明发光罗盘底座 + `UI_JOYSTICK_KNOB` 能量球握把，静止时保持低不透明度（`opacity-65`）完全不挡海底视野。
5. **底部右角（MOBA 扇形圆章技能弧 · 融合 2 字动作名胶囊）**：
   - 废除旧版双排宽幅文字按钮墙，改为**纯圆形游戏技能勋章弧**，并将 **2 字中文/英文功能名直接融合进原本的底部价格/百分比胶囊内**（零额外占位、一眼看懂按钮作用）：
     - 上排辅助进化弧：`UI_BTN_MORPH_EVOLVE`（`进化 / EVO`，仅在满足下一阶解锁门禁时高亮弹出）、`UI_BTN_BODY_UPGRADE`（顶部 `Lv.X` 徽标 + 底部 `强化 🪙60 / UPG 🪙60` 胶囊）。
     - 下排核心战斗弧：`UI_BTN_SUPPLY_DROP`（底部 `补给 / Drop`）、`UI_BTN_GOLD_FRENZY`（外围 SVG 圆形充能进度环 + 底部 `狂暴 🪙80 / Frenzy 🪙80`）、`UI_BTN_GENE_SURGE`（底部 `突破 🧬12 / Surge 🧬12`）与右下角超大主按钮 `UI_BTN_BOOST`（底部 `冲刺 100% / Boost 100%`）。

---

## 4. 移动端多点触控工程规范（Mobile Multi-Touch Architecture）

在手机浏览器（iOS Safari / Android Chrome / 微信内置 WebView）横屏游玩时，玩家的核心操作姿势是：**左手大拇指一直按住左下角虚拟摇杆（或屏幕左侧画布）控制游动方向，右手大拇指同时点击右侧的升级圆章、技能圆章或按住冲刺按钮**。

为保证双手同时操作 100% 灵敏响应，代码中强制执行以下三项规范：

### 4.1 虚拟摇杆 DOM 直驱（零 React 重渲染）
- 左手按住虚拟摇杆并高频滑动（`handleJoystickPointerDown` / `handleJoystickPointerMove`）时：
  - **只允许**修改 `simRef.current.input.joyDx` / `joyDy` 并通过 `joystickKnobRef.current.style.transform = translate3d(...)` 直接更新 `UI_JOYSTICK_KNOB` 摇杆帽的 DOM 位移。
  - **严禁**在摇杆移动过程中调用任何 React `useState` 更新函数（如 `setJoystickVisual`），防止每秒 60~120 次的组件重渲染导致右侧按钮在触控瞬间丢失事件。

### 4.2 多点触控按钮绑定器 (`bindMultiTouchButton`)
- **问题背景**：移动端浏览器在第一根手指按住 `touch-none` 元素（虚拟摇杆或 Canvas）不放时，第二根手指点击屏幕上的 `<button>` **不会触发合成的 `onClick` 事件**。
- **强制规范**：所有局内交互按钮（包括左上角头像图谱入口、右上角暂停圆章、右下角所有升级/进化/技能圆章）**严禁仅绑定 `onClick`**，必须统一使用 `bindMultiTouchButton(action, isDisabled)` 辅助函数：
  ```tsx
  <button
    type="button"
    {...bindMultiTouchButton(() => handleUpgradeSharkForm(hudState.activeSharkId))}
  >
  ```
- **工作原理**：同时绑定 `onPointerDown`、`onTouchStart` 和 `onClick`，在手指接触按钮的第一帧（`pointerdown` / `touchstart`）立即执行回调，并通过 `lastTouchActionTimeRef`（320ms 窗口）自动屏蔽随后可能冒泡的重复 `click` 事件。

### 4.3 多指 Pointer ID 严格隔离
- `simRef.current.input` 中分别记录：
  - `joyPointerId: number | null`（虚拟摇杆手指 ID）
  - `canvasPointerId: number | null`（画布拖拽转向手指 ID）
  - `boostPointerId: number | null`（冲刺按钮按住手指 ID）
- 在 `pointermove` / `pointerup` / `pointercancel` 中，必须核对 `e.pointerId` 是否与该通道记录的 `pointerId` 一致，确保松开右手升级/冲刺按钮时绝不会打断左手摇杆，松开左手摇杆时也绝不会打断右手冲刺。

### 4.4 iOS Safari 动态视口与 Canvas 1:1 像素长宽比锁定规范（防止 iPhone 竖屏上下拉伸）
- **问题根源**：在 iPhone 14 Pro Max 等 iOS Safari 浏览器中，CSS `100vh`（`h-screen`）包含顶部地址栏与底部工具栏折叠后的最大高度（如 `932px`），而 `window.innerHeight` 仅返回当前可见区域高度（如 `778px`）。若容器使用 `h-screen` 而 Canvas 像素缓冲区使用 `window.innerHeight`，会导致 `778px` 高的画布位图被 CSS 强制拉长到 `932px`，画面整体纵向变形约 20%。
- **强制规范**：
  1. **动态视口定界**：`index.html` 必须启用 `viewport-fit=cover`；`src/index.css` 中 `html, body, #root` 与 `src/App.tsx` 顶层 `<main>` 必须使用 `position: fixed; inset: 0; width: 100%; height: 100%; height: 100dvh;`，严禁在顶层容器上使用 `100vh`（`h-screen`）。
  2. **帧级 `getBoundingClientRect()` 同步**：`App.tsx` 中的 `syncCanvasBufferToDisplayBox()` 必须直接读取 `canvas.getBoundingClientRect()` 的实际 CSS 宽高（`cssW`, `cssH`）设置 `canvas.width` 与 `canvas.height`，并在渲染时使用精确的 `scaleX = canvas.width / cssW` 与 `scaleY = canvas.height / cssH`，同时监听 `window.visualViewport` 的 `resize` 与 `orientationchange`。
  3. **竖屏海景等比保真 (`parallaxBackground.ts`)**：`drawTiledLayer` 严禁将宽幅横版海底条带（`1376×256`）直接非等比拉伸铺满超长竖屏高度；在竖屏（`viewH > viewW`）下必须限制海底景观条带高度 `stripH <= Math.max(480, Math.round(viewW * 1.15))` 并严格按原图宽高比计算 `tileW = Math.round(stripH * aspect)`，上方水体区域使用同层顶部水体切片无缝延展。

### 4.5 48 阶进化图谱 3D 轮状画廊与全设备零滚动条规范 (`SharkEvolutionAtlasModal.tsx`)
- **全局零灰色滚动条 & 零文字截断红线**：
  - 全项目 CSS 强制隐藏所有原生浏览器灰色滚动条（`*::-webkit-scrollbar { display: none !important; } scrollbar-width: none !important;`）。
  - 图谱内所有鲨鱼名称、称号与专属进化特性**必须 100% 完整展示**，严禁使用小格子导致“一个字加省略号（`…`）”的残缺排版。
- **左右 3D 轮状画廊（3D Cylindrical Coverflow Wheel）**：
  - 废除拥挤的 48 小格滚动列表，采用 **5 卡位 3D 环形轮盘（`[-2, -1, 0, +1, +2]`）**：
    - **中央聚光灯主卡（`offset === 0`）**：`100%` 放大居中，带血统氛围背光、大尺寸实时摆尾游动预览（`176×98`）、完整无截断名称与称号、血统徽章、咬合阶位与当前出战/强化状态。
    - **两侧透视副卡（`offset = ±1, ±2`）**：按距离自动做透视缩放（`scale(0.75)` / `scale(0.50)`）、水平弧形位移与微倾角，构成立体旋转展台。
  - **全平台交互支持（触屏 + 非触屏四合一）**：
    1. **触屏/鼠标拖拽滑动（Touch & Pointer Swipe）**：在轮盘舞台上左右滑动手指，5 张卡片随手指实时 1:1 跟手旋转，松手按位移与惯性自动吸附至上一只/下一只鲨鱼（支持快速甩动连跳）。
    2. **左右霓虹方向键按钮（`◀` / `▶` Cyber Arrows）**：舞台左右两侧常驻高对比度 `◀` / `▶` 实体按钮，非触屏鼠标一键切换。
    3. **直接点击两侧副卡 / 底部本代 8 槽位直选条**：点击左/右侧缩小的鲨鱼卡片，或点击舞台下方等宽 8 格本代槽位（`grid-cols-8`），立即将该鲨鱼旋转至中央。
    4. **鼠标滚轮（`onWheel`）与键盘左右方向键（`ArrowLeft` / `ArrowRight`）**：桌面端滚轮或方向键无缝旋转轮盘。
- **固定 6 等分世代切换栏（`grid-cols-6` 零滚动条）**：
  - `G1 ~ G6` 采用严格 6 等分网格（`grid-cols-6`），在任何屏幕宽度下均单行完整铺满、绝不产生横向滚动条，点击任意世代立即切入该世代并高亮可进化红点。

### 4.6 15 秒 3 步非阻断式实操新手引导规范 (`tutorialStep` in `src/App.tsx`)
- **设计原则**：“边游边学、零暂停弹窗、亲自点击点亮按钮”，全程不打断 60FPS 游动，右上角常驻 `[跳过 / Skip]` 按钮。
- **三步实操状态流转**：
  1. **Step 1 (`EAT_SMALL_FISH`)**：开局在鲨鱼正前方刷新 10 条慢速 `T1` 迎宾小鱼群，左下虚拟摇杆亮起青色呼吸光圈与 `🕹️ 拖动摇杆` 浮标，引导玩家吞食 3 条比自己小的鱼（`0/3 ➔ 3/3`）。
  2. **Step 2 (`HOLD_BOOST`)**：右下角 `冲刺` 主按钮亮起青色高亮光圈与 `👆 按住冲刺` 浮标，引导玩家按住冲刺键（或空格键）累计 `0.7s` 体验涡轮加速与破甲。
  3. **Step 3 (`HANDS_ON_UPGRADE`)**：完成冲刺瞬间立即发放 **`🎁 新手补给礼包 (+80🪙 +20🧬)`** 并同帧刷新 HUD，使右下角 `强化`（60🪙）与 `突破`（12🧬）按钮 100% 亮起金色/翠绿聚光灯与 `👆 点此强化` 浮标，由玩家亲自点击任一按钮完成首次强化或基因突破。
  4. **完成庆贺 (`CELEBRATE` ➔ `DONE`)**：左上角头像 `图谱 X/48` 亮起高光提示 4.2 秒后自动收起，并将 `hungry_shark_tutorial_done_v1 = '1'` 写入 `localStorage`。

---

## 5. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-10-28 | 新增 **15 秒 3 步实操新手引导（含新手补给礼包与按钮聚光灯）** 与 **HUD 圆章 2 字融合功能标签（`图谱`/`强化`/`进化`/`补给`/`狂暴`/`突破`/`冲刺`）**；移除鱼类外圈与 `T{N}` 文字，完全依托视觉体型判强弱；将 48 阶进化图谱重构为 **3D 左右轮状画廊**；修复 iPhone 14 Pro Max Safari 画面纵向拉伸 Bug | `src/App.tsx`, `src/game/ecosystemSpawner.ts`, `src/game/canvasRenderer.ts`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/index.css` |
| 2026-10-27 | 接入 `icons_f5128c12.png` 24 枚定制游戏 UI 图集，全面重构为“无框头像框 + 单行悬浮遥测胶囊 + 声呐摇杆 + MOBA 扇形技能圆章”极简 HUD（视野留白率提升至 90%+） | `src/App.tsx`, `src/components/UiAtlasIcon.tsx`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts` |
| 2026-10-26 | 建立 48 阶精灵渲染规范、视觉体型===吞噬判定铁律及移动端多点触控（`bindMultiTouchButton` + 零重渲染摇杆）设计规范 | `src/App.tsx`, `src/game/canvasRenderer.ts`, `src/game/spriteSheetManager.ts` |

