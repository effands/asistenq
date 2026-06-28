const fs = require('fs');

// Fix server index
const serverPath = 'e:/asistenq/src/server/index.ts';
let serverCode = fs.readFileSync(serverPath, 'utf8');
serverCode = serverCode.replace(
  'const member = await updateMemberAccount(store, req.params.id, body);',
  'const member = await updateMemberAccount(store, req.params.id as string, body);'
);
fs.writeFileSync(serverPath, serverCode);
console.log('Fixed server index.ts');

// Fix App.tsx
const appPath = 'e:/asistenq/src/ui/App.tsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Add onUpdateMember definition to App()
const onUpdateMemberCode = `
  const onUpdateMember = async (memberId: string, input: any) => {
    if (!adminSession) return;
    await apiFetch(\`/api/admin/members/\${memberId}\`, {
      method: 'PUT',
      headers: { Authorization: \`Bearer \${adminSession.token}\` },
      body: JSON.stringify(input)
    });
    await onRefreshMembers();
  };
`;

appCode = appCode.replace(
  'const onRefreshMembers = async () => {',
  onUpdateMemberCode + '\n  const onRefreshMembers = async () => {'
);

// Add to AdminPanel props
appCode = appCode.replace(
  '  onRefreshMembers: () => Promise<void>;',
  '  onRefreshMembers: () => Promise<void>;\n  onUpdateMember: (id: string, input: any) => Promise<void>;'
);

appCode = appCode.replace(
  '  onRefreshMembers,\n  onResetOperationalData,',
  '  onRefreshMembers,\n  onUpdateMember,\n  onResetOperationalData,'
);

appCode = appCode.replace(
  '<AdminPanel\n        activeSection={adminSection}',
  '<AdminPanel\n        onUpdateMember={onUpdateMember}\n        activeSection={adminSection}'
);

fs.writeFileSync(appPath, appCode);
console.log('Fixed App.tsx');
