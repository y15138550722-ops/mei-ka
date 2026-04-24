import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, getProducts } from '../../services/mockDataService';
import { useTranslation } from '../../shared/i18n/config';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { exportTranslationOrders } from '../../shared/utils/exportTranslationOrders';
import {
  IDP_STATUS_TABS,
  type IdpVisibleStatus,
  getAgentName,
  getExportErrorMessage,
  getIdpCreatedAtDisplay,
  getIdpNamePinyin,
  getIdpNationalityDisplay,
  getIdpOrderPushTime,
  getIdpValidityYears,
  getIdpVisibleStatus,
  getLicenseInfo,
  getLicenseName,
  getOrderDestinationCountry,
  getOrderIssuingRegion,
  getOrderListExportFileName,
  getOrderShippedSortValue,
  getRecipientInfo,
  statusTagClass,
} from './orderListShared';

const IdpOrderList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  const idpProducts = useMemo(
    () => getProducts().filter((product) => product.category === 'idp').sort((a, b) => b.weight - a.weight),
    [],
  );
  const allOrders = useMemo(
    () => getOrders().filter((order) => order.productCategory === 'idp'),
    [],
  );

  const [activeStatus, setActiveStatus] = useState<IdpVisibleStatus | ''>('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const productOptions = useMemo(() => idpProducts.map((product) => product.title), [idpProducts]);

  const filteredOrders = useMemo(() => {
    const keyword = filterKeyword.trim().toLowerCase();
    const agentKeyword = filterAgent.trim().toLowerCase();

    const nextOrders = allOrders.filter((order) => {
      const createdDate = order.createdAt.slice(0, 10);

      if (activeStatus && getIdpVisibleStatus(order) !== activeStatus) return false;
      if (agentKeyword && !getAgentName(order).toLowerCase().includes(agentKeyword)) return false;
      if (filterProduct && order.productName !== filterProduct) return false;
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;

      if (keyword) {
        const searchableText = [
          order.orderId,
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

  const selectedOrderIdSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);
  const selectableOrderIdsOnPage = useMemo(
    () => paginatedOrders.map((order) => order.orderId),
    [paginatedOrders],
  );
  const isAllSelectedOnPage =
    selectableOrderIdsOnPage.length > 0 && selectableOrderIdsOnPage.every((orderId) => selectedOrderIdSet.has(orderId));
  const isPartiallySelectedOnPage =
    selectableOrderIdsOnPage.some((orderId) => selectedOrderIdSet.has(orderId)) && !isAllSelectedOnPage;

  useEffect(() => {
    setSelectedOrderIds((currentIds) => currentIds.filter((orderId) => allOrders.some((order) => order.orderId === orderId)));
  }, [allOrders]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isPartiallySelectedOnPage;
    }
  }, [isPartiallySelectedOnPage]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<IdpVisibleStatus | '', number>> = { '': allOrders.length };
    IDP_STATUS_TABS.forEach((tab) => {
      if (tab.value) {
        counts[tab.value] = allOrders.filter((order) => getIdpVisibleStatus(order) === tab.value).length;
      }
    });
    return counts;
  }, [allOrders]);

  const activeFilterCount = [activeStatus, filterAgent, filterProduct, filterKeyword, filterStartDate, filterEndDate].filter(Boolean)
    .length;

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

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((currentIds) =>
      currentIds.includes(orderId) ? currentIds.filter((currentId) => currentId !== orderId) : [...currentIds, orderId],
    );
  };

  const handleToggleSelectAllOnPage = () => {
    if (selectableOrderIdsOnPage.length === 0) {
      return;
    }

    setSelectedOrderIds((currentIds) => {
      if (isAllSelectedOnPage) {
        return currentIds.filter((orderId) => !selectableOrderIdsOnPage.includes(orderId));
      }

      return Array.from(new Set([...currentIds, ...selectableOrderIdsOnPage]));
    });
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      await exportTranslationOrders(
        filteredOrders.map((order) => ({
          orderId: order.orderId,
          createdAt: order.createdAt,
          productName: order.productName,
          processTypeLabel: 'IDP订单',
          agentName: getAgentName(order),
          recipientInfo: getRecipientInfo(order),
          licenseInfo: getLicenseInfo(order),
          statusLabel: getIdpVisibleStatus(order) === 'pending_review' ? '待审核' : '已完成',
          logisticsInfo: getIdpOrderPushTime(order) ? `订单推送时间：${getIdpOrderPushTime(order)}` : '--',
          price: order.lockedPrice,
          primaryAccount: '',
        })),
        getOrderListExportFileName('IDP订单列表'),
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
            IDP订单管理
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
                placeholder="订单号、姓名、手机号…"
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
              {IDP_STATUS_TABS.map((tab) => (
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
                  <th style={{ width: 56, textAlign: 'center' }}>
                    <input
                      ref={selectAllCheckboxRef}
                      type="checkbox"
                      checked={isAllSelectedOnPage}
                      disabled={selectableOrderIdsOnPage.length === 0}
                      onChange={handleToggleSelectAllOnPage}
                      aria-label="全选当前页订单"
                    />
                  </th>
                  <th style={{ width: 140 }}>订单ID</th>
                  <th style={{ minWidth: 220 }}>产品</th>
                  <th style={{ minWidth: 170 }}>代理商</th>
                  <th style={{ minWidth: 240 }}>驾驶信息</th>
                  <th style={{ minWidth: 140 }}>订单状态</th>
                  <th style={{ minWidth: 220 }}>订单记录</th>
                  <th style={{ minWidth: 220 }}>顾客信息</th>
                  <th style={{ minWidth: 168 }}>操作</th>
                </tr>
              </thead>

              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      <div className="empty-state__icon">暂无</div>
                      <div className="empty-state__text">{t('common.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const visibleStatus = getIdpVisibleStatus(order);
                    const detailNavigationState = {
                      from: '/order-management/idp-orders',
                      listLabel: 'IDP订单管理',
                    };
                    const viewPath = `/order-management/idp-orders/${order.orderId}?mode=view`;
                    const auditPath = `/order-management/idp-orders/${order.orderId}?mode=audit`;
                    const templatePreviewPath = `/order-management/idp-orders/${order.orderId}/templates`;
                    const createdAtDisplay = getIdpCreatedAtDisplay(order);
                    const pushTime = getIdpOrderPushTime(order);

                    return (
                      <tr key={order.orderId} className="order-list-row">
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedOrderIdSet.has(order.orderId)}
                            onChange={() => handleToggleOrderSelection(order.orderId)}
                            aria-label={`选择订单 ${order.orderId}`}
                          />
                        </td>

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

                        <td>
                          <div className="order-cell-stack">
                            <div className="order-cell-primary">{order.productName}</div>
                          </div>
                        </td>

                        <td>
                          <div className="order-agent-name">{getAgentName(order)}</div>
                        </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                              <span className="order-cell-label">姓名：</span>
                              <span className="order-cell-value">
                                {getLicenseName(order)} / {getIdpNamePinyin(order)}
                              </span>
                            </div>
                            <div className="idp-order-driving__highlight">IDP有效期：{getIdpValidityYears(order)}</div>
                            <div className="idp-order-driving__chips">
                              <span className="idp-order-driving__chip">芯片卡</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="order-status-cell order-status-cell--compact">
                            <span
                              className={`${statusTagClass(order.status)} order-list-status-tag ${
                                visibleStatus === 'pending_review'
                                  ? 'order-list-status-tag--idp-pending'
                                  : 'order-list-status-tag--idp-completed'
                              }`}
                            >
                              {visibleStatus === 'pending_review' ? '待审核' : '已完成'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                              <span className="order-cell-label">订单创建时间：</span>
                              <span className="order-cell-value">{createdAtDisplay.date}</span>
                            </div>
                            <div>
                              <span className="order-cell-value">{createdAtDisplay.time}</span>
                            </div>
                            {pushTime && (
                              <div>
                                <span className="order-cell-label">订单推送时间：</span>
                                <span className="order-cell-value">{pushTime}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                              <span className="order-cell-label">国籍：</span>
                              <span className="order-cell-value">{getIdpNationalityDisplay(order)}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">驾照签发地：</span>
                              <span className="order-cell-value">{getOrderIssuingRegion(order)}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">目的地国家：</span>
                              <span className="order-cell-value">{getOrderDestinationCountry(order)}</span>
                            </div>
                          </div>
                        </td>

                        <td className="order-actions-cell order-actions-cell--inline">
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
                              visibleStatus === 'pending_review'
                                ? 'order-text-action--review'
                                : 'order-text-action--view'
                            }`}
                            onClick={() =>
                              navigate(visibleStatus === 'pending_review' ? auditPath : templatePreviewPath, {
                                state: detailNavigationState,
                              })
                            }
                          >
                            {visibleStatus === 'pending_review' ? '订单审核' : '更多'}
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

export default IdpOrderList;
