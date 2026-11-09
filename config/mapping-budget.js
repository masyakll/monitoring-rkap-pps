/**
 * Pemetaan kolom Tab A "Section Budget RKAP 2026" ke field aplikasi.
 * Tiap field mempunyai banyak alias (nama alternatif kolom dari file CSV/XLSX).
 * Kunci (key) adalah nama field internal aplikasi.
 * Nilai (aliases) adalah array string yang dicari secara case-insensitive
 * setelah header diratakan menjadi jalur, misal "Carried Over > USD Amount".
 *
 * Ubah file ini jika nama kolom di file impor berubah.
 * JANGAN mengubah nama kunci internal (commitmentItem, dll).
 */
export const BUDGET_COLUMN_MAPPING = {
  /** Kunci utama / primary key penghubung ke pekerjaan (WAJIB) */
  commitmentItem: {
    required: true,
    aliases: [
      'commitment item',
      'commitment_item',
      'commitmentitem',
      'no. commitment',
      'commitment no',
      'ci',
    ],
  },
  /** GL Account */
  glAccount: {
    required: false,
    aliases: [
      'gl account',
      'gl_account',
      'glaccount',
      'gl',
      'account',
    ],
  },
  /** HPS dalam USD (opsional bila berkas anggaran/ekspor menyertakannya). */
  hpsUsd: {
    required: false,
    aliases: ['hps usd', 'hps > usd', 'hps (usd)', 'hps amount usd', 'harga perkiraan sendiri usd'],
  },
  /** Tahun Commitment */
  tahun: {
    required: false,
    aliases: [
      'tahun commitment',
      'tahun',
      'year',
      'commitment year',
    ],
  },
  /** PR Y/N */
  prYN: {
    required: false,
    aliases: [
      'pr (y/n)',
      'pr y/n',
      'pr',
      'purchase requisition',
    ],
  },
  /** Fund Center */
  fundCenter: {
    required: false,
    aliases: [
      'fund center',
      'fund_center',
      'fundcenter',
      'fc',
    ],
  },
  /** Deskripsi / nama pekerjaan (kunci sekunder untuk rekonsiliasi) */
  deskripsi: {
    required: false,
    aliases: [
      'deskripsi',
      'description',
      'keterangan',
      'uraian',
      'nama pekerjaan',
      'item',
      'commitment item #2',
    ],
  },
  // ------- Carried Over -------
  carriedOverQty: {
    required: false,
    aliases: [
      'carried over > qty',
      'carried_over > qty',
      'carried over qty',
      'carryover qty',
    ],
  },
  carriedOverCurr: {
    required: false,
    aliases: [
      'carried over > original curr > curr',
      'carried over > curr',
      'carried over curr',
    ],
  },
  carriedOverAmount: {
    required: false,
    aliases: [
      'carried over > original curr > amount',
      'carried over > amount',
      'carried over amount',
    ],
  },
  carriedOverUsd: {
    required: false,
    aliases: [
      'carried over > usd amount',
      'carried over usd',
      'carryover usd',
    ],
  },
  // ------- Commitment -------
  commitmentQty: {
    required: false,
    aliases: [
      'commitment > qty',
      'commitment qty',
    ],
  },
  commitmentCurr: {
    required: false,
    aliases: [
      'commitment > original curr > curr',
      'commitment > curr',
      'commitment curr',
    ],
  },
  commitmentAmount: {
    required: false,
    aliases: [
      'commitment > original curr > amount',
      'commitment > amount',
      'commitment amount',
    ],
  },
  commitmentUsd: {
    required: false,
    aliases: [
      'commitment > usd amount',
      'commitment usd',
    ],
  },
  // ------- RKAP 2026 bulanan -------
  rkapQty: {
    required: false,
    aliases: ['rkap 2026 > qty', 'rkap qty'],
  },
  rkapCurr: {
    required: false,
    aliases: ['rkap 2026 > curr', 'rkap curr', 'rkap 2026 > currency'],
  },
  rkapJan: { required: false, aliases: ['rkap 2026 > jan', 'rkap jan', 'january'] },
  rkapFeb: { required: false, aliases: ['rkap 2026 > feb', 'rkap feb', 'february'] },
  rkapMar: { required: false, aliases: ['rkap 2026 > mar', 'rkap mar', 'march'] },
  rkapApr: { required: false, aliases: ['rkap 2026 > apr', 'rkap apr', 'april'] },
  rkapMei: { required: false, aliases: ['rkap 2026 > mei', 'rkap mei', 'may'] },
  rkapJun: { required: false, aliases: ['rkap 2026 > jun', 'rkap jun', 'june'] },
  rkapJul: { required: false, aliases: ['rkap 2026 > jul', 'rkap jul', 'july'] },
  rkapAgu: { required: false, aliases: ['rkap 2026 > agu', 'rkap agu', 'august'] },
  rkapSep: { required: false, aliases: ['rkap 2026 > sep', 'rkap sep', 'september'] },
  rkapOkt: { required: false, aliases: ['rkap 2026 > okt', 'rkap okt', 'october'] },
  rkapNov: { required: false, aliases: ['rkap 2026 > nov', 'rkap nov', 'november'] },
  rkapDes: { required: false, aliases: ['rkap 2026 > des', 'rkap des', 'december'] },
};

/**
 * Baris yang diabaikan dalam proses impor.
 * Baris dengan kolom utama (commitmentItem) yang cocok dengan pola ini dilewati.
 */
export const SKIP_ROW_PATTERNS = [
  /^total$/i,
  /^jumlah$/i,
  /^subtotal$/i,
  /^grand total$/i,
  /^sum$/i,
];

/**
 * Nilai default kurs USD-IDR jika tidak ditemukan di header file.
 */
export const DEFAULT_USD_IDR_RATE = 16300;

/**
 * Pola header kurs di baris judul file.
 * Cari teks yang mengandung "kurs" lalu ambil angka setelahnya.
 */
export const RATE_HEADER_PATTERN = /kurs[\s:]*([0-9][0-9.,]*)/i;


/**
 * Pengaturan baris khusus dari lembar acuan. Jika baris hanya berisi nilai 16.500,
 * anggap sebagai baris bantu kurs/subtotal dan tampilkan di pratinjau sebagai dilewati.
 * Ubah ke false jika pemilik data memastikan nilai tunggal tersebut adalah data pekerjaan.
 */
export const BUDGET_IMPORT_OPTIONS = {
  skipSpecial16500Row: true,
};
