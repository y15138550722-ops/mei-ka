import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../shared/i18n/config';
import {
  getNotaryOfficeOrders,
  syncNotaryOfficeCompletionToManagement,
  updateNotaryOfficeOrder,
} from '../../services/notaryOfficeOrderService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import type { Order, OrderStatus } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';

const NOTARY_SOURCE_STATUSES: OrderStatus[] = [
  'pending_review',
  'in_production',
  'shipped',
  'completed',
  'rejected',
];

const NOTARY_VISIBLE_STATUSES: OrderStatus[] = [
  'pending_review',
  'in_production',
  'completed',
  'rejected',
];

const NOTARY_PRODUCT_OPTIONS = ['公证单号', '公证双号', '公证海牙单号', '公证海牙双号'];

const NOTARY_DOWNLOAD_TEMPLATE_PATHS = [
  encodeURI('/Notary Office Template/姓名+国家+语言+产品名称.zip'),
  encodeURI('/Preview file/姓名+国家+语言+产品名称.zip'),
];

const NOTARY_LANGUAGE_COUNTRY_MAP: Record<string, string> = {
  英语: '美国',
  法语: '法国',
  德语: '德国',
  日语: '日本',
};

const getCurrentTimestamp = () => formatBeijingTimestamp();

const getNotaryVisibleStatus = (status: OrderStatus): OrderStatus => {
  if (status === 'translating' || status === 'pending_production') return 'in_production';
  if (status === 'shipped') return 'completed';
  return status;
};

const getInitialNotaryFilterStatus = (status: string | null): OrderStatus | '' => {
  if (!status) return '';
  if (status === 'translating' || status === 'pending_production') return 'in_production';
  if (status === 'shipped') return 'completed';
  return NOTARY_VISIBLE_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : '';
};

const sanitizeDownloadPart = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim();

const getNotaryCountryLabel = (order: Order) => {
  if (order.language && NOTARY_LANGUAGE_COUNTRY_MAP[order.language]) {
    return NOTARY_LANGUAGE_COUNTRY_MAP[order.language];
  }

  return '国家未设置';
};

const buildNotaryZipFilename = (order: Order) => {
  const parts = [
    order.licenseName || order.customerName || '姓名未设置',
    getNotaryCountryLabel(order),
    order.language || '语种未设置',
    order.productName || '产品未设置',
  ].map(sanitizeDownloadPart);

  return `${parts.join('+')}.zip`;
};

const getNotaryOrderShippedSortValue = (order: Order) => {
  if (order.shippedAt?.trim()) return order.shippedAt.trim();

  const logisticsLog = [...order.logs].reverse().find((log) => /录入物流单号|填写物流/.test(log.action));
  if (logisticsLog?.time?.trim()) return logisticsLog.time.trim();

  if ((order.status === 'shipped' || order.status === 'completed') && order.updatedAt?.trim()) {
    return order.updatedAt.trim();
  }

  return '';
};

const getNotaryOrderSortValue = (order: Order) => {
  if (getNotaryVisibleStatus(order.status) === 'completed') {
    const shippedSortValue = getNotaryOrderShippedSortValue(order);
    if (shippedSortValue) {
      return shippedSortValue;
    }
  }

  if (order.updatedAt?.trim()) return order.updatedAt.trim();
  if (order.createdAt?.trim()) return order.createdAt.trim();

  return '';
};

const getNotaryStatusTagClass = (status: OrderStatus) => {
  const map: Record<OrderStatus, string> = {
    translating: 'warning',
    pending_review: 'pending',
    pending_production: 'processing',
    in_production: 'warning',
    shipped: 'shipped',
    completed: 'completed',
    cancelled: 'cancelled',
    rejected: 'rejected',
  };

  return `tag tag--${map[status] || 'pending'}`;
};

const getRejectReason = (order: Order) => {
  const directReason = order.rejectReason?.trim();
  if (directReason) {
    return directReason;
  }

  if (order.status === 'rejected' && order.remark?.trim()) {
    return order.remark.trim();
  }

  const rejectLog = [...order.logs].reverse().find((log) => /驳回|拒绝/.test(log.action));
  if (!rejectLog) {
    return '-';
  }

  const parts = rejectLog.action.split(/[:：]/);
  return parts.length > 1 ? parts.slice(1).join('：').trim() || rejectLog.action : rejectLog.action;
};

const NotaryOrderList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQueryStatus = useMemo(() => getInitialNotaryFilterStatus(searchParams.get('status')), [searchParams]);

  const [allOrders, setAllOrders] = useState<Order[]>(() => getNotaryOfficeOrders());
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>(currentQueryStatus);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterName, setFilterName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFilterStatus(currentQueryStatus);
    setCurrentPage(1);
  }, [currentQueryStatus]);

  const notaryOrders = useMemo(
    () =>
      allOrders.filter(
        (order) => order.productCategory === 'notary' && NOTARY_SOURCE_STATUSES.includes(order.status),
      ),
    [allOrders],
  );

  const filteredOrders = useMemo(() => {
    const trimmedName = filterName.trim().toLowerCase();

    const nextOrders = notaryOrders.filter((order) => {
      if (filterStatus && getNotaryVisibleStatus(order.status) !== filterStatus) return false;
      if (filterProduct && order.productName !== filterProduct) return false;

      if (trimmedName) {
        const searchableName = `${order.licenseName || ''} ${order.customerName || ''}`.toLowerCase();
        if (!searchableName.includes(trimmedName)) {
          return false;
        }
      }

      return true;
    });

    return [...nextOrders].sort((left, right) => {
      const sortResult = getNotaryOrderSortValue(right).localeCompare(getNotaryOrderSortValue(left));
      if (sortResult !== 0) {
        return sortResult;
      }

      return right.orderId.localeCompare(left.orderId);
    });
  }, [filterName, filterProduct, filterStatus, notaryOrders]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const activeBatchStatus: OrderStatus | null = filterStatus === 'in_production' ? 'in_production' : null;
  const showBatchSelection = activeBatchStatus !== null;
  const selectedOrderIdSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);
  const selectableOrdersOnPage = useMemo(
    () =>
      activeBatchStatus
        ? paginatedOrders.filter((order) => getNotaryVisibleStatus(order.status) === activeBatchStatus)
        : [],
    [activeBatchStatus, paginatedOrders],
  );
  const selectableOrderIdsOnPage = useMemo(
    () => selectableOrdersOnPage.map((order) => order.orderId),
    [selectableOrdersOnPage],
  );
  const selectedOrders = useMemo(
    () =>
      activeBatchStatus
        ? filteredOrders.filter(
            (order) => getNotaryVisibleStatus(order.status) === activeBatchStatus && selectedOrderIdSet.has(order.orderId),
          )
        : [],
    [activeBatchStatus, filteredOrders, selectedOrderIdSet],
  );
  const selectedCountOnPage = useMemo(
    () => selectableOrderIdsOnPage.filter((orderId) => selectedOrderIdSet.has(orderId)).length,
    [selectableOrderIdsOnPage, selectedOrderIdSet],
  );
  const isAllSelectedOnPage =
    selectableOrderIdsOnPage.length > 0 && selectedCountOnPage === selectableOrderIdsOnPage.length;
  const isPartiallySelectedOnPage = selectedCountOnPage > 0 && !isAllSelectedOnPage;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isPartiallySelectedOnPage;
    }
  }, [isPartiallySelectedOnPage]);

  useEffect(() => {
    setSelectedOrderIds((prev) => {
      if (!activeBatchStatus) {
        return prev.length === 0 ? prev : [];
      }

      return prev.filter((orderId) =>
        allOrders.some((order) => order.orderId === orderId && getNotaryVisibleStatus(order.status) === activeBatchStatus),
      );
    });
  }, [activeBatchStatus, allOrders]);

  const showRejectReasonColumn = filterStatus === 'rejected';
  const orderTableColumnCount = 6 + (showRejectReasonColumn ? 1 : 0) + (showBatchSelection ? 1 : 0);

  const applyOrderPatches = (patches: Record<string, Partial<Order>>) => {
    Object.entries(patches).forEach(([orderId, patch]) => {
      updateNotaryOfficeOrder(orderId, patch);
    });

    setAllOrders((prev) =>
      prev.map((order) => (patches[order.orderId] ? { ...order, ...patches[order.orderId] } : order)),
    );
  };

  const fetchNotaryDownloadTemplate = async () => {
    for (const templatePath of NOTARY_DOWNLOAD_TEMPLATE_PATHS) {
      try {
        const response = await fetch(templatePath);

        if (response.ok) {
          return response.blob();
        }
      } catch {
        continue;
      }
    }

    throw new Error('Failed to download zip template');
  };

  const triggerNotaryZipDownload = (downloadUrl: string, filename: string) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  const buildProductionOrderPatch = (order: Order, action: string): Partial<Order> => {
    const currentTime = getCurrentTimestamp();

    return {
      status: 'in_production',
      updatedAt: currentTime,
      logs: [
        ...order.logs,
        {
          time: currentTime,
          operator: '公证专员',
          action,
        },
      ],
    };
  };

  const buildCompletedOrderPatch = (order: Order, completedAt = getCurrentTimestamp()): Partial<Order> => {
    const currentTime = completedAt;

    return {
      status: 'completed',
      updatedAt: currentTime,
      logs: [
        ...order.logs,
        {
          time: currentTime,
          operator: '公证专员',
          action: '制作完成',
        },
      ],
    };
  };

  const handleStatusChange = (status: OrderStatus | '') => {
    setFilterStatus(status);
    setSearchParams(status ? { status } : {});
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilterProduct('');
    setFilterName('');
    setCurrentPage(1);
  };

  const handleProduceAndDownload = async (orderId: string) => {
    const targetOrder = allOrders.find((order) => order.orderId === orderId);
    if (!targetOrder) return;

    try {
      const blob = await fetchNotaryDownloadTemplate();
      const downloadUrl = window.URL.createObjectURL(blob);

      triggerNotaryZipDownload(downloadUrl, buildNotaryZipFilename(targetOrder));
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);

      applyOrderPatches({
        [orderId]: buildProductionOrderPatch(targetOrder, '下载制作文件'),
      });
    } catch {
      window.alert('压缩包模板下载失败，请稍后重试');
    }
  };

  const handleMarkCompleted = (orderId: string) => {
    const targetOrder = allOrders.find((order) => order.orderId === orderId);
    if (!targetOrder) return;
    const completedAt = getCurrentTimestamp();
    const completedPatch = buildCompletedOrderPatch(targetOrder, completedAt);

    applyOrderPatches({
      [orderId]: completedPatch,
    });
    syncNotaryOfficeCompletionToManagement(
      {
        ...targetOrder,
        ...completedPatch,
      } as Order,
      {
        operator: '公证专员',
        completedAt,
      },
    );
  };

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((item) => item !== orderId) : [...prev, orderId],
    );
  };

  const handleToggleSelectAllOnPage = () => {
    if (selectableOrderIdsOnPage.length === 0) return;

    setSelectedOrderIds((prev) => {
      const next = new Set(prev);

      if (isAllSelectedOnPage) {
        selectableOrderIdsOnPage.forEach((orderId) => next.delete(orderId));
      } else {
        selectableOrderIdsOnPage.forEach((orderId) => next.add(orderId));
      }

      return Array.from(next);
    });
  };

  const handleBatchMarkCompleted = () => {
    if (selectedOrders.length === 0) {
      window.alert('请先选择制作中的订单');
      return;
    }

    const completedPatches = Object.fromEntries(
      selectedOrders.map((order) => {
        const completedAt = getCurrentTimestamp();
        const completedPatch = buildCompletedOrderPatch(order, completedAt);

        syncNotaryOfficeCompletionToManagement(
          {
            ...order,
            ...completedPatch,
          } as Order,
          {
            operator: '公证专员',
            completedAt,
          },
        );

        return [order.orderId, completedPatch];
      }),
    );

    applyOrderPatches(completedPatches);
    setSelectedOrderIds([]);
  };

  const handleBatchProduceAndDownload = async () => {
    if (selectedOrders.length === 0) {
      window.alert('请先选择制作中的订单');
      return;
    }

    try {
      const blob = await fetchNotaryDownloadTemplate();
      const downloadUrl = window.URL.createObjectURL(blob);

      selectedOrders.forEach((order) => {
        triggerNotaryZipDownload(downloadUrl, buildNotaryZipFilename(order));
      });

      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);

      applyOrderPatches(
        Object.fromEntries(
          selectedOrders.map((order) => [
            order.orderId,
            buildProductionOrderPatch(order, '批量下载制作文件'),
          ]),
        ),
      );
      setSelectedOrderIds([]);
    } catch {
      window.alert('压缩包模板下载失败，请稍后重试');
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': notaryOrders.length };
    NOTARY_VISIBLE_STATUSES.forEach((status) => {
      counts[status] = notaryOrders.filter((order) => getNotaryVisibleStatus(order.status) === status).length;
    });
    return counts;
  }, [notaryOrders]);

  const statusTabs: Array<{ label: string; value: OrderStatus | '' }> = [
    { label: t('common.all'), value: '' },
    { label: t('order.status.pending_review'), value: 'pending_review' },
    { label: t('order.status.in_production'), value: 'in_production' },
    { label: t('order.status.completed'), value: 'completed' },
    { label: t('order.status.rejected'), value: 'rejected' },
  ];

  const activeFilterCount = [filterProduct, filterName.trim()].filter(Boolean).length;

  return (
    <div className="app-main animate-fadeIn order-list-page notary-order-list-page">
      <div className="app-topbar">
        <div className="order-list-topbar">
          <div className="app-topbar__breadcrumb">
            后台管理
            <span>/</span>
            公证订单
          </div>
          <div className="order-list-topbar__accent" />
        </div>
        <h1 className="app-topbar__title">公证订单</h1>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel">
          <div className="order-filter-panel__header">
            <div>
              <div className="order-filter-panel__title">筛选条件</div>
            </div>
            <div className="order-filter-panel__summary">
              <span className="order-filter-panel__summary-main">共 {filteredOrders.length} 条结果</span>
              <span>{activeFilterCount > 0 ? `已启用 ${activeFilterCount} 项筛选` : '当前未启用筛选条件'}</span>
            </div>
          </div>

          <div className="order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">产品</label>
              <select className="form-select" value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                <option value="">{t('common.all')}</option>
                {NOTARY_PRODUCT_OPTIONS.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">姓名</label>
              <input
                className="form-input"
                value={filterName}
                placeholder="请输入姓名"
                onChange={(event) => setFilterName(event.target.value)}
              />
            </div>

            <div className="order-filter-actions order-filter-actions--inline notary-order-list__filter-actions">
              <button type="button" className="btn btn--primary" onClick={handleSearch}>
                搜索
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleReset}>
                重置
              </button>
            </div>
          </div>
        </div>

        <div className="card order-list-card">
          <div className="order-list-card__tabs-row">
            <div className="tabs order-list-tabs">
              {statusTabs.map((tab) => (
                <div
                  key={tab.value || 'all'}
                  className={`tabs__item ${filterStatus === tab.value ? 'tabs__item--active' : ''}`}
                  onClick={() => handleStatusChange(tab.value)}
                >
                  {tab.label}
                  <span className="order-list-tabs__count">{statusCounts[tab.value || ''] || 0}</span>
                </div>
              ))}
            </div>

            {filterStatus === 'in_production' && (
              <div className="order-list-tabs__action notary-order-list__batch-action">
                <span className="notary-order-list__batch-summary">
                  已选择 <strong>{selectedOrders.length}</strong> 条制作中订单
                </span>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={selectedOrders.length === 0}
                  onClick={handleBatchMarkCompleted}
                >
                  批量制作完成
                </button>
              </div>
            )}
          </div>

          <div className="table-wrapper">
            <table className="data-table order-list-table">
              <thead>
                <tr>
                  {showBatchSelection && (
                    <th style={{ width: 56, textAlign: 'center' }}>
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={isAllSelectedOnPage}
                        disabled={selectableOrderIdsOnPage.length === 0}
                        onChange={handleToggleSelectAllOnPage}
                        aria-label="Select all current page orders"
                      />
                    </th>
                  )}
                  <th style={{ width: 60 }}>序号</th>
                  <th>产品</th>
                  <th>{t('notary.field.licenseInfo')}</th>
                  <th style={{ minWidth: '300px' }}>收货信息</th>
                  {showRejectReasonColumn && <th style={{ minWidth: '240px' }}>驳回原因</th>}
                  <th>{t('order.field.status')}</th>
                  <th>{t('common.operate')}</th>
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
                  paginatedOrders.map((order, index) => {
                    const visibleStatus = getNotaryVisibleStatus(order.status);

                    return (
                      <tr key={order.orderId} className="order-list-row">
                        {showBatchSelection && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedOrderIdSet.has(order.orderId)}
                              onChange={() => handleToggleOrderSelection(order.orderId)}
                              aria-label={`选择订单 ${order.orderId}`}
                            />
                          </td>
                        )}

                        <td>{(currentPage - 1) * pageSize + index + 1}</td>

                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{order.productName}</div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-text-secondary)',
                              marginTop: '6px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn--warning btn--sm"
                              disabled
                              style={{
                                minHeight: '26px',
                                padding: '2px 10px',
                                fontSize: '12px',
                                cursor: 'default',
                                boxShadow: 'none',
                                opacity: 1,
                                pointerEvents: 'none',
                              }}
                            >
                              {order.language || '-'}
                            </button>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                            <div>姓名：{order.licenseName || order.customerName}</div>
                            <div>驾照号：{order.licenseNo || '-'}</div>
                            <div>准驾车型：{order.licenseCategory || '-'}</div>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                            <div>收货人：{order.customerName}</div>
                            <div>手机号：{order.customerPhone}</div>
                            <div>收货地址：{order.deliveryAddress}</div>
                          </div>
                        </td>

                        {showRejectReasonColumn && (
                          <td>
                            <div style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--color-text-primary)' }}>
                              {getRejectReason(order)}
                            </div>
                          </td>
                        )}

                        <td>
                          <span className={getNotaryStatusTagClass(visibleStatus)}>
                            {t(`order.status.${visibleStatus}`)}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {order.status === 'pending_review' && (
                              <button
                                type="button"
                                className="btn btn--warning btn--sm"
                                onClick={() => navigate(`/notary/orders/${order.orderId}/preview`)}
                              >
                                {t('order.action.preview')}
                              </button>
                            )}

                            {visibleStatus === 'in_production' && (
                              <button
                                type="button"
                                className="btn btn--warning btn--sm"
                                onClick={() => void handleProduceAndDownload(order.orderId)}
                              >
                                {t('order.action.produceAndDownload')}
                              </button>
                            )}

                            {visibleStatus === 'in_production' && (
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                onClick={() => handleMarkCompleted(order.orderId)}
                              >
                                制作完成
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '0 24px' }}>
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

export default NotaryOrderList;
