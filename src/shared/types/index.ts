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
export type ProductCategory = 'translation' | 'notary' | 'idp';

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
  agentLevel: AgentLevel;
  lockedPrice: number;
  status: OrderStatus;
  deliveryAddress: string;
  logisticsCompany?: string;
  trackingNumber: string;
  shippedAt?: string;
  remark: string;
  rejectReason?: string;
  pushedNotaryOfficeId?: string;
  pushedNotaryOfficeName?: string;
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
  licenseIssuingAuthority?: string;
  licenseIssuingRegion?: string;
  idpSurnameEn?: string;
  idpGivenNameEn?: string;
  idpBirthDateEn?: string;
  idpBirthPlaceEn?: string;
  idpCurrentResidenceEn?: string;
  idpValidityEn?: string;
  idpWhitePhoto?: string;
  idpSignature?: string;
  language?: string;
  // ---------------------
  createdAt: string;
  updatedAt: string;
  logs: OrderLog[];
}

export interface OrderLog {
  time: string;
  operator: string;
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
