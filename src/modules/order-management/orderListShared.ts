import type { AgentLevel, Order, OrderStatus } from '../../shared/types';

export type TranslationOrderStatus = 'pending_review' | 'pending_production' | 'shipped' | 'cancelled';
export type IdpVisibleStatus = 'pending_review' | 'shipped';

export const TRANSLATION_STATUS_TABS: Array<{ label: string; value: TranslationOrderStatus | '' }> = [
  { label: '全部订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '待制作', value: 'pending_production' },
  { label: '已发货', value: 'shipped' },
  { label: '已取消', value: 'cancelled' },
];

export const IDP_STATUS_TABS: Array<{ label: string; value: IdpVisibleStatus | '' }> = [
  { label: '全部订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '已完成', value: 'shipped' },
];

const AGENT_NAMES: Record<AgentLevel, string> = {
  self: '美卡自营',
  l1: '上海美卡服务中心',
  l2: '常州语联翻译有限公司',
  l3: '深圳万里行服务中心',
};

const IDP_NAME_PINYIN_MAP: Record<string, string> = {
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
};

const NATIONALITY_CODE_MAP: Record<string, string> = {
  中国: 'CHN',
};

const CUSTOMER_DESTINATION_COUNTRIES = ['澳大利亚', '新西兰', '日本', '英国', '美国', '加拿大'];

export const getAgentName = (order: Order) => AGENT_NAMES[order.agentLevel] || '美卡自营';

export const getLicenseName = (order: Order) => order.licenseName || order.customerName;

export const getLicenseNo = (order: Order) => order.licenseNo || order.customerPassport;

export const getLicenseCategory = (order: Order) => order.licenseCategory || (order.productCategory === 'idp' ? 'C1' : 'C2');

export const getDisplayText = (value?: string | null) => value?.trim() || '--';

const getOrderSeed = (order: Order) =>
  order.orderId.split('').reduce((total, char) => total + char.charCodeAt(0), 0);

const extractRegionFromAddress = (address?: string) => {
  const normalizedAddress = address?.trim() || '';
  if (!normalizedAddress) {
    return '';
  }

  const leadingText = normalizedAddress.match(/^[^\d,\s]{2,12}/)?.[0]?.trim();
  return leadingText || normalizedAddress.slice(0, 12);
};

const getOrderNationality = (order: Order) => getDisplayText(order.licenseNationality || '中国');

export const getOrderIssuingRegion = (order: Order) =>
  getDisplayText(order.licenseIssuingRegion || extractRegionFromAddress(order.licenseAddress || order.deliveryAddress));

export const getIdpNamePinyin = (order: Order) => {
  const name = getLicenseName(order).trim();
  if (!name) {
    return '--';
  }

  const pinyinParts = Array.from(name).map((char) => IDP_NAME_PINYIN_MAP[char]).filter(Boolean);
  return pinyinParts.length === Array.from(name).length ? pinyinParts.join(' ') : '--';
};

export const getIdpValidityYears = (order: Order) => {
  const normalizedValue = order.licenseValidYears?.replace(/[^\d]/g, '').trim();
  return normalizedValue || '3';
};

export const getIdpNationalityDisplay = (order: Order) => {
  const nationality = getOrderNationality(order);
  const code = NATIONALITY_CODE_MAP[nationality];
  return code ? `${nationality}/${code}` : nationality;
};

export const getIdpOrderPushTime = (order: Order) =>
  [...order.logs].reverse().find((log) => /推送/.test(log.action))?.time?.trim() || '';

export const getOrderDestinationCountry = (order: Order) => {
  const orderWithDestination = order as Order & { destinationCountry?: string };
  const explicitCountry = orderWithDestination.destinationCountry?.trim();
  if (explicitCountry) {
    return explicitCountry;
  }

  const normalizedProductName = order.productName.toLowerCase();
  if (normalizedProductName.includes('nzta')) {
    return '新西兰';
  }

  if (normalizedProductName.includes('naati')) {
    return '澳大利亚';
  }

  return CUSTOMER_DESTINATION_COUNTRIES[getOrderSeed(order) % CUSTOMER_DESTINATION_COUNTRIES.length];
};

export const getRejectReason = (order: Order) => {
  const directReason = order.rejectReason?.trim();
  if (directReason) {
    return directReason;
  }

  const rejectLog = [...order.logs].reverse().find((log) => /审核拒绝|审核驳回/.test(log.action));
  const logReason = rejectLog?.action.match(/审核(?:拒绝|驳回)[：:\s]*(.+)$/)?.[1]?.trim();
  if (logReason) {
    return logReason;
  }

  const remarkReason = order.remark?.trim();
  return remarkReason || '--';
};

const joinExportSegments = (segments: Array<string | undefined>) =>
  segments.filter((segment): segment is string => Boolean(segment && segment.trim())).join('，');

export const getRecipientInfo = (order: Order) =>
  joinExportSegments([
    `收件人：${order.customerName}`,
    order.customerPhone ? `手机：${order.customerPhone}` : undefined,
    !order.customerPhone && order.customerEmail ? `邮箱：${order.customerEmail}` : undefined,
    order.deliveryAddress ? `地址：${order.deliveryAddress}` : undefined,
  ]);

export const getLicenseInfo = (order: Order) =>
  joinExportSegments([
    `姓名：${getLicenseName(order)}`,
    getLicenseNo(order) ? `驾照号：${getLicenseNo(order)}` : undefined,
    getLicenseCategory(order) ? `准驾车型：${getLicenseCategory(order)}` : undefined,
    order.domesticLicenseInfo
      ? `换证城市：${order.licenseIssuingRegion || `${order.domesticLicenseInfo.exchangeProvince} ${order.domesticLicenseInfo.exchangeCity}`}`
      : undefined,
    order.domesticLicenseInfo
      ? `驾照发放国家及城市：${order.domesticLicenseInfo.foreignCountry} ${order.domesticLicenseInfo.foreignCity}`
      : undefined,
    order.domesticLicenseInfo ? `中文姓名：${order.domesticLicenseInfo.chineseName}` : undefined,
  ]);

export const getLogisticsInfo = (order: Order) =>
  joinExportSegments([
    order.logisticsCompany ? `物流公司：${order.logisticsCompany}` : undefined,
    order.trackingNumber ? `物流单号：${order.trackingNumber}` : undefined,
  ]);

export const getExportErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message.includes('template')) {
      return '导出模板加载失败';
    }

    if (
      error.message.includes('initialize Excel export module') ||
      error.message.includes('load Excel export runtime')
    ) {
      return '导出组件加载失败';
    }
  }

  return '导出失败，请稍后重试';
};

export const getTranslationOrderStatus = (status: OrderStatus): TranslationOrderStatus => {
  const map: Record<OrderStatus, TranslationOrderStatus> = {
    translating: 'pending_review',
    pending_review: 'pending_review',
    pending_production: 'pending_production',
    in_production: 'pending_production',
    shipped: 'shipped',
    completed: 'shipped',
    cancelled: 'cancelled',
    rejected: 'cancelled',
  };

  return map[status];
};

export const getIdpVisibleStatus = (order: Order): IdpVisibleStatus =>
  order.status === 'pending_review' ? 'pending_review' : 'shipped';

export const statusTagClass = (status: OrderStatus) => {
  const map: Record<TranslationOrderStatus, string> = {
    pending_review: 'pending',
    pending_production: 'processing',
    shipped: 'shipped',
    cancelled: 'cancelled',
  };

  return `tag tag--${map[getTranslationOrderStatus(status)]}`;
};

export const getOrderShippedSortValue = (order: Order) => {
  if (order.shippedAt?.trim()) {
    return order.shippedAt.trim();
  }

  const logisticsLog = [...order.logs].reverse().find((log) => /(录入物流单号|发货)/.test(log.action));
  if (logisticsLog?.time?.trim()) {
    return logisticsLog.time.trim();
  }

  return order.updatedAt || order.createdAt || '';
};

const PRODUCTION_NODE_ACTIONS = ['已翻译', '已制作', '已发货'] as const;

export const getProductionOrderRecords = (order: Order) => {
  const nodeRecords = PRODUCTION_NODE_ACTIONS.flatMap((action) => {
    const log = [...order.logs].reverse().find((item) => item.action === action);
    return log ? [`${action} ${log.time.slice(0, 16)}`] : [];
  });

  if (nodeRecords.length > 0) {
    return nodeRecords;
  }

  const shippedStatus = getTranslationOrderStatus(order.status) === 'shipped';

  if (shippedStatus) {
    const shippedTime = (order.shippedAt || order.updatedAt || order.createdAt).slice(0, 16);
    return [`已发货 ${shippedTime}`];
  }

  return [];
};

export const getCurrentTimestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

export const getOrderListExportFileName = (prefix: string) =>
  `${prefix}_${getCurrentTimestamp().replace(/\s+/g, '_').replace(/:/g, '-')}.xlsx`;

export const getIdpCreatedAtDisplay = (order: Order) => {
  const [date = '--', time = '--'] = getDisplayText(order.createdAt).split(' ');
  return { date, time };
};
