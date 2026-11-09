import type { Handle } from '@sveltejs/kit';
import { ensureInitialized } from '$lib/server/db.js';
import { userForSession } from '$lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
  await ensureInitialized();
  event.locals.user = await userForSession(event.cookies.get('rkap_session'));
  const response = await resolve(event);
  const production = process.env.NODE_ENV === 'production';
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    production ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'"
  ];
  response.headers.set('Content-Security-Policy', directives.join('; '));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (event.url.protocol === 'https:' || process.env.COOKIE_SECURE === 'true') response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (event.locals.user || event.url.pathname === '/') {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
  }
  if (event.url.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
  }
  return response;
};
