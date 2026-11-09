import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { computeJob, validateJobPatch } from '$lib/server/domain.js';
import { requireLogin, requireOrigin } from '$lib/server/security.js';
import { addAudit, readState, updateState } from '$lib/server/db.js';
import { getReadOnlyFields, getSourceMode } from '$lib/server/sources.js';

export const PATCH: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  if (auth.user.role !== 'pic') return json({ error: 'Hanya akun PIC yang dapat mengubah pekerjaan melalui website.' }, { status: 403 });
  if (getSourceMode() !== 'dummy') return json({ error: 'Pengeditan belum tersedia sebelum konektor sumber data live diselesaikan.' }, { status: 503 });
  const length = Number(event.request.headers.get('content-length') || 0);
  if (length > 32_768) return json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
  let patch: unknown;
  try {
    const text = await event.request.text();
    if (Buffer.byteLength(text, 'utf8') > 32_768) return json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
    patch = JSON.parse(text);
  } catch { return json({ error: 'Format JSON tidak valid.' }, { status: 400 }); }
  const readOnly = new Set(getReadOnlyFields());
  if (patch && typeof patch === 'object' && 'stages' in patch && (patch as { stages?: unknown }).stages && typeof (patch as { stages: unknown }).stages === 'object') {
    for (const key of Object.keys((patch as { stages: Record<string, unknown> }).stages)) {
      if (readOnly.has(`stages.${key}`)) return json({ error: `Tanggal tahap ${key} dikelola oleh sumber ${getSourceMode().toUpperCase()} dan hanya-baca.` }, { status: 403 });
    }
  }
  const result = await updateState((state) => {
    const index = state.jobs.findIndex((job) => job.id === event.params.id);
    if (index < 0) return { error: 'Pekerjaan tidak ditemukan.', status: 404 as const };
    const current = state.jobs[index];
    const assignedPic = (auth.user.picName || auth.user.displayName || '').trim().toLowerCase();
    if (!assignedPic || current.pic.trim().toLowerCase() !== assignedPic) return { error: 'Anda hanya dapat mengubah pekerjaan yang ditugaskan kepada akun PIC Anda.', status: 403 as const };
    const currentPatch = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch as Record<string, unknown> : {};
    const importedBudget = state.budgetItems?.find((item) => item.linkedJobId === current.id && item.matchStatus === 'confirmed');
    if ('rkapBudgetUSD' in currentPatch && (state.budgetItems?.length ?? 0) > 0) return { error: 'Anggaran RKAP dikelola melalui Impor Data dan tidak dapat diubah manual oleh PIC.' , status: 403 as const };
    if ('hpsUSD' in currentPatch && importedBudget?.hpsUsd != null) return { error: 'HPS berasal dari data impor dan hanya-baca untuk PIC.' , status: 403 as const };
    const validation = validateJobPatch(current, patch);
    if (!validation.ok) return { error: validation.error, status: 400 as const };
    if (!validation.changed.length) return { ok: true as const, job: computeJob(current), audit: null };
    state.jobs[index] = validation.job;
    const fields = validation.changed.map((field) => {
      const parts = field.split('.');
      const oldValue = parts.length === 2 ? (current as unknown as Record<string, any>)[parts[0]]?.[parts[1]] : (current as unknown as Record<string, unknown>)[field];
      const newValue = parts.length === 2 ? (validation.job as unknown as Record<string, any>)[parts[0]]?.[parts[1]] : (validation.job as unknown as Record<string, unknown>)[field];
      return { field, oldValue, newValue };
    });
    return { ok: true as const, job: computeJob(validation.job), audit: { jobId: current.id, jobTitle: current.title, fields } };
  });
  if ('error' in result) return json({ error: result.error }, { status: result.status });
  if (result.audit) await addAudit({ username: auth.user.username, displayName: auth.user.displayName, jobId: result.audit.jobId, jobTitle: result.audit.jobTitle, fields: result.audit.fields, action: 'Perubahan data pekerjaan' });
  const state = await readState();
  return json({ job: result.job, lastSync: state.lastSync }, { headers: { 'Cache-Control': 'no-store' } });
};
