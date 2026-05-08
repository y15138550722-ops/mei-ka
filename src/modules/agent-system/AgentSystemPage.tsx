import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addOrder, getOrders, getProducts } from '../../services/mockDataService';
import type { Order, OrderStatus, ProductProcessType } from '../../shared/types';
import { LICENSE_ISSUING_AUTHORITY_OPTIONS } from '../../shared/config/licenseIssuingAuthority';
import { orderPreviewAssets } from '../../shared/config/orderPreviewAssets';
import DatePickerInput from '../../shared/components/form/DatePickerInput';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import { getLanguageOptionsForProduct } from '../../shared/utils/notaryLanguageOptions';
import './AgentSystemPage.css';

type ValidityPeriod = '6年' | '10年' | '60年' | '长期' | '自定义';
type OrderEntryType = 'notary' | 'domesticLicenseTranslation';
type AgentPageView = 'orderEntry' | 'orderList';
type AgentOrderStatusTab = '' | 'pending_review' | 'pending_production' | 'shipped' | 'cancelled';

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

const uploadItems = [
  { title: '驾照正面照片', tone: 'green' },
  { title: '驾照反面照片', tone: 'green' },
  { title: '驾照副页正面照片', tone: 'green' },
  { title: '驾照副页反面照片', tone: 'green' },
  { title: '身份证正面', tone: 'blue' },
  { title: '身份证反面', tone: 'blue' },
  { title: '电子驾照', tone: 'blue' },
  { title: '电子签名', tone: 'plain' },
];

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

const PRODUCTION_RECORD_KEYWORDS = ['翻译', '制作', '制作完成', '发货', '物流', '生产端'];
const NON_PRODUCTION_RECORD_KEYWORDS = ['公证处', '送审', '审核', '驳回', '拒绝', '接收', '待审核'];

const getProductionOrderRecords = (order: Order) => {
  const matchedLogs = order.logs.filter((log) => {
    const logText = `${log.operator} ${log.action}`;
    const isProductionEvent = PRODUCTION_RECORD_KEYWORDS.some((keyword) => logText.includes(keyword));
    const isNotaryOrAuditEvent = NON_PRODUCTION_RECORD_KEYWORDS.some((keyword) => logText.includes(keyword));

    return isProductionEvent && !isNotaryOrAuditEvent;
  });

  if (matchedLogs.length > 0) {
    return matchedLogs.map((log) => `${log.time.slice(0, 16)} ${log.action}`);
  }

  const status = getAgentOrderStatus(order.status);

  if (status === 'shipped') {
    return [
      `发货：${order.logisticsCompany || '已发货'}${order.trackingNumber ? ` ${order.trackingNumber}` : ''}`,
    ];
  }

  return [];
};

const isAgentSubmittedOrder = (order: Order) =>
  order.remark === '代理端提交' ||
  order.logs.some((log) => log.operator === '代理端' || log.action.includes('代理端'));

const isNotaryOrder = (order: Order) => order.productCategory === 'notary';

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
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const certificateFormRef = useRef<HTMLFormElement | null>(null);
  const deliveryFormRef = useRef<HTMLFormElement | null>(null);
  const [activeView, setActiveView] = useState<AgentPageView>(() => getInitialAgentPageView());
  const [orderEntryType, setOrderEntryType] = useState<OrderEntryType>('notary');
  const [isOrderEntryDropdownOpen, setIsOrderEntryDropdownOpen] = useState(false);
  const [orderListStatus, setOrderListStatus] = useState<AgentOrderStatusTab>('');
  const [orderListProductIds, setOrderListProductIds] = useState<string[]>([]);
  const [isOrderProductFilterOpen, setIsOrderProductFilterOpen] = useState(false);
  const [orderListKeyword, setOrderListKeyword] = useState('');
  const [orderListStartDate, setOrderListStartDate] = useState('');
  const [orderListEndDate, setOrderListEndDate] = useState('');
  const [orderListPage, setOrderListPage] = useState(1);
  const orderEntryLabel = orderEntryOptions.find((item) => item.value === orderEntryType)?.label || '公证产品下单';
  const orderListProducts = useMemo(
    () =>
      getProducts()
        .filter((product) => product.status === 'active')
        .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, 'zh-CN')),
    [],
  );
  const activeProducts = useMemo(() => {
    const activeCategory = orderEntryType === 'notary' ? 'notary' : 'translation';

    return getProducts()
      .filter((product) => product.category === activeCategory && product.status === 'active')
      .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, 'zh-CN'));
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
          order.trackingNumber,
          order.deliveryAddress,
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
    setActiveSectionIndex(0);
    setSelectedProductId('');
    setSelectedProcessTypeId('');
    setSelectedLanguage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmSubmitOrder = () => {
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

    if (validityPeriod === '自定义' && !customValidUntilDate) {
      showToast('请选择终止日期');
      return;
    }

    if (!useCountry.trim()) {
      showToast('请选择使用国家');
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
    const createdOrder = addOrder({
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
      remark: '代理端提交',
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
      language,
      useCountry: useCountry.trim(),
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
      logs: [
        {
          time: currentTimestamp,
          operator: '代理端',
          action: `订单创建：代理端${orderEntryLabel}确认提交`,
        },
      ],
    });

    setIsSubmittingOrder(true);
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

  const renderOrderDetailModal = () => {
    if (!orderDetailModalOrder) return null;

    const order = orderDetailModalOrder;
    const shouldShowNotaryFields = isNotaryOrder(order);

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
                  <span>驾证号码：</span>
                  <strong>{order.licenseNo || order.customerPassport}</strong>
                </div>
                <div className="agent-modal__detail-item">
                  <span>姓名：</span>
                  <strong>{order.licenseName || order.customerName}</strong>
                </div>
                <div className="agent-modal__detail-item">
                  <span>准驾车型：</span>
                  <strong>{order.licenseCategory || 'C1'}</strong>
                </div>
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
    const licensePhotoItems = [
      { label: '驾照正面', src: orderPreviewAssets.licenseFront },
      { label: '驾照反面', src: orderPreviewAssets.licenseBack },
      { label: '驾照副页正面照片', src: orderPreviewAssets.extraFront },
      { label: '驾照副页反面照片', src: orderPreviewAssets.extraBack },
    ];

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
              <section className="agent-license-modal__panel">
                <h3>驾照信息</h3>
                <div className="agent-license-modal__fields">
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
                </div>
              </section>

              <section className="agent-license-modal__panel">
                <h3>驾照证件照片</h3>
                <div className="agent-license-modal__photos">
                  {licensePhotoItems.map((item) => (
                    <figure key={item.label} className="agent-license-modal__photo">
                      <figcaption>{item.label}</figcaption>
                      <div>
                        <img src={item.src} alt={item.label} />
                      </div>
                    </figure>
                  ))}
                </div>
              </section>
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
                      <div className="agent-order-table__meta">
                        收件人：{order.customerName}
                        <br />
                        手机：{order.customerPhone}
                        <br />
                        收货地址：{order.deliveryAddress}
                        <br />
                        办理类型：
                        <span className="agent-order-table__process-pill">{order.processType || '正常办理'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="agent-order-table__meta">
                        准驾车型：{order.licenseCategory || 'C1'}
                        <br />
                        姓名：{order.licenseName || order.customerName}
                        <br />
                        驾照号：{order.licenseNo || order.customerPassport}
                      </div>
                    </td>
                    <td>
                      <span className={getAgentOrderStatusClassName(order.status)}>
                        {getAgentOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="agent-order-table__record">
                      {productionRecords.length > 0 ? (
                        productionRecords.map((record) => (
                          <div key={record}>{record}</div>
                        ))
                      ) : (
                        <span className="agent-order-table__record-empty">暂无生产端事件</span>
                      )}
                    </td>
                    <td>
                      <div className="agent-order-table__actions">
                        <button type="button" onClick={() => setOrderDetailModalOrder(order)}>
                          查看订单
                        </button>
                        <button type="button" onClick={() => setLicenseInfoModalOrder(order)}>
                          驾照信息
                        </button>
                        {getAgentOrderStatus(order.status) === 'pending_review' && (
                          <button type="button" onClick={() => showToast('取消订单入口已打开')}>
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
        <div className="agent-system-header__brand" aria-label="美卡认证代理平台-用户端">
          <span className="agent-system-logo">MK</span>
          <strong>美卡认证代理平台-用户端</strong>
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

        <button type="button" className="agent-system-header__back" onClick={() => navigate('/')}>
          返回后台
        </button>
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
            <div className="agent-panel__title">选择产品 - {orderEntryLabel}</div>
            <div className="agent-product-stack">
              <label className="agent-field agent-field--wide">
                <span>选择{orderEntryLabel}</span>
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
            </div>
          </section>

          <section ref={(node) => assignSectionRef(1, node)} className="agent-panel">
            <div className="agent-panel__title">确认驾照信息</div>
            <div className="agent-certificate-layout">
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
                <div className="agent-upload-board__title">上传相关证件</div>
                <div className="agent-upload-grid">
                  {uploadItems.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className={`agent-upload-card agent-upload-card--${item.tone}`}
                      onClick={() => showToast(`${item.title}上传入口已打开`)}
                    >
                      <span className="agent-upload-card__icon">+</span>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
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
