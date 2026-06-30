import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx/用户画像.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheetNames = workbook.worksheets.items.map((sheet) => sheet.name);
console.log(JSON.stringify({ sheetNames }, null, 2));

for (const sheetName of sheetNames) {
  const result = await workbook.inspect({
    kind: "table",
    range: `${sheetName}!A1:Z60`,
    include: "values,formulas",
    tableMaxRows: 60,
    tableMaxCols: 26,
  });
  console.log(`\n--- ${sheetName} ---`);
  console.log(result.ndjson);
}
