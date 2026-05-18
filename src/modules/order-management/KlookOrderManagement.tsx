import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '../../services/mockDataService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import { useTranslation } from '../../shared/i18n/config';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import { getKlookOrders, type KlookOrder, type KlookOrderStatus } from './klookOrderService';
import './KlookOrderManagement.css';

interface KlookOrderFilterState {
  agentName: string;
  productName: string;
  processType: string;
  keyword: string;
  startDate: string;
  endDate: string;
}

type ToastState = {
  type: 'success' | 'warning' | 'info';
  message: string;
} | null;

interface KlookOrderManagementProps {
  pageTitle?: string;
  listLabel?: string;
  listPath?: string;
  detailPathPrefix?: string;
  getOrders?: () => KlookOrder[];
  csvFilePrefix?: string;
  targetProductName?: string;
}

const DEFAULT_FILTERS: KlookOrderFilterState = {
  agentName: '',
  productName: '',
  processType: '',
  keyword: '',
  startDate: '',
  endDate: '',
};

const STATUS_LABELS: Record<KlookOrderStatus, string> = {
  pending_review: '待审核',
  pending_production: '待制作',
  shipped: '已发货',
  cancelled: '已取消',
};

const KLOOK_STATUS_TABS: Array<{ label: string; value: KlookOrderStatus | '' }> = [
  { label: '所有订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '待制作', value: 'pending_production' },
  { label: '已发货', value: 'shipped' },
  { label: '已取消', value: 'cancelled' },
];

const KLOOK_TARGET_PRODUCT_NAME = '驾照翻译国际认证件（小白本）';
const PRODUCTION_OPERATOR = '生产端';
const PRODUCTION_NODE_ACTIONS = ['已翻译', '已制作', '已发货'] as const;

const normalizeProductName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\uFF08(][^\uFF08\uFF09()]*[\uFF09)]/g, '')
    .replace(/\s+/g, '');

const matchesProductName = (orderProductName: string, selectedProductName: string) => {
  if (orderProductName === selectedProductName) {
    return true;
  }

  return normalizeProductName(orderProductName) === normalizeProductName(selectedProductName);
};

const matchesProcessType = (orderProcessType: string, selectedProcessType: string) => {
  if (orderProcessType === selectedProcessType) {
    return true;
  }

  return getProcessTypeTone(orderProcessType) === getProcessTypeTone(selectedProcessType);
};

const sortProductsByWeight = <
  T extends {
    weight: number;
    createdAt: string;
  },
>(
  left: T,
  right: T,
) => {
  const weightDiff = right.weight - left.weight;
  if (weightDiff !== 0) return weightDiff;

  return right.createdAt.localeCompare(left.createdAt);
};

const sortProcessTypeOptions = (
  left: { weight?: number; name: string },
  right: { weight?: number; name: string },
) => {
  const weightDiff = (left.weight ?? 0) - (right.weight ?? 0);
  if (weightDiff !== 0) return weightDiff;

  return left.name.localeCompare(right.name, 'zh-CN');
};

const getStatusClassName = (status: KlookOrderStatus) => {
  switch (status) {
    case 'pending_review':
      return 'klook-status-tag klook-status-tag--pending-review';
    case 'pending_production':
      return 'klook-status-tag klook-status-tag--pending-production';
    case 'shipped':
      return 'klook-status-tag klook-status-tag--shipped';
    case 'cancelled':
      return 'klook-status-tag klook-status-tag--cancelled';
    default:
      return 'klook-status-tag';
  }
};

const matchesKeyword = (order: KlookOrder, keyword: string) => {
  if (!keyword) return true;

  const searchableText = [
    order.orderId,
    order.trackingNumber,
    order.driverName,
    order.driverNameLatin,
    order.licenseNumber,
    order.recipientName,
    order.recipientPhone,
    order.deliveryAddress,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes(keyword);
};

const getProductionOrderRecords = (order: KlookOrder) =>
  PRODUCTION_NODE_ACTIONS.flatMap((action) => {
    const log = order.logs.find((item) => item.operator === PRODUCTION_OPERATOR && item.action === action);
    return log
      ? [
          {
            action,
            time: log.time.slice(0, 16),
          },
        ]
      : [];
  });

const downloadCsv = (rows: KlookOrder[], filePrefix: string) => {
  const headers = [
    '订单ID',
    '下单时间',
    '产品',
    '办理类型',
    '代理商',
    '驾驶人',
    '驾照号',
    '收件人',
    '收件电话',
    '收货地址',
    '订单状态',
    '订单记录',
  ];

  const csvRows = rows.map((order) => [
    order.orderId,
    order.createdAt,
    order.productName,
    order.processType,
    order.agentName,
    `${order.driverName}/${order.driverNameLatin}`,
    order.licenseNumber,
    order.recipientName,
    order.recipientPhone,
    order.deliveryAddress,
    STATUS_LABELS[order.status],
    getProductionOrderRecords(order)
      .map((record) => `${record.action} ${record.time}`)
      .join('；'),
  ]);

  const escapeCell = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csvContent = [headers, ...csvRows].map((row) => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
};

const KlookOrderManagement: React.FC<KlookOrderManagementProps> = ({
  pageTitle = 'Klook订单管理',
  listLabel,
  listPath = '/order-management/api-orders/klook',
  detailPathPrefix,
  getOrders = getKlookOrders,
  csvFilePrefix,
  targetProductName = KLOOK_TARGET_PRODUCT_NAME,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedListLabel = listLabel || pageTitle;
  const resolvedDetailPathPrefix = detailPathPrefix || listPath;
  const resolvedCsvFilePrefix = csvFilePrefix || pageTitle;
  const [filters, setFilters] = useState<KlookOrderFilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<KlookOrderFilterState>(DEFAULT_FILTERS);
  const [activeStatus, setActiveStatus] = useState<KlookOrderStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<ToastState>(null);
  const klookOrders = useMemo(() => getOrders(), [getOrders]);

  const klookVisibleOrders = useMemo(
    () => klookOrders.filter((order) => matchesProductName(order.productName, targetProductName)),
    [klookOrders, targetProductName],
  );

  const productOptions = useMemo(
    () =>
      getProducts()
        .filter(
          (product) => product.status === 'active' && matchesProductName(product.title, targetProductName),
        )
        .sort(sortProductsByWeight),
    [targetProductName],
  );
  const klookTargetProduct = useMemo(() => productOptions[0] || null, [productOptions]);
  const processTypeOptions = useMemo(
    () => {
      const sourceProducts = filters.productName
        ? productOptions.filter((product) => product.title === filters.productName)
        : productOptions;

      const processTypeMap = new Map<string, (typeof sourceProducts)[number]['processTypes'][number]>();

      sourceProducts.forEach((product) => {
        product.processTypes.forEach((processType) => {
          if (!processTypeMap.has(processType.name)) {
            processTypeMap.set(processType.name, processType);
          }
        });
      });

      return [...processTypeMap.values()]
        .sort(sortProcessTypeOptions)
        .map((processType) => ({
          value: processType.name,
          label: getProductProcessTypeLabel(processType.name, t),
        }));
    },
    [filters.productName, productOptions, t],
  );

  const filteredOrders = useMemo(() => {
    const keyword = appliedFilters.keyword.trim().toLowerCase();
    const agentName = appliedFilters.agentName.trim().toLowerCase();

    return klookVisibleOrders.filter((order) => {
      const createdDate = order.createdAt.slice(0, 10);

      if (activeStatus && order.status !== activeStatus) return false;
      if (agentName && !order.agentName.toLowerCase().includes(agentName)) return false;
      if (appliedFilters.productName && !matchesProductName(order.productName, appliedFilters.productName)) return false;
      if (appliedFilters.processType && !matchesProcessType(order.processType, appliedFilters.processType)) return false;
      if (appliedFilters.startDate && createdDate < appliedFilters.startDate) return false;
      if (appliedFilters.endDate && createdDate > appliedFilters.endDate) return false;
      if (!matchesKeyword(order, keyword)) return false;

      return true;
    });
  }, [activeStatus, appliedFilters, klookVisibleOrders]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<KlookOrderStatus | '', number>> = { '': klookVisibleOrders.length };

    KLOOK_STATUS_TABS.forEach((tab) => {
      if (tab.value) {
        counts[tab.value] = klookVisibleOrders.filter((order) => order.status === tab.value).length;
      }
    });

    return counts;
  }, [klookVisibleOrders]);

  const getDisplayProductName = () => klookTargetProduct?.title || targetProductName;

  const getDisplayProcessType = (order: KlookOrder) => {
    if (!klookTargetProduct) {
      return order.processType;
    }

    const exactMatched = klookTargetProduct.processTypes.find((processType) => processType.name === order.processType);
    if (exactMatched) {
      return getProductProcessTypeLabel(exactMatched.name, t);
    }

    const toneMatchedProcessTypes = klookTargetProduct.processTypes.filter(
      (processType) => getProcessTypeTone(processType.name, processType.estimatedDays) === getProcessTypeTone(order.processType),
    );

    if (toneMatchedProcessTypes.length === 0) {
      return order.processType;
    }

    const normalizedOrderProcessType = order.processType.toLowerCase();
    const preferredKeywords = normalizedOrderProcessType.includes('顺丰') || normalizedOrderProcessType.includes('加急')
      ? ['顺丰', '加急']
      : normalizedOrderProcessType.includes('普通')
        ? ['普通']
        : normalizedOrderProcessType.includes('优先')
          ? ['优先']
          : [];

    const matchedByKeyword =
      preferredKeywords.length > 0
        ? toneMatchedProcessTypes.find((processType) =>
            preferredKeywords.some((keyword) => processType.name.toLowerCase().includes(keyword.toLowerCase())),
          )
        : null;

    return getProductProcessTypeLabel((matchedByKeyword || toneMatchedProcessTypes[0]).name, t);
  };

  const showToast = (type: 'success' | 'warning' | 'info', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2800);
  };

  const updateFilter = <Key extends keyof KlookOrderFilterState>(key: Key, value: KlookOrderFilterState[Key]) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  };

  const applyLiveFilterPatch = (patch: Partial<KlookOrderFilterState>) => {
    setAppliedFilters((currentFilters) => ({
      ...currentFilters,
      ...patch,
    }));
    setCurrentPage(1);
  };

  const handleProductChange = (productName: string) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      productName,
      processType: '',
    }));
    applyLiveFilterPatch({
      productName,
      processType: '',
    });
  };

  const handleProcessTypeChange = (processType: string) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      processType,
    }));
    applyLiveFilterPatch({
      processType,
    });
  };

  const handleSearch = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setActiveStatus('');
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (filteredOrders.length === 0) {
      showToast('warning', '当前没有可导出的订单');
      return;
    }

    downloadCsv(
      filteredOrders.map((order) => ({
        ...order,
        productName: getDisplayProductName(),
        processType: getDisplayProcessType(order),
      })),
      resolvedCsvFilePrefix,
    );
    showToast('success', '导出成功');
  };

  return (
    <div className="app-main animate-fadeIn order-list-page klook-page">
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
            API订单管理
            <span>/</span>
            {pageTitle}
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell klook-page__shell">
        <section className="klook-filter-card">
          <div className="klook-filter-grid">
            <label className="klook-field klook-field--agent">
              <span className="klook-field__label">选择代理商</span>
              <input
                className="form-input"
                value={filters.agentName}
                onChange={(event) => updateFilter('agentName', event.target.value)}
                placeholder="请输入代理商名称（至少2个字符）"
              />
            </label>

            <label className="klook-field klook-field--product">
              <span className="klook-field__label">选择产品</span>
              <select
                className="form-select"
                value={filters.productName}
                onChange={(event) => handleProductChange(event.target.value)}
              >
                <option value="">所有产品</option>
                {productOptions.map((product) => (
                  <option key={product.productId} value={product.title}>
                    {product.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="klook-field klook-field--process">
              <span className="klook-field__label">办理类型</span>
              <select
                className="form-select"
                value={filters.processType}
                onChange={(event) => handleProcessTypeChange(event.target.value)}
              >
                <option value="">所有类型</option>
                {processTypeOptions.map((processType) => (
                  <option key={processType.value} value={processType.value}>
                    {processType.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="klook-field klook-field--keyword">
              <span className="klook-field__label">精准搜索</span>
              <input
                className="form-input"
                value={filters.keyword}
                onChange={(event) => updateFilter('keyword', event.target.value)}
                placeholder="订单号、快递单号、姓名……"
              />
            </label>

            <div className="klook-field klook-field--date">
              <span className="klook-field__label">创建时间</span>
              <div className="klook-date-range">
                <input
                  className="form-input"
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => updateFilter('startDate', event.target.value)}
                />
                <span className="klook-date-range__divider">至</span>
                <input
                  className="form-input"
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => updateFilter('endDate', event.target.value)}
                />
              </div>
            </div>

            <div className="klook-filter-actions">
              <button className="btn btn--primary" type="button" onClick={handleSearch}>
                搜索
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleReset}>
                重置
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleExport}>
                导出
              </button>
            </div>
          </div>
        </section>

        <section className="card klook-table-card">
          <div className="klook-table-card__header">
            <div className="klook-status-tabs">
              {KLOOK_STATUS_TABS.map((tab) => (
                <button
                  key={tab.value || 'all'}
                  type="button"
                  className={`klook-status-tabs__item ${activeStatus === tab.value ? 'klook-status-tabs__item--active' : ''}`}
                  onClick={() => {
                    setActiveStatus(tab.value);
                    setCurrentPage(1);
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="klook-status-tabs__count">{statusCounts[tab.value || ''] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table order-list-table klook-order-table">
              <thead>
                <tr>
                  <th style={{ width: 122 }}>订单ID</th>
                  <th style={{ width: 180 }}>下单时间</th>
                  <th style={{ minWidth: 220 }}>产品及办理类型</th>
                  <th style={{ width: 120 }}>代理商</th>
                  <th style={{ minWidth: 238 }}>驾驶信息</th>
                  <th style={{ minWidth: 268 }}>收货地址</th>
                  <th style={{ width: 120 }}>订单状态</th>
                  <th style={{ minWidth: 180 }}>订单记录</th>
                  <th style={{ width: 180 }}>操作</th>
                </tr>
              </thead>

              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      <div className="empty-state__icon">暂无</div>
                      <div className="empty-state__text">当前筛选条件下没有订单</div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const detailNavigationState = {
                      from: listPath,
                      listLabel: resolvedListLabel,
                    };
                    const viewPath = `${resolvedDetailPathPrefix}/${order.orderId}?mode=view`;
                    const auditPath = `${resolvedDetailPathPrefix}/${order.orderId}?mode=audit`;

                    return (
                    <tr key={order.orderId} className="order-list-row">
                      <td>
                        <div className="klook-order-id-cell">
                          <span className="klook-order-id">{order.orderId}</span>
                        </div>
                      </td>

                      <td className="order-time-cell">{order.createdAt}</td>

                      <td>
                        <div className="order-cell-stack">
                          <div className="order-cell-primary">{getDisplayProductName()}</div>
                          <div className={`klook-process-type klook-process-type--${getProcessTypeTone(order.processType)}`}>
                            <span className="klook-process-type__dot" />
                            <span>{getDisplayProcessType(order)}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="order-agent-name">{order.agentName}</div>
                      </td>

                      <td>
                        <div className="order-cell-stack order-cell-stack--compact">
                          <div>
                            <span className="order-cell-label">姓名：</span>
                            <span className="order-cell-value">
                              {order.driverName}/{order.driverNameLatin}
                            </span>
                          </div>
                          <div>
                            <span className="order-cell-label">驾照号：</span>
                            <span className="order-cell-value">{order.licenseNumber}</span>
                          </div>
                          <div>
                            <span className="order-cell-label">准驾车型：</span>
                            <span className="order-license-badge">{order.licenseType}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="order-cell-stack order-cell-stack--compact">
                          <div>
                            <span className="order-cell-label">收件人：</span>
                            <span className="order-cell-value">{order.recipientName}</span>
                          </div>
                          <div>
                            <span className="order-cell-label">手机号：</span>
                            <span className="order-cell-value">{order.recipientPhone}</span>
                          </div>
                          <div>
                            <span className="order-cell-label">收货地址：</span>
                            <span className="order-cell-value">{order.deliveryAddress}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="order-status-cell klook-order-status-cell">
                          <span className={getStatusClassName(order.status)}>{STATUS_LABELS[order.status]}</span>
                          {order.status === 'shipped' && (order.logisticsCompany || order.trackingNumber) && (
                            <div className="order-logistics-inline order-logistics-inline--status">
                              <span>{order.logisticsCompany || '物流已发出'}</span>
                              <span>{order.trackingNumber || '--'}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        {(() => {
                          const productionRecords = getProductionOrderRecords(order);

                          return productionRecords.length > 0 ? (
                            <div className="klook-record-list">
                              {productionRecords.map((record) => (
                                <div key={`${record.action}-${record.time}`} className="klook-record">
                                  <span className="klook-record__label">{record.action}</span>
                                  <span className="klook-record__time">{record.time}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="klook-record__empty">--</span>
                          );
                        })()}
                      </td>

                      <td className="order-actions-cell klook-order-actions-cell">
                        <div className="klook-order-actions">
                          <button
                            type="button"
                            className="order-text-action order-text-action--view"
                            onClick={() => navigate(viewPath, { state: detailNavigationState })}
                          >
                            查看订单
                          </button>
                          {order.status !== 'cancelled' && (
                            <button
                              type="button"
                              className={`order-text-action ${
                                order.status === 'pending_review' ? 'order-text-action--audit' : 'order-text-action--review'
                              }`}
                              onClick={() => navigate(auditPath, { state: detailNavigationState })}
                            >
                              {order.status === 'pending_review' ? '订单审核' : '查看审核'}
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

          <div className="klook-table-card__pagination">
            <ListUnifiedPagination
              total={filteredOrders.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default KlookOrderManagement;
