const fs = require('fs');
const path = 'e:/asistenq/src/ui/styles.css';
let code = fs.readFileSync(path, 'utf8');

const newCSS = `
/* Force Landing Builder Grid Layout on Desktop */
@media (min-width: 981px) {
  .landing-builder-grid {
    display: grid !important;
    grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr) !important;
    align-items: start;
  }
}
@media (max-width: 980px) {
  .landing-builder-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

fs.writeFileSync(path, code + newCSS);
console.log('Appended landing-builder-grid CSS.');
