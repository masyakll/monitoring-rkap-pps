# Data Awal Pekerjaan per PIC

Dataset awal ini berisi 82 nama pekerjaan dari screenshot yang diberikan untuk PIC Obed, Eka, Azwil, dan Irfan.

- Tidak ada Commitment Item yang dimasukkan karena tertutup pada screenshot.
- Tanggal tahapan dan catatan progres belum dimasukkan; seluruh milestone sengaja kosong supaya tidak mengarang data.
- Nilai anggaran, HPS, kontrak, pembayaran, dan GR/SES tidak dianggap sebagai data aktual. Field numerik legacy masih disetel 0 oleh seed karena tipe data aplikasi memerlukannya; `rkapBudgetUSD` disimpan null.
- Beberapa label/year di screenshot perlu dicocokkan lagi dengan file sumber sebelum digunakan sebagai data resmi, khususnya item Irfan No. 5, 7, 9 yang tahun pada kolom tampak kosong dan item Azwil dengan kode PIC PPS AP/DI.
- `data/daftar-pekerjaan-pic.csv` adalah referensi yang mudah diperiksa; `src/lib/server/db.ts` menggunakan daftar yang sama untuk seed saat `data/state.json` belum ada.

Penting: aplikasi hanya membangun seed ketika `data/state.json` belum ada. Jika project lokal sudah punya `data/state.json`, mengganti `db.ts` saja tidak otomatis mengganti data yang tersimpan di file itu. Jangan menghapus file tersebut sebelum membuat backup.
