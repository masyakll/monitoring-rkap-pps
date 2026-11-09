<script lang="ts">
  import { onMount } from 'svelte';
  export let user: { username: string; displayName: string; role: 'pic' | 'viewer' | 'admin'; picName: string | null };

  type AnalysisRow = {
    jobId: string; no: number; title: string; pic: string; tipe: 'CAPEX' | 'OPEX';
    lastProgressLabel: string; planUsd: number | null; planSource: string; budgetImportedAt: string | null;
    aktualUsd: number | null; aktualPct: number | null; nilaiKontrakUsd: number | null; nilaiDibayarUsd: number | null;
    prognosaUsd: number | null; prognosaPct: number | null; updateProgres: string; penyebabKategori: string;
    penyebabDetail: string; quickWin: string; grupKategori: string; analysisUpdatedAt: string | null;
    analysisUpdatedBy: string | null;
  };
  type SummaryPart = { summary: { no:number; item:string; qty:number; budgetUsd:number; pct:number }[]; totalPlan:number; totalAktual:number; totalPrognosa:number|null; pctAktual:number|null; pctPrognosa:number|null };
  type Data = { rows: AnalysisRow[]; summary: { capex: SummaryPart; opex: SummaryPart }; causes:{capex:string[]; opex:string[]}; aktualFormulaLabel:string; usdIdrRate:number };
  let data: Data | null = null;
  let loading = true;
  let error = '';
  let saving = false;
  let message = '';
  let editId = '';
  let form = { updateProgres:'', penyebabKategori:'', penyebabDetail:'', quickWin:'' };
  let typeFilter: '' | 'CAPEX' | 'OPEX' = '';
  let query = '';
  let suggestionAccepted = new Set<string>();
  let filtered: AnalysisRow[] = [];
  let capexRows: AnalysisRow[] = [];
  let opexRows: AnalysisRow[] = [];
  let groups: { title: string; rows: AnalysisRow[]; type: 'CAPEX'|'OPEX' }[] = [];
  $: groups = [{ title: 'Data CAPEX', rows: capexRows, type: 'CAPEX' }, { title: 'Data OPEX', rows: opexRows, type: 'OPEX' }];

  const canEdit = (row: AnalysisRow) => user.role === 'admin' || (user.role === 'pic' && user.picName?.toLowerCase() === row.pic.toLowerCase());
  const fmtUSD = (v: number | null | undefined) => v == null ? '—' : new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);
  const fmtPct = (v: number | null | undefined) => v == null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`;
  $: filtered = (data?.rows ?? []).filter((r) => (!typeFilter || r.tipe === typeFilter) && (!query || `${r.title} ${r.pic} ${r.no}`.toLowerCase().includes(query.toLowerCase())));
  $: capexRows = filtered.filter((r) => r.tipe === 'CAPEX');
  $: opexRows = filtered.filter((r) => r.tipe === 'OPEX');
  $: causesForEdit = data?.causes ?? { capex:[], opex:[] };

  onMount(load);
  async function load() {
    loading = true; error = '';
    try { const res = await fetch('/api/analysis', { cache:'no-store' }); const body = await res.json(); if (!res.ok) throw new Error(body.error || 'Data Analisa Penyerapan gagal dimuat.'); data = body; }
    catch (e) { error = e instanceof Error ? e.message : 'Terjadi kesalahan saat memuat data.'; }
    finally { loading = false; }
  }
  async function download(format: 'xlsx'|'csv') {
    message=''; error='';
    try { const res=await fetch(`/api/analysis/export?format=${format}`,{cache:'no-store'}); if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error||'Ekspor gagal.')} const blob=await res.blob(); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=format==='xlsx'?'analisa-penyerapan-rkap.xlsx':'analisa-penyerapan-rkap.csv'; document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url); }
    catch(e){error=e instanceof Error?e.message:'Ekspor gagal.'}
  }
  async function copyForSheets() {
    if(!data) return;
    const headers=['Tipe','No','Pekerjaan','PIC','Plan RKAP USD','Plan %','Aktual GR USD','Aktual GR %','Nilai kontrak USD','Sudah dibayar USD','Prognosa USD','Prognosa %','Last Progress','Update Progres','Penyebab kategori','Penyebab detail','Quick Win','Grup Kategori'];
    const safe=(v:unknown)=>{const value=v==null?'':String(v);return /^[\u0000-\u0020]*[=+\-@\t\r]/.test(value)?`'${value}`:value;};
    const lines=[headers.join('\t'),...filtered.map(r=>[r.tipe,r.no,r.title,r.pic,r.planUsd,r.planUsd==null?'':1,r.aktualUsd,r.aktualPct,r.nilaiKontrakUsd,r.nilaiDibayarUsd,r.prognosaUsd,r.prognosaPct,r.lastProgressLabel,r.updateProgres,r.penyebabKategori,r.penyebabDetail,r.quickWin,r.grupKategori].map(safe).join('\t'))];
    try{await navigator.clipboard.writeText(lines.join('\n'));message='Data yang sesuai filter disalin. Kamu bisa menempelkannya ke Google Sheets.';}catch{message='Browser menolak akses clipboard. Gunakan Unduh CSV sebagai alternatif.';}
  }
  function startEdit(row: AnalysisRow) { editId = row.jobId; form = { updateProgres:row.updateProgres ?? '', penyebabKategori:row.penyebabKategori ?? '', penyebabDetail:row.penyebabDetail ?? '', quickWin:row.quickWin ?? '' }; message=''; }
  function sumNullable(rows: AnalysisRow[], key: 'planUsd'|'aktualUsd'|'nilaiKontrakUsd'|'nilaiDibayarUsd'|'prognosaUsd'): number | null { const vals=rows.map(r=>r[key]).filter((v):v is number=>v!==null&&v!==undefined); return vals.length ? vals.reduce((a,b)=>a+b,0) : null; }
  function completeForecastTotal(rows: AnalysisRow[]): number | null {
    const planned = rows.filter((row) => row.planUsd !== null && row.planUsd > 0);
    if (!planned.length || planned.some((row) => row.prognosaUsd === null)) return null;
    return planned.reduce((sum, row) => sum + (row.prognosaUsd ?? 0), 0);
  }
  function totalPct(rows: AnalysisRow[], key: 'aktualUsd'|'prognosaUsd') {
    const plan=sumNullable(rows,'planUsd');
    const val=key==='prognosaUsd' ? completeForecastTotal(rows) : sumNullable(rows,key);
    return plan && plan>0 && val!==null ? val/plan : null;
  }
  function suggestion(row: AnalysisRow) { return row.nilaiKontrakUsd != null && row.planUsd != null && row.nilaiKontrakUsd < row.planUsd && row.penyebabKategori !== 'Nilai Kontrak < Pagu'; }
  function acceptSuggestion() { form.penyebabKategori = 'Nilai Kontrak < Pagu'; }
  async function save(row: AnalysisRow) {
    saving = true; message='';
    try { const res = await fetch('/api/analysis', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:row.jobId, updateProgres:form.updateProgres, penyebabKategori:form.penyebabKategori, penyebabDetail:form.penyebabDetail, quickWin:form.quickWin }) }); const body=await res.json(); if (!res.ok) throw new Error(body.error || 'Perubahan tidak dapat disimpan.'); editId=''; message='Perubahan tersimpan.'; await load(); }
    catch(e) { message=e instanceof Error ? e.message : 'Gagal menyimpan.'; }
    finally { saving=false; }
  }
</script>

<section class="page-title">
  <div><div class="eyebrow">PENGENDALIAN ANGGARAN</div><h1>Analisa Penyerapan</h1><p>Ringkasan per penyebab dan pemantauan rencana, realisasi GR, serta prognosa pekerjaan.</p></div>
  <div class="page-actions"><button class="btn secondary" on:click={copyForSheets} disabled={!data}>Salin untuk Google Sheets</button><button class="btn secondary" on:click={()=>download('csv')}>Unduh CSV</button><button class="btn primary" on:click={()=>download('xlsx')}>Unduh Excel</button><button class="btn outline" on:click={load} disabled={loading}>Muat ulang</button></div>
</section>
<div class="notice"><strong>Rumus sementara:</strong> Aktual menggunakan nilai realisasi Goods Receipt (GR) yang diimpor. Nilai kontrak dan pembayaran ditampilkan sebagai pembanding. Konfirmasi definisi Aktual kepada mentor sebelum dipakai untuk pelaporan resmi.</div>
{#if error}<div class="alert error-alert" role="alert">{error}</div>{/if}
{#if message}<div class="alert" role="status">{message}</div>{/if}
{#if loading}<div class="panel empty">Memuat Analisa Penyerapan…</div>
{:else if data}
  <div class="metric-grid">
    <article class="metric"><span>Plan CAPEX</span><strong>{fmtUSD(data.summary.capex.totalPlan)}</strong><small>Anggaran hasil impor</small></article>
    <article class="metric"><span>Aktual CAPEX</span><strong>{fmtUSD(data.summary.capex.totalAktual)}</strong><small>{fmtPct(data.summary.capex.pctAktual)} dari Plan</small></article>
    <article class="metric"><span>Plan OPEX</span><strong>{fmtUSD(data.summary.opex.totalPlan)}</strong><small>Anggaran hasil impor</small></article>
    <article class="metric"><span>Aktual OPEX</span><strong>{fmtUSD(data.summary.opex.totalAktual)}</strong><small>{fmtPct(data.summary.opex.pctAktual)} dari Plan</small></article>
  </div>
  <div class="summary-grid">
    <section class="panel"><div class="panel-head"><div><h2>Summary Executive · CAPEX</h2><p>Penyebab tidak terserap berdasarkan kategori yang dipilih.</p></div></div>
      <div class="table-scroll"><table><thead><tr><th>No</th><th>Item penyebab</th><th class="num">Qty</th><th class="num">Budget (USD)</th><th class="num">Persentase</th></tr></thead><tbody>
        {#each data.summary.capex.summary as row}<tr><td>{row.no}</td><td>{row.item}</td><td class="num">{row.qty}</td><td class="num">{fmtUSD(row.budgetUsd)}</td><td class="num">{fmtPct(row.pct)}</td></tr>{/each}
        <tr class="total"><td colspan="2">Total</td><td class="num">{data.summary.capex.summary.reduce((s,r)=>s+r.qty,0)}</td><td class="num">{fmtUSD(data.summary.capex.summary.reduce((s,r)=>s+r.budgetUsd,0))}</td><td class="num">{fmtPct(data.summary.capex.summary.reduce((s,r)=>s+r.pct,0))}</td></tr>
      </tbody></table></div>
    </section>
    <section class="panel"><div class="panel-head"><div><h2>Summary Executive · OPEX</h2><p>Penyebab tidak terserap berdasarkan kategori yang dipilih.</p></div></div>
      <div class="table-scroll"><table><thead><tr><th>No</th><th>Item penyebab</th><th class="num">Qty</th><th class="num">Budget (USD)</th><th class="num">Persentase</th></tr></thead><tbody>
        {#each data.summary.opex.summary as row}<tr><td>{row.no}</td><td>{row.item}</td><td class="num">{row.qty}</td><td class="num">{fmtUSD(row.budgetUsd)}</td><td class="num">{fmtPct(row.pct)}</td></tr>{/each}
        <tr class="total"><td colspan="2">Total</td><td class="num">{data.summary.opex.summary.reduce((s,r)=>s+r.qty,0)}</td><td class="num">{fmtUSD(data.summary.opex.summary.reduce((s,r)=>s+r.budgetUsd,0))}</td><td class="num">{fmtPct(data.summary.opex.summary.reduce((s,r)=>s+r.pct,0))}</td></tr>
      </tbody></table></div>
    </section>
  </div>
  {#each groups as group}
    <section class="panel detail-panel"><div class="panel-head"><div><h2>{group.title}</h2><p>Last Progress dihitung otomatis dari tanggal tahap. Plan dan Aktual bersumber dari data impor; Prognosa berasal dari snapshot terkunci.</p></div><span class="source-tag">{group.rows.length} pekerjaan</span></div>
      <div class="table-tools"><input class="search" bind:value={query} placeholder="Cari pekerjaan atau PIC…" aria-label="Cari pekerjaan"/><span class="source-tag">Rumus Aktual sementara: GR · nilai kontrak/pembayaran sebagai pembanding</span></div>
      <div class="table-scroll"><table class="analysis-table"><thead><tr><th rowspan="2">Item / Pekerjaan</th><th colspan="2">Plan RKAP</th><th colspan="2">Aktual · GR</th><th colspan="2">Prognosa s.d. Des</th><th rowspan="2">Last Progress</th><th rowspan="2">Update / Penyebab / Quick Win</th><th rowspan="2">PIC</th><th rowspan="2">Aksi</th></tr><tr><th class="num">USD</th><th class="num">%</th><th class="num">USD</th><th class="num">%</th><th class="num">USD</th><th class="num">%</th></tr></thead><tbody>
        {#each group.rows as row}
          <tr><td class="job-title"><strong>{row.title}</strong><small>No. {row.no} · {row.tipe}</small><small>Sumber Plan: {row.planSource}</small>{#if row.budgetImportedAt}<small>Impor terakhir: {new Date(row.budgetImportedAt).toLocaleDateString('id-ID')}</small>{/if}</td>
            <td class="num">{fmtUSD(row.planUsd)}</td><td class="num">{row.planUsd == null ? '—' : '100,0%'}</td>
            <td class="num">{fmtUSD(row.aktualUsd)}</td><td class="num">{fmtPct(row.aktualPct)}</td>
            <td class="num">{fmtUSD(row.prognosaUsd)}</td><td class="num">{fmtPct(row.prognosaPct)}</td>
            <td class="progress-label">{row.lastProgressLabel || '—'}</td>
            <td class="free-text"><span>{row.updateProgres || 'Belum ada update'}</span><small>{row.penyebabKategori || 'Penyebab belum dipilih'}</small>{#if row.penyebabDetail}<small>{row.penyebabDetail}</small>{/if}{#if row.quickWin}<small>Quick Win: {row.quickWin}</small>{/if}
              {#if suggestion(row)}<div class="suggestion">Saran tersedia: nilai kontrak di bawah pagu.</div>{/if}</td>
            <td>{row.pic}</td><td>{#if canEdit(row)}<button class="btn secondary small" on:click={() => startEdit(row)}>{editId===row.jobId?'Sedang diedit':'Ubah catatan'}</button>{:else}<span class="readonly">Baca saja</span>{/if}</td></tr>
          {#if editId === row.jobId}<tr class="edit-row"><td colspan="11"><div class="edit-grid"><label>Update Progres<textarea rows="2" maxlength="1000" bind:value={form.updateProgres}></textarea></label><label>Penyebab kategori<select bind:value={form.penyebabKategori}><option value="">Pilih penyebab</option>{#each (row.tipe==='CAPEX'?causesForEdit.capex:causesForEdit.opex) as cause}<option value={cause}>{cause}</option>{/each}</select></label><label>Penyebab detail<textarea rows="2" maxlength="1000" bind:value={form.penyebabDetail}></textarea></label><label>Quick Win<textarea rows="2" maxlength="1000" bind:value={form.quickWin}></textarea></label></div>
            {#if suggestion(row) && form.penyebabKategori !== 'Nilai Kontrak < Pagu'}<button class="btn link small" on:click={acceptSuggestion}>Terima saran: Nilai Kontrak &lt; Pagu</button>{/if}
            <div class="edit-actions"><button class="btn secondary" on:click={()=>editId=''}>Batal</button><button class="btn primary" on:click={()=>save(row)} disabled={saving}>{saving?'Menyimpan…':'Simpan perubahan'}</button></div></td></tr>{/if}
        {/each}
        <tr class="total"><td>Total {group.type}</td><td class="num">{fmtUSD(sumNullable(group.rows,'planUsd'))}</td><td class="num">{group.rows.some(r=>r.planUsd!=null)?'100,0%':'—'}</td><td class="num">{fmtUSD(sumNullable(group.rows,'aktualUsd'))}</td><td class="num">{fmtPct(totalPct(group.rows,'aktualUsd'))}</td><td class="num">{fmtUSD(completeForecastTotal(group.rows))}</td><td class="num">{fmtPct(totalPct(group.rows,'prognosaUsd'))}</td><td colspan="4">Nilai kontrak: {fmtUSD(sumNullable(group.rows,'nilaiKontrakUsd'))} · Sudah dibayar: {fmtUSD(sumNullable(group.rows,'nilaiDibayarUsd'))}</td></tr>
        {#if !group.rows.length}<tr><td colspan="11" class="empty">Belum ada pekerjaan pada bagian ini.</td></tr>{/if}
      </tbody></table></div>
    </section>
  {/each}
  <p class="footnote">Nilai dibayar dan nilai kontrak tersedia di detail pekerjaan untuk pembanding. Rincian aktual dipengaruhi hasil impor GR terakhir; baris tidak cocok dapat diperiksa melalui menu Rekonsiliasi.</p>
{/if}

<style>
  .page-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.25rem; margin: 0 0 1.25rem; }
  .page-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
  .page-title h1 { margin: 0.15rem 0 0.35rem; font-size: 1.65rem; font-weight: 700; color: #111111; letter-spacing: -0.025em; }
  .page-title p, .panel-head p { margin: 0.25rem 0 0; color: #5a5f67; font-size: 0.88rem; }
  .eyebrow { font-size: 0.72rem; letter-spacing: 0.08em; font-weight: 700; color: #5a5f67; text-transform: uppercase; }
  .notice { padding: 0.9rem 1rem; border: 1px solid #e5e7eb; border-left: 3px solid #111111; background: #f8f9fa; border-radius: 8px; color: #333333; margin: 0 0 1rem; line-height: 1.5; font-size: 0.88rem; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
  .metric { padding: 1rem 1.1rem; border: 1px solid #eaeaea; background: #fff; border-radius: 12px; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .metric span, .metric small { display: block; color: #5a5f67; font-size: 0.78rem; }
  .metric strong { display: block; margin: 0.45rem 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.025em; color: #111111; font-variant-numeric: tabular-nums; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  .panel { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.1rem; border-bottom: 1px solid #eaeaea; }
  .panel-head h2 { margin: 0; font-size: 1rem; color: #111111; font-weight: 700; }
  .table-scroll { overflow: auto; max-width: 100%; }
  table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
  th { background: #f8f9fa; color: #5a5f67; font-weight: 700; text-align: left; white-space: nowrap; }
  th, td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 0; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .total td { background: #f8f9fa; font-weight: 700; color: #111111; }
  .table-tools { display: flex; justify-content: space-between; gap: 0.6rem; padding: 0.8rem 1rem; border-bottom: 1px solid #eaeaea; }
  .search, select, textarea { font: inherit; border: 1px solid #d8dbe0; border-radius: 8px; background: #fff; padding: 0.55rem 0.65rem; color: #111111; }
  .search { min-width: 220px; width: min(100%, 420px); }
  .source-tag { color: #5a5f67; font-size: 0.76rem; white-space: nowrap; }
  .job-title { min-width: 230px; max-width: 300px; }
  .job-title strong, .job-title small { display: block; }
  .job-title strong { color: #111111; font-weight: 600; line-height: 1.4; }
  .job-title small { margin-top: 0.2rem; color: #8c929c; font-size: 0.75rem; }
  .analysis-table { min-width: 1300px; }
  .progress-label { min-width: 170px; max-width: 220px; color: #333333; line-height: 1.4; }
  .free-text { min-width: 240px; max-width: 360px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .free-text span, .free-text small { display: block; }
  .free-text small { margin-top: 0.25rem; color: #5a5f67; white-space: pre-wrap; }
  .suggestion { margin-top: 0.35rem; font-size: 0.75rem; color: #b45309; }
  .readonly { color: #8c929c; font-size: 0.75rem; }
  .edit-row td { background: #f8f9fa; padding: 1rem; }
  .edit-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 0.75rem; }
  .edit-grid label { display: flex; flex-direction: column; gap: 0.35rem; color: #333333; font-size: 0.78rem; font-weight: 600; }
  .edit-grid textarea { width: 100%; resize: vertical; font-weight: 400; border-radius: 6px; }
  .edit-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
  .btn { font: inherit; font-size: 0.82rem; font-weight: 600; border-radius: 8px; padding: 0.55rem 0.85rem; cursor: pointer; border: 1px solid transparent; transition: all 0.16s ease; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn.primary { background: #111111; color: #fff; }
  .btn.primary:hover:not(:disabled) { background: #23252b; }
  .btn.secondary { background: #fff; border-color: #d8dbe0; color: #111111; }
  .btn.secondary:hover:not(:disabled) { background: #f8f9fa; }
  .btn.link { background: transparent; color: #2563eb; padding: 0.45rem 0; }
  .btn.small { padding: 0.4rem 0.6rem; font-size: 0.76rem; border-radius: 6px; }
  .alert { padding: 0.7rem 0.85rem; border-radius: 8px; border: 1px solid #d8dbe0; background: #f8f9fa; margin: 0.75rem 0; color: #111111; }
  .alert.error-alert { border-color: #fecaca; color: #dc2626; background: #fef2f2; }
  .empty { padding: 1.5rem; text-align: center; color: #8c929c; }
  .footnote { font-size: 0.78rem; color: #8c929c; line-height: 1.5; margin: 0.75rem 0 0; }
  @media (max-width: 1050px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .summary-grid { grid-template-columns: 1fr; } .edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .page-title { flex-direction: column; } .page-actions { justify-content: flex-start; } .metric-grid { grid-template-columns: 1fr 1fr; } .metric strong { font-size: 1.2rem; } .table-tools { flex-direction: column; } .search { width: 100%; min-width: 0; } .edit-grid { grid-template-columns: 1fr; } .panel-head { flex-direction: column; } }
</style>
