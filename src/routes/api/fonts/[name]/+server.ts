import { readFile, lstat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import type { RequestHandler } from './$types.js';

const allowed = new Set(['source-sans-3-latin-400-normal.woff2', 'source-sans-3-latin-600-normal.woff2', 'barlow-condensed-latin-500-normal.woff2', 'barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-latin-700-normal.woff2']);
export const GET: RequestHandler = async ({ params }) => {
  const name = params.name;
  if (!allowed.has(name) || basename(name) !== name) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const path = resolve(process.cwd(), 'fonts', name);
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.size > 2 * 1024 * 1024) return new Response(null, { status: 404 });
    const data = await readFile(path);
    return new Response(data, { headers: { 'Content-Type': 'font/woff2', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Length': String(data.byteLength) } });
  } catch { return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } }); }
};
