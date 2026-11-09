/**
 * Pemetaan kolom Tab "GR Capex Opex" ke field aplikasi.
 * Tab ini berisi realisasi GR (Goods Receipt) per pekerjaan.
 * Kolom ke-20 (T) adalah nilai aktual yang dipakai sheet lama.
 *
 * ASUMSI (belum dikonfirmasi mentor): Aktual = realisasi GR.
 * Ubah file ini jika struktur sheet GR berubah.
 */
export const GR_COLUMN_MAPPING = {
  /** Kunci utama: commitment item (lebih diutamakan daripada nama) */
  commitmentItem: {
    required: false,
    aliases: [
      'commitment item',
      'ci',
      'commitment_item',
      'commitmentitem',
      'no. commitment',
    ],
  },
  /** Nama pekerjaan (kunci sekunder jika commitment item tidak ada) */
  namaPekerjaan: {
    required: false,
    aliases: [
      'nama pekerjaan',
      'description',
      'deskripsi',
      'item',
      'pekerjaan',
      'uraian pekerjaan',
      'nama',
    ],
  },
  /** Tipe: CAPEX atau OPEX */
  tipe: {
    required: false,
    aliases: ['tipe', 'type', 'jenis', 'capex/opex'],
  },
  /** Kolom ke-20 (T) – nilai aktual GR total yang dipakai sheet lama.
   *  Ini bisa dikonfigurasi ulang di halaman Atur Pemetaan. */
  aktualTotal: {
    required: false,
    isAktualColumn: true,   // tandai sebagai kolom nilai aktual yang bisa dipilih
    aliases: [
      'total gr',
      'total realisasi',
      'aktual',
      'aktual total',
      'realisasi',
      'gr total',
      'col_t',          // fallback jika header tidak dikenal (kolom ke-20)
    ],
  },
  // ------- GR bulanan (opsional) -------
  grJan: { required: false, aliases: ['gr jan', 'januari', 'jan', 'realisasi jan', 'gr jan 2026'] },
  grFeb: { required: false, aliases: ['gr feb', 'februari', 'feb', 'realisasi feb'] },
  grMar: { required: false, aliases: ['gr mar', 'maret', 'mar', 'realisasi mar'] },
  grApr: { required: false, aliases: ['gr apr', 'april', 'apr', 'realisasi apr'] },
  grMei: { required: false, aliases: ['gr mei', 'mei', 'may', 'realisasi mei'] },
  grJun: { required: false, aliases: ['gr jun', 'juni', 'jun', 'realisasi jun'] },
  grJul: { required: false, aliases: ['gr jul', 'juli', 'jul', 'realisasi jul'] },
  grAgu: { required: false, aliases: ['gr agu', 'agustus', 'agu', 'aug', 'realisasi agu'] },
  grSep: { required: false, aliases: ['gr sep', 'september', 'sep', 'realisasi sep'] },
  grOkt: { required: false, aliases: ['gr okt', 'oktober', 'okt', 'oct', 'realisasi okt'] },
  grNov: { required: false, aliases: ['gr nov', 'november', 'nov', 'realisasi nov'] },
  grDes: { required: false, aliases: ['gr des', 'desember', 'des', 'dec', 'realisasi des'] },
  /** Mata uang GR */
  grCurr: { required: false, aliases: ['currency', 'curr', 'mata uang', 'gr curr'] },
};

/**
 * Nama kolom ke-20 sebagai fallback jika header tidak dikenali.
 * Bisa diatur ulang di halaman Atur Pemetaan.
 */
export const DEFAULT_AKTUAL_COLUMN_INDEX = 19; // 0-indexed = kolom ke-20

/**
 * Baris yang diabaikan dalam proses impor GR.
 */
export const GR_SKIP_ROW_PATTERNS = [
  /^total$/i,
  /^jumlah$/i,
  /^subtotal$/i,
  /^grand total$/i,
  /^sum$/i,
];
