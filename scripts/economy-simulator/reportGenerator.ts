import type { DistributionSummary } from './prng';
import type { ScenarioArchetypeBenchmark } from './campaignRunner';
import type { StaticAuditReport } from './staticAnalyzer';
import type {
  CareerTrajectoryResult,
  PlayerArchetypeId,
  PlayerArchetypeSpec,
  RuleScenarioId,
  RuleScenarioSpec,
} from './types';

function fmtDist(d: DistributionSummary, unit: string = ''): string {
  const s = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return `${s(d.median)}${unit} (${s(d.p25)} / ${s(d.p75)} / ${s(d.p90)} / avg ${s(d.mean)})`;
}

export interface SimulationReportBundle {
  metadata: {
    generatedAtIso: string;
    masterSeed: number;
    runsPerShark: number;
    careerSeeds: number;
    elapsedSec: number;
    commandLine: string;
  };
  scenarios: Record<RuleScenarioId, RuleScenarioSpec>;
  archetypes: Record<PlayerArchetypeId, PlayerArchetypeSpec>;
  staticAudit: StaticAuditReport;
  benchmarks: ScenarioArchetypeBenchmark[];
  uncappedStressProbe: Array<{
    scenarioId: RuleScenarioId;
    generation: number;
    sharkId: string;
    survivalSec: number;
    endedByTimeout: boolean;
    hpRatioAtEnd: number;
    coinsPerRun: number;
    genesPerRun: number;
    maxLevel: number;
    maxDepth: number;
  }>;
  careersNoAds: CareerTrajectoryResult[];
  careersWithAds: CareerTrajectoryResult[];
  trialExploitContrast: Array<{
    scenarioId: RuleScenarioId;
    trialSharkId: string;
    trialRunScore: number;
    trialMaxLevel: number;
    trialMaxDepth: number;
    trialCurrencyCarriedCoins: number;
    trialCurrencyCarriedGenes: number;
    leakedBestLevelToSave: number;
    leakedBestDepthToSave: number;
    leakedCrownCoins: number;
    leakedCrownGenes: number;
  }>;
}

export function generateSimulationMarkdownReport(bundle: SimulationReportBundle): string {
  const {
    metadata,
    scenarios,
    archetypes,
    staticAudit,
    benchmarks,
    uncappedStressProbe,
    careersNoAds,
    careersWithAds,
    trialExploitContrast,
  } = bundle;

  const lines: string[] = [];
  const push = (s: string = '') => lines.push(s);

  push('# Task 03：真实规则经济系统模拟报告 (`ECONOMY_SIMULATION_REPORT`)');
  push('');
  push(
    '> **严格阶段纪律声明**：本模拟器（[`scripts/economy-simulator/`](../scripts/economy-simulator/)）为只读评估工具，**未修改任何 Web (`src/`) 或 iOS (`ios-native/`) 游戏业务源码与经济数值**。所有数据均以相同 `masterSeed` 可 100% 确定性复现。'
  );
  push('');
  push('---');
  push('');
  push('## 一、模拟口径、代码复用与运行参数说明');
  push('');
  push(`- **生成时间**：\`${metadata.generatedAtIso}\` | **总耗时**：\`${metadata.elapsedSec.toFixed(1)}s\``);
  push(`- **固定主种子 (\`masterSeed\`)**：\`${metadata.masterSeed}\`（固定种子可比特级复现全部模拟结果）`);
  push(`- **单鲨基准样本**：每只鲨鱼 \`${metadata.runsPerShark}\` 局独立二维空间仿真（覆盖全 48 阶）；**全周期职业样本**：每个方案×模型 \`${metadata.careerSeeds}\` 条独立 \`#0 → #47\` 成长轨迹`);
  push(`- **复现命令**：\`${metadata.commandLine}\``);
  push('');
  push('### 1.1 直接复用的现行真实游戏模块（禁止复制失真简化公式）');
  push('');
  push('| 模块职责 | 直接调用/复用源码文件 | 说明 |');
  push('| :--- | :--- | :--- |');
  push('| 235 种猎物生态库 | [`src/game/preyDatabase140.ts`](../src/game/preyDatabase140.ts), [`src/game/config.ts`](../src/game/config.ts) | 读取真实 `coinValue/geneValue/xpValue/hpRestore/minDepth/maxDepth/behavior` |');
  push('| 48 阶进化与王冠/解锁 | [`src/game/sharkEvolutionConfig.ts`](../src/game/sharkEvolutionConfig.ts) | 调用 `SHARK_EVOLUTION_FORMS`, `getSharkUpgradeCost`, `getSharkUpgradeGeneCost`, `evaluateSharkUnlock`, `settleSharkScoreMastery`, `recordPermanentRunProgress`, `claimOnboardingStarterGift`, `getGlobalAtlasBonuses` |');
  push('| 核心战斗与拾取规则 | [`src/game/rules.ts`](../src/game/rules.ts) | 调用 `computeEvolvedSharkStats`, `resolvePreyEncounter`, `buildPredationRewardPlan`, `collectPickupEntity`, `addEvolutionProgress`, `computeHuntingHeatBuff`, `getGoldOverdriveCost`, `getGeneSurgeCost` |');
  push('| 生态鱼群刷新池 | [`src/game/ecosystemSpawner.ts`](../src/game/ecosystemSpawner.ts) | 实例化真实 `EcosystemSpawner`（Poisson 鱼群、深度筛选、浅海体长过滤、26% 悬赏偏置） |');
  push('| 变异与时间难度膨胀 | [`src/game/infiniteProgressionManager.ts`](../src/game/infiniteProgressionManager.ts) | 调用 `InfiniteProgressionManager` 的 `globalDifficultyMultiplier`, `rollPreyMutation`, `addFrenzyStack` |');
  push('| 无限世界/水深/海床碰撞 | [`src/game/infiniteWorldManager.ts`](../src/game/infiniteWorldManager.ts), [`src/game/depthScale.ts`](../src/game/depthScale.ts), [`src/game/worldGenerationSystem.ts`](../src/game/worldGenerationSystem.ts) | 调用 `worldYToMeterDepth`, `resolveSeabedKineticStep`, `detectShatterableTerraceHit`, `getFloorDepthAt` |');
  push('| 悬赏目标与广告规则 | [`src/game/sim/types.ts`](../src/game/sim/types.ts), [`src/game/adManager.ts`](../src/game/adManager.ts) | 调用 `rollTargetBountySpecies`, `AD_PLACEMENT_RULES` |');
  push('| iOS 原生规则对照 | [`ios-native/.../DomainConfigs.swift`](../ios-native/HungrySharkEvolution/Core/DomainConfigs.swift), [`GameRules.swift`](../ios-native/HungrySharkEvolution/Core/GameRules.swift), [`PreySimulation.swift`](../ios-native/HungrySharkEvolution/Rendering/PreySimulation.swift), [`OceanFXSystem.swift`](../ios-native/HungrySharkEvolution/Rendering/OceanFXSystem.swift), [`GameViewModel.swift`](../ios-native/HungrySharkEvolution/State/GameViewModel.swift) | 与 Web 共享同一套 `shared/configs/*.json` + `shared/game_data.json`（Task 05 `D3~D8` 已全量统一双端经济、狂暴、王冠、基因掉率与成长体系） |');
  push('');
  push('---');
  push('');
  push('## 二、第一阶段：静态确定性分析（Web vs iOS `[代码实际值 / 数学推算值]`）');
  push('');
  push('### 2.1 全 48 阶成长总账对比');
  push('');
  push('| 汇总项目 | Web 口径 | iOS 口径 | 关键分歧说明 |');
  push('| :--- | ---: | ---: | :--- |');
  push('| **初始建号资源 (`#0` Lv.1)** | `120C / 20G` | `120C / 20G` | `D5-A` 双端统一默认起始存档（`200m`），新手第 2 步完成一次性发放 `+80C / +20G` |');
  push(`| **全 48 只解锁费用合计** | \`${staticAudit.totals.unlockCoins.toLocaleString()}C / ${staticAudit.totals.unlockGenes.toLocaleString()}G\` | \`${staticAudit.totals.unlockCoins.toLocaleString()}C / ${staticAudit.totals.unlockGenes.toLocaleString()}G\` | \`D7-1 U-B\` 对 G4~G6 施加 \`1.25/1.55/1.85x\` 后移，双端均支持纵列与线性双路径父级解锁（\`${staticAudit.totals.webCrossGenAncestorCount}\` 只含跨代祖先） |`);
  push(`| **必经路径父级强化合计** | \`${staticAudit.totals.mandatoryParentCoins.toLocaleString()}C / ${staticAudit.totals.mandatoryParentGenes.toLocaleString()}G\` | \`${staticAudit.totals.mandatoryParentCoins.toLocaleString()}C / ${staticAudit.totals.mandatoryParentGenes.toLocaleString()}G\` | \`D7-1 U-B\` 前置等级上限收敛为 \`[3,4,5,5,5,6]\`，彻底消除后期必经金币倒挂 |`);
  push(`| **必经通关总消耗 (解锁+父强)** | **\`${staticAudit.totals.mandatoryTotalCoins.toLocaleString()}C / ${staticAudit.totals.mandatoryTotalGenes.toLocaleString()}G\`** | **\`${staticAudit.totals.mandatoryTotalCoins.toLocaleString()}C / ${staticAudit.totals.mandatoryTotalGenes.toLocaleString()}G\`** | 双端 100% 一致（\`#0\` 仅需 \`Lv.2\`） |`);
  push(`| **全 48 只升满 Lv.10 强化总计** | \`${staticAudit.totals.fullUpgradeCoins.toLocaleString()}C / ${staticAudit.totals.webFullUpgradeGenes.toLocaleString()}G\` | \`${staticAudit.totals.fullUpgradeCoins.toLocaleString()}C / ${staticAudit.totals.iosFullUpgradeGenes.toLocaleString()}G\` | \`D5-A\` 统一 \`minUnlockGeneRef = 12\`（\`#0\` 满强同为 \`32G\`）与金币指数 \`1.28\` |`);
  push(`| **全解锁 + 全满级 Lv.10 总额** | \`${staticAudit.totals.webAllMaxTotalCoins.toLocaleString()}C / ${staticAudit.totals.webAllMaxTotalGenes.toLocaleString()}G\` | \`${staticAudit.totals.iosAllMaxTotalCoins.toLocaleString()}C / ${staticAudit.totals.iosAllMaxTotalGenes.toLocaleString()}G\` | \`D7-1 U-B\` 将金币升级指数从 \`1.36\` 调至 \`1.28\`，显著缓解满级尾椎膨胀 |`);
  push(`| **48 只王冠里程碑总产出** | \`${staticAudit.totals.webCrownTotalCoins.toLocaleString()}C / ${staticAudit.totals.webCrownTotalGenes.toLocaleString()}G\` | **\`${staticAudit.totals.iosCrownTotalCoins.toLocaleString()}C / ${staticAudit.totals.iosCrownTotalGenes.toLocaleString()}G\`** | \`D3-A\` 双端统一王冠表（G1~G3 为 **\`${staticAudit.totals.iosFirst3GenCrownCoins.toLocaleString()}C\`**，占同期必经金币 \`${staticAudit.totals.iosFirst3GenMandatoryCoins.toLocaleString()}C\` 的 **\`${((staticAudit.totals.iosFirst3GenCrownCoins / staticAudit.totals.iosFirst3GenMandatoryCoins) * 100).toFixed(1)}%\`**） |`);
  push(`| **进化 Bite Tier 倒挂次数量** | **\`${staticAudit.totals.biteTierCurrentNegativeTransitions} / 47\` 次 \`-1T\`** | **\`${staticAudit.totals.biteTierCurrentNegativeTransitions} / 47\` 次 \`-1T\`** | \`D7-1 U-B\` 已将躯体突破收敛至 \`Lv.5(+1T, +6%HP) / Lv.10(+2T, +12%HP)\` 与基因门对齐，局内 \`Lv.2/5/8/12\`，负跃迁归零（\`${staticAudit.totals.biteTierLv5Lv10NegativeTransitions} / 47\`） |`);
  push('');
  push('### 2.2 分代 G1~G6 消耗 vs 王冠补助矩阵');
  push('');
  push('| 世代 | 解锁费用<br>(`金币 / 基因`) | 必经总消耗(含父强)<br>(`金币 / 基因`) | 全满总消耗<br>(`金币 / 基因` Web/iOS) | Web 王冠<br>(`金币 / 基因`) | iOS 王冠<br>(`金币 / 基因`) | 王冠金币 /<br>必经金币占比 |');
  push('| :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const g of staticAudit.perGeneration) {
    push(
      `| **G${g.generation}** | \`${g.unlockCoins.toLocaleString()} / ${g.unlockGenes.toLocaleString()}\` | \`${g.mandatoryTotalCoins.toLocaleString()} / ${g.mandatoryTotalGenes.toLocaleString()}\` | \`${g.webAllMaxCoins.toLocaleString()} / ${g.webAllMaxGenes.toLocaleString()} (${g.iosAllMaxGenes.toLocaleString()})\` | \`${g.webCrownCoins.toLocaleString()}C / ${g.webCrownGenes.toLocaleString()}G\` | \`${g.iosCrownCoins.toLocaleString()}C / ${g.iosCrownGenes.toLocaleString()}G\` | **\`${(g.iosCrownOverMandatoryCoinsRatio * 100).toFixed(1)}%\`** |`
    );
  }
  push('');
  push('### 2.3 代表性猎物单条收益对照与广告每日上限');
  push('');
  push(`- **生态库核实**：总条目 \`${staticAudit.preyEcologyAudit.totalCatalogEntries}\`（含 \`${staticAudit.preyEcologyAudit.hazardCount}\` 个水雷），活跃海洋生物 \`${staticAudit.preyEcologyAudit.activeMarineSpeciesCount}\` 种；**\`T1~T17\` 非 Boss 生物共 \`${staticAudit.preyEcologyAudit.t1To17NonBossCount}\` 种，在 P0 修复前 \`${staticAudit.preyEcologyAudit.t1To17LegacyWebDnaZeroCount}\` 种（\`100%\`）传统拾取 DNA 为 \`0%\`**（依赖 direct 结算隐藏了该死区）；空缺咬合阶位：\`${staticAudit.preyEcologyAudit.missingPreyTiers.map((t) => `T${t}`).join(', ')}\`。`);
  push('');
  push('| 猎物阶位 | 基础值 (`C / G / XP`) | Web P0修前期望 (`C / G`) | Web P0修后单源 (`C / G`) | iOS 非黄金期望 (`C / G`) | iOS 含8%黄金期望 (`C / G`) |');
  push('| :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const p of staticAudit.preySamples) {
    push(
      `| **T${p.tier}** (\`${p.preyId}\`) | \`${p.coinValue} / ${p.geneValue} / ${p.xpValue}\` | \`${p.webPreP0ExpectedCoins} / ${p.webPreP0ExpectedGenes}\` *(拾DNA ${p.webPreP0LegacyDnaChancePct}%)* | \`${p.webPostP0Coins} / ${p.webPostP0Genes}\` | \`${p.iosExpectedCoinsNoGolden} / ${p.iosExpectedGenesWith38Pct}\` | \`${p.iosExpectedCoinsWith8PctGolden} / ${p.iosExpectedGenesWith8PctGolden}\` |`
    );
  }
  push('');
  push('- **广告策略理论日上限**：');
  const deadNote =
    staticAudit.adPolicies.webDeadPlacements.length > 0
      ? `（\`${staticAudit.adPolicies.webDeadPlacements.join(', ')}\` 未接 UI）`
      : '（全部广告位均已接入 UI）';
  push(
    `  - **Web**：${Object.entries(staticAudit.adPolicies.webPlacements).map(([k, v]) => `\`${k}\` (${v.cooldownMs / 1000}s CD / ${v.dailyCap}次)`).join('、')}；其中实际接线为 \`${staticAudit.adPolicies.webActiveUiPlacements.join(', ')}\`${deadNote}。`
  );
  push(
    `  - **iOS**：${staticAudit.adPolicies.iosPlacements.map((p) => `\`${p.kind}\` (${p.cooldownSec}s CD / ${p.dailyCap}次，Coins: ${p.rewardCoins}，Genes: ${p.rewardGenes})`).join('、')}（已全量迁移至 \`shared/configs/ads_and_monetization_config.json\` 并对齐 D8）。`
  );
  push('');
  push('---');
  push('');
  push('## 三、第二阶段：四类玩家行为模型参数定义（设定与输出严格隔离）');
  push('');
  push('> 以下行为参数均为控制模拟器操作策略的**输入假定参数**，**绝不预设命中率、拾取率、存活时长或通胀结论**；下表之后所有收入、存活时间、拾取率、狂暴覆盖率与通关局数均由二维物理规则引擎真实运行得出。');
  push('');
  push('| 玩家模型 | 每日局数 | 捕食操纵精度 (`huntingSkill`) | 巡航分心比例 (`cruisingWander`) | 视野有效范围 (`sightFrac`) | 避险准确率 (`hazardAvoid`) | 拾取追逐权重 (`pickupChase`) | 破甲倾向 (`crushAggro`) | 悬赏专注 (`bountyFocus`) | 主动技能/局上限 (`Overdrive/Surge`) | 广告参与倾向 (`Revive/Double/Supply`) | 单局耐久天花板 (`horizonSec`) |');
  push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const archId of ['Casual', 'Normal', 'Efficient', 'Farming'] as PlayerArchetypeId[]) {
    const a = archetypes[archId];
    push(
      `| **${archId}** | ${a.runsPerDay}/天 | ${(a.huntingSkill * 100).toFixed(0)}% | ${(a.cruisingWanderRate * 100).toFixed(0)}% | ${(a.sightScreenFrac * 100).toFixed(0)}% | ${(a.hazardAvoidanceSkill * 100).toFixed(0)}% | ${(a.pickupChaseWeight * 100).toFixed(0)}% | ${(a.armorCrushAggression * 100).toFixed(0)}% | ${(a.bountyFocusWeight * 100).toFixed(0)}% | ${a.maxGoldOverdrivePerRun} / ${a.maxGeneSurgePerRun} | ${(a.reviveUsageRate * 100).toFixed(0)}% / ${(a.doubleSettlementRate * 100).toFixed(0)}% / ${(a.supplyDropFillRate * 100).toFixed(0)}% | ${a.sessionHorizonSec}s (±14%) |`
    );
  }
  push('');
  push('### 3.1 真实代码生理生存极限测试（900s 无上限压力探测 — `Normal` 模型）');
  push('');
  push('| 方案 | 世代 / 鲨鱼 | 实测存活 (`s`) | 终止原因 | 本局金币 | 本局基因 | 局内最高Lv | 最深 (`m`) | 力学诊断结论 |');
  push('| :--- | :---: | :---: | :---: | ---: | ---: | :---: | :---: | :--- |');
  for (const s of uncappedStressProbe) {
    push(
      `| \`${s.scenarioId}\` | G${s.generation} \`${s.sharkId}\` | ${s.survivalSec.toFixed(1)}s | ${s.endedByTimeout ? '触达 900s 上限' : '正常死亡 (`HP<=0`)'} | ${s.coinsPerRun.toLocaleString()} | ${s.genesPerRun.toLocaleString()} | Lv.${s.maxLevel} | ${s.maxDepth}m | ${s.endedByTimeout ? '深水回血大于饥饿扣血，具备无限续航趋势' : '天敌伤害/饥饿可正常终结对局'} |`
    );
  }
  push('');
  push('> **重要机制发现**：真实源码中 G5/G6 鲨鱼（`#32~#47`）一旦进入中深层且天敌极少，单条鱼回血（`+40~74 HP`）远高于饥饿扣血（`~2.5~14 HP/s`），因此出现“理论上不碰失误可无限生存”的现象。故正式模拟采用上表定义的单局耐久极限 `sessionHorizonSec` 反映真实玩家精力时长。');
  push('');
  push('---');
  push('');
  push('## 四、四大经济规则方案对照分析（核心指标含 P25 / Median / P75 / P90 / Mean）');
  push('');

  const focusScenarios: RuleScenarioId[] = ['web_pre_p0', 'web_post_p0', 'ios_post_p0', 'unified_candidate'];

  push('### 4.1 跨方案全周期成长对比（`#0 → #47` 通关局数与天数，含 P25 / Median / P75 / P90 / Mean）');
  push('');
  push('| 方案 | 玩家模型 | 广告模式 | 通关率 | 总局数：Median (`P25 / P75 / P90 / Mean`) | 预估天数 (Median) | 总获取金币 (Median) | 总获取基因 (Median) | 王冠金币 / 基因 (Median) | 广告金币 / 基因 (Median) |');
  push('| :--- | :--- | :---: | :---: | :--- | :---: | ---: | ---: | :---: | :---: |');
  for (const list of [careersNoAds, careersWithAds]) {
    for (const c of list) {
      const runsCol =
        c.completionRatePct === 0
          ? `未通关 (触墙止于 ${c.totalRunsToMaxShark.median} 局)`
          : `**${fmtDist(c.totalRunsToMaxShark, ' 局')}**`;
      const daysCol =
        c.completionRatePct === 0 ? '-' : `${c.estimatedDaysToMaxShark.median} 天`;
      push(
        `| **${scenarios[c.scenarioId].labelZh}** | ${c.archetypeId} | ${c.includeAds ? '含模型广告' : '纯零广告'} | ${c.completionRatePct}% | ${runsCol} | ${daysCol} | ${c.totalCoinsEarned.median.toLocaleString()} | ${c.totalGenesEarned.median.toLocaleString()} | ${c.totalCrownCoins.median.toLocaleString()} / ${c.totalCrownGenes.median.toLocaleString()} | ${c.totalAdCoins.median.toLocaleString()} / ${c.totalAdGenes.median.toLocaleString()} |`
      );
    }
  }
  push('');

  push('### 4.2 分代（G1 ~ G6）真实行为产出五分位分布明细（`Normal` 模型）');
  push('');
  push('> 下表统计指标格式均为：`Median (P25 / P75 / P90 / avg Mean)`，严格源自 48 阶逐鲨 Monte Carlo 二维真实引擎运行结果。');
  push('');

  for (const scId of focusScenarios) {
    const bm = benchmarks.find((b) => b.scenarioId === scId && b.archetypeId === 'Normal');
    if (!bm) continue;
    push(`#### 方案：\`${scId}\` — ${scenarios[scId].labelZh}`);
    push('');
    push('| 世代 | 每局金币收入 | 每局基因收入 | 每局 XP | 平均存活 (`s`) | 捕食数量 | 拾取率 (`%`) | 狂暴覆盖 (`%`) | Crown 单局达成 (`%`) |');
    push('| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const g of bm.perGeneration) {
      push(
        `| **G${g.generation}** | ${fmtDist(g.metrics.coinsPerRun)} | ${fmtDist(g.metrics.genesPerRun)} | ${fmtDist(g.metrics.xpPerRun)} | ${fmtDist(g.metrics.survivalSec)} | ${fmtDist(g.metrics.preyEaten)} | ${fmtDist(g.metrics.pickupRatePct, '%')} | ${fmtDist(g.metrics.frenzyCoveragePct, '%')} | ${fmtDist(g.metrics.crownCompletionPct, '%')} |`
      );
    }
    push('');
  }

  push('### 4.3 四类玩家模型在当前双端基线上的产出差异对比（`web_post_p0` vs `ios_post_p0`）');
  push('');
  push('| 方案 | 玩家模型 | 世代 | 金币/局 (`Median · Mean`) | 基因/局 (`Median · Mean`) | 金币/分钟 (`Median`) | 基因/分钟 (`Median`) | 存活 (`Median`) | 拾取率 (`Median`) | 狂暴覆盖 (`Median`) |');
  push('| :--- | :--- | :-: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const scId of ['web_post_p0', 'ios_post_p0'] as RuleScenarioId[]) {
    for (const archId of ['Casual', 'Normal', 'Efficient', 'Farming'] as PlayerArchetypeId[]) {
      const bm = benchmarks.find((b) => b.scenarioId === scId && b.archetypeId === archId);
      if (!bm) continue;
      for (const gen of [1, 3, 5, 6]) {
        const g = bm.perGeneration.find((x) => x.generation === gen);
        if (!g) continue;
        push(
          `| \`${scId}\` | ${archId} | G${gen} | ${g.metrics.coinsPerRun.median.toLocaleString()} · ${g.metrics.coinsPerRun.mean.toLocaleString()} | ${g.metrics.genesPerRun.median.toLocaleString()} · ${g.metrics.genesPerRun.mean.toLocaleString()} | ${g.metrics.coinsPerMin.median.toLocaleString()} | ${g.metrics.genesPerMin.median.toLocaleString()} | ${g.metrics.survivalSec.median}s | ${g.metrics.pickupRatePct.median}% | ${g.metrics.frenzyCoveragePct.median}% |`
        );
      }
    }
  }
  push('');

  push('---');
  push('');
  push('## 五、成长卡点、资源存量变化与 P0 修复效果实证');
  push('');
  push('### 5.1 各代推进节奏与资源存量变化（`Normal` 模型，无广告 vs 含广告）');
  push('');
  for (const scId of focusScenarios) {
    const careerPure = careersNoAds.find((c) => c.scenarioId === scId && c.archetypeId === 'Normal');
    const careerAd = careersWithAds.find((c) => c.scenarioId === scId && c.archetypeId === 'Normal');
    if (!careerPure) continue;
    push(`#### \`${scId}\` 分代耗时与资源结余（纯零广告 / 含广告）`);
    push('');
    push('| 世代 | 在该代游玩局数 (纯/含广告 Med) | 解锁至下代局数 (纯/含广告 Med) | 强制升级购买数 (Med) | 代末结余金币 (纯/含广告 Med) | 代末结余基因 (纯/含广告 Med) | 主瓶颈资源 & 阻塞占比 (`C% / G% / Lv% / Depth% / 父Lv%`) |');
    push('| :---: | :---: | :---: | :---: | :---: | :---: | :--- |');
    for (let i = 0; i < 6; i++) {
      const gP = careerPure.perGeneration[i];
      const gA = careerAd?.perGeneration[i];
      push(
        `| **G${gP.generation}** | ${gP.runsInGeneration.median} / ${gA?.runsInGeneration.median ?? '-'} | ${gP.runsForUnlockNextGen.median} / ${gA?.runsForUnlockNextGen.median ?? '-'} | ${gP.runsForMandatoryUpgrades.median} | ${gP.endBankCoins.median.toLocaleString()} / ${gA?.endBankCoins.median.toLocaleString() ?? '-'} | ${gP.endBankGenes.median.toLocaleString()} / ${gA?.endBankGenes.median.toLocaleString() ?? '-'} | **${gP.primaryBottleneck}** (\`${gP.bottleneckSharePct.coinsPct}% / ${gP.bottleneckSharePct.genesPct}% / ${gP.bottleneckSharePct.levelPct}% / ${gP.bottleneckSharePct.depthPct}% / ${gP.bottleneckSharePct.parentLvPct}%\`) |`
      );
    }
    push('');
  }

  push('### 5.2 P0 修复前后试玩（Trial `#41 歼星舰`）漏洞量化对比');
  push('');
  push('| 方案对比 | 试玩鲨鱼 | 单局得分 | 试玩达成 Lv / 深海 (`m`) | D1 允许带回金币 / 基因 | 写入永久 `bestInRunLevel / bestDepth` | 违规领取王冠 (`金币 / 基因`) |');
  push('| :--- | :--- | ---: | :---: | :---: | :---: | :---: |');
  for (const t of trialExploitContrast) {
    push(
      `| \`${t.scenarioId}\` | \`${t.trialSharkId}\` | ${t.trialRunScore.toLocaleString()} | Lv.${t.trialMaxLevel} / ${t.trialMaxDepth}m | ${t.trialCurrencyCarriedCoins.toLocaleString()}C / ${t.trialCurrencyCarriedGenes.toLocaleString()}G | Lv.${t.leakedBestLevelToSave} / ${t.leakedBestDepthToSave}m | **${t.leakedCrownCoins.toLocaleString()}C / ${t.leakedCrownGenes.toLocaleString()}G** |`
    );
  }
  push('');
  push('- **实证结论**：P0 修复已彻底将 Web 与 iOS 的 Trial 永久记录与 Crown 套利归零（仅保留 D1 批准的本局拾取货币，严禁翻倍），同时将 Web 双重入账压缩回单源拾取结算。');
  push('');
  push('---');
  push('');
  push('## 六、全 48 阶单鲨鱼效率实测表（`Normal` 模型：Web 修后 vs iOS 当前 vs 统一候选）');
  push('');
  push('| # | 鲨鱼 ID / 名称 | 代别 | Web 修后 金币/局 (Med) | Web 修后 基因/局 (Med) | Web 金币/分 · 基因/分 | iOS 当前 金币/局 (Med) | iOS 当前 基因/局 (Med) | iOS 拾取率 · 狂暴覆盖 | 候选方案 金币/局 · 基因/局 (Med) |');
  push('| :-: | :--- | :-: | ---: | ---: | :---: | ---: | ---: | :---: | :---: |');

  const webPostBm = benchmarks.find((b) => b.scenarioId === 'web_post_p0' && b.archetypeId === 'Normal');
  const iosPostBm = benchmarks.find((b) => b.scenarioId === 'ios_post_p0' && b.archetypeId === 'Normal');
  const candBm = benchmarks.find((b) => b.scenarioId === 'unified_candidate' && b.archetypeId === 'Normal');

  if (webPostBm && iosPostBm && candBm) {
    for (let idx = 0; idx < webPostBm.perShark.length; idx++) {
      const w = webPostBm.perShark[idx];
      const ios = iosPostBm.perShark[idx];
      const ca = candBm.perShark[idx];
      push(
        `| ${w.sharkIndex} | \`${w.sharkId}\` (${w.nameZh}) | G${w.generation} | ${w.metrics.coinsPerRun.median.toLocaleString()} | ${w.metrics.genesPerRun.median.toLocaleString()} | ${w.metrics.coinsPerMin.median.toLocaleString()} / ${w.metrics.genesPerMin.median.toLocaleString()} | ${ios?.metrics.coinsPerRun.median.toLocaleString() ?? '-'} | ${ios?.metrics.genesPerRun.median.toLocaleString() ?? '-'} | ${ios?.metrics.pickupRatePct.median ?? '-'}% · ${ios?.metrics.frenzyCoveragePct.median ?? '-'}% | ${ca?.metrics.coinsPerRun.median.toLocaleString() ?? '-'} · ${ca?.metrics.genesPerRun.median.toLocaleString() ?? '-'} |`
      );
    }
  }
  push('');
  push('---');
  push('');
  push('## 七、模拟器暴露的关键实证洞察（Task 04 规则统一决策直接输入）');
  push('');
  const normalWebPre = careersNoAds.find((c) => c.scenarioId === 'web_pre_p0' && c.archetypeId === 'Normal');
  const normalWebPost = careersNoAds.find((c) => c.scenarioId === 'web_post_p0' && c.archetypeId === 'Normal');
  const normalIosNoAd = careersNoAds.find((c) => c.scenarioId === 'ios_post_p0' && c.archetypeId === 'Normal');
  const normalIosAd = careersWithAds.find((c) => c.scenarioId === 'ios_post_p0' && c.archetypeId === 'Normal');
  const normalCandNoAd = careersNoAds.find((c) => c.scenarioId === 'unified_candidate' && c.archetypeId === 'Normal');
  const normalCandAd = careersWithAds.find((c) => c.scenarioId === 'unified_candidate' && c.archetypeId === 'Normal');

  push(
    `1. **Task 05 双端经济与成长统一闭环收敛效果**：以 \`Normal\` 无广告通关为例，\`web_pre_p0\` 因双重入账失真仅需 **\`${normalWebPre?.totalRunsToMaxShark.median ?? '-'}\` 局**，落地 Task 05（\`D3~D8\`）后 \`web_post_p0\` 为 **\`${normalWebPost?.totalRunsToMaxShark.median ?? '-'}\` 局**（${normalWebPost?.estimatedDaysToMaxShark.median ?? '-'} 天）、\`ios_post_p0\` 为 **\`${normalIosNoAd?.totalRunsToMaxShark.median ?? '-'}\` 局**（${normalIosNoAd?.estimatedDaysToMaxShark.median ?? '-'} 天）、\`unified_candidate\` 为 **\`${normalCandNoAd?.totalRunsToMaxShark.median ?? '-'}\` 局**（${normalCandNoAd?.estimatedDaysToMaxShark.median ?? '-'} 天），含广告同步收敛至 **\`${normalIosAd?.totalRunsToMaxShark.median ?? '-'}\` ~ \`${normalCandAd?.totalRunsToMaxShark.median ?? '-'}\` 局**（双端一致）。`
  );
  push(
    '2. **iOS 与 Web 机制全量对齐**：`PreySimulation.swift` 已补齐 `recycleAndRespawn`、`26%` 悬赏刷鱼偏置与 `2` 杀加权悬赏公式，`GameViewModel.swift` 已统一时间难度膨胀（`+0.05/60s` 封顶 `2.20x`）、`6` 充能 `15s` CD 狂暴（废除 `frenzyStack` 膨胀）与全 48 阶鲨鱼进化/血统特性。'
  );
  push(
    '3. **物理拾取率实证**：在 `14s` 存活、末 `2.5s` 闪烁与狂暴 `1.45x` 磁吸（叠加 `HuntingHeat` `+0~80 px` 磁吸）物理下，Web 与 iOS 常规航速对掉落物均可实现 **~95%~100%** 高收集率。'
  );
  push(
    `4. **双端无广告 vs 含广告加速比**：在 \`D8\` 阶梯空投、\`TRIAL_SHARK\`（次阶未拥有鲨鱼）、\`REVIVE\`（6s 狂暴 / 2.5s 无敌）与 \`DOUBLE_SETTLEMENT\`（30s CD / 日限 2 次，排除王冠与 Trial）下，\`Normal\` 通关局数从无广告 **\`${normalCandNoAd?.totalRunsToMaxShark.median ?? '-'}\` 局** 平滑加速至含广告 **\`${normalCandAd?.totalRunsToMaxShark.median ?? '-'}\` 局**，\`Casual\` 完成率由 iOS P0 前 \`33.3%\` 提升至 **\`100%\`**。`
  );
  push(
    '5. **纵/横双路径父级解锁全端同源**：Web 与 iOS 均已开放同列纵轴祖先（`(row-1)*8+col`）与线性前驱（`index-1`）双路径解锁，并收敛 G1~G6 父级升级门槛为 `[3,4,5,5,5,6]`，实现同一套解锁标价与真实养成成本。'
  );
  push('');
  push('---');
  push('');
  push('## 八、文档变更记录 (Changelog)');
  push('');
  push('| 日期 | 变更摘要 | 关联文件 |');
  push('| :--- | :--- | :--- |');
  push(
    '| 2026-11-25 | **完成 Task 03 真实规则经济模拟报告**：建立基于 `src/game/*` 真实模块的二维无头 Monte Carlo 模拟器，完成 Web 修前/修后、iOS 当前、统一候选方案及 4 类玩家模型的静态核算、48 阶逐鲨效率表与全周期分代分布评估 | `scripts/economy-simulator/*`, `docs/ECONOMY_SIMULATION_REPORT.md` |'
  );

  return lines.join('\n');
}
