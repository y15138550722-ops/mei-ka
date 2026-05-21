import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputPath = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx/用户画像_优化版.xlsx";
const input = await FileBlob.load(outputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

console.log(
  JSON.stringify({
    sheetNames: workbook.worksheets.items.map((sheet) => sheet.name),
  })
);

for (const range of ["看板概览!A1:G16", "用户画像明细!A1:AK3", "字段字典!A1:E22", "标签规则!A1:D11"]) {
  const result = await workbook.inspect({
    kind: "table",
    range,
    include: "values,formulas",
    tableMaxRows: 30,
    tableMaxCols: 40,
    maxChars: 12000,
  });
  console.log(`\n--- ${range} ---`);
  console.log(result.ndjson);
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 4000,
});
console.log("\n--- formula/data error scan ---");
console.log(errors.ndjson);
