import crypto from 'node:crypto';
import type { ContentPage } from '../shared/types';
import type { Store } from './store';

const initialPages: Array<Omit<ContentPage, 'id' | 'updatedAt'>> = [
  { slug: 'cara-pembelian', title: 'Cara Pembelian', summary: 'Panduan membeli produk digital di AsistenQ.', body: 'Pilih produk dan paket, masukkan ke keranjang, login sebagai member, lalu bayar tepat sesuai nominal QRIS pada invoice. Setelah pembayaran diverifikasi, akses produk tersedia di akun member.', published: true },
  { slug: 'cara-aktivasi', title: 'Cara Aktivasi & Pengiriman', summary: 'Cara menerima dan mengaktifkan produk.', body: 'Lisensi, file, tautan akses, atau kelas dikirim ke akun member sesuai jenis produk. Untuk aplikasi berlisensi, ikuti petunjuk HWID dan masukkan token aktivasi yang diterima.', published: true },
  { slug: 'kebijakan-refund', title: 'Kebijakan Refund', summary: 'Ketentuan pengembalian dana produk digital.', body: 'Permohonan refund dapat diajukan maksimal 7 hari apabila produk tidak dapat digunakan karena masalah yang dapat diverifikasi dan tim bantuan tidak berhasil menyelesaikannya. Produk yang sudah diunduh, lisensi yang sudah aktif, atau layanan yang telah digunakan dapat dikecualikan.', published: true },
  { slug: 'syarat-ketentuan', title: 'Syarat & Ketentuan', summary: 'Ketentuan penggunaan marketplace AsistenQ.', body: 'Dengan membeli atau menggunakan produk AsistenQ, pengguna menyetujui penggunaan yang sah, menjaga keamanan akun, dan tidak membagikan lisensi atau file tanpa izin. Detail produk dan masa akses mengikuti informasi pada halaman pembelian.', published: true },
  { slug: 'kebijakan-privasi', title: 'Kebijakan Privasi', summary: 'Cara AsistenQ memproses data pengguna.', body: 'AsistenQ menggunakan data akun dan transaksi untuk menyediakan layanan, memproses pembayaran, dukungan, serta keamanan. Data tidak dijual dan hanya dibagikan kepada penyedia layanan yang diperlukan untuk operasional.', published: true },
  { slug: 'faq', title: 'Pertanyaan Umum', summary: 'Jawaban singkat mengenai pembelian dan akses.', body: 'Pembayaran menggunakan QRIS dengan nominal unik. Verifikasi dilakukan admin. Seluruh produk yang berhasil diproses dapat dilihat melalui akun member.', published: true },
  { slug: 'tentang-asistenq', title: 'Tentang AsistenQ', summary: 'Marketplace tools bantu creator.', body: 'AsistenQ menyediakan aplikasi, file digital, web tools, dan kelas untuk membantu creator bekerja lebih cepat, produktif, dan konsisten.', published: true },
  { slug: 'kontak', title: 'Kontak & Bantuan', summary: 'Hubungi tim AsistenQ.', body: 'Gunakan kanal Telegram atau informasi kontak resmi yang tersedia di website untuk bantuan pembelian, aktivasi, dan penggunaan produk.', published: true }
];

export function seedSiteContent(store: Store, now = new Date()): void {
  let changed = false;
  for (const page of initialPages) if (!store.data.contentPages.some((row) => row.slug === page.slug)) {
    store.data.contentPages.push({ ...page, id: crypto.randomUUID(), updatedAt: now.toISOString() });
    changed = true;
  }
  if (changed) store.save();
}

export function publishedContent(store: Store, slug: string): ContentPage {
  const page = store.data.contentPages.find((row) => row.slug === slug && row.published);
  if (!page) throw new Error('halaman tidak ditemukan');
  return page;
}

export function updateContentPage(store: Store, id: string, patch: Pick<ContentPage, 'body' | 'published'> & Partial<Pick<ContentPage, 'title' | 'summary'>>, now = new Date()): ContentPage {
  const page = store.data.contentPages.find((row) => row.id === id);
  if (!page) throw new Error('halaman tidak ditemukan');
  Object.assign(page, patch, { updatedAt: now.toISOString() });
  store.save();
  return page;
}
