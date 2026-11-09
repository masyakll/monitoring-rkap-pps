/**
 * API: GET /api/reconcile — laporan rekonsiliasi
 * API: PATCH /api/reconcile — konfirmasi pencocokan manual
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { randomUUID } from 'node:crypto';
import { readState, updateState } from '$lib/server/db.js';
import { buildReconciliation } from '$lib/server/budget-db.js';

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  if (!['admin', 'viewer'].includes(auth.user.role)) return json({ error: 'Halaman rekonsiliasi hanya untuk admin/mentor.' }, { status: 403 });
  const state = await readState();
  const report = await buildReconciliation(state.jobs.map((j) => ({ id: j.id, title: j.title })));

  return json({
    report,
    totals: {
      matched: report.matched.length,
      jobsWithoutBudget: report.jobsWithoutBudget.length,
      budgetWithoutJob: report.budgetWithoutJob.length,
      grWithoutJob: report.grWithoutJob.length,
      pendingConfirmation: report.pendingConfirmation.length,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
};

export const PATCH: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  if (auth.user.role !== 'admin') return json({ error: 'Hanya admin yang dapat mengonfirmasi pencocokan.' }, { status: 403 });

  const rate = checkRateLimit(event, 'reconcile-write', 60, 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak perubahan rekonsiliasi. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Data tidak valid.' }, { status: 400 });
  const { type, sourceId, jobId, action } = body as Record<string, unknown>;
  if (!['budget', 'gr'].includes(String(type)) || typeof sourceId !== 'string' || !sourceId || !['confirm', 'reject'].includes(String(action))) {
    return json({ error: 'Jenis data, ID sumber, atau tindakan tidak valid.' }, { status: 400 });
  }
  const state = await readState();
  const job = typeof jobId === 'string' ? state.jobs.find((j) => j.id === jobId) : null;
  if (action === 'confirm' && !job) return json({ error: 'Pekerjaan tujuan tidak ditemukan.' }, { status: 404 });

  let changed = false;
  let title = '';
  const result = await updateState((mutable) => {
    if (type === 'budget') {
      const item = mutable.budgetItems?.find((b) => b.id === sourceId);
      if (!item) return;
      title = item.deskripsi || item.commitmentItem;
      item.linkedJobId = action === 'confirm' ? String(jobId) : null;
      item.matchStatus = action === 'confirm' ? 'confirmed' : 'unmatched';
      if (action === 'reject') item.matchScore = null;
      changed = true;
    } else {
      const item = mutable.grRecords?.find((g) => g.id === sourceId);
      if (!item) return;
      title = item.namaPekerjaan || item.commitmentItem;
      item.linkedJobId = action === 'confirm' ? String(jobId) : null;
      item.matchStatus = action === 'confirm' ? 'confirmed' : 'unmatched';
      if (action === 'reject') item.matchScore = null;
      changed = true;
    }
  });
  void result;
  if (!changed) return json({ error: 'Data sumber tidak ditemukan.' }, { status: 404 });
  await updateState((mutable) => {
    mutable.audit.unshift({
      id: randomUUID(), at: new Date().toISOString(), username: auth.user.username,
      displayName: auth.user.displayName, jobId: action === 'confirm' ? String(jobId) : '-',
      jobTitle: title, fields: [{ field: 'rekonsiliasi', oldValue: null, newValue: `${action}:${String(type)}` }],
      action: action === 'confirm' ? 'Konfirmasi Rekonsiliasi' : 'Tolak Pencocokan'
    });
    if (mutable.audit.length > 10000) mutable.audit.length = 10000;
  });
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
