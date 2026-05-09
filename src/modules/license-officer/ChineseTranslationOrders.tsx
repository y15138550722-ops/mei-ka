import React, { useMemo, useState } from 'react';
import { getOrders, updateOrder } from '../../services/mockDataService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import type { Order } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import './ChineseTranslationOrders.css';

type ProductionOrderStatus = 'untranslated' | 'unmade' | 'unshipped' | 'shipped' | 'cancelled';

const PRODUCTION_STATUS_OPTIONS: Array<{ value: ProductionOrderStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'untranslated', label: '未翻译' },
  { value: 'unmade', label: '未制作' },
  { value: 'unshipped', label: '未发货' },
  { value: 'shipped', label: '已发货' },
  { value: 'cancelled', label: '已取消' },
];

const CHINESE_TRANSLATION_TYPE = '中文翻译件';
const PRODUCTION_OPERATOR = '生产端';
const TRANSLATED_ACTION = '已翻译';
const MADE_ACTION = '已制作';
const SHIPPED_ACTION = '已发货';

const hasProductionAction = (order: Order, action: string) =>
  order.logs.some((log) => log.operator === PRODUCTION_OPERATOR && log.action === action);

const normalizeProductionStatus = (order: Order): ProductionOrderStatus => {
  if (order.status === 'cancelled' || order.status === 'rejected') return 'cancelled';
  if (order.status === 'shipped' || order.status === 'completed') return 'shipped';
  if (order.status === 'in_production' || hasProductionAction(order, MADE_ACTION)) return 'unshipped';
  if (hasProductionAction(order, TRANSLATED_ACTION)) return 'unmade';
  if (order.status === 'pending_production') return 'untranslated';
  return 'untranslated';
};

const getProductionStatusLabel = (status: ProductionOrderStatus) =>
  PRODUCTION_STATUS_OPTIONS.find((item) => item.value === status)?.label || '未翻译';

const getProductionStatusClassName = (status: ProductionOrderStatus) => {
  const toneMap: Record<ProductionOrderStatus, string> = {
    untranslated: 'warning',
    unmade: 'processing',
    unshipped: 'pending',
    shipped: 'shipped',
    cancelled: 'cancelled',
  };

  return `license-translation-status license-translation-status--${toneMap[status]}`;
};

const getOrderCountry = (order: Order) => {
  if (order.useCountry?.trim()) return order.useCountry.trim();

  const title = `${order.productName} ${order.remark}`.toLowerCase();
  if (title.includes('naati') || title.includes('澳大利亚')) return '澳大利亚';
  if (title.includes('nzta') || title.includes('新西兰')) return '新西兰';
  if (title.includes('日本')) return '日本';
  if (title.includes('英国')) return '英国';
  if (title.includes('美国')) return '美国';
  return '中国';
};

const getOrderInfo = (order: Order) => [
  `产品：${order.productName}`,
  `办理类型：${order.processType || '正常办理'}`,
  `国家：${getOrderCountry(order)}`,
  order.domesticLicenseInfo
    ? `境外发放城市：${order.domesticLicenseInfo.foreignCity || '--'}`
    : undefined,
  order.domesticLicenseInfo
    ? `换证城市：${order.licenseIssuingRegion || `${order.domesticLicenseInfo.exchangeProvince} ${order.domesticLicenseInfo.exchangeCity}`}`
    : undefined,
  `姓名：${order.licenseName || order.customerName}`,
  `驾照号：${order.licenseNo || order.customerPassport}`,
  `准驾车型：${order.licenseCategory || 'C1'}`,
].filter(Boolean);

const getReceiptInfo = (order: Order) => [
  `收货人：${order.customerName || '--'}`,
  `手机号：${order.customerPhone || '--'}`,
  `收货地址：${order.deliveryAddress || '--'}`,
];

const getShippingInfo = (order: Order) => [
  `物流公司：${order.logisticsCompany || '--'}`,
  `物流单号：${order.trackingNumber || '--'}`,
  `发货时间：${order.shippedAt || '--'}`,
];

const isChineseTranslationOrder = (order: Order) =>
  (order.productCategory === 'translation' || order.productCategory === 'domestic_license') &&
  (
    order.remark === '代理端提交' ||
    order.logs.some((log) => log.operator === '代理端' || log.action.includes('代理端')) ||
    order.productName.includes('换国内驾照翻译件') ||
    order.productName.includes('翻译') ||
    order.productName.toLowerCase().includes('naati') ||
    order.productName.toLowerCase().includes('nzta')
  );

const ChineseTranslationOrders: React.FC = () => {
  const [orderVersion, setOrderVersion] = useState(0);
  const allOrders = useMemo(
    () =>
      getOrders()
        .filter(isChineseTranslationOrder)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orderVersion],
  );

  const processTypeOptions = useMemo(
    () => Array.from(new Set(allOrders.map((order) => order.processType).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [allOrders],
  );
  const countryOptions = useMemo(
    () => Array.from(new Set(allOrders.map(getOrderCountry).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [allOrders],
  );

  const [filterStatus, setFilterStatus] = useState<ProductionOrderStatus | ''>('');
  const [filterOrderId, setFilterOrderId] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [shippingCompany, setShippingCompany] = useState('顺丰速运');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');

  const filteredOrders = useMemo(() => {
    const orderIdKeyword = filterOrderId.trim().toLowerCase();
    const keyword = filterKeyword.trim().toLowerCase();

    return allOrders.filter((order) => {
      const productionStatus = normalizeProductionStatus(order);
      if (filterStatus && productionStatus !== filterStatus) return false;
      if (filterProcessType && order.processType !== filterProcessType) return false;
      if (filterCountry && getOrderCountry(order) !== filterCountry) return false;
      if (orderIdKeyword && !order.orderId.toLowerCase().includes(orderIdKeyword)) return false;

      if (keyword) {
        const searchableText = [
          order.customerName,
          order.licenseName,
          order.licenseNo,
          order.customerPassport,
          order.customerPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(keyword)) return false;
      }

      return true;
    });
  }, [allOrders, filterCountry, filterKeyword, filterOrderId, filterProcessType, filterStatus]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const handleSearch = () => setCurrentPage(1);

  const handleReset = () => {
    setFilterStatus('');
    setFilterOrderId('');
    setFilterKeyword('');
    setFilterProcessType('');
    setFilterCountry('');
    setCurrentPage(1);
  };

  const appendProductionLog = (order: Order, action: string, timestamp = formatBeijingTimestamp()) => {
    const nextLogs = [
      ...order.logs,
      {
        time: timestamp,
        operator: PRODUCTION_OPERATOR,
        action,
      },
    ];

    updateOrder(order.orderId, {
      logs: nextLogs,
      updatedAt: timestamp,
    });
    setOrderVersion((version) => version + 1);
    return { nextLogs, timestamp };
  };

  const handleConfirmTranslated = (order: Order) => {
    if (hasProductionAction(order, TRANSLATED_ACTION)) {
      showToast(`订单 ${order.orderId} 已记录翻译`);
      return;
    }

    appendProductionLog(order, TRANSLATED_ACTION);
    showToast(`订单 ${order.orderId} 已翻译`);
  };

  const handleExportOrder = (order: Order) => {
    const timestamp = formatBeijingTimestamp();
    const nextLogs = hasProductionAction(order, MADE_ACTION)
      ? order.logs
      : [
          ...order.logs,
          {
            time: timestamp,
            operator: PRODUCTION_OPERATOR,
            action: MADE_ACTION,
          },
        ];

    updateOrder(order.orderId, {
      status: 'in_production',
      logs: nextLogs,
      updatedAt: timestamp,
    });
    setOrderVersion((version) => version + 1);
    showToast(`订单 ${order.orderId} 已制作`);
  };

  const openShippingDialog = (order: Order) => {
    setShippingOrder(order);
    setShippingCompany(order.logisticsCompany || '顺丰速运');
    setShippingTrackingNumber(order.trackingNumber || `SF${Date.now().toString().slice(-10)}`);
  };

  const handleConfirmShipping = () => {
    if (!shippingOrder) return;

    const logisticsCompany = shippingCompany.trim();
    const trackingNumber = shippingTrackingNumber.trim();

    if (!logisticsCompany || !trackingNumber) {
      showToast('请填写快递公司和物流单号');
      return;
    }

    const timestamp = formatBeijingTimestamp();
    const nextLogs = hasProductionAction(shippingOrder, SHIPPED_ACTION)
      ? shippingOrder.logs
      : [
          ...shippingOrder.logs,
          {
            time: timestamp,
            operator: PRODUCTION_OPERATOR,
            action: SHIPPED_ACTION,
          },
        ];

    updateOrder(shippingOrder.orderId, {
      status: 'shipped',
      logisticsCompany,
      trackingNumber,
      shippedAt: timestamp,
      updatedAt: timestamp,
      logs: nextLogs,
    });
    setOrderVersion((version) => version + 1);
    setShippingOrder(null);
    setShippingTrackingNumber('');
    showToast(`订单 ${shippingOrder.orderId} 已发货`);
  };

  const renderActions = (order: Order) => {
    const status = normalizeProductionStatus(order);

    return (
      <>
        <button type="button" onClick={() => showToast(`查看订单：${order.orderId}`)}>
          查看订单
        </button>
        {status === 'untranslated' && (
          <button type="button" onClick={() => handleConfirmTranslated(order)}>
            翻译订单
          </button>
        )}
        {status === 'unmade' && (
          <button type="button" onClick={() => handleExportOrder(order)}>
            导出订单
          </button>
        )}
        {status === 'unshipped' && (
          <>
            <button type="button" onClick={() => showToast(`打印快递面单：${order.orderId}`)}>
              打印快递面单
            </button>
            <button type="button" onClick={() => openShippingDialog(order)}>
              发货
            </button>
          </>
        )}
      </>
    );
  };

  return (
    <div className="license-translation-page animate-fadeIn">
      {toast && (
        <div className="toast-container">
          <div className="toast toast--success">{toast}</div>
        </div>
      )}
      {shippingOrder && (
        <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={() => setShippingOrder(null)}>
          <div
            className="license-translation-shipping-modal"
            role="dialog"
            aria-modal="true"
            aria-label="确认发货"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="license-translation-shipping-modal__header">
              <strong>确认发货</strong>
              <button type="button" onClick={() => setShippingOrder(null)} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="license-translation-shipping-modal__body">
              <label>
                <span>快递公司</span>
                <input value={shippingCompany} onChange={(event) => setShippingCompany(event.target.value)} />
              </label>
              <label>
                <span>物流单号</span>
                <input value={shippingTrackingNumber} onChange={(event) => setShippingTrackingNumber(event.target.value)} />
              </label>
            </div>
            <div className="license-translation-shipping-modal__footer">
              <button type="button" className="license-translation-button" onClick={() => setShippingOrder(null)}>
                取消
              </button>
              <button
                type="button"
                className="license-translation-button license-translation-button--primary"
                onClick={handleConfirmShipping}
              >
                确认发货
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="license-translation-topbar">
        <div>
          <div className="license-translation-breadcrumb">
            驾照官后台
            <span>/</span>
            订单管理
            <span>/</span>
            中文翻译件
          </div>
          <h1>中文翻译件</h1>
        </div>
      </header>

      <section className="license-translation-filter">
        <label>
          <span>订单状态筛选</span>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as ProductionOrderStatus | '')}>
            {PRODUCTION_STATUS_OPTIONS.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>订单号搜索</span>
          <input value={filterOrderId} onChange={(event) => setFilterOrderId(event.target.value)} placeholder="请输入订单号" />
        </label>

        <label>
          <span>综合搜索</span>
          <input value={filterKeyword} onChange={(event) => setFilterKeyword(event.target.value)} placeholder="姓名、驾照号、手机号" />
        </label>

        <label>
          <span>办理类型</span>
          <select value={filterProcessType} onChange={(event) => setFilterProcessType(event.target.value)}>
            <option value="">全部办理类型</option>
            {processTypeOptions.map((processType) => (
              <option key={processType} value={processType}>
                {processType}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>国家</span>
          <select value={filterCountry} onChange={(event) => setFilterCountry(event.target.value)}>
            <option value="">全部国家</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>

        <div className="license-translation-filter__actions">
          <button type="button" className="license-translation-button license-translation-button--primary" onClick={handleSearch}>
            搜索
          </button>
          <button type="button" className="license-translation-button" onClick={handleReset}>
            重置
          </button>
        </div>
      </section>

      <section className="license-translation-card">
        <div className="license-translation-card__head">
          <strong>订单列表</strong>
          <span>共 {filteredOrders.length} 条</span>
        </div>

        <div className="license-translation-table-wrap">
          <table className="license-translation-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>订单号</th>
                <th>订单类型</th>
                <th>订单状态</th>
                <th>发起时间</th>
                <th>订单信息</th>
                <th>收货信息</th>
                <th>物流信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="license-translation-empty">
                    当前筛选条件下没有订单
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const productionStatus = normalizeProductionStatus(order);

                  return (
                    <tr key={order.orderId}>
                      <td>{(currentPage - 1) * pageSize + index + 1}</td>
                      <td>
                        <strong className="license-translation-order-id">{order.orderId}</strong>
                      </td>
                      <td>{CHINESE_TRANSLATION_TYPE}</td>
                      <td>
                        <span className={getProductionStatusClassName(productionStatus)}>
                          {getProductionStatusLabel(productionStatus)}
                        </span>
                      </td>
                      <td>{order.createdAt}</td>
                      <td>
                        <div className="license-translation-info">
                          {getOrderInfo(order).map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="license-translation-info">
                          {getReceiptInfo(order).map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="license-translation-info">
                          {getShippingInfo(order).map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="license-translation-actions">{renderActions(order)}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
      </section>
    </div>
  );
};

export default ChineseTranslationOrders;
