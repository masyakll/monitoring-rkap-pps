/**
 * API: GET /api/mapping — ambil konfigurasi pemetaan
 * API: POST /api/mapping — simpan konfigurasi pemetaan
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin, requireOrigin, checkRateLimit } from '$lib/server/security.js';
import { addAudit } from '$lib/server/db.js';
import { getMappingConfigs, saveMappingConfig } from '$lib/server/budget-db.js';
import { BUDGET_COLUMN_MAPPING } from '../../../../config/mapping-budget.js';
import { GR_COLUMN_MAPPING } from '../../../../config/mapping-gr.js';
import { ANALISA_COLUMN_MAPPING } from '../../../../config/mapping-analisa.js';

const VALID_TYPES = ['budget', 'gr', 'analisa'] as const;

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  if (!['admin', 'viewer'].includes(auth.user.role)) return json({ error: 'Pemetaan kolom hanya tersedia bagi admin/mentor.' }, { status: 403 });
  const configs = await getMappingConfigs();
  return json({
    configs,
    defaults: { budget: BUDGET_COLUMN_MAPPING, gr: GR_COLUMN_MAPPING, analisa: ANALISA_COLUMN_MAPPING },
  }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const origin = requireOrigin(event);
  if (!origin.ok) return json({ error: origin.error }, { status: origin.status });
  // Hanya admin/mentor bisa mengubah pemetaan
  if (auth.user.role !== 'admin') return json({ error: 'Hanya admin yang dapat mengubah pemetaan kolom.' }, { status: 403 });

  const rate = checkRateLimit(event, 'mapping-save', 30, 60_000);
  if (!rate.allowed) return json({ error: 'Terlalu banyak perubahan pemetaan. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds), 'Cache-Control': 'no-store' } });

  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Data tidak valid.' }, { status: 400 });

  const { importType, mapping, aktualColumnPath } = body as Record<string, unknown>;
  if (!VALID_TYPES.includes(importType as any)) return json({ error: `importType harus salah satu: ${VALID_TYPES.join(', ')}.` }, { status: 400 });
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return json({ error: 'mapping wajib berupa objek.' }, { status: 400 });
  const inputMapping = mapping as Record<string, unknown>;
  const safeMapping: Record<string, string> = Object.create(null) as Record<string, string>;
  const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
  for (const [key, value] of Object.entries(inputMapping)) {
    if (forbiddenKeys.has(key.toLowerCase()) || !/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(key)) return json({ error: 'Nama field pemetaan tidak valid.' }, { status: 400 });
    if (typeof value !== 'string' || value.length > 300) return json({ error: 'Setiap pemetaan harus berupa nama kolom maksimal 300 karakter.' }, { status: 400 });
    safeMapping[key] = value.trim();
  }
  if (JSON.stringify(safeMapping).length > 12000) return json({ error: 'Konfigurasi pemetaan terlalu besar.' }, { status: 413 });
  if (aktualColumnPath !== undefined && (typeof aktualColumnPath !== 'string' || aktualColumnPath.length > 300)) return json({ error: 'Nama kolom Aktual tidak valid.' }, { status: 400 });

  const previous = (await getMappingConfigs()).find((c) => c.importType === importType);
  await saveMappingConfig({
    importType: importType as 'budget' | 'gr' | 'analisa',
    mapping: safeMapping,
    aktualColumnPath: typeof aktualColumnPath === 'string' ? aktualColumnPath.trim() : undefined,
    savedBy: auth.user.username,
    savedAt: new Date().toISOString(),
  });
  await addAudit({
    username: auth.user.username,
    displayName: auth.user.displayName,
    jobId: '-',
    jobTitle: `Pemetaan kolom: ${String(importType)}`,
    fields: [{ field: 'mapping', oldValue: previous?.mapping ?? {}, newValue: safeMapping }, ...(aktualColumnPath !== undefined ? [{ field: 'aktualColumnPath', oldValue: previous?.aktualColumnPath ?? null, newValue: aktualColumnPath }] : [])],
    action: 'Ubah Pemetaan Kolom',
  });

  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
