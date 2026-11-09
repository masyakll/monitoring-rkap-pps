import { describe, expect, it } from 'vitest';
import { computeJob, getLastProgress, getScs, validateJobPatch, type Job } from '../src/lib/server/domain.js';
import { STAGES, SCS_HPS_LIMIT_USD } from '../src/lib/server/config.js';

function baseJob(overrides: Partial<Job> = {}): Job {
  const stages = Object.fromEntries(STAGES.map((stage) => [stage.key, '']));
  return {
    id: 'uji-1', no: 1, year: 2026, title: 'Pekerjaan uji', pic: 'Eka', type: 'CAPEX', stages,
    vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '',
    paidPercent: 0, rkapBudgetUSD: 10000, hpsUSD: 500, scsDate: '', specialStatus: 'normal', ...overrides
  };
}

describe('Last Progress dihitung berdasarkan tahap terjauh', () => {
  it('mendeteksi setiap tahap 01 sampai 14 berdasarkan tanggal yang terisi', () => {
    for (const stage of STAGES) {
      const stages = Object.fromEntries(STAGES.map((entry) => [entry.key, '']));
      stages[stage.key] = '2026-01-10';
      expect(getLastProgress(baseJob({ stages }))).toBe(stage.no);
    }
  });
  it('memilih nomor tahap tertinggi meskipun tanggal diisi tidak berurutan', () => {
    const job = baseJob({ stages: { ...baseJob().stages, kakReceived: '2026-03-01', hpsPrepared: '2026-03-02', teSentToSom: '2026-01-01' } });
    expect(getLastProgress(job)).toBe(10);
  });
  it('tahap 15 berasal dari Actual Finish dan status khusus 16-18 mengesampingkan tanggal', () => {
    expect(getLastProgress(baseJob({ actualFinish: '2026-04-01' }))).toBe(15);
    expect(getLastProgress(baseJob({ actualFinish: '2026-04-01', specialStatus: 'cancelled' }))).toBe(16);
    expect(getLastProgress(baseJob({ specialStatus: 'terminated' }))).toBe(17);
    expect(getLastProgress(baseJob({ specialStatus: 'retender' }))).toBe(18);
  });
  it('negosiasi bersifat opsional dan tahap pemenang tetap bisa jadi Last Progress 12', () => {
    const job = baseJob({ stages: { ...baseJob().stages, teSentToSom: '2026-04-01', winnerSelected: '2026-04-10' } });
    expect(getLastProgress(job)).toBe(12);
  });
});

describe('aturan status pekerjaan', () => {
  it('memprioritaskan status khusus dan tahap kontrak kosong sesuai urutan yang ditentukan', () => {
    expect(computeJob(baseJob({ specialStatus: 'cancelled', stages: { ...baseJob().stages, contractSigned: '2026-01-01' } }), '2026-06-01').status).toBe('Dibatalkan');
    expect(computeJob(baseJob({ specialStatus: 'terminated' }), '2026-06-01').status).toBe('Terminated');
    expect(computeJob(baseJob({}), '2026-06-01').status).toBe('Belum kontrak');
  });
  it('menghasilkan terlambat, belum mulai, sedang berjalan, dan dua status selesai', () => {
    const contractStages = { ...baseJob().stages, contractSigned: '2026-01-01' };
    expect(computeJob(baseJob({ stages: contractStages, startDate: '2026-02-01', finishDate: '2026-03-01' }), '2026-03-02').status).toBe('Terlambat');
    expect(computeJob(baseJob({ stages: contractStages, startDate: '2026-07-01', finishDate: '2026-08-01' }), '2026-06-01').status).toBe('Belum mulai');
    expect(computeJob(baseJob({ stages: contractStages, startDate: '2026-01-05', finishDate: '2026-12-01' }), '2026-06-01').status).toBe('Sedang berjalan');
    expect(computeJob(baseJob({ stages: contractStages, finishDate: '2026-03-01', actualFinish: '2026-02-28' }), '2026-06-01').status).toBe('Selesai tepat waktu');
    expect(computeJob(baseJob({ stages: contractStages, finishDate: '2026-03-01', actualFinish: '2026-03-07' }), '2026-06-01').status).toBe('Selesai terlambat');
  });
  it('menghitung durasi tahap hanya untuk tahap 01-12', () => {
    const job = baseJob({ stages: { ...baseJob().stages, hpsPrepared: '2026-06-01' } });
    expect(computeJob(job, '2026-06-15').daysInStage).toBe(14);
    const executionJob = baseJob({ stages: { ...baseJob().stages, executionStarted: '2026-06-01' } });
    expect(computeJob(executionJob, '2026-06-15').daysInStage).toBeNull();
  });
});

describe('aturan SCS dan validasi server', () => {
  it('membedakan tidak perlu, belum diajukan, menunggu, dan disetujui', () => {
    expect(getScs(baseJob({ hpsUSD: SCS_HPS_LIMIT_USD })).status).toBe('Tidak perlu');
    expect(getScs(baseJob({ hpsUSD: SCS_HPS_LIMIT_USD + 1 })).status).toBe('Belum diajukan');
    expect(getScs(baseJob({ hpsUSD: SCS_HPS_LIMIT_USD + 1, stages: { ...baseJob().stages, hpsFinalApproved: '2026-01-01' } })).status).toBe('Menunggu SCS');
    expect(getScs(baseJob({ hpsUSD: SCS_HPS_LIMIT_USD + 1, scsDate: '2026-02-01' })).status).toBe('Disetujui');
  });
  it('menolak skrip dalam kolom tanggal dan relasi tanggal yang keliru', () => {
    const current = baseJob();
    expect(validateJobPatch(current, { stages: { kakReceived: '<script>alert(1)</script>' } }).ok).toBe(false);
    expect(validateJobPatch(current, { startDate: '2026-04-20', finishDate: '2026-04-10' }).ok).toBe(false);
  });
});
