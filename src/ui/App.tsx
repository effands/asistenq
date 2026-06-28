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
  PackagePlus,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  WandSparkles
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { BillingPeriod, ProductType } from '../shared/types';
import { apiRequest, type ForgotPasswordResult, type LoginResult, type MemberLicense, type PublicCatalog, type PublicProduct, type Summary } from './api';

type Route = 'home' | 'admin' | 'member' | 'product';
type AdminSection = 'dashboard' | 'landing' | 'deploy';
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
  const [licenses, setLicenses] = useState<MemberLicense[]>([]);
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

  async function loadLicenses(token = memberSession?.token) {
    if (!token) return;
    setLicenses(await apiRequest<MemberLicense[]>('/member/licenses', { token }));
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
          onLogin={async (email, password) => {
            const result = await apiRequest<LoginResult>('/admin/login', { method: 'POST', body: { email, password } });
            setAdminSession(result);
            setMessage(`Login admin: ${result.user.name}`);
            await loadAdminSummary(result.token);
          }}
          onCreateProduct={async (input) => {
            if (!adminSession) return;
            await apiRequest('/admin/products', { token: adminSession.token, method: 'POST', body: input });
            await loadProducts();
            await loadCatalog();
            await loadAdminSummary();
            setMessage('Produk baru tersimpan.');
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
      <PublicShell navigate={navigate} activeRoute="member">
        <MemberPanel
          session={memberSession}
          products={products}
          licenses={licenses}
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
        <span>asistenq.com</span>
      </div>
    </button>
  );
}

function PublicShell({ children, navigate, activeRoute }: {
  children: ReactNode;
  navigate: (route: Route) => void;
  activeRoute: Route;
}) {
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
          <button className="primary public-cta" onClick={() => navigate('member')}>Masuk Member</button>
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
          <button><KeyRound size={18} /> Lisensi</button>
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

function LoginBox({ title, accountType = 'member', onSubmit, showName = false }: {
  title: string;
  accountType?: 'admin' | 'member';
  showName?: boolean;
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
        <LogIn size={18} /> {mode === 'forgot' ? 'Kirim instruksi reset' : mode === 'reset' ? 'Simpan password baru' : 'Masuk'}
      </button>
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
    </form>
  );
}

function AdminPanel({ activeSection, session, summary, products, onLogin, onCreateProduct, onDeployUpdate }: {
  activeSection: AdminSection;
  session: LoginResult | null;
  summary: Summary | null;
  products: PublicProduct[];
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
          <h1>Kerja video lebih cepat, channel lebih rapi, hasil lebih siap upload.</h1>
          <p>AsistenQ menyediakan tools pendukung editing video, template workflow, resource gratis, dan kelas YouTube berbayar agar proses produksi konten terasa lebih ringan dari ide sampai publish.</p>
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

function MemberPanel({ session, products, licenses, onRegister, onLogin, onCheckout }: {
  session: LoginResult | null;
  products: PublicProduct[];
  licenses: MemberLicense[];
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onCheckout: (productId: string) => Promise<void>;
}) {
  if (!session) {
    return (
      <main className="member-page">
        <section className="member-hero">
          <span className="chip">Member Area</span>
          <h1>Masuk ke akun AsistenQ</h1>
          <p>Kelola pembelian, lisensi tools, dan akses kelas dari satu tempat.</p>
        </section>
        <div className="member-auth-grid">
          <LoginBox title="Daftar Member" showName onSubmit={onRegister} />
          <LoginBox title="Login Member" onSubmit={(_, email, password) => onLogin(email, password)} />
        </div>
      </main>
    );
  }

  return (
    <main className="member-page">
      <section className="admin-content-grid two">
        <div className="panel stack">
          <h2>Beli Produk</h2>
          {products.map((product) => (
            <button className="list-button" key={product.id} onClick={() => onCheckout(product.id)}>
              <span>{product.name}</span>
              <strong>{product.formattedPrice}</strong>
            </button>
          ))}
        </div>
        <div className="panel stack">
          <h2>Lisensi Saya</h2>
          {licenses.length === 0 && <p className="muted">Belum ada lisensi aktif.</p>}
          {licenses.map((license) => (
            <div className="license" key={license.id}>
              <strong>{license.product?.name ?? license.productId}</strong>
              <span>{license.status} sampai {new Date(license.endsAt).toLocaleDateString('id-ID')}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
