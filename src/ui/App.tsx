import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  CreditCard,
  Film,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogIn,
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
import type { BillingPeriod, ProductType } from '../shared/types';
import {
  apiRequest,
  type AdminLicenseDashboard,
  type ForgotPasswordResult,
  type LicenseDashboardRow,
  type LoginResult,
  type MemberLicenseDashboard,
  type PublicCatalog,
  type PublicProduct,
  type Summary
} from './api';

type Route = 'home' | 'admin' | 'member' | 'product';
type AdminSection = 'dashboard' | 'landing' | 'licenses' | 'deploy';
type AdminTheme = 'light' | 'dark';

const productTypes: ProductType[] = ['tool', 'course', 'ebook', 'video', 'bundle', 'free', 'class'];
const billingPeriods: BillingPeriod[] = ['trial', 'monthly', 'annual', 'lifetime', 'one_time'];
const emptyCatalog: PublicCatalog = { featured: [], paid: [], free: [] };

function routeFromPath(pathname: string): Route {
  if (pathname.startsWith('/adminasistenq')) return 'admin';
  if (pathname.startsWith('/member')) return 'member';
  if (pathname.startsWith('/produk/')) return 'product';
  return 'home';
}

function productSlugFromPath(pathname: string): string {
  return pathname.startsWith('/produk/') ? decodeURIComponent(pathname.replace('/produk/', '').split('/')[0]) : '';
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [catalog, setCatalog] = useState<PublicCatalog>(emptyCatalog);
  const [adminSession, setAdminSession] = useState<LoginResult | null>(null);
  const [memberSession, setMemberSession] = useState<LoginResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [memberDashboard, setMemberDashboard] = useState<MemberLicenseDashboard | null>(null);
  const [adminLicenses, setAdminLicenses] = useState<AdminLicenseDashboard | null>(null);
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
    window.history.pushState({}, '', `/produk/${slug}`);
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

  async function loadLicenses(token = memberSession?.token) {
    if (!token) return;
    setMemberDashboard(await apiRequest<MemberLicenseDashboard>('/member/licenses', { token }));
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
          activeSection={adminSection}
          session={adminSession}
          summary={summary}
          products={products}
          licenses={adminLicenses}
          onLogin={async (email, password) => {
            const result = await apiRequest<LoginResult>('/admin/login', { method: 'POST', body: { email, password } });
            setAdminSession(result);
            setMessage(`Login admin: ${result.user.name}`);
            await loadAdminSummary(result.token);
            await loadAdminLicenses(result.token);
          }}
          onCreateProduct={async (input) => {
            if (!adminSession) return;
            await apiRequest('/admin/products', { token: adminSession.token, method: 'POST', body: input });
            await loadProducts();
            await loadCatalog();
            await loadAdminSummary();
            setMessage('Produk baru tersimpan.');
          }}
          onRefreshLicenses={async () => {
            await loadAdminLicenses();
            setMessage('Data lisensi diperbarui.');
          }}
          onGenerateLicense={async (input) => {
            if (!adminSession) throw new Error('Login admin dulu.');
            await apiRequest('/license/generate', { token: adminSession.token, method: 'POST', body: input });
            await loadAdminLicenses(adminSession.token);
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
        />
      </AdminShell>
    );
  }

  if (route === 'member') {
    return (
      <PublicShell navigate={navigate} activeRoute="member" memberSession={memberSession}>
        <MemberPanel
          session={memberSession}
          products={products}
          dashboard={memberDashboard}
          onRegister={async (name, email, password) => {
            const result = await apiRequest<LoginResult>('/member/register', { method: 'POST', body: { name, email, password } });
            setMemberSession(result);
            setMessage(`Member aktif: ${result.user.name}`);
            await loadLicenses(result.token);
          }}
          onLogin={async (email, password) => {
            const result = await apiRequest<LoginResult>('/member/login', { method: 'POST', body: { email, password } });
            setMemberSession(result);
            setMessage(`Member login: ${result.user.name}`);
            await loadLicenses(result.token);
          }}
          onCheckout={async (productId) => {
            if (!memberSession) return;
            const order = await apiRequest<{ qrisPayload: string }>('/checkout', {
              token: memberSession.token,
              method: 'POST',
              body: { productId }
            });
            setMessage(`QRIS dibuat: ${order.qrisPayload}`);
            await loadLicenses(memberSession.token);
          }}
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell navigate={navigate} activeRoute="home">
      {route === 'product'
        ? <ProductLanding isLoading={products.length === 0} product={products.find((item) => item.slug === productSlug)} onJoin={() => navigate('member')} />
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

function PublicShell({ children, navigate, activeRoute, memberSession }: {
  children: ReactNode;
  navigate: (route: Route) => void;
  activeRoute: Route;
  memberSession?: LoginResult | null;
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
            <button className="primary public-cta public-cta-logged" onClick={() => navigate('member')}>
              <span>{ctaLabel}</span>
              <small>{memberSession.user.name} • {memberSession.user.email}</small>
            </button>
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
          <button><Boxes size={18} /> Produk</button>
          <button className={activeSection === 'licenses' ? 'active' : ''} onClick={() => onSectionChange('licenses')}><KeyRound size={18} /> Lisensi</button>
          <button><Users size={18} /> Member</button>
          <button className={activeSection === 'deploy' ? 'active' : ''} onClick={() => onSectionChange('deploy')}><UploadCloud size={18} /> Update</button>
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
  onSubmit: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [name, setName] = useState('Member AsistenQ');
  const [email, setEmail] = useState('');
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

        await onSubmit(name, email, password);
      } finally {
        setBusy(false);
      }
    }}>
      <div>
        <p className="section-kicker">{mode === 'forgot' ? 'Reset access' : mode === 'reset' ? 'Password baru' : 'Secure access'}</p>
        <h2>{mode === 'forgot' ? 'Lupa Password' : mode === 'reset' ? 'Buat Password Baru' : title}</h2>
      </div>
      {showName && mode === 'login' && <label>Nama<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" /></label>}
      {mode !== 'reset' && <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="effands@gmail.com" type="email" /></label>}
      {mode !== 'forgot' && <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" type="password" /></label>}
      {mode === 'reset' && <label>Token Reset<input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Token reset password" /></label>}
      {notice && <p className="form-notice">{notice}</p>}
      <button className="primary" disabled={busy}>
        <LogIn size={18} /> {mode === 'forgot' ? 'Kirim instruksi reset' : mode === 'reset' ? 'Simpan password baru' : submitLabel ?? 'Masuk'}
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
  session,
  summary,
  products,
  licenses,
  onLogin,
  onCreateProduct,
  onRefreshLicenses,
  onGenerateLicense,
  onResetLicense,
  onBanLicense,
  onUnbanLicense,
  onDeployUpdate
}: {
  activeSection: AdminSection;
  session: LoginResult | null;
  summary: Summary | null;
  products: PublicProduct[];
  licenses: AdminLicenseDashboard | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onCreateProduct: (input: {
    name: string;
    slug: string;
    type: ProductType;
    billingPeriod: BillingPeriod;
    price: number;
    headline: string;
    description: string;
  }) => Promise<void>;
  onRefreshLicenses: () => Promise<void>;
  onGenerateLicense: (input: { productSlug: string; planCode: string; email: string; hwid: string }) => Promise<void>;
  onResetLicense: (licenseId: string, newHwid: string) => Promise<void>;
  onBanLicense: (license: LicenseDashboardRow) => Promise<void>;
  onUnbanLicense: (license: LicenseDashboardRow) => Promise<void>;
  onDeployUpdate: () => Promise<{ ok: boolean; message: string; stdout?: string; stderr?: string; detail?: string }>;
}) {
  if (!session) {
    return (
      <section className="admin-login-screen">
        <div className="admin-login-copy">
          <span className="chip">Command center</span>
          <h2>Kelola produk, lisensi, order QRIS, dan kelas premium dari satu panel.</h2>
          <p>Panel ini untuk operasional internal. Website publik sudah dipisah agar pengunjung melihat marketplace yang bersih.</p>
        </div>
        <LoginBox title="Login Super Admin" accountType="admin" onSubmit={(_, email, password) => onLogin(email, password)} />
      </section>
    );
  }

  if (activeSection === 'landing') {
    return <LandingManager products={products} />;
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

  if (activeSection === 'deploy') {
    return <DeployPanel onDeployUpdate={onDeployUpdate} />;
  }

  return (
    <section className="admin-content-grid">
      <div className="metrics">
        <Metric icon={<PackagePlus />} label="Produk" value={summary?.products ?? products.length} />
        <Metric icon={<Users />} label="Member" value={summary?.members ?? 0} />
        <Metric icon={<CreditCard />} label="Order" value={summary?.orders ?? 0} />
        <Metric icon={<KeyRound />} label="Subscription" value={summary?.activeSubscriptions ?? 0} />
      </div>
      <ProductForm onCreateProduct={onCreateProduct} />
      <ProductTable products={products} />
    </section>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Lifetime';
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const vjProduct = products.find((product) => product.slug === 'vjstudio') ?? products.find((product) => product.type === 'tool') ?? products[0];
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
              {products.filter((product) => product.type === 'tool').map((product) => (
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
          <button className="primary" disabled={busy}><KeyRound size={18} /> Generate Token</button>
        </form>
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
        <div className="license-table">
          {filteredLicenses.length === 0 && <div className="empty-state">Belum ada lisensi. Generate token pertama untuk VJ Studio Pro.</div>}
          {filteredLicenses.map((license) => (
            <article className="license-row-card" key={license.id}>
              <div className="license-row-main">
                <span className={`status-dot status-${license.status}`}>{licenseStatusLabel(license)}</span>
                <h3>{license.product?.name ?? license.productId}</h3>
                <p>{license.email}</p>
              </div>
              <div className="license-row-meta">
                <span><Monitor size={15} /> {license.hwid}</span>
                <span>{license.plan?.name ?? license.planId}</span>
                <span>Exp: {formatDate(license.expiresAt)}</span>
              </div>
              <code className="license-token">{license.key}</code>
              <div className="license-actions">
                <button className="ghost-button" onClick={() => navigator.clipboard.writeText(license.key)}>Copy Token</button>
                {license.status === 'banned'
                  ? <button className="ghost-button" disabled={busy} onClick={() => runAction(() => onUnbanLicense(license), 'HWID dipulihkan.')}>Unban</button>
                  : <button className="ghost-button danger-lite" disabled={busy} onClick={() => runAction(() => onBanLicense(license), 'HWID diblokir.')}>Ban</button>}
              </div>
              <div className="reset-device-box">
                <input
                  value={resetValues[license.id] ?? ''}
                  onChange={(event) => setResetValues((current) => ({ ...current, [license.id]: event.target.value.toUpperCase() }))}
                  maxLength={16}
                  placeholder="HWID baru untuk reset device"
                />
                <button
                  className="primary"
                  disabled={busy || !resetValues[license.id]}
                  onClick={() => runAction(
                    () => onResetLicense(license.id, resetValues[license.id]),
                    'Device berhasil dipindahkan. HWID lama otomatis dibanned.'
                  )}
                >
                  Reset Device
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingManager({ products }: { products: PublicProduct[] }) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? '');
  const selected = products.find((product) => product.slug === selectedSlug) ?? products[0];

  useEffect(() => {
    if (!selectedSlug && products[0]) {
      setSelectedSlug(products[0].slug);
    }
  }, [products, selectedSlug]);

  return (
    <section className="admin-content-grid compact-admin-grid">
      <div className="panel stack">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Landing Builder</p>
            <h2>Landing Produk</h2>
          </div>
          <span className="soft-badge">Public</span>
        </div>
        <p className="muted">Menu ini disiapkan khusus untuk sales page produk. Untuk sekarang datanya mengikuti produk aktif, lalu nanti bisa ditambah editor benefit, FAQ, testimoni, dan bonus.</p>
        <label>Produk
          <select value={selected?.slug ?? ''} onChange={(event) => setSelectedSlug(event.target.value)}>
            {products.map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}
          </select>
        </label>
        {selected && (
          <div className="landing-preview-card">
            <span>{selected.type} · {selected.billingPeriod}</span>
            <h3>{selected.name}</h3>
            <p>{selected.headline}</p>
            <strong>{selected.formattedPrice}</strong>
            <a href={`/produk/${selected.slug}`} target="_blank" rel="noreferrer">Preview landing</a>
          </div>
        )}
      </div>
      <div className="panel stack">
        <p className="section-kicker">Struktur Sales Page</p>
        <h2>Blok landing yang akan dipakai</h2>
        <div className="mini-checklist">
          <span>Hero manfaat utama</span>
          <span>Masalah yang diselesaikan</span>
          <span>Fitur dan benefit</span>
          <span>Harga, bonus, dan CTA</span>
          <span>FAQ dan bukti/testimoni</span>
        </div>
      </div>
    </section>
  );
}

function DeployPanel({ onDeployUpdate }: {
  onDeployUpdate: () => Promise<{ ok: boolean; message: string; stdout?: string; stderr?: string; detail?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('Belum ada update dijalankan.');

  return (
    <section className="admin-content-grid compact-admin-grid">
      <div className="panel stack wide">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">GitHub Deployment</p>
            <h2>Update dari GitHub</h2>
          </div>
          <span className="soft-badge">Safe mode</span>
        </div>
        <p className="muted">Klik tombol ini setelah ada push ke GitHub. Sistem akan pull, install dependency, dan build. Setelah selesai, restart aplikasi Node.js dari panel hosting agar proses memakai build terbaru.</p>
        <button
          className="primary deploy-button"
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
        <pre className="deploy-log">{log}</pre>
      </div>
    </section>
  );
}

function ProductForm({ onCreateProduct }: {
  onCreateProduct: (input: {
    name: string;
    slug: string;
    type: ProductType;
    billingPeriod: BillingPeriod;
    price: number;
    headline: string;
    description: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('AsistenQ Video Helper');
  const [slug, setSlug] = useState('video-helper');
  const [type, setType] = useState<ProductType>('tool');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [price, setPrice] = useState(149000);
  const [headline, setHeadline] = useState('Bantu produksi video lebih cepat.');
  const [description, setDescription] = useState('Produk AsistenQ untuk workflow editing dan YouTube.');

  return (
    <form className="panel stack wide" onSubmit={async (event) => {
      event.preventDefault();
      await onCreateProduct({ name, slug, type, billingPeriod, price, headline, description });
    }}>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Catalog control</p>
          <h2>Tambah Produk</h2>
        </div>
        <span className="soft-badge">{type}</span>
      </div>
      <div className="form-grid">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama produk" />
        <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug-produk" />
        <select value={type} onChange={(event) => setType(event.target.value as ProductType)}>
          {productTypes.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}>
          {billingPeriods.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input value={price} onChange={(event) => setPrice(Number(event.target.value))} type="number" />
        <input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Headline" />
      </div>
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      <button className="primary"><PackagePlus size={18} /> Simpan Produk</button>
    </form>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProductTable({ products }: { products: PublicProduct[] }) {
  return (
    <div className="panel wide">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Inventory</p>
          <h2>Produk Aktif</h2>
        </div>
        <span className="soft-badge">{products.length} produk</span>
      </div>
      <div className="table">
        {products.map((product) => (
          <div className="table-row" key={product.id}>
            <strong>{product.name}</strong>
            <span>{product.type}</span>
            <span>{product.billingPeriod}</span>
            <span>{product.formattedPrice}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function productIcon(product: PublicProduct) {
  if (product.type === 'course' || product.type === 'class') return <GraduationCap />;
  if (product.type === 'video') return <Film />;
  if (product.type === 'free') return <Sparkles />;
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
      <div className="market-card-top">
        <div className="product-icon">{productIcon(product)}</div>
        <span>{label ?? product.type}</span>
      </div>
      <h3>{product.name}</h3>
      <p>{product.description || product.headline}</p>
      <div className="market-card-footer">
        <strong>{product.price === 0 ? 'Gratis' : product.formattedPrice}</strong>
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
          <div className="hero-badge"><Sparkles size={16} /> Tools, kelas, dan resource untuk creator YouTube</div>
          <h1>Tools YouTube, lisensi, dan kelas dalam satu tempat.</h1>
          <p>Mulai dari VJ Studio Pro, resource gratis, sampai kelas YouTube online/offline untuk mempercepat workflow konten.</p>
          <div className="hero-actions">
            <button className="primary public-hero-button" onClick={onJoin}>Lihat paket member <ArrowRight size={18} /></button>
            <a className="text-link" href="#produk">Lihat produk</a>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={16} /> Lisensi per device</span>
            <span><CreditCard size={16} /> QRIS ready</span>
            <span><BookOpen size={16} /> Course online/offline</span>
          </div>
        </div>
        <aside className="hero-console">
          <div className="console-header">
            <span />
            <span />
            <span />
          </div>
          <div className="console-product">
            <p>Produk unggulan</p>
            <h2>{primaryProduct?.name ?? 'VJ Studio Pro'}</h2>
            <span>{primaryProduct?.headline ?? 'Lisensi resmi untuk workflow video YouTube yang lebih cepat.'}</span>
          </div>
          <div className="license-preview">
            <div>
              <small>Paket mulai</small>
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
        <span>Video tools</span>
        <span>YouTube workflow</span>
        <span>Lisensi resmi</span>
        <span>E-learning</span>
        <span>Free resource</span>
      </section>

      <section className="landing-section" id="produk">
        <div className="section-head">
          <div>
            <p className="section-kicker">Featured Products</p>
            <h2>Layanan utama AsistenQ</h2>
          </div>
          <p>Pilih tools, kelas, atau resource yang paling cocok untuk mempercepat produksi kontenmu.</p>
        </div>
        <div className="market-grid featured-market-grid">
          {catalog.featured.map((product) => (
            <ProductCard key={product.id} product={product} label="unggulan" featured onOpen={onProductOpen} />
          ))}
        </div>
      </section>

      <section className="landing-section split-section" id="course">
        <div className="course-panel">
          <span className="chip">Kelas YouTube</span>
          <h2>Belajar produksi konten dengan alur yang jelas, bukan tebak-tebakan.</h2>
          <p>Kelas berisi video tutorial, materi pendamping, dan update berkala. Cocok untuk creator yang ingin belajar dari dasar, merapikan workflow, atau mempercepat proses upload.</p>
          <button className="ghost-button" onClick={onJoin}>Lihat akses kelas</button>
        </div>
        <div className="mini-stack">
          <div><PlayCircle /> Video tutorial bertahap</div>
          <div><BookOpen /> Ebook dan template</div>
          <div><BadgeCheck /> Akses member tahunan</div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Paid & Free</p>
            <h2>Pilih sesuai kebutuhan</h2>
          </div>
        </div>
        <div className="market-grid">
          {catalog.paid.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={onProductOpen} />
          ))}
          {catalog.free.map((product) => (
            <ProductCard key={product.id} product={product} label="gratis" onOpen={onProductOpen} />
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
          <p>Data produk sedang dimuat dari katalog AsistenQ.</p>
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
          <p>Silakan kembali ke marketplace AsistenQ untuk melihat produk aktif.</p>
          <a className="primary public-hero-button" href="/">Kembali ke marketplace</a>
        </section>
      </main>
    );
  }

  const benefits = product.type === 'course' || product.type === 'class'
    ? ['Materi bertahap dan mudah diikuti', 'Akses kelas melalui akun member', 'Update materi untuk workflow YouTube']
    : ['Aktivasi lisensi per perangkat', 'Membantu workflow produksi video', 'Cocok untuk creator YouTube yang ingin lebih cepat'];

  return (
    <main className="product-landing">
      <section className="product-sales-hero">
        <div>
          <span className="chip">{product.category ?? product.type}</span>
          <h1>{product.headline || product.name}</h1>
          <p>{product.description}</p>
          <div className="hero-actions">
            <button className="primary public-hero-button" onClick={onJoin}>Aktifkan lewat member <ArrowRight size={18} /></button>
            <a className="text-link dark-link" href="#harga">Lihat harga</a>
          </div>
        </div>
        <aside className="product-price-card" id="harga">
          <p>Paket mulai</p>
          <h2>{product.price === 0 ? 'Gratis' : product.formattedPrice}</h2>
          <span>{product.billingPeriod}</span>
          <button className="primary" onClick={onJoin}>Masuk member</button>
        </aside>
      </section>

      <section className="product-sales-grid">
        <div className="panel stack">
          <p className="section-kicker">Benefit</p>
          <h2>Apa yang kamu dapatkan?</h2>
          <div className="mini-checklist">
            {benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
          </div>
        </div>
        <div className="panel stack">
          <p className="section-kicker">Cara mulai</p>
          <h2>Daftar, bayar QRIS, lalu akses.</h2>
          <p>Alur dibuat simpel: buat akun member, pilih produk, lakukan pembayaran, lalu akses lisensi atau materi dari member area.</p>
        </div>
      </section>
    </main>
  );
}

function MemberPanel({ session, products, dashboard, onRegister, onLogin, onCheckout }: {
  session: LoginResult | null;
  products: PublicProduct[];
  dashboard: MemberLicenseDashboard | null;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onCheckout: (productId: string) => Promise<void>;
}) {
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeMemberTab, setActiveMemberTab] = useState<'licenses' | 'products' | 'course' | 'help'>('licenses');

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
          <p>Cek token lisensi, status device, produk, dan course dari satu halaman yang lebih ringkas. Ringkasan di kanan sengaja dibuat kecil supaya fokus tetap ke data utama.</p>
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
          <div className="panel stack member-products-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Marketplace Member</p>
              <h2>Pilih Produk</h2>
            </div>
            <span className="soft-badge">QRIS</span>
          </div>
          <p className="muted">Pilih produk untuk membuat order QRIS. Setelah pembayaran dikonfirmasi admin, lisensi atau akses kelas akan muncul di dashboard ini.</p>
          <div className="member-product-list">
            {paidProducts.map((product) => (
              <button className="member-product-card" key={product.id} onClick={async () => {
                setCheckoutNotice('');
                await onCheckout(product.id);
                setCheckoutNotice(`Order QRIS dibuat untuk ${product.name}. Cek instruksi pembayaran dari admin.`);
              }}>
                <span>{product.type}</span>
                <strong>{product.name}</strong>
                <small>{product.headline}</small>
                <b>{product.price === 0 ? 'Gratis' : product.formattedPrice}</b>
              </button>
            ))}
          </div>
          {checkoutNotice && <p className="form-notice">{checkoutNotice}</p>}
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
    </main>
  );
}
