import type { ProcessType } from '../types';

export interface DefaultProcessTypeTemplate {
  name: string;
  description: string;
  weight: number;
  estimatedDays: number;
  defaultPrice?: number;
}

export const BUILT_IN_PROCESS_TYPE_KEYS: ProcessType[] = ['normal', 'priority', 'urgent'];
export const DEFAULT_PROCESS_TYPE_PROFILE_PRODUCT_TITLE = '驾照翻译国际认证件（小白本）';
export const DEFAULT_STANDARD_PROCESS_TYPE_KEYS: ProcessType[] = ['normal', 'urgent'];

export const DEFAULT_PROFILE_PROCESS_TYPE_TEMPLATES: DefaultProcessTypeTemplate[] = [
  {
    name: '加急办理',
    description: '17:00前订单当天顺丰发货',
    weight: 0,
    estimatedDays: 1,
    defaultPrice: 289,
  },
  {
    name: '优先办理-加急配送',
    description: '1-2个工作日顺丰发货',
    weight: 0,
    estimatedDays: 2,
    defaultPrice: 289,
  },
  {
    name: '优先办理-普通配送',
    description: '2个工作日普通快递发货',
    weight: 0,
    estimatedDays: 2,
    defaultPrice: 289,
  },
  {
    name: '正常办理-加急配送',
    description: '3-7个工作日顺丰发货',
    weight: 0,
    estimatedDays: 7,
    defaultPrice: 289,
  },
  {
    name: '正常办理-普通配送',
    description: '3-7个工作日普通快递发货',
    weight: 0,
    estimatedDays: 7,
    defaultPrice: 289,
  },
];

export const DEFAULT_STANDARD_PROCESS_TYPE_TEMPLATES: DefaultProcessTypeTemplate[] = [
  {
    name: 'normal',
    description: '15个工作日',
    weight: 0,
    estimatedDays: 15,
  },
  {
    name: 'urgent',
    description: '3个工作日',
    weight: 0,
    estimatedDays: 3,
  },
];

const BUILT_IN_PROCESS_TYPE_SET = new Set<string>(BUILT_IN_PROCESS_TYPE_KEYS);

export const isBuiltInProcessType = (value: string): value is ProcessType => BUILT_IN_PROCESS_TYPE_SET.has(value);

export const isDefaultProcessTypeProfileProduct = (productTitle = '') =>
  productTitle.trim() === DEFAULT_PROCESS_TYPE_PROFILE_PRODUCT_TITLE;

export const getDefaultProcessTypeKeysForProduct = (productTitle = ''): ProcessType[] =>
  isDefaultProcessTypeProfileProduct(productTitle) ? BUILT_IN_PROCESS_TYPE_KEYS : DEFAULT_STANDARD_PROCESS_TYPE_KEYS;

export const getDefaultProcessTypeTemplatesForProduct = (productTitle = ''): DefaultProcessTypeTemplate[] =>
  (isDefaultProcessTypeProfileProduct(productTitle)
    ? DEFAULT_PROFILE_PROCESS_TYPE_TEMPLATES
    : DEFAULT_STANDARD_PROCESS_TYPE_TEMPLATES
  ).map((template) => ({ ...template }));

export const getProductProcessTypeLabel = (value: string, translate: (key: string) => string) =>
  isBuiltInProcessType(value) ? translate(`product.processType.${value}`) : value;

export const getProcessTypeTone = (value: string, estimatedDays?: number): ProcessType => {
  if (isBuiltInProcessType(value)) {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();
  const compactValue = normalizedValue.replace(/\s+/g, '');

  if (
    compactValue.startsWith('优先办理') ||
    compactValue.startsWith('priority')
  ) {
    return 'priority';
  }

  if (
    compactValue.startsWith('正常办理') ||
    compactValue.startsWith('普通办理') ||
    compactValue.startsWith('normal') ||
    compactValue.startsWith('standard')
  ) {
    return 'normal';
  }

  if (
    compactValue.startsWith('加急办理') ||
    compactValue.startsWith('urgent')
  ) {
    return 'urgent';
  }

  if (
    normalizedValue.includes('优先') ||
    normalizedValue.includes('priority') ||
    normalizedValue.includes('fast')
  ) {
    return 'priority';
  }

  if (
    normalizedValue.includes('正常办理') ||
    normalizedValue.includes('普通办理') ||
    normalizedValue.includes('standard')
  ) {
    return 'normal';
  }

  if (
    normalizedValue.includes('加急') ||
    normalizedValue.includes('urgent') ||
    normalizedValue.includes('express') ||
    normalizedValue.includes('极速')
  ) {
    return 'urgent';
  }

  if (typeof estimatedDays === 'number') {
    if (estimatedDays <= 1) return 'urgent';
    if (estimatedDays <= 7) return 'priority';
  }

  return 'normal';
};

export const getProcessTypeTimelinessUnit = (value: string, estimatedDays?: number): '天' | '小时' =>
  getProcessTypeTone(value, estimatedDays) === 'urgent' ? '小时' : '天';
