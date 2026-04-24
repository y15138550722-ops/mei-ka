import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getOrders } from '../../services/mockDataService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { useTranslation } from '../../shared/i18n/config';
import type { AgentLevel, Order, OrderStatus, ProcessType } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { exportTranslationOrders } from '../../shared/utils/exportTranslationOrders';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';

type NotaryManagementStatus = 'pending_review' | 'pending_production' | 'shipped' | 'cancelled';

const NOTARY_ORDER_MANAGEMENT_PATH = '/order-management/notary-orders';

const STATUS_TABS: Array<{ label: string; value: NotaryManagementStatus | '' }> = [
  { label: '全部订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '待制作', value: 'pending_production' },
  { label: '已发货', value: 'shipped' },
  { label: '已取消', value: 'cancelled' },
];

const NOTARY_PRODUCT_OPTIONS = ['公证单号', '公证双号', '公证海牙单号', '公证海牙双号'];

const PROCESS_TYPE_OPTIONS: Array<{ value: ProcessType; label: string }> = [
  { value: 'normal', label: '普通办理' },
  { value: 'priority', label: '优先办理' },
  { value: 'urgent', label: '加急办理' },
];

const NOTARY_SOURCE_STATUSES: OrderStatus[] = [
  'pending_review',
  'pending_production',
  'in_production',
  'shipped',
  'completed',
  'cancelled',
  'rejected',
];

const AGENT_NAMES: Record<AgentLevel, string> = {
  self: '美卡自营',
  l1: '上海美卡服务中心',
  l2: '常州语联翻译有限公司',
  l3: '深圳万里行服务中心',
};

const getInitialStatus = (value: string | null): NotaryManagementStatus | '' => {
  if (!value) return '';

  if (value === 'pending_review' || value === 'pending_production' || value === 'shipped' || value === 'cancelled') {
    return value;
  }

  return '';
};

const getManagementStatus = (status: OrderStatus): NotaryManagementStatus => {
  const mapping: Record<OrderStatus, NotaryManagementStatus> = {
    translating: 'pending_review',
    pending_review: 'pending_review',
    pending_production: 'pending_production',
    in_production: 'pending_production',
    shipped: 'shipped',
    completed: 'shipped',
    cancelled: 'cancelled',
    rejected: 'cancelled',
  };

  return mapping[status];
};

const getStatusTagClass = (status: OrderStatus) => {
  const mapping: Record<NotaryManagementStatus, string> = {
    pending_review: 'pending',
    pending_production: 'processing',
    shipped: 'shipped',
    cancelled: 'cancelled',
  };

  return `tag tag--${mapping[getManagementStatus(status)]}`;
};

const getAgentName = (order: Order) => AGENT_NAMES[order.agentLevel] || '美卡自营';
const getLicenseName = (order: Order) => order.licenseName || order.customerName || '--';
const getLicenseNo = (order: Order) => order.licenseNo || order.customerPassport || '--';
const getLicenseCategory = (order: Order) => order.licenseCategory || '--';

const joinSegments = (segments: Array<string | undefined>) =>
  segments.filter((segment): segment is string => Boolean(segment && segment.trim())).join('，');

const getRecipientInfo = (order: Order) =>
  joinSegments([
    `收件人：${order.customerName}`,
    order.customerPhone ? `手机号：${order.customerPhone}` : undefined,
    order.deliveryAddress ? `地址：${order.deliveryAddress}` : undefined,
  ]);

const getLicenseInfo = (order: Order) =>
  joinSegments([
    `姓名：${getLicenseName(order)}`,
    getLicenseNo(order) ? `驾照号：${getLicenseNo(order)}` : undefined,
    getLicenseCategory(order) ? `准驾车型：${getLicenseCategory(order)}` : undefined,
  ]);

const getLogisticsInfo = (order: Order) =>
  joinSegments([
    order.logisticsCompany ? `物流公司：${order.logisticsCompany}` : undefined,
    order.trackingNumber ? `物流单号：${order.trackingNumber}` : undefined,
  ]);

const getPushedNotaryOfficeName = (order: Order) => {
  const directName = order.pushedNotaryOfficeName?.trim();
  if (directName) {
    return directName;
  }

  const pushLog = [...order.logs].reverse().find((log) => /推送至/.test(log.action));
  const matchedName = pushLog?.action.match(/推送至(.+)$/)?.[1]?.trim();
  return matchedName || '--';
};

const getRejectReason = (order: Order) => {
  const directReason = order.rejectReason?.trim();
  if (directReason) {
    return directReason;
  }

  if (order.remark?.trim() && getManagementStatus(order.status) === 'cancelled') {
    return order.remark.trim();
  }

  const rejectLog = [...order.logs].reverse().find((log) => /驳回|拒绝/.test(log.action));
  if (!rejectLog) {
    return '--';
  }

  const matchedReason = rejectLog.action.match(/(?:驳回|拒绝)[：:]\s*(.+)$/)?.[1]?.trim();
  return matchedReason || rejectLog.action;
};

const getShippedSortValue = (order: Order) => {
  if (order.shippedAt?.trim()) {
    return order.shippedAt.trim();
  }

  const logisticsLog = [...order.logs].reverse().find((log) => /物流|发货/.test(log.action));
  if (logisticsLog?.time?.trim()) {
    return logisticsLog.time.trim();
  }

  return order.updatedAt || order.createdAt || '';
};

const getOrderProcessTypeLabel = (order: Order, translate: (key: string) => string) =>
  getProductProcessTypeLabel(order.processType, translate);

const getOrderProcessLineClassName = (order: Order) =>
  `order-process-line order-process-line--${getProcessTypeTone(order.processType)}`;

const buildExportFileName = () => {
  const timestamp = formatBeijingTimestamp().replace(/\s+/g, '_').replace(/:/g, '-');
  return `公证订单管理_${timestamp}.xlsx`;
};

const getExportErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message.includes('template')) {
      return '导出模板加载失败';
    }

    if (
      error.message.includes('initialize Excel export module') ||
      error.message.includes('load Excel export runtime')
    ) {
      return '导出组件加载失败';
    }
  }

  return '导出失败，请稍后重试';
};

const NotaryOrderManagementList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = useMemo(() => getInitialStatus(searchParams.get('status')), [searchParams]);

  const notaryOrders = useMemo(
    () =>
      getOrders()
        .filter(
          (order) =>
            order.productCategory === 'notary' &&
            NOTARY_SOURCE_STATUSES.includes(order.status),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [],
  );

  const [activeStatus, setActiveStatus] = useState<NotaryManagementStatus | ''>(initialStatus);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterProcessType, setFilterProcessType] = useState<ProcessType | ''>('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setActiveStatus(initialStatus);
    setCurrentPage(1);
  }, [initialStatus]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const filteredOrders = useMemo(() => {
    const agentKeyword = filterAgent.trim().toLowerCase();
    const exactKeyword = filterKeyword.trim().toLowerCase();

    const nextOrders = notaryOrders.filter((order) => {
      const visibleStatus = getManagementStatus(order.status);
      const createdDate = order.createdAt.slice(0, 10);
      const agentName = getAgentName(order).toLowerCase();

      if (activeStatus && visibleStatus !== activeStatus) return false;
      if (filterProduct && order.productName !== filterProduct) return false;
      if (filterProcessType && getProcessTypeTone(order.processType) !== filterProcessType) return false;
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;
      if (agentKeyword && !agentName.includes(agentKeyword)) return false;

      if (exactKeyword) {
        const searchPool = [
          order.orderId,
          order.customerName,
          order.customerPhone,
          order.deliveryAddress,
          order.licenseName,
          order.licenseNo,
          getPushedNotaryOfficeName(order),
          order.trackingNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchPool.includes(exactKeyword)) {
          return false;
        }
      }

      return true;
    });

    if (activeStatus === 'shipped') {
      return [...nextOrders].sort((left, right) => getShippedSortValue(right).localeCompare(getShippedSortValue(left)));
    }

    return nextOrders;
  }, [
    activeStatus,
    filterAgent,
    filterEndDate,
    filterKeyword,
    filterProcessType,
    filterProduct,
    filterStartDate,
    notaryOrders,
  ]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': notaryOrders.length };

    STATUS_TABS.forEach((tab) => {
      if (!tab.value) {
        return;
      }

      counts[tab.value] = notaryOrders.filter((order) => getManagementStatus(order.status) === tab.value).length;
    });

    return counts;
  }, [notaryOrders]);

  const showRejectReasonColumn = activeStatus === 'cancelled';
  const orderTableColumnCount = showRejectReasonColumn ? 10 : 9;
  const activeFilterCount = [
    filterAgent.trim(),
    filterProduct,
    filterProcessType,
    filterStartDate,
    filterEndDate,
    filterKeyword.trim(),
  ].filter(Boolean).length;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  const handleStatusChange = (status: NotaryManagementStatus | '') => {
    setActiveStatus(status);
    setCurrentPage(1);
    setSearchParams(status ? { status } : {});
  };

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilterAgent('');
    setFilterProduct('');
    setFilterProcessType('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterKeyword('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      await exportTranslationOrders(
        filteredOrders.map((order) => ({
          orderId: order.orderId,
          createdAt: order.createdAt,
          productName: `${order.productName} / ${getOrderProcessTypeLabel(order, t)}`,
          processTypeLabel: getOrderProcessTypeLabel(order, t),
          agentName: getAgentName(order),
          recipientInfo: getRecipientInfo(order),
          licenseInfo: getLicenseInfo(order),
          statusLabel: t(`order.status.${getManagementStatus(order.status)}`),
          logisticsInfo: getLogisticsInfo(order),
          price: order.lockedPrice,
          primaryAccount: '',
        })),
        buildExportFileName(),
      );

      showToast('success', '导出成功');
    } catch (error) {
      console.error(error);
      showToast('error', getExportErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const previewState = {
    from: `${NOTARY_ORDER_MANAGEMENT_PATH}${activeStatus ? `?status=${activeStatus}` : ''}`,
  };

  return (
    <div className="app-main animate-fadeIn order-list-page notary-order-management-page">
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
            公证订单管理
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel">
          <div className="order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">代理商</label>
              <input
                className="form-input"
                value={filterAgent}
                onChange={(event) => setFilterAgent(event.target.value)}
                placeholder="请输入代理商名称"
              />
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">产品</label>
              <select className="form-select" value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                <option value="">全部产品</option>
                {NOTARY_PRODUCT_OPTIONS.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field order-filter-field--span-2 notary-order-management-search-field">
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

            <div className="form-group order-filter-field">
              <label className="form-label">办理类型</label>
              <select
                className="form-select"
                value={filterProcessType}
                onChange={(event) => setFilterProcessType(event.target.value as ProcessType | '')}
              >
                <option value="">全部办理类型</option>
                {PROCESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field order-filter-field--span-2">
              <label className="form-label">精准搜索</label>
              <input
                className="form-input"
                value={filterKeyword}
                onChange={(event) => setFilterKeyword(event.target.value)}
                placeholder="订单号、姓名、驾照号、物流单号..."
              />
            </div>

            <div className="order-filter-actions order-filter-actions--inline notary-order-management-search-actions">
              <button className="btn btn--primary" type="button" onClick={handleSearch}>
                搜索
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleReset}>
                重置
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleExport} disabled={isExporting}>
                {isExporting ? '导出中...' : '导出'}
              </button>
            </div>
          </div>
        </div>

        <div className="card order-list-card">
          <div className="order-list-card__tabs-row">
            <div className="tabs order-list-tabs">
              {STATUS_TABS.map((tab) => (
                <div
                  key={tab.value || 'all'}
                  className={`tabs__item ${activeStatus === tab.value ? 'tabs__item--active' : ''}`}
                  onClick={() => handleStatusChange(tab.value)}
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
                  <th style={{ width: 140 }}>订单ID</th>
                  <th style={{ width: 170 }}>下单时间</th>
                  <th style={{ minWidth: 260 }}>产品及办理类型</th>
                  <th style={{ minWidth: 180 }}>代理商</th>
                  <th style={{ minWidth: 220 }}>驾照信息</th>
                  <th style={{ minWidth: 260 }}>收货地址</th>
                  <th style={{ minWidth: 180 }}>推送公证处</th>
                  {showRejectReasonColumn && <th style={{ minWidth: 220 }}>驳回原因</th>}
                  <th style={{ minWidth: 150 }}>订单状态</th>
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
                    const visibleStatus = getManagementStatus(order.status);
                    const viewPath = `${NOTARY_ORDER_MANAGEMENT_PATH}/${order.orderId}/preview?mode=view`;
                    const auditPath = `${NOTARY_ORDER_MANAGEMENT_PATH}/${order.orderId}/preview?mode=audit`;
                    const actionPath = auditPath;

                    return (
                      <tr key={order.orderId} className="order-list-row">
                        <td>
                          <div className="order-cell-stack order-cell-stack--tight">
                            <button
                              className="order-id-link"
                              type="button"
                              onClick={() => navigate(viewPath, { state: previewState })}
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
                              <span>{getOrderProcessTypeLabel(order, t)}</span>
                            </div>
                            <div className="notary-management-language-badge">{order.language || '--'}</div>
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

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div className="order-cell-value">{getPushedNotaryOfficeName(order)}</div>
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
                            <span className={`${getStatusTagClass(order.status)} order-list-status-tag`}>
                              {t(`order.status.${visibleStatus}`)}
                            </span>
                            {visibleStatus === 'shipped' && order.trackingNumber && (
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
                            onClick={() => navigate(viewPath, { state: previewState })}
                          >
                            查看订单
                          </button>
                          {visibleStatus !== 'cancelled' && (
                            <button
                              type="button"
                              className={`order-text-action ${
                                order.status === 'pending_review' ? 'order-text-action--audit' : 'order-text-action--review'
                              }`}
                              onClick={() => navigate(actionPath, { state: previewState })}
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

export default NotaryOrderManagementList;
