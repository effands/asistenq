export type ProductType = 'tool' | 'course' | 'ebook' | 'video' | 'bundle' | 'free' | 'class';
export type ProductVisibility = 'public' | 'private' | 'draft';
export type ProductAccessMode = 'public' | 'free_member' | 'trial' | 'paid' | 'admin';
export type ProductDestinationType = 'internal' | 'hosted' | 'external';
export type ProductOpenMode = 'same_tab' | 'new_tab' | 'wrapper';
export type ProductFulfillmentType = 'license' | 'download';
export type BillingPeriod = 'trial' | 'monthly' | 'annual' | 'lifetime' | 'one_time';
export type LicenseStatus = 'generated' | 'active' | 'expired' | 'suspended' | 'banned';
export type DiscountType = 'amount' | 'percent';
export type AdminRole = 'super_admin' | 'admin';
export type AdminScope = 'admins' | 'products' | 'members' | 'orders' | 'subscriptions' | 'content';
export type OrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled';
export type PaymentProofStatus = 'none' | 'submitted' | 'approved' | 'rejected';
export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  scopes: AdminScope[];
  active: boolean;
  createdAt: string;
}

export interface MemberAccount {
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  telegramId?: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

export interface LandingFeature {
  title: string;
  description: string;
  icon?: string;
}

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingTestimonial {
  name: string;
  role: string;
  content: string;
  avatarUrl?: string;
}

export interface LandingConfig {
  heroImageUrl?: string;
  heroVideoUrl?: string;
  themeColor?: string;
  benefits?: LandingFeature[];
  faqs?: LandingFaq[];
  testimonials?: LandingTestimonial[];
}

export type CourseMaterialType = 'youtube' | 'ebook' | 'link';

export interface CourseMaterial {
  id: string;
  type: CourseMaterialType;
  title: string;
  url: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  category?: string;
  visibility?: ProductVisibility;
  accessMode?: ProductAccessMode;
  billingPeriod: BillingPeriod;
  price: number;
  compareAtPrice?: number;
  discountLabel?: string;
  promoText?: string;
  logoUrl?: string;
  landingPath?: string;
  landingTemplate?: string;
  landingConfig?: LandingConfig;
  courseMaterials?: CourseMaterial[];
  ctaLabel?: string;
  accessRequirement?: string;
  destinationType?: ProductDestinationType;
  externalUrl?: string;
  openMode?: ProductOpenMode;
  fulfillmentType?: ProductFulfillmentType;
  downloadSourceUrl?: string;
  trackLiveUsers?: boolean;
  active: boolean;
  featured?: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPlan {
  id: string;
  productId: string;
  code: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  isFree: boolean;
  isActive: boolean;
  badge?: string;
  highlighted?: boolean;
  sortOrder?: number;
}

export interface ToolLicense {
  id: string;
  orderId?: string;
  productId: string;
  planId: string;
  email: string;
  hwid: string;
  key: string;
  status: LicenseStatus;
  generatedAt: string;
  activatedAt?: string;
  expiresAt: string | null;
}

export interface Voucher {
  id: string;
  productId: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  expiresAt: string | null;
  maxUse: number | null;
  usedCount: number;
  active: boolean;
}

export interface ProductAnnouncement {
  id: string;
  productId: string;
  text: string;
  maxPlays: number;
  delayMinutes: number;
  enabled: boolean;
}

export interface BannedHwid {
  id: string;
  productId: string;
  hwid: string;
  reason: string;
  createdAt: string;
}

export interface Order {
  id: string;
  memberId: string;
  productId: string;
  planId?: string;
  telegramId?: string;
  customerEmail?: string;
  customerHwid?: string;
  idempotencyKey?: string;
  accessTokenHash?: string;
  voucherId?: string;
  discountAmount?: number;
  licenseId?: string;
  invoiceNumber?: string;
  productName?: string;
  uniqueCode?: number;
  amount: number;
  totalAmount?: number;
  status: OrderStatus;
  qrisPayload: string;
  paymentQrUrl?: string;
  paymentProofFileId?: string;
  paymentProofStatus?: PaymentProofStatus;
  paymentProofSubmittedAt?: string;
  paymentProofReviewedAt?: string;
  paymentProofRejectionReason?: string;
  paymentProofReviewerTelegramId?: string;
  createdAt: string;
  expiresAt?: string;
  reminderSentAt?: string;
  paidAt?: string;
}

export interface DownloadGrant {
  id: string;
  orderId: string;
  memberId: string;
  productId: string;
  tokenHash: string;
  expiresAt: string;
  maxDownloads: number;
  downloadCount: number;
  createdAt: string;
}

export interface Subscription {
  id: string;
  memberId: string;
  productId: string;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export type ToolAnalyticsEventType = 'detail_view' | 'tool_open' | 'checkout_click';

export interface ToolAnalyticsEvent {
  id: string;
  productId: string;
  visitorId: string;
  eventType: ToolAnalyticsEventType;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  accountType: 'admin' | 'member';
  accountId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface DeploymentSettings {
  githubToken?: string;
  githubRepo?: string;
  githubBranch?: string;
  telegramBotToken?: string;
  telegramOwnerId?: string;
  botApiSecret?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  mailFrom?: string;
  qrisStaticPayload?: string;
  updatedAt?: string;
}

export interface DatabaseShape {
  admins: AdminAccount[];
  members: MemberAccount[];
  passwordResets: PasswordResetToken[];
  products: Product[];
  plans: ProductPlan[];
  licenses: ToolLicense[];
  vouchers: Voucher[];
  announcements: ProductAnnouncement[];
  bannedHwids: BannedHwid[];
  orders: Order[];
  downloadGrants: DownloadGrant[];
  subscriptions: Subscription[];
  auditLogs: AuditLog[];
  toolAnalyticsEvents: ToolAnalyticsEvent[];
  deploymentSettings?: DeploymentSettings;
}
