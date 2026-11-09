/**
 * API Prognosa: manajemen versi prognosa terkunci
 * POST /api/prognosa → buat versi baru (kunci)
 * GET  /api/prognosa → lihat semua versi per jobId
 * PATCH /api/prognosa → buka kunci (admin saja, dengan alasan)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { savePrognosaVersion, unlockPrognosa } from '$lib/server/budget-db.js';
import { addAudit, readState } from '$lib/server/db.js';
import { getBudgetItems, getGRRecords, getPrognosaVersions } from '$lib/server/budget-db.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  const jobId = event.url.searchParams.get('jobId') || undefined;
  const versions = await getPrognosaVersions(jobId);
  return json({ versions }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  // Hanya admin/mentor bisa mengunci
  if (auth.user.role !== 'admin') return json({ error: 'Hanya admin yang dapat mengunci prognosa.' }, { status: 403 });

  const rate = checkRateLimit(event, 'prognosa-write', 30, 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak perubahan Prognosa. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Data tidak valid.' }, { status: 400 });

  const { jobId, monthly, keterangan } = body as Record<string, unknown>;
  if (typeof jobId !== 'string' || !jobId) return json({ error: 'Pekerjaan wajib dipilih.' }, { status: 400 });
  if (typeof keterangan !== 'string' || !keterangan.trim() || keterangan.length > 500) return json({ error: 'Keterangan penyampaian wajib diisi (maksimal 500 karakter).' }, { status: 400 });
  if (!monthly || typeof monthly !== 'object' || Array.isArray(monthly)) return json({ error: 'Nilai bulanan wajib diisi.' }, { status: 400 });

  const state = await readState();
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return json({ error: 'Pekerjaan tidak ditemukan.' }, { status: 404 });
  const versions = (await getPrognosaVersions(jobId)).sort((a, b) => b.version - a.version);
  const latest = versions[0];
  if (latest && !latest.unlockedAt) return json({ error: 'Versi terbaru masih terkunci. Buka kunci dengan alasan sebelum membuat versi baru.' }, { status: 409 });

  const monthlyInput = monthly as Record<string, unknown>;
  const grs = await getGRRecords();
  const gr = grs.find((item) => item.linkedJobId === jobId && item.matchStatus === 'confirmed')
    ?? grs.find((item) => item.linkedJobId === jobId);
  const finalMonthly: Record<string, number | null> = {};
  const actualMonths = MONTHS.slice(0, 8);
  for (const month of actualMonths) {
    const actualValue = gr?.monthly?.[month];
    if (typeof actualValue !== 'number' || !Number.isFinite(actualValue) || actualValue < 0) {
      return json({ error: `Aktual GR bulan ${month.toUpperCase()} belum tersedia untuk pekerjaan ini. Periksa impor dan rekonsiliasi GR.` }, { status: 422 });
    }
    // Jan–Agu selalu bersumber dari GR, bukan angka yang dikirim browser.
    finalMonthly[month] = actualValue;
  }
  for (const month of MONTHS.slice(8)) {
    const value = monthlyInput[month];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return json({ error: `Perkiraan bulan ${month.toUpperCase()} harus diisi dengan angka nol atau lebih.` }, { status: 400 });
    }
    finalMonthly[month] = value;
  }
  const totalUsd = MONTHS.reduce((sum, month) => sum + Number(finalMonthly[month] ?? 0), 0);
  const budgetRows = await getBudgetItems();
  const budget = budgetRows.find((item) => item.linkedJobId === jobId && item.matchStatus === 'confirmed');
  const planUsd = budget ? budget.planRkapUsd : (budgetRows.length ? null : job.rkapBudgetUSD ?? null);
  const pct = planUsd && planUsd > 0 ? totalUsd / planUsd : null;

  const version = await savePrognosaVersion({
    jobId,
    monthly: finalMonthly,
    totalUsd,
    pct,
    tipe: job.type,
    keterangan: keterangan.trim(),
    lockedAt: new Date().toISOString(),
    lockedBy: auth.user.username,
    unlockedAt: null,
    unlockedBy: null,
    unlockedReason: null,
  });

  await addAudit({
    username: auth.user.username,
    displayName: auth.user.displayName,
    jobId,
    jobTitle: `Prognosa v${version.version}`,
    fields: [{ field: 'prognosa', oldValue: null, newValue: `v${version.version} dikunci` }],
    action: 'Kunci Prognosa',
  });

  return json({ ok: true, version }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PATCH: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  // Hanya admin yang dapat membuka kunci
  if (auth.user.role !== 'admin') return json({ error: 'Hanya admin yang dapat membuka kunci prognosa.' }, { status: 403 });
  const rate = checkRateLimit(event, 'prognosa-unlock', 20, 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak permintaan buka kunci. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Data tidak valid.' }, { status: 400 });

  const { jobId, version, reason } = body as Record<string, unknown>;
  if (typeof jobId !== 'string' || !jobId) return json({ error: 'jobId wajib.' }, { status: 400 });
  if (typeof version !== 'number') return json({ error: 'version harus angka.' }, { status: 400 });
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return json({ error: 'Alasan buka kunci wajib diisi.' }, { status: 400 });
  }
  if (reason.length > 1000) return json({ error: 'Alasan buka kunci maksimal 1000 karakter.' }, { status: 400 });

  const result = await unlockPrognosa(jobId, version, auth.user.username, reason.trim());
  if (!result.ok) return json({ error: result.error }, { status: 422 });

  await addAudit({
    username: auth.user.username,
    displayName: auth.user.displayName,
    jobId,
    jobTitle: `Prognosa v${version}`,
    fields: [{ field: 'kunci', oldValue: 'Terkunci', newValue: `Dibuka: ${reason.trim()}` }],
    action: 'Buka Kunci Prognosa',
  });

  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
