import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addOrder, getProducts } from '../../services/mockDataService';
import type { ProductProcessType } from '../../shared/types';
import { formatBeijingTimestamp } from '../../shared/utils/dateTime';
import './AgentSystemPage.css';

type ValidityPeriod = '6年' | '10年' | '60年' | '长期';

const sideMenuItems = ['选择产品', '确认驾照信息', '确认收货信息', '选择办理类型', '提交订单'];
const SECTION_SCROLL_OFFSET = 78;

const SINGLE_CERTIFICATE_LANGUAGES = ['英语', '法语', '西班牙语', '意大利语', '德语'];
const DOUBLE_CERTIFICATE_LANGUAGES = ['英语', '意大利语'];

const getLanguageOptionsForProduct = (productTitle = '') => {
  const compactTitle = productTitle.replace(/\s+/g, '');

  if (!compactTitle) {
    return [];
  }

  if (compactTitle.includes('公证双号') || compactTitle.includes('公证海牙双号')) {
    return DOUBLE_CERTIFICATE_LANGUAGES;
  }

  return SINGLE_CERTIFICATE_LANGUAGES;
};

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

const validityPeriods: ValidityPeriod[] = ['6年', '10年', '60年', '长期'];

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

const issuingAuthorityOptions = [
  '公安局交通管理局',
  '公安局交通警察支队',
  '公安局交通警察总队',
  '公安局公安交通管理局',
  '公安局交通管理支队',
  '公安局交通警察巡逻支队',
];

const getProcessTypePrice = (processType: ProductProcessType | null) =>
  processType?.pricing.find((item) => item.agentLevel === 'self')?.price ?? processType?.pricing[0]?.price ?? 0;

const AGENT_ACCOUNT_BALANCE = 28304;
const NOTARY_ORDER_MANAGEMENT_PENDING_REVIEW_PATH = '/order-management/notary-orders?status=pending_review';

const formatCurrency = (value: number, fractionDigits?: number) => {
  const fixedDigits = typeof fractionDigits === 'number' ? fractionDigits : Number.isInteger(value) ? 0 : 2;
  return `¥${value.toFixed(fixedDigits)}`;
};

interface DateInputProps {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

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

const addYearsToDateValue = (dateValue: string, validityPeriod: ValidityPeriod) => {
  if (!dateValue || validityPeriod === '长期') {
    return '';
  }

  const validityYears = Number(validityPeriod.replace(/\D/g, ''));
  const [year, month, day] = dateValue.split('-').map(Number);

  if (!Number.isFinite(validityYears) || !year || !month || !day) {
    return '';
  }

  return formatDateValue(new Date(year + validityYears, month - 1, day));
};

const parseDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : null;
};

const isSameDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const buildCalendarDays = (monthDate: Date) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
};

const DateInput: React.FC<DateInputProps> = ({ ariaLabel, placeholder, value, onChange }) => {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || new Date());
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectDate = (date: Date) => {
    onChange(formatDateValue(date));
    setIsOpen(false);
  };

  return (
    <div ref={pickerRef} className="agent-date-field">
      <button
        type="button"
        className={`agent-date-trigger ${isOpen ? 'agent-date-trigger--open' : ''} ${value ? '' : 'agent-date-trigger--empty'}`}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="agent-date-trigger__value">{value || placeholder}</span>
        <span className="agent-date-trigger__icon" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="agent-date-picker" role="dialog" aria-label={`${ariaLabel}日期选择`}>
          <div className="agent-date-picker__header">
            <div className="agent-date-picker__nav">
              <button type="button" onClick={() => moveMonth(-12)} aria-label="上一年">«</button>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="上个月">‹</button>
            </div>
            <strong>{visibleMonth.getFullYear()} 年&nbsp;&nbsp;{visibleMonth.getMonth() + 1} 月</strong>
            <div className="agent-date-picker__nav">
              <button type="button" onClick={() => moveMonth(1)} aria-label="下个月">›</button>
              <button type="button" onClick={() => moveMonth(12)} aria-label="下一年">»</button>
            </div>
          </div>

          <div className="agent-date-picker__week">
            {['日', '一', '二', '三', '四', '五', '六'].map((weekDay) => (
              <span key={weekDay}>{weekDay}</span>
            ))}
          </div>

          <div className="agent-date-picker__days">
            {calendarDays.map((date) => {
              const currentMonth = date.getMonth() === visibleMonth.getMonth();
              const selected = selectedDate ? isSameDate(date, selectedDate) : false;
              const currentDay = isSameDate(date, today);

              return (
                <button
                  key={formatDateValue(date)}
                  type="button"
                  className={[
                    'agent-date-picker__day',
                    currentMonth ? '' : 'agent-date-picker__day--muted',
                    selected ? 'agent-date-picker__day--selected' : '',
                    currentDay && !selected ? 'agent-date-picker__day--today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const AgentSystemPage: React.FC = () => {
  const navigate = useNavigate();
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  const certificateFormRef = useRef<HTMLFormElement | null>(null);
  const deliveryFormRef = useRef<HTMLFormElement | null>(null);
  const notaryProducts = useMemo(
    () =>
      getProducts()
        .filter((product) => product.category === 'notary' && product.status === 'active')
        .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, 'zh-CN')),
    [],
  );
  const [selectedProductId, setSelectedProductId] = useState(() => notaryProducts[0]?.productId || '');
  const [selectedProcessTypeId, setSelectedProcessTypeId] = useState(() => notaryProducts[0]?.processTypes[0]?.typeId || '');
  const selectedProduct = useMemo(
    () => notaryProducts.find((product) => product.productId === selectedProductId) || null,
    [notaryProducts, selectedProductId],
  );
  const languageOptions = useMemo(() => getLanguageOptionsForProduct(selectedProduct?.title), [selectedProduct?.title]);
  const [selectedLanguage, setSelectedLanguage] = useState(() => languageOptions[0] || '');
  const selectedProcessType = useMemo(
    () => selectedProduct?.processTypes.find((processType) => processType.typeId === selectedProcessTypeId) || null,
    [selectedProduct?.processTypes, selectedProcessTypeId],
  );
  const selectedProcessTypePrice = getProcessTypePrice(selectedProcessType);
  const balanceAfterPayment = AGENT_ACCOUNT_BALANCE - selectedProcessTypePrice;
  const [validityPeriod, setValidityPeriod] = useState<ValidityPeriod>('6年');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
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
  const [toast, setToast] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  useEffect(() => {
    if (selectedLanguage && !languageOptions.includes(selectedLanguage)) {
      setSelectedLanguage('');
    }
  }, [languageOptions, selectedLanguage]);

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
    const nextProduct = notaryProducts.find((product) => product.productId === value) || null;

    setSelectedProductId(value);
    setSelectedLanguage(getLanguageOptionsForProduct(nextProduct?.title)[0] || '');
    setSelectedProcessTypeId(nextProduct?.processTypes[0]?.typeId || '');
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

  const handleConfirmSubmitOrder = () => {
    if (isSubmittingOrder) {
      return;
    }

    const product = selectedProduct || notaryProducts[0] || null;
    if (!product) {
      showToast('暂无可提交的公证产品');
      return;
    }

    const processType = selectedProcessType || product.processTypes[0] || null;
    if (!processType) {
      showToast('请先配置办理类型');
      return;
    }

    const certificateData = certificateFormRef.current ? new FormData(certificateFormRef.current) : new FormData();
    const deliveryData = deliveryFormRef.current ? new FormData(deliveryFormRef.current) : new FormData();
    const licenseName = readFormValue(certificateData, 'licenseName');
    const customerName = readFormValue(deliveryData, 'customerName') || licenseName || '代理客户';
    const licenseNo = readFormValue(certificateData, 'licenseNo') || `D${Date.now().toString().slice(-8)}`;
    const deliveryAddress =
      joinAddressSegments([
        readFormValue(deliveryData, 'deliveryRegion'),
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
      productName: getNotaryOrderProductName(product.title),
      productCategory: 'notary',
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
      licenseFirstIssueDate: initialIssueDate,
      licenseValidFromDate: validStartDate,
      licenseValidUntilDate: addYearsToDateValue(validStartDate, validityPeriod),
      licenseValidYears: validityPeriod,
      licenseIssuingAuthority: readFormValue(certificateData, 'licenseIssuingAuthority'),
      licenseIssuingRegion,
      language,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
      logs: [
        {
          time: currentTimestamp,
          operator: '代理端',
          action: '订单创建：代理端确认提交',
        },
      ],
    });

    setIsSubmittingOrder(true);
    showToast(`订单 ${createdOrder.orderId} 已进入公证订单管理`);
    window.setTimeout(() => navigate(NOTARY_ORDER_MANAGEMENT_PENDING_REVIEW_PATH), 700);
  };

  return (
    <div className="agent-system-page">
      {toast && (
        <div className="toast-container">
          <div className="toast toast--info">{toast}</div>
        </div>
      )}

      <header className="agent-system-header">
        <div className="agent-system-header__brand" aria-label="美卡认证代理平台-录单">
          <span className="agent-system-logo">MK</span>
          <strong>美卡认证代理平台-录单</strong>
        </div>

        <nav className="agent-system-nav" aria-label="系统导航">
          {['首页', '下单入口', '订单中心', '公证业务', '产品列表', '账户中心'].map((item) => (
            <button
              key={item}
              type="button"
              className={`agent-system-nav__item ${item === '下单入口' ? 'agent-system-nav__item--active' : ''}`}
            >
              {item}
            </button>
          ))}
        </nav>

        <button type="button" className="agent-system-header__back" onClick={() => navigate('/')}>
          返回后台
        </button>
      </header>

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
                <span>选择驾照翻译认证产品</span>
                <select
                  value={selectedProductId}
                  disabled={notaryProducts.length === 0}
                  onChange={(event) => handleProductChange(event.target.value)}
                >
                  <option value="">请选择产品</option>
                  {notaryProducts.length === 0 ? (
                    <option value="">暂无在售公证产品</option>
                  ) : (
                    notaryProducts.map((product) => (
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
                  <DateInput
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
                  <DateInput
                    ariaLabel="初次领证日期"
                    placeholder="请选择初次领证日期"
                    value={initialIssueDate}
                    onChange={setInitialIssueDate}
                  />
                </label>
                <label className="agent-field">
                  <span>有效起始日期</span>
                  <DateInput
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
                    {issuingAuthorityOptions.map((authority) => (
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
              <label className="agent-field">
                <span>地址信息</span>
                <select name="deliveryRegion" defaultValue="">
                  <option value="" disabled>请选择省/市/区</option>
                  <option value="广西壮族自治区 南宁市 青秀区">广西壮族自治区 / 南宁市 / 青秀区</option>
                  <option value="上海市 上海市 浦东新区">上海市 / 上海市 / 浦东新区</option>
                  <option value="广东省 广州市 天河区">广东省 / 广州市 / 天河区</option>
                </select>
              </label>
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
                <button type="button" className="agent-checkout-action agent-checkout-action--blue" onClick={() => showToast('外事办委托书已导出')}>
                  <span aria-hidden="true">▧</span>
                  导出外事办委托书
                </button>
                <button type="button" className="agent-checkout-action agent-checkout-action--green" onClick={() => showToast('北部湾委托书已导出')}>
                  <span aria-hidden="true">▧</span>
                  导出北部湾委托书
                </button>
                <button type="button" className="agent-checkout-action agent-checkout-action--pink" onClick={() => showToast('张江委托书已导出')}>
                  <span aria-hidden="true">▧</span>
                  导出张江委托书
                </button>
                <button type="button" className="agent-checkout-action agent-checkout-action--gray" onClick={() => showToast('图片 PDF 已导出')}>
                  <span aria-hidden="true">↓</span>
                  导出图片为PDF
                </button>
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
    </div>
  );
};

export default AgentSystemPage;
