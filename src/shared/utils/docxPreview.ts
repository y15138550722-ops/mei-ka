import JSZip from 'jszip';

interface DocxPreviewOptions {
  title?: string;
}

const EMPTY_CONTENT = '<p class="docx-empty">未读取到文档内容</p>';

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

const getDirectChildElements = (element: Element | null | undefined, localName: string) => {
  if (!element) {
    return [];
  }

  return Array.from(element.childNodes).filter(
    (node): node is Element =>
      node.nodeType === Node.ELEMENT_NODE && (!localName || getLocalName(node as Element) === localName),
  );
};

const hasDirectChildElement = (element: Element | null | undefined, localName: string) =>
  Boolean(getDirectChildElement(element, localName));

const parseXmlDocument = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

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

  if (normalizedPath.endsWith('.png')) return 'image/png';
  if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedPath.endsWith('.gif')) return 'image/gif';
  if (normalizedPath.endsWith('.webp')) return 'image/webp';
  if (normalizedPath.endsWith('.svg')) return 'image/svg+xml';

  return 'application/octet-stream';
};

const twipsToPx = (value: string) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue / 15) : 0;
};

const emuToPx = (value: string) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue / 9525) : 0;
};

const getElementByLocalName = (root: Document | Element, localName: string) =>
  Array.from(root.getElementsByTagName('*')).find((element) => getLocalName(element) === localName) || null;

const getBodyElement = (documentTree: Document) => getElementByLocalName(documentTree, 'body');

const getPageWidthPx = (documentTree: Document) => {
  const pageSizeElement = getElementByLocalName(documentTree, 'pgSz');
  const pageWidth = twipsToPx(getAttributeValue(pageSizeElement, 'w:w'));

  if (!pageWidth) {
    return 820;
  }

  return Math.max(720, Math.min(pageWidth, 1180));
};

const renderPreviewShell = (content: string, options: DocxPreviewOptions & { pageWidthPx: number }) => `
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(options.title || 'DOCX 文档预览')}</title>
      <style>
        html,
        body {
          margin: 0;
          min-height: 100%;
          box-sizing: border-box;
          background: #eef2f7;
          color: #0f172a;
          font-family: "Times New Roman", "Songti SC", SimSun, serif;
        }

        body {
          padding: 28px;
          overflow: auto;
        }

        .docx-page {
          width: ${options.pageWidthPx}px;
          max-width: 100%;
          min-height: 980px;
          margin: 0 auto;
          padding: 44px 52px;
          box-sizing: border-box;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
        }

        .docx-paragraph {
          margin: 0 0 12px;
          font-size: 14px;
          line-height: 1.65;
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
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 18px;
        }

        .docx-paragraph--spacer {
          min-height: 12px;
        }

        .docx-underline {
          text-decoration: underline;
        }

        .docx-image-wrap {
          margin: 10px 0;
          text-align: center;
        }

        .docx-image {
          max-width: 100%;
          height: auto;
          display: inline-block;
        }

        .docx-table-wrap {
          overflow-x: auto;
          margin: 12px 0;
        }

        .docx-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .docx-table td {
          padding: 4px 6px;
          vertical-align: top;
        }

        .docx-table--bordered td {
          border: 1px solid #dbe2ea;
        }

        .docx-table .docx-paragraph {
          margin-bottom: 4px;
          font-size: 13px;
          line-height: 1.45;
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
          body {
            padding: 12px;
          }

          .docx-page {
            padding: 24px 18px;
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="docx-page">${content || EMPTY_CONTENT}</div>
    </body>
  </html>
`;

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

const renderDocxImage = (drawingElement: Element, imageMap: Map<string, string>) => {
  const blipElement = Array.from(drawingElement.getElementsByTagName('*')).find(
    (node): node is Element => getLocalName(node as Element) === 'blip',
  );
  const embedId = getAttributeValue(blipElement, 'r:embed');
  const imageSource = embedId ? imageMap.get(embedId) : '';

  if (!imageSource) {
    return '';
  }

  const extentElement = Array.from(drawingElement.getElementsByTagName('*')).find(
    (node): node is Element => getLocalName(node as Element) === 'extent',
  );
  const widthPx = emuToPx(getAttributeValue(extentElement, 'cx'));
  const heightPx = emuToPx(getAttributeValue(extentElement, 'cy'));
  const style = [
    widthPx ? `width:${widthPx}px` : '',
    heightPx ? `height:${heightPx}px` : '',
    widthPx || heightPx ? 'object-fit:contain' : '',
  ]
    .filter(Boolean)
    .join(';');

  return `<div class="docx-image-wrap"><img class="docx-image" src="${imageSource}" alt="docx-preview-image"${
    style ? ` style="${style}"` : ''
  } /></div>`;
};

const buildRunStyle = (runProperties: Element | null) => {
  const style: string[] = [];
  const sizeValue = getAttributeValue(getDirectChildElement(runProperties, 'sz'), 'w:val');
  const fontSize = Number(sizeValue);
  const colorValue = getAttributeValue(getDirectChildElement(runProperties, 'color'), 'w:val');

  if (Number.isFinite(fontSize) && fontSize > 0) {
    style.push(`font-size:${fontSize / 2}pt`);
  }

  if (colorValue && colorValue !== 'auto') {
    style.push(`color:#${colorValue}`);
  }

  return style.join(';');
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

  if (!content.includes('docx-image-wrap')) {
    const style = buildRunStyle(runProperties);
    if (style) {
      content = `<span style="${style}">${content}</span>`;
    }
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

    if (localName === 'hyperlink' || localName === 'sdt' || localName === 'smartTag') {
      content += renderDocxRunContainer(element, imageMap);
      return;
    }

    if (localName !== 'pPr' && element.childNodes.length > 0) {
      content += renderDocxRunContainer(element, imageMap);
    }
  });

  return content;
};

const buildParagraphStyle = (paragraphProperties: Element | null) => {
  const style: string[] = [];
  const spacingElement = getDirectChildElement(paragraphProperties, 'spacing');
  const before = twipsToPx(getAttributeValue(spacingElement, 'w:before'));
  const after = twipsToPx(getAttributeValue(spacingElement, 'w:after'));

  if (before) {
    style.push(`margin-top:${before}px`);
  }

  if (after) {
    style.push(`margin-bottom:${after}px`);
  }

  return style.join(';');
};

const renderDocxParagraph = (paragraphElement: Element, imageMap: Map<string, string>) => {
  const paragraphProperties = getDirectChildElement(paragraphElement, 'pPr');
  const alignmentValue = getAttributeValue(getDirectChildElement(paragraphProperties, 'jc'), 'w:val');
  const styleValue = getAttributeValue(getDirectChildElement(paragraphProperties, 'pStyle'), 'w:val').toLowerCase();
  const classes = ['docx-paragraph'];
  const style = buildParagraphStyle(paragraphProperties);

  if (alignmentValue === 'center') {
    classes.push('docx-paragraph--center');
  } else if (alignmentValue === 'right') {
    classes.push('docx-paragraph--right');
  }

  if (styleValue.includes('heading') || styleValue.includes('title')) {
    classes.push('docx-paragraph--heading');
  }

  const content = renderDocxRunContainer(paragraphElement, imageMap).trim();
  const styleAttribute = style ? ` style="${style}"` : '';

  if (!content) {
    return `<p class="${classes.join(' ')} docx-paragraph--spacer"${styleAttribute}><br /></p>`;
  }

  return `<p class="${classes.join(' ')}"${styleAttribute}>${content}</p>`;
};

const hasVisibleTableBorders = (tableElement: Element) => {
  const bordersElement = getDirectChildElement(getDirectChildElement(tableElement, 'tblPr'), 'tblBorders');

  if (!bordersElement) {
    return false;
  }

  return getDirectChildElements(bordersElement, '').some((borderElement) => {
    const borderValue = getAttributeValue(borderElement, 'w:val');
    return borderValue && borderValue !== 'nil' && borderValue !== 'none';
  });
};

const renderDocxTableCell = (cellElement: Element, imageMap: Map<string, string>): string => {
  const cellProperties = getDirectChildElement(cellElement, 'tcPr');
  const gridSpan = Number(getAttributeValue(getDirectChildElement(cellProperties, 'gridSpan'), 'w:val'));
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
  const colSpanAttribute = Number.isFinite(gridSpan) && gridSpan > 1 ? ` colspan="${gridSpan}"` : '';

  return `<td${colSpanAttribute}>${blocks || '&nbsp;'}</td>`;
};

function renderDocxTable(tableElement: Element, imageMap: Map<string, string>): string {
  const gridColumns = getDirectChildElements(getDirectChildElement(tableElement, 'tblGrid'), 'gridCol')
    .map((columnElement) => Number(getAttributeValue(columnElement, 'w:w')))
    .filter((width) => Number.isFinite(width) && width > 0);
  const totalGridWidth = gridColumns.reduce((sum, width) => sum + width, 0);
  const colGroup =
    totalGridWidth > 0
      ? `<colgroup>${gridColumns
          .map((width) => `<col style="width:${(width / totalGridWidth) * 100}%" />`)
          .join('')}</colgroup>`
      : '';
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

  const tableClassName = hasVisibleTableBorders(tableElement) ? 'docx-table docx-table--bordered' : 'docx-table';

  return `<div class="docx-table-wrap"><table class="${tableClassName}">${colGroup}<tbody>${rows}</tbody></table></div>`;
}

export const buildDocxPreviewHtml = async (buffer: ArrayBuffer, options: DocxPreviewOptions = {}) => {
  const zip = await JSZip.loadAsync(buffer);
  const documentEntry = zip.file('word/document.xml');

  if (!documentEntry) {
    throw new Error('Missing word/document.xml');
  }

  const [documentXml, imageMap] = await Promise.all([documentEntry.async('string'), buildDocxImageMap(zip)]);
  const documentTree = parseXmlDocument(documentXml);
  const bodyElement = getBodyElement(documentTree);

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

  return renderPreviewShell(content, {
    ...options,
    pageWidthPx: getPageWidthPx(documentTree),
  });
};

export const buildDocxPreviewHtmlFromUrl = async (url: string, options: DocxPreviewOptions = {}) => {
  const response = await fetch(encodeURI(url));

  if (!response.ok) {
    throw new Error(`Failed to load DOCX: ${response.status}`);
  }

  return buildDocxPreviewHtml(await response.arrayBuffer(), options);
};
