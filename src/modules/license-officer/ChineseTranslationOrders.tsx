import React, { useEffect, useMemo, useState } from 'react';
import { getOrders, updateOrder } from '../../services/mockDataService';
import ResolvedImage from '../../shared/components/ResolvedImage';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import type { Order } from '../../shared/types';
import { getStoredAuthSession } from '../../shared/utils/auth';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { exportTranslationOrders } from '../../shared/utils/exportTranslationOrders';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import { useTranslation } from '../../shared/i18n/config';
import {
  getAgentName,
  getExportErrorMessage,
  getLicenseInfo,
  getLogisticsInfo,
  getOrderListExportFileName,
  getRecipientInfo,
} from '../order-management/orderListShared';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CHINESE_TRANSLATION_PRODUCT_TITLE,
  PRODUCTION_OPERATOR,
  isProductionVisibleChineseTranslationOrder,
} from './productionOrderVisibility';
import './ChineseTranslationOrders.css';

type ProductionOrderStatus = 'untranslated' | 'unmade' | 'unshipped' | 'shipped' | 'cancelled';
type OcrCompareStatus = 'loading' | 'ready' | 'error';
type OcrCompareRow = { label: string; original: string; translation: string };
type OcrCompareState = {
  errorMessage?: string;
  order: Order;
  rows: OcrCompareRow[];
  status: OcrCompareStatus;
};
type ProductionFlowInfoRow = { label: string; value: string };

const PRODUCTION_STATUS_OPTIONS: Array<{ value: ProductionOrderStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'untranslated', label: '未翻译' },
  { value: 'unmade', label: '未制作' },
  { value: 'unshipped', label: '未发货' },
  { value: 'shipped', label: '已发货' },
  { value: 'cancelled', label: '已取消' },
];

const CHINESE_TRANSLATION_TYPE = '中文翻译件';
const TRANSLATED_ACTION = '已翻译';
const MADE_ACTION = '已制作';
const SHIPPED_ACTION = '已发货';
const LOGISTICS_COMPANY_OPTIONS = ['顺丰快递', '极兔快递', '京东快递'];
const WAYBILL_PRINT_OPTIONS = [
  { label: '打印京东', company: '京东快递' },
  { label: '打印顺丰', company: '顺丰快递' },
  { label: '打印极兔', company: '极兔快递' },
];

const IMAGE_TEXT_REFERENCE_ROWS: OcrCompareRow[] = [
  { label: 'DL', original: 'DL', translation: '驾驶证编号' },
  { label: 'EXP', original: 'EXP', translation: '有效期至' },
  { label: 'LN', original: 'LN', translation: '姓' },
  { label: 'FN', original: 'FN', translation: '名' },
  { label: 'DOB', original: 'DOB', translation: '出生日期' },
  { label: 'RSTR', original: 'RSTR', translation: '限制条件' },
  { label: 'SEX', original: 'SEX', translation: '性别' },
  { label: 'HAIR', original: 'HAIR', translation: '头发' },
  { label: 'EYES', original: 'EYES', translation: '眼睛' },
  { label: 'HGT', original: 'HGT', translation: '身高' },
  { label: 'WGT', original: 'WGT', translation: '体重' },
  { label: 'ISS', original: 'ISS', translation: '签发日期' },
  { label: 'DD', original: 'DD', translation: '文件识别号' },
  { label: 'CLASS', original: 'CLASS', translation: '准驾车型' },
  { label: 'ENDORSEMENTS', original: 'ENDORSEMENTS', translation: '额外准驾类别' },
  { label: 'RESTRICTIONS', original: 'RESTRICTIONS', translation: '限制条件' },
  {
    label: 'FEDERAL NOTICE',
    original: 'FEDERAL LIMITS APPLY',
    translation: '本驾驶证作为机动车驾驶验证发放。不得用作应聘、选民登记或公益活动。',
  },
  { label: 'LIMITED-TERM', original: 'LIMITED-TERM', translation: '非永久公民' },
  { label: 'AGE', original: 'AGE xx, IN xx', translation: '于XX年年满XX周岁' },
  { label: 'FEDERAL LIMITS APPLY', original: 'FEDERAL LIMITS APPLY', translation: '不作联邦身份证使用' },
];

const requestDomesticLicenseOcrRows = async (order: Order) => {
  return IMAGE_TEXT_REFERENCE_ROWS;
};

const hasProductionAction = (order: Order, action: string) => order.logs.some((log) => log.action === action);

const getProductionActionLog = (order: Order, action: string) =>
  [...order.logs].reverse().find((log) => log.action === action);

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

const getOrderInfo = (order: Order) => ({
  productName: order.productName,
  processTypeLabel: order.processType || '正常办理',
  processTypeTone: getProcessTypeTone(order.processType || '正常办理'),
  foreignLocation:
    [order.domesticLicenseInfo?.foreignCountry, order.domesticLicenseInfo?.foreignCity].filter(Boolean).join(' ') ||
    getOrderCountry(order),
  exchangeLocation: order.domesticLicenseInfo
    ? order.licenseIssuingRegion || `${order.domesticLicenseInfo.exchangeProvince} ${order.domesticLicenseInfo.exchangeCity}`
    : '',
  chineseName: order.licenseName || order.customerName,
  licenseNumber: order.licenseNo || order.customerPassport,
  licenseCategory: order.licenseCategory || 'C1',
});

const getDomesticExchangeLocation = (order: Order) =>
  order.licenseIssuingRegion ||
  [order.domesticLicenseInfo?.exchangeProvince, order.domesticLicenseInfo?.exchangeCity].filter(Boolean).join(' ');

const getDomesticForeignLocation = (order: Order) =>
  [order.domesticLicenseInfo?.foreignCountry, order.domesticLicenseInfo?.foreignCity].filter(Boolean).join(' ') ||
  getOrderCountry(order);

const getDisplayValue = (value?: string | number | null) => {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || '--';
};

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

const getProductionFlowInfoRows = (
  order: Order,
  productionStatus: ProductionOrderStatus,
  currentOperatorName: string,
): ProductionFlowInfoRow[] => {
  const translatedLog = getProductionActionLog(order, TRANSLATED_ACTION);
  const madeLog = getProductionActionLog(order, MADE_ACTION);
  const rows: ProductionFlowInfoRow[] = [];

  if (translatedLog) {
    rows.push(
      { label: '翻译人', value: currentOperatorName || translatedLog.operator },
      { label: '翻译时间', value: translatedLog.time },
    );
  }

  if ((productionStatus === 'unshipped' || productionStatus === 'shipped') && madeLog) {
    rows.push(
      { label: '制作人', value: madeLog.operator },
      { label: '制作时间', value: madeLog.time },
    );
  }

  return rows;
};

const ChineseTranslationOrders: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const [orderVersion, setOrderVersion] = useState(0);
  const allOrders = useMemo(
    () =>
      getOrders()
        .filter(isProductionVisibleChineseTranslationOrder)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orderVersion],
  );

  const [filterStatus, setFilterStatus] = useState<ProductionOrderStatus | ''>('');
  const [filterOrderId, setFilterOrderId] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterForeignCountry, setFilterForeignCountry] = useState('');
  const [filterForeignCity, setFilterForeignCity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [previewImage, setPreviewImage] = useState<{ label: string; src: string } | null>(null);
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [shippingCompany, setShippingCompany] = useState('');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [ocrCompare, setOcrCompare] = useState<OcrCompareState | null>(null);
  const [activeProductionFlowOrderId, setActiveProductionFlowOrderId] = useState<string | null>(null);
  const currentOperatorName = useMemo(() => {
    const session = getStoredAuthSession();
    return session?.displayName?.trim() || session?.username?.trim() || PRODUCTION_OPERATOR;
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get('status') as ProductionOrderStatus | null;
    const isValidStatus = PRODUCTION_STATUS_OPTIONS.some((item) => item.value === statusParam);

    if (!statusParam || !isValidStatus) return;

    setFilterStatus(statusParam);
    setCurrentPage(1);
  }, [searchParams]);

  const processTypeOptions = useMemo(
    () =>
      Array.from(new Set(allOrders.map((order) => order.processType).filter(Boolean) as string[]))
        .map((value) => ({ value, label: getProductProcessTypeLabel(value, t) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
    [allOrders, t],
  );
  const foreignCountryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allOrders
            .map((order) => order.domesticLicenseInfo?.foreignCountry?.trim() || getOrderCountry(order))
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [allOrders],
  );
  const foreignCityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allOrders
            .filter((order) => {
              const country = order.domesticLicenseInfo?.foreignCountry?.trim() || getOrderCountry(order);
              return !filterForeignCountry || country === filterForeignCountry;
            })
            .map((order) => order.domesticLicenseInfo?.foreignCity?.trim())
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [allOrders, filterForeignCountry],
  );

  const filteredOrders = useMemo(() => {
    const orderIdKeyword = filterOrderId.trim().toLowerCase();
    const keyword = filterKeyword.trim().toLowerCase();

    return allOrders.filter((order) => {
      const productionStatus = normalizeProductionStatus(order);
      if (filterStatus && productionStatus !== filterStatus) return false;
      if (filterProcessType && order.processType !== filterProcessType) return false;
      const foreignCountry = order.domesticLicenseInfo?.foreignCountry?.trim() || getOrderCountry(order);
      const foreignCity = order.domesticLicenseInfo?.foreignCity?.trim() || '';
      if (filterForeignCountry && foreignCountry !== filterForeignCountry) return false;
      if (filterForeignCity && foreignCity !== filterForeignCity) return false;
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
  }, [allOrders, filterForeignCity, filterForeignCountry, filterKeyword, filterOrderId, filterProcessType, filterStatus]);

  const statusCountBaseOrders = useMemo(() => {
    const orderIdKeyword = filterOrderId.trim().toLowerCase();
    const keyword = filterKeyword.trim().toLowerCase();

    return allOrders.filter((order) => {
      if (filterProcessType && order.processType !== filterProcessType) return false;
      const foreignCountry = order.domesticLicenseInfo?.foreignCountry?.trim() || getOrderCountry(order);
      const foreignCity = order.domesticLicenseInfo?.foreignCity?.trim() || '';
      if (filterForeignCountry && foreignCountry !== filterForeignCountry) return false;
      if (filterForeignCity && foreignCity !== filterForeignCity) return false;
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
  }, [allOrders, filterForeignCity, filterForeignCountry, filterKeyword, filterOrderId, filterProcessType]);

  const statusCounts = useMemo(() => {
    const counts: Record<ProductionOrderStatus | '', number> = {
      '': statusCountBaseOrders.length,
      untranslated: 0,
      unmade: 0,
      unshipped: 0,
      shipped: 0,
      cancelled: 0,
    };

    statusCountBaseOrders.forEach((order) => {
      counts[normalizeProductionStatus(order)] += 1;
    });

    return counts;
  }, [statusCountBaseOrders]);

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
    setFilterForeignCountry('');
    setFilterForeignCity('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    if (filteredOrders.length === 0) {
      showToast('当前筛选条件下没有可导出的订单');
      return;
    }

    setIsExporting(true);

    try {
      await exportTranslationOrders(
        filteredOrders.map((order) => {
          const productionStatus = normalizeProductionStatus(order);

          return {
            orderId: order.orderId,
            createdAt: order.createdAt,
            productName: order.productName,
            processTypeLabel: getProductProcessTypeLabel(order.processType || '正常办理', t),
            agentName: getAgentName(order),
            recipientInfo: getRecipientInfo(order),
            licenseInfo: getLicenseInfo(order),
            statusLabel: getProductionStatusLabel(productionStatus),
            logisticsInfo: getLogisticsInfo(order),
            price: order.lockedPrice,
            primaryAccount: '',
          };
        }),
        getOrderListExportFileName('中文翻译件订单列表'),
      );

      showToast('导出成功');
    } catch (error) {
      console.error(error);
      showToast(getExportErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const appendProductionLog = (order: Order, action: string, timestamp = formatBeijingTimestamp()) => {
    const nextLogs = [
      ...order.logs,
      {
        time: timestamp,
        operator: currentOperatorName,
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

  const confirmTranslated = (order: Order) => {
    if (hasProductionAction(order, TRANSLATED_ACTION)) {
      showToast(`订单 ${order.orderId} 已记录翻译`);
      return;
    }

    appendProductionLog(order, TRANSLATED_ACTION);
    showToast(`订单 ${order.orderId} 已翻译`);
  };

  const handleOpenOcrCompare = async (order: Order) => {
    setDetailOrder(null);
    setShippingOrder(null);
    setPreviewImage(null);
    setOcrCompare({ order, rows: [], status: 'loading' });

    try {
      const rows = await requestDomesticLicenseOcrRows(order);
      setOcrCompare({ order, rows, status: 'ready' });
    } catch (error) {
      setOcrCompare({
        errorMessage: error instanceof Error ? error.message : '图片文案识别失败，请检查识别服务配置',
        order,
        rows: [],
        status: 'error',
      });
    }
  };

  const handleConfirmOcrCompare = () => {
    if (!ocrCompare) return;

    confirmTranslated(ocrCompare.order);
    setOcrCompare(null);
  };

  const handleOcrTranslationChange = (index: number, value: string) => {
    setOcrCompare((current) => {
      if (!current) return current;

      return {
        ...current,
        rows: current.rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, translation: value } : row,
        ),
      };
    });
  };


  const handleOpenExportOrder = (order: Order) => {
    setDetailOrder(null);
    setShippingOrder(null);
    setPreviewImage(null);
    setOcrCompare(null);
    navigate(
      `/license-officer/orders/chinese-translation/docx/${encodeURIComponent(order.orderId)}?fromStatus=${normalizeProductionStatus(order)}`,
    );
  };

  const openShippingDialog = (order: Order) => {
    setShippingOrder(order);
    setShippingCompany(
      order.logisticsCompany && LOGISTICS_COMPANY_OPTIONS.includes(order.logisticsCompany)
        ? order.logisticsCompany
        : '',
    );
    setShippingTrackingNumber(order.trackingNumber || '');
  };

  const handleConfirmShipping = () => {
    if (!shippingOrder) return;

    const logisticsCompany = shippingCompany.trim();
    const trackingNumber = shippingTrackingNumber.trim();

    if (!logisticsCompany || !trackingNumber) {
      showToast('请选择物流公司并填写物流单号');
      return;
    }

    const timestamp = formatBeijingTimestamp();
    const shippingLogAction = `物流发货：${logisticsCompany} ${trackingNumber}`;
    const nextLogs = hasProductionAction(shippingOrder, SHIPPED_ACTION)
      ? [
          ...shippingOrder.logs,
          {
            time: timestamp,
            operator: PRODUCTION_OPERATOR,
            action: shippingLogAction,
          },
        ]
      : [
          ...shippingOrder.logs,
          {
            time: timestamp,
            operator: PRODUCTION_OPERATOR,
            action: SHIPPED_ACTION,
          },
          {
            time: timestamp,
            operator: PRODUCTION_OPERATOR,
            action: shippingLogAction,
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
    setShippingCompany('');
    setShippingTrackingNumber('');
    showToast(`订单 ${shippingOrder.orderId} 已发货`);
  };

  const handleCancelOrder = (order: Order) => {
    const status = normalizeProductionStatus(order);
    if (status === 'shipped' || status === 'cancelled') {
      showToast('当前状态不可取消');
      return;
    }

    const timestamp = formatBeijingTimestamp();
    const nextLogs = hasProductionAction(order, '取消订单')
      ? order.logs
      : [
          ...order.logs,
          {
            time: timestamp,
            operator: PRODUCTION_OPERATOR,
            action: '取消订单',
          },
        ];

    updateOrder(order.orderId, {
      status: 'cancelled',
      updatedAt: timestamp,
      logs: nextLogs,
    });
    setOrderVersion((version) => version + 1);

    if (detailOrder?.orderId === order.orderId) {
      setDetailOrder(null);
    }
    if (shippingOrder?.orderId === order.orderId) {
      setShippingOrder(null);
    }
    if (ocrCompare?.order.orderId === order.orderId) {
      setOcrCompare(null);
    }
    if (activeProductionFlowOrderId === order.orderId) {
      setActiveProductionFlowOrderId(null);
    }

    showToast(`订单 ${order.orderId} 已取消`);
  };

  const toggleProductionFlowPopover = (order: Order) => {
    setDetailOrder(null);
    setShippingOrder(null);
    setPreviewImage(null);
    setOcrCompare(null);
    setActiveProductionFlowOrderId((currentOrderId) => (currentOrderId === order.orderId ? null : order.orderId));
  };

  const renderActions = (order: Order) => {
    const status = normalizeProductionStatus(order);

    return (
      <>
        <button
          type="button"
          className="license-translation-action-button license-translation-action-button--view"
          onClick={() => setDetailOrder(order)}
        >
          查看订单
        </button>
        {status === 'untranslated' && (
          <button
            type="button"
            className="license-translation-action-button license-translation-action-button--orange"
            onClick={() => handleOpenOcrCompare(order)}
          >
            翻译订单
          </button>
        )}
        {status === 'unmade' && (
          <button
            type="button"
            className="license-translation-action-button license-translation-action-button--orange"
            onClick={() => handleOpenExportOrder(order)}
          >
            导出订单
          </button>
        )}
        {status === 'unshipped' && (
          <>
            {WAYBILL_PRINT_OPTIONS.map((option) => (
              <button
                key={option.company}
                type="button"
                className="license-translation-action-button license-translation-action-button--orange"
                onClick={() => showToast(`${option.label}面单：${order.orderId}`)}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className="license-translation-action-button license-translation-action-button--orange"
              onClick={() => openShippingDialog(order)}
            >
              发货
            </button>
          </>
        )}
        {(status === 'untranslated' || status === 'unmade' || status === 'unshipped') && (
          <button
            type="button"
            className="license-translation-action-button license-translation-action-button--danger"
            onClick={() => handleCancelOrder(order)}
          >
            取消订单
          </button>
        )}
      </>
    );
  };

  const renderOcrCompareModal = () => {
    if (!ocrCompare) return null;

    const { order, rows, status } = ocrCompare;
    const photos = [
      { label: '驾照正面照片', src: order.domesticLicenseInfo?.frontPhoto },
      { label: '驾照反面照片', src: order.domesticLicenseInfo?.backPhoto },
    ];

    return (
      <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={() => setOcrCompare(null)}>
        <section
          className="license-translation-ocr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="图片文案识别翻译对照"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="license-translation-detail-modal__header">
            <div>
              <strong>图片文案识别翻译对照</strong>
              <span>{order.orderId}</span>
            </div>
            <button type="button" onClick={() => setOcrCompare(null)} aria-label="关闭">
              ×
            </button>
          </header>

          <div className="license-translation-ocr-modal__body">
            <section className="license-translation-ocr-images" aria-label="识别图片">
              {photos.map((photo) => (
                <div key={photo.label} className="license-translation-ocr-image-card">
                  <strong>{photo.label}</strong>
                  {photo.src ? <ResolvedImage src={photo.src} alt={photo.label} /> : <span>暂无图片</span>}
                </div>
              ))}
            </section>

            <section className="license-translation-ocr-compare" aria-label="图片原文与翻译文案对照">
              {status === 'loading' ? (
                <div className="license-translation-ocr-state">正在识别图片文案并翻译...</div>
              ) : (
                <>
                  {ocrCompare.errorMessage && (
                    <div className="license-translation-ocr-warning">{ocrCompare.errorMessage}</div>
                  )}
                  {rows.length > 0 ? (
                    <div className="license-translation-ocr-table">
                      <div className="license-translation-ocr-table__head">识别原文</div>
                      <div className="license-translation-ocr-table__head">翻译文案</div>
                      {rows.map((row, index) => (
                        <React.Fragment key={`${row.label}-${row.original}`}>
                          <div>
                            <span>{row.original || '--'}</span>
                          </div>
                          <div>
                            <textarea
                              className="license-translation-ocr-table__textarea"
                              value={row.translation}
                              onChange={(event) => handleOcrTranslationChange(index, event.target.value)}
                              placeholder="请输入翻译文案"
                              rows={Math.max(2, Math.ceil(row.translation.length / 18))}
                            />
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="license-translation-ocr-state">暂无识别结果</div>
                  )}
                </>
              )}
            </section>
          </div>

          <footer className="license-translation-detail-modal__footer">
            <button type="button" className="license-translation-button" onClick={() => setOcrCompare(null)}>
              取消
            </button>
            <button
              type="button"
              className="license-translation-button license-translation-button--primary"
              disabled={status === 'loading'}
              onClick={handleConfirmOcrCompare}
            >
              确认翻译
            </button>
          </footer>
        </section>
      </div>
    );
  };

  const renderProductionFlowPopover = (order: Order, productionStatus: ProductionOrderStatus) => {
    const rows = getProductionFlowInfoRows(order, productionStatus, currentOperatorName);

    if (rows.length === 0) return null;

    return (
      <div className="license-translation-flow-popover" role="dialog" aria-label="生产记录">
        {rows.map((row) => (
          <div key={row.label} className="license-translation-flow-popover__row">
            <span>{row.label}：</span>
            <strong>{row.value || '--'}</strong>
          </div>
        ))}
      </div>
    );
  };

  const renderOrderDetailModal = () => {
    if (!detailOrder) return null;

    const order = detailOrder;
    const domesticInfo = order.domesticLicenseInfo;
    const productItems = [
      ['商品名称', order.productName],
      ['换证城市', getDomesticExchangeLocation(order)],
      ['驾驶证发放国家及城市', getDomesticForeignLocation(order)],
      ['办理类型', order.processType || '正常办理'],
    ];
    const licenseItems = [
      ['中文姓名', domesticInfo?.chineseName || order.licenseName || order.customerName],
      ['DL/驾驶证编号', domesticInfo?.licenseNumber || order.licenseNo || order.customerPassport],
      ['EXP/有效期至', domesticInfo?.expiryDate],
      ['LN/姓', domesticInfo?.surname],
      ['FN/名', domesticInfo?.givenName],
      ['DOB/出生日期', domesticInfo?.birthDate],
      ['RSTR/限制条件', domesticInfo?.rstr],
      ['SEX/性别', domesticInfo?.sex],
      ['HAIR/头发颜色', domesticInfo?.hairColor],
      ['EYES/眼睛', domesticInfo?.eyeColor],
      ['HGT/身高', domesticInfo?.height],
      ['WGT/体重', domesticInfo?.weight],
      ['ISS/签发日期', domesticInfo?.issueDate],
      ['DD/文件识别号', domesticInfo?.fileNumber],
      ['CLASS/准驾车型', domesticInfo?.classType || order.licenseCategory],
      ['ENDORSEMENTS/额外准驾车型', domesticInfo?.endorsements],
      ['RESTRICTIONS/限制条件', domesticInfo?.restrictions],
      ['其他', domesticInfo?.other],
    ];
    const attachmentItems = domesticInfo
      ? [
          { label: '驾照正面照片', src: domesticInfo.frontPhoto },
          { label: '驾照反面照片', src: domesticInfo.backPhoto },
          ...(domesticInfo.passportPhoto ? [{ label: '护照', src: domesticInfo.passportPhoto }] : []),
        ]
      : [];

    return (
      <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={() => setDetailOrder(null)}>
        <section
          className="license-translation-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label="查看订单"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="license-translation-detail-modal__header">
            <div>
              <strong>查看订单</strong>
              <span>{order.orderId}</span>
            </div>
            <button type="button" onClick={() => setDetailOrder(null)} aria-label="关闭">
              ×
            </button>
          </header>

          <div className="license-translation-detail-modal__body">
            <section className="license-translation-detail-section">
              <h3>商品信息</h3>
              <div className="license-translation-detail-grid license-translation-detail-grid--product">
                {productItems.map(([label, value]) => (
                  <div key={label} className="license-translation-detail-field">
                    <span>{label}</span>
                    <strong>{getDisplayValue(value)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="license-translation-detail-section">
              <h3>驾照信息</h3>
              <div className="license-translation-detail-grid">
                {licenseItems.map(([label, value]) => (
                  <div
                    key={label}
                    className={`license-translation-detail-field ${
                      label === '其他' ? 'license-translation-detail-field--wide' : ''
                    }`}
                  >
                    <span>{label}</span>
                    <strong>{getDisplayValue(value)}</strong>
                  </div>
                ))}
              </div>

              <div className="license-translation-attachments" aria-label="上传附件">
                {attachmentItems.length > 0 ? (
                  attachmentItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="license-translation-attachment"
                      onClick={() => setPreviewImage(item)}
                    >
                      <div className="license-translation-attachment__preview">
                        <ResolvedImage src={item.src} alt={`${item.label}预览`} />
                      </div>
                      <span className="license-translation-attachment__caption">{item.label}</span>
                    </button>
                  ))
                ) : (
                  <div className="license-translation-attachments__empty">暂无上传附件</div>
                )}
              </div>
            </section>
          </div>

          <footer className="license-translation-detail-modal__footer">
            <button type="button" className="license-translation-button" onClick={() => setDetailOrder(null)}>
              关闭
            </button>
          </footer>
        </section>
      </div>
    );
  };


  return (
    <div className="license-translation-page animate-fadeIn">
      {toast && (
        <div className="toast-container">
          <div className="toast toast--success">{toast}</div>
        </div>
      )}
      {renderOrderDetailModal()}
      {renderOcrCompareModal()}
      {previewImage && (
        <div className="license-translation-image-backdrop" role="presentation" onMouseDown={() => setPreviewImage(null)}>
          <section
            className="license-translation-image-modal"
            role="dialog"
            aria-modal="true"
            aria-label={previewImage.label}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="license-translation-image-modal__header">
              <strong>{previewImage.label}</strong>
              <button type="button" onClick={() => setPreviewImage(null)} aria-label="关闭">
                ×
              </button>
            </header>
            <div className="license-translation-image-modal__body">
              <ResolvedImage src={previewImage.src} alt={previewImage.label} />
            </div>
          </section>
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
                <span>物流公司</span>
                <select value={shippingCompany} onChange={(event) => setShippingCompany(event.target.value)}>
                  <option value="">请选择物流公司</option>
                  {LOGISTICS_COMPANY_OPTIONS.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>物流单号</span>
                <input
                  value={shippingTrackingNumber}
                  placeholder="请输入物流单号"
                  onChange={(event) => setShippingTrackingNumber(event.target.value)}
                />
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
            非标宣誓公证件
            <span>/</span>
            中文翻译件
          </div>
          <h1>中文翻译件</h1>
        </div>
      </header>

      <section className="license-translation-filter">
        <label>
          <span>订单号搜索</span>
          <input value={filterOrderId} onChange={(event) => setFilterOrderId(event.target.value)} placeholder="请输入订单号" />
        </label>

        <label>
          <span>综合搜索</span>
          <input
            value={filterKeyword}
            onChange={(event) => setFilterKeyword(event.target.value)}
            placeholder="请输入中文姓名、驾驶证编号、手机号..."
          />
        </label>

        <label>
          <span>办理类型</span>
          <select value={filterProcessType} onChange={(event) => setFilterProcessType(event.target.value)}>
            <option value="">全部办理类型</option>
            {processTypeOptions.map((processType) => (
              <option key={processType.value} value={processType.value}>
                {processType.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>驾驶证发放国家及城市</span>
          <div className="license-translation-linked-selects">
            <select
              value={filterForeignCountry}
              onChange={(event) => {
                setFilterForeignCountry(event.target.value);
                setFilterForeignCity('');
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
              value={filterForeignCity}
              disabled={!filterForeignCountry}
              onChange={(event) => setFilterForeignCity(event.target.value)}
            >
              <option value="">全部城市</option>
              {foreignCityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
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
        <div className="license-translation-status-tabs">
          <div className="license-translation-status-tabs__list">
            {PRODUCTION_STATUS_OPTIONS.map((item) => (
              <button
                key={item.value || 'all'}
                type="button"
                className={`license-translation-status-tabs__item ${filterStatus === item.value ? 'license-translation-status-tabs__item--active' : ''}`}
                onClick={() => {
                  setFilterStatus(item.value);
                  setCurrentPage(1);
                  if (item.value) {
                    setSearchParams({ status: item.value });
                  } else {
                    setSearchParams({});
                  }
                }}
              >
                <span>{`${item.label}（${statusCounts[item.value]}）`}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="license-translation-button license-translation-button--secondary license-translation-status-tabs__export"
            disabled={isExporting || filteredOrders.length === 0}
            onClick={handleExport}
          >
            {isExporting ? '导出中...' : '导出'}
          </button>
        </div>

        <div className="license-translation-table-wrap">
          <table className="license-translation-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>订单号</th>
                <th>订单类型</th>
                <th>发起时间</th>
                <th>订单信息</th>
                <th>收货信息</th>
                <th>订单状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="license-translation-empty">
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
                      <td>{order.createdAt}</td>
                      <td>
                        <div className="license-translation-info">
                          {(() => {
                            const orderInfo = getOrderInfo(order);

                            return (
                              <>
                                <div className="license-translation-order-product">
                                  <span>{`商品：${orderInfo.productName}`}</span>
                                  <button
                                    type="button"
                                    className={`license-translation-process-pill license-translation-process-pill--${orderInfo.processTypeTone}`}
                                    tabIndex={-1}
                                  >
                                    {orderInfo.processTypeLabel}
                                  </button>
                                </div>
                                <span>{`驾驶证发放国家及城市：${orderInfo.foreignLocation}`}</span>
                                {orderInfo.exchangeLocation ? <span>{`换证城市：${orderInfo.exchangeLocation}`}</span> : null}
                                <span>{`中文姓名：${orderInfo.chineseName}`}</span>
                                <span>{`驾驶证编号：${orderInfo.licenseNumber}`}</span>
                                <div className="license-translation-order-category-row">
                                  <span>准驾车型：</span>
                                  <button type="button" className="license-translation-order-category-pill" tabIndex={-1}>
                                    {orderInfo.licenseCategory}
                                  </button>
                                </div>
                              </>
                            );
                          })()}
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
                        <div className="license-translation-status-cell">
                          <div className="license-translation-status-row">
                            <span className={getProductionStatusClassName(productionStatus)}>
                              {getProductionStatusLabel(productionStatus)}
                            </span>
                            {productionStatus !== 'untranslated' ? (
                              <span className="license-translation-status-info-wrap">
                                <button
                                  type="button"
                                  className="license-translation-status-info-button"
                                  onClick={() => toggleProductionFlowPopover(order)}
                                  aria-label={`查看${order.orderId}生产记录`}
                                  title="查看生产记录"
                                >
                                  ?
                                </button>
                                {activeProductionFlowOrderId === order.orderId
                                  ? renderProductionFlowPopover(order, productionStatus)
                                  : null}
                              </span>
                            ) : null}
                          </div>
                          {productionStatus === 'shipped' ? (
                            <div className="license-translation-info license-translation-info--shipping">
                              {getShippingInfo(order).map((item) => (
                                <span key={item}>{item}</span>
                              ))}
                            </div>
                          ) : null}
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
