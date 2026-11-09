# Placeholder integrasi Google Sheets

## Status sekarang

Halaman **Integrasi Google Sheets** di dashboard saat ini hanya tempat yang disiapkan untuk integrasi mendatang. Kolom URL dan nama tab masih nonaktif. Tombol **Hubungkan Google Sheets** juga dinonaktifkan, sehingga tidak ada koneksi yang dilakukan dari halaman ini.

Aplikasi pada paket ini tetap menggunakan sumber data lokal/demo selama `DATA_SOURCE=dummy`. Jangan mengubahnya ke `google-sheets` sebelum file sumber, struktur tab/range, dan akses dibahas serta disetujui dengan mentor/admin IT.

## Saat integrasi akan diaktifkan

1. Konfirmasi file Google Sheets yang menjadi sumber monitoring progres.
2. Konfirmasi sumber/tab penyerapan RKAP/GR-IR yang disiapkan mentor; catat apakah berada pada spreadsheet yang sama atau berbeda.
3. Minta admin IT menyiapkan akses baca yang sesuai untuk aplikasi.
4. Konfigurasi ID spreadsheet, nama tab/range, dan kredensial server di `.env` sesuai mekanisme integrasi yang ditinjau.
5. Uji pembacaan data dan validasi hasil dengan mentor sebelum menampilkan data operasional.

## Keamanan

- Jangan menaruh service-account JSON/key, token, atau password di form browser.
- Jangan commit `.env` atau file JSON key ke GitHub.
- Jangan menggunakan **Publish to web** untuk data internal.
- Koneksi harus menggunakan izin minimum yang disetujui; untuk kebutuhan dashboard gunakan akses baca saja.
- Nama tab dan range harus dikonfirmasi dari file sebenarnya; nilai contoh pada `.env.example` belum tentu cocok.

**Catatan:** adanya placeholder UI bukan berarti Google Sheets sudah terhubung. Sinkronisasi otomatis belum diaktifkan melalui halaman ini.
