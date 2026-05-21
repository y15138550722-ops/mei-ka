import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ORDER_DATA_CHANGED_EVENT, addOrder, getOrders, getProducts, updateOrder } from '../../services/mockDataService';
import type { DomesticLicenseInfo, Order, OrderStatus, ProductProcessType } from '../../shared/types';
import { LICENSE_ISSUING_AUTHORITY_OPTIONS } from '../../shared/config/licenseIssuingAuthority';
import { orderPreviewAssets } from '../../shared/config/orderPreviewAssets';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import ResolvedImage from '../../shared/components/ResolvedImage';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { getLanguageOptionsForProduct } from '../../shared/utils/notaryLanguageOptions';
import { saveDomesticLicenseImages, saveNotaryCertificateImages } from '../../shared/utils/localImageStore';
import './AgentSystemPage.css';

type ValidityPeriod = '6年' | '10年' | '60年' | '长期' | '自定义';
type OrderEntryType = 'notary' | 'domesticLicenseTranslation';
type AgentPageView = 'orderEntry' | 'orderList';
type AgentOrderStatusTab = '' | 'pending_review' | 'pending_production' | 'shipped' | 'cancelled';
type OrderInput = Omit<Order, 'orderId'> & { orderId?: string };

const orderEntryOptions: Array<{ value: OrderEntryType; label: string }> = [
  { value: 'notary', label: '公证产品下单' },
  { value: 'domesticLicenseTranslation', label: '换国内驾照翻译件下单' },
];

const agentOrderStatusTabs: Array<{ value: AgentOrderStatusTab; label: string }> = [
  { value: '', label: '所有订单' },
  { value: 'pending_review', label: '待审核' },
  { value: 'pending_production', label: '制作中' },
  { value: 'shipped', label: '已发货' },
  { value: 'cancelled', label: '已取消' },
];

const sideMenuItems = ['选择产品', '确认驾照信息', '确认收货信息', '选择办理类型', '提交订单'];
const SECTION_SCROLL_OFFSET = 78;
const ORDER_LIST_PAGE_SIZE = 10;
const AGENT_ACTIVE_VIEW_STORAGE_KEY = 'meika-agent-system-active-view';

type DomesticLicenseFormState = {
  exchangeProvince: string;
  exchangeCity: string;
  foreignCountry: string;
  foreignCity: string;
  chineseName: string;
  licenseNumber: string;
  expiryDate: string;
  surname: string;
  givenName: string;
  birthDate: string;
  rstr: string;
  sex: string;
  hairColor: string;
  eyeColor: string;
  height: string;
  weight: string;
  issueDate: string;
  fileNumber: string;
  classType: string;
  endorsements: string;
  restrictions: string;
  other: string;
  frontPhoto: string;
  backPhoto: string;
  passportPhoto: string;
  frontPhotoName: string;
  backPhotoName: string;
  passportPhotoName: string;
};

const DOMESTIC_LICENSE_PRODUCT_TITLE = '换国内驾照翻译件';

const domesticLicenseForeignLocationOptions = [
  { country: '美国', cities: ['加利福尼亚州', '纽约州', '德克萨斯州', '华盛顿州', '佛罗里达州'] },
  { country: '加拿大', cities: ['安大略省', '不列颠哥伦比亚省', '阿尔伯塔省', '魁北克省'] },
  { country: '澳大利亚', cities: ['新南威尔士州', '维多利亚州', '昆士兰州', '西澳大利亚州'] },
  { country: '新西兰', cities: ['奥克兰', '惠灵顿', '基督城'] },
  { country: '英国', cities: ['伦敦', '曼彻斯特', '伯明翰'] },
  { country: '日本', cities: ['东京', '大阪', '名古屋'] },
] as const;

const domesticLicenseAttachmentFields = [
  { key: 'frontPhoto', nameKey: 'frontPhotoName', label: '驾照正面照片', required: true },
  { key: 'backPhoto', nameKey: 'backPhotoName', label: '驾照反面照片', required: true },
  { key: 'passportPhoto', nameKey: 'passportPhotoName', label: '护照', required: false },
] as const;

const createDomesticLicenseFormState = (): DomesticLicenseFormState => ({
  exchangeProvince: '',
  exchangeCity: '',
  foreignCountry: '',
  foreignCity: '',
  chineseName: '',
  licenseNumber: '',
  expiryDate: '',
  surname: '',
  givenName: '',
  birthDate: '',
  rstr: '',
  sex: '男',
  hairColor: '',
  eyeColor: '',
  height: '',
  weight: '',
  issueDate: '',
  fileNumber: '',
  classType: '',
  endorsements: '',
  restrictions: '',
  other: '',
  frontPhoto: '',
  backPhoto: '',
  passportPhoto: '',
  frontPhotoName: '',
  backPhotoName: '',
  passportPhotoName: '',
});

const MAX_ORDER_IMAGE_DATA_URL_LENGTH = 360_000;

const resizeImageDataUrl = (file: File, maxSize = 960, quality = 0.68) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context is unavailable'));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        let nextDataUrl = '';
        const qualitySteps = [quality, 0.58, 0.48, 0.38, 0.3];
        for (const nextQuality of qualitySteps) {
          nextDataUrl = canvas.toDataURL('image/jpeg', nextQuality);
          if (nextDataUrl.length <= MAX_ORDER_IMAGE_DATA_URL_LENGTH) {
            resolve(nextDataUrl);
            return;
          }
        }

        reject(new Error('Image is too large after compression'));
      };
      image.onerror = () => reject(new Error('Image load failed'));
      image.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

type UploadItem = {
  key: string;
  optional?: boolean;
  required?: boolean;
  title: string;
  tone: 'blue' | 'green' | 'plain';
};

const uploadItems: readonly UploadItem[] = [
  { key: 'license-front', title: '驾照正面照片', tone: 'green' },
  { key: 'license-back', title: '驾照反面照片', tone: 'green' },
  { key: 'extra-front', title: '驾照副页正面照片', tone: 'green' },
  { key: 'extra-back', title: '驾照副页反面照片', tone: 'green' },
  { key: 'identity-front', title: '身份证正面', tone: 'blue' },
  { key: 'identity-back', title: '身份证反面', tone: 'blue' },
  { key: 'passport-front', title: '护照首页', tone: 'blue', required: true },
  { key: 'passport-visa', title: '护照签证页', tone: 'blue', optional: true },
  { key: 'flight-itinerary', title: '行程单', tone: 'plain' },
  { key: 'digital-license', title: '电子驾照', tone: 'blue' },
  { key: 'signature', title: '电子签名', tone: 'plain' },
];

const notaryAttachmentDisplayOrder = uploadItems.map((item) => item.key);
const notaryAttachmentLabels = new Map(uploadItems.map((item) => [item.key, item.title] as const));

const getNotaryAttachmentPhotoItems = (order: Order) => {
  const images = order.notaryCertificateImages || {};
  const knownItems = notaryAttachmentDisplayOrder.flatMap((key) => {
    const src = images[key];
    return src
      ? [
          {
            key,
            label: notaryAttachmentLabels.get(key) || key,
            src,
          },
        ]
      : [];
  });
  const unknownItems = Object.entries(images)
    .filter(([key, src]) => Boolean(src) && !notaryAttachmentLabels.has(key))
    .map(([key, src]) => ({
      key,
      label: key,
      src,
    }));

  return [...knownItems, ...unknownItems];
};

const validityPeriods: ValidityPeriod[] = ['6年', '10年', '60年', '长期', '自定义'];

const provinceCityOptions = [
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

const deliveryRegionOptions = [
  {
    province: '北京市',
    cities: [
      { city: '北京市', districts: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '通州区'] },
    ],
  },
  {
    province: '上海市',
    cities: [
      { city: '上海市', districts: ['黄浦区', '徐汇区', '静安区', '浦东新区', '闵行区', '宝山区'] },
    ],
  },
  {
    province: '广东省',
    cities: [
      { city: '广州市', districts: ['越秀区', '天河区', '海珠区', '白云区', '番禺区'] },
      { city: '深圳市', districts: ['福田区', '罗湖区', '南山区', '宝安区', '龙岗区'] },
      { city: '珠海市', districts: ['香洲区', '斗门区', '金湾区'] },
    ],
  },
  {
    province: '广西壮族自治区',
    cities: [
      { city: '南宁市', districts: ['青秀区', '兴宁区', '西乡塘区', '江南区', '良庆区'] },
      { city: '柳州市', districts: ['城中区', '鱼峰区', '柳南区', '柳北区'] },
      { city: '桂林市', districts: ['秀峰区', '叠彩区', '象山区', '七星区'] },
    ],
  },
  {
    province: '江苏省',
    cities: [
      { city: '南京市', districts: ['玄武区', '秦淮区', '建邺区', '鼓楼区', '江宁区'] },
      { city: '苏州市', districts: ['姑苏区', '吴中区', '相城区', '工业园区'] },
      { city: '无锡市', districts: ['梁溪区', '锡山区', '惠山区', '滨湖区'] },
    ],
  },
  {
    province: '浙江省',
    cities: [
      { city: '杭州市', districts: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区'] },
      { city: '宁波市', districts: ['海曙区', '江北区', '北仑区', '鄞州区'] },
      { city: '温州市', districts: ['鹿城区', '龙湾区', '瓯海区'] },
    ],
  },
] as const;

const getProcessTypePrice = (processType: ProductProcessType | null) =>
  processType?.pricing.find((item) => item.agentLevel === 'self')?.price ?? processType?.pricing[0]?.price ?? 0;

const AGENT_ACCOUNT_BALANCE = 28304;

const formatCurrency = (value: number, fractionDigits?: number) => {
  const fixedDigits = typeof fractionDigits === 'number' ? fractionDigits : Number.isInteger(value) ? 0 : 2;
  return `¥${value.toFixed(fixedDigits)}`;
};

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const readFormValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const isStorageQuotaError = (error: unknown) => {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22;
};

const joinAddressSegments = (segments: string[]) => segments.filter(Boolean).join(' ');

const getNotaryOrderProductName = (productTitle: string) => {
  const compactTitle = productTitle.replace(/\s+/g, '');

  if (compactTitle.includes('海牙双号')) return '公证海牙双号';
  if (compactTitle.includes('海牙单号')) return '公证海牙单号';
  if (compactTitle.includes('双号')) return '公证双号';

  return '公证单号';
};

const getAgentOrderStatus = (status: OrderStatus): AgentOrderStatusTab => {
  if (status === 'pending_review' || status === 'translating' || status === 'rejected') return 'pending_review';
  if (status === 'pending_production' || status === 'in_production') return 'pending_production';
  if (status === 'shipped' || status === 'completed') return 'shipped';
  if (status === 'cancelled') return 'cancelled';
  return '';
};

const getAgentOrderStatusLabel = (status: OrderStatus) => {
  const statusValue = getAgentOrderStatus(status);
  return agentOrderStatusTabs.find((tab) => tab.value === statusValue)?.label || '待审核';
};

const getAgentOrderStatusClassName = (status: OrderStatus) => {
  const statusValue = getAgentOrderStatus(status) || 'pending_review';
  return `agent-order-status agent-order-status--${statusValue}`;
};

const PRODUCTION_NODE_ACTIONS = ['已翻译', '已制作', '已发货'] as const;

const getProductionOrderRecords = (order: Order) => {
  const nodeRecords = PRODUCTION_NODE_ACTIONS.flatMap((action) => {
    const log = order.logs.find((item) => item.operator === '生产端' && item.action === action);
    return log ? [`${action} ${log.time.slice(0, 16)}`] : [];
  });

  if (nodeRecords.length > 0) {
    return nodeRecords;
  }

  const status = getAgentOrderStatus(order.status);

  if (status === 'shipped') {
    const shippedTime = (order.shippedAt || order.updatedAt || order.createdAt).slice(0, 16);
    return [`已发货 ${shippedTime}`];
  }

  return [];
};

const isAgentSubmittedOrder = (order: Order) =>
  order.remark === '用户端提交' ||
  order.remark === '代理端提交' ||
  order.logs.some((log) => log.operator === '用户端' || log.operator === '代理端' || log.action.includes('用户端') || log.action.includes('代理端'));

const isNotaryOrder = (order: Order) => order.productCategory === 'notary';

const canCancelAgentOrder = (order: Order) => order.status === 'pending_review' || order.status === 'translating';

const getDomesticExchangeCity = (order: Order) =>
  order.licenseIssuingRegion ||
  [order.domesticLicenseInfo?.exchangeProvince, order.domesticLicenseInfo?.exchangeCity].filter(Boolean).join(' ');

const getDomesticForeignLocation = (order: Order) =>
  [order.domesticLicenseInfo?.foreignCountry, order.domesticLicenseInfo?.foreignCity].filter(Boolean).join(' ');

const getInitialAgentPageView = (): AgentPageView => {
  if (typeof window === 'undefined') return 'orderEntry';

  try {
    const storedView = window.localStorage.getItem(AGENT_ACTIVE_VIEW_STORAGE_KEY);
    return storedView === 'orderList' || storedView === 'orderEntry' ? storedView : 'orderEntry';
  } catch {
    return 'orderEntry';
  }
};

const addYearsToDateValue = (dateValue: string, validityPeriod: ValidityPeriod) => {
  if (!dateValue || validityPeriod === '长期' || validityPeriod === '自定义') {
    return '';
  }

  const validityYears = Number(validityPeriod.replace(/\D/g, ''));
  const [year, month, day] = dateValue.split('-').map(Number);

  if (!Number.isFinite(validityYears) || !year || !month || !day) {
    return '';
  }

  return formatDateValue(new Date(year + validityYears, month - 1, day));
};

const AgentSystemPage: React.FC = () => {
  const navigate = useNavigate();
  const orderEntryDropdownRef = useRef<HTMLDivElement | null>(null);
  const orderProductFilterRef = useRef<HTMLDivElement | null>(null);
  const systemSwitchRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const certificateFormRef = useRef<HTMLFormElement | null>(null);
  const deliveryFormRef = useRef<HTMLFormElement | null>(null);
  const [activeView, setActiveView] = useState<AgentPageView>(() => getInitialAgentPageView());
  const [orderEntryType, setOrderEntryType] = useState<OrderEntryType>('notary');
  const [isOrderEntryDropdownOpen, setIsOrderEntryDropdownOpen] = useState(false);
  const [isSystemSwitchOpen, setIsSystemSwitchOpen] = useState(false);
  const [orderListStatus, setOrderListStatus] = useState<AgentOrderStatusTab>('');
  const [orderListProductIds, setOrderListProductIds] = useState<string[]>([]);
  const [isOrderProductFilterOpen, setIsOrderProductFilterOpen] = useState(false);
  const [orderListKeyword, setOrderListKeyword] = useState('');
  const [orderListStartDate, setOrderListStartDate] = useState('');
  const [orderListEndDate, setOrderListEndDate] = useState('');
  const [orderListPage, setOrderListPage] = useState(1);
  const [uploadedCertificates, setUploadedCertificates] = useState<Record<string, { name: string; src: string }>>({});
  const orderEntryLabel = orderEntryOptions.find((item) => item.value === orderEntryType)?.label || '公证产品下单';
  const isDomesticLicenseEntry = orderEntryType === 'domesticLicenseTranslation';
  const [domesticLicenseForm, setDomesticLicenseForm] = useState<DomesticLicenseFormState>(() =>
    createDomesticLicenseFormState(),
  );
  const orderListProducts = useMemo(
    () =>
      getProducts()
        .filter((product) => product.status === 'active')
        .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, 'zh-CN')),
    [],
  );
  const activeProducts = useMemo(() => {
    const activeCategory = orderEntryType === 'notary' ? 'notary' : 'domestic_license';
    const products = getProducts().filter((product) => product.category === activeCategory && product.status === 'active');

    return products.sort((a, b) => {
      if (orderEntryType === 'domesticLicenseTranslation') {
        const aIsTarget = a.title === DOMESTIC_LICENSE_PRODUCT_TITLE;
        const bIsTarget = b.title === DOMESTIC_LICENSE_PRODUCT_TITLE;

        if (aIsTarget !== bIsTarget) {
          return aIsTarget ? -1 : 1;
        }
      }

      return b.weight - a.weight || a.title.localeCompare(b.title, 'zh-CN');
    });
  }, [orderEntryType]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProcessTypeId, setSelectedProcessTypeId] = useState('');
  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.productId === selectedProductId) || null,
    [activeProducts, selectedProductId],
  );
  const languageOptions = useMemo(() => getLanguageOptionsForProduct(selectedProduct?.title), [selectedProduct?.title]);
  const [selectedLanguage, setSelectedLanguage] = useState(() => languageOptions[0] || '');
  const [useCountry, setUseCountry] = useState('');
  const selectedProcessType = useMemo(
    () => selectedProduct?.processTypes.find((processType) => processType.typeId === selectedProcessTypeId) || null,
    [selectedProduct?.processTypes, selectedProcessTypeId],
  );
  const selectedProcessTypePrice = getProcessTypePrice(selectedProcessType);
  const balanceAfterPayment = AGENT_ACCOUNT_BALANCE - selectedProcessTypePrice;
  const [validityPeriod, setValidityPeriod] = useState<ValidityPeriod>('6年');
  const [customValidUntilDate, setCustomValidUntilDate] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [deliveryProvince, setDeliveryProvince] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryDistrict, setDeliveryDistrict] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [initialIssueDate, setInitialIssueDate] = useState('');
  const [validStartDate, setValidStartDate] = useState('');
  const [addressRecognitionText, setAddressRecognitionText] = useState('');
  const [addressRecognitionError, setAddressRecognitionError] = useState('');
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const cityOptions = useMemo(
    () => provinceCityOptions.find((item) => item.province === selectedProvince)?.cities ?? [],
    [selectedProvince],
  );
  const domesticExchangeCityOptions = useMemo(
    () => provinceCityOptions.find((item) => item.province === domesticLicenseForm.exchangeProvince)?.cities ?? [],
    [domesticLicenseForm.exchangeProvince],
  );
  const domesticForeignCityOptions = useMemo(
    () =>
      domesticLicenseForeignLocationOptions.find((item) => item.country === domesticLicenseForm.foreignCountry)?.cities ?? [],
    [domesticLicenseForm.foreignCountry],
  );
  const deliveryCityOptions = useMemo(
    () => deliveryRegionOptions.find((item) => item.province === deliveryProvince)?.cities ?? [],
    [deliveryProvince],
  );
  const deliveryDistrictOptions = useMemo(
    () => deliveryCityOptions.find((item) => item.city === deliveryCity)?.districts ?? [],
    [deliveryCity, deliveryCityOptions],
  );
  const selectedOrderListProductNames = useMemo(
    () =>
      orderListProducts
        .filter((product) => orderListProductIds.includes(product.productId))
        .map((product) => product.title),
    [orderListProductIds, orderListProducts],
  );
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderDetailModalOrder, setOrderDetailModalOrder] = useState<Order | null>(null);
  const [licenseInfoModalOrder, setLicenseInfoModalOrder] = useState<Order | null>(null);
  const [allAgentOrders, setAllAgentOrders] = useState<Order[]>(() =>
    getOrders()
      .filter(isAgentSubmittedOrder)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const refreshAgentOrders = () => {
    setAllAgentOrders(
      getOrders()
        .filter(isAgentSubmittedOrder)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  };
  const filteredAgentOrders = useMemo(() => {
    const keyword = orderListKeyword.trim().toLowerCase();

    return allAgentOrders.filter((order) => {
      const createdDate = order.createdAt.slice(0, 10);
      if (orderListStatus && getAgentOrderStatus(order.status) !== orderListStatus) return false;
      if (orderListProductIds.length > 0 && !orderListProductIds.includes(order.productId)) return false;
      if (orderListStartDate && createdDate < orderListStartDate) return false;
      if (orderListEndDate && createdDate > orderListEndDate) return false;

      if (keyword) {
        const searchableText = [
          order.orderId,
          order.productName,
          order.customerName,
          order.customerPhone,
          order.customerPassport,
          order.trackingNumber,
          order.deliveryAddress,
          order.licenseName,
          order.licenseNo,
          order.licenseCategory,
          order.domesticLicenseInfo?.chineseName,
          order.domesticLicenseInfo?.licenseNumber,
          getDomesticExchangeCity(order),
          getDomesticForeignLocation(order),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(keyword)) return false;
      }

      return true;
    });
  }, [allAgentOrders, orderListEndDate, orderListKeyword, orderListProductIds, orderListStartDate, orderListStatus]);
  const orderListPageCount = Math.max(1, Math.ceil(filteredAgentOrders.length / ORDER_LIST_PAGE_SIZE));
  const paginatedAgentOrders = useMemo(() => {
    const startIndex = (orderListPage - 1) * ORDER_LIST_PAGE_SIZE;
    return filteredAgentOrders.slice(startIndex, startIndex + ORDER_LIST_PAGE_SIZE);
  }, [filteredAgentOrders, orderListPage]);

  useEffect(() => {
    if (selectedLanguage && !languageOptions.includes(selectedLanguage)) {
      setSelectedLanguage('');
    }
  }, [languageOptions, selectedLanguage]);

  useEffect(() => {
    setOrderListPage(1);
  }, [orderListEndDate, orderListKeyword, orderListProductIds, orderListStartDate, orderListStatus]);

  useEffect(() => {
    window.addEventListener(ORDER_DATA_CHANGED_EVENT, refreshAgentOrders);
    window.addEventListener('storage', refreshAgentOrders);

    return () => {
      window.removeEventListener(ORDER_DATA_CHANGED_EVENT, refreshAgentOrders);
      window.removeEventListener('storage', refreshAgentOrders);
    };
  }, []);

  useEffect(() => {
    if (orderListPage > orderListPageCount) {
      setOrderListPage(orderListPageCount);
    }
  }, [orderListPage, orderListPageCount]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENT_ACTIVE_VIEW_STORAGE_KEY, activeView);
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [activeView]);

  useEffect(() => {
    const firstProduct = activeProducts[0];
    setSelectedProductId(firstProduct?.productId || '');
    setSelectedProcessTypeId(firstProduct?.processTypes[0]?.typeId || '');
    setSelectedLanguage(getLanguageOptionsForProduct(firstProduct?.title)[0] || '');
  }, [activeProducts]);

  useEffect(() => {
    if (selectedProcessTypeId && !selectedProduct?.processTypes.some((processType) => processType.typeId === selectedProcessTypeId)) {
      setSelectedProcessTypeId('');
    }
  }, [selectedProcessTypeId, selectedProduct?.processTypes]);

  useEffect(() => {
    if (!(cityOptions as readonly string[]).includes(selectedCity)) {
      setSelectedCity('');
    }
  }, [cityOptions, selectedCity]);

  useEffect(() => {
    if (
      domesticLicenseForm.exchangeCity &&
      !(domesticExchangeCityOptions as readonly string[]).includes(domesticLicenseForm.exchangeCity)
    ) {
      setDomesticLicenseForm((currentForm) => ({ ...currentForm, exchangeCity: '' }));
    }
  }, [domesticExchangeCityOptions, domesticLicenseForm.exchangeCity]);

  useEffect(() => {
    if (
      domesticLicenseForm.foreignCity &&
      !(domesticForeignCityOptions as readonly string[]).includes(domesticLicenseForm.foreignCity)
    ) {
      setDomesticLicenseForm((currentForm) => ({ ...currentForm, foreignCity: '' }));
    }
  }, [domesticForeignCityOptions, domesticLicenseForm.foreignCity]);

  useEffect(() => {
    if (!deliveryCityOptions.some((item) => item.city === deliveryCity)) {
      setDeliveryCity('');
    }
  }, [deliveryCity, deliveryCityOptions]);

  useEffect(() => {
    if (!(deliveryDistrictOptions as readonly string[]).includes(deliveryDistrict)) {
      setDeliveryDistrict('');
    }
  }, [deliveryDistrict, deliveryDistrictOptions]);

  useEffect(() => {
    if (!isOrderEntryDropdownOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!orderEntryDropdownRef.current?.contains(event.target as Node)) {
        setIsOrderEntryDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOrderEntryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOrderEntryDropdownOpen]);

  useEffect(() => {
    if (!isOrderProductFilterOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!orderProductFilterRef.current?.contains(event.target as Node)) {
        setIsOrderProductFilterOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOrderProductFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOrderProductFilterOpen]);

  useEffect(() => {
    if (!isSystemSwitchOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!systemSwitchRef.current?.contains(event.target as Node)) {
        setIsSystemSwitchOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSystemSwitchOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSystemSwitchOpen]);

  useEffect(() => {
    const updateActiveSection = () => {
      const pageBottomReached =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

      if (pageBottomReached) {
        setActiveSectionIndex(sideMenuItems.length - 1);
        return;
      }

      const nextActiveIndex = sectionRefs.current.reduce((activeIndex, section, index) => {
        if (!section) return activeIndex;
        return section.getBoundingClientRect().top <= SECTION_SCROLL_OFFSET + 12 ? index : activeIndex;
      }, 0);

      setActiveSectionIndex((currentIndex) => (
        currentIndex === nextActiveIndex ? currentIndex : nextActiveIndex
      ));
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const updateDomesticLicenseForm = (patch: Partial<DomesticLicenseFormState>) => {
    setDomesticLicenseForm((currentForm) => ({ ...currentForm, ...patch }));
  };

  const handleDomesticLicenseFileChange = async (
    field: 'frontPhoto' | 'backPhoto' | 'passportPhoto',
    nameField: 'frontPhotoName' | 'backPhotoName' | 'passportPhotoName',
    file: File | null,
  ) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('请上传图片格式的附件');
      return;
    }

    try {
      const dataUrl = await resizeImageDataUrl(file);
      updateDomesticLicenseForm({ [field]: dataUrl, [nameField]: file.name } as Partial<DomesticLicenseFormState>);
      showToast(`${file.name} 已上传`);
    } catch {
      showToast('附件读取失败，请重新上传');
    }
  };

  const handleCertificateFileChange = async (key: string, title: string, file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('请上传图片格式的附件');
      return;
    }

    try {
      const dataUrl = await resizeImageDataUrl(file);
      setUploadedCertificates((currentItems) => ({
        ...currentItems,
        [key]: {
          name: file.name,
          src: dataUrl,
        },
      }));
      showToast(`${title} 已上传`);
    } catch {
      showToast('附件读取失败，请重新上传');
    }
  };

  const handleProductChange = (value: string) => {
    const nextProduct = activeProducts.find((product) => product.productId === value) || null;

    setSelectedProductId(value);
    setSelectedLanguage(getLanguageOptionsForProduct(nextProduct?.title)[0] || '');
    setSelectedProcessTypeId(nextProduct?.processTypes[0]?.typeId || '');
  };

  const handleOrderEntryChange = (value: OrderEntryType) => {
    setOrderEntryType(value);
    setActiveView('orderEntry');
    setIsOrderEntryDropdownOpen(false);
  };

  const handleSystemSwitch = (targetPath: string) => {
    setIsSystemSwitchOpen(false);
    navigate(targetPath);
  };

  const handleAddressRecognition = () => {
    if (!addressRecognitionText.trim()) {
      setAddressRecognitionError('请先输入完整地址信息');
      return;
    }

    setAddressRecognitionError('');
    showToast('地址识别已提交');
  };

  const assignSectionRef = (index: number, node: HTMLElement | null) => {
    sectionRefs.current[index] = node;
  };

  const handleSideMenuClick = (index: number) => {
    const targetSection = sectionRefs.current[index];
    setActiveSectionIndex(index);

    if (!targetSection) return;

    const targetTop = targetSection.getBoundingClientRect().top + window.scrollY - SECTION_SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
  };

  const resetOrderEntryForm = () => {
    certificateFormRef.current?.reset();
    deliveryFormRef.current?.reset();
    setBirthDate('');
    setInitialIssueDate('');
    setValidStartDate('');
    setValidityPeriod('6年');
    setCustomValidUntilDate('');
    setSelectedProvince('');
    setSelectedCity('');
    setDeliveryProvince('');
    setDeliveryCity('');
    setDeliveryDistrict('');
    setAddressRecognitionText('');
    setAddressRecognitionError('');
    setUseCountry('');
    setDomesticLicenseForm(createDomesticLicenseFormState());
    setUploadedCertificates({});
    setActiveSectionIndex(0);
    setSelectedProductId('');
    setSelectedProcessTypeId('');
    setSelectedLanguage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmSubmitOrder = async () => {
    if (isSubmittingOrder) {
      return;
    }

    const product = selectedProduct;
    if (!product) {
      showToast(`请先选择${orderEntryLabel}`);
      return;
    }

    const processType = selectedProcessType;
    if (!processType) {
      showToast('请先选择办理类型');
      return;
    }

    if (isDomesticLicenseEntry) {
      const missingMessage = (() => {
        if (!domesticLicenseForm.exchangeProvince || !domesticLicenseForm.exchangeCity) return '请选择换证城市';
        if (!domesticLicenseForm.foreignCountry || !domesticLicenseForm.foreignCity) return '请选择驾驶证发放国家及城市';
        if (!domesticLicenseForm.chineseName.trim()) return '请填写中文姓名';
        if (!domesticLicenseForm.frontPhoto) return '请上传驾照正面照片';
        if (!domesticLicenseForm.backPhoto) return '请上传驾照反面照片';
        return '';
      })();

      if (missingMessage) {
        showToast(missingMessage);
        return;
      }

      const deliveryData = deliveryFormRef.current ? new FormData(deliveryFormRef.current) : new FormData();
      const deliveryAddress =
        joinAddressSegments([
          deliveryProvince,
          deliveryCity,
          deliveryDistrict,
          readFormValue(deliveryData, 'deliveryAddress'),
        ]) ||
        addressRecognitionText.trim() ||
        '待补充';
      const currentTimestamp = formatBeijingTimestamp();
      const customerName = readFormValue(deliveryData, 'customerName') || domesticLicenseForm.chineseName.trim();
      setIsSubmittingOrder(true);
      const licenseNumber = domesticLicenseForm.licenseNumber.trim() || `DL${Date.now().toString().slice(-8)}`;
      let createdOrder: Order;
      const domesticLicenseInfo: DomesticLicenseInfo = {
        exchangeProvince: domesticLicenseForm.exchangeProvince,
        exchangeCity: domesticLicenseForm.exchangeCity,
        foreignCountry: domesticLicenseForm.foreignCountry,
        foreignCity: domesticLicenseForm.foreignCity,
        chineseName: domesticLicenseForm.chineseName.trim(),
        licenseNumber,
        expiryDate: domesticLicenseForm.expiryDate,
        surname: domesticLicenseForm.surname.trim(),
        givenName: domesticLicenseForm.givenName.trim(),
        birthDate: domesticLicenseForm.birthDate,
        rstr: domesticLicenseForm.rstr.trim(),
        sex: domesticLicenseForm.sex,
        hairColor: domesticLicenseForm.hairColor.trim(),
        eyeColor: domesticLicenseForm.eyeColor.trim(),
        height: domesticLicenseForm.height.trim(),
        weight: domesticLicenseForm.weight.trim(),
        issueDate: domesticLicenseForm.issueDate,
        fileNumber: domesticLicenseForm.fileNumber.trim(),
        classType: domesticLicenseForm.classType.trim(),
        endorsements: domesticLicenseForm.endorsements.trim(),
        restrictions: domesticLicenseForm.restrictions.trim(),
        other: domesticLicenseForm.other.trim(),
        frontPhoto: domesticLicenseForm.frontPhoto,
        backPhoto: domesticLicenseForm.backPhoto,
        passportPhoto: domesticLicenseForm.passportPhoto || undefined,
      };
      const storedDomesticLicenseInfo = await saveDomesticLicenseImages(
        domesticLicenseInfo,
        `domestic-license-${licenseNumber}-${Date.now()}`,
      );
      const nextOrder: OrderInput = {
        customerName,
        customerPhone: readFormValue(deliveryData, 'customerPhone') || '13800138000',
        customerPassport: licenseNumber,
        customerEmail: `agent-${Date.now()}@example.com`,
        productId: product.productId,
        productName: product.title,
        productCategory: product.category,
        processType: processType.name,
        processTypeId: processType.typeId,
        pushTimeliness: 'instant',
        channel: 'private',
        agentLevel: 'self',
        lockedPrice: getProcessTypePrice(processType),
        status: 'pending_review',
        deliveryAddress,
        logisticsCompany: '',
        trackingNumber: '',
        remark: '用户端提交',
        licenseName: domesticLicenseForm.chineseName.trim(),
        licenseNo: licenseNumber,
        licenseCategory: domesticLicenseForm.classType.trim(),
        licenseGender: domesticLicenseForm.sex,
        licenseNationality: domesticLicenseForm.foreignCountry,
        licenseBirthDate: domesticLicenseForm.birthDate,
        licenseAddress: joinAddressSegments([domesticLicenseForm.foreignCountry, domesticLicenseForm.foreignCity]),
        licenseFirstIssueDate: domesticLicenseForm.issueDate,
        licenseValidUntilDate: domesticLicenseForm.expiryDate,
        licenseArchiveNumber: domesticLicenseForm.fileNumber.trim(),
        licenseIssuingRegion: joinAddressSegments([domesticLicenseForm.exchangeProvince, domesticLicenseForm.exchangeCity]),
        useCountry: domesticLicenseForm.foreignCountry,
        domesticLicenseInfo: storedDomesticLicenseInfo,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
        logs: [
          {
            time: currentTimestamp,
            operator: '用户端',
            action: `订单创建：用户端${DOMESTIC_LICENSE_PRODUCT_TITLE}确认提交`,
          },
        ],
      };
      try {
        createdOrder = addOrder(nextOrder);
      } catch (error) {
        if (isStorageQuotaError(error)) {
          setIsSubmittingOrder(false);
          showToast('本地存储空间不足，请清理浏览器缓存后再试');
          return;
        } else {
          setIsSubmittingOrder(false);
          showToast('订单提交失败，请稍后再试');
          return;
        }
      }

      if (!createdOrder) {
        setIsSubmittingOrder(false);
        showToast('订单提交失败，请稍后再试');
        return;
      }

      setAllAgentOrders((orders) => [createdOrder, ...orders.filter((order) => order.orderId !== createdOrder.orderId)]);
      resetOrderEntryForm();
      showToast(`订单 ${createdOrder.orderId} 提交成功`);
      window.setTimeout(() => setIsSubmittingOrder(false), 700);
      return;
    }

    if (validityPeriod === '自定义' && !customValidUntilDate) {
      showToast('请选择终止日期');
      return;
    }

    if (!useCountry.trim()) {
      showToast('请选择使用国家');
      return;
    }

    const missingRequiredUpload = uploadItems.find((item) => item.required && !uploadedCertificates[item.key]?.src);
    if (missingRequiredUpload) {
      showToast(`请上传${missingRequiredUpload.title}`);
      return;
    }

    const certificateData = certificateFormRef.current ? new FormData(certificateFormRef.current) : new FormData();
    const deliveryData = deliveryFormRef.current ? new FormData(deliveryFormRef.current) : new FormData();
    const licenseName = readFormValue(certificateData, 'licenseName');
    const customerName = readFormValue(deliveryData, 'customerName') || licenseName || '代理客户';
    const licenseNo = readFormValue(certificateData, 'licenseNo') || `D${Date.now().toString().slice(-8)}`;
    const deliveryAddress =
      joinAddressSegments([
        deliveryProvince,
        deliveryCity,
        deliveryDistrict,
        readFormValue(deliveryData, 'deliveryAddress'),
      ]) ||
      addressRecognitionText.trim() ||
      '待补充';
    const licenseIssuingRegion = joinAddressSegments([selectedProvince, selectedCity]);
    const currentTimestamp = formatBeijingTimestamp();
    const language = selectedLanguage || getLanguageOptionsForProduct(product.title)[0] || '';
    setIsSubmittingOrder(true);
    const rawNotaryCertificateImages = Object.fromEntries(
      Object.entries(uploadedCertificates)
        .filter(([, item]) => Boolean(item.src))
        .map(([key, item]) => [key, item.src]),
    );
    let createdOrder: Order;
    try {
      const notaryCertificateImages = await saveNotaryCertificateImages(
        rawNotaryCertificateImages,
        `notary-certificate-${licenseNo}-${Date.now()}`,
      );

      createdOrder = addOrder({
        customerName,
        customerPhone: readFormValue(deliveryData, 'customerPhone') || '13800138000',
        customerPassport: licenseNo,
        customerEmail: `agent-${Date.now()}@example.com`,
        productId: product.productId,
        productName: product.category === 'notary' ? getNotaryOrderProductName(product.title) : product.title,
        productCategory: product.category,
        processType: processType.name,
        processTypeId: processType.typeId,
        pushTimeliness: 'instant',
        channel: 'private',
        agentLevel: 'self',
        lockedPrice: getProcessTypePrice(processType),
        status: 'pending_review',
        deliveryAddress,
        logisticsCompany: '',
        trackingNumber: '',
        remark: '用户端提交',
        licenseName: licenseName || customerName,
        licenseNo,
        licenseCategory: readFormValue(certificateData, 'licenseCategory') || 'C1',
        licenseGender: readFormValue(certificateData, 'gender') || '男',
        licenseNationality: readFormValue(certificateData, 'licenseNationality') || '中国/CHN',
        licenseBirthDate: birthDate,
        licenseAddress: readFormValue(certificateData, 'licenseAddress') || deliveryAddress,
        licenseArchiveNumber: readFormValue(certificateData, 'archiveNumber'),
        licenseBarcodeNumber: readFormValue(certificateData, 'barcodeNumber'),
        licenseFirstIssueDate: initialIssueDate,
        licenseValidFromDate: validStartDate,
        licenseValidUntilDate: validityPeriod === '自定义'
          ? customValidUntilDate
          : addYearsToDateValue(validStartDate, validityPeriod),
        licenseValidYears: validityPeriod,
        licenseIssuingAuthority: readFormValue(certificateData, 'licenseIssuingAuthority'),
        licenseIssuingRegion,
        notaryCertificateImages,
        language,
        useCountry: useCountry.trim(),
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
        logs: [
          {
            time: currentTimestamp,
            operator: '用户端',
            action: `订单创建：用户端${orderEntryLabel}确认提交`,
          },
        ],
      });
    } catch (error) {
      setIsSubmittingOrder(false);
      showToast(isStorageQuotaError(error) ? '本地存储空间不足，请清理浏览器缓存后再试' : '订单提交失败，请稍后再试');
      return;
    }

    setAllAgentOrders((orders) => [createdOrder, ...orders.filter((order) => order.orderId !== createdOrder.orderId)]);
    resetOrderEntryForm();
    showToast(`订单 ${createdOrder.orderId} 提交成功`);
    window.setTimeout(() => setIsSubmittingOrder(false), 700);
  };

  const handleResetOrderListFilters = () => {
    setOrderListStatus('');
    setOrderListProductIds([]);
    setOrderListKeyword('');
    setOrderListStartDate('');
    setOrderListEndDate('');
  };

  const handleToggleOrderListProduct = (productId: string) => {
    setOrderListProductIds((productIds) =>
      productIds.includes(productId)
        ? productIds.filter((item) => item !== productId)
        : [...productIds, productId],
    );
  };

  const handleCancelAgentOrder = (order: Order) => {
    if (!canCancelAgentOrder(order)) {
      showToast('仅待审核订单可取消');
      return;
    }

    const currentTimestamp = formatBeijingTimestamp();
    const nextOrder: Order = {
      ...order,
      status: 'cancelled',
      updatedAt: currentTimestamp,
      logs: [
        ...order.logs,
        {
          time: currentTimestamp,
          operator: '用户端',
          action: '取消订单',
        },
      ],
    };

    updateOrder(order.orderId, {
      status: nextOrder.status,
      updatedAt: nextOrder.updatedAt,
      logs: nextOrder.logs,
    });
    setAllAgentOrders((orders) => orders.map((item) => (item.orderId === order.orderId ? nextOrder : item)));
    setOrderDetailModalOrder((currentOrder) => (currentOrder?.orderId === order.orderId ? nextOrder : currentOrder));
    setLicenseInfoModalOrder((currentOrder) => (currentOrder?.orderId === order.orderId ? nextOrder : currentOrder));
    showToast(`订单 ${order.orderId} 已取消`);
  };

  const renderOrderDetailModal = () => {
    if (!orderDetailModalOrder) return null;

    const order = orderDetailModalOrder;
    const shouldShowNotaryFields = isNotaryOrder(order);
    const domesticInfo = order.domesticLicenseInfo;

    return (
      <div className="agent-modal-backdrop" role="presentation" onMouseDown={() => setOrderDetailModalOrder(null)}>
        <section
          className="agent-modal agent-order-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label="查看订单"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="agent-modal__header">
            <h2>订单详情</h2>
            <button type="button" className="agent-modal__close" onClick={() => setOrderDetailModalOrder(null)}>
              ×
            </button>
          </header>

          <div className="agent-modal__content">
            <div className="agent-modal__section agent-modal__section--plain">
              <h3>收货信息</h3>
              <div className="agent-modal__detail-grid agent-modal__detail-grid--two">
                <div className="agent-modal__detail-item">
                  <span>收件人：</span>
                  <strong>{order.customerName}</strong>
                </div>
                <div className="agent-modal__detail-item">
                  <span>联系电话：</span>
                  <strong>{order.customerPhone}</strong>
                </div>
                <div className="agent-modal__detail-item agent-modal__detail-item--wide">
                  <span>收货地址：</span>
                  <strong>{order.deliveryAddress}</strong>
                </div>
              </div>
            </div>

            <div className="agent-modal__section agent-modal__section--plain">
              <h3>商品信息</h3>
              <div className="agent-modal__detail-grid agent-modal__detail-grid--two">
                <div className="agent-modal__detail-item">
                  <span>订单编号：</span>
                  <strong>{order.orderId}</strong>
                </div>
                <div className="agent-modal__detail-item">
                  <span>商品名称：</span>
                  <strong>{order.productName}</strong>
                </div>
                {shouldShowNotaryFields && (
                  <div className="agent-modal__detail-item">
                    <span>使用国家：</span>
                    <strong>{order.useCountry || '待补充'}</strong>
                  </div>
                )}
                <div className="agent-modal__detail-item">
                  <span>办理类型：</span>
                  <strong>{order.processType || '正常办理'}</strong>
                </div>
                <div className="agent-modal__detail-item">
                  <span>价格：</span>
                  <strong className="agent-modal__price">{formatCurrency(order.lockedPrice)}</strong>
                </div>
              </div>
            </div>

            <div className="agent-modal__section agent-modal__section--plain">
              <h3>驾照信息</h3>
              <div className="agent-modal__detail-grid agent-modal__detail-grid--three">
                <div className="agent-modal__detail-item">
                  <span>{domesticInfo ? '中文姓名：' : '姓名：'}</span>
                  <strong>{domesticInfo?.chineseName || order.licenseName || order.customerName}</strong>
                </div>
                <div className="agent-modal__detail-item">
                  <span>准驾车型：</span>
                  <strong>{domesticInfo?.classType || order.licenseCategory || 'C1'}</strong>
                </div>
                {domesticInfo && (
                  <>
                    <div className="agent-modal__detail-item">
                      <span>换证城市：</span>
                      <strong>{getDomesticExchangeCity(order) || '-'}</strong>
                    </div>
                    <div className="agent-modal__detail-item agent-modal__detail-item--wide">
                      <span>驾驶证发放国家及城市：</span>
                      <strong>{getDomesticForeignLocation(order) || '-'}</strong>
                    </div>
                    <div className="agent-modal__detail-item">
                      <span>DL/驾驶证编号：</span>
                      <strong>{domesticInfo.licenseNumber || order.licenseNo || order.customerPassport}</strong>
                    </div>
                    <div className="agent-modal__detail-item">
                      <span>有效期至：</span>
                      <strong>{domesticInfo.expiryDate || '-'}</strong>
                    </div>
                  </>
                )}
                {!domesticInfo && (
                  <div className="agent-modal__detail-item">
                    <span>驾照编号：</span>
                    <strong>{order.licenseNo || order.customerPassport}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="agent-modal__section agent-modal__section--plain">
              <h3>订单状态</h3>
              <div className="agent-modal__status-grid">
                <div>
                  <span>订单状态：</span>
                  <strong className={getAgentOrderStatusClassName(order.status)}>
                    {getAgentOrderStatusLabel(order.status)}
                  </strong>
                </div>
                <div>
                  <span>下单时间：</span>
                  <strong>{order.createdAt.replace('T', ' ').slice(0, 19)}</strong>
                </div>
                <div>
                  <span>办理类型：</span>
                  <strong className="agent-modal__static-pill">{order.processType || '正常办理'}</strong>
                </div>
              </div>
            </div>
          </div>

          <footer className="agent-modal__footer">
            <button type="button" className="agent-modal__button" onClick={() => setOrderDetailModalOrder(null)}>
              关闭弹窗
            </button>
          </footer>
        </section>
      </div>
    );
  };

  const renderLicenseInfoModal = () => {
    if (!licenseInfoModalOrder) return null;

    const order = licenseInfoModalOrder;
    const domesticInfo = order.domesticLicenseInfo;
    const domesticLicensePhotoItems = domesticInfo
      ? [
          { label: '驾照正面照片', src: domesticInfo.frontPhoto },
          { label: '驾照反面照片', src: domesticInfo.backPhoto },
          ...(domesticInfo.passportPhoto ? [{ label: '护照', src: domesticInfo.passportPhoto }] : []),
        ]
      : [];
    const notaryAttachmentPhotoItems = domesticInfo ? [] : getNotaryAttachmentPhotoItems(order);
    const domesticLicenseFieldItems: Array<[string, string | undefined]> = domesticInfo
      ? [
          ['中文姓名', domesticInfo.chineseName || order.licenseName || order.customerName],
          ['换证城市', getDomesticExchangeCity(order)],
          ['驾驶证发放国家及城市', getDomesticForeignLocation(order)],
          ['DL/驾驶证编号', domesticInfo.licenseNumber || order.licenseNo || order.customerPassport],
          ['EXP/有效期至', domesticInfo.expiryDate],
          ['LN/姓', domesticInfo.surname],
          ['FN/名', domesticInfo.givenName],
          ['DOB/出生日期', domesticInfo.birthDate],
          ['RSTR/限制条件', domesticInfo.rstr],
          ['SEX/性别', domesticInfo.sex],
          ['HAIR/头发颜色', domesticInfo.hairColor],
          ['EYES/眼睛', domesticInfo.eyeColor],
          ['HGT/身高', domesticInfo.height],
          ['WGT/体重', domesticInfo.weight],
          ['ISS/签发日期', domesticInfo.issueDate],
          ['DD/文件识别号', domesticInfo.fileNumber],
          ['CLASS/准驾车型', domesticInfo.classType || order.licenseCategory],
          ['ENDORSEMENTS/额外准驾车型', domesticInfo.endorsements],
          ['RESTRICTIONS/限制条件', domesticInfo.restrictions],
          ['其他', domesticInfo.other],
        ]
      : [];

    return (
      <div className="agent-modal-backdrop" role="presentation" onMouseDown={() => setLicenseInfoModalOrder(null)}>
        <section
          className="agent-modal agent-license-modal"
          role="dialog"
          aria-modal="true"
          aria-label="驾照信息"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="agent-modal__header">
            <h2>驾照信息</h2>
            <button type="button" className="agent-modal__close" onClick={() => setLicenseInfoModalOrder(null)}>
              ×
            </button>
          </header>

          <div className="agent-modal__content">
            <div className="agent-license-modal__layout">
              <section className={`agent-license-modal__panel ${domesticInfo ? '' : 'agent-license-modal__panel--full'}`.trim()}>
                <h3>驾照信息</h3>
                <div className="agent-license-modal__fields">
                  {domesticInfo ? (
                    <>
                      {domesticLicenseFieldItems.map(([label, value]) => (
                        <div key={label}>
                          <span>{label}：</span>
                          <strong>{value || '-'}</strong>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div><span>驾证号码：</span><strong>{order.licenseNo || order.customerPassport}</strong></div>
                      <div><span>姓名：</span><strong>{order.licenseName || order.customerName}</strong></div>
                      <div><span>姓氏拼音：</span><strong>{order.idpSurnameEn || '-'}</strong></div>
                      <div><span>名字拼音：</span><strong>{order.idpGivenNameEn || '-'}</strong></div>
                      <div><span>性别：</span><strong>{order.licenseGender || '-'}</strong></div>
                      <div><span>国籍：</span><strong>{order.licenseNationality || '-'}</strong></div>
                      <div><span>出生日期：</span><strong>{order.licenseBirthDate || '-'}</strong></div>
                      <div><span>驾照地址详情：</span><strong>{order.licenseAddress || '-'}</strong></div>
                      <div><span>准驾车型：</span><strong>{order.licenseCategory || 'C1'}</strong></div>
                      <div><span>档案编号：</span><strong>{order.licenseArchiveNumber || '-'}</strong></div>
                      <div><span>条形码：</span><strong>{order.licenseBarcodeNumber || '-'}</strong></div>
                      <div><span>初次领证日期：</span><strong>{order.licenseFirstIssueDate || '-'}</strong></div>
                      <div><span>有效起始日期：</span><strong>{order.licenseValidFromDate || '-'}</strong></div>
                      <div><span>有效年限：</span><strong>{order.licenseValidYears || '-'}</strong></div>
                      <div><span>发证地区(省市)：</span><strong>{order.licenseIssuingRegion || '-'}</strong></div>
                      <div><span>发证机构：</span><strong>{order.licenseIssuingAuthority || '-'}</strong></div>
                    </>
                  )}
                </div>
                {!domesticInfo && (
                  <div className="agent-license-modal__attachments" aria-label="驾驶证证件照片">
                    <h4>驾驶证证件照片</h4>
                    {notaryAttachmentPhotoItems.length > 0 ? (
                      <div className="agent-license-modal__attachment-grid">
                        {notaryAttachmentPhotoItems.map((item) => (
                          <figure key={item.key} className="agent-license-modal__attachment">
                            <figcaption>{item.label}</figcaption>
                            <div>
                              <ResolvedImage src={item.src} alt={item.label} />
                            </div>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <div className="agent-license-modal__attachments-empty">暂无上传附件</div>
                    )}
                  </div>
                )}
              </section>

              {domesticInfo && (
              <section className="agent-license-modal__panel">
                <h3>驾照证件照片</h3>
                <div className="agent-license-modal__photos">
                  {domesticLicensePhotoItems.map((item) => (
                    <figure key={item.label} className="agent-license-modal__photo">
                      <figcaption>{item.label}</figcaption>
                      <div>
                        <ResolvedImage src={item.src} alt={item.label} />
                      </div>
                    </figure>
                  ))}
                </div>
              </section>
              )}
            </div>
          </div>

          <footer className="agent-modal__footer">
            <button type="button" className="agent-modal__button" onClick={() => setLicenseInfoModalOrder(null)}>
              关闭弹窗
            </button>
          </footer>
        </section>
      </div>
    );
  };

  const renderOrderListView = () => (
    <div className="agent-order-list-view animate-fadeIn">
      <section className="agent-order-list-card">
        <h1 className="agent-order-list-title">订单列表</h1>

        <div className="agent-order-list-filters">
          <div className="agent-order-list-field agent-order-list-field--product">
            <span>产品名称</span>
            <div
              ref={orderProductFilterRef}
              className={`agent-product-multi-select ${isOrderProductFilterOpen ? 'agent-product-multi-select--open' : ''}`}
            >
              <button
                type="button"
                className="agent-product-multi-select__trigger"
                onClick={() => setIsOrderProductFilterOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOrderProductFilterOpen}
              >
                <span>
                  {selectedOrderListProductNames.length > 0
                    ? selectedOrderListProductNames.join('、')
                    : '选择产品（可多选）'}
                </span>
                <span aria-hidden="true">⌄</span>
              </button>
              {isOrderProductFilterOpen && (
                <div className="agent-product-multi-select__menu" role="listbox" aria-label="产品名称">
                  {orderListProducts.map((product) => (
                    <label key={product.productId} className="agent-product-multi-select__option">
                      <input
                        type="checkbox"
                        checked={orderListProductIds.includes(product.productId)}
                        onChange={() => handleToggleOrderListProduct(product.productId)}
                      />
                      <span>{product.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="agent-order-list-field agent-order-list-field--keyword">
            <span>精准搜索</span>
            <input
              value={orderListKeyword}
              onChange={(event) => setOrderListKeyword(event.target.value)}
              placeholder="订单号、快递单号、姓名……"
            />
          </label>

          <label className="agent-order-list-field agent-order-list-field--date">
            <span>创建时间</span>
            <div className="agent-order-list-range">
              <input type="date" value={orderListStartDate} onChange={(event) => setOrderListStartDate(event.target.value)} />
              <span>—</span>
              <input type="date" value={orderListEndDate} onChange={(event) => setOrderListEndDate(event.target.value)} />
            </div>
          </label>
        </div>

        <div className="agent-order-list-actions">
          <button type="button" className="agent-order-list-button agent-order-list-button--primary">
            搜索
          </button>
          <button type="button" className="agent-order-list-button" onClick={handleResetOrderListFilters}>
            重置
          </button>
          <button type="button" className="agent-order-list-button">
            导出
            <span className="agent-order-list-button__arrow" aria-hidden="true">⌄</span>
          </button>
        </div>

        <div className="agent-order-list-tabs">
          {agentOrderStatusTabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              className={`agent-order-list-tab ${orderListStatus === tab.value ? 'agent-order-list-tab--active' : ''}`}
              onClick={() => setOrderListStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="agent-order-table-wrap">
          <table className="agent-order-table">
            <thead>
              <tr>
                <th>下单时间</th>
                <th>产品信息</th>
                <th>驾照信息</th>
                <th>订单状态</th>
                <th>订单记录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAgentOrders.map((order) => {
                const productionRecords = getProductionOrderRecords(order);
                const shouldShowNotaryFields = isNotaryOrder(order);
                const domesticInfo = order.domesticLicenseInfo;
                const agentOrderStatus = getAgentOrderStatus(order.status);
                const shouldShowShippingInfo =
                  agentOrderStatus === 'shipped' && Boolean(order.logisticsCompany || order.trackingNumber);

                return (
                  <tr key={order.orderId}>
                    <td className="agent-order-table__time">
                      <div>{order.createdAt.replace('T', ' ').slice(0, 19)}</div>
                      <div className="agent-order-table__id">{order.orderId}</div>
                    </td>
                    <td>
                      <div className="agent-order-table__product-head">
                        <span className="agent-order-table__product-name">{order.productName}</span>
                        {shouldShowNotaryFields && order.language && (
                          <span className="agent-order-table__language-pill">{order.language}</span>
                        )}
                      </div>
                      <div className="agent-order-table__meta agent-order-table__product-meta">
                        <div>
                          <span>收件人</span>
                          <strong>{order.customerName}</strong>
                        </div>
                        <div>
                          <span>手机</span>
                          <strong>{order.customerPhone}</strong>
                        </div>
                        <div>
                          <span>收货地址</span>
                          <strong>{order.deliveryAddress}</strong>
                        </div>
                        <div className="agent-order-table__product-process">
                          <span className="agent-order-table__process-pill">{order.processType || '正常办理'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="agent-order-table__meta agent-order-table__license-meta">
                        <div>
                          <span>准驾车型</span>
                          <strong>{domesticInfo?.classType || order.licenseCategory || 'C1'}</strong>
                        </div>
                        <div>
                          <span>{domesticInfo ? '中文姓名' : '姓名'}</span>
                          <strong>{domesticInfo?.chineseName || order.licenseName || order.customerName}</strong>
                        </div>
                        <div>
                          <span>驾照编号</span>
                          <strong>{domesticInfo?.licenseNumber || order.licenseNo || order.customerPassport}</strong>
                        </div>
                        {domesticInfo && (
                          <>
                            <div>
                              <span>换证城市</span>
                              <strong>{getDomesticExchangeCity(order) || '-'}</strong>
                            </div>
                            <div>
                              <span>驾驶证发放国家及城市</span>
                              <strong>{getDomesticForeignLocation(order) || '-'}</strong>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={getAgentOrderStatusClassName(order.status)}>
                        {getAgentOrderStatusLabel(order.status)}
                      </span>
                      {shouldShowShippingInfo && (
                        <div className="agent-order-status__shipping">
                          <span>{order.logisticsCompany || '物流已发出'}</span>
                          <span>{order.trackingNumber || '--'}</span>
                        </div>
                      )}
                    </td>
                    <td className="agent-order-table__record">
                      {productionRecords.map((record) => (
                        <div key={record}>{record}</div>
                      ))}
                    </td>
                    <td>
                      <div className="agent-order-table__actions">
                        <button type="button" onClick={() => setOrderDetailModalOrder(order)}>
                          查看订单
                        </button>
                        <button type="button" onClick={() => setLicenseInfoModalOrder(order)}>
                          驾照信息
                        </button>
                        {canCancelAgentOrder(order) && (
                          <button type="button" onClick={() => handleCancelAgentOrder(order)}>
                            取消订单
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="agent-order-pagination" aria-label="订单分页">
          <span>
            共 {filteredAgentOrders.length} 条，每页 {ORDER_LIST_PAGE_SIZE} 条
          </span>
          <div className="agent-order-pagination__controls">
            <button
              type="button"
              disabled={orderListPage <= 1}
              onClick={() => setOrderListPage((page) => Math.max(1, page - 1))}
            >
              上一页
            </button>
            {Array.from({ length: orderListPageCount }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={orderListPage === page ? 'agent-order-pagination__page--active' : ''}
                onClick={() => setOrderListPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={orderListPage >= orderListPageCount}
              onClick={() => setOrderListPage((page) => Math.min(orderListPageCount, page + 1))}
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="agent-system-page">
      {toast && (
        <div className="toast-container">
          <div className="toast toast--info">{toast}</div>
        </div>
      )}
      {renderOrderDetailModal()}
      {renderLicenseInfoModal()}

      <header className="agent-system-header">
        <div className="agent-system-header__brand" aria-label="美卡认证用户端">
          <span className="agent-system-logo">MK</span>
          <strong>美卡认证用户端</strong>
        </div>

        <nav className="agent-system-nav" aria-label="系统导航">
          {['首页', '下单入口', '商户中心', '订单列表', '产品资料', '商户资料'].map((item) => (
            item === '下单入口' ? (
              <div
                key={item}
                ref={orderEntryDropdownRef}
                className={`agent-system-nav__dropdown ${isOrderEntryDropdownOpen ? 'agent-system-nav__dropdown--open' : ''}`}
              >
                <button
                  type="button"
                  className={`agent-system-nav__dropdown-trigger ${activeView === 'orderEntry' ? 'agent-system-nav__dropdown-trigger--active' : ''}`}
                  onClick={() => setIsOrderEntryDropdownOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isOrderEntryDropdownOpen}
                >
                  下单入口
                  <span className="agent-system-nav__dropdown-arrow" aria-hidden="true">⌄</span>
                </button>

                {isOrderEntryDropdownOpen && (
                  <div className="agent-system-nav__dropdown-menu" role="menu" aria-label="下单入口">
                    {orderEntryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`agent-system-nav__dropdown-item ${orderEntryType === option.value ? 'agent-system-nav__dropdown-item--active' : ''}`}
                        onClick={() => handleOrderEntryChange(option.value)}
                        role="menuitem"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={item}
                type="button"
                className={`agent-system-nav__item ${item === '订单列表' && activeView === 'orderList' ? 'agent-system-nav__item--active' : ''}`}
                onClick={() => {
                  if (item === '订单列表') {
                    setActiveView('orderList');
                    return;
                  }

                  if (item === '首页') {
                    setActiveView('orderEntry');
                  }
                }}
              >
                {item}
              </button>
            )
          ))}
        </nav>

        <div
          ref={systemSwitchRef}
          className={`agent-system-switch ${isSystemSwitchOpen ? 'agent-system-switch--open' : ''}`}
        >
          <button
            type="button"
            className="agent-system-switch__trigger"
            onClick={() => setIsSystemSwitchOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isSystemSwitchOpen}
          >
            切换系统
            <span aria-hidden="true">⌄</span>
          </button>
          {isSystemSwitchOpen && (
            <div className="agent-system-switch__menu" role="menu" aria-label="切换系统">
              <button type="button" role="menuitem" onClick={() => handleSystemSwitch('/')}>
                切换管理端
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSystemSwitch('/license-officer/orders/chinese-translation')}
              >
                切换生产端
              </button>
            </div>
          )}
        </div>
      </header>

      {activeView === 'orderList' ? (
        renderOrderListView()
      ) : (
        <div className="agent-system-shell">
          <aside className="agent-system-sidebar">
            {sideMenuItems.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`agent-system-sidebar__item ${activeSectionIndex === index ? 'agent-system-sidebar__item--active' : ''}`}
                aria-current={activeSectionIndex === index ? 'true' : undefined}
                onClick={() => handleSideMenuClick(index)}
              >
                {item}
              </button>
            ))}
          </aside>

          <main className="agent-order-main animate-fadeIn">
          <section ref={(node) => assignSectionRef(0, node)} className="agent-panel agent-product-panel">
            <div className="agent-panel__title">选择产品</div>
            <div className="agent-product-stack">
              <label className="agent-field agent-field--wide">
                <span>选择产品</span>
                <select
                  value={selectedProductId}
                  disabled={activeProducts.length === 0}
                  onChange={(event) => handleProductChange(event.target.value)}
                >
                  <option value="">请选择</option>
                  {activeProducts.length === 0 ? (
                    <option value="">暂无在售产品</option>
                  ) : (
                    activeProducts.map((product) => (
                      <option key={product.productId} value={product.productId}>
                        {product.title}
                      </option>
                    ))
                  )}
                </select>
              </label>
              {isDomesticLicenseEntry ? (
                <>
                  <div className="agent-field agent-field--wide">
                    <span>换证城市 <em className="agent-required">*</em></span>
                    <div className="agent-region-selects">
                      <select
                        value={domesticLicenseForm.exchangeProvince}
                        onChange={(event) =>
                          updateDomesticLicenseForm({ exchangeProvince: event.target.value, exchangeCity: '' })
                        }
                      >
                        <option value="" disabled>请选择省份</option>
                        {provinceCityOptions.map((item) => (
                          <option key={item.province} value={item.province}>
                            {item.province}
                          </option>
                        ))}
                      </select>
                      <select
                        value={domesticLicenseForm.exchangeCity}
                        disabled={!domesticLicenseForm.exchangeProvince}
                        onChange={(event) => updateDomesticLicenseForm({ exchangeCity: event.target.value })}
                      >
                        <option value="" disabled>请选择城市</option>
                        {domesticExchangeCityOptions.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="agent-field agent-field--wide">
                    <span>驾驶证发放国家及城市 <em className="agent-required">*</em></span>
                    <div className="agent-region-selects">
                      <select
                        value={domesticLicenseForm.foreignCountry}
                        onChange={(event) =>
                          updateDomesticLicenseForm({ foreignCountry: event.target.value, foreignCity: '' })
                        }
                      >
                        <option value="" disabled>请选择国家</option>
                        {domesticLicenseForeignLocationOptions.map((item) => (
                          <option key={item.country} value={item.country}>
                            {item.country}
                          </option>
                        ))}
                      </select>
                      <select
                        value={domesticLicenseForm.foreignCity}
                        disabled={!domesticLicenseForm.foreignCountry}
                        onChange={(event) => updateDomesticLicenseForm({ foreignCity: event.target.value })}
                      >
                        <option value="" disabled>请选择城市/州</option>
                        {domesticForeignCityOptions.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="agent-field agent-field--wide">
                    <span>中文姓名 <em className="agent-required">*</em></span>
                    <input
                      value={domesticLicenseForm.chineseName}
                      placeholder="请输入最终翻译件体现的中文姓名"
                      onChange={(event) => updateDomesticLicenseForm({ chineseName: event.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="agent-field agent-field--wide agent-field--radio">
                    <span>语言选择</span>
                    <div className="agent-radio-group agent-language-group" aria-label="语言选择">
                      {languageOptions.length > 0 ? (
                        languageOptions.map((language) => (
                          <label key={language}>
                            <input
                              type="radio"
                              name="language"
                              value={language}
                              checked={selectedLanguage === language}
                              onChange={(event) => setSelectedLanguage(event.target.value)}
                            />
                            {language}
                          </label>
                        ))
                      ) : (
                        <span className="agent-empty-hint">请先选择产品</span>
                      )}
                    </div>
                  </div>
                  <label className="agent-field agent-field--wide">
                    <span>使用国家 <em className="agent-required">*</em></span>
                    <input
                      value={useCountry}
                      placeholder="请输入使用国家"
                      onChange={(event) => setUseCountry(event.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
          </section>

          <section ref={(node) => assignSectionRef(1, node)} className="agent-panel">
            <div className="agent-panel__title">确认驾照信息</div>
            <div className="agent-certificate-layout">
              {isDomesticLicenseEntry ? (
                <>
                  <form className="agent-form-grid agent-form-grid--domestic">
                    <label className="agent-field">
                      <span>DL/驾驶证编号</span>
                      <input
                        value={domesticLicenseForm.licenseNumber}
                        placeholder="请输入驾驶证编号"
                        onChange={(event) => updateDomesticLicenseForm({ licenseNumber: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>EXP/有效期至</span>
                      <DatePickerInput
                        ariaLabel="有效期至"
                        placeholder="请选择有效期"
                        value={domesticLicenseForm.expiryDate}
                        onChange={(value) => updateDomesticLicenseForm({ expiryDate: value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>LN/姓</span>
                      <input
                        value={domesticLicenseForm.surname}
                        placeholder="请输入姓"
                        onChange={(event) => updateDomesticLicenseForm({ surname: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>FN/名</span>
                      <input
                        value={domesticLicenseForm.givenName}
                        placeholder="请输入名"
                        onChange={(event) => updateDomesticLicenseForm({ givenName: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>DOB/出生日期</span>
                      <DatePickerInput
                        ariaLabel="出生日期"
                        placeholder="请选择出生日期"
                        value={domesticLicenseForm.birthDate}
                        onChange={(value) => updateDomesticLicenseForm({ birthDate: value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>RSTR/限制条件</span>
                      <input
                        value={domesticLicenseForm.rstr}
                        placeholder="请输入限制条件"
                        onChange={(event) => updateDomesticLicenseForm({ rstr: event.target.value })}
                      />
                    </label>
                    <div className="agent-field agent-field--radio">
                      <span>SEX/性别</span>
                      <div className="agent-radio-group">
                        {['男', '女'].map((sex) => (
                          <label key={sex}>
                            <input
                              type="radio"
                              name="domestic-sex"
                              value={sex}
                              checked={domesticLicenseForm.sex === sex}
                              onChange={(event) => updateDomesticLicenseForm({ sex: event.target.value })}
                            />
                            {sex}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="agent-field">
                      <span>HAIR/头发颜色</span>
                      <select
                        value={domesticLicenseForm.hairColor}
                        onChange={(event) => updateDomesticLicenseForm({ hairColor: event.target.value })}
                      >
                        <option value="">请选择头发颜色</option>
                        {['黑色', '棕色', '金色', '灰色', '红色', '其他'].map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    </label>
                    <label className="agent-field">
                      <span>EYES/眼睛</span>
                      <select
                        value={domesticLicenseForm.eyeColor}
                        onChange={(event) => updateDomesticLicenseForm({ eyeColor: event.target.value })}
                      >
                        <option value="">请选择眼睛颜色</option>
                        {['黑色', '棕色', '蓝色', '绿色', '灰色', '其他'].map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    </label>
                    <label className="agent-field">
                      <span>HGT/身高</span>
                      <input
                        value={domesticLicenseForm.height}
                        placeholder="例如 170cm / 5-08"
                        onChange={(event) => updateDomesticLicenseForm({ height: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>WGT/体重</span>
                      <input
                        value={domesticLicenseForm.weight}
                        placeholder="例如 65kg / 145lb"
                        onChange={(event) => updateDomesticLicenseForm({ weight: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>ISS/签发日期</span>
                      <DatePickerInput
                        ariaLabel="签发日期"
                        placeholder="请选择签发日期"
                        value={domesticLicenseForm.issueDate}
                        onChange={(value) => updateDomesticLicenseForm({ issueDate: value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>DD/文件识别号</span>
                      <input
                        value={domesticLicenseForm.fileNumber}
                        placeholder="请输入文件识别号"
                        onChange={(event) => updateDomesticLicenseForm({ fileNumber: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>CLASS/准驾车型</span>
                      <input
                        value={domesticLicenseForm.classType}
                        placeholder="请输入准驾车型"
                        onChange={(event) => updateDomesticLicenseForm({ classType: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>ENDORSEMENTS/额外准驾车型</span>
                      <input
                        value={domesticLicenseForm.endorsements}
                        placeholder="请输入额外准驾车型"
                        onChange={(event) => updateDomesticLicenseForm({ endorsements: event.target.value })}
                      />
                    </label>
                    <label className="agent-field">
                      <span>RESTRICTIONS/限制条件</span>
                      <input
                        value={domesticLicenseForm.restrictions}
                        placeholder="请输入限制条件"
                        onChange={(event) => updateDomesticLicenseForm({ restrictions: event.target.value })}
                      />
                    </label>
                    <label className="agent-field agent-field--textarea">
                      <span>其他</span>
                      <textarea
                        value={domesticLicenseForm.other}
                        placeholder="请输入其他需要体现在翻译件中的信息"
                        onChange={(event) => updateDomesticLicenseForm({ other: event.target.value })}
                      />
                    </label>
                    <div className="agent-form-actions agent-form-actions--compact">
                      <button type="button" className="agent-button agent-button--primary" onClick={() => showToast('驾照信息已确认')}>
                        确认驾照信息
                      </button>
                    </div>
                  </form>

                  <div className="agent-upload-board" aria-label="上传附件">
                    <div className="agent-upload-board__title">上传相关证件</div>
                    <div className="agent-upload-grid">
                      {domesticLicenseAttachmentFields.map((item) => {
                        const previewSrc = domesticLicenseForm[item.key];
                        const fileName = domesticLicenseForm[item.nameKey];

                        return (
                          <label
                            key={item.key}
                            className={`agent-upload-card agent-upload-card--green ${previewSrc ? 'agent-upload-card--filled' : ''}`}
                          >
                            {previewSrc ? (
                              <span className="agent-upload-card__preview">
                                <img src={previewSrc} alt={`${item.label}预览`} />
                              </span>
                            ) : (
                              <span className="agent-upload-card__icon">+</span>
                            )}
                            <span className="agent-upload-card__label">
                              {item.label}
                              {item.required && <em className="agent-required">*</em>}
                            </span>
                            <small>{fileName || (previewSrc ? '点击更换图片' : '点击上传图片')}</small>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="agent-upload-card__input"
                              onChange={(event) => {
                                void handleDomesticLicenseFileChange(item.key, item.nameKey, event.target.files?.[0] || null);
                                event.target.value = '';
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
              <form ref={certificateFormRef} className="agent-form-grid">
                <label className="agent-field">
                  <span>驾驶证号码</span>
                  <input name="licenseNo" placeholder="请输入驾驶证号码" />
                </label>
                <label className="agent-field">
                  <span>姓名</span>
                  <input name="licenseName" placeholder="请输入姓名" />
                </label>
                <label className="agent-field">
                  <span>姓氏拼音</span>
                  <input name="idpSurnameEn" placeholder="姓氏拼音" />
                </label>
                <label className="agent-field">
                  <span>名字拼音</span>
                  <input name="idpGivenNameEn" placeholder="名字拼音" />
                </label>
                <div className="agent-field agent-field--radio">
                  <span>性别</span>
                  <div className="agent-radio-group">
                    <label><input type="radio" name="gender" value="男" defaultChecked /> 男</label>
                    <label><input type="radio" name="gender" value="女" /> 女</label>
                  </div>
                </div>
                <label className="agent-field">
                  <span>国籍</span>
                  <input name="licenseNationality" placeholder="国籍" />
                </label>
                <label className="agent-field">
                  <span>出生日期</span>
                  <DatePickerInput
                    ariaLabel="出生日期"
                    placeholder="请选择出生日期"
                    value={birthDate}
                    onChange={setBirthDate}
                  />
                </label>
                <label className="agent-field">
                  <span>驾照地址详情</span>
                  <textarea name="licenseAddress" placeholder="请输入驾照地址详情" />
                </label>
                <label className="agent-field">
                  <span>准驾车型</span>
                  <input name="licenseCategory" placeholder="请输入准驾车型" />
                </label>
                <label className="agent-field">
                  <span>档案编号 <em className="agent-required">*</em></span>
                  <input name="archiveNumber" placeholder="档案编号（宣誓翻译或公证需要填写）" />
                </label>
                <label className="agent-field">
                  <span>条形码 <em className="agent-required">*</em></span>
                  <input name="barcodeNumber" placeholder="条形码（宣誓翻译或公证需要填写）" />
                </label>
                <label className="agent-field">
                  <span>初次领证日期</span>
                  <DatePickerInput
                    ariaLabel="初次领证日期"
                    placeholder="请选择初次领证日期"
                    value={initialIssueDate}
                    onChange={setInitialIssueDate}
                  />
                </label>
                <label className="agent-field">
                  <span>有效起始日期</span>
                  <DatePickerInput
                    ariaLabel="有效起始日期"
                    placeholder="请选择效起始日期"
                    value={validStartDate}
                    onChange={setValidStartDate}
                  />
                </label>
                <div className="agent-field agent-field--radio">
                  <span>有效期</span>
                  <div className="agent-validity-options" aria-label="有效期">
                    {validityPeriods.map((period) => (
                      <button
                        key={period}
                        type="button"
                        className={`agent-choice-button ${validityPeriod === period ? 'agent-choice-button--active' : ''}`}
                        onClick={() => setValidityPeriod(period)}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
                {validityPeriod === '自定义' && (
                  <label className="agent-field agent-field--validity-end">
                    <span>终止日期</span>
                    <DatePickerInput
                      ariaLabel="终止日期"
                      placeholder="请选择终止日期"
                      value={customValidUntilDate}
                      onChange={setCustomValidUntilDate}
                    />
                  </label>
                )}
                <div className="agent-field">
                  <span>发证地区 <em className="agent-required">*</em></span>
                  <div className="agent-region-selects">
                    <select value={selectedProvince} onChange={(event) => setSelectedProvince(event.target.value)}>
                      <option value="" disabled>请选择省份</option>
                      {provinceCityOptions.map((item) => (
                        <option key={item.province} value={item.province}>
                          {item.province}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedCity}
                      disabled={!selectedProvince}
                      onChange={(event) => setSelectedCity(event.target.value)}
                    >
                      <option value="" disabled>请选择城市</option>
                      {cityOptions.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="agent-field">
                  <span>发证机构</span>
                  <select name="licenseIssuingAuthority" defaultValue="">
                    <option value="" disabled>请选择发证机构</option>
                    {LICENSE_ISSUING_AUTHORITY_OPTIONS.map((authority) => (
                      <option key={authority} value={authority}>
                        {authority}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="agent-form-actions agent-form-actions--compact">
                  <button type="button" className="agent-button agent-button--primary" onClick={() => showToast('驾照信息已确认')}>
                    确认驾照信息
                  </button>
                </div>
              </form>

              <div className="agent-upload-board" aria-label="上传材料">
                <div className="agent-upload-board__title">上传相关附件</div>
                <div className="agent-upload-grid">
                  {uploadItems.map((item) => {
                    const uploadedItem = uploadedCertificates[item.key];

                    return (
                      <label
                        key={item.key}
                        className={`agent-upload-card agent-upload-card--${item.tone} ${uploadedItem ? 'agent-upload-card--filled' : ''}`}
                      >
                        {uploadedItem ? (
                          <span className="agent-upload-card__preview">
                            <img src={uploadedItem.src} alt={`${item.title}预览`} />
                          </span>
                        ) : (
                          <span className="agent-upload-card__icon">+</span>
                        )}
                        <span className="agent-upload-card__label">
                          {item.title}
                          {item.required && <em className="agent-required">*</em>}
                          {item.optional && <em className="agent-optional">选填</em>}
                        </span>
                        <small>{uploadedItem?.name || (uploadedItem ? '点击更换图片' : '点击上传图片')}</small>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="agent-upload-card__input"
                          onChange={(event) => {
                            void handleCertificateFileChange(item.key, item.title, event.target.files?.[0] || null);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
                </>
              )}
            </div>
          </section>

          <section ref={(node) => assignSectionRef(2, node)} className="agent-panel agent-delivery-panel">
            <div className="agent-panel__title">确认收货信息</div>
            <form ref={deliveryFormRef} className="agent-delivery-form">
              <div className="agent-field">
                <span>地址信息</span>
                <div className="agent-delivery-region-selects">
                  <select value={deliveryProvince} onChange={(event) => setDeliveryProvince(event.target.value)}>
                    <option value="" disabled>请选择省份</option>
                    {deliveryRegionOptions.map((item) => (
                      <option key={item.province} value={item.province}>
                        {item.province}
                      </option>
                    ))}
                  </select>
                  <select
                    value={deliveryCity}
                    disabled={!deliveryProvince}
                    onChange={(event) => setDeliveryCity(event.target.value)}
                  >
                    <option value="" disabled>请选择城市</option>
                    {deliveryCityOptions.map((item) => (
                      <option key={item.city} value={item.city}>
                        {item.city}
                      </option>
                    ))}
                  </select>
                  <select
                    value={deliveryDistrict}
                    disabled={!deliveryCity}
                    onChange={(event) => setDeliveryDistrict(event.target.value)}
                  >
                    <option value="" disabled>请选择区县</option>
                    {deliveryDistrictOptions.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="agent-field agent-field--textarea">
                <span>详细地址</span>
                <textarea name="deliveryAddress" placeholder="请填写详细地址" />
              </label>
              <label className="agent-field">
                <span>收货人姓名</span>
                <input name="customerName" placeholder="请填写收货人姓名" />
              </label>
              <label className="agent-field">
                <span>手机号码</span>
                <input name="customerPhone" placeholder="请填写手机号" />
              </label>
              <div className="agent-form-actions agent-form-actions--compact">
                <button type="button" className="agent-button agent-button--primary" onClick={() => showToast('收货信息已确认')}>
                  确认收货信息
                </button>
              </div>
            </form>

            <div className="agent-address-recognition">
              <div className="agent-address-recognition__inner">
                <label className="agent-field agent-field--textarea">
                  <span>地址识别</span>
                  <textarea
                    value={addressRecognitionText}
                    placeholder={'请输入完整地址信息，如：北京市朝阳区xxx街道xxx号 姓名 电话'}
                    onChange={(event) => {
                      setAddressRecognitionText(event.target.value);
                      if (addressRecognitionError) {
                        setAddressRecognitionError('');
                      }
                    }}
                  />
                </label>
              </div>
              {addressRecognitionError && <div className="agent-address-error">{addressRecognitionError}</div>}
              <button type="button" className="agent-button agent-button--primary" onClick={handleAddressRecognition}>
                地址识别
              </button>
            </div>
          </section>

          <section ref={(node) => assignSectionRef(3, node)} className="agent-panel">
            <div className="agent-panel__title">选择办理类型</div>
            <div className="agent-package-grid">
              {selectedProduct ? (
                selectedProduct.processTypes.map((processType) => (
                  <button
                    key={processType.typeId}
                    type="button"
                    className={`agent-package-card ${selectedProcessTypeId === processType.typeId ? 'agent-package-card--active' : ''}`}
                    onClick={() => setSelectedProcessTypeId(processType.typeId)}
                  >
                    <strong>¥{getProcessTypePrice(processType)}</strong>
                    <span>{processType.name}</span>
                    <small>{processType.description || `约 ${processType.estimatedDays} 个工作日`}</small>
                  </button>
                ))
              ) : (
                <div className="agent-panel-empty">请先选择驾照翻译认证产品</div>
              )}
            </div>
          </section>

          <section ref={(node) => assignSectionRef(4, node)} className="agent-panel agent-checkout-panel">
            <div className="agent-checkout-heading">
              <span>提交订单</span>
            </div>

            <div className="agent-checkout-summary">
              <div className="agent-checkout-summary__row">
                <span>产品费用</span>
                <strong>{formatCurrency(selectedProcessTypePrice)}</strong>
              </div>
              <div className="agent-checkout-summary__row">
                <span>当前余额</span>
                <strong>{formatCurrency(AGENT_ACCOUNT_BALANCE)}</strong>
              </div>
              <div className="agent-checkout-summary__row agent-checkout-summary__row--total">
                <span>支付后余额</span>
                <strong>{formatCurrency(balanceAfterPayment, 2)}</strong>
              </div>
            </div>

            <div className="agent-checkout-submit">
              <div className="agent-checkout-actions">
                <button
                  type="button"
                  className="agent-checkout-action agent-checkout-action--confirm"
                  disabled={isSubmittingOrder}
                  onClick={handleConfirmSubmitOrder}
                >
                  <span aria-hidden="true">✓</span>
                  {isSubmittingOrder ? '提交中...' : '确认提交订单'}
                </button>
              </div>
              <div className="agent-checkout-tip">
                <span aria-hidden="true">i</span>
                提交前请确认所有信息无误，提交后将无法修改
              </div>
            </div>
          </section>
          </main>
        </div>
      )}
    </div>
  );
};

export default AgentSystemPage;
