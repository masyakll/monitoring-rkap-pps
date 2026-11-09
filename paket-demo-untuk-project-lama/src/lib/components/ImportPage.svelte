<script lang="ts">
  export let user: { role: 'pic' | 'viewer' | 'admin' };
  export let onImported: () => void | Promise<void> = () => {};
  type ImportType = 'budget' | 'gr';
  let importType: ImportType = 'budget';
  let fileInput: HTMLInputElement;
  let fileName = '';
  let preview: any = null;
  let loading = false;
  let error = '';
  let success = '';
  let step: 'upload' | 'preview' = 'upload';
  const typeLabel = () => importType === 'budget' ? 'Anggaran RKAP' : 'GR Capex Opex';
  const countFormat = (n: number | null | undefined) => new Intl.NumberFormat('id-ID').format(n ?? 0);
  function reset() { preview=null; error=''; success=''; step='upload'; fileName=''; if(fileInput) fileInput.value=''; }
  async function previewFile() {
    const file = fileInput?.files?.[0];
    if (!file) { error='Pilih file CSV atau XLSX terlebih dahulu.'; return; }
    if (file.size > 5 * 1024 * 1024) { error='Ukuran file maksimal 5 MB.'; return; }
    if (!/\.(csv|xlsx)$/i.test(file.name) || /\.(xlsm|xlsb)$/i.test(file.name)) { error='Format yang didukung hanya CSV dan XLSX.'; return; }
    loading=true; error=''; success=''; fileName=file.name;
    try { const form=new FormData(); form.set('file',file); const path=importType==='budget'?'/api/budget?preview=1':'/api/gr?preview=1'; const res=await fetch(path,{method:'POST',body:form}); const body=await res.json(); if(!res.ok) throw new Error(body.error||'Pratinjau gagal.'); preview=body; step='preview'; }
    catch(e) { error=e instanceof Error?e.message:'Tidak dapat membaca file.'; }
    finally { loading=false; }
  }
  async function saveImport() {
    const file=fileInput?.files?.[0]; if(!file){error='Pilih ulang file yang akan disimpan.';step='upload';return;}
    loading=true;error='';
    try { const form=new FormData();form.set('file',file);const path=importType==='budget'?'/api/budget':'/api/gr';const res=await fetch(path,{method:'POST',body:form});const body=await res.json();if(!res.ok)throw new Error(body.error||'Impor tidak berhasil.');success=body.message||'Impor berhasil disimpan.';preview=null;step='upload';fileInput.value='';fileName='';await onImported(); }
    catch(e){error=e instanceof Error?e.message:'Impor gagal.'}
    finally{loading=false}
  }
</script>

<section class="page-title"><div><div class="eyebrow">PENGELOLAAN SUMBER DATA</div><h1>Impor Data</h1><p>Unggah hasil ekspor yang disetujui, periksa pratinjau, lalu konfirmasi penyimpanan.</p></div><span class="access-tag">Akses admin / mentor</span></section>
{#if user.role === 'pic'}<div class="notice error">Menu ini hanya tersedia untuk akun admin/mentor. Permintaan impor PIC juga ditolak oleh server.</div>
{:else}
  <div class="notice"><strong>Data internal:</strong> pilih hanya file yang telah diekspor sesuai prosedur perusahaan. File diproses di server dan tidak ditampilkan sebagai tautan publik. Batas ukuran 5 MB; format XLSX/CSV saja.</div>
  {#if error}<div class="alert error" role="alert">{error}</div>{/if}
  {#if success}<div class="alert success" role="status">{success}</div>{/if}
  <section class="panel import-card"><div class="panel-head"><div><h2>1. Pilih sumber dan file</h2><p>Data yang diimpor diperbarui berdasarkan kunci Commitment Item atau pencocokan pekerjaan.</p></div></div>
    <div class="form-area"><label>Jenis data<select bind:value={importType} on:change={reset} disabled={loading}><option value="budget">Section Budget RKAP 2026 — Plan RKAP</option><option value="gr">GR Capex Opex — Aktual GR dan data bulanan</option></select></label>
      <label>File CSV atau XLSX<input bind:this={fileInput} type="file" accept=".csv,.xlsx" on:change={() => { preview=null; error=''; success=''; fileName=fileInput?.files?.[0]?.name ?? ''; step='upload'; }} disabled={loading}/><small>Nama file: {fileName || 'Belum ada file dipilih'}</small></label>
      <div class="actions"><button class="btn primary" on:click={previewFile} disabled={loading}>{loading?'Memproses…':'Pratinjau file'}</button>{#if step==='preview'}<button class="btn secondary" on:click={reset} disabled={loading}>Batal / pilih file lain</button>{/if}</div>
    </div>
  </section>
  <section class="import-guide" aria-label="Panduan alur impor">
    <div class="import-guide-heading">
      <div><span class="guide-kicker">PANDUAN SUMBER DATA</span><h2>Pastikan jenis file sesuai dengan data yang akan diperbarui</h2><p>RKAP dan Goods Receipt memiliki fungsi berbeda. Pilih sumber yang benar agar angka rencana dan realisasi tidak tertukar.</p></div>
    </div>
    <div class="import-guide-grid">
      <article class="import-guide-card budget-guide">
        <span class="guide-number">01 · RENCANA ANGGARAN</span>
        <h3>Section Budget RKAP 2026</h3>
        <p>Memperbarui <strong>Plan RKAP</strong> pada Analisa Penyerapan. Nilai ini menjadi dasar anggaran rencana, bukan realisasi barang diterima.</p>
        <span class="guide-result">Tujuan: Plan RKAP</span>
      </article>
      <article class="import-guide-card gr-guide">
        <span class="guide-number">02 · REALISASI BARANG</span>
        <h3>GR Capex Opex</h3>
        <p>Memperbarui <strong>Aktual</strong> berdasarkan Goods Receipt. Nilai kontrak dan pembayaran tetap menjadi indikator pembanding, bukan pengganti Aktual.</p>
        <span class="guide-result">Tujuan: Aktual GR</span>
      </article>
    </div>
    <div class="import-match-note">
      <strong>Cara pencocokan pekerjaan</strong>
      <p>Commitment Item yang sama persis akan dicocokkan otomatis. Jika sistem hanya menemukan kemiripan nama atau deskripsi, data masuk ke <strong>Rekonsiliasi</strong> dengan status menunggu konfirmasi. Periksa hasilnya sebelum menganggap anggaran sudah terhubung ke pekerjaan.</p>
    </div>
    <p class="import-source-note"><strong>Catatan:</strong> Form ini saat ini menerima sumber RKAP dan GR. Data induk pekerjaan dibaca dari sumber master yang dikonfigurasi pada project; form ini tidak mengimpor master pekerjaan.</p>
  </section>
  {#if preview && step==='preview'}
    <section class="panel"><div class="panel-head"><div><h2>2. Periksa pratinjau</h2><p>Belum ada data yang disimpan. Pastikan header, kurs, pemetaan, dan sampel baris sudah sesuai.</p></div><span class="state-tag">Dry-run</span></div>
      {#if preview.matchSummary}
        <div class="match-summary" aria-label="Ringkasan pencocokan pekerjaan">
          <div><span class="match-dot confirmed"></span><span>Cocok otomatis</span><strong>{countFormat(preview.matchSummary.confirmed)}</strong></div>
          <div><span class="match-dot pending"></span><span>Perlu rekonsiliasi</span><strong>{countFormat(preview.matchSummary.pending)}</strong></div>
          <div><span class="match-dot unmatched"></span><span>Belum cocok</span><strong>{countFormat(preview.matchSummary.unmatched)}</strong></div>
        </div>
      {/if}
      <div class="preview-metrics"><div><span>Nama sheet</span><strong>{preview.sheetName || 'CSV / default'}</strong></div><div><span>Kurs USD/IDR</span><strong>{countFormat(preview.usdIdrRate)}</strong></div><div><span>Baris dikenali</span><strong>{countFormat(preview.rowCount)}</strong></div><div><span>Data baru</span><strong>{countFormat(preview.newCount)}</strong></div><div><span>Diperbarui</span><strong>{countFormat(preview.updatedCount)}</strong></div><div><span>Dilewati</span><strong>{countFormat(preview.skippedCount)}</strong></div><div><span>Kesalahan</span><strong>{countFormat(preview.errorCount)}</strong></div></div>
      <div class="section-content"><h3>Informasi pembacaan</h3><div class="map-grid"><div><span>Baris header terdeteksi</span><strong>{preview.headerRows?.length ? preview.headerRows.join(', ') : 'Tidak terdeteksi'}</strong></div><div><span>Divisi</span><strong>{preview.metadata?.divisi || '—'}</strong></div><div><span>Fund Center</span><strong>{preview.metadata?.fundCenter || '—'}</strong></div></div></div>
      {#if preview.columns?.length}<div class="section-content"><h3>Kolom hasil perataan header</h3><div class="chips">{#each preview.columns as col}<span>{col}</span>{/each}</div></div>{/if}
      {#if preview.skippedRows?.length}<div class="section-content"><h3>Baris yang dilewati</h3><ul class="warning-list">{#each preview.skippedRows as skipped}<li>Baris {skipped.rowIndex}: {skipped.reason}</li>{/each}</ul></div>{/if}
      {#if preview.mappedColumns}<div class="section-content"><h3>Hasil pemetaan otomatis</h3><div class="map-grid">{#each Object.entries(preview.mappedColumns) as pair}<div><span>{pair[0]}</span><strong>{String(pair[1] ?? '—')}</strong></div>{/each}</div></div>{/if}
      {#if preview.sampleRows?.length}<div class="section-content"><h3>Contoh hingga 20 baris pertama</h3><div class="table-scroll"><table><thead><tr>{#each Object.keys(preview.sampleRows[0]) as key}<th>{key}</th>{/each}</tr></thead><tbody>{#each preview.sampleRows as row}<tr>{#each Object.keys(preview.sampleRows[0]) as key}<td>{String(row[key] ?? '—')}</td>{/each}</tr>{/each}</tbody></table></div></div>{/if}
      {#if preview.warnings?.length}<div class="section-content"><h3>Peringatan dan baris yang dilewati</h3><ul class="warning-list">{#each preview.warnings as warning}<li>{warning}</li>{/each}</ul></div>{/if}
      {#if preview.errorCount > 0}<div class="notice error">Periksa error sebelum menyimpan. Baris yang bermasalah tidak boleh diabaikan tanpa ditinjau.</div>{/if}
      <div class="bottom-actions"><button class="btn secondary" on:click={reset} disabled={loading}>Batal</button><button class="btn primary" on:click={saveImport} disabled={loading || (preview.errorCount>0 && preview.rowCount===0)}>{loading?'Menyimpan…':'Simpan hasil impor'}</button></div>
    </section>
  {/if}
{/if}

<style>
  .page-title { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.2rem; gap: 1rem; }
  .page-title h1 { margin: 0.15rem 0 0.35rem; font-size: 1.65rem; font-weight: 700; color: #111111; letter-spacing: -0.025em; }
  .page-title p, .panel-head p { margin: 0.25rem 0 0; color: #5a5f67; font-size: 0.88rem; }
  .eyebrow { font-size: 0.72rem; letter-spacing: 0.08em; font-weight: 700; color: #5a5f67; text-transform: uppercase; }
  .access-tag, .state-tag { font-size: 0.75rem; border: 1px solid #d8dbe0; background: #f8f9fa; color: #333333; padding: 0.35rem 0.6rem; border-radius: 6px; white-space: nowrap; font-weight: 600; }
  .notice { padding: 0.9rem 1rem; border: 1px solid #e5e7eb; border-left: 3px solid #111111; background: #f8f9fa; border-radius: 8px; color: #333333; margin: 0 0 1rem; line-height: 1.5; font-size: 0.88rem; }
  .notice.error { border-color: #fecaca; border-left-color: #dc2626; background: #fef2f2; color: #991b1b; }
  .panel { background: #fff; border: 1px solid #eaeaea; border-radius: 12px; margin-bottom: 1rem; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.1rem; border-bottom: 1px solid #eaeaea; }
  .panel-head h2 { margin: 0; font-size: 1rem; color: #111111; font-weight: 700; }
  .form-area { padding: 1.1rem; display: grid; grid-template-columns: minmax(220px, 0.7fr) minmax(280px, 1.3fr); gap: 1rem; align-items: end; }
  .form-area label { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.82rem; color: #333333; font-weight: 650; }
  .form-area select, .form-area input { font: inherit; color: #111111; padding: 0.65rem; border: 1px solid #d8dbe0; border-radius: 8px; background: #fff; }
  .form-area small { font-weight: 400; color: #8c929c; }
  .actions, .bottom-actions { display: flex; gap: 0.5rem; align-items: center; grid-column: 1 / -1; }
  .btn { font: inherit; font-size: 0.82rem; font-weight: 600; border-radius: 8px; padding: 0.58rem 0.85rem; cursor: pointer; border: 1px solid transparent; transition: all 0.16s ease; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn.primary { background: #111111; color: white; }
  .btn.primary:hover:not(:disabled) { background: #23252b; }
  .btn.secondary { background: #fff; border-color: #d8dbe0; color: #111111; }
  .btn.secondary:hover:not(:disabled) { background: #f8f9fa; }
  .alert { padding: 0.7rem 0.85rem; border-radius: 8px; border: 1px solid #d8dbe0; background: #f8f9fa; margin: 0.75rem 0; color: #111111; }
  .alert.error { border-color: #fecaca; color: #dc2626; background: #fef2f2; }
  .alert.success { border-color: #cbd5e1; color: #0f172a; background: #f8fafc; font-weight: 600; }
  .match-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem; padding: 0.8rem 1.1rem; border-bottom: 1px solid #eaeaea; background: #fbfcfd; }
  .match-summary > div { display: flex; align-items: center; gap: 0.45rem; min-width: 0; color: #596273; font-size: 0.74rem; }
  .match-summary strong { margin-left: auto; color: #182231; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .match-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; }
  .match-dot.confirmed { background: #64748b; }
  .match-dot.pending { background: #b08b55; }
  .match-dot.unmatched { background: #9ca3af; }
  .preview-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0; border-bottom: 1px solid #eaeaea; }
  .preview-metrics > div { padding: 0.9rem 1rem; border-right: 1px solid #eaeaea; min-width: 0; }
  .preview-metrics > div:last-child { border-right: 0; }
  .preview-metrics span, .preview-metrics strong { display: block; }
  .preview-metrics span { font-size: 0.75rem; color: #5a5f67; }
  .preview-metrics strong { margin-top: 0.3rem; font-size: 1.05rem; color: #111111; overflow-wrap: anywhere; font-weight: 700; }
  .section-content { padding: 1rem 1.1rem; border-bottom: 1px solid #eaeaea; }
  .section-content:last-of-type { border-bottom: 0; }
  .section-content h3 { margin: 0 0 0.65rem; font-size: 0.86rem; color: #111111; font-weight: 700; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chips span { font-size: 0.75rem; padding: 0.35rem 0.5rem; border: 1px solid #d8dbe0; background: #f8f9fa; border-radius: 6px; color: #333333; }
  .map-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
  .map-grid > div { border: 1px solid #eaeaea; padding: 0.5rem; border-radius: 6px; min-width: 0; background: #f8f9fa; }
  .map-grid span, .map-grid strong { display: block; overflow-wrap: anywhere; }
  .map-grid span { font-size: 0.72rem; color: #8c929c; }
  .map-grid strong { margin-top: 0.2rem; font-size: 0.78rem; font-weight: 600; color: #111111; }
  .table-scroll { overflow: auto; max-width: 100%; }
  table { border-collapse: collapse; width: 100%; font-size: 0.78rem; }
  th { background: #f8f9fa; color: #5a5f67; font-weight: 700; text-align: left; white-space: nowrap; padding: 0.55rem 0.65rem; border-bottom: 1px solid #eaeaea; }
  td { padding: 0.55rem 0.65rem; border-bottom: 1px solid #f1f3f5; vertical-align: top; }
  .warning-list { margin: 0; padding-left: 1.2rem; color: #b45309; font-size: 0.8rem; }
  .warning-list li { margin: 0.3rem 0; }
  .import-guide { margin: 1rem 0 1.25rem; padding: 1.15rem; background: #f8fafc; border: 1px solid #e5e9ef; border-radius: 14px; }
  .import-guide-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.95rem; }
  .guide-kicker { display: block; margin-bottom: 0.3rem; color: #64748b; font-size: 0.67rem; font-weight: 800; letter-spacing: 0.1em; }
  .import-guide-heading h2 { margin: 0; color: #111827; font-size: 1rem; font-weight: 750; letter-spacing: -0.02em; }
  .import-guide-heading p { margin: 0.35rem 0 0; color: #64748b; font-size: 0.8rem; line-height: 1.55; }
  .import-guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  .import-guide-card { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; padding: 0.95rem; background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; }
  .import-guide-card.budget-guide { border-top: 3px solid #9ab6d4; }
  .import-guide-card.gr-guide { border-top: 3px solid #b2a5d5; }
  .guide-number { color: #738093; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.06em; }
  .import-guide-card h3 { margin: 0.45rem 0 0.3rem; color: #111827; font-size: 0.9rem; font-weight: 750; }
  .import-guide-card p, .import-match-note p { margin: 0; color: #586273; font-size: 0.78rem; line-height: 1.6; }
  .import-guide-card strong, .import-match-note strong { color: #202938; }
  .guide-result { display: inline-flex; margin-top: auto; padding: 0.35rem 0.55rem; background: #f1f5f9; color: #334155; border-radius: 6px; font-size: 0.7rem; font-weight: 750; }
  .import-match-note { margin-top: 0.75rem; padding: 0.85rem 0.95rem; background: #fff; border: 1px solid #e3e8ef; border-left: 3px solid #111827; border-radius: 8px; }
  .import-match-note > strong { display: block; margin-bottom: 0.25rem; font-size: 0.78rem; }
  .import-source-note { margin: 0.75rem 0 0; color: #7b8492; font-size: 0.72rem; line-height: 1.55; }
  .bottom-actions { justify-content: flex-end; padding: 1rem 1.1rem; }
  .bottom-actions .btn { min-width: 120px; }
  @media (max-width: 760px) { .form-area { grid-template-columns: 1fr; } .preview-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .preview-metrics > div { border-bottom: 1px solid #eaeaea; } .map-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .import-guide-grid { grid-template-columns: 1fr; } .match-summary { grid-template-columns: 1fr; } .page-title { flex-direction: column; } }
</style>
