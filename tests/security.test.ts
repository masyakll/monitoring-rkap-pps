import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let testDir = '';
let db: typeof import('../src/lib/server/db.js');
let auth: typeof import('../src/lib/server/auth.js');
let patchHandler: typeof import('../src/routes/api/jobs/[id]/+server.js').PATCH;
let stateJobs: import('../src/lib/server/domain.js').Job[] = [];

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'rkap-monitoring-test-'));
  process.env.DATA_DIR = testDir;
  process.env.DATA_SOURCE = 'dummy';
  process.env.DEMO_PASSWORD_EKA = 'Password-Uji-Eka-2026!';
  process.env.DEMO_PASSWORD_AZWIL = 'Password-Uji-Azwil-2026!';
  process.env.DEMO_PASSWORD_IRFAN = 'Password-Uji-Irfan-2026!';
  process.env.DEMO_PASSWORD_OBED = 'Password-Uji-Obed-2026!';
  process.env.DEMO_PASSWORD_MENTOR = 'Password-Uji-Mentor-2026!';
  process.env.LOGIN_MAX_ATTEMPTS = '5';
  process.env.LOGIN_WINDOW_MINUTES = '15';
  db = await import('../src/lib/server/db.js');
  auth = await import('../src/lib/server/auth.js');
  await db.ensureInitialized();
  stateJobs = (await db.readState()).jobs;
  const route = await import('../src/routes/api/jobs/[id]/+server.js');
  patchHandler = route.PATCH;
});

afterAll(async () => {
  if (testDir) await rm(testDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

function fakeEvent(jobId: string, user: any, body: unknown, origin: string | null = 'http://localhost:4173') {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (origin) headers.set('origin', origin);
  return {
    locals: { user },
    params: { id: jobId },
    url: new URL(`http://localhost:4173/api/jobs/${jobId}`),
    request: new Request(`http://localhost:4173/api/jobs/${jobId}`, {
      method: 'PATCH', headers, body: JSON.stringify(body)
    })
  } as any;
}

describe('autentikasi dan pembatasan percobaan masuk', () => {
  it('menerima kata sandi benar dan membuat sesi baru', async () => {
    const result = await auth.login('eka', 'Password-Uji-Eka-2026!', '192.0.2.20');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Buffer.from(result.sid, 'base64url').byteLength).toBe(32);
      expect(await auth.userForSession(result.sid)).toMatchObject({ username: 'eka', role: 'pic' });
    }
  });
  it('menolak kata sandi salah dan memblokir sesudah batas gagal', async () => {
    for (let i = 0; i < 5; i++) {
      const result = await auth.login('eka', 'kata-sandi-salah', '192.0.2.21');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    }
    const blocked = await auth.login('eka', 'Password-Uji-Eka-2026!', '192.0.2.21');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(429);
  });
});

describe('otorisasi perubahan pekerjaan di server', () => {
  it('menolak PIC yang mencoba mengubah pekerjaan PIC lain', async () => {
    const otherJob = stateJobs.find((job) => job.pic === 'Azwil')!;
    const result = await patchHandler(fakeEvent(otherJob.id, { id: 'eka-id', username: 'eka', displayName: 'Eka', role: 'pic', picName: 'Eka' }, { vendor: 'Tidak boleh' }));
    expect(result.status).toBe(403);
    expect((await result.json()).error).toContain('milik PIC Anda sendiri');
  });
  it('menolak akun viewer untuk menyunting', async () => {
    const job = stateJobs.find((entry) => entry.pic === 'Eka')!;
    const result = await patchHandler(fakeEvent(job.id, { id: 'mentor-id', username: 'mentor', displayName: 'Mentor', role: 'viewer', picName: null }, { vendor: 'Tidak boleh' }));
    expect(result.status).toBe(403);
    expect((await result.json()).error).toContain('hanya dapat melihat');
  });
  it('menolak request mutasi tanpa Origin', async () => {
    const job = stateJobs.find((entry) => entry.pic === 'Eka')!;
    const result = await patchHandler(fakeEvent(job.id, { id: 'eka-id', username: 'eka', displayName: 'Eka', role: 'pic', picName: 'Eka' }, { vendor: 'Uji' }, null));
    expect(result.status).toBe(403);
    expect((await result.json()).error).toContain('Origin wajib ada');
  });
  it('menolak tag skrip yang dikirim ke kolom tanggal', async () => {
    const job = stateJobs.find((entry) => entry.pic === 'Eka')!;
    const result = await patchHandler(fakeEvent(job.id, { id: 'eka-id', username: 'eka', displayName: 'Eka', role: 'pic', picName: 'Eka' }, { stages: { kakReceived: '<script>alert(1)</script>' } }));
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain('format YYYY-MM-DD');
  });
});
