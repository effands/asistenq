export type ProductType = 'tool' | 'course' | 'ebook' | 'video' | 'bundle' | 'free' | 'class';
export type ProductVisibility = 'public' | 'private' | 'draft';
export type BillingPeriod = 'trial' | 'monthly' | 'annual' | 'lifetime' | 'one_time';
export type LicenseStatus = 'generated' | 'active' | 'expired' | 'suspended' | 'banned';
export type DiscountType = 'amount' | 'percent';
export type AdminRole = 'super_admin' | 'admin';
export type AdminScope = 'admins' | 'products' | 'members' | 'orders' | 'subscriptions' | 'content';
export type OrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled';
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
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  category?: string;
  visibility?: ProductVisibility;
  billingPeriod: BillingPeriod;
  price: number;
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
}

export interface ToolLicense {
  id: string;
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
  amount: number;
  status: OrderStatus;
  qrisPayload: string;
  createdAt: string;
  paidAt?: string;
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
  subscriptions: Subscription[];
  auditLogs: AuditLog[];
}
