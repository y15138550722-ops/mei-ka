import type { Order, OrderLog } from '../../shared/types/index.ts';
import { getStoredAuthSession } from '../../shared/utils/auth.ts';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime.ts';

export const createProductionLog = (action: string, time = formatBeijingTimestamp()): OrderLog => {
  const session = getStoredAuthSession();
  return {
    action,
    time,
    operator: session?.displayName?.trim() || session?.username?.trim() || '生产端',
    operatorAccount: session?.username?.trim() || undefined,
  };
};

export const getProductionOperatorLabel = (log: OrderLog) => {
  const name = typeof log.operator === 'string' ? log.operator.trim() || '未记录姓名' : '未记录姓名';
  const account = typeof log.operatorAccount === 'string' ? log.operatorAccount.trim() : '';
  return account ? (name === account ? account : `${name}（${account}）`) : `${name}（未记录账号）`;
};

// Unzoned stored timestamps are Beijing wall-clock time. Convert zoned imports
// explicitly so the report does not depend on the browser's timezone.
export const getProductionTimestamp = (value: string): string => {
  const normalized = String(value ?? '').trim().replace(/\//g, '-');
  const parts = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!parts) return '';
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone] = parts;
  const calendarDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== `${year}-${month}-${day}` || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return '';
  return formatBeijingTimestamp(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone || '+08:00'}`);
};

export const isProductionDateInRange = (date: string, startDate: string, endDate: string) =>
  Boolean(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate);

export interface ProductionDailyRow {
  key: string;
  actionDate: string;
  accountKey: string;
  account: string;
  operatorName: string;
  translationCount: number;
  productionCount: number;
}

export interface ProductionReportFilters {
  startDate?: string;
  endDate?: string;
  accountKey?: string;
}

export const buildProductionDailyRows = (
  orders: ReadonlyArray<Pick<Order, 'orderId' | 'logs'>>,
  { startDate = '', endDate = '', accountKey = '' }: ProductionReportFilters = {},
): ProductionDailyRow[] => {
  const completions = new Map<string, { log: OrderLog; timestamp: string }>();
  for (const order of orders) {
    for (const log of order.logs) {
      if (log.action !== '已翻译' && log.action !== '已制作') continue;
      const timestamp = getProductionTimestamp(log.time);
      if (!timestamp) continue;
      const key = JSON.stringify([order.orderId, log.action]);
      const previous = completions.get(key);
      // Deduplicate before filtering, including repeated exports on later days.
      if (!previous || timestamp < previous.timestamp) completions.set(key, { log, timestamp });
    }
  }

  const rows = new Map<string, ProductionDailyRow>();
  for (const { log, timestamp } of completions.values()) {
    const actionDate = timestamp.slice(0, 10);
    if (!isProductionDateInRange(actionDate, startDate, endDate)) continue;
    const account = typeof log.operatorAccount === 'string' ? log.operatorAccount.trim() : '';
    const operatorName = typeof log.operator === 'string' ? log.operator.trim() || '未记录姓名' : '未记录姓名';
    const rowAccountKey = JSON.stringify(account ? ['account', account] : ['legacy', operatorName]);
    if (accountKey && accountKey !== rowAccountKey) continue;
    const key = JSON.stringify([actionDate, rowAccountKey]);
    const row = rows.get(key) || {
      key,
      actionDate,
      accountKey: rowAccountKey,
      // New records show the login account. Legacy records stay visible with
      // an explicit marker so they cannot be mistaken for an account ID.
      account: account || `未记录账号（${operatorName}）`,
      operatorName,
      translationCount: 0,
      productionCount: 0,
    };
    if (log.action === '已翻译') row.translationCount += 1;
    else row.productionCount += 1;
    rows.set(key, row);
  }
  return Array.from(rows.values()).sort((a, b) =>
    b.actionDate.localeCompare(a.actionDate) || a.accountKey.localeCompare(b.accountKey, 'zh-CN'),
  );
};
