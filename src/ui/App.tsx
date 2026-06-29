import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  CheckCircle2,
  CreditCard,
  Film,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Monitor,
  PackagePlus,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  WandSparkles
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { BillingPeriod, ProductAccessMode, ProductType, ProductVisibility } from '../shared/types';
import {
  apiRequest,
  type AdminLicenseDashboard,
  type AdminMemberRow,
  type DeploymentSettingsResult,
  type ForgotPasswordResult,
  type LicenseDashboardRow,
  type LoginResult,
  type MemberLicenseDashboard,
  type PublicCatalog,
  type PublicOrder,
  type PublicProduct,
  type Summary,
  type TelegramBotStatus,
  type LandingConfig
} from './api';

type Route = 'home' | 'admin' | 'member' | 'product';
type AdminSection = 'dashboard' | 'landing' | 'products' | 'orders' | 'licenses' | 'members' | 'deploy';
type AdminTheme = 'light' | 'dark';

const productTypes: ProductType[] = ['tool', 'course', 'ebook', 'video', 'bundle', 'free', 'class'];
const productVisibilities: ProductVisibility[] = ['public', 'private', 'draft'];
const productAccessModes: ProductAccessMode[] = ['public', 'free_member', 'trial', 'paid', 'admin'];
const billingPeriods: BillingPeriod[] = ['trial', 'monthly', 'annual', 'lifetime', 'one_time'];
const emptyCatalog: PublicCatalog = { featured: [], paid: [], free: [] };

function routeFromPath(pathname: string): Route {
  if (pathname.startsWith('/adminasistenq')) return 'admin';
  if (pathname.startsWith('/member')) return 'member';
  if (pathname.startsWith('/produk/')) return 'product';
  if (/^\/[a-z0-9-]+$/.test(pathname)) return 'product';
  return 'home';
}

function productSlugFromPath(pathname: string): string {
  if (pathname.startsWith('/produk/')) return decodeURIComponent(pathname.replace('/produk/', '').split('/')[0]);
  if (/^\/[a-z0-9-]+$/.test(pathname)) return decodeURIComponent(pathname.slice(1));
  return '';
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [catalog, setCatalog] = useState<PublicCatalog>(emptyCatalog);
  const [adminSession, setAdminSession] = useState<LoginResult | null>(null);
  const [memberSession, setMemberSession] = useState<LoginResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [memberDashboard, setMemberDashboard] = useState<MemberLicenseDashboard | null>(null);
  const [memberOrders, setMemberOrders] = useState<PublicOrder[]>([]);
  const [adminLicenses, setAdminLicenses] = useState<AdminLicenseDashboard | null>(null);
  const [adminMembers, setAdminMembers] = useState<AdminMemberRow[]>([]);
  const [adminOrders, setAdminOrders] = useState<PublicOrder[]>([]);
  const [deploymentSettings, setDeploymentSettings] = useState<DeploymentSettingsResult | null>(null);
  const [message, setMessage] = useState('Sistem AsistenQ siap.');
  const [adminSection, setAdminSection] = useState<AdminSection>('dashboard');
  const [adminTheme, setAdminTheme] = useState<AdminTheme>(() => (
    window.localStorage.getItem('asistenq-admin-theme') === 'dark' ? 'dark' : 'light'
  ));
  const [productSlug, setProductSlug] = useState(() => productSlugFromPath(window.location.pathname));

  function navigate(nextRoute: Route) {
    const path = nextRoute === 'home' ? '/' : nextRoute === 'admin' ? '/adminasistenq' : nextRoute === 'product' ? `/produk/${productSlug}` : `/${nextRoute}`;
    window.history.pushState({}, '', path);
    setRoute(nextRoute);
  }

  function navigateProduct(slug: string) {
    const product = products.find((item) => item.slug === slug);
    window.history.pushState({}, '', product?.landingPath ?? `/produk/${slug}`);
    setProductSlug(slug);
    setRoute('product');
  }

  function setTheme(theme: AdminTheme) {
    setAdminTheme(theme);
    window.localStorage.setItem('asistenq-admin-theme', theme);
  }

  async function loadProducts() {
    setProducts(await apiRequest<PublicProduct[]>('/products'));
  }

  async function loadCatalog() {
    setCatalog(await apiRequest<PublicCatalog>('/catalog'));
  }

  async function loadAdminSummary(token = adminSession?.token) {
    if (!token) return;
    setSummary(await apiRequest<Summary>('/admin/summary', { token }));
  }

  async function loadAdminLicenses(token = adminSession?.token) {
    if (!token) return;
    setAdminLicenses(await apiRequest<AdminLicenseDashboard>('/admin/licenses', { token }));
  }

  async function loadAdminMembers(token = adminSession?.token) {
    if (!token) return;
    setAdminMembers(await apiRequest<AdminMemberRow[]>('/admin/members', { token }));
  }

  async function loadAdminOrders(token = adminSession?.token) {
    if (!token) return;
    setAdminOrders(await apiRequest<PublicOrder[]>('/admin/orders', { token }));
  }

  async function loadDeploymentSettings(token = adminSession?.token) {
    if (!token) return;
    setDeploymentSettings(await apiRequest<DeploymentSettingsResult>('/admin/deploy/settings', { token }));
  }

  async function loadLicenses(token = memberSession?.token) {
    if (!token) return;
    setMemberDashboard(await apiRequest<MemberLicenseDashboard>('/member/licenses', { token }));
  }

  async function loadMemberOrders(token = memberSession?.token) {
    if (!token) return;
    setMemberOrders(await apiRequest<PublicOrder[]>('/member/orders', { token }));
  }

  useEffect(() => {
    const onPopState = () => {
      setProductSlug(productSlugFromPath(window.location.pathname));
      setRoute(routeFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    loadProducts().catch((error) => setMessage(error.message));
    loadCatalog().catch((error) => setMessage(error.message));
  }, []);

  const onUpdateMember = async (memberId: string, input: any) => {
    if (!adminSession) return;
    await apiRequest(`/admin/members/${memberId}`, {
      method: 'PUT',
      token: adminSession.token,
      body: input
    });
    const loaded = await apiRequest<AdminMemberRow[]>('/admin/members', {
      token: adminSession.token
    });
    setAdminMembers(loaded);
  };

  if (route === 'admin') {
    return (
      <AdminShell
        activeSection={adminSection}
        message={message}
        navigate={navigate}
        onSectionChange={setAdminSection}
        onThemeChange={setTheme}
        theme={adminTheme}
      >
        <AdminPanel
          onUpdateMember={onUpdateMember}
          activeSection={adminSection}
          onSectionChange={setAdminSection}
          session={adminSession}
          summary={summary}
          products={products}
          licenses={adminLicenses}
          members={adminMembers}
          orders={adminOrders}
          onLogin={async (email, password) => {
            const result = await apiRequest<LoginResult>('/admin/login', { method: 'POST', body: { email, password } });
            setAdminSession(result);
            setMessage(`Login admin: ${result.user.name}`);
            await loadAdminSummary(result.token);
            await loadAdminLicenses(result.token);
            await loadAdminMembers(result.token);
            await loadAdminOrders(result.token);
            await loadDeploymentSettings(result.token);
          }}
          onCreateProduct={async (input) => {
            if (!adminSession) return;
            await apiRequest('/admin/products', { token: adminSession.token, method: 'POST', body: input });
            await loadProducts();
            await loadCatalog();
            await loadAdminSummary();
            setMessage('Produk baru tersimpan.');
          }}
          onUpdateProduct={async (productId, input) => {
            if (!adminSession) return;
            await apiRequest(`/admin/products/${productId}`, { token: adminSession.token, method: 'PUT', body: input });
            await loadProducts();
            await loadCatalog();
            await loadAdminSummary();
            setMessage('Produk diperbarui.');
          }}
          onImportLandingZip={async (productId, file) => {
            if (!adminSession) return;
            const response = await fetch(`/api/admin/products/${productId}/landing-zip`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${adminSession.token}`,
                'Content-Type': 'application/zip'
              },
              body: await file.arrayBuffer()
            });
            if (!response.ok) {
              const error = await response.json().catch(() => ({ message: 'Import ZIP gagal.' }));
              throw new Error(error.message ?? 'Import ZIP gagal.');
            }
            await loadProducts();
            await loadCatalog();
            setMessage('Landing ZIP berhasil diimport.');
          }}
          onRefreshLicenses={async () => {
            await loadAdminLicenses();
            setMessage('Data lisensi diperbarui.');
          }}
          onRefreshMembers={async () => {
            await loadAdminMembers();
            setMessage('Data member diperbarui.');
          }}
          onResetOperationalData={async () => {
            if (!adminSession) throw new Error('Login admin dulu.');
            const result = await apiRequest<{ ok: true; message: string }>('/admin/reset-operational-data', {
              token: adminSession.token,
              method: 'POST'
            });
            await loadAdminSummary(adminSession.token);
            await loadAdminLicenses(adminSession.token);
            await loadAdminMembers(adminSession.token);
            await loadAdminOrders(adminSession.token);
            setMessage(result.message);
          }}
          onGenerateLicense={async (input) => {
            if (!adminSession) throw new Error('Login admin dulu.');
            await apiRequest('/license/generate', { token: adminSession.token, method: 'POST', body: input });
            await loadAdminLicenses(adminSession.token);
            await loadAdminMembers(adminSession.token);
            setMessage(`Lisensi ${input.productSlug} dibuat untuk ${input.email}.`);
          }}
          onResetLicense={async (licenseId, newHwid) => {
            if (!adminSession) throw new Error('Login admin dulu.');
            await apiRequest('/license/reset-device', { token: adminSession.token, method: 'POST', body: { licenseId, newHwid } });
            await loadAdminLicenses(adminSession.token);
            setMessage('Lisensi dipindahkan ke device baru.');
          }}
          onBanLicense={async (license) => {
            if (!adminSession || !license.product?.slug) throw new Error('Data lisensi belum lengkap.');
            await apiRequest('/license/ban-hwid', {
              token: adminSession.token,
              method: 'POST',
              body: { productSlug: license.product.slug, hwid: license.hwid, reason: 'manual admin action' }
            });
            await loadAdminLicenses(adminSession.token);
            setMessage('HWID diblokir.');
          }}
          onUnbanLicense={async (license) => {
            if (!adminSession || !license.product?.slug) throw new Error('Data lisensi belum lengkap.');
            await apiRequest('/license/unban-hwid', {
              token: adminSession.token,
              method: 'POST',
              body: { productSlug: license.product.slug, hwid: license.hwid }
            });
            await loadAdminLicenses(adminSession.token);
            setMessage('HWID dipulihkan.');
          }}
          onDeployUpdate={async () => {
            if (!adminSession) throw new Error('Login admin dulu.');
            return apiRequest<{ ok: boolean; message: string; stdout?: string; stderr?: string; detail?: string }>('/admin/deploy/update', {
              token: adminSession.token,
              method: 'POST'
            });
          }}
          onRefreshBotStatus={async () => {
            if (!adminSession) throw new Error('Login admin dulu.');
            const botStatus = await apiRequest<TelegramBotStatus>('/admin/bot/status', { token: adminSession.token });
            setDeploymentSettings((current) => current ? { ...current, botStatus } : current);
            return botStatus;
          }}
          onStartBot={async () => {
            if (!adminSession) throw new Error('Login admin dulu.');
            const botStatus = await apiRequest<TelegramBotStatus>('/admin/bot/start', { token: adminSession.token, method: 'POST' });
            setDeploymentSettings((current) => current ? { ...current, botStatus } : current);
            setMessage(botStatus.message);
            return botStatus;
          }}
          onStopBot={async () => {
            if (!adminSession) throw new Error('Login admin dulu.');
            const botStatus = await apiRequest<TelegramBotStatus>('/admin/bot/stop', { token: adminSession.token, method: 'POST' });
            setDeploymentSettings((current) => current ? { ...current, botStatus } : current);
            setMessage(botStatus.message);
            return botStatus;
          }}
          deploymentSettings={deploymentSettings}
          onSaveDeploymentSettings={async (input) => {
            if (!adminSession) throw new Error('Login admin dulu.');
            const result = await apiRequest<DeploymentSettingsResult>('/admin/deploy/settings', {
              token: adminSession.token,
              method: 'POST',
              body: input
            });
            setDeploymentSettings(result);
            setMessage(result.message ?? 'GitHub deployment settings tersimpan.');
          }}
        />
      </AdminShell>
    );
  }

  if (route === 'member') {
    return (
      <PublicShell
        navigate={navigate}
        activeRoute="member"
        memberSession={memberSession}
        onMemberLogout={() => {
          apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
          setMemberSession(null);
          setMemberDashboard(null);
          setMemberOrders([]);
          setMessage('Member logout.');
        }}
      >
        <MemberPanel
          session={memberSession}
          products={products}
          dashboard={memberDashboard}
          orders={memberOrders}
          onLogout={() => {
            apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
            setMemberSession(null);
            setMemberDashboard(null);
            setMemberOrders([]);
            setMessage('Member logout.');
          }}
          onRegister={async (name, email, password, whatsapp, telegramId) => {
            const result = await apiRequest<LoginResult>('/member/register', { method: 'POST', body: { name, email, password, whatsapp, telegramId } });
            setMemberSession(result);
            setMessage(`Member aktif: ${result.user.name}`);
            await loadLicenses(result.token);
            await loadMemberOrders(result.token);
          }}
          onLogin={async (email, password) => {
            const result = await apiRequest<LoginResult>('/member/login', { method: 'POST', body: { email, password } });
            setMemberSession(result);
            setMessage(`Member login: ${result.user.name}`);
            await loadLicenses(result.token);
            await loadMemberOrders(result.token);
          }}
          onCheckout={async (productId) => {
            if (!memberSession) throw new Error('Login member dulu.');
            const order = await apiRequest<PublicOrder>('/checkout', {
              token: memberSession.token,
              method: 'POST',
              body: { productId }
            });
            setMessage(`Invoice ${order.invoiceNumber} dibuat.`);
            await loadLicenses(memberSession.token);
            await loadMemberOrders(memberSession.token);
            return order;
          }}
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell navigate={navigate} activeRoute="home">
      {route === 'product'
        ? <ProductLanding isLoading={products.length === 0} product={products.find((item) => item.slug === productSlug || item.landingPath === `/${productSlug}`)} onJoin={() => navigate('member')} />
        : <Marketplace catalog={catalog} onJoin={() => navigate('member')} onProductOpen={navigateProduct} />}
    </PublicShell>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <button className={compact ? 'brand brand-compact' : 'brand'} onClick={() => window.location.assign('/')}>
      <div className="brand-mark">AQ</div>
      <div>
        <strong>AsistenQ</strong>
        <span>Tools Bantu nge-YouTube</span>
      </div>
    </button>
  );
}

function PublicShell({ children, navigate, activeRoute, memberSession, onMemberLogout }: {
  children: ReactNode;
  navigate: (route: Route) => void;
  activeRoute: Route;
  memberSession?: LoginResult | null;
  onMemberLogout?: () => void;
}) {
  const ctaLabel = activeRoute === 'member'
    ? 'Area Member'
    : 'Masuk Member';
  const ctaSubLabel = activeRoute === 'member'
    ? 'Buka dashboard member'
    : 'Login untuk akses lisensi';
  return (
    <div className="public-page">
      <div className="noise-layer" />
      <header className="public-nav">
        <Brand />
        <nav>
          <button className={activeRoute === 'home' ? 'active' : ''} onClick={() => navigate('home')}>Marketplace</button>
          <a href="#produk">Produk</a>
          <a href="#course">Course</a>
          <button className={activeRoute === 'member' ? 'active' : ''} onClick={() => navigate('member')}>Member</button>
        </nav>
        <div className="nav-actions">
          {memberSession ? (
            <>
              <button className="primary public-cta public-cta-logged" onClick={() => navigate('member')}>
                <span>{ctaLabel}</span>
                <small>{memberSession.user.name} • {memberSession.user.email}</small>
              </button>
              {onMemberLogout && (
                <button className="logout-icon-button" type="button" onClick={onMemberLogout} title="Logout member" aria-label="Logout member">
                  <LogOut size={18} />
                </button>
              )}
            </>
          ) : (
            <button className="primary public-cta" onClick={() => navigate('member')}>
              <span>{ctaLabel}</span>
              <small>{ctaSubLabel}</small>
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function AdminShell({ activeSection, children, message, navigate, onSectionChange, onThemeChange, theme }: {
  activeSection: AdminSection;
  children: ReactNode;
  message: string;
  navigate: (route: Route) => void;
  onSectionChange: (section: AdminSection) => void;
  onThemeChange: (theme: AdminTheme) => void;
  theme: AdminTheme;
}) {
  return (
    <div className={`admin-shell admin-${theme}`}>
      <aside className="admin-sidebar">
        <Brand compact />
        <nav className="admin-nav">
          <button className={activeSection === 'dashboard' ? 'active' : ''} onClick={() => onSectionChange('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
          <button className={activeSection === 'landing' ? 'active' : ''} onClick={() => onSectionChange('landing')}><Sparkles size={18} /> Landing</button>
          <button className={activeSection === 'products' ? 'active' : ''} onClick={() => onSectionChange('products')}><Boxes size={18} /> Produk</button>
          <button className={activeSection === 'orders' ? 'active' : ''} onClick={() => onSectionChange('orders')}><CreditCard size={18} /> Order</button>
          <button className={activeSection === 'licenses' ? 'active' : ''} onClick={() => onSectionChange('licenses')}><KeyRound size={18} /> Lisensi</button>
          <button className={activeSection === 'members' ? 'active' : ''} onClick={() => onSectionChange('members')}><Users size={18} /> Member</button>
          <button className={activeSection === 'deploy' ? 'active' : ''} onClick={() => onSectionChange('deploy')}><ShieldCheck size={18} /> Settings</button>
        </nav>
        <button className="admin-public-link" onClick={() => navigate('home')}><ArrowRight size={16} /> Lihat website</button>
      </aside>
      <main className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="section-kicker">AsistenQ Operations</p>
            <h1>Admin Panel</h1>
          </div>
          <div className="admin-top-actions">
            <div className="theme-toggle" aria-label="Pilih tema admin">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => onThemeChange('light')}>Light</button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => onThemeChange('dark')}>Dark</button>
            </div>
            <div className="status-pill">{message}</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function LoginBox({ title, accountType = 'member', footer, onSubmit, showName = false, submitLabel }: {
  title: string;
  accountType?: 'admin' | 'member';
  footer?: ReactNode;
  showName?: boolean;
  submitLabel?: string;
  onSubmit: (name: string, email: string, password: string, whatsapp: string, telegramId: string) => Promise<void>;
}) {
  const [name, setName] = useState('Member AsistenQ');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') ?? '');
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(() => resetToken ? 'reset' : 'login');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form className="auth-form stack" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setNotice('');
      try {
        if (mode === 'forgot') {
          const result = await apiRequest<ForgotPasswordResult>('/auth/forgot-password', {
            method: 'POST',
            body: { email, accountType }
          });
          setNotice(result.resetUrl ? `${result.message} Link sementara: ${result.resetUrl}` : result.message);
          return;
        }

        if (mode === 'reset') {
          const result = await apiRequest<{ ok: true; message: string }>('/auth/reset-password', {
            method: 'POST',
            body: { token: resetToken, accountType, password }
          });
          setNotice(result.message);
          setPassword('');
          setResetToken('');
          setMode('login');
          window.history.replaceState({}, '', accountType === 'admin' ? '/adminasistenq' : '/member');
          return;
        }

        await onSubmit(name, email, password, whatsapp, telegramId);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Login gagal. Periksa kembali data akun.');
      } finally {
        setBusy(false);
      }
    }}>
      <div>
        <p className="section-kicker">{mode === 'forgot' ? 'Reset access' : mode === 'reset' ? 'Password baru' : 'Secure access'}</p>
        <h2>{mode === 'forgot' ? 'Lupa Password' : mode === 'reset' ? 'Buat Password Baru' : title}</h2>
      </div>
      {showName && mode === 'login' && <label>Nama<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" /></label>}
      {showName && mode === 'login' && <label>Nomor WhatsApp Aktif<input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="62812..." inputMode="tel" /></label>}
      {showName && mode === 'login' && <label>ID Telegram<input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="@username atau user id" /></label>}
      {mode !== 'reset' && <label>Email<input autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" type="email" /></label>}
      {mode !== 'forgot' && <label>Password<input autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" type="password" /></label>}
      {mode === 'reset' && <label>Token Reset<input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Token reset password" /></label>}
      {notice && <p className="form-notice">{notice}</p>}
      <button className="primary" disabled={busy}>
        {busy ? <RefreshCw className="spin-icon" size={18} /> : <LogIn size={18} />} {busy ? 'Memeriksa...' : mode === 'forgot' ? 'Kirim instruksi reset' : mode === 'reset' ? 'Simpan password baru' : submitLabel ?? 'Masuk'}
      </button>
      <div className="auth-links">
        <button
          className="link-button"
          type="button"
          onClick={() => {
            setNotice('');
            setMode(mode === 'login' ? 'forgot' : 'login');
          }}
        >
          {mode === 'login' ? 'Lupa password?' : 'Kembali ke login'}
        </button>
        {mode === 'login' && footer}
      </div>
    </form>
  );
}

function AdminPanel({
  activeSection,
  onSectionChange,
  session,
  summary,
  products,
  licenses,
  members,
  orders,
  onLogin,
  onCreateProduct,
  onUpdateProduct,
  onImportLandingZip,
  onRefreshLicenses,
  onRefreshMembers,
  onUpdateMember,
  onResetOperationalData,
  onGenerateLicense,
  onResetLicense,
  onBanLicense,
  onUnbanLicense,
  onDeployUpdate,
  onRefreshBotStatus,
  onStartBot,
  onStopBot,
  deploymentSettings,
  onSaveDeploymentSettings
}: {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  session: LoginResult | null;
  summary: Summary | null;
  products: PublicProduct[];
  licenses: AdminLicenseDashboard | null;
  members: AdminMemberRow[];
  orders: PublicOrder[];
  onLogin: (email: string, password: string) => Promise<void>;
  onCreateProduct: (input: {
    name: string;
    slug: string;
    type: ProductType;
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
    ctaLabel?: string;
    accessRequirement?: string;
    headline: string;
    description: string;
  }) => Promise<void>;
  onUpdateProduct: (productId: string, input: Partial<PublicProduct>) => Promise<void>;
  onImportLandingZip: (productId: string, file: File) => Promise<void>;
  onRefreshLicenses: () => Promise<void>;
  onRefreshMembers: () => Promise<void>;
  onUpdateMember: (id: string, input: any) => Promise<void>;
  onResetOperationalData: () => Promise<void>;
  onGenerateLicense: (input: { productSlug: string; planCode: string; email: string; hwid: string }) => Promise<void>;
  onResetLicense: (licenseId: string, newHwid: string) => Promise<void>;
  onBanLicense: (license: LicenseDashboardRow) => Promise<void>;
  onUnbanLicense: (license: LicenseDashboardRow) => Promise<void>;
  onDeployUpdate: () => Promise<{ ok: boolean; message: string; stdout?: string; stderr?: string; detail?: string }>;
  onRefreshBotStatus: () => Promise<TelegramBotStatus>;
  onStartBot: () => Promise<TelegramBotStatus>;
  onStopBot: () => Promise<TelegramBotStatus>;
  deploymentSettings: DeploymentSettingsResult | null;
  onSaveDeploymentSettings: (input: { githubRepo: string; githubBranch: string; githubToken?: string; telegramBotToken?: string; telegramOwnerId?: string; smtpHost?: string; smtpPort?: string; smtpUser?: string; smtpPass?: string; mailFrom?: string }) => Promise<void>;
}) {
  if (!session) {
    return (
      <section className="admin-login-screen">
        <div className="admin-login-copy">
          <span className="chip">AsistenQ Control Room</span>
          <h2>Satu meja kerja untuk seluruh operasional.</h2>
          <p>Kelola produk, member, transaksi, dan lisensi dengan alur yang ringkas.</p>
          <div className="admin-login-points">
            <span><PackagePlus size={17} /> Produk & tools</span>
            <span><Users size={17} /> Data member</span>
            <span><KeyRound size={17} /> Kontrol lisensi</span>
          </div>
        </div>
        <LoginBox title="Login Super Admin" accountType="admin" onSubmit={(_, email, password) => onLogin(email, password)} />
      </section>
    );
  }

  if (activeSection === 'landing') {
    return <LandingManager products={products} onUpdateProduct={onUpdateProduct} onCreateProduct={onCreateProduct} />;
  }

  if (activeSection === 'products') {
    return (
      <section className="admin-content-grid">
        <ProductForm onCreateProduct={onCreateProduct} />
        <ProductTable onImportLandingZip={onImportLandingZip} onUpdateProduct={onUpdateProduct} products={products} />
      </section>
    );
  }

  if (activeSection === 'licenses') {
    return (
      <AdminLicensePanel
        dashboard={licenses}
        products={products}
        onBanLicense={onBanLicense}
        onGenerateLicense={onGenerateLicense}
        onRefresh={onRefreshLicenses}
        onResetLicense={onResetLicense}
        onUnbanLicense={onUnbanLicense}
      />
    );
  }

  if (activeSection === 'orders') {
    return <AdminOrderPanel orders={orders} />;
  }

  if (activeSection === 'members') {
    return <AdminMemberPanel members={members} onRefresh={onRefreshMembers} onUpdateMember={onUpdateMember} />;
  }

  if (activeSection === 'deploy') {
    return (
      <DeployPanel
        settings={deploymentSettings}
        onDeployUpdate={onDeployUpdate}
        onRefreshBotStatus={onRefreshBotStatus}
        onSaveSettings={onSaveDeploymentSettings}
        onStartBot={onStartBot}
        onStopBot={onStopBot}
      />
    );
  }

  return <AdminDashboardPanel onNavigate={onSectionChange} onResetOperationalData={onResetOperationalData} products={products} summary={summary} />;
}

function AdminDashboardPanel({ products, summary, onResetOperationalData, onNavigate }: {
  products: PublicProduct[];
  summary: Summary | null;
  onResetOperationalData: () => Promise<void>;
  onNavigate: (section: AdminSection) => void;
}) {
  const [resetBusy, setResetBusy] = useState(false);
  const [resetNotice, setResetNotice] = useState('');

  return (
    <section className="admin-content-grid">
      <div className="metrics">
        <Metric icon={<PackagePlus />} label="Produk" value={summary?.products ?? products.length} onClick={() => onNavigate('products')} />
        <Metric icon={<Users />} label="Member" value={summary?.members ?? 0} onClick={() => onNavigate('members')} />
        <Metric icon={<CreditCard />} label="Order" value={summary?.orders ?? 0} onClick={() => onNavigate('orders')} />
        <Metric icon={<KeyRound />} label="Lisensi" value={summary?.licenses ?? 0} onClick={() => onNavigate('licenses')} />
      </div>
      <div className="panel stack wide">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Maintenance</p>
            <h2>Reset Data Operasional</h2>
          </div>
          <span className="soft-badge">Local</span>
        </div>
        <p className="muted">Members dan produk tetap disimpan. Order, subscription, lisensi, banned HWID, voucher, dan log sementara akan dikosongkan.</p>
        <button
          className="ghost-button danger-lite reset-data-button"
          disabled={resetBusy}
          onClick={async () => {
            setResetBusy(true);
            setResetNotice('Mereset data operasional...');
            try {
              await onResetOperationalData();
              setResetNotice('Reset selesai. Order, subscription, lisensi, voucher, dan log sudah kosong.');
            } catch (error) {
              setResetNotice(error instanceof Error ? error.message : 'Reset data gagal.');
            } finally {
              setResetBusy(false);
            }
          }}
        >
          {resetBusy ? 'Mereset...' : 'Reset Data'}
        </button>
        {resetNotice && <p className="form-notice">{resetNotice}</p>}
      </div>
    </section>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Lifetime';
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRemaining(value?: string | null) {
  if (!value) return '24j';
  const remainingMs = new Date(value).getTime() - Date.now();
  if (remainingMs <= 0) return 'Kedaluwarsa';
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`;
}

function AdminOrderPanel({ orders }: { orders: PublicOrder[] }) {
  return (
    <section className="panel stack">
      <div className="panel-heading">
        <div><p className="section-kicker">Transaksi</p><h2>Daftar Order</h2></div>
        <span className="soft-badge">{orders.length} order</span>
      </div>
      <div className="order-admin-table-wrap">
        <div className="order-admin-row order-admin-head"><span>Invoice</span><span>Member</span><span>Produk</span><span>Total</span><span>Status</span><span>Tanggal</span></div>
        {orders.length === 0 && <div className="empty-state">Belum ada order.</div>}
        {orders.map((order) => (
          <div className="order-admin-row" key={order.id}>
            <strong>{order.invoiceNumber ?? order.id}</strong>
            <div className="order-member-col">
              <b>{order.memberName || 'Unknown Member'}</b>
              <span>{order.memberEmail || order.memberId}</span>
            </div>
            <span>{order.product?.name ?? order.productName ?? order.productId}</span>
            <b>{order.formattedTotalAmount}</b>
            <span className={`status-dot status-${order.status}`}>{order.status}</span>
            <span>{formatDate(order.createdAt)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function licenseStatusLabel(license: LicenseDashboardRow) {
  if (license.status === 'generated') return 'Belum diaktivasi';
  if (license.status === 'active') return 'Aktif';
  if (license.status === 'banned') return 'Banned';
  if (license.status === 'expired') return 'Expired';
  return license.status;
}

function AdminLicensePanel({ dashboard, products, onGenerateLicense, onRefresh, onResetLicense, onBanLicense, onUnbanLicense }: {
  dashboard: AdminLicenseDashboard | null;
  products: PublicProduct[];
  onGenerateLicense: (input: { productSlug: string; planCode: string; email: string; hwid: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
  onResetLicense: (licenseId: string, newHwid: string) => Promise<void>;
  onBanLicense: (license: LicenseDashboardRow) => Promise<void>;
  onUnbanLicense: (license: LicenseDashboardRow) => Promise<void>;
}) {
  const licensedSlugs = new Set((dashboard?.plans ?? []).map((plan) => plan.productSlug));
  const licenseProducts = products.filter((product) => licensedSlugs.has(product.slug));
  const vjProduct = licenseProducts.find((product) => product.slug === 'vjstudio') ?? licenseProducts[0];
  const [productSlug, setProductSlug] = useState(vjProduct?.slug ?? 'vjstudio');
  const productPlans = (dashboard?.plans ?? []).filter((plan) => plan.productSlug === productSlug);
  const [planCode, setPlanCode] = useState('1M');
  const [email, setEmail] = useState('buyer@email.com');
  const [hwid, setHwid] = useState('');
  const [search, setSearch] = useState('');
  const [resetValues, setResetValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!productSlug && vjProduct) {
      setProductSlug(vjProduct.slug);
    }
  }, [productSlug, vjProduct]);

  useEffect(() => {
    if (productPlans.length > 0 && !productPlans.some((plan) => plan.code === planCode)) {
      setPlanCode(productPlans[0].code);
    }
  }, [planCode, productPlans]);

  const filteredLicenses = (dashboard?.licenses ?? []).filter((license) => {
    const haystack = `${license.email} ${license.hwid} ${license.key} ${license.product?.name ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Aksi gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="license-admin-layout">
      <div className="panel stack license-generator-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">VJ Studio Control Hub</p>
            <h2>Generate Lisensi</h2>
          </div>
          <span className="soft-badge">HWID lock</span>
        </div>
        <p className="muted">Buat token lisensi kompatibel dengan generator lama. Token akan tersimpan di database AsistenQ dan bisa dibaca dari member area berdasarkan email pembeli.</p>
        <form className="license-generate-form" onSubmit={async (event) => {
          event.preventDefault();
          await runAction(async () => {
            await onGenerateLicense({ productSlug, planCode, email, hwid });
            setHwid('');
          }, 'Token lisensi berhasil dibuat.');
        }}>
          <label>Produk
            <select value={productSlug} onChange={(event) => setProductSlug(event.target.value)}>
              {licenseProducts.map((product) => (
                <option key={product.id} value={product.slug}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>Paket
            <select value={planCode} onChange={(event) => setPlanCode(event.target.value)}>
              {productPlans.map((plan) => (
                <option key={plan.id} value={plan.code}>{plan.name} · {plan.formattedPrice}</option>
              ))}
            </select>
          </label>
          <label>Email Pembeli
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="buyer@email.com" />
          </label>
          <label>Device ID / HWID
            <input value={hwid} onChange={(event) => setHwid(event.target.value.toUpperCase())} maxLength={16} placeholder="16 digit HWID pembeli" />
          </label>
          <button className="primary" disabled={busy || !productSlug || !planCode || productPlans.length === 0}><KeyRound size={18} /> Generate Token</button>
        </form>
        {licenseProducts.length === 0 && <p className="form-notice">Belum ada produk dengan paket lisensi aktif.</p>}
        {notice && <p className="form-notice">{notice}</p>}
      </div>

      <div className="panel stack license-ops-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">License Database</p>
            <h2>Daftar Lisensi</h2>
          </div>
          <button className="ghost-button" onClick={() => runAction(onRefresh, 'Data lisensi diperbarui.')}><RefreshCw size={16} /> Refresh</button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari email, HWID, atau token..." />
        <div className="order-admin-table-wrap">
          <div className="license-compact-row license-compact-head">
            <span>Detail Lisensi</span>
            <span>HWID & Status</span>
            <span>Token Aktif</span>
            <span>Aksi Dasar</span>
            <span>Reset Perangkat</span>
          </div>
          {filteredLicenses.length === 0 && <div className="empty-state">Belum ada lisensi. Generate token pertama untuk VJ Studio Pro.</div>}
          {filteredLicenses.map((license) => (
            <div className="license-compact-row" key={license.id}>
              <div className="license-col-main">
                <b>{license.product?.name ?? license.productId}</b>
                <span>{license.email}</span>
                <span className={`status-dot status-${license.status}`}>{licenseStatusLabel(license)}</span>
              </div>
              <div className="license-col-meta">
                <span><Monitor size={14} /> {license.hwid}</span>
                <span>{license.plan?.name ?? license.planId}</span>
                <span>Exp: {formatDate(license.expiresAt)}</span>
              </div>
              <div className="license-col-token">
                <code>{license.key}</code>
              </div>
              <div className="license-col-actions">
                <button className="ghost-button" onClick={() => navigator.clipboard.writeText(license.key)}>Copy</button>
                {license.status === 'banned'
                  ? <button className="ghost-button" disabled={busy} onClick={() => runAction(() => onUnbanLicense(license), 'HWID dipulihkan.')}>Unban</button>
                  : <button className="ghost-button danger-lite" disabled={busy} onClick={() => runAction(() => onBanLicense(license), 'HWID diblokir.')}>Ban</button>}
              </div>
              <div className="license-col-reset">
                <input
                  value={resetValues[license.id] ?? ''}
                  onChange={(event) => setResetValues((current) => ({ ...current, [license.id]: event.target.value.toUpperCase() }))}
                  maxLength={16}
                  placeholder="HWID baru..."
                />
                <button
                  className="ghost-button"
                  disabled={busy || !resetValues[license.id]}
                  onClick={() => runAction(
                    () => onResetLicense(license.id, resetValues[license.id]),
                    'Device dipindahkan.'
                  )}
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



function LandingManager({ products, onUpdateProduct, onCreateProduct }: { 
  products: PublicProduct[]; 
  onUpdateProduct?: (id: string, input: Partial<PublicProduct>) => Promise<void>;
  onCreateProduct?: (input: any) => Promise<void>;
}) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? '');
  const selected = products.find((product) => product.slug === selectedSlug);

  const [activeTab, setActiveTab] = useState<'basic' | 'visual' | 'content'>('basic');
  const [isCreating, setIsCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Form State
  const [config, setConfig] = useState<LandingConfig>({});
  const [basicInfo, setBasicInfo] = useState({
    name: '', slug: '', price: 0, headline: '', description: '', type: 'tool', billingPeriod: 'monthly'
  });

  useEffect(() => {
    if (!selectedSlug && products[0]) setSelectedSlug(products[0].slug);
  }, [products, selectedSlug]);

  useEffect(() => {
    if (selected && !isCreating) {
      setConfig(selected.landingConfig || {
        heroImageUrl: '', heroVideoUrl: '', themeColor: '', benefits: [], faqs: [], testimonials: []
      });
      setBasicInfo({
        name: selected.name,
        slug: selected.slug,
        price: selected.price,
        headline: selected.headline || '',
        description: selected.description || '',
        type: selected.type,
        billingPeriod: selected.billingPeriod || 'monthly'
      });
      setNotice('');
    }
  }, [selected, isCreating]);

  const handleSave = async () => {
    if (isCreating) {
      if (!onCreateProduct) return;
      setBusy(true);
      setNotice('');
      try {
        await onCreateProduct({
          ...basicInfo,
          landingConfig: config
        });
        setNotice('Produk berhasil dibuat!');
        setIsCreating(false);
        setSelectedSlug(basicInfo.slug);
      } catch (err: any) {
        setNotice('Gagal membuat: ' + err.message);
      }
      setBusy(false);
      return;
    }

    if (!onUpdateProduct || !selected) return;
    setBusy(true);
    setNotice('');
    try {
      await onUpdateProduct(selected.id, { 
        name: basicInfo.name,
        slug: basicInfo.slug,
        price: basicInfo.price,
        headline: basicInfo.headline,
        description: basicInfo.description,
        type: basicInfo.type as any,
        billingPeriod: basicInfo.billingPeriod as any,
        landingConfig: config 
      });
      setNotice('Perubahan tersimpan!');
    } catch (err: any) {
      setNotice('Gagal menyimpan: ' + err.message);
    }
    setBusy(false);
  };

  const updateConfig = (key: keyof LandingConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBasic = (key: string, value: any) => {
    setBasicInfo(prev => ({ ...prev, [key]: value }));
  };

  const startCreate = () => {
    setIsCreating(true);
    setBasicInfo({ name: '', slug: '', price: 0, headline: '', description: '', type: 'tool', billingPeriod: 'monthly' });
    setConfig({ heroImageUrl: '', themeColor: '', benefits: [], testimonials: [] });
    setNotice('');
    setActiveTab('basic');
  };

  const cancelCreate = () => {
    setIsCreating(false);
    if (products[0]) setSelectedSlug(products[0].slug);
    setNotice('');
  };

  return (
    <section className="admin-content-grid landing-builder-grid">
      <div className="panel stack">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Landing Builder Pro</p>
            <h2>{isCreating ? 'Buat Produk & Landing Baru' : `Builder: ${selected?.name}`}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             {!isCreating && <button className="ghost-button" onClick={startCreate}>+ Buat Baru</button>}
             {isCreating && <button className="ghost-button" onClick={cancelCreate}>Batal</button>}
             <button className="primary" onClick={handleSave} disabled={busy || (!onUpdateProduct && !isCreating) || (!onCreateProduct && isCreating)}>
               {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
             </button>
          </div>
        </div>
        {notice && <p className="form-notice">{notice}</p>}
        
        {!isCreating && (
          <label>Pilih Produk
            <select value={selected?.slug ?? ''} onChange={(event) => setSelectedSlug(event.target.value)}>
              {products.map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}
            </select>
          </label>
        )}

        <div className="builder-tabs">
          <button className={activeTab === 'basic' ? 'active' : ''} onClick={() => setActiveTab('basic')}>Info Dasar</button>
          <button className={activeTab === 'visual' ? 'active' : ''} onClick={() => setActiveTab('visual')}>Visual & Hero</button>
          <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>Fitur & Testimoni</button>
        </div>

        <div className="tab-content" style={{ display: activeTab === 'basic' ? 'block' : 'none' }}>
           <div className="form-grid">
             <label>Nama Produk
               <input value={basicInfo.name} onChange={(e) => updateBasic('name', e.target.value)} placeholder="Contoh: Super Tools" />
             </label>
             <label>Slug (URL)
               <input value={basicInfo.slug} onChange={(e) => updateBasic('slug', e.target.value)} placeholder="super-tools" />
             </label>
           </div>
           <div className="form-grid">
             <label>Harga (Rp)
               <input type="number" value={basicInfo.price} onChange={(e) => updateBasic('price', parseInt(e.target.value) || 0)} />
             </label>
             <label>Tipe Penagihan
               <select value={basicInfo.billingPeriod} onChange={(e) => updateBasic('billingPeriod', e.target.value)}>
                 <option value="one_time">Sekali Bayar (Lifetime)</option>
                 <option value="monthly">Bulanan</option>
                 <option value="yearly">Tahunan</option>
               </select>
             </label>
           </div>
           <label>Headline (Judul Utama)
             <input value={basicInfo.headline} onChange={(e) => updateBasic('headline', e.target.value)} placeholder="Solusi terbaik untuk..." />
           </label>
           <label>Deskripsi Singkat
             <textarea value={basicInfo.description} onChange={(e) => updateBasic('description', e.target.value)} placeholder="Jelaskan produk secara singkat..." />
           </label>
        </div>

        <div className="tab-content" style={{ display: activeTab === 'visual' ? 'block' : 'none' }}>
          <div className="form-grid">
            <label>URL Gambar Hero
              <input value={config.heroImageUrl || ''} onChange={(e) => updateConfig('heroImageUrl', e.target.value)} placeholder="https://..." />
            </label>
            <label>Warna Tema Utama (Hex)
              <input value={config.themeColor || ''} onChange={(e) => updateConfig('themeColor', e.target.value)} placeholder="#14b8a6" />
            </label>
          </div>
        </div>

        <div className="tab-content" style={{ display: activeTab === 'content' ? 'block' : 'none' }}>
          <div className="builder-section">
            <h3>Fitur & Benefit</h3>
            {(config.benefits || []).map((b, i) => (
              <div key={i} className="builder-item-card" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={b.title} onChange={(e) => {
                  const newB = [...(config.benefits || [])];
                  newB[i].title = e.target.value;
                  updateConfig('benefits', newB);
                }} placeholder="Judul Benefit" style={{ flex: 1 }} />
                <input value={b.description} onChange={(e) => {
                  const newB = [...(config.benefits || [])];
                  newB[i].description = e.target.value;
                  updateConfig('benefits', newB);
                }} placeholder="Deskripsi Singkat" style={{ flex: 2 }} />
                <button className="ghost-button danger-lite" onClick={() => {
                  const newB = [...(config.benefits || [])];
                  newB.splice(i, 1);
                  updateConfig('benefits', newB);
                }}>Hapus</button>
              </div>
            ))}
            <button className="ghost-button" onClick={() => updateConfig('benefits', [...(config.benefits || []), { title: '', description: '' }])}>+ Tambah Benefit</button>
          </div>
          <div className="builder-section" style={{ marginTop: '24px' }}>
            <h3>Testimoni</h3>
            {(config.testimonials || []).map((t, i) => (
              <div key={i} className="builder-item-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={t.name} onChange={(e) => {
                    const newT = [...(config.testimonials || [])];
                    newT[i].name = e.target.value;
                    updateConfig('testimonials', newT);
                  }} placeholder="Nama (Cth: Budi)" style={{ flex: 1 }} />
                  <input value={t.role} onChange={(e) => {
                    const newT = [...(config.testimonials || [])];
                    newT[i].role = e.target.value;
                    updateConfig('testimonials', newT);
                  }} placeholder="Peran / Profesi" style={{ flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea value={t.content} onChange={(e) => {
                    const newT = [...(config.testimonials || [])];
                    newT[i].content = e.target.value;
                    updateConfig('testimonials', newT);
                  }} placeholder="Isi testimoni..." style={{ flex: 1 }} />
                  <button className="ghost-button danger-lite" onClick={() => {
                    const newT = [...(config.testimonials || [])];
                    newT.splice(i, 1);
                    updateConfig('testimonials', newT);
                  }} style={{ alignSelf: 'flex-start' }}>Hapus</button>
                </div>
              </div>
            ))}
            <button className="ghost-button" onClick={() => updateConfig('testimonials', [...(config.testimonials || []), { name: '', role: '', content: '' }])}>+ Tambah Testimoni</button>
          </div>
        </div>
      </div>
      
      <div className="panel stack" style={{ alignSelf: 'start', position: 'sticky', top: '16px', background: 'var(--bg)', borderColor: config.themeColor || 'var(--line)' }}>
        <p className="section-kicker">Live Preview</p>
        <h2 style={{ fontSize: '18px' }}>{basicInfo.name || 'Nama Produk'}</h2>
        <div className="landing-preview-card" style={{ borderColor: config.themeColor || 'var(--line)', background: 'var(--surface)', padding: '16px' }}>
          <span style={{ color: config.themeColor || undefined, fontSize: '11px', fontWeight: '900' }}>{basicInfo.type} · {basicInfo.billingPeriod}</span>
          <h3 style={{ fontSize: '16px', margin: '6px 0', lineHeight: 1.3 }}>{basicInfo.headline || 'Headline menarik di sini'}</h3>
          <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '0 0 12px 0' }}>{basicInfo.description || 'Deskripsi singkat produk.'}</p>
          <strong style={{ fontSize: '20px', color: 'var(--ink)' }}>Rp{basicInfo.price.toLocaleString('id-ID')}</strong>
          <div className="mini-checklist" style={{ marginTop: '12px', fontSize: '11px' }}>
            {(config.benefits || []).map((b, i) => <span key={i}>✓ {b.title || 'Benefit baru'}</span>)}
          </div>
          <button className="primary" style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '20px', background: config.themeColor || undefined }}>Beli Sekarang</button>
        </div>
        {!isCreating && selected && (
           <a href={`/produk/${selected.slug}`} target="_blank" rel="noreferrer" className="ghost-button" style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>Buka Halaman Publik</a>
        )}
      </div>
    </section>
  );
}

function AdminMemberPanel({ members, onRefresh, onUpdateMember }: {
  members: AdminMemberRow[];
  onRefresh: () => Promise<void>;
  onUpdateMember: (id: string, input: { name?: string; active?: boolean; password?: string }) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [notice, setNotice] = useState('');

  const filteredMembers = members.filter((member) => {
    const haystack = `${member.name} ${member.email} ${member.whatsapp ?? ''} ${member.telegramId ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const handleAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice('Aksi member berhasil diproses.');
    } catch (e: any) {
      setNotice(e instanceof Error ? e.message : 'Aksi member gagal diproses.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (member: AdminMemberRow) => {
    setEditingId(member.id);
    setEditName(member.name);
    setEditPassword('');
  };

  return (
    <section className="admin-content-grid compact-admin-grid">
      <div className="panel stack wide member-admin-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Member Database</p>
            <h2>Daftar Member</h2>
          </div>
          <button className="ghost-button" disabled={busy} onClick={() => handleAction(onRefresh)}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, WhatsApp, atau Telegram..." />
        {notice && <p className="form-notice">{notice}</p>}
        <div className="member-table-wrap">
          <div className="member-table member-table-head" aria-hidden="true">
            <span>Member</span><span>Kontak</span><span>Status</span><span>Aktivitas</span><span>Daftar</span><span>Aksi</span>
          </div>
          <div className="member-admin-list">
          {filteredMembers.length === 0 && <div className="empty-state">Belum ada member yang cocok.</div>}
          {filteredMembers.map((member) => (
            <article className="member-admin-card" key={member.id}>
              {editingId === member.id ? (
                <div className="member-edit-form">
                  <h4>Edit Member</h4>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nama member" />
                  <input value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Password baru (opsional, min 6 char)" type="password" />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button className="primary" type="button" onClick={() => handleAction(async () => {
                      const payload: any = { name: editName };
                      if (editPassword.length >= 6) payload.password = editPassword;
                      await onUpdateMember(member.id, payload);
                      setEditingId(null);
                    })}>Simpan</button>
                    <button className="ghost-button" type="button" onClick={() => setEditingId(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="member-admin-main">
                    <h3>{member.name}</h3>
                    <p>{member.email}</p>
                  </div>
                  <div className="member-admin-contact"><span>WA: {member.whatsapp || '-'}</span><span>TG: {member.telegramId || '-'}</span></div>
                  <span className={`status-dot ${member.active ? 'status-active' : 'status-expired'}`}>{member.active ? 'Aktif' : 'Banned'}</span>
                  <div className="member-admin-stats">
                    <span>{member.licenseCount} lisensi</span>
                    <span>{member.orderCount} order</span>
                    <span>{member.subscriptionCount} akses</span>
                  </div>
                  <div className="member-admin-meta">
                    <span>{formatDate(member.createdAt)}</span>
                    <small>Order: {member.latestOrder ? formatDate(member.latestOrder.createdAt) : '-'}</small>
                  </div>
                  <div className="member-admin-actions">
                    <button className="ghost-button tiny-button" type="button" disabled={busy} onClick={() => startEdit(member)}>Edit</button>
                    <button 
                      className={`ghost-button tiny-button ${member.active ? 'danger-lite' : ''}`} 
                      type="button"
                      disabled={busy} 
                      onClick={() => handleAction(() => onUpdateMember(member.id, { active: !member.active }))}
                    >
                      {member.active ? 'Ban' : 'Unban'}
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function DeployPanel({ settings, onDeployUpdate, onRefreshBotStatus, onSaveSettings, onStartBot, onStopBot }: {
  settings: DeploymentSettingsResult | null;
  onDeployUpdate: () => Promise<{ ok: boolean; message: string; stdout?: string; stderr?: string; detail?: string }>;
  onRefreshBotStatus: () => Promise<TelegramBotStatus>;
  onSaveSettings: (input: { githubRepo: string; githubBranch: string; githubToken?: string; telegramBotToken?: string; telegramOwnerId?: string; smtpHost?: string; smtpPort?: string; smtpUser?: string; smtpPass?: string; mailFrom?: string }) => Promise<void>;
  onStartBot: () => Promise<TelegramBotStatus>;
  onStopBot: () => Promise<TelegramBotStatus>;
}) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const [log, setLog] = useState('Belum ada update dijalankan.');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [githubRepo, setGithubRepo] = useState(settings?.githubRepo ?? 'effands/asistenq');
  const [githubBranch, setGithubBranch] = useState(settings?.githubBranch ?? 'master');
  const [githubToken, setGithubToken] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramOwnerId, setTelegramOwnerId] = useState(settings?.telegramOwnerId ?? '');
  const [telegramNotice, setTelegramNotice] = useState('');
  const [smtpHost, setSmtpHost] = useState(settings?.smtpHost ?? 'mail.asistenq.com');
  const [smtpPort, setSmtpPort] = useState(settings?.smtpPort ?? '465');
  const [smtpUser, setSmtpUser] = useState(settings?.smtpUser ?? 'cs@asistenq.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [mailFrom, setMailFrom] = useState(settings?.mailFrom ?? 'AsistenQ <cs@asistenq.com>');
  const [smtpNotice, setSmtpNotice] = useState('');
  const botStatus = settings?.botStatus;

  useEffect(() => {
    if (settings) {
      setGithubRepo(settings.githubRepo);
      setGithubBranch(settings.githubBranch);
      setTelegramOwnerId(settings.telegramOwnerId);
      setSmtpHost(settings.smtpHost || 'mail.asistenq.com');
      setSmtpPort(settings.smtpPort || '465');
      setSmtpUser(settings.smtpUser || 'cs@asistenq.com');
      setMailFrom(settings.mailFrom || 'AsistenQ <cs@asistenq.com>');
    }
  }, [settings]);

  return (
    <section className="deploy-settings-grid">
      <div className="panel deploy-action-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">GitHub Deployment</p>
            <h2>Update dari GitHub</h2>
          </div>
          <span className="soft-badge">Safe mode</span>
        </div>
        <div className="deploy-action-row">
          <p className="muted">Tarik versi terbaru dari repository.</p>
          <button className="primary deploy-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setLog('Menjalankan update dari GitHub...');
            try {
              const result = await onDeployUpdate();
              setLog([result.message, result.stdout, result.stderr, result.detail].filter(Boolean).join('\n\n'));
            } catch (error) {
              setLog(error instanceof Error ? error.message : 'Update gagal.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <UploadCloud size={18} /> {busy ? 'Mengupdate...' : 'Update dari GitHub'}
          </button>
        </div>
        <pre className="deploy-log compact-log">{log}</pre>
      </div>
      <form className="panel compact-token-card" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setSettingsNotice('Menyimpan token...');
        try {
          await onSaveSettings({
            githubRepo: githubRepo.trim(),
            githubBranch: githubBranch.trim(),
            githubToken: githubToken.trim(),
            telegramBotToken: '',
            telegramOwnerId,
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass: '',
            mailFrom
          });
          setGithubToken('');
          setSettingsNotice('Token GitHub tersimpan.');
        } catch (error) {
          setSettingsNotice(error instanceof Error ? error.message : 'Token gagal disimpan.');
        } finally {
          setSaving(false);
        }
      }}>
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Private GitHub</p>
            <h2>Token Repository</h2>
          </div>
          <span className="soft-badge">{settings?.hasGithubToken ? 'Token aktif' : 'Belum ada token'}</span>
        </div>
        <div className="compact-token-fields">
          <label>Repository<input value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)} placeholder="effands/asistenq" /></label>
          <label>Branch<input value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)} placeholder="master" /></label>
          <label className="span-two">GitHub Token / PAT<input value={githubToken} onChange={(event) => setGithubToken(event.target.value)} placeholder={settings?.maskedGithubToken || 'ghp_... atau github_pat_...'} type="password" /></label>
        </div>
        <p className="form-helper">Untuk repository private, gunakan GitHub Personal Access Token dengan akses read ke repository ini. Token disimpan di server dan hanya ditampilkan dalam bentuk masking.</p>
        <button className="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Token GitHub'}</button>
        {settingsNotice && <p className="form-notice">{settingsNotice}</p>}
      </form>
      <form className="panel compact-token-card" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setSmtpNotice('Menyimpan SMTP...');
        try {
          await onSaveSettings({
            githubRepo: githubRepo.trim(),
            githubBranch: githubBranch.trim(),
            githubToken: '',
            telegramBotToken: '',
            telegramOwnerId: telegramOwnerId.trim(),
            smtpHost: smtpHost.trim(),
            smtpPort: smtpPort.trim(),
            smtpUser: smtpUser.trim(),
            smtpPass: smtpPass.trim(),
            mailFrom: mailFrom.trim()
          });
          setSmtpPass('');
          setSmtpNotice('Setting SMTP tersimpan. Kalau password dikosongkan, password lama tetap dipakai.');
        } catch (error) {
          setSmtpNotice(error instanceof Error ? error.message : 'Setting SMTP gagal disimpan.');
        } finally {
          setSaving(false);
        }
      }}>
        <div className="panel-heading">
          <div><p className="section-kicker">SMTP Email</p><h2>Email Invoice & Lisensi</h2></div>
          <span className="soft-badge">{settings?.hasSmtpPass ? 'Password aktif' : 'Belum ada password'}</span>
        </div>
        <div className="compact-token-fields">
          <label>SMTP Host<input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="mail.asistenq.com" /></label>
          <label>SMTP Port<input value={smtpPort} onChange={(event) => setSmtpPort(event.target.value.replace(/\D/g, ''))} placeholder="465" inputMode="numeric" /></label>
          <label>SMTP User<input value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} placeholder="cs@asistenq.com" /></label>
          <label>SMTP Password<input value={smtpPass} onChange={(event) => setSmtpPass(event.target.value)} placeholder={settings?.maskedSmtpPass || 'Password email'} type="password" /></label>
          <label className="span-two">Mail From<input value={mailFrom} onChange={(event) => setMailFrom(event.target.value)} placeholder="AsistenQ <cs@asistenq.com>" /></label>
        </div>
        <p className="form-helper">Isi password email cPanel untuk cs@asistenq.com. Rekomendasi screenshot: host mail.asistenq.com, port 465.</p>
        <button className="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan SMTP'}</button>
        {smtpNotice && <p className="form-notice">{smtpNotice}</p>}
      </form>
      <form className="panel compact-token-card" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setTelegramNotice('Menyimpan...');
        try {
          await onSaveSettings({
            githubRepo: githubRepo.trim(),
            githubBranch: githubBranch.trim(),
            githubToken: '',
            telegramBotToken: telegramBotToken.trim(),
            telegramOwnerId: telegramOwnerId.trim(),
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass: '',
            mailFrom
          });
          setTelegramBotToken('');
          setTelegramNotice('Konfigurasi Telegram tersimpan.');
        } catch (error) {
          setTelegramNotice(error instanceof Error ? error.message : 'Token Telegram gagal disimpan.');
        } finally {
          setSaving(false);
        }
      }}>
        <div className="panel-heading">
          <div><p className="section-kicker">Telegram Bot</p><h2>Token Telegram</h2></div>
          <span className="soft-badge">{settings?.hasTelegramBotToken ? 'Token aktif' : 'Belum ada token'}</span>
        </div>
        <div className="compact-token-fields">
          <label>Owner ID<input value={telegramOwnerId} onChange={(event) => setTelegramOwnerId(event.target.value.replace(/\D/g, ''))} placeholder="ID Telegram angka" inputMode="numeric" /></label>
          <label>Bot Token<input value={telegramBotToken} onChange={(event) => setTelegramBotToken(event.target.value)} placeholder={settings?.maskedTelegramBotToken || 'Token dari BotFather'} type="password" /></label>
        </div>
        <button className="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Token Telegram'}</button>
        <div className="bot-control-strip">
          <div>
            <span className={`bot-dot ${botStatus?.running ? 'running' : ''}`} />
            <b>{botStatus?.running ? 'Bot aktif' : 'Bot mati'}</b>
            <small>{botStatus?.message ?? 'Status belum dicek.'}{botStatus?.pid ? ` PID ${botStatus.pid}` : ''}</small>
          </div>
          <div className="bot-control-actions">
            <button type="button" className="ghost-button tiny-button" disabled={botBusy} onClick={async () => {
              setBotBusy(true);
              try {
                const result = await onRefreshBotStatus();
                setTelegramNotice(result.message);
              } catch (error) {
                setTelegramNotice(error instanceof Error ? error.message : 'Gagal cek bot.');
              } finally {
                setBotBusy(false);
              }
            }}><RefreshCw size={13} /> Cek</button>
            <button type="button" className="ghost-button tiny-button" disabled={botBusy || botStatus?.running} onClick={async () => {
              setBotBusy(true);
              try {
                const result = await onStartBot();
                setTelegramNotice(result.message);
              } catch (error) {
                setTelegramNotice(error instanceof Error ? error.message : 'Bot gagal start.');
              } finally {
                setBotBusy(false);
              }
            }}><PlayCircle size={13} /> Start</button>
            <button type="button" className="ghost-button tiny-button" disabled={botBusy || !botStatus?.running} onClick={async () => {
              setBotBusy(true);
              try {
                const result = await onStopBot();
                setTelegramNotice(result.message);
              } catch (error) {
                setTelegramNotice(error instanceof Error ? error.message : 'Bot gagal stop.');
              } finally {
                setBotBusy(false);
              }
            }}>Stop</button>
          </div>
        </div>
        {telegramNotice && <p className="form-notice">{telegramNotice}</p>}
      </form>
    </section>
  );
}

function ProductForm({ onCreateProduct }: {
  onCreateProduct: (input: {
    name: string;
    slug: string;
    type: ProductType;
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
    ctaLabel?: string;
    accessRequirement?: string;
    headline: string;
    description: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('AsistenQ Video Helper');
  const [slug, setSlug] = useState('video-helper');
  const [type, setType] = useState<ProductType>('tool');
  const [visibility, setVisibility] = useState<ProductVisibility>('public');
  const [accessMode, setAccessMode] = useState<ProductAccessMode>('free_member');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [price, setPrice] = useState(149000);
  const [compareAtPrice, setCompareAtPrice] = useState(0);
  const [discountLabel, setDiscountLabel] = useState('');
  const [promoText, setPromoText] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [landingPath, setLandingPath] = useState('');
  const [landingTemplate, setLandingTemplate] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Daftar jadi member');
  const [accessRequirement, setAccessRequirement] = useState('Daftar jadi member untuk membuka akses.');
  const [headline, setHeadline] = useState('Bantu produksi video lebih cepat.');
  const [description, setDescription] = useState('Produk AsistenQ untuk workflow editing dan YouTube.');

  return (
    <form className="panel stack wide product-create-form" onSubmit={async (event) => {
      event.preventDefault();
      await onCreateProduct({
        name,
        slug,
        type,
        visibility,
        accessMode,
        billingPeriod,
        price,
        compareAtPrice: compareAtPrice || undefined,
        discountLabel: discountLabel.trim() || undefined,
        promoText: promoText.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        landingPath: landingPath.trim() || undefined,
        landingTemplate: landingTemplate.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        accessRequirement: accessRequirement.trim() || undefined,
        headline,
        description
      });
    }}>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Catalog control</p>
          <h2>Tambah Produk</h2>
          <p className="form-intro">Isi data utama dulu. Pengaturan landing dan promo bisa dibuka bila diperlukan.</p>
        </div>
        <span className="soft-badge">{type}</span>
      </div>
      <div className="product-form-section">
        <div className="product-form-section-title"><span>01</span><div><strong>Informasi utama</strong><small>Identitas yang terlihat oleh member.</small></div></div>
        <div className="product-form-grid">
          <label className="col-3">Nama produk<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: MIXIN9" /></label>
          <label className="col-2">Slug / alamat<input required value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="mixin9" /><small>Huruf kecil, angka, dan tanda minus.</small></label>
          <label className="col-1">Jenis produk<select value={type} onChange={(event) => setType(event.target.value as ProductType)}>{productTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </div>
      <div className="product-form-section">
        <div className="product-form-section-title"><span>02</span><div><strong>Akses & harga</strong><small>Atur siapa yang dapat melihat dan membuka produk.</small></div></div>
        <div className="product-form-grid">
          <label className="col-2">Tampil di katalog<select value={visibility} onChange={(event) => setVisibility(event.target.value as ProductVisibility)}>{productVisibilities.map((item) => <option key={item} value={item}>{item === 'public' ? 'Publik' : item === 'private' ? 'Link privat' : 'Draft'}</option>)}</select></label>
          <label className="col-2">Syarat akses<select value={accessMode} onChange={(event) => setAccessMode(event.target.value as ProductAccessMode)}>{productAccessModes.map((item) => <option key={item} value={item}>{item === 'public' ? 'Tanpa login' : item === 'free_member' ? 'Member gratis' : item === 'trial' ? 'Trial aktif' : item === 'paid' ? 'Sudah bayar' : 'Admin saja'}</option>)}</select></label>
          <label className="col-1">Periode<select value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}>{billingPeriods.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="col-1">Harga (Rp)<input min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} type="number" /></label>
        </div>
      </div>
      <details className="product-advanced">
        <summary>Pengaturan lanjutan <small>Landing, promo, logo, dan teks produk</small></summary>
        <div className="product-advanced-content">
          <div className="product-form-grid">
            <label className="col-2">Harga coret (Rp)<input min="0" value={compareAtPrice} onChange={(event) => setCompareAtPrice(Number(event.target.value))} type="number" placeholder="0" /></label>
            <label className="col-2">Badge promo<input value={discountLabel} onChange={(event) => setDiscountLabel(event.target.value)} placeholder="Contoh: Free Beta" /></label>
            <label className="col-2">Teks promo<input value={promoText} onChange={(event) => setPromoText(event.target.value)} placeholder="Promo singkat" /></label>
            
            <label className="col-3">URL logo<input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://.../logo.png" /></label>
            <label className="col-1">Path halaman<input value={landingPath} onChange={(event) => setLandingPath(event.target.value)} placeholder="/mixin9" /></label>
            <label className="col-2">Template<input value={landingTemplate} onChange={(event) => setLandingTemplate(event.target.value)} placeholder="mixin9 atau tool-app" /></label>
            
            <label className="col-2">Label tombol<input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} placeholder="Ambil sekarang" /></label>
            <label className="col-4">Headline<input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Manfaat utama produk" /></label>
            
            <label className="col-3">Syarat akses<textarea value={accessRequirement} onChange={(event) => setAccessRequirement(event.target.value)} placeholder="Contoh: Daftar sebagai member" /></label>
            <label className="col-3">Deskripsi<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Jelaskan fungsi produk secara singkat" /></label>
          </div>
        </div>
      </details>
      <div className="product-form-footer"><span>Produk bisa diedit kembali setelah disimpan.</span><button className="primary"><PackagePlus size={18} /> Simpan Produk</button></div>
    </form>
  );
}

function Metric({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: number; onClick: () => void }) {
  return (
    <button className="metric" type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      <ArrowRight className="metric-arrow" size={16} />
    </button>
  );
}

function ProductTable({ products, onUpdateProduct, onImportLandingZip }: {
  products: PublicProduct[];
  onUpdateProduct: (productId: string, input: Partial<PublicProduct>) => Promise<void>;
  onImportLandingZip: (productId: string, file: File) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<Partial<PublicProduct>>({});
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'all' | 'landing' | 'tool'>('all');
  const filteredProducts = products.filter((product) => {
    const isToolApp = product.landingTemplate === 'tool-app';
    return filter === 'all' || (filter === 'tool' ? isToolApp : !isToolApp);
  });

  function startEdit(product: PublicProduct) {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      slug: product.slug,
      visibility: product.visibility,
      accessMode: product.accessMode,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      discountLabel: product.discountLabel,
      promoText: product.promoText,
      logoUrl: product.logoUrl,
      landingPath: product.landingPath,
      landingTemplate: product.landingTemplate,
      ctaLabel: product.ctaLabel,
      accessRequirement: product.accessRequirement,
      headline: product.headline,
      description: product.description,
      accessUrl: product.accessUrl
    });
  }

  return (
    <div className="panel wide">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Inventory</p>
          <h2>Produk Aktif</h2>
        </div>
        <div className="product-filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} type="button">Semua</button>
          <button className={filter === 'landing' ? 'active' : ''} onClick={() => setFilter('landing')} type="button">Landing</button>
          <button className={filter === 'tool' ? 'active' : ''} onClick={() => setFilter('tool')} type="button">Tools</button>
        </div>
      </div>
      <div className="product-admin-list">
        {filteredProducts.map((product) => (
          <article className="product-admin-card" key={product.id}>
            <div className="product-admin-summary">
              <div className="product-icon">{product.logoUrl ? <img src={product.logoUrl} alt="" /> : productIcon(product)}</div>
              <div>
                <strong>{product.name}</strong>
                <span><b>{product.landingTemplate === 'tool-app' ? 'TOOL APP' : 'LANDING'}</b> · {product.landingPath ?? `/produk/${product.slug}`} · {product.visibility ?? 'public'} · {product.accessMode ?? 'public'} · {product.price === 0 ? 'Gratis' : product.formattedPrice}</span>
              </div>
              <button className="ghost-button" type="button" onClick={() => startEdit(product)}>Edit</button>
            </div>
            {editingId === product.id && (
              <div className="product-edit-box">
                <div className="form-grid">
                  <input value={draft.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nama" />
                  <input value={draft.slug ?? ''} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="slug" />
                  <select value={draft.visibility ?? 'public'} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as ProductVisibility })}>
                    {productVisibilities.map((item) => <option key={item} value={item}>{item === 'public' ? 'Public marketplace' : item === 'private' ? 'Private link' : 'Draft/admin only'}</option>)}
                  </select>
                  <select value={draft.accessMode ?? 'public'} onChange={(event) => setDraft({ ...draft, accessMode: event.target.value as ProductAccessMode })}>
                    {productAccessModes.map((item) => <option key={item} value={item}>{item === 'public' ? 'Public page' : item === 'free_member' ? 'Free member' : item === 'trial' ? 'Trial/subscription' : item === 'paid' ? 'Paid only' : 'Admin only'}</option>)}
                  </select>
                  <input value={draft.price ?? 0} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} type="number" placeholder="Harga" />
                  <input value={draft.compareAtPrice ?? 0} onChange={(event) => setDraft({ ...draft, compareAtPrice: Number(event.target.value) || undefined })} type="number" placeholder="Harga coret" />
                  <input value={draft.discountLabel ?? ''} onChange={(event) => setDraft({ ...draft, discountLabel: event.target.value })} placeholder="Badge promo" />
                  <input value={draft.promoText ?? ''} onChange={(event) => setDraft({ ...draft, promoText: event.target.value })} placeholder="Promo text" />
                  <input value={draft.logoUrl ?? ''} onChange={(event) => setDraft({ ...draft, logoUrl: event.target.value })} placeholder="URL logo" />
                  <input value={draft.landingPath ?? ''} onChange={(event) => setDraft({ ...draft, landingPath: event.target.value })} placeholder="/mixin9" />
                  <input value={draft.landingTemplate ?? ''} onChange={(event) => setDraft({ ...draft, landingTemplate: event.target.value })} placeholder="mixin9 / zip-html" />
                  <input value={draft.ctaLabel ?? ''} onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })} placeholder="CTA" />
                </div>
                <textarea value={draft.headline ?? ''} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} placeholder="Headline" />
                <textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Deskripsi" />
                <textarea value={draft.accessRequirement ?? ''} onChange={(event) => setDraft({ ...draft, accessRequirement: event.target.value })} placeholder="Syarat akses" />
                <div className="product-edit-actions">
                  <button className="primary" type="button" onClick={async () => {
                    await onUpdateProduct(product.id, {
                      ...draft,
                      discountLabel: draft.discountLabel?.trim() || undefined,
                      promoText: draft.promoText?.trim() || undefined,
                      logoUrl: draft.logoUrl?.trim() || undefined,
                      landingPath: draft.landingPath?.trim() || undefined,
                      landingTemplate: draft.landingTemplate?.trim() || undefined,
                      ctaLabel: draft.ctaLabel?.trim() || undefined,
                      accessRequirement: draft.accessRequirement?.trim() || undefined
                    });
                    setNotice(`${product.name} tersimpan.`);
                    setEditingId('');
                  }}>Simpan Perubahan</button>
                  <label className="zip-upload-button">
                    Import ZIP landing
                    <input type="file" accept=".zip,application/zip" onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await onImportLandingZip(product.id, file);
                      setNotice(`ZIP landing ${product.name} berhasil diimport.`);
                      event.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      {notice && <p className="form-notice">{notice}</p>}
    </div>
  );
}

function productIcon(product: PublicProduct) {
  if (product.type === 'course' || product.type === 'class') return <GraduationCap />;
  if (product.type === 'video') return <Film />;
  if (product.type === 'free') return <Sparkles />;
  if (product.category?.toLowerCase().includes('audio')) return <Monitor />;
  return <WandSparkles />;
}

function ProductCard({ product, label, featured = false, onOpen }: {
  product: PublicProduct;
  label?: string;
  featured?: boolean;
  onOpen?: (slug: string) => void;
}) {
  return (
    <article className={featured ? 'market-card featured-product-card' : 'market-card'}>
      {featured && product.coverUrl ? (
        <div className="product-cover">
          <img src={product.coverUrl} alt={product.name} />
        </div>
      ) : null}
      <div className="market-card-top">
        <div className="product-icon">
          {product.logoUrl ? <img src={product.logoUrl} alt="" /> : productIcon(product)}
        </div>
        <span>{product.discountLabel || label || product.type}</span>
      </div>
      <h3>{product.name}</h3>
      <p>{product.promoText || product.description || product.headline}</p>
      <div className="market-card-footer">
        <div className="price-stack">
          {product.compareAtPrice ? <small>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.compareAtPrice).replace(/\s/g, '')}</small> : null}
          <strong>{product.price === 0 ? 'Gratis' : product.formattedPrice}</strong>
        </div>
        <button className="ghost-button" onClick={() => onOpen?.(product.slug)}>Lihat detail <ArrowRight size={15} /></button>
      </div>
    </article>
  );
}

function Marketplace({ catalog, onJoin, onProductOpen }: {
  catalog: PublicCatalog;
  onJoin: () => void;
  onProductOpen: (slug: string) => void;
}) {
  const primaryProduct = catalog.featured[0] ?? catalog.paid[0];

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="hero-orb hero-orb-a" />
        <div className="hero-orb hero-orb-b" />
        <div className="hero-content">
          <div className="hero-badge"><Sparkles size={16} /> Tools creator, lisensi, course, dan freebies</div>
          <h1>Rumah tools creator: gratis, premium, dan member-only.</h1>
          <p>Kumpulan aplikasi AsistenQ untuk workflow creator. Banyak tools gratis, cukup daftar member untuk ambil akses dan update.</p>
          <div className="hero-actions">
            <button className="primary public-hero-button" onClick={onJoin}>Daftar member gratis <ArrowRight size={18} /></button>
            <a className="text-link" href="#produk">Lihat produk</a>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={16} /> Member-only access</span>
            <span><CreditCard size={16} /> QRIS ready</span>
            <span><BookOpen size={16} /> Free tools & course</span>
          </div>
        </div>
        <aside className="hero-console">
          <div className="console-header">
            <span />
            <span />
            <span />
          </div>
          <div className="console-product">
            <p>Tools unggulan</p>
            <h2>{primaryProduct?.name ?? 'VJ Studio Pro'}</h2>
            <span>{primaryProduct?.headline ?? 'Lisensi resmi untuk workflow video YouTube yang lebih cepat.'}</span>
          </div>
          <div className="license-preview">
            <div>
              <small>Akses mulai</small>
              <strong>{primaryProduct?.formattedPrice ?? 'Rp49.900'}</strong>
            </div>
            <div>
              <small>Status</small>
              <strong>Ready</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="brand-strip">
        <span>Creator tools</span>
        <span>Free tools</span>
        <span>Audio tools</span>
        <span>YouTube workflow</span>
        <span>E-learning</span>
      </section>

      <section className="landing-section" id="produk">
        <div className="section-head">
          <div>
            <p className="section-kicker">Featured Tools</p>
            <h2>Tools yang siap kamu pakai</h2>
          </div>
          <p>Pilih aplikasi gratis, tools premium, atau kelas. Semua aksesnya dirapikan lewat akun member.</p>
        </div>
        <div className="market-grid featured-market-grid">
          {catalog.featured.map((product) => (
            <ProductCard key={product.id} product={product} label="unggulan" featured onOpen={onProductOpen} />
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Free Tools</p>
            <h2>Bisa diakses langsung setelah login</h2>
          </div>
        </div>
        <div className="free-tools-grid">
          {catalog.free.map((product) => (
            <button key={product.id} className="free-tool-item" onClick={() => onProductOpen(product.slug)}>
              <div className="product-icon">
                {product.logoUrl ? <img src={product.logoUrl} alt="" /> : productIcon(product)}
              </div>
              <span>{product.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div>
          <p className="section-kicker">Mulai sekarang</p>
          <h2>Pilih tools atau kelas yang kamu butuhkan, lalu aktifkan lewat akun member.</h2>
        </div>
        <button className="primary public-hero-button" onClick={onJoin}>Buat akun member</button>
      </section>
    </main>
  );
}

function ProductLanding({ isLoading, product, onJoin }: { isLoading: boolean; product?: PublicProduct; onJoin: () => void }) {
  if (isLoading) {
    return (
      <main className="product-landing">
        <section className="product-sales-hero">
          <p className="section-kicker">Memuat produk</p>
          <h1>Menyiapkan landing page...</h1>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-landing">
        <section className="product-sales-hero">
          <p className="section-kicker">Produk tidak ditemukan</p>
          <h1>Produk belum tersedia.</h1>
          <a className="primary public-hero-button" href="/">Kembali ke marketplace</a>
        </section>
      </main>
    );
  }

  if (product.landingTemplate === 'mixin9' || product.slug === 'mixin9') {
    return <Mixin9Landing product={product} onJoin={onJoin} />;
  }

  const conf = product.landingConfig || {};
  const hasBenefits = conf.benefits && conf.benefits.length > 0;
  const hasTestimonials = conf.testimonials && conf.testimonials.length > 0;

  // Fallback to old hardcoded benefits if none are configured
  const defaultBenefits = product.type === 'course' || product.type === 'class'
    ? ['Materi bertahap dan mudah diikuti', 'Akses kelas melalui akun member', 'Update materi']
    : ['Aktivasi lisensi per perangkat', 'Membantu workflow produksi video', 'Cocok untuk creator'];

  const customStyle = conf.themeColor ? { '--teal': conf.themeColor, '--primary': conf.themeColor } as any : {};

  return (
    <main className="product-landing" style={customStyle}>
      <section className="product-sales-hero" style={conf.heroImageUrl ? { background: `linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${conf.heroImageUrl}) center/cover` } : {}}>
        <div>
          <span className="chip">{product.discountLabel || product.category || product.type}</span>
          <h1 style={conf.heroImageUrl ? { color: '#fff' } : {}}>{product.headline || product.name}</h1>
          <p style={conf.heroImageUrl ? { color: '#eee' } : {}}>{product.promoText || product.description}</p>
          <div className="hero-actions">
            <button className="primary public-hero-button" onClick={onJoin}>{product.ctaLabel || 'Aktifkan lewat member'} <ArrowRight size={18} /></button>
            <a className={conf.heroImageUrl ? 'text-link dark-link-alt' : 'text-link dark-link'} href="#harga" style={conf.heroImageUrl ? { color: '#fff' } : {}}>Lihat harga</a>
          </div>
        </div>
        <aside className="product-price-card" id="harga">
          <p>Paket mulai</p>
          {product.compareAtPrice ? <small className="compare-price">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.compareAtPrice).replace(/\s/g, '')}</small> : null}
          <h2>{product.price === 0 ? 'Gratis' : product.formattedPrice}</h2>
          <span>{product.billingPeriod}</span>
          <button className="primary" onClick={onJoin}>Masuk member</button>
        </aside>
      </section>

      <section className="product-sales-grid">
        <div className="panel stack">
          <p className="section-kicker">Benefit</p>
          <h2>Apa yang kamu dapatkan?</h2>
          {hasBenefits ? (
            <div className="dynamic-benefits">
              {conf.benefits!.map((b, i) => (
                <div key={i} className="benefit-item">
                  <div className="benefit-icon"><CheckCircle2 size={20} /></div>
                  <div>
                    <h4>{b.title}</h4>
                    <p>{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mini-checklist">
              {defaultBenefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
            </div>
          )}
        </div>
        
        {hasTestimonials && (
          <div className="panel stack">
            <p className="section-kicker">Testimoni</p>
            <h2>Apa kata mereka?</h2>
            <div className="testimonials-grid">
              {conf.testimonials!.map((t, i) => (
                <div key={i} className="testimonial-card">
                  <p>"{t.content}"</p>
                  <div className="testimonial-author">
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel stack">
          <p className="section-kicker">Cara mulai</p>
          <h2>Daftar, bayar QRIS, lalu akses.</h2>
          <p>{product.accessRequirement || 'Alur dibuat simpel: buat akun member, pilih produk, lakukan pembayaran, lalu akses lisensi atau materi dari member area.'}</p>
        </div>
      </section>
    </main>
  );
}

function Mixin9Landing({ product, onJoin }: { product: PublicProduct; onJoin: () => void }) {
  const price = product.price === 0 ? 'Gratis' : product.formattedPrice;
  const comparePrice = product.compareAtPrice
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.compareAtPrice).replace(/\s/g, '')
    : '';

  return (
    <main className="mixin9-page">
      <section className="mixin9-hero">
        <div className="mixin9-copy">
          <span className="mixin9-pill">{product.discountLabel || 'MIXIN9 Audio Batch Mixing'}</span>
          <h1>{product.headline}</h1>
          <p>{product.promoText || product.description}</p>
          <div className="hero-actions">
            <button className="primary mixin9-cta" onClick={onJoin}>{product.ctaLabel || 'Ambil MIXIN9 Gratis'} <ArrowRight size={18} /></button>
            <a className="text-link" href="#mixin9-fitur">Lihat fitur</a>
          </div>
          <div className="mixin9-meter">
            <span>Batch normalize</span>
            <span>Auto balance</span>
            <span>Export ready</span>
          </div>
        </div>
        <aside className="mixin9-console">
          <div className="mixin9-logo">{product.logoUrl ? <img src={product.logoUrl} alt="MIXIN9" /> : 'M9'}</div>
          <div className="wave-bars">
            {Array.from({ length: 24 }).map((_, index) => <span key={index} style={{ height: `${22 + (index % 7) * 9}px` }} />)}
          </div>
          <div className="mixin9-price">
            {comparePrice && <small>{comparePrice}</small>}
            <strong>{price}</strong>
            <span>{product.accessRequirement || 'Daftar jadi member untuk membuka akses.'}</span>
          </div>
        </aside>
      </section>

      <section className="mixin9-grid" id="mixin9-fitur">
        {[
          ['01', 'Batch workflow', 'Masukkan banyak file audio dan proses dalam satu antrian kerja.'],
          ['02', 'Creator friendly', 'Cocok untuk konten YouTube, podcast pendek, voice over, dan materi kelas.'],
          ['03', 'Member access', 'Akses download dan update disimpan rapi di area member AsistenQ.']
        ].map(([num, title, text]) => (
          <article key={num} className="mixin9-feature-card">
            <span>{num}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="mixin9-final">
        <div>
          <p className="section-kicker">Free access</p>
          <h2>Cukup daftar member, lalu ambil akses MIXIN9.</h2>
        </div>
        <button className="primary mixin9-cta" onClick={onJoin}>Daftar member</button>
      </section>
    </main>
  );
}

function MemberPanel({ session, products, dashboard, orders, onRegister, onLogin, onCheckout, onLogout }: {
  session: LoginResult | null;
  products: PublicProduct[];
  dashboard: MemberLicenseDashboard | null;
  orders: PublicOrder[];
  onRegister: (name: string, email: string, password: string, whatsapp: string, telegramId: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onCheckout: (productId: string) => Promise<PublicOrder | undefined>;
  onLogout: () => void;
}) {
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [activeOrder, setActiveOrder] = useState<PublicOrder | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeMemberTab, setActiveMemberTab] = useState<'licenses' | 'products' | 'orders' | 'course' | 'help'>('licenses');

  if (!session) {
    return (
      <main className="member-page member-auth-page">
        <section className="member-hero compact-member-hero">
          <span className="chip">Member Area</span>
          <h1>Akses lisensi dan kelas.</h1>
          <p>Masuk untuk melihat token VJ Studio, status device, pembelian QRIS, dan materi course AsistenQ.</p>
        </section>
        <div className="member-auth-single">
          <LoginBox
            title={authMode === 'login' ? 'Login Member' : 'Daftar Member'}
            showName={authMode === 'register'}
            submitLabel={authMode === 'login' ? 'Masuk' : 'Daftar'}
            onSubmit={authMode === 'login' ? (_, email, password) => onLogin(email, password) : onRegister}
            footer={(
              <span className="auth-switch-copy">
                {authMode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
                <button
                  className="link-button inline-link"
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                >
                  {authMode === 'login' ? 'Daftar' : 'Login'}
                </button>
              </span>
            )}
          />
        </div>
      </main>
    );
  }

  const ownedLicenses = dashboard?.licenses ?? [];
  const paidProducts = products.filter((product) => product.visibility === 'public');

  return (
    <main className="member-page">
      <section className="member-dashboard-hero">
        <div>
          <span className="chip">Member Workspace</span>
          <h1>Halo, {session.user.name}. Ini pusat aksesmu.</h1>
        </div>
        <div className="member-stat-card">
          <span>Total lisensi</span>
          <strong>{ownedLicenses.length}</strong>
          <small>{session.user.email}</small>
        </div>
      </section>

      <section className="member-tabs">
        <div className="member-tab-list" aria-label="Menu member">
          <button className={activeMemberTab === 'licenses' ? 'active' : ''} onClick={() => setActiveMemberTab('licenses')}>Lisensi</button>
          <button className={activeMemberTab === 'products' ? 'active' : ''} onClick={() => setActiveMemberTab('products')}>Beli Produk</button>
          <button className={activeMemberTab === 'orders' ? 'active' : ''} onClick={() => setActiveMemberTab('orders')}>History</button>
          <button className={activeMemberTab === 'course' ? 'active' : ''} onClick={() => setActiveMemberTab('course')}>Course</button>
          <button className={activeMemberTab === 'help' ? 'active' : ''} onClick={() => setActiveMemberTab('help')}>Bantuan</button>
        </div>

        {activeMemberTab === 'licenses' && (
          <div className="panel stack member-license-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">License Vault</p>
                <h2>Lisensi Saya</h2>
              </div>
              <span className="soft-badge">{ownedLicenses.length} lisensi</span>
            </div>
            {ownedLicenses.length === 0 && (
              <div className="empty-state">
                Belum ada lisensi aktif untuk email ini. Setelah admin membuat lisensi VJ Studio dengan email akunmu, token akan muncul otomatis di sini.
              </div>
            )}
            <div className="member-license-grid">
              {ownedLicenses.map((license) => (
                <article className="member-license-card" key={license.id}>
                  <div className="license-card-head">
                    <span className={`status-dot status-${license.status}`}>{licenseStatusLabel(license)}</span>
                    <strong>{license.product?.name ?? license.productId}</strong>
                  </div>
                  <div className="license-detail-grid">
                    <span>Plan<b>{license.plan?.name ?? license.planId}</b></span>
                    <span>Expired<b>{formatDate(license.expiresAt)}</b></span>
                    <span>Device HWID<b>{license.hwid}</b></span>
                    <span>Aktivasi<b>{license.activatedAt ? formatDate(license.activatedAt) : 'Belum dipakai'}</b></span>
                  </div>
                  <div className="member-token-box">
                    <small>Token Lisensi</small>
                    <code>{license.key}</code>
                    <button className="primary" onClick={() => navigator.clipboard.writeText(license.key)}>Copy Token</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeMemberTab === 'products' && (
          <div className="member-products-panel">
            <div className="member-products-head">
              <div>
                <p className="section-kicker">Marketplace Member</p>
                <h2>Beli Produk</h2>
              </div>
              <span className="soft-badge">QRIS</span>
            </div>
            <div className="member-product-list">
              {paidProducts.map((product) => (
                <article className="member-product-card" key={product.id}>
                  <button className="member-product-link" type="button" onClick={() => {
                    window.history.pushState({}, '', product.landingPath ?? `/produk/${product.slug}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}>
                    Lihat landing <ArrowRight size={14} />
                  </button>
                  <div className="member-product-top">
                    <span>{product.type}</span>
                    {productIcon(product)}
                  </div>
                  <strong>{product.name}</strong>
                  <small>{product.headline}</small>
                  <div className="member-product-footer">
                    <b>{product.price === 0 ? 'Gratis' : product.formattedPrice}</b>
                    <button className="primary" onClick={async () => {
                      setCheckoutNotice('');
                      const order = await onCheckout(product.id);
                      if (order) {
                        setActiveOrder(order);
                        setCheckoutNotice(`Invoice ${order.invoiceNumber} dibuat untuk ${product.name}.`);
                      }
                    }}>
                      {product.price === 0 ? 'Ambil' : 'Beli'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {checkoutNotice && <p className="form-notice">{checkoutNotice}</p>}
          </div>
        )}

        {activeMemberTab === 'orders' && (
          <div className="panel stack member-order-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Riwayat Pembelian</p>
                <h2>Invoice & Order</h2>
              </div>
              <span className="soft-badge">{orders.length} order</span>
            </div>
            {orders.length === 0 && <div className="empty-state">Belum ada order. Pilih produk dulu untuk membuat invoice.</div>}
            <div className="order-history-list">
              {orders.map((order) => (
                <article className="order-history-card" key={order.id}>
                  <div className="order-history-main">
                    <span className={`status-dot status-${order.status}`}>{order.status}</span>
                    <strong>{order.invoiceNumber ?? order.id}</strong>
                    <b>{order.product?.name ?? order.productName ?? order.productId}</b>
                    <small>{formatDate(order.createdAt)} · Sisa bayar: {formatRemaining(order.expiresAt)}</small>
                  </div>
                  <div className="order-history-total">
                    <span>Total bayar</span>
                    <b>{order.formattedTotalAmount}</b>
                    <small>Kode unik: {order.uniqueCode ?? 0}</small>
                  </div>
                  <div className="order-history-actions">
                    <button className="ghost-button" onClick={() => setActiveOrder(order)}>Lihat QRIS</button>
                    <a className="ghost-button" href={`/api/member/orders/${order.id}/invoice.html`} target="_blank" rel="noreferrer">Download Invoice</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeMemberTab === 'course' && (
          <div className="panel stack member-help-panel">
            <p className="section-kicker">Course Access</p>
            <h2>Kelas YouTube dan materi pendukung.</h2>
            <p className="muted">Nanti akses video tutorial, ebook, template, dan update kelas akan ditampilkan di tab ini. Struktur ini sudah siap untuk course online maupun offline.</p>
            <div className="mini-checklist">
              <span>Materi video tersusun per modul.</span>
              <span>Resource pendukung dan ebook.</span>
              <span>Akses tahunan sesuai paket pembelian.</span>
            </div>
          </div>
        )}

        {activeMemberTab === 'help' && (
          <div className="panel stack member-help-panel">
            <p className="section-kicker">Cara Aktivasi VJ Studio</p>
            <h2>Aktivasi pakai HWID dan token lisensi.</h2>
            <div className="mini-checklist">
              <span>1. Buka VJ Studio Pro di device pembeli.</span>
              <span>2. Salin Device ID / HWID dari aplikasi.</span>
              <span>3. Admin generate token lisensi berdasarkan HWID itu.</span>
              <span>4. Member salin token dari dashboard ini lalu aktivasi di aplikasi.</span>
            </div>
          </div>
        )}
      </section>
      {activeOrder && <InvoiceModal order={activeOrder} onClose={() => setActiveOrder(null)} />}
    </main>
  );
}

function InvoiceModal({ order, onClose }: { order: PublicOrder; onClose: () => void }) {
  const telegramText = [
    'Konfirmasi pembayaran AsistenQ',
    `Invoice: ${order.invoiceNumber ?? order.id}`,
    `Produk: ${order.product?.name ?? order.productName ?? order.productId}`,
    `Email: ${order.memberEmail ?? '-'}`,
    `Total: ${order.formattedTotalAmount}`,
    '',
    'Saya sudah transfer sesuai total invoice. Bukti transfer saya lampirkan di chat ini.'
  ].join('\n');
  const telegramConfirmUrl = `https://t.me/share/url?url=${encodeURIComponent('https://asistenq.com')}&text=${encodeURIComponent(telegramText)}`;

  return (
    <div className="invoice-backdrop" role="dialog" aria-modal="true">
      <article className="invoice-modal">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Invoice QRIS</p>
            <h2>{order.invoiceNumber ?? 'Invoice'}</h2>
          </div>
          <button className="ghost-button" onClick={onClose}>Tutup</button>
        </div>
        <div className="invoice-body">
          <div className="invoice-summary">
            <span>Produk<b>{order.product?.name ?? order.productName ?? order.productId}</b></span>
            <span>Harga<b>{order.formattedAmount}</b></span>
            <span>Kode unik<b>{order.uniqueCode ?? 0}</b></span>
            <span>Total bayar<b>{order.formattedTotalAmount}</b></span>
            <span>Status<b>{order.status}</b></span>
            <span>Sisa waktu<b>{formatRemaining(order.expiresAt)}</b></span>
          </div>
          <div className="qris-box">
            {order.paymentQrUrl && <img src={order.paymentQrUrl} alt="QRIS pembayaran" />}
            <p>Scan QRIS ini lalu bayar sesuai total invoice. Kode unik membantu admin mencocokkan transaksi.</p>
            <div className="payment-confirm-box">
              <strong>Sudah bayar?</strong>
              <span>Kirim konfirmasi dan bukti transfer via Telegram agar admin bisa cek lalu kirim lisensi.</span>
              <a className="primary" href={telegramConfirmUrl} target="_blank" rel="noreferrer">Konfirmasi via Telegram</a>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
