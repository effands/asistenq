import {
  BadgeCheck,
  BookOpen,
  Boxes,
  CreditCard,
  Film,
  KeyRound,
  LayoutDashboard,
  LogIn,
  PackagePlus,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BillingPeriod, ProductType } from '../shared/types';
import { apiRequest, type LoginResult, type MemberLicense, type PublicProduct, type Summary } from './api';

type View = 'marketplace' | 'member' | 'admin';

const productTypes: ProductType[] = ['tool', 'ebook', 'video', 'class'];
const billingPeriods: BillingPeriod[] = ['monthly', 'annual', 'one_time'];

export function App() {
  const [view, setView] = useState<View>('admin');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [adminSession, setAdminSession] = useState<LoginResult | null>(null);
  const [memberSession, setMemberSession] = useState<LoginResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [licenses, setLicenses] = useState<MemberLicense[]>([]);
  const [message, setMessage] = useState('Siap mengelola AsistenQ.');

  async function loadProducts() {
    setProducts(await apiRequest<PublicProduct[]>('/products'));
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
    loadProducts().catch((error) => setMessage(error.message));
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AQ</div>
          <div>
            <strong>AsistenQ</strong>
            <span>asistenq.com</span>
          </div>
        </div>

        <nav className="nav">
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}><LayoutDashboard size={18} /> Admin</button>
          <button className={view === 'marketplace' ? 'active' : ''} onClick={() => setView('marketplace')}><Boxes size={18} /> Produk</button>
          <button className={view === 'member' ? 'active' : ''} onClick={() => setView('member')}><BadgeCheck size={18} /> Member</button>
        </nav>

        <div className="sidebar-note">
          <ShieldCheck size={18} />
          <span>Tools bulanan, kelas tahunan, pembayaran QRIS.</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AsistenQ Operations</p>
            <h1>{view === 'admin' ? 'Admin Panel' : view === 'member' ? 'Member Area' : 'Marketplace Produk'}</h1>
          </div>
          <div className="status-pill">{message}</div>
        </header>

        {view === 'admin' && (
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
              await loadAdminSummary();
              setMessage('Produk baru tersimpan.');
            }}
          />
        )}

        {view === 'marketplace' && (
          <Marketplace products={products} />
        )}

        {view === 'member' && (
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
        )}
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
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@asistenq.com" type="email" /></label>
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
      <section className="auth-screen">
        <div className="auth-copy">
          <p className="section-kicker">Command center</p>
          <h2>Kelola produk digital, lisensi, dan kelas premium dari satu tempat.</h2>
          <p>Admin panel AsistenQ dibuat untuk operasional harian: menambah produk, mengatur akses, melihat order, dan menyiapkan ekspansi tools editing video serta YouTube.</p>
          <div className="auth-features">
            <span><ShieldCheck size={16} /> Super admin</span>
            <span><CreditCard size={16} /> QRIS ready</span>
            <span><Sparkles size={16} /> Multi produk</span>
          </div>
        </div>
        <LoginBox title="Login Super Admin" onSubmit={(_, email, password) => onLogin(email, password)} />
      </section>
    );
  }

  return (
    <section className="content-grid">
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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

function Marketplace({ products }: { products: PublicProduct[] }) {
  return (
    <section className="storefront">
      <div className="storefront-lead">
        <p className="section-kicker">Digital workspace</p>
        <h2>Produk AsistenQ untuk mempercepat workflow creator.</h2>
        <p>Mulai dari tools editing video, utilitas YouTube, ebook, sampai kelas premium tahunan.</p>
      </div>
      <div className="catalog">
        {products.map((product) => (
          <article className="product-card" key={product.id}>
            <div className="product-topline">
              <div className="product-icon">{product.type === 'class' ? <BookOpen /> : product.type === 'video' ? <Film /> : <Boxes />}</div>
              <span>{product.type} · {product.billingPeriod}</span>
            </div>
            <h2>{product.name}</h2>
            <p>{product.description}</p>
            <strong>{product.formattedPrice}</strong>
          </article>
        ))}
      </div>
    </section>
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
      <div className="content-grid two auth-columns">
        <LoginBox title="Daftar Member" showName onSubmit={onRegister} />
        <LoginBox title="Login Member" onSubmit={(_, email, password) => onLogin(email, password)} />
      </div>
    );
  }

  return (
    <section className="content-grid two">
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
  );
}
