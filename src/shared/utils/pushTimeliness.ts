import type { Product, ProductProcessType } from '../types';
import { getProcessTypeTone } from './productProcessType';

export type TimelinessUnit = 'day' | 'hour';

export interface PushTimelinessEntry {
  value: string;
  unit: TimelinessUnit;
}

export type PushTimelinessConfig = Record<string, Record<string, PushTimelinessEntry>>;

export const PUSH_TIMELINESS_CONFIG_STORAGE_KEY = 'meika-push-timeliness-config';
export const DEFAULT_PUSH_TIMELINESS_UNIT: TimelinessUnit = 'day';
export const PUSH_TIMELINESS_UNIT_OPTIONS: Array<{ value: TimelinessUnit; label: string }> = [
  { value: 'day', label: '天' },
  { value: 'hour', label: '小时' },
];
export const PUSH_TIMELINESS_UNIT_LABELS: Record<TimelinessUnit, string> = {
  day: '天',
  hour: '小时',
};

interface SanitizePushTimelinessValueOptions {
  allowIncompleteDecimal?: boolean;
}

const LEGACY_PUSH_TIMELINESS_KEYS = [
  'normal',
  'priority',
  'urgent',
  'normal_standard',
  'normal_express',
  'priority_standard',
  'priority_express',
] as const;

const MAX_PUSH_TIMELINESS_DECIMAL_PLACES = 2;

const sanitizePushTimelinessString = (value: string, allowIncompleteDecimal: boolean) => {
  const cleanedValue = value.replace(/[\u3002\uFF0E\uFF0C,]/g, '.').replace(/[^\d.]/g, '');
  const hasDigit = /\d/.test(cleanedValue);

  if (!hasDigit) {
    return allowIncompleteDecimal && cleanedValue.includes('.') ? '0.' : '';
  }

  const [integerPart = '', ...decimalParts] = cleanedValue.split('.');
  const decimalPart = decimalParts.join('').slice(0, MAX_PUSH_TIMELINESS_DECIMAL_PLACES);

  if (decimalParts.length === 0) {
    return integerPart;
  }

  const normalizedIntegerPart = integerPart || '0';

  if (!decimalPart) {
    return allowIncompleteDecimal ? `${normalizedIntegerPart}.` : integerPart;
  }

  return `${normalizedIntegerPart}.${decimalPart}`;
};

export const sanitizePushTimelinessValue = (
  value: unknown,
  options: SanitizePushTimelinessValueOptions = {},
) => {
  const { allowIncompleteDecimal = false } = options;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return sanitizePushTimelinessString(String(Math.max(0, value)), false);
  }

  if (typeof value === 'string') {
    return sanitizePushTimelinessString(value, allowIncompleteDecimal);
  }

  return '';
};

export const sanitizePushTimelinessUnit = (value: unknown): TimelinessUnit =>
  value === 'hour' || value === '小时' ? 'hour' : DEFAULT_PUSH_TIMELINESS_UNIT;

export const createPushTimelinessEntry = (
  value = '',
  unit: TimelinessUnit = DEFAULT_PUSH_TIMELINESS_UNIT,
): PushTimelinessEntry => ({
  value,
  unit,
});

export const normalizePushTimelinessEntry = (
  value: unknown,
  fallbackUnit: unknown = DEFAULT_PUSH_TIMELINESS_UNIT,
): PushTimelinessEntry => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entry = value as Record<string, unknown>;

    return createPushTimelinessEntry(
      sanitizePushTimelinessValue(entry.value),
      sanitizePushTimelinessUnit(entry.unit ?? fallbackUnit),
    );
  }

  return createPushTimelinessEntry(
    sanitizePushTimelinessValue(value),
    sanitizePushTimelinessUnit(fallbackUnit),
  );
};

const hasPushTimelinessEntryData = (entry: PushTimelinessEntry) =>
  entry.value !== '' || entry.unit !== DEFAULT_PUSH_TIMELINESS_UNIT;

const getLegacyProcessTypeTimelinessUnit = (processType: ProductProcessType): TimelinessUnit =>
  getProcessTypeTone(processType.name, processType.estimatedDays) === 'urgent' ? 'hour' : 'day';

const getPushTimelinessConfigEntryByKey = (
  productConfig: Record<string, unknown>,
  key: string,
  fallbackUnit: TimelinessUnit,
) => {
  if (!Object.prototype.hasOwnProperty.call(productConfig, key)) {
    return null;
  }

  const nextEntry = normalizePushTimelinessEntry(productConfig[key], fallbackUnit);
  return hasPushTimelinessEntryData(nextEntry) ? nextEntry : null;
};

const getPushTimelinessConfigValue = (
  productConfig: Record<string, unknown>,
  processType: ProductProcessType,
) => {
  const legacyUnit = getLegacyProcessTypeTimelinessUnit(processType);
  const normalizedTypeIdEntry = getPushTimelinessConfigEntryByKey(productConfig, processType.typeId, legacyUnit);
  if (normalizedTypeIdEntry) {
    return normalizedTypeIdEntry;
  }

  const exactNameEntry = getPushTimelinessConfigEntryByKey(productConfig, processType.name, legacyUnit);
  if (exactNameEntry) {
    return exactNameEntry;
  }

  const tone = getProcessTypeTone(processType.name, processType.estimatedDays);
  const legacyKeys =
    tone === 'urgent'
      ? ['urgent']
      : tone === 'priority'
        ? ['priority', 'priority_standard', 'priority_express']
        : ['normal', 'normal_standard', 'normal_express'];

  for (const legacyKey of legacyKeys) {
    const legacyEntry = getPushTimelinessConfigEntryByKey(productConfig, legacyKey, legacyUnit);
    if (legacyEntry) {
      return legacyEntry;
    }
  }

  return createPushTimelinessEntry();
};

const buildProductPushTimelinessConfig = (
  productConfig: Record<string, unknown>,
  product: Product,
): Record<string, PushTimelinessEntry> => {
  const normalizedProductConfig: Record<string, PushTimelinessEntry> = {};

  product.processTypes.forEach((processType) => {
    const nextValue = getPushTimelinessConfigValue(productConfig, processType);
    if (hasPushTimelinessEntryData(nextValue)) {
      normalizedProductConfig[processType.typeId] = nextValue;
    }
  });

  return normalizedProductConfig;
};

const getDefaultPushTimelinessProductId = (products: Product[]) => products[0]?.productId || '';

const getLegacyPushTimelinessConfig = (
  rawValue: Record<string, unknown>,
  fallbackProduct: Product | undefined,
): PushTimelinessConfig => {
  if (!fallbackProduct) return {};

  const nextConfig = buildProductPushTimelinessConfig(rawValue, fallbackProduct);
  return Object.keys(nextConfig).length > 0 ? { [fallbackProduct.productId]: nextConfig } : {};
};

export const normalizePushTimelinessConfig = (config: PushTimelinessConfig, products: Product[]): PushTimelinessConfig => {
  const productsById = new Map(products.map((product) => [product.productId, product] as const));
  const normalizedConfig: PushTimelinessConfig = {};

  Object.entries(config).forEach(([productId, productConfig]) => {
    const product = productsById.get(productId);
    if (!product) {
      return;
    }

    const normalizedProductConfig = buildProductPushTimelinessConfig(productConfig, product);
    if (Object.keys(normalizedProductConfig).length > 0) {
      normalizedConfig[productId] = normalizedProductConfig;
    }
  });

  return normalizedConfig;
};

export const getStoredPushTimelinessConfig = (products: Product[]): PushTimelinessConfig => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(PUSH_TIMELINESS_CONFIG_STORAGE_KEY);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const parsedRecord = parsed as Record<string, unknown>;
    const fallbackProduct = products.find((product) => product.productId === getDefaultPushTimelinessProductId(products));
    const hasLegacyKeys = LEGACY_PUSH_TIMELINESS_KEYS.some((key) => key in parsedRecord);

    if (hasLegacyKeys) {
      return getLegacyPushTimelinessConfig(parsedRecord, fallbackProduct);
    }

    const nextConfig: PushTimelinessConfig = {};

    Object.entries(parsedRecord).forEach(([productId, productConfig]) => {
      const product = products.find((item) => item.productId === productId);
      if (!product || !productConfig || typeof productConfig !== 'object' || Array.isArray(productConfig)) {
        return;
      }

      const normalizedProductConfig = buildProductPushTimelinessConfig(productConfig as Record<string, unknown>, product);

      if (Object.keys(normalizedProductConfig).length > 0) {
        nextConfig[productId] = normalizedProductConfig;
      }
    });

    return normalizePushTimelinessConfig(nextConfig, products);
  } catch {
    return {};
  }
};

export const persistPushTimelinessConfig = (config: PushTimelinessConfig) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PUSH_TIMELINESS_CONFIG_STORAGE_KEY, JSON.stringify(config));
};

export const getDraftPushTimelinessEntry = (
  config: PushTimelinessConfig,
  productId: string,
  processTypeId: string,
): PushTimelinessEntry => {
  const savedEntry = config[productId]?.[processTypeId];
  return savedEntry ? normalizePushTimelinessEntry(savedEntry) : createPushTimelinessEntry();
};

export const formatPushTimelinessEntry = (entry: PushTimelinessEntry, emptyLabel = '--') => {
  if (!entry.value) {
    return emptyLabel;
  }

  return `${entry.value}${PUSH_TIMELINESS_UNIT_LABELS[entry.unit]}`;
};
