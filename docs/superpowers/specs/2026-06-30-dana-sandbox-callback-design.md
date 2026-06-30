# DANA Sandbox Callback Design

## Goal

Menyiapkan fondasi integrasi DANA sandbox untuk AsistenQ agar:
- portal sandbox DANA bisa diarahkan ke URL callback AsistenQ,
- callback pembayaran bisa menandai order `paid` otomatis,
- order menyimpan metadata DANA dasar untuk tahap integrasi berikutnya.

## Scope Tahap Ini

- Tambah field order untuk menyimpan metadata pembayaran DANA.
- Tambah helper service untuk memproses payload `Finish Notify` dari DANA sandbox.
- Tambah endpoint publik untuk menerima callback dan redirect sandbox.
- Belum mengerjakan `Generate QRIS` API call atau signature verification production.
- Belum mengotomatiskan pengiriman lisensi berbasis HWID dari callback.

## Design

### Data model

Order akan memiliki field opsional:
- `paymentProvider`
- `paymentReferenceNo`
- `paymentPartnerReferenceNo`
- `paymentRedirectUrl`
- `paymentPayload`

Field ini cukup untuk mengikat invoice AsistenQ dengan transaksi DANA tanpa memaksa desain final production terlalu cepat.

### Callback flow

1. DANA sandbox mengirim `Finish Notify`.
2. Server membaca `originalPartnerReferenceNo` atau `partnerReferenceNo`.
3. Reference itu dicocokkan ke `invoiceNumber` atau partner reference yang tersimpan di order.
4. Jika status transaksi sukses, order ditandai `paid`.
5. Server mengembalikan response sukses format DANA.

### Redirect flow

Endpoint redirect sederhana akan mengarahkan user kembali ke member area AsistenQ. Ini cukup untuk kebutuhan sandbox awal.

## Risk Notes

- Payload DANA berbeda antar produk; helper harus toleran pada beberapa nama field reference/status.
- Tanpa signature verification, endpoint ini khusus fondasi sandbox dan belum layak disebut final production.
- Untuk lisensi tool, callback paid hanya membuka jalan pembayaran otomatis. Pembuatan lisensi otomatis tetap tahap berikutnya.
