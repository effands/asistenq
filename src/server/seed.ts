import { createProductRecord } from './services';
import type { Store } from './store';
import bcrypt from 'bcryptjs';

export async function seedInitialData(store: Store): Promise<void> {
  if (!store.data.admins.some((admin) => admin.role === 'super_admin')) {
    store.data.admins.push({
      id: 'admin_super',
      name: 'Super Admin',
      email: process.env.ADMIN_EMAIL ?? 'admin@asistenq.com',
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'AsistenQ2026!', 12),
      role: 'super_admin',
      scopes: [],
      active: true,
      createdAt: new Date().toISOString()
    });
  }

  if (store.data.products.length === 0) {
    createProductRecord(store, {
      name: 'AsistenQ YouTube Cutter',
      slug: 'youtube-cutter',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 99000,
      headline: 'Rapikan workflow editing YouTube lebih cepat.',
      description: 'Tools awal untuk membantu creator memangkas proses kerja video harian.',
      coverUrl: '',
      accessUrl: '/member/licenses'
    });

    createProductRecord(store, {
      name: 'Kelas AsistenQ Creator',
      slug: 'kelas-creator',
      type: 'class',
      billingPeriod: 'annual',
      price: 799000,
      headline: 'Akses tahunan ke kelas video dan materi creator.',
      description: 'Materi premium untuk editing, produksi konten, dan workflow YouTube.',
      coverUrl: '',
      accessUrl: '/member/licenses'
    });
  }

  store.save();
}
