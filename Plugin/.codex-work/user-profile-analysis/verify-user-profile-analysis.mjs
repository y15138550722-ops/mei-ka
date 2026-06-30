import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx/用户画像_标准分析版.xlsx";
const previewPath = "C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/verify-overview.png";
const reportPath = "C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/verify-report.ndjson";

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const report = await workbook.inspect({
  kind: "sheet,table,match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 8,
});
await fs.writeFile(reportPath, report.ndjson, "utf8");

const preview = await workbook.render({
  sheetName: "01_画像总览",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({ inputPath, previewPath, reportPath }, null, 2));
