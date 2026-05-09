import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, getProducts } from '../../services/mockDataService';
import { useTranslation } from '../../shared/i18n/config';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { exportTranslationOrders } from '../../shared/utils/exportTranslationOrders';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import type { Order } from '../../shared/types';
import {
  TRANSLATION_STATUS_TABS,
  type TranslationOrderStatus,
  getAgentName,
  getExportErrorMessage,
  getLicenseCategory,
  getLicenseInfo,
  getLicenseName,
  getLicenseNo,
  getLogisticsInfo,
  getOrderListExportFileName,
  getOrderShippedSortValue,
  getRecipientInfo,
  getRejectReason,
  getTranslationOrderStatus,
  statusTagClass,
} from './orderListShared';

const DOMESTIC_LICENSE_PRODUCT_TITLE = '换国内驾照翻译件';
const isDomesticLicenseProduct = (productTitle: string) => productTitle === DOMESTIC_LICENSE_PRODUCT_TITLE;
const isDomesticLicenseOrder = (order: Order) =>
  order.productCategory === 'domestic_license' ||
  order.productName === DOMESTIC_LICENSE_PRODUCT_TITLE ||
  Boolean(order.domesticLicenseInfo);

const getDomesticExchangeCity = (order: Order) =>
  [order.domesticLicenseInfo?.exchangeProvince, order.domesticLicenseInfo?.exchangeCity].filter(Boolean).join(' ');

const getDomesticForeignLocation = (order: Order) =>
  [order.domesticLicenseInfo?.foreignCountry, order.domesticLicenseInfo?.foreignCity].filter(Boolean).join(' ');

const TranslationOrderList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const translationProducts = useMemo(
    () => getProducts().filter((product) => isDomesticLicenseProduct(product.title)).sort((a, b) => b.weight - a.weight),
    [],
  );
  const allOrders = useMemo(
    () => getOrders().filter(isDomesticLicenseOrder),
    [],
  );

  const [activeStatus, setActiveStatus] = useState<TranslationOrderStatus | ''>('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterForeignCountry, setFilterForeignCountry] = useState('');
  const [filterForeignCity, setFilterForeignCity] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const productsById = useMemo(
    () => new Map(translationProducts.map((product) => [product.productId, product] as const)),
    [translationProducts],
  );
  const productOptions = useMemo(() => translationProducts.map((product) => product.title), [translationProducts]);
  const isDomesticLicenseProductSelected = filterProduct === DOMESTIC_LICENSE_PRODUCT_TITLE;
  const processTypeOptions = useMemo(() => {
    const sourceProducts = filterProduct
      ? translationProducts.filter((product) => product.title === filterProduct)
      : translationProducts;
    const processTypeMap = new Map<string, string>();

    sourceProducts.forEach((product) => {
      product.processTypes.forEach((processType) => {
        if (!processTypeMap.has(processType.name)) {
          processTypeMap.set(processType.name, getProductProcessTypeLabel(processType.name, t));
        }
      });
    });

    return Array.from(processTypeMap, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, 'zh-CN'),
    );
  }, [filterProduct, t, translationProducts]);
  const domesticOrders = useMemo(
    () => allOrders.filter((order) => order.productName === DOMESTIC_LICENSE_PRODUCT_TITLE && order.domesticLicenseInfo),
    [allOrders],
  );
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

  const getOrderProcessLineClassName = (order: Order) =>
    `order-process-line order-process-line--${getOrderProcessTypeTone(order)}`;

  const ordersMatchingNonStatusFilters = useMemo(() => {
    const keyword = filterKeyword.trim().toLowerCase();
    const agentKeyword = filterAgent.trim().toLowerCase();

    return allOrders.filter((order) => {
      const createdDate = order.createdAt.slice(0, 10);

      if (agentKeyword && !getAgentName(order).toLowerCase().includes(agentKeyword)) return false;
      if (filterProduct && order.productName !== filterProduct) return false;
      if (filterProcessType && order.processType !== filterProcessType) return false;
      if (isDomesticLicenseProductSelected) {
        if (filterForeignCountry && order.domesticLicenseInfo?.foreignCountry !== filterForeignCountry) return false;
        if (filterForeignCity && order.domesticLicenseInfo?.foreignCity !== filterForeignCity) return false;
      }
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;

      if (keyword) {
        const domesticInfo = order.domesticLicenseInfo;
        const searchableText = [
          order.orderId,
          order.trackingNumber,
          order.customerName,
          order.customerPhone,
          order.customerPassport,
          order.productName,
          order.processType,
          getLicenseName(order),
          getLicenseNo(order),
          getLicenseCategory(order),
          domesticInfo?.chineseName,
          domesticInfo?.licenseNumber,
          domesticInfo?.classType,
          domesticInfo?.exchangeProvince,
          domesticInfo?.exchangeCity,
          domesticInfo?.foreignCountry,
          domesticInfo?.foreignCity,
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
    filterProduct,
    filterStartDate,
    isDomesticLicenseProductSelected,
  ]);

  const filteredOrders = useMemo(() => {
    const nextOrders = activeStatus
      ? ordersMatchingNonStatusFilters.filter((order) => getTranslationOrderStatus(order.status) === activeStatus)
      : ordersMatchingNonStatusFilters;

    if (activeStatus === 'shipped') {
      return [...nextOrders].sort((a, b) => getOrderShippedSortValue(b).localeCompare(getOrderShippedSortValue(a)));
    }

    return nextOrders;
  }, [activeStatus, ordersMatchingNonStatusFilters]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<TranslationOrderStatus | '', number>> = { '': ordersMatchingNonStatusFilters.length };
    TRANSLATION_STATUS_TABS.forEach((tab) => {
      if (tab.value) {
        counts[tab.value] = ordersMatchingNonStatusFilters.filter(
          (order) => getTranslationOrderStatus(order.status) === tab.value,
        ).length;
      }
    });
    return counts;
  }, [ordersMatchingNonStatusFilters]);

  const activeFilterCount = [
    activeStatus,
    filterAgent,
    filterProduct,
    filterProcessType,
    filterForeignCountry,
    filterForeignCity,
    filterKeyword,
    filterStartDate,
    filterEndDate,
  ].filter(Boolean).length;
  const showRejectReasonColumn = activeStatus === 'cancelled';
  const orderTableColumnCount = showRejectReasonColumn ? 9 : 8;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleReset = () => {
    setFilterAgent('');
    setFilterProduct('');
    setFilterProcessType('');
    setFilterForeignCountry('');
    setFilterForeignCity('');
    setFilterKeyword('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      await exportTranslationOrders(
        filteredOrders.map((order) => ({
          orderId: order.orderId,
          createdAt: order.createdAt,
          productName: order.productName,
          processTypeLabel: getOrderProcessTypeLabel(order),
          agentName: getAgentName(order),
          recipientInfo: getRecipientInfo(order),
          licenseInfo: getLicenseInfo(order),
          statusLabel: t(`order.status.${getTranslationOrderStatus(order.status)}`),
          logisticsInfo: getLogisticsInfo(order),
          price: order.lockedPrice,
          primaryAccount: '',
        })),
        getOrderListExportFileName('翻译订单列表'),
      );

      showToast('success', '导出成功');
    } catch (error) {
      console.error(error);
      showToast('error', getExportErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
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
            翻译订单管理
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel">
          <div className="translation-order-filter-layout">
            <div className="order-filter-grid translation-order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">选择代理商</label>
              <input
                className="form-input"
                value={filterAgent}
                onChange={(event) => setFilterAgent(event.target.value)}
                placeholder="请输入代理商名称"
              />
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">选择产品</label>
              <select
                className="form-select"
                value={filterProduct}
                onChange={(event) => {
                  setFilterProduct(event.target.value);
                  setFilterProcessType('');
                  setFilterForeignCountry('');
                  setFilterForeignCity('');
                  setCurrentPage(1);
                }}
              >
                <option value="">全部产品</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">办理类型</label>
              <select
                className="form-select"
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

            {isDomesticLicenseProductSelected && (
              <div className="form-group order-filter-field">
                <label className="form-label">驾驶证发放国家及城市</label>
                <div className="order-filter-linked-selects">
                  <select
                    className="form-select"
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
                    className="form-select"
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
            )}

            <div className="form-group order-filter-field order-filter-field--span-2">
              <label className="form-label">创建时间</label>
              <div className="order-filter-range">
                <input
                  className="form-input"
                  type="date"
                  value={filterStartDate}
                  onChange={(event) => setFilterStartDate(event.target.value)}
                />
                <span className="order-filter-range__divider">至</span>
                <input
                  className="form-input"
                  type="date"
                  value={filterEndDate}
                  onChange={(event) => setFilterEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="form-group order-filter-field order-filter-field--keyword order-filter-field--span-2">
              <label className="form-label">精准搜索</label>
              <input
                className="form-input"
                value={filterKeyword}
                onChange={(event) => setFilterKeyword(event.target.value)}
                placeholder="订单号、物流单号、姓名…"
              />
            </div>

            </div>

            <div className="order-filter-actions order-filter-actions--inline translation-order-filter-actions">
              <button className="btn btn--primary" onClick={() => setCurrentPage(1)}>
                搜索
              </button>
              <button className="btn btn--secondary" onClick={handleReset}>
                重置
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleExport} disabled={isExporting}>
                {isExporting ? '导出中...' : '导出'}
              </button>
              <button className="btn btn--secondary" type="button">
                导入
              </button>
            </div>
          </div>
        </div>

        <div className="card order-list-card">
          <div className="order-list-card__tabs-row">
            <div className="tabs order-list-tabs">
              {TRANSLATION_STATUS_TABS.map((tab) => (
                <div
                  key={tab.value || 'all'}
                  className={`tabs__item ${activeStatus === tab.value ? 'tabs__item--active' : ''}`}
                  onClick={() => {
                    setActiveStatus(tab.value);
                    setCurrentPage(1);
                  }}
                >
                  {tab.label}
                  <span className="order-list-tabs__count">{statusCounts[tab.value || ''] || 0}</span>
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
                  <th style={{ minWidth: 170 }}>代理商</th>
                  <th style={{ minWidth: 240 }}>驾照信息</th>
                  <th style={{ minWidth: 260 }}>收货地址</th>
                  {showRejectReasonColumn && <th style={{ minWidth: 220 }}>驳回原因</th>}
                  <th style={{ minWidth: 170 }}>订单状态</th>
                  <th style={{ minWidth: 168 }}>操作</th>
                </tr>
              </thead>

              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={orderTableColumnCount} className="empty-state">
                      <div className="empty-state__icon">暂无</div>
                      <div className="empty-state__text">{t('common.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const translationStatus = getTranslationOrderStatus(order.status);
                    const detailNavigationState = {
                      from: '/orders',
                      listLabel: '翻译订单管理',
                    };
                    const viewPath = `/orders/${order.orderId}?mode=view`;
                    const auditPath = `/orders/${order.orderId}?mode=audit`;

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
                            <div className={getOrderProcessLineClassName(order)}>
                              <span className="order-process-line__dot" />
                              <span>{getOrderProcessTypeLabel(order)}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="order-agent-name">{getAgentName(order)}</div>
                        </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                                <span className="order-cell-label">中文姓名：</span>
                                <span className="order-cell-value">
                                  {order.domesticLicenseInfo?.chineseName || getLicenseName(order)}
                                </span>
                              </div>
                              <div>
                                <span className="order-cell-label">
                                  {order.domesticLicenseInfo ? 'DL/驾驶证编号：' : '驾照号：'}
                                </span>
                                <span className="order-cell-value">
                                  {order.domesticLicenseInfo?.licenseNumber || getLicenseNo(order)}
                                </span>
                              </div>
                              <div>
                                <span className="order-cell-label">准驾车型：</span>
                                <span className="order-license-badge">
                                  {order.domesticLicenseInfo?.classType || getLicenseCategory(order)}
                                </span>
                              </div>
                              {order.domesticLicenseInfo && (
                                <>
                                  <div>
                                    <span className="order-cell-label">换证城市：</span>
                                    <span className="order-cell-value">{getDomesticExchangeCity(order) || '--'}</span>
                                  </div>
                                  <div>
                                    <span className="order-cell-label">驾照发放国家及城市：</span>
                                    <span className="order-cell-value">{getDomesticForeignLocation(order) || '--'}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
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
                          </div>
                        </td>

                        {showRejectReasonColumn && (
                          <td>
                            <div className="order-cell-stack order-cell-stack--compact">
                              <div className="order-cell-value">{getRejectReason(order)}</div>
                            </div>
                          </td>
                        )}

                        <td>
                          <div className="order-status-cell">
                            <span className={`${statusTagClass(order.status)} order-list-status-tag`}>
                              {t(`order.status.${translationStatus}`)}
                            </span>
                            {translationStatus === 'shipped' && order.trackingNumber && (
                              <div className="order-logistics-inline order-logistics-inline--status">
                                <span>{order.logisticsCompany || '物流已发出'}</span>
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
                          {translationStatus !== 'cancelled' && (
                            <button
                              type="button"
                              className={`order-text-action ${
                                order.status === 'pending_review'
                                  ? 'order-text-action--audit'
                                  : 'order-text-action--review'
                              }`}
                              onClick={() => navigate(auditPath, { state: detailNavigationState })}
                            >
                              {order.status === 'pending_review' ? '订单审核' : '查看审核'}
                            </button>
                          )}
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

export default TranslationOrderList;
