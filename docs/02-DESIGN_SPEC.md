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

| 猎物对当前鲨鱼的状态 | 屏幕实际渲染尺寸（相对于玩家鲨鱼线性尺寸 `96 * shark.stats.scale`） | 视觉辅助反馈 |
| :--- | :--- | :--- |
| **常态下可直接吞噬** (`canDevourNormally === true`) | **严格小于玩家鲨鱼（`16% ~ 64%` 鲨鱼尺寸）**<br>且随着玩家常态咬合阶位 `normalBiteTier` 和局内等级 `Lv` 提升而进一步缩小 | 无危险警告；若为当前悬赏目标鱼则显示蓝色脉冲锁敌环与 `UI_ICON_BOUNTY_TARGET` 标记 |
| **常态下不可直接吞噬 / 会造成伤害** (`canDevourNormally === false` & `!frenzyActive`) | **严格大于或等于玩家鲨鱼（`118% ~ 195%` 鲨鱼尺寸）**<br>跨阶差距越大、深渊巨兽或 Boss 体型越庞大 | 显示猩红色危险脉冲环与 `UI_ICON_DANGER_SKULL` + `T{N}` 警示 |
| **黄金狂暴特例（`frenzyActive === true`）** | **保持进入黄金阶段前的原始体型大小不变（绝不因临时满阶而缩小其他鱼类）** | 原本比玩家庞大的巨兽/潜艇/Boss 依然保持 `118% ~ 195%` 巨型尺寸，但红色危险环切换为**金色虚线盛宴光环（`★T{N}`）**，玩家可直接正面生吞巨兽，获得极致猎杀爽快感！ |

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
   - **圆形头像主按钮**：叠加 `UI_AVATAR_FRAME` 科技环、外圈 SVG 紫色经验进度环（`XP Ring`）与当前鲨鱼实时精灵缩略图；左下角镶嵌 `UI_BADGE_TIER` 阶位盾牌（`T1~T8`），右下角镶嵌局内等级胶囊（`Lv.X`），顶部微浮标显示已解锁图谱进度（`X/48`）。**直接点击头像即可打开 48 阶进化图谱**，省去独立的长条图谱按钮。
   - **紧凑双斜切条**：头像右侧仅保留 `-skew-x-12` 斜切设计的 **HP 生命条**（含受击延迟消退黄条 `ghostHp` 与血量百分比）和 **BOOST 冲刺能量条**，彻底移除占屏的深色背景板。
2. **顶部居中（单行悬浮遥测胶囊）**：
   - 将得分（`UI_ICON_SCORE_TROPHY`）、基因（`UI_ICON_GENE`）、金币（`UI_ICON_COIN`）、深度（`UI_ICON_DEPTH`）与当前悬赏目标鱼（`UI_ICON_BOUNTY_TARGET` + `×2`）整合为**单行半透明流线胶囊**；连击火焰（`UI_ICON_COMBO_FIRE`）与黄金狂暴倒计时（`UI_BTN_GOLD_FRENZY`）仅在触发时动态浮现。
3. **顶部右角（单枚暂停圆章）**：
   - 局内右上角仅保留单枚 `40×40px` 的 `UI_ICON_PAUSE` 圆形按钮；语言切换与声音开关（`UI_ICON_SOUND`）收纳至暂停弹窗中。
4. **底部左角（定制声呐罗盘摇杆 `.landscape-thumb-joy`）**：
   - 采用 `UI_JOYSTICK_BASE` 半透明发光罗盘底座 + `UI_JOYSTICK_KNOB` 能量球握把，静止时保持低不透明度（`opacity-75`）完全不挡海底视野。
5. **底部右角（MOBA 扇形圆章技能弧）**：
   - 废除旧版双排宽幅文字按钮墙，改为**纯圆形游戏技能勋章弧**：
     - 上排辅助进化弧：`UI_BTN_SUPPLY_DROP`（空投补给）、`UI_BTN_BODY_UPGRADE`（躯体强化，带顶部 `Lv.X/10` 徽标与底部金币价格胶囊）、`UI_BTN_MORPH_EVOLVE`（仅在满足下一阶解锁门禁时高亮弹出的破茧进化圆章）。
     - 下排核心战斗弧：`UI_BTN_GENE_SURGE`（基因突破）、`UI_BTN_GOLD_FRENZY`（黄金狂暴，外围集成 SVG 圆形充能进度环）与右下角 `76×76px` 超大主按钮 `UI_BTN_BOOST`（涡轮冲刺）。

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

---

## 5. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-10-27 | 接入 `icons_f5128c12.png` 24 枚定制游戏 UI 图集，全面重构为“无框头像框 + 单行悬浮遥测胶囊 + 声呐摇杆 + MOBA 扇形技能圆章”极简 HUD（视野留白率提升至 90%+） | `src/App.tsx`, `src/components/UiAtlasIcon.tsx`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts` |
| 2026-10-26 | 建立 48 阶精灵渲染规范、视觉体型===吞噬判定铁律及移动端多点触控（`bindMultiTouchButton` + 零重渲染摇杆）设计规范 | `src/App.tsx`, `src/game/canvasRenderer.ts`, `src/game/spriteSheetManager.ts` |
