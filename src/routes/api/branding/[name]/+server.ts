import { readFile, lstat } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

const allowedNames = new Set(['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp', 'background.png', 'background.jpg', 'background.jpeg', 'background.webp']);
const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
export const GET: RequestHandler = async ({ params }) => {
  const name = params.name;
  if (!allowedNames.has(name) || basename(name) !== name) return json({ error: 'Nama berkas branding tidak diizinkan.' }, { status: 404 });
  const path = resolve(process.cwd(), 'branding', name);
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.size > 8 * 1024 * 1024) return json({ error: 'Berkas branding tidak valid atau terlalu besar.' }, { status: 404 });
    const buffer = await readFile(path);
    const ext = name.split('.').at(-1) || '';
    return new Response(buffer, { headers: { 'Content-Type': mime[ext], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Length': String(buffer.byteLength) } });
  } catch { return json({ error: 'Berkas branding belum dipasang.' }, { status: 404 }); }
};
