import type { Order, OrderSourceChannel } from '../../shared/types/index.ts';
import type { KlookOrder } from '../order-management/klookOrderService.ts';
import { getProductionTimestamp, isProductionDateInRange } from './productionActivity.ts';

export type SmallbookChannel = 'self' | 'channel' | 'rental' | 'ctrip' | 'hello' | 'klook';
export const SMALLBOOK_CHANNELS: ReadonlyArray<{ key: SmallbookChannel; label: string }> = [
  { key: 'self', label: '自营订单（含自营小程序）' },
  { key: 'channel', label: '渠道订单' },
  { key: 'rental', label: '合作租车公司' },
  { key: 'ctrip', label: '携程订单' },
  { key: 'hello', label: '哈啰订单' },
  { key: 'klook', label: 'klook订单' },
];

type SmallbookSourceKey = OrderSourceChannel | 'legacy_self_fliggy' | 'legacy_self_private' | 'other_channel';
export type SmallbookDetailChannel = 'self' | 'channel' | 'rental';
const SOURCE_DETAILS: ReadonlyArray<{ key: SmallbookSourceKey; channel: SmallbookDetailChannel; label: string; legacy?: boolean }> = [
  { key: 'self_taobao', channel: 'self', label: '自营淘系' },
  { key: 'self_wechat', channel: 'self', label: '自营微信小程序' },
  { key: 'self_alipay', channel: 'self', label: '自营支付宝小程序' },
  { key: 'legacy_self_fliggy', channel: 'self', label: '自营飞猪（历史来源）', legacy: true },
  { key: 'legacy_self_private', channel: 'self', label: '自营私域（未细分）', legacy: true },
  { key: 'avis_api', channel: 'rental', label: 'AVIS' },
  { key: 'wechat_sixt', channel: 'rental', label: 'SIXT' },
  { key: 'enterprise_api', channel: 'rental', label: 'Enterprise' },
  { key: 'wechat_europcar', channel: 'rental', label: 'Europcar' },
  { key: 'wukong_channel', channel: 'rental', label: '悟空租车' },
  { key: 'partner_shandong_yiwo', channel: 'channel', label: '山东译沃教育科技有限公司' },
  { key: 'partner_changzhou_yulian', channel: 'channel', label: '常州语联' },
  { key: 'shenkong_channel', channel: 'channel', label: '深空粒子科技' },
  { key: 'partner_hangzhou_yuecheng', channel: 'channel', label: '杭州越珵科技有限公司' },
  { key: 'partner_wuhan_honghuzhizhi', channel: 'channel', label: '武汉鸿鹄之志翻译服务有限公司' },
  { key: 'partner_yibantong_luoyang', channel: 'channel', label: '易办通网络科技（洛阳）有限公司' },
  { key: 'partner_wanteng_translation', channel: 'channel', label: '万腾翻译' },
  { key: 'partner_karlowen_flagship', channel: 'channel', label: 'KARLOWEN旗舰店' },
  { key: 'partner_hangzhou_yundian', channel: 'channel', label: '杭州云典' },
  { key: 'other_channel', channel: 'channel', label: '其他渠道商' },
];

export const SMALLBOOK_METRICS = [
  { key: 'orderCount', label: '订单数量', hint: '按订单创建日期' },
  { key: 'translationCount', label: '翻译数量', hint: '按首次翻译完成日期' },
  { key: 'productionCount', label: '制作数量', hint: '按首次制作完成日期' },
  { key: 'shipmentCount', label: '发货数量', hint: '按首次发货日期' },
] as const;
type MetricKey = typeof SMALLBOOK_METRICS[number]['key'];
export type SmallbookCounts = Record<MetricKey, number>;
export interface SmallbookRecord {
  key: string;
  channel: SmallbookChannel;
  source: SmallbookSourceKey;
  timestamps: Partial<Record<MetricKey, string>>;
}
export interface SmallbookRow extends SmallbookCounts {
  key: string;
  channel: SmallbookChannel;
  label: string;
  date?: string;
}
export interface SmallbookSourceRow extends SmallbookCounts {
  key: SmallbookSourceKey;
  channel: SmallbookDetailChannel;
  label: string;
}
const emptyCounts = (): SmallbookCounts => ({ orderCount: 0, translationCount: 0, productionCount: 0, shipmentCount: 0 });
const isSmallbook = (productName: string) => productName.includes('小白本');
const RENTAL_SOURCE_KEYS: ReadonlyArray<OrderSourceChannel> = ['avis_api', 'wechat_sixt', 'enterprise_api', 'wechat_europcar', 'wukong_channel'];
const getMainChannel = (order: Order): SmallbookChannel => {
  if (order.sourceChannel) {
    if (['self_taobao', 'self_wechat', 'self_alipay'].includes(order.sourceChannel)) return 'self';
    if (RENTAL_SOURCE_KEYS.includes(order.sourceChannel)) return 'rental';
    if (order.sourceChannel === 'ctrip_api') return 'ctrip';
    if (order.sourceChannel === 'klook_api') return 'klook';
    if (order.sourceChannel === 'hello_api') return 'hello';
    return 'channel';
  }
  if (order.channel === 'ctrip') return 'ctrip';
  if (order.agentLevel === 'self' && ['fliggy', 'private'].includes(order.channel)) return 'self';
  return 'channel';
};

const getMainSource = (order: Order, channel: SmallbookChannel): SmallbookSourceKey => {
  if (order.sourceChannel && (channel !== 'channel' || SOURCE_DETAILS.some(({ key }) => key === order.sourceChannel))) {
    return order.sourceChannel;
  }
  if (channel === 'self') return order.channel === 'fliggy' ? 'legacy_self_fliggy' : 'legacy_self_private';
  return channel === 'ctrip' ? 'ctrip_api' : 'other_channel';
};

const earliestTimestamp = (values: Array<string | undefined>) =>
  values.map((value) => getProductionTimestamp(value || '')).filter(Boolean).sort()[0] || '';

const getTimestamps = (order: Pick<Order, 'createdAt' | 'logs'> & {
  shippedAt?: string; orderRecordLabel?: string; orderRecordAt?: string;
}): SmallbookRecord['timestamps'] => {
  const completion = (action: string, fallback?: string) => {
    const logs = (Array.isArray(order.logs) ? order.logs : []).filter((log) => log.action.trim() === action).map((log) => log.time);
    // A legacy API record describes only its named event, never earlier stages.
    return earliestTimestamp([...logs, fallback, order.orderRecordLabel === action ? order.orderRecordAt : undefined]);
  };
  return {
    orderCount: getProductionTimestamp(order.createdAt),
    translationCount: completion('已翻译'),
    productionCount: completion('已制作'),
    shipmentCount: completion('已发货', order.shippedAt),
  };
};

export const buildSmallbookRecords = (
  orders: ReadonlyArray<Order>, klookOrders: ReadonlyArray<KlookOrder>, helloOrders: ReadonlyArray<KlookOrder>,
): SmallbookRecord[] => {
  const records = new Map<string, SmallbookRecord>();
  const mainIds = new Set(orders.filter((order) => isSmallbook(order.productName)).map((order) => order.orderId));
  const addRecord = (key: string, channel: SmallbookChannel, source: SmallbookSourceKey, timestamps: SmallbookRecord['timestamps']) => {
    const previous = records.get(key);
    const merged = { ...timestamps };
    for (const { key: metric } of SMALLBOOK_METRICS) {
      merged[metric] = earliestTimestamp([previous?.timestamps[metric], timestamps[metric]]);
    }
    records.set(key, { key, channel, source, timestamps: merged });
  };
  for (const order of orders) {
    if (!isSmallbook(order.productName)) continue;
    const channel = getMainChannel(order);
    addRecord(`main:${order.orderId}`, channel, getMainSource(order, channel), getTimestamps(order));
  }
  for (const [source, sourceOrders] of [['klook', klookOrders], ['hello', helloOrders]] as const) {
    for (const order of sourceOrders) {
      if (!isSmallbook(order.productName)) continue;
      // Linked management copies share a business order; unrelated equal IDs in
      // different API sources do not. The API source determines acquisition.
      const key = order.managementOrderId && mainIds.has(order.managementOrderId)
        ? `main:${order.managementOrderId}` : `${source}:${order.orderId}`;
      addRecord(key, source, source === 'klook' ? 'klook_api' : 'hello_api', getTimestamps(order));
    }
  }
  return Array.from(records.values());
};

export const buildSmallbookStatistics = (
  records: ReadonlyArray<SmallbookRecord>,
  { startDate = '', endDate = '', channel = '' }: { startDate?: string; endDate?: string; channel?: string } = {},
) => {
  const channels = SMALLBOOK_CHANNELS.filter((item) => !channel || item.key === channel);
  const summary = new Map<SmallbookChannel, SmallbookRow>(channels.map((item) => [item.key, {
    key: item.key, channel: item.key, label: item.label, ...emptyCounts(),
  }]));
  const daily = new Map<string, SmallbookRow>();
  const presentSources = new Set(records.map((record) => record.source));
  const sourceRows = new Map<SmallbookSourceKey, SmallbookSourceRow>(SOURCE_DETAILS
    .filter((item) => (!channel || channel === item.channel) && (!item.legacy || presentSources.has(item.key)))
    .map((item) => [item.key, { key: item.key, channel: item.channel, label: item.label, ...emptyCounts() }]));
  const totals = emptyCounts();
  for (const record of records) {
    const summaryRow = summary.get(record.channel);
    if (!summaryRow) continue;
    for (const { key: metric } of SMALLBOOK_METRICS) {
      const date = record.timestamps[metric]?.slice(0, 10) || '';
      if (!isProductionDateInRange(date, startDate, endDate)) continue;
      const key = `${date}:${record.channel}`;
      const row = daily.get(key) || { ...summaryRow, ...emptyCounts(), key, date };
      row[metric] += 1;
      summaryRow[metric] += 1;
      totals[metric] += 1;
      const sourceRow = sourceRows.get(record.source);
      if (sourceRow) sourceRow[metric] += 1;
      daily.set(key, row);
    }
  }
  const channelOrder = new Map(channels.map((item, index) => [item.key, index]));
  return {
    summaryRows: Array.from(summary.values()),
    sourceRows: Array.from(sourceRows.values()),
    dailyRows: Array.from(daily.values()).sort((a, b) =>
      b.date!.localeCompare(a.date!) || channelOrder.get(a.channel)! - channelOrder.get(b.channel)!),
    totals,
  };
};
