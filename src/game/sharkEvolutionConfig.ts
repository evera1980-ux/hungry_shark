export type SharkLineageId =
  | 'APEX_BIO'
  | 'CYBER_MECHA'
  | 'ELEMENTAL_CORE'
  | 'ELDER_ABYSS';

export type SharkSpriteKey =
  | 'SHARK_FORM_00'
  | 'SHARK_FORM_01'
  | 'SHARK_FORM_02'
  | 'SHARK_FORM_03'
  | 'SHARK_FORM_04'
  | 'SHARK_FORM_05'
  | 'SHARK_FORM_06'
  | 'SHARK_FORM_07'
  | 'SHARK_FORM_08'
  | 'SHARK_FORM_09'
  | 'SHARK_FORM_10'
  | 'SHARK_FORM_11'
  | 'SHARK_FORM_12'
  | 'SHARK_FORM_13'
  | 'SHARK_FORM_14'
  | 'SHARK_FORM_15'
  | 'SHARK_FORM_16'
  | 'SHARK_FORM_17'
  | 'SHARK_FORM_18'
  | 'SHARK_FORM_19'
  | 'SHARK_FORM_20'
  | 'SHARK_FORM_21'
  | 'SHARK_FORM_22'
  | 'SHARK_FORM_23'
  | 'SHARK_FORM_24'
  | 'SHARK_FORM_25'
  | 'SHARK_FORM_26'
  | 'SHARK_FORM_27'
  | 'SHARK_FORM_28'
  | 'SHARK_FORM_29'
  | 'SHARK_FORM_30'
  | 'SHARK_FORM_31'
  | 'SHARK_FORM_32'
  | 'SHARK_FORM_33'
  | 'SHARK_FORM_34'
  | 'SHARK_FORM_35'
  | 'SHARK_FORM_36'
  | 'SHARK_FORM_37'
  | 'SHARK_FORM_38'
  | 'SHARK_FORM_39'
  | 'SHARK_FORM_40'
  | 'SHARK_FORM_41'
  | 'SHARK_FORM_42'
  | 'SHARK_FORM_43'
  | 'SHARK_FORM_44'
  | 'SHARK_FORM_45'
  | 'SHARK_FORM_46'
  | 'SHARK_FORM_47';

export interface SharkFormConfig {
  index: number; // 0..47
  row: number; // 0..5 (Generation I..VI)
  col: number; // 0..7
  generation: number; // 1..6
  id: string;
  spriteKey: SharkSpriteKey;
  lineage: SharkLineageId;
  nameZh: string;
  nameEn: string;
  titleZh: string;
  titleEn: string;
  traitZh: string;
  traitEn: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  /** Base bite tier at Lv.1 before in-run level & upgrade bonuses */
  baseBiteTier: number;
  baseHp: number;
  baseEnergy: number;
  speedBonus: number;
  hpDrainReduction: number;
  boostCostReduction: number;
  magnetBonus: number;
  devourHealMult: number;
  scoreMult: number;
  /** Evolution Unlock Gates */
  reqParentUpgradeLevel: number; // Required upgrade level (1..10) on either [row, col-1] or [row-1, col]
  reqMaxInRunLevel: number; // Historical or current in-run level requirement
  reqMaxDepth: number; // Historical or current max depth requirement (m)
  unlockCoins: number;
  unlockGenes: number;
  baseUpgradeCoinCost: number;
}

export interface SharkMetaSaveData {
  version: number;
  bankedCoins: number;
  bankedGenes: number;
  unlockedSharkIds: string[];
  selectedSharkId: string;
  sharkUpgradeLevels: Record<string, number>;
  bestInRunLevel: number;
  bestDepthReached: number;
  totalRunsPlayed: number;
  /** Per-shark personal best score (non-trial runs only) */
  sharkBestScores?: Record<string, number>;
  /** Per-shark highest claimed mastery crown tier (0 = none, 1 = Bronze, 2 = Silver, 3 = Gold) */
  sharkMasteryTiers?: Record<string, number>;
}

export const LINEAGE_META: Record<
  SharkLineageId,
  {
    nameZh: string;
    nameEn: string;
    badgeColor: string;
    descZh: string;
    descEn: string;
  }
> = {
  APEX_BIO: {
    nameZh: '远古狂暴血统',
    nameEn: 'Apex Leviathan',
    badgeColor: '#f43f5e',
    descZh: '高额生命上限与吞噬回血，巨口咬合判定范围扩大',
    descEn: 'High max HP & devour heal, wider jaw bite radius',
  },
  CYBER_MECHA: {
    nameZh: '赛博机甲血统',
    nameEn: 'Cyber Mecha',
    badgeColor: '#22d3ee',
    descZh: '推进极速大幅提升，冲刺能耗降低，自带大范围磁吸雷达',
    descEn: 'High swim velocity, lower boost drain & wide magnet radar',
  },
  ELEMENTAL_CORE: {
    nameZh: '地心元素血统',
    nameEn: 'Elemental Core',
    badgeColor: '#fb923c',
    descZh: '高额捕食得分加成，狂暴持续时间延长，冲刺破甲伤害倍增',
    descEn: 'High score multiplier, extended Gold Frenzy & armor break',
  },
  ELDER_ABYSS: {
    nameZh: '克苏鲁深渊血统',
    nameEn: 'Elder Abyss',
    badgeColor: '#c084fc',
    descZh: '深海饥饿代谢大幅减缓，深渊抗压无惧黑暗，额外基因结晶产出',
    descEn: 'Slow hunger drain in deep sea, abyssal resilience & bonus genes',
  },
};

export const GENERATION_NAMES: Array<{
  gen: number;
  nameZh: string;
  nameEn: string;
  color: string;
}> = [
  { gen: 1, nameZh: 'Tier I · 幼生启源阶', nameEn: 'Tier I · Juvenile Origin', color: '#38bdf8' },
  { gen: 2, nameZh: 'Tier II · 大洋猎手阶', nameEn: 'Tier II · Ocean Hunter', color: '#4ade80' },
  { gen: 3, nameZh: 'Tier III · 深海霸主阶', nameEn: 'Tier III · Deep Overlord', color: '#a855f7' },
  { gen: 4, nameZh: 'Tier IV · 狂暴元素阶', nameEn: 'Tier IV · Elemental Fury', color: '#f97316' },
  { gen: 5, nameZh: 'Tier V · 传说君王阶', nameEn: 'Tier V · Mythic Monarch', color: '#eab308' },
  { gen: 6, nameZh: 'Tier VI · 神话古神阶', nameEn: 'Tier VI · Cosmic Elder God', color: '#f43f5e' },
];

interface RawSharkSeed {
  id: string;
  lineage: SharkLineageId;
  nameZh: string;
  nameEn: string;
  titleZh: string;
  titleEn: string;
  traitZh: string;
  traitEn: string;
  colors: [string, string, string];
}

const RAW_SHARK_SEEDS: RawSharkSeed[] = [
  // ==================== ROW 0: TIER I · 幼生启源阶 (Indices 0..7) ====================
  {
    id: 'shark_00_clown_fry',
    lineage: 'APEX_BIO',
    nameZh: '拟态小丑幼鲨',
    nameEn: 'Mimic Clown Fry',
    titleZh: '破壳初生·浅礁伪装者',
    titleEn: 'Reef Camouflage Hatchling',
    traitZh: '浅海珊瑚礁完美拟态，吞噬小型鱼群额外恢复 +15% 生命',
    traitEn: '+15% HP restored from shallow reef fish schools',
    colors: ['#fb923c', '#f8fafc', '#fdba74'],
  },
  {
    id: 'shark_01_lemon_pup',
    lineage: 'APEX_BIO',
    nameZh: '柠檬黄沙幼鲨',
    nameEn: 'Lemon Sand Pup',
    titleZh: '阳光沙洲·敏捷巡游者',
    titleEn: 'Sunlit Sandbar Cruiser',
    traitZh: '初具真鲨流线体型，基础咬合阶位提升至 T2，游速 +8%',
    traitEn: 'Base Bite Tier T2 unlocked, +8% swim speed',
    colors: ['#eab308', '#fef08a', '#facc15'],
  },
  {
    id: 'shark_02_neon_reef',
    lineage: 'CYBER_MECHA',
    nameZh: '霓虹流光礁鲨',
    nameEn: 'Neon Stream Reef Shark',
    titleZh: '生物电感·极速掠影',
    titleEn: 'Bio-Electric Reef Sprinter',
    traitZh: '体表霓虹侧线感应猎物，冲刺能量消耗降低 10%，磁吸范围 +30',
    traitEn: '-10% boost energy cost, +30 magnet radius',
    colors: ['#06b6d4', '#a855f7', '#22d3ee'],
  },
  {
    id: 'shark_03_leopard_shark',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '豹纹珊瑚猎鲨',
    nameEn: 'Leopard Coral Hunter',
    titleZh: '礁盘伏击·连击新星',
    titleEn: 'Reef Ambush Predator',
    traitZh: '连击捕食得分加成提升 12%，咬碎硬壳蟹类速度加快',
    traitEn: '+12% feeding score multiplier, agile reef turning',
    colors: ['#d97706', '#fde68a', '#f59e0b'],
  },
  {
    id: 'shark_04_glow_spotted',
    lineage: 'ELDER_ABYSS',
    nameZh: '幽绿星斑幼鲨',
    nameEn: 'Bioluminescent Star Shark',
    titleZh: '微光适应·耐饥潜行者',
    titleEn: 'Twilight-Adapted Stalker',
    traitZh: '荧光斑点减缓新陈代谢，饥饿掉血速率降低 12%',
    traitEn: '-12% hunger HP drain rate',
    colors: ['#10b981', '#047857', '#34d399'],
  },
  {
    id: 'shark_05_rivet_proto',
    lineage: 'CYBER_MECHA',
    nameZh: '铆钉铁皮实验鲨',
    nameEn: 'Riveted Tin Proto-Shark',
    titleZh: '初代半机械·发条推进',
    titleEn: 'Clockwork Alloy Prototype',
    traitZh: '外挂初代合金外壳，生命上限 +25，金币与基因吸附范围 +55',
    traitEn: '+25 Max HP, +55 coin & gene magnet radius',
    colors: ['#64748b', '#cbd5e1', '#38bdf8'],
  },
  {
    id: 'shark_06_hammerhead_pup',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '双髻锤头猎鲨',
    nameEn: 'Hammerhead Radar Shark',
    titleZh: '全景声呐·360度锁定',
    titleEn: 'Panoramic Sonar Hunter',
    traitZh: '宽阔锤头具备超强电感应，悬赏目标鱼与黄金变异鱼得分 +20%',
    traitEn: '+20% score from Bounty & Golden Mutant fish',
    colors: ['#60a5fa', '#cbd5e1', '#93c5fd'],
  },
  {
    id: 'shark_07_steel_patrol',
    lineage: 'ELDER_ABYSS',
    nameZh: '重铆钢甲巡逻鲨',
    nameEn: 'Steel-Plated Patrol Shark',
    titleZh: '浅海铁卫·突破暮光',
    titleEn: 'Armored Twilight Pioneer',
    traitZh: '咬合阶位稳固提升至 T3，可轻松咬碎刺豚与狮子鱼',
    traitEn: 'Base Bite Tier T3, crushes pufferfish & lionfish',
    colors: ['#475569', '#94a3b8', '#cbd5e1'],
  },

  // ==================== ROW 1: TIER II · 大洋猎手阶 (Indices 8..15) ====================
  {
    id: 'shark_08_blacktip_reef',
    lineage: 'APEX_BIO',
    nameZh: '黑鳍远洋猎鲨',
    nameEn: 'Blacktip Pelagic Shark',
    titleZh: '浪尖飞跃·群鱼收割者',
    titleEn: 'Wave-Leaping Pack Hunter',
    traitZh: '强健背鳍带来 +15% 基础游速，吞噬回血提升 18%',
    traitEn: '+15% swim speed, +18% devour HP heal',
    colors: ['#a16207', '#f8fafc', '#fbbf24'],
  },
  {
    id: 'shark_09_blue_mako',
    lineage: 'APEX_BIO',
    nameZh: '灰鲭深蓝极速鲨',
    nameEn: 'Blue Mako Torpedo Shark',
    titleZh: '大洋闪电·顺流鱼雷',
    titleEn: 'Oceanic Lightning Torpedo',
    traitZh: '海洋中游速最快的真鲨之一，冲刺极速 +22%，冲刺回能 +25%',
    traitEn: '+22% boost speed & faster boost energy recovery',
    colors: ['#0284c7', '#e0f2fe', '#38bdf8'],
  },
  {
    id: 'shark_10_bull_shark',
    lineage: 'CYBER_MECHA',
    nameZh: '暴君公牛壮鲨',
    nameEn: 'Tyrant Bull Shark',
    titleZh: '横冲直撞·重装碎骨者',
    titleEn: 'Heavy Bone-Crusher',
    traitZh: '粗壮身躯无惧碰撞，受到不可吞噬巨兽反伤降低 25%',
    traitEn: '-25% collision damage taken from larger predators',
    colors: ['#475569', '#e2e8f0', '#94a3b8'],
  },
  {
    id: 'shark_11_tiger_shark',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '深海斑纹虎鲨',
    nameEn: 'Striped Tiger Shark',
    titleZh: '锯齿利颚·来者不拒',
    titleEn: 'Serrated-Jaw Scavenger',
    traitZh: '锯齿状颚骨可撕裂潜艇外壳，基础咬合阶位达 T4',
    traitEn: 'Base Bite Tier T4, can crunch submersibles & moray eels',
    colors: ['#78716c', '#fef3c7', '#f59e0b'],
  },
  {
    id: 'shark_12_starry_whale',
    lineage: 'ELDER_ABYSS',
    nameZh: '星夜荧光鲸鲨',
    nameEn: 'Starry Night Whale Shark',
    titleZh: '暮光滤食·群星庇护',
    titleEn: 'Mesopelagic Star Filter',
    traitZh: '宽阔巨口吸附半径扩大 35%，饥饿代谢减缓 18%',
    traitEn: '+35% jaw suction radius, -18% hunger drain',
    colors: ['#0f172a', '#38bdf8', '#7dd3fc'],
  },
  {
    id: 'shark_13_steam_conduit',
    lineage: 'CYBER_MECHA',
    nameZh: '蒸汽铜管改造鲨',
    nameEn: 'Steampunk Conduit Shark',
    titleZh: '高压锅炉·涡轮过载',
    titleEn: 'High-Pressure Boiler Shark',
    traitZh: '体外蒸汽铜管持续增压，冲刺能耗降低 20%，磁吸范围 +85',
    traitEn: '-20% boost energy drain, +85 magnet radius',
    colors: ['#0f766e', '#d97706', '#2dd4bf'],
  },
  {
    id: 'shark_14_magma_ember',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '赤焰熔火幼鲨',
    nameEn: 'Magma Ember Shark',
    titleZh: '海底火山·炙热流体',
    titleEn: 'Volcanic Vent Predator',
    traitZh: '体内流淌滚烫岩浆，捕食得分 +25%，黄金狂暴时长 +1.0秒',
    traitEn: '+25% score multiplier, +1.0s Gold Frenzy duration',
    colors: ['#ea580c', '#fde047', '#f97316'],
  },
  {
    id: 'shark_15_abyss_tentacle',
    lineage: 'ELDER_ABYSS',
    nameZh: '深渊触须变异鲨',
    nameEn: 'Abyss Tentacle Mutant',
    titleZh: '古神低语·触腕初生',
    titleEn: 'Eldritch Tendril Mutant',
    traitZh: '腹部共生深渊触须，自动拉扯近距离猎物，基因获取量 +20%',
    traitEn: 'Tendrils pull nearby prey, +20% Gene crystal yield',
    colors: ['#7e22ce', '#f472b6', '#c084fc'],
  },

  // ==================== ROW 2: TIER III · 深海霸主阶 (Indices 16..23) ====================
  {
    id: 'shark_16_great_white',
    lineage: 'APEX_BIO',
    nameZh: '远洋霸主大白鲨',
    nameEn: 'Apex Great White Shark',
    titleZh: '海洋死神·顶级掠食者',
    titleEn: 'Supreme Ocean Predator',
    traitZh: '经典深海霸主！生命上限 +90，咬合阶位达 T4，吞噬回血 +25%',
    traitEn: '+90 Max HP, Bite Tier T4, +25% devour healing',
    colors: ['#0369a1', '#f8fafc', '#38bdf8'],
  },
  {
    id: 'shark_17_sabre_tiger',
    lineage: 'APEX_BIO',
    nameZh: '远古剑齿虎鲨',
    nameEn: 'Prehistoric Sabretooth Shark',
    titleZh: '史前血脉·撕裂重甲',
    titleEn: 'Ancient Armor-Piercing Jaws',
    traitZh: '史前巨型剑齿觉醒，基础咬合阶位直达 T5，可生吞电鳗与大赤鱿',
    traitEn: 'Base Bite Tier T5, devours electric eels & giant squids',
    colors: ['#57534e', '#e7e5e4', '#a8a29e'],
  },
  {
    id: 'shark_18_battle_scar',
    lineage: 'CYBER_MECHA',
    nameZh: '百战刀疤狂鲨',
    nameEn: 'Battle-Scarred Berserker',
    titleZh: '血海修罗·越战越勇',
    titleEn: 'Relentless Frenzy Veteran',
    traitZh: '连击倍率上限提升至 2.4x，每次吞噬额外回复 4 点冲刺能量',
    traitEn: 'Combo cap raised to 2.4x, +4 extra boost energy on kill',
    colors: ['#334155', '#f43f5e', '#64748b'],
  },
  {
    id: 'shark_19_thresher_shark',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '镰尾闪电狐鲨',
    nameEn: 'Scythe-Tail Thresher Shark',
    titleZh: '长尾音爆·回旋猎杀',
    titleEn: 'Sonic Whip-Tail Hunter',
    traitZh: '修长尾鳍产生音爆推进，游速 +24%，冲刺破甲判定距离扩大',
    traitEn: '+24% swim speed, extended boost armor-break reach',
    colors: ['#0e7490', '#cffafe', '#06b6d4'],
  },
  {
    id: 'shark_20_goblin_jaw',
    lineage: 'ELDER_ABYSS',
    nameZh: '深渊弹射巨口鲨',
    nameEn: 'Abyssal Sling-Jaw Shark',
    titleZh: '千尺暗海·瞬发吞噬',
    titleEn: 'Bathyal Sling-Jaw Devourer',
    traitZh: '鄂部可向前弹射吸附，大嘴磁吸距离 +40%，饥饿消耗降低 22%',
    traitEn: '+40% jaw suction range, -22% hunger drain',
    colors: ['#312e81', '#f43f5e', '#818cf8'],
  },
  {
    id: 'shark_21_cyber_alloy',
    lineage: 'CYBER_MECHA',
    nameZh: '重装钛合金战鲨',
    nameEn: 'Titanium Cyber War-Shark',
    titleZh: '军工级改造·深海装甲舰',
    titleEn: 'Military-Grade Cybernetic Hull',
    traitZh: '全身覆盖钛合金装甲，冲刺能耗降低 28%，水雷爆炸伤害减免 40%',
    traitEn: '-28% boost cost, -40% damage taken from naval mines',
    colors: ['#475569', '#38bdf8', '#94a3b8'],
  },
  {
    id: 'shark_22_obsidian_lava',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '黑曜熔岩恶魔鲨',
    nameEn: 'Obsidian Lava Demon Shark',
    titleZh: '深海地火·熔核暴走',
    titleEn: 'Molten Core Hell-Shark',
    traitZh: '基础咬合阶位达 T5，捕食得分 +35%，黄金狂暴时长 +1.5秒',
    traitEn: 'Base Bite Tier T5, +35% score, +1.5s Gold Frenzy',
    colors: ['#7c2d12', '#f97316', '#facc15'],
  },
  {
    id: 'shark_23_mindflayer_shark',
    lineage: 'ELDER_ABYSS',
    nameZh: '克苏鲁夺心章鱼鲨',
    nameEn: 'Cthulhu Mindflayer Shark',
    titleZh: '旧日眷族·深渊精神震慑',
    titleEn: 'Old One Tentacle Scion',
    traitZh: '头部演化为巨型章鱼触手群，咬合阶位 T5，基因与金币收益 +30%',
    traitEn: 'Base Bite Tier T5, +30% Coin & Gene rewards',
    colors: ['#065f46', '#9333ea', '#c084fc'],
  },

  // ==================== ROW 3: TIER IV · 狂暴元素阶 (Indices 24..31) ====================
  {
    id: 'shark_24_megalodon',
    lineage: 'APEX_BIO',
    nameZh: '远古霸主巨齿鲨',
    nameEn: 'Prehistoric Megalodon',
    titleZh: '新生代之王·五十吨咬合力',
    titleEn: '50-Ton Bite Force Sovereign',
    traitZh: '史前海洋绝对霸主！基础咬合阶位达 T6，生命上限 +180，可咬碎帝王蟹与蝰鱼',
    traitEn: 'Base Bite Tier T6, +180 Max HP, crushes King Crabs & Viperfish',
    colors: ['#334155', '#e2e8f0', '#94a3b8'],
  },
  {
    id: 'shark_25_bio_venom',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '核能生化毒液鲨',
    nameEn: 'Bio-Radioactive Venom Shark',
    titleZh: '翡翠辐射·融甲强酸',
    titleEn: 'Emerald Fallout Meltdown',
    traitZh: '浑身流淌强酸辐射液，直接免疫并可吞噬 T6 核废料与水雷回血！',
    traitEn: 'Base Bite Tier T6, can safely devour Naval Mines & Toxic Slime!',
    colors: ['#22c55e', '#bef264', '#4ade80'],
  },
  {
    id: 'shark_26_twin_rocket',
    lineage: 'CYBER_MECHA',
    nameZh: '双联火箭推进机甲鲨',
    nameEn: 'Twin-Rocket Mecha Shark',
    titleZh: '超音速潜航·重型制导',
    titleEn: 'Supersonic Thruster Mecha',
    traitZh: '背负双联赤焰火箭引擎，游速 +32%，冲刺能耗降低 35%',
    traitEn: '+32% swim speed, -35% boost energy consumption',
    colors: ['#475569', '#ef4444', '#f87171'],
  },
  {
    id: 'shark_27_glacial_crystal',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '极地万年玄冰鲨',
    nameEn: 'Glacial Permafrost Shark',
    titleZh: '绝对零度·寒霜棱镜',
    titleEn: 'Absolute Zero Frost Prism',
    traitZh: '极寒领域使周围猎物逃逸速度减缓，饥饿掉血降低 30%，得分 +40%',
    traitEn: '-30% hunger drain, +40% score multiplier',
    colors: ['#0284c7', '#e0f2fe', '#38bdf8'],
  },
  {
    id: 'shark_28_void_lightning',
    lineage: 'ELDER_ABYSS',
    nameZh: '虚空雷霆脉冲鲨',
    nameEn: 'Void Lightning Pulse Shark',
    titleZh: '暗雷环绕·电磁超导',
    titleEn: 'Dark Plasma Ring Leviathan',
    traitZh: '周身环绕紫电引力环，磁吸半径 +160，黄金狂暴充能需求减少 1 条',
    traitEn: '+160 magnet radius, rapid Gold Frenzy charging',
    colors: ['#581c87', '#e879f9', '#c084fc'],
  },
  {
    id: 'shark_29_crimson_cyborg',
    lineage: 'CYBER_MECHA',
    nameZh: '猩红死神赛博鲨',
    nameEn: 'Crimson Reaper Cyborg',
    titleZh: '红眼歼灭者·高频激光刃',
    titleEn: 'High-Frequency Laser Fin',
    traitZh: '基础咬合阶位达 T7！可正面对决腔棘鱼与吞噬鳗，冲刺破甲无往不利',
    traitEn: 'Base Bite Tier T7! Devours Coelacanths & Gulper Eels',
    colors: ['#334155', '#f43f5e', '#fb7185'],
  },
  {
    id: 'shark_30_earth_golem',
    lineage: 'APEX_BIO',
    nameZh: '大地岩甲泰坦鲨',
    nameEn: 'Earth-Core Golem Titan',
    titleZh: '海沟盘石·不灭重甲',
    titleEn: 'Trench Bedrock Behemoth',
    traitZh: '大陆架岩石重甲护体，生命上限 +260，咬合阶位 T7，受击震退减半',
    traitEn: '+260 Max HP, Base Bite Tier T7, heavy armor',
    colors: ['#78350f', '#fb923c', '#d97706'],
  },
  {
    id: 'shark_31_multi_eyed_fiend',
    lineage: 'ELDER_ABYSS',
    nameZh: '千眼深渊魔神鲨',
    nameEn: 'Multi-Eyed Abyssal Fiend',
    titleZh: '深渊凝视·全知魔物',
    titleEn: 'All-Seeing Trench Horror',
    traitZh: '全身复眼洞察深渊，咬合阶位 T7，金币与基因获取提升 45%',
    traitEn: 'Base Bite Tier T7, +45% Coin & Gene rewards',
    colors: ['#1e1b4b', '#f43f5e', '#818cf8'],
  },

  // ==================== ROW 4: TIER V · 传说君王阶 (Indices 32..39) ====================
  {
    id: 'shark_32_chrono_mecha',
    lineage: 'CYBER_MECHA',
    nameZh: '超时空引力环机甲鲨',
    nameEn: 'Chrono Holo-Ring Mecha',
    titleZh: '曲率跃迁·霓虹奇点',
    titleEn: 'Warp-Drive Singularity Mecha',
    traitZh: '双层超时空全息环加持，游速 +38%，冲刺能耗降低 45%，磁吸 +220',
    traitEn: '+38% swim speed, -45% boost cost, +220 magnet radius',
    colors: ['#6366f1', '#f472b6', '#e879f9'],
  },
  {
    id: 'shark_33_hellfire_behemoth',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '地心业火熔岩巨兽',
    nameEn: 'Hellfire Magma Behemoth',
    titleZh: '海床崩裂·焚海君王',
    titleEn: 'Tectonic Eruption Monarch',
    traitZh: '咬合阶位 T7，生命上限 +320，黄金狂暴时长延长 +2.5秒且得分 +55%',
    traitEn: 'Bite Tier T7, +320 Max HP, +2.5s Frenzy & +55% score',
    colors: ['#9a3412', '#facc15', '#f97316'],
  },
  {
    id: 'shark_34_dark_matter',
    lineage: 'ELDER_ABYSS',
    nameZh: '黑洞暗物质吞噬鲨',
    nameEn: 'Dark Matter Singularity Shark',
    titleZh: '事件视界·万物坍缩',
    titleEn: 'Event Horizon Devourer',
    traitZh: '周身环绕黑洞漩涡，大嘴吸附半径翻倍，饥饿代谢降低 40%',
    traitEn: '2x jaw suction radius, -40% hunger HP drain',
    colors: ['#3b0764', '#a855f7', '#d8b4fe'],
  },
  {
    id: 'shark_35_golden_dragon',
    lineage: 'APEX_BIO',
    nameZh: '黄金圣龙瑞兽鲨',
    nameEn: 'Golden Imperial Dragon Shark',
    titleZh: '真龙化形·四海朝拜',
    titleEn: 'Celestial Golden Dragon Sovereign',
    traitZh: '化龙觉醒！基础咬合阶位直达 T8，金币与基因收益提升 +65%',
    traitEn: 'Base Bite Tier T8! +65% Coin & Gene drop yield',
    colors: ['#ca8a04', '#fef08a', '#facc15'],
  },
  {
    id: 'shark_36_dreadnought_cannon',
    lineage: 'CYBER_MECHA',
    nameZh: '重炮无畏战列舰鲨',
    nameEn: 'Dreadnought Cannon Battleship',
    titleZh: '深海重巡·主炮轰鸣',
    titleEn: 'Heavy Artillery War-Shark',
    traitZh: '背部搭载重型舰炮，咬合阶位 T8，无需冲刺即可直接破甲吞噬深渊巨兽！',
    traitEn: 'Base Bite Tier T8, devours Bosses & Behemoths cleanly',
    colors: ['#3f6212', '#cbd5e1', '#84cc16'],
  },
  {
    id: 'shark_37_matrix_phantom',
    lineage: 'CYBER_MECHA',
    nameZh: '矩阵代码黑客幽灵鲨',
    nameEn: 'Matrix Code Cyber-Phantom',
    titleZh: '虚拟重构·底层代码篡改',
    titleEn: 'Digital Glitch Overlord',
    traitZh: '数字化幽灵躯体，咬合阶位 T8，游速 +42%，冲刺能量恢复速度翻倍',
    traitEn: 'Base Bite Tier T8, +42% speed, 2x boost energy regen',
    colors: ['#16a34a', '#86efac', '#4ade80'],
  },
  {
    id: 'shark_38_poseidon_king',
    lineage: 'APEX_BIO',
    nameZh: '海皇波塞冬皇冠霸主',
    nameEn: 'Poseidon Crowned Sovereign',
    titleZh: '七海帝王·黄金王权',
    titleEn: 'Crowned King of the Seven Seas',
    traitZh: '头戴黄金海皇冠，咬合阶位 T8，生命上限 +400，吞噬回血提升 +50%',
    traitEn: 'Base Bite Tier T8, +400 Max HP, +50% devour healing',
    colors: ['#0284c7', '#facc15', '#fde047'],
  },
  {
    id: 'shark_39_kraken_hydra',
    lineage: 'ELDER_ABYSS',
    nameZh: '深渊九头海怪克拉肯鲨',
    nameEn: 'Kraken Hydra Leviathan Shark',
    titleZh: '触手君王·深渊支配者',
    titleEn: 'Abyssal Tentacle Monarch',
    traitZh: '融合克拉肯巨妖基因，咬合阶位 T8，反噬深海大王乌贼 Boss 额外获得 2 倍奖励',
    traitEn: 'Base Bite Tier T8, 2x rewards from devouring Abyss Bosses',
    colors: ['#0f766e', '#a855f7', '#2dd4bf'],
  },

  // ==================== ROW 5: TIER VI · 神话古神阶 (Indices 40..47) ====================
  {
    id: 'shark_40_nebula_galaxy',
    lineage: 'ELDER_ABYSS',
    nameZh: '星云银河造物主鲨',
    nameEn: 'Nebula Galaxy Cosmic Shark',
    titleZh: '星海永恒·宇宙星尘化躯',
    titleEn: 'Astral Nebula Creator',
    traitZh: '体内孕育璀璨星河，咬合阶位 T8，生命上限 +520，得分与基因收益 +80%',
    traitEn: 'Bite Tier T8, +520 Max HP, +80% Score & Gene rewards',
    colors: ['#4f46e5', '#ec4899', '#818cf8'],
  },
  {
    id: 'shark_41_star_destroyer',
    lineage: 'CYBER_MECHA',
    nameZh: '歼星舰超光速机甲神鲨',
    nameEn: 'Star-Destroyer Hyperdrive Shark',
    titleZh: '歼星武装·等离子推进神明',
    titleEn: 'Hyperdrive Mecha Deity',
    traitZh: '终极机械降神！咬合阶位 T8，游速 +50%，冲刺能耗降低 55%，全屏磁吸 +300',
    traitEn: 'Bite Tier T8, +50% speed, -55% boost cost, +300 magnet',
    colors: ['#0284c7', '#38bdf8', '#7dd3fc'],
  },
  {
    id: 'shark_42_sea_dragon_leviathan',
    lineage: 'APEX_BIO',
    nameZh: '沧溟海龙利维坦',
    nameEn: 'Azure Sea-Dragon Leviathan',
    titleZh: '远古海神·万丈狂澜',
    titleEn: 'Primordial Sea-Serpent God',
    traitZh: '完全体沧溟海龙形态！生命上限 +600，吞噬回血翻倍，饥饿消耗降低 45%',
    traitEn: 'Bite Tier T8, +600 Max HP, 2x devour heal, -45% hunger drain',
    colors: ['#0d9488', '#38bdf8', '#2dd4bf'],
  },
  {
    id: 'shark_43_solar_supernova',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '恒星日冕太阳神鲨',
    nameEn: 'Solar Corona Supernova Shark',
    titleZh: '耀斑聚变·深海永恒烈阳',
    titleEn: 'Stellar Fusion Sun-God Shark',
    traitZh: '化身恒星烈阳照亮万米深渊，黄金狂暴时长 +4.0秒，全捕食得分翻倍（2.0x）！',
    traitEn: 'Bite Tier T8, +4.0s Gold Frenzy duration, 2.0x Score multiplier!',
    colors: ['#ea580c', '#fef08a', '#facc15'],
  },
  {
    id: 'shark_44_celestial_paladin',
    lineage: 'APEX_BIO',
    nameZh: '圣光奥术神装炽天使鲨',
    nameEn: 'Celestial Arcane Paladin Shark',
    titleZh: '神圣裁决·不朽金甲',
    titleEn: 'Divine Aegis Seraph Shark',
    traitZh: '奥术圣光护体，生命上限 +650，受到任何伤害减免 50%，金币收益翻倍',
    traitEn: 'Bite Tier T8, +650 Max HP, +100% Coin yield',
    colors: ['#d97706', '#38bdf8', '#fef08a'],
  },
  {
    id: 'shark_45_chaos_void_elder',
    lineage: 'ELDER_ABYSS',
    nameZh: '混沌虚空暗影古神鲨',
    nameEn: 'Chaos Void Shadow Elder God',
    titleZh: '深渊尽头·旧日支配者真身',
    titleEn: 'Primordial Abyssal Outer God',
    traitZh: '无视深海高压代谢，饥饿掉血降低 50%，基因结晶产出翻倍（+100%）',
    traitEn: 'Bite Tier T8, -50% hunger drain, +100% Gene crystal yield',
    colors: ['#3b0764', '#9333ea', '#e879f9'],
  },
  {
    id: 'shark_46_aurora_valkyrie',
    lineage: 'ELEMENTAL_CORE',
    nameZh: '极光羽翼天界女武神鲨',
    nameEn: 'Aurora Winged Valkyrie Shark',
    titleZh: '虹光神翼·超维巡航',
    titleEn: 'Prismatic Valkyrie Sovereign',
    traitZh: '展开天界极光神翼，游速 +55%，冲刺能耗降低 55%，得分倍率 2.1x',
    traitEn: 'Bite Tier T8, +55% swim speed, -55% boost cost, 2.1x Score',
    colors: ['#6366f1', '#fde047', '#c084fc'],
  },
  {
    id: 'shark_47_omega_devourer',
    lineage: 'ELDER_ABYSS',
    nameZh: '终焉雷霆维度吞噬者·奥米茄',
    nameEn: 'Omega Dimension-Devourer Apex',
    titleZh: '第48号终极进化·万海之主',
    titleEn: 'Ultimate #48 Evolution · Lord of All Seas',
    traitZh: '48形态终极毕业古神！全属性巅峰，生命 +750，游速 +55%，全收益与得分 2.5x！',
    traitEn: 'Ultimate #48 Apex God! +750 HP, +55% speed, 2.5x Score & Rewards!',
    colors: ['#581c87', '#38bdf8', '#f472b6'],
  },
];

/**
 * Generates the complete 48-form progression matrix with Senior Game Designer numerical curves
 */
export const SHARK_EVOLUTION_FORMS: SharkFormConfig[] = RAW_SHARK_SEEDS.map(
  (seed, index) => {
    const row = Math.floor(index / 8); // 0..5
    const col = index % 8; // 0..7
    const generation = row + 1; // 1..6
    const spriteKey = `SHARK_FORM_${String(index).padStart(2, '0')}` as SharkSpriteKey;

    // Base Bite Tier progression across the 48 forms
    const baseBiteTier =
      index === 0
        ? 1
        : row === 0
        ? col >= 7
          ? 3
          : 2
        : row === 1
        ? col >= 3
          ? 4
          : 3
        : row === 2
        ? col >= 1
          ? 5
          : 4
        : row === 3
        ? col >= 5
          ? 7
          : 6
        : row === 4
        ? col >= 3
          ? 8
          : 7
        : 8;

    // Base stats scaling smoothly across 6 generations and 8 columns
    const progFactor = row * 8 + col; // 0..47
    const baseHp = Math.round(100 + row * 75 + col * 10 + (row >= 4 ? (row - 3) * 85 : 0));
    const baseEnergy = Math.round(100 + row * 22 + col * 3);

    const isBio = seed.lineage === 'APEX_BIO';
    const isMecha = seed.lineage === 'CYBER_MECHA';
    const isElem = seed.lineage === 'ELEMENTAL_CORE';
    const isAbyss = seed.lineage === 'ELDER_ABYSS';

    const speedBonus = Number(
      (progFactor * 0.01 + (isMecha ? 0.1 : isElem ? 0.05 : 0.02)).toFixed(3)
    );
    const hpDrainReduction = Number(
      Math.min(0.5, progFactor * 0.008 + (isAbyss ? 0.1 : isBio ? 0.05 : 0.02)).toFixed(3)
    );
    const boostCostReduction = Number(
      Math.min(0.6, progFactor * 0.01 + (isMecha ? 0.12 : 0.03)).toFixed(3)
    );
    const magnetBonus = Math.round(progFactor * 4.5 + (isMecha ? 55 : isAbyss ? 35 : 15));
    const devourHealMult = Number(
      (1.0 + row * 0.14 + (isBio ? 0.2 : 0.04)).toFixed(2)
    );
    const scoreMult = Number(
      (1.0 + row * 0.18 + col * 0.03 + (isElem ? 0.18 : 0)).toFixed(2)
    );

    // Triple-Gate Unlock Requirements (Level Gate + Depth Gate + Coin/Gene Cost)
    const reqParentUpgradeLevel =
      index === 0
        ? 0
        : row === 0
        ? Math.min(4, 2 + Math.floor(col / 3))
        : row === 1
        ? 4
        : row === 2
        ? 5
        : row === 3
        ? 6
        : row === 4
        ? 8
        : 9;

    const reqMaxInRunLevel =
      index === 0
        ? 1
        : row === 0
        ? Math.min(4, 1 + Math.ceil(col / 2))
        : row === 1
        ? 4 + Math.floor(col / 3)
        : row === 2
        ? 7 + Math.floor(col / 3)
        : row === 3
        ? 10 + Math.floor(col / 3)
        : row === 4
        ? 13 + Math.floor(col / 3)
        : 16 + Math.floor(col / 3);

    const reqMaxDepth =
      index === 0
        ? 0
        : row === 0
        ? 0
        : row === 1
        ? 300
        : row === 2
        ? 540
        : row === 3
        ? 850
        : row === 4
        ? 1180
        : 1450;

    // Economy cost curve per generation
    const genCoinBase = [60, 420, 1400, 3800, 9500, 22000][row];
    const genCoinStep = [35, 95, 240, 580, 1400, 3200][row];
    const unlockCoins = index === 0 ? 0 : genCoinBase + col * genCoinStep;

    const genGeneBase = [12, 85, 260, 720, 1800, 4200][row];
    const genGeneStep = [8, 20, 48, 110, 260, 620][row];
    const unlockGenes = index === 0 ? 0 : genGeneBase + col * genGeneStep;

    const baseUpgradeCoinCost = [22, 68, 185, 440, 1020, 2200][row] + col * [4, 10, 25, 55, 125, 270][row];

    return {
      index,
      row,
      col,
      generation,
      id: seed.id,
      spriteKey,
      lineage: seed.lineage,
      nameZh: seed.nameZh,
      nameEn: seed.nameEn,
      titleZh: seed.titleZh,
      titleEn: seed.titleEn,
      traitZh: seed.traitZh,
      traitEn: seed.traitEn,
      primaryColor: seed.colors[0],
      secondaryColor: seed.colors[1],
      glowColor: seed.colors[2],
      baseBiteTier,
      baseHp,
      baseEnergy,
      speedBonus,
      hpDrainReduction,
      boostCostReduction,
      magnetBonus,
      devourHealMult,
      scoreMult,
      reqParentUpgradeLevel,
      reqMaxInRunLevel,
      reqMaxDepth,
      unlockCoins,
      unlockGenes,
      baseUpgradeCoinCost,
    };
  }
);

export function getSharkFormById(id: string): SharkFormConfig {
  return (
    SHARK_EVOLUTION_FORMS.find((f) => f.id === id) ?? SHARK_EVOLUTION_FORMS[0]
  );
}

export function getSharkUpgradeCost(
  form: SharkFormConfig,
  currentUpgradeLevel: number
): number {
  const lv = Math.max(1, Math.min(10, currentUpgradeLevel));
  if (lv >= 10) return 0;
  return Math.round(form.baseUpgradeCoinCost * Math.pow(1.36, lv - 1));
}

/**
 * Gene Shard breakthrough cost for body upgrades:
 * - Regular levels (Lv.1->2, 2->3, 3->4, 5->6, 6->7, 7->8, 8->9) cost 0 Genes (Coins only).
 * - Breakthrough levels (Lv.4->5 and Lv.9->10, which permanently grant +1 Bite Tier `T`)
 *   require Gene Shards as genetic mutation catalysts!
 */
export function getSharkUpgradeGeneCost(
  form: SharkFormConfig,
  currentUpgradeLevel: number
): number {
  const lv = Math.max(1, Math.min(10, currentUpgradeLevel));
  if (lv >= 10) return 0;
  const refGenes = Math.max(20, form.unlockGenes);
  if (lv === 4) {
    // Lv.4 -> Lv.5 (+1 Bite Tier Breakthrough)
    return Math.round(refGenes * 0.35 + 6);
  }
  if (lv === 9) {
    // Lv.9 -> Lv.10 (Max-Level +1 Bite Tier Breakthrough)
    return Math.round(refGenes * 0.65 + 14);
  }
  return 0;
}

/**
 * Checks whether a shark form's parent prerequisite is satisfied:
 * A form at (row, col) can be unlocked if EITHER:
 * - Its left neighbor (row, col - 1) is unlocked and at >= reqParentUpgradeLevel
 * - OR its upper-generation ancestor (row - 1, col) is unlocked and at >= reqParentUpgradeLevel
 * - OR (for col === 0, row > 0) the previous row's last shark (row - 1, 7) is unlocked and at >= reqParentUpgradeLevel
 */
export function getParentCandidatesForForm(form: SharkFormConfig): SharkFormConfig[] {
  if (form.index === 0) return [];
  const parents: SharkFormConfig[] = [];
  const prevInSequence = SHARK_EVOLUTION_FORMS[form.index - 1];
  if (prevInSequence) {
    parents.push(prevInSequence);
  }
  if (form.row > 0) {
    const up = SHARK_EVOLUTION_FORMS[(form.row - 1) * 8 + form.col];
    if (up && !parents.includes(up)) {
      parents.push(up);
    }
  }
  return parents;
}

export interface UnlockCheckResult {
  alreadyUnlocked: boolean;
  canUnlockNow: boolean;
  parentMet: boolean;
  levelMet: boolean;
  depthMet: boolean;
  coinsMet: boolean;
  genesMet: boolean;
  bestParentId: string;
  bestParentIndex: number;
  bestParentNameZh: string;
  bestParentNameEn: string;
  bestParentCurrentLv: number;
}

export function evaluateSharkUnlock(
  form: SharkFormConfig,
  save: SharkMetaSaveData,
  liveRunCoins: number = 0,
  liveRunGenes: number = 0,
  liveRunLevel: number = 1,
  liveRunMaxDepth: number = 0
): UnlockCheckResult {
  const alreadyUnlocked = save.unlockedSharkIds.includes(form.id);
  const totalCoins = save.bankedCoins + liveRunCoins;
  const totalGenes = save.bankedGenes + liveRunGenes;
  const maxLv = Math.max(save.bestInRunLevel, liveRunLevel);
  const maxDepth = Math.max(save.bestDepthReached, Math.round(liveRunMaxDepth));

  const parents = getParentCandidatesForForm(form);
  const primaryParent =
    form.index > 0 ? SHARK_EVOLUTION_FORMS[form.index - 1] : undefined;
  let parentMet = form.index === 0;
  let bestParent = primaryParent ?? parents[0];
  let bestParentCurrentLv =
    bestParent && save.unlockedSharkIds.includes(bestParent.id)
      ? (save.sharkUpgradeLevels[bestParent.id] ?? 1)
      : 0;

  for (const p of parents) {
    const isUnlocked = save.unlockedSharkIds.includes(p.id);
    const pLv = isUnlocked ? (save.sharkUpgradeLevels[p.id] ?? 1) : 0;
    if (isUnlocked && pLv >= form.reqParentUpgradeLevel) {
      if (!parentMet) {
        bestParent = p;
        bestParentCurrentLv = pLv;
      }
      parentMet = true;
    }
  }

  const levelMet = maxLv >= form.reqMaxInRunLevel;
  const depthMet = maxDepth >= form.reqMaxDepth;
  const coinsMet = totalCoins >= form.unlockCoins;
  const genesMet = totalGenes >= form.unlockGenes;

  return {
    alreadyUnlocked,
    canUnlockNow:
      !alreadyUnlocked && parentMet && levelMet && depthMet && coinsMet && genesMet,
    parentMet,
    levelMet,
    depthMet,
    coinsMet,
    genesMet,
    bestParentId: bestParent?.id ?? '',
    bestParentIndex: bestParent?.index ?? 0,
    bestParentNameZh: bestParent?.nameZh ?? '',
    bestParentNameEn: bestParent?.nameEn ?? '',
    bestParentCurrentLv,
  };
}

/**
 * Finds the next recommended breakthrough evolution target for the currently active shark
 */
export function getNextEvolutionTarget(
  currentFormId: string,
  save: SharkMetaSaveData
): SharkFormConfig | null {
  const current = getSharkFormById(currentFormId);
  // 1. Check direct right neighbor in same generation (row, col + 1)
  if (current.col < 7) {
    const right = SHARK_EVOLUTION_FORMS[current.row * 8 + (current.col + 1)];
    if (right && !save.unlockedSharkIds.includes(right.id)) {
      return right;
    }
  }
  // 2. Check direct vertical descendant in next generation (row + 1, col)
  if (current.row < 5) {
    const down = SHARK_EVOLUTION_FORMS[(current.row + 1) * 8 + current.col];
    if (down && !save.unlockedSharkIds.includes(down.id)) {
      return down;
    }
  }
  // 3. Otherwise, first locked shark in the 48-form list
  return (
    SHARK_EVOLUTION_FORMS.find((f) => !save.unlockedSharkIds.includes(f.id)) ?? null
  );
}

const META_SAVE_STORAGE_KEY = 'hungry_shark_evo_meta_v1';

export function createDefaultMetaSave(): SharkMetaSaveData {
  return {
    version: 1,
    bankedCoins: 120, // Starter scholarship so new players can immediately test upgrading Lv.1 -> Lv.3!
    bankedGenes: 25,
    unlockedSharkIds: ['shark_00_clown_fry'],
    selectedSharkId: 'shark_00_clown_fry',
    sharkUpgradeLevels: {
      shark_00_clown_fry: 1,
    },
    bestInRunLevel: 1,
    bestDepthReached: 220,
    totalRunsPlayed: 0,
    sharkBestScores: {},
    sharkMasteryTiers: {},
  };
}

export function loadSharkMetaSave(): SharkMetaSaveData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultMetaSave();
  }
  try {
    const raw = window.localStorage.getItem(META_SAVE_STORAGE_KEY);
    if (!raw) return createDefaultMetaSave();
    const parsed = JSON.parse(raw) as Partial<SharkMetaSaveData>;
    const defaults = createDefaultMetaSave();
    const unlocked = Array.isArray(parsed.unlockedSharkIds) && parsed.unlockedSharkIds.length > 0
      ? parsed.unlockedSharkIds
      : defaults.unlockedSharkIds;
    return {
      version: 1,
      bankedCoins: typeof parsed.bankedCoins === 'number' ? Math.max(0, Math.floor(parsed.bankedCoins)) : defaults.bankedCoins,
      bankedGenes: typeof parsed.bankedGenes === 'number' ? Math.max(0, Math.floor(parsed.bankedGenes)) : defaults.bankedGenes,
      unlockedSharkIds: unlocked,
      selectedSharkId:
        typeof parsed.selectedSharkId === 'string' && unlocked.includes(parsed.selectedSharkId)
          ? parsed.selectedSharkId
          : unlocked[0],
      sharkUpgradeLevels:
        parsed.sharkUpgradeLevels && typeof parsed.sharkUpgradeLevels === 'object'
          ? { ...defaults.sharkUpgradeLevels, ...parsed.sharkUpgradeLevels }
          : defaults.sharkUpgradeLevels,
      bestInRunLevel: typeof parsed.bestInRunLevel === 'number' ? Math.max(1, parsed.bestInRunLevel) : 1,
      bestDepthReached: typeof parsed.bestDepthReached === 'number' ? Math.max(220, parsed.bestDepthReached) : 220,
      totalRunsPlayed: typeof parsed.totalRunsPlayed === 'number' ? Math.max(0, parsed.totalRunsPlayed) : 0,
      sharkBestScores:
        parsed.sharkBestScores && typeof parsed.sharkBestScores === 'object'
          ? { ...parsed.sharkBestScores }
          : {},
      sharkMasteryTiers:
        parsed.sharkMasteryTiers && typeof parsed.sharkMasteryTiers === 'object'
          ? { ...parsed.sharkMasteryTiers }
          : {},
    };
  } catch {
    return createDefaultMetaSave();
  }
}

export function saveSharkMetaSave(data: SharkMetaSaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(META_SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export interface SharkMasteryTierInfo {
  tier: 1 | 2 | 3;
  badgeIcon: '🥉' | '🥈' | '👑';
  nameZh: string;
  nameEn: string;
  scoreThreshold: number;
  geneReward: number;
}

/**
 * Computes the 3 Mastery Crown thresholds and one-time first-clear Gene Shard rewards
 * for a specific shark form based on its generation row (0..5) and column (0..7).
 */
export function getSharkMasteryConfig(
  form: SharkFormConfig
): [SharkMasteryTierInfo, SharkMasteryTierInfo, SharkMasteryTierInfo] {
  const rowBaseScores = [3500, 8000, 18000, 38000, 75000, 140000];
  const rowColSteps = [500, 1000, 2000, 4000, 7500, 12000];
  const rowIdx = Math.max(0, Math.min(5, form.row));
  const colIdx = Math.max(0, Math.min(7, form.col));

  const bronzeScore = rowBaseScores[rowIdx] + colIdx * rowColSteps[rowIdx];
  const silverScore = Math.round(bronzeScore * 2.4);
  const goldScore = Math.round(bronzeScore * 5.0);

  const bronzeGenes = 12 + rowIdx * 8 + Math.floor(colIdx / 2) * 2;
  const silverGenes = 24 + rowIdx * 16 + colIdx * 2;
  const goldGenes = 45 + rowIdx * 30 + colIdx * 4;

  return [
    {
      tier: 1,
      badgeIcon: '🥉',
      nameZh: '铜冠·掠食者',
      nameEn: 'Bronze Predator',
      scoreThreshold: bronzeScore,
      geneReward: bronzeGenes,
    },
    {
      tier: 2,
      badgeIcon: '🥈',
      nameZh: '银冠·深海领主',
      nameEn: 'Silver Overlord',
      scoreThreshold: silverScore,
      geneReward: silverGenes,
    },
    {
      tier: 3,
      badgeIcon: '👑',
      nameZh: '金冠·深渊霸主',
      nameEn: 'Gold Apex Monarch',
      scoreThreshold: goldScore,
      geneReward: goldGenes,
    },
  ];
}

export interface SharkMasterySettlementResult {
  updatedSave: SharkMetaSaveData;
  prevBestScore: number;
  newBestScore: number;
  isNewRecord: boolean;
  prevCrownTier: number;
  newCrownTier: number;
  newlyUnlockedTiers: SharkMasteryTierInfo[];
  genesAwarded: number;
  nextThresholdScore: number | null;
}

/**
 * Evaluates and settles a shark's single-run score against its 3 Mastery Crown tiers.
 * - Strictly isolates Trial runs (trialActive === true never records best scores or claims crowns).
 * - Awards one-time First-Clear Gene Shards ONLY for newly reached crown tiers (preventing suicide farming or inflation).
 */
export function settleSharkScoreMastery(
  sharkFormId: string,
  runScore: number,
  trialActive: boolean,
  save: SharkMetaSaveData
): SharkMasterySettlementResult {
  const form = getSharkFormById(sharkFormId);
  const tiers = getSharkMasteryConfig(form);
  const bestScoresMap = save.sharkBestScores ?? {};
  const masteryMap = save.sharkMasteryTiers ?? {};

  const prevBestScore = bestScoresMap[form.id] ?? 0;
  const prevCrownTier = masteryMap[form.id] ?? 0;

  if (trialActive) {
    const nextTierInfo = tiers.find((t) => t.tier > prevCrownTier) ?? null;
    return {
      updatedSave: save,
      prevBestScore,
      newBestScore: prevBestScore,
      isNewRecord: false,
      prevCrownTier,
      newCrownTier: prevCrownTier,
      newlyUnlockedTiers: [],
      genesAwarded: 0,
      nextThresholdScore: nextTierInfo ? nextTierInfo.scoreThreshold : null,
    };
  }

  const cleanScore = Math.max(0, Math.floor(runScore));
  const newBestScore = Math.max(prevBestScore, cleanScore);
  const isNewRecord = cleanScore > prevBestScore && cleanScore > 0;

  let achievedTier = prevCrownTier;
  const newlyUnlockedTiers: SharkMasteryTierInfo[] = [];
  let genesAwarded = 0;

  for (const tierInfo of tiers) {
    if (cleanScore >= tierInfo.scoreThreshold && tierInfo.tier > prevCrownTier) {
      achievedTier = Math.max(achievedTier, tierInfo.tier);
      newlyUnlockedTiers.push(tierInfo);
      genesAwarded += tierInfo.geneReward;
    }
  }

  const nextTierInfo = tiers.find((t) => t.tier > achievedTier) ?? null;

  if (!isNewRecord && newlyUnlockedTiers.length === 0) {
    return {
      updatedSave: save,
      prevBestScore,
      newBestScore,
      isNewRecord: false,
      prevCrownTier,
      newCrownTier: prevCrownTier,
      newlyUnlockedTiers: [],
      genesAwarded: 0,
      nextThresholdScore: nextTierInfo ? nextTierInfo.scoreThreshold : null,
    };
  }

  const updatedSave: SharkMetaSaveData = {
    ...save,
    bankedGenes: save.bankedGenes + genesAwarded,
    sharkBestScores: {
      ...bestScoresMap,
      [form.id]: newBestScore,
    },
    sharkMasteryTiers: {
      ...masteryMap,
      [form.id]: achievedTier,
    },
  };

  return {
    updatedSave,
    prevBestScore,
    newBestScore,
    isNewRecord,
    prevCrownTier,
    newCrownTier: achievedTier,
    newlyUnlockedTiers,
    genesAwarded,
    nextThresholdScore: nextTierInfo ? nextTierInfo.scoreThreshold : null,
  };
}

export function getGlobalAtlasBonuses(save: SharkMetaSaveData): {
  unlockedCount: number;
  totalMasteryCrowns: number;
  hpMultiplier: number;
  speedBonus: number;
  rewardMultiplier: number;
} {
  const unlockedCount = Math.max(1, save.unlockedSharkIds.length);
  const extraCount = unlockedCount - 1;
  const masteryMap = save.sharkMasteryTiers ?? {};
  const totalMasteryCrowns = Object.values(masteryMap).reduce(
    (sum, tier) => sum + Math.max(0, Math.min(3, tier || 0)),
    0
  );
  return {
    unlockedCount,
    totalMasteryCrowns,
    hpMultiplier: Number((1 + extraCount * 0.02).toFixed(3)),
    speedBonus: Number((extraCount * 0.008).toFixed(3)),
    rewardMultiplier: Number((1 + extraCount * 0.025).toFixed(3)),
  };
}
