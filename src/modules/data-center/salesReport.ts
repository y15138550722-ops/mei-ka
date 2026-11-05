import type { Order, OrderSourceChannel } from '../../shared/types/index.ts';
import type { KlookOrder } from '../order-management/klookOrderService.ts';
import { formatBeijingTimestamp, normalizeBeijingTimestamp } from '../../shared/utils/dateTime.ts';

export type TimeGrain = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type ReportDimension = 'time' | 'channel' | 'product';
export type SalesChannel = 'taobao' | 'partner' | 'rental' | 'agent';
export type SalesProductLine = 'translation' | 'notary' | 'idp' | 'other';
export const TIME_GRAINS: ReadonlyArray<{ key: TimeGrain; label: string }> = [
  { key: 'day', label: '日' }, { key: 'week', label: '周' }, { key: 'month', label: '月' },
  { key: 'quarter', label: '季度' }, { key: 'year', label: '年' },
];
export const SALES_CHANNELS: ReadonlyArray<{ key: SalesChannel; label: string }> = [
  { key: 'taobao', label: '自营' }, { key: 'partner', label: '合作渠道' },
  { key: 'rental', label: '租车公司' }, { key: 'agent', label: '代理商' },
];
export const SALES_CHANNEL_DETAILS: ReadonlyArray<{ channel: SalesChannel; name: string }> = [
  ...['全球驾照翻译认证中心', '全球国际驾照', 'mculture旗舰店', 'IDD企业店', '中国公证海牙认证中心'].map((name) => ({ channel: 'taobao' as const, name })),
  ...['Klook', '携程', '哈啰'].map((name) => ({ channel: 'partner' as const, name })),
  ...['avis', 'sixt', '悟空租车', 'enterprise', 'europcar'].map((name) => ({ channel: 'rental' as const, name })),
];
export const SALES_PRODUCT_LINES: ReadonlyArray<{ key: SalesProductLine; label: string }> = [
  { key: 'translation', label: '翻译认证' }, { key: 'notary', label: '公证' },
  { key: 'idp', label: 'IDD / IDP' }, { key: 'other', label: '其他产品' },
];
export const SALES_PRODUCTS: ReadonlyArray<{ productLine: SalesProductLine; name: string }> = [
  ...['小白本', 'NAATI澳大利亚（电子版）', 'NAATI澳大利亚（原件）', 'NZTA新西兰（电子版）', 'NZTA新西兰（原件）',
    ...['西班牙语', '德语', '法语', '意大利语'].flatMap((language) => [`${language}宣誓翻译（电子版）`, `${language}宣誓翻译（原件）`]),
    'ATIO', '波兰语宣誓'].map((name) => ({ productLine: 'translation' as const, name })),
  ...['公证单号', '公证双号', '海牙单号', '海牙双号'].map((name) => ({ productLine: 'notary' as const, name })),
  ...['IDP', 'IDP加急', 'IDD国际驾照', 'IDD加急'].map((name) => ({ productLine: 'idp' as const, name })),
];
export const REPORT_DIMENSIONS: ReadonlyArray<{ key: ReportDimension; label: string }> = [
  { key: 'time', label: '按时间' }, { key: 'channel', label: '按渠道' }, { key: 'product', label: '按产品' },
];

/** Sales API fields from BRD26005; local demo orders are adapted separately. */
export interface SalesSourceOrder {
  orderId: string;
  createdAt: string;
  status: string | number;
  totalprice?: string | number | null;
  refund_time?: string | null;
  products?: Array<{ name?: string }>;
  title?: string;
  agent_nick_name?: string;
  nick_name?: string;
  sourcefrom?: string;
  sourceChannel?: OrderSourceChannel;
  legacyChannel?: Order['channel'];
  agentLevel?: Order['agentLevel'];
  productCategory?: Order['productCategory'];
  managementOrderId?: string;
}
export interface SalesRecord {
  key: string;
  date: string;
  channel: SalesChannel;
  channelDetail: string;
  productLine: SalesProductLine;
  product: string;
  unpaid: boolean;
  refunded: boolean;
  amountCents: number | null;
}
export interface SalesFilters {
  startDate: string;
  endDate: string;
  channel: SalesChannel | '';
  channelDetail: string;
  productLine: SalesProductLine | '';
  product: string;
}
export interface SalesMetrics {
  orderCount: number;
  amountCents: number;
  refundCount: number;
  refundCents: number;
  unpricedCount: number;
  unpricedRefundCount: number;
}
export interface SalesRow extends SalesMetrics {
  key: string;
  label: string;
  channel?: SalesChannel;
  channelDetail?: string;
  productLine?: SalesProductLine;
  product?: string;
}
export interface SalesReport { totals: SalesMetrics; rows: SalesRow[] }
export interface SalesBreakdownRow extends SalesRow {
  channel: SalesChannel;
  channelDetail: string;
  productLine: SalesProductLine;
  product: string;
}

const RENTALS: Partial<Record<OrderSourceChannel, string>> = {
  avis_api: 'avis', enterprise_api: 'enterprise', wechat_sixt: 'sixt',
  wechat_europcar: 'europcar', wukong_channel: '悟空租车',
};
const AGENTS: Partial<Record<OrderSourceChannel, string>> = {
  partner_shandong_yiwo: '山东译沃教育科技有限公司', partner_changzhou_yulian: '常州语联',
  shenkong_channel: '深空粒子科技', partner_hangzhou_yuecheng: '杭州越珵科技有限公司',
  partner_wuhan_honghuzhizhi: '武汉鸿鹄之志翻译服务有限公司', partner_yibantong_luoyang: '易办通网络科技（洛阳）有限公司',
  partner_wanteng_translation: '万腾翻译', partner_karlowen_flagship: 'KARLOWEN旗舰店',
  partner_hangzhou_yundian: '杭州云典',
};
const TAOBAO_SHOPS = SALES_CHANNEL_DETAILS.filter((item) => item.channel === 'taobao').map((item) => item.name);
export const channelDisplayName = (name: string, _channel: SalesChannel) => name;

const getChannel = (order: SalesSourceOrder, apiSource?: 'klook' | 'hello'): Pick<SalesRecord, 'channel' | 'channelDetail'> => {
  const result = (channel: SalesChannel, channelDetail: string) => ({ channel, channelDetail });
  const source = order.sourceChannel;
  if (apiSource === 'klook' || source === 'klook_api') return result('partner', 'Klook');
  if (apiSource === 'hello' || source === 'hello_api') return result('partner', '哈啰');
  if (source === 'ctrip_api') return result('partner', '携程');
  const hints = [order.agent_nick_name, order.nick_name, order.sourcefrom].filter(Boolean).join(' ');
  const shop = TAOBAO_SHOPS.find((name) => hints.toLowerCase().includes(name.toLowerCase()));
  if (shop) return result('taobao', shop);
  if (/klook/i.test(hints)) return result('partner', 'Klook');
  if (/携程|ctrip/i.test(hints)) return result('partner', '携程');
  if (/哈啰|哈罗|hello/i.test(hints)) return result('partner', '哈啰');
  if (source && RENTALS[source]) return result('rental', RENTALS[source]!);
  const rental = [['avis', /avis|abg/i], ['enterprise', /enterprise/i], ['sixt', /sixt/i],
    ['europcar', /europcar/i], ['悟空租车', /悟空/]] as const;
  const matchedRental = rental.find(([, pattern]) => pattern.test(hints));
  if (matchedRental) return result('rental', matchedRental[0]);
  if (source === 'self_taobao') return result('taobao', '淘宝店铺（未细分）');
  if (order.agent_nick_name?.trim()) return result('agent', order.agent_nick_name.trim());
  if (source && AGENTS[source]) return result('agent', AGENTS[source]!);
  if (source === 'self_wechat') return result('taobao', '自营微信小程序');
  if (source === 'self_alipay') return result('taobao', '自营支付宝小程序');
  if (source === 'wechat_ehi') return result('rental', '一嗨租车');
  if (order.legacyChannel === 'ctrip') return result('partner', '携程');
  if (source === 'agent_recharge' || order.agentLevel && order.agentLevel !== 'self') return result('agent', '代理商（未记录名称）');
  if (order.legacyChannel === 'fliggy') return result('partner', '飞猪（历史来源）');
  const legacy = { private: '自营私域（未细分）', offline: '自营线下（未细分）' };
  return result('taobao', order.legacyChannel ? legacy[order.legacyChannel] : '自营（来源待完善）');
};

const getProductLine = (name: string, category?: Order['productCategory']): SalesProductLine => {
  if (category === 'idp' || /\bID[PD]\b|国际驾照/i.test(name)) return 'idp';
  if (category === 'notary' || category === 'local_language_notary' || /公证|海牙/.test(name)) return 'notary';
  if (category === 'translation' || /小白本|NAATI|NZTA|ATIO|宣誓|翻译认证/i.test(name)) return 'translation';
  return 'other';
};

/** Keep delivery variants distinct, while combining spelling aliases for the same product. */
export const normalizeSalesProduct = (name: string, category?: Order['productCategory']) => {
  const compact = name.replace(/\s+/g, '').replace(/\(/g, '（').replace(/\)/g, '）');
  const variant = /电子/.test(compact) ? '（电子版）' : /原件/.test(compact) ? '（原件）' : '';
  let product = name;
  if (/小白本/.test(compact)) product = '小白本';
  else if (/NAATI/i.test(compact)) product = `NAATI澳大利亚${variant}`;
  else if (/NZTA/i.test(compact)) product = `NZTA新西兰${variant}`;
  else if (/\bATIO\b/i.test(name)) product = `ATIO${variant}`;
  else if (/波兰.*宣誓/.test(compact)) product = `波兰语宣誓${variant}`;
  else if (/宣誓/.test(compact)) {
    const language = [['西班牙语', /西班牙|西语/], ['德语', /德语|德文/], ['法语', /法语|法文/], ['意大利语', /意大利|意语/]] as const;
    const match = language.find(([, pattern]) => pattern.test(compact));
    if (match) product = `${match[0]}宣誓翻译${variant}`;
  } else if (/海牙.*双号/.test(compact)) product = '海牙双号';
  else if (/海牙.*单号/.test(compact)) product = '海牙单号';
  else if (/^公证[单双]号$/.test(compact)) product = compact;
  else if (/^IDP(?:国际驾照)?(?:（?加急）?)?$/i.test(compact)) product = /加急/.test(compact) ? 'IDP加急' : 'IDP';
  else if (/^IDD(?:国际驾照)?(?:（?加急）?)?$/i.test(compact)) product = /加急/.test(compact) ? 'IDD加急' : 'IDD国际驾照';
  const productLine = SALES_PRODUCTS.find((item) => item.name === product)?.productLine || getProductLine(product, category);
  return { product, productLine };
};
const parseAmount = (value: SalesSourceOrder['totalprice']) => {
  if (value === null || value === undefined || typeof value === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(Math.round(amount * 100)) ? Math.round(amount * 100) : null;
};

export const normalizeSalesOrder = (order: SalesSourceOrder, key = order.orderId, apiSource?: 'klook' | 'hello'): SalesRecord => {
  const product = order.products?.[0]?.name?.trim() || order.title?.trim() || '产品待完善';
  return {
    key, date: normalizeBeijingTimestamp(order.createdAt).slice(0, 10),
    ...getChannel(order, apiSource), ...normalizeSalesProduct(product, order.productCategory),
    unpaid: String(order.status) === '1' || order.status === 'pending_payment',
    refunded: Boolean(order.refund_time?.trim()) || String(order.status) === '-1' || order.status === 'cancelled',
    amountCents: parseAmount(order.totalprice),
  };
};

export const buildSalesRecords = (orders: ReadonlyArray<Order>, klook: ReadonlyArray<KlookOrder>, hello: ReadonlyArray<KlookOrder>): SalesRecord[] => {
  const records = new Map<string, SalesRecord>();
  for (const order of orders) {
    const source = order as Order & Partial<SalesSourceOrder>;
    const key = `main:${order.orderId}`;
    records.set(key, normalizeSalesOrder({ ...source, totalprice: source.totalprice ?? order.lockedPrice, title: source.title || order.productName, legacyChannel: order.channel }, key));
  }
  for (const [channel, sourceOrders] of [['klook', klook], ['hello', hello]] as const) {
    for (const order of sourceOrders) {
      const linked = order.managementOrderId ? records.get(`main:${order.managementOrderId}`) : undefined;
      if (linked) {
        // Linked management copies own sales facts; API supplies attribution.
        records.set(linked.key, { ...linked, ...getChannel(order, channel) });
      } else {
        const source = order as KlookOrder & Partial<SalesSourceOrder>;
        const key = `${channel}:${order.orderId}`;
        records.set(key, normalizeSalesOrder({ ...source, totalprice: source.totalprice ?? order.lockedPrice, title: source.title || order.productName }, key, channel));
      }
    }
  }
  return Array.from(records.values());
};

export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const previousYear = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`);
  const month = value.getUTCMonth();
  value.setUTCFullYear(value.getUTCFullYear() - 1);
  if (value.getUTCMonth() !== month) value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
};
export const defaultSalesFilters = (today = formatBeijingTimestamp().slice(0, 10)): SalesFilters => ({
  startDate: addDays(today, -29), endDate: today, channel: '', channelDetail: '', productLine: '', product: '',
});
export const comparisonFilters = (filters: SalesFilters, kind: 'previous' | 'year'): SalesFilters => {
  const days = Math.round((Date.parse(`${filters.endDate}T00:00:00Z`) - Date.parse(`${filters.startDate}T00:00:00Z`)) / 86400000) + 1;
  return kind === 'previous'
    ? { ...filters, startDate: addDays(filters.startDate, -days), endDate: addDays(filters.startDate, -1) }
    : { ...filters, startDate: previousYear(filters.startDate), endDate: previousYear(filters.endDate) };
};
export const timeBucket = (date: string, grain: TimeGrain) => {
  if (grain === 'day') return date;
  if (grain === 'month') return date.slice(0, 7);
  if (grain === 'quarter') return `${date.slice(0, 4)} Q${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
  if (grain === 'year') return date.slice(0, 4);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
};
const bucketLabel = (key: string, grain: TimeGrain) => grain === 'week' ? `${key} 当周` : key;
const emptyMetrics = (): SalesMetrics => ({ orderCount: 0, amountCents: 0, refundCount: 0, refundCents: 0, unpricedCount: 0, unpricedRefundCount: 0 });
export const averageSalesAmount = (metrics: SalesMetrics): number | null => metrics.unpricedCount > 0 || !metrics.orderCount ? null : metrics.amountCents / metrics.orderCount / 100;
export const changeRate = (value: number | null, previous: number | null): number | null =>
  value === null || previous === null || previous === 0 ? null : (value - previous) / previous * 100;
const addRecord = (metrics: SalesMetrics, record: SalesRecord) => {
  metrics.orderCount += 1;
  if (record.amountCents === null) metrics.unpricedCount += 1;
  else metrics.amountCents += record.amountCents;
  if (record.refunded) {
    metrics.refundCount += 1;
    if (record.amountCents === null) metrics.unpricedRefundCount += 1;
    else metrics.refundCents += record.amountCents;
  }
};
const matchesSalesFilters = (record: SalesRecord, filters: SalesFilters) =>
  !record.unpaid && Boolean(record.date) && record.date >= filters.startDate && record.date <= filters.endDate &&
  (!filters.channel || record.channel === filters.channel) && (!filters.channelDetail || record.channelDetail === filters.channelDetail) &&
  (!filters.productLine || record.productLine === filters.productLine) && (!filters.product || record.product === filters.product);

export const buildSalesReport = (records: ReadonlyArray<SalesRecord>, filters: SalesFilters, dimension: ReportDimension, grain: TimeGrain): SalesReport => {
  const totals = emptyMetrics();
  const rows = new Map<string, SalesRow>();
  for (const record of records) {
    if (!matchesSalesFilters(record, filters)) continue;
    const key = dimension === 'time' ? timeBucket(record.date, grain) : dimension === 'channel' ? `${record.channel}:${record.channelDetail}` : record.product;
    const label = dimension === 'time' ? bucketLabel(key, grain) : dimension === 'channel' ? channelDisplayName(record.channelDetail, record.channel) : record.product;
    const row = rows.get(key) || {
      key, label, ...emptyMetrics(),
      ...(dimension === 'channel' ? { channel: record.channel, channelDetail: record.channelDetail } : {}),
      ...(dimension === 'product' ? { productLine: record.productLine, product: record.product } : {}),
    };
    addRecord(row, record);
    addRecord(totals, record);
    rows.set(key, row);
  }
  if (dimension === 'time') {
    for (let date = filters.startDate; date <= filters.endDate; date = addDays(date, 1)) {
      const key = timeBucket(date, grain);
      if (!rows.has(key)) rows.set(key, { key, label: bucketLabel(key, grain), ...emptyMetrics() });
    }
  }
  if (dimension === 'channel' && filters.channel && !filters.channelDetail) {
    for (const item of SALES_CHANNEL_DETAILS.filter((item) => item.channel === filters.channel)) {
      const key = `${item.channel}:${item.name}`;
      if (!rows.has(key)) rows.set(key, { key, label: item.name, channel: item.channel, channelDetail: item.name, ...emptyMetrics() });
    }
  }
  if (dimension === 'product' && filters.product && !rows.size) {
    const item = SALES_PRODUCTS.find((item) => item.name === filters.product);
    rows.set(filters.product, { key: filters.product, label: filters.product, product: filters.product,
      productLine: item?.productLine || filters.productLine || 'other', ...emptyMetrics() });
  }
  return { totals, rows: Array.from(rows.values()).sort((a, b) => dimension === 'time' ? a.key.localeCompare(b.key) : b.amountCents - a.amountCents || a.key.localeCompare(b.key)) };
};

/** First level follows the four business channel groups; unknown sources stay explicit. */
export const buildSalesChannelGroups = (records: ReadonlyArray<SalesRecord>, filters: SalesFilters): SalesReport => {
  const rows = new Map<SalesChannel, SalesRow>(SALES_CHANNELS
    .filter((item) => !filters.channel || filters.channel === item.key)
    .map((item) => [item.key, { key: item.key, label: item.label, channel: item.key, ...emptyMetrics() }]));
  const totals = emptyMetrics();
  for (const record of records) {
    if (!matchesSalesFilters(record, filters)) continue;
    const row = rows.get(record.channel) || {
      key: record.channel, label: SALES_CHANNELS.find((item) => item.key === record.channel)!.label,
      channel: record.channel, ...emptyMetrics(),
    };
    addRecord(row, record);
    addRecord(totals, record);
    rows.set(record.channel, row);
  }
  return { totals, rows: Array.from(rows.values()) };
};

/** The same filtered business orders underpin both parent totals and product details. */
export const buildSalesBreakdown = (records: ReadonlyArray<SalesRecord>, filters: SalesFilters): SalesBreakdownRow[] => {
  const rows = new Map<string, SalesBreakdownRow>();
  for (const record of records) {
    if (!matchesSalesFilters(record, filters)) continue;
    const key = JSON.stringify([record.channel, record.channelDetail, record.productLine, record.product]);
    const row = rows.get(key) || {
      key, label: record.product, channel: record.channel, channelDetail: record.channelDetail,
      productLine: record.productLine, product: record.product, ...emptyMetrics(),
    };
    addRecord(row, record);
    rows.set(key, row);
  }
  return Array.from(rows.values()).sort((a, b) =>
    a.channelDetail.localeCompare(b.channelDetail, 'zh-CN') || b.amountCents - a.amountCents || a.product.localeCompare(b.product, 'zh-CN'));
};

export interface SalesExportAnalysis {
  trend: ReadonlyArray<SalesRow>;
  channels: ReadonlyArray<SalesRow>;
  products: ReadonlyArray<SalesRow>;
  comparison?: { label: string; filters: SalesFilters; report: SalesReport };
}

export const salesReportCsv = (rows: ReadonlyArray<SalesRow>, totals: SalesMetrics, filters: SalesFilters, dimension: string, breakdown: ReadonlyArray<SalesBreakdownRow> = [], analysis?: SalesExportAnalysis) => {
  const averageLabel = (row: SalesMetrics) => averageSalesAmount(row)?.toFixed(2) ?? (row.unpricedCount ? '待补金额' : '—');
  const metricRows = (items: ReadonlyArray<SalesRow>) => items.map((row) => [row.label, row.orderCount, (row.amountCents / 100).toFixed(2), row.refundCount, (row.refundCents / 100).toFixed(2), averageLabel(row), row.unpricedCount]);
  const headings = ['统计项', '订单量', '销售额（元）', '退单量', '退单金额（元）', '客单价（元）', '未计价订单量'];
  const comparisonMetrics: Array<{ label: string; value: (m: SalesMetrics) => number | null }> = [
    { label: '订单量', value: (m) => m.orderCount },
    { label: '销售额（元）', value: (m) => m.unpricedCount ? null : m.amountCents / 100 },
    { label: '退单量', value: (m) => m.refundCount },
    { label: '退单金额（元）', value: (m) => m.unpricedRefundCount ? null : m.refundCents / 100 },
    { label: '客单价（元）', value: averageSalesAmount },
  ];
  const data: Array<Array<string | number>> = [
    ['销售报表', `${filters.startDate} 至 ${filters.endDate}`, '北京时间'],
    ['渠道', filters.channelDetail || SALES_CHANNELS.find((item) => item.key === filters.channel)?.label || '全部渠道'],
    ['产品', filters.product || SALES_PRODUCT_LINES.find((item) => item.key === filters.productLine)?.label || '全部产品'],
    [dimension, '订单量', '销售额（元）', '退单量', '退单金额（元）', '客单价（元）', '未计价订单量'],
    ...metricRows([...rows, { ...totals, key: 'total', label: '合计' }]),
    ...(analysis ? [
      [], ['以下各节为同一批订单的不同分析视图，不重复计入合计'],
      ['销售趋势'], headings, ...metricRows(analysis.trend),
      [], ['渠道销售分布'], headings, ...metricRows(analysis.channels),
      [], ['产品销售分布'], headings, ...metricRows(analysis.products),
    ] : []),
    ...(analysis?.comparison ? [
      [], [`${analysis.comparison.label}对比`, `${analysis.comparison.filters.startDate} 至 ${analysis.comparison.filters.endDate}`],
      headings, ...metricRows([{ ...analysis.comparison.report.totals, key: 'comparison', label: '对比期合计' }]),
      ['指标对比', '本期', '对比期', '变动率'],
      ...comparisonMetrics.map((metric) => {
        const current = metric.value(totals);
        const baseline = metric.value(analysis.comparison!.report.totals);
        const rate = changeRate(current, baseline);
        return [metric.label, current?.toFixed(2) ?? (totals.unpricedCount ? '待补金额' : '—'), baseline?.toFixed(2) ?? (analysis.comparison!.report.totals.unpricedCount ? '待补金额' : '—'), rate === null ? '—' : `${rate.toFixed(1)}%`];
      }),
      ['对比期趋势'], headings, ...metricRows(analysis.comparison.report.rows),
    ] : []),
    ...(breakdown.length ? [
      [], ['渠道 × 产品明细（与上方汇总为同一批订单，不重复计入合计）'],
      ['渠道类型', '渠道 / 店铺', '产品线', '产品名称', '订单量', '销售额（元）', '客单价（元）', '退单量', '退单金额（元）', '未计价订单量'],
      ...breakdown.map((row) => [
        SALES_CHANNELS.find((item) => item.key === row.channel)?.label || row.channel, row.channelDetail,
        SALES_PRODUCT_LINES.find((item) => item.key === row.productLine)?.label || row.productLine, row.product,
        row.orderCount, (row.amountCents / 100).toFixed(2), averageLabel(row),
        row.refundCount, (row.refundCents / 100).toFixed(2), row.unpricedCount,
      ]),
    ] : []),
    ['口径', '排除待付款；退单仍计入销售额，退单指标单列；退单按下单日期归属；缺失金额不估算。'],
  ];
  return '\uFEFF' + data.map((row) => row.map((cell) => {
    const text = String(cell);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
};
