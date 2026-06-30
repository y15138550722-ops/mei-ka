import JSZip from 'jszip';

type PreviewSheet = {
  name: string;
  rows: Map<number, string>[];
  maxColumnCount: number;
};

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;

const escapePreviewHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getElementLocalName = (node: Element | Node) => {
  if ('localName' in node && node.localName) {
    return node.localName;
  }

  return node.nodeName.split(':').pop() || node.nodeName;
};

const getElementsByLocalName = (root: Document | Element, localName: string) =>
  Array.from(root.getElementsByTagName('*')).filter((element) => getElementLocalName(element) === localName);

const buildPreviewDocument = (title: string, bodyContent: string) => `
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        html,
        body {
          margin: 0;
          min-height: 100%;
          background: #eef2f7;
          color: #0f172a;
          font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
        }

        body {
          box-sizing: border-box;
          padding: 24px;
        }

        .preview-page {
          width: 960px;
          max-width: 100%;
          min-height: calc(100vh - 48px);
          margin: 0 auto;
          padding: 42px 52px;
          box-sizing: border-box;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
        }

        .preview-title {
          margin: 0 0 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 18px;
          line-height: 1.5;
        }

        .preview-note {
          margin: 0 0 24px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.8;
        }

        .sheet-section + .sheet-section {
          margin-top: 24px;
        }

        .sheet-title {
          margin: 0 0 12px;
          font-size: 15px;
          line-height: 1.5;
        }

        .spreadsheet-empty {
          margin: 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.8;
        }

        .spreadsheet-wrap {
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .spreadsheet-table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
          font-size: 13px;
        }

        .spreadsheet-table th,
        .spreadsheet-table td {
          border: 1px solid #e2e8f0;
          padding: 9px 10px;
          text-align: left;
          vertical-align: top;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .spreadsheet-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          body {
            padding: 12px;
          }

          .preview-page {
            min-height: calc(100vh - 24px);
            padding: 24px 18px;
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <main class="preview-page">
        <h1 class="preview-title">${escapePreviewHtml(title)}</h1>
        ${bodyContent}
      </main>
    </body>
  </html>
`;

const getSpreadsheetColumnIndex = (cellRef: string) => {
  const columnName = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  if (!columnName) {
    return null;
  }

  return Array.from(columnName).reduce((result, char) => result * 26 + char.charCodeAt(0) - 64, 0) - 1;
};

const renderPreviewSheets = (
  sheets: PreviewSheet[],
  title: string,
  options: { columnLimit: number; rowLimit: number; sheetLimit: number },
) => {
  const sheetSections = sheets.map((sheet) => {
    const normalizedColumnCount = Math.min(Math.max(sheet.maxColumnCount, 1), options.columnLimit);
    const tableRows = sheet.rows
      .map((rowCells, rowIndex) => {
        const cells = Array.from({ length: normalizedColumnCount }, (_, columnIndex) => {
          const tag = rowIndex === 0 ? 'th' : 'td';
          return `<${tag}>${escapePreviewHtml(rowCells.get(columnIndex) || '')}</${tag}>`;
        }).join('');

        return `<tr>${cells}</tr>`;
      })
      .join('');

    const content = tableRows
      ? `<div class="spreadsheet-wrap"><table class="spreadsheet-table">${tableRows}</table></div>`
      : '<p class="spreadsheet-empty">未读取到可预览的表格内容。</p>';

    return `
      <section class="sheet-section">
        <h2 class="sheet-title">${escapePreviewHtml(sheet.name)}</h2>
        ${content}
      </section>
    `;
  });

  const note = `<p class="preview-note">已展示前 ${options.sheetLimit} 个工作表、每个工作表前 ${options.rowLimit} 行和前 ${options.columnLimit} 列，用于快速预览内容。</p>`;
  return buildPreviewDocument(title, `${note}${sheetSections.join('')}`);
};

const getCellDisplayValue = (cellElement: Element, sharedStrings: string[]) => {
  const cellType = cellElement.getAttribute('t') || '';
  let value = getElementsByLocalName(cellElement, 'v')[0]?.textContent || '';

  if (cellType === 's') {
    return sharedStrings[Number(value)] || '';
  }

  if (cellType === 'inlineStr') {
    return getElementsByLocalName(cellElement, 't')
      .map((textNode) => textNode.textContent || '')
      .join('');
  }

  if (cellType === 'b') {
    return value === '1' ? 'TRUE' : 'FALSE';
  }

  return value;
};

const isZipSpreadsheet = (buffer: Uint8Array) => buffer[0] === 0x50 && buffer[1] === 0x4b;

const isOleSpreadsheet = (buffer: Uint8Array) => OLE_SIGNATURE.every((byte, index) => buffer[index] === byte);

const hasUtf16Bom = (bytes: Uint8Array) =>
  (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);

const isLikelyTextSpreadsheet = (bytes: Uint8Array) => {
  if (hasUtf16Bom(bytes)) {
    return true;
  }

  const sample = bytes.slice(0, Math.min(bytes.length, 2048));
  if (!sample.length) {
    return true;
  }

  const nullBytes = sample.filter((byte) => byte === 0).length;
  return nullBytes / sample.length < 0.05;
};

const decodeUtf16le = (bytes: Uint8Array) => new TextDecoder('utf-16le').decode(bytes);

const decodeTextSpreadsheet = (bytes: Uint8Array) => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2));
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.slice(2));
  }

  const encodings = ['utf-8', 'gb18030', 'gbk'];

  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding).decode(bytes).replace(/^\ufeff/, '');
    } catch {
      continue;
    }
  }

  return new TextDecoder().decode(bytes).replace(/^\ufeff/, '');
};

const decodeCompressedUnicode = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');

const readBiffUnicodeString = (view: DataView, offset: number) => {
  const characterCount = view.getUint16(offset, true);
  const flags = view.getUint8(offset + 2);
  const is16Bit = (flags & 0x01) !== 0;
  const hasRichText = (flags & 0x08) !== 0;
  const hasAsianPhonetic = (flags & 0x04) !== 0;
  let cursor = offset + 3;

  if (hasRichText) {
    cursor += 2;
  }

  if (hasAsianPhonetic) {
    cursor += 4;
  }

  const byteLength = characterCount * (is16Bit ? 2 : 1);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + cursor, byteLength);

  return {
    value: is16Bit ? decodeUtf16le(bytes) : decodeCompressedUnicode(bytes),
    nextOffset: cursor + byteLength,
  };
};

const readShortBiffUnicodeString = (view: DataView, offset: number) => {
  const characterCount = view.getUint8(offset);
  const flags = view.getUint8(offset + 1);
  const is16Bit = (flags & 0x01) !== 0;
  const byteLength = characterCount * (is16Bit ? 2 : 1);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset + 2, byteLength);

  return {
    value: is16Bit ? decodeUtf16le(bytes) : decodeCompressedUnicode(bytes),
    nextOffset: offset + 2 + byteLength,
  };
};

const readSectorChain = (buffer: Uint8Array, sectorSize: number, fat: number[], startSector: number) => {
  const chunks: Uint8Array[] = [];
  const visited = new Set<number>();
  let sector = startSector;

  while (sector >= 0 && sector !== END_OF_CHAIN && sector !== FREE_SECTOR && !visited.has(sector)) {
    visited.add(sector);
    const start = (sector + 1) * sectorSize;
    chunks.push(buffer.slice(start, start + sectorSize));
    sector = fat[sector] ?? END_OF_CHAIN;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let cursor = 0;

  chunks.forEach((chunk) => {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  });

  return merged;
};

const parseWorkbookStreamFromOle = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const firstDirSector = view.getInt32(48, true);
  const miniStreamCutoff = view.getUint32(56, true);
  const firstMiniFatSector = view.getInt32(60, true);
  const miniFatSectorCount = view.getUint32(64, true);
  const firstDifatSector = view.getInt32(68, true);
  const difatSectorCount = view.getUint32(72, true);
  const difat: number[] = [];

  for (let index = 0; index < 109; index += 1) {
    const sector = view.getInt32(76 + index * 4, true);
    if (sector >= 0) {
      difat.push(sector);
    }
  }

  let nextDifatSector = firstDifatSector;
  for (let index = 0; index < difatSectorCount && nextDifatSector >= 0; index += 1) {
    const sectorOffset = (nextDifatSector + 1) * sectorSize;
    const entriesPerSector = sectorSize / 4 - 1;
    for (let entryIndex = 0; entryIndex < entriesPerSector; entryIndex += 1) {
      const sector = new DataView(bytes.buffer, bytes.byteOffset + sectorOffset + entryIndex * 4, 4).getInt32(0, true);
      if (sector >= 0) {
        difat.push(sector);
      }
    }
    nextDifatSector = new DataView(bytes.buffer, bytes.byteOffset + sectorOffset + sectorSize - 4, 4).getInt32(0, true);
  }

  const fat: number[] = [];
  difat.forEach((fatSector) => {
    const sectorOffset = (fatSector + 1) * sectorSize;
    for (let offset = 0; offset < sectorSize; offset += 4) {
      fat.push(new DataView(bytes.buffer, bytes.byteOffset + sectorOffset + offset, 4).getInt32(0, true));
    }
  });

  const directoryStream = readSectorChain(bytes, sectorSize, fat, firstDirSector);
  const directoryView = new DataView(directoryStream.buffer, directoryStream.byteOffset, directoryStream.byteLength);
  const entries: Array<{ name: string; type: number; startSector: number; size: number }> = [];

  for (let offset = 0; offset + 128 <= directoryStream.length; offset += 128) {
    const nameLength = directoryView.getUint16(offset + 64, true);
    if (nameLength < 2) {
      continue;
    }

    const rawName = new Uint8Array(directoryStream.buffer, directoryStream.byteOffset + offset, nameLength - 2);
    const name = decodeUtf16le(rawName).replace(/\0+$/g, '');
    entries.push({
      name,
      type: directoryView.getUint8(offset + 66),
      startSector: directoryView.getInt32(offset + 116, true),
      size: Number(directoryView.getBigUint64(offset + 120, true)),
    });
  }

  const rootEntry = entries.find((entry) => entry.type === 5);
  const workbookEntry = entries.find((entry) => entry.name === 'Workbook' || entry.name === 'Book');
  if (!rootEntry || !workbookEntry) {
    throw new Error('Missing XLS workbook stream');
  }

  const miniFatStream = miniFatSectorCount > 0 ? readSectorChain(bytes, sectorSize, fat, firstMiniFatSector) : new Uint8Array();
  const miniFatView = new DataView(miniFatStream.buffer, miniFatStream.byteOffset, miniFatStream.byteLength);
  const miniFat: number[] = [];
  for (let offset = 0; offset + 4 <= miniFatStream.length; offset += 4) {
    miniFat.push(miniFatView.getInt32(offset, true));
  }

  const miniStream = readSectorChain(bytes, sectorSize, fat, rootEntry.startSector).slice(0, rootEntry.size);
  const readMiniStream = (startSector: number, size: number) => {
    const chunks: Uint8Array[] = [];
    const visited = new Set<number>();
    let sector = startSector;

    while (sector >= 0 && sector !== END_OF_CHAIN && sector !== FREE_SECTOR && !visited.has(sector)) {
      visited.add(sector);
      const start = sector * miniSectorSize;
      chunks.push(miniStream.slice(start, start + miniSectorSize));
      sector = miniFat[sector] ?? END_OF_CHAIN;
    }

    const merged = new Uint8Array(size);
    let cursor = 0;
    chunks.forEach((chunk) => {
      merged.set(chunk.slice(0, Math.min(chunk.length, size - cursor)), cursor);
      cursor += chunk.length;
    });

    return merged.slice(0, size);
  };

  if (workbookEntry.size < miniStreamCutoff) {
    return readMiniStream(workbookEntry.startSector, workbookEntry.size);
  }

  return readSectorChain(bytes, sectorSize, fat, workbookEntry.startSector).slice(0, workbookEntry.size);
};

const decodeRkNumber = (rk: number) => {
  const isMultipliedBy100 = (rk & 0x01) !== 0;
  const isInteger = (rk & 0x02) !== 0;
  let value: number;

  if (isInteger) {
    value = rk >> 2;
  } else {
    const temp = new ArrayBuffer(8);
    const tempView = new DataView(temp);
    tempView.setUint32(4, rk & 0xfffffffc, true);
    value = tempView.getFloat64(0, true);
  }

  return isMultipliedBy100 ? value / 100 : value;
};

const collectBiffRecords = (view: DataView) => {
  const records: Array<{ id: number; offset: number; length: number }> = [];
  let offset = 0;

  while (offset + 4 <= view.byteLength) {
    const id = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    const dataOffset = offset + 4;
    if (dataOffset + length > view.byteLength) {
      break;
    }

    records.push({ id, offset: dataOffset, length });
    offset = dataOffset + length;
  }

  return records;
};

const parseBiffSheets = (
  workbookStream: Uint8Array,
  options: { rowLimit: number; sheetLimit: number },
): PreviewSheet[] => {
  const view = new DataView(workbookStream.buffer, workbookStream.byteOffset, workbookStream.byteLength);
  const records = collectBiffRecords(view);
  const sharedStrings: string[] = [];
  const sheetDescriptors: Array<{ name: string; streamPosition: number }> = [];

  records.forEach((record) => {
    if (record.id === 0x00fc) {
      let cursor = record.offset + 8;
      while (cursor < record.offset + record.length) {
        const { value, nextOffset } = readBiffUnicodeString(view, cursor);
        sharedStrings.push(value);
        cursor = nextOffset;
      }
    }

    if (record.id === 0x0085) {
      const streamPosition = view.getUint32(record.offset, true);
      const nameLength = view.getUint8(record.offset + 6);
      const flags = view.getUint8(record.offset + 7);
      const is16Bit = (flags & 0x01) !== 0;
      const nameBytes = new Uint8Array(
        workbookStream.buffer,
        workbookStream.byteOffset + record.offset + 8,
        nameLength * (is16Bit ? 2 : 1),
      );
      sheetDescriptors.push({
        name: is16Bit ? decodeUtf16le(nameBytes) : decodeCompressedUnicode(nameBytes),
        streamPosition,
      });
    }
  });

  return sheetDescriptors.slice(0, options.sheetLimit).map((descriptor) => {
    const rowStore: Map<number, Map<number, string>> = new Map();
    let maxColumnCount = 0;
    let offset = descriptor.streamPosition;
    let pendingFormulaStringRow = -1;
    let pendingFormulaStringColumn = -1;
    let pendingFormulaIsString = false;

    while (offset + 4 <= view.byteLength) {
      const id = view.getUint16(offset, true);
      const length = view.getUint16(offset + 2, true);
      const dataOffset = offset + 4;
      if (dataOffset + length > view.byteLength) {
        break;
      }

      const readRowCell = () => view.getUint16(dataOffset, true);
      const readColumnCell = () => view.getUint16(dataOffset + 2, true);
      const setCell = (rowIndex: number, columnIndex: number, value: string) => {
        if (rowIndex >= options.rowLimit) {
          return;
        }

        const row = rowStore.get(rowIndex) || new Map<number, string>();
        row.set(columnIndex, value);
        rowStore.set(rowIndex, row);
        maxColumnCount = Math.max(maxColumnCount, columnIndex + 1);
      };

      if (id === 0x000a) {
        break;
      }

      if (id === 0x00fd) {
        setCell(readRowCell(), readColumnCell(), sharedStrings[view.getUint32(dataOffset + 6, true)] || '');
      } else if (id === 0x0204) {
        const stringLength = view.getUint16(dataOffset + 6, true);
        const bytes = new Uint8Array(workbookStream.buffer, workbookStream.byteOffset + dataOffset + 8, stringLength);
        setCell(readRowCell(), readColumnCell(), decodeCompressedUnicode(bytes));
      } else if (id === 0x027e) {
        setCell(readRowCell(), readColumnCell(), String(decodeRkNumber(view.getInt32(dataOffset + 6, true))));
      } else if (id === 0x00bd) {
        const rowIndex = readRowCell();
        const firstColumn = view.getUint16(dataOffset + 2, true);
        const lastColumn = view.getUint16(dataOffset + length - 2, true);
        for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
          const rkOffset = dataOffset + 4 + (columnIndex - firstColumn) * 6 + 2;
          setCell(rowIndex, columnIndex, String(decodeRkNumber(view.getInt32(rkOffset, true))));
        }
      } else if (id === 0x0203) {
        setCell(readRowCell(), readColumnCell(), String(view.getFloat64(dataOffset + 6, true)));
      } else if (id === 0x0205) {
        const rowIndex = readRowCell();
        const columnIndex = readColumnCell();
        const booleanValue = view.getUint8(dataOffset + 6) === 1 ? 'TRUE' : 'FALSE';
        setCell(rowIndex, columnIndex, booleanValue);
      } else if (id === 0x0006) {
        const rowIndex = readRowCell();
        const columnIndex = readColumnCell();
        const resultBytes = new Uint8Array(workbookStream.buffer, workbookStream.byteOffset + dataOffset + 6, 8);
        const formulaValueType = resultBytes[6];
        const formulaOptions = view.getUint16(dataOffset + 14, true);
        pendingFormulaStringRow = rowIndex;
        pendingFormulaStringColumn = columnIndex;
        pendingFormulaIsString = formulaValueType === 0xff;

        if (!pendingFormulaIsString) {
          const numericResult = new DataView(resultBytes.buffer, resultBytes.byteOffset, 8).getFloat64(0, true);
          if (Number.isFinite(numericResult)) {
            setCell(rowIndex, columnIndex, String(numericResult));
          } else if (formulaValueType === 1) {
            setCell(rowIndex, columnIndex, resultBytes[0] === 1 ? 'TRUE' : 'FALSE');
          } else if (formulaValueType === 3 || (formulaOptions & 0x0008) !== 0) {
            setCell(rowIndex, columnIndex, '');
          }
        }
      } else if (id === 0x0207 && pendingFormulaIsString) {
        const { value } = readBiffUnicodeString(view, dataOffset);
        setCell(pendingFormulaStringRow, pendingFormulaStringColumn, value);
        pendingFormulaStringRow = -1;
        pendingFormulaStringColumn = -1;
        pendingFormulaIsString = false;
      }

      offset = dataOffset + length;
    }

    return {
      name: descriptor.name || 'Sheet',
      rows: Array.from({ length: Math.min(rowStore.size || options.rowLimit, options.rowLimit) }, (_, rowIndex) => rowStore.get(rowIndex) || new Map()),
      maxColumnCount,
    };
  });
};

const parseZipSheets = async (
  zip: JSZip,
  options: { rowLimit: number; sheetLimit: number },
): Promise<PreviewSheet[]> => {
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  const sharedStrings: string[] = [];

  if (sharedStringsFile) {
    const sharedStringsXml = await sharedStringsFile.async('string');
    const sharedStringsDocument = new DOMParser().parseFromString(sharedStringsXml, 'application/xml');
    getElementsByLocalName(sharedStringsDocument, 'si').forEach((item) => {
      sharedStrings.push(getElementsByLocalName(item, 't').map((textNode) => textNode.textContent || '').join(''));
    });
  }

  const workbookFile = zip.file('xl/workbook.xml');
  const workbookRelsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbookFile || !workbookRelsFile) {
    throw new Error('Missing XLSX workbook metadata');
  }

  const workbookXml = await workbookFile.async('string');
  const workbookDocument = new DOMParser().parseFromString(workbookXml, 'application/xml');
  const workbookRelsXml = await workbookRelsFile.async('string');
  const workbookRelsDocument = new DOMParser().parseFromString(workbookRelsXml, 'application/xml');
  const relationshipPathMap = new Map<string, string>();

  getElementsByLocalName(workbookRelsDocument, 'Relationship').forEach((relationship) => {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id && target) {
      relationshipPathMap.set(id, `xl/${target.replace(/^\/+/, '')}`);
    }
  });

  return Promise.all(
    getElementsByLocalName(workbookDocument, 'sheet')
      .slice(0, options.sheetLimit)
      .map(async (sheetElement, sheetIndex) => {
        const sheetName = sheetElement.getAttribute('name') || `Sheet ${sheetIndex + 1}`;
        const relationshipId =
          sheetElement.getAttribute('r:id') || sheetElement.getAttribute('id') || sheetElement.getAttribute('Id') || '';
        const worksheetPath = relationshipPathMap.get(relationshipId);
        const worksheetFile = worksheetPath ? zip.file(worksheetPath) : null;

        if (!worksheetFile) {
          return { name: sheetName, rows: [], maxColumnCount: 0 };
        }

        const worksheetXml = await worksheetFile.async('string');
        const worksheetDocument = new DOMParser().parseFromString(worksheetXml, 'application/xml');
        const rowElements = getElementsByLocalName(worksheetDocument, 'row').slice(0, options.rowLimit);
        let maxColumnCount = 0;

        const rows = rowElements.map((rowElement) => {
          const rowCells = new Map<number, string>();

          getElementsByLocalName(rowElement, 'c').forEach((cellElement, fallbackIndex) => {
            const columnIndex = getSpreadsheetColumnIndex(cellElement.getAttribute('r') || '') ?? fallbackIndex;
            rowCells.set(columnIndex, getCellDisplayValue(cellElement, sharedStrings));
            maxColumnCount = Math.max(maxColumnCount, columnIndex + 1);
          });

          return rowCells;
        });

        return { name: sheetName, rows, maxColumnCount };
      }),
  );
};

const detectDelimitedTextSeparator = (text: string) => {
  const sampleLines = text.split(/\r\n|\n|\r/).slice(0, 10);
  const tabCount = sampleLines.reduce((count, line) => count + (line.match(/\t/g)?.length || 0), 0);
  const commaCount = sampleLines.reduce((count, line) => count + (line.match(/,/g)?.length || 0), 0);

  return tabCount > commaCount ? '\t' : ',';
};

const parseDelimitedTextRows = (text: string, separator: string, rowLimit: number) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isQuoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length && rows.length < rowLimit; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (!isQuoted && char === separator) {
      pushCell();
      continue;
    }

    if (!isQuoted && (char === '\n' || char === '\r')) {
      pushRow();
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      continue;
    }

    cell += char;
  }

  if (rows.length < rowLimit && (cell || row.length)) {
    pushRow();
  }

  return rows;
};

const parseDelimitedTextSheet = (
  bytes: Uint8Array,
  title: string,
  options: { rowLimit: number },
): PreviewSheet => {
  const text = decodeTextSpreadsheet(bytes);
  const separator = detectDelimitedTextSeparator(text);
  const rows = parseDelimitedTextRows(text, separator, options.rowLimit);
  let maxColumnCount = 0;
  const sheetName = title.replace(/\.[^.]+$/, '').trim() || (separator === '\t' ? 'TSV' : 'CSV');

  return {
    name: sheetName,
    rows: rows.map((rowValues) => {
      const rowCells = new Map<number, string>();
      rowValues.forEach((value, columnIndex) => {
        rowCells.set(columnIndex, value);
      });
      maxColumnCount = Math.max(maxColumnCount, rowValues.length);
      return rowCells;
    }),
    maxColumnCount,
  };
};

export const buildSpreadsheetPreviewHtml = async (
  buffer: ArrayBuffer,
  title: string,
  options?: { columnLimit?: number; rowLimit?: number; sheetLimit?: number },
) => {
  const previewOptions = {
    rowLimit: options?.rowLimit ?? 30,
    columnLimit: options?.columnLimit ?? 12,
    sheetLimit: options?.sheetLimit ?? 3,
  };
  const bytes = new Uint8Array(buffer);

  if (isZipSpreadsheet(bytes)) {
    const sheets = await parseZipSheets(await JSZip.loadAsync(buffer), previewOptions);
    return renderPreviewSheets(sheets, title, previewOptions);
  }

  if (isOleSpreadsheet(bytes)) {
    const workbookStream = parseWorkbookStreamFromOle(bytes);
    const sheets = parseBiffSheets(workbookStream, previewOptions);
    return renderPreviewSheets(sheets, title, previewOptions);
  }

  if (isLikelyTextSpreadsheet(bytes)) {
    const sheet = parseDelimitedTextSheet(bytes, title, previewOptions);
    return renderPreviewSheets([sheet], title, previewOptions);
  }

  throw new Error('Unsupported spreadsheet format');
};
