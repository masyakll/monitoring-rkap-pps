/**
 * budget-parser.ts
 * Parser header bertingkat untuk file impor Tab A (Section Budget RKAP 2026)
 * dan Tab "GR Capex Opex". Mendukung sel gabungan (merged cells) sampai 3 baris header.
 *
 * Cara kerja:
 * 1. Baca file (XLSX dengan ExcelJS atau CSV mentah).
 * 2. Lewati baris judul (sebelum header tabel), baris pembantu (semua angka), baris kosong.
 * 3. Deteksi paling banyak 3 baris header – tandai baris yang mengandung "Commitment Item",
 *    "Carried Over", "RKAP", dll. sebagai baris header.
 * 4. Tangani merged cells: salin nilai grup ke kolom kanan yang kosong.
 * 5. Ratakan nama kolom menjadi jalur, misal "Carried Over > Original Curr > Amount".
 * 6. Deteksi kolom ganda (nama sama) – beri akhiran #2, #3, dst.
 * 7. Kembalikan array objek flat per baris data.
 */

import ExcelJS from 'exceljs';
import { RATE_HEADER_PATTERN, DEFAULT_USD_IDR_RATE, SKIP_ROW_PATTERNS, BUDGET_IMPORT_OPTIONS } from '../../../config/mapping-budget.js';
import { GR_SKIP_ROW_PATTERNS } from '../../../config/mapping-gr.js';

// ─── Tipe ─────────────────────────────────────────────────────────────────────

export type ParsedFile = {
  /** Nama sheet (jika XLSX) */
  sheetName: string;
  /** Kurs yang terbaca dari header, atau default 16.300 */
  usdIdrRate: number;
  /** Nomor baris header asli (1-based); berguna untuk audit pratinjau */
  headerRows: number[];
  /** Metadata header (Fund Center, Divisi) dari baris judul */
  metadata: Record<string, string>;
  /** Nama kolom hasil perataan (sudah de-duplicate) */
  columns: FlatColumn[];
  /** Baris data (jumlah sampai 5.000) */
  rows: FlatRow[];
  /** Peringatan (tidak fatal) */
  warnings: string[];
  /** Baris yang dilewati beserta alasannya */
  skipped: SkippedRow[];
};

export type FlatColumn = {
  /** Jalur nama kolom, misal "Carried Over > USD Amount" */
  path: string;
  /** Apakah nama ini sudah di-deduplicate (ada #2) */
  duplicated: boolean;
  /** Indeks kolom asli di sheet (0-based) */
  colIndex: number;
};

export type FlatRow = {
  /** Nomor baris asli di file (1-based) */
  rowIndex: number;
  /** Nilai tiap kolom, key = path kolom, value = string */
  values: Record<string, string>;
};

export type SkippedRow = {
  rowIndex: number;
  reason: string;
};

// ─── Nilai Error Excel/Sheets yang dianggap kosong ───────────────────────────

const EXCEL_ERRORS = new Set(['#NAME?', '#REF!', '#DIV/0!', '#N/A', '#VALUE!', '#NULL!', '#NUM!', '#GETTING_DATA']);

// ─── Pola baris yang diabaikan ─────────────────────────────────────────────

const ALL_SKIP_PATTERNS = [...SKIP_ROW_PATTERNS, ...GR_SKIP_ROW_PATTERNS];

function isSkipRow(values: string[]): string | null {
  const nonEmpty = values.filter((v) => v.trim());
  if (!nonEmpty.length) return 'baris kosong';
  // Nilai 16.500 pada contoh lembar RKAP belum dipastikan apakah kurs, subtotal, atau data.
  // Tetapkan opsi eksplisit agar pengguna bisa menyalakan/mematikan perilaku ini.
  if (nonEmpty.length === 1 && parseNumber(nonEmpty[0]) === 16500 && BUDGET_IMPORT_OPTIONS.skipSpecial16500Row) {
    return 'baris khusus nilai 16.500 (dapat diubah di config/mapping-budget.js)';
  }
  // Baris pembantu berisi beberapa angka berulang, misalnya 1,1,1,1,1 di atas header.
  if (nonEmpty.length > 1 && nonEmpty.every((v) => /^[\d.,\s]+$/.test(v.trim()))) return 'baris pembantu angka';
  // Baris Total/Jumlah
  const first = nonEmpty[0].trim();
  if (ALL_SKIP_PATTERNS.some((p) => p.test(first))) return `baris ${first} (diabaikan)`;
  return null;
}

// ─── Pembersih nilai sel ──────────────────────────────────────────────────────

function cleanCellValue(raw: unknown, warnings: string[], rowIdx: number, colName: string): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (EXCEL_ERRORS.has(str)) {
    warnings.push(`Baris ${rowIdx}: nilai error "${str}" pada kolom "${colName}" dianggap kosong.`);
    return '';
  }
  return str;
}

// ─── Normalisasi angka Indonesia / internasional ──────────────────────────────

export function parseNumber(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  let str = raw.trim();
  // Persen
  const isPct = str.endsWith('%');
  if (isPct) str = str.slice(0, -1).trim();
  // Format Indonesia: 1.234.567,89 atau 1,234,567.89
  // Deteksi separator: jika koma terakhir diikuti 3 digit → koma = ribuan → titik = desimal
  //                    jika titik terakhir diikuti 3 digit → titik = ribuan → koma = desimal
  const hasDot = str.includes('.');
  const hasComma = str.includes(',');
  if (hasDot && hasComma) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format Indonesia: 1.234.567,89
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format internasional: 1,234,567.89
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Bisa: 1,234 (ribuan) atau 1,23 (desimal).
    const afterComma = str.split(',').at(-1) || '';
    if (afterComma.length === 3 && !afterComma.includes('.')) {
      str = str.replace(/,/g, ''); // ribuan
    } else {
      str = str.replace(',', '.'); // desimal
    }
  } else if (hasDot && /^\d{1,3}(?:\.\d{3})+$/.test(str)) {
    // Format Indonesia tanpa pecahan: 16.300 atau 1.234.567.
    str = str.replace(/\./g, '');
  }
  const num = Number(str);
  if (!Number.isFinite(num)) return null;
  return isPct ? num / 100 : num;
}

// ─── Normalisasi tanggal ──────────────────────────────────────────────────────

export function parseDate(raw: string | number): string {
  if (!raw && raw !== 0) return '';
  // Nomor seri Excel
  if (typeof raw === 'number' || /^\d{5}$/.test(String(raw))) {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (num > 25000 && num < 60000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(epoch.getTime() + num * 86400000);
      return date.toISOString().slice(0, 10);
    }
  }
  const str = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY atau DD-MM-YYYY
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y;
    return `${year.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

// ─── Perataan header bertingkat (max 3 baris) ─────────────────────────────────

/**
 * Mengubah matrix 2D baris header menjadi array FlatColumn dengan jalur tergabung.
 * Menangani merged cells: nilai kosong di baris header menyalin nilai dari baris atas.
 */
export function flattenHeaders(headerRows: string[][]): FlatColumn[] {
  const colCount = Math.max(...headerRows.map((r) => r.length));
  const cols: FlatColumn[] = [];
  // Isi kanan untuk tiap baris (forward fill per baris — simulasi merge horizontal)
  const filled: string[][] = headerRows.map((row) => {
    const result: string[] = [];
    let last = '';
    for (let c = 0; c < colCount; c++) {
      const val = (row[c] || '').trim();
      if (val) last = val;
      result.push(last);
    }
    return result;
  });

  // Bangun jalur tiap kolom
  for (let c = 0; c < colCount; c++) {
    const parts: string[] = [];
    for (let r = 0; r < filled.length; r++) {
      const val = filled[r][c] || '';
      if (val && !parts.includes(val)) parts.push(val);
    }
    cols.push({ path: parts.join(' > '), duplicated: false, colIndex: c });
  }

  // Deduplicate: jika jalur sama, beri #2, #3 dst.
  const seen = new Map<string, number>();
  for (const col of cols) {
    const count = (seen.get(col.path) || 0) + 1;
    seen.set(col.path, count);
    if (count > 1) {
      col.path = `${col.path} #${count}`;
      col.duplicated = true;
    }
  }
  return cols;
}

// ─── Deteksi baris header ─────────────────────────────────────────────────────

const HEADER_KEYWORDS = [
  'commitment item', 'commitment', 'gl account', 'rkap', 'carried over',
  'fund center', 'deskripsi', 'description', 'item', 'qty', 'amount', 'usd', 'curr',
  'plan', 'actual', 'aktual', 'last progress', 'prognosa', 'persentase', 'realisasi',
  'budget', 'penyebab', 'quick win', 'update progres', 'contract', 'value', 'nilai', 'keterangan',
  'month', 'jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des',
];

function rowLooksLikeHeader(values: string[]): boolean {
  const nonEmpty = values.filter((v) => v.trim());
  if (!nonEmpty.length) return false;
  const normalized = nonEmpty.map((v) => v.toLowerCase().trim());
  const matches = normalized.filter((v) => HEADER_KEYWORDS.some((kw) => v.includes(kw)));
  return matches.length >= 2;
}

// ─── Ekstrasi kurs dari baris judul ──────────────────────────────────────────

function extractRate(text: string): number | null {
  const m = RATE_HEADER_PATTERN.exec(text);
  if (!m) return null;
  const num = parseNumber(m[1]);
  return num && num > 1000 ? num : null;
}

// ─── Ekstrasi metadata dari baris judul ──────────────────────────────────────

function extractMetadata(text: string, meta: Record<string, string>) {
  const divisiMatch = /divisi\s*:\s*(.+)/i.exec(text);
  if (divisiMatch) meta.divisi = divisiMatch[1].trim();
  const fcMatch = /fund center\s*:\s*(.+)/i.exec(text);
  if (fcMatch) meta.fundCenter = fcMatch[1].trim();
  const tahunMatch = /rkap\s+(\d{4})/i.exec(text);
  if (tahunMatch) meta.tahun = tahunMatch[1];
}

// ─── Validasi container XLSX sebelum parsing ─────────────────────────────────
// XLSX adalah ZIP; batas ukuran ekstraksi dan jumlah entri mengurangi risiko zip bomb.
export function assertSafeXlsxContainer(buffer: Buffer): void {
  if (buffer.length < 22 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('Isi berkas bukan XLSX/ZIP yang valid.');
  const minEocd = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= minEocd; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Struktur XLSX tidak lengkap.');
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entries || entries < 1 || entries > 250) throw new Error('Struktur arsip XLSX tidak didukung atau terlalu kompleks.');
  if (centralOffset + centralSize > eocd) throw new Error('Direktori XLSX tidak valid.');
  let offset = centralOffset;
  let totalUncompressed = 0;
  const names = new Set<string>();
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Entri ZIP XLSX tidak valid.');
    const flags = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLen + extraLen + commentLen;
    if (end > buffer.length) throw new Error('Nama entri XLSX terpotong.');
    if (flags & 1) throw new Error('Arsip XLSX terenkripsi tidak didukung.');
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen).replace(/\\/g, '/');
    const segments = name.split('/');
    if (name.startsWith('/') || segments.includes('..') || segments.some((part) => ['__proto__', 'prototype', 'constructor'].includes(part.toLowerCase()))) throw new Error('Nama entri XLSX tidak aman.');
    names.add(name);
    totalUncompressed += uncompressed;
    if (uncompressed > 12 * 1024 * 1024 || totalUncompressed > 32 * 1024 * 1024) throw new Error('Isi XLSX terlalu besar setelah dibuka.');
    if (uncompressed > 1024 * 1024 && (compressed === 0 || uncompressed / compressed > 120)) throw new Error('Rasio kompresi XLSX tidak wajar; berkas ditolak.');
    offset = end;
  }
  if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) throw new Error('Berkas ZIP bukan dokumen XLSX yang valid.');
}

// ─── XLSX PARSER ─────────────────────────────────────────────────────────────

export async function parseXlsxBudget(buffer: Buffer, sheetNameHint?: string): Promise<ParsedFile> {
  assertSafeXlsxContainer(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any, { ignoreNodes: ['dataValidations'] });
  let sheet = sheetNameHint
    ? workbook.getWorksheet(sheetNameHint) || workbook.worksheets[0]
    : workbook.worksheets[0];
  if (!sheet) throw new Error('Sheet tidak ditemukan di file XLSX.');
  return parseWorksheet(sheet);
}

function parseWorksheet(sheet: ExcelJS.Worksheet): ParsedFile {
  const sheetName = sheet.name;
  if (sheet.rowCount > 5000) throw new Error('Maksimal 5.000 baris per sheet. Pilih sheet atau pecah file menjadi beberapa bagian.');
  const warnings: string[] = [];
  const skipped: SkippedRow[] = [];
  const metadata: Record<string, string> = {};
  let usdIdrRate = DEFAULT_USD_IDR_RATE;

  // Kumpulkan semua baris sebagai string[][]
  const rawRows: { rowIndex: number; values: string[] }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let val: string;
      const cv = cell.value;
      if (cv === null || cv === undefined) val = '';
      else if (cv instanceof Date) val = cv.toISOString().slice(0, 10);
      else if (typeof cv === 'object' && 'text' in cv) val = String((cv as { text: string }).text);
      else if (typeof cv === 'object' && 'result' in cv) {
        const result = (cv as ExcelJS.CellFormulaValue).result;
        val = result !== null && result !== undefined ? String(result) : '';
      }
      else val = String(cv);
      vals.push(val.trim());
    });
    rawRows.push({ rowIndex: rowNumber, values: vals });
  });

  return processRawRows(rawRows, sheetName, warnings, skipped, metadata, usdIdrRate);
}

// ─── CSV PARSER (header bertingkat) ──────────────────────────────────────────

/** Tolak signature file biner/berbahaya sebelum decode UTF-8 sebagai CSV. */
export function assertSafeCsvBuffer(buffer: Buffer): void {
  if (!buffer.length) throw new Error('File CSV kosong.');
  if (buffer.includes(0)) throw new Error('Isi file mengandung byte nol; file ini bukan CSV teks yang valid.');
  const prefix = buffer.subarray(0, 16);
  const ascii = prefix.toString('latin1');
  const signatures = [
    ascii.startsWith('PK\x03\x04'), ascii.startsWith('MZ'), ascii.startsWith('%PDF-'),
    ascii.startsWith('GIF87a'), ascii.startsWith('GIF89a'), ascii.startsWith('BM'),
    prefix[0] === 0x89 && prefix.subarray(1, 4).toString('ascii') === 'PNG',
    prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff,
    prefix[0] === 0x7f && prefix.subarray(1, 4).toString('ascii') === 'ELF'
  ];
  if (signatures.some(Boolean)) throw new Error('Isi berkas bukan teks CSV. Pilih berkas CSV yang benar.');
  const textStart = buffer.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (textStart.startsWith('<!doctype html') || textStart.startsWith('<html') || textStart.startsWith('<?xml')) {
    throw new Error('Isi berkas terlihat seperti halaman web/XML, bukan CSV. Ekspor ulang sebagai CSV.');
  }
}

export function parseCsvBudget(text: string): ParsedFile {
  const input = text.replace(/^\uFEFF/, '');
  if (!input.trim()) throw new Error('File CSV kosong.');
  if (input.includes('\u0000')) throw new Error('Isi file mengandung byte nol; file ini bukan CSV teks yang valid.');
  // Ekspor regional dapat memakai titik koma atau tab; pilih pemisah dari baris awal di luar kutip.
  const delimiterCounts = new Map<string, number>([[',', 0], [';', 0], ['\t', 0]]);
  let inQuotes = false;
  let countsOnLine = new Map<string, number>([[',', 0], [';', 0], ['\t', 0]]);
  let inspectedLines = 0;
  for (let i = 0; i < input.length && inspectedLines < 8; i++) {
    const ch = input[i];
    if (ch === '"' && input[i + 1] === '"' && inQuotes) { i++; continue; }
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) countsOnLine.set(ch, (countsOnLine.get(ch) || 0) + 1);
    else if (!inQuotes && ch === '\n') {
      for (const [key, value] of countsOnLine) delimiterCounts.set(key, (delimiterCounts.get(key) || 0) + value);
      countsOnLine = new Map<string, number>([[',', 0], [';', 0], ['\t', 0]]);
      inspectedLines++;
    }
  }
  for (const [key, value] of countsOnLine) delimiterCounts.set(key, (delimiterCounts.get(key) || 0) + value);
  const delimiter = [...delimiterCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ',';
  const rawCells: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') {
      row.push(cell.replace(/\r$/, '').trim());
      rawCells.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('Format CSV tidak valid: tanda kutip tidak berpasangan.');
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '').trim()); rawCells.push(row); }

  const warnings: string[] = [];
  const skipped: SkippedRow[] = [];
  const metadata: Record<string, string> = {};
  const usdIdrRate = DEFAULT_USD_IDR_RATE;

  const rawRows = rawCells.map((values, i) => ({ rowIndex: i + 1, values }));
  return processRawRows(rawRows, 'CSV', warnings, skipped, metadata, usdIdrRate);
}

// ─── Proses baris mentah (shared) ────────────────────────────────────────────

function processRawRows(
  rawRows: { rowIndex: number; values: string[] }[],
  sheetName: string,
  warnings: string[],
  skipped: SkippedRow[],
  metadata: Record<string, string>,
  defaultRate: number,
): ParsedFile {
  if (rawRows.length > 5000) throw new Error('Maksimal 5.000 baris per file. Pecah file menjadi beberapa bagian lalu impor satu per satu.');
  let usdIdrRate = defaultRate;

  // Pass 1: pisah baris judul, baris header, baris data
  let headerRowIndices: number[] = [];
  let dataStartIndex = 0;
  let firstHeaderRaw = -1;

  for (let i = 0; i < rawRows.length && i < 20; i++) {
    const { values, rowIndex } = rawRows[i];
    const combined = values.join(' ');
    // Cari kurs
    const rate = extractRate(combined);
    if (rate) usdIdrRate = rate;
    // Metadata
    extractMetadata(combined, metadata);
    // Cek apakah baris ini header
    if (rowLooksLikeHeader(values)) {
      if (firstHeaderRaw < 0) firstHeaderRaw = i;
    }
  }

  // Baris pembantu numerik sebelum header sengaja dicatat agar terlihat di pratinjau.
  if (firstHeaderRaw >= 0) {
    for (let i = 0; i < firstHeaderRaw; i++) {
      const reason = isSkipRow(rawRows[i].values);
      if (reason && (reason.includes('pembantu angka') || reason.includes('nilai 16.500'))) {
        skipped.push({ rowIndex: rawRows[i].rowIndex, reason });
      }
    }
  }

  // Ambil sampai 3 baris header berturut-turut mulai dari baris pertama yang terdeteksi
  if (firstHeaderRaw >= 0) {
    for (let i = firstHeaderRaw; i < Math.min(firstHeaderRaw + 3, rawRows.length); i++) {
      if (rowLooksLikeHeader(rawRows[i].values) || i === firstHeaderRaw) {
        headerRowIndices.push(i);
      } else break;
    }
    dataStartIndex = (headerRowIndices.at(-1) ?? 0) + 1;
  }

  // Ratakan header
  let columns: FlatColumn[] = [];
  if (headerRowIndices.length) {
    const headerData = headerRowIndices.map((i) => rawRows[i].values);
    columns = flattenHeaders(headerData);
  }

  // Pass 2: baca baris data
  const rows: FlatRow[] = [];
  for (let i = dataStartIndex; i < rawRows.length; i++) {
    const { rowIndex, values } = rawRows[i];
    if (rows.length >= 5000) {
      warnings.push(`Lebih dari 5.000 baris data – sisa baris dilewati.`);
      break;
    }
    const skipReason = isSkipRow(values);
    if (skipReason) {
      skipped.push({ rowIndex, reason: skipReason });
      continue;
    }
    // Baris dengan nilai baris khusus 16.500 di kolom tertentu (bisa dikonfigurasi untuk dilewati)
    const record: Record<string, string> = Object.create(null) as Record<string, string>;
    columns.forEach((col, cidx) => {
      const raw = values[col.colIndex] ?? values[cidx] ?? '';
      record[col.path] = cleanCellValue(raw, warnings, rowIndex, col.path);
    });
    // Jika semua kolom utama kosong, skip
    const hasData = Object.values(record).some((v) => v.trim());
    if (!hasData) {
      skipped.push({ rowIndex, reason: 'baris kosong' });
      continue;
    }
    rows.push({ rowIndex, values: record });
  }

  const headerRows = headerRowIndices.map((i) => rawRows[i]?.rowIndex).filter((n): n is number => typeof n === 'number');
  return { sheetName, usdIdrRate, headerRows, metadata, columns, rows, warnings, skipped };
}

// ─── Pemetaan kolom ke field aplikasi ─────────────────────────────────────────

type FieldMapping = Record<string, { required: boolean; aliases: string[] }>;

export function mapColumns(
  columns: FlatColumn[],
  mapping: FieldMapping,
  savedMapping: Record<string, string> = {},
): { mapped: Record<string, string>; unmapped: string[]; missing: string[] } {
  const mapped: Record<string, string> = {};  // fieldName → columnPath
  const unmapped: string[] = [];

  const normalizedCols = columns.map((c) => ({
    path: c.path,
    norm: c.path.toLowerCase().trim(),
  }));

  for (const [fieldName, def] of Object.entries(mapping)) {
    let found = false;
    const configuredPath = savedMapping[fieldName];
    if (typeof configuredPath === 'string' && normalizedCols.some((c) => c.path === configuredPath)) {
      mapped[fieldName] = configuredPath;
      found = true;
    }
    for (const alias of found ? [] : def.aliases) {
      const aN = alias.toLowerCase().trim();
      const match = normalizedCols.find((c) => c.norm === aN || c.norm.includes(aN) || aN.includes(c.norm));
      if (match) {
        mapped[fieldName] = match.path;
        found = true;
        break;
      }
    }
    if (!found) {
      // Kolom tidak ditemukan; jika required, nanti ditangani di caller
    }
  }

  for (const col of normalizedCols) {
    const alreadyMapped = Object.values(mapped).some((p) => p.toLowerCase() === col.path.toLowerCase());
    if (!alreadyMapped) unmapped.push(col.path);
  }

  const missing = Object.entries(mapping)
    .filter(([k, v]) => v.required && !mapped[k])
    .map(([k]) => k);

  return { mapped, unmapped, missing };
}

// ─── Normalisasi nilai dari baris data ───────────────────────────────────────

export function extractField(row: FlatRow, columnPath: string | undefined): string {
  if (!columnPath) return '';
  return row.values[columnPath] ?? '';
}

export function extractNumber(row: FlatRow, columnPath: string | undefined): number | null {
  const raw = extractField(row, columnPath);
  if (!raw) return null;
  return parseNumber(raw);
}

// ─── Skor kemiripan nama (Levenshtein normalized) ────────────────────────────

export function similarityScore(a: string, b: string): number {
  const s = normalizeName(a);
  const t = normalizeName(b);
  if (!s || !t) return 0;
  if (s === t) return 1;
  const m = s.length;
  const n = t.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s[i - 1] === t[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

export function normalizeName(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
