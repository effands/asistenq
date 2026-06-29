const fs = require('fs');

const appPath = 'e:/asistenq/src/ui/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. Add onCreateProduct to LandingManager instantiation
appCode = appCode.replace(
  '<LandingManager products={products} onUpdateProduct={onUpdateProduct} />',
  '<LandingManager products={products} onUpdateProduct={onUpdateProduct} onCreateProduct={onCreateProduct} />'
);

// 2. Replace the whole LandingManager function
const startIndex = appCode.indexOf('function LandingManager(');
const endIndex = appCode.indexOf('function AdminMemberPanel(');

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find boundaries for LandingManager');
  process.exit(1);
}

const newLandingManager = `
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
    <section className="admin-content-grid compact-admin-grid">
      <div className="panel stack wide">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Landing Builder Pro</p>
            <h2>{isCreating ? 'Buat Produk & Landing Baru' : \`Builder: \${selected?.name}\`}</h2>
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
      
      <div className="panel stack" style={{ alignSelf: 'start', background: 'var(--bg)', borderColor: config.themeColor || 'var(--line)' }}>
        <p className="section-kicker">Live Preview</p>
        <h2>{basicInfo.name || 'Nama Produk'}</h2>
        <div className="landing-preview-card" style={{ borderColor: config.themeColor || 'var(--line)', background: 'var(--surface)' }}>
          <span style={{ color: config.themeColor || 'var(--primary)' }}>{basicInfo.type} · {basicInfo.billingPeriod}</span>
          <h3 style={{ fontSize: '24px', margin: '8px 0' }}>{basicInfo.headline || 'Headline menarik di sini'}</h3>
          <p style={{ color: 'var(--muted)' }}>{basicInfo.description || 'Deskripsi singkat produk.'}</p>
          <strong style={{ fontSize: '28px', color: 'var(--ink)' }}>Rp{basicInfo.price.toLocaleString('id-ID')}</strong>
          <div className="mini-checklist" style={{ marginTop: '16px' }}>
            {(config.benefits || []).map((b, i) => <span key={i}>✓ {b.title || 'Benefit baru'}</span>)}
          </div>
          <button className="primary" style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '20px', background: config.themeColor || 'var(--primary)' }}>Beli Sekarang</button>
        </div>
        {!isCreating && selected && (
           <a href={\`/produk/\${selected.slug}\`} target="_blank" rel="noreferrer" className="ghost-button" style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>Buka Halaman Publik</a>
        )}
      </div>
    </section>
  );
}
`;

appCode = appCode.substring(0, startIndex) + newLandingManager + '\n' + appCode.substring(endIndex);

fs.writeFileSync(appPath, appCode);
console.log('Successfully rebuilt LandingManager');
