import type {
  AgentLevel,
  Channel,
  DomesticLicenseInfo,
  Order,
  OrderStatus,
  ProcessType,
  PushTimeliness,
  Product,
  ProductCategory,
  ProductProcessType,
  PriceTier,
} from '../shared/types';
import {
  BUILT_IN_PROCESS_TYPE_KEYS,
  DEFAULT_STANDARD_PROCESS_TYPE_KEYS,
  getDefaultProcessTypeKeysForProduct,
  getDefaultProcessTypeTemplatesForProduct,
  getProcessTypeTone,
  isDefaultProcessTypeProfileProduct,
} from '../shared/utils/productProcessType';
import { formatBeijingTimestamp } from '../shared/utils/dateTime';
import { migrateDomesticLicenseOrderImages } from '../shared/utils/localImageStore';

const PRODUCT_STORAGE_KEY = 'meika-products';
const PRODUCT_NEXT_ID_STORAGE_KEY = 'meika-products-next-id';
const ORDER_STORAGE_KEY = 'meika-orders';
const ORDER_DATA_VERSION_STORAGE_KEY = 'meika-order-data-version';
export const ORDER_DATA_CHANGED_EVENT = 'meika-orders-changed';
const ORDER_DATA_VERSION = 'notary-management-clear-system-notary-orders-v1';
const REMOVED_ORDER_IDS = new Set(['MK2600057', 'MK2600061']);

const NAMES = ['张伟', '王芳', '李明', '赵丽', '孙强', '周杰', '吴秀英', '郑敏', '陈浩', '钱亮', '刘洋', '黄磊', '何欣', '马丽', '朱俊', '林静', '徐峰', '高蕾', '谢宇', '韩雪'];
const PASSPORTS = ['E12345678', 'G98765432', 'E55667788', 'G11223344', 'E99887766', 'G44556677', 'E33221100', 'G77889900', 'E66554433', 'G22113344'];
const PHONES = ['13800138001', '13912345678', '15011112222', '18699998888', '13566667777', '17700001111', '15233334444', '18655556666', '13877778888', '13288889999'];
const ADDRESSES = [
  '北京市朝阳区建国路 88 号 SOHO 现代城',
  '上海市浦东新区陆家嘴环路 1000 号',
  '广州市天河区天河路 385 号太古汇',
  '深圳市南山区深南大道 9966 号',
  '杭州市西湖区文三路 478 号',
  '成都市锦江区红星路三段 99 号',
  '南京市鼓楼区中山路 18 号',
  '武汉市江岸区解放大道 688 号',
];

const STATUSES: OrderStatus[] = ['pending_review', 'pending_production', 'in_production', 'shipped', 'completed', 'cancelled'];
const PROCESS_TYPES: ProcessType[] = ['normal', 'priority', 'urgent'];
const PUSH_TIMELINESS_OPTIONS: PushTimeliness[] = ['instant', 'within_2h', 'same_day', 'next_day'];
const CHANNELS: Channel[] = ['ctrip', 'fliggy', 'private', 'offline'];
const AGENT_LEVELS: AgentLevel[] = ['self', 'l1', 'l2', 'l3'];
const DOMESTIC_EXCHANGE_LOCATIONS = [
  { province: '广东', city: '深圳' },
  { province: '浙江', city: '杭州' },
  { province: '上海', city: '上海' },
  { province: '北京', city: '北京' },
] as const;
const DOMESTIC_FOREIGN_LICENSE_LOCATIONS = [
  { country: '美国', city: '加利福尼亚州' },
  { country: '加拿大', city: '安大略省' },
  { country: '澳大利亚', city: '新南威尔士州' },
  { country: '英国', city: '伦敦' },
] as const;
const PRODUCT_CATEGORIES: ProductCategory[] = ['translation', 'notary', 'idp', 'domestic_license'];
const EXTRA_IDP_PENDING_ORDER_COUNT = 5;
const NOTARY_PENDING_REVIEW_ORDER_COUNT = 0;
const DOMESTIC_LICENSE_PRODUCT_TITLE = '换国内驾照翻译件';
const DOMESTIC_LICENSE_UNTRANSLATED_ORDER_IDS = ['MK2600087', 'MK2600088', 'MK2600089', 'MK2600090', 'MK2600091'];
const DOMESTIC_LICENSE_UNMADE_ORDER_IDS = new Set(['MK2600088']);
const PRODUCTION_OPERATOR = '生产端';
const PRODUCTION_NODE_ACTIONS = new Set(['已翻译', '已制作', '已发货']);
const FORCE_UNTRANSLATED_INITIALIZED_ACTION = '初始化为未翻译';
const CHINESE_COMPOUND_SURNAMES = ['欧阳', '太史', '端木', '上官', '司马', '东方', '独孤', '南宫', '万俟', '闻人', '夏侯', '诸葛', '尉迟', '公羊', '赫连', '澹台', '皇甫', '宗政', '濮阳', '公冶', '太叔', '申屠', '公孙', '慕容', '仲孙'] as const;
const NAME_PINYIN_MAP: Record<string, string> = {
  张: 'ZHANG',
  王: 'WANG',
  李: 'LI',
  赵: 'ZHAO',
  孙: 'SUN',
  周: 'ZHOU',
  吴: 'WU',
  郑: 'ZHENG',
  陈: 'CHEN',
  钱: 'QIAN',
  刘: 'LIU',
  黄: 'HUANG',
  何: 'HE',
  马: 'MA',
  朱: 'ZHU',
  林: 'LIN',
  徐: 'XU',
  高: 'GAO',
  谢: 'XIE',
  韩: 'HAN',
  艾: 'AI',
  安: 'AN',
  敖: 'AO',
  白: 'BAI',
  柏: 'BAI',
  包: 'BAO',
  贝: 'BEI',
  毕: 'BI',
  蔡: 'CAI',
  曹: 'CAO',
  曾: 'ZENG',
  常: 'CHANG',
  车: 'CHE',
  成: 'CHENG',
  冯: 'FENG',
  顾: 'GU',
  郭: 'GUO',
  胡: 'HU',
  华: 'HUA',
  蒋: 'JIANG',
  金: 'JIN',
  梁: 'LIANG',
  廖: 'LIAO',
  罗: 'LUO',
  陆: 'LU',
  潘: 'PAN',
  彭: 'PENG',
  邱: 'QIU',
  秦: 'QIN',
  任: 'REN',
  沈: 'SHEN',
  宋: 'SONG',
  苏: 'SU',
  唐: 'TANG',
  田: 'TIAN',
  汪: 'WANG',
  魏: 'WEI',
  许: 'XU',
  肖: 'XIAO',
  薛: 'XUE',
  叶: 'YE',
  余: 'YU',
  袁: 'YUAN',
  钟: 'ZHONG',
  邹: 'ZOU',
  姚: 'YAO',
  夏: 'XIA',
  伟: 'WEI',
  芳: 'FANG',
  明: 'MING',
  丽: 'LI',
  强: 'QIANG',
  杰: 'JIE',
  秀: 'XIU',
  英: 'YING',
  敏: 'MIN',
  浩: 'HAO',
  亮: 'LIANG',
  洋: 'YANG',
  磊: 'LEI',
  欣: 'XIN',
  俊: 'JUN',
  静: 'JING',
  峰: 'FENG',
  宇: 'YU',
  雪: 'XUE',
  知: 'ZHI',
  书: 'SHU',
  禾: 'HE',
  景: 'JING',
  川: 'CHUAN',
  宁: 'NING',
  若: 'RUO',
  岚: 'LAN',
  清: 'QING',
  和: 'HE',
  星: 'XING',
  野: 'YE',
  慕: 'MU',
  晴: 'QING',
  望: 'WANG',
  舒: 'SHU',
  砚: 'YAN',
  秋: 'QIU',
};
const USER_SUBMITTED_REMARKS = new Set(['用户端提交', '代理端提交']);
const USER_SUBMITTED_OPERATORS = new Set(['用户端', '代理端']);
const hasUserSubmittedMarker = (order: Order) =>
  USER_SUBMITTED_REMARKS.has(order.remark) ||
  order.logs.some((log) => USER_SUBMITTED_OPERATORS.has(log.operator) || log.action.includes('用户端') || log.action.includes('代理端'));
const isDomesticLicenseOrder = (order: Order) =>
  order.productName === DOMESTIC_LICENSE_PRODUCT_TITLE || order.productCategory === 'domestic_license' || Boolean(order.domesticLicenseInfo);
const hasManualAuditApproval = (order: Order) =>
  order.logs.some((log) => log.operator !== '系统' && /审核通过/.test(log.action));
const hasProductionWorkflowLog = (order: Order) =>
  order.logs.some((log) => log.operator === PRODUCTION_OPERATOR && PRODUCTION_NODE_ACTIONS.has(log.action));
const isNotarySystemGeneratedOrder = (order: Order) =>
  order.productCategory === 'notary' &&
  !hasUserSubmittedMarker(order) &&
  (/^notary\d+@example\.com$/i.test(order.customerEmail) ||
    order.remark.includes('生成') ||
    order.remark.includes('鐢熸垚') ||
    order.logs.some((log) => log.operator === '系统' || log.operator === '绯荤粺'));
const isDomesticLicenseSystemGeneratedOrder = (order: Order) =>
  order.productName === DOMESTIC_LICENSE_PRODUCT_TITLE &&
  !hasUserSubmittedMarker(order);

const excludeDomesticLicenseSystemGeneratedOrders = (orders: Order[]) =>
  orders.filter((order) => !isDomesticLicenseSystemGeneratedOrder(order));
const excludeNotarySystemGeneratedOrders = (orders: Order[]) =>
  orders.filter((order) => !isNotarySystemGeneratedOrder(order));

const getChineseNamePinyinParts = (name: string) => {
  const normalizedName = name.replace(/[\s·.。-]/g, '').trim();
  if (!normalizedName || !/^[\u4e00-\u9fff]+$/u.test(normalizedName)) {
    return { surnamePinyin: '', givenNamePinyin: '' };
  }

  const toPinyin = (value: string) => {
    const tokens = Array.from(value).map((char) => NAME_PINYIN_MAP[char] || '');
    return tokens.every(Boolean) ? tokens.join('') : '';
  };

  const compoundSurname = CHINESE_COMPOUND_SURNAMES.find((surname) => normalizedName.startsWith(surname));
  const surnameLength = compoundSurname ? compoundSurname.length : 1;
  const surname = normalizedName.slice(0, surnameLength);
  const givenName = normalizedName.slice(surnameLength);

  return {
    surnamePinyin: toPinyin(surname),
    givenNamePinyin: givenName ? toPinyin(givenName) : '',
  };
};

const backfillLegacyNamePinyin = (order: Order): Order => {
  if (order.idpSurnameEn?.trim() && order.idpGivenNameEn?.trim()) {
    return order;
  }

  const sourceName = order.licenseName?.trim() || order.customerName?.trim() || '';
  const { surnamePinyin, givenNamePinyin } = getChineseNamePinyinParts(sourceName);
  if (!surnamePinyin && !givenNamePinyin) {
    return order;
  }

  return {
    ...order,
    idpSurnameEn: order.idpSurnameEn?.trim() || surnamePinyin || undefined,
    idpGivenNameEn: order.idpGivenNameEn?.trim() || givenNamePinyin || undefined,
  };
};

const sortLogsByTime = (logs: Order['logs']) =>
  [...logs]
    .map((log, index) => ({ log, index }))
    .sort((a, b) => a.log.time.localeCompare(b.log.time) || a.index - b.index)
    .map(({ log }) => log);

const appendProductionLog = (logs: Order['logs'], action: string, time: string) => [
  ...logs,
  {
    time,
    operator: PRODUCTION_OPERATOR,
    action,
  },
];

const backfillDomesticLicenseProductionLogs = (order: Order) => {
  if (!isDomesticLicenseOrder(order)) {
    return order;
  }

  const existingActions = new Set(order.logs.map((log) => log.action));
  const status = order.status;
  const shouldBackfillTranslated = ['in_production', 'shipped', 'completed'].includes(status);
  const shouldBackfillMade = ['in_production', 'shipped', 'completed'].includes(status);
  const shouldBackfillShipped = ['shipped', 'completed'].includes(status);
  let nextLogs = order.logs;
  let hasChanges = false;

  if (shouldBackfillTranslated && !existingActions.has('已翻译')) {
    const translatedBase = order.shippedAt || order.updatedAt || order.createdAt;
    nextLogs = appendProductionLog(nextLogs, '已翻译', addSecondsToTimestamp(translatedBase, -120));
    hasChanges = true;
  }

  if (shouldBackfillMade && !existingActions.has('已制作')) {
    const madeBase = order.shippedAt || order.updatedAt || order.createdAt;
    nextLogs = appendProductionLog(nextLogs, '已制作', addSecondsToTimestamp(madeBase, -60));
    hasChanges = true;
  }

  if (shouldBackfillShipped && !existingActions.has('已发货')) {
    const shippedBase = order.shippedAt || order.updatedAt || order.createdAt;
    nextLogs = appendProductionLog(nextLogs, '已发货', shippedBase);
    hasChanges = true;
  }

  if (!hasChanges) {
    return order;
  }

  return {
    ...order,
    logs: sortLogsByTime(nextLogs),
  };
};
const PRODUCT_SEEDS: Array<{
  title: string;
  category: ProductCategory;
  weight: number;
  status: Product['status'];
}> = [
  { title: DOMESTIC_LICENSE_PRODUCT_TITLE, category: 'domestic_license', weight: 30, status: 'active' },
  { title: '驾照翻译国际认证件（小白本）', category: 'translation', weight: 29, status: 'active' },
  { title: 'NAATI 澳大利亚认证（电子版）', category: 'translation', weight: 28, status: 'active' },
  { title: 'NAATI 澳大利亚认证（原件）', category: 'translation', weight: 27, status: 'active' },
  { title: 'NZTA 新西兰认证(电子版)', category: 'translation', weight: 26, status: 'active' },
  { title: 'NZTA 新西兰认证(原件)', category: 'translation', weight: 25, status: 'active' },
  { title: '西班牙语言宣誓翻译(电子版)', category: 'translation', weight: 24, status: 'active' },
  { title: '德语宣誓翻译(电子版)', category: 'translation', weight: 23, status: 'active' },
  { title: '法语宣誓翻译(电子版)', category: 'translation', weight: 22, status: 'active' },
  { title: '公证办理服务', category: 'notary', weight: 18, status: 'active' },
  { title: 'IDP', category: 'idp', weight: 16, status: 'active' },
  { title: 'IDP（加急）', category: 'idp', weight: 15, status: 'active' },
  { title: 'IDD国际驾照', category: 'idp', weight: 14, status: 'active' },
  { title: 'IDD国际驾照（加急）', category: 'idp', weight: 13, status: 'active' },
];

const PROCESS_TYPE_ESTIMATED_DAYS: Record<ProcessType, number> = {
  normal: 15,
  priority: 7,
  urgent: 3,
};

const NOTARY_ORDER_NAMES = ['公证单号', '公证双号', '公证海牙单号', '公证海牙双号'];

const isBrowser = () => typeof window !== 'undefined';

const getProductNumericId = (productId: string) => {
  const matchedValue = productId.match(/^MK-(\d+)$/)?.[1];
  const numericValue = Number(matchedValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getNextProductNumericIdFromProducts = (products: Product[]) =>
  products.reduce((max, product) => Math.max(max, getProductNumericId(product.productId)), 0) + 1;

const getStoredNextProductNumericId = () => {
  if (!isBrowser()) return 0;

  const numericValue = Number(window.localStorage.getItem(PRODUCT_NEXT_ID_STORAGE_KEY));
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.trunc(numericValue) : 0;
};

const persistNextProductNumericId = (products: Product[]) => {
  if (!isBrowser()) return;

  const nextNumericId = Math.max(getStoredNextProductNumericId(), getNextProductNumericIdFromProducts(products));
  window.localStorage.setItem(PRODUCT_NEXT_ID_STORAGE_KEY, String(nextNumericId));
};

const randomDate = (daysBack: number) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  date.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));
  return formatBeijingTimestamp(date);
};

const getCurrentTimestamp = () => formatBeijingTimestamp();

const getCompactTimestamp = (timestamp = getCurrentTimestamp()) => timestamp.replace(/\D/g, '').slice(0, 14);

const buildSeedOrderId = (serial: number) => `MK${String(2026).substring(2)}${String(serial).padStart(5, '0')}`;

const getNextAvailableSeedOrderSerial = (orders: Order[], startSerial: number) => {
  const existingOrderIds = new Set(orders.map((order) => order.orderId));
  let nextSerial = startSerial;
  let nextOrderId = buildSeedOrderId(nextSerial);

  while (existingOrderIds.has(nextOrderId) || REMOVED_ORDER_IDS.has(nextOrderId)) {
    nextSerial += 1;
    nextOrderId = buildSeedOrderId(nextSerial);
  }

  return nextSerial;
};

const addSecondsToTimestamp = (timestamp: string, seconds: number) => {
  const normalizedTimestamp = timestamp.trim();
  const matchedValue = normalizedTimestamp.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!matchedValue) {
    return normalizedTimestamp;
  }

  const [, year, month, day, hour, minute, second] = matchedValue.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second + seconds);
  return formatBeijingTimestamp(date);
};

const getDefaultEstimatedDays = (name: string) => {
  if (name === 'normal') return PROCESS_TYPE_ESTIMATED_DAYS.normal;
  if (name === 'priority') return PROCESS_TYPE_ESTIMATED_DAYS.priority;
  if (name === 'urgent') return PROCESS_TYPE_ESTIMATED_DAYS.urgent;
  return 3;
};

const getDefaultProcessTypeDescription = (estimatedDays: number) => `${estimatedDays}个工作日`;

const toStringOrFallback = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const toNonNegativeInteger = (value: unknown, fallback = 0) => {
  const nextValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(nextValue)) return fallback;
  return Math.max(0, Math.trunc(nextValue));
};

const toPositiveInteger = (value: unknown, fallback: number) => {
  const nextValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) return fallback;
  return Math.max(1, Math.trunc(nextValue));
};

const toNonNegativeNumber = (value: unknown, fallback = 0) => {
  const nextValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(nextValue)) return fallback;
  return Math.max(0, nextValue);
};

const isProductCategory = (value: unknown): value is ProductCategory =>
  typeof value === 'string' && PRODUCT_CATEGORIES.includes(value as ProductCategory);

const isProductStatus = (value: unknown): value is Product['status'] => value === 'active' || value === 'inactive';

const clonePricing = (pricing: PriceTier[]): PriceTier[] => pricing.map((item) => ({ ...item }));

const cloneProcessType = (processType: ProductProcessType): ProductProcessType => ({
  ...processType,
  pricing: clonePricing(processType.pricing),
});

const cloneProduct = (product: Product): Product => ({
  ...product,
  processTypes: product.processTypes.map(cloneProcessType),
});

const cloneOrder = (order: Order): Order => ({
  ...order,
  logs: order.logs.map((log) => ({ ...log })),
});

const excludeRemovedOrders = (orders: Order[]) => orders.filter((order) => !REMOVED_ORDER_IDS.has(order.orderId));

const isAgentSubmittedPersistedOrder = (order: Order) =>
  hasUserSubmittedMarker(order);

const normalizeNotaryManagementOrderStatus = (order: Order): Order => {
  if (order.productCategory !== 'notary') {
    return order;
  }

  if (order.logs.some((log) => /取消订单/.test(log.action))) {
    return order.status === 'cancelled'
      ? order
      : {
          ...order,
          status: 'cancelled',
          rejectReason: undefined,
          remark: '',
        };
  }

  if (order.status !== 'rejected') {
    return order;
  }

  const hasNotaryOfficeSubmission = Boolean(
    order.pushedNotaryOfficeName?.trim() ||
      order.productionDisplayNotaryOfficeName?.trim() ||
      order.logs.some((log) => /送审至|公证处已接收/.test(log.action)),
  );
  const hasNotaryOfficeRejection = order.logs.some((log) => /公证处审核驳回|公证处.*驳回/.test(log.action));

  if (!hasNotaryOfficeSubmission || !hasNotaryOfficeRejection) {
    return order;
  }

  return {
    ...order,
    status: 'pending_production',
  };
};

const getPushTimeliness = (processType: ProductProcessType, index: number): PushTimeliness => {
  const tone = getProcessTypeTone(processType.name, processType.estimatedDays);

  if (tone === 'urgent') {
    return PUSH_TIMELINESS_OPTIONS[index % 2];
  }

  if (tone === 'priority') {
    return PUSH_TIMELINESS_OPTIONS[(index % 2) + 1];
  }

  return PUSH_TIMELINESS_OPTIONS[(index % 2) + 2];
};

const getPriceByAgentLevel = (pricing: PriceTier[], agentLevel: AgentLevel) =>
  pricing.find((item) => item.agentLevel === agentLevel)?.price || 0;

const buildNextOrderId = () => {
  const currentYearSuffix = getCurrentTimestamp().slice(2, 4) || String(new Date().getFullYear()).slice(-2);
  const orderIdPrefix = `MK${currentYearSuffix}`;
  const existingOrderIds = new Set(_orders.map((order) => order.orderId));
  let nextSerial =
    _orders.reduce((maxSerial, order) => {
      if (!order.orderId.startsWith(orderIdPrefix)) {
        return maxSerial;
      }

      const serial = Number(order.orderId.slice(orderIdPrefix.length));
      return Number.isFinite(serial) ? Math.max(maxSerial, serial) : maxSerial;
    }, 0) + 1;
  let nextOrderId = `${orderIdPrefix}${String(nextSerial).padStart(5, '0')}`;

  while (existingOrderIds.has(nextOrderId)) {
    nextSerial += 1;
    nextOrderId = `${orderIdPrefix}${String(nextSerial).padStart(5, '0')}`;
  }

  return nextOrderId;
};

const buildProcessTypeWithPricing = (
  typeId: string,
  template: {
    name: string;
    description: string;
    weight: number;
    estimatedDays: number;
  },
  getPrice: (agentIndex: number) => number,
): ProductProcessType => ({
  typeId,
  name: template.name,
  description: template.description,
  weight: template.weight,
  estimatedDays: template.estimatedDays,
  pricing: AGENT_LEVELS.map((agentLevel, agentIndex) => ({
    agentLevel,
    price: Math.max(getPrice(agentIndex), 0),
  })),
});

const buildSeedProcessTypes = (productIndex: number, productTitle: string): ProductProcessType[] =>
  getDefaultProcessTypeTemplatesForProduct(productTitle).map((template, processIndex) => {
    const basePrice = template.defaultPrice ?? 289 + processIndex * 100 + (productIndex % 4) * 20;

    return buildProcessTypeWithPricing(`PT-${productIndex}-${processIndex}`, template, (agentIndex) => basePrice - agentIndex * 30);
  });

function createProducts(): Product[] {
  return PRODUCT_SEEDS.map((seed, index) => {
    const processTypes = buildSeedProcessTypes(index, seed.title);

    return {
      productId: `MK-${index + 1}`,
      title: seed.title,
      category: seed.category,
      description: `${seed.title}，覆盖多语种与多国家地区场景。`,
      defaultPrice: processTypes[0]?.pricing[0]?.price || 0,
      weight: seed.weight,
      status: seed.status,
      processTypes,
      createdAt: randomDate(180),
      updatedAt: randomDate(30),
    };
  });
}

const normalizePricing = (pricing: unknown, fallbackBasePrice: number): PriceTier[] => {
  const pricingList = Array.isArray(pricing) ? pricing : [];

  return AGENT_LEVELS.map((agentLevel, index) => {
    const matchedPricing = pricingList.find((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      return (item as Partial<PriceTier>).agentLevel === agentLevel;
    }) as Partial<PriceTier> | undefined;

    return {
      agentLevel,
      price: toNonNegativeNumber(matchedPricing?.price, Math.max(fallbackBasePrice - index * 20, 0)),
    };
  });
};

const normalizeProcessType = (value: unknown, productId: string, index: number): ProductProcessType => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<ProductProcessType>) : {};
  const fallbackName = PROCESS_TYPES[index] || `办理类型 ${index + 1}`;
  const name = toStringOrFallback(record.name, fallbackName);
  const estimatedDays = toPositiveInteger(record.estimatedDays, getDefaultEstimatedDays(name));
  const defaultPrice =
    normalizePricing(record.pricing, 0).find((pricing) => pricing.agentLevel === 'self')?.price || 0;

  return {
    typeId: toStringOrFallback(record.typeId, `PT-${productId}-${index + 1}`),
    name,
    description: toStringOrFallback(record.description, getDefaultProcessTypeDescription(estimatedDays)),
    weight: toNonNegativeInteger(record.weight, 0),
    estimatedDays,
    pricing: normalizePricing(record.pricing, defaultPrice),
  };
};

const matchesPricingPattern = (pricing: PriceTier[], basePrice: number, priceGap: number) =>
  AGENT_LEVELS.every(
    (agentLevel, agentIndex) => getPriceByAgentLevel(pricing, agentLevel) === Math.max(basePrice - agentIndex * priceGap, 0),
  );

const hasDefaultBuiltInMetadata = (processType: ProductProcessType) => {
  if (!PROCESS_TYPES.includes(processType.name as ProcessType)) {
    return false;
  }

  const estimatedDays = getDefaultEstimatedDays(processType.name);
  return (
    (processType.weight ?? 0) === 0 &&
    processType.estimatedDays === estimatedDays &&
    processType.description.trim() === getDefaultProcessTypeDescription(estimatedDays)
  );
};

const isExactBuiltInProfile = (processTypes: ProductProcessType[], expectedNames: string[]) =>
  processTypes.length === expectedNames.length && expectedNames.every((name, index) => processTypes[index]?.name === name);

const shouldMigrateDefaultProfileProcessTypes = (
  productTitle: string,
  processTypes: ProductProcessType[],
  defaultPrice: number,
) => {
  if (!isDefaultProcessTypeProfileProduct(productTitle) || processTypes.length === 0) {
    return false;
  }

  const currentBasePrice = getPriceByAgentLevel(processTypes[0]?.pricing || [], 'self') || defaultPrice;

  const matchesLegacyThreeTypeProfile =
    isExactBuiltInProfile(processTypes, BUILT_IN_PROCESS_TYPE_KEYS) &&
    processTypes.every(hasDefaultBuiltInMetadata) &&
    processTypes.every((processType, index) => matchesPricingPattern(processType.pricing, 289 + index * 100, 30));

  const matchesLegacyTwoTypeProfile =
    isExactBuiltInProfile(processTypes, DEFAULT_STANDARD_PROCESS_TYPE_KEYS) &&
    processTypes.every(hasDefaultBuiltInMetadata) &&
    processTypes.every((processType, index) => matchesPricingPattern(processType.pricing, currentBasePrice + index * 80, 20));

  return matchesLegacyThreeTypeProfile || matchesLegacyTwoTypeProfile;
};

const buildFallbackProcessTypes = (productId: string, productTitle: string, defaultPrice: number): ProductProcessType[] =>
  getDefaultProcessTypeTemplatesForProduct(productTitle).map((template, index) => {
    const basePrice = template.defaultPrice ?? defaultPrice + index * 80;

    return buildProcessTypeWithPricing(`PT-${productId}-${index + 1}`, template, (agentIndex) => basePrice - agentIndex * 20);
  });

const normalizeProcessTypesForProduct = (
  productTitle: string,
  productId: string,
  defaultPrice: number,
  processTypes: ProductProcessType[],
): ProductProcessType[] => {
  if (processTypes.length === 0) {
    return [];
  }

  const defaultProcessTypeKeys = getDefaultProcessTypeKeysForProduct(productTitle);
  const hasLegacyBuiltInProfile =
    processTypes.length === PROCESS_TYPES.length &&
    PROCESS_TYPES.every((processType) => processTypes.some((item) => item.name === processType)) &&
    processTypes.every((item) => PROCESS_TYPES.includes(item.name as ProcessType));

  if (shouldMigrateDefaultProfileProcessTypes(productTitle, processTypes, defaultPrice)) {
    return buildFallbackProcessTypes(productId, productTitle, defaultPrice);
  }

  if (defaultProcessTypeKeys.length < PROCESS_TYPES.length && hasLegacyBuiltInProfile) {
    return processTypes
      .filter((processType): processType is ProductProcessType & { name: ProcessType } =>
        defaultProcessTypeKeys.includes(processType.name as ProcessType),
      )
      .sort(
        (a, b) =>
          defaultProcessTypeKeys.indexOf(a.name as ProcessType) - defaultProcessTypeKeys.indexOf(b.name as ProcessType),
      );
  }

  return processTypes;
};

const normalizeProduct = (value: unknown, index: number): Product => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<Product>) : {};
  const fallbackSeed = PRODUCT_SEEDS[index];
  const fallbackId = `MK-${index + 1}`;
  const productId = toStringOrFallback(record.productId, fallbackId);
  const title = toStringOrFallback(record.title, fallbackSeed?.title || `产品 ${index + 1}`);
  const category =
    title === DOMESTIC_LICENSE_PRODUCT_TITLE
      ? 'domestic_license'
      : isProductCategory(record.category)
        ? record.category
        : fallbackSeed?.category || 'translation';
  const weight = toNonNegativeInteger(record.weight, fallbackSeed?.weight ?? 0);
  const status = isProductStatus(record.status) ? record.status : fallbackSeed?.status || 'inactive';
  const defaultPrice = toNonNegativeNumber(record.defaultPrice, 299);
  const rawProcessTypes = Array.isArray(record.processTypes) ? record.processTypes : [];
  const normalizedRawProcessTypes = rawProcessTypes.map((processType, processIndex) =>
    normalizeProcessType(processType, productId, processIndex),
  );
  const processTypes = normalizeProcessTypesForProduct(
    title,
    productId,
    defaultPrice,
    normalizedRawProcessTypes.length > 0 ? normalizedRawProcessTypes : buildFallbackProcessTypes(productId, title, defaultPrice),
  );

  return {
    productId,
    title,
    category,
    description: toStringOrFallback(record.description, `${title}，覆盖多语种与多国家地区场景。`),
    coverImage: typeof record.coverImage === 'string' && record.coverImage ? record.coverImage : undefined,
    defaultPrice: toNonNegativeNumber(record.defaultPrice, getPriceByAgentLevel(processTypes[0]?.pricing || [], 'self')),
    weight,
    status,
    processTypes,
    createdAt: toStringOrFallback(record.createdAt, getCurrentTimestamp()),
    updatedAt: toStringOrFallback(record.updatedAt, getCurrentTimestamp()),
  };
};

const persistProducts = () => {
  if (!isBrowser()) return;
  window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(_products));
  persistNextProductNumericId(_products);
};

const persistOrders = () => {
  if (!isBrowser()) return;
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(_orders));
  window.localStorage.setItem(ORDER_DATA_VERSION_STORAGE_KEY, ORDER_DATA_VERSION);
  window.dispatchEvent(new Event(ORDER_DATA_CHANGED_EVENT));
};

const loadProducts = (): Product[] => {
  const defaultProducts = createProducts();

  if (!isBrowser()) {
    return defaultProducts;
  }

  try {
    const rawValue = window.localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (!rawValue) {
      window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(defaultProducts));
      persistNextProductNumericId(defaultProducts);
      return defaultProducts;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return defaultProducts;
    }

    const normalizedProducts = parsedValue.map((product, index) => normalizeProduct(product, index));
    const hasDomesticLicenseProduct = normalizedProducts.some((product) => product.title === DOMESTIC_LICENSE_PRODUCT_TITLE);
    const mergedProducts = hasDomesticLicenseProduct
      ? normalizedProducts
      : (() => {
          const nextProductId = `MK-${getNextProductNumericIdFromProducts(normalizedProducts)}`;
          const seedProduct = defaultProducts.find((product) => product.title === DOMESTIC_LICENSE_PRODUCT_TITLE);
          const processTypes = buildFallbackProcessTypes(
            nextProductId,
            DOMESTIC_LICENSE_PRODUCT_TITLE,
            seedProduct?.defaultPrice || 289,
          );

          return [
            ...normalizedProducts,
            {
              productId: nextProductId,
              title: DOMESTIC_LICENSE_PRODUCT_TITLE,
              category: 'domestic_license' as ProductCategory,
              description: seedProduct?.description || `${DOMESTIC_LICENSE_PRODUCT_TITLE}，用于境外驾照换领国内驾照场景。`,
              defaultPrice: processTypes[0]?.pricing[0]?.price || seedProduct?.defaultPrice || 289,
              weight: 30,
              status: 'active' as Product['status'],
              processTypes,
              createdAt: getCurrentTimestamp(),
              updatedAt: getCurrentTimestamp(),
            },
          ];
        })();

    window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(mergedProducts));
    persistNextProductNumericId(mergedProducts);
    return mergedProducts;
  } catch {
    return defaultProducts;
  }
};

const loadOrders = (products: Product[]): Order[] => {
  const defaultOrders = excludeNotarySystemGeneratedOrders(
    excludeDomesticLicenseSystemGeneratedOrders(excludeRemovedOrders(createOrders(products))),
  );
  const defaultNotaryOrders = defaultOrders.filter((order) => order.productCategory === 'notary');
  const defaultNonNotaryOrders = defaultOrders.filter((order) => order.productCategory !== 'notary');

  if (!isBrowser()) {
    return defaultOrders;
  }

  try {
    const rawValue = window.localStorage.getItem(ORDER_STORAGE_KEY);
    const storedOrderDataVersion = window.localStorage.getItem(ORDER_DATA_VERSION_STORAGE_KEY);
    if (!rawValue) {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(defaultOrders));
      window.localStorage.setItem(ORDER_DATA_VERSION_STORAGE_KEY, ORDER_DATA_VERSION);
      return defaultOrders;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return defaultOrders;
    }

    const storedOrders = excludeNotarySystemGeneratedOrders(
      excludeDomesticLicenseSystemGeneratedOrders(excludeRemovedOrders(parsedValue as Order[])),
    ).map((order) => backfillLegacyNamePinyin(normalizeDomesticLicenseAuditState(order)));
    const storedNonNotaryOrders = storedOrders.filter((order) => order.productCategory !== 'notary');
    const storedAgentSubmittedNotaryOrders = storedOrders.filter(
      (order) => order.productCategory === 'notary' && isAgentSubmittedPersistedOrder(order),
    );
    const shouldResetNotaryOrders = storedOrderDataVersion !== ORDER_DATA_VERSION;
    const existingNonNotaryOrderIds = new Set(storedNonNotaryOrders.map((order) => order.orderId));
    const missingDefaultNonNotaryOrders = defaultNonNotaryOrders.filter(
      (order) => !existingNonNotaryOrderIds.has(order.orderId),
    );
    const missingDefaultNonNotaryOrderIds = new Set(missingDefaultNonNotaryOrders.map((order) => order.orderId));
    const missingDomesticUntranslatedOrders: Order[] = [];
    const missingDomesticUntranslatedOrderIds = new Set(missingDomesticUntranslatedOrders.map((order) => order.orderId));
    const occupiedOrderIds = new Set([
      ...storedOrders.map((order) => order.orderId),
      ...missingDefaultNonNotaryOrderIds,
      ...missingDomesticUntranslatedOrderIds,
    ]);
    const hasDomesticLicenseOrders = storedOrders.some((order) => order.domesticLicenseInfo);
    const missingDomesticLicenseOrders = hasDomesticLicenseOrders
      ? []
      : defaultNonNotaryOrders
          .filter((order) => order.domesticLicenseInfo)
          .filter((order) => !missingDefaultNonNotaryOrderIds.has(order.orderId))
          .map((order, index) => {
            let nextOrderId = order.orderId;
            if (occupiedOrderIds.has(nextOrderId)) {
              let sequence = index + 1;
              do {
                nextOrderId = `MK2699${String(sequence).padStart(3, '0')}`;
                sequence += 1;
              } while (occupiedOrderIds.has(nextOrderId));
            }

            occupiedOrderIds.add(nextOrderId);

            return {
              ...order,
              orderId: nextOrderId,
              managementOrderId: order.managementOrderId ? getCompactTimestamp(addSecondsToTimestamp(order.updatedAt, index)) : undefined,
              logs: order.logs.map((log) => ({ ...log })),
            };
          });
    const resetKeptOrderIds = new Set(
      [
        ...storedNonNotaryOrders,
        ...storedAgentSubmittedNotaryOrders,
        ...missingDefaultNonNotaryOrders,
        ...missingDomesticUntranslatedOrders,
        ...missingDomesticLicenseOrders,
      ].map((order) => order.orderId),
    );
    const resetDefaultNotaryOrders = defaultNotaryOrders.filter((order) => !resetKeptOrderIds.has(order.orderId));
    const mergedOrders = shouldResetNotaryOrders
      ? [
          ...storedNonNotaryOrders,
          ...storedAgentSubmittedNotaryOrders,
          ...missingDefaultNonNotaryOrders,
          ...missingDomesticUntranslatedOrders,
          ...missingDomesticLicenseOrders,
          ...resetDefaultNotaryOrders,
        ]
      : [
          ...storedOrders.map((order) => backfillLegacyNamePinyin(normalizeDomesticLicenseAuditState(order))),
          ...missingDefaultNonNotaryOrders,
          ...missingDomesticUntranslatedOrders,
          ...missingDomesticLicenseOrders,
        ];
    const normalizedMergedOrders = mergedOrders.map((order) => backfillLegacyNamePinyin(normalizeDomesticLicenseAuditState(order)));
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(normalizedMergedOrders));
    window.localStorage.setItem(ORDER_DATA_VERSION_STORAGE_KEY, ORDER_DATA_VERSION);
    return normalizedMergedOrders;
  } catch {
    return defaultOrders;
  }
};

const findMatchingProcessType = (product: Product, order: Pick<Order, 'processType' | 'processTypeId'>) => {
  if (order.processTypeId) {
    const matchedById = product.processTypes.find((processType) => processType.typeId === order.processTypeId);
    if (matchedById) {
      return matchedById;
    }
  }

  return product.processTypes.find((processType) => processType.name === order.processType) || product.processTypes[0];
};

const syncOrderWithProduct = (order: Order, productsById: Map<string, Product>): Order => {
  const product = productsById.get(order.productId);
  if (!product) {
    return order;
  }

  const matchedProcessType = findMatchingProcessType(product, order);

  return {
    ...order,
    productName: product.category === 'notary' ? order.productName : product.title,
    productCategory: product.category,
    processType: matchedProcessType?.name || order.processType,
    processTypeId: matchedProcessType?.typeId || order.processTypeId,
  };
};

const syncOrdersWithProducts = () => {
  const productsById = new Map(_products.map((product) => [product.productId, product] as const));
  _orders = _orders.map((order) =>
    backfillLegacyNamePinyin(normalizeDomesticLicenseAuditState(normalizeNotaryManagementOrderStatus(syncOrderWithProduct(order, productsById)))),
  );
};

const buildDomesticLicenseInfo = (index: number, customerName: string, licenseNumber: string): DomesticLicenseInfo => {
  const exchangeLocation = DOMESTIC_EXCHANGE_LOCATIONS[index % DOMESTIC_EXCHANGE_LOCATIONS.length];
  const foreignLocation = DOMESTIC_FOREIGN_LICENSE_LOCATIONS[index % DOMESTIC_FOREIGN_LICENSE_LOCATIONS.length];

  return {
    exchangeProvince: exchangeLocation.province,
    exchangeCity: exchangeLocation.city,
    foreignCountry: foreignLocation.country,
    foreignCity: foreignLocation.city,
    chineseName: customerName,
    licenseNumber: `DL${licenseNumber.replace(/\D/g, '').slice(-8) || String(62000000 + index)}`,
    expiryDate: `203${index % 5}-0${(index % 9) + 1}-15`,
    surname: ['SMITH', 'JOHNSON', 'BROWN', 'LEE'][index % 4],
    givenName: ['ALEX', 'EMMA', 'DAVID', 'LUCY'][index % 4],
    birthDate: `198${index % 8}-0${(index % 9) + 1}-20`,
    rstr: index % 2 === 0 ? 'NONE' : 'CORR LENS',
    sex: index % 2 === 0 ? '男' : '女',
    hairColor: ['黑色', '棕色', '金色'][index % 3],
    eyeColor: ['棕色', '黑色', '蓝色'][index % 3],
    height: `${168 + (index % 20)}cm`,
    weight: `${58 + (index % 28)}kg`,
    issueDate: `202${index % 4}-0${(index % 9) + 1}-10`,
    fileNumber: `DD${String(900000 + index * 37)}`,
    classType: ['C', 'C1', 'D'][index % 3],
    endorsements: index % 2 === 0 ? 'NONE' : 'M1',
    restrictions: index % 2 === 0 ? 'NONE' : 'CORRECTIVE LENSES',
    other: index % 3 === 0 ? '样例数据，可在管理端审核页修改' : '',
    frontPhoto: '',
    backPhoto: '',
    passportPhoto: '',
  };
};

const normalizeDomesticLicenseAuditState = (order: Order): Order => {
  const backfilledOrder = backfillDomesticLicenseProductionLogs(order);

  if (
    DOMESTIC_LICENSE_UNMADE_ORDER_IDS.has(backfilledOrder.orderId) &&
    isDomesticLicenseOrder(backfilledOrder) &&
    !backfilledOrder.logs.some((log) => log.action === '已制作')
  ) {
    const translatedTime =
      backfilledOrder.logs.find((log) => log.action === '已翻译')?.time || backfilledOrder.updatedAt || backfilledOrder.createdAt;
    const translatedLog = backfilledOrder.logs.find((log) => log.action === '已翻译') || {
      time: translatedTime,
      operator: PRODUCTION_OPERATOR,
      action: '已翻译',
    };

    return {
      ...backfilledOrder,
      status: 'pending_production',
      logs: [
        ...backfilledOrder.logs.filter((log) => !PRODUCTION_NODE_ACTIONS.has(log.action)),
        translatedLog,
      ],
    };
  }

  if (!isDomesticLicenseOrder(backfilledOrder) || backfilledOrder.status !== 'pending_production') {
    return backfilledOrder;
  }

  if (
    hasManualAuditApproval(backfilledOrder) ||
    hasProductionWorkflowLog(backfilledOrder) ||
    backfilledOrder.managementOrderId?.trim()
  ) {
    return backfilledOrder;
  }

  if (
    !hasUserSubmittedMarker(backfilledOrder) &&
    !backfilledOrder.logs.some((log) => log.action === FORCE_UNTRANSLATED_INITIALIZED_ACTION)
  ) {
    return backfilledOrder;
  }

  return {
    ...backfilledOrder,
    status: 'pending_review',
    logisticsCompany: '',
    trackingNumber: '',
    shippedAt: undefined,
    managementOrderId: undefined,
    logs: backfilledOrder.logs.filter((log) => log.action !== FORCE_UNTRANSLATED_INITIALIZED_ACTION),
  };
};

const createDomesticLicenseUntranslatedOrders = (products: Product[]): Order[] => {
  const product = products.find((item) => item.title === DOMESTIC_LICENSE_PRODUCT_TITLE);
  const processTypes = product?.processTypes || [];

  if (!product || processTypes.length === 0) {
    return [];
  }

  const baseCreatedAt = '2026-05-11 09:20:00';

  return DOMESTIC_LICENSE_UNTRANSLATED_ORDER_IDS.map((orderId, index) => {
    const seed = 80 + index;
    const processType = processTypes[index % processTypes.length] || processTypes[0];
    const customerName = NAMES[seed % NAMES.length];
    const customerPassport = PASSPORTS[seed % PASSPORTS.length];
    const agentLevel = AGENT_LEVELS[seed % AGENT_LEVELS.length];
    const createdAt = addSecondsToTimestamp(baseCreatedAt, index * 60);
    const domesticLicenseInfo = buildDomesticLicenseInfo(seed, customerName, customerPassport);
    const domesticExchangeLocation = [domesticLicenseInfo.exchangeProvince, domesticLicenseInfo.exchangeCity].join(' ');
    const domesticForeignLocation = [domesticLicenseInfo.foreignCountry, domesticLicenseInfo.foreignCity].join(' ');
    const lockedPrice = processType.pricing.find((item) => item.agentLevel === agentLevel)?.price || product.defaultPrice || 289;

    return {
      orderId,
      customerName,
      customerPhone: PHONES[seed % PHONES.length],
      customerPassport,
      customerEmail: `domestic-untranslated-${index + 1}@example.com`,
      productId: product.productId,
      productName: product.title,
      productCategory: product.category,
      processType: processType.name,
      processTypeId: processType.typeId,
      pushTimeliness: getPushTimeliness(processType, seed),
      channel: CHANNELS[seed % CHANNELS.length],
      agentLevel,
      lockedPrice,
      status: 'pending_production',
      deliveryAddress: ADDRESSES[seed % ADDRESSES.length],
      logisticsCompany: '',
      trackingNumber: '',
      remark: '',
      licenseName: domesticLicenseInfo.chineseName,
      licenseNo: domesticLicenseInfo.licenseNumber,
      licenseCategory: domesticLicenseInfo.classType,
      licenseGender: domesticLicenseInfo.sex,
      licenseBirthDate: domesticLicenseInfo.birthDate,
      licenseAddress: domesticForeignLocation,
      licenseFirstIssueDate: domesticLicenseInfo.issueDate,
      licenseValidUntilDate: domesticLicenseInfo.expiryDate,
      licenseArchiveNumber: domesticLicenseInfo.fileNumber,
      licenseIssuingRegion: domesticExchangeLocation,
      useCountry: domesticLicenseInfo.foreignCountry,
      managementOrderId: getCompactTimestamp(addSecondsToTimestamp(createdAt, index)),
      domesticLicenseInfo,
      createdAt,
      updatedAt: addSecondsToTimestamp(createdAt, 600),
      shippedAt: undefined,
      logs: [
        { time: createdAt, operator: '系统', action: '订单创建' },
        { time: addSecondsToTimestamp(createdAt, 600), operator: '运营-小王', action: '审核通过' },
      ],
    };
  });
};

function createOrders(products: Product[]): Order[] {
  if (products.length === 0) {
    return [];
  }

  const orders: Order[] = [];
  const translationProductOrderCounts = new Map<string, number>();
  const standardProducts = products.filter((product) => product.category !== 'notary' && product.processTypes.length > 0);

  for (let index = 0; index < 56 && standardProducts.length > 0; index += 1) {
    const product = standardProducts[index % standardProducts.length];
    const productOrderCount = translationProductOrderCounts.get(product.productId) || 0;
    const processType = product.processTypes[productOrderCount % product.processTypes.length] || product.processTypes[0];
    translationProductOrderCounts.set(product.productId, productOrderCount + 1);
    const pushTimeliness = getPushTimeliness(processType, index);
    const status = STATUSES[index % STATUSES.length];
    const channel = CHANNELS[index % 4];
    const agentLevel = AGENT_LEVELS[index % 4];
    const customerName = NAMES[index % NAMES.length];
    const createdAt = randomDate(60);
    const updatedAt = randomDate(10);
    const shippedAt = status === 'shipped' || status === 'completed' ? updatedAt : undefined;

    const logs = [{ time: createdAt, operator: '系统', action: '订单创建' }];

    if (status !== 'pending_review') {
      logs.push({ time: randomDate(30), operator: '运营-小王', action: '审核通过' });
    }
    if (status === 'shipped' || status === 'completed') {
      logs.push({ time: randomDate(15), operator: '运营-小张', action: `录入物流单号 SF${1000000000 + index}` });
    }
    if (status === 'completed') {
      logs.push({ time: randomDate(5), operator: '系统', action: '确认签收，订单完成' });
    }
    if (status === 'cancelled') {
      logs.push({ time: randomDate(30), operator: '运营-小李', action: '审核拒绝：资料不完整' });
    }

    const lockedPrice =
      processType?.pricing.find((item) => item.agentLevel === agentLevel)?.price ||
      product.processTypes[index % product.processTypes.length]?.pricing.find((item) => item.agentLevel === agentLevel)?.price ||
      299;

    if (product.category === 'notary') {
      continue;
    }

    const orderProductName = product.title;
    const domesticLicenseInfo =
      orderProductName === DOMESTIC_LICENSE_PRODUCT_TITLE
        ? buildDomesticLicenseInfo(index, customerName, PASSPORTS[index % PASSPORTS.length])
        : undefined;
    const domesticExchangeLocation = domesticLicenseInfo
      ? [domesticLicenseInfo.exchangeProvince, domesticLicenseInfo.exchangeCity].join(' ')
      : undefined;
    const domesticForeignLocation = domesticLicenseInfo
      ? [domesticLicenseInfo.foreignCountry, domesticLicenseInfo.foreignCity].join(' ')
      : undefined;

    orders.push({
      orderId: `MK${String(2026).substring(2)}${String(index + 1).padStart(5, '0')}`,
      customerName,
      customerPhone: PHONES[index % PHONES.length],
      customerPassport: PASSPORTS[index % PASSPORTS.length],
      customerEmail: `user${index + 1}@example.com`,
      productId: product.productId,
      productName: orderProductName,
      productCategory: product.category,
      processType: processType?.name || '',
      processTypeId: processType?.typeId,
      pushTimeliness,
      channel,
      agentLevel,
      lockedPrice,
      status,
      deliveryAddress: ADDRESSES[index % ADDRESSES.length],
      logisticsCompany: status === 'shipped' || status === 'completed' ? '顺丰速运' : '',
      trackingNumber: status === 'shipped' || status === 'completed' ? `SF${1000000000 + index}` : '',
      remark: '',
      licenseName: domesticLicenseInfo?.chineseName,
      licenseNo: domesticLicenseInfo?.licenseNumber,
      licenseCategory: domesticLicenseInfo?.classType,
      licenseGender: domesticLicenseInfo?.sex,
      licenseBirthDate: domesticLicenseInfo?.birthDate,
      licenseAddress: domesticForeignLocation,
      licenseFirstIssueDate: domesticLicenseInfo?.issueDate,
      licenseValidUntilDate: domesticLicenseInfo?.expiryDate,
      licenseArchiveNumber: domesticLicenseInfo?.fileNumber,
      licenseIssuingRegion: domesticExchangeLocation,
      useCountry: domesticLicenseInfo?.foreignCountry,
      managementOrderId:
        domesticLicenseInfo && status !== 'pending_review'
          ? getCompactTimestamp(addSecondsToTimestamp(updatedAt, index))
          : undefined,
      domesticLicenseInfo,
      createdAt,
      updatedAt,
      shippedAt,
      logs,
    });
  }

  const notaryProduct = products.find((product) => product.category === 'notary') || products[0];
  let nextNotaryOrderSerial = getNextAvailableSeedOrderSerial(orders, orders.length + 1);
  for (let index = 0; index < NOTARY_PENDING_REVIEW_ORDER_COUNT && notaryProduct.processTypes.length > 0; index += 1) {
    const processType = notaryProduct.processTypes[index % notaryProduct.processTypes.length] || notaryProduct.processTypes[0];
    const pushTimeliness = getPushTimeliness(processType, index + orders.length);
    const customerName = NAMES[orders.length % NAMES.length];
    const createdAt = randomDate(10);
    const orderNum = nextNotaryOrderSerial;
    const logs = [{ time: createdAt, operator: '系统', action: '订单批量创建' }];

    orders.push({
      orderId: buildSeedOrderId(orderNum),
      customerName,
      customerPhone: PHONES[index % PHONES.length],
      customerPassport: PASSPORTS[index % PASSPORTS.length],
      customerEmail: `notary${orderNum}@example.com`,
      productId: notaryProduct.productId,
      productName: NOTARY_ORDER_NAMES[index % NOTARY_ORDER_NAMES.length],
      productCategory: 'notary',
      processType: processType.name,
      processTypeId: processType.typeId,
      pushTimeliness,
      channel: CHANNELS[index % 4],
      agentLevel: AGENT_LEVELS[index % 4],
      lockedPrice: 299,
      status: 'pending_review',
      deliveryAddress: ADDRESSES[index % ADDRESSES.length],
      logisticsCompany: '',
      trackingNumber: '',
      remark: '批量生成测试订单',
      licenseName: customerName,
      licenseNo: `D${20000000 + index}`,
      licenseCategory: index % 2 === 0 ? 'C1' : 'C2',
      language: ['英语', '法语', '德语', '日语'][index % 4],
      createdAt,
      updatedAt: createdAt,
      shippedAt: undefined,
      logs,
    });

    nextNotaryOrderSerial = getNextAvailableSeedOrderSerial(orders, orderNum + 1);
  }

  const idpProducts = products.filter((product) => product.category === 'idp' && product.processTypes.length > 0);

  for (let index = 0; index < EXTRA_IDP_PENDING_ORDER_COUNT && idpProducts.length > 0; index += 1) {
    const product = idpProducts[index % idpProducts.length];
    const processType = product.processTypes[index % product.processTypes.length] || product.processTypes[0];

    if (!processType) {
      continue;
    }

    const orderNum = getNextAvailableSeedOrderSerial(orders, orders.length + 1);
    const seed = orderNum - 1;
    const createdAt = randomDate(7);
    const customerName = NAMES[seed % NAMES.length];
    const agentLevel = AGENT_LEVELS[seed % AGENT_LEVELS.length];
    const lockedPrice =
      processType.pricing.find((item) => item.agentLevel === agentLevel)?.price ||
      product.processTypes[index % product.processTypes.length]?.pricing.find((item) => item.agentLevel === agentLevel)?.price ||
      299;

    orders.push({
      orderId: `MK${String(2026).substring(2)}${String(orderNum).padStart(5, '0')}`,
      customerName,
      customerPhone: PHONES[seed % PHONES.length],
      customerPassport: PASSPORTS[seed % PASSPORTS.length],
      customerEmail: `idp${orderNum}@example.com`,
      productId: product.productId,
      productName: product.title,
      productCategory: 'idp',
      processType: processType.name,
      processTypeId: processType.typeId,
      pushTimeliness: getPushTimeliness(processType, seed),
      channel: CHANNELS[seed % CHANNELS.length],
      agentLevel,
      lockedPrice,
      status: 'pending_review',
      deliveryAddress: ADDRESSES[seed % ADDRESSES.length],
      logisticsCompany: '',
      trackingNumber: '',
      remark: 'IDP待审核补充数据',
      createdAt,
      updatedAt: createdAt,
      shippedAt: undefined,
      logs: [{ time: createdAt, operator: '系统', action: '订单创建' }],
    });
  }

  return excludeNotarySystemGeneratedOrders(
    excludeDomesticLicenseSystemGeneratedOrders([
      ...orders,
      ...createDomesticLicenseUntranslatedOrders(products),
    ]),
  ).map(normalizeDomesticLicenseAuditState);
}

let _products = loadProducts();
let _orders = loadOrders(_products);

const migratePersistedOrderImages = () => {
  if (!isBrowser()) return;

  void migrateDomesticLicenseOrderImages(_orders)
    .then(({ didChange, orders }) => {
      if (!didChange) {
        return;
      }

      _orders = orders;
      persistOrders();
    })
    .catch(() => {
      // Keep the order data usable even when the browser blocks IndexedDB.
    });
};

migratePersistedOrderImages();

export function getOrders() {
  syncOrdersWithProducts();
  return _orders.map(cloneOrder);
}

export function getOrderById(id: string) {
  syncOrdersWithProducts();
  const order = _orders.find((item) => item.orderId === id);
  return order ? cloneOrder(order) : undefined;
}

export function updateOrder(id: string, updates: Partial<Order>) {
  _orders = _orders.map((order) => {
    if (order.orderId !== id) {
      return order;
    }

    const isShippingTransition = order.status === 'in_production' && updates.status === 'shipped';
    if (!isShippingTransition || updates.shippedAt) {
      return backfillLegacyNamePinyin(normalizeDomesticLicenseAuditState({ ...order, ...updates }));
    }

    const shippedTime = getCurrentTimestamp();
    return backfillLegacyNamePinyin(
      normalizeDomesticLicenseAuditState({
        ...order,
        ...updates,
        shippedAt: shippedTime,
        updatedAt: updates.updatedAt || shippedTime,
      }),
    );
  });
  persistOrders();
}

export function addOrder(order: Omit<Order, 'orderId'> & { orderId?: string }) {
  const nextOrder: Order = backfillLegacyNamePinyin(
    normalizeDomesticLicenseAuditState({
      ...order,
      orderId: order.orderId || buildNextOrderId(),
    }),
  );
  const previousOrders = _orders;

  _orders = [nextOrder, ..._orders];
  try {
    persistOrders();
  } catch (error) {
    _orders = previousOrders;
    throw error;
  }
  return cloneOrder(nextOrder);
}

export function getProducts() {
  return _products.map(cloneProduct);
}

export function getProductById(id: string) {
  const product = _products.find((item) => item.productId === id);
  return product ? cloneProduct(product) : undefined;
}

export function updateProduct(id: string, updates: Partial<Product>) {
  _products = _products.map((product) => (product.productId === id ? normalizeProduct({ ...product, ...updates }, 0) : product));
  syncOrdersWithProducts();
  persistProducts();
  persistOrders();
}

export function addProduct(product: Product) {
  _products = [..._products, normalizeProduct(product, _products.length)];
  syncOrdersWithProducts();
  persistProducts();
  persistOrders();
}

export function deleteProduct(id: string) {
  _products = _products.filter((product) => product.productId !== id);
  syncOrdersWithProducts();
  persistProducts();
  persistOrders();
}

export function getNextProductId() {
  return `MK-${Math.max(getStoredNextProductNumericId(), getNextProductNumericIdFromProducts(_products))}`;
}
