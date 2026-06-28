const fs = require('fs');
const path = 'e:/asistenq/src/server/services.ts';
let code = fs.readFileSync(path, 'utf8');

const newService = `
export async function updateMemberAccount(store: Store, memberId: string, input: {
  name?: string;
  active?: boolean;
  password?: string;
}): Promise<MemberAccount> {
  const member = store.data.members.find((m) => m.id === memberId);
  if (!member) throw new Error('Member tidak ditemukan.');

  if (input.name !== undefined) member.name = input.name;
  if (input.active !== undefined) member.active = input.active;
  if (input.password) {
    const bcrypt = require('bcryptjs');
    member.passwordHash = await bcrypt.hash(input.password, 12);
  }

  store.save();
  return member;
}
`;

fs.writeFileSync(path, code + newService);
console.log('Appended updateMemberAccount to services.ts successfully.');
