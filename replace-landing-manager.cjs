const fs = require('fs');
const path = 'e:/asistenq/src/ui/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const startIndex = code.indexOf('function LandingManager(');
const endIndex = code.indexOf('\nfunction DeployPanel(');

if (startIndex === -1 || endIndex === -1) {
  console.log('Indexes not found!');
  process.exit(1);
}

const newComponent = `function LandingManager({ products, onUpdateProduct }: { products: PublicProduct[]; onUpdateProduct?: (id: string, input: Partial<PublicProduct>) => Promise<void> }) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? '');
  const selected = products.find((product) => product.slug === selectedSlug) ?? products[0];

  const [config, setConfig] = useState<LandingConfig>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!selectedSlug && products[0]) setSelectedSlug(products[0].slug);
  }, [products, selectedSlug]);

  useEffect(() => {
    if (selected) {
      setConfig(selected.landingConfig || {
        heroImageUrl: '',
        heroVideoUrl: '',
        themeColor: '',
        benefits: [],
        faqs: [],
        testimonials: []
      });
      setNotice('');
    }
  }, [selected]);

  const handleSave = async () => {
    if (!onUpdateProduct || !selected) return;
    setBusy(true);
    setNotice('');
    try {
      await onUpdateProduct(selected.id, { landingConfig: config });
      setNotice('Landing config tersimpan!');
    } catch (err: any) {
      setNotice('Gagal menyimpan: ' + err.message);
    }
    setBusy(false);
  };

  const updateConfig = (key: keyof LandingConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <section className="admin-content-grid compact-admin-grid">
      <div className="panel stack">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Landing Builder</p>
            <h2>Builder: {selected?.name}</h2>
          </div>
          <button className="primary" onClick={handleSave} disabled={busy || !onUpdateProduct}>
            {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
        {notice && <p className="form-notice">{notice}</p>}
        
        <label>Pilih Produk
          <select value={selected?.slug ?? ''} onChange={(event) => setSelectedSlug(event.target.value)}>
            {products.map((product) => <option key={product.id} value={product.slug}>{product.name}</option>)}
          </select>
        </label>

        <div className="form-grid">
          <label>URL Gambar Hero (opsional)
            <input value={config.heroImageUrl || ''} onChange={(e) => updateConfig('heroImageUrl', e.target.value)} placeholder="https://..." />
          </label>
          <label>Warna Tema (Hex, opsional)
            <input value={config.themeColor || ''} onChange={(e) => updateConfig('themeColor', e.target.value)} placeholder="#14b8a6" />
          </label>
        </div>

        <div className="builder-section">
          <h3>Fitur & Benefit</h3>
          {(config.benefits || []).map((b, i) => (
            <div key={i} className="builder-item-card">
              <input value={b.title} onChange={(e) => {
                const newB = [...(config.benefits || [])];
                newB[i].title = e.target.value;
                updateConfig('benefits', newB);
              }} placeholder="Judul Benefit" />
              <input value={b.description} onChange={(e) => {
                const newB = [...(config.benefits || [])];
                newB[i].description = e.target.value;
                updateConfig('benefits', newB);
              }} placeholder="Deskripsi Singkat" />
              <button className="ghost-button danger-lite" onClick={() => {
                const newB = [...(config.benefits || [])];
                newB.splice(i, 1);
                updateConfig('benefits', newB);
              }}>Hapus</button>
            </div>
          ))}
          <button className="ghost-button" onClick={() => updateConfig('benefits', [...(config.benefits || []), { title: '', description: '' }])}>+ Tambah Benefit</button>
        </div>

        <div className="builder-section">
          <h3>Testimoni</h3>
          {(config.testimonials || []).map((t, i) => (
            <div key={i} className="builder-item-card">
              <div className="form-grid">
                <input value={t.name} onChange={(e) => {
                  const newT = [...(config.testimonials || [])];
                  newT[i].name = e.target.value;
                  updateConfig('testimonials', newT);
                }} placeholder="Nama (Cth: Budi)" />
                <input value={t.role} onChange={(e) => {
                  const newT = [...(config.testimonials || [])];
                  newT[i].role = e.target.value;
                  updateConfig('testimonials', newT);
                }} placeholder="Pekerjaan" />
              </div>
              <textarea value={t.content} onChange={(e) => {
                const newT = [...(config.testimonials || [])];
                newT[i].content = e.target.value;
                updateConfig('testimonials', newT);
              }} placeholder="Komentar testimonial" />
              <button className="ghost-button danger-lite" onClick={() => {
                const newT = [...(config.testimonials || [])];
                newT.splice(i, 1);
                updateConfig('testimonials', newT);
              }}>Hapus</button>
            </div>
          ))}
          <button className="ghost-button" onClick={() => updateConfig('testimonials', [...(config.testimonials || []), { name: '', role: '', content: '' }])}>+ Tambah Testimoni</button>
        </div>
      </div>
      
      <div className="panel stack" style={{ alignSelf: 'start' }}>
        <p className="section-kicker">Live Preview Data</p>
        <h2>Preview</h2>
        {selected && (
          <div className="landing-preview-card">
            <span>{selected.type} · {selected.billingPeriod}</span>
            <h3>{selected.name}</h3>
            <p>{selected.headline}</p>
            <strong>{selected.formattedPrice}</strong>
            <div className="mini-checklist">
              {(config.benefits || []).map((b, i) => <span key={i}>{b.title || 'Benefit baru'}</span>)}
              {(config.testimonials || []).map((t, i) => <span key={i}>Testimoni dari {t.name || '?'}</span>)}
            </div>
            <a href={\`/produk/\${selected.slug}\`} target="_blank" rel="noreferrer" className="primary" style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>Lihat Landing Page Asli</a>
          </div>
        )}
      </div>
    </section>
  );
}
`;

const finalCode = code.substring(0, startIndex) + newComponent + code.substring(endIndex);
fs.writeFileSync(path, finalCode);
console.log('Replaced LandingManager successfully.');
