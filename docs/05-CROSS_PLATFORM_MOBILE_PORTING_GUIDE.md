# 05. 移动端与跨平台原生移植避坑指南 (Cross-Platform Mobile Porting & Pitfalls Guide)

> **文档状态**：生效中（Active）
> **最后更新**：2026-11-05
> **适用范围**：将本项目（Web Canvas 2D + React 基準实现）移植/打包至 **纯原生 iOS (SwiftUI + SpriteKit Metal)**、**纯原生 Android (Jetpack Compose + OpenGL/Canvas)**、**鸿蒙 HarmonyOS NEXT (ArkUI + XComponent)**、**微信小游戏 / 抖音小游戏** 或 **Unity / Cocos / Flutter** 等其他平台时的强制工程核查清单。

---

## 1. 背景与核心原则

在将《深海饥饿鲨：48阶基因进化》从 Web 端移植到纯原生 iOS（`scripts/build-ios-native.ts` $\to$ `ios-native/`）并进行真机实测的过程中，我们先后攻克了 **UI 精灵图集实时去底与九宫格/三宫格重构、多语言占位符泄露、横屏窄视口字幕遮挡主角、视差背景白边与接缝分界线、猎物呆板直线移动与缺帧、进化罗盘生硬跳格、吞噬打击感特效缺失** 等 **10 大典型跨平台失真问题**。

为避免后续向 Android、HarmonyOS、小程序或桌面端移植时重复踩坑，特将所有问题的**现象、根本原因（Root Cause）、标准算法方案与跨平台验收清单**沉淀为本规范。

---

## 2. 移动端真机移植十大典型问题与根治方案总表

| 序号 | 问题分类 | 真机实测现象 | 根本原因 (Root Cause) | 根治方案 (Standard Solution) |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **UI 素材还原** | 首页按钮、摇杆、冲刺键、暂停框退化为系统自带圆角矩形/胶囊框，丧失机甲深海美术质感 | 移植时图省事使用了目标平台的原生矢量绘制（`RoundedRectangle` / `Capsule`），未移植 `spriteSheetManager.ts` 的离屏像素级抠图与切片管线 | 必须在目标平台实现同等像素级图集处理器（如 iOS `CGContext`），完整执行 **BFS 去底、内孔镂空（头像圆窗/摇杆环）、三宫格拉宽与扫描线去字修补** |
| **02** | **多语言与模板变量** | 屏幕出现 `{count}连击 ({mult}x)`、`hud_heat_lv3`、`onboard_step2_title`、`hud_mobile_boost` 等原始代码字符串 | ① 新增的移动端专属 Key 未同步写入 `src/game/i18n.ts` 双语词典；② 调用翻译函数 `t("hud_combo")` 时漏传参数字典；③ 翻译函数无未替换占位符兜底清洗 | ① 所有 UI 文案严禁硬编码，统一写入 `i18n.ts`；② 调用含 `{var}` 的词条必须传齐参数；③ `t(key, params)` 末尾增加正则兜底清除残留 `\{[a-zA-Z0-9_]+\}` |
| **03** | **文本换行截断** | 左上角血条状态文字 `"FRENZY"` 在手机上断行显示为 `"FRENZ\nY"`，冲刺按钮文字挤出胶囊外 | 移动端字体度量（如 iOS SF Pro）比桌面端略宽，固定宽度容器内未设置单行约束与字号自适应缩放 | 所有 HUD 徽章、进度条内嵌文字与按钮标签必须强制绑定 **单行不换行 + 最小字号缩放**（SwiftUI: `.lineLimit(1).minimumScaleFactor(0.72)`） |
| **04** | **HUD 字幕遮挡主角** | 连击横幅、狂暴横幅与新手引导条垂直堆叠在屏幕上半部正中央，鲨鱼上浮时被字幕完全盖住 | 手机横屏物理高度极小（如 iPhone 逻辑高度仅 `390pt ~ 430pt`），顶部 HUD 叠加 3 层横幅会直接侵占屏幕中心 `35% ~ 55%` 的主视野区 | ① **镜头海面上界下压**：将 `minSurfaceCameraY` 设为 `40m`、鲨鱼最小深度 `sharkY >= 46m`；② **新手引导底部居中下沉**：引导胶囊移至底栏左摇杆与右技能扇区之间的底部安全区；③ 连击条缩窄为 `10pt` 紧凑胶囊并开启 `allowsHitTesting(false)` |
| **05** | **背景水平/垂直分界线** | 手机背景出现刺眼的白色水平断层线、顶部右侧白边、以及平铺接缝处的垂直亮线/暗线 | ① 表层海水图 `bg_shallow_0_water` 直接原图渲染，底部 `#FFFFFF` 白色渐变未解混为 Alpha 透明度，且右侧存在 `3px` 原图白边；② 远景礁石底部被透明洞截断出现悬空横线；③ 平铺瓦片 `width: tileW + 1.5` 导致半透明图层重叠 `1.5pt` 产生垂直双倍 Alpha 亮线 | ① **海水层余弦 Alpha 解混**：裁去右/上/下白边，按 $v \in [0.22, 1.0]$ 余弦包络将底部白底反算为平滑透明度；② **地形列向下延展接地（`groundBottomColumns`）**：将每列最低实心像素向下延伸至底边消除底部水平缝；③ **10%~14% 余弦水平无缝混合 + 整数像素对齐平铺（`ceil(tileW)` + `floor(startX)`）**，严禁半透明瓦片重叠 |
| **06** | **猎物游动僵硬走直线** | 猎物像木板一样僵硬地沿水平直线平移，没有鱼尾摆动，也没有自然的游动轨迹 | 移植时仅写了 `x += vx * dt` 和极微弱的正弦 `y` 偏移，漏掉了 5 大生物族群脊柱波网格变形（Mesh Warp）与非线性巡航轨迹状态机 | ① **网格变形步态**：按 `CARANGIFORM`、`ANGUILLIFORM`、`MEDUSOID_JET`、`PUFFER_BUOYANT`、`RIGID_PROPULSION` 5 类步态实时更新 `SKWarpGeometryGrid`（注意猎物素材朝左，`u=0` 为鱼吻、`u=1` 为鱼尾）；② **非线性巡航与逃逸轨迹**：引入 S 形巡航深度锚点、水母脉冲喷射、河豚受惊膨胀与受惊摆尾折线逃逸，并按速度矢量计算俯仰角 `pitchAngle` |
| **07** | **进化列表跳格卡顿** | 进化图谱底部的鲨鱼选择器只能点击或松手后生硬跳一格（`-1 / +1`），缺乏丝滑转轮手感 | 将鲨鱼索引存储为离散整数 `inspectedIndex: Int`，拖拽过程中没有连续浮点位移映射，也没有松手速度惯性与弹簧吸附 | 采用 **连续浮点转轮位置 `wheelPosition: Double`**：拖拽时实时映射 `startPos - translation.width / 56.0`，驱动弧形槽位 `[-4..+4]` 的角度、缩放、径向倾角与透明度连续插值；每跨过整数格触发 `UISelectionFeedbackGenerator` 机械刻度震动；松手基于 `predictedEndTranslation` 预测惯性落点并以 `.interpolatingSpring(stiffness: 170, damping: 22)` 丝滑回弹吸附 |
| **08** | **吞噬特效与反馈缺失** | 鲨鱼吃鱼时猎物直接凭空消失，没有张嘴扑咬、没有爆浆粒子、没有金币基因飞入、也没有连击飘字 | 原生移植第一版只迁移了数值加分与数组移除，遗漏了吞噬前吸口牵引（Jaw Suction）与吞噬瞬间的多维视觉反馈管线 | 完整复刻 **五位一体吞噬反馈**：① 鱼嘴前方 `suctionRadius` 吸口牵引；② 鲨鱼 `biteAnim` 前冲扑咬放大 + 镜头创伤震屏 `cameraShakeTrauma`；③ 爆出扩散冲击波环 + `10~22` 颗翠绿/青蓝/鎏金粘液气泡粒子；④ 爆出 3D 旋转翻转金币/基因结晶并受磁力加速吸入鲨鱼口中；⑤ 弹出双语缩放飘字（`一口吞噬! +120 · x5🔥` / `💥 破甲粉碎!`） |
| **09** | **多指触控互斥断触** | 左手按住左下角摇杆游动时，右手点击右下角强化/冲刺/技能无反应，或松开右手时打断左手摇杆 | ① Web 端在 `pointermove` 中触发 React `setState` 导致 120Hz 重渲染吞掉点击；② 第一根手指按住 `touch-none` 时浏览器不派发第二根手指的 `onClick`；③ 多指未按 `pointerId` 隔离 | ① 摇杆移动严禁触发 UI 框架重渲染；② Web 端按钮必须使用 `bindMultiTouchButton`（`onPointerDown` + `onTouchStart`），原生端将摇杆与右侧技能扇区作为独立手势视图隔离；③ 严格按 `pointerId` / `UITouch` 隔离摇杆、画布与冲刺通道 |
| **10** | **视觉体型与判定脱节** | 屏幕上看起来比鲨鱼小的鱼咬伤玩家，或者开启黄金狂暴时全屏巨兽突然缩成小鱼苗 | 渲染层与碰撞检测层各自乘了不同的缩放系数，或计算猎物视觉尺寸时错误传入了临时满阶的 `biteTier` 而非常态 `normalBiteTier` | 严格遵守 **Visual Size === Edible Rule**：所有平台渲染猎物尺寸与计算碰撞半径必须共享唯一纯函数 `getPreyRelativeVisualScale(prey, sharkStats, mutation)`（固定基于 `normalBiteTier`），保证可吞噬猎物恒 `<= 64%` 鲨鱼尺寸，危险巨兽恒 `>= 118%` 鲨鱼尺寸 |

---

## 3. 核心技术专题深度拆解（供跨平台复刻参考）

### 3.1 专题一：五层海底视差背景「零分界线」图像预处理算法
本项目的 13 张海底视差背景图由 AI 绘图生成，直接作为纹理平铺到移动端 GPU（Metal / OpenGL / WebGL）会出现 **3 类分界线伪影**。任何平台在加载背景纹理时，必须在离屏缓冲区（Offscreen Bitmap / CGContext）按顺序执行以下 5 步预处理：

1. **原图脏边裁剪（Margin Cropping）**：
   - `bg_shallow_0_water_0e65cb68.png`：裁剪左/上/右各 `4px`、底部 `6px` 原始白边。
   - `bg_shallow_1_far_8898229a.png`：仅保留顶部至 `91.5%` 高度（`cropBottomRatio = 0.915`），裁去底部透明条码噪点；并清除左上角 `x ∈ [0, 14%], y ∈ [0, 22%]` 的悬空礁石碎块，对 `x ∈ [0, 25%]` 的平顶山峰施加半圆弧度修整。
   - `bg_shallow_2_mid_b4e0d30a.png`：保留顶部至 `93.5%` 高度（`cropBottomRatio = 0.935`）。
2. **表层海水（Water Canopy）底边 `#FFFFFF` 余弦反混色（Color-to-Alpha Unmixing）**：
   - `bg_shallow_0_water` 底部原本是向纯白（`#FFFFFF`）过渡的渐变，若直接贴图会在海面下方形成一条横贯全屏的白色硬边。
   - 对高度归一化坐标 $v = y / (H - 1)$，计算余弦垂直包络：
     $$\text{vFade} = \begin{cases} 1.0, & v \le 0.22 \\ 0.5 + 0.5 \cos\left(\pi \cdot \frac{v - 0.22}{0.78}\right), & v > 0.22 \end{cases}$$
   - 对每个像素 $(R, G, B)$，记 $m = \min(R, G, B)$，计算去白底透明度：
     $$\alpha_{\text{unmix}} = \begin{cases} 1.0, & m \le 215 \\ \max\left(0,\ \frac{252 - m}{37}\right), & m > 215 \end{cases}$$
   - 最终像素 Alpha 为 $\alpha = \text{round}(255 \cdot \alpha_{\text{unmix}} \cdot \text{vFade})$，并将 RGB 从白色分量中解混还原为纯正深海蓝青色，从而与底层水深光谱背景实现 100% 无痕融合。
3. **地形层（Far / Mid / Near）BFS 连通域抠图 + 石拱门内孔穿透 + 2px 白边去溢色**：
   - 从图像顶边（及 `bg_abyss_3` 底边）向内对纯白/浅灰背景或 `#FF00FF` 洋红底色执行 BFS 泛洪透明化（保护礁石内部的白色珍珠和红白管虫）。
   - 对 `bg_shallow_1_far` 与 `bg_shallow_2_mid` 中间区域（$y \in [0.12H, 0.86H]$）被礁石包围的封闭纯白孔洞（亮度 $>240$ 且饱和度 $<18$）执行内孔穿透，让后方海水自然透出。
   - 对距离透明像素 `1~2px` 的边缘像素执行 `Color-to-Alpha` 反混色，彻底消除白边光晕。
4. **地形底列向下延展接地（`groundBottomColumns`）—— 消除层间水平黑缝**：
   - 远景、中景、近景叠放时，若某一列底部存在透明缺口，会在礁石下方露出一条水平方向的断层线。
   - 逐列向上扫描找到该列最底部的实心像素 `bottomSolidY`（$\alpha > 180$），将其颜色与不透明度一路向下复制填满至图像最底行 `H - 1`。
5. **10%~14% 余弦水平循环无缝混合（`makeHorizontallySeamlessImage`）+ 整数像素无重叠平铺**：
   - 将图像首尾 `seamW = round(W * 0.14)` 区域按余弦权重 $w(t) = 0.5 - 0.5\cos(\pi t)$ 交叉混合，生成宽度为 $W - \text{seamW}$ 的周期无缝纹理。
   - **渲染平铺铁律**：在 GPU 渲染平铺条带（`addTiledStrip`）时，瓦片宽度必须向上取整 `tileW = ceil(...)`，起始坐标向下取整 `startX = floor(...)`，且相邻瓦片严格按 `startX += tileW` 步进。**严禁对半透明图层（如 `alpha = 0.90` 的海面光束层）设置 `width: tileW + 1.5` 重叠**，否则重叠的 `1.5pt` 接缝处会因为 Alpha 叠加两次而出现每隔 `tileW` 一道的垂直分界线！

---

### 3.2 专题二：猎物生物力学游动动画与非线性轨迹规范
移植到任何平台时，猎物绝不能只写刚体平移：
1. **注意精灵图朝向差异（关键坑点！）**：
   - 玩家鲨鱼图集（`sharks_ec921c3b.png`）默认**鱼头朝右**（纹理坐标 $u = 0$ 为尾鳍，$u = 1$ 为鱼吻，故鲨鱼摆尾幅度包络随 `tailProgress = 1.0 - u` 递增）。
   - 猎物鱼类图集（`fish_24bdaa5a.png` / `fish2_fc857cfa.png`）默认**鱼头朝左**（纹理坐标 $u = 0$ 为鱼吻，$u = 1$ 为尾鳍，故猎物摆尾幅度包络随 `tailProgress = u` 递增，且向右游 `vx >= 0` 时设置 `xScale = -1`）。
2. **非线性巡航与反应式轨迹**：
   - 每只猎物出生时分配独立的巡航基准深度 `cruiseDepthCenter`、纵向振幅 `cruiseAmpY ∈ [36, 92]` 与频率 `cruiseFreq ∈ [0.72, 1.35]`。
   - 常态巡航时通过弹簧恢复力 `(targetY - y) * 1.4` 叠加高频尾鳍偏航分量，走出自然的 S 形波浪/8 字形轨迹；水母/乌贼（`MEDUSOID_JET`）采用 $\sin^2$ 脉冲喷射与伞盖呼吸缩放；可吞噬鱼群（`SCHOOL_FLEE`）在鲨鱼靠近 `< 250m` 时触发带正弦摆动的折线加速逃逸。

---

### 3.3 专题三：48 阶进化图谱「丝滑转轮」物理手感实现规范
进化界面的 48 阶鲨鱼弧形选择器在任何平台上都必须实现 **60/120Hz 连续跟手旋转 + 动量惯性 + 弹簧吸附**：
1. **状态分离**：
   - `wheelPosition: Double`（连续浮点位置，控制弧形转轮上所有可见鲨鱼的实时几何变换）。
   - `inspectedIndex: Int`（当前对准弧顶中央的鲨鱼整数索引 `((Int(round(wheelPosition)) % 48) + 48) % 48`，实时刷新上方巨幕预览与右侧属性面板）。
2. **连续弧面插值公式**：
   - 取 `baseInt = floor(wheelPosition)`，小数偏移 `frac = wheelPosition - baseInt`。
   - 遍历相对槽位 `k ∈ [-4, -3, -2, -1, 0, 1, 2, 3, 4]`，实际相对偏移 `relOffset = Double(k) - frac`。
   - 弧面角度 `angleDeg = relOffset * 20.5°`，水平位置 `xPct = 0.50 + sin(angleRad) * 0.44`，垂直位置 `yPct = 0.34 + (1 - cos(angleRad)) * 0.88`，连续缩放 `scale = max(0.46, 1.15 - |relOffset| * 0.19)`，径向微倾角 `rotation = angleDeg * 0.42°`。
3. **惯性预测与弹簧回弹**：
   - 手指滑动时：`wheelPosition = dragStartPos - translationX / 56.0`，每当 `round(wheelPosition)` 变化时触发一次轻触觉刻度反馈（iOS `UISelectionFeedbackGenerator().selectionChanged()` / Android `HapticFeedbackConstants.CLOCK_TICK`）。
   - 手指松开时：读取手势预测终点位移 `predictedEndTranslationX`（或松手瞬时速度 $v_x$），计算惯性目标格 `round(clamp(predictedPos, wheelPos - 6, wheelPos + 6))`，使用临界阻尼弹簧动画（`stiffness: 170, damping: 22`）平滑落位。

---

## 4. 新平台打包上线前 12 项必检清单 (Pre-Release QA Checklist)

未来打包至 **iOS / Android / HarmonyOS / 小游戏** 真机提审前，必须逐项打钩确认：

- [ ] **1. 原生图集抠图完备性**：首页三色横幅按钮、左上角镂空金属头像栏、左下角声呐摇杆底座与握把、右下角 90° 技能扇区圆章、暂停/复活/结算金属框与三宫格鲨鱼卡是否 100% 使用裁剪去底后的原版美术素材？
- [ ] **2. 多语言零漏翻与零 `{var}` 裸露**：切换中文/英文，检查首页、局内连击（触发 2 连击以上）、狩猎热度（Lv.1~3）、3 步新手引导、冲刺键底部文字、暂停窗、复活窗、结算窗、进化图谱，确认无任何 `hud_*`、`onboard_*` 或 `{count}`、`{mult}` 裸露。
- [ ] **3. 文本单行防折行**：在最窄手机横屏（如 `667×375`）下，左上角血条处于满血、濒危（`<28%`）、狂暴（`FRENZY`）三种状态时，文字是否均保持单行且无上下断行？
- [ ] **4. 中心视野零遮挡**：将鲨鱼游至海平面最顶端（`depth = 4m`）并同时触发连击、黄金狂暴与新手引导，确认所有 HUD 胶囊均未遮挡正在游动的鲨鱼本体。
- [ ] **5. 背景零分界线**：在阳光浅海、暮光带、深渊带上下左右游动，确认海面波光层底部无白色横线、右侧无白边、水平循环拼接处无垂直亮线/暗线、远中近礁石底部无悬空透明缝。
- [ ] **6. 猎物步态与轨迹**：观察小丑鱼、水母、电鳗、河豚、潜艇 5 类生物，确认鱼尾方向正确（鱼吻在前、尾鳍摆动在后）、游动轨迹呈自然波浪/脉冲曲线而非呆板直线。
- [ ] **7. 视觉体型 === 可吞噬性**：确认屏幕上所有比玩家鲨鱼小的鱼均可直接一口吞噬，所有比玩家鲨鱼大的鱼均不可常态直吞。
- [ ] **8. 吞噬五位一体特效**：确认靠近小鱼时有吸口牵引，吞噬瞬间有鲨鱼前扑张嘴动画、绿色/金色粘液气泡爆散、3D 翻转金币与基因结晶磁吸飞入、以及双语浮动加分飘字。
- [ ] **9. 进化转轮丝滑度**：打开进化图谱，慢速拖动与快速甩动底部弧形鲨鱼列表，确认转轮连续丝滑跟手、带机械刻度震动反馈与惯性弹簧吸附。
- [ ] **10. 双手多点触控**：左手大拇指按住摇杆持续画圈游动的同时，右手连续点击强化、突破、狂暴与按住冲刺，确认 100% 即时响应且绝不打断左手摇杆。
- [ ] **11. 跨语言数据模型字段与枚举值 100% 契约对齐**：代码生成器（如 `scripts/build-ios-native.ts`）中 `GameModels.swift` 定义的 `ComputedSharkStats` 属性名（如 `magnetRadius`、`jawSuctionMultiplier`）及 `PreyBehavior` 枚举分支（如 `.MINE_HAZARD`）与渲染层 `OceanGameScene.swift` 引用处必须 100% 严格一致，严禁手写臆造未定义的成员名（如 `magnetRadiusBonus` 或 `.MINE_STATIC`）。
- [ ] **12. 自动化测试与构建**：`npx tsx --test src/game/rules.test.ts`、`npm run lint`、`npm run build`（及对应平台构建脚本如 `npm run build:ios`）全部零错误通过。
- [ ] **13. 文档同步**：所有变更已同步更新至 `docs/01 ~ 05.md`。

---

## 5. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-11-06 | **松开摇杆原地悬停 + 进化圆盘丝滑拖拽惯性 + iOS 鲨鱼与猎物视觉比例放大对齐 Web**：① Web 与 iOS 双端在未拨动摇杆且未冲刺时（`mag <= 0.08 && !isBoosting`）鲨鱼保持原地呼吸悬停（`sharkVx = 0, sharkVy = 0`），不再维持原方向惯性游走；② 修复 iOS `EvolutionAtlasSheetView` 中圆盘节点 `Button` 拦截拖拽手势的问题（改用 `.onTapGesture` + 舞台级 `.simultaneousGesture(DragGesture)` + 60Hz `wheelPhysicsTimer` 惯性衰减与弹簧吸附），并在 Web `SharkEvolutionAtlasModal.tsx` 同步实装 60FPS 连续浮点惯性转轮；③ 修复 iOS `sliceAndKeyNormalizedCell` 未裁切鲨鱼/猎物透明白边及 `OceanGameScene.swift` 缺失 `sqrt(aspect)` 等面积宽高比公式导致鱼体偏小的问题，同时将 `sharkBaseDrawSize` 设为 `110.4`（`96 * 1.15`）使 iOS 鲨鱼与猎物同屏比例与 Web 端 1:1 对齐 | `src/App.tsx`, `src/components/SharkEvolutionAtlasModal.tsx`, `scripts/build-ios-native.ts`, `docs/02-DESIGN_SPEC.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-06 | **iOS 原生端 5 项体验与视效对齐 Web 端**：① 全平台鲨鱼与 33 种猎物基础游动速度下调 50%（`baseSharkSpeed = 140`，按住冲刺速度 `280` 等于原常态速度）；② 修复 iOS 猎物鱼头尾朝向与脊柱波动方向反转问题（原图集全部鱼类面朝右侧 `u = 1.0` 为鱼头、`u = 0.0` 为鱼尾，修正 `tailProgress = 1.0 - u` 且 `facingSign = vx >= 0 ? 1 : -1`）；③ 1:1 复刻 Web `parallaxBackground.ts` 跨深度带连续 Alpha 混合过渡（`420m~680m` 浅海↔暮光、`1040m~1340m` 暮光↔深渊），移除暮光/深渊水幕 `surfaceLift` 半屏抬升导致的屏幕中部水平断层线，并修复 HUD 深度显示系数；④ 补齐 iOS 海水泡泡系统（42 颗随深度自适应形态的环境上浮气泡/发光孢子/深渊余烬 + 鲨鱼游动/冲刺尾流气泡）；⑤ 补齐 iOS 黄金狂暴（Gold Frenzy）24K 流光金鲨鱼本体染色、全屏猎物鎏金转化与金色尾流粒子特效 | `src/game/config.ts`, `scripts/build-ios-native.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-06 | 修复 Xcode 编译时 `OceanGameScene.swift` 中 `ComputedSharkStats.magnetRadius`（原误写为 `magnetRadiusBonus`）与 `PreyBehavior.MINE_HAZARD`（原误写为 `.MINE_STATIC`）的字段/枚举名不匹配问题，并补充跨语言模型字段契约对齐检查项 | `scripts/build-ios-native.ts`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-05 | 首次创建《移动端与跨平台原生移植避坑指南》，系统总结 iOS 真机调试中发现的 10 大跨平台问题（UI 图集去底与切片、多语言 `{count}/{mult}` 占位符、HUD 遮挡主角、背景水平/垂直分界线、猎物生物力学步态与曲线轨迹、进化图谱连续惯性转轮、吞噬五位一体特效等）及 12 项上线必检清单 | `scripts/build-ios-native.ts`, `src/game/i18n.ts`, `src/App.tsx`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |

