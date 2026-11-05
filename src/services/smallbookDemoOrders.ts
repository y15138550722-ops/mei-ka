import type { Order, OrderLog, OrderSourceChannel, Product } from '../shared/types/index.ts';
import type { KlookOrder } from '../modules/order-management/klookOrderService.ts';
import { formatBeijingTimestamp } from '../shared/utils/dateTime.ts';

const shiftDate = (date: string, offset: number) => {
  const value = new Date(`${date}T00:00:00+08:00`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
export const SMALLBOOK_DEMO_DATE = formatBeijingTimestamp().slice(0, 10);
const PRODUCT_NAME = '驾照翻译国际认证件（小白本）';
const PREVIOUS_DATE = shiftDate(SMALLBOOK_DEMO_DATE, -1);
const EARLIER_DATE = shiftDate(SMALLBOOK_DEMO_DATE, -2);

const buildTimeline = (index: number) => {
  const stage = index === 4 ? 3 : index === 5 ? 3 : index % 4;
  const createdDate = index === 4 ? PREVIOUS_DATE : index === 5 ? EARLIER_DATE : SMALLBOOK_DEMO_DATE;
  const completionDate = index === 5 ? PREVIOUS_DATE : SMALLBOOK_DEMO_DATE;
  const createdAt = `${createdDate} 08:10:00`;
  const logs: OrderLog[] = [{ time: createdAt, operator: '演示接单', action: '订单创建' }];
  const events = [
    { action: '已翻译', hour: '09', account: '员工1' },
    { action: '已制作', hour: '10', account: '员工2' },
    { action: '已发货', hour: '11', account: '员工3' },
  ];
  events.slice(0, stage).forEach(({ action, hour, account }) => logs.push({
    time: `${completionDate} ${hour}:20:00`, operator: account, operatorAccount: account, action,
  }));
  return { stage, createdAt, logs, updatedAt: logs[logs.length - 1].time };
};

export const buildSmallbookDemoOrders = (products: ReadonlyArray<Product>): Order[] => {
  const product = products.find((item) => item.category === 'translation' && item.title.includes('小白本'));
  if (!product) return [];
  const groups: Array<{ key: string; sources: OrderSourceChannel[]; names: string[] }> = [
    { key: 'SELF', sources: ['self_taobao', 'self_wechat', 'self_alipay', 'self_taobao', 'self_wechat', 'self_alipay'],
      names: ['自营淘系', '自营微信小程序', '自营支付宝小程序'] },
    { key: 'CTRIP', sources: Array(6).fill('ctrip_api'), names: ['携程'] },
    { key: 'CHANNEL', sources: ['avis_api', 'wechat_sixt', 'enterprise_api', 'wechat_ehi', 'wechat_europcar', 'wukong_channel', 'youxiangbang_channel', 'shenkong_channel'],
      names: ['Avis', 'Sixt', 'Enterprise', '一嗨', 'Europcar', '悟空', '游享邦', '深空'] },
    { key: 'RENTAL', sources: [
      ...Array(18).fill('avis_api'), ...Array(14).fill('wechat_sixt'), ...Array(10).fill('enterprise_api'),
      ...Array(7).fill('wechat_europcar'), ...Array(5).fill('wukong_channel'),
    ], names: ['AVIS', 'SIXT', 'Enterprise', 'Europcar', '悟空租车'] },
    { key: `TODAY-${SMALLBOOK_DEMO_DATE.replace(/-/g, '')}`, sources: [
      'self_taobao', 'self_wechat', 'self_alipay', 'self_taobao',
      'partner_shandong_yiwo', 'partner_changzhou_yulian', 'shenkong_channel', 'partner_hangzhou_yuecheng', 'partner_wuhan_honghuzhizhi',
      'avis_api', 'avis_api', 'avis_api', 'avis_api', 'wechat_sixt', 'wechat_sixt', 'wechat_sixt', 'enterprise_api', 'enterprise_api',
      'wechat_europcar', 'wechat_europcar', 'wukong_channel', 'ctrip_api', 'ctrip_api', 'ctrip_api',
      'hello_api', 'hello_api', 'hello_api', 'klook_api', 'klook_api', 'klook_api',
    ], names: ['当天演示来源'] },
  ];
  return groups.flatMap(({ key, sources, names }) => sources.map((sourceChannel, index): Order => {
    const isTodayBatch = key.startsWith('TODAY-');
    const { stage, createdAt, logs, updatedAt } = buildTimeline(isTodayBatch ? index % 4 : index);
    return {
      orderId: `DEMO-SB-${key}-${String(index + 1).padStart(3, '0')}`,
      customerName: `演示客户${key}${index + 1}`, customerPhone: '', customerPassport: '', customerEmail: '',
      productId: product.productId, productName: product.title, productCategory: 'translation',
      processType: product.processTypes[0]?.name || '正常办理-普通配送', processTypeId: product.processTypes[0]?.typeId,
      channel: key === 'CTRIP' ? 'ctrip' : key === 'SELF' ? 'private' : 'offline', sourceChannel,
      agentLevel: sourceChannel.startsWith('self_') ? 'self' : 'l1', lockedPrice: 289,
      status: stage === 3 ? 'shipped' : stage === 2 ? 'in_production' : stage === 1 ? 'pending_production' : 'pending_review',
      deliveryAddress: '演示地址', trackingNumber: stage === 3 ? `DEMO-${key}-${index + 1}` : '',
      logisticsCompany: stage === 3 ? '顺丰速运' : '', shippedAt: stage === 3 ? updatedAt : undefined,
      remark: `小白本统计演示订单；来源：${names[index % names.length]}`,
      createdAt, updatedAt, logs,
    };
  }));
};

export const buildSmallbookApiDemoOrders = (source: 'klook' | 'hello'): KlookOrder[] => Array.from({ length: 6 }, (_, index) => {
  const { stage, createdAt, updatedAt, logs } = buildTimeline(index);
  return {
    orderId: `DEMO-SB-${source.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
    productName: PRODUCT_NAME, processType: '正常办理-普通配送', agentName: source === 'klook' ? 'klook' : '哈啰',
    driverName: `演示客户${source}${index + 1}`, driverNameLatin: `DEMO ${source.toUpperCase()} ${index + 1}`,
    licenseNumber: '', licenseType: 'C1', recipientName: `演示客户${index + 1}`, recipientPhone: '', deliveryAddress: '演示地址',
    status: stage === 3 ? 'shipped' : stage > 0 ? 'pending_production' : 'pending_review',
    orderRecordLabel: stage > 0 ? logs[logs.length - 1].action : undefined,
    orderRecordAt: stage > 0 ? updatedAt : undefined,
    logisticsCompany: stage === 3 ? '顺丰速运' : '', trackingNumber: stage === 3 ? `DEMO-${source}-${index + 1}` : '',
    remark: '小白本统计演示订单', lockedPrice: 289, createdAt, updatedAt, logs,
  };
});

/** Add fixtures by stable IDs so saved edits and existing orders survive reloads. */
export const appendMissingSmallbookDemoOrders = <T extends { orderId: string }>(orders: T[], demos: T[]): T[] => {
  const existingIds = new Set(orders.map((order) => order.orderId));
  return [...orders, ...demos.filter((order) => !existingIds.has(order.orderId))];
};
