const fs = require('fs');
const path = 'e:/asistenq/src/ui/App.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/apiFetch/g, 'apiRequest');
fs.writeFileSync(path, code);
console.log('Replaced apiFetch with apiRequest');
