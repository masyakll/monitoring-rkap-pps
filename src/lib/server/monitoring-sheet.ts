import type { Job, SourceDetail, SourceMilestone } from './domain.js';
import { STAGES } from './config.js';
import { getMonitoringRange, getMonitoringSpreadsheetId, readSheetValues, type SheetCell, type SheetRows } from './google-sheets.js';


// Nominal keuangan pada workbook lama sengaja tidak ditampilkan di monitoring web.
// Data penyerapan/nominal resmi berasal dari sheet khusus yang disiapkan mentor.
const HIDDEN_FINANCIAL_CODES = new Set(['A17', 'A18', 'A19', 'A28', 'A98']);

const FIELD_LABELS: Record<string, string> = {
  A1: 'No', A2: 'Year', A3: 'PP No.', A4: 'OPEX/CAPEX', A5: 'PIC PPS', A6: 'AUC No.',
  A7: 'Commitment Item (New)', A8: 'Title FC', A9: 'Material/Service Number', A10: 'Budget Item',
  A11: 'Plant', A12: 'Unit', A13: 'Quantity', A14: 'KAK — Receive/Sent', A15: 'KAK — Final',
  A16: 'KAK Number', A17: 'Anggaran RKAP (USD)', A18: 'HPS (USD)', A19: 'Available (USD)',
  A20: 'HPS — Approve Kasi', A21: 'HPS — Approve Kadep', A22: 'HPS — Approve Kadiv', A23: 'HPS — Approve Kagrup', A24: 'HPS — Final Approve',
  A25: 'MO Number', A26: 'PR Number', A27: 'PR Title', A28: 'PR Amount', A29: 'PR — Release by Kasi', A30: 'PR — Release by SBN',
  A31: 'PR — Release by SOM', A32: 'PR — Release by Kasi PPS', A33: 'PR — Release by Kadiv PME', A34: 'PR — Release by Kagrup', A35: 'PR — Final Release',
  A36: 'Metode Pengadaan', A37: 'Release Indicator', A38: 'RFx', A39: 'Tender Briefing — Date TB',
  A40: 'BATB — Created by Staff SOM', A41: 'BATB — Posting by Staff PPS', A42: 'BATB — Approve Kasi PPS', A43: 'BATB — Approve Kadep PPS',
  A44: 'BATB — Approve Kasi SOM', A45: 'BATB — Approve Kadep SOM', A46: 'Quotation — Open', A47: 'Quotation — Received',
  A48: 'Technical Evaluation — Vendor 1 Name', A49: 'Technical Evaluation — Vendor 1 Weight/TE', A50: 'Technical Evaluation — Vendor 1 Price',
  A51: 'Technical Evaluation — Vendor 2 Name', A52: 'Technical Evaluation — Vendor 2 Weight/TE', A53: 'Technical Evaluation — Vendor 2 Price',
  A54: 'Technical Evaluation — Vendor 3 Name', A55: 'Technical Evaluation — Vendor 3 Weight/TE', A56: 'Technical Evaluation — Vendor 3 Price',
  A57: 'Technical Evaluation — Vendor 4 Name', A58: 'Technical Evaluation — Vendor 4 Weight/TE', A59: 'Technical Evaluation — Vendor 4 Price',
  A60: 'Technical Evaluation — Vendor 5 Name', A61: 'Technical Evaluation — Vendor 5 Weight/TE', A62: 'Technical Evaluation — Vendor 5 Price',
  A63: 'Technical Evaluation — Vendor 6 Name', A64: 'Technical Evaluation — Vendor 6 Weight/TE', A65: 'Technical Evaluation — Vendor 6 Price',
  A66: 'Technical Evaluation — Vendor 7 Name', A67: 'Technical Evaluation — Vendor 7 Weight/TE', A68: 'Technical Evaluation — Vendor 7 Price',
  A69: 'Technical Evaluation — Vendor 8 Name', A70: 'Technical Evaluation — Vendor 8 Weight/TE', A71: 'Technical Evaluation — Vendor 8 Price',
  A72: 'Technical Evaluation — Vendor 9 Name', A73: 'Technical Evaluation — Vendor 9 Weight/TE', A74: 'Technical Evaluation — Vendor 9 Price',
  A75: 'Technical Evaluation — Vendor 10 Name', A76: 'Technical Evaluation — Vendor 10 Weight/TE', A77: 'Technical Evaluation — Vendor 10 Price',
  A78: 'Document TE — To SOM', A79: 'Document TE — Posting by Staff PPS', A80: 'Document TE — Approve Kasi PPS',
  A81: 'Document TE — Approve Kadep PPS', A82: 'Document TE — Approve Kadiv PME', A83: 'Document TE — Approve Kadep PME',
  A84: 'Penetapan Pemenang — Receive PPS', A85: 'Penetapan Pemenang — Posting by Staff', A86: 'Penetapan Pemenang — Approve Kasi',
  A87: 'Penetapan Pemenang — Approve Kadep', A88: 'Penetapan Pemenang — Approve Kadiv', A89: 'Penetapan Pemenang — Approve Kagrup',
  A90: 'Draft Contract — Email received from Staff SOM', A91: 'Draft Contract — Confirmation sent to Staff SOM', A92: 'Draft Contract — Hard copy received',
  A93: 'Draft Contract — Paraf Kadep/Kadiv', A94: 'Draft Contract — Sent to SOM', A95: 'Draft Contract — Copy received',
  A96: 'Contract (PO) — Number', A97: 'Contract (PO) — Date', A98: 'Contract (PO) — Amount (IDR)', A99: 'Contract (PO) — Vendor',
  A100: 'Contract — Start Date', A101: 'Contract — Finish Date', A102: 'Metode Bayar', A103: 'Execution — Good Delivery Date',
  A104: 'Execution — Actual Finish Date', A105: 'GR/SES (%)', A106: 'GR/SES — Date', A107: 'Guarantee Duration (Month)', A108: 'Guarantee Expired Date',
  A109: 'Last Progress', A110: 'Detail Progress of Work / Remarks',
  A111: 'Kendala / Root Cause', A112: 'Action Required / Tindak Lanjut', A113: 'PIC Tindak Lanjut',
  A114: 'Deadline Tindak Lanjut', A115: 'Status Tindak Lanjut', A116: 'Jumlah Revisi', A117: 'Tanggal Update Progres',
  A118: 'SCS Status', A119: 'SCS Submission Date', A120: 'SCS Approval Date', A121: 'SCS Remarks'
};

const MILESTONES: { code: string; label: string; stageNo: number }[] = [
  { code: 'A14', label: 'KAK — Receive / Sent', stageNo: 1 },
  { code: 'A15', label: 'KAK — Final', stageNo: 1 },
  { code: 'A20', label: 'HPS — Approval Kasi', stageNo: 3 },
  { code: 'A21', label: 'HPS — Approval Kadep', stageNo: 3 },
  { code: 'A22', label: 'HPS — Approval Kadiv', stageNo: 3 },
  { code: 'A23', label: 'HPS — Approval Kagrup', stageNo: 3 },
  { code: 'A24', label: 'HPS — Final Approve', stageNo: 4 },
  { code: 'A29', label: 'PR — Release by Kasi', stageNo: 5 },
  { code: 'A30', label: 'PR — Release by SBN', stageNo: 5 },
  { code: 'A31', label: 'PR — Release by SOM', stageNo: 5 },
  { code: 'A32', label: 'PR — Release by Kasi PPS', stageNo: 5 },
  { code: 'A33', label: 'PR — Release by Kadiv PME', stageNo: 5 },
  { code: 'A34', label: 'PR — Release by Kagrup', stageNo: 5 },
  { code: 'A35', label: 'PR — Final Release', stageNo: 6 },
  { code: 'A39', label: 'Tender Briefing — Date TB', stageNo: 7 },
  { code: 'A40', label: 'BATB — Created by Staff SOM', stageNo: 7 },
  { code: 'A41', label: 'BATB — Posting by Staff PPS', stageNo: 7 },
  { code: 'A42', label: 'BATB — Approve Kasi PPS', stageNo: 7 },
  { code: 'A43', label: 'BATB — Approve Kadep PPS', stageNo: 7 },
  { code: 'A44', label: 'BATB — Approve Kasi SOM', stageNo: 7 },
  { code: 'A45', label: 'BATB — Approve Kadep SOM', stageNo: 7 },
  { code: 'A46', label: 'Quotation — Open', stageNo: 8 },
  { code: 'A47', label: 'Quotation — Received', stageNo: 8 },
  { code: 'A78', label: 'Document TE — To SOM', stageNo: 9 },
  { code: 'A79', label: 'Document TE — Posting by Staff PPS', stageNo: 10 },
  { code: 'A80', label: 'Document TE — Approve Kasi PPS', stageNo: 10 },
  { code: 'A81', label: 'Document TE — Approve Kadep PPS', stageNo: 10 },
  { code: 'A82', label: 'Document TE — Approve Kadiv PME', stageNo: 10 },
  { code: 'A83', label: 'Document TE — Approve Kadep PME', stageNo: 10 },
  { code: 'A84', label: 'Penetapan Pemenang — Receive PPS', stageNo: 12 },
  { code: 'A85', label: 'Penetapan Pemenang — Posting by Staff', stageNo: 12 },
  { code: 'A86', label: 'Penetapan Pemenang — Approve Kasi', stageNo: 12 },
  { code: 'A87', label: 'Penetapan Pemenang — Approve Kadep', stageNo: 12 },
  { code: 'A88', label: 'Penetapan Pemenang — Approve Kadiv', stageNo: 12 },
  { code: 'A89', label: 'Penetapan Pemenang — Approve Kagrup', stageNo: 12 },
  { code: 'A90', label: 'Draft Contract — Email received from Staff SOM', stageNo: 13 },
  { code: 'A91', label: 'Draft Contract — Confirmation sent to Staff SOM', stageNo: 13 },
  { code: 'A92', label: 'Draft Contract — Hard copy received', stageNo: 13 },
  { code: 'A93', label: 'Draft Contract — Paraf Kadep/Kadiv', stageNo: 13 },
  { code: 'A94', label: 'Draft Contract — Sent to SOM', stageNo: 13 },
  { code: 'A95', label: 'Draft Contract — Copy received', stageNo: 13 },
  { code: 'A97', label: 'Contract (PO) — Contract Date', stageNo: 13 },
  { code: 'A103', label: 'Execution — Good Delivery Date', stageNo: 14 },
  { code: 'A104', label: 'Execution — Actual Finish Date', stageNo: 15 },
  { code: 'A106', label: 'GR/SES — Date', stageNo: 15 }
];

function text(value: SheetCell | undefined): string {
  if (value === undefined || value === null) return '';
  const result = String(value).trim();
  return /^#(?:N\/A|REF!|NAME\?|DIV\/0!|VALUE!|ERROR!?)$/i.test(result) ? '' : result;
}

function normalizePic(value: string): string {
  const key = value.trim().toLowerCase().replace(/[^a-z]/g, '');
  const known: Record<string, string> = { eka: 'Eka', azwil: 'Azwil', irfan: 'Irfan', obed: 'Obed' };
  return known[key] || value.trim() || 'Belum ditentukan';
}

function numeric(value: SheetCell | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let raw = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!raw) return null;

  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    // The right-most separator is treated as the decimal separator.
    const decimalMark = comma > dot ? ',' : '.';
    const thousandsMark = decimalMark === ',' ? '.' : ',';
    raw = raw.split(thousandsMark).join('');
    if (decimalMark === ',') raw = raw.replace(',', '.');
  } else if (comma >= 0) {
    const trailingDigits = raw.length - comma - 1;
    raw = trailingDigits > 0 && trailingDigits <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
  } else if (dot >= 0) {
    const parts = raw.split('.');
    const trailingDigits = parts[parts.length - 1].length;
    if (parts.length > 2) {
      raw = trailingDigits > 0 && trailingDigits <= 2
        ? `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`
        : parts.join('');
    } else if (trailingDigits >= 3) {
      // Common Indonesian formatted integer such as 1.234 or 1.234.567.
      raw = parts.join('');
    }
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}


function date(value: SheetCell | undefined): string {
  if (value === undefined || value === null || value === '') return '';

  // Google Sheets date serial number
  if (typeof value === 'number' && value > 20_000 && value < 80_000) {
    const milliseconds =
      Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000;

    return new Date(milliseconds).toISOString().slice(0, 10);
  }

  const raw = String(value).trim();

  // Format ISO: YYYY-MM-DD
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return makeDate(match[1], match[2], match[3]);

  // Format DD/MM/YYYY or DD-MM-YYYY
  match = raw.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (match) return makeDate(match[3], match[2], match[1]);

  // Format seperti 7-Apr-26, 04-agt-26, 28-Oct-25
  match = raw.match(
    /^(\d{1,2})[\s./-]+([a-zA-ZÀ-ÿ.]+)[\s./-]+(\d{2,4})$/i
  );

  if (match) {
    const months: Record<string, number> = {
      jan: 1,
      januari: 1,
      feb: 2,
      february: 2,
      februari: 2,
      peb: 2,
      mar: 3,
      march: 3,
      maret: 3,
      apr: 4,
      april: 4,
      mei: 5,
      may: 5,
      jun: 6,
      juni: 6,
      june: 6,
      jul: 7,
      juli: 7,
      july: 7,
      aug: 8,
      agu: 8,
      agt: 8,
      agustus: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      okt: 10,
      oktober: 10,
      october: 10,
      nov: 11,
      nop: 11,
      november: 11,
      dec: 12,
      des: 12,
      desember: 12,
      december: 12
    };

    const day = Number(match[1]);
    const monthName = match[2].toLowerCase().replace(/\./g, '');
    const month = months[monthName];
    let year = Number(match[3]);

    if (year < 100) {
      year += year <= 79 ? 2000 : 1900;
    }

    if (month) {
      return makeDate(String(year), String(month), String(day));
    }
  }

  // Fallback untuk format tanggal lain dengan tahun empat digit
  const parsed = Date.parse(raw);

  if (!Number.isNaN(parsed) && /\b\d{4}\b/.test(raw)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return '';
}


function makeDate(year: string, month: string, day: string): string {
  const y = Number(year), m = Number(month), d = Number(day);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function codeIndex(header: SheetCell[]): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((cell, i) => {
    const key = text(cell).toUpperCase();
    if (/^A\d{1,3}$/.test(key)) index.set(key, i);
  });
  return index;
}

function get(row: SheetCell[], index: Map<string, number>, code: string): SheetCell | undefined {
  const i = index.get(code);
  return i === undefined ? undefined : row[i];
}

function sourceProgressNo(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const leading = raw.match(/^\s*(\d{1,2})(?:\s*[.)\-:]|\s+)/);
  if (leading) {
    const number = Number(leading[1]);
    if (number >= 1 && number <= 18) return number;
  }
  const s = raw.toLowerCase();
  if (/cancel|postpone|ditunda/.test(s)) return 16;
  if (/terminated|terminate/.test(s)) return 17;
  if (/retender|re-tender/.test(s)) return 18;
  if (/actual finish|final completion|selesai pekerjaan/.test(s)) return 15;
  if (/good delivery|execution|delivery/.test(s)) return 14;
  if (/contract|draft contract|kontrak|spk/.test(s)) return 13;
  if (/penetapan pemenang|winner/.test(s)) return 12;
  if (/negotiat|negosiasi/.test(s)) return 11;
  if (/technical evaluation|document te|\bte\b/.test(s)) return 9;
  if (/quotation|penawaran/.test(s)) return 8;
  if (/tender briefing|batb/.test(s)) return 7;
  if (/full release|pr final release/.test(s)) return 6;
  if (/\bpr\b|purchase requisition/.test(s)) return 5;
  if (/hps|kak/.test(s)) return 2;
  return null;
}

function pickDate(row: SheetCell[], index: Map<string, number>, codes: string[]): string {
  for (const code of codes) {
    const d = date(get(row, index, code));
    if (d) return d;
  }
  return '';
}

export async function loadMonitoringJobs(force = false): Promise<Job[]> {
  const rows: SheetRows = await readSheetValues(getMonitoringSpreadsheetId(), getMonitoringRange(), { force });
  if (rows.length < 2) throw new Error('Sheet monitoring belum berisi baris kode kolom dan data pekerjaan. Periksa MONITORING_SHEET_RANGE.');
  const columns = codeIndex(rows[0]);
  if (!columns.has('A8') || !columns.has('A5') || !columns.has('A109')) {
    throw new Error('Struktur sheet monitoring tidak cocok: baris awal harus berisi kode kolom A1–A110, termasuk A5, A8, dan A109. Atur MONITORING_SHEET_RANGE mulai dari baris kode kolom.');
  }

  const jobs: Job[] = [];
  for (const [offset, row] of rows.slice(1).entries()) {
    const title = text(get(row, columns, 'A8'));
    const pic = text(get(row, columns, 'A5'));
    const commitmentItem = text(get(row, columns, 'A7'));
    const auc = text(get(row, columns, 'A6'));
    if (!title || /^total\b/i.test(title)) continue;
    const typeRaw = text(get(row, columns, 'A4')).toUpperCase();
    const type = typeRaw.includes('CAPEX') ? 'CAPEX' : typeRaw.includes('OPEX') ? 'OPEX' : null;
    if (!type) continue;

    const sourceMilestones: SourceMilestone[] = MILESTONES.flatMap((item) => {
      const value = text(get(row, columns, item.code));
      if (!value) return [];
      return [{ code: item.code, label: item.label, value, date: date(get(row, columns, item.code)), stageNo: item.stageNo }];
    });
    const datesByKey: Record<string, string> = {
      kakReceived: pickDate(row, columns, ['A14', 'A15']),
      hpsPrepared: pickDate(row, columns, ['A20']),
      hpsApprovalStarted: pickDate(row, columns, ['A21']),
      hpsFinalApproved: pickDate(row, columns, ['A24']),
      prCreated: '',
      prReleased: pickDate(row, columns, ['A35']),
      tenderBriefing: pickDate(row, columns, ['A39']),
      quotationReceived: pickDate(row, columns, ['A47']),
      technicalEvaluation: pickDate(row, columns, ['A78']),
      teSentToSom: pickDate(row, columns, ['A79']),
      // Kolom A83 adalah persetujuan Dokumen TE, bukan tanggal negosiasi.
      negotiation: '',
      winnerSelected: pickDate(row, columns, ['A89']),
      contractSigned: pickDate(row, columns, ['A97']),
      executionStarted: pickDate(row, columns, ['A103'])
    };
    const stages: Record<string, string> = Object.fromEntries(STAGES.map((stage) => [stage.key, datesByKey[stage.key] || '']));
    const allMilestoneDates = sourceMilestones.map((m) => m.date).filter(Boolean).sort();
    const sourceLastProgress = text(get(row, columns, 'A109'));
    const sourceDetails: SourceDetail[] = Array.from(columns.entries())
      .map(([code]) => ({ code, label: FIELD_LABELS[code] || `Kolom ${code}`, value: HIDDEN_FINANCIAL_CODES.has(code) ? '' : text(get(row, columns, code)) }))
      .filter((detail) => detail.value !== '')
      .sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)));
    const sourceProgressNoValue = sourceProgressNo(sourceLastProgress);
    const derivedProgress = sourceMilestones.reduce((highest, item) => Math.max(highest, item.stageNo), 0);
    const sourceLastUpdateDate = date(get(row, columns, 'A117')) || (allMilestoneDates.length ? allMilestoneDates[allMilestoneDates.length - 1] : '');
    const noValue = numeric(get(row, columns, 'A1'));
    const yearValue = numeric(get(row, columns, 'A2'));
    const grSesPercent = numeric(get(row, columns, 'A105'));
    const grSesDate = date(get(row, columns, 'A106'));
    const finishDate = date(get(row, columns, 'A101'));
    const actualFinish = date(get(row, columns, 'A104'));
    const startDate = date(get(row, columns, 'A100'));
    const guaranteeMonths = numeric(get(row, columns, 'A107'));
    const guaranteeUntil = date(get(row, columns, 'A108')) || (actualFinish && guaranteeMonths !== null
      ? new Date(Date.UTC(Number(actualFinish.slice(0, 4)), Number(actualFinish.slice(5, 7)) - 1 + guaranteeMonths, Number(actualFinish.slice(8, 10)))).toISOString().slice(0, 10)
      : '');
    const idKey = commitmentItem || auc || `${noValue ?? offset + 1}`;
    const job: Job = {
      id: `sheet-${idKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
      no: noValue ?? offset + 1,
      year: yearValue ?? 2026,
      title,
      commitmentItem,
      pic: normalizePic(pic),
      type,
      stages,
      vendor: text(get(row, columns, 'A99')),
      // Keuangan tidak diambil dari workbook monitoring lama; sumber resminya sheet penyerapan mentor.
      contractAmountIDR: 0,
      startDate,
      finishDate,
      actualFinish,
      guaranteeUntil,
      paidPercent: 0,
      rkapBudgetUSD: null,
      hpsUSD: 0,
      scsDate: '',
      specialStatus: /cancel|postpone|ditunda/i.test(sourceLastProgress) ? 'cancelled' : /terminated/i.test(sourceLastProgress) ? 'terminated' : /retender/i.test(sourceLastProgress) ? 'retender' : 'normal',
      fieldSources: Object.fromEntries(STAGES.map((stage) => [`stages.${stage.key}`, 'Manual' as const])),
      sourceLastProgress,
      sourceProgressNo: sourceProgressNoValue !== null && sourceProgressNoValue >= 16
        ? sourceProgressNoValue
        : Math.max(sourceProgressNoValue || 0, derivedProgress) || null,
      sourceLastUpdateDate,
      detailProgress: text(get(row, columns, 'A110')),
      sourceMilestones,
      sourceDetails,
      sourceIssue: text(get(row, columns, 'A111')),
      sourceAction: text(get(row, columns, 'A112')),
      sourceFollowUpPic: text(get(row, columns, 'A113')),
      sourceDeadline: date(get(row, columns, 'A114')),
      sourceFollowUpStatus: text(get(row, columns, 'A115')),
      sourceRevisionCount: numeric(get(row, columns, 'A116')),
      sourceScsStatus: text(get(row, columns, 'A118')),
      sourceScsSubmissionDate: date(get(row, columns, 'A119')),
      sourceScsApprovedDate: date(get(row, columns, 'A120')),
      sourceScsRemarks: text(get(row, columns, 'A121')),
      grSesPercent,
      grSesDate
    };
    jobs.push(job);
  }

  if (!jobs.length) throw new Error('Tidak ada baris pekerjaan valid yang ditemukan. Pastikan kolom Year, OPEX/CAPEX, PIC PPS, dan Title FC terisi.');
  return jobs;
}
