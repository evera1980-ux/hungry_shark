# 02. 渲染规范、UI/UX 与移动端多指交互设计规范 (Design & Interaction Spec)

> **文档状态**：生效中（Active）
> **最后更新**：2026-10-26
> **关联约束**：凡修改鲨鱼/猎物渲染逻辑、HUD 布局、按钮事件绑定或移动端摇杆交互时，必须遵守并在变更后同步更新本文档（参见 [`docs/00-AI_CONSTRAINTS.md`](./00-AI_CONSTRAINTS.md)）。

---

## 1. 鲨鱼本体形态渲染规范（Pure 48-Form Morphology）

### 1.1 4K 精灵图资源与四阶段智能去底管线 (`src/game/spriteSheetManager.ts`)
- **核心 4K 图集**：`/public/assets/aistudio/sharks_ec921c3b.png`（原生分辨率 **`4096 × 2286`**，长宽比 `1.7918`），共 **8 列 × 6 行 = 48 个独立单元格**，对应 `#01 拟态小丑幼鲨` 至 `#48 欧米茄创世神鲨`。
- **4K 离屏智能抠图与超采样管线（`processAndSliceSharksImage`）**：
  1. **高 DPI 超采样工作画布（`MAX_SHARK_SHEET_W = 2400`）与零 GC 缓冲区复用**：针对 `4096×2286`（`936 万像素`）超高清原图，开启 `imageSmoothingQuality = 'high'` 超采样至 `2400×1340`（单格约 `300×220px`，高于局内及进化巨幕 `2x Retina` 物理像素上限），并跨 48 个单元格复用预分配的 `Uint8Array` / `Int32Array` BFS 队列缓冲区，降低 70% 内存分配与 18 段脊柱实时切片采样带宽。
  2. **单元格四周边框 BFS 连通域泛洪去底（严禁内部白肚皮误抠）**：仅从每个单元格四条外边界向内对纯白/浅灰摄影棚背景（`minC >= 232 && maxC - minC <= 20`）执行 BFS 泛洪透明化，**严禁对鲨鱼闭合轮廓内部的白色区域执行孔洞清理**，从而 100% 保护 `#01 拟态小丑幼鲨` 的白色条纹、`#02 浅滩黄柠檬鲨`（`shark_form_01`）与 `#09 黑鳍礁鲨`（`shark_form_08`）等鲨鱼的白色反荫蔽肚皮、眼白、白牙与发光核心不被误抠为透明。
  3. **多像素边界 Color-to-Alpha 白边解混（White Fringe Unmixing）**：对紧邻透明背景的 `maxHaloSteps` 层抗锯齿边缘与半透明发光光晕像素执行基于纯白底（`255,255,255`）的颜色解混（`cleanAlpha = (250 - minC) / 205`，`C' = (C - minC) / ((255 - minC) / 255)`），彻底消除 4K 轮廓线与光晕外围的灰白毛边。
  4. **紧致包围盒裁切（Tight Bounding Box）**：自动计算非透明像素边界 `[minX, minY, maxX, maxY]` 并附加自适应安全内边距缓存为独立离屏 Canvas。
- **回退保护**：若图片尚未加载完成，`drawSharkEntity` 会使用对应血统配色的程序化矢量鲨鱼轮廓兜底，确保首帧绝不白屏。

### 1.2 连续仿射斜切脊柱丝带摆尾与零外挂部件原则 (`src/game/canvasRenderer.ts`)
- **连续仿射斜切脊柱丝带渲染（Continuous Affine-Sheared Ribbon Spine Wave，`drawUndulatingSpriteFrame`）**：
  - 将紧致裁切后的离屏精灵图沿水平体轴（从鱼吻 `u = 0` 到尾鳍 `u = 1`）按生物种类与渲染尺寸自适应切分为 **18 段**（玩家主角鲨鱼 `SHARK_APEX`）、**12 段**（大型掠食者/巨兽 `baseSize >= 92px`）、**10 段**（中大型猎物 `52px ~ 92px`）、**8 段**（常规鱼类 `28px ~ 52px`）或 **6 段**（小型鱼苗 `< 28px`）；并通过 `WeakMap` 离屏着色纹理缓存（`getPrebakedTintedFrame`，支持 `GOLD`/`ABYSS`/`FLASH`/`LOCKED`）一次性预烘焙变色精灵图，严禁在 60FPS 切片循环内动态设置 `ctx.filter`。
  - **边界端点共享 + 仿射 Y 斜切逆矩阵直驱（零阶梯切段感 & 零 `save/restore` 开销）**：第 `i` 段切片直接复用上一段右边界形变 `def0` 作为自身左边界，并计算右边界形变 `def1`，通过 Canvas 2D 仿射变换 `ctx.transform(1, shearY, 0, 1, dx, centerY0)`（其中 `shearY = (def1.dy - def0.dy) / sliceDstW`）使每一段切片沿脊柱切线方向平滑倾斜，绘制后立即乘以其精确逆矩阵 `ctx.transform(1, -shearY, 0, 1, -dx, shearY * dx - centerY0)` 复位（避免每帧数百次 `ctx.save/restore` 状态栈开销），确保相邻切片接缝处的上下轮廓 $100\%$ 严丝合缝（$C^0/C^1$ 连续），彻底消除水平矩形切片造成的“阶梯状被切段感”与接缝重影。
  - **解剖学前躯刚性包络与速度耦合**：玩家鲨鱼采用 `SHARK_APEX` 步态（$C^1$ 平滑包络函数 $E(u) = 0.015u + 0.985u^{2.25}$，波数 $k = 2.15$），确保前躯 $42\%$（吻部、鳃裂、胸背鳍躯干）保持流线型整体刚性、撕咬对准零漂移，后段 $58\%$ 尾柄至新月尾鳍传递丝滑推进波；摆尾频率 `shark.swimPhase` 与实时游速、冲刺（`isBoosting`）和黄金狂暴状态动态耦合，并在进化图谱巨幕预览台（`SharkFormCanvasPreview`）中同步启用。
  - **流体力学 C 形脊柱转弯（Hydrodynamic Spinal Turning C-Bend）与 2.5D 柔顺水平甩尾掉头（Smooth 2.5D Whip-Turn）**：
    - **脊柱 C 形转向弯曲 (`turnBend` in `computeSpineSliceDeformation`)**：转弯时不再将整只鲨鱼当作刚性木板旋转，而是将角速度 `turnRate` 实时注入 24 段脊柱变形——鱼吻前段（$u < 0.32$）顺着转向内侧微倾领航（`headTurnLead`），胸鳍支点（$u \approx 0.22$）作为旋转枢轴，后躯与尾鳍（$u \to 1$）沿转弯轨迹外侧呈 $C^1$ 连续弧线滞后拖拽（`tailTurnTrail = -clampedTurn * drawH * 0.25 * u^{1.72}`），同时自动放大尾鳍推进振幅（`1 + |turnBend| * 0.42`）与背腹微侧倾压缩（`bankRollScaleY`）。
    - **水平急转甩尾（Horizontal Whip-Turn，告别“先竖直朝天 90° 再掉头”）**：当玩家操控摇杆/指针跨左右半球大幅度反向掉头（`Math.abs(diff) > 1.85 rad` 且 `cos(angle) * cos(targetAngle) < -0.15`）时，鲨鱼直接沿水平面执行甩尾掉头并注入高强度 C 形脊柱甩尾脉冲（`turnRate = ±0.92`），不再像机械钟表指针一样先竖直朝天/朝海底转过 $\pm 90^\circ$。
    - **2.5D 透视缩进翻转与垂直防抖滞回（Zero 1-Frame Mirror Pop）**：通过带垂直防抖死区（`|\cos(\theta)| > 0.18`）的 `facingDir` 与平滑插值的 `facingScaleX`（`[-1, 1]`）驱动 2.5D 透视翻转（`perspectiveScaleX = 0.42 + 0.58 * |facingScaleX|^{0.8}`）及连续仰角公式 `horizonPitch = atan2(sin(θ), |cos(θ)|)`，彻底消除跨 $\pm 90^\circ$ 或左右转向时的单帧镜像突变（Mirror Pop）。
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

### 2.2 渲染与物理碰撞统一数据源及 5 大海洋族群差异化游动步态
- `drawPreyEntity()` 中的绘制缩放比例 `visualScale` 与 `App.tsx` 中 `resolvePreyEncounter()` 的碰撞半径缩放比例**必须调用同一个纯函数 `getPreyRelativeVisualScale(prey, shark.stats, prey.mutationVariant, frenzyActive)`**（内部固定使用 `normalBiteTier` 计算视觉尺寸）。
- 严禁在 `canvasRenderer.ts` 中私自放大或缩小猎物尺寸而不经过 `getPreyRelativeVisualScale`；所有切片摆尾变形（`drawUndulatingSpriteFrame`）严格在 `drawW × drawH` 基准包围盒内部执行。
- **五大海洋生物族群差异化步态 (`getPreySwimGait`)**：
  1. `CARANGIFORM`（小丑鱼、蓝吊、金枪鱼、灯笼鱼、矛尾鱼等标准鱼类）：前部稳定 + 后 65% 躯干 S 波摆尾推进。
  2. `ANGUILLIFORM`（电鳗、绿海鳗、蝰鱼、宽咽鱼等长条鳗形生物）：全身多波段（$k = 4.75$）丝滑蜿蜒游走。
  3. `MEDUSOID_JET`（发光水母、吸血鬼乌贼、大王酸浆鱿、克苏鲁克拉肯）：非对称伞盖/外套膜收缩喷射 + 触须延迟摆动波。
  4. `PUFFER_BUOYANT`（黄金刺豚、蓑鲉、海马、水滴鱼）：圆润躯体呼吸浮游 + 末端尾鳍高频小幅拨水。
  5. `RIGID_PROPULSION`（探测潜艇、水雷、寄居蟹、大王具足虫、帝王蟹、遗迹化石）：保持刚性金属艇壳/甲壳结构不发生橡胶弯曲，仅在尾部施加推进器高频微振或步足摇曳。
- **猎物情绪与速度耦合**：`prey.phase` 推进速率与猎物瞬时移速（`Math.hypot(vx, vy) / baseSpeed`）实时联动，受惊逃窜或冲锋扑咬时摆尾频率自动翻倍。

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
- **科幻金属中空头像数据栏与三色横幅按钮图集 (`public/assets/aistudio/buttons_16e3a0cf.png`)**：
  - 由 `spriteSheetManager.ts` 的 `processAndSliceUiBannersImage()` 自动完成 **外围暗灰底（`RGB(60,60,60)`）BFS 泛洪抠图 + 顶部头像框左环内孔 `(0.2398W, 0.3125H)` 镂空透明化 + 6px 霓虹光晕边缘反混色（Color Unmixing）+ 紧致包围盒原始长宽比裁切**：
    1. `UI_PLATE_AVATAR_BAR`（`<UiAvatarDataBar />`）：左侧为霓虹青光金属中空圆环（内嵌动态游动的 `<SharkFormCanvasPreview />`、紫色经验进度环 `XP Ring` 与咬合阶位盾牌 `T{N}`），右侧为斜切深海藏青数据面板（承载血统世代、鲨鱼名称、首页跨局金币/基因或局内斜切 HP 生命条与冲刺能量条）。首页（`gameState === 'title'`）将该头像名称及数据模块固定于**左上角**（尺寸等比缩小 30%：`w-[203px] sm:w-[245px] md:w-[273px]`），与局内左上角 HUD 位置保持自然承接。
    2. `UI_BAR_BTN_GREEN`（`<UiBannerButton variant="green" />`）：左侧青绿旋涡圆章 + 右侧播放三角箭头横幅按钮，用于首页「立即潜入深海」（尺寸缩小 30%：`w-[154px] sm:w-[144px] md:w-[160px]`）与结算界面「再次潜入」。
    3. `UI_BAR_BTN_BLUE`（`<UiBannerButton variant="blue" />`）：左侧蓝色双螺旋 DNA 圆章横幅按钮，用于首页「进化 (X/48)」（尺寸缩小 30%：`w-[154px] sm:w-[140px] md:w-[157px]`）与结算界面「进化 / 强化」。
    4. `UI_BAR_BTN_GOLD`（`<UiBannerButton variant="gold" />`）：左侧鎏金场记板圆章横幅按钮，用于首页「试驾机甲利维坦」（尺寸缩小 30%：`w-[154px] sm:w-[144px] md:w-[162px]`）、结算界面及败北界面「观看激励视频复活」。
- **暂停弹窗 9 合 1 科幻金属框体与按钮图集 (`public/assets/aistudio/setting_83a7a273.png`，对齐 `setting1_40eadc35.png` 布局)**：
  - 由 `spriteSheetManager.ts` 的 `processAndSliceUiSettingsImage()` 自动抠除深炭灰网格背景（`RGB(27,28,32)`）与弹窗外框内部网格（圆心 `(0.273W, 0.380H)` 镂空），裁切出 9 个独立组件：
    1. `SETTING_MODAL_FRAME`（`<UiSettingModalFrame />`）：霓虹青紫双色金属弹窗外框，顶部内嵌梯形暂停铭牌（自带左侧圆形 `||` 图标，右侧对齐渲染 `暂停 / PAUSE`），内部内容区采用定界弹性容器（`left: 6.4%, right: 6.4%, top: 14.6%, bottom: 6.6%` + `flex-col justify-between`）与 `cqw` 容器查询字号，确保在移动端横屏（`844×390` / `667×375`）与竖屏下所有按钮 100% 收纳于暂停框内。
    2. `SETTING_SHARK_CARD`（`<UiSettingSharkCard />`）+ `SETTING_BTN_EVOLVE`：紧凑高度（`h-[23.5%] shrink-0`）的宽幅金属鲨鱼头像信息卡，左侧内凹方框渲染实时游动鲨鱼缩略图，中部展示鲨鱼名称与 `强化等级 Lv.X/10 · 咬合 T{Y}`，右侧内嵌 DNA 图标的 `进化` 按钮。
    3. `SETTING_BTN_RESUME`：通栏翠绿旋涡发光横幅按钮（`h-[17.5%]`，自带 `▶` 播放三角，右侧紧接 `继续狩猎`）。
    4. `SETTING_BTN_LANG` + `SETTING_BTN_SOUND`：双列青光描边按钮（`h-[13.8%]`，分别带地球仪图标 `中 / EN` 与扬声器图标 `音效: 开/关`）。
    5. `SETTING_BTN_TUTORIAL`：通栏金框暗纹按钮（`h-[13.8%]`，带学士帽图标 `重温新手引导`）。
    6. `SETTING_BTN_RESTART` + `SETTING_BTN_MAIN_MENU`：底部双列钢灰八角按钮（`h-[13.2%]`，分别带刷新箭头 `重新开始` 与出口图标 `返回主界面`）。

### 3.2 极简无框 HUD 四角布局（视野留白率 >= 90%）
遵循移动端动作游戏（MOBA / 饥饿鲨进化）“去黑盒化、图标化、状态合并”三大视觉瘦身准则：
1. **顶部左角（一体式 `UI_PLATE_AVATAR_BAR` 科幻中空圆环头像 + 右侧斜切数据板，尺寸缩小 30%：`w-[151px] sm:w-[178px] lg:w-[217px]`）**：
   - **左侧中空金属圆环 (`ringOverlay`)**：圆环镂空窗口内居中渲染当前鲨鱼实时游动缩略图（`SharkFormCanvasPreview` `29×20`），环上叠加 SVG 紫色经验进度环（`XP Ring`）；左下角镶嵌 `UI_BADGE_TIER` 阶位盾牌（`T1~T8`），右下角镶嵌局内等级胶囊（`Lv.X`），右上角镶嵌 `图谱 X/48`（`Atlas X/48`）。**直接点击圆环（绑定 `bindMultiTouchButton`）即可打开 48 阶进化图谱**。
   - **右侧斜切藏青数据板**：上方展示血统图标、鲨鱼名称与强化等级 `Lv.X`，下方内嵌 `-skew-x-12` 斜切设计的 **HP 生命条**（含受击延迟消退黄条 `ghostHp` 与血量数值）和 **BOOST 冲刺能量条**。
2. **顶部居中（上边缘对齐头像组件上边直线部分的单行悬浮分数组件 `hud-telemetry-pill` + 3 步非阻断式新手引导条）**：
   - 顶栏采用 `items-start` 布局，并将分数组件（`hud-telemetry-pill`：得分 `UI_ICON_SCORE_TROPHY`、基因 `UI_ICON_GENE`、金币 `UI_ICON_COIN`、深度 `UI_ICON_DEPTH` 与当前悬赏目标鱼 `UI_ICON_BOUNTY_TARGET`）水平居中且将**上边缘精确对齐至左上角头像数据板右侧上边直线部分高度（`mt-[8.5px] sm:mt-0 sm:top-[15.5%]`）**，确保与左上角缩小 30% 后的头像框及右上角暂停圆章保持充足安全间距、**100% 零 UI 重叠**；连击火焰（`UI_ICON_COMBO_FIRE`）与黄金狂暴倒计时（`UI_BTN_GOLD_FRENZY`）仅在触发时于下方动态浮现。
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
  2. **事件驱动的 `getBoundingClientRect()` 缓存同步（零 60Hz 强制同步布局回流）**：`App.tsx` 中的 `syncCanvasBufferToDisplayBox()` 在挂载、`resize`、`orientationchange` 及 `window.visualViewport` 尺寸变更时读取 `canvas.getBoundingClientRect()` 的实际 CSS 宽高（`cssW`, `cssH`）设置 `canvas.width` 与 `canvas.height`，并将 `{ dpr, viewW, viewH, scaleX, scaleY }` 缓存于 `cachedDisplay` 供 `tick()` 每帧零开销读取，严禁在 60FPS `tick()` 循环内每帧调用 `getBoundingClientRect()` 触发浏览器强制重排。
  3. **13 张 AI 分层手绘美术驱动的五层真视差海洋环境引擎 (`parallaxBackground.ts`)**：
     - **完整 13 张分层美术矩阵（`OCEAN_LAYER_ASSET_PATHS`）**：
       - **阳光浅海带 (`0m ~ 520m`)**：`bg_shallow_0_water_0e65cb68.png`（阳光丁达尔光束与水面焦散底图）、`bg_shallow_1_far_8898229a.png`（远景海底山脉石拱门与沉没帆船剪影）、`bg_shallow_2_mid_b4e0d30a.png`（中景鹿角珊瑚、紫管海绵与礁石崖壁）、`bg_shallow_3_near_96e92ee1.png`（近景金沙滩、发光珍珠巨蚌与生锈铁锚）。
       - **暮光深海带 (`520m ~ 1150m`)**：`bg_twilight_0_17bcb84c.png`（`1916×821` 暮光深海幽蓝斜射光束与生物发光微粒水体底图）、`bg_twilight_1_04f5d35f.png`（`1916×821` 远景亚特兰蒂斯沉没柱廊神殿与发光青色裂谷崖壁）、`bg_twilight_2_fd5a1b33.png`（`1916×821` 中景远古巨鲸肋骨拱廊、发光海葵、玻璃海绵与白珊瑚群）、`bg_twilight_3_6e0dd7c1.png`（`1916×821` 近景深海海百合、紫色柳珊瑚海扇与沉没古陶罐海床）。
       - **深渊海沟带 (`1150m+`)**：`bg_abyss_0_1bbf506a.png`（`1916×821` 黑曜石深渊热液红光与上浮熔岩火星底图）、`bg_abyss_1_75e4a628.png`（`1916×821` 远景海底火山群峰、柱状玄武岩崖壁与熔岩溪流）、`bg_abyss_2_6ce66695.png`（`1908×824` 中景黑烟囱热液喷口浓烟、红白巨型管虫林与熔岩裂隙）、`bg_abyss_3_a4986280.png`（`1915×821` 近景黑烟囱热液群、红冠管虫簇与龟裂熔岩海床）。
       - **海洋生态氛围精灵图集 (`4×2` 网格)**：`bg_ambient_sprites_0c6882ce.png`（含旋转沙丁鱼球、蝶鱼群、远景蝠鲼、发光海月水母、摇曳巨藻、荧光海鞭、上升气泡串、深海灯笼鱼群共 8 类动态精灵）。
     - **分帧异步离屏智能预处理管线（`enqueueProcessingTask` + `processTerrainLayerToSeamlessStrip` & `sliceAmbientSpriteSheet`）**：
       1. **分帧队列调度与最优纹理分辨率**：13 张大图加载完成后通过 `enqueueProcessingTask` 按每帧最多处理 1 张图的节奏异步执行（优先处理浅海带 4 张图层），并将地形层缩放至 `640px` 宽、水体底图缩放至 `512px` 宽，降低 61% 像素处理与实时采样带宽开销，确保首屏零卡顿。
       2. **BFS 连通域智能抠图（保护前景白色细节）**：从顶部天空边界（及 `bg_abyss_3_near` 底部留白边）执行 BFS 泛洪去底（兼容 `#FFFFFF` 纯白与 `bg_shallow_1_far` 的 `#FF00FF` 洋红底色，以及 `bg_abyss_1_far` 史前颅骨眼窝镂空），100% 保护画面内部白色珍珠与白色管虫不被误抠；针对 `bg_shallow_1_far` 左右两侧水平分界线采用单遍 $O(W\times H)$ 列扫描算法执行纵向 Alpha 柔化渐隐。
       3. **上下空白包围盒自动裁切**：自动检测非透明地形上下边界 `[minY, maxY]`（完美裁除 `bg_abyss_3_near` 底部 20% 白色留白条），将方图转化为紧致宽幅地形条带。
       4. **14% 余弦交叠无缝水平拼接（`makeHorizontallySeamlessCanvas`）**：通过首尾 `14%` 宽度的余弦权重（`0.5 - 0.5 * cos(πt)`）平滑混合生成周期无缝纹理，既消除水平循环接缝，又杜绝 `[A | flipH(A)]` 镜像对称伪影。
        5. **五层景深交错合成与物理级纵向/横向相对视差标定（`computeBiomeVerticalOffsets` + 海平面镜头上界锚定）**：
           - **海平面镜头上界锚定与远景零漂移（解决游到海平面时远景海水下滑与远景礁石异常上浮问题）**：
             1. 局内镜头 `sim.camera.y` 设置海平面上界锚定 `minSurfaceCameraY = Math.max(72, (viewH * 0.5 - 76) / effCamZoom)`：当鲨鱼向上游向海平面（`shark.y -> 0`）时，镜头顶部锁定在海面水体上沿而不再向上穿出空白天空，鲨鱼在屏幕内真实上浮至顶部海面波光层，同时底部礁石与海床绝不随镜头升空而异常抬升。
             2. `01_海水远景`（`shallow.water`）始终锚定于视口顶边（`y = 0`），横向视差压低至极微弱的 `0.012x`、纵向视差控制在 `<= 2px`（`-Math.round((1 - u) * 2)`），彻底杜绝游到海平面时表层海水随旧版 `waterTopY`（`1.0x` 镜头速度）向下滑落覆盖礁石。
             3. `02_远处礁石`（`shallow.far`）横向视差压低至 `0.025x`、纵向振幅收敛至 `2.5px`（`farY = -12 + 2.5 * u`），呈现远景山脉般几乎静止（`几乎不动`）的沉稳深海景深。
           - **海床锚定共享单调高度曲线（解决前景在中下水层冻结导致的“前/中景相对运动方向反转”问题）**：各生态带统一以各自海床底部（`biomeFloorY`：浅海 `680m`、暮光 `1340m`、深渊 `2100m`）为锚点，计算唯一共享的归一化距底高度参数 `u = Math.tanh(Math.max(0, biomeFloorY - depthRefY) / 480) ∈ [0, 1]`，并按真实光学景深严格递增分配位移振幅（`farY = -12 + 2.5 * u`、`schoolParallaxY = -8 + 8 * u`、`midY = -9 + 14 * u`、`nearY = 28 * u`）：
             1. **鲨鱼向下潜（`depthRefY` 增大 $\to u$ 减小）**：远景几乎静止，中、近景同时在屏幕上向上移动，且**近景（`near`）上移速度恒为中景（`mid`）的 `2.0` 倍**（`nearY - midY` 随下潜单调减小），即近景相对于中景**向上抬升并遮挡更多中景下部**，同时底部始终贴合视口下缘（`nearY >= 0`），绝不中途卡死或露底。
             2. **鲨鱼向上浮（`depthRefY` 减小 $\to u$ 增大）**：远景几乎静止，中、近景同时在屏幕上向下移动，且**近景（`near`）下移速度恒为中景（`mid`）的 `2.0` 倍**（`nearY - midY` 随上浮单调增大），即近景相对于中景**加速下沉，自然显露后方更多中景礁崖与远景奇观**。
           - **海床植被零滑移锁定**：生长于近景海床之上的摇曳巨藻/荧光海鞭与气泡串（`drawAnimatedSeabedSprites`）采用与近景海床完全一致的横向视差系数（`0.38x`）、纵向偏移（`nearY`）与缩放比例（`nearScale`），彻底消除植物根部在沙滩上的横向滑移。
           - **鲨鱼成长驱动的远/中/近景光学分级缩小（`getParallaxLayerGrowthScales(relativePreyScale)`）**：
             - 当鲨鱼通过局内升级（`Lv`）、躯体强化（`Lv.1~10`）或破茧进化（`G1~G6`）成长变大时，除猎物按 `relativePreyScale`（`1.00x -> 0.40x`，缩小最多 `-60%`）退缩外，五层海底背景同步按**真实光学景深距离耦合权重（`近景 0.70 > 远景鱼群 0.55 > 中景 0.45 > 远景 0.22 > 海面水幕 0.15`，即远:中:近变小比率约为 `1 : 2.05 : 3.18`）**平滑缩小：
               - **近景海床 (`nearScale`: `1.000x -> 0.580x`，缩小最多 `-42.0%`)**：紧贴鲨鱼游动平面的铁锚、珍珠巨蚌、珊瑚丛、古陶罐与热液管虫缩小最显著，直观衬托巨鲨体魄。
               - **远景氛围生物群 (`ambientScale`: `1.000x -> 0.670x`，缩小 `-33.0%`)**：沙丁鱼球、蝠鲼、发光水母与灯笼鱼群同步缩小。
               - **中景礁崖/遗迹 (`midScale`: `1.000x -> 0.730x`，缩小 `-27.0%`)**：珊瑚礁台地、远古巨鲸肋骨与黑烟囱喷口适度后退缩小。
               - **远景山脉/神殿 (`farScale`: `1.000x -> 0.868x`，仅缩小 `-13.2%`)** 与 **海面水幕 (`waterScale`: `1.000x -> 0.910x`，仅缩小 `-9.0%`)**：远方地平线山脉与石拱门缩小最慢，使近景下沉缩小后自然显露更宏阔的中远景深海奇观。
             - **视口中心相位锚定（Zero Horizontal Jump）**：水平平铺相位 `normPhase = (((cameraX * parallaxXFactor) / baseTileW) % 1 + 1) % 1` 固定以未缩放基准宽度 `baseTileW` 计算并锚定于屏幕中心 `viewW * 0.5`，确保局内升级或进化瞬间背景从屏幕中心丝滑缩放退后（`smoothedRelativePreyScale` 阻尼插值），在任意世界坐标 `cameraX` 下均 **0px 横向跳动**。
             - **跨生态带下潜「景深错峰 $C^2$ 五次曲线过渡 + 垂直空间涌现与沉降 + 严格跨生态带景深平面排序」（`computeParallaxBiomeTransitionState` in `src/game/rules.ts` & `parallaxBackground.ts`）**：
               1. **告别四层同步线性切换，采用光学景深错峰 $C^2$ 五次曲线（`quinticSmoothstep`：$6t^5 - 15t^4 + 10t^3$）**：下潜跨越「阳光浅海 $\leftrightarrow$ 暮光温跃层」或「暮光温跃层 $\leftrightarrow$ 午夜深渊」时，水幕（`Water`、`480m` 过渡带）、远景（`Far`、`410m`）、中景（`Mid`、`330m`）与近景（`Near`、`260m`）不再在同一深度同时线性淡入淡出，而是严格遵循水下大气光学规律——**水体色调与远景山脉/遗迹剪影率先在深水远方浮现，中景礁崖次之，贴身的近景海床最后完成交接**，且起始与结束处一阶、二阶导数均为 `0`（零突变感）。
               2. **垂直空间涌现与沉降（Vertical Spatial Emergence & Subduction，零原地死板叠化）**：下潜进入更深生态带时，新生态带的远/中/近景从视口底边下方（`farTransitionOffsetY: +18~20px`、`midTransitionOffsetY: +32~36px`、`nearTransitionOffsetY: +48~54px`）随下潜进度缓缓向上涌现升起，而上方旧生态带同步向视口底边下方沉降退场；所有过渡偏移量恒满足 `*TransitionOffsetY >= 0`，从数学上保证任何图层底边绝不高于 `viewH`（100% 零底边露底黑缝）。
               3. **跨生态带严格光学平面 Z 序（`All Far` $\to$ `Underwater Atmospheric Haze Veil` $\to$ `Ambient Schools` $\to$ `All Mid` $\to$ `L1/L2 中景地貌结构` $\to$ `All Near` $\to$ `L1/L3 近景海床脊线与群落生态`）**：彻底修复旧版按生态带整体打包绘制导致暮光/深渊中远景盖在浅海近景海床之上的透视穿帮，确保过渡期内任意生态带的近景海床永远遮挡所有中景与远景。
               4. **深海水幕垂直余弦羽化包络与三生态带连续粒子权重融合**：`twilight.water` 与 `abyss.water` 在 `processWaterLayerToSeamlessTile` 中施加顶部与底部双向余弦 Alpha 羽化包络（峰值不透明度收敛至 `0.46 ~ 0.52`），避免整屏硬壁纸覆盖；环境微粒按 `particleShallowWeight`、`particleTwilightWeight`、`particleAbyssWeight` 连续插值混合，彻底消除 `520m` 与 `1150m` 阈值处的单帧粒子跳变。
               5. **四尺度（`L0 ~ L3`）连续程序化地形切片变形与群落生态合成 (`worldGenerationSystem.ts` & `parallaxBackground.ts`)**：
                  - **16 列连续高程切片变形 (`drawParallaxPlane` + `sampleColumnContourOffsetPx`)**：彻底告别整块静态 PNG 平移，将每个 Far/Mid/Near 视差瓦片细分为 `16` 列垂直切片，按全局坐标采样三层连续噪声（`noise(x*0.0005)*500 + noise(x*0.002)*150 + noise(x*0.008)*30`）与 L0 宏观区域起伏倍率（`0.36x ~ 1.75x`）对每列施加连续垂直起伏偏移（远景 `-14..+18px`、中景 `-32..+38px`、近景 `-46..+54px`），使海底山脉、沙坪、峡谷与海沟形成跨 Chunk 无缝连续起伏。
                  - **L1 中景岩层轮廓与 L2 Voronoi 地貌结构 (`renderMidgroundStructuresAndStrata`)**：在中景与近景之间渲染连续中景岩层多边形，并基于 Voronoi 单元格与跨边界连续洞穴 SDF 绘制拱门通道（`REEF_ARCHWAY` 镂空岩拱）、钟乳石洞穴（`CAVE_CHAMBER`）、波纹沙丘（`SAND_DUNE_RIDGE`）、阶梯断崖（`CONTINUOUS_CLIFF`）与发光热液岩冢（`HYDROTHERMAL_MOUND`）。
                  - **L3 可见海床脊线锚定与 Poisson Disk 聚集式生态群落 (`renderProceduralWorldOverlay`)**：将近景连续海床轮廓与生态装饰严格锚定在可见海床脊线（`visibleSeabedCrestY = viewH - nearPlaneTargetH * 0.52`）而非屏幕底边之下，按 `Cluster Center + Poisson Disk Sampling` 与环境场（光照/坡度/深度）条件过滤绘制鹿角珊瑚、脑珊瑚、紫管海绵、海草簇、摇曳巨藻、荧光海鞭、深海发光海葵、水晶尖塔与热液气泡喷口。
            - **渲染合成顺序**：按 `水深光谱 + Layer 0 海水远景 (横向 0.012x / 纵向 <=2px 顶边锚定 / 缩放 waterScale)` $\to$ `单次合并填充的体积光束 (横向 0.04x)` $\to$ `全生态带 Layer 1 远景礁石奇观 (16列连续高程变形 / 横向 0.025x / 缩放 farScale)` $\to$ `水下大气散射雾幕 (Atmospheric Haze Veil)` $\to$ `4×2 远景氛围鱼群/水母/蝠鲼精灵 (横向 0.16x / 缩放 ambientScale)` $\to$ `全生态带 Layer 2 中景珊瑚礁/喷口 (16列连续高程变形 / 横向 0.18x / 缩放 midScale)` $\to$ `L1/L2 中景连续岩层与拱门/洞穴/沙丘/断崖/热液冢结构` $\to$ `全生态带 Layer 3 近景海床 (16列连续高程变形 / 横向 0.38x / 缩放 nearScale)` $\to$ `L1/L3 近景海床连续脊线与 Poisson Disk 聚集式珊瑚/海草/巨藻/发光群落 + 实时气泡串精灵` $\to$ `预烘焙 256×256 深海水压暗角缓存` 顺序实时渲染。

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
  - **上方 68% 巨幕主鲨聚光灯舞台**：无遮挡居中展示当前选中鲨鱼的巨幅实时摆尾游动模型（移动端 `186×100` / Desktop `224×120`），上方无框展示血统与 `T{N}` 阶位，下方无框展示鲨鱼名称与出战/解锁状态。
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

### 4.7 实时调参 Debug 悬浮面板 (`data-testid="live-debug-panel"` in `src/App.tsx`，默认隐藏入口、保留完整调参代码)
- **入口与布局**：在标题页右上角与局内 HUD 右上角保留 `🛠 调参 / Debug` 开关按钮与 `live-debug-panel` 面板完整代码实现，默认设置 `showDebugPanel = false` 并为调参按钮添加 `hidden` 类隐藏入口，保持正式游玩界面纯净无干扰。
- **三通道实时调节器（指针事件隔离，滑动零误触画布转向）**：
  1. **鱼群刷新数量调节器（`4 ~ 80` 条，默认固化为 `20`）**：提供滑块与 `-4` / `+4` 步进按钮，实时更新 `ecosystemSpawner.maxActivePreys` 并调用 `syncPreyCountImmediate()` 同帧增删猎物，直观显示当前同屏鱼数。
  2. **猎物显示大小调节器（`0.35x ~ 2.50x`，默认固化为 `0.80x`）**：提供滑块与 `-0.1` / `+0.1` 步进按钮，实时调用 `setDebugPreySizeMultiplier()` 同步缩放猎物屏幕绘制尺寸与碰撞半径。
  3. **2D Chunk 网格、连续海床、宏观 Biome/深度带、生态/POI 与生命周期/缓存/对象池调试开关（`WorldDebug.drawChunkBounds`，默认关闭 `OFF`）**：支持一键开启《无限横向海洋地图规范 v1.0》阶段 A~G 全栈调试叠层，包括二维 Chunk 边界框（`3000×1500` 左闭右开 `[startX, endX) × [startY, endY)`）、`chunkId`（`${chunkX}:${chunkY}`）与实时生命周期状态（`ACTIVE / READY / QUEUED / GENERATING`）、海面 `Y=0` / 海底 `Y=20000` 边界线、`1.0x` 连续海床采样折线与接缝节点（`getTerrainSamples`）、水平宏观生态区边界与过渡带（`macroWidth = 30000, transitionWidth = 6000`）、垂直 5 大深度带分界线（`Epipelagic` ~ `Hadal-like`）、Chunk 内生态对象点位/ID、POI 占地半径圆圈与 `ownerChunkId` 标记，以及右上角世界坐标/海床/Biome/深度视觉 Profile/生态对象与 POI 计数/Active Chunks (`<=10`)/LRU Cache (`<=64`)/Queue (`<=32`)/Object Pool (`<=300/type`)/单帧生成耗时 (`ms`) 遥测铭牌。
  4. **一键重置按钮（`重置默认 / Reset`）**：立即恢复 `20 条 / 0.80x / WorldDebug OFF` 默认参数。

---

## 5. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-11-14 | **扩展为全深度 9 级非均匀递增间距连续阶梯海床（`SEABED_TERRACE_TIERS`）+ 交错弧形下潜洞口 + 全层级双向防穿透与礁石生态附着（覆盖 `414m` 浅海至 `16900m` 冥渊海沟）**：① **全深度非均匀递增间距海床布局**：复用浅海连续海床与向远处弧形弯曲下潜洞口的实现方式，从浅海到超深渊依次构建 9 级垂直间距随深度严格递增的连续海床——`Tier 0` 阳光浅海（`~414m`）、`Tier 1` 上暮光层（`~1220m`，间距 `+806m`）、`Tier 2` 中暮光层（`~2220m`，间距 `+1000m`）、`Tier 3` 深暮光层（`~3460m`，间距 `+1240m`）、`Tier 4` 半深海层（`~5040m`，间距 `+1580m`）、`Tier 5` 深海断崖层（`~7060m`，间距 `+2020m`）、`Tier 6` 深渊海盆层（`~9640m`，间距 `+2580m`）、`Tier 7` 超深渊黑曜石层（`~12900m`，间距 `+3260m`）与 `Tier 8` 冥渊海沟前哨层（`~16900m`，间距 `+4000m`），按深度自适应铺设 `coral_reef`、`rocky_shelf`、`underwater_canyon` 与 `deep_abyss` 表层条带、三阶地下沉积岩层及断面镶嵌巨石；② **交错下潜洞口与深海尺度自适应**：各层通过 `seamPhaseOffsetX` 水平错开下潜洞口位置，且洞口宽度（`464m -> 832m`）、水平网格跨度（`1600m -> 3600m`）与层间净空走廊高度（`394m -> 3268m`）随深度同步扩展，既确保鲨鱼在任意深度下潜都有多层海床与底栖礁石群落作为参照物，又为深海巨型进化形态留出充足游动空间；③ **全层级双向物理碰撞与山根无缝融合**：全部 9 层海床均具备顶面承托与底部拱形洞顶防向上穿透阻挡（`hitAtollUnderside = true`），且在主海山大陆坡交汇根部执行 $C^2$ 嫁接与内部表层线消隐 | `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-13 | **取消浅海悬空立柱 + 连续浅海珊瑚海床与向远处弧形弯曲的下潜洞口（`evalShallowSeabedContinuousRaw`）+ 浅层海床从下向上双向防穿透修复（`resolveSeabedCollision` / `resolveSeabedKineticStep`）**：① **取消突兀悬空支柱并实现海床连续**：彻底移除原先未落在深海海底的悬空桥墩（`buttressIdx`），将浅海海床改造为全图连续的珊瑚山脊，并与出生主海山山腰做 $C^2$ 平滑嫁接（`graftT`），两侧洞口端采用圆润收拢的岩石洞唇（`bottomArchY` 在洞唇处平滑收拢至 `topY + 28m` 并点缀手绘礁石），彻底消除海床断开的突兀感；② **向远处弧形凹陷的向下洞口视觉**：在每 `1600m` 的下潜通道区，海床后壁沿平滑余弦凹弧向远处深水弯曲下沉（`visualRimY` 下凹 `+148m`），连续铺设金沙珊瑚表层与层状砂岩，叠加远景海水蓝雾、深邃弧形洞腔暗影及 3 道向内向下弯曲的同心洞壁岩阶，直观呈现「向远处弯曲的向下洞口」；③ **修复浅层海床从下向上穿透 Bug**：在 `resolveSeabedCollision` 与 `resolveSeabedKineticStep` 中传入 `prevEngineY` 判定实体归属侧，凡处于海床表层以下（`refY > topFloorY + 4`）的鲨鱼或鱼类向上游动/冲刺时，严格阻挡在底部拱形洞顶 `bottomArchY + safeRadius` 之下并沿拱顶切向滑行，同时阻止挤入山根狭窄楔形区，彻底解决从下向上穿透浅层海床的缺陷 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-13 | **层峦叠嶂山脉海床轮廓（彻底杜绝平直与斜直线段）+ 三遍零和反共线山峦曲率修正 + `4×25m` Catmull-Rom 样条曲线细分渲染**：① **消除平的直线**：将出生点浅海区（`|X| <= 560m`）、低缓沙岭区（`evalSandyPlainFactor`）与浅海镂空珊瑚环礁拱桥（`getShallowCoralAtollAt`）全面升级为多频叠加的连绵山丘与多峰珊瑚山岭（环礁拱台顶面具备 `±68m` 的 3~4 峰谷起伏与钟乳石拱洞底壁），杜绝任何水平锁死段；② **消除斜的直线**：升级 `evalSlopeVariationOffset` 为视口级多峰海底山脉波（`1180m/780m/520m/340m/220m`），使大陆坡下降途中反复向上反翘隆起次级海底山峰（`slope < -0.08`），并在 `evalGridNodeFloorDepth` 中引入 `redistributionLimit = 1.36 * stepX` 裕度预留、10 对偶奇零和山脊拱度（Pass 1/2）及跨块双生交错斜率格网（Pass 3: `Lattice A/B`），数学保证全海域零水平线段（`|slope| >= 0.035`）与零共线斜直线段（相邻步 `|Δslope| >= 0.08`）；③ **`4×25m` 曲线细分海床渲染**：在 `renderPhysicalSeabed` 中将浅海珊瑚环礁拱桥采样加密至 `32` 步，并将主海床每 `100m` 段细分为 `4 × 25m` Catmull-Rom 三次样条 + 确定性岩脊微起伏子段，使海底基岩与 `world_seabed_strips` 材质带呈现连绵起伏的自然山峦曲线 | `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-13 | **海床「表层以下」专属无缝层状基岩纹理（`sliceAndMakeSubsurfaceBedrockStrip`）+ 山体全高度多层顺势地质岩壁与断面巨石镶嵌（`renderPhysicalSeabed`）**：① 针对海床表层以下缺失纹理、山体内部显得空洞的问题，在 `WorldAssetRegistry` 中新增 `sliceAndMakeSubsurfaceBedrockStrip`，融合 `world_seabed_strips` 的手绘阶梯状沉积岩层与各生态区纵向裂隙/青色发光矿脉/火山熔岩纹路（剔除表层粉红珊瑚与浅滩黄沙，将浅海山体断面校准为暖褐赭石砂岩与礁灰岩色温），并赋予 `14%` 水平余弦无缝混合与顶/底双端余弦 Alpha 羽化；② 为海床表层条带底部 `26%` 增加余弦羽化并在 `drawSeamlessShearedStrip` 中实现跨 `u = 1.0` 循环边界双段无缝拼接（消除接缝处像素拉伸）；③ 在 `renderPhysicalSeabed` 中对主海床与浅海镂空珊瑚环礁拱台开启 `ctx.clip()`，近表层（`Tier 0..1`）按 `25m` 样条子段贴合山脊起伏，深部（`Tier 2..10`）按黄金分割水平错相与逐层递减斜率（`slope * 0.78^tier`）从表层以下一路无缝叠铺至视野底端 `maxEngineY`（浅海砂岩山体深腹渐进混入青灰大陆架基岩），同时在山体断面上按确定性哈希镶嵌 `mossy_slab`、`basalt_boulder` 与 `jagged_spire` 阶梯岩块露头，使整座海底山体与拱台内部饱满厚重 | `src/game/worldGenerationSystem.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-12 | **深度上限扩展至 `20000m`（`WORLD_UNITS_PER_METER = 1`）+ 2D 随机 Chunk 陡坡海床采样完善 + 4 层多尺度随机域扭曲海床坡度（`evalWarpedTerrainWave` / `evalRidgedTerrainWave`）**：① 将世界最大深度扩展并统一为 `20000m`（`WORLD_UNITS_PER_METER = 1`，`minFloorDepth = 420m`，`maxFloorDepth = 19800m`），并在 `renderPhysicalSeabed` 中按 `0m ~ 20000m` 深度区间（`<=1500m` 金沙珊瑚礁、`2300m~5400m` 大陆架板岩、`6600m~11800m` 发光青脉峡谷岩、`>13400m` 超深渊熔岩黑曜石）动态平滑混合 4 条无缝海床贴图；② 在 `ChunkGenerator` 的 `generateSubsystemRawCandidatesForChunk` 中通过遍历 `getTerrainSamples(chunkX)` 的 31 个采样点精确锁定海床穿过当前 `3000m×1500m` Chunk 的横向子区间 `inChunkSeabedX`，确保陡坡 Chunk 内的 4 层复合珊瑚礁群落 100% 锚定在海床上；③ 移除固定周期模板，采用「20 步地质块锚定 + 4 层多尺度域扭曲非对称断崖/阶梯岩台/V 型折叠峡谷 + 守恒斜率重分配」算法（`TERRAIN_MAX_SLOPE = 2.4`），生成兼具平缓阶梯岩架、局部反翘海脊与陡峭深渊断崖的随机海底坡度 | `src/game/worldGenerationSystem.ts`, `src/game/config.ts`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-13 | **平顶海山（Guyot）山顶柔化 + 斜坡多阶梯平台与逆坡起伏（`TERRAIN_MAX_SLOPE = 1.65`）+ 顺坡上游切向速度归一化（`resolveSeabedKineticStep`）+ 双层「浅海镂空珊瑚环礁拱台（`getShallowCoralAtollAt`）」渲染与物理**：① 将出生点海山与远洋海山顶部全面升级为宽阔平缓的平顶海山（Guyot Tablemount，出生台地 `X ∈ [-520m, +520m]` 稳定于 `~530m~565m`，`|slope| <= 0.14`），消除尖锐三角形峰顶；② 下调 `TERRAIN_MAX_SLOPE = 1.65` 并注入 `evalSlopeVariationOffset`（半山缓台 + 逆向海脊）与 `scratchStepRhythm` 单步地质节奏，使下降坡面交替呈现水平沙台、微上扬逆坡与舒缓阶梯；③ 新增 `resolveSeabedKineticStep` 将顺坡游动位移投影至海床单位切向量 $\vec{T} = \frac{1}{\sqrt{1+s^2}}(1,s)$ 并施加 `0.90` 上坡重力阻尼，彻底修复顺地形上坡游动速度异常偏快的问题；④ 首创「双层空间海床」方案：每 `1600m` 横向网格在深海区（主海床 `> 920m`）上方的阳光浅水带（`350m~510m`）生成宽 `1152m` 的**浅海镂空珊瑚环礁拱台（Shallow Coral Reef Atoll Arch Bridge）**，顶面铺设手绘 `coral_reef` 海床贴图并密集生长 4 层复合珊瑚礁群落、共生礁石与海草，底部镂空为玄武岩海底拱门，使新手沿浅水朝任意方向探索都能频繁遇到大片海底珊瑚礁，同时深水区（`> 650m`）从拱桥下方 100% 畅通无阻穿行，绝不被海底地形隔断 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-12 | **重构构造板块级海床起伏（`350m` 浅海珊瑚台地 $\to$ 大陆坡大峡谷 $\to$ `2100m~2720m` 超深渊海沟）+ 移除突兀人工海山岩柱 + 海底轮廓材质图（`world_seabed_strips`）加厚双岩层深度自适应贴图**：① 移除 `WorldRenderer` 中拔地而起的突兀垂直海山岩柱（`renderTerrainConnectedReefSeamounts`），改为让**真实可碰撞连续海床（`getFloorDepthAt` / `renderPhysicalSeabed`）**在出生点附近（`X = 0m..+240m`）自然隆起至 `350m~440m` 阳光浅海珊瑚礁大陆架，所有复合珊瑚礁群落直接生长在自然起伏的真实海床上；② 拓展 `WorldConfig.bounds.maxDepth = 28000`（`2800m`）、`minFloorDepth = 3200`（`320m`）、`maxFloorDepth = 27200`（`2720m`）、`TERRAIN_MAX_SLOPE = 1.65`，实现构造板块级「浅海大陆架（`350m`）$\to$ 暮光大陆坡（`600m~1150m`）$\to$ 海底大峡谷（`1200m~1950m`）$\to$ `2000m+` 超深渊海沟（`2040m~2711m`）」三尺度叠加起伏地形，并在 `src/App.tsx` 海床碰撞中新增顺坡滑行导引；③ 升级 `renderPhysicalSeabed` 中海底轮廓材质图 `/public/assets/aistudio/world_seabed_strips_1794473245165.jpg` 的渲染：按海床实际深度区间（`<=580m` 金沙珊瑚礁、`580m~1180m` 大陆架层状板岩、`1180m~1900m` 发光青脉峡谷岩、`>1900m` 深渊黑曜熔岩裂隙）平滑混合 4 条岩壳材质带，将主岩壳层加厚至 `152m` 并叠加下层断崖副岩层，使陡坡峡谷与海沟岩壁呈现厚重细腻的手绘地质纹理 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-12 | **重构海床珊瑚礁 4 层复合结构（`renderCompositeCoralReefMound`）+ 岩石/残骸共生珊瑚附着（`renderAnchoredRockOrDebrisWithEpifauna`）+ 浅中层通底礁石海山（`renderTerrainConnectedReefSeamounts`）+ 100% 消除海中漂浮珊瑚/海葵**：① 消除一切导致珊瑚/海葵悬空漂浮的根源：禁止水层浮游类别 `biolum_organism`（`seabedConstraint: 'water_column'`）在开放水体中绘制静态礁石海葵贴图（将该深海发光海葵变体归入贴地珊瑚簇 `eco_coral_cluster:biolum_anemone`），并将所有底栖物件（珊瑚、岩石、海草、残骸、喷口、POI 地标）的视觉根部严格锁定在实时海床采样线 `floorEngineY = getEngineFloorDepthAt(ex)` 上且附加坡度补偿深埋量 `slopeEmbedSink = Math.abs(localSlope) * halfW + baseSink`；② 设计并实现 **4 层复合珊瑚礁群落（Coral Bommie / Reef Mound）**：第 1 层为顺应海床坡度切线深嵌沙床的 2~3 块礁岩基座（`mossy_slab` / `basalt_boulder`），第 2 层为堆叠在基座上方并向下嵌合 34%~36% 的 3 簇块状造礁核心（脑珊瑚 `brain_coral`、管状海绵 `tube_sponge`、深海海葵 `biolum_anemone`），第 3 层为扎根于脑珊瑚穹顶与礁石斜肩上的 3 簇分枝鹿角珊瑚与迎流海扇（`staghorn`、`fan_coral`），第 4 层为礁石基座两侧接壤处的伴生海草簇；③ 为独立礁石与沉船残骸增加礁石底座与顶部/侧肩共生附着珊瑚；④ 新增从海底主地形连续向上隆起至 `250m~780m` 浅中海区的阶梯状通底礁石海山（顶部与侧翼台阶均覆盖海床贴图与 4 层复合珊瑚礁） | `src/game/worldGenerationSystem.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-12 | **生成并接入《v1.0 规范》世界空间 3 大高清美术图集（替换 `renderPhysicalSeabed` 与 `WorldRenderer` 全部几何线条图案）**：① 生成 4 生态区水平无缝海床岩壳纹理图集 `/public/assets/aistudio/world_seabed_strips_1794473245165.jpg`（含 `coral_reef` 金沙珊瑚礁、`rocky_shelf` 层状板岩、`underwater_canyon` 发光青脉玄武岩、`deep_abyss` 黑曜石熔岩裂隙），在 `renderPhysicalSeabed` 中沿 `getFloorDepthAt(x)` 采样段执行仿射斜切贴图，彻底替换原有的蓝青色几何线条；② 生成 5×2 大型地标 POI 图集 `/public/assets/aistudio/world_pois_atlas_1794473250443.jpg`（覆盖沉船、洞穴、宝箱、稀有生物巢穴、远古巨兽肋骨/方尖碑共 10 种变体）与 4×4 海床生态装饰物图集 `/public/assets/aistudio/world_ecology_atlas_1794473252524.jpg`（覆盖 4 种珊瑚、3 种岩石、3 种海草巨藻、3 种沉船残骸、2 种热液/裂隙喷口与深海发光海葵共 16 种物件）；③ 在 `WorldAssetRegistry` 中实现离屏 BFS 纯白背景泛洪抠图、内部镂空孔洞清理、2 层抗锯齿白边解混与紧致包围盒裁切，并在 `WorldRenderer.renderActiveChunkEntities` 中实现贴地锚定与随水流摇曳绘制 | `src/game/worldGenerationSystem.ts`, `public/assets/aistudio/world_seabed_strips_1794473245165.jpg`, `public/assets/aistudio/world_pois_atlas_1794473250443.jpg`, `public/assets/aistudio/world_ecology_atlas_1794473252524.jpg`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-11 | **移除原有的远/中/近（`1_far` / `2_mid` / `3_near`）静态分层背景图，全面启用《v1.0 规范》世界空间连续水体与程序化实体海床**：在 `src/game/parallaxBackground.ts` 的 `load()` 与 `render()` 中去掉 `bg_shallow_1..3`、`bg_twilight_1..3`、`bg_abyss_1..3` 共 9 张旧版贴底远/中/近景背景图及屏幕底部锁定的视差装饰层；保留连续水深光谱渐变（`sampleBathymetricWaterColor`）、`0_water` 表层阳光水幕与深海水体纹理、统一深度视觉丁达尔光束（`getDepthVisualProfile`）、远景氛围鱼群精灵（`drawDistantAmbientSchools`）、三生态带连续环境微粒与深海水压暗角，并由世界空间 `1.0x` 连续实体海床（`renderPhysicalSeabed`）与激活态 Chunk 生态/POI（`worldRenderer.renderActiveChunkEntities`）承载全部海底地形与地貌渲染 | `src/game/parallaxBackground.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 E、阶段 F 与阶段 G（`ChunkLifecycleManager`、`WorldObjectPool`、`WorldAssetRegistry`、`WorldRenderer`、`WorldPersistence`、`PerformanceDegradationController` 及全阶段总验收）**：完成 2D Chunk 生命周期状态机、方向性预加载与垂直缓冲、异步过期任务防激活、对象池彻底清理、缺失资源占位符回退、`1.0x` 世界层激活态 POI/生态渲染、增量存档与 5 级性能降级机制，并通过全部 `#1 ~ #18` 自动化验收测试 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-12 | **优化圆润宽幅 U/V 型折叠脊谷波（`evalRidgedTerrainWave`）+ 高频平缓沙坪段台地锁平（`evalSandyPlainFactor`）+ 全链路离屏 Canvas / Web Audio / 地形缓存内存回收**：① 将 `mediumWaveAmplitude` 提升至 `3800m`（双波长 `2100m & 1450m`），`evalRidgedTerrainWave` 采用 $\tanh$ 满幅增益、$\varepsilon = 0.28$ 归一化与 `32%` 余弦圆拱混合，使海底峡谷与海脊呈现舒展圆润的 U/V 型折叠轮廓；② 新增 `1800m` 单元平顶窗口 `evalSandyPlainFactor` 与单元中心常数深度锁平，使平缓沙坪段（`|slope| <= 0.22`）占比提升至 `>= 22%`；③ 新增 `terrainBlockNodeCache`（上限 `128`）与 `terrainChunkSamplesCache`（上限 `64`）、修复预加载 Chunk 60FPS 状态振荡、将 `@3x` 鲨鱼离屏画布限制为 `420px` 宽、将 `tintedFrameCache` 改为有界 LRU（上限 `24`）并在淘汰及临时切图结束时立即清零 `canvas.width = 0; canvas.height = 0;` 释放显存，同时为 `audio.ts` 绑定 `onended` 自动断开音频节点 | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts`, `src/game/audio.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 D（生态对象配置 `ECOLOGY_OBJECT_CONFIGS`、`POIGenerator` 跨界唯一归属与 `ChunkGenerator` 11 步确定性生成管线）**：新增 15 类生态对象配置与 5 类首版 POI 配置、实现 `generateEcology` / `generatePOIs` / `getOverlappingPOIsForChunk` / `generateChunk`，并在 `WorldDebug` 中增加生态对象点位/ID 与 POI 占地半径/`ownerChunkId` 可视化叠层 | `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 C（`BiomeGenerator` 宏观生态区确定性选择与平滑混合、5 大深度带与统一 `getDepthVisualProfile`）**：新增 `getMacroBiomeForIndex`、`getBiomeAt`、`getDepthBandAt`、`getDepthVisualProfile`，接入 `parallaxBackground.ts` 统一丁达尔光束衰减，并在 `WorldDebug` 中增加宏区过渡带与 5 大深度带调试叠层 | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 B（`WorldSeedService` 子系统随机流隔离与稳定 ID、连续海床 `TerrainGenerator` 及渲染/碰撞/采样三同源）**：新增 `WorldSeedService`、`createChunkRng`、`createStableId`、全局连续海床函数 `getFloorDepthAt` / `getTerrainSlopeAt` / `getTerrainSamples`、`1.0x` 世界层实体海床渲染 `renderPhysicalSeabed` 与物理碰撞 `resolveSeabedCollision`，并在 `WorldDebug` 中增加海床采样节点与斜率遥测可视层 | `src/game/worldGenerationSystem.ts`, `src/game/parallaxBackground.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-11 | **实施《无限横向海洋地图：程序化生成与开发实施规范 v1.0》阶段 A（坐标/Chunk 基础、集中配置 `WorldConfig` 与 `WorldDebug` 网格调试叠层）**：新增 `WorldConfig`、`validateWorldConfig`、二维左闭右开 Chunk 坐标换算与 `WorldDebug.drawChunkBounds` 可视化调试叠层，并在实时调试面板中接入 `3. 2D Chunk 网格调试` 开关 | `src/game/worldGenerationSystem.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/01-ARCHITECTURE.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-10 | **消除下潜过程中跨深度带背景图切换的突兀感（Web + iOS 原生双端同步重构）**：① 新增 `computeParallaxBiomeTransitionState` 与 $C^2$ 五次平滑曲线 `quinticSmoothstep`（$6t^5 - 15t^4 + 10t^3$），将原本 `220m` 窄带四层同步线性切换升级为**按光学景深错峰渐进过渡**（`Water: 480m` $\to$ `Far: 410m` $\to$ `Mid: 330m` $\to$ `Near: 260m`，远景山脉/遗迹剪影先于近景海床浮现）并引入底层 Porter-Duff 覆盖率补偿；② 新增**垂直空间涌现与沉降位移**（`far/mid/nearTransitionOffsetY >= 0`），使下潜时新生态带从视口底部向上缓缓涌现升起、旧生态带向下沉降隐退，告别死板的原地叠化；③ 修正 Web 与 iOS 跨生态带渲染 Z 序为严格的 `All Far` $\to$ `Atmospheric Haze` $\to$ `All Mid` $\to$ `All Near`，消除过渡期中远景盖在近景海床上的穿帮；④ 为 `twilight.water` 与 `abyss.water` 增加垂直余弦 Alpha 羽化包络、统一深渊层高度比例（`0.38 / 0.45`）、引入下潜深度阻尼平滑 `smoothedDepthRefY` 与三生态带连续粒子混合权重，并在 iOS 端补齐 `unmixHydrothermalSmokeSky` 黑烟囱天空去底与 Metal `colorBlendFactor` 水下大气雾染 | `src/game/rules.ts`, `src/game/parallaxBackground.ts`, `scripts/build-ios-native.ts`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-09 | **首页三段式零遮挡最大化宽幅标题布局（接入 `title3_cae0290c.png` 单行横幅 + Web/iOS 严格锁定 `3.566:1` 宽高比置顶对齐 + 巡游主角鲨鱼屏幕正居中）+ 局内常驻进化圆章 + 48 条鲨鱼独立 `@3x` 超分重绘单图管线**：① 移除首页（`gameState === 'title'`）左上角头像数据栏组件、右上角多语言/音效切换按钮以及标题下方的副标题文字，使首页顶部 100% 纯净无干扰；② 将首页标题图替换为单行宽幅双鲨艺术字 `/public/assets/aistudio/title3_cae0290c.png`（`1323×371`、`3.566:1` 宽幅 RGBA 透明 PNG），Web 端与 iOS 端统一采用按物理屏幕宽高比精确锁定的尺寸公式 `width = min(760, fullW * 0.74, fullH * 0.36 * 3.566)`、`height = width / 3.566` 并以 `.top` 贴顶对齐（消除 SwiftUI `.scaledToFit().frame(width, height)` 在 21.6:9 手机横屏下的高度过度压缩与垂直居中留白）；③ 将首页巡游主角鲨鱼镜头保持屏幕水平与垂直正居中（`50% X, 50% Y`），并补齐 iOS 首页径向暗角滤镜；④ 在局内右下角技能扇区「强化躯体」正上方新增常驻进化图鉴/破茧进化圆章按钮（`inrun-fixed-evolution-btn` / `FixedEvolutionHudButton`）；⑤ 使用 Nano Banana AI 超分重绘 48 张独立 `@3x` 鲨鱼贴图并修复白肚皮内部透明破洞问题，同步至 Web 与 iOS | `public/assets/aistudio/title3_cae0290c.png`, `public/assets/aistudio/title_11de9fff.png`, `public/assets/aistudio/title2_dbfd9f83.png`, `src/App.tsx`, `scripts/build-ios-native.ts`, `scripts/build-sharks-3x.ts`, `public/assets/sharks_3x/`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-05 | 完成真机反馈 6 项体验优化与 iOS/Web 双端同步：① 补齐 `src/game/i18n.ts` 全部局内/引导/结算双语词条并修复 `hud_combo` 的 `{count}` / `{mult}` 参数插值与正则安全兜底；② 调整局内镜头海面上界（`minSurfaceCameraY = 40m`、`sharkY >= 46m`）并将 3 步新手引导条下沉至底部中央（摇杆与技能扇区之间），彻底消除顶部横幅遮挡游动鲨鱼；③ 为 Web 与 iOS 32 种猎物全面接入 5 类生物力学摆尾步态（`SKWarpGeometryGrid`）与 S 形波浪/脉冲喷射/受惊折线等非线性游动轨迹；④ 修复 iOS 视差背景水平与垂直分界线（新增 `processWaterLayerToSeamlessTile` 余弦去白底、地形底列延展接地 `groundBottomColumns`、10% 余弦水平无缝混合与整数像素无重叠平铺）；⑤ 升级进化图谱底部 48 阶鲨鱼选择器为连续浮点惯性弹簧转轮（`wheelPosition` + `predictedEndTranslation` + 机械刻度震动）；⑥ 100% 还原 iOS 吞噬特效（吸口牵引、鲨鱼 `biteAnim` 扑咬震屏、绿/金粘液气泡爆散、3D 翻转磁吸金币/基因掉落物与双语战斗飘字） | `scripts/build-ios-native.ts`, `src/game/i18n.ts`, `src/App.tsx`, `docs/02-DESIGN_SPEC.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-05 | 新增**鲨鱼成长驱动的远/中/近景光学分级缩小机制（`getParallaxLayerGrowthScales`）**：当鲨鱼变大（`relativePreyScale: 1.00 -> 0.40`）时，背景各层按真实光学景深距离耦合权重（`近景 0.70 : 远景鱼群 0.55 : 中景 0.45 : 远景 0.22 : 海面水幕 0.15`）分级缩小——近景海床缩小最多（`1.00x -> 0.58x`，`-42%`）、中景礁崖适中缩小（`1.00x -> 0.73x`，`-27%`）、远景山脉缩小最少（`1.00x -> 0.868x`，`-13.2%`），并采用视口中心归一化相位锚定（`normPhase`）与阻尼平滑过渡，确保升级变大时背景从屏幕中心丝滑后退、零横向跳变、零底边露底 | `src/game/rules.ts`, `src/game/parallaxBackground.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-03 | 升级 48 阶鲨鱼进化图集 `/public/assets/aistudio/sharks_ec921c3b.png` 为 **4K 超清版本（`4096×2286`）** 并重构 `src/game/spriteSheetManager.ts` 中的 `processAndSliceSharksImage`：① 将原本会误抠 `#01 拟态小丑幼鲨` 白色身体条纹并残留 4K 灰白抗锯齿毛边的全局色键（`createChromaKeyCanvas`）升级为「单元格四周边框 BFS 连通域泛洪 + 内部封闭纯白背景孔洞清理 + 多像素边界 Color-to-Alpha 白边解混（White Fringe Unmixing）」，100% 保留小丑幼鲨白条纹、鲨鱼白牙与眼白，同时彻底消除 4K 深色轮廓与发光光晕边缘白边；② 引入 `MAX_SHARK_SHEET_W = 2400` 高 DPI 超采样工作画布与预分配共享 `Uint8Array`/`Int32Array` 缓冲区，降低 70% 初始化耗时与 18 段脊柱实时切片采样带宽 | `public/assets/aistudio/sharks_ec921c3b.png`, `src/game/spriteSheetManager.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-03 | 替换暮光深海带（`bg_twilight_0_17bcb84c.png`、`bg_twilight_1_04f5d35f.png`、`bg_twilight_2_fd5a1b33.png`、`bg_twilight_3_6e0dd7c1.png`）与深渊海沟带（`bg_abyss_0_1bbf506a.png`、`bg_abyss_1_75e4a628.png`、`bg_abyss_2_6ce66695.png`、`bg_abyss_3_a4986280.png`）全部 8 张 21:9 超宽全景背景素材（`~1916×821`）：① 将全景条带识别阈值拓展至 `aspect > 1.8`（统一启用 `1440px` 地形工作分辨率与 `1024px` 宽屏水体纹理分辨率）；② 新增 `unmixHydrothermalSmokeSky` 天空连通域黑烟解混算法，将 `bg_abyss_2` / `bg_abyss_3` 上半区白底黑烟边缘解混为自然半透明深色热液烟羽，同时 100% 保护下半区红白巨型管虫；③ 按原生裁切比例标定暮光带（`30% / 37% / 42%`）与深渊带（`50% / 58% / 42%`）分层高度与远中近阶梯高程，并统一远景微视差（`0.025x`） | `src/game/parallaxBackground.ts`, `public/assets/aistudio/bg_twilight_*.png`, `public/assets/aistudio/bg_abyss_*.png`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-02 | 修复游到海平面时远景异常移动问题：① 将 `01_海水远景`（`shallow.water`）顶边恒定锚定在视口顶部 `y = 0`（横向视差压低至 `0.012x`、纵向视差 `<= 2px`），消除此前游向海平面时 `waterTopY` 以 `1.0x` 镜头速度将海水远景向下推落 `360px` 覆盖礁石的缺陷；② 将 `02_远处礁石`（`shallow.far`）横向视差降至 `0.025x`、纵向振幅降至 `2.5px`（几乎静止），保持 `远景海水 < 远处礁石 < 中景珊瑚礁 < 近景海床` 严格物理视差层级；③ 为局内镜头 `sim.camera.y` 增加海平面上界锚定 `minSurfaceCameraY`，使鲨鱼游向 `y = 0` 时在屏幕内真实上浮至顶部海面波光区，杜绝镜头穿出水面导致底部礁石随鲨鱼上浮；④ 移除 `src/App.tsx` 旧版世界空间 `1.0x` 速度海面双正弦白线与 `skySurfGrad` 矩形硬切边 | `src/game/parallaxBackground.ts`, `src/App.tsx`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-02 | 移除 `src/game/parallaxBackground.ts` 海平面天际线处由程序化二次贝塞尔曲线（`ctx.quadraticCurveTo`）绘制的双弧形远山/海岛剪影代码，保持海平面与浅海 4 层视差背景的纯净天际线衔接 | `src/game/parallaxBackground.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-02 | 适配全新 4 层超宽全景浅海区视差素材（`1916×267`、`1916×178`、`1916×175`、`1916×201`）：① 将超宽全景条带离屏工作分辨率提升至 `1440px` 并严格保持原生宽高比；② 新增 `processShallowWaterCanopyToSeamlessStrip` 对浅海表层波光与丁达尔光束层（`bg_shallow_0_water_0e65cb68.png`）执行 C1 连续余弦白底解混与底边无痕消融，并以 `36%` 视口高度锚定于海面；③ 对远景海底石拱门（`bg_shallow_1_far_8898229a.png`）、中景缤纷珊瑚礁（`bg_shallow_2_mid_b4e0d30a.png`）与近景白沙滩铁锚（`bg_shallow_3_near_96e92ee1.png`）开启石拱内孔/珊瑚枝隙智能镂空、左上切峰圆润化修补及底列锚定填充，按 `23.2% : 22.0% : 25.0%` 原生比例分层叠放并将远/中景底边自然收纳入近景实心沙床线之后（彻底消除纵向拉伸与底边条码伪影） | `src/game/parallaxBackground.ts`, `public/assets/aistudio/bg_shallow_*.png`, `docs/02-DESIGN_SPEC.md` |
| 2026-11-02 | 全面重构死亡复苏与狩猎结算界面（`gameState === 'gameover'`）及优化局内主界面 HUD 与暂停界面：① 将死亡后的两阶段界面（`reviveOffered === true` 深海陨落紧急复苏 + `reviveOffered === false` 狩猎结算）统一纳入 `980:688` 科幻金属装甲弹窗（`<UiSettingModalFrame variant="revive" \| "settlement" />`），顶部梯形铭牌动态修补去除暂停标并居中展示骷髅/奖杯徽章与发光标题，内嵌 `<UiSettingSharkCard />` 实时鲨鱼展台、三联复苏增益卡片 / 四维金属战报遥测格及平衡排布的八角科幻按钮（彻底消除旧版 3 枚胶囊按钮 2+1 孤行折行与横屏裁切问题）；② 将游戏主界面左上角头像框组件（`hud-avatar-data-bar`）整体尺寸等比缩小 30%（`w-[151px] sm:w-[178px] lg:w-[217px]`，内嵌预览缩略图 `29×20`），并将分数组件（`hud-telemetry-pill`）水平居中且上边缘精确对齐至头像框上边直线高度（`mt-[8.5px] sm:mt-0 sm:top-[15.5%]`）；③ 将暂停弹窗内 `<UiSettingSharkCard />` 高度缩短为容器内高 `23.5%` 并修复 `SETTING_BTN_RESTART` / `SETTING_BTN_MAIN_MENU` 图标提取与同行线性插值修补 | `src/App.tsx`, `src/components/UiAtlasIcon.tsx`, `src/game/spriteSheetManager.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-01 | 调整移动端优先首页（`gameState === 'title'`）布局与水平转身动画：将头像名称及数据模块（`title-avatar-data-bar`）移至首页左上角，并将首页头像模块（`w-[203px] sm:w-[245px] md:w-[273px]`）与三枚主操作横幅按钮（立即潜入深海 / 进化 / 试驾机甲利维坦，`w-[154px] sm:w-[140~144px] md:w-[157~162px]`）整体尺寸等比缩小 30%；移除按钮下方的离线 HTML 下载链接与底部操作提示文案；将游戏主标题上移至左上角头像栏下方，将三枚主操作按钮下移锚定至屏幕底部，将镜头中心对准主角鲨鱼（`sim.camera.x = shark.x, sim.camera.y = shark.y`），并在首页巡游中同步启用局内优化过的 **2.5D 透视水平甩尾掉头与流体力学 C 形脊柱转弯动画**（彻底告别首页竖直 90° 抬头/低头转圈） | `src/App.tsx`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-01 | 接入 `public/assets/aistudio/setting_83a7a273.png` 暂停弹窗 9 合 1 图集，按 `setting1_40eadc35.png` 布局重构暂停界面（`<UiSettingModalFrame />` + `<UiSettingSharkCard />` + 7 枚定制八角按钮 `<UiSettingButton />`） | `public/assets/aistudio/setting_83a7a273.png`, `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-01 | 接入 `public/assets/aistudio/buttons_16e3a0cf.png`（科幻中空头像数据栏 `UI_PLATE_AVATAR_BAR` 与绿/蓝/金三色横幅按钮 `UI_BAR_BTN_GREEN` / `UI_BAR_BTN_BLUE` / `UI_BAR_BTN_GOLD`），替换首页顶部头像数据栏与 3 枚主按钮、游戏内左上角头像与血条/能量条组件，以及结算界面操作按钮 | `public/assets/aistudio/buttons_16e3a0cf.png`, `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-11-06 | **结算/暂停界面鲨鱼头像框 5-Slice 加宽包裹修复 + iOS 进化转轮 120Hz 丝滑对齐 Web**：① 将 `SETTING_SHARK_CARD`（`src/game/spriteSheetManager.ts` 与 `scripts/build-ios-native.ts`）从原本不拉伸左侧方框的 3-Slice 升级为 **5-Slice 分段水平拓宽**（将左侧凹陷头像框中部均匀区 `0.085..0.175 * bw` 同步横向拓宽 `+0.50~0.54 * bh`），使左侧头像框成为宽幅圆角矩形视窗，并将 `UiSettingSharkCard` / `UiSettingSharkCardView` 中的鲨鱼缩略图 100% 居中包裹在凹陷框内（消除此前头像框过窄且鲨鱼右半身溢出的问题）；② 修复 iOS `EvolutionAtlasSheetView` 中 `ForEach` 视图 Identity 抖动（改为固定虚拟槽位 `id: rawIdx`）、移除子节点 `.onTapGesture` 手势竞争、并在进化界面打开期间冻结后台 `OceanGameScene.update` 高频 `@Published` 广播，达成与 Web 100% 同等丝滑的转盘体验 | `src/game/spriteSheetManager.ts`, `src/components/UiAtlasIcon.tsx`, `src/App.tsx`, `scripts/build-ios-native.ts`, `docs/02-DESIGN_SPEC.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-06 | **iPhone 闹钟级（`UIPickerView`）进化转轮物理手感 + iOS 背景黑线与首次下潜卡顿修复 + 猎物游动动画收敛对齐鲨鱼**：① 进化页转盘（`SharkEvolutionAtlasModal.tsx` & iOS `EvolutionAtlasSheetView`）升级为 1:1 复刻 iOS 原生闹钟时间滚轮（`UIPickerView`）物理引擎（采用 UIKit 标准指数减速率 $d = 0.9978/\text{ms}$ 即 $\lambda = 2.20\text{ s}^{-1}$、`46~48px/slot` 齿距、`32~95ms` 滑动窗口回归测速、连续同向快拨动量叠加 `0.68x`、慢拖过齿磁吸驻留感、两阶段“指数滑行 + 末端 `0.26` 格过阻尼磁吸落锁”及 `playWheelDetentTick` 机械棘轮音效/触感反馈）；② 修复 iOS `addTiledStrip` 因 `tileW + 2.0` 重叠导致的半透明背景层双倍 Alpha 叠加中央竖向黑线，改为物理像素网格精确对齐（`x0 -> x1` 零重叠零缝隙）与各层水平相位错峰（`phaseOffset`）；③ 在 `SpriteAtlasManager.preloadAllIfNeeded()` 启动阶段预加载并调用 `SKTexture.preload` 预热全部 12 张浅海/暮光/深渊背景纹理，配合 `OceanGameScene` 的 32 节点复用池（`parallaxTilePool`），彻底消除首次下潜进入暮光/深渊带时的解码与渲染卡顿；④ 收敛全平台猎物脊柱波动包络（统一采用与鲨鱼一致的前躯稳定、后尾单波推进包络 `0.015*u + 0.985*u^2.25` 与温和摆幅）及水平巡航俯仰角 | `src/components/SharkEvolutionAtlasModal.tsx`, `src/game/audio.ts`, `src/game/canvasRenderer.ts`, `src/App.tsx`, `scripts/build-ios-native.ts`, `docs/02-DESIGN_SPEC.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-06 | **松开摇杆原地悬停 + 进化界面连续惯性转轮升级**：① 当玩家未拨动摇杆/未按方向键且未按住冲刺时（`inputMag <= 0.08 && !isBoosting`），鲨鱼速度归零并保持原地呼吸悬停（不再沿上一方向继续滑行）；② `SharkEvolutionAtlasModal.tsx` 底部 48 阶弧形圆盘升级为连续浮点转轮（`wheelPos`）与 60FPS 物理惯性滑行 + 临界阻尼弹簧落位（支持任意幅度拖拽、快速甩动惯性滑过多个槽位及点击平滑旋转） | `src/App.tsx`, `src/components/SharkEvolutionAtlasModal.tsx`, `scripts/build-ios-native.ts`, `docs/02-DESIGN_SPEC.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-10-31 | 按调参结论将默认「鱼群刷新数量」固化为 `20`、默认「猎物显示大小」固化为 `0.80x`，隐藏标题页与局内 HUD 的 `🛠 调参` 按钮（`showDebugPanel = false` + `hidden`），同时完整保留实时调参面板与控制器代码功能 | `src/App.tsx`, `src/game/rules.ts`, `src/game/ecosystemSpawner.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-31 | 新增实时调参 Debug 悬浮面板（`live-debug-panel`）：支持在标题页与局内实时滑动调节「1. 鱼群刷新数量（`4~80`）」与「2. 猎物显示大小倍率（`0.35x~2.50x`）」，内置多指触控绑定与指针事件冒泡隔离 | `src/App.tsx`, `src/game/rules.ts`, `src/game/ecosystemSpawner.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-31 | 修正前/中/后景相对运动方向与海床锚定纵向视差（`computeBiomeVerticalOffsets`）：消除此前因 `nearDrift` 在生态带中段（`240m`/`760m`/`1380m`）以下被 `Math.max(0, delta)` 截断归零导致的“下潜时前景静止而中景上移（相对运动方向反转）”缺陷；改为以各生态带海床底部（`680m`/`1340m`/`2100m`）为统一锚点，共享单调高度曲线 `u = Math.tanh(Math.max(0, biomeFloorY - midWorldY) / 480)` 并按 `远景 8px : 鱼群 12px : 中景 16px : 近景 28px`（`1 : 1.5 : 2 : 3.5`）严格递增分配纵向振幅，同时将海床巨藻/海鞭横向视差锁定至近景海床（`0.38x`）消除根部滑移 | `src/game/parallaxBackground.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-30 | 全链路 60FPS 性能优化：新增 `WeakMap` 预烘焙着色精灵缓存（`getPrebakedTintedFrame`，彻底消除黄金狂暴/变异鱼每帧数百次切片级 `ctx.filter` 重绘）、脊柱切片仿射逆矩阵直驱（移除内层 `ctx.save/restore`）、13 张背景大图分帧异步预处理队列（`enqueueProcessingTask`）与 640px 降采样、移除每帧 `getBoundingClientRect()` 强制重排，以及海面波浪/温跃层/掉落物视锥体裁剪 | `src/game/canvasRenderer.ts`, `src/game/parallaxBackground.ts`, `src/game/spriteSheetManager.ts`, `src/App.tsx`, `src/components/SharkFormCanvasPreview.tsx`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-10-30 | 全面接入 **13 张 AI 分层手绘背景与氛围精灵图集（`bg_{shallow\|twilight\|abyss}_{0_water\|1_far\|2_mid\|3_near}_*.png` + `bg_ambient_sprites_0c6882ce.png`）**，并在 `parallaxBackground.ts` 中实现离屏 BFS 连通域智能抠图（兼容白底/洋红底与颅骨内孔镂空、保护内部白珍珠/白管虫、柔化 `shallow_1_far` 水平分界线）、上下空白边自动裁切（去除 `abyss_3_near` 底部白条）、14% 余弦交叠水平无缝拼接及 8 类海洋氛围精灵（沙丁鱼风暴、蝶鱼群、蝠鲼、发光水母、摇曳巨藻、荧光海鞭、气泡串、灯笼鱼群）实时动画合成 | `src/game/parallaxBackground.ts`, `public/assets/aistudio/bg_*.png`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-10-30 | 将传统静态单层贴图背景升级为**五层连续水深与三平面真视差海洋环境引擎（`parallaxBackground.ts`）**：包含世界空间连续水深光谱渐变（`sampleBathymetricWaterColor`）、晴空海平线远岛与太阳光晕、远/中/近（`0.13x`/`0.27x`/`0.48x`）三平面周期无镜像视差地形与纵向深度位移、实时摇曳海藻森林、双频丁达尔体积光束与水面焦散光网、远景氛围鱼群剪影、三态深海微粒以及自然温跃层折光波带 | `src/game/parallaxBackground.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-10-30 | 新增**流体力学 C 形脊柱转弯（`turnBend` 头领尾随 C 弧变形 + 转向尾鳍增推）**、**2.5D 透视缩进翻转（`facingScaleX` 平滑插值 + `horizonPitch` 连续仰角，零单帧镜像跳变）**与**水平急转甩尾物理机制（跨左右半球掉头直接水平甩尾，告别机械竖直绕圈）**；将脊柱摆尾渲染器升级为**连续仿射斜切丝带算法 (`ctx.transform(1, shearY, 0, 1, 0, 0)` + 24 段高密自适应切片)** | `src/game/canvasRenderer.ts`, `src/App.tsx`, `src/components/SharkFormCanvasPreview.tsx`, `src/game/rules.test.ts`, `docs/02-DESIGN_SPEC.md`, `docs/01-ARCHITECTURE.md` |
| 2026-10-29 | **移除局内空投补给按钮**；将右下角技能与强化圆章重构为围绕【冲刺】主按钮的 **90° 极坐标扇形环绕布局（`.hud-skill-fan-container`）**；优化左下角虚拟摇杆自适应内缩（`.hud-joystick-ergonomic`，基于 `clamp()` 与 `safe-area-inset` 向右上舒适区偏移，零写死坐标、全屏零遮挡零叠放） | `src/App.tsx`, `src/index.css`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-29 | 全面执行**「去线框套线框（De-Boxed Frameless UI）」视觉重构**、**48 阶鲨鱼名称纵向高度 100% 恒定对齐（0px 跳动）**与**全分辨率零 UI 叠放修复**：将未解锁前置鲨鱼名称独立为整行宽度（`h-[50px]` 双行定高槽位），拉大底部 180° 弧形罗盘节点间距与纵深留白，重构局内顶部 HUD 为双行零挤压布局，彻底消除小屏/横屏/长英文名下的任何文字或图标叠放 | `src/components/SharkEvolutionAtlasModal.tsx`, `src/App.tsx`, `src/index.css`, `src/game/sharkEvolutionConfig.ts`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-28 | 新增 **15 秒 3 步实操新手引导（含新手补给礼包与按钮聚光灯）** 与 **HUD 圆章 2 字融合功能标签（`图谱`/`强化`/`进化`/`补给`/`狂暴`/`突破`/`冲刺`）**；移除鱼类外圈与 `T{N}` 文字，完全依托视觉体型判强弱；修复 iPhone 14 Pro Max Safari 画面纵向拉伸 Bug | `src/App.tsx`, `src/game/ecosystemSpawner.ts`, `src/game/canvasRenderer.ts`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/index.css` |
| 2026-10-27 | 接入 `icons_f5128c12.png` 24 枚定制游戏 UI 图集，全面重构为“无框头像框 + 单行悬浮遥测胶囊 + 声呐摇杆 + MOBA 扇形技能圆章”极简 HUD（视野留白率提升至 90%+） | `src/App.tsx`, `src/components/UiAtlasIcon.tsx`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts` |
| 2026-10-26 | 建立 48 阶精灵渲染规范、视觉体型===吞噬判定铁律及移动端多点触控（`bindMultiTouchButton` + 零重渲染摇杆）设计规范 | `src/App.tsx`, `src/game/canvasRenderer.ts`, `src/game/spriteSheetManager.ts` |
