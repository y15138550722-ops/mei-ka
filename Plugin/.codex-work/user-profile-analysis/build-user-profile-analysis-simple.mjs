import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputPath = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx/用户画像_标准分析版.xlsx";
const previewDir = "C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/previews-simple";
await fs.mkdir(previewDir, { recursive: true });

const wb = Workbook.create();

const colors = {
  dark: "#1F4E5F",
  green: "#2F6B5F",
  light: "#F8FAFC",
  panel: "#EEF6F3",
  blue: "#EFF6FF",
  amber: "#FFFAEB",
  red: "#FEF2F2",
  white: "#FFFFFF",
  text: "#172033",
  muted: "#667085",
};

const fieldRows = [
  ["年龄", "用户基础属性", "人口统计", "根据出生日期计算", "年龄分布、年龄段占比", "出生日期、下单时间或当前日期", "高", "用真实出生日期计算，避免手填年龄失真"],
  ["年龄段", "用户基础属性", "分层标签", "按年龄区间生成", "用户分层分析", "年龄", "高", "建议统一分箱规则，便于跨周期对比"],
  ["性别", "用户基础属性", "人口统计", "男/女/未知", "性别占比", "用户注册资料或证件信息", "中", "保留未知值，避免强制归类"],
  ["国籍", "用户基础属性", "人口统计", "中国/其他国家或地区", "国籍分布", "证件资料或订单填写信息", "中", "用于识别跨境/外籍用户服务需求"],
  ["驾照签发省份/城市", "证件属性", "地理来源", "驾照签发地", "驾照来源地图", "驾照信息", "高", "建议省市拆分为两个字段，便于地图分析"],
  ["收货省份/城市", "履约属性", "地理需求", "订单收货地址", "收货热力图、履约区域分析", "物流地址", "高", "建议与驾照签发地做交叉，识别异地办理"],
  ["驾照类型", "证件属性", "产品资格", "A、B、C 等类型", "驾照类型分布", "驾照信息", "高", "可与订单类型交叉，识别主要服务客群"],
  ["初次领证年份", "证件属性", "生命周期", "例如 2017", "驾龄分布", "驾照信息", "中", "需校验年份范围，避免未来年份或异常早期年份"],
  ["驾龄", "证件属性", "生命周期", "当前年份 - 初次领证年份", "驾龄画像", "初次领证年份", "中", "建议用公式派生，不作为人工录入字段"],
  ["有限期限", "证件属性", "生命周期", "6 年、10 年等", "证件生命周期分析", "驾照信息", "中", "可辅助提醒续期、到期风险和服务窗口"],
  ["订单渠道", "订单行为", "获客来源", "携程等渠道", "渠道贡献分析", "订单来源", "高", "要保留渠道编码与渠道名称映射表"],
  ["订单类型", "订单行为", "产品偏好", "小白本、公证等", "产品类型占比", "订单明细", "高", "用于观察产品结构、交叉销售机会"],
  ["是否加急订单", "订单行为", "服务偏好", "是/否", "加急订单占比", "订单明细", "高", "可和渠道/城市交叉，判断履约压力"],
  ["下单时间", "订单行为", "时间行为", "订单发起时间", "下单时段趋势", "订单明细", "高", "建议保留标准时间戳，同时派生小时段和星期"],
  ["是否翻译", "履约进度", "流程状态", "是/否", "处理进度看板", "生产流程记录", "高", "用于监控生产节点转化"],
  ["是否发货", "履约进度", "流程状态", "是/否", "发货转化率", "物流/发货记录", "高", "建议与下单时间计算履约时效"],
];

const modules = [
  ["用户基础属性", "年龄、年龄段、性别、国籍", "识别核心人群结构，作为所有分群与交叉分析的基础。", "年龄段柱状图、性别占比、国籍分布", "明确主力年龄层与潜在服务语言/材料需求。", "月度"],
  ["证件属性", "驾照签发省份/城市、驾照类型、初次领证年份、驾龄、有限期限", "理解驾照来源、类型和生命周期，识别高价值办理场景。", "签发地地图、驾照类型分布、驾龄分布", "优化材料审核策略、续期提醒和区域资源投放。", "月度/季度"],
  ["订单行为", "订单渠道、订单类型、是否加急订单、下单时间", "衡量获客来源、产品偏好、服务紧急程度与下单节奏。", "渠道贡献、产品结构、加急率、下单时段热力", "优化渠道预算、排班计划和产品组合。", "日/周/月"],
  ["履约属性", "收货省份/城市、是否翻译、是否发货", "追踪履约区域、生产节点和最终交付转化。", "收货地热力图、翻译完成率、发货转化率", "发现履约瓶颈、区域时效差异和异常订单。", "日/周"],
];

const segments = [
  ["新手出境办理型", "年龄 18-34，驾龄 0-5 年，订单类型为小白本/翻译", "年轻、首次办理概率高、需要清晰指引", "突出材料清单、进度提醒、在线客服", "转化率、咨询率、资料补交率"],
  ["成熟自驾需求型", "年龄 35-54，驾龄 6 年以上，驾照类型 C 或以上", "决策效率高，重视稳定和履约时效", "强调标准流程、预计完成时间和可靠交付", "复购率、准时发货率、客单价"],
  ["跨区域履约型", "驾照签发地与收货地不同省/市", "异地办理需求明显，物流路径更复杂", "优化地址校验、物流时效提示和异常预警", "异地占比、物流时长、异常率"],
  ["加急高敏型", "是否加急订单 = 是", "时间敏感，对进度透明度要求高", "提供加急 SLA、主动通知和优先处理队列", "加急率、加急准时率、投诉率"],
  ["渠道导流型", "来自特定渠道且订单量集中", "对平台规则和页面信息依赖高", "按渠道定制落地页、话术和售后说明", "渠道订单量、渠道转化率、退款率"],
  ["流程待推进型", "已下单但未翻译或未发货", "处于履约节点等待状态", "建立节点看板、超时提醒和任务分派", "翻译完成率、发货转化率、超时订单数"],
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

function styleSheet(sheet, widths) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidthPx = width;
  });
}

function title(sheet, address, text, note) {
  sheet.getRange(address).merge();
  sheet.getRange(address).values = [[text]];
  sheet.getRange(address).format = {
    fill: colors.dark,
    font: { bold: true, color: colors.white, size: 18 },
  };
  sheet.getRange(address).format.rowHeightPx = 42;
  sheet.getRange("A2").values = [[note]];
  sheet.getRange("A2").format = {
    fill: colors.light,
    font: { color: colors.muted, size: 10 },
    wrapText: true,
  };
  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2:H2").format.rowHeightPx = 34;
}

function section(sheet, address, text) {
  sheet.getRange(address).merge();
  sheet.getRange(address).values = [[text]];
  sheet.getRange(address).format = {
    fill: colors.panel,
    font: { bold: true, color: colors.text, size: 12 },
  };
  sheet.getRange(address).format.rowHeightPx = 28;
}

function table(sheet, anchor, headers, rows, headerFill = colors.green) {
  sheet.getRange(anchor).write([headers, ...rows]);
  const colCount = headers.length;
  const rowCount = rows.length + 1;
  const [, col, rowText] = anchor.match(/^([A-Z]+)(\d+)$/);
  const row = Number(rowText);
  const start = colToNumber(col);
  const endCol = numberToCol(start + colCount - 1);
  const all = `${anchor}:${endCol}${row + rowCount - 1}`;
  const head = `${anchor}:${endCol}${row}`;
  sheet.getRange(head).format = {
    fill: headerFill,
    font: { bold: true, color: colors.white, size: 10 },
    wrapText: true,
  };
  sheet.getRange(all).format.wrapText = true;
  sheet.getRange(all).format.font = { color: colors.text, size: 10 };
  for (let i = row + 1; i <= row + rowCount - 1; i += 1) {
    sheet.getRange(`${col}${i}:${endCol}${i}`).format.fill = i % 2 === 0 ? "#FCFCFD" : colors.white;
    sheet.getRange(`${col}${i}:${endCol}${i}`).format.rowHeightPx = 58;
  }
  return all;
}

function colToNumber(col) {
  let n = 0;
  for (const c of col) n = n * 26 + c.charCodeAt(0) - 64;
  return n;
}

function numberToCol(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

const overview = wb.worksheets.add("01_画像总览");
styleSheet(overview, [125, 230, 190, 180, 220, 135, 110, 110]);
title(overview, "A1:H1", "用户画像分析总览", "基于原始《用户画像》字段清单整理：当前文件是标准画像分析框架，可接入真实订单/用户明细后生成真实分布、趋势与转化。");
section(overview, "A4:H4", "核心指标");
table(overview, "A5", ["指标", "结果", "说明", "后续动作"], [
  ["画像字段数", fieldRows.length, "覆盖基础属性、证件、订单、履约", "字段口径标准化"],
  ["分析模块数", modules.length, "形成完整用户画像链路", "接入明细数据"],
  ["高优先级字段", fieldRows.filter((row) => row[6] === "高").length, "建议优先接入", "先做订单行为与履约看板"],
  ["建议看板指标", dashboardRows.length, "含结构、地域、渠道、履约", "按日报/周报/月报分层输出"],
]);
section(overview, "A11:H11", "标准画像分析路径");
table(overview, "A12", ["步骤", "工作内容", "产出"], [
  ["1. 数据接入", "订单明细、用户资料、驾照信息、物流状态统一进入明细表", "可分析数据底表"],
  ["2. 字段标准化", "清洗年龄、省市、渠道、订单类型、是否类状态", "统一口径指标字典"],
  ["3. 标签生成", "生成年龄段、驾龄段、异地办理、加急偏好等标签", "用户标签体系"],
  ["4. 分群识别", "形成新手办理、成熟自驾、加急高敏、跨区域履约等用户群", "可运营用户群"],
  ["5. 看板监控", "输出渠道贡献、产品结构、履约转化、区域热力和时段趋势", "日常运营看板"],
  ["6. 运营动作", "匹配投放、客服、排班、履约和复购策略", "业务动作清单"],
]);
section(overview, "A21:H21", "模块成熟度与使用场景");
table(overview, "A22", ["模块", "字段范围", "画像目的", "推荐图表", "运营决策", "更新频率"], modules);

const system = wb.worksheets.add("02_指标体系");
styleSheet(system, [150, 115, 110, 190, 220, 185, 85, 270]);
title(system, "A1:H1", "用户画像指标体系", "将原始字段升级为可治理、可分析、可看板化的指标字典。");
table(system, "A4", ["字段名称", "模块", "指标类型", "字段说明", "主要分析用途", "建议数据来源", "优先级", "数据治理建议"], fieldRows, colors.dark);

const segmentSheet = wb.worksheets.add("03_分群标签");
styleSheet(segmentSheet, [160, 270, 235, 270, 210, 160, 120, 120]);
title(segmentSheet, "A1:H1", "用户分群与标签规则", "基于字段清单定义可落地的用户群，接入真实数据后可自动统计规模、转化与履约表现。");
table(segmentSheet, "A4", ["用户群", "识别规则", "画像特征", "运营策略", "建议监控指标"], segments, colors.dark);
section(segmentSheet, "A13:H13", "标签生产规则示例");
table(segmentSheet, "A14", ["标签名称", "规则口径", "标签值", "用途", "刷新频率", "风险提示"], [
  ["年龄段", "按年龄分箱，年龄来自出生日期与当前日期", "18-24/25-34/35-44/45+", "人群结构与产品偏好", "月度", "出生日期缺失会导致未知值"],
  ["驾龄段", "当前年份 - 初次领证年份", "0-2/3-5/6-10/10+", "识别新手与成熟驾驶用户", "年度", "初次领证年份异常会放大误差"],
  ["异地办理", "驾照签发省市与收货省市不一致", "是/否", "识别跨区域履约需求", "每日", "省市口径需标准化"],
  ["加急偏好", "历史或当前订单存在加急", "是/否", "识别时间敏感用户", "每日", "加急字段需统一是/否"],
  ["流程状态", "是否翻译、是否发货组合", "待翻译/待发货/已发货", "生产履约看板", "每日", "缺少节点时间时无法算时效"],
], colors.green);

const dashboard = wb.worksheets.add("04_看板模板");
styleSheet(dashboard, [130, 165, 245, 160, 210, 230, 120, 120]);
title(dashboard, "A1:H1", "画像看板模板", "建议把真实数据接入后，按照这些指标组织日常运营看板。");
table(dashboard, "A4", ["看板区域", "指标名称", "口径说明", "推荐呈现", "依赖字段", "业务用途"], dashboardRows, colors.dark);
section(dashboard, "A16:H16", "推荐首屏布局");
table(dashboard, "A17", ["位置", "模块", "内容"], [
  ["左上", "KPI 卡", "总订单数、加急率、翻译完成率、发货转化率"],
  ["右上", "渠道/产品结构", "渠道贡献与订单类型占比"],
  ["中部", "人群与地域", "年龄段、性别、国籍、驾龄段、签发地与收货地 Top 区域"],
  ["底部", "履约与时间", "下单 -> 翻译 -> 发货漏斗，以及按日/周/月查看订单节奏"],
  ["筛选器", "通用筛选", "时间范围、渠道、订单类型、省市、是否加急"],
  ["预警规则", "异常监控", "加急订单超时、已翻译未发货、渠道异常波动、重点城市履约积压"],
], colors.green);

const quality = wb.worksheets.add("05_数据口径");
styleSheet(quality, [160, 260, 220, 90, 300, 150, 120, 120]);
title(quality, "A1:H1", "数据口径与质量检查", "用于保证用户画像分析可复用、可对比、可被业务信任。");
table(quality, "A4", ["检查对象", "常见问题", "分析影响", "风险等级", "建议处理方式"], qualityRows, colors.dark);
section(quality, "A15:H15", "建议明细数据表字段");
table(quality, "A16", ["字段", "类型", "是否必填", "示例", "说明", "派生字段"], [
  ["order_id", "文本", "是", "ORD202605210001", "订单唯一标识", "否"],
  ["user_id", "文本", "建议", "U10001", "用户唯一标识", "否"],
  ["birth_date", "日期", "建议", "1992-08-15", "出生日期", "年龄、年龄段"],
  ["license_issue_city", "文本", "建议", "江苏省苏州市", "驾照签发地", "签发省、签发市"],
  ["delivery_city", "文本", "是", "上海市浦东新区", "收货地", "收货省、收货市"],
  ["order_channel", "枚举", "是", "携程", "获客渠道", "渠道分组"],
  ["order_type", "枚举", "是", "小白本", "产品类型", "产品大类"],
  ["is_urgent", "布尔/枚举", "是", "是", "是否加急", "加急偏好"],
  ["order_time", "时间戳", "是", "2026-05-21 13:36", "下单时间", "日期、星期、小时"],
], colors.green);

const inspect = await wb.inspect({
  kind: "sheet,table",
  maxChars: 8000,
  tableMaxRows: 5,
  tableMaxCols: 8,
});
await fs.writeFile("C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/simple-inspect.ndjson", inspect.ndjson, "utf8");

const errors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
});
await fs.writeFile("C:/Users/yaozh/Desktop/mei ka/.codex-work/user-profile-analysis/simple-errors.ndjson", errors.ndjson, "utf8");

for (const sheetName of ["01_画像总览", "02_指标体系", "03_分群标签", "04_看板模板", "05_数据口径"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${previewDir}/${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(outputPath);
console.log(outputPath);
