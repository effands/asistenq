export type ProductType = 'tool' | 'ebook' | 'video' | 'class';
export type BillingPeriod = 'monthly' | 'annual' | 'one_time';
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
  billingPeriod: BillingPeriod;
  price: number;
  active: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
  createdAt: string;
  updatedAt: string;
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

export interface DatabaseShape {
  admins: AdminAccount[];
  members: MemberAccount[];
  products: Product[];
  orders: Order[];
  subscriptions: Subscription[];
  auditLogs: AuditLog[];
}
