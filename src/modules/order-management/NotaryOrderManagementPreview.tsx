import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getOrderById, updateOrder } from '../../services/mockDataService';
import {
  getLatestNotaryOfficeOrderByManagementOrderId,
  syncNotaryManagementShipment,
} from '../../services/notaryOfficeOrderService';
import { useTranslation } from '../../shared/i18n/config';
import { getCurrentAuthAccountId } from '../../shared/utils/auth';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import {
  buildNotaryPowerOfAttorneyFileName,
  buildNotaryTemplatePdfFileName,
  downloadNotaryAsset,
  exportNotaryImagesToPdf,
} from '../../shared/utils/notaryPreviewExport';
import { saveNotaryCertificateImages } from '../../shared/utils/localImageStore';
import {
  buildNotaryPowerOfAttorneyExportOptions,
  type NotaryPowerOfAttorneyExportOption,
  type NotaryPowerOfAttorneyKey,
} from '../../shared/config/notaryPowerOfAttorney';
import { getProductProcessTypeLabel } from '../../shared/utils/productProcessType';
import { orderPreviewAssets } from '../../shared/config/orderPreviewAssets';
import { LICENSE_ISSUING_AUTHORITY_OPTIONS } from '../../shared/config/licenseIssuingAuthority';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import ResolvedImage from '../../shared/components/ResolvedImage';
import type { Order, OrderLog, OrderStatus } from '../../shared/types';
import './OrderDetail.css';

type CertificateImage = {
  key: string;
  label: string;
  src: string | null;
};

type OrderEditForm = {
  licenseNo: string;
  licenseName: string;
  surnamePinyin: string;
  givenNamePinyin: string;
  gender: string;
  nationality: string;
  birthDate: string;
  licenseCategory: string;
  licenseAddress: string;
  archiveNumber: string;
  barcodeNumber: string;
  firstIssueDate: string;
  validFromDate: string;
  validUntilDate: string;
  validYears: string;
  issuingAuthority: string;
  issuingProvince: string;
  issuingCity: string;
  issuingRegion: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
};

type LogisticsForm = {
  logisticsCompany: string;
  trackingNumber: string;
};

type AuditFieldItem = {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  fieldClassName?: string;
  labelClassName?: string;
};

const PREVIEW_BASE = '/Preview%20file/yulan';
const buildPreviewAssetPath = (fileName: string) => `${PREVIEW_BASE}/${encodeURIComponent(fileName)}`;
const POWER_OF_ATTORNEY_PATH = buildPreviewAssetPath('Power of Attorney.docx');
const POWER_OF_ATTORNEY_EXPORT_OPTIONS = buildNotaryPowerOfAttorneyExportOptions(POWER_OF_ATTORNEY_PATH);
const ORDER_MANAGEMENT_PENDING_REVIEW_PATH = '/order-management/notary-orders?status=pending_review';
const LOGISTICS_COMPANY_OPTIONS = ['顺丰速运', '京东物流', '邮政EMS', '圆通速递', '中通快递', '申通快递'];
const LICENSE_VALIDITY_YEAR_OPTIONS = ['6年', '10年', '60年', '长期', '自定义'];
const PROVINCE_CITY_OPTIONS: Array<{ province: string; cities: string[] }> = [
  { province: '北京市', cities: ['北京市'] },
  { province: '天津市', cities: ['天津市'] },
  { province: '河北省', cities: ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市', '保定市', '张家口市', '承德市', '沧州市', '廊坊市', '衡水市'] },
  { province: '山西省', cities: ['太原市', '大同市', '阳泉市', '长治市', '晋城市', '朔州市', '晋中市', '运城市', '忻州市', '临汾市', '吕梁市'] },
  { province: '内蒙古自治区', cities: ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '兴安盟', '锡林郭勒盟', '阿拉善盟'] },
  { province: '辽宁省', cities: ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '丹东市', '锦州市', '营口市', '阜新市', '辽阳市', '盘锦市', '铁岭市', '朝阳市', '葫芦岛市'] },
  { province: '吉林省', cities: ['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边朝鲜族自治州'] },
  { province: '黑龙江省', cities: ['哈尔滨市', '齐齐哈尔市', '鸡西市', '鹤岗市', '双鸭山市', '大庆市', '伊春市', '佳木斯市', '七台河市', '牡丹江市', '黑河市', '绥化市', '大兴安岭地区'] },
  { province: '上海市', cities: ['上海市'] },
  { province: '江苏省', cities: ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市'] },
  { province: '浙江省', cities: ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'] },
  { province: '安徽省', cities: ['合肥市', '芜湖市', '蚌埠市', '淮南市', '马鞍山市', '淮北市', '铜陵市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '六安市', '亳州市', '池州市', '宣城市'] },
  { province: '福建省', cities: ['福州市', '厦门市', '莆田市', '三明市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市'] },
  { province: '江西省', cities: ['南昌市', '景德镇市', '萍乡市', '九江市', '新余市', '鹰潭市', '赣州市', '吉安市', '宜春市', '抚州市', '上饶市'] },
  { province: '山东省', cities: ['济南市', '青岛市', '淄博市', '枣庄市', '东营市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '日照市', '临沂市', '德州市', '聊城市', '滨州市', '菏泽市'] },
  { province: '河南省', cities: ['郑州市', '开封市', '洛阳市', '平顶山市', '安阳市', '鹤壁市', '新乡市', '焦作市', '濮阳市', '许昌市', '漯河市', '三门峡市', '南阳市', '商丘市', '信阳市', '周口市', '驻马店市', '济源市'] },
  { province: '湖北省', cities: ['武汉市', '黄石市', '十堰市', '宜昌市', '襄阳市', '鄂州市', '荆门市', '孝感市', '荆州市', '黄冈市', '咸宁市', '随州市', '恩施土家族苗族自治州', '仙桃市', '潜江市', '天门市', '神农架林区'] },
  { province: '湖南省', cities: ['长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市', '岳阳市', '常德市', '张家界市', '益阳市', '郴州市', '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州'] },
  { province: '广东省', cities: ['广州市', '韶关市', '深圳市', '珠海市', '汕头市', '佛山市', '江门市', '湛江市', '茂名市', '肇庆市', '惠州市', '梅州市', '汕尾市', '河源市', '阳江市', '清远市', '东莞市', '中山市', '潮州市', '揭阳市', '云浮市'] },
  { province: '广西壮族自治区', cities: ['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市', '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市', '来宾市', '崇左市'] },
  { province: '海南省', cities: ['海口市', '三亚市', '三沙市', '儋州市', '五指山市', '琼海市', '文昌市', '万宁市', '东方市'] },
  { province: '重庆市', cities: ['重庆市'] },
  { province: '四川省', cities: ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州'] },
  { province: '贵州省', cities: ['贵阳市', '六盘水市', '遵义市', '安顺市', '毕节市', '铜仁市', '黔西南布依族苗族自治州', '黔东南苗族侗族自治州', '黔南布依族苗族自治州'] },
  { province: '云南省', cities: ['昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州'] },
  { province: '西藏自治区', cities: ['拉萨市', '日喀则市', '昌都市', '林芝市', '山南市', '那曲市', '阿里地区'] },
  { province: '陕西省', cities: ['西安市', '铜川市', '宝鸡市', '咸阳市', '渭南市', '延安市', '汉中市', '榆林市', '安康市', '商洛市'] },
  { province: '甘肃省', cities: ['兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市', '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'] },
  { province: '青海省', cities: ['西宁市', '海东市', '海北藏族自治州', '黄南藏族自治州', '海南藏族自治州', '果洛藏族自治州', '玉树藏族自治州', '海西蒙古族藏族自治州'] },
  { province: '宁夏回族自治区', cities: ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'] },
  { province: '新疆维吾尔自治区', cities: ['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市', '昌吉回族自治州', '博尔塔拉蒙古自治州', '巴音郭楞蒙古自治州', '阿克苏地区', '克孜勒苏柯尔克孜自治州', '喀什地区', '和田地区', '伊犁哈萨克自治州', '塔城地区', '阿勒泰地区', '石河子市', '阿拉尔市', '图木舒克市', '五家渠市', '北屯市', '铁门关市', '双河市', '可克达拉市', '昆玉市', '胡杨河市', '新星市', '白杨市'] },
  { province: '香港特别行政区', cities: ['香港特别行政区'] },
  { province: '澳门特别行政区', cities: ['澳门特别行政区'] },
  { province: '台湾省', cities: ['台北市', '新北市', '桃园市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '嘉义市'] },
] as const;

const CERTIFICATE_IMAGES: CertificateImage[] = [
  {
    key: 'license-front',
    label: '驾照正面',
    src: orderPreviewAssets.licenseFront,
  },
  {
    key: 'license-back',
    label: '驾照反面',
    src: orderPreviewAssets.licenseBack,
  },
  {
    key: 'extra-front',
    label: '副页正面',
    src: orderPreviewAssets.extraFront,
  },
  {
    key: 'extra-back',
    label: '副页反面',
    src: orderPreviewAssets.extraBack,
  },
];

const ADDITIONAL_CERTIFICATE_IMAGES: CertificateImage[] = [
  {
    key: 'identity-front',
    label: '身份证正面',
    src: orderPreviewAssets.identityFront,
  },
  {
    key: 'identity-back',
    label: '身份证反面',
    src: orderPreviewAssets.identityBack,
  },
  {
    key: 'passport-front',
    label: '护照首页',
    src: null,
  },
  {
    key: 'passport-visa',
    label: '护照签证页',
    src: null,
  },
  {
    key: 'flight-itinerary',
    label: '行程单',
    src: null,
  },
  {
    key: 'digital-license',
    label: '电子驾照',
    src: orderPreviewAssets.digitalLicense,
  },
  {
    key: 'signature',
    label: '签名',
    src: orderPreviewAssets.signature,
  },
];

const PREVIEW_IMAGES = [...CERTIFICATE_IMAGES, ...ADDITIONAL_CERTIFICATE_IMAGES];
const EXTERNAL_NOTARY_SOURCE_EMAIL_PREFIX = 'external-notary-order-';
const EXTERNAL_NOTARY_SOURCE_EMAIL_DOMAIN = 'meika.local';

const isExternalNotarySourceOrder = (order: Pick<Order, 'customerEmail' | 'logs'>) =>
  (order.customerEmail.startsWith(EXTERNAL_NOTARY_SOURCE_EMAIL_PREFIX) &&
    order.customerEmail.endsWith(`@${EXTERNAL_NOTARY_SOURCE_EMAIL_DOMAIN}`)) ||
  order.logs.some((log) => /代理端录入外采公证订单|外采订单 .* 已同步至公证订单管理/.test(log.action));

const getExternalPreviewImages = (order: Order) =>
  (order.notarySubmissionImages || []).reduce<Record<string, string>>((result, image) => {
    if (image.key && image.src) {
      result[image.key] = image.src;
    }
    return result;
  }, {});

const getMergedLocationKeys = <T extends string>(sourceOptions: readonly T[], currentValue: string) =>
  currentValue && !sourceOptions.includes(currentValue as T) ? [currentValue, ...sourceOptions] : [...sourceOptions];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  translating: '翻译中',
  pending_review: '待审核',
  pending_production: '待制作',
  in_production: '制作中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒绝',
};

const NOTARY_OFFICE_SUBMISSION_PATTERN = /送审至|公证处已接收/;
const NOTARY_OFFICE_REJECTION_PATTERN = /公证处审核驳回|公证处.*驳回/;

const NAME_PINYIN_MAP: Record<string, string> = {
  艾: 'AI',
  安: 'AN',
  敖: 'AO',
  白: 'BAI',
  柏: 'BAI',
  包: 'BAO',
  宝: 'BAO',
  贝: 'BEI',
  毕: 'BI',
  卞: 'BIAN',
  蔡: 'CAI',
  曹: 'CAO',
  岑: 'CEN',
  曾: 'ZENG',
  常: 'CHANG',
  车: 'CHE',
  成: 'CHENG',
  张: 'ZHANG',
  伟: 'WEI',
  王: 'WANG',
  芳: 'FANG',
  李: 'LI',
  明: 'MING',
  赵: 'ZHAO',
  丽: 'LI',
  孙: 'SUN',
  强: 'QIANG',
  周: 'ZHOU',
  杰: 'JIE',
  吴: 'WU',
  秀: 'XIU',
  英: 'YING',
  郑: 'ZHENG',
  敏: 'MIN',
  陈: 'CHEN',
  浩: 'HAO',
  钱: 'QIAN',
  亮: 'LIANG',
  刘: 'LIU',
  洋: 'YANG',
  杨: 'YANG',
  黄: 'HUANG',
  磊: 'LEI',
  何: 'HE',
  欣: 'XIN',
  马: 'MA',
  朱: 'ZHU',
  俊: 'JUN',
  林: 'LIN',
  静: 'JING',
  徐: 'XU',
  峰: 'FENG',
  高: 'GAO',
  蕾: 'LEI',
  谢: 'XIE',
  宇: 'YU',
  韩: 'HAN',
  雪: 'XUE',
  丁: 'DING',
  邓: 'DENG',
  董: 'DONG',
  杜: 'DU',
  段: 'DUAN',
  范: 'FAN',
  方: 'FANG',
  冯: 'FENG',
  付: 'FU',
  傅: 'FU',
  龚: 'GONG',
  顾: 'GU',
  郭: 'GUO',
  胡: 'HU',
  华: 'HUA',
  蒋: 'JIANG',
  姜: 'JIANG',
  江: 'JIANG',
  金: 'JIN',
  赖: 'LAI',
  梁: 'LIANG',
  廖: 'LIAO',
  罗: 'LUO',
  陆: 'LU',
  吕: 'LYU',
  卢: 'LU',
  莫: 'MO',
  潘: 'PAN',
  彭: 'PENG',
  邱: 'QIU',
  秦: 'QIN',
  任: 'REN',
  沈: 'SHEN',
  史: 'SHI',
  宋: 'SONG',
  苏: 'SU',
  唐: 'TANG',
  田: 'TIAN',
  汪: 'WANG',
  魏: 'WEI',
  许: 'XU',
  肖: 'XIAO',
  薛: 'XUE',
  叶: 'YE',
  殷: 'YIN',
  余: 'YU',
  袁: 'YUAN',
  于: 'YU',
  钟: 'ZHONG',
  邹: 'ZOU',
  祝: 'ZHU',
  俞: 'YU',
  姚: 'YAO',
  夏: 'XIA',
  知: 'ZHI',
  书: 'SHU',
  禾: 'HE',
  景: 'JING',
  川: 'CHUAN',
  宁: 'NING',
  若: 'RUO',
  岚: 'LAN',
  清: 'QING',
  和: 'HE',
  星: 'XING',
  野: 'YE',
  慕: 'MU',
  晴: 'QING',
  望: 'WANG',
  舒: 'SHU',
  砚: 'YAN',
  秋: 'QIU',
  子: 'ZI',
  梓: 'ZI',
  涵: 'HAN',
  晨: 'CHEN',
  辰: 'CHEN',
  轩: 'XUAN',
  萱: 'XUAN',
  怡: 'YI',
  依: 'YI',
  嘉: 'JIA',
  家: 'JIA',
  涛: 'TAO',
  鹏: 'PENG',
  超: 'CHAO',
  斌: 'BIN',
  波: 'BO',
  勇: 'YONG',
  军: 'JUN',
  平: 'PING',
  玲: 'LING',
  娜: 'NA',
  丹: 'DAN',
  莉: 'LI',
  婷: 'TING',
  倩: 'QIAN',
  慧: 'HUI',
  燕: 'YAN',
  洁: 'JIE',
  文: 'WEN',
  博: 'BO',
  泽: 'ZE',
  瑞: 'RUI',
  昊: 'HAO',
  睿: 'RUI',
  诚: 'CHENG',
  皓: 'HAO',
  诗: 'SHI',
  雨: 'YU',
  语: 'YU',
  心: 'XIN',
  可: 'KE',
  乐: 'LE',
  亦: 'YI',
  思: 'SI',
  妍: 'YAN',
  彤: 'TONG',
  琪: 'QI',
  琳: 'LIN',
  瑶: 'YAO',
  雅: 'YA',
  馨: 'XIN',
};

const COMPOUND_CHINESE_SURNAMES = [
  '欧阳',
  '太史',
  '端木',
  '上官',
  '司马',
  '东方',
  '独孤',
  '南宫',
  '万俟',
  '闻人',
  '夏侯',
  '诸葛',
  '尉迟',
  '公羊',
  '赫连',
  '澹台',
  '皇甫',
  '宗政',
  '濮阳',
  '公冶',
  '太叔',
  '申屠',
  '公孙',
  '慕容',
  '仲孙',
  '钟离',
  '长孙',
  '宇文',
  '司徒',
  '鲜于',
  '司空',
  '闾丘',
  '子车',
  '亓官',
  '司寇',
  '巫马',
  '公西',
  '颛孙',
  '壤驷',
  '公良',
  '漆雕',
  '乐正',
  '宰父',
  '谷梁',
  '拓跋',
  '夹谷',
  '轩辕',
  '令狐',
  '段干',
  '百里',
  '呼延',
  '东郭',
  '南门',
  '羊舌',
  '微生',
  '公户',
  '公玉',
  '公仪',
  '梁丘',
  '公仲',
  '公上',
  '公门',
  '公山',
  '公坚',
  '左丘',
  '公伯',
  '西门',
  '公祖',
  '第五',
  '公乘',
  '贯丘',
  '公皙',
  '南荣',
  '东里',
  '东宫',
  '仲长',
  '子书',
  '子桑',
  '即墨',
  '达奚',
  '褚师',
];

const SURNAME_PINYIN_MAP: Record<string, string> = {
  ...NAME_PINYIN_MAP,
  殷: 'YIN',
  单: 'SHAN',
  仇: 'QIU',
  区: 'OU',
  查: 'ZHA',
  盖: 'GE',
  乐: 'YUE',
  繁: 'PO',
  朴: 'PIAO',
  尉: 'YU',
  令: 'LING',
  长: 'ZHANG',
  欧阳: 'OUYANG',
  太史: 'TAISHI',
  端木: 'DUANMU',
  上官: 'SHANGGUAN',
  司马: 'SIMA',
  东方: 'DONGFANG',
  独孤: 'DUGU',
  南宫: 'NANGONG',
  夏侯: 'XIAHOU',
  诸葛: 'ZHUGE',
  尉迟: 'YUCHI',
  皇甫: 'HUANGFU',
  公孙: 'GONGSUN',
  慕容: 'MURONG',
  钟离: 'ZHONGLI',
  长孙: 'ZHANGSUN',
  宇文: 'YUWEN',
  司徒: 'SITU',
  司空: 'SIKONG',
  令狐: 'LINGHU',
  轩辕: 'XUANYUAN',
  呼延: 'HUYAN',
  西门: 'XIMEN',
  第五: 'DIWU',
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getCurrentTimestamp = () => formatBeijingTimestamp();

const padNumber = (value: number) => String(value).padStart(2, '0');

const getOrderSeed = (orderId: string) => Number(orderId.replace(/\D/g, '').slice(-6) || '0');

const createDateFromSeed = (seed: number, baseYear: number, yearSpan: number) => {
  const year = baseYear + (seed % yearSpan);
  const month = (seed % 12) + 1;
  const day = (Math.floor(seed / 7) % 28) + 1;
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
};

const addYearsToDate = (dateString: string, years: number) => {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) {
    return '--';
  }

  return `${year + years}-${padNumber(month)}-${padNumber(day)}`;
};

const calculateLicenseValidUntilDate = (validFromDate: string, validYears: string, customValidUntilDate = '') => {
  const normalizedValidYears = validYears.trim();

  if (normalizedValidYears === '自定义') {
    return customValidUntilDate.trim();
  }

  if (normalizedValidYears === '长期') {
    return '';
  }

  const years = Number(normalizedValidYears.replace(/\D/g, ''));

  if (!validFromDate.trim() || !Number.isFinite(years) || years <= 0) {
    return '';
  }

  const calculatedDate = addYearsToDate(validFromDate.trim(), years);
  return calculatedDate === '--' ? '' : calculatedDate;
};

const getDisplayValue = (value?: string | null) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : '--';
};

const resolvePersistedValue = (value: string | undefined | null, fallback: string) =>
  value === undefined || value === null ? fallback : value;

const toEditableValue = (value: string | undefined | null, fallback = '') => {
  const resolvedValue = value === undefined || value === null ? fallback : value;
  return resolvedValue === '--' ? '' : resolvedValue;
};

const getNotaryReviewStatusClass = (status: OrderStatus) => `notary-review-status notary-review-status--${status}`;

const getLatestAuditLog = (logs: OrderLog[]) =>
  [...logs].reverse().find((log) => /审核通过|审核拒绝|审核驳回/.test(log.action));

const findLatestOrderLog = <T extends Order['logs'][number]>(logs: T[], pattern: RegExp) =>
  [...logs].reverse().find((log) => pattern.test(log.action));

const isLogAtOrAfter = (leftTime: string | undefined, rightTime: string | undefined) => {
  const normalizedLeftTime = leftTime?.trim() || '';
  const normalizedRightTime = rightTime?.trim() || '';

  if (!normalizedLeftTime || !normalizedRightTime) {
    return Boolean(normalizedLeftTime);
  }

  return normalizedLeftTime >= normalizedRightTime;
};

const isNotaryOfficeRejected = (order: Order, officeOrder: Order | null) =>
  (() => {
    if (order.status === 'cancelled') {
      return false;
    }

    const combinedLogs = [...order.logs, ...(officeOrder?.logs || [])];
    const submissionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_SUBMISSION_PATTERN);
    const rejectionLog = findLatestOrderLog(combinedLogs, NOTARY_OFFICE_REJECTION_PATTERN);
    const hasOfficeOrderRejection = Boolean(
      submissionLog &&
        officeOrder?.status === 'rejected' &&
        isLogAtOrAfter(officeOrder.updatedAt, submissionLog.time),
    );

    return Boolean(
      (rejectionLog && isLogAtOrAfter(rejectionLog.time, submissionLog?.time)) ||
        hasOfficeOrderRejection,
    );
  })();

const getDisplayOrderStatusLabel = (order: Order, officeOrder: Order | null) =>
  order.status === 'cancelled'
    ? ORDER_STATUS_LABELS.cancelled
    : isNotaryOfficeRejected(order, officeOrder)
      ? '公证处已驳回'
      : ORDER_STATUS_LABELS[order.status];

const getDisplayOrderStatusClass = (order: Order, officeOrder: Order | null) =>
  getNotaryReviewStatusClass(order.status === 'cancelled' ? 'cancelled' : isNotaryOfficeRejected(order, officeOrder) ? 'rejected' : order.status);

const getAuditTime = (order: Order, latestAuditLog: OrderLog | null | undefined) => {
  const auditTime = latestAuditLog?.time?.trim();
  if (auditTime) {
    return auditTime;
  }

  if (order.status !== 'pending_review') {
    return getDisplayValue(order.updatedAt);
  }

  return '--';
};

const getAuditOperatorId = (order: Order, latestAuditLog: OrderLog | null | undefined, currentAccountId: string) => {
  if (!latestAuditLog && order.status === 'pending_review') {
    return '--';
  }

  return currentAccountId || '--';
};

const getNamePinyinParts = (name: string) => {
  const normalizedName = name.replace(/[\s·.。-]/g, '').trim();
  if (!normalizedName || !/^[\u4e00-\u9fff]+$/u.test(normalizedName)) {
    return {
      surnamePinyin: '--',
      givenNamePinyin: '--',
    };
  }

  const toPinyin = (value: string) => {
    const tokens = Array.from(value).map((char) => NAME_PINYIN_MAP[char] || '');
    return tokens.every(Boolean) ? tokens.join('') : '--';
  };
  const compoundSurname = COMPOUND_CHINESE_SURNAMES.find((surname) => normalizedName.startsWith(surname));
  const surnameLength = compoundSurname ? compoundSurname.length : 1;
  const surname = normalizedName.slice(0, surnameLength);
  const givenName = normalizedName.slice(surnameLength);
  const surnamePinyin = SURNAME_PINYIN_MAP[surname] || toPinyin(surname);

  return {
    surnamePinyin,
    givenNamePinyin: givenName ? toPinyin(givenName) : '--',
  };
};

const extractIssuingRegion = (address: string) => {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return '--';
  }

  const provinceMatch = normalizedAddress.match(/^(.{2,8}?(?:省|市|自治区|特别行政区))/);
  const province = provinceMatch?.[1] || '';
  const cityMatch = normalizedAddress.replace(province, '').match(/^(.{1,8}?(?:市|州|区|县))/);
  const city = cityMatch?.[1] || '';

  return [province, city].filter(Boolean).join(' ') || normalizedAddress.slice(0, 12);
};

const splitIssuingRegion = (issuingRegion: string) => {
  const normalizedRegion = issuingRegion.trim();
  if (!normalizedRegion) {
    return { issuingProvince: '', issuingCity: '' };
  }

  for (const option of PROVINCE_CITY_OPTIONS) {
    if (!normalizedRegion.includes(option.province)) {
      continue;
    }

    const matchedCity = option.cities.find((city) => normalizedRegion.includes(city));
    return {
      issuingProvince: option.province,
      issuingCity: matchedCity || '',
    };
  }

  const [issuingProvince = '', issuingCity = ''] = normalizedRegion.split(/\s+/);
  return { issuingProvince, issuingCity };
};

const buildArchiveNumber = (licenseNo: string, orderId: string) => {
  const licenseDigits = licenseNo.replace(/\D/g, '');
  const orderDigits = orderId.replace(/\D/g, '');
  const prefix = (licenseDigits.slice(0, 6) || '350402').padEnd(6, '0');
  const suffix = (orderDigits.slice(-6) || '623863').padStart(6, '0');
  return `${prefix}${suffix}`;
};

const buildBarcodeNumber = (licenseNo: string, orderId: string) => {
  const licenseDigits = licenseNo.replace(/\D/g, '');
  const orderDigits = orderId.replace(/\D/g, '');
  const prefix = (licenseDigits.slice(0, 4) || '3590').padEnd(4, '0');
  const suffix = (orderDigits.slice(-9) || '020964663').padStart(9, '0');
  return `${prefix}${suffix}`;
};

const buildLicenseAuditProfile = (order: Order) => {
  const seed = getOrderSeed(order.orderId);
  const isExternalSourceOrder = isExternalNotarySourceOrder(order);
  const licenseNameSource = resolvePersistedValue(order.licenseName, order.customerName);
  const licenseNoSource = resolvePersistedValue(order.licenseNo, order.customerPassport);
  const licenseCategorySource = resolvePersistedValue(order.licenseCategory, isExternalSourceOrder ? '' : 'C1');
  const birthDateSource = resolvePersistedValue(order.licenseBirthDate, isExternalSourceOrder ? '' : createDateFromSeed(seed + 73, 1984, 12));
  const licenseAddressSource = resolvePersistedValue(order.licenseAddress, order.deliveryAddress || '');
  const firstIssueDateSource = resolvePersistedValue(order.licenseFirstIssueDate, isExternalSourceOrder ? '' : createDateFromSeed(seed + 17, 2010, 8));
  const validFromDateSource = resolvePersistedValue(order.licenseValidFromDate, isExternalSourceOrder ? '' : createDateFromSeed(seed + 41, 2021, 4));
  const validUntilDateSource = resolvePersistedValue(
    order.licenseValidUntilDate,
    isExternalSourceOrder || !validFromDateSource ? '' : addYearsToDate(validFromDateSource, 10),
  );
  const validYearsSource = resolvePersistedValue(order.licenseValidYears, isExternalSourceOrder ? '' : '10年');
  const issuingAuthoritySource = resolvePersistedValue(
    order.licenseIssuingAuthority,
    isExternalSourceOrder ? '' : LICENSE_ISSUING_AUTHORITY_OPTIONS[0],
  );
  const issuingRegionSource = resolvePersistedValue(order.licenseIssuingRegion, extractIssuingRegion(licenseAddressSource));
  const issuingRegion = getDisplayValue(issuingRegionSource);
  const issuingRegionParts = splitIssuingRegion(issuingRegion === '--' ? '' : issuingRegion);
  const genderSource = resolvePersistedValue(order.licenseGender, isExternalSourceOrder ? '' : seed % 4 === 0 ? '女' : '男');
  const nationalitySource = resolvePersistedValue(order.licenseNationality, isExternalSourceOrder ? '' : '中国/CHN');
  const licenseName = getDisplayValue(licenseNameSource);
  const licenseNo = getDisplayValue(licenseNoSource);
  const licenseCategory = getDisplayValue(licenseCategorySource);
  const archiveNumberSource = resolvePersistedValue(
    order.licenseArchiveNumber,
    isExternalSourceOrder ? '' : buildArchiveNumber(licenseNo === '--' ? '' : licenseNo, order.orderId),
  );
  const barcodeNumberSource = resolvePersistedValue(
    order.licenseBarcodeNumber,
    isExternalSourceOrder ? '' : buildBarcodeNumber(licenseNo === '--' ? '' : licenseNo, order.orderId),
  );
  const autoPinyinParts = getNamePinyinParts(licenseName === '--' ? '' : licenseName);
  const surnamePinyin = getDisplayValue(resolvePersistedValue(order.idpSurnameEn, autoPinyinParts.surnamePinyin));
  const givenNamePinyin = getDisplayValue(resolvePersistedValue(order.idpGivenNameEn, autoPinyinParts.givenNamePinyin));

  return {
    licenseNo,
    licenseName,
    surnamePinyin,
    givenNamePinyin,
    gender: getDisplayValue(genderSource),
    nationality: getDisplayValue(nationalitySource),
    birthDate: getDisplayValue(birthDateSource),
    vehicleCategory: licenseCategory,
    licenseAddress: getDisplayValue(licenseAddressSource),
    archiveNumber: getDisplayValue(archiveNumberSource),
    barcodeNumber: getDisplayValue(barcodeNumberSource),
    firstIssueDate: getDisplayValue(firstIssueDateSource),
    validFromDate: getDisplayValue(validFromDateSource),
    validUntilDate: getDisplayValue(validUntilDateSource),
    validYears: getDisplayValue(validYearsSource),
    issuingAuthority: getDisplayValue(issuingAuthoritySource),
    issuingProvince: getDisplayValue(issuingRegionParts.issuingProvince),
    issuingCity: getDisplayValue(issuingRegionParts.issuingCity),
    issuingRegion,
  };
};

const buildOrderEditForm = (order: Order): OrderEditForm => {
  const auditProfile = buildLicenseAuditProfile(order);
  const issuingRegionParts = splitIssuingRegion(auditProfile.issuingRegion === '--' ? '' : auditProfile.issuingRegion);

  return {
    licenseNo: toEditableValue(order.licenseNo, auditProfile.licenseNo),
    licenseName: toEditableValue(order.licenseName, auditProfile.licenseName),
    surnamePinyin: toEditableValue(order.idpSurnameEn, auditProfile.surnamePinyin),
    givenNamePinyin: toEditableValue(order.idpGivenNameEn, auditProfile.givenNamePinyin),
    gender: toEditableValue(order.licenseGender, auditProfile.gender),
    nationality: toEditableValue(order.licenseNationality, auditProfile.nationality),
    birthDate: toEditableValue(order.licenseBirthDate, auditProfile.birthDate),
    licenseCategory: toEditableValue(order.licenseCategory, auditProfile.vehicleCategory),
    licenseAddress: toEditableValue(order.licenseAddress, auditProfile.licenseAddress),
    archiveNumber: toEditableValue(order.licenseArchiveNumber, auditProfile.archiveNumber),
    barcodeNumber: toEditableValue(order.licenseBarcodeNumber, auditProfile.barcodeNumber),
    firstIssueDate: toEditableValue(order.licenseFirstIssueDate, auditProfile.firstIssueDate),
    validFromDate: toEditableValue(order.licenseValidFromDate, auditProfile.validFromDate),
    validUntilDate: toEditableValue(order.licenseValidUntilDate, auditProfile.validUntilDate),
    validYears: toEditableValue(order.licenseValidYears, auditProfile.validYears),
    issuingAuthority: toEditableValue(order.licenseIssuingAuthority, auditProfile.issuingAuthority),
    issuingProvince: toEditableValue(issuingRegionParts.issuingProvince),
    issuingCity: toEditableValue(issuingRegionParts.issuingCity),
    issuingRegion: toEditableValue(order.licenseIssuingRegion, auditProfile.issuingRegion),
    customerName: toEditableValue(order.customerName),
    customerPhone: toEditableValue(order.customerPhone),
    deliveryAddress: toEditableValue(order.deliveryAddress),
  };
};

const buildLogisticsForm = (order: Order): LogisticsForm => ({
  logisticsCompany: order.logisticsCompany?.trim() || '',
  trackingNumber: order.trackingNumber.trim(),
});

const NotaryOrderManagementPreview: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const previewMode = new URLSearchParams(location.search).get('mode') === 'audit' ? 'audit' : 'view';
  const fetchedOrder = useMemo<Order | null>(() => getOrderById(id || '') ?? null, [id]);
  const backPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from || ORDER_MANAGEMENT_PENDING_REVIEW_PATH)
      : '/order-management/notary-orders';

  const [order, setOrder] = useState<Order | null>(fetchedOrder);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedNotaryOffice, setSelectedNotaryOffice] = useState('');
  const [previewImage, setPreviewImage] = useState<CertificateImage | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [certificateImages, setCertificateImages] = useState<Record<string, string>>(
    fetchedOrder ? { ...getExternalPreviewImages(fetchedOrder), ...(fetchedOrder.notaryCertificateImages || {}) } : {},
  );
  const [exportingPowerOfAttorneyKey, setExportingPowerOfAttorneyKey] = useState<NotaryPowerOfAttorneyKey | null>(null);
  const [isExportingImagesPdf, setIsExportingImagesPdf] = useState(false);
  const [editForm, setEditForm] = useState<OrderEditForm | null>(fetchedOrder ? buildOrderEditForm(fetchedOrder) : null);
  const [logisticsForm, setLogisticsForm] = useState<LogisticsForm>(
    fetchedOrder ? buildLogisticsForm(fetchedOrder) : { logisticsCompany: '', trackingNumber: '' },
  );

  useEffect(() => {
    setOrder(fetchedOrder);
    setIsEditing(false);
    setEditForm(fetchedOrder ? buildOrderEditForm(fetchedOrder) : null);
    setLogisticsForm(fetchedOrder ? buildLogisticsForm(fetchedOrder) : { logisticsCompany: '', trackingNumber: '' });
    setShowRejectModal(false);
    setShowApproveModal(false);
    setSelectedNotaryOffice('');
    setPreviewImage(null);
    setCertificateImages(fetchedOrder ? { ...getExternalPreviewImages(fetchedOrder), ...(fetchedOrder.notaryCertificateImages || {}) } : {});
    setRejectReason('');
    setExportingPowerOfAttorneyKey(null);
    setIsExportingImagesPdf(false);
  }, [fetchedOrder]);

  const latestAuditLog = useMemo(() => (order ? getLatestAuditLog(order.logs) : null), [order]);
  const auditProfile = useMemo(() => (order ? buildLicenseAuditProfile(order) : null), [order]);
  const pinyinPreview = useMemo(
    () => ({
      surnamePinyin: getDisplayValue(editForm?.surnamePinyin),
      givenNamePinyin: getDisplayValue(editForm?.givenNamePinyin),
    }),
    [editForm?.givenNamePinyin, editForm?.surnamePinyin],
  );
  const currentAccountId = useMemo(() => getCurrentAuthAccountId(), []);
  const officeOrder = useMemo(
    () => (order ? getLatestNotaryOfficeOrderByManagementOrderId(order.orderId) || null : null),
    [order?.orderId, order?.status, order?.updatedAt],
  );
  const logisticsDisplayCompany = order?.logisticsCompany?.trim() || officeOrder?.logisticsCompany?.trim() || '';
  const logisticsDisplayTrackingNumber = order?.trackingNumber?.trim() || officeOrder?.trackingNumber?.trim() || '';
  const isExternalSourceOrder = order ? isExternalNotarySourceOrder(order) : false;
  const isOfficeRejectedOrder = order ? isNotaryOfficeRejected(order, officeOrder) : false;
  const isAuditable = order?.status === 'pending_review' && previewMode === 'audit';
  const canModifyOrder =
    previewMode === 'audit' && (order?.status === 'pending_review' || order?.status === 'rejected' || isOfficeRejectedOrder);
  const isReadOnlyPreview = !canModifyOrder;
  const pageTitle =
    previewMode === 'audit'
      ? order?.status === 'rejected' || isOfficeRejectedOrder
        ? '订单修改'
        : isAuditable
          ? '订单审核'
          : '查看审核'
      : '查看订单';
  const isViewMode = previewMode === 'view';
  const isPendingReviewOrder = order?.status === 'pending_review';
  const canSubmitLogistics = order?.status === 'pending_production';
  const shouldRenderLogisticsSection =
    isPendingReviewOrder ||
    canSubmitLogistics ||
    order?.status === 'shipped' ||
    order?.status === 'completed' ||
    Boolean(logisticsDisplayCompany || logisticsDisplayTrackingNumber);
  const logisticsSubmitDisabled =
    !canSubmitLogistics || !logisticsForm.logisticsCompany.trim() || !logisticsForm.trackingNumber.trim();
  const shouldStartInEditMode = previewMode === 'audit' && Boolean(order?.status === 'rejected' || isOfficeRejectedOrder);
  const exportPdfFileName = useMemo(
    () => buildNotaryTemplatePdfFileName(order?.licenseName || order?.customerName || order?.orderId || ''),
    [order?.customerName, order?.licenseName, order?.orderId],
  );
  const powerOfAttorneyExportBaseName = useMemo(
    () => order?.licenseName || order?.customerName || order?.orderId || '',
    [order?.customerName, order?.licenseName, order?.orderId],
  );

  useEffect(() => {
    if (!order || !shouldStartInEditMode) {
      return;
    }

    setEditForm(buildOrderEditForm(order));
    setCertificateImages({ ...getExternalPreviewImages(order), ...(order.notaryCertificateImages || {}) });
    setIsEditing(true);
  }, [order?.orderId, shouldStartInEditMode]);

  if (!order || !auditProfile || !editForm) {
    return (
      <div className="app-main animate-fadeIn">
        <div className="card order-audit-empty-card">
          <div className="empty-state">
            <div className="empty-state__icon">404</div>
            <div className="empty-state__text">未找到对应订单，请返回列表重新选择。</div>
            <button type="button" className="btn btn--primary" onClick={() => navigate(backPath)}>
              返回订单列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleEditFieldChange = (field: keyof OrderEditForm, value: string) => {
    setEditForm((currentForm) => {
      if (!currentForm) return currentForm;

      const nextForm = { ...currentForm, [field]: value };

      if (field === 'licenseName') {
        const currentAutoPinyin = getNamePinyinParts(currentForm.licenseName);
        const nextAutoPinyin = getNamePinyinParts(value);
        const shouldSyncSurname =
          !currentForm.surnamePinyin.trim() || currentForm.surnamePinyin.trim().toUpperCase() === currentAutoPinyin.surnamePinyin;
        const shouldSyncGivenName =
          !currentForm.givenNamePinyin.trim() || currentForm.givenNamePinyin.trim().toUpperCase() === currentAutoPinyin.givenNamePinyin;

        if (shouldSyncSurname) {
          nextForm.surnamePinyin = nextAutoPinyin.surnamePinyin === '--' ? '' : nextAutoPinyin.surnamePinyin;
        }

        if (shouldSyncGivenName) {
          nextForm.givenNamePinyin = nextAutoPinyin.givenNamePinyin === '--' ? '' : nextAutoPinyin.givenNamePinyin;
        }
      }

      if (field === 'validYears' || field === 'validFromDate') {
        nextForm.validUntilDate = calculateLicenseValidUntilDate(
          field === 'validFromDate' ? value : currentForm.validFromDate,
          field === 'validYears' ? value : currentForm.validYears,
          currentForm.validUntilDate,
        );
      }

      return nextForm;
    });
  };

  const handleIssuingProvinceChange = (province: string) => {
    const cityOptions = [...(PROVINCE_CITY_OPTIONS.find((item) => item.province === province)?.cities ?? [])];
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            issuingProvince: province,
            issuingCity: cityOptions.includes(currentForm.issuingCity) ? currentForm.issuingCity : '',
            issuingRegion: '',
          }
        : currentForm,
    );
  };

  const handleIssuingCityChange = (city: string) => {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            issuingCity: city,
            issuingRegion: '',
          }
        : currentForm,
    );
  };

  const handleLogisticsFieldChange = (field: keyof LogisticsForm, value: string) => {
    setLogisticsForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleReturn = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(backPath);
  };

  const handleExportPowerOfAttorney = async (option: NotaryPowerOfAttorneyExportOption) => {
    setExportingPowerOfAttorneyKey(option.key);

    try {
      await downloadNotaryAsset(
        option.path,
        buildNotaryPowerOfAttorneyFileName(powerOfAttorneyExportBaseName, option.exportLabel),
      );
      showToast('success', `${option.exportLabel}委托书已开始导出`);
    } catch (error) {
      console.error(error);
      showToast('error', `导出${option.exportLabel}委托书失败，请稍后重试`);
    } finally {
      setExportingPowerOfAttorneyKey(null);
    }
  };

  const handleExportImagesPdf = async () => {
    setIsExportingImagesPdf(true);
    const previewImages = PREVIEW_IMAGES.map((image) => ({
      ...image,
      src: certificateImages[image.key] || image.src,
    }));

    try {
      await exportNotaryImagesToPdf(
        previewImages.filter((image): image is CertificateImage & { src: string } => Boolean(image.src)).map((image) => ({
          label: image.label,
          src: image.src,
        })),
        exportPdfFileName,
      );
      showToast('success', '证件图片 PDF 已开始导出');
    } catch (error) {
      console.error(error);
      showToast('error', '导出图片 PDF 失败，请稍后重试');
    } finally {
      setIsExportingImagesPdf(false);
    }
  };

  const handleExportItinerary = () => {
    navigate(`/order-management/notary-orders/${encodeURIComponent(order.orderId)}/itinerary-export`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  const NOTARY_OFFICES = [
    { id: 'beibu-gulf', name: '北部湾公证处', district: '制作公证处模版' },
    { id: 'zhangjiang', name: '张江公证处', district: '制作公证处模版' },
    { id: 'dongbo', name: '东博公证处', district: '制作公证处模版' },
  ];

  const handleApprove = () => {
    setSelectedNotaryOffice(
      order.auditSelectedNotaryOfficeId ||
        order.productionDisplayNotaryOfficeId ||
        order.pushedNotaryOfficeId ||
        '',
    );
    setShowApproveModal(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedNotaryOffice) {
      showToast('error', '请选择制作公证处模版');
      return;
    }

    const currentTimestamp = getCurrentTimestamp();
    const officeName = NOTARY_OFFICES.find((o) => o.id === selectedNotaryOffice)?.name || selectedNotaryOffice;
    const nextOrder: Order = {
      ...order,
      status: 'pending_production',
      pushedNotaryOfficeId: selectedNotaryOffice,
      pushedNotaryOfficeName: officeName,
      auditSelectedNotaryOfficeId: selectedNotaryOffice,
      auditSelectedNotaryOfficeName: officeName,
      productionDisplayNotaryOfficeId: selectedNotaryOffice,
      productionDisplayNotaryOfficeName: officeName,
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: currentAccountId,
          action: `审核通过，选择制作模板：${officeName}`,
        },
      ],
    };

    updateOrder(order.orderId, nextOrder);

    setOrder(nextOrder);
    setShowApproveModal(false);
    showToast('success', `审核通过，已选择制作模板：${officeName}`);
    window.setTimeout(() => navigate('/order-management/notary-orders?status=pending_production'), 1200);
  };

  const handleReject = () => {
    const nextRejectReason = rejectReason.trim();
    if (!nextRejectReason) {
      return;
    }

    updateOrder(order.orderId, {
      status: 'rejected',
      rejectReason: nextRejectReason,
      remark: nextRejectReason,
      updatedAt: getCurrentTimestamp(),
      logs: [
        ...order.logs,
        {
          time: getCurrentTimestamp(),
          operator: currentAccountId,
          action: `审核拒绝：${nextRejectReason}`,
        },
      ],
    });

    setShowRejectModal(false);
    setRejectReason('');
    showToast('error', '订单已拒绝');
    window.setTimeout(() => navigate(ORDER_MANAGEMENT_PENDING_REVIEW_PATH), 1200);
  };

  const handleModify = () => {
    setEditForm(buildOrderEditForm(order));
    setCertificateImages({ ...getExternalPreviewImages(order), ...(order.notaryCertificateImages || {}) });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm(buildOrderEditForm(order));
    setCertificateImages({ ...getExternalPreviewImages(order), ...(order.notaryCertificateImages || {}) });
    setIsEditing(false);
  };

  const handleCertificateImageUpload = (key: string, file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('error', '请选择图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!imageDataUrl) {
        showToast('error', '图片读取失败，请重试');
        return;
      }

      setCertificateImages((currentImages) => ({
        ...currentImages,
        [key]: imageDataUrl,
      }));
    };
    reader.onerror = () => showToast('error', '图片读取失败，请重试');
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    const requiredFields: Array<{ key: keyof OrderEditForm; label: string }> = [
      { key: 'licenseNo', label: '驾照号' },
      { key: 'licenseName', label: '姓名' },
      { key: 'licenseCategory', label: '准驾车型' },
      { key: 'licenseAddress', label: '驾照地址详情' },
      { key: 'customerName', label: '收货人' },
      { key: 'customerPhone', label: '联系电话' },
      { key: 'deliveryAddress', label: '收货地址' },
    ];

    const missingField = requiredFields.find(({ key }) => !editForm[key].trim());
    if (missingField) {
      showToast('error', `请填写${missingField.label}`);
      return;
    }

    if (editForm.validYears === '自定义' && !editForm.validUntilDate.trim()) {
      showToast('error', '请选择终止日期');
      return;
    }

    const nextValidUntilDate = calculateLicenseValidUntilDate(
      editForm.validFromDate,
      editForm.validYears,
      editForm.validUntilDate,
    );
    let storedCertificateImages: Record<string, string>;

    try {
      storedCertificateImages = await saveNotaryCertificateImages(
        certificateImages,
        `notary-certificate-${order.orderId}-${Date.now()}`,
      );
    } catch {
      showToast('error', '证件图片保存失败，请稍后重试');
      return;
    }

    const nextUpdates: Partial<Order> = {
      licenseNo: editForm.licenseNo.trim(),
      licenseName: editForm.licenseName.trim(),
      idpSurnameEn: editForm.surnamePinyin.trim() || undefined,
      idpGivenNameEn: editForm.givenNamePinyin.trim() || undefined,
      licenseGender: editForm.gender.trim(),
      licenseNationality: editForm.nationality.trim(),
      licenseBirthDate: editForm.birthDate.trim(),
      licenseCategory: editForm.licenseCategory.trim(),
      licenseAddress: editForm.licenseAddress.trim(),
      licenseArchiveNumber: editForm.archiveNumber.trim(),
      licenseBarcodeNumber: editForm.barcodeNumber.trim(),
      licenseFirstIssueDate: editForm.firstIssueDate.trim(),
      licenseValidFromDate: editForm.validFromDate.trim(),
      licenseValidUntilDate: nextValidUntilDate,
      licenseValidYears: editForm.validYears.trim(),
      licenseIssuingAuthority: editForm.issuingAuthority.trim(),
      licenseIssuingRegion: [editForm.issuingProvince.trim(), editForm.issuingCity.trim()].filter(Boolean).join(' '),
      customerName: editForm.customerName.trim(),
      customerPhone: editForm.customerPhone.trim(),
      deliveryAddress: editForm.deliveryAddress.trim(),
      notaryCertificateImages: storedCertificateImages,
      updatedAt: getCurrentTimestamp(),
      logs: [
        ...order.logs,
        {
          time: getCurrentTimestamp(),
          operator: currentAccountId,
          action: '修改驾照、证件与收货信息',
        },
      ],
    };

    updateOrder(order.orderId, nextUpdates);

    const nextOrder = {
      ...order,
      ...nextUpdates,
    } as Order;

    setOrder(nextOrder);
    setEditForm(buildOrderEditForm(nextOrder));
    setCertificateImages({ ...getExternalPreviewImages(nextOrder), ...(nextOrder.notaryCertificateImages || {}) });
    setIsEditing(false);
    showToast('success', '驾照信息、证件信息和收货信息已更新');
  };

  const handleSubmitLogistics = () => {
    if (!canSubmitLogistics) {
      showToast('error', '当前订单状态不可提交物流信息');
      return;
    }

    const logisticsCompany = logisticsForm.logisticsCompany.trim();
    const trackingNumber = logisticsForm.trackingNumber.trim();

    if (!logisticsCompany || !trackingNumber) {
      showToast('error', '请完整填写物流公司和物流单号');
      return;
    }

    const currentTimestamp = getCurrentTimestamp();
    const nextOrder = syncNotaryManagementShipment(order, {
      logisticsCompany,
      trackingNumber,
      operator: currentAccountId,
      shippedAt: currentTimestamp,
    });

    setOrder(nextOrder);
    setLogisticsForm(buildLogisticsForm(nextOrder));
    showToast('success', '物流信息已提交，订单已更新为已发货');
  };

  const renderEditor = (
    field: keyof OrderEditForm,
    options: {
      type?: 'text' | 'date' | 'tel';
      multiline?: boolean;
      rows?: number;
      placeholder?: string;
      ariaLabel?: string;
    } = {},
  ) => {
    const { type = 'text', multiline = false, rows = 3, placeholder, ariaLabel } = options;
    const value = editForm[field];

    if (multiline) {
      return (
        <textarea
          className="form-textarea order-audit-field__editor order-audit-field__editor--textarea"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => handleEditFieldChange(field, event.target.value)}
        />
      );
    }

    if (type === 'date') {
      return (
        <DatePickerInput
          className="order-audit-field__editor order-audit-field__date-editor"
          ariaLabel={ariaLabel || placeholder || '日期'}
          placeholder={placeholder || '请选择日期'}
          value={value}
          onChange={(nextValue) => handleEditFieldChange(field, nextValue)}
        />
      );
    }

    return (
      <input
        type={type}
        className="form-input order-audit-field__editor"
        value={value}
        placeholder={placeholder}
        onChange={(event) => handleEditFieldChange(field, event.target.value)}
      />
    );
  };

  const renderValidYearsEditor = () => (
    <select
      className="form-select order-audit-field__editor"
      value={editForm.validYears}
      onChange={(event) => handleEditFieldChange('validYears', event.target.value)}
    >
      {LICENSE_VALIDITY_YEAR_OPTIONS.map((validityYear) => (
        <option key={validityYear} value={validityYear}>
          {validityYear}
        </option>
      ))}
    </select>
  );

  const renderIssuingAuthorityEditor = () => (
    <select
      className="form-select order-audit-field__editor"
      value={editForm.issuingAuthority}
      onChange={(event) => handleEditFieldChange('issuingAuthority', event.target.value)}
    >
      <option value="" disabled>请选择发证机构</option>
      {LICENSE_ISSUING_AUTHORITY_OPTIONS.map((authority) => (
        <option key={authority} value={authority}>
          {authority}
        </option>
      ))}
    </select>
  );

  const renderSelectEditor = (
    field: keyof OrderEditForm,
    options: string[],
    placeholder: string,
    onValueChange?: (value: string) => void,
    disabled = false,
  ) => (
    <select
      className="form-select order-audit-field__editor"
      value={editForm[field]}
      disabled={disabled}
      onChange={(event) => {
        if (disabled) {
          return;
        }

        if (onValueChange) {
          onValueChange(event.target.value);
          return;
        }

        handleEditFieldChange(field, event.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );

  const shouldShowValidUntilDate = isEditing ? editForm.validYears === '自定义' : auditProfile.validYears === '自定义';
  const issuingProvinceOptions = getMergedLocationKeys(
    PROVINCE_CITY_OPTIONS.map((item) => item.province),
    editForm.issuingProvince,
  );
  const issuingCityOptions = getMergedLocationKeys(
    [...(PROVINCE_CITY_OPTIONS.find((item) => item.province === editForm.issuingProvince)?.cities ?? [])],
    editForm.issuingCity,
  );
  const previewImages = PREVIEW_IMAGES.map((image) => ({
    ...image,
    src: certificateImages[image.key] || image.src,
  }));

  const renderValidUntilDateValue = () =>
    isEditing
      ? renderEditor('validUntilDate', { type: 'date', ariaLabel: '终止日期', placeholder: '请选择终止日期' })
      : auditProfile.validUntilDate;

  const orderInfoItems: AuditFieldItem[] = [
    {
      label: '订单状态',
      value: <span className={getDisplayOrderStatusClass(order, officeOrder)}>{getDisplayOrderStatusLabel(order, officeOrder)}</span>,
    },
    {
      label: '下单时间',
      value: getDisplayValue(order.createdAt),
    },
    {
      label: '审核时间',
      value: getAuditTime(order, latestAuditLog),
    },
    {
      label: '审核人ID',
      value: getAuditOperatorId(order, latestAuditLog, currentAccountId),
    },
    {
      label: '订单号',
      value: order.orderId,
    },
    {
      label: '驾照官推送订单号',
      value: '--',
      fieldClassName: 'notary-review-field--wide-label',
      labelClassName: 'notary-review-field__label--nowrap',
    },
  ];

  const licenseInfoItems: AuditFieldItem[] = [
    {
      label: '驾证号码',
      value: isEditing ? renderEditor('licenseNo', { placeholder: '请输入驾照号' }) : auditProfile.licenseNo,
    },
    {
      label: '姓名',
      value: isEditing ? renderEditor('licenseName', { placeholder: '请输入姓名' }) : auditProfile.licenseName,
    },
    {
      label: '姓氏拼音',
      value: isEditing ? renderEditor('surnamePinyin', { placeholder: '请输入姓氏拼音' }) : auditProfile.surnamePinyin,
    },
    {
      label: '名字拼音',
      value: isEditing ? renderEditor('givenNamePinyin', { placeholder: '请输入名字拼音' }) : auditProfile.givenNamePinyin,
    },
    { label: '性别', value: isEditing ? renderEditor('gender', { placeholder: '请输入性别' }) : auditProfile.gender },
    {
      label: '国籍',
      value: isEditing ? renderEditor('nationality', { placeholder: '请输入国籍' }) : auditProfile.nationality,
    },
    {
      label: '出生日期',
      value: isEditing ? renderEditor('birthDate', { type: 'date', ariaLabel: '出生日期', placeholder: '请选择出生日期' }) : auditProfile.birthDate,
    },
    {
      label: '准驾车型',
      value: isEditing ? renderEditor('licenseCategory', { placeholder: '如 C1 / C2' }) : auditProfile.vehicleCategory,
    },
    {
      label: '驾照地址详情',
      value: isEditing ? renderEditor('licenseAddress', { multiline: true, rows: 3, placeholder: '请输入驾照地址' }) : auditProfile.licenseAddress,
      fullWidth: true,
    },
    {
      label: '档案编号',
      value: isEditing ? renderEditor('archiveNumber', { placeholder: '请输入档案编号' }) : auditProfile.archiveNumber,
    },
    {
      label: '条形码',
      value: isEditing ? renderEditor('barcodeNumber', { placeholder: '请输入条形码' }) : auditProfile.barcodeNumber,
    },
    {
      label: '初次领证日期',
      value: isEditing ? renderEditor('firstIssueDate', { type: 'date', ariaLabel: '初次领证日期', placeholder: '请选择初次领证日期' }) : auditProfile.firstIssueDate,
    },
    {
      label: '有效起始日期',
      value: isEditing ? renderEditor('validFromDate', { type: 'date', ariaLabel: '有效起始日期', placeholder: '请选择有效起始日期' }) : auditProfile.validFromDate,
    },
    {
      label: '有效年限',
      value: isEditing ? renderValidYearsEditor() : auditProfile.validYears,
    },
    ...(shouldShowValidUntilDate
      ? [
          {
            label: '终止日期',
            value: renderValidUntilDateValue(),
          },
        ]
      : []),
    {
      label: '发证机构',
      value: isEditing ? renderIssuingAuthorityEditor() : auditProfile.issuingAuthority,
    },
    {
      label: '发证地区',
      value: isEditing ? (
        <div className="order-audit-field__inline-editors">
          {renderSelectEditor('issuingProvince', issuingProvinceOptions, '请选择省份', handleIssuingProvinceChange)}
          {renderSelectEditor('issuingCity', issuingCityOptions, '请选择城市', handleIssuingCityChange, !editForm.issuingProvince)}
        </div>
      ) : auditProfile.issuingRegion,
    },
  ];

  const deliveryInfoItems = [
    {
      label: '收货人',
      value: isEditing ? renderEditor('customerName', { placeholder: '请输入收货人' }) : getDisplayValue(order.customerName),
    },
    {
      label: '联系电话',
      value: isEditing ? renderEditor('customerPhone', { type: 'tel', placeholder: '请输入联系电话' }) : getDisplayValue(order.customerPhone),
    },
    {
      label: '收货地址',
      value: isEditing ? renderEditor('deliveryAddress', { multiline: true, rows: 3, placeholder: '请输入收货地址' }) : getDisplayValue(order.deliveryAddress),
      fullWidth: true,
    },
  ];

  const productInfoItems = [
    {
      label: '订单编号',
      value: order.orderId,
    },
    {
      label: '商品名称',
      value: getDisplayValue(order.productName),
    },
    ...(isExternalNotarySourceOrder(order)
      ? [
          {
            label: '语言选择',
            value: getDisplayValue(order.language),
          },
          {
            label: '使用国家',
            value: getDisplayValue(order.useCountry),
          },
        ]
      : []),
    {
      label: '办理类型',
      value: getProductProcessTypeLabel(order.processType, t),
    },
    {
      label: '总价',
      value: currencyFormatter.format(order.lockedPrice || 0),
    },
  ];
  const logisticsInfoItems: Array<{ label: string; value: React.ReactNode; fullWidth?: boolean }> = canSubmitLogistics
    ? [
        {
          label: '物流公司',
          value: (
            <select
              className="form-select order-audit-field__editor"
              value={logisticsForm.logisticsCompany}
              onChange={(event) => handleLogisticsFieldChange('logisticsCompany', event.target.value)}
              disabled={!canSubmitLogistics}
            >
              <option value="">请选择物流公司</option>
              {LOGISTICS_COMPANY_OPTIONS.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          ),
        },
        {
          label: '物流单号',
          value: (
            <input
              type="text"
              className="form-input order-audit-field__editor"
              value={logisticsForm.trackingNumber}
              onChange={(event) => handleLogisticsFieldChange('trackingNumber', event.target.value)}
              placeholder="请输入物流单号"
              disabled={!canSubmitLogistics}
            />
          ),
        },
        {
          label: '提交物流信息',
          value: (
            <button
              type="button"
              className="btn btn--primary order-audit-logistics__button"
              disabled={logisticsSubmitDisabled}
              onClick={handleSubmitLogistics}
            >
              提交物流信息
            </button>
          ),
          fullWidth: true,
        },
      ]
    : shouldRenderLogisticsSection
      ? [
        {
          label: '物流公司',
          value: getDisplayValue(logisticsDisplayCompany),
        },
        {
          label: '物流单号',
          value: getDisplayValue(logisticsDisplayTrackingNumber),
        },
      ]
      : [];

  return (
    <div className="animate-fadeIn notary-order-management-preview">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}

      <div className="app-topbar">
        <div className="order-audit-topbar">
          <div className="order-audit-topbar__heading">
            <div className="app-topbar__breadcrumb">
              <button type="button" className="order-audit-topbar__back" onClick={() => navigate(backPath)}>
                公证订单管理
              </button>
              <span>/</span>
              <span>{pageTitle}</span>
              <span>/</span>
              <span>{order.orderId}</span>
            </div>
            <div className="order-audit-topbar__actions">
              {POWER_OF_ATTORNEY_EXPORT_OPTIONS.map((option) => {
                const isExportingCurrentOption = exportingPowerOfAttorneyKey === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`btn order-audit-topbar__action-btn ${option.buttonClassName}`}
                    onClick={() => void handleExportPowerOfAttorney(option)}
                    disabled={Boolean(exportingPowerOfAttorneyKey)}
                  >
                    {isExportingCurrentOption ? '导出中...' : option.buttonLabel}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn order-audit-topbar__action-btn order-audit-topbar__action-btn--itinerary"
                onClick={handleExportItinerary}
              >
                导出行程单
              </button>
              <button
                type="button"
                className="btn order-audit-topbar__action-btn order-audit-topbar__action-btn--images"
                onClick={() => void handleExportImagesPdf()}
                disabled={isExportingImagesPdf}
              >
                {isExportingImagesPdf ? '导出中...' : '导出扫描件PDF'}
              </button>
              {isReadOnlyPreview && (
                <button
                  type="button"
                  className="btn order-audit-topbar__action-btn order-audit-topbar__action-btn--return order-audit-topbar__return-btn"
                  onClick={handleReturn}
                >
                  返回
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="app-main order-audit-page">
        <div className="order-audit-layout order-audit-layout--single-column">
          <div className="order-audit-main">
            {isViewMode ? (
              <>
                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">收货信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {deliveryInfoItems.map((item) => (
                        <div key={item.label} className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}>
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">商品信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {productInfoItems.map((item) => (
                        <div key={item.label} className="order-audit-field">
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">物流信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {logisticsInfoItems.map((item) => (
                        <div key={item.label} className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}>
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="card order-audit-card notary-review-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">订单信息</h2>
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="notary-review-grid">
                      {orderInfoItems.map((item) => (
                        <div
                          key={item.label}
                          className={`notary-review-field ${item.fullWidth ? 'notary-review-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                        >
                          <span className={`notary-review-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                          <div className="notary-review-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-card notary-review-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">驾照信息</h2>
                    {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="notary-review-grid notary-review-grid--license">
                      {licenseInfoItems.map((item) => (
                        <div
                          key={item.label}
                          className={`notary-review-field ${item.fullWidth ? 'notary-review-field--full' : ''} ${item.fieldClassName || ''}`.trim()}
                        >
                          <span className={`notary-review-field__label ${item.labelClassName || ''}`.trim()}>{item.label}:</span>
                          <div className="notary-review-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card order-audit-image-card order-audit-image-card--inline">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">证件信息</h2>
                  </div>
                  <div className="order-audit-image-grid">
                    {previewImages.map((item) => {
                      const uploadInputId = `notary-certificate-image-upload-${item.key}`;

                      return (
                      <div key={item.key} className={`order-audit-image-slot ${item.src ? '' : 'order-audit-image-slot--empty'}`}>
                        <div className="order-audit-image-slot__meta">
                          <span className="order-audit-image-slot__label">{item.label}</span>
                        </div>
                        <div className="order-audit-image-frame">
                          {item.src ? (
                            <button
                              type="button"
                              className="order-audit-image-trigger"
                              onClick={() => setPreviewImage(item)}
                              aria-label={`查看${item.label}大图`}
                            >
                              <ResolvedImage className="order-audit-image" src={item.src} alt={`${item.label}预览`} />
                            </button>
                          ) : (
                            <div className="order-audit-image-placeholder" aria-hidden="true">
                              <strong>暂无图片</strong>
                              <span>等待上传</span>
                            </div>
                          )}
                        </div>
                        {isEditing && (
                          <div className="order-audit-image-slot__actions">
                            <label htmlFor={uploadInputId} className="order-audit-image-upload-btn">
                              替换图片
                            </label>
                            <input
                              id={uploadInputId}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="order-audit-image-upload-input"
                              onChange={(event) => {
                                handleCertificateImageUpload(item.key, event.target.files?.[0] || null);
                                event.currentTarget.value = '';
                              }}
                            />
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </section>

                <section className="card order-audit-card">
                  <div className="card__header order-audit-card__header">
                    <h2 className="order-audit-card__title">收货信息</h2>
                    {isEditing && <span className="order-audit-editing-tip">编辑中</span>}
                  </div>
                  <div className="card__body order-audit-card__body">
                    <div className="order-audit-grid">
                      {deliveryInfoItems.map((item) => (
                        <div key={item.label} className={`order-audit-field ${item.fullWidth ? 'order-audit-field--full' : ''}`}>
                          <span className="order-audit-field__label">{item.label}:</span>
                          <div className="order-audit-field__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            {order.rejectReason && (
              <section className="card order-audit-card order-audit-card--warning">
                <div className="card__header order-audit-card__header">
                  <h2 className="order-audit-card__title">历史驳回原因</h2>
                </div>
                <div className="card__body order-audit-card__body">
                  <p className="order-audit-warning-text">{order.rejectReason}</p>
                </div>
              </section>
            )}
          </div>

        </div>
      </div>

      {canModifyOrder && (
        <div className="order-audit-footer">
          <div className="order-audit-footer__inner">
            <div className="order-audit-footer__meta">
              <span>订单号：{order.orderId}</span>
              <span>实付金额：{currencyFormatter.format(order.lockedPrice || 0)}</span>
              <span>办理类型：{getProductProcessTypeLabel(order.processType, t)}</span>
            </div>
            <div className="order-audit-footer__actions">
              {isAuditable && (
                <>
                  <button type="button" className="btn btn--primary" onClick={handleApprove} disabled={isEditing}>
                    通过
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => setShowRejectModal(true)} disabled={isEditing}>
                    拒绝
                  </button>
                </>
              )}
              <button type="button" className="btn btn--warning" onClick={isEditing ? handleSaveEdit : handleModify}>
                {isEditing ? '保存' : '修改'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={isEditing ? handleCancelEdit : () => navigate(backPath)}>
                {isEditing ? '取消' : '返回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal approve-notary-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">选择制作公证处模版</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowApproveModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal__body">
              <p className="order-audit-modal__hint">订单审核通过后，将同步至驾照官系统，制作人员按所选模版制作材料。</p>
              <div className="approve-notary-list">
                {NOTARY_OFFICES.map((office) => (
                  <label
                    key={office.id}
                    className={`approve-notary-item ${selectedNotaryOffice === office.id ? 'approve-notary-item--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="notary-office"
                      value={office.id}
                      checked={selectedNotaryOffice === office.id}
                      onChange={() => setSelectedNotaryOffice(office.id)}
                      className="approve-notary-item__radio"
                    />
                    <div className="approve-notary-item__info">
                      <span className="approve-notary-item__name">{office.name}</span>
                      <span className="approve-notary-item__district">{office.district}</span>
                    </div>
                    {selectedNotaryOffice === office.id && (
                      <span className="approve-notary-item__check">✓</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowApproveModal(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!selectedNotaryOffice}
                onClick={handleConfirmApprove}
              >
                确认通过并同步
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">拒绝订单</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowRejectModal(false)}>
                关闭
              </button>
            </div>
            <div className="modal__body">
              <p className="order-audit-modal__hint">请填写驳回原因，提交后订单会从待审核列表移除。</p>
              <div className="form-group">
                <label className="form-label form-label--required">驳回原因</label>
                <textarea
                  className="form-textarea"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="例如：驾照信息不完整、图片不清晰、收货信息有误。"
                  rows={5}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowRejectModal(false)}>
                取消
              </button>
              <button type="button" className="btn btn--danger" disabled={!rejectReason.trim()} onClick={handleReject}>
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="order-audit-image-modal" onClick={(event) => event.stopPropagation()}>
            <div className="order-audit-image-modal__header">
              <h3 className="order-audit-image-modal__title">{previewImage.label}</h3>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreviewImage(null)}>
                关闭
              </button>
            </div>
            <div className="order-audit-image-modal__body">
              <ResolvedImage
                className="order-audit-image-modal__image"
                src={previewImage.src || ''}
                alt={`${previewImage.label}大图预览`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaryOrderManagementPreview;
