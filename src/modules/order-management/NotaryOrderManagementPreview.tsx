import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getOrderById, updateOrder } from '../../services/mockDataService';
import { pushNotaryOrderToOffice } from '../../services/notaryOfficeOrderService';
import { useTranslation } from '../../shared/i18n/config';
import { getCurrentAuthAccountId } from '../../shared/utils/auth';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import {
  buildNotaryPowerOfAttorneyFileName,
  buildNotaryTemplatePdfFileName,
  downloadNotaryAsset,
  exportNotaryImagesToPdf,
} from '../../shared/utils/notaryPreviewExport';
import {
  buildNotaryPowerOfAttorneyExportOptions,
  type NotaryPowerOfAttorneyExportOption,
  type NotaryPowerOfAttorneyKey,
} from '../../shared/config/notaryPowerOfAttorney';
import { getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import { orderPreviewAssets } from '../../shared/config/orderPreviewAssets';
import type { Order, OrderLog, OrderStatus } from '../../shared/types';
import './OrderDetail.css';

type CertificateImage = {
  key: string;
  label: string;
  src: string | null;
};

type OrderEditForm = {
  licenseNo: string;
  licenseName: string;
  gender: string;
  nationality: string;
  birthDate: string;
  licenseCategory: string;
  licenseAddress: string;
  firstIssueDate: string;
  validFromDate: string;
  validUntilDate: string;
  validYears: string;
  issuingAuthority: string;
  issuingRegion: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
};

type LogisticsForm = {
  logisticsCompany: string;
  trackingNumber: string;
};

type AuditFieldItem = {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  fieldClassName?: string;
  labelClassName?: string;
};

const PREVIEW_BASE = '/Preview%20file/yulan';
const buildPreviewAssetPath = (fileName: string) => `${PREVIEW_BASE}/${encodeURIComponent(fileName)}`;
const POWER_OF_ATTORNEY_PATH = buildPreviewAssetPath('Power of Attorney.docx');
const POWER_OF_ATTORNEY_EXPORT_OPTIONS = buildNotaryPowerOfAttorneyExportOptions(POWER_OF_ATTORNEY_PATH);
const ORDER_MANAGEMENT_PENDING_REVIEW_PATH = '/order-management/notary-orders?status=pending_review';
const LOGISTICS_COMPANY_OPTIONS = ['顺丰速运', '京东物流', '邮政EMS', '圆通速递', '中通快递', '申通快递'];

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

const ADDITIONAL_CERTIFICATE_IMAGES: CertificateImage[] = [
  {
    key: 'identity-front',
    label: '身份证正面',
    src: orderPreviewAssets.identityFront,
  },
  {
    key: 'identity-back',
    label: '身份证反面',
    src: orderPreviewAssets.identityBack,
  },
  {
    key: 'digital-license',
    label: '电子驾照',
    src: orderPreviewAssets.digitalLicense,
  },
  {
    key: 'signature',
    label: '签名',
    src: orderPreviewAssets.signature,
  },
];

const PREVIEW_IMAGES = [...CERTIFICATE_IMAGES, ...ADDITIONAL_CERTIFICATE_IMAGES];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  translating: '翻译中',
  pending_review: '待审核',
  pending_production: '待制作',
  in_production: '制作中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒绝',
};

const NAME_PINYIN_MAP: Record<string, string> = {
  张: 'ZHANG',
  伟: 'WEI',
  王: 'WANG',
  芳: 'FANG',
  李: 'LI',
  明: 'MING',
  赵: 'ZHAO',
  丽: 'LI',
  孙: 'SUN',
  强: 'QIANG',
  周: 'ZHOU',
  杰: 'JIE',
  吴: 'WU',
  秀: 'XIU',
  英: 'YING',
  郑: 'ZHENG',
  敏: 'MIN',
  陈: 'CHEN',
  浩: 'HAO',
  钱: 'QIAN',
  亮: 'LIANG',
  刘: 'LIU',
  洋: 'YANG',
  黄: 'HUANG',
  磊: 'LEI',
  何: 'HE',
  欣: 'XIN',
  马: 'MA',
  朱: 'ZHU',
  俊: 'JUN',
  林: 'LIN',
  静: 'JING',
  徐: 'XU',
  峰: 'FENG',
  高: 'GAO',
  蕾: 'LEI',
  谢: 'XIE',
  宇: 'YU',
  韩: 'HAN',
  雪: 'XUE',
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getCurrentTimestamp = () => formatBeijingTimestamp();

const padNumber = (value: number) => String(value).padStart(2, '0');

const getOrderSeed = (orderId: string) => Number(orderId.replace(/\D/g, '').slice(-6) || '0');

const createDateFromSeed = (seed: number, baseYear: number, yearSpan: number) => {
  const year = baseYear + (seed % yearSpan);
  const month = (seed % 12) + 1;
  const day = (Math.floor(seed / 7) % 28) + 1;
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

const getNotaryReviewStatusClass = (status: OrderStatus) => `notary-review-status notary-review-status--${status}`;

const getLatestAuditLog = (logs: OrderLog[]) =>
  [...logs].reverse().find((log) => /审核通过|审核拒绝|审核驳回/.test(log.action));

const getAuditTime = (order: Order, latestAuditLog: OrderLog | null | undefined) => {
  const auditTime = latestAuditLog?.time?.trim();
  if (auditTime) {
    return auditTime;
  }

  if (order.status !== 'pending_review') {
    return getDisplayValue(order.updatedAt);
  }

  return '--';
};

const getAuditOperatorId = (order: Order, latestAuditLog: OrderLog | null | undefined, currentAccountId: string) => {
  if (!latestAuditLog && order.status === 'pending_review') {
    return '--';
  }

  return currentAccountId || '--';
};

const getNamePinyinParts = (name: string) => {
  const normalizedName = name.trim();
  if (!normalizedName || !/^[\u4e00-\u9fff]+$/u.test(normalizedName)) {
    return {
      surnamePinyin: '--',
      givenNamePinyin: '--',
    };
  }

  const surname = normalizedName.slice(0, 1);
  const givenName = normalizedName.slice(1);

  const toPinyin = (value: string) => {
    const tokens = Array.from(value).map((char) => NAME_PINYIN_MAP[char]).filter(Boolean);
    return tokens.length === Array.from(value).length ? tokens.join('') : '--';
  };

  return {
    surnamePinyin: toPinyin(surname),
    givenNamePinyin: givenName ? toPinyin(givenName) : '--',
  };
};

const extractIssuingRegion = (address: string) => {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return '--';
  }

  const provinceMatch = normalizedAddress.match(/^(.{2,8}?(?:省|市|自治区|特别行政区))/);
  const province = provinceMatch?.[1] || '';
  const cityMatch = normalizedAddress.replace(province, '').match(/^(.{1,8}?(?:市|州|区|县))/);
  const city = cityMatch?.[1] || '';

  return [province, city].filter(Boolean).join(' ') || normalizedAddress.slice(0, 12);
};

const buildArchiveNumber = (licenseNo: string, orderId: string) => {
  const licenseDigits = licenseNo.replace(/\D/g, '');
  const orderDigits = orderId.replace(/\D/g, '');
  const prefix = (licenseDigits.slice(0, 6) || '350402').padEnd(6, '0');
  const suffix = (orderDigits.slice(-6) || '623863').padStart(6, '0');
  return `${prefix}${suffix}`;
};

const buildBarcodeNumber = (licenseNo: string, orderId: string) => {
  const licenseDigits = licenseNo.replace(/\D/g, '');
  const orderDigits = orderId.replace(/\D/g, '');
  const prefix = (licenseDigits.slice(0, 4) || '3590').padEnd(4, '0');
  const suffix = (orderDigits.slice(-9) || '020964663').padStart(9, '0');
  return `${prefix}${suffix}`;
};

const buildLicenseAuditProfile = (order: Order) => {
  const seed = getOrderSeed(order.orderId);
  const licenseNameSource = resolvePersistedValue(order.licenseName, order.customerName);
  const licenseNoSource = resolvePersistedValue(order.licenseNo, order.customerPassport);
  const licenseCategorySource = resolvePersistedValue(order.licenseCategory, 'C1');
  const birthDateSource = resolvePersistedValue(order.licenseBirthDate, createDateFromSeed(seed + 73, 1984, 12));
  const licenseAddressSource = resolvePersistedValue(order.licenseAddress, order.deliveryAddress || '');
  const firstIssueDateSource = resolvePersistedValue(order.licenseFirstIssueDate, createDateFromSeed(seed + 17, 2010, 8));
  const validFromDateSource = resolvePersistedValue(order.licenseValidFromDate, createDateFromSeed(seed + 41, 2021, 4));
  const validUntilDateSource = resolvePersistedValue(order.licenseValidUntilDate, addYearsToDate(validFromDateSource, 10));
  const validYearsSource = resolvePersistedValue(order.licenseValidYears, '10年');
  const issuingAuthoritySource = resolvePersistedValue(order.licenseIssuingAuthority, '公安交通管理局');
  const issuingRegionSource = resolvePersistedValue(order.licenseIssuingRegion, extractIssuingRegion(licenseAddressSource));
  const genderSource = resolvePersistedValue(order.licenseGender, seed % 4 === 0 ? '女' : '男');
  const nationalitySource = resolvePersistedValue(order.licenseNationality, '中国/CHN');
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

  return {
    licenseNo: toEditableValue(order.licenseNo, auditProfile.licenseNo),
    licenseName: toEditableValue(order.licenseName, auditProfile.licenseName),
    gender: toEditableValue(order.licenseGender, auditProfile.gender),
    nationality: toEditableValue(order.licenseNationality, auditProfile.nationality),
    birthDate: toEditableValue(order.licenseBirthDate, auditProfile.birthDate),
    licenseCategory: toEditableValue(order.licenseCategory, auditProfile.vehicleCategory),
    licenseAddress: toEditableValue(order.licenseAddress, auditProfile.licenseAddress),
    firstIssueDate: toEditableValue(order.licenseFirstIssueDate, auditProfile.firstIssueDate),
    validFromDate: toEditableValue(order.licenseValidFromDate, auditProfile.validFromDate),
    validUntilDate: toEditableValue(order.licenseValidUntilDate, auditProfile.validUntilDate),
    validYears: toEditableValue(order.licenseValidYears, auditProfile.validYears),
    issuingAuthority: toEditableValue(order.licenseIssuingAuthority, auditProfile.issuingAuthority),
    issuingRegion: toEditableValue(order.licenseIssuingRegion, auditProfile.issuingRegion),
    customerName: toEditableValue(order.customerName),
    customerPhone: toEditableValue(order.customerPhone),
    deliveryAddress: toEditableValue(order.deliveryAddress),
  };
};

const buildLogisticsForm = (order: Order): LogisticsForm => ({
  logisticsCompany: order.logisticsCompany?.trim() || '',
  trackingNumber: order.trackingNumber.trim(),
});

const NotaryOrderManagementPreview: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const previewMode = new URLSearchParams(location.search).get('mode') === 'audit' ? 'audit' : 'view';
  const fetchedOrder = useMemo<Order | null>(() => getOrderById(id || '') ?? null, [id]);
  const backPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from || ORDER_MANAGEMENT_PENDING_REVIEW_PATH)
      : '/order-management/notary-orders';

  const [order, setOrder] = useState<Order | null>(fetchedOrder);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedNotaryOffice, setSelectedNotaryOffice] = useState('');
  const [previewImage, setPreviewImage] = useState<CertificateImage | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [exportingPowerOfAttorneyKey, setExportingPowerOfAttorneyKey] = useState<NotaryPowerOfAttorneyKey | null>(null);
  const [isExportingImagesPdf, setIsExportingImagesPdf] = useState(false);
  const [editForm, setEditForm] = useState<OrderEditForm | null>(fetchedOrder ? buildOrderEditForm(fetchedOrder) : null);
  const [logisticsForm, setLogisticsForm] = useState<LogisticsForm>(
    fetchedOrder ? buildLogisticsForm(fetchedOrder) : { logisticsCompany: '', trackingNumber: '' },
  );

  useEffect(() => {
    setOrder(fetchedOrder);
    setIsEditing(false);
    setEditForm(fetchedOrder ? buildOrderEditForm(fetchedOrder) : null);
    setLogisticsForm(fetchedOrder ? buildLogisticsForm(fetchedOrder) : { logisticsCompany: '', trackingNumber: '' });
    setShowRejectModal(false);
    setShowApproveModal(false);
    setSelectedNotaryOffice('');
    setPreviewImage(null);
    setRejectReason('');
    setExportingPowerOfAttorneyKey(null);
    setIsExportingImagesPdf(false);
  }, [fetchedOrder]);

  const latestAuditLog = useMemo(() => (order ? getLatestAuditLog(order.logs) : null), [order]);
  const auditProfile = useMemo(() => (order ? buildLicenseAuditProfile(order) : null), [order]);
  const pinyinPreview = useMemo(() => getNamePinyinParts(editForm?.licenseName || ''), [editForm?.licenseName]);
  const currentAccountId = useMemo(() => getCurrentAuthAccountId(), []);
  const isAuditable = order?.status === 'pending_review' && previewMode === 'audit';
  const isReadOnlyPreview = !isAuditable;
  const pageTitle = previewMode === 'audit' ? (isAuditable ? '订单审核' : '查看审核') : '查看订单';
  const isViewMode = previewMode === 'view';
  const isPendingReviewOrder = order?.status === 'pending_review';
  const canSubmitLogistics = order?.status === 'pending_production';
  const shouldRenderLogisticsSection =
    isPendingReviewOrder ||
    canSubmitLogistics ||
    order?.status === 'shipped' ||
    order?.status === 'completed';
  const logisticsSubmitDisabled =
    !canSubmitLogistics || !logisticsForm.logisticsCompany.trim() || !logisticsForm.trackingNumber.trim();
  const exportPdfFileName = useMemo(
    () => buildNotaryTemplatePdfFileName(order?.licenseName || order?.customerName || order?.orderId || ''),
    [order?.customerName, order?.licenseName, order?.orderId],
  );
  const powerOfAttorneyExportBaseName = useMemo(
    () => order?.licenseName || order?.customerName || order?.orderId || '',
    [order?.customerName, order?.licenseName, order?.orderId],
  );

  if (!order || !auditProfile || !editForm) {
    return (
      <div className="app-main animate-fadeIn">
        <div className="card order-audit-empty-card">
          <div className="empty-state">
            <div className="empty-state__icon">404</div>
            <div className="empty-state__text">未找到对应订单，请返回列表重新选择。</div>
            <button type="button" className="btn btn--primary" onClick={() => navigate(backPath)}>
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

  const handleLogisticsFieldChange = (field: keyof LogisticsForm, value: string) => {
    setLogisticsForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleReturn = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(backPath);
  };

  const handleExportPowerOfAttorney = async (option: NotaryPowerOfAttorneyExportOption) => {
    setExportingPowerOfAttorneyKey(option.key);

    try {
      await downloadNotaryAsset(
        option.path,
        buildNotaryPowerOfAttorneyFileName(powerOfAttorneyExportBaseName, option.exportLabel),
      );
      showToast('success', `${option.exportLabel}委托书已开始导出`);
    } catch (error) {
      console.error(error);
      showToast('error', `导出${option.exportLabel}委托书失败，请稍后重试`);
    } finally {
      setExportingPowerOfAttorneyKey(null);
    }
  };

  const handleExportImagesPdf = async () => {
    setIsExportingImagesPdf(true);

    try {
      await exportNotaryImagesToPdf(
        PREVIEW_IMAGES.filter((image): image is CertificateImage & { src: string } => Boolean(image.src)).map((image) => ({
          label: image.label,
          src: image.src,
        })),
        exportPdfFileName,
      );
      showToast('success', '证件图片 PDF 已开始导出');
    } catch (error) {
      console.error(error);
      showToast('error', '导出图片 PDF 失败，请稍后重试');
    } finally {
      setIsExportingImagesPdf(false);
    }
  };

  const DEFAULT_NOTARY_OFFICE_ID = 'beibu_gulf';
  const NOTARY_OFFICES = [
    { id: DEFAULT_NOTARY_OFFICE_ID, name: '北部湾公证处', district: '默认推送公证处' },
    { id: 'zhangjiang', name: '张江公证处', district: '可选推送公证处' },
  ];

  const handleApprove = () => {
    setSelectedNotaryOffice(DEFAULT_NOTARY_OFFICE_ID);
    setShowApproveModal(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedNotaryOffice) return;

    const currentTimestamp = getCurrentTimestamp();
    const officeName = NOTARY_OFFICES.find((o) => o.id === selectedNotaryOffice)?.name || selectedNotaryOffice;

    updateOrder(order.orderId, {
      status: 'pending_production',
      pushedNotaryOfficeId: selectedNotaryOffice,
      pushedNotaryOfficeName: officeName,
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: currentAccountId,
          action: `审核通过，推送至${officeName}`,
        },
      ],
    });
    pushNotaryOrderToOffice(
      {
        ...order,
        status: 'pending_production',
        pushedNotaryOfficeId: selectedNotaryOffice,
        pushedNotaryOfficeName: officeName,
        updatedAt: currentTimestamp,
        logs: [
          ...order.logs,
          {
            time: currentTimestamp,
            operator: currentAccountId,
            action: `瀹℃牳閫氳繃锛屾帹閫佽嚦${officeName}`,
          },
        ],
      },
      {
        operator: currentAccountId,
        pushedAt: currentTimestamp,
      },
    );

    setShowApproveModal(false);
    showToast('success', `审核通过，已推送至${officeName}`);
    window.setTimeout(() => navigate(ORDER_MANAGEMENT_PENDING_REVIEW_PATH), 1200);
  };

  const handleReject = () => {
    const nextRejectReason = rejectReason.trim();
    if (!nextRejectReason) {
      return;
    }

    updateOrder(order.orderId, {
      status: 'rejected',
      rejectReason: nextRejectReason,
      remark: nextRejectReason,
      updatedAt: getCurrentTimestamp(),
      logs: [
        ...order.logs,
        {
          time: getCurrentTimestamp(),
          operator: currentAccountId,
          action: `审核拒绝：${nextRejectReason}`,
        },
      ],
    });

    setShowRejectModal(false);
    setRejectReason('');
    showToast('error', '订单已拒绝');
    window.setTimeout(() => navigate(ORDER_MANAGEMENT_PENDING_REVIEW_PATH), 1200);
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
    const requiredFields: Array<{ key: keyof OrderEditForm; label: string }> = [
      { key: 'licenseNo', label: '驾照号' },
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
          operator: currentAccountId,
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

  const handleSubmitLogistics = () => {
    if (!canSubmitLogistics) {
      showToast('error', '当前订单状态不可提交物流信息');
      return;
    }

    const logisticsCompany = logisticsForm.logisticsCompany.trim();
    const trackingNumber = logisticsForm.trackingNumber.trim();

    if (!logisticsCompany || !trackingNumber) {
      showToast('error', '请完整填写物流公司和物流单号');
      return;
    }

    const currentTimestamp = getCurrentTimestamp();
    const nextUpdates: Partial<Order> = {
      status: 'shipped',
      shippedAt: currentTimestamp,
      logisticsCompany,
      trackingNumber,
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: currentAccountId,
          action: `填写物流信息并发货：${logisticsCompany} ${trackingNumber}`,
        },
      ],
    };

    updateOrder(order.orderId, nextUpdates);

    const nextOrder = {
      ...order,
      ...nextUpdates,
    } as Order;

    setOrder(nextOrder);
    setLogisticsForm(buildLogisticsForm(nextOrder));
    showToast('success', '物流信息已提交，订单已更新为已发货');
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

  const orderInfoItems: AuditFieldItem[] = [
    {
      label: '订单状态',
      value: <span className={getNotaryReviewStatusClass(order.status)}>{ORDER_STATUS_LABELS[order.status]}</span>,
    },
    {
      label: '下单时间',
      value: getDisplayValue(order.createdAt),
    },
    {
      label: '审核时间',
      value: getAuditTime(order, latestAuditLog),
    },
    {
      label: '审核人ID',
      value: getAuditOperatorId(order, latestAuditLog, currentAccountId),
    },
    {
      label: '订单号',
      value: order.orderId,
    },
    {
      label: '驾照官推送订单号',
      value: '--',
      fieldClassName: 'notary-review-field--wide-label',
      labelClassName: 'notary-review-field__label--nowrap',
    },
  ];

  const licenseInfoItems: AuditFieldItem[] = [
    {
      label: '驾证号码',
      value: isEditing ? renderEditor('licenseNo', { placeholder: '请输入驾照号' }) : auditProfile.licenseNo,
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
      label: '档案编号',
      value: buildArchiveNumber(auditProfile.licenseNo, order.orderId),
    },
    {
      label: '条形码',
      value: buildBarcodeNumber(auditProfile.licenseNo, order.orderId),
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
      label: '发证机构',
      value: isEditing ? renderEditor('issuingAuthority', { placeholder: '请输入发证机关' }) : auditProfile.issuingAuthority,
    },
    {
      label: '发证地区',
      value: isEditing ? renderEditor('issuingRegion', { placeholder: '请输入发证地区' }) : auditProfile.issuingRegion,
    },
  ];

  const deliveryInfoItems = [
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

  const productInfoItems = [
    {
      label: '订单编号',
      value: order.orderId,
    },
    {
      label: '商品名称',
      value: getDisplayValue(order.productName),
    },
    {
      label: '办理类型',
      value: getProductProcessTypeLabel(order.processType, t),
    },
    {
      label: '总价',
      value: currencyFormatter.format(order.lockedPrice || 0),
    },
  ];

  const logisticsInfoItems: Array<{ label: string; value: React.ReactNode; fullWidth?: boolean }> = canSubmitLogistics
    ? [
        {
          label: '物流公司',
          value: (
            <select
              className="form-select order-audit-field__editor"
              value={logisticsForm.logisticsCompany}
              onChange={(event) => handleLogisticsFieldChange('logisticsCompany', event.target.value)}
              disabled={!canSubmitLogistics}
            >
              <option value="">请选择物流公司</option>
              {LOGISTICS_COMPANY_OPTIONS.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          ),
        },
        {
          label: '物流单号',
          value: (
            <input
              type="text"
              className="form-input order-audit-field__editor"
              value={logisticsForm.trackingNumber}
              onChange={(event) => handleLogisticsFieldChange('trackingNumber', event.target.value)}
              placeholder="请输入物流单号"
              disabled={!canSubmitLogistics}
            />
          ),
        },
        {
          label: '提交物流信息',
          value: (
            <button
              type="button"
              className="btn btn--primary order-audit-logistics__button"
              disabled={logisticsSubmitDisabled}
              onClick={handleSubmitLogistics}
            >
              提交物流信息
            </button>
          ),
          fullWidth: true,
        },
      ]
    : shouldRenderLogisticsSection
      ? [
        {
          label: '物流公司',
          value: getDisplayValue(order.logisticsCompany),
        },
        {
          label: '物流单号',
          value: getDisplayValue(order.trackingNumber),
        },
      ]
      : [];

  return (
    <div className="animate-fadeIn notary-order-management-preview">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <div className="app-topbar">
        <div className="order-audit-topbar">
          <div className="order-audit-topbar__heading">
            <div className="app-topbar__breadcrumb">
              <button type="button" className="order-audit-topbar__back" onClick={() => navigate(backPath)}>
                公证订单管理
              </button>
              <span>/</span>
              <span>{pageTitle}</span>
              <span>/</span>
              <span>{order.orderId}</span>
            </div>
            <div className="order-audit-topbar__actions">
              {POWER_OF_ATTORNEY_EXPORT_OPTIONS.map((option) => {
                const isExportingCurrentOption = exportingPowerOfAttorneyKey === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`btn order-audit-topbar__action-btn ${option.buttonClassName}`}
                    onClick={() => void handleExportPowerOfAttorney(option)}
                    disabled={Boolean(exportingPowerOfAttorneyKey)}
                  >
                    {isExportingCurrentOption ? '导出中...' : option.buttonLabel}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn order-audit-topbar__action-btn order-audit-topbar__action-btn--images"
                onClick={() => void handleExportImagesPdf()}
                disabled={isExportingImagesPdf}
              >
                {isExportingImagesPdf ? '导出中...' : '导出扫描件PDF'}
              </button>
              {isReadOnlyPreview && (
                <button
                  type="button"
                  className="btn order-audit-topbar__action-btn order-audit-topbar__action-btn--return order-audit-topbar__return-btn"
                  onClick={handleReturn}
                >
                  返回
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="app-main order-audit-page">
        <div className="order-audit-layout order-audit-layout--single-column">
          <div className="order-audit-main">
            {isViewMode ? (
              <>
                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">收货信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {deliveryInfoItems.map((item) => (
                        <div key={item.label} className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}>
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">商品信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {productInfoItems.map((item) => (
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
                    <h2 className="order-audit-card__title">物流信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {logisticsInfoItems.map((item) => (
                        <div key={item.label} className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}>
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
                <section className="card order-audit-card notary-review-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">订单信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="notary-review-grid">
                      {orderInfoItems.map((item) => (
                        <div
                          key={item.label}
                          className={`notary-review-field ${item.fullWidth ? 'notary-review-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                        >
                          <span className={`notary-review-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                          <div className="notary-review-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card notary-review-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">驾照信息</h2>
                    {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="notary-review-grid notary-review-grid--license">
                      {licenseInfoItems.map((item) => (
                        <div
                          key={item.label}
                          className={`notary-review-field ${item.fullWidth ? 'notary-review-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                        >
                          <span className={`notary-review-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                          <div className="notary-review-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-image-card order-audit-image-card--inline">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">证件信息</h2>
                  </div>
                  <div className="order-audit-image-grid">
                    {PREVIEW_IMAGES.map((item) => (
                      <div key={item.key} className={`order-audit-image-slot ${item.src ? '' : 'order-audit-image-slot--empty'}`}>
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
                </section>

                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">收货信息</h2>
                    {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {deliveryInfoItems.map((item) => (
                        <div key={item.label} className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}>
                          <span className="order-audit-field__label">{item.label}:</span>
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
          </div>

        </div>
      </div>

      {isAuditable && (
        <div className="order-audit-footer">
          <div className="order-audit-footer__inner">
            <div className="order-audit-footer__meta">
              <span>订单号：{order.orderId}</span>
              <span>实付金额：{currencyFormatter.format(order.lockedPrice || 0)}</span>
              <span>办理类型：{getProductProcessTypeLabel(order.processType, t)}</span>
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
              <button type="button" className="btn btn--secondary" onClick={isEditing ? handleCancelEdit : () => navigate(backPath)}>
                {isEditing ? '取消' : '返回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal approve-notary-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">选择推送公证处</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowApproveModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal__body">
              <p className="order-audit-modal__hint">订单审核通过后，将推送至所选公证处进行后续制作处理。</p>
              <div className="approve-notary-list">
                {NOTARY_OFFICES.map((office) => (
                  <label
                    key={office.id}
                    className={`approve-notary-item ${selectedNotaryOffice === office.id ? 'approve-notary-item--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="notary-office"
                      value={office.id}
                      checked={selectedNotaryOffice === office.id}
                      onChange={() => setSelectedNotaryOffice(office.id)}
                      className="approve-notary-item__radio"
                    />
                    <div className="approve-notary-item__info">
                      <span className="approve-notary-item__name">{office.name}</span>
                      <span className="approve-notary-item__district">{office.district}</span>
                    </div>
                    {selectedNotaryOffice === office.id && (
                      <span className="approve-notary-item__check">✓</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowApproveModal(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!selectedNotaryOffice}
                onClick={handleConfirmApprove}
              >
                确认通过并推送
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">拒绝订单</h3>
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
                  placeholder="例如：驾照信息不完整、图片不清晰、收货信息有误。"
                  rows={5}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowRejectModal(false)}>
                取消
              </button>
              <button type="button" className="btn btn--danger" disabled={!rejectReason.trim()} onClick={handleReject}>
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="order-audit-image-modal" onClick={(event) => event.stopPropagation()}>
            <div className="order-audit-image-modal__header">
              <h3 className="order-audit-image-modal__title">{previewImage.label}</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreviewImage(null)}>
                关闭
              </button>
            </div>
            <div className="order-audit-image-modal__body">
              <img className="order-audit-image-modal__image" src={previewImage.src || ''} alt={`${previewImage.label}大图预览`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaryOrderManagementPreview;
