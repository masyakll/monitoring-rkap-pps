import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readState } from '$lib/server/db.js';
import { getSourceMode, getSourceConfigStatus } from '$lib/server/sources.js';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  const state = await readState();
  return json({ authenticated: true, user: locals.user, lastSync: state.lastSync, source: getSourceMode(), sourceConfigured: getSourceConfigStatus().configured }, { headers: { 'Cache-Control': 'no-store' } });
};
