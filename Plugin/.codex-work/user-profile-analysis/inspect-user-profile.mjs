import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const inputPath = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx/用户画像.xlsx";
const outPath = "C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/inspect-summary.txt";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,region",
  maxChars: 14000,
  tableMaxRows: 20,
  tableMaxCols: 20,
  tableMaxCellChars: 120,
});

await fs.writeFile(outPath, summary.ndjson, "utf8");
console.log(outPath);
