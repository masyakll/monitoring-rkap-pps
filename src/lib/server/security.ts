import type { RequestEvent } from '@sveltejs/kit';
import type { UserRole } from './db.js';

export function requireOrigin(event: RequestEvent) {
  const supplied = event.request.headers.get('origin');
  if (!supplied) return { ok: false as const, status: 403, error: 'Permintaan ditolak: header Origin wajib ada.' };
  const expected = process.env.ORIGIN?.trim() || event.url.origin;
  try {
    if (new URL(supplied).origin !== new URL(expected).origin) return { ok: false as const, status: 403, error: 'Permintaan ditolak: Origin tidak cocok.' };
  } catch {
    return { ok: false as const, status: 403, error: 'Permintaan ditolak: Origin tidak valid.' };
  }
  return { ok: true as const };
}

export function requireLogin(event: RequestEvent) {
  if (!event.locals.user) return { ok: false as const, status: 401, error: 'Sesi tidak ditemukan atau sudah kedaluwarsa. Silakan masuk kembali.' };
  return { ok: true as const, user: event.locals.user };
}

export function requireRole(event: RequestEvent, roles: UserRole[]) {
  const login = requireLogin(event);
  if (!login.ok) return login;
  const user = event.locals.user!;
  if (!roles.includes(user.role)) return { ok: false as const, status: 403, error: 'Anda tidak memiliki izin untuk melakukan tindakan ini.' };
  return { ok: true as const, user };
}

export function jsonNoStoreHeaders() {
  return { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
}


// Pembatasan laju in-memory sebagai lapisan tambahan untuk operasi sensitif.
// Untuk deployment multi-instance, gantikan dengan pembatasan di reverse proxy atau store terpusat.
type RateBucket = { startedAt: number; count: number };
const rateBuckets = new Map<string, RateBucket>();

export function checkRateLimit(event: RequestEvent, scope: string, maxRequests = 30, windowMs = 60_000) {
  const now = Date.now();
  let ip = 'unknown';
  try { ip = event.getClientAddress(); } catch { /* adapter mungkin tidak menyediakan IP */ }
  const user = event.locals.user?.username || 'anonymous';
  const key = `${scope}:${user}:${ip}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  // Hindari pertumbuhan Map tanpa batas pada proses panjang.
  if (rateBuckets.size > 5000) {
    for (const [entryKey, entry] of rateBuckets) {
      if (now - entry.startedAt >= windowMs) rateBuckets.delete(entryKey);
      if (rateBuckets.size <= 4000) break;
    }
  }
  const allowed = bucket.count <= maxRequests;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - bucket.startedAt)) / 1000));
  return { allowed, retryAfterSeconds };
}
