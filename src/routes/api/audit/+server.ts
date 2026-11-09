import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { readState } from '$lib/server/db.js';
import { requireRole } from '$lib/server/security.js';

export const GET: RequestHandler = async (event) => {
  const auth = requireRole(event, ['viewer', 'admin']);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const state = await readState();
  return json({ entries: state.audit.slice(0, 500) }, { headers: { 'Cache-Control': 'no-store' } });
};
