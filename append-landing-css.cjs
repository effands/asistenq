const fs = require('fs');
const cssPath = 'e:/asistenq/src/ui/styles.css';
let css = fs.readFileSync(cssPath, 'utf8');

const additionalCSS = `
/* Landing Builder Admin */
.builder-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.builder-item-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
}
.admin-dark .builder-item-card {
  background: rgba(0, 0, 0, 0.1);
}

/* Public Landing Dynamic Grid */
.dynamic-benefits {
  display: grid;
  gap: 16px;
}
.benefit-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.benefit-icon {
  color: var(--teal);
  background: rgba(20, 184, 166, 0.1);
  padding: 6px;
  border-radius: 8px;
}
.benefit-item h4 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
}
.benefit-item p {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}
.testimonials-grid {
  display: grid;
  gap: 16px;
}
.testimonial-card {
  padding: 20px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 12px;
  font-style: italic;
}
.testimonial-author {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  font-style: normal;
}
.testimonial-author strong { font-size: 14px; }
.testimonial-author span { font-size: 12px; color: var(--muted); }
`;

fs.writeFileSync(cssPath, css + additionalCSS);
console.log('Appended Landing CSS successfully.');
