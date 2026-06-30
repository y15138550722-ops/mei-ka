import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ExcelJS = require('../src/node_modules/exceljs');

const [, , inputArg, outputArg] = process.argv;

if (!inputArg || !outputArg) {
  console.error('Usage: node scripts/render-xlsx-preview.mjs <input.xlsx> <output.html>');
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const columnToIndex = (columnName) =>
  Array.from(columnName.toUpperCase()).reduce((result, char) => result * 26 + char.charCodeAt(0) - 64, 0);

const parseCellAddress = (address) => {
  const match = /^([A-Z]+)(\d+)$/i.exec(address || '');
  if (!match) {
    return null;
  }

  return {
    col: columnToIndex(match[1]),
    row: Number(match[2]),
  };
};

const parseMergeAddress = (range) => {
  const [startRef, endRef] = String(range || '').split(':');
  const start = parseCellAddress(startRef);
  const end = parseCellAddress(endRef || startRef);

  if (!start || !end) {
    return null;
  }

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
};

const buildMergeMaps = (worksheet) => {
  const mergeTopLeftMap = new Map();
  const mergeCoveredSet = new Set();

  for (const mergeRange of worksheet.model?.merges || []) {
    const parsed = parseMergeAddress(mergeRange);
    if (!parsed) {
      continue;
    }

    const key = `${parsed.startRow}:${parsed.startCol}`;
    mergeTopLeftMap.set(key, {
      rowspan: parsed.endRow - parsed.startRow + 1,
      colspan: parsed.endCol - parsed.startCol + 1,
    });

    for (let row = parsed.startRow; row <= parsed.endRow; row += 1) {
      for (let col = parsed.startCol; col <= parsed.endCol; col += 1) {
        if (row === parsed.startRow && col === parsed.startCol) {
          continue;
        }
        mergeCoveredSet.add(`${row}:${col}`);
      }
    }
  }

  return { mergeTopLeftMap, mergeCoveredSet };
};

const getCellText = (cell) => {
  if (!cell) {
    return '';
  }

  if (cell.hyperlink && cell.text) {
    return cell.text;
  }

  if (cell.text) {
    return cell.text;
  }

  if (cell.value == null) {
    return '';
  }

  if (typeof cell.value === 'object') {
    if (cell.value.richText) {
      return cell.value.richText.map((item) => item.text || '').join('');
    }
    if (cell.value.text) {
      return cell.value.text;
    }
    if (cell.value.result != null) {
      return String(cell.value.result);
    }
    if (cell.value.formula) {
      return cell.value.result != null ? String(cell.value.result) : `=${cell.value.formula}`;
    }
    return JSON.stringify(cell.value);
  }

  return String(cell.value);
};

const renderWorksheetTable = (worksheet) => {
  const dimensions = worksheet.dimensions;
  if (!dimensions) {
    return '<p class="sheet-empty">This sheet has no visible data.</p>';
  }

  const { mergeTopLeftMap, mergeCoveredSet } = buildMergeMaps(worksheet);
  const rows = [];

  for (let rowNumber = dimensions.top; rowNumber <= dimensions.bottom; rowNumber += 1) {
    const cells = [];

    for (let columnNumber = dimensions.left; columnNumber <= dimensions.right; columnNumber += 1) {
      const mergeKey = `${rowNumber}:${columnNumber}`;
      if (mergeCoveredSet.has(mergeKey)) {
        continue;
      }

      const cell = worksheet.getCell(rowNumber, columnNumber);
      const text = getCellText(cell);
      const mergeInfo = mergeTopLeftMap.get(mergeKey);
      const tagName = rowNumber === dimensions.top ? 'th' : 'td';
      const spanAttributes = [
        mergeInfo?.rowspan > 1 ? ` rowspan="${mergeInfo.rowspan}"` : '',
        mergeInfo?.colspan > 1 ? ` colspan="${mergeInfo.colspan}"` : '',
      ].join('');

      cells.push(`<${tagName}${spanAttributes}>${escapeHtml(text)}</${tagName}>`);
    }

    rows.push(`<tr>${cells.join('')}</tr>`);
  }

  return `<div class="sheet-table-wrap"><table class="sheet-table">${rows.join('')}</table></div>`;
};

const renderDocument = (workbook, title) => {
  const sheetButtons = workbook.worksheets
    .map(
      (worksheet, index) =>
        `<button class="sheet-tab${index === 0 ? ' is-active' : ''}" type="button" data-target="sheet-${index}">${escapeHtml(
          worksheet.name,
        )}</button>`,
    )
    .join('');

  const sheetPanels = workbook.worksheets
    .map((worksheet, index) => {
      const summary = `${worksheet.rowCount || 0} rows x ${worksheet.columnCount || 0} columns`;
      return `
        <section class="sheet-panel${index === 0 ? ' is-active' : ''}" id="sheet-${index}">
          <div class="sheet-panel__meta">
            <h2>${escapeHtml(worksheet.name)}</h2>
            <span>${escapeHtml(summary)}</span>
          </div>
          ${renderWorksheetTable(worksheet)}
        </section>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #eef3f8;
        --panel: #ffffff;
        --panel-strong: #f7fafc;
        --border: #d8e1ea;
        --text: #17212b;
        --muted: #5c6b79;
        --accent: #1d7a6f;
        --accent-soft: #ddf3ef;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background:
          linear-gradient(180deg, rgba(29, 122, 111, 0.07), transparent 240px),
          var(--bg);
        color: var(--text);
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }

      body {
        padding: 24px;
      }

      .preview-shell {
        width: min(1280px, 100%);
        margin: 0 auto;
        background: var(--panel);
        border: 1px solid rgba(216, 225, 234, 0.9);
        border-radius: 18px;
        box-shadow: 0 28px 80px rgba(23, 33, 43, 0.12);
        overflow: hidden;
      }

      .preview-head {
        padding: 28px 32px 20px;
        border-bottom: 1px solid var(--border);
        background:
          linear-gradient(135deg, rgba(29, 122, 111, 0.08), rgba(255, 255, 255, 0.92)),
          var(--panel);
      }

      .preview-head h1 {
        margin: 0;
        font-size: 22px;
        line-height: 1.3;
      }

      .preview-head p {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .sheet-tabs {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        padding: 18px 24px 0;
        background: var(--panel);
      }

      .sheet-tab {
        appearance: none;
        border: 1px solid var(--border);
        background: var(--panel-strong);
        color: var(--muted);
        border-radius: 999px;
        padding: 8px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease;
      }

      .sheet-tab:hover {
        transform: translateY(-1px);
      }

      .sheet-tab.is-active {
        background: var(--accent-soft);
        border-color: rgba(29, 122, 111, 0.28);
        color: var(--accent);
      }

      .sheet-panels {
        padding: 20px 24px 24px;
      }

      .sheet-panel {
        display: none;
      }

      .sheet-panel.is-active {
        display: block;
      }

      .sheet-panel__meta {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }

      .sheet-panel__meta h2 {
        margin: 0;
        font-size: 17px;
      }

      .sheet-panel__meta span {
        color: var(--muted);
        font-size: 12px;
      }

      .sheet-table-wrap {
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #fcfdfe;
      }

      .sheet-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        table-layout: auto;
      }

      .sheet-table th,
      .sheet-table td {
        border: 1px solid var(--border);
        padding: 9px 10px;
        text-align: left;
        vertical-align: top;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        line-height: 1.5;
      }

      .sheet-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #edf4f3;
        color: #173e3a;
        font-weight: 700;
      }

      .sheet-empty {
        margin: 0;
        padding: 18px;
        border: 1px dashed var(--border);
        border-radius: 12px;
        color: var(--muted);
        background: #fbfcfd;
      }

      @media (max-width: 768px) {
        body {
          padding: 12px;
        }

        .preview-shell {
          border-radius: 14px;
        }

        .preview-head,
        .sheet-panels {
          padding-left: 16px;
          padding-right: 16px;
        }

        .sheet-tabs {
          padding: 14px 16px 0;
        }

        .sheet-panel__meta {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <main class="preview-shell">
      <header class="preview-head">
        <h1>${escapeHtml(title)}</h1>
        <p>Static workbook preview generated from the source spreadsheet for direct viewing in this workspace.</p>
      </header>
      <nav class="sheet-tabs" aria-label="Workbook sheets">${sheetButtons}</nav>
      <div class="sheet-panels">${sheetPanels}</div>
    </main>
    <script>
      const tabs = Array.from(document.querySelectorAll('.sheet-tab'));
      const panels = Array.from(document.querySelectorAll('.sheet-panel'));
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const targetId = tab.getAttribute('data-target');
          tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
          panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === targetId));
        });
      });
    </script>
  </body>
</html>`;
};

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(inputPath);

const title = path.basename(inputPath);
const html = renderDocument(workbook, title);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, html, 'utf8');

console.log(`Rendered preview: ${outputPath}`);
