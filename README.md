# Monitoring RKAP 2026 — Departemen PPS

Aplikasi web internal berbasis SvelteKit untuk menampilkan progres pekerjaan RKAP 2026 dan data penyerapan/GR/IR. Paket ini dijalankan dengan sumber data demo lokal. Halaman Integrasi Google Sheets hanya placeholder; file Google Sheets belum terhubung. Koneksi SAP/IPRO langsung belum diaktifkan.

## 1. Fokus sistem terbaru

- **Monitoring progres**: nama pekerjaan, PIC, CAPEX/OPEX, Commitment Item, Last Progress, detail progres/remarks, tanggal milestone, dan status pekerjaan.
- **Detail proses berdasarkan file monitoring lama**: KAK, HPS dan persetujuannya, tahap release PR, Tender Briefing/BATB, Quotation, Technical Evaluation, penetapan pemenang, Draft Contract, Contract/PO, Execution, dan GR/SES jika tersedia di sheet.
- **Indikator perhatian**: menampilkan waktu sejak tanggal milestone terakhir yang terbaca. Ambang 30 hari adalah indikator untuk meninjau pekerjaan, bukan SLA resmi atau bukti otomatis bahwa pekerjaan terlambat.
- **Tab Penyerapan RKAP & GR/IR**: membaca tabel dari sheet penyerapan yang disiapkan mentor. Nama header dan isi tabel ditampilkan apa adanya; total finansial tidak ditebak sebelum definisi kolom dikonfirmasi.
- **Data eksternal hanya-baca**: saat `DATA_SOURCE=google-sheets`, website tidak mengizinkan perubahan data pekerjaan dari halaman web. Perubahan dilakukan pada sumber spreadsheet yang mendapat izin.
- Mode dummy tetap tersedia untuk demo lokal, termasuk impor anggaran/GR dan modul lama. Modul analisa dan prognosa lama hanya muncul pada mode dummy agar tidak tercampur dengan sumber live.

> **Penting:** mapping monitoring memakai kode kolom `A1`–`A110` yang terlihat pada baris kode di file monitoring lama. Sebelum dipakai untuk pekerjaan nyata, cocokkan nama tab, baris kode, dan isi kolom pada spreadsheet sumber. Kredensial Google dan data internal tidak boleh dimasukkan ke repositori publik.

## 2. Kebutuhan

- Node.js 20 atau lebih baru.
- npm dan koneksi ke registry paket yang disetujui, atau cache/mirror internal.
- Windows 10/11, macOS, atau Linux. Contoh di bawah menggunakan PowerShell Windows.

## 3. Menjalankan mode demo

1. Ekstrak ZIP ke folder seperti `C:\rkap-monitoring`.
2. Buka folder yang berisi `package.json` di Antigravity/VS Code.
3. Salin `.env.example` sebagai `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Biarkan `DATA_SOURCE=dummy` untuk memakai data contoh lokal.
5. Pasang dependensi dan jalankan:

   ```powershell
   npm install
   npm run dev
   ```

6. Buka alamat lokal yang ditampilkan Vite, biasanya `http://127.0.0.1:5173`.

Akun demo dibuat saat data pertama kali diinisialisasi. Sebelum inisialisasi, kata sandi dapat diatur melalui `DEMO_PASSWORD_EKA`, `DEMO_PASSWORD_AZWIL`, `DEMO_PASSWORD_IRFAN`, `DEMO_PASSWORD_OBED`, `DEMO_PASSWORD_MENTOR`, dan `DEMO_PASSWORD_ADMIN` pada `.env`. Jika kosong, kata sandi acak dicetak satu kali ke terminal. Mengubah `.env` setelah `data/state.json` dibuat tidak mengganti hash kata sandi yang sudah tersimpan.

## Tab Integrasi Data

Tab **Integrasi Data** tersedia untuk mentor/admin sebagai ruang konfigurasi yang akan dipakai pada tahap integrasi berikutnya. Link Google Sheets dan nama tab saat ini berupa kolom nonaktif; tombol **Hubungkan Google Sheets** juga dinonaktifkan. Halaman ini belum menyimpan URL dan belum membaca spreadsheet.

Untuk sekarang, biarkan `DATA_SOURCE=dummy` pada `.env`. Kode pendukung koneksi server-side tetap tersedia sebagai dasar pengembangan, tetapi jangan mengaktifkannya sebelum mentor memastikan file sumber, nama tab/range, definisi kolom dan aksesnya, serta langkah integrasi disetujui. Panduan ringkas tersedia pada `PANDUAN-INTEGRASI-GOOGLE-SHEETS.md`.

## 4. Rencana integrasi Google Sheets (belum diaktifkan)

Bagian ini hanya untuk referensi nanti, bukan langkah yang perlu dilakukan sekarang.

1. Konfirmasi file Google Sheets yang akan dipakai untuk data progres monitoring.
2. Konfirmasi tab penyerapan RKAP/GR-IR yang disiapkan mentor; pastikan apakah berada di spreadsheet yang sama atau file terpisah.
3. Minta admin/IT menyiapkan akses baca untuk aplikasi sesuai aturan perusahaan.
4. Cocokkan nama tab, baris header, dan range dengan workbook asli. Contoh konfigurasi pada `.env.example` mungkin perlu diubah.
5. Baru setelah disetujui, admin/developer mengatur ID dan rentang spreadsheet serta kredensial di konfigurasi server, lalu menguji hasil baca dengan mentor.

Jangan memasukkan kredensial Google ke kolom browser atau repositori. Jangan menggunakan “Publish to web” untuk data internal. Sampai integrasi disetujui dan diuji, website harus tetap berjalan pada mode demo yang dikonfigurasi.

### Struktur sheet monitoring lama

Range monitoring harus dimulai dari baris yang berisi kode kolom `A1`, `A2`, ... `A110` (dan secara opsional `A111`–`A121`) pada row 7, data pekerjaan dimulai setelahnya. Default range mencakup 110 kolom lama sampai DF. Jika mentor menambahkan kolom opsional A111–A121 (DG–DQ), perluas `MONITORING_SHEET_RANGE` sampai DQ5000 dan isi kode A111–A121 pada baris kode. Adapter memakai kode yang terlihat pada file monitoring untuk membaca kolom, di antaranya:

- `A1`–`A8`: nomor, tahun, PP No., OPEX/CAPEX, PIC PPS, AUC No., Commitment Item, Title FC.
- `A14`–`A24`: KAK, anggaran/HPS, dan tahapan persetujuan HPS. Nominal dari kolom anggaran/HPS/available dan nominal PR/kontrak dari workbook lama sengaja tidak ditampilkan; angka resmi untuk penyerapan diambil dari tab khusus mentor.
- `A25`–`A37`: informasi PR dan tahapan Release.
- `A38`–`A47`: Tender Briefing/BATB dan Quotation.
- `A78`–`A95`: Document TE, penetapan pemenang, dan Draft Contract.
- `A96`–`A108`: nomor/tanggal kontrak, vendor, jadwal eksekusi, GR/SES dan garansi. Nominal kontrak (`A98`) sengaja disembunyikan pada dashboard monitoring.
- `A109`: Last Progress; `A110`: Detail Progress of Work/Remarks. Kolom opsional `A111`–`A117` bisa dipakai untuk kendala, tindak lanjut, PIC tindak lanjut, deadline, status tindak lanjut, jumlah revisi, dan tanggal update progres. Kolom `A118`–`A121` opsional untuk status SCS, tanggal pengajuan, tanggal persetujuan, serta catatan SCS. Jika kolom tersebut belum ada, dashboard menandai informasinya belum tersedia dan tidak mengarang isinya.

Nama dan urutan sebagian sub-tahap harus diperiksa terhadap workbook aktual sebelum dipakai untuk laporan resmi. Nilai yang tidak terlihat sebagai tanggal tetap ditampilkan sebagai isi sumber pada tabel milestone; aplikasi tidak mengarang tanggal yang kosong.

### Struktur sheet penyerapan

Tab penyerapan default adalah `Penyerapan RKAP`, dengan header pada baris pertama dan data mulai baris kedua. Tabel pada dashboard mengikuti nama header dan nilai di sheet. Setelah mentor menetapkan kolom resmi untuk GR, IR, dan penyerapan, rumus total/persentase dapat ditambahkan. Jangan menyamakan nilai kontrak, pembayaran, GR, IR, dan penyerapan tanpa definisi yang disetujui departemen.

### Perilaku sinkronisasi

- Google Sheets dibaca dari server, bukan langsung dari browser. Token dan key service account tidak dikirim ke client.
- Hasil baca disimpan dalam cache memori singkat (45 detik) untuk mengurangi permintaan berulang. **Refresh data** menghapus cache dan membaca ulang.
- Pembaruan di Google Sheets tampil setelah pembacaan ulang. Tidak ada sinkronisasi real-time/push dan website tidak menulis balik ke spreadsheet.
- Jika server tidak bisa membaca sheet, periksa ID, range, service account, izin Viewer, serta status Google Sheets API.

## 5. Uji, build, dan produksi lokal

Jalankan di mesin yang dependensinya terpasang:

```powershell
npm run check
npm test
npm run build
npm run start
```

`npm run start` menggunakan hasil build adapter-node. Hentikan server sebelumnya dengan `Ctrl+C` sebelum menjalankan ulang. Jika port 5173 dipakai, gunakan `npm run dev -- --port 5174`.

## 6. Data dan keamanan

- `.env`, `data/state.json`, key service account, file Excel internal, dan backup tidak boleh masuk GitHub publik.
- Mode Google Sheets bersifat baca-saja. PIC/mentor mengubah data pada sumber yang sudah memiliki hak akses; halaman web hanya menyajikan data.
- Google Sheets service account hanya diberi hak Viewer. Jangan mengaktifkan edit atau memakai akun pribadi sebagai password aplikasi.
- Jangan mengunggah data internal ke layanan pihak ketiga yang belum disetujui.
- Mode demo memakai data contoh, tidak boleh dianggap angka aktual perusahaan.
- Untuk produksi, perlu HTTPS/reverse proxy, database transaksional, backup/pemulihan, autentikasi perusahaan, retensi audit, review keamanan, dan uji yang disetujui IT.

## 7. Catatan batasan saat ini

- Konektor SAP/IPRO langsung belum aktif. Integrasi IPRO masih menunggu proses permohonan dan akses yang disetujui.
- Nilai dan rasio di tab Penyerapan RKAP belum dihitung otomatis sebelum struktur sheet mentor dipastikan.
- Indikator “tanpa progres ≥ N hari” adalah alat untuk menarik perhatian, bukan bukti keterlambatan berdasarkan SLA. Untuk menghitung keterlambatan proses dengan benar, sumber data perlu memuat target tanggal/deadline tahap yang disepakati.
- Data progres yang dibaca dari Google Sheets hanya-baca; website tidak menyediakan form input ke sumber pada mode ini.
- Paket ini harus diuji build dan dicocokkan dengan spreadsheet asli di komputer pengembangan sebelum dipakai untuk demo resmi.
