import ExcelJS from 'exceljs';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireLogin } from '$lib/server/security.js';
import { buildAnalysisPayload } from '$lib/server/analysis-service.js';
import { createCsv } from '$lib/server/exports.js';

function safeText(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /^[\u0000-\u0020]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
const usd = (value: number | null | undefined) => value == null ? '' : value;

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const format = event.url.searchParams.get('format') || 'xlsx';
  if (!['xlsx', 'csv'].includes(format)) return json({ error: 'Format ekspor tidak didukung.' }, { status: 400 });
  const payload = await buildAnalysisPayload();
  const rows = payload.rows.map((row) => ({
    Tipe: row.tipe, No: row.no, Pekerjaan: row.title, PIC: row.pic,
    'Plan RKAP USD': usd(row.planUsd), 'Plan RKAP %': row.planUsd == null ? '' : 1,
    'Aktual GR USD': usd(row.aktualUsd), 'Aktual GR %': usd(row.aktualPct),
    'Nilai kontrak USD': usd(row.nilaiKontrakUsd), 'Sudah dibayar USD': usd(row.nilaiDibayarUsd),
    'Prognosa s.d. Des USD': usd(row.prognosaUsd), 'Prognosa %': usd(row.prognosaPct),
    'Last Progress': row.lastProgressLabel, 'Update Progres': row.updateProgres,
    'Penyebab kategori': row.penyebabKategori, 'Penyebab detail': row.penyebabDetail,
    'Quick Win': row.quickWin, 'Grup Kategori': row.grupKategori,
  }));
  if (format === 'csv') {
    return new Response('\uFEFF' + createCsv(rows), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="analisa-penyerapan-rkap.csv"', 'Cache-Control': 'no-store' },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Monitoring RKAP PPS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Analisa Penyerapan', { views: [{ state: 'frozen', ySplit: 5, xSplit: 0 }] });
  sheet.columns = [
    { width: 6 }, { width: 34 }, { width: 10 }, { width: 18 }, { width: 14 }, { width: 3 },
    { width: 34 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 12 },
    { width: 30 }, { width: 34 }, { width: 30 }, { width: 30 }, { width: 24 }, { width: 14 }, { width: 12 }, { width: 12 },
  ];
  sheet.mergeCells('A1:U1');
  sheet.getCell('A1').value = 'ANALISA PENYERAPAN RKAP 2026';
  sheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E3A' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 27;
  sheet.mergeCells('A2:U2');
  sheet.getCell('A2').value = `Aktual = realisasi GR (rumus sementara) · Kurs acuan ${payload.usdIdrRate.toLocaleString('id-ID')} IDR/USD · Prognosa berasal dari snapshot terkunci`;
  sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF5E6E62' } };
  sheet.getRow(2).height = 21;

  const setGroup = (range: string, label: string) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]); cell.value = label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E3A' } };
    cell.alignment = { vertical: 'middle' };
  };
  const setHeader = (rowNum: number, startCol: number, headers: string[]) => {
    const row = sheet.getRow(rowNum);
    headers.forEach((h, idx) => { const c = row.getCell(startCol + idx); c.value = h; c.font = { bold: true, color: { argb: 'FF2F4938' }, size: 9 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0EB' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
    row.height = 30;
  };
  const borders = { bottom: { style: 'thin' as const, color: { argb: 'FFDDE5DE' } } };
  function addSummary(startRow: number, title: string, items: typeof payload.summary.capex.summary) {
    setGroup(`A${startRow}:E${startRow}`, title);
    setHeader(startRow + 1, 1, ['No', 'Item penyebab', 'Qty', 'Budget (USD)', 'Persentase']);
    let rowNo = startRow + 2;
    for (const item of items) {
      const row = sheet.getRow(rowNo++);
      row.values = [item.no, safeText(item.item), item.qty, item.budgetUsd, item.pct];
      row.eachCell((c) => { c.border = borders; c.font = { size: 9 }; });
      row.getCell(4).numFmt = '$#,##0;[Red]($#,##0);-'; row.getCell(5).numFmt = '0.0%';
    }
    const row = sheet.getRow(rowNo);
    row.values = ['Total', '', items.reduce((s, x) => s + x.qty, 0), items.reduce((s, x) => s + x.budgetUsd, 0), items.reduce((s, x) => s + x.pct, 0)];
    row.font = { bold: true, size: 9 }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6F3' } };
    row.getCell(4).numFmt = '$#,##0;[Red]($#,##0);-'; row.getCell(5).numFmt = '0.0%';
  }
  addSummary(4, 'SUMMARY EXECUTIVE · CAPEX', payload.summary.capex.summary);
  addSummary(12, 'SUMMARY EXECUTIVE · OPEX', payload.summary.opex.summary);

  const dataHeaders = ['Item / Pekerjaan', 'Plan RKAP USD', 'Plan %', 'Aktual GR USD', 'Aktual %', 'Prognosa s.d. Des USD', 'Prognosa %', 'Last Progress', 'Update Progres', 'Penyebab kategori', 'Penyebab detail', 'Quick Win', 'Grup Kategori', 'PIC', 'Tipe'];
  const writeDataGroup = (startRow: number, title: string, sourceRows: typeof payload.rows) => {
    setGroup(`G${startRow}:U${startRow}`, title);
    setHeader(startRow + 1, 7, dataHeaders);
    let rowNo = startRow + 2;
    for (const item of sourceRows) {
      const row = sheet.getRow(rowNo++);
      const cells = [safeText(item.title), usd(item.planUsd), item.planUsd == null ? null : 1, usd(item.aktualUsd), usd(item.aktualPct), usd(item.prognosaUsd), usd(item.prognosaPct), safeText(item.lastProgressLabel), safeText(item.updateProgres), safeText(item.penyebabKategori), safeText(item.penyebabDetail), safeText(item.quickWin), safeText(item.grupKategori), safeText(item.pic), safeText(item.tipe)];
      cells.forEach((v, i) => { row.getCell(7 + i).value = v; row.getCell(7 + i).border = borders; row.getCell(7 + i).font = { size: 9 }; row.getCell(7 + i).alignment = { vertical: 'top', wrapText: true }; });
      for (const col of [8, 10, 12]) row.getCell(col).numFmt = '$#,##0;[Red]($#,##0);-';
      for (const col of [9, 11, 13]) row.getCell(col).numFmt = '0.0%';
      if (rowNo % 2 === 0) for (let c = 7; c <= 21; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFCFA' } };
    }
    const totalRow = sheet.getRow(rowNo);
    const sumKnown = (key: 'planUsd'|'aktualUsd'|'prognosaUsd') => { const vals=sourceRows.map(r=>r[key]).filter((v):v is number=>v!==null&&v!==undefined); return vals.length ? vals.reduce((a,b)=>a+b,0) : null; };
    const plan = sumKnown('planUsd'); const aktual=sumKnown('aktualUsd'); const prognosa=sumKnown('prognosaUsd');
    const vals: unknown[] = [`Total ${title.replace('DATA ','')}`, plan, plan == null ? null : 1, aktual, plan && aktual != null ? aktual/plan : null, prognosa, plan && prognosa != null ? prognosa/plan : null, '', '', '', '', '', '', '', ''];
    vals.forEach((v,i)=>{const c=totalRow.getCell(7+i);c.value=v as ExcelJS.CellValue;c.font={bold:true,size:9};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5F1'}};c.border=borders;});
    for (const col of [8,10,12]) totalRow.getCell(col).numFmt = '$#,##0;[Red]($#,##0);-';
    for (const col of [9,11,13]) totalRow.getCell(col).numFmt = '0.0%';
  };
  writeDataGroup(4, 'DATA CAPEX', payload.rows.filter(r => r.tipe === 'CAPEX'));
  writeDataGroup(Math.max(14, payload.rows.filter(r => r.tipe === 'CAPEX').length + 9), 'DATA OPEX', payload.rows.filter(r => r.tipe === 'OPEX'));
  sheet.autoFilter = { from: { row: 5, column: 7 }, to: { row: Math.max(5, sheet.rowCount), column: 21 } };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="analisa-penyerapan-rkap.xlsx"', 'Cache-Control': 'no-store' } });
};
