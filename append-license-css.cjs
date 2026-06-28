const fs = require('fs');
const cssPath = 'e:/asistenq/src/ui/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');

const additionalCSS = `
/* License Table Redesign */
.license-compact-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) minmax(140px, 1fr) minmax(180px, 1fr) auto minmax(200px, 1fr);
  gap: 12px;
  align-items: center;
  border-top: 1px solid var(--line);
  padding: 12px;
  font-size: 12px;
  min-width: 900px;
}
.license-compact-head {
  border-top: 0;
  background: rgba(0, 140, 134, .08);
  color: var(--muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}
.license-col-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.license-col-main b {
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}
.license-col-main span {
  color: var(--muted);
  font-size: 11px;
}
.license-col-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--muted);
}
.license-col-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.license-col-token code {
  background: var(--ink);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  word-break: break-all;
  display: block;
}
.admin-dark .license-col-token code {
  background: rgba(20, 184, 166, 0.15);
  color: var(--teal);
}
.license-col-actions {
  display: flex;
  gap: 8px;
}
.license-col-reset {
  display: flex;
  gap: 8px;
}
.license-col-reset input {
  min-height: 32px;
  padding: 4px 10px;
  font-size: 11px;
}
.license-col-reset button {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 11px;
}
`;

fs.writeFileSync(cssPath, css + additionalCSS);
console.log('Appended License CSS successfully.');
