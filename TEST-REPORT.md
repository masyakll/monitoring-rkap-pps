# Laporan Pengujian — Monitoring RKAP 2026 PPS

Tanggal pemeriksaan: 14 Oktober 2026.

## Pemeriksaan yang benar-benar dilakukan

| Pemeriksaan | Hasil | Catatan |
|---|---|---|
| Pemeriksaan sintaks TypeScript dan blok `<script>` Svelte | **LULUS — 39 file/blok, 0 diagnostic sintaks** | Diperiksa memakai TypeScript transpile. Ini bukan pengganti `svelte-check` atau compiler Svelte penuh. |
| Smoke test parser CSV dan normalisasi | **LULUS — 9 pemeriksaan** | Meliputi parsing contoh anggaran, header/kurs, angka Indonesia/internasional, persen, normalisasi nama, skor kemiripan, dan penolakan kutip CSV tidak berpasangan. Parser XLSX belum diuji dengan file nyata pada pengujian ini. |
| Smoke test rumus Aktual/persentase | **LULUS — 9 pemeriksaan** | Meliputi aktual dari GR, data aktual kosong, persentase >100%, nol, pembagi nol, dan format persentase. |
| Pemeriksaan resolusi import relatif | **LULUS** | 0 import relatif non-generated yang hilang setelah path import konfigurasi diperbaiki. Tipe SvelteKit `./$types.js` dibuat saat `svelte-kit sync`. |
| Review statis kontrol API | **DILAKUKAN** | Memeriksa peran, Origin/CSRF, batas ukuran, pembatasan laju, import, rekonsiliasi, pemetaan, dan versi Prognosa. Review statis tidak membuktikan keamanan runtime. |
| `npm run check` | **BELUM TERVERIFIKASI** | Executable `svelte-kit` tidak tersedia pada `node_modules` parsial di lingkungan pemeriksaan. |
| `npm test` seluruh suite | **BELUM TERVERIFIKASI** | Executable Vitest tidak tersedia di pemasangan dependensi parsial. |
| `npm run build` | **BELUM TERVERIFIKASI** | Build SvelteKit penuh tidak dapat dijalankan tanpa dependensi terpasang lengkap. |
| Uji HTTP aktif dan browser | **BELUM TERVERIFIKASI** | Login, pembatasan percobaan, izin PIC/viewer/admin, alur impor end-to-end, ekspor, responsif, dan Prognosa terkunci masih harus diuji pada mesin dengan dependensi lengkap. |

## Perubahan penting yang sudah dilakukan

- Memisahkan komponen UI Analisa Penyerapan, Impor Data, Rekonsiliasi, Atur Pemetaan, dan Prognosa dari halaman utama.
- Merapikan CSS ke tema operasional perusahaan yang lebih tenang dengan Source Sans 3 lokal, putih/abu-abu kehijauan, aksen hijau tua, border tipis, dan teks tabel yang lebih mudah dibaca.
- Memperbaiki path import ke `config/mapping-budget.js`, `config/mapping-gr.js`, dan `config/mapping-analisa.js` yang sebelumnya salah arah.
- Mengeluarkan state lokal dan berkas prototipe statis lama dari paket review agar tidak membingungkan dan tidak membawa data runtime.
- `.env.example` tidak berisi kata sandi demo default; kata sandi dibuat secara acak pada inisialisasi pertama jika tidak dikonfigurasi.

## Asumsi dan pekerjaan tertunda

- Aktual diasumsikan sebagai realisasi GR; definisi final harus dikonfirmasi mentor.
- Prognosa memakai Aktual Januari–Agustus dari GR ditambah perkiraan September–Desember dan disimpan sebagai snapshot berversi.
- Tahap 15 ditentukan oleh Actual Finish; perilaku status Retender perlu dikonfirmasi.
- HPS dan nilai anggaran bergantung pada ketersediaan kolom dan pemetaan dari file ekspor sebenarnya.
- Data contoh bersifat fiktif. Konektor live SAP, IPRO, dan Google Sheets belum aktif.
- Rate limit masih in-memory; produksi multi-instance membutuhkan pembatasan terpusat/proxy.
- Penyimpanan utama masih file JSON; produksi memerlukan penyimpanan transaksional, backup/restore yang diuji, HTTPS, SSO, monitoring, review IT, dan uji penetrasi.

## Langkah berikutnya untuk memverifikasi di Windows

Dari folder yang berisi `package.json`, jalankan:

```powershell
npm install
npm run check
npm test
npm run build
npm run dev
```

Jika `npm install` gagal karena registry tidak dapat diakses, gunakan registry/mirror yang disetujui tim IT sebelum menilai hasil build.


## Catatan revisi Integrasi Data (26 Oktober 2026)

- Halaman **Integrasi Google Sheets** hanya placeholder UI: field link spreadsheet, nama tab monitoring, dan nama tab penyerapan bersifat nonaktif; tombol Hubungkan juga dinonaktifkan.
- Tidak ada koneksi live atau pembacaan spreadsheet yang dipicu dari halaman placeholder. Sumber demo tetap menjadi default dalam `.env.example`.
- Kode pendukung server-side masih ada untuk pengembangan berikutnya, tetapi belum divalidasi dengan file monitoring asli dan jangan diaktifkan sebelum sumber serta akses dikonfirmasi.
- `npm run check`, tes otomatis penuh, dan build belum diverifikasi pada versi ini karena dependensi lengkap tidak tersedia di lingkungan pemeriksaan.
