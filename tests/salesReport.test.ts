import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '../src/shared/types/index.ts';
import type { KlookOrder } from '../src/modules/order-management/klookOrderService.ts';
import {
  averageSalesAmount, buildSalesBreakdown, buildSalesChannelGroups, buildSalesRecords, buildSalesReport, changeRate, comparisonFilters,
  defaultSalesFilters, normalizeSalesOrder, SALES_PRODUCTS, salesReportCsv, timeBucket, type SalesSourceOrder,
} from '../src/modules/data-center/salesReport.ts';

const source = (extra: Partial<SalesSourceOrder> = {}): SalesSourceOrder => ({
  orderId: 'one', createdAt: '2026-11-03 10:00:00', status: 3, totalprice: '0.10',
  title: '小白本', sourcefrom: 'ctrip', ...extra,
});
const filters = { ...defaultSalesFilters('2026-11-03'), startDate: '2026-11-01' };

test('BRD: 排除待付款，取消和退单保留在销售额，驳回不等于退单', () => {
  const records = [
    source({ status: 1, totalprice: '500' }), source({ orderId: 'paid', totalprice: '100.10' }),
    source({ orderId: 'refund', totalprice: '50.20', refund_time: '2026-11-04 10:00:00' }),
    source({ orderId: 'cancelled', status: -1, title: '公证单号', totalprice: '20.30' }),
    source({ orderId: 'rejected', status: 'rejected', totalprice: '10.40' }),
  ].map((order) => normalizeSalesOrder(order));
  const { totals } = buildSalesReport(records, filters, 'channel', 'day');
  assert.deepEqual(totals, { orderCount: 4, amountCents: 18100, refundCount: 2, refundCents: 7050, unpricedCount: 0, unpricedRefundCount: 0 });
  assert.equal(averageSalesAmount(totals), 45.25);
});

test('金额按分累计，零元有效，缺少或无效金额不可当零或计算客单价', () => {
  const values = ['0.10', '0.20', '0', '', 'abc', '-2', null, undefined];
  const records = values.map((totalprice, index) => normalizeSalesOrder(source({ orderId: String(index), totalprice })));
  const { totals } = buildSalesReport(records, filters, 'time', 'day');
  assert.equal(totals.amountCents, 30);
  assert.equal(totals.unpricedCount, 5);
  assert.equal(averageSalesAmount(totals), null);
  assert.equal(changeRate(null, 100), null);
  assert.equal(changeRate(100, 0), null);
  assert.equal(changeRate(120, 100), 20);
});

test('渠道按BRD归因，代理商同前六字仍独立统计，产品名优先products[0]', () => {
  const records = [
    source({ nick_name: '全球驾照翻译认证中心', sourcefrom: '', title: 'fallback', products: [{ name: 'NAATI澳大利亚' }] }),
    source({ sourcefrom: 'SIXT', title: 'IDP加急' }),
    source({ sourcefrom: '', agent_nick_name: '同名代理商公司甲', title: '公证双号' }),
    source({ sourcefrom: '', agent_nick_name: '同名代理商公司乙', title: '公证双号' }),
  ].map((order, index) => normalizeSalesOrder(order, String(index)));
  assert.deepEqual(records.map((record) => [record.channel, record.productLine]), [['taobao', 'translation'], ['rental', 'idp'], ['agent', 'notary'], ['agent', 'notary']]);
  assert.equal(records[0].product, 'NAATI澳大利亚');
  assert.equal(buildSalesReport(records, { ...filters, channel: 'agent' }, 'channel', 'day').rows.length, 2);
  assert.equal(buildSalesReport(records, { ...filters, channel: 'rental', productLine: 'idp', product: 'IDP加急' }, 'product', 'day').totals.orderCount, 1);
});

test('API与管理订单显式关联去重，跨接口同号不合并，管理端金额不被覆盖', () => {
  const main = [{ orderId: 'MK1', createdAt: '2026-11-03 10:00:00', productName: '小白本', productCategory: 'translation', channel: 'private', agentLevel: 'self', status: 'cancelled', lockedPrice: 100.01 }] as Order[];
  const api = (orderId: string, extra: Partial<KlookOrder> = {}) => ({ orderId, createdAt: '2026-11-03 11:00:00', productName: '小白本', status: 'shipped', lockedPrice: 289, ...extra } as KlookOrder);
  const records = buildSalesRecords(main, [api('K1', { managementOrderId: 'MK1' }), api('same'), api('same')], [api('same')]);
  assert.equal(records.length, 3);
  const { totals } = buildSalesReport(records, filters, 'channel', 'day');
  assert.equal(totals.amountCents, 67801);
  assert.equal(totals.refundCount, 1);
  assert.equal(records[0].channelDetail, 'Klook');
});

test('北京时间转换、边界日期、周一分桶和季度分桶正确', () => {
  const records = [source({ createdAt: '2026-11-02T16:00:00Z' }), source({ createdAt: '2026-11-03T16:00:00Z' }), source({ createdAt: '2026-02-30' })].map((order) => normalizeSalesOrder(order));
  const report = buildSalesReport(records, { ...filters, startDate: '2026-11-03', endDate: '2026-11-03' }, 'time', 'day');
  assert.equal(report.totals.orderCount, 1);
  assert.equal(timeBucket('2026-11-01', 'week'), '2026-10-26');
  assert.equal(timeBucket('2026-11-02', 'week'), '2026-11-02');
  assert.equal(timeBucket('2026-11-03', 'quarter'), '2026 Q4');
  assert.equal(timeBucket('2026-11-03', 'month'), '2026-11');
  assert.equal(timeBucket('2026-11-03', 'year'), '2026');
});

test('环比为上个等长区间，同比闰年日期向月末对齐', () => {
  const previous = comparisonFilters(filters, 'previous');
  assert.equal(previous.startDate, '2026-10-29');
  assert.equal(previous.endDate, '2026-10-31');
  const leap = comparisonFilters({ ...filters, startDate: '2024-02-29', endDate: '2024-03-01' }, 'year');
  assert.equal(leap.startDate, '2023-02-28');
  assert.equal(leap.endDate, '2023-03-01');
});

test('时间/渠道/产品合计一致，空日期补零，导出全量且转义公式内容', () => {
  const records = [source({ title: '=1+1' }), source({ totalprice: '0.20', sourcefrom: 'klook', createdAt: '2026-11-01 00:00:00' })].map((order) => normalizeSalesOrder(order));
  for (const dimension of ['time', 'channel', 'product'] as const) {
    const report = buildSalesReport(records, filters, dimension, 'day');
    assert.equal(report.rows.reduce((sum, row) => sum + row.amountCents, 0), report.totals.amountCents);
    assert.equal(report.rows.reduce((sum, row) => sum + row.orderCount, 0), 2);
    if (dimension === 'time') assert.equal(report.rows.find((row) => row.key === '2026-11-02')!.orderCount, 0);
    const csv = salesReportCsv(report.rows, report.totals, filters, dimension);
    assert.match(csv, /合计/);
    assert.match(csv, /0.30/);
    if (dimension === 'product') assert.match(csv, /"'=1\+1"/);
  }
});

test('四类渠道按指定店铺和合作方归类，历史未细分来源不假设为某家店', () => {
  const examples: Array<[Partial<SalesSourceOrder>, string, string]> = [
    [{ nick_name: '全球驾照翻译认证中心' }, 'taobao', '全球驾照翻译认证中心'],
    [{ nick_name: '全球国际驾照' }, 'taobao', '全球国际驾照'],
    [{ nick_name: 'mculture旗舰店' }, 'taobao', 'mculture旗舰店'],
    [{ nick_name: 'IDD企业店' }, 'taobao', 'IDD企业店'],
    [{ nick_name: '中国公证海牙认证中心' }, 'taobao', '中国公证海牙认证中心'],
    [{ sourcefrom: 'klook' }, 'partner', 'Klook'],
    [{ sourcefrom: 'ctrip' }, 'partner', '携程'],
    [{ sourcefrom: 'hello' }, 'partner', '哈啰'],
    [{ sourceChannel: 'avis_api' }, 'rental', 'avis'],
    [{ sourceChannel: 'wechat_sixt' }, 'rental', 'sixt'],
    [{ sourceChannel: 'wukong_channel' }, 'rental', '悟空租车'],
    [{ sourceChannel: 'enterprise_api' }, 'rental', 'enterprise'],
    [{ sourceChannel: 'wechat_europcar' }, 'rental', 'europcar'],
    [{ agent_nick_name: '上海翻译认证代理有限公司' }, 'agent', '上海翻译认证代理有限公司'],
    [{ sourceChannel: 'wechat_ehi' }, 'rental', '一嗨租车'],
    [{ sourceChannel: 'self_taobao' }, 'taobao', '淘宝店铺（未细分）'],
    [{ sourceChannel: 'self_wechat' }, 'taobao', '自营微信小程序'],
  ];
  for (const [extra, channel, detail] of examples) {
    const record = normalizeSalesOrder(source({ sourcefrom: '', ...extra }));
    assert.equal(record.channel, channel);
    assert.equal(record.channelDetail, detail);
  }
  const emptyShops = buildSalesReport([], { ...filters, channel: 'taobao' }, 'channel', 'day');
  assert.equal(emptyShops.rows.length, 5);
  assert.equal(emptyShops.totals.orderCount, 0);
});

test('渠道分类、具体渠道、产品明细与趋势汇总在组合筛选下逐级对齐', () => {
  const records = [
    source({ orderId: 'A', sourcefrom: 'ctrip', title: '小白本', totalprice: '100' }),
    source({ orderId: 'B', sourcefrom: 'ctrip', title: '小白本', totalprice: '200', refund_time: '2026-11-04' }),
    source({ orderId: 'C', sourcefrom: 'ctrip', title: '公证单号', totalprice: '500' }),
    source({ orderId: 'D', sourcefrom: 'klook', title: '小白本', totalprice: '300' }),
    source({ orderId: 'E', sourcefrom: 'avis', title: '小白本', totalprice: '400' }),
    source({ orderId: 'F', sourcefrom: 'ctrip', title: '小白本', totalprice: '900', status: 1 }),
    source({ orderId: 'G', sourcefrom: 'ctrip', title: '小白本', totalprice: '800', createdAt: '2026-10-01 00:00:00' }),
  ].map((order) => normalizeSalesOrder(order));
  const groups = buildSalesChannelGroups(records, filters);
  assert.deepEqual(groups.rows.map((row) => row.label), ['自营', '合作渠道', '租车公司', '代理商']);
  const partners = groups.rows.find((row) => row.channel === 'partner')!;
  assert.equal(partners.orderCount, 4);
  assert.equal(partners.amountCents, 110000);
  const partnerFilters = { ...filters, channel: partners.channel! };
  const channels = buildSalesReport(records, partnerFilters, 'channel', 'day');
  assert.equal(channels.rows.reduce((sum, row) => sum + row.amountCents, 0), partners.amountCents);
  const ctrip = channels.rows.find((row) => row.channelDetail === '携程')!;
  const ctripFilters = { ...partnerFilters, channelDetail: ctrip.channelDetail! };
  const products = buildSalesReport(records, ctripFilters, 'product', 'day');
  assert.equal(products.rows.reduce((sum, row) => sum + row.amountCents, 0), ctrip.amountCents);
  const smallbook = products.rows.find((row) => row.product === '小白本')!;
  assert.equal(smallbook.orderCount, 2);
  assert.equal(averageSalesAmount(smallbook), 150);
  const productFilters = { ...ctripFilters, productLine: smallbook.productLine!, product: smallbook.product! };
  const trend = buildSalesReport(records, productFilters, 'time', 'day');
  assert.deepEqual(trend.totals, smallbookMetrics(smallbook));
  const breakdown = buildSalesBreakdown(records, productFilters);
  assert.equal(breakdown.length, 1);
  assert.equal(breakdown[0].channelDetail, '携程');
  assert.equal(breakdown[0].amountCents, trend.totals.amountCents);
  assert.equal(breakdown[0].refundCents, 20000);
  const csv = salesReportCsv(products.rows, products.totals, ctripFilters, '按产品', buildSalesBreakdown(records, ctripFilters));
  assert.match(csv, /渠道 × 产品明细/);
  assert.match(csv, /"合作渠道","携程","翻译认证","小白本",\"2\",\"300.00\",\"150.00\"/);
  assert.match(csv, /公证单号/);
  assert.doesNotMatch(csv, /"rental"|"avis"/);
});

test('完整产品分类覆盖ATIO、波兰语、意大利语及原件/电子版，同产品别名合并且版本不混合', () => {
  const examples = [
    ['驾照翻译国际认证件（小白本）', '小白本', 'translation'],
    ['NAATI 澳大利亚认证（电子版）', 'NAATI澳大利亚（电子版）', 'translation'],
    ['NZTA 新西兰认证(原件)', 'NZTA新西兰（原件）', 'translation'],
    ['西班牙语言宣誓翻译(电子版)', '西班牙语宣誓翻译（电子版）', 'translation'],
    ['意大利语宣誓翻译(原件)', '意大利语宣誓翻译（原件）', 'translation'],
    ['ATIO', 'ATIO', 'translation'], ['波兰语宣誓翻译', '波兰语宣誓', 'translation'],
    ['公证海牙双号', '海牙双号', 'notary'], ['公证单号', '公证单号', 'notary'],
    ['IDP（加急）', 'IDP加急', 'idp'], ['IDD国际驾照（加急）', 'IDD加急', 'idp'],
  ];
  for (const [title, product, productLine] of examples) {
    const record = normalizeSalesOrder(source({ title }));
    assert.equal(record.product, product);
    assert.equal(record.productLine, productLine);
    assert.ok(SALES_PRODUCTS.some((item) => item.name === product && item.productLine === productLine));
  }
  const records = ['IDP（加急）', 'IDP加急', 'IDP', '德语宣誓翻译(原件)', '德语宣誓翻译（电子版）']
    .map((title, index) => normalizeSalesOrder(source({ orderId: String(index), title, totalprice: '100' })));
  const report = buildSalesReport(records, filters, 'product', 'day');
  assert.equal(report.rows.length, 4);
  assert.equal(report.rows.find((row) => row.product === 'IDP加急')!.orderCount, 2);
  assert.equal(report.totals.amountCents, 50000);
  const empty = buildSalesReport(records, { ...filters, productLine: 'translation', product: 'ATIO' }, 'product', 'day');
  assert.equal(empty.rows[0].product, 'ATIO');
  assert.equal(empty.totals.orderCount, 0);
  assert.equal(averageSalesAmount(empty.totals), null);
  assert.match(salesReportCsv(empty.rows, empty.totals, { ...filters, product: 'ATIO' }, '按产品'), /"ATIO","0","0.00","0","0.00","—"/);
  assert.equal(normalizeSalesOrder(source({ title: '尚未配置的新产品' })).product, '尚未配置的新产品');
});

test('五种时间粒度及对比导出共用渠道/产品范围，缺失对比金额不生成增长率', () => {
  const records = [
    source({ orderId: 'current', title: 'ATIO', totalprice: '200' }),
    source({ orderId: 'previous', title: 'ATIO', totalprice: '100', createdAt: '2026-10-30 12:00:00' }),
    source({ orderId: 'excluded', title: 'ATIO', sourcefrom: 'avis', totalprice: '999' }),
    source({ orderId: 'otherProduct', title: 'IDP', totalprice: '999' }),
  ].map((order) => normalizeSalesOrder(order));
  const scoped = { ...filters, channel: 'partner' as const, channelDetail: '携程', productLine: 'translation' as const, product: 'ATIO' };
  const baseline = comparisonFilters(scoped, 'previous');
  for (const grain of ['day', 'week', 'month', 'quarter', 'year'] as const) {
    const current = buildSalesReport(records, scoped, 'time', grain);
    const comparison = buildSalesReport(records, baseline, 'time', grain);
    assert.equal(current.rows.reduce((sum, row) => sum + row.amountCents, 0), 20000);
    assert.equal(comparison.rows.reduce((sum, row) => sum + row.amountCents, 0), 10000);
    const channels = buildSalesReport(records, scoped, 'channel', grain);
    const products = buildSalesReport(records, scoped, 'product', grain);
    const csv = salesReportCsv(products.rows, products.totals, scoped, '按产品', buildSalesBreakdown(records, scoped), {
      trend: current.rows, channels: channels.rows, products: products.rows,
      comparison: { label: '环比', filters: baseline, report: comparison },
    });
    assert.match(csv, /销售趋势/);
    assert.match(csv, /渠道销售分布/);
    assert.match(csv, /产品销售分布/);
    assert.match(csv, /对比期趋势/);
    assert.match(csv, /"销售额（元）","200.00","100.00","100.0%"/);
    assert.doesNotMatch(csv, /999.00/);
  }
  const current = buildSalesReport(records, scoped, 'product', 'day');
  const missing = buildSalesReport([normalizeSalesOrder(source({ title: 'ATIO', totalprice: null, createdAt: '2026-10-30' }))], baseline, 'time', 'day');
  const csv = salesReportCsv(current.rows, current.totals, scoped, '按产品', [], {
    trend: [], channels: [], products: [], comparison: { label: '自定义', filters: baseline, report: missing },
  });
  assert.match(csv, /"销售额（元）","200.00","待补金额","—"/);
});

function smallbookMetrics(row: ReturnType<typeof buildSalesReport>['rows'][number]) {
  const { orderCount, amountCents, refundCount, refundCents, unpricedCount, unpricedRefundCount } = row;
  return { orderCount, amountCents, refundCount, refundCents, unpricedCount, unpricedRefundCount };
}
