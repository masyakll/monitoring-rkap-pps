import ExcelJS from 'exceljs';
import type { Job } from './domain.js';
import { STAGES } from './config.js';

function safeCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\u0000-\u0020]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text;
}

export function parseCsv(text: string): Record<string, string>[] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((v) => v !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

export function exportRows(jobs: Record<string, any>[]) {
  const sourceDetails = jobs.flatMap((job) => Array.isArray(job.sourceDetails) ? job.sourceDetails : []);
  if (sourceDetails.length) {
    const sourceColumns = Array.from(new Map(sourceDetails.map((detail) => [String(detail.code), String(detail.label || detail.code)] as const)).entries())
      .sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)));
    return jobs.map((job) => {
      const row: Record<string, unknown> = {};
      for (const [code, label] of sourceColumns) {
        const detail = (job.sourceDetails || []).find((item: { code: string }) => item.code === code);
        row[`${code} - ${label}`] = detail?.value ?? '';
      }
      Object.assign(row, {
        'Dashboard - Last Progress': job.lastProgressLabel || '',
        'Dashboard - Days Since Progress': job.daysInStage ?? '',
        'Dashboard - Monitoring Status': job.status || '',
        'Dashboard - Detail Progress / Remarks': job.detailProgress || ''
      });
      return row;
    });
  }

  return jobs.map((job) => {
    const row: Record<string, unknown> = {
      no: job.no, year: job.year, type: job.type, pic: job.pic, title: job.title,
      rkapBudgetUSD: job.rkapBudgetUSD, hpsUSD: job.hpsUSD, scsRequired: job.scsRequired ? 'Ya' : 'Tidak',
      scsDate: job.scsDate, scsStatus: job.scsStatus
    };
    for (const stage of STAGES) row[`stage_${stage.key}`] = job.stages?.[stage.key] || '';
    Object.assign(row, {
      vendor: job.vendor, contractAmountIDR: job.contractAmountIDR, startDate: job.startDate,
      finishDate: job.finishDate, actualFinish: job.actualFinish, guaranteeUntil: job.guaranteeUntil,
      paidPercent: job.paidPercent, specialStatus: job.specialStatus, lastProgress: job.lastProgressLabel,
      status: job.status, lateDays: job.lateDays, daysInStage: job.daysInStage ?? '', guaranteeStatus: job.guaranteeStatus
    });
    return row;
  });
}

export function createCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return 'no,year,type,pic,title\r\n';
  const headers = Object.keys(rows[0]);
  const quote = (value: unknown) => `"${safeCell(value).replace(/"/g, '""')}"`;
  return `${headers.map(quote).join(',')}\r\n${rows.map((row) => headers.map((key) => quote(row[key])).join(',')).join('\r\n')}\r\n`;
}

export async function createXlsx(rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Monitoring RKAP PPS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Monitoring RKAP', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = rows.length ? Object.keys(rows[0]) : ['no', 'year', 'type', 'pic', 'title'];
  sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(36, Math.max(14, header.length + 2)) }));
  for (const row of rows) {
    const sanitized: Record<string, unknown> = {};
    for (const header of headers) {
      const value = row[header];
      sanitized[header] = typeof value === 'number' && Number.isFinite(value) ? value : safeCell(value);
    }
    sheet.addRow(sanitized);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function readXlsxRows(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((value) => String(value ?? '').trim());
  const rows: Record<string, string>[] = [];
  for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo++) {
    const row = sheet.getRow(rowNo);
    if (!row.hasValues) continue;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = row.getCell(index + 1).value;
      if (value instanceof Date) record[header] = value.toISOString().slice(0, 10);
      else if (value && typeof value === 'object' && 'text' in value) record[header] = String((value as { text: string }).text);
      else record[header] = value === null || value === undefined ? '' : String(value);
    });
    rows.push(record);
  }
  return rows;
}
