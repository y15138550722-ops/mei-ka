import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrderById, updateOrder } from '../../services/mockDataService';
import type { Order } from '../../shared/types';
import {
  DOMESTIC_LICENSE_TEMPLATE_DOCX,
  DOMESTIC_LICENSE_TEMPLATE_SOURCE_NAME,
} from '../../shared/utils/domesticLicenseTranslationTemplate';
import { buildDocxPreviewHtmlFromUrl } from '../../shared/utils/docxPreview';
import { exportNotaryImageBlobsToPdf } from '../../shared/utils/notaryPreviewExport';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import './ChineseTranslationOrders.css';

type DocxPreviewStatus = 'loading' | 'ready' | 'error';
type DomesticLicenseOcrTranslation = ReturnType<typeof buildFallbackDomesticLicenseTranslation>;

const INVALID_FILENAME_CHAR_PATTERN = /[\\/:*?"<>|]/g;
const PRODUCTION_OPERATOR = '生产端';
const MADE_ACTION = '已制作';

const sanitizeFilenamePart = (value: string) => value.replace(INVALID_FILENAME_CHAR_PATTERN, '').trim();

const serializeElementAsXhtml = (element: Element) => new XMLSerializer().serializeToString(element);

const getFilledValue = (value?: string | null, fallback = '无') => value?.trim() || fallback;

const formatChineseDate = (value?: string | null) => {
  const normalizedValue = value?.trim() || '';
  const matchedDate = normalizedValue.match(/^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);

  if (!matchedDate) {
    return normalizedValue || '无';
  }

  const [, year, month, day] = matchedDate;
  return `${year}年${Number(month)}月${Number(day)}日`;
};

const translateSex = (value?: string | null) => {
  const normalizedValue = value?.trim().toUpperCase() || '';
  if (['M', 'MALE', '男'].includes(normalizedValue)) return '男';
  if (['F', 'FEMALE', '女'].includes(normalizedValue)) return '女';
  return normalizedValue || '无';
};

const translateNoneValue = (value?: string | null) => {
  const normalizedValue = value?.trim() || '';
  if (!normalizedValue || /^none$/i.test(normalizedValue)) return '无';
  return normalizedValue;
};

const buildFallbackDomesticLicenseTranslation = (order: Order | undefined) => {
  const info = order?.domesticLicenseInfo;
  const licenseNumber = getFilledValue(info?.licenseNumber || order?.licenseNo);
  const issueDate = formatChineseDate(info?.issueDate || order?.licenseFirstIssueDate);
  const expiryDate = formatChineseDate(info?.expiryDate || order?.licenseValidUntilDate);
  const birthDate = formatChineseDate(info?.birthDate || order?.licenseBirthDate);
  const classType = getFilledValue(info?.classType || order?.licenseCategory, 'D');
  const endorsements = translateNoneValue(info?.endorsements);
  const restrictions = translateNoneValue(info?.restrictions || info?.rstr);

  return {
    birthDate,
    classDescription: `准驾车型：\n${classType}类：小型车辆`,
    country: getFilledValue(info?.foreignCountry || order?.useCountry, '美国'),
    endorsements: `附加准驾资格：\n${endorsements}`,
    expiryDate,
    eyeColor: `瞳孔颜色：${getFilledValue(info?.eyeColor, '黑色')}`,
    fileAndIssueDate: `识别码：\n${getFilledValue(info?.fileNumber || order?.licenseArchiveNumber)}\n \n核发日期：${issueDate}`,
    frontPhoto: info?.frontPhoto || '',
    backPhoto: info?.backPhoto || '',
    height: `身高：${getFilledValue(info?.height, '无')}`,
    issueDate,
    licenseNumber,
    restrictions: `限制条件：\n${restrictions}`,
    sex: `性别：${translateSex(info?.sex || order?.licenseGender)}`,
    signature: `（\n签名\n）${getFilledValue(info?.chineseName || order?.licenseName || order?.customerName, '')}`,
    state: getFilledValue(info?.foreignCity || info?.foreignCountry || order?.useCountry, '马萨诸塞州'),
  };
};

const buildOcrRequestFallback = (order: Order | undefined) => {
  const info = order?.domesticLicenseInfo;

  return {
    birthDate: info?.birthDate || order?.licenseBirthDate || '',
    classType: info?.classType || order?.licenseCategory || '',
    country: info?.foreignCountry || order?.useCountry || '',
    endorsements: info?.endorsements || '',
    expiryDate: info?.expiryDate || order?.licenseValidUntilDate || '',
    eyeColor: info?.eyeColor || '',
    fileNumber: info?.fileNumber || order?.licenseArchiveNumber || '',
    height: info?.height || '',
    issueDate: info?.issueDate || order?.licenseFirstIssueDate || '',
    licenseNumber: info?.licenseNumber || order?.licenseNo || '',
    restrictions: info?.restrictions || '',
    rstr: info?.rstr || '',
    sex: info?.sex || order?.licenseGender || '',
    signatureName: info?.chineseName || order?.licenseName || order?.customerName || '',
    state: info?.foreignCity || '',
  };
};

const buildTranslationFromOcrFields = (
  order: Order | undefined,
  fields: Record<string, unknown>,
): DomesticLicenseOcrTranslation => {
  const fallback = buildFallbackDomesticLicenseTranslation(order);
  const getField = (key: string) => {
    const value = fields[key];
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  };
  const classType = getField('classType') || fallback.classDescription.match(/\n(.+?)类/)?.[1] || '';
  const issueDate = formatChineseDate(getField('issueDate')) || fallback.issueDate;
  const birthDate = formatChineseDate(getField('birthDate')) || fallback.birthDate;

  return {
    ...fallback,
    birthDate,
    classDescription: `准驾车型：\n${classType || getFilledValue(order?.domesticLicenseInfo?.classType || order?.licenseCategory, 'D')}类：小型车辆`,
    country: getField('country') || fallback.country,
    endorsements: `附加准驾资格：\n${translateNoneValue(getField('endorsements'))}`,
    expiryDate: formatChineseDate(getField('expiryDate')) || fallback.expiryDate,
    eyeColor: `瞳孔颜色：${getField('eyeColor') || fallback.eyeColor.replace(/^瞳孔颜色：/, '')}`,
    fileAndIssueDate: `识别码：\n${getField('fileNumber') || getFilledValue(order?.domesticLicenseInfo?.fileNumber || order?.licenseArchiveNumber)}\n \n核发日期：${issueDate}`,
    height: `身高：${getField('height') || fallback.height.replace(/^身高：/, '')}`,
    issueDate,
    licenseNumber: getField('licenseNumber') || fallback.licenseNumber,
    restrictions: `限制条件：\n${translateNoneValue(getField('restrictions') || getField('rstr'))}`,
    sex: `性别：${translateSex(getField('sex'))}`,
    signature: `（\n签名\n）${getField('signatureName') || fallback.signature.replace(/^（\n签名\n）/, '')}`,
    state: getField('state') || fallback.state,
  };
};

const recognizeDomesticLicenseTranslation = async (order: Order | undefined): Promise<DomesticLicenseOcrTranslation> => {
  const info = order?.domesticLicenseInfo;
  const fallback = buildFallbackDomesticLicenseTranslation(order);

  if (!info?.frontPhoto && !info?.backPhoto) {
    return fallback;
  }

  try {
    const response = await fetch('/api/ocr/domestic-license', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        backPhoto: info.backPhoto,
        fallback: buildOcrRequestFallback(order),
        frontPhoto: info.frontPhoto,
        orderId: order?.orderId,
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const result = (await response.json()) as { fields?: Record<string, unknown> };
    return buildTranslationFromOcrFields(order, result.fields || {});
  } catch (error) {
    console.warn('Domestic license OCR failed, using order fallback fields.', error);
    return fallback;
  }
};

const replaceAllText = (value: string, replacements: Array<[RegExp, string]>) =>
  replacements.reduce((nextValue, [pattern, replacement]) => nextValue.replace(pattern, replacement), value);

const applyDomesticLicenseOcrTranslationToPreview = (
  html: string,
  order: Order | undefined,
  translation: DomesticLicenseOcrTranslation,
) => {
  if (!order?.domesticLicenseInfo) {
    return html;
  }

  const documentTree = new DOMParser().parseFromString(html, 'text/html');
  const page = documentTree.querySelector<HTMLElement>('.docx-page');

  if (!page) {
    return html;
  }

  const imageElements = Array.from(page.querySelectorAll<HTMLImageElement>('.docx-image'));
  if (translation.frontPhoto && imageElements[0]) {
    imageElements[0].src = translation.frontPhoto;
    imageElements[0].alt = '驾照正面照片OCR识别来源';
  }
  if (translation.backPhoto && imageElements[1]) {
    imageElements[1].src = translation.backPhoto;
    imageElements[1].alt = '驾照反面照片OCR识别来源';
  }

  const walker = documentTree.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const replacements: Array<[RegExp, string]> = [
    [/马萨诸塞州/g, translation.state],
    [/美国/g, translation.country],
    [/签发日期\s*2024年8月21日/g, `签发日期\n${translation.issueDate}`],
    [/驾驶证编号\s*SA7711571/g, `驾驶证编号\n${translation.licenseNumber}`],
    [/有效期至\s*2029年1月19日/g, `有效期至\n${translation.expiryDate}`],
    [/出生日期\s*2000年1月19日/g, `出生日期\n${translation.birthDate}`],
    [/瞳孔颜色：黑色/g, translation.eyeColor],
    [/（\s*签名\s*）李咏锦/g, translation.signature],
    [/性别：男/g, translation.sex],
    [/身高：5英尺7英寸/g, translation.height],
    [/识别码：\s*2024年8月22日\s*核发日期：2016年2月22日/g, translation.fileAndIssueDate],
    [/2000年1月19日\s*准驾车型：\s*D类：小型车辆，重量小于26,001磅（不包括校车）/g, `${translation.birthDate}\n${translation.classDescription}`],
    [/附加准驾资格：\s*无/g, translation.endorsements],
    [/限制条件：\s*B类：佩戴矫正镜/g, translation.restrictions],
  ];

  let currentNode = walker.nextNode();
  while (currentNode) {
    currentNode.textContent = replaceAllText(currentNode.textContent || '', replacements);
    currentNode = walker.nextNode();
  }

  return `<!doctype html>\n${documentTree.documentElement.outerHTML}`;
};

const PDF_EXPORT_BORDER_OVERRIDE = `
  .docx-export-pdf {
    border: 0 !important;
    box-shadow: none !important;
  }

  .docx-export-pdf .docx-table-wrap {
    border: 1px solid #111827 !important;
    overflow: hidden !important;
  }

  .docx-export-pdf table,
  .docx-export-pdf .docx-table {
    border: 0 !important;
    border-collapse: collapse !important;
  }

  .docx-export-pdf th,
  .docx-export-pdf td,
  .docx-export-pdf .docx-table th,
  .docx-export-pdf .docx-table td {
    border: 0 !important;
  }
`;

const openPrintablePdfFallback = (html: string, title: string) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    throw new Error('Failed to open print window');
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          html,
          body {
            margin: 0;
            background: #ffffff;
          }

          body {
            padding: 0;
          }

          @page {
            margin: 0;
          }

          .docx-page {
            margin: 0 auto !important;
            box-shadow: none !important;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 300);
};

const getExportBaseName = (previewText = '') => {
  const normalizedText = previewText.trim();
  const nameMatches = [
    normalizedText.match(/中文姓名[:：]\s*([^\n\r]+)/)?.[1],
    normalizedText.match(/中文名[:：]\s*([^\n\r]+)/)?.[1],
    normalizedText.match(/姓名[:：]\s*([^\n\r]+)/)?.[1],
  ].filter(Boolean) as string[];

  const cleanedName = sanitizeFilenamePart((nameMatches[0] || '').replace(/\s+/g, ' '));
  return cleanedName || '未命名';
};

const getOrderChineseName = (order: Order | undefined) =>
  sanitizeFilenamePart(
    [
      order?.domesticLicenseInfo?.chineseName,
      order?.licenseName,
      order?.customerName,
    ]
      .find((value) => value?.trim())
      ?.replace(/\s+/g, ' ') || '',
  );

const markOrderMadeAfterPdfExport = (order: Order | undefined) => {
  if (!order) {
    return;
  }

  const timestamp = formatBeijingTimestamp();
  const nextLogs = order.logs.some((log) => log.operator === PRODUCTION_OPERATOR && log.action === MADE_ACTION)
    ? order.logs
    : [
        ...order.logs,
        {
          time: timestamp,
          operator: PRODUCTION_OPERATOR,
          action: MADE_ACTION,
        },
      ];

  updateOrder(order.orderId, {
    status: 'in_production',
    updatedAt: timestamp,
    logs: nextLogs,
  });
};

const DomesticLicenseTranslationEditor: React.FC = () => {
  const navigate = useNavigate();
  const { orderId = '' } = useParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewStatus, setPreviewStatus] = useState<DocxPreviewStatus>('loading');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [order] = useState(() => getOrderById(decodeURIComponent(orderId)));

  const handleBackToList = () => {
    navigate('/license-officer/orders/chinese-translation');
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadDocxPreview = async (cancelledRef?: { cancelled: boolean }) => {
    try {
      setPreviewStatus('loading');
      setIsEditing(false);
      const nextHtml = await buildDocxPreviewHtmlFromUrl(DOMESTIC_LICENSE_TEMPLATE_DOCX, {
        title: DOMESTIC_LICENSE_TEMPLATE_SOURCE_NAME,
      });
      const translation = await recognizeDomesticLicenseTranslation(order);
      const translatedHtml = applyDomesticLicenseOcrTranslationToPreview(nextHtml, order, translation);

      if (cancelledRef?.cancelled) {
        return;
      }

      setPreviewHtml(translatedHtml);
      setPreviewStatus('ready');
    } catch (error) {
      console.error('Failed to load domestic license DOCX preview', error);

      if (cancelledRef?.cancelled) {
        return;
      }

      setPreviewHtml('');
      setPreviewStatus('error');
      setIsEditing(false);
    }
  };

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    void loadDocxPreview(cancelledRef);

    return () => {
      cancelledRef.cancelled = true;
    };
  }, []);

  const enableEditablePreview = useCallback(() => {
    const previewDocument = iframeRef.current?.contentDocument;
    const previewPage = previewDocument?.querySelector<HTMLElement>('.docx-page');

    if (!previewDocument || !previewPage) {
      return;
    }

    previewPage.contentEditable = 'true';
    previewPage.spellcheck = false;
    previewPage.setAttribute('aria-label', '可编辑 Word 文档内容');
    previewPage.style.outline = '2px solid #2563eb';
    previewPage.style.outlineOffset = '6px';
    previewDocument.body.dataset.editing = 'true';
  }, []);

  const getCurrentPreviewHtml = useCallback(() => {
    const currentDocument = iframeRef.current?.contentDocument;

    if (!currentDocument) {
      return previewHtml;
    }

    return `<!doctype html>\n${currentDocument.documentElement.outerHTML}`;
  }, [previewHtml]);

  const getCurrentPreviewPage = useCallback(() => {
    const currentDocument = iframeRef.current?.contentDocument;
    const previewPage = currentDocument?.querySelector<HTMLElement>('.docx-page');

    if (!currentDocument || !previewPage) {
      return null;
    }

    const styles = Array.from(currentDocument.head.querySelectorAll('style'))
      .map((styleElement) => styleElement.textContent || '')
      .join('\n');
    const rect = previewPage.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width || previewPage.scrollWidth || previewPage.offsetWidth || 0));
    const height = Math.max(1, Math.ceil(rect.height || previewPage.scrollHeight || previewPage.offsetHeight || 0));
    const name = getOrderChineseName(order) || getExportBaseName(previewPage.innerText || previewPage.textContent || '');

    const pageClone = previewPage.cloneNode(true) as HTMLElement;
    pageClone.contentEditable = 'false';
    pageClone.classList.add('docx-export-pdf');
    pageClone.removeAttribute('aria-label');
    pageClone.removeAttribute('spellcheck');
    pageClone.style.outline = '';
    pageClone.style.outlineOffset = '';

    return {
      html: `<style>${styles}\n${PDF_EXPORT_BORDER_OVERRIDE}</style>${serializeElementAsXhtml(pageClone)}`,
      height,
      name,
      width,
    };
  }, [order]);

  const saveEditedPreview = useCallback(() => {
    const currentHtml = getCurrentPreviewHtml();

    if (currentHtml) {
      setPreviewHtml(currentHtml);
    }

    setIsEditing(false);
  }, [getCurrentPreviewHtml]);

  const handleToggleEditing = () => {
    if (previewStatus !== 'ready') {
      return;
    }

    if (isEditing) {
      saveEditedPreview();
      return;
    }

    setIsEditing(true);
  };

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const frameId = window.requestAnimationFrame(enableEditablePreview);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [enableEditablePreview, isEditing]);

  const handlePreviewLoad = () => {
    if (isEditing) {
      enableEditablePreview();
    }
  };

  const renderHtmlToImageBlob = useCallback(async (html: string, width: number, height: number) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">${html}</div>
        </foreignObject>
      </svg>
    `.trim();

    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to render preview as image'));
    });

    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await loaded;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create canvas for export');
    }

    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to encode export image'));
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        0.95,
      );
    });
  }, []);

  const handleExportPdf = async () => {
    if (previewStatus !== 'ready') {
      return;
    }

    const previewPage = getCurrentPreviewPage();

    if (!previewPage) {
      window.alert('无法读取当前预览内容，请先重新加载文档。');
      return;
    }

    try {
      const imageBlob = await renderHtmlToImageBlob(previewPage.html, previewPage.width, previewPage.height);
      const fileName = `${previewPage.name}中文翻译件.pdf`;

      await exportNotaryImageBlobsToPdf([{ blob: imageBlob }], fileName);
      markOrderMadeAfterPdfExport(order);
    } catch (error) {
      console.error('Failed to export domestic license PDF', error);

      try {
        openPrintablePdfFallback(previewPage.html, `${previewPage.name}正文翻译件`);
        markOrderMadeAfterPdfExport(order);
      } catch (fallbackError) {
        console.error('Failed to open domestic license PDF print fallback', fallbackError);
        window.alert('PDF 导出失败，请稍后重试。');
      }
    }
  };

  const renderPreviewContent = () => {
    if (previewStatus === 'loading') {
      return (
        <div className="license-translation-docx-state" aria-live="polite">
          <div className="license-translation-docx-state__icon">DOCX</div>
          <strong>正在加载 Word 文档</strong>
          <span>{DOMESTIC_LICENSE_TEMPLATE_SOURCE_NAME}</span>
        </div>
      );
    }

    if (previewStatus === 'error') {
      return (
        <div className="license-translation-docx-state" aria-live="polite">
          <div className="license-translation-docx-state__icon">DOCX</div>
          <strong>文档加载失败</strong>
          <span>请检查模板文件是否存在，或稍后重新加载。</span>
          <button type="button" className="license-translation-button license-translation-button--primary" onClick={() => loadDocxPreview()}>
            重新加载
          </button>
        </div>
      );
    }

    return (
      <iframe
        ref={iframeRef}
        title={`${DOMESTIC_LICENSE_TEMPLATE_SOURCE_NAME} 预览`}
        className="license-translation-docx-frame"
        srcDoc={previewHtml}
        onLoad={handlePreviewLoad}
      />
    );
  };

  return (
    <main className="license-translation-export-modal license-translation-export-page" aria-label="导出订单文档页面">
      <header className="license-translation-export-modal__header">
        <div>
          <strong>导出订单</strong>
        </div>
      </header>

      <div className="license-translation-export-modal__body license-translation-docx-viewer">
        {renderPreviewContent()}
      </div>

      <footer className="license-translation-export-modal__footer">
        <div className="license-translation-export-modal__actions">
          <button
            type="button"
            className={`license-translation-button ${
              isEditing ? 'license-translation-button--primary' : 'license-translation-button--secondary'
            }`}
            disabled={previewStatus !== 'ready'}
            onClick={handleToggleEditing}
          >
            {isEditing ? '保存修改' : '修改信息'}
          </button>
          <button
            type="button"
            className="license-translation-button license-translation-button--primary"
            disabled={previewStatus !== 'ready'}
            onClick={handleExportPdf}
          >
            导出PDF
          </button>
          <button
            type="button"
            className="license-translation-button license-translation-export-modal__back-button"
            onClick={handleBackToList}
          >
            返回列表
          </button>
        </div>
      </footer>
    </main>
  );
};

export default DomesticLicenseTranslationEditor;
