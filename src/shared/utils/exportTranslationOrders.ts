import { formatBeijingTimestamp } from './dateTime';
import orderListTemplateUrl from '../../public/templates/order-list-template.xlsx?url';

export interface TranslationOrderExportRow {
  orderId: string;
  createdAt: string;
  productName: string;
  processTypeLabel: string;
  agentName: string;
  recipientInfo: string;
  licenseInfo: string;
  statusLabel: string;
  logisticsInfo: string;
  price: number | string;
  primaryAccount: string;
}

const TEMPLATE_PATHS = [
  orderListTemplateUrl,
  `${import.meta.env.BASE_URL}templates/order-list-template.xlsx`,
  `${import.meta.env.BASE_URL}ETC/xlsx/orde%20list.xlsx`,
  `${import.meta.env.BASE_URL}orde%20list.xlsx`,
  `${import.meta.env.BASE_URL}orde list.xlsx`,
];
const HEADER_ROW_INDEX = 1;
const DATA_START_ROW_INDEX = HEADER_ROW_INDEX + 1;
const TEMPLATE_COLUMN_COUNT = 11;
const DOWNLOAD_URL_REVOKE_DELAY_MS = 60_000;

const cloneExcelStyle = <T,>(style: T): T => JSON.parse(JSON.stringify(style ?? {})) as T;
type ExcelJsNamespace = typeof import('exceljs');

let excelJsRuntimePromise: Promise<ExcelJsNamespace> | null = null;

const buildWorksheetRow = (row: TranslationOrderExportRow) => [
  row.orderId,
  row.createdAt,
  row.productName,
  row.processTypeLabel,
  row.agentName,
  row.recipientInfo,
  row.licenseInfo,
  row.statusLabel,
  row.logisticsInfo,
  row.price,
  row.primaryAccount,
];

const buildExportFileName = () => {
  const timestamp = formatBeijingTimestamp().replace(/\s+/g, '_').replace(/:/g, '-');
  return `\u7ffb\u8bd1\u8ba2\u5355\u5217\u8868_${timestamp}.xlsx`;
};

const toStandaloneArrayBuffer = (buffer: ArrayBuffer | ArrayBufferView) => {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  return bytes.slice().buffer;
};

const assertXlsxBuffer = (buffer: ArrayBuffer, sourceLabel: string) => {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error(`${sourceLabel} is not a valid XLSX file`);
  }
};

const downloadBuffer = (buffer: ArrayBuffer | ArrayBufferView, fileName: string) => {
  const standaloneBuffer = toStandaloneArrayBuffer(buffer);
  const blob = new Blob([standaloneBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, DOWNLOAD_URL_REVOKE_DELAY_MS);
};

const loadBundledExcelJsRuntime = async () => {
  const runtimeModule = await import('exceljs');
  const runtimeContainer = runtimeModule as ExcelJsNamespace & { default?: ExcelJsNamespace };
  const runtime = runtimeContainer.Workbook ? runtimeContainer : runtimeContainer.default;

  if (!runtime?.Workbook) {
    throw new Error('Failed to initialize Excel export module');
  }

  return runtime as ExcelJsNamespace;
};

const loadExcelJsRuntime = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Excel export is only available in the browser');
  }

  if (excelJsRuntimePromise) {
    return excelJsRuntimePromise;
  }

  excelJsRuntimePromise = loadBundledExcelJsRuntime().catch((error) => {
    excelJsRuntimePromise = null;
    throw error;
  });

  return excelJsRuntimePromise;
};

const createWorkbook = async () => {
  const excelJsRuntime = await loadExcelJsRuntime();
  return new excelJsRuntime.Workbook();
};

const loadTemplateBuffer = async () => {
  const failedPaths: string[] = [];

  for (const templatePath of TEMPLATE_PATHS) {
    const response = await fetch(templatePath);
    if (response.ok) {
      const templateBuffer = await response.arrayBuffer();
      assertXlsxBuffer(templateBuffer, 'Export template');
      return templateBuffer;
    }

    failedPaths.push(`${templatePath} (${response.status})`);
  }

  throw new Error(`Failed to load export template: ${failedPaths.join(', ')}`);
};

export const exportTranslationOrders = async (
  rows: TranslationOrderExportRow[],
  fileName = buildExportFileName(),
) => {
  const templateBuffer = await loadTemplateBuffer();
  const workbook = await createWorkbook();

  await workbook.xlsx.load(templateBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Template worksheet is missing');
  }

  const templateRow = worksheet.getRow(DATA_START_ROW_INDEX);
  const templateRowHeight = templateRow.height;
  const templateCellStyles = Array.from({ length: TEMPLATE_COLUMN_COUNT }, (_, index) =>
    cloneExcelStyle(worksheet.getCell(DATA_START_ROW_INDEX, index + 1).style),
  );

  const removableRowCount = Math.max(worksheet.rowCount - HEADER_ROW_INDEX, 0);
  if (removableRowCount > 0) {
    worksheet.spliceRows(DATA_START_ROW_INDEX, removableRowCount);
  }

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.insertRow(DATA_START_ROW_INDEX + rowIndex, buildWorksheetRow(row));

    if (templateRowHeight) {
      worksheetRow.height = templateRowHeight;
    }

    templateCellStyles.forEach((style, cellIndex) => {
      worksheetRow.getCell(cellIndex + 1).style = cloneExcelStyle(style);
    });
  });

  const exportBuffer = await workbook.xlsx.writeBuffer();
  const standaloneExportBuffer = toStandaloneArrayBuffer(exportBuffer);
  assertXlsxBuffer(standaloneExportBuffer, 'Generated export');

  const validationWorkbook = await createWorkbook();
  await validationWorkbook.xlsx.load(standaloneExportBuffer);

  downloadBuffer(standaloneExportBuffer, fileName);
};
