// ============================================
// 美卡 i18n Configuration
// ============================================

const resources = {
  'zh-CN': {
    // ── Sidebar Menu ──
    'menu.dashboard': '工作台',
    'menu.orderManagement': '订单中心',
    'menu.orderList': '翻译订单管理',
    'menu.domesticLicenseOrderManagement': '换国内驾照翻译件订单管理',
    'menu.notaryOrderManagement': '公证订单管理',
    'menu.hongKongNotaryOrderManagement': '香港公证件订单管理',
    'menu.notaryOrderList': '公证订单',
    'menu.productManagement': '产品中心',
    'menu.productList': '在售产品',
    'menu.dataCenter': '数据中心',
    'menu.salesReport': '销售报表',
    'menu.filePreview': '文件预览',
    'menu.notaryOffice': '公证处',


    // ── Common Actions ──
    'common.search': '搜索',
    'common.reset': '重置',
    'common.add': '新增',
    'common.edit': '编辑',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.export': '导出',
    'common.confirm': '确认',
    'common.back': '返回',
    'common.view': '查看',
    'common.operate': '操作',
    'common.all': '全部',
    'common.yes': '是',
    'common.no': '否',
    'common.loading': '加载中...',
    'common.noData': '暂无数据',
    'common.total': '共',
    'common.records': '条',
    'common.page': '页',
    'common.perPage': '条/页',
    'common.goTo': '前往',
    'common.selected': '已选择',
    'common.selectAll': '全选当前页',

    // ── Order Module ──
    'order.title': '订单管理',
    'order.list.title': '订单列表',
    'order.detail.title': '订单详情',
    'order.field.orderId': '订单号',
    'order.field.customerName': '客户姓名',
    'order.field.customerPhone': '联系电话',
    'order.field.customerPassport': '证件号',
    'order.field.productName': '产品名称',
    'order.field.processType': '办理类型',
    'order.field.status': '订单状态',
    'order.field.channel': '来源渠道',
    'order.field.paidAmount': '实付金额',
    'order.field.createdAt': '下单时间',
    'order.field.actions': '操作',
    'order.field.deliveryAddress': '收货地址',
    'order.field.logisticsCompany': '物流公司',
    'order.field.trackingNumber': '物流单号',
    'order.field.shippedAt': '发货时间',
    'order.field.agentLevel': '代理等级',
    'order.field.remark': '备注',

    'order.status.translating': '翻译中',
    'order.status.pending_review': '待审核',
    'order.status.pending_production': '待制作',
    'order.status.in_production': '制作中',
    'order.status.shipped': '已发货',
    'order.status.rejected': '已驳回',

    'order.status.completed': '已完成',
    'order.status.cancelled': '已取消',

    'order.action.approve': '审核通过',
    'order.action.reject': '审核拒绝',
    'order.action.modify': '修改信息',
    'order.action.audit': '审核',
    'order.action.viewDetail': '查看详情',
    'order.action.preview': '预览审核',
    'order.action.download': '下载',
    'order.action.fillLogistics': '物流信息填写',
    'order.action.rejectReason': '拒绝原因',
    'order.action.viewLogistics': '物流信息查看',
    'order.action.produceAndDownload': '制作并下载',
    'order.action.rejectProduction': '驳回制作',

    'order.action.rejectReasonPlaceholder': '请输入拒绝原因（必填）',
    'order.placeholder.logisticsCompany': '请选择物流公司',
    'order.placeholder.trackingNumber': '请输入物流单号（必填）',

    'order.section.basic': '基本信息',
    'order.section.customer': '客户信息',
    'order.section.product': '产品信息',
    'order.section.delivery': '配送信息',
    'order.section.logs': '操作日志',

    'order.toast.approveSuccess': '审核通过，订单已转入待制作',
    'order.toast.rejectSuccess': '订单已拒绝',
    'order.toast.shipSuccess': '发货成功',
    'order.toast.saved': '已保存',

    // ── Product Module ──
    'product.title': '产品管理',
    'product.list.title': '产品列表',
    'product.form.titleAdd': '新增产品',
    'product.form.titleEdit': '编辑产品',
    'product.field.name': '产品名称',
    'product.field.category': '产品类别',
    'product.field.description': '产品描述',
    'product.field.processTypeCount': '办理类型数',
    'product.field.price': '价格',
    'product.field.status': '状态',
    'product.field.weight': '权重',
    'product.field.updatedAt': '更新时间',
    'product.field.actions': '操作',

    'product.status.active': '已上架',
    'product.status.inactive': '已下架',

    'product.action.create': '新增产品',
    'product.action.online': '上架',
    'product.action.offline': '下架',
    'product.action.confirmOffline': '确认下架该产品？下架后将无法接收新订单。',
    'product.action.confirmOnline': '确认上架该产品？',
    'product.action.viewPrice': '点击查看价格',

    'product.section.basic': '基本信息',
    'product.section.processType': '办理类型',
    'product.section.pricing': '价格配置',
    'product.section.status': '排序与状态',

    'product.toast.saveSuccess': '产品保存成功',
    'product.toast.onlineSuccess': '产品已上架',
    'product.toast.offlineSuccess': '产品已下架',
    'product.toast.deleteSuccess': '产品已删除',
    'product.toast.incompleteFields': '请填写所有必填字段（标题、类别、价格、权重）',

    'product.category.translation': '翻译认证',
    'product.category.domestic_license': '换国内驾照翻译件',
    'product.category.notary': '公证',
    'product.category.local_language_notary': '当地语言公证件',
    'product.category.idp': 'IDP',

    'product.processType.normal': '普通办理',
    'product.processType.priority': '优先办理',
    'product.processType.urgent': '加急办理',

    'product.agentLevel.self': '自营',
    'product.agentLevel.l1': '一级代理',
    'product.agentLevel.l2': '二级代理',
    'product.agentLevel.l3': '三级代理',

    // ── Channel ──
    'channel.ctrip': '携程',
    'channel.fliggy': '飞猪',
    'channel.private': '私域',
    'channel.offline': '线下代理',

    'production.statistics.title': '订单数量统计',
    'production.statistics.line': '产线',
    'production.statistics.period': '时间区间',
    'production.statistics.startDate': '开始日期',
    'production.statistics.endDate': '结束日期',
    'production.statistics.to': '至',
    'production.statistics.newOrders': '新增订单数量',
    'production.statistics.pending': '待制作订单数量',
    'production.statistics.viewDetails': '查看详情',
    'production.statistics.detailTitle': '待制作订单详情',
    'production.statistics.orderCount': '订单数量',
    'production.statistics.close': '关闭',
    'production.statistics.status.notEntered': '未录入',
    'production.statistics.status.untranslated': '未翻译',
    'production.statistics.status.unmade': '未制作',
    'production.statistics.smallbook': '小白本',
    'production.statistics.sworn': '宣誓',
    'production.statistics.notary': '公证',
    'production.statistics.hongKongNotary': '香港公证',
    'production.statistics.domesticLicense': '换国内驾照翻译件',

    // ── Notary Module ──
    'notary.field.licenseInfo': '驾照信息',
    'notary.field.licenseName': '姓名',
    'notary.field.licenseNo': '驾照号',
    'notary.field.licenseCategory': '准驾车型',
    'notary.field.productAndType': '产品及办理类型',
  },

  'en-US': {
    'menu.dashboard': 'Dashboard',
    'menu.orderManagement': 'Order Center',
    'menu.orderList': 'Translation Orders',
    'menu.domesticLicenseOrderManagement': 'Domestic License Translation Orders',
    'menu.notaryOrderManagement': 'Notary Order Management',
    'menu.hongKongNotaryOrderManagement': 'Hong Kong Notarized Document Orders',
    'menu.notaryOrderList': 'Notary Orders',
    'menu.productManagement': 'Product Center',
    'menu.productList': 'On-sale Products',
    'menu.dataCenter': 'Data Center',
    'menu.salesReport': 'Sales Report',
    'menu.filePreview': 'File Preview',
    'menu.notaryOffice': 'Notary Office',


    'common.search': 'Search',
    'common.reset': 'Reset',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.export': 'Export',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.view': 'View',
    'common.operate': 'Actions',
    'common.all': 'All',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.loading': 'Loading...',
    'common.noData': 'No data',
    'common.total': 'Total',
    'common.records': 'records',
    'common.page': 'Page',
    'common.perPage': '/ page',
    'common.goTo': 'Go to',
    'common.selected': 'Selected',
    'common.selectAll': 'Select all on this page',

    'order.title': 'Order Management',
    'order.list.title': 'Order List',
    'order.detail.title': 'Order Detail',
    'order.field.orderId': 'Order ID',
    'order.field.customerName': 'Customer',
    'order.field.customerPhone': 'Phone',
    'order.field.customerPassport': 'Passport',
    'order.field.productName': 'Product',
    'order.field.processType': 'Process Type',
    'order.field.status': 'Status',
    'order.field.channel': 'Channel',
    'order.field.paidAmount': 'Amount',
    'order.field.createdAt': 'Created At',
    'order.field.actions': 'Actions',
    'order.field.deliveryAddress': 'Address',
    'order.field.logisticsCompany': 'Logistics Company',
    'order.field.trackingNumber': 'Logistics No.',
    'order.field.shippedAt': 'Shipped At',
    'order.field.agentLevel': 'Agent Level',
    'order.field.remark': 'Remark',

    'order.status.translating': 'Translating',
    'order.status.pending_review': 'Pending Review',
    'order.status.pending_production': 'Pending Production',
    'order.status.in_production': 'In Production',
    'order.status.shipped': 'Shipped',
    'order.status.rejected': 'Rejected',

    'order.status.completed': 'Completed',
    'order.status.cancelled': 'Cancelled',

    'order.action.approve': 'Approve',
    'order.action.reject': 'Reject',
    'order.action.modify': 'Modify',
    'order.action.audit': 'Audit',
    'order.action.viewDetail': 'View Detail',
    'order.action.preview': 'Preview',
    'order.action.download': 'Download',
    'order.action.fillLogistics': 'Logistics Info',
    'order.action.rejectReason': 'Reject Reason',
    'order.action.viewLogistics': 'View Logistics',
    'order.action.produceAndDownload': 'Build & Download',
    'order.action.rejectProduction': 'Reject Production',

    'order.action.rejectReasonPlaceholder': 'Please enter reject reason (required)',
    'order.placeholder.logisticsCompany': 'Select logistics company',
    'order.placeholder.trackingNumber': 'Enter logistics no. (required)',

    'order.section.basic': 'Basic Info',
    'order.section.customer': 'Customer Info',
    'order.section.product': 'Product Info',
    'order.section.delivery': 'Delivery Info',
    'order.section.logs': 'Operation Logs',

    'order.toast.approveSuccess': 'Approved. Order moved to production.',
    'order.toast.rejectSuccess': 'Order rejected.',
    'order.toast.shipSuccess': 'Shipped successfully.',
    'order.toast.saved': 'Saved',

    'product.title': 'Product Management',
    'product.list.title': 'Product List',
    'product.form.titleAdd': 'Add Product',
    'product.form.titleEdit': 'Edit Product',
    'product.field.name': 'Product Name',
    'product.field.category': 'Category',
    'product.field.description': 'Description',
    'product.field.processTypeCount': 'Process Types',
    'product.field.price': 'Price',
    'product.field.status': 'Status',
    'product.field.weight': 'Weight',
    'product.field.updatedAt': 'Updated At',
    'product.field.actions': 'Actions',

    'product.status.active': 'Active',
    'product.status.inactive': 'Inactive',

    'product.action.create': 'Add Product',
    'product.action.online': 'Publish',
    'product.action.offline': 'Unpublish',
    'product.action.confirmOffline': 'Confirm unpublish? No new orders will be accepted.',
    'product.action.confirmOnline': 'Confirm publish this product?',
    'product.action.viewPrice': 'View Pricing',

    'product.section.basic': 'Basic Info',
    'product.section.processType': 'Process Types',
    'product.section.pricing': 'Pricing',
    'product.section.status': 'Sort & Status',

    'product.toast.saveSuccess': 'Product saved.',
    'product.toast.onlineSuccess': 'Product published.',
    'product.toast.offlineSuccess': 'Product unpublished.',
    'product.toast.deleteSuccess': 'Product deleted.',
    'product.toast.incompleteFields': 'Please fill all required fields (title, category, price, weight)',

    'product.category.translation': 'Translation & Certification',
    'product.category.domestic_license': 'Domestic License Exchange Translation',
    'product.category.notary': 'Notarization',
    'product.category.local_language_notary': 'Local-language Notarized Documents',
    'product.category.idp': 'IDP',

    'product.processType.normal': 'Standard',
    'product.processType.priority': 'Priority',
    'product.processType.urgent': 'Urgent',

    'product.agentLevel.self': 'Direct',
    'product.agentLevel.l1': 'Level 1 Agent',
    'product.agentLevel.l2': 'Level 2 Agent',
    'product.agentLevel.l3': 'Level 3 Agent',

    'channel.ctrip': 'Ctrip',
    'channel.fliggy': 'Fliggy',
    'channel.private': 'Private',
    'channel.offline': 'Offline Agent',

    'production.statistics.title': 'Order Quantity Statistics',
    'production.statistics.line': 'Production Line',
    'production.statistics.period': 'Date Range',
    'production.statistics.startDate': 'Start Date',
    'production.statistics.endDate': 'End Date',
    'production.statistics.to': 'to',
    'production.statistics.newOrders': 'New Orders',
    'production.statistics.pending': 'Pending Production Orders',
    'production.statistics.viewDetails': 'View Details',
    'production.statistics.detailTitle': 'Pending Production Details',
    'production.statistics.orderCount': 'Order Count',
    'production.statistics.close': 'Close',
    'production.statistics.status.notEntered': 'Not Entered',
    'production.statistics.status.untranslated': 'Untranslated',
    'production.statistics.status.unmade': 'Unmade',
    'production.statistics.smallbook': 'Small Booklet',
    'production.statistics.sworn': 'Sworn Translation',
    'production.statistics.notary': 'Notarization',
    'production.statistics.hongKongNotary': 'Hong Kong Notarization',
    'production.statistics.domesticLicense': 'Domestic License Translation',

    // ── Notary Module ──
    'notary.field.licenseInfo': 'License Info',
    'notary.field.licenseName': 'Name',
    'notary.field.licenseNo': 'License No.',
    'notary.field.licenseCategory': 'Vehicle Category',
    'notary.field.productAndType': 'Product & Type',
  },

};

type Locale = 'zh-CN' | 'en-US';
let currentLocale: Locale = 'zh-CN';

const fallbackTranslations: Record<string, Record<Locale, string>> = {
  'menu.idpOrderManagement': {
    'zh-CN': 'IDP订单管理',
    'en-US': 'IDP Order Management',
  },
};

const menuLabelTranslations: Record<string, Record<Locale, string>> = {
  'menu.apiOrderManagement': {
    'zh-CN': 'API订单管理',
    'en-US': 'API Order Management',
  },
  'menu.klookOrderManagement': {
    'zh-CN': 'Klook订单管理',
    'en-US': 'Klook Order Management',
  },
  'menu.helloOrderManagement': {
    'zh-CN': '哈啰订单管理',
    'en-US': 'Hello Order Management',
  },
  'menu.externalNotaryOrderManagement': {
    'zh-CN': '外采公证订单管理',
    'en-US': 'Outsourced Notary Orders',
  },
};

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string): string {
  const dict = resources[currentLocale] as Record<string, string>;
  return dict[key] || fallbackTranslations[key]?.[currentLocale] || menuLabelTranslations[key]?.[currentLocale] || key;
}

export function useTranslation() {
  return { t, locale: currentLocale, setLocale };
}
