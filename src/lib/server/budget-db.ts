/**
 * budget-db.ts
 * ============================================================
 * Lapisan data untuk modul anggaran RKAP dan analisa penyerapan.
 * Menyimpan BudgetItem, GRRecord, PrognosaVersion, AnalysisNote,
 * ImportLog, MappingConfig dalam state JSON yang sama dengan db.ts.
 *
 * Konvensi penyimpanan:
 * - readBudgetState() membaca sub-state dari state.json
 * - updateBudgetState() menggunakan queue yang sama dengan updateState()
 * ============================================================
 */

import { randomUUID } from 'node:crypto';
import { readState, updateState } from './db.js';

// ─── Tipe Data ─────────────────────────────────────────────────────────────

/** Satu baris anggaran dari Tab A "Section Budget RKAP 2026" */
export type BudgetItem = {
  id: string;
  /** Kunci utama – nomor commitment item (misal 1222110006AAT) */
  commitmentItem: string;
  glAccount: string;
  tahun: string;
  prYN: string;
  fundCenter: string;
  /** Nama/deskripsi pekerjaan */
  deskripsi: string;
  /** Mata uang asli */
  currency: string;
  // --- Carried Over ---
  carriedOverQty: number | null;
  carriedOverAmount: number | null;
  carriedOverUsd: number | null;
  // --- Commitment ---
  commitmentQty: number | null;
  commitmentAmount: number | null;
  commitmentUsd: number | null;
  // --- RKAP 2026 bulanan (USD) ---
  rkapMonthly: Record<string, number | null>; // { jan, feb, ..., des }
  rkapQty: number | null;
  rkapCurr: string;
  /** Total anggaran RKAP USD (sum bulanan atau commitment USD) */
  planRkapUsd: number | null;
  /** Nilai HPS USD jika kolom tersebut ada dalam file hasil ekspor. */
  hpsUsd?: number | null;
  /** Kolom tak dikenal disimpan di sini agar tidak hilang */
  extra: Record<string, string>;
  // --- Metadata impor ---
  importedAt: string;
  importedBy: string;
  importFileHash: string;
  importMetadata: Record<string, string>; // Divisi, Fund Center dari header
  /** ID pekerjaan yang sudah dikonfirmasi cocok (null = belum dihubungkan) */
  linkedJobId: string | null;
  /** Skor kemiripan terakhir (0–1) */
  matchScore: number | null;
  /** Status pencocokan */
  matchStatus: 'confirmed' | 'pending' | 'unmatched';
};

/** Satu baris dari Tab "GR Capex Opex" */
export type GRRecord = {
  id: string;
  /** Kunci utama dari GR sheet */
  commitmentItem: string;
  namaPekerjaan: string;
  tipe: 'CAPEX' | 'OPEX' | '';
  currency: string;
  /** Nilai aktual total (kolom ke-20 / yang bisa dikonfigurasi) */
  aktualTotal: number | null;
  /** Nilai aktual dalam USD (setelah konversi kurs) */
  aktualTotalUsd: number | null;
  /** Realisasi bulanan */
  monthly: Record<string, number | null>; // { jan, feb, ..., des }
  /** Kolom tak dikenal */
  extra: Record<string, string>;
  // --- Metadata impor ---
  importedAt: string;
  importedBy: string;
  importFileHash: string;
  /** ID pekerjaan yang sudah dikonfirmasi cocok */
  linkedJobId: string | null;
  matchScore: number | null;
  matchStatus: 'confirmed' | 'pending' | 'unmatched';
};

/** Satu versi prognosa (foto terkunci) */
export type PrognosaVersion = {
  id: string;
  /** v1, v2, dst. */
  version: number;
  /** ID pekerjaan */
  jobId: string;
  /** Keterangan penyampaian */
  keterangan: string;
  /** Angka prognosa per bulan (aktual + perkiraan) */
  monthly: Record<string, number | null>;
  /** Total prognosa USD */
  totalUsd: number | null;
  /** Persentase terhadap Plan RKAP */
  pct: number | null;
  tipe: 'CAPEX' | 'OPEX' | '';
  /** Waktu dikunci */
  lockedAt: string;
  lockedBy: string;
  /** null = terkunci; jika admin buka kunci → simpan alasan di sini */
  unlockedAt: string | null;
  unlockedBy: string | null;
  unlockedReason: string | null;
};

/** Data analisa penyerapan per pekerjaan (isian PIC) */
export type AnalysisEntry = {
  id: string;
  jobId: string;
  /** Hanya admin yang bisa mengubah prognosaUsd */
  prognosaUsd: number | null;
  updateProgres: string;
  penyebabKategori: string; // Dipilih dari daftar tetap
  penyebabDetail: string;
  quickWin: string;
  grupKategori: string;
  updatedAt: string;
  updatedBy: string;
};

/** Log impor untuk audit */
export type ImportLog = {
  id: string;
  at: string;
  username: string;
  displayName: string;
  importType: 'budget' | 'gr' | 'analisa';
  fileName: string;
  fileHash: string;
  fileSize: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  usdIdrRate: number;
  metadata: Record<string, string>;
};

/** Konfigurasi pemetaan kolom yang disimpan per jenis impor */
export type MappingConfig = {
  importType: 'budget' | 'gr' | 'analisa';
  /** fieldName → columnPath */
  mapping: Record<string, string>;
  /** Kolom nilai aktual yang dipilih untuk GR */
  aktualColumnPath?: string;
  savedAt: string;
  savedBy: string;
};


// ─── Helper baca sub-state ─────────────────────────────────────────────────

export async function getBudgetItems(): Promise<BudgetItem[]> {
  const state = await readState();
  return state.budgetItems ?? [];
}

export async function getGRRecords(): Promise<GRRecord[]> {
  const state = await readState();
  return state.grRecords ?? [];
}

export async function getPrognosaVersions(jobId?: string): Promise<PrognosaVersion[]> {
  const state = await readState();
  const all = state.prognosaVersions ?? [];
  return jobId ? all.filter((v) => v.jobId === jobId) : all;
}

export async function getAnalysisEntries(): Promise<AnalysisEntry[]> {
  const state = await readState();
  return state.analysisEntries ?? [];
}

export async function getImportLogs(): Promise<ImportLog[]> {
  const state = await readState();
  return state.importLogs ?? [];
}

export async function getMappingConfigs(): Promise<MappingConfig[]> {
  const state = await readState();
  return state.mappingConfigs ?? [];
}

// ─── Upsert BudgetItem ─────────────────────────────────────────────────────

export async function upsertBudgetItems(items: BudgetItem[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  await updateState((state) => {
    if (!state.budgetItems) state.budgetItems = [];
    for (const item of items) {
      const idx = state.budgetItems!.findIndex((b) => b.commitmentItem === item.commitmentItem);
      if (idx >= 0) {
        state.budgetItems![idx] = { ...state.budgetItems![idx], ...item };
        updated++;
      } else {
        state.budgetItems!.push(item);
        inserted++;
      }
    }
  });
  return { inserted, updated };
}

// ─── Upsert GRRecord ──────────────────────────────────────────────────────

export async function upsertGRRecords(records: GRRecord[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  await updateState((state) => {
    if (!state.grRecords) state.grRecords = [];
    for (const rec of records) {
      const idx = state.grRecords!.findIndex(
        (g) => g.commitmentItem && rec.commitmentItem
          ? g.commitmentItem === rec.commitmentItem
          : g.namaPekerjaan === rec.namaPekerjaan
      );
      if (idx >= 0) {
        state.grRecords![idx] = { ...state.grRecords![idx], ...rec };
        updated++;
      } else {
        state.grRecords!.push(rec);
        inserted++;
      }
    }
  });
  return { inserted, updated };
}

// ─── Prognosa ──────────────────────────────────────────────────────────────

export async function savePrognosaVersion(v: Omit<PrognosaVersion, 'id' | 'version'>): Promise<PrognosaVersion> {
  let saved!: PrognosaVersion;
  await updateState((state) => {
    if (!state.prognosaVersions) state.prognosaVersions = [];
    const existing = state.prognosaVersions!.filter((p) => p.jobId === v.jobId);
    const version = existing.length + 1;
    saved = { ...v, id: randomUUID(), version };
    state.prognosaVersions!.push(saved);
    if (!state.activePrognosaVersion) state.activePrognosaVersion = {};
    state.activePrognosaVersion![v.jobId] = version;
  });
  return saved;
}

export async function unlockPrognosa(
  jobId: string, versionNum: number, by: string, reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!reason.trim()) return { ok: false, error: 'Alasan buka kunci wajib diisi.' };
  let ok = false;
  let failure = 'Versi prognosa tidak ditemukan.';
  await updateState((state) => {
    const versions = (state.prognosaVersions ?? []).filter((p) => p.jobId === jobId);
    const latest = versions.reduce<PrognosaVersion | null>((best, item) => !best || item.version > best.version ? item : best, null);
    const v = versions.find((p) => p.version === versionNum);
    if (!v) return;
    if (!latest || latest.version !== versionNum) { failure = 'Hanya versi terbaru yang boleh dibuka kuncinya.'; return; }
    if (v.unlockedAt) { failure = 'Versi ini sudah dibuka untuk revisi.'; return; }
    v.unlockedAt = new Date().toISOString();
    v.unlockedBy = by;
    v.unlockedReason = reason;
    ok = true;
  });
  return ok ? { ok: true } : { ok: false, error: failure };
}

// ─── AnalysisEntry ─────────────────────────────────────────────────────────

export async function upsertAnalysisEntry(entry: Omit<AnalysisEntry, 'id'> & { id?: string }): Promise<AnalysisEntry> {
  let saved!: AnalysisEntry;
  await updateState((state) => {
    if (!state.analysisEntries) state.analysisEntries = [];
    const idx = state.analysisEntries!.findIndex((e) => e.jobId === entry.jobId);
    if (idx >= 0) {
      saved = { ...state.analysisEntries![idx], ...entry, id: state.analysisEntries![idx].id };
      state.analysisEntries![idx] = saved;
    } else {
      saved = { ...entry, id: randomUUID() } as AnalysisEntry;
      state.analysisEntries!.push(saved);
    }
  });
  return saved;
}

// ─── Rekonsiliasi ──────────────────────────────────────────────────────────

export type ReconciliationReport = {
  matched: { jobId: string; jobTitle: string; budgetItem?: BudgetItem; grRecord?: GRRecord }[];
  jobsWithoutBudget: { jobId: string; jobTitle: string }[];
  budgetWithoutJob: BudgetItem[];
  grWithoutJob: GRRecord[];
  pendingConfirmation: { type: 'budget' | 'gr'; sourceId: string; suggestedJobId: string | null; suggestedTitle: string; score: number; sourceName: string }[];
};

export async function buildReconciliation(jobs: { id: string; title: string }[]): Promise<ReconciliationReport> {
  const budgets = await getBudgetItems();
  const grs = await getGRRecords();

  const matched: ReconciliationReport['matched'] = [];
  const jobsWithoutBudget: ReconciliationReport['jobsWithoutBudget'] = [];
  const budgetWithoutJob: BudgetItem[] = [];
  const grWithoutJob: GRRecord[] = [];
  const pendingConfirmation: ReconciliationReport['pendingConfirmation'] = [];

  for (const job of jobs) {
    const budget = budgets.find((b) => b.linkedJobId === job.id && b.matchStatus === 'confirmed');
    const gr = grs.find((g) => g.linkedJobId === job.id && g.matchStatus === 'confirmed');
    if (budget || gr) matched.push({ jobId: job.id, jobTitle: job.title, budgetItem: budget, grRecord: gr });
    // Definisi ini khusus anggaran; pekerjaan tanpa Plan tetap terlihat meskipun data GR sudah cocok.
    if (!budget) jobsWithoutBudget.push({ jobId: job.id, jobTitle: job.title });
  }

  for (const b of budgets) {
    if (b.matchStatus === 'pending') {
      const job = jobs.find((j) => j.id === b.linkedJobId);
      pendingConfirmation.push({ type: 'budget', sourceId: b.id, suggestedJobId: job?.id ?? null, suggestedTitle: job?.title ?? 'Belum ada kandidat otomatis', score: b.matchScore ?? 0, sourceName: b.deskripsi || b.commitmentItem });
    } else if (b.matchStatus === 'unmatched') {
      budgetWithoutJob.push(b);
    }
  }

  for (const g of grs) {
    if (g.matchStatus === 'pending') {
      const job = jobs.find((j) => j.id === g.linkedJobId);
      pendingConfirmation.push({ type: 'gr', sourceId: g.id, suggestedJobId: job?.id ?? null, suggestedTitle: job?.title ?? 'Belum ada kandidat otomatis', score: g.matchScore ?? 0, sourceName: g.namaPekerjaan || g.commitmentItem });
    } else if (g.matchStatus === 'unmatched') {
      grWithoutJob.push(g);
    }
  }

  return { matched, jobsWithoutBudget, budgetWithoutJob, grWithoutJob, pendingConfirmation };
}

// ─── ImportLog ─────────────────────────────────────────────────────────────

export async function addImportLog(log: Omit<ImportLog, 'id'>): Promise<void> {
  await updateState((state) => {
    if (!state.importLogs) state.importLogs = [];
    state.importLogs!.unshift({ ...log, id: randomUUID() });
    if (state.importLogs!.length > 500) state.importLogs!.length = 500;
  });
}

// ─── MappingConfig ─────────────────────────────────────────────────────────

export async function saveMappingConfig(config: Omit<MappingConfig, 'savedAt'> & { savedAt?: string }): Promise<void> {
  await updateState((state) => {
    if (!state.mappingConfigs) state.mappingConfigs = [];
    const idx = state.mappingConfigs!.findIndex((c) => c.importType === config.importType);
    const saved = { ...config, savedAt: config.savedAt ?? new Date().toISOString() };
    if (idx >= 0) state.mappingConfigs![idx] = saved;
    else state.mappingConfigs!.push(saved);
  });
}
