export type KlookOrderStatus = 'pending_review' | 'pending_production' | 'shipped' | 'cancelled';

export type KlookOrderLog = {
  time: string;
  operator: string;
  action: string;
};

export interface KlookOrder {
  orderId: string;
  createdAt: string;
  updatedAt: string;
  productName: string;
  processType: string;
  agentName: string;
  driverName: string;
  driverNameLatin: string;
  licenseNumber: string;
  licenseType: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  status: KlookOrderStatus;
  orderRecordLabel?: string;
  orderRecordAt?: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  lockedPrice?: number;
  rejectReason?: string;
  remark?: string;
  logs: KlookOrderLog[];
}

const STORAGE_KEY = 'meika-klook-orders';
const DEFAULT_LOCKED_PRICE = 289;

const DEFAULT_KLOOK_ORDERS: KlookOrder[] = [
  {
    orderId: 'A87143',
    createdAt: '2026-04-16 10:00:12',
    updatedAt: '2026-04-16 10:00:12',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '沈英杰',
    driverNameLatin: 'SHENYINGJIE',
    licenseNumber: '340321199211208918',
    licenseType: 'C1',
    recipientName: '沈英杰',
    recipientPhone: '18837177196',
    deliveryAddress: '河南郑州二七区二七万达3号院',
    status: 'pending_review',
    logs: [],
  },
  {
    orderId: 'A87001',
    createdAt: '2026-04-15 11:48:23',
    updatedAt: '2026-04-16 10:10:31',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '罗耽',
    driverNameLatin: 'LUODAN',
    licenseNumber: '420203197309153735',
    licenseType: 'C1',
    recipientName: '罗耽',
    recipientPhone: '17673622220',
    deliveryAddress: '湖南省长沙市天心区卢浮原著59栋503室',
    status: 'pending_production',
    orderRecordLabel: '已翻译',
    orderRecordAt: '2026-04-16 10:10:31',
    logisticsCompany: '顺丰速运',
    trackingNumber: 'SF1039281022001',
    logs: [],
  },
  {
    orderId: 'A86901',
    createdAt: '2026-04-14 21:23:01',
    updatedAt: '2026-04-15 09:55:04',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '长谷川冰',
    driverNameLatin: 'HASEGAWAHYO',
    licenseNumber: 'JPN310070082400',
    licenseType: 'C1',
    recipientName: '长谷川冰',
    recipientPhone: '18616870981',
    deliveryAddress: '上海市黄浦区大沽路186弄2号楼14楼15A01室',
    status: 'pending_production',
    orderRecordLabel: '已翻译',
    orderRecordAt: '2026-04-15 09:55:04',
    logisticsCompany: '顺丰速运',
    trackingNumber: 'SF1039281022002',
    logs: [],
  },
  {
    orderId: 'A86780',
    createdAt: '2026-04-13 09:22:48',
    updatedAt: '2026-04-14 18:22:10',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '加急办理-顺丰配送',
    agentName: 'klook',
    driverName: '赵安',
    driverNameLatin: 'ZHAOAN',
    licenseNumber: '110101198903125612',
    licenseType: 'C2',
    recipientName: '赵安',
    recipientPhone: '13910883276',
    deliveryAddress: '北京市朝阳区三里屯街道幸福里北街8号楼2单元1201',
    status: 'shipped',
    orderRecordLabel: '已发货',
    orderRecordAt: '2026-04-14 18:22:10',
    logisticsCompany: '顺丰速运',
    trackingNumber: 'SF1039281022003',
    logs: [],
  },
  {
    orderId: 'A86542',
    createdAt: '2026-04-12 16:40:05',
    updatedAt: '2026-04-12 18:05:31',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '周启',
    driverNameLatin: 'ZHOUQI',
    licenseNumber: '320311199412068274',
    licenseType: 'C1',
    recipientName: '周启',
    recipientPhone: '15002176328',
    deliveryAddress: '江苏省无锡市梁溪区解放东路901号金鼎广场B座1608',
    status: 'cancelled',
    orderRecordLabel: '已取消',
    orderRecordAt: '2026-04-12 18:05:31',
    logs: [],
  },
  {
    orderId: 'A86403',
    createdAt: '2026-04-11 08:16:47',
    updatedAt: '2026-04-11 08:16:47',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '林淇',
    driverNameLatin: 'LINQI',
    licenseNumber: '440106199508103245',
    licenseType: 'C1',
    recipientName: '林淇',
    recipientPhone: '13800210036',
    deliveryAddress: '广东省广州市天河区体育西路191号中石化大厦A座2307',
    status: 'pending_review',
    logs: [],
  },
  {
    orderId: 'A86327',
    createdAt: '2026-04-10 19:36:14',
    updatedAt: '2026-04-10 19:36:14',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '许然',
    driverNameLatin: 'XURAN',
    licenseNumber: '330106199604182117',
    licenseType: 'C1',
    recipientName: '许然',
    recipientPhone: '13758192014',
    deliveryAddress: '浙江省杭州市西湖区文三路478号华星时代广场1幢1006室',
    status: 'pending_review',
    logs: [],
  },
  {
    orderId: 'A86218',
    createdAt: '2026-04-10 11:08:32',
    updatedAt: '2026-04-10 11:08:32',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '优先办理-加急配送',
    agentName: 'klook',
    driverName: '白露',
    driverNameLatin: 'BAILU',
    licenseNumber: '510107199302146428',
    licenseType: 'C2',
    recipientName: '白露',
    recipientPhone: '13608137745',
    deliveryAddress: '四川省成都市武侯区天府二街139号绿地之窗3栋802室',
    status: 'pending_review',
    logs: [],
  },
  {
    orderId: 'A86105',
    createdAt: '2026-04-09 17:22:50',
    updatedAt: '2026-04-10 09:42:18',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '优先办理-普通配送',
    agentName: 'klook',
    driverName: '韩澈',
    driverNameLatin: 'HANCHE',
    licenseNumber: '210102198811103516',
    licenseType: 'C1',
    recipientName: '韩澈',
    recipientPhone: '13940116728',
    deliveryAddress: '辽宁省沈阳市和平区青年大街286号华润大厦B座1509室',
    status: 'pending_production',
    orderRecordLabel: '已翻译',
    orderRecordAt: '2026-04-10 09:42:18',
    logs: [],
  },
  {
    orderId: 'A86074',
    createdAt: '2026-04-09 08:54:11',
    updatedAt: '2026-04-09 14:18:42',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '加急办理',
    agentName: 'klook',
    driverName: '唐沫',
    driverNameLatin: 'TANGMO',
    licenseNumber: '500112199707256341',
    licenseType: 'C2',
    recipientName: '唐沫',
    recipientPhone: '18680753126',
    deliveryAddress: '重庆市渝北区洪湖西路24号金科中心1栋1203室',
    status: 'pending_production',
    orderRecordLabel: '已翻译',
    orderRecordAt: '2026-04-09 14:18:42',
    logs: [],
  },
  {
    orderId: 'A85963',
    createdAt: '2026-04-08 20:15:39',
    updatedAt: '2026-04-09 16:33:19',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-普通配送',
    agentName: 'klook',
    driverName: '郑川',
    driverNameLatin: 'ZHENGCHUAN',
    licenseNumber: '350203199105071225',
    licenseType: 'C1',
    recipientName: '郑川',
    recipientPhone: '15859210347',
    deliveryAddress: '福建省厦门市思明区湖滨东路319号人才中心大厦A座1108室',
    status: 'shipped',
    orderRecordLabel: '已发货',
    orderRecordAt: '2026-04-09 16:33:19',
    logisticsCompany: '圆通速递',
    trackingNumber: 'YT5938402716458',
    logs: [],
  },
  {
    orderId: 'A85841',
    createdAt: '2026-04-08 13:41:02',
    updatedAt: '2026-04-09 11:06:28',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '优先办理-加急配送',
    agentName: 'klook',
    driverName: '梁秋',
    driverNameLatin: 'LIANGQIU',
    licenseNumber: '420111199512260818',
    licenseType: 'C1',
    recipientName: '梁秋',
    recipientPhone: '18571569324',
    deliveryAddress: '湖北省武汉市洪山区珞喻路889号光谷国际广场2座908室',
    status: 'shipped',
    orderRecordLabel: '已发货',
    orderRecordAt: '2026-04-09 11:06:28',
    logisticsCompany: '京东物流',
    trackingNumber: 'JDVA34821900612',
    logs: [],
  },
  {
    orderId: 'A85720',
    createdAt: '2026-04-07 16:27:44',
    updatedAt: '2026-04-08 10:14:56',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '优先办理-普通配送',
    agentName: 'klook',
    driverName: '宋时',
    driverNameLatin: 'SONGSHI',
    licenseNumber: '120103199001052319',
    licenseType: 'C1',
    recipientName: '宋时',
    recipientPhone: '13820276190',
    deliveryAddress: '天津市河西区解放南路256号创展大厦1205室',
    status: 'cancelled',
    orderRecordLabel: '已取消',
    orderRecordAt: '2026-04-08 10:14:56',
    logs: [],
  },
  {
    orderId: 'A85618',
    createdAt: '2026-04-07 09:12:17',
    updatedAt: '2026-04-07 09:12:17',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '加急办理',
    agentName: 'klook',
    driverName: '顾衡',
    driverNameLatin: 'GUHENG',
    licenseNumber: '610104199409031458',
    licenseType: 'C2',
    recipientName: '顾衡',
    recipientPhone: '13991862345',
    deliveryAddress: '陕西省西安市碑林区南关正街88号长安国际中心5层',
    status: 'pending_review',
    logs: [],
  },
  {
    orderId: 'A85509',
    createdAt: '2026-04-06 18:05:53',
    updatedAt: '2026-04-07 13:24:31',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '正常办理-加急配送',
    agentName: 'klook',
    driverName: '叶清',
    driverNameLatin: 'YEQING',
    licenseNumber: '430103199811224976',
    licenseType: 'C1',
    recipientName: '叶清',
    recipientPhone: '15111089273',
    deliveryAddress: '湖南省长沙市开福区芙蓉中路一段198号名富中心1602室',
    status: 'pending_production',
    orderRecordLabel: '已翻译',
    orderRecordAt: '2026-04-07 13:24:31',
    logs: [],
  },
  {
    orderId: 'A85466',
    createdAt: '2026-04-06 10:46:20',
    updatedAt: '2026-04-06 18:52:07',
    productName: '驾照翻译国际认证件（小白本）',
    processType: '加急办理',
    agentName: 'klook',
    driverName: '何知远',
    driverNameLatin: 'HEZHIYUAN',
    licenseNumber: '320505199303286712',
    licenseType: 'C1',
    recipientName: '何知远',
    recipientPhone: '18962147850',
    deliveryAddress: '江苏省苏州市姑苏区人民路3188号万达广场写字楼B座1701室',
    status: 'shipped',
    orderRecordLabel: '已发货',
    orderRecordAt: '2026-04-06 18:52:07',
    logisticsCompany: '顺丰速运',
    trackingNumber: 'SF1039281022014',
    logs: [],
  },
];

const cloneKlookOrderLog = (log: KlookOrderLog): KlookOrderLog => ({ ...log });

const buildDefaultLogs = (order: Omit<KlookOrder, 'logs'>): KlookOrderLog[] => {
  const logs: KlookOrderLog[] = [
    {
      time: order.createdAt,
      operator: '系统',
      action: '订单创建',
    },
  ];

  if (order.orderRecordLabel && order.orderRecordAt) {
    logs.push({
      time: order.orderRecordAt,
      operator: '系统',
      action: order.orderRecordLabel,
    });
  }

  if (order.rejectReason) {
    logs.push({
      time: order.updatedAt,
      operator: '系统',
      action: `审核拒绝：${order.rejectReason}`,
    });
  }

  return logs;
};

const normalizeKlookOrder = (order: KlookOrder): KlookOrder => {
  const normalizedBase = {
    ...order,
    updatedAt: order.updatedAt || order.orderRecordAt || order.createdAt,
    lockedPrice: order.lockedPrice ?? DEFAULT_LOCKED_PRICE,
    logisticsCompany: order.logisticsCompany || '',
    trackingNumber: order.trackingNumber || '',
    remark: order.remark || '',
    rejectReason: order.rejectReason || '',
  };

  return {
    ...normalizedBase,
    logs:
      order.logs.length > 0
        ? order.logs.map(cloneKlookOrderLog)
        : buildDefaultLogs(normalizedBase),
  };
};

const cloneKlookOrder = (order: KlookOrder): KlookOrder => ({
  ...order,
  logs: order.logs.map(cloneKlookOrderLog),
});

const persistKlookOrders = (orders: KlookOrder[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
};

const loadKlookOrders = (): KlookOrder[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_KLOOK_ORDERS.map(normalizeKlookOrder);
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    const fallbackOrders = DEFAULT_KLOOK_ORDERS.map(normalizeKlookOrder);
    persistKlookOrders(fallbackOrders);
    return fallbackOrders;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as KlookOrder[];
    return parsedValue.map(normalizeKlookOrder);
  } catch (error) {
    console.error(error);
    const fallbackOrders = DEFAULT_KLOOK_ORDERS.map(normalizeKlookOrder);
    persistKlookOrders(fallbackOrders);
    return fallbackOrders;
  }
};

let _klookOrders = loadKlookOrders();

export const getKlookOrders = () => _klookOrders.map(cloneKlookOrder);

export const getKlookOrderById = (id: string) => {
  const order = _klookOrders.find((item) => item.orderId === id);
  return order ? cloneKlookOrder(order) : undefined;
};

export const updateKlookOrder = (id: string, updates: Partial<KlookOrder>) => {
  _klookOrders = _klookOrders.map((order) => {
    if (order.orderId !== id) {
      return order;
    }

    return normalizeKlookOrder({
      ...order,
      ...updates,
      logs: updates.logs ? updates.logs.map(cloneKlookOrderLog) : order.logs.map(cloneKlookOrderLog),
    });
  });

  persistKlookOrders(_klookOrders);
};
