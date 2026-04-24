import { formatBeijingTimestamp } from './dateTime';

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
  `${import.meta.env.BASE_URL}templates/order-list-template.xlsx`,
  `${import.meta.env.BASE_URL}orde%20list.xlsx`,
  `${import.meta.env.BASE_URL}orde list.xlsx`,
];
const HEADER_ROW_INDEX = 1;
const DATA_START_ROW_INDEX = HEADER_ROW_INDEX + 1;
const TEMPLATE_COLUMN_COUNT = 11;
const EXCELJS_RUNTIME_PATH = `${import.meta.env.BASE_URL}vendor/exceljs.bare.min.js`;
const EXCELJS_RUNTIME_SCRIPT_ID = 'exceljs-runtime-script';

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

const downloadBuffer = (buffer: BlobPart, fileName: string) => {
  const blob = new Blob([buffer], {
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
  }, 0);
};

const getExcelJsRuntimeFromWindow = () => {
  const runtime = (window as Window & { ExcelJS?: ExcelJsNamespace }).ExcelJS;

  if (!runtime?.Workbook) {
    throw new Error('Failed to initialize Excel export module');
  }

  return runtime;
};

const loadExcelJsRuntime = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Excel export is only available in the browser');
  }

  const loadedRuntime = (window as Window & { ExcelJS?: ExcelJsNamespace }).ExcelJS;
  if (loadedRuntime?.Workbook) {
    return loadedRuntime;
  }

  if (excelJsRuntimePromise) {
    return excelJsRuntimePromise;
  }

  excelJsRuntimePromise = new Promise<ExcelJsNamespace>((resolve, reject) => {
    const existingScript = document.getElementById(EXCELJS_RUNTIME_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');

    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const handleLoad = () => {
      cleanup();

      try {
        resolve(getExcelJsRuntimeFromWindow());
      } catch (error) {
        excelJsRuntimePromise = null;
        reject(error);
      }
    };

    const handleError = () => {
      cleanup();
      excelJsRuntimePromise = null;
      reject(new Error('Failed to load Excel export runtime'));
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existingScript) {
      script.id = EXCELJS_RUNTIME_SCRIPT_ID;
      script.src = EXCELJS_RUNTIME_PATH;
      script.async = true;
      document.head.appendChild(script);
    }
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
      return response.arrayBuffer();
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
  downloadBuffer(exportBuffer, fileName);
};
