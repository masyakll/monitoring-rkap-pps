/**
 * API: POST /api/gr
 * Impor data GR Capex Opex dari CSV atau XLSX.
 * Hanya admin atau mentor yang boleh mengakses.
 *
 * Query params:
 *   ?preview=1  → dry-run
 */
import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { parseCsvBudget, parseXlsxBudget, mapColumns, extractNumber, extractField, similarityScore, normalizeName, assertSafeXlsxContainer, assertSafeCsvBuffer } from '$lib/server/budget-parser.js';
import { upsertGRRecords, addImportLog, getGRRecords, getMappingConfigs, type GRRecord } from '$lib/server/budget-db.js';
import { GR_COLUMN_MAPPING, DEFAULT_AKTUAL_COLUMN_INDEX } from '../../../../config/mapping-gr.js';
import { readState, addAudit } from '$lib/server/db.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  if (!['admin', 'viewer'].includes(auth.user.role)) return json({ error: 'Hanya admin atau mentor yang dapat mengimpor data GR.' }, { status: 403 });

  const rate = checkRateLimit(event, 'gr-import', 12, 15 * 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak percobaan impor GR. Coba lagi beberapa menit.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

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

  const fname = file.name.toLowerCase();
  if (fname.endsWith('.xlsm') || fname.endsWith('.xlsb')) return json({ error: 'Format xlsm/xlsb tidak diizinkan.' }, { status: 400 });
  if (!fname.endsWith('.csv') && !fname.endsWith('.xlsx')) return json({ error: 'Format harus CSV atau XLSX.' }, { status: 400 });

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

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

  if (parsed.rows.length > 5000) return json({ error: 'Maksimal 5.000 baris data per file.' }, { status: 413 });

  const savedConfig = (await getMappingConfigs()).find((c) => c.importType === 'gr');
  const savedMapping = { ...(savedConfig?.mapping ?? {}) };
  if (savedConfig?.aktualColumnPath) savedMapping.aktualTotal = savedConfig.aktualColumnPath;
  const { mapped, unmapped } = mapColumns(parsed.columns, GR_COLUMN_MAPPING as any, savedMapping);

  // Fallback: jika kolom aktual tidak ditemukan via nama, pakai kolom ke-20 (index 19)
  if (!mapped.aktualTotal && parsed.columns.length > DEFAULT_AKTUAL_COLUMN_INDEX) {
    mapped.aktualTotal = parsed.columns[DEFAULT_AKTUAL_COLUMN_INDEX].path;
    parsed.warnings.push(`Kolom aktual tidak ditemukan via nama; menggunakan kolom ke-${DEFAULT_AKTUAL_COLUMN_INDEX + 1}: "${mapped.aktualTotal}"`);
  }

  if (!mapped.aktualTotal) {
    return json({ error: 'Kolom nilai Aktual GR belum ditemukan. Pilih kolom nilai Aktual pada Atur Pemetaan atau pastikan file memiliki kolom T.' }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
  }

  const state = await readState();
  const jobs = state.jobs;
  const existingGRs = await getGRRecords();
  const seenGRKeys = new Set<string>();

  const records: GRRecord[] = [];
  const rowErrors: { row: number; error: string }[] = [];

  for (const row of parsed.rows) {
    try {
      const ci = extractField(row, mapped.commitmentItem).trim();
      const nama = extractField(row, mapped.namaPekerjaan).trim();
      if (!ci && !nama) {
        rowErrors.push({ row: row.rowIndex, error: 'Commitment Item dan Nama Pekerjaan kosong — baris dilewati.' });
        continue;
      }
      const duplicateKey = ci ? `ci:${ci.trim().toUpperCase()}` : `name:${normalizeName(nama)}`;
      if (seenGRKeys.has(duplicateKey)) {
        rowErrors.push({ row: row.rowIndex, error: `Baris duplikat (${ci || nama}) dalam file yang sama — baris berikutnya dilewati.` });
        continue;
      }
      seenGRKeys.add(duplicateKey);
      const aktualTotal = extractNumber(row, mapped.aktualTotal);
      const currency = (extractField(row, mapped.grCurr) || 'IDR').trim().toUpperCase();
      const monthly: Record<string, number | null> = {};
      for (const m of MONTHS) {
        const fieldKey = `gr${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof GR_COLUMN_MAPPING;
        const rawMonthly = extractNumber(row, mapped[fieldKey] as string);
        monthly[m] = rawMonthly === null ? null : (currency === 'USD' ? rawMonthly : rawMonthly / parsed.usdIdrRate);
      }
      const usdRate = parsed.usdIdrRate;
      const aktualTotalUsd = aktualTotal !== null
        ? (currency.toUpperCase() === 'USD' ? aktualTotal : aktualTotal / usdRate)
        : null;

      // Pencocokan ke pekerjaan
      let linkedJobId: string | null = null;
      let matchScore: number | null = null;
      let matchStatus: GRRecord['matchStatus'] = 'unmatched';

      const existing = existingGRs.find((g) => (ci && g.commitmentItem.trim().toUpperCase() === ci.trim().toUpperCase()) || (nama && g.namaPekerjaan === nama));
      const exactJob = ci ? jobs.find((job) => job.commitmentItem?.trim().toUpperCase() === ci.trim().toUpperCase()) : undefined;
      if (existing?.matchStatus === 'confirmed' && existing.linkedJobId) {
        linkedJobId = existing.linkedJobId;
        matchScore = existing.matchScore;
        matchStatus = 'confirmed';
      } else if (exactJob) {
        linkedJobId = exactJob.id;
        matchScore = 1;
        matchStatus = 'confirmed';
      } else if (nama) {
        let bestScore = 0;
        let bestJob: typeof jobs[0] | null = null;
        for (const job of jobs) {
          const score = similarityScore(nama, job.title);
          if (score > bestScore) { bestScore = score; bestJob = job; }
        }
        if (bestJob && bestScore >= 0.7) {
          linkedJobId = bestJob.id;
          matchScore = bestScore;
          matchStatus = 'pending';
        }
      }

      const tipeRaw = extractField(row, mapped.tipe).trim().toUpperCase();
      const tipe: GRRecord['tipe'] = tipeRaw === 'CAPEX' ? 'CAPEX' : tipeRaw === 'OPEX' ? 'OPEX' : '';

      records.push({
        id: existing?.id || crypto.randomUUID(),
        commitmentItem: ci,
        namaPekerjaan: nama,
        tipe,
        currency,
        aktualTotal,
        aktualTotalUsd,
        monthly,
        extra: Object.fromEntries((unmapped || []).map((p) => [p, extractField(row, p)])),
        importedAt: new Date().toISOString(),
        importedBy: auth.user.username,
        importFileHash: fileHash,
        linkedJobId,
        matchScore,
        matchStatus,
      });
    } catch (err) {
      rowErrors.push({ row: row.rowIndex, error: err instanceof Error ? err.message : 'Error tidak diketahui' });
    }
  }

  const existingKeys = new Set(existingGRs.map((item) => item.commitmentItem).filter(Boolean));
  const newCount = records.filter((item) => item.commitmentItem ? !existingKeys.has(item.commitmentItem) : !existingGRs.some((g) => g.namaPekerjaan === item.namaPekerjaan)).length;
  const updatedCount = records.length - newCount;

  if (isPreview) {
    return json({
      preview: true,
      sheetName: parsed.sheetName,
      headerRows: parsed.headerRows,
      usdIdrRate: parsed.usdIdrRate,
      metadata: parsed.metadata,
      columns: parsed.columns.map((c) => c.path),
      mappedColumns: mapped,
      aktualColumnPath: mapped.aktualTotal,
      matchSummary: {
        confirmed: records.filter((item) => item.matchStatus === 'confirmed').length,
        pending: records.filter((item) => item.matchStatus === 'pending').length,
        unmatched: records.filter((item) => item.matchStatus === 'unmatched').length,
      },
      rowCount: records.length,
      newCount,
      updatedCount,
      skippedCount: parsed.skipped.length + rowErrors.length,
      skippedRows: parsed.skipped.slice(0, 50),
      errorCount: rowErrors.length,
      warnings: [...parsed.warnings, ...rowErrors.map((e) => `Baris ${e.row}: ${e.error}`)].slice(0, 50),
      sampleRows: records.slice(0, 20).map((r) => ({
        commitmentItem: r.commitmentItem,
        namaPekerjaan: r.namaPekerjaan,
        tipe: r.tipe,
        aktualTotal: r.aktualTotal,
        aktualTotalUsd: r.aktualTotalUsd,
        matchStatus: r.matchStatus,
        matchScore: r.matchScore,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const { inserted, updated } = await upsertGRRecords(records);
  await addImportLog({
    at: new Date().toISOString(),
    username: auth.user.username,
    displayName: auth.user.displayName,
    importType: 'gr',
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
    jobTitle: `Impor GR: ${file.name.slice(0, 180)}`,
    fields: [
      { field: 'fileHashSHA256', oldValue: null, newValue: fileHash },
      { field: 'hasilImpor', oldValue: null, newValue: { inserted, updated, skipped: parsed.skipped.length + rowErrors.length, errors: rowErrors.length } },
      { field: 'kursUSDIDR', oldValue: null, newValue: parsed.usdIdrRate },
      { field: 'kolomAktual', oldValue: null, newValue: mapped.aktualTotal },
    ],
    action: 'Impor GR Capex Opex',
  });

  return json({
    ok: true,
    inserted,
    updated,
    skipped: parsed.skipped.length + rowErrors.length,
    errors: rowErrors.slice(0, 20),
    warnings: parsed.warnings.slice(0, 20),
    message: `Impor GR selesai: ${inserted} baru, ${updated} diperbarui, ${parsed.skipped.length + rowErrors.length} baris dilewati.`,
  }, { headers: { 'Cache-Control': 'no-store' } });
};

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const records = await getGRRecords();
  return json({ records }, { headers: { 'Cache-Control': 'no-store' } });
};
