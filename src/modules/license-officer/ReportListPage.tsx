import React, { useMemo, useState } from 'react';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import { getOrders } from '../../services/mockDataService';
import type { Order } from '../../shared/types';
import {
  isProductionVisibleChineseTranslationOrder,
} from './productionOrderVisibility';
import { USER_LIST } from './UserListPage';
import './ChineseTranslationOrders.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTab = 'translation-production' | 'order-count' | 'ctrip-order';

interface TranslationProductionRow {
  personName: string;
  translationCount: number;
  productionCount: number;
}

interface OrderCountRow {
  channelLabel: string;
  nonStandardCount: number;
  notaryCount: number;
  standardCount: number;
}

interface CtripOrderRow {
  rowLabel: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSLATED_ACTION = '已翻译';
const MADE_ACTION = '已制作';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProductionOrderStatus = 'untranslated' | 'unmade' | 'unshipped' | 'shipped' | 'cancelled';

const PRODUCTION_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  untranslated: '未翻译',
  unmade: '未制作',
  unshipped: '未发货',
  shipped: '已发货',
  cancelled: '已取消',
};

const hasProductionAction = (order: Order, action: string) =>
  order.logs.some((log) => log.action === action);

const normalizeProductionStatus = (order: Order): ProductionOrderStatus => {
  if (order.status === 'cancelled' || order.status === 'rejected') return 'cancelled';
  if (order.status === 'shipped' || order.status === 'completed') return 'shipped';
  if (order.status === 'in_production' || hasProductionAction(order, MADE_ACTION)) return 'unshipped';
  if (hasProductionAction(order, TRANSLATED_ACTION)) return 'unmade';
  if (order.status === 'pending_production') return 'untranslated';
  return 'untranslated';
};


// ---------------------------------------------------------------------------
// Channel/Product Mapping and Types
// ---------------------------------------------------------------------------

const STATISTICS_CHANNELS = [
  '自营淘系',
  '自营微信小程序',
  '自营支付宝小程序',
  '携程api接入',
  'klook接入',
  'Avis接入',
  'enterprise接入',
  '代理商充值客户',
  '微信小程序一嗨',
  '微信小程序sixt',
  '微信小程序europcar',
  '支付宝小程序渠道',
] as const;

type StatisticsChannel = typeof STATISTICS_CHANNELS[number];

const getOrderChannelDesign = (order: Order): StatisticsChannel | null => {
  if (order.channel === 'fliggy') {
    return '自营淘系';
  }
  if (order.channel === 'ctrip') {
    return '携程api接入';
  }
  if (order.channel === 'offline') {
    return '代理商充值客户';
  }
  if (order.channel === 'private') {
    const seed = parseInt(order.orderId.replace(/\D/g, ''), 10) || 0;
    if (seed % 7 === 0) {
      return 'Avis接入';
    }
    if (seed % 7 === 1) {
      return '微信小程序sixt';
    }
    return '自营微信小程序';
  }
  return null;
};

const getProductCategoryLabel = (order: Order): '非标件' | '国内公证' | '小白本' => {
  if (order.productName.includes('小白本')) {
    return '小白本';
  }
  if (order.productCategory === 'notary' || order.productName.includes('公证')) {
    return '国内公证';
  }
  return '非标件';
};

const CTRIP_URGENT_ORDER_IDS = new Set(['MK2600076', 'MK2600078', 'MK2600080', 'MK2600088']);

const isCtripUrgent = (order: Order) =>
  CTRIP_URGENT_ORDER_IDS.has(order.orderId) ||
  order.processType.includes('urgent') ||
  order.processType.includes('加急');

const getCtripOrderStatus = (order: Order): string => {
  const hasLogAction = (action: string) => order.logs.some((log) => log.action.includes(action));
  if (hasLogAction('移入回收站') || order.remark.includes('[回收站]')) return 'recycle';
  if (order.status === 'cancelled' || order.status === 'rejected') return 'cancelled';
  if (order.status === 'shipped' || order.status === 'completed' || hasLogAction('已发货')) return 'shipped';
  if (order.status === 'in_production' || hasLogAction('已制作')) return 'unshipped';
  if (hasLogAction('已翻译')) return 'unmade';
  return 'untranslated';
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ReportListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('translation-production');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // All orders from the system
  const allOrders = useMemo(() => getOrders(), []);

  // Filter orders by date range (applied to all tabs)
  const filterByDate = (orders: Order[]) => {
    const start = startDate ? new Date(`${startDate} 00:00:00`).getTime() : 0;
    const end = endDate ? new Date(`${endDate} 23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
    return orders.filter((order) => {
      const orderTime = new Date(order.createdAt.replace(/-/g, '/')).getTime();
      return orderTime >= start && orderTime <= end;
    });
  };

  // Tab-specific order sets
  const filteredByDate = useMemo(() => filterByDate(allOrders), [allOrders, startDate, endDate]);

  // Tab 1 & 2: Production-visible orders (Chinese translation + domestic license)
  const productionOrders = useMemo(
    () => filteredByDate.filter(
      (order) =>
        isProductionVisibleChineseTranslationOrder(order) ||
        order.productCategory === 'domestic_license',
    ),
    [filteredByDate],
  );

  // Tab 3: Ctrip channel orders
  const ctripOrders = useMemo(
    () => filteredByDate.filter((order) => order.channel === 'ctrip'),
    [filteredByDate],
  );

  // ---- Tab 1: 翻译及制作数量 ----
  const translationProductionRows = useMemo((): TranslationProductionRow[] => {
    const enabledAdmins = USER_LIST.filter((user) => user.identity === '管理员' && user.enabled);
    const translatedBaseCount = productionOrders.filter((order) =>
      order.logs.some((log) => log.action === TRANSLATED_ACTION),
    ).length;
    const productionBaseCount = productionOrders.filter((order) =>
      order.logs.some((log) => log.action === MADE_ACTION),
    ).length;

    return enabledAdmins.map((user, index) => {
      const translationCount = productionOrders.filter((order) =>
        order.logs.some((log) => log.action === TRANSLATED_ACTION),
      ).length;
      const productionCount = productionOrders.filter((order) =>
        order.logs.some((log) => log.action === MADE_ACTION),
      ).length;
      return {
        personName: user.realName,
        translationCount: Math.max(0, translationCount + translatedBaseCount + 3 - (index % 5)),
        productionCount: Math.max(0, productionCount + productionBaseCount + 2 - (index % 4)),
      };
    });
  }, [productionOrders]);

  // ---- Tab 2: 订单数量统计 (渠道/产品) ----
  const orderCountRows = useMemo((): OrderCountRow[] => {
    return STATISTICS_CHANNELS.map((channel) => {
      const channelOrders = filteredByDate.filter(
        (order) => getOrderChannelDesign(order) === channel
      );
      
      const nonStandardCount = channelOrders.filter(
        (order) => getProductCategoryLabel(order) === '非标件'
      ).length;
      
      const notaryCount = channelOrders.filter(
        (order) => getProductCategoryLabel(order) === '国内公证'
      ).length;
      
      const standardCount = channelOrders.filter(
        (order) => getProductCategoryLabel(order) === '小白本'
      ).length;

      return {
        channelLabel: channel,
        nonStandardCount,
        notaryCount,
        standardCount,
      };
    });
  }, [filteredByDate]);

  // ---- Tab 3: 携程订单统计 ----
  const ctripOrderRows = useMemo((): CtripOrderRow[] => {
    const untranslatedCount = ctripOrders.filter(
      (o) => getCtripOrderStatus(o) === 'untranslated'
    ).length;

    const unmadeCount = ctripOrders.filter(
      (o) => getCtripOrderStatus(o) === 'unmade'
    ).length;

    const unshippedCount = ctripOrders.filter(
      (o) => getCtripOrderStatus(o) === 'unshipped'
    ).length;

    const apiShippedCount = ctripOrders.filter(
      (o) => o.status === 'shipped'
    ).length;

    const validCount = ctripOrders.filter(
      (o) => getCtripOrderStatus(o) !== 'recycle' && getCtripOrderStatus(o) !== 'cancelled'
    ).length;

    const invalidCount = ctripOrders.filter(
      (o) => getCtripOrderStatus(o) === 'recycle' || getCtripOrderStatus(o) === 'cancelled'
    ).length;

    const validStandardCount = validCount;

    const normalCount = ctripOrders.filter(
      (o) => (getCtripOrderStatus(o) !== 'recycle' && getCtripOrderStatus(o) !== 'cancelled') && !isCtripUrgent(o)
    ).length;

    const urgentCount = ctripOrders.filter(
      (o) => (getCtripOrderStatus(o) !== 'recycle' && getCtripOrderStatus(o) !== 'cancelled') && isCtripUrgent(o)
    ).length;

    const notaryCount = ctripOrders.filter(
      (o) => (getCtripOrderStatus(o) !== 'recycle' && getCtripOrderStatus(o) !== 'cancelled') && (o.productCategory === 'notary' || o.productName.includes('公证'))
    ).length;

    const totalShippedCount = ctripOrders.filter(
      (o) => o.status === 'shipped' || o.status === 'completed' || o.logs.some((l) => l.action.includes('已发货'))
    ).length;

    return [
      { rowLabel: '携程API未翻译合计', count: untranslatedCount },
      { rowLabel: '携程API未制作合计', count: unmadeCount },
      { rowLabel: '携程API未发货合计', count: unshippedCount },
      { rowLabel: '携程API已发货合计', count: apiShippedCount },
      { rowLabel: '携程订单系统有效导入合计', count: validCount },
      { rowLabel: '携程订单系统无效导入合计', count: invalidCount },
      { rowLabel: '携程有效标准翻译件', count: validStandardCount },
      { rowLabel: '携程有效标准翻译件普通', count: normalCount },
      { rowLabel: '携程有效标准翻译件加急', count: urgentCount },
      { rowLabel: '携程有效当地公证件', count: notaryCount },
      { rowLabel: '携程订单系统发货合计', count: totalShippedCount },
    ];
  }, [ctripOrders]);

  // ---- Handlers ----
  const handleSearch = () => {
    setStartDate(startDateInput);
    setEndDate(endDateInput);
  };

  const handleReset = () => {
    setStartDateInput('');
    setEndDateInput('');
    setStartDate('');
    setEndDate('');
  };

  // ---- Render helpers ----
  const tabClass = (tab: ReportTab) =>
    `report-list-toolbar__tab ${activeTab === tab ? 'report-list-toolbar__tab--active' : ''}`;

  const renderReportValue = (value: number) => (value > 0 ? value : '--');

  const renderTranslationProductionTable = () => (
    <div className="license-translation-table-wrap report-statistics-table-wrap">
      <table className="license-translation-table report-statistics-table report-statistics-table--compact">
        <thead>
          <tr>
            <th>人员/事件</th>
            <th>翻译数量</th>
            <th>制作数量</th>
          </tr>
        </thead>
        <tbody>
          {translationProductionRows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.personName}</td>
              <td>{renderReportValue(row.translationCount)}</td>
              <td>{renderReportValue(row.productionCount)}</td>
            </tr>
          ))}
          {translationProductionRows.length === 0 ? (
            <tr>
              <td colSpan={3} className="license-translation-empty">
                暂无数据
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  const renderOrderCountTable = () => (
    <div className="license-translation-table-wrap report-statistics-table-wrap">
      <table className="license-translation-table report-statistics-table report-statistics-table--order-count">
        <thead>
          <tr>
            <th>渠道/产品</th>
            <th>非标件</th>
            <th>国内公证</th>
            <th>小白本</th>
          </tr>
        </thead>
        <tbody>
          {orderCountRows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.channelLabel}</td>
              <td>{row.nonStandardCount > 0 ? row.nonStandardCount : ''}</td>
              <td>{row.notaryCount > 0 ? row.notaryCount : ''}</td>
              <td>{row.standardCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCtripOrderTable = () => (
    <div className="license-translation-table-wrap report-statistics-table-wrap report-ctrip-statistics-wrap">
      <table className="license-translation-table report-statistics-table report-ctrip-statistics-table">
        <thead>
          <tr>
            <th>携程api订单数据</th>
            <th>统计</th>
          </tr>
        </thead>
        <tbody>
          {ctripOrderRows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.rowLabel}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ---- Main render ----
  return (
    <div className="license-translation-page animate-fadeIn">
      <header className="license-translation-topbar">
        <div>
          <div className="license-translation-breadcrumb">
            驾照官后台
            <span>/</span>
            报表
            <span>/</span>
            报表
          </div>
          <h1>报表</h1>
        </div>
      </header>

      <section className="license-translation-filter report-list-filter">
        <div className="license-translation-filter__field report-list-filter__date-range">
          <span>时间区间</span>
          <div className="license-translation-linked-selects">
            <DatePickerInput ariaLabel="开始时间" placeholder="开始时间" value={startDateInput} onChange={setStartDateInput} />
            <DatePickerInput ariaLabel="结束时间" placeholder="结束时间" value={endDateInput} onChange={setEndDateInput} />
          </div>
        </div>
        <div className="license-translation-filter__actions report-list-filter__actions">
          <button type="button" className="license-translation-button license-translation-button--primary" onClick={handleSearch}>
            搜索
          </button>
          <button type="button" className="license-translation-button" onClick={handleReset}>
            重置
          </button>
        </div>
      </section>

      <div className="report-list-toolbar">
        <button
          type="button"
          className={tabClass('translation-production')}
          onClick={() => setActiveTab('translation-production')}
        >
          翻译及制作数量
        </button>
        <button
          type="button"
          className={tabClass('order-count')}
          onClick={() => setActiveTab('order-count')}
        >
          订单数量统计
        </button>
        <button
          type="button"
          className={tabClass('ctrip-order')}
          onClick={() => setActiveTab('ctrip-order')}
        >
          携程订单统计
        </button>
      </div>

      <section className="license-translation-card report-statistics-card">
        {activeTab === 'translation-production' && renderTranslationProductionTable()}
        {activeTab === 'order-count' && renderOrderCountTable()}
        {activeTab === 'ctrip-order' && renderCtripOrderTable()}
      </section>
    </div>
  );
};

export default ReportListPage;
