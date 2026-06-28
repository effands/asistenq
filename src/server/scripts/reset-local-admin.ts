import bcrypt from 'bcryptjs';
import { createFileStore } from '../store';

const store = createFileStore();
const email = process.env.ADMIN_EMAIL ?? 'effands@gmail.com';
const password = process.env.ADMIN_PASSWORD ?? 'aszxaszx';
const now = new Date().toISOString();

const admin = store.data.admins.find((item) => item.id === 'admin_super' || item.role === 'super_admin');
const passwordHash = await bcrypt.hash(password, 12);

if (admin) {
  admin.name = 'Super Admin';
  admin.email = email;
  admin.passwordHash = passwordHash;
  admin.role = 'super_admin';
  admin.scopes = [];
  admin.active = true;
} else {
  store.data.admins.push({
    id: 'admin_super',
    name: 'Super Admin',
    email,
    passwordHash,
    role: 'super_admin',
    scopes: [],
    active: true,
    createdAt: now
  });
}

store.save();
console.log(`Local super admin reset for ${email}`);
