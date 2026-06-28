const fs = require('fs');
const cssPath = 'e:/asistenq/src/ui/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');

const startIndex = css.indexOf('.admin-shell {');
const endIndex = css.indexOf('.member-page {');

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find start or end index.');
  process.exit(1);
}

const newAdminCSS = `
/* Premium Glassmorphic Admin Redesign */
.admin-shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 100vh;
  background: 
    radial-gradient(circle at 10% 10%, rgba(93, 224, 203, 0.2), transparent 30rem),
    radial-gradient(circle at 90% 90%, rgba(45, 175, 155, 0.15), transparent 40rem),
    #f0f5f3;
  color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
  transition: background 0.4s ease, color 0.4s ease;
}

.admin-dark {
  --ink: #f0fdf9;
  --muted: #a3c4bc;
  --line: rgba(255, 255, 255, 0.08);
  --panel-bg: rgba(10, 25, 22, 0.65);
  --panel-strong: rgba(15, 38, 33, 0.75);
  --field-bg: rgba(255, 255, 255, 0.04);
  --field-border: rgba(255, 255, 255, 0.1);
  --teal: #14b8a6;
  background:
    radial-gradient(circle at 20% 0%, rgba(20, 184, 166, 0.15), transparent 40rem),
    radial-gradient(circle at 80% 100%, rgba(13, 148, 136, 0.1), transparent 40rem),
    linear-gradient(135deg, #020807 0%, #061f1b 100%);
}

.admin-sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100vh;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.4);
  padding: 24px 20px;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 1px 0 20px rgba(0, 0, 0, 0.02);
  transition: all 0.3s ease;
}

.admin-dark .admin-sidebar {
  background: rgba(4, 13, 11, 0.5);
  box-shadow: 1px 0 30px rgba(0, 0, 0, 0.2);
}

.admin-nav {
  display: grid;
  gap: 6px;
}

.admin-nav button,
.admin-public-link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border-radius: 12px;
  text-align: left;
  padding: 12px 16px;
  font-weight: 500;
  color: var(--muted);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;
  border: 1px solid transparent;
}

.admin-nav button svg,
.admin-public-link svg {
  transition: transform 0.2s ease, color 0.2s ease;
}

.admin-nav button.active {
  background: #fff;
  color: var(--teal);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.admin-nav button:hover:not(.active),
.admin-public-link:hover {
  background: rgba(0, 140, 134, 0.06);
  color: var(--ink);
}

.admin-nav button:hover svg {
  transform: scale(1.1);
}

.admin-dark .admin-nav button.active {
  background: rgba(20, 184, 166, 0.1);
  color: #5eead4;
  border: 1px solid rgba(45, 212, 191, 0.15);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.admin-dark .admin-nav button:hover:not(.active) {
  background: rgba(255, 255, 255, 0.05);
}

.admin-public-link {
  margin-top: auto;
  border: 1px dashed var(--line);
}

.admin-workspace {
  width: min(1200px, calc(100% - 60px));
  margin: 0 auto;
  padding: 40px 0 60px;
}

.admin-topbar {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin-bottom: 36px;
  animation: slideDown 0.5s ease backwards;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.admin-topbar h1 {
  margin: 4px 0 0;
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--ink);
}

.admin-topbar .section-kicker {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--teal);
  font-weight: 700;
}

.admin-top-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 16px;
  align-items: center;
}

.theme-toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px;
  backdrop-filter: blur(10px);
}

.theme-toggle button {
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.2s ease;
  cursor: pointer;
}

.theme-toggle button.active {
  background: var(--ink);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.admin-dark .theme-toggle {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.05);
}

.admin-dark .theme-toggle button.active {
  background: var(--teal);
  color: #000;
  box-shadow: 0 4px 15px rgba(20, 184, 166, 0.2);
}

.status-pill {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.admin-dark .status-pill,
.admin-dark .panel,
.admin-dark .metric,
.admin-dark .auth-form {
  background: var(--panel-bg);
  border: 1px solid var(--line);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: var(--ink);
}

.admin-login-screen {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(380px, 460px);
  gap: 32px;
  align-items: center;
  max-width: 1200px;
  margin: 40px auto 0;
  animation: fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.admin-login-copy {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 540px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 32px;
  background: 
    linear-gradient(135deg, rgba(20, 184, 166, 0.9) 0%, rgba(13, 148, 136, 0.95) 100%),
    url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop') center/cover;
  box-shadow: 0 20px 40px rgba(13, 148, 136, 0.2);
  padding: 48px;
  color: #fff;
}

.admin-dark .admin-login-copy {
  background: 
    linear-gradient(135deg, rgba(5, 30, 27, 0.85) 0%, rgba(2, 12, 10, 0.95) 100%),
    url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop') center/cover;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.05);
}

.admin-login-copy::before {
  content: "";
  position: absolute;
  top: -20%; left: -10%;
  width: 70%; height: 70%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
  border-radius: 50%;
}

.admin-login-copy .chip {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: auto;
}

.admin-login-copy h2 {
  position: relative;
  max-width: 90%;
  margin: 0 0 16px;
  font-size: clamp(40px, 5vw, 64px);
  line-height: 1.05;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.admin-login-copy p {
  position: relative;
  max-width: 85%;
  margin: 0 0 32px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 18px;
  line-height: 1.6;
}

.admin-login-points {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.admin-login-points span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.2s ease, background 0.2s ease;
}

.admin-login-points span:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
}

.admin-login-screen > .auth-form {
  border-radius: 32px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.admin-dark .admin-login-screen > .auth-form {
  background: rgba(10, 25, 22, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.admin-login-screen > .auth-form h2 {
  margin: 0 0 28px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.admin-login-screen > .auth-form .primary {
  width: 100%;
  min-height: 56px;
  margin-top: 12px;
  background: var(--teal);
  color: #fff;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 10px 25px rgba(20, 184, 166, 0.3);
  transition: all 0.2s ease;
}

.admin-login-screen > .auth-form .primary:hover {
  background: #0f9688;
  box-shadow: 0 12px 30px rgba(20, 184, 166, 0.4);
  transform: translateY(-2px);
}

.admin-login-screen > .auth-form .primary:active {
  transform: translateY(0);
}

.admin-dark .admin-login-screen > .auth-form .primary {
  background: #5eead4;
  color: #042f2e;
  box-shadow: 0 10px 25px rgba(94, 234, 212, 0.2);
}

.admin-dark .admin-login-screen > .auth-form .primary:hover {
  background: #2dd4bf;
}

.admin-dark .admin-login-screen > .auth-form input {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.1);
  color: #f0fdf9;
  border-radius: 14px;
}

.admin-dark .admin-login-screen > .auth-form input:focus {
  border-color: var(--teal);
  background: rgba(20, 184, 166, 0.05);
}

.admin-dark .admin-login-screen > .auth-form .form-notice {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(127, 29, 29, 0.2);
  color: #fca5a5;
  border-radius: 12px;
  padding: 12px;
}

.spin-icon {
  animation: admin-spin .8s linear infinite;
}

@keyframes admin-spin {
  to { transform: rotate(360deg); }
}

.admin-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.compact-admin-grid {
  grid-template-columns: minmax(0, .95fr) minmax(320px, .65fr);
}

.admin-content-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel,
.auth-form {
  padding: 28px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.panel:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05);
}

.stack {
  display: grid;
  gap: 18px;
}

.wide,
.metrics {
  grid-column: 1 / -1;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.metric {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px 16px;
  align-items: center;
  min-height: 104px;
  padding: 20px 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.metric:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.06);
  border-color: rgba(20, 184, 166, 0.3);
}

.metric svg {
  color: var(--teal);
  background: rgba(20, 184, 166, 0.1);
  padding: 12px;
  border-radius: 14px;
  width: 48px;
  height: 48px;
  transition: transform 0.3s ease;
}

.metric:hover svg {
  transform: scale(1.1) rotate(5deg);
}

.metric span {
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric strong {
  grid-column: 1 / -1;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  min-height: 52px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  background: #f8faf9;
  color: var(--ink);
  padding: 14px 18px;
  font-size: 15px;
  transition: all 0.2s ease;
  outline: none;
}

input:hover,
select:hover,
textarea:hover {
  border-color: rgba(0, 0, 0, 0.15);
}

.admin-dark input,
.admin-dark select,
.admin-dark textarea {
  border-color: var(--field-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--ink);
}

.admin-dark input:hover,
.admin-dark select:hover,
.admin-dark textarea:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.admin-dark select option {
  background: #0f2622;
  color: #eafff8;
}

.admin-dark input::placeholder,
.admin-dark textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--teal);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.15);
}

textarea {
  min-height: 120px;
  resize: vertical;
}

.table {
  display: grid;
}

.table-row {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) .7fr .9fr .8fr;
  gap: 16px;
  align-items: center;
  border-top: 1px solid var(--line);
  padding: 18px 0;
  transition: background 0.2s ease;
}

.table-row:hover {
  background: rgba(20, 184, 166, 0.02);
}

.table-row:first-child {
  border-top: 0;
}

.table-row span {
  color: var(--muted);
}

.product-admin-list {
  display: grid;
  gap: 16px;
}

.product-admin-card {
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.8);
  padding: 20px;
  backdrop-filter: blur(10px);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.product-admin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.admin-dark .product-admin-card {
  background: var(--panel-strong);
  border-color: rgba(255, 255, 255, 0.05);
}

.product-admin-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}

.product-admin-summary strong {
  display: block;
  font-size: 18px;
  font-weight: 700;
}

.product-admin-summary span {
  display: block;
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
}

.product-edit-box {
  display: grid;
  gap: 16px;
  margin-top: 20px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}

.product-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.zip-upload-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border: 2px dashed rgba(20, 184, 166, 0.4);
  border-radius: 14px;
  background: rgba(20, 184, 166, 0.05);
  color: var(--teal);
  padding: 12px 20px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zip-upload-button:hover {
  background: rgba(20, 184, 166, 0.1);
  border-color: var(--teal);
}

.admin-dark .zip-upload-button {
  background: rgba(20, 184, 166, 0.1);
  color: #5eead4;
}

.zip-upload-button input {
  display: none;
}

\n`;

const finalCSS = css.substring(0, startIndex) + newAdminCSS + css.substring(endIndex);
fs.writeFileSync(cssPath, finalCSS);
console.log('Successfully replaced admin CSS.');
