import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, ChevronRight, CreditCard, Download, ExternalLink, Headphones, Search, ShieldCheck, ShoppingCart, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ContentPage, ProductPlan } from '../shared/types';
import type { PublicCatalog, PublicOrder, PublicProduct } from './api';
import { cartSubtotal, type MarketplaceCartItem } from './cart-store';

const money = (value: number) => value === 0 ? 'Gratis' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value).replace(/\s/g, '');
const categories = ['Semua', 'Tools Creator', 'Free Tools', 'Audio Tools', 'YouTube Workflow', 'E-Learning', 'Template & Asset'];

function productCategory(product: PublicProduct): string {
  const haystack = `${product.category ?? ''} ${product.name} ${product.tags?.join(' ') ?? ''}`.toLowerCase();
  if (product.price === 0 || product.type === 'free') return 'Free Tools';
  if (product.type === 'course' || product.type === 'class') return 'E-Learning';
  if (/audio|music|suno|mix/.test(haystack)) return 'Audio Tools';
  if (/youtube|workflow|video/.test(haystack)) return 'YouTube Workflow';
  if (/template|asset|thumbnail|ebook/.test(haystack)) return 'Template & Asset';
  return 'Tools Creator';
}

function coverStyle(product: PublicProduct) {
  return { background: `linear-gradient(135deg, ${product.marketplaceAccent ?? '#003d35'}, #071c21)` };
}

export function MarketplaceHome({ catalog, onOpen, onAdd }: { catalog: PublicCatalog; onOpen: (slug: string) => void; onAdd: (product: PublicProduct) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const products = useMemo(() => catalog.all.filter((product) => {
    const matchesSearch = `${product.name} ${product.description} ${product.tags?.join(' ') ?? ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesSearch && (category === 'Semua' || productCategory(product) === category);
  }), [catalog.all, category, query]);

  return <>
    <main className="market-shell">
      <section className="market-hero">
        <div><span className="market-eyebrow"><Sparkles size={15} /> MARKETPLACE</span><h1>Semua produk digital<br />dan <em>tools</em> pilihan.</h1><p>Akses tools premium untuk workflow creator, kursus online, template, dan resource digital yang siap pakai.</p></div>
        <div className="market-hero-side"><label className="market-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk atau tools..." /><Search size={23} /></label><div className="market-promises"><span><Download /> <b>Akses instan</b><small>Setelah pembayaran</small></span><span><BadgeCheck /> <b>Update berkala</b><small>Fitur selalu terbaru</small></span><span><Headphones /> <b>Support cepat</b><small>Bantuan via member</small></span></div></div>
      </section>
      <section className="market-filter"><div>{categories.map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><span>{products.length} produk</span></section>
      <section className="market-grid" id="produk">
        {products.map((product) => <article className="market-card" key={product.id}>
          <button className="market-card-cover" style={product.marketplaceCoverUrl ? undefined : coverStyle(product)} onClick={() => onOpen(product.slug)}>
            {product.marketplaceCoverUrl && <img src={product.marketplaceCoverUrl} alt={product.name} />}
            <small>{productCategory(product)}</small><i>{product.badge || (product.price === 0 ? 'FREE' : 'PRO')}</i><strong>{!product.marketplaceCoverUrl && product.name}</strong>
          </button>
          <div className="market-card-body"><button className="market-card-title" onClick={() => onOpen(product.slug)}>{product.name}</button><p>{product.cardDescription || product.description || product.headline}</p><div className="market-tags">{(product.tags?.length ? product.tags : [product.compatibility || 'Digital', product.billingPeriod]).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><footer><b>{money(product.plans?.[0]?.price ?? product.price)}</b><button aria-label={`Tambahkan ${product.name} ke keranjang`} onClick={() => onAdd(product)}><ShoppingCart size={18} /></button></footer></div>
        </article>)}
        {products.length === 0 && <div className="market-empty"><Search size={32} /><h3>Produk belum ditemukan</h3><p>Coba kata kunci atau kategori lain.</p></div>}
      </section>
      <section className="market-benefit-bar"><span><BadgeCheck /><b>Produk berkualitas</b><small>Dipilih dan digunakan creator</small></span><span><ShieldCheck /><b>Pembayaran aman</b><small>Nominal QRIS unik</small></span><span><Download /><b>Akses digital</b><small>Dikelola dari akun member</small></span><span><Headphones /><b>Support responsif</b><small>Tim support siap bantu</small></span></section>
    </main><MarketplaceFooter />
  </>;
}

function normalizedPlans(product: PublicProduct): ProductPlan[] {
  return product.plans?.length ? [...product.plans].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [{ id: `default-${product.id}`, productId: product.id, code: 'DEFAULT', name: product.billingPeriod === 'lifetime' ? 'Akses Lifetime' : 'Paket Produk', price: product.price, billingPeriod: product.billingPeriod, durationDays: null, isFree: product.price === 0, isActive: true }];
}

export function MarketplaceProductDetail({ product, onBack, onAdd, onBuy }: { product?: PublicProduct; onBack: () => void; onAdd: (product: PublicProduct, plan: ProductPlan) => void; onBuy: (product: PublicProduct, plan: ProductPlan) => void }) {
  const plans = product ? normalizedPlans(product) : [];
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [media, setMedia] = useState(0);
  if (!product) return <main className="market-shell product-missing"><h1>Produk belum tersedia.</h1><button onClick={onBack}><ArrowLeft /> Kembali</button></main>;
  const plan = plans.find((row) => row.id === planId) ?? plans[0];
  const gallery = [{ id: 'cover', type: 'image' as const, url: product.marketplaceCoverUrl ?? '' }, ...(product.gallery ?? [])];
  const activeMedia = gallery[media] ?? gallery[0];
  return <><main className="market-shell detail-shell">
    <div className="detail-breadcrumb"><button onClick={onBack}>Marketplace</button><ChevronRight /> <span>{productCategory(product)}</span><ChevronRight /><b>{product.name}</b></div>
    <section className="detail-top">
      <div className="detail-gallery"><div className="detail-main-media" style={!activeMedia?.url ? coverStyle(product) : undefined}>{activeMedia?.url ? activeMedia.type === 'video' ? <video src={activeMedia.url} controls /> : <img src={activeMedia.url} alt={product.name} /> : <><span>{productCategory(product)}</span><strong>{product.name}</strong><p>{product.cardDescription || product.description}</p></>}</div><div className="detail-thumbs">{gallery.map((item, index) => <button className={media === index ? 'active' : ''} onClick={() => setMedia(index)} key={item.id}>{item.url ? item.type === 'video' ? <video src={item.url} /> : <img src={item.url} alt="" /> : <span>{index + 1}</span>}</button>)}</div></div>
      <div className="detail-summary"><h1>{product.name}</h1><div className="market-tags">{[product.compatibility, product.billingPeriod, product.version, product.badge].filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div><p>{product.description || product.headline}</p><hr />{(product.benefits?.length ? product.benefits : product.features ?? []).slice(0, 5).map((feature) => <div className="detail-feature" key={feature.title}><span><Check /></span><div><b>{feature.title}</b><small>{feature.description}</small></div></div>)}</div>
      <aside className="detail-buy"><h3>Pilih Lisensi</h3>{plans.map((row) => <button className={`plan-choice ${plan?.id === row.id ? 'active' : ''}`} onClick={() => setPlanId(row.id)} key={row.id}><span><i /> <b>{row.name}</b>{row.highlighted && <em>Rekomendasi</em>}</span><strong>{money(row.price)}</strong><small>{row.badge || (row.durationDays ? `Akses ${row.durationDays} hari` : 'Akses sesuai paket')}</small></button>)}<button className="buy-primary" onClick={() => plan && onBuy(product, plan)}><ShoppingCart /> Beli Sekarang — {money(plan?.price ?? product.price)}</button><button className="buy-secondary" onClick={() => plan && onAdd(product, plan)}>+ Tambah ke Keranjang</button><small className="secure-note"><ShieldCheck /> Pembayaran QRIS aman dengan kode unik</small></aside>
    </section>
    <section className="detail-content"><div><h2>Deskripsi Produk</h2><p>{product.description}</p>{product.targetUsers?.length ? <><h2>Cocok Untuk</h2><div className="market-tags">{product.targetUsers.map((item) => <span key={item}>{item}</span>)}</div></> : null}{product.features?.length ? <><h2>Fitur Utama</h2><div className="detail-feature-grid">{product.features.map((item) => <div key={item.title}><Check /><b>{item.title}</b><p>{item.description}</p></div>)}</div></> : null}{product.changelog && <><h2>Changelog</h2><p>{product.changelog}</p></>}</div><aside><h3>Informasi Produk</h3>{Object.entries({ Developer: product.developer, Versi: product.version, 'Ukuran File': product.fileSize, Kompatibilitas: product.compatibility, Bahasa: product.language, SKU: product.sku, Kategori: productCategory(product) }).filter(([, value]) => value).map(([key, value]) => <span key={key}><small>{key}</small><b>{value}</b></span>)}{product.demoUrl && <a href={product.demoUrl} target="_blank" rel="noreferrer">Coba Demo</a>}{product.documentationUrl && <a href={product.documentationUrl} target="_blank" rel="noreferrer"><BookOpen /> Lihat Dokumentasi</a>}</aside></section>
  </main><MarketplaceFooter /></>;
}

export function MarketplaceCart({ open, items, order, busy, onClose, onRemove, onCheckout }: { open: boolean; items: MarketplaceCartItem[]; order: PublicOrder | null; busy: boolean; onClose: () => void; onRemove: (productId: string) => void; onCheckout: () => void }) {
  if (!open) return null;
  return <div className="cart-backdrop" onMouseDown={onClose}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><header><div><small>KERANJANG BELANJA</small><h2>{items.length} produk dipilih</h2></div><button onClick={onClose}><X /></button></header>{order ? <div className="cart-invoice"><BadgeCheck size={42} /><h3>Invoice {order.invoiceNumber}</h3><p>Bayar tepat sesuai nominal berikut:</p><strong>{order.formattedTotalAmount}</strong>{order.sakuRupiahCheckoutUrl ? <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}><a className="buy-primary" href={order.sakuRupiahCheckoutUrl} target="_blank" rel="noreferrer" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', fontWeight: '700', borderRadius: '12px' }}>Bayar Otomatis via SakuRupiah <ExternalLink size={18} /></a><small className="muted">Halaman gateway resmi SakuRupiah akan terbuka dengan nominal terkunci otomatis (QRIS / VA / E-Wallet).</small></div> : (order.paymentQrUrl ? <><img src={order.paymentQrUrl} alt="QRIS pembayaran" /><small>Setelah membayar, kirim bukti dari halaman member. Admin akan memverifikasi manual.</small></> : null)}<a href="/member" style={{ marginTop: '14px' }}>Buka Area Member <ArrowRight /></a></div> : <>{items.length ? <div className="cart-items">{items.map((item) => <article key={item.productId}><div>{item.coverUrl ? <img src={item.coverUrl} alt="" /> : <ShoppingCart />}</div><span><b>{item.productName}</b><small>{item.planName}</small><strong>{money(item.price)}</strong></span><button onClick={() => onRemove(item.productId)}><Trash2 /></button></article>)}</div> : <div className="cart-empty"><ShoppingCart /><h3>Keranjang masih kosong</h3><p>Tambahkan produk yang ingin dibeli.</p></div>}<footer><span><small>Subtotal</small><b>{money(cartSubtotal(items))}</b></span><button disabled={!items.length || busy} onClick={onCheckout}>{busy ? 'Membuat invoice...' : 'Checkout Sekarang'} <ArrowRight /></button><small>HWID lisensi dimasukkan di halaman member setelah pembayaran disetujui.</small><small>Satu invoice dan satu QRIS untuk semua produk.</small></footer></>}</aside></div>;
}

export function MarketplaceFooter() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const subscribe = async () => { const response = await fetch('/api/subscribers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source: 'footer' }) }); const result = await response.json(); setNotice(result.message); if (response.ok) setEmail(''); };
  return <footer className="market-footer"><div className="market-footer-grid"><div><div className="footer-brand"><span>AQ</span><b>AsistenQ<small>Tools Bantu nge-YouTube</small></b></div><p>Platform produk digital dan tools untuk membantu creator bekerja lebih cepat dan produktif.</p></div><div><b>PRODUK</b><a href="/#produk">Tools Creator</a><a href="/#produk">Free Tools</a><a href="/#produk">Audio Tools</a><a href="/#produk">Course</a></div><div><b>BANTUAN</b><a href="/info/cara-pembelian">Cara Pembelian</a><a href="/info/cara-aktivasi">Cara Aktivasi</a><a href="/info/kebijakan-refund">Kebijakan Refund</a><a href="/info/faq">FAQ</a></div><div><b>PERUSAHAAN</b><a href="/info/tentang-asistenq">Tentang AsistenQ</a><a href="/info/kontak">Kontak Kami</a><a href="/info/syarat-ketentuan">Syarat & Ketentuan</a><a href="/info/kebijakan-privasi">Kebijakan Privasi</a></div><div className="footer-subscribe"><b>Dapatkan update produk terbaru</b><p>Berlangganan untuk info dan promo eksklusif.</p><label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Masukkan email kamu..." /><button onClick={subscribe}>→</button></label>{notice && <small>{notice}</small>}<span><CreditCard /> PEMBAYARAN QRIS</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} AsistenQ. All rights reserved.</span><span><a href="/info/kebijakan-privasi">Kebijakan Privasi</a> • <a href="/info/syarat-ketentuan">Syarat & Ketentuan</a></span></div></footer>;
}

export function ManagedContent({ page, loading }: { page?: ContentPage; loading: boolean }) {
  return <><main className="market-shell managed-page"><a href="/"><ArrowLeft /> Kembali ke Marketplace</a>{loading ? <h1>Memuat halaman...</h1> : page ? <><span>ASISTENQ</span><h1>{page.title}</h1>{page.summary && <p className="managed-summary">{page.summary}</p>}<article>{page.body.split('\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article><small>Diperbarui {new Date(page.updatedAt).toLocaleDateString('id-ID')}</small></> : <h1>Halaman tidak ditemukan.</h1>}</main><MarketplaceFooter /></>;
}
