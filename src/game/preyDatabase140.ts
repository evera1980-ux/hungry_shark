import type { PreyBehavior, PreyTierConfig } from './config';

export type Prey140SizeClass = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '巨型';
export type Prey140Category = '普通鱼类' | '大型海洋生物' | '巨型海洋生物';

export interface Prey140RawRecord {
  id: string;
  nameZh: string;
  nameEn: string;
  category: Prey140Category;
  realMinDepth: number;
  realMaxDepth: number;
  minLengthCm: number;
  maxLengthCm: number;
  sizeClass: Prey140SizeClass;
}

type RawPreyTuple = [
  id: string,
  nameZh: string,
  nameEn: string,
  category: Prey140Category,
  realMinDepth: number,
  realMaxDepth: number,
  minLengthCm: number,
  maxLengthCm: number,
  sizeClass: Prey140SizeClass,
];

const RAW_PREY_140_TUPLES: RawPreyTuple[] = [
  ['PREY-001', '小丑鱼', 'Clownfish', '普通鱼类', 1, 30, 5, 12, 'XS'],
  ['PREY-002', '蓝倒吊', 'Regal Blue Tang', '普通鱼类', 1, 40, 15, 30, 'S'],
  ['PREY-003', '黄尾蓝雀鲷', 'Yellowtail Damselfish', '普通鱼类', 1, 30, 5, 10, 'XS'],
  ['PREY-004', '黄雀鲷', 'Yellow Damselfish', '普通鱼类', 1, 20, 5, 12, 'XS'],
  ['PREY-005', '蝴蝶鱼', 'Butterflyfish', '普通鱼类', 1, 30, 10, 20, 'S'],
  ['PREY-006', '镰鱼', 'Moorish Idol Zanclus', '普通鱼类', 1, 30, 15, 25, 'S'],
  ['PREY-007', '神仙鱼', 'Angelfish', '普通鱼类', 1, 30, 10, 25, 'S'],
  ['PREY-008', '火焰仙', 'Flame Angelfish', '普通鱼类', 1, 30, 8, 15, 'XS'],
  ['PREY-009', '皇家雀鲷', 'Royal Gramma', '普通鱼类', 1, 30, 5, 8, 'XS'],
  ['PREY-010', '黄头龙', 'Yellowhead Wrasse', '普通鱼类', 1, 25, 5, 10, 'XS'],
  ['PREY-011', '绿鹦嘴鱼', 'Green Parrotfish', '普通鱼类', 1, 30, 20, 40, 'M'],
  ['PREY-012', '红鹦嘴鱼', 'Red Parrotfish', '普通鱼类', 1, 30, 20, 40, 'M'],
  ['PREY-013', '彩虹隆头鱼', 'Rainbow Wrasse', '普通鱼类', 1, 30, 20, 35, 'M'],
  ['PREY-014', '六线隆头鱼', 'Sixline Wrasse', '普通鱼类', 1, 30, 5, 10, 'XS'],
  ['PREY-015', '霓虹雀鲷', 'Neon Damselfish', '普通鱼类', 1, 30, 5, 10, 'XS'],
  ['PREY-016', '红鲷', 'Red Snapper', '普通鱼类', 5, 100, 30, 60, 'M'],
  ['PREY-017', '黄尾笛鲷', 'Yellowtail Snapper', '普通鱼类', 10, 180, 30, 60, 'M'],
  ['PREY-018', '灰笛鲷', 'Gray Snapper', '普通鱼类', 1, 180, 30, 60, 'M'],
  ['PREY-019', '红石斑鱼', 'Red Grouper', '普通鱼类', 2, 100, 30, 60, 'M'],
  ['PREY-020', '石斑鱼', 'Grouper', '普通鱼类', 5, 100, 30, 70, 'M'],
  ['PREY-021', '黑鲈', 'Black Bass', '普通鱼类', 1, 50, 25, 50, 'M'],
  ['PREY-022', '蓝鳃太阳鱼', 'Bluegill Sunfish', '普通鱼类', 1, 30, 10, 25, 'S'],
  ['PREY-023', '金线鱼', 'Threadfin Bream', '普通鱼类', 10, 100, 20, 40, 'M'],
  ['PREY-024', '羊鱼', 'Goatfish', '普通鱼类', 1, 90, 20, 40, 'M'],
  ['PREY-025', '海鲫', 'Sea Bream', '普通鱼类', 1, 60, 20, 40, 'M'],
  ['PREY-026', '扳机鱼', 'Triggerfish', '普通鱼类', 1, 50, 20, 40, 'M'],
  ['PREY-027', '黑扳机鱼', 'Black Triggerfish', '普通鱼类', 1, 75, 30, 50, 'M'],
  ['PREY-028', '狐鲷', 'Hogfish', '普通鱼类', 3, 70, 20, 50, 'M'],
  ['PREY-029', '黄鳍金枪鱼(亚成体)', 'Yellowfin Tuna (Juvenile)', '普通鱼类', 1, 250, 50, 100, 'L'],
  ['PREY-030', '鲭鱼', 'Mackerel', '普通鱼类', 0, 200, 25, 50, 'M'],
  ['PREY-031', '比目鱼', 'Flounder', '普通鱼类', 5, 200, 20, 50, 'M'],
  ['PREY-032', '鲽鱼', 'Plaice', '普通鱼类', 5, 150, 20, 45, 'M'],
  ['PREY-033', '绿鳍鱼', 'Greenling', '普通鱼类', 5, 60, 10, 25, 'S'],
  ['PREY-034', '虾虎鱼', 'Goby', '普通鱼类', 1, 60, 5, 15, 'XS'],
  ['PREY-035', '弹涂鱼', 'Mudskipper', '普通鱼类', 0, 5, 5, 15, 'XS'],
  ['PREY-036', '鲉鱼', 'Scorpionfish', '普通鱼类', 5, 200, 15, 35, 'M'],
  ['PREY-037', '石狗公', 'Rockfish', '普通鱼类', 5, 100, 15, 30, 'S'],
  ['PREY-038', '鲂鱼', 'Dory', '普通鱼类', 10, 200, 20, 50, 'M'],
  ['PREY-039', '鲉鲂', 'Gurnard', '普通鱼类', 20, 200, 15, 35, 'M'],
  ['PREY-040', '海鲂', 'Sea Bream Dory', '普通鱼类', 10, 100, 20, 50, 'M'],
  ['PREY-041', '灯笼鱼', 'Lanternfish', '普通鱼类', 100, 1000, 5, 12, 'XS'],
  ['PREY-042', '银斧鱼', 'Hatchetfish', '普通鱼类', 200, 1000, 5, 12, 'XS'],
  ['PREY-043', '鲱鱼', 'Herring', '普通鱼类', 0, 300, 20, 35, 'M'],
  ['PREY-044', '沙丁鱼', 'Sardine', '普通鱼类', 0, 200, 10, 20, 'S'],
  ['PREY-045', '凤尾鱼', 'Anchovy', '普通鱼类', 0, 200, 8, 15, 'XS'],
  ['PREY-046', '飞鱼', 'Flying Fish', '普通鱼类', 0, 200, 20, 30, 'M'],
  ['PREY-047', '鲳鱼', 'Pomfret', '普通鱼类', 10, 200, 20, 40, 'M'],
  ['PREY-048', '鲹鱼', 'Trevally', '普通鱼类', 0, 200, 30, 60, 'M'],
  ['PREY-049', '金眼鲷', 'Alfonsino', '普通鱼类', 50, 500, 20, 40, 'M'],
  ['PREY-050', '黄箱鲀', 'Yellow Boxfish', '普通鱼类', 1, 50, 10, 25, 'S'],
  ['PREY-051', '狗脸鲀', 'Dogface Puffer', '普通鱼类', 1, 50, 20, 40, 'M'],
  ['PREY-052', '刺豚', 'Porcupinefish', '普通鱼类', 1, 100, 20, 40, 'M'],
  ['PREY-053', '蓝点河豚', 'Blue-Spotted Puffer', '普通鱼类', 1, 50, 5, 10, 'XS'],
  ['PREY-054', '长角牛角鱼', 'Longhorn Cowfish', '普通鱼类', 1, 50, 5, 30, 'S'],
  ['PREY-055', '镰蝴蝶鱼', 'Sickle Butterflyfish', '普通鱼类', 1, 50, 10, 20, 'S'],
  ['PREY-056', '飘带鱼（角镰鱼）', 'Bannerfish', '普通鱼类', 1, 50, 10, 20, 'S'],
  ['PREY-057', '穆尔什偶像鱼', 'Moorish Idol', '普通鱼类', 1, 100, 15, 25, 'S'],
  ['PREY-058', '狐面鱼', 'Foxface Rabbitfish', '普通鱼类', 1, 50, 15, 25, 'S'],
  ['PREY-059', '红海小丑鱼', 'Red Sea Clownfish', '普通鱼类', 1, 30, 5, 12, 'XS'],
  ['PREY-060', '鬼头刀（鲯鳅）', 'Mahi-Mahi', '普通鱼类', 0, 100, 50, 100, 'L'],
  ['PREY-061', '长鳍金枪鱼', 'Albacore Tuna', '普通鱼类', 0, 600, 50, 100, 'L'],
  ['PREY-062', '鲣鱼', 'Skipjack Tuna', '普通鱼类', 0, 260, 40, 80, 'L'],
  ['PREY-063', '蓝鳍金枪鱼(亚成体)', 'Bluefin Tuna (Subadult)', '普通鱼类', 0, 1000, 100, 200, 'XL'],
  ['PREY-064', '马鲛鱼', 'King Mackerel', '普通鱼类', 0, 200, 40, 100, 'L'],
  ['PREY-065', '大西洋鲭鲹', 'Atlantic Scad', '普通鱼类', 0, 200, 30, 70, 'M'],
  ['PREY-066', '蓝鱼', 'Bluefish', '普通鱼类', 0, 200, 30, 100, 'L'],
  ['PREY-067', '大海鲢(幼体)', 'Tarpon (Juvenile)', '普通鱼类', 0, 100, 50, 150, 'XL'],
  ['PREY-068', '大眼鲹', 'Bigeye Trevally', '普通鱼类', 0, 100, 20, 60, 'M'],
  ['PREY-069', '狮子鱼', 'Lionfish', '普通鱼类', 1, 100, 15, 30, 'M'],
  ['PREY-070', '蛙鱼（躄鱼）', 'Frogfish', '普通鱼类', 1, 100, 5, 20, 'S'],
  ['PREY-071', '蓝箱鲀', 'Blue Boxfish', '普通鱼类', 1, 50, 10, 25, 'S'],
  ['PREY-072', '白斑河豚', 'White-Spotted Puffer', '普通鱼类', 1, 100, 10, 30, 'S'],
  ['PREY-073', '星鲀', 'Starry Puffer', '普通鱼类', 1, 100, 10, 30, 'S'],
  ['PREY-074', '鲻鱼', 'Mullet', '普通鱼类', 0, 100, 20, 50, 'M'],
  ['PREY-075', '沙梭鱼', 'Sand Whiting', '普通鱼类', 1, 100, 10, 30, 'S'],
  ['PREY-076', '小型圆鳐', 'Round Stingray', '普通鱼类', 1, 200, 30, 80, 'L'],
  ['PREY-077', '鲆鱼', 'Summer Flounder', '普通鱼类', 5, 100, 20, 50, 'M'],
  ['PREY-078', '鲬鱼', 'Flathead', '普通鱼类', 5, 200, 15, 40, 'M'],
  ['PREY-079', '蝰鱼', 'Viperfish', '普通鱼类', 200, 1500, 20, 35, 'M'],
  ['PREY-080', '尖牙鱼', 'Fangtooth', '普通鱼类', 200, 2000, 10, 20, 'S'],
  ['PREY-081', '黑龙鱼', 'Black Dragonfish', '普通鱼类', 200, 2000, 10, 30, 'M'],
  ['PREY-082', '斧头龙鱼', 'Hatchet Dragonfish', '普通鱼类', 200, 1000, 5, 15, 'S'],
  ['PREY-083', '深海龙鱼', 'Stoplight Loosejaw', '普通鱼类', 500, 2000, 10, 30, 'M'],
  ['PREY-084', '闪光灯笼鱼', 'Flashlight Fish', '普通鱼类', 200, 1000, 5, 15, 'XS'],
  ['PREY-085', '珍珠眼鱼', 'Pearleye', '普通鱼类', 200, 1000, 10, 20, 'S'],
  ['PREY-086', '黑叉齿鱼', 'Black Swallower', '普通鱼类', 500, 2000, 10, 25, 'S'],
  ['PREY-087', '深海银鱼', 'Deep-Sea Argentine', '普通鱼类', 200, 1000, 5, 20, 'XS'],
  ['PREY-088', '深海金眼鱼', 'Abyssal Alfonsino', '普通鱼类', 500, 2000, 10, 30, 'M'],
  ['PREY-089', '小型鲨鱼（猫鲨类）', 'Catshark', '普通鱼类', 0, 500, 40, 100, 'L'],
  ['PREY-090', '斑马鲨', 'Zebra Shark', '普通鱼类', 0, 60, 100, 250, 'XL'],
  ['PREY-091', '护士鲨', 'Nurse Shark', '普通鱼类', 0, 130, 200, 300, 'XL'],
  ['PREY-092', '礁鲨（黑鳍）', 'Blacktip Reef Shark', '普通鱼类', 0, 75, 100, 200, 'L'],
  ['PREY-093', '礁鲨（白鳍）', 'Whitetip Reef Shark', '普通鱼类', 0, 330, 150, 250, 'XL'],
  ['PREY-094', '锤头鲨（小型种）', 'Bonnethead Shark', '普通鱼类', 0, 275, 100, 200, 'XL'],
  ['PREY-095', '短尾真鲨', 'Spinner Shark', '普通鱼类', 0, 500, 150, 250, 'XL'],
  ['PREY-096', '柠檬鲨', 'Lemon Shark', '普通鱼类', 0, 90, 200, 350, 'XL'],
  ['PREY-097', '沙虎鲨', 'Sand Tiger Shark', '普通鱼类', 0, 200, 100, 300, 'XL'],
  ['PREY-098', '角鲨', 'Spiny Dogfish', '普通鱼类', 50, 1000, 60, 120, 'L'],
  ['PREY-099', '刺鲀（长刺）', 'Long-Spined Porcupinefish', '普通鱼类', 1, 100, 30, 60, 'M'],
  ['PREY-100', '大西洋鲑', 'Atlantic Salmon', '普通鱼类', 0, 200, 50, 100, 'L'],
  ['PREY-101', '巨型石斑鱼', 'Giant Grouper', '大型海洋生物', 4, 100, 150, 250, 'XL'],
  ['PREY-102', '大西洋巨石斑鱼', 'Atlantic Goliath Grouper', '大型海洋生物', 5, 100, 150, 240, 'XL'],
  ['PREY-103', '翻车鱼', 'Ocean Sunfish', '大型海洋生物', 0, 600, 150, 300, 'XL'],
  ['PREY-104', '蓝鳍金枪鱼', 'Atlantic Bluefin Tuna', '大型海洋生物', 0, 1000, 100, 300, 'XL'],
  ['PREY-105', '大眼金枪鱼', 'Bigeye Tuna', '大型海洋生物', 0, 500, 100, 200, 'XL'],
  ['PREY-106', '蓝枪鱼', 'Blue Marlin', '大型海洋生物', 0, 200, 200, 400, 'XXL'],
  ['PREY-107', '黑枪鱼', 'Black Marlin', '大型海洋生物', 0, 200, 200, 400, 'XXL'],
  ['PREY-108', '大海鲢', 'Giant Tarpon', '大型海洋生物', 0, 100, 100, 200, 'XL'],
  ['PREY-109', '巨型鳐鱼', 'Giant Stingray', '大型海洋生物', 0, 200, 150, 300, 'XL'],
  ['PREY-110', '蝠鲼', 'Giant Manta Ray', '大型海洋生物', 0, 450, 400, 700, 'XXL'],
  ['PREY-111', '鲸鲨', 'Whale Shark', '大型海洋生物', 0, 200, 400, 800, 'XXL'],
  ['PREY-112', '大白鲨', 'Great White Shark', '大型海洋生物', 0, 250, 300, 500, 'XXL'],
  ['PREY-113', '虎鲨', 'Tiger Shark', '大型海洋生物', 0, 350, 300, 500, 'XXL'],
  ['PREY-114', '棱皮龟', 'Leatherback Sea Turtle', '大型海洋生物', 0, 1000, 120, 180, 'XL'],
  ['PREY-115', '绿海龟', 'Green Sea Turtle', '大型海洋生物', 0, 100, 80, 120, 'L'],
  ['PREY-116', '赤蠵龟', 'Loggerhead Sea Turtle', '大型海洋生物', 0, 200, 80, 110, 'L'],
  ['PREY-117', '旗鱼', 'Indo-Pacific Sailfish', '大型海洋生物', 0, 200, 200, 300, 'XL'],
  ['PREY-118', '黄鳍金枪鱼', 'Yellowfin Tuna', '大型海洋生物', 0, 250, 150, 200, 'XL'],
  ['PREY-119', '大型海鲹', 'Giant Trevally', '大型海洋生物', 0, 200, 100, 170, 'L'],
  ['PREY-120', '宽吻海豚', 'Bottlenose Dolphin', '大型海洋生物', 0, 300, 250, 400, 'XL'],
  ['PREY-121', '长吻海豚', 'Spinner Dolphin', '大型海洋生物', 0, 300, 200, 300, 'L'],
  ['PREY-127', '大西洋鲟', 'Atlantic Sturgeon', '大型海洋生物', 0, 200, 150, 300, 'XL'],
  ['PREY-128', '白鲟', 'Beluga Sturgeon', '大型海洋生物', 0, 100, 200, 400, 'XXL'],
  ['PREY-129', '巨型梭鱼', 'Great Barracuda', '大型海洋生物', 0, 100, 100, 200, 'XL'],
  ['PREY-130', '大型旗鲷', 'Cubera Snapper', '大型海洋生物', 10, 200, 100, 180, 'L'],
  ['PREY-201', '抹香鲸', 'Sperm Whale', '巨型海洋生物', 0, 1200, 1200, 1800, '巨型'],
  ['PREY-202', '座头鲸', 'Humpback Whale', '巨型海洋生物', 0, 200, 1000, 1500, '巨型'],
  ['PREY-203', '灰鲸', 'Gray Whale', '巨型海洋生物', 0, 200, 1000, 1500, '巨型'],
  ['PREY-204', '蓝鲸', 'Blue Whale', '巨型海洋生物', 0, 200, 1500, 2500, '巨型'],
  ['PREY-205', '长须鲸', 'Fin Whale', '巨型海洋生物', 0, 300, 1500, 2000, '巨型'],
  ['PREY-206', '虎鲸', 'Orca', '巨型海洋生物', 0, 300, 500, 800, '巨型'],
  ['PREY-207', '伪虎鲸', 'False Killer Whale', '巨型海洋生物', 0, 1000, 400, 600, 'XXL'],
  ['PREY-208', '领航鲸', 'Pilot Whale', '巨型海洋生物', 0, 1000, 400, 600, 'XXL'],
  ['PREY-210', '蓝鲸幼体/亚成体', 'Juvenile Blue Whale', '巨型海洋生物', 0, 200, 800, 1500, '巨型'],
];

export const PREY_140_RECORDS: Prey140RawRecord[] = RAW_PREY_140_TUPLES.map(
  ([
    id,
    nameZh,
    nameEn,
    category,
    realMinDepth,
    realMaxDepth,
    minLengthCm,
    maxLengthCm,
    sizeClass,
  ]) => ({
    id,
    nameZh,
    nameEn,
    category,
    realMinDepth,
    realMaxDepth,
    minLengthCm,
    maxLengthCm,
    sizeClass,
  })
);

export const PREY_140_RECORD_BY_ID: Record<string, Prey140RawRecord> =
  Object.fromEntries(PREY_140_RECORDS.map((r) => [r.id, r]));

export const PREY_140_I18N_ZH: Record<string, string> = Object.fromEntries(
  PREY_140_RECORDS.map((r) => [`prey_140_${r.id}`, r.nameZh])
);

export const PREY_140_I18N_EN: Record<string, string> = Object.fromEntries(
  PREY_140_RECORDS.map((r) => [`prey_140_${r.id}`, r.nameEn])
);

export function getPrey140ImageUrl(id: string): string {
  return `/assets/prey_140/${id}@3x.png`;
}

const PUFFER_LIKE_IDS = new Set<string>([
  'PREY-050',
  'PREY-051',
  'PREY-052',
  'PREY-053',
  'PREY-054',
  'PREY-069',
  'PREY-070',
  'PREY-071',
  'PREY-072',
  'PREY-073',
  'PREY-099',
  'PREY-103',
]);

export const PREY_140_SHARK_LIKE_IDS = new Set<string>([
  'PREY-089',
  'PREY-090',
  'PREY-091',
  'PREY-092',
  'PREY-093',
  'PREY-094',
  'PREY-095',
  'PREY-096',
  'PREY-097',
  'PREY-098',
  'PREY-111',
  'PREY-112',
  'PREY-113',
]);

export const PREY_140_ELONGATED_IDS = new Set<string>([
  'PREY-079',
  'PREY-081',
  'PREY-083',
  'PREY-127',
  'PREY-128',
  'PREY-129',
]);

export const PREY_140_RIGID_IDS = new Set<string>([
  'PREY-114',
  'PREY-115',
  'PREY-116',
]);

export const PREY_140_PUFFER_IDS = PUFFER_LIKE_IDS;

/**
 * Computes proportional game depth [minDepth, maxDepth] across 0m..20000m,
 * strictly respecting each species' biological survival depth while shifting
 * larger body sizes progressively deeper ("按比例分开，体大的优先靠近深海").
 */
export function computeMappedPrey140Config(
  rec: Prey140RawRecord
): PreyTierConfig {
  const depthFactor = Math.min(
    1,
    Math.log1p(rec.realMaxDepth) / Math.log1p(1200)
  );

  let minDepth = 25;
  let maxDepth = 400;
  let tier = 1;

  if (rec.realMinDepth >= 50) {
    // Mesopelagic / Bathypelagic true deep-sea species: never spawn in <= 520m shallow coral sanctuary
    const sizeWeight =
      rec.sizeClass === 'XS'
        ? 0
        : rec.sizeClass === 'S'
        ? 0.25
        : rec.sizeClass === 'M'
        ? 0.55
        : 0.85;
    const minNorm = Math.min(1, (rec.realMinDepth - 50) / 450);
    const maxNorm = Math.min(1, Math.max(0, (rec.realMaxDepth - 500) / 1500));
    minDepth = Math.round(540 + minNorm * 1650 + sizeWeight * 850);
    maxDepth =
      rec.realMaxDepth >= 2000
        ? 20000
        : Math.round(
            Math.min(20000, 3600 + maxNorm * 13000 + sizeWeight * 3400)
          );
    tier = rec.sizeClass === 'XS' ? 2 : rec.sizeClass === 'S' ? 3 : 4;
  } else {
    switch (rec.sizeClass) {
      case 'XS': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 15);
        minDepth = Math.round(25 + depthFactor * 30 + lenNorm * 15);
        maxDepth = Math.round(330 + depthFactor * 160 + lenNorm * 40);
        tier = 1;
        break;
      }
      case 'S': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 30);
        minDepth = Math.round(45 + depthFactor * 110 + lenNorm * 40);
        maxDepth = Math.round(430 + depthFactor * 240 + lenNorm * 90);
        tier = rec.maxLengthCm <= 20 && rec.realMaxDepth <= 50 ? 1 : 2;
        break;
      }
      case 'M': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 70);
        minDepth = Math.round(115 + depthFactor * 230 + lenNorm * 90);
        maxDepth = Math.round(490 + depthFactor * 1050 + lenNorm * 320);
        tier = rec.realMaxDepth <= 100 && rec.maxLengthCm <= 45 ? 2 : 3;
        break;
      }
      case 'L': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 300);
        const rawMin = Math.round(320 + depthFactor * 420 + lenNorm * 220);
        tier = rec.realMaxDepth <= 200 && rec.maxLengthCm < 120 ? 3 : 4;
        minDepth = tier >= 4 ? Math.max(540, rawMin) : rawMin;
        maxDepth = Math.round(1350 + depthFactor * 2900 + lenNorm * 1200);
        break;
      }
      case 'XL': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 400);
        tier = rec.maxLengthCm >= 250 || rec.realMaxDepth >= 300 ? 6 : 5;
        minDepth = Math.round(640 + depthFactor * 950 + lenNorm * 580);
        maxDepth = Math.round(2800 + depthFactor * 7200 + lenNorm * 2800);
        break;
      }
      case 'XXL': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 800);
        tier = rec.maxLengthCm >= 400 || rec.realMaxDepth >= 250 ? 7 : 6;
        minDepth = Math.round(1650 + depthFactor * 2500 + lenNorm * 1150);
        maxDepth =
          rec.realMaxDepth >= 1000
            ? 20000
            : Math.round(
                Math.min(19600, 8600 + depthFactor * 7400 + lenNorm * 3400)
              );
        break;
      }
      case '巨型': {
        const lenNorm = Math.min(1, rec.maxLengthCm / 2500);
        tier = 8;
        minDepth = Math.round(4200 + depthFactor * 2300 + lenNorm * 2100);
        maxDepth =
          rec.maxLengthCm >= 1500 || rec.realMaxDepth >= 1000
            ? 20000
            : Math.round(
                Math.min(20000, 15200 + depthFactor * 3200 + lenNorm * 3200)
              );
        break;
      }
    }
  }

  const isApexGiantBoss =
    tier === 8 &&
    (rec.id === 'PREY-201' ||
      rec.id === 'PREY-204' ||
      rec.id === 'PREY-205' ||
      rec.id === 'PREY-206');

  let behavior: PreyBehavior = 'SCHOOL_FLEE';
  if (PUFFER_LIKE_IDS.has(rec.id)) {
    behavior = 'PUFFER_INFLATE';
  } else if (isApexGiantBoss) {
    behavior = 'KRAKEN_BOSS';
  } else if (tier >= 5) {
    behavior = 'HEAVY_CRUISER';
  } else if (tier === 4 && minDepth >= 540) {
    behavior =
      rec.id === 'PREY-079' || rec.id === 'PREY-081' || rec.id === 'PREY-083'
        ? 'EEL_CHARGER'
        : 'SUB_PATROL';
  } else if (tier === 4) {
    behavior = 'SUB_PATROL';
  }

  const radiusByTier = [17, 20, 25, 31, 39, 47, 56, 68];
  const speedByTier = [64, 72, 78, 84, 92, 102, 108, 114];
  const hpByTier = [9, 12, 16, 22, 30, 42, 65, 110];
  const xpByTier = [15, 22, 34, 52, 82, 125, 220, 480];
  const scoreByTier = [55, 90, 165, 290, 480, 760, 1350, 3200];
  const geneByTier = [1, 1, 2, 4, 7, 11, 18, 30];
  const coinByTier = [3, 5, 10, 16, 26, 40, 68, 125];
  const dmgByTier = [0, 5, 10, 15, 22, 30, 40, 52];

  const idx = Math.max(0, Math.min(7, tier - 1));
  const palette = getPaletteForSizeAndDepth(rec.sizeClass, minDepth);

  return {
    tier,
    id: rec.id,
    nameKey: `prey_140_${rec.id}`,
    minDepth,
    maxDepth,
    radius: radiusByTier[idx],
    baseSpeed: speedByTier[idx],
    hpRestore: hpByTier[idx],
    xpValue: xpByTier[idx],
    scoreValue: scoreByTier[idx],
    geneValue: geneByTier[idx],
    coinValue: coinByTier[idx],
    damageOnFail: dmgByTier[idx],
    behavior,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    glowColor: palette.glow,
    isHazard: false,
    isBoss: isApexGiantBoss,
    externalPngUrl: getPrey140ImageUrl(rec.id),
  };
}

function getPaletteForSizeAndDepth(
  sizeClass: Prey140SizeClass,
  minDepth: number
): { primary: string; secondary: string; glow: string } {
  if (minDepth >= 4000 || sizeClass === '巨型') {
    return { primary: '#6366f1', secondary: '#c084fc', glow: '#818cf8' };
  }
  if (minDepth >= 1200 || sizeClass === 'XXL') {
    return { primary: '#a855f7', secondary: '#2dd4bf', glow: '#d8b4fe' };
  }
  if (minDepth >= 520 || sizeClass === 'XL' || sizeClass === 'L') {
    return { primary: '#38bdf8', secondary: '#e2e8f0', glow: '#7dd3fc' };
  }
  if (sizeClass === 'M') {
    return { primary: '#facc15', secondary: '#fb923c', glow: '#fde047' };
  }
  return { primary: '#fb923c', secondary: '#f8fafc', glow: '#fdba74' };
}

export function buildPrey140TiersWithMines(): PreyTierConfig[] {
  const mapped140 = PREY_140_RECORDS.map(computeMappedPrey140Config);
  const cyberMine: PreyTierConfig = {
    tier: 6,
    id: 'cyber_mine',
    nameKey: 'prey_tier6_name',
    spriteKey: 'PREY_MINE',
    minDepth: 560,
    maxDepth: 20000,
    radius: 30,
    baseSpeed: 12,
    hpRestore: 28,
    xpValue: 40,
    scoreValue: 550,
    geneValue: 6,
    coinValue: 22,
    damageOnFail: 28,
    behavior: 'MINE_HAZARD',
    primaryColor: '#475569',
    secondaryColor: '#ef4444',
    glowColor: '#f87171',
    isHazard: true,
  };
  return [...mapped140, cyberMine];
}
