import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin } from '$lib/server/security.js';

/** Endpoint lama untuk impor massal data pekerjaan. Dinonaktifkan agar tidak memintas
 * validasi field, pemeriksaan kepemilikan, dan audit yang berlaku pada endpoint baru.
 * Gunakan form detail untuk edit manual, atau modul Impor Data untuk anggaran/GR.
 */
export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  return json({ error: 'Impor massal pekerjaan versi lama dinonaktifkan. Gunakan form detail pekerjaan atau modul Impor Data yang sesuai.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
};
