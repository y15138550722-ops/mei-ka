// ============================================
// 美卡 Shared Type Definitions
// ============================================

export type OrderStatus =
  | 'translating'
  | 'pending_review'
  | 'pending_production'
  | 'in_production'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'rejected';
export type ProductStatus = 'active' | 'inactive';
export type ProcessType = 'normal' | 'priority' | 'urgent';
export type PushTimeliness = 'instant' | 'within_2h' | 'same_day' | 'next_day';
export type AgentLevel = 'self' | 'l1' | 'l2' | 'l3';
export type Channel = 'ctrip' | 'fliggy' | 'private' | 'offline';
/** Original acquisition channel, retained independently of the legacy broad channel. */
export type OrderSourceChannel =
  | 'self_taobao' | 'self_wechat' | 'self_alipay'
  | 'ctrip_api' | 'klook_api' | 'avis_api' | 'enterprise_api' | 'hello_api'
  | 'agent_recharge' | 'wechat_ehi' | 'wechat_sixt' | 'wechat_europcar' | 'alipay_channel'
  | 'wukong_channel' | 'youxiangbang_channel' | 'shenkong_channel'
  | 'partner_shandong_yiwo' | 'partner_changzhou_yulian' | 'partner_hangzhou_yuecheng'
  | 'partner_wuhan_honghuzhizhi' | 'partner_yibantong_luoyang' | 'partner_wanteng_translation'
  | 'partner_karlowen_flagship' | 'partner_hangzhou_yundian';
export type ProductCategory =
  | 'translation'
  | 'notary'
  | 'local_language_notary'
  | 'idp'
  | 'domestic_license';

export interface NotarySubmissionFile {
  key: string;
  label: string;
  name: string;
  path: string;
  message?: string;
  type: string;
  status?: 'loading' | 'ready' | 'error';
}

export interface NotarySubmissionImage {
  key: string;
  label: string;
  src: string;
}

export interface DomesticLicenseInfo {
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
  /** Cropped from the front license for the Chinese translation template. */
  portraitPhoto?: string;
  /** Cropped/transparent signature from the front license for the Chinese translation template. */
  signaturePhoto?: string;
  translationAssetVersion?: number;
  passportPhoto?: string;
  whiteBackgroundPhoto?: string;
  frontPhotos?: string[];
  backPhotos?: string[];
  passportPhotos?: string[];
  whiteBackgroundPhotos?: string[];
}

export interface Order {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerPassport: string;
  customerEmail: string;
  productId: string;
  productName: string;
  productCategory: ProductCategory;
  processType: string;
  processTypeId?: string;
  pushTimeliness?: PushTimeliness;
  channel: Channel;
  sourceChannel?: OrderSourceChannel;
  agentLevel: AgentLevel;
  lockedPrice: number;
  status: OrderStatus;
  deliveryAddress: string;
  logisticsCompany?: string;
  trackingNumber: string;
  shippedAt?: string;
  arrivalCity?: string;
  arrivalAirport?: string;
  arrivalDateTime?: string;
  flightNumber?: string;
  remark: string;
  rejectReason?: string;
  /** Customer requirements supplied with API standard orders; an explicit “无” means none. */
  notarizationRequirement?: string;
  licenseSupplementRecord?: string;
  pushedNotaryOfficeId?: string;
  pushedNotaryOfficeName?: string;
  auditSelectedNotaryOfficeId?: string;
  auditSelectedNotaryOfficeName?: string;
  productionDisplayNotaryOfficeId?: string;
  productionDisplayNotaryOfficeName?: string;
  managementOrderId?: string;
  channelOrderId?: string;
  latestShipDate?: string;
  /** Minority-language notary orders use manually entered language and pricing with fixed service choices. */
  notaryOrderEntryType?: 'minority_language';
  notarySubmissionSequence?: number;
  notarySubmissionFiles?: NotarySubmissionFile[];
  notarySubmissionImages?: NotarySubmissionImage[];
  // --- Notary Specific ---
  licenseName?: string;
  licenseNo?: string;
  licenseCategory?: string;
  licenseGender?: string;
  licenseNationality?: string;
  licenseBirthDate?: string;
  licenseAddress?: string;
  licenseFirstIssueDate?: string;
  licenseValidFromDate?: string;
  licenseValidUntilDate?: string;
  licenseValidYears?: string;
  licenseArchiveNumber?: string;
  licenseBarcodeNumber?: string;
  licenseIssuingAuthority?: string;
  licenseIssuingRegion?: string;
  notaryCertificateImages?: Record<string, string>;
  idpSurnameEn?: string;
  idpGivenNameEn?: string;
  idpBirthDateEn?: string;
  idpBirthPlaceEn?: string;
  idpCurrentResidenceEn?: string;
  idpValidityEn?: string;
  idpWhitePhoto?: string;
  idpSignature?: string;
  language?: string;
  useCountry?: string;
  domesticLicenseInfo?: DomesticLicenseInfo;
  // ---------------------
  createdAt: string;
  updatedAt: string;
  logs: OrderLog[];
}

export interface OrderLog {
  time: string;
  operator: string;
  /** Employee login account at completion; legacy logs may only contain a display name. */
  operatorAccount?: string;
  action: string;
}

export interface Product {
  productId: string;
  title: string;
  category: ProductCategory;
  description: string;
  coverImage?: string;
  defaultPrice?: number;
  weight: number;
  status: ProductStatus;
  processTypes: ProductProcessType[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductProcessType {
  typeId: string;
  name: string;
  description: string;
  weight?: number;
  estimatedDays: number;
  pricing: PriceTier[];
}

export interface PriceTier {
  agentLevel: AgentLevel;
  price: number;
}
