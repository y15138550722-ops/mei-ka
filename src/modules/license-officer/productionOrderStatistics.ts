import { getOrders } from '../../services/mockDataService';
import type { Order } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';

export type ProductionLineKey = 'smallbook' | 'sworn' | 'notary' | 'hongKongNotary' | 'domesticLicense';
export type ProductionPendingStatusKey = 'notEntered' | 'untranslated' | 'unmade';

export interface ProductionStatisticsFilter {
  startDate?: string;
  endDate?: string;
}

export interface ProductionPendingStatusStatistic {
  key: ProductionPendingStatusKey;
  labelKey: string;
  count: number;
}

export interface ProductionLineStatistic {
  key: ProductionLineKey;
  labelKey: string;
  newOrders: number;
  pendingProduction: number;
  pendingStatusCounts: ProductionPendingStatusStatistic[];
}

const PRODUCTION_LINES: ReadonlyArray<Pick<ProductionLineStatistic, 'key' | 'labelKey'> & {
  pendingStatusKeys: ProductionPendingStatusKey[];
}> = [
  {
    key: 'smallbook',
    labelKey: 'production.statistics.smallbook',
    pendingStatusKeys: ['unmade'],
  },
  {
    key: 'sworn',
    labelKey: 'production.statistics.sworn',
    pendingStatusKeys: ['untranslated', 'unmade'],
  },
  {
    key: 'notary',
    labelKey: 'production.statistics.notary',
    pendingStatusKeys: ['untranslated', 'unmade'],
  },
  {
    key: 'hongKongNotary',
    labelKey: 'production.statistics.hongKongNotary',
    pendingStatusKeys: ['notEntered', 'untranslated', 'unmade'],
  },
  {
    key: 'domesticLicense',
    labelKey: 'production.statistics.domesticLicense',
    pendingStatusKeys: ['untranslated', 'unmade'],
  },
];

const PENDING_STATUS_LABEL_KEYS: Record<ProductionPendingStatusKey, string> = {
  notEntered: 'production.statistics.status.notEntered',
  untranslated: 'production.statistics.status.untranslated',
  unmade: 'production.statistics.status.unmade',
};

const getBeijingDateKey = (value: string) => {
  // Local timestamps in the order service already represent Beijing time.
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(value)) {
    return value.slice(0, 10);
  }
  return formatBeijingTimestamp(value).slice(0, 10);
};

const getProductionLineKey = (order: Order): ProductionLineKey | null => {
  if (order.productCategory === 'domestic_license') {
    return 'domesticLicense';
  }

  if (order.productCategory === 'local_language_notary') {
    return 'hongKongNotary';
  }

  if (order.productCategory === 'notary') {
    return 'notary';
  }

  if (order.productCategory === 'translation') {
    // The remaining translation products belong to the sworn/certified line.
    return order.productName.includes('小白本') ? 'smallbook' : 'sworn';
  }

  return null;
};

const hasProductionAction = (order: Order, action: string) =>
  order.logs.some((log) => log.action === action);

const isActiveProductionOrder = (order: Order) =>
  !['shipped', 'completed', 'cancelled', 'rejected'].includes(order.status);

const getPendingProductionStatus = (
  order: Order,
  line: ProductionLineKey,
): ProductionPendingStatusKey | null => {
  if (!isActiveProductionOrder(order)) {
    return null;
  }

  const hasTranslated = hasProductionAction(order, '已翻译');
  const isMade = order.status === 'in_production' || hasProductionAction(order, '已制作');

  if (line === 'smallbook' && order.status === 'pending_production' && !isMade) {
    return 'unmade';
  }

  if (line === 'hongKongNotary') {
    if (order.status === 'pending_review') return 'notEntered';
  }

  if (order.status === 'pending_production' && !hasTranslated) return 'untranslated';
  if (hasTranslated && !isMade) return 'unmade';
  return null;
};

export const getProductionLineStatistics = (
  orders: Order[],
  { startDate = '', endDate = '' }: ProductionStatisticsFilter = {},
): ProductionLineStatistic[] => {
  return PRODUCTION_LINES.map((line) => {
    const lineOrders = orders.filter((order) => {
      if (getProductionLineKey(order) !== line.key) return false;
      const orderDate = getBeijingDateKey(order.createdAt);
      return (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
    });
    const pendingStatusCounts = line.pendingStatusKeys.map((statusKey) => ({
      key: statusKey,
      labelKey: PENDING_STATUS_LABEL_KEYS[statusKey],
      count: lineOrders.filter((order) => getPendingProductionStatus(order, line.key) === statusKey).length,
    }));

    return {
      key: line.key,
      labelKey: line.labelKey,
      newOrders: lineOrders.length,
      pendingProduction: pendingStatusCounts.reduce((total, item) => total + item.count, 0),
      pendingStatusCounts,
    };
  });
};

export const readProductionLineStatistics = (filter: ProductionStatisticsFilter = {}) => {
  const orders = getOrders();

  // The mock service caches orders in memory; use its persisted snapshot to
  // include updates made in other tabs without reloading the query page.
  try {
    const storedValue = window.localStorage.getItem('meika-orders');
    if (storedValue) {
      const storedOrders: unknown = JSON.parse(storedValue);
      if (Array.isArray(storedOrders)) {
        return getProductionLineStatistics(storedOrders, filter);
      }
    }
  } catch {
    // Keep statistics available when local storage cannot be read.
  }

  return getProductionLineStatistics(orders, filter);
};
