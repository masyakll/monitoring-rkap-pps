/**
 * Pemetaan kolom Tab B "Analisa Penyerapan" ke field aplikasi.
 * Tab ini berisi data CAPEX dan OPEX dari sheet lama.
 * Digunakan untuk migrasi data historis; data baru dihitung dari GR.
 */
export const ANALISA_COLUMN_MAPPING = {
  /** Nama pekerjaan / item */
  item: {
    required: true,
    aliases: [
      'item',
      'nama pekerjaan',
      'pekerjaan',
      'description',
      'deskripsi',
      'uraian',
    ],
  },
  /** Tipe: CAPEX atau OPEX */
  tipe: {
    required: false,
    aliases: ['tipe', 'type', 'jenis', 'capex/opex'],
  },
  /** Plan RKAP USD */
  planUsd: {
    required: false,
    aliases: [
      'plan rkap (usd)',
      'plan rkap usd',
      'plan usd',
      'plan rkap',
      'anggaran usd',
      'budget usd',
    ],
  },
  /** Plan RKAP % (selalu 100, diabaikan) */
  planPct: { required: false, aliases: ['plan rkap (%)', 'plan %', 'plan pct'] },
  /** Aktual USD */
  aktualUsd: {
    required: false,
    aliases: [
      'aktual (usd)',
      'aktual usd',
      'actual usd',
      'realisasi usd',
    ],
  },
  /** Prognosa s.d Des USD */
  prognosaUsd: {
    required: false,
    aliases: [
      'prognosa s.d des (usd)',
      'prognosa usd',
      'prognosis usd',
      'forecast usd',
    ],
  },
  /** Update Progres (teks bebas) */
  updateProgres: {
    required: false,
    aliases: [
      'update progres',
      'update progress',
      'progres',
      'progress update',
      'keterangan progres',
    ],
  },
  /** Penyebab tidak terserap (teks bebas) */
  penyebab: {
    required: false,
    aliases: [
      'penyebab tidak terserap',
      'penyebab',
      'cause',
      'alasan',
    ],
  },
  /** Quick Win (teks bebas) */
  quickWin: {
    required: false,
    aliases: [
      'quick win',
      'quickwin',
      'solusi cepat',
      'action',
    ],
  },
  /** Grup Kategori */
  grupKategori: {
    required: false,
    aliases: [
      'grup kategori',
      'kategori',
      'group',
      'category',
    ],
  },
};

/**
 * Kategori penyebab tidak terserap.
 * Daftar ini dipakai untuk Summary Executive dan pilihan dropdown.
 */
export const CAPEX_CAUSES = [
  'Delivery Material',
  'Harga Penawaran > Pagu',
  'Nilai Kontrak < Pagu',
];

export const OPEX_CAUSES = [
  'Delivery Material',
  'Proses Pengadaan',
  'Harga Penawaran > Pagu',
  'Nilai Kontrak < Pagu',
  'Perubahan Jadwal Maintenance',
];
