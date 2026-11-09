# Menjalankan dataset demo

Paket ini menyiapkan 15 pekerjaan contoh dengan variasi status: belum kontrak, terlambat, belum mulai, sedang berjalan, selesai tepat waktu, selesai terlambat, dibatalkan, terminated, dan retender. Dataset juga berisi anggaran RKAP, aktual GR, prognosa, penyebab, quick win, serta histori impor contoh.

**Seluruh nama pekerjaan yang diawali `DEMO |`, angka anggaran, nilai GR, progres, tanggal, dan prognosa adalah data simulasi.** Jangan dipakai sebagai angka aktual perusahaan atau laporan resmi.

## Aktivasi tanpa menimpa data lama

1. Backup file `.env` yang sekarang.
2. Buka `.env` di root project.
3. Pastikan `DATA_SOURCE=dummy`.
4. Tambahkan atau ubah baris berikut:

```env
DATA_SOURCE=dummy
DATA_DIR=./data-demo
USD_IDR_RATE=16300
SCS_HPS_LIMIT_USD=1000
COOKIE_SECURE=false
```

5. Simpan `.env`, hentikan server lama dengan `Ctrl+C`, lalu jalankan `npm run dev`.
6. Login menggunakan username dan password yang sama seperti akun lokal project sebelumnya.
7. Banner `MODE DEMO` akan terlihat di bagian atas aplikasi.

Folder `data/state.json` asli tidak diubah. Untuk kembali ke dataset lama, hapus `DATA_DIR=./data-demo` atau kosongkan nilainya pada `.env`, lalu restart server.

## Isi dataset

- 15 pekerjaan contoh, dibagi ke PIC Eka, Azwil, Irfan, dan Obed.
- 15 record Plan RKAP, 15 record GR, dan 15 versi Prognosa contoh.
- Status mencakup 9 kategori agar ringkasan dan indikator progres bisa dilihat.
- Total Plan RKAP contoh: USD 126,119.63.
- Total Aktual GR contoh: USD 56,009.63.
- Total Prognosa contoh: USD 115,409.63.

Semua angka di atas bersifat fiktif untuk pengujian tampilan dan fungsi.

## Uji import

Pada halaman Impor Data, gunakan akun yang telah memiliki izin impor pada konfigurasi project.

- RKAP: `contoh/DEMO-RKAP-2026.csv`
- GR: `contoh/DEMO-GR-CAPEX-OPEX.csv`

Kedua CSV berisi 15 baris yang memakai Commitment Item sama dengan dataset demo. Karena record sudah dimuat, pratinjau impor ulang akan memperlihatkan pembaruan berdasarkan Commitment Item, bukan membuat pekerjaan baru.

## Akun PIC

Dataset mempertahankan akun PIC yang sudah ada pada project: Eka, Azwil, Irfan, dan Obed. Setiap PIC memiliki pekerjaan demo masing-masing untuk mencoba pembatasan edit berdasarkan kepemilikan. Hash kata sandi dipertahankan dari file state project yang dikirim; tidak ada kata sandi baru yang dibuat atau dicantumkan di sini.
