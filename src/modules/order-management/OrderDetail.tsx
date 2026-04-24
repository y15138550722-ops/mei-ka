import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getOrderById, updateOrder } from '../../services/mockDataService';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { orderPreviewAssets } from '../../shared/config/orderPreviewAssets';
import type { Order, OrderLog, OrderStatus, ProductCategory } from '../../shared/types';
import idpPassportFrontDefault from './assets/idp-passport-front.png';
import idpSignatureDefault from './assets/idp-signature.png';
import idpWhitePhotoDefault from './assets/idp-white-photo.png';
import './OrderDetail.css';

type CertificateImage = {
  key: string;
  label: string;
  src: string | null;
};

type EditableIdpImageField = 'whiteBackgroundPhoto' | 'signatureImage';

type OrderEditForm = {
  licenseNo: string;
  licenseName: string;
  surname: string;
  surnameEnglish: string;
  givenName: string;
  givenNameEnglish: string;
  gender: string;
  nationality: string;
  birthDate: string;
  birthDateEnglish: string;
  licenseCategory: string;
  licenseAddress: string;
  firstIssueDate: string;
  validFromDate: string;
  validUntilDate: string;
  validYears: string;
  birthPlaceEnglish: string;
  idpValidityYears: string;
  idpValidityEnglish: string;
  issuingAuthority: string;
  issuingRegion: string;
  selectedResidence: string;
  currentResidenceEnglish: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  whiteBackgroundPhoto: string;
  signatureImage: string;
};

type OrderListSource = {
  path: string;
  label: string;
};

type OrderListSourceState = {
  from?: string;
  listLabel?: string;
};

type DetailFieldItem = {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  fieldClassName?: string;
  labelClassName?: string;
};

const CERTIFICATE_IMAGES: CertificateImage[] = [
  {
    key: 'license-front',
    label: '驾照正面',
    src: orderPreviewAssets.licenseFront,
  },
  {
    key: 'license-back',
    label: '驾照反面',
    src: orderPreviewAssets.licenseBack,
  },
  {
    key: 'extra-front',
    label: '副页正面',
    src: orderPreviewAssets.extraFront,
  },
  {
    key: 'extra-back',
    label: '副页反面',
    src: orderPreviewAssets.extraBack,
  },
];

const IDP_CERTIFICATE_IMAGES: CertificateImage[] = [
  {
    key: 'license-front',
    label: '\u9a7e\u7167\u6b63\u9762',
    src: orderPreviewAssets.licenseFront,
  },
  {
    key: 'license-back',
    label: '\u9a7e\u7167\u53cd\u9762',
    src: orderPreviewAssets.licenseBack,
  },
  {
    key: 'passport-front',
    label: '\u62a4\u7167\u9996\u9875',
    src: idpPassportFrontDefault,
  },
  {
    key: 'white-background-photo',
    label: '2\u5bf8\u767d\u5e95\u7167',
    src: idpWhitePhotoDefault,
  },
  {
    key: 'signature',
    label: '\u7b7e\u540d',
    src: idpSignatureDefault,
  },
];

const PAYMENT_METHOD_LABELS: Record<Order['channel'], string> = {
  ctrip: '\u643a\u7a0b\u5728\u7ebf\u652f\u4ed8',
  fliggy: '\u98de\u732a\u5728\u7ebf\u652f\u4ed8',
  private: '\u5fae\u4fe1\u652f\u4ed8',
  offline: '\u7ebf\u4e0b\u8f6c\u8d26',
};

const IDP_LOCATION_OPTIONS = [
  {
    keywords: ['\u5317\u4eac'],
    zh: '\u5317\u4eac',
    en: 'Beijing, China',
    addressZh: '\u5317\u4eac\u5e02\u671d\u9633\u533a\u5efa\u56fd\u8def88\u53f7SOHO\u73b0\u4ee3\u57ce',
    addressEn: 'SOHO Modern City, No. 88 Jianguo Road, Chaoyang District, Beijing, China',
  },
  {
    keywords: ['\u4e0a\u6d77'],
    zh: '\u4e0a\u6d77',
    en: 'Shanghai, China',
    addressZh: '\u4e0a\u6d77\u5e02\u6d66\u4e1c\u65b0\u533a\u9646\u5bb6\u5634\u73af\u8def1000\u53f7',
    addressEn: 'No. 1000 Lujiazui Ring Road, Pudong New Area, Shanghai, China',
  },
  {
    keywords: ['\u5e7f\u5dde'],
    zh: '\u5e7f\u5dde',
    en: 'Guangzhou, China',
    addressZh: '\u5e7f\u5dde\u5e02\u5929\u6cb3\u533a\u5929\u6cb3\u8def385\u53f7\u592a\u53e4\u6c47',
    addressEn: 'Taikoo Hui, No. 385 Tianhe Road, Tianhe District, Guangzhou, China',
  },
  {
    keywords: ['\u6df1\u5733'],
    zh: '\u6df1\u5733',
    en: 'Shenzhen, China',
    addressZh: '\u6df1\u5733\u5e02\u5357\u5c71\u533a\u6df1\u5357\u5927\u90539966\u53f7',
    addressEn: 'No. 9966 Shennan Avenue, Nanshan District, Shenzhen, China',
  },
  {
    keywords: ['\u676d\u5dde'],
    zh: '\u676d\u5dde',
    en: 'Hangzhou, China',
    addressZh: '\u676d\u5dde\u5e02\u897f\u6e56\u533a\u6587\u4e09\u8def478\u53f7',
    addressEn: 'No. 478 Wensan Road, Xihu District, Hangzhou, China',
  },
  {
    keywords: ['\u6210\u90fd'],
    zh: '\u6210\u90fd',
    en: 'Chengdu, China',
    addressZh: '\u6210\u90fd\u5e02\u9526\u6c5f\u533a\u7ea2\u661f\u8def\u4e09\u6bb599\u53f7',
    addressEn: 'No. 99 Section 3 Hongxing Road, Jinjiang District, Chengdu, China',
  },
  {
    keywords: ['\u5357\u4eac'],
    zh: '\u5357\u4eac',
    en: 'Nanjing, China',
    addressZh: '\u5357\u4eac\u5e02\u9f13\u697c\u533a\u4e2d\u5c71\u8def18\u53f7',
    addressEn: 'No. 18 Zhongshan Road, Gulou District, Nanjing, China',
  },
  {
    keywords: ['\u6b66\u6c49'],
    zh: '\u6b66\u6c49',
    en: 'Wuhan, China',
    addressZh: '\u6b66\u6c49\u5e02\u6c5f\u6c49\u533a\u89e3\u653e\u5927\u9053688\u53f7',
    addressEn: 'No. 688 Jiefang Avenue, Jianghan District, Wuhan, China',
  },
  {
    keywords: ['\u7518\u8083', '\u5170\u5dde', '\u7ea2\u53e4', '\u6d77\u77f3\u6e7e'],
    zh: '\u5170\u5dde',
    en: 'Lanzhou, Gansu, China',
    addressZh: '\u7518\u8083\u7701\u5170\u5dde\u5e02\u7ea2\u53e4\u533a\u6d77\u77f3\u6e7e\u6c34\u6982\u82b1\u90fd',
    addressEn: 'Shuixie Huadu, Haishiwan, Honggu District, Lanzhou, Gansu, China',
  },
] as const;

const ENGLISH_MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  translating: '翻译中',
  pending_review: '待审核',
  pending_production: '待制作',
  in_production: '制作中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已驳回',
};

const PROCESS_TYPE_LABELS: Record<string, string> = {
  normal: '普通办理',
  priority: '优先办理',
  urgent: '加急办理',
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getCurrentTimestamp = () => formatBeijingTimestamp();

const getOrderSeed = (orderId: string) => Number(orderId.replace(/\D/g, '').slice(-6) || '0');

const padNumber = (value: number) => String(value).padStart(2, '0');

const createDateFromSeed = (seed: number, baseYear: number, yearSpan: number) => {
  const year = baseYear + (seed % yearSpan);
  const month = (seed % 12) + 1;
  const day = ((Math.floor(seed / 7) % 28) + 1);
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
};

const addYearsToDate = (dateString: string, years: number) => {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    return '--';
  }

  return `${year + years}-${padNumber(month)}-${padNumber(day)}`;
};

const getDisplayValue = (value?: string | null) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : '--';
};

const resolvePersistedValue = (value: string | undefined | null, fallback: string) =>
  value === undefined || value === null ? fallback : value;

const toEditableValue = (value: string | undefined | null, fallback = '') => {
  const resolvedValue = value === undefined || value === null ? fallback : value;
  return resolvedValue === '--' ? '' : resolvedValue;
};

const getStatusTagClass = (status: OrderStatus) => {
  const map: Record<OrderStatus, string> = {
    translating: 'warning',
    pending_review: 'pending',
    pending_production: 'processing',
    in_production: 'processing',
    shipped: 'shipped',
    completed: 'completed',
    cancelled: 'cancelled',
    rejected: 'rejected',
  };

  return `tag tag--${map[status] || 'pending'}`;
};

const getProcessTypeLabel = (processType: string) => PROCESS_TYPE_LABELS[processType] || processType || '--';

const ORDER_LIST_SOURCE_MAP: Record<ProductCategory, OrderListSource> = {
  translation: {
    path: '/orders',
    label: '翻译订单管理',
  },
  idp: {
    path: '/order-management/idp-orders',
    label: 'IDP订单管理',
  },
  notary: {
    path: '/order-management/notary-orders',
    label: '公证订单管理',
  },
};

const getOrderListSource = (category: ProductCategory) => ORDER_LIST_SOURCE_MAP[category];

const getOrderCategoryLabel = (category: ProductCategory) => {
  if (category === 'idp') {
    return 'IDP订单';
  }

  if (category === 'notary') {
    return '公证订单';
  }

  return '翻译订单';
};

const getLatestAuditLog = (logs: OrderLog[]) =>
  [...logs].reverse().find((log) => /审核通过|审核拒绝|审核驳回/.test(log.action));

const getAuditOperatorId = (order: Order) => {
  const latestAuditLog = getLatestAuditLog(order.logs);
  if (!latestAuditLog) {
    return '--';
  }

  return `RV${String(getOrderSeed(order.orderId)).padStart(6, '0')}`;
};

const CHINESE_COMPOUND_SURNAMES = [
  '欧阳',
  '太史',
  '端木',
  '上官',
  '司马',
  '东方',
  '独孤',
  '南宫',
  '万俟',
  '闻人',
  '夏侯',
  '诸葛',
  '尉迟',
  '公羊',
  '赫连',
  '澹台',
  '皇甫',
  '宗政',
  '濮阳',
  '公冶',
  '太叔',
  '申屠',
  '公孙',
  '慕容',
  '仲孙',
  '钟离',
  '长孙',
  '宇文',
  '司徒',
  '鲜于',
  '司空',
] as const;

const NAME_PINYIN_MAP: Record<string, string> = {
  张: 'ZHANG',
  王: 'WANG',
  李: 'LI',
  赵: 'ZHAO',
  孙: 'SUN',
  周: 'ZHOU',
  吴: 'WU',
  郑: 'ZHENG',
  陈: 'CHEN',
  钱: 'QIAN',
  刘: 'LIU',
  黄: 'HUANG',
  何: 'HE',
  马: 'MA',
  朱: 'ZHU',
  林: 'LIN',
  徐: 'XU',
  高: 'GAO',
  谢: 'XIE',
  韩: 'HAN',
  伟: 'WEI',
  芳: 'FANG',
  明: 'MING',
  丽: 'LI',
  强: 'QIANG',
  杰: 'JIE',
  秀: 'XIU',
  英: 'YING',
  敏: 'MIN',
  浩: 'HAO',
  亮: 'LIANG',
  洋: 'YANG',
  磊: 'LEI',
  欣: 'XIN',
  俊: 'JUN',
  静: 'JING',
  峰: 'FENG',
  蕾: 'LEI',
  宇: 'YU',
  雪: 'XUE',
};

const getChineseNameParts = (name: string) => {
  const matchedCompoundSurname = CHINESE_COMPOUND_SURNAMES.find((surname) => name.startsWith(surname));
  const surname = matchedCompoundSurname || name.slice(0, 1);
  const givenName = name.slice(surname.length);

  if (!surname || !givenName) {
    return {
      surnamePinyin: '--',
      givenNamePinyin: '--',
    };
  }

  const toPinyin = (value: string) => {
    const tokens = Array.from(value).map((char) => NAME_PINYIN_MAP[char]).filter(Boolean);
    return tokens.length === Array.from(value).length ? tokens.join(' ') : '--';
  };

  return {
    surnamePinyin: toPinyin(surname),
    givenNamePinyin: toPinyin(givenName),
  };
};

const getNamePinyinParts = (name: string) => {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (!normalizedName) {
    return {
      surnamePinyin: '--',
      givenNamePinyin: '--',
    };
  }

  if (/^[\u4e00-\u9fff]+$/u.test(normalizedName)) {
    return getChineseNameParts(normalizedName);
  }

  if (!/^[a-z\s]+$/i.test(normalizedName)) {
    return {
      surnamePinyin: '--',
      givenNamePinyin: '--',
    };
  }

  const [surname = '', ...restNames] = normalizedName.split(' ');
  return {
    surnamePinyin: surname.toUpperCase() || '--',
    givenNamePinyin: restNames.join(' ').toUpperCase() || '--',
  };
};

const getDisplayNameParts = (name: string) => {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (!normalizedName) {
    return {
      surname: '--',
      givenName: '--',
    };
  }

  if (/^[\u4e00-\u9fff]+$/u.test(normalizedName)) {
    const matchedCompoundSurname = CHINESE_COMPOUND_SURNAMES.find((surname) => normalizedName.startsWith(surname));
    const surname = matchedCompoundSurname || normalizedName.slice(0, 1);
    const givenName = normalizedName.slice(surname.length);

    return {
      surname: getDisplayValue(surname),
      givenName: getDisplayValue(givenName),
    };
  }

  if (/^[a-z\s]+$/i.test(normalizedName)) {
    const [surname = '', ...restNames] = normalizedName.split(' ');
    return {
      surname: getDisplayValue(surname.toUpperCase()),
      givenName: getDisplayValue(restNames.join(' ').toUpperCase()),
    };
  }

  return {
    surname: getDisplayValue(normalizedName),
    givenName: '--',
  };
};

const toPinyinValue = (value: string) => {
  const normalizedValue = value.trim().replace(/\s+/g, ' ');
  if (!normalizedValue) {
    return '--';
  }

  if (/^[a-z\s]+$/i.test(normalizedValue)) {
    return normalizedValue.toUpperCase();
  }

  const tokens = Array.from(normalizedValue).map((char) => NAME_PINYIN_MAP[char]).filter(Boolean);
  return tokens.length === Array.from(normalizedValue).length ? tokens.join(' ') : '--';
};

const joinNameParts = (surname: string, givenName: string) => {
  const nameParts = [surname.trim(), givenName.trim()].filter(Boolean);
  if (nameParts.length === 0) {
    return '';
  }

  return nameParts.every((item) => /^[a-z\s]+$/i.test(item)) ? nameParts.join(' ') : nameParts.join('');
};

const formatEnglishDate = (dateValue: string) => {
  const normalizedValue = dateValue.trim().toUpperCase();
  if (!normalizedValue) {
    return '--';
  }

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const monthIndex = Number(month) - 1;
    if (monthIndex < 0 || monthIndex >= ENGLISH_MONTH_LABELS.length) {
      return '--';
    }

    return `${day}-${ENGLISH_MONTH_LABELS[monthIndex]}-${year}`;
  }

  const englishMatch = normalizedValue.match(/^(\d{1,2})[\s-]([A-Z]{3})[\s-](\d{4})$/);
  if (!englishMatch) {
    return '--';
  }

  const [, day, month, year] = englishMatch;
  if (!ENGLISH_MONTH_LABELS.includes(month)) {
    return '--';
  }

  return `${day.padStart(2, '0')}-${month}-${year}`;
};

const normalizeEnglishDateValue = (value?: string | null) => {
  const normalizedValue = value?.trim() || '';
  if (!normalizedValue) {
    return '';
  }

  const formattedValue = formatEnglishDate(normalizedValue);
  return formattedValue === '--' ? normalizedValue : formattedValue;
};

const getIdpBirthDateEnglishValue = (value: string | undefined | null, birthDateValue: string) => {
  const normalizedValue = normalizeEnglishDateValue(value);
  if (normalizedValue) {
    return normalizedValue;
  }

  const formattedBirthDateValue = formatEnglishDate(birthDateValue === '--' ? '' : birthDateValue);
  return formattedBirthDateValue === '--' ? '' : formattedBirthDateValue;
};

const getNormalizedIdpValidity = (value?: string | null) => {
  const digits = value?.replace(/[^\d]/g, '').trim() || '';
  return digits ? `${digits}\u5e74` : '3\u5e74';
};

const formatIdpValidityEnglish = (value: string) => {
  const digits = value.replace(/[^\d]/g, '').trim();
  if (!digits) {
    return '--';
  }

  return `${digits} ${digits === '1' ? 'YEAR' : 'YEARS'}`;
};

const getIdpLocationOption = (value?: string | null) => {
  const normalizedValue = value?.trim() || '';
  if (!normalizedValue) {
    return null;
  }

  return (
    IDP_LOCATION_OPTIONS.find((option) => option.keywords.some((keyword) => normalizedValue.includes(keyword))) || null
  );
};

const getIdpResidenceLabel = (value?: string | null) => {
  const matchedLocation = getIdpLocationOption(value);
  if (matchedLocation) {
    return matchedLocation.zh;
  }

  const normalizedValue = value?.trim() || '';
  if (!normalizedValue) {
    return '--';
  }

  const extractedRegion = extractIssuingRegion(normalizedValue);
  return extractedRegion === '--' ? normalizedValue : extractedRegion;
};

const hasDetailedAddress = (value: string) =>
  /路|街|大道|号|巷|弄|湾|花都|小区|花园|城|汇|苑|栋|室/.test(value) || value.length >= 12;

const getIdpGeneratedAddress = (value?: string | null) => {
  const normalizedValue = value?.trim() || '';
  if (!normalizedValue) {
    return '--';
  }

  const matchedLocation = getIdpLocationOption(normalizedValue);
  if (!matchedLocation) {
    return normalizedValue;
  }

  return hasDetailedAddress(normalizedValue) ? normalizedValue : matchedLocation.addressZh;
};

const getIdpGeneratedEnglishAddress = (value?: string | null) => {
  const normalizedValue = value?.trim() || '';
  if (!normalizedValue) {
    return '--';
  }

  return getIdpLocationOption(normalizedValue)?.addressEn || '--';
};

const extractIssuingRegion = (address: string) => {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return '--';
  }

  const provinceMatch = normalizedAddress.match(/^(.{2,8}?(?:省|市|自治区|特别行政区))/);
  const province = provinceMatch?.[1] || '';
  const cityMatch = normalizedAddress.replace(province, '').match(/^(.{1,8}?(?:市|州|盟|区|县))/);
  const city = cityMatch?.[1] || '';

  return [province, city].filter(Boolean).join(' ') || normalizedAddress.slice(0, 12);
};

const getEditableIdpImageField = (key: CertificateImage['key']): EditableIdpImageField | null => {
  if (key === 'white-background-photo') {
    return 'whiteBackgroundPhoto';
  }

  if (key === 'signature') {
    return 'signatureImage';
  }

  return null;
};

const getDefaultIdpLicenseCategory = (seed: number) => {
  const categoryOptions = ['A', 'B', 'C'] as const;
  return categoryOptions[Math.abs(seed) % categoryOptions.length];
};

const normalizeIdpLicenseCategory = (value?: string | null, fallback = 'C') => {
  const normalizedValue = value?.trim().toUpperCase() || '';
  if (!normalizedValue) {
    return fallback;
  }

  if (/^A\d*$/.test(normalizedValue)) {
    return 'A';
  }

  if (/^B\d*$/.test(normalizedValue)) {
    return 'B';
  }

  if (/^C\d*$/.test(normalizedValue)) {
    return 'C';
  }

  return normalizedValue;
};

const buildLicenseAuditProfile = (order: Order) => {
  const seed = getOrderSeed(order.orderId);
  const licenseNameSource = resolvePersistedValue(order.licenseName, order.customerName);
  const licenseNoSource = resolvePersistedValue(order.licenseNo, order.customerPassport);
  const defaultLicenseCategory = order.productCategory === 'idp' ? getDefaultIdpLicenseCategory(seed) : 'C2';
  const rawLicenseCategorySource = resolvePersistedValue(order.licenseCategory, defaultLicenseCategory);
  const licenseCategorySource =
    order.productCategory === 'idp' ? normalizeIdpLicenseCategory(rawLicenseCategorySource, defaultLicenseCategory) : rawLicenseCategorySource;
  const birthDateSource = resolvePersistedValue(order.licenseBirthDate, createDateFromSeed(seed + 73, 1984, 12));
  const licenseAddressSource = resolvePersistedValue(order.licenseAddress, order.deliveryAddress || '');
  const firstIssueDateSource = resolvePersistedValue(order.licenseFirstIssueDate, createDateFromSeed(seed + 17, 2010, 8));
  const validFromDateSource = resolvePersistedValue(order.licenseValidFromDate, createDateFromSeed(seed + 41, 2021, 4));
  const validUntilDateSource = resolvePersistedValue(order.licenseValidUntilDate, addYearsToDate(validFromDateSource, 10));
  const validYearsSource = resolvePersistedValue(order.licenseValidYears, '10年');
  const issuingAuthoritySource = resolvePersistedValue(order.licenseIssuingAuthority, '公安交通管理局');
  const issuingRegionSource = resolvePersistedValue(order.licenseIssuingRegion, extractIssuingRegion(licenseAddressSource));
  const genderSource = resolvePersistedValue(order.licenseGender, seed % 4 === 0 ? '女' : '男');
  const nationalitySource = resolvePersistedValue(order.licenseNationality, '中国');
  const licenseName = getDisplayValue(licenseNameSource);
  const licenseNo = getDisplayValue(licenseNoSource);
  const licenseCategory = getDisplayValue(licenseCategorySource);
  const { surnamePinyin, givenNamePinyin } = getNamePinyinParts(licenseName === '--' ? '' : licenseName);

  return {
    licenseNo,
    licenseName,
    surnamePinyin,
    givenNamePinyin,
    gender: getDisplayValue(genderSource),
    nationality: getDisplayValue(nationalitySource),
    birthDate: getDisplayValue(birthDateSource),
    vehicleCategory: licenseCategory,
    licenseAddress: getDisplayValue(licenseAddressSource),
    firstIssueDate: getDisplayValue(firstIssueDateSource),
    validFromDate: getDisplayValue(validFromDateSource),
    validUntilDate: getDisplayValue(validUntilDateSource),
    validYears: getDisplayValue(validYearsSource),
    issuingAuthority: getDisplayValue(issuingAuthoritySource),
    issuingRegion: getDisplayValue(issuingRegionSource),
  };
};

const buildOrderEditForm = (order: Order): OrderEditForm => {
  const auditProfile = buildLicenseAuditProfile(order);
  const nameParts = getDisplayNameParts(auditProfile.licenseName === '--' ? '' : auditProfile.licenseName);
  const selectedResidenceSource = resolvePersistedValue(order.licenseAddress, order.deliveryAddress || '');
  const selectedResidence = getIdpGeneratedAddress(selectedResidenceSource);
  const matchedBirthPlace =
    getIdpLocationOption(resolvePersistedValue(order.licenseIssuingRegion, selectedResidenceSource)) ||
    getIdpLocationOption(order.deliveryAddress);
  const normalizedIdpValidity = getNormalizedIdpValidity(order.licenseValidYears);
  const birthDateEnglishValue = getIdpBirthDateEnglishValue(order.idpBirthDateEn, auditProfile.birthDate);
  const normalizedLicenseCategory =
    order.productCategory === 'idp'
      ? normalizeIdpLicenseCategory(
          order.licenseCategory,
          auditProfile.vehicleCategory === '--' ? getDefaultIdpLicenseCategory(getOrderSeed(order.orderId)) : auditProfile.vehicleCategory,
        )
      : order.licenseCategory;

  return {
    licenseNo: toEditableValue(order.licenseNo, auditProfile.licenseNo),
    licenseName: toEditableValue(order.licenseName, auditProfile.licenseName),
    surname: toEditableValue(nameParts.surname === '--' ? '' : nameParts.surname),
    surnameEnglish: toEditableValue(order.idpSurnameEn, toPinyinValue(nameParts.surname === '--' ? '' : nameParts.surname)),
    givenName: toEditableValue(nameParts.givenName === '--' ? '' : nameParts.givenName),
    givenNameEnglish: toEditableValue(order.idpGivenNameEn, toPinyinValue(nameParts.givenName === '--' ? '' : nameParts.givenName)),
    gender: toEditableValue(order.licenseGender, auditProfile.gender),
    nationality: toEditableValue(order.licenseNationality, auditProfile.nationality),
    birthDate: toEditableValue(order.licenseBirthDate, auditProfile.birthDate),
    birthDateEnglish: toEditableValue(birthDateEnglishValue),
    licenseCategory: toEditableValue(normalizedLicenseCategory, auditProfile.vehicleCategory),
    licenseAddress: toEditableValue(order.licenseAddress, auditProfile.licenseAddress),
    firstIssueDate: toEditableValue(order.licenseFirstIssueDate, auditProfile.firstIssueDate),
    validFromDate: toEditableValue(order.licenseValidFromDate, auditProfile.validFromDate),
    validUntilDate: toEditableValue(order.licenseValidUntilDate, auditProfile.validUntilDate),
    validYears: toEditableValue(order.licenseValidYears, auditProfile.validYears),
    birthPlaceEnglish: toEditableValue(order.idpBirthPlaceEn, matchedBirthPlace?.en || ''),
    idpValidityYears: toEditableValue(order.licenseValidYears, normalizedIdpValidity),
    idpValidityEnglish: toEditableValue(order.idpValidityEn, formatIdpValidityEnglish(normalizedIdpValidity)),
    issuingAuthority: toEditableValue(order.licenseIssuingAuthority, auditProfile.issuingAuthority),
    issuingRegion: toEditableValue(order.licenseIssuingRegion, auditProfile.issuingRegion),
    selectedResidence: toEditableValue(order.licenseAddress, selectedResidence === '--' ? '' : selectedResidence),
    currentResidenceEnglish: toEditableValue(order.idpCurrentResidenceEn, getIdpGeneratedEnglishAddress(selectedResidenceSource)),
    customerName: toEditableValue(order.customerName),
    customerPhone: toEditableValue(order.customerPhone),
    deliveryAddress: toEditableValue(order.deliveryAddress),
    whiteBackgroundPhoto: toEditableValue(order.idpWhitePhoto, idpWhitePhotoDefault),
    signatureImage: toEditableValue(order.idpSignature, idpSignatureDefault),
  };
};

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as OrderListSourceState | null;
  const previewMode = new URLSearchParams(location.search).get('mode') === 'audit' ? 'audit' : 'view';
  const fetchedOrder = useMemo<Order | null>(() => getOrderById(id || '') ?? null, [id]);

  const [order, setOrder] = useState<Order | null>(fetchedOrder);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<CertificateImage | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<OrderEditForm | null>(fetchedOrder ? buildOrderEditForm(fetchedOrder) : null);

  useEffect(() => {
    setOrder(fetchedOrder);
    setIsEditing(false);
    setEditForm(fetchedOrder ? buildOrderEditForm(fetchedOrder) : null);
    setShowRejectModal(false);
    setPreviewImage(null);
    setRejectReason('');
  }, [fetchedOrder]);

  const latestAuditLog = useMemo(() => (order ? getLatestAuditLog(order.logs) : null), [order]);
  const auditProfile = useMemo(() => (order ? buildLicenseAuditProfile(order) : null), [order]);
  const pinyinPreview = useMemo(
    () => getNamePinyinParts(editForm?.licenseName || ''),
    [editForm?.licenseName],
  );
  const isAuditable = order?.status === 'pending_review' && previewMode === 'audit';
  const isReadOnlyPreview = !isAuditable;
  const isViewPreview = previewMode === 'view';
  const isIdpOrder = order?.productCategory === 'idp';
  const auditPageTitle = isAuditable ? '订单审核' : '查看审核';

  const inferredOrderListSource = order ? getOrderListSource(order.productCategory) : null;
  const sourceListPath = navigationState?.from || inferredOrderListSource?.path || '/orders';
  const sourceListLabel = navigationState?.listLabel || inferredOrderListSource?.label || '翻译订单管理';
  const orderCategoryLabel = order ? getOrderCategoryLabel(order.productCategory) : '翻译订单';

  if (!order || !auditProfile || !editForm) {
    return (
      <div className="app-main animate-fadeIn">
        <div className="card order-audit-empty-card">
          <div className="empty-state">
            <div className="empty-state__icon">404</div>
            <div className="empty-state__text">未找到对应订单，请返回订单列表重新选择。</div>
            <button type="button" className="btn btn--primary" onClick={() => navigate(sourceListPath)}>
              返回订单列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleEditFieldChange = (field: keyof OrderEditForm, value: string) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, [field]: value } : currentForm));
  };

  const handleIdpImageUpload = (field: EditableIdpImageField, file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('error', '请选择图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        showToast('error', '图片读取失败，请重试');
        return;
      }

      handleEditFieldChange(field, result);
      showToast('success', field === 'whiteBackgroundPhoto' ? '2寸白底照已更新，保存后生效' : '签名已更新，保存后生效');
    };
    reader.onerror = () => showToast('error', '图片读取失败，请重试');
    reader.readAsDataURL(file);
  };

  const handleReturn = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(sourceListPath);
  };

  const handleApprove = () => {
    updateOrder(order.orderId, {
      status: 'pending_production',
      updatedAt: getCurrentTimestamp(),
      logs: [
        ...order.logs,
        {
          time: getCurrentTimestamp(),
          operator: '审核员',
          action: '审核通过',
        },
      ],
    });

    showToast('success', '审核通过，订单已转入待制作');
    window.setTimeout(() => navigate(sourceListPath), 1200);
  };

  const handleReject = () => {
    const nextRejectReason = rejectReason.trim();
    if (!nextRejectReason) {
      return;
    }

    updateOrder(order.orderId, {
      status: 'cancelled',
      rejectReason: nextRejectReason,
      remark: nextRejectReason,
      updatedAt: getCurrentTimestamp(),
      logs: [
        ...order.logs,
        {
          time: getCurrentTimestamp(),
          operator: '审核员',
          action: `审核拒绝：${nextRejectReason}`,
        },
      ],
    });

    setShowRejectModal(false);
    setRejectReason('');
    showToast('error', '订单已驳回');
    window.setTimeout(() => navigate(sourceListPath), 1200);
  };

  const handleModify = () => {
    setEditForm(buildOrderEditForm(order));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm(buildOrderEditForm(order));
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (isIdpOrder) {
      const requiredFields: Array<{ key: keyof OrderEditForm; label: string }> = [
        { key: 'surname', label: '\u59d3' },
        { key: 'surnameEnglish', label: '\u59d3-\u82f1\u6587' },
        { key: 'givenName', label: '\u540d' },
        { key: 'givenNameEnglish', label: '\u540d-\u82f1\u6587' },
        { key: 'gender', label: '\u6027\u522b' },
        { key: 'birthDate', label: '\u51fa\u751f\u65e5\u671f' },
        { key: 'birthDateEnglish', label: '\u51fa\u751f\u65e5\u671f-\u82f1\u6587' },
        { key: 'licenseCategory', label: '\u51c6\u9a7e\u8f66\u578b' },
        { key: 'birthPlaceEnglish', label: '\u51fa\u751f\u5730-\u82f1\u6587' },
        { key: 'selectedResidence', label: '\u73b0\u5c45\u5730\u5740' },
        { key: 'currentResidenceEnglish', label: '\u73b0\u5c45\u5730\u5740-\u82f1\u6587' },
        { key: 'idpValidityYears', label: 'IDP\u6709\u6548\u671f' },
        { key: 'idpValidityEnglish', label: 'IDP\u6709\u6548\u671f-\u82f1\u6587' },
        { key: 'whiteBackgroundPhoto', label: '2\u5bf8\u767d\u5e95\u7167' },
        { key: 'signatureImage', label: '\u7b7e\u540d' },
      ];

      const missingField = requiredFields.find(({ key }) => !editForm[key].trim());
      if (missingField) {
        showToast('error', `\u8bf7\u586b\u5199${missingField.label}`);
        return;
      }

      const normalizedName = joinNameParts(editForm.surname, editForm.givenName);
      const normalizedValidity = getNormalizedIdpValidity(editForm.idpValidityYears);
      const normalizedLicenseCategory = normalizeIdpLicenseCategory(editForm.licenseCategory);

      const nextUpdates: Partial<Order> = {
        licenseName: normalizedName,
        licenseGender: editForm.gender.trim(),
        licenseBirthDate: editForm.birthDate.trim(),
        licenseCategory: normalizedLicenseCategory,
        licenseAddress: editForm.selectedResidence.trim(),
        licenseIssuingRegion: extractIssuingRegion(editForm.selectedResidence.trim()),
        licenseValidYears: normalizedValidity,
        idpSurnameEn: editForm.surnameEnglish.trim(),
        idpGivenNameEn: editForm.givenNameEnglish.trim(),
        idpBirthDateEn: editForm.birthDateEnglish.trim(),
        idpBirthPlaceEn: editForm.birthPlaceEnglish.trim(),
        idpCurrentResidenceEn: editForm.currentResidenceEnglish.trim(),
        idpValidityEn: editForm.idpValidityEnglish.trim(),
        idpWhitePhoto: editForm.whiteBackgroundPhoto.trim(),
        idpSignature: editForm.signatureImage.trim(),
        updatedAt: getCurrentTimestamp(),
        logs: [
          ...order.logs,
          {
            time: getCurrentTimestamp(),
            operator: '\u5ba1\u6838\u5458',
            action: '\u4fee\u6539IDP\u4e2a\u4eba\u4fe1\u606f',
          },
        ],
      };

      updateOrder(order.orderId, nextUpdates);

      const nextOrder = {
        ...order,
        ...nextUpdates,
      } as Order;

      setOrder(nextOrder);
      setEditForm(buildOrderEditForm(nextOrder));
      setIsEditing(false);
      showToast('success', 'IDP\u4e2a\u4eba\u4fe1\u606f\u5df2\u66f4\u65b0');
      return;
    }

    const requiredFields: Array<{ key: keyof OrderEditForm; label: string }> = [
      { key: 'licenseNo', label: '驾证号码' },
      { key: 'licenseName', label: '姓名' },
      { key: 'licenseCategory', label: '准驾车型' },
      { key: 'licenseAddress', label: '驾照地址详情' },
      { key: 'customerName', label: '收货人' },
      { key: 'customerPhone', label: '联系电话' },
      { key: 'deliveryAddress', label: '收货地址' },
    ];

    const missingField = requiredFields.find(({ key }) => !editForm[key].trim());
    if (missingField) {
      showToast('error', `请填写${missingField.label}`);
      return;
    }

    const nextUpdates: Partial<Order> = {
      licenseNo: editForm.licenseNo.trim(),
      licenseName: editForm.licenseName.trim(),
      licenseGender: editForm.gender.trim(),
      licenseNationality: editForm.nationality.trim(),
      licenseBirthDate: editForm.birthDate.trim(),
      licenseCategory: editForm.licenseCategory.trim(),
      licenseAddress: editForm.licenseAddress.trim(),
      licenseFirstIssueDate: editForm.firstIssueDate.trim(),
      licenseValidFromDate: editForm.validFromDate.trim(),
      licenseValidUntilDate: editForm.validUntilDate.trim(),
      licenseValidYears: editForm.validYears.trim(),
      licenseIssuingAuthority: editForm.issuingAuthority.trim(),
      licenseIssuingRegion: editForm.issuingRegion.trim(),
      customerName: editForm.customerName.trim(),
      customerPhone: editForm.customerPhone.trim(),
      deliveryAddress: editForm.deliveryAddress.trim(),
      updatedAt: getCurrentTimestamp(),
      logs: [
        ...order.logs,
        {
          time: getCurrentTimestamp(),
          operator: '审核员',
          action: '修改驾照与收货信息',
        },
      ],
    };

    updateOrder(order.orderId, nextUpdates);

    const nextOrder = {
      ...order,
      ...nextUpdates,
    } as Order;

    setOrder(nextOrder);
    setEditForm(buildOrderEditForm(nextOrder));
    setIsEditing(false);
    showToast('success', '驾照信息和收货信息已更新');
  };

  const renderEditor = (
    field: keyof OrderEditForm,
    options: {
      type?: 'text' | 'date' | 'tel';
      multiline?: boolean;
      rows?: number;
      placeholder?: string;
    } = {},
  ) => {
    const { type = 'text', multiline = false, rows = 3, placeholder } = options;
    const value = editForm[field];

    if (multiline) {
      return (
        <textarea
          className="form-textarea order-audit-field__editor order-audit-field__editor--textarea"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => handleEditFieldChange(field, event.target.value)}
        />
      );
    }

    return (
      <input
        type={type}
        className="form-input order-audit-field__editor"
        value={value}
        placeholder={placeholder}
        onChange={(event) => handleEditFieldChange(field, event.target.value)}
      />
    );
  };

  const idpDisplayName = joinNameParts(
    isEditing ? editForm.surname : auditProfile.licenseName === '--' ? '' : getDisplayNameParts(auditProfile.licenseName).surname,
    isEditing ? editForm.givenName : auditProfile.licenseName === '--' ? '' : getDisplayNameParts(auditProfile.licenseName).givenName,
  );
  const idpNameParts = getDisplayNameParts(idpDisplayName);
  const idpBirthDate = isEditing ? getDisplayValue(editForm.birthDate) : auditProfile.birthDate;
  const idpSelectedResidenceRaw = isEditing
    ? editForm.selectedResidence
    : getIdpGeneratedAddress(resolvePersistedValue(order.licenseAddress, order.deliveryAddress || ''));
  const idpSelectedResidence = getDisplayValue(idpSelectedResidenceRaw);
  const idpBirthPlaceProfile =
    getIdpLocationOption(auditProfile.issuingRegion) || getIdpLocationOption(order.deliveryAddress);
  const idpSurnameEnglish = getDisplayValue(
    isEditing
      ? editForm.surnameEnglish
      : resolvePersistedValue(order.idpSurnameEn, toPinyinValue(idpNameParts.surname === '--' ? '' : idpNameParts.surname)),
  );
  const idpGivenNameEnglish = getDisplayValue(
    isEditing
      ? editForm.givenNameEnglish
      : resolvePersistedValue(order.idpGivenNameEn, toPinyinValue(idpNameParts.givenName === '--' ? '' : idpNameParts.givenName)),
  );
  const idpBirthDateEnglish = getDisplayValue(
    isEditing
      ? editForm.birthDateEnglish
      : getIdpBirthDateEnglishValue(order.idpBirthDateEn, idpBirthDate),
  );
  const idpBirthPlaceEnglish = getDisplayValue(
    isEditing ? editForm.birthPlaceEnglish : resolvePersistedValue(order.idpBirthPlaceEn, idpBirthPlaceProfile?.en || ''),
  );
  const idpCurrentResidenceAddressEn = getDisplayValue(
    isEditing
      ? editForm.currentResidenceEnglish
      : resolvePersistedValue(order.idpCurrentResidenceEn, getIdpGeneratedEnglishAddress(idpSelectedResidenceRaw)),
  );
  const idpValidity = isEditing ? getNormalizedIdpValidity(editForm.idpValidityYears) : getNormalizedIdpValidity(order.licenseValidYears);
  const idpValidityEnglish = getDisplayValue(
    isEditing ? editForm.idpValidityEnglish : resolvePersistedValue(order.idpValidityEn, formatIdpValidityEnglish(idpValidity)),
  );
  const idpAuditOrderInfoItems: DetailFieldItem[] = [
    {
      label: '\u8ba2\u5355\u53f7',
      value: order.orderId,
    },
    {
      label: '\u652f\u4ed8\u65b9\u5f0f',
      value: PAYMENT_METHOD_LABELS[order.channel] || '--',
    },
    {
      label: '\u4e0b\u5355\u65f6\u95f4',
      value: getDisplayValue(order.createdAt),
    },
  ];

  const idpPersonalInfoItems: DetailFieldItem[] = [
    {
      label: '\u59d3',
      value: isEditing ? renderEditor('surname', { placeholder: '\u8bf7\u8f93\u5165\u59d3' }) : idpNameParts.surname,
    },
    {
      label: '\u59d3-\u82f1\u6587',
      value: isEditing ? renderEditor('surnameEnglish', { placeholder: '\u8bf7\u8f93\u5165\u59d3-\u82f1\u6587' }) : idpSurnameEnglish,
    },
    {
      label: '\u540d',
      value: isEditing ? renderEditor('givenName', { placeholder: '\u8bf7\u8f93\u5165\u540d' }) : idpNameParts.givenName,
    },
    {
      label: '\u540d-\u82f1\u6587',
      value: isEditing ? renderEditor('givenNameEnglish', { placeholder: '\u8bf7\u8f93\u5165\u540d-\u82f1\u6587' }) : idpGivenNameEnglish,
    },
    {
      label: '\u6027\u522b',
      value: isEditing ? renderEditor('gender', { placeholder: '\u8bf7\u8f93\u5165\u6027\u522b' }) : auditProfile.gender,
    },
    {
      label: '\u51fa\u751f\u65e5\u671f',
      value: isEditing ? renderEditor('birthDate', { type: 'date' }) : idpBirthDate,
    },
    {
      label: '\u51fa\u751f\u65e5\u671f-\u82f1\u6587',
      value: isEditing ? renderEditor('birthDateEnglish') : idpBirthDateEnglish,
    },
    {
      label: '\u51c6\u9a7e\u8f66\u578b',
      value: isEditing ? renderEditor('licenseCategory', { placeholder: '\u5982 A / B / C' }) : auditProfile.vehicleCategory,
    },
    {
      label: '\u51fa\u751f\u5730-\u82f1\u6587',
      value: isEditing ? renderEditor('birthPlaceEnglish', { placeholder: '\u8bf7\u8f93\u5165\u51fa\u751f\u5730-\u82f1\u6587' }) : idpBirthPlaceEnglish,
    },
    {
      label: '\u73b0\u5c45\u5730\u5740',
      value: isEditing
        ? renderEditor('selectedResidence', { placeholder: '\u8bf7\u8f93\u5165\u73b0\u5c45\u5730\u5740' })
        : idpSelectedResidence,
    },
    {
      label: '\u73b0\u5c45\u5730\u5740-\u82f1\u6587',
      value: isEditing
        ? renderEditor('currentResidenceEnglish', {
            multiline: true,
            rows: 3,
            placeholder: '\u8bf7\u8f93\u5165\u73b0\u5c45\u5730\u5740-\u82f1\u6587',
          })
        : idpCurrentResidenceAddressEn,
      fullWidth: true,
    },
    {
      label: 'IDP\u6709\u6548\u671f',
      value: isEditing ? renderEditor('idpValidityYears', { placeholder: '\u5982 3\u5e74' }) : idpValidity,
    },
    {
      label: 'IDP\u6709\u6548\u671f-\u82f1\u6587',
      value: isEditing ? renderEditor('idpValidityEnglish', { placeholder: '\u5982 3 YEARS' }) : idpValidityEnglish,
    },
  ];

  const auditCertificateImages = isIdpOrder
    ? IDP_CERTIFICATE_IMAGES.map((item) => {
        if (item.key === 'white-background-photo') {
          return {
            ...item,
            src: (isEditing ? editForm.whiteBackgroundPhoto : order.idpWhitePhoto) || idpWhitePhotoDefault,
          };
        }

        if (item.key === 'signature') {
          return {
            ...item,
            src: (isEditing ? editForm.signatureImage : order.idpSignature) || idpSignatureDefault,
          };
        }

        return item;
      })
    : CERTIFICATE_IMAGES;
  const auditImageTitle = isIdpOrder ? '\u8bc1\u4ef6\u4fe1\u606f' : '\u8bc1\u4ef6\u56fe\u7247';

  const orderInfoItems: DetailFieldItem[] = [
    {
      label: '订单状态',
      value: <span className={`${getStatusTagClass(order.status)} order-audit-status-tag`}>{ORDER_STATUS_LABELS[order.status]}</span>,
    },
    {
      label: '下单时间',
      value: getDisplayValue(order.createdAt),
    },
    {
      label: '审核时间',
      value: getDisplayValue(latestAuditLog?.time),
    },
    {
      label: '审核人ID',
      value: getAuditOperatorId(order),
    },
    {
      label: '订单号',
      value: order.orderId,
    },
    {
      label: '驾照官推送订单号',
      value: '--',
      fieldClassName: 'order-audit-field--wide-label',
      labelClassName: 'order-audit-field__label--nowrap',
    },
  ];

  const productInfoItems = [
    {
      label: '订单号',
      value: order.orderId,
    },
    {
      label: '产品名称',
      value: getDisplayValue(order.productName),
    },
    {
      label: '办理类型',
      value: getProcessTypeLabel(order.processType),
    },
    {
      label: '订单状态',
      value: <span className={`${getStatusTagClass(order.status)} order-audit-status-tag`}>{ORDER_STATUS_LABELS[order.status]}</span>,
    },
    {
      label: '下单时间',
      value: getDisplayValue(order.createdAt),
    },
    {
      label: '实付金额',
      value: currencyFormatter.format(order.lockedPrice || 0),
    },
  ];

  const licenseInfoItems: DetailFieldItem[] = [
    {
      label: '驾证号码',
      value: isEditing ? renderEditor('licenseNo', { placeholder: '请输入驾证号码' }) : auditProfile.licenseNo,
    },
    {
      label: '姓名',
      value: isEditing ? renderEditor('licenseName', { placeholder: '请输入姓名' }) : auditProfile.licenseName,
    },
    { label: '姓氏拼音', value: isEditing ? pinyinPreview.surnamePinyin : auditProfile.surnamePinyin },
    { label: '名字拼音', value: isEditing ? pinyinPreview.givenNamePinyin : auditProfile.givenNamePinyin },
    { label: '性别', value: isEditing ? renderEditor('gender', { placeholder: '请输入性别' }) : auditProfile.gender },
    {
      label: '国籍',
      value: isEditing ? renderEditor('nationality', { placeholder: '请输入国籍' }) : auditProfile.nationality,
    },
    {
      label: '出生日期',
      value: isEditing ? renderEditor('birthDate', { type: 'date' }) : auditProfile.birthDate,
    },
    {
      label: '准驾车型',
      value: isEditing ? renderEditor('licenseCategory', { placeholder: '如 C1 / C2' }) : auditProfile.vehicleCategory,
    },
    {
      label: '驾照地址详情',
      value: isEditing ? renderEditor('licenseAddress', { multiline: true, rows: 3, placeholder: '请输入驾照地址' }) : auditProfile.licenseAddress,
      fullWidth: true,
    },
    {
      label: '初次领证日期',
      value: isEditing ? renderEditor('firstIssueDate', { type: 'date' }) : auditProfile.firstIssueDate,
    },
    {
      label: '有效起始日期',
      value: isEditing ? renderEditor('validFromDate', { type: 'date' }) : auditProfile.validFromDate,
    },
    {
      label: '有效年限',
      value: isEditing ? renderEditor('validYears', { placeholder: '如 10年' }) : auditProfile.validYears,
    },
    {
      label: '发证机关',
      value: isEditing ? renderEditor('issuingAuthority', { placeholder: '请输入发证机关' }) : auditProfile.issuingAuthority,
    },
    {
      label: '发证地区',
      value: isEditing ? renderEditor('issuingRegion', { placeholder: '请输入发证地区' }) : auditProfile.issuingRegion,
    },
  ];

  const deliveryInfoItems: DetailFieldItem[] = [
    {
      label: '收货人',
      value: isEditing ? renderEditor('customerName', { placeholder: '请输入收货人' }) : getDisplayValue(order.customerName),
    },
    {
      label: '联系电话',
      value: isEditing ? renderEditor('customerPhone', { type: 'tel', placeholder: '请输入联系电话' }) : getDisplayValue(order.customerPhone),
    },
    {
      label: '收货地址',
      value: isEditing ? renderEditor('deliveryAddress', { multiline: true, rows: 3, placeholder: '请输入收货地址' }) : getDisplayValue(order.deliveryAddress),
      fullWidth: true,
    },
  ];

  const viewDeliveryInfoItems = [
    {
      label: '收货人',
      value: getDisplayValue(order.customerName),
    },
    {
      label: '联系电话',
      value: getDisplayValue(order.customerPhone),
    },
    {
      label: '联系邮箱',
      value: getDisplayValue(order.customerEmail),
    },
    {
      label: '物流公司',
      value: getDisplayValue(order.logisticsCompany),
    },
    {
      label: '物流单号',
      value: getDisplayValue(order.trackingNumber),
    },
    {
      label: '收货地址',
      value: getDisplayValue(order.deliveryAddress),
      fullWidth: true,
    },
  ];

  const orderDetailViewDeliveryItems: DetailFieldItem[] = [
    {
      label: '\u6536\u8d27\u4eba',
      value: getDisplayValue(order.customerName),
    },
    {
      label: '\u8054\u7cfb\u7535\u8bdd',
      value: getDisplayValue(order.customerPhone),
    },
    {
      label: '\u8054\u7cfb\u90ae\u7bb1',
      value: getDisplayValue(order.customerEmail),
    },
    {
      label: '\u6536\u8d27\u5730\u5740',
      value: getDisplayValue(order.deliveryAddress),
    },
  ];

  const orderDetailViewProductItems: DetailFieldItem[] = [
    {
      label: '\u8ba2\u5355\u7f16\u53f7',
      value: order.orderId,
    },
    {
      label: '\u5546\u54c1\u540d\u79f0',
      value: getDisplayValue(order.productName),
    },
    {
      label: '\u529e\u7406\u7c7b\u578b',
      value: getProcessTypeLabel(order.processType),
    },
    {
      label: '\u603b\u4ef7',
      value: currencyFormatter.format(order.lockedPrice || 0),
    },
  ];

  return (
    <div className="animate-fadeIn">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      {isViewPreview && (
        <div className="app-topbar order-detail-view-topbar-wrap">
          <div className="order-audit-topbar order-detail-view-topbar">
            <div className="order-audit-topbar__heading">
              <div className="app-topbar__breadcrumb">
                <button type="button" className="order-audit-topbar__back" onClick={() => navigate(sourceListPath)}>
                  {sourceListLabel}
                </button>
                <span>/</span>
                <span>{'\u67e5\u770b\u8ba2\u5355'}</span>
              </div>
              <div className="order-audit-topbar__actions">
                <button type="button" className="btn btn--primary order-audit-topbar__return-btn" onClick={handleReturn}>
                  {'\u8fd4\u56de'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isViewPreview && (
      <div className="app-topbar">
        <div className="order-audit-topbar">
          <div className="order-audit-topbar__heading">
            <div className="app-topbar__breadcrumb">
              <button type="button" className="order-audit-topbar__back" onClick={() => navigate(sourceListPath)}>
                {sourceListLabel}
              </button>
              <span>/</span>
              <span>{auditPageTitle}</span>
              <span>/</span>
              <span>{order.orderId}</span>
            </div>
            {isReadOnlyPreview && (
              <div className="order-audit-topbar__actions">
                <button type="button" className="btn btn--primary order-audit-topbar__return-btn" onClick={handleReturn}>
                  返回
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {isViewPreview && (
        <div className="app-main order-audit-page order-detail-view-page">
          <div className="order-detail-view-layout">
            <section className="card order-detail-view-card">
              <div className="card__header order-audit-card__header order-detail-view-card__header">
                <h2 className="order-audit-card__title">{'\u6536\u8d27\u4fe1\u606f'}</h2>
              </div>
              <div className="card__body order-detail-view-card__body">
                <div className="order-detail-view-grid order-detail-view-grid--delivery">
                  {orderDetailViewDeliveryItems.map((item) => (
                    <div
                      key={item.label}
                      className={`order-detail-view-field ${item.fullWidth ? 'order-detail-view-field--full' : ''}`}
                    >
                      <span className="order-detail-view-field__label">{item.label}:</span>
                      <div className="order-detail-view-field__value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="card order-detail-view-card">
              <div className="card__header order-audit-card__header order-detail-view-card__header">
                <h2 className="order-audit-card__title">{'\u5546\u54c1\u4fe1\u606f'}</h2>
              </div>
              <div className="card__body order-detail-view-card__body">
                <div className="order-detail-view-grid order-detail-view-grid--product">
                  {orderDetailViewProductItems.map((item) => (
                    <div key={item.label} className="order-detail-view-field">
                      <span className="order-detail-view-field__label">{item.label}:</span>
                      <div className="order-detail-view-field__value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {!isViewPreview && (
      <div className="app-main order-audit-page">
        <div className={`order-audit-layout ${isViewPreview ? 'order-audit-layout--single-column order-detail-view-layout' : ''}`}>
          <div className="order-audit-main">
            {isViewPreview ? (
              <>
                <section className="card order-audit-card order-detail-view-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">商品信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-detail-view-summary">
                      <div className="order-detail-view-summary__content">
                        <span className="order-detail-view-summary__eyebrow">{orderCategoryLabel}</span>
                        <h3 className="order-detail-view-summary__title">{getDisplayValue(order.productName)}</h3>
                        <div className="order-detail-view-summary__meta">
                          <span>{getProcessTypeLabel(order.processType)}</span>
                          <span>{currencyFormatter.format(order.lockedPrice || 0)}</span>
                        </div>
                      </div>
                      <div className="order-detail-view-summary__status">
                        <span className={`${getStatusTagClass(order.status)} order-audit-status-tag`}>{ORDER_STATUS_LABELS[order.status]}</span>
                      </div>
                    </div>
                    <div className="order-audit-grid order-detail-view-grid">
                      {productInfoItems.map((item) => (
                        <div key={item.label} className="order-audit-field">
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card order-detail-view-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">收货信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid order-detail-view-grid">
                      {viewDeliveryInfoItems.map((item) => (
                        <div
                          key={item.label}
                          className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}
                        >
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
            {isIdpOrder ? (
              <>
                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">{'\u8ba2\u5355\u4fe1\u606f'}</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {idpAuditOrderInfoItems.map((item) => (
                        <div key={item.label} className="order-audit-field">
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">{'\u4e2a\u4eba\u4fe1\u606f'}</h2>
                    {isEditing && <span className="order-audit-editing-tip">{'\u7f16\u8f91\u4e2d'}</span>}
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid order-audit-grid--idp-personal">
                      {idpPersonalInfoItems.map((item) => (
                        <div
                          key={item.label}
                          className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}
                        >
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card order-audit-image-card order-audit-image-card--inline">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">{auditImageTitle}</h2>
                  </div>
                  <div className="order-audit-image-grid order-audit-image-grid--four-up">
                    {auditCertificateImages.map((item) => (
                      (() => {
                        const editableImageField = getEditableIdpImageField(item.key);
                        const uploadInputId = `order-audit-image-upload-${item.key}`;

                        return (
                          <div
                            key={item.key}
                            className={`order-audit-image-slot ${item.src ? '' : 'order-audit-image-slot--empty'}`}
                          >
                            <div className="order-audit-image-slot__meta">
                              <span className="order-audit-image-slot__label">{item.label}</span>
                            </div>
                            <div className="order-audit-image-frame">
                              {item.src ? (
                                <button
                                  type="button"
                                  className="order-audit-image-trigger"
                                  onClick={() => setPreviewImage(item)}
                                  aria-label={`\u67e5\u770b${item.label}\u5927\u56fe`}
                                >
                                  <img className="order-audit-image" src={item.src} alt={`${item.label}\u9884\u89c8`} />
                                </button>
                              ) : (
                                <div className="order-audit-image-placeholder" aria-hidden="true">
                                  <strong>\u6682\u65e0\u56fe\u7247</strong>
                                  <span>\u7b49\u5f85\u4e0a\u4f20</span>
                                </div>
                              )}
                            </div>
                            {isEditing && editableImageField && (
                              <div className="order-audit-image-slot__actions">
                                <label htmlFor={uploadInputId} className="order-audit-image-upload-btn">
                                  {item.key === 'white-background-photo' ? '\u66f4\u63622\u5bf8\u767d\u5e95\u7167' : '\u66f4\u6362\u7b7e\u540d'}
                                </label>
                                <input
                                  id={uploadInputId}
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/webp"
                                  className="order-audit-image-upload-input"
                                  onChange={(event) => {
                                    handleIdpImageUpload(editableImageField, event.target.files?.[0] || null);
                                    event.target.value = '';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <>
            <section className="card order-audit-card">
              <div className="card__header order-audit-card__header">
                <h2 className="order-audit-card__title">订单信息</h2>
              </div>
              <div className="card__body order-audit-card__body">
                <div className="order-audit-grid">
                  {orderInfoItems.map((item) => (
                    <div
                      key={item.label}
                      className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                    >
                      <span className={`order-audit-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                      <div className="order-audit-field__value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="card order-audit-card">
              <div className="card__header order-audit-card__header">
                <h2 className="order-audit-card__title">驾照信息</h2>
                {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
              </div>
              <div className="card__body order-audit-card__body">
                <div className="order-audit-grid">
                  {licenseInfoItems.map((item) => (
                    <div
                      key={item.label}
                      className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                    >
                      <span className={`order-audit-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                      <div className="order-audit-field__value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="card order-audit-card">
              <div className="card__header order-audit-card__header">
                <h2 className="order-audit-card__title">收货信息</h2>
                {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
              </div>
              <div className="card__body order-audit-card__body">
                <div className="order-audit-grid">
                  {deliveryInfoItems.map((item) => (
                    <div
                      key={item.label}
                      className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                    >
                      <span className={`order-audit-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                      <div className="order-audit-field__value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

              </>
            )}

            {order.rejectReason && (
              <section className="card order-audit-card order-audit-card--warning">
                <div className="card__header order-audit-card__header">
                  <h2 className="order-audit-card__title">历史驳回原因</h2>
                </div>
                <div className="card__body order-audit-card__body">
                  <p className="order-audit-warning-text">{order.rejectReason}</p>
                </div>
              </section>
            )}
              </>
            )}
          </div>

          {!isViewPreview && !isIdpOrder && (
            <aside className="card order-audit-image-card">
            <div className="card__header order-audit-card__header">
              <h2 className="order-audit-card__title">证件图片</h2>
            </div>
            <div className="order-audit-image-grid">
              {auditCertificateImages.map((item) => (
                <div
                  key={item.key}
                  className={`order-audit-image-slot ${item.src ? '' : 'order-audit-image-slot--empty'}`}
                >
                  <div className="order-audit-image-slot__meta">
                    <span className="order-audit-image-slot__label">{item.label}</span>
                  </div>
                  <div className="order-audit-image-frame">
                    {item.src ? (
                      <button
                        type="button"
                        className="order-audit-image-trigger"
                        onClick={() => setPreviewImage(item)}
                        aria-label={`查看${item.label}大图`}
                      >
                        <img className="order-audit-image" src={item.src} alt={`${item.label}预览`} />
                      </button>
                    ) : (
                      <div className="order-audit-image-placeholder" aria-hidden="true">
                        <strong>暂无图片</strong>
                        <span>等待上传</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </aside>
          )}
        </div>
      </div>
      )}

      {isAuditable && (
        <div className="order-audit-footer">
          <div className="order-audit-footer__inner">
            <div className="order-audit-footer__meta">
              <span>订单号：{order.orderId}</span>
              <span>实付金额：{currencyFormatter.format(order.lockedPrice || 0)}</span>
              <span>办理类型：{getProcessTypeLabel(order.processType)}</span>
            </div>
            <div className="order-audit-footer__actions">
              <button type="button" className="btn btn--primary" onClick={handleApprove} disabled={isEditing}>
                通过
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setShowRejectModal(true)} disabled={isEditing}>
                拒绝
              </button>
              <button type="button" className="btn btn--warning" onClick={isEditing ? handleSaveEdit : handleModify}>
                {isEditing ? '保存' : '修改'}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={isEditing ? handleCancelEdit : () => navigate(sourceListPath)}
              >
                {isEditing ? '取消' : '返回列表'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">驳回订单</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowRejectModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal__body">
              <p className="order-audit-modal__hint">请填写驳回原因，提交后订单会从待审核列表移除。</p>
              <div className="form-group">
                <label className="form-label form-label--required">驳回原因</label>
                <textarea
                  className="form-textarea"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="例如：驾照信息不完整、照片不清晰、收货信息有误。"
                  rows={5}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowRejectModal(false)}>
                取消
              </button>
              <button type="button" className="btn btn--danger" disabled={!rejectReason.trim()} onClick={handleReject}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="order-audit-image-modal" onClick={(event) => event.stopPropagation()}>
            <div className="order-audit-image-modal__header">
              <h3 className="order-audit-image-modal__title">{`${auditImageTitle} - ${previewImage.label}`}</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreviewImage(null)}>
                关闭
              </button>
            </div>
            <div className="order-audit-image-modal__body">
              <img
                className="order-audit-image-modal__image"
                src={previewImage.src || ''}
                alt={`${previewImage.label}大图预览`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
