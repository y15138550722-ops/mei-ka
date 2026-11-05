import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order, OrderSourceChannel } from '../src/shared/types/index.ts';
import type { KlookOrder } from '../src/modules/order-management/klookOrderService.ts';
import type { Product } from '../src/shared/types/index.ts';
import { appendMissingSmallbookDemoOrders, buildSmallbookApiDemoOrders, buildSmallbookDemoOrders, SMALLBOOK_DEMO_DATE } from '../src/services/smallbookDemoOrders.ts';
import { buildSmallbookRecords, buildSmallbookStatistics } from '../src/modules/license-officer/smallbookStatistics.ts';

const mainOrder = (orderId: string, extra: Partial<Order> = {}): Order => ({
  orderId, productName: '驾照翻译国际认证件（小白本）', productCategory: 'translation',
  channel: 'private', agentLevel: 'self', status: 'pending_review',
  createdAt: '2026-10-20 10:00:00', logs: [], ...extra,
} as Order);
const apiOrder = (orderId: string, extra: Partial<KlookOrder> = {}): KlookOrder => ({
  orderId, productName: '驾照翻译国际认证件（小白本）', status: 'pending_review',
  createdAt: '2026-10-20 10:00:00', logs: [], ...extra,
} as KlookOrder);
const log = (action: string, time: string) => ({ action, time, operator: '测试员工' });

test('按要求区分合作租车公司与渠道来源，显式来源优先', () => {
  const sources: OrderSourceChannel[] = [
    'self_taobao', 'self_wechat', 'self_alipay', 'ctrip_api', 'klook_api', 'hello_api',
    'avis_api', 'enterprise_api', 'agent_recharge', 'wechat_ehi', 'wechat_sixt', 'wechat_europcar', 'alipay_channel',
    'wukong_channel', 'youxiangbang_channel', 'shenkong_channel',
  ];
  const records = buildSmallbookRecords(sources.map((sourceChannel, index) => mainOrder(`${index}`, { sourceChannel })), [], []);
  assert.deepEqual(buildSmallbookStatistics(records).summaryRows.map((row) => [row.label, row.orderCount]), [
    ['自营订单（含自营小程序）', 3], ['渠道订单', 5], ['合作租车公司', 5], ['携程订单', 1], ['哈啰订单', 1], ['klook订单', 1],
  ]);
});

test('渠道来源展示指定的十个合作方，无法确认的存量来源计入其他', () => {
  const sources: OrderSourceChannel[] = [
    'partner_shandong_yiwo', 'partner_changzhou_yulian', 'shenkong_channel',
    'partner_hangzhou_yuecheng', 'partner_wuhan_honghuzhizhi', 'partner_yibantong_luoyang',
    'partner_wanteng_translation', 'partner_karlowen_flagship', 'partner_hangzhou_yundian',
    'agent_recharge', 'wechat_ehi', 'youxiangbang_channel', 'alipay_channel',
  ];
  const stats = buildSmallbookStatistics(buildSmallbookRecords(
    sources.map((sourceChannel, index) => mainOrder(`partner-${index}`, { sourceChannel })), [], [],
  ));
  const channelRows = stats.sourceRows.filter((row) => row.channel === 'channel');
  assert.deepEqual(channelRows.map((row) => row.label), [
    '山东译沃教育科技有限公司', '常州语联', '深空粒子科技', '杭州越珵科技有限公司',
    '武汉鸿鹄之志翻译服务有限公司', '易办通网络科技（洛阳）有限公司', '万腾翻译',
    'KARLOWEN旗舰店', '杭州云典', '其他渠道商',
  ]);
  assert.equal(channelRows.find((row) => row.label === '深空粒子科技')!.orderCount, 1);
  assert.equal(channelRows.find((row) => row.label === '其他渠道商')!.orderCount, 4);
});

test('历史来源按渠道与自营身份归类，不把代理订单归入自营', () => {
  const records = buildSmallbookRecords([
    mainOrder('self-fliggy', { channel: 'fliggy' }), mainOrder('self-private'),
    mainOrder('agent-private', { agentLevel: 'l1' }), mainOrder('offline', { channel: 'offline' }),
    mainOrder('ctrip', { channel: 'ctrip', agentLevel: 'l1' }),
  ], [], []);
  assert.deepEqual(buildSmallbookStatistics(records).summaryRows.map((row) => row.orderCount), [2, 2, 0, 1, 0, 0]);
});

test('各环节按各自北京时间计数，跨日重复操作只保留首次，闭区间包含边界', () => {
  const records = buildSmallbookRecords([mainOrder('dated', {
    logs: [
      log('已翻译', '2026-10-22 11:00:00'), log('已翻译', '2026-10-21T16:00:00Z'),
      log('已制作', '2026-10-23T00:00:00+08:00'), log('已制作', '2026-10-24 09:00:00'),
      log('已发货', '2026-10-24 08:00:00'),
    ], shippedAt: '2026-10-24 08:00:00',
  })], [], []);
  assert.deepEqual(buildSmallbookStatistics(records, { startDate: '2026-10-22', endDate: '2026-10-23' }).totals,
    { orderCount: 0, translationCount: 1, productionCount: 1, shipmentCount: 0 });
  assert.equal(buildSmallbookStatistics(records, { startDate: '2026-10-24', endDate: '2026-10-24' }).totals.productionCount, 0);
  assert.deepEqual(buildSmallbookStatistics(records).dailyRows.map((row) => row.date),
    ['2026-10-24', '2026-10-23', '2026-10-22', '2026-10-20']);
});

test('重复来源记录与关联管理订单去重；不同接口来源的同号订单各计一次', () => {
  const records = buildSmallbookRecords([mainOrder('MK1', {
    logs: [log('已翻译', '2026-10-21 09:00:00')],
  })], [
    apiOrder('K1', { managementOrderId: 'MK1', logs: [log('已制作', '2026-10-22 09:00:00')] }),
    apiOrder('K1', { managementOrderId: 'MK1', logs: [log('已制作', '2026-10-23 09:00:00')] }),
    apiOrder('same'), apiOrder('same'),
  ], [apiOrder('same')]);
  assert.equal(records.length, 3);
  const stats = buildSmallbookStatistics(records);
  assert.deepEqual(stats.totals, { orderCount: 3, translationCount: 1, productionCount: 1, shipmentCount: 0 });
  assert.equal(stats.summaryRows.find((row) => row.channel === 'klook')!.orderCount, 2);
  assert.equal(stats.summaryRows.find((row) => row.channel === 'hello')!.orderCount, 1);
});

test('排除其他产品；缺失或无效时间不推测完成阶段，历史接口只还原明确事件', () => {
  const records = buildSmallbookRecords([
    mainOrder('other', { productName: '宣誓翻译件' }),
    mainOrder('invalid', { createdAt: '2026-02-30', status: 'shipped', logs: [log('已翻译', '无效时间')] }),
  ], [apiOrder('legacy', { status: 'shipped', orderRecordLabel: '已发货', orderRecordAt: '2026-10-23 12:00:00' })], []);
  assert.equal(records.length, 2);
  assert.deepEqual(buildSmallbookStatistics(records).totals,
    { orderCount: 1, translationCount: 0, productionCount: 0, shipmentCount: 1 });
});

test('取消订单保留已发生记录；来源与日期筛选后，汇总、每日明细和合计一致', () => {
  const records = buildSmallbookRecords([mainOrder('cancelled', {
    status: 'cancelled', logs: [log('已翻译', '2026-10-21 11:00:00')],
  })], [], [apiOrder('hello')]);
  const stats = buildSmallbookStatistics(records, { channel: 'self', startDate: '2026-10-20', endDate: '2026-10-21' });
  assert.equal(stats.summaryRows.length, 1);
  assert.deepEqual(stats.totals, { orderCount: 1, translationCount: 1, productionCount: 0, shipmentCount: 0 });
  for (const key of Object.keys(stats.totals) as Array<keyof typeof stats.totals>) {
    assert.equal(stats.dailyRows.reduce((sum, row) => sum + row[key], 0), stats.totals[key]);
    assert.equal(stats.summaryRows.reduce((sum, row) => sum + row[key], 0), stats.totals[key]);
  }
  const empty = buildSmallbookStatistics(records, { startDate: '2026-11-01' });
  assert.equal(empty.summaryRows.length, 6);
  assert.equal(empty.dailyRows.length, 0);
  assert.equal(empty.totals.orderCount, 0);
});

test('116 条演示订单覆盖当天来源和跨日环节，重复加载保留原订单及已编辑数据', () => {
  const products = [{ productId: 'P-SB', title: '驾照翻译国际认证件（小白本）', category: 'translation', processTypes: [] }] as unknown as Product[];
  const demos = buildSmallbookDemoOrders(products);
  const klook = buildSmallbookApiDemoOrders('klook');
  const hello = buildSmallbookApiDemoOrders('hello');
  const records = buildSmallbookRecords(demos, klook, hello);
  assert.equal(records.length, 116);
  assert.deepEqual(buildSmallbookStatistics(records).summaryRows.map((row) => row.orderCount), [10, 8, 71, 9, 9, 9]);
  const previous = new Date(`${SMALLBOOK_DEMO_DATE}T00:00:00+08:00`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const earlier = new Date(`${SMALLBOOK_DEMO_DATE}T00:00:00+08:00`);
  earlier.setUTCDate(earlier.getUTCDate() - 2);
  assert.deepEqual([...new Set(buildSmallbookStatistics(records).dailyRows.map((row) => row.date))],
    [SMALLBOOK_DEMO_DATE, previous.toISOString().slice(0, 10), earlier.toISOString().slice(0, 10)]);
  const saved = [mainOrder('existing'), { ...demos[0], remark: '保留用户编辑' }];
  const seeded = appendMissingSmallbookDemoOrders(saved, demos);
  assert.equal(seeded.length, 105);
  assert.equal(seeded.find((order) => order.orderId === demos[0].orderId)!.remark, '保留用户编辑');
  assert.equal(appendMissingSmallbookDemoOrders(seeded, demos).length, seeded.length);
});

test('自营、渠道与合作租车公司明细按同一日期筛选，四项小计与汇总一致', () => {
  const products = [{ productId: 'P-SB', title: '驾照翻译国际认证件（小白本）', category: 'translation', processTypes: [] }] as unknown as Product[];
  const demos = buildSmallbookDemoOrders(products);
  const records = buildSmallbookRecords(demos, buildSmallbookApiDemoOrders('klook'), buildSmallbookApiDemoOrders('hello'));
  const stats = buildSmallbookStatistics(records, { startDate: SMALLBOOK_DEMO_DATE, endDate: SMALLBOOK_DEMO_DATE });
  for (const channel of ['self', 'channel', 'rental']) {
    const groupRows = stats.sourceRows.filter((row) => row.channel === channel);
    const summary = stats.summaryRows.find((row) => row.channel === channel)!;
    for (const key of Object.keys(stats.totals) as Array<keyof typeof stats.totals>) {
      assert.equal(groupRows.reduce((sum, row) => sum + row[key], 0), summary[key]);
    }
  }
  assert.deepEqual(stats.sourceRows.filter((row) => row.channel === 'self').map((row) => [row.label, row.orderCount]),
    [['自营淘系', 4], ['自营微信小程序', 2], ['自营支付宝小程序', 2]]);
  assert.equal(stats.sourceRows.find((row) => row.label === '悟空租车')!.orderCount, 6);
  assert.equal(stats.sourceRows.find((row) => row.label === '悟空租车')!.shipmentCount, 1);
  assert.equal(stats.sourceRows.find((row) => row.label === 'Europcar')!.shipmentCount, 4);
  assert.ok(buildSmallbookStatistics(records, { channel: 'self' }).sourceRows.every((row) => row.channel === 'self'));
  assert.equal(buildSmallbookStatistics(records, { channel: 'hello' }).sourceRows.length, 0);
  assert.deepEqual(stats.dailyRows.filter((row) => row.date === SMALLBOOK_DEMO_DATE).map((row) => row.channel),
    ['self', 'channel', 'rental', 'ctrip', 'hello', 'klook']);
});

test('未细分历史来源保留独立明细，接口关联后的订单不残留在自营明细', () => {
  const records = buildSmallbookRecords([
    mainOrder('old-private'), mainOrder('old-fliggy', { channel: 'fliggy' }),
    mainOrder('old-agent', { agentLevel: 'l1' }), mainOrder('linked'),
    mainOrder('unknown', { sourceChannel: 'future_partner' as OrderSourceChannel }),
  ], [apiOrder('api-linked', { managementOrderId: 'linked' })], []);
  const stats = buildSmallbookStatistics(records);
  assert.equal(stats.sourceRows.find((row) => row.label === '自营私域（未细分）')!.orderCount, 1);
  assert.equal(stats.sourceRows.find((row) => row.label === '自营飞猪（历史来源）')!.orderCount, 1);
  assert.equal(stats.sourceRows.find((row) => row.label === '其他渠道商')!.orderCount, 2);
  assert.equal(stats.summaryRows.find((row) => row.channel === 'klook')!.orderCount, 1);
});
