import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { useNavigate, useParams } from 'react-router-dom';
import ResolvedImage from '../../shared/components/ResolvedImage';
import { useTranslation } from '../../shared/i18n/config';
import {
  getNotaryOfficeOrderById,
  syncNotaryOfficeApprovalToManagement,
  syncNotaryOfficeRejectionToManagement,
  updateNotaryOfficeOrder,
} from '../../services/notaryOfficeOrderService';
import { buildNotaryPowerOfAttorneyPreviewFileDescriptors } from '../../shared/config/notaryPowerOfAttorney';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { resolveLocalImageSource } from '../../shared/utils/localImageStore';
import { buildNotaryImagesPdfBlob } from '../../shared/utils/notaryPreviewExport';
import { buildSpreadsheetPreviewHtml } from '../../shared/utils/spreadsheetPreview';
import { buildWordPreviewHtml as buildSharedWordPreviewHtml } from '../../shared/utils/wordPreview';
import type { Order, OrderStatus } from '../../shared/types';
import './NotaryOrderPreview.css';

type PreviewFileType = 'pdf' | 'image' | 'word' | 'spreadsheet';
type PreviewFileGroup = 'primary' | 'supporting';
type AuditItemStatus = 'success' | 'warning';
type OfficePreviewStatus = 'idle' | 'loading' | 'ready' | 'error';
type GeneratedPreviewStatus = 'loading' | 'ready' | 'error';

interface PreviewFile {
  id: string;
  name: string;
  type: PreviewFileType;
  group: PreviewFileGroup;
  path: string;
  canInlinePreview: boolean;
  previewPath?: string;
  zipEntryPath?: string;
  zipPath?: string;
  status?: GeneratedPreviewStatus;
  message?: string;
}

const NOTARY_TEMPLATE_ROOT = '/ETC/Notary%20Office%20Template';
const buildPreviewFilePath = (...segments: string[]) =>
  `${NOTARY_TEMPLATE_ROOT}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;

const NOTARY_TEMPLATE_PACKAGE_FOLDER = '姓名+国家+语言+产品名称';
const NOTARY_TEMPLATE_PACKAGE_ZIP_PATH = buildPreviewFilePath(`${NOTARY_TEMPLATE_PACKAGE_FOLDER}.zip`);
const buildTemplatePackageFilePath = (fileName: string) => buildPreviewFilePath(NOTARY_TEMPLATE_PACKAGE_FOLDER, fileName);
const buildTemplatePackageZipEntryPath = (fileName: string) => `${NOTARY_TEMPLATE_PACKAGE_FOLDER}/${fileName}`;
const PREVIEW_FOLDER = '丁一然 意大利 意大利语 单号';
const PREVIEW_BASE = buildPreviewFilePath(PREVIEW_FOLDER);
const WORD_TEMPLATE_FALLBACK_IMAGE = buildPreviewFilePath(PREVIEW_FOLDER, '丁一然.files', '丁一然217.png');
const NOTARY_PENDING_REVIEW_PATH = '/notary/orders?status=pending_review';
const NOTARY_IN_PRODUCTION_PATH = '/notary/orders?status=in_production';
const PREVIEW_ASSET_BASE_PATH = '/ETC/Notary%20Office%20Template/Preview%20file/yulan';
const buildPreviewAssetFilePath = (fileName: string) => `${PREVIEW_ASSET_BASE_PATH}/${encodeURIComponent(fileName)}`;
const DEFAULT_WORD_PREVIEW_IMAGE = buildPreviewAssetFilePath('1.png');
const PASSPORT_TEMPLATE_IMAGE_SOURCES = [
  { src: buildPreviewAssetFilePath('passport-template-page-1.png') },
  { src: buildPreviewAssetFilePath('passport-template-page-2.png') },
];

const PREVIEW_ASSET_FOLDER = '丁一然.files';
const PREVIEW_ASSET_IMAGE = '丁一然217.png';
const ORDER_PREVIEW_FALLBACK_IMAGE = buildPreviewFilePath(PREVIEW_FOLDER, PREVIEW_ASSET_FOLDER, PREVIEW_ASSET_IMAGE);

const PRIMARY_FILES: PreviewFile[] = [
  {
    id: 'notarized-document',
    name: '公证书.pdf',
    type: 'pdf',
    group: 'primary',
    path: buildPreviewAssetFilePath('Notarized Document.pdf'),
    canInlinePreview: true,
  },
  {
    id: 'scanned-copy',
    name: '扫描件.pdf',
    type: 'pdf',
    group: 'primary',
    path: buildPreviewAssetFilePath('Scanned copy.pdf'),
    canInlinePreview: true,
  },
  {
    id: 'power-of-attorney',
    name: '委托书.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewAssetFilePath('Power of Attorney.docx'),
    canInlinePreview: true,
    previewPath: DEFAULT_WORD_PREVIEW_IMAGE,
  },
];

const PREVIEW_FILES: PreviewFile[] = [
  {
    id: 'notarized-document',
    name: '丁一然的公证书.pdf',
    type: 'pdf',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的公证书.pdf'),
    canInlinePreview: true,
  },
  {
    id: 'scanned-copy',
    name: '丁一然的扫描件.pdf',
    type: 'pdf',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的扫描件.pdf'),
    canInlinePreview: true,
  },
  {
    id: 'license-translation',
    name: '丁一然的驾照页翻译word版.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的驾照页翻译word版.docx'),
    canInlinePreview: true,
    previewPath: WORD_TEMPLATE_FALLBACK_IMAGE,
  },
  {
    id: 'certificate-translation',
    name: '丁一然的公证词翻译word版.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的公证词翻译word版.docx'),
    canInlinePreview: true,
    previewPath: WORD_TEMPLATE_FALLBACK_IMAGE,
  },
  {
    id: 'beibu-gulf-power-of-attorney',
    name: '姓名_北部湾委托书.docx',
    type: 'word',
    group: 'primary',
    path: buildTemplatePackageFilePath('姓名_北部湾委托书.docx'),
    canInlinePreview: true,
    previewPath: WORD_TEMPLATE_FALLBACK_IMAGE,
    zipPath: NOTARY_TEMPLATE_PACKAGE_ZIP_PATH,
    zipEntryPath: buildTemplatePackageZipEntryPath('姓名_北部湾委托书.docx'),
  },
  {
    id: 'foreign-affairs-power-of-attorney',
    name: '丁一然的外事办委托书.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的外事办委托书.docx'),
    canInlinePreview: true,
    previewPath: WORD_TEMPLATE_FALLBACK_IMAGE,
  },
];

const ORDER_PREVIEW_FILES: PreviewFile[] = [
  {
    id: 'notarized-document',
    name: '丁一然的公证书.pdf',
    type: 'pdf',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的公证书.pdf'),
    canInlinePreview: true,
  },
  {
    id: 'scanned-copy',
    name: '丁一然的扫描件.pdf',
    type: 'pdf',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的扫描件.pdf'),
    canInlinePreview: true,
  },
  {
    id: 'power-of-attorney',
    name: '丁一然.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然.docx'),
    canInlinePreview: true,
    previewPath: ORDER_PREVIEW_FALLBACK_IMAGE,
  },
  {
    id: 'license-translation',
    name: '丁一然的驾照页翻译.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的驾照页翻译.docx'),
    canInlinePreview: true,
    previewPath: ORDER_PREVIEW_FALLBACK_IMAGE,
  },
  {
    id: 'certificate-translation',
    name: '丁一然的公证词翻译.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的公证词翻译.docx'),
    canInlinePreview: true,
    previewPath: ORDER_PREVIEW_FALLBACK_IMAGE,
  },
  {
    id: 'beibu-gulf-power-of-attorney',
    name: '姓名_北部湾委托书.docx',
    type: 'word',
    group: 'primary',
    path: buildTemplatePackageFilePath('姓名_北部湾委托书.docx'),
    canInlinePreview: true,
    previewPath: ORDER_PREVIEW_FALLBACK_IMAGE,
    zipPath: NOTARY_TEMPLATE_PACKAGE_ZIP_PATH,
    zipEntryPath: buildTemplatePackageZipEntryPath('姓名_北部湾委托书.docx'),
  },
  {
    id: 'foreign-affairs-power-of-attorney',
    name: '丁一然的外事办委托书.docx',
    type: 'word',
    group: 'primary',
    path: buildPreviewFilePath(PREVIEW_FOLDER, '丁一然的外事办委托书.docx'),
    canInlinePreview: true,
    previewPath: ORDER_PREVIEW_FALLBACK_IMAGE,
  },
];

const SUPPORTING_FILES: PreviewFile[] = Array.from({ length: 8 }, (_, index) => ({
  id: `supporting-${index + 1}`,
  name: `${index + 1}.png`,
  type: 'image',
  group: 'supporting',
  path: `${PREVIEW_BASE}/${index + 1}.png`,
  canInlinePreview: true,
}));

const ALL_FILES = [...ORDER_PREVIEW_FILES, ...SUPPORTING_FILES];

const buildPassportPdfSource = (order: Order) => {
  const images = order.notaryCertificateImages || {};
  const passportFront = images['passport-front']?.trim();
  const passportVisa = images['passport-visa']?.trim();

  if (!passportFront) {
    return {
      status: 'error' as const,
      message: '缺少护照首页，无法生成护照PDF',
      path: '',
    };
  }

  return {
    status: 'loading' as const,
    message: '正在根据护照首页和签证页生成护照PDF',
    path: '',
    passportFront,
    passportVisa,
  };
};

const buildFlightItineraryPdfSource = (order: Order) => {
  const images = order.notaryCertificateImages || {};
  const flightItinerary = images['flight-itinerary']?.trim();

  if (!flightItinerary) {
    return {
      status: 'error' as const,
      message: '缺少行程单附件，无法生成PDF',
      path: '',
    };
  }

  return {
    status: 'loading' as const,
    message: '正在根据录单上传的行程单生成PDF',
    path: '',
    flightItinerary,
  };
};

const SPREADSHEET_FILE_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'xltx', 'xltm', 'csv', 'tsv']);
const IMAGE_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

const getFileExtension = (nameOrPath: string) =>
  nameOrPath.split(/[?#]/)[0].split('.').pop()?.trim().toLowerCase() || '';

const getSubmittedPreviewFileType = (name: string, path: string, fallbackType: string): PreviewFileType => {
  const extension = getFileExtension(name || path);
  const normalizedType = fallbackType.toLowerCase();

  if (IMAGE_FILE_EXTENSIONS.has(extension) || normalizedType.startsWith('image/')) {
    return 'image';
  }

  if (extension === 'pdf' || normalizedType === 'pdf') {
    return 'pdf';
  }

  if (
    SPREADSHEET_FILE_EXTENSIONS.has(extension) ||
    ['xls', 'xlsx', 'xlsm', 'xltx', 'xltm', 'csv', 'tsv', 'text/csv', 'text/tab-separated-values'].includes(
      normalizedType,
    )
  ) {
    return 'spreadsheet';
  }

  return 'word';
};

const buildPrimaryFiles = (
  order: Order,
  generatedFileSources: Record<string, { message?: string; path: string; status: GeneratedPreviewStatus }>,
): PreviewFile[] => {
  if (order.notarySubmissionFiles?.length) {
    return order.notarySubmissionFiles.map((file) => {
      const status = file.status === 'ready' && file.path ? undefined : file.status;

      return {
        id: file.key,
        name: file.name,
        type: getSubmittedPreviewFileType(file.name, file.path, file.type),
        group: 'primary',
        path: file.path,
        canInlinePreview: Boolean(file.path) && file.status !== 'loading' && file.status !== 'error',
        status,
        message: file.message || file.label,
      };
    });
  }

  return [
    {
      id: 'notarized-document',
      name: '公证书.pdf',
      type: 'pdf',
      group: 'primary',
      path: buildPreviewAssetFilePath('Notarized Document.pdf'),
      canInlinePreview: true,
    },
    {
      id: 'scanned-copy',
      name: '扫描件.pdf',
      type: 'pdf',
      group: 'primary',
      path: buildPreviewAssetFilePath('Scanned copy.pdf'),
      canInlinePreview: true,
    },
    {
      id: 'passport-pdf',
      name: `${order.licenseName || order.customerName || '护照'}护照.pdf`,
      type: 'pdf',
      group: 'primary',
      path: generatedFileSources['passport-pdf']?.path || '',
      canInlinePreview: generatedFileSources['passport-pdf']?.status === 'ready',
      status: generatedFileSources['passport-pdf']?.status || 'loading',
      message: generatedFileSources['passport-pdf']?.message,
    },
    {
      id: 'flight-itinerary-pdf',
      name: `${order.licenseName || order.customerName || '行程单'}的行程单.pdf`,
      type: 'pdf',
      group: 'primary',
      path: generatedFileSources['flight-itinerary-pdf']?.path || '',
      canInlinePreview: generatedFileSources['flight-itinerary-pdf']?.status === 'ready',
      status: generatedFileSources['flight-itinerary-pdf']?.status || 'loading',
      message: generatedFileSources['flight-itinerary-pdf']?.message,
    },
    {
      id: 'power-of-attorney',
      name: '委托书.docx',
      type: 'word',
      group: 'primary',
      path: buildPreviewAssetFilePath('Power of Attorney.docx'),
      canInlinePreview: true,
      previewPath: DEFAULT_WORD_PREVIEW_IMAGE,
    },
  ];
};

const fileTypeLabel: Record<PreviewFileType, string> = {
  pdf: 'PDF',
  image: 'IMG',
  word: 'WORD',
  spreadsheet: '表格',
};

const getOfficeFileExtension = (file: Pick<PreviewFile, 'name' | 'path'>) =>
  getFileExtension(file.name || file.path);

const getPreviewFileKind = (file: PreviewFile): PreviewFileType => {
  if (file.type === 'pdf' || file.type === 'image' || file.type === 'spreadsheet') {
    return file.type;
  }

  return SPREADSHEET_FILE_EXTENSIONS.has(getOfficeFileExtension(file)) ? 'spreadsheet' : 'word';
};

const statusTagClass = (status: OrderStatus) => {
  const map: Record<OrderStatus, string> = {
    translating: 'warning',
    pending_review: 'pending',
    pending_production: 'processing',
    in_production: 'warning',
    shipped: 'shipped',
    completed: 'completed',
    cancelled: 'cancelled',
    rejected: 'rejected',
  };

  return `tag tag--${map[status] || 'pending'}`;
};

const now = () => formatBeijingTimestamp();
const DOCX_WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SUPPORTING_IMAGE_LABELS: Record<string, string> = {
  'license-front': '驾驶证正面',
  'license-back': '驾驶证反面',
  'extra-front': '副页正面',
  'extra-back': '副页反面',
  'identity-front': '身份证正面',
  'identity-back': '身份证反面',
  'passport-front': '护照首页',
  'passport-visa': '护照签证页',
  'flight-itinerary': '行程单',
  'digital-license': '电子驾照',
  signature: '电子签名',
};

const buildSupportingFiles = (order: Order): PreviewFile[] => {
  if (order.notarySubmissionImages?.length) {
    return order.notarySubmissionImages.map((image) => ({
      id: image.key,
      name: image.label,
      type: 'image',
      group: 'supporting',
      path: image.src,
      canInlinePreview: true,
    }));
  }

  const images = order.notaryCertificateImages || {};
  const knownImages = Object.entries(SUPPORTING_IMAGE_LABELS)
    .map<PreviewFile | null>(([key, label]) => {
      const src = images[key];

      return src
        ? {
            id: key,
            name: label,
            type: 'image',
            group: 'supporting',
            path: src,
            canInlinePreview: true,
          }
        : null;
    })
    .filter((item): item is PreviewFile => item !== null);
  const unknownImages = Object.entries(images)
    .filter(([key, src]) => Boolean(src) && !SUPPORTING_IMAGE_LABELS[key])
    .map<PreviewFile>(([key, src]) => ({
      id: key,
      name: key,
      type: 'image',
      group: 'supporting',
      path: src,
      canInlinePreview: true,
    }));

  return [...knownImages, ...unknownImages];
};

const getNotaryUseCountry = (order: Order) =>
  order.useCountry?.trim() || order.domesticLicenseInfo?.foreignCountry?.trim() || '未配置';

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

const fetchPreviewFileBuffer = async (file: PreviewFile) => {
  const response = await fetch(file.path);

  if (response.ok) {
    return response.arrayBuffer();
  }

  if (!file.zipPath || !file.zipEntryPath) {
    throw new Error(`Failed to load template: ${response.status}`);
  }

  const zipResponse = await fetch(file.zipPath);
  if (!zipResponse.ok) {
    throw new Error(`Failed to load template package: ${zipResponse.status}`);
  }

  const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());
  const entry = zip.file(file.zipEntryPath);
  if (!entry) {
    throw new Error(`Missing template package entry: ${file.zipEntryPath}`);
  }

  return entry.async('arraybuffer');
};

const resolveWordPreviewAssetPath = async (documentPath: string, assetPath: string) => {
  const tryFetchAssetPath = async (candidatePath: string) => {
    try {
      const response = await fetch(candidatePath);
      return response.ok ? candidatePath : '';
    } catch {
      return '';
    }
  };

  if (typeof window === 'undefined') {
    return ORDER_PREVIEW_FALLBACK_IMAGE;
  }

  try {
    const resolvedUrl = new URL(assetPath, new URL(documentPath, window.location.origin));
    const resolvedPath = `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
    const directAssetPath = await tryFetchAssetPath(resolvedPath);
    if (directAssetPath) {
      return directAssetPath;
    }
  } catch {
    // Fallback handled below when the relative asset cannot be resolved.
  }

  if (assetPath.includes('.files/')) {
    const assetFileName = assetPath.split('/').pop()?.trim();

    if (assetFileName) {
      const canonicalAssetPath = buildPreviewFilePath(PREVIEW_FOLDER, PREVIEW_ASSET_FOLDER, assetFileName);
      const matchedCanonicalAssetPath = await tryFetchAssetPath(canonicalAssetPath);

      if (matchedCanonicalAssetPath) {
        return matchedCanonicalAssetPath;
      }
    }

    const folderFallbackAssetPath = await tryFetchAssetPath(ORDER_PREVIEW_FALLBACK_IMAGE);
    if (folderFallbackAssetPath) {
      return folderFallbackAssetPath;
    }
  }

  return ORDER_PREVIEW_FALLBACK_IMAGE;
};

const buildWordPreviewHtml = async (rawHtml: string, documentPath: string) => {
  const previewShellStyle = `
    <style>
      html, body {
        margin: 0;
        padding: 24px;
        min-height: 100%;
        box-sizing: border-box;
        background: #eef2f7;
      }

      body {
        overflow: auto;
      }

      div.Section0 {
        width: 820px;
        max-width: 100%;
        margin: 0 auto;
        padding: 44px 52px;
        background: #ffffff;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
      }

      img {
        max-width: 100%;
        height: auto;
      }

      table {
        max-width: 100%;
      }

      @media (max-width: 768px) {
        html, body {
          padding: 12px;
        }

        div.Section0 {
          padding: 24px 18px;
          box-shadow: none;
        }
      }
    </style>
  `;

  const normalizedHtml = rawHtml
    .replace(/<link[^>]+File-List[^>]*>/gi, '')
    .replace(/charset=gb2312/gi, 'charset=utf-8');

  const assetPattern = /(["'])([^"']+?\.files\/[^"']+\.(?:png|jpg|jpeg|gif|webp|bmp|svg))\1/gi;
  const assetPaths = Array.from(normalizedHtml.matchAll(assetPattern), (match) => match[2]);
  const uniqueAssetPaths = Array.from(new Set(assetPaths));
  const resolvedAssetEntries = await Promise.all(
    uniqueAssetPaths.map(async (assetPath) => [assetPath, await resolveWordPreviewAssetPath(documentPath, assetPath)] as const),
  );
  const resolvedAssetMap = new Map(resolvedAssetEntries);

  const htmlWithResolvedAssets = normalizedHtml.replace(assetPattern, (_match, quote: string, assetPath: string) => {
    const resolvedPath = resolvedAssetMap.get(assetPath) || ORDER_PREVIEW_FALLBACK_IMAGE;
    return `${quote}${resolvedPath}${quote}`;
  });

  if (htmlWithResolvedAssets.includes('</head>')) {
    return htmlWithResolvedAssets.replace('</head>', `${previewShellStyle}</head>`);
  }

  return `<head>${previewShellStyle}</head>${htmlWithResolvedAssets}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getLocalName = (node: Element | Node) => {
  if ('localName' in node && node.localName) {
    return node.localName;
  }

  return node.nodeName.split(':').pop() || node.nodeName;
};

const getAttributeValue = (element: Element | null | undefined, attributeName: string) => {
  if (!element) {
    return '';
  }

  return element.getAttribute(attributeName) || element.getAttribute(attributeName.split(':').pop() || attributeName) || '';
};

const getDirectChildElement = (element: Element | null | undefined, localName: string) => {
  if (!element) {
    return null;
  }

  return (
    Array.from(element.childNodes).find(
      (node): node is Element => node.nodeType === Node.ELEMENT_NODE && getLocalName(node as Element) === localName,
    ) || null
  );
};

const hasDirectChildElement = (element: Element | null | undefined, localName: string) =>
  Boolean(getDirectChildElement(element, localName));

const isZipWordDocument = (buffer: ArrayBuffer) => {
  const header = new Uint8Array(buffer.slice(0, 4));
  return header[0] === 0x50 && header[1] === 0x4b;
};

const resolveZipEntryPath = (basePath: string, relativePath: string) => {
  const baseSegments = basePath.split('/').filter(Boolean);
  const relativeSegments = relativePath.split('/').filter(Boolean);
  const segments = relativePath.startsWith('/') ? [] : baseSegments;

  for (const segment of relativeSegments) {
    if (segment === '.') {
      continue;
    }

    if (segment === '..') {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join('/');
};

const getMimeTypeByPath = (path: string) => {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (normalizedPath.endsWith('.gif')) {
    return 'image/gif';
  }

  if (normalizedPath.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'application/octet-stream';
};

const parseXmlDocument = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

const buildDocxPreviewShell = (content: string) => `
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        html, body {
          margin: 0;
          padding: 24px;
          min-height: 100%;
          box-sizing: border-box;
          background: #eef2f7;
          color: #0f172a;
          font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
        }

        body {
          overflow: auto;
        }

        .docx-page {
          width: 820px;
          max-width: 100%;
          margin: 0 auto;
          padding: 44px 52px;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
        }

        .docx-paragraph {
          margin: 0 0 16px;
          font-size: 16px;
          line-height: 1.9;
          white-space: normal;
          word-break: break-word;
        }

        .docx-paragraph--center {
          text-align: center;
        }

        .docx-paragraph--right {
          text-align: right;
        }

        .docx-paragraph--heading {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 22px;
        }

        .docx-paragraph--spacer {
          min-height: 16px;
        }

        .docx-underline {
          text-decoration: underline;
        }

        .docx-image-wrap {
          margin: 16px 0;
          text-align: center;
        }

        .docx-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
        }

        .docx-table-wrap {
          overflow-x: auto;
          margin: 20px 0;
        }

        .docx-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .docx-table td {
          border: 1px solid #dbe2ea;
          padding: 10px 12px;
          vertical-align: top;
        }

        .docx-table .docx-paragraph:last-child {
          margin-bottom: 0;
        }

        .docx-empty {
          margin: 0;
          color: #64748b;
          font-size: 15px;
          line-height: 1.8;
          text-align: center;
        }

        @media (max-width: 768px) {
          html, body {
            padding: 12px;
          }

          .docx-page {
            padding: 24px 18px;
            box-shadow: none;
          }

          .docx-paragraph {
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="docx-page">${content || '<p class="docx-empty">未读取到文档内容</p>'}</div>
    </body>
  </html>
`;

const renderDocxImage = (drawingElement: Element, imageMap: Map<string, string>) => {
  const blipElement = Array.from(drawingElement.getElementsByTagName('*')).find(
    (node): node is Element => getLocalName(node as Element) === 'blip',
  );
  const embedId = getAttributeValue(blipElement, 'r:embed');

  if (!embedId) {
    return '';
  }

  const imageSource = imageMap.get(embedId);
  if (!imageSource) {
    return '';
  }

  return `<div class="docx-image-wrap"><img class="docx-image" src="${imageSource}" alt="docx-preview-image" /></div>`;
};

const renderDocxRun = (runElement: Element, imageMap: Map<string, string>) => {
  const runProperties = getDirectChildElement(runElement, 'rPr');
  let content = '';

  Array.from(runElement.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    const localName = getLocalName(element);

    if (localName === 't') {
      content += escapeHtml(element.textContent || '');
      return;
    }

    if (localName === 'tab') {
      content += '&emsp;';
      return;
    }

    if (localName === 'br') {
      content += '<br />';
      return;
    }

    if (localName === 'drawing') {
      content += renderDocxImage(element, imageMap);
    }
  });

  if (!content) {
    return '';
  }

  if (hasDirectChildElement(runProperties, 'u')) {
    content = `<span class="docx-underline">${content}</span>`;
  }

  if (hasDirectChildElement(runProperties, 'i')) {
    content = `<em>${content}</em>`;
  }

  if (hasDirectChildElement(runProperties, 'b')) {
    content = `<strong>${content}</strong>`;
  }

  return content;
};

const renderDocxRunContainer = (containerElement: Element, imageMap: Map<string, string>): string => {
  let content = '';

  Array.from(containerElement.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    const localName = getLocalName(element);

    if (localName === 'r') {
      content += renderDocxRun(element, imageMap);
      return;
    }

    if (localName === 'hyperlink') {
      content += renderDocxRunContainer(element, imageMap);
    }
  });

  return content;
};

const renderDocxParagraph = (paragraphElement: Element, imageMap: Map<string, string>) => {
  const paragraphProperties = getDirectChildElement(paragraphElement, 'pPr');
  const alignmentValue = getAttributeValue(getDirectChildElement(paragraphProperties, 'jc'), 'w:val');
  const styleValue = getAttributeValue(getDirectChildElement(paragraphProperties, 'pStyle'), 'w:val').toLowerCase();
  const classes = ['docx-paragraph'];

  if (alignmentValue === 'center') {
    classes.push('docx-paragraph--center');
  } else if (alignmentValue === 'right') {
    classes.push('docx-paragraph--right');
  }

  if (styleValue.includes('heading') || styleValue.includes('title')) {
    classes.push('docx-paragraph--heading');
  }

  const content = renderDocxRunContainer(paragraphElement, imageMap).trim();
  if (!content) {
    return `<p class="${classes.join(' ')} docx-paragraph--spacer"><br /></p>`;
  }

  return `<p class="${classes.join(' ')}">${content}</p>`;
};

const renderDocxTableCell = (cellElement: Element, imageMap: Map<string, string>): string => {
  const blocks: string = Array.from(cellElement.childNodes)
    .filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE)
    .map((element): string => {
      const localName = getLocalName(element);

      if (localName === 'p') {
        return renderDocxParagraph(element, imageMap);
      }

      if (localName === 'tbl') {
        return renderDocxTable(element, imageMap);
      }

      return '';
    })
    .filter(Boolean)
    .join('');

  return `<td>${blocks || '&nbsp;'}</td>`;
};

function renderDocxTable(tableElement: Element, imageMap: Map<string, string>): string {
  const rows: string = Array.from(tableElement.childNodes)
    .filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE && getLocalName(node as Element) === 'tr')
    .map((rowElement): string => {
      const cells: string = Array.from(rowElement.childNodes)
        .filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE && getLocalName(node as Element) === 'tc')
        .map((cellElement) => renderDocxTableCell(cellElement, imageMap))
        .join('');

      return `<tr>${cells}</tr>`;
    })
    .join('');

  if (!rows) {
    return '';
  }

  return `<div class="docx-table-wrap"><table class="docx-table"><tbody>${rows}</tbody></table></div>`;
}

const buildDocxImageMap = async (zip: JSZip) => {
  const imageMap = new Map<string, string>();
  const relationshipEntry = zip.file('word/_rels/document.xml.rels');

  if (!relationshipEntry) {
    return imageMap;
  }

  const relationshipXml = await relationshipEntry.async('string');
  const relationshipDocument = parseXmlDocument(relationshipXml);
  const relationshipElements = Array.from(relationshipDocument.getElementsByTagName('*')).filter(
    (node): node is Element => getLocalName(node as Element) === 'Relationship',
  );

  for (const relationshipElement of relationshipElements) {
    const relationshipId = getAttributeValue(relationshipElement, 'Id');
    const relationshipType = getAttributeValue(relationshipElement, 'Type');
    const relationshipTarget = getAttributeValue(relationshipElement, 'Target');

    if (!relationshipId || !relationshipType.includes('/image') || !relationshipTarget) {
      continue;
    }

    const entryPath = resolveZipEntryPath('word', relationshipTarget);
    const mediaEntry = zip.file(entryPath);

    if (!mediaEntry) {
      continue;
    }

    const base64Data = await mediaEntry.async('base64');
    imageMap.set(relationshipId, `data:${getMimeTypeByPath(entryPath)};base64,${base64Data}`);
  }

  return imageMap;
};

const buildDocxPreviewHtml = async (buffer: ArrayBuffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const documentEntry = zip.file('word/document.xml');

  if (!documentEntry) {
    throw new Error('Missing word/document.xml');
  }

  const [documentXml, imageMap] = await Promise.all([documentEntry.async('string'), buildDocxImageMap(zip)]);
  const documentTree = parseXmlDocument(documentXml);
  const bodyElement = documentTree.getElementsByTagNameNS(DOCX_WORD_NAMESPACE, 'body')[0];

  if (!bodyElement) {
    throw new Error('Missing document body');
  }

  const content = Array.from(bodyElement.childNodes)
    .filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE)
    .map((element) => {
      const localName = getLocalName(element);

      if (localName === 'p') {
        return renderDocxParagraph(element, imageMap);
      }

      if (localName === 'tbl') {
        return renderDocxTable(element, imageMap);
      }

      return '';
    })
    .filter(Boolean)
    .join('');

  return buildDocxPreviewShell(content);
};

const NotaryOrderPreview: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useMemo(() => getNotaryOfficeOrderById(id || ''), [id]);

  const [selectedFileId, setSelectedFileId] = useState(ORDER_PREVIEW_FILES[0].id);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [officePreviewStatus, setOfficePreviewStatus] = useState<OfficePreviewStatus>('idle');
  const [officePreviewHtml, setOfficePreviewHtml] = useState('');
  const [resolvedImageSources, setResolvedImageSources] = useState<Record<string, string>>({});
  const [generatedFileSources, setGeneratedFileSources] = useState<
    Record<string, { message?: string; path: string; status: GeneratedPreviewStatus }>
  >({});

  const primaryFiles = useMemo(() => (order ? buildPrimaryFiles(order, generatedFileSources) : []), [
    generatedFileSources,
    order?.customerName,
    order?.licenseName,
    order?.orderId,
    order?.status,
    order?.updatedAt,
  ]);
  const supportingFiles = useMemo(() => (order ? buildSupportingFiles(order) : []), [order?.orderId, order?.updatedAt, order?.status]);
  const allFiles = useMemo(() => [...primaryFiles, ...supportingFiles], [primaryFiles, supportingFiles]);
  const selectedFile = useMemo(
    () => allFiles.find((file) => file.id === selectedFileId) || allFiles[0] || ORDER_PREVIEW_FILES[0],
    [allFiles, selectedFileId],
  );
  const selectedFilePreviewType = useMemo(() => getPreviewFileKind(selectedFile), [selectedFile]);
  const powerOfAttorneySignatureSource = getPowerOfAttorneySignatureSource(order);

  useEffect(() => {
    setSelectedFileId('notarized-document');
  }, [order?.orderId]);

  useEffect(() => {
    let cancelled = false;
    const generatedBlobUrls: string[] = [];

    const buildGeneratedPrimaryFiles = async () => {
      if (!order) {
        setGeneratedFileSources({});
        return;
      }

      const passportSource = buildPassportPdfSource(order);
      const flightSource = buildFlightItineraryPdfSource(order);

      setGeneratedFileSources({
        'passport-pdf': {
          message: passportSource.message,
          path: passportSource.path,
          status: passportSource.status,
        },
        'flight-itinerary-pdf': {
          message: flightSource.message,
          path: flightSource.path,
          status: flightSource.status,
        },
      });

      if (passportSource.status === 'loading') {
        try {
          const passportBlob = await buildNotaryImagesPdfBlob([
            ...PASSPORT_TEMPLATE_IMAGE_SOURCES,
            { src: passportSource.passportFront },
            ...(passportSource.passportVisa ? [{ src: passportSource.passportVisa }] : []),
          ]);
          const passportPath = window.URL.createObjectURL(passportBlob);
          if (cancelled) {
            window.URL.revokeObjectURL(passportPath);
            return;
          }
          generatedBlobUrls.push(passportPath);
          setGeneratedFileSources((current) => ({
            ...current,
            'passport-pdf': {
              message: '根据护照模板和录单附件生成的PDF',
              path: passportPath,
              status: 'ready',
            },
          }));
        } catch {
          if (!cancelled) {
            setGeneratedFileSources((current) => ({
              ...current,
              'passport-pdf': {
                message: '护照PDF生成失败',
                path: '',
                status: 'error',
              },
            }));
          }
        }
      }

      if (flightSource.status === 'loading') {
        try {
          const flightBlob = await buildNotaryImagesPdfBlob([{ src: flightSource.flightItinerary }]);
          const flightPath = window.URL.createObjectURL(flightBlob);
          if (cancelled) {
            window.URL.revokeObjectURL(flightPath);
            return;
          }
          generatedBlobUrls.push(flightPath);
          setGeneratedFileSources((current) => ({
            ...current,
            'flight-itinerary-pdf': {
              message: '根据录单上传的行程单生成的PDF',
              path: flightPath,
              status: 'ready',
            },
          }));
        } catch {
          if (!cancelled) {
            setGeneratedFileSources((current) => ({
              ...current,
              'flight-itinerary-pdf': {
                message: '行程单生成失败',
                path: '',
                status: 'error',
              },
            }));
          }
        }
      }
    };

    void buildGeneratedPrimaryFiles();

    return () => {
      cancelled = true;
      generatedBlobUrls.forEach((url) => window.URL.revokeObjectURL(url));
    };
  }, [order?.orderId, order?.updatedAt, order?.status, order?.notaryCertificateImages]);

  useEffect(() => {
    let cancelled = false;

    const loadResolvedImages = async () => {
      const entries = await Promise.all(
        supportingFiles.map(async (file) => [file.id, await resolveLocalImageSource(file.path)] as const),
      );

      if (!cancelled) {
        setResolvedImageSources(Object.fromEntries(entries));
      }
    };

    void loadResolvedImages();

    return () => {
      cancelled = true;
    };
  }, [supportingFiles]);

  useEffect(() => {
    if (selectedFilePreviewType !== 'word' && selectedFilePreviewType !== 'spreadsheet') {
      setOfficePreviewStatus('idle');
      setOfficePreviewHtml('');
      return;
    }

    let cancelled = false;

    const loadWordTemplate = async () => {
      try {
        setOfficePreviewStatus('loading');
        const buffer = await fetchPreviewFileBuffer(selectedFile);
        const previewHtml =
          selectedFilePreviewType === 'spreadsheet'
            ? await buildSpreadsheetPreviewHtml(buffer, selectedFile.name)
            : await buildSharedWordPreviewHtml(buffer, {
                documentPath: selectedFile.path,
                resolveAssetPath: resolveWordPreviewAssetPath,
                title: selectedFile.name,
              });
        const nextHtml =
          selectedFilePreviewType === 'word' && selectedFile.id.includes('power-of-attorney')
            ? await replaceOmittedDocxImagesWithSignature(previewHtml, powerOfAttorneySignatureSource)
            : previewHtml;

        if (!cancelled) {
          setOfficePreviewHtml(nextHtml);
          setOfficePreviewStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setOfficePreviewHtml('');
          setOfficePreviewStatus('error');
        }
      }
    };

    void loadWordTemplate();

    return () => {
      cancelled = true;
    };
  }, [
    powerOfAttorneySignatureSource,
    selectedFile.id,
    selectedFile.name,
    selectedFile.path,
    selectedFile.zipEntryPath,
    selectedFile.zipPath,
    selectedFilePreviewType,
  ]);

  if (!order) {
    return (
      <div className="app-main animate-fadeIn">
        <div className="card notary-preview-empty">
          <div className="empty-state">
            <div className="empty-state__icon">404</div>
            <div className="empty-state__text">未找到对应订单，可能已被移除或编号无效。</div>
            <button className="btn btn--primary" type="button" onClick={() => navigate(NOTARY_PENDING_REVIEW_PATH)}>
              返回公证处订单列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentFileIndex = allFiles.findIndex((file) => file.id === selectedFile.id) + 1;
  const isAuditable = order.status === 'pending_review';

  const checklist: Array<{ label: string; detail: string; status: AuditItemStatus }> = [
    {
      label: '核心预览文件',
      detail: `已提供 ${primaryFiles.length} 份主材料，可直接切换核验。`,
      status: primaryFiles.length > 0 ? 'success' : 'warning',
    },
    {
      label: '附件图片',
      detail: `共 ${supportingFiles.length} 张附件图片，可补充核对原件细节。`,
      status: supportingFiles.length >= 4 ? 'success' : 'warning',
    },
    {
      label: '驾照信息完整',
      detail:
        order.licenseName && order.licenseNo && order.licenseCategory
          ? '姓名、驾照号和准驾车型已填写。'
          : '驾照信息仍有缺失，请先补齐。',
      status: order.licenseName && order.licenseNo && order.licenseCategory ? 'success' : 'warning',
    },
    {
      label: '收货信息完整',
      detail:
        order.customerName && order.customerPhone && order.deliveryAddress
          ? '收件人、联系电话和收件地址已齐备。'
          : '收货信息不完整，建议退回补充。',
      status: order.customerName && order.customerPhone && order.deliveryAddress ? 'success' : 'warning',
    },
    {
      label: '委托书模板预览',
      detail: '委托书支持在页面内预览，必要时仍可下载源文件复核。',
      status: 'success',
    },
  ];

  const completedChecks = checklist.filter((item) => item.status === 'success').length;
  const completionRate = Math.round((completedChecks / checklist.length) * 100);

  const workbenchStats = [
    { label: '主材料', value: String(primaryFiles.length) },
    { label: '附件图片', value: String(supportingFiles.length) },
  ];

  const workbenchMeta = [
    { label: '产品', value: '公证单号' },
    { label: '使用国家', value: getNotaryUseCountry(order) },
    { label: '语言', value: order.language || '未配置' },
  ];

  const summaryItems = [
    { label: '驾照姓名', value: order.licenseName || '-' },
    { label: '驾照号码', value: order.licenseNo || '-' },
    { label: '准驾车型', value: order.licenseCategory || '-' },
    { label: '联系电话', value: order.customerPhone },
  ];

  const showToastMessage = (type: string, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectReason('');
  };

  const handleDownload = async () => {
    if (!selectedFile.path || selectedFile.status === 'loading' || selectedFile.status === 'error') {
      showToastMessage('error', selectedFile.message || '当前文件暂时无法打开');
      return;
    }

    if (selectedFilePreviewType === 'image') {
      const resolvedSource = resolvedImageSources[selectedFile.id] || (await resolveLocalImageSource(selectedFile.path));
      if (resolvedSource) {
        window.open(resolvedSource, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    window.open(selectedFile.path, '_blank', 'noopener,noreferrer');
  };

  const handleAuditAction = (status: OrderStatus, reason?: string) => {
    const nextRejectReason = status === 'rejected' ? reason?.trim() || '' : '';
    const currentTimestamp = now();

    updateNotaryOfficeOrder(order.orderId, {
      status,
      rejectReason: nextRejectReason,
      remark: nextRejectReason || order.remark,
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: '审核员',
          action: status === 'in_production' ? '审核通过，进入制作中' : `审核驳回：${nextRejectReason}`,
        },
      ],
    });

    if (status === 'in_production') {
      syncNotaryOfficeApprovalToManagement(
        {
          ...order,
          status,
          updatedAt: currentTimestamp,
          logs: [
            ...order.logs,
            {
              time: currentTimestamp,
              operator: '公证处审核员',
              action: '公证处审核通过，进入制作中',
            },
          ],
        },
        {
          operator: '公证处审核员',
          approvedAt: currentTimestamp,
        },
      );
    }

    if (status === 'rejected' && nextRejectReason) {
      syncNotaryOfficeRejectionToManagement(
        {
          ...order,
          status,
          rejectReason: nextRejectReason,
          remark: nextRejectReason || order.remark,
          updatedAt: currentTimestamp,
          logs: [
            ...order.logs,
            {
              time: currentTimestamp,
              operator: '公证处审核员',
              action: `公证处审核驳回：${nextRejectReason}`,
            },
          ],
        },
        {
          rejectReason: nextRejectReason,
          operator: '公证处审核员',
          rejectedAt: currentTimestamp,
        },
      );
    }

    if (status === 'in_production') {
      showToastMessage('success', '审核通过，订单已进入制作中状态');
    } else {
      showToastMessage('error', '订单已驳回，并返回列表');
    }

    window.setTimeout(() => navigate(status === 'in_production' ? NOTARY_IN_PRODUCTION_PATH : NOTARY_PENDING_REVIEW_PATH), 1400);
  };

  const renderWordFallback = () => {
    if (selectedFile.previewPath) {
      return (
        <div className="notary-preview-state">
          <div className="notary-preview-state__icon">DOCX</div>
          <h3>{selectedFile.name}</h3>
          <p>Word 模板 HTML 预览加载失败，已回退为导出图片预览。</p>
          <div className="notary-preview-state__media">
            <img
              src={selectedFile.previewPath}
              alt={`${selectedFile.name} 导出预览图`}
              className="notary-preview-viewer__image"
            />
          </div>
        </div>
      );
    }

    return (
        <div className="notary-preview-state">
          <div className="notary-preview-state__icon">{fileTypeLabel[selectedFilePreviewType]}</div>
          <h3>{selectedFile.name}</h3>
          <p>当前 Word 模板暂时无法加载，请下载原文件后继续复核。</p>
          <button className="btn btn--primary" type="button" onClick={handleDownload}>
          下载当前文件
        </button>
      </div>
    );
  };

  const renderViewer = () => {
    if (selectedFile.status === 'loading') {
      return (
        <div className="notary-preview-state">
          <div className="notary-preview-state__icon">{fileTypeLabel[selectedFilePreviewType]}</div>
          <h3>{selectedFile.name}</h3>
          <p>{selectedFile.message || '正在生成文件预览，请稍候。'}</p>
        </div>
      );
    }

    if (selectedFile.status === 'error') {
      return (
        <div className="notary-preview-state">
          <div className="notary-preview-state__icon">{fileTypeLabel[selectedFilePreviewType]}</div>
          <h3>{selectedFile.name}</h3>
          <p>{selectedFile.message || '当前文件暂时无法生成，请检查录单附件。'}</p>
        </div>
      );
    }

    if (selectedFilePreviewType === 'pdf') {
      return <iframe src={selectedFile.path} title={selectedFile.name} className="notary-preview-viewer__frame" />;
    }

    if (selectedFilePreviewType === 'image') {
      return (
        <div className="notary-preview-viewer__image-wrap">
          <ResolvedImage src={selectedFile.path} alt={selectedFile.name} className="notary-preview-viewer__image" />
        </div>
      );
    }

    if (officePreviewStatus === 'loading' || officePreviewStatus === 'idle') {
      return (
        <div className="notary-preview-state">
          <div className="notary-preview-state__icon">{fileTypeLabel[selectedFilePreviewType]}</div>
          <h3>{selectedFile.name}</h3>
          <p>{selectedFilePreviewType === 'spreadsheet' ? '正在加载 Excel 预览，请稍候。' : '正在加载 Word 预览，请稍候。'}</p>
          <button className="btn btn--secondary" type="button" onClick={handleDownload}>
            下载原始文件
          </button>
        </div>
      );
    }

    if (officePreviewStatus === 'ready' && officePreviewHtml) {
      return (
        <iframe
          title={`${selectedFile.name} 模板预览`}
          className="notary-preview-viewer__frame notary-preview-viewer__frame--docx"
          srcDoc={officePreviewHtml}
        />
      );
    }

    return renderWordFallback();
  };

  return (
    <div className="animate-fadeIn">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <header className="app-topbar notary-preview-topbar">
        <div className="notary-preview-topbar__left">
          <button
            className="btn notary-preview-topbar__action-btn notary-preview-topbar__action-btn--return"
            type="button"
            onClick={() => navigate(NOTARY_PENDING_REVIEW_PATH)}
          >
            《《 返回列表
          </button>
          <div className="notary-preview-topbar__title">
            <div className="app-topbar__breadcrumb">公证处订单 / 预览审核</div>
            <h1 className="app-topbar__title">预览审核 · {order.orderId}</h1>
          </div>
        </div>

        <div className="notary-preview-topbar__actions">
          <span className={statusTagClass(order.status)}>{t(`order.status.${order.status}`)}</span>
          <button
            className="btn btn--danger"
            type="button"
            onClick={() => setShowRejectModal(true)}
            disabled={!isAuditable}
          >
            驳回订单
          </button>
          <button
            className="btn btn--success"
            type="button"
            onClick={() => handleAuditAction('in_production')}
            disabled={!isAuditable}
          >
            审核通过
          </button>
        </div>
      </header>

      <div className="app-main notary-preview-page">
        <div className="notary-preview-layout">
          <section className="card notary-preview-browser">
            <div className="notary-preview-browser__head">
              <div>
                <div className="notary-preview-browser__eyebrow">文件预览中心</div>
                <h2>{selectedFile.name}</h2>
              </div>

              <div className="notary-preview-browser__tools">
                <span className="notary-preview-browser__count">
                  当前文件 {currentFileIndex} / {allFiles.length}
                </span>
                <button className="btn btn--secondary" type="button" onClick={handleDownload}>
                  下载当前文件
                </button>
              </div>
            </div>

            <div className="notary-preview-browser__body">
              <aside className="notary-preview-file-nav">
                <div className="notary-preview-file-nav__section">
                  <div className="notary-preview-file-nav__header">
                    <h3>核心预览文件</h3>
                    <span>{primaryFiles.length} 份</span>
                  </div>
                  <div className="notary-preview-file-nav__list">
                    {primaryFiles.map((file) => (
                      <button
                        key={file.id}
                        className={`notary-preview-file-card ${
                          selectedFile.id === file.id ? 'notary-preview-file-card--active' : ''
                        }`}
                        type="button"
                        onClick={() => setSelectedFileId(file.id)}
                      >
                        <span className="notary-preview-file-card__type">{fileTypeLabel[file.type]}</span>
                        <strong>{file.name}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="notary-preview-file-nav__section">
                  <div className="notary-preview-file-nav__header">
                    <h3>附件图片</h3>
                    <span>{supportingFiles.length} 张</span>
                  </div>
                  <div className="notary-preview-thumb-list">
                    {supportingFiles.map((file) => (
                      <button
                        key={file.id}
                        className={`notary-preview-thumb ${
                          selectedFile.id === file.id ? 'notary-preview-thumb--active' : ''
                        }`}
                        type="button"
                        onClick={() => setSelectedFileId(file.id)}
                      >
                        <ResolvedImage src={file.path} alt={file.name} />
                        <span>{file.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="notary-preview-viewer-panel">
                <div className="notary-preview-viewer-panel__meta">
                  <div className="notary-preview-file-meta">
                    <span className={`notary-preview-file-chip notary-preview-file-chip--${selectedFile.group}`}>
                      {selectedFile.group === 'primary' ? '主材料' : '附件图片'}
                    </span>
                    <span className="notary-preview-file-chip notary-preview-file-chip--type">
                      {fileTypeLabel[selectedFilePreviewType]}
                    </span>
                    {!selectedFile.canInlinePreview && <span className="notary-preview-file-tip">需下载后查看</span>}
                  </div>
                </div>

                <div className="notary-preview-viewer">{renderViewer()}</div>
              </div>
            </div>
          </section>

          <aside className="notary-preview-sidebar">
            <section className="card notary-preview-console">
              <div className="notary-preview-console__hero">
                <span className="notary-preview-console__eyebrow">公证审核工作台</span>
              </div>

              <div className="notary-preview-console__stats">
                {workbenchStats.map((item) => (
                  <div key={item.label} className="notary-preview-stat">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="notary-preview-console__meta">
                {workbenchMeta.map((item) => (
                  <div key={item.label} className="notary-preview-meta-pill">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="notary-preview-console__section">
                <div className="notary-preview-console__section-head">
                  <h3>审核摘要</h3>
                  <span>
                    {completedChecks}/{checklist.length} 项已就绪
                  </span>
                </div>

                <div className="notary-preview-progress">
                  <div className="notary-preview-progress__track">
                    <div className="notary-preview-progress__bar" style={{ width: `${completionRate}%` }} />
                  </div>
                  <strong>{completionRate}%</strong>
                </div>

                <dl className="notary-preview-summary">
                  {summaryItems.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="notary-preview-address">
                  <span>收货信息</span>
                  <strong>
                    {order.customerName} / {order.customerPhone}
                  </strong>
                  <p>{order.deliveryAddress}</p>
                </div>

                {order.rejectReason && (
                  <div className="notary-preview-alert notary-preview-alert--danger">
                    <span>历史驳回原因</span>
                    <strong>{order.rejectReason}</strong>
                  </div>
                )}

                <ul className="notary-preview-checklist">
                  {checklist.map((item) => (
                    <li
                      key={item.label}
                      className={`notary-preview-checklist__item notary-preview-checklist__item--${item.status}`}
                    >
                      <div className="notary-preview-checklist__marker" />
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <h3 className="modal__title">驳回订单</h3>
              <button className="btn btn--ghost btn--sm" type="button" onClick={closeRejectModal}>
                关闭
              </button>
            </div>

            <div className="modal__body">
              <p className="notary-preview-modal__hint">
                请填写驳回原因，提交后会同步给相关同事，便于重新补充资料。
              </p>
              <div className="form-group">
                <label className="form-label form-label--required">驳回原因</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="例如：委托书签字页缺失，或扫描件不清晰，请重新上传。"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </div>
            </div>

            <div className="modal__footer">
              <button className="btn btn--secondary" type="button" onClick={closeRejectModal}>
                取消
              </button>
              <button
                className="btn btn--danger"
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => handleAuditAction('rejected', rejectReason.trim())}
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaryOrderPreview;
