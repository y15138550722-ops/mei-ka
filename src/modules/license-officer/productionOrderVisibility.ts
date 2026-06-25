import type { Order } from '../../shared/types';

export const CHINESE_TRANSLATION_PRODUCT_TITLE = '\u6362\u56fd\u5185\u9a7e\u7167\u7ffb\u8bd1\u4ef6';
export const PRODUCTION_OPERATOR = '\u751f\u4ea7\u7aef';

const PRODUCTION_VISIBLE_STATUSES = new Set<Order['status']>([
  'pending_production',
  'in_production',
  'shipped',
  'completed',
]);
const hasProductionLog = (order: Order) => order.logs.some((log) => log.operator === PRODUCTION_OPERATOR);

export const isChineseTranslationOrder = (order: Order) =>
  order.productName.trim() === CHINESE_TRANSLATION_PRODUCT_TITLE ||
  order.productCategory === 'domestic_license' ||
  Boolean(order.domesticLicenseInfo);

export const isProductionVisibleChineseTranslationOrder = (order: Order) => {
  if (
    !isChineseTranslationOrder(order) ||
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
