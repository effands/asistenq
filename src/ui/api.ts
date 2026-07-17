import type { BannedHwid, CourseMaterial, MemberAccount, Order, Product, ProductPlan, Subscription, ToolLicense } from '../shared/types';

const API_BASE = '/api';

type RequestOptions = {
  token?: string;
  method?: string;
  body?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const rawError = await response.text();
    let message = rawError || `Request gagal (${response.status})`;

    try {
      const error = JSON.parse(rawError) as any;
      if (Array.isArray(error)) {
        const messages = error.map((err: any) => err.message).filter(Boolean);
        if (messages.length > 0) message = messages.join(', ');
      } else {
        message = error.message ?? error.detail ?? message;
      }
    } catch {
      message = rawError ? rawError.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : message;
    }

    throw new Error(message || `Request gagal (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function updateAdminPlan(token: string, id: string, patch: Partial<ProductPlan>) {
  return apiRequest<ProductPlan>(`/admin/plans/${id}`, { token, method: 'PATCH', body: patch });
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

export type CourseItem = CourseMaterial;

export type PublicProduct = Product & {
  formattedPrice: string;
  discountPercent: number;
  plans?: ProductPlan[];
  downloadSourceConfigured?: boolean;
  installerConfigured?: boolean;
  analytics?: ToolAnalyticsRow;
  landingConfig?: LandingConfig;
};
export type PublicOrder = Order & {
  product?: PublicProduct;
  formattedAmount: string;
  formattedTotalAmount: string;
  memberName?: string;
  memberEmail?: string;
};
export type PublicCatalog = {
  all: PublicProduct[];
  featured: PublicProduct[];
  paid: PublicProduct[];
  free: PublicProduct[];
  onlineUsers: number;
};
export type LoginResult = { token: string; user: { id: string; name: string; email: string; whatsapp?: string; telegramId?: string; avatarUrl?: string; role?: string; scopes?: string[] } };
export type ToolAnalyticsRow = {
  productId: string;
  slug: string;
  name: string;
  destinationType: 'internal' | 'hosted' | 'external';
  onlineUsers: number;
  detailViews: number;
  toolOpens: number;
  checkoutClicks: number;
};
export type Summary = {
  products: number;
  members: number;
  orders: number;
  licenses: number;
  activeSubscriptions: number;
  onlineUsers: number;
  toolOpens: number;
  detailViews: number;
  toolAnalytics: ToolAnalyticsRow[];
};
export type ForgotPasswordResult = { ok: true; message: string; resetUrl?: string; expiresAt?: string };
export type TelegramBotStatus = {
  configured: boolean;
  running: boolean;
  pid?: number;
  message: string;
};
export type DeploymentSettingsResult = {
  ok?: true;
  message?: string;
  githubRepo: string;
  githubBranch: string;
  hasGithubToken: boolean;
  maskedGithubToken: string;
  hasTelegramBotToken: boolean;
  maskedTelegramBotToken: string;
  telegramOwnerId: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  hasSmtpPass: boolean;
  maskedSmtpPass: string;
  mailFrom: string;
  qrisStaticPayload: string;
  botStatus: TelegramBotStatus;
  updatedAt?: string;
};
export type AdminMemberRow = Omit<MemberAccount, 'passwordHash'> & {
  licenseCount: number;
  orderCount: number;
  subscriptionCount: number;
  latestOrder?: Order;
};
export type LicensePlanRow = ProductPlan & {
  productSlug: string;
  productName: string;
  formattedPrice: string;
};
export type LicenseDashboardRow = ToolLicense & {
  product?: Pick<Product, 'id' | 'name' | 'slug' | 'type' | 'category' | 'accessUrl'>;
  plan?: Pick<ProductPlan, 'id' | 'code' | 'name' | 'price' | 'billingPeriod' | 'durationDays'> & { formattedPrice: string };
  activationUrl: string;
  verifyUrl: string;
};
export type AdminLicenseDashboard = {
  licenses: LicenseDashboardRow[];
  plans: LicensePlanRow[];
  bannedHwids: BannedHwid[];
};
export type MemberLicenseDashboard = {
  member: { id: string; name: string; email: string };
  licenses: LicenseDashboardRow[];
  subscriptions: Array<Subscription & { product?: Product }>;
};
