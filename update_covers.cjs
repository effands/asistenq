const fs = require('fs');
const path = 'data/asistenq.json';
if (fs.existsSync(path)) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  data.products = data.products.map(p => {
    if (p.slug === 'vjstudio') p.coverUrl = 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80';
    if (p.slug === 'kelas-youtube-online') p.coverUrl = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80';
    if (p.slug === 'mixin9') p.coverUrl = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80';
    return p;
  });
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Updated coverUrls in database.');
} else {
  console.log('Database not found.');
}
