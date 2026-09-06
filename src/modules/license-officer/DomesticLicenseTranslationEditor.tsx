import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getOrderById, updateOrder } from '../../services/mockDataService';
import type { Order } from '../../shared/types';
import {
  DOMESTIC_LICENSE_MEDIA_TEMPLATE_IMAGE,
  DOMESTIC_LICENSE_TEMPLATE_DOCX,
  DOMESTIC_LICENSE_TEMPLATE_SOURCE_NAME,
} from '../../shared/utils/domesticLicenseTranslationTemplate';
import { buildDocxPreviewHtmlFromUrl } from '../../shared/utils/docxPreview';
import { exportNotaryImageBlobsToPdf } from '../../shared/utils/notaryPreviewExport';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { getStoredAuthSession } from '../../shared/utils/auth';
import { resolveLocalImageSource } from '../../shared/utils/localImageStore';
import { isProductionVisibleChineseTranslationOrder } from './productionOrderVisibility';
import './ChineseTranslationOrders.css';

type DocxPreviewStatus = 'loading' | 'ready' | 'error' | 'unavailable';
type DomesticLicenseOcrTranslation = ReturnType<typeof buildFallbackDomesticLicenseTranslation>;
type ImageCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type DomesticLicenseExtractedAssets = {
  portraitPhoto?: string;
  signaturePhoto?: string;
};
type DomesticLicenseOcrRow = {
  fieldKey?: unknown;
  originalText?: unknown;
  translatedText?: unknown;
};
type PixelCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const INVALID_FILENAME_CHAR_PATTERN = /[\\/:*?"<>|]/g;
const PRODUCTION_OPERATOR = '生产端';
const MADE_ACTION = '已制作';
export const DOMESTIC_LICENSE_ASSET_EXTRACTION_VERSION = 2;
const FRONT_LICENSE_PORTRAIT_CROP: ImageCropRect = { x: 0.04, y: 0.2, width: 0.38, height: 0.62 };
const FRONT_LICENSE_SIGNATURE_CROP: ImageCropRect = { x: 0.07, y: 0.79, width: 0.34, height: 0.18 };
const FRONT_LICENSE_SIGNATURE_SEARCH_RECT: ImageCropRect = { x: 0.04, y: 0.76, width: 0.38, height: 0.22 };

const sanitizeFilenamePart = (value: string) => value.replace(INVALID_FILENAME_CHAR_PATTERN, '').trim();

const getCurrentProductionOperatorName = () => {
  const session = getStoredAuthSession();
  return session?.displayName?.trim() || session?.username?.trim() || PRODUCTION_OPERATOR;
};

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

const CHINESE_COMPOUND_SURNAMES = ['欧阳', '司马', '上官', '诸葛', '东方', '皇甫', '尉迟', '公孙'];

const splitChineseName = (value?: string | null) => {
  const normalizedValue = value?.replace(/\s+/g, '').trim() || '';
  const compoundSurname = CHINESE_COMPOUND_SURNAMES.find((surname) => normalizedValue.startsWith(surname));
  const surname = compoundSurname || normalizedValue.slice(0, 1);

  return {
    surname,
    givenName: normalizedValue.slice(surname.length),
  };
};

const getOcrRowText = (rows: DomesticLicenseOcrRow[], fieldKey: string, kind: 'originalText' | 'translatedText') => {
  const value = rows.find((row) => row.fieldKey === fieldKey)?.[kind];
  return typeof value === 'string' ? value.trim() : '';
};

const getTranslatedNamePart = (rows: DomesticLicenseOcrRow[], fieldKey: string) => {
  const value = getOcrRowText(rows, fieldKey, 'translatedText');
  return value.match(/[：:]\s*([^\s]+)/)?.[1]?.trim() || '';
};

const stripTranslatedFieldPrefix = (value: string, pattern: RegExp) => value.replace(pattern, '').trim();

const buildFallbackDomesticLicenseTranslation = (order: Order | undefined) => {
  const info = order?.domesticLicenseInfo;
  const chineseName = getFilledValue(info?.chineseName || order?.licenseName || order?.customerName, '');
  const nameParts = splitChineseName(chineseName);
  const licenseNumber = getFilledValue(info?.licenseNumber || order?.licenseNo);
  const issueDate = formatChineseDate(info?.issueDate || order?.licenseFirstIssueDate);
  const expiryDate = formatChineseDate(info?.expiryDate || order?.licenseValidUntilDate);
  const birthDate = formatChineseDate(info?.birthDate || order?.licenseBirthDate);
  const classType = getFilledValue(info?.classType || order?.licenseCategory, 'D');
  const endorsements = translateNoneValue(info?.endorsements);
  const restrictions = translateNoneValue(info?.restrictions || info?.rstr);

  return {
    address: '',
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
    givenName: nameParts.givenName,
    restrictions: `限制条件：\n${restrictions}`,
    sex: `性别：${translateSex(info?.sex || order?.licenseGender)}`,
    signature: `（\n签名\n）${chineseName}`,
    state: getFilledValue(info?.foreignCity || info?.foreignCountry || order?.useCountry, '马萨诸塞州'),
    surname: nameParts.surname,
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
    surname: info?.surname || '',
    givenName: info?.givenName || '',
    address: '',
    revisionDate: '',
    state: info?.foreignCity || '',
  };
};

const buildTranslationFromOcrFields = (
  order: Order | undefined,
  fields: Record<string, unknown>,
  rows: DomesticLicenseOcrRow[] = [],
): DomesticLicenseOcrTranslation => {
  const fallback = buildFallbackDomesticLicenseTranslation(order);
  const getField = (key: string) => {
    const value = fields[key];
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  };
  const classType = getField('classType') || fallback.classDescription.match(/\n(.+?)类/)?.[1] || '';
  const issueDate = formatChineseDate(getField('issueDate')) || fallback.issueDate;
  const birthDate = formatChineseDate(getField('birthDate')) || fallback.birthDate;
  const translatedState = getOcrRowText(rows, 'issuingRegion', 'translatedText');
  const translatedCountry = rows.find(
    (row) => row.fieldKey === 'other' && String(row.originalText || '').trim().toUpperCase() === 'USA',
  )?.translatedText;
  const translatedAddress = stripTranslatedFieldPrefix(
    getOcrRowText(rows, 'address', 'translatedText'),
    /^8\s*住址[：:]?\s*/,
  );
  const translatedEyeColor = getOcrRowText(rows, 'eyeColor', 'translatedText');
  const translatedSex = getOcrRowText(rows, 'sex', 'translatedText');
  const translatedHeight = getOcrRowText(rows, 'height', 'translatedText');
  const translatedClassDescription = getOcrRowText(rows, 'classDescription', 'translatedText');
  const translatedEndorsements = getOcrRowText(rows, 'endorsements', 'translatedText');
  const translatedRestrictions = getOcrRowText(rows, 'restrictions', 'translatedText');
  const revisionDate = formatChineseDate(getField('revisionDate')) || issueDate;
  const translatedSurname = getTranslatedNamePart(rows, 'surname');
  const translatedGivenName = getTranslatedNamePart(rows, 'givenName');
  const orderChineseName = order?.domesticLicenseInfo?.chineseName || order?.licenseName || order?.customerName || '';
  const orderNameParts = splitChineseName(orderChineseName);
  const chineseName =
    [translatedSurname || orderNameParts.surname, translatedGivenName || orderNameParts.givenName].filter(Boolean).join('') ||
    getField('signatureName');
  const nameParts = splitChineseName(chineseName);

  return {
    ...fallback,
    address: translatedAddress || fallback.address,
    birthDate,
    classDescription:
      translatedClassDescription ||
      `准驾车型：\n${classType || getFilledValue(order?.domesticLicenseInfo?.classType || order?.licenseCategory, 'D')}类：小型车辆`,
    country: typeof translatedCountry === 'string' && translatedCountry.trim() ? translatedCountry.trim() : fallback.country,
    endorsements: translatedEndorsements || `附加准驾资格：\n${translateNoneValue(getField('endorsements'))}`,
    expiryDate: formatChineseDate(getField('expiryDate')) || fallback.expiryDate,
    eyeColor: translatedEyeColor || `瞳孔颜色：${getField('eyeColor') || fallback.eyeColor.replace(/^瞳孔颜色：/, '')}`,
    fileAndIssueDate: `识别码：\n${formatChineseDate(getField('fileNumber')) || getFilledValue(order?.domesticLicenseInfo?.fileNumber || order?.licenseArchiveNumber)}\n \n核发日期：${revisionDate}`,
    givenName: translatedGivenName || nameParts.givenName || fallback.givenName,
    height: translatedHeight || `身高：${getField('height') || fallback.height.replace(/^身高：/, '')}`,
    issueDate,
    licenseNumber: getField('licenseNumber') || fallback.licenseNumber,
    restrictions: translatedRestrictions || `限制条件：\n${translateNoneValue(getField('restrictions') || getField('rstr'))}`,
    sex: translatedSex || `性别：${translateSex(getField('sex'))}`,
    signature: `（\n签名\n）${chineseName || fallback.signature.replace(/^（\n签名\n）/, '')}`,
    state: translatedState || fallback.state,
    surname: translatedSurname || nameParts.surname || fallback.surname,
  };
};

const resolveDomesticLicenseTranslationImages = async (translation: DomesticLicenseOcrTranslation) => {
  const [frontPhoto, backPhoto] = await Promise.all([
    resolveLocalImageSource(translation.frontPhoto),
    resolveLocalImageSource(translation.backPhoto),
  ]);

  return {
    ...translation,
    frontPhoto,
    backPhoto,
  };
};

const recognizeDomesticLicenseTranslation = async (order: Order | undefined): Promise<DomesticLicenseOcrTranslation> => {
  const info = order?.domesticLicenseInfo;
  const fallback = buildFallbackDomesticLicenseTranslation(order);

  if (!info?.frontPhoto && !info?.backPhoto) {
    return resolveDomesticLicenseTranslationImages(fallback);
  }

  try {
    const [frontPhoto, backPhoto] = await Promise.all([
      resolveLocalImageSource(info.frontPhoto),
      resolveLocalImageSource(info.backPhoto),
    ]);

    const response = await fetch('/api/ocr/domestic-license', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        backPhoto,
        fallback: buildOcrRequestFallback(order),
        frontPhoto,
        orderId: order?.orderId,
      }),
    });

    if (!response.ok) {
      return resolveDomesticLicenseTranslationImages(fallback);
    }

    const result = (await response.json()) as {
      fields?: Record<string, unknown>;
      rows?: DomesticLicenseOcrRow[];
    };
    return resolveDomesticLicenseTranslationImages(
      buildTranslationFromOcrFields(order, result.fields || {}, Array.isArray(result.rows) ? result.rows : []),
    );
  } catch (error) {
    console.warn('Domestic license OCR failed, using order fallback fields.', error);
    return resolveDomesticLicenseTranslationImages(fallback);
  }
};

const replaceAllText = (value: string, replacements: Array<[RegExp, string]>) =>
  replacements.reduce((nextValue, [pattern, replacement]) => nextValue.replace(pattern, replacement), value);

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clampCropRect = (rect: ImageCropRect): ImageCropRect => {
  const x = clampValue(rect.x, 0, 0.98);
  const y = clampValue(rect.y, 0, 0.98);
  const width = clampValue(rect.width, 0.01, 1 - x);
  const height = clampValue(rect.height, 0.01, 1 - y);

  return { x, y, width, height };
};

const pixelRectToCropRect = (rect: PixelCropRect, imageWidth: number, imageHeight: number): ImageCropRect =>
  clampCropRect({
    x: rect.x / imageWidth,
    y: rect.y / imageHeight,
    width: rect.width / imageWidth,
    height: rect.height / imageHeight,
  });

const expandPixelRect = (
  rect: PixelCropRect,
  paddingX: number,
  paddingY: number,
  imageWidth: number,
  imageHeight: number,
): PixelCropRect => {
  const x = clampValue(rect.x - paddingX, 0, imageWidth - 1);
  const y = clampValue(rect.y - paddingY, 0, imageHeight - 1);
  const right = clampValue(rect.x + rect.width + paddingX, x + 1, imageWidth);
  const bottom = clampValue(rect.y + rect.height + paddingY, y + 1, imageHeight);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
};

const loadImageElement = async (src: string) => {
  const image = new Image();
  const shouldUseCors = /^https?:\/\//i.test(src) && !src.startsWith(window.location.origin);
  if (shouldUseCors) {
    image.crossOrigin = 'anonymous';
  }

  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load driving license front photo'));
  });

  image.src = src;

  if ('decode' in image) {
    try {
      await image.decode();
      return image;
    } catch {
      return loaded;
    }
  }

  return loaded;
};

const drawImageToCanvas = (image: HTMLImageElement, maxWidth = 0) => {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = maxWidth && naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create driving license canvas');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const cropImageToCanvas = (image: HTMLImageElement, rect: ImageCropRect) => {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const normalizedRect = clampCropRect(rect);
  const sourceX = Math.max(0, Math.round(naturalWidth * normalizedRect.x));
  const sourceY = Math.max(0, Math.round(naturalHeight * normalizedRect.y));
  const sourceWidth = Math.max(1, Math.min(naturalWidth - sourceX, Math.round(naturalWidth * normalizedRect.width)));
  const sourceHeight = Math.max(1, Math.min(naturalHeight - sourceY, Math.round(naturalHeight * normalizedRect.height)));
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create driving license crop canvas');
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return canvas;
};

const getPixelMetrics = (data: Uint8ClampedArray, index: number) => {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;

  return { alpha, luminance, saturation };
};

const isSignatureInkPixel = (data: Uint8ClampedArray, index: number) => {
  const { alpha, luminance, saturation } = getPixelMetrics(data, index);

  return alpha > 24 && luminance < 155 && (luminance < 118 || saturation > 0.08);
};

const detectSignatureCropRect = (image: HTMLImageElement): ImageCropRect | null => {
  const canvas = drawImageToCanvas(image, 700);
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const searchRect = clampCropRect(FRONT_LICENSE_SIGNATURE_SEARCH_RECT);
  const searchX = Math.round(canvas.width * searchRect.x);
  const searchY = Math.round(canvas.height * searchRect.y);
  const searchWidth = Math.max(1, Math.round(canvas.width * searchRect.width));
  const searchHeight = Math.max(1, Math.round(canvas.height * searchRect.height));
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const rowCounts = new Array(searchHeight).fill(0) as number[];

  for (let y = searchY; y < searchY + searchHeight; y += 1) {
    for (let x = searchX; x < searchX + searchWidth; x += 1) {
      const pixelIndex = (y * canvas.width + x) * 4;

      if (isSignatureInkPixel(data, pixelIndex)) {
        rowCounts[y - searchY] += 1;
      }
    }
  }

  const rowThreshold = Math.max(2, Math.round(searchWidth * 0.008));
  const bands: Array<{ start: number; end: number }> = [];
  let bandStart = -1;
  let lastInkRow = -1;

  rowCounts.forEach((count, rowIndex) => {
    if (count >= rowThreshold) {
      if (bandStart < 0) {
        bandStart = rowIndex;
      }
      lastInkRow = rowIndex;
      return;
    }

    if (bandStart >= 0 && rowIndex - lastInkRow > 2) {
      bands.push({ start: bandStart, end: lastInkRow });
      bandStart = -1;
      lastInkRow = -1;
    }
  });

  if (bandStart >= 0) {
    bands.push({ start: bandStart, end: lastInkRow });
  }

  let bestRect: PixelCropRect | null = null;
  let bestScore = 0;

  bands.forEach((band) => {
    let minX = searchX + searchWidth;
    let minY = searchY + searchHeight;
    let maxX = searchX;
    let maxY = searchY;
    let inkCount = 0;
    const absoluteStartY = searchY + band.start;
    const absoluteEndY = searchY + band.end;

    for (let y = absoluteStartY; y <= absoluteEndY; y += 1) {
      for (let x = searchX; x < searchX + searchWidth; x += 1) {
        const pixelIndex = (y * canvas.width + x) * 4;

        if (!isSignatureInkPixel(data, pixelIndex)) {
          continue;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        inkCount += 1;
      }
    }

    const rectWidth = maxX - minX + 1;
    const rectHeight = maxY - minY + 1;
    const centerY = minY + rectHeight / 2;

    if (
      inkCount < 20 ||
      rectWidth < canvas.width * 0.08 ||
      rectHeight < 3 ||
      rectHeight > canvas.height * 0.13 ||
      centerY < canvas.height * 0.82
    ) {
      return;
    }

    const aspectScore = rectWidth / Math.max(1, rectHeight);
    const lowerPositionBonus = (minY - searchY) / searchHeight;
    const score = rectWidth + aspectScore * 8 + lowerPositionBonus * canvas.width * 0.45;

    if (score > bestScore) {
      bestScore = score;
      bestRect = expandPixelRect(
        { x: minX, y: minY, width: rectWidth, height: rectHeight },
        Math.round(canvas.width * 0.018),
        Math.round(canvas.height * 0.018),
        canvas.width,
        canvas.height,
      );
    }
  });

  if (!bestRect) {
    return null;
  }

  return pixelRectToCropRect(bestRect, canvas.width, canvas.height);
};

const makeSignatureCanvasTransparent = (sourceCanvas: HTMLCanvasElement) => {
  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    return sourceCanvas;
  }

  const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const hasDarkInk = alpha > 24 && luminance < 125;

    if (luminance > 186 || !hasDarkInk) {
      data[index + 3] = 0;
      continue;
    }

    const inkAlpha = clampValue(Math.round((150 - luminance) * 2.4), 48, 255);
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
    data[index + 3] = Math.min(alpha, inkAlpha);
  }

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const visited = new Uint8Array(width * height);
  const minimumComponentSize = Math.max(6, Math.round(width * height * 0.0008));

  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (visited[pixel] || data[pixel * 4 + 3] === 0) {
      continue;
    }

    const stack = [pixel];
    const component: number[] = [];
    let componentMinX = width;
    let componentMinY = height;
    let componentMaxX = 0;
    let componentMaxY = 0;
    visited[pixel] = 1;

    while (stack.length > 0) {
      const currentPixel = stack.pop() as number;
      const currentX = currentPixel % width;
      const currentY = Math.floor(currentPixel / width);
      component.push(currentPixel);
      componentMinX = Math.min(componentMinX, currentX);
      componentMinY = Math.min(componentMinY, currentY);
      componentMaxX = Math.max(componentMaxX, currentX);
      componentMaxY = Math.max(componentMaxY, currentY);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = currentX + offsetX;
          const nextY = currentY + offsetY;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const nextPixel = nextY * width + nextX;
          if (visited[nextPixel] || data[nextPixel * 4 + 3] === 0) continue;
          visited[nextPixel] = 1;
          stack.push(nextPixel);
        }
      }
    }

    const componentWidth = componentMaxX - componentMinX + 1;
    const componentHeight = componentMaxY - componentMinY + 1;
    const touchesCropEdge =
      componentMinX === 0 || componentMinY === 0 || componentMaxX === width - 1 || componentMaxY === height - 1;
    const isLongThinArtifact = componentWidth > width * 0.72 && componentHeight < height * 0.15;
    if (component.length >= minimumComponentSize && !touchesCropEdge && !isLongThinArtifact) {
      continue;
    }

    component.forEach((componentPixel) => {
      data[componentPixel * 4 + 3] = 0;
    });
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasInk = false;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (data[pixel * 4 + 3] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    hasInk = true;
  }

  sourceContext.putImageData(imageData, 0, 0);

  if (!hasInk) {
    return sourceCanvas;
  }

  const padding = 8;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(sourceCanvas.width - cropX, maxX - minX + padding * 2);
  const cropHeight = Math.min(sourceCanvas.height - cropY, maxY - minY + padding * 2);
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = Math.max(1, cropWidth);
  trimmedCanvas.height = Math.max(1, cropHeight);
  const trimmedContext = trimmedCanvas.getContext('2d');

  if (!trimmedContext) {
    return sourceCanvas;
  }

  trimmedContext.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return trimmedCanvas;
};

export const extractDomesticLicenseFrontAssets = async (
  frontPhoto?: string,
): Promise<DomesticLicenseExtractedAssets> => {
  if (!frontPhoto) {
    return {};
  }

  try {
    const image = await loadImageElement(frontPhoto);
    const signatureCropRect = detectSignatureCropRect(image) || FRONT_LICENSE_SIGNATURE_CROP;
    const portraitCanvas = cropImageToCanvas(image, FRONT_LICENSE_PORTRAIT_CROP);
    const signatureCanvas = makeSignatureCanvasTransparent(cropImageToCanvas(image, signatureCropRect));

    return {
      portraitPhoto: portraitCanvas.toDataURL('image/jpeg', 0.94),
      signaturePhoto: signatureCanvas.toDataURL('image/png'),
    };
  } catch (error) {
    console.warn('Failed to extract portrait/signature from driving license front photo.', error);
    return {};
  }
};

const getDocxPreviewFrontImageSource = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html').querySelector<HTMLImageElement>('.docx-image')?.src || '';

const ensureExtractedAssetStyles = (documentTree: Document) => {
  if (documentTree.head.querySelector('[data-domestic-license-extracted-asset-style="true"]')) {
    return;
  }

  const styleElement = documentTree.createElement('style');
  styleElement.dataset.domesticLicenseExtractedAssetStyle = 'true';
  styleElement.textContent = `
    .domestic-license-extracted-slot {
      width: 100%;
      min-height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      overflow: hidden;
    }

    .domestic-license-extracted-slot--portrait {
      min-height: 170px;
    }

    .domestic-license-extracted-slot--signature {
      min-height: 56px;
    }

    .domestic-license-extracted-slot img {
      display: block;
      max-width: 100%;
      max-height: 100%;
    }

    .domestic-license-extracted-slot--portrait img {
      width: 100%;
      height: 164px;
      object-fit: contain;
    }

    .domestic-license-extracted-slot--signature img {
      width: 100%;
      height: 48px;
      object-fit: contain;
    }

    .domestic-license-portrait-cell {
      padding: 0 !important;
      vertical-align: middle !important;
    }
  `;
  documentTree.head.appendChild(styleElement);
};

const ensureDomesticLicensePreviewFontWeightStyle = (documentTree: Document) => {
  if (documentTree.head.querySelector('[data-domestic-license-preview-font-weight-style="true"]')) {
    return;
  }

  const styleElement = documentTree.createElement('style');
  styleElement.dataset.domesticLicensePreviewFontWeightStyle = 'true';
  styleElement.textContent = `
    .docx-page,
    .docx-page * {
      font-weight: 400 !important;
    }
  `;
  documentTree.head.appendChild(styleElement);
};

const findPlaceholderCell = (page: HTMLElement, pattern: RegExp) =>
  Array.from(page.querySelectorAll<HTMLTableCellElement>('td')).find((cell) => pattern.test(cell.textContent || '')) ||
  null;

const replacePlaceholderCellWithExtractedImage = (
  page: HTMLElement,
  pattern: RegExp,
  imageSrc: string | undefined,
  kind: 'portrait' | 'signature',
) => {
  const placeholderCell = findPlaceholderCell(page, pattern);

  if (!placeholderCell) {
    return null;
  }

  if (!imageSrc) {
    return placeholderCell;
  }

  const documentTree = page.ownerDocument;
  const slot = documentTree.createElement('div');
  slot.className = `domestic-license-extracted-slot domestic-license-extracted-slot--${kind}`;
  const image = documentTree.createElement('img');
  image.src = imageSrc;
  image.alt = kind === 'portrait' ? '驾驶证正面识别头像' : '驾驶证正面识别签名';
  slot.appendChild(image);

  placeholderCell.innerHTML = '';
  placeholderCell.appendChild(slot);
  placeholderCell.style.padding = '0';
  placeholderCell.style.verticalAlign = 'middle';
  return placeholderCell;
};

const mergeDomesticLicensePortraitContinuationCells = (
  portraitCell: HTMLTableCellElement | null,
  signatureCell: HTMLTableCellElement | null,
) => {
  if (!portraitCell || !signatureCell || portraitCell === signatureCell) {
    return;
  }

  const table = portraitCell.closest('table');
  const portraitRow = portraitCell.parentElement;
  const signatureRow = signatureCell.parentElement;

  if (
    !table ||
    !portraitRow ||
    !signatureRow ||
    signatureCell.closest('table') !== table ||
    portraitRow.tagName.toLowerCase() !== 'tr' ||
    signatureRow.tagName.toLowerCase() !== 'tr' ||
    portraitCell.cellIndex !== signatureCell.cellIndex
  ) {
    return;
  }

  const rows = Array.from(table.rows);
  const startRowIndex = rows.indexOf(portraitRow as HTMLTableRowElement);
  const endRowIndex = rows.indexOf(signatureRow as HTMLTableRowElement);

  if (startRowIndex < 0 || endRowIndex <= startRowIndex) {
    return;
  }

  const targetColumnIndex = portraitCell.cellIndex;
  portraitCell.classList.add('domestic-license-portrait-cell');
  portraitCell.rowSpan = endRowIndex - startRowIndex;
  portraitCell.style.padding = '0';
  portraitCell.style.verticalAlign = 'middle';

  // DOCX represents the photo area with w:vMerge. The HTML preview renderer
  // emits those continuations as separate cells, so consolidate only the rows
  // above the signature row and leave the signature cell/border untouched.
  for (let rowIndex = startRowIndex + 1; rowIndex < endRowIndex; rowIndex += 1) {
    const cellToRemove = rows[rowIndex]?.cells[targetColumnIndex];

    if (cellToRemove && cellToRemove !== portraitCell) {
      cellToRemove.remove();
    }
  }
};

const applyDomesticLicenseOcrTranslationToPreview = (
  html: string,
  order: Order | undefined,
  translation: DomesticLicenseOcrTranslation,
  extractedAssets: DomesticLicenseExtractedAssets = {},
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
    [/马萨诸塞州切尔西市瓦尔街255号4611室，邮编02150-1585/g, translation.address || '马萨诸塞州切尔西市瓦尔街255号4611室，邮编02150-1585'],
    [/姓\s*[：:]\s*李/g, `姓：${translation.surname}`],
    [/名\s*[：:]\s*咏锦/g, `名：${translation.givenName}`],
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

  const hasExtractedMedia = Boolean(extractedAssets.portraitPhoto || extractedAssets.signaturePhoto);
  let portraitCell: HTMLTableCellElement | null = null;
  let signatureCell: HTMLTableCellElement | null = null;

  if (hasExtractedMedia) {
    ensureExtractedAssetStyles(documentTree);
    portraitCell = replacePlaceholderCellWithExtractedImage(
      page,
      /[（(]?\s*照片\s*[）)]?/,
      extractedAssets.portraitPhoto,
      'portrait',
    );
    signatureCell = replacePlaceholderCellWithExtractedImage(
      page,
      /[（(]?\s*签名\s*[）)]?/,
      extractedAssets.signaturePhoto,
      'signature',
    );
  } else {
    portraitCell = findPlaceholderCell(page, /[（(]?\s*照片\s*[）)]?/);
    signatureCell = findPlaceholderCell(page, /[（(]?\s*签名\s*[）)]?/);
  }

  if (portraitCell && signatureCell) {
    ensureExtractedAssetStyles(documentTree);
    // Keep the portrait and signature as separate template assets. The full license image
    // is already shown at the top of the document and must not replace this media column.
    mergeDomesticLicensePortraitContinuationCells(portraitCell, signatureCell);
  }

  ensureDomesticLicensePreviewFontWeightStyle(documentTree);

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

const getOrderLicenseIssuingLocation = (order: Order | undefined) =>
  sanitizeFilenamePart(
    [order?.domesticLicenseInfo?.foreignCountry, order?.domesticLicenseInfo?.foreignCity]
      .map((value) => value?.trim() || '')
      .filter(Boolean)
      .join(''),
  );

const getOrderPdfBaseName = (order: Order | undefined, previewText = '') => {
  const orderFieldName = `${getOrderChineseName(order)}${getOrderLicenseIssuingLocation(order)}`;
  return orderFieldName || getExportBaseName(previewText);
};

const markOrderMadeAfterPdfExport = (order: Order | undefined) => {
  if (!order) {
    return;
  }

  const timestamp = formatBeijingTimestamp();
  const nextLogs = order.logs.some((log) => log.action === MADE_ACTION)
    ? order.logs
    : [
        ...order.logs,
        {
          time: timestamp,
          operator: getCurrentProductionOperatorName(),
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
  const [searchParams] = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [order] = useState(() => getOrderById(decodeURIComponent(orderId)));
  const isProductionVisibleOrder = Boolean(order && isProductionVisibleChineseTranslationOrder(order));
  const [previewStatus, setPreviewStatus] = useState<DocxPreviewStatus>(
    isProductionVisibleOrder ? 'loading' : 'unavailable',
  );
  const [previewHtml, setPreviewHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleBackToList = () => {
    navigate('/license-officer/orders/chinese-translation');
  };

  const navigateBackToSourceList = () => {
    const fromStatus = searchParams.get('fromStatus');
    navigate(`/license-officer/orders/chinese-translation${fromStatus ? `?status=${fromStatus}` : ''}`);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadDocxPreview = async (cancelledRef?: { cancelled: boolean }) => {
    if (!isProductionVisibleOrder) {
      setPreviewStatus('unavailable');
      setPreviewHtml('');
      setIsEditing(false);
      return;
    }

    try {
      setPreviewStatus('loading');
      setIsEditing(false);
      const nextHtml = await buildDocxPreviewHtmlFromUrl(DOMESTIC_LICENSE_TEMPLATE_DOCX, {
        title: DOMESTIC_LICENSE_TEMPLATE_SOURCE_NAME,
      });
      const frontImageSource =
        (await resolveLocalImageSource(order?.domesticLicenseInfo?.frontPhoto)) ||
        DOMESTIC_LICENSE_MEDIA_TEMPLATE_IMAGE ||
        getDocxPreviewFrontImageSource(nextHtml);
      const hasCurrentStoredAssets =
        order?.domesticLicenseInfo?.translationAssetVersion === DOMESTIC_LICENSE_ASSET_EXTRACTION_VERSION;
      const [translation, storedPortraitPhoto, storedSignaturePhoto] = await Promise.all([
        recognizeDomesticLicenseTranslation(order),
        hasCurrentStoredAssets
          ? resolveLocalImageSource(order?.domesticLicenseInfo?.portraitPhoto)
          : Promise.resolve(''),
        hasCurrentStoredAssets
          ? resolveLocalImageSource(order?.domesticLicenseInfo?.signaturePhoto)
          : Promise.resolve(''),
      ]);
      const detectedAssets =
        !storedPortraitPhoto || !storedSignaturePhoto
          ? await extractDomesticLicenseFrontAssets(frontImageSource)
          : {};
      const extractedAssets = {
        ...detectedAssets,
        portraitPhoto: storedPortraitPhoto || detectedAssets.portraitPhoto,
        signaturePhoto: storedSignaturePhoto || detectedAssets.signaturePhoto,
      };
      const translatedHtml = applyDomesticLicenseOcrTranslationToPreview(nextHtml, order, translation, extractedAssets);

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
    const name = getOrderPdfBaseName(order, previewPage.innerText || previewPage.textContent || '');

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
      const fileName = `${previewPage.name}.pdf`;

      await exportNotaryImageBlobsToPdf([{ blob: imageBlob }], fileName);
      markOrderMadeAfterPdfExport(order);
      navigateBackToSourceList();
    } catch (error) {
      console.error('Failed to export domestic license PDF', error);

      try {
        openPrintablePdfFallback(previewPage.html, previewPage.name);
        markOrderMadeAfterPdfExport(order);
        navigateBackToSourceList();
      } catch (fallbackError) {
        console.error('Failed to open domestic license PDF print fallback', fallbackError);
        window.alert('PDF 导出失败，请稍后重试。');
      }
    }
  };

  const renderPreviewContent = () => {
    if (previewStatus === 'unavailable') {
      return (
        <div className="license-translation-docx-state" aria-live="polite">
          <div className="license-translation-docx-state__icon">WAIT</div>
          <strong>订单尚未推送到生产端</strong>
          <span>管理端审核通过后，生产端才会显示订单并开放导出操作。</span>
        </div>
      );
    }

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
