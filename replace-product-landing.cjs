const fs = require('fs');
const path = 'e:/asistenq/src/ui/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const startIndex = code.indexOf('function ProductLanding({');
const endIndex = code.indexOf('\nfunction Mixin9Landing({');

if (startIndex === -1 || endIndex === -1) {
  console.log('Indexes not found!');
  process.exit(1);
}

const newComponent = `function ProductLanding({ isLoading, product, onJoin }: { isLoading: boolean; product?: PublicProduct; onJoin: () => void }) {
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
      <section className="product-sales-hero" style={conf.heroImageUrl ? { background: \`linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(\${conf.heroImageUrl}) center/cover\` } : {}}>
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
          {product.compareAtPrice ? <small className="compare-price">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.compareAtPrice).replace(/\\s/g, '')}</small> : null}
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
`;

const finalCode = code.substring(0, startIndex) + newComponent + code.substring(endIndex);
fs.writeFileSync(path, finalCode);
console.log('Replaced ProductLanding successfully.');
