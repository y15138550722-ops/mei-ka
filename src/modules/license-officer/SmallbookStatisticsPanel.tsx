import React, { useEffect, useMemo, useState } from 'react';
import { getOrders, ORDER_DATA_CHANGED_EVENT } from '../../services/mockDataService';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import {
  API_ORDER_DATA_CHANGED_EVENT, getHelloOrders, getKlookOrders,
} from '../order-management/klookOrderService';
import {
  buildSmallbookRecords, buildSmallbookStatistics, SMALLBOOK_CHANNELS, SMALLBOOK_METRICS,
} from './smallbookStatistics';
import './SmallbookStatisticsPanel.css';

const todayDate = () => formatBeijingTimestamp().slice(0, 10);
const STORAGE_KEYS = new Set(['meika-orders', 'meika-klook-orders', 'meika-hello-orders']);
const readSnapshot = <T,>(key: string, fallback: () => T[]): T[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (Array.isArray(value)) return value;
  } catch {
    // The source service remains available if browser storage is inaccessible.
  }
  return fallback();
};

const SmallbookStatisticsPanel: React.FC = () => {
  const [version, setVersion] = useState(0);
  const [startInput, setStartInput] = useState(todayDate);
  const [endInput, setEndInput] = useState(todayDate);
  const [channelInput, setChannelInput] = useState('');
  const [query, setQuery] = useState(() => ({ startDate: todayDate(), endDate: todayDate(), channel: '' }));
  const [error, setError] = useState('');
  const [expandedSourceRow, setExpandedSourceRow] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || STORAGE_KEYS.has(event.key)) refresh();
    };
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

  const records = useMemo(() => buildSmallbookRecords(
    readSnapshot('meika-orders', getOrders),
    readSnapshot('meika-klook-orders', getKlookOrders),
    readSnapshot('meika-hello-orders', getHelloOrders),
  ), [version]);
  const { summaryRows, totals } = useMemo(() => buildSmallbookStatistics(records, query), [records, query]);
  const detailRow = summaryRows.find((row) => row.key === expandedSourceRow);
  const sourceRows = useMemo(() => detailRow ? buildSmallbookStatistics(records, {
    startDate: detailRow.date || query.startDate,
    endDate: detailRow.date || query.endDate,
    channel: detailRow.channel,
  }).sourceRows : [], [records, query, detailRow]);
  const noActivity = SMALLBOOK_METRICS.every(({ key }) => totals[key] === 0);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    if (startInput && endInput && startInput > endInput) {
      setError('结束日期不能早于开始日期。');
      return;
    }
    setError('');
    setQuery({ startDate: startInput, endDate: endInput, channel: channelInput });
    setExpandedSourceRow(null);
  };
  const reset = () => {
    const today = todayDate();
    setStartInput(today);
    setEndInput(today);
    setChannelInput('');
    setQuery({ startDate: today, endDate: today, channel: '' });
    setError('');
    setExpandedSourceRow(null);
  };

  return (
    <div className="smallbook-report">
      <form className="smallbook-report__filters" onSubmit={search} aria-label="小白本统计筛选">
        <div className="smallbook-report__field smallbook-report__field--dates">
          <span id="smallbook-date-label">统计日期</span>
          <div className="license-translation-linked-selects" role="group" aria-labelledby="smallbook-date-label">
            <DatePickerInput ariaLabel="小白本统计开始日期" placeholder="开始日期" value={startInput} onChange={setStartInput} />
            <DatePickerInput ariaLabel="小白本统计结束日期" placeholder="结束日期" value={endInput} onChange={setEndInput} />
          </div>
        </div>
        <label className="smallbook-report__field">
          <span>订单来源</span>
          <select aria-label="小白本订单来源" value={channelInput} onChange={(event) => setChannelInput(event.target.value)}>
            <option value="">全部来源</option>
            {SMALLBOOK_CHANNELS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div className="smallbook-report__filter-actions">
          <button type="submit" className="license-translation-button license-translation-button--primary">搜索</button>
          <button type="button" className="license-translation-button" onClick={reset}>重置</button>
        </div>
        {error && <p className="smallbook-report__error" role="alert">{error}</p>}
      </form>

      <div className="smallbook-report__metrics" aria-label="小白本统计合计">
        {SMALLBOOK_METRICS.map(({ key, label, hint }) => (
          <div key={key} className={`smallbook-report__metric smallbook-report__metric--${key}`}>
            <span>{label}</span>
            <strong>{totals[key].toLocaleString('zh-CN')}<small>单</small></strong>
            <p>{hint}</p>
          </div>
        ))}
      </div>

      <section className="smallbook-report__results" aria-labelledby="smallbook-report-heading">
        <div className="smallbook-report__heading">
          <div>
            <h2 id="smallbook-report-heading">小白本数据统计</h2>
            <p>{query.startDate || '不限开始日期'} 至 {query.endDate || '不限结束日期'} · 北京时间</p>
          </div>
        </div>
        {noActivity && <p className="smallbook-report__empty" role="status">当前筛选范围暂无小白本统计数据</p>}
        <div className="license-translation-table-wrap report-statistics-table-wrap smallbook-report__table-wrap">
          <table className="license-translation-table report-statistics-table smallbook-report__table smallbook-report__table--summary">
            <caption className="smallbook-report__caption">各来源小白本数量汇总</caption>
            <colgroup>
              <col className="smallbook-report__column--source" />
              {SMALLBOOK_METRICS.map(({ key }) => <col key={key} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">订单来源</th>
                {SMALLBOOK_METRICS.map(({ key, label }) => <th scope="col" key={key}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => {
                const canExpand = row.channel === 'self' || row.channel === 'channel' || row.channel === 'rental';
                const isExpanded = expandedSourceRow === row.key;
                const detailsId = `smallbook-source-details-${row.key}`;
                return (
                  <React.Fragment key={row.key}>
                    <tr>
                      <td>
                        <div className="smallbook-report__source-label">
                          <span>{row.label}</span>
                          {canExpand && <button type="button" className="smallbook-report__source-action"
                            aria-label={`${isExpanded ? '收起' : '查看详细来源'}${row.label}来源明细`}
                            aria-expanded={isExpanded} aria-controls={isExpanded ? detailsId : undefined}
                            onClick={() => setExpandedSourceRow(isExpanded ? null : row.key)}>
                            <span>{isExpanded ? '收起来源' : '查看详细来源'}</span>
                            <svg className="smallbook-report__source-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>}
                        </div>
                      </td>
                      {SMALLBOOK_METRICS.map(({ key }) => <td key={key}>{row[key].toLocaleString('zh-CN')}</td>)}
                    </tr>
                    {isExpanded && canExpand && (
                      <tr className="smallbook-report__source-details-row">
                        <td colSpan={5}>
                          <section className="smallbook-report__source-details" id={detailsId} aria-label={`${row.label}来源明细`}>
                            <div className="smallbook-report__detail-intro">
                              <h3>{row.label} · 来源明细</h3>
                              <p>{query.startDate || '不限开始日期'} 至 {query.endDate || '不限结束日期'} · 北京时间</p>
                            </div>
                            <div className="license-translation-table-wrap report-statistics-table-wrap smallbook-report__table-wrap">
                              <table className="license-translation-table report-statistics-table smallbook-report__table">
                                <caption className="smallbook-report__caption">{row.label}细分来源统计</caption>
                                <thead><tr>
                                  <th scope="col">细分来源</th>
                                  {SMALLBOOK_METRICS.map(({ key, label }) => <th scope="col" key={key}>{label}</th>)}
                                </tr></thead>
                                <tbody>{sourceRows.map((source) => <tr key={source.key}>
                                  <td>{source.label}</td>
                                  {SMALLBOOK_METRICS.map(({ key }) => <td key={key}>{source[key].toLocaleString('zh-CN')}</td>)}
                                </tr>)}</tbody>
                                <tfoot><tr>
                                  <th scope="row">小计</th>
                                  {SMALLBOOK_METRICS.map(({ key }) => <td key={key}>{row[key].toLocaleString('zh-CN')}</td>)}
                                </tr></tfoot>
                              </table>
                            </div>
                          </section>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">合计</th>
                {SMALLBOOK_METRICS.map(({ key }) => <td key={key}>{totals[key].toLocaleString('zh-CN')}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
        <details className="smallbook-report__rules">
          <summary>统计口径与来源归类</summary>
          <p>订单数量按创建日期统计；翻译、制作、发货分别按首次有效完成时间统计。同一订单在每个环节仅计一次，重复导出或重复操作不重复计数。各项独立按发生日期统计，因此当日完成数量可能大于当日订单数量。</p>
          <p>自营淘系、微信小程序、支付宝小程序合并统计；携程、klook、哈啰分别统计；悟空租车、SIXT、AVIS、Europcar、Enterprise 归入合作租车公司；渠道订单按合作方细分，无法识别具体合作方的来源计入「其他渠道商」。</p>
          <p>历史订单按现有来源识别：携程归入携程订单；自营账号的飞猪、私域订单归入自营订单；以上五家租车公司归入合作租车公司；已明确标记为深空的来源归入深空粒子科技，其余无法确认合作方的渠道来源归入「其他渠道商」。已关联的管理端与接口订单合并去重。缺少完成时间的环节不计数，取消订单保留已发生的订单及完成记录。</p>
          <p>来源汇总和合计均按当前筛选日期范围计算。</p>
        </details>
      </section>
    </div>
  );
};

export default SmallbookStatisticsPanel;
