import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { loadAbsorptionRows } from '$lib/server/sources.js';
import { clearGoogleSheetCache } from '$lib/server/google-sheets.js';

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  try {
    const data = await loadAbsorptionRows();
    return json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return json({ connected: false, headers: [], rows: [], fetchedAt: null, error: err instanceof Error ? err.message : 'Gagal membaca sumber penyerapan.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  if (!['admin', 'viewer'].includes(auth.user.role)) return json({ error: 'Hanya mentor atau admin yang dapat menyegarkan sumber data.' }, { status: 403 });
  const rate = checkRateLimit(event, 'absorption-refresh', 8, 10 * 60_000);
  if (!rate.allowed) return json({ error: 'Permintaan refresh terlalu sering. Coba lagi beberapa menit.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });
  clearGoogleSheetCache();
  try {
    const data = await loadAbsorptionRows(true);
    return json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return json({ connected: false, headers: [], rows: [], fetchedAt: null, error: err instanceof Error ? err.message : 'Gagal menyegarkan sumber penyerapan.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};
