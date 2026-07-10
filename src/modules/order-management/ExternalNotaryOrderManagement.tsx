import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addExternalNotaryOrder,
  deleteExternalNotaryOrder,
  getExternalNotaryOrders,
  updateExternalNotaryOrder,
  type ExternalNotaryOrder,
  type ExternalNotaryOrderAttachment,
  type ExternalNotaryOrderStatus,
} from '../../services/externalNotaryOrderService';
import { getProducts } from '../../services/mockDataService';
import { pushExternalNotaryOrderToOffice } from '../../services/notaryOfficeOrderService';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import ResolvedImage from '../../shared/components/ResolvedImage';
import { resolveLocalImageSource, saveLocalImageSource } from '../../shared/utils/localImageStore';
import './ExternalNotaryOrderCreate.css';
import './ExternalNotaryOrderManagement.css';

type ExternalOrderModalMode = 'view' | 'push';
type BatchActionModalMode = 'import' | null;
type UploadFieldKey =
  | 'licenseFrontFile'
  | 'licenseBackFile'
  | 'licenseExtraFrontFile'
  | 'licenseExtraBackFile'
  | 'identityFrontFile'
  | 'identityBackFile'
  | 'digitalLicenseFile'
  | 'passportFile';

type UploadPreview = {
  name: string;
  src: string;
  title: string;
};

type NotaryServiceOption = {
  label: string;
  value: string;
};

type EditableOrderDraft = {
  productName: string;
  serviceName: string;
  useCountry: string;
  language: string;
  licenseNo: string;
  customerName: string;
  surnamePinyin: string;
  givenNamePinyin: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  logisticsCompany: string;
  trackingNumber: string;
  remark: string;
};

type PreviewImageState = {
  label: string;
  src: string;
} | null;

type LogisticsFormState = {
  logisticsCompany: string;
  trackingNumber: string;
};

const COUNTRY_CODES = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT','BO','BA','BW','BR',
  'BN','BG','BF','BI','CV','KH','CM','CA','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ','DK','DJ',
  'DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY',
  'HT','HN','HU','IS','IN','ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KW','KG','LA','LV','LB','LS','LR',
  'LY','LI','LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR',
  'NP','NL','NZ','NI','NE','NG','KP','MK','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL','PT','QA','RO','RU','RW','KN',
  'LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','KR','SS','ES','LK','SD','SR','SE','CH',
  'SY','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE',
  'ZM','ZW','PS'
] as const;

const getCountryOptions = () => {
  const displayNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['zh-Hans'], { type: 'region' }) : null;
  return COUNTRY_CODES.map((code) => ({
    code,
    name: displayNames?.of(code) || code,
  })).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
};

const STATUS_TABS: Array<{ label: string; value: ExternalNotaryOrderStatus | '' }> = [
  { label: '全部', value: '' },
  { label: '未推送', value: 'unpushed' },
  { label: '已推送', value: 'pushed' },
  { label: '驳回', value: 'rejected' },
];

const STATUS_LABELS: Record<ExternalNotaryOrderStatus, string> = {
  unpushed: '未推送',
  pushed: '已推送',
  rejected: '驳回',
};

const STATUS_TAG_CLASS_NAMES: Record<ExternalNotaryOrderStatus, string> = {
  unpushed: 'tag tag--warning',
  pushed: 'tag tag--shipped',
  rejected: 'tag tag--rejected',
};

const NOTARY_OFFICE_OPTIONS = ['北部湾公证处', '张江公证处', '东博公证处'];

const NOTARY_OFFICE_NAME_TO_ID: Record<string, string> = {
  北部湾公证处: 'beibu-gulf',
  张江公证处: 'zhangjiang',
  东博公证处: 'dongbo',
};

const LOGISTICS_COMPANY_OPTIONS = ['顺丰速运', '京东物流', '邮政EMS', '圆通速递', '中通快递', '申通快递'];

const UPLOAD_FIELDS: Array<{ key: UploadFieldKey; title: string; required?: boolean }> = [
  { key: 'licenseFrontFile', title: '驾驶证正面图片', required: true },
  { key: 'licenseBackFile', title: '驾驶证反面图片', required: true },
  { key: 'licenseExtraFrontFile', title: '驾驶证副页正面图片', required: true },
  { key: 'licenseExtraBackFile', title: '驾驶证副页反面图片', required: true },
  { key: 'identityFrontFile', title: '身份证正面', required: true },
  { key: 'identityBackFile', title: '身份证反面', required: true },
  { key: 'digitalLicenseFile', title: '电子驾照', required: true },
  { key: 'passportFile', title: '护照/港澳台通行证' },
];

const ATTACHMENT_TITLES: Record<string, string> = Object.fromEntries(UPLOAD_FIELDS.map((field) => [field.key, field.title] as const));

const IMPORT_HEADERS = {
  productName: ['产品类型', '产品', 'productName'],
  serviceName: ['服务选择', '服务内容', 'serviceName'],
  useCountry: ['使用国家', '国家', 'useCountry'],
  language: ['语言', 'language'],
  licenseNo: ['驾驶证号码', 'licenseNo'],
  customerName: ['姓名', '客户姓名', 'customerName'],
  surnamePinyin: ['姓氏拼音', 'surnamePinyin'],
  givenNamePinyin: ['名字拼音', 'givenNamePinyin'],
  recipientName: ['收件人姓名', 'recipientName'],
  recipientPhone: ['电话号码', '手机号', 'recipientPhone'],
  deliveryAddress: ['收货地址', 'deliveryAddress'],
  remark: ['备注', 'remark'],
} as const;

const EXTERNAL_NOTARY_EXPORT_TEMPLATE_PATH = new URL('../../public/templates/external-notary-order-export-template.xlsx', import.meta.url).href;

const buildTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
    now.getMinutes(),
  )}:${pad(now.getSeconds())}`;
};

const FieldValue: React.FC<{ value?: string }> = ({ value }) => <div className="form-value">{value?.trim() ? value : '--'}</div>;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const getImageExtension = (source: string): 'png' | 'jpeg' | 'gif' => {
  const mimeMatch = source.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
  if (mimeMatch?.[1]) {
    return mimeMatch[1] === 'jpg' ? 'jpeg' : ((mimeMatch[1] as 'png' | 'jpeg' | 'gif') || 'png');
  }

  const cleanedSource = source.split('?')[0].split('#')[0].toLowerCase();
  if (cleanedSource.endsWith('.png')) return 'png';
  if (cleanedSource.endsWith('.jpg') || cleanedSource.endsWith('.jpeg')) return 'jpeg';
  if (cleanedSource.endsWith('.gif')) return 'gif';
  return 'png';
};

const resolveAttachmentExportSource = async (source: string) => {
  const resolvedSource = await resolveLocalImageSource(source);
  if (!resolvedSource) {
    return null;
  }

  if (resolvedSource.startsWith('data:image/')) {
    return {
      base64: resolvedSource,
      extension: getImageExtension(resolvedSource),
    };
  }

  try {
    const response = await fetch(resolvedSource);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const base64 = await readBlobAsDataUrl(blob);
    return {
      base64,
      extension: getImageExtension(blob.type ? `data:${blob.type};base64,` : resolvedSource),
    };
  } catch {
    return null;
  }
};

const createDraftFromOrder = (order: ExternalNotaryOrder): EditableOrderDraft => ({
  productName: order.productName || '',
  serviceName: order.serviceName || '',
  useCountry: order.useCountry || '',
  language: order.language || '',
  licenseNo: order.licenseNo || '',
  customerName: order.customerName || '',
  surnamePinyin: order.surnamePinyin || '',
  givenNamePinyin: order.givenNamePinyin || '',
  recipientName: order.recipientName || order.customerName || '',
  recipientPhone: order.recipientPhone || '',
  deliveryAddress: order.deliveryAddress || '',
  logisticsCompany: order.logisticsCompany || '',
  trackingNumber: order.trackingNumber || '',
  remark: order.remark || '',
});

const createAttachmentUploadState = (attachments: ExternalNotaryOrderAttachment[]) =>
  attachments.reduce<Partial<Record<UploadFieldKey, UploadPreview>>>((result, attachment) => {
    const key = attachment.key as UploadFieldKey;
    if (ATTACHMENT_TITLES[key]) {
      result[key] = {
        name: attachment.name,
        src: attachment.src,
        title: attachment.title || ATTACHMENT_TITLES[key],
      };
    }
    return result;
  }, {});

const normalizeCellValue = (value: unknown) => String(value ?? '').trim();

const getRowValue = (row: Record<string, string>, candidates: readonly string[]) => {
  for (const candidate of candidates) {
    const matchedKey = Object.keys(row).find((key) => key.trim().toLowerCase() === candidate.trim().toLowerCase());
    if (matchedKey && row[matchedKey]?.trim()) {
      return row[matchedKey].trim();
    }
  }
  return '';
};

const parseCsvRows = (text: string) => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    return headers.reduce<Record<string, string>>((result, header, index) => {
      result[header] = values[index] || '';
      return result;
    }, {});
  });
};

const loadExcelModule = async () => {
  const runtimeModule = await import('exceljs');
  return ('default' in runtimeModule ? runtimeModule.default : runtimeModule) as typeof import('exceljs');
};

const parseImportFileRows = async (file: File) => {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsvRows(await file.text());
  }

  const ExcelJS = await loadExcelModule();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = headerValues.map((value: unknown) => normalizeCellValue(value)).filter(Boolean);
  const rows: Array<Record<string, string>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    const values = rowValues.map((value: unknown) => normalizeCellValue(value));
    if (values.every((value) => !value)) {
      return;
    }

    rows.push(
      headers.reduce<Record<string, string>>((result, header, index) => {
        result[header] = values[index] || '';
        return result;
      }, {}),
    );
  });

  return rows;
};

const exportOrders = async (orders: ExternalNotaryOrder[]) => {
  const ExcelJS = await loadExcelModule();
  const workbook = new ExcelJS.Workbook();
  const templateResponse = await fetch(EXTERNAL_NOTARY_EXPORT_TEMPLATE_PATH);
  if (!templateResponse.ok) {
    throw new Error('Failed to load export template');
  }
  await workbook.xlsx.load(await templateResponse.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Export template is invalid');
  }

  const attachmentColumnMap: Partial<Record<UploadFieldKey, number>> = {
    licenseFrontFile: 18,
    licenseBackFile: 19,
    licenseExtraFrontFile: 20,
    licenseExtraBackFile: 21,
    identityFrontFile: 22,
    identityBackFile: 23,
    digitalLicenseFile: 24,
    passportFile: 25,
  };
  const templateRow = worksheet.getRow(2);
  const templateHeight = templateRow.height ?? 92;
  const templateStyles = Array.from({ length: 27 }, (_, index) => JSON.parse(JSON.stringify(worksheet.getCell(2, index + 1).style ?? {})));

  if (worksheet.rowCount > 1) {
    worksheet.spliceRows(2, worksheet.rowCount - 1);
  }

  for (const order of orders) {
    const row = worksheet.addRow([
      order.orderId,
      order.createdAt,
      order.productName,
      order.serviceName || '',
      order.useCountry || '',
      order.language,
      order.licenseNo,
      order.customerName,
      order.surnamePinyin || '',
      order.givenNamePinyin || '',
      order.recipientName,
      order.recipientPhone,
      order.deliveryAddress,
      STATUS_LABELS[order.status],
      order.pushedNotaryOfficeName || '',
      order.rejectReason || '',
      order.remark || '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    const rowIndex = row.number;
    row.height = templateHeight;
    templateStyles.forEach((style, index) => {
      worksheet.getCell(rowIndex, index + 1).style = JSON.parse(JSON.stringify(style));
    });

    const exportSources = await Promise.all(
      order.attachments.map(async (attachment) => ({
        columnIndex: attachmentColumnMap[attachment.key as UploadFieldKey],
        exportSource: await resolveAttachmentExportSource(attachment.src),
      })),
    );

    exportSources.forEach(({ columnIndex, exportSource }) => {
      if (!columnIndex || !exportSource?.base64) {
        return;
      }
      const imageId = workbook.addImage({
        base64: exportSource.base64,
        extension: exportSource.extension,
      });
      worksheet.addImage(imageId, {
        tl: { col: columnIndex - 0.85, row: rowIndex - 0.82 },
        ext: { width: 68, height: 68 },
        editAs: 'oneCell',
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `外采公证订单_${buildTimestamp().replace(/\s+/g, '_').replace(/:/g, '-')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
};

const downloadWorkbook = async (
  sheetName: string,
  columns: Array<{ header: string; key: string; width: number }>,
  rows: Array<Record<string, string>>,
  fileName: string,
) => {
  const ExcelJS = await loadExcelModule();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns;
  worksheet.getRow(1).font = { bold: true };
  rows.forEach((row) => worksheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
};

const downloadImportTemplate = async () => {
  await downloadWorkbook(
    '外采公证订单导入模板',
    [
      { header: '产品类型', key: 'productName', width: 20 },
      { header: '服务选择', key: 'serviceName', width: 18 },
      { header: '使用国家', key: 'useCountry', width: 18 },
      { header: '语言', key: 'language', width: 14 },
      { header: '驾驶证号码', key: 'licenseNo', width: 22 },
      { header: '姓名', key: 'customerName', width: 14 },
      { header: '姓氏拼音', key: 'surnamePinyin', width: 16 },
      { header: '名字拼音', key: 'givenNamePinyin', width: 16 },
      { header: '收件人姓名', key: 'recipientName', width: 14 },
      { header: '电话号码', key: 'recipientPhone', width: 16 },
      { header: '收货地址', key: 'deliveryAddress', width: 36 },
      { header: '备注', key: 'remark', width: 24 },
    ],
    [],
    '外采公证订单导入模板.xlsx',
  );
};

const ExternalNotaryOrderManagement: React.FC = () => {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [orders, setOrders] = useState<ExternalNotaryOrder[]>(() =>
    getExternalNotaryOrders().sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
  const [activeStatus, setActiveStatus] = useState<ExternalNotaryOrderStatus | ''>('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ExternalNotaryOrder | null>(null);
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<ExternalNotaryOrder | null>(null);
  const [modalMode, setModalMode] = useState<ExternalOrderModalMode>('view');
  const [batchActionModal, setBatchActionModal] = useState<BatchActionModalMode>(null);
  const [isSelectingExport, setIsSelectingExport] = useState(false);
  const [selectedExportOrderIds, setSelectedExportOrderIds] = useState<string[]>([]);
  const [selectedNotaryOffice, setSelectedNotaryOffice] = useState('');
  const [resolvedAttachmentSources, setResolvedAttachmentSources] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDraft, setEditDraft] = useState<EditableOrderDraft | null>(null);
  const [editUploads, setEditUploads] = useState<Partial<Record<UploadFieldKey, UploadPreview>>>({});
  const [previewImage, setPreviewImage] = useState<PreviewImageState>(null);
  const [logisticsForm, setLogisticsForm] = useState<LogisticsFormState>({ logisticsCompany: '', trackingNumber: '' });

  const productOptions = useMemo(
    () =>
      getProducts()
        .filter((product) => product.category === 'notary' && product.status === 'active')
        .sort((left, right) => right.weight - left.weight)
        .map((product) => product.title),
    [],
  );
  const serviceOptions = useMemo<NotaryServiceOption[]>(
    () => [
      { label: '加急1工出', value: '加急1工出' },
      { label: '加急3工出', value: '加急3工出' },
    ],
    [],
  );
  const countryOptions = useMemo(() => getCountryOptions(), []);

  useEffect(() => {
    let active = true;
    if (!selectedOrder?.attachments.length) {
      setResolvedAttachmentSources({});
      return () => {
        active = false;
      };
    }

    Promise.all(selectedOrder.attachments.map(async (attachment) => [attachment.key, await resolveLocalImageSource(attachment.src)] as const))
      .then((entries) => {
        if (active) {
          setResolvedAttachmentSources(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (active) {
          setResolvedAttachmentSources({});
        }
      });

    return () => {
      active = false;
    };
  }, [selectedOrder]);

  const reloadOrders = () => {
    setOrders(getExternalNotaryOrders().sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  };

  const ordersMatchingFilters = useMemo(
    () =>
      orders.filter((order) => {
        const createdDate = order.createdAt.slice(0, 10);
        if (filterProduct && order.productName !== filterProduct) return false;
        if (filterStartDate && createdDate < filterStartDate) return false;
        if (filterEndDate && createdDate > filterEndDate) return false;
        return true;
      }),
    [filterEndDate, filterProduct, filterStartDate, orders],
  );

  const filteredOrders = useMemo(
    () => (activeStatus ? ordersMatchingFilters.filter((order) => order.status === activeStatus) : ordersMatchingFilters),
    [activeStatus, ordersMatchingFilters],
  );

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': ordersMatchingFilters.length };
    STATUS_TABS.forEach((tab) => {
      if (tab.value) {
        counts[tab.value] = ordersMatchingFilters.filter((order) => order.status === tab.value).length;
      }
    });
    return counts;
  }, [ordersMatchingFilters]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2500);
  };

  const openOrderModal = (order: ExternalNotaryOrder, mode: ExternalOrderModalMode) => {
    setSelectedOrder(order);
    setModalMode(mode);
    setSelectedNotaryOffice(order.pushedNotaryOfficeName || '');
    setIsEditing(false);
    setEditDraft(createDraftFromOrder(order));
    setLogisticsForm({
      logisticsCompany: order.logisticsCompany || '',
      trackingNumber: order.trackingNumber || '',
    });
    setEditUploads(createAttachmentUploadState(order.attachments));
    setPreviewImage(null);
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
    setModalMode('view');
    setSelectedNotaryOffice('');
    setResolvedAttachmentSources({});
    setIsEditing(false);
    setEditDraft(null);
    setLogisticsForm({ logisticsCompany: '', trackingNumber: '' });
    setEditUploads({});
    setPreviewImage(null);
  };

  const handleReset = () => {
    setFilterProduct('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  const cancelExportSelection = () => {
    setIsSelectingExport(false);
    setSelectedExportOrderIds([]);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTargetOrder) return;
    const deletedOrder = deleteExternalNotaryOrder(deleteTargetOrder.orderId);
    if (!deletedOrder) {
      showToast('error', '仅未推送订单可删除');
      setDeleteTargetOrder(null);
      return;
    }
    reloadOrders();
    setCurrentPage(1);
    setDeleteTargetOrder(null);
    showToast('success', `${deletedOrder.orderId} 已删除`);
  };

  const handlePushSubmit = () => {
    if (!selectedOrder) return;
    if (!selectedNotaryOffice) {
      showToast('error', '请选择公证处');
      return;
    }
    const currentTimestamp = buildTimestamp();
    const trimmedRemark = `资料已审核，推送至${selectedNotaryOffice}`;

    updateExternalNotaryOrder(selectedOrder.orderId, {
      status: 'pushed',
      pushedNotaryOfficeName: selectedNotaryOffice,
      reviewRemark: trimmedRemark,
      rejectReason: '',
      updatedAt: currentTimestamp,
      logs: [
        ...selectedOrder.logs,
        {
          time: currentTimestamp,
          operator: '运营',
          action: `订单推送至${selectedNotaryOffice}`,
        },
      ],
    });

    pushExternalNotaryOrderToOffice(selectedOrder, {
      officeId: NOTARY_OFFICE_NAME_TO_ID[selectedNotaryOffice] || undefined,
      officeName: selectedNotaryOffice,
      operator: '运营',
      pushedAt: currentTimestamp,
      reviewRemark: trimmedRemark,
    });

    reloadOrders();
    closeOrderModal();
    showToast('success', `${selectedOrder.orderId} 已推送至${selectedNotaryOffice}`);
  };

  const handleEditFieldChange = (field: keyof EditableOrderDraft, value: string) => {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleLogisticsFieldChange = (field: keyof LogisticsFormState, value: string) => {
    setLogisticsForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditUploadChange = async (field: UploadFieldKey, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', '请上传图片格式附件');
      return;
    }
    try {
      const src = await readFileAsDataUrl(file);
      setEditUploads((current) => ({
        ...current,
        [field]: {
          name: file.name,
          src,
          title: ATTACHMENT_TITLES[field],
        },
      }));
    } catch {
      showToast('error', '附件处理失败，请重试');
    }
  };

  const handleEditUploadRemove = (field: UploadFieldKey) => {
    setEditUploads((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleStartEdit = () => {
    if (!selectedOrder || selectedOrder.status === 'pushed') return;
    setEditDraft(createDraftFromOrder(selectedOrder));
    setEditUploads(createAttachmentUploadState(selectedOrder.attachments));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!selectedOrder) return;
    setEditDraft(createDraftFromOrder(selectedOrder));
    setLogisticsForm({
      logisticsCompany: selectedOrder.logisticsCompany || '',
      trackingNumber: selectedOrder.trackingNumber || '',
    });
    setEditUploads(createAttachmentUploadState(selectedOrder.attachments));
    setIsEditing(false);
  };

  const handleSubmitLogistics = () => {
    if (!selectedOrder || selectedOrder.status !== 'pushed') return;

    const logisticsCompany = logisticsForm.logisticsCompany.trim();
    const trackingNumber = logisticsForm.trackingNumber.trim();

    if (!logisticsCompany || !trackingNumber) {
      showToast('error', '请完整填写物流公司和物流单号');
      return;
    }

    const currentTimestamp = buildTimestamp();
    const nextOrder = updateExternalNotaryOrder(selectedOrder.orderId, {
      logisticsCompany,
      trackingNumber,
      updatedAt: currentTimestamp,
      logs: [
        ...selectedOrder.logs,
        {
          time: currentTimestamp,
          operator: '运营',
          action: `提交物流信息：${logisticsCompany} ${trackingNumber}`,
        },
      ],
    });

    reloadOrders();
    if (nextOrder) {
      setSelectedOrder(nextOrder);
      setLogisticsForm({
        logisticsCompany: nextOrder.logisticsCompany || '',
        trackingNumber: nextOrder.trackingNumber || '',
      });
    }
    showToast('success', '物流信息已提交');
  };

  const hasSubmittedLogistics = Boolean(
    selectedOrder?.logisticsCompany?.trim() && selectedOrder?.trackingNumber?.trim(),
  );

  const handleSaveEdit = async () => {
    if (!selectedOrder || !editDraft) return;
    if (
      !editDraft.productName.trim() ||
      !editDraft.serviceName.trim() ||
      !editDraft.useCountry.trim() ||
      !editDraft.language.trim() ||
      !editDraft.licenseNo.trim() ||
      !editDraft.customerName.trim() ||
      !editDraft.surnamePinyin.trim() ||
      !editDraft.givenNamePinyin.trim() ||
      !editDraft.recipientName.trim() ||
      !editDraft.recipientPhone.trim() ||
      !editDraft.deliveryAddress.trim()
    ) {
      showToast('error', '请完整填写订单信息');
      return;
    }

    setIsSaving(true);
    try {
      const uploadTimestamp = Date.now();
      const attachments = await Promise.all(
        UPLOAD_FIELDS.reduce<Array<Promise<ExternalNotaryOrderAttachment>>>((result, field) => {
          const preview = editUploads[field.key];
          if (!preview?.src) {
            return result;
          }
          result.push(
            saveLocalImageSource(`external-notary-edit-${selectedOrder.orderId}-${uploadTimestamp}-${field.key}`, preview.src).then((storedSource) => ({
              key: field.key,
              title: preview.title,
              name: preview.name,
              src: storedSource,
            })),
          );
          return result;
        }, []),
      );

      const currentTimestamp = buildTimestamp();
      const nextOrder = updateExternalNotaryOrder(selectedOrder.orderId, {
        productName: editDraft.productName.trim(),
        serviceName: editDraft.serviceName.trim(),
        useCountry: editDraft.useCountry.trim(),
        language: editDraft.language.trim(),
        licenseNo: editDraft.licenseNo.trim(),
        customerName: editDraft.customerName.trim(),
        surnamePinyin: editDraft.surnamePinyin.trim(),
        givenNamePinyin: editDraft.givenNamePinyin.trim(),
        recipientName: editDraft.recipientName.trim(),
        recipientPhone: editDraft.recipientPhone.trim(),
        deliveryAddress: editDraft.deliveryAddress.trim(),
        remark: editDraft.remark.trim(),
        updatedAt: currentTimestamp,
        attachments,
        logs: [
          ...selectedOrder.logs,
          {
            time: currentTimestamp,
            operator: '运营',
            action: '订单信息已修改',
          },
        ],
      });

      reloadOrders();
      if (nextOrder) {
        setSelectedOrder(nextOrder);
        setEditDraft(createDraftFromOrder(nextOrder));
        setEditUploads(createAttachmentUploadState(nextOrder.attachments));
      }
      setIsEditing(false);
      showToast('success', '订单已保存');
    } catch {
      showToast('error', '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (ordersToExport: ExternalNotaryOrder[]) => {
    if (ordersToExport.length === 0) {
      showToast('error', isSelectingExport ? '请选择要导出的订单' : '当前没有可导出的订单');
      return;
    }
    setIsExporting(true);
    try {
      await exportOrders(ordersToExport);
      cancelExportSelection();
      showToast('success', '导出成功');
    } catch {
      showToast('error', '导出失败，请稍后重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBatchActionModal(null);

    setIsImporting(true);
    try {
      const rows = await parseImportFileRows(file);
      if (rows.length === 0) {
        showToast('error', '未识别到可导入的数据');
        return;
      }

      let successCount = 0;
      rows.forEach((row) => {
        const productName = getRowValue(row, IMPORT_HEADERS.productName);
        const serviceName = getRowValue(row, IMPORT_HEADERS.serviceName);
        const useCountry = getRowValue(row, IMPORT_HEADERS.useCountry);
        const language = getRowValue(row, IMPORT_HEADERS.language);
        const licenseNo = getRowValue(row, IMPORT_HEADERS.licenseNo);
        const customerName = getRowValue(row, IMPORT_HEADERS.customerName);
        const surnamePinyin = getRowValue(row, IMPORT_HEADERS.surnamePinyin);
        const givenNamePinyin = getRowValue(row, IMPORT_HEADERS.givenNamePinyin);
        const recipientName = getRowValue(row, IMPORT_HEADERS.recipientName);
        const recipientPhone = getRowValue(row, IMPORT_HEADERS.recipientPhone);
        const deliveryAddress = getRowValue(row, IMPORT_HEADERS.deliveryAddress);
        const remark = getRowValue(row, IMPORT_HEADERS.remark);

        if (
          !productName ||
          !serviceName ||
          !useCountry ||
          !language ||
          !licenseNo ||
          !customerName ||
          !surnamePinyin ||
          !givenNamePinyin ||
          !recipientName ||
          !recipientPhone ||
          !deliveryAddress
        ) {
          return;
        }

        addExternalNotaryOrder({
          productName,
          serviceName,
          useCountry,
          language,
          customerName,
          agentName: '批量导入',
          licenseName: customerName,
          licenseNo,
          surnamePinyin,
          givenNamePinyin,
          remark,
          recipientName,
          recipientPhone,
          deliveryAddress,
          attachments: [],
        });
        successCount += 1;
      });

      reloadOrders();
      setCurrentPage(1);
      showToast(successCount > 0 ? 'success' : 'error', successCount > 0 ? `成功导入 ${successCount} 条` : '没有符合规则的数据');
    } catch {
      showToast('error', '导入失败，请检查文件格式');
    } finally {
      setIsImporting(false);
    }
  };

  const selectedExportOrders = useMemo(
    () => filteredOrders.filter((order) => selectedExportOrderIds.includes(order.orderId)),
    [filteredOrders, selectedExportOrderIds],
  );

  const isAllCurrentPageSelected = paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedExportOrderIds.includes(order.orderId));

  const toggleExportOrder = (orderId: string) => {
    setSelectedExportOrderIds((current) => (current.includes(orderId) ? current.filter((item) => item !== orderId) : [...current, orderId]));
  };

  const toggleSelectAllCurrentPage = () => {
    setSelectedExportOrderIds((current) => {
      if (isAllCurrentPageSelected) {
        return current.filter((id) => !paginatedOrders.some((order) => order.orderId === id));
      }
      const next = new Set(current);
      paginatedOrders.forEach((order) => next.add(order.orderId));
      return Array.from(next);
    });
  };

  const handleExportButtonClick = () => {
    if (!isSelectingExport) {
      if (filteredOrders.length === 0) {
        showToast('error', '当前没有可导出的订单');
        return;
      }
      setIsSelectingExport(true);
      setSelectedExportOrderIds([]);
      return;
    }
    void handleExport(selectedExportOrders);
  };

  const renderEditableInput = (
    label: string,
    field: keyof EditableOrderDraft,
    options?: { full?: boolean; rows?: number; type?: 'input' | 'textarea' | 'select'; selectOptions?: Array<{ label: string; value: string }>; placeholder?: string },
  ) => (
    <div className={`form-group ${options?.full ? 'external-notary-form-grid__full' : ''}`.trim()}>
      <label className="form-label">{label}</label>
      {options?.type === 'select' ? (
        <select
          className={`form-select ${!(editDraft?.[field] || '') ? 'external-notary-create-select--placeholder' : ''}`}
          value={editDraft?.[field] || ''}
          onChange={(event) => handleEditFieldChange(field, event.target.value)}
        >
          <option value="">{options.placeholder || `请选择${label}`}</option>
          {(options.selectOptions || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : options?.rows || options?.type === 'textarea' ? (
        <textarea className="form-input" rows={options?.rows} value={editDraft?.[field] || ''} onChange={(event) => handleEditFieldChange(field, event.target.value)} />
      ) : (
        <input className="form-input" value={editDraft?.[field] || ''} onChange={(event) => handleEditFieldChange(field, event.target.value)} />
      )}
    </div>
  );

  return (
    <div className="app-main animate-fadeIn order-list-page">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <div className="app-topbar">
        <div className="order-list-topbar">
          <div className="app-topbar__breadcrumb">
            后台管理
            <span>/</span>
            外采公证订单管理
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel external-notary-filter-panel">
          <div className="order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">产品</label>
              <select
                className="form-select"
                value={filterProduct}
                onChange={(event) => {
                  setFilterProduct(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">全部产品</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">时间</label>
              <div className="order-filter-range">
                <DatePickerInput
                  ariaLabel="开始时间"
                  placeholder="年/月/日"
                  value={filterStartDate}
                  onChange={(value) => {
                    setFilterStartDate(value);
                    setCurrentPage(1);
                  }}
                  className="external-notary-date-field"
                />
                <span className="order-filter-range__divider">至</span>
                <DatePickerInput
                  ariaLabel="结束时间"
                  placeholder="年/月/日"
                  value={filterEndDate}
                  onChange={(value) => {
                    setFilterEndDate(value);
                    setCurrentPage(1);
                  }}
                  className="external-notary-date-field"
                />
              </div>
            </div>

            <div className="order-filter-actions order-filter-actions--inline external-notary-filter-panel__actions">
              <button className="btn btn--primary" type="button" onClick={() => setCurrentPage(1)}>
                搜索
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleReset}>
                重置
              </button>
            </div>
          </div>
        </div>

        <div className="card order-list-card">
          <div className="order-list-card__toolbar">
            <button className="btn btn--primary" type="button" onClick={() => navigate('/order-management/external-notary-orders/new')}>
              录入外采订单
            </button>
            <button className="btn btn--secondary" type="button" onClick={() => setBatchActionModal('import')} disabled={isImporting}>
              {isImporting ? '导入中...' : '批量导入'}
            </button>
            <button className="btn btn--secondary" type="button" onClick={handleExportButtonClick} disabled={isExporting}>
              {isExporting ? '导出中...' : isSelectingExport ? `确认导出${selectedExportOrderIds.length ? `（${selectedExportOrderIds.length}）` : ''}` : '批量导出'}
            </button>
            {isSelectingExport && (
              <button className="btn btn--secondary" type="button" onClick={cancelExportSelection}>
                取消选择
              </button>
            )}
            <input ref={importInputRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={(event) => void handleImportFileChange(event)} />
          </div>

          <div className="order-list-card__tabs-row">
            <div className="tabs order-list-tabs">
              {STATUS_TABS.map((tab) => (
                <div
                  key={tab.value || 'all'}
                  className={`tabs__item ${activeStatus === tab.value ? 'tabs__item--active' : ''}`}
                  onClick={() => {
                    setActiveStatus(tab.value);
                    setCurrentPage(1);
                  }}
                >
                  {tab.label}
                  <span className="order-list-tabs__count">{statusCounts[tab.value || ''] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table order-list-table external-notary-order-table">
              <colgroup>
                {isSelectingExport && <col className="external-notary-order-table__col--select" />}
                <col className="external-notary-order-table__col--id" />
                <col className="external-notary-order-table__col--time" />
                <col className="external-notary-order-table__col--product" />
                <col className="external-notary-order-table__col--address" />
                <col className="external-notary-order-table__col--status" />
                <col className="external-notary-order-table__col--office" />
                <col className="external-notary-order-table__col--actions" />
              </colgroup>
              <thead>
                <tr>
                  {isSelectingExport && (
                    <th className="external-notary-order-table__select-cell">
                      <input type="checkbox" checked={isAllCurrentPageSelected} onChange={toggleSelectAllCurrentPage} />
                    </th>
                  )}
                  <th>订单 ID</th>
                  <th>下单时间</th>
                  <th>产品信息</th>
                  <th>收货地址</th>
                  <th>状态</th>
                  <th>推送公证处</th>
                  <th>操作项</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectingExport ? 8 : 7} style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr key={order.orderId}>
                      {isSelectingExport && (
                        <td className="external-notary-order-table__select-cell">
                          <input
                            type="checkbox"
                            checked={selectedExportOrderIds.includes(order.orderId)}
                            onChange={() => toggleExportOrder(order.orderId)}
                          />
                        </td>
                      )}
                      <td>{order.orderId}</td>
                      <td>{order.createdAt}</td>
                      <td>
                        <div className="order-cell-stack order-cell-stack--tight external-notary-product-cell">
                          <span className="external-notary-product-name">{order.productName}</span>
                          <div className="external-notary-product-tags">
                            <span className="external-notary-language-badge">{order.language || '--'}</span>
                            <span className="external-notary-country-badge">{order.useCountry || '--'}</span>
                          </div>
                          <span
                            className={`external-notary-service-badge ${
                              order.serviceName === '加急1工出'
                                ? 'external-notary-service-badge--red'
                                : order.serviceName === '加急3工出'
                                  ? 'external-notary-service-badge--orange'
                                  : ''
                            }`}
                          >
                            {order.serviceName || '--'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="external-notary-address-card">
                          <span className="external-notary-address-card__line">{`收件人：${order.recipientName || order.customerName || '--'}`}</span>
                          <span className="external-notary-address-card__line">{`手机号：${order.recipientPhone || '--'}`}</span>
                          <span className="external-notary-address-card__line">{`收货地址：${order.deliveryAddress || '--'}`}</span>
                        </div>
                      </td>
                      <td>
                        <div className="external-notary-status-cell">
                          <span className={STATUS_TAG_CLASS_NAMES[order.status]}>{STATUS_LABELS[order.status]}</span>
                          {(order.logisticsCompany?.trim() || order.trackingNumber?.trim()) && (
                            <div className="external-notary-status-logistics">
                              <span>{order.logisticsCompany || '--'}</span>
                              <span>{order.trackingNumber || '--'}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{order.pushedNotaryOfficeName || '--'}</td>
                      <td className="order-actions-cell order-actions-cell--inline">
                        <button type="button" className="order-text-action order-text-action--view" onClick={() => openOrderModal(order, 'view')}>
                          查看订单
                        </button>
                        {(order.status === 'unpushed' || order.status === 'rejected') && (
                          <button type="button" className="order-text-action order-text-action--audit" onClick={() => openOrderModal(order, 'push')}>
                            推送
                          </button>
                        )}
                        {order.status === 'unpushed' && (
                          <button type="button" className="order-text-action external-notary-delete-link" onClick={() => setDeleteTargetOrder(order)}>
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ListUnifiedPagination
            total={filteredOrders.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {batchActionModal === 'import' && (
        <div className="modal-overlay" onClick={() => setBatchActionModal(null)}>
          <div className="modal external-notary-batch-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header external-notary-batch-modal__header">
              <h3 className="modal__title">批量导入</h3>
              <button type="button" className="external-notary-order-modal__close" onClick={() => setBatchActionModal(null)} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="modal__body external-notary-batch-modal__body">
              <button
                type="button"
                className="external-notary-batch-modal__dropzone"
                onClick={handleImportClick}
                disabled={isImporting}
              >
                <span className="external-notary-batch-modal__icon">↑</span>
                <strong>点击上传导入文件</strong>
                <small>支持 .xlsx、.csv 格式</small>
              </button>
              <div className="external-notary-batch-modal__tips">
                <>
                  <p>
                    1. 请按模板字段整理订单数据后上传。
                    <button type="button" className="external-notary-batch-modal__link" onClick={() => void downloadImportTemplate()}>
                      下载模版
                    </button>
                  </p>
                  <p>2. 系统会自动校验必填项，缺失数据不会导入。</p>
                </>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="modal-overlay" onClick={closeOrderModal}>
          <div
            className={`modal external-notary-order-modal ${modalMode === 'push' ? 'external-notary-order-modal--push' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header external-notary-order-modal__header">
              <h3 className="modal__title">{modalMode === 'view' ? '查看订单' : '推送订单'}</h3>
              <button type="button" className="external-notary-order-modal__close" onClick={closeOrderModal} aria-label="关闭">
                ×
              </button>
            </div>

            <div className="modal__body external-notary-order-modal__body">
              {modalMode === 'push' ? (
                <section className="external-notary-push-panel">
                  <div className="external-notary-push-panel__sections">
                    <section className="external-notary-create-panel external-notary-push-section">
                      <div className="external-notary-create-panel__header">
                        <h3>产品信息</h3>
                      </div>
                      <div className="external-notary-form-grid">
                        <div className="form-group">
                          <label className="form-label">产品类型</label>
                          <FieldValue value={selectedOrder.productName} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">语言</label>
                          <FieldValue value={selectedOrder.language} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">服务</label>
                          <FieldValue value={selectedOrder.serviceName} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">使用国家</label>
                          <FieldValue value={selectedOrder.useCountry} />
                        </div>
                      </div>
                    </section>

                    <section className="external-notary-create-panel external-notary-push-section">
                      <div className="external-notary-create-panel__header">
                        <h3>推送区域</h3>
                      </div>
                      <div className="external-notary-form-grid">
                        <div className="form-group external-notary-form-grid__full">
                          <label className="form-label">公证处</label>
                          <select
                            className={`form-select ${!selectedNotaryOffice ? 'external-notary-create-select--placeholder' : ''}`}
                            value={selectedNotaryOffice}
                            onChange={(event) => setSelectedNotaryOffice(event.target.value)}
                          >
                            <option value="">请选择公证处</option>
                            {NOTARY_OFFICE_OPTIONS.map((office) => (
                              <option key={office} value={office}>
                                {office}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>
                  </div>
                </section>
              ) : (
                <>
                  {selectedOrder.status === 'rejected' && (
                    <div className="notary-preview-alert notary-preview-alert--danger" style={{ marginBottom: 16 }}>
                      <span>驳回原因</span>
                      <strong>{selectedOrder.rejectReason || '--'}</strong>
                    </div>
                  )}

                  <section className="external-notary-order-summary">
                    <div className="external-notary-order-summary__main">
                      <h3 className="external-notary-order-summary__title">{selectedOrder.productName || '--'}</h3>
                      <div className="external-notary-order-summary__meta">
                        <span>订单ID：{selectedOrder.orderId || '--'}</span>
                        <span>下单时间：{selectedOrder.createdAt || '--'}</span>
                      </div>
                    </div>
                    <div className="external-notary-order-summary__side">
                      <span className={STATUS_TAG_CLASS_NAMES[selectedOrder.status]}>{STATUS_LABELS[selectedOrder.status]}</span>
                      {selectedOrder.pushedNotaryOfficeName && (
                        <div className="external-notary-order-summary__office">已推送至：{selectedOrder.pushedNotaryOfficeName}</div>
                      )}
                    </div>
                  </section>

                  <div className="external-notary-create-layout external-notary-order-sheet">
                    <div className="external-notary-create-column">
                      <section className="external-notary-create-panel external-notary-order-panel external-notary-order-panel--product">
                        <div className="external-notary-create-panel__header">
                          <h3>产品信息</h3>
                        </div>
                        <div className="external-notary-form-grid">
                          <div className="form-group">
                            <label className="form-label">订单 ID</label>
                            <FieldValue value={selectedOrder.orderId} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">下单时间</label>
                            <FieldValue value={selectedOrder.createdAt} />
                          </div>
                          {isEditing ? (
                            <>
                              {renderEditableInput('产品类型', 'productName', {
                                type: 'select',
                                selectOptions: productOptions.map((product) => ({ label: product, value: product })),
                                placeholder: '请选择产品类型',
                              })}
                              {renderEditableInput('服务内容', 'serviceName', {
                                type: 'select',
                                selectOptions: serviceOptions,
                                placeholder: '请选择服务内容',
                              })}
                              {renderEditableInput('语言', 'language')}
                              {renderEditableInput('使用国家', 'useCountry', {
                                type: 'select',
                                selectOptions: countryOptions.map((country) => ({ label: country.name, value: country.name })),
                                placeholder: '请选择使用国家',
                              })}
                            </>
                          ) : (
                            <>
                              <div className="form-group">
                                <label className="form-label">产品类型</label>
                                <FieldValue value={selectedOrder.productName} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">服务内容</label>
                                <FieldValue value={selectedOrder.serviceName} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">语言</label>
                                <FieldValue value={selectedOrder.language} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">使用国家</label>
                                <FieldValue value={selectedOrder.useCountry} />
                              </div>
                            </>
                          )}
                        </div>
                      </section>

                      <section className="external-notary-create-panel external-notary-order-panel external-notary-order-panel--shipping">
                        <div className="external-notary-create-panel__header">
                          <h3>收货信息</h3>
                        </div>
                        <div className="external-notary-form-grid">
                          {isEditing ? (
                            <>
                              {renderEditableInput('收货地址', 'deliveryAddress', { full: true, rows: 4 })}
                              {renderEditableInput('电话号码', 'recipientPhone')}
                              {renderEditableInput('收件人姓名', 'recipientName')}
                            </>
                          ) : (
                            <>
                              <div className="form-group external-notary-form-grid__full">
                                <label className="form-label">收货地址</label>
                                <FieldValue value={selectedOrder.deliveryAddress} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">电话号码</label>
                                <FieldValue value={selectedOrder.recipientPhone} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">收件人姓名</label>
                                <FieldValue value={selectedOrder.recipientName || selectedOrder.customerName} />
                              </div>
                            </>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="external-notary-create-column external-notary-create-column--side">
                      <section className="external-notary-create-panel external-notary-order-panel external-notary-order-panel--license">
                        <div className="external-notary-create-panel__header">
                          <h3>驾照信息</h3>
                        </div>
                        <div className="external-notary-form-grid">
                          {isEditing ? (
                            <>
                              {renderEditableInput('驾驶证号码', 'licenseNo')}
                              {renderEditableInput('姓名', 'customerName')}
                              {renderEditableInput('姓氏拼音', 'surnamePinyin')}
                              {renderEditableInput('名字拼音', 'givenNamePinyin')}
                            </>
                          ) : (
                            <>
                              <div className="form-group">
                                <label className="form-label">驾驶证号码</label>
                                <FieldValue value={selectedOrder.licenseNo} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">姓名</label>
                                <FieldValue value={selectedOrder.customerName} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">姓氏拼音</label>
                                <FieldValue value={selectedOrder.surnamePinyin} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">名字拼音</label>
                                <FieldValue value={selectedOrder.givenNamePinyin} />
                              </div>
                            </>
                          )}
                        </div>
                      </section>

                      <section className="external-notary-create-panel external-notary-order-panel external-notary-order-panel--remark external-notary-remark-panel">
                        <div className="external-notary-create-panel__header">
                          <h3>备注</h3>
                        </div>
                        <div className="external-notary-form-grid">
                          {isEditing ? (
                            renderEditableInput('备注', 'remark', { full: true, rows: 5 })
                          ) : (
                            <div className="form-group external-notary-form-grid__full">
                              <label className="form-label">备注内容</label>
                              <div className="external-notary-remark-value">
                                <FieldValue value={selectedOrder.remark} />
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <section className="external-notary-create-panel external-notary-order-panel external-notary-order-panel--logistics external-notary-order-sheet__logistics">
                    <div className="external-notary-create-panel__header">
                      <h3>物流信息</h3>
                    </div>
                    <div className="external-notary-form-grid">
                      {selectedOrder.status === 'pushed' && !hasSubmittedLogistics ? (
                        <>
                          <div className="form-group">
                            <label className="form-label">物流公司</label>
                            <select
                              className={`form-select ${!logisticsForm.logisticsCompany ? 'external-notary-create-select--placeholder' : ''}`}
                              value={logisticsForm.logisticsCompany}
                              onChange={(event) => handleLogisticsFieldChange('logisticsCompany', event.target.value)}
                            >
                              <option value="">请选择物流公司</option>
                              {LOGISTICS_COMPANY_OPTIONS.map((company) => (
                                <option key={company} value={company}>
                                  {company}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">物流单号</label>
                            <input
                              className="form-input"
                              value={logisticsForm.trackingNumber}
                              placeholder="请输入物流单号"
                              onChange={(event) => handleLogisticsFieldChange('trackingNumber', event.target.value)}
                            />
                          </div>
                          <div className="form-group external-notary-form-grid__full">
                            <label className="form-label">提交物流信息</label>
                            <div className="external-notary-logistics-submit">
                              <button
                                className="btn btn--primary"
                                type="button"
                                onClick={handleSubmitLogistics}
                                disabled={!logisticsForm.logisticsCompany.trim() || !logisticsForm.trackingNumber.trim()}
                              >
                                提交物流信息
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="form-group">
                            <label className="form-label">物流公司</label>
                            <FieldValue value={selectedOrder.logisticsCompany} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">物流单号</label>
                            <FieldValue value={selectedOrder.trackingNumber} />
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                <section className="external-notary-create-panel external-notary-order-sheet__attachments">

                    <div className="external-notary-create-panel__header">
                      <h3>附件图片</h3>
                    </div>
                    <div className="external-notary-upload-grid">
                      {isEditing
                        ? UPLOAD_FIELDS.map((field) => {
                            const preview = editUploads[field.key];
                            const uploadInputId = `external-notary-edit-upload-${field.key}`;
                            return (
                              <div key={field.key} className={`external-notary-upload-card external-notary-upload-card--edit ${preview ? 'external-notary-upload-card--filled' : ''}`}>
                                {preview ? (
                                  <>
                                    <button
                                      type="button"
                                      className="external-notary-upload-card__preview external-notary-upload-card__preview--plain external-notary-upload-card__preview-button"
                                      onClick={() => setPreviewImage({ label: field.title, src: preview.src })}
                                    >
                                      <ResolvedImage src={preview.src} alt={`${field.title}预览`} />
                                    </button>
                                    <div className="external-notary-upload-card__content">
                                      <span className="external-notary-upload-card__label">{field.title}</span>
                                      <small>{preview.name}</small>
                                      <span className="external-notary-upload-card__hint">点击预览</span>
                                    </div>
                                    <div className="external-notary-upload-card__actions">
                                      <label className="external-notary-upload-card__action" htmlFor={uploadInputId}>
                                        更换
                                      </label>
                                      <button
                                        type="button"
                                        className="external-notary-upload-card__action external-notary-upload-card__action--danger"
                                        onClick={() => handleEditUploadRemove(field.key)}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <label className="external-notary-upload-card__empty" htmlFor={uploadInputId}>
                                    <span className="external-notary-upload-card__icon">+</span>
                                    <span className="external-notary-upload-card__label">{field.title}</span>
                                    <small>点击上传图片</small>
                                  </label>
                                )}
                                <input
                                  id={uploadInputId}
                                  className="external-notary-upload-card__input"
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => void handleEditUploadChange(field.key, event.target.files?.[0] ?? null)}
                                />
                              </div>
                            );
                          })
                        : UPLOAD_FIELDS.map((field) => {
                            const attachment = selectedOrder.attachments.find((item) => item.key === field.key);
                            const attachmentTitle = attachment?.title || ATTACHMENT_TITLES[field.key] || '??';

                            if (!attachment) {
                              return (
                                <div key={field.key} className="external-notary-attachment-tile">
                                  <div className="external-notary-attachment-tile__title">{attachmentTitle}</div>
                                  <div className="external-notary-attachment-tile__placeholder">
                                    <span>????</span>
                                    <small>????</small>
                                  </div>
                                </div>
                              );
                            }

                            const resolvedSource = resolvedAttachmentSources[attachment.key] || attachment.src;
                            return (
                              <div key={attachment.key} className="external-notary-attachment-tile">
                                <div className="external-notary-attachment-tile__title">{attachmentTitle}</div>
                                <button
                                  type="button"
                                  className="external-notary-upload-card external-notary-upload-card--filled external-notary-upload-card--preview-trigger external-notary-attachment-tile__button"
                                  onClick={() => setPreviewImage({ label: attachmentTitle, src: resolvedSource })}
                                >
                                  <span className="external-notary-upload-card__preview external-notary-upload-card__preview--plain">
                                    <img src={resolvedSource} alt={`${attachmentTitle}??`} />
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                    </div>
                    </section>
                  </div>
                </>
              )}
            </div>

            <div className="modal__footer external-notary-order-modal__footer">
              {modalMode === 'push' ? (
                <>
                  <button className="btn btn--secondary" type="button" onClick={closeOrderModal}>
                    取消
                  </button>
                  <button className="btn btn--primary" type="button" onClick={handlePushSubmit}>
                    确认推送
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <button className="btn btn--secondary" type="button" onClick={handleCancelEdit}>
                    取消
                  </button>
                  <button className="btn btn--primary" type="button" onClick={() => void handleSaveEdit()} disabled={isSaving}>
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn--secondary" type="button" onClick={closeOrderModal}>
                    关闭
                  </button>
                  {selectedOrder.status !== 'pushed' && (
                    <button className="btn btn--primary" type="button" onClick={handleStartEdit}>
                      修改
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="notary-preview-image-modal" onClick={(event) => event.stopPropagation()}>
            <div className="notary-preview-image-modal__header">
              <h3 className="notary-preview-image-modal__title">{previewImage.label}</h3>
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => setPreviewImage(null)}>
                关闭
              </button>
            </div>
            <div className="notary-preview-image-modal__body">
              <ResolvedImage className="notary-preview-image-modal__image" src={previewImage.src} alt={`${previewImage.label}大图预览`} />
            </div>
          </div>
        </div>
      )}

      {deleteTargetOrder && (
        <div className="modal-overlay" onClick={() => setDeleteTargetOrder(null)}>
          <div className="modal external-notary-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header external-notary-delete-modal__header">
              <h3 className="modal__title">确认删除</h3>
            </div>
            <div className="modal__body external-notary-delete-modal__body">
              <p>确认删除订单 {deleteTargetOrder.orderId} 吗？删除后不可恢复。</p>
            </div>
            <div className="modal__footer external-notary-delete-modal__footer">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteTargetOrder(null)}>
                取消
              </button>
              <button className="btn btn--primary external-notary-delete-modal__confirm" type="button" onClick={handleDeleteConfirm}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalNotaryOrderManagement;
