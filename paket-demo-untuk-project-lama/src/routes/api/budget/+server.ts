/**
 * API: POST /api/budget
 * Impor anggaran RKAP dari file CSV atau XLSX (Tab A "Section Budget RKAP 2026").
 * Hanya admin atau mentor yang boleh mengakses.
 *
 * Query params:
 *   ?preview=1  → dry-run (tidak menyimpan, hanya pratinjau)
 *   ?sheet=...  → nama sheet XLSX (opsional)
 *
 * Body: multipart/form-data dengan field "file"
 */
import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { parseCsvBudget, parseXlsxBudget, mapColumns, extractNumber, extractField, similarityScore, assertSafeXlsxContainer, assertSafeCsvBuffer } from '$lib/server/budget-parser.js';
import { upsertBudgetItems, addImportLog, getBudgetItems, getMappingConfigs, type BudgetItem } from '$lib/server/budget-db.js';
import { BUDGET_COLUMN_MAPPING, DEFAULT_USD_IDR_RATE } from '../../../../config/mapping-budget.js';
import { readState, addAudit } from '$lib/server/db.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  // Role viewer mewakili akun mentor; PIC tidak boleh mengimpor.
  if (!['admin', 'viewer'].includes(auth.user.role)) return json({ error: 'Hanya admin atau mentor yang dapat mengimpor anggaran.' }, { status: 403 });

  const rate = checkRateLimit(event, 'budget-import', 12, 15 * 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak percobaan impor. Coba lagi beberapa menit.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

  const isPreview = event.url.searchParams.get('preview') === '1';
  const sheetName = event.url.searchParams.get('sheet') || undefined;

  // Baca body dengan batas ukuran
  const contentLength = Number(event.request.headers.get('content-length') || 0);
  if (contentLength > MAX_IMPORT_BYTES + 65536) return json({ error: 'Ukuran permintaan terlalu besar (maks 5 MB).' }, { status: 413 });

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = event.request.body?.getReader();
  if (!reader) return json({ error: 'File tidak ditemukan.' }, { status: 400 });
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAX_IMPORT_BYTES + 65536) { await reader.cancel(); return json({ error: 'File terlalu besar.' }, { status: 413 }); }
      chunks.push(part.value);
    }
  } catch { return json({ error: 'File tidak dapat dibaca.' }, { status: 400 }); }

  const bodyBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const parsedReq = new Request(event.request.url, { method: 'POST', headers: event.request.headers, body: bodyBuffer });
  const form = await parsedReq.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return json({ error: 'Pilih file CSV atau XLSX.' }, { status: 400 });
  if (file.size > MAX_IMPORT_BYTES) return json({ error: 'File maksimal 5 MB.' }, { status: 413 });

  // Periksa ekstensi
  const fname = file.name.toLowerCase();
  if (fname.endsWith('.xlsm') || fname.endsWith('.xlsb')) return json({ error: 'Format xlsm/xlsb tidak diizinkan. Simpan sebagai .xlsx.' }, { status: 400 });
  if (!fname.endsWith('.csv') && !fname.endsWith('.xlsx')) return json({ error: 'Format harus CSV atau XLSX.' }, { status: 400 });

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
  if (fileBuffer.length > MAX_IMPORT_BYTES) return json({ error: 'File terlalu besar.' }, { status: 413 });

  // Validasi signature dan parse hanya CSV/XLSX; file tetap diproses di memori.
  let parsed;
  try {
    if (fname.endsWith('.csv')) {
      assertSafeCsvBuffer(fileBuffer);
      parsed = parseCsvBudget(fileBuffer.toString('utf8'));
    } else {
      assertSafeXlsxContainer(fileBuffer);
      parsed = await parseXlsxBudget(fileBuffer, sheetName);
    }
  } catch (err) {
    return json({ error: `File tidak dapat dibaca: ${err instanceof Error ? err.message : 'format tidak valid'}` }, { status: 400 });
  }

  if (parsed.rows.length > 5000) return json({ error: 'Maksimal 5.000 baris data.' }, { status: 413 });

  // Pemetaan kolom
  const savedMapping = (await getMappingConfigs()).find((c) => c.importType === 'budget')?.mapping ?? {};
  const { mapped, unmapped, missing } = mapColumns(parsed.columns, BUDGET_COLUMN_MAPPING as any, savedMapping);

  if (missing.length) {
    return json({
      error: `Kolom wajib tidak ditemukan: ${missing.join(', ')}. Periksa pemetaan kolom di halaman Atur Pemetaan.`,
      details: { missing, columns: parsed.columns.map((c) => c.path) }
    }, { status: 422 });
  }

  const planValueMapped = Boolean(mapped.commitmentUsd || mapped.carriedOverUsd || MONTHS.some((m) => {
    const fieldKey = `rkap${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof BUDGET_COLUMN_MAPPING;
    return Boolean(mapped[fieldKey]);
  }));
  if (!planValueMapped) {
    return json({ error: 'Kolom nilai anggaran tidak ditemukan. Pilih kolom RKAP bulanan, Commitment > USD Amount, atau Carried Over > USD Amount pada Atur Pemetaan.' }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
  }

  // Ambil state untuk pencocokan pekerjaan
  const state = await readState();
  const jobs = state.jobs;

  // Konversi baris ke BudgetItem
  const items: BudgetItem[] = [];
  const rowErrors: { row: number; error: string }[] = [];
  const existingBudgets = await getBudgetItems();
  const seenCommitmentItems = new Set<string>();

  for (const row of parsed.rows) {
    try {
      const ci = extractField(row, mapped.commitmentItem).trim();
      if (!ci) {
        rowErrors.push({ row: row.rowIndex, error: 'Commitment Item kosong — baris dilewati.' });
        continue;
      }
      const duplicateKey = ci.trim().toUpperCase();
      if (seenCommitmentItems.has(duplicateKey)) {
        rowErrors.push({ row: row.rowIndex, error: `Commitment Item ${ci} duplikat pada file yang sama — baris berikutnya dilewati.` });
        continue;
      }
      seenCommitmentItems.add(duplicateKey);
      const deskripsi = extractField(row, mapped.deskripsi).trim();
      const rkapCurrency = (extractField(row, mapped.rkapCurr) || extractField(row, mapped.commitmentCurr) || 'IDR').trim().toUpperCase();
      const toUsd = (value: number | null) => value === null ? null : (rkapCurrency === 'USD' ? value : value / parsed.usdIdrRate);
      const rkapMonthly: Record<string, number | null> = {};
      for (const m of MONTHS) {
        const fieldKey = `rkap${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof BUDGET_COLUMN_MAPPING;
        rkapMonthly[m] = toUsd(extractNumber(row, mapped[fieldKey] as string));
      }
      const monthlyValues = Object.values(rkapMonthly).filter((v): v is number => v !== null);
      const monthlySum = monthlyValues.reduce((sum, value) => sum + value, 0);
      const commitmentUsd = extractNumber(row, mapped.commitmentUsd);
      const carriedOverUsd = extractNumber(row, mapped.carriedOverUsd);
      const planRkapUsd = monthlyValues.length ? monthlySum : (commitmentUsd ?? carriedOverUsd ?? null);

      // Pencocokan ke pekerjaan
      let linkedJobId: string | null = null;
      let matchScore: number | null = null;
      let matchStatus: BudgetItem['matchStatus'] = 'unmatched';

      // Cek apakah sudah ada yang terkonfirmasi sebelumnya
      const existing = existingBudgets.find((b) => b.commitmentItem.trim().toUpperCase() === ci.trim().toUpperCase());
      const exactJob = jobs.find((job) => job.commitmentItem?.trim().toUpperCase() === ci.trim().toUpperCase());
      if (existing?.matchStatus === 'confirmed' && existing.linkedJobId) {
        linkedJobId = existing.linkedJobId;
        matchScore = existing.matchScore;
        matchStatus = 'confirmed';
      } else if (exactJob) {
        // Commitment Item yang sama persis menjadi kunci utama yang tepercaya.
        linkedJobId = exactJob.id;
        matchScore = 1;
        matchStatus = 'confirmed';
      } else {
        // Jika tidak ada kunci, coba cocokkan berdasarkan nama/deskripsi.
        if (deskripsi) {
          let bestScore = 0;
          let bestJob: typeof jobs[0] | null = null;
          for (const job of jobs) {
            const score = similarityScore(deskripsi, job.title);
            if (score > bestScore) { bestScore = score; bestJob = job; }
          }
          if (bestJob && bestScore >= 0.85) {
            linkedJobId = bestJob.id;
            matchScore = bestScore;
            matchStatus = 'pending';
          }
        }
      }

      const item: BudgetItem = {
        id: existing?.id || crypto.randomUUID(),
        commitmentItem: ci,
        glAccount: extractField(row, mapped.glAccount),
        tahun: extractField(row, mapped.tahun),
        prYN: extractField(row, mapped.prYN),
        fundCenter: extractField(row, mapped.fundCenter) || parsed.metadata.fundCenter || '',
        deskripsi,
        currency: rkapCurrency,
        carriedOverQty: extractNumber(row, mapped.carriedOverQty),
        carriedOverAmount: extractNumber(row, mapped.carriedOverAmount),
        carriedOverUsd,
        commitmentQty: extractNumber(row, mapped.commitmentQty),
        commitmentAmount: extractNumber(row, mapped.commitmentAmount),
        commitmentUsd,
        rkapMonthly,
        rkapQty: extractNumber(row, mapped.rkapQty),
        rkapCurr: rkapCurrency,
        planRkapUsd,
        hpsUsd: extractNumber(row, mapped.hpsUsd),
        extra: Object.fromEntries(
          (unmapped || []).map((p) => [p, extractField(row, p)])
        ),
        importedAt: new Date().toISOString(),
        importedBy: auth.user.username,
        importFileHash: fileHash,
        importMetadata: parsed.metadata,
        linkedJobId,
        matchScore,
        matchStatus,
      };
      items.push(item);
    } catch (err) {
      rowErrors.push({ row: row.rowIndex, error: err instanceof Error ? err.message : 'Error tidak diketahui' });
    }
  }

  // Hitungan preview adalah dry-run; Commitment Item tetap menjadi kunci idempoten.
  const existingKeys = new Set(existingBudgets.map((item) => item.commitmentItem));
  const newCount = items.filter((item) => !existingKeys.has(item.commitmentItem)).length;
  const updatedCount = items.length - newCount;

  // Preview — kembalikan tanpa menyimpan
  if (isPreview) {
    return json({
      preview: true,
      sheetName: parsed.sheetName,
      headerRows: parsed.headerRows,
      usdIdrRate: parsed.usdIdrRate,
      metadata: parsed.metadata,
      columns: parsed.columns.map((c) => c.path),
      mappedColumns: mapped,
      unmappedColumns: unmapped,
      missingColumns: missing,
      matchSummary: {
        confirmed: items.filter((item) => item.matchStatus === 'confirmed').length,
        pending: items.filter((item) => item.matchStatus === 'pending').length,
        unmatched: items.filter((item) => item.matchStatus === 'unmatched').length,
      },
      rowCount: items.length,
      newCount,
      updatedCount,
      skippedCount: parsed.skipped.length + rowErrors.length,
      skippedRows: parsed.skipped.slice(0, 50),
      errorCount: rowErrors.length,
      warnings: [...parsed.warnings, ...rowErrors.map((e) => `Baris ${e.row}: ${e.error}`)].slice(0, 50),
      sampleRows: items.slice(0, 20).map((item) => ({
        commitmentItem: item.commitmentItem,
        deskripsi: item.deskripsi,
        planRkapUsd: item.planRkapUsd,
        fundCenter: item.fundCenter,
        matchStatus: item.matchStatus,
        matchScore: item.matchScore,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Simpan
  const { inserted, updated } = await upsertBudgetItems(items);
  await addImportLog({
    at: new Date().toISOString(),
    username: auth.user.username,
    displayName: auth.user.displayName,
    importType: 'budget',
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    inserted,
    updated,
    skipped: parsed.skipped.length + rowErrors.length,
    errors: rowErrors.map((e) => `Baris ${e.row}: ${e.error}`).slice(0, 20),
    usdIdrRate: parsed.usdIdrRate,
    metadata: parsed.metadata,
  });
  await addAudit({
    username: auth.user.username,
    displayName: auth.user.displayName,
    jobId: '-',
    jobTitle: `Impor anggaran: ${file.name.slice(0, 180)}`,
    fields: [
      { field: 'fileHashSHA256', oldValue: null, newValue: fileHash },
      { field: 'hasilImpor', oldValue: null, newValue: { inserted, updated, skipped: parsed.skipped.length + rowErrors.length, errors: rowErrors.length } },
      { field: 'kursUSDIDR', oldValue: null, newValue: parsed.usdIdrRate },
    ],
    action: 'Impor Anggaran RKAP',
  });

  return json({
    ok: true,
    inserted,
    updated,
    skipped: parsed.skipped.length + rowErrors.length,
    errors: rowErrors.slice(0, 20),
    warnings: parsed.warnings.slice(0, 20),
    message: `Impor selesai: ${inserted} baru, ${updated} diperbarui, ${parsed.skipped.length + rowErrors.length} baris dilewati.`,
  }, { headers: { 'Cache-Control': 'no-store' } });
};

/** GET /api/budget — ambil semua data anggaran */
export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const items = await getBudgetItems();
  return json({ items }, { headers: { 'Cache-Control': 'no-store' } });
};
