import type { Order } from '../../shared/types';

export const CHINESE_TRANSLATION_PRODUCT_TITLE = '\u6362\u56fd\u5185\u9a7e\u7167\u7ffb\u8bd1\u4ef6';
export const PRODUCTION_OPERATOR = '\u751f\u4ea7\u7aef';

const PRODUCTION_VISIBLE_STATUSES = new Set<Order['status']>([
  'pending_production',
  'in_production',
  'shipped',
  'completed',
]);
const USER_SUBMITTED_REMARKS = new Set(['\u7528\u6237\u7aef\u63d0\u4ea4', '\u4ee3\u7406\u7aef\u63d0\u4ea4']);
const USER_SUBMITTED_OPERATORS = new Set(['\u7528\u6237\u7aef', '\u4ee3\u7406\u7aef']);

const hasProductionLog = (order: Order) => order.logs.some((log) => log.operator === PRODUCTION_OPERATOR);
const hasUserSubmittedMarker = (order: Order) =>
  USER_SUBMITTED_REMARKS.has(order.remark) ||
  order.logs.some((log) => USER_SUBMITTED_OPERATORS.has(log.operator) || log.action.includes('\u7528\u6237\u7aef') || log.action.includes('\u4ee3\u7406\u7aef'));

export const isChineseTranslationOrder = (order: Order) =>
  order.productName.trim() === CHINESE_TRANSLATION_PRODUCT_TITLE;

export const isProductionVisibleChineseTranslationOrder = (order: Order) => {
  if (
    !isChineseTranslationOrder(order) ||
    !hasUserSubmittedMarker(order) ||
    order.status === 'pending_review' ||
    order.status === 'rejected'
  ) {
    return false;
  }

  return (
    PRODUCTION_VISIBLE_STATUSES.has(order.status) ||
    Boolean(order.managementOrderId?.trim()) ||
    hasProductionLog(order)
  );
};
