import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ORDER_DATA_CHANGED_EVENT, getOrders, getProducts } from '../../services/mockDataService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { useTranslation } from '../../shared/i18n/config';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import type { Channel, Order, Product } from '../../shared/types';
import { getAgentName, getLicenseName, statusTagClass } from './orderListShared';

const DOMESTIC_LICENSE_PRODUCT_TITLE = '换国内驾照翻译件';
const DOMESTIC_LICENSE_COMPANION_PRODUCT_TITLE = '陪同换证';
type DomesticOrderVisibleStatus = 'pending_review' | 'in_production' | 'shipped' | 'cancelled';

const DOMESTIC_ORDER_STATUS_TABS: Array<{ label: string; value: DomesticOrderVisibleStatus | '' }> = [
  { label: '全部订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '制作中', value: 'in_production' },
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
  ctrip: '哈啰api',
  fliggy: '德耀-微信小程序',
  private: '德耀-支付宝小程序',
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

  return 'in_production';
};

const getDomesticOrderStatusLabel = (order: Order) => {
  const visibleStatus = getDomesticOrderStatusValue(order);
  if (visibleStatus === 'cancelled') return '已取消';
  if (visibleStatus === 'pending_review') return '待审核';
  if (visibleStatus === 'in_production') return '制作中';
  return '已发货';
};

const FILTER_CONTROL_STYLE = { width: '100%' };

const getDomesticLicenseProducts = () =>
  getProducts()
    .filter((product) => product.category === 'domestic_license' || product.title === DOMESTIC_LICENSE_PRODUCT_TITLE)
    .sort((a, b) => b.weight - a.weight);

const DomesticLicenseOrderManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [domesticLicenseProducts, setDomesticLicenseProducts] = useState<Product[]>(getDomesticLicenseProducts);

  const productsById = useMemo(
    () => new Map(domesticLicenseProducts.map((product) => [product.productId, product] as const)),
    [domesticLicenseProducts],
  );

  const [allOrders, setAllOrders] = useState<Order[]>(() => getOrders().filter(isDomesticLicenseOrder));
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterForeignCountry, setFilterForeignCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState<DomesticOrderVisibleStatus | ''>('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const refreshOrders = () => {
      setDomesticLicenseProducts(getDomesticLicenseProducts());
      setAllOrders(getOrders().filter(isDomesticLicenseOrder));
    };
    window.addEventListener(ORDER_DATA_CHANGED_EVENT, refreshOrders);
    window.addEventListener('storage', refreshOrders);

    return () => {
      window.removeEventListener(ORDER_DATA_CHANGED_EVENT, refreshOrders);
      window.removeEventListener('storage', refreshOrders);
    };
  }, []);

  const processTypeOptions = useMemo(() => {
    const processTypeMap = new Map<string, string>();
    const sourceProducts = filterProduct
      ? domesticLicenseProducts.filter((product) => product.title === filterProduct)
      : domesticLicenseProducts;

    sourceProducts.forEach((product) => {
      product.processTypes.forEach((processType) => {
        if (!processTypeMap.has(processType.name)) {
          processTypeMap.set(processType.name, getProductProcessTypeLabel(processType.name, t));
        }
      });
    });

    // Keep existing order values available when a product has no configured
    // process types yet (for example, migrated orders using 普通办理).
    allOrders
      .filter((order) => !filterProduct || productsById.get(order.productId)?.title === filterProduct || order.productName === filterProduct)
      .forEach((order) => {
      const value = order.processType?.trim();
      if (value && !processTypeMap.has(value)) {
        processTypeMap.set(value, getProductProcessTypeLabel(value, t));
      }
      });

    return Array.from(processTypeMap, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, 'zh-CN'),
    );
  }, [allOrders, domesticLicenseProducts, filterProduct, productsById, t]);

  const domesticOrders = useMemo(() => allOrders.filter((order) => order.domesticLicenseInfo), [allOrders]);

  const foreignCountryOptions = useMemo(
    () =>
      Array.from(
        new Set(domesticOrders.map((order) => order.domesticLicenseInfo?.foreignCountry?.trim()).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [domesticOrders],
  );

  const getOrderProduct = (order: Order) => productsById.get(order.productId);

  const getOrderProductTitle = (order: Order) => getOrderProduct(order)?.title || order.productName;

  const getOrderProcessType = (order: Order) => {
    const product = getOrderProduct(order);
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

  const getOrderProcessTypeValue = (order: Order) => getOrderProcessType(order)?.name || order.processType;

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
      const processTypeValue = getOrderProcessTypeValue(order);
      const processTypeLabel = getOrderProcessTypeLabel(order);
      const foreignCountry = order.domesticLicenseInfo?.foreignCountry?.trim();

      if (agentKeyword && !getDomesticAgentSource(order).toLowerCase().includes(agentKeyword)) return false;
      if (filterProduct && getOrderProductTitle(order) !== filterProduct) return false;
      if (
        filterProcessType &&
        processTypeValue !== filterProcessType &&
        processTypeLabel !== filterProcessType &&
        processTypeLabel !== getProductProcessTypeLabel(filterProcessType, t)
      ) {
        return false;
      }
      if (filterForeignCountry && foreignCountry !== filterForeignCountry) return false;
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;

      if (keyword) {
        const domesticInfo = order.domesticLicenseInfo;
        const searchableText = [
          order.orderId,
          order.customerName,
          order.customerPhone,
          order.customerEmail,
          getOrderProductTitle(order),
          getOrderProcessTypeLabel(order),
          processTypeValue,
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
    filterForeignCountry,
    filterKeyword,
    filterProduct,
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
      in_production: 0,
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
    setFilterProduct('');
    setFilterProcessType('');
    setFilterForeignCountry('');
    setFilterStatus('');
    setFilterKeyword('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="app-main animate-fadeIn order-list-page">
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
                  onChange={(event) => {
                    setFilterAgent(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="请输入代理商名称"
                />
              </div>

              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--product">
                <label className="form-label">选择产品</label>
                <select
                  className={`form-select ${!filterProduct ? 'domestic-license-filter-control--placeholder' : ''}`}
                  style={FILTER_CONTROL_STYLE}
                  value={filterProduct}
                  onChange={(event) => {
                    setFilterProduct(event.target.value);
                    setFilterProcessType('');
                    setCurrentPage(1);
                  }}
                >
                  <option value="">全部产品</option>
                  {domesticLicenseProducts.map((product) => (
                    <option key={product.productId} value={product.title}>
                      {product.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--process">
                <label className="form-label">办理类型</label>
                <select
                  className={`form-select ${!filterProcessType ? 'domestic-license-filter-control--placeholder' : ''}`}
                  style={FILTER_CONTROL_STYLE}
                  value={filterProcessType}
                  disabled={!filterProduct}
                  onChange={(event) => {
                    setFilterProcessType(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">{filterProduct ? '全部办理类型' : '请先选择产品'}</option>
                  {processTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--location">
                <label className="form-label">驾照签发地</label>
                <select
                  className={`form-select ${!filterForeignCountry ? 'domestic-license-filter-control--placeholder' : ''}`}
                  style={FILTER_CONTROL_STYLE}
                  value={filterForeignCountry}
                  onChange={(event) => {
                    setFilterForeignCountry(event.target.value);
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
              </div>

              <div className="form-group order-filter-field order-filter-field--span-2 domestic-license-filter-field domestic-license-filter-field--time">
                <label className="form-label">下单时间</label>
                <div className="order-filter-range">
                  <input
                    className={`form-input ${!filterStartDate ? 'domestic-license-filter-control--placeholder' : ''}`}
                    style={FILTER_CONTROL_STYLE}
                    type="date"
                    value={filterStartDate}
                    onChange={(event) => {
                      setFilterStartDate(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <span className="order-filter-range__divider">至</span>
                  <input
                    className={`form-input ${!filterEndDate ? 'domestic-license-filter-control--placeholder' : ''}`}
                    style={FILTER_CONTROL_STYLE}
                    type="date"
                    value={filterEndDate}
                    onChange={(event) => {
                      setFilterEndDate(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="form-group order-filter-field domestic-license-filter-field domestic-license-filter-field--keyword">
                <label className="form-label">精准搜索</label>
                <input
                  className="form-input"
                  style={FILTER_CONTROL_STYLE}
                  value={filterKeyword}
                  onChange={(event) => {
                    setFilterKeyword(event.target.value);
                    setCurrentPage(1);
                  }}
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
                    const isCompanionOrder = getOrderProductTitle(order) === DOMESTIC_LICENSE_COMPANION_PRODUCT_TITLE;

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
                            <div className="order-cell-primary">{getOrderProductTitle(order)}</div>
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
                              <>
                                <div>
                                  <span className="order-cell-label">联系电话：</span>
                                  <span className="order-cell-value">{order.customerPhone || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">联系邮箱：</span>
                                  <span className="order-cell-value">{order.customerEmail || '--'}</span>
                                </div>
                              </>
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
                              <span className="order-cell-label">驾照签发地：</span>
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
                                  <span className="order-cell-label">预约地点：</span>
                                  <span className="order-cell-value">{order.arrivalAirport || '--'}</span>
                                </div>
                                <div>
                                  <span className="order-cell-label">预约时间：</span>
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
                            <span
                              className={`${statusTagClass(getDomesticOrderStatusValue(order))} order-list-status-tag`}
                            >
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

      </div>
    </div>
  );
};

export default DomesticLicenseOrderManagement;
