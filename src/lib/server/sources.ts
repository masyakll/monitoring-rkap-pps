import { FIELD_OWNERS } from './config.js';
import { readState, updateSyncTimestamp } from './db.js';
import type { Job } from './domain.js';
import { clearGoogleSheetCache, getAbsorptionRange, getAbsorptionSpreadsheetId, getMonitoringRange, getMonitoringSpreadsheetId, readSheetValues } from './google-sheets.js';
import { loadMonitoringJobs } from './monitoring-sheet.js';

export type SourceName = 'dummy' | 'sap' | 'ipro' | 'google-sheets';
const configuredSource = (process.env.DATA_SOURCE || 'dummy').trim().toLowerCase() as SourceName;

export async function loadJobs(): Promise<Job[]> {
  if (configuredSource === 'dummy') return (await readState()).jobs;
  if (configuredSource === 'google-sheets') return loadMonitoringJobs();
  if (configuredSource === 'ipro') {
    throw new Error('Konektor IPRO belum dikonfigurasi. Gunakan Google Sheets yang sudah disetujui atau impor ekspor IPRO melalui proses resmi.');
  }
  if (configuredSource === 'sap') {
    throw new Error('Konektor SAP belum dikonfigurasi. Gunakan Google Sheets/ekspor yang sudah disetujui setelah akses tersedia.');
  }
  throw new Error('DATA_SOURCE tidak dikenal. Gunakan dummy atau google-sheets.');
}

export async function syncNow() {
  if (configuredSource === 'dummy') {
    const at = await updateSyncTimestamp();
    return { at, message: 'Sinkronisasi simulasi selesai. Data masih menggunakan sumber dummy.' };
  }
  if (configuredSource === 'google-sheets') {
    clearGoogleSheetCache();
    // Wajib membaca monitoring supaya kesalahan kredensial/range diketahui sebelum disebut berhasil.
    await loadMonitoringJobs(true);
    const at = await updateSyncTimestamp();
    return { at, message: 'Data progres berhasil dibaca dari Google Sheets.' };
  }
  if (configuredSource === 'ipro') throw new Error('Sinkronisasi IPRO belum aktif karena konektor belum dikonfigurasi.');
  if (configuredSource === 'sap') throw new Error('Sinkronisasi SAP belum aktif karena konektor belum dikonfigurasi.');
  throw new Error('DATA_SOURCE tidak dikenal.');
}

export async function loadAbsorptionRows(force = false) {
  if (configuredSource !== 'google-sheets') {
    return { connected: false as const, message: 'Sumber penyerapan belum dihubungkan. Pilih sumber Google Sheets setelah akses dan format data disetujui.', headers: [] as string[], rows: [] as string[][], fetchedAt: null as string | null };
  }
  const values = await readSheetValues(getAbsorptionSpreadsheetId(), getAbsorptionRange(), { force });
  if (!values.length) {
    return { connected: false as const, message: 'Sheet penyerapan belum berisi header dan data. Periksa ABSORPTION_SHEET_RANGE.', headers: [] as string[], rows: [] as string[][], fetchedAt: null as string | null };
  }
  const headers = values[0].map((cell, index) => String(cell ?? '').trim() || `Kolom ${index + 1}`);
  const rows = values.slice(1)
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
    .map((row) => headers.map((_, index) => row[index] === null || row[index] === undefined ? '' : String(row[index])));
  return { connected: true as const, message: 'Sumber penyerapan terbaca.', headers, rows, fetchedAt: new Date().toISOString() };
}

export function getReadOnlyFields(): string[] {
  if (configuredSource === 'dummy') return [];
  if (configuredSource === 'google-sheets') {
    return [
      ...Object.keys(FIELD_OWNERS), 'vendor', 'contractAmountIDR', 'startDate', 'finishDate',
      'actualFinish', 'guaranteeUntil', 'paidPercent', 'rkapBudgetUSD', 'hpsUSD', 'scsDate', 'specialStatus'
    ];
  }
  const activeSources = configuredSource === 'ipro' ? ['ipro'] : configuredSource === 'sap' ? ['sap'] : [];
  return Object.entries(FIELD_OWNERS).filter(([, owner]) => activeSources.includes(owner)).map(([field]) => field);
}

export function getSourceMode(): SourceName { return configuredSource; }

export function getSourceConfigStatus() {
  if (configuredSource !== 'google-sheets') return { configured: configuredSource === 'dummy', mode: configuredSource };
  const ready = Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() && (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim() || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim()));
  return { configured: ready, mode: configuredSource };
}

export async function validateAbsorptionConnection(force = false) {
  if (configuredSource !== 'google-sheets') return false;
  try {
    await readSheetValues(getAbsorptionSpreadsheetId(), getAbsorptionRange(), { force });
    return true;
  } catch {
    // The monitoring source may be ready before mentor creates/configures the absorption tab.
    return false;
  }
}

export async function forceReadMonitoringRange() {
  return readSheetValues(getMonitoringSpreadsheetId(), getMonitoringRange(), { force: true });
}
