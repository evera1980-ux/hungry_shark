# 03. 核心数值策划与系统公式圣经 (Game Balance & Numerical Design)

> **文档状态**：生效中（Active）
> **最后更新**：2026-11-16
> **关联约束**：修改 `src/game/rules.ts`、`src/game/sharkEvolutionConfig.ts`、`src/game/config.ts`、`src/game/preyDatabase140.ts` 或 `src/game/infiniteProgressionManager.ts` 中的任何数值参数或公式时，**必须在同一次提交中更新本文档对应的章节与表格**（参见 [`docs/00-AI_CONSTRAINTS.md`](./00-AI_CONSTRAINTS.md)）。

---

## 1. 双轨等级系统（`Lv`）计算规则

本游戏采用 **“局内吞噬成长等级（In-Run `Lv`）” + “跨局鲨鱼躯体强化等级（Body Upgrade `Lv.1 ~ Lv.10`）”** 的双轨制设计，兼顾单局爽快感与长期跨局养成积累：

### 1.1 局内吞噬等级 `Lv.X`（顶部状态栏深蓝色徽章 `Lv.1, Lv.2, ...`）
- **重置规则**：每局新下潜从 `Lv.1` 开始（若观看广告试驾 `#46 机甲利维坦` 则从 `Lv.5` 开局）。历史最高单局等级会永久记录在存档字段 `bestInRunLevel` 中，作为解锁高阶鲨鱼形态的门禁条件之一。
- **升级所需经验（XP）公式**（位于 `src/game/rules.ts` ➔ `getXpRequiredForLevel(level)`）：
  $$\text{XP}_{\text{req}}(L) = \begin{cases} 140, & L \le 1 \\ \text{round}\left(140 + (L - 1) \times 145 + (L - 1)^{1.75} \times 65\right), & L \ge 2 \end{cases}$$
- **前 10 级所需 XP 速查表**：
  | 当前局内等级 $L$ | 升至下一级所需 XP | 局内升级奖励 |
  | :---: | :---: | :--- |
  | `Lv.1 -> Lv.2` | `140` | 回满 38% 最大生命值 + 50% 冲刺能量 + 提升移速/生命上限/咬合阶位 |
  | `Lv.2 -> Lv.3` | `350` | 同上 |
  | `Lv.3 -> Lv.4` | `649` | 同上 |
  | `Lv.4 -> Lv.5` | `1,020` | 同上 |
  | `Lv.5 -> Lv.6` | `1,458` | 同上 |
  | `Lv.8 -> Lv.9` | `3,111` | 同上 |
  | `Lv.10 -> Lv.11` | `4,487` | 同上 |
- **局内等级 `Lv` 对属性的加成**（位于 `computeEvolvedSharkStats`）：
  - **基础生命值加成**：每升 1 级额外增加 `+(Lv - 1) * 18` 基础最大生命值（再乘以躯体强化倍率与图鉴收集倍率）。
  - **基础能量值加成**：每升 1 级额外增加 `+(Lv - 1) * 4` 冲刺能量上限。
  - **游动速度加成**：每升 1 级增加 `+(Lv - 1) * 1.4%` 基础移速。
  - **磁吸半径加成**：每升 1 级增加 `+(Lv - 1) * 10 px` 金币/基因吸附半径。
  - **咬合阶位 `T` 成长**：随着局内等级提升，自动增加局内咬合加成 `inRunBiteBonus`（详见第 2 节）。

### 1.2 跨局鲨鱼躯体强化等级 `Lv.1 ~ Lv.10`（左上角形态旁 `Lv.X` 与右下角 `⬆️ 强化躯体`）
- **持久化规则**：每只已解锁的鲨鱼形态都拥有独立的 `Lv.1 ~ Lv.10` 躯体强化等级，**永久保存在存档中，跨局绝不清零**。
- **消耗货币（金币高频强化 + 关键阶级基因突破）**：
  - **常规强化级（`Lv.1→2, 2→3, 3→4, 5→6, 6→7, 7→8, 8→9`）**：仅消耗**金币 `🪙`**（基因消耗为 `0`），并且基础金币消耗下调约 `15%`，指数调整为 `1.36`。
  - **咬合阶级突破级（`Lv.4 → Lv.5` 与 `Lv.9 → Lv.10`）**：这两级分别赋予该鲨鱼永久 **`+1 T` 咬合阶位突破**，除金币外还需消耗**基因碎片 `🧬`**（由 `getSharkUpgradeGeneCost(form, currentUpgradeLevel)` 计算：`Lv.4→5` 消耗 $\text{round}(\text{refGenes} \times 0.35 + 6)$，`Lv.9→10` 消耗 $\text{round}(\text{refGenes} \times 0.65 + 14)$）。
- **每级强化金币消耗公式**（位于 `src/game/sharkEvolutionConfig.ts` ➔ `getSharkUpgradeCost(form, currentLevel)`）：
  $$\text{Cost}_{\text{coin}}(L_{\text{upg}}) = \text{round}\left(\text{upgradeBaseCoinCost} \times 1.36^{(L_{\text{upg}} - 1)}\right)$$
- **每升 1 级躯体强化带来的永久属性提升**：
  - **最大生命值倍率**：`+8% / 级`（满级 `Lv.10` 为 `1.72x` 生命上限，且每次点击升级立即恢复 `25%` 最大生命值）。
  - **游动与冲刺移速**：`+2.2% / 级`（满级 `Lv.10` 为 `+19.8%` 移速）。
  - **饥饿掉血减免**：`+1.5% / 级`（满级 `Lv.10` 为 `-13.5%` 饥饿衰减）。
  - **冲刺耗能减免**：`+1.8% / 级`（满级 `Lv.10` 为 `-16.2%` 冲刺耗能）。
  - **咬合阶位 `T` 突破奖励（最多 `+3T`）**：
    - 强化达到 **`Lv.3`** 时：该鲨鱼永久获得 **`+1 咬合阶位 (T+1)`**！
    - 强化达到 **`Lv.6`** 时：该鲨鱼永久获得 **`+2 咬合阶位 (T+2)`**！
    - 强化达到 **`Lv.10`（满级）** 时：该鲨鱼永久获得 **`+3 咬合阶位 (T+3)`**！
  - **解锁下一阶鲨鱼的前置条件**：强化当前鲨鱼至指定等级（`Lv.2 ~ Lv.9`），是破茧进化解锁下一只鲨鱼形态的第一道门禁。

---

## 2. 咬合阶位（`T1 ~ T48`）计算规则与三级克制法则

`T`（Bite Tier，咬合阶位，显示为琥珀色徽章 `T1 ~ T48`）是决定**食物链吞噬关系**的核心指标。48 只进化鲨鱼（`#01 ~ #48`）一一对应 `T1 ~ T48` 基础咬合阶位；海洋中全部 134 种现役独立 `@3x` 海洋生物（`PREY-001 ~ PREY-210`）均匀细分至 `T1 ~ T48`（`T1 ~ T38` 每阶 3 种鱼，`T39 ~ T48` 每阶 2 种鱼，严禁使用旧图集 `fish_24bdaa5a.png` / `fish2_fc857cfa.png` 猎物）。

### 2.1 鲨鱼当前咬合阶位 `T` 的完整合成公式
位于 `src/game/rules.ts` ➔ `computeEvolvedSharkStats()`：

$$T_{\text{shark}} = \begin{cases} 48, & \text{若处于黄金狂暴状态 (Frenzy Active)} \\ \min\Big(48,\; \min\big(T_{\text{genMax}},\; T_{\text{base}} + \Delta T_{\text{upgrade}} + \Delta T_{\text{inRun}}\big)\Big), & \text{常规状态} \end{cases}$$

其中各项含义如下：
1. **形态基础咬合阶位 $T_{\text{base}}$（`form.baseBiteTier`）**：
   - 48 只鲨鱼按序号 `index = 0..47` 严格一一对应 $T_{\text{base}} = \text{index} + 1 \in [1, 48]$：
     - **第一代·幼体期 (`#01 ~ #08`)**：`T1 ~ T8`。
     - **第二代·猎手期 (`#09 ~ #16`)**：`T9 ~ T16`。
     - **第三代·装甲期 (`#17 ~ #24`)**：`T17 ~ T24`。
     - **第四代·霸主期 (`#25 ~ #32`)**：`T25 ~ T32`。
     - **第五代·泰坦期 (`#33 ~ #40`)**：`T33 ~ T40`。
     - **第六代·神明期 (`#41 ~ #48`)**：`T41 ~ T48`（且第六代深渊系与机甲系自带直接吞噬深水雷特权 `canEatMines = true`）。
2. **躯体强化咬合加成 $\Delta T_{\text{upgrade}}$（`upgradeBiteBonus`，最高 `+3T`）**：
   $$\Delta T_{\text{upgrade}} = \begin{cases} 3, & \text{当躯体强化等级 } L_{\text{upg}} = 10 \\ 2, & \text{当躯体强化等级 } 6 \le L_{\text{upg}} \le 9 \\ 1, & \text{当躯体强化等级 } 3 \le L_{\text{upg}} \le 5 \\ 0, & \text{当躯体强化等级 } 1 \le L_{\text{upg}} \le 2 \end{cases}$$
3. **局内等级咬合加成 $\Delta T_{\text{inRun}}$（`inRunBiteBonus`，最高 `+3T`）**：
   $$\Delta T_{\text{inRun}} = \begin{cases} 3, & L_{\text{inRun}} \ge 9 \\ 2, & 5 \le L_{\text{inRun}} \le 8 \\ 1, & 2 \le L_{\text{inRun}} \le 4 \\ 0, & L_{\text{inRun}} \le 1 \end{cases}$$
4. **单鲨鱼跨阶成长上限 $T_{\text{genMax}}$（`genMaxBiteTier`）**：
   $$T_{\text{genMax}} = \min(48,\; T_{\text{base}} + 6)$$
   - 每只鲨鱼通过局外躯体强化（`+3T`）与局内吞噬升级（`+3T`），最多可在其天生基础阶位 $T_{\text{base}}$ 上提升 **`+6 阶`**，支持满配鲨鱼跨代狩猎。

### 2.2 咬合阶位 `T` 的三级实战克制与碰撞判定规则
位于 `src/game/rules.ts` ➔ `resolvePreyEncounter()`：

设猎物的有效阶位为 $T_{\text{prey}}$（普通猎物为 `prey.tier`，若带有 `ABYSS_BEHEMOTH` 深渊巨兽变异词缀则为 $\min(50, \text{prey.tier} + 1)$）：

| 阶位对比条件 | 屏幕视觉体型表现 | 触碰结果 (`resolvePreyEncounter`) |
| :--- | :--- | :--- |
| **$T_{\text{shark}} \ge T_{\text{prey}}$**<br>（或处于黄金狂暴 `Frenzy`） | **猎物体型严格小于玩家鲨鱼**（`16% ~ 64%` 鲨鱼大小） | **直接一口吞噬 (`DEVOUR`)**：恢复生命值，获得 XP、分数、金币与基因碎片，叠加连击 `Combo` |
| **$T_{\text{shark}} + 1 \le T_{\text{prey}} \le T_{\text{shark}} + 3$**<br>且玩家**正在按住冲刺 (`isBoosting === true`)** | **猎物体型略大于玩家鲨鱼**（`118% ~ 130%` 鲨鱼大小，无外圈圆环） | **冲刺破甲撕咬 (`ARMOR_CRUSH`)**：按住冲刺直接咬穿护甲吞噬，爆出 **1.35 倍分数/经验/金币暴击奖励**（飘字 `破甲撕咬! / ARMOR CRUSH!`） |
| **$T_{\text{shark}} + 1 \le T_{\text{prey}} \le T_{\text{shark}} + 3$**<br>但玩家**未按冲刺 (`isBoosting === false`)** | **猎物体型略大于玩家鲨鱼**（`118% ~ 130%` 鲨鱼大小，无外圈圆环） | **未冲刺弹开 (`NEED_BOOST`)**：玩家受到 `0.85x` 阻尼反噬伤害并弹开（飘字提示 `冲刺可破甲! / BOOST TO CRUSH!`） |
| **$T_{\text{prey}} \ge T_{\text{shark}} + 4$**<br>（或触碰深水雷且无吞雷特权） | **猎物体型显著大于玩家鲨鱼**（`138% ~ 195%` 鲨鱼大小，无外圈圆环） | **致命天敌重创 (`DEADLY_PREDATOR`)**：即使按住冲刺也无法破甲，必须走位躲避（仅黄金狂暴可吞） |

---

## 3. 猎物屏幕相对体型动态算法 (`getPreyRelativeVisualScale`)

为了确保玩家在任何时候都能通过**“比我小的鱼一定能直接吃，略大于我的鱼可冲刺破甲，远大于我的巨兽必须躲避”**这一纯粹视觉体型直觉进行游戏，`src/game/rules.ts` 中的 `getPreyRelativeVisualScale()` 实施了严格的数学映射（猎物全身保持纯净自然渲染，不绘制任何人工外圈圆环）：

### 3.1 1:1 视觉等大基准线 (`sharkParityScale`)
- 玩家鲨鱼的基础绘制尺寸为 `SHARK_BASE_DRAW_SIZE = 96 px`，猎物半径转绘制尺寸系数为 `PREY_RADIUS_TO_DRAW_SIZE = 2.25`，因此鲨鱼等效半径为：
  $$R_{\text{sharkEq}} = \frac{96}{2.25} \approx 42.667$$
- 任意猎物在屏幕上与当前鲨鱼（缩放倍率为 $S_{\text{shark}}$）**视觉完全一样大（1:1 等大）**时的缩放系数为：
  $$\text{Scale}_{\text{parity}} = \frac{R_{\text{sharkEq}} \times S_{\text{shark}}}{\max(1,\; R_{\text{prey}})}$$

### 3.2 可直接吞噬猎物的体型缩小公式（严格 `<= 64%` 鲨鱼大小）
当 `canDevourNormally === true` 时：
1. **48阶平滑阶位差缩小因子**：阶位差 $\Delta T = \max(0, T_{\text{shark}} - T_{\text{prey}})$ 越大，该猎物按 `0.955` 指数平滑变小：
   $$\text{Ratio}_{\text{tier}} = \max\left(0.18,\; 0.64 \times 0.955^{\Delta T}\right)$$
2. **局内成长缩小因子**：随着局内等级 `Lv` 与代际提升，`relativePreyScale`（范围 `1.0 -> 0.40`）平滑下降：
   $$\text{Shrink}_{\text{level}} = 0.64 + 0.36 \times \text{relativePreyScale}$$
3. **最终相对鲨鱼尺寸比例**（严格限制在 `[0.16, 0.64]` 区间内）：
   $$\text{TargetRatio}_{\text{edible}} = \text{clamp}\left(\text{Ratio}_{\text{tier}} \times \text{Shrink}_{\text{level}},\; 0.16,\; 0.64\right)$$
   $$\text{VisualScale} = \text{Scale}_{\text{parity}} \times \text{TargetRatio}_{\text{edible}}$$

### 3.3 可破甲猎物（`+1T ~ +3T`）与致命天敌（`>= +4T`）的体型放大公式（严格 `>= 118%` 鲨鱼大小）
当常态下不可直接吞噬（`canDevourNormally === false`）时，设超阶数 $\Delta T_{\text{over}} = \max(1, T_{\text{prey}} - T_{\text{normalShark}})$：
- **可冲刺破甲档（$1 \le \Delta T_{\text{over}} \le 3$）**：基础比例为 $1.18 + (\Delta T_{\text{over}} - 1) \times 0.06$（即 `118% ~ 130%` 鲨鱼大小）；
- **致命天敌档（$\Delta T_{\text{over}} \ge 4$）**：基础比例为 $1.38 + (\Delta T_{\text{over}} - 4) \times 0.045$（上限钳制为 `195%` 鲨鱼大小）。
- **效果验证**：任何常态下不可直吞的猎物在屏幕上至少是玩家鲨鱼体型的 **1.18 倍**以上。

### 3.4 黄金狂暴阶段体型保持特例（Gold Frenzy Size-Preservation Exception）
- **设计初衷**：当玩家进入黄金狂暴（`frenzyActive === true`）时，虽然咬合能力临时跃升至最高阶 `T8`（可吞噬一切猎物与水雷），但如果此时把全屏原本巨大的潜艇、巨型电鳗与克苏鲁章鱼王缩小成小鱼，会严重削弱“黄金狂暴正面生吞庞然大物”的视觉冲击力与猎杀成就感。
- **实现规则**：`ComputedSharkStats` 始终保留鲨鱼进入黄金阶段前的真实常态咬合阶位 `normalBiteTier`；`getPreyRelativeVisualScale()` 与 `drawPreyEntity()` 在计算猎物屏幕尺寸时**固定使用 `normalBiteTier`（忽略 `frenzyActive`）**。
- **最终表现**：
  1. **常态下（`frenzyActive === false`）**：100% 遵守“小于自己即可吞、大于等于自己即受伤”的视觉铁律。
  2. **黄金狂暴期间（`frenzyActive === true` 特例）**：所有猎物**保持进入黄金阶段前的原始体型大小不变**（巨兽依然庞大，并环绕金色虚线盛宴光环与 `★T{N}` 标记），玩家操控金光鲨鱼直接撞碎并一口生吞比自己还大的深海巨兽！

### 3.5 鲨鱼成长驱动的远/中/近景光学分级缩小公式 (`getParallaxLayerGrowthScales`)
- **设计原理**：当鲨鱼变大时，如果仅缩小猎物而海底礁石、铁锚、珊瑚与沉船保持原尺寸不变，玩家缺乏海底环境参照物的尺度反馈。根据透视光学原理（镜头拉远 $\Delta d$ 时，角直径变化率与景深距离 $d$ 成反比），`src/game/rules.ts` 中的 `getParallaxLayerGrowthScales(relativePreyScale)` 将鲨鱼成长缩小量 $\Delta S = \text{clamp}(1 - \text{relativePreyScale},\; 0,\; 0.60)$ 按景深距离权重分配给各背景层：
  $$S_{\text{layer}} = 1 - w_{\text{layer}} \times \Delta S$$
- **各层缩小权重与满阶巨兽缩放比速查表**（远:中:近变小比率为 **`0.22 : 0.45 : 0.70` $\approx$ `1 : 2.05 : 3.18`**）：
  | 景深层级 | 对应函数字段 | 缩小权重 $w_{\text{layer}}$ | 初始幼鲨 (`relativePreyScale = 1.00`) | 中期成长 (`relativePreyScale = 0.68`) | 满阶巨兽 (`relativePreyScale = 0.40`) | 最大缩小幅度 |
  | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
  | **猎物参照层** | `relativePreyScale` | `1.00` | `1.000x` | `0.680x` | `0.400x` | **-60.0%** |
  | **近景海床层 (Near)** | `nearScale` | **`0.70`** | `1.000x` | `0.776x` | **`0.580x`** | **-42.0%** |
  | **远景氛围生物 (Ambient)** | `ambientScale` | **`0.55`** | `1.000x` | `0.824x` | **`0.670x`** | **-33.0%** |
  | **中景礁崖层 (Mid)** | `midScale` | **`0.45`** | `1.000x` | `0.856x` | **`0.730x`** | **-27.0%** |
  | **水体气泡微粒 (Particle)** | `particleScale` | **`0.45`** | `1.000x` | `0.856x` | **`0.730x`** | **-27.0%** |
  | **远景山脉/遗迹 (Far)** | `farScale` | **`0.22`** | `1.000x` | `0.930x` | **`0.868x`** | **-13.2%** |
  | **海面焦散光幕 (Water)** | `waterScale` | **`0.15`** | `1.000x` | `0.952x` | **`0.910x`** | **-9.0%** |

### 3.6 跨深度带景深错峰 $C^2$ 五次曲线与空间涌现过渡算法 (`computeParallaxBiomeTransitionState`)
- **设计原理**：为彻底消除下潜跨越 `520m`（阳光浅海 $\to$ 暮光深海）与 `1150m`（暮光深海 $\to$ 午夜深渊）时背景图“全层同步硬切/原地死板叠化”的突兀感，`src/game/rules.ts` 中的 `computeParallaxBiomeTransitionState(depthMeters)` 采用 **$C^2$ 五次平滑阶跃函数 + 光学景深平面错峰区间 + Porter-Duff 底层 Alpha 补偿 + 垂直空间涌现/沉降位移**：
  1. **$C^2$ 连续五次平滑阶跃 (`quinticSmoothstep(edge0, edge1, x)`)**：
     $$S_5(t) = 6t^5 - 15t^4 + 10t^3,\quad t = \text{clamp}\left(\frac{x - \text{edge}_0}{\text{edge}_1 - \text{edge}_0},\; 0,\; 1\right)$$
     保证在进入与离开过渡带的边界处一阶导数 $S_5'(0)=S_5'(1)=0$、二阶导数 $S_5''(0)=S_5''(1)=0$，消除线性插值的斜率折角。
  2. **光学景深错峰深度区间（远景先行浮现 $\to$ 中景跟进 $\to$ 近景海床收尾）**：
     | 生态带交界 | 水幕层 (`Water`) | 远景层 (`Far`) | 中景层 (`Mid`) | 近景海床 (`Near`) |
     | :--- | :---: | :---: | :---: | :---: |
     | **浅海 $\leftrightarrow$ 暮光 (`520m`)** | `290m ~ 770m` (`480m` 宽) | `320m ~ 730m` (`410m` 宽) | `390m ~ 720m` (`330m` 宽) | `445m ~ 705m` (`260m` 宽) |
     | **暮光 $\leftrightarrow$ 深渊 (`1150m`)** | `880m ~ 1420m` (`540m` 宽) | `920m ~ 1380m` (`460m` 宽) | `995m ~ 1355m` (`360m` 宽) | `1055m ~ 1335m` (`280m` 宽) |
  3. **Porter-Duff 底层覆盖补偿 (`compensateUnderLayerAlpha`)**：当两个半透明图层各自以 $0.5$ Alpha 叠加时，合成不透明度仅为 $1 - (1-0.5)^2 = 0.75$（造成过渡中段画面变暗漏底）。对被覆盖的旧生态带施加幂次包络补偿 $\alpha_{\text{under}} = \min(1, w^{0.62})$，使中段合成覆盖率维持在 $\sim 90\%+$。
  4. **非负垂直空间涌现与沉降位移 (`*TransitionOffsetY >= 0`)**：
     - 下潜时，新生态带从视口底边下方随进度向上升起（`OffsetY = (1 - t_in) * Span`），而旧生态带随进度向视口底边下方沉降（`OffsetY = (1 - w_out) * Span * 0.72`），其中 `Span` 按远/中/近景递增（`Far: 18~20px`、`Mid: 32~36px`、`Near: 48~54px`），且恒有 `OffsetY >= 0` 确保图层底边绝不脱离视口下沿。

---

## 4. 48 阶鲨鱼本体进化矩阵与三重门禁系统

### 4.1 6 代 × 8 列进化矩阵总览 (`src/game/sharkEvolutionConfig.ts`)

| 代际 (Generation) | 图谱行号 | 编号范围 | 基础咬合 $T_{\text{base}}$ | 进化阶段定位 | 解锁所需前置躯体等级 | 解锁所需历史最高局内 `Lv` | 解锁所需历史最深下潜 `m` |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **第一代·礁石幼体期** | Row 0 | `#01 ~ #08` | `T1 ~ T8` | 新手破局期（1~3 局解锁新形态） | `Lv.2 ~ Lv.4` | `Lv.1 ~ Lv.4` | `0m ~ 435m` |
| **第二代·远洋猎手期** | Row 1 | `#09 ~ #16` | `T9 ~ T16` | 进军暮光温跃层 | `Lv.4` | `Lv.4 ~ Lv.6` | `320m ~ 670m` |
| **第三代·重装异变期** | Row 2 | `#17 ~ #24` | `T17 ~ T24` | 装甲猎杀与中深海统治 | `Lv.5` | `Lv.7 ~ Lv.9` | `560m ~ 945m` |
| **第四代·深海霸主期** | Row 3 | `#25 ~ #32` | `T25 ~ T32` | 突破 850m~1270m 深渊交界（首阶为 `#25 远古霸主巨齿鲨`） | `Lv.6` | `Lv.10 ~ Lv.12` | `850m ~ 1270m` |
| **第五代·深渊泰坦期** | Row 4 | `#33 ~ #40` | `T33 ~ T40` | 猎杀大型远洋鲨与巨型海怪 | `Lv.8` | `Lv.13 ~ Lv.15` | `1180m ~ 1635m` |
| **第六代·创世神明期** | Row 5 | `#41 ~ #48` | `T41 ~ T48` | 终极神明形态（猎杀巨鲸霸主、可吞水雷） | `Lv.9` | `Lv.16 ~ Lv.18` | `1500m ~ 1990m` |

### 4.2 四大进化血统分支（Lineages）与专属特性乘数
每只鲨鱼归属于四大血统之一，在 `src/game/sharkEvolutionConfig.ts` 与 `src/game/rules.ts` (`computeEvolvedSharkStats`) 中拥有完整落地的被动与专属特性乘数：
1. **🩸 狂暴血统 (`APEX_BIO`)**：额外提升 `+(25 + row * 15)` 基础生命上限、`+20%` 吞噬回血倍率、`-5%` 饥饿掉血，以及 **`1.18x` 巨口吸附判定半径 (`jawSuctionMultiplier`)**。
2. **⚙️ 机甲血统 (`CYBER_MECHA`)**：额外提升 `+10%` 游动移速、`-12%` 冲刺耗能与 `+55 px` 磁吸半径，第 6 代机甲鲨可直接吞噬水雷 (`canEatMines = true`)。
3. **🔥 元素血统 (`ELEMENTAL_CORE`)**：额外提升 `+18%` 得分倍率与 `+5%` 移速，黄金狂暴持续时间延长 `+(1.0 + row * 0.3)s`（特定神明鲨如 `#34 地心业火熔岩巨兽` `+2.5s`、`#44 恒星日冕太阳神鲨` `+4.0s`）。
4. **👁️ 深渊血统 (`ELDER_ABYSS`)**：额外提升 `-10%` 饥饿掉血、`+35 px` 磁吸半径，以及 **`+15%` 基因结晶产出倍率 (`geneYieldMultiplier`)**。
5. **专属个体特性全量实装**：
   - **进化面板与局内公式 100% 同源**：`SharkEvolutionAtlasModal.tsx` 直接调用 `computeEvolvedSharkStats(1, form.id, upgradeLv, false, 1.0, unlockedCount)` 渲染面板属性，确保躯体强化 `Lv.5`（`+1T`）与 `Lv.10`（`+2T`）突破后的咬合阶位、强化与图鉴加成后的生命上限与移速在面板与局内 HUD 完全一致。
   - **代际与个体资源产出乘数 (`coinYieldMultiplier` / `geneYieldMultiplier`)**：代际加成 `1 + row * 0.12` 叠加图鉴加成与 `#15`/`#23`/`#31`/`#35`/`#40`/`#44`/`#45`/`#47` 专属金币/基因收益倍率。
   - **重甲减伤与抗震退 (`damageTakenMultiplier` / `mineDamageTakenMultiplier` / `knockbackMultiplier`)**：`#10 暴君公牛壮鲨`（碰撞减伤 `-25%`）、`#21 重装钛合金战鲨`（水雷减伤 `-40%`）、`#30 大地岩甲泰坦鲨`（震退减半 `-50%`）、`#44 圣光奥术神装炽天使鲨`（全伤害减免 `-50%`）。
   - **机动、连击与猎首特权**：`#09 灰鲭深蓝极速鲨`（`1.25x` 冲刺回能）、`#18 百战刀疤狂鲨`（连击上限 `2.4x` + 吞噬回能 `+4`）、`#28 虚空雷霆脉冲鲨`（黄金狂暴需求 `-1`）、`#37 矩阵代码黑客幽灵鲨`（`2.0x` 冲刺回能）、`#39 深渊九头海怪克拉肯鲨`（吞噬深渊 Boss `2.0x` 奖励）。

### 4.3 全图鉴收集被动光环 (`getGlobalAtlasBonuses`)
为了鼓励玩家横向收集全部 48 只鲨鱼，而不仅仅只走单一路线，**每多解锁 1 只新鲨鱼形态，全账号永久叠加**：
- **全局生命上限**：`+2.0% / 只`（解锁满 48 只时高达 `+94%` 生命上限）
- **全局游动速度**：`+0.8% / 只`（解锁满 48 只时高达 `+37.6%` 移速）
- **全局金币与基因收益**：`+2.5% / 只`（解锁满 48 只时高达 `+117.5%` 资源产出）

---

## 5. 双货币经济循环与防套利动态消耗（4:1 黄金产销比）

### 5.1 金币 `🪙` 与基因 `🧬` 的获取/消耗平衡（~4:1 产出比）
- **金币 `🪙`（高频养成与战术货币）**：
  - **获取**：全部 135 项现役猎物与障碍配置（134 种海洋生物 + `cyber_mine`）的 `coinValue` 与 `geneValue` 按约 **4:1 ~ 4.5:1** 黄金比例配置；普通猎物死亡爆出的拾取球中 **75% 为金币球 `COIN`**、25% 为基因结晶；此外包含黄金变异鱼 `3.0x` 金币倍率与悬赏目标鱼丰厚金币奖励。
  - **消耗**：① 强化当前鲨鱼躯体等级（`Lv.1 -> Lv.10`）；② 破茧进化解锁新鲨鱼形态；③ 局内释放 `🪙 黄金狂暴` 战术爆发技能。
- **基因碎片 `🧬`（高价值突破与质变货币）**：
  - **获取**：浅海普通小鱼仅少量产出基因（`geneValue = 1~2`），高浓度基因产出来自：**🎯 悬赏目标鱼**（完成悬赏奖励 `18 + 4 * tier` 基因及必掉额外基因结晶）、**深渊巨兽变异体 (`ABYSS_BEHEMOTH`, `2.5x` 基因)** 与 **`T4+` 深海大型猎物**。
  - **消耗**：① 破茧进化解锁新鲨鱼形态；② 躯体强化在 **`Lv.4 → Lv.5` 与 `Lv.9 → Lv.10` 咬合阶级突破点** 的基因消耗；③ 局内释放 `🧬 基因突破`（立即获得 `+55%` 当前等级所需 XP、回复 `+30 HP` 并 **100% 瞬间回满冲刺能量槽 ⚡**）。

### 5.2 局内技能“代际锚定 + 二次方加速递增”消耗公式（防止高代际永动套利）
- **`🪙 黄金狂暴` 局内消耗公式**（`getGoldOverdriveCost(useCount, generationRow)`）：
  $$\text{Cost}_{\text{gold}}(n, \text{row}) = \text{round}\Big(\big(35 + 25n + 12n^2\big) \times \big(1 + 0.35 \times \max(0, \text{row})\big)\Big)$$
  - 初代幼鲨前 3 次依然亲民（`35 -> 72 -> 133`），第 4 次起二次方项快速拉升，且随鲨鱼代际（`row = 0..5`）自动锚定单局购买力，彻底杜绝高阶鲨鱼无限连开黄金狂暴套利。
- **`🧬 基因突破` 局内消耗公式**（`getGeneSurgeCost(level, useCount, generationRow)`）：
  $$\text{Cost}_{\text{gene}}(L, n, \text{row}) = \text{round}\Big(\big(12 + 5(L - 1) + 10n + 6n^2\big) \times \big(1 + 0.25 \times \max(0, \text{row})\big)\Big)$$

### 5.3 分数（Score）的双重核心定位：单物种统治王冠 `👑` + 局内狩猎热度 `Heat`
为了避免“分数日常折算货币造成通胀”以及“平方根折算引发自杀刷钱流”，分数系统严格遵循**“局内化作狩猎热度增益、跨局化作单鲨鱼独立三段位首通奖”**的原则：
1. **单物种独立三段位王冠 (`getSharkMasteryConfig` & `settleSharkScoreMastery`)**：
   - 48 只鲨鱼各自独立记录最高分 `sharkBestScores[sharkId]` 与已达成王冠段位 `sharkMasteryTiers[sharkId]`（`0 = 无, 1 = 🥉铜冠, 2 = 🥈银冠, 3 = 👑金冠`）。
   - **试驾严格隔离**：观看广告试驾 `#42 歼星舰超光速机甲神鲨`（`trialActive === true`）绝不污染正式最高分纪录，也不触发王冠首通。
   - **一次性首通基因大奖**：每只鲨鱼首次达到其代际对应的 `🥉 铜冠 (1.0x)`、`🥈 银冠 (2.4x)`、`👑 金冠 (5.0x)` 分数线时，立即发放一次性固定基因奖励（领过即标记 `✓ 已领`，不可重复刷取）。
2. **局内狩猎热度被动增益 (`computeHuntingHeatBuff(currentScore, generationRow)`)**：
   - 单局当前分数按代际基准映射为 **`Heat Lv.0 ~ Lv.5`**：
     - **磁吸半径加成**：`+16 px / Heat Lv`（最高 `+80 px` 拾取磁吸范围，无需回头捡球）。
     - **冲刺能量恢复加成**：`+2.2 / 秒 / Heat Lv`（最高 `+11 / 秒` 能量恢复加速，越杀越顺手）。

---

## 6. 海洋深度生态分布规则（134 种现役真实水深生物 + `cyber_mine`，`0m ~ 20000m` 体大优先深海分层）

### 6.1 双因子映射算法 (`computeMappedPrey140Config` in `src/game/preyDatabase140.ts`) 与五大深海生态带
游戏生态库 `GAME_CONFIG.preyTiers` 由 `buildPrey140TiersWithMines()` 生成，包含 `docs/06-PREY_DATABASE_140.md` 中的 **134 种现役海洋生物（`PREY-001 ~ PREY-100` 普通鱼、`PREY-101 ~ PREY-130` 与 `PREY-201 ~ PREY-210` 大/巨型鱼类与鲸豚，已剔除 `PREY-122..126, 209` 海狮/海象/海牛/儒艮）** 与 **1 种保留的爆破障碍（`cyber_mine`：`T6`，`560m ~ 20000m`）**，总计 **135 项**（旧版 32 种混合生物、潜艇、辐射粘液及海底遗物全部移除）。

由于现实鱼类真实水深多集中在 `0~300m`、最深 `2000m`，而游戏世界深度为 `0m ~ 20000m`，系统采用 **「真实生存水深对数分位数 `depthFactor` + 尺寸级别 `sizeClass` 深海偏移」** 双因子纯函数映射到 5 大深度区间：
- **对数水深基准**：$\text{depthFactor} = \min\big(1,\; \ln(1 + \text{realMaxDepth}) / \ln(1 + 1200)\big)$。
- **同水层“体大优先靠近深海”递增映射**（针对 `realMinDepth < 50m` 物种）：
  - `XS`（`5~15cm`）：`T1`，覆盖 `25m ~ 530m`（阳光浅滩珊瑚鱼主体，如 `PREY-001` 小丑鱼、`PREY-003` 黄尾蓝雀鲷）。
  - `S`（`10~30cm`）：`T1 ~ T2`，覆盖 `45m ~ 760m`（如 `PREY-002` 蓝倒吊、`PREY-044` 沙丁鱼）。
  - `M`（`15~70cm`）：`T2 ~ T3`，覆盖 `115m ~ 1860m`（跨越浅海礁盘外缘至上暮光带）。
  - `L`（`40~300cm`）：`T3 ~ T4`，覆盖 `320m ~ 5450m`（`T4` 物种钳制 `minDepth >= 540m` 不侵扰浅滩）。
  - `XL`（`100~400cm`）：`T5 ~ T6`，覆盖 `640m ~ 12800m`（远洋中型鲨、海龟、海豚与大枪鱼）。
  - `XXL`（`250~800cm`）：`T6 ~ T7`，覆盖 `1650m ~ 20000m`（深海远洋虎鲨、鲸鲨、大白鲨、大旗鱼与深潜巨头）。
  - `巨型`（`400~2500cm`）：`T8`（含 `PREY-201/204/205/206` 深渊 Apex Boss），覆盖 `4200m ~ 20000m` 直达海沟底部。
- **深海基础食物链保底机制（`realMinDepth >= 50m`）**：灯笼鱼、银斧鱼、蝰鱼、尖牙鱼、深海龙鱼、斧头龙鱼等真实中深海小型生物（`PREY-041/042/079~088`）统一从 `minDepth >= 540m` 向下铺设至 `3600m ~ 20000m`（`realMaxDepth >= 2000` 直达 `20000m`），赋予 `T2 ~ T4` 阶位，确保玩家下潜至万米海沟时始终有发光小鱼群可吞噬续航。

### 6.2 85% 原生栖息地刷怪保护（严禁浅水鱼进深渊 / 深海鱼进浅滩）
在 `src/game/ecosystemSpawner.ts` 与 `src/App.tsx` 的 `createPreyEntity()` 中强制执行：
1. **深度优先筛选**：根据刷新点目标深度 `targetDepth`，85% 概率严格从满足 `minDepth <= targetDepth <= maxDepth` 的原生鱼种池中抽取，15% 概率允许在栖息地边界 `±140m` 过渡带抽取（兜底池按 `targetDepth <= 520m ? minDepth <= 520 : maxDepth >= 1150` 分流）。
2. **出生坐标硬钳制（Hard Depth Clamp）**：任何鱼种生成后，其最终 Y 坐标强制执行：
   $$y = \text{clamp}\big(y,\; \max(55,\; \text{chosenTier.minDepth}),\; \text{chosenTier.maxDepth}\big)$$
   且在阳光浅滩伴游成簇生成（`schoolClusterAnchor`）时额外执行 `shallowMateCap = sharkY <= 430 ? 515 : anchor.config.maxDepth`，数学上 **100% 杜绝浅水鱼刷到深海或深海鱼越界至浅水区**。

### 6.3 浅滩安全区与全深度分层刷新权重（Early-Run Sanctuary & 0~20000m Stratified Weights）
为保证阳光珊瑚浅海（`0~520m`）清爽解压且深海梯度平滑递增，实施四项保护与分层权重：
1. **浅海零主动攻击鱼类与水雷（Zero Active Chargers / Hazards in Shallow Reef）**：
   - `pickPreyConfigForDepth` 与 `spawnOnePrey` 在 `depth <= 520m` 时**全程永久过滤** `isHazard`（`cyber_mine`）、`isBoss`、`EEL_CHARGER` 与 `SUB_PATROL`；浅海区仅栖息 `T1 ~ T3` 珊瑚礁鱼群与小中型群游鱼。
2. **浅滩下界预刷新永久钳制**：当玩家在阳光浅海活动（`sharkY <= 430m`）时，屏幕外预生成目标深度钳制在 `<= 495m`（新手保护期 `<= 440m`），集群伴游鱼钳制在 `<= 515m`。
3. **纯按水深固定生态刷新 (`T1 ~ T48`，禁用旧图集猎物)**：
   - 刷新器严格过滤 `!p.isHazard && Boolean(p.externalPngUrl)`，100% 仅刷新 134 种 `@3x` 真实海洋生物（`PREY-001 ~ PREY-210`），不随玩家当前鲨鱼 `T` 阶改变刷新权重。
   - 在 `> 520m` 中深海与深渊区域，固定保留 `18%` 的深海发光伴生小鱼群（`T11 ~ T14`，如灯笼鱼、银斧鱼、闪光灯笼鱼、深海银鱼等），确保玩家下潜深渊时始终有基础口粮续航。
4. **同屏鱼群呼吸感与密度控制（`maxActivePreys = 20`，`debugPreySizeMultiplier = 0.8`）**：
   - 同屏活跃猎物数量默认配置为 `20` 条（iOS 端 `22` 条），生成环半径扩展至 `640px ~ 1650px`，猎物全局显示与碰撞尺寸缩放倍率默认 `0.8`；开局迎宾鱼群使用 `['PREY-001', 'PREY-003', 'PREY-015', 'PREY-002', 'PREY-044']`。
5. **新手引导第 3 步实操补给礼包**：首次完成新手引导第 2 步（按住冲刺 `0.7s`）时，一次性发放 **`+80 🪙 +20 🧬` 新手补给礼包**，确保玩家在引导第 3 步 100% 立即点亮并亲手体验 `强化`（60🪙）或 `突破`（12🧬）。

---

## 7. 无限成长与深渊难度膨胀系统 (`InfiniteProgressionManager`)

位于 `src/game/infiniteProgressionManager.ts`：
- **全局时间难度乘数**：随单局存活时间 $t$（秒）按对数平滑增长：
  $$M_{\text{time}} = 1.0 + 0.35 \times \ln\left(1 + \frac{t}{60}\right)$$
- **狂暴进化叠层**：每次触发黄金狂暴叠层，全局难度额外 `+0.18`，但同时猎物的金币、基因与经验产出倍率也按 $1.0 + (M_{\text{diff}} - 1.0) \times 0.85$ 同步膨胀，确保后期高风险伴随高额跨局收益。
- **三大深海变异词缀（Mutations）**：
  - `GOLDEN_SWARM`（黄金丰饶）：体型 `0.92x`，移速 `1.2x`，经验/金币/基因收益 **`3.0x`**。
  - `FRENZY_PREY`（狂暴迅捷）：体型 `1.08x`，移速 `1.42x`，收益 **`1.75x`**。
  - `ABYSS_BEHEMOTH`（深渊巨兽）：体型放大，有效阶位 **`T + 1`**，咬碎后收益 **`2.6x`**。

---

## 8. 文档变更记录 (Changelog)

| 日期 | 变更摘要 | 关联代码文件 |
| :--- | :--- | :--- |
| 2026-11-16 | **咬合阶位与猎物生态重构为 `T1 ~ T48`（48阶渐进式进化 + 134种独立 `@3x` 真实海洋生物细分 + 三级破甲/天敌机制）**：① 48只鲨鱼 `#01 ~ #48` 基础咬合阶位一一对应 `T1 ~ T48`，单鲨鱼通过躯体强化（`Lv.3/6/10` 获 `+1/+2/+3T`）与局内升级（`Lv.2/5/9` 获 `+1/+2/+3T`）最多可提升 `+6T` 实现跨代狩猎；② 134种 `@3x` 真实海洋生物（`PREY-001 ~ PREY-210`）按体型、体长与水深均匀细分至 `T1 ~ T48`（每阶 2~3 种）并应用 48 阶连续属性曲线，彻底禁用旧图集猎物与回退贴图；③ 实装三级碰撞判定（`<= T` 直接吞噬、`+1T ~ +3T` 冲刺破甲撕咬获 `1.35x` 暴击奖励、`>= +4T` 致命天敌必须躲避），保持猎物纯净无外圈圆环、完全依赖体型比例直观区分；④ `EcosystemSpawner` 改为 100% 纯按水深固定刷新 | `src/game/sharkEvolutionConfig.ts`, `src/game/preyDatabase140.ts`, `src/game/rules.ts`, `src/game/ecosystemSpawner.ts`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts`, `src/game/i18n.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-16 | **剔除 6 种非鱼形态海洋哺乳类（海狮/海象/海牛/儒艮）并修正 `PREY-203` 灰鲸与 `PREY-110` 蝠鲼方向**：从 `preyDatabase140.ts` 中移除 `PREY-122` 海牛、`PREY-123` 儒艮、`PREY-124` 海象、`PREY-125` 北海狮、`PREY-126` 南美海狮、`PREY-209` 北极海象（现役调整为 134 种海洋生物 + `cyber_mine` = 135 项），并更新 `rules.test.ts` 校验及 `PREY-203`、`PREY-110` 右朝向贴图 | `src/game/preyDatabase140.ts`, `src/game/rules.test.ts`, `scripts/build-ios-native.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-15 | **全平台（Web + iOS 原生）猎物体系全面替换为 140 种新海洋生物（`PREY-001 ~ PREY-210`）+ 保留深海水雷 `cyber_mine`（共 141 项），按真实水深 + 体型加权分层铺满 `0m ~ 20000m`**：① 新增 `src/game/preyDatabase140.ts` 收录 140 种生物元数据、中英双语字典与 `computeMappedPrey140Config` 双因子映射公式（按 `realMinDepth/realMaxDepth` 与 `XS -> 巨型` 尺寸级别优先向深海偏移，同时为 `realMinDepth >= 50m` 的深海发光小鱼保留直达 `20000m` 的基础补给链）；② 替换 `GAME_CONFIG.preyTiers`、更新 `ecosystemSpawner.ts`（含 `shallowMateCap = 515m` 伴游钳制与五段 `0~20000m` 阶位权重）、`App.tsx` 开局迎宾鱼群及 `i18n.ts`；③ 升级 `spriteSheetManager.ts` 与 `canvasRenderer.ts`（分批/按需加载 `@3x.png` 透明资产并执行 420px 限宽与紧致透明边界裁切，新增 `SHARK_APEX` 步态）；④ 同步更新 `scripts/build-ios-native.ts`（唯一 `spriteKey`、`@3x` 打包、五步态分类与深海分层刷新）与 `rules.test.ts`（41/41 通过） | `src/game/preyDatabase140.ts`, `src/game/config.ts`, `src/game/i18n.ts`, `src/game/spriteSheetManager.ts`, `src/game/canvasRenderer.ts`, `src/game/ecosystemSpawner.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `scripts/build-ios-native.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`, `docs/06-PREY_DATABASE_140.md` |
| 2026-11-15 | **修复 9 层阶梯海床洞口悬崖与大陆坡嫁接山根（~633m）穿墙穿模 Bug（Web + iOS 原生双端同步）**：① 将 `getSeabedTerraceAt` 实体碰撞激活由 `graftedEdgeWeight > 0.02` 改为 `graftT > 0.03`，彻底清除洞口唇边 `0~22m` 碰撞盲区；② 在 `resolveSeabedCollision` 中识别无洞下走廊的实心嫁接山根楔块（`floorEngineY - bottomArchY <= radius * 1.25`），防止误判 `hitAtollUnderside` 反向压入地下；③ 在 `resolveSeabedKineticStep` 中新增 `hitsTerraceVerticalWallHorizontally` 二维水平悬崖阻挡（含 6 次二分精定位与狭窄山根楔形区防挤入） | `src/game/worldGenerationSystem.ts`, `scripts/build-ios-native.ts`, `src/game/rules.test.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`, `docs/05-CROSS_PLATFORM_MOBILE_PORTING_GUIDE.md` |
| 2026-11-12 | **世界海洋深度上限扩展至 `20000m`（`1m = 1 worldPx`）并补齐 `T3 ~ T6` 超深海原生鱼种覆盖（`maxDepth: 99999`）**：将 `WorldConfig.bounds.maxDepth` 统一为 `20000m`（海床深度范围 `[420m, 19800m]`），并将 `cyber_mine`（`T3`）、`glowing_lanternfish`（`T3`）、`giant_humboldt_squid`（`T4`）、`trench_blobfish`（`T5`）、`radioactive_slime_hazard`（`T6`）的栖息深度上限设为 `99999`，与原本即为 `maxDepth: 99999` 的 `T7 ~ T8` 深渊巨兽共同构成直达 `20000m` 海沟底部的完整食物链 | `src/game/config.ts`, `src/game/worldGenerationSystem.ts`, `src/game/rules.test.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-10 | **新增第 3.6 节“跨深度带景深错峰 $C^2$ 五次曲线与空间涌现过渡算法 (`computeParallaxBiomeTransitionState`)”**：在 `src/game/rules.ts` 中新增 `quinticSmoothstep`（$6t^5 - 15t^4 + 10t^3$）、`compensateUnderLayerAlpha` 与 `computeParallaxBiomeTransitionState(depthMeters)`，实现 `Water -> Far -> Mid -> Near` 按光学景深距离错峰过渡、非负垂直空间涌现/沉降位移（`OffsetY >= 0`）与三生态带连续粒子权重插值 | `src/game/rules.ts`, `src/game/parallaxBackground.ts`, `scripts/build-ios-native.ts`, `src/game/rules.test.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-09 | 为 `SharkFormConfig`（`src/game/sharkEvolutionConfig.ts`）新增 `sprite3xUrl`（`/assets/sharks_3x/shark_form_00@3x.png` .. `shark_form_47@3x.png`）与 `getShark3xImageUrl()` 辅助函数，使全部 48 阶鲨鱼配置具备独立 `@3x` 超分单图资源映射 | `src/game/sharkEvolutionConfig.ts`, `scripts/build-sharks-3x.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-06 | **全平台（Web + iOS 原生）游动速度下调 50%（冲刺速度对齐原常态移速）**：`GAME_CONFIG.world.baseSharkSpeed` 由 `280` 下调为 `140`（配合 `boostSpeedMultiplier: 2.0`，按住冲刺时 `boostSpeed = 280` 恰好等于原版常态速度，常态巡游速度 `140` 与全部 33 种猎物 `baseSpeed` 同步按 `0.5x` 等比下调），使深海巡游与冲刺爆发节奏更具层次感 | `src/game/config.ts`, `scripts/build-ios-native.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md` |
| 2026-11-05 | **新增第 3.5 节“鲨鱼成长驱动的远/中/近景光学分级缩小公式 (`getParallaxLayerGrowthScales`)”**：按景深距离权重（`近景 0.70 > 远景鱼群 0.55 > 中景 0.45 > 远景 0.22 > 海面水幕 0.15`）将 `relativePreyScale`（`1.00 -> 0.40`）映射为各背景视差层的动态缩放比（满阶时近景 `0.58x`、中景 `0.73x`、远景 `0.868x`），使鲨鱼长大时近处海床铁锚/珊瑚明显变小并自然显露更开阔的中远景深海奇观 | `src/game/rules.ts`, `src/game/parallaxBackground.ts`, `src/App.tsx`, `src/game/rules.test.ts`, `docs/03-GAME_BALANCE_AND_NUMERICAL_DESIGN.md`, `docs/02-DESIGN_SPEC.md` |
| 2026-10-31 | **固化默认鱼群刷新数量 `20` 与猎物显示大小 `0.8`（保留调参功能、隐藏调参按钮）**：`ecosystemSpawner.ts` 默认 `maxActivePreys` 设为 `20`，`rules.ts` 默认 `debugPreySizeMultiplier` 设为 `0.8`，`App.tsx` 默认隐藏调参面板与调参按钮并保留全部实时调参代码 | `src/game/ecosystemSpawner.ts`, `src/game/rules.ts`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-10-31 | **新增实时调参 Debug 调节器（`debugPreySizeMultiplier` & `syncPreyCountImmediate`）**：`rules.ts` 新增 `getDebugPreySizeMultiplier` / `setDebugPreySizeMultiplier`（支持 `0.35x ~ 2.50x` 实时缩放 `getPreyRelativeVisualScale` 输出，保持渲染与碰撞半径同步）；`ecosystemSpawner.ts` 新增 `syncPreyCountImmediate` 支持 `4 ~ 80` 同屏鱼数实时增删 | `src/game/rules.ts`, `src/game/ecosystemSpawner.ts`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-10-31 | **降低同屏鱼群刷新密度 & 浅水区永久移除鳗鱼等主动攻击鱼类**：① `ecosystemSpawner.ts` 将 `maxActivePreys` 由 `50` 下调至 `28`、生成环扩展为 `640~1650px`、`T1` 成簇概率由 `55%`（3 条一簇）降为 `28%`（双鱼结伴），`App.tsx` 开局迎宾小鱼由 `10` 条减至 `5` 条、标题巡游鱼由 `32` 条减至 `18` 条；② 将 `green_moray_eel`（剧毒海鳝，`EEL_CHARGER`）栖息深度由 `130m~520m` 迁移至暮光带 `560m~1180m`，浅水区（`depth <= 520m`）全程永久屏蔽主动攻击鱼类 | `src/game/config.ts`, `src/game/ecosystemSpawner.ts`, `src/App.tsx`, `src/game/parallaxBackground.ts`, `src/game/rules.test.ts` |
| 2026-10-29 | **资深 QA 进化面板与实战计算全量对齐审计**：① `SharkEvolutionAtlasModal.tsx` 面板四维属性直连 `computeEvolvedSharkStats`，使躯体强化 `Lv.5`/`Lv.10` 咬合突破（`+1T`/`+2T`）与图鉴全局加成实时同步显示；② 统一全部 48 阶鲨鱼 `traitZh`/`traitEn` 特性文案数值与 `SHARK_EVOLUTION_FORMS` 实际参数；③ 在 `rules.ts` 与 `App.tsx` 完整实装代际收益加成（`+12%/row`）、四大血统被动及个体专属特性（巨口吸附、基因/金币专精倍率、碰撞/水雷减伤、抗震退、冲刺回能倍增、Boss 双倍猎首等）；④ 修复广告试驾鲨鱼 ID 为 `#42 shark_41_star_destroyer` | `src/game/sharkEvolutionConfig.ts`, `src/game/rules.ts`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-10-29 | 优化 `evaluateSharkUnlock` 前置鲨鱼解析规则：默认以 48 阶序列中的紧邻前序鲨鱼（`SHARK_EVOLUTION_FORMS[form.index - 1]`）作为明确特指的前置鲨鱼，并输出 `bestParentId`、`bestParentIndex`、`bestParentNameZh`、`bestParentNameEn` 供进化界面直显具体鲨鱼名称；移除海底洞穴系统相关内容 | `src/game/sharkEvolutionConfig.ts`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/game/rules.test.ts` |
| 2026-10-28 | 新增第 6.3 节“浅滩安全区与咬合阶位感知刷新权重”：限制浅海玩家下方预刷新深度 `<= 440m`，在 `T1` 前期提升可吞食 `T1` 小鱼刷新占比至 `76%~84%` 并过滤主动追咬掠食者，配套新手引导第 3 步发放 `+80🪙 +20🧬` 实操补给礼包；新增第 5.3 节“单物种统治王冠与局内狩猎热度” | `src/game/ecosystemSpawner.ts`, `src/App.tsx`, `src/game/sharkEvolutionConfig.ts`, `src/game/rules.ts` |
| 2026-10-27 | 重构双货币经济系统：① 猎物金币/基因产出重构为 ~4:1 黄金比（普通拾取球 75% 金币 / 25% 基因，高浓度基因聚焦于悬赏鱼与深海巨兽）；② 躯体强化常规金币消耗下调 15%，并在 `Lv.4→5` 与 `Lv.9→10` 阶级突破点引入基因消耗 `getSharkUpgradeGeneCost`；③ 黄金狂暴与基因突破改为“代际锚定 + 二次方递增 (`n^2`)”公式 | `src/game/config.ts`, `src/game/sharkEvolutionConfig.ts`, `src/game/rules.ts`, `src/App.tsx`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/game/rules.test.ts` |
| 2026-10-27 | 新增第 3.4 节“黄金狂暴阶段体型保持特例”：进入黄金阶段时不缩小其他鱼类，保持进入前的巨兽体型以强化猎杀成就感 | `src/game/rules.ts`, `src/game/canvasRenderer.ts`, `src/game/rules.test.ts` |
| 2026-10-26 | 编写完整数值策划案：明确双轨 `Lv`、咬合阶位 `T`、猎物相对体型算法 `getPreyRelativeVisualScale`、48 阶进化矩阵与深度分布规则 | `src/game/rules.ts`, `src/game/sharkEvolutionConfig.ts`, `src/game/config.ts` |



