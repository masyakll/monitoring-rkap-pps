/**
 * aktual.ts
 * =========================================================
 * Fungsi tunggal hitungAktual() untuk menghitung nilai Aktual (realisasi)
 * per pekerjaan dari data GR (Goods Receipt).
 *
 * ⚠️  LABEL "RUMUS SEMENTARA" – belum dikonfirmasi mentor.
 * ASUMSI: Aktual = realisasi GR (bukan nilai kontrak, bukan pembayaran).
 *
 * CARA MENGGANTI RUMUS:
 * 1. Ubah isi fungsi hitungAktual() di file ini saja.
 * 2. Tidak ada rumus di tempat lain; semua halaman memanggil fungsi ini.
 * 3. Setelah mentor mengkonfirmasi, hapus label "rumus sementara" di baris
 *    AKTUAL_FORMULA_LABEL di bawah.
 *
 * Untuk mengganti ke "nilai kontrak":
 *   return (job.contractAmountIDR || 0) / rate;
 *
 * Untuk mengganti ke "pembayaran":
 *   return ((job.contractAmountIDR || 0) * (job.paidPercent || 0) / 100) / rate;
 *
 * Lihat README bagian "Cara mengganti rumus Aktual dan Prognosa".
 * =========================================================
 */

import type { Job } from './domain.js';
import type { GRRecord } from './budget-db.js';

/**
 * Label yang ditampilkan di layar selama rumus masih sementara.
 * Ubah jadi '' (kosong) setelah mentor mengkonfirmasi rumus.
 */
export const AKTUAL_FORMULA_LABEL = 'rumus sementara';

/**
 * Sumber data aktual yang dipakai.
 */
export type AktualSource = 'GR' | 'Kontrak' | 'Pembayaran';
export const AKTUAL_SOURCE: AktualSource = 'GR';

/**
 * Hitung nilai Aktual USD untuk satu pekerjaan.
 *
 * @param job - Data pekerjaan dari tabel master
 * @param grRecord - Data GR yang sudah dicocokkan ke pekerjaan ini (bisa null)
 * @param usdIdrRate - Kurs konversi IDR→USD
 * @returns Nilai aktual dalam USD (bisa null jika tidak ada data GR)
 */
export function hitungAktual(job: Job, grRecord: GRRecord | null | undefined, usdIdrRate: number): number | null {
  // ⚠️ rumus sementara: Aktual = total GR
  if (!grRecord) return null;
  // aktualTotalUsd sudah dikonversi saat impor; jangan konversi dua kali.
  if (grRecord.aktualTotalUsd !== null && grRecord.aktualTotalUsd !== undefined) return grRecord.aktualTotalUsd;
  const total = grRecord.aktualTotal;
  if (total === null || total === undefined) return null;
  if (grRecord.currency?.trim().toUpperCase() === 'USD') return total;
  if (grRecord.currency?.trim().toUpperCase() === 'IDR') return total / usdIdrRate;
  return total;
}

/**
 * Hitung nilai kontrak USD (untuk perbandingan di halaman Analisa Penyerapan).
 * Ini BUKAN nilai aktual, hanya kolom tambahan untuk mentor membandingkan.
 */
export function hitungNilaiKontrak(job: Job, usdIdrRate: number): number | null {
  if (!job.contractAmountIDR) return null;
  return job.contractAmountIDR / usdIdrRate;
}

/**
 * Hitung nilai pembayaran USD (contractAmountIDR × paidPercent / 100 / rate).
 * Ditampilkan sebagai kolom terpisah, bukan nilai aktual.
 */
export function hitungNilaiDibayar(job: Job, usdIdrRate: number): number | null {
  if (!job.contractAmountIDR || !job.paidPercent) return null;
  return (job.contractAmountIDR * job.paidPercent / 100) / usdIdrRate;
}

/**
 * Hitung persentase dengan aman (tidak error jika pembagi = 0).
 * Mengembalikan null jika pembagi nol atau salah satu null.
 */
export function hitungPersen(pembilang: number | null, pembagi: number | null): number | null {
  if (pembilang === null || pembagi === null || pembagi === 0) return null;
  return pembilang / pembagi;
}

/**
 * Format persentase ke string dengan 1 desimal.
 * Mengembalikan '-' jika null, '0,0%' jika nol.
 */
export function formatPersen(pct: number | null): string {
  if (pct === null || pct === undefined) return '-';
  if (pct === 0) return '0,0%';
  return `${(pct * 100).toFixed(1).replace('.', ',')}%`;
}

/**
 * Format USD ke string dengan pemisah ribuan.
 * Mengembalikan '-' jika null.
 */
export function formatUsd(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
