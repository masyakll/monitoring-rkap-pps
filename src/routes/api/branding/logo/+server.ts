import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types.js';

const extensions = ['png', 'jpg', 'jpeg', 'webp'];
const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
export const GET: RequestHandler = async () => {
  for (const ext of extensions) {
    const name = 'logo.' + ext;
    const path = resolve(process.cwd(), 'branding', name);
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.size > 8 * 1024 * 1024) continue;
      const buffer = await readFile(path);
      return new Response(buffer, { headers: { 'Content-Type': mime[ext], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Length': String(buffer.byteLength) } });
    } catch { /* Coba ekstensi berikutnya dari daftar putih. */ }
  }
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
};
