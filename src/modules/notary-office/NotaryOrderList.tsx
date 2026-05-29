import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../shared/i18n/config';
import {
  getNotaryOfficeOrders,
  syncNotaryOfficeCompletionToManagement,
  updateNotaryOfficeOrder,
} from '../../services/notaryOfficeOrderService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import type { Order, OrderStatus, ProcessType } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { getLanguageOptionsForProduct } from '../../shared/utils/notaryLanguageOptions';
import { getProcessTypeTone } from '../../shared/utils/productProcessType';

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

const NOTARY_DOWNLOAD_TEMPLATE_FILE_NAME = '姓名+国家+语言+产品名称.zip';
const NOTARY_DOWNLOAD_TEMPLATE_ROOT_NAME = '姓名+国家+语言+产品名称';
const NOTARY_DOWNLOAD_TEMPLATE_NAME_PLACEHOLDER = '姓名';
const NOTARY_DOWNLOAD_TEMPLATE_URL = encodeURI(`/ETC/Notary Office Template/${NOTARY_DOWNLOAD_TEMPLATE_FILE_NAME}`);
const NOTARY_DOWNLOAD_TEMPLATE_PATHS = [
  {
    fileName: NOTARY_DOWNLOAD_TEMPLATE_FILE_NAME,
    path: NOTARY_DOWNLOAD_TEMPLATE_URL,
  },
];

const NOTARY_LANGUAGE_COUNTRY_MAP: Record<string, string> = {
  英语: '美国',
  法语: '法国',
  德语: '德国',
  日语: '日本',
};

const getNotaryUseCountry = (order: Order) =>
  order.useCountry?.trim() || order.domesticLicenseInfo?.foreignCountry?.trim() || '';

const getNotaryDocumentType = (order: Order) =>
  order.productName?.includes('双号') ? '双号' : '单号';

const NOTARY_PRIORITY_OPTIONS: Array<{ value: ProcessType; label: string }> = [
  { value: 'urgent', label: '紧急办理' },
  { value: 'priority', label: '优先办理' },
  { value: 'normal', label: '正常办理' },
];

const NOTARY_PRIORITY_LABELS: Record<ProcessType, string> = {
  urgent: '紧急办理',
  priority: '优先办理',
  normal: '正常办理',
};

const NOTARY_PRIORITY_TAG_CLASSES: Record<ProcessType, string> = {
  urgent: 'tag tag--warning',
  priority: 'tag tag--processing',
  normal: 'tag tag--inactive',
};

const NOTARY_PRIORITY_SORT_ORDER: Record<ProcessType, number> = {
  urgent: 0,
  priority: 1,
  normal: 2,
};

const NOTARY_PRODUCTION_DOWNLOAD_PATTERN = /下载制作文件|制作并下载/;

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
  const useCountry = getNotaryUseCountry(order);
  if (useCountry) {
    return useCountry;
  }

  if (order.language && NOTARY_LANGUAGE_COUNTRY_MAP[order.language]) {
    return NOTARY_LANGUAGE_COUNTRY_MAP[order.language];
  }

  return '国家未设置';
};

const getNotaryProductionFileContext = (order: Order) => {
  const name = sanitizeDownloadPart(order.licenseName || order.customerName || '姓名未设置');
  const country = sanitizeDownloadPart(getNotaryCountryLabel(order));
  const language = sanitizeDownloadPart(order.language || '语言未设置');
  const documentType = sanitizeDownloadPart(getNotaryDocumentType(order));
  const rootName = [name, country, language, documentType].join('_');

  return {
    name,
    country,
    language,
    documentType,
    rootName,
    zipFileName: `${rootName}.zip`,
  };
};

const buildNotaryZipFilename = (order: Order) => getNotaryProductionFileContext(order).zipFileName;

const renameNotaryTemplatePath = (path: string, context: ReturnType<typeof getNotaryProductionFileContext>) => {
  const normalizedPath = path.replace(/\\/g, '/');
  const pathSegments = normalizedPath.split('/');

  return pathSegments
    .map((segment) =>
      segment
        .split(NOTARY_DOWNLOAD_TEMPLATE_ROOT_NAME)
        .join(context.rootName)
        .split(NOTARY_DOWNLOAD_TEMPLATE_NAME_PLACEHOLDER)
        .join(context.name),
    )
    .join('/');
};

const getProductionDisplayNotaryOfficeName = (order: Order) =>
  order.productionDisplayNotaryOfficeName?.trim() ||
  order.auditSelectedNotaryOfficeName?.trim() ||
  order.pushedNotaryOfficeName?.trim() ||
  '未选择';

const getNotaryOrderPriority = (order: Order): ProcessType => getProcessTypeTone(order.processType);

const getNotaryOrderPriorityLabel = (order: Order) => NOTARY_PRIORITY_LABELS[getNotaryOrderPriority(order)];

const getNotaryOrderPriorityTagClass = (order: Order) =>
  NOTARY_PRIORITY_TAG_CLASSES[getNotaryOrderPriority(order)] || 'tag tag--inactive';

const getNotaryOrderPushTimeValue = (order: Order) => {
  const submissionLog = order.logs.find((log) => /送审至|公证处已接收|推送至/.test(log.action) && log.time?.trim());

  return submissionLog?.time?.trim() || order.createdAt?.trim() || order.updatedAt?.trim() || '';
};

const getNotaryOrderSortValue = (order: Order) => ({
  priorityValue: NOTARY_PRIORITY_SORT_ORDER[getNotaryOrderPriority(order)],
  pushTimeValue: getNotaryOrderPushTimeValue(order),
});

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

const hasDownloadedProductionFile = (order: Order) =>
  order.logs.some((log) => NOTARY_PRODUCTION_DOWNLOAD_PATTERN.test(log.action));

const NotaryOrderList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQueryStatus = useMemo(() => getInitialNotaryFilterStatus(searchParams.get('status')), [searchParams]);

  const [allOrders, setAllOrders] = useState<Order[]>(() => getNotaryOfficeOrders());
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>(currentQueryStatus);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterPriority, setFilterPriority] = useState<ProcessType | ''>('');
  const [filterName, setFilterName] = useState('');
  const [appliedFilterProduct, setAppliedFilterProduct] = useState('');
  const [appliedFilterLanguage, setAppliedFilterLanguage] = useState('');
  const [appliedFilterPriority, setAppliedFilterPriority] = useState<ProcessType | ''>('');
  const [appliedFilterName, setAppliedFilterName] = useState('');
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
  const languageOptions = useMemo(
    () => (filterProduct ? getLanguageOptionsForProduct(filterProduct) : []),
    [filterProduct],
  );

  useEffect(() => {
    if (filterLanguage && !languageOptions.includes(filterLanguage)) {
      setFilterLanguage('');
    }
  }, [filterLanguage, languageOptions]);

  const filteredOrders = useMemo(() => {
    const trimmedName = appliedFilterName.trim().toLowerCase();

    const nextOrders = notaryOrders.filter((order) => {
      if (filterStatus && getNotaryVisibleStatus(order.status) !== filterStatus) return false;
      if (appliedFilterProduct && order.productName !== appliedFilterProduct) return false;
      if (appliedFilterProduct && appliedFilterLanguage && order.language !== appliedFilterLanguage) return false;
      if (appliedFilterPriority && getNotaryOrderPriority(order) !== appliedFilterPriority) return false;

      if (trimmedName) {
        const searchableKeyword = [
          order.licenseName,
          order.customerName,
          order.customerPassport,
          order.customerPhone,
          order.licenseNo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchableKeyword.includes(trimmedName)) {
          return false;
        }
      }

      return true;
    });

    return [...nextOrders].sort((left, right) => {
      const leftSortValue = getNotaryOrderSortValue(left);
      const rightSortValue = getNotaryOrderSortValue(right);

      if (leftSortValue.priorityValue !== rightSortValue.priorityValue) {
        return leftSortValue.priorityValue - rightSortValue.priorityValue;
      }

      if (leftSortValue.pushTimeValue !== rightSortValue.pushTimeValue) {
        if (!leftSortValue.pushTimeValue) return 1;
        if (!rightSortValue.pushTimeValue) return -1;
        return leftSortValue.pushTimeValue.localeCompare(rightSortValue.pushTimeValue);
      }

      return left.orderId.localeCompare(right.orderId);
    });
  }, [
    appliedFilterLanguage,
    appliedFilterName,
    appliedFilterPriority,
    appliedFilterProduct,
    filterStatus,
    notaryOrders,
  ]);

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
  const orderTableColumnCount = 7 + (showRejectReasonColumn ? 1 : 0) + (showBatchSelection ? 1 : 0);

  const applyOrderPatches = (patches: Record<string, Partial<Order>>) => {
    const failedUpdates: string[] = [];

    Object.entries(patches).forEach(([orderId, patch]) => {
      try {
        updateNotaryOfficeOrder(orderId, patch);
      } catch (error) {
        failedUpdates.push(orderId);
        console.error('[notary-download] Failed to persist notary order update', orderId, error);
      }
    });

    setAllOrders((prev) =>
      prev.map((order) => (patches[order.orderId] ? { ...order, ...patches[order.orderId] } : order)),
    );

    return failedUpdates.length === 0;
  };

  const getNotaryDownloadTemplate = () => NOTARY_DOWNLOAD_TEMPLATE_PATHS[0];

  const buildNotaryProductionZipBlob = async (order: Order) => {
    const template = getNotaryDownloadTemplate();
    const response = await fetch(template.path);

    if (!response.ok) {
      throw new Error(`Failed to fetch notary production template: ${response.status}`);
    }

    const context = getNotaryProductionFileContext(order);
    const templateZip = await JSZip.loadAsync(await response.arrayBuffer());
    const productionZip = new JSZip();
    const copyTasks: Array<Promise<void>> = [];

    templateZip.forEach((relativePath, zipEntry) => {
      const nextPath = renameNotaryTemplatePath(relativePath, context);

      if (zipEntry.dir) {
        productionZip.folder(nextPath);
        return;
      }

      copyTasks.push(
        zipEntry.async('uint8array').then((content) => {
          productionZip.file(nextPath, content, {
            date: zipEntry.date,
            comment: zipEntry.comment,
            unixPermissions: zipEntry.unixPermissions,
            dosPermissions: zipEntry.dosPermissions,
            createFolders: true,
          });
        }),
      );
    });

    await Promise.all(copyTasks);

    return productionZip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6,
      },
    });
  };

  const triggerNotaryZipDownload = (downloadUrl: string, filename: string) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = new URL(downloadUrl, window.location.origin).href;
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
          action: '公证处制作完成',
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
    setAppliedFilterProduct(filterProduct);
    setAppliedFilterLanguage(filterProduct ? filterLanguage : '');
    setAppliedFilterPriority(filterPriority);
    setAppliedFilterName(filterName);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilterProduct('');
    setFilterLanguage('');
    setFilterPriority('');
    setFilterName('');
    setAppliedFilterProduct('');
    setAppliedFilterLanguage('');
    setAppliedFilterPriority('');
    setAppliedFilterName('');
    setCurrentPage(1);
  };

  const handleProduceAndDownload = async (orderId: string) => {
    const targetOrder = allOrders.find((order) => order.orderId === orderId);
    if (!targetOrder) return;

    try {
      const blob = await buildNotaryProductionZipBlob(targetOrder);
      const downloadUrl = window.URL.createObjectURL(blob);

      triggerNotaryZipDownload(downloadUrl, buildNotaryZipFilename(targetOrder));
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      console.error('[notary-download] Failed to start zip download', error);
      window.alert('压缩包下载启动失败，请稍后重试');
      return;
    }

    applyOrderPatches({
      [orderId]: buildProductionOrderPatch(targetOrder, '下载制作文件'),
    });
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
      await Promise.all(
        selectedOrders.map(async (order) => {
          const blob = await buildNotaryProductionZipBlob(order);
          const downloadUrl = window.URL.createObjectURL(blob);

          triggerNotaryZipDownload(downloadUrl, buildNotaryZipFilename(order));
          window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);
        }),
      );
    } catch (error) {
      console.error('[notary-download] Failed to start batch zip download', error);
      window.alert('压缩包下载启动失败，请稍后重试');
      return;
    }

    applyOrderPatches(
      Object.fromEntries(
        selectedOrders.map((order) => [
          order.orderId,
          buildProductionOrderPatch(order, '批量下载制作文件'),
        ]),
      ),
    );
    setSelectedOrderIds([]);
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

  const activeFilterCount = [
    appliedFilterProduct,
    appliedFilterProduct ? appliedFilterLanguage : '',
    appliedFilterPriority,
    appliedFilterName.trim(),
  ].filter(Boolean).length;

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
              <label className="form-label">语言</label>
              <select
                className="form-select"
                value={filterLanguage}
                disabled={!filterProduct}
                onChange={(event) => setFilterLanguage(event.target.value)}
              >
                <option value="">{filterProduct ? t('common.all') : '请先选择产品'}</option>
                {languageOptions.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">优先级</label>
              <select
                className="form-select"
                value={filterPriority}
                onChange={(event) => setFilterPriority(event.target.value as ProcessType | '')}
              >
                <option value="">{t('common.all')}</option>
                {NOTARY_PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field notary-order-list__name-filter">
              <label className="form-label">关键字</label>
              <input
                className="form-input"
                value={filterName}
                placeholder="请输入姓名、身份证号、手机号"
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
            <table className="data-table order-list-table notary-order-list-table">
              <colgroup>
                {showBatchSelection && <col className="notary-order-list-table__col--selection" />}
                <col className="notary-order-list-table__col--sequence" />
                <col className="notary-order-list-table__col--product" />
                <col className="notary-order-list-table__col--license" />
                <col className="notary-order-list-table__col--delivery" />
                <col className="notary-order-list-table__col--priority" />
                {showRejectReasonColumn && <col className="notary-order-list-table__col--reject" />}
                <col className="notary-order-list-table__col--status" />
                <col className="notary-order-list-table__col--actions" />
              </colgroup>
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
                  <th>收货信息</th>
                  <th>优先级</th>
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
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {order.productName}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-text-secondary)',
                              marginTop: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap',
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
                            <button
                              type="button"
                              className="btn btn--sm"
                              disabled
                              style={{
                                minHeight: '26px',
                                padding: '2px 10px',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#1d4ed8',
                                fontSize: '12px',
                                cursor: 'default',
                                boxShadow: 'none',
                                opacity: 1,
                                pointerEvents: 'none',
                              }}
                            >
                              {getNotaryCountryLabel(order)}
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

                        <td>
                          <span className={getNotaryOrderPriorityTagClass(order)}>{getNotaryOrderPriorityLabel(order)}</span>
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

                            {visibleStatus === 'in_production' &&
                              (hasDownloadedProductionFile(order) ? (
                                <button
                                  type="button"
                                  className="btn btn--primary btn--sm"
                                  onClick={() => handleMarkCompleted(order.orderId)}
                                >
                                  制作完成
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn--warning btn--sm"
                                  onClick={() => void handleProduceAndDownload(order.orderId)}
                                >
                                  {t('order.action.produceAndDownload')}
                                </button>
                              ))}
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
