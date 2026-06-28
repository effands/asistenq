const fs = require('fs');
const path = 'e:/asistenq/src/ui/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const newOnUpdateMember = `
  const onUpdateMember = async (memberId: string, input: { name?: string; active?: boolean; password?: string }) => {
    if (!adminSession) return;
    await apiFetch(\`/api/admin/members/\${memberId}\`, {
      method: 'PUT',
      headers: { Authorization: \`Bearer \${adminSession.token}\` },
      body: JSON.stringify(input)
    });
    await onRefreshMembers();
  };
`;

code = code.replace(
  'const onRefreshMembers = async () => {',
  newOnUpdateMember + '\n  const onRefreshMembers = async () => {'
);

code = code.replace(
  '<AdminMemberPanel members={members} onRefresh={onRefreshMembers} />',
  '<AdminMemberPanel members={members} onRefresh={onRefreshMembers} onUpdateMember={onUpdateMember} />'
);

const startIndex = code.indexOf('function AdminMemberPanel({');
const endIndex = code.indexOf('function DeployPanel({');

if (startIndex === -1 || endIndex === -1) {
  console.error('Cannot find AdminMemberPanel');
  process.exit(1);
}

const newMemberPanel = `function AdminMemberPanel({ members, onRefresh, onUpdateMember }: {
  members: AdminMemberRow[];
  onRefresh: () => Promise<void>;
  onUpdateMember: (id: string, input: { name?: string; active?: boolean; password?: string }) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const filteredMembers = members.filter((member) => {
    const haystack = \`\${member.name} \${member.email} \${member.whatsapp ?? ''} \${member.telegramId ?? ''}\`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const handleAction = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e: any) {
      alert('Error: ' + e.message);
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
                    <button className="primary" onClick={() => handleAction(async () => {
                      const payload: any = { name: editName };
                      if (editPassword.length >= 6) payload.password = editPassword;
                      await onUpdateMember(member.id, payload);
                      setEditingId(null);
                    })}>Simpan</button>
                    <button className="ghost-button" onClick={() => setEditingId(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="member-admin-main">
                    <h3>{member.name}</h3>
                    <p>{member.email}</p>
                  </div>
                  <div className="member-admin-contact"><span>WA: {member.whatsapp || '-'}</span><span>TG: {member.telegramId || '-'}</span></div>
                  <span className={\`status-dot \${member.active ? 'status-active' : 'status-expired'}\`}>{member.active ? 'Aktif' : 'Banned'}</span>
                  <div className="member-admin-stats">
                    <span>{member.licenseCount} lisensi</span>
                    <span>{member.orderCount} order</span>
                    <span>{member.subscriptionCount} akses</span>
                  </div>
                  <div className="member-admin-meta">
                    <span>{formatDate(member.createdAt)}</span>
                    <small>Order: {member.latestOrder ? formatDate(member.latestOrder.createdAt) : '-'}</small>
                  </div>
                  <div className="member-admin-actions" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button className="ghost-button" disabled={busy} onClick={() => startEdit(member)}>Edit</button>
                    <button 
                      className={\`ghost-button \${member.active ? 'danger-lite' : ''}\`} 
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
`;

code = code.substring(0, startIndex) + newMemberPanel + code.substring(endIndex);
fs.writeFileSync(path, code);
console.log('Patched Member Panel in App.tsx');
