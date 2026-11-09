import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { destroySession, sessionCookieOptions } from '$lib/server/auth.js';
import { requireLogin, requireOrigin } from '$lib/server/security.js';

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  const bodyLength = Number(event.request.headers.get('content-length') || 0);
  if (bodyLength > 1024) return json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
  await destroySession(event.cookies.get('rkap_session'));
  event.cookies.delete('rkap_session', { ...sessionCookieOptions(process.env.COOKIE_SECURE === 'true' || event.url.protocol === 'https:'), maxAge: 0 });
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
