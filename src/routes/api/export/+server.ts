import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin } from '$lib/server/security.js';
import { loadJobs } from '$lib/server/sources.js';
import { computeJob, todayJakarta } from '$lib/server/domain.js';
import { createCsv, createXlsx, exportRows } from '$lib/server/exports.js';

function matches(job: Record<string, any>, url: URL) {
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const pic = url.searchParams.get('pic') || '';
  const type = url.searchParams.get('type') || '';
  const status = url.searchParams.get('status') || '';
  return (!q || `${job.title} ${job.pic} ${job.no} ${job.vendor} ${job.commitmentItem || ''} ${job.detailProgress || ''} ${job.sourceLastProgress || ''} ${job.sourceIssue || ''} ${job.sourceAction || ''}`.toLowerCase().includes(q)) && (!pic || job.pic === pic) && (!type || job.type === type) && (!status || job.status === status);
}
export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const format = event.url.searchParams.get('format') || 'csv';
  if (!['csv', 'xlsx'].includes(format)) return json({ error: 'Format ekspor tidak didukung.' }, { status: 400 });
  let jobs;
  try { jobs = await loadJobs(); }
  catch (err) { return json({ error: err instanceof Error ? err.message : 'Sumber data tidak tersedia.' }, { status: 503 }); }
  const asOf = event.url.searchParams.get('asOf') || todayJakarta();
  const filtered = jobs.map((job) => computeJob(job, asOf)).filter((job) => matches(job as unknown as Record<string, any>, event.url));
  const rows = exportRows(filtered as unknown as Record<string, any>[]);
  if (format === 'csv') {
    const csv = createCsv(rows);
    return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="monitoring-rkap.csv"', 'Cache-Control': 'no-store' } });
  }
  const buffer = await createXlsx(rows);
  return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="monitoring-rkap.xlsx"', 'Cache-Control': 'no-store' } });
};
