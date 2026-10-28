# 03. 核心数值策划与系统公式圣经 (Game Balance & Numerical Design)

> **文档状态**：生效中（Active）
> **最后更新**：2026-10-26
> **关联约束**：修改 `src/game/rules.ts`、`src/game/sharkEvolutionConfig.ts`、`src/game/config.ts` 或 `src/game/infiniteProgressionManager.ts` 中的任何数值参数或公式时，**必须在同一次提交中更新本文档对应的章节与表格**（参见 [`docs/00-AI_CONSTRAINTS.md`](./00-AI_CONSTRAINTS.md)）。

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
  - **咬合阶位 `T` 突破奖励**：
    - 强化达到 **`Lv.5`** 时：该鲨鱼永久获得 **`+1 咬合阶位 (T+1)`**！
    - 强化达到 **`Lv.10`（满级）** 时：该鲨鱼永久获得 **`+2 咬合阶位 (T+2)`**！
  - **解锁下一阶鲨鱼的前置条件**：强化当前鲨鱼至指定等级（`Lv.2 ~ Lv.9`），是破茧进化解锁下一只鲨鱼形态的第一道门禁。

---

## 2. 咬合阶位（`T1 ~ T8`）计算规则与克制法则

`T`（Bite Tier，咬合阶位，显示为琥珀色徽章 `T1 ~ T8`）是决定**食物链吞噬关系**的核心指标。海洋中全部 32 种生物划分为 `T1` 至 `T8` 共 8 个生态位阶。

### 2.1 鲨鱼当前咬合阶位 `T` 的完整合成公式
位于 `src/game/rules.ts` ➔ `computeEvolvedSharkStats()`：

$$T_{\text{shark}} = \begin{cases} 8, & \text{若处于黄金狂暴状态 (Frenzy Active)} \\ \min\Big(8,\; \min\big(T_{\text{genMax}},\; T_{\text{base}} + \Delta T_{\text{upgrade}} + \Delta T_{\text{inRun}}\big)\Big), & \text{常规状态} \end{cases}$$

其中各项含义如下：
1. **形态基础咬合阶位 $T_{\text{base}}$（`form.baseBiteTier`）**：
   - 由当前出战鲨鱼所属的代际（Row 0~5）与列数（Col 0~7）决定：
     - **第一代·幼体期 (`#01 ~ #08`)**：`#01 ~ #03` 为 `T1`；`#04 ~ #06` 为 `T2`；`#07 ~ #08` 为 `T3`。
     - **第二代·猎手期 (`#09 ~ #16`)**：`#09 ~ #12` 为 `T3`；`#13 ~ #16` 为 `T4`。
     - **第三代·装甲期 (`#17 ~ #24`)**：`#17 ~ #20` 为 `T5`；`#21 ~ #24` 为 `T6`。
     - **第四代·霸主期 (`#25 ~ #32`)**：`#25 ~ #29` 为 `T6`；`#30 ~ #32` 为 `T7`。
     - **第五代·泰坦期 (`#33 ~ #40`)**：`#33 ~ #35` 为 `T7`；`#36 ~ #40` 为 `T8`。
     - **第六代·神明期 (`#41 ~ #48`)**：全员天生即为满阶 **`T8`**（且第六代深渊系与机甲系自带直接吞噬深水雷特权 `canEatMines = true`）。
2. **躯体强化咬合加成 $\Delta T_{\text{upgrade}}$（`upgradeBiteBonus`）**：
   $$\Delta T_{\text{upgrade}} = \begin{cases} 2, & \text{当躯体强化等级 } L_{\text{upg}} = 10 \\ 1, & \text{当躯体强化等级 } 5 \le L_{\text{upg}} \le 9 \\ 0, & \text{当躯体强化等级 } 1 \le L_{\text{upg}} \le 4 \end{cases}$$
3. **局内等级咬合加成 $\Delta T_{\text{inRun}}$（`inRunBiteBonus`）**：
   - 初始 `#01 小丑幼鲨`（`form.index === 0`）在局内升至 `Lv.2` 时立即获得 `+1` 咬合阶位（从 `T1` 升为 `T2`），之后每升 3 级再 `+1`：
     $$\Delta T_{\text{inRun}} = \begin{cases} 1 + \lfloor (L_{\text{inRun}} - 2) / 3 \rfloor, & \text{若为 \#01 小丑幼鲨 且 } L_{\text{inRun}} \ge 2 \\ \lfloor (L_{\text{inRun}} - 1) / 3 \rfloor, & \text{其他情况} \end{cases}$$
4. **代际咬合天花板 $T_{\text{genMax}}$（`genMaxBiteTier`）**：
   $$T_{\text{genMax}} = \min(8,\; T_{\text{base}} + 2)$$
   - **设计意图（为什么要有代际天花板？）**：每只鲨鱼通过局内升级与躯体强化，最多可在其天生基础阶位 $T_{\text{base}}$ 上提升 **`+2 阶`**（例如 `T1` 的 `#01 小丑幼鲨` 最高可成长至 `T3`）。若想吞噬 `T4 ~ T8` 的深海巨怪，玩家**必须破茧进化到更高代际的鲨鱼形态**，从而赋予 48 阶进化图谱强大的长期目标感！

### 2.2 咬合阶位 `T` 的实战克制与碰撞判定规则
位于 `src/game/rules.ts` ➔ `resolvePreyEncounter()`：

设猎物的有效阶位为 $T_{\text{prey}}$（普通猎物为 `prey.tier`，若带有 `ABYSS_BEHEMOTH` 深渊巨兽变异词缀则为 $\min(8, \text{prey.tier} + 1)$）：

| 阶位对比条件 | 屏幕视觉体型表现 | 触碰结果 (`resolvePreyEncounter`) |
| :--- | :--- | :--- |
| **$T_{\text{shark}} \ge T_{\text{prey}}$**<br>（或处于黄金狂暴 `Frenzy`） | **猎物体型严格小于玩家鲨鱼**（`16% ~ 64%` 鲨鱼大小） | **直接一口吞噬 (`DEVOUR`)**：恢复生命值，获得 XP、分数、金币与基因碎片，叠加连击 `Combo` |
| **$T_{\text{prey}} = T_{\text{shark}} + 1$**<br>且玩家**正在按住冲刺 (`isBoosting === true`)** | **猎物体型大于玩家鲨鱼**（约 `118%` 鲨鱼大小），外圈带**琥珀色虚线破甲提示环** | **冲刺破甲撕咬 (`ARMOR_CRUSH`)**：每口扣除猎物 `1 点` 护甲血量，玩家获得 `0.45s` 短暂无敌并弹开；咬碎最后一格血时直接吞噬并爆出 **1.5 倍经验与双倍基因**！ |
| **$T_{\text{prey}} = T_{\text{shark}} + 1$**<br>但玩家**未按冲刺 (`isBoosting === false`)** | **猎物体型大于玩家鲨鱼**（约 `118%` 鲨鱼大小） | **受击反伤 (`DAMAGE`)**：玩家受到该猎物 `damage` 数值的伤害并被击退 |
| **$T_{\text{prey}} \ge T_{\text{shark}} + 2$**<br>（或触碰深水雷且无吞雷特权） | **猎物体型显著大于玩家鲨鱼**（`135% ~ 195%` 鲨鱼大小），外圈带**红色脉冲警报环** | **越级重创 (`DAMAGE`)**：即使按住冲刺也无法破甲，玩家直接受到伤害并触发受击震屏与无敌帧 |

---

## 3. 猎物屏幕相对体型动态算法 (`getPreyRelativeVisualScale`)

为了确保玩家在任何时候都能通过**“比我小的鱼一定能直接吃，和我一样大或比我大的鱼一定会伤我”**这一直觉进行游戏，`src/game/rules.ts` 中的 `getPreyRelativeVisualScale()` 实施了严格的数学映射：

### 3.1 1:1 视觉等大基准线 (`sharkParityScale`)
- 玩家鲨鱼的基础绘制尺寸为 `SHARK_BASE_DRAW_SIZE = 96 px`，猎物半径转绘制尺寸系数为 `PREY_RADIUS_TO_DRAW_SIZE = 2.25`，因此鲨鱼等效半径为：
  $$R_{\text{sharkEq}} = \frac{96}{2.25} \approx 42.667$$
- 任意猎物在屏幕上与当前鲨鱼（缩放倍率为 $S_{\text{shark}}$）**视觉完全一样大（1:1 等大）**时的缩放系数为：
  $$\text{Scale}_{\text{parity}} = \frac{R_{\text{sharkEq}} \times S_{\text{shark}}}{\max(1,\; R_{\text{prey}})}$$

### 3.2 可直接吞噬猎物的体型缩小公式（严格 `<= 64%` 鲨鱼大小）
当 `canDevourDirectly === true` 时：
1. **阶位差缩小因子**：阶位差 $\Delta T = \max(0, T_{\text{shark}} - T_{\text{prey}})$ 越大，该猎物显得越小：
   $$\text{Ratio}_{\text{tier}} = \max\left(0.18,\; 0.64 \times 0.79^{\Delta T}\right)$$
2. **局内成长缩小因子**：随着局内等级 `Lv` 与代际提升，`relativePreyScale`（范围 `1.0 -> 0.40`）平滑下降：
   $$\text{Shrink}_{\text{level}} = 0.64 + 0.36 \times \text{relativePreyScale}$$
3. **最终相对鲨鱼尺寸比例**（严格限制在 `[0.16, 0.64]` 区间内）：
   $$\text{TargetRatio}_{\text{edible}} = \text{clamp}\left(\text{Ratio}_{\text{tier}} \times \text{Shrink}_{\text{level}},\; 0.16,\; 0.64\right)$$
   $$\text{VisualScale} = \text{Scale}_{\text{parity}} \times \text{TargetRatio}_{\text{edible}}$$

### 3.3 不可直接吞噬/危险猎物的体型放大公式（严格 `>= 118%` 鲨鱼大小）
当常态下不可直接吞噬（`canDevourNormally === false`）时：
- 设超阶数 $\Delta T_{\text{over}} = \max(1, T_{\text{prey}} - T_{\text{normalShark}})$：
  $$\text{TargetRatio}_{\text{danger}} = \min\left(1.95,\; 1.18 + (\Delta T_{\text{over}} - 1) \times 0.17 + \text{Bonus}_{\text{behemoth}}(0.12) + \text{Bonus}_{\text{boss}}(0.14)\right)$$
  $$\text{VisualScale} = \text{Scale}_{\text{parity}} \times \text{TargetRatio}_{\text{danger}}$$
- **效果验证**：任何常态下会伤害玩家的猎物在屏幕上至少是玩家鲨鱼体型的 **1.18 倍**以上，玩家绝不可能误以为它比自己小而撞上去。

### 3.4 黄金狂暴阶段体型保持特例（Gold Frenzy Size-Preservation Exception）
- **设计初衷**：当玩家进入黄金狂暴（`frenzyActive === true`）时，虽然咬合能力临时跃升至最高阶 `T8`（可吞噬一切猎物与水雷），但如果此时把全屏原本巨大的潜艇、巨型电鳗与克苏鲁章鱼王缩小成小鱼，会严重削弱“黄金狂暴正面生吞庞然大物”的视觉冲击力与猎杀成就感。
- **实现规则**：`ComputedSharkStats` 始终保留鲨鱼进入黄金阶段前的真实常态咬合阶位 `normalBiteTier`；`getPreyRelativeVisualScale()` 与 `drawPreyEntity()` 在计算猎物屏幕尺寸时**固定使用 `normalBiteTier`（忽略 `frenzyActive`）**。
- **最终表现**：
  1. **常态下（`frenzyActive === false`）**：100% 遵守“小于自己即可吞、大于等于自己即受伤”的视觉铁律。
  2. **黄金狂暴期间（`frenzyActive === true` 特例）**：所有猎物**保持进入黄金阶段前的原始体型大小不变**（巨兽依然庞大，并环绕金色虚线盛宴光环与 `★T{N}` 标记），玩家操控金光鲨鱼直接撞碎并一口生吞比自己还大的深海巨兽！

---

## 4. 48 阶鲨鱼本体进化矩阵与三重门禁系统

### 4.1 6 代 × 8 列进化矩阵总览 (`src/game/sharkEvolutionConfig.ts`)

| 代际 (Generation) | 图谱行号 | 编号范围 | 基础咬合 $T_{\text{base}}$ | 进化阶段定位 | 解锁所需前置躯体等级 | 解锁所需历史最高局内 `Lv` | 解锁所需历史最深下潜 `m` |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **第一代·礁石幼体期** | Row 0 | `#01 ~ #08` | `T1 ~ T3` | 新手破局期（1~3 局解锁新形态） | `Lv.2 ~ Lv.4` | `Lv.1 ~ Lv.4` | `0m ~ 490m` |
| **第二代·远洋猎手期** | Row 1 | `#09 ~ #16` | `T3 ~ T4` | 进军暮光温跃层 | `Lv.4` | `Lv.4 ~ Lv.6` | `350m ~ 770m` |
| **第三代·重装异变期** | Row 2 | `#17 ~ #24` | `T5 ~ T6` | 装甲猎杀与中深海统治 | `Lv.5` | `Lv.7 ~ Lv.9` | `650m ~ 1070m` |
| **第四代·深海霸主期** | Row 3 | `#25 ~ #32` | `T6 ~ T7` | 突破 1150m 午夜深渊海沟 | `Lv.6` | `Lv.10 ~ Lv.12` | `950m ~ 1370m` |
| **第五代·深渊泰坦期** | Row 4 | `#33 ~ #40` | `T7 ~ T8` | 猎杀巨型乌贼与沧龙级巨怪 | `Lv.8` | `Lv.13 ~ Lv.15` | `1300m ~ 1720m` |
| **第六代·创世神明期** | Row 5 | `#41 ~ #48` | `T8 (满阶)` | 终极神明形态（可吞水雷） | `Lv.9` | `Lv.16 ~ Lv.18` | `1650m ~ 2070m` |

### 4.2 四大进化血统分支（Lineages）
每只鲨鱼归属于四大血统之一，拥有鲜明的被动侧重：
1. **🩸 狂暴血统 (`APEX_BIO`)**：额外提升 `+20%` 吞噬回血倍率与 `-5%` 饥饿掉血，适合持久肉搏。
2. **⚙️ 机甲血统 (`CYBER_MECHA`)**：额外提升 `+10%` 游动移速、`-12%` 冲刺耗能与 `+55 px` 磁吸半径，第 6 代机甲鲨可直接吞噬水雷。
3. **🔥 元素血统 (`ELEMENTAL_CORE`)**：额外提升 `+18%` 得分倍率与 `+5%` 移速，黄金狂暴持续时间延长。
4. **👁️ 深渊血统 (`ELDER_ABYSS`)**：额外提升 `-10%` 饥饿掉血与 `+35 px` 磁吸半径，第 5~6 代深渊古神可直接吞噬深水雷。

### 4.3 全图鉴收集被动光环 (`getGlobalAtlasBonuses`)
为了鼓励玩家横向收集全部 48 只鲨鱼，而不仅仅只走单一路线，**每多解锁 1 只新鲨鱼形态，全账号永久叠加**：
- **全局生命上限**：`+2.0% / 只`（解锁满 48 只时高达 `+94%` 生命上限）
- **全局游动速度**：`+0.8% / 只`（解锁满 48 只时高达 `+37.6%` 移速）
- **全局金币与基因收益**：`+2.5% / 只`（解锁满 48 只时高达 `+117.5%` 资源产出）

---

## 5. 双货币经济循环与防套利动态消耗（4:1 黄金产销比）

### 5.1 金币 `🪙` 与基因 `🧬` 的获取/消耗平衡（~4:1 产出比）
- **金币 `🪙`（高频养成与战术货币）**：
  - **获取**：全部 33 种猎物的 `coinValue` 与 `geneValue` 按约 **4:1 ~ 4.5:1** 黄金比例配置；普通猎物死亡爆出的拾取球中 **75% 为金币球 `COIN`**、25% 为基因结晶；此外包含黄金变异鱼 `3.0x` 金币倍率与悬赏目标鱼丰厚金币奖励。
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
   - **试驾严格隔离**：观看广告试驾 `#46 机甲利维坦`（`trialActive === true`）绝不污染正式最高分纪录，也不触发王冠首通。
   - **一次性首通基因大奖**：每只鲨鱼首次达到其代际对应的 `🥉 铜冠 (1.0x)`、`🥈 银冠 (2.4x)`、`👑 金冠 (5.0x)` 分数线时，立即发放一次性固定基因奖励（领过即标记 `✓ 已领`，不可重复刷取）。
2. **局内狩猎热度被动增益 (`computeHuntingHeatBuff(currentScore, generationRow)`)**：
   - 单局当前分数按代际基准映射为 **`Heat Lv.0 ~ Lv.5`**：
     - **磁吸半径加成**：`+16 px / Heat Lv`（最高 `+80 px` 拾取磁吸范围，无需回头捡球）。
     - **冲刺能量恢复加成**：`+2.2 / 秒 / Heat Lv`（最高 `+11 / 秒` 能量恢复加速，越杀越顺手）。

---

## 6. 海洋深度生态分布规则（3 大深度带 × 32 种生物）

### 6.1 三大海洋垂直生态带 (`GAME_CONFIG.zones`)
1. **阳光珊瑚浅海 (`sunlit`，`0m ~ 520m`)**：明亮蔚蓝，透射动态丁达尔阳光束，栖息 `T1 ~ T3` 珊瑚礁热带鱼群。
2. **暮光温跃层 (`twilight`，`520m ~ 1150m`)**：靛蓝幽暗，栖息 `T3 ~ T5` 中大型远洋洄游鱼类、海龟、蝠鲼与大白鲨。
3. **午夜深渊海沟 (`abyss`，`1150m ~ 2400m+`)**：紫黑深渊，布满发光水母、深海安康鱼、大王乌贼、深海巨型水雷以及 `T7 ~ T8` 史前巨齿鲨、邓氏鱼、深渊沧龙与利维坦。

### 6.2 85% 原生栖息地刷怪保护（严禁浅水鱼进深渊 / 深海鱼进浅滩）
在 `src/game/ecosystemSpawner.ts` 与 `src/App.tsx` 的 `createPreyEntity()` 中强制执行：
1. **深度优先筛选**：根据刷新点目标深度 `targetDepth`，85% 概率严格从满足 `minDepth <= targetDepth <= maxDepth` 的原生鱼种池中抽取，15% 概率允许在栖息地边界 `±140m` 过渡带抽取。
2. **出生坐标硬钳制（Hard Depth Clamp）**：任何鱼种生成后，其最终 Y 坐标强制执行：
   $$y = \text{clamp}\big(y,\; \max(55,\; \text{chosenTier.minDepth}),\; \text{chosenTier.maxDepth}\big)$$
   从而在数学上 **100% 杜绝浅水鱼刷到深海或深海鱼刷到浅水区**。

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
| 2026-10-28 | 新增第 5.3 节“单物种统治王冠（🥉/🥈/👑）与局内狩猎热度（Heat Lv.0~5）”：为 48 只鲨鱼独立记录最高分与三段位一次性首通基因奖（严格隔离试驾模式），局内分数转化为磁吸范围与能量恢复被动增益 | `src/game/sharkEvolutionConfig.ts`, `src/game/rules.ts`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/App.tsx`, `src/game/rules.test.ts` |
| 2026-10-27 | 重构双货币经济系统：① 猎物金币/基因产出重构为 ~4:1 黄金比（普通拾取球 75% 金币 / 25% 基因，高浓度基因聚焦于悬赏鱼与深海巨兽）；② 躯体强化常规金币消耗下调 15%，并在 `Lv.4→5` 与 `Lv.9→10` 阶级突破点引入基因消耗 `getSharkUpgradeGeneCost`；③ 黄金狂暴与基因突破改为“代际锚定 + 二次方递增 (`n^2`)”公式 | `src/game/config.ts`, `src/game/sharkEvolutionConfig.ts`, `src/game/rules.ts`, `src/App.tsx`, `src/components/SharkEvolutionAtlasModal.tsx`, `src/game/rules.test.ts` |
| 2026-10-27 | 新增第 3.4 节“黄金狂暴阶段体型保持特例”：进入黄金阶段时不缩小其他鱼类，保持进入前的巨兽体型以强化猎杀成就感 | `src/game/rules.ts`, `src/game/canvasRenderer.ts`, `src/game/rules.test.ts` |
| 2026-10-26 | 编写完整数值策划案：明确双轨 `Lv`、咬合阶位 `T`、猎物相对体型算法 `getPreyRelativeVisualScale`、48 阶进化矩阵与深度分布规则 | `src/game/rules.ts`, `src/game/sharkEvolutionConfig.ts`, `src/game/config.ts` |
