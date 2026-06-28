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
  Users,
  WandSparkles
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { BillingPeriod, ProductType } from '../shared/types';
import { apiRequest, type LoginResult, type MemberLicense, type PublicCatalog, type PublicProduct, type Summary } from './api';

type Route = 'home' | 'admin' | 'member';

const productTypes: ProductType[] = ['tool', 'course', 'ebook', 'video', 'bundle', 'free', 'class'];
const billingPeriods: BillingPeriod[] = ['trial', 'monthly', 'annual', 'lifetime', 'one_time'];
const emptyCatalog: PublicCatalog = { featured: [], paid: [], free: [] };

function routeFromPath(pathname: string): Route {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/member')) return 'member';
  return 'home';
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

  function navigate(nextRoute: Route) {
    const path = nextRoute === 'home' ? '/' : `/${nextRoute}`;
    window.history.pushState({}, '', path);
    setRoute(nextRoute);
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
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    loadProducts().catch((error) => setMessage(error.message));
    loadCatalog().catch((error) => setMessage(error.message));
  }, []);

  if (route === 'admin') {
    return (
      <AdminShell message={message} navigate={navigate}>
        <AdminPanel
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
      <Marketplace catalog={catalog} onJoin={() => navigate('member')} />
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
          <button className="ghost-button" onClick={() => navigate('admin')}>Admin</button>
          <button className="primary public-cta" onClick={() => navigate('member')}>Masuk Member</button>
        </div>
      </header>
      {children}
    </div>
  );
}

function AdminShell({ children, message, navigate }: {
  children: ReactNode;
  message: string;
  navigate: (route: Route) => void;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand compact />
        <nav className="admin-nav">
          <button className="active"><LayoutDashboard size={18} /> Dashboard</button>
          <button><Boxes size={18} /> Produk</button>
          <button><KeyRound size={18} /> Lisensi</button>
          <button><Users size={18} /> Member</button>
        </nav>
        <button className="admin-public-link" onClick={() => navigate('home')}><ArrowRight size={16} /> Lihat website</button>
      </aside>
      <main className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="section-kicker">AsistenQ Operations</p>
            <h1>Admin Panel</h1>
          </div>
          <div className="status-pill">{message}</div>
        </header>
        {children}
      </main>
    </div>
  );
}

function LoginBox({ title, onSubmit, showName = false }: {
  title: string;
  showName?: boolean;
  onSubmit: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [name, setName] = useState('Member AsistenQ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form className="auth-form stack" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      try {
        await onSubmit(name, email, password);
      } finally {
        setBusy(false);
      }
    }}>
      <div>
        <p className="section-kicker">Secure access</p>
        <h2>{title}</h2>
      </div>
      {showName && <label>Nama<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" /></label>}
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="effands@gmail.com" type="email" /></label>
      <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" type="password" /></label>
      <button className="primary" disabled={busy}><LogIn size={18} /> Masuk</button>
    </form>
  );
}

function AdminPanel({ session, summary, products, onLogin, onCreateProduct }: {
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
}) {
  if (!session) {
    return (
      <section className="admin-login-screen">
        <div className="admin-login-copy">
          <span className="chip">Command center</span>
          <h2>Kelola produk, lisensi, order QRIS, dan kelas premium dari satu panel.</h2>
          <p>Panel ini untuk operasional internal. Website publik sudah dipisah agar pengunjung melihat marketplace yang bersih.</p>
        </div>
        <LoginBox title="Login Super Admin" onSubmit={(_, email, password) => onLogin(email, password)} />
      </section>
    );
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

function ProductCard({ product, label, featured = false }: {
  product: PublicProduct;
  label?: string;
  featured?: boolean;
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
        <button className="ghost-button">Lihat detail <ArrowRight size={15} /></button>
      </div>
    </article>
  );
}

function Marketplace({ catalog, onJoin }: { catalog: PublicCatalog; onJoin: () => void }) {
  const primaryProduct = catalog.featured[0] ?? catalog.paid[0];

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="hero-orb hero-orb-a" />
        <div className="hero-orb hero-orb-b" />
        <div className="hero-content">
          <div className="hero-badge"><Sparkles size={16} /> Marketplace tools, lisensi, dan kelas creator</div>
          <h1>Asisten digital untuk kerja creator yang lebih cepat, rapi, dan terukur.</h1>
          <p>AsistenQ mengumpulkan tools video, lisensi software, resource gratis, dan kelas YouTube dalam satu ekosistem. Hari ini dimulai dari VJ Studio Pro, besok tinggal tambah produk baru tanpa bongkar sistem.</p>
          <div className="hero-actions">
            <button className="primary public-hero-button" onClick={onJoin}>Mulai jadi member <ArrowRight size={18} /></button>
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
        <span>License center</span>
        <span>E-learning</span>
        <span>Free resource</span>
      </section>

      <section className="landing-section" id="produk">
        <div className="section-head">
          <div>
            <p className="section-kicker">Featured Products</p>
            <h2>Layanan utama AsistenQ</h2>
          </div>
          <p>Produk dibuat modular: tools, course, ebook, video, bundle, maupun resource gratis.</p>
        </div>
        <div className="market-grid featured-market-grid">
          {catalog.featured.map((product) => (
            <ProductCard key={product.id} product={product} label="unggulan" featured />
          ))}
        </div>
      </section>

      <section className="landing-section split-section" id="course">
        <div className="course-panel">
          <span className="chip">Course roadmap</span>
          <h2>Kelas YouTube online, offline, dan update tahunan.</h2>
          <p>AsistenQ disiapkan agar kelas baru tinggal ditambahkan: materi video, ebook pendamping, tools support, dan akses member.</p>
          <button className="ghost-button" onClick={onJoin}>Masuk daftar tunggu</button>
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
            <ProductCard key={product.id} product={product} />
          ))}
          {catalog.free.map((product) => (
            <ProductCard key={product.id} product={product} label="gratis" />
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div>
          <p className="section-kicker">AsistenQ ecosystem</p>
          <h2>Mulai dari satu tools, siap tumbuh jadi marketplace digital.</h2>
        </div>
        <button className="primary public-hero-button" onClick={onJoin}>Buat akun member</button>
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
          <h1>Akses lisensi, pembelian QRIS, dan materi kelas dari satu akun.</h1>
          <p>Daftar sebagai member untuk membeli tools, menyimpan lisensi, dan nanti mengakses course YouTube.</p>
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
