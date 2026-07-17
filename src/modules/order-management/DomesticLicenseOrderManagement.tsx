import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ORDER_DATA_CHANGED_EVENT, getOrders, getProducts, updateOrder } from '../../services/mockDataService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { useTranslation } from '../../shared/i18n/config';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import type { Channel, Order } from '../../shared/types';
import { getAgentName, getLicenseName, statusTagClass } from './orderListShared';

const DOMESTIC_LICENSE_PRODUCT_TITLE = '换国内驾照翻译件';
const DOMESTIC_LICENSE_COMPANION_PRODUCT_TITLE = '陪同换证';
const LOGISTICS_COMPANY_OPTIONS = ['顺丰速运', '京东物流', '邮政EMS', '圆通速递', '中通快递', '申通快递'];

type LogisticsForm = {
  logisticsCompany: string;
  trackingNumber: string;
};

type DomesticOrderVisibleStatus = 'pending_review' | 'reviewed' | 'shipped' | 'cancelled';

const DOMESTIC_ORDER_STATUS_TABS: Array<{ label: string; value: DomesticOrderVisibleStatus | '' }> = [
  { label: '全部订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '已审核', value: 'reviewed' },
  { label: '已发货', value: 'shipped' },
  { label: '已取消', value: 'cancelled' },
];

const isDomesticLicenseOrder = (order: Order) =>
  order.productCategory === 'domestic_license' ||
  order.productName === DOMESTIC_LICENSE_PRODUCT_TITLE ||
  Boolean(order.domesticLicenseInfo);

const getDomesticForeignLocation = (order: Order) =>
  [order.domesticLicenseInfo?.foreignCountry, order.domesticLicenseInfo?.foreignCity].filter(Boolean).join(' ');

const getDomesticExchangeLocation = (order: Order) =>
  [order.domesticLicenseInfo?.exchangeProvince, order.domesticLicenseInfo?.exchangeCity].filter(Boolean).join(' ');

const DOMESTIC_AGENT_SOURCE_LABELS: Record<Channel, string> = {
  ctrip: '哈啰-H5',
  fliggy: '哈啰-微信小程序',
  private: '哈啰-支付宝小程序',
  offline: '自营录单',
};

const getDomesticAgentSource = (order: Order) => DOMESTIC_AGENT_SOURCE_LABELS[order.channel] || getAgentName(order);

const getDomesticOrderStatusValue = (order: Order): DomesticOrderVisibleStatus => {
  if (order.status === 'cancelled' || order.status === 'rejected') {
    return 'cancelled';
  }

  if (order.status === 'pending_review') {
    return 'pending_review';
  }

  if (order.status === 'shipped' || order.status === 'completed') {
    return 'shipped';
  }

  return 'reviewed';
};

const getDomesticOrderStatusLabel = (order: Order) => {
  const visibleStatus = getDomesticOrderStatusValue(order);
  if (visibleStatus === 'cancelled') return '已取消';
  if (visibleStatus === 'pending_review') return '待审核';
  if (visibleStatus === 'shipped') return '已发货';
  return '已审核';
};

const FILTER_CONTROL_STYLE = { width: '100%' };

const DomesticLicenseOrderManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const domesticLicenseProducts = useMemo(
    () =>
      getProducts()
        .filter((product) => product.category === 'domestic_license' || product.title === DOMESTIC_LICENSE_PRODUCT_TITLE)
        .sort((a, b) => b.weight - a.weight),
    [],
  );

  const productsById = useMemo(
    () => new Map(domesticLicenseProducts.map((product) => [product.productId, product] as const)),
    [domesticLicenseProducts],
  );

  const [allOrders, setAllOrders] = useState<Order[]>(() => getOrders().filter(isDomesticLicenseOrder));
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterForeignCountry, setFilterForeignCountry] = useState('');
  const [filterForeignCity, setFilterForeignCity] = useState('');
  const [filterStatus, setFilterStatus] = useState<DomesticOrderVisibleStatus | ''>('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [shippingForm, setShippingForm] = useState<LogisticsForm>({ logisticsCompany: '', trackingNumber: '' });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const refreshOrders = () => setAllOrders(getOrders().filter(isDomesticLicenseOrder));
    window.addEventListener(ORDER_DATA_CHANGED_EVENT, refreshOrders);
    window.addEventListener('storage', refreshOrders);

    return () => {
      window.removeEventListener(ORDER_DATA_CHANGED_EVENT, refreshOrders);
      window.removeEventListener('storage', refreshOrders);
    };
  }, []);

  const processTypeOptions = useMemo(() => {
    const processTypeMap = new Map<string, string>();

    domesticLicenseProducts.forEach((product) => {
      product.processTypes.forEach((processType) => {
        if (!processTypeMap.has(processType.name)) {
          processTypeMap.set(processType.name, getProductProcessTypeLabel(processType.name, t));
        }
      });
    });

    return Array.from(processTypeMap, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, 'zh-CN'),
    );
  }, [domesticLicenseProducts, t]);

  const domesticOrders = useMemo(() => allOrders.filter((order) => order.domesticLicenseInfo), [allOrders]);

  const foreignCountryOptions = useMemo(
    () =>
      Array.from(
        new Set(domesticOrders.map((order) => order.domesticLicenseInfo?.foreignCountry?.trim()).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [domesticOrders],
  );

  const foreignCityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          domesticOrders
            .filter((order) => !filterForeignCountry || order.domesticLicenseInfo?.foreignCountry === filterForeignCountry)
            .map((order) => order.domesticLicenseInfo?.foreignCity?.trim())
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [domesticOrders, filterForeignCountry],
  );

  const getOrderProcessType = (order: Order) => {
    const product = productsById.get(order.productId);
    if (!product) {
      return null;
    }

    if (order.processTypeId) {
      const matchedById = product.processTypes.find((processType) => processType.typeId === order.processTypeId);
      if (matchedById) {
        return matchedById;
      }
    }

    return product.processTypes.find((processType) => processType.name === order.processType) || null;
  };

  const getOrderProcessTypeLabel = (order: Order) => {
    const matchedProcessType = getOrderProcessType(order);
    return getProductProcessTypeLabel(matchedProcessType?.name || order.processType, t);
  };

  const getOrderProcessTypeTone = (order: Order) => {
    const matchedProcessType = getOrderProcessType(order);
    return getProcessTypeTone(matchedProcessType?.name || order.processType, matchedProcessType?.estimatedDays);
  };

  const ordersMatchingNonStatusFilters = useMemo(() => {
    const keyword = filterKeyword.trim().toLowerCase();
    const agentKeyword = filterAgent.trim().toLowerCase();

    return allOrders.filter((order) => {
      const createdDate = order.createdAt.slice(0, 10);

      if (agentKeyword && !getDomesticAgentSource(order).toLowerCase().includes(agentKeyword)) return false;
      if (filterProcessType && order.processType !== filterProcessType) return false;
      if (filterForeignCountry && order.domesticLicenseInfo?.foreignCountry !== filterForeignCountry) return false;
      if (filterForeignCity && order.domesticLicenseInfo?.foreignCity !== filterForeignCity) return false;
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;

      if (keyword) {
        const domesticInfo = order.domesticLicenseInfo;
        const searchableText = [
          order.orderId,
          order.customerName,
          order.customerPhone,
          order.customerEmail,
          order.productName,
          order.processType,
          domesticInfo?.chineseName,
          domesticInfo?.licenseNumber,
          domesticInfo?.foreignCountry,
          domesticInfo?.foreignCity,
          domesticInfo?.exchangeProvince,
          domesticInfo?.exchangeCity,
          order.deliveryAddress,
          order.logisticsCompany,
          order.trackingNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(keyword)) return false;
      }

      return true;
    });
  }, [
    allOrders,
    filterAgent,
    filterEndDate,
    filterForeignCity,
    filterForeignCountry,
    filterKeyword,
    filterProcessType,
    filterStartDate,
  ]);

  const filteredOrders = useMemo(
    () =>
      filterStatus
        ? ordersMatchingNonStatusFilters.filter((order) => getDomesticOrderStatusValue(order) === filterStatus)
        : ordersMatchingNonStatusFilters,
    [filterStatus, ordersMatchingNonStatusFilters],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<DomesticOrderVisibleStatus | '', number> = {
      '': ordersMatchingNonStatusFilters.length,
      pending_review: 0,
      reviewed: 0,
      shipped: 0,
      cancelled: 0,
    };

    ordersMatchingNonStatusFilters.forEach((order) => {
      counts[getDomesticOrderStatusValue(order)] += 1;
    });

    return counts;
  }, [ordersMatchingNonStatusFilters]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const handleReset = () => {
    setFilterAgent('');
    setFilterProcessType('');
    setFilterForeignCountry('');
    setFilterForeignCity('');
    setFilterStatus('');
    setFilterKeyword('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleOpenShippingModal = (order: Order) => {
    setShippingOrder(order);
    setShippingForm({
      logisticsCompany: order.logisticsCompany?.trim() || '',
      trackingNumber: order.trackingNumber?.trim() || '',
    });
  };

  const handleCloseShippingModal = () => {
    setShippingOrder(null);
    setShippingForm({ logisticsCompany: '', trackingNumber: '' });
  };

  const handleSubmitShipping = () => {
    if (!shippingOrder) return;

    const logisticsCompany = shippingForm.logisticsCompany.trim();
    const trackingNumber = shippingForm.trackingNumber.trim();
    if (!logisticsCompany || !trackingNumber) {
      showToast('error', '请完整填写物流公司和物流单号');
      return;
    }

    const shippedAt = formatBeijingTimestamp();
    updateOrder(shippingOrder.orderId, {
      status: 'shipped',
      logisticsCompany,
      trackingNumber,
      shippedAt,
      updatedAt: shippedAt,
      logs: [
        ...shippingOrder.logs,
        {
          time: shippedAt,
          operator: '运营-物流',
          action: `填写物流并发货：${logisticsCompany} ${trackingNumber}`,
        },
      ],
    });

    setAllOrders(getOrders().filter(isDomesticLicenseOrder));
    handleCloseShippingModal();
    showToast('success', '发货成功，物流信息已保存');
  };

  return (
    <div className="app-main animate-fadeIn order-list-page">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}
      <div className="app-topbar">
        <div className="order-list-topbar">
          <div className="app-topbar__breadcrumb">
            后台管理
            <span>/</span>
            换国内驾照翻译件订单管理
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel">
          <div className="translation-order-filter-layout domestic-license-filter-layout">
            <div className="order-filter-grid translation-order-filter-grid domestic-license-filter-grid">
              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--agent">
                <label className="form-label">选择代理商</label>
                <input
                  className="form-input"
                  style={FILTER_CONTROL_STYLE}
                  value={filterAgent}
                  onChange={(event) => setFilterAgent(event.target.value)}
                  placeholder="请输入代理商名称"
                />
              </div>

              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--process">
                <label className="form-label">办理类型</label>
                <select
                  className={`form-select ${!filterProcessType ? 'domestic-license-filter-control--placeholder' : ''}`}
                  style={FILTER_CONTROL_STYLE}
                  value={filterProcessType}
                  onChange={(event) => {
                    setFilterProcessType(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">全部办理类型</option>
                  {processTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group order-filter-field order-filter-field--span-2 domestic-license-filter-field domestic-license-filter-field--location">
                <label className="form-label">驾照发放国家及城市</label>
                <div className="order-filter-linked-selects">
                  <select
                    className={`form-select ${!filterForeignCountry ? 'domestic-license-filter-control--placeholder' : ''}`}
                    style={FILTER_CONTROL_STYLE}
                    value={filterForeignCountry}
                    onChange={(event) => {
                      setFilterForeignCountry(event.target.value);
                      setFilterForeignCity('');
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">全部国家</option>
                    {foreignCountryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  <select
                    className={`form-select ${!filterForeignCity ? 'domestic-license-filter-control--placeholder' : ''}`}
                    style={FILTER_CONTROL_STYLE}
                    value={filterForeignCity}
                    disabled={!filterForeignCountry}
                    onChange={(event) => {
                      setFilterForeignCity(event.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">全部城市</option>
                    {foreignCityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group order-filter-field order-filter-field--span-2 domestic-license-filter-field domestic-license-filter-field--time">
                <label className="form-label">时间</label>
                <div className="order-filter-range">
                  <input
                    className={`form-input ${!filterStartDate ? 'domestic-license-filter-control--placeholder' : ''}`}
                    style={FILTER_CONTROL_STYLE}
                    type="date"
                    value={filterStartDate}
                    onChange={(event) => setFilterStartDate(event.target.value)}
                  />
                  <span className="order-filter-range__divider">至</span>
                  <input
                    className={`form-input ${!filterEndDate ? 'domestic-license-filter-control--placeholder' : ''}`}
                    style={FILTER_CONTROL_STYLE}
                    type="date"
                    value={filterEndDate}
                    onChange={(event) => setFilterEndDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--keyword">
                <label className="form-label">精准搜索</label>
                <input
                  className="form-input"
                  style={FILTER_CONTROL_STYLE}
                  value={filterKeyword}
                  onChange={(event) => setFilterKeyword(event.target.value)}
                  placeholder="订单号、姓名、手机号、邮箱、收货地址、快递单号"
                />
              </div>

              <div className="order-filter-actions order-filter-actions--inline translation-order-filter-actions domestic-license-filter-actions">
                <button className="btn btn--primary" onClick={() => setCurrentPage(1)}>
                  搜索
                </button>
                <button className="btn btn--secondary" onClick={handleReset}>
                  重置
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card order-list-card">
          <div className="order-list-card__tabs-row domestic-license-list-tabs-row">
            <div className="tabs order-list-tabs">
              {DOMESTIC_ORDER_STATUS_TABS.map((tab) => (
                <div
                  key={tab.value || 'all'}
                  className={`tabs__item ${filterStatus === tab.value ? 'tabs__item--active' : ''}`}
                  onClick={() => {
                    setFilterStatus(tab.value);
                    setCurrentPage(1);
                  }}
                >
                  {tab.label}
                  <span className="order-list-tabs__count">{statusCounts[tab.value]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table order-list-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>订单号</th>
                  <th style={{ minWidth: 160 }}>下单时间</th>
                  <th style={{ minWidth: 240 }}>产品及办理类型</th>
                  <th style={{ minWidth: 180 }}>代理商</th>
                  <th style={{ minWidth: 280 }}>基本信息</th>
                  <th style={{ minWidth: 260 }}>补充信息</th>
                  <th style={{ minWidth: 140 }}>订单状态</th>
                  <th style={{ minWidth: 168 }}>操作项</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      <div className="empty-state__icon">暂无</div>
                      <div className="empty-state__text">暂无数据</div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const detailNavigationState = {
                      from: '/order-management/domestic-license-orders',
                      listLabel: '换国内驾照翻译件订单管理',
                    };
                    const viewPath = `/order-management/domestic-license-orders/${order.orderId}?mode=view`;
                    const auditPath = `/order-management/domestic-license-orders/${order.orderId}?mode=audit`;
                    const isCompanionOrder = order.productName === DOMESTIC_LICENSE_COMPANION_PRODUCT_TITLE;

                    return (
                      <tr key={order.orderId} className="order-list-row">
                        <td>
                          <div className="order-cell-stack order-cell-stack--tight order-id-cell">
                            <button
                              className="order-id-link"
                              onClick={() => navigate(viewPath, { state: detailNavigationState })}
                            >
                              {order.orderId}
                            </button>
                          </div>
                        </td>
                        <td className="order-time-cell">{order.createdAt}</td>
                        <td>
                          <div className="order-cell-stack">
                            <div className="order-cell-primary">{order.productName}</div>
                            <div className={`order-process-line order-process-line--${getOrderProcessTypeTone(order)}`}>
                              <span className="order-process-line__dot" />
                              <span>{getOrderProcessTypeLabel(order)}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="order-agent-name">{getDomesticAgentSource(order)}</div>
                        </td>
                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                              <span className="order-cell-label">中文姓名：</span>
                              <span className="order-cell-value">
                                {order.domesticLicenseInfo?.chineseName || getLicenseName(order)}
                              </span>
                            </div>
                            {isCompanionOrder ? (
                              <div>
                                <span className="order-cell-label">联系电话：</span>
                                <span className="order-cell-value">{order.customerPhone || '--'}</span>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <span className="order-cell-label">联系邮箱：</span>
                                  <span className="order-cell-value">{order.customerEmail || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">换证城市：</span>
                                  <span className="order-cell-value">{getDomesticExchangeLocation(order) || '--'}</span>
                                </div>
                              </>
                            )}
                            <div>
                              <span className="order-cell-label">驾驶证发放国家及城市：</span>
                              <span className="order-cell-value">{getDomesticForeignLocation(order) || '--'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            {isCompanionOrder ? (
                              <>
                                <div>
                                  <span className="order-cell-label">联系人：</span>
                                  <span className="order-cell-value">{order.customerName || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">到达城市：</span>
                                  <span className="order-cell-value">{order.arrivalCity || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">到达机场：</span>
                                  <span className="order-cell-value">{order.arrivalAirport || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">到达日期与时间：</span>
                                  <span className="order-cell-value">{order.arrivalDateTime || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">航班号：</span>
                                  <span className="order-cell-value">{order.flightNumber || '--'}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className="order-cell-label">收件人：</span>
                                  <span className="order-cell-value">{order.customerName}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">手机号：</span>
                                  <span className="order-cell-value">{order.customerPhone}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">收货地址：</span>
                                  <span className="order-cell-value">{order.deliveryAddress}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="order-status-cell">
                            <span className={`${statusTagClass(order.status)} order-list-status-tag`}>
                              {getDomesticOrderStatusLabel(order)}
                            </span>
                            {order.logisticsCompany && order.trackingNumber && (
                              <div className="order-logistics-inline order-logistics-inline--status">
                                <span>{order.logisticsCompany}</span>
                                <span>{order.trackingNumber}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="order-actions-cell">
                          <button
                            type="button"
                            className="order-text-action order-text-action--view"
                            onClick={() => navigate(viewPath, { state: detailNavigationState })}
                          >
                            查看订单
                          </button>
                          <button
                            type="button"
                            className={`order-text-action ${
                              order.status === 'pending_review' ? 'order-text-action--audit' : 'order-text-action--review'
                            }`}
                            onClick={() => navigate(auditPath, { state: detailNavigationState })}
                          >
                            {order.status === 'pending_review' ? '订单审核' : '查看审核'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '0 16px' }}>
            <ListUnifiedPagination
              total={filteredOrders.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {shippingOrder && (
          <div className="modal-overlay" onClick={handleCloseShippingModal}>
            <div className="modal domestic-license-logistics-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">物流发货</h3>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleCloseShippingModal}>
                  关闭
                </button>
              </div>

              <div className="modal__body domestic-license-logistics-modal__body">
                <div className="domestic-license-logistics-modal__summary">
                  <span>订单号：{shippingOrder.orderId}</span>
                  <span>收件人：{shippingOrder.customerName}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="domestic-license-logistics-company">
                    物流公司
                  </label>
                  <select
                    id="domestic-license-logistics-company"
                    className="form-select"
                    value={shippingForm.logisticsCompany}
                    onChange={(event) =>
                      setShippingForm((currentForm) => ({ ...currentForm, logisticsCompany: event.target.value }))
                    }
                  >
                    <option value="">请选择物流公司</option>
                    {LOGISTICS_COMPANY_OPTIONS.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="domestic-license-tracking-number">
                    物流单号
                  </label>
                  <input
                    id="domestic-license-tracking-number"
                    className="form-input"
                    value={shippingForm.trackingNumber}
                    placeholder="请输入物流单号"
                    onChange={(event) =>
                      setShippingForm((currentForm) => ({ ...currentForm, trackingNumber: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="modal__footer">
                <button type="button" className="btn btn--secondary" onClick={handleCloseShippingModal}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!shippingForm.logisticsCompany.trim() || !shippingForm.trackingNumber.trim()}
                  onClick={handleSubmitShipping}
                >
                  确认发货
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DomesticLicenseOrderManagement;
