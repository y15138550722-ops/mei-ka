import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getOrders, updateOrder } from '../../services/mockDataService';
import {
  getLatestNotaryOfficeOrderByManagementOrderId,
  getNotaryOfficeOrdersByManagementOrderId,
  pushNotaryOrderToOffice,
  syncNotaryManagementShipment,
} from '../../services/notaryOfficeOrderService';
import ListUnifiedPagination from '../../shared/components/list/ListUnifiedPagination';
import ResolvedImage from '../../shared/components/ResolvedImage';
import { useTranslation } from '../../shared/i18n/config';
import type { AgentLevel, NotarySubmissionFile, NotarySubmissionImage, Order, OrderStatus, ProcessType } from '../../shared/types';
import { getCurrentAuthAccountId } from '../../shared/utils/auth';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { exportTranslationOrders } from '../../shared/utils/exportTranslationOrders';
import { resolveLocalImageSource } from '../../shared/utils/localImageStore';
import { buildNotaryImagesPdfBlob } from '../../shared/utils/notaryPreviewExport';
import { getProcessTypeTone, getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import { buildSpreadsheetPreviewHtml } from '../../shared/utils/spreadsheetPreview';
import { buildWordPreviewHtml } from '../../shared/utils/wordPreview';

type NotaryManagementStatus = 'pending_review' | 'pending_production' | 'shipped' | 'rejected' | 'cancelled';

type SubmissionMaterialImage = NotarySubmissionImage;

type SubmissionMaterialFile = NotarySubmissionFile;

type SubmissionFilePreviewKind = 'image' | 'pdf' | 'word' | 'spreadsheet' | 'unsupported';
type SubmissionFilePreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

type NotaryOrderRecordItem = {
  action: string;
  time?: string;
  officeName?: string;
  sequence?: number;
};

type NotaryOrderRecordLog = Order['logs'][number] & {
  officeName?: string;
};

type LogisticsForm = {
  logisticsCompany: string;
  trackingNumber: string;
};

const NOTARY_ORDER_MANAGEMENT_PATH = '/order-management/notary-orders';
const PREVIEW_ASSET_BASE_PATH = '/ETC/Notary%20Office%20Template/Preview%20file/yulan';
const IMAGE_MATERIAL_ACCEPT = 'image/*';
const FILE_MATERIAL_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.xltx,.xltm,.csv,.tsv,.png,.jpg,.jpeg,.webp,image/*';
const LOGISTICS_COMPANY_OPTIONS = ['顺丰速运', '京东物流', '邮政EMS', '圆通速递', '中通快递', '申通快递'];
const NOTARY_OFFICES = [
  { id: 'beibu-gulf', name: '北部湾公证处', district: '送审公证处' },
  { id: 'zhangjiang', name: '张江公证处', district: '送审公证处' },
  { id: 'dongbo', name: '东博公证处', district: '送审公证处' },
];

const SUBMISSION_ATTACHMENT_DISPLAY_ITEMS: Array<Pick<SubmissionMaterialImage, 'key' | 'label'>> = [
  { key: 'license-front', label: '驾驶证正面照片' },
  { key: 'license-back', label: '驾驶证反面照片' },
  { key: 'extra-front', label: '驾驶证副页正面照片' },
  { key: 'extra-back', label: '驾驶证副页反面照片' },
  { key: 'identity-front', label: '身份证正面' },
  { key: 'identity-back', label: '身份证反面' },
  { key: 'passport-front', label: '护照首页' },
  { key: 'passport-visa', label: '护照签证页' },
  { key: 'flight-itinerary', label: '行程单' },
  { key: 'digital-license', label: '电子驾照' },
  { key: 'signature', label: '电子签名' },
];
const SUBMISSION_ATTACHMENT_DISPLAY_ORDER = SUBMISSION_ATTACHMENT_DISPLAY_ITEMS.map((item) => item.key);
const SUBMISSION_ATTACHMENT_LABELS = new Map(
  SUBMISSION_ATTACHMENT_DISPLAY_ITEMS.map((item) => [item.key, item.label] as const),
);

const buildPreviewAssetPath = (fileName: string) => `${PREVIEW_ASSET_BASE_PATH}/${encodeURIComponent(fileName)}`;
const PASSPORT_TEMPLATE_IMAGE_SOURCES = [
  { src: buildPreviewAssetPath('passport-template-page-1.png') },
  { src: buildPreviewAssetPath('passport-template-page-2.png') },
];

const STATUS_TABS: Array<{ label: string; value: NotaryManagementStatus | '' }> = [
  { label: '全部订单', value: '' },
  { label: '待审核', value: 'pending_review' },
  { label: '待制作', value: 'pending_production' },
  { label: '已发货', value: 'shipped' },
  { label: '已取消', value: 'cancelled' },
  { label: '驳回', value: 'rejected' },
];

const NOTARY_PRODUCT_OPTIONS = ['公证单号', '公证双号', '公证海牙单号', '公证海牙双号'];

const PROCESS_TYPE_OPTIONS: Array<{ value: ProcessType; label: string }> = [
  { value: 'normal', label: '普通办理' },
  { value: 'priority', label: '优先办理' },
  { value: 'urgent', label: '加急办理' },
];

const NOTARY_SOURCE_STATUSES: OrderStatus[] = [
  'pending_review',
  'pending_production',
  'in_production',
  'shipped',
  'completed',
  'cancelled',
  'rejected',
];

const AGENT_NAMES: Record<AgentLevel, string> = {
  self: '美卡自营',
  l1: '上海美卡服务中心',
  l2: '常州语联翻译有限公司',
  l3: '深圳万里行服务中心',
};

const getInitialStatus = (value: string | null): NotaryManagementStatus | '' => {
  if (!value) return '';

  if (
    value === 'pending_review' ||
    value === 'pending_production' ||
    value === 'shipped' ||
    value === 'rejected' ||
    value === 'cancelled'
  ) {
    return value;
  }

  return '';
};

const getManagementStatus = (status: OrderStatus): NotaryManagementStatus => {
  const mapping: Record<OrderStatus, NotaryManagementStatus> = {
    translating: 'pending_review',
    pending_review: 'pending_review',
    pending_production: 'pending_production',
    in_production: 'pending_production',
    shipped: 'shipped',
    completed: 'shipped',
    cancelled: 'cancelled',
    rejected: 'rejected',
  };

  return mapping[status];
};

const getStatusTagClass = (status: NotaryManagementStatus) => {
  const mapping: Record<NotaryManagementStatus, string> = {
    pending_review: 'pending',
    pending_production: 'processing',
    shipped: 'shipped',
    rejected: 'rejected',
    cancelled: 'cancelled',
  };

  return `tag tag--${mapping[status]}`;
};

const getAgentName = (order: Order) => AGENT_NAMES[order.agentLevel] || '美卡自营';
const getLicenseName = (order: Order) => order.licenseName || order.customerName || '--';
const getLicenseNo = (order: Order) => order.licenseNo || order.customerPassport || '--';
const getLicenseCategory = (order: Order) => order.licenseCategory || '--';

const getSubmissionMaterialImages = (order: Order): SubmissionMaterialImage[] => {
  if (order.notarySubmissionImages?.length) {
    return order.notarySubmissionImages.map((image) => ({ ...image }));
  }

  const images = order.notaryCertificateImages || {};
  const knownImages = SUBMISSION_ATTACHMENT_DISPLAY_ORDER.flatMap((key) => {
    const src = images[key];
    return src
      ? [
          {
            key,
            label: SUBMISSION_ATTACHMENT_LABELS.get(key) || key,
            src,
          },
        ]
      : [];
  });
  const unknownImages = Object.entries(images)
    .filter(([key, src]) => Boolean(src) && !SUBMISSION_ATTACHMENT_LABELS.has(key))
    .map(([key, src]) => ({
      key,
      label: key,
      src,
    }));

  return [...knownImages, ...unknownImages];
};

const getSubmissionMaterialFiles = (order: Order): SubmissionMaterialFile[] => {
  if (order.notarySubmissionFiles?.length) {
    return order.notarySubmissionFiles.map((file) => ({ ...file }));
  }

  const baseName = getLicenseName(order) === '--' ? order.orderId : getLicenseName(order);

  return [
    {
      key: 'power-of-attorney',
      label: '委托书',
      name: `${baseName}委托书.docx`,
      path: buildPreviewAssetPath('Power of Attorney.docx'),
      type: 'DOCX',
    },
    {
      key: 'passport-pdf',
      label: '护照',
      name: `${baseName}护照.pdf`,
      path: '',
      message: '正在根据模板和录单附件生成',
      status: 'loading',
      type: 'PDF',
    },
    {
      key: 'flight-itinerary-pdf',
      label: '行程单',
      name: `${baseName}的行程单.pdf`,
      path: '',
      message: '正在根据录单附件生成',
      status: 'loading',
      type: 'PDF',
    },
    {
      key: 'scanned-copy',
      label: '证件扫描件',
      name: `${baseName}证件扫描件.pdf`,
      path: buildPreviewAssetPath('Scanned copy.pdf'),
      type: 'PDF',
    },
    {
      key: 'notarized-document',
      label: '公证模板文件',
      name: `${baseName}公证模板文件.pdf`,
      path: buildPreviewAssetPath('Notarized Document.pdf'),
      type: 'PDF',
    },
  ];
};

const joinSegments = (segments: Array<string | undefined>) =>
  segments.filter((segment): segment is string => Boolean(segment && segment.trim())).join('，');

const getRecipientInfo = (order: Order) =>
  joinSegments([
    `收件人：${order.customerName}`,
    order.customerPhone ? `手机号：${order.customerPhone}` : undefined,
    order.deliveryAddress ? `地址：${order.deliveryAddress}` : undefined,
  ]);

const getLicenseInfo = (order: Order) =>
  joinSegments([
    `姓名：${getLicenseName(order)}`,
    getLicenseNo(order) ? `驾照号：${getLicenseNo(order)}` : undefined,
    getLicenseCategory(order) ? `准驾车型：${getLicenseCategory(order)}` : undefined,
  ]);

const getLogisticsInfo = (order: Order) =>
  joinSegments([
    order.logisticsCompany ? `物流公司：${order.logisticsCompany}` : undefined,
    order.trackingNumber ? `物流单号：${order.trackingNumber}` : undefined,
  ]);

const getPushedNotaryOfficeName = (order: Order) => {
  const directName = order.pushedNotaryOfficeName?.trim();
  const hasSubmissionLog = order.logs.some((log) => /送审/.test(log.action));
  if (directName && hasSubmissionLog) {
    return directName;
  }

  const pushLog = [...order.logs].reverse().find((log) => /送审至/.test(log.action));
  const matchedName = pushLog?.action.match(/送审至(.+?)(?:，|,|$)/)?.[1]?.trim();
  return matchedName || '--';
};

const getProductionDisplayNotaryOfficeName = (order: Order) =>
  order.productionDisplayNotaryOfficeName?.trim() ||
  order.auditSelectedNotaryOfficeName?.trim() ||
  order.pushedNotaryOfficeName?.trim() ||
  '--';

const NOTARY_OFFICE_REJECTION_PATTERN = /公证处审核驳回|公证处.*驳回/;
const NOTARY_OFFICE_SUBMISSION_PATTERN = /送审至|公证处已接收/;
const NOTARY_OFFICE_APPROVAL_PATTERN = /公证处审核通过|审核通过，进入制作中|公证处.*审核通过/;
const NOTARY_OFFICE_COMPLETION_PATTERN = /公证处制作完成/;

const findLatestOrderLog = <T extends Order['logs'][number]>(logs: T[], pattern: RegExp) =>
  [...logs].reverse().find((log) => pattern.test(log.action));

const getRelatedNotaryOfficeOrders = (order: Order) => getNotaryOfficeOrdersByManagementOrderId(order.orderId);

const getLatestRelatedNotaryOfficeOrder = (order: Order) => getLatestNotaryOfficeOrderByManagementOrderId(order.orderId) || null;

const getRelatedNotaryOfficeLogs = (order: Order, officeOrders = getRelatedNotaryOfficeOrders(order)) =>
  officeOrders.flatMap((officeOrder) => officeOrder.logs);

const getNotaryOfficeOrderOfficeName = (officeOrder: Order) =>
  officeOrder.pushedNotaryOfficeName?.trim() ||
  officeOrder.productionDisplayNotaryOfficeName?.trim() ||
  officeOrder.auditSelectedNotaryOfficeName?.trim() ||
  '--';

const getCombinedOrderRecordLogs = (order: Order, officeOrders = getRelatedNotaryOfficeOrders(order)) => {
  const managementLogs: NotaryOrderRecordLog[] = order.logs.map((log) => ({
    ...log,
    officeName: getOrderRecordOfficeName(log.action, getProductionDisplayNotaryOfficeName(order)),
  }));
  const officeLogs: NotaryOrderRecordLog[] = officeOrders.flatMap((officeOrder) => {
    const officeName = getNotaryOfficeOrderOfficeName(officeOrder);

    return officeOrder.logs.map((log) => ({
      ...log,
      officeName: getOrderRecordOfficeName(log.action, officeName),
    }));
  });

  return getSortedUniqueOrderLogs([...managementLogs, ...officeLogs]);
};

const hasSubmittedToNotaryOffice = (order: Order, officeOrders = getRelatedNotaryOfficeOrders(order)) => {
  const combinedLogs = [...order.logs, ...getRelatedNotaryOfficeLogs(order, officeOrders)];
  return Boolean(
    findLatestOrderLog(combinedLogs, /送审至|公证处已接收/) ||
      officeOrders.some((officeOrder) =>
        officeOrder.logs.some((log) => /审核通过，进入制作中|公证处.*审核/.test(log.action)),
      ),
  );
};

const hasNotaryOfficeCompletion = (order: Order) => {
  const officeOrders = getRelatedNotaryOfficeOrders(order);
  const latestOfficeOrder = getLatestRelatedNotaryOfficeOrder(order);
  const combinedLogs = [...getRelatedNotaryOfficeLogs(order, officeOrders), ...order.logs];
  const submissionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_SUBMISSION_PATTERN);
  const rejectionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_REJECTION_PATTERN);
  const completionLog = findLatestOrderLog(combinedLogs, /公证处制作完成|待物流发货/);
  const hasActiveCompletionLog = Boolean(
    completionLog &&
      (!submissionLog || isLogAtOrAfter(completionLog.time, submissionLog.time)) &&
      (!rejectionLog || isLogAtOrAfter(completionLog.time, rejectionLog.time)),
  );
  const hasActiveCompletedStatus = Boolean(
    hasSubmittedToNotaryOffice(order, officeOrders) &&
      (latestOfficeOrder?.status === 'completed' || latestOfficeOrder?.status === 'shipped') &&
      (!rejectionLog || isLogAtOrAfter(latestOfficeOrder?.updatedAt, rejectionLog.time)),
  );

  return (
    hasActiveCompletionLog ||
    hasActiveCompletedStatus
  );
};

const hasNotaryOfficeApproval = (order: Order) => {
  const officeOrders = getRelatedNotaryOfficeOrders(order);
  const latestOfficeOrder = getLatestRelatedNotaryOfficeOrder(order);
  return (
    Boolean(
      findLatestOrderLog(
        [...getRelatedNotaryOfficeLogs(order, officeOrders), ...order.logs],
        /审核通过，进入制作中|公证处.*审核通过/,
      ),
    ) ||
    (hasSubmittedToNotaryOffice(order, officeOrders) && latestOfficeOrder?.status === 'in_production') ||
    hasNotaryOfficeCompletion(order)
  );
};

const isLogAtOrAfter = (leftTime: string | undefined, rightTime: string | undefined) => {
  const normalizedLeftTime = getOrderRecordTime(leftTime);
  const normalizedRightTime = getOrderRecordTime(rightTime);

  if (!normalizedLeftTime || !normalizedRightTime) {
    return Boolean(normalizedLeftTime);
  }

  return normalizedLeftTime >= normalizedRightTime;
};

const hasNotaryOfficeRejection = (order: Order, officeOrders = getRelatedNotaryOfficeOrders(order)) => {
  const latestOfficeOrder = getLatestRelatedNotaryOfficeOrder(order);
  const combinedLogs = [...order.logs, ...getRelatedNotaryOfficeLogs(order, officeOrders)];
  const submissionLog = findLatestOrderLog(combinedLogs, /送审至|公证处已接收/);
  const rejectionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_REJECTION_PATTERN);
  const hasOfficeOrderRejection = Boolean(
    hasSubmittedToNotaryOffice(order, officeOrders) &&
      isLogAtOrAfter(latestOfficeOrder?.updatedAt, submissionLog?.time) &&
      latestOfficeOrder?.status === 'rejected',
  );

  return Boolean(
    (rejectionLog && isLogAtOrAfter(rejectionLog.time, submissionLog?.time)) ||
      hasOfficeOrderRejection,
  );
};

const getVisibleManagementStatus = (order: Order): NotaryManagementStatus => {
  const baseStatus = getManagementStatus(order.status);

  if (baseStatus === 'rejected' || baseStatus === 'cancelled' || baseStatus === 'shipped') {
    return baseStatus;
  }

  return hasNotaryOfficeRejection(order) ? 'rejected' : baseStatus;
};

const hasAnyNotaryOfficeRejectionRecord = (
  order: Order,
  officeOrders = getRelatedNotaryOfficeOrders(order),
) => {
  const combinedLogs = [...order.logs, ...getRelatedNotaryOfficeLogs(order, officeOrders)];
  const rejectionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_REJECTION_PATTERN);
  const hasNotaryOfficeContext = Boolean(
    order.pushedNotaryOfficeName?.trim() ||
      order.productionDisplayNotaryOfficeName?.trim() ||
      order.auditSelectedNotaryOfficeName?.trim() ||
      officeOrders.length > 0 ||
      findLatestOrderLog(combinedLogs, NOTARY_OFFICE_SUBMISSION_PATTERN),
  );

  return Boolean(
    rejectionLog ||
      (hasNotaryOfficeContext && (order.rejectReason?.trim() || order.remark?.trim())) ||
      officeOrders.some((officeOrder) => officeOrder.status === 'rejected'),
  );
};

const shouldShowNotarySubmissionAction = (order: Order) => {
  const officeOrders = getRelatedNotaryOfficeOrders(order);
  const latestOfficeOrder = getLatestRelatedNotaryOfficeOrder(order);
  const visibleStatus = getManagementStatus(order.status);

  if (visibleStatus !== 'pending_production') {
    return false;
  }

  if (
    latestOfficeOrder &&
    latestOfficeOrder.status !== 'rejected' &&
    latestOfficeOrder.status !== 'cancelled'
  ) {
    return false;
  }

  if (hasAnyNotaryOfficeRejectionRecord(order, officeOrders) || hasNotaryOfficeRejection(order, officeOrders)) {
    return true;
  }

  return (
    !hasNotaryOfficeApproval(order) &&
    !hasSubmittedToNotaryOffice(order, officeOrders)
  );
};

const getRejectReason = (order: Order) => {
  const directReason = order.rejectReason?.trim();
  if (directReason) {
    return directReason;
  }

  if (
    order.remark?.trim() &&
    (getManagementStatus(order.status) === 'rejected' || getManagementStatus(order.status) === 'cancelled')
  ) {
    return order.remark.trim();
  }

  const rejectLog = [...order.logs].reverse().find((log) => /驳回|拒绝/.test(log.action));
  if (!rejectLog) {
    return '--';
  }

  const matchedReason = rejectLog.action.match(/(?:驳回|拒绝)[：:]\s*(.+)$/)?.[1]?.trim();
  return matchedReason || rejectLog.action;
};

const getOrderRecordTime = (...parts: Array<string | undefined>) =>
  parts
    .map((part) => {
      const value = part?.trim();
      if (!value) {
        return undefined;
      }

      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
        return `${value}:00`;
      }

      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return value;
      }

      const parsedTime = Date.parse(value);
      return Number.isNaN(parsedTime) ? value : formatBeijingTimestamp(parsedTime);
    })
    .find(Boolean);

const getSortedUniqueOrderLogs = <T extends Order['logs'][number]>(logs: T[]) => {
  const seenLogKeys = new Set<string>();

  return logs
    .filter((log) => {
      const key = [getOrderRecordTime(log.time) || '', log.operator || '', log.action || ''].join('|');
      if (seenLogKeys.has(key)) {
        return false;
      }

      seenLogKeys.add(key);
      return true;
    })
    .sort((left, right) => (getOrderRecordTime(left.time) || '').localeCompare(getOrderRecordTime(right.time) || ''));
};

const getOrderRecordOfficeName = (logAction: string | undefined, fallbackOfficeName: string) => {
  const action = logAction?.trim() || '';
  const matchedName =
    action.match(/送审至(.+?)(?:，|,|$)/)?.[1]?.trim() ||
    action.match(/公证处已接收：(.+?)(?:，|,|$)/)?.[1]?.trim() ||
    action.match(/^(.+?公证处)审核(?:通过|驳回)/)?.[1]?.trim() ||
    action.match(/^(.+?公证处)公证处制作完成/)?.[1]?.trim();

  return matchedName || fallbackOfficeName;
};

const pushOrderRecordItem = (records: NotaryOrderRecordItem[], record: NotaryOrderRecordItem) => {
  const recordKey = [record.action, record.time || '', record.officeName || ''].join('|');
  const hasSameRecord = records.some(
    (currentRecord) =>
      [currentRecord.action, currentRecord.time || '', currentRecord.officeName || ''].join('|') === recordKey,
  );

  if (!hasSameRecord) {
    records.push({ ...record, sequence: records.length });
  }
};

const sortOrderRecordItems = (records: NotaryOrderRecordItem[]) =>
  [...records].sort((left, right) => {
    const leftTime = left.time || '';
    const rightTime = right.time || '';
    if (leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime);
    }

    return (left.sequence || 0) - (right.sequence || 0);
  });

const getOrderRecordItems = (order: Order): NotaryOrderRecordItem[] => {
  const officeOrders = getRelatedNotaryOfficeOrders(order);
  const latestOfficeOrder = getLatestRelatedNotaryOfficeOrder(order);
  const combinedLogs = getCombinedOrderRecordLogs(order, officeOrders);
  const submissionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_SUBMISSION_PATTERN);
  const approvalLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_APPROVAL_PATTERN);
  const rejectionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_REJECTION_PATTERN);
  const completionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_COMPLETION_PATTERN);
  const hasOfficeOrderRejection = Boolean(
    hasSubmittedToNotaryOffice(order, officeOrders) &&
      isLogAtOrAfter(latestOfficeOrder?.updatedAt, submissionLog?.time) &&
      latestOfficeOrder?.status === 'rejected',
  );
  const hasRejectionAfterSubmission = Boolean(
    (rejectionLog && (!submissionLog || isLogAtOrAfter(rejectionLog.time, submissionLog.time))) ||
      hasOfficeOrderRejection,
  );
  const hasApprovalAfterSubmission = Boolean(
    submissionLog && approvalLog && isLogAtOrAfter(approvalLog.time, submissionLog.time),
  );
  const hasCompletionAfterApproval = Boolean(
    submissionLog && approvalLog && completionLog && isLogAtOrAfter(completionLog.time, approvalLog.time),
  );
  const rejectionRecordTime = getOrderRecordTime(
    rejectionLog?.time,
    hasOfficeOrderRejection ? latestOfficeOrder?.updatedAt : undefined,
  );
  const officeName =
    submissionLog?.action.match(/(?:送审至|公证处已接收：)(.+?)(?:，|,|$)/)?.[1]?.trim() ||
    submissionLog?.officeName?.trim() ||
    order.pushedNotaryOfficeName?.trim() ||
    latestOfficeOrder?.pushedNotaryOfficeName?.trim() ||
    getProductionDisplayNotaryOfficeName(order);
  const records: NotaryOrderRecordItem[] = [];

  combinedLogs.forEach((log) => {
    const recordOfficeName = getOrderRecordOfficeName(log.action, log.officeName || officeName);
    const recordTime = getOrderRecordTime(log.time);

    if (NOTARY_OFFICE_SUBMISSION_PATTERN.test(log.action)) {
      pushOrderRecordItem(records, {
        action: '已送审-审核中',
        time: recordTime,
        officeName: recordOfficeName,
      });
    }

    if (NOTARY_OFFICE_REJECTION_PATTERN.test(log.action)) {
      pushOrderRecordItem(records, {
        action: '审核驳回',
        time: recordTime,
        officeName: recordOfficeName,
      });
    }

    if (NOTARY_OFFICE_APPROVAL_PATTERN.test(log.action)) {
      pushOrderRecordItem(records, {
        action: '审核通过--制作中',
        time: recordTime,
        officeName: recordOfficeName,
      });
    }

    if (NOTARY_OFFICE_COMPLETION_PATTERN.test(log.action)) {
      pushOrderRecordItem(records, {
        action: '制作完成',
        time: recordTime,
        officeName: recordOfficeName,
      });
    }
  });

  if (hasRejectionAfterSubmission && rejectionRecordTime) {
    pushOrderRecordItem(records, {
      action: '审核驳回',
      time: rejectionRecordTime,
      officeName,
    });
  }

  if (hasApprovalAfterSubmission && records.every((record) => record.action !== '审核通过--制作中')) {
    pushOrderRecordItem(records, {
      action: '审核通过--制作中',
      time: getOrderRecordTime(approvalLog?.time),
      officeName,
    });
  }

  if (hasCompletionAfterApproval && records.every((record) => record.action !== '制作完成')) {
    pushOrderRecordItem(records, {
      action: '制作完成',
      time: getOrderRecordTime(completionLog?.time),
      officeName,
    });
  }

  return sortOrderRecordItems(records);
};

const getShippedSortValue = (order: Order) => {
  if (order.shippedAt?.trim()) {
    return order.shippedAt.trim();
  }

  const logisticsLog = [...order.logs].reverse().find((log) => /物流|发货/.test(log.action));
  if (logisticsLog?.time?.trim()) {
    return logisticsLog.time.trim();
  }

  return order.updatedAt || order.createdAt || '';
};

const getOrderProcessTypeLabel = (order: Order, translate: (key: string) => string) =>
  getProductProcessTypeLabel(order.processType, translate);

const getOrderProcessLineClassName = (order: Order) =>
  `order-process-line order-process-line--${getProcessTypeTone(order.processType)}`;

const buildExportFileName = () => {
  const timestamp = formatBeijingTimestamp().replace(/\s+/g, '_').replace(/:/g, '-');
  return `公证订单管理_${timestamp}.xlsx`;
};

const getExportErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message.includes('template')) {
      return '导出模板加载失败';
    }

    if (
      error.message.includes('initialize Excel export module') ||
      error.message.includes('load Excel export runtime')
    ) {
      return '导出组件加载失败';
    }
  }

  return '导出失败，请稍后重试';
};

const getUploadedFileType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.trim();

  return extension ? extension.toUpperCase() : 'FILE';
};

const buildUploadedMaterialKey = (prefix: string, file: File, index: number) =>
  `${prefix}-${Date.now()}-${index}-${file.name}`;

const buildMaterialInputId = (prefix: string, key: string) =>
  `${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const IMAGE_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

const getSubmissionFileExtension = (file: SubmissionMaterialFile) => {
  const source = file.name || file.path || file.type;
  const extension = source.split(/[?#]/)[0].split('.').pop()?.trim().toLowerCase();
  return extension || file.type.toLowerCase();
};

const getSubmissionFilePreviewKind = (file: SubmissionMaterialFile): SubmissionFilePreviewKind => {
  const extension = getSubmissionFileExtension(file);

  if (IMAGE_FILE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (extension === 'pdf') {
    return 'pdf';
  }

  if (extension === 'doc' || extension === 'docx') {
    return 'word';
  }

  if (['xls', 'xlsx', 'xlsm', 'xltx', 'xltm', 'csv', 'tsv'].includes(extension)) {
    return 'spreadsheet';
  }

  return 'unsupported';
};

const fetchSubmissionFileBuffer = async (file: SubmissionMaterialFile) => {
  const response = await fetch(file.path);
  if (!response.ok) {
    throw new Error(`Failed to load ${file.name}`);
  }

  return response.arrayBuffer();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getPowerOfAttorneySignatureSource = (order?: Order | null) =>
  order?.notaryCertificateImages?.signature?.trim() || '';

const buildSignatureReplacementHtml = async (signatureSource: string) => {
  const resolvedSignatureSource = await resolveLocalImageSource(signatureSource);

  if (!resolvedSignatureSource) {
    return '';
  }

  return `<span style="display:inline-block;min-width:150px;vertical-align:middle;"><img src="${escapeHtml(
    resolvedSignatureSource,
  )}" alt="电子签名" style="display:inline-block;max-width:180px;max-height:72px;object-fit:contain;vertical-align:middle;" /></span>`;
};

const replaceOmittedDocxImagesWithSignature = async (html: string, signatureSource: string) => {
  if (!signatureSource) {
    return html;
  }

  const signatureReplacement = await buildSignatureReplacementHtml(signatureSource);
  if (!signatureReplacement) {
    return html;
  }

  return [
    '[Embedded image omitted in generated DOCX]',
    '[Embedded Image omitted in generated DOCX]',
  ].reduce((nextHtml, placeholder) => nextHtml.split(placeholder).join(signatureReplacement), html);
};

const buildWordSubmissionPreviewHtml = async (file: SubmissionMaterialFile, order?: Order | null) => {
  const buffer = await fetchSubmissionFileBuffer(file);
  const html = await buildWordPreviewHtml(buffer, { documentPath: file.path, title: file.name });

  return replaceOmittedDocxImagesWithSignature(html, getPowerOfAttorneySignatureSource(order));
};

const buildXlsxSubmissionPreviewHtml = async (file: SubmissionMaterialFile) => {
  const buffer = await fetchSubmissionFileBuffer(file);
  return buildSpreadsheetPreviewHtml(buffer, file.name);
};

const NotaryOrderManagementList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentAccountId = useMemo(() => getCurrentAuthAccountId(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = useMemo(() => getInitialStatus(searchParams.get('status')), [searchParams]);
  const [ordersRevision, setOrdersRevision] = useState(0);

  const notaryOrders = useMemo(
    () =>
      getOrders()
        .filter(
          (order) =>
            order.productCategory === 'notary' &&
            NOTARY_SOURCE_STATUSES.includes(order.status),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [ordersRevision],
  );

  const [activeStatus, setActiveStatus] = useState<NotaryManagementStatus | ''>(initialStatus);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterProcessType, setFilterProcessType] = useState<ProcessType | ''>('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submissionPreviewOrder, setSubmissionPreviewOrder] = useState<Order | null>(null);
  const [selectedSubmissionOfficeId, setSelectedSubmissionOfficeId] = useState('');
  const [submissionImages, setSubmissionImages] = useState<SubmissionMaterialImage[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionMaterialFile[]>([]);
  const [previewSubmissionFileKey, setPreviewSubmissionFileKey] = useState<string | null>(null);
  const [submissionFilePreviewHtml, setSubmissionFilePreviewHtml] = useState('');
  const [submissionFilePreviewStatus, setSubmissionFilePreviewStatus] = useState<SubmissionFilePreviewStatus>('idle');
  const [logisticsOrder, setLogisticsOrder] = useState<Order | null>(null);
  const [logisticsForm, setLogisticsForm] = useState<LogisticsForm>({ logisticsCompany: '', trackingNumber: '' });
  const generatedSubmissionFileUrlsRef = useRef<string[]>([]);
  const submissionGenerationIdRef = useRef(0);

  const revokeGeneratedSubmissionFileUrls = () => {
    generatedSubmissionFileUrlsRef.current.forEach((url) => window.URL.revokeObjectURL(url));
    generatedSubmissionFileUrlsRef.current = [];
  };

  useEffect(() => {
    setActiveStatus(initialStatus);
    setCurrentPage(1);
  }, [initialStatus]);

  useEffect(
    () => () => {
      submissionGenerationIdRef.current += 1;
      revokeGeneratedSubmissionFileUrls();
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const previewSubmissionFile = useMemo(
    () => submissionFiles.find((file) => file.key === previewSubmissionFileKey) || null,
    [previewSubmissionFileKey, submissionFiles],
  );

  const previewSubmissionFileKind = previewSubmissionFile
    ? getSubmissionFilePreviewKind(previewSubmissionFile)
    : 'unsupported';

  useEffect(() => {
    if (!previewSubmissionFile) {
      setSubmissionFilePreviewHtml('');
      setSubmissionFilePreviewStatus('idle');
      return;
    }

    if (previewSubmissionFileKind !== 'word' && previewSubmissionFileKind !== 'spreadsheet') {
      setSubmissionFilePreviewHtml('');
      setSubmissionFilePreviewStatus('ready');
      return;
    }

    let cancelled = false;
    setSubmissionFilePreviewHtml('');
    setSubmissionFilePreviewStatus('loading');

    const loadPreview = async () => {
      try {
        const html =
          previewSubmissionFileKind === 'word'
            ? await buildWordSubmissionPreviewHtml(previewSubmissionFile, submissionPreviewOrder)
            : await buildXlsxSubmissionPreviewHtml(previewSubmissionFile);

        if (!cancelled) {
          setSubmissionFilePreviewHtml(html);
          setSubmissionFilePreviewStatus('ready');
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSubmissionFilePreviewHtml('');
          setSubmissionFilePreviewStatus('error');
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [previewSubmissionFile, previewSubmissionFileKind, submissionPreviewOrder]);

  const filteredOrders = useMemo(() => {
    const agentKeyword = filterAgent.trim().toLowerCase();
    const exactKeyword = filterKeyword.trim().toLowerCase();

    const nextOrders = notaryOrders.filter((order) => {
      const visibleStatus = getVisibleManagementStatus(order);
      const createdDate = order.createdAt.slice(0, 10);
      const agentName = getAgentName(order).toLowerCase();

      if (activeStatus && visibleStatus !== activeStatus) return false;
      if (filterProduct && order.productName !== filterProduct) return false;
      if (filterProcessType && getProcessTypeTone(order.processType) !== filterProcessType) return false;
      if (filterStartDate && createdDate < filterStartDate) return false;
      if (filterEndDate && createdDate > filterEndDate) return false;
      if (agentKeyword && !agentName.includes(agentKeyword)) return false;

      if (exactKeyword) {
        const searchPool = [
          order.orderId,
          order.customerName,
          order.customerPhone,
          order.deliveryAddress,
          order.licenseName,
          order.licenseNo,
          getPushedNotaryOfficeName(order),
          getProductionDisplayNotaryOfficeName(order),
          order.trackingNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchPool.includes(exactKeyword)) {
          return false;
        }
      }

      return true;
    });

    if (activeStatus === 'shipped') {
      return [...nextOrders].sort((left, right) => getShippedSortValue(right).localeCompare(getShippedSortValue(left)));
    }

    return nextOrders;
  }, [
    activeStatus,
    filterAgent,
    filterEndDate,
    filterKeyword,
    filterProcessType,
    filterProduct,
    filterStartDate,
    notaryOrders,
  ]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': notaryOrders.length };

    STATUS_TABS.forEach((tab) => {
      if (!tab.value) {
        return;
      }

      counts[tab.value] = notaryOrders.filter((order) => getVisibleManagementStatus(order) === tab.value).length;
    });

    return counts;
  }, [notaryOrders]);

  const showRejectReasonColumn = activeStatus === 'rejected';
  const orderTableColumnCount = showRejectReasonColumn ? 10 : 9;
  const activeFilterCount = [
    filterAgent.trim(),
    filterProduct,
    filterProcessType,
    filterStartDate,
    filterEndDate,
    filterKeyword.trim(),
  ].filter(Boolean).length;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  const applyGeneratedSubmissionFileUpdate = (
    generationId: number,
    key: string,
    update: Pick<SubmissionMaterialFile, 'path' | 'status' | 'message'>,
  ) => {
    const generatedPath = update.path;
    if (generationId !== submissionGenerationIdRef.current) {
      if (generatedPath?.startsWith('blob:')) {
        window.URL.revokeObjectURL(generatedPath);
      }
      return;
    }

    if (generatedPath?.startsWith('blob:')) {
      generatedSubmissionFileUrlsRef.current.push(generatedPath);
    }

    setSubmissionFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.key === key
          ? {
              ...file,
              ...update,
            }
          : file,
      ),
    );
  };

  const generateSubmissionPdfFiles = async (order: Order, generationId: number) => {
    const images = order.notaryCertificateImages || {};
    const passportFront = images['passport-front']?.trim();
    const passportVisa = images['passport-visa']?.trim();
    const flightItinerary = images['flight-itinerary']?.trim();

    try {
      if (!passportFront) {
        throw new Error('Missing passport front image');
      }

      const passportSources = [
        ...PASSPORT_TEMPLATE_IMAGE_SOURCES,
        { src: passportFront },
        ...(passportVisa ? [{ src: passportVisa }] : []),
      ];
      const passportBlob = await buildNotaryImagesPdfBlob(passportSources);
      applyGeneratedSubmissionFileUpdate(generationId, 'passport-pdf', {
        message: '根据护照模板和录单附件生成',
        path: window.URL.createObjectURL(passportBlob),
        status: 'ready',
      });
    } catch (error) {
      applyGeneratedSubmissionFileUpdate(generationId, 'passport-pdf', {
        message: '缺少护照首页，无法生成',
        path: '',
        status: 'error',
      });
    }

    try {
      if (!flightItinerary) {
        throw new Error('Missing flight itinerary image');
      }

      const flightBlob = await buildNotaryImagesPdfBlob([{ src: flightItinerary }]);
      applyGeneratedSubmissionFileUpdate(generationId, 'flight-itinerary-pdf', {
        message: '根据录单上传的行程单生成',
        path: window.URL.createObjectURL(flightBlob),
        status: 'ready',
      });
    } catch (error) {
      applyGeneratedSubmissionFileUpdate(generationId, 'flight-itinerary-pdf', {
        message: '缺少行程单附件，无法生成',
        path: '',
        status: 'error',
      });
    }
  };

  const handleStatusChange = (status: NotaryManagementStatus | '') => {
    setActiveStatus(status);
    setCurrentPage(1);
    setSearchParams(status ? { status } : {});
  };

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilterAgent('');
    setFilterProduct('');
    setFilterProcessType('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterKeyword('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      await exportTranslationOrders(
        filteredOrders.map((order) => ({
          orderId: order.orderId,
          createdAt: order.createdAt,
          productName: `${order.productName} / ${getOrderProcessTypeLabel(order, t)}`,
          processTypeLabel: getOrderProcessTypeLabel(order, t),
          agentName: getAgentName(order),
          recipientInfo: getRecipientInfo(order),
          licenseInfo: getLicenseInfo(order),
          statusLabel: t(`order.status.${getVisibleManagementStatus(order)}`),
          logisticsInfo: getLogisticsInfo(order),
          price: order.lockedPrice,
          primaryAccount: '',
        })),
        buildExportFileName(),
      );

      showToast('success', '导出成功');
    } catch (error) {
      console.error(error);
      showToast('error', getExportErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenSubmissionPreview = (order: Order) => {
    revokeGeneratedSubmissionFileUrls();
    submissionGenerationIdRef.current += 1;
    const generationId = submissionGenerationIdRef.current;

    setSubmissionPreviewOrder(order);
    setSelectedSubmissionOfficeId(
      order.pushedNotaryOfficeId ||
        order.productionDisplayNotaryOfficeId ||
        order.auditSelectedNotaryOfficeId ||
        '',
    );
    setSubmissionImages(getSubmissionMaterialImages(order));
    setSubmissionFiles(getSubmissionMaterialFiles(order));
    void generateSubmissionPdfFiles(order, generationId);
  };

  const handleCloseSubmissionPreview = () => {
    submissionGenerationIdRef.current += 1;
    revokeGeneratedSubmissionFileUrls();
    setSubmissionPreviewOrder(null);
    setSelectedSubmissionOfficeId('');
    setSubmissionImages([]);
    setSubmissionFiles([]);
    setPreviewSubmissionFileKey(null);
  };

  const handleCloseSubmittedPreview = () => {
    submissionGenerationIdRef.current += 1;
    generatedSubmissionFileUrlsRef.current = [];
    setSubmissionPreviewOrder(null);
    setSelectedSubmissionOfficeId('');
    setSubmissionImages([]);
    setSubmissionFiles([]);
    setPreviewSubmissionFileKey(null);
  };

  const handleAddSubmissionImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setSubmissionImages((currentImages) => [
      ...currentImages,
      ...files.map((file, index) => ({
        key: buildUploadedMaterialKey('uploaded-image', file, index),
        label: file.name,
        src: URL.createObjectURL(file),
      })),
    ]);
    event.target.value = '';
  };

  const handleReplaceSubmissionImage = (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSubmissionImages((currentImages) =>
      currentImages.map((item) =>
        item.key === key
          ? {
              ...item,
              label: file.name,
              src: URL.createObjectURL(file),
            }
          : item,
      ),
    );
    event.target.value = '';
  };

  const handleDeleteSubmissionImage = (key: string) => {
    setSubmissionImages((currentImages) => currentImages.filter((item) => item.key !== key));
  };

  const handleAddSubmissionFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setSubmissionFiles((currentFiles) => [
      ...currentFiles,
      ...files.map((file, index) => ({
        key: buildUploadedMaterialKey('uploaded-file', file, index),
        label: file.name,
        message: undefined,
        name: file.name,
        path: URL.createObjectURL(file),
        status: 'ready' as const,
        type: getUploadedFileType(file.name),
      })),
    ]);
    event.target.value = '';
  };

  const handleReplaceSubmissionFile = (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSubmissionFiles((currentFiles) =>
      currentFiles.map((item) =>
        item.key === key
          ? {
              ...item,
              label: file.name,
              message: undefined,
              name: file.name,
              path: URL.createObjectURL(file),
              status: 'ready' as const,
              type: getUploadedFileType(file.name),
            }
          : item,
      ),
    );
    event.target.value = '';
  };

  const handleDeleteSubmissionFile = (key: string) => {
    setSubmissionFiles((currentFiles) => currentFiles.filter((item) => item.key !== key));
    setPreviewSubmissionFileKey((currentKey) => (currentKey === key ? null : currentKey));
  };

  const handleOpenSubmissionFilePreview = (file: SubmissionMaterialFile) => {
    setPreviewSubmissionFileKey(file.key);
  };

  const handleCloseSubmissionFilePreview = () => {
    setPreviewSubmissionFileKey(null);
  };

  const renderSubmissionFilePreview = () => {
    if (!previewSubmissionFile) {
      return null;
    }

    if (previewSubmissionFileKind === 'pdf') {
      return (
        <iframe
          className="notary-review-file-preview-modal__frame"
          src={previewSubmissionFile.path}
          title={`${previewSubmissionFile.name}预览`}
        />
      );
    }

    if (previewSubmissionFileKind === 'image') {
      return (
        <div className="notary-review-file-preview-modal__image-wrap">
          <img src={previewSubmissionFile.path} alt={`${previewSubmissionFile.name}预览`} />
        </div>
      );
    }

    if (submissionFilePreviewStatus === 'loading' || submissionFilePreviewStatus === 'idle') {
      return (
        <div className="notary-review-file-preview-modal__state">
          <strong>{previewSubmissionFile.type}</strong>
          <p>正在加载文件预览，请稍候。</p>
        </div>
      );
    }

    if (submissionFilePreviewStatus === 'ready' && submissionFilePreviewHtml) {
      return (
        <iframe
          className="notary-review-file-preview-modal__frame"
          srcDoc={submissionFilePreviewHtml}
          title={`${previewSubmissionFile.name}预览`}
        />
      );
    }

    return (
      <div className="notary-review-file-preview-modal__state">
        <strong>{previewSubmissionFile.type}</strong>
        <h4>{previewSubmissionFile.name}</h4>
        <p>当前格式暂不支持解析为页面内容，可在弹层内确认文件名称与类型，并打开原件复核。</p>
        <a href={previewSubmissionFile.path} target="_blank" rel="noreferrer">
          打开原件
        </a>
      </div>
    );
  };

  const handleConfirmSubmission = () => {
    if (!submissionPreviewOrder) {
      return;
    }

    const selectedOffice = NOTARY_OFFICES.find((office) => office.id === selectedSubmissionOfficeId);
    if (!selectedOffice) {
      showToast('error', '请选择送审公证处');
      return;
    }

    const currentTimestamp = formatBeijingTimestamp();
    const nextOrder: Order = {
      ...submissionPreviewOrder,
      status: 'pending_production',
      pushedNotaryOfficeId: selectedOffice.id,
      pushedNotaryOfficeName: selectedOffice.name,
      productionDisplayNotaryOfficeId: selectedOffice.id,
      productionDisplayNotaryOfficeName: selectedOffice.name,
      notarySubmissionFiles: submissionFiles.map((file) => ({ ...file })),
      notarySubmissionImages: submissionImages.map((image) => ({ ...image })),
      rejectReason: undefined,
      remark: '',
      updatedAt: currentTimestamp,
      logs: [
        ...submissionPreviewOrder.logs,
        {
          time: currentTimestamp,
          operator: currentAccountId || '运营',
          action: `送审至${selectedOffice.name}`,
        },
      ],
    };

    updateOrder(submissionPreviewOrder.orderId, {
      status: nextOrder.status,
      pushedNotaryOfficeId: nextOrder.pushedNotaryOfficeId,
      pushedNotaryOfficeName: nextOrder.pushedNotaryOfficeName,
      productionDisplayNotaryOfficeId: nextOrder.productionDisplayNotaryOfficeId,
      productionDisplayNotaryOfficeName: nextOrder.productionDisplayNotaryOfficeName,
      notarySubmissionFiles: nextOrder.notarySubmissionFiles,
      notarySubmissionImages: nextOrder.notarySubmissionImages,
      rejectReason: nextOrder.rejectReason,
      remark: nextOrder.remark,
      updatedAt: nextOrder.updatedAt,
      logs: nextOrder.logs,
    });
    pushNotaryOrderToOffice(nextOrder, {
      operator: currentAccountId || '运营',
      pushedAt: currentTimestamp,
      targetStatus: 'pending_review',
    });

    handleCloseSubmittedPreview();
    setOrdersRevision((currentRevision) => currentRevision + 1);
    showToast('success', `已送审至${selectedOffice.name}`);
  };

  const handleCancelOrder = (order: Order) => {
    if (!window.confirm('确认取消该订单？取消后订单状态将变为已取消。')) {
      return;
    }

    const currentTimestamp = formatBeijingTimestamp();

    updateOrder(order.orderId, {
      status: 'cancelled',
      rejectReason: undefined,
      remark: '',
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: currentAccountId || '运营',
          action: '取消订单',
        },
      ],
    });

    setOrdersRevision((currentRevision) => currentRevision + 1);
    setActiveStatus('cancelled');
    setCurrentPage(1);
    setSearchParams({ status: 'cancelled' });
    showToast('success', '订单已取消');
  };

  const handleOpenLogisticsModal = (order: Order) => {
    setLogisticsOrder(order);
    setLogisticsForm({
      logisticsCompany: order.logisticsCompany?.trim() || '',
      trackingNumber: order.trackingNumber.trim(),
    });
  };

  const handleCloseLogisticsModal = () => {
    setLogisticsOrder(null);
    setLogisticsForm({ logisticsCompany: '', trackingNumber: '' });
  };

  const handleLogisticsFieldChange = (field: keyof LogisticsForm, value: string) => {
    setLogisticsForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmitLogistics = () => {
    if (!logisticsOrder) {
      return;
    }

    const logisticsCompany = logisticsForm.logisticsCompany.trim();
    const trackingNumber = logisticsForm.trackingNumber.trim();

    if (!logisticsCompany || !trackingNumber) {
      showToast('error', '请完整填写物流公司和物流单号');
      return;
    }

    const currentTimestamp = formatBeijingTimestamp();
    syncNotaryManagementShipment(logisticsOrder, {
      logisticsCompany,
      trackingNumber,
      operator: currentAccountId || '运营',
      shippedAt: currentTimestamp,
    });

    handleCloseLogisticsModal();
    setOrdersRevision((currentRevision) => currentRevision + 1);
    showToast('success', '物流发货信息已提交');
  };

  const previewState = {
    from: `${NOTARY_ORDER_MANAGEMENT_PATH}${activeStatus ? `?status=${activeStatus}` : ''}`,
  };

  return (
    <div className="app-main animate-fadeIn order-list-page notary-order-management-page">
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
            公证订单管理
          </div>
          <div className="order-list-topbar__accent" />
        </div>
      </div>

      <div className="order-list-shell">
        <div className="order-filter-panel">
          <div className="order-filter-grid">
            <div className="form-group order-filter-field">
              <label className="form-label">代理商</label>
              <input
                className="form-input"
                value={filterAgent}
                onChange={(event) => setFilterAgent(event.target.value)}
                placeholder="请输入代理商名称"
              />
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">产品</label>
              <select className="form-select" value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                <option value="">全部产品</option>
                {NOTARY_PRODUCT_OPTIONS.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field order-filter-field--span-2 notary-order-management-search-field">
              <label className="form-label">创建时间</label>
              <div className="order-filter-range">
                <input
                  className="form-input"
                  type="date"
                  value={filterStartDate}
                  onChange={(event) => setFilterStartDate(event.target.value)}
                />
                <span className="order-filter-range__divider">至</span>
                <input
                  className="form-input"
                  type="date"
                  value={filterEndDate}
                  onChange={(event) => setFilterEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="form-group order-filter-field">
              <label className="form-label">办理类型</label>
              <select
                className="form-select"
                value={filterProcessType}
                onChange={(event) => setFilterProcessType(event.target.value as ProcessType | '')}
              >
                <option value="">全部办理类型</option>
                {PROCESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group order-filter-field order-filter-field--span-2">
              <label className="form-label">精准搜索</label>
              <input
                className="form-input"
                value={filterKeyword}
                onChange={(event) => setFilterKeyword(event.target.value)}
                placeholder="订单号、姓名、驾照号、物流单号..."
              />
            </div>

            <div className="order-filter-actions order-filter-actions--inline notary-order-management-search-actions">
              <button className="btn btn--primary" type="button" onClick={handleSearch}>
                搜索
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleReset}>
                重置
              </button>
              <button className="btn btn--secondary" type="button" onClick={handleExport} disabled={isExporting}>
                {isExporting ? '导出中...' : '导出'}
              </button>
            </div>
          </div>
        </div>

        <div className="card order-list-card">
          <div className="order-list-card__tabs-row">
            <div className="tabs order-list-tabs">
              {STATUS_TABS.map((tab) => (
                <div
                  key={tab.value || 'all'}
                  className={`tabs__item ${activeStatus === tab.value ? 'tabs__item--active' : ''}`}
                  onClick={() => handleStatusChange(tab.value)}
                >
                  {tab.label}
                  <span className="order-list-tabs__count">{statusCounts[tab.value || ''] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table order-list-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>订单ID</th>
                  <th style={{ width: 170 }}>下单时间</th>
                  <th style={{ minWidth: 260 }}>产品及办理类型</th>
                  <th style={{ minWidth: 180 }}>代理商</th>
                  <th style={{ minWidth: 220 }}>驾照信息</th>
                  <th style={{ minWidth: 260 }}>收货地址</th>
                  {showRejectReasonColumn && <th style={{ minWidth: 220 }}>驳回原因</th>}
                  <th style={{ minWidth: 150 }}>订单状态</th>
                  <th style={{ minWidth: 240 }}>订单记录</th>
                  <th style={{ minWidth: 168 }}>操作</th>
                </tr>
              </thead>

              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={orderTableColumnCount} className="empty-state">
                      <div className="empty-state__icon">暂无</div>
                      <div className="empty-state__text">{t('common.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const visibleStatus = getVisibleManagementStatus(order);
                    const viewPath = `${NOTARY_ORDER_MANAGEMENT_PATH}/${order.orderId}/preview?mode=view`;
                    const auditPath = `${NOTARY_ORDER_MANAGEMENT_PATH}/${order.orderId}/preview?mode=audit`;
                    const orderRecordItems = getOrderRecordItems(order);

                    return (
                      <tr key={order.orderId} className="order-list-row">
                        <td>
                          <div className="order-cell-stack order-cell-stack--tight">
                            <button
                              className="order-id-link"
                              type="button"
                              onClick={() => navigate(viewPath, { state: previewState })}
                            >
                              {order.orderId}
                            </button>
                          </div>
                        </td>

                        <td className="order-time-cell">{order.createdAt}</td>

                        <td>
                          <div className="order-cell-stack">
                            <div className="order-cell-primary">{order.productName}</div>
                            <div className={getOrderProcessLineClassName(order)}>
                              <span className="order-process-line__dot" />
                              <span>{getOrderProcessTypeLabel(order, t)}</span>
                            </div>
                            <div className="notary-management-language-badge">{order.language || '--'}</div>
                          </div>
                        </td>

                        <td>
                          <div className="order-agent-name">{getAgentName(order)}</div>
                        </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                              <span className="order-cell-label">姓名：</span>
                              <span className="order-cell-value">{getLicenseName(order)}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">驾照号：</span>
                              <span className="order-cell-value">{getLicenseNo(order)}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">准驾车型：</span>
                              <span className="order-license-badge">{getLicenseCategory(order)}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="order-cell-stack order-cell-stack--compact">
                            <div>
                              <span className="order-cell-label">收件人：</span>
                              <span className="order-cell-value">{order.customerName}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">手机号：</span>
                              <span className="order-cell-value">{order.customerPhone}</span>
                            </div>
                            <div>
                              <span className="order-cell-label">收货地址：</span>
                              <span className="order-cell-value">{order.deliveryAddress}</span>
                            </div>
                          </div>
                        </td>

                        {showRejectReasonColumn && (
                          <td>
                            <div className="order-cell-stack order-cell-stack--compact">
                              <div className="order-cell-value">{getRejectReason(order)}</div>
                            </div>
                          </td>
                        )}

                        <td>
                          <div className="order-status-cell">
                            <span className={`${getStatusTagClass(visibleStatus)} order-list-status-tag`}>
                              {t(`order.status.${visibleStatus}`)}
                            </span>
                            {visibleStatus === 'shipped' && order.trackingNumber && (
                              <div className="order-logistics-inline order-logistics-inline--status">
                                <span>{order.logisticsCompany || '物流已发出'}</span>
                                <span>{order.trackingNumber}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td>
                          {orderRecordItems.length > 0 ? (
                            <div className="notary-order-record">
                              {orderRecordItems.map((record, index) => (
                                <div key={`${record.action}-${index}`} className="notary-order-record__item">
                                  <span className="notary-order-record__action">{record.action}</span>
                                  <span className="notary-order-record__meta">
                                    {[
                                      record.time,
                                      record.officeName && record.officeName !== '--'
                                        ? record.officeName
                                        : undefined,
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="notary-order-record__empty">--</span>
                          )}
                        </td>

                        <td className="order-actions-cell">
                          {visibleStatus !== 'rejected' && (
                            <button
                              type="button"
                              className="order-text-action order-text-action--view"
                              onClick={() => navigate(viewPath, { state: previewState })}
                            >
                              查看订单
                            </button>
                          )}
                          {visibleStatus !== 'cancelled' && (
                            <button
                              type="button"
                              className={`order-text-action ${
                                order.status === 'pending_review' || visibleStatus === 'rejected'
                                  ? 'order-text-action--audit'
                                  : 'order-text-action--review'
                              }`}
                              onClick={() => navigate(auditPath, { state: previewState })}
                            >
                              {visibleStatus === 'rejected'
                                ? '订单修改'
                                : order.status === 'pending_review'
                                  ? '订单审核'
                                  : '查看审核'}
                            </button>
                          )}
                          {visibleStatus === 'rejected' && (
                            <>
                              <button
                                type="button"
                                className="order-text-action order-text-action--push"
                                onClick={() => handleOpenSubmissionPreview(order)}
                              >
                                送审
                              </button>
                              <button
                                type="button"
                                className="order-text-action order-text-action--review"
                                onClick={() => handleCancelOrder(order)}
                              >
                                取消订单
                              </button>
                            </>
                          )}
                          {visibleStatus === 'pending_production' &&
                            (shouldShowNotarySubmissionAction(order) ? (
                              <button
                                type="button"
                                className="order-text-action order-text-action--push"
                                onClick={() => handleOpenSubmissionPreview(order)}
                              >
                                送审
                              </button>
                            ) : hasNotaryOfficeCompletion(order) ? (
                              <button
                                type="button"
                                className="order-text-action order-text-action--push"
                                onClick={() => handleOpenLogisticsModal(order)}
                              >
                                物流发货
                              </button>
                            ) : null)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '0 16px' }}>
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
      </div>

      {submissionPreviewOrder && (
        <div className="modal-overlay" onClick={handleCloseSubmissionPreview}>
          <div className="modal notary-review-submission-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h3 className="modal__title">送审公证处材料</h3>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleCloseSubmissionPreview}>
                关闭
              </button>
            </div>

            <div className="modal__body notary-review-submission-modal__body">
              <div className="notary-review-submission-modal__office-selector">
                <label htmlFor="notary-submission-office">送审公证处</label>
                <select
                  id="notary-submission-office"
                  className="form-select"
                  value={selectedSubmissionOfficeId}
                  onChange={(event) => setSelectedSubmissionOfficeId(event.target.value)}
                >
                  <option value="">请选择公证处</option>
                  {NOTARY_OFFICES.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </div>

              <section className="notary-review-submission-modal__section">
                <div className="notary-review-submission-modal__section-head">
                  <h4>文件材料</h4>
                  <div className="notary-review-submission-modal__section-actions">
                    <span>{submissionFiles.length} 项</span>
                    <label className="notary-review-submission-modal__upload-button" htmlFor="notary-submission-file-upload">
                      上传
                    </label>
                    <input
                      id="notary-submission-file-upload"
                      className="notary-review-submission-modal__file-input"
                      type="file"
                      accept={FILE_MATERIAL_ACCEPT}
                      multiple
                      onChange={handleAddSubmissionFiles}
                    />
                  </div>
                </div>
                {submissionFiles.length > 0 ? (
                  <div className="notary-review-submission-modal__file-list">
                    {submissionFiles.map((file) => {
                      const inputId = buildMaterialInputId('notary-submission-file-replace', file.key);
                      const canPreviewFile = Boolean(file.path) && file.status !== 'loading' && file.status !== 'error';

                      return (
                        <div key={file.key} className="notary-review-submission-modal__file-card">
                          <span className="notary-review-submission-modal__file-type">{file.type}</span>
                          <span className="notary-review-submission-modal__file-info">
                            <strong>{file.name}</strong>
                            <small>{file.message || file.label}</small>
                          </span>
                          <span className="notary-review-submission-modal__file-actions">
                            <button
                              type="button"
                              className="notary-review-submission-modal__preview-button"
                              disabled={!canPreviewFile}
                              onClick={() => handleOpenSubmissionFilePreview(file)}
                            >
                              {file.status === 'loading' ? '生成中' : file.status === 'error' ? '不可查看' : '查看'}
                            </button>
                            <label htmlFor={inputId}>修改</label>
                            <button type="button" onClick={() => handleDeleteSubmissionFile(file.key)}>
                              删除
                            </button>
                          </span>
                          <input
                            id={inputId}
                            className="notary-review-submission-modal__file-input"
                            type="file"
                            accept={FILE_MATERIAL_ACCEPT}
                            onChange={(event) => handleReplaceSubmissionFile(file.key, event)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="notary-review-submission-modal__empty">暂无文件材料，请点击上传添加。</div>
                )}
              </section>

              <section className="notary-review-submission-modal__section">
                <div className="notary-review-submission-modal__section-head">
                  <h4>图片材料</h4>
                  <div className="notary-review-submission-modal__section-actions">
                    <span>{submissionImages.length} 项</span>
                    <label className="notary-review-submission-modal__upload-button" htmlFor="notary-submission-image-upload">
                      上传
                    </label>
                    <input
                      id="notary-submission-image-upload"
                      className="notary-review-submission-modal__file-input"
                      type="file"
                      accept={IMAGE_MATERIAL_ACCEPT}
                      multiple
                      onChange={handleAddSubmissionImages}
                    />
                  </div>
                </div>
                {submissionImages.length > 0 ? (
                  <div className="notary-review-submission-modal__image-grid">
                    {submissionImages.map((item) => {
                      const inputId = buildMaterialInputId('notary-submission-image-replace', item.key);

                      return (
                        <div key={item.key} className="notary-review-submission-modal__image-card">
                          <a
                            className="notary-review-submission-modal__image-preview"
                            href={item.src}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ResolvedImage src={item.src} alt={`${item.label}预览`} />
                          </a>
                          <div className="notary-review-submission-modal__material-title">{item.label}</div>
                          <div className="notary-review-submission-modal__material-actions">
                            <label htmlFor={inputId}>修改</label>
                            <button type="button" onClick={() => handleDeleteSubmissionImage(item.key)}>
                              删除
                            </button>
                          </div>
                          <input
                            id={inputId}
                            className="notary-review-submission-modal__file-input"
                            type="file"
                            accept={IMAGE_MATERIAL_ACCEPT}
                            onChange={(event) => handleReplaceSubmissionImage(item.key, event)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="notary-review-submission-modal__empty">暂无图片材料，请点击上传添加。</div>
                )}
              </section>
            </div>
            <div className="modal__footer">
              <div className="notary-review-submission-modal__footer-note">注：确认公证材料无误后送审</div>
              <div className="notary-review-submission-modal__footer-actions">
                <button type="button" className="btn btn--secondary" onClick={handleCloseSubmissionPreview}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!selectedSubmissionOfficeId}
                  onClick={handleConfirmSubmission}
                >
                  确认送审
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewSubmissionFile && (
        <div className="modal-overlay" onClick={handleCloseSubmissionFilePreview}>
          <div className="modal notary-review-file-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h3 className="modal__title">文件预览</h3>
                <p className="notary-review-file-preview-modal__subtitle">{previewSubmissionFile.name}</p>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleCloseSubmissionFilePreview}>
                关闭
              </button>
            </div>

            <div className="notary-review-file-preview-modal__body">{renderSubmissionFilePreview()}</div>
          </div>
        </div>
      )}

      {logisticsOrder && (
        <div className="modal-overlay" onClick={handleCloseLogisticsModal}>
          <div className="modal notary-logistics-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h3 className="modal__title">物流发货</h3>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleCloseLogisticsModal}>
                关闭
              </button>
            </div>

            <div className="modal__body notary-logistics-modal__body">
              <div className="notary-logistics-modal__summary">
                <span>订单ID：{logisticsOrder.orderId}</span>
                <span>收件人：{logisticsOrder.customerName}</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="notary-logistics-company">
                  物流公司
                </label>
                <select
                  id="notary-logistics-company"
                  className="form-select"
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
                <label className="form-label" htmlFor="notary-tracking-number">
                  物流单号
                </label>
                <input
                  id="notary-tracking-number"
                  className="form-input"
                  value={logisticsForm.trackingNumber}
                  placeholder="请输入物流单号"
                  onChange={(event) => handleLogisticsFieldChange('trackingNumber', event.target.value)}
                />
              </div>
            </div>

            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={handleCloseLogisticsModal}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!logisticsForm.logisticsCompany.trim() || !logisticsForm.trackingNumber.trim()}
                onClick={handleSubmitLogistics}
              >
                确认发货
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaryOrderManagementList;
