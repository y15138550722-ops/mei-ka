import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, getProducts } from '../../services/mockDataService';
import { useTranslation } from '../../shared/i18n/config';
import type { Channel, Order, OrderStatus, ProductCategory } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import './Dashboard.css';

const PENDING_SHIPMENT_STATUSES: OrderStatus[] = ['translating', 'pending_review', 'pending_production', 'in_production'];
const SHIPPED_STATUSES: OrderStatus[] = ['shipped', 'completed'];
const ABNORMAL_STATUSES: OrderStatus[] = ['rejected', 'cancelled'];
const CHANNELS: Channel[] = ['ctrip', 'fliggy', 'private', 'offline'];
const PRODUCT_CATEGORIES: ProductCategory[] = ['translation', 'domestic_license', 'notary', 'idp'];

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('zh-CN');
const percentFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDefaultSelectedDate = () => formatBeijingTimestamp().slice(0, 10) || formatDateInputValue(new Date());

const getPreviousDate = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return formatDateInputValue(date);
};

const getDateKey = (value: string) => value.slice(0, 10);

const sumAmount = (orders: Order[]) => orders.reduce((total, order) => total + order.lockedPrice, 0);

const getOrderDetailPath = (order: Order) => {
  if (order.productCategory === 'idp') {
    return `/order-management/idp-orders/${order.orderId}?mode=view`;
  }

  if (order.productCategory === 'notary') {
    return `/order-management/notary-orders/${order.orderId}/preview?mode=view`;
  }

  return `/orders/${order.orderId}?mode=view`;
};

const calculateTrend = (current: number, previous: number) => {
  const delta = current - previous;

  if (current === 0 && previous === 0) {
    return {
      delta,
      direction: 'flat' as const,
      rate: 0,
    };
  }

  return {
    delta,
    direction: delta > 0 ? ('up' as const) : delta < 0 ? ('down' as const) : ('flat' as const),
    rate: previous === 0 ? 100 : Math.abs((delta / previous) * 100),
  };
};

const getTrendTone = (
  trend: ReturnType<typeof calculateTrend>,
  positiveChangeIsGood = true,
): 'good' | 'bad' | 'neutral' => {
  if (trend.direction === 'flat') {
    return 'neutral';
  }

  if (positiveChangeIsGood) {
    return trend.direction === 'up' ? 'good' : 'bad';
  }

  return trend.direction === 'down' ? 'good' : 'bad';
};

const formatTrendValue = (trend: ReturnType<typeof calculateTrend>) => {
  if (trend.direction === 'flat') {
    return '0.00%';
  }

  return `${trend.direction === 'up' ? '+' : '-'}${percentFormatter.format(trend.rate)}%`;
};

const formatAmount = (value: number) => currencyFormatter.format(value);

const formatCount = (value: number) => numberFormatter.format(value);

const CalendarIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 2.75a.75.75 0 0 1 .75.75v1h8.5v-1a.75.75 0 0 1 1.5 0v1h1.25A2.75 2.75 0 0 1 21.75 7v11A2.75 2.75 0 0 1 19 20.75H5A2.75 2.75 0 0 1 2.25 18V7A2.75 2.75 0 0 1 5 4.25h1.25v-1A.75.75 0 0 1 7 2.75Zm12.5 7H4.5V18c0 .69.56 1.25 1.25 1.25h13.5c.69 0 1.25-.56 1.25-1.25V9.75Zm-13.5-4A1.25 1.25 0 0 0 4.5 7v1.25h15V7c0-.69-.56-1.25-1.25-1.25H6Z"
      fill="currentColor"
    />
  </svg>
);

const OverviewIcon: React.FC = () => (
  <svg viewBox="0 0 96 96" aria-hidden="true">
    <rect x="14" y="18" width="48" height="48" rx="10" fill="currentColor" opacity="0.14" />
    <rect x="22" y="28" width="32" height="8" rx="4" fill="currentColor" opacity="0.4" />
    <rect x="22" y="42" width="26" height="8" rx="4" fill="currentColor" opacity="0.3" />
    <rect x="22" y="56" width="18" height="8" rx="4" fill="currentColor" opacity="0.24" />
    <circle cx="67" cy="60" r="16" fill="none" stroke="currentColor" strokeWidth="7" opacity="0.2" />
    <path
      d="M59 60.5 65.5 67 76 54.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="6"
      opacity="0.5"
    />
  </svg>
);

const WalletIcon: React.FC = () => (
  <svg viewBox="0 0 96 96" aria-hidden="true">
    <path
      d="M26 38c0-10.49 8.51-19 19-19h6.58c3.45 0 6.78-.98 9.65-2.83l6.17-3.97c1.78-1.15 4.16-.64 5.31 1.14.54.83.73 1.83.55 2.81L71 26h5c7.73 0 14 6.27 14 14v22H26V38Z"
      fill="currentColor"
      opacity="0.14"
    />
    <path
      d="M33 76c0-10.49 8.51-19 19-19h12c10.49 0 19 8.51 19 19v3H33v-3Z"
      fill="currentColor"
      opacity="0.2"
    />
    <path
      d="M48 45.5 56.5 54 70 40.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="7"
      opacity="0.44"
    />
  </svg>
);

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const orders = getOrders();
  const products = getProducts();
  const todayDate = getDefaultSelectedDate();
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const previousDate = getPreviousDate(selectedDate);
  const currentOrders = orders.filter((order) => getDateKey(order.createdAt) <= selectedDate);
  const previousOrders = orders.filter((order) => getDateKey(order.createdAt) <= previousDate);

  const currentPaidOrders = currentOrders.filter((order) => !ABNORMAL_STATUSES.includes(order.status));
  const previousPaidOrders = previousOrders.filter((order) => !ABNORMAL_STATUSES.includes(order.status));
  const currentPendingShipmentOrders = currentOrders.filter((order) => PENDING_SHIPMENT_STATUSES.includes(order.status));
  const previousPendingShipmentOrders = previousOrders.filter((order) => PENDING_SHIPMENT_STATUSES.includes(order.status));

  const totalRevenue = sumAmount(currentPaidOrders);
  const previousTotalRevenue = sumAmount(previousPaidOrders);
  const pendingShipmentAmount = sumAmount(currentPendingShipmentOrders);
  const previousPendingShipmentAmount = sumAmount(previousPendingShipmentOrders);
  const activeProducts = products.filter((product) => product.status === 'active').length;

  const shippedOrderCount = currentOrders.filter((order) => SHIPPED_STATUSES.includes(order.status)).length;
  const previousShippedOrderCount = previousOrders.filter((order) => SHIPPED_STATUSES.includes(order.status)).length;
  const pendingReviewCount = currentOrders.filter((order) => order.status === 'pending_review').length;
  const previousPendingReviewCount = previousOrders.filter((order) => order.status === 'pending_review').length;
  const abnormalOrderCount = currentOrders.filter((order) => ABNORMAL_STATUSES.includes(order.status)).length;
  const previousAbnormalOrderCount = previousOrders.filter((order) => ABNORMAL_STATUSES.includes(order.status)).length;

  const totalRevenueTrend = calculateTrend(totalRevenue, previousTotalRevenue);
  const pendingShipmentAmountTrend = calculateTrend(pendingShipmentAmount, previousPendingShipmentAmount);
  const totalOrderTrend = calculateTrend(currentOrders.length, previousOrders.length);
  const shippedOrderTrend = calculateTrend(shippedOrderCount, previousShippedOrderCount);
  const pendingReviewTrend = calculateTrend(pendingReviewCount, previousPendingReviewCount);
  const pendingShipmentTrend = calculateTrend(currentPendingShipmentOrders.length, previousPendingShipmentOrders.length);
  const abnormalOrderTrend = calculateTrend(abnormalOrderCount, previousAbnormalOrderCount);

  const recentOrders = [...currentOrders].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 6);
  const maxChannelCount = Math.max(
    1,
    ...CHANNELS.map((channel) => currentOrders.filter((order) => order.channel === channel).length),
  );

  const channelOverview = CHANNELS.map((channel) => {
    const count = currentOrders.filter((order) => order.channel === channel).length;

    return {
      channel,
      count,
      width: `${(count / maxChannelCount) * 100}%`,
    };
  });

  const categoryOverview = PRODUCT_CATEGORIES.map((category) => ({
    category,
    count: products.filter((product) => product.category === category && product.status === 'active').length,
  }));

  const priorityOrderCount = currentOrders.filter((order) =>
    order.processType === 'priority' || order.processType === 'urgent',
  ).length;
  const priorityOrderShare = currentOrders.length === 0 ? 0 : Math.round((priorityOrderCount / currentOrders.length) * 100);
  const notaryOrderCount = currentOrders.filter((order) => order.productCategory === 'notary').length;
  const notaryOrderShare = currentOrders.length === 0 ? 0 : Math.round((notaryOrderCount / currentOrders.length) * 100);

  const heroCards = [
    {
      title: '成交总额',
      value: formatAmount(totalRevenue),
      previousValue: `昨日 ${formatAmount(previousTotalRevenue)}`,
      trend: totalRevenueTrend,
      trendTone: getTrendTone(totalRevenueTrend),
      tone: 'sky',
      icon: <OverviewIcon />,
    },
    {
      title: '待发货金额',
      value: formatAmount(pendingShipmentAmount),
      previousValue: `昨日 ${formatAmount(previousPendingShipmentAmount)}`,
      trend: pendingShipmentAmountTrend,
      trendTone: getTrendTone(pendingShipmentAmountTrend, false),
      tone: 'mist',
      icon: <WalletIcon />,
    },
  ];

  const statCards = [
    {
      label: '订单总量',
      value: formatCount(currentOrders.length),
      previousValue: `昨日 ${formatCount(previousOrders.length)}`,
      trend: totalOrderTrend,
      trendTone: getTrendTone(totalOrderTrend),
      statusTone: 'neutral',
    },
    {
      label: '已发货订单',
      value: formatCount(shippedOrderCount),
      previousValue: `昨日 ${formatCount(previousShippedOrderCount)}`,
      trend: shippedOrderTrend,
      trendTone: getTrendTone(shippedOrderTrend),
      statusTone: 'good',
    },
    {
      label: '未审核订单',
      value: formatCount(pendingReviewCount),
      previousValue: `昨日 ${formatCount(previousPendingReviewCount)}`,
      trend: pendingReviewTrend,
      trendTone: getTrendTone(pendingReviewTrend, false),
      statusTone: 'warning',
    },
    {
      label: '待发货订单',
      value: formatCount(currentPendingShipmentOrders.length),
      previousValue: `昨日 ${formatCount(previousPendingShipmentOrders.length)}`,
      trend: pendingShipmentTrend,
      trendTone: getTrendTone(pendingShipmentTrend, false),
      statusTone: 'warning',
    },
    {
      label: '异常订单',
      value: formatCount(abnormalOrderCount),
      previousValue: `昨日 ${formatCount(previousAbnormalOrderCount)}`,
      trend: abnormalOrderTrend,
      trendTone: getTrendTone(abnormalOrderTrend, false),
      statusTone: 'danger',
    },
  ];

  const sideHighlights = [
    { label: '在售产品', value: formatCount(activeProducts), link: '/products' },
    { label: '公证订单占比', value: `${notaryOrderShare}%`, link: '/notary/orders' },
    { label: '优先 / 加急占比', value: `${priorityOrderShare}%`, link: '/orders' },
  ];

  return (
    <div className="dashboard-page animate-fadeIn">
      <section className="dashboard-overview">
        <div className="dashboard-overview__topbar">
          <div className="dashboard-page__heading">
            <h1 className="dashboard-page__title">数据概览</h1>
          </div>

          <label className="dashboard-date-field" aria-label="统计日期">
            <span className="dashboard-date-field__icon">
              <CalendarIcon />
            </span>
            <input
              type="date"
              value={selectedDate}
              max={todayDate}
              onChange={(event) => setSelectedDate(event.target.value || todayDate)}
            />
          </label>
        </div>

        <div className="dashboard-hero-grid">
          {heroCards.map((card) => (
            <div
              key={card.title}
              className={`dashboard-hero-card dashboard-hero-card--${card.tone}`}
            >
              <div className="dashboard-hero-card__content">
                <span className="dashboard-hero-card__label">{card.title}</span>
                <strong className="dashboard-hero-card__value">{card.value}</strong>
                <div className="dashboard-trend">
                  <span className={`dashboard-trend__delta dashboard-trend__delta--${card.trendTone}`}>
                    同比昨日 {formatTrendValue(card.trend)}
                  </span>
                  <span className="dashboard-trend__previous">{card.previousValue}</span>
                </div>
              </div>
              <div className="dashboard-hero-card__glyph">{card.icon}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-stat-grid">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`dashboard-metric-card dashboard-metric-card--${card.statusTone}`}
            >
              <div className="dashboard-metric-card__header">
                <span className="dashboard-metric-card__label">{card.label}</span>
                <span
                  className={`dashboard-metric-card__signal dashboard-metric-card__signal--${card.statusTone}`}
                  aria-hidden="true"
                />
              </div>
              <strong className="dashboard-metric-card__value">{card.value}</strong>
              <div className="dashboard-trend dashboard-trend--compact">
                <span className={`dashboard-trend__delta dashboard-trend__delta--${card.trendTone}`}>
                  同比昨日 {formatTrendValue(card.trend)}
                </span>
                <span className="dashboard-trend__previous">{card.previousValue}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Recent Orders</span>
              <h3 className="dashboard-panel__title">近期订单</h3>
            </div>
            <button type="button" className="dashboard-panel__link" onClick={() => navigate('/orders')}>
              查看全部
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="dashboard-empty-state">当前日期范围内暂无订单数据</div>
          ) : (
            <div className="dashboard-table-wrap">
              <table className="dashboard-orders-table">
                <thead>
                  <tr>
                    <th>{t('order.field.orderId')}</th>
                    <th>{t('order.field.customerName')}</th>
                    <th>{t('order.field.productName')}</th>
                    <th>{t('order.field.processType')}</th>
                    <th>{t('order.field.status')}</th>
                    <th>{t('order.field.paidAmount')}</th>
                    <th>{t('order.field.createdAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.orderId} onClick={() => navigate(getOrderDetailPath(order))}>
                      <td className="dashboard-orders-table__primary">{order.orderId}</td>
                      <td>{order.customerName}</td>
                      <td>{order.productName}</td>
                      <td>{getProductProcessTypeLabel(order.processType, t)}</td>
                      <td>
                        <span
                          className={`tag tag--${
                            order.status === 'pending_review'
                              ? 'pending'
                              : order.status === 'translating'
                                ? 'warning'
                              : order.status === 'pending_production' || order.status === 'in_production'
                                ? 'processing'
                                : order.status === 'shipped'
                                  ? 'shipped'
                                  : order.status === 'completed'
                                    ? 'completed'
                                    : order.status === 'rejected'
                                      ? 'rejected'
                                      : 'cancelled'
                          }`}
                        >
                          {t(`order.status.${order.status}`)}
                        </span>
                      </td>
                      <td className="dashboard-orders-table__amount">{formatAmount(order.lockedPrice)}</td>
                      <td>{order.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-panel dashboard-panel--side">
          <div className="dashboard-panel__header">
            <div>
              <span className="dashboard-panel__eyebrow">Operations</span>
              <h3 className="dashboard-panel__title">运营节奏</h3>
            </div>
          </div>

          <div className="dashboard-highlight-grid">
            {sideHighlights.map((item) => (
              <button
                key={item.label}
                type="button"
                className="dashboard-highlight-card"
                onClick={() => navigate(item.link)}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </button>
            ))}
          </div>

          <div className="dashboard-side-section">
            <div className="dashboard-side-section__head">
              <h4>订单来源</h4>
              <span>{formatCount(currentOrders.length)} 单</span>
            </div>
            <div className="dashboard-distribution-list">
              {channelOverview.map((item) => (
                <div key={item.channel} className="dashboard-distribution-item">
                  <div className="dashboard-distribution-item__label">
                    <span>{t(`channel.${item.channel}`)}</span>
                    <strong>{formatCount(item.count)}</strong>
                  </div>
                  <div className="dashboard-distribution-item__bar">
                    <span style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-side-section">
            <div className="dashboard-side-section__head">
              <h4>产品结构</h4>
              <button type="button" className="dashboard-panel__link" onClick={() => navigate('/products')}>
                产品中心
              </button>
            </div>
            <div className="dashboard-category-list">
              {categoryOverview.map((item) => (
                <div key={item.category} className="dashboard-category-chip">
                  <span>{t(`product.category.${item.category}`)}</span>
                  <strong>{formatCount(item.count)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
