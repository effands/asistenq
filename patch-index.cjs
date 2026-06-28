const fs = require('fs');
const path = 'e:/asistenq/src/server/index.ts';
let code = fs.readFileSync(path, 'utf8');

// Add to imports
code = code.replace(
  'verifyMemberLogin,',
  'verifyMemberLogin,\n  updateMemberAccount,'
);

// Add route
const route = `
app.put('/api/admin/members/:id', requireSession, requireAdminScope('members'), async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    active: z.boolean().optional(),
    password: z.string().min(6).optional()
  });
  const body = schema.parse(req.body);
  const member = await updateMemberAccount(store, req.params.id, body);
  res.json({ success: true, member });
});
`;

code = code.replace(
  'app.get(\'/api/admin/members\'',
  route + '\napp.get(\'/api/admin/members\''
);

fs.writeFileSync(path, code);
console.log('Added PUT /api/admin/members/:id successfully.');
