const fs = require('fs');
const path = 'e:/asistenq/src/ui/styles.css';
let code = fs.readFileSync(path, 'utf8');

const newStyles = `
/* Landing Builder Pro Tabs */
.builder-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 24px;
}

.builder-tabs button {
  background: transparent;
  border: none;
  color: var(--muted);
  font-weight: 600;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.builder-tabs button:hover {
  color: var(--ink);
}

.builder-tabs button.active {
  color: var(--primary);
  border-bottom: 2px solid var(--primary);
}

.tab-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

fs.writeFileSync(path, code + newStyles);
console.log('Appended builder tabs CSS successfully.');
