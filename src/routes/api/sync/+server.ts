import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { syncNow } from '$lib/server/sources.js';
import { addAudit } from '$lib/server/db.js';

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  if (!['admin', 'viewer'].includes(auth.user.role)) return json({ error: 'Hanya admin atau mentor yang dapat menjalankan sinkronisasi.' }, { status: 403 });
  const rate = checkRateLimit(event, 'sync-now', 6, 10 * 60_000);
  if (!rate.allowed) return json({ error: 'Sinkronisasi terlalu sering diminta. Coba lagi beberapa menit.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });
  const bodyLength = Number(event.request.headers.get('content-length') || 0);
  if (bodyLength > 1024) return json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
  try {
    const result = await syncNow();
    await addAudit({ username: auth.user.username, displayName: auth.user.displayName, jobId: '-', jobTitle: 'Sinkronisasi sumber data', fields: [{ field: 'lastSync', oldValue: null, newValue: result.at }], action: `Sinkronisasi (${result.message})` });
    return json({ ok: true, lastSync: result.at, message: result.message }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Sinkronisasi gagal.' }, { status: 503 });
  }
};
