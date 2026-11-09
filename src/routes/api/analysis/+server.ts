import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { readState, addAudit } from '$lib/server/db.js';
import { getAnalysisEntries, upsertAnalysisEntry } from '$lib/server/budget-db.js';
import { CAPEX_CAUSES, OPEX_CAUSES } from '../../../../config/mapping-analisa.js';
import { buildAnalysisPayload } from '$lib/server/analysis-service.js';
export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const payload = await buildAnalysisPayload();
  return json(payload, { headers: { 'Cache-Control': 'no-store' } });
};

export const PATCH: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });

  const rate = checkRateLimit(event, 'analysis-write', 60, 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak perubahan analisa. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Data tidak valid.' }, { status: 400 });

  const { jobId, updateProgres, penyebabKategori, penyebabDetail, quickWin, prognosaUsd } = body as Record<string, unknown>;
  if (prognosaUsd !== undefined) return json({ error: 'Prognosa terkunci dikelola melalui halaman Prognosa; perubahan langsung ditolak.' }, { status: 403 });
  if (typeof jobId !== 'string' || !jobId) return json({ error: 'jobId wajib diisi.' }, { status: 400 });

  const state = await readState();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return json({ error: 'Pekerjaan tidak ditemukan.' }, { status: 404 });

  // PIC hanya bisa edit pekerjaan miliknya
  if (auth.user.role === 'viewer') return json({ error: 'Mentor hanya dapat melihat data analisa.' }, { status: 403 });
  if (auth.user.role === 'pic' && auth.user.picName?.toLowerCase() !== job.pic.toLowerCase()) {
    return json({ error: 'Anda hanya dapat mengubah pekerjaan milik PIC Anda.' }, { status: 403 });
  }

  // Validasi
  const allowed_causes = [...CAPEX_CAUSES, ...OPEX_CAUSES, ''];
  if (penyebabKategori !== undefined && !allowed_causes.includes(String(penyebabKategori))) {
    return json({ error: 'Penyebab kategori tidak valid.' }, { status: 400 });
  }
  for (const [field, value] of [['Update Progres', updateProgres], ['Penyebab Detail', penyebabDetail], ['Quick Win', quickWin]] as const) {
    if (value !== undefined && typeof value !== 'string') return json({ error: `${field} harus berupa teks.` }, { status: 400 });
    if (typeof value === 'string' && value.length > 1000) return json({ error: `${field} maksimal 1000 karakter.` }, { status: 400 });
  }

  const existing = (await getAnalysisEntries()).find((e) => e.jobId === jobId);
  const penyebab = typeof penyebabKategori === 'string' ? penyebabKategori : existing?.penyebabKategori ?? '';
  const grupKategori = penyebab; // Grup = kategori penyebab utama

  const entry = await upsertAnalysisEntry({
    id: existing?.id,
    jobId,
    prognosaUsd: existing?.prognosaUsd ?? null,
    updateProgres: typeof updateProgres === 'string' ? updateProgres : (existing?.updateProgres ?? ''),
    penyebabKategori: penyebab,
    penyebabDetail: typeof penyebabDetail === 'string' ? penyebabDetail : (existing?.penyebabDetail ?? ''),
    quickWin: typeof quickWin === 'string' ? quickWin : (existing?.quickWin ?? ''),
    grupKategori,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.user.username,
  });

  await addAudit({
    username: auth.user.username,
    displayName: auth.user.displayName,
    jobId,
    jobTitle: job.title,
    fields: [
      ...(updateProgres !== undefined ? [{ field: 'updateProgres', oldValue: existing?.updateProgres ?? '', newValue: updateProgres }] : []),
      ...(penyebabKategori !== undefined ? [{ field: 'penyebabKategori', oldValue: existing?.penyebabKategori ?? '', newValue: penyebabKategori }] : []),
      ...(penyebabDetail !== undefined ? [{ field: 'penyebabDetail', oldValue: existing?.penyebabDetail ?? '', newValue: penyebabDetail }] : []),
      ...(quickWin !== undefined ? [{ field: 'quickWin', oldValue: existing?.quickWin ?? '', newValue: quickWin }] : []),
    ],
    action: 'Update Analisa Penyerapan',
  });

  return json({ ok: true, entry }, { headers: { 'Cache-Control': 'no-store' } });
};
