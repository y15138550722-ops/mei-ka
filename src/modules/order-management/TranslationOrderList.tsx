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

const TranslationOrderList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const translationProducts = useMemo(
    () => getProducts().filter((product) => product.category === 'translation').sort((a, b) => b.weight - a.weight),
    [],
  );
  const allOrders = useMemo(
    () => getOrders().filter((order) => order.productCategory === 'translation'),
    [],
  );

  const [activeStatus, setActiveStatus] = useState<TranslationOrderStatus | ''>('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
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

  const filteredOrders = useMemo(() => {
    const keyword = filterKeyword.trim().toLowerCase();
    const agentKeyword = filterAgent.trim().toLowerCase();

    const nextOrders = allOrders.filter((order) => {
      const createdDate = order.createdAt.slice(0, 10);

      if (activeStatus && getTranslationOrderStatus(order.status) !== activeStatus) return false;
      if (agentKeyword && !getAgentName(order).toLowerCase().includes(agentKeyword)) return false;
      if (filterProduct && order.productName !== filterProduct) return false;
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;

      if (keyword) {
        const searchableText = [
          order.orderId,
          order.trackingNumber,
          order.customerName,
          order.customerPhone,
          order.customerPassport,
          order.productName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(keyword)) return false;
      }

      return true;
    });

    if (activeStatus === 'shipped') {
      return [...nextOrders].sort((a, b) => getOrderShippedSortValue(b).localeCompare(getOrderShippedSortValue(a)));
    }

    return nextOrders;
  }, [activeStatus, allOrders, filterAgent, filterEndDate, filterKeyword, filterProduct, filterStartDate]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<TranslationOrderStatus | '', number>> = { '': allOrders.length };
    TRANSLATION_STATUS_TABS.forEach((tab) => {
      if (tab.value) {
        counts[tab.value] = allOrders.filter((order) => getTranslationOrderStatus(order.status) === tab.value).length;
      }
    });
    return counts;
  }, [allOrders]);

  const activeFilterCount = [activeStatus, filterAgent, filterProduct, filterKeyword, filterStartDate, filterEndDate].filter(Boolean)
    .length;
  const showRejectReasonColumn = activeStatus === 'cancelled';
  const orderTableColumnCount = showRejectReasonColumn ? 9 : 8;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleReset = () => {
    setFilterAgent('');
    setFilterProduct('');
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
          <div className="order-filter-grid">
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
              <select className="form-select" value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                <option value="">全部产品</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="order-filter-actions order-filter-actions--inline">
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
                              <span className="order-cell-label">姓名：</span>
                              <span className="order-cell-value">{getLicenseName(order)}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">驾照号：</span>
                              <span className="order-cell-value">{getLicenseNo(order)}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">准驾车型：</span>
                              <span className="order-license-badge">{getLicenseCategory(order)}</span>
                            </div>
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
