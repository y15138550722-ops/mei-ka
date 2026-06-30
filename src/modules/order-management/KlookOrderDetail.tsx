import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { useTranslation } from '../../shared/i18n/config';
import { getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import { orderPreviewAssets } from '../../shared/config/orderPreviewAssets';
import {
  getKlookOrderById,
  updateKlookOrder,
  type KlookOrder,
  type KlookOrderLog,
  type KlookOrderStatus,
} from './klookOrderService';
import './OrderDetail.css';

type CertificateImage = {
  key: string;
  label: string;
  src: string | null;
};

type KlookOrderEditForm = {
  driverName: string;
  driverSurnameLatin: string;
  driverGivenNameLatin: string;
  licenseNumber: string;
  licenseType: string;
  licenseGender: string;
  licenseNationality: string;
  licenseBirthDate: string;
  licenseAddress: string;
  licenseFirstIssueDate: string;
  licenseValidFromDate: string;
  licenseValidUntilDate: string;
  licenseValidYears: string;
  licenseIssuingAuthority: string;
  licenseIssuingRegion: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
};

type KlookOrderSourceState = {
  from?: string;
  listLabel?: string;
};

interface KlookOrderDetailProps {
  listPath?: string;
  listLabel?: string;
  getOrderById?: (id: string) => KlookOrder | undefined;
  updateOrder?: (id: string, updates: Partial<KlookOrder>) => void;
  enableFullLicenseEdit?: boolean;
  generateManagementOrderIdOnApprove?: boolean;
}

type DetailFieldItem = {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  fieldClassName?: string;
  labelClassName?: string;
};

type KlookLicenseSnapshot = {
  surnameLatin: string;
  givenNameLatin: string;
  gender: string;
  nationality: string;
  birthDate: string;
  licenseAddress: string;
  firstIssueDate: string;
  validFromDate: string;
  validUntilDate: string;
  validYears: string;
  issuingAuthority: string;
  issuingRegion: string;
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

const KLOOK_STATUS_LABELS: Record<KlookOrderStatus, string> = {
  pending_review: '待审核',
  pending_production: '待制作',
  shipped: '已发货',
  cancelled: '已取消',
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getCurrentTimestamp = () => formatBeijingTimestamp();

const getDisplayValue = (value?: string | null) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : '--';
};

const getStatusTagClass = (status: KlookOrderStatus) => {
  const map: Record<KlookOrderStatus, string> = {
    pending_review: 'pending',
    pending_production: 'processing',
    shipped: 'shipped',
    cancelled: 'cancelled',
  };

  return `tag tag--${map[status] || 'pending'}`;
};

const getLatestAuditLog = (logs: KlookOrderLog[]) =>
  [...logs].reverse().find((log) => /审核通过|审核拒绝|审核驳回/.test(log.action));

const CHINESE_COMPOUND_SURNAMES = [
  '欧阳',
  '太史',
  '端木',
  '上官',
  '司马',
  '东方',
  '独孤',
  '南宫',
  '闻人',
  '夏侯',
  '诸葛',
  '尉迟',
  '公羊',
  '赫连',
  '澹台',
  '皇甫',
  '宗政',
  '慕容',
  '长孙',
] as const;

const NAME_PINYIN_MAP: Record<string, string> = {
  沈: 'SHEN',
  英: 'YING',
  杰: 'JIE',
  罗: 'LUO',
  耽: 'DAN',
  长: 'CHANG',
  谷: 'GU',
  川: 'CHUAN',
  冰: 'BING',
  赵: 'ZHAO',
  安: 'AN',
  周: 'ZHOU',
  启: 'QI',
  林: 'LIN',
  淇: 'QI',
  许: 'XU',
  然: 'RAN',
  白: 'BAI',
  露: 'LU',
  韩: 'HAN',
  澈: 'CHE',
  唐: 'TANG',
  沫: 'MO',
  郑: 'ZHENG',
  梁: 'LIANG',
  秋: 'QIU',
  宋: 'SONG',
  时: 'SHI',
  顾: 'GU',
  衡: 'HENG',
  叶: 'YE',
  清: 'QING',
  何: 'HE',
  知: 'ZHI',
  远: 'YUAN',
  张: 'ZHANG',
  王: 'WANG',
  李: 'LI',
  刘: 'LIU',
  陈: 'CHEN',
  吴: 'WU',
  黄: 'HUANG',
  徐: 'XU',
  马: 'MA',
  胡: 'HU',
  郭: 'GUO',
  高: 'GAO',
  苏: 'SU',
  杨: 'YANG',
  朱: 'ZHU',
};

const getOrderSeed = (orderId: string) => Number(orderId.replace(/\D/g, '').slice(-6) || '0');

const padNumber = (value: number) => String(value).padStart(2, '0');

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

const formatCompactTimestamp = (timestamp: string) => timestamp.replace(/\D/g, '').slice(0, 14);

const resolveEditableValue = (primary: string | undefined, fallback: string) => {
  const normalizedPrimary = primary?.trim();
  if (normalizedPrimary) {
    return normalizedPrimary;
  }

  return fallback === '--' ? '' : fallback;
};

const splitChineseName = (name: string) => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return {
      surname: '',
      givenName: '',
    };
  }

  const matchedCompoundSurname = CHINESE_COMPOUND_SURNAMES.find((surname) => normalizedName.startsWith(surname));
  const surname = matchedCompoundSurname || normalizedName.slice(0, 1);

  return {
    surname,
    givenName: normalizedName.slice(surname.length),
  };
};

const toPinyin = (value: string) => {
  const tokens = Array.from(value)
    .map((char) => NAME_PINYIN_MAP[char])
    .filter(Boolean);

  if (tokens.length !== Array.from(value).length) {
    return '';
  }

  return tokens.join(' ');
};

const splitDriverPinyin = (driverName: string, driverNameLatin: string) => {
  const normalizedLatin = driverNameLatin.trim().replace(/\s+/g, ' ').toUpperCase();
  if (normalizedLatin.includes(' ')) {
    const [surnameLatin = '', ...restParts] = normalizedLatin.split(' ');
    return {
      surnameLatin,
      givenNameLatin: restParts.join(' ').trim(),
    };
  }

  const { surname, givenName } = splitChineseName(driverName);
  const surnameLatinFromName = toPinyin(surname);
  const givenNameLatinFromName = toPinyin(givenName);

  const compactSurnameLatin = surnameLatinFromName.replace(/\s+/g, '');
  const compactGivenNameLatin = givenNameLatinFromName.replace(/\s+/g, '');
  if (compactSurnameLatin && normalizedLatin.startsWith(compactSurnameLatin)) {
    const remainingLatin = normalizedLatin.slice(compactSurnameLatin.length);
    return {
      surnameLatin: normalizedLatin.slice(0, compactSurnameLatin.length),
      givenNameLatin:
        compactGivenNameLatin && remainingLatin === compactGivenNameLatin ? remainingLatin : givenNameLatinFromName,
    };
  }

  return {
    surnameLatin: normalizedLatin,
    givenNameLatin: '',
  };
};

const joinDriverPinyin = (surnameLatin: string, givenNameLatin: string) =>
  [surnameLatin.trim().toUpperCase(), givenNameLatin.trim().toUpperCase()].filter(Boolean).join(' ');

const deriveBirthDate = (licenseNumber: string) => {
  const normalizedValue = licenseNumber.trim();
  const birthMatch = normalizedValue.match(/^(\d{6})(\d{4})(\d{2})(\d{2})(\d{3}[\dXx])$/);
  if (!birthMatch) {
    return '--';
  }

  const [, , year, month, day] = birthMatch;
  return `${year}-${month}-${day}`;
};

const deriveGender = (licenseNumber: string) => {
  const normalizedValue = licenseNumber.trim();
  const genderMatch = normalizedValue.match(/^\d{16}(\d)[\dXx]$/);
  if (!genderMatch) {
    return '--';
  }

  return Number(genderMatch[1]) % 2 === 0 ? '女' : '男';
};

const deriveNationality = (licenseNumber: string) => {
  const normalizedValue = licenseNumber.trim().toUpperCase();
  if (/^\d{17}[\dX]$/.test(normalizedValue)) {
    return '中国';
  }

  if (normalizedValue.startsWith('JPN')) {
    return '日本';
  }

  return '--';
};

const extractIssuingRegion = (address: string) => {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return '--';
  }

  const provinceMatch = normalizedAddress.match(/^(.{2,8}?(?:省|市|自治区|特别行政区))/);
  const province = provinceMatch?.[1] || '';
  const cityMatch = normalizedAddress.slice(province.length).match(/^(.{1,8}?(?:市|州|盟|区|县))/);
  const city = cityMatch?.[1] || '';

  return [province, city].filter(Boolean).join(' ') || normalizedAddress.slice(0, 12);
};

const buildAuditOperatorId = (order: KlookOrder, latestAuditLog?: KlookOrderLog | null) => {
  if (!latestAuditLog) {
    return '--';
  }

  return `RV${String(getOrderSeed(order.orderId)).padStart(6, '0')}`;
};

const buildKlookLicenseSnapshot = (order: KlookOrder, editForm: KlookOrderEditForm): KlookLicenseSnapshot => {
  const seed = getOrderSeed(order.orderId);
  const inferredValidFromDate = createDateFromSeed(seed + 41, 2021, 4);
  const licenseAddress =
    editForm.licenseAddress.trim() ||
    order.licenseAddress?.trim() ||
    editForm.deliveryAddress.trim() ||
    order.deliveryAddress ||
    '';
  const validFromDate = editForm.licenseValidFromDate.trim() || order.licenseValidFromDate || inferredValidFromDate;

  return {
    surnameLatin: getDisplayValue(editForm.driverSurnameLatin),
    givenNameLatin: getDisplayValue(editForm.driverGivenNameLatin),
    gender: getDisplayValue(editForm.licenseGender || order.licenseGender || deriveGender(editForm.licenseNumber)),
    nationality: getDisplayValue(editForm.licenseNationality || order.licenseNationality || deriveNationality(editForm.licenseNumber)),
    birthDate: getDisplayValue(editForm.licenseBirthDate || order.licenseBirthDate || deriveBirthDate(editForm.licenseNumber)),
    licenseAddress: getDisplayValue(licenseAddress),
    firstIssueDate: getDisplayValue(
      editForm.licenseFirstIssueDate || order.licenseFirstIssueDate || createDateFromSeed(seed + 17, 2010, 8),
    ),
    validFromDate,
    validUntilDate: getDisplayValue(editForm.licenseValidUntilDate || order.licenseValidUntilDate || addYearsToDate(validFromDate, 10)),
    validYears: getDisplayValue(editForm.licenseValidYears || order.licenseValidYears || '10年'),
    issuingAuthority: getDisplayValue(editForm.licenseIssuingAuthority || order.licenseIssuingAuthority || '公安交通管理局'),
    issuingRegion: getDisplayValue(editForm.licenseIssuingRegion || order.licenseIssuingRegion || extractIssuingRegion(licenseAddress)),
  };
};

const buildEditForm = (order: KlookOrder): KlookOrderEditForm => {
  const splitPinyin = splitDriverPinyin(order.driverName, order.driverNameLatin);
  const seed = getOrderSeed(order.orderId);
  const defaultLicenseAddress = order.licenseAddress?.trim() || order.deliveryAddress || '';
  const defaultValidFromDate = createDateFromSeed(seed + 41, 2021, 4);
  const defaultLicenseSnapshot = {
    gender: deriveGender(order.licenseNumber),
    nationality: deriveNationality(order.licenseNumber),
    birthDate: deriveBirthDate(order.licenseNumber),
    licenseAddress: defaultLicenseAddress,
    firstIssueDate: createDateFromSeed(seed + 17, 2010, 8),
    validFromDate: defaultValidFromDate,
    validUntilDate: addYearsToDate(defaultValidFromDate, 10),
    validYears: '10年',
    issuingAuthority: '公安交通管理局',
    issuingRegion: extractIssuingRegion(defaultLicenseAddress),
  };

  return {
    driverName: order.driverName,
    driverSurnameLatin: splitPinyin.surnameLatin,
    driverGivenNameLatin: splitPinyin.givenNameLatin,
    licenseNumber: order.licenseNumber,
    licenseType: order.licenseType,
    licenseGender: resolveEditableValue(order.licenseGender, defaultLicenseSnapshot.gender),
    licenseNationality: resolveEditableValue(order.licenseNationality, defaultLicenseSnapshot.nationality),
    licenseBirthDate: resolveEditableValue(order.licenseBirthDate, defaultLicenseSnapshot.birthDate),
    licenseAddress: resolveEditableValue(order.licenseAddress, defaultLicenseSnapshot.licenseAddress),
    licenseFirstIssueDate: resolveEditableValue(order.licenseFirstIssueDate, defaultLicenseSnapshot.firstIssueDate),
    licenseValidFromDate: resolveEditableValue(order.licenseValidFromDate, defaultLicenseSnapshot.validFromDate),
    licenseValidUntilDate: resolveEditableValue(order.licenseValidUntilDate, defaultLicenseSnapshot.validUntilDate),
    licenseValidYears: resolveEditableValue(order.licenseValidYears, defaultLicenseSnapshot.validYears),
    licenseIssuingAuthority: resolveEditableValue(order.licenseIssuingAuthority, defaultLicenseSnapshot.issuingAuthority),
    licenseIssuingRegion: resolveEditableValue(order.licenseIssuingRegion, defaultLicenseSnapshot.issuingRegion),
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    deliveryAddress: order.deliveryAddress,
  };
};

const KlookOrderDetail: React.FC<KlookOrderDetailProps> = ({
  listPath = '/order-management/api-orders/klook',
  listLabel = 'Klook订单管理',
  getOrderById = getKlookOrderById,
  updateOrder = updateKlookOrder,
  enableFullLicenseEdit = false,
  generateManagementOrderIdOnApprove = false,
}) => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as KlookOrderSourceState | null;
  const previewMode = new URLSearchParams(location.search).get('mode') === 'audit' ? 'audit' : 'view';
  const fetchedOrder = useMemo<KlookOrder | null>(() => getOrderById(id || '') ?? null, [id, getOrderById]);

  const [order, setOrder] = useState<KlookOrder | null>(fetchedOrder);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<CertificateImage | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<KlookOrderEditForm | null>(fetchedOrder ? buildEditForm(fetchedOrder) : null);

  useEffect(() => {
    setOrder(fetchedOrder);
    setIsEditing(false);
    setEditForm(fetchedOrder ? buildEditForm(fetchedOrder) : null);
    setShowRejectModal(false);
    setPreviewImage(null);
    setRejectReason('');
  }, [fetchedOrder]);

  const latestAuditLog = useMemo(() => (order ? getLatestAuditLog(order.logs) : null), [order]);
  const isAuditable = order?.status === 'pending_review' && previewMode === 'audit';
  const isReadOnlyPreview = !isAuditable;
  const isViewPreview = previewMode === 'view';
  const auditPageTitle = isAuditable ? '订单审核' : '查看审核';
  const sourceListPath = navigationState?.from || listPath;
  const sourceListLabel = navigationState?.listLabel || listLabel;

  if (!order || !editForm) {
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

  const handleEditFieldChange = (field: keyof KlookOrderEditForm, value: string) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, [field]: value } : currentForm));
  };

  const handleReturn = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(sourceListPath);
  };

  const handleApprove = () => {
    const currentTimestamp = getCurrentTimestamp();
    const managementOrderId =
      generateManagementOrderIdOnApprove && !order.managementOrderId
        ? formatCompactTimestamp(currentTimestamp)
        : order.managementOrderId;
    const nextUpdates: Partial<KlookOrder> = {
      status: 'pending_production',
      updatedAt: currentTimestamp,
      ...(generateManagementOrderIdOnApprove ? { managementOrderId } : {}),
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: '审核员',
          action: '审核通过',
        },
      ],
    };

    updateOrder(order.orderId, nextUpdates);
    showToast('success', '审核通过，订单已转入待制作');
    window.setTimeout(() => navigate(sourceListPath), 1200);
  };

  const handleReject = () => {
    const nextRejectReason = rejectReason.trim();
    if (!nextRejectReason) {
      return;
    }

    const currentTimestamp = getCurrentTimestamp();
    const nextUpdates: Partial<KlookOrder> = {
      status: 'cancelled',
      rejectReason: nextRejectReason,
      remark: nextRejectReason,
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: '审核员',
          action: `审核拒绝：${nextRejectReason}`,
        },
      ],
    };

    updateOrder(order.orderId, nextUpdates);
    setShowRejectModal(false);
    setRejectReason('');
    showToast('error', '订单已驳回');
    window.setTimeout(() => navigate(sourceListPath), 1200);
  };

  const handleModify = () => {
    setEditForm(buildEditForm(order));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm(buildEditForm(order));
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const requiredFields: Array<{ key: keyof KlookOrderEditForm; label: string }> = [
      { key: 'driverName', label: '姓名' },
      { key: 'driverSurnameLatin', label: '姓氏拼音' },
      { key: 'driverGivenNameLatin', label: '名字拼音' },
      { key: 'licenseNumber', label: '驾照号' },
      { key: 'licenseType', label: '准驾车型' },
      { key: 'recipientName', label: '收货人' },
      { key: 'recipientPhone', label: '联系电话' },
      { key: 'deliveryAddress', label: '收货地址' },
    ];

    const missingField = requiredFields.find(({ key }) => !editForm[key].trim());
    if (missingField) {
      showToast('error', `请填写${missingField.label}`);
      return;
    }

    const currentTimestamp = getCurrentTimestamp();
    const nextUpdates: Partial<KlookOrder> = {
      driverName: editForm.driverName.trim(),
      driverNameLatin: joinDriverPinyin(editForm.driverSurnameLatin, editForm.driverGivenNameLatin),
      licenseNumber: editForm.licenseNumber.trim(),
      licenseType: editForm.licenseType.trim(),
      ...(enableFullLicenseEdit
        ? {
            licenseGender: editForm.licenseGender.trim(),
            licenseNationality: editForm.licenseNationality.trim(),
            licenseBirthDate: editForm.licenseBirthDate.trim(),
            licenseAddress: editForm.licenseAddress.trim(),
            licenseFirstIssueDate: editForm.licenseFirstIssueDate.trim(),
            licenseValidFromDate: editForm.licenseValidFromDate.trim(),
            licenseValidUntilDate: editForm.licenseValidUntilDate.trim(),
            licenseValidYears: editForm.licenseValidYears.trim(),
            licenseIssuingAuthority: editForm.licenseIssuingAuthority.trim(),
            licenseIssuingRegion: editForm.licenseIssuingRegion.trim(),
          }
        : {}),
      recipientName: editForm.recipientName.trim(),
      recipientPhone: editForm.recipientPhone.trim(),
      deliveryAddress: editForm.deliveryAddress.trim(),
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: '审核员',
          action: '修改驾照信息与收货信息',
        },
      ],
    };

    updateOrder(order.orderId, nextUpdates);

    const nextOrder = {
      ...order,
      ...nextUpdates,
    } as KlookOrder;

    setOrder(nextOrder);
    setEditForm(buildEditForm(nextOrder));
    setIsEditing(false);
    showToast('success', '驾照信息和收货信息已更新');
  };

  const renderEditor = (
    field: keyof KlookOrderEditForm,
    options: {
      type?: 'date' | 'text' | 'tel';
      multiline?: boolean;
      rows?: number;
      placeholder?: string;
      ariaLabel?: string;
    } = {},
  ) => {
    const { type = 'text', multiline = false, rows = 3, placeholder, ariaLabel } = options;
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
        className="form-input order-audit-field__editor"
        type={type}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => handleEditFieldChange(field, event.target.value)}
      />
    );
  };

  const latestAuditTime = latestAuditLog?.time || '--';
  const auditOperatorId = buildAuditOperatorId(order, latestAuditLog);
  const licenseSnapshot = buildKlookLicenseSnapshot(order, editForm);

  const orderInfoItems: DetailFieldItem[] = [
    {
      label: '订单状态',
      value: <span className={`${getStatusTagClass(order.status)} order-audit-status-tag`}>{KLOOK_STATUS_LABELS[order.status]}</span>,
    },
    {
      label: '下单时间',
      value: getDisplayValue(order.createdAt),
    },
    {
      label: '审核时间',
      value: latestAuditTime,
    },
    {
      label: '审核人ID',
      value: auditOperatorId,
    },
    {
      label: '订单号',
      value: order.orderId,
    },
    {
      label: '驾照官推送订单号',
      value: getDisplayValue(order.managementOrderId),
      fieldClassName: 'klook-review-field--wide-label',
      labelClassName: 'klook-review-field__label--nowrap',
    },
  ];

  const licenseInfoItems: DetailFieldItem[] = [
    {
      label: '驾证号码',
      value: isEditing ? renderEditor('licenseNumber', { placeholder: '请输入驾证号码' }) : getDisplayValue(order.licenseNumber),
    },
    {
      label: '姓名',
      value: isEditing ? renderEditor('driverName', { placeholder: '请输入姓名' }) : getDisplayValue(order.driverName),
    },
    {
      label: '姓氏拼音',
      value: isEditing ? renderEditor('driverSurnameLatin', { placeholder: '请输入姓氏拼音' }) : licenseSnapshot.surnameLatin,
    },
    {
      label: '名字拼音',
      value: isEditing ? renderEditor('driverGivenNameLatin', { placeholder: '请输入名字拼音' }) : licenseSnapshot.givenNameLatin,
    },
    {
      label: '性别',
      value:
        isEditing && enableFullLicenseEdit ? renderEditor('licenseGender', { placeholder: '请输入性别' }) : licenseSnapshot.gender,
    },
    {
      label: '国籍',
      value:
        isEditing && enableFullLicenseEdit
          ? renderEditor('licenseNationality', { placeholder: '请输入国籍' })
          : licenseSnapshot.nationality,
    },
    {
      label: '出生日期',
      value: isEditing && enableFullLicenseEdit
        ? renderEditor('licenseBirthDate', { type: 'date', ariaLabel: '出生日期', placeholder: '请选择出生日期' })
        : licenseSnapshot.birthDate,
    },
    {
      label: '准驾车型',
      value: isEditing ? renderEditor('licenseType', { placeholder: '如 C1 / C2' }) : getDisplayValue(order.licenseType),
    },
    {
      label: '驾照地址详情',
      value: isEditing && enableFullLicenseEdit
        ? renderEditor('licenseAddress', { multiline: true, rows: 3, placeholder: '请输入驾照地址详情' })
        : licenseSnapshot.licenseAddress,
      fullWidth: true,
    },
    {
      label: '初次领证日期',
      value: isEditing && enableFullLicenseEdit
        ? renderEditor('licenseFirstIssueDate', { type: 'date', ariaLabel: '初次领证日期', placeholder: '请选择初次领证日期' })
        : licenseSnapshot.firstIssueDate,
    },
    {
      label: '有效起始日期',
      value: isEditing && enableFullLicenseEdit
        ? renderEditor('licenseValidFromDate', { type: 'date', ariaLabel: '有效起始日期', placeholder: '请选择有效起始日期' })
        : licenseSnapshot.validFromDate,
    },
    {
      label: '有效年限',
      value:
        isEditing && enableFullLicenseEdit
          ? renderEditor('licenseValidYears', { placeholder: '如 10年' })
          : licenseSnapshot.validYears,
    },
    ...(enableFullLicenseEdit
      ? [
          {
            label: '终止日期',
            value:
              isEditing && enableFullLicenseEdit
                ? renderEditor('licenseValidUntilDate', {
                    type: 'date',
                    ariaLabel: '终止日期',
                    placeholder: '请选择终止日期',
                  })
                : licenseSnapshot.validUntilDate,
          },
        ]
      : []),
    {
      label: '发证机关',
      value: isEditing && enableFullLicenseEdit
        ? renderEditor('licenseIssuingAuthority', { placeholder: '请输入发证机关' })
        : licenseSnapshot.issuingAuthority,
    },
    {
      label: '发证地区',
      value:
        isEditing && enableFullLicenseEdit
          ? renderEditor('licenseIssuingRegion', { placeholder: '请输入发证地区' })
          : licenseSnapshot.issuingRegion,
    },
  ];

  const deliveryInfoItems: DetailFieldItem[] = [
    {
      label: '收货人',
      value: isEditing ? renderEditor('recipientName', { placeholder: '请输入收货人' }) : getDisplayValue(order.recipientName),
    },
    {
      label: '联系电话',
      value: isEditing ? renderEditor('recipientPhone', { type: 'tel', placeholder: '请输入联系电话' }) : getDisplayValue(order.recipientPhone),
    },
    {
      label: '收货地址',
      value: isEditing ? renderEditor('deliveryAddress', { multiline: true, rows: 3, placeholder: '请输入收货地址' }) : getDisplayValue(order.deliveryAddress),
      fullWidth: true,
    },
  ];

  const orderDetailViewDeliveryItems: DetailFieldItem[] = [
    {
      label: '收货人',
      value: getDisplayValue(order.recipientName),
    },
    {
      label: '联系电话',
      value: getDisplayValue(order.recipientPhone),
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

  const orderDetailViewProductItems: DetailFieldItem[] = [
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
                <span>查看订单</span>
              </div>
              <div className="order-audit-topbar__actions">
                <button type="button" className="btn btn--primary order-audit-topbar__return-btn" onClick={handleReturn}>
                  返回
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
                <h2 className="order-audit-card__title">收货信息</h2>
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
                <h2 className="order-audit-card__title">商品信息</h2>
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
          <div className="order-audit-layout">
            <div className="order-audit-main">
              <section className="card order-audit-card klook-review-card">
                <div className="card__header order-audit-card__header">
                  <h2 className="order-audit-card__title">订单信息</h2>
                </div>
                <div className="card__body order-audit-card__body">
                  <div className="klook-review-grid">
                    {orderInfoItems.map((item) => (
                      <div
                        key={item.label}
                        className={`klook-review-field ${item.fullWidth ? 'klook-review-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                      >
                        <span className={`klook-review-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                        <div className="klook-review-field__value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card order-audit-card klook-review-card">
                <div className="card__header order-audit-card__header">
                  <h2 className="order-audit-card__title">驾照信息</h2>
                  {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
                </div>
                <div className="card__body order-audit-card__body">
                  <div className="klook-review-grid klook-review-grid--license">
                    {licenseInfoItems.map((item) => (
                      <div
                        key={item.label}
                        className={`klook-review-field ${item.fullWidth ? 'klook-review-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                      >
                        <span className={`klook-review-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                        <div className="klook-review-field__value">{item.value}</div>
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
                        className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}
                      >
                        <span className="order-audit-field__label">{item.label}:</span>
                        <div className="order-audit-field__value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

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

            <aside className="card order-audit-image-card">
              <div className="card__header order-audit-card__header">
                <h2 className="order-audit-card__title">证件图片</h2>
              </div>
              <div className="order-audit-image-grid">
                {CERTIFICATE_IMAGES.map((item) => (
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
          </div>
        </div>
      )}

      {isAuditable && (
        <div className="order-audit-footer">
          <div className="order-audit-footer__inner">
            <div className="order-audit-footer__meta">
              <span>订单号：{order.orderId}</span>
              <span>实付金额：{currencyFormatter.format(order.lockedPrice || 0)}</span>
              <span>办理类型：{getProductProcessTypeLabel(order.processType, t)}</span>
              {latestAuditLog && <span>最近审核：{latestAuditLog.time}</span>}
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

export default KlookOrderDetail;
