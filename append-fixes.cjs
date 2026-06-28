const fs = require('fs');
const path = 'e:/asistenq/src/ui/styles.css';
let code = fs.readFileSync(path, 'utf8');

// Fix member-table columns
code = code.replace(
  'grid-template-columns: minmax(210px, 1.4fr) minmax(170px, 1fr) 90px minmax(200px, 1fr) minmax(130px, .7fr);',
  'grid-template-columns: minmax(210px, 1.4fr) minmax(170px, 1fr) 90px minmax(200px, 1fr) minmax(130px, .7fr) 100px;'
);

// Fix deploy-log
code = code.replace(
  '  background: #061714;\n  color: #d7fff4;',
  '  background: rgba(0, 0, 0, 0.04);\n  color: var(--ink);'
);

const newStyles = `
/* Member Actions Additions */
.member-edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: rgba(0,0,0,0.03);
  border-radius: 12px;
  grid-column: 1 / -1;
  border: 1px solid var(--line);
}

.admin-dark .member-edit-form {
  background: rgba(255,255,255,0.04);
}

.member-edit-form h4 {
  margin: 0;
  color: var(--ink);
}

.member-admin-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.danger-lite {
  color: #ff4b4b !important;
  border-color: rgba(255, 75, 75, 0.2) !important;
}

/* Deploy Log Dark Mode Override */
.admin-dark .deploy-log {
  background: rgba(0,0,0,0.4);
  color: #fff;
}
`;

fs.writeFileSync(path, code + newStyles);
console.log('Appended CSS fixes successfully.');
