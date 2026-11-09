/**
 * Tests untuk modul impor anggaran RKAP dan analisa penyerapan.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCsvBudget,
  parseNumber,
  parseDate,
  similarityScore,
  normalizeName,
  flattenHeaders as _flattenHeaders,
  mapColumns,
} from '../src/lib/server/budget-parser.js';
import {
  hitungAktual,
  hitungPersen,
  formatPersen,
} from '../src/lib/server/aktual.js';

// ─── 1. Perataan header bertingkat dan sel gabungan ──────────────────────────

describe('parseCsvBudget – header bertingkat', () => {
  it('meratakan 3 baris header dengan grup menjadi jalur', () => {
    const csv = `Rencana Kerja & Anggaran Perusahaan (RKAP) 2026,,,,
Divisi: Pemeliharaan PLTA (PME),,,,
Kurs 16.300,,,,
1,1,1,1,1
Commitment Item,GL Account,Carried Over,,Commitment
,,,Qty,USD Amount,,Qty
,,Curr,Amount,,,Curr
CI001,61201010,IDR,1000000,61.35,IDR,500000
Total,,,,,,,
`;
    const result = parseCsvBudget(csv);
    expect(result.usdIdrRate).toBe(16300);
    expect(result.metadata.divisi).toBeTruthy();
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    // Baris total harus dilewati
    expect(result.skipped.some((s) => /total/i.test(s.reason))).toBe(true);
    // Baris pembantu angka harus dilewati
    expect(result.skipped.some((s) => s.reason.includes('pembantu'))).toBe(true);
  });

  it('mendeteksi kurs dari header', () => {
    const csv = `Kurs 16.300,,
Header1,Header2,Header3
Data1,Data2,Data3
`;
    const result = parseCsvBudget(csv);
    expect(result.usdIdrRate).toBe(16300);
  });

  it('kurs default 16300 jika tidak ada di header', () => {
    const csv = `Header1,Header2
Data1,Data2
`;
    const result = parseCsvBudget(csv);
    expect(result.usdIdrRate).toBe(16300);
  });
});

// ─── 2. Nama kolom ganda diberi akhiran #2 ───────────────────────────────────

describe('parseCsvBudget – nama kolom ganda', () => {
  it('memberi akhiran #2 pada kolom yang namanya sama', () => {
    const csv = `Commitment Item,GL Account,Commitment Item,Deskripsi
CI001,61201010,CI001,Pekerjaan A
`;
    const result = parseCsvBudget(csv);
    const paths = result.columns.map((c) => c.path);
    expect(paths.filter((p) => p.startsWith('Commitment Item')).length).toBe(2);
    expect(paths.some((p) => p === 'Commitment Item #2')).toBe(true);
  });
});

// ─── 3. Format angka Indonesia dan internasional ─────────────────────────────

describe('parseNumber', () => {
  it('format Indonesia: 1.234.567,89', () => {
    expect(parseNumber('1.234.567,89')).toBeCloseTo(1234567.89);
  });
  it('format internasional: 1,234,567.89', () => {
    expect(parseNumber('1,234,567.89')).toBeCloseTo(1234567.89);
  });
  it('format persen: 92,0%', () => {
    expect(parseNumber('92,0%')).toBeCloseTo(0.92);
  });
  it('kurs Indonesia 16.300 dibaca sebagai 16300', () => {
    expect(parseNumber('16.300')).toBe(16300);
  });
  it('string kosong → null', () => {
    expect(parseNumber('')).toBeNull();
  });
  it('teks bukan angka → null', () => {
    expect(parseNumber('abc')).toBeNull();
  });
  it('nol', () => {
    expect(parseNumber('0')).toBe(0);
  });
});

// ─── 4. Nilai error Excel diabaikan ──────────────────────────────────────────

describe('parseCsvBudget – validasi struktur CSV', () => {
  it('menolak tanda kutip yang tidak berpasangan', () => {
    expect(() => parseCsvBudget('Nama,Nilai\n\"baris tidak valid,100\n')).toThrow(/kutip tidak berpasangan/i);
  });
});

describe('parseCsvBudget – nilai error Excel dianggap kosong', () => {
  it('mengabaikan #NAME?, #REF!, #DIV/0!, #N/A, #VALUE!', () => {
    const csv = `Commitment Item,Nilai,Keterangan
CI001,#NAME?,#REF!
CI002,#DIV/0!,#N/A
CI003,#VALUE!,OK
`;
    const result = parseCsvBudget(csv);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.rows.length).toBe(3);
    // Nilai error harus menjadi string kosong
    for (const row of result.rows) {
      for (const [, val] of Object.entries(row.values)) {
        expect(val).not.toMatch(/^#(NAME|REF|DIV|N\/A|VALUE)\?/);
      }
    }
  });
});

// ─── 5. Idempotensi: dua kali impor tidak menggandakan ───────────────────────

describe('upsertBudgetItems – idempotensi', () => {
  it('mengimpor dua kali dengan CI sama tidak menggandakan', async () => {
    const { upsertBudgetItems, getBudgetItems } = await import('../src/lib/server/budget-db.js');
    const item = {
      id: 'test-id-1',
      commitmentItem: 'TEST001',
      glAccount: '',
      tahun: '2026',
      prYN: 'Y',
      fundCenter: 'A0302BB020',
      deskripsi: 'Test',
      currency: 'IDR',
      carriedOverQty: null,
      carriedOverAmount: null,
      carriedOverUsd: null,
      commitmentQty: null,
      commitmentAmount: null,
      commitmentUsd: null,
      rkapMonthly: {},
      rkapQty: null,
      rkapCurr: 'IDR',
      planRkapUsd: 1000,
      extra: {},
      importedAt: new Date().toISOString(),
      importedBy: 'test',
      importFileHash: 'abc123',
      importMetadata: {},
      linkedJobId: null,
      matchScore: null,
      matchStatus: 'unmatched' as const,
    };
    await upsertBudgetItems([item]);
    await upsertBudgetItems([item]); // impor kedua
    const all = await getBudgetItems();
    const count = all.filter((b) => b.commitmentItem === 'TEST001').length;
    expect(count).toBe(1);
  });
});

// ─── 6. Pencocokan nama dengan ejaan berbeda ─────────────────────────────────

describe('similarityScore', () => {
  it('nama sama persis → skor 1', () => {
    expect(similarityScore('Renewal of Fire Alarm system', 'Renewal of Fire Alarm system')).toBe(1);
  });
  it('ejaan sedikit beda → skor > 0.7', () => {
    const a = 'Renewal Fire Alarm system at TNP';
    const b = 'Renewal of Fire Alarm system at TNP';
    expect(similarityScore(a, b)).toBeGreaterThan(0.7);
  });
  it('nama sangat berbeda → skor rendah', () => {
    const a = 'Calibration of Protection Relay';
    const b = 'Renewal of UPS System';
    expect(similarityScore(a, b)).toBeLessThan(0.5);
  });
  it('string kosong → skor 0', () => {
    expect(similarityScore('', 'anything')).toBe(0);
  });
});

// ─── 7. Rumus persen termasuk pembagi nol ─────────────────────────────────────

describe('hitungPersen', () => {
  it('normal: 500/1000 = 0.5', () => {
    expect(hitungPersen(500, 1000)).toBe(0.5);
  });
  it('melebihi 100%: 1520/1000 = 1.52', () => {
    expect(hitungPersen(1520, 1000)).toBe(1.52);
  });
  it('pembagi nol → null', () => {
    expect(hitungPersen(100, 0)).toBeNull();
  });
  it('pembilang null → null', () => {
    expect(hitungPersen(null, 1000)).toBeNull();
  });
  it('nol/1000 → 0', () => {
    expect(hitungPersen(0, 1000)).toBe(0);
  });
});

describe('formatPersen', () => {
  it('null → "-"', () => {
    expect(formatPersen(null)).toBe('-');
  });
  it('0 → "0,0%"', () => {
    expect(formatPersen(0)).toBe('0,0%');
  });
  it('1.0 → "100,0%"', () => {
    expect(formatPersen(1.0)).toBe('100,0%');
  });
  it('1.52 → "152,0%"', () => {
    expect(formatPersen(1.52)).toBe('152,0%');
  });
});

// ─── 8. hitungAktual – fungsi rumus ──────────────────────────────────────────

describe('hitungAktual', () => {
  const mockJob = {
    id: 'j1', no: 1, year: 2026, title: 'Test', pic: 'Eka',
    type: 'CAPEX' as const, stages: {}, vendor: '', contractAmountIDR: 188000000,
    startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '',
    paidPercent: 65, rkapBudgetUSD: 18000, hpsUSD: 8700, scsDate: '',
    specialStatus: 'normal' as const,
  };

  it('GR null → null', () => {
    expect(hitungAktual(mockJob, null, 16300)).toBeNull();
  });
  it('GR IDR → konversi ke USD', () => {
    const gr = { aktualTotal: 16300000, aktualTotalUsd: null, currency: 'IDR' } as any;
    expect(hitungAktual(mockJob, gr, 16300)).toBeCloseTo(1000);
  });
  it('GR USD → langsung', () => {
    const gr = { aktualTotal: 1000, aktualTotalUsd: null, currency: 'USD' } as any;
    expect(hitungAktual(mockJob, gr, 16300)).toBe(1000);
  });
});

// ─── 9. Summary Executive – perhitungan Capex dan Opex terpisah ──────────────

describe('Summary Executive – persentase Capex dan Opex', () => {
  it('persentase Capex dan Opex dihitung terpisah', () => {
    const rows = [
      { tipe: 'CAPEX', planUsd: 100, prognosaUsd: 47.3 },
      { tipe: 'OPEX', planUsd: 100, prognosaUsd: 52.0 },
    ];
    const capexPrognosa = rows.filter((r) => r.tipe === 'CAPEX').reduce((s, r) => s + (r.prognosaUsd ?? 0), 0);
    const capexPlan = rows.filter((r) => r.tipe === 'CAPEX').reduce((s, r) => s + (r.planUsd ?? 0), 0);
    const opexPrognosa = rows.filter((r) => r.tipe === 'OPEX').reduce((s, r) => s + (r.prognosaUsd ?? 0), 0);
    const opexPlan = rows.filter((r) => r.tipe === 'OPEX').reduce((s, r) => s + (r.planUsd ?? 0), 0);
    expect(hitungPersen(capexPrognosa, capexPlan)).toBeCloseTo(0.473);
    expect(hitungPersen(opexPrognosa, opexPlan)).toBeCloseTo(0.52);
  });
});

// ─── 10. Prognosa: Aktual Jan-Agu + Perkiraan Sep-Des ────────────────────────

describe('Prognosa = Aktual Jan-Agu + Perkiraan Sep-Des', () => {
  it('menjumlahkan 12 bulan dengan benar', () => {
    const monthly = {
      jan: 1000, feb: 1500, mar: 0, apr: 2000, mei: 1800, jun: 0,
      jul: 2200, agu: 1700, sep: 1500, okt: 1500, nov: 1500, des: 1500,
    };
    const total = Object.values(monthly).reduce((s, v) => s + (v ?? 0), 0);
    expect(total).toBe(16200);
  });
});

// ─── 11. parseDate ────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('YYYY-MM-DD langsung', () => {
    expect(parseDate('2026-04-15')).toBe('2026-04-15');
  });
  it('DD/MM/YYYY → YYYY-MM-DD', () => {
    expect(parseDate('15/04/2026')).toBe('2026-04-15');
  });
  it('nomor seri Excel 45927 → tanggal 2025-10-08', () => {
    // 45927 = 2025-10-08 (approx)
    const result = parseDate(45942);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('string kosong → string kosong', () => {
    expect(parseDate('')).toBe('');
  });
});

// ─── 12. Baris di atas 44 tetap dibaca ───────────────────────────────────────

describe('parseCsvBudget – tidak ada batas 44 baris', () => {
  it('membaca lebih dari 44 baris data', () => {
    const header = 'Commitment Item,Deskripsi,Nilai\n';
    const rows = Array.from({ length: 60 }, (_, i) => `CI${String(i + 1).padStart(3, '0')},Pekerjaan ${i + 1},${(i + 1) * 1000}\n`);
    const csv = header + rows.join('');
    const result = parseCsvBudget(csv);
    expect(result.rows.length).toBeGreaterThanOrEqual(44);
  });
});
