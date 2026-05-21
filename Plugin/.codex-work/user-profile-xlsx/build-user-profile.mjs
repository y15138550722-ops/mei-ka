import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/yaozh/Desktop/mei ka/docs/ETC/xlsx";
const outputPath = path.join(outputDir, "用户画像_优化版.xlsx");

const currentYear = 2026;

const userRows = [
  {
    userId: "用户A",
    sourceImage: "图片1",
    userType: "驾照证件服务用户",
    gender: "男",
    birthDate: new Date("1987-03-07"),
    age: 39,
    ageBand: "35-44岁",
    nationality: "中国",
    licenseType: "C1",
    licenseProvince: "安徽省",
    licenseCity: "合肥市",
    deliveryProvince: "安徽省",
    deliveryCity: "合肥市",
    regionRelation: "本地证件、本地收货",
    firstIssueDate: new Date("2017-08-29"),
    firstIssueYear: 2017,
    drivingYears: currentYear - 2017,
    validFrom: new Date("2023-08-29"),
    validityYears: 10,
    expiryRisk: "低",
    channel: "自营/小白本",
    orderType: "驾照证件服务",
    urgent: "未知/否",
    orderQty: null,
    orderTime: null,
    paymentMethod: null,
    processStatus: "未展示",
    translated: "未知",
    shipped: "未知",
    consigneeRelation: "本人/一致",
    addressType: "城市住宅/常规地址",
    dataQuality: "联系电话格式需核验",
    riskLevel: "低",
    priority: "普通核验",
    userTags: "成熟男性、本地用户、C1驾照、常规办理、低风险",
    potentialNeed: "常规驾照翻译件/出行证件办理",
    followUp: "核对联系电话格式后进入常规履约流程",
  },
  {
    userId: "用户B",
    sourceImage: "图片2",
    userType: "驾照证件服务用户",
    gender: "男",
    birthDate: new Date("2002-06-08"),
    age: 23,
    ageBand: "18-24岁",
    nationality: "中国",
    licenseType: "C1",
    licenseProvince: "河南省",
    licenseCity: "周口市",
    deliveryProvince: "海南省",
    deliveryCity: "海口市",
    regionRelation: "异地证件、异地收货",
    firstIssueDate: new Date("2020-09-05"),
    firstIssueYear: 2020,
    drivingYears: currentYear - 2020,
    validFrom: new Date("2020-09-05"),
    validityYears: 6,
    expiryRisk: "中",
    channel: "携程API",
    orderType: "标准件 新版",
    urgent: "是",
    orderQty: 1,
    orderTime: new Date("2026-05-20T22:40:13"),
    paymentMethod: "携程API",
    processStatus: "已翻译",
    translated: "是",
    shipped: "否/未展示",
    consigneeRelation: "非本人/不一致",
    addressType: "高校/学院地址",
    dataQuality: "离境日期默认值、发货时间默认值、快递单号为空",
    riskLevel: "中",
    priority: "优先核验",
    userTags: "年轻用户、异地收货、携程渠道、加急订单、高校地址、需复核",
    potentialNeed: "旅行、租车、留学或出境前急用证件",
    followUp: "优先确认收件人关系、出行日期、地址电话和发货状态",
  },
];

const detailHeaders = [
  "用户编号",
  "来源图片",
  "用户类型",
  "性别",
  "出生日期",
  "年龄",
  "年龄段",
  "国籍",
  "驾照类型",
  "驾照签发省份",
  "驾照签发城市",
  "收货省份",
  "收货城市",
  "区域特征",
  "初次领证日期",
  "初次领证年份",
  "驾龄",
  "有效起始日期",
  "有效期限",
  "到期风险",
  "订单渠道",
  "订单类型",
  "是否加急",
  "订单数量",
  "下单时间",
  "付款方式",
  "处理状态",
  "是否翻译",
  "是否发货",
  "收货人与证件人关系",
  "收货地址类型",
  "数据质量问题",
  "风险等级",
  "核验优先级",
  "用户标签",
  "潜在需求",
  "建议动作",
];

const detailValues = userRows.map((row) => [
  row.userId,
  row.sourceImage,
  row.userType,
  row.gender,
  row.birthDate,
  row.age,
  row.ageBand,
  row.nationality,
  row.licenseType,
  row.licenseProvince,
  row.licenseCity,
  row.deliveryProvince,
  row.deliveryCity,
  row.regionRelation,
  row.firstIssueDate,
  row.firstIssueYear,
  row.drivingYears,
  row.validFrom,
  row.validityYears,
  row.expiryRisk,
  row.channel,
  row.orderType,
  row.urgent,
  row.orderQty,
  row.orderTime,
  row.paymentMethod,
  row.processStatus,
  row.translated,
  row.shipped,
  row.consigneeRelation,
  row.addressType,
  row.dataQuality,
  row.riskLevel,
  row.priority,
  row.userTags,
  row.potentialNeed,
  row.followUp,
]);

const dictionaryRows = [
  ["字段分类", "字段名称", "说明", "驾驶舱用途", "建议图表"],
  ["基础属性", "年龄", "由出生日期计算，建议按订单日期或统计日期动态计算", "用户年龄分布", "柱状图/分组条形图"],
  ["基础属性", "年龄段", "18-24、25-34、35-44、45+等", "用户分层", "环形图/堆叠柱状图"],
  ["基础属性", "性别", "男/女/未知", "性别结构", "环形图"],
  ["基础属性", "国籍", "中国/其他", "国籍分布", "条形图"],
  ["地域属性", "驾照签发省份/城市", "驾驶证签发地", "证件来源地分析", "地图/排行条形图"],
  ["地域属性", "收货省份/城市", "履约收货地", "履约热区分析", "地图/排行条形图"],
  ["地域属性", "区域特征", "本地或异地收货判断", "异地订单占比", "环形图"],
  ["证件属性", "驾照类型", "C1等准驾车型", "证件类型结构", "条形图"],
  ["证件属性", "初次领证年份", "首次领证年份", "驾龄分布", "柱状图"],
  ["证件属性", "驾龄", "统计年份 - 初领年份", "经验层级分析", "直方图"],
  ["证件属性", "有效期限", "6年/10年等", "证件生命周期分析", "柱状图"],
  ["订单属性", "订单渠道", "自营、携程API等", "渠道贡献", "柱状图"],
  ["订单属性", "订单类型", "标准件、新版、小白本等", "产品结构", "条形图"],
  ["订单属性", "是否加急", "是/否/未知", "高时效需求占比", "指标卡/环形图"],
  ["履约属性", "是否翻译", "订单是否完成翻译", "处理进度", "漏斗图"],
  ["履约属性", "是否发货", "是否有有效发货状态", "发货转化", "漏斗图"],
  ["风险属性", "收货人与证件人关系", "本人/非本人/未知", "代收风险识别", "堆叠柱状图"],
  ["风险属性", "数据质量问题", "默认日期、快递单号为空、电话异常等", "数据质量监控", "异常清单"],
  ["风险属性", "风险等级", "低/中/高", "复核优先级", "矩阵/指标卡"],
  ["标签属性", "用户标签", "多标签文本，可后续拆分为标签明细表", "画像聚类", "词云/标签排行"],
];

const tagRows = [
  ["规则名称", "判断条件", "输出标签", "业务含义"],
  ["年龄分层", "18-24岁", "年轻用户", "出行、留学、校园地址场景可能性更高"],
  ["年龄分层", "35-44岁", "成熟用户", "常规办理和稳定履约概率更高"],
  ["区域关系", "驾照签发城市 = 收货城市", "本地用户", "信息一致性较强"],
  ["区域关系", "驾照签发省份/城市 != 收货省份/城市", "异地收货", "可能为旅行、代收、临时地址或跨城履约"],
  ["渠道来源", "订单渠道 = 携程API", "OTA渠道用户", "旅行相关需求可能性较高"],
  ["订单时效", "是否加急 = 是", "高时效需求", "需要优先履约和客服核验"],
  ["地址类型", "收货地址包含学校/学院/大学", "高校地址", "可能为学生、校园代收或短期收件场景"],
  ["一致性", "收货人与证件人不一致", "需复核", "需确认代收关系与证件寄送风险"],
  ["数据质量", "日期为1970-01-01或快递单号为空", "数据异常", "应进入数据质量看板或人工复查"],
  ["证件生命周期", "有效期剩余不足6个月", "临期证件", "出境租车等场景需提醒用户确认有效性"],
];

const summaryRows = [
  ["指标", "数值", "说明"],
  ["样本用户数", userRows.length, "来自图片订单信息整理"],
  ["男性用户数", userRows.filter((r) => r.gender === "男").length, "当前样本均为男性"],
  ["C1驾照用户数", userRows.filter((r) => r.licenseType === "C1").length, "当前样本均为C1"],
  ["异地收货用户数", userRows.filter((r) => r.regionRelation.includes("异地")).length, "证件地与收货地不一致"],
  ["加急订单数", userRows.filter((r) => r.urgent === "是").length, "明确标记加急"],
  ["需优先核验数", userRows.filter((r) => r.priority === "优先核验").length, "存在履约或数据质量风险"],
  ["中风险用户数", userRows.filter((r) => r.riskLevel === "中").length, "建议人工确认后履约"],
];

const segmentRows = [
  ["分组类型", "分组", "用户数"],
  ["年龄段", "18-24岁", userRows.filter((r) => r.ageBand === "18-24岁").length],
  ["年龄段", "35-44岁", userRows.filter((r) => r.ageBand === "35-44岁").length],
  ["区域特征", "本地证件、本地收货", userRows.filter((r) => r.regionRelation.includes("本地")).length],
  ["区域特征", "异地证件、异地收货", userRows.filter((r) => r.regionRelation.includes("异地")).length],
  ["订单渠道", "自营/小白本", userRows.filter((r) => r.channel === "自营/小白本").length],
  ["订单渠道", "携程API", userRows.filter((r) => r.channel === "携程API").length],
  ["风险等级", "低", userRows.filter((r) => r.riskLevel === "低").length],
  ["风险等级", "中", userRows.filter((r) => r.riskLevel === "中").length],
];

function writeMatrix(sheet, startCell, values) {
  sheet.getRange(startCell).write(values);
}

function setWidths(sheet, widths) {
  widths.forEach((width, idx) => {
    const col = columnName(idx + 1);
    sheet.getRange(`${col}:${col}`).columnWidthPx = width;
  });
}

function columnName(index) {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function styleHeader(range) {
  range.format.fill.color = "#174E4F";
  range.format.font.color = "#FFFFFF";
  range.format.font.bold = true;
  range.format.horizontalAlignment = "Center";
}

function styleTitle(range) {
  range.format.fill.color = "#0E3B43";
  range.format.font.color = "#FFFFFF";
  range.format.font.bold = true;
  range.format.font.size = 16;
}

const workbook = Workbook.create();
const dashboard = workbook.worksheets.add("看板概览");
const detail = workbook.worksheets.add("用户画像明细");
const dictionary = workbook.worksheets.add("字段字典");
const tags = workbook.worksheets.add("标签规则");

writeMatrix(dashboard, "A1", [["用户画像数据驾驶舱 - 样本概览"]]);
dashboard.getRange("A1:C1").merge();
styleTitle(dashboard.getRange("A1:C1"));
writeMatrix(dashboard, "A3", summaryRows);
writeMatrix(dashboard, "E3", segmentRows);
styleHeader(dashboard.getRange("A3:C3"));
styleHeader(dashboard.getRange("E3:G3"));
setWidths(dashboard, [170, 90, 260, 24, 120, 160, 80]);
dashboard.getRange("A4:B10").format.fill.color = "#EAF5F2";
dashboard.getRange("E4:G11").format.fill.color = "#F7FBFA";
dashboard.getRange("A12:C12").values = [["看板建议", "推荐可视化", "说明"]];
styleHeader(dashboard.getRange("A12:C12"));
writeMatrix(dashboard, "A13", [
  ["用户结构", "年龄段、性别、驾照类型", "用于观察核心客群构成"],
  ["地域流向", "驾照签发地地图 + 收货地地图", "用于识别异地履约和热点城市"],
  ["渠道质量", "渠道订单量、加急占比、异常率", "用于对比自营与OTA渠道表现"],
  ["履约风险", "风险等级、核验优先级、数据质量问题", "用于建立客服/运营复核队列"],
]);

writeMatrix(detail, "A1", [detailHeaders, ...detailValues]);
styleHeader(detail.getRange("A1:AK1"));
detail.freezePanes.freezeRows(1);
setWidths(detail, [
  90, 80, 140, 60, 100, 60, 90, 70, 80, 110, 110, 110, 110, 160, 110, 110, 70,
  110, 80, 80, 110, 120, 80, 80, 150, 100, 100, 80, 90, 150, 130, 260, 80, 100,
  280, 240, 300,
]);
detail.getRange("E:E").numberFormat = "yyyy-mm-dd";
detail.getRange("O:O").numberFormat = "yyyy-mm-dd";
detail.getRange("R:R").numberFormat = "yyyy-mm-dd";
detail.getRange("Y:Y").numberFormat = "yyyy-mm-dd hh:mm:ss";
detail.getRange("A2:AK3").format.wrapText = true;
detail.getRange("A2:AK3").format.fill.color = "#F7FBFA";

writeMatrix(dictionary, "A1", dictionaryRows);
styleHeader(dictionary.getRange("A1:E1"));
dictionary.freezePanes.freezeRows(1);
setWidths(dictionary, [110, 180, 320, 220, 160]);
dictionary.getRange("A2:E22").format.wrapText = true;

writeMatrix(tags, "A1", tagRows);
styleHeader(tags.getRange("A1:D1"));
tags.freezePanes.freezeRows(1);
setWidths(tags, [120, 340, 160, 340]);
tags.getRange("A2:D11").format.wrapText = true;

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath);
