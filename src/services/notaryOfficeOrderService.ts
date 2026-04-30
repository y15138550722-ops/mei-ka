import type { Order, OrderStatus } from '../shared/types';
import { formatBeijingTimestamp } from '../shared/utils/dateTime';
import { getOrderById, getOrders, updateOrder } from './mockDataService';

const NOTARY_OFFICE_ORDER_STORAGE_KEY = 'meika-notary-office-orders';
const NOTARY_OFFICE_ORDER_DATA_VERSION_STORAGE_KEY = 'meika-notary-office-orders-version';
const NOTARY_OFFICE_ORDER_DATA_VERSION = 'v6-empty-notary-office-orders';
const REMOVED_NOTARY_OFFICE_ORDER_IDS = new Set(['MK2600057', 'MK2600061']);
const MANAGEMENT_ORDER_ID_PATTERN = /^MK\d+$/;

const NOTARY_OFFICE_PENDING_REVIEW_SEEDS = [
  {
    orderId: 'NO2600101',
    customerName: '林知夏',
    customerPhone: '13800192011',
    customerPassport: 'E2600101',
    customerEmail: 'notary-office-101@example.com',
    productName: '公证单号',
    deliveryAddress: '上海市浦东新区锦绣路188号8栋1102室',
    licenseNo: 'D30000001',
    licenseCategory: 'C1',
    language: '英语',
    officeId: 'beibu-gulf',
    officeName: '北部湾公证处',
  },
  {
    orderId: 'NO2600102',
    customerName: '周书禾',
    customerPhone: '13800192012',
    customerPassport: 'E2600102',
    customerEmail: 'notary-office-102@example.com',
    productName: '公证双号',
    deliveryAddress: '广西南宁市良庆区平乐大道66号3栋902室',
    licenseNo: 'D30000002',
    licenseCategory: 'C2',
    language: '法语',
    officeId: 'zhangjiang',
    officeName: '张江公证处',
  },
  {
    orderId: 'NO2600103',
    customerName: '顾景川',
    customerPhone: '13800192013',
    customerPassport: 'E2600103',
    customerEmail: 'notary-office-103@example.com',
    productName: '公证海牙单号',
    deliveryAddress: '北京市朝阳区酒仙桥路10号恒通商务园B座1206室',
    licenseNo: 'D30000003',
    licenseCategory: 'C1',
    language: '德语',
    officeId: 'beibu-gulf',
    officeName: '北部湾公证处',
  },
  {
    orderId: 'NO2600104',
    customerName: '许安宁',
    customerPhone: '13800192014',
    customerPassport: 'E2600104',
    customerEmail: 'notary-office-104@example.com',
    productName: '公证海牙双号',
    deliveryAddress: '广东省广州市天河区珠江新城华夏路16号1201室',
    licenseNo: 'D30000004',
    licenseCategory: 'B2',
    language: '日语',
    officeId: 'zhangjiang',
    officeName: '张江公证处',
  },
  {
    orderId: 'NO2600105',
    customerName: '苏若岚',
    customerPhone: '13800192015',
    customerPassport: 'E2600105',
    customerEmail: 'notary-office-105@example.com',
    productName: '公证单号',
    deliveryAddress: '江苏省南京市建邺区江东中路98号万达广场C座1808室',
    licenseNo: 'D30000005',
    licenseCategory: 'C1',
    language: '英语',
    officeId: 'beibu-gulf',
    officeName: '北部湾公证处',
  },
  {
    orderId: 'NO2600106',
    customerName: '陆清和',
    customerPhone: '13800192016',
    customerPassport: 'E2600106',
    customerEmail: 'notary-office-106@example.com',
    productName: '公证双号',
    deliveryAddress: '浙江省杭州市西湖区文三路478号华星时代广场1幢1303室',
    licenseNo: 'D30000006',
    licenseCategory: 'C2',
    language: '法语',
    officeId: 'zhangjiang',
    officeName: '张江公证处',
  },
  {
    orderId: 'NO2600107',
    customerName: '唐星野',
    customerPhone: '13800192017',
    customerPassport: 'E2600107',
    customerEmail: 'notary-office-107@example.com',
    productName: '公证海牙单号',
    deliveryAddress: '四川省成都市高新区天府二街88号5栋1509室',
    licenseNo: 'D30000007',
    licenseCategory: 'A1',
    language: '德语',
    officeId: 'beibu-gulf',
    officeName: '北部湾公证处',
  },
  {
    orderId: 'NO2600108',
    customerName: '沈慕晴',
    customerPhone: '13800192018',
    customerPassport: 'E2600108',
    customerEmail: 'notary-office-108@example.com',
    productName: '公证海牙双号',
    deliveryAddress: '福建省厦门市思明区湖滨东路319号人才中心大厦A座901室',
    licenseNo: 'D30000008',
    licenseCategory: 'C1',
    language: '日语',
    officeId: 'zhangjiang',
    officeName: '张江公证处',
  },
  {
    orderId: 'NO2600109',
    customerName: '陈望舒',
    customerPhone: '13800192019',
    customerPassport: 'E2600109',
    customerEmail: 'notary-office-109@example.com',
    productName: '公证单号',
    deliveryAddress: '湖北省武汉市江汉区解放大道688号创世纪广场2栋1706室',
    licenseNo: 'D30000009',
    licenseCategory: 'C2',
    language: '英语',
    officeId: 'beibu-gulf',
    officeName: '北部湾公证处',
  },
  {
    orderId: 'NO2600110',
    customerName: '赵砚秋',
    customerPhone: '13800192020',
    customerPassport: 'E2600110',
    customerEmail: 'notary-office-110@example.com',
    productName: '公证双号',
    deliveryAddress: '山东省青岛市市南区香港中路8号颐和国际A座706室',
    licenseNo: 'D30000010',
    licenseCategory: 'C1',
    language: '法语',
    officeId: 'zhangjiang',
    officeName: '张江公证处',
  },
] as const;

const isBrowser = () => typeof window !== 'undefined';

const getCurrentTimestamp = () => formatBeijingTimestamp();

const cloneOrder = (order: Order): Order => ({
  ...order,
  logs: order.logs.map((log) => ({ ...log })),
});

const excludeRemovedOrders = (orders: Order[]) =>
  orders.filter((order) => !REMOVED_NOTARY_OFFICE_ORDER_IDS.has(order.orderId));

const hasPushedNotaryOffice = (order: Order) =>
  Boolean(
    order.pushedNotaryOfficeId?.trim() ||
      order.pushedNotaryOfficeName?.trim() ||
      order.logs.some((log) => /推送至|送审至|公证处已接收/.test(log.action)),
  );

const isManagementFlowOfficeOrder = (order: Order) =>
  MANAGEMENT_ORDER_ID_PATTERN.test(order.orderId) && hasPushedNotaryOffice(order);

const getOfficeOrderManagementOrderId = (order: Order) => {
  const managementOrderId = order.managementOrderId?.trim();
  if (managementOrderId) {
    return managementOrderId;
  }

  return isManagementFlowOfficeOrder(order) ? order.orderId : undefined;
};

const getNotaryOfficeOrderSortValue = (order: Order) =>
  order.updatedAt?.trim() || order.createdAt?.trim() || '';

const hasSameOrderLog = (logs: Order['logs'], targetLog: Order['logs'][number]) =>
  logs.some(
    (log) =>
      log.time === targetLog.time &&
      log.operator === targetLog.operator &&
      log.action === targetLog.action,
  );

const appendUniqueOrderLogs = (logs: Order['logs'], nextLogs: Order['logs']) => {
  const mergedLogs = [...logs];

  nextLogs.forEach((log) => {
    if (!hasSameOrderLog(mergedLogs, log)) {
      mergedLogs.push(log);
    }
  });

  return mergedLogs;
};

const findLatestOrderLog = (logs: Order['logs'], pattern: RegExp) =>
  [...logs].reverse().find((log) => pattern.test(log.action));

type NotaryOfficePushStatus = Extract<OrderStatus, 'pending_review' | 'in_production'>;

const normalizeDefaultPushedOrder = (order: Order): Order => {
  const nextOrder = cloneOrder(order);

  return nextOrder.status === 'pending_production'
    ? {
        ...nextOrder,
        status: 'pending_review',
      }
    : nextOrder;
};

const normalizeStoredNotaryOfficeOrder = (order: Order): Order => {
  const isLegacyManagementFlowOrder = isManagementFlowOfficeOrder(order);
  let nextOrder = order;

  if (order.status === 'translating' && isLegacyManagementFlowOrder) {
    nextOrder = {
      ...nextOrder,
      status: 'pending_review',
    };
  }

  if (nextOrder.status === 'pending_production') {
    nextOrder = {
      ...nextOrder,
      status: 'in_production',
    };
  }

  if (isLegacyManagementFlowOrder && !nextOrder.managementOrderId) {
    nextOrder = {
      ...nextOrder,
      managementOrderId: nextOrder.orderId,
      notarySubmissionSequence: nextOrder.notarySubmissionSequence || 1,
    };
  }

  return nextOrder;
};

const mergeUniqueOrdersById = (orders: Order[]) => {
  const orderMap = new Map<string, Order>();
  orders.forEach((order) => {
    orderMap.set(order.orderId, order);
  });
  return Array.from(orderMap.values());
};

const createSeedTimestamp = (index: number) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(index / 2));
  date.setHours(9 + (index % 4) * 2, 8 + index, 0, 0);
  return formatBeijingTimestamp(date);
};

const buildSeedNotaryOfficeOrders = (templateOrders: Order[]): Order[] =>
  NOTARY_OFFICE_PENDING_REVIEW_SEEDS.map((seed, index) => {
    const templateOrder = templateOrders[index % templateOrders.length];
    const createdAt = createSeedTimestamp(index);

    return {
      orderId: seed.orderId,
      customerName: seed.customerName,
      customerPhone: seed.customerPhone,
      customerPassport: seed.customerPassport,
      customerEmail: seed.customerEmail,
      productId: templateOrder?.productId || 'MK-9',
      productName: seed.productName,
      productCategory: 'notary',
      processType: templateOrder?.processType || 'normal',
      processTypeId: templateOrder?.processTypeId,
      pushTimeliness: templateOrder?.pushTimeliness || 'same_day',
      channel: templateOrder?.channel || 'private',
      agentLevel: templateOrder?.agentLevel || 'self',
      lockedPrice: templateOrder?.lockedPrice || 299,
      status: 'pending_review',
      deliveryAddress: seed.deliveryAddress,
      logisticsCompany: '',
      trackingNumber: '',
      shippedAt: undefined,
      remark: '公证处待审核补充数据',
      rejectReason: undefined,
      pushedNotaryOfficeId: seed.officeId,
      pushedNotaryOfficeName: seed.officeName,
      auditSelectedNotaryOfficeId: seed.officeId,
      auditSelectedNotaryOfficeName: seed.officeName,
      productionDisplayNotaryOfficeId: seed.officeId,
      productionDisplayNotaryOfficeName: seed.officeName,
      licenseName: seed.customerName,
      licenseNo: seed.licenseNo,
      licenseCategory: seed.licenseCategory,
      language: seed.language,
      createdAt,
      updatedAt: createdAt,
      logs: [
        {
          time: createdAt,
          operator: '公证处系统',
          action: '订单创建',
        },
        {
          time: createdAt,
          operator: seed.officeName,
          action: '补充待审核订单',
        },
      ],
    };
  });

const buildDefaultNotaryOfficeOrders = (): Order[] => {
  return [];
};

const persistNotaryOfficeOrders = () => {
  if (!isBrowser()) return;
  window.localStorage.setItem(NOTARY_OFFICE_ORDER_STORAGE_KEY, JSON.stringify(_notaryOfficeOrders));
  window.localStorage.setItem(NOTARY_OFFICE_ORDER_DATA_VERSION_STORAGE_KEY, NOTARY_OFFICE_ORDER_DATA_VERSION);
};

const loadNotaryOfficeOrders = (): Order[] => {
  const defaultOrders = buildDefaultNotaryOfficeOrders();

  if (!isBrowser()) {
    return defaultOrders;
  }

  try {
    const rawValue = window.localStorage.getItem(NOTARY_OFFICE_ORDER_STORAGE_KEY);
    const storedDataVersion = window.localStorage.getItem(NOTARY_OFFICE_ORDER_DATA_VERSION_STORAGE_KEY);

    if (!rawValue || storedDataVersion !== NOTARY_OFFICE_ORDER_DATA_VERSION) {
      window.localStorage.setItem(NOTARY_OFFICE_ORDER_STORAGE_KEY, JSON.stringify(defaultOrders));
      window.localStorage.setItem(NOTARY_OFFICE_ORDER_DATA_VERSION_STORAGE_KEY, NOTARY_OFFICE_ORDER_DATA_VERSION);
      return defaultOrders;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return defaultOrders;
    }

    const storedOrders = excludeRemovedOrders(parsedValue as Order[]).map(normalizeStoredNotaryOfficeOrder);

    window.localStorage.setItem(NOTARY_OFFICE_ORDER_STORAGE_KEY, JSON.stringify(storedOrders));
    window.localStorage.setItem(NOTARY_OFFICE_ORDER_DATA_VERSION_STORAGE_KEY, NOTARY_OFFICE_ORDER_DATA_VERSION);
    return storedOrders;
  } catch {
    return defaultOrders;
  }
};

const createNotaryOfficeOrderFromManagementOrder = (
  managementOrder: Order,
  options: {
    orderId?: string;
    operator?: string;
    pushedAt?: string;
    submissionSequence?: number;
    targetStatus?: NotaryOfficePushStatus;
  } = {},
): Order => {
  const pushedAt = options.pushedAt?.trim() || getCurrentTimestamp();
  const operator = options.operator?.trim() || '系统';
  const targetStatus = options.targetStatus || 'pending_review';
  const officeOrderId = options.orderId || managementOrder.orderId;
  const submissionSequence = options.submissionSequence || 1;
  const officeId = managementOrder.productionDisplayNotaryOfficeId || managementOrder.pushedNotaryOfficeId;
  const officeName =
    managementOrder.productionDisplayNotaryOfficeName || managementOrder.pushedNotaryOfficeName || '未指定公证处';
  const receiveAction =
    targetStatus === 'in_production'
      ? `驾照官系统已接收：制作模板为${officeName}，进入制作中`
      : `公证处已接收：${officeName}，进入待审核`;

  return {
    ...cloneOrder(managementOrder),
    orderId: officeOrderId,
    managementOrderId: managementOrder.orderId,
    notarySubmissionSequence: submissionSequence,
    status: targetStatus,
    pushedNotaryOfficeId: managementOrder.pushedNotaryOfficeId || officeId,
    pushedNotaryOfficeName: managementOrder.pushedNotaryOfficeName || officeName,
    productionDisplayNotaryOfficeId: officeId,
    productionDisplayNotaryOfficeName: officeName,
    logisticsCompany: '',
    trackingNumber: '',
    shippedAt: undefined,
    rejectReason: undefined,
    createdAt: pushedAt,
    updatedAt: pushedAt,
    logs: [
      {
        time: pushedAt,
        operator,
        action: receiveAction,
      },
    ],
  };
};

let _notaryOfficeOrders = loadNotaryOfficeOrders();

const getNotaryOfficeOrdersByManagementOrderIdInternal = (managementOrderId: string) =>
  _notaryOfficeOrders.filter((order) => getOfficeOrderManagementOrderId(order) === managementOrderId);

const getLatestNotaryOfficeOrderByManagementOrderIdInternal = (managementOrderId: string) =>
  [...getNotaryOfficeOrdersByManagementOrderIdInternal(managementOrderId)].sort((left, right) => {
    const sequenceResult = (right.notarySubmissionSequence || 0) - (left.notarySubmissionSequence || 0);
    if (sequenceResult !== 0) {
      return sequenceResult;
    }

    const sortResult = getNotaryOfficeOrderSortValue(right).localeCompare(getNotaryOfficeOrderSortValue(left));
    if (sortResult !== 0) {
      return sortResult;
    }

    return right.orderId.localeCompare(left.orderId);
  })[0];

const getNextNotarySubmissionSequence = (managementOrderId: string) => {
  const existingOrders = getNotaryOfficeOrdersByManagementOrderIdInternal(managementOrderId);
  return (
    existingOrders.reduce((maxSequence, order) => {
      const sequence = order.notarySubmissionSequence || (order.orderId === managementOrderId ? 1 : 0);
      return Math.max(maxSequence, sequence);
    }, 0) + 1
  );
};

const buildNotaryOfficeSubmissionOrderId = (managementOrderId: string, sequence: number) =>
  `NO${managementOrderId.replace(/\D/g, '')}${String(sequence).padStart(2, '0')}`;

const getAvailableNotaryOfficeSubmissionIdentity = (managementOrderId: string) => {
  let sequence = getNextNotarySubmissionSequence(managementOrderId);
  let orderId = buildNotaryOfficeSubmissionOrderId(managementOrderId, sequence);

  while (_notaryOfficeOrders.some((order) => order.orderId === orderId)) {
    sequence += 1;
    orderId = buildNotaryOfficeSubmissionOrderId(managementOrderId, sequence);
  }

  return { orderId, sequence };
};

const getManagementOrderForOfficeOrder = (officeOrder: Order) => {
  const managementOrderId = getOfficeOrderManagementOrderId(officeOrder) || officeOrder.orderId;
  return getOrderById(managementOrderId);
};

export function getNotaryOfficeOrders() {
  return _notaryOfficeOrders.map(cloneOrder);
}

export function getNotaryOfficeOrdersByManagementOrderId(managementOrderId: string) {
  return getNotaryOfficeOrdersByManagementOrderIdInternal(managementOrderId).map(cloneOrder);
}

export function getLatestNotaryOfficeOrderByManagementOrderId(managementOrderId: string) {
  const order = getLatestNotaryOfficeOrderByManagementOrderIdInternal(managementOrderId);
  return order ? cloneOrder(order) : undefined;
}

export function getNotaryOfficeOrderById(id: string) {
  const order = _notaryOfficeOrders.find((item) => item.orderId === id);
  return order ? cloneOrder(order) : undefined;
}

export function updateNotaryOfficeOrder(id: string, updates: Partial<Order>) {
  _notaryOfficeOrders = _notaryOfficeOrders.map((order) => {
    if (order.orderId !== id) {
      return order;
    }

    const isShippingTransition = order.status === 'in_production' && updates.status === 'shipped';
    if (!isShippingTransition || updates.shippedAt) {
      return { ...order, ...updates };
    }

    const shippedTime = getCurrentTimestamp();
    return {
      ...order,
      ...updates,
      shippedAt: shippedTime,
      updatedAt: updates.updatedAt || shippedTime,
    };
  });

  persistNotaryOfficeOrders();
}

export function pushNotaryOrderToOffice(
  managementOrder: Order,
  options: {
    operator?: string;
    pushedAt?: string;
    targetStatus?: NotaryOfficePushStatus;
  } = {},
) {
  const latestOfficeOrder = getLatestNotaryOfficeOrderByManagementOrderIdInternal(managementOrder.orderId);
  const canReuseLatestOfficeOrder = Boolean(
    latestOfficeOrder &&
      latestOfficeOrder.status !== 'rejected' &&
      latestOfficeOrder.status !== 'cancelled' &&
      latestOfficeOrder.status !== 'completed' &&
      latestOfficeOrder.status !== 'shipped',
  );

  if (latestOfficeOrder && canReuseLatestOfficeOrder) {
    const pushedAt = options.pushedAt?.trim() || getCurrentTimestamp();
    const operator = options.operator?.trim() || '系统';
    const targetStatus = options.targetStatus || 'pending_review';
    const officeId = managementOrder.productionDisplayNotaryOfficeId || managementOrder.pushedNotaryOfficeId;
    const officeName =
      managementOrder.productionDisplayNotaryOfficeName || managementOrder.pushedNotaryOfficeName || '未指定公证处';
    const receiveAction =
      targetStatus === 'in_production'
        ? `驾照官系统已接收：制作模板为${officeName}，进入制作中`
        : `送审至${officeName}，进入待审核`;
    const nextOrder: Order = {
      ...latestOfficeOrder,
      managementOrderId: managementOrder.orderId,
      notarySubmissionSequence: latestOfficeOrder.notarySubmissionSequence || 1,
      status: targetStatus,
      pushedNotaryOfficeId: managementOrder.pushedNotaryOfficeId || officeId,
      pushedNotaryOfficeName: managementOrder.pushedNotaryOfficeName || officeName,
      productionDisplayNotaryOfficeId: officeId,
      productionDisplayNotaryOfficeName: officeName,
      updatedAt: pushedAt,
      logs: [
        ...latestOfficeOrder.logs,
        {
          time: pushedAt,
          operator,
          action: receiveAction,
        },
      ],
    };

    _notaryOfficeOrders = _notaryOfficeOrders.map((order) =>
      order.orderId === latestOfficeOrder.orderId ? nextOrder : order,
    );
    persistNotaryOfficeOrders();
    return cloneOrder(nextOrder);
  }

  if (REMOVED_NOTARY_OFFICE_ORDER_IDS.has(managementOrder.orderId)) {
    return cloneOrder(createNotaryOfficeOrderFromManagementOrder(managementOrder, options));
  }

  const { orderId, sequence } = getAvailableNotaryOfficeSubmissionIdentity(managementOrder.orderId);
  const officeOrder = createNotaryOfficeOrderFromManagementOrder(managementOrder, {
    ...options,
    orderId,
    submissionSequence: sequence,
  });
  _notaryOfficeOrders = [..._notaryOfficeOrders, officeOrder];
  persistNotaryOfficeOrders();
  return cloneOrder(officeOrder);
}

export function syncNotaryOfficeRejectionToManagement(
  officeOrder: Order,
  options: {
    rejectReason: string;
    operator?: string;
    rejectedAt?: string;
  },
) {
  const managementOrder = getManagementOrderForOfficeOrder(officeOrder);
  if (!managementOrder) {
    return undefined;
  }

  const rejectionLog = findLatestOrderLog(officeOrder.logs, /公证处审核驳回|审核驳回|驳回/);
  const rejectedAt = rejectionLog?.time?.trim() || options.rejectedAt?.trim() || getCurrentTimestamp();
  const operator = options.operator?.trim() || officeOrder.pushedNotaryOfficeName?.trim() || '公证处';
  const rejectReason = options.rejectReason.trim();
  const officeName = officeOrder.pushedNotaryOfficeName?.trim() || '公证处';
  const officeSubmissionLog = officeOrder.logs.find((log) => /送审至|公证处已接收/.test(log.action));
  const restoredSubmissionLogs =
    !officeSubmissionLog || hasSameOrderLog(managementOrder.logs, officeSubmissionLog)
      ? []
      : [
          {
            ...officeSubmissionLog,
            operator: officeSubmissionLog.operator || '系统',
          },
        ];
  const nextUpdates: Partial<Order> = {
    status: 'pending_production',
    rejectReason,
    remark: rejectReason,
    updatedAt: rejectedAt,
    logs: appendUniqueOrderLogs(managementOrder.logs, [
      ...restoredSubmissionLogs,
      {
        time: rejectedAt,
        operator,
        action: `${officeName}审核驳回：${rejectReason}`,
      },
    ]),
  };

  updateOrder(managementOrder.orderId, nextUpdates);
  return {
    ...managementOrder,
    ...nextUpdates,
  } as Order;
}

export function syncNotaryOfficeApprovalToManagement(
  officeOrder: Order,
  options: {
    operator?: string;
    approvedAt?: string;
  } = {},
) {
  const managementOrder = getManagementOrderForOfficeOrder(officeOrder);
  if (!managementOrder) {
    return undefined;
  }

  const approvalLog = findLatestOrderLog(officeOrder.logs, /公证处审核通过|审核通过，进入制作中|审核通过/);
  const approvedAt = approvalLog?.time?.trim() || options.approvedAt?.trim() || getCurrentTimestamp();
  const operator = options.operator?.trim() || officeOrder.pushedNotaryOfficeName?.trim() || '公证处';
  const officeName = officeOrder.pushedNotaryOfficeName?.trim() || '公证处';
  const nextUpdates: Partial<Order> = {
    status: 'in_production',
    pushedNotaryOfficeId: officeOrder.pushedNotaryOfficeId || managementOrder.pushedNotaryOfficeId,
    pushedNotaryOfficeName: officeOrder.pushedNotaryOfficeName || managementOrder.pushedNotaryOfficeName,
    productionDisplayNotaryOfficeId:
      officeOrder.productionDisplayNotaryOfficeId ||
      officeOrder.pushedNotaryOfficeId ||
      managementOrder.productionDisplayNotaryOfficeId ||
      managementOrder.pushedNotaryOfficeId,
    productionDisplayNotaryOfficeName:
      officeOrder.productionDisplayNotaryOfficeName ||
      officeOrder.pushedNotaryOfficeName ||
      managementOrder.productionDisplayNotaryOfficeName ||
      managementOrder.pushedNotaryOfficeName,
    updatedAt: approvedAt,
    logs: appendUniqueOrderLogs(managementOrder.logs, [
      {
        time: approvedAt,
        operator,
        action: `${officeName}审核通过，进入制作中`,
      },
    ]),
  };

  updateOrder(managementOrder.orderId, nextUpdates);
  return {
    ...managementOrder,
    ...nextUpdates,
  } as Order;
}

export function syncNotaryOfficeCompletionToManagement(
  officeOrder: Order,
  options: {
    operator?: string;
    completedAt?: string;
  } = {},
) {
  const managementOrder = getManagementOrderForOfficeOrder(officeOrder);
  if (!managementOrder) {
    return undefined;
  }

  const completionLog = findLatestOrderLog(officeOrder.logs, /公证处制作完成|制作完成/);
  const completedAt = completionLog?.time?.trim() || options.completedAt?.trim() || getCurrentTimestamp();
  const operator = options.operator?.trim() || officeOrder.pushedNotaryOfficeName?.trim() || '公证处';
  const officeName = officeOrder.pushedNotaryOfficeName?.trim() || '公证处';
  const nextUpdates: Partial<Order> = {
    status: 'in_production',
    updatedAt: completedAt,
    logs: appendUniqueOrderLogs(managementOrder.logs, [
      {
        time: completedAt,
        operator,
        action: `${officeName}公证处制作完成`,
      },
    ]),
  };

  updateOrder(managementOrder.orderId, nextUpdates);
  return {
    ...managementOrder,
    ...nextUpdates,
  } as Order;
}

export function syncNotaryManagementShipment(
  managementOrder: Order,
  options: {
    logisticsCompany: string;
    trackingNumber: string;
    operator?: string;
    shippedAt?: string;
  },
) {
  const currentManagementOrder = getOrderById(managementOrder.orderId) || managementOrder;
  const shippedAt = options.shippedAt?.trim() || getCurrentTimestamp();
  const operator = options.operator?.trim() || '运营';
  const logisticsCompany = options.logisticsCompany.trim();
  const trackingNumber = options.trackingNumber.trim();
  const action = `物流发货：${logisticsCompany} ${trackingNumber}`;
  const managementUpdates: Partial<Order> = {
    status: 'shipped',
    shippedAt,
    logisticsCompany,
    trackingNumber,
    updatedAt: shippedAt,
    logs: appendUniqueOrderLogs(currentManagementOrder.logs, [
      {
        time: shippedAt,
        operator,
        action,
      },
    ]),
  };

  updateOrder(currentManagementOrder.orderId, managementUpdates);

  const officeOrder = getLatestNotaryOfficeOrderByManagementOrderIdInternal(currentManagementOrder.orderId);
  if (officeOrder) {
    const nextOfficeOrder: Order = {
      ...officeOrder,
      status: 'shipped',
      shippedAt,
      logisticsCompany,
      trackingNumber,
      updatedAt: shippedAt,
      logs: [
        ...officeOrder.logs,
        {
          time: shippedAt,
          operator,
          action,
        },
      ],
    };

    _notaryOfficeOrders = _notaryOfficeOrders.map((order) =>
      order.orderId === officeOrder.orderId ? nextOfficeOrder : order,
    );
    persistNotaryOfficeOrders();
  }

  return {
    ...currentManagementOrder,
    ...managementUpdates,
  } as Order;
}
