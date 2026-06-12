import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import { getStoredAuthSession } from '../../shared/utils/auth';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { exportTranslationOrders } from '../../shared/utils/exportTranslationOrders';
import { getOrders, updateOrder } from '../../services/mockDataService';
import type { Order } from '../../shared/types';
import './ChineseTranslationOrders.css';

type CtripStandardStatus = 'untranslated' | 'unmade' | 'unshipped' | 'shipped' | 'recycle' | 'cancelled';
type OrderTypeFilter = '全部' | '携程普通订单' | '携程加急订单' | '去哪儿普通订单' | '去哪儿加急订单';
type CertificateTypeFilter = '全部' | '五证标准翻译件' | '新版标准翻译件' | '国际驾照';
type RegionFilter = '全部区域' | '江浙沪皖' | '非江浙沪皖' | '北京' | '新疆西藏';
type PaymentMethod = '携程API';
type PaymentStatus = '未翻译' | '未制作' | '未发货' | '已发货' | '回收站' | '已取消';

interface DecoratedOrder {
  certificateType: Exclude<CertificateTypeFilter, '全部'>;
  content: string;
  order: Order;
  orderType: Exclude<OrderTypeFilter, '全部'>;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  region: Exclude<RegionFilter, '全部区域'>;
  status: CtripStandardStatus;
}

const CERTIFICATE_TYPE_OPTIONS: CertificateTypeFilter[] = ['全部', '五证标准翻译件', '新版标准翻译件', '国际驾照'];
const ORDER_TYPE_OPTIONS: OrderTypeFilter[] = ['全部', '携程普通订单', '携程加急订单', '去哪儿普通订单', '去哪儿加急订单'];
const REGION_OPTIONS: RegionFilter[] = ['全部区域', '江浙沪皖', '非江浙沪皖', '北京', '新疆西藏'];
const STATUS_TABS: Array<{ label: string; value: '' | CtripStandardStatus }> = [
  { label: '全部订单', value: '' },
  { label: '未翻译', value: 'untranslated' },
  { label: '未制作', value: 'unmade' },
  { label: '未发货', value: 'unshipped' },
  { label: '已发货', value: 'shipped' },
  { label: '回收站', value: 'recycle' },
  { label: '已取消', value: 'cancelled' },
];
const DEFAULT_STATUS: CtripStandardStatus = 'untranslated';

const TRANSLATED_ACTION = '已翻译';
const MADE_ACTION = '已制作';
const SHIPPED_ACTION = '已发货';
const RECYCLE_ACTION = '移入回收站';
const DEFAULT_BATCH_COMPANY = '系统批量发货';
const STANDARD_ORDER_TYPE_LABEL = '标准件 新版';
const CTRIP_API_PAYMENT_METHOD: PaymentMethod = '携程API';
const CHANNEL_LABELS: Record<Order['channel'], string> = {
  ctrip: '携程',
  fliggy: '飞猪',
  private: '私域',
  offline: '线下代理',
};
const CONTENT_OVERRIDES: Record<string, Array<[string, string]>> = {
  MK2600077: [
    ['驾照号', '110102196902022315'],
    ['中文姓名', '任卫利'],
    ['准驾车型', 'C1'],
  ],
  MK2600078: [
    ['驾照号', '420704199612091613'],
    ['中文姓名', '张维淮'],
    ['准驾车型', 'C1'],
  ],
};
const LICENSE_DETAIL_OVERRIDES: Record<string, Array<[string, string]>> = {
  MK2600077: [
    ['驾照号', '110102196902022315'],
    ['姓名', 'RENWEILI'],
    ['中文姓名', '任卫利'],
    ['发证地区', '北京市'],
    ['发证机构', '公安局公安交通管理局'],
    ['性别', '男'],
    ['国籍', 'China'],
    ['现住址', '北京市西城区二七剧场路1号3门13号'],
    ['出生日期', '1969-02-02'],
    ['准驾车型', 'C1'],
    ['初次领证日期', '2005-06-21'],
    ['有效起始日期', '2021-06-21'],
    ['有效年限', '（长期）'],
  ],
};
const NORMAL_LICENSE_NUMBERS = [
  '420704199612091613',
  '340321199211208918',
  '420203197309153735',
  '110101198903125612',
  '320311199412068274',
  '440106199508103245',
  '330106199604182117',
  '510107199302146428',
  '210102198811103516',
  '500112199707256341',
];
const URGENT_ORDER_IDS = new Set(['MK2600076', 'MK2600078', 'MK2600080', 'MK2600088']);

const getOrderSerial = (orderId: string) => {
  const matchedValue = orderId.match(/(\d+)$/)?.[1];
  return Number(matchedValue || 0);
};

const hasAction = (order: Order, action: string) => order.logs.some((log) => log.action.includes(action));

const getOrderStatus = (order: Order): CtripStandardStatus => {
  if (hasAction(order, RECYCLE_ACTION) || order.remark.includes('[回收站]')) return 'recycle';
  if (order.status === 'cancelled' || order.status === 'rejected') return 'cancelled';
  if (order.status === 'shipped' || order.status === 'completed' || hasAction(order, SHIPPED_ACTION)) return 'shipped';
  if (order.status === 'in_production' || hasAction(order, MADE_ACTION)) return 'unshipped';
  if (hasAction(order, TRANSLATED_ACTION)) return 'unmade';
  return 'untranslated';
};

const getCertificateType = (order: Order): Exclude<CertificateTypeFilter, '全部'> => {
  const serial = getOrderSerial(order.orderId);
  const options: Array<Exclude<CertificateTypeFilter, '全部'>> = ['五证标准翻译件', '新版标准翻译件', '国际驾照'];
  return options[serial % options.length];
};

const getSourceChannelLabel = (order: Order) => (getOrderSerial(order.orderId) % 2 === 0 ? '携程' : '去哪儿');

const getUrgentLabel = (order: Order) =>
  URGENT_ORDER_IDS.has(order.orderId) || order.processType.includes('urgent') || order.processType.includes('加急') ? '是' : '否';

const getOrderType = (order: Order): Exclude<OrderTypeFilter, '全部'> => {
  const source = getSourceChannelLabel(order);
  const urgency = getUrgentLabel(order) === '是' ? '加急订单' : '普通订单';

  return `${source}${urgency}` as Exclude<OrderTypeFilter, '全部'>;
};

const getRegion = (order: Order): Exclude<RegionFilter, '全部区域'> => {
  const address = order.deliveryAddress || '';
  const foreignCountry = order.domesticLicenseInfo?.foreignCountry || '';

  if (address.includes('北京')) return '北京';
  if (address.includes('新疆') || address.includes('西藏') || foreignCountry.includes('西藏') || foreignCountry.includes('新疆')) return '新疆西藏';
  if (/(江苏|浙江|上海|安徽)/.test(address)) return '江浙沪皖';
  return '非江浙沪皖';
};

const getLegacyOrderType = (order: Order): Exclude<OrderTypeFilter, '全部'> => {
  const serial = getOrderSerial(order.orderId);
  const options: Array<Exclude<OrderTypeFilter, '全部'>> = ['携程普通订单', '携程加急订单', '去哪儿普通订单', '去哪儿加急订单'];
  return options[serial % options.length];
};

const getLegacyRegion = (order: Order): Exclude<RegionFilter, '全部区域'> => {
  const serial = getOrderSerial(order.orderId);
  const options: Array<Exclude<RegionFilter, '全部区域'>> = ['江浙沪皖', '非江浙沪皖', '北京', '新疆西藏'];
  const foreignCountry = order.domesticLicenseInfo?.foreignCountry || '';

  if (foreignCountry.includes('西藏') || foreignCountry.includes('新疆')) return '新疆西藏';
  return options[serial % options.length];
};

const getPaymentMethod = (_order: Order): PaymentMethod => {
  return CTRIP_API_PAYMENT_METHOD;
};

const getNormalLicenseNumber = (order: Order) => {
  const rawValue = order.licenseNo || order.domesticLicenseInfo?.licenseNumber || '';
  if (/^\d{17}[\dX]$/i.test(rawValue)) return rawValue;
  return NORMAL_LICENSE_NUMBERS[getOrderSerial(order.orderId) % NORMAL_LICENSE_NUMBERS.length];
};

const getNormalLicenseCategory = (order: Order) => {
  return 'C1';
};

const getNormalChineseName = (order: Order) => {
  const rawValue = (order.licenseName || order.customerName || '').trim();
  if (!rawValue || /测试|样例|test|demo/i.test(rawValue)) return '张三';
  return rawValue;
};

const getLicenseDetailRows = (order: Order) => {
  const overrideRows = LICENSE_DETAIL_OVERRIDES[order.orderId];
  if (overrideRows) return overrideRows;

  const info = order.domesticLicenseInfo;
  const name = getNormalChineseName(order);

  return [
    ['驾照号', getNormalLicenseNumber(order)],
    ['姓名', [info?.surname, info?.givenName].filter(Boolean).join('') || 'ZHANGSAN'],
    ['中文姓名', name],
    ['性别', order.licenseGender || info?.sex || '男'],
    ['国籍', order.licenseNationality || 'China'],
    ['出生日期', order.licenseBirthDate || info?.birthDate || '1996-02-13'],
    ['准驾车型', getNormalLicenseCategory(order)],
    ['现住址', order.licenseAddress || order.deliveryAddress || '江苏省南通市崇川区学田苑153幢303室'],
    ['初次领证日期', order.licenseFirstIssueDate || info?.issueDate || '2016-07-26'],
    ['有效起始日期', order.licenseValidFromDate || order.licenseFirstIssueDate || info?.issueDate || '2022-07-26'],
    ['有效年限', order.licenseValidYears || '10年'],
    ['发证地区', order.licenseIssuingRegion || [info?.exchangeProvince, info?.exchangeCity].filter(Boolean).join(' ') || '江苏省 南通市'],
    ['发证机构', order.licenseIssuingAuthority || '公安局交通警察支队'],
  ];
};

const getContentRows = (order: Order) =>
  CONTENT_OVERRIDES[order.orderId] || [
    ['驾照号', getNormalLicenseNumber(order)],
    ['中文姓名', getNormalChineseName(order)],
    ['准驾车型', getNormalLicenseCategory(order)],
  ];

const buildContent = (order: Order, _certificateType: DecoratedOrder['certificateType']) =>
  getContentRows(order).map(([label, value]) => `${label}：${value}`).join('，');

const getCtripApiOrderNo = (order: Order) => order.managementOrderId || String(1128148090749058 + getOrderSerial(order.orderId));

const getDepartureDate = (order: Order) => order.licenseBirthDate || order.domesticLicenseInfo?.birthDate || '1970-01-01';

const getOrderInfoRows = (order: Order, status?: CtripStandardStatus) => {
  const rows = [
    ['收件人', order.customerName || order.licenseName || '--'],
    ['收货地址', order.deliveryAddress || '--'],
    ['手机号', order.customerPhone || '--'],
    ['邮箱', order.customerEmail || '--'],
    ['离境日期', getDepartureDate(order)],
    ['加急', getUrgentLabel(order)],
    ['订单数量', '1'],
    ['来源渠道', getSourceChannelLabel(order)],
  ];

  if (status !== 'untranslated') {
    rows.push(
      ['快递单号', order.trackingNumber || '--'],
      ['快递名称', order.logisticsCompany || '--'],
      ['发货时间', order.shippedAt || '--'],
    );
  }

  return rows;
};

const getStatusLabel = (status: CtripStandardStatus): PaymentStatus => {
  const labelMap: Record<CtripStandardStatus, PaymentStatus> = {
    untranslated: '未翻译',
    unmade: '未制作',
    unshipped: '未发货',
    shipped: '已发货',
    recycle: '回收站',
    cancelled: '已取消',
  };

  return labelMap[status];
};

const getStatusClassName = (status: CtripStandardStatus) => {
  const toneMap: Record<CtripStandardStatus, string> = {
    untranslated: 'warning',
    unmade: 'processing',
    unshipped: 'pending',
    shipped: 'shipped',
    recycle: 'cancelled',
    cancelled: 'cancelled',
  };

  return `license-translation-status license-translation-status--${toneMap[status]}`;
};

const isCtripStandardVisibleOrder = (order: Order) => order.productCategory === 'domestic_license';

const CtripStandardTranslationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderVersion, setOrderVersion] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<DecoratedOrder | null>(null);

  const [certificateType, setCertificateType] = useState<CertificateTypeFilter>(() => {
    const value = searchParams.get('certificateType');
    return CERTIFICATE_TYPE_OPTIONS.includes(value as CertificateTypeFilter) ? (value as CertificateTypeFilter) : '全部';
  });
  const [orderType, setOrderType] = useState<OrderTypeFilter>(() => {
    const value = searchParams.get('orderType');
    return ORDER_TYPE_OPTIONS.includes(value as OrderTypeFilter) ? (value as OrderTypeFilter) : '全部';
  });
  const [region, setRegion] = useState<RegionFilter>(() => {
    const value = searchParams.get('region');
    return REGION_OPTIONS.includes(value as RegionFilter) ? (value as RegionFilter) : '全部区域';
  });
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');

  const currentOperatorName = useMemo(() => {
    const session = getStoredAuthSession();
    return session?.displayName?.trim() || session?.username?.trim() || '生产端';
  }, []);

  const allOrders = useMemo(
    () =>
      getOrders()
        .filter(isCtripStandardVisibleOrder)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((order) => {
          const certificateTypeValue = getCertificateType(order);
          const status = getOrderStatus(order);
          return {
            certificateType: certificateTypeValue,
            content: buildContent(order, certificateTypeValue),
            order,
            orderType: getOrderType(order),
            paymentMethod: getPaymentMethod(order),
            paymentStatus: getStatusLabel(status),
            region: getRegion(order),
            status,
          } satisfies DecoratedOrder;
        }),
    [orderVersion],
  );

  const appliedStatus = (() => {
    const value = searchParams.get('status');
    if (value === 'all') return '';
    return STATUS_TABS.some((item) => item.value === value) ? (value as '' | CtripStandardStatus) : DEFAULT_STATUS;
  })();
  const appliedCertificateType = (() => {
    const value = searchParams.get('certificateType');
    return CERTIFICATE_TYPE_OPTIONS.includes(value as CertificateTypeFilter) ? (value as CertificateTypeFilter) : '全部';
  })();
  const appliedOrderType = (() => {
    const value = searchParams.get('orderType');
    return ORDER_TYPE_OPTIONS.includes(value as OrderTypeFilter) ? (value as OrderTypeFilter) : '全部';
  })();
  const appliedRegion = (() => {
    const value = searchParams.get('region');
    return REGION_OPTIONS.includes(value as RegionFilter) ? (value as RegionFilter) : '全部区域';
  })();
  const appliedStartDate = searchParams.get('startDate') || '';
  const appliedEndDate = searchParams.get('endDate') || '';
  const appliedKeyword = (searchParams.get('keyword') || '').trim().toLowerCase();

  useEffect(() => {
    setCertificateType(appliedCertificateType);
    setOrderType(appliedOrderType);
    setRegion(appliedRegion);
    setStartDate(appliedStartDate);
    setEndDate(appliedEndDate);
    setKeyword(searchParams.get('keyword') || '');
  }, [appliedCertificateType, appliedEndDate, appliedOrderType, appliedRegion, appliedStartDate, searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchParams]);

  const matchesQuery = (item: DecoratedOrder, statusFilter: '' | CtripStandardStatus, includeStatus: boolean) => {
    if (includeStatus && statusFilter && item.status !== statusFilter) return false;
    if (appliedCertificateType !== '全部' && item.certificateType !== appliedCertificateType) return false;
    if (appliedOrderType !== '全部' && item.orderType !== appliedOrderType) return false;
    if (appliedRegion !== '全部区域' && item.region !== appliedRegion) return false;

    if (appliedStartDate && item.order.createdAt < `${appliedStartDate} 00:00:00`) return false;
    if (appliedEndDate && item.order.createdAt > `${appliedEndDate} 23:59:59`) return false;

    if (appliedKeyword) {
      const searchableText = [
        item.order.orderId,
        item.order.customerName,
        item.order.licenseName,
        item.order.customerPhone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(appliedKeyword)) return false;
    }

    return true;
  };

  const filteredOrders = useMemo(
    () => allOrders.filter((item) => matchesQuery(item, appliedStatus, true)),
    [allOrders, appliedCertificateType, appliedEndDate, appliedKeyword, appliedOrderType, appliedRegion, appliedStartDate, appliedStatus],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<'' | CtripStandardStatus, number> = {
      '': 0,
      untranslated: 0,
      unmade: 0,
      unshipped: 0,
      shipped: 0,
      recycle: 0,
      cancelled: 0,
    };

    allOrders.forEach((item) => {
      if (!matchesQuery(item, '', false)) {
        return;
      }

      counts[''] += 1;
      counts[item.status] += 1;
    });

    return counts;
  }, [allOrders, appliedCertificateType, appliedEndDate, appliedKeyword, appliedOrderType, appliedRegion, appliedStartDate]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const applyFilters = (nextStatus = appliedStatus) => {
    const nextParams = new URLSearchParams();

    if (nextStatus) nextParams.set('status', nextStatus);
    if (nextStatus === '') nextParams.set('status', 'all');
    if (certificateType !== '全部') nextParams.set('certificateType', certificateType);
    if (orderType !== '全部') nextParams.set('orderType', orderType);
    if (region !== '全部区域') nextParams.set('region', region);
    if (startDate) nextParams.set('startDate', startDate);
    if (endDate) nextParams.set('endDate', endDate);
    if (keyword.trim()) nextParams.set('keyword', keyword.trim());

    setSearchParams(nextParams);
  };

  const handleReset = () => {
    setCertificateType('全部');
    setOrderType('全部');
    setRegion('全部区域');
    setStartDate('');
    setEndDate('');
    setKeyword('');
    setSearchParams(new URLSearchParams({ status: DEFAULT_STATUS }));
  };

  const buildExportRow = (item: DecoratedOrder) => ({
    orderId: item.order.orderId,
    createdAt: item.order.createdAt,
    productName: item.content,
    processTypeLabel: STANDARD_ORDER_TYPE_LABEL,
    agentName: item.paymentMethod,
    recipientInfo: `${item.order.customerName} / ${item.order.customerPhone}`,
    licenseInfo: getOrderInfoRows(item.order, item.status).map(([label, value]) => `${label}：${value}`).join('；'),
    statusLabel: getStatusLabel(item.status),
    logisticsInfo: `${item.order.logisticsCompany || '--'} / ${item.order.trackingNumber || '--'}`,
    price: item.order.lockedPrice,
    primaryAccount: item.paymentStatus,
  });

  const exportRows = filteredOrders.map(buildExportRow);

  const handleExport = async () => {
    if (exportRows.length === 0) {
      showToast('当前筛选条件下没有可导出的订单');
      return;
    }

    try {
      await exportTranslationOrders(exportRows, `Api接口标准件_${formatBeijingTimestamp().replace(/[:\s]/g, '-')}.xlsx`);
      showToast('导出成功');
    } catch (error) {
      console.error(error);
      showToast('导出失败，请稍后重试');
    }
  };

  const markOrderShipped = (order: Order, trackingNumber: string, logisticsCompany = DEFAULT_BATCH_COMPANY) => {
    const timestamp = formatBeijingTimestamp();
    const nextLogs = [
      ...order.logs.filter((log) => !log.action.includes(RECYCLE_ACTION)),
      { time: timestamp, operator: currentOperatorName, action: SHIPPED_ACTION },
      { time: timestamp, operator: currentOperatorName, action: `物流发货：${logisticsCompany} ${trackingNumber}` },
    ];

    updateOrder(order.orderId, {
      status: 'shipped',
      logisticsCompany,
      trackingNumber,
      shippedAt: timestamp,
      updatedAt: timestamp,
      logs: nextLogs,
      remark: order.remark.replace('[回收站]', '').trim(),
    });
  };

  const handleShip = (item: DecoratedOrder) => {
    if (item.status !== 'unshipped' && item.status !== 'shipped') {
      showToast('当前订单状态不可发货');
      return;
    }

    if (item.status === 'shipped') {
      showToast(`订单 ${item.order.orderId} 已是发货状态`);
      return;
    }

    markOrderShipped(item.order, `SF${String(Date.now()).slice(-8)}${String(getOrderSerial(item.order.orderId)).padStart(2, '0')}`);
    setOrderVersion((version) => version + 1);
    showToast(`订单 ${item.order.orderId} 已发货`);
  };

  const handleMarkTranslated = (item: DecoratedOrder) => {
    if (item.status !== 'untranslated') {
      showToast('当前订单状态不可翻译');
      return;
    }

    const timestamp = formatBeijingTimestamp();
    updateOrder(item.order.orderId, {
      updatedAt: timestamp,
      logs: [...item.order.logs, { time: timestamp, operator: currentOperatorName, action: TRANSLATED_ACTION }],
    });
    setOrderVersion((version) => version + 1);
    showToast(`订单 ${item.order.orderId} 已翻译`);
  };

  const handleMarkMade = (item: DecoratedOrder) => {
    if (item.status !== 'unmade') {
      showToast('当前订单状态不可制作完成');
      return;
    }

    const timestamp = formatBeijingTimestamp();
    updateOrder(item.order.orderId, {
      status: 'in_production',
      updatedAt: timestamp,
      logs: [...item.order.logs, { time: timestamp, operator: currentOperatorName, action: MADE_ACTION }],
    });
    setOrderVersion((version) => version + 1);
    showToast(`订单 ${item.order.orderId} 已制作完成`);
  };

  const handleExportSingle = async (item: DecoratedOrder, suffix = '') => {
    try {
      await exportTranslationOrders(
        [buildExportRow(item)],
        `${item.order.orderId}${suffix || '_导出订单'}_${formatBeijingTimestamp().replace(/[:\s]/g, '-')}.xlsx`,
      );
      showToast(`${item.order.orderId} 导出成功`);
    } catch (error) {
      console.error(error);
      showToast('导出失败，请稍后重试');
    }
  };

  const handlePrintAction = (item: DecoratedOrder, label: string) => {
    showToast(`${item.order.orderId} ${label}已生成`);
  };

  const handleSendEms = (item: DecoratedOrder) => {
    showToast(`${item.order.orderId} 已发送EMS`);
  };

  const handleBatchShip = () => {
    const shippableOrders = filteredOrders.filter((item) => item.status === 'unshipped');
    if (shippableOrders.length === 0) {
      showToast('当前筛选结果中没有可发货订单');
      return;
    }

    if (!window.confirm(`确认一键发货吗？将批量发货 ${shippableOrders.length} 笔未发货订单。`)) {
      return;
    }

    const batchSeed = String(Date.now()).slice(-8);
    shippableOrders.forEach((item, index) => {
      markOrderShipped(item.order, `SF${batchSeed}${String(index + 1).padStart(2, '0')}`);
    });

    setOrderVersion((version) => version + 1);
    showToast(`已批量发货 ${shippableOrders.length} 笔订单`);
  };

  const renderActionButton = (
    item: DecoratedOrder,
    label: string,
    onClick: () => void,
    tone: 'view' | 'orange' | 'danger' = 'view',
  ) => (
    <button
      key={label}
      type="button"
      className={`license-translation-action-button license-translation-action-button--${tone}`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const renderCommonOutputActions = (item: DecoratedOrder) => [
    renderActionButton(item, '导出订单', () => handleExportSingle(item)),
    renderActionButton(item, '导出订单-极兔', () => handleExportSingle(item, '_导出订单-极兔')),
    renderActionButton(item, '打印顺丰', () => handlePrintAction(item, '打印顺丰')),
    renderActionButton(item, '打印JD', () => handlePrintAction(item, '打印JD')),
  ];

  const renderActions = (item: DecoratedOrder) => {
    if (item.status === 'recycle' || item.status === 'cancelled') {
      return <span className="license-translation-actions__empty">--</span>;
    }

    const actions = [
      renderActionButton(item, '查看订单', () => setDetailOrder(item)),
      ...renderCommonOutputActions(item),
    ];

    if (item.status === 'untranslated') {
      actions.unshift(renderActionButton(item, '翻译订单', () => handleMarkTranslated(item), 'orange'));
    }

    if (item.status === 'unmade') {
      actions.push(renderActionButton(item, '制作完成', () => handleMarkMade(item), 'orange'));
    }

    if (item.status === 'unshipped' || item.status === 'shipped') {
      actions.push(
        renderActionButton(item, '发货', () => handleShip(item), 'orange'),
        renderActionButton(item, '发送EMS', () => handleSendEms(item), 'orange'),
      );
    }

    return <>{actions}</>;
  };

  return (
    <div className="license-translation-page animate-fadeIn">
      <header className="license-translation-topbar">
        <div>
          <div className="license-translation-breadcrumb">
            驾照官后台
            <span>/</span>
            携程标准件
            <span>/</span>
            Api接口标准件
          </div>
          <h1>Api接口标准件</h1>
        </div>
      </header>

      <section className="license-translation-filter ctrip-standard-filter">
        <label>
          <span>搜索</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="支持订单号、姓名、手机号搜索"
          />
        </label>

        <label>
          <span>翻译件类型</span>
          <select value={certificateType} onChange={(event) => setCertificateType(event.target.value as CertificateTypeFilter)}>
            {CERTIFICATE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>订单来源</span>
          <select value={orderType} onChange={(event) => setOrderType(event.target.value as OrderTypeFilter)}>
            {ORDER_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>区域</span>
          <select value={region} onChange={(event) => setRegion(event.target.value as RegionFilter)}>
            {REGION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="license-translation-filter__field ctrip-standard-filter__date-range">
          <span>时间区间</span>
          <div className="license-translation-linked-selects">
            <DatePickerInput ariaLabel="开始时间" placeholder="开始时间" value={startDate} onChange={setStartDate} />
            <DatePickerInput ariaLabel="结束时间" placeholder="结束时间" value={endDate} onChange={setEndDate} />
          </div>
        </div>

        <div className="license-translation-filter__actions ctrip-standard-filter__actions">
          <button type="button" className="license-translation-button license-translation-button--primary" onClick={() => applyFilters()}>
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
            {STATUS_TABS.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`license-translation-status-tabs__item ${appliedStatus === item.value ? 'license-translation-status-tabs__item--active' : ''}`}
                onClick={() => applyFilters(item.value)}
              >
                <span>{item.label}</span>
                <strong>{statusCounts[item.value]}</strong>
              </button>
            ))}
          </div>
          <div className="license-translation-filter__actions">
            <button
              type="button"
              className="license-translation-button license-translation-button--secondary license-translation-status-tabs__export"
              onClick={handleExport}
            >
              导出
            </button>
            <button
              type="button"
              className="license-translation-button license-translation-button--primary"
              onClick={handleBatchShip}
            >
              一键发货
            </button>
          </div>
        </div>

        <div className="license-translation-table-wrap">
          <table className="license-translation-table ctrip-standard-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>订单号</th>
                <th>订单类型</th>
                <th>内容</th>
                <th>发起时间</th>
                <th>付款方式</th>
                <th>付款状态</th>
                <th>订单信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((item, index) => (
                  <tr key={item.order.orderId}>
                    <td>{(currentPage - 1) * pageSize + index + 1}</td>
                    <td>
                      <div className="license-translation-order-number">
                        <strong>{item.order.orderId}</strong>
                        <span>{`携程API:${getCtripApiOrderNo(item.order)}`}</span>
                      </div>
                    </td>
                    <td>{STANDARD_ORDER_TYPE_LABEL}</td>
                    <td>
                      <dl className="license-translation-order-info-table ctrip-standard-content-table">
                        {getContentRows(item.order).map(([label, value]) => (
                          <div key={label} className={label === '驾照号' ? 'license-translation-order-info-table__row--nowrap' : undefined}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                    <td className="license-translation-time-cell">{item.order.createdAt.replace(' ', '\n')}</td>
                    <td>{item.paymentMethod}</td>
                    <td>{item.paymentStatus}</td>
                    <td>
                      <dl className="license-translation-order-info-table">
                        {getOrderInfoRows(item.order, item.status).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                    <td>
                      <div className="license-translation-actions">
                        {renderActions(item)}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="license-translation-empty">
                    当前筛选条件下没有Api接口标准件订单
                  </td>
                </tr>
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

      {detailOrder && (
        <div className="license-translation-modal-backdrop" role="presentation" onMouseDown={() => setDetailOrder(null)}>
          <section
            className="license-translation-detail-modal ctrip-standard-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="订单详情"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="license-translation-detail-modal__header">
              <div>
                <strong>驾照信息</strong>
                <span>{detailOrder.order.orderId}</span>
              </div>
              <button type="button" onClick={() => setDetailOrder(null)} aria-label="关闭">
                ×
              </button>
            </header>

            <div className="license-translation-detail-modal__body">
              <div className="ctrip-standard-license-detail">
                {getLicenseDetailRows(detailOrder.order).map(([label, value]) => (
                  <div key={label} className={label === '现住址' ? 'ctrip-standard-license-detail__field ctrip-standard-license-detail__field--wide' : 'ctrip-standard-license-detail__field'}>
                    <span>{`${label}:`}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <footer className="license-translation-detail-modal__footer">
              <button type="button" className="license-translation-button" onClick={() => setDetailOrder(null)}>
                关闭
              </button>
            </footer>
          </section>
        </div>
      )}

      {toast && <div className="license-translation-toast">{toast}</div>}
    </div>
  );
};

export default CtripStandardTranslationPage;
