import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { login, sessionCookieOptions } from '$lib/server/auth.js';
import { requireOrigin } from '$lib/server/security.js';

export const POST: RequestHandler = async (event) => {
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  const length = Number(event.request.headers.get('content-length') || 0);
  if (length > 16_384) return json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
  let body: unknown;
  try {
    const text = await event.request.text();
    if (Buffer.byteLength(text, 'utf8') > 16_384) return json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
    body = JSON.parse(text);
  } catch { return json({ error: 'Format permintaan tidak valid.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
  const { username, password } = body as Record<string, unknown>;
  let ip = 'unknown';
  try { ip = event.getClientAddress(); } catch { ip = 'unknown'; }
  const result = await login(username, password, ip);
  if (!result.ok) return json({ error: result.error }, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  const secure = process.env.COOKIE_SECURE === 'true' || event.url.protocol === 'https:';
  event.cookies.set('rkap_session', result.sid, { ...sessionCookieOptions(secure), expires: new Date(result.expiresAt) });
  return json({ user: result.user }, { headers: { 'Cache-Control': 'no-store' } });
};
