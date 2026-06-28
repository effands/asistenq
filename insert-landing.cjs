const fs = require('fs');

const appPath = 'e:/asistenq/src/ui/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

const landingCode = `
function LandingManager({ products, onUpdateProduct }: { products: PublicProduct[]; onUpdateProduct?: (id: string, input: Partial<PublicProduct>) => Promise<void> }) {
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
      <div className="panel stack wide">
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
            </div>
            <a href={\`/produk/\${selected.slug}\`} target="_blank" rel="noreferrer" className="primary" style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>Lihat Landing Page Asli</a>
          </div>
        )}
      </div>
    </section>
  );
}

`;

const insertIndex = appCode.indexOf('function AdminMemberPanel({');
if (insertIndex !== -1) {
  appCode = appCode.substring(0, insertIndex) + landingCode + appCode.substring(insertIndex);
  fs.writeFileSync(appPath, appCode);
  console.log('Inserted LandingManager successfully.');
} else {
  console.log('Could not find AdminMemberPanel in App.tsx');
}
