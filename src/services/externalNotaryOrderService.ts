export type ExternalNotaryOrderStatus = 'unpushed' | 'pushed' | 'rejected';

export interface ExternalNotaryOrderLog {
  time: string;
  operator: string;
  action: string;
}

export interface ExternalNotaryOrderAttachment {
  key: string;
  title: string;
  name: string;
  src: string;
}

export interface ExternalNotaryOrder {
  orderId: string;
  createdAt: string;
  updatedAt: string;
  productName: string;
  serviceName?: string;
  useCountry?: string;
  language: string;
  customerName: string;
  agentName: string;
  licenseName: string;
  licenseNo: string;
  surnamePinyin?: string;
  givenNamePinyin?: string;
  remark?: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  status: ExternalNotaryOrderStatus;
  pushedNotaryOfficeName: string;
  reviewRemark: string;
  rejectReason?: string;
  logs: ExternalNotaryOrderLog[];
  attachments: ExternalNotaryOrderAttachment[];
}

const EXTERNAL_NOTARY_ORDER_STORAGE_KEY = 'meika-external-notary-orders';
const EXTERNAL_NOTARY_ORDER_DATA_VERSION_STORAGE_KEY = 'meika-external-notary-orders-version';
const EXTERNAL_NOTARY_ORDER_DATA_VERSION = 'v7-external-notary-order-service-name';

const DEFAULT_EXTERNAL_NOTARY_ORDERS: ExternalNotaryOrder[] = [
  {
    orderId: 'A260001',
    createdAt: '2026-07-01 09:18:22',
    updatedAt: '2026-07-01 09:18:22',
    productName: '公证办理服务',
    serviceName: 'normal',
    useCountry: '美国',
    language: '英语',
    customerName: '周若琪',
    agentName: '上海美卡服务中心',
    licenseName: '周若琪',
    licenseNo: 'C310100998877',
    surnamePinyin: 'ZHOU',
    givenNamePinyin: 'RUOQI',
    remark: '',
    recipientName: '周若琪',
    recipientPhone: '13800001111',
    deliveryAddress: '上海市浦东新区世纪大道100号',
    logisticsCompany: '',
    trackingNumber: '',
    status: 'unpushed',
    pushedNotaryOfficeName: '',
    reviewRemark: '',
    rejectReason: '',
    logs: [
      {
        time: '2026-07-01 09:18:22',
        operator: '外采系统',
        action: '外采订单创建',
      },
    ],
    attachments: [],
  },
  {
    orderId: 'A260002',
    createdAt: '2026-07-01 11:42:10',
    updatedAt: '2026-07-01 14:06:35',
    productName: '公证办理服务',
    serviceName: 'normal',
    useCountry: '法国',
    language: '法语',
    customerName: '林嘉格',
    agentName: '杭州远行代理',
    licenseName: '林嘉格',
    licenseNo: 'ZJ330100123456',
    surnamePinyin: 'LIN',
    givenNamePinyin: 'JIAGE',
    remark: '',
    recipientName: '林嘉格',
    recipientPhone: '13900002222',
    deliveryAddress: '杭州市上城区建安路88号',
    logisticsCompany: '',
    trackingNumber: '',
    status: 'pushed',
    pushedNotaryOfficeName: '北部湾公证处',
    reviewRemark: '资料完整，已推送至北部湾公证处',
    rejectReason: '',
    logs: [
      {
        time: '2026-07-01 11:42:10',
        operator: '外采系统',
        action: '外采订单创建',
      },
      {
        time: '2026-07-01 14:06:35',
        operator: '运营',
        action: '订单推送至北部湾公证处',
      },
    ],
    attachments: [],
  },
  {
    orderId: 'A260003',
    createdAt: '2026-06-30 16:25:48',
    updatedAt: '2026-06-30 18:20:11',
    productName: '公证办理服务',
    serviceName: 'normal',
    useCountry: '德国',
    language: '德语',
    customerName: '许安琪',
    agentName: '广州南证代理',
    licenseName: '许安琪',
    licenseNo: 'GD440100556677',
    surnamePinyin: 'XU',
    givenNamePinyin: 'ANQI',
    remark: '',
    recipientName: '许安琪',
    recipientPhone: '13700003333',
    deliveryAddress: '广州市天河区体育西路88号',
    logisticsCompany: '',
    trackingNumber: '',
    status: 'unpushed',
    pushedNotaryOfficeName: '',
    reviewRemark: '',
    rejectReason: '',
    logs: [
      {
        time: '2026-06-30 16:25:48',
        operator: '外采系统',
        action: '外采订单创建',
      },
    ],
    attachments: [],
  },
];

const cloneLog = (log: ExternalNotaryOrderLog): ExternalNotaryOrderLog => ({ ...log });
const cloneAttachment = (attachment: ExternalNotaryOrderAttachment): ExternalNotaryOrderAttachment => ({ ...attachment });

const cloneOrder = (order: ExternalNotaryOrder): ExternalNotaryOrder => ({
  ...order,
  logs: order.logs.map(cloneLog),
  attachments: order.attachments.map(cloneAttachment),
});

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);
const DEFAULT_EXTERNAL_NOTARY_ORDER_IDS = new Set(DEFAULT_EXTERNAL_NOTARY_ORDERS.map((order) => order.orderId));

const isSystemGeneratedExternalNotaryOrder = (order: ExternalNotaryOrder) => {
  if (DEFAULT_EXTERNAL_NOTARY_ORDER_IDS.has(order.orderId)) {
    return true;
  }

  const firstLog = order.logs[0];
  return firstLog?.operator === '外采系统' && firstLog?.action === '外采订单创建';
};

const removeSystemGeneratedExternalNotaryOrders = (orders: ExternalNotaryOrder[]) =>
  orders.filter((order) => !isSystemGeneratedExternalNotaryOrder(order));

const createRandomOrderId = (existingOrderIds: Set<string>) => {
  let nextOrderId = '';

  do {
    nextOrderId = `A${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')}`;
  } while (existingOrderIds.has(nextOrderId));

  return nextOrderId;
};

const normalizeStoredExternalNotaryOrder = (order: Partial<ExternalNotaryOrder> & Record<string, unknown>): ExternalNotaryOrder => {
  const legacyStatus = typeof order.status === 'string' ? String(order.status) : '';

  return {
    orderId: typeof order.orderId === 'string' ? order.orderId : `A${Date.now().toString().slice(-6).padStart(6, '0')}`,
    createdAt: typeof order.createdAt === 'string' ? order.createdAt : '',
    updatedAt: typeof order.updatedAt === 'string' ? order.updatedAt : '',
    productName: typeof order.productName === 'string' ? order.productName : '公证办理服务',
    serviceName: typeof order.serviceName === 'string' ? order.serviceName : '',
    useCountry: typeof order.useCountry === 'string' ? order.useCountry : '',
    language: typeof order.language === 'string' && order.language.trim() ? order.language : '英语',
    customerName: typeof order.customerName === 'string' ? order.customerName : '',
    agentName:
      typeof order.agentName === 'string'
        ? order.agentName
        : typeof order.supplierName === 'string'
          ? order.supplierName
          : '未设置代理商',
    licenseName:
      typeof order.licenseName === 'string'
        ? order.licenseName
        : typeof order.customerName === 'string'
          ? order.customerName
          : '',
    licenseNo: typeof order.licenseNo === 'string' ? order.licenseNo : '',
    surnamePinyin: typeof order.surnamePinyin === 'string' ? order.surnamePinyin : '',
    givenNamePinyin: typeof order.givenNamePinyin === 'string' ? order.givenNamePinyin : '',
    remark: typeof order.remark === 'string' ? order.remark : '',
    recipientName:
      typeof order.recipientName === 'string'
        ? order.recipientName
        : typeof order.customerName === 'string'
          ? order.customerName
          : '',
    recipientPhone:
      typeof order.recipientPhone === 'string'
        ? order.recipientPhone
        : typeof order.customerPhone === 'string'
          ? order.customerPhone
          : '',
    deliveryAddress: typeof order.deliveryAddress === 'string' ? order.deliveryAddress : '',
    logisticsCompany: typeof order.logisticsCompany === 'string' ? order.logisticsCompany : '',
    trackingNumber: typeof order.trackingNumber === 'string' ? order.trackingNumber : '',
    status:
      legacyStatus === 'pushed' || legacyStatus === 'unpushed' || legacyStatus === 'rejected'
        ? legacyStatus
        : legacyStatus === 'pending_purchase'
          ? 'unpushed'
          : 'pushed',
    pushedNotaryOfficeName:
      typeof order.pushedNotaryOfficeName === 'string'
        ? order.pushedNotaryOfficeName
        : typeof order.notaryOfficeName === 'string' && legacyStatus !== 'pending_purchase'
          ? order.notaryOfficeName
          : '',
    reviewRemark: typeof order.reviewRemark === 'string' ? order.reviewRemark : '',
    rejectReason: typeof order.rejectReason === 'string' ? order.rejectReason : '',
    logs: Array.isArray(order.logs) ? order.logs.map((log) => cloneLog(log as ExternalNotaryOrderLog)) : [],
    attachments: Array.isArray(order.attachments)
      ? order.attachments
          .map((attachment) => ({
            key: typeof attachment?.key === 'string' ? attachment.key : '',
            title: typeof attachment?.title === 'string' ? attachment.title : '',
            name: typeof attachment?.name === 'string' ? attachment.name : '',
            src: typeof attachment?.src === 'string' ? attachment.src : '',
          }))
          .filter((attachment) => attachment.key && attachment.src)
      : [],
  };
};

const persistExternalNotaryOrders = (orders: ExternalNotaryOrder[]) => {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(EXTERNAL_NOTARY_ORDER_STORAGE_KEY, JSON.stringify(orders));
  window.localStorage.setItem(EXTERNAL_NOTARY_ORDER_DATA_VERSION_STORAGE_KEY, EXTERNAL_NOTARY_ORDER_DATA_VERSION);
};

const loadExternalNotaryOrders = (): ExternalNotaryOrder[] => {
  if (!canUseLocalStorage()) {
    return [];
  }

  const storedValue = window.localStorage.getItem(EXTERNAL_NOTARY_ORDER_STORAGE_KEY);
  const storedVersion = window.localStorage.getItem(EXTERNAL_NOTARY_ORDER_DATA_VERSION_STORAGE_KEY);

  if (!storedValue) {
    persistExternalNotaryOrders([]);
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    if (Array.isArray(parsedValue)) {
      const normalizedOrders = parsedValue.map((order) => normalizeStoredExternalNotaryOrder(order));
      const sanitizedOrders = normalizedOrders;

      if (storedVersion !== EXTERNAL_NOTARY_ORDER_DATA_VERSION) {
        persistExternalNotaryOrders(sanitizedOrders);
      }

      return sanitizedOrders;
    }
  } catch (error) {
    console.error(error);
  }

  persistExternalNotaryOrders([]);
  return [];
};

export function getExternalNotaryOrders() {
  return loadExternalNotaryOrders().map(cloneOrder);
}

export function updateExternalNotaryOrder(orderId: string, updates: Partial<ExternalNotaryOrder>) {
  const orders = loadExternalNotaryOrders();
  const nextOrders = orders.map((order) =>
    order.orderId === orderId
      ? {
          ...order,
          ...updates,
          logs: updates.logs ? updates.logs.map(cloneLog) : order.logs.map(cloneLog),
          attachments: updates.attachments ? updates.attachments.map(cloneAttachment) : order.attachments.map(cloneAttachment),
        }
      : order,
  );
  persistExternalNotaryOrders(nextOrders);
  const matchedOrder = nextOrders.find((order) => order.orderId === orderId);
  return matchedOrder ? cloneOrder(matchedOrder) : null;
}

export function deleteExternalNotaryOrder(orderId: string) {
  const orders = loadExternalNotaryOrders();
  const matchedOrder = orders.find((order) => order.orderId === orderId);

  if (!matchedOrder || matchedOrder.status !== 'unpushed') {
    return null;
  }

  persistExternalNotaryOrders(orders.filter((order) => order.orderId !== orderId));
  return cloneOrder(matchedOrder);
}

export function addExternalNotaryOrder(
  orderInput: Omit<ExternalNotaryOrder, 'orderId' | 'createdAt' | 'updatedAt' | 'status' | 'pushedNotaryOfficeName' | 'reviewRemark' | 'logs'>,
) {
  const orders = loadExternalNotaryOrders();
  const currentTimestamp = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const formattedTimestamp = `${currentTimestamp.getFullYear()}-${pad(currentTimestamp.getMonth() + 1)}-${pad(
    currentTimestamp.getDate(),
  )} ${pad(currentTimestamp.getHours())}:${pad(currentTimestamp.getMinutes())}:${pad(currentTimestamp.getSeconds())}`;
  const nextOrderId = createRandomOrderId(new Set(orders.map((order) => order.orderId)));

  const nextOrder: ExternalNotaryOrder = {
    ...orderInput,
    orderId: nextOrderId,
    createdAt: formattedTimestamp,
    updatedAt: formattedTimestamp,
    status: 'unpushed',
    pushedNotaryOfficeName: '',
    reviewRemark: '',
    rejectReason: '',
    logs: [
      {
        time: formattedTimestamp,
        operator: '运营',
        action: '外采订单创建',
      },
    ],
    attachments: orderInput.attachments.map(cloneAttachment),
  };

  persistExternalNotaryOrders([nextOrder, ...orders]);
  return cloneOrder(nextOrder);
}
