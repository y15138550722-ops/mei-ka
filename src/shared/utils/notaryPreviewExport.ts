export interface NotaryExportImageSource {
  label?: string;
  src: string;
}

const INVALID_DOWNLOAD_FILENAME_PATTERN = /[\\/:*?"<>|]/g;

interface PdfImagePage {
  drawHeight: number;
  drawWidth: number;
  imageBytes: Uint8Array;
  imageHeight: number;
  imageWidth: number;
  pageHeight: number;
  pageWidth: number;
  x: number;
  y: number;
}

const PDF_HEADER = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
const PDF_MARGIN = 28;
const JPEG_QUALITY = 0.92;
const JPEG_RENDER_MAX_SIDE = 1800;
const encoder = new TextEncoder();

const PDF_PAGE_SIZE = {
  landscape: { height: 595.28, width: 841.89 },
  portrait: { height: 841.89, width: 595.28 },
} as const;

const encodeText = (value: string) => encoder.encode(value);

const concatBytes = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.length;
  });

  return buffer;
};

const formatPdfNumber = (value: number) => {
  const normalizedValue = Number(value.toFixed(2));
  return Number.isInteger(normalizedValue) ? String(normalizedValue) : String(normalizedValue);
};

const ensureBrowserRuntime = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Browser export runtime is unavailable');
  }
};

const sanitizeDownloadFilenamePart = (value: string) =>
  value.replace(INVALID_DOWNLOAD_FILENAME_PATTERN, '-').trim();

const fetchAssetBlob = async (assetPath: string) => {
  const response = await fetch(assetPath);

  if (!response.ok) {
    throw new Error(`Failed to load asset: ${response.status}`);
  }

  return response.blob();
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  ensureBrowserRuntime();

  const downloadUrl = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');

  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 0);
};

const loadImageElement = (sourceBlob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    ensureBrowserRuntime();

    const objectUrl = window.URL.createObjectURL(sourceBlob);
    const image = new Image();

    image.onload = () => {
      window.URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      window.URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load export image'));
    };

    image.src = objectUrl;
  });

const canvasToJpegBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode export image'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

const buildPdfImagePage = async ({ src }: NotaryExportImageSource): Promise<PdfImagePage> => {
  ensureBrowserRuntime();

  const sourceBlob = await fetchAssetBlob(src);
  const image = await loadImageElement(sourceBlob);
  const orientation = image.naturalWidth > image.naturalHeight ? 'landscape' : 'portrait';
  const { width: pageWidth, height: pageHeight } = PDF_PAGE_SIZE[orientation];
  const renderScale = Math.min(1, JPEG_RENDER_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const renderWidth = Math.max(1, Math.round(image.naturalWidth * renderScale));
  const renderHeight = Math.max(1, Math.round(image.naturalHeight * renderScale));
  const canvas = document.createElement('canvas');

  canvas.width = renderWidth;
  canvas.height = renderHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create export canvas');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, renderWidth, renderHeight);
  context.drawImage(image, 0, 0, renderWidth, renderHeight);

  const jpegBlob = await canvasToJpegBlob(canvas);
  const imageBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const availableWidth = pageWidth - PDF_MARGIN * 2;
  const availableHeight = pageHeight - PDF_MARGIN * 2;
  const pageScale = Math.min(availableWidth / renderWidth, availableHeight / renderHeight);
  const drawWidth = renderWidth * pageScale;
  const drawHeight = renderHeight * pageScale;

  return {
    drawHeight,
    drawWidth,
    imageBytes,
    imageHeight: renderHeight,
    imageWidth: renderWidth,
    pageHeight,
    pageWidth,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
  };
};

const buildPdfDocument = (pages: PdfImagePage[]) => {
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  const objectCount = 2 + pages.length * 3;
  const chunks: Uint8Array[] = [];
  const offsets = new Array<number>(objectCount + 1).fill(0);
  let position = 0;

  const appendChunk = (chunk: Uint8Array) => {
    chunks.push(chunk);
    position += chunk.length;
  };

  const appendObject = (objectId: number, content: Array<string | Uint8Array>) => {
    offsets[objectId] = position;
    appendChunk(encodeText(`${objectId} 0 obj\n`));

    content.forEach((part) => {
      appendChunk(typeof part === 'string' ? encodeText(part) : part);
    });

    appendChunk(encodeText('\nendobj\n'));
  };

  const getObjectIds = (index: number) => ({
    content: 4 + index * 3,
    image: 5 + index * 3,
    page: 3 + index * 3,
  });

  appendChunk(PDF_HEADER);

  appendObject(catalogObjectId, [`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`]);

  const pageReferences = pages.map((_, index) => `${getObjectIds(index).page} 0 R`).join(' ');
  appendObject(pagesObjectId, [`<< /Type /Pages /Count ${pages.length} /Kids [${pageReferences}] >>`]);

  pages.forEach((page, index) => {
    const { content, image, page: pageObjectId } = getObjectIds(index);
    const imageName = `Im${index + 1}`;
    const contentStream = encodeText(
      `q\n${formatPdfNumber(page.drawWidth)} 0 0 ${formatPdfNumber(page.drawHeight)} ${formatPdfNumber(page.x)} ${formatPdfNumber(page.y)} cm\n/${imageName} Do\nQ`,
    );

    appendObject(pageObjectId, [
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${formatPdfNumber(page.pageWidth)} ${formatPdfNumber(page.pageHeight)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /${imageName} ${image} 0 R >> >> /Contents ${content} 0 R >>`,
    ]);

    appendObject(content, [`<< /Length ${contentStream.length} >>\nstream\n`, contentStream, '\nendstream']);

    appendObject(image, [
      `<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.imageBytes.length} >>\nstream\n`,
      page.imageBytes,
      '\nendstream',
    ]);
  });

  const xrefOffset = position;
  appendChunk(encodeText(`xref\n0 ${objectCount + 1}\n`));
  appendChunk(encodeText('0000000000 65535 f \n'));

  for (let objectId = 1; objectId <= objectCount; objectId += 1) {
    appendChunk(encodeText(`${String(offsets[objectId]).padStart(10, '0')} 00000 n \n`));
  }

  appendChunk(
    encodeText(
      `trailer\n<< /Size ${objectCount + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    ),
  );

  return concatBytes(chunks);
};

export const downloadNotaryAsset = async (assetPath: string, fileName: string) => {
  const blob = await fetchAssetBlob(assetPath);
  triggerBlobDownload(blob, fileName);
};

export const buildNotaryTemplatePdfFileName = (name: string) => {
  const sanitizedName = sanitizeDownloadFilenamePart(name);
  return `${sanitizedName || '未命名'}公证模版.pdf`;
};

export const buildNotaryPowerOfAttorneyFileName = (name: string, templateLabel = '') => {
  const sanitizedName = sanitizeDownloadFilenamePart(name);
  const sanitizedTemplateLabel = sanitizeDownloadFilenamePart(templateLabel);
  return `${sanitizedName || '未命名'}${sanitizedTemplateLabel}委托书.docx`;
};

export const exportNotaryImagesToPdf = async (images: NotaryExportImageSource[], fileName: string) => {
  const validImages = images.filter((image) => image.src.trim());

  if (validImages.length === 0) {
    throw new Error('No images available for export');
  }

  const pages: PdfImagePage[] = [];

  for (const image of validImages) {
    pages.push(await buildPdfImagePage(image));
  }

  const pdfBytes = buildPdfDocument(pages);
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  triggerBlobDownload(pdfBlob, fileName);
};
