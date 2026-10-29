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
- **严禁外挂部件与外围圆圈（Zero Organ Attachments & Zero Outer Circles）**：
  - 鲨鱼外观**完全由当前出战的 `sharkFormId` 纯净本体精灵图、受击透明度闪烁及黄金狂暴本体滤镜决定**。
  - **严禁**在鲨鱼外围绘制任何虚线环、光圈圆环或外接机械炮/螺旋桨等拼接图形。


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
4. **底部左角（定制声呐罗盘摇杆 `.landscape-thumb-joy.hud-joystick-ergonomic`）**：
   - 采用 `UI_JOYSTICK_BASE` 半透明发光罗盘底座 + `UI_JOYSTICK_KNOB` 能量球握把，静止时保持低不透明度（`opacity-65`）完全不挡海底视野。
   - **人体工学自适应内缩（零写死坐标）**：通过 `.hud-joystick-ergonomic` 结合 `env(safe-area-inset-*)` 与 `clamp()` 动态向右上内移（竖屏左内缩 `clamp(1.15rem, 5.2vw, 2.5rem)`、下内缩 `clamp(1.15rem, 3.8vh, 2.25rem)`；横屏左内缩 `clamp(1.75rem, 4.5vw, 3.25rem)`、下内缩 `clamp(0.9rem, 4.5vh, 1.65rem)`），彻底告别贴边误触。
5. **底部右角（90° 扇形环绕 MOBA 圆章技能弧 `.hud-skill-fan-container`）**：
   - **彻底移除局内空投补给按钮**，以右下角超大主按钮 `UI_BTN_BOOST`（`冲刺 100% / Boost 100%`）为圆心锚点，其余技能与进化圆章按极坐标三角函数（`cos(θ)`, `sin(θ)`）与自适应半径 `--fan-radius` 沿左上方 **90° 四分之一圆弧（`0° ~ 90°`）** 均匀环绕排布：
     - **0° 左侧槽位**：`UI_BTN_GOLD_FRENZY`（外围 SVG 圆形充能进度环 + 底部 `狂暴 🪙80 / Frenzy 🪙80`）。
     - **45° 斜上槽位**：`UI_BTN_GENE_SURGE`（底部 `突破 🧬12 / Surge 🧬12`）。
     - **90° 正上槽位**：`UI_BTN_BODY_UPGRADE`（顶部 `Lv.X` 徽标 + 底部 `强化 🪙60 / UPG 🪙60` 胶囊）及满足破茧条件时动态浮现的 `UI_BTN_MORPH_EVOLVE`（`进化 / EVO`，自动切换为 `data-fan-count="4"` 扩大扇形半径确保零重叠）。

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

### 4.5 极简去框化进化界面「巨幕水族馆 + 无框连续半环罗盘」与全设备零滚动条规范 (`SharkEvolutionAtlasModal.tsx`)
- **去线框套线框（De-Boxed / Zero Box-in-Box）原生游戏视觉原则**：
  - 全面摒弃 AI 后台管理面板式的“外层发光框 + 内层卡片框 + 胶囊小框”多重嵌套线框（`border + rounded-xl + bg-slate-900`）。
  - **首页 (`Title`)、局内 HUD (`Playing`)、暂停/结算弹窗与进化页 (`Evolution`)** 统一采用**无框通透深海视觉（Frameless Deep-Sea UI）**：
    - 顶部资源栏（`3/48 · 👑 0/144`、金币、基因）直接以高对比度图标 + 等宽粗体数字裸露排布，去除所有独立描边小方框。
    - 底部 `180°` 半环罗盘上的 7 只相邻鲨鱼直接悬浮游动于弧形光轨之上，去除包裹每只小鲨鱼的方形线框，仅在弧顶中心鲨鱼背部投射柔和径向聚光灯。
    - 右侧属性区（`咬合 / 生命 / 速度 / 倍率`）与 `王冠奖励`（铜冠/银冠/金冠）合并为无外框的通透横条，仅用极弱半透明分割线（`divide-white/[0.07]`）区分层级；前置解锁条件采用无框行内紧凑排布。
- **极简标题与无序号纯净命名**：
  - 弹窗主标题简化为 **`进化` / `Evolution`**，右侧属性区标题精简为 **`特性`、`咬合`、`生命`、`速度`、`倍率`、`王冠奖励`**，底部操作按钮精简为 **`强化 Lv.X` / `突破 Lv.X`、`出战`、`立即进化`**。
  - **全面移除 `G1 ~ G6` 世代 Tab 栏与所有鲨鱼名称前的 `#01 ~ #48` 序号**（含暂停弹窗与进化页），界面清爽直观、一目了然。
  - **前置条件明确显示具体鲨鱼名称**：未解锁鲨鱼的前置条件严禁使用笼统的 `前置≥Lv.X` 表达，必须明确显示所特指的前置鲨鱼完整名称与所需等级（例如 `拟态小丑幼鲨≥Lv.2` / `Mimic Clown Fry≥Lv.2`），并支持点击该条件直接跳转至对应前置鲨鱼。
- **全局零灰色滚动条 & 零文字截断红线**：
  - 全项目 CSS 强制隐藏所有原生浏览器灰色滚动条（`*::-webkit-scrollbar { display: none !important; } scrollbar-width: none !important;`）。
  - 界面内所有鲨鱼名称与进化特性**必须 100% 完整展示**，严禁使用省略号（`…`）截断鱼名。
- **移动端优先「上方 68% 巨幕水族馆 + 底部 32% 无框连续半环罗盘表盘」布局（Giant Aquarium + Frameless Continuous Curved Arc Dial）**：
  - **上方 68% 巨幕主鲨聚光灯舞台**：无遮挡居中展示当前选中鲨鱼的巨幅实时摆尾游动模型（移动端 `186×100` / 桌面端 `224×120`），上方无框展示血统与 `T{N}` 阶位，下方无框展示鲨鱼名称与出战/解锁状态。
  - **底部 32% 无框连续弧形罗盘表盘**：以当前选中鲨鱼为中心，沿底部 `180°` 发光弧形导轨无缝展示前后相邻的 7 只鲨鱼（`ARC_OFFSETS = [-3..+3]`，48 只鲨鱼首尾无缝循环）；当前选中鲨鱼在弧顶中央（`slotPos = 0`）放大至 `1.24x` 并带柔和青色聚光光晕，直接展示无框鲨鱼缩略图与 `T{N}` 咬合阶位。
  - **48 阶鲨鱼名称与舞台绝对等高锚定 & 全界面零叠放规范（Zero Vertical Shift & Zero Overlap Invariant）**：
    - 切换任意已解锁、出战中、可进化或未解锁鲨鱼时，主舞台鲨鱼名称（`data-testid="atlas-hero-shark-name"`）、鲨鱼模型与顶部血统行的纵向 `Y` 坐标必须保持 **100% 像素级一致（0px 跳动）**。
    - 聚光灯舞台内部采用固定高度槽位：血统行 `h-[18px]`、主鲨画布 `h-[90px] sm:h-[116px]`、鲨鱼名称 `h-[26px]`、状态副标题 `h-[18px]`；底部弧形表盘（`h-[64px] sm:h-[76px]`）上的 7 只相邻鲨鱼采用 `w-10 h-10 sm:w-11 sm:h-11` 与 `xPx = (slotPos / 3.05) * maxHalfSpan` 宽距分布，确保相邻鱼图之间及中心鱼图与上方副标题之间**零重叠**。
    - 下方/右侧属性面板所有区块强制锁定固定高度：特性文案固定 2 行高度（`h-[34px] sm:h-[38px]`）、四维属性条固定高度（`h-[44px] sm:h-[48px]`）、王冠奖励条固定高度（`h-[38px] sm:h-[40px]`）、第 4 区块常驻固定 `h-[50px]` 双行容器（未解锁时第 1 行独占整行宽度展示完整前置鲨鱼名称与所需等级，第 2 行展示等级/深度与金币/基因消耗，彻底杜绝长鱼名与右侧条件叠放；已解锁时在同一 `h-[50px]` 容器内第 1 行展示 `Lv.X/10` 强化进度，第 2 行展示 10 格强化进度条）、底部操作按钮固定 `h-10 sm:h-11`。
    - 局内顶部 HUD 采用“第 1 行左头像血条 + 右遥测暂停、第 2 行全宽居中连击/新手引导横幅”的双行自适应结构，右下角 3 枚技能圆章保持 `gap-3.5 sm:gap-4` 间距，确保任何分辨率与中英文状态下**全界面零 UI 叠放**。
- **全平台交互支持（触屏 + 非触屏四合一）**：
  1. **触屏/鼠标拨动弧形罗盘（Touch & Pointer Spin）**：在舞台上左右滑动手指，底部弧形表盘实时跟手旋转，松手按惯性自动吸附至最近鲨鱼。
  2. **直接点击弧形表盘上任意鲨鱼**：点击弧上任意位置的缩小鲨鱼，表盘立即旋转并将该鲨鱼切换至弧顶焦点与上方巨幕。
  3. **左右方向键按钮（`◀` / `▶` Soft Arrows）**：舞台左右两侧常驻无框半透明 `◀` / `▶` 按钮，非触屏鼠标一键切换。
  4. **鼠标滚轮（`onWheel`）与键盘左右方向键（`ArrowLeft` / `ArrowRight`）**：桌面端滚轮或方向键无缝旋转。


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
| 2026-10-29 | **移除局内空投补给按钮**；将右下角技能与强化圆章重构为围绕【冲刺】主按钮的 **90° 极坐标扇形环绕布局（`.hud-skill-fan-container`）**；优化左下角虚拟摇杆自适应内缩（`.hud-joystick-ergonomic`，基于 `clamp()` 与 `safe-area-inset` 向右上舒适区偏移，零写死坐标、全屏零遮挡零叠放） | `src/App.tsx`, `src/index.css`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-29 | 全面执行**「去线框套线框（De-Boxed Frameless UI）」视觉重构**、**48 阶鲨鱼名称纵向高度 100% 恒定对齐（0px 跳动）**与**全分辨率零 UI 叠放修复**：将未解锁前置鲨鱼名称独立为整行宽度（`h-[50px]` 双行定高槽位），拉大底部 180° 弧形罗盘节点间距与纵深留白，重构局内顶部 HUD 为双行零挤压布局，彻底消除小屏/横屏/长英文名下的任何文字或图标叠放 | `src/components/SharkEvolutionAtlasModal.tsx`, `src/App.tsx`, `src/index.css`, `src/game/sharkEvolutionConfig.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-28 | 新增 **15 秒 3 步实操新手引导（含新手补给礼包与按钮聚光灯）** 与 **HUD 圆章 2 字融合功能标签（`图谱`/`强化`/`进化`/`补给`/`狂暴`/`突破`/`冲刺`）**；移除鱼类外圈与 `T{N}` 文字，完全依托视觉体型判强弱；修复 iPhone 14 Pro Max Safari 画面纵向拉伸 Bug | `src/App.tsx`, `src/game/ecosystemSpawner.ts`, `src/game/canvasRenderer.ts`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/index.css` |
| 2026-10-27 | 接入 `icons_f5128c12.png` 24 枚定制游戏 UI 图集，全面重构为“无框头像框 + 单行悬浮遥测胶囊 + 声呐摇杆 + MOBA 扇形技能圆章”极简 HUD（视野留白率提升至 90%+） | `src/App.tsx`, `src/components/UiAtlasIcon.tsx`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts` |
| 2026-10-26 | 建立 48 阶精灵渲染规范、视觉体型===吞噬判定铁律及移动端多点触控（`bindMultiTouchButton` + 零重渲染摇杆）设计规范 | `src/App.tsx`, `src/game/canvasRenderer.ts`, `src/game/spriteSheetManager.ts` |



