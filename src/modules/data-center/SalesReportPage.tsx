import React, { useEffect, useMemo, useState } from 'react';
import { getOrders, ORDER_DATA_CHANGED_EVENT } from '../../services/mockDataService';
import { API_ORDER_DATA_CHANGED_EVENT, getHelloOrders, getKlookOrders } from '../order-management/klookOrderService';
import { useTranslation } from '../../shared/i18n/config';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import {
  averageSalesAmount, buildSalesBreakdown, buildSalesChannelGroups, buildSalesRecords, buildSalesReport, changeRate, comparisonFilters,
  defaultSalesFilters, REPORT_DIMENSIONS, SALES_CHANNELS, SALES_PRODUCT_LINES, salesReportCsv, TIME_GRAINS,
  type SalesFilters, type SalesMetrics, type SalesRow, type TimeGrain,
} from './salesReport';
import './SalesReportPage.css';

const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = (value: number) => value.toLocaleString('zh-CN');
const COLORS = ['#6366f1', '#14b8a6', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6'];
const STORAGE_KEYS = new Set(['meika-orders', 'meika-klook-orders', 'meika-hello-orders']);
const readSnapshot = <T,>(key: string, fallback: () => T[]): T[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (Array.isArray(value)) return value;
  } catch { /* Fall back to the existing service if storage is unavailable. */ }
  return fallback();
};

const Comparison: React.FC<{ value: number | null; baseline: number | null; label: string; reverse?: boolean }> = ({ value, baseline, label, reverse }) => {
  const rate = changeRate(value, baseline);
  const tone = rate === null || rate === 0 ? '' : (rate > 0) !== Boolean(reverse) ? 'positive' : 'negative';
  return <span className={`sales-comparison sales-comparison--${tone}`} title={rate === null ? '对比期为零或金额不完整，无法计算增长率' : undefined}>
    <span>{label}</span><strong>{rate === null ? '—' : `${rate > 0 ? '↑ ' : rate < 0 ? '↓ ' : ''}${Math.abs(rate).toFixed(1)}%`}</strong>
  </span>;
};

type ComparisonMode = 'none' | 'previous' | 'year' | 'custom';
const COMPARISON_LABELS = { none: '不对比', previous: '环比', year: '同比', custom: '自定义' };
const ANALYSIS_DIMENSIONS = [
  { key: 'channel', label: '按渠道' }, { key: 'product', label: '按产品' },
] as const;

const TrendChart: React.FC<{ rows: SalesRow[]; metric: 'amount' | 'orders'; comparisonRows: SalesRow[]; comparisonLabel: string }> = ({ rows, metric, comparisonRows, comparisonLabel }) => {
  const [active, setActive] = useState<number | null>(null);
  const values = rows.map((row) => metric === 'amount' ? row.amountCents / 100 : row.orderCount);
  const comparisonValues = comparisonRows.map((row) => metric === 'amount' ? row.amountCents / 100 : row.orderCount);
  const length = Math.max(rows.length, comparisonRows.length);
  const max = Math.max(1, ...values, ...comparisonValues);
  const x = (index: number) => length === 1 ? 490 : 65 + index / Math.max(1, length - 1) * 855;
  const y = (value: number) => 215 - value / max * 170;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const comparisonPoints = comparisonValues.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(length / 7));
  const selected = active !== null ? rows[active] : undefined;
  const selectedComparison = active !== null ? comparisonRows[active] : undefined;
  const valueLabel = (row: SalesRow) => metric === 'amount' ? `¥ ${money(row.amountCents / 100)}${row.unpricedCount ? '（已知金额）' : ''}` : `${count(row.orderCount)} 单`;
  return <div className="sales-trend" onMouseLeave={() => setActive(null)}>
    <svg viewBox="0 0 960 260" role="img" aria-label={`${metric === 'amount' ? '销售额' : '订单量'}趋势图，本期 ${rows.length} 个统计周期${comparisonRows.length ? `，${comparisonLabel} ${comparisonRows.length} 个统计周期` : ''}`}>
      <defs><linearGradient id="sales-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".18" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((tick) => {
        const value = max * tick / 4;
        return <g key={tick}><line x1="65" y1={y(value)} x2="920" y2={y(value)} stroke="#edf0f5" strokeDasharray="4 4" /><text x="53" y={y(value) + 4} textAnchor="end" className="sales-chart-label">{value >= 10000 ? `${(value / 10000).toFixed(1)}万` : metric === 'orders' ? Math.round(value) : Math.round(value).toLocaleString('zh-CN')}</text></g>;
      })}
      {rows.length > 0 && <><polygon points={`${x(0)},215 ${points} ${x(rows.length - 1)},215`} fill="url(#sales-trend-fill)" /><polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" /></>}
      {comparisonRows.length > 0 && <polyline points={comparisonPoints} fill="none" stroke="#14b8a6" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />}
      {Array.from({ length }, (_, index) => {
        const row = rows[index];
        const comparison = comparisonRows[index];
        const label = row?.label || `对比 ${comparison.label}`;
        return <g key={index}>
          {(index % labelStep === 0 || index === length - 1) && <text x={x(index)} y="245" textAnchor="middle" className="sales-chart-label">{label.replace(' 当周', '').replace(/^20\d{2}-/, '')}</text>}
          {row && <circle cx={x(index)} cy={y(values[index])} r={active === index ? 5 : length < 35 ? 3 : 0} fill="#6366f1" stroke="white" strokeWidth="2" />}
          {comparison && <circle cx={x(index)} cy={y(comparisonValues[index])} r={active === index ? 4 : length < 35 ? 2 : 0} fill="#14b8a6" stroke="white" strokeWidth="2" />}
          <rect x={x(index) - Math.max(5, 855 / length / 2)} y="30" width={Math.max(10, 855 / length)} height="192" fill="transparent" tabIndex={0} role="button" aria-label={`${row ? `${row.label}：${valueLabel(row)}` : '本期无对应周期'}${comparison ? `；${comparisonLabel} ${comparison.label}：${valueLabel(comparison)}` : ''}`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} />
        </g>;
      })}
      {active !== null && <line x1={x(active)} y1="35" x2={x(active)} y2="215" stroke="#a5b4fc" strokeDasharray="4 4" pointerEvents="none" />}
    </svg>
    <div className="sales-trend__detail" aria-live="polite">{selected || selectedComparison
      ? <>{selected && <span>本期 {selected.label} <strong>{valueLabel(selected)}</strong></span>}{selectedComparison && <span>{comparisonLabel} {selectedComparison.label} <strong className="sales-trend__comparison-value">{valueLabel(selectedComparison)}</strong></span>}</>
      : <span>悬停或聚焦图表查看各周期数据</span>}</div>
  </div>;
};

const Distribution: React.FC<{ title: string; rows: SalesRow[] }> = ({ title, rows }) => {
  const sorted = [...rows].sort((a, b) => b.amountCents - a.amountCents);
  const total = sorted.reduce((sum, row) => sum + row.amountCents, 0);
  return <section className="sales-distribution" aria-label={title}>
    <div className="sales-distribution__heading"><h3>{title}</h3><span>销售额占比 · 前5项</span></div>
    {total > 0 ? <ol className="sales-distribution__ranking">{sorted.slice(0, 5).map((row, index) => {
      const percent = row.amountCents / total * 100;
      return <li key={row.key}>
        <div className="sales-distribution__label"><span>{row.label}</span><span>{percent.toFixed(1)}%<small>¥ {money(row.amountCents / 100)}</small></span></div>
        <div className="sales-distribution__track" aria-hidden="true"><span style={{ width: `${percent}%`, background: COLORS[index % COLORS.length] }} /></div>
      </li>;
    })}</ol> : <div className="sales-chart-empty">暂无销售数据</div>}
  </section>;
};

const SalesMetricCells: React.FC<{ metrics: SalesMetrics }> = ({ metrics }) => <>
  <td>{count(metrics.orderCount)}</td>
  <td className="sales-table-amount">{money(metrics.amountCents / 100)}{metrics.unpricedCount > 0 && <small title={`${metrics.unpricedCount} 单未计价`}> *</small>}</td>
  <td>{averageSalesAmount(metrics) === null ? '—' : money(averageSalesAmount(metrics)!)}</td>
</>;

const SalesReportPage: React.FC = () => {
  const { t } = useTranslation();
  const [query] = useState<SalesFilters>(defaultSalesFilters);
  const [grain, setGrain] = useState<TimeGrain>('day');
  const [dimension, setDimension] = useState<'channel' | 'product'>('channel');
  const [trendMetric, setTrendMetric] = useState<'amount' | 'orders'>('amount');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('previous');
  const [customPeriod, setCustomPeriod] = useState(() => comparisonFilters(defaultSalesFilters(), 'previous'));
  const [customDraft, setCustomDraft] = useState(customPeriod);
  const [comparisonError, setComparisonError] = useState('');
  const [expandedChannelGroup, setExpandedChannelGroup] = useState<string | null>(null);
  const [expandedProductChannel, setExpandedProductChannel] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [exported, setExported] = useState(false);
  const [page, setPage] = useState(1);
  const [updatedAt, setUpdatedAt] = useState(formatBeijingTimestamp);

  useEffect(() => {
    const refresh = () => { setVersion((value) => value + 1); setUpdatedAt(formatBeijingTimestamp()); };
    const onStorage = (event: StorageEvent) => { if (event.key === null || STORAGE_KEYS.has(event.key)) refresh(); };
    window.addEventListener(ORDER_DATA_CHANGED_EVENT, refresh);
    window.addEventListener(API_ORDER_DATA_CHANGED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(ORDER_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener(API_ORDER_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const records = useMemo(() => buildSalesRecords(readSnapshot('meika-orders', getOrders), readSnapshot('meika-klook-orders', getKlookOrders), readSnapshot('meika-hello-orders', getHelloOrders)), [version]);
  const previousQuery = useMemo(() => comparisonFilters(query, 'previous'), [query]);
  const yearQuery = useMemo(() => comparisonFilters(query, 'year'), [query]);
  const selectedComparisonQuery = useMemo(() => comparisonMode === 'custom'
    ? { ...query, startDate: customPeriod.startDate, endDate: customPeriod.endDate }
    : comparisonMode === 'year' ? yearQuery : previousQuery, [comparisonMode, query, customPeriod, yearQuery, previousQuery]);
  const comparisonTrend = useMemo(() => comparisonMode === 'none' ? undefined : buildSalesReport(records, selectedComparisonQuery, 'time', grain), [records, selectedComparisonQuery, grain, comparisonMode]);
  const trend = useMemo(() => buildSalesReport(records, query, 'time', grain), [records, query, grain]);
  const channelDetails = useMemo(() => buildSalesReport(records, query, 'channel', grain), [records, query, grain]);
  const channelGroups = useMemo(() => buildSalesChannelGroups(records, query), [records, query]);
  const productReport = useMemo(() => buildSalesReport(records, query, 'product', grain), [records, query, grain]);
  const breakdown = useMemo(() => buildSalesBreakdown(records, query), [records, query]);
  const previous = useMemo(() => buildSalesReport(records, previousQuery, 'channel', grain).totals, [records, previousQuery, grain]);
  const year = useMemo(() => buildSalesReport(records, yearQuery, 'channel', grain).totals, [records, yearQuery, grain]);
  const tableReport = dimension === 'channel' ? channelGroups : productReport;
  const totals = trend.totals;
  const pageCount = Math.max(1, Math.ceil(tableReport.rows.length / 10));
  const tableRows = tableReport.rows;
  const visibleRows = tableRows.slice((page - 1) * 10, page * 10);
  const expandedGroup = dimension === 'channel' ? channelGroups.rows.find((row) => row.key === expandedChannelGroup) : undefined;
  const expandedGroupChannels = useMemo(() => expandedGroup ? buildSalesReport(records, {
    ...query, channel: expandedGroup.channel || '',
  }, 'channel', grain).rows : [], [records, query, grain, expandedGroup]);
  const selectedProductChannel = dimension === 'channel' ? channelDetails.rows.find((row) => row.key === expandedProductChannel) : undefined;
  const channelProducts = useMemo(() => selectedProductChannel ? buildSalesReport(records, {
    ...query, channel: selectedProductChannel.channel || '', channelDetail: selectedProductChannel.channelDetail || '',
  }, 'product', grain).rows : [], [records, query, grain, selectedProductChannel]);
  useEffect(() => { setPage(1); setExported(false); setExpandedChannelGroup(null); setExpandedProductChannel(null); }, [query, dimension, version]);
  useEffect(() => { setExported(false); }, [grain, comparisonMode, customPeriod]);

  const exportReport = () => {
    const csv = salesReportCsv(tableRows, totals, query, `${REPORT_DIMENSIONS.find((item) => item.key === dimension)!.label} · ${TIME_GRAINS.find((item) => item.key === grain)!.label}粒度`, breakdown, {
      trend: trend.rows, channels: channelDetails.rows, products: productReport.rows,
      comparison: comparisonTrend ? { label: COMPARISON_LABELS[comparisonMode], filters: selectedComparisonQuery, report: comparisonTrend } : undefined,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `销售报表_${query.startDate}_${query.endDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };
  const metrics: Array<{ label: string; value: (metrics: SalesMetrics) => number | null; money?: boolean; refund?: boolean; hint: string }> = [
    { label: '销售额', value: (m) => m.unpricedCount ? null : m.amountCents / 100, money: true, hint: '有效订单金额合计' },
    { label: '订单量', value: (m) => m.orderCount, hint: '排除待付款订单' },
    { label: '客单价', value: averageSalesAmount, money: true, hint: '销售额 ÷ 订单量' },
    { label: '退单量', value: (m) => m.refundCount, refund: true, hint: '退单 / 取消订单数' },
    { label: '退单金额', value: (m) => m.unpricedRefundCount ? null : m.refundCents / 100, money: true, refund: true, hint: '退单订单金额合计' },
  ];
  const noData = totals.orderCount === 0;
  const invalidDateCount = records.filter((record) => !record.unpaid && !record.date).length;

  return <div className="app-main sales-report-page">
    <div className="app-topbar"><nav className="app-topbar__breadcrumb" aria-label="面包屑">后台管理<span>/</span>{t('menu.dataCenter')}<span>/</span><strong>{t('menu.salesReport')}</strong></nav></div>
    <main className="sales-report-shell">
      <header className="sales-page-heading">
        <div><h1>{t('menu.salesReport')}</h1><p>销售概览、渠道贡献与产品表现</p></div>
        <button type="button" className="btn btn--primary sales-export-button" onClick={exportReport}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" /></svg>导出报表</button>
      </header>

      <section className="sales-overview" aria-labelledby="sales-overview-title">
        <div className="sales-overview__heading"><h2 id="sales-overview-title">销售概览</h2><span>近30天 <strong>{query.startDate} — {query.endDate}</strong></span></div>
        <div className="sales-metrics">{metrics.filter((metric) => !metric.refund).map((metric, index) => {
          const value = metric.value(totals);
          const display = value === null && metric.label === '销售额' ? money(totals.amountCents / 100) : value === null ? '—' : metric.money ? money(value) : count(value);
          return <section key={metric.label} className={`card sales-metric ${index === 0 ? 'sales-metric--primary' : ''}`} aria-label={metric.label}>
            <div className="sales-metric__label">{metric.label}<span>{metric.hint}</span></div>
            <div className="sales-metric__value">{(metric.money && value !== null || metric.label === '销售额') && <small>¥</small>}{display}{!metric.money && <small>单</small>}</div>
            {value === null && metric.label === '销售额' && <p className="sales-metric__notice">已知金额 · {totals.unpricedCount} 单待补金额</p>}
            <div className="sales-metric__comparisons"><Comparison label="环比" value={value} baseline={metric.value(previous)} /><Comparison label="同比" value={value} baseline={metric.value(year)} />{comparisonMode === 'custom' && comparisonTrend && <Comparison label="自定义" value={value} baseline={metric.value(comparisonTrend.totals)} />}</div>
          </section>;
        })}</div>
        <div className="sales-refunds">{metrics.filter((metric) => metric.refund).map((metric) => {
          const value = metric.value(totals);
          return <section className="sales-refunds__metric" key={metric.label} aria-label={metric.label}><span>{metric.label}</span><strong>{value === null ? '—' : metric.money ? `¥ ${money(value)}` : `${count(value)} 单`}</strong><div><Comparison label="环比" value={value} baseline={metric.value(previous)} reverse /><Comparison label="同比" value={value} baseline={metric.value(year)} reverse />{comparisonMode === 'custom' && comparisonTrend && <Comparison label="自定义" value={value} baseline={metric.value(comparisonTrend.totals)} reverse />}</div></section>;
        })}</div>
      </section>
      {noData && <div className="sales-notice" role="status">当前统计周期暂无有效订单。</div>}
      {totals.unpricedCount > 0 && <div className="sales-notice" role="status">当前结果有 {totals.unpricedCount} 单缺少有效金额，金额仅显示已知合计，客单价及金额增长率暂停计算。</div>}

      <section className="card sales-analysis" aria-labelledby="sales-analysis-title">
        <div className="sales-analysis__heading">
          <div><h2 id="sales-analysis-title">销售分析</h2><p>对比{dimension === 'channel' ? '自营、合作渠道、租车公司与代理商，展开查看具体渠道和产品' : '各产品的销量、金额与客单价'}</p></div>
          <div className="sales-segment" role="group" aria-label="分析维度">{ANALYSIS_DIMENSIONS.map((item) => <button type="button" key={item.key} aria-pressed={dimension === item.key} className={dimension === item.key ? 'active' : ''} onClick={() => setDimension(item.key)}>{item.label}</button>)}</div>
        </div>
        <div className="sales-analysis__body">
        <section className="sales-summary" aria-label={dimension === 'channel' ? '渠道销售汇总' : '产品销售汇总'}>
          <div className="sales-table-wrap"><table>
            <caption className="sales-sr-only">销售汇总表，{query.startDate}至{query.endDate}</caption>
            <thead><tr><th scope="col">{dimension === 'channel' ? '渠道分类' : '产品'}</th><th scope="col">订单量（单）</th><th scope="col">销售额（元）</th><th scope="col">客单价（元）</th>{dimension === 'channel' && <th scope="col">渠道明细</th>}</tr></thead>
            <tbody>{visibleRows.length ? visibleRows.map((row, index) => <React.Fragment key={row.key}>
              <tr className={expandedChannelGroup === row.key ? 'sales-summary-row--expanded' : ''}>
                <th scope="row"><span className="sales-summary__name">{row.label}</span>{dimension === 'product' && <small className="sales-summary__category">{SALES_PRODUCT_LINES.find((item) => item.key === row.productLine)?.label}</small>}</th>
                <SalesMetricCells metrics={row} />
                {dimension === 'channel' && <td><button type="button" className="sales-detail-toggle" aria-label={`${expandedChannelGroup === row.key ? '收起' : '查看'}${row.label}的渠道明细`} aria-expanded={expandedChannelGroup === row.key} aria-controls={`sales-channel-details-${index}`} onClick={() => { setExpandedChannelGroup((value) => value === row.key ? null : row.key); setExpandedProductChannel(null); }}>{expandedChannelGroup === row.key ? '收起' : '查看渠道'}<span aria-hidden="true">{expandedChannelGroup === row.key ? '−' : '+'}</span></button></td>}
              </tr>
              {dimension === 'channel' && expandedChannelGroup === row.key && <tr className="sales-product-detail-row"><td colSpan={5}>
                <section className="sales-product-details" id={`sales-channel-details-${index}`} aria-label={`${row.label}渠道销售明细`}>
                  <div className="sales-product-details__heading"><h4>{row.label} · 渠道明细</h4><span>{count(row.orderCount)} 单</span></div>
                  <table><caption className="sales-sr-only">{row.label}渠道明细</caption><thead><tr><th scope="col">具体渠道</th><th scope="col">订单量（单）</th><th scope="col">销售额（元）</th><th scope="col">客单价（元）</th><th scope="col">产品明细</th></tr></thead>
                    <tbody>{expandedGroupChannels.length ? expandedGroupChannels.map((channel) => <React.Fragment key={channel.key}><tr><th scope="row">{channel.label}</th><SalesMetricCells metrics={channel} /><td><button type="button" className="sales-detail-toggle" aria-expanded={expandedProductChannel === channel.key} onClick={() => setExpandedProductChannel((value) => value === channel.key ? null : channel.key)}>{expandedProductChannel === channel.key ? '收起' : '查看产品'}<span aria-hidden="true">{expandedProductChannel === channel.key ? '−' : '+'}</span></button></td></tr>{expandedProductChannel === channel.key && <tr><td colSpan={5}><table><caption className="sales-sr-only">{channel.label}产品明细</caption><thead><tr><th scope="col">产品</th><th scope="col">销量（单）</th><th scope="col">销售额（元）</th><th scope="col">客单价（元）</th></tr></thead><tbody>{channelProducts.length ? channelProducts.map((product) => <tr key={product.key}><th scope="row">{product.label}</th><SalesMetricCells metrics={product} /></tr>) : <tr><td colSpan={4} className="sales-table-empty">暂无产品销售</td></tr>}</tbody><tfoot><tr><th scope="row">合计</th><SalesMetricCells metrics={channel} /></tr></tfoot></table></td></tr>}</React.Fragment>) : <tr><td colSpan={5} className="sales-table-empty">暂无渠道销售</td></tr>}</tbody>
                    <tfoot><tr><th scope="row">合计</th><SalesMetricCells metrics={row} /><td /></tr></tfoot>
                  </table>
                </section>
              </td></tr>}
            </React.Fragment>) : <tr><td colSpan={dimension === 'channel' ? 5 : 4} className="sales-table-empty">暂无销售数据</td></tr>}</tbody>
            <tfoot><tr><th scope="row">合计</th><SalesMetricCells metrics={totals} />{dimension === 'channel' && <td />}</tr></tfoot>
          </table></div>
          {pageCount > 1 && <div className="sales-table-footer"><span>共 {tableReport.rows.length} 项</span><div><button type="button" disabled={page <= 1} onClick={() => { setPage((value) => value - 1); setExpandedChannelGroup(null); setExpandedProductChannel(null); }} aria-label="上一页">‹</button><span>{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => { setPage((value) => value + 1); setExpandedChannelGroup(null); setExpandedProductChannel(null); }} aria-label="下一页">›</button></div></div>}
        </section>
        <aside className="sales-analysis__distribution"><Distribution key={dimension} title={dimension === 'channel' ? '渠道销售分布' : '产品销售分布'} rows={tableReport.rows} /><p className="sales-distribution-note">占比以全部销售额为基数，展示前5项</p></aside>
        </div>
      </section>
      <section className="card sales-trend-card" aria-label="销售趋势">
        <div className="sales-section-heading"><div><h2>销售趋势</h2><p>查看本期销售随时间的变化</p></div><div className="sales-trend-actions"><div className="sales-segment" role="group" aria-label="趋势指标"><button type="button" aria-pressed={trendMetric === 'amount'} className={trendMetric === 'amount' ? 'active' : ''} onClick={() => setTrendMetric('amount')}>销售额</button><button type="button" aria-pressed={trendMetric === 'orders'} className={trendMetric === 'orders' ? 'active' : ''} onClick={() => setTrendMetric('orders')}>订单量</button></div><select aria-label="趋势对比周期" value={comparisonMode} onChange={(event) => { setComparisonMode(event.target.value as ComparisonMode); setComparisonError(''); }}>{(['none', 'previous', 'year', 'custom'] as const).map((mode) => <option key={mode} value={mode}>{COMPARISON_LABELS[mode]}</option>)}</select></div></div>
        <div className="sales-trend-controls">
          <div className="sales-grain" role="group" aria-label="时间粒度">{TIME_GRAINS.map((item) => <button key={item.key} type="button" aria-pressed={grain === item.key} className={grain === item.key ? 'active' : ''} onClick={() => setGrain(item.key)}>{item.label}</button>)}</div><span className="sales-trend-unit">{trendMetric === 'amount' ? '单位：元' : '单位：单'}</span>
          {comparisonMode === 'custom' && <form className="sales-custom-comparison" aria-label="自定义对比区间" onSubmit={(event) => {
            event.preventDefault();
            if (!customDraft.startDate || !customDraft.endDate || customDraft.startDate > customDraft.endDate) { setComparisonError('请选择有效的对比日期区间，结束日期不能早于开始日期。'); return; }
            setCustomPeriod(customDraft); setComparisonError('');
          }}>
            <DatePickerInput ariaLabel="对比开始日期" placeholder="开始日期" value={customDraft.startDate} onChange={(startDate) => setCustomDraft((current) => ({ ...current, startDate }))} /><span>至</span><DatePickerInput ariaLabel="对比结束日期" placeholder="结束日期" value={customDraft.endDate} onChange={(endDate) => setCustomDraft((current) => ({ ...current, endDate }))} /><button className="btn btn--secondary" type="submit">应用对比</button>
          </form>}
        </div>
        {comparisonError && <p className="sales-error sales-comparison-error" role="alert">{comparisonError}</p>}
        <div className="sales-trend-legend"><span><i />本期 {query.startDate} — {query.endDate}</span>{comparisonTrend && <><span><i className="sales-trend-legend__comparison" />{COMPARISON_LABELS[comparisonMode]} {selectedComparisonQuery.startDate} — {selectedComparisonQuery.endDate}</span><small>按第 N 个统计周期对齐，悬停查看对应日期</small></>}</div>
        <TrendChart key={`${query.startDate}:${query.endDate}:${grain}:${comparisonMode}:${customPeriod.startDate}:${customPeriod.endDate}`} rows={trend.rows} metric={trendMetric} comparisonRows={comparisonTrend?.rows || []} comparisonLabel={COMPARISON_LABELS[comparisonMode]} />
      </section>
      <details className="sales-rules"><summary>指标口径与数据说明</summary><div><p>环比：{previousQuery.startDate} 至 {previousQuery.endDate}；同比：{yearQuery.startDate} 至 {yearQuery.endDate}。“—”表示对比期为零、没有订单或金额不完整。</p><p>订单量排除待付款（status=1）。销售额为有效订单 totalprice 合计，退单仍计入销售额；退单量及退单金额单独展示，不作净额抵扣。客单价 = 销售额 ÷ 订单量，无订单时显示“—”。</p><p>退单依据 refund_time 非空或取消状态（status=-1）。本页以北京时间下单日期归属订单与退单；环比为上一等长区间，同比为去年同日期区间，闰年日期按月末对齐。趋势可切换环比、同比或自定义区间对比，对比期沿用当前渠道及产品条件。</p><p>当前使用本地演示订单：金额缺少 totalprice 时读取历史锁价，cancelled 映射取消；拒绝审核不自动视为退单。未记录的店铺、代理商、退款时间不推测。代理商按完整名称分组。明确关联的 API 与管理端订单只计一次。产品名称统一常见别名，电子版与原件分开统计。</p><p>当前读取主订单、Klook 与哈啰订单，尚未连接 BRD 中的线上销售 API；本页只读展示。渠道汇总分为自营、合作渠道、租车公司、代理商；无法识别的存量来源保留在对应业务类别的未细分项或自营来源待完善项。展开分类可查看具体渠道，再展开查看产品。导出包含当前统计范围的全量汇总、趋势、渠道/产品分布、所选对比及渠道 × 产品明细，格式为 CSV，不受分页及明细展开状态限制。销售分析提供按渠道/按产品两个视图，对应分布图同步切换。</p>{invalidDateCount > 0 && <p>{invalidDateCount} 条有效订单缺少可用下单日期，未纳入日期统计。</p>}</div></details>
      <div className="sales-data-status"><span><i />本地演示数据</span><span>更新于 {updatedAt.slice(5, 16)}</span></div>
      <p className="sales-export-status" role="status">{exported ? '已导出当前筛选的汇总、趋势、分布、对比及渠道 × 产品明细（全部记录，CSV）' : ''}</p>
    </main>
  </div>;
};

export default SalesReportPage;
