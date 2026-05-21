import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx";
const previewDir = "C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/previews";
const outputPath = `${outputDir}/用户画像_标准分析版.xlsx`;

await fs.mkdir(previewDir, { recursive: true });

const wb = Workbook.create();

const palette = {
  ink: "#172033",
  muted: "#667085",
  line: "#D0D5DD",
  softLine: "#EAECF0",
  header: "#1F4E5F",
  header2: "#2F6B5F",
  teal: "#0F766E",
  blue: "#2563EB",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  bg: "#F8FAFC",
  panel: "#EEF6F3",
  white: "#FFFFFF",
  paleBlue: "#EFF6FF",
  paleGreen: "#ECFDF3",
  paleAmber: "#FFFAEB",
  paleRed: "#FEF2F2",
};

const fieldRows = [
  ["年龄", "用户基础属性", "人口统计", "根据出生日期计算", "年龄分布、年龄段占比", "出生日期、下单时间或当前日期", "按年/按月", "高", "18-24、25-34、35-44、45+", "用真实出生日期计算，避免手填年龄失真"],
  ["年龄段", "用户基础属性", "分层标签", "按年龄区间生成", "用户分层分析", "年龄", "按年/按月", "高", "18-24、25-34、35-44、45+", "建议统一分箱规则，便于跨周期对比"],
  ["性别", "用户基础属性", "人口统计", "男/女/未知", "性别占比", "用户注册资料或证件信息", "按月", "中", "男、女、未知", "保留未知值，避免强制归类"],
  ["国籍", "用户基础属性", "人口统计", "中国/其他国家或地区", "国籍分布", "证件资料或订单填写信息", "按月", "中", "中国、其他、未知", "用于识别跨境/外籍用户服务需求"],
  ["驾照签发省份/城市", "证件属性", "地理来源", "驾照签发地", "驾照来源地图", "驾照信息", "按月/按季度", "高", "省份、城市", "建议省市拆分为两个字段，便于地图分析"],
  ["收货省份/城市", "履约属性", "地理需求", "订单收货地址", "收货热力图、履约区域分析", "物流地址", "按月/按周", "高", "省份、城市", "建议与驾照签发地做交叉，识别异地办理"],
  ["驾照类型", "证件属性", "产品资格", "A、B、C 等类型", "驾照类型分布", "驾照信息", "按月", "高", "A/B/C/其他", "可与订单类型交叉，识别主要服务客群"],
  ["初次领证年份", "证件属性", "生命周期", "例如 2017", "驾龄分布", "驾照信息", "按年", "中", "年份", "需校验年份范围，避免未来年份或异常早期年份"],
  ["驾龄", "证件属性", "生命周期", "当前年份 - 初次领证年份", "驾龄画像", "初次领证年份", "按年", "中", "0-2、3-5、6-10、10+", "建议用公式派生，不作为人工录入字段"],
  ["有限期限", "证件属性", "生命周期", "6 年、10 年等", "证件生命周期分析", "驾照信息", "按月", "中", "6年、10年、长期、未知", "可辅助提醒续期、到期风险和服务窗口"],
  ["订单渠道", "订单行为", "获客来源", "携程等渠道", "渠道贡献分析", "订单来源", "按日/按周/按月", "高", "携程、官网、线下、其他", "要保留渠道编码与渠道名称映射表"],
  ["订单类型", "订单行为", "产品偏好", "小白本、公证等", "产品类型占比", "订单明细", "按周/按月", "高", "小白本、公证、翻译、其他", "用于观察产品结构、交叉销售机会"],
  ["是否加急订单", "订单行为", "服务偏好", "是/否", "加急订单占比", "订单明细", "按日/按周", "高", "是、否", "可和渠道/城市交叉，判断履约压力"],
  ["下单时间", "订单行为", "时间行为", "订单发起时间", "下单时段趋势", "订单明细", "小时/日/周/月", "高", "小时、星期、月份", "建议保留标准时间戳，同时派生小时段和星期"],
  ["是否翻译", "履约进度", "流程状态", "是/否", "处理进度看板", "生产流程记录", "按日", "高", "是、否", "用于监控生产节点转化"],
  ["是否发货", "履约进度", "流程状态", "是/否", "发货转化率", "物流/发货记录", "按日", "高", "是、否", "建议与下单时间计算履约时效"],
];

const modules = [
  {
    module: "用户基础属性",
    fields: ["年龄", "年龄段", "性别", "国籍"],
    purpose: "识别核心人群结构，作为所有分群与交叉分析的基础。",
    charts: "年龄段柱状图、性别占比、国籍分布",
    decision: "明确主力年龄层与潜在服务语言/材料需求。",
    cadence: "月度",
    owner: "运营分析",
    maturity: "已具备字段框架，待接入真实用户明细",
  },
  {
    module: "证件属性",
    fields: ["驾照签发省份/城市", "驾照类型", "初次领证年份", "驾龄", "有限期限"],
    purpose: "理解驾照来源、类型和生命周期，识别高价值办理场景。",
    charts: "签发地地图、驾照类型分布、驾龄分布",
    decision: "优化材料审核策略、续期提醒和区域资源投放。",
    cadence: "月度/季度",
    owner: "产品与运营",
    maturity: "字段较完整，需补充省市标准编码",
  },
  {
    module: "订单行为",
    fields: ["订单渠道", "订单类型", "是否加急订单", "下单时间"],
    purpose: "衡量获客来源、产品偏好、服务紧急程度与下单节奏。",
    charts: "渠道贡献、产品结构、加急率、下单时段热力",
    decision: "优化渠道预算、排班计划和产品组合。",
    cadence: "日/周/月",
    owner: "增长与运营",
    maturity: "分析优先级最高，建议优先接入订单明细",
  },
  {
    module: "履约属性",
    fields: ["收货省份/城市", "是否翻译", "是否发货"],
    purpose: "追踪履约区域、生产节点和最终交付转化。",
    charts: "收货地热力图、翻译完成率、发货转化率",
    decision: "发现履约瓶颈、区域时效差异和异常订单。",
    cadence: "日/周",
    owner: "履约团队",
    maturity: "需与物流状态、生产节点时间打通",
  },
];

const segmentRows = [
  ["新手出境办理型", "年龄 18-34，驾龄 0-5 年，订单类型为小白本/翻译", "年轻、首次办理概率高、需要清晰指引", "突出材料清单、进度提醒、在线客服", "年龄段、驾龄、订单类型", "转化率、咨询率、资料补交率"],
  ["成熟自驾需求型", "年龄 35-54，驾龄 6 年以上，驾照类型 C 或以上", "决策效率高，重视稳定和履约时效", "强调标准流程、预计完成时间和可靠交付", "年龄段、驾龄、驾照类型", "复购率、准时发货率、客单价"],
  ["跨区域履约型", "驾照签发地与收货地不同省/市", "异地办理需求明显，物流路径更复杂", "优化地址校验、物流时效提示和异常预警", "签发省市、收货省市", "异地占比、物流时长、异常率"],
  ["加急高敏型", "是否加急订单 = 是", "时间敏感，对进度透明度要求高", "提供加急 SLA、主动通知和优先处理队列", "是否加急订单、下单时间", "加急率、加急准时率、投诉率"],
  ["渠道导流型", "来自特定渠道且订单量集中", "对平台规则和页面信息依赖高", "按渠道定制落地页、话术和售后说明", "订单渠道、订单类型", "渠道订单量、渠道转化率、退款率"],
  ["流程待推进型", "已下单但未翻译或未发货", "处于履约节点等待状态", "建立节点看板、超时提醒和任务分派", "是否翻译、是否发货、下单时间", "翻译完成率、发货转化率、超时订单数"],
];

const dashboardRows = [
  ["核心人群", "年龄段分布", "按年龄段统计订单用户数与占比", "柱状图 + 占比标签", "年龄/年龄段", "识别主力用户层"],
  ["地域来源", "驾照签发地 Top 10", "按省/市统计驾照来源", "地图或横向条形图", "驾照签发省份/城市", "指导区域运营与材料审核"],
  ["履约区域", "收货地 Top 10", "按省/市统计收货订单", "热力图或条形图", "收货省份/城市", "判断物流与履约压力"],
  ["产品结构", "订单类型占比", "不同产品类型订单占比", "环形图或堆叠条形图", "订单类型", "观察产品组合"],
  ["渠道贡献", "订单渠道贡献", "不同渠道订单数、占比、加急率", "柱状图 + 表格", "订单渠道、是否加急订单", "优化渠道投放"],
  ["时段节奏", "下单时间热力", "按小时/星期统计下单密度", "热力矩阵", "下单时间", "排班与客服响应"],
  ["服务偏好", "加急订单占比", "加急订单数 / 总订单数", "KPI 卡 + 趋势线", "是否加急订单", "评估加急服务需求"],
  ["履约转化", "翻译完成率", "已翻译订单数 / 总订单数", "漏斗或进度条", "是否翻译", "监控生产节点"],
  ["交付转化", "发货转化率", "已发货订单数 / 总订单数", "漏斗或进度条", "是否发货", "监控最终交付"],
];

const qualityRows = [
  ["出生日期/年龄", "缺失、未来日期、年龄小于 18 或大于 80", "影响年龄段分布和人群判断", "高", "用出生日期派生年龄；异常值进入待核查清单"],
  ["省市字段", "省市混填、简称不统一、空格/错别字", "影响地图和区域排行", "高", "拆分省/市并维护标准行政区映射"],
  ["订单渠道", "渠道名不统一、同一渠道多个写法", "影响渠道贡献分析", "高", "建立渠道字典，保留渠道编码"],
  ["订单类型", "类型边界不清，小白本/公证/翻译混用", "影响产品结构分析", "中", "建立产品分类表，订单记录只存标准枚举"],
  ["是否类字段", "是/否、Y/N、1/0 混用", "影响转化率口径", "高", "统一为是/否，并保留原始值字段备查"],
  ["下单时间", "时区不一致、日期文本无法识别", "影响趋势、时段和 SLA 分析", "高", "统一北京时间时间戳，派生日期/星期/小时"],
  ["初次领证年份", "未来年份、早于合理范围、文本格式", "影响驾龄计算", "中", "限制为整数年份，并做范围校验"],
  ["履约状态", "翻译、发货状态缺少节点时间", "难以定位流程瓶颈", "中", "补充翻译完成时间、发货时间、物流单号"],
];

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidthPx = width;
  });
}

function styleTitle(sheet, range, title, subtitle = "") {
  const titleRange = sheet.getRange(range);
  titleRange.merge();
  titleRange.values = [[title]];
  titleRange.format = {
    fill: palette.header,
    font: { bold: true, color: palette.white, size: 18 },
    horizontalAlignment: "Left",
    verticalAlignment: "Center",
  };
  titleRange.format.rowHeightPx = 44;
  if (subtitle) {
    const cell = sheet.getRange("A2");
    cell.values = [[subtitle]];
    cell.format = {
      fill: palette.bg,
      font: { color: palette.muted, size: 10 },
      wrapText: true,
      verticalAlignment: "Top",
    };
    sheet.getRange("A2:H2").merge();
    sheet.getRange("A2:H2").format.rowHeightPx = 36;
  }
}

function styleSection(sheet, range, label, fill = palette.panel) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[label]];
  r.format = {
    fill,
    font: { bold: true, color: palette.ink, size: 12 },
    verticalAlignment: "Center",
  };
  r.format.rowHeightPx = 28;
}

function writeTable(sheet, anchor, headers, rows, options = {}) {
  const [startColLetter, startRowStr] = anchor.match(/^([A-Z]+)(\d+)$/).slice(1);
  const startRow = Number(startRowStr);
  const colCount = headers.length;
  const rowCount = rows.length + 1;
  const rangeAddress = `${anchor}:${columnLetter(columnIndex(startColLetter) + colCount - 1)}${startRow + rowCount - 1}`;
  sheet.getRange(anchor).write([headers, ...rows]);
  const headerRange = sheet.getRange(`${anchor}:${columnLetter(columnIndex(startColLetter) + colCount - 1)}${startRow}`);
  headerRange.format = {
    fill: options.headerFill || palette.header2,
    font: { bold: true, color: palette.white },
    wrapText: true,
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
  };
  sheet.getRange(rangeAddress).format = {
    borders: {
      insideHorizontal: { style: "Continuous", color: palette.softLine, weight: "Thin" },
      insideVertical: { style: "Continuous", color: palette.softLine, weight: "Thin" },
      edgeTop: { style: "Continuous", color: palette.line, weight: "Thin" },
      edgeBottom: { style: "Continuous", color: palette.line, weight: "Thin" },
      edgeLeft: { style: "Continuous", color: palette.line, weight: "Thin" },
      edgeRight: { style: "Continuous", color: palette.line, weight: "Thin" },
    },
    wrapText: true,
    verticalAlignment: "Top",
  };
  sheet.getRange(rangeAddress).format.font = { color: palette.ink, size: 10 };
  headerRange.format.font = { bold: true, color: palette.white, size: 10 };
  for (let r = startRow + 1; r < startRow + rowCount; r += 1) {
    const rowRange = sheet.getRange(`${startColLetter}${r}:${columnLetter(columnIndex(startColLetter) + colCount - 1)}${r}`);
    rowRange.format.fill = r % 2 === 0 ? "#FCFCFD" : palette.white;
    rowRange.format.rowHeightPx = options.rowHeightPx || 44;
  }
  if (options.tableName) {
    const table = sheet.tables.add(rangeAddress, true, options.tableName);
    table.style = "TableStyleMedium2";
    table.showFilterButton = true;
  }
  return rangeAddress;
}

function columnIndex(letter) {
  let index = 0;
  for (const char of letter) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}

function columnLetter(index) {
  let result = "";
  while (index > 0) {
    const mod = (index - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    index = Math.floor((index - mod) / 26);
  }
  return result;
}

function setupSheet(sheet, zoomWidth = 10) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  setWidths(sheet, Array.from({ length: zoomWidth }, () => 120));
}

function addKpi(sheet, range, title, value, note, fill) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[`${title}\n${value}\n${note}`]];
  r.format = {
    fill,
    font: { bold: false, color: palette.ink, size: 10 },
    wrapText: true,
    verticalAlignment: "Center",
    horizontalAlignment: "Center",
    borders: {
      edgeTop: { style: "Continuous", color: palette.line, weight: "Thin" },
      edgeBottom: { style: "Continuous", color: palette.line, weight: "Thin" },
      edgeLeft: { style: "Continuous", color: palette.line, weight: "Thin" },
      edgeRight: { style: "Continuous", color: palette.line, weight: "Thin" },
    },
  };
  r.format.rowHeightPx = 86;
}

const overview = wb.worksheets.add("01_画像总览");
setupSheet(overview, 10);
setWidths(overview, [120, 130, 130, 130, 140, 140, 140, 140, 120, 120]);
styleTitle(
  overview,
  "A1:J1",
  "用户画像分析总览",
  "基于原始《用户画像》字段清单整理：当前文件是标准画像分析框架，可直接接入订单/用户明细后生成真实分布、趋势与转化。"
);

addKpi(overview, "A4:B6", "画像字段数", fieldRows.length, "覆盖基础属性、证件、订单、履约", palette.paleBlue);
addKpi(overview, "C4:D6", "分析模块数", modules.length, "形成完整用户画像链路", palette.paleGreen);
addKpi(overview, "E4:F6", "高优先级字段", fieldRows.filter((row) => row[7] === "高").length, "建议优先接入明细数据", palette.paleAmber);
addKpi(overview, "G4:H6", "建议看板指标", dashboardRows.length, "含结构、地域、渠道、履约", "#F4F3FF");
addKpi(overview, "I4:J6", "当前数据状态", "字段框架", "尚未包含真实用户明细", palette.paleRed);

styleSection(overview, "A8:J8", "标准画像分析路径");
overview.getRange("A9:J13").values = [
  ["1. 数据接入", "订单明细、用户资料、驾照信息、物流状态统一进入明细表", null, "2. 字段标准化", "清洗年龄、省市、渠道、订单类型、是否类状态", null, "3. 标签生成", "生成年龄段、驾龄段、异地办理、加急偏好等标签", null, null],
  ["4. 分群识别", "按场景形成新手办理、成熟自驾、加急高敏、跨区域履约等用户群", null, "5. 看板监控", "输出渠道贡献、产品结构、履约转化、区域热力和时段趋势", null, "6. 运营动作", "匹配投放、客服、排班、履约和复购策略", null, null],
  [null, null, null, null, null, null, null, null, null, null],
  ["核心结论", "原表已覆盖画像分析的关键字段，但缺少真实订单明细，因此当前最适合升级为“画像指标体系 + 看板模板 + 数据口径规范”。", null, null, null, null, null, null, null, null],
  ["优先建议", "先接入订单渠道、订单类型、下单时间、是否加急、是否翻译、是否发货，再补齐用户基础属性和驾照生命周期字段。", null, null, null, null, null, null, null, null],
];
["A9:B9", "D9:E9", "G9:H9", "A10:B10", "D10:E10", "G10:H10", "A12:J12", "A13:J13"].forEach((addr) => overview.getRange(addr).merge());
overview.getRange("A9:J13").format = {
  fill: palette.white,
  font: { color: palette.ink, size: 10 },
  wrapText: true,
  verticalAlignment: "Top",
  borders: {
    insideHorizontal: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    insideVertical: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    edgeTop: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeBottom: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeLeft: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeRight: { style: "Continuous", color: palette.line, weight: "Thin" },
  },
};
overview.getRange("A9:A10").format.fill = palette.paleBlue;
overview.getRange("D9:D10").format.fill = palette.paleGreen;
overview.getRange("G9:G10").format.fill = palette.paleAmber;
overview.getRange("A12:A13").format.fill = palette.panel;
overview.getRange("A9:J13").format.rowHeightPx = 58;

styleSection(overview, "A15:J15", "模块成熟度与使用场景");
writeTable(
  overview,
  "A16",
  ["模块", "字段范围", "画像目的", "推荐图表", "运营决策", "更新频率", "负责人", "成熟度判断"],
  modules.map((m) => [m.module, m.fields.join("、"), m.purpose, m.charts, m.decision, m.cadence, m.owner, m.maturity]),
  { tableName: "OverviewModules", rowHeightPx: 52, headerFill: palette.header }
);
overview.getRange("A16:H20").format.columnWidthPx = 120;

const system = wb.worksheets.add("02_指标体系");
setupSheet(system, 10);
setWidths(system, [150, 115, 105, 170, 190, 160, 105, 85, 160, 220]);
styleTitle(system, "A1:J1", "用户画像指标体系", "将原始字段升级为可治理、可分析、可看板化的指标字典。");
writeTable(
  system,
  "A4",
  ["字段名称", "模块", "指标类型", "字段说明", "主要分析用途", "建议数据来源", "更新粒度", "优先级", "标准取值/分组", "数据治理建议"],
  fieldRows,
  { tableName: "ProfileMetricDictionary", rowHeightPx: 48, headerFill: palette.header }
);
system.getRange("H5:H20").conditionalFormats.add("containsText", {
  text: "高",
  format: { fill: palette.paleAmber, font: { bold: true, color: palette.amber } },
});
system.getRange("B5:B20").conditionalFormats.add("containsText", {
  text: "订单行为",
  format: { fill: palette.paleBlue, font: { color: palette.blue } },
});
system.getRange("B5:B20").conditionalFormats.add("containsText", {
  text: "履约",
  format: { fill: palette.paleGreen, font: { color: palette.green } },
});

const segments = wb.worksheets.add("03_分群标签");
setupSheet(segments, 7);
setWidths(segments, [150, 240, 210, 240, 170, 170, 120]);
styleTitle(segments, "A1:G1", "用户分群与标签规则", "基于字段清单定义可落地的用户群，接入真实数据后可自动统计规模、转化与履约表现。");
writeTable(
  segments,
  "A4",
  ["用户群", "识别规则", "画像特征", "运营策略", "依赖字段", "建议监控指标"],
  segmentRows,
  { tableName: "ProfileSegments", rowHeightPx: 64, headerFill: palette.header }
);
styleSection(segments, "A13:G13", "标签生产规则示例");
segments.getRange("A14:G20").values = [
  ["标签名称", "规则口径", "标签值", "用途", "刷新频率", "风险提示", "落地动作"],
  ["年龄段", "按年龄分箱，年龄来自出生日期与当前日期", "18-24/25-34/35-44/45+", "人群结构与产品偏好", "月度", "出生日期缺失会导致未知值", "按年龄段优化说明文案"],
  ["驾龄段", "当前年份 - 初次领证年份", "0-2/3-5/6-10/10+", "识别新手与成熟驾驶用户", "年度", "初次领证年份异常会放大误差", "配置新手办理指引"],
  ["异地办理", "驾照签发省市与收货省市不一致", "是/否", "识别跨区域履约需求", "每日", "省市口径需标准化", "强化地址校验与物流提醒"],
  ["加急偏好", "历史或当前订单存在加急", "是/否", "识别时间敏感用户", "每日", "加急字段需统一是/否", "展示 SLA 与进度通知"],
  ["流程状态", "是否翻译、是否发货组合", "待翻译/待发货/已发货", "生产履约看板", "实时/每日", "缺少节点时间时无法算时效", "超时订单提醒"],
  ["渠道来源", "订单渠道标准化归并", "携程/官网/线下/其他", "渠道投放与合作评估", "每日", "渠道别名会造成重复统计", "建立渠道字典"],
];
segments.getRange("A14:G14").format = {
  fill: palette.header2,
  font: { bold: true, color: palette.white },
  horizontalAlignment: "Center",
  verticalAlignment: "Center",
};
segments.getRange("A14:G20").format = {
  wrapText: true,
  borders: {
    insideHorizontal: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    insideVertical: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    edgeTop: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeBottom: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeLeft: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeRight: { style: "Continuous", color: palette.line, weight: "Thin" },
  },
};
segments.getRange("A15:G20").format.rowHeightPx = 52;

const dashboard = wb.worksheets.add("04_看板模板");
setupSheet(dashboard, 7);
setWidths(dashboard, [130, 150, 220, 140, 180, 190, 120]);
styleTitle(dashboard, "A1:G1", "画像看板模板", "建议把真实数据接入后，按照这些指标组织日常运营看板。");
writeTable(
  dashboard,
  "A4",
  ["看板区域", "指标名称", "口径说明", "推荐呈现", "依赖字段", "业务用途"],
  dashboardRows,
  { tableName: "DashboardMetricTemplate", rowHeightPx: 52, headerFill: palette.header }
);
styleSection(dashboard, "A16:G16", "推荐首屏布局");
dashboard.getRange("A17:G24").values = [
  ["左上", "KPI 卡", "总订单数、加急率、翻译完成率、发货转化率", null, "右上", "渠道/产品结构", "渠道贡献与订单类型占比"],
  ["中部", "人群结构", "年龄段、性别、国籍、驾龄段", null, "中部", "地域热力", "驾照签发地与收货地 Top 区域"],
  ["底部", "履约漏斗", "下单 -> 翻译 -> 发货", null, "底部", "时间趋势", "按日/周/月查看订单节奏"],
  [null, null, null, null, null, null, null],
  ["筛选器", "时间范围、渠道、订单类型、省市、是否加急", null, null, null, null, null],
  ["预警规则", "加急订单超时、已翻译未发货、渠道异常波动、重点城市履约积压", null, null, null, null, null],
  ["输出频率", "运营日报看履约与异常，周报看渠道/产品，月报看用户结构和增长趋势", null, null, null, null, null],
  ["使用提醒", "原始文件暂无明细数据，以上为标准看板框架。接入真实订单明细后，可补充数据透视表与图表。", null, null, null, null, null],
];
["A17:C17", "E17:G17", "A18:C18", "E18:G18", "A19:C19", "E19:G19", "A21:G21", "A22:G22", "A23:G23", "A24:G24"].forEach((addr) => dashboard.getRange(addr).merge());
dashboard.getRange("A17:G24").format = {
  fill: palette.white,
  font: { color: palette.ink, size: 10 },
  wrapText: true,
  verticalAlignment: "Top",
  borders: {
    insideHorizontal: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    insideVertical: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    edgeTop: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeBottom: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeLeft: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeRight: { style: "Continuous", color: palette.line, weight: "Thin" },
  },
};
dashboard.getRange("A17:A19").format.fill = palette.paleBlue;
dashboard.getRange("E17:E19").format.fill = palette.paleGreen;
dashboard.getRange("A21:A24").format.fill = palette.panel;
dashboard.getRange("A17:G24").format.rowHeightPx = 44;

const quality = wb.worksheets.add("05_数据口径");
setupSheet(quality, 7);
setWidths(quality, [150, 230, 210, 80, 260, 120, 120]);
styleTitle(quality, "A1:G1", "数据口径与质量检查", "用于保证用户画像分析可复用、可对比、可被业务信任。");
writeTable(
  quality,
  "A4",
  ["检查对象", "常见问题", "分析影响", "风险等级", "建议处理方式"],
  qualityRows,
  { tableName: "ProfileDataQuality", rowHeightPx: 58, headerFill: palette.header }
);
quality.getRange("D5:D12").conditionalFormats.add("containsText", {
  text: "高",
  format: { fill: palette.paleRed, font: { bold: true, color: palette.red } },
});
quality.getRange("D5:D12").conditionalFormats.add("containsText", {
  text: "中",
  format: { fill: palette.paleAmber, font: { bold: true, color: palette.amber } },
});
styleSection(quality, "A15:G15", "建议明细数据表字段");
quality.getRange("A16:G25").values = [
  ["字段", "类型", "是否必填", "示例", "说明", "派生字段", "备注"],
  ["order_id", "文本", "是", "ORD202605210001", "订单唯一标识", "否", "用于去重"],
  ["user_id", "文本", "建议", "U10001", "用户唯一标识", "否", "没有用户 ID 时可用手机号哈希"],
  ["birth_date", "日期", "建议", "1992-08-15", "出生日期", "年龄、年龄段", "注意隐私保护"],
  ["license_issue_city", "文本", "建议", "江苏省苏州市", "驾照签发地", "签发省、签发市", "需标准化"],
  ["delivery_city", "文本", "是", "上海市浦东新区", "收货地", "收货省、收货市", "需标准化"],
  ["order_channel", "枚举", "是", "携程", "获客渠道", "渠道分组", "维护渠道字典"],
  ["order_type", "枚举", "是", "小白本", "产品类型", "产品大类", "维护产品字典"],
  ["is_urgent", "布尔/枚举", "是", "是", "是否加急", "加急偏好", "统一是/否"],
  ["order_time", "时间戳", "是", "2026-05-21 13:36", "下单时间", "日期、星期、小时", "统一时区"],
];
quality.getRange("A16:G16").format = {
  fill: palette.header2,
  font: { bold: true, color: palette.white },
  horizontalAlignment: "Center",
};
quality.getRange("A16:G25").format = {
  wrapText: true,
  borders: {
    insideHorizontal: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    insideVertical: { style: "Continuous", color: palette.softLine, weight: "Thin" },
    edgeTop: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeBottom: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeLeft: { style: "Continuous", color: palette.line, weight: "Thin" },
    edgeRight: { style: "Continuous", color: palette.line, weight: "Thin" },
  },
};
quality.getRange("A17:G25").format.rowHeightPx = 42;

for (const sheet of [overview, system, segments, dashboard, quality]) {
  const used = sheet.getUsedRange();
  used.format.font = { name: "Microsoft YaHei", color: palette.ink };
  sheet.getRange("A1:Z1").format.font = { name: "Microsoft YaHei", bold: true, color: palette.white, size: 18 };
}

const inspect = await wb.inspect({
  kind: "sheet,table",
  maxChars: 10000,
  tableMaxRows: 5,
  tableMaxCols: 8,
});
await fs.writeFile("C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/final-inspect.ndjson", inspect.ndjson, "utf8");

const errors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
await fs.writeFile("C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/final-errors.ndjson", errors.ndjson, "utf8");

for (const sheetName of ["01_画像总览", "02_指标体系", "03_分群标签", "04_看板模板", "05_数据口径"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${previewDir}/${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(outputPath);
console.log(outputPath);
